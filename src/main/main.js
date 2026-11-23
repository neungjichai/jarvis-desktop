// 비서 자비스 - 메인 프로세스 진입점
// 범위: 캐릭터 위젯(UI-001), 트레이(UI-004), 단축키 대화 말풍선(UI-002 껍데기),
// 일정 알림 말풍선(UI-003 표시부), 예외 안내(UI-008), 로컬 타이머, 업데이트 안내.
// Gemini·Google Calendar는 다음 단계에서 handleChat()과 showScheduleAlert()에 연결한다.
const {
  app, globalShortcut, ipcMain, powerMonitor, screen, shell, Notification,
} = require('electron');
const settings = require('./settings');
const config = require('./config');
const { createWidgetWindow, layoutWidget } = require('./widget-window');
const { createTray, bugReportUrl } = require('./tray');
const { startFullscreenWatcher } = require('./fullscreen-watcher');
const { checkForUpdate } = require('./update-check');
const { scanFrames } = require('./frames');
const timers = require('./timers');

let win = null;
let tray = null;
let stopFullscreenWatcher = () => {};
let registeredHotkey = null;
let rendererReady = false;
const queuedBubbles = [];

// 숨김 사유를 나눠서 관리: 사용자가 OFF로 숨김 / 전체화면이라 자동 숨김
const visibility = { userHidden: false, autoHidden: false };

// ---------- 중복 실행 방지 (SFR-001) ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWidget({ pop: true }));
  app.whenReady().then(init);
}

app.setAppUserModelId('com.heyjarvis.desktop');

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function applyVisibility() {
  if (!win || win.isDestroyed()) return;
  const shouldHide = visibility.userHidden || visibility.autoHidden;
  if (shouldHide) {
    if (win.isVisible()) win.hide();
  } else if (!win.isVisible()) {
    layoutWidget(win);
    win.showInactive(); // 사용자 작업 창의 포커스를 뺏지 않는다
  }
}

function showWidget({ pop = false } = {}) {
  visibility.userHidden = false;
  visibility.autoHidden = false; // 사용자가 직접 불렀으면 전체화면이어도 보여준다
  applyVisibility();
  if (pop) send('widget:pop');
}

function hideWidgetByUser() {
  visibility.userHidden = true;
  applyVisibility();
}

// ---------- 말풍선 ----------
// 버튼 동작은 main이 id로 보관하고, 렌더러는 id만 돌려준다 (렌더러가 임의 URL을 열 수 없게)
const bubbleActions = new Map();
let actionSeq = 0;

function registerAction(fn) {
  actionSeq += 1;
  const id = `a${actionSeq}`;
  bubbleActions.set(id, fn);
  if (bubbleActions.size > 50) bubbleActions.delete(bubbleActions.keys().next().value);
  return id;
}

function handleBubbleAction(id) {
  const fn = bubbleActions.get(id);
  if (!fn) return;
  bubbleActions.delete(id);
  fn();
}

/** @param {{type?: 'notify'|'error', text: string, actions?: {label: string, run: () => void}[], sound?: boolean}} b */
function showBubble(b) {
  const payload = {
    type: b.type,
    text: b.text,
    sound: Boolean(b.sound),
    actions: (b.actions || []).map((a) => ({ label: a.label, action: registerAction(a.run) })),
  };
  if (!rendererReady) {
    queuedBubbles.push(payload);
    return;
  }
  send('bubble:show', payload);
}

function isAllowedMeetingUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:'
      && config.MEETING_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * 일정 알림 말풍선 (UI-003, SFR-003)
 * 다음 단계에서 일정 알림 엔진이 Calendar 일정 5분·10분 전에 이 함수를 호출한다.
 * @param {{ title: string, minutesBefore: number, meetingUrl?: string }} ev
 */
function showScheduleAlert(ev) {
  const actions = [];
  // 회의 링크가 없으면 [회의 참석] 버튼을 숨긴다 (화면설계서 UI-003 예외)
  if (ev.meetingUrl && isAllowedMeetingUrl(ev.meetingUrl)) {
    actions.push({ label: '회의 참석', run: () => shell.openExternal(ev.meetingUrl) });
  }
  const text = `📅 ${ev.minutesBefore}분 뒤 "${ev.title}" 일정이 있어요.`;

  if (visibility.autoHidden && Notification.isSupported()) {
    new Notification({ title: '비서 자비스', body: text }).show();
    return;
  }
  visibility.userHidden = false;
  applyVisibility();
  showBubble({ type: 'notify', text, actions, sound: true });
}

// ---------- 단축키 (SFR-001, PER-001) ----------
// 입력 말풍선은 렌더러에 미리 만들어 두고 표시만 한다 → 0.5초 이내 포커스
function openChat() {
  if (!win || win.isDestroyed()) return;
  showWidget();
  win.show();
  win.moveTop();
  win.focus();
  win.webContents.focus();
  send('input:open');
}

function registerHotkey(accelerator) {
  if (registeredHotkey) globalShortcut.unregister(registeredHotkey);
  registeredHotkey = null;
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, openChat);
  } catch {
    ok = false;
  }
  if (ok) {
    registeredHotkey = accelerator;
  } else {
    // 화면설계서 UI-006 예외: 단축키 충돌 시 안내
    showBubble({
      type: 'error',
      text: `단축키 ${accelerator.replace('Control', 'Ctrl')}가 다른 프로그램과 겹쳐요. 트레이 메뉴의 [말 걸기]로 불러 주세요.`,
    });
  }
}

// ---------- 대화 처리 ----------
// TODO(다음 단계): Gemini Structured Output 파싱 → Calendar API (SFR-002·003)
async function handleChat(text) {
  const trimmed = String(text || '').trim().slice(0, 500);
  if (!trimmed) return null;

  const t = timers.parseLocalTimer(trimmed);
  if (t) {
    timers.add(t.ms, t.label);
    return { type: 'notify', text: `${t.label} 타이머를 맞췄어요. 끝나면 알려드릴게요!` };
  }
  return {
    type: 'notify',
    text: 'AI 일정 등록은 곧 연결돼요. 지금은 "3분 타이머 맞춰줘"처럼 타이머를 맞출 수 있어요.',
  };
}

timers.setOnFire(({ label }) => {
  const text = `⏰ ${label} 타이머가 끝났어요!`;
  if (visibility.autoHidden && Notification.isSupported()) {
    // 전체화면 중에는 캐릭터 대신 OS 알림으로
    new Notification({ title: '비서 자비스', body: text }).show();
    return;
  }
  visibility.userHidden = false; // 사용자가 숨겼어도 알람은 보여준다
  applyVisibility();
  showBubble({ type: 'notify', text, sound: true });
});

// ---------- 업데이트 안내 (SFR-005 ④) ----------
function announceUpdate(update) {
  showBubble({
    type: 'notify',
    text: `새 버전 ${update.version}이 나왔어요!`,
    actions: [{ label: '다운로드', run: () => shell.openExternal(`${config.SITE_URL}/download`) }],
  });
}

// ---------- 시연 메뉴 (발표용) ----------
const demo = {
  scheduleAlert: () => showScheduleAlert({
    title: '캡스톤 팀 회의', minutesBefore: 5, meetingUrl: 'https://meet.google.com/',
  }),
  scheduleAlertNoLink: () => showScheduleAlert({ title: '도서관 스터디', minutesBefore: 10 }),
  update: () => announceUpdate({ version: 'v0.2.0' }),
  offline: () => showBubble({
    type: 'error',
    text: '인터넷 연결이 끊겼어요. 연결되면 다시 시도할게요. 타이머는 계속 쓸 수 있어요.',
  }),
  thinking: () => {
    send('widget:thinking', 2500);
    setTimeout(() => showBubble({
      type: 'notify',
      text: '오늘 남은 일정은 2개예요.\n· 15:00 팀 회의\n· 19:00 헬스장',
    }), 2500);
  },
  timer: () => {
    timers.add(10_000, '10초');
    showBubble({ type: 'notify', text: '10초 타이머를 맞췄어요. 끝나면 알려드릴게요!' });
  },
};

// ---------- 설정 변경 ----------
function applySettings(patch) {
  const before = settings.get();
  const s = settings.update(patch);
  if (s.hotkey !== before.hotkey) registerHotkey(s.hotkey);
  if (s.autoLaunch !== before.autoLaunch) {
    app.setLoginItemSettings({ openAtLogin: s.autoLaunch });
  }
  send('settings:changed', s);
}

// ---------- IPC ----------
function setupIpc() {
  ipcMain.on('widget:set-ignore-mouse', (_e, ignore) => {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });
  ipcMain.on('widget:hide', hideWidgetByUser);
  ipcMain.on('widget:release-focus', () => {
    // 입력을 끝내면 원래 작업 창으로 포커스를 돌려준다
    if (win && !win.isDestroyed() && win.isFocused()) win.blur();
  });
  ipcMain.on('bubble:action', (_e, id) => handleBubbleAction(String(id)));
  ipcMain.on('network:changed', (_e, online) => {
    // 예외 안내 (UI-008, COR-002)
    if (online) {
      showBubble({ type: 'notify', text: '인터넷에 다시 연결됐어요!' });
    } else {
      demo.offline();
    }
  });
  ipcMain.handle('chat:submit', (_e, text) => handleChat(text));
  ipcMain.handle('widget:init', () => {
    // 렌더러가 준비되면 그동안 쌓인 말풍선을 보낸다
    rendererReady = true;
    setTimeout(() => {
      while (queuedBubbles.length) send('bubble:show', queuedBubbles.shift());
    }, 600);
    return {
      settings: settings.get(),
      frames: scanFrames(),
      bubbleAutoCloseMs: config.BUBBLE_AUTO_CLOSE_MS,
      characterSize: config.CHARACTER_SIZE,
    };
  });
}

// ---------- 시작 ----------
async function init() {
  setupIpc();
  win = createWidgetWindow();

  win.once('ready-to-show', () => {
    applyVisibility();
    send('widget:pop');
  });
  win.on('closed', () => { win = null; });
  // 렌더러가 다시 로드되면 준비 상태 초기화
  win.webContents.on('did-start-loading', () => { rendererReady = false; });

  tray = createTray({
    onShow: () => showWidget({ pop: true }),
    onOpenChat: openChat,
    onBugReport: () => shell.openExternal(bugReportUrl()),
    onSettingsChange: applySettings,
    onQuit: () => app.quit(),
    demo: config.DEMO_MENU ? demo : null,
  });

  registerHotkey(settings.get().hotkey);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.get().autoLaunch });

  // 첫 실행 인사
  if (!settings.get().greeted) {
    const key = settings.get().hotkey.replace('Control', 'Ctrl');
    showBubble({
      type: 'notify',
      text: `안녕하세요, 비서 자비스예요!\n${key}를 누르면 말을 걸 수 있어요.`,
    });
    settings.update({ greeted: true });
  }

  // 모니터 구성·배율·작업 표시줄 위치 변경, 절전 복귀 시 재배치 (TER-001)
  const relayout = () => layoutWidget(win);
  screen.on('display-metrics-changed', relayout);
  screen.on('display-added', relayout);
  screen.on('display-removed', relayout);
  powerMonitor.on('resume', () => setTimeout(relayout, 1500));
  powerMonitor.on('unlock-screen', relayout);

  stopFullscreenWatcher = startFullscreenWatcher((isFull) => {
    visibility.autoHidden = isFull;
    applyVisibility();
  });

  // 업데이트 확인 (SFR-005 ④)
  const update = await checkForUpdate(app.getVersion());
  if (update) announceUpdate(update);
}

app.on('window-all-closed', (e) => e.preventDefault()); // 트레이 상주
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopFullscreenWatcher();
  timers.clearAll();
  if (tray) tray.destroy();
});

// 시스템 트레이 메뉴 (UI-004, SIR-001, SFR-004 ⑤)
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const os = require('os');
const { ASSETS_DIR, SITE_URL } = require('./config');
const settings = require('./settings');

const FREQ_LABELS = { often: '자주', sometimes: '가끔', never: '안 함' };

/** 웹사이트 버그 신고 연동 규약: /bugs/new?appVersion=1.0.2&os=windows11&from=tray */
function detectOsParam() {
  if (process.platform !== 'win32') return 'other';
  const build = Number(os.release().split('.')[2] || 0);
  return build >= 22000 ? 'windows11' : 'windows10';
}

function bugReportUrl() {
  const q = new URLSearchParams({
    appVersion: app.getVersion(),
    os: detectOsParam(),
    from: 'tray',
  });
  return `${SITE_URL}/bugs/new?${q.toString()}`;
}

/**
 * @param {{ onShow: () => void, onOpenChat: () => void, onBugReport: () => void,
 *           onSettingsChange: (patch: object) => void, onQuit: () => void }} handlers
 */
function createTray(handlers) {
  const icon = nativeImage.createFromPath(path.join(ASSETS_DIR, 'tray.png'));
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('비서 자비스');

  const build = () => {
    const s = settings.get();
    const menu = Menu.buildFromTemplate([
      { label: '자비스 불러오기', click: handlers.onShow },
      { label: `말 걸기  (${s.hotkey.replace('Control', 'Ctrl')})`, click: handlers.onOpenChat },
      { type: 'separator' },
      {
        label: '캐릭터 이동',
        submenu: settings.MOVE_FREQUENCIES.map((f) => ({
          label: FREQ_LABELS[f],
          type: 'radio',
          checked: s.moveFrequency === f,
          click: () => handlers.onSettingsChange({ moveFrequency: f }),
        })),
      },
      {
        label: 'Windows 시작 시 자동 실행',
        type: 'checkbox',
        checked: s.autoLaunch,
        click: (item) => handlers.onSettingsChange({ autoLaunch: item.checked }),
      },
      // TODO: 설정 화면(UI-006), 구글 로그인(UI-005)은 다음 단계
      { label: '설정 (준비 중)', enabled: false },
      { type: 'separator' },
      { label: '문의/버그 신고', click: handlers.onBugReport },
      { type: 'separator' },
      ...(handlers.demo ? [{
        label: '시연',
        submenu: [
          { label: '일정 알림 (회의 링크 있음)', click: handlers.demo.scheduleAlert },
          { label: '일정 알림 (회의 링크 없음)', click: handlers.demo.scheduleAlertNoLink },
          { label: 'AI 응답 중 → 답변', click: handlers.demo.thinking },
          { label: '10초 타이머', click: handlers.demo.timer },
          { label: '업데이트 안내', click: handlers.demo.update },
          { label: '오프라인 안내', click: handlers.demo.offline },
        ],
      }, { type: 'separator' }] : []),
      { label: '종료', click: handlers.onQuit },
    ]);
    tray.setContextMenu(menu);
  };

  build();
  settings.onChange(build);

  // 왼쪽 클릭: 숨긴 위젯을 즉시 다시 노출 (SFR-001)
  tray.on('click', handlers.onShow);

  return tray;
}

module.exports = { createTray, bugReportUrl };

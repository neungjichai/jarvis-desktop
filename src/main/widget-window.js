// 캐릭터 위젯 창 (UI-001, SFR-001)
// 주 모니터 작업 영역 하단(작업 표시줄 바로 위)에 가로 전체 폭의 투명 창을 하나 두고,
// 캐릭터는 그 안에서 움직인다. 캐릭터·말풍선 밖은 클릭이 아래 창으로 통과한다.
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { WIDGET_HEIGHT } = require('./config');

function computeBounds() {
  // workArea는 작업 표시줄을 뺀 영역. 작업 표시줄이 하단이 아니어도
  // "주 모니터 작업 영역 하단" 기준으로 배치된다 (화면설계서 UI-001 예외).
  const { workArea } = screen.getPrimaryDisplay();
  const height = Math.min(WIDGET_HEIGHT, workArea.height);
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - height,
    width: workArea.width,
    height,
  };
}

function createWidgetWindow() {
  const win = new BrowserWindow({
    ...computeBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, // SER-001
      nodeIntegration: false, // SER-001
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false, // 숨겨진 동안에도 애니메이션 타이밍 유지
    },
  });

  // 작업 표시줄·일반 최상단 창보다 위에 둔다.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  // 기본은 클릭 통과. 렌더러가 캐릭터 위에 마우스가 올라왔을 때만 해제한다.
  win.setIgnoreMouseEvents(true, { forward: true });

  // 외부 링크·새 창 열기 차단 (링크는 main에서 shell.openExternal로만 연다)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

function layoutWidget(win) {
  if (!win || win.isDestroyed()) return;
  win.setBounds(computeBounds());
  // 다른 최상단 창에 밀렸을 수 있으므로 다시 올린다.
  win.setAlwaysOnTop(true, 'screen-saver');
}

module.exports = { createWidgetWindow, layoutWidget };

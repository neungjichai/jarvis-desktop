// 전체화면 앱 감지 (SFR-001: 전체화면 앱 실행 중 캐릭터 자동 숨김)
// Windows의 SHQueryUserNotificationState를 상주 PowerShell 프로세스로 주기 조회한다.
// 네이티브 모듈 없이 동작하며, Windows 알림 센터가 "방해 금지" 판단에 쓰는 것과 같은 값이다.
//   2 QUNS_BUSY                  : 전체화면 앱(게임·영상 등)
//   3 QUNS_RUNNING_D3D_FULL_SCREEN: D3D 전체화면 게임
//   4 QUNS_PRESENTATION_MODE     : 프레젠테이션 모드
const { spawn } = require('child_process');
const { FULLSCREEN_POLL_MS } = require('./config');

const FULLSCREEN_STATES = new Set([2, 3, 4]);

function buildScript(intervalMs) {
  return [
    'Add-Type -TypeDefinition @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class JarvisQuns {',
    '  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);',
    '}',
    '"@',
    'while ($true) {',
    '  $s = 0',
    '  [void][JarvisQuns]::SHQueryUserNotificationState([ref]$s)',
    '  [Console]::Out.WriteLine($s)',
    '  [Console]::Out.Flush()',
    `  Start-Sleep -Milliseconds ${intervalMs}`,
    '}',
  ].join('\n');
}

/**
 * @param {(isFullscreen: boolean) => void} onChange 상태가 바뀔 때만 호출
 * @returns {() => void} 정지 함수
 */
function startFullscreenWatcher(onChange) {
  if (process.platform !== 'win32') return () => {};

  let child = null;
  let stopped = false;
  let last = null;
  let restartTimer = null;

  const start = () => {
    const encoded = Buffer.from(buildScript(FULLSCREEN_POLL_MS), 'utf16le').toString('base64');
    child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );

    let buf = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        const state = Number.parseInt(line.trim(), 10);
        if (Number.isNaN(state)) continue;
        const isFull = FULLSCREEN_STATES.has(state);
        if (isFull !== last) {
          last = isFull;
          onChange(isFull);
        }
      }
    });

    child.on('error', (err) => console.warn('[fullscreen] 감지 프로세스를 시작하지 못함', err.message));
    child.on('exit', () => {
      child = null;
      // 예기치 않게 종료되면 10초 뒤 재시작
      if (!stopped) restartTimer = setTimeout(start, 10_000);
    });
  };

  start();

  return () => {
    stopped = true;
    clearTimeout(restartTimer);
    if (child) child.kill();
  };
}

module.exports = { startFullscreenWatcher };

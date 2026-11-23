// 앱 전역 설정값. 팀 확정이 필요한 값은 TODO(확정 필요)로 표시한다.
const path = require('path');

// 릴리스 빌드 정보 (GitHub Actions 릴리스 워크플로가 빌드 직전에 만든다. git에는 올리지 않음)
// { "siteUrl": "https://…" } — 설치 파일 사용자는 환경변수를 설정하지 않으므로 사이트 주소를 여기에 굳혀 둔다.
function readBuildInfo() {
  try {
    return require('./build-info.json');
  } catch {
    return {};
  }
}
const BUILD_INFO = readBuildInfo();

function normalizeSiteUrl(v) {
  const s = String(v || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+/.test(s) || /^http:\/\/localhost(:\d+)?$/.test(s) ? s : '';
}

module.exports = {
  // 사용자 지원 웹사이트 주소 (업데이트 확인·버그 신고 연동)
  // 우선순위: 환경변수 JARVIS_SITE_URL(개발·테스트용) → 릴리스 빌드에 굳힌 주소 → 로컬 개발 서버
  SITE_URL:
    normalizeSiteUrl(process.env.JARVIS_SITE_URL) || normalizeSiteUrl(BUILD_INFO.siteUrl) || 'http://localhost:3000',

  // 위젯 창 높이(px). 캐릭터 128 + 말풍선 공간.
  WIDGET_HEIGHT: 260,
  CHARACTER_SIZE: 128,

  // 기본 단축키 (설정 화면에서 변경 예정, UI-006)
  DEFAULT_HOTKEY: 'Control+Alt+J',

  // 말풍선 자동 닫힘 시간(ms). TODO(확정 필요): 화면설계서 9장 "알림창 자동 닫힘 시간"
  BUBBLE_AUTO_CLOSE_MS: 8000,

  // 전체화면 감지 주기(ms)
  FULLSCREEN_POLL_MS: 1000,

  // 업데이트 확인 타임아웃(ms)
  UPDATE_CHECK_TIMEOUT_MS: 5000,

  // 트레이에 [시연] 메뉴 표시 (발표·테스트용). 정식 배포 전에 false로.
  DEMO_MENU: true,

  // [회의 참석] 버튼으로 열 수 있는 주소 (SFR-003: Zoom·Google Meet)
  MEETING_HOSTS: ['meet.google.com', 'zoom.us'],

  ASSETS_DIR: path.join(__dirname, '..', '..', 'assets'),
};

# 비서 자비스 — 데스크톱 앱 (1단계: 시메지 캐릭터 위젯)

작업 표시줄 위를 걸어 다니는 캐릭터 위젯입니다. 화면 상위설계의 **UI-001 캐릭터 위젯**과 **UI-004 시스템 트레이 메뉴**, 그리고 단축키로 여는 대화 입력 말풍선(UI-002의 껍데기)까지 들어 있습니다.

## 실행

```bash
npm install
npm start          # 개발 실행
npm run dist       # Windows 설치 파일 → dist/HeyJarvis-Setup-0.1.0.exe
```

- 단축키 **Ctrl+Alt+J**: 캐릭터 위에 입력 말풍선이 뜹니다. `3분 타이머 맞춰줘`, `10초 뒤 알려줘`가 지금 동작합니다.
- 캐릭터 **클릭**: 쓰다듬기(하트). **더블클릭**: 입력 말풍선.
- 캐릭터에 마우스를 올리면 **OFF** 버튼이 나옵니다. 누르면 숨고, 트레이 아이콘을 클릭하면 '뿅' 하고 다시 나옵니다.
- 업데이트 확인·버그 신고 링크의 웹사이트 주소: `JARVIS_SITE_URL` 환경변수 → 릴리스 빌드에 넣은 주소(`src/main/build-info.json`) → `http://localhost:3000` 순서로 정합니다.

## 발표 시연 순서 (약 5분)

> 발표 전날 PC에서 꼭 한 번 `npm install` → `npm start`로 띄워 보세요.
> 처음 실행하면 인사 말풍선이 한 번 뜹니다. 다시 보려면 `%APPDATA%\HeyJarvis\settings.json`을 지우세요.
> Windows 트레이 아이콘이 `^`(숨겨진 아이콘) 안에 들어가 있으면, 작업 표시줄로 끌어내 두면 시연이 편합니다.

| 순서 | 보여줄 것 | 하는 법 | 관련 요구사항 |
|---|---|---|---|
| 1 | 앱 실행 → 캐릭터 등장, 인사 말풍선 | `npm start` | SFR-001 |
| 2 | 작업 표시줄 위만 걷기, 창 가리지 않음, 캐릭터 밖 클릭 통과 | 문서 창을 띄워 두고 캐릭터 옆 빈 곳 클릭 | SFR-001, QUR-001 |
| 3 | 쓰다듬기 | 캐릭터 클릭 (하트) | UI-001 |
| 4 | 단축키 → 입력 → 타이머 | `Ctrl+Alt+J` → `10초 뒤 알려줘` Enter → 10초 뒤 알림음+말풍선 | PER-001, SFR-007 |
| 5 | 일정 알림 + [회의 참석] | 트레이 → 시연 → 일정 알림 (회의 링크 있음) → 버튼 클릭 | SFR-003, UI-003 |
| 6 | 회의 링크 없으면 버튼 숨김 | 트레이 → 시연 → 일정 알림 (회의 링크 없음) | UI-003 예외 |
| 7 | AI 응답 중 상태 → 답변 | 트레이 → 시연 → AI 응답 중 → 답변 | SFR-002 (화면) |
| 8 | 오류·오프라인 안내 | 트레이 → 시연 → 오프라인 안내 (또는 실제로 Wi-Fi 끄기) | UI-008, COR-002 |
| 9 | 업데이트 안내 | 트레이 → 시연 → 업데이트 안내 | SFR-005 ④ |
| 10 | OFF 숨김 → 트레이로 '뿅' | 캐릭터에 마우스 → OFF → 트레이 아이콘 클릭 | SFR-001 |
| 11 | 이동 빈도 | 트레이 → 캐릭터 이동 → 자주/가끔/안 함 | QUR-001 |
| 12 | 전체화면 자동 숨김 | 유튜브 영상 전체화면(F) 또는 PPT 슬라이드 쇼 | SFR-001 |
| 13 | 버그 신고 연동 | 트레이 → 문의/버그 신고 (웹사이트가 켜져 있을 때) | SFR-004 ⑤ |

### 백업: 브라우저 데모

Electron 실행에 문제가 생기면 **`demo/index.html`을 Chrome/Edge로 열면** 같은 캐릭터·말풍선 코드가 가짜 바탕화면 위에서 돌아갑니다. 왼쪽 위 패널 버튼이 트레이 [시연] 메뉴와 같고, 작업 표시줄 오른쪽 아이콘이 트레이 아이콘 역할을 합니다. `Ctrl+Alt+J`도 페이지 안에서 동작합니다.

> 슬라이드 쇼 중에는 전체화면 감지 때문에 캐릭터가 숨습니다. 발표 화면을 PPT 슬라이드 쇼로 띄운 채 시연하려면 슬라이드 쇼를 끄고 바탕화면에서 진행하세요(이것 자체가 12번 시연입니다).

## 구현한 요구사항

| 요구사항 | 구현 내용 | 파일 |
|---|---|---|
| SFR-001 최상단·투명 | `alwaysOnTop('screen-saver')`, 투명 프레임 없는 창 | `main/widget-window.js` |
| SFR-001 작업 표시줄 위 가로 이동 | 주 모니터 `workArea` 하단에 가로 전체 폭 창을 두고 그 안에서 이동 | `widget-window.js`, `renderer.js` |
| SFR-001 클릭 통과 | 기본 `setIgnoreMouseEvents(true, {forward:true})`. 캐릭터의 **불투명 픽셀**·말풍선 위에서만 해제 | `renderer.js` |
| SFR-001 OFF → hide / 트레이 → show | 숨김 사유(사용자/전체화면)를 따로 관리 | `main.js` |
| SFR-001 말풍선 중 정지 | 말풍선·응답 중·입력 중·마우스를 올린 동안에는 이동 멈춤 | `renderer.js` |
| SFR-001 전체화면 자동 숨김 | Windows `SHQueryUserNotificationState`를 상주 PowerShell로 1초마다 조회 (네이티브 모듈 없음) | `main/fullscreen-watcher.js` |
| SFR-001 중복 실행 방지·자동 실행 | `requestSingleInstanceLock`, `setLoginItemSettings` (트레이 체크박스) | `main.js`, `tray.js` |
| PER-001 단축키 0.5초 | 입력 말풍선은 미리 만들어 두고 표시·포커스만 | `renderer.js` |
| QUR-001 이동 빈도 | 트레이 → 캐릭터 이동: 자주 / 가끔 / 안 함 | `settings.js`, `tray.js` |
| UIR-001 말풍선 | 배경만 반투명, 글자·버튼 불투명, 마우스를 올리면 불투명, 화면 끝에서 안쪽 보정 | `style.css`, `renderer.js` |
| 캐릭터 상태 6종 | 걷기·앉기·쓰다듬기·알림·응답 중·오류 (화면설계서 7.1) | `sprite.js` |
| SFR-005 ④ 업데이트 안내 | 시작 시 `GET /api/releases/latest`, **숫자 비교**(v1.0.10 > v1.0.9), 말풍선 [다운로드] | `main/update-check.js` |
| SFR-004 ⑤ 버그 신고 | 트레이 [문의/버그 신고] → `/bugs/new?appVersion=…&os=windows11&from=tray` | `tray.js` |
| UI-003 일정 알림 말풍선 | `showScheduleAlert()` — 회의 링크(meet.google.com·zoom.us, https만)가 있을 때만 [회의 참석]. 캘린더 연동 전이라 시연 메뉴로 호출 | `main.js` |
| UI-008 예외 안내 | 네트워크 끊김·복구를 감지해 오류/복구 말풍선 | `renderer.js`, `main.js` |
| 말풍선 버튼 보안 | 버튼 동작은 main이 id로 보관, 렌더러는 id만 전달 → 렌더러가 임의 주소를 열 수 없음 | `main.js` |
| SFR-007 ②④ 로컬 타이머 | 메인 프로세스 타이머 → 숨겨져도 동작, 끝나면 말풍선+알림음. 전체화면 중에는 OS 알림 | `main/timers.js` |
| SER-001 | `contextIsolation`, `nodeIntegration:false`, `sandbox`, preload 허용 채널만, CSP | `preload.js`, `index.html` |
| TER-001 환경 | 모니터·배율·작업 표시줄 변경, 절전 복귀 시 재배치. 한글 조합 중 Enter 무시 | `main.js`, `renderer.js` |
| COR-001 | 입력 연속 제출 0.8초 디바운스 | `renderer.js` |

## 릴리스 배포 (PMR-002)

`.github/workflows/release.yml`이 태그를 받아 설치 파일 빌드부터 웹사이트 등록까지 자동으로 합니다.

**처음 한 번** — 이 저장소 Settings → Secrets and variables → Actions에 등록:

| Secret | 값 |
|---|---|
| `SITE_URL` | 웹사이트 운영 주소 (`https://…`, 끝에 `/` 없이). 설치 파일 안에도 들어갑니다 |
| `SYNC_SECRET` | 웹사이트 서버(Vercel)의 `SYNC_SECRET`과 같은 값 |

웹사이트 서버의 `GITHUB_REPO`는 **이 저장소**(`OWNER/REPO`)여야 합니다. 이 저장소는 공개여야 사용자가 설치 파일을 받을 수 있습니다.

**릴리스할 때마다**

```bash
# 1) package.json version을 올리고 커밋 (예: 1.0.2) → dev → main 머지
# 2) main에서 주석 태그를 만들어 push. 태그 메시지가 릴리스 노트가 됩니다
git tag -a v1.0.2 -m "버그 수정
- 말풍선이 화면 끝에서 잘리던 문제 (#12)"
git push origin v1.0.2
```

워크플로가 하는 일: 태그와 `package.json` 버전 일치 확인 → 사이트 주소를 앱에 넣기 → `HeyJarvis-Setup-1.0.2.exe` 빌드 → SHA-256 계산 → GitHub Release 생성(.exe + .sha256, 노트에 해시 표시) → 웹사이트 `POST /api/releases/sync` 등록(실패하면 몇 번 다시 시도, 이미 등록된 버전이면 그대로 둠).

- 태그 메시지가 없으면 GitHub 자동 생성 노트를 씁니다.
- 웹사이트가 꺼져 있어 등록만 실패했다면: Actions → Release → **Run workflow**에 태그를 넣으면 등록만 다시 합니다.
- 해결된 버그 연결은 웹사이트 관리자 화면(릴리스 관리)에서 합니다.
- 로컬에서 도구만 시험: `node scripts/release.mjs check-tag v0.1.0`, `node scripts/release.mjs hash <파일>`

## 폴더 구조

```
.github/        릴리스 워크플로 (태그 → 빌드 → GitHub Release → 웹사이트 등록)
scripts/        release.mjs (버전 확인·해시·웹사이트 등록 도구)
src/main/       메인 프로세스 (창·트레이·단축키·타이머·전체화면 감지·업데이트 확인)
src/preload/    렌더러에 노출하는 최소 API
src/renderer/   위젯 화면 (캐릭터 상태머신, 말풍선, 입력창, 기본 캐릭터 그림)
assets/         아이콘, frames/ (캐릭터 PNG 프레임 — frames/README.md 참고)
demo/           브라우저 백업 데모 (Electron 없이 같은 렌더러 코드 실행)
```

## 다음 단계에서 붙일 곳

- **Gemini 파싱·Calendar 연동**: `src/main/main.js`의 `handleChat()`. 지금은 로컬 타이머만 처리하고 나머지는 안내 문구를 돌려줍니다. 응답 형식은 `{ type: 'notify'|'error', text, actions? }`입니다.
- **일정 알림 엔진**: Calendar 일정을 읽어 5분·10분 전에 `showScheduleAlert({ title, minutesBefore, meetingUrl })`만 호출하면 됩니다. 말풍선·버튼·전체화면 중 OS 알림은 이미 처리됩니다.
- **시연 메뉴 끄기**: 정식 배포 전 `config.js`의 `DEMO_MENU`를 `false`로.
- **설정 화면(UI-006)·구글 로그인(UI-005)**: 트레이 메뉴에 자리만 있습니다(비활성).
- **safeStorage**: `settings.json`에는 비밀 값을 두지 않습니다. API Key·토큰은 별도 모듈로 암호화 보관합니다 (DAR-001).

## 확정이 필요한 값 (`TODO(확정 필요)`)

| 항목 | 지금 값 |
|---|---|
| 웹사이트 배포 주소 | 릴리스 빌드는 Actions Secret `SITE_URL`로 자동 주입. 개발 실행은 `http://localhost:3000` |
| 말풍선 자동 닫힘 시간 | 8초 (마우스를 올리고 있으면 연장) |
| 위젯 클릭 동작 | 클릭 = 쓰다듬기, 더블클릭 = 대화 입력 (UI-001 "클릭 시 쓰다듬기"와 UI-002 진입 경로 "위젯 클릭"이 겹쳐서 나눔) |
| 기본 단축키 | Ctrl+Alt+J |
| 캐릭터 이미지 | 코드로 그린 임시 로봇. `assets/frames/`에 PNG를 넣으면 교체 |

참고: SFR-001 본문에는 "걷기·앉기·눕기"가 있지만, 화면설계서 7.1의 확정안(6종, 대기 = 걷기·앉기 교대)을 따라 눕기는 넣지 않았습니다. 명세서 v0.3에서 문구를 맞추면 됩니다.

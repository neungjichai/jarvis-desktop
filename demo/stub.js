// 브라우저 백업 데모용 가짜 메인 프로세스.
// Electron이 없어도 같은 렌더러 코드(src/renderer)를 그대로 돌려서 화면을 보여준다.
(() => {
  const listeners = {};
  const actions = new Map();
  let seq = 0;
  const emit = (ch, p) => listeners[ch] && listeners[ch](p);

  const stage = () => document.getElementById('stage');

  function bubble(b) {
    const payload = {
      type: b.type,
      text: b.text,
      sound: b.sound,
      actions: (b.actions || []).map((a) => {
        seq += 1;
        actions.set(`a${seq}`, a.run);
        return { label: a.label, action: `a${seq}` };
      }),
    };
    showWidget();
    emit('bubble:show', payload);
  }

  function showWidget(pop) {
    stage().style.visibility = 'visible';
    if (pop) emit('widget:pop');
  }

  // main/timers.js 와 같은 규칙
  function parseLocalTimer(text) {
    if (!/(타이머|뒤|후|알람|알려)/.test(text)) return null;
    const unit = { 초: 1000, 분: 60000, 시간: 3600000 };
    const re = /(\d+)\s*(시간|분|초)/g;
    let ms = 0; const parts = []; let m;
    while ((m = re.exec(text)) !== null) { ms += Number(m[1]) * unit[m[2]]; parts.push(m[1] + m[2]); }
    return ms ? { ms, label: parts.join(' ') } : null;
  }

  window.jarvis = {
    init: async () => ({
      settings: { moveFrequency: 'often', hotkey: 'Control+Alt+J', autoLaunch: false },
      frames: {},
      bubbleAutoCloseMs: 8000,
      characterSize: 128,
    }),
    setIgnoreMouse: () => {},
    hide: () => { stage().style.visibility = 'hidden'; },
    releaseFocus: () => {},
    networkChanged: (online) => bubble(online
      ? { type: 'notify', text: '인터넷에 다시 연결됐어요!' }
      : { type: 'error', text: '인터넷 연결이 끊겼어요. 연결되면 다시 시도할게요. 타이머는 계속 쓸 수 있어요.' }),
    submitChat: async (text) => {
      const t = parseLocalTimer(text);
      if (t) {
        setTimeout(() => bubble({ type: 'notify', text: `⏰ ${t.label} 타이머가 끝났어요!`, sound: true }), t.ms);
        return { type: 'notify', text: `${t.label} 타이머를 맞췄어요. 끝나면 알려드릴게요!` };
      }
      await new Promise((r) => setTimeout(r, 1500));
      return { type: 'notify', text: 'AI 일정 등록은 곧 연결돼요. 지금은 "3분 타이머 맞춰줘"처럼 타이머를 맞출 수 있어요.' };
    },
    bubbleAction: (id) => { const fn = actions.get(id); actions.delete(id); if (fn) fn(); },
    on: (ch, fn) => { listeners[ch] = fn; return () => delete listeners[ch]; },
  };

  // 데모 패널 버튼
  window.demo = {
    show: () => showWidget(true),
    chat: () => emit('input:open'),
    schedule: () => bubble({
      type: 'notify', sound: true,
      text: '📅 5분 뒤 "캡스톤 팀 회의" 일정이 있어요.',
      actions: [{ label: '회의 참석', run: () => window.open('https://meet.google.com/', '_blank') }],
    }),
    scheduleNoLink: () => bubble({ type: 'notify', sound: true, text: '📅 10분 뒤 "도서관 스터디" 일정이 있어요.' }),
    thinking: () => {
      emit('widget:thinking', 2500);
      setTimeout(() => bubble({ type: 'notify', text: '오늘 남은 일정은 2개예요.\n· 15:00 팀 회의\n· 19:00 헬스장' }), 2500);
    },
    timer: () => {
      setTimeout(() => bubble({ type: 'notify', text: '⏰ 10초 타이머가 끝났어요!', sound: true }), 10000);
      bubble({ type: 'notify', text: '10초 타이머를 맞췄어요. 끝나면 알려드릴게요!' });
    },
    update: () => bubble({
      type: 'notify', text: '새 버전 v0.2.0이 나왔어요!',
      actions: [{ label: '다운로드', run: () => {} }],
    }),
    offline: () => window.jarvis.networkChanged(false),
    freq: (f) => emit('settings:changed', { moveFrequency: f, hotkey: 'Control+Alt+J', autoLaunch: false }),
  };

  // Ctrl+Alt+J 흉내
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); showWidget(); emit('input:open'); }
  });
})();

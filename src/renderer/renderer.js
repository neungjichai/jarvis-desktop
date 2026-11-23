// 캐릭터 위젯 렌더러 (UI-001 + 말풍선)
// 상태 6종: walk(걷기) sit(앉기) pet(쓰다듬기) notify(알림) thinking(응답 중) error(오류)
// 말풍선이 떠 있는 동안·응답 중·마우스를 올린 동안에는 이동을 멈춘다 (SFR-001).
(() => {
  const api = window.jarvis;
  const SIZE = 128;
  const SPEED = 55; // px/s
  const FRAME_FPS = 8; // PNG 프레임 재생 속도
  const WALK_PROB = { often: 0.75, sometimes: 0.35, never: 0 };

  const stage = document.getElementById('stage');
  const charEl = document.getElementById('character');
  const canvas = document.getElementById('sprite');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const offBtn = document.getElementById('off-btn');
  const bubbleEl = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const bubbleActions = document.getElementById('bubble-actions');
  const bubbleTail = document.getElementById('bubble-tail');
  const inputForm = document.getElementById('input-bubble');
  const inputEl = document.getElementById('chat-input');
  const inputTail = inputForm.querySelector('.bubble-tail');

  let settings = { moveFrequency: 'sometimes' };
  let bubbleAutoCloseMs = 8000;
  const images = {}; // state -> HTMLImageElement[]

  const S = {
    x: Math.max(0, Math.random() * (window.innerWidth - SIZE)),
    dir: Math.random() < 0.5 ? 1 : -1,
    behavior: 'sit',
    behaviorUntil: 0,
    pettingUntil: 0,
    hover: false,
    waiting: false, // AI 응답 대기
    inputOpen: false,
    bubble: null, // { type, timer }
  };

  // ---------- 상태 결정 ----------
  function currentState(now) {
    if (S.bubble && S.bubble.type === 'error') return 'error';
    if (S.waiting) return 'thinking';
    if (S.bubble) return 'notify';
    if (now < S.pettingUntil) return 'pet';
    if (S.inputOpen) return 'sit';
    return S.behavior;
  }

  function pickBehavior(now) {
    const p = WALK_PROB[settings.moveFrequency] ?? WALK_PROB.sometimes;
    if (Math.random() < p) {
      S.behavior = 'walk';
      S.behaviorUntil = now + 4000 + Math.random() * 6000;
      if (Math.random() < 0.5) S.dir = -S.dir;
    } else {
      S.behavior = 'sit';
      S.behaviorUntil = now + 4000 + Math.random() * 8000;
    }
  }

  // ---------- 그리기 ----------
  function drawCharacter(state, tSec) {
    const frames = images[state];
    if (frames && frames.length) {
      const img = frames[Math.floor(tSec * FRAME_FPS) % frames.length];
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      // 프레임 이미지는 왼쪽을 바라보는 것으로 가정 (Shimeji-ee 관례)
      if (S.dir > 0) { ctx.translate(SIZE, 0); ctx.scale(-1, 1); }
      if (img.complete) ctx.drawImage(img, 0, 0, SIZE, SIZE);
      ctx.restore();
    } else {
      window.JarvisSprite.draw(ctx, state, tSec, S.dir);
    }
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  // 말풍선을 캐릭터 머리 위에 두고, 화면 끝에서는 안쪽으로 보정 (UIR-001)
  function placeBubble(el, tail) {
    const W = window.innerWidth;
    const bw = el.offsetWidth;
    const center = S.x + SIZE / 2;
    const left = clamp(center - bw / 2, 8, Math.max(8, W - bw - 8));
    el.style.left = `${left}px`;
    tail.style.left = `${clamp(center - left, 18, bw - 18)}px`;
  }

  // ---------- 메인 루프 ----------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const W = window.innerWidth;

    if (now > S.behaviorUntil) pickBehavior(now);
    const state = currentState(now);

    if (state === 'walk' && !S.hover) {
      S.x += S.dir * SPEED * dt;
      if (S.x <= 0) { S.x = 0; S.dir = 1; }
      if (S.x >= W - SIZE) { S.x = W - SIZE; S.dir = -1; }
    }
    S.x = clamp(S.x, 0, Math.max(0, W - SIZE));

    charEl.style.transform = `translateX(${Math.round(S.x)}px)`;
    drawCharacter(state, now / 1000);
    if (S.bubble) placeBubble(bubbleEl, bubbleTail);
    if (S.inputOpen) placeBubble(inputForm, inputTail);

    requestAnimationFrame(tick);
  }

  // ---------- 클릭 통과 제어 ----------
  let ignoring = true;
  function setIgnore(ignore) {
    if (ignore === ignoring) return;
    ignoring = ignore;
    api.setIgnoreMouse(ignore);
  }

  function inside(el, x, y) {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function onCharacterPixel(x, y) {
    const r = canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    try {
      const px = Math.floor(x - r.left);
      const py = Math.floor(y - r.top);
      return ctx.getImageData(px, py, 1, 1).data[3] > 16; // 투명 픽셀은 통과
    } catch {
      return true; // 캔버스가 오염되면 사각형 기준
    }
  }

  document.addEventListener('mousemove', (e) => {
    const { clientX: x, clientY: y } = e;
    const overOff = S.hover && inside(offBtn, x, y);
    const overChar = overOff || onCharacterPixel(x, y);
    const overBubble = (S.bubble && inside(bubbleEl, x, y)) || (S.inputOpen && inside(inputForm, x, y));

    if (overChar !== S.hover) {
      S.hover = overChar;
      charEl.classList.toggle('hover', overChar);
    }
    setIgnore(!(overChar || overBubble));
  });

  document.addEventListener('mouseleave', () => {
    S.hover = false;
    charEl.classList.remove('hover');
    setIgnore(true);
  });

  // ---------- 캐릭터 상호작용 ----------
  // 클릭: 쓰다듬기 / 더블클릭: 대화 입력 (TODO(확정 필요): 위젯 클릭 동작)
  canvas.addEventListener('click', () => {
    S.pettingUntil = performance.now() + 1600;
    spawnHearts();
  });
  canvas.addEventListener('dblclick', () => openInput());

  offBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeInput(false);
    closeBubble();
    S.hover = false;
    charEl.classList.remove('hover');
    setIgnore(true);
    api.hide();
  });

  function spawnHearts() {
    for (let i = 0; i < 3; i += 1) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '♥';
      h.style.left = `${S.x + 40 + Math.random() * 48}px`;
      h.style.bottom = `${100 + Math.random() * 16}px`;
      h.style.animationDelay = `${i * 140}ms`;
      stage.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  }

  // ---------- 말풍선 ----------
  function closeBubble() {
    if (!S.bubble) return;
    clearTimeout(S.bubble.timer);
    S.bubble = null;
    bubbleEl.classList.add('hidden');
    bubbleEl.classList.remove('error');
  }

  function scheduleAutoClose() {
    clearTimeout(S.bubble.timer);
    S.bubble.timer = setTimeout(() => {
      // 마우스를 올려 읽는 중이면 조금 더 기다린다
      if (bubbleEl.matches(':hover')) scheduleAutoClose();
      else closeBubble();
    }, bubbleAutoCloseMs);
  }

  /** @param {{type?: 'notify'|'error', text: string, actions?: {label: string, action: string}[], sound?: boolean}} b */
  function showBubble(b) {
    if (!b || !b.text) return;
    closeBubble();
    S.bubble = { type: b.type === 'error' ? 'error' : 'notify', timer: null };
    bubbleText.textContent = String(b.text); // HTML로 그리지 않는다
    bubbleActions.replaceChildren();
    for (const a of Array.isArray(b.actions) ? b.actions.slice(0, 3) : []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(a.label);
      btn.addEventListener('click', () => {
        api.bubbleAction(a.action);
        closeBubble();
      });
      bubbleActions.appendChild(btn);
    }
    bubbleEl.classList.toggle('error', S.bubble.type === 'error');
    bubbleEl.classList.remove('hidden');
    placeBubble(bubbleEl, bubbleTail);
    scheduleAutoClose();
    if (b.sound) beep();
  }

  bubbleEl.addEventListener('click', (e) => {
    if (e.target === bubbleEl || e.target === bubbleText) closeBubble();
  });

  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new AudioContext();
      const t0 = audioCtx.currentTime;
      [880, 1175, 880].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + i * 0.22);
        osc.stop(t0 + i * 0.22 + 0.2);
      });
    } catch {
      // 오디오 장치 없음
    }
  }

  // ---------- 대화 입력 말풍선 (UI-002 껍데기) ----------
  function openInput() {
    closeBubble();
    S.inputOpen = true;
    inputEl.value = '';
    inputForm.classList.remove('hidden');
    placeBubble(inputForm, inputTail);
    inputEl.focus();
  }

  function closeInput(releaseFocus = true) {
    if (!S.inputOpen) return;
    S.inputOpen = false;
    inputForm.classList.add('hidden');
    inputEl.blur();
    if (releaseFocus) api.releaseFocus();
  }

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeInput();
    }
    // 한글 입력기 조합 중 Enter는 제출하지 않는다 (TER-001 한글 입력기)
    if (e.key === 'Enter' && (e.isComposing || e.keyCode === 229)) e.preventDefault();
  });

  // 다른 곳을 눌러 포커스를 잃으면 닫는다 (작업 방해 최소화)
  window.addEventListener('blur', () => closeInput(false));

  // 연속 제출 방지 (COR-001 Debounce)
  let lastSubmitAt = 0;
  inputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    const now = performance.now();
    if (S.waiting || now - lastSubmitAt < 800) return;
    lastSubmitAt = now;

    closeInput();
    S.waiting = true;
    try {
      const reply = await api.submitChat(text);
      S.waiting = false;
      if (reply) showBubble(reply);
    } catch {
      S.waiting = false;
      showBubble({ type: 'error', text: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }
  });

  // ---------- 메인 프로세스 이벤트 ----------
  api.on('widget:pop', () => {
    charEl.classList.remove('pop');
    void charEl.offsetWidth; // 애니메이션 재시작
    charEl.classList.add('pop');
  });
  api.on('bubble:show', showBubble);
  api.on('input:open', openInput);
  api.on('settings:changed', (s) => { settings = s; S.behaviorUntil = 0; });
  api.on('widget:thinking', (ms) => {
    closeBubble();
    S.waiting = true;
    setTimeout(() => { S.waiting = false; }, Number(ms) || 2000);
  });

  // 네트워크 끊김·복구 안내 (UI-008, COR-002)
  window.addEventListener('offline', () => api.networkChanged(false));
  window.addEventListener('online', () => api.networkChanged(true));

  window.addEventListener('resize', () => {
    S.x = clamp(S.x, 0, Math.max(0, window.innerWidth - SIZE));
  });

  // ---------- 시작 ----------
  api.init().then((init) => {
    settings = init.settings;
    bubbleAutoCloseMs = init.bubbleAutoCloseMs;
    for (const [state, urls] of Object.entries(init.frames || {})) {
      images[state] = urls.map((url) => {
        const img = new Image();
        img.src = url;
        return img;
      });
    }
    if (!navigator.onLine) api.networkChanged(false);
  });

  requestAnimationFrame(tick);
})();

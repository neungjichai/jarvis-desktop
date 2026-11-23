// 기본 캐릭터 (코드로 그린 임시 캐릭터)
// assets/frames/<상태>/*.png 가 있으면 renderer.js가 그 이미지를 대신 쓴다.
// 캐릭터: 나비넥타이를 맨 작은 집사 로봇 "자비스" (팀 자체 디자인 시안)
(() => {
  const C = {
    body: '#f4f6fb',
    line: '#2b3040',
    visor: '#1f2433',
    eye: '#5ee6ff',
    blush: 'rgba(255, 120, 150, 0.55)',
    tie: '#3b6cf6',
    antenna: { walk: '#5ee6ff', sit: '#5ee6ff', pet: '#ff7aa2', notify: '#ffcc33', thinking: '#a78bfa', error: '#e5484d' },
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isBlinking(t) {
    return (t % 4.2) < 0.12;
  }

  function drawEyes(ctx, state, t, lookX, cy) {
    const lx = 56 + lookX;
    const rx = 72 + lookX;
    ctx.lineCap = 'round';
    if (state === 'error') {
      ctx.strokeStyle = C.antenna.error;
      ctx.lineWidth = 2.5;
      for (const ex of [lx, rx]) {
        ctx.beginPath();
        ctx.moveTo(ex - 4, cy - 4); ctx.lineTo(ex + 4, cy + 4);
        ctx.moveTo(ex + 4, cy - 4); ctx.lineTo(ex - 4, cy + 4);
        ctx.stroke();
      }
      return;
    }
    if (state === 'pet') {
      // ^ ^ 눈
      ctx.strokeStyle = C.eye;
      ctx.lineWidth = 2.8;
      for (const ex of [lx, rx]) {
        ctx.beginPath();
        ctx.moveTo(ex - 5, cy + 2); ctx.lineTo(ex, cy - 3); ctx.lineTo(ex + 5, cy + 2);
        ctx.stroke();
      }
      return;
    }
    const sleepy = state === 'sit' && Math.sin(t * 0.7) > 0.6;
    if (isBlinking(t) || sleepy) {
      ctx.strokeStyle = C.eye;
      ctx.lineWidth = 2.5;
      for (const ex of [lx, rx]) {
        ctx.beginPath(); ctx.moveTo(ex - 4, cy); ctx.lineTo(ex + 4, cy); ctx.stroke();
      }
      return;
    }
    const r = state === 'notify' ? 5.5 : 4.5;
    const dy = state === 'thinking' ? -3 : 0;
    ctx.fillStyle = C.eye;
    ctx.shadowColor = C.eye;
    ctx.shadowBlur = 6;
    for (const ex of [lx, rx]) {
      ctx.beginPath(); ctx.arc(ex, cy + dy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx 128×128
   * @param {'walk'|'sit'|'pet'|'notify'|'thinking'|'error'} state
   * @param {number} t 초 단위 시간
   * @param {1|-1} dir 바라보는 방향
   */
  function draw(ctx, state, t, dir) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.save();
    if (dir < 0) { ctx.translate(128, 0); ctx.scale(-1, 1); }

    let bob = 0;
    let sitDrop = 0;
    let shakeX = 0;
    let squash = 1;
    if (state === 'walk') bob = -Math.abs(Math.sin(t * 9)) * 3;
    if (state === 'sit') sitDrop = 10;
    if (state === 'pet') squash = 0.94 + Math.sin(t * 18) * 0.02;
    if (state === 'notify') bob = -Math.abs(Math.sin(t * 6)) * 4;
    if (state === 'error') shakeX = Math.sin(t * 40) * 1.5;
    if (state === 'thinking') bob = Math.sin(t * 3) * 1.5;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(64, 122, 26, 4, 0, 0, Math.PI * 2); ctx.fill();

    // 발
    ctx.fillStyle = C.line;
    if (state === 'sit') {
      roundRect(ctx, 50, 114, 16, 8, 4); ctx.fill();
      roundRect(ctx, 66, 114, 16, 8, 4); ctx.fill();
    } else {
      const step = state === 'walk' ? Math.sin(t * 9) * 4 : 0;
      roundRect(ctx, 48 + step, 110, 12, 12, 5); ctx.fill();
      roundRect(ctx, 68 - step, 110, 12, 12, 5); ctx.fill();
    }

    ctx.save();
    ctx.translate(shakeX, bob + sitDrop);
    // 아래쪽 기준으로 찌그러뜨리기
    ctx.translate(64, 110); ctx.scale(1 / squash, squash); ctx.translate(-64, -110);

    // 팔
    ctx.fillStyle = C.body;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2.5;
    const armUp = state === 'notify' ? -14 : 0;
    const swing = state === 'walk' ? Math.sin(t * 9) * 3 : 0;
    ctx.beginPath(); ctx.ellipse(34, 82 + armUp + swing, 6, 10, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(94, 82 + armUp - swing, 6, 10, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 안테나
    const blink = state === 'notify' ? (Math.sin(t * 10) > 0 ? 1 : 0.35) : 1;
    ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.moveTo(64, 46); ctx.lineTo(64, 33); ctx.stroke();
    ctx.globalAlpha = blink;
    ctx.fillStyle = C.antenna[state] || C.antenna.walk;
    ctx.beginPath(); ctx.arc(64, 29, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    // 몸통
    ctx.fillStyle = C.body;
    roundRect(ctx, 36, 44, 56, 66, 26); ctx.fill(); ctx.stroke();

    // 얼굴 화면
    ctx.fillStyle = C.visor;
    roundRect(ctx, 44, 58, 40, 26, 12); ctx.fill();
    const lookX = state === 'thinking' ? 3 : 2;
    drawEyes(ctx, state, t, lookX, 71);

    // 볼터치
    if (state === 'pet') {
      ctx.fillStyle = C.blush;
      ctx.beginPath(); ctx.ellipse(44, 88, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(84, 88, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 나비넥타이
    ctx.fillStyle = C.tie;
    ctx.beginPath();
    ctx.moveTo(64, 97); ctx.lineTo(54, 91); ctx.lineTo(54, 103); ctx.closePath();
    ctx.moveTo(64, 97); ctx.lineTo(74, 91); ctx.lineTo(74, 103); ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(64, 97, 2.6, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // 생각 중 점 3개 (뒤집지 않도록 원래 좌표계에서)
    ctx.restore();
    if (state === 'thinking') {
      ctx.fillStyle = C.antenna.thinking;
      for (let i = 0; i < 3; i += 1) {
        const a = (Math.sin(t * 6 - i * 0.8) + 1) / 2;
        ctx.globalAlpha = 0.3 + a * 0.7;
        ctx.beginPath(); ctx.arc(88 + i * 10, 20 - a * 3, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  window.JarvisSprite = { draw };
})();

// 로컬 타이머 (SFR-007 ②④)
// 메인 프로세스에서 돌기 때문에 캐릭터 창이 숨겨져도 동작한다.
// 지금은 "3분 타이머", "10초 뒤 알려줘" 같은 단순 형식만 로컬에서 해석한다.
// 다음 단계에서 Gemini 해석 결과도 이 모듈의 add()로 넘긴다.

const UNIT_MS = { 초: 1000, 분: 60_000, 시간: 3_600_000 };
const MAX_MS = 24 * 3_600_000;

let seq = 0;
const active = new Map();
let onFire = () => {};

/** @returns {null | { ms: number, label: string }} */
function parseLocalTimer(text) {
  const t = String(text || '');
  if (!/(타이머|뒤|후|알람|알려)/.test(t)) return null;
  const re = /(\d+)\s*(시간|분|초)/g;
  let ms = 0;
  const parts = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    ms += Number(m[1]) * UNIT_MS[m[2]];
    parts.push(`${m[1]}${m[2]}`);
  }
  if (!ms || ms > MAX_MS) return null;
  return { ms, label: parts.join(' ') };
}

function add(ms, label) {
  seq += 1;
  const id = seq;
  const handle = setTimeout(() => {
    active.delete(id);
    onFire({ id, label });
  }, ms);
  active.set(id, { handle, label, endsAt: Date.now() + ms });
  return id;
}

function setOnFire(fn) {
  onFire = fn;
}

function clearAll() {
  for (const { handle } of active.values()) clearTimeout(handle);
  active.clear();
}

module.exports = { parseLocalTimer, add, setOnFire, clearAll };

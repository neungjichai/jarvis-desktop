// 사용자 설정 저장 (userData/settings.json).
// 비밀 값(API Key, OAuth 토큰)은 여기 두지 않는다 → 다음 단계에서 safeStorage로 별도 보관 (DAR-001).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { DEFAULT_HOTKEY } = require('./config');

const MOVE_FREQUENCIES = ['often', 'sometimes', 'never']; // 자주 / 가끔 / 안 함 (QUR-001)

const DEFAULTS = {
  moveFrequency: 'sometimes',
  hotkey: DEFAULT_HOTKEY,
  autoLaunch: false,
  greeted: false, // 첫 실행 인사를 했는지
};

let cache = null;
const listeners = new Set();

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    if (MOVE_FREQUENCIES.includes(raw.moveFrequency)) s.moveFrequency = raw.moveFrequency;
    if (typeof raw.hotkey === 'string' && raw.hotkey.trim()) s.hotkey = raw.hotkey.trim();
    if (typeof raw.autoLaunch === 'boolean') s.autoLaunch = raw.autoLaunch;
    if (typeof raw.greeted === 'boolean') s.greeted = raw.greeted;
  }
  return s;
}

function load() {
  if (cache) return cache;
  try {
    cache = sanitize(JSON.parse(fs.readFileSync(filePath(), 'utf8')));
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function get() {
  return { ...load() };
}

function update(patch) {
  const next = sanitize({ ...load(), ...patch });
  cache = next;
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[settings] 저장 실패', err);
  }
  for (const fn of listeners) fn(get());
  return get();
}

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

module.exports = { get, update, onChange, MOVE_FREQUENCIES };

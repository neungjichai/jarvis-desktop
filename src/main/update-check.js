// 업데이트 확인 (SFR-005 ④, SIR-001)
// 웹사이트 GET /api/releases/latest → { version: "v1.0.2", releasedAt, downloadUrl, sha256 }
const { net } = require('electron');
const { SITE_URL, UPDATE_CHECK_TIMEOUT_MS } = require('./config');

function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

/** a > b 이면 양수. 문자열 비교가 아니라 숫자 비교 (v1.0.10 > v1.0.9) */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * @param {string} currentVersion package.json 버전 (예: "1.0.2")
 * @returns {Promise<null | { version: string, downloadUrl: string }>}
 */
async function checkForUpdate(currentVersion) {
  if (!/^https:\/\//.test(SITE_URL) && !/^http:\/\/localhost/.test(SITE_URL)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  try {
    const res = await net.fetch(`${SITE_URL}/api/releases/latest`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null; // 404: 아직 릴리스 없음
    const data = await res.json();
    if (!parseVersion(data.version)) return null;
    if (compareVersions(data.version, `v${currentVersion}`) > 0) {
      return { version: data.version, downloadUrl: data.downloadUrl };
    }
    return null;
  } catch {
    return null; // 오프라인 등: 조용히 무시 (COR-002)
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { checkForUpdate, compareVersions };

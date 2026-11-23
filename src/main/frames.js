// 캐릭터 프레임 이미지 탐색
// assets/frames/<상태>/*.png (128×128 투명 PNG, Shimeji-ee 프레임 규격 참고)이 있으면 그 이미지를 쓰고,
// 없으면 렌더러가 코드로 그린 기본 캐릭터를 쓴다.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ASSETS_DIR } = require('./config');

const STATES = ['walk', 'sit', 'pet', 'notify', 'thinking', 'error'];

function scanFrames() {
  const result = {};
  for (const state of STATES) {
    const dir = path.join(ASSETS_DIR, 'frames', state);
    try {
      const files = fs
        .readdirSync(dir)
        .filter((f) => /\.png$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (files.length) result[state] = files.map((f) => pathToFileURL(path.join(dir, f)).href);
    } catch {
      // 폴더 없음 → 기본 캐릭터
    }
  }
  return result;
}

module.exports = { scanFrames, STATES };

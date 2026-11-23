#!/usr/bin/env node
// 릴리스 자동화 도구 — .github/workflows/release.yml 이 호출한다 (PMR-002, SER-002 ⑤⑦, SFR-005)
//
//   node scripts/release.mjs check-tag   <태그>             태그(v1.0.2)와 package.json 버전(1.0.2)이 같은지 확인
//   node scripts/release.mjs build-info                     src/main/build-info.json 생성 (SITE_URL 환경변수)
//   node scripts/release.mjs hash        <파일>             SHA-256·크기 출력 (+ <파일>.sha256 생성)
//   node scripts/release.mjs sync        <태그> <파일> <노트파일>
//                                                           웹사이트 POST /api/releases/sync 호출
//
// sync에 필요한 환경변수: SITE_URL, SYNC_SECRET, GITHUB_REPOSITORY(OWNER/REPO)
// 선택: RELEASED_AT(YYYY-MM-DD, 기본값 오늘·한국 시간), SYNC_RETRY_DELAYS_MS(테스트용, 쉼표 구분)
//
// 외부 패키지 없이 Node 20+ 기본 기능만 쓴다.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOTE_MAX = 3000; // 웹사이트 릴리스 노트 최대 길이

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

/** GitHub Actions 단계 출력 (로컬 실행 때는 화면에만) */
async function setOutput(values) {
  for (const [k, v] of Object.entries(values)) console.log(`${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(""));
  }
}

export function normalizeSiteUrl(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  if (/^https:\/\/[^/\s]+(\/[^\s]*)?$/.test(s)) return s;
  if (/^http:\/\/localhost(:\d+)?$/.test(s)) return s; // 로컬 테스트용
  return "";
}

export function parseTag(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || "").trim());
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export async function fileHash(file) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest("hex"), size };
}

/** 웹사이트 규칙(2~3000자)에 맞게 릴리스 노트를 다듬는다 */
export function fitNote(text, version) {
  let s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (s.length < 2) s = `v${version} 릴리스예요.`;
  if (s.length > NOTE_MAX) {
    const tail = "\n…(전체 내용은 GitHub 릴리스에서 볼 수 있어요)";
    s = s.slice(0, NOTE_MAX - tail.length).trimEnd() + tail;
  }
  return s;
}

export function todayKst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function buildPayload({ repo, tag, fileName, sha256, size, note, releasedAt }) {
  const version = parseTag(tag);
  return {
    version: `v${version}`,
    releasedAt,
    releaseNote: fitNote(note, version),
    downloadUrl: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`,
    sha256,
    fileSize: size,
    githubReleaseUrl: `https://github.com/${repo}/releases/tag/${tag}`,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 웹사이트에 등록한다. 201 등록 / 409 이미 등록됨 → 성공.
 * 401·422 등 요청 자체가 틀린 경우는 다시 시도해도 같으므로 바로 실패. 네트워크 오류·5xx는 몇 번 다시 시도.
 */
export async function postSync({ siteUrl, secret, payload, delays = [5000, 15000, 30000], log = console.log }) {
  const url = `${siteUrl}/api/releases/sync`;
  for (let attempt = 0; ; attempt += 1) {
    let status = 0;
    let body = {};
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      status = res.status;
      body = await res.json().catch(() => ({}));
    } catch (e) {
      log(`요청 실패: ${e instanceof Error ? e.message : e}`);
    }
    if (status === 201) return { ok: true, result: "created", body };
    if (status === 409) return { ok: true, result: "duplicate", body };
    if (status >= 400 && status < 500) return { ok: false, status, body };
    if (attempt >= delays.length) return { ok: false, status, body };
    log(`웹사이트 응답 ${status || "없음"} — ${delays[attempt] / 1000}초 뒤 다시 시도해요 (${attempt + 1}/${delays.length})`);
    await sleep(delays[attempt]);
  }
}

// ── 명령 ───────────────────────────────────────────
async function cmdCheckTag(tag) {
  const version = parseTag(tag);
  if (!version) fail(`태그는 v1.0.2 형식이어야 해요. (지금: ${tag})`);
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  if (pkg.version !== version) {
    fail(`태그 ${tag}와 package.json 버전 ${pkg.version}이 달라요. package.json을 ${version}으로 올리고 다시 태그를 만들어 주세요.`);
  }
  await setOutput({ version });
}

async function cmdBuildInfo() {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
  if (!siteUrl || !siteUrl.startsWith("https://")) {
    fail("SITE_URL 시크릿이 없거나 https:// 주소가 아니에요. (Settings → Secrets and variables → Actions)");
  }
  const file = path.join(ROOT, "src", "main", "build-info.json");
  await fs.writeFile(file, JSON.stringify({ siteUrl }, null, 2) + "\n");
  console.log(`build-info.json: ${siteUrl}`);
}

async function cmdHash(file) {
  if (!file) fail("파일 경로를 넣어 주세요.");
  const { sha256, size } = await fileHash(file);
  // GitHub 릴리스에 함께 올리는 해시 파일 (sha256sum 형식 — PowerShell Get-FileHash 결과와 비교 가능)
  await fs.writeFile(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);
  await setOutput({ sha256, size, file_name: path.basename(file) });
}

async function cmdSync(tag, file, notesFile) {
  if (!parseTag(tag)) fail(`태그는 v1.0.2 형식이어야 해요. (지금: ${tag})`);
  if (!file) fail("설치 파일 경로를 넣어 주세요.");
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
  const secret = process.env.SYNC_SECRET || "";
  const repo = process.env.GITHUB_REPOSITORY || "";
  if (!siteUrl) fail("SITE_URL 시크릿이 없거나 형식이 틀렸어요.");
  if (!secret) fail("SYNC_SECRET 시크릿이 없어요. 웹사이트 서버의 SYNC_SECRET과 같은 값을 넣어 주세요.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) fail("GITHUB_REPOSITORY(OWNER/REPO)가 없어요.");

  const { sha256, size } = await fileHash(file);
  const note = notesFile ? await fs.readFile(notesFile, "utf8").catch(() => "") : "";
  const releasedAt = process.env.RELEASED_AT || todayKst();
  const payload = buildPayload({ repo, tag, fileName: path.basename(file), sha256, size, note, releasedAt });
  console.log("등록 요청:", JSON.stringify({ ...payload, releaseNote: `(${payload.releaseNote.length}자)` }));

  const delays = process.env.SYNC_RETRY_DELAYS_MS ? process.env.SYNC_RETRY_DELAYS_MS.split(",").map(Number) : undefined;
  const r = await postSync({ siteUrl, secret, payload, delays });
  if (r.ok) {
    console.log(r.result === "created" ? `웹사이트에 ${payload.version}을 등록했어요.` : `웹사이트에 ${payload.version}이 이미 등록돼 있어요. (그대로 둠)`);
    return;
  }
  const detail = r.body?.errors ? Object.entries(r.body.errors).map(([k, v]) => `${k}: ${v}`).join(" / ") : "";
  const hint =
    r.status === 401
      ? " — SYNC_SECRET이 웹사이트 서버 값과 같은지 확인해 주세요."
      : r.status === 422 && r.body?.errors?.downloadUrl
        ? " — 웹사이트 서버의 GITHUB_REPO가 이 저장소(OWNER/REPO)와 같은지 확인해 주세요."
        : "";
  fail(`웹사이트 등록 실패 (HTTP ${r.status || "응답 없음"}) ${r.body?.error ?? ""} ${detail}${hint}`.trim());
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const cmds = { "check-tag": cmdCheckTag, "build-info": cmdBuildInfo, hash: cmdHash, sync: cmdSync };
  if (!cmds[cmd]) fail(`알 수 없는 명령: ${cmd ?? "(없음)"} — check-tag | build-info | hash | sync`);
  await cmds[cmd](...args);
}

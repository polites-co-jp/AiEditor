// Notion の API を呼ぶ共通の部品（Node.js の fetch だけ）。更新の検知（tools/watch/watch.mjs）と、取り込みの書き戻し
// （scripts/take-in.mjs。docs/06 の4節の10）が使う。ToDo の中身の組み立ては scripts/lib/notion-todo.mjs にある。
//
// 決めごと:
//   - Notion-Version は docs/06 の2.3 のとおり 2025-09-03（引数で変えられる）。
//   - 429（rate_limited）と 529（service_overload）は Retry-After（秒）に従って待ち、やり直す。
//     https://developers.notion.com/reference/request-limits
//   - 503 は、書き込み（POST・PATCH）ではやり直さない（変更が保存されたうえで 503 が返ることがあり、2回当たるため。同じ頁）。
//     読み出し（GET と data source の query）だけやり直す。
//   - トークンは誤りの文やログに出さない。誤りの文には HTTP の状態と Notion の code・message だけを入れる。
//   - トークンは scripts/lib/read-secret.ps1 を子のプロセスで呼んで受け取り、メモリにだけ持つ（docs/06 の2.4）。
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節）:
//   NOTION_VERSION, NOTION_API
//   createNotionClient({ token, fetchImpl, version, sleep, maxRetries }) → クライアント（下のメソッド）
//     .retrieveDataSource(id) / .queryDataSource(id, body) / .retrievePage(id) → null（404）/
//     .createPage(body) / .updatePage(id, body) / .appendBlockChildren(blockId, children)
//   readNotionToken({ tokenFile, readSecretScript, powershellExe, spawnSyncImpl }) → トークンの文字列（読めなければ例外）
//   NotionError（status・code を持つ Error）

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NOTION_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2025-09-03";
const RETRY_STATUSES = new Set([429, 529]);
const MAX_RETRY_AFTER_SECONDS = 120;

export const READ_SECRET_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "read-secret.ps1");

export class NotionError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = "NotionError";
    this.status = status;
    this.code = code;
  }
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Retry-After（秒の整数）をミリ秒にする。無い・読めないときは fallbackSeconds。上限を設ける。
export function retryAfterMs(headerValue, fallbackSeconds = 1) {
  const n = Number.parseInt(String(headerValue ?? ""), 10);
  const sec = Number.isFinite(n) && n >= 0 ? n : fallbackSeconds;
  return Math.min(sec, MAX_RETRY_AFTER_SECONDS) * 1000;
}

export function createNotionClient({
  token,
  fetchImpl = globalThis.fetch,
  version = NOTION_VERSION,
  sleep = defaultSleep,
  maxRetries = 3,
} = {}) {
  if (typeof token !== "string" || token.trim() === "") throw new NotionError("Notion のトークンが空");
  const auth = `Bearer ${token.trim()}`;

  async function request(method, apiPath, body, { retryOn503 = false, allow404 = false } = {}) {
    const url = `${NOTION_API}${apiPath}`;
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await fetchImpl(url, {
          method,
          headers: {
            Authorization: auth,
            "Notion-Version": version,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        // 通信の誤り。読み出しだけやり直す（書き込みは届いたかどうか分からない）
        if (retryOn503 && attempt < maxRetries) {
          await sleep(1000 * attempt);
          continue;
        }
        throw new NotionError(`Notion に接続できない（${method} ${apiPath}）: ${err && err.message}`);
      }
      if (res.ok) {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      }
      if (allow404 && res.status === 404) return null;
      const again = RETRY_STATUSES.has(res.status) || (retryOn503 && res.status === 503);
      if (again && attempt < maxRetries) {
        const wait = retryAfterMs(res.headers && res.headers.get ? res.headers.get("retry-after") : null, attempt);
        await sleep(wait);
        continue;
      }
      let code = null;
      let message = "";
      try {
        const j = await res.json();
        code = j && j.code ? String(j.code) : null;
        message = j && j.message ? String(j.message) : "";
      } catch {
        // 本文が JSON でなければ code・message なし
      }
      throw new NotionError(
        `Notion の API が誤りを返した: HTTP ${res.status}${code ? ` ${code}` : ""}（${method} ${apiPath}）${message ? `: ${message}` : ""}`,
        { status: res.status, code },
      );
    }
  }

  const id = (v) => encodeURIComponent(String(v));
  return {
    retrieveDataSource: (dataSourceId) => request("GET", `/data_sources/${id(dataSourceId)}`, undefined, { retryOn503: true }),
    // query は読み出しなので 503 でもやり直す
    queryDataSource: (dataSourceId, body = {}) =>
      request("POST", `/data_sources/${id(dataSourceId)}/query`, body, { retryOn503: true }),
    retrievePage: (pageId) => request("GET", `/pages/${id(pageId)}`, undefined, { retryOn503: true, allow404: true }),
    createPage: (body) => request("POST", "/pages", body),
    updatePage: (pageId, body) => request("PATCH", `/pages/${id(pageId)}`, body),
    appendBlockChildren: (blockId, children) => request("PATCH", `/blocks/${id(blockId)}/children`, { children }),
  };
}

// DPAPI で保護したトークンを scripts/lib/read-secret.ps1 で読む（docs/06 の2.4）。
// powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File read-secret.ps1 -Path <tokenFile>
// 標準出力の前後の空白を落として返す。終了コードが 0 でない・空のときは例外（誤りの文に値は入らない）。
export function readNotionToken({
  tokenFile,
  readSecretScript = READ_SECRET_SCRIPT,
  powershellExe = "powershell.exe",
  spawnSyncImpl = spawnSync,
} = {}) {
  if (!tokenFile) throw new Error("トークンのファイルが指定されていない");
  const r = spawnSyncImpl(
    powershellExe,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", readSecretScript, "-Path", tokenFile],
    { encoding: "utf8", windowsHide: true, timeout: 60_000 },
  );
  if (r.error) throw new Error(`read-secret.ps1 を起動できない: ${r.error.message}`);
  if (r.status !== 0) {
    const why = String(r.stderr || "").trim().split(/\r?\n/).slice(0, 3).join(" / ");
    throw new Error(`トークンを読めない（read-secret.ps1 の終了コード ${r.status}）: ${why}`);
  }
  const token = String(r.stdout || "").trim();
  if (!token) throw new Error("トークンを読めない（read-secret.ps1 の出力が空）");
  return token;
}

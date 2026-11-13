// 更新の検知の状態（state.json）とログ（watch.log）の書き方。置き場所は %LOCALAPPDATA%\Shuko\watch\（docs/06 の2.1）。
// 読み方と場所の決め方は取り込みも使うので scripts/lib/notion-todo.mjs（readWatchState・watchStatePath）にある。
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節と4節）:
//   STATE_VERSION
//   normalizeState(obj)                 → 欠けた項目を埋めた状態（null なら空の状態）
//   saveState(file, state)              → 一時ファイルに書いてから置き換える
//   nextFailingSince(prev, fetchOk, now) → 取得の失敗が続いている起点（成功したら null）
//   createLogger(file, { echo })        → { info, warn, error, lines }（1行 "<ISO>\t<LEVEL>\t<文>"。1MB で watch.log.1 に回す）

import fs from "node:fs";
import path from "node:path";

export const STATE_VERSION = 1;
const LOG_ROTATE_BYTES = 1024 * 1024;

export function normalizeState(obj) {
  const s = obj && typeof obj === "object" && !Array.isArray(obj) ? { ...obj } : {};
  return {
    version: STATE_VERSION,
    lastRunAt: typeof s.lastRunAt === "string" ? s.lastRunAt : null,
    lastFetchOkAt: typeof s.lastFetchOkAt === "string" ? s.lastFetchOkAt : null,
    lastSuccessAt: typeof s.lastSuccessAt === "string" ? s.lastSuccessAt : null,
    failingSince: typeof s.failingSince === "string" ? s.failingSince : null,
    lastErrors: Array.isArray(s.lastErrors) ? s.lastErrors.map(String) : [],
    failureTodo: s.failureTodo && typeof s.failureTodo === "object" ? s.failureTodo : null,
    seenAdvisories: Array.isArray(s.seenAdvisories) ? s.seenAdvisories.filter((x) => typeof x === "string") : [],
    targets: s.targets && typeof s.targets === "object" && !Array.isArray(s.targets) ? { ...s.targets } : {},
  };
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

// GitHub・Open VSX の取得が失敗し続けている起点（docs/06 の2.3 の「3日続けて失敗」を数えるため）。
export function nextFailingSince(prev, fetchOk, now = new Date()) {
  if (fetchOk) return null;
  return prev || (now instanceof Date ? now : new Date(now)).toISOString();
}

export function createLogger(file, { echo = false } = {}) {
  const lines = [];
  let rotated = false;
  const write = (level, message) => {
    const line = `${new Date().toISOString()}\t${level}\t${String(message).replace(/\r?\n/g, " ")}`;
    lines.push(line);
    if (echo) process.stderr.write(`${line}\n`);
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!rotated && fs.existsSync(file) && fs.statSync(file).size > LOG_ROTATE_BYTES) {
        fs.renameSync(file, `${file}.1`);
      }
      rotated = true;
      fs.appendFileSync(file, `${line}\n`, "utf8");
    } catch {
      // ログに書けなくても検知は止めない
    }
  };
  return {
    info: (m) => write("INFO", m),
    warn: (m) => write("WARN", m),
    error: (m) => write("ERROR", m),
    lines,
  };
}

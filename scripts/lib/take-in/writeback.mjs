// ToDo への書き戻し（docs/06 の4節の10・6節の4）と、検知の最後の成功日時（docs/06 の2.3 の「失敗したとき」）。
// 書き戻しの部品は p4-watch が作る。ここはそれを探して呼ぶだけで、トークンにも Notion にも直接触らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の9節。

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 書き戻しの部品が書き出す関数の名前。p4-watch の scripts/lib/notion-todo.mjs は writeBackTakeIn（2026-11-14 に確かめた形:
// writeBackTakeIn({ kind, extId, label, verdict, reasons, verdictPath, recommendation, stateFile? }) → { ok, pageId, reason }）。
export const WRITEBACK_EXPORTS = Object.freeze(["writeBackTakeIn", "writeTakeInResult"]);
export const WRITEBACK_EXPORT = WRITEBACK_EXPORTS[0];
export const WATCH_STALE_DAYS = 3;

// 書き戻しの部品の候補のファイル（repo の相対）。tools/watch/lib/*.mjs と scripts/lib/notion*.mjs。
export function writebackCandidates(repoRoot) {
  const out = [];
  const lib = path.join(repoRoot, "tools", "watch", "lib");
  if (fs.existsSync(lib)) for (const n of fs.readdirSync(lib).sort()) if (n.endsWith(".mjs")) out.push(path.join(lib, n));
  const sl = path.join(repoRoot, "scripts", "lib");
  if (fs.existsSync(sl)) for (const n of fs.readdirSync(sl).sort()) if (/^notion.*\.mjs$/.test(n)) out.push(path.join(sl, n));
  return out;
}

// 部品を探す。scripts/lib/notion*.mjs を先に見る。返り値 { fn, name, file } か { fn: null, tried }。
export async function findWriteback(repoRoot) {
  const tried = [];
  const files = writebackCandidates(repoRoot).sort((a, b) => Number(/[\\/]scripts[\\/]lib[\\/]/.test(b)) - Number(/[\\/]scripts[\\/]lib[\\/]/.test(a)));
  for (const f of files) {
    tried.push(path.relative(repoRoot, f).replace(/\\/g, "/"));
    try {
      const m = await import(pathToFileURL(f).href);
      for (const name of WRITEBACK_EXPORTS) if (typeof m[name] === "function") return { fn: m[name], name, file: f };
    } catch {
      // 読めない部品は飛ばす（記録に tried を残す）
    }
  }
  return { fn: null, tried };
}

// take-in の書き戻しの中身を、部品の引数の形にする。
//   payload: { target: { kind, id? }, label, verdict, recommendation, reasons, verdictPath, summary?, status? }
export function toWritebackArgs(payload) {
  const p = payload || {};
  const t = p.target || {};
  return {
    kind: t.kind, extId: t.kind === "ext" ? t.id : undefined, label: p.label, verdict: p.verdict, recommendation: p.recommendation,
    reasons: p.reasons || [], verdictPath: p.verdictPath, ...(p.stateFile ? { stateFile: p.stateFile } : {}),
  };
}

// 書き戻す。止めない（docs/06 の4節の10）。返り値 { ok, attempted, message, pageId?, file? }
export async function writeBack(repoRoot, payload, { find = findWriteback } = {}) {
  const w = await find(repoRoot);
  if (!w.fn) return { ok: false, attempted: false, message: `書き戻しの部品（${WRITEBACK_EXPORTS.join("・")}）が無い。探した: ${(w.tried || []).join(", ") || "なし"}` };
  try {
    const r = await w.fn(w.name === "writeTakeInResult" ? payload : toWritebackArgs(payload));
    return { ok: !!(r && r.ok), attempted: true, message: (r && (r.message || r.reason)) || null, pageId: (r && r.pageId) || null, file: path.relative(repoRoot, w.file).replace(/\\/g, "/"), fn: w.name };
  } catch (err) {
    return { ok: false, attempted: true, message: `書き戻しで例外: ${err.message}`, file: w.file, fn: w.name };
  }
}

// 検知の state.json から最後に成功した日時を読む。state.json のキーは lastSuccessAt（p4-watch と合わせる）。
// 返り値 { found, lastSuccessAt, ageDays, warn, message }
export function readWatchStatus({ statePath, now = new Date(), read = (p) => fs.readFileSync(p, "utf8") } = {}) {
  let text;
  try {
    text = read(statePath);
  } catch {
    return { found: false, lastSuccessAt: null, ageDays: null, warn: true, message: `検知の記録が無い（${statePath}）。更新の検知が動いていない恐れ` };
  }
  let s;
  try {
    s = JSON.parse(String(text).replace(/^﻿/, ""));
  } catch {
    return { found: true, lastSuccessAt: null, ageDays: null, warn: true, message: `検知の記録を読めない（${statePath}）` };
  }
  const at = s && typeof s.lastSuccessAt === "string" ? s.lastSuccessAt : null;
  const t = at ? Date.parse(at) : NaN;
  if (Number.isNaN(t)) return { found: true, lastSuccessAt: at, ageDays: null, warn: true, message: "検知の記録に lastSuccessAt が無い" };
  const ageDays = (new Date(now).getTime() - t) / 86400000;
  const warn = ageDays > WATCH_STALE_DAYS;
  return {
    found: true,
    lastSuccessAt: at,
    ageDays: Math.round(ageDays * 10) / 10,
    warn,
    message: warn ? `更新の検知が ${Math.floor(ageDays)} 日成功していない（最後 ${at}）` : `更新の検知の最後の成功: ${at}`,
  };
}

// 拡張の取り込み（docs/06 の6節、docs/04 の4節）の部品。純粋な関数と、読むだけの関数。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の8節。

import fs from "node:fs";
import path from "node:path";

function readJsonOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

// lock-fetch.mjs の fetch-result.json から、その ID の1件を返す（無ければ null）。
export function pickFetchedItem(fetchResult, id) {
  const items = fetchResult && Array.isArray(fetchResult.items) ? fetchResult.items : [];
  return items.find((i) => i && typeof i.id === "string" && i.id.toLowerCase() === String(id).toLowerCase()) || null;
}

// 前の版の取得場所: candidates（fetch-result.json を持つかもしれないフォルダ。先にあるものを優先）のうち、
// その ID・版の行があり、その行の dir に files.json があるもの。無ければ null。
export function findPrevFetchDir(candidates, id, version, { exists = fs.existsSync, read = readJsonOrNull } = {}) {
  for (const dir of Array.isArray(candidates) ? candidates : []) {
    if (!dir) continue;
    const fr = read(path.join(dir, "fetch-result.json"));
    const item = pickFetchedItem(fr, id);
    if (!item || item.version !== version || !item.dir) continue;
    if (!exists(path.join(item.dir, "files.json"))) continue;
    return { dir, itemDir: item.dir };
  }
  return null;
}

// 前の版の取得場所の候補（新しい順）。
export function prevFetchCandidates({ buildRoot, id }) {
  const out = [];
  const runs = path.join(buildRoot, "take-in", "ext", String(id).toLowerCase());
  if (fs.existsSync(runs)) {
    for (const n of fs.readdirSync(runs).sort().reverse()) out.push(path.join(runs, n));
  }
  out.push(path.join(buildRoot, "cache", "vsix"));
  out.push(path.join(buildRoot, "p0", "vsix"));
  return out;
}

// 版を渡したときの lock-fetch の --seed の中身（台帳の targetPlatform を写す）。
export function seedFor(lock, id, version) {
  const e = (Array.isArray(lock) ? lock : []).find((x) => x && String(x.id).toLowerCase() === String(id).toLowerCase());
  return [{ id: e ? e.id : id, version, ...(e && e.targetPlatform ? { targetPlatform: e.targetPlatform } : {}) }];
}

// lock-fetch の結果の判断: 取り込む版・止める理由。
//   requested: ユーザーが渡した版（無ければ null）。ledgerVersion: 台帳の今の版。
// 返り値 { ok, version, reason, noNewVersion }
export function decideExtVersion(item, { requested = null, ledgerVersion = null } = {}) {
  if (!item) return { ok: false, reason: "取得の結果にこの拡張が無い" };
  if (item.errors && item.errors.length && !item.version) return { ok: false, reason: `取得に失敗: ${item.errors.join("; ")}` };
  const v = item.version || item.chosenVersion;
  if (requested && v !== requested) {
    return { ok: false, reason: `渡した版 ${requested} でなく ${v} が選ばれた（${item.reason || ""}）。より新しく寝かせた版があるなら、その版で取り込む` };
  }
  if (!requested && ledgerVersion && v === ledgerVersion) {
    return { ok: false, noNewVersion: true, version: v, reason: `寝かせる期間を満たした新しい版が無い（台帳と同じ ${v}。${item.reason || ""}）` };
  }
  if (item.errors && item.errors.length) return { ok: false, version: v, reason: `取得の誤り: ${item.errors.join("; ")}` };
  return { ok: true, version: v, reason: item.reason || null };
}

// 台帳の1行の verdict を取り込みの判定の場所に直す（lock-verify.mjs は Phase 0 の記録を書くため）。
export function setLedgerVerdict(lock, id, version, verdictPath) {
  let hit = false;
  const out = (Array.isArray(lock) ? lock : []).map((e) => {
    if (e && String(e.id).toLowerCase() === String(id).toLowerCase() && e.version === version) {
      hit = true;
      return { ...e, verdict: verdictPath };
    }
    return e;
  });
  return { lock: out, hit };
}

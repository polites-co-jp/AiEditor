#!/usr/bin/env node
// 2つのパッチ（git format-patch の形）を、ファイルの区画ごとに比べる。読むだけで、何も書かない。
// 手で直した edits.patch と、作業ツリーで format-patch し直したものの中身が同じかを確かめるため
// （tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md の r4）。
//
// 使い方: node scripts/patch-compare.mjs <a.patch> <b.patch>
// 出力: JSON（標準出力）。
//   sections: 各パッチの区画の数、片方にしか無い区画
//   bodyDiffs: 区画ごとに、ハンクの本文（+ / - / 文脈の行の並び）が違うもの。
//              空の行（先頭の空白が落ちた文脈の行）は、1文字の空白の文脈の行として読む
//   headerIssues: ハンクの見出しの行数（-a,b +c,d の b と d）が本文の行の数と合わないもの
//   indexLines: 各パッチで index の行が無い区画
//   blankContextLines: 各パッチで、ハンクの中の空の行（先頭の空白が落ちたもの）の数
// 終了コード: 0 = 本文がすべて同じ、1 = 違う所がある、2 = 引数の誤り
//
// 書き出している関数（テストの入口）: parsePatch, compareParsed

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** パッチの本文を区画に分ける。 */
export function parsePatch(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let cur = null;
  let hunk = null;
  let left = 0; // 今のハンクで、まだ読む旧側の行数
  let right = 0; // 新側
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "-- " && !hunk) break; // 署名
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) {
      cur = { path: m[2], index: null, hunks: [], blankContext: 0 };
      sections.push(cur);
      hunk = null;
      continue;
    }
    if (!cur) continue;
    if (!hunk) {
      if (line.startsWith("index ")) cur.index = line;
    }
    const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h) {
      hunk = {
        header: line,
        oldStart: Number(h[1]), oldCount: h[2] === undefined ? 1 : Number(h[2]),
        newStart: Number(h[3]), newCount: h[4] === undefined ? 1 : Number(h[4]),
        body: [], oldSeen: 0, newSeen: 0,
      };
      cur.hunks.push(hunk);
      left = hunk.oldCount;
      right = hunk.newCount;
      continue;
    }
    if (!hunk) continue;
    if (line === "\\ No newline at end of file") { hunk.body.push(line); continue; }
    // ハンクの見出しの数を読み終えたら、次の見出しか区画までの行は本文ではない
    if (left <= 0 && right <= 0) {
      if (line === "" || line.startsWith("diff --git") || line === "-- ") { hunk = null; i--; continue; }
    }
    let kind;
    let t;
    if (line === "") { kind = " "; t = ""; cur.blankContext++; }
    else { kind = line[0]; t = line.slice(1); }
    if (kind === " ") { left--; right--; hunk.oldSeen++; hunk.newSeen++; }
    else if (kind === "-") { left--; hunk.oldSeen++; }
    else if (kind === "+") { right--; hunk.newSeen++; }
    else { hunk = null; continue; } // 本文の外（次の区画の前の行など）
    hunk.body.push(kind + t);
  }
  return sections;
}

/** 2つの解析結果を比べる。 */
export function compareParsed(a, b) {
  const byPath = (ss) => new Map(ss.map((s) => [s.path, s]));
  const A = byPath(a);
  const B = byPath(b);
  const onlyA = [...A.keys()].filter((p) => !B.has(p));
  const onlyB = [...B.keys()].filter((p) => !A.has(p));
  const bodyDiffs = [];
  for (const [p, sa] of A) {
    const sb = B.get(p);
    if (!sb) continue;
    const ba = sa.hunks.flatMap((h) => h.body).filter((l) => l[0] !== " ");
    const bb = sb.hunks.flatMap((h) => h.body).filter((l) => l[0] !== " ");
    // + / - の行の並びが同じか（文脈の量は format-patch と手書きで違いうるので、別に数える）
    let first = -1;
    for (let i = 0; i < Math.max(ba.length, bb.length); i++) if (ba[i] !== bb[i]) { first = i; break; }
    if (first >= 0) bodyDiffs.push({ path: p, firstDiff: first, a: ba[first] ?? null, b: bb[first] ?? null, aChanged: ba.length, bChanged: bb.length });
  }
  const headerIssues = (ss, name) => ss.flatMap((s) => s.hunks
    .filter((h) => h.oldSeen !== h.oldCount || h.newSeen !== h.newCount)
    .map((h) => ({ patch: name, path: s.path, header: h.header, oldSeen: h.oldSeen, newSeen: h.newSeen })));
  return {
    sections: { a: a.length, b: b.length, onlyA, onlyB },
    bodyDiffs,
    headerIssues: [...headerIssues(a, "a"), ...headerIssues(b, "b")],
    indexLines: { aMissing: a.filter((s) => !s.index).map((s) => s.path), bMissing: b.filter((s) => !s.index).map((s) => s.path) },
    blankContextLines: { a: a.reduce((n, s) => n + s.blankContext, 0), b: b.reduce((n, s) => n + s.blankContext, 0) },
  };
}

function main() {
  const [fa, fb] = process.argv.slice(2);
  if (!fa || !fb) { console.error("使い方: node scripts/patch-compare.mjs <a.patch> <b.patch>"); process.exit(2); }
  for (const f of [fa, fb]) if (!fs.existsSync(f)) { console.error(`無い: ${f}`); process.exit(2); }
  const r = compareParsed(parsePatch(fs.readFileSync(fa, "utf8")), parsePatch(fs.readFileSync(fb, "utf8")));
  r.files = { a: path.resolve(fa), b: path.resolve(fb) };
  console.log(JSON.stringify(r, null, 2));
  const same = r.bodyDiffs.length === 0 && r.sections.onlyA.length === 0 && r.sections.onlyB.length === 0;
  process.exit(same ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

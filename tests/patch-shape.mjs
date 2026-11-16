// edits.patch の形の検査(共通の部品)。ハンクの行数が見出しと合うか、1行ずつ読む読み手と見出しで読む読み手が同じ + / - の行を得るか。
// 落ちたときに、どのファイルのどのハンク(パッチの何行目)が合わないかを返す(2026-11-16。r3c の関門で、落ちた場所が読めなかった)。
// 使い方: node tests/patch-shape.mjs <patch> [--out <ファイル>]   終了コード 0 = 合う、1 = 合わない
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 1行ずつ読む読み手(テストの読み手と同じ。ハンクの中の + / - で始まる行を数える)。 */
export function readLineByLine(text) {
  const out = [];
  let cur = null;
  let inHunk = false;
  const all = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], added: [], removed: [] }; out.push(cur); inHunk = false; continue; }
    if (!cur) continue;
    // パッチの末尾の署名(`-- ` と git の版の行)は、削除の行ではない
    if (line === '-- ' && /^\d+\.\d+/.test(all[i + 1] ?? '')) { inHunk = false; continue; }
    if (!inHunk) { if (/^@@ /.test(line)) inHunk = true; continue; }
    if (/^@@ /.test(line)) continue;
    if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
  return out;
}

/**
 * 見出しの行数で読む読み手。ハンクごとの行数を見出しと照らす。
 * 返す: { sections, problems }。problems: { path, hunkAtLine, header, reason }[]（パッチの行番号は 1 始まり）
 */
export function readByHunkCounts(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const problems = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const d = /^diff --git a\/(.+) b\/(.+)$/.exec(lines[i]);
    if (d) { cur = { path: d[2], added: [], removed: [] }; sections.push(cur); continue; }
    const h = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(lines[i]);
    if (!h || !cur) continue;
    let oldN = h[1] === undefined ? 1 : Number(h[1]);
    let newN = h[2] === undefined ? 1 : Number(h[2]);
    const start = i + 1;
    let j = i + 1;
    let reason = null;
    for (; (oldN > 0 || newN > 0) && j < lines.length; j++) {
      const l = lines[j];
      if (l.startsWith('\\')) continue;
      if (l.startsWith('+')) { cur.added.push(l.slice(1)); newN--; } else if (l.startsWith('-')) { cur.removed.push(l.slice(1)); oldN--; } else if (l.startsWith(' ') || l === '') { oldN--; newN--; } else { reason = `行 ${j + 1} が + - 空白で始まらない: ${JSON.stringify(l.slice(0, 50))}`; break; }
    }
    if (!reason && (oldN !== 0 || newN !== 0)) reason = `行数が見出しと合わない(残り -${oldN} +${newN})`;
    // 余り: 見出しの行数を読み終えた次の行が、文脈・+・- の続きなら、見出しより行が多い
    if (!reason && j < lines.length) {
      const nx = lines[j];
      if (nx.startsWith('+') || nx.startsWith('-') && !nx.startsWith('-- ') && nx !== '--' || nx.startsWith(' ')) reason = `見出しの行数のあとにも続きの行がある(行 ${j + 1}: ${JSON.stringify(nx.slice(0, 50))})`;
    }
    if (reason) problems.push({ path: cur.path, hunkAtLine: start, header: lines[i].slice(0, 60), reason });
    i = j - 1;
  }
  return { sections, problems };
}

/** 検査する。返す: { ok, problems, diffs, text }。text は読める形の説明(落ちたときの出力用)。 */
export function checkPatchShape(text) {
  const a = readLineByLine(text);
  const { sections: b, problems } = readByHunkCounts(text);
  const diffs = [];
  if (a.length !== b.length) diffs.push({ path: '(全体)', reason: `区画の数が違う: 1行ずつ ${a.length} / 見出し ${b.length}` });
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    for (const kind of ['added', 'removed']) {
      const x = a[k][kind];
      const y = b[k][kind];
      if (x.length === y.length && x.every((l, i) => l === y[i])) continue;
      let at = 0;
      while (at < x.length && at < y.length && x[at] === y[at]) at++;
      diffs.push({ path: a[k].path, reason: `${kind === 'added' ? '+' : '-'} の行が違う: 1行ずつ ${x.length} 行 / 見出し ${y.length} 行。最初に違うのは ${at + 1} 行目: 1行ずつ ${JSON.stringify(x[at]?.slice(0, 70))} / 見出し ${JSON.stringify(y[at]?.slice(0, 70))}` });
    }
  }
  const ok = problems.length === 0 && diffs.length === 0;
  const textOut = [
    ...problems.map((p) => `ハンクが合わない: ${p.path} (パッチの ${p.hunkAtLine} 行目の ${p.header}) ${p.reason}`),
    ...diffs.map((d) => `読み手が食い違う: ${d.path} ${d.reason}`),
  ].join('\n');
  return { ok, problems, diffs, text: textOut };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const out = oi >= 0 ? argv[oi + 1] : null;
  const file = argv.find((a, i) => !a.startsWith('--') && !(oi >= 0 && i === oi + 1));
  if (!file) { console.error('使い方: node tests/patch-shape.mjs <patch> [--out <ファイル>]'); process.exit(2); }
  const r = checkPatchShape(readFileSync(file, 'utf8'));
  const msg = r.ok ? '合う' : r.text;
  console.log(msg);
  if (out) writeFileSync(out, msg + '\n');
  process.exit(r.ok ? 0 : 1);
}

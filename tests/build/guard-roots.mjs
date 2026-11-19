// テストが本物の作業場所（C:\b・<リポジトリ>\tmp\b・local.json の buildRoot）に書かないことの見張り（2026-11-16 の直し）。
// 本物の <buildRoot> は、大きな木（clone・作業ツリー・残す版）を持つ。テストが作って消しても、名前と更新時刻は動くので、
// 木の浅い所（既定は深さ3）の名前・大きさ・更新時刻を前後で比べる。tests/run-all.mjs が、ファイル1つごとに前後で呼ぶ。
// 本物の実行（ビルド・取り込み）と同時に走らせると誤って検出する。そのときは run-all を、それが止まってから走らせる。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LEGACY_ROOT = 'C:\\b';
export const DEFAULT_ROOT = path.win32.join(REPO, 'tmp', 'b');

/** 見張る根の一覧: C:\b、既定の <リポジトリ>\tmp\b、local.json があればその buildRoot。同じ場所は1つにする。 */
export function guardedRoots(extra = []) {
  const roots = [LEGACY_ROOT, DEFAULT_ROOT, ...extra];
  try {
    const la = process.env.LOCALAPPDATA;
    if (la) {
      const p = path.join(la, 'Sukuna', 'local.json');
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
        if (j && typeof j.buildRoot === 'string' && j.buildRoot) roots.push(j.buildRoot);
      }
    }
  } catch {
    // 壊れた local.json は見張りの対象外（ここで落とさない）
  }
  const seen = new Set();
  const out = [];
  for (const r of roots) {
    const n = path.win32.normalize(r).replace(/[\\/]+$/, '');
    if (seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

// 常設の clone の .git は、git が読むだけでも index などを更新し、作業ツリーの登録（git worktree add）でも動く。見張りの対象にしない。
export const IGNORED = ['vscode\\.git'];

/** 根の下を深さ maxDepth まで歩き、{ 相対パス: "d|f 大きさ 更新時刻" } を返す。根が無ければ null。リンクは辿らない。 */
export function snapshotRoot(root, maxDepth = 3, ignore = IGNORED) {
  if (!fs.existsSync(root)) return null;
  const snap = {};
  const ignored = (rel) => ignore.some((i) => rel.toLowerCase() === i || rel.toLowerCase().startsWith(i + '\\'));
  const walk = (dir, rel, depth) => {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const n of names) {
      const p = path.join(dir, n);
      let st;
      try {
        st = fs.lstatSync(p);
      } catch {
        continue;
      }
      const r = rel ? rel + '\\' + n : n;
      if (ignored(r)) continue;
      const isDir = st.isDirectory();
      snap[r] = `${isDir ? 'd' : 'f'} ${isDir ? 0 : st.size} ${Math.round(st.mtimeMs)}`;
      if (isDir && !st.isSymbolicLink() && depth < maxDepth) walk(p, r, depth + 1);
    }
  };
  // 根そのものの更新時刻（根の直下に作って消した跡を見つけるため）。キー '.' は相対パスと衝突しない。
  try {
    snap['.'] = `d 0 ${Math.round(fs.lstatSync(root).mtimeMs)}`;
  } catch {
    /* 根が消えた直後など */
  }
  walk(root, '', 1);
  return snap;
}

export function snapshotAll(roots = guardedRoots(), maxDepth = 3) {
  const all = {};
  for (const r of roots) all[r] = snapshotRoot(r, maxDepth);
  return all;
}

/** 前後の差を、人が読める行の配列で返す（差が無ければ空）。 */
export function diffSnapshots(before, after) {
  const lines = [];
  for (const root of Object.keys(after)) {
    const b = before[root] ?? null;
    const a = after[root] ?? null;
    if (b === null && a === null) continue;
    if (b === null) {
      lines.push(`${root}: 根が作られた`);
      continue;
    }
    if (a === null) {
      lines.push(`${root}: 根が消えた`);
      continue;
    }
    for (const k of Object.keys(a)) {
      if (!(k in b)) lines.push(`${root}: 増えた ${k}`);
      else if (a[k] !== b[k]) lines.push(`${root}: 変わった ${k}`);
    }
    for (const k of Object.keys(b)) if (!(k in a)) lines.push(`${root}: 消えた ${k}`);
  }
  return lines;
}

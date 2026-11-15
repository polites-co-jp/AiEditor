// C-3 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c3-patch/handoff-notes.md の「テストの入口」の6、removals/C-3-remote/unit.json と README。
//   - contrib/remote・contrib/remoteTunnel・platform/remoteTunnel・build/gulpfile.reh.ts が無い
//   - services/tunnel・services/remote/common/remoteExplorerService.ts・platform/remote/electron-browser/sharedProcessTunnelService.ts・
//     api/browser/mainThreadTunnelService.ts と、unit.json の kept が全部ある
//   - viewsExtensionPoint.ts に `const REMOTE = 'workbench.view.remote';` がちょうど1行あり、contrib/remote/ を import していない
//   - sharedProcessMain.ts に remoteTunnel の語が無い。workbench.{common,desktop,web}.main.ts に contrib/remote・contrib/remoteTunnel・platform/remoteTunnel の import が無い
//   - product.json に productRemove の9つのキーが無い
//   - removeLines の行が各ファイルに残っていない
// 使い方: node tests/c3-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
export const VIEWS = `${W}api/browser/viewsExtensionPoint.ts`;
export const SHARED = 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts';
export const MAINS = [`${W}workbench.common.main.ts`, `${W}workbench.desktop.main.ts`, `${W}workbench.web.main.ts`];
export const CONST_LINE = "const REMOTE = 'workbench.view.remote';";
export const MUST_BE_DELETED = [`${W}contrib/remote`, `${W}contrib/remoteTunnel`, 'src/vs/platform/remoteTunnel', 'build/gulpfile.reh.ts',
  `${W}contrib/remote/browser/remoteExplorer.ts`];
export const MUST_STAY = [`${W}services/tunnel`, `${W}services/remote/common/remoteExplorerService.ts`, 'src/vs/platform/remote/electron-browser/sharedProcessTunnelService.ts',
  `${W}api/browser/mainThreadTunnelService.ts`, 'src/vs/platform/tunnel', 'src/vs/platform/remote', `${W}services/remote`];

/** root: 作業ツリーのフォルダ。unit: removals/C-3-remote/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  const withText = (p, fn) => { const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t); };

  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);

  withText(VIEWS, (t) => {
    const n = t.split('\n').filter((l) => l.trim() === CONST_LINE).length;
    if (n !== 1) bad.push(`viewsExtensionPoint.ts の ${CONST_LINE} が ${n} 行（ちょうど1行のはず）`);
    const imp = t.split('\n').filter((l) => /^\s*import\b/.test(l) && /contrib\/remote\//.test(l));
    if (imp.length) bad.push(`viewsExtensionPoint.ts がまだ contrib/remote/ を import している: ${imp[0].trim().slice(0, 120)}`);
    if ([...t.matchAll(/\bREMOTE\b/g)].length < 4) bad.push('viewsExtensionPoint.ts の REMOTE の使い所が少ない（定数1つ + 使う3か所のはず）');
  });
  withText(SHARED, (t) => {
    if (/remoteTunnel/i.test(t)) bad.push('sharedProcessMain.ts にまだ remoteTunnel の語がある');
  });
  for (const f of MAINS) {
    withText(f, (t) => {
      const hit = t.split('\n').find((l) => /contrib\/remote(Tunnel)?\/|platform\/remoteTunnel/.test(l));
      if (hit) bad.push(`${f.split('/').pop()} にまだ消した部品の import がある: ${hit.trim().slice(0, 120)}`);
    });
  }
  if (existsSync(at('product.json'))) {
    const t = text('product.json');
    for (const k of unit.productRemove ?? []) if (new RegExp(`"${k}"\\s*:`).test(t)) bad.push(`product.json にまだ ${k} がある`);
  } else bad.push('product.json が無い');
  for (const r of unit.removeLines ?? []) {
    const t = text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c3-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-3-remote', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

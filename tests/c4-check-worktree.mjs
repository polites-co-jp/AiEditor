// C-4 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c4-patch/handoff-notes.md の「テストの入口」の6、removals/C-4-notebook/unit.json と README。
//   - contrib/notebook/browser・contrib/interactive・contrib/replNotebook・contrib/outline・contrib/search/browser/notebookSearch・
//     contrib/search/common/notebookSearch.ts・api/browser/mainThreadNotebookDto.ts が無い(unit.json の delete が全部無い)
//   - contrib/notebook/common・services/notebook・contrib/search/common/searchNotebookHelpers.ts・api/common/extHostRemovedApi.notebook.ts と kept が全部ある
//   - extHost.protocol.ts に Notebook の Shape の interface の宣言と createProxyIdentifier<...Notebook が無い。NotebookCellDataDto はある
//   - extHost.api.impl.ts に extHostNotebook の語が無く、createRemovedNotebookApi がちょうど2回(import と呼び出し)ある
//   - folderMatch.ts が FileMatchImpl を createInstance し、notebook の語の import が無い
//   - searchModel.ts・searchResult.ts・searchView.ts・replaceService.ts・bulkCellEdits.ts に @INotebook が無い
//   - search.contribution.ts に closedNotebookRichContentResults が無い
//   - removeLines の行が各ファイルに残っていない
// 使い方: node tests/c4-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
export const NEW_API = `${W}api/common/extHostRemovedApi.notebook.ts`;
export const PROTOCOL = `${W}api/common/extHost.protocol.ts`;
export const API_IMPL = `${W}api/common/extHost.api.impl.ts`;
export const FOLDER_MATCH = `${W}contrib/search/browser/searchTreeModel/folderMatch.ts`;
export const NO_INJECTION = [`${W}contrib/search/browser/searchTreeModel/searchModel.ts`, `${W}contrib/search/browser/searchTreeModel/searchResult.ts`,
  `${W}contrib/search/browser/searchView.ts`, `${W}contrib/search/browser/replaceService.ts`, `${W}contrib/bulkEdit/browser/bulkCellEdits.ts`];
export const SEARCH_CONTRIBUTION = `${W}contrib/search/browser/search.contribution.ts`;
export const MUST_BE_DELETED = [`${W}contrib/notebook/browser`, `${W}contrib/interactive`, `${W}contrib/replNotebook`, `${W}contrib/outline`,
  `${W}contrib/search/browser/notebookSearch`, `${W}contrib/search/common/notebookSearch.ts`, `${W}api/browser/mainThreadNotebookDto.ts`];
export const MUST_STAY = [`${W}contrib/notebook/common`, `${W}services/notebook`, `${W}contrib/search/common/searchNotebookHelpers.ts`, NEW_API];

/** root: 作業ツリーのフォルダ。unit: removals/C-4-notebook/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  const withText = (p, fn) => { const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t); };

  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);

  withText(NEW_API, (t) => { if (!/export function createRemovedNotebookApi\(/.test(t)) bad.push(`${NEW_API} に createRemovedNotebookApi が無い`); });
  withText(PROTOCOL, (t) => {
    const shapes = [...t.matchAll(/^export interface (\w*Notebook\w*Shape|\w*Interactive\w*Shape)\b/gm)].map((m) => m[1]);
    if (shapes.length) bad.push(`extHost.protocol.ts にまだ Shape の宣言がある: ${shapes.join(', ')}`);
    const ids = t.split('\n').filter((l) => /createProxyIdentifier<\w*(Notebook|Interactive)/.test(l));
    if (ids.length) bad.push(`extHost.protocol.ts にまだ proxy の ID がある: ${ids[0].trim().slice(0, 100)}`);
    if (!t.includes('NotebookCellDataDto')) bad.push('extHost.protocol.ts から NotebookCellDataDto が無くなっている(DTO は残す)');
  });
  withText(API_IMPL, (t) => {
    if (/extHostNotebook|ExtHostNotebook|ExtHostInteractive/.test(t)) bad.push('extHost.api.impl.ts にまだ extHostNotebook・ExtHostNotebook・ExtHostInteractive の語がある');
    const n = [...t.matchAll(/createRemovedNotebookApi/g)].length;
    if (n !== 2) bad.push(`extHost.api.impl.ts の createRemovedNotebookApi が ${n} 回（import と呼び出しの2回のはず）`);
  });
  withText(FOLDER_MATCH, (t) => {
    if (!/createInstance\(\s*FileMatchImpl\b/.test(t)) bad.push('folderMatch.ts が FileMatchImpl を createInstance していない');
    const imp = t.split('\n').find((l) => /^\s*import\b/.test(l) && /notebook/i.test(l));
    if (imp) bad.push(`folderMatch.ts にまだ notebook の import がある: ${imp.trim().slice(0, 100)}`);
    if (/NotebookCompatibleFileMatch/.test(t)) bad.push('folderMatch.ts にまだ NotebookCompatibleFileMatch がある');
  });
  for (const f of NO_INJECTION) withText(f, (t) => { if (/@INotebook\w+/.test(t)) bad.push(`${f.split('/').pop()} にまだ @INotebook の注入がある`); });
  withText(SEARCH_CONTRIBUTION, (t) => { if (t.includes('closedNotebookRichContentResults')) bad.push('search.contribution.ts にまだ closedNotebookRichContentResults がある'); });
  for (const r of unit.removeLines ?? []) {
    const t = text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c4-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-4-notebook', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

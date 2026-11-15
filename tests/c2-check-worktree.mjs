// C-2 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c2-patch/handoff-notes.md の「テストの入口」の5、removals/C-2-debug/unit.json と README。
//   - 新しいファイル src/vs/workbench/api/common/extHostRemovedApi.debug.ts がある（createRemovedDebugApi を export する）
//   - extHost.protocol.ts に MainThreadDebugService・ExtHostDebugService・contrib/debug/common が無い
//   - extHost.api.impl.ts が createRemovedDebugApi(extension) を呼び、IExtHostDebugService を使わない
//   - debug.service.contribution.ts に NullDebugService があり、./debugService.js が無い
//   - workbench.common.main.ts に debug.service.contribution.js の import がちょうど1行あり、消した Debug の6行が無い
//   - workbench.desktop.main.ts・workbench.web.main.ts の extensionHostDebugService の import は残る
//   - notebook.contribution.ts に notebookVariablesView・notebookInlineValues の登録が無い。repl.contribution.ts に list.find.replInputFocus が無い
//   - variablesActions.ts が無い。build/next/resources.ts に debug/browser/media が無い。build/next/index.ts に telemetryApp が無い
//   - unit.json の delete が全部無い、kept が全部ある、removeLines の行が各ファイルに残っていない
// 使い方: node tests/c2-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
export const NEW_API = `${W}api/common/extHostRemovedApi.debug.ts`;
export const MUST_BE_DELETED = [`${W}contrib/notebook/browser/controller/variablesActions.ts`, `${W}contrib/debug/browser/debugService.ts`,
  `${W}contrib/debug/browser/debug.contribution.ts`, `${W}api/common/extHostDebugService.ts`, `${W}api/node/extHostDebugService.ts`,
  `${W}api/browser/mainThreadDebugService.ts`, `${W}contrib/debug/node`, `${W}contrib/notebook/browser/contrib/notebookVariables`];
export const MUST_STAY = [`${W}contrib/debug/common/debug.ts`, `${W}contrib/debug/common/nullDebugService.ts`, `${W}contrib/debug/browser/debug.service.contribution.ts`,
  `${W}contrib/debug/browser/extensionHostDebugService.ts`, `${W}contrib/debug/electron-browser/extensionHostDebugService.ts`,
  `${W}contrib/debug/browser/callStackWidget.ts`, `${W}contrib/debug/browser/callStackEditorContribution.ts`, `${W}contrib/debug/browser/debugIcons.ts`,
  `${W}contrib/debug/browser/debugColors.ts`, 'src/vs/platform/debug'];
const SERVICE_IMPORT = "import './contrib/debug/browser/debug.service.contribution.js';";
const REMOVED_MAIN_IMPORTS = ["debug/browser/debug.contribution.js'", "debug/browser/debugEditorContribution.js'", "debug/browser/breakpointEditorContribution.js'",
  "debug/browser/callStackEditorContribution.js'", "debug/browser/repl.js'", "debug/browser/debugViewlet.js'"];

/** root: 作業ツリーのフォルダ。unit: removals/C-2-debug/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  // C-4 が当たっている木(新しいファイル extHostRemovedApi.notebook.ts がある)では、C-4 の delete の中のパス(ノートブックの notebook.contribution.ts ほか)は見ない
  // (C-4 を含む組 b でも、1回で照らせるようにする。大岡越前守の検証 2026-11-15 の軽微な指摘)
  const c4Marker = existsSync(at(`${W}api/common/extHostRemovedApi.notebook.ts`));
  const c4Del = c4Marker && existsSync(join(REPO, 'removals', 'C-4-notebook', 'unit.json')) ? (readJson(join(REPO, 'removals', 'C-4-notebook', 'unit.json')).delete ?? []) : [];
  const inC4 = (p) => c4Del.some((d) => p === d.replace(/\/+$/, '') || p.startsWith(d.replace(/\/+$/, '') + '/'));
  const withText = (p, fn) => { if (inC4(p)) return; const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t); };

  // 新しいファイル
  withText(NEW_API, (t) => {
    if (!/export function createRemovedDebugApi\(/.test(t)) bad.push(`${NEW_API} に createRemovedDebugApi が無い`);
  });
  // 拡張 API の実装の側
  withText(`${W}api/common/extHost.protocol.ts`, (t) => {
    for (const n of ['MainThreadDebugService', 'ExtHostDebugService', 'contrib/debug/common']) if (t.includes(n)) bad.push(`extHost.protocol.ts にまだ ${n} がある`);
  });
  withText(`${W}api/common/extHost.api.impl.ts`, (t) => {
    if (!/createRemovedDebugApi\(extension\)/.test(t)) bad.push('extHost.api.impl.ts が createRemovedDebugApi(extension) を呼んでいない');
    if (!/import \{ createRemovedDebugApi \} from '\.\/extHostRemovedApi\.debug\.js';/.test(t)) bad.push('extHost.api.impl.ts が extHostRemovedApi.debug.js を import していない');
    if (/IExtHostDebugService|extHostDebugService/.test(t)) bad.push('extHost.api.impl.ts にまだ IExtHostDebugService・extHostDebugService がある');
    if (/MainThreadDebugService|ExtHostContext\.ExtHostDebugService/.test(t)) bad.push('extHost.api.impl.ts にまだ消した ID の参照がある');
  });
  for (const f of [`${W}api/common/extHost.common.services.ts`, `${W}api/node/extHost.node.services.ts`]) {
    if (existsSync(at(f)) && /IExtHostDebugService|extHostDebugService/.test(text(f))) bad.push(`${f} にまだ IExtHostDebugService・extHostDebugService がある`);
  }
  if (existsSync(at(`${W}api/browser/extensionHost.contribution.ts`)) && /mainThreadDebugService/.test(text(`${W}api/browser/extensionHost.contribution.ts`))) bad.push('extensionHost.contribution.ts にまだ mainThreadDebugService がある');
  // サービスの登録
  withText(`${W}contrib/debug/browser/debug.service.contribution.ts`, (t) => {
    if (!/NullDebugService/.test(t)) bad.push('debug.service.contribution.ts に NullDebugService が無い');
    if (!/NullDebugVisualizerService/.test(t)) bad.push('debug.service.contribution.ts に NullDebugVisualizerService が無い');
    if (t.includes('./debugService.js')) bad.push('debug.service.contribution.ts にまだ ./debugService.js がある');
    if (/registerSingleton\(\s*IDebugService\s*,\s*DebugService\b/.test(t)) bad.push('debug.service.contribution.ts が元の DebugService を登録している');
  });
  // main のファイル
  withText(`${W}workbench.common.main.ts`, (t) => {
    const n = t.split('\n').filter((l) => l.trim() === SERVICE_IMPORT).length;
    if (n !== 1) bad.push(`workbench.common.main.ts の debug.service.contribution.js の import が ${n} 行（ちょうど1行のはず）`);
    for (const s of REMOVED_MAIN_IMPORTS) if (t.includes(s)) bad.push(`workbench.common.main.ts にまだ ${s} がある`);
  });
  for (const [f, imp] of [[`${W}workbench.desktop.main.ts`, 'electron-browser/extensionHostDebugService.js'], [`${W}workbench.web.main.ts`, 'browser/extensionHostDebugService.js']]) {
    withText(f, (t) => { if (!t.includes(imp)) bad.push(`${f} から ${imp} の import が消えている（残す。拡張機能のホストが注入する）`); });
  }
  // ノートブックと REPL
  withText(`${W}contrib/notebook/browser/notebook.contribution.ts`, (t) => {
    for (const n of ['notebookVariablesView', 'notebookInlineValues', 'notebook.variablesView', 'notebook.inlineValues', 'NotebookVariables', 'notebookVariables/']) if (t.includes(n)) bad.push(`notebook.contribution.ts にまだ ${n} がある`);
  });
  withText(`${W}contrib/replNotebook/browser/repl.contribution.ts`, (t) => {
    if (t.includes('list.find.replInputFocus')) bad.push('repl.contribution.ts にまだ list.find.replInputFocus がある');
    if (/debug\/browser\/repl\.js|getReplView/.test(t)) bad.push('repl.contribution.ts にまだ getReplView・debug/browser/repl.js がある');
  });
  withText(`${W}contrib/notebook/browser/controller/editActions.ts`, (t) => {
    if (t.includes('NotebookInlineVariablesController')) bad.push('editActions.ts にまだ NotebookInlineVariablesController がある');
  });
  // ビルドの一覧
  if (existsSync(at('build/next/resources.ts')) && text('build/next/resources.ts').includes('debug/browser/media')) bad.push('build/next/resources.ts にまだ debug/browser/media がある');
  if (existsSync(at('build/next/index.ts')) && text('build/next/index.ts').includes('debug/node/telemetryApp')) bad.push('build/next/index.ts にまだ debug/node/telemetryApp がある');
  // 消えるはず・残るはず
  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!inC4(k) && !existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);
  // removeLines の行が、各ファイルに残っていない(ファイルが無ければ飛ばす。ファイルが消えたものは delete の検査)
  for (const r of unit.removeLines ?? []) {
    const t = inC4(r.file) ? null : text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c2-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-2-debug', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

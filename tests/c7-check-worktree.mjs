// C-7 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c7-patch/handoff-notes.md の「テストの入口」の6、removals/C-7-breadcrumbs-outline/unit.json と README、
//   本家 1.146.0（消す部品が登録するサービスの ID は IOutlineService・IBreadcrumbsService。tests/c7-unit.test.mjs が本家から読んで REGISTERED_IDS と合っていることを確かめる）。
//   - unit.json の delete が全部無い。kept と、差分エディタのパンくず(editor/contrib/diffEditorBreadcrumbs)、エディタの枠のタブ・グループのファイルがある
//   - 型検査に掛からない注入の外し損ね: src/vs の全体で、消したサービスの ID を使う所が無い(コメントと試験用の資料を除く)。@IOutlineService・@IBreadcrumbsService・
//     BreadcrumbsControlFactory・notifyOutlineChanged・showBreadcrumbs が 0 件。消した部品への import が無い
//   - エディタの枠: editorHeaderControl.ts に breadcrumbs の語が無い。editorTitleControl.ts に handleEditorsChange が無い。singleEditorTabsControl.ts に breadcrumbsControl が無く breadcrumbsInHeader はある。
//     auxiliaryEditorPart.ts・common/editor.ts に showBreadcrumbs が無い
//   - 記号へ移動(gotoSymbolQuickAccess.ts)は provideWithoutTextEditor・installNavigablePicks・IOutlineService が無く、getSymbolPicks と workbench.action.gotoSymbol の登録はある
//   - カスタムエディタ(mainThreadCustomEditors.ts)は input.navigation = navigation があり、IOutlineService が無い
//   - removeLines の行が各ファイルに残っていない
// 使い方: node tests/c7-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
const P = `${W}browser/parts/editor/`;
export const HEADER = `${P}editorHeaderControl.ts`;
export const TITLE = `${P}editorTitleControl.ts`;
export const SINGLE = `${P}singleEditorTabsControl.ts`;
export const AUX = `${P}auxiliaryEditorPart.ts`;
export const COMMON_EDITOR = `${W}common/editor.ts`;
export const GOTO = `${W}contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts`;
export const CUSTOM = `${W}api/browser/mainThreadCustomEditors.ts`;
export const MAIN_COMMON = `${W}workbench.common.main.ts`;
/** 消す部品が登録するサービスの ID（本家の delete の中の registerSingleton から読んだもの） */
export const REGISTERED_IDS = ['IBreadcrumbsService', 'IOutlineService'];
export const MUST_BE_DELETED = [`${P}breadcrumbs.ts`, `${P}breadcrumbsControl.ts`, `${P}breadcrumbsModel.ts`, `${P}breadcrumbsPicker.ts`, `${P}media/breadcrumbscontrol.css`, `${W}services/outline`, `${W}contrib/codeEditor/browser/outline`];
// 枠のタブ・グループ・差分エディタのファイルは、C-7 が触れないので残る
export const MUST_STAY = ['src/vs/base/browser/ui/breadcrumbs', 'src/vs/editor/contrib/documentSymbols', 'src/vs/editor/contrib/diffEditorBreadcrumbs', 'src/vs/platform/theme/browser/defaultStyles.ts',
  `${P}editorGroupView.ts`, `${P}multiEditorTabsControl.ts`, `${P}editorTabsControl.ts`, `${P}media/singleeditortabscontrol.css`, HEADER, TITLE, SINGLE, AUX, GOTO, CUSTOM];
/** 消した部品への import（パスの形） */
const DELETED_IMPORT = /['"][^'"\n]*(\/breadcrumbsControl\.js|\/breadcrumbsModel\.js|\/breadcrumbsPicker\.js|parts\/editor\/breadcrumbs\.js|services\/outline\/browser\/outline(Service)?\.js|codeEditor\/browser\/outline\/documentSymbolsOutline\.js)['"]/;
const WORDS = ['@IOutlineService', '@IBreadcrumbsService', 'BreadcrumbsControlFactory', 'notifyOutlineChanged', 'showBreadcrumbs'];

/** src/vs の下の .ts を全部たどる(node_modules は除く)。[相対パス, 本文] の配列。 */
function allTs(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (e.name.endsWith('.ts')) out.push([r, readFileSync(join(dir, e.name), 'utf8').replace(/\r\n/g, '\n')]);
    }
  };
  const base = join(root, 'src', 'vs');
  if (existsSync(base)) walk(base, 'src/vs');
  return out;
}
const code = (t) => t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

/** root: 作業ツリーのフォルダ。unit: removals/C-7-breadcrumbs-outline/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  const withText = (p, fn) => { const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t, p.split('/').pop()); };
  const forbid = (t, name, words) => { for (const w of words) if (t.includes(w)) bad.push(`${name} にまだ ${w} がある`); };
  const need = (t, name, words) => { for (const w of words) if (!t.includes(w)) bad.push(`${name} から ${w} が消えている(残す)`); };

  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);

  // 型検査に掛からない注入の外し損ね: src/vs の全体を走査する
  for (const [rel, t] of allTs(root)) {
    if (/\.perf-data\.ts$/.test(rel)) continue; // 試験用のデータ(ソースの断片を文字列で持つ)
    const c = code(t);
    for (const id of REGISTERED_IDS) {
      if (new RegExp(`@${id}\\b`).test(c)) bad.push(`${rel} に消したサービスの注入 @${id} が残る(起動時に UNKNOWN service になる)`);
      else if (new RegExp(`\\b${id}\\b`).test(c)) bad.push(`${rel} に消したサービス ${id} を使う所が残る`);
    }
    for (const w of WORDS) if (c.includes(w) && !REGISTERED_IDS.some((id) => w === `@${id}`)) bad.push(`${rel} にまだ ${w} がある`);
    if (DELETED_IMPORT.test(t.split('\n').filter((l) => /^\s*(import|export)\b|\bfrom\s+['"]/.test(l)).join('\n'))) bad.push(`${rel} に消した部品への import が残る`);
    if (/registerOutlineCreator\(/.test(c) && !/services\/outline\//.test(rel)) bad.push(`${rel} がアウトラインの登録(registerOutlineCreator)を呼ぶ(サービスは消えた)`);
  }

  withText(HEADER, (t, n) => { if (/breadcrumbs/i.test(t)) bad.push(`${n} にまだ breadcrumbs の語がある`); });
  withText(TITLE, (t, n) => forbid(t, n, ['handleEditorsChange']));
  withText(SINGLE, (t, n) => {
    if (/breadcrumbsControl/i.test(t)) bad.push(`${n} にまだ breadcrumbsControl の語がある`);
    forbid(t, n, ['handleBreadcrumbsEnablementChange']);
    need(t, n, ['breadcrumbsInHeader']);
  });
  withText(AUX, (t, n) => forbid(t, n, ['showBreadcrumbs']));
  withText(COMMON_EDITOR, (t, n) => forbid(t, n, ['showBreadcrumbs']));
  withText(GOTO, (t, n) => {
    forbid(code(t), n, ['provideWithoutTextEditor', 'installNavigablePicks', 'IOutlineService']); // コメントの語は数えない
    need(t, n, ['getSymbolPicks', 'workbench.action.gotoSymbol', 'IOutlineModelService']);
  });
  withText(CUSTOM, (t, n) => {
    forbid(code(t), n, ['IOutlineService', '_outlineService', 'notifyOutlineChanged']);
    need(t, n, ['input.navigation = navigation']);
  });
  withText(MAIN_COMMON, (t, n) => forbid(t, n, ['services/outline/', 'codeEditor/browser/outline/']));

  for (const r of unit.removeLines ?? []) {
    const t = text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c7-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-7-breadcrumbs-outline', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

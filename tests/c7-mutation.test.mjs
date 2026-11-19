// c7-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C7_UNIT_DIR でそこを指して c7-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C7_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c7-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-7-breadcrumbs-outline');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-7-breadcrumbs-outline の unit.json か edits.patch が無い';
import { UPSTREAM_REPO as UP_REPO_DEFAULT } from './build/root.mjs';
const upOk = existsSync(UP_REPO_DEFAULT) && spawnSync('git', ['-C', UP_REPO_DEFAULT, 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const c1Lines = existsSync(join(REPO, 'removals', 'C-1-ai', 'unit.json')) ? readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json')).removeLines : [];

/** 写しを作って c7-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c7mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = readJson(join(SRC, 'unit.json'));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C7_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C7_NO_UPSTREAM; else env.AIED_C7_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c7-unit.test.mjs')], {
      // NODE_TEST_CONTEXT が残っていると、子の node --test が「再帰」として何も走らせない
      cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env,
    });
    const failed = [...(r.stdout || '').matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
    const count = Number(/^# tests (\d+)/m.exec(r.stdout || '')?.[1] ?? 0);
    return { failed, count, out: `${(r.stdout || '').slice(0, 600)}\n${(r.stderr || '').slice(0, 600)}`, changed: res.patch !== before || JSON.stringify(res.unit) !== JSON.stringify(unit), status: r.status };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const sub = (text, from, to, all = false) => {
  const re = typeof from === 'string' ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), all ? 'g' : '') : from;
  const out = text.replace(re, to);
  assert.notEqual(out, text, `置き換えが当たらない: ${String(from).slice(0, 60)}`);
  return out;
};
// format-patch の署名('-- ')の前に区画を足す(署名より後は読まれない)
const append = (patch, extra) => sub(patch, /\r?\n-- \r?\n/, `\n${extra}-- \n`);
const section = (path, lines) => `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${lines}\n`;
const W = 'src/vs/workbench/';
const P = `${W}browser/parts/editor/`;
/** 消す行(-)を文脈の行( )に戻す(消し忘れた壊し方)。すべての当たりを戻す */
const keepAll = (patch, re) => sub(patch, new RegExp(re.source, `${re.flags.replace('g', '')}g`), ' $1');

test('c7-mutation: 壊さない写しは c7-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 24, `c7-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-7-breadcrumbs-outline: edits', 'Subject: [PATCH] unit C-7-breadcrumbs-outline: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: sukuna-apply <apply@sukuna\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after から C-1 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: unit.after.filter((a) => a !== 'C-1-ai') } }), /after/],
  ['after から C-4 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: unit.after.filter((a) => a !== 'C-4-notebook') } }), /after/],
  ['after に C-5 が入る(前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: [...unit.after, 'C-5-extension-gallery'] } }), /after/],
  ['order が B-4 より前', ({ patch, unit }) => ({ patch, unit: { ...unit, order: 10 } }), /after|order/],
  ['delete に残す部品(パンくずの部品)が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/base/browser/ui/breadcrumbs'] } }), /delete は本家の消すファイル10/],
  ['delete に差分エディタのパンくずが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/editor/contrib/diffEditorBreadcrumbs'] } }), /delete は本家の消すファイル10/],
  ['delete に記号の木が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/editor/contrib/documentSymbols'] } }), /delete は本家の消すファイル10/],
  ['delete に枠のタブのファイルが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${P}editorGroupView.ts`] } }), /delete は本家の消すファイル10/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /delete は本家の消すファイル10/],
  ['delete から breadcrumbsPicker.ts が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: unit.delete.filter((d) => !/breadcrumbsPicker\.ts$/.test(d)) } }), /delete は本家の消すファイル10/],
  ['kept からパンくずの部品が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/base/browser/ui/breadcrumbs') } }), /kept に/],
  ['kept から記号の木が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/editor/contrib/documentSymbols') } }), /kept に/],
  ['kept の理由が空', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.map((k) => (k.path === 'src/vs/editor/contrib/documentSymbols' ? { ...k, reason: '' } : k)) } }), /kept に/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/keep/keep.js';" }] } }), /removeLines は/],
  ['removeLines の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, unit.removeLines[0]] } }), /removeLines は/],
  ['removeLines の行が足りない', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.slice(1) } }), /removeLines は/],
  ['removeLines がデスクトップの main に触れる', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.desktop.main.ts`, line: "import './services/outline/browser/outlineService.js';" }] } }), /removeLines は/],
  ['removeLines が C-1 の removeLines と同じ行を消す(二重)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, c1Lines[0]] } }), /二重|removeLines は/],
  ['productRemove が空でない', ({ patch, unit }) => ({ patch, unit: { ...unit, productRemove: ['x'] } }), /productRemove は空/],
  ['依存を消す', ({ patch, unit }) => ({ patch, unit: { ...unit, removeDependencies: { x: ['y'] } } }), /productRemove は空/],
  // 枠の決まった4ファイルのほかに触れる
  ['patch がタブの枠(editorGroupView.ts)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${P}editorGroupView.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch がタブの枠(multiEditorTabsControl.ts)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${P}multiEditorTabsControl.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch がタブの枠(editorTabsControl.ts)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${P}editorTabsControl.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch がグループ(editorPart.ts)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${P}editorPart.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が差分エディタのパンくずを触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/editor/contrib/diffEditorBreadcrumbs/diffEditorBreadcrumbs.ts', '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が差分エディタを触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/editor/browser/widget/diffEditor/diffEditorWidget.ts', '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が Webview を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/webview/browser/webviewElement.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch がカスタムエディタを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/customEditor/browser/customEditorInput.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が main のファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}workbench.desktop.main.ts`, "-import './a.js';\n+")), unit }), /エディタの枠|触るファイルは/],
  ['patch が拡張 API(api/common)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}api/common/extHost.api.impl.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch がパンくずの部品(base/browser/ui/breadcrumbs)を触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/base/browser/ui/breadcrumbs/breadcrumbsWidget.ts', '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が delete したファイルを直す', ({ patch, unit }) => ({ patch: append(patch, section(`${P}breadcrumbsControl.ts`, '-a\n+b')), unit }), /エディタの枠|触るファイルは/],
  ['patch が新しいファイルを増やす', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${P}other.ts b/${P}other.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/${P}other.ts\n@@ -0,0 +1 @@\n+export {};\n`), unit }), /触るファイルは|エディタの枠/],
  ['patch がファイルを消す', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${P}editorGroupView.ts b/${P}editorGroupView.ts\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/${P}editorGroupView.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n`), unit }), /触るファイルは|エディタの枠/],
  ['patch が記号へ移動の登録を消す', ({ patch, unit }) => ({ patch: sub(patch, "+import { DisposableStore } from '../../../../../base/common/lifecycle.js';", "-\t\tid: 'workbench.action.gotoSymbol',\n+import { DisposableStore } from '../../../../../base/common/lifecycle.js';"), unit }), /消す行は|足す行|触るファイル/],
  ['patch が足す行にアウトラインの語を足す', ({ patch, unit }) => ({ patch: sub(patch, "+import { DisposableStore } from '../../../../../base/common/lifecycle.js';", "+import { DisposableStore } from '../../../../../base/common/lifecycle.js'; // Outline"), unit }), /消す行は/],
  // 枠の直しが不足する(消し忘れ)
  ['枠のヘッダーに handleEditorsChange が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(.*handleEditorsChange.*)$/m), unit }), /枠の4ファイルの直し/],
  ['補助ウィンドウの showBreadcrumbs: false が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(\s*showBreadcrumbs: false,?)$/m), unit }), /枠の4ファイルの直し/],
  ['共有の型の showBreadcrumbs が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(\s*showBreadcrumbs\?: boolean;)$/m), unit }), /枠の4ファイルの直し/],
  ['1枚のタブの枠のパンくずの更新が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(.*handleBreadcrumbsEnablementChange.*)$/m), unit }), /枠の4ファイルの直し/],
  ['記号へ移動に IOutlineService の注入が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(.*@IOutlineService.*)$/m), unit }), /注入の直し/],
  ['smoke から claude-code が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, smoke: ['base', 'absence'] } }), /smoke に/],
  ['checks のコマンドが減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: unit.checks.absentCommands.slice(1) } } }), /消したコマンド・設定の登録/, true],
  ['checks の設定が減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentSettings: unit.checks.absentSettings.slice(1) } } }), /消したコマンド・設定の登録/, true],
  ['checks にビューが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentViews: ['workbench.view.outline'] } } }), /消したコマンド・設定の登録/, true],
  ['checks の文字列が減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: unit.checks.absentStrings.slice(1) } } }), /checks の項目が本家/, true],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/outline/browser/nonexistent.js';" }] } }), /本家 1\.146\.0 にある|removeLines は/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}services/outline/browser/nonexistentThing.ts`] } }), /delete のパスが本家|delete は本家の消すファイル10|delete・kept のパスが本家/, true],
  ['kept のパスが本家に無い', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: [...unit.kept, { path: `${W}services/outline/common/nonexistent.ts`, reason: 'テストのための嘘のパス' }] } }), /delete・kept のパスが本家/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: "nonexistent/zzz.js'" }] } } }), /checks の項目が本家/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export class BreadcrumbsWidget' }] } } }), /checks の項目が本家/, true],
  ['absentCommands に delete の外にも登録があるコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands.slice(0, 3), 'workbench.action.gotoSymbol'] } } }), /消したコマンド・設定の登録/, true],
  // 型検査に掛からない注入の外し損ね(本家の注入する所を、edits.patch の後に残す)
  ['記号へ移動の IOutlineService の注入が残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(.*@IOutlineService.*)$/m), unit }), /注入: 消したサービスの ID を使う所|注入の直し/, true],
  ['カスタムエディタの IOutlineService の import が残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(import \{ IOutlineService \}[^\n]*)$/m), unit }), /注入: 消したサービスの ID を使う所/, true],
  ['テストの IOutlineService の差し替えが残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepAll(patch, /^-(\s*[^\n]*stub\(IOutlineService[^\n]*)$/m), unit }), /注入: 消したサービスの ID を使う所/, true],
];

for (const [name, mutate, expect, needsUp] of CASES) {
  test(`c7-mutation: ${name} と c7-unit.test.mjs が落ちる`, { skip: noSrc || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

// c4-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C4_UNIT_DIR でそこを指して c4-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C4_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c4-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-4-notebook');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-4-notebook の unit.json か edits.patch が無い';
import { UPSTREAM_REPO as UP_REPO_DEFAULT } from './build/root.mjs';
const upOk = existsSync(UP_REPO_DEFAULT) && spawnSync('git', ['-C', UP_REPO_DEFAULT, 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const c3Lines = existsSync(join(REPO, 'removals', 'C-3-remote', 'unit.json')) ? readJson(join(REPO, 'removals', 'C-3-remote', 'unit.json')).removeLines : [];

/** 写しを作って c4-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c4mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = readJson(join(SRC, 'unit.json'));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C4_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C4_NO_UPSTREAM; else env.AIED_C4_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c4-unit.test.mjs')], {
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

test('c4-mutation: 壊さない写しは c4-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 45, `c4-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-4-notebook: edits', 'Subject: [PATCH] unit C-4-notebook: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: shuko-apply <apply@shuko\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after から C-2 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: unit.after.filter((x) => x !== 'C-2-debug') } }), /after/],
  ['after から B-4 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: unit.after.filter((x) => x !== 'B-4-outline-view') } }), /after/],
  ['after に C-3 が入る(C-3 を前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: [...unit.after, 'C-3-remote'] } }), /after/],
  ['order が C-2 より前', ({ patch, unit }) => ({ patch, unit: { ...unit, order: 10 } }), /order|after/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}services/notebook`] } }), /delete と kept/],
  ['delete に notebook/common の中が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/notebook/common/notebookCommon.ts`] } }), /delete と kept|kept に contrib\/notebook\/common/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /delete と kept に同じパスが無い/],
  ['kept から notebook/common が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== `${W}contrib/notebook/common`) } }), /kept に contrib\/notebook\/common/],
  ['kept から services/notebook が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== `${W}services/notebook`) } }), /kept に contrib\/notebook\/common/],
  ['kept の理由が空', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.map((k) => (k.path === `${W}services/notebook` ? { ...k, reason: '' } : k)) } }), /kept に contrib\/notebook\/common/],
  ['delete から mainThreadNotebookDto.ts が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: unit.delete.filter((d) => !/mainThreadNotebookDto/.test(d)) } }), /kept に contrib\/notebook\/common/],
  ['delete が after に無い単位(C-3)の delete と重なる', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/remote`] } }), /重なるのは after/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/keep/keep.js';" }] } }), /removeLines の各行/],
  ['removeLines の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, unit.removeLines[0]] } }), /重複/],
  ['removeLines の行が足りない(proxy の ID の1行)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.filter((r) => !/^ExtHostInteractive:/.test(r.line)) } }), /22行/],
  ['removeLines の file が delete の中', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}contrib/notebook/browser/x.ts`, line: "import './a.js';" }] } }), /22行|delete の中ではない/],
  ['removeLines が C-3 の removeLines と同じ行を消す(二重)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, c3Lines[0]] } }), /二重/],
  ['removeLines の ID の Shape を patch が消さない', ({ patch, unit }) => ({ patch: sub(patch, /^-(export interface ExtHostNotebookShape )/m, ' $1'), unit }), /removeLines の各行|Shape の14個/],
  ['patch が proxy の ID の行を消す(removeLines と二重)', ({ patch, unit }) => ({ patch: sub(patch, '-export interface MainThreadInteractiveShape extends IDisposable {', "-\tMainThreadInteractive: createProxyIdentifier<MainThreadInteractiveShape>('MainThreadInteractive'),\n-export interface MainThreadInteractiveShape extends IDisposable {"), unit }), /ID の行|二重/],
  ['patch が DTO を消す', ({ patch, unit }) => ({ patch: sub(patch, '-export interface MainThreadInteractiveShape extends IDisposable {', '-export interface VariablesResult {\n-export interface MainThreadInteractiveShape extends IDisposable {'), unit }), /DTO は残す|Shape の14個/],
  ['patch が main のファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}workbench.common.main.ts`, "-import './a.js';\n+")), unit }), /触るファイルは|触れない/],
  ['patch が extensionHost.contribution.ts を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}api/browser/extensionHost.contribution.ts`, "-import './a.js';\n+")), unit }), /触るファイルは|触れない/],
  ['patch が viewsExtensionPoint.ts(C-3)を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}api/browser/viewsExtensionPoint.ts`, '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が新しいファイルを増やす', ({ patch, unit }) => ({ patch: append(patch, 'diff --git a/src/vs/workbench/api/common/extHostRemovedApi.other.ts b/src/vs/workbench/api/common/extHostRemovedApi.other.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/api/common/extHostRemovedApi.other.ts\n@@ -0,0 +1 @@\n+export {};\n'), unit }), /触るファイルは/],
  ['patch がファイルを消す', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${W}services/notebook/common/notebookDocumentService.ts b/${W}services/notebook/common/notebookDocumentService.ts\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/${W}services/notebook/common/notebookDocumentService.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n`), unit }), /触るファイルは|ファイルは消さない/],
  ['patch が delete したファイルを直す', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/notebook/browser/notebookBrowser.ts`, '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['extHost.api.impl.ts がノートブックと関係の無い行を消す', ({ patch, unit }) => ({ patch: sub(patch, " import Severity from '../../../base/common/severity.js';", "-import Severity from '../../../base/common/severity.js';"), unit }), /ノートブックの行だけ/],
  ['extHost.api.impl.ts が消した ExtHostNotebook を参照する', ({ patch, unit }) => ({ patch: sub(patch, '+\t\tconst removedNotebookApi = createRemovedNotebookApi(extension);', '+\t\tconst removedNotebookApi = createRemovedNotebookApi(extension);\n+\t\tconst x = extHostNotebook;'), unit }), /ノートブックの行だけ/],
  ['extHost.api.impl.ts の window の展開が消える', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t\t...removedNotebookApi.window,', ''), unit }), /ノートブックの行だけ/],
  ['openNotebookDocument が reject しない', ({ patch, unit }) => ({ patch: sub(patch, /(openNotebookDocument\([^\n]*\{\r?\n\+\t\t\t)return Promise\.reject\(new Error\(notebooksUnavailable\)\);/, '$1return Promise.resolve({} as any);'), unit }), /reject する/],
  ['showNotebookDocument が reject しない', ({ patch, unit }) => ({ patch: sub(patch, /(showNotebookDocument\([^\n]*\{\r?\n\+\t\t\t)return Promise\.reject\(new Error\(notebooksUnavailable\)\);/, '$1return Promise.resolve({} as any);'), unit }), /reject する/],
  ['notebookDocuments が空でない', ({ patch, unit }) => ({ patch: sub(patch, '+\t\tnotebookDocuments: [],', '+\t\tnotebookDocuments: [{} as any],'), unit }), /空の値/],
  ['イベントが Event.None でなくなる', ({ patch, unit }) => ({ patch: sub(patch, 'onDidOpenNotebookDocument: Event.None,', 'onDidOpenNotebookDocument: new Emitter<void>().event,'), unit }), /イベント9つ|空の値/],
  ['イベントのメンバーが欠ける', ({ patch, unit }) => ({ patch: sub(patch, '+\t\tonDidCloseNotebookDocument: Event.None,', ''), unit }), /イベント9つ|空の値|メンバー20個/],
  ['提案中の API の門が消える', ({ patch, unit }) => ({ patch: sub(patch, "checkProposedApiEnabled(extension, 'notebookKernelSource');", '', true), unit }), /門/],
  // 大岡越前守の検証(2026-11-15)で見つかった抜け。蒙恬が実装に門を足すまでは、実装に門が無く置き換えが当たらないので飛ばす(足した後に走る)
  ['updateNotebookAffinity の門(notebookControllerAffinityHidden)が外れる(Hidden を渡しても誤りにならない)', ({ patch, unit }) => ({ patch: sub(patch, /^\+\s*checkProposedApiEnabled\(extension, 'notebookControllerAffinityHidden'\);\r?\n/m, ''), unit }), /過不足なく|updateNotebookAffinity は、提案を有効に/, true, /notebookControllerAffinityHidden/],
  ['updateNotebookAffinity の門が条件なしになる(Default でも誤りを投げる)', ({ patch, unit }) => ({ patch: sub(patch, /^\+(\s*)if \([^\n]*(?:-1|Hidden)[^\n]*\) \{/m, '+$1{'), unit }), /過不足なく|updateNotebookAffinity は、提案を有効に/, true, /notebookControllerAffinityHidden/],
  ['安定版の registerNotebookSerializer に門が付く', ({ patch, unit }) => ({ patch: sub(patch, /(registerNotebookSerializer\([^\n]*\{\r?\n\+)(\t\t\treturn noopDisposable\(\);)/, "$1\t\t\tcheckProposedApiEnabled(extension, 'notebookKernelSource');\n+$2"), unit }), /reject する\(同じ文言\)|Disposable/],
  ['createNotebookCellExecution が誤りを投げない', ({ patch, unit }) => ({ patch: sub(patch, /(createNotebookCellExecution\([^\n]*\{\r?\n\+\t\t\t)throw new Error\(notebooksUnavailable\);/, '$1return undefined as any;'), unit }), /各メンバーの最初の文/],
  ['label の既定が消える', ({ patch, unit }) => ({ patch: sub(patch, 'label: label || extension.identifier.value,', 'label,'), unit }), /createNotebookController は id/],
  ['createRendererMessaging の postMessage が true', ({ patch, unit }) => ({ patch: sub(patch, /(createRendererMessaging\([^\n]*\{\r?\n\+\t\t\treturn \{\r?\n\+\t\t\t\tonDidReceiveMessage: Event\.None,\r?\n\+\t\t\t\tpostMessage\([^\n]*\{\r?\n\+\t\t\t\t\t)return Promise\.resolve\(false\);/, '$1return Promise.resolve(true);'), unit }), /createNotebookController は id|createRendererMessaging/],
  ['通信を呼ぶ', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tdispose\(\): void \{\r?\n\+)(\t\t\})/, '$1\t\t\tfetch("https://x.invalid");\n+$2'), unit }), /通信/],
  ['消した部品の import が入る', ({ patch, unit }) => ({ patch: sub(patch, "+import { Event } from '../../../base/common/event.js';", "+import { Event } from '../../../base/common/event.js';\n+import { ExtHostNotebookController } from './extHostNotebook.js';"), unit }), /import は vscode|消した部品/],
  ['検索に足す行にノートブックの部品の参照', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t\tthis.addContext(this.rawMatch.results);', '+\t\t\tthis.addContext(this.rawMatch.results);\n+\t\t\tthis.notebookService = x;'), unit }), /足す行に、ノートブックの部品の参照|FileMatchImpl\.createMatches に足す/],
  ['検索の fileMatch に context の足し込みが無い', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t\tthis.addContext(this.rawMatch.results);', ''), unit }), /context の足し込み1行/],
  ['検索の textSearchSplitSyncAsync の呼び出しを消す', ({ patch, unit }) => ({ patch: sub(patch, /^ (\t\tconst textResult = this\.searchService\.textSearchSplitSyncAsync\()/m, '-$1'), unit }), /ripgrep のまま|消す行は/],
  ['検索の folderMatch が NotebookCompatibleFileMatch のまま', ({ patch, unit }) => ({ patch: sub(patch, /^\+(\t+)FileMatchImpl,$/m, '+$1NotebookCompatibleFileMatch,'), unit }), /folderMatch\.ts は/],
  ['検索の replaceService がテキストの保存を足さない', ({ patch, unit }) => ({ patch: sub(patch, /^\+\t\t\treturn this\.textFileService\.files\.get\(e\.resource\)\?\.save\(\{ source: ReplaceService\.REPLACE_SAVE_SOURCE \}\);$/m, ''), unit }), /replaceService\.ts は/],
  ['検索の searchWidget の定数が変わる', ({ patch, unit }) => ({ patch: sub(patch, 'markupInput: true', 'markupInput: false'), unit }), /searchWidget\.ts は/],
  ['検索の searchWidget が getNotebookFilters を消す', ({ patch, unit }) => ({ patch: sub(patch, /^ (\tgetNotebookFilters\(\) \{)$/m, '-$1'), unit }), /searchWidget\.ts は/],
  ['検索の searchView が置換のプレビューを消す', ({ patch, unit }) => ({ patch: sub(patch, /^ (\t\t\tthis\.replaceService\.openReplacePreview\(lineMatch, preserveFocus, sideBySide, pinned\) :)$/m, '-$1'), unit }), /searchView\.ts は|消す行は/],
  ['一括編集が実際に編集を当てる', ({ patch, unit }) => ({ patch: sub(patch, /^\+\t\tthrow new Error\(`Notebooks are not available in this build: [^\n]*$/m, '+\t\treturn [] as any;'), unit }), /BulkCellEdits\.apply\(\) は誤りを投げる/],
  ['checks から足した設定が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentSettings: unit.checks.absentSettings.filter((k) => k !== 'search.experimental.closedNotebookRichContentResults') } } }), /足した設定/],
  ['patch が absentStrings の文字列を足す', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t\tthis.addContext(this.rawMatch.results);', '+\t\t\tthis.addContext(this.rawMatch.results); // INotebookSearchService'), unit }), /absentStrings の文字列が現れない|足す行に、ノートブックの部品/],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './contrib/notebook/browser/nonexistent.js';" }] } }), /本家 1\.146\.0 のそのファイル/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/notebookNonexistent`] } }), /delete したパスが本家/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'nonexistent/zzz.js\'' }] } } }), /checks の項目が、本家/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export interface INotebookFileMatchNoModel' }] } } }), /checks の項目が、本家/, true],
  ['absentCommands に本家に無いコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands, 'workbench.action.nonexistent.zzz'] } } }), /checks の項目が、本家/, true],
  ['検索の addContext の根拠が本家に無い(定数の呼び出し先を変える)', ({ patch, unit }) => ({ patch: sub(patch, 'this.addContext(this.rawMatch.results);', 'this.addContextLines(this.rawMatch.results);'), unit }), /context の足し込み1行|addContext/, true],
];

const srcPatch = noSrc ? '' : readFileSync(join(SRC, 'edits.patch'), 'utf8');
for (const [name, mutate, expect, needsUp, needsText] of CASES) {
  const noText = needsText && !needsText.test(srcPatch) ? '実装にまだ該当の形が無い(蒙恬が足した後に走る)' : false;
  test(`c4-mutation: ${name} と c4-unit.test.mjs が落ちる`, { skip: noSrc || noText || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

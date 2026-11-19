// c2-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C2_UNIT_DIR でそこを指して c2-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C2_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c2-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-2-debug');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-2-debug の unit.json か edits.patch が無い';
import { UPSTREAM_REPO as UP_REPO_DEFAULT } from './build/root.mjs';
const upOk = existsSync(UP_REPO_DEFAULT) && spawnSync('git', ['-C', UP_REPO_DEFAULT, 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;

/** 写しを作って c2-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c2mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = JSON.parse(readFileSync(join(SRC, 'unit.json'), 'utf8').replace(/^﻿/, ''));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C2_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C2_NO_UPSTREAM; else env.AIED_C2_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c2-unit.test.mjs')], {
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

test('c2-mutation: 壊さない写しは c2-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 50, `c2-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

const dbg = 'src/vs/workbench/contrib/debug/';
// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-2-debug: edits', 'Subject: [PATCH] unit C-2-debug: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: sukuna-apply <apply@sukuna\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after に C-1 が入る(C-1 を前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: ['A-3-debug-extensions', 'C-1-ai'] } }), /after/],
  ['startDebugging が true で resolve する', ({ patch, unit }) => ({ patch: sub(patch, 'return Promise.resolve(false);', 'return Promise.resolve(true);'), unit }), /startDebugging/],
  ['stopDebugging が reject する', ({ patch, unit }) => ({ patch: sub(patch, /(stopDebugging\([^\n]*\{\r?\n\+\t\t\t)return Promise\.resolve\(\);/, '$1return Promise.reject(new Error("x"));'), unit }), /startDebugging|stopDebugging/],
  ['イベントが Event.None でなくなる', ({ patch, unit }) => ({ patch: sub(patch, 'onDidStartDebugSession: Event.None,', 'onDidStartDebugSession: new Emitter<void>().event,'), unit }), /イベント/],
  ['イベントのメンバーが欠ける', ({ patch, unit }) => ({ patch: sub(patch, 'onDidChangeBreakpoints: Event.None,', ''), unit }), /メンバー|イベント/],
  ['提案中の API の門が消える', ({ patch, unit }) => ({ patch: sub(patch, "checkProposedApiEnabled(extension, 'debugVisualization');", '', true), unit }), /門/],
  ['安定版の register に門が付く', ({ patch, unit }) => ({ patch: sub(patch, /(registerDebugConfigurationProvider\(_debugType[^\n]*\{\r?\n\+)(\t\t\treturn noopDisposable\(\);)/, "$1\t\t\tcheckProposedApiEnabled(extension, 'debugVisualization');\n+$2"), unit }), /register\*/],
  ['register が Disposable を返さない', ({ patch, unit }) => ({ patch: sub(patch, /(registerDebugAdapterTrackerFactory\([^\n]*\{\r?\n\+\t\t\t)return noopDisposable\(\);/, '$1return undefined as any;'), unit }), /register\*/],
  ['activeDebugConsole が undefined', ({ patch, unit }) => ({ patch: sub(patch, 'return noopDebugConsole;', 'return undefined as any;'), unit }), /activeDebugConsole/],
  ['breakpoints が空でない', ({ patch, unit }) => ({ patch: sub(patch, /(get breakpoints\(\) \{\r?\n\+\t\t\t)return \[\];/, "$1return [{ id: 'x' }] as any;"), unit }), /breakpoints/],
  ['通信を呼ぶ', ({ patch, unit }) => ({ patch: sub(patch, /(stopDebugging\([^\n]*\{\r?\n\+\t\t\t)return Promise\.resolve\(\);/, '$1return fetch("https://x.invalid").then(() => undefined);'), unit }), /通信/],
  ['asDebugSourceUri の誤りの文言が変わる', ({ patch, unit }) => ({ patch: sub(patch, "properties 'path' and 'sourceReference' are both missing", 'properties are missing'), unit }), /asDebugSourceUri/],
  ['asDebugSourceUri の ref の計算が変わる', ({ patch, unit }) => ({ patch: sub(patch, 'debug += `${sep}ref=${source.sourceReference}`;', 'debug += `${sep}reference=${source.sourceReference}`;'), unit }), /asDebugSourceUri/],
  ['新しいファイルが new file でなくなる', ({ patch, unit }) => ({ patch: sub(patch, 'new file mode 100644', 'old mode 100644'), unit }), /新しいファイル/],
  ['新しいファイルがもう1つ増える', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/src/vs/workbench/api/common/extHostRemovedApi.other.ts b/src/vs/workbench/api/common/extHostRemovedApi.other.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/api/common/extHostRemovedApi.other.ts\n@@ -0,0 +1 @@\n+export {};\n`), unit }), /新しいファイル/],
  ['workbench.common.main.ts の足す import が消える', ({ patch, unit }) => ({ patch: sub(patch, "+import './contrib/debug/browser/debug.service.contribution.js';", ''), unit }), /workbench\.\*\.main/],
  ['workbench.common.main.ts が足す行が2行になる', ({ patch, unit }) => ({ patch: sub(patch, "+import './contrib/debug/browser/debug.service.contribution.js';", "+import './contrib/debug/browser/debug.service.contribution.js';\n+import './contrib/debug/browser/other.js';"), unit }), /workbench\.\*\.main/],
  ['workbench.desktop.main.ts を patch が触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/workbench/workbench.desktop.main.ts', "-import './contrib/debug/electron-browser/extensionHostDebugService.js';\n+")), unit }), /workbench\.\*\.main|8つ/],
  ['extHost.api.impl.ts の変更が4か所目に増える', ({ patch, unit }) => ({ patch: sub(patch, "+import { createRemovedDebugApi } from './extHostRemovedApi.debug.js';", "+import { createRemovedDebugApi } from './extHostRemovedApi.debug.js';\n+import { Other } from './other.js';"), unit }), /extHost\.api\.impl\.ts の変更/],
  ['extHost.api.impl.ts が createRemovedDebugApi を呼ばない', ({ patch, unit }) => ({ patch: sub(patch, 'createRemovedDebugApi(extension);', '{} as any;'), unit }), /createRemovedDebugApi|extHost\.api\.impl\.ts の変更/],
  ['extHost.protocol.ts の Shape を消さずに ID だけ消す', ({ patch, unit }) => ({ patch: sub(patch, '-export interface ExtHostDebugServiceShape {', ' export interface ExtHostDebugServiceShape {'), unit }), /removeLines の各行|extHost\.protocol\.ts は削除だけ/],
  ['patch が removeLines と同じ行を二重に消す', ({ patch, unit }) => ({ patch: sub(patch, '-export type DebugSessionUUID = string;', "-export type DebugSessionUUID = string;\n-\tMainThreadDebugService: createProxyIdentifier<MainThreadDebugServiceShape>('MainThreadDebugService'),"), unit }), /二重/],
  ['C-1 の隣の行(REPL_VIEW_ID の import)が removeLines から消える', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.filter((r) => !/REPL_VIEW_ID/.test(r.line)) } }), /隣/],
  ['patch の文脈が C-1 の消す行に触れる', ({ patch, unit }) => ({ patch: sub(patch, "-import { IViewsService } from '../../../services/views/common/viewsService.js';", "-import { IViewsService } from '../../../services/views/common/viewsService.js';\n import { InlineChatController } from '../../inlineChat/browser/inlineChatController.js';"), unit }), /独立/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${dbg}browser/extensionHostDebugService.ts`] } }), /delete と kept/],
  ['delete に common の中のファイルが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${dbg}common/debugSchemas.ts`] } }), /common|delete と kept/],
  ['kept から extensionHostDebugService が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== `${dbg}electron-browser/extensionHostDebugService.ts`) } }), /kept に/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /重複/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './services/keep/keep.js';" }] } }), /removeLines の各行/],
  ['removeLines が extensionHostDebugService の import を消す', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.desktop.main.ts', line: "import './contrib/debug/electron-browser/extensionHostDebugService.js';" }] } }), /extensionHostDebugService/],
  ['removeLines が足す import を消す', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './contrib/debug/browser/debug.service.contribution.js';" }] } }), /debug\.service\.contribution/],
  ['debug.service.contribution.ts が元の DebugService を登録する', ({ patch, unit }) => ({ patch: sub(patch, '+registerSingleton(IDebugService, NullDebugService', '+registerSingleton(IDebugService, DebugService'), unit }), /Null/],
  ['delete したファイルを patch が直す', ({ patch, unit }) => ({ patch: append(patch, section(`${dbg}browser/repl.ts`, '-a\n+b')), unit }), /delete したファイルを直そう/],
  ['patch がファイルを消す', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${dbg}browser/debugIcons.ts b/${dbg}browser/debugIcons.ts\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/${dbg}browser/debugIcons.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n`), unit }), /消さない/],
  ['patch が足す行に absentStrings の文字列が現れる', ({ patch, unit }) => ({ patch: sub(patch, "+import './contrib/debug/browser/debug.service.contribution.js';", "+import './contrib/debug/browser/debug.service.contribution.js';\n+import './contrib/debug/browser/debug.contribution.js';"), unit }), /absentStrings の文字列が現れない/],
  ['notebook の設定の登録を消さない', ({ patch, unit }) => ({ patch: sub(patch, /-\t\t\[NotebookSetting\.notebookInlineValues\]: \{/, ' \t\t[NotebookSetting.notebookInlineValues]: {'), unit }), /notebook\.contribution\.ts は設定/],
  ['checks から足した設定が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentSettings: unit.checks.absentSettings.filter((k) => k !== 'notebook.inlineValues') } } }), /足した設定/],
  ['新しいファイルが delete の中のファイルを import する', ({ patch, unit }) => ({ patch: sub(patch, "+import { URI } from '../../../base/common/uri.js';", "+import { URI } from '../../../base/common/uri.js';\n+import { DebugSession } from '../../contrib/debug/browser/debugSession.js';"), unit }), /import が、delete/],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './contrib/debug/browser/nonexistent.js';" }] } }), /本家 1\.146\.0 のそのファイル/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${dbg}browser/nonexistent.ts`] } }), /delete したパスが本家/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'nonexistent/zzz.js\'' }] } } }), /本家 1\.146\.0 にある/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export class NullDebugService' }] } } }), /kept でないファイルに当たる/, true],
  ['absentCommands に本家に無いコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands, 'workbench.action.nonexistent.zzz'] } } }), /本家 1\.146\.0 にある/, true],
  ['Null のサービスの import 先が本家に無い', ({ patch, unit }) => ({ patch: sub(patch, "from '../common/nullDebugService.js';", "from '../common/nullDebugServices.js';"), unit }), /Null の実装で登録|import が/, false],
];

for (const [name, mutate, expect, needsUp] of CASES) {
  test(`c2-mutation: ${name} と c2-unit.test.mjs が落ちる`, { skip: noSrc || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

// c6-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C6_UNIT_DIR でそこを指して c6-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C6_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c6-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-6-settings-sync');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-6-settings-sync の unit.json か edits.patch が無い';
import { UPSTREAM_REPO as UP_REPO_DEFAULT } from './build/root.mjs';
const upOk = existsSync(UP_REPO_DEFAULT) && spawnSync('git', ['-C', UP_REPO_DEFAULT, 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const c1Lines = existsSync(join(REPO, 'removals', 'C-1-ai', 'unit.json')) ? readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json')).removeLines : [];

/** 写しを作って c6-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c6mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = readJson(join(SRC, 'unit.json'));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C6_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C6_NO_UPSTREAM; else env.AIED_C6_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c6-unit.test.mjs')], {
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
/** 消す行(-)を文脈の行( )に戻す(消し忘れた壊し方) */
const keepLine = (patch, re) => sub(patch, re, ' $1');

test('c6-mutation: 壊さない写しは c6-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 28, `c6-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-6-settings-sync: edits', 'Subject: [PATCH] unit C-6-settings-sync: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: shuko-apply <apply@shuko\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after に C-2 が入る(C-2 を前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: ['C-1-ai', 'C-2-debug'] } }), /after/],
  ['after から C-1 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: [] } }), /after/],
  ['order が C-1 より前', ({ patch, unit }) => ({ patch, unit: { ...unit, order: 10 } }), /after|order/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}services/userDataSync/browser/userDataSyncEnablementService.ts`] } }), /delete と kept/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /delete と kept に同じパスが無い/],
  ['delete に続きの編集が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/editSessions`] } }), /delete は2つ|delete もしない|続きの編集/],
  ['delete にプロファイルの部品が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}services/userDataProfile`] } }), /delete は2つ|delete もしない/],
  ['delete に設定の画面が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/preferences/browser/settingsEditor2.ts`] } }), /delete は2つ|delete もしない|edits\.patch が触る|delete したファイルも直さない/],
  ['delete から workbench のサービスが消える', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: unit.delete.filter((d) => !/userDataSyncWorkbenchService\.ts$/.test(d)) } }), /delete は2つ|removeLines/],
  ['kept から platform/userDataSync が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/platform/userDataSync') } }), /kept に/],
  ['kept からアカウントのメニューが消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== `${W}services/accounts`) } }), /kept に/],
  ['kept の理由が空', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.map((k) => (k.path === 'src/vs/platform/userDataSync' ? { ...k, reason: '' } : k)) } }), /kept に/],
  ['kept に続きの編集が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: [...unit.kept, { path: `${W}contrib/editSessions`, reason: '続きの編集は残す(テストのための記述)' }] } }), /続きの編集\(contrib\/editSessions\)に触れない/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/keep/keep.js';" }] } }), /removeLines は common 2/],
  ['removeLines の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, unit.removeLines[0]] } }), /removeLines は common 2/],
  ['removeLines の行が足りない', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.slice(1) } }), /removeLines は common 2/],
  ['removeLines が web の main に触れる', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.web.main.ts`, line: "import './contrib/userDataSync/browser/userDataSync.contribution.js';" }] } }), /removeLines は common 2/],
  ['removeLines が sessions の main に触れる(C-1 の分)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/sessions/sessions.common.main.ts', line: "import '../workbench/services/userDataSync/browser/userDataSyncWorkbenchService.js';" }] } }), /removeLines は common 2/],
  ['removeLines が C-1 の removeLines と同じ行を消す(二重)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, c1Lines[0]] } }), /二重|removeLines は common 2/],
  ['productRemove が空でない', ({ patch, unit }) => ({ patch, unit: { ...unit, productRemove: ['x'] } }), /productRemove は空/],
  ['依存を消す', ({ patch, unit }) => ({ patch, unit: { ...unit, removeDependencies: { x: ['y'] } } }), /productRemove は空/],
  ['patch が main のファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}workbench.desktop.main.ts`, "-import './a.js';\n+")), unit }), /触るファイルは|触れない/],
  ['patch が続きの編集を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/editSessions/browser/editSessions.contribution.ts`, '-a\n+b')), unit }), /触るファイルは|触れない|続きの編集に触れない/],
  ['patch が更新の部品(update.ts)を触る(判断は直さない)', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/update/browser/update.ts`, '-a\n+b')), unit }), /触るファイルは|触れない|update\.ts/],
  ['patch がプロファイルの部品を触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}services/userDataProfile/browser/settingsResource.ts`, '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が platform/userDataSync を触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/platform/userDataSync/common/userDataSync.ts', '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が新しいファイルを増やす', ({ patch, unit }) => ({ patch: append(patch, 'diff --git a/src/vs/workbench/contrib/preferences/browser/other.ts b/src/vs/workbench/contrib/preferences/browser/other.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/contrib/preferences/browser/other.ts\n@@ -0,0 +1 @@\n+export {};\n'), unit }), /触るファイルは/],
  ['patch がファイルを消す', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${W}contrib/preferences/browser/settingsTree.ts b/${W}contrib/preferences/browser/settingsTree.ts\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/${W}contrib/preferences/browser/settingsTree.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n`), unit }), /触るファイルは|ファイルは消さない|消さない/],
  ['patch が delete したファイルを直す', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/userDataSync/browser/userDataSync.ts`, '-a\n+b')), unit }), /触るファイルは|触れない|delete したファイルも直さない/],
  ['patch が設定の画面の検索を消す', ({ patch, unit }) => ({ patch: sub(patch, "-import { fromNow } from '../../../../base/common/date.js';", "-import { fromNow } from '../../../../base/common/date.js';\n-\t\t\tconst searchWidget = this._register(new SearchWidget());"), unit }), /設定の画面|protect|消す/],
  ['設定の画面に SyncControls が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(class SyncControls extends Disposable \{)/m), unit }), /設定の画面/],
  ['設定の画面に注入が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\t@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,)/m), unit }), /設定の画面/],
  ['設定の画面に同期の部品を作る分岐が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\tif \(this\.userDataSyncWorkbenchService\.enabled && this\.userDataSyncEnablementService\.canToggleEnablement\(\)\) \{)/m), unit }), /設定の画面/],
  ['設定の画面に lastSyncedLabel が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\tprivate lastSyncedLabel: string \| null = null;)/m), unit }), /設定の画面/],
  ['設定の画面が同期の import を足す', ({ patch, unit }) => ({ patch: sub(patch, "+import { Event } from '../../../../base/common/event.js';", "+import { Event } from '../../../../base/common/event.js';\n+import { IUserDataSyncWorkbenchService } from '../../../services/userDataSync/common/userDataSync.js';"), unit }), /設定の画面|absentStrings の文字列が現れない/],
  ['設定の画面に SyncControls の語を足す', ({ patch, unit }) => ({ patch: sub(patch, "+import { Event } from '../../../../base/common/event.js';", "+import { Event } from '../../../../base/common/event.js'; // SyncControls"), unit }), /absentStrings の文字列が現れない|設定の画面/],
  ['CSS の規則が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\topacity: 0\.9;)/m), unit }), /設定の画面/],
  ['再起動の部品に onDidTurnOnSync が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\tthis\._register\(userDataSyncWorkbenchService\.onDidTurnOnSync\(e => this\.update\(true\)\)\);)/m), unit }), /再起動の部品/],
  ['再起動の部品に注入が残る(消し忘れ)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\t@IUserDataSyncWorkbenchService userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,)/m), unit }), /再起動の部品/],
  ['再起動の部品の @IUserDataSyncService の注入を消してしまう', ({ patch, unit }) => ({ patch: sub(patch, /^ (\t\t@IUserDataSyncService private readonly userDataSyncService: IUserDataSyncService,)$/m, '-$1'), unit }), /再起動の部品/],
  ['再起動のテストが引数を減らさない', ({ patch, unit }) => ({ patch: sub(patch, 'new SettingsChangeRelauncher(hostService, configurationService, userDataSyncService, userDataSyncEnablementService, productService, dialogService)', 'new SettingsChangeRelauncher(hostService, configurationService, userDataSyncService, userDataSyncEnablementService, userDataSyncWorkbenchService, productService, dialogService)'), unit }), /再起動の部品/],
  ['checks のコマンドが減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: unit.checks.absentCommands.slice(1) } } }), /checks は absentCommands 2つ/, true],
  ['checks にビューが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentViews: ['workbench.view.sync'] } } }), /checks は absentCommands 2つ/, true],
  ['checks の文字列が減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: unit.checks.absentStrings.slice(1) } } }), /checks は absentCommands 2つ/, true],
  ['smoke から claude-code が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, smoke: ['base', 'absence'] } }), /smoke に claude-code/],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './contrib/userDataSync/browser/nonexistent.js';" }] } }), /本家 1\.146\.0 のそのファイル|removeLines は common 2/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/userDataSync/nonexistentThing`] } }), /delete したパスが本家|delete は2つ/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: "nonexistent/zzz.js'" }] } } }), /checks の項目が本家/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export const DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR' }] } } }), /checks の項目が本家/, true],
  ['absentCommands に本家に無いコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands, 'workbench.userDataSync.actions.nonexistent.zzz'] } } }), /checks は absentCommands 2つ|checks の項目が本家/, true],
  ['absentCommands に delete の外にも登録があるコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [unit.checks.absentCommands[0], 'workbench.action.openSettings'] } } }), /checks は absentCommands 2つ/, true],
  ['kept のパスが本家に無い', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: [...unit.kept, { path: `${W}services/userDataSync/common/nonexistent.ts`, reason: 'テストのための嘘のパス' }] } }), /delete したパスが本家/, true],
  // 型検査に掛からない注入の外し損ね(本家の注入する所を、edits.patch の後に残す)
  ['設定の画面の注入が残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\t@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,)/m), unit }), /注入: 消したサービスの ID を使う所|設定の画面/, true],
  ['再起動の部品の注入が残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(import \{ IUserDataSyncWorkbenchService \} from '\.\.\/\.\.\/\.\.\/services\/userDataSync\/common\/userDataSync\.js';)\r?\n(?=[^\n]*\n[^\n]*\n[^\n]*\n-?[^\n]*\n[^\n]*onDidTurn|)/m), unit }), /注入: 消したサービスの ID を使う所|再起動の部品/, true],
  ['再起動のテストの stub が残る(本家と突き合わせた注入の検査)', ({ patch, unit }) => ({ patch: keepLine(patch, /^-(\t\tconst userDataSyncWorkbenchService = \{ onDidTurnOnSync: Event\.None \} as Partial<IUserDataSyncWorkbenchService> as IUserDataSyncWorkbenchService;)/m), unit }), /注入: 消したサービスの ID を使う所|再起動の部品/, true],
];

for (const [name, mutate, expect, needsUp] of CASES) {
  test(`c6-mutation: ${name} と c6-unit.test.mjs が落ちる`, { skip: noSrc || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

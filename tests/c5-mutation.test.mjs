// c5-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C5_UNIT_DIR でそこを指して c5-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C5_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c5-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-5-extension-gallery');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-5-extension-gallery の unit.json か edits.patch が無い';
const upOk = existsSync(process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode') && spawnSync('git', ['-C', process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode', 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const c3Lines = existsSync(join(REPO, 'removals', 'C-3-remote', 'unit.json')) ? readJson(join(REPO, 'removals', 'C-3-remote', 'unit.json')).removeLines : [];

/** 写しを作って c5-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c5mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = readJson(join(SRC, 'unit.json'));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C5_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C5_NO_UPSTREAM; else env.AIED_C5_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c5-unit.test.mjs')], {
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

test('c5-mutation: 壊さない写しは c5-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 40, `c5-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-5-extension-gallery: edits', 'Subject: [PATCH] unit C-5-extension-gallery: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: shuko-apply <apply@shuko\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after に C-2 が入る(C-2 を前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: ['C-1-ai', 'C-2-debug'] } }), /after/],
  ['after から C-1 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: [] } }), /after/],
  ['order が C-1 より前', ({ patch, unit }) => ({ patch, unit: { ...unit, order: 10 } }), /after|order/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`] } }), /delete と kept/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /delete と kept に同じパスが無い/],
  ['kept からマニフェストのサービスが消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => !/electron-browser\/extensionGalleryManifestService\.ts$/.test(k.path)) } }), /kept にワークベンチのマニフェスト/],
  ['kept から platform のギャラリーの基底が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/platform/extensionManagement/common/extensionGalleryService.ts') } }), /kept にワークベンチのマニフェスト|CLI/],
  ['kept の理由が空', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.map((k) => (k.path === 'src/vs/platform/extensionRecommendations' ? { ...k, reason: '' } : k)) } }), /kept にワークベンチのマニフェスト/],
  ['delete から tips が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: unit.delete.filter((d) => d !== 'src/vs/platform/extensionManagement/node/extensionTipsService.ts') } }), /kept にワークベンチのマニフェスト|delete は20/],
  ['delete が C-4 の delete と重なる', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/notebook/browser`] } }), /delete と kept|重ならない|delete は20/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/keep/keep.js';" }] } }), /removeLines の各行|8行/],
  ['removeLines の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, unit.removeLines[0]] } }), /8行|重複/],
  ['removeLines の行が足りない', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.filter((r) => !/registerChannel\('extensionTipsService'/.test(r.line)) } }), /8行/],
  ['removeLines が web の main に触れる', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.web.main.ts`, line: "import '../platform/extensionManagement/common/extensionTipsService.js';" }] } }), /8行|web の main/],
  ['removeLines が C-3 の removeLines と同じ行を消す(二重)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, c3Lines.find((r) => /sharedProcessMain/.test(r.file))] } }), /二重/],
  ['patch が main のファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}workbench.desktop.main.ts`, "-import './a.js';\n+")), unit }), /触るファイルは|触れない/],
  ['patch が cliProcessMain.ts を触る(CLI の道)', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/code/node/cliProcessMain.ts', '-a\n+b')), unit }), /触るファイルは|触れない|CLI/],
  ['patch が platform/extensionManagement を触る(CLI の道)', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/platform/extensionManagement/common/extensionGalleryService.ts', '-a\n+b')), unit }), /触るファイルは|触れない|CLI/],
  ['patch が新しいファイルを増やす', ({ patch, unit }) => ({ patch: append(patch, 'diff --git a/src/vs/workbench/services/extensionManagement/common/other.ts b/src/vs/workbench/services/extensionManagement/common/other.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/services/extensionManagement/common/other.ts\n@@ -0,0 +1 @@\n+export {};\n'), unit }), /触るファイルは/],
  ['patch がファイルを消す', ({ patch, unit }) => ({ patch: append(patch, `diff --git a/${W}contrib/extensions/browser/extensionsIcons.ts b/${W}contrib/extensions/browser/extensionsIcons.ts\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/${W}contrib/extensions/browser/extensionsIcons.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n`), unit }), /触るファイルは|ファイルは消さない/],
  ['patch が delete したファイルを直す', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/extensions/browser/extensionRecommendationsService.ts`, '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が C-4 の edits.patch と同じファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section(`${W}contrib/search/browser/searchView.ts`, '-a\n+b')), unit }), /触るファイルは|独立/],
  ['sharedProcessMain.ts のハンクが増える', ({ patch, unit }) => ({ patch: sub(patch, "+import { ExtensionManagementChannel } from '../../../platform/extensionManagement/common/extensionManagementIpc.js';", "+import { ExtensionManagementChannel } from '../../../platform/extensionManagement/common/extensionManagementIpc.js';\n+import { X } from './x.js';"), unit }), /sharedProcessMain\.ts のハンク/],
  ['sharedProcessMain.ts が tips の名前を残す', ({ patch, unit }) => ({ patch: sub(patch, /^\+import \{ ExtensionManagementChannel \}/m, '+import { ExtensionManagementChannel, ExtensionTipsChannel }'), unit }), /sharedProcessMain\.ts のハンク/],
  ['delete に CLI の道のファイルが入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/code/node/cliProcessMain.ts'] } }), /CLI/],
  ['removeLines が CLI の道のファイルに触れる', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/platform/extensionManagement/common/extensionManagementCLI.ts', line: "import './a.js';" }] } }), /CLI|8行/],
  ['ワークベンチのギャラリーが有効になる', ({ patch, unit }) => ({ patch: sub(patch, /(isEnabled\(\): boolean \{\r?\n\+\t\t)return false;/, '$1return true;'), unit }), /isEnabled は false|isEnabled が偽/],
  ['ギャラリーが通信する(fetch)', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t// nothing is reported', '+\t\tfetch("https://x.invalid");'), unit }), /通信しない|通信の口/],
  ['ギャラリーが要求のサービスを注入する', ({ patch, unit }) => ({ patch: sub(patch, '+\tdeclare readonly _serviceBrand: undefined;', '+\tdeclare readonly _serviceBrand: undefined;\n+\tconstructor(@IRequestService private readonly requestService: IRequestService) { }'), unit }), /通信しない/],
  ['getExtensions が誤りを投げる', ({ patch, unit }) => ({ patch: sub(patch, /(async getExtensions\(\): Promise<IGalleryExtension\[\]> \{\r?\n\+\t\t)return \[\];/, '$1throw new Error("x");'), unit }), /getExtensions は \[\] で解決/],
  ['download が resolve する', ({ patch, unit }) => ({ patch: sub(patch, /(async download\([^\n]*\{\r?\n\+\t\t)throw new Error\(galleryUnavailable\);/, '$1return;'), unit }), /download・getReadme・getChangelog は reject|isEnabled は false/],
  ['ギャラリーの登録が元の WorkbenchExtensionGalleryService に戻る', ({ patch, unit }) => ({ patch: sub(patch, '+registerSingleton(IExtensionGalleryService, NoopExtensionGalleryService, InstantiationType.Delayed);', '+registerSingleton(IExtensionGalleryService, WorkbenchExtensionGalleryService, InstantiationType.Delayed);'), unit }), /ギャラリーの登録は NoopExtensionGalleryService/],
  ['ギャラリーのメンバーが欠ける', ({ patch, unit }) => ({ patch: sub(patch, 'async getChangelog(extension', 'async getChangelogX(extension'), unit }), /interface のメンバーが全部|reject する/],
  ['おすすめが空でない', ({ patch, unit }) => ({ patch: sub(patch, /(getAllRecommendationsWithReason\(\)[^\n]*\{\r?\n\+\t\t)return \{\};/, "$1return { 'a.b': {} } as any;"), unit }), /おすすめの3つのサービス|おすすめ —/],
  ['通知が無視しない', ({ patch, unit }) => ({ patch: sub(patch, /(hasToIgnoreRecommendationNotifications\(\): boolean \{\r?\n\+\t\t)return true;/, '$1return false;'), unit }), /おすすめの3つのサービス|無視されたおすすめ/],
  ['通知が受け入れる', ({ patch, unit }) => ({ patch: sub(patch, 'RecommendationsNotificationResult.Ignored', 'RecommendationsNotificationResult.Accepted'), unit }), /おすすめの3つのサービス|無視されたおすすめ/],
  ['おすすめの登録が Null でない', ({ patch, unit }) => ({ patch: sub(patch, 'NullExtensionRecommendationsService, InstantiationType', 'ExtensionRecommendationsService, InstantiationType'), unit }), /3つの Null を registerSingleton/],
  ['tips の通知のチャンネルの登録が残る', ({ patch, unit }) => ({ patch: sub(patch, /^-(\t\tsharedProcessService\.registerChannel\('extensionRecommendationNotification')/m, ' $1'), unit }), /3つの Null を registerSingleton/],
  ['おすすめが保存を注入する', ({ patch, unit }) => ({ patch: sub(patch, '+export class NullExtensionIgnoredRecommendationsService implements IExtensionIgnoredRecommendationsService {', '+export class NullExtensionIgnoredRecommendationsService implements IExtensionIgnoredRecommendationsService {\n+\tconstructor(@IStorageService s: IStorageService) { }'), unit }), /通信も保存も持たない/],
  ['マニフェストのサービスがアカウントを残す', ({ patch, unit }) => ({ patch: sub(patch, '+\t\tconst defaultExtensionGalleryManifest = await super.getExtensionGalleryManifest();', '+\t\tconst defaultExtensionGalleryManifest = await super.getExtensionGalleryManifest();\n+\t\tconst a = this.galleryAccountService; // IExtensionGalleryAccountService'), unit }), /マニフェストのサービスは/],
  ['右クリックのメニューが残る', ({ patch, unit }) => ({ patch: sub(patch, /^-(\t\t\t\tid: MenuId\.ExplorerContext,)/m, ' $1'), unit }), /右クリックのメニュー/],
  ['installFromVSIX の登録が消える', ({ patch, unit }) => ({ patch: sub(patch, /^ (\t\t\tid: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,)$/m, '-$1'), unit }), /右クリックのメニュー/],
  ['ドロップが残る', ({ patch, unit }) => ({ patch: sub(patch, /^-(\t\tthis\._register\(new DragAndDropObserver\(this\.root, \{)/m, ' $1'), unit }), /ドロップ/],
  ['ドロップの導入の呼び出しが残る', ({ patch, unit }) => ({ patch: sub(patch, /^\+(\/\/ Shuko \(C-5-extension-gallery\): the Marketplace access badge)/m, '+\t\tvoid INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID; DragAndDropObserver;\n+$1'), unit }), /ドロップ/],
  ['ext install の Quick Access が残る', ({ patch, unit }) => ({ patch: sub(patch, /^-(\tstatic PREFIX = 'ext install ';)/m, ' $1'), unit }), /Quick Access を外す/],
  ['`ext ` の Quick Access が消える', ({ patch, unit }) => ({ patch: sub(patch, /^ (export class ManageExtensionsQuickAccessProvider)/m, '-$1'), unit }), /Quick Access を外す/],
  ['popular のコマンドが残る', ({ patch, unit }) => ({ patch: sub(patch, "-\t\t\tid: 'workbench.extensions.action.showPopularExtensions',", " \t\t\tid: 'workbench.extensions.action.showPopularExtensions',"), unit }), /ビューとコマンドを外す/],
  ['動作中の拡張のコマンドを消す', ({ patch, unit }) => ({ patch: sub(patch, "-\t\t\tid: 'workbench.extensions.action.showPopularExtensions',", "-\t\t\tid: 'workbench.extensions.action.showPopularExtensions',\n-\t\t\tid: 'workbench.extensions.action.showRuntimeExtensions',"), unit }), /ビューとコマンドを外す/],
  ['checks のコマンドが減る', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: unit.checks.absentCommands.slice(1) } } }), /checks の数/],
  ['checks に残すコマンド installFromVSIX を入れる', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands.slice(1), 'workbench.extensions.command.installFromVSIX'] } } }), /checks の数/],
  ['checks から画面の導入の文字列が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: unit.checks.absentStrings.filter((s) => s.text !== "'ext install '") } } }), /checks の数/],
  ['patch が absentStrings の文字列を足す', ({ patch, unit }) => ({ patch: sub(patch, 'the `ext install ` quick access (install or search the gallery) is removed.', "the 'ext install ' quick access (install or search the gallery) is removed."), unit }), /absentStrings の文字列が現れない/],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: `${W}workbench.common.main.ts`, line: "import './services/extensionRecommendations/common/nonexistent.js';" }] } }), /本家 1\.146\.0 のそのファイル/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, `${W}contrib/extensions/browser/nonexistentRecommendations.ts`] } }), /delete したパスが本家/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'nonexistent/zzz.js\'' }] } } }), /checks の項目が、本家/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export interface IExtensionRecommendationsService' }] } } }), /checks の項目が、本家/, true],
  ['absentCommands に本家に無いコマンド', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentCommands: [...unit.checks.absentCommands, 'workbench.extensions.action.nonexistent.zzz'] } } }), /checks の項目が、本家|checks の数/, true],
  ['kept のパスが本家に無い', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: [...unit.kept, { path: `${W}services/extensionRecommendations/common/nonexistent.ts`, reason: 'テストのための嘘のパス' }] } }), /delete したパスが本家/, true],
];

for (const [name, mutate, expect, needsUp] of CASES) {
  test(`c5-mutation: ${name} と c5-unit.test.mjs が落ちる`, { skip: noSrc || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

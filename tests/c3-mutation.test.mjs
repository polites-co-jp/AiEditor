// c3-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C3_UNIT_DIR でそこを指して c3-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// 本家(C:/b/vscode)を要さない壊し方は AIED_C3_NO_UPSTREAM=1 で速く走らせる。本家を要する壊し方(needsUp)は、本家が読めるときだけ走らせる。
// Run: node --test tests/c3-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-3-remote');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-3-remote の unit.json か edits.patch が無い';
const upOk = existsSync(process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode') && spawnSync('git', ['-C', process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode', 'rev-parse', '--verify', `${process.env.AIED_UPSTREAM_TAG || '1.146.0'}^{commit}`]).status === 0;
const c1Lines = existsSync(join(REPO, 'removals', 'C-1-ai', 'unit.json')) ? JSON.parse(readFileSync(join(REPO, 'removals', 'C-1-ai', 'unit.json'), 'utf8').replace(/^﻿/, '')).removeLines : [];

/** 写しを作って c3-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate, { withUp = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'c3mut-'));
  try {
    if (existsSync(join(SRC, 'README.md'))) copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = JSON.parse(readFileSync(join(SRC, 'unit.json'), 'utf8').replace(/^﻿/, ''));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C3_UNIT_DIR: dir };
    if (withUp) delete env.AIED_C3_NO_UPSTREAM; else env.AIED_C3_NO_UPSTREAM = '1';
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c3-unit.test.mjs')], {
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
const VIEWS = 'src/vs/workbench/api/browser/viewsExtensionPoint.ts';
const IMPORT = "import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';";

test('c3-mutation: 壊さない写しは c3-unit.test.mjs が全部通る(対照。本家を読む検査も含む)', { skip: noSrc }, () => {
  const r = run(null, { withUp: upOk });
  assert.ok(r.count >= 25, `c3-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

// [名前, 壊し方, 落ちるはずのテスト名, 本家を要するか]
const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-3-remote: edits', 'Subject: [PATCH] unit C-3-remote: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: shuko-apply <apply@shuko\.invalid>/m, 'From: someone <a@b.invalid>'), unit }), /作者/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  ['after から C-1 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: ['A-5-remote-extensions'] } }), /after/],
  ['after から A-5 が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, after: ['C-1-ai'] } }), /after/],
  ['after に C-2 が入る(C-2 を前提にしてしまう)', ({ patch, unit }) => ({ patch, unit: { ...unit, after: [...unit.after, 'C-2-debug'] } }), /after/],
  ['order が C-1 より前', ({ patch, unit }) => ({ patch, unit: { ...unit, order: 10 } }), /order|after/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/workbench/services/tunnel'] } }), /delete と kept/],
  ['delete に platform/remote の中が入る', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/platform/remote/common/remoteAgentService.ts'] } }), /delete と kept|delete は/],
  ['delete の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, unit.delete[0]] } }), /重複/],
  ['kept から services/tunnel が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/workbench/services/tunnel') } }), /kept に/],
  ['kept から platform/tunnel が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => k.path !== 'src/vs/platform/tunnel') } }), /kept に/],
  ['kept の理由が空', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.map((k) => (k.path === 'src/vs/platform/remote' ? { ...k, reason: '' } : k)) } }), /kept に/],
  ['delete が他の単位の delete と重なる', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/workbench/contrib/debug/browser/repl.ts'] } }), /重ならない|delete は/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './services/keep/keep.js';" }] } }), /removeLines の各行/],
  ['removeLines が残す部品の登録を消す', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.desktop.main.ts', line: "import './services/tunnel/electron-browser/tunnelService.js';" }] } }), /残す部品/],
  ['removeLines の重複', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, unit.removeLines[0]] } }), /重複/],
  ['removeLines の行が足りない(sharedProcessMain.ts の1行)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: unit.removeLines.filter((r) => !/registerChannel\('remoteTunnel'/.test(r.line)) } }), /sharedProcessMain\.ts 7|removeLines の各行/],
  ['removeLines の file が delete の中', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/contrib/remote/browser/remote.ts', line: "import './a.js';" }] } }), /delete の中ではない|removeLines の各行/],
  ['removeLines が C-1 の removeLines と同じ行を消す(二重)', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, c1Lines[0]] } }), /二重/],
  ['productRemove のキーが欠ける', ({ patch, unit }) => ({ patch, unit: { ...unit, productRemove: unit.productRemove.slice(1) } }), /productRemove の9つ/],
  ['patch がほかのファイルにも触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/workbench/api/common/extHost.protocol.ts', '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が main のファイルを触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/workbench/workbench.desktop.main.ts', "-import './a.js';\n+")), unit }), /触るファイルは|触れない/],
  ['patch が sharedProcessMain.ts を触る', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts', '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['patch が新しいファイルを作る', ({ patch, unit }) => ({ patch: append(patch, 'diff --git a/src/vs/workbench/api/common/extHostRemovedApi.remote.ts b/src/vs/workbench/api/common/extHostRemovedApi.remote.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/api/common/extHostRemovedApi.remote.ts\n@@ -0,0 +1 @@\n+export {};\n'), unit }), /触るファイルは/],
  ['patch が delete したファイルを直す', ({ patch, unit }) => ({ patch: append(patch, section('src/vs/workbench/contrib/remote/browser/remoteExplorer.ts', '-a\n+b')), unit }), /触るファイルは|触れない/],
  ['定数が無い', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", ''), unit }), /直しは/],
  ['定数が2つある', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", "+const REMOTE = 'workbench.view.remote';\n+const REMOTE = 'workbench.view.remote';"), unit }), /直しは/],
  ['消す import が残る(文脈になる)', ({ patch, unit }) => ({ patch: sub(patch, `-${IMPORT}`, ` ${IMPORT}`), unit }), /直しは/],
  ['定数のほかのコードを足す', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", "+const REMOTE = 'workbench.view.remote';\n+const OTHER = 1;"), unit }), /直しは/],
  ['patch が contrib/remote の import を足す', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", "+const REMOTE = 'workbench.view.remote';\n+import { X } from '../../contrib/remote/browser/x.js';"), unit }), /contrib\/remote\/ が無い|直しは/],
  ['patch が absentStrings の文字列を足す', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", "+const REMOTE = 'workbench.view.remote';\n+// remote/browser/remoteExplorer.js' stays"), unit }), /contrib\/remote\/ が無い/],
  ['ほかの単位の edits.patch が触るファイルに触る', ({ patch, unit }) => ({ patch: sub(patch, VIEWS, 'src/vs/workbench/api/common/extHost.api.impl.ts', true), unit }), /ほかの単位の edits\.patch が触らない|触るファイルは/],
  ['checks の項目が欠ける', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: unit.checks.absentStrings.slice(1) } } }), /README の項目/],
  ['smoke から claude-code が消える', ({ patch, unit }) => ({ patch, unit: { ...unit, smoke: ['base', 'absence'] } }), /smoke/],
  // 本家(C:/b/vscode の 1.146.0)を読む壊し方
  ['定数の値が本家の VIEWLET_ID と違う', ({ patch, unit }) => ({ patch: sub(patch, "+const REMOTE = 'workbench.view.remote';", "+const REMOTE = 'workbench.view.remote2';"), unit }), /定数の値|VIEWLET_ID/, true],
  ['removeLines に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './contrib/remote/browser/nonexistent.js';" }] } }), /本家 1\.146\.0 のそのファイル/, true],
  ['delete に本家に無いパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/workbench/contrib/remoteNonexistent'] } }), /delete したパスが本家/, true],
  ['productRemove に本家の product.json に無いキー', ({ patch, unit }) => ({ patch, unit: { ...unit, productRemove: [...unit.productRemove.slice(1), 'nonexistentKeyZzz'] } }), /product\.json の最上位/, true],
  ['absentStrings に本家に無い文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'nonexistent/zzz.js\'' }] } } }), /checks の項目が、本家/, true],
  ['absentStrings が kept にしか当たらない文字列', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentStrings: [...unit.checks.absentStrings, { in: ['src/vs'], text: 'export interface IRemoteExplorerService' }] } } }), /kept でないファイルに当たる/, true],
  ['absentSettings に本家に無い設定', ({ patch, unit }) => ({ patch, unit: { ...unit, checks: { ...unit.checks, absentSettings: [...unit.checks.absentSettings, 'remote.nonexistent.zzz'] } } }), /checks の項目が、本家/, true],
];

for (const [name, mutate, expect, needsUp] of CASES) {
  test(`c3-mutation: ${name} と c3-unit.test.mjs が落ちる`, { skip: noSrc || (needsUp && !upOk ? '本家のソースが読めない' : false) }, () => {
    const r = run(mutate, { withUp: !!needsUp });
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}

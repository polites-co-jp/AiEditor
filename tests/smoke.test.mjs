// tests/smoke/ の台本の部品の単体テスト（エディタは起動しない）。
// 仕様: docs/06 の5節、docs/07 の3.2 の1（起動の注意）、brief tasks/2026-11-13-p1-smoke/brief.md の「守ること」。
// 実行: node --test tests/smoke.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import {
  assertSafeWritePath, classifyLog, cleanEditorEnv, dailyDataPaths, errorKeys, extractChromiumErrors, extractErrors, lockBelongsTo,
  newErrors, newLocks, normalizeError, readLock, resolveEditor, snapshotLocks, treeFromProcesses, collectLogErrors, findRunRoots, parseLogTime, splitByCutoff, isRunDirPath, rootMatches, selectPrune, listProcesses, removeOwnLocks,
} from './smoke/lib/common.mjs';
import { buildUserSettings, defaultExtensionIds, findVsix, fingerprint, formatArgv, readLedger } from './smoke/lib/env.mjs';
import { COMPLETION_POSITIONS, EXPECTED_CHANGES, createWorkspace, diffFixtures, fixtureFiles, minimalPdf } from './smoke/lib/fixtures.mjs';
import {
  KEEP_MARK, sameProc, countStatuses, dailyArgvChanged, exitCodeFor, findRg, formatMarkdown, groupErrors, historyHas, mergeBaseline, parseArgs, pruneRuns, uniqueErrors,
} from './smoke/lib/run.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'smoke-test-'));

// ---- 環境変数（docs/07 の3.2 の1）------------------------------------------
test('cleanEditorEnv: ELECTRON_RUN_AS_NODE・ELECTRON_NO_ATTACH_CONSOLE・VSCODE_* を外し、VSCODE_PORTABLE だけを足す', () => {
  const src = {
    PATH: 'C:\\x', ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ATTACH_CONSOLE: '1',
    VSCODE_PID: '12', VSCODE_IPC_HOOK: 'h', VSCODE_PORTABLE: 'C:\\daily', HOME: 'C:\\h',
  };
  const out = cleanEditorEnv(src, 'C:\\b\\smoke\\runs\\a\\user');
  assert.equal(out.PATH, 'C:\\x');
  assert.equal(out.HOME, 'C:\\h');
  assert.equal(out.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(out.ELECTRON_NO_ATTACH_CONSOLE, undefined);
  assert.equal(out.VSCODE_PID, undefined);
  assert.equal(out.VSCODE_IPC_HOOK, undefined);
  assert.equal(out.VSCODE_PORTABLE, 'C:\\b\\smoke\\runs\\a\\user'); // 親の値ではなく、渡した値
  assert.equal(src.ELECTRON_RUN_AS_NODE, '1'); // 元は変えない
});

test('cleanEditorEnv: Windows の環境変数名は大文字小文字を区別しない', () => {
  const out = cleanEditorEnv({ electron_run_as_node: '1', Vscode_Foo: 'x', Path: 'p' }, 'C:\\p');
  assert.equal(out.electron_run_as_node, undefined);
  assert.equal(out.Vscode_Foo, undefined);
  assert.equal(out.Path, 'p');
});

test('cleanEditorEnv: Claude Code が入れる IDE 連携の変数も、試す相手に漏らさない', () => {
  const out = cleanEditorEnv({ CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_SSE_PORT: '1234', ANTHROPIC_FOO: 'keep' }, 'C:\\p');
  assert.equal(out.CLAUDECODE, undefined);
  assert.equal(out.CLAUDE_CODE_ENTRYPOINT, undefined);
  assert.equal(out.CLAUDE_CODE_SSE_PORT, undefined);
  assert.equal(out.ANTHROPIC_FOO, 'keep');
});

test('cleanEditorEnv: extra は最後に効く（ELECTRON_RUN_AS_NODE=1 をインストール用の CLI にだけ渡せる）', () => {
  const out = cleanEditorEnv({ ELECTRON_RUN_AS_NODE: '0' }, 'C:\\p', { ELECTRON_RUN_AS_NODE: '1', AIED_SMOKE_CONFIG: 'c.json' });
  assert.equal(out.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(out.AIED_SMOKE_CONFIG, 'c.json');
});

// ---- 書き込み先の安全（普段使いのデータに触れない）-------------------------
test('assertSafeWritePath: ルートの下は通る', () => {
  assert.equal(assertSafeWritePath('C:\\b\\smoke\\runs\\a', 'C:\\b\\smoke', {}, 'C:\\Users\\u'), 'C:\\b\\smoke\\runs\\a');
});

test('assertSafeWritePath: ルートの外・ルートそのもの・上に抜ける形は通らない', () => {
  const h = 'C:\\Users\\u';
  assert.throws(() => assertSafeWritePath('C:\\other\\x', 'C:\\b\\smoke', {}, h));
  assert.throws(() => assertSafeWritePath('C:\\b\\smoke', 'C:\\b\\smoke', {}, h));
  assert.throws(() => assertSafeWritePath('C:\\b\\smoke\\..\\x', 'C:\\b\\smoke', {}, h));
  assert.throws(() => assertSafeWritePath('C:\\b\\smoke-evil\\x', 'C:\\b\\smoke', {}, h)); // 前方一致の落とし穴
});

test('assertSafeWritePath: 普段使いのエディタのデータの下は、ルートがそこにあっても通らない', () => {
  const env = { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' };
  const h = 'C:\\Users\\u';
  assert.throws(() => assertSafeWritePath('C:\\Users\\u\\.vscode\\x', 'C:\\Users\\u', env, h));
  assert.throws(() => assertSafeWritePath('C:\\Users\\u\\.vscode-oss\\x', 'C:\\Users\\u', env, h));
  assert.throws(() => assertSafeWritePath('C:\\Users\\u\\AppData\\Roaming\\Code\\User', 'C:\\Users\\u', env, h));
  assert.deepEqual(dailyDataPaths(env, h).sort(), ['C:\\Users\\u\\.vscode', 'C:\\Users\\u\\.vscode-oss', 'C:\\Users\\u\\AppData\\Roaming'].sort());
});

// ---- 本体の場所（版つき・平らの両方の配置）-----------------------------------
function fakeEditor(root, { layout, nameShort = 'Code', target = false }) {
  const appDir = layout === 'versioned' ? join(root, 'abc1234567', 'resources', 'app') : join(root, 'resources', 'app');
  mkdirSync(join(appDir, 'out'), { recursive: true });
  mkdirSync(join(appDir, 'extensions'), { recursive: true });
  const product = { nameShort, version: '9.9.9', commit: 'c'.repeat(40), dataFolderName: '.vscode' };
  if (target) product.target = 'user';
  writeFileSync(join(appDir, 'product.json'), JSON.stringify(product));
  writeFileSync(join(root, `${nameShort}.exe`), '');
  return appDir;
}

test('resolveEditor: 版つきの配置（公式の zip）で、exe はルート直下・product.json は <commit10>\\resources\\app', () => {
  const root = tmp();
  try {
    const appDir = fakeEditor(root, { layout: 'versioned' });
    const e = resolveEditor(root);
    assert.equal(e.exe, join(root, 'Code.exe'));
    assert.equal(e.appDir, appDir);
    assert.equal(e.cliJs, join(appDir, 'out', 'cli.js'));
    assert.equal(e.version, '9.9.9');
    assert.equal(e.portableOk, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('resolveEditor: 平らな配置（VSCodium 型）も読める', () => {
  const root = tmp();
  try {
    fakeEditor(root, { layout: 'flat', nameShort: 'Shuko' });
    const e = resolveEditor(root);
    assert.equal(e.exe, join(root, 'Shuko.exe'));
    assert.equal(e.nameShort, 'Shuko');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('resolveEditor: product.json に target があればポータブルにできない印を返す', () => {
  const root = tmp();
  try {
    fakeEditor(root, { layout: 'flat', target: true });
    assert.equal(resolveEditor(root).portableOk, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('resolveEditor: フォルダが無い・exe が無い・product.json が無いときは投げる', () => {
  assert.throws(() => resolveEditor(join(tmpdir(), 'smoke-no-such-dir-xyz')), /無い/);
  const root = tmp();
  try {
    assert.throws(() => resolveEditor(root), /product\.json/);
    fakeEditor(root, { layout: 'flat' });
    rmSync(join(root, 'Code.exe'));
    assert.throws(() => resolveEditor(root), /実行ファイル/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---- プロセスの木 -------------------------------------------------------------
test('treeFromProcesses: 指定した PID とその子孫だけを返す（兄弟・親・別の木は含めない）', () => {
  const rows = [
    { ProcessId: 1, ParentProcessId: 0, Name: 'init' },
    { ProcessId: 10, ParentProcessId: 1, Name: 'Code.exe' }, // 起動したもの
    { ProcessId: 11, ParentProcessId: 10, Name: 'Code.exe' },
    { ProcessId: 12, ParentProcessId: 11, Name: 'node.exe' },
    { ProcessId: 20, ParentProcessId: 1, Name: 'Code.exe' }, // 普段使いのエディタ（兄弟）
    { ProcessId: 21, ParentProcessId: 20, Name: 'Code.exe' },
  ];
  const ids = treeFromProcesses(rows, 10).map((p) => p.ProcessId).sort((a, b) => a - b);
  assert.deepEqual(ids, [10, 11, 12]);
});

test('treeFromProcesses: 親より古い「子」（PID の使い回しで混ざった別のプロセスの孤児）は木に入れない', () => {
  const rows = [
    { ProcessId: 10, ParentProcessId: 1, Name: 'Code.exe', CreatedMs: 5000 },
    { ProcessId: 11, ParentProcessId: 10, Name: 'Code.exe', CreatedMs: 5100 }, // 本物の子
    { ProcessId: 12, ParentProcessId: 10, Name: 'BraveCrashHandler.exe', CreatedMs: 1000 }, // 親の PID を後から使い回された孤児
    { ProcessId: 13, ParentProcessId: 12, Name: 'BraveCrashHandler64.exe', CreatedMs: 1100 },
    { ProcessId: 14, ParentProcessId: 11, Name: 'node.exe', CreatedMs: null }, // 作成時刻が無ければ外さない
  ];
  assert.deepEqual(treeFromProcesses(rows, 10).map((p) => p.ProcessId).sort((a, b) => a - b), [10, 11, 14]);
});

test('normalizeError: 4桁の PID の (node:6604) も揃える', () => {
  assert.equal(normalizeError('(node:6604) [DEP0169] x'), normalizeError('(node:35852) [DEP0169] x'));
});

test('treeFromProcesses: ルートが無ければ空。循環があっても止まる', () => {
  assert.deepEqual(treeFromProcesses([{ ProcessId: 1, ParentProcessId: 0 }], 99), []);
  const cyc = [{ ProcessId: 1, ParentProcessId: 2 }, { ProcessId: 2, ParentProcessId: 1 }];
  assert.equal(treeFromProcesses(cyc, 1).length, 2);
});

test('findRunRoots: 置き場所の名前を持つ本体だけを根として返す（普段使いのエディタ・別の実行は返さない）', () => {
  const exe = 'C:\\b\\p0\\vscode-1.146.0\\Code.exe';
  const run = 'C:\\b\\smoke\\runs\\official-20261113T124359';
  const rows = [
    { ProcessId: 10, ParentProcessId: 1, ExecutablePath: exe, CommandLine: `"${exe}" ${run}\\ws --user-data-dir ${run}\\user\\user-data` },
    { ProcessId: 11, ParentProcessId: 10, ExecutablePath: exe, CommandLine: `"${exe}" --type=renderer --user-data-dir=${run}\\user\\user-data` },
    { ProcessId: 20, ParentProcessId: 1, ExecutablePath: exe, CommandLine: `"${exe}" C:\\other\\ws --user-data-dir C:\\Users\\u\\AppData\\Roaming\\Code` }, // 普段使い
    { ProcessId: 30, ParentProcessId: 1, ExecutablePath: exe, CommandLine: `"${exe}" C:\\b\\smoke\\runs\\official-20261113T999999\\ws` }, // 別の実行
    { ProcessId: 40, ParentProcessId: 1, ExecutablePath: 'C:\\other\\Code.exe', CommandLine: `"x" ${run}` }, // 別の exe
  ];
  assert.deepEqual(findRunRoots(rows, run, exe), [10]);
  assert.deepEqual(findRunRoots([], run, exe), []);
});

// ---- ログの誤り ---------------------------------------------------------------
test('extractErrors: [error] だけを取り、続きの行を直前の記録にくっつける', () => {
  const text = [
    '2026-11-13 06:24:30.688 [info] ok',
    '2026-11-13 06:24:31.690 [warning] w',
    '2026-11-13 06:24:32.000 [error] first failure',
    '    at foo (file.js:1:1)',
    '    at bar (file.js:2:2)',
    '2026-11-13 06:24:33.000 [info] after',
    '    not an error continuation',
    '2026-11-13 06:24:34.000 [error] second',
  ].join('\r\n');
  const e = extractErrors(text, 'exthost.log');
  assert.equal(e.length, 2);
  assert.equal(e[0].message, 'first failure');
  assert.equal(e[0].stack.length, 2);
  assert.equal(e[1].message, 'second');
  assert.equal(e[1].source, 'exthost.log');
});

test('extractErrors: 誤りが無ければ空', () => {
  assert.deepEqual(extractErrors('2026-11-13 06:24:30.688 [info] ok\n'), []);
  assert.deepEqual(extractErrors(''), []);
});

test('extractChromiumErrors: CONSOLE は devtools-console、それ以外の ERROR は chromium。pid:tid が無い形も読める', () => {
  const text = [
    '[1234:5678:1113/062432.123:ERROR:CONSOLE(42)] "Uncaught TypeError: x", source: vscode-file://a (42)',
    '[1113/062433.000:ERROR:gpu_process_host.cc(1)] GPU process exited',
    '[1234:5678:1113/062434.000:WARNING:CONSOLE(1)] "just a warning"',
    '[1234:5678:1113/062435.000:INFO:CONSOLE(2)] "info"',
  ].join('\n');
  const e = extractChromiumErrors(text);
  assert.equal(e.length, 2);
  assert.equal(e[0].group, 'devtools-console');
  assert.equal(e[1].group, 'chromium');
});

test('parseLogTime / splitByCutoff: 止め始めた後の誤りを後始末として分ける。時刻が読めないものは残す', () => {
  const t = parseLogTime('2026-11-13 21:48:24.020');
  assert.equal(t.getFullYear(), 2026);
  assert.equal(t.getHours(), 21);
  assert.equal(t.getMilliseconds(), 20);
  assert.equal(parseLogTime('1113/062432.123'), null);
  assert.equal(parseLogTime('x'), null);
  const cutoff = new Date(2026, 10, 13, 21, 48, 24, 0);
  const r = splitByCutoff([
    { time: '2026-11-13 21:48:23.999', message: 'before' },
    { time: '2026-11-13 21:48:24.020', message: 'after: Server process exited with code 1.' },
    { time: '1113/062432.123', message: 'chromium line' },
  ], cutoff);
  assert.deepEqual(r.kept.map((e) => e.message), ['before', 'chromium line']);
  assert.deepEqual(r.teardown.map((e) => e.message), ['after: Server process exited with code 1.']);
});

test('classifyLog: 拡張ホスト・renderer・main・sharedprocess を分ける', () => {
  assert.equal(classifyLog('window1/exthost/exthost.log'), 'exthost');
  assert.equal(classifyLog('window1/exthost/Anthropic.claude-code/Claude VSCode.log'), 'exthost');
  assert.equal(classifyLog('window1/renderer.log'), 'renderer');
  assert.equal(classifyLog('main.log'), 'main');
  assert.equal(classifyLog('sharedprocess.log'), 'sharedprocess');
  assert.equal(classifyLog('window1/network.log'), 'other');
});

test('collectLogErrors: フォルダの下の *.log を再帰で集め、種類を付ける', () => {
  const root = tmp();
  try {
    mkdirSync(join(root, 'window1', 'exthost'), { recursive: true });
    writeFileSync(join(root, 'main.log'), '2026-11-13 06:00:00.000 [error] main broke\n');
    writeFileSync(join(root, 'window1', 'exthost', 'exthost.log'), '2026-11-13 06:00:01.000 [error] ext broke\n2026-11-13 06:00:02.000 [info] fine\n');
    writeFileSync(join(root, 'window1', 'notes.txt'), '2026-11-13 06:00:03.000 [error] not a log file\n');
    const r = collectLogErrors(root);
    assert.deepEqual(r.files.sort(), ['main.log', 'window1/exthost/exthost.log']);
    assert.deepEqual(r.errors.map((e) => `${e.group}:${e.message}`).sort(), ['exthost:ext broke', 'main:main broke']);
    assert.deepEqual(collectLogErrors(join(root, 'nothing-here')), { errors: [], files: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normalizeError: 時刻・PID・ポート・パス・UUID の揺れを落とす', () => {
  const a = normalizeError('Error at C:\\b\\smoke\\runs\\a-20261113T010101\\ws\\x.ts pid 123 port=4567 id 1a2b3c4d-1111-2222-3333-444455556666');
  const b = normalizeError('Error at C:\\b\\smoke\\runs\\b-20261114T020202\\ws\\x.ts pid 999 port=8888 id 9f9f9f9f-aaaa-bbbb-cccc-ddddeeeeffff');
  assert.equal(a, b);
  assert.notEqual(normalizeError('Error A'), normalizeError('Error B'));
});

test('newErrors: 前の版の鍵に無い誤りだけを返す', () => {
  const prev = [{ group: 'exthost', source: 'x', message: 'old failure at C:\\a\\b' }];
  const keys = [...errorKeys(prev)];
  const now = [
    { group: 'exthost', source: 'y', message: 'old failure at C:\\c\\d' }, // パスだけ違う → 同じ
    { group: 'exthost', source: 'y', message: 'brand new failure' },
    { group: 'main', source: 'y', message: 'old failure at C:\\c\\d' }, // 種類が違う → 新しい
  ];
  const fresh = newErrors(now, keys);
  assert.deepEqual(fresh.map((e) => `${e.group}:${e.message}`), ['exthost:brand new failure', 'main:old failure at C:\\c\\d']);
});

test('groupErrors: 種類ごとの件数', () => {
  assert.deepEqual(groupErrors([{ group: 'main' }, { group: 'main' }, { group: 'exthost' }]), { main: 2, exthost: 1 });
});

// ---- Claude Code の .lock -------------------------------------------------------
test('snapshotLocks / newLocks: <port>.lock だけを数え、増えたものを返す', () => {
  const dir = tmp();
  try {
    assert.deepEqual(snapshotLocks(join(dir, 'none')), []);
    writeFileSync(join(dir, '111.lock'), '{}');
    writeFileSync(join(dir, 'notes.txt'), '');
    writeFileSync(join(dir, 'abc.lock'), '');
    const before = snapshotLocks(dir);
    assert.deepEqual(before, ['111.lock']);
    writeFileSync(join(dir, '222.lock'), '{}');
    assert.deepEqual(newLocks(before, snapshotLocks(dir)), ['222.lock']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readLock: authToken（秘密）を結果に出さない。壊れた JSON は error を返す', () => {
  const dir = tmp();
  try {
    const f = join(dir, '35282.lock');
    writeFileSync(f, JSON.stringify({ pid: 4242, workspaceFolders: ['C:\\ws'], ideName: 'Visual Studio Code', transport: 'ws', authToken: 'SECRET-TOKEN' }));
    const l = readLock(f);
    assert.equal(l.port, 35282);
    assert.equal(l.pid, 4242);
    assert.equal(l.hasAuthToken, true);
    assert.ok(!JSON.stringify(l).includes('SECRET-TOKEN'));
    const bad = join(dir, '5.lock');
    writeFileSync(bad, '{not json');
    assert.ok(readLock(bad).error);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lockBelongsTo: pid が起動した木にある、またはフォルダが開いたワークスペースなら自分のもの。それ以外は他人のもの', () => {
  const mine = { pid: 100, workspaceFolders: [] };
  const other = { pid: 999, workspaceFolders: ['C:\\users\\me\\project'] };
  const byWs = { pid: 999, workspaceFolders: ['C:\\B\\smoke\\runs\\a\\ws'] };
  assert.equal(lockBelongsTo(mine, [100, 101], ['C:\\b\\smoke\\runs\\a\\ws']), true);
  assert.equal(lockBelongsTo(other, [100, 101], ['C:\\b\\smoke\\runs\\a\\ws']), false); // 普段使いの .lock を消さない
  assert.equal(lockBelongsTo(byWs, [100], ['C:\\b\\smoke\\runs\\a\\ws']), true);
  assert.equal(lockBelongsTo({ error: 'x' }, [1], []), false);
});

// ---- 環境の作り方 --------------------------------------------------------------
test('formatArgv: 末尾が "\\n}" で、その後ろに何も無い（初回の起動で末尾2文字を切って足すため）', () => {
  const t = formatArgv({ locale: 'ja' });
  assert.ok(t.endsWith('\n}'));
  assert.deepEqual(JSON.parse(t), { locale: 'ja' });
  const empty = formatArgv({});
  assert.ok(empty.endsWith('\n}'));
  assert.ok(empty.includes('//'));
});

test('buildUserSettings: 本家は useBundled をユーザー設定に入れ、自作は入れない（mydist の既定を確かめるため）', () => {
  const up = buildUserSettings('upstream');
  const built = buildUserSettings('built');
  assert.equal(up['basedpyright.importStrategy'], 'useBundled');
  assert.equal('basedpyright.importStrategy' in built, false);
  for (const s of [up, built]) {
    assert.equal(s['security.workspace.trust.enabled'], false);
    assert.equal(s['extensions.autoUpdate'], false);
  }
  assert.equal(buildUserSettings('built', { 'a.b': 1 })['a.b'], 1);
});

test('defaultExtensionIds: 台帳のとおり全部（特例で除くものは無い）。台帳の実物は 8 件で weixu.wx-vsce-dotenv を含む', () => {
  assert.deepEqual(defaultExtensionIds([{ id: 'a.b' }, { id: 'weixu.wx-vsce-dotenv' }, { id: 'c.d' }]), ['a.b', 'weixu.wx-vsce-dotenv', 'c.d']);
  assert.deepEqual(defaultExtensionIds([]), []);
  const real = readLedger(new URL('../extensions.lock.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
  const ids = defaultExtensionIds(real);
  assert.equal(ids.length, real.length);
  assert.ok(ids.includes('weixu.wx-vsce-dotenv'));
  assert.ok(!ids.includes('dotenv.dotenv-vscode'));
});

test('findVsix: 台帳の版を優先し、プラットフォーム違いは避ける。無ければ投げる', () => {
  const root = tmp();
  try {
    const put = (dir, name) => { mkdirSync(join(root, dir), { recursive: true }); writeFileSync(join(root, dir, name), 'x'); };
    put('anthropic.claude-code-2.1.322@win32-x64', 'Anthropic.claude-code-2.1.322@win32-x64.vsix');
    put('anthropic.claude-code-2.1.400@win32-x64', 'Anthropic.claude-code-2.1.400@win32-x64.vsix');
    put('anthropic.claude-code-2.1.999@linux-x64', 'Anthropic.claude-code-2.1.999@linux-x64.vsix');
    put('detachhead.basedpyright-1.40.2', 'detachhead.basedpyright-1.40.2.vsix');
    assert.equal(findVsix('anthropic.claude-code', '2.1.322', root).version, '2.1.322');
    assert.equal(findVsix('anthropic.claude-code', undefined, root).version, '2.1.400'); // linux の 2.1.999 は選ばない
    assert.equal(findVsix('detachhead.basedpyright', '1.40.2', root).version, '1.40.2');
    assert.throws(() => findVsix('anthropic.claude-code', '0.0.1', root), /台帳の版/);
    assert.throws(() => findVsix('no.such', undefined, root), /VSIX が無い/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fingerprint: 同じ内容は同じ、違えば違う', () => {
  assert.equal(fingerprint({ a: 1 }), fingerprint({ a: 1 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});

// ---- 試験用ワークスペース -------------------------------------------------------
test('createWorkspace: 診断・補完を試すファイルを作る（git なし）', () => {
  const root = tmp();
  try {
    const r = createWorkspace(root, { git: false });
    for (const rel of ['ts/bad.ts', 'py/bad.py', 'web/style.css', 'web/data.json', 'shell/bad.sh', 'ps/bad.ps1', 'img/pixel.png', 'doc/sample.pdf', '.env', 'docs/readme.md']) {
      assert.ok(r.files.includes(rel), rel);
    }
    assert.equal(r.git.ok, false);
    assert.ok(readFileSync(join(root, 'docs/readme.md'), 'utf8').includes('smoke_needle'));
    assert.deepEqual([...readFileSync(join(root, 'img/pixel.png')).subarray(1, 4)], [0x50, 0x4e, 0x47]); // PNG の印
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fixtureFiles: TS の型の誤りと Python の型の誤りが入っている', () => {
  const f = fixtureFiles();
  assert.match(f['ts/bad.ts'], /: number = "/);
  assert.match(f['py/bad.py'], /x: int = "a"/);
});

test('minimalPdf: xref の位置が startxref と合う', () => {
  const pdf = minimalPdf();
  assert.ok(pdf.startsWith('%PDF-1.4'));
  const m = /startxref\n(\d+)\n%%EOF/.exec(pdf);
  assert.ok(m);
  assert.equal(pdf.slice(Number(m[1]), Number(m[1]) + 4), 'xref');
});

// ---- 引数・集計 ---------------------------------------------------------------
test('parseArgs: 既定は公式の zip・upstream・全部の組', () => {
  const o = parseArgs([]);
  assert.equal(o.build, 'C:\\b\\p0\\vscode-1.146.0');
  assert.equal(o.mode, 'upstream');
  assert.deepEqual(o.groups, ['base', 'claude-code', 'languages']);
  assert.equal(o.secondWindow, true);
  assert.equal(o.keepLocks, false);
});

test('parseArgs: 値つき・旗・誤りの検出', () => {
  const o = parseArgs(['--build', 'D:/x', '--label', 'built', '--mode', 'built', '--groups', 'base,languages', '--ext', 'a.b,c.d', '--no-second-window', '--keep-locks', '--timeout', '30']);
  assert.equal(o.build, 'D:/x');
  assert.equal(o.mode, 'built');
  assert.deepEqual(o.groups, ['base', 'languages']);
  assert.deepEqual(o.ext, ['a.b', 'c.d']);
  assert.equal(o.secondWindow, false);
  assert.equal(o.keepLocks, true);
  assert.equal(o.timeout, 30);
  assert.throws(() => parseArgs(['--nope']), /知らない/);
  assert.throws(() => parseArgs(['--groups', 'base,xx']), /知らない組/);
  assert.throws(() => parseArgs(['--mode', 'other']), /--mode/);
  assert.throws(() => parseArgs(['--build']), /値が要る/);
  assert.throws(() => parseArgs(['--timeout', 'abc']), /数でない/);
  assert.throws(() => parseArgs(['positional']), /知らない/);
});

test('countStatuses / exitCodeFor: FAIL があれば 1、SKIP と INFO だけなら 0', () => {
  const checks = [{ status: 'pass' }, { status: 'skip' }, { status: 'info' }];
  assert.deepEqual(countStatuses(checks), { pass: 1, fail: 0, skip: 1, info: 1 });
  assert.equal(exitCodeFor(checks), 0);
  assert.equal(exitCodeFor([...checks, { status: 'fail' }]), 1);
  assert.equal(exitCodeFor([]), 0);
});

test('dailyArgvChanged: 作られた・消えた・更新されたものを見つける', () => {
  const a = { vscode: { exists: false, mtimeMs: 0 }, vscodeOss: { exists: true, mtimeMs: 5 } };
  assert.deepEqual(dailyArgvChanged(a, a), []);
  assert.deepEqual(dailyArgvChanged(a, { ...a, vscode: { exists: true, mtimeMs: 9 } }), ['vscode']);
  assert.deepEqual(dailyArgvChanged(a, { ...a, vscodeOss: { exists: true, mtimeMs: 6 } }), ['vscodeOss']);
});

test('formatMarkdown: 組ごとの表と誤りの件数が出る', () => {
  const md = formatMarkdown({
    label: 't', mode: 'upstream', startedAt: 'now', runDir: 'C:\\r', build: { root: 'C:\\b', nameShort: 'Code', version: '1.0', commit: 'abcdef0123456' },
    counts: { pass: 1, fail: 1, skip: 0, info: 0 }, errorCounts: { main: 1 }, errors: [{ group: 'main', source: 'main.log', time: 't', message: 'boom' }],
    tree: { count: 3, summary: 'Code.exe x3', leftover: 0 },
    checks: [{ id: 'base.a', group: 'base', title: 'A', status: 'pass', detail: 'x|y' }, { id: 'claude.b', group: 'claude-code', title: 'B', status: 'fail', detail: 'bad' }],
  });
  assert.match(md, /## base/);
  assert.match(md, /## claude-code/);
  assert.match(md, /FAIL \| claude\.b/);
  assert.match(md, /x\\\|y/); // 表の区切りをエスケープ
  assert.match(md, /\[main\] main\.log/);
});

test('uniqueErrors: 時刻・パスだけが違う誤りは1種類にまとめて件数を数える', () => {
  const u = uniqueErrors([
    { group: 'renderer', source: 'a', time: '1', message: 'fail at C:\\x\\1 pid 11' },
    { group: 'renderer', source: 'a', time: '2', message: 'fail at C:\\y\\2 pid 22' },
    { group: 'exthost', source: 'b', time: '3', message: 'fail at C:\\x\\1 pid 11' },
  ]);
  assert.equal(u.length, 2);
  assert.equal(u[0].count, 2);
  assert.equal(u[0].first, '1');
  assert.equal(u[1].group, 'exthost');
});

test('findRg: 1.146.0 の配置（@vscode/ripgrep-universal）を見つけ、@github の rg.exe は選ばない', () => {
  const app = tmp();
  try {
    const good = join(app, 'node_modules.asar.unpacked', '@vscode', 'ripgrep-universal', 'bin', 'win32-x64');
    const bad = join(app, 'node_modules.asar.unpacked', '@github', 'copilot-sdk-win32-x64', 'ripgrep', 'bin', 'win32-x64');
    mkdirSync(good, { recursive: true });
    mkdirSync(bad, { recursive: true });
    writeFileSync(join(bad, 'rg.exe'), '');
    assert.equal(findRg({ appDir: app }), null); // @github だけでは見つからない
    writeFileSync(join(good, 'rg.exe'), '');
    assert.equal(findRg({ appDir: app }), join(good, 'rg.exe'));
  } finally { rmSync(app, { recursive: true, force: true }); }
});

test('historyHas: entries.json は終了時にしか書かれないので、保存された版の本文で見る', () => {
  const h = tmp();
  try {
    assert.equal(historyHas(join(h, 'none'), 'x'), false);
    mkdirSync(join(h, '467fa708'), { recursive: true });
    writeFileSync(join(h, '467fa708', 'KeaG.txt'), 'smoke-edit-before\n');
    writeFileSync(join(h, '467fa708', 'entries.json'), 'smoke-edit-before'); // 数えない
    assert.equal(historyHas(h, 'smoke-edit-before'), true);
    assert.equal(historyHas(h, 'other text'), false);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

// ---- probe の拡張が構文として読める --------------------------------------------
test('probe/extension.js: 構文が正しく、activate を公開する', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'extension.js' }));
  assert.match(src, /module\.exports = \{ activate, deactivate \}/);
  const pkg = JSON.parse(readFileSync(new URL('./smoke/probe/package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.main, './extension.js');
  assert.ok(pkg.activationEvents.includes('onStartupFinished'));
});

test('probe/extension.js: docs/06 の5節の「自」の項目の id を持つ', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  for (const id of [
    'base.open-folder', 'base.edit-save', 'base.palette', 'base.split', 'base.minimap', 'base.terminal', 'base.search', 'base.diff', 'base.git',
    'base.task', 'base.markdown-preview', 'base.image-preview', 'base.pdf-preview', 'base.timeline-localhistory', 'base.snippet', 'base.format', 'base.problems',
    'claude.running',
    'lang.ts.diagnostics', 'lang.ts.completion', 'lang.py.importStrategy', 'lang.py.diagnostics', 'lang.html.completion', 'lang.css.diagnostics',
    'lang.json.diagnostics', 'lang.csv.rainbow', 'lang.env.dotenv', 'lang.sh.shellcheck', 'lang.ps1.session',
  ]) assert.ok(src.includes(`'${id}'`), id);
});

test('probe/extension.js: 結果の書き出しは rename の EPERM（台本が読んでいる最中）で落ちない', () => {
  // 2回目の実行で、flush() の renameSync が EPERM を投げて probe 全体が止まった（2026-11-13）。再発させない。
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('const flush = () =>'), src.indexOf('async function check('));
  assert.match(body, /try\s*\{[\s\S]*renameSync[\s\S]*\}\s*catch/);
  assert.match(body, /for \(let i = 0; i < 5; i\+\+\)/);
});

// ---- 差し戻し（検証 2026-11-13）の直し ------------------------------------------
test('A: probe は試験用フォルダ（cfg.ws）を開いたウィンドウでしか動かない（2つめのウィンドウが結果を上書きしない）', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function activate()'));
  const guard = body.indexOf('workspaceFolders');
  const firstCheck = body.indexOf('const result = {');
  assert.ok(guard > 0 && guard < firstCheck, 'フォルダの確認は、結果を作る前に置く');
  assert.match(body.slice(guard, guard + 300), /!sameFs\(folders\[0\]\.uri\.fsPath, ws\)\) return;/);
  assert.match(body.slice(guard - 200, guard + 200), /!folders \|\| !folders\.length/);
});

test('B・C・F: 置換・JSON の補完・dotenv の比べの項目と、そのファイルがある', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  for (const id of ['base.replace', 'lang.json.completion', 'lang.env.compare']) assert.ok(src.includes(`'${id}'`), id);
  assert.match(src, /'workbench\.action\.findInFiles', \{ query: 'replace_me', replace: 'replaced_ok'/);
  // 「すべて置換」は本物の確認ダイアログが出て押せない（実機で確認）。1件ごとの置換（確認なし）を使う
  assert.match(src, /search\.action\.replace'/);
  assert.match(src, /search\.action\.focusNextSearchResult/);
  assert.ok(!/executeCommand\('search\.action\.replaceAll'\)/.test(src), 'replaceAll は呼ばない');
  // 先に base.search を走らせると、検索ビューに前の検索語が残って別のファイルを置換した（実機）。置換を先に呼ぶ
  assert.ok(src.indexOf('await replaceCheck();') > 0 && src.indexOf('await replaceCheck();') < src.indexOf("await check('base.search'"));
  const f = fixtureFiles();
  assert.equal(f['edit/replace.txt'], 'replace_me\n');
  assert.deepEqual(JSON.parse(f['web/schema.json']).properties.color.enum, ['red', 'green', 'blue']);
  assert.equal(JSON.parse(f['web/schema-sample.json']).$schema, './schema.json');
  for (const n of ['.env', '.env.bad', 'bad.env']) assert.ok(n in f, n);
  assert.ok(f['.env.bad'].includes('NOKEY') && f['.env.bad'].includes('UNCLOSED="abc'));
  const lines = f['web/schema-sample.json'].split('\n');
  const p = COMPLETION_POSITIONS.json;
  assert.equal(lines[p.line].slice(0, p.character), '  "color": "'); // 補完の位置は引用符の間
  assert.equal(lines[p.line][p.character], '"');
  assert.equal(f['.env'].split('\n')[COMPLETION_POSITIONS.env[1].line].length, COMPLETION_POSITIONS.env[1].character);
  // probe が開くファイルに入っている
  for (const rel of ['web/schema-sample.json', '.env.bad', 'bad.env']) assert.ok(src.includes(`'${rel}'`), rel);
});

test('スニペット・整形は、フォーカスに頼らない API（insertSnippet・executeFormatDocumentProvider）で行う', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  assert.match(src, /editor\.insertSnippet\(new vscode\.SnippetString/);
  assert.match(src, /vscode\.executeFormatDocumentProvider/);
  assert.ok(!/executeCommand\('editor\.action\.insertSnippet'/.test(src));
  assert.ok(!/executeCommand\('editor\.action\.formatDocument'/.test(src));
});

test('base.problems は languages の組を走らせたときだけ（診断は言語の組が出す）', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  const i = src.indexOf("check('base.problems'");
  assert.match(src.slice(i - 200, i), /if \(want\('base'\) && want\('languages'\)\)/);
});

test('F: dotenv の拡張は台帳のとおり。--dotenv は無く、台帳に無い拡張は --ext で明示する。probe は台本が渡す dotenvIds を見る', () => {
  assert.throws(() => parseArgs(['--dotenv', 'b']), /知らない引数/);
  assert.deepEqual(parseArgs(['--ext', 'dotenv.dotenv-vscode,x.y']).ext, ['dotenv.dotenv-vscode', 'x.y']);
  const probe = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  assert.ok(!probe.includes("'dotenv.dotenv-vscode'") && !probe.includes("'weixu.wx-vsce-dotenv'"), 'probe に拡張 id を決め打ちしない');
  assert.match(probe, /cfg\.dotenvIds/);
  const run = readFileSync(new URL('./smoke/lib/run.mjs', import.meta.url), 'utf8');
  assert.match(run, /dotenvIds: ids\.filter\(\(i\) => \/dotenv\/i\.test\(i\)\)/);
  const env = readFileSync(new URL('./smoke/lib/env.mjs', import.meta.url), 'utf8');
  assert.ok(!env.includes('DOTENV_A') && !env.includes('DOTENV_B'));
});

test('D: mergeBaseline は鍵の和を取り、実行回数と鍵ごとの回数を数える', () => {
  const first = mergeBaseline(null, ['a', 'b'], { label: 'x' });
  assert.equal(first.runs, 1);
  assert.deepEqual(first.keys, ['a', 'b']);
  const second = mergeBaseline(first, ['b', 'c', 'c']);
  assert.equal(second.runs, 2);
  assert.deepEqual(second.keys, ['a', 'b', 'c']);
  assert.deepEqual(second.seen, { a: 1, b: 2, c: 1 });
  const third = mergeBaseline(second, ['d']);
  assert.equal(third.runs, 3);
  assert.deepEqual(third.keys, ['a', 'b', 'c', 'd']);
  // 古い形式（1回分、seen なし）も取り込める
  const old = mergeBaseline({ keys: ['p', 'q'] }, ['q', 'r']);
  assert.equal(old.runs, 2);
  assert.deepEqual(old.keys, ['p', 'q', 'r']);
  // 新しい誤りの判定は和に対して行う
  assert.deepEqual(newErrors([{ group: 'main', source: 's', message: 'zzz' }], third.keys).length, 1);
});

test('D: --merge-baseline は --save-baseline が無いと使えない。--keep-runs は0以上の整数', () => {
  assert.throws(() => parseArgs(['--merge-baseline']), /--save-baseline/);
  const o = parseArgs(['--save-baseline', 'b.json', '--merge-baseline', '--keep-runs', '5']);
  assert.equal(o.mergeBaseline, true);
  assert.equal(o.keepRuns, 5);
  assert.equal(parseArgs([]).keepRuns, 10);
  assert.throws(() => parseArgs(['--keep-runs', '-1']), /--keep-runs/);
  assert.throws(() => parseArgs(['--keep-runs', '1.5']), /--keep-runs/);
});

test('後始末: selectPrune は最新の N 個を残し、名前が読めないものは消さない', () => {
  const names = ['official-20261113T100000', 'official-20261113T120000', 'built-20261113T110000', 'notes', 'official-20261112T235959'];
  assert.deepEqual(selectPrune(names, 2), ['official-20261113T100000', 'official-20261112T235959']); // 最新は 120000 と 110000
  assert.deepEqual(selectPrune(names, 10), []);
  assert.deepEqual(selectPrune(names, 0).sort(), ['built-20261113T110000', 'official-20261112T235959', 'official-20261113T100000', 'official-20261113T120000'].sort());
});

test('後始末: pruneRuns は runs\\ の下の古いものだけを消し、現在の置き場所・ext\\・ほかは残す', () => {
  const root = tmp();
  try {
    for (const n of ['a-20261113T000001', 'a-20261113T000002', 'a-20261113T000003', 'keepme']) mkdirSync(join(root, 'runs', n), { recursive: true });
    mkdirSync(join(root, 'ext', 'p'), { recursive: true });
    writeFileSync(join(root, 'baseline.json'), '{}');
    const removed = pruneRuns(root, 1, join(root, 'runs', 'a-20261113T000001'));
    assert.deepEqual(removed.sort(), ['a-20261113T000002']); // 最新(3)を残し、現在(1)も残す
    assert.ok(existsSync(join(root, 'runs', 'a-20261113T000001')));
    assert.ok(existsSync(join(root, 'runs', 'a-20261113T000003')));
    assert.ok(existsSync(join(root, 'runs', 'keepme')));
    assert.ok(existsSync(join(root, 'ext', 'p')));
    assert.ok(existsSync(join(root, 'baseline.json')));
    assert.deepEqual(pruneRuns(join(root, 'none'), 1), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('軽微: smoke-stop は runs\\ そのもの・外・孫を受け付けず、直下の置き場所だけ受け付ける', () => {
  const runs = 'C:\\b\\smoke\\runs';
  assert.equal(isRunDirPath('C:\\b\\smoke\\runs\\official-20261113T124945', runs), true);
  assert.equal(isRunDirPath('C:/b/smoke/runs/official-20261113T124945/', runs), true);
  assert.equal(isRunDirPath(runs, runs), false);
  assert.equal(isRunDirPath('C:\\b\\smoke\\runs\\a\\user', runs), false);
  assert.equal(isRunDirPath('C:\\b\\smoke', runs), false);
  assert.equal(isRunDirPath('C:\\b\\smoke\\runs-evil\\a', runs), false);
});

test('軽微: stopTree は根の実行ファイルが違えば止めない（PID の使い回し）', () => {
  const exe = 'C:\\b\\p0\\vscode-1.146.0\\Code.exe';
  assert.equal(rootMatches([{ ExecutablePath: 'c:\\b\\p0\\vscode-1.146.0\\code.exe' }], exe), true);
  assert.equal(rootMatches([{ ExecutablePath: 'C:\\Windows\\notepad.exe' }], exe), false);
  assert.equal(rootMatches([{ ExecutablePath: null }], exe), false);
  assert.equal(rootMatches([], exe), false);
  assert.equal(rootMatches([], null), true); // 確かめない指定
});

test('listProcesses: 自分のプロセスを含む配列を返す。出力は UTF-8 に固定している（日本語のコマンドラインで JSON が壊れた）', () => {
  const rows = listProcesses();
  assert.ok(Array.isArray(rows) && rows.length > 10);
  const me = rows.find((p) => Number(p.ProcessId) === process.pid);
  assert.ok(me);
  assert.ok(Number.isFinite(Number(me.CreatedMs)) && Number(me.CreatedMs) > 1.7e12, `作成時刻（ミリ秒）が要る: ${me.CreatedMs}`);
  const src = readFileSync(new URL('./smoke/lib/common.mjs', import.meta.url), 'utf8');
  assert.match(src, /OutputEncoding = \[System\.Text\.Encoding\]::UTF8/);
});

// ---- 検証 2 の指摘 G〜L ------------------------------------------------------------
test('G: probe の最後の一覧は API に無い packageUri を使わず、3つを独立に取り、失敗を snapshotError に残す。台本はそれを FAIL にする', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  assert.ok(!/\.packageUri/.test(src), 'Extension に packageUri は無い');
  assert.match(src, /e\.extensionPath \|\| e\.extensionUri\.fsPath/);
  for (const k of ['extensions:', 'commands:', 'diagnostics:']) assert.ok(src.includes(`snapshotErrors.push(\`${k}`), k);
  const run = readFileSync(new URL('./smoke/lib/run.mjs', import.meta.url), 'utf8');
  assert.match(run, /add\('probe\.snapshot'/);
  assert.match(run, /commands\.json ができていない/);
  assert.match(run, /problems\.length \? 'fail' : 'pass'/);
});

test('H: diffFixtures は意図した3ファイル以外の変更・消失を見つける', () => {
  const root = tmp();
  try {
    createWorkspace(root, { git: false });
    assert.deepEqual(diffFixtures(root), { unexpected: [], missing: [], changedAsExpected: [] });
    writeFileSync(join(root, 'edit/replace.txt'), 'replaced_ok\n');
    writeFileSync(join(root, 'tracked.txt'), 'tracked\nchanged\n');
    writeFileSync(join(root, 'edit/target.txt'), 'smoke-edit-before\n');
    let d = diffFixtures(root);
    assert.deepEqual(d.unexpected, []);
    assert.deepEqual(d.changedAsExpected.sort(), [...EXPECTED_CHANGES].sort());
    // 過去の事故: 置換が docs/readme.md の smoke_needle の行を空にした
    writeFileSync(join(root, 'docs/readme.md'), '# smoke\n\n\n');
    rmSync(join(root, 'img/pixel.png'));
    writeFileSync(join(root, 'doc/sample.pdf'), 'broken');
    d = diffFixtures(root);
    assert.deepEqual(d.unexpected.sort(), ['doc/sample.pdf', 'docs/readme.md']);
    assert.deepEqual(d.missing, ['img/pixel.png']);
  } finally { rmSync(root, { recursive: true, force: true }); }
  const run = readFileSync(new URL('./smoke/lib/run.mjs', import.meta.url), 'utf8');
  assert.match(run, /add\('base\.fixtures-intact'/);
  const probe = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  assert.ok(!probe.includes('「すべて置換」を実行し、ファイルが書き換わる'), '古いコメントを残さない');
});

test('I: removeOwnLocks は起動の後に増えた自分の .lock だけを消す（前からあるもの・他人のものは消さない）', () => {
  const dir = tmp();
  try {
    const mk = (port, obj) => writeFileSync(join(dir, `${port}.lock`), JSON.stringify(obj));
    mk(1000, { pid: 1, workspaceFolders: ['C:\\users\\me\\real-project'] }); // 前からある普段使い
    const before = snapshotLocks(dir);
    mk(2000, { pid: 500, workspaceFolders: [] }); // prime の木の pid
    mk(2001, { pid: 999, workspaceFolders: ['C:\\b\\smoke\\runs\\manual-1\\ws'] }); // 開いたフォルダが一致
    mk(2002, { pid: 777, workspaceFolders: ['C:\\users\\me\\other'] }); // 他人
    const removed = removeOwnLocks(before, [500, 501], ['C:\\b\\smoke\\runs\\manual-1\\ws'], dir).map((p) => p.split(/[\\/]/).pop()).sort();
    assert.deepEqual(removed, ['2000.lock', '2001.lock']);
    assert.deepEqual(snapshotLocks(dir), ['1000.lock', '2002.lock']);
    assert.deepEqual(removeOwnLocks(snapshotLocks(dir), [500], [], dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const src = readFileSync(new URL('./smoke-launch.mjs', import.meta.url), 'utf8');
  assert.match(src, /removeOwnLocks\(locksBefore, primePids, \[ws\]\)/);
  assert.match(src, /treeFromProcesses\(listProcesses\(\), prime\.pid\)/);
});

test('K: 置き場所に .keep があれば pruneRuns は消さず、残す数にも数えない', () => {
  const root = tmp();
  try {
    for (const n of ['a-20261113T000001', 'a-20261113T000002', 'a-20261113T000003', 'a-20261113T000004']) mkdirSync(join(root, 'runs', n), { recursive: true });
    writeFileSync(join(root, 'runs', 'a-20261113T000001', KEEP_MARK), '');
    writeFileSync(join(root, 'runs', 'a-20261113T000002', KEEP_MARK), '');
    // 印なしは 3 と 4。最新 1 個を残すと 3 が消える。印つきの 1・2 は古くても消えない
    const removed = pruneRuns(root, 1, join(root, 'runs', 'a-20261113T000004'));
    assert.deepEqual(removed, ['a-20261113T000003']);
    for (const n of ['a-20261113T000001', 'a-20261113T000002', 'a-20261113T000004']) assert.ok(existsSync(join(root, 'runs', n)), n);
    // --keep-runs 0 でも印つきは残る
    assert.deepEqual(pruneRuns(root, 0, join(root, 'runs', 'a-20261113T000004')), []);
    assert.ok(existsSync(join(root, 'runs', 'a-20261113T000001')));
    assert.equal(KEEP_MARK, '.keep');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sameProc: 名前と親が同じなら同じプロセス、PID が使い回されて別のものなら違う', () => {
  assert.equal(sameProc({ Name: 'Code.exe', ParentProcessId: 5 }, { Name: 'code.exe', ParentProcessId: 5 }), true);
  assert.equal(sameProc({ Name: 'Code.exe', ParentProcessId: 5 }, { Name: 'svchost.exe', ParentProcessId: 5 }), false);
  assert.equal(sameProc({ Name: 'Code.exe', ParentProcessId: 5 }, { Name: 'Code.exe', ParentProcessId: 9 }), false);
});

test('--reuse-ext は旗で、既定は off。env.mjs は印が変わっていても使い回す', () => {
  assert.equal(parseArgs([]).reuseExt, false);
  assert.equal(parseArgs(['--reuse-ext']).reuseExt, true);
  const src = readFileSync(new URL('./smoke/lib/env.mjs', import.meta.url), 'utf8');
  assert.match(src, /m\.fingerprint === fp \|\| reuse/);
});

test('J: smoke-design.md に --prime・--merge-baseline・--keep-runs・.keep・--reuse-ext の使い方がある', () => {
  const md = readFileSync(new URL('../tasks/2026-11-13-p1-smoke/smoke-design.md', import.meta.url), 'utf8');
  for (const w of ['--prime', '--merge-baseline', '--keep-runs', '.keep', '--reuse-ext', 'commands.json']) assert.ok(md.includes(w), w);
});

test('L: netaudit の Limits の claude.exe の行は、ネットのログの名前もヒントだと書く', () => {
  const ps = readFileSync(new URL('../scripts/netaudit.ps1', import.meta.url), 'utf8');
  assert.match(ps, /A net-log name is a hint too \(its rows have the claude-cli role/);
  assert.ok(!ps.includes('or when the same address is in the net log'));
});

test('E: smoke-run の --prime は旗で、既定は off', () => {
  assert.equal(parseArgs([]).prime, false);
  assert.equal(parseArgs(['--prime']).prime, true);
});

test('E: smoke-launch は、日本語の表示のために languagepacks.json を待って起動し直す（--no-prime で省ける）', () => {
  const src = readFileSync(new URL('./smoke-launch.mjs', import.meta.url), 'utf8');
  assert.match(src, /languagepacks\.json/);
  assert.match(src, /--no-prime/);
  assert.match(src, /stopTree\(prime\.pid, editor\.exe\)/);
  // 手順書にも書いてある
  const md = readFileSync(new URL('../tasks/2026-11-13-p1-smoke/manual-checks.md', import.meta.url), 'utf8');
  assert.match(md, /languagepacks\.json/);
  assert.match(md, /開き直/);
});

test('probe/extension.js: Claude Code の起動を activate() で取り繕わない（自然な起動を見る）', () => {
  const src = readFileSync(new URL('./smoke/probe/extension.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf("'claude.running'"), src.indexOf("'claude.running'") + 900);
  assert.ok(!/\.activate\(\)/.test(block));
});

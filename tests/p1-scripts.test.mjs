// Phase 1 で足した台本のテスト: scripts/disk-usage.mjs、p1-launch-check.ps1、p1-ci-events.ps1、check-env.ps1 の smartAppControl。
// 仕様: tasks/2026-11-13-p1-build-upstream/handoff-notes.md の「テストの入口（曹参へ）」。
// 本物のエディタは起動しない（p1-launch-check は引数の誤りで断る所までだけ）。PC の設定は変えない。一時フォルダは C:\b\ の下（無ければ OS の temp）。
// Run: node --test tests/p1-scripts.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, expandEnv, countDir } from '../scripts/disk-usage.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode, runPs, parseJsonOut } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-p1-');
});
after(() => removeSandbox(sb));

const DISK = path.join(REPO, 'scripts', 'disk-usage.mjs');
const LAUNCH = path.join(REPO, 'scripts', 'p1-launch-check.ps1');
const EVENTS = path.join(REPO, 'scripts', 'p1-ci-events.ps1');
const CHECK_ENV = path.join(REPO, 'scripts', 'check-env.ps1');

// ---- expandEnv ----------------------------------------------------------------------------
test('expandEnv: %NAME% を展開する（名前の大文字小文字は問わない）', () => {
  assert.equal(expandEnv('%FOO%\\x', { FOO: 'C:\\a' }), 'C:\\a\\x');
  assert.equal(expandEnv('%foo%', { Foo: 'v' }), 'v');
  assert.equal(expandEnv('%A%-%B%', { A: '1', B: '2' }), '1-2');
});
test('expandEnv: 知らない名前はそのまま残す。% の無い文字列は変えない', () => {
  assert.equal(expandEnv('%NOPE_X%\\y', {}), '%NOPE_X%\\y');
  assert.equal(expandEnv('plain', { A: '1' }), 'plain');
});

// ---- parseArgs ----------------------------------------------------------------------------
test('parseArgs: 既定は drive C: ・out null。<name>=<dir> を絶対パスにして並べる', () => {
  const a = parseArgs(['store=' + sb, 'wt=' + path.join(sb, 'x')], {});
  assert.equal(a.drive, 'C:');
  assert.equal(a.out, null);
  assert.deepEqual(a.entries.map((e) => e.name), ['store', 'wt']);
  assert.equal(a.entries[0].path, path.resolve(sb));
  assert.ok(path.isAbsolute(a.entries[1].path));
});
test('parseArgs: --out と --drive を読む。環境変数を展開する', () => {
  const a = parseArgs(['--out', 'o.json', '--drive', 'D:', 'n=%ROOTX%\\z'], { ROOTX: sb });
  assert.equal(a.out, 'o.json');
  assert.equal(a.drive, 'D:');
  assert.equal(a.entries[0].path, path.resolve(sb, 'z'));
});
test('parseArgs: 誤りは投げる（形でない・場所が無い・知らない -- ・--drive の形・値が無い）', () => {
  assert.throws(() => parseArgs(['noequals'], {}));
  assert.throws(() => parseArgs([], {}));
  assert.throws(() => parseArgs(['--out', 'o.json'], {}), '場所が1つも無い');
  assert.throws(() => parseArgs(['--bogus', 'n=' + sb], {}));
  assert.throws(() => parseArgs(['--drive', 'CC', 'n=' + sb], {}));
  assert.throws(() => parseArgs(['--drive', 'C', 'n=' + sb], {}));
  assert.throws(() => parseArgs(['n=' + sb, '--out'], {}));
});

// ---- countDir -----------------------------------------------------------------------------
test('countDir: hard link を2つ置くと bytes は2倍、uniqueBytes は1倍、hardlinkedFiles は 2', () => {
  const d = path.join(sb, 'hl');
  writeFile(path.join(d, 'a', 'one.bin'), 'x'.repeat(1000));
  fs.mkdirSync(path.join(d, 'b'), { recursive: true });
  fs.linkSync(path.join(d, 'a', 'one.bin'), path.join(d, 'b', 'two.bin'));
  const r = countDir(d);
  assert.equal(r.files, 2);
  assert.equal(r.bytes, 2000);
  assert.equal(r.uniqueBytes, 1000);
  assert.equal(r.hardlinkedFiles, 2);
});
test('countDir: hard link の無いファイルは hardlinkedFiles に入らず、bytes と uniqueBytes が等しい', () => {
  const d = path.join(sb, 'plain');
  writeFile(path.join(d, 'a.txt'), 'abc');
  writeFile(path.join(d, 'sub', 'b.txt'), 'defgh');
  const r = countDir(d);
  assert.deepEqual({ files: r.files, bytes: r.bytes, u: r.uniqueBytes, h: r.hardlinkedFiles }, { files: 2, bytes: 8, u: 8, h: 0 });
});
test('countDir: seen を渡すと、場所をまたいだ重なりは globalBytes に1回だけ入る', () => {
  const a = path.join(sb, 'sa');
  const b = path.join(sb, 'sb');
  writeFile(path.join(a, 'f.bin'), 'x'.repeat(500));
  fs.mkdirSync(b, { recursive: true });
  fs.linkSync(path.join(a, 'f.bin'), path.join(b, 'f.bin'));
  const seen = new Set();
  const ra = countDir(a, seen);
  const rb = countDir(b, seen);
  assert.equal(ra.globalBytes, 500);
  assert.equal(rb.globalBytes, 0);
  assert.equal(rb.bytes, 500);
});
test('countDir: ジャンクションをたどらない（先のファイルを数えない）', () => {
  const target = path.join(sb, 'jt');
  writeFile(path.join(target, 'big.bin'), 'x'.repeat(4096));
  const d = path.join(sb, 'jd');
  writeFile(path.join(d, 'own.txt'), 'abc');
  fs.symlinkSync(target, path.join(d, 'link'), 'junction');
  const r = countDir(d);
  assert.equal(r.files, 1);
  assert.equal(r.bytes, 3);
});
test('countDir: シンボリックリンク（ファイル・フォルダ）をたどらない。作れない環境では skip', (t) => {
  const target = path.join(sb, 'st');
  writeFile(path.join(target, 'big.bin'), 'x'.repeat(4096));
  const d = path.join(sb, 'sd');
  writeFile(path.join(d, 'own.txt'), 'abc');
  try {
    fs.symlinkSync(path.join(target, 'big.bin'), path.join(d, 'flink'), 'file');
    fs.symlinkSync(target, path.join(d, 'dlink'), 'dir');
  } catch (err) {
    t.skip(`シンボリックリンクを作れない: ${err.code}`);
    return;
  }
  const r = countDir(d);
  assert.equal(r.files, 1);
  assert.equal(r.bytes, 3);
});
test('countDir: 読めない・無い場所は 0 を返して落ちない', () => {
  const r = countDir(path.join(sb, 'does-not-exist'));
  assert.deepEqual({ files: r.files, bytes: r.bytes }, { files: 0, bytes: 0 });
});

// ---- disk-usage.mjs の実行 ----------------------------------------------------------------
test('disk-usage.mjs: 数えて JSON を出し、--out にも書く。無い場所は exists:false だけ', () => {
  const d = path.join(sb, 'run');
  writeFile(path.join(d, 'a.bin'), 'x'.repeat(2048));
  fs.linkSync(path.join(d, 'a.bin'), path.join(d, 'b.bin'));
  const out = path.join(sb, 'out', 'du.json');
  const r = runNode([DISK, '--out', out, `real=${d}`, `gone=${path.join(sb, 'nowhere')}`]);
  assert.equal(r.status, 0, r.stderr);
  const j = parseJsonOut(r.stdout);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), j);
  for (const k of ['countedAt', 'seconds', 'drive', 'entries', 'uniqueTotal']) assert.ok(k in j, k);
  assert.ok(j.drive.root && (j.drive.freeBytes > 0 || j.drive.error));
  const [real, gone] = j.entries;
  assert.equal(real.name, 'real');
  assert.equal(real.exists, true);
  assert.equal(real.bytes, 4096);
  assert.equal(real.uniqueBytes, 2048);
  assert.equal(real.hardlinkedFiles, 2);
  assert.equal(real.files, 2);
  assert.ok('gb' in real && 'uniqueGB' in real);
  assert.deepEqual(gone, { name: 'gone', path: path.resolve(sb, 'nowhere'), exists: false });
  assert.equal(j.uniqueTotal.bytes, 2048);
});
test('disk-usage.mjs: 2つの場所の重なり（hard link）は uniqueTotal に1回だけ入る', () => {
  const a = path.join(sb, 'ua');
  const b = path.join(sb, 'ub');
  writeFile(path.join(a, 'f'), 'x'.repeat(700));
  fs.mkdirSync(b, { recursive: true });
  fs.linkSync(path.join(a, 'f'), path.join(b, 'f'));
  const j = parseJsonOut(runNode([DISK, `a=${a}`, `b=${b}`]).stdout);
  assert.equal(j.entries[0].bytes + j.entries[1].bytes, 1400);
  assert.equal(j.uniqueTotal.bytes, 700);
});
test('disk-usage.mjs: %NAME% を環境変数から展開する', () => {
  const d = path.join(sb, 'envrun');
  writeFile(path.join(d, 'f'), 'abc');
  const j = parseJsonOut(runNode([DISK, 'e=%P1_TEST_DIR%'], { env: { P1_TEST_DIR: d } }).stdout);
  assert.equal(j.entries[0].exists, true);
  assert.equal(j.entries[0].bytes, 3);
});
test('disk-usage.mjs: 引数の誤りは終了コード 2（形でない・場所が無い・知らない --・--drive の形）', () => {
  for (const args of [['noequals'], [], ['--out', path.join(sb, 'x.json')], ['--bogus', `n=${sb}`], ['--drive', 'CC', `n=${sb}`]]) {
    const r = runNode([DISK, ...args]);
    assert.equal(r.status, 2, JSON.stringify(args) + ' ' + r.stderr);
    assert.equal(r.stdout, '');
  }
});

// ---- p1-launch-check.ps1（断る所だけ。起動はしない） -------------------------------------------
const BASE_OK = fs.existsSync('C:\\b');
const skipNoCb = BASE_OK ? false : 'C:\\b が無い';
function launch(args) {
  const r = runPs(LAUNCH, args, { timeout: 60000 });
  return r;
}
test('p1-launch-check.ps1: -Zip も -Root も無い → 2', () => {
  const r = launch([]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /exactly one/);
});
test('p1-launch-check.ps1: -Zip と -Root の両方 → 2', () => {
  const zip = path.join(sb, 'a.zip');
  writeFile(zip, 'PK');
  const r = launch(['-Zip', zip, '-Root', sb]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /exactly one/);
});
test('p1-launch-check.ps1: -Zip が無い → 2', () => {
  const r = launch(['-Zip', path.join(sb, 'missing.zip')]);
  assert.equal(r.status, 2, r.stderr);
});
test('p1-launch-check.ps1: -Root が無い場所 → 2', () => {
  const r = launch(['-Root', path.join(sb, 'missing-dir')]);
  assert.equal(r.status, 2, r.stderr);
});
test('p1-launch-check.ps1: -Root が C:\\b\\ の外 → 2（読むだけの C:\\Windows を使う）', () => {
  const r = launch(['-Root', 'C:\\Windows']);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /outside C:\\b/i);
});
test('p1-launch-check.ps1: -Dest が C:\\b\\p1\\ の外（-Zip）→ 2。展開も起動もしない', () => {
  const zip = path.join(sb, 'b.zip');
  writeFile(zip, 'PK');
  const dest = path.join(sb, 'not-p1-dest');
  const r = launch(['-Zip', zip, '-Dest', dest]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /outside C:\\b\\p1/i);
  assert.ok(!fs.existsSync(dest), '何も作らない');
});
test('p1-launch-check.ps1: -Dest が C:\\b\\p1\\ の外（-Root）→ 2', { skip: skipNoCb }, () => {
  const root = path.join(sb, 'fake-root');
  fs.mkdirSync(root, { recursive: true });
  const dest = path.join(sb, 'not-p1-dest2');
  const r = launch(['-Root', root, '-Dest', dest]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /outside C:\\b\\p1/i);
  assert.ok(!fs.existsSync(dest));
});
test('p1-launch-check.ps1: -Dest が C:\\b\\p1 そのもの（直下でない）も断る → 2', { skip: skipNoCb }, () => {
  const zip = path.join(sb, 'c.zip');
  writeFile(zip, 'PK');
  const r = launch(['-Zip', zip, '-Dest', 'C:\\b\\p1']);
  assert.equal(r.status, 2, r.stderr);
});

// ---- p1-ci-events.ps1 ---------------------------------------------------------------------
test('p1-ci-events.ps1: JSON の形（readable・error・since・count・events）と終了コード 0。-OutFile にも同じものを書く', () => {
  const out = path.join(sb, 'ev.json');
  const r = runPs(EVENTS, ['-Minutes', '5', '-OutFile', out], { timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const j = parseJsonOut(r.stdout);
  assert.equal(typeof j.readable, 'boolean');
  for (const k of ['error', 'since', 'count', 'events']) assert.ok(k in j, k);
  assert.equal(typeof j.count, 'number');
  const events = j.events == null ? [] : Array.isArray(j.events) ? j.events : [j.events];
  assert.equal(j.count, events.length);
  assert.ok(!Number.isNaN(Date.parse(j.since)));
  if (!j.readable) assert.ok(j.error, '読めないときは error に理由');
  for (const e of events) {
    assert.ok([3033, 3034, 3076, 3077].includes(e.id), `id ${e.id}`);
    for (const k of ['time', 'file', 'process', 'policy', 'message']) assert.ok(k in e, k);
  }
  // \u6A19\u6E96\u51FA\u529B\u306F OEM \u30B3\u30FC\u30C9\u30DA\u30FC\u30B8\u3067\u8AAD\u3080\u305F\u3081\u65E5\u672C\u8A9E\u306E error \u304C\u5316\u3051\u308B\u3002error \u4EE5\u5916\u3092\u6BD4\u3079\u308B\u3002
  const { error: _e1, ...fromFile } = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, ''));
  const { error: _e2, ...fromStdout } = j;
  assert.deepEqual(fromFile, fromStdout);
});
test('p1-ci-events.ps1: \u5F53\u305F\u308B\u30A4\u30D9\u30F3\u30C8\u304C\u7121\u3044\u3068\u304D readable:true\u30FBcount 0\uFF08\u4ED5\u69D8\u3002\u65E5\u672C\u8A9E\u306E Windows \u3067\u3082\uFF09', () => {
  // 1 \u5206\u9593\u30FB\u5F53\u305F\u3089\u306A\u3044 -Filter\u3002\u30A4\u30D9\u30F3\u30C8\u304C\u3042\u3063\u3066\u3082 Filter \u3067\u5168\u90E8\u5916\u308C\u308B\u306E\u3067\u3001\u300C\u7121\u3044\u300D\u306E\u7D4C\u8DEF\u304B\u300C\u5916\u308C\u305F\u300D\u306E\u7D4C\u8DEF\u306E\u3069\u3061\u3089\u3067\u3082 readable:true \u306B\u306A\u308B\u306F\u305A\u3002
  const r = runPs(EVENTS, ['-Minutes', '1', '-Filter', 'no-such-text-zzqq-91827'], { timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const j = parseJsonOut(r.stdout);
  assert.equal(j.count, 0);
  assert.equal(j.readable, true, '\u8AAD\u3081\u3066\u3044\u308B\u306E\u306B\u30A4\u30D9\u30F3\u30C8\u304C\u7121\u3044\u3060\u3051\u3002error: ' + j.error);
});
test('p1-ci-events.ps1: 当たらない -Filter では count 0、終了コード 0。-Max 1 は 1件まで', () => {
  const r = runPs(EVENTS, ['-Minutes', '1440', '-Filter', 'no-such-text-zzqq-91827'], { timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const j = parseJsonOut(r.stdout);
  assert.equal(j.count, 0);
  const r2 = runPs(EVENTS, ['-Minutes', '1440', '-Max', '1'], { timeout: 120000 });
  assert.equal(r2.status, 0, r2.stderr);
  assert.ok(parseJsonOut(r2.stdout).count <= 1);
});

// ---- check-env.ps1 の smartAppControl -----------------------------------------------------
test('check-env.ps1: smartAppControl があり、meaning は off/on/evaluation/unknown。missing に入らない', () => {
  const out = path.join(sb, 'ce.json');
  const r = runPs(CHECK_ENV, ['-BuildRoot', path.join(sb, 'ce-br'), '-OutFile', out]);
  assert.ok(fs.existsSync(out), `出力が無い (status ${r.status}): ${r.stderr}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, ''));
  assert.ok(j.smartAppControl, 'smartAppControl が無い');
  assert.ok(['off', 'on', 'evaluation', 'unknown'].includes(j.smartAppControl.meaning), j.smartAppControl.meaning);
  const s = j.smartAppControl.verifiedAndReputablePolicyState;
  const expected = { 0: 'off', 1: 'on', 2: 'evaluation' }[s] ?? 'unknown';
  assert.equal(j.smartAppControl.meaning, expected, `state ${s}`);
  if (s === null) assert.equal(j.smartAppControl.meaning, 'unknown');
  const missing = (Array.isArray(j.missing) ? j.missing : []).map(String);
  assert.ok(!missing.some((m) => /smart\s*app|application control|smartAppControl/i.test(m)), JSON.stringify(missing));
  // 終了コードは missing だけで決まる（smartAppControl では変わらない）
  assert.equal(r.status, missing.length === 0 ? 0 : 2);
});

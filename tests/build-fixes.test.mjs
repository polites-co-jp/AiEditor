// build.mjs の toolchainWarnings と apply への --build-root の受け渡し、prepare.mjs の resolveBuildRoot・resolveWorktree、
// configure.ps1 の Update-PathEntries（本物の PATH・レジストリには触れない）のテスト。
// 仕様: tasks/2026-11-13-p2-build-switch/handoff-notes.md の追記2（「テストの入口」）、build-switch-design.md の3節・6節、
//       docs/02 の4節・6.1。
// Run: node --test tests/build-fixes.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { toolchainWarnings } from '../scripts/build.mjs';
import { resolveBuildRoot, resolveWorktree } from '../scripts/prepare.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode, runPs } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-bf-');
});
after(() => removeSandbox(sb));

// ---- toolchainWarnings ----------------------------------------------------------------------
const GOOD = { node: '24.22.1', nvmrc: '24.22.1', packageManager: 'pnpm 12.16.0', packageManagerDeclared: 'pnpm@12.16.0' };
const tw = (o) => toolchainWarnings({ ...GOOD, ...o });

test('toolchainWarnings: node・pnpm とも合えば警告なし', () => {
  assert.deepEqual(tw({}), []);
});
test('toolchainWarnings: node が .nvmrc と違う（マイナーが違う）と1件、メジャーが違っても1件', () => {
  assert.equal(tw({ node: '24.16.0' }).length, 1);
  assert.equal(tw({ node: '26.1.0' }).length, 1);
  assert.match(tw({ node: '24.16.0' })[0], /24\.16\.0/);
  assert.match(tw({ node: '24.16.0' })[0], /24\.22\.1/);
});
test('toolchainWarnings: pnpm が packageManager と違うと1件（古くても新しくても）', () => {
  assert.equal(tw({ packageManager: 'pnpm 11.8.0' }).length, 1);
  assert.equal(tw({ packageManager: 'pnpm 13.0.0' }).length, 1);
  assert.match(tw({ packageManager: 'pnpm 11.8.0' })[0], /11\.8\.0/);
});
test('toolchainWarnings: pnpm の版が分からない（null）と「確かめられない」1件', () => {
  assert.equal(tw({ packageManager: null }).length, 1);
});
test('toolchainWarnings: packageManager が pnpm 以外（npm@...）なら「pnpm 以外」1件', () => {
  const w = tw({ packageManagerDeclared: 'npm@10.0.0' });
  assert.equal(w.length, 1);
  assert.match(w[0], /npm|pnpm/);
});
test('toolchainWarnings: .nvmrc が無ければ node の警告は出さない', () => {
  assert.deepEqual(tw({ nvmrc: null, node: '20.0.0' }), []);
  assert.deepEqual(tw({ nvmrc: undefined, node: '20.0.0' }), []);
});
test('toolchainWarnings: 両方が違えば2件。入力は変えない', () => {
  const t = { ...GOOD, node: '24.16.0', packageManager: 'pnpm 11.8.0' };
  const copy = { ...t };
  assert.equal(toolchainWarnings(t).length, 2);
  assert.deepEqual(t, copy);
});

// ---- prepare.mjs: resolveBuildRoot / resolveWorktree ----------------------------------------
const cfgFile = (name, text) => {
  const p = path.join(sb, name);
  fs.writeFileSync(p, text);
  return p;
};

test('resolveBuildRoot: オプション → local.json → 既定 C:\\b', () => {
  const none = path.join(sb, 'nope.json');
  assert.equal(resolveBuildRoot(undefined, { configPath: none }), 'C:\\b');
  const c = cfgFile('rb1.json', JSON.stringify({ buildRoot: 'E:\\bb\\' }));
  assert.equal(resolveBuildRoot(undefined, { configPath: c }), 'E:\\bb', '末尾の \\ は外す');
  assert.equal(resolveBuildRoot('F:\\opt', { configPath: c }), 'F:\\opt', 'オプションが local.json に勝つ');
});
test('resolveBuildRoot: 共通の部品と同じ規則（知らないキー・型・知らない %NAME%・相対パス・壊れた JSON は例外）', () => {
  for (const [name, text] of [
    ['k', '{"foo": 1}'],
    ['c', '{"InstallRoot": "C:\\\\x"}'],
    ['t', '{"keepVersions": "3"}'],
    ['e', '{"buildRoot": "%NO_SUCH_VAR_SHUKO%\\\\x"}'],
    ['r', '{"buildRoot": "relative\\\\x"}'],
    ['j', '{"buildRoot": "C:\\\\b",}'],
  ]) {
    assert.throws(() => resolveBuildRoot(undefined, { configPath: cfgFile(`rb-${name}.json`, text) }), undefined, name);
  }
  assert.throws(() => resolveBuildRoot('relative\\dir', { configPath: path.join(sb, 'nope.json') }), undefined, 'オプションの相対パス');
});
test('resolveWorktree: --worktree が無ければ <buildRoot>\\wt\\<tag>、あればその絶対パス', () => {
  assert.equal(resolveWorktree('C:\\b', '1.146.0'), 'C:\\b\\wt\\1.146.0');
  assert.equal(resolveWorktree('C:\\b', '1.146.0', undefined), 'C:\\b\\wt\\1.146.0');
  assert.equal(resolveWorktree('C:\\b', '1.146.0', ''), 'C:\\b\\wt\\1.146.0');
  assert.equal(resolveWorktree('C:\\b', '1.146.0', 'D:\\w\\x'), 'D:\\w\\x');
  assert.equal(path.isAbsolute(resolveWorktree('C:\\b', '1.146.0', 'rel\\wt')), true);
});
test('prepare.mjs --config <誤りのある local.json> は終了コード 1（git に触れずに止まる）', () => {
  const bad = cfgFile('prep-bad.json', '{"InstallRoot": "C:\\\\x"}');
  const r = runNode(['scripts/prepare.mjs', '--tag', '1.146.0', '--config', bad, '--out', path.join(sb, 'prep.json')]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(path.join(sb, 'prep.json')));
});

// ---- build.mjs: 作業ツリーと apply への --build-root の受け渡し（--dry-run の plan） -----------------
function dry(extra) {
  const cfg = path.join(sb, 'bf-cfg.json');
  return runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, ...extra], { env: { LOCALAPPDATA: path.join(sb, 'LocalAppData') } });
}
const jsonOf = (s) => JSON.parse(s.slice(s.search(/^\{/m)));
const argsOf = (step) => (step && (step.args || step.argv)) || [];

test('--dry-run: prepare に --worktree と --out（<作業ツリー>.prepare.json）が渡る。--fresh と apply も同じ作業ツリー', () => {
  const wt = path.join(sb, 'wt', 'custom');
  const r = dry(['--build-root', path.join(sb, 'br'), '--worktree', wt, '--fresh', '--to', 'apply']);
  assert.equal(r.status, 0, r.stderr);
  const j = jsonOf(r.stdout);
  const prep = JSON.stringify(j.plan.prepare);
  assert.ok(prep.includes('--worktree'), prep);
  assert.ok(prep.toLowerCase().includes(wt.toLowerCase().replace(/\\/g, '\\\\')), prep);
  assert.ok(prep.includes('.prepare.json'), prep);
  assert.ok(JSON.stringify(j.plan.apply).toLowerCase().includes(wt.toLowerCase().replace(/\\/g, '\\\\')));
  assert.ok(JSON.stringify(j.plan).toLowerCase().includes('worktree remove'), '--fresh は同じ場所を消す');
});
test('--dry-run: --worktree が無ければ <buildRoot>\\wt\\<tag>', () => {
  const br = path.join(sb, 'br2');
  const j = jsonOf(dry(['--build-root', br, '--to', 'apply']).stdout);
  assert.equal(path.resolve(j.paths.worktree).toLowerCase(), path.join(br, 'wt', '1.146.0').toLowerCase());
});
test('--dry-run: apply と lockfile の手順に --build-root が渡る（値は使う buildRoot）', () => {
  const br = path.join(sb, 'br3');
  const j = jsonOf(dry(['--build-root', br, '--to', 'lockfile']).stdout);
  for (const step of ['apply', 'lockfile']) {
    // plan の各手順は { command: "<node> <台本> <引数...>", cwd }（引数の配列でも受ける）
    const p = j.plan[step];
    const line = typeof p.command === 'string' ? p.command : argsOf(p).join(' ');
    const m = /--build-root\s+("[^"]+"|\S+)/.exec(line);
    assert.ok(m, `${step} の引数に --build-root が無い: ${line}`);
    assert.equal(path.resolve(m[1].replace(/^"|"$/g, '')).toLowerCase(), path.resolve(br).toLowerCase(), step);
  }
});
test('--dry-run: warnings に toolchain の警告が入りうる（node・pnpm の版が .nvmrc・packageManager と違うとき）。止めない', () => {
  const r = dry(['--build-root', path.join(sb, 'br4'), '--to', 'apply']);
  assert.equal(r.status, 0);
  const j = jsonOf(r.stdout);
  assert.ok(Array.isArray(j.warnings));
  // 警告があるときは toolchainWarnings と同じ文言の系統
  for (const w of j.warnings.filter((x) => /nvmrc|packageManager|pnpm/.test(x))) assert.equal(typeof w, 'string');
});

// ---- configure.ps1: Update-PathEntries（台本から関数だけを取り出して試す） ------------------------
const PROBE = path.join(REPO, 'tests', 'build', 'path-entries-probe.ps1');
const CONFIGURE = path.join(REPO, 'scripts', 'configure.ps1');
const OLD = 'C:\\old\\current\\bin';
const NEW = 'C:\\new\\current\\bin';
const PATH_CASES = [
  { name: '前の bin を新しい bin に。ほかの項目と %VAR% の形は残す', raw: '%USERPROFILE%\\bin;C:\\old\\current\\bin;C:\\x', expect: '%USERPROFILE%\\bin;C:\\new\\current\\bin;C:\\x' },
  { name: '大文字小文字と末尾の \\ を問わない', raw: 'C:\\x;C:\\OLD\\current\\bin\\', expect: 'C:\\x;C:\\new\\current\\bin' },
  { name: '%FOO%\\current\\bin は FOO を展開して一致すれば置き換える', raw: 'C:\\x;%SHUKO_T_FOO%\\current\\bin', env: { SHUKO_T_FOO: 'C:\\old' }, expect: 'C:\\x;C:\\new\\current\\bin' },
  { name: '一致が無ければ null（変えない）', raw: 'C:\\a;C:\\b;%USERPROFILE%\\bin', expect: null },
  { name: 'Raw が空なら null', raw: '', expect: null },
  { name: '別の版の bin（前の bin の一部）は置き換えない', raw: 'C:\\old\\current\\bin2;C:\\old\\current', expect: null },
  { name: '前の bin が2か所あれば両方', raw: 'C:\\old\\current\\bin;C:\\y;C:\\old\\current\\bin', expect: 'C:\\new\\current\\bin;C:\\y;C:\\new\\current\\bin' },
  { name: '空の項目と区切りの形を保つ', raw: 'C:\\x;;C:\\old\\current\\bin;', expect: 'C:\\x;;C:\\new\\current\\bin;' },
  { name: '前後に空白のある項目も一致する', raw: 'C:\\x; C:\\old\\current\\bin ', expect: 'C:\\x;C:\\new\\current\\bin' },
];

test('Update-PathEntries: 規則（試しの入力だけ。本物の PATH・レジストリは読まない・書かない）', () => {
  const cases = PATH_CASES.map((c) => ({ raw: c.rawUse ?? c.raw, old: OLD, new: NEW, env: c.env }));
  const file = path.join(sb, 'path-cases.json');
  writeFile(file, JSON.stringify(cases));
  const r = runPs(PROBE, ['-ScriptPath', CONFIGURE, '-CasesPath', file]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.equal(out.length, PATH_CASES.length);
  const diffs = [];
  PATH_CASES.forEach((c, i) => {
    const got = out[i].result;
    if (got !== c.expect) diffs.push(`${c.name}: expected ${JSON.stringify(c.expect)} got ${JSON.stringify(got)}`);
  });
  assert.deepEqual(diffs, []);
});

test('configure.ps1: 台本の中で PATH を書くのは HKCU\\Environment の生の値（種類を保つ）だけで、SetEnvironmentVariable を使わない', () => {
  const src = fs.readFileSync(CONFIGURE, 'utf8');
  assert.ok(!/SetEnvironmentVariable\(\s*'Path'/i.test(src), "[Environment]::SetEnvironmentVariable('Path', ...) は REG_EXPAND_SZ を展開した REG_SZ にする恐れがある");
  assert.ok(/DoNotExpandEnvironmentNames/.test(src), '読むときに %VAR% を展開しない');
  assert.ok(/GetValueKind\('Path'\)/.test(src), '種類を読む');
  assert.ok(/SetValue\('Path',\s*\$Value,\s*\$Kind\)/.test(src), '同じ種類で書き戻す');
});

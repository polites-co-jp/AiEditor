// Tests for the pure functions of scripts/build.mjs and for its --dry-run output.
// Spec: docs/02 section 4 and 8; tasks/2026-11-13-p2-build-switch/build-switch-design.md section 3 (3.2, 3.3).
// Run: node --test tests/build-parts.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STEPS,
  ArgError,
  parseArgs,
  selectSteps,
  nextLabel,
  childEnv,
  appliedUnitsFrom,
  parseExcludedExtensions,
  checkBuiltinExtensions,
  findAppDir,
  resolveEditorLayout,
  zipFolderName,
  quoteCmdArg,
} from '../scripts/build.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode, makeFakeEditor } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-bp-');
});
after(() => removeSandbox(sb));

test('STEPS: the eight steps in order', () => {
  assert.deepEqual([...STEPS], ['prepare', 'apply', 'install', 'lockfile', 'typecheck', 'package', 'postprocess', 'zip']);
});

// ---- selectSteps ------------------------------------------------------------------------
test('selectSteps: both ends open gives all steps', () => {
  assert.deepEqual(selectSteps(null, null), [...STEPS]);
});
test('selectSteps: from only / to only / same step / inclusive ends', () => {
  assert.deepEqual(selectSteps('postprocess', null), ['postprocess', 'zip']);
  assert.deepEqual(selectSteps(null, 'apply'), ['prepare', 'apply']);
  assert.deepEqual(selectSteps('install', 'install'), ['install']);
  assert.deepEqual(selectSteps('apply', 'typecheck'), ['apply', 'install', 'lockfile', 'typecheck']);
  assert.deepEqual(selectSteps('zip', null), ['zip']);
  assert.deepEqual(selectSteps(null, 'prepare'), ['prepare']);
});

// ---- nextLabel --------------------------------------------------------------------------
test('nextLabel: max + 1 of <tag>-<number> only', () => {
  assert.equal(nextLabel('1.146.0', ['1.146.0-1', '1.146.0-3', '1.146.0-x', '1.145.0-9']), '1.146.0-4');
});
test('nextLabel: empty list gives -1; other tags and non-numbers are ignored', () => {
  assert.equal(nextLabel('1.146.0', []), '1.146.0-1');
  assert.equal(nextLabel('1.146.0', ['1.145.0-9', 'x-1', '1.146.0-t0', '1.146.0-1b']), '1.146.0-1');
});
test('nextLabel: numeric (not string) maximum', () => {
  assert.equal(nextLabel('1.146.0', ['1.146.0-9', '1.146.0-10', '1.146.0-2']), '1.146.0-11');
});
test('nextLabel: the tag "1.146.0" does not match labels of "1.146.01" or a prefix', () => {
  assert.equal(nextLabel('1.146.0', ['1.146.01-7', '11.146.0-7']), '1.146.0-1');
});

// ---- zipFolderName ----------------------------------------------------------------------
test('zipFolderName', () => {
  assert.equal(zipFolderName('Shuko', '1.146.0-1'), 'Shuko-win32-x64-1.146.0-1');
  assert.equal(zipFolderName('Code - OSS', '1.146.0-1'), 'Code-OSS-win32-x64-1.146.0-1');
  assert.equal(zipFolderName('Code', '1.146.0-t1'), 'Code-win32-x64-1.146.0-t1');
  // dots and alphanumerics stay
  assert.match(zipFolderName('Sh.uko2', 'L'), /^Sh\.uko2-win32-x64-L$/);
  // never contains a space
  assert.ok(!/\s/.test(zipFolderName('A B  C', 'L')));
});

// ---- quoteCmdArg ------------------------------------------------------------------------
test('quoteCmdArg: safe characters stay as they are', () => {
  for (const s of ['abc', 'C:\\a\\b.txt', 'a_b-c.d', 'x/y', 'k=v', 'a@b', 'C:/b/wt/1.146.0']) assert.equal(quoteCmdArg(s), s);
});
test('quoteCmdArg: others are wrapped in double quotes; a double quote throws', () => {
  assert.equal(quoteCmdArg('a b'), '"a b"');
  assert.equal(quoteCmdArg('a&b'), '"a&b"');
  assert.equal(quoteCmdArg('a|b'), '"a|b"');
  assert.equal(quoteCmdArg('50%'), '"50%"');
  assert.throws(() => quoteCmdArg('a"b'));
});

// ---- childEnv ---------------------------------------------------------------------------
test('childEnv: removes ELECTRON_RUN_AS_NODE, ELECTRON_NO_ATTACH_CONSOLE and VSCODE_*; reports names only', () => {
  const base = {
    PATH: 'C:\\x',
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    VSCODE_PID: '123',
    VSCODE_IPC_HOOK: 'h',
    KEEP_ME: 'yes',
  };
  const r = childEnv(base, {});
  assert.equal(r.env.PATH, 'C:\\x');
  assert.equal(r.env.KEEP_ME, 'yes');
  for (const k of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE', 'VSCODE_PID', 'VSCODE_IPC_HOOK']) assert.ok(!(k in r.env), k);
  assert.deepEqual([...r.removed].sort(), ['ELECTRON_NO_ATTACH_CONSOLE', 'ELECTRON_RUN_AS_NODE', 'VSCODE_IPC_HOOK', 'VSCODE_PID']);
  assert.ok(!JSON.stringify(r.removed).includes('123'), 'values must not be reported');
  assert.equal(base.VSCODE_PID, '123', 'the base object is not changed');
});
test('childEnv: extra values are added', () => {
  const r = childEnv({ A: '1' }, { B: '2' });
  assert.equal(r.env.A, '1');
  assert.equal(r.env.B, '2');
  assert.deepEqual([...r.removed], []);
});

// ---- appliedUnitsFrom -------------------------------------------------------------------
test('appliedUnitsFrom: from checks.json, units with applied "ok" only', () => {
  const checks = { units: [{ id: 'A-1', applied: 'ok' }, { id: 'A-2', applied: 'skipped' }, { id: 'A-3', applied: 'ok' }] };
  // unit.json files differ from checks.json (Z-1 is enabled there but was not applied: it must not count)
  const r = appliedUnitsFrom(checks, [{ id: 'A-1', enabled: false, delete: ['extensions/a'] }, { id: 'A-2', enabled: true }, { id: 'A-3', enabled: true }, { id: 'Z-1', enabled: true }]);
  assert.deepEqual([...r.ids].sort(), ['A-1', 'A-3']);
  assert.ok(!JSON.stringify(r.units).includes('Z-1'));
  assert.ok(typeof r.source === 'string' && r.source.length > 0);
});
test('appliedUnitsFrom: without checks.json uses unit.json with enabled: true', () => {
  const r = appliedUnitsFrom(null, [{ id: 'A-1', enabled: true }, { id: 'A-2', enabled: false }, { id: 'B-1', enabled: true }]);
  assert.deepEqual([...r.ids].sort(), ['A-1', 'B-1']);
  const r2 = appliedUnitsFrom({ units: [{ id: 'A-9', applied: 'ok' }] }, []);
  assert.notEqual(r.source, r2.source, 'the source tells which of the two was used');
});
test('appliedUnitsFrom: nothing applied gives empty', () => {
  assert.deepEqual([...appliedUnitsFrom({ units: [] }, [{ id: 'A-1', enabled: true }]).ids], []);
  assert.deepEqual([...appliedUnitsFrom(null, [{ id: 'A-1', enabled: false }]).ids], []);
});

// ---- parseExcludedExtensions ------------------------------------------------------------
test('parseExcludedExtensions: reads the array from build/lib/extensions.ts', () => {
  const ts = `import x from 'y';\n\nconst excludedExtensions = [\n\t'vscode-api-tests',\n\t'vscode-colorize-tests',\n\t'vscode-test-resolver',\n\t'ms-vscode.node-debug',\n];\n\nconst other = ['a'];\n`;
  assert.deepEqual(parseExcludedExtensions(ts), ['vscode-api-tests', 'vscode-colorize-tests', 'vscode-test-resolver', 'ms-vscode.node-debug']);
});
test('parseExcludedExtensions: null when there is no such array', () => {
  assert.equal(parseExcludedExtensions("const foo = ['a'];"), null);
  assert.equal(parseExcludedExtensions(''), null);
});

// ---- checkBuiltinExtensions -------------------------------------------------------------
const inputs = (o) => ({ present: [], removed: [], keep: [], excluded: [], own: [], ...o });

test('checkBuiltinExtensions: all good', () => {
  const r = checkBuiltinExtensions(inputs({ present: ['git', 'mydist', 'theme-defaults'], removed: ['copilot'], keep: ['git', 'theme-defaults'], own: ['mydist'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.residual, []);
  assert.deepEqual(r.missingKeep, []);
  assert.deepEqual(r.missingOwn, []);
  assert.deepEqual(r.unexpected, []);
});
test('checkBuiltinExtensions: a removed extension that is still present is residual', () => {
  const r = checkBuiltinExtensions(inputs({ present: ['git', 'copilot', 'mydist'], removed: ['copilot', 'grunt'], keep: ['git'], own: ['mydist'] }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.residual, ['copilot']);
});
test('checkBuiltinExtensions: kept but missing is missingKeep; kept and excluded (not shipped upstream) is notShipped and not an error', () => {
  const r = checkBuiltinExtensions(
    inputs({ present: ['git', 'mydist'], keep: ['git', 'theme-defaults', 'vscode-test-resolver'], excluded: ['vscode-test-resolver'], own: ['mydist'] }),
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingKeep, ['theme-defaults']);
  assert.deepEqual(r.notShipped, ['vscode-test-resolver']);
});
test('checkBuiltinExtensions: only notShipped missing is still ok', () => {
  const r = checkBuiltinExtensions(inputs({ present: ['git', 'mydist'], keep: ['git', 'vscode-test-resolver'], excluded: ['vscode-test-resolver'], own: ['mydist'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.missingKeep, []);
  assert.deepEqual(r.notShipped, ['vscode-test-resolver']);
});
test('checkBuiltinExtensions: a missing own extension (mydist) is an error', () => {
  const r = checkBuiltinExtensions(inputs({ present: ['git'], keep: ['git'], own: ['mydist'] }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingOwn, ['mydist']);
});
test('checkBuiltinExtensions: present but in neither keep nor own is only information (unexpected), not an error', () => {
  const r = checkBuiltinExtensions(inputs({ present: ['git', 'mydist', 'ms-vscode.js-debug'], keep: ['git'], own: ['mydist'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.unexpected, ['ms-vscode.js-debug']);
});

// ---- findAppDir / resolveEditorLayout ---------------------------------------------------
test('findAppDir: resources\\app directly under the root', () => {
  const d = path.join(sb, 'flat');
  makeFakeEditor(d);
  const r = findAppDir(d);
  assert.equal(path.resolve(r.appDir).toLowerCase(), path.resolve(d, 'resources', 'app').toLowerCase());
  assert.ok(!r.versionedFolder, 'no versioned folder');
});
test('findAppDir: one level down in the commit-prefix folder', () => {
  const d = path.join(sb, 'nested');
  makeFakeEditor(d, { nested: true });
  const r = findAppDir(d);
  assert.equal(path.resolve(r.appDir).toLowerCase(), path.resolve(d, '69047191fc', 'resources', 'app').toLowerCase());
  assert.ok(String(r.versionedFolder).endsWith('69047191fc'));
});
test('findAppDir: nothing found or two found throws', () => {
  const none = path.join(sb, 'none');
  fs.mkdirSync(none, { recursive: true });
  assert.throws(() => findAppDir(none));
  const two = path.join(sb, 'two');
  writeFile(path.join(two, 'aaaaaaaaaa', 'resources', 'app', 'product.json'), '{}');
  writeFile(path.join(two, 'bbbbbbbbbb', 'resources', 'app', 'product.json'), '{}');
  assert.throws(() => findAppDir(two));
});
test('resolveEditorLayout: reads product.json and package.json, finds exe and cli', () => {
  const d = path.join(sb, 'layout');
  makeFakeEditor(d, { version: '1.146.0', nameShort: 'Shuko', applicationName: 'shuko', dataFolderName: '.shuko' });
  const r = resolveEditorLayout(d);
  assert.equal(r.nameShort, 'Shuko');
  assert.equal(r.applicationName, 'shuko');
  assert.equal(r.dataFolderName, '.shuko');
  assert.equal(r.version, '1.146.0');
  assert.equal(r.commit, '69047191fc427f2f92828279aae1d90d8eeda7ab');
  assert.ok(String(r.exe).toLowerCase().endsWith('shuko.exe'));
  assert.ok(String(r.cli).toLowerCase().endsWith(path.join('bin', 'shuko.cmd').toLowerCase()));
  assert.ok(fs.existsSync(r.exe) && fs.existsSync(r.cli));
});
test('resolveEditorLayout: the version comes from resources\\app\\package.json, product.json is the fallback', () => {
  const d = path.join(sb, 'layout-ver');
  makeFakeEditor(d, { version: '1.146.0' });
  fs.writeFileSync(path.join(d, 'resources', 'app', 'package.json'), JSON.stringify({ version: '9.9.9' }));
  assert.equal(resolveEditorLayout(d).version, '9.9.9');
  fs.rmSync(path.join(d, 'resources', 'app', 'package.json'));
  assert.equal(resolveEditorLayout(d).version, '1.146.0');
});

// ---- parseArgs --------------------------------------------------------------------------
test('parseArgs: a plain tag is accepted; the options with values are accepted', () => {
  assert.doesNotThrow(() => parseArgs(['1.146.0']));
  assert.doesNotThrow(() => parseArgs(['1.146.0', '--label', '1.146.0-2', '--dry-run', '--from', 'apply', '--to', 'zip', '--fresh', '--force-zip', '--no-size']));
  assert.doesNotThrow(() => parseArgs(['1.146.0', '--build-root', 'C:\\b', '--config', 'x.json', '--record', 'r.json', '--worktree', 'w', '--package-dir', 'p', '--keep', 'k.json', '--removals', 'r', '--take-in-dir', 't']));
});
test('parseArgs: errors are ArgError', () => {
  const bad = [
    [],
    ['1.146.0', '1.147.0'],
    ['1.146.0', '--no-such-option'],
    ['1.146.0', '--label'],
    ['1.146.0', '--from', 'nope'],
    ['1.146.0', '--to', 'nope'],
    ['1.146.0', '--from', 'zip', '--to', 'apply'],
    ['not a tag'],
    ['1.146.0', '--label', 'bad label'],
  ];
  for (const argv of bad) {
    assert.throws(() => parseArgs(argv), (e) => e instanceof ArgError, JSON.stringify(argv));
  }
});
test('parseArgs: from equal to to is accepted', () => {
  assert.doesNotThrow(() => parseArgs(['1.146.0', '--from', 'apply', '--to', 'apply']));
});

// ---- --dry-run output -------------------------------------------------------------------
function dryRun(extra, cfgText) {
  const cfg = path.join(sb, `cfg-${Math.random().toString(16).slice(2)}.json`);
  if (cfgText != null) fs.writeFileSync(cfg, cfgText);
  const args = ['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, ...extra];
  return runNode(args, { env: { LOCALAPPDATA: path.join(sb, 'LocalAppData') } });
}
const jsonOf = (stdout) => JSON.parse(stdout.slice(stdout.search(/^\{/m)));

test('--dry-run: exit 0, JSON with result "dry-run", dryRun, plan and checksBeforeRun; nothing is written', () => {
  const before = fs.existsSync(path.join(REPO, 'records', 'builds')) ? fs.readdirSync(path.join(REPO, 'records', 'builds')).sort() : [];
  const r = dryRun(['--build-root', path.join(sb, 'br')], null);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = jsonOf(r.stdout);
  assert.equal(j.result, 'dry-run');
  assert.equal(j.dryRun, true);
  assert.deepEqual(j.stepsSelected, [...STEPS]);
  assert.ok(j.plan, 'plan');
  assert.ok(j.checksBeforeRun, 'checksBeforeRun');
  assert.equal(j.upstream.tag, '1.146.0');
  assert.match(j.label, /^1\.146\.0-\d+$/);
  const after = fs.existsSync(path.join(REPO, 'records', 'builds')) ? fs.readdirSync(path.join(REPO, 'records', 'builds')).sort() : [];
  assert.deepEqual(after, before, 'no record file without --record');
  assert.ok(!fs.existsSync(path.join(sb, 'br', 'wt')), 'nothing created in the build root');
});
test('--dry-run: --build-root is the "option" source; a local.json value is "local.json"; none is "default"', () => {
  let j = jsonOf(dryRun(['--build-root', path.join(sb, 'o')], null).stdout);
  assert.equal(j.config.buildRootFrom, 'option');
  const lj = path.join(sb, 'from-local');
  j = jsonOf(dryRun([], JSON.stringify({ buildRoot: lj })).stdout);
  assert.equal(j.config.buildRootFrom, 'local.json');
  assert.equal(j.config.exists, true);
  assert.equal(path.resolve(j.paths.buildRoot).toLowerCase(), path.resolve(lj).toLowerCase());
  j = jsonOf(dryRun([], null).stdout);
  assert.equal(j.config.buildRootFrom, 'default');
  assert.equal(j.config.exists, false);
  assert.equal(path.resolve(j.paths.buildRoot).toLowerCase(), 'c:\\b');
});
test('--dry-run: --from and --to select the steps; the plan has one entry per selected step', () => {
  const r = dryRun(['--build-root', path.join(sb, 'br2'), '--from', 'apply', '--to', 'lockfile'], null);
  assert.equal(r.status, 0, r.stderr);
  const j = jsonOf(r.stdout);
  assert.deepEqual(j.stepsSelected, ['apply', 'install', 'lockfile']);
  const keys = Array.isArray(j.plan) ? j.plan.map((p) => p.name ?? p.step) : Object.keys(j.plan);
  assert.deepEqual([...keys].sort(), ['apply', 'install', 'lockfile']);
});
test('--dry-run: --label is used as given; the default label is <tag>-<n>', () => {
  const j = jsonOf(dryRun(['--build-root', path.join(sb, 'br3'), '--label', '1.146.0-77'], null).stdout);
  assert.equal(j.label, '1.146.0-77');
});
test('--dry-run: --record writes the same kind of JSON to the file', () => {
  const rec = path.join(sb, 'rec.json');
  const r = dryRun(['--build-root', path.join(sb, 'br4'), '--record', rec], null);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(rec));
  const j = JSON.parse(fs.readFileSync(rec, 'utf8'));
  assert.equal(j.result, 'dry-run');
});
test('--dry-run: an invalid local.json stops (exit 1, nothing planned)', () => {
  const r = dryRun([], '{"InstallRoot": "C:\\\\x"}');
  assert.notEqual(r.status, 0);
  assert.ok(!/"result":\s*"dry-run"/.test(r.stdout));
});
test('exit code 2 for argument errors: no tag, unknown option, --from after --to', () => {
  for (const argv of [[], ['1.146.0', '--bogus'], ['1.146.0', '--from', 'zip', '--to', 'apply']]) {
    const r = runNode(['scripts/build.mjs', ...argv, '--dry-run']);
    assert.equal(r.status, 2, JSON.stringify(argv) + r.stderr + r.stdout);
  }
});

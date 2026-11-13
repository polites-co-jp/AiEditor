// Tests for scripts/lib/local-config.mjs and scripts/lib/local-config.ps1.
// Spec: docs/02 section 6.1 and section 8; tasks/2026-11-13-p2-build-switch/build-switch-design.md section 2.
// The same input must give the same accept/reject in Node.js and PowerShell.
// Run: node --test tests/local-config.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULTS,
  KNOWN_KEYS,
  localConfigPath,
  expandEnv,
  parseLocalConfig,
  validateLocalConfig,
  resolveLocalConfig,
} from '../scripts/lib/local-config.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs } from './build/helpers.mjs';

let sb;
const ENV = { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local', SHUKO_T_ROOT: 'D:\\base' };
const PROBE = path.join(REPO, 'tests', 'build', 'local-config-probe.ps1');
const LIB_PS = path.join(REPO, 'scripts', 'lib', 'local-config.ps1');

before(() => {
  sb = makeSandbox('tests-lc-');
});
after(() => removeSandbox(sb));

const norm = (s) => (s == null ? s : String(s));

// ---- Node.js-only pieces ----------------------------------------------------------------
test('DEFAULTS and KNOWN_KEYS', () => {
  assert.deepEqual([...KNOWN_KEYS].sort(), ['buildRoot', 'builderRepo', 'installRoot', 'keepVersions']);
  assert.equal(DEFAULTS.keepVersions, 3);
  assert.equal(DEFAULTS.buildRoot, 'C:\\b');
  assert.equal(DEFAULTS.installRoot, '%LOCALAPPDATA%\\Programs\\Shuko');
  assert.ok(DEFAULTS.builderRepo == null);
});

test('localConfigPath: <LOCALAPPDATA>\\Shuko\\local.json, throws without LOCALAPPDATA', () => {
  assert.equal(localConfigPath({ LOCALAPPDATA: 'C:\\L' }).toLowerCase(), 'c:\\l\\shuko\\local.json');
  assert.throws(() => localConfigPath({}));
});

test('expandEnv: expands %NAME% (name case-insensitive), unknown name throws', () => {
  assert.equal(expandEnv('%SHUKO_T_ROOT%\\x', ENV), 'D:\\base\\x');
  assert.equal(expandEnv('%shuko_t_root%\\x', ENV), 'D:\\base\\x');
  assert.equal(expandEnv('plain', ENV), 'plain');
  assert.throws(() => expandEnv('%NO_SUCH_VAR_SHUKO%\\x', ENV));
});

test('parseLocalConfig: strips a leading BOM; invalid JSON throws', () => {
  assert.deepEqual(parseLocalConfig('\uFEFF{"keepVersions": 2}', 'x'), { keepVersions: 2 });
  assert.throws(() => parseLocalConfig('{"keepVersions": 2,}', 'x'));
  assert.throws(() => parseLocalConfig('', 'x'));
});

test('validateLocalConfig: empty array when valid, strings when not', () => {
  assert.deepEqual(validateLocalConfig({}), []);
  assert.deepEqual(validateLocalConfig({ installRoot: 'C:\\x', keepVersions: 2, builderRepo: null, buildRoot: 'C:\\b' }), []);
  const errs = validateLocalConfig({ InstallRoot: 'C:\\x' });
  assert.ok(Array.isArray(errs) && errs.length >= 1);
  assert.equal(typeof errs[0], 'string');
  assert.ok(validateLocalConfig([]).length >= 1);
  assert.ok(validateLocalConfig(null).length >= 1);
  assert.ok(validateLocalConfig('x').length >= 1);
});

test('resolveLocalConfig: missing file gives defaults, all sources "default"', () => {
  const r = resolveLocalConfig({ configPath: path.join(sb, 'nope', 'local.json'), overrides: {}, env: ENV });
  assert.equal(r.installRoot, 'C:\\Users\\tester\\AppData\\Local\\Programs\\Shuko');
  assert.equal(r.keepVersions, 3);
  assert.equal(r.builderRepo, null);
  assert.equal(r.buildRoot, 'C:\\b');
  assert.equal(r.configExists, false);
  for (const k of ['installRoot', 'keepVersions', 'builderRepo', 'buildRoot']) assert.equal(r.sources[k], 'default', k);
});

test('resolveLocalConfig: precedence option > local.json > default, with sources', () => {
  const p = path.join(sb, 'prec.json');
  writeFile(p, '{"keepVersions": 5, "buildRoot": "E:\\\\bb"}');
  const r = resolveLocalConfig({ configPath: p, overrides: { buildRoot: 'F:\\opt' }, env: ENV });
  assert.equal(r.buildRoot, 'F:\\opt');
  assert.equal(r.sources.buildRoot, 'option');
  assert.equal(r.keepVersions, 5);
  assert.equal(r.sources.keepVersions, 'local.json');
  assert.equal(r.sources.installRoot, 'default');
  assert.equal(r.configExists, true);
  assert.equal(path.resolve(r.configPath).toLowerCase(), path.resolve(p).toLowerCase());
});

test('resolveLocalConfig: an invalid option value throws', () => {
  assert.throws(() => resolveLocalConfig({ configPath: path.join(sb, 'nope.json'), overrides: { buildRoot: 'relative\\dir' }, env: ENV }));
});

// ---- shared cases: Node.js and PowerShell must agree --------------------------------------
// text: file content (null = no file). ok: expected accept. exp: expected resolved values (when ok).
const CASES = [
  { name: 'no file', text: null, ok: true, exp: { keepVersions: 3, builderRepo: null, buildRoot: 'C:\\b' } },
  { name: 'empty object', text: '{}', ok: true, exp: { keepVersions: 3, buildRoot: 'C:\\b' } },
  { name: 'BOM before object', text: '\uFEFF{"keepVersions": 4}', ok: true, exp: { keepVersions: 4 } },
  { name: 'wrong-case key InstallRoot', text: '{"InstallRoot": "C:\\\\x"}', ok: false },
  { name: 'unknown key', text: '{"foo": 1}', ok: false },
  { name: 'keepVersions string', text: '{"keepVersions": "3"}', ok: false },
  { name: 'keepVersions 0', text: '{"keepVersions": 0}', ok: false },
  { name: 'keepVersions negative', text: '{"keepVersions": -1}', ok: false },
  { name: 'keepVersions 1.5', text: '{"keepVersions": 1.5}', ok: false },
  { name: 'keepVersions true', text: '{"keepVersions": true}', ok: false },
  { name: 'keepVersions 1 (lower bound)', text: '{"keepVersions": 1}', ok: true, exp: { keepVersions: 1 } },
  { name: 'keepVersions 10', text: '{"keepVersions": 10}', ok: true, exp: { keepVersions: 10 } },
  { name: 'installRoot empty string', text: '{"installRoot": ""}', ok: false },
  { name: 'installRoot number', text: '{"installRoot": 5}', ok: false },
  { name: 'buildRoot empty string', text: '{"buildRoot": ""}', ok: false },
  { name: 'builderRepo null', text: '{"builderRepo": null}', ok: true, exp: { builderRepo: null } },
  { name: 'builderRepo empty string', text: '{"builderRepo": ""}', ok: false },
  { name: 'builderRepo path', text: '{"builderRepo": "E:\\\\develop\\\\shuko"}', ok: true, exp: { builderRepo: 'E:\\develop\\shuko' } },
  { name: 'unknown %NAME%', text: '{"installRoot": "%NO_SUCH_VAR_SHUKO%\\\\x"}', ok: false },
  { name: 'relative path', text: '{"installRoot": "relative\\\\path"}', ok: false },
  { name: 'drive-relative path', text: '{"buildRoot": "C:foo"}', ok: false },
  { name: 'drive root keeps backslash', text: '{"buildRoot": "C:\\\\"}', ok: true, exp: { buildRoot: 'C:\\' } },
  { name: 'trailing backslash removed', text: '{"buildRoot": "C:\\\\x\\\\"}', ok: true, exp: { buildRoot: 'C:\\x' } },
  { name: 'UNC with backslashes', text: '{"installRoot": "\\\\\\\\server\\\\share\\\\x"}', ok: true, exp: { installRoot: '\\\\server\\share\\x' } },
  { name: 'UNC with slashes', text: '{"installRoot": "//server/share/x"}', ok: true },
  { name: 'expands %NAME%', text: '{"installRoot": "%SHUKO_T_ROOT%\\\\sub"}', ok: true, exp: { installRoot: 'D:\\base\\sub' } },
  { name: 'expands %name% lower case', text: '{"installRoot": "%shuko_t_root%\\\\sub"}', ok: true, exp: { installRoot: 'D:\\base\\sub' } },
  { name: 'default installRoot expands LOCALAPPDATA', text: '{"keepVersions": 2}', ok: true, exp: { installRoot: 'C:\\Users\\tester\\AppData\\Local\\Programs\\Shuko' } },
  { name: 'top level array', text: '[]', ok: false },
  { name: 'top level null', text: 'null', ok: false },
  { name: 'top level string', text: '"x"', ok: false },
  { name: 'trailing comma', text: '{"keepVersions": 2,}', ok: false },
  { name: 'not JSON', text: 'installRoot=C:\\x', ok: false },
  { name: 'empty file', text: '', ok: false },
  { name: 'comment', text: '{"keepVersions": 2 /* c */}', ok: false },
];

function nodeResolve(c, i) {
  const p = path.join(sb, `n-${i}.json`);
  if (c.text !== null) fs.writeFileSync(p, c.text);
  try {
    return { ok: true, value: resolveLocalConfig({ configPath: p, overrides: {}, env: ENV }) };
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}

const psCache = new Map();
function psResolve(c, i) {
  if (psCache.has(i)) return psCache.get(i);
  const p = path.join(sb, `p-${i}.json`);
  if (c.text !== null) fs.writeFileSync(p, c.text);
  const r = runPs(PROBE, ['-LibPath', LIB_PS, '-ConfigPath', p], { env: ENV });
  assert.ok(r.stdout.trim().length > 0, `no output (status ${r.status}) ${r.stderr}`);
  const v = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  psCache.set(i, v);
  return v;
}

CASES.forEach((c, i) => {
  test(`local.json rules (Node.js): ${c.name}`, () => {
    const r = nodeResolve(c, i);
    assert.equal(r.ok, c.ok, r.error);
    if (c.ok && c.exp) {
      for (const [k, v] of Object.entries(c.exp)) assert.equal(r.value[k], v, k);
    }
  });
});

// One PowerShell start-up per case is slow (about 0.5 s each); run them in a single test per group.
test('local.json rules (PowerShell): every case gives the expected accept/reject and values', () => {
  const failures = [];
  CASES.forEach((c, i) => {
    const r = psResolve(c, i);
    if (r.ok !== c.ok) {
      failures.push(`${c.name}: expected ok=${c.ok}, got ${r.ok} ${r.error ?? ''}`);
      return;
    }
    if (c.ok && c.exp) {
      for (const [k, v] of Object.entries(c.exp)) {
        if (norm(r.value[k]) !== norm(v)) failures.push(`${c.name}: ${k} expected ${JSON.stringify(v)} got ${JSON.stringify(r.value[k])}`);
      }
    }
  });
  assert.deepEqual(failures, []);
});

test('local.json rules: Node.js and PowerShell agree on every case (accept/reject and the 4 values)', () => {
  const diffs = [];
  CASES.forEach((c, i) => {
    const n = nodeResolve(c, 100 + i);
    const p = psResolve(c, i);
    if (n.ok !== p.ok) {
      diffs.push(`${c.name}: node ok=${n.ok}, ps ok=${p.ok}`);
      return;
    }
    if (n.ok) {
      for (const k of ['installRoot', 'keepVersions', 'builderRepo', 'buildRoot']) {
        if (norm(n.value[k]) !== norm(p.value[k])) diffs.push(`${c.name}: ${k} node=${JSON.stringify(n.value[k])} ps=${JSON.stringify(p.value[k])}`);
      }
      for (const k of ['installRoot', 'keepVersions', 'builderRepo', 'buildRoot']) {
        if (n.value.sources[k] !== p.value.sources[k]) diffs.push(`${c.name}: sources.${k} node=${n.value.sources[k]} ps=${p.value.sources[k]}`);
      }
    }
  });
  assert.deepEqual(diffs, []);
});

test('PowerShell: overrides beat local.json and report sources "option"', () => {
  const p = path.join(sb, 'ps-ov.json');
  fs.writeFileSync(p, '{"keepVersions": 5, "buildRoot": "E:\\\\bb"}');
  const r = runPs(PROBE, ['-LibPath', LIB_PS, '-ConfigPath', p, '-OverridesJson', JSON.stringify({ buildRoot: 'F:\\opt' })], { env: ENV });
  const j = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.equal(j.ok, true, j.error);
  assert.equal(j.value.buildRoot, 'F:\\opt');
  assert.equal(j.value.sources.buildRoot, 'option');
  assert.equal(j.value.sources.keepVersions, 'local.json');
  assert.equal(j.value.keepVersions, 5);
});

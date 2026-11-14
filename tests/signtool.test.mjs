// signtool.exe の確かめ: build.mjs の findSignTool・prependPath、build.mjs --dry-run の warnings と plan.package.pathPrepended、
// scripts/check-env.ps1 の出力の signtool の項と missing。
// 仕様: tasks/2026-11-13-p2-build-switch/handoff-notes.md の追記5（「テストの入口」）、docs/02 の5節。
// この PC に Windows SDK が無くても確かめられるよう、実物は使わず、試しの場所に置いた偽の signtool.exe と差し替えの関数・環境で試す
// （ProgramFiles(x86) を試しの場所へ向け、PATH から signtool のあるフォルダを外す）。
// Run: node --test tests/signtool.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findSignTool, prependPath } from '../scripts/build.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode, runPs } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-st-');
});
after(() => removeSandbox(sb));

// ---- findSignTool（関数の差し替え） ---------------------------------------------------------
test('findSignTool: PATH の上にあればそれ（引用符つきの項目も読む）', () => {
  const r = findSignTool({ env: { Path: 'C:\\a;"C:\\b"' }, exists: (p) => p === 'C:\\b\\signtool.exe', listDirs: () => [] });
  assert.deepEqual({ found: r.found, path: r.path, dir: r.dir, source: r.source }, { found: true, path: 'C:\\b\\signtool.exe', dir: 'C:\\b', source: 'PATH' });
});
test('findSignTool: PATH の先のものが勝つ。PATH は Windows Kits より優先', () => {
  const exists = () => true;
  const r = findSignTool({ env: { PATH: 'C:\\first;C:\\second', 'ProgramFiles(x86)': 'D:\\PF86' }, exists, listDirs: () => ['10.0.26100.0'] });
  assert.equal(r.dir, 'C:\\first');
  assert.equal(r.source, 'PATH');
});
test('findSignTool: PATH の名前は大文字小文字を問わない', () => {
  for (const key of ['PATH', 'Path', 'path']) {
    const r = findSignTool({ env: { [key]: 'C:\\x' }, exists: (p) => p === 'C:\\x\\signtool.exe', listDirs: () => [] });
    assert.equal(r.found, true, key);
  }
});
const KITS_EXISTS = (p) => /10\.0\.(22621|26100)\.0\\x64\\signtool\.exe$/.test(p);
test('findSignTool: PATH に無ければ Windows Kits の最も新しい版（候補は新しい順。版でない名前・exe の無い版は除く）', () => {
  const r = findSignTool({
    env: { PATH: '', 'ProgramFiles(x86)': 'D:\\PF86' },
    listDirs: () => ['10.0.22621.0', '10.0.26100.0', 'wdf', '10.0.9.0'],
    exists: KITS_EXISTS,
  });
  assert.equal(r.found, true);
  assert.equal(r.source, 'WindowsKits');
  assert.equal(r.path, 'D:\\PF86\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe');
  assert.equal(r.dir, 'D:\\PF86\\Windows Kits\\10\\bin\\10.0.26100.0\\x64');
  assert.deepEqual(r.candidates.map((p) => p.match(/10\.0\.\d+\.0/)[0]), ['10.0.26100.0', '10.0.22621.0']);
});
test('findSignTool: 版は数で比べる（10.0.9.0 より 10.0.22621.0 が新しい）', () => {
  const r = findSignTool({
    env: { PATH: '', 'ProgramFiles(x86)': 'D:\\PF86' },
    listDirs: () => ['10.0.9.0', '10.0.22621.0', '10.0.19041.0'],
    exists: () => true,
  });
  assert.match(r.path, /10\.0\.22621\.0/);
  assert.deepEqual(r.candidates.map((p) => p.match(/10\.0\.\d+\.0/)[0]), ['10.0.22621.0', '10.0.19041.0', '10.0.9.0']);
});
test('findSignTool: ProgramFiles(x86) が無ければ C:\\Program Files (x86) を見る', () => {
  const seen = [];
  findSignTool({ env: { PATH: '' }, listDirs: (d) => (seen.push(d), []), exists: () => false });
  assert.ok(seen.some((d) => d.toLowerCase().startsWith('c:\\program files (x86)\\windows kits\\10\\bin')), seen.join(','));
});
test('findSignTool: どちらにも無ければ found:false と空の値', () => {
  const r = findSignTool({ env: { PATH: 'C:\\a' }, exists: () => false, listDirs: () => ['10.0.26100.0'] });
  assert.deepEqual(r, { found: false, path: null, dir: null, source: null, candidates: [] });
  assert.equal(findSignTool({ env: {}, exists: () => false, listDirs: () => [] }).found, false);
});

// ---- prependPath ----------------------------------------------------------------------------
test('prependPath: 先頭に足した写しを返し、元は変えない', () => {
  const env = { Path: 'C:\\x', OTHER: '1' };
  const r = prependPath(env, 'C:\\sdk');
  assert.deepEqual(r, { Path: 'C:\\sdk;C:\\x', OTHER: '1' });
  assert.deepEqual(env, { Path: 'C:\\x', OTHER: '1' });
  assert.notEqual(r, env);
});
test('prependPath: PATH が無ければ作る。キーの大文字小文字は元のまま', () => {
  assert.deepEqual(prependPath({}, 'C:\\sdk'), { Path: 'C:\\sdk' });
  assert.deepEqual(prependPath({ PATH: 'C:\\x' }, 'C:\\sdk'), { PATH: 'C:\\sdk;C:\\x' });
  assert.deepEqual(prependPath({ path: 'C:\\x' }, 'C:\\sdk'), { path: 'C:\\sdk;C:\\x' });
  const r = prependPath({ PATH: 'C:\\x' }, 'C:\\sdk');
  assert.equal(Object.keys(r).filter((k) => k.toLowerCase() === 'path').length, 1, 'PATH のキーが2つにならない');
});
test('prependPath: プロセスの環境を渡しても process.env は変わらない', () => {
  const before = JSON.stringify(process.env);
  prependPath(process.env, 'C:\\sdk-test-only');
  assert.equal(JSON.stringify(process.env), before);
});

// ---- 試しの環境（実物の SDK を使わない） -------------------------------------------------------
const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'Path';
// 今の PATH から signtool.exe のあるフォルダを外した PATH（この PC に SDK が入っても結果が変わらないように）
function pathWithoutSigntool(extraFirst) {
  const kept = String(process.env[pathKey] || '')
    .split(';')
    .filter(Boolean)
    .filter((d) => !fs.existsSync(path.join(d.replace(/^"|"$/g, ''), 'signtool.exe')));
  return [...(extraFirst ? [extraFirst] : []), ...kept].join(';');
}
function makeKits(pf86, versions = ['10.0.22621.0', '10.0.26100.0']) {
  for (const v of versions) writeFile(path.join(pf86, 'Windows Kits', '10', 'bin', v, 'x64', 'signtool.exe'), 'MZ');
  fs.mkdirSync(path.join(pf86, 'Windows Kits', '10', 'bin', 'wdf'), { recursive: true });
  fs.mkdirSync(path.join(pf86, 'Windows Kits', '10', 'bin', '10.0.9.0', 'x64'), { recursive: true }); // exe の無い版
}
const envFor = (pf86, onPathDir) => ({ [pathKey]: pathWithoutSigntool(onPathDir), 'ProgramFiles(x86)': pf86, LOCALAPPDATA: path.join(sb, 'LocalAppData') });

// ---- build.mjs --dry-run ---------------------------------------------------------------------
const jsonOf = (s) => JSON.parse(s.slice(s.search(/^\{/m)));
function dry(env, name) {
  const cfg = path.join(sb, `${name}-cfg.json`);
  return runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, '--build-root', path.join(sb, `${name}-br`), '--from', 'package', '--to', 'package'], { env });
}

test('--dry-run: signtool がどこにも無い → warnings に signtool、checksBeforeRun.signtool.found:false、pathPrepended:null。止めない（終了コード 0）', () => {
  const pf = path.join(sb, 'pf-none');
  fs.mkdirSync(pf, { recursive: true });
  const r = dry(envFor(pf), 'none');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = jsonOf(r.stdout);
  assert.equal(j.result, 'dry-run');
  assert.ok(j.warnings.some((w) => /signtool/i.test(w)), JSON.stringify(j.warnings));
  assert.equal(j.checksBeforeRun.signtool.found, false);
  assert.equal(j.plan.package.pathPrepended, null);
});
test('--dry-run: Windows Kits に最も新しい版がある → pathPrepended はその x64 フォルダ、signtool の警告は出ない', () => {
  const pf = path.join(sb, 'pf-kits');
  makeKits(pf);
  const j = jsonOf(dry(envFor(pf), 'kits').stdout);
  assert.equal(j.checksBeforeRun.signtool.found, true);
  assert.equal(path.resolve(j.plan.package.pathPrepended).toLowerCase(), path.join(pf, 'Windows Kits', '10', 'bin', '10.0.26100.0', 'x64').toLowerCase());
  assert.ok(!j.warnings.some((w) => /signtool/i.test(w)), JSON.stringify(j.warnings));
});
test('--dry-run: PATH の上にある → pathPrepended は null（PATH に足さない）、警告なし。Windows Kits があっても PATH が先', () => {
  const pf = path.join(sb, 'pf-kits2');
  makeKits(pf);
  const onPath = path.join(sb, 'on-path-bin');
  writeFile(path.join(onPath, 'signtool.exe'), 'MZ');
  const j = jsonOf(dry(envFor(pf, onPath), 'onpath').stdout);
  assert.equal(j.checksBeforeRun.signtool.found, true);
  assert.equal(j.plan.package.pathPrepended, null);
  assert.ok(!j.warnings.some((w) => /signtool/i.test(w)));
  assert.match(JSON.stringify(j.checksBeforeRun.signtool).toLowerCase(), /on-path-bin/);
});
test('--dry-run: package を選ばない範囲では plan.package が無く、signtool の警告も出ない（他の手順に関係ない）', () => {
  const pf = path.join(sb, 'pf-none2');
  fs.mkdirSync(pf, { recursive: true });
  const cfg = path.join(sb, 'zip-cfg.json');
  const r = runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, '--build-root', path.join(sb, 'zip-br'), '--from', 'zip', '--to', 'zip'], { env: envFor(pf) });
  assert.equal(r.status, 0, r.stderr);
  const j = jsonOf(r.stdout);
  assert.ok(!j.plan.package);
  assert.ok(!j.warnings.some((w) => /signtool/i.test(w)));
});

// ---- check-env.ps1 ---------------------------------------------------------------------------
const CHECK_ENV = path.join(REPO, 'scripts', 'check-env.ps1');
function checkEnv(env, name) {
  const out = path.join(sb, `${name}-env.json`);
  const r = runPs(CHECK_ENV, ['-BuildRoot', path.join(sb, `${name}-br`), '-OutFile', out], { env });
  assert.ok(fs.existsSync(out), `出力ファイルが無い (status ${r.status}): ${r.stderr}${r.stdout.slice(0, 500)}`);
  return { status: r.status, j: JSON.parse(fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, '')) };
}
const missingOf = (j) => (Array.isArray(j.missing) ? j.missing : []).map(String);

test('check-env.ps1: signtool が無い → signtool.found:false、missing に signtool.exe の1行、終了コード 2', () => {
  const pf = path.join(sb, 'pf-ce-none');
  fs.mkdirSync(pf, { recursive: true });
  const { status, j } = checkEnv(envFor(pf), 'ce-none');
  assert.equal(j.signtool.found, false);
  assert.equal(missingOf(j).filter((m) => /signtool/i.test(m)).length, 1, JSON.stringify(j.missing));
  assert.equal(status, 2);
});
test('check-env.ps1: Windows Kits に複数の版 → 最も新しい版を選ぶ。missing に signtool は入らない', () => {
  const pf = path.join(sb, 'pf-ce-kits');
  makeKits(pf);
  const { j } = checkEnv(envFor(pf), 'ce-kits');
  assert.equal(j.signtool.found, true);
  assert.equal(path.resolve(j.signtool.chosen).toLowerCase(), path.join(pf, 'Windows Kits', '10', 'bin', '10.0.26100.0', 'x64', 'signtool.exe').toLowerCase());
  assert.match(String(j.signtool.source), /kits/i);
  assert.ok(!missingOf(j).some((m) => /signtool/i.test(m)));
  const cands = JSON.stringify(j.signtool.kitsCandidates ?? []).toLowerCase();
  assert.ok(cands.includes('26100') && cands.includes('22621'), cands);
  assert.ok(cands.indexOf('26100') < cands.indexOf('22621'), '新しい順');
});
test('check-env.ps1: PATH の上にある → それを選ぶ（Windows Kits より先）', () => {
  const pf = path.join(sb, 'pf-ce-both');
  makeKits(pf);
  const onPath = path.join(sb, 'ce-on-path');
  writeFile(path.join(onPath, 'signtool.exe'), 'MZ');
  const { j } = checkEnv(envFor(pf, onPath), 'ce-both');
  assert.equal(j.signtool.found, true);
  assert.equal(path.resolve(j.signtool.chosen).toLowerCase(), path.join(onPath, 'signtool.exe').toLowerCase());
  assert.match(String(j.signtool.source), /path/i);
  assert.ok(!missingOf(j).some((m) => /signtool/i.test(m)));
});

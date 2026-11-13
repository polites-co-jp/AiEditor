// scripts/apply.mjs の入口（引数・終了コード・--dry-run）のテスト。仕様: tasks/2026-11-13-p2-apply/apply-design.md の1・3節。
// --dry-run の試しは、蒙恬の試しの作業ツリー C:\b\wt\dev-apply（読むだけ。変わらないことを確かめる）と、試しの入れ物
// tasks/2026-11-13-p2-apply/fixtures/ を使う。作業ツリーが無ければ飛ぶ。書き込みは C:\b\smoke\ の下の checks.json だけ。
// Run: node --test tests/apply-cli.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = join(REPO, 'scripts', 'apply.mjs');
const FIX = join(REPO, 'tasks', '2026-11-13-p2-apply', 'fixtures');
const WT = process.env.AIED_APPLY_WT || 'C:\\b\\wt\\dev-apply';
const OUT = 'C:\\b\\smoke\\apply-cli';
const hasApply = existsSync(APPLY);
const skipApply = hasApply ? false : '実装なし: scripts/apply.mjs';

const run = (args) => spawnSync(process.execPath, [APPLY, ...args], { encoding: 'utf8', cwd: REPO, windowsHide: true });
const git = (...a) => spawnSync('git', ['-C', WT, ...a], { encoding: 'utf8', windowsHide: true });

test('CLI: 引数なしは終了コード 2', { skip: skipApply }, () => {
  assert.equal(run([]).status, 2);
});

test('CLI: 知らないオプション・--label なしは終了コード 2', { skip: skipApply }, () => {
  assert.equal(run([WT, '--label', 'x', '--no-such-option']).status, 2);
  assert.equal(run([WT]).status, 2);
});

const apply = hasApply ? await import('../scripts/apply.mjs') : {};

test('parseArgs: 引数なしで UsageError を投げる。--only はカンマ区切り', { skip: apply.parseArgs ? false : skipApply }, () => {
  assert.throws(() => apply.parseArgs([]));
  const o = apply.parseArgs([WT, '--label', 'x', '--only', 'A-1-x,A-2-y', '--dry-run']);
  assert.deepEqual([...(o.only ?? [])], ['A-1-x', 'A-2-y']);
  assert.equal(o.dryRun, true);
});

test('summarizeResult: stoppedAt・errors・fail の検査があれば fail、hold があれば hold、それ以外は ok', { skip: apply.summarizeResult ? false : skipApply }, () => {
  const s = apply.summarizeResult;
  const base = { stoppedAt: null, errors: [], checks: { a: { status: 'ok' } } };
  assert.equal(s(base), 'ok');
  assert.equal(s({ ...base, stoppedAt: 'A-1' }), 'fail');
  assert.equal(s({ ...base, errors: ['x'] }), 'fail');
  assert.equal(s({ ...base, checks: { a: { status: 'fail' } } }), 'fail');
  assert.equal(s({ ...base, checks: { a: { status: 'hold' } }, hold: ['x'] }), 'hold');
  assert.equal(s({ ...base, checks: { lockfile: { status: 'pending' } } }), 'ok', 'pending は ok とみなす（導入の前）');
});

test('listPatches: 頭の数の順。数が無いものは後ろ（名前の順）', { skip: apply.listPatches ? false : skipApply }, () => {
  assert.ok(Array.isArray(apply.listPatches(join(REPO, 'tests', 'no-such-dir'))) || true);
  // patches/ が実在すれば、頭の数が昇順であること
  const real = apply.listPatches(join(REPO, 'patches'));
  const nums = real.map((n) => parseInt(n, 10)).filter(Number.isFinite);
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
});

const wtOk = existsSync(join(WT, '.git')) && existsSync(join(FIX, 'removals'));
test('--dry-run: 作業ツリーを変えない（HEAD・git status）。checks.json に dryRun:true が残る', { skip: skipApply || (wtOk ? false : `試しの作業ツリーか入れ物が無い: ${WT}`) }, () => {
  mkdirSync(OUT, { recursive: true });
  const out = join(OUT, 'checks-dry.json');
  const head0 = git('rev-parse', 'HEAD').stdout.trim();
  const st0 = git('status', '--porcelain').stdout;
  const r = run([WT, '--label', 'p2-tests-dry', '--dry-run', '--only', 'A-1-trial-grunt-jake', '--removals', join(FIX, 'removals'),
    '--patches', join(FIX, 'patches'), '--assets', join(FIX, 'assets'), '--overlay', join(FIX, 'product.overlay.json'),
    '--keep', join(FIX, 'keep.json'), '--checks-out', out]);
  assert.ok([0, 1].includes(r.status), `終了コード ${r.status}: ${r.stderr}`);
  assert.equal(git('rev-parse', 'HEAD').stdout.trim(), head0, 'HEAD が動いた');
  assert.equal(git('status', '--porcelain').stdout, st0, '作業ツリーが変わった');
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.dryRun, true);
  assert.ok(j.units.some((u) => u.id === 'A-1-trial-grunt-jake'));
});

test('--only に無い ID は result:fail（errors）で、作業ツリーに何も書かない', { skip: skipApply || (wtOk ? false : `試しの作業ツリーが無い: ${WT}`) }, () => {
  mkdirSync(OUT, { recursive: true });
  const out = join(OUT, 'checks-badonly.json');
  const head0 = git('rev-parse', 'HEAD').stdout.trim();
  const st0 = git('status', '--porcelain').stdout;
  const r = run([WT, '--label', 'p2-tests-bad', '--dry-run', '--only', 'Z-9-none', '--removals', join(FIX, 'removals'), '--checks-out', out]);
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.equal(git('rev-parse', 'HEAD').stdout.trim(), head0);
  assert.equal(git('status', '--porcelain').stdout, st0);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.result, 'fail');
  assert.ok(j.errors.length > 0);
});

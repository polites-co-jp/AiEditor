// build.mjs の commit の直し（出力の product.json に commit を入れる）のテスト。
// 仕様: tasks/2026-11-14-build-commit-fix/brief.md、docs/02 の4節の7。
// 入口は蒙恬の handoff-notes-meng-tian.md が決まる前の想定（tasks/2026-11-14-build-commit-fix/handoff-notes-cao-shen.md に一覧）。
//   - childEnv(base, { BUILD_SOURCEVERSION })       既存の部品。値が子の環境に載ること
//   - headCommitOf(worktree)                         作業ツリーの HEAD の40桁（.git がファイルでも読める）
//   - checkProductCommit(product, expected)          → { ok, problems }。commit が40桁でない・expected と違えば ok:false
//   - unitsRecordFrom(checks)                        → [{ id, enabled, applied }]。--from install のときの build-record.units
// Run: node --test tests/build-commit.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as B from '../scripts/build.mjs';
import { makeSandbox, removeSandbox, runNode } from './build/helpers.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'fedcba9876543210fedcba9876543210fedcba98';

let sb;
before(() => {
  sb = makeSandbox('tests-bc-');
});
after(() => removeSandbox(sb));

const need = (name) => {
  assert.equal(typeof B[name], 'function', `scripts/build.mjs が ${name} を export していない（入口の想定。handoff-notes-meng-tian.md と合わせる）`);
  return B[name];
};

// ---- 子のプロセスの環境 -----------------------------------------------------------------------
test('childEnv: BUILD_SOURCEVERSION が子の環境に載る（VSCODE_* を外す規則に巻き込まれない）', () => {
  const { env, removed } = B.childEnv({ PATH: 'x', VSCODE_PID: '1' }, { BUILD_SOURCEVERSION: SHA });
  assert.equal(env.BUILD_SOURCEVERSION, SHA);
  assert.deepEqual(removed, ['VSCODE_PID']);
});
test('childEnv: 親の環境に古い BUILD_SOURCEVERSION があっても、渡した値が勝つ', () => {
  const { env } = B.childEnv({ BUILD_SOURCEVERSION: OTHER }, { BUILD_SOURCEVERSION: SHA });
  assert.equal(env.BUILD_SOURCEVERSION, SHA);
});

// ---- 作業ツリーの HEAD ------------------------------------------------------------------------
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
test('headCommitOf: 通常のリポジトリでも、.git がファイル（git worktree）でも HEAD の40桁を返す', () => {
  const headCommitOf = need('headCommitOf');
  const main = path.join(sb, 'main');
  fs.mkdirSync(main, { recursive: true });
  git(main, ['init', '-q']);
  fs.writeFileSync(path.join(main, 'a.txt'), 'a');
  git(main, ['add', '.']);
  git(main, ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-q', '-m', 'one']);
  const wt = path.join(sb, 'wt');
  git(main, ['worktree', 'add', '-q', '--detach', wt]);
  assert.ok(fs.statSync(path.join(wt, '.git')).isFile(), '作業ツリーの .git はファイル');
  const expect = git(main, ['rev-parse', 'HEAD']);
  assert.match(expect, /^[0-9a-f]{40}$/);
  assert.equal(headCommitOf(main), expect);
  assert.equal(headCommitOf(wt), expect);
  // 作業ツリーに新しい commit を足すと、その HEAD を返す（本家の commit ではない）
  fs.writeFileSync(path.join(wt, 'b.txt'), 'b');
  git(wt, ['add', '.']);
  git(wt, ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-q', '-m', 'two']);
  assert.equal(headCommitOf(wt), git(wt, ['rev-parse', 'HEAD']));
  assert.notEqual(headCommitOf(wt), expect);
});
test('headCommitOf: リポジトリでない場所は例外（空の値を黙って渡さない）', () => {
  const headCommitOf = need('headCommitOf');
  const empty = path.join(sb, 'not-a-repo');
  fs.mkdirSync(empty, { recursive: true });
  assert.throws(() => headCommitOf(empty));
});

// ---- 後処理の確かめ: product.json の commit --------------------------------------------------
test('checkProductCommit: 40桁で渡した値と一致すれば ok', () => {
  const r = need('checkProductCommit')({ commit: SHA }, SHA);
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});
test('checkProductCommit: commit が無い（キーごと・undefined・null・空文字）と失敗', () => {
  const f = need('checkProductCommit');
  for (const p of [{}, { commit: undefined }, { commit: null }, { commit: '' }]) {
    const r = f(p, SHA);
    assert.equal(r.ok, false, JSON.stringify(p));
    assert.ok(r.problems.length >= 1);
  }
});
test('checkProductCommit: 40桁でない（短い・長い・16進でない・数値）と失敗', () => {
  const f = need('checkProductCommit');
  for (const c of [SHA.slice(0, 10), SHA + '0', 'g'.repeat(40), 12345]) assert.equal(f({ commit: c }, c).ok, false, String(c));
});
test('checkProductCommit: 渡した値と食い違うと失敗。両方の値が文言に入る', () => {
  const r = need('checkProductCommit')({ commit: OTHER }, SHA);
  assert.equal(r.ok, false);
  const text = r.problems.join(' ');
  assert.ok(text.includes(OTHER) && text.includes(SHA), text);
});
test('checkProductCommit: 大文字小文字だけの違いは食い違いとしない（git の値は小文字）', () => {
  assert.equal(need('checkProductCommit')({ commit: SHA.toUpperCase() }, SHA).ok, true);
});
test('checkProductCommit: 入力の product は変えない', () => {
  const p = { commit: OTHER, x: 1 };
  const copy = structuredClone(p);
  need('checkProductCommit')(p, SHA);
  assert.deepEqual(p, copy);
});

// ---- --from install のときの build-record.units --------------------------------------------
test('unitsRecordFrom: checks.json の units から id・enabled・applied を写す（apply と同じ形）', () => {
  const r = need('unitsRecordFrom')({ units: [{ id: 'A-1', enabled: true, applied: 'ok', extra: 1 }, { id: 'A-2', enabled: false, applied: 'skipped' }] });
  assert.deepEqual(r, [{ id: 'A-1', enabled: true, applied: 'ok' }, { id: 'A-2', enabled: false, applied: 'skipped' }]);
});
test('unitsRecordFrom: checks.json が無い・units が無いなら空の配列（例外にしない）', () => {
  const f = need('unitsRecordFrom');
  assert.deepEqual(f(null), []);
  assert.deepEqual(f({}), []);
  assert.deepEqual(f('x'), []);
  assert.deepEqual(f({ units: 'A-1' }), []);
});
test('patchesRecordFrom: file と applied だけを写す。無ければ空', () => {
  const f = need('patchesRecordFrom');
  assert.deepEqual(f({ patches: [{ file: 'p1', applied: 'ok', x: 1 }] }), [{ file: 'p1', applied: 'ok' }]);
  assert.deepEqual(f(null), []);
  assert.deepEqual(f({}), []);
});

// ---- isFullSha / stepEnv ----------------------------------------------------------------------
test('isFullSha: 40桁の16進だけ true（前後の空白と大文字は許す）', () => {
  const f = need('isFullSha');
  assert.equal(f(SHA), true);
  assert.equal(f(SHA.toUpperCase()), true);
  assert.equal(f(` ${SHA}\n`), true);
  for (const v of [null, undefined, 12, SHA.slice(1), SHA + '0', 'g'.repeat(40), '']) assert.equal(f(v), false, String(v));
});
test('SOURCE_VERSION_STEPS は typecheck と package', () => {
  assert.deepEqual([...B.SOURCE_VERSION_STEPS], ['typecheck', 'package']);
  assert.ok(Object.isFrozen(B.SOURCE_VERSION_STEPS));
});
test('stepEnv: typecheck・package の子の環境に BUILD_SOURCEVERSION（小文字・trim）が入る', () => {
  const f = need('stepEnv');
  for (const name of ['typecheck', 'package']) {
    assert.equal(f(name, { PATH: 'x' }, ` ${SHA.toUpperCase()} `).BUILD_SOURCEVERSION, SHA, name);
    assert.equal(f(name, { PATH: 'x' }, SHA).PATH, 'x');
  }
});
test('stepEnv: 外から来た BUILD_SOURCEVERSION（名前の大文字小文字を問わない）は渡した値で上書き。元の env は変えない', () => {
  const f = need('stepEnv');
  const base = { build_sourceversion: OTHER, BUILD_SOURCEVERSION: OTHER, A: '1' };
  const copy = { ...base };
  const e = f('package', base, SHA);
  assert.equal(e.BUILD_SOURCEVERSION, SHA);
  assert.equal(Object.keys(e).filter((k) => /^build_sourceversion$/i.test(k)).length, 1);
  assert.deepEqual(base, copy);
});
test('stepEnv: ほかの手順には足さず、外から来た値も外す。sourceVersion は見ない', () => {
  const f = need('stepEnv');
  const e = f('install', { BUILD_SOURCEVERSION: OTHER, A: '1' }, 'not-a-sha');
  assert.equal(Object.keys(e).some((k) => /^build_sourceversion$/i.test(k)), false);
  assert.equal(e.A, '1');
});
test('stepEnv: typecheck・package で値が40桁でなければ例外', () => {
  const f = need('stepEnv');
  for (const name of ['typecheck', 'package']) for (const v of [null, undefined, '', 'abc', SHA + '0']) assert.throws(() => f(name, {}, v), undefined, `${name} ${v}`);
});

// ---- --dry-run で見える結線 ------------------------------------------------------------------
const jsonOf = (s) => JSON.parse(s.slice(s.search(/^\{/m)));
const GIT_ID = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid'];
function makeRepo(name) {
  const dir = path.join(sb, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git(dir, ['add', '.']);
  git(dir, [...GIT_ID, 'commit', '-q', '-m', 'one']);
  return dir;
}
const dryEnv = () => ({ LOCALAPPDATA: path.join(sb, 'LocalAppData') });

test('--dry-run: plan の typecheck・package の env と sourceVersion が作業ツリーの HEAD。--from install でも units が checks.json から埋まる', () => {
  const wt = makeRepo('dry-wt');
  const head = git(wt, ['rev-parse', 'HEAD']);
  const take = path.join(sb, 'take1');
  fs.mkdirSync(take, { recursive: true });
  fs.writeFileSync(path.join(take, 'checks.json'), JSON.stringify({ result: 'ok', units: [{ id: 'A-1', enabled: true, applied: 'ok', junk: 1 }], patches: [{ file: 'p', applied: 'ok' }] }));
  const cfg = path.join(sb, 'dry-cfg.json');
  const r = runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, '--build-root', path.join(sb, 'brd'), '--worktree', wt, '--from', 'install', '--take-in-dir', take], { env: dryEnv() });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = jsonOf(r.stdout);
  assert.equal(j.plan.typecheck.env.BUILD_SOURCEVERSION, head);
  assert.equal(j.plan.package.env.BUILD_SOURCEVERSION, head);
  assert.equal(j.sourceVersion.value, head);
  assert.equal(j.sourceVersion.source, 'worktree HEAD');
  assert.deepEqual(j.units, [{ id: 'A-1', enabled: true, applied: 'ok' }]);
  assert.equal(j.unitsFrom.applyRan, false);
});
test('--dry-run: 作業ツリーが無くても終了コード 0。sourceVersion.value は null で error が文字列', () => {
  const cfg = path.join(sb, 'dry-cfg.json');
  const r = runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, '--build-root', path.join(sb, 'brd2'), '--worktree', path.join(sb, 'no-such-wt'), '--from', 'typecheck', '--to', 'package'], { env: dryEnv() });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = jsonOf(r.stdout);
  assert.equal(j.sourceVersion.value, null);
  assert.equal(typeof j.sourceVersion.error, 'string');
});

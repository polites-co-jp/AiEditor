// build.mjs の2つの直し（childEnv が BUILD_SOURCEVERSION を外す／版の commit に枝 builds/<label> を付ける）と、
// 後処理（--from postprocess）が product.json の commit の欠け・食い違いで本当に止まる結線のテスト。
// 入口: tasks/2026-11-14-fix-b1-and-build/handoff-notes.md の4節と「テストの入口」。
// 枝は一時の git リポジトリに付ける（常設の clone C:\b\vscode には触れない）。
// Run: node --test tests/build-env-branch.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as B from '../scripts/build.mjs';
import { makeSandbox, removeSandbox, writeFile, runNode, parseJsonOut, makeFakeEditor } from './build/helpers.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'fedcba9876543210fedcba9876543210fedcba98';
const GIT_ID = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid'];

let sb;
before(() => {
  sb = makeSandbox('tests-beb-');
});
after(() => removeSandbox(sb));

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function gitRaw(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}
function makeRepo(name, files = { 'a.txt': 'a' }) {
  const dir = path.join(sb, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q']);
  for (const [f, t] of Object.entries(files)) writeFile(path.join(dir, f), t);
  git(dir, ['add', '.']);
  git(dir, [...GIT_ID, 'commit', '-q', '-m', 'one']);
  return dir;
}
function addCommit(dir, file) {
  writeFile(path.join(dir, file), file);
  git(dir, ['add', '.']);
  git(dir, [...GIT_ID, 'commit', '-q', '-m', file]);
  return git(dir, ['rev-parse', 'HEAD']);
}
const headOf = (dir) => git(dir, ['rev-parse', 'HEAD']);
const refOf = (dir, name) => gitRaw(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);

// ---- 1. childEnv ------------------------------------------------------------------------------
test('childEnv: 外の BUILD_SOURCEVERSION は名前の大文字小文字を問わず外れ、removed に名前が出る（値は出ない）', () => {
  const { env, removed } = B.childEnv({ PATH: 'x', BUILD_SOURCEVERSION: SHA, build_sourceversion: OTHER, Build_SourceVersion: OTHER }, {});
  assert.equal(Object.keys(env).some((k) => /^build_sourceversion$/i.test(k)), false);
  assert.equal(env.PATH, 'x');
  assert.deepEqual(removed, ['BUILD_SOURCEVERSION', 'Build_SourceVersion', 'build_sourceversion']);
  assert.equal(JSON.stringify(removed).includes(SHA), false);
});
test('childEnv: extra で渡した BUILD_SOURCEVERSION は残る。外の値は removed に出る', () => {
  const { env, removed } = B.childEnv({ BUILD_SOURCEVERSION: OTHER, A: '1' }, { BUILD_SOURCEVERSION: SHA });
  assert.equal(env.BUILD_SOURCEVERSION, SHA);
  assert.equal(env.A, '1');
  assert.ok(removed.includes('BUILD_SOURCEVERSION'));
});
test('childEnv: extra が無ければ、外の値は env に残らない。既存の外す名前（VSCODE_*・ELECTRON_RUN_AS_NODE）と一緒に出る', () => {
  const { env, removed } = B.childEnv({ BUILD_SOURCEVERSION: OTHER, VSCODE_PID: '1', ELECTRON_RUN_AS_NODE: '1', KEEP: 'y' });
  assert.deepEqual(env, { KEEP: 'y' });
  assert.deepEqual(removed, ['BUILD_SOURCEVERSION', 'ELECTRON_RUN_AS_NODE', 'VSCODE_PID']);
});
test('childEnv: 元の base は変えない。名前が似ているだけのものは外さない', () => {
  const base = { BUILD_SOURCEVERSION: OTHER, MY_BUILD_SOURCEVERSION: 'k', BUILD_SOURCEVERSION2: 'k' };
  const copy = { ...base };
  const { env } = B.childEnv(base, {});
  assert.deepEqual(base, copy);
  assert.equal(env.MY_BUILD_SOURCEVERSION, 'k');
  assert.equal(env.BUILD_SOURCEVERSION2, 'k');
});

// ---- 2. 枝の名前 ------------------------------------------------------------------------------
test('buildBranchName: builds/<label>。BUILD_BRANCH_PREFIX は builds/', () => {
  assert.equal(B.BUILD_BRANCH_PREFIX, 'builds/');
  assert.equal(B.buildBranchName('1.146.0-p2-B-1-r2'), 'builds/1.146.0-p2-B-1-r2');
});
test('buildBranchName: 不正なラベルは例外', () => {
  for (const v of ['', '-x', 'a/b', 'a b', 'a..b', 'x.lock', 'x.', null, undefined, 12]) assert.throws(() => B.buildBranchName(v), undefined, String(v));
});

// ---- 2. markBuildCommit: 偽の runGit -----------------------------------------------------------
function fakeGit(script) {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    return script(args, calls.length);
  };
  return { runGit, calls };
}
const isRev = (a) => a[0] === 'rev-parse';
const isBranch = (a) => a[0] === 'branch';

test('markBuildCommit(偽): 新規は created、previous は null。branch の引数は --force --no-track <名前> <commit>', () => {
  let reads = 0;
  const { runGit, calls } = fakeGit((a) => {
    if (isRev(a)) return ++reads === 1 ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout: SHA + '\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  });
  const r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: SHA, runGit });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'created');
  assert.equal(r.previous, null);
  assert.equal(r.name, 'builds/L1');
  assert.equal(r.commit, SHA);
  assert.deepEqual(calls[0], ['rev-parse', '--verify', '--quiet', 'refs/heads/builds/L1']);
  assert.deepEqual(calls.find(isBranch), ['branch', '--force', '--no-track', 'builds/L1', SHA]);
});
test('markBuildCommit(偽): 既に同じ commit なら unchanged で、branch を呼ばない', () => {
  const { runGit, calls } = fakeGit(() => ({ status: 0, stdout: SHA, stderr: '' }));
  const r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: SHA, runGit });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'unchanged');
  assert.equal(calls.some(isBranch), false);
});
test('markBuildCommit(偽): 別の commit なら moved で previous に前の値', () => {
  let reads = 0;
  const { runGit } = fakeGit((a) => {
    if (isRev(a)) return { status: 0, stdout: ++reads === 1 ? OTHER : SHA, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  });
  const r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: SHA, runGit });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'moved');
  assert.equal(r.previous, OTHER);
});
test('markBuildCommit(偽): branch が失敗（128）しても例外にせず ok:false、error に終了コード', () => {
  const { runGit } = fakeGit((a) => (isRev(a) ? { status: 1, stdout: '', stderr: '' } : { status: 128, stdout: '', stderr: 'fatal: boom' }));
  let r;
  assert.doesNotThrow(() => {
    r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: SHA, runGit });
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /git branch が 128 で終わった/);
  assert.ok(r.error.includes('fatal: boom'));
  assert.equal(r.action, null);
});
test('markBuildCommit(偽): 読み直した値が違えば ok:false', () => {
  let reads = 0;
  const { runGit } = fakeGit((a) => {
    if (isRev(a)) return ++reads === 1 ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout: OTHER, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  });
  const r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: SHA, runGit });
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, 'string');
});
test('markBuildCommit(偽): runGit が例外を投げても、例外にせず ok:false', () => {
  const r = B.markBuildCommit({
    worktree: 'w',
    label: 'L1',
    commit: SHA,
    runGit: () => {
      throw new Error('spawn failed');
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /spawn failed/);
});
test('markBuildCommit(偽): commit が40桁でない・label が不正なら runGit を呼ばずに ok:false', () => {
  for (const [label, commit] of [['L1', 'abc'], ['L1', null], ['L1', SHA + '0'], ['a/b', SHA], ['', SHA]]) {
    const { runGit, calls } = fakeGit(() => ({ status: 0, stdout: '', stderr: '' }));
    const r = B.markBuildCommit({ worktree: 'w', label, commit, runGit });
    assert.equal(r.ok, false, `${label} ${commit}`);
    assert.equal(typeof r.error, 'string');
    assert.equal(calls.length, 0, `${label} ${commit}`);
  }
});
test('markBuildCommit(偽): commit は小文字・trim して扱う', () => {
  let reads = 0;
  const { runGit, calls } = fakeGit((a) => {
    if (isRev(a)) return ++reads === 1 ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout: SHA + '\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  });
  const r = B.markBuildCommit({ worktree: 'w', label: 'L1', commit: ` ${SHA.toUpperCase()}\n`, runGit });
  assert.equal(r.ok, true);
  assert.equal(r.commit, SHA);
  assert.equal(calls.find(isBranch)[4], SHA);
});

// ---- 2. markBuildCommit: 実の git の一時リポジトリ -----------------------------------------------
test('markBuildCommit(実): 当てた後の HEAD に枝が付く。同じ label・同じ commit は unchanged', () => {
  const wt = makeRepo('mark-wt');
  const head = headOf(wt);
  const r = B.markBuildCommit({ worktree: wt, label: 'real-1', commit: head });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.action, 'created');
  assert.equal(refOf(wt, 'builds/real-1').stdout, head);
  const r2 = B.markBuildCommit({ worktree: wt, label: 'real-1', commit: head });
  assert.equal(r2.ok, true);
  assert.equal(r2.action, 'unchanged');
  assert.equal(r2.previous, head);
});
test('markBuildCommit(実): 同じ label で別の commit にやり直すと moved で付け替わる。前の commit は previous に残る', () => {
  const wt = makeRepo('mark-wt2');
  const first = headOf(wt);
  assert.equal(B.markBuildCommit({ worktree: wt, label: 'real-2', commit: first }).ok, true);
  const second = addCommit(wt, 'b.txt');
  const r = B.markBuildCommit({ worktree: wt, label: 'real-2', commit: second });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.action, 'moved');
  assert.equal(r.previous, first);
  assert.equal(refOf(wt, 'builds/real-2').stdout, second);
});
test('markBuildCommit(実): 存在しない commit では ok:false（枝はできない）。例外にしない', () => {
  const wt = makeRepo('mark-wt3');
  const r = B.markBuildCommit({ worktree: wt, label: 'real-3', commit: OTHER });
  assert.equal(r.ok, false);
  assert.match(r.error, /git branch が \d+ で終わった/);
  assert.equal(refOf(wt, 'builds/real-3').status, 1);
});
test('markBuildCommit(実): リポジトリでない場所でも例外にせず ok:false', () => {
  const empty = path.join(sb, 'mark-norepo');
  fs.mkdirSync(empty, { recursive: true });
  // 一時の場所が別のリポジトリの中にあると、その親を拾う。親にならないよう GIT_CEILING_DIRECTORIES は使えないため、
  // 結果が ok:false か（親が無い場合）、親に枝ができないこと（作らせない）だけを見る
  const r = B.markBuildCommit({ worktree: empty, label: 'real-4', commit: SHA });
  assert.equal(r.ok, false);
});

// ---- 2・3. main の結線 -------------------------------------------------------------------------
const baseEnv = () => ({ LOCALAPPDATA: path.join(sb, 'LocalAppData') });
let seq = 0;
function runBuild(wt, extraArgs, tag = 'case') {
  const n = ++seq;
  const record = path.join(sb, `rec-${tag}-${n}.json`);
  const take = path.join(sb, `take-${tag}-${n}`);
  fs.mkdirSync(take, { recursive: true });
  const args = ['scripts/build.mjs', '1.146.0', '--config', path.join(sb, 'cfg.json'), '--build-root', path.join(sb, 'brd'), '--worktree', wt, '--take-in-dir', take, '--record', record, ...extraArgs];
  const r = runNode(args, { env: baseEnv() });
  let rec = null;
  try {
    rec = JSON.parse(fs.readFileSync(record, 'utf8'));
  } catch {}
  return { ...r, rec, record };
}
const stdoutJson = (r) => parseJsonOut(r.stdout);

test('--dry-run: branch は null。plan.branch に名前とコマンドが出て、枝はできない', () => {
  const wt = makeRepo('dry-wt');
  const head = headOf(wt);
  const r = runBuild(wt, ['--label', 'dry-1', '--from', 'typecheck', '--to', 'package', '--dry-run'], 'dry');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = stdoutJson(r);
  assert.equal(j.branch, null);
  assert.equal(j.plan.branch.name, 'builds/dry-1');
  assert.ok(j.plan.branch.command.includes('branch --force --no-track builds/dry-1'));
  assert.ok(j.plan.branch.command.includes(head));
  assert.equal(refOf(wt, 'builds/dry-1').status, 1);
});
test('--dry-run --no-branch: plan.branch が無い', () => {
  const wt = makeRepo('dry-wt-nb');
  const r = runBuild(wt, ['--label', 'dry-2', '--from', 'typecheck', '--to', 'package', '--dry-run', '--no-branch'], 'drynb');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = stdoutJson(r);
  assert.equal(j.branch, null);
  assert.equal(j.plan.branch, undefined);
  assert.equal(refOf(wt, 'builds/dry-2').status, 1);
});

// 後処理用の出力の偽物（tests/build/helpers.mjs の makeFakeEditor）。mydist があれば自前の拡張はそろう。keep は空
function makeOutput(name, { commit }) {
  const dir = path.join(sb, name);
  makeFakeEditor(dir, { commit });
  if (commit === undefined) {
    const p = path.join(dir, 'resources', 'app', 'product.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    delete j.commit;
    fs.writeFileSync(p, JSON.stringify(j));
  }
  for (const ext of ['mydist', 'notion-sync']) writeFile(path.join(dir, 'resources', 'app', 'extensions', ext, 'package.json'), '{}');
  return dir;
}
let keepFile;
let removalsDir;
function postprocess(wt, pkgDir, label, extra = []) {
  keepFile ??= path.join(sb, 'keep.json');
  if (!fs.existsSync(keepFile)) fs.writeFileSync(keepFile, '[]');
  removalsDir ??= path.join(sb, 'removals-empty');
  fs.mkdirSync(removalsDir, { recursive: true });
  return runBuild(wt, ['--label', label, '--from', 'postprocess', '--to', 'postprocess', '--package-dir', pkgDir, '--keep', keepFile, '--removals', removalsDir, ...extra], 'pp');
}

test('--from postprocess: 出力の commit が作業ツリーの HEAD と一致すれば終了コード 0、productCommit.ok:true、枝が付く', () => {
  const wt = makeRepo('pp-wt-ok');
  const head = headOf(wt);
  const out = makeOutput('pp-out-ok', { commit: head });
  const r = postprocess(wt, out, 'pp-ok');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.rec.result, 'ok');
  assert.equal(r.rec.stoppedAt, null);
  const step = r.rec.steps.find((s) => s.name === 'postprocess');
  assert.equal(step.productCommit.ok, true);
  assert.deepEqual(step.productCommit.problems, []);
  assert.equal(r.rec.sourceVersion.value, head);
  assert.equal(r.rec.branch.ok, true, JSON.stringify(r.rec.branch));
  assert.equal(r.rec.branch.name, 'builds/pp-ok');
  assert.equal(refOf(wt, 'builds/pp-ok').stdout, head);
});
test('--from postprocess: 出力の product.json に commit が無いと終了コード 1・stoppedAt: postprocess・productCommit.ok:false。枝は付けない', () => {
  const wt = makeRepo('pp-wt-none');
  const out = makeOutput('pp-out-none', { commit: undefined });
  const r = postprocess(wt, out, 'pp-none');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.rec.result, 'error');
  assert.equal(r.rec.stoppedAt, 'postprocess');
  const step = r.rec.steps.find((s) => s.name === 'postprocess');
  assert.equal(step.status, 'error');
  assert.equal(step.productCommit.ok, false);
  assert.ok(step.productCommit.problems.length >= 1);
  assert.equal(r.rec.branch, null);
  assert.equal(refOf(wt, 'builds/pp-none').status, 1);
});
test('--from postprocess: 出力の commit が作業ツリーの HEAD と違うと終了コード 1・stoppedAt: postprocess。枝は付けない', () => {
  const wt = makeRepo('pp-wt-diff');
  const out = makeOutput('pp-out-diff', { commit: OTHER });
  const r = postprocess(wt, out, 'pp-diff');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.rec.stoppedAt, 'postprocess');
  const step = r.rec.steps.find((s) => s.name === 'postprocess');
  assert.equal(step.productCommit.ok, false);
  const text = step.productCommit.problems.join(' ');
  assert.ok(text.includes(OTHER) && text.includes(headOf(wt)), text);
  assert.equal(r.rec.branch, null);
  assert.equal(refOf(wt, 'builds/pp-diff').status, 1);
});
test('--from postprocess: 出力の commit が40桁でないと終了コード 1・stoppedAt: postprocess', () => {
  const wt = makeRepo('pp-wt-short');
  const out = makeOutput('pp-out-short', { commit: 'abc123' });
  const r = postprocess(wt, out, 'pp-short');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.rec.stoppedAt, 'postprocess');
  assert.equal(r.rec.steps.find((s) => s.name === 'postprocess').productCommit.ok, false);
});
test('--from postprocess --no-branch: 一致しても枝は付けず branch は null', () => {
  const wt = makeRepo('pp-wt-nb');
  const out = makeOutput('pp-out-nb', { commit: headOf(wt) });
  const r = postprocess(wt, out, 'pp-nb', ['--no-branch']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.rec.branch, null);
  assert.equal(refOf(wt, 'builds/pp-nb').status, 1);
});
test('--from postprocess: 同じ label でやり直して HEAD が変わると、枝は付け替わり警告に出る', () => {
  const wt = makeRepo('pp-wt-redo');
  const first = headOf(wt);
  const r1 = postprocess(wt, makeOutput('pp-out-redo1', { commit: first }), 'pp-redo');
  assert.equal(r1.status, 0, r1.stdout + r1.stderr);
  assert.equal(r1.rec.branch.action, 'created');
  const second = addCommit(wt, 'c.txt');
  const r2 = postprocess(wt, makeOutput('pp-out-redo2', { commit: second }), 'pp-redo');
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.equal(r2.rec.branch.action, 'moved');
  assert.equal(r2.rec.branch.previous, first);
  assert.ok(r2.rec.warnings.some((w) => w.includes('builds/pp-redo') && w.includes(first)), JSON.stringify(r2.rec.warnings));
  assert.equal(refOf(wt, 'builds/pp-redo').stdout, second);
});

// ---- 2. 型検査から始める結線（pnpm が要る。無ければ飛ばす） -----------------------------------------
const hasPnpm = spawnSync('pnpm', ['--version'], { shell: true, encoding: 'utf8' }).status === 0;
const typecheckWt = (name) =>
  makeRepo(name, { 'package.json': JSON.stringify({ name: 'x', version: '0.0.0', scripts: { noop: 'node -e "0"' } }) });

test('型検査から始める: 記録の branch.ok:true、枝が HEAD を指す', { skip: !hasPnpm && 'pnpm が無い' }, () => {
  const wt = typecheckWt('tc-wt');
  const r = runBuild(wt, ['--label', 'tc-1', '--from', 'typecheck', '--to', 'typecheck', '--typecheck-script', 'noop'], 'tc');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.rec.branch.ok, true, JSON.stringify(r.rec.branch));
  assert.equal(r.rec.branch.name, 'builds/tc-1');
  assert.equal(refOf(wt, 'builds/tc-1').stdout, headOf(wt));
});
test('型検査から始める --no-branch: branch は null で枝ができない', { skip: !hasPnpm && 'pnpm が無い' }, () => {
  const wt = typecheckWt('tc-wt-nb');
  const r = runBuild(wt, ['--label', 'tc-2', '--from', 'typecheck', '--to', 'typecheck', '--typecheck-script', 'noop', '--no-branch'], 'tcnb');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.rec.branch, null);
  assert.equal(refOf(wt, 'builds/tc-2').status, 1);
});
test('型検査の子の環境に外の BUILD_SOURCEVERSION が漏れない（記録の envRemovedForChildren に出る）', () => {
  const wt = makeRepo('leak-wt');
  const n = ++seq;
  const record = path.join(sb, `rec-leak-${n}.json`);
  const r = runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--label', 'leak-1', '--config', path.join(sb, 'cfg.json'), '--build-root', path.join(sb, 'brd'), '--worktree', wt, '--from', 'typecheck', '--to', 'package', '--record', record], {
    env: { ...baseEnv(), BUILD_SOURCEVERSION: OTHER },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = stdoutJson(r);
  assert.ok(j.envRemovedForChildren.includes('BUILD_SOURCEVERSION'));
  assert.equal(JSON.stringify(j).includes(OTHER), false, '外の値が記録に出ている');
  assert.equal(j.plan.typecheck.env.BUILD_SOURCEVERSION, headOf(wt));
});

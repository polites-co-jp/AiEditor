// tests/c3-check-json.mjs（大岡越前守の台本の照らし役）の検査。
// 蒙恬が取った実際の記録（tasks/2026-11-15-p5-c3-patch/trial/）で「期待どおり」になり、壊した写しでは食い違いが出ることを確かめる。
// 記録が無いとき（片づけで消えたとき）は、手で作った最小の記録で形だけ確かめる。
// Run: node --test tests/c3-check-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B_WARNING_FILE, checkApply, checkStopped, checkTypecheck, kindOf, UNITS_A, UNITS_B } from './c3-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unitJson = readJson(join(REPO, 'removals', 'C-3-remote', 'unit.json'));
const TRIAL = join(REPO, 'tasks', '2026-11-15-p5-c3-patch', 'trial');
const A = join(TRIAL, 'checks-verify-a.json');
const B = join(TRIAL, 'checks-verify-b.json');
const TA = join(TRIAL, 'build-typecheck-verify-a.json');
const TB = join(TRIAL, 'build-typecheck-verify-b.json');
const clone = (o) => JSON.parse(JSON.stringify(o));
const hex = (c) => c.repeat(40);
const ME = 'shuko-apply <apply@shuko.invalid>';

// 最小の記録（実物が無いときと、壊す元）
const mini = (kind) => {
  const ids = kind === 'b' ? UNITS_B : UNITS_A;
  const warn = `delete: ${B_WARNING_FILE} が本家に無い（改名の恐れ）`;
  const edits = (id) => (['C-1-ai', 'C-2-debug', 'C-3-remote'].includes(id) ? { applied: 'ok', commit: hex('b'), subject: `unit ${id}: edits`, conflicts: [] } : { applied: 'none', subject: null, conflicts: [] });
  return {
    result: 'ok', dryRun: false, headCommit: hex('a'), warnings: kind === 'b' ? [`C-2-debug: ${warn}`] : [], errors: [],
    units: ids.map((id) => ({
      id, applied: 'ok',
      ops: id === 'C-3-remote' ? {
        deleted: [...unitJson.delete], missingDeletes: [], removedDependencies: [], missingDependencies: [], productRemoved: [...unitJson.productRemove], productMissing: [],
        removeLines: unitJson.removeLines.map((r) => ({ file: r.file, line: r.line, count: 1, found: 1, ok: true })),
      } : {},
      edits: edits(id),
      warnings: id === 'C-2-debug' ? [warn] : [],
    })),
    checks: {
      remnants: { status: 'ok', items: [] },
      absentStrings: { status: 'ok', items: unitJson.checks.absentStrings.map((s) => ({ unit: 'C-3-remote', text: s.text, in: s.in, hitCount: 0, hits: [] })) },
      registeredKeys: { status: 'ok' },
      commitIdentity: { status: 'ok', items: [] },
    },
    commits: [
      { subject: 'unit C-1-ai: ops', author: ME }, { subject: 'unit C-1-ai: edits', author: ME },
      ...(kind === 'b' ? [{ subject: 'unit C-2-debug: ops', author: ME }, { subject: 'unit C-2-debug: edits', author: ME }] : []),
      { subject: 'unit C-3-remote: ops', author: ME }, { subject: 'unit C-3-remote: edits', author: ME },
    ],
  };
};
const miniT = (head = hex('a')) => ({ result: 'ok', sourceVersion: { value: head, error: null, uncommittedEntries: 0 }, steps: [{ name: 'typecheck', status: 'ok', exitCode: 0, log: 'x' }] });

test('c3-check: 最小の記録(a・b)は期待どおり。組は C-2 の有無で見分ける', () => {
  for (const kind of ['a', 'b']) {
    assert.equal(kindOf(mini(kind)), kind);
    assert.deepEqual(checkApply(mini(kind), unitJson), [], `${kind}`);
    assert.deepEqual(checkTypecheck(miniT(), mini(kind)), []);
  }
  assert.equal(UNITS_A.length, 16);
  assert.equal(UNITS_B.length, 17);
});

test('c3-check: 蒙恬の当て直し a(16単位。C-1 と C-3)の記録と型検査の記録は、食い違いが無い', { skip: existsSync(A) && existsSync(TA) ? false : '記録が無い' }, () => {
  const a = readJson(A);
  assert.equal(kindOf(a), 'a');
  assert.deepEqual(checkApply(a, unitJson), []);
  assert.deepEqual(checkTypecheck(readJson(TA), a), []);
});

test('c3-check: 蒙恬の当て直し b(17単位。C-1、C-2、C-3 の順)の記録と型検査の記録は、食い違いが無い。警告は C-2 の1件だけ', { skip: existsSync(B) && existsSync(TB) ? false : '記録が無い' }, () => {
  const b = readJson(B);
  assert.equal(kindOf(b), 'b');
  assert.deepEqual(checkApply(b, unitJson), []);
  assert.deepEqual(checkTypecheck(readJson(TB), b), []);
  assert.equal(b.units.find((u) => u.id === 'C-2-debug').warnings.length, 1);
  assert.deepEqual(b.units.find((u) => u.id === 'C-3-remote').warnings, []);
});

test('c3-check: 実際の記録で、C-3 の edits が衝突なく当たり、removeLines 13行がどれも found 1、productRemoved が9つ、ロックファイルが ok', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  for (const f of [A, B]) {
    const j = readJson(f);
    const c3 = j.units.find((u) => u.id === 'C-3-remote');
    assert.deepEqual(c3.edits.conflicts, []);
    assert.equal(c3.ops.removeLines.length, 13);
    assert.ok(c3.ops.removeLines.every((r) => r.found === 1 && r.ok === true));
    assert.equal(c3.ops.productRemoved.length, 9);
    assert.deepEqual(c3.ops.productMissing, []);
    assert.equal(j.checks.lockfile.status, 'ok');
    const root = j.checks.lockfile.files.find((x) => x.path === 'pnpm-lock.yaml');
    assert.deepEqual(root.changedSections ?? [], []);
    assert.deepEqual(root.expected.removedPatches, ['foundry-local-sdk']);
  }
});

test('c3-check: 食い違いを見つける（result・単位の欠け・余計な単位・順序・件名・衝突・removeLines・productRemoved・警告・absentStrings・コミット）', () => {
  const c3 = (j) => j.units.find((u) => u.id === 'C-3-remote');
  const cases = [
    ['result', 'a', (j) => { j.result = 'conflict'; }, /result が ok でない/],
    ['dryRun', 'a', (j) => { j.dryRun = true; }, /dryRun/],
    ['HEAD が sha でない', 'a', (j) => { j.headCommit = 'x'; }, /headCommit/],
    ['単位の欠け', 'a', (j) => { j.units = j.units.filter((u) => u.id !== 'B-4-outline-view'); }, /B-4-outline-view が記録に無い/],
    ['単位の適用', 'a', (j) => { j.units[3].applied = 'skipped'; }, /applied が ok でない/],
    ['余計な単位(C-4)', 'a', (j) => { j.units.push({ id: 'C-4-notebook', applied: 'ok' }); }, /想定していない単位/],
    ['順序(C-3 が C-1 より先)', 'a', (j) => { const i = j.units.findIndex((u) => u.id === 'C-3-remote'); const [u] = j.units.splice(i, 1); j.units.unshift(u); }, /C-3 が C-1 より先/],
    ['順序(b で C-2 が C-1 より先)', 'b', (j) => { const i = j.units.findIndex((u) => u.id === 'C-2-debug'); const [u] = j.units.splice(i, 1); j.units.splice(j.units.findIndex((x) => x.id === 'C-1-ai'), 0, u); }, /b の並びが/],
    ['C-3 の件名', 'a', (j) => { c3(j).edits.subject = 'unit C-3-remote: other'; }, /件名が違う/],
    ['C-3 の衝突', 'a', (j) => { c3(j).edits.conflicts = ['x.ts']; }, /衝突/],
    ['C-3 の edits', 'a', (j) => { c3(j).edits.applied = 'none'; }, /edits が ok でない/],
    ['C-1 の衝突', 'a', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.conflicts = ['x.ts']; }, /C-1-ai の edits に衝突/],
    ['C-2 の衝突(b)', 'b', (j) => { j.units.find((u) => u.id === 'C-2-debug').edits.conflicts = ['x.ts']; }, /C-2-debug の edits に衝突/],
    ['b の C-2 の警告が無い', 'b', (j) => { j.units.find((u) => u.id === 'C-2-debug').warnings = []; }, /想定の1件/],
    ['C-3 に警告', 'a', (j) => { c3(j).warnings = ['何か']; }, /C-3-remote の warnings が空でない/],
    ['想定外の全体の警告', 'a', (j) => { j.warnings = ['x']; }, /想定していない warnings/],
    ['b の全体の警告が増える', 'b', (j) => { j.warnings.push('x'); }, /想定していない warnings/],
    ['errors', 'a', (j) => { j.errors = ['x']; }, /errors/],
    ['removeLines が見つからない', 'a', (j) => { const r = c3(j).ops.removeLines[0]; r.found = 0; r.ok = false; }, /removeLines が1行ちょうどで見つからない/],
    ['removeLines が2行に当たる', 'a', (j) => { const r = c3(j).ops.removeLines[0]; r.found = 2; r.count = 2; }, /1行ちょうどで/],
    ['removeLines の記録の行が足りない', 'a', (j) => { c3(j).ops.removeLines.pop(); }, /removeLines の記録が/],
    ['productRemoved が足りない', 'a', (j) => { c3(j).ops.productRemoved.pop(); }, /productRemoved が productRemove と違う/],
    ['productMissing', 'a', (j) => { c3(j).ops.productMissing = ['serverGreeting']; }, /productMissing/],
    ['本家に無い delete', 'a', (j) => { const o = c3(j).ops; o.missingDeletes = [o.deleted.pop()]; }, /本家に無い delete がある/],
    ['delete の数が合わない', 'a', (j) => { c3(j).ops.deleted.pop(); }, /delete の数が合わない/],
    ['remnants', 'a', (j) => { j.checks.remnants.status = 'found'; }, /remnants/],
    ['absentStrings', 'a', (j) => { j.checks.absentStrings.status = 'found'; j.checks.absentStrings.items[0].hitCount = 1; }, /absentStrings が ok でない/],
    ['absentStrings の抜け', 'a', (j) => { j.checks.absentStrings.items.pop(); }, /検査の記録が無い/],
    ['absentStrings の見つかり', 'a', (j) => { j.checks.absentStrings.items[2].hitCount = 2; }, /absentStrings が見つかった/],
    ['registeredKeys', 'a', (j) => { j.checks.registeredKeys.status = 'fail'; }, /registeredKeys/],
    ['commitIdentity', 'a', (j) => { j.checks.commitIdentity.status = 'fail'; }, /commitIdentity/],
    ['コミットの並び(ops が edits の後)', 'a', (j) => { const n = j.commits.length; [j.commits[n - 1], j.commits[n - 2]] = [j.commits[n - 2], j.commits[n - 1]]; }, /並びが違う/],
    ['コミットの作者', 'a', (j) => { j.commits[j.commits.length - 1].author = 'someone <a@b.invalid>'; }, /作者が shuko-apply でない/],
    ['b でコミットの並び(C-2 の edits が C-3 の ops の後)', 'b', (j) => { const i = j.commits.findIndex((c) => c.subject === 'unit C-2-debug: edits'); const [c] = j.commits.splice(i, 1); j.commits.push(c); }, /C-2 の edits が C-3 の ops の後/],
  ];
  for (const [name, kind, mutate, re] of cases) {
    const j = mini(kind);
    mutate(j);
    const bad = checkApply(j, unitJson);
    assert.ok(bad.some((x) => re.test(x)), `${name}: 食い違いを見つけない: ${JSON.stringify(bad)}`);
  }
});

test('c3-check: ロックファイルの fail が食い違いに出る。ok と removed は通る。removedPatches は foundry-local-sdk だけ。pending は見ない', () => {
  const j = mini('a');
  j.checks.lockfile = { status: 'ok', files: [{ path: 'pnpm-lock.yaml', status: 'ok', expected: { removedPatches: ['foundry-local-sdk'] } }, { path: 'extensions/copilot/pnpm-lock.yaml', status: 'removed' }] };
  assert.deepEqual(checkApply(j, unitJson), []);
  j.checks.lockfile.files[0].expected.removedPatches = [];
  assert.ok(checkApply(j, unitJson).some((x) => /removedPatches/.test(x)));
  j.checks.lockfile = { status: 'fail', files: [{ path: 'pnpm-lock.yaml', status: 'fail', changedSections: ['settings'], changedDeps: [] }] };
  assert.ok(checkApply(j, unitJson).some((x) => /pnpm-lock\.yaml が fail/.test(x) && /settings/.test(x)));
  j.checks.lockfile = { status: 'pending' };
  assert.deepEqual(checkApply(j, unitJson), []);
});

test('c3-check: 実際の記録を壊しても食い違いが出る(C-3 の衝突、removeLines、b の警告の増減)', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  const a = clone(readJson(A));
  a.units.find((u) => u.id === 'C-3-remote').edits.conflicts = ['x.ts'];
  assert.ok(checkApply(a, unitJson).some((x) => /衝突/.test(x)));
  const a2 = clone(readJson(A));
  a2.units.find((u) => u.id === 'C-3-remote').ops.removeLines[3].found = 0;
  assert.ok(checkApply(a2, unitJson).some((x) => /1行ちょうどで/.test(x)));
  const b = clone(readJson(B));
  b.units.find((u) => u.id === 'C-3-remote').warnings.push('もう1件');
  assert.ok(checkApply(b, unitJson).some((x) => /C-3-remote の warnings/.test(x)));
});

test('c3-check: C-1 を外した記録(止まる)を照らす。止まっていない・C-3 が当たった・理由が違う、は食い違い', () => {
  const stopped = () => ({
    result: 'fail', errors: ['C-3-remote: after の単位 C-1-ai が先に当たらない（--only に入っていない）'],
    units: [{ id: 'A-1-copilot-extension', applied: 'ok' }], stoppedAt: null,
  });
  assert.deepEqual(checkStopped(stopped()), []);
  // apply が単位の中で止めた形(stoppedAt に理由)も通る
  const j2 = { result: 'fail', errors: [], units: [{ id: 'C-3-remote', applied: 'error' }], stoppedAt: { phase: 'unit', id: 'C-3-remote', message: 'C-3-remote: after の単位が当たっていない: C-1-ai' } };
  assert.deepEqual(checkStopped(j2), []);
  const ok = stopped(); ok.result = 'ok';
  assert.ok(checkStopped(ok).some((x) => /result が ok/.test(x)));
  const ap = stopped(); ap.units.push({ id: 'C-3-remote', applied: 'ok' });
  assert.ok(checkStopped(ap).some((x) => /C-3-remote が applied: ok/.test(x)));
  const why = stopped(); why.errors = ['何か別の誤り'];
  assert.ok(checkStopped(why).some((x) => /理由の誤りが記録に無い/.test(x)));
  const c1 = stopped(); c1.units.push({ id: 'C-1-ai', applied: 'ok' });
  assert.ok(checkStopped(c1).some((x) => /C-1-ai が当たっている/.test(x)));
});

test('c3-check: 型検査の食い違いを見つける（result・exitCode・HEAD の不一致・未コミット）', () => {
  const run = (mut) => { const t = miniT(); mut(t); return checkTypecheck(t, mini('a')); };
  assert.ok(run((t) => { t.result = 'failed'; }).some((x) => /result/.test(x)));
  assert.ok(run((t) => { t.steps[0].exitCode = 2; }).some((x) => /exitCode/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.value = hex('b'); }).some((x) => /HEAD/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.uncommittedEntries = 3; }).some((x) => /未コミット/.test(x)));
  assert.ok(run((t) => { t.steps = []; }).some((x) => /steps\[0\]/.test(x)));
});

test('c3-check: 元の記録は壊さない（読むだけ）', () => {
  const j = mini('b');
  const before = clone(j);
  checkApply(j, unitJson);
  assert.deepEqual(j, before);
});

test('c3-check: コマンドとして走らせると、実際の記録で 0、壊した引数で 2、別の組の型検査で 1。--stopped も走る', { skip: existsSync(A) && existsSync(TA) && existsSync(TB) ? false : '記録が無い' }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c3-check-json.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const ok = run(A, TA);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /期待どおり（組 a/);
  assert.equal(run().status, 2);
  assert.equal(run(join(TRIAL, 'nonexistent.json')).status, 2);
  assert.equal(run(A, join(TRIAL, 'nonexistent.json')).status, 2);
  const mix = run(A, TB);
  assert.equal(mix.status, 1, mix.stdout);
  assert.match(mix.stdout, /HEAD/);
  // --stopped: 成功した記録(A)は「止まっていない」ので食い違い、止まった形の記録は 0
  assert.equal(run('--stopped', A).status, 1);
  const dir = mkdtempSync(join(tmpdir(), 'c3stop-'));
  try {
    const f = join(dir, 'stopped.json');
    writeFileSync(f, JSON.stringify({ result: 'fail', errors: ['C-3-remote: after の単位 C-1-ai が先に当たらない（--only に入っていない）'], units: [], stoppedAt: null }));
    const st = run('--stopped', f);
    assert.equal(st.status, 0, st.stdout + st.stderr);
    assert.match(st.stdout, /止まる/);
    assert.equal(run('--stopped').status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

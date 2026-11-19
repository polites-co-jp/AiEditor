// tests/c6-check-json.mjs（大岡越前守の台本の照らし役）の検査。
// 蒙恬が取った実際の記録（tasks/2026-11-15-p5-c6-patch/trial/ の checks-verify-{a,b}.json・build-typecheck-verify-{a,b}.json）で
// 「期待どおり」になり、壊した写しでは食い違いが出ることを確かめる。記録が無いとき（片づけで消えたとき）は、手で作った最小の記録で形だけ確かめる。
// Run: node --test tests/c6-check-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AFTER, C2_WARNING_FILE, checkApply, checkStopped, checkTypecheck, kindOf, UNITS_A, UNITS_B, UNITS_C } from './c6-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const ME = 'C-6-settings-sync';
const unitJson = readJson(join(REPO, 'removals', ME, 'unit.json'));
const TRIAL = join(REPO, 'tasks', '2026-11-15-p5-c6-patch', 'trial');
const A = join(TRIAL, 'checks-verify-a.json');
const B = join(TRIAL, 'checks-verify-b.json');
const TA = join(TRIAL, 'build-typecheck-verify-a.json');
const TB = join(TRIAL, 'build-typecheck-verify-b.json');
const clone = (o) => JSON.parse(JSON.stringify(o));
const hex = (c) => c.repeat(40);
const AUTHOR = 'sukuna-apply <apply@sukuna.invalid>';

// 最小の記録（実物が無いときと、壊す元）
const mini = (kind) => {
  const ids = kind === 'b' ? UNITS_B : UNITS_A;
  const warn = `delete: ${C2_WARNING_FILE} が本家に無い（改名の恐れ）`;
  const edits = (id) => (/^C-/.test(id) ? { applied: 'ok', commit: hex('b'), subject: `unit ${id}: edits`, conflicts: [] } : { applied: 'none', subject: null, conflicts: [] });
  const order = ids.filter((x) => /^C-/.test(x));
  return {
    result: 'ok', dryRun: false, headCommit: hex('a'), warnings: kind === 'b' ? [`C-2-debug: ${warn}`] : [], errors: [],
    units: ids.map((id) => ({
      id, applied: 'ok',
      ops: id === ME ? {
        deleted: [...unitJson.delete], missingDeletes: [], removedDependencies: [], missingDependencies: [], productRemoved: [], productMissing: [],
        removeLines: unitJson.removeLines.map((r) => ({ file: r.file, line: r.line, count: 1, found: 1, ok: true })),
      } : {},
      edits: edits(id),
      warnings: id === 'C-2-debug' ? [warn] : [],
    })),
    checks: {
      remnants: { status: 'ok', items: [] },
      absentStrings: { status: 'ok', items: unitJson.checks.absentStrings.map((s) => ({ unit: ME, text: s.text, in: s.in, hitCount: 0, hits: [] })) },
      registeredKeys: { status: 'ok' },
      commitIdentity: { status: 'ok', items: [] },
    },
    commits: order.flatMap((id) => [{ subject: `unit ${id}: ops`, author: AUTHOR }, { subject: `unit ${id}: edits`, author: AUTHOR }]),
  };
};
const miniT = (head = hex('a')) => ({ result: 'ok', sourceVersion: { value: head, error: null, uncommittedEntries: 0 }, steps: [{ name: 'typecheck', status: 'ok', exitCode: 0, log: 'x' }] });

test('c6-check: 最小の記録(a・b)は期待どおり。組は C-2 の有無で見分ける', () => {
  for (const kind of ['a', 'b']) {
    assert.equal(kindOf(mini(kind)), kind);
    assert.deepEqual(checkApply(mini(kind), unitJson), [], `${kind}`);
    assert.deepEqual(checkTypecheck(miniT(), mini(kind)), []);
  }
  assert.equal(UNITS_A.length, 16);
  assert.equal(UNITS_B.length, 20);
  assert.deepEqual([...AFTER].sort(), [...unitJson.after].sort(), 'unit.json の after と照らし役の AFTER が違う');
});

test('c6-check: 蒙恬の当て直し a(16単位。C-1 と C-6)の記録と型検査の記録は、食い違いが無い。警告は無い', { skip: existsSync(A) && existsSync(TA) ? false : '記録が無い' }, () => {
  const a = readJson(A);
  assert.equal(kindOf(a), 'a');
  assert.deepEqual(checkApply(a, unitJson), []);
  assert.deepEqual(checkTypecheck(readJson(TA), a), []);
  assert.deepEqual(a.warnings, []);
});

test('c6-check: 蒙恬の当て直し b(20単位。C-1〜C-6 の順)の記録と型検査の記録は、食い違いが無い。警告は C-2 の1件だけ', { skip: existsSync(B) && existsSync(TB) ? false : '記録が無い' }, () => {
  const b = readJson(B);
  assert.equal(kindOf(b), 'b');
  assert.deepEqual(checkApply(b, unitJson), []);
  assert.deepEqual(checkTypecheck(readJson(TB), b), []);
  assert.equal(b.units.find((u) => u.id === 'C-2-debug').warnings.length, 1);
  assert.deepEqual(b.units.find((u) => u.id === ME).warnings, []);
});

test('c6-check: 実際の記録で、C-6 の edits が衝突なく当たり、removeLines 3行がどれも found 1、delete 2がすべて消え、依存は消さない', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  for (const f of [A, B]) {
    const j = readJson(f);
    const me = j.units.find((u) => u.id === ME);
    assert.deepEqual(me.edits.conflicts, []);
    assert.equal(me.ops.removeLines.length, 3);
    assert.ok(me.ops.removeLines.every((r) => r.found === 1 && r.ok === true));
    assert.deepEqual(me.ops.missingDeletes, []);
    assert.equal(me.ops.deleted.length, 2);
    assert.deepEqual(me.ops.removedDependencies ?? [], []);
    assert.deepEqual(me.ops.productRemoved ?? [], []);
    if (j.checks.lockfile && !['pending', 'skipped'].includes(j.checks.lockfile.status)) {
      const root = j.checks.lockfile.files.find((x) => x.path === 'pnpm-lock.yaml');
      assert.deepEqual(root.expected.removedPatches, ['foundry-local-sdk']);
    }
  }
});

test('c6-check: 実際の記録の absentStrings に、C-6 の unit.json の9項目がすべてあり、見つかったものが無い', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  for (const f of [A, B]) {
    const j = readJson(f);
    const mine = j.checks.absentStrings.items.filter((i) => i.unit === ME);
    assert.equal(mine.length, unitJson.checks.absentStrings.length);
    assert.equal(mine.length, 9);
    for (const t of ['IUserDataSyncWorkbenchService', 'SyncControls', 'onDidTurnOnSync', 'last-synced-label']) assert.ok(mine.some((i) => i.text === t), `${t} の検査の記録が無い`);
    assert.deepEqual(mine.filter((i) => i.hitCount !== 0), []);
  }
});

test('c6-check: 食い違いを見つける（result・単位の欠け・余計な単位・順序・件名・衝突・removeLines・delete・依存・警告・absentStrings・コミット）', () => {
  const me = (j) => j.units.find((u) => u.id === ME);
  const cases = [
    ['result', 'a', (j) => { j.result = 'conflict'; }, /result が ok でない/],
    ['dryRun', 'a', (j) => { j.dryRun = true; }, /dryRun/],
    ['HEAD が sha でない', 'a', (j) => { j.headCommit = 'x'; }, /headCommit/],
    ['単位の欠け', 'a', (j) => { j.units = j.units.filter((u) => u.id !== 'B-4-outline-view'); }, /B-4-outline-view が記録に無い/],
    ['単位の適用', 'a', (j) => { j.units[3].applied = 'skipped'; }, /applied が ok でない/],
    ['余計な単位(C-7)', 'a', (j) => { j.units.push({ id: 'C-7-other', applied: 'ok' }); }, /想定していない単位/],
    ['順序(C-6 が C-1 より先)', 'a', (j) => { const i = j.units.findIndex((u) => u.id === ME); const [u] = j.units.splice(i, 1); j.units.splice(j.units.findIndex((x) => x.id === 'C-1-ai'), 0, u); }, /C-6 が前提の C-1-ai より先/],
    ['順序(b で C-5 が C-6 の後)', 'b', (j) => { const i = j.units.findIndex((u) => u.id === 'C-5-extension-gallery'); const [u] = j.units.splice(i, 1); j.units.push(u); }, /b の並びが/],
    ['C-6 の件名', 'a', (j) => { me(j).edits.subject = 'unit C-6-settings-sync: other'; }, /件名が違う/],
    ['C-6 の衝突', 'a', (j) => { me(j).edits.conflicts = ['x.ts']; }, /衝突/],
    ['C-6 の edits', 'a', (j) => { me(j).edits.applied = 'none'; }, /edits が ok でない/],
    ['C-1 の衝突', 'a', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.conflicts = ['x.ts']; }, /C-1-ai の edits に衝突/],
    ['C-5 の衝突(b)', 'b', (j) => { j.units.find((u) => u.id === 'C-5-extension-gallery').edits.conflicts = ['x.ts']; }, /C-5-extension-gallery の edits に衝突/],
    ['b の C-2 の警告が無い', 'b', (j) => { j.units.find((u) => u.id === 'C-2-debug').warnings = []; }, /想定の1件/],
    ['C-6 に警告', 'a', (j) => { me(j).warnings = ['何か']; }, /C-6-settings-sync の warnings が空でない/],
    ['a の全体に警告', 'a', (j) => { j.warnings = ['x']; }, /想定していない warnings|0 件でない/],
    ['b の全体の警告が増える', 'b', (j) => { j.warnings.push('x'); }, /想定していない warnings|1 件でない/],
    ['errors', 'a', (j) => { j.errors = ['x']; }, /errors/],
    ['removeLines が見つからない', 'a', (j) => { const r = me(j).ops.removeLines[0]; r.found = 0; r.ok = false; }, /removeLines が1行ちょうどで見つからない/],
    ['removeLines の記録の行が足りない', 'a', (j) => { me(j).ops.removeLines.pop(); }, /removeLines の記録が/],
    ['productRemoved', 'a', (j) => { me(j).ops.productRemoved = ['x']; }, /productRemove は空/],
    ['依存を消した', 'a', (j) => { me(j).ops.removedDependencies = ['x']; }, /依存は消さない/],
    ['本家に無い delete', 'a', (j) => { const o = me(j).ops; o.missingDeletes = [o.deleted.pop()]; }, /本家に無い delete がある/],
    ['delete の数が合わない', 'a', (j) => { me(j).ops.deleted.pop(); }, /delete の数が合わない/],
    ['delete の記録に無い', 'a', (j) => { me(j).ops.deleted[0] = 'src/vs/other'; }, /delete の記録に無い/],
    ['remnants', 'a', (j) => { j.checks.remnants.status = 'found'; }, /remnants/],
    ['absentStrings', 'a', (j) => { j.checks.absentStrings.status = 'found'; j.checks.absentStrings.items[0].hitCount = 1; }, /absentStrings が ok でない/],
    ['absentStrings の抜け', 'a', (j) => { j.checks.absentStrings.items.pop(); }, /検査の記録が無い/],
    ['absentStrings の見つかり', 'a', (j) => { j.checks.absentStrings.items[2].hitCount = 2; }, /absentStrings が見つかった/],
    ['registeredKeys', 'a', (j) => { j.checks.registeredKeys.status = 'fail'; }, /registeredKeys/],
    ['commitIdentity', 'a', (j) => { j.checks.commitIdentity.status = 'fail'; }, /commitIdentity/],
    ['コミットの並び(ops が edits の後)', 'a', (j) => { const n = j.commits.length; [j.commits[n - 1], j.commits[n - 2]] = [j.commits[n - 2], j.commits[n - 1]]; }, /並びが違う/],
    ['コミットの作者', 'a', (j) => { j.commits[j.commits.length - 1].author = 'someone <a@b.invalid>'; }, /作者が sukuna-apply でない/],
    ['b でコミットの並び(C-5 の edits が C-6 の ops の後)', 'b', (j) => { const i = j.commits.findIndex((c) => c.subject === 'unit C-5-extension-gallery: edits'); const [c] = j.commits.splice(i, 1); j.commits.push(c); }, /C-5-extension-gallery の edits が C-6 の ops の後/],
  ];
  for (const [name, kind, mutate, re] of cases) {
    const j = mini(kind);
    mutate(j);
    const bad = checkApply(j, unitJson);
    assert.ok(bad.some((x) => re.test(x)), `${name}: 食い違いを見つけない: ${JSON.stringify(bad)}`);
  }
});

test('c6-check: ロックファイルの fail が食い違いに出る。ok と removed は通る。removedPatches は foundry-local-sdk だけ。pending は見ない', () => {
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

test('c6-check: 実際の記録を壊しても食い違いが出る(C-6 の衝突、removeLines、a に警告、b の C-2 の警告の増減)', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  const a = clone(readJson(A));
  a.units.find((u) => u.id === ME).edits.conflicts = ['x.ts'];
  assert.ok(checkApply(a, unitJson).some((x) => /衝突/.test(x)));
  const a2 = clone(readJson(A));
  a2.units.find((u) => u.id === ME).ops.removeLines[1].found = 0;
  assert.ok(checkApply(a2, unitJson).some((x) => /1行ちょうどで/.test(x)));
  const a3 = clone(readJson(A));
  a3.warnings.push('何か');
  assert.ok(checkApply(a3, unitJson).some((x) => /想定していない warnings/.test(x)));
  const b = clone(readJson(B));
  b.units.find((u) => u.id === 'C-2-debug').warnings.push('もう1件');
  assert.ok(checkApply(b, unitJson).some((x) => /C-2-debug の warnings/.test(x)));
});

test('c6-check: C-1 を外した記録(止まる)を照らす。止まっていない・C-6 が当たった・理由が違う・C-1 が当たっている、は食い違い', () => {
  const stopped = () => ({
    result: 'fail', errors: ['C-6-settings-sync: after の単位 C-1-ai が先に当たらない（--only に入っていない）'],
    units: [{ id: 'A-1-copilot-extension', applied: 'ok' }], stoppedAt: null,
  });
  assert.deepEqual(checkStopped(stopped()), []);
  const j2 = { result: 'fail', errors: [], units: [{ id: ME, applied: 'error' }], stoppedAt: { phase: 'unit', id: ME, message: 'C-6-settings-sync: after の単位が当たっていない: C-1-ai' } };
  assert.deepEqual(checkStopped(j2), []);
  const ok = stopped(); ok.result = 'ok';
  assert.ok(checkStopped(ok).some((x) => /result が ok/.test(x)));
  const ap = stopped(); ap.units.push({ id: ME, applied: 'ok' });
  assert.ok(checkStopped(ap).some((x) => /C-6-settings-sync が applied: ok/.test(x)));
  const why = stopped(); why.errors = ['何か別の誤り'];
  assert.ok(checkStopped(why).some((x) => /理由の誤りが記録に無い/.test(x)));
  const c1 = stopped(); c1.units.push({ id: 'C-1-ai', applied: 'ok' });
  assert.ok(checkStopped(c1).some((x) => /C-1-ai が当たっている/.test(x)));
});

// 大岡越前守の実記録(tasks/2026-11-15-p5-c1-c6-c7-verify/run/)。段階 C のすべて(21単位。組 c)でも C-6 を照らせる
const RUN = join(REPO, 'tasks', '2026-11-15-p5-c1-c6-c7-verify', 'run');
const haveRun = ['checks-21.json', 'typecheck-21.json', 'checks-c6-noc1.json'].every((f) => existsSync(join(RUN, f)));
test('c6-check: 実記録の 21 単位(組 c。C-1〜C-7)の当て直しと型検査は、C-6 として期待どおり。警告は C-2 の1件', { skip: haveRun ? false : '記録が無い' }, () => {
  const j = readJson(join(RUN, 'checks-21.json'));
  assert.equal(kindOf(j), 'c');
  assert.equal(UNITS_C.length, 21);
  assert.deepEqual(checkApply(j, unitJson), []);
  assert.deepEqual(checkTypecheck(readJson(join(RUN, 'typecheck-21.json')), j), []);
  assert.equal(j.warnings.length, 1);
});

test('c6-check: 21 単位の記録を壊すと食い違いが出る(単位の欠け・C-6 の衝突・順序・警告が無い)', { skip: haveRun ? false : '記録が無い' }, () => {
  const base = readJson(join(RUN, 'checks-21.json'));
  const me = (j) => j.units.find((u) => u.id === ME);
  const cases = [
    [(j) => { j.units = j.units.filter((u) => u.id !== 'C-5-extension-gallery'); }, /C-5-extension-gallery が記録に無い/],
    [(j) => { me(j).edits.conflicts = ['x.ts']; }, /衝突/],
    [(j) => { j.units.find((u) => u.id === 'C-7-breadcrumbs-outline').applied = 'skipped'; }, /applied が ok でない/],
    [(j) => { j.warnings = []; }, /1 件でない/],
    [(j) => { const i = j.units.findIndex((u) => u.id === ME); const [u] = j.units.splice(i, 1); j.units.splice(j.units.findIndex((x) => x.id === 'C-1-ai'), 0, u); }, /C-6 が前提の C-1-ai より先/],
  ];
  for (const [mutate, re] of cases) {
    const j = clone(base);
    mutate(j);
    assert.ok(checkApply(j, unitJson).some((x) => re.test(x)), `${re} が出ない`);
  }
});

test('c6-check: 実記録の C-1 を外した記録(checks-c6-noc1.json)は「止まる」で期待どおり。コマンドも 0', { skip: haveRun ? false : '記録が無い' }, () => {
  const j = readJson(join(RUN, 'checks-c6-noc1.json'));
  assert.deepEqual(checkStopped(j), []);
  const r = spawnSync(process.execPath, [join('tests', 'c6-check-json.mjs'), '--stopped', join(RUN, 'checks-c6-noc1.json')], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const r21 = spawnSync(process.execPath, [join('tests', 'c6-check-json.mjs'), join(RUN, 'checks-21.json'), join(RUN, 'typecheck-21.json')], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r21.status, 0, r21.stdout + r21.stderr);
  assert.match(r21.stdout, /組 c/);
});

test('c6-check: 型検査の食い違いを見つける（result・exitCode・HEAD の不一致・未コミット）', () => {
  const run = (mut) => { const t = miniT(); mut(t); return checkTypecheck(t, mini('a')); };
  assert.ok(run((t) => { t.result = 'failed'; }).some((x) => /result/.test(x)));
  assert.ok(run((t) => { t.steps[0].exitCode = 2; }).some((x) => /exitCode/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.value = hex('b'); }).some((x) => /HEAD/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.uncommittedEntries = 3; }).some((x) => /未コミット/.test(x)));
  assert.ok(run((t) => { t.steps = []; }).some((x) => /steps\[0\]/.test(x)));
});

test('c6-check: 元の記録は壊さない（読むだけ）', () => {
  const j = mini('b');
  const before = clone(j);
  checkApply(j, unitJson);
  assert.deepEqual(j, before);
});

test('c6-check: コマンドとして走らせると、実際の記録で 0、壊した引数で 2、別の組の型検査で 1。--stopped も走る', { skip: existsSync(A) && existsSync(TA) && existsSync(TB) ? false : '記録が無い' }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c6-check-json.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const ok = run(A, TA);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /期待どおり（組 a/);
  assert.equal(run().status, 2);
  assert.equal(run(join(TRIAL, 'nonexistent.json')).status, 2);
  assert.equal(run(A, join(TRIAL, 'nonexistent.json')).status, 2);
  const mix = run(A, TB);
  assert.equal(mix.status, 1, mix.stdout);
  assert.match(mix.stdout, /HEAD/);
  assert.equal(run('--stopped', A).status, 1, '成功した記録は「止まっていない」ので食い違い');
  const dir = mkdtempSync(join(tmpdir(), 'c6stop-'));
  try {
    const f = join(dir, 'stopped.json');
    writeFileSync(f, JSON.stringify({ result: 'fail', errors: ['C-6-settings-sync: after の単位 C-1-ai が先に当たらない（--only に入っていない）'], units: [], stoppedAt: null }));
    const st = run('--stopped', f);
    assert.equal(st.status, 0, st.stdout + st.stderr);
    assert.match(st.stdout, /止まる/);
    assert.equal(run('--stopped').status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

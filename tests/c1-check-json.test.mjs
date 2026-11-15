// tests/c1-check-json.mjs（大岡越前守の台本の照らし役）の検査。
// 蒙恬が取った実際の記録（tasks/2026-11-15-p5-c1-patch/trial/）で「期待どおり」になり、壊した写しでは食い違いが出ることを確かめる。
// 記録が無いとき（片づけで消えたとき）は、手で作った最小の記録で形だけ確かめる。
// Run: node --test tests/c1-check-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApply, checkTypecheck, EXPECTED_UNITS } from './c1-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unitJson = readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json'));
const TRIAL = join(REPO, 'tasks', '2026-11-15-p5-c1-patch', 'trial');
// 5回目(NullChatEntitlementService を chatEntitlementService.ts の末尾へ移し、allowBuilds の4行を足した後)の当て直しと型検査。
// 当て直しの記録は --lockfile-check つき(ロックファイルの検査も同じ記録に追記してある)。
const A = join(TRIAL, 'round5-checks-verify.json');
const T = join(TRIAL, 'round5-typecheck-verify.json');
const L = A;
const clone = (o) => JSON.parse(JSON.stringify(o));

// 最小の記録（実物が無いときと、壊す元）
const mini = () => ({
  result: 'ok', dryRun: false, headCommit: 'a'.repeat(40),
  units: EXPECTED_UNITS.map((id) => ({ id, applied: 'ok', edits: id === 'C-1-ai' ? { applied: 'ok', subject: 'unit C-1-ai: edits', conflicts: [] } : { applied: 'none', subject: null, conflicts: [] } })),
  builtinExtensions: { removedDefaults: [{ key: 'chat.disableAIFeatures', unit: 'C-1-ai' }] },
  checks: {
    remnants: { status: 'ok', items: [] },
    absentStrings: { status: 'ok', items: (unitJson.checks.absentStrings).map((s) => ({ unit: 'C-1-ai', text: s.text, in: s.in, hitCount: 0, hits: [] })) },
  },
});
const miniT = () => ({ result: 'ok', sourceVersion: { value: 'a'.repeat(40), error: null, uncommittedEntries: 0 }, steps: [{ name: 'typecheck', status: 'ok', exitCode: 0, log: 'x' }] });

test('c1-check: 最小の記録は期待どおり', () => {
  assert.deepEqual(checkApply(mini(), unitJson), []);
  assert.deepEqual(checkTypecheck(miniT(), mini()), []);
});

test('c1-check: 蒙恬の5回目の当て直しの記録(round5-checks-verify.json)と型検査の記録(round5-typecheck-verify.json)は、食い違いが無い', { skip: existsSync(A) && existsSync(T) ? false : '記録が無い' }, () => {
  // unit.json の absentStrings は全項目が記録にある(検査の記録が無いもの、も出ない)。ロックファイルの検査も記録に入っていて ok。
  const a = readJson(A);
  assert.deepEqual(checkApply(a, unitJson), []);
  // 型検査の HEAD が、当て直しの記録の HEAD と同じ(当て直しの後に作業ツリーが動いていない)
  assert.deepEqual(checkTypecheck(readJson(T), a), []);
});

test('c1-check: 5回目の当て直しの記録は、ロックファイルが ok で、foundry-local-sdk の節の減りだけが許されている', { skip: existsSync(L) ? false : '記録が無い' }, () => {
  const l = readJson(L);
  const bad = checkApply(l, unitJson).filter((x) => /lockfile|result が ok でない/.test(x));
  assert.deepEqual(bad, []);
  assert.equal(l.checks.lockfile.status, 'ok');
  const root = l.checks.lockfile.files.find((f) => f.path === 'pnpm-lock.yaml');
  assert.ok(root && root.status === 'ok');
  assert.deepEqual(root.expected.removedPatches, ['foundry-local-sdk']);
  assert.deepEqual(root.changedSections ?? [], []);
  assert.deepEqual(root.unexpectedPatchChanges ?? [], []);
});

test('c1-check: 5回目の記録で、C-1 の edits が衝突なく当たり、15単位すべてが適用されている', { skip: existsSync(A) ? false : '記録が無い' }, () => {
  const a = readJson(A);
  const c1 = a.units.find((u) => u.id === 'C-1-ai');
  assert.deepEqual(c1.edits.conflicts, []);
  assert.equal(a.units.filter((u) => EXPECTED_UNITS.includes(u.id) && u.applied === 'ok').length, EXPECTED_UNITS.length);
});

test('c1-check: 最小の記録にロックファイルの fail があると食い違いに出る。ok と removed は通る', () => {
  const j = mini();
  j.checks.lockfile = { status: 'ok', files: [{ path: 'pnpm-lock.yaml', status: 'ok' }, { path: 'extensions/copilot/pnpm-lock.yaml', status: 'removed' }] };
  assert.deepEqual(checkApply(j, unitJson), []);
  j.checks.lockfile = { status: 'fail', files: [{ path: 'pnpm-lock.yaml', status: 'fail', changedSections: ['settings'], changedDeps: [] }] };
  const bad = checkApply(j, unitJson);
  assert.ok(bad.some((x) => /pnpm-lock\.yaml が fail/.test(x) && /settings/.test(x)), JSON.stringify(bad));
  // --lockfile-check をかけていない記録(pending)は、ロックファイルを見ない
  j.checks.lockfile = { status: 'pending' };
  assert.deepEqual(checkApply(j, unitJson), []);
});

test('c1-check: 食い違いを見つける（result・単位の欠け・edits の件名・衝突・removedDefaults・absentStrings・dryRun）', () => {
  const cases = [
    ['result', (j) => { j.result = 'conflict'; }, /result が ok でない/],
    ['単位の欠け', (j) => { j.units = j.units.filter((u) => u.id !== 'B-4-outline-view'); }, /B-4-outline-view が記録に無い/],
    ['単位の適用', (j) => { j.units[3].applied = 'skipped'; }, /applied が ok でない/],
    ['C-1 の件名', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.subject = 'unit C-1-ai: other'; }, /件名が違う/],
    ['C-1 の衝突', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.conflicts = ['x.ts']; }, /衝突/],
    ['C-1 の edits', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.applied = 'none'; }, /edits が ok でない/],
    ['remnants', (j) => { j.checks.remnants.status = 'found'; }, /remnants/],
    ['absentStrings', (j) => { j.checks.absentStrings.status = 'found'; j.checks.absentStrings.items[0].hitCount = 1; }, /absentStrings が ok でない/],
    ['absentStrings の抜け', (j) => { j.checks.absentStrings.items.pop(); }, /検査の記録が無い/],
    ['removedDefaults', (j) => { j.builtinExtensions.removedDefaults = []; }, /removedDefaults/],
    ['dryRun', (j) => { j.dryRun = true; }, /dryRun/],
  ];
  for (const [name, mutate, re] of cases) {
    const j = mini();
    mutate(j);
    const bad = checkApply(j, unitJson);
    assert.ok(bad.some((x) => re.test(x)), `${name}: 食い違いを見つけない: ${JSON.stringify(bad)}`);
  }
});

test('c1-check: 型検査の食い違いを見つける（result・exitCode・HEAD の不一致・未コミット）', () => {
  const run = (mut) => { const t = miniT(); mut(t); return checkTypecheck(t, mini()); };
  assert.ok(run((t) => { t.result = 'failed'; }).some((x) => /result/.test(x)));
  assert.ok(run((t) => { t.steps[0].exitCode = 2; }).some((x) => /exitCode/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.value = 'b'.repeat(40); }).some((x) => /HEAD/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.uncommittedEntries = 3; }).some((x) => /未コミット/.test(x)));
  assert.ok(run((t) => { t.steps = []; }).some((x) => /steps\[0\]/.test(x)));
});

test('c1-check: 元の記録は壊さない（読むだけ）', () => {
  const j = mini();
  const before = clone(j);
  checkApply(j, unitJson);
  assert.deepEqual(j, before);
});

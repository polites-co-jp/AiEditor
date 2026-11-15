// tests/c2-check-json.mjs（大岡越前守の台本の照らし役）の検査。
// 蒙恬が取った実際の記録（tasks/2026-11-15-p5-c2-patch/trial/）で「期待どおり」になり、壊した写しでは食い違いが出ることを確かめる。
// 記録が無いとき（片づけで消えたとき）は、手で作った最小の記録で形だけ確かめる。
// Run: node --test tests/c2-check-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B_WARNING_FILE, checkApply, checkTypecheck, kindOf, UNITS_A, UNITS_B } from './c2-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unitJson = readJson(join(REPO, 'removals', 'C-2-debug', 'unit.json'));
const TRIAL = join(REPO, 'tasks', '2026-11-15-p5-c2-patch', 'trial');
// 当て直しの2つの組の記録(タグから。a は15単位、b は16単位)と、それぞれの上の型検査。どちらも --lockfile-check つき
const A = join(TRIAL, 'checks-verify-a.json');
const B = join(TRIAL, 'checks-verify-b.json');
const TA = join(TRIAL, 'build-typecheck-verify-a.json');
const TB = join(TRIAL, 'build-typecheck-verify-b.json');
const clone = (o) => JSON.parse(JSON.stringify(o));
// 蒙恬の実記録は、absentStrings の2つを替える前の unit.json で取った(2回目で `debug/browser/debugService.js'`・`linkDetector.js'` を
// `/debugService.js'`・`/linkDetector.js'` に替えた)。記録に新しい文字列が無いときだけ、古い文字列に戻した unit.json で照らす。
// 記録を取り直したら(新しい文字列が記録にある)、この読み替えは働かない。
const OLD_ABSENT = { "/debugService.js'": "debug/browser/debugService.js'", "/linkDetector.js'": "debug/browser/linkDetector.js'" };
const unitFor = (rec) => {
  const have = new Set((rec.checks?.absentStrings?.items ?? []).filter((i) => i.unit === 'C-2-debug').map((i) => i.text));
  const u = clone(unitJson);
  u.checks.absentStrings = u.checks.absentStrings.map((s) => (!have.has(s.text) && OLD_ABSENT[s.text] && have.has(OLD_ABSENT[s.text]) ? { ...s, text: OLD_ABSENT[s.text] } : s));
  return u;
};
const hex = (c) => c.repeat(40);

// 最小の記録（実物が無いときと、壊す元）
const mini = (kind) => {
  const ids = kind === 'b' ? UNITS_B : UNITS_A;
  const missing = kind === 'b' ? [B_WARNING_FILE] : [];
  const warn = kind === 'b' ? [`delete: ${B_WARNING_FILE} が本家に無い（改名の恐れ）`] : [];
  return {
    result: 'ok', dryRun: false, headCommit: hex('a'), warnings: kind === 'b' ? [`C-2-debug: ${warn[0]}`] : [], errors: [],
    units: ids.map((id) => ({
      id, applied: 'ok',
      ops: id === 'C-2-debug' ? {
        deleted: unitJson.delete.filter((d) => !missing.includes(d)), missingDeletes: missing, removedDependencies: [], missingDependencies: [],
        removeLines: unitJson.removeLines.map((r) => ({ file: r.file, line: r.line, count: 1, found: 1, ok: true })),
      } : {},
      edits: id === 'C-2-debug' ? { applied: 'ok', commit: hex('b'), subject: 'unit C-2-debug: edits', conflicts: [] }
        : id === 'C-1-ai' ? { applied: 'ok', commit: hex('c'), subject: 'unit C-1-ai: edits', conflicts: [] } : { applied: 'none', subject: null, conflicts: [] },
      warnings: id === 'C-2-debug' ? warn : [],
    })),
    checks: {
      remnants: { status: 'ok', items: [] },
      absentStrings: { status: 'ok', items: unitJson.checks.absentStrings.map((s) => ({ unit: 'C-2-debug', text: s.text, in: s.in, hitCount: 0, hits: [] })) },
      registeredKeys: { status: 'ok' },
      commitIdentity: { status: 'ok', items: [] },
    },
    commits: [
      ...(kind === 'b' ? [{ subject: 'unit C-1-ai: ops', author: 'shuko-apply <apply@shuko.invalid>' }, { subject: 'unit C-1-ai: edits', author: 'shuko-apply <apply@shuko.invalid>' }] : []),
      { subject: 'unit C-2-debug: ops', author: 'shuko-apply <apply@shuko.invalid>' }, { subject: 'unit C-2-debug: edits', author: 'shuko-apply <apply@shuko.invalid>' },
    ],
  };
};
const miniT = (head = hex('a')) => ({ result: 'ok', sourceVersion: { value: head, error: null, uncommittedEntries: 0 }, steps: [{ name: 'typecheck', status: 'ok', exitCode: 0, log: 'x' }] });

test('c2-check: 最小の記録(a・b)は期待どおり。組は単位の並びで見分ける', () => {
  for (const kind of ['a', 'b']) {
    assert.equal(kindOf(mini(kind)), kind);
    assert.deepEqual(checkApply(mini(kind), unitJson), [], `${kind}`);
    assert.deepEqual(checkTypecheck(miniT(), mini(kind)), []);
  }
  assert.equal(UNITS_A.length, 15);
  assert.equal(UNITS_B.length, 16);
});

test('c2-check: 蒙恬の当て直し a(15単位)の記録と型検査の記録は、食い違いが無い', { skip: existsSync(A) && existsSync(TA) ? false : '記録が無い' }, () => {
  const a = readJson(A);
  assert.equal(kindOf(a), 'a');
  assert.deepEqual(checkApply(a, unitFor(a)), []);
  assert.deepEqual(checkTypecheck(readJson(TA), a), []);
});

test('c2-check: 蒙恬の当て直し b(16単位。C-1 の後に C-2)の記録と型検査の記録は、食い違いが無い。警告は debugChatIntegration.ts の1件だけ', { skip: existsSync(B) && existsSync(TB) ? false : '記録が無い' }, () => {
  const b = readJson(B);
  assert.equal(kindOf(b), 'b');
  assert.deepEqual(checkApply(b, unitFor(b)), []);
  assert.deepEqual(checkTypecheck(readJson(TB), b), []);
  const c2 = b.units.find((u) => u.id === 'C-2-debug');
  assert.equal(c2.warnings.length, 1);
  assert.match(c2.warnings[0], /debugChatIntegration\.ts/);
});

test('c2-check: 実際の記録で、C-2 の edits が衝突なく当たり、ロックファイルが ok(a は削除だけ、b は foundry-local-sdk の節の減りだけが許される)', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  for (const [f, kind] of [[A, 'a'], [B, 'b']]) {
    const j = readJson(f);
    const c2 = j.units.find((u) => u.id === 'C-2-debug');
    assert.deepEqual(c2.edits.conflicts, [], kind);
    assert.equal(c2.edits.applied, 'ok');
    assert.equal(j.checks.lockfile.status, 'ok', kind);
    const root = j.checks.lockfile.files.find((x) => x.path === 'pnpm-lock.yaml');
    assert.ok(root && root.status === 'ok', kind);
    assert.deepEqual(root.changedSections ?? [], [], kind);
    assert.deepEqual(root.expected.removedPatches, kind === 'b' ? ['foundry-local-sdk'] : [], kind);
  }
});

test('c2-check: 実際の記録の absentStrings に、C-2 の unit.json の15項目がすべてあり、見つかったものが無い', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  for (const f of [A, B]) {
    const j = readJson(f);
    const mine = j.checks.absentStrings.items.filter((i) => i.unit === 'C-2-debug');
    assert.equal(mine.length, unitJson.checks.absentStrings.length);
    assert.deepEqual(mine.filter((i) => i.hitCount !== 0), []);
  }
});

test('c2-check: 食い違いを見つける（result・単位の欠け・余計な単位・順序・edits の件名・衝突・removeLines・absentStrings・警告・コミット）', () => {
  const cases = [
    ['result', 'a', (j) => { j.result = 'conflict'; }, /result が ok でない/],
    ['dryRun', 'a', (j) => { j.dryRun = true; }, /dryRun/],
    ['HEAD が sha でない', 'a', (j) => { j.headCommit = 'x'; }, /headCommit/],
    ['単位の欠け', 'a', (j) => { j.units = j.units.filter((u) => u.id !== 'B-4-outline-view'); }, /B-4-outline-view が記録に無い/],
    ['単位の適用', 'a', (j) => { j.units[3].applied = 'skipped'; }, /applied が ok でない/],
    ['余計な単位(C-3)', 'a', (j) => { j.units.push({ id: 'C-3-remote', applied: 'ok' }); }, /想定していない単位/],
    ['順序(b で C-2 が C-1 より先)', 'b', (j) => { j.units.reverse(); }, /C-2 が C-1 より先/],
    ['C-2 の件名', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').edits.subject = 'unit C-2-debug: other'; }, /件名が違う/],
    ['C-2 の衝突', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').edits.conflicts = ['x.ts']; }, /衝突/],
    ['C-2 の edits', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').edits.applied = 'none'; }, /edits が ok でない/],
    ['C-1 の衝突(b)', 'b', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.conflicts = ['x.ts']; }, /C-1-ai の edits に衝突/],
    ['removeLines が見つからない', 'a', (j) => { const r = j.units.find((u) => u.id === 'C-2-debug').ops.removeLines[0]; r.found = 0; r.ok = false; }, /removeLines が見つからない/],
    ['removeLines の記録の行が足りない', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').ops.removeLines.pop(); }, /removeLines の記録が/],
    ['delete の数が合わない', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').ops.deleted.pop(); }, /delete の数が合わない/],
    ['a で本家に無い delete', 'a', (j) => { const o = j.units.find((u) => u.id === 'C-2-debug').ops; o.missingDeletes = [o.deleted.pop()]; }, /本家に無い delete がある/],
    ['b の本家に無い delete が別のファイル', 'b', (j) => { j.units.find((u) => u.id === 'C-2-debug').ops.missingDeletes = ['src/x.ts']; }, /想定（/],
    ['a の C-2 に警告', 'a', (j) => { j.units.find((u) => u.id === 'C-2-debug').warnings = ['何か']; }, /warnings が空でない/],
    ['b の C-2 の警告が無い', 'b', (j) => { j.units.find((u) => u.id === 'C-2-debug').warnings = []; }, /想定の1件/],
    ['想定外の全体の警告', 'a', (j) => { j.warnings = ['x']; }, /想定していない warnings/],
    ['errors', 'a', (j) => { j.errors = ['x']; }, /errors/],
    ['remnants', 'a', (j) => { j.checks.remnants.status = 'found'; }, /remnants/],
    ['absentStrings', 'a', (j) => { j.checks.absentStrings.status = 'found'; j.checks.absentStrings.items[0].hitCount = 1; }, /absentStrings が ok でない/],
    ['absentStrings の抜け', 'a', (j) => { j.checks.absentStrings.items.pop(); }, /検査の記録が無い/],
    ['absentStrings の見つかり', 'a', (j) => { j.checks.absentStrings.items[2].hitCount = 2; }, /absentStrings が見つかった/],
    ['registeredKeys', 'a', (j) => { j.checks.registeredKeys.status = 'fail'; }, /registeredKeys/],
    ['commitIdentity', 'a', (j) => { j.checks.commitIdentity.status = 'fail'; }, /commitIdentity/],
    ['コミットの並び(ops が edits の後)', 'a', (j) => { j.commits.reverse(); }, /並びが違う/],
    ['コミットの作者', 'a', (j) => { j.commits[0].author = 'someone <a@b.invalid>'; }, /作者が shuko-apply でない/],
    ['b でコミットの並び(C-1 の edits が C-2 の後)', 'b', (j) => { const i = j.commits.findIndex((c) => c.subject === 'unit C-1-ai: edits'); const [c] = j.commits.splice(i, 1); j.commits.push(c); }, /C-1 の edits が C-2 の ops の後/],
  ];
  for (const [name, kind, mutate, re] of cases) {
    const j = mini(kind);
    mutate(j);
    const bad = checkApply(j, unitJson);
    assert.ok(bad.some((x) => re.test(x)), `${name}: 食い違いを見つけない: ${JSON.stringify(bad)}`);
  }
});

test('c2-check: 実際の記録を壊しても食い違いが出る（a の C-2 の衝突、b の警告の増減、a のロックファイル)', { skip: existsSync(A) && existsSync(B) ? false : '記録が無い' }, () => {
  const a = clone(readJson(A));
  a.units.find((u) => u.id === 'C-2-debug').edits.conflicts = ['x.ts'];
  assert.ok(checkApply(a, unitJson).some((x) => /衝突/.test(x)));
  const b = clone(readJson(B));
  b.units.find((u) => u.id === 'C-2-debug').warnings.push('もう1件');
  assert.ok(checkApply(b, unitJson).some((x) => /想定の1件/.test(x)));
  const a2 = clone(readJson(A));
  a2.checks.lockfile.status = 'fail';
  a2.checks.lockfile.files[3].status = 'fail';
  a2.checks.lockfile.files[3].changedSections = ['settings'];
  assert.ok(checkApply(a2, unitJson).some((x) => /pnpm-lock\.yaml が fail/.test(x) && /settings/.test(x)));
  const a3 = clone(readJson(A));
  a3.checks.lockfile.files.find((f) => f.path === 'pnpm-lock.yaml').expected.removedPatches = ['foundry-local-sdk'];
  assert.ok(checkApply(a3, unitJson).some((x) => /a の組でパッチの節が減る/.test(x)));
});

test('c2-check: ロックファイルの fail が食い違いに出る。ok と removed は通る。pending(--lockfile-check をかけていない記録)は見ない', () => {
  const j = mini('a');
  j.checks.lockfile = { status: 'ok', files: [{ path: 'pnpm-lock.yaml', status: 'ok', expected: { removedPatches: [] } }, { path: 'extensions/copilot/pnpm-lock.yaml', status: 'removed' }] };
  assert.deepEqual(checkApply(j, unitJson), []);
  j.checks.lockfile = { status: 'fail', files: [{ path: 'pnpm-lock.yaml', status: 'fail', changedSections: ['settings'], changedDeps: [] }] };
  assert.ok(checkApply(j, unitJson).some((x) => /pnpm-lock\.yaml が fail/.test(x) && /settings/.test(x)));
  j.checks.lockfile = { status: 'pending' };
  assert.deepEqual(checkApply(j, unitJson), []);
});

test('c2-check: 型検査の食い違いを見つける（result・exitCode・HEAD の不一致・未コミット）', () => {
  const run = (mut) => { const t = miniT(); mut(t); return checkTypecheck(t, mini('a')); };
  assert.ok(run((t) => { t.result = 'failed'; }).some((x) => /result/.test(x)));
  assert.ok(run((t) => { t.steps[0].exitCode = 2; }).some((x) => /exitCode/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.value = hex('b'); }).some((x) => /HEAD/.test(x)));
  assert.ok(run((t) => { t.sourceVersion.uncommittedEntries = 3; }).some((x) => /未コミット/.test(x)));
  assert.ok(run((t) => { t.steps = []; }).some((x) => /steps\[0\]/.test(x)));
});

test('c2-check: 元の記録は壊さない（読むだけ）', () => {
  const j = mini('b');
  const before = clone(j);
  checkApply(j, unitJson);
  assert.deepEqual(j, before);
});

test('c2-check: コマンドとして走らせると、実際の記録で 0、壊した引数で 2 を返す', { skip: existsSync(A) && existsSync(TA) ? false : '記録が無い' }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c2-check-json.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const ok = run(A, TA);
  if (JSON.stringify(unitFor(readJson(A))) === JSON.stringify(unitJson)) {
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり（組 a/);
  } else {
    // 古い記録(absentStrings を替える前に取った)は、今の unit.json の項目が記録に無いので食い違いになる。大岡越前守が取り直した記録で 0 になる
    assert.equal(ok.status, 1, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /検査の記録が無いもの: \/debugService\.js', \/linkDetector\.js'/);
  }
  assert.equal(run().status, 2);
  assert.equal(run(join(TRIAL, 'nonexistent.json')).status, 2);
  assert.equal(run(A, join(TRIAL, 'nonexistent.json')).status, 2);
  // 型検査の記録が別の組(b)のもの = HEAD が違うので食い違い(1)
  const mix = run(A, TB);
  assert.equal(mix.status, 1, mix.stdout);
  assert.match(mix.stdout, /HEAD/);
});

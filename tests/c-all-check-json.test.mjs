// c2〜c5-check-json.mjs の「c の組」(段階 C のすべて。21単位。A-1〜A-7・B-1〜B-7・C-1〜C-7)の検査。
// 仕様: tasks/2026-11-16-p5-c1-product-keys/brief.md の曹参の3、docs/03 の5.1・7節。
// 実際の21単位の記録(版 1.146.0-p5-c-all-r2 の当て直し)はまだ無いので、手で作った最小の記録(単位の並び・edits・コミットの並び・警告1件・ops)で形を確かめる。
// 実記録が出たら、tests/c2-check-json.mjs などをコマンドで走らせて 0 になることを大岡越前守が確かめる(台本)。
// Run: node --test tests/c-all-check-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as m2 from './c2-check-json.mjs';
import * as m3 from './c3-check-json.mjs';
import * as m4 from './c4-check-json.mjs';
import * as m5 from './c5-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const clone = (o) => JSON.parse(JSON.stringify(o));
const hex = (c) => c.repeat(40);
const AUTHOR = 'shuko-apply <apply@shuko.invalid>';
const C2_FILE = 'src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts';

const ALL_C = ['C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery', 'C-6-settings-sync', 'C-7-breadcrumbs-outline'];
const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions',
  'A-5-remote-extensions', 'A-6-themes', 'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share',
  'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
const ALL21 = [...BASE, ...ALL_C];

const MODS = [
  { name: 'c2', mod: m2, me: 'C-2-debug', idx: 1 },
  { name: 'c3', mod: m3, me: 'C-3-remote', idx: 2 },
  { name: 'c4', mod: m4, me: 'C-4-notebook', idx: 3 },
  { name: 'c5', mod: m5, me: 'C-5-extension-gallery', idx: 4 },
];

/** 21単位の最小の記録。me の単位の ops は unit.json から作る。C-2 の delete の1件(C-1 が先に消す)は警告・本家に無い delete に出す。 */
function mini21(me, unitJson) {
  const warnText = `delete: ${C2_FILE} が本家に無い（改名の恐れ）`;
  return {
    result: 'ok', dryRun: false, headCommit: hex('a'), warnings: [`C-2-debug: ${warnText}`], errors: [],
    units: ALL21.map((id) => {
      const isMe = id === me;
      const isC = /^C-/.test(id);
      const missing = isMe && id === 'C-2-debug' ? [C2_FILE] : [];
      return {
        id, applied: 'ok',
        ops: isMe ? {
          deleted: (unitJson.delete ?? []).filter((d) => !missing.includes(d)), missingDeletes: missing, removedDependencies: [], missingDependencies: [],
          productRemoved: [...(unitJson.productRemove ?? [])], productMissing: [],
          removeLines: (unitJson.removeLines ?? []).map((r) => ({ file: r.file, line: r.line, count: r.count ?? 1, found: r.count ?? 1, ok: true })),
        } : {},
        edits: isC ? { applied: 'ok', commit: hex('b'), subject: `unit ${id}: edits`, conflicts: [] } : { applied: 'none', subject: null, conflicts: [] },
        warnings: id === 'C-2-debug' ? [warnText] : [],
      };
    }),
    checks: {
      remnants: { status: 'ok', items: [] },
      absentStrings: { status: 'ok', items: (unitJson.checks?.absentStrings ?? []).map((s) => ({ unit: me, text: s.text, in: s.in, hitCount: 0, hits: [] })) },
      registeredKeys: { status: 'ok' },
      commitIdentity: { status: 'ok', items: [] },
    },
    commits: ALL_C.flatMap((id) => [{ subject: `unit ${id}: ops`, author: AUTHOR }, { subject: `unit ${id}: edits`, author: AUTHOR }]),
  };
}
const miniT = () => ({ result: 'ok', sourceVersion: { value: hex('a'), error: null, uncommittedEntries: 0 }, steps: [{ name: 'typecheck', status: 'ok', exitCode: 0, log: 'x' }] });
const unitOf = (me) => readJson(join(REPO, 'removals', me, 'unit.json'));

for (const { name, mod, me } of MODS) {
  const unitJson = unitOf(me);

  test(`${name}-check: 21単位の記録は「組 c」と見分けられ、期待どおり(食い違い 0)。型検査も通る`, () => {
    const j = mini21(me, unitJson);
    assert.equal(mod.kindOf(j), 'c');
    assert.equal(mod.UNITS_C.length, 21);
    assert.deepEqual(mod.UNITS_C, ALL21);
    assert.deepEqual(mod.checkApply(j, unitJson), []);
    assert.deepEqual(mod.checkTypecheck(miniT(), j), []);
  });

  test(`${name}-check: 20単位(C-7 なし)の記録は c と見なされず、c の単位が足りない・余計だと食い違いになる`, () => {
    const j = mini21(me, unitJson);
    j.units = j.units.filter((u) => u.id !== 'C-7-breadcrumbs-outline');
    j.commits = j.commits.filter((c) => !c.subject.includes('C-7-'));
    assert.notEqual(mod.kindOf(j), 'c');
    // b(または a)の組として照らすので、今度は余計な単位(C-6 など)が出る
    assert.ok(mod.checkApply(j, unitJson).some((x) => /想定していない単位/.test(x)), 'C-7 なしの 20 単位の記録が通ってしまう');
  });

  test(`${name}-check: 21単位の組で食い違いを見つける(単位の欠け・並び・後ろの単位の edits の衝突と未適用・余計な単位)`, () => {
    const cases = [
      ['C-6 の欠け(C-7 は残す)', (j) => { j.units = j.units.filter((u) => u.id !== 'C-6-settings-sync'); }, /C-6-settings-sync が記録に無い/],
      ['C-7 の適用', (j) => { j.units.find((u) => u.id === 'C-7-breadcrumbs-outline').applied = 'skipped'; }, /C-7-breadcrumbs-outline: applied が ok でない/],
      ['並び(C-7 が C-6 より前)', (j) => {
        const a = j.units.findIndex((u) => u.id === 'C-6-settings-sync'); const b = j.units.findIndex((u) => u.id === 'C-7-breadcrumbs-outline');
        [j.units[a], j.units[b]] = [j.units[b], j.units[a]];
      }, /並びが/],
      ['C-1 が C-2 より後', (j) => {
        const a = j.units.findIndex((u) => u.id === 'C-1-ai'); const b = j.units.findIndex((u) => u.id === 'C-2-debug');
        [j.units[a], j.units[b]] = [j.units[b], j.units[a]];
      }, /先に当たっている|並びが|順でない/],
      ['C-7 の edits の衝突', (j) => { j.units.find((u) => u.id === 'C-7-breadcrumbs-outline').edits.conflicts = ['x.ts']; }, /C-7-breadcrumbs-outline の edits に衝突/],
      ['C-6 の edits が未適用', (j) => { j.units.find((u) => u.id === 'C-6-settings-sync').edits.applied = 'none'; }, /C-6-settings-sync の edits が ok でない/],
      ['C-1 の edits の衝突', (j) => { j.units.find((u) => u.id === 'C-1-ai').edits.conflicts = ['x.ts']; }, /C-1-ai の edits に衝突/],
      ['想定外の全体の警告', (j) => { j.warnings.push('何か'); }, /想定していない warnings|warnings が/],
      ['errors', (j) => { j.errors = ['x']; }, /errors/],
      ['absentStrings の見つかり', (j) => { j.checks.absentStrings.items[0].hitCount = 1; }, /absentStrings が見つかった/],
      ['commitIdentity', (j) => { j.checks.commitIdentity.status = 'fail'; }, /commitIdentity/],
      ['ロックファイルの removedPatches が違う', (j) => { j.checks.lockfile = { status: 'ok', files: [{ path: 'pnpm-lock.yaml', status: 'ok', expected: { removedPatches: [] } }] }; }, /removedPatches|パッチの節/],
    ];
    for (const [label, mutate, re] of cases) {
      if (!unitJson.checks?.absentStrings?.length && /absentStrings/.test(label)) continue;
      const j = mini21(me, unitJson);
      mutate(j);
      const bad = mod.checkApply(j, unitJson);
      assert.ok(bad.some((x) => re.test(x)), `${label}: 食い違いを見つけない: ${JSON.stringify(bad)}`);
    }
  });

  test(`${name}-check: 21単位の組でコミットの並び(自分の ops が前の単位の edits の後)を見張る`, () => {
    const j = mini21(me, unitJson);
    // 自分の単位の ops を、C-1 の edits より前に動かす
    const iOps = j.commits.findIndex((c) => c.subject === `unit ${me}: ops`);
    const [c] = j.commits.splice(iOps, 1);
    j.commits.unshift(c);
    assert.ok(mod.checkApply(j, unitJson).some((x) => /commits の並びが違う/.test(x)), 'コミットの並びの誤りを見つけない');
  });

  test(`${name}-check: 元の記録は壊さない(読むだけ)`, () => {
    const j = mini21(me, unitJson);
    const before = clone(j);
    mod.checkApply(j, unitJson);
    assert.deepEqual(j, before);
  });
}

// 実際の21単位の記録(2026-11-15 の C-1・C-6・C-7 の検証で取った checks-21.json・typecheck-21.json)。c7-check-json.test.mjs も同じ記録を使う
const RUN = join(REPO, 'tasks', '2026-11-15-p5-c1-c6-c7-verify', 'run');
const REAL = join(RUN, 'checks-21.json');
const REAL_T = join(RUN, 'typecheck-21.json');
const haveReal = existsSync(REAL) && existsSync(REAL_T);
for (const { name, mod, me } of MODS) {
  test(`${name}-check: 実際の21単位の記録(checks-21.json・typecheck-21.json)は、組 c として期待どおり。壊すと食い違いが出る`, { skip: haveReal ? false : '記録が無い' }, () => {
    const unitJson = unitOf(me);
    const j = readJson(REAL);
    assert.equal(mod.kindOf(j), 'c');
    assert.deepEqual(mod.checkApply(j, unitJson), []);
    assert.deepEqual(mod.checkTypecheck(readJson(REAL_T), j), []);
    const k = clone(j);
    k.units.find((u) => u.id === 'C-7-breadcrumbs-outline').edits.conflicts = ['x.ts'];
    assert.ok(mod.checkApply(k, unitJson).some((x) => /C-7-breadcrumbs-outline の edits に衝突/.test(x)));
    const o = clone(j);
    o.units.find((u) => u.id === me).edits.applied = 'none';
    assert.ok(mod.checkApply(o, unitJson).some((x) => /edits が ok でない/.test(x)));
  });
}

test('c2-check の c の組: C-2 の本家に無い delete が C-2 の想定の1件(debugChatIntegration.ts)でなければ食い違い', () => {
  const unitJson = unitOf('C-2-debug');
  const j = mini21('C-2-debug', unitJson);
  j.units.find((u) => u.id === 'C-2-debug').ops.missingDeletes = ['src/x.ts'];
  assert.ok(m2.checkApply(j, unitJson).some((x) => /想定（/.test(x)));
});

test('c3-check の c の組: productRemoved が productRemove と違えば食い違い。C-3 の warnings が空でなければ食い違い', () => {
  const unitJson = unitOf('C-3-remote');
  const j = mini21('C-3-remote', unitJson);
  j.units.find((u) => u.id === 'C-3-remote').ops.productRemoved = ['defaultChatAgent'];
  assert.ok(m3.checkApply(j, unitJson).some((x) => /productRemoved が productRemove と違う/.test(x)) || (unitJson.productRemove ?? []).includes('defaultChatAgent'));
  const k = mini21('C-3-remote', unitJson);
  k.units.find((u) => u.id === 'C-3-remote').warnings = ['何か'];
  assert.ok(m3.checkApply(k, unitJson).some((x) => /C-3-remote の warnings が空でない/.test(x)));
});

test('c4・c5-check の c の組: 全体の warnings が C-2 の1件でなければ食い違い', () => {
  for (const [mod, me] of [[m4, 'C-4-notebook'], [m5, 'C-5-extension-gallery']]) {
    const unitJson = unitOf(me);
    const j = mini21(me, unitJson);
    j.warnings = [];
    assert.ok(mod.checkApply(j, unitJson).some((x) => /warnings が/.test(x)), me);
  }
});

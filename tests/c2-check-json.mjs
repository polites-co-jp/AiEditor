// C-2 の当て直し（apply.mjs の --checks-out）と型検査（build.mjs の --record）の記録を、期待の値と照らす。読むだけ。
// 期待の出どころ: tasks/2026-11-15-p5-c2-patch/handoff-notes.md の「テストの入口」の1・2、removals/C-2-debug/unit.json。
// 当て直しの組は2つ。記録の単位の並びで見分ける（C-1-ai が入っていれば b、無ければ a）:
//   a: A-1〜A-7・B-1〜B-7 の14単位と C-2（15単位）
//   b: A-1〜A-7・B-1〜B-7 の14単位と C-1 と C-2（16単位。C-1 の後に C-2）
// 使い方: node tests/c2-check-json.mjs <checks.json> [<typecheck.json>]
// 終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り。
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

export const BASE_UNITS = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions',
  'A-5-remote-extensions', 'A-6-themes', 'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share',
  'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
export const UNITS_A = [...BASE_UNITS, 'C-2-debug'];
export const UNITS_B = [...BASE_UNITS, 'C-1-ai', 'C-2-debug'];
/** b の組で、C-1 が先に消すため C-2 の delete が「本家に無い」警告になる1件 */
export const B_WARNING_FILE = 'src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts';

/** 記録の組を見分ける。 */
export function kindOf(j) {
  return (j.units ?? []).some((u) => u.id === 'C-1-ai') ? 'b' : 'a';
}

/** 当て直しの記録を照らす。食い違いの文の配列を返す（空なら期待どおり）。 */
export function checkApply(j, unitJson) {
  const bad = [];
  const kind = kindOf(j);
  const expected = kind === 'b' ? UNITS_B : UNITS_A;
  if (j.result !== 'ok') bad.push(`result が ok でない: ${j.result} (stoppedAt: ${j.stoppedAt})`);
  if (j.dryRun) bad.push('dryRun の記録（実際に当てていない）');
  if (!/^[0-9a-f]{40}$/.test(j.headCommit ?? '')) bad.push(`headCommit が sha でない: ${j.headCommit}`);
  const units = j.units ?? [];
  const ids = units.map((u) => u.id);
  for (const id of expected) if (!ids.includes(id)) bad.push(`単位 ${id} が記録に無い`);
  for (const id of ids) if (!expected.includes(id)) bad.push(`想定していない単位が当たっている: ${id}（${kind} の組は ${expected.length} 単位）`);
  for (const u of units) if (expected.includes(u.id) && u.applied !== 'ok') bad.push(`${u.id}: applied が ok でない: ${u.applied}`);
  if (kind === 'b' && ids.indexOf('C-1-ai') > ids.indexOf('C-2-debug')) bad.push('C-2 が C-1 より先に当たっている（b は C-1 の後に C-2）');

  if (kind === 'b') {
    const c1 = units.find((u) => u.id === 'C-1-ai');
    if (c1) {
      if (c1.edits?.applied !== 'ok') bad.push(`C-1-ai の edits が ok でない: ${c1.edits?.applied}`);
      if ((c1.edits?.conflicts ?? []).length !== 0) bad.push(`C-1-ai の edits に衝突: ${JSON.stringify(c1.edits.conflicts)}`);
    }
  }

  const c2 = units.find((u) => u.id === 'C-2-debug');
  if (c2) {
    if (c2.edits?.applied !== 'ok') bad.push(`C-2-debug の edits が ok でない: ${c2.edits?.applied}`);
    if (c2.edits?.subject !== 'unit C-2-debug: edits') bad.push(`C-2-debug の edits の件名が違う: ${c2.edits?.subject}`);
    if ((c2.edits?.conflicts ?? []).length !== 0) bad.push(`C-2-debug の edits に衝突: ${JSON.stringify(c2.edits.conflicts)}`);
    if (!/^[0-9a-f]{40}$/.test(c2.edits?.commit ?? '')) bad.push(`C-2-debug の edits の commit が sha でない: ${c2.edits?.commit}`);
    const ops = c2.ops;
    if (!ops) bad.push('C-2-debug の ops の記録が無い');
    else {
      const del = ops.deleted ?? [];
      const missing = ops.missingDeletes ?? [];
      if (unitJson && del.length + missing.length !== (unitJson.delete ?? []).length) bad.push(`C-2-debug: delete の数が合わない（消した ${del.length} + 本家に無い ${missing.length} ≠ unit.json の ${(unitJson.delete ?? []).length}）`);
      if (kind === 'a' && missing.length) bad.push(`C-2-debug: 本家に無い delete がある（a の組では 0 件のはず）: ${JSON.stringify(missing)}`);
      if (kind === 'b' && JSON.stringify(missing) !== JSON.stringify([B_WARNING_FILE])) bad.push(`C-2-debug: 本家に無い delete が想定（${B_WARNING_FILE} の1件）と違う: ${JSON.stringify(missing)}`);
      const rl = ops.removeLines ?? [];
      if (unitJson && rl.length !== (unitJson.removeLines ?? []).length) bad.push(`C-2-debug: removeLines の記録が ${rl.length} 行（unit.json は ${(unitJson.removeLines ?? []).length} 行）`);
      for (const r of rl) if (r.ok !== true || r.found !== r.count || !(r.found >= 1)) bad.push(`C-2-debug: removeLines が見つからない: ${r.file}: ${r.line} (found ${r.found}, count ${r.count})`);
      if (unitJson) {
        const have = new Set(rl.map((r) => `${r.file}\n${r.line}`));
        for (const r of unitJson.removeLines ?? []) if (!have.has(`${r.file}\n${r.line}`)) bad.push(`C-2-debug: removeLines の記録に無い行: ${r.file}: ${r.line}`);
      }
      if ((ops.missingDependencies ?? []).length) bad.push(`C-2-debug: missingDependencies: ${JSON.stringify(ops.missingDependencies)}`);
    }
    const w = c2.warnings ?? [];
    if (kind === 'a' && w.length) bad.push(`C-2-debug の warnings が空でない（a の組）: ${JSON.stringify(w)}`);
    if (kind === 'b' && !(w.length === 1 && w[0].includes(B_WARNING_FILE))) bad.push(`C-2-debug の warnings が想定の1件（${B_WARNING_FILE} が本家に無い）でない: ${JSON.stringify(w)}`);
  }

  // 全体の警告・誤り
  const topWarn = (j.warnings ?? []).filter((x) => !(kind === 'b' && String(x).includes(B_WARNING_FILE)));
  if (topWarn.length) bad.push(`想定していない warnings: ${JSON.stringify(topWarn).slice(0, 300)}`);
  if ((j.errors ?? []).length) bad.push(`errors がある: ${JSON.stringify(j.errors).slice(0, 300)}`);

  if (j.checks?.remnants?.status !== 'ok') bad.push(`checks.remnants が ok でない: ${j.checks?.remnants?.status} ${JSON.stringify(j.checks?.remnants?.items ?? []).slice(0, 300)}`);
  if (j.checks?.absentStrings?.status !== 'ok') {
    const hits = (j.checks?.absentStrings?.items ?? []).filter((i) => i.hitCount > 0).map((i) => `${i.unit} ${i.text} -> ${(i.hits ?? []).slice(0, 3).map((h) => (typeof h === 'string' ? h : JSON.stringify(h))).join(' | ')}`);
    bad.push(`checks.absentStrings が ok でない: ${j.checks?.absentStrings?.status}\n    ${hits.join('\n    ')}`);
  }
  // C-2 の absentStrings は unit.json の項目が全部検査されていて、見つかったものが無い（検査の抜けを見る）
  if (unitJson) {
    const want = (unitJson.checks?.absentStrings ?? []).map((s) => s.text);
    const mine = (j.checks?.absentStrings?.items ?? []).filter((i) => i.unit === 'C-2-debug');
    const got = new Set(mine.map((i) => i.text));
    const missing = want.filter((t) => !got.has(t));
    if (missing.length) bad.push(`C-2-debug の absentStrings のうち検査の記録が無いもの: ${missing.join(', ')}`);
    for (const i of mine) if (i.hitCount !== 0) bad.push(`C-2-debug の absentStrings が見つかった: ${i.text} (${i.hitCount})`);
  }
  if (j.checks?.registeredKeys && j.checks.registeredKeys.status !== 'ok') bad.push(`checks.registeredKeys が ok でない: ${j.checks.registeredKeys.status}`);
  if (j.checks?.commitIdentity && j.checks.commitIdentity.status !== 'ok') bad.push(`checks.commitIdentity が ok でない: ${j.checks.commitIdentity.status} ${JSON.stringify(j.checks.commitIdentity.items ?? []).slice(0, 200)}`);

  // コミットの並び: C-2 の ops → edits（b は C-1 の edits の後）。作者は shuko-apply
  const commits = j.commits ?? [];
  if (commits.length) {
    const subj = commits.map((c) => c.subject);
    const iOps = subj.indexOf('unit C-2-debug: ops');
    const iEdits = subj.indexOf('unit C-2-debug: edits');
    if (iOps < 0 || iEdits < 0) bad.push('commits に C-2 の ops・edits のコミットが無い');
    else if (iOps > iEdits) bad.push('commits の並びが違う（C-2 の ops が edits の後）');
    if (kind === 'b' && subj.indexOf('unit C-1-ai: edits') > iOps) bad.push('commits の並びが違う（C-1 の edits が C-2 の ops の後）');
    for (const c of commits.filter((x) => /^unit C-2-debug:/.test(x.subject))) {
      if (c.author !== 'shuko-apply <apply@shuko.invalid>') bad.push(`${c.subject} の作者が shuko-apply でない: ${c.author}`);
    }
  }

  // --lockfile-check をかけた記録だけ: ロックファイルの差分が「消した依存の削除」と、単位が消したパッチの節の減りだけであること
  // status が pending・skipped = --lockfile-check をかけていない記録(依存の導入の前)。ここでは見ない。
  if (j.checks?.lockfile && !['pending', 'skipped'].includes(j.checks.lockfile.status)) {
    const lf = j.checks.lockfile;
    for (const f of lf.files ?? []) {
      if (f.status === 'ok' || f.status === 'removed') continue;
      const why = ['changedSections', 'unexpectedRemovedImporters', 'unexpectedRemovedDeps', 'changedDeps', 'addedDeps', 'addedPackages', 'addedSnapshots', 'unexpectedPatchChanges']
        .filter((k) => Array.isArray(f[k]) && f[k].length).map((k) => `${k}=${JSON.stringify(f[k]).slice(0, 120)}`);
      bad.push(`checks.lockfile: ${f.path} が ${f.status}${why.length ? ` (${why.join(', ')})` : ''}`);
    }
    if (lf.status !== 'ok' && !(lf.files ?? []).some((f) => f.status !== 'ok' && f.status !== 'removed')) bad.push(`checks.lockfile が ok でない: ${lf.status}`);
    // C-2 は依存もパッチも消さない。パッチの節が減るのは C-1 の foundry-local-sdk だけ（b の組）
    const root = (lf.files ?? []).find((f) => f.path === 'pnpm-lock.yaml');
    if (kind === 'a' && (root?.expected?.removedPatches ?? []).length) bad.push(`checks.lockfile: a の組でパッチの節が減る見込み: ${JSON.stringify(root.expected.removedPatches)}（C-2 はパッチを消さない）`);
    if (kind === 'b' && JSON.stringify(root?.expected?.removedPatches ?? []) !== JSON.stringify(['foundry-local-sdk'])) bad.push(`checks.lockfile: b の組の removedPatches が ["foundry-local-sdk"] でない: ${JSON.stringify(root?.expected?.removedPatches)}`);
  }
  return bad;
}

/** 型検査の記録を照らす。checks の HEAD と記録の HEAD が分かるときは、それも見る。 */
export function checkTypecheck(t, applyJson) {
  const bad = [];
  if (t.result !== 'ok') bad.push(`型検査の result が ok でない: ${t.result}`);
  const step = (t.steps ?? [])[0];
  if (!step || step.name !== 'typecheck') bad.push(`steps[0] が typecheck でない: ${step?.name}`);
  else if (step.exitCode !== 0) bad.push(`steps[0].exitCode が 0 でない: ${step.exitCode}（ログ: ${step.log}）`);
  const sv = t.sourceVersion;
  if (!sv?.value || !/^[0-9a-f]{40}$/.test(sv.value)) bad.push(`sourceVersion.value が HEAD の sha でない: ${sv?.value}`);
  if (sv?.error) bad.push(`sourceVersion.error: ${sv.error}`);
  if (sv && sv.uncommittedEntries) bad.push(`作業ツリーに未コミットの変更がある: ${sv.uncommittedEntries}`);
  if (applyJson?.headCommit && sv?.value && sv.value !== applyJson.headCommit) bad.push(`型検査の HEAD ${sv.value} が当て直しの HEAD ${applyJson.headCommit} と違う（当て直しの後に作業ツリーが動いた）`);
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [a, b] = process.argv.slice(2);
  if (!a || !existsSync(a)) { console.error('使い方: node tests/c2-check-json.mjs <checks.json> [<typecheck.json>]'); process.exit(2); }
  const unitJson = readJson(join(REPO, 'removals', 'C-2-debug', 'unit.json'));
  const aj = readJson(a);
  const bad = checkApply(aj, unitJson).map((x) => `[当て直し ${kindOf(aj)}] ${x}`);
  if (b) {
    if (!existsSync(b)) { console.error(`型検査の記録が無い: ${b}`); process.exit(2); }
    bad.push(...checkTypecheck(readJson(b), aj).map((x) => `[型検査] ${x}`));
  }
  if (bad.length === 0) console.log(`期待どおり（組 ${kindOf(aj)}: ${b ? '当て直し・型検査' : '当て直しのみ'}）`);
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

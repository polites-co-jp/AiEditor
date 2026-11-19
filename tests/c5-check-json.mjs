// C-5 の当て直し（apply.mjs の --checks-out）と型検査（build.mjs の --record）の記録を、期待の値と照らす。読むだけ。
// 期待の出どころ: tasks/2026-11-15-p5-c5-patch/handoff-notes.md の「テストの入口」の1〜3（1回目と2回目）、removals/C-5-extension-gallery/unit.json。
// 当て直しの組は2つ。記録の単位の並びで見分ける（C-2-debug が入っていれば b、無ければ a）:
//   a: A-1〜A-7・B-1〜B-7 の14単位と C-1・C-5（16単位）
//   b: A-1〜A-7・B-1〜B-7 の14単位と C-1〜C-5（19単位。この順）
// 使い方:
//   node tests/c5-check-json.mjs <checks.json> [<typecheck.json>]
//   node tests/c5-check-json.mjs --stopped <checks.json>     （--only から C-1 を外した当て直し。C-5 の前で止まること）
// 終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り。
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorName, expectedAuthor } from './build/commit-author.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

export const BASE_UNITS = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions',
  'A-5-remote-extensions', 'A-6-themes', 'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share',
  'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
export const UNITS_A = [...BASE_UNITS, 'C-1-ai', 'C-5-extension-gallery'];
export const UNITS_B = [...BASE_UNITS, 'C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery'];
/** c: 段階 C のすべて(21単位。2026-11-16 に足した。b と同じ見方に、C-6・C-7 の edits が衝突しないことを足す) */
export const UNITS_C = [...UNITS_B, 'C-6-settings-sync', 'C-7-breadcrumbs-outline'];
/** c の組で、C-5 の後ろに当たる単位 */
const AFTER_C5 = ['C-6-settings-sync', 'C-7-breadcrumbs-outline'];
/** b の組で、C-1 が先に消すため C-2 の delete が「本家に無い」警告になる1件(C-2 の台本と同じ。a には C-2 が無いので警告も無い) */
export const C2_WARNING_FILE = 'src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts';
/** C-5 の前提の単位(unit.json の after) */
export const AFTER = ['C-1-ai'];

/** 記録の組を見分ける。 */
export function kindOf(j) {
  const ids = (j.units ?? []).map((u) => u.id);
  if (ids.includes('C-7-breadcrumbs-outline')) return 'c';
  return ids.includes('C-2-debug') ? 'b' : 'a';
}

/** 当て直しの記録を照らす。食い違いの文の配列を返す（空なら期待どおり）。 */
export function checkApply(j, unitJson) {
  const bad = [];
  const kind = kindOf(j);
  const expected = kind === 'c' ? UNITS_C : kind === 'b' ? UNITS_B : UNITS_A;
  const full = kind !== 'a'; // b・c は C-2〜C-4 も当たる
  if (j.result !== 'ok') bad.push(`result が ok でない: ${j.result} (stoppedAt: ${JSON.stringify(j.stoppedAt)})`);
  if (j.dryRun) bad.push('dryRun の記録（実際に当てていない）');
  if (!/^[0-9a-f]{40}$/.test(j.headCommit ?? '')) bad.push(`headCommit が sha でない: ${j.headCommit}`);
  const units = j.units ?? [];
  const ids = units.map((u) => u.id);
  for (const id of expected) if (!ids.includes(id)) bad.push(`単位 ${id} が記録に無い`);
  for (const id of ids) if (!expected.includes(id)) bad.push(`想定していない単位が当たっている: ${id}（${kind} の組は ${expected.length} 単位）`);
  for (const u of units) if (expected.includes(u.id) && u.applied !== 'ok') bad.push(`${u.id}: applied が ok でない: ${u.applied}`);
  const at = (id) => ids.indexOf(id);
  for (const dep of AFTER) if (at(dep) > at('C-5-extension-gallery')) bad.push(`C-5 が前提の ${dep} より先に当たっている`);
  if (full && !(at('C-1-ai') < at('C-2-debug') && at('C-2-debug') < at('C-3-remote') && at('C-3-remote') < at('C-4-notebook') && at('C-4-notebook') < at('C-5-extension-gallery'))) bad.push(`${kind} の並びが C-1〜C-5 の順でない`);
  if (kind === 'c') {
    const order = ['C-5-extension-gallery', ...AFTER_C5];
    for (let i = 1; i < order.length; i++) if (at(order[i - 1]) > at(order[i])) { bad.push(`c の並びが ${order.join('→')} の順でない`); break; }
  }

  for (const id of ['C-1-ai', ...(full ? ['C-2-debug', 'C-3-remote', 'C-4-notebook'] : []), ...(kind === 'c' ? AFTER_C5 : [])]) {
    const u = units.find((x) => x.id === id);
    if (!u) continue;
    if (u.edits?.applied !== 'ok') bad.push(`${id} の edits が ok でない: ${u.edits?.applied}`);
    if ((u.edits?.conflicts ?? []).length !== 0) bad.push(`${id} の edits に衝突: ${JSON.stringify(u.edits.conflicts)}`);
  }
  if (full) {
    const w2 = units.find((u) => u.id === 'C-2-debug')?.warnings ?? [];
    if (!(w2.length === 1 && w2[0].includes(C2_WARNING_FILE))) bad.push(`C-2-debug の warnings が想定の1件（${C2_WARNING_FILE} が本家に無い）でない: ${JSON.stringify(w2)}`);
  }

  const c5 = units.find((u) => u.id === 'C-5-extension-gallery');
  if (c5) {
    if (c5.edits?.applied !== 'ok') bad.push(`C-5-extension-gallery の edits が ok でない: ${c5.edits?.applied}`);
    if (c5.edits?.subject !== 'unit C-5-extension-gallery: edits') bad.push(`C-5-extension-gallery の edits の件名が違う: ${c5.edits?.subject}`);
    if ((c5.edits?.conflicts ?? []).length !== 0) bad.push(`C-5-extension-gallery の edits に衝突: ${JSON.stringify(c5.edits.conflicts)}`);
    if (!/^[0-9a-f]{40}$/.test(c5.edits?.commit ?? '')) bad.push(`C-5-extension-gallery の edits の commit が sha でない: ${c5.edits?.commit}`);
    const ops = c5.ops;
    if (!ops) bad.push('C-5-extension-gallery の ops の記録が無い');
    else {
      const del = ops.deleted ?? [];
      const missing = ops.missingDeletes ?? [];
      if (missing.length) bad.push(`C-5-extension-gallery: 本家に無い delete がある（0 件のはず）: ${JSON.stringify(missing)}`);
      if (unitJson && del.length + missing.length !== (unitJson.delete ?? []).length) bad.push(`C-5-extension-gallery: delete の数が合わない（消した ${del.length} + 本家に無い ${missing.length} ≠ unit.json の ${(unitJson.delete ?? []).length}）`);
      const rl = ops.removeLines ?? [];
      if (unitJson && rl.length !== (unitJson.removeLines ?? []).length) bad.push(`C-5-extension-gallery: removeLines の記録が ${rl.length} 行（unit.json は ${(unitJson.removeLines ?? []).length} 行）`);
      for (const r of rl) if (r.ok !== true || r.found !== 1 || r.count !== 1) bad.push(`C-5-extension-gallery: removeLines が1行ちょうどで見つからない: ${r.file}: ${r.line} (found ${r.found}, count ${r.count})`);
      if (unitJson) {
        const have = new Set(rl.map((r) => `${r.file}\n${r.line}`));
        for (const r of unitJson.removeLines ?? []) if (!have.has(`${r.file}\n${r.line}`)) bad.push(`C-5-extension-gallery: removeLines の記録に無い行: ${r.file}: ${r.line}`);
      }
      if ((ops.productRemoved ?? []).length || (ops.productMissing ?? []).length) bad.push(`C-5-extension-gallery: productRemove は空のはず: ${JSON.stringify([ops.productRemoved, ops.productMissing])}`);
      if ((ops.missingDependencies ?? []).length) bad.push(`C-5-extension-gallery: missingDependencies: ${JSON.stringify(ops.missingDependencies)}`);
    }
    if ((c5.warnings ?? []).length) bad.push(`C-5-extension-gallery の warnings が空でない: ${JSON.stringify(c5.warnings)}`);
  }

  // 全体の警告・誤り: b は C-2 の1件だけ。a は無い
  const topWarn = (j.warnings ?? []).filter((x) => !(full && String(x).includes(C2_WARNING_FILE)));
  if (topWarn.length) bad.push(`想定していない warnings: ${JSON.stringify(topWarn).slice(0, 300)}`);
  if ((j.warnings ?? []).length !== (full ? 1 : 0)) bad.push(`記録の最上位の warnings が ${full ? '1' : '0'} 件でない: ${(j.warnings ?? []).length} 件`);
  if ((j.errors ?? []).length) bad.push(`errors がある: ${JSON.stringify(j.errors).slice(0, 300)}`);

  if (j.checks?.remnants?.status !== 'ok') bad.push(`checks.remnants が ok でない: ${j.checks?.remnants?.status} ${JSON.stringify(j.checks?.remnants?.items ?? []).slice(0, 300)}`);
  if (j.checks?.absentStrings?.status !== 'ok') {
    const hits = (j.checks?.absentStrings?.items ?? []).filter((i) => i.hitCount > 0).map((i) => `${i.unit} ${i.text} -> ${(i.hits ?? []).slice(0, 3).map((h) => (typeof h === 'string' ? h : JSON.stringify(h))).join(' | ')}`);
    bad.push(`checks.absentStrings が ok でない: ${j.checks?.absentStrings?.status}\n    ${hits.join('\n    ')}`);
  }
  if (unitJson) {
    const want = (unitJson.checks?.absentStrings ?? []).map((s) => s.text);
    const mine = (j.checks?.absentStrings?.items ?? []).filter((i) => i.unit === 'C-5-extension-gallery');
    const got = new Set(mine.map((i) => i.text));
    const missing = want.filter((t) => !got.has(t));
    if (missing.length) bad.push(`C-5-extension-gallery の absentStrings のうち検査の記録が無いもの: ${missing.join(', ')}`);
    for (const i of mine) if (i.hitCount !== 0) bad.push(`C-5-extension-gallery の absentStrings が見つかった: ${i.text} (${i.hitCount})`);
  }
  if (j.checks?.registeredKeys && j.checks.registeredKeys.status !== 'ok') bad.push(`checks.registeredKeys が ok でない: ${j.checks.registeredKeys.status}`);
  if (j.checks?.commitIdentity && j.checks.commitIdentity.status !== 'ok') bad.push(`checks.commitIdentity が ok でない: ${j.checks.commitIdentity.status} ${JSON.stringify(j.checks.commitIdentity.items ?? []).slice(0, 200)}`);

  // コミットの並び: C-5 の ops → edits。前提の C-1 の edits の後(b は C-2〜C-4 の edits の後も)。作者は sukuna-apply
  const commits = j.commits ?? [];
  if (commits.length) {
    const subj = commits.map((c) => c.subject);
    const iOps = subj.indexOf('unit C-5-extension-gallery: ops');
    const iEdits = subj.indexOf('unit C-5-extension-gallery: edits');
    if (iOps < 0 || iEdits < 0) bad.push('commits に C-5 の ops・edits のコミットが無い');
    else {
      if (iOps > iEdits) bad.push('commits の並びが違う（C-5 の ops が edits の後）');
      for (const id of ['C-1-ai', ...(full ? ['C-2-debug', 'C-3-remote', 'C-4-notebook'] : [])]) {
        if (subj.indexOf(`unit ${id}: edits`) > iOps) bad.push(`commits の並びが違う（${id} の edits が C-5 の ops の後）`);
      }
    }
    for (const c of commits.filter((x) => /^unit C-5-extension-gallery:/.test(x.subject))) {
      const want = expectedAuthor(j);
      if (c.author !== want) bad.push(`${c.subject} の作者が ${authorName(want)} でない: ${c.author}`);
    }
  }

  // --lockfile-check をかけた記録だけ。C-5 は依存もパッチも消さない。パッチの節が減るのは C-1 の foundry-local-sdk だけ(a・b とも C-1 がある)
  if (j.checks?.lockfile && !['pending', 'skipped'].includes(j.checks.lockfile.status)) {
    const lf = j.checks.lockfile;
    for (const f of lf.files ?? []) {
      if (f.status === 'ok' || f.status === 'removed') continue;
      const why = ['changedSections', 'unexpectedRemovedImporters', 'unexpectedRemovedDeps', 'changedDeps', 'addedDeps', 'addedPackages', 'addedSnapshots', 'unexpectedPatchChanges']
        .filter((k) => Array.isArray(f[k]) && f[k].length).map((k) => `${k}=${JSON.stringify(f[k]).slice(0, 120)}`);
      bad.push(`checks.lockfile: ${f.path} が ${f.status}${why.length ? ` (${why.join(', ')})` : ''}`);
    }
    if (lf.status !== 'ok' && !(lf.files ?? []).some((f) => f.status !== 'ok' && f.status !== 'removed')) bad.push(`checks.lockfile が ok でない: ${lf.status}`);
    const root = (lf.files ?? []).find((f) => f.path === 'pnpm-lock.yaml');
    if (JSON.stringify(root?.expected?.removedPatches ?? []) !== JSON.stringify(['foundry-local-sdk'])) bad.push(`checks.lockfile: removedPatches が ["foundry-local-sdk"]（C-1 の分）でない: ${JSON.stringify(root?.expected?.removedPatches)}`);
  }
  return bad;
}

/** --only から C-1 を外した当て直しの記録を照らす。C-5 の前で止まること(docs/03 の5.1 の2-1)。 */
export function checkStopped(j) {
  const bad = [];
  if (j.result === 'ok') bad.push('result が ok（C-1 が無いのに C-5 が当たってしまった）');
  const c5 = (j.units ?? []).find((u) => u.id === 'C-5-extension-gallery');
  if (c5 && c5.applied === 'ok') bad.push('C-5-extension-gallery が applied: ok（C-1 が無いのに当たった）');
  const said = [...(j.errors ?? []), j.stoppedAt?.message ?? ''].join('\n');
  // 計画の誤り「C-5-extension-gallery: after の単位 C-1-ai が先に当たらない」か、単位の中の止め「C-5-extension-gallery: after の単位が当たっていない: C-1-ai」
  if (!/C-5-extension-gallery: after の単位(?: C-1-ai|が当たっていない: C-1-ai)/.test(said)) bad.push(`C-5 の after（C-1-ai）が理由の誤りが記録に無い。errors: ${JSON.stringify(j.errors ?? [])} / stoppedAt: ${JSON.stringify(j.stoppedAt ?? null)}`);
  if ((j.units ?? []).some((u) => u.id === 'C-1-ai' && u.applied === 'ok')) bad.push('C-1-ai が当たっている（--only から外した記録ではない）');
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
  const args = process.argv.slice(2);
  const stopped = args[0] === '--stopped';
  const [a, b] = stopped ? args.slice(1) : args;
  if (!a || !existsSync(a)) { console.error('使い方: node tests/c5-check-json.mjs <checks.json> [<typecheck.json>]  または  --stopped <checks.json>'); process.exit(2); }
  const unitJson = readJson(join(REPO, 'removals', 'C-5-extension-gallery', 'unit.json'));
  const aj = readJson(a);
  let bad;
  if (stopped) bad = checkStopped(aj).map((x) => `[止まる] ${x}`);
  else {
    bad = checkApply(aj, unitJson).map((x) => `[当て直し ${kindOf(aj)}] ${x}`);
    if (b) {
      if (!existsSync(b)) { console.error(`型検査の記録が無い: ${b}`); process.exit(2); }
      bad.push(...checkTypecheck(readJson(b), aj).map((x) => `[型検査] ${x}`));
    }
  }
  if (bad.length === 0) console.log(stopped ? '期待どおり（C-1 を外すと C-5 の前で止まる）' : `期待どおり（組 ${kindOf(aj)}: ${b ? '当て直し・型検査' : '当て直しのみ'}）`);
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

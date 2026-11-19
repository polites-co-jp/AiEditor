// C-7 の当て直し（apply.mjs の --checks-out）と型検査（build.mjs の --record）の記録を、期待の値と照らす。読むだけ。
// 期待の出どころ: tasks/2026-11-15-p5-c7-patch/handoff-notes.md の「テストの入口」、removals/C-7-breadcrumbs-outline/unit.json。
// 当て直しの組は2つ。記録の単位の並びで見分ける（C-3-remote が入っていれば b、無ければ a）:
//   a: A-1〜A-7・B-1〜B-7 の14単位と C-1・C-2・C-4・C-7（18単位。C-7 の前提 B-4・C-1・C-4 と、C-4 の前提 C-2 を含む最小の組）
//   b: A-1〜A-7・B-1〜B-7 の14単位と C-1〜C-7（21単位。この順）
// どちらの組でも C-2 の delete の1件（C-1 が先に消す debugChatIntegration.ts）が警告に出る。
// 使い方:
//   node tests/c7-check-json.mjs <checks.json> [<typecheck.json>]
//   node tests/c7-check-json.mjs --stopped <checks.json> [<外した単位の ID>]   （--only から前提の B-4・C-1・C-4 のどれかを外した当て直し。C-7 の前で止まること。ID を渡すと、その単位が理由の誤りを見る）
// 終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り。
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorName, expectedAuthor } from './build/commit-author.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const ME_ID = 'C-7-breadcrumbs-outline';

export const BASE_UNITS = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions',
  'A-5-remote-extensions', 'A-6-themes', 'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share',
  'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
export const UNITS_A = [...BASE_UNITS, 'C-1-ai', 'C-2-debug', 'C-4-notebook', ME_ID];
export const UNITS_B = [...BASE_UNITS, 'C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery', 'C-6-settings-sync', ME_ID];
/** C-1 が先に消すため C-2 の delete が「本家に無い」警告になる1件(a・b とも) */
export const C2_WARNING_FILE = 'src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts';
/** C-7 の前提の単位(unit.json の after) */
export const AFTER = ['B-4-outline-view', 'C-1-ai', 'C-4-notebook'];

/** 記録の組を見分ける。 */
export function kindOf(j) {
  return (j.units ?? []).some((u) => u.id === 'C-3-remote') ? 'b' : 'a';
}

/** 当て直しの記録を照らす。食い違いの文の配列を返す（空なら期待どおり）。 */
export function checkApply(j, unitJson) {
  const bad = [];
  const kind = kindOf(j);
  const expected = kind === 'b' ? UNITS_B : UNITS_A;
  const middle = expected.filter((x) => /^C-/.test(x) && x !== ME_ID);
  if (j.result !== 'ok') bad.push(`result が ok でない: ${j.result} (stoppedAt: ${JSON.stringify(j.stoppedAt)})`);
  if (j.dryRun) bad.push('dryRun の記録（実際に当てていない）');
  if (!/^[0-9a-f]{40}$/.test(j.headCommit ?? '')) bad.push(`headCommit が sha でない: ${j.headCommit}`);
  const units = j.units ?? [];
  const ids = units.map((u) => u.id);
  for (const id of expected) if (!ids.includes(id)) bad.push(`単位 ${id} が記録に無い`);
  for (const id of ids) if (!expected.includes(id)) bad.push(`想定していない単位が当たっている: ${id}（${kind} の組は ${expected.length} 単位）`);
  for (const u of units) if (expected.includes(u.id) && u.applied !== 'ok') bad.push(`${u.id}: applied が ok でない: ${u.applied}`);
  const at = (id) => ids.indexOf(id);
  for (const dep of AFTER) if (at(dep) > at(ME_ID)) bad.push(`C-7 が前提の ${dep} より先に当たっている`);
  const cOrder = middle.concat(ME_ID);
  for (let i = 1; i < cOrder.length; i++) if (at(cOrder[i - 1]) > at(cOrder[i])) { bad.push(`${kind} の並びが ${cOrder.join('→')} の順でない`); break; }

  for (const id of middle) {
    const u = units.find((x) => x.id === id);
    if (!u) continue;
    if (u.edits?.applied !== 'ok') bad.push(`${id} の edits が ok でない: ${u.edits?.applied}`);
    if ((u.edits?.conflicts ?? []).length !== 0) bad.push(`${id} の edits に衝突: ${JSON.stringify(u.edits.conflicts)}`);
  }
  const w2 = units.find((u) => u.id === 'C-2-debug')?.warnings ?? [];
  if (!(w2.length === 1 && w2[0].includes(C2_WARNING_FILE))) bad.push(`C-2-debug の warnings が想定の1件（${C2_WARNING_FILE} が本家に無い）でない: ${JSON.stringify(w2)}`);

  const me = units.find((u) => u.id === ME_ID);
  if (me) {
    if (me.edits?.applied !== 'ok') bad.push(`${ME_ID} の edits が ok でない: ${me.edits?.applied}`);
    if (me.edits?.subject !== `unit ${ME_ID}: edits`) bad.push(`${ME_ID} の edits の件名が違う: ${me.edits?.subject}`);
    if ((me.edits?.conflicts ?? []).length !== 0) bad.push(`${ME_ID} の edits に衝突: ${JSON.stringify(me.edits.conflicts)}`);
    if (!/^[0-9a-f]{40}$/.test(me.edits?.commit ?? '')) bad.push(`${ME_ID} の edits の commit が sha でない: ${me.edits?.commit}`);
    const ops = me.ops;
    if (!ops) bad.push(`${ME_ID} の ops の記録が無い`);
    else {
      const del = ops.deleted ?? [];
      const missing = ops.missingDeletes ?? [];
      if (missing.length) bad.push(`${ME_ID}: 本家に無い delete がある（0 件のはず）: ${JSON.stringify(missing)}`);
      if (unitJson && del.length + missing.length !== (unitJson.delete ?? []).length) bad.push(`${ME_ID}: delete の数が合わない（消した ${del.length} + 本家に無い ${missing.length} ≠ unit.json の ${(unitJson.delete ?? []).length}）`);
      if (unitJson) for (const d of unitJson.delete ?? []) if (!del.some((x) => String(x).replace(/\/+$/, '') === d.replace(/\/+$/, ''))) bad.push(`${ME_ID}: delete の記録に無い: ${d}`);
      const rl = ops.removeLines ?? [];
      if (unitJson && rl.length !== (unitJson.removeLines ?? []).length) bad.push(`${ME_ID}: removeLines の記録が ${rl.length} 行（unit.json は ${(unitJson.removeLines ?? []).length} 行）`);
      for (const r of rl) if (r.ok !== true || r.found !== 1 || r.count !== 1) bad.push(`${ME_ID}: removeLines が1行ちょうどで見つからない: ${r.file}: ${r.line} (found ${r.found}, count ${r.count})`);
      if (unitJson) {
        const have = new Set(rl.map((r) => `${r.file}\n${r.line}`));
        for (const r of unitJson.removeLines ?? []) if (!have.has(`${r.file}\n${r.line}`)) bad.push(`${ME_ID}: removeLines の記録に無い行: ${r.file}: ${r.line}`);
      }
      if ((ops.productRemoved ?? []).length || (ops.productMissing ?? []).length) bad.push(`${ME_ID}: productRemove は空のはず: ${JSON.stringify([ops.productRemoved, ops.productMissing])}`);
      if ((ops.missingDependencies ?? []).length) bad.push(`${ME_ID}: missingDependencies: ${JSON.stringify(ops.missingDependencies)}`);
      if ((ops.removedDependencies ?? []).length) bad.push(`${ME_ID}: 依存は消さないはず: ${JSON.stringify(ops.removedDependencies)}`);
    }
    if ((me.warnings ?? []).length) bad.push(`${ME_ID} の warnings が空でない: ${JSON.stringify(me.warnings)}`);
  }

  // 全体の警告・誤り: C-2 の1件だけ
  const topWarn = (j.warnings ?? []).filter((x) => !String(x).includes(C2_WARNING_FILE));
  if (topWarn.length) bad.push(`想定していない warnings: ${JSON.stringify(topWarn).slice(0, 300)}`);
  if ((j.warnings ?? []).length !== 1) bad.push(`記録の最上位の warnings が 1 件でない: ${(j.warnings ?? []).length} 件`);
  if ((j.errors ?? []).length) bad.push(`errors がある: ${JSON.stringify(j.errors).slice(0, 300)}`);

  if (j.checks?.remnants?.status !== 'ok') bad.push(`checks.remnants が ok でない: ${j.checks?.remnants?.status} ${JSON.stringify(j.checks?.remnants?.items ?? []).slice(0, 300)}`);
  if (j.checks?.absentStrings?.status !== 'ok') {
    const hits = (j.checks?.absentStrings?.items ?? []).filter((i) => i.hitCount > 0).map((i) => `${i.unit} ${i.text} -> ${(i.hits ?? []).slice(0, 3).map((h) => (typeof h === 'string' ? h : JSON.stringify(h))).join(' | ')}`);
    bad.push(`checks.absentStrings が ok でない: ${j.checks?.absentStrings?.status}\n    ${hits.join('\n    ')}`);
  }
  if (unitJson) {
    const want = (unitJson.checks?.absentStrings ?? []).map((s) => s.text);
    const mine = (j.checks?.absentStrings?.items ?? []).filter((i) => i.unit === ME_ID);
    const got = new Set(mine.map((i) => i.text));
    const missing = want.filter((t) => !got.has(t));
    if (missing.length) bad.push(`${ME_ID} の absentStrings のうち検査の記録が無いもの: ${missing.join(', ')}`);
    for (const i of mine) if (i.hitCount !== 0) bad.push(`${ME_ID} の absentStrings が見つかった: ${i.text} (${i.hitCount})`);
  }
  if (j.checks?.registeredKeys && j.checks.registeredKeys.status !== 'ok') bad.push(`checks.registeredKeys が ok でない: ${j.checks.registeredKeys.status}`);
  if (j.checks?.commitIdentity && j.checks.commitIdentity.status !== 'ok') bad.push(`checks.commitIdentity が ok でない: ${j.checks.commitIdentity.status} ${JSON.stringify(j.checks.commitIdentity.items ?? []).slice(0, 200)}`);

  // コミットの並び: C-7 の ops → edits。前提の単位の edits の後。作者は sukuna-apply
  const commits = j.commits ?? [];
  if (commits.length) {
    const subj = commits.map((c) => c.subject);
    const iOps = subj.indexOf(`unit ${ME_ID}: ops`);
    const iEdits = subj.indexOf(`unit ${ME_ID}: edits`);
    if (iOps < 0 || iEdits < 0) bad.push('commits に C-7 の ops・edits のコミットが無い');
    else {
      if (iOps > iEdits) bad.push('commits の並びが違う（C-7 の ops が edits の後）');
      for (const id of middle) if (subj.indexOf(`unit ${id}: edits`) > iOps) bad.push(`commits の並びが違う（${id} の edits が C-7 の ops の後）`);
    }
    for (const c of commits.filter((x) => new RegExp(`^unit ${ME_ID}:`).test(x.subject))) {
      const want = expectedAuthor(j);
      if (c.author !== want) bad.push(`${c.subject} の作者が ${authorName(want)} でない: ${c.author}`);
    }
  }

  // --lockfile-check をかけた記録だけ。C-7 は依存もパッチも消さない。パッチの節が減るのは C-1 の foundry-local-sdk だけ
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

/** --only から前提の単位(missingId。省略なら AFTER のどれか)を外した当て直しの記録を照らす。C-7 の前で止まること(docs/03 の5.1 の2-1)。 */
export function checkStopped(j, missingId = null) {
  const bad = [];
  if (j.result === 'ok') bad.push('result が ok（前提の単位が無いのに C-7 が当たってしまった）');
  const me = (j.units ?? []).find((u) => u.id === ME_ID);
  if (me && me.applied === 'ok') bad.push(`${ME_ID} が applied: ok（前提の単位が無いのに当たった）`);
  const said = [...(j.errors ?? []), j.stoppedAt?.message ?? ''].join('\n');
  const idRe = missingId ? missingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : `(?:${AFTER.join('|')})`;
  // 計画の誤り「C-7-breadcrumbs-outline: after の単位 X が先に当たらない」か、単位の中の止め「…: after の単位が当たっていない: X」
  if (!new RegExp(`C-7-breadcrumbs-outline: after の単位(?: ${idRe}|が当たっていない: [^\\n]*${idRe})`).test(said)) bad.push(`C-7 の after（${missingId ?? AFTER.join('・')}）が理由の誤りが記録に無い。errors: ${JSON.stringify(j.errors ?? [])} / stoppedAt: ${JSON.stringify(j.stoppedAt ?? null)}`);
  if (missingId && (j.units ?? []).some((u) => u.id === missingId && u.applied === 'ok')) bad.push(`${missingId} が当たっている（--only から外した記録ではない）`);
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
  if (!a || !existsSync(a)) { console.error('使い方: node tests/c7-check-json.mjs <checks.json> [<typecheck.json>]  または  --stopped <checks.json> [<外した単位の ID>]'); process.exit(2); }
  const unitJson = readJson(join(REPO, 'removals', ME_ID, 'unit.json'));
  const aj = readJson(a);
  let bad;
  if (stopped) bad = checkStopped(aj, b || null).map((x) => `[止まる] ${x}`);
  else {
    bad = checkApply(aj, unitJson).map((x) => `[当て直し ${kindOf(aj)}] ${x}`);
    if (b) {
      if (!existsSync(b)) { console.error(`型検査の記録が無い: ${b}`); process.exit(2); }
      bad.push(...checkTypecheck(readJson(b), aj).map((x) => `[型検査] ${x}`));
    }
  }
  if (bad.length === 0) console.log(stopped ? '期待どおり（前提の単位を外すと C-7 の前で止まる）' : `期待どおり（組 ${kindOf(aj)}: ${b ? '当て直し・型検査' : '当て直しのみ'}）`);
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

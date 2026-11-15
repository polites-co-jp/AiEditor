// C-1 の当て直し（apply.mjs の --checks-out）と型検査（build.mjs の --record）の記録を、期待の値と照らす。読むだけ。
// 期待の出どころ: tasks/2026-11-15-p5-c1-patch/handoff-notes.md の「テストの入口」の1・2、removals/C-1-ai/unit.json。
// 使い方: node tests/c1-check-json.mjs <checks.json> [<typecheck.json>]
// 終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り。
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため。2026-11-15 に tests/removals/ から移した)。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

export const EXPECTED_UNITS = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions',
  'A-5-remote-extensions', 'A-6-themes', 'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share',
  'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest', 'C-1-ai'];

/** 当て直しの記録を照らす。食い違いの文の配列を返す（空なら期待どおり）。 */
export function checkApply(j, unitJson) {
  const bad = [];
  if (j.result !== 'ok') bad.push(`result が ok でない: ${j.result} (stoppedAt: ${j.stoppedAt})`);
  const units = j.units ?? [];
  const ids = units.map((u) => u.id);
  for (const id of EXPECTED_UNITS) if (!ids.includes(id)) bad.push(`単位 ${id} が記録に無い`);
  for (const u of units) if (EXPECTED_UNITS.includes(u.id) && u.applied !== 'ok') bad.push(`${u.id}: applied が ok でない: ${u.applied}`);
  const c1 = units.find((u) => u.id === 'C-1-ai');
  if (c1) {
    if (c1.edits?.applied !== 'ok') bad.push(`C-1-ai の edits が ok でない: ${c1.edits?.applied}`);
    if (c1.edits?.subject !== 'unit C-1-ai: edits') bad.push(`C-1-ai の edits の件名が違う: ${c1.edits?.subject}`);
    if ((c1.edits?.conflicts ?? []).length !== 0) bad.push(`C-1-ai の edits に衝突: ${JSON.stringify(c1.edits.conflicts)}`);
  }
  if (j.checks?.remnants?.status !== 'ok') bad.push(`checks.remnants が ok でない: ${j.checks?.remnants?.status} ${JSON.stringify(j.checks?.remnants?.items ?? []).slice(0, 300)}`);
  if (j.checks?.absentStrings?.status !== 'ok') {
    const hits = (j.checks?.absentStrings?.items ?? []).filter((i) => i.hitCount > 0).map((i) => `${i.unit} ${i.text} -> ${(i.hits ?? []).slice(0, 3).map((h) => (typeof h === 'string' ? h : JSON.stringify(h))).join(' | ')}`);
    bad.push(`checks.absentStrings が ok でない: ${j.checks?.absentStrings?.status}\n    ${hits.join('\n    ')}`);
  }
  // C-1 の absentStrings は unit.json の項目が全部検査されている（検査の抜けを見る）
  if (unitJson) {
    const want = (unitJson.checks?.absentStrings ?? []).map((s) => s.text);
    const got = new Set((j.checks?.absentStrings?.items ?? []).filter((i) => i.unit === 'C-1-ai').map((i) => i.text));
    const missing = want.filter((t) => !got.has(t));
    if (missing.length) bad.push(`C-1-ai の absentStrings のうち検査の記録が無いもの: ${missing.join(', ')}`);
  }
  // --lockfile-check をかけた記録だけ: ロックファイルの差分が「消した依存の削除」と、単位が消したパッチの節の減りだけであること
  // status が pending・skipped = --lockfile-check をかけていない記録(依存の導入の前)。ここでは見ない(1c の手順で別に取る)。
  if (j.checks?.lockfile && !['pending', 'skipped'].includes(j.checks.lockfile.status)) {
    const lf = j.checks.lockfile;
    for (const f of lf.files ?? []) {
      if (f.status === 'ok' || f.status === 'removed') continue;
      const why = ['changedSections', 'unexpectedRemovedImporters', 'unexpectedRemovedDeps', 'changedDeps', 'addedDeps', 'addedPackages', 'addedSnapshots', 'unexpectedPatchChanges']
        .filter((k) => Array.isArray(f[k]) && f[k].length).map((k) => `${k}=${JSON.stringify(f[k]).slice(0, 120)}`);
      bad.push(`checks.lockfile: ${f.path} が ${f.status}${why.length ? ` (${why.join(', ')})` : ''}`);
    }
    if (lf.status !== 'ok' && !(lf.files ?? []).some((f) => f.status !== 'ok' && f.status !== 'removed')) bad.push(`checks.lockfile が ok でない: ${lf.status}`);
  }
  const rd = j.builtinExtensions?.removedDefaults ?? [];
  if (!rd.some((d) => d.key === 'chat.disableAIFeatures' && d.unit === 'C-1-ai')) bad.push('removedDefaults に { key: "chat.disableAIFeatures", unit: "C-1-ai" } が無い');
  if (j.dryRun) bad.push('dryRun の記録（実際に当てていない）');
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
  if (!a || !existsSync(a)) { console.error('使い方: node tests/c1-check-json.mjs <checks.json> [<typecheck.json>]'); process.exit(2); }
  const unitJson = readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json'));
  const aj = readJson(a);
  const bad = checkApply(aj, unitJson).map((x) => `[当て直し] ${x}`);
  if (b) {
    if (!existsSync(b)) { console.error(`型検査の記録が無い: ${b}`); process.exit(2); }
    bad.push(...checkTypecheck(readJson(b), aj).map((x) => `[型検査] ${x}`));
  }
  if (bad.length === 0) console.log(`期待どおり（${b ? '当て直し・型検査' : '当て直しのみ'}）`);
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

// C-1 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c1-patch/handoff-notes.md の2回目の「テストの入口」の1、removals/C-1-ai/unit.json。
//   - package.json・remote/package.json に、unit.json の removeDependencies の名前が無い（dependencies・devDependencies・optionalDependencies）
//   - remote/package.json に tar が残る
//   - pnpm-workspace.yaml に patchedDependencies が無い。package.json の scripts に bundle-dev-tunnels-web が無い
//   - unit.json の delete に挙げたパスが無い（build/next/agentHostCrypto.ts・devTunnelsWeb.ts・build/npm/patches/foundry-local-sdk.patch を含む）
//   - kept のパスが残っている（認証の MCP の3つ、services/chat、comments など）
//   - 新しいファイル2つがある
// 使い方: node tests/c1-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため。2026-11-15 に tests/removals/ から移した)。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const GROUPS = ['dependencies', 'devDependencies', 'optionalDependencies'];

export const MUST_BE_DELETED = ['build/next/agentHostCrypto.ts', 'build/next/devTunnelsWeb.ts', 'build/npm/patches/foundry-local-sdk.patch'];
export const MUST_STAY = [
  'src/vs/workbench/api/common/extHostRemovedApi.ai.ts',
  'src/vs/workbench/services/chat/common/chatEntitlementService.ts',
];
// 5回目で別のファイルをやめ、NullChatEntitlementService は chatEntitlementService.ts の末尾にある
export const ENTITLEMENT_FILE = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
export const MUST_NOT_EXIST = ['src/vs/workbench/services/chat/common/nullChatEntitlementService.ts'];

/** root: 作業ツリーのフォルダ。unit: removals/C-1-ai/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  for (const [file, names] of Object.entries(unit.removeDependencies ?? {})) {
    if (!existsSync(at(file))) { bad.push(`${file} が無い`); continue; }
    const pj = readJson(at(file));
    for (const g of GROUPS) for (const n of names) if (pj[g] && n in pj[g]) bad.push(`${file}: ${g} にまだ ${n} がある`);
  }
  if (existsSync(at('remote/package.json'))) {
    const rp = readJson(at('remote/package.json'));
    if (!GROUPS.some((g) => rp[g] && 'tar' in rp[g])) bad.push('remote/package.json から tar が無くなっている（残す）');
  } else bad.push('remote/package.json が無い');
  if (existsSync(at('pnpm-workspace.yaml'))) {
    if (/^patchedDependencies:/m.test(readFileSync(at('pnpm-workspace.yaml'), 'utf8'))) bad.push('pnpm-workspace.yaml にまだ patchedDependencies がある');
  } else bad.push('pnpm-workspace.yaml が無い');
  if (existsSync(at('package.json'))) {
    const pj = readJson(at('package.json'));
    if (pj.scripts && 'bundle-dev-tunnels-web' in pj.scripts) bad.push('package.json の scripts にまだ bundle-dev-tunnels-web がある');
  }
  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  // C-4 が当たっている木(新しいファイル extHostRemovedApi.notebook.ts がある)では、C-4 の delete の中のパス(contrib/notebook/browser など)は見ない
  // (C-4 を含む組 b でも、1回で照らせるようにする。大岡越前守の検証 2026-11-15 の軽微な指摘)
  const c4Marker = existsSync(at('src/vs/workbench/api/common/extHostRemovedApi.notebook.ts'));
  const c4Del = c4Marker && existsSync(join(REPO, 'removals', 'C-4-notebook', 'unit.json')) ? (readJson(join(REPO, 'removals', 'C-4-notebook', 'unit.json')).delete ?? []) : [];
  const inC4 = (p) => c4Del.some((d) => p === d.replace(/\/+$/, '') || p.startsWith(d.replace(/\/+$/, '') + '/'));
  for (const k of unit.kept ?? []) {
    // absentStrings の除外のための kept は、本家のままのファイル。当てた後も残る
    if (!inC4(k.path) && !existsSync(at(k.path))) bad.push(`残るはずのパスが無い: ${k.path}`);
  }
  for (const p of MUST_STAY) if (!existsSync(at(p))) bad.push(`新しいファイルが無い: ${p}`);
  for (const p of MUST_NOT_EXIST) if (existsSync(at(p))) bad.push(`別のファイルが残っている(5回目で chatEntitlementService.ts の末尾へ移した): ${p}`);
  if (existsSync(at(ENTITLEMENT_FILE))) {
    const t = readFileSync(at(ENTITLEMENT_FILE), 'utf8');
    if (!/export class NullChatEntitlementService implements IChatEntitlementService\b/.test(t)) bad.push(`${ENTITLEMENT_FILE} に NullChatEntitlementService が無い`);
    if (!/registerSingleton\(\s*IChatEntitlementService\s*,\s*NullChatEntitlementService\b/.test(t)) bad.push(`${ENTITLEMENT_FILE} が NullChatEntitlementService を登録していない`);
    if (/registerSingleton\(\s*IChatEntitlementService\s*,\s*ChatEntitlementService\b/.test(t)) bad.push(`${ENTITLEMENT_FILE} に元の ChatEntitlementService の登録が残っている`);
  }
  // 消えた依存のために外した allowBuilds の項目が残っていない(unit.json の removeLines の pnpm-workspace.yaml の「名前@版: true|false」の行)
  if (existsSync(at('pnpm-workspace.yaml'))) {
    const lines = readFileSync(at('pnpm-workspace.yaml'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    for (const r of unit.removeLines ?? []) {
      if (r.file === 'pnpm-workspace.yaml' && /@\d[\w.-]*'?: (?:true|false)$/.test(r.line.trim()) && lines.includes(r.line.trim())) bad.push(`pnpm-workspace.yaml にまだ ${r.line.trim()} がある`);
    }
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c1-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

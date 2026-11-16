// C-1 の2回目の直し（2026-11-15。蒙恬の handoff-notes の「2回目」と「テストの入口」の1・2）の検査。
//   - unit.json: 依存の削除、pnpm-workspace.yaml の patchedDependencies、bundle-dev-tunnels-web、消すファイル、absentStrings に足した7つ
//   - edits.patch: absentStrings の文字列を、patch 自身が足していない（当てた後に検査で落ちない）
//   - 作業ツリーの照らし役 tests/c1-check-worktree.mjs（一時のフォルダの上で）
// 行数・sha に頼らない。本家 1.146.0 は C:/b/vscode のタグから git で読む（読めなければ、その検査だけ飛ばす）。
// Run: node --test tests/c1-round2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorktree, ENTITLEMENT_FILE, MUST_BE_DELETED, MUST_STAY } from './c1-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNIT_DIR = join(REPO, 'removals', 'C-1-ai');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-1-ai/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchPath = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchPath && existsSync(patchPath) ? false : '実装なし: edits.patch が無い');

import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout : null; };
const skipUp = noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);

const underAny = (list, p) => list.some((d) => { const dd = d.replace(/\/+$/, ''); return p === dd || p.startsWith(dd + '/'); });

// 2回目に足したもの（handoff-notes の2回目）。名前が変わったら unit.json と一緒にここを直す。
const ROOT_DEPS = ['@hpke/core', 'libsodium-wrappers', '@devcontainers/cli', '@microsoft/dev-tunnels-connections', '@microsoft/dev-tunnels-contracts',
  '@microsoft/dev-tunnels-management', '@microsoft/dev-tunnels-ssh', '@microsoft/dev-tunnels-ssh-tcp', 'ssh2', 'ws'];
const REMOTE_DEPS = ['@hpke/core', 'libsodium-wrappers', '@devcontainers/cli', 'ssh2', 'ws'];
const NEW_ABSENT = ['getCopilotRuntimeVersion', 'renderCopilotShimLauncher', 'bundleAgentHostCrypto', 'electron-browser/sessions${', 'isSessionsWorkbench', "'--agents'", 'class McpSettingsRenderer']; // 7つ目は4回目で workbench.mcp.open(本家に文字列が無く空振り)から替えた

test('C-1 2回目: removeDependencies にルートの10と remote の5が入っている。1回目の依存も残っている。tar は remote で消さない', { skip: noUnit }, () => {
  const rd = unit.removeDependencies ?? {};
  for (const n of ROOT_DEPS) assert.ok(rd['package.json']?.includes(n), `package.json の removeDependencies に ${n} が無い`);
  for (const n of REMOTE_DEPS) assert.ok(rd['remote/package.json']?.includes(n), `remote/package.json の removeDependencies に ${n} が無い`);
  for (const n of ['@anthropic-ai/sdk', '@github/copilot-sdk', '@vscode/copilot-api', 'foundry-local-sdk', '@modelcontextprotocol/sdk']) assert.ok(rd['package.json']?.includes(n), `1回目の ${n} が無い`);
  assert.ok(!(rd['remote/package.json'] ?? []).includes('tar'), 'remote の tar は残す（Claude Code とは別だが、残る部品が使う）');
  for (const [f, names] of Object.entries(rd)) assert.equal(new Set(names).size, names.length, `${f}: 依存の名前が重複`);
});

test('C-1 2回目: removeDependencies の名前が本家 1.146.0 の package.json にある（綴りの誤りや、既に無い依存に気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const [file, names] of Object.entries(unit.removeDependencies ?? {})) {
    const src = upShow(file);
    if (src === null) { bad.push(`${file} が本家に無い`); continue; }
    const pj = JSON.parse(src);
    for (const n of names) if (!['dependencies', 'devDependencies', 'optionalDependencies'].some((g) => pj[g] && n in pj[g])) bad.push(`${file}: ${n} が本家に無い`);
  }
  assert.deepEqual(bad, []);
});

test('C-1 2回目: edits.patch が、外した依存を import / require する行を足していない', { skip: noPatch }, () => {
  // 残る本家のソースが外した依存を使っているかは、型検査と起動で見る（ここでは patch が足す行だけ）。
  const text = readFileSync(patchPath, 'utf8').replace(/\r\n/g, '\n');
  const added = [];
  let path = null;
  for (const line of text.split('\n')) {
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { path = m[2]; continue; }
    if (path && line.startsWith('+') && !line.startsWith('+++')) added.push({ path, line: line.slice(1) });
  }
  const names = [...new Set(Object.values(unit.removeDependencies ?? {}).flat())];
  const bad = [];
  for (const { path: p, line } of added) {
    for (const n of names) {
      if (new RegExp(`from\\s+'${n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?:/[^']*)?'`).test(line) || new RegExp(`require\\('${n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'\\)`).test(line)) bad.push(`${p}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bad, [], 'edits.patch が、外した依存を import する行を足している');
});

test('C-1 2回目: delete に build/next の agentHostCrypto・devTunnelsWeb の6つと foundry のパッチがある', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  for (const p of ['build/next/agentHostCrypto.ts', 'build/next/agentHostCryptoEntry.ts', 'build/next/test/agentHostCrypto.test.ts',
    'build/next/devTunnelsWeb.ts', 'build/next/devTunnelsWebEntry.js', 'build/next/test/devTunnelsWeb.test.ts', 'build/npm/patches/foundry-local-sdk.patch']) {
    assert.ok(del.includes(p), `delete に ${p} が無い`);
  }
  for (const p of MUST_BE_DELETED) assert.ok(underAny(del, p), `照らし役の「消えるはず」 ${p} が delete に無い`);
});

test('C-1 2回目: delete したファイルが本家 1.146.0 にある（build/ の分）', { skip: skipUp }, () => {
  const missing = (unit.delete ?? []).filter((p) => p.startsWith('build/')).filter((p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p}`]).status !== 0);
  assert.deepEqual(missing, []);
});

test('C-1 2回目: removeLines に package.json の bundle-dev-tunnels-web と pnpm-workspace.yaml の patchedDependencies の2行がある。本家のファイルにちょうどある', { skip: noUnit }, () => {
  const rl = unit.removeLines ?? [];
  const pj = rl.filter((r) => r.file === 'package.json' && r.line.includes('"bundle-dev-tunnels-web"'));
  assert.equal(pj.length, 1, 'package.json の bundle-dev-tunnels-web の行がちょうど1つでない');
  const ws = rl.filter((r) => r.file === 'pnpm-workspace.yaml' && (r.line.trim() === 'patchedDependencies:' || /^foundry-local-sdk:\s+\S+\.patch$/.test(r.line.trim())));
  assert.equal(ws.length, 2, 'pnpm-workspace.yaml の patchedDependencies の見出しと foundry-local-sdk の2行でない');
});

test('C-1 2回目: pnpm-workspace.yaml の removeLines が、本家の patchedDependencies の節を空にする（foundry だけ・ほかの名前が残らない形）', { skip: skipUp }, () => {
  const src = upShow('pnpm-workspace.yaml');
  assert.ok(src, '本家の pnpm-workspace.yaml が読めない');
  const lines = src.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === 'patchedDependencies:');
  assert.ok(at >= 0, '本家に patchedDependencies の節が無い');
  const items = [];
  for (let i = at + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) items.push(lines[i].trim());
  const removed = (unit.removeLines ?? []).filter((r) => r.file === 'pnpm-workspace.yaml').map((r) => r.line.trim()).filter((l) => /\.patch$/.test(l));
  // 見出しを消すなら、節の項目はすべて消す行の中にある（見出しだけ・項目だけが残ると YAML が壊れる）
  assert.deepEqual([...items].sort(), [...removed].sort(), '本家の patchedDependencies の項目と、消す項目が一致しない（残る項目があるのに見出しを消している）');
});

test('C-1 5回目: pnpm-workspace.yaml の allowBuilds の4行を removeLines が消す。ssh2・cpu-features は消さない(test/smoke が使う)。4行とも本家にある', { skip: noUnit }, () => {
  const rl = (unit.removeLines ?? []).filter((r) => r.file === 'pnpm-workspace.yaml').map((r) => r.line.trim());
  for (const l of ['foundry-local-sdk@2.2.1: true', 'bufferutil@4.1.0: true', 'utf-8-validate@5.0.10: true', 'koffi@3.2.1: false']) assert.ok(rl.includes(l), `removeLines に ${l} が無い`);
  assert.ok(!rl.some((l) => /^'?(ssh2|cpu-features)\b/.test(l)), 'ssh2・cpu-features の allowBuilds を消している(test/smoke のワークスペースが使うので残す)');
  if (!upOk) return;
  const src = upShow('pnpm-workspace.yaml') ?? '';
  const have = new Set(src.split(/\r?\n/).map((l) => l.trim()));
  assert.deepEqual(rl.filter((l) => /@\d[\w.-]*'?: (?:true|false)$/.test(l) && !have.has(l)), []);
});

test('C-1 2回目: checks.absentStrings に足した7つがあり、対象のファイルが本家に実在する', { skip: noUnit }, () => {
  const have = new Map((unit.checks.absentStrings ?? []).map((s) => [s.text, s]));
  for (const t of NEW_ABSENT) assert.ok(have.has(t), `absentStrings に ${t} が無い`);
  if (!upOk) return;
  const missing = [];
  for (const t of NEW_ABSENT) for (const f of have.get(t).in) {
    if (spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${f}`]).status !== 0 && spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${f.replace(/\/+$/, '')}`]).status !== 0) missing.push(`${t}: ${f}`);
  }
  assert.deepEqual(missing, []);
});

test('C-1 2回目: 足した7つの文字列は本家のソースにある（元から無い文字列を「無いこと」で検査しても何も守れない）', { skip: skipUp }, () => {
  const have = new Map((unit.checks.absentStrings ?? []).map((s) => [s.text, s]));
  const dead = [];
  for (const t of NEW_ABSENT) {
    const entry = have.get(t);
    if (!entry) continue;
    const found = entry.in.some((f) => {
      const src = upShow(f);
      if (src !== null) return src.includes(t);
      // フォルダ
      const r = spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-q', '--', t, UP_TAG, '--', f]);
      return r.status === 0;
    });
    if (!found) dead.push(t);
  }
  assert.deepEqual(dead, []);
});

test('C-1 2回目: edits.patch が足す行に absentStrings の文字列が現れない（kept の対象を除く。当てた後の検査で自分が落ちない）', { skip: noPatch }, () => {
  const text = readFileSync(patchPath, 'utf8').replace(/\r\n/g, '\n');
  const sections = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], added: [] }; sections.push(cur); continue; }
    if (cur && line.startsWith('+') && !line.startsWith('+++')) cur.added.push(line.slice(1));
  }
  const kept = (unit.kept ?? []).map((k) => k.path);
  const bad = [];
  for (const { in: where, text: t } of unit.checks.absentStrings ?? []) {
    for (const s of sections) {
      if (!underAny(where, s.path) || underAny(kept, s.path)) continue;
      const hit = s.added.find((l) => l.includes(t));
      if (hit) bad.push(`${t} が ${s.path} の足す行にある: ${hit.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// 作業ツリーの照らし役（c1-check-worktree.mjs）。一時のフォルダの上で、期待どおりの木と、壊した木を作って確かめる
// ---------------------------------------------------------------------------
function makeTree({ rootDeps = {}, remoteDeps = { tar: '^7' }, withPatched = false, withAllowBuilds = false, scripts = {}, extraFiles = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c1wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  put('package.json', JSON.stringify({ dependencies: rootDeps, scripts }));
  put('remote/package.json', JSON.stringify({ dependencies: remoteDeps }));
  put('pnpm-workspace.yaml', withPatched ? 'packages:\n  - a\npatchedDependencies:\n  x: y.patch\n' : 'packages:\n  - a\n');
  for (const k of unit.kept) { if (/\.[A-Za-z0-9]+$/.test(k.path)) put(k.path, 'x'); else mkdirSync(join(root, ...k.path.split('/')), { recursive: true }); }
  for (const p of MUST_STAY) put(p, 'x');
  put(ENTITLEMENT_FILE, 'export class NullChatEntitlementService implements IChatEntitlementService {}\nregisterSingleton(IChatEntitlementService, NullChatEntitlementService, InstantiationType.Eager);\n');
  if (withAllowBuilds) put('pnpm-workspace.yaml', 'packages:\n  - a\nallowBuilds:\n  ssh2: false\n  bufferutil@4.1.0: true\n');
  for (const p of extraFiles) put(p, 'x');
  return root;
}

test('c1-check-worktree: 期待どおりの木は食い違いが無い', { skip: noUnit }, () => {
  const root = makeTree({ rootDeps: { lodash: '1' } });
  try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c1-check-worktree: C-4 を含む組 b の木(C-4 の delete の中の kept のファイルが無い)でも食い違いが無い。C-4 が当たっていない木では、同じファイルが無いのは食い違い', { skip: noUnit }, () => {
  const root = makeTree({ rootDeps: { lodash: '1' } });
  try {
    const c4 = readJson(join(REPO, 'removals', 'C-4-notebook', 'unit.json'));
    const inC4 = (p) => c4.delete.some((d) => p === d || p.startsWith(`${d}/`));
    const keptInC4 = unit.kept.map((k) => k.path).filter(inC4);
    assert.ok(keptInC4.length >= 1, '前提: C-1 の kept に C-4 の delete の中のパスがある');
    for (const p of keptInC4) rmSync(join(root, ...p.split('/')), { recursive: true, force: true });
    const noMark = checkWorktree(root, unit);
    assert.ok(keptInC4.every((p) => noMark.some((x) => x.includes(p))), JSON.stringify(noMark));
    const f = join(root, ...'src/vs/workbench/api/common/extHostRemovedApi.notebook.ts'.split('/'));
    mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x');
    assert.deepEqual(checkWorktree(root, unit), []);
    // C-4 のしるしがあっても、C-1 の期待は見る(C-4 の delete の外の kept が無いのは食い違い)
    rmSync(join(root, ...'src/vs/workbench/contrib/comments'.split('/')), { recursive: true, force: true });
    assert.ok(checkWorktree(root, unit).some((x) => /残るはずのパスが無い: src\/vs\/workbench\/contrib\/comments/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c1-check-worktree: 依存が残る・patchedDependencies が残る・scripts が残る・消えるはずのファイルが残る・残るはずが無い、を見つける', { skip: noUnit }, () => {
  const cases = [
    ['ルートの依存', { rootDeps: { '@hpke/core': '1' } }, /package\.json: dependencies にまだ @hpke\/core/],
    ['remote の依存', { remoteDeps: { tar: '1', ssh2: '1' } }, /remote\/package\.json: dependencies にまだ ssh2/],
    ['tar が無い', { remoteDeps: {} }, /tar が無くなっている/],
    ['patchedDependencies', { withPatched: true }, /patchedDependencies がある/],
    ['allowBuilds の外した行が残る', { withAllowBuilds: true }, /pnpm-workspace\.yaml にまだ bufferutil@4\.1\.0: true がある/],
    ['別のファイル nullChatEntitlementService.ts が残る', { extraFiles: ['src/vs/workbench/services/chat/common/nullChatEntitlementService.ts'] }, /別のファイルが残っている/],
    ['scripts', { scripts: { 'bundle-dev-tunnels-web': 'node x' } }, /bundle-dev-tunnels-web/],
    ['消えるはずのファイル', { extraFiles: ['build/npm/patches/foundry-local-sdk.patch'] }, /消えているはずのパスが残っている: build\/npm\/patches\/foundry-local-sdk\.patch/],
    ['delete の下', { extraFiles: ['src/vs/workbench/contrib/chat/browser/chat.contribution.ts'] }, /消えているはずのパスが残っている: src\/vs\/workbench\/contrib\/chat/],
  ];
  for (const [name, opt, re] of cases) {
    const root = makeTree(opt);
    try {
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // 残るはずのものが無い
  const root = makeTree();
  try {
    rmSync(join(root, 'src'), { recursive: true, force: true });
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(bad.some((x) => /新しいファイルが無い/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

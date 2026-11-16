// tests/c3-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに unit.json の removeLines と productRemove、
// edits.patch を自前の小さな当て方で当てた木を一時のフォルダに作り、期待どおり・壊した木を照らす。
// Run: node --test tests/c3-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorktree, CONST_LINE, MAINS, MUST_STAY, SHARED, VIEWS } from './c3-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNIT_DIR = join(REPO, 'removals', 'C-3-remote');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unit = readJson(join(UNIT_DIR, 'unit.json'));
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };

function parsePatch(text) {
  const out = [];
  let cur = null;
  let hunk = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line === '-- ') break;
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], isNew: false, hunks: [] }; out.push(cur); hunk = null; continue; }
    if (!cur) continue;
    if (/^@@ /.test(line)) { hunk = []; cur.hunks.push(hunk); continue; }
    if (!hunk) { if (/^new file mode/.test(line)) cur.isNew = true; continue; }
    if (line.startsWith('+')) hunk.push({ k: '+', t: line.slice(1) });
    else if (line.startsWith('-')) hunk.push({ k: '-', t: line.slice(1) });
    else if (line.startsWith(' ')) hunk.push({ k: ' ', t: line.slice(1) });
  }
  return out;
}
function applyHunks(content, hunks) {
  const lines = content.split('\n');
  let from = 0;
  for (const h of hunks) {
    const oldL = h.filter((x) => x.k !== '+').map((x) => x.t);
    const newL = h.filter((x) => x.k !== '-').map((x) => x.t);
    let at = -1;
    for (let i = from; i <= lines.length - oldL.length; i++) if (oldL.every((t, j) => lines[i + j] === t)) { at = i; break; }
    assert.ok(at >= 0, `ハンクが当たらない: ${oldL[0]}`);
    lines.splice(at, oldL.length, ...newL);
    from = at + newL.length;
  }
  return lines.join('\n');
}

/** 本家のファイルに removeLines・productRemove・edits.patch を当てた木を作る。delete したものは作らない。残すものは中身の無いファイルで置く。 */
function makeAppliedTree() {
  const root = mkdtempSync(join(tmpdir(), 'c3wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const files = new Map();
  const need = (p) => { if (!files.has(p)) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); } return files.get(p); };
  for (const r of unit.removeLines) {
    const lines = need(r.file).split('\n');
    const i = lines.findIndex((l) => l.trim() === r.line.trim());
    assert.ok(i >= 0, `removeLines の行が無い: ${r.file}: ${r.line}`);
    lines.splice(i, 1);
    files.set(r.file, lines.join('\n'));
  }
  const prod = need('product.json').split('\n').filter((l) => !unit.productRemove.some((k) => new RegExp(`^\\s*"${k}"\\s*:`).test(l)));
  files.set('product.json', prod.join('\n'));
  for (const s of parsePatch(readFileSync(join(UNIT_DIR, 'edits.patch'), 'utf8'))) files.set(s.path, applyHunks(need(s.path), s.hunks));
  for (const p of [VIEWS, SHARED, ...MAINS]) need(p);
  for (const [p, t] of files) put(p, t);
  for (const k of [...unit.kept.map((x) => x.path), ...MUST_STAY]) {
    const f = join(root, ...k.split('/'));
    if (existsSync(f)) continue;
    if (/\.[A-Za-z0-9]+$/.test(k)) put(k, 'x'); else mkdirSync(f, { recursive: true });
  }
  return root;
}
const edit = (root, rel, fn) => { const f = join(root, ...rel.split('/')); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
const W = 'src/vs/workbench/';

test('c3-check-worktree: 本家に removeLines・productRemove・edits.patch を当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c3-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c3wt-'));
  try {
    for (const p of [VIEWS, SHARED, ...MAINS, 'product.json']) { const f = join(root, ...p.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, upShow(p)); }
    const bad = checkWorktree(root, unit);
    for (const re of [/viewsExtensionPoint\.ts の const REMOTE .* 0 行/, /viewsExtensionPoint\.ts がまだ contrib\/remote\/ を import/, /sharedProcessMain\.ts にまだ remoteTunnel/,
      /workbench\.common\.main\.ts にまだ消した部品/, /workbench\.desktop\.main\.ts にまだ消した部品/, /product\.json にまだ serverGreeting/, /product\.json にまだ win32TunnelMutex/, /にまだ消すはずの行がある/, /残るはずのパスが無い/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['定数が無い', (r) => edit(r, VIEWS, (t) => t.replace(`${CONST_LINE}\n`, '')), /0 行/],
  ['定数が二重', (r) => edit(r, VIEWS, (t) => t.replace(`${CONST_LINE}\n`, `${CONST_LINE}\n${CONST_LINE}\n`)), /2 行/],
  ['viewsExtensionPoint.ts が元の import を持つ', (r) => edit(r, VIEWS, (t) => `import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';\n${t}`), /contrib\/remote\/ を import/],
  ['sharedProcessMain.ts に remoteTunnel が残る', (r) => edit(r, SHARED, (t) => t + "\nthis.server.registerChannel('remoteTunnel', x);\n"), /remoteTunnel の語/],
  ['workbench.common.main.ts に contrib/remote の import が残る', (r) => edit(r, `${W}workbench.common.main.ts`, (t) => t + "\nimport './contrib/remote/browser/remote.contribution.js';\n"), /workbench\.common\.main\.ts にまだ/],
  ['workbench.desktop.main.ts に remoteTunnel の import が残る', (r) => edit(r, `${W}workbench.desktop.main.ts`, (t) => t + "\nimport './contrib/remoteTunnel/electron-browser/remoteTunnel.contribution.js';\n"), /workbench\.desktop\.main\.ts にまだ/],
  ['workbench.web.main.ts に platform/remoteTunnel の import が残る', (r) => edit(r, `${W}workbench.web.main.ts`, (t) => t + "\nimport '../platform/remoteTunnel/browser/remoteTunnelService.js';\n"), /workbench\.web\.main\.ts にまだ/],
  ['product.json に server のキーが残る', (r) => edit(r, 'product.json', (t) => t.replace(/\{/, '{\n\t"serverGreeting": ["x"],')), /product\.json にまだ serverGreeting/],
  ['消えるはずの contrib/remote が残る', (r) => { const f = join(r, ...`${W}contrib/remote/browser/remoteExplorer.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: .*contrib\/remote/],
  ['消えるはずの gulpfile.reh.ts が残る', (r) => { const f = join(r, 'build', 'gulpfile.reh.ts'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: build\/gulpfile\.reh\.ts/],
  ['消えるはずの platform/remoteTunnel が残る', (r) => { const f = join(r, ...'src/vs/platform/remoteTunnel/common/remoteTunnel.ts'.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /platform\/remoteTunnel/],
  ['残るはずの services/tunnel が消える', (r) => rmSync(join(r, ...`${W}services/tunnel`.split('/')), { recursive: true, force: true }), /残るはずのパスが無い: .*services\/tunnel/],
  ['残るはずの sharedProcessTunnelService.ts が消える', (r) => rmSync(join(r, ...'src/vs/platform/remote/electron-browser/sharedProcessTunnelService.ts'.split('/'))), /残るはずのパスが無い: .*sharedProcessTunnelService\.ts/],
  ['残るはずの remoteExplorerService.ts が消える', (r) => rmSync(join(r, ...`${W}services/remote/common/remoteExplorerService.ts`.split('/'))), /残るはずのパスが無い: .*remoteExplorerService\.ts/],
  ['残るはずの mainThreadTunnelService.ts が消える', (r) => rmSync(join(r, ...`${W}api/browser/mainThreadTunnelService.ts`.split('/'))), /残るはずのパスが無い: .*mainThreadTunnelService\.ts/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c3-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c3-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c3-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, VIEWS, (t) => t.replace(`${CONST_LINE}\n`, ''));
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c3wt-nonexistent-dir')).status, 2);
});

test('c3-check-worktree: 空の木(本家が読めなくても動く)は「ファイルが無い」「残るはずのパスが無い」を出し、「消えているはずのパスが残っている」は出さない', () => {
  const root = mkdtempSync(join(tmpdir(), 'c3wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*viewsExtensionPoint\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(bad.some((x) => /product\.json が無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

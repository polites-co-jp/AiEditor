// tests/c2-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに unit.json の removeLines と edits.patch を
// 自前の小さな当て方(文脈が一致する所を探して置き換える)で当てた木を一時のフォルダに作り、
//   - 期待どおりの木は食い違いが無い(edits.patch の出力と、照らし役の期待が食い違っていないことの見張り)
//   - 壊した木(消し忘れ・消しすぎ・二重・足し忘れ)は食い違いが出る
// を確かめる。本家が読めなければ、手で作った最小の木だけで確かめる。
// Run: node --test tests/c2-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorktree, MUST_STAY, NEW_API } from './c2-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNIT_DIR = join(REPO, 'removals', 'C-2-debug');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unit = readJson(join(UNIT_DIR, 'unit.json'));
const UP_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };

// edits.patch を、ファイルごとのハンクに分ける
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

/** 本家のファイルに removeLines と edits.patch を当てた木を作る。delete したものは作らない。残すものは中身の無いファイルで置く。 */
function makeAppliedTree() {
  const root = mkdtempSync(join(tmpdir(), 'c2wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const files = new Map(); // path -> text
  const need = (p) => { if (!files.has(p)) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); } return files.get(p); };
  for (const r of unit.removeLines) {
    const t = need(r.file);
    const lines = t.split('\n');
    const i = lines.findIndex((l) => l.trim() === r.line.trim());
    assert.ok(i >= 0, `removeLines の行が無い: ${r.file}: ${r.line}`);
    lines.splice(i, 1);
    files.set(r.file, lines.join('\n'));
  }
  for (const s of parsePatch(readFileSync(join(UNIT_DIR, 'edits.patch'), 'utf8'))) {
    if (s.isNew) files.set(s.path, s.hunks.flat().filter((x) => x.k === '+').map((x) => x.t).join('\n') + '\n');
    else files.set(s.path, applyHunks(need(s.path), s.hunks));
  }
  for (const p of ['src/vs/workbench/workbench.desktop.main.ts', 'src/vs/workbench/workbench.web.main.ts']) need(p);
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

test('c2-check-worktree: 本家に removeLines と edits.patch を当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c2-check-worktree: C-4 を含む組 b の木(C-4 の delete の中のノートブックのファイルが無い)でも食い違いが無い。C-4 が当たっていない木では、同じファイルが無いのは食い違い', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try {
    const c4 = JSON.parse(readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'removals', 'C-4-notebook', 'unit.json'), 'utf8'));
    const gone = [`${W}contrib/notebook/browser/notebook.contribution.ts`, `${W}contrib/notebook/browser/controller/editActions.ts`, `${W}contrib/replNotebook/browser/repl.contribution.ts`];
    // 先に C-4 が当たっていない木の形(ファイルがあり C-2 の直しが入っている)から、C-4 が消した形にする
    for (const p of gone) assert.ok(existsSync(join(root, ...p.split('/'))), `前提: ${p} が木にある`);
    assert.ok(gone.every((p) => c4.delete.some((d) => p === d || p.startsWith(`${d}/`))), '前提: この3つは C-4 の delete の中');
    for (const d of c4.delete) rmSync(join(root, ...d.split('/')), { recursive: true, force: true });
    // C-4 のしるし(新しいファイル)が無い木では、無いのは食い違い
    const noMark = checkWorktree(root, unit);
    assert.ok(gone.every((p) => noMark.some((x) => x.includes(p.split('/').pop()))), JSON.stringify(noMark));
    const f = join(root, ...`${W}api/common/extHostRemovedApi.notebook.ts`.split('/'));
    mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x');
    assert.deepEqual(checkWorktree(root, unit), []);
    // C-4 のしるしがあっても、C-2 の期待(例: debug.service.contribution.ts)は見る
    rmSync(join(root, ...`${W}contrib/debug/browser/debug.service.contribution.ts`.split('/')));
    assert.ok(checkWorktree(root, unit).some((x) => /debug\.service\.contribution\.ts/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c2-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c2wt-'));
  try {
    const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
    for (const p of [`${W}api/common/extHost.protocol.ts`, `${W}api/common/extHost.api.impl.ts`, `${W}contrib/debug/browser/debug.service.contribution.ts`, `${W}workbench.common.main.ts`,
      `${W}workbench.desktop.main.ts`, `${W}workbench.web.main.ts`, `${W}contrib/notebook/browser/notebook.contribution.ts`, `${W}contrib/replNotebook/browser/repl.contribution.ts`,
      `${W}contrib/notebook/browser/controller/editActions.ts`, 'build/next/resources.ts', 'build/next/index.ts']) put(p, upShow(p));
    const bad = checkWorktree(root, unit);
    for (const re of [/createRemovedDebugApi/, /extHost\.protocol\.ts にまだ MainThreadDebugService/, /NullDebugService が無い/, /debug\.service\.contribution\.js の import が 0 行/,
      /notebook\.contribution\.ts にまだ/, /repl\.contribution\.ts にまだ list\.find\.replInputFocus/, /resources\.ts にまだ debug\/browser\/media/, /index\.ts にまだ debug\/node\/telemetryApp/, /にまだ消すはずの行がある/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['新しいファイルが無い', (r) => rmSync(join(r, ...NEW_API.split('/'))), /ファイルが無い: .*extHostRemovedApi\.debug\.ts/],
  ['新しいファイルに createRemovedDebugApi が無い', (r) => edit(r, NEW_API, (t) => t.replace('createRemovedDebugApi', 'createOther')), /createRemovedDebugApi が無い/],
  ['extHost.protocol.ts に Shape が残る', (r) => edit(r, `${W}api/common/extHost.protocol.ts`, (t) => t + '\nexport interface MainThreadDebugServiceShape {}\n'), /extHost\.protocol\.ts にまだ MainThreadDebugService/],
  ['extHost.protocol.ts に common の import が残る', (r) => edit(r, `${W}api/common/extHost.protocol.ts`, (t) => t + "\nimport { A } from '../../contrib/debug/common/debug.js';\n"), /contrib\/debug\/common/],
  ['extHost.api.impl.ts が元の IExtHostDebugService を使う', (r) => edit(r, `${W}api/common/extHost.api.impl.ts`, (t) => t + "\nimport { IExtHostDebugService } from './extHostDebugService.js';\n"), /IExtHostDebugService/],
  ['extHost.api.impl.ts が createRemovedDebugApi を呼ばない', (r) => edit(r, `${W}api/common/extHost.api.impl.ts`, (t) => t.replace('createRemovedDebugApi(extension)', '{}')), /createRemovedDebugApi\(extension\) を呼んでいない/],
  ['debug.service.contribution.ts が元の DebugService を登録', (r) => edit(r, `${W}contrib/debug/browser/debug.service.contribution.ts`, (t) => t.replace('registerSingleton(IDebugService, NullDebugService', "import { DebugService } from './debugService.js';\nregisterSingleton(IDebugService, DebugService")), /debugService\.js|DebugService を登録/],
  ['workbench.common.main.ts の足す import が無い', (r) => edit(r, `${W}workbench.common.main.ts`, (t) => t.replace("import './contrib/debug/browser/debug.service.contribution.js';\n", '')), /import が 0 行/],
  ['workbench.common.main.ts の足す import が二重', (r) => edit(r, `${W}workbench.common.main.ts`, (t) => t.replace("import './contrib/debug/browser/debug.service.contribution.js';\n", "import './contrib/debug/browser/debug.service.contribution.js';\nimport './contrib/debug/browser/debug.service.contribution.js';\n")), /import が 2 行/],
  ['workbench.common.main.ts に消した Debug の import が残る', (r) => edit(r, `${W}workbench.common.main.ts`, (t) => t + "\nimport './contrib/debug/browser/debugViewlet.js';\n"), /にまだ debug\/browser\/debugViewlet\.js'/],
  ['workbench.desktop.main.ts から extensionHostDebugService の import が消える', (r) => edit(r, `${W}workbench.desktop.main.ts`, (t) => t.replace(/^.*electron-browser\/extensionHostDebugService\.js.*\n/m, '')), /extensionHostDebugService\.js の import が消えている/],
  ['workbench.web.main.ts から extensionHostDebugService の import が消える', (r) => edit(r, `${W}workbench.web.main.ts`, (t) => t.replace(/^.*browser\/extensionHostDebugService\.js.*\n/m, '')), /extensionHostDebugService\.js の import が消えている/],
  ['notebook の設定の登録が残る', (r) => edit(r, `${W}contrib/notebook/browser/notebook.contribution.ts`, (t) => t + "\n[NotebookSetting.notebookInlineValues]: {},\n"), /notebook\.contribution\.ts にまだ notebookInlineValues/],
  ['repl のキー割り当てが残る', (r) => edit(r, `${W}contrib/replNotebook/browser/repl.contribution.ts`, (t) => t + "\nid: 'list.find.replInputFocus'\n"), /list\.find\.replInputFocus/],
  ['build の一覧に media が残る', (r) => edit(r, 'build/next/resources.ts', (t) => t + "\n'vs/workbench/contrib/debug/browser/media/*.png',\n"), /debug\/browser\/media/],
  ['消えるはずの変数のビューを開く操作が残る', (r) => { const f = join(r, ...`${W}contrib/notebook/browser/controller/variablesActions.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: .*variablesActions\.ts/],
  ['残るはずの extensionHostDebugService が消える', (r) => rmSync(join(r, ...`${W}contrib/debug/electron-browser/extensionHostDebugService.ts`.split('/'))), /残るはずのパスが無い: .*electron-browser\/extensionHostDebugService\.ts/],
  ['残るはずの callStackWidget が消える', (r) => rmSync(join(r, ...`${W}contrib/debug/browser/callStackWidget.ts`.split('/'))), /残るはずのパスが無い: .*callStackWidget\.ts/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c2-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c2-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c2-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, `${W}workbench.common.main.ts`, (t) => t.replace("import './contrib/debug/browser/debug.service.contribution.js';\n", ''));
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c2wt-nonexistent-dir')).status, 2);
});

test('c2-check-worktree: 手で作った最小の木(本家が読めなくても動く)で、空の木は「ファイルが無い」「残るはずのパスが無い」を出す', () => {
  const root = mkdtempSync(join(tmpdir(), 'c2wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*extHostRemovedApi\.debug\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// tests/c5-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに、前の単位（組 a は A・B と C-1、組 b はそれに C-2〜C-4）の
// removeLines と edits.patch、続けて C-5 の removeLines と edits.patch を、自前の小さな当て方で順に当てた木を一時のフォルダに作り、
// 期待どおり・壊した木を照らす(C-5 が触るファイルと CLI の道の cliProcessMain.ts だけを追う)。当たらないハンクがあれば、そのこと自体が失敗になる。
// Run: node --test tests/c5-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorktree, EXT_CONTRIB, EXT_CONTRIB_ELECTRON, GALLERY_COMMON, MANIFEST, MUST_STAY, NOOP_GALLERY, NULL_RECS, QUICK, SHARED, VIEWLET } from './c5-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unit = readJson(join(REPO, 'removals', 'C-5-extension-gallery', 'unit.json'));
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const CLI = 'src/vs/code/node/cliProcessMain.ts';

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
function applyHunks(content, hunks, label) {
  const lines = content.split('\n');
  let from = 0;
  for (const h of hunks) {
    const oldL = h.filter((x) => x.k !== '+').map((x) => x.t);
    const newL = h.filter((x) => x.k !== '-').map((x) => x.t);
    let at = -1;
    for (let i = from; i <= lines.length - oldL.length; i++) if (oldL.every((t, j) => lines[i + j] === t)) { at = i; break; }
    assert.ok(at >= 0, `ハンクが当たらない(${label}): ${oldL[0]}`);
    lines.splice(at, oldL.length, ...newL);
    from = at + newL.length;
  }
  return lines.join('\n');
}

const loadUnit = (id) => {
  const dir = join(REPO, 'removals', id);
  const u = readJson(join(dir, 'unit.json'));
  const pf = u.patch ? join(dir, u.patch) : null;
  return { id, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] };
};
const allIds = () => readdirSync(join(REPO, 'removals'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(REPO, 'removals', d.name, 'unit.json'))).map((d) => d.name);
const chain = (full) => {
  const want = (id) => /^[AB]-/.test(id) || id === 'C-1-ai' || id === 'C-5-extension-gallery' || (full && ['C-2-debug', 'C-3-remote', 'C-4-notebook'].includes(id));
  return allIds().filter(want).map(loadUnit).sort((a, b) => a.unit.order - b.unit.order);
};

/** 本家のファイルに、前の単位と C-5 の removeLines・edits.patch を順に当てた木を作る(C-5 が触るファイルだけ追う)。 */
function makeAppliedTree({ full = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c5wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const c5 = loadUnit('C-5-extension-gallery');
  const tracked = new Set([...c5.sections.map((s) => s.path), ...(c5.unit.removeLines ?? []).map((r) => r.file), CLI, `${'src/vs/workbench/'}workbench.common.main.ts`, `${'src/vs/workbench/'}workbench.desktop.main.ts`]);
  const files = new Map();
  for (const p of tracked) { if (!c5.sections.find((s) => s.path === p && s.isNew)) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); } }
  for (const u of chain(full)) {
    for (const r of u.unit.removeLines ?? []) {
      if (!files.has(r.file)) continue;
      const lines = files.get(r.file).split('\n');
      const i = lines.findIndex((l) => l.trim() === r.line.trim());
      if (i >= 0) { lines.splice(i, 1); files.set(r.file, lines.join('\n')); } else assert.ok(u.id !== 'C-5-extension-gallery', `C-5 の removeLines の行が無い: ${r.file}: ${r.line}`);
    }
    for (const s of u.sections) {
      if (s.isNew) { if (tracked.has(s.path)) files.set(s.path, s.hunks.flat().filter((x) => x.k === '+').map((x) => x.t).join('\n') + '\n'); continue; }
      if (!files.has(s.path)) continue;
      files.set(s.path, applyHunks(files.get(s.path), s.hunks, `${u.id} ${s.path}`));
    }
  }
  for (const [p, t] of files) put(p, t);
  for (const k of [...c5.unit.kept.map((x) => x.path), ...MUST_STAY]) {
    const f = join(root, ...k.split('/'));
    if (existsSync(f)) continue;
    if (/\.[A-Za-z0-9]+$/.test(k)) put(k, 'x'); else mkdirSync(f, { recursive: true });
  }
  return root;
}
const edit = (root, rel, fn) => { const f = join(root, ...rel.split('/')); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
const W = 'src/vs/workbench/';

for (const full of [false, true]) {
  test(`c5-check-worktree: 本家に前の単位(組 ${full ? 'b' : 'a'})と C-5 の removeLines・edits.patch を順に当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)`, { skip: skipUp }, () => {
    const root = makeAppliedTree({ full });
    try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c5-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c5wt-'));
  try {
    for (const p of [GALLERY_COMMON, MANIFEST, EXT_CONTRIB, EXT_CONTRIB_ELECTRON, VIEWLET, QUICK, SHARED, `${W}workbench.common.main.ts`, `${W}workbench.desktop.main.ts`]) {
      const f = join(root, ...p.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, upShow(p));
    }
    const bad = checkWorktree(root, unit);
    for (const re of [/AbstractExtensionGalleryService/, /NoopExtensionGalleryService を登録していない/, /IExtensionGalleryAccountService/, /Null.*で登録していない/, /MenuId\.ExplorerContext/, /ResourceContextKey/,
      /ext install/, /DragAndDropObserver/, /InstallExtensionQuickAccessProvider/, /registerChannel\('extensionRecommendationNotification'/, /ExtensionTipsService/, /にまだ消すはずの行がある/, /残るはずのパスが無い/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['ギャラリーの新しいファイルが無い', (r) => rmSync(join(r, ...NOOP_GALLERY.split('/'))), /ファイルが無い: .*noopExtensionGalleryService\.ts/],
  ['おすすめの新しいファイルに Null が欠ける', (r) => edit(r, NULL_RECS, (t) => t.replace('NullExtensionIgnoredRecommendationsService', 'Other')), /NullExtensionIgnoredRecommendationsService が無い/],
  ['ワークベンチのギャラリーが元の基底に戻る', (r) => edit(r, GALLERY_COMMON, (t) => t + '\nexport class WorkbenchExtensionGalleryService extends AbstractExtensionGalleryService {}\n'), /AbstractExtensionGalleryService/],
  ['ワークベンチのギャラリーの登録が無い', (r) => edit(r, GALLERY_COMMON, (t) => t.replace(/registerSingleton\(IExtensionGalleryService, NoopExtensionGalleryService[^\n]*\n/, '')), /NoopExtensionGalleryService を登録していない/],
  ['マニフェストのサービスにアカウントが残る', (r) => edit(r, MANIFEST, (t) => t + '\n@IExtensionGalleryAccountService private readonly a: any,\n'), /IExtensionGalleryAccountService/],
  ['マニフェストのサービスの登録が消える(共有プロセスが待ち続ける)', (r) => edit(r, MANIFEST, (t) => t.replace(/registerSingleton\(IExtensionGalleryManifestService[^\n]*\n/, '')), /マニフェストのサービスを登録していない/],
  ['マニフェストのサービスが共有プロセスへ送らない', (r) => edit(r, MANIFEST, (t) => t.split("getChannel('extensionGalleryManifest')").join("getChannel('other')")), /共有プロセスのチャンネル/],
  ['おすすめの登録が Null でない', (r) => edit(r, EXT_CONTRIB, (t) => t.replace('NullExtensionRecommendationsService, InstantiationType', 'ExtensionRecommendationsService, InstantiationType')), /IExtensionRecommendationsService を NullExtensionRecommendationsService で登録していない/],
  ['右クリックのメニューが残る', (r) => edit(r, EXT_CONTRIB, (t) => t + '\nmenu: [{ id: MenuId.ExplorerContext }],\n'), /MenuId\.ExplorerContext/],
  ['「VSIX からインストール」の登録が残る', (r) => edit(r, EXT_CONTRIB, (t) => t + '\nid: SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID,\n'), /SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID/],
  ['installFromVSIX の登録が消える', (r) => edit(r, EXT_CONTRIB, (t) => t.split('id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,').join('id: OTHER,')), /installFromVSIX の登録/],
  ['ギャラリーのコマンドが残る', (r) => edit(r, EXT_CONTRIB, (t) => t + "\nid: 'workbench.extensions.action.showPopularExtensions',\n"), /コマンド workbench\.extensions\.action\.showPopularExtensions/],
  ['ext install の登録が残る', (r) => edit(r, EXT_CONTRIB, (t) => t + "\nprefix: 'ext install ',\nInstallExtensionQuickAccessProvider\n"), /InstallExtensionQuickAccessProvider/],
  ['拡張のビューにドロップが残る', (r) => edit(r, VIEWLET, (t) => t + '\nnew DragAndDropObserver(this.root, {});\n'), /DragAndDropObserver/],
  ['拡張のビューに marketplace のビューが残る', (r) => edit(r, VIEWLET, (t) => t + "\n'workbench.views.extensions.marketplace'\n"), /workbench\.views\.extensions\.marketplace/],
  ['Quick Access の `ext ` が消える', (r) => edit(r, QUICK, (t) => t.replace('export class ManageExtensionsQuickAccessProvider', 'export class Other')), /ManageExtensionsQuickAccessProvider が無い/],
  ['Quick Access に ext install が残る', (r) => edit(r, QUICK, (t) => t + "\nstatic PREFIX = 'ext install ';\nexport class InstallExtensionQuickAccessProvider {}\n"), /InstallExtensionQuickAccessProvider/],
  ['tips の通知のチャンネルの登録が残る', (r) => edit(r, EXT_CONTRIB_ELECTRON, (t) => t + "\nsharedProcessService.registerChannel('extensionRecommendationNotification', x);\n"), /registerChannel\('extensionRecommendationNotification'/],
  ['sharedProcessMain.ts に tips が残る', (r) => edit(r, SHARED, (t) => t + '\nconst c = new ExtensionTipsChannel(x);\n'), /ExtensionTipsChannel/],
  ['sharedProcessMain.ts から拡張の管理のチャンネルが消える', (r) => edit(r, SHARED, (t) => t.split('ExtensionManagementChannel').join('Other')), /拡張の管理のチャンネル/],
  ['main に消した部品の import が残る', (r) => edit(r, `${W}workbench.desktop.main.ts`, (t) => t + "\nimport './services/extensionManagement/electron-browser/extensionGalleryAccountService.js';\n"), /extensionGalleryAccountService/],
  ['消えるはずのおすすめのサービスが残る', (r) => { const f = join(r, ...`${W}contrib/extensions/browser/extensionRecommendationsService.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: .*extensionRecommendationsService\.ts/],
  ['消えるはずの platform の tips が残る', (r) => { const f = join(r, ...'src/vs/platform/extensionManagement/node/extensionTipsService.ts'.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /extensionTipsService\.ts/],
  ['残るはずの platform のギャラリーの基底が消える', (r) => rmSync(join(r, ...'src/vs/platform/extensionManagement/common/extensionGalleryService.ts'.split('/'))), /残るはずのパスが無い: .*platform\/extensionManagement\/common\/extensionGalleryService\.ts/],
  ['残るはずの extensionRecommendations.ts が消える', (r) => rmSync(join(r, ...`${W}services/extensionRecommendations/common/extensionRecommendations.ts`.split('/'))), /残るはずのパスが無い: .*extensionRecommendations\.ts/],
  ['CLI の道が変わる(cliProcessMain.ts がワークベンチのサービスを使う)', (r) => edit(r, CLI, (t) => t + "\nimport { X } from '../../workbench/services/extensionManagement/common/noopExtensionGalleryService.js';\n"), /cliProcessMain\.ts にまだ/],
  ['CLI の道が変わる(cliProcessMain.ts が ExtensionGalleryServiceWithNoStorageService を使わない)', (r) => edit(r, CLI, (t) => t.split('ExtensionGalleryServiceWithNoStorageService').join('Other')), /CLI の道が変わった/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c5-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c5-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c5-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, VIEWLET, (t) => t + '\nnew DragAndDropObserver(this.root, {});\n');
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c5wt-nonexistent-dir')).status, 2);
});

test('c5-check-worktree: 空の木(本家が読めなくても動く)は「ファイルが無い」「残るはずのパスが無い」を出し、「消えているはずのパスが残っている」は出さない', () => {
  const root = mkdtempSync(join(tmpdir(), 'c5wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*extensions\.contribution\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// tests/c4-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに、前の単位（組 a は A・B と C-1・C-2、組 b はそれに C-3）の
// removeLines と edits.patch、続けて C-4 の removeLines と edits.patch を、自前の小さな当て方で順に当てた木を一時のフォルダに作り、
// 期待どおり・壊した木を照らす(C-4 が触るファイルだけを追う)。当たらないハンクがあれば、そのこと自体が失敗になる。
// Run: node --test tests/c4-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_IMPL, checkWorktree, FOLDER_MATCH, MUST_STAY, NEW_API, PROTOCOL, SEARCH_CONTRIBUTION } from './c4-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const unit = readJson(join(REPO, 'removals', 'C-4-notebook', 'unit.json'));
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

// 当てる単位(order の順)。a: A・B と C-1・C-2・C-4。b: それに C-3
const loadUnit = (id) => {
  const dir = join(REPO, 'removals', id);
  const u = readJson(join(dir, 'unit.json'));
  const pf = u.patch ? join(dir, u.patch) : null;
  return { id, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] };
};
const allIds = () => readdirSync(join(REPO, 'removals'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(REPO, 'removals', d.name, 'unit.json'))).map((d) => d.name);
const chain = (withC3) => {
  const want = (id) => /^[AB]-/.test(id) || ['C-1-ai', 'C-2-debug', 'C-4-notebook'].includes(id) || (withC3 && id === 'C-3-remote');
  return allIds().filter(want).map(loadUnit).sort((a, b) => a.unit.order - b.unit.order);
};

/** 本家のファイルに、前の単位と C-4 の removeLines・edits.patch を順に当てた木を作る(C-4 が触るファイルだけ追う)。 */
function makeAppliedTree({ withC3 = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c4wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const c4 = loadUnit('C-4-notebook');
  const tracked = new Set([...c4.sections.map((s) => s.path), ...(c4.unit.removeLines ?? []).map((r) => r.file)]);
  const files = new Map();
  for (const p of tracked) { if (!c4.sections.find((s) => s.path === p && s.isNew)) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); } }
  for (const u of chain(withC3)) {
    for (const r of u.unit.removeLines ?? []) {
      if (!files.has(r.file)) continue;
      const lines = files.get(r.file).split('\n');
      const i = lines.findIndex((l) => l.trim() === r.line.trim());
      if (i >= 0) { lines.splice(i, 1); files.set(r.file, lines.join('\n')); } else assert.ok(u.id !== 'C-4-notebook', `C-4 の removeLines の行が無い: ${r.file}: ${r.line}`);
    }
    for (const s of u.sections) {
      if (s.isNew) { if (tracked.has(s.path)) files.set(s.path, s.hunks.flat().filter((x) => x.k === '+').map((x) => x.t).join('\n') + '\n'); continue; }
      if (!files.has(s.path)) continue;
      files.set(s.path, applyHunks(files.get(s.path), s.hunks, `${u.id} ${s.path}`));
    }
  }
  for (const [p, t] of files) put(p, t);
  // search.contribution.ts は C-4 の edits.patch で登録を消すので、tracked に入っている。search の他のファイルは中身を問わない
  for (const k of [...c4.unit.kept.map((x) => x.path), ...MUST_STAY]) {
    const f = join(root, ...k.split('/'));
    if (existsSync(f)) continue;
    if (/\.[A-Za-z0-9]+$/.test(k)) put(k, 'x'); else mkdirSync(f, { recursive: true });
  }
  return root;
}
const edit = (root, rel, fn) => { const f = join(root, ...rel.split('/')); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
const W = 'src/vs/workbench/';

for (const withC3 of [false, true]) {
  test(`c4-check-worktree: 本家に前の単位(組 ${withC3 ? 'b' : 'a'})と C-4 の removeLines・edits.patch を順に当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)`, { skip: skipUp }, () => {
    const root = makeAppliedTree({ withC3 });
    try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c4-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c4wt-'));
  try {
    for (const p of [PROTOCOL, API_IMPL, FOLDER_MATCH, SEARCH_CONTRIBUTION, `${W}contrib/search/browser/searchTreeModel/searchModel.ts`, `${W}contrib/search/browser/searchView.ts`,
      `${W}contrib/search/browser/replaceService.ts`, `${W}contrib/bulkEdit/browser/bulkCellEdits.ts`, `${W}contrib/search/browser/searchTreeModel/searchResult.ts`]) {
      const f = join(root, ...p.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, upShow(p));
    }
    const bad = checkWorktree(root, unit);
    for (const re of [/createRemovedNotebookApi/, /extHost\.protocol\.ts にまだ Shape/, /extHost\.protocol\.ts にまだ proxy の ID/, /extHostNotebook・ExtHostNotebook/, /createRemovedNotebookApi が 0 回/,
      /folderMatch\.ts が FileMatchImpl を createInstance していない/, /folderMatch\.ts にまだ notebook の import/, /@INotebook の注入/, /closedNotebookRichContentResults/, /にまだ消すはずの行がある/, /残るはずのパスが無い/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['新しいファイルが無い', (r) => rmSync(join(r, ...NEW_API.split('/'))), /ファイルが無い: .*extHostRemovedApi\.notebook\.ts/],
  ['新しいファイルに createRemovedNotebookApi が無い', (r) => edit(r, NEW_API, (t) => t.replace('createRemovedNotebookApi', 'createOther')), /createRemovedNotebookApi が無い/],
  ['extHost.protocol.ts に Shape が残る', (r) => edit(r, PROTOCOL, (t) => t + '\nexport interface MainThreadNotebookShape extends IDisposable {}\n'), /にまだ Shape の宣言/],
  ['extHost.protocol.ts に proxy の ID が残る', (r) => edit(r, PROTOCOL, (t) => t + "\nMainThreadNotebook: createProxyIdentifier<MainThreadNotebookShape>('MainThreadNotebook'),\n"), /にまだ proxy の ID/],
  ['extHost.protocol.ts の NotebookCellDataDto が消える', (r) => edit(r, PROTOCOL, (t) => t.split('NotebookCellDataDto').join('Other')), /NotebookCellDataDto が無くなっている/],
  ['extHost.api.impl.ts に extHostNotebook が残る', (r) => edit(r, API_IMPL, (t) => t + '\nconst x = extHostNotebook;\n'), /extHostNotebook・ExtHostNotebook/],
  ['extHost.api.impl.ts が createRemovedNotebookApi を呼ばない', (r) => edit(r, API_IMPL, (t) => t.replace(/createRemovedNotebookApi\(extension\)/, '{}')), /createRemovedNotebookApi が 1 回/],
  ['folderMatch.ts が NotebookCompatibleFileMatch を使う', (r) => edit(r, FOLDER_MATCH, (t) => t.replace('createInstance(\n\t\t\t\tFileMatchImpl', 'createInstance(\n\t\t\t\tNotebookCompatibleFileMatch').replace(/createInstance\(\s*FileMatchImpl/g, 'createInstance(NotebookCompatibleFileMatch')), /FileMatchImpl を createInstance していない|NotebookCompatibleFileMatch がある/],
  ['folderMatch.ts に notebook の import が残る', (r) => edit(r, FOLDER_MATCH, (t) => "import { NotebookEditorWidget } from '../../../notebook/browser/notebookEditorWidget.js';\n" + t), /にまだ notebook の import/],
  ['searchModel.ts に @INotebookSearchService が残る', (r) => edit(r, `${W}contrib/search/browser/searchTreeModel/searchModel.ts`, (t) => t + '\n@INotebookSearchService private readonly s: any,\n'), /searchModel\.ts にまだ @INotebook/],
  ['searchView.ts に @INotebookService が残る', (r) => edit(r, `${W}contrib/search/browser/searchView.ts`, (t) => t + '\n@INotebookService private readonly s: any,\n'), /searchView\.ts にまだ @INotebook/],
  ['replaceService.ts に注入が残る', (r) => edit(r, `${W}contrib/search/browser/replaceService.ts`, (t) => t + '\n@INotebookEditorModelResolverService private readonly s: any,\n'), /replaceService\.ts にまだ @INotebook/],
  ['bulkCellEdits.ts に注入が残る', (r) => edit(r, `${W}contrib/bulkEdit/browser/bulkCellEdits.ts`, (t) => t + '\n@INotebookEditorModelResolverService private readonly s: any,\n'), /bulkCellEdits\.ts にまだ @INotebook/],
  ['search.contribution.ts に設定が残る', (r) => edit(r, SEARCH_CONTRIBUTION, (t) => t + "\n'search.experimental.closedNotebookRichContentResults': {},\n"), /closedNotebookRichContentResults/],
  ['消えるはずの contrib/notebook/browser が残る', (r) => { const f = join(r, ...`${W}contrib/notebook/browser/notebookBrowser.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: .*contrib\/notebook\/browser/],
  ['消えるはずの contrib/outline が残る', (r) => { const f = join(r, ...`${W}contrib/outline/browser/outline.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /消えているはずのパスが残っている: .*contrib\/outline/],
  ['消えるはずの mainThreadNotebookDto.ts が残る', (r) => { const f = join(r, ...`${W}api/browser/mainThreadNotebookDto.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /mainThreadNotebookDto\.ts/],
  ['消えるはずの notebookSearch.ts が残る', (r) => { const f = join(r, ...`${W}contrib/search/common/notebookSearch.ts`.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, 'x'); }, /common\/notebookSearch\.ts/],
  ['残るはずの notebook/common が消える', (r) => rmSync(join(r, ...`${W}contrib/notebook/common`.split('/')), { recursive: true, force: true }), /残るはずのパスが無い: .*contrib\/notebook\/common/],
  ['残るはずの services/notebook が消える', (r) => rmSync(join(r, ...`${W}services/notebook`.split('/')), { recursive: true, force: true }), /残るはずのパスが無い: .*services\/notebook/],
  ['残るはずの searchNotebookHelpers.ts が消える', (r) => rmSync(join(r, ...`${W}contrib/search/common/searchNotebookHelpers.ts`.split('/'))), /searchNotebookHelpers\.ts/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c4-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c4-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c4-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, API_IMPL, (t) => t + '\nconst x = extHostNotebook;\n');
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c4wt-nonexistent-dir')).status, 2);
});

test('c4-check-worktree: 空の木(本家が読めなくても動く)は「ファイルが無い」「残るはずのパスが無い」を出し、「消えているはずのパスが残っている」は出さない', () => {
  const root = mkdtempSync(join(tmpdir(), 'c4wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*extHost\.protocol\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

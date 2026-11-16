// tests/c7-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに、前の単位（組 a は A・B と C-1・C-2・C-4、組 b はそれに C-3・C-5・C-6）の
// delete・removeLines・edits.patch、続けて C-7 の delete・removeLines・edits.patch を、自前の小さな当て方で順に当てた木を一時のフォルダに作り、
// 期待どおり・壊した木を照らす(C-7 が触るファイル、消したサービスの ID や語を持つ本家のファイル、枠のタブ・グループのファイルを追う)。当たらないハンクがあれば、そのこと自体が失敗になる。
// Run: node --test tests/c7-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUX, checkWorktree, COMMON_EDITOR, CUSTOM, GOTO, HEADER, MAIN_COMMON, MUST_STAY, REGISTERED_IDS, SINGLE, TITLE } from './c7-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const ME = 'C-7-breadcrumbs-outline';
const unit = readJson(join(REPO, 'removals', ME, 'unit.json'));
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upGrepFiles = (re) => (spawnSync('git', ['-C', UP_REPO, 'grep', '-l', '-E', '-e', re, UP_TAG, '--', 'src/vs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
const W = 'src/vs/workbench/';
const underAny = (list, p) => list.some((d) => { const dd = d.replace(/\/+$/, ''); return p === dd || p.startsWith(dd + '/'); });

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
  const want = (id) => /^[AB]-/.test(id) || ['C-1-ai', 'C-2-debug', 'C-4-notebook', ME].includes(id) || (full && ['C-3-remote', 'C-5-extension-gallery', 'C-6-settings-sync'].includes(id));
  return allIds().filter(want).map(loadUnit).sort((a, b) => a.unit.order - b.unit.order);
};

/** 本家のファイルに、前の単位と C-7 の delete・removeLines・edits.patch を順に当てた木を作る(追うファイルだけ)。 */
function makeAppliedTree({ full = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c7wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const me = loadUnit(ME);
  const consumers = upGrepFiles(`\\b(${REGISTERED_IDS.join('|')})\\b|showBreadcrumbs|notifyOutlineChanged|BreadcrumbsControlFactory|registerOutlineCreator`);
  const stay = MUST_STAY.filter((p) => /\.ts$/.test(p));
  const tracked = new Set([...me.sections.map((s) => s.path), ...(me.unit.removeLines ?? []).map((r) => r.file), MAIN_COMMON, ...consumers, ...stay]);
  const files = new Map();
  for (const p of tracked) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); }
  for (const u of chain(full)) {
    for (const d of u.unit.delete ?? []) for (const f of [...files.keys()]) if (underAny([d], f)) files.delete(f);
    for (const r of u.unit.removeLines ?? []) {
      if (!files.has(r.file)) continue;
      const lines = files.get(r.file).split('\n');
      const i = lines.findIndex((l) => l.trim() === r.line.trim());
      if (i >= 0) { lines.splice(i, 1); files.set(r.file, lines.join('\n')); } else assert.ok(u.id !== ME, `C-7 の removeLines の行が無い: ${r.file}: ${r.line}`);
    }
    for (const s of u.sections) {
      if (s.isNew || !files.has(s.path)) continue;
      files.set(s.path, applyHunks(files.get(s.path), s.hunks, `${u.id} ${s.path}`));
    }
  }
  for (const [p, t] of files) put(p, t);
  for (const k of [...me.unit.kept.map((x) => x.path), ...MUST_STAY]) {
    const f = join(root, ...k.split('/'));
    if (existsSync(f)) continue;
    if (/\.[A-Za-z0-9]+$/.test(k)) put(k, 'x'); else { mkdirSync(f, { recursive: true }); writeFileSync(join(f, 'keep.ts'), 'x'); }
  }
  return root;
}
const edit = (root, rel, fn) => { const f = join(root, ...rel.split('/')); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
const add = (root, rel, text) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };

for (const full of [false, true]) {
  test(`c7-check-worktree: 本家に前の単位(組 ${full ? 'b' : 'a'})と C-7 の delete・removeLines・edits.patch を順に当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)`, { skip: skipUp }, () => {
    const root = makeAppliedTree({ full });
    try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c7-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る(注入・語・枠・消すはずの行・消すはずのパス)', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c7wt-'));
  try {
    const paths = new Set([HEADER, TITLE, SINGLE, AUX, COMMON_EDITOR, GOTO, CUSTOM, MAIN_COMMON, `${W}services/outline/browser/outlineService.ts`, `${W}browser/parts/editor/breadcrumbs.ts`, ...upGrepFiles(`\\b(${REGISTERED_IDS.join('|')})\\b`)]);
    for (const p of paths) add(root, p, upShow(p));
    const bad = checkWorktree(root, unit);
    for (const re of [/に消したサービスの注入 @IOutlineService が残る/, /breadcrumbs の語/, /handleEditorsChange/, /showBreadcrumbs/, /provideWithoutTextEditor/, /にまだ消すはずの行がある/, /消えているはずのパスが残っている/, /残るはずのパスが無い/, /消した部品への import が残る/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['消すファイル(breadcrumbsControl.ts)が残る', (r) => add(r, `${W}browser/parts/editor/breadcrumbsControl.ts`, 'x'), /消えているはずのパスが残っている: .*breadcrumbsControl\.ts/],
  ['消すフォルダ(services/outline)が残る', (r) => add(r, `${W}services/outline/browser/outline.ts`, 'x'), /消えているはずのパスが残っている: .*services\/outline/],
  ['消すフォルダ(codeEditor/browser/outline)が残る', (r) => add(r, `${W}contrib/codeEditor/browser/outline/documentSymbolsOutline.ts`, 'x'), /消えているはずのパスが残っている: .*browser\/outline/],
  ['残すはずのパンくずの部品が消える', (r) => rmSync(join(r, 'src', 'vs', 'base', 'browser', 'ui', 'breadcrumbs'), { recursive: true }), /残るはずのパスが無い: .*ui\/breadcrumbs/],
  ['残すはずの記号の木が消える', (r) => rmSync(join(r, 'src', 'vs', 'editor', 'contrib', 'documentSymbols'), { recursive: true }), /残るはずのパスが無い: .*documentSymbols/],
  ['残すはずの差分エディタのパンくずが消える', (r) => rmSync(join(r, 'src', 'vs', 'editor', 'contrib', 'diffEditorBreadcrumbs'), { recursive: true }), /残るはずのパスが無い: .*diffEditorBreadcrumbs/],
  ['タブの枠(editorGroupView.ts)が消える', (r) => rmSync(join(r, ...`${W}browser/parts/editor/editorGroupView.ts`.split('/'))), /残るはずのパスが無い: .*editorGroupView\.ts/],
  ['タブの枠(multiEditorTabsControl.ts)が消える', (r) => rmSync(join(r, ...`${W}browser/parts/editor/multiEditorTabsControl.ts`.split('/'))), /残るはずのパスが無い: .*multiEditorTabsControl\.ts/],
  ['別の部品に注入が残る(型検査に掛からない)', (r) => add(r, `${W}contrib/foo/browser/foo.ts`, 'constructor(@IOutlineService private readonly o: IOutlineService) {}\n'), /foo\.ts に消したサービスの注入 @IOutlineService が残る/],
  ['別の部品に IBreadcrumbsService の注入が残る', (r) => add(r, `${W}contrib/foo/browser/foo2.ts`, 'constructor(@IBreadcrumbsService b: IBreadcrumbsService) {}\n'), /foo2\.ts に消したサービスの注入 @IBreadcrumbsService が残る/],
  ['別の部品が accessor.get で取る', (r) => add(r, `${W}contrib/foo/browser/bar.ts`, 'const s = accessor.get(IOutlineService);\n'), /bar\.ts に消したサービス IOutlineService を使う所が残る/],
  ['アウトラインの登録側が残る', (r) => add(r, `${W}contrib/foo/browser/creator.ts`, 'outlineService.registerOutlineCreator(this);\n'), /registerOutlineCreator/],
  ['枠のヘッダーにパンくずが残る', (r) => edit(r, HEADER, (t) => `${t}\nprivate breadcrumbsControl: unknown;\n`), /editorHeaderControl\.ts にまだ breadcrumbs の語/],
  ['枠のタイトルに handleEditorsChange が残る', (r) => edit(r, TITLE, (t) => `${t}\nthis.header.handleEditorsChange();\n`), /editorTitleControl\.ts にまだ handleEditorsChange/],
  ['1枚のタブの枠にパンくずの部品が残る', (r) => edit(r, SINGLE, (t) => `${t}\nprivate breadcrumbsControl: unknown;\n`), /singleEditorTabsControl\.ts にまだ breadcrumbsControl/],
  ['1枚のタブの枠から breadcrumbsInHeader が消える(残す)', (r) => edit(r, SINGLE, (t) => t.split('breadcrumbsInHeader').join('headerFlag')), /singleEditorTabsControl\.ts から breadcrumbsInHeader が消えている/],
  ['補助ウィンドウに showBreadcrumbs が残る', (r) => edit(r, AUX, (t) => `${t}\nshowBreadcrumbs: false,\n`), /auxiliaryEditorPart\.ts にまだ showBreadcrumbs/],
  ['共有の型に showBreadcrumbs が残る', (r) => edit(r, COMMON_EDITOR, (t) => `${t}\nreadonly showBreadcrumbs: boolean;\n`), /editor\.ts にまだ showBreadcrumbs/],
  ['記号へ移動に provideWithoutTextEditor が残る', (r) => edit(r, GOTO, (t) => `${t}\nprovideWithoutTextEditor() {}\n`), /gotoSymbolQuickAccess\.ts にまだ provideWithoutTextEditor/],
  ['記号へ移動から getSymbolPicks が消える', (r) => edit(r, GOTO, (t) => t.split('getSymbolPicks').join('other')), /gotoSymbolQuickAccess\.ts から getSymbolPicks が消えている/],
  ['記号へ移動の登録(workbench.action.gotoSymbol)が消える', (r) => edit(r, GOTO, (t) => t.split('workbench.action.gotoSymbol').join('workbench.action.other')), /から workbench\.action\.gotoSymbol が消えている/],
  ['カスタムエディタの記号の移動が消える', (r) => edit(r, CUSTOM, (t) => t.split('input.navigation = navigation').join('')), /から input\.navigation = navigation が消えている/],
  ['カスタムエディタに notifyOutlineChanged が残る', (r) => edit(r, CUSTOM, (t) => `${t}\nthis.notifyOutlineChanged();\n`), /notifyOutlineChanged/],
  ['消した部品への import が残る', (r) => add(r, `${W}contrib/foo/browser/baz.ts`, "import { BreadcrumbsControl } from '../../../browser/parts/editor/breadcrumbsControl.js';\n"), /baz\.ts に消した部品への import が残る/],
  ['main に消した部品の import が残る', (r) => edit(r, MAIN_COMMON, (t) => `${t}\nimport './services/outline/browser/outlineService.js';\n`), /workbench\.common\.main\.ts にまだ services\/outline\/|にまだ消すはずの行がある/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c7-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c7-check-worktree: 試験用の資料(*.perf-data.ts)とコメントの語は許す', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try {
    add(root, `${W}api/test/browser/extHostDocumentData.test.perf-data.ts`, '@IOutlineService showBreadcrumbs\n');
    add(root, `${W}contrib/foo/browser/note.ts`, '// IOutlineService was removed (see C-7)\n/* showBreadcrumbs */\n');
    assert.deepEqual(checkWorktree(root, unit), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c7-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c7-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, HEADER, (t) => `${t}\nprivate breadcrumbsControl: unknown;\n`);
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c7wt-nonexistent-dir')).status, 2);
});

test('c7-check-worktree: 空の木(本家が読めなくても動く)は「ファイルが無い」「残るはずのパスが無い」を出し、「消えているはずのパスが残っている」は出さない', () => {
  const root = mkdtempSync(join(tmpdir(), 'c7wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*editorHeaderControl\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

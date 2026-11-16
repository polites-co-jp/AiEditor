// C-4-notebook（ノートブック）の単位のファイルの静的な検査、何もしない実装の検査、検索の直しの検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節・4節（C-4 の行と末尾。検索はノートブックと結びついていて、検索は裁定で残す）・5.1（after の確かめ）・5.3・5.4・9節、
//       docs/user-decisions.md の 2026-11-15（C-4 の edits.patch を作るときに出た点）、removals/C-4-notebook/README.md。
// 行数・sha・パッチの並びには頼らない: edits.patch はファイルごとの区画に分け、新しいファイルの本文は「+ の行」から読む。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-4 に固有の分だけ。
// 何もしない実装は、文字列と構文のほかに、型を外した本文を node で走らせて振る舞いも確かめる(import は模擬。C-2 と同じ)。
// 検索の直しは、本家 1.146.0 のファイルに edits.patch の検索のハンクを自前で当てて確かめる(当たらないファイルは飛ばす)。
// Run: node --test tests/c4-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compareMemberGates, expectChecked, memberGatesOf } from './gate-members.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C4_UNIT_DIR: 単位のフォルダの代わり(tests/c4-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C4_UNIT_DIR ? resolve(process.env.AIED_C4_UNIT_DIR) : join(REPO, 'removals', 'C-4-notebook');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-4-notebook/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家を読む検査だけ飛ばす。
// AIED_C4_NO_UPSTREAM=1: 本家を読む検査を飛ばす(tests/c4-mutation.test.mjs が、本家を要さない壊し方を速く確かめるのに使う)
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = !process.env.AIED_C4_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const skipUpPatch = noPatch || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const upHas = (p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p.replace(/\/+$/, '')}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upGrep = (text, where) => spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-q', '-e', text, UP_TAG, '--', ...where]).status === 0;

const underAny = (list, p) => list.some((d) => {
  const dd = d.replace(/\/+$/, '');
  return p === dd || p.startsWith(dd + '/');
});

function parsePatch(text) {
  const sections = [];
  let cur = null;
  let hunk = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line === '-- ') break; // format-patch の署名の行
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], isNew: false, isDelete: false, hunks: [] }; sections.push(cur); hunk = null; continue; }
    if (!cur) continue;
    if (/^@@ /.test(line)) { hunk = []; cur.hunks.push(hunk); continue; }
    if (!hunk) {
      if (/^new file mode/.test(line)) cur.isNew = true;
      else if (/^deleted file mode/.test(line)) cur.isDelete = true;
      continue;
    }
    if (line.startsWith('+')) hunk.push({ k: '+', t: line.slice(1) });
    else if (line.startsWith('-')) hunk.push({ k: '-', t: line.slice(1) });
    else if (line.startsWith(' ')) hunk.push({ k: ' ', t: line.slice(1) });
  }
  for (const s of sections) {
    const all = s.hunks.flat();
    s.added = all.filter((x) => x.k === '+').map((x) => x.t);
    s.removed = all.filter((x) => x.k === '-').map((x) => x.t);
    s.old = all.filter((x) => x.k !== '+').map((x) => x.t);
  }
  return sections;
}
/** 文脈が一致する所を探して置き換える。当たらなければ null。 */
function applyHunks(content, hunks) {
  const lines = content.split('\n');
  let from = 0;
  for (const h of hunks) {
    const oldL = h.filter((x) => x.k !== '+').map((x) => x.t);
    const newL = h.filter((x) => x.k !== '-').map((x) => x.t);
    let at = -1;
    for (let i = from; i <= lines.length - oldL.length; i++) if (oldL.every((t, j) => lines[i + j] === t)) { at = i; break; }
    if (at < 0) return null;
    lines.splice(at, oldL.length, ...newL);
    from = at + newL.length;
  }
  return lines.join('\n');
}
const patchText = noPatch ? '' : readFileSync(patchFile, 'utf8').replace(/\r\n/g, '\n');
const sections = parsePatch(patchText);
const section = (suffix) => sections.find((s) => s.path.endsWith(suffix));
const body = (suffix) => (section(suffix)?.added ?? []).join('\n');

// ほかの単位(removals/ の C-4 以外)
const others = [];
for (const d of readdirSync(join(REPO, 'removals'), { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === 'C-4-notebook') continue;
  const uj = join(REPO, 'removals', d.name, 'unit.json');
  if (!existsSync(uj)) continue;
  const u = readJson(uj);
  const pf = u.patch ? join(REPO, 'removals', d.name, u.patch) : null;
  others.push({ id: u.id ?? d.name, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] });
}

const W = 'src/vs/workbench/';
const NEW_API = `${W}api/common/extHostRemovedApi.notebook.ts`;
const API_IMPL = `${W}api/common/extHost.api.impl.ts`;
const PROTOCOL = `${W}api/common/extHost.protocol.ts`;
const FILE_MATCH = `${W}contrib/search/browser/searchTreeModel/fileMatch.ts`;
const EDITED_FILES = [
  `${W}api/browser/mainThreadEditorTabs.ts`, API_IMPL, PROTOCOL, NEW_API, `${W}contrib/bulkEdit/browser/bulkCellEdits.ts`,
  `${W}contrib/search/browser/replaceService.ts`, `${W}contrib/search/browser/search.common.contribution.ts`, `${W}contrib/search/browser/search.contribution.ts`,
  `${W}contrib/search/browser/searchActionsRemoveReplace.ts`, `${W}contrib/search/browser/searchCompare.ts`, `${W}contrib/search/browser/searchFindInput.ts`,
  FILE_MATCH, `${W}contrib/search/browser/searchTreeModel/folderMatch.ts`, `${W}contrib/search/browser/searchTreeModel/searchModel.ts`,
  `${W}contrib/search/browser/searchTreeModel/searchResult.ts`, `${W}contrib/search/browser/searchTreeModel/searchTreeCommon.ts`,
  `${W}contrib/search/browser/searchTreeModel/textSearchHeading.ts`, `${W}contrib/search/browser/searchView.ts`, `${W}contrib/search/browser/searchWidget.ts`,
  `${W}contrib/search/test/browser/searchActions.test.ts`, `${W}contrib/search/test/browser/searchModel.test.ts`, `${W}contrib/search/test/browser/searchResult.test.ts`,
  `${W}contrib/search/test/browser/searchTestCommon.ts`, `${W}contrib/search/test/browser/searchViewlet.test.ts`, `${W}contrib/searchEditor/browser/searchEditorSerialization.ts`,
];
const isSearchCode = (p) => /contrib\/(search|searchEditor)\/browser\//.test(p);
const isSearchTest = (p) => /contrib\/search\/test\//.test(p);

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-4: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-4: edits.patch の件名が [PATCH] unit C-4-notebook: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-4-notebook: edits$/m);
});

test('C-4: edits.patch の作者が shuko-apply <apply@shuko.invalid>（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: shuko-apply <apply@shuko\.invalid>$/m);
});

test('C-4: unit.json の id・stage・after（A-4・B-4・C-1・C-2。C-3 は前提にしない）。order は前提にした単位より後', { skip: noUnit }, () => {
  assert.equal(unit.id, 'C-4-notebook');
  assert.equal(unit.stage, 'C');
  assert.deepEqual([...unit.after].sort(), ['A-4-notebook-extensions', 'B-4-outline-view', 'C-1-ai', 'C-2-debug']);
  assert.ok(!unit.after.includes('C-3-remote'), 'C-3 を前提にしている（C-4 は C-3 なしでも当たる）');
  for (const id of unit.after) {
    const o = others.find((x) => x.id === id);
    assert.ok(o, `after の単位 ${id} の unit.json が無い`);
    assert.ok(o.unit.order < unit.order, `after の ${id} の order(${o.unit.order}) が C-4 の ${unit.order} より後`);
  }
});

test('C-4: after の確かめ(5.1): --only から A-4・B-4・C-1・C-2 のどれを外しても計画が誤りを返す。全部あれば通る。C-3 は無くても、あっても通る', { skip: noUnit }, async () => {
  const { planUnits } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'apply', 'units.mjs')).href);
  const all = [...others.map((o) => o.unit), unit];
  const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions', 'A-5-remote-extensions', 'A-6-themes',
    'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share', 'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
  const A = [...BASE, 'C-1-ai', 'C-2-debug', 'C-4-notebook'];
  const ok = planUnits(all, { only: A });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.plan.map((u) => u.id).slice(-3), ['C-1-ai', 'C-2-debug', 'C-4-notebook']);
  const withC3 = planUnits(all, { only: [...A, 'C-3-remote'] });
  assert.deepEqual(withC3.errors, []);
  assert.deepEqual(withC3.plan.map((u) => u.id).slice(-4), ['C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook']);
  for (const drop of ['A-4-notebook-extensions', 'B-4-outline-view', 'C-1-ai', 'C-2-debug']) {
    const r = planUnits(all, { only: A.filter((x) => x !== drop) });
    assert.ok(r.errors.some((e) => new RegExp(`C-4-notebook: after の単位 ${drop} が先に当たらない`).test(e)), `${drop} を外しても止まらない: ${JSON.stringify(r.errors)}`);
  }
});

test('C-4: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い。delete に重複が無い', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
  const clash = [];
  for (const k of unit.kept ?? []) {
    const kp = k.path.replace(/\/+$/, '');
    for (const d of del) {
      if (d === kp) clash.push(`同じ: ${kp}`);
      else if (kp.startsWith(d + '/')) clash.push(`kept ${kp} が delete ${d} の中`);
      else if (d.startsWith(kp + '/')) clash.push(`delete ${d} が kept ${kp} の中`);
    }
  }
  assert.deepEqual(clash, []);
});

test('C-4: kept に contrib/notebook/common・services/notebook ほかの残す部品がある（理由つき）。delete に mainThreadNotebookDto.ts・notebookSearch.ts・cellSearchModel.ts がある', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  for (const p of [`${W}contrib/notebook/common`, `${W}services/notebook`, `${W}api/common/extHostTypes/notebooks.ts`, `${W}contrib/search/common/searchNotebookHelpers.ts`,
    `${W}contrib/notebook/common/services/notebookWebWorkerMain.ts`]) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
  const del = unit.delete ?? [];
  for (const p of [`${W}api/browser/mainThreadNotebookDto.ts`, `${W}contrib/search/common/notebookSearch.ts`, `${W}contrib/search/common/cellSearchModel.ts`,
    `${W}contrib/notebook/browser`, `${W}contrib/interactive`, `${W}contrib/replNotebook`, `${W}contrib/outline`]) assert.ok(del.includes(p), `delete に ${p} が無い`);
  // 残す common の中身を delete していない(notebook/browser の外にある common は、kept の下)
  assert.deepEqual(del.filter((d) => underAny([`${W}contrib/notebook/common`, `${W}services/notebook`], d)), []);
});

test('C-4: delete したパスが本家 1.146.0 にある。kept のパスも本家にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-4: delete が、ほかの単位の delete と重なるのは after に挙げた単位とだけ（先に消えて「本家に無い」警告になるか、中身の一部を先に消すもの）', { skip: noUnit }, () => {
  const bad = [];
  for (const o of others) {
    if (unit.after.includes(o.id)) continue;
    const od = (o.unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
    for (const d of (unit.delete ?? []).map((x) => x.replace(/\/+$/, ''))) {
      for (const x of od) if (d === x || d.startsWith(x + '/') || x.startsWith(d + '/')) bad.push(`${o.id}: ${x} と ${d}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('C-4: removeLines の中に重複が無い。file が delete の中ではない。common 3・extensionHost.contribution 6・extHost.protocol 13 の22行', { skip: noUnit }, () => {
  const rl = unit.removeLines ?? [];
  const keys = rl.map((r) => `${r.file}\n${r.line.trim()}`);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  assert.deepEqual(rl.filter((r) => underAny(unit.delete ?? [], r.file)).map((r) => `${r.file}: ${r.line}`), []);
  const count = (re) => rl.filter((r) => re.test(r.file)).length;
  assert.equal(count(/workbench\.common\.main\.ts$/), 3);
  assert.equal(count(/extensionHost\.contribution\.ts$/), 6);
  assert.equal(count(/extHost\.protocol\.ts$/), 13);
  assert.equal(rl.length, 22);
  assert.ok(rl.every((r) => r.file.endsWith('workbench.common.main.ts') || !/(workbench|sessions)\.[\w.-]*main\.ts$/.test(r.file)), 'common 以外の main に触れている');
});

test('C-4: removeLines の各行が、delete したファイルの import か、Shape を edits.patch が消す proxy の ID の行である', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const bad = [];
  const removedShapes = new Set((section(PROTOCOL)?.removed ?? []).map((l) => /^export interface (\w+)/.exec(l.trim())?.[1]).filter(Boolean));
  for (const r of unit.removeLines ?? []) {
    const t = r.line.trim();
    const where = `${r.file}: ${t}`;
    const imp = /^(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(t);
    if (imp) {
      if (!imp[1].startsWith('.')) { bad.push(`${where} (相対でない import)`); continue; }
      const target = posix.normalize(posix.join(posix.dirname(r.file), imp[1])).replace(/\.js$/, '.ts');
      if (!underAny(del, target)) bad.push(`${where} (${target} は delete に無い)`);
      continue;
    }
    const proxy = /^(\w+): createProxyIdentifier<(\w+)>\('(\w+)'\),$/.exec(t);
    if (proxy) {
      if (!removedShapes.has(proxy[2])) bad.push(`${where} (${proxy[2]} を edits.patch が消していない。ID だけ消すと Shape が宙に浮く)`);
      continue;
    }
    bad.push(`${where} (import でも proxy の ID でもない)`);
  }
  assert.deepEqual(bad, []);
});

test('C-4: removeLines の行が本家 1.146.0 のそのファイルにある（行の書き換えに気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const r of unit.removeLines ?? []) {
    const src = upShow(r.file);
    if (src === null) { bad.push(`${r.file} が本家に無い`); continue; }
    if (!src.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file}: ${r.line}`);
  }
  assert.deepEqual(bad, []);
});

test('C-4: removeLines が、ほかの単位の removeLines と同じ行を二重に消さない。ほかの単位の edits.patch が消す行とも重ならない', { skip: noUnit }, () => {
  const bad = [];
  const mine = (unit.removeLines ?? []).map((r) => ({ f: r.file, l: r.line.trim() }));
  for (const o of others) {
    for (const r of o.unit.removeLines ?? []) if (mine.some((m) => m.f === r.file && m.l === r.line.trim())) bad.push(`${o.id} の removeLines と同じ: ${r.file}: ${r.line.trim().slice(0, 80)}`);
    for (const s of o.sections) for (const l of s.removed) if (l.trim() && mine.some((m) => m.f === s.path && m.l === l.trim())) bad.push(`${o.id} の edits.patch が消す行と同じ: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-4: edits.patch と removeLines が同じ行を二重に消さない（消す所がどちらかに決まっている）', { skip: noPatch }, () => {
  const dup = [];
  for (const s of sections) {
    const mine = (unit.removeLines ?? []).filter((r) => r.file === s.path).map((r) => r.line.trim());
    for (const l of s.removed) if (l.trim() && mine.includes(l.trim())) dup.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(dup, []);
});

test('C-4: productRemove は空。patch の指定のほかに、他の単位が持つキーを足していない', { skip: noUnit }, () => {
  assert.deepEqual(unit.productRemove ?? [], []);
});

// --- edits.patch の形 ---
test('C-4: edits.patch が触るファイルは README の表の25ファイルだけ（新しいファイルは extHostRemovedApi.notebook.ts の1つ）。ファイルは消さない', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path).sort(), [...EDITED_FILES].sort());
  assert.deepEqual(sections.filter((s) => s.isNew).map((s) => s.path), [NEW_API]);
  assert.deepEqual(sections.filter((s) => s.isDelete).map((s) => s.path), []);
  assert.equal(sections.filter((s) => s.path === NEW_API).length, 1);
  assert.equal(section('extHostRemovedApi.notebook.ts').removed.length, 0);
});

test('C-4: edits.patch が main のファイル・extensionHost.contribution.ts・viewsExtensionPoint.ts(C-3)・sharedProcessMain.ts に触れない。delete したファイルも直さない（5.3）', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const bad = sections.filter((s) => !s.isNew && (/(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$|extensionHost\.contribution\.ts$|viewsExtensionPoint\.ts$|sharedProcessMain\.ts$/.test(s.path) || underAny(del, s.path))).map((s) => s.path);
  assert.deepEqual(bad, []);
});

test('C-4: edits.patch の extHost.protocol.ts のハンクに proxy の ID の行（createProxyIdentifier）が無い。削除は Shape の14個と import の整理だけ。DTO は残す', { skip: noPatch }, () => {
  const s = section('api/common/extHost.protocol.ts');
  assert.ok(s);
  assert.deepEqual(s.hunks.flat().filter((x) => /createProxyIdentifier/.test(x.t)), [], 'ID の行は removeLines に回す');
  assert.deepEqual(s.added, ["import { IWorkspaceSymbol } from '../../contrib/search/common/search.js';"], '足す行は import の整理の1行だけ');
  const shapes = s.removed.map((l) => /^export interface (\w+)/.exec(l.trim())?.[1]).filter(Boolean).sort();
  assert.deepEqual(shapes, ['ExtHostInteractiveShape', 'ExtHostNotebookDocumentSaveParticipantShape', 'ExtHostNotebookDocumentsAndEditorsShape', 'ExtHostNotebookDocumentsShape',
    'ExtHostNotebookEditorsShape', 'ExtHostNotebookKernelsShape', 'ExtHostNotebookRenderersShape', 'ExtHostNotebookShape', 'MainThreadInteractiveShape',
    'MainThreadNotebookDocumentsShape', 'MainThreadNotebookEditorsShape', 'MainThreadNotebookKernelsShape', 'MainThreadNotebookRenderersShape', 'MainThreadNotebookShape']);
  assert.ok(!s.removed.some((l) => /^export (interface|type) (INotebook\w*Dto\d*|NotebookCellDto|NotebookDataDto|VariablesResult|ICellExecute\w*Dto|INotebookDocumentsAndEditorsDelta|INotebookEditorAddData)\b/.test(l.trim())), 'DTO を消している（使い手が残る。判断を仰ぐ点の4）');
});

test('C-4: extHost.api.impl.ts の変更はノートブックの行だけ（消す行はすべてノートブック・対話ウィンドウの語を含むか記号だけ。足すのは import・languages.match・createRemovedNotebookApi の呼び出しと展開）', { skip: noPatch }, () => {
  const s = section('api/common/extHost.api.impl.ts');
  assert.ok(s);
  // 消す行の連なり(途切れない塊)ごとに見る: 塊の中のどこかにノートブック・対話ウィンドウの語があればよい(塊の中の `uri = ...` のような行は語を含まない)
  const stray = [];
  for (const h of s.hunks) {
    let run = [];
    const flush = () => { if (run.length && !run.some((l) => /[Nn]otebook|Interactive/.test(l))) stray.push(...run.filter((l) => l.trim() && !/^[\s{}();,]*$/.test(l))); run = []; };
    for (const x of h) { if (x.k === '-') run.push(x.t); else flush(); }
    flush();
  }
  assert.deepEqual(stray, [], 'ノートブックと関係の無い塊を消している');
  assert.deepEqual(s.added.filter((l) => !/removedNotebookApi|createRemovedNotebookApi|^\s*\/\/ Shuko \(C-4-notebook\)|import \{ score \}|return score\(interalSelector, document\.uri, document\.languageId, true, undefined, undefined\);|^\s*$/.test(l)), [], '想定外の行を足している');
  assert.equal(s.added.filter((l) => /createRemovedNotebookApi/.test(l)).length, 2, 'createRemovedNotebookApi は import と呼び出しの2回');
  assert.ok(s.added.some((l) => /\.\.\.removedNotebookApi\.window,/.test(l)));
  assert.ok(s.added.some((l) => /\.\.\.removedNotebookApi\.workspace,/.test(l)));
  assert.ok(s.added.some((l) => /const notebooks: typeof vscode\.notebooks = removedNotebookApi\.notebooks;/.test(l)));
  assert.ok(!s.added.some((l) => /extHostNotebook/.test(l)), '消した ExtHostNotebook を参照している');
});

test('C-4: 消す vscode.window・workspace・notebooks のノートブックのメンバー20個が、何もしない実装に全部ある（増やしも減らしもしない）', { skip: noPatch }, () => {
  const s = section('api/common/extHost.api.impl.ts');
  const old = new Set();
  // 消したメンバー: 3 タブの行 `get x()` / `x(` / `x:`、ただし const の宣言の中のものだけ(window・workspace・notebooks の消した塊)
  for (const h of s.hunks) {
    for (const x of h) {
      if (x.k !== '-') continue;
      const m = /^\t\t\t(?:get\s+|async\s+)?(\w+)\s*(?:[(:<]|=)/.exec(x.t);
      if (m && !['if', 'return', 'const', 'let', 'throw', 'else', 'for', 'while', 'await'].includes(m[1])) old.add(m[1]);
    }
  }
  const text = body('extHostRemovedApi.notebook.ts');
  const now = new Set([...text.matchAll(/^\t\t(?:get\s+)?(\w+)\s*[(:]/gm)].map((m) => m[1]).filter((n) => /otebook|Renderer|Kernel/i.test(n)));
  assert.equal(old.size, 20, `消したメンバーの数: ${[...old].join(',')}`);
  // 展開した名前空間のメンバー(window 7 + workspace 8 + notebooks 5)が、新しいファイルの本文に全部ある
  for (const n of old) assert.ok(new RegExp(`^\\t\\t(?:get\\s+)?${n}\\b`, 'm').test(text), `${n} が何もしない実装に無い`);
  assert.ok(now.size >= 20);
});

test('C-4: mainThreadEditorTabs.ts は対話ウィンドウのタブの分岐を消すだけ。bulkCellEdits.ts は ResourceNotebookCellEdit を残し、BulkCellEdits.apply() は誤りを投げる', { skip: noPatch }, () => {
  const t = section('api/browser/mainThreadEditorTabs.ts');
  assert.deepEqual(t.added, []);
  assert.ok(t.removed.some((l) => /InteractiveEditorInput/.test(l)));
  assert.ok(!t.removed.some((l) => /NotebookEditorInput/.test(l)), 'NotebookEditorInput のタブ(common に残る)を消している');
  const b = section('contrib/bulkEdit/browser/bulkCellEdits.ts');
  assert.ok(!b.removed.some((l) => /export class ResourceNotebookCellEdit/.test(l)));
  assert.ok(b.added.some((l) => /throw new Error\(`Notebooks are not available in this build/.test(l)));
  assert.ok(!b.added.some((l) => /@I[A-Z]\w+|resolve\(|applyEdits/.test(l)), '注入か実際の編集が残っている');
});

test('C-4: C-3 の edits.patch・ほかの単位の removeLines に触れない。C-4 の edits.patch が触るファイルのうち、after に挙げない単位と重なるものの文脈が重ならない（独立）', { skip: noPatch }, () => {
  const heavy = (l) => l.trim().length >= 24 && !/^(?:readonly\s+)?[\w$]+\??: [\w<>[\]|.,\s]+;$/.test(l.trim());
  const bad = [];
  for (const o of others) {
    if (unit.after.includes(o.id)) continue; // 前提にした単位とは、先に当たったものとして文脈を共有してよい
    for (const mine of sections) {
      if (mine.isNew) continue;
      const theirs = o.sections.find((x) => x.path === mine.path && !x.isNew);
      if (!theirs) continue;
      const tr = new Set(theirs.removed.filter(heavy).map((l) => l.trim()));
      const mr = new Set(mine.removed.filter(heavy).map((l) => l.trim()));
      for (const l of mine.old) if (heavy(l) && tr.has(l.trim())) bad.push(`${o.id} ${mine.path}: ${l.trim().slice(0, 80)}`);
      for (const l of theirs.old) if (heavy(l) && mr.has(l.trim())) bad.push(`${o.id} ${mine.path}: (逆) ${l.trim().slice(0, 80)}`);
    }
    for (const r of o.unit.removeLines ?? []) if (sections.some((s) => s.path === r.file && !s.isNew && s.old.some((l) => l.trim() === r.line.trim()))) bad.push(`${o.id} の removeLines の行が C-4 の文脈にある: ${r.line.trim().slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

// --- checks ---
test('C-4: checks の項目が、本家 1.146.0 にある（元から無いものを「無いこと」で守らない）。absentStrings は本家の kept でないファイルに当たる', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  const miss = [];
  for (const c of ck.absentCommands ?? []) if (!upGrep(c, ['src/vs'])) miss.push(`コマンド ${c}`);
  for (const v of ck.absentViews ?? []) if (!upGrep(v, ['src/vs'])) miss.push(`ビュー ${v}`);
  for (const s of ck.absentSettings ?? []) {
    if (upGrep(s, ['src/vs'])) continue;
    const cut = s.lastIndexOf('.');
    if (cut > 0 && upGrep(`'${s.slice(0, cut)}'`, ['src/vs']) && upGrep(`'${s.slice(cut)}'`, ['src/vs'])) continue;
    miss.push(`設定 ${s}`);
  }
  const kept = (unit.kept ?? []).map((k) => k.path);
  for (const { in: where, text } of ck.absentStrings ?? []) {
    const r = spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-l', '-e', text, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const files = (r.stdout ?? '').split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
    if (!files.length) miss.push(`文字列 ${text} (${where.join(', ')}): 本家に無い`);
    else if (!files.some((f) => !underAny(kept, f))) miss.push(`文字列 ${text} (${where.join(', ')}): 当たりがすべて kept`);
  }
  assert.deepEqual(miss, []);
});

test('C-4: checks に、2026-11-15 に足した設定 1つ・文字列 4つがある。プロセスと接続先は空', { skip: noUnit }, () => {
  const ck = unit.checks ?? {};
  assert.ok((ck.absentSettings ?? []).includes('search.experimental.closedNotebookRichContentResults'));
  const has = (file, text) => (ck.absentStrings ?? []).some((s) => s.in.includes(file) && s.text === text);
  assert.ok((ck.absentStrings ?? []).some((s) => s.text === 'INotebookSearchService'));
  assert.ok((ck.absentStrings ?? []).some((s) => s.text === 'notebook/browser/' && s.in.includes('src/vs/workbench/contrib/search') && s.in.includes('src/vs/workbench/contrib/searchEditor')));
  assert.ok(has(PROTOCOL, 'MainThreadNotebookShape'));
  assert.ok(has(PROTOCOL, 'ExtHostNotebookShape'));
  assert.deepEqual(ck.absentProcesses ?? [], []);
  assert.deepEqual(ck.absentHosts ?? [], []);
  assert.ok((unit.smoke ?? []).includes('claude-code') && (unit.smoke ?? []).includes('powershell'));
});

test('C-4: edits.patch が足す行に absentStrings の文字列が現れない（kept の対象を除く。当てた後の検査で自分が落ちない）', { skip: noPatch }, () => {
  const kept = (unit.kept ?? []).map((k) => k.path);
  const bad = [];
  for (const { in: where, text: t } of unit.checks?.absentStrings ?? []) {
    for (const s of sections) {
      if (!underAny(where, s.path) || underAny(kept, s.path)) continue;
      const hit = s.added.find((l) => l.includes(t));
      if (hit) bad.push(`${t} が ${s.path} の足す行にある: ${hit.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// 2. 検索の直しの検査（ノートブックへの参照・注入・分岐を外すだけで、テキスト検索・置換・検索エディタを壊していない）
// ---------------------------------------------------------------------------
test('C-4 検索: 検索・検索エディタ・一括編集のコードに足す行に、ノートブックの部品の参照（@INotebook・notebook/browser・NotebookEditor）が無い', { skip: noPatch }, () => {
  const ALLOWED = [/^\s*\/\//, /^\s*(\/\*\*|\*)/, /_notebookFilters = \{ markupInput: true, markupPreview: true, codeInput: true, codeOutput: true, onDidChange: Event\.None \};/,
    /notebook\/common\/notebookCommon\.js/, /Notebooks are not available in this build/];
  const bad = [];
  for (const s of sections) {
    if (!(isSearchCode(s.path) || isSearchTest(s.path) || /bulkEdit\//.test(s.path))) continue;
    for (const l of s.added) if (/otebook/.test(l) && !ALLOWED.some((re) => re.test(l))) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-4 検索: 消す行は、ノートブックへの参照・注入・分岐だけ（テキスト検索の呼び出し、置換、ReplacePattern、一括編集の呼び出し、context の足し込みを消していない）', { skip: noPatch }, () => {
  // 消してはいけない行
  const PROTECT = [/textSearchSplitSyncAsync\(/, /\bsearchService\.(textSearch|fileSearch)/, /\bReplacePattern\b/, /\.createMatches\(\)/, /\baddContext\(/,
    /bulkEditorService\.apply\(/, /\bsearchModel\b.*\.search\(/, /createEdit\(match, match\.replaceString, resource\)/, /registerContributions as replaceContributions/, /^\s*replaceContributions\(\);/];
  const bad = [];
  for (const s of sections) {
    if (!(isSearchCode(s.path) || /bulkEdit\//.test(s.path))) continue;
    // インデントを替えて足し直す行(else の枝をほどく)は、消していない
    for (const l of s.removed) for (const re of PROTECT) if (re.test(l) && !s.added.some((a) => a.trim() === l.trim())) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(bad, []);
  // 消す import に、検索の本体(検索サービス・置換・一致のモデル・一括編集)の import が無い。ほかの import は、使われなくなる行(型検査が見る)
  const protectedImports = [/services\/search\/common\/(search|replace|searchHelpers|searchExtTypes)\.js/, /searchTreeModel\/(fileMatch|folderMatch|searchModel|searchResult|match|textSearchHeading)\.js/,
    /bulkEditService\.js/, /\.\/replace\.js/, /queryBuilder\.js/, /searchEditorInput|searchEditorModel/];
  const keepImports = [];
  for (const s of sections.filter((x) => isSearchCode(x.path))) {
    for (const l of s.removed) {
      const im = /^import .* from '([^']+)';/.exec(l.trim());
      // 一括の import の行から名前だけを減らす行は、同じ specifier を足し直している
      if (im && protectedImports.some((re) => re.test(im[1])) && !s.added.some((a) => a.includes(`'${im[1]}'`))) keepImports.push(`${s.path}: ${l.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(keepImports, [], '検索の本体の import を消している');
});

test('C-4 検索: 全文検索のテキスト検索は ripgrep のまま。searchModel.ts は notebookSearch の呼び出しと、結果への足し込みを外し、textSearchSplitSyncAsync の呼び出しを残す', { skip: noPatch }, () => {
  const s = section('searchTreeModel/searchModel.ts');
  assert.ok(s);
  assert.ok(s.removed.some((l) => /INotebookSearchService/.test(l)));
  assert.ok(s.removed.some((l) => /notebookResult\s*=\s*this\.notebookSearchService\.notebookSearch\(/.test(l)));
  assert.ok(s.removed.some((l) => /notebookResult\.openFilesToScan/.test(l)) && s.removed.some((l) => /notebookResult\.allScannedFiles/.test(l)));
  assert.deepEqual(s.added.filter((l) => /otebook/.test(l)), []);
  // textSearchSplitSyncAsync の呼び出しは文脈に残る(消えていない)
  assert.ok(s.hunks.flat().some((x) => x.k === ' ' && /textSearchSplitSyncAsync\(/.test(x.t)));
  // 結果は、閉じたエディタの結果だけ
  assert.ok(s.added.some((l) => /results: \[\.\.\.allClosedEditorResults\.results\],/.test(l)));
  assert.ok(s.added.some((l) => /limitHit: allClosedEditorResults\.limitHit,/.test(l)));
});

test('C-4 検索: FileMatchImpl.createMatches に足すのは context の足し込み1行（this.addContext(this.rawMatch.results)）だけ。消した NotebookCompatibleFileMatch が足していた行', { skip: noPatch }, () => {
  const s = section('searchTreeModel/fileMatch.ts');
  assert.ok(s);
  assert.deepEqual(s.added.map((l) => l.trim()), ['// Shuko (C-4-notebook): the removed NotebookCompatibleFileMatch added the context lines here', 'this.addContext(this.rawMatch.results);']);
  assert.ok(s.removed.some((l) => /FindMatchDecorationModel/.test(l)));
  assert.ok(s.removed.some((l) => /_findMatchDecorationModel\?\.clearCurrentFindMatchDecoration\(\)/.test(l)));
  // 消す行にテキスト検索の部分は無い
  assert.deepEqual(s.removed.filter((l) => /createMatches|addContext|bindModel|updateHighlights|textMatches|_textMatches\.set|rawMatch/.test(l)), []);
});

test('C-4 検索: 足す addContext の1行は、本家の NotebookCompatibleFileMatch.createMatches が足していた行と同じ。FileMatchImpl に addContext があり、constructor は searchInstanceID を取らない', { skip: skipUpPatch }, () => {
  const nb = upShow(`${W}contrib/search/browser/notebookSearch/notebookSearchModel.ts`);
  assert.ok(nb, '本家に notebookSearchModel.ts が無い');
  assert.match(nb, /this\.addContext\(this\.rawMatch\.results\);/, '本家の消す部品が addContext を呼んでいない(足す行の根拠が無い)');
  const fm = upShow(FILE_MATCH);
  assert.match(fm, /\baddContext\(/);
  const ctor = /constructor\(([\s\S]*?)\n\t\) \{/.exec(fm)?.[1] ?? '';
  assert.ok(ctor.length > 0, 'constructor が読めない');
  assert.ok(!/searchInstanceID/.test(ctor), 'FileMatchImpl が searchInstanceID を取る(folderMatch.ts の引数を消すと合わない)');
});

test('C-4 検索: folderMatch.ts は NotebookCompatibleFileMatch を FileMatchImpl に替え(2か所)、searchInstanceID の引数を外す。cell の一致の足し込みと bind/unbindNotebookEditorWidget を消す', { skip: noPatch }, () => {
  const s = section('searchTreeModel/folderMatch.ts');
  assert.equal(s.removed.filter((l) => /^\s*NotebookCompatibleFileMatch,$/.test(l)).length, 2);
  assert.equal(s.added.filter((l) => /^\s*FileMatchImpl,$/.test(l)).length, 2);
  assert.equal(s.removed.filter((l) => /^\s*searchInstanceID,$/.test(l)).length, 2);
  assert.ok(s.removed.some((l) => /async bindNotebookEditorWidget\(/.test(l)));
  assert.ok(s.removed.some((l) => /^\s*unbindNotebookEditorWidget\(/.test(l)));
  assert.ok(s.removed.some((l) => /rawCellMatch/.test(l)));
  assert.deepEqual(s.added.filter((l) => !/^\s*FileMatchImpl,$/.test(l)), []);
  // 一致を作る呼び出しは残る
  assert.ok(s.hunks.flat().some((x) => x.k === ' ' && /fileMatch\.createMatches\(\);/.test(x.t)));
});

test('C-4 検索: replaceService.ts は notebook の分岐(CellUri・INotebookEditorModelResolverService・isIMatchInNotebook)を外し、テキストの保存と編集を残す', { skip: noPatch }, () => {
  const s = section('contrib/search/browser/replaceService.ts');
  assert.ok(s.removed.some((l) => /INotebookEditorModelResolverService/.test(l)));
  assert.ok(s.removed.some((l) => /isIMatchInNotebook/.test(l)));
  assert.ok(s.added.some((l) => /return this\.textFileService\.files\.get\(e\.resource\)\?\.save\(\{ source: ReplaceService\.REPLACE_SAVE_SOURCE \}\);/.test(l)));
  assert.ok(s.added.some((l) => /edits\.push\(this\.createEdit\(match, match\.replaceString, resource\)\);/.test(l)));
  assert.ok(!s.removed.some((l) => /openReplacePreview|updateReplacePreview|bulkEditorService\.apply|Promises\.settled|textModelResolverService/.test(l)));
});

test('C-4 検索: searchView.ts は NotebookEditor への分岐・shouldOpenInNotebookEditor・INotebookService の注入を外し、置換のプレビュー・開く処理を残す', { skip: noPatch }, () => {
  const s = section('contrib/search/browser/searchView.ts');
  assert.ok(s.removed.some((l) => /private shouldOpenInNotebookEditor\(/.test(l)));
  assert.ok(s.removed.some((l) => /@INotebookService/.test(l)));
  assert.ok(s.removed.some((l) => /if \(editor instanceof NotebookEditor\)/.test(l)));
  assert.deepEqual(s.added.filter((l) => /otebook/.test(l)), []);
  assert.ok(!s.removed.some((l) => /openReplacePreview|this\.open\(lineMatch|getEditorSelectionFromMatch|openEditorWithMultiCursor|openSearchEditor/.test(l) && !/shouldOpenInNotebookEditor/.test(l)), '開く処理・置換のプレビューを消している');
});

test('C-4 検索: searchWidget.ts は NotebookFindFilters・_hasNotebookOpen・エディタの変更の購読を外し、getNotebookFilters() は既定値(すべて真・変わらない)の定数にする', { skip: noPatch }, () => {
  const s = section('contrib/search/browser/searchWidget.ts');
  assert.ok(s.removed.some((l) => /new NotebookFindFilters\(/.test(l)));
  assert.ok(s.removed.some((l) => /private _hasNotebookOpen\(\)/.test(l)));
  assert.ok(s.removed.some((l) => /@IEditorService/.test(l)));
  const filters = s.added.find((l) => /_notebookFilters = /.test(l));
  assert.ok(filters, '_notebookFilters の定数が無い');
  for (const k of ['markupInput: true', 'markupPreview: true', 'codeInput: true', 'codeOutput: true', 'onDidChange: Event.None']) assert.ok(filters.includes(k), `${k} が無い`);
  assert.ok(!s.removed.some((l) => /getNotebookFilters\(\)/.test(l)), 'getNotebookFilters() を消している(検索のビューと検索エディタが読む)');
  // 検索の入力・置換の入力・履歴は消していない
  assert.ok(!s.removed.some((l) => /_replaceHistoryDelayer|_toggleReplaceButtonListener|ReplaceAllAction|contextLinesInput|this\.replaceInput/.test(l)), '置換の入力・履歴・文脈の行数の入力を消している');
});

test('C-4 検索: 検索エディタ(searchEditorSerialization.ts)は、セルの一致の書き出しを外すだけ。行の context の書き出し(serializeSearchResultForEditor)は残す', { skip: noPatch }, () => {
  const s = section('searchEditor/browser/searchEditorSerialization.ts');
  assert.ok(s);
  assert.deepEqual(s.added.filter((l) => /otebook/.test(l)), []);
  assert.ok(s.removed.some((l) => /otebook|Cell|cell/.test(l)), 'セルの一致の書き出しを消していない');
  assert.ok(!s.removed.some((l) => /serializeSearchResultForEditor|contextLines|matchLineNumber|lineNumber|context/i.test(l) && !/otebook|cell/i.test(l)), '行の context の書き出しを消している');
});

test('C-4 検索: 検索のテストは、差し替えの行を外して FileMatchImpl で一致を作る。ノートブックの検索のテストの本体は searchModel.test.ts の中の節を消すだけ', { skip: noPatch }, () => {
  for (const f of ['searchActions.test.ts', 'searchModel.test.ts', 'searchResult.test.ts', 'searchViewlet.test.ts']) {
    const s = section(`contrib/search/test/browser/${f}`);
    assert.ok(s, f);
    assert.deepEqual(s.added.filter((l) => /otebook/.test(l)), [], `${f}: ノートブックの語を足している`);
  }
  for (const f of ['searchResult.test.ts', 'searchViewlet.test.ts', 'searchActions.test.ts']) {
    assert.ok(section(`contrib/search/test/browser/${f}`).added.some((l) => /createInstance\(FileMatchImpl,/.test(l)), `${f}: FileMatchImpl で作っていない`);
  }
});

test('C-4 検索(本家に当てる): 検索・検索エディタ・一括編集のコードに edits.patch を当てると、ノートブックの部品の import・注入が残らず、テキスト検索の呼び出し・置換は残る', { skip: skipUpPatch }, () => {
  const bad = [];
  const out = new Map();
  let applied = 0;
  for (const s of sections.filter((x) => (isSearchCode(x.path) || /bulkEdit\/browser/.test(x.path)) && !x.isNew)) {
    const src = upShow(s.path);
    const patched = src === null ? null : applyHunks(src, s.hunks);
    if (patched === null) continue; // C-1・C-2 が先に変えた文脈に頼るハンクは、本家のまま当てられない
    applied++;
    out.set(s.path, patched);
    const lines = patched.split('\n');
    for (const l of lines) {
      if (/^\s*import\b/.test(l) && /notebook\/(browser|common\/notebookEditorModelResolverService|common\/notebookService)|notebookSearch\/|notebookSearch\.js|cellSearchModel|searchNotebookHelpers\.js/.test(l)) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
      if (/@INotebook\w+/.test(l)) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
    }
  }
  assert.ok(applied >= 10, `本家に当たったファイルが少ない(${applied})。ハンクの文脈が C-1・C-2 に依存している`);
  assert.deepEqual(bad, []);
  const model = out.get(`${W}contrib/search/browser/searchTreeModel/searchModel.ts`);
  if (model) assert.match(model, /textSearchSplitSyncAsync\(/);
  const fm = out.get(FILE_MATCH);
  assert.ok(fm, 'fileMatch.ts が本家に当たらない');
  const fn = /createMatches\(\)[^{]*\{/.exec(fm);
  assert.ok(fn, 'createMatches が無い');
  let depth = 0; let end = -1;
  for (let i = fn.index + fn[0].length - 1; i < fm.length; i++) { if (fm[i] === '{') depth++; else if (fm[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
  const bodyText = fm.slice(fn.index, end);
  assert.equal([...bodyText.matchAll(/this\.addContext\(this\.rawMatch\.results\);/g)].length, 1, 'createMatches の中に addContext の足し込みがちょうど1つ');
  const rep = out.get(`${W}contrib/search/browser/replaceService.ts`);
  if (rep) { assert.match(rep, /bulkEditorService\.apply\(/); assert.match(rep, /textFileService\.files\.get\(e\.resource\)/); }
});

// ---------------------------------------------------------------------------
// 3. 何もしない実装の検査（文字列と構文）
// ---------------------------------------------------------------------------
const apiText = noPatch ? '' : body('extHostRemovedApi.notebook.ts');
const noApi = noPatch || (apiText ? false : '実装なし: extHostRemovedApi.notebook.ts の本文が無い');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const WINDOW_MEMBERS = ['activeNotebookEditor', 'onDidChangeActiveNotebookEditor', 'visibleNotebookEditors', 'onDidChangeVisibleNotebookEditors', 'onDidChangeNotebookEditorSelection',
  'onDidChangeNotebookEditorVisibleRanges', 'showNotebookDocument'];
const WORKSPACE_MEMBERS = ['notebookDocuments', 'openNotebookDocument', 'onDidSaveNotebookDocument', 'onDidChangeNotebookDocument', 'onWillSaveNotebookDocument',
  'onDidOpenNotebookDocument', 'onDidCloseNotebookDocument', 'registerNotebookSerializer'];
const NOTEBOOKS_MEMBERS = ['createNotebookController', 'registerNotebookCellStatusBarItemProvider', 'createRendererMessaging', 'createNotebookControllerDetectionTask', 'registerKernelSourceActionProvider'];
const WINDOW_EVENTS = WINDOW_MEMBERS.filter((n) => n.startsWith('onDid'));
const WORKSPACE_EVENTS = WORKSPACE_MEMBERS.filter((n) => /^on(Did|Will)/.test(n));

test('C-4 何もしない実装: 空の値(notebookDocuments は []、visibleNotebookEditors は []、activeNotebookEditor は undefined)とイベント9つ(Event.None)', { skip: noApi }, () => {
  assert.match(apiText, /^\t\tnotebookDocuments: \[\],$/m);
  assert.match(apiText, /^\t\tvisibleNotebookEditors: \[\],$/m);
  assert.match(apiText, /^\t\tactiveNotebookEditor: undefined,$/m);
  for (const n of [...WINDOW_EVENTS, ...WORKSPACE_EVENTS]) {
    assert.match(apiText, new RegExp(`^\\t\\t${n}: Event\\.None,$`, 'm'), `${n} が Event.None でない`);
  }
  assert.equal(WINDOW_EVENTS.length + WORKSPACE_EVENTS.length, 9);
  // 2 タブの on* は、window・workspace の9つと、コントローラーの2つ(onDidChangeSelectedNotebooks・onDidReceiveMessage)。すべて Event.None
  const evs = [...apiText.matchAll(/^\t\t(on[A-Z]\w*): (.*)$/gm)];
  assert.deepEqual(evs.map((m) => m[1]).sort(), [...WINDOW_EVENTS, ...WORKSPACE_EVENTS, 'onDidChangeSelectedNotebooks', 'onDidReceiveMessage'].sort());
  assert.deepEqual(evs.filter((m) => m[2] !== 'Event.None,').map((m) => m[0]), []);
  assert.ok(!/new Emitter\b/.test(code(apiText)));
});

test('C-4 何もしない実装: openNotebookDocument・showNotebookDocument は reject する(同じ文言)。registerNotebookSerializer・registerNotebookCellStatusBarItemProvider は何もしない Disposable', { skip: noApi }, () => {
  assert.match(apiText, /const notebooksUnavailable = 'Notebooks are not available in this build';/);
  const take = (name) => new RegExp(`^\\t\\t${name}\\([^\\n]*\\{\\r?\\n([\\s\\S]*?)^\\t\\t\\},?$`, 'm').exec(apiText)?.[1] ?? null;
  for (const n of ['openNotebookDocument', 'showNotebookDocument']) {
    const b = take(n);
    assert.ok(b, `${n} が無い`);
    assert.match(b, /return Promise\.reject\(new Error\(notebooksUnavailable\)\);/);
    assert.ok(!/Promise\.resolve|checkProposedApiEnabled/.test(b));
  }
  for (const n of ['registerNotebookSerializer', 'registerNotebookCellStatusBarItemProvider']) {
    const b = take(n);
    assert.ok(b && /return noopDisposable\(\);/.test(b), `${n} が noopDisposable を返さない`);
    assert.ok(!/checkProposedApiEnabled/.test(b), `${n} に門がある(安定版)`);
  }
  assert.match(apiText, /function noopDisposable\(\)[^{]*\{\s*return \{ dispose\(\) \{ \} \};\s*\}/);
});

// 提案中の API の門の期待は、手で並べず、仕様の側から読む: 本家のタグの、C-4 が消す extHost のファイル(api/common の extHost*.ts)の
// `checkProposedApiEnabled(extension, '<名前>')` と、edits.patch が extHost.api.impl.ts から消す塊の同じ呼び出し。
// (実装の門の一覧と突き合わせる。大岡越前守の検証で、手で並べた期待が実装の抜け(notebookControllerAffinityHidden)を通した 2026-11-15)
function upstreamGateSites() {
  const names = [];
  const gate = /checkProposedApiEnabled\(extension, '(\w+)'\)/g;
  for (const d of unit.delete ?? []) {
    if (!/^src\/vs\/workbench\/api\/common\/extHost[^/]*\.ts$/.test(d)) continue;
    const t = upShow(d);
    assert.ok(t !== null, `本家に無い: ${d}`);
    for (const m of t.matchAll(gate)) names.push(m[1]);
  }
  for (const l of section('api/common/extHost.api.impl.ts')?.removed ?? []) for (const m of l.matchAll(gate)) names.push(m[1]);
  return names.sort();
}
test('C-4 何もしない実装: 提案中の API の門が、本家の消すファイルの門と過不足なく残る(本家から読む。notebookKernelSource 2・notebookMessaging 2・notebookExecution・notebookVariableProvider・notebookControllerAffinityHidden)', { skip: skipUpPatch || noApi }, () => {
  const expected = upstreamGateSites();
  assert.ok(expected.length >= 7, `本家の門が少ない: ${expected.join(',')}`);
  const calls = [...apiText.matchAll(/checkProposedApiEnabled\(extension, '(\w+)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(calls, expected, '何もしない実装の門が、本家の消すファイルの門と違う(抜け・増え)');
  // updateNotebookAffinity の門は条件つき: 提案の値(NotebookControllerAffinity2.Hidden = -1)のときだけ(本家 extHostNotebookKernels.ts)
  const up = upShow(`${W}api/common/extHostNotebookKernels.ts`);
  assert.match(up, /updateNotebookAffinity\(notebook, priority\) \{\s*if \(priority === NotebookControllerAffinity2\.Hidden\) \{[\s\S]*?checkProposedApiEnabled\(extension, 'notebookControllerAffinityHidden'\);/);
  const aff = /updateNotebookAffinity\([^\n]*\{\r?\n([\s\S]*?)^\t\t\},?$/m.exec(apiText)?.[1] ?? '';
  assert.match(aff, /checkProposedApiEnabled\(extension, 'notebookControllerAffinityHidden'\)/, 'updateNotebookAffinity に門が無い(Hidden を渡したときに誤りを投げない)');
  assert.match(aff, /-1|Hidden/, '門が条件つきでない(Default・Preferred でも門がかかる)');
});

test('C-4 何もしない実装: 提案中の API の門は、各メンバーの最初の文(return・throw より前)にある', { skip: noApi }, () => {
  // isProposedApiEnabled は、createNotebookController の rendererScripts を提案(notebookMessaging)のときだけ通す分岐(投げない。本家と同じ)
  assert.match(apiText, /import \{ checkProposedApiEnabled(?:, isProposedApiEnabled)? \} from '\.\.\/\.\.\/services\/extensions\/common\/extensions\.js';/);
  {
    const calls = [...apiText.matchAll(/checkProposedApiEnabled\(extension, '(\w+)'\)/g)].map((m) => m[1]);
    assert.ok(calls.length >= 7, `門の呼び出しが少ない: ${calls.length}`);
  }
  for (const [n, p] of [['createNotebookControllerDetectionTask', 'notebookKernelSource'], ['registerKernelSourceActionProvider', 'notebookKernelSource'],
    ['createNotebookExecution', 'notebookExecution'], ['postMessage', 'notebookMessaging'], ['asWebviewUri', 'notebookMessaging']]) {
    const re = new RegExp(`^\\t\\t${n}\\([^\\n]*\\{\\r?\\n([\\s\\S]*?)^\\t\\t\\},?$`, 'm').exec(apiText);
    assert.ok(re, `${n} が無い`);
    const b = re[1];
    const gate = b.indexOf(`checkProposedApiEnabled(extension, '${p}')`);
    assert.ok(gate >= 0, `${n}: 門 ${p} が無い`);
    const first = b.search(/\b(return|throw)\b/);
    assert.ok(first < 0 || gate < first, `${n}: 門が return・throw より後`);
  }
  // createNotebookCellExecution は門を持たない(本家と同じ)で誤りを投げる
  const exec = /createNotebookCellExecution\([^\n]*\{\r?\n([\s\S]*?)^\t\t\},?$/m.exec(apiText)?.[1];
  assert.ok(exec && /throw new Error\(notebooksUnavailable\);/.test(exec) && !/checkProposedApiEnabled/.test(exec));
  assert.match(apiText, /set variableProvider\(value\) \{\s*checkProposedApiEnabled\(extension, 'notebookVariableProvider'\);/);
});

test('C-4 何もしない実装: createNotebookController は id・notebookType・label をそのまま持つコントローラーを返す。dispose・updateNotebookAffinity は空。createRendererMessaging の postMessage は false で resolve', { skip: noApi }, () => {
  assert.match(apiText, /^\t\tid,$/m);
  assert.match(apiText, /^\t\tnotebookType,$/m);
  assert.match(apiText, /label: label \|\| extension\.identifier\.value,/);
  assert.match(apiText, /^\t\tupdateNotebookAffinity\(/m, 'updateNotebookAffinity が無い(中身は門のほかは空。門は「提案中の API の門が…過不足なく」で見る)');
  assert.match(apiText, /^\t\tdispose\(\): void \{\s*\}$/m);
  assert.match(apiText, /createRendererMessaging\(_rendererId: string\)[^{]*\{\s*return \{\s*onDidReceiveMessage: Event\.None,\s*postMessage\([^)]*\)[^{]*\{\s*return Promise\.resolve\(false\);/);
  assert.match(apiText, /onDidChangeSelectedNotebooks: Event\.None,/);
  assert.match(apiText, /onDidReceiveMessage: Event\.None,/);
});

test('C-4 何もしない実装: 通信・プロセス・タイマー・DI・RPC・消した部品を持たない(何もしない)', { skip: noApi }, () => {
  const c = code(apiText);
  for (const re of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /child_process/, /\bIRPCProtocol\b/, /\brpcProtocol\b/,
    /\$register/, /\.\$\w+\(/, /@I[A-Z]\w+/, /\bnew Emitter\b/, /\bconsole\./, /ExtHostNotebook/, /extHostNotebook/, /MainThreadNotebook/, /INotebookService/, /\basync\b/, /\bawait\b/]) {
    assert.ok(!re.test(c), `使ってはいけないもの: ${re}`);
  }
});

test('C-4 何もしない実装: import は vscode(型)・Event・URI・IExtensionDescription・checkProposedApiEnabled・asWebviewUri の6つだけ。asWebviewUri は残る webview/common にある', { skip: noApi }, () => {
  // './extHostTypes.js' は、updateNotebookAffinity の門が提案の値(NotebookControllerAffinity2.Hidden)を比べるための import(残る extHostTypes にある)。-1 の直書きなら無くてよい
  const specs = [...apiText.matchAll(/^import\b[^;]*?\bfrom\s+'([^']+)';/gm)].map((m) => m[1]).filter((s) => s !== './extHostTypes.js').sort();
  assert.deepEqual(specs, ['../../../base/common/event.js', '../../../base/common/uri.js', '../../../platform/extensions/common/extensions.js',
    '../../contrib/webview/common/webview.js', '../../services/extensions/common/extensions.js', 'vscode'].sort());
  const ht = /^import \{([^}]*)\} from '\.\/extHostTypes\.js';/m.exec(apiText);
  if (ht) {
    assert.deepEqual(ht[1].split(',').map((x) => x.trim()), ['NotebookControllerAffinity2']);
    assert.ok(!underAny(unit.delete ?? [], `${W}api/common/extHostTypes.ts`) && !underAny(unit.delete ?? [], `${W}api/common/extHostTypes`), 'extHostTypes を delete している');
  }
  assert.match(apiText, /^import type \* as vscode from 'vscode';$/m);
  assert.ok(!underAny(unit.delete ?? [], `${W}contrib/webview/common/webview.ts`));
  if (upOk) {
    assert.match(upShow(`${W}contrib/webview/common/webview.ts`) ?? '', /export function asWebviewUri\(/);
    assert.match(upShow(`${W}services/extensions/common/extensions.ts`) ?? '', /export function checkProposedApiEnabled\(/);
  }
});

// ---------------------------------------------------------------------------
// 4. 何もしない実装を走らせる（型を外した本文を node で。import は模擬）
// ---------------------------------------------------------------------------
const strip = nodeModule.stripTypeScriptTypes;
const noRun = noApi || (typeof strip === 'function' ? false : 'node に module.stripTypeScriptTypes が無い');
function load() {
  const src = apiText.replace(/^import .*$/gm, '').replace(/^export (function|interface) /gm, '$1 ');
  const js = strip(src, { mode: 'strip' });
  const None = () => ({ dispose() { } });
  const Event = { None };
  const URI = { from: (c) => ({ ...c, isUri: true }) };
  const checkProposedApiEnabled = (ext, name) => { if (!(ext.enabledApiProposals ?? []).includes(name)) throw new Error(`Extension '${ext.name}' CANNOT use API proposal: ${name}.`); };
  const asWebviewUri = (u) => ({ scheme: 'vscode-webview', via: u });
  // 提案の値の enum は本家の extHostTypes.ts から読む(読めなければ Hidden = -1)
  const enumText = upOk ? /export enum NotebookControllerAffinity2 \{([\s\S]*?)\}/.exec(upShow(`${W}api/common/extHostTypes.ts`) ?? '')?.[1] : null;
  const NotebookControllerAffinity2 = Object.fromEntries([...(enumText ?? 'Default = 1, Preferred = 2, Hidden = -1').matchAll(/(\w+)\s*=\s*(-?\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const isProposedApiEnabled = (ext, name) => (ext.enabledApiProposals ?? []).includes(name);
  const create = new Function('Event', 'URI', 'checkProposedApiEnabled', 'isProposedApiEnabled', 'asWebviewUri', 'NotebookControllerAffinity2', `${js}\nreturn createRemovedNotebookApi;`)(Event, URI, checkProposedApiEnabled, isProposedApiEnabled, asWebviewUri, NotebookControllerAffinity2);
  return { create, None };
}
const plain = { name: 'x.plain', identifier: { value: 'x.plain' } };
const allProposals = { name: 'x.all', identifier: { value: 'x.all' }, enabledApiProposals: ['notebookKernelSource', 'notebookMessaging', 'notebookExecution', 'notebookVariableProvider', 'notebookControllerAffinityHidden'] };

test('C-4 何もしない実装(走らせる): updateNotebookAffinity は、提案を有効にしていない拡張が Hidden(-1)を渡すと誤りを投げ、Default(1)・Preferred(2)では投げない(本家の振る舞い)', { skip: noRun }, () => {
  const { create } = load();
  const c = create(plain).notebooks.createNotebookController('id', 'type', 'label');
  assert.throws(() => c.updateNotebookAffinity({}, -1), /CANNOT use API proposal: notebookControllerAffinityHidden/);
  assert.doesNotThrow(() => c.updateNotebookAffinity({}, 1));
  assert.doesNotThrow(() => c.updateNotebookAffinity({}, 2));
  assert.equal(c.updateNotebookAffinity({}, 1), undefined);
  // 提案を有効にした拡張では、Hidden でも投げない
  assert.doesNotThrow(() => create(allProposals).notebooks.createNotebookController('id', 'type', 'label').updateNotebookAffinity({}, -1));
});

// 所(メンバー)ごとの門(C-1 の 5回目と同じ形。名前の集まりでは、同じ提案の名前が別の所に出ると抜けが見えない)。
// 期待は本家の消す extHost のファイルのメンバーごとの checkProposedApiEnabled から読み、何もしない実装の面を触って確かめる。
test('C-4 何もしない実装(走らせる): 本家の消すファイルでメンバーごとに門があるものは、提案を有効にしていない拡張で門の誤りになる。有効にした拡張では誤りにならない。誤りの出方が本家と同じ', { skip: noRun || (upOk ? false : '本家のソースが読めない') }, async () => {
  const files = (unit.delete ?? []).filter((d) => /^src\/vs\/workbench\/api\/common\/extHost[^/]*\.ts$/.test(d)).map((d) => ({ path: d, text: upShow(d) })).filter((f) => f.text !== null);
  assert.ok(files.length >= 3, `本家の消す extHost のファイルが読めない(${files.length})`);
  const map = memberGatesOf(files);
  const { create } = load();
  const surfacesFor = (proposals) => {
    const api = create({ name: 'x.ext', identifier: { value: 'x.ext' }, enabledApiProposals: proposals });
    return { notebooks: api.notebooks, window: api.window, workspace: api.workspace, controller: api.notebooks.createNotebookController('id', 'type', 'label') };
  };
  // updateNotebookAffinity の門は、Hidden(-1)を渡したときだけ(別の検査が見る)。同じ形で引数を渡す
  const { checked, bad, asyncBad } = await compareMemberGates({ map, surfacesFor, callArgs: { updateNotebookAffinity: [{}, -1] } });
  assert.ok(checked.length >= 3, `突き合わせたメンバーが少ない(${checked.length}): 読み方が外れている。門のあるメンバー: ${[...map].filter(([, v]) => v.gates.size).map(([k, v]) => `${k}:${[...v.gates].join('/')}`).slice(0, 12).join(', ')}`);
  expectChecked(checked, ['controller.set variableProvider', 'controller.createNotebookExecution', 'controller.postMessage', 'controller.asWebviewUri']);
  assert.deepEqual(bad, [], `突き合わせたメンバー: ${checked.join(', ')}`);
  assert.deepEqual(asyncBad, []);
});

test('C-4 何もしない実装(走らせる): workspace.notebookDocuments は []、window.visibleNotebookEditors は []、window.activeNotebookEditor は undefined', { skip: noRun }, () => {
  const { create } = load();
  const api = create(plain);
  assert.deepEqual(api.workspace.notebookDocuments, []);
  assert.deepEqual(api.window.visibleNotebookEditors, []);
  assert.equal(api.window.activeNotebookEditor, undefined);
  assert.deepEqual(Object.keys(api.window).sort(), [...WINDOW_MEMBERS].sort());
  assert.deepEqual(Object.keys(api.workspace).sort(), [...WORKSPACE_MEMBERS].sort());
  assert.deepEqual(Object.keys(api.notebooks).sort(), [...NOTEBOOKS_MEMBERS].sort());
});

test('C-4 何もしない実装(走らせる): イベント9つは Event.None そのもので、購読すると Disposable が返る。発火しない', { skip: noRun }, () => {
  const { create, None } = load();
  const api = create(plain);
  for (const [ns, names] of [['window', WINDOW_EVENTS], ['workspace', WORKSPACE_EVENTS]]) {
    for (const n of names) {
      assert.equal(api[ns][n], None, `${ns}.${n} が Event.None でない`);
      const d = api[ns][n](() => assert.fail('発火した'));
      assert.equal(typeof d.dispose, 'function');
    }
  }
});

test('C-4 何もしない実装(走らせる): registerNotebookSerializer("jupyter-notebook", {})・registerNotebookCellStatusBarItemProvider("x", {}) の返り値は dispose を持ち、呼んでも誤りにならない', { skip: noRun }, () => {
  const { create } = load();
  const api = create(plain);
  for (const d of [api.workspace.registerNotebookSerializer('jupyter-notebook', {}), api.workspace.registerNotebookSerializer('x', {}, { transientOutputs: true }, { displayName: 'd' }),
    api.notebooks.registerNotebookCellStatusBarItemProvider('x', {})]) {
    assert.equal(typeof d.dispose, 'function');
    assert.doesNotThrow(() => d.dispose());
    assert.doesNotThrow(() => d.dispose());
  }
});

test('C-4 何もしない実装(走らせる): openNotebookDocument(URI)・openNotebookDocument("type", data)・showNotebookDocument({}) は reject する', { skip: noRun }, async () => {
  const { create } = load();
  const api = create(plain);
  await assert.rejects(api.workspace.openNotebookDocument({ scheme: 'file', path: 'a.ipynb' }), /Notebooks are not available in this build/);
  await assert.rejects(api.workspace.openNotebookDocument('jupyter-notebook', { cells: [] }), /Notebooks are not available/);
  await assert.rejects(api.window.showNotebookDocument({}), /Notebooks are not available/);
  await assert.rejects(api.window.showNotebookDocument({}, { viewColumn: 1 }), /Notebooks are not available/);
});

test('C-4 何もしない実装(走らせる): createNotebookController("id", "type", "label") の id・notebookType・label が渡した値。dispose・updateNotebookAffinity は誤りにならず、createNotebookCellExecution は誤りを投げる', { skip: noRun }, () => {
  const { create, None } = load();
  const api = create(plain);
  const handler = () => { };
  const c = api.notebooks.createNotebookController('id', 'type', 'label', handler);
  assert.deepEqual([c.id, c.notebookType, c.label], ['id', 'type', 'label']);
  assert.equal(c.executeHandler, handler);
  assert.equal(api.notebooks.createNotebookController('i', 't', '').label, 'x.plain', 'label が空なら拡張の識別子');
  assert.equal(typeof api.notebooks.createNotebookController('i', 't', 'l').executeHandler, 'function', 'handler が無くても実行ハンドラーは関数');
  assert.equal(c.onDidChangeSelectedNotebooks, None);
  assert.equal(c.onDidReceiveMessage, None);
  assert.doesNotThrow(() => c.dispose());
  assert.doesNotThrow(() => c.updateNotebookAffinity({}, 1));
  assert.throws(() => c.createNotebookCellExecution({}), /Notebooks are not available/);
  assert.deepEqual(c.rendererScripts, []);
  c.interruptHandler = () => { };
  assert.equal(typeof c.interruptHandler, 'function');
  c.executeHandler = undefined;
  assert.equal(typeof c.executeHandler, 'function', 'undefined を代入しても関数のまま');
});

test('C-4 何もしない実装(走らせる): createRendererMessaging("r").postMessage("m") は false で resolve し、onDidReceiveMessage は Event.None', { skip: noRun }, async () => {
  const { create, None } = load();
  const m = create(plain).notebooks.createRendererMessaging('r');
  assert.equal(await m.postMessage('m'), false);
  assert.equal(await m.postMessage('m', {}), false);
  assert.equal(m.onDidReceiveMessage, None);
});

test('C-4 何もしない実装(走らせる): 提案を有効にしていない拡張で、createNotebookControllerDetectionTask・registerKernelSourceActionProvider、コントローラーの postMessage・asWebviewUri・createNotebookExecution・variableProvider の代入は誤りを投げる(門が残っている)', { skip: noRun }, () => {
  const { create } = load();
  const bad = create(plain);
  assert.throws(() => bad.notebooks.createNotebookControllerDetectionTask('t'), /CANNOT use API proposal: notebookKernelSource/);
  assert.throws(() => bad.notebooks.registerKernelSourceActionProvider('t', {}), /CANNOT use API proposal: notebookKernelSource/);
  const c = bad.notebooks.createNotebookController('id', 'type', 'label');
  assert.throws(() => c.postMessage('m'), /CANNOT use API proposal: notebookMessaging/);
  assert.throws(() => c.asWebviewUri({ scheme: 'file' }), /CANNOT use API proposal: notebookMessaging/);
  assert.throws(() => c.createNotebookExecution({}), /CANNOT use API proposal: notebookExecution/);
  assert.throws(() => { c.variableProvider = {}; }, /CANNOT use API proposal: notebookVariableProvider/);
});

test('C-4 何もしない実装(走らせる): 提案を有効にした拡張では、門を通って何もしない値が返る(Disposable・false・URI)。createNotebookExecution は門の後で誤りを投げる', { skip: noRun }, async () => {
  const { create } = load();
  const ok = create(allProposals);
  for (const d of [ok.notebooks.createNotebookControllerDetectionTask('t'), ok.notebooks.registerKernelSourceActionProvider('t', {})]) {
    assert.equal(typeof d.dispose, 'function');
    assert.doesNotThrow(() => d.dispose());
  }
  const c = ok.notebooks.createNotebookController('id', 'type', 'label');
  assert.equal(await c.postMessage('m'), false);
  assert.equal(c.asWebviewUri({ scheme: 'file', path: '/a' }).scheme, 'vscode-webview');
  assert.throws(() => c.createNotebookExecution({}), /Notebooks are not available/);
  assert.doesNotThrow(() => { c.variableProvider = {}; });
  assert.deepEqual(c.variableProvider, {});
});

test('C-4 何もしない実装(走らせる): 拡張ごとに別のオブジェクト(状態を持たない)。コントローラーも呼ぶたびに別', { skip: noRun }, () => {
  const { create } = load();
  const a = create(plain);
  const b = create(allProposals);
  assert.notEqual(a.notebooks, b.notebooks);
  assert.notEqual(a.notebooks.createNotebookController('i', 't', 'l'), a.notebooks.createNotebookController('i', 't', 'l'));
});

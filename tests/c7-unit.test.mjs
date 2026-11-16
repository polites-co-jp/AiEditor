// C-7-breadcrumbs-outline（パンくずリストとアウトライン）の単位のファイルの静的な検査と、型検査に掛からない注入の外し損ねの検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節・4節（C-7 の行と末尾）・5.1・5.3・5.4・9節（Claude Code は差分エディタ・エディタの枠を使う）、docs/07 の8節、
//       docs/user-decisions.md の 2026-11-15（C-7 の edits.patch を作るときに出た点）、removals/C-7-breadcrumbs-outline/README.md。
// 期待は本家 1.146.0 から読む(手で並べない): 消す部品が登録するサービスの ID、その ID を注入・取得する所、消すコマンド・設定の登録。実装の一覧から写さない。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-7 に固有の分だけ。何もしない実装は無い(拡張から見えない部品なので、edits.patch は消すだけ)。
// Run: node --test tests/c7-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C7_UNIT_DIR: 単位のフォルダの代わり(tests/c7-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const ME = 'C-7-breadcrumbs-outline';
const UNIT_DIR = process.env.AIED_C7_UNIT_DIR ? resolve(process.env.AIED_C7_UNIT_DIR) : join(REPO, 'removals', ME);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : `実装なし: removals/${ME}/unit.json が無い`;
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。AIED_C7_NO_UPSTREAM=1: 本家を読む検査を飛ばす(c7-mutation が、本家を要さない壊し方を速く確かめるのに使う)
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = !process.env.AIED_C7_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const skipUpPatch = noPatch || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const upHas = (p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p.replace(/\/+$/, '')}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upGrepFiles = (re, where, flags = ['-l', '-E']) => (spawnSync('git', ['-C', UP_REPO, 'grep', ...flags, '-e', re, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
const upGrepLines = (re, where) => (spawnSync('git', ['-C', UP_REPO, 'grep', '-n', '-E', '-e', re, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => { const m = new RegExp(`^${UP_TAG.replace(/\./g, '\\.')}:(.*?):(\\d+):(.*)$`).exec(l); return m ? { file: m[1], line: Number(m[2]), text: m[3] } : null; }).filter(Boolean);
const underAny = (list, p) => list.some((d) => { const dd = d.replace(/\/+$/, ''); return p === dd || p.startsWith(dd + '/'); });

function parsePatch(text) {
  const sections = [];
  let cur = null;
  let hunk = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line === '-- ') break;
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], isNew: false, isDelete: false, hunks: [] }; sections.push(cur); hunk = null; continue; }
    if (!cur) continue;
    if (/^@@ /.test(line)) { hunk = []; cur.hunks.push(hunk); continue; }
    if (!hunk) { if (/^new file mode/.test(line)) cur.isNew = true; else if (/^deleted file mode/.test(line)) cur.isDelete = true; continue; }
    if (line.startsWith('+')) hunk.push({ k: '+', t: line.slice(1) });
    else if (line.startsWith('-')) hunk.push({ k: '-', t: line.slice(1) });
    else if (line.startsWith(' ')) hunk.push({ k: ' ', t: line.slice(1) });
  }
  for (const s of sections) {
    const all = s.hunks.flat();
    s.added = all.filter((x) => x.k === '+').map((x) => x.t);
    s.removed = all.filter((x) => x.k === '-').map((x) => x.t);
    s.old = all.filter((x) => x.k !== '+').map((x) => x.t);
    s.context = all.filter((x) => x.k === ' ').map((x) => x.t);
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

// ほかの単位
const others = [];
for (const d of readdirSync(join(REPO, 'removals'), { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === ME) continue;
  const uj = join(REPO, 'removals', d.name, 'unit.json');
  if (!existsSync(uj)) continue;
  const u = readJson(uj);
  const pf = u.patch ? join(REPO, 'removals', d.name, u.patch) : null;
  others.push({ id: u.id ?? d.name, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] });
}

const W = 'src/vs/workbench/';
const P = `${W}browser/parts/editor/`;
// エディタの枠のうち、触ってよい決まった4ファイル
const FRAME4 = [`${P}auxiliaryEditorPart.ts`, `${P}editorHeaderControl.ts`, `${P}editorTitleControl.ts`, `${P}singleEditorTabsControl.ts`];
const OTHER_EDITED = [`${W}common/editor.ts`, `${W}contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts`, `${W}api/browser/mainThreadCustomEditors.ts`];
const TESTS_EDITED = [`${W}api/test/browser/mainThreadCustomEditors.test.ts`, `${W}contrib/search/test/browser/anythingQuickAccess.test.ts`, `${W}test/browser/componentFixtures/editor/tabs.fixture.ts`];
const EDITED = [...FRAME4, ...OTHER_EDITED, ...TESTS_EDITED];
// edits.patch が触ってはいけない所(タブ・グループ・差分エディタ・Webview・カスタムエディタの枠、拡張 API、main のファイル、残す部品)
const FORBIDDEN_TOUCH = [
  /(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$/, /src\/vs\/workbench\/api\/common\//,
  /browser\/parts\/editor\/(editorGroupView|multiEditorTabsControl|multiRowEditorTabsControl|editorTabsControl|editorPart|editorGroupModel|editorParts|editorCommands|editorActions|titleControl|editorTabsControl|tabsTitleControl)\.ts$/,
  /src\/vs\/editor\/browser\/widget\/diffEditor\//, /src\/vs\/editor\/contrib\/diffEditorBreadcrumbs\//, /src\/vs\/editor\/contrib\/documentSymbols\//,
  /src\/vs\/base\/browser\/ui\/breadcrumbs\//, /platform\/theme\/browser\/defaultStyles\.ts$/, /contrib\/webview[^/]*\//, /contrib\/customEditor\//, /contrib\/update\//,
];
const PROTECTED_ROOTS = ['src/vs/base/browser/ui/breadcrumbs', 'src/vs/editor/contrib/documentSymbols', 'src/vs/editor/contrib/diffEditorBreadcrumbs', 'src/vs/editor/browser/widget/diffEditor',
  'src/vs/platform/theme/browser/defaultStyles.ts', `${P}editorGroupView.ts`, `${P}multiEditorTabsControl.ts`, `${P}multiRowEditorTabsControl.ts`, `${P}editorTabsControl.ts`, `${P}singleEditorTabsControl.ts`,
  `${P}editorHeaderControl.ts`, `${P}editorTitleControl.ts`, `${P}auxiliaryEditorPart.ts`, `${P}editorPart.ts`, `${W}contrib/webview`, `${W}contrib/webviewPanel`, `${W}contrib/customEditor`, `${W}contrib/outline`];

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-7: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0 && sections.length > 0);
});

test('C-7: edits.patch の件名が [PATCH] unit C-7-breadcrumbs-outline: edits、作者が shuko-apply <apply@shuko.invalid>', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-7-breadcrumbs-outline: edits$/m);
  assert.match(patchText, /^From: shuko-apply <apply@shuko\.invalid>$/m);
});

test('C-7: unit.json の id・stage・after（B-4・C-1・C-4 の3つ）。order は前提にした単位より後', { skip: noUnit }, () => {
  assert.equal(unit.id, ME);
  assert.equal(unit.stage, 'C');
  assert.deepEqual([...unit.after].sort(), ['B-4-outline-view', 'C-1-ai', 'C-4-notebook']);
  for (const a of unit.after) { const o = others.find((x) => x.id === a); assert.ok(o && o.unit.order < unit.order, `${a} の order が C-7 より前でない`); }
});

test('C-7: after の確かめ(5.1): --only から B-4・C-1・C-4 のどれを外しても計画が誤りを返す。全部あれば通る。C-2・C-3・C-5・C-6 は前提にしない', { skip: noUnit }, async () => {
  const { planUnits } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'apply', 'units.mjs')).href);
  const all = [...others.map((o) => o.unit), unit];
  const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions', 'A-5-remote-extensions', 'A-6-themes',
    'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share', 'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
  const a = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-4-notebook', ME] });
  assert.deepEqual(a.errors, []);
  assert.equal(a.plan.at(-1).id, ME);
  const b = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery', 'C-6-settings-sync', ME] });
  assert.deepEqual(b.errors, []);
  for (const drop of unit.after) {
    const r = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-4-notebook', ME].filter((x) => x !== drop) });
    assert.ok(r.errors.some((e) => new RegExp(`${ME}: after の単位 ${drop} が先に当たらない`).test(e)), `${drop} を外しても C-7 の誤りが出ない: ${JSON.stringify(r.errors)}`);
  }
});

test('C-7: delete は本家の消すファイル10。重複・kept との衝突が無い。残す部品(パンくずの部品・記号の木・差分エディタのパンくず・枠のファイル)を delete しない', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.equal(del.length, 10);
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
  assert.deepEqual(del.filter((d) => underAny(PROTECTED_ROOTS, d)), [], '残す部品を delete している');
  const clash = [];
  for (const k of unit.kept ?? []) {
    const kp = k.path.replace(/\/+$/, '');
    for (const d of del) { if (d === kp || kp.startsWith(d + '/') || d.startsWith(kp + '/')) clash.push(`${d} と kept ${kp}`); }
  }
  assert.deepEqual(clash, []);
  for (const must of [`${P}breadcrumbs.ts`, `${P}breadcrumbsControl.ts`, `${P}breadcrumbsModel.ts`, `${P}breadcrumbsPicker.ts`, `${P}media/breadcrumbscontrol.css`, `${W}services/outline`, `${W}contrib/codeEditor/browser/outline`]) assert.ok(del.includes(must), `delete に ${must} が無い`);
});

test('C-7: kept に base/browser/ui/breadcrumbs・defaultStyles.ts・editor/contrib/documentSymbols・タブの枠の CSS がある(理由つき)', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  for (const p of ['src/vs/base/browser/ui/breadcrumbs', 'src/vs/platform/theme/browser/defaultStyles.ts', 'src/vs/editor/contrib/documentSymbols', `${P}media/singleeditortabscontrol.css`]) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
});

test('C-7: delete・kept のパスが本家 1.146.0 にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-7: delete が、ほかの単位の delete と重なるのは after に挙げた単位とだけ', { skip: noUnit }, () => {
  const bad = [];
  for (const o of others) {
    if (unit.after.includes(o.id)) continue;
    for (const x of (o.unit.delete ?? []).map((d) => d.replace(/\/+$/, ''))) for (const d of (unit.delete ?? []).map((q) => q.replace(/\/+$/, ''))) if (d === x || d.startsWith(x + '/') || x.startsWith(d + '/')) bad.push(`${o.id}: ${x} と ${d}`);
  }
  assert.deepEqual(bad, []);
});

test('C-7: removeLines は workbench.common.main.ts の2行(outlineService・documentSymbolsOutline)。delete した部品の import で、重複が無く、ほかの main には触れない', { skip: noUnit }, () => {
  const rl = unit.removeLines ?? [];
  assert.equal(rl.length, 2);
  assert.deepEqual(rl.map((r) => r.file), [`${W}workbench.common.main.ts`, `${W}workbench.common.main.ts`]);
  const keys = rl.map((r) => r.line.trim());
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  const bad = [];
  for (const r of rl) {
    const imp = /^import\s+(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(r.line.trim());
    if (!imp) { bad.push(`${r.file}: ${r.line} (import でない)`); continue; }
    const target = posix.normalize(posix.join(posix.dirname(r.file), imp[1])).replace(/\.js$/, '.ts');
    if (!underAny(unit.delete ?? [], target)) bad.push(`${r.line} (${target} は delete に無い)`);
  }
  assert.deepEqual(bad, []);
});

test('C-7: removeLines の行が本家 1.146.0 にある', { skip: skipUp }, () => {
  const src = upShow(`${W}workbench.common.main.ts`);
  assert.deepEqual((unit.removeLines ?? []).filter((r) => !src.split('\n').some((l) => l.trim() === r.line.trim())).map((r) => r.line), []);
});

test('C-7: removeLines が、ほかの単位の removeLines・edits.patch が消す行と二重にならない。自分の edits.patch とも', { skip: noPatch }, () => {
  const bad = [];
  const mine = (unit.removeLines ?? []).map((r) => ({ f: r.file, l: r.line.trim() }));
  for (const o of others) {
    for (const r of o.unit.removeLines ?? []) if (mine.some((m) => m.f === r.file && m.l === r.line.trim())) bad.push(`${o.id} の removeLines と同じ: ${r.line.trim().slice(0, 80)}`);
    for (const s of o.sections) for (const l of s.removed) if (l.trim() && mine.some((m) => m.f === s.path && m.l === l.trim())) bad.push(`${o.id} の edits.patch が消す行と同じ: ${l.trim().slice(0, 80)}`);
  }
  for (const s of sections) for (const r of unit.removeLines ?? []) if (r.file === s.path && s.removed.some((l) => l.trim() === r.line.trim())) bad.push(`C-7 の edits.patch と removeLines が二重: ${r.line}`);
  assert.deepEqual(bad, []);
});

test('C-7: productRemove は空。依存も消さない', { skip: noUnit }, () => {
  assert.deepEqual(unit.productRemove ?? [], []);
  assert.deepEqual(unit.removeDependencies ?? {}, {});
});

// --- edits.patch の形 ---
test('C-7: edits.patch が触るファイルは10(枠の4・共有の型・記号へ移動・カスタムエディタの本体・テスト3)。新しいファイルも、消すファイルも無い', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path).sort(), [...EDITED].sort());
  assert.deepEqual(sections.filter((s) => s.isNew || s.isDelete).map((s) => s.path), []);
});

test('C-7: エディタの枠(browser/parts/editor)のうち触るのは決まった4ファイルだけ。タブ・グループ・差分エディタ・Webview・カスタムエディタのファイル、main、拡張 API、残す部品に触れない。delete したファイルも直さない', { skip: noPatch }, () => {
  const frame = sections.map((s) => s.path).filter((p) => p.startsWith(P));
  assert.deepEqual(frame.sort(), [...FRAME4].sort());
  assert.deepEqual(sections.filter((s) => FORBIDDEN_TOUCH.some((re) => re.test(s.path)) || underAny(unit.delete ?? [], s.path) || underAny((unit.kept ?? []).map((k) => k.path), s.path)).map((s) => s.path), []);
});

test('C-7: edits.patch の消す行は、パンくず・アウトラインの部品に限る。タブの枠の本体・グループ・記号へ移動の本体・カスタムエディタの登録・差分の語を消さない', { skip: noPatch }, () => {
  const bad = [];
  const PROTECT = [/workbench\.action\.gotoSymbol/, /getSymbolPicks/, /GotoSymbolAction/, /input\.navigation = navigation/, /registerCustomEditor/, /diffEditor/i, /EditorGroupView/, /MultiEditorTabsControl/, /Webview/i, /isCompositeEditor/];
  for (const s of sections) {
    if (/\.test\.ts$|\.fixture\.ts$/.test(s.path)) continue;
    for (const l of s.removed) for (const re of PROTECT) if (re.test(l)) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(bad, []);
  // 足す行は13行(import の整理と、パンくずを外した後の置き換え)。パンくず・アウトラインの語を足さない
  const added = sections.flatMap((s) => s.added);
  assert.equal(added.length, 13, `足す行が13でない(${added.length})`);
  assert.deepEqual(added.filter((l) => /readcrumb|Outline|outline/.test(l)), []);
});

test('C-7: 枠の4ファイルの直しは、パンくずを作る部分だけ: headerControl は入れ物・部品・幅の計算、titleControl は handleEditorsChange の呼び出し、singleEditorTabsControl は部品・印・更新、auxiliaryEditorPart は showBreadcrumbs: false', { skip: noPatch }, () => {
  const head = section('editorHeaderControl.ts');
  assert.ok(head.removed.some((l) => /BreadcrumbsControl/.test(l)) && head.removed.some((l) => /handleEditorsChange/.test(l)));
  const title = section('editorTitleControl.ts');
  assert.ok(title.removed.filter((l) => /handleEditorsChange/.test(l)).length >= 3, 'handleEditorsChange の呼び出し3か所が消えていない');
  const single = section('singleEditorTabsControl.ts');
  assert.ok(single.removed.some((l) => /BreadcrumbsControl|breadcrumbsControl/.test(l)) && single.removed.some((l) => /handleBreadcrumbsEnablementChange/.test(l)));
  const aux = section('auxiliaryEditorPart.ts');
  assert.ok(aux.removed.some((l) => /showBreadcrumbs: false/.test(l)));
  assert.deepEqual(aux.removed.filter((l) => !/showBreadcrumbs: false/.test(l) && l.trim()), [], 'auxiliaryEditorPart.ts で ほかの行を消している');
  const edt = section('common/editor.ts');
  assert.ok(edt.removed.length === 1 && /showBreadcrumbs/.test(edt.removed[0]), 'common/editor.ts は showBreadcrumbs の1行だけを消す');
});

test('C-7: 注入の直し: gotoSymbolQuickAccess.ts と mainThreadCustomEditors.ts は IOutlineService の注入を消し、記号へ移動の登録(GotoSymbolAction・getSymbolPicks)とカスタムエディタの記号の移動(input.navigation)は残る', { skip: noPatch }, () => {
  const g = section('gotoSymbolQuickAccess.ts');
  assert.ok(g.removed.some((l) => /@IOutlineService/.test(l)));
  assert.ok(g.removed.some((l) => /provideWithoutTextEditor/.test(l)) && g.removed.some((l) => /installNavigablePicks/.test(l)));
  const m = section('api/browser/mainThreadCustomEditors.ts');
  assert.ok(m.removed.some((l) => /@IOutlineService/.test(l)) && m.removed.filter((l) => /notifyOutlineChanged/.test(l)).length >= 2);
  assert.ok(!m.removed.some((l) => /navigation/.test(l)), 'navigation を消している');
  for (const t of ['mainThreadCustomEditors.test.ts', 'anythingQuickAccess.test.ts']) assert.ok(section(t).removed.some((l) => /IOutlineService|IBreadcrumbsService/.test(l)), `${t} の差し替えが消えていない`);
});

test('C-7: 独立(5.3): 10ファイルを、after に挙げない単位の edits.patch が触らない', { skip: noPatch }, () => {
  const bad = [];
  for (const o of others) for (const s of o.sections) if (EDITED.includes(s.path) && !unit.after.includes(o.id)) bad.push(`${o.id} の edits.patch が C-7 と同じファイル ${s.path} に触る`);
  assert.deepEqual(bad, []);
});

test('C-7: 前の単位(removeLines と after の単位の edits.patch)を本家に順に当てた後の形に、C-7 のハンクが全部当たる(C-1 は同じファイルを触るが、いつも C-1 の後に当たる)', { skip: skipUpPatch }, () => {
  const bad = [];
  const prior = others.filter((o) => o.unit.order < unit.order).sort((a, b) => a.unit.order - b.unit.order);
  for (const mine of sections) {
    let t = upShow(mine.path);
    if (t === null) { bad.push(`${mine.path} が本家に無い`); continue; }
    for (const o of prior) {
      for (const r of o.unit.removeLines ?? []) {
        if (r.file !== mine.path) continue;
        const ls = t.split('\n'); const i = ls.findIndex((l) => l.trim() === r.line.trim());
        if (i >= 0) { ls.splice(i, 1); t = ls.join('\n'); }
      }
      const s = o.sections.find((x) => x.path === mine.path);
      if (s) { const n = applyHunks(t, s.hunks); if (n === null) { if (unit.after.includes(o.id)) bad.push(`${o.id} のハンクが ${mine.path} に当たらない(前提の単位が自分の前に当たらない)`); } else t = n; }
    }
    if (applyHunks(t, mine.hunks) === null) bad.push(`C-7 のハンクが ${mine.path} に当たらない`);
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// 2. 型検査に掛からない注入の外し損ねの検査(期待は本家から読む)
// ---------------------------------------------------------------------------
// 消す部品が登録するサービスの ID: `registerSingleton(<ID>,` を、delete したパスの中から本家で探す
function registeredIds() {
  const rows = upGrepLines('registerSingleton\\(\\s*\\w+\\s*,', (unit.delete ?? []).map((d) => d.replace(/\/+$/, '')));
  return [...new Set(rows.map((r) => /registerSingleton\(\s*(\w+)\s*,/.exec(r.text)?.[1]).filter(Boolean))].sort();
}
/** ほかの単位が消す(delete)パス。C-7 の前に当たる単位と、同じ組に入りうる単位の分 */
const otherDeletes = () => others.flatMap((o) => (o.unit.delete ?? []));

test('C-7 注入: 消す部品が登録するサービスは IOutlineService と IBreadcrumbsService の2つ(本家から読む)', { skip: skipUp }, () => {
  assert.deepEqual(registeredIds(), ['IBreadcrumbsService', 'IOutlineService']);
});

test('C-7 注入: 消したサービスの ID を使う所は、edits.patch とほかの単位の消すもの(C-1・C-4・B-4)を当てた後、残らない(定義の delete の中と、試験用の資料・コメントを除く)。注入(@ID)も取得(.get(ID))も', { skip: skipUpPatch }, () => {
  const left = [];
  const del = unit.delete ?? [];
  const gone = otherDeletes();
  for (const id of registeredIds()) {
    for (const f of upGrepFiles(`\\b${id}\\b`, ['src/vs'])) {
      if (underAny(del, f) || underAny(gone, f)) continue;
      let t = upShow(f);
      const sec = sections.find((s) => s.path === f);
      if (sec) {
        const patched = applyHunks(t, sec.hunks);
        t = patched ?? t.split('\n').filter((l) => !sec.removed.includes(l)).concat(sec.added).join('\n');
      }
      // コメントの行は数えない
      const code = t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      if (new RegExp(`\\b${id}\\b`).test(code) && !/\.perf-data\.ts$/.test(f)) left.push(`${f} (${id})`);
    }
  }
  assert.deepEqual(left.sort(), [], '消したサービスを使う所が残る(起動時に UNKNOWN service になる)');
});

test('C-7 注入: 消したサービスにアウトラインを登録する側(registerOutlineCreator)は、本家で delete の中か、ほかの単位が消すファイルだけ(登録する側が残ると、サービスが無いので落ちる)', { skip: skipUp }, () => {
  const files = upGrepFiles('registerOutlineCreator', ['src/vs']).filter((f) => !underAny(unit.delete ?? [], f) && !underAny(otherDeletes(), f));
  assert.deepEqual(files, []);
});

test('C-7 注入: 消したコマンド・設定の登録は、本家の delete の中だけ(delete の外に残ると、空振りの checks になる/消えない)', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  assert.deepEqual([...(ck.absentCommands ?? [])].sort(), ['breadcrumbs.copyPath', 'breadcrumbs.focus', 'breadcrumbs.focusAndSelect', 'breadcrumbs.toggle']);
  assert.deepEqual([...(ck.absentSettings ?? [])].sort(), ['breadcrumbs.enabled', 'breadcrumbs.filePath', 'breadcrumbs.symbolPath']);
  assert.deepEqual(ck.absentViews ?? [], []);
  assert.deepEqual(ck.absentProcesses ?? [], []);
  assert.deepEqual(ck.absentHosts ?? [], []);
  const del = unit.delete ?? [];
  const bad = [];
  for (const c of ck.absentCommands) {
    const reg = upGrepLines(`id:\\s*'${c.replace(/\./g, '\\.')}'`, ['src/vs']);
    if (!reg.some((r) => underAny(del, r.file))) bad.push(`コマンド ${c}: 本家の登録が delete の中に無い`);
    for (const r of reg.filter((x) => !underAny(del, x.file))) bad.push(`コマンド ${c}: delete の外にも登録 ${r.file}:${r.line}`);
  }
  for (const s of ck.absentSettings) {
    const files = upGrepFiles(`'${s.replace(/\./g, '\\.')}'`, ['src/vs']).filter((f) => !underAny(del, f));
    // 設定の読み手(消す部品が読むもの)以外の定義は無い。読み手が残るなら、それは別の検査(@注入)で見えている
    const defs = files.filter((f) => /registerConfiguration|properties/.test(upShow(f) ?? '') && new RegExp(`'${s.replace(/\./g, '\\.')}'\\s*:`).test(upShow(f) ?? ''));
    if (defs.length) bad.push(`設定 ${s}: delete の外に定義 ${defs.join(',')}`);
  }
  assert.deepEqual(bad, []);
});

test('C-7: checks の項目が本家 1.146.0 にあり、absentStrings は本家の kept でないファイルに当たる(空振りしない)', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  assert.equal((ck.absentStrings ?? []).length, 11);
  const miss = [];
  const kept = (unit.kept ?? []).map((k) => k.path);
  for (const { in: where, text } of ck.absentStrings ?? []) {
    const files = upGrepFiles(text, where, ['-l', '-F']);
    if (!files.length) miss.push(`文字列 ${text} (${where.join(', ')}): 本家に無い`);
    else if (!files.some((f) => !underAny(kept, f))) miss.push(`文字列 ${text}: 当たりがすべて kept`);
  }
  assert.deepEqual(miss, []);
});

test('C-7: edits.patch が足す行に absentStrings の文字列が現れない(kept の対象を除く)', { skip: noPatch }, () => {
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

test('C-7: smoke に base・claude-code・absence がある(Claude Code の差分エディタとパネルを壊していないことを関門で見る)', { skip: noUnit }, () => {
  assert.deepEqual([...(unit.smoke ?? [])].sort(), ['absence', 'base', 'claude-code']);
});

// C-5-extension-gallery（拡張のギャラリー）の単位のファイルの静的な検査、何もしない実装の検査、画面からの導入が消えたことの検査、CLI の道に触れていないことの検査。
// 仕様: docs/01 の39・69行（拡張のインストールは CLI のみ。画面からの検索・追加は消す）、docs/04（install-extensions.mjs が CLI で VSIX を入れる）、
//       docs/03 の3節・4節（C-5 の行と末尾）・5.1・5.3・5.4・9節、docs/user-decisions.md の 2026-11-15（C-5 の edits.patch を作るときに出た点）、
//       removals/C-5-extension-gallery/README.md。
// 行数・sha・パッチの並びには頼らない: edits.patch はファイルごとの区画に分け、新しいファイルの本文は「+ の行」から読む。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-5 に固有の分だけ。
// 何もしない実装は、文字列と構文のほかに、型を外した本文を node で走らせて振る舞いも確かめる(import は模擬。C-2・C-4 と同じ)。
// Run: node --test tests/c5-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C5_UNIT_DIR: 単位のフォルダの代わり(tests/c5-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C5_UNIT_DIR ? resolve(process.env.AIED_C5_UNIT_DIR) : join(REPO, 'removals', 'C-5-extension-gallery');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-5-extension-gallery/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家を読む検査だけ飛ばす。
// AIED_C5_NO_UPSTREAM=1: 本家を読む検査を飛ばす(tests/c5-mutation.test.mjs が、本家を要さない壊し方を速く確かめるのに使う)
const UP_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = !process.env.AIED_C5_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
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
    s.context = all.filter((x) => x.k === ' ').map((x) => x.t);
  }
  return sections;
}
const patchText = noPatch ? '' : readFileSync(patchFile, 'utf8').replace(/\r\n/g, '\n');
const sections = parsePatch(patchText);
const section = (suffix) => sections.find((s) => s.path.endsWith(suffix));
const body = (suffix) => (section(suffix)?.added ?? []).join('\n');

// ほかの単位(removals/ の C-5 以外)
const others = [];
for (const d of readdirSync(join(REPO, 'removals'), { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === 'C-5-extension-gallery') continue;
  const uj = join(REPO, 'removals', d.name, 'unit.json');
  if (!existsSync(uj)) continue;
  const u = readJson(uj);
  const pf = u.patch ? join(REPO, 'removals', d.name, u.patch) : null;
  others.push({ id: u.id ?? d.name, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] });
}

const W = 'src/vs/workbench/';
const NOOP_GALLERY = `${W}services/extensionManagement/common/noopExtensionGalleryService.ts`;
const NULL_RECS = `${W}services/extensionRecommendations/common/nullExtensionRecommendations.ts`;
const GALLERY_COMMON = `${W}services/extensionManagement/common/extensionGalleryService.ts`;
const MANIFEST = `${W}services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`;
const EXT_CONTRIB = `${W}contrib/extensions/browser/extensions.contribution.ts`;
const EXT_CONTRIB_ELECTRON = `${W}contrib/extensions/electron-browser/extensions.contribution.ts`;
const VIEWLET = `${W}contrib/extensions/browser/extensionsViewlet.ts`;
const QUICK = `${W}contrib/extensions/browser/extensionsQuickAccess.ts`;
const SHARED = 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts';
const EDITED_FILES = [SHARED, EXT_CONTRIB, `${W}contrib/extensions/browser/extensionsActions.ts`, QUICK, VIEWLET, `${W}contrib/extensions/browser/extensionsViews.ts`,
  EXT_CONTRIB_ELECTRON, GALLERY_COMMON, NOOP_GALLERY, MANIFEST, NULL_RECS];
// CLI の --install-extension の道(code/node の CLI と、platform/extensionManagement の node 側・共通のギャラリー)
const CLI_FILES = ['src/vs/code/node/cliProcessMain.ts', 'src/vs/platform/extensionManagement/common/extensionManagementCLI.ts',
  'src/vs/platform/extensionManagement/common/extensionGalleryService.ts', 'src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts',
  'src/vs/platform/extensionManagement/node/extensionManagementService.ts'];
const underCliRoots = (p) => /^src\/vs\/platform\/extensionManagement\//.test(p) || /^src\/vs\/code\/node\//.test(p) || /^src\/vs\/platform\/environment\//.test(p);

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-5: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-5: edits.patch の件名が [PATCH] unit C-5-extension-gallery: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-5-extension-gallery: edits$/m);
});

test('C-5: edits.patch の作者が shuko-apply <apply@shuko.invalid>（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: shuko-apply <apply@shuko\.invalid>$/m);
});

test('C-5: unit.json の id・stage・after（C-1 だけ。C-2〜C-4 は前提にしない）。order は C-1 より後', { skip: noUnit }, () => {
  assert.equal(unit.id, 'C-5-extension-gallery');
  assert.equal(unit.stage, 'C');
  assert.deepEqual(unit.after, ['C-1-ai']);
  const c1 = others.find((x) => x.id === 'C-1-ai');
  assert.ok(c1 && c1.unit.order < unit.order);
});

test('C-5: after の確かめ(5.1): --only から C-1 を外すと計画が誤りを返す。C-1 だけで通る。C-2〜C-4 があっても通る', { skip: noUnit }, async () => {
  const { planUnits } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'apply', 'units.mjs')).href);
  const all = [...others.map((o) => o.unit), unit];
  const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions', 'A-5-remote-extensions', 'A-6-themes',
    'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share', 'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
  const a = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-5-extension-gallery'] });
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.plan.map((u) => u.id).slice(-2), ['C-1-ai', 'C-5-extension-gallery']);
  const b = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery'] });
  assert.deepEqual(b.errors, []);
  assert.deepEqual(b.plan.map((u) => u.id).slice(-5), ['C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery']);
  const noC1 = planUnits(all, { only: [...BASE, 'C-5-extension-gallery'] });
  assert.ok(noC1.errors.some((e) => /C-5-extension-gallery: after の単位 C-1-ai が先に当たらない/.test(e)), JSON.stringify(noC1.errors));
});

test('C-5: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い。delete に重複が無い。delete は20', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
  assert.equal(del.length, 20);
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

test('C-5: kept にワークベンチのマニフェストのサービス・おすすめの ID と型・platform のギャラリーの基底ほかがある（理由つき）。delete にマニフェストのテストがある', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  for (const p of [MANIFEST, `${W}services/extensionRecommendations/common/extensionRecommendations.ts`, 'src/vs/platform/extensionManagement/common/extensionGalleryService.ts',
    'src/vs/platform/extensionManagement/common/extensionTipsService.ts', 'src/vs/platform/extensionRecommendations', `${W}contrib/extensions/common/extensionsFileTemplate.ts`]) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
  assert.ok((unit.delete ?? []).includes(`${W}services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`));
  // おすすめのサービスの本体と、アカウント・tips は delete にある
  for (const p of [`${W}contrib/extensions/browser/extensionRecommendationsService.ts`, `${W}services/extensionManagement/common/extensionGalleryAccount.ts`,
    `${W}services/extensionManagement/electron-browser/extensionTipsService.ts`, 'src/vs/platform/extensionManagement/node/extensionTipsService.ts']) assert.ok((unit.delete ?? []).includes(p), `delete に ${p} が無い`);
});

test('C-5: delete したパスが本家 1.146.0 にある。kept のパスも本家にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-5: delete が、ほかの単位の delete と重ならない（C-1 は after なので除く）', { skip: noUnit }, () => {
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

test('C-5: removeLines の中に重複が無い。file が delete の中ではない。common 2・desktop 2・sharedProcessMain.ts 4 の8行。決まったファイルの行だけ', { skip: noUnit }, () => {
  const rl = unit.removeLines ?? [];
  const keys = rl.map((r) => `${r.file}\n${r.line.trim()}`);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  assert.deepEqual(rl.filter((r) => underAny(unit.delete ?? [], r.file)).map((r) => `${r.file}: ${r.line}`), []);
  const count = (re) => rl.filter((r) => re.test(r.file)).length;
  assert.equal(count(/workbench\.common\.main\.ts$/), 2);
  assert.equal(count(/workbench\.desktop\.main\.ts$/), 2);
  assert.equal(count(/sharedProcessMain\.ts$/), 4);
  assert.equal(rl.length, 8);
  assert.ok(!rl.some((r) => /workbench\.web\.main\.ts$|cliProcessMain\.ts$|platform\/extensionManagement\//.test(r.file)), 'web の main と CLI の道には触れない');
});

test('C-5: removeLines の各行が、delete したファイルの import か、その import が取り込んだ名前を使う登録の1行である', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  const lines = unit.removeLines ?? [];
  const bad = [];
  const declared = (file) => {
    const names = new Set();
    for (const r of lines.filter((x) => x.file === file)) {
      const t = r.line.trim();
      const im = /^import\s+\{([^}]*)\}\s+from\s+'/.exec(t);
      if (im) for (const n of im[1].split(',')) names.add(n.trim().split(/\s+as\s+/).pop());
      const cs = /^const\s+(\w+)\s*=/.exec(t);
      if (cs) names.add(cs[1]);
    }
    return names;
  };
  for (const r of lines) {
    const t = r.line.trim();
    const where = `${r.file}: ${t}`;
    const imp = /^(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(t);
    if (imp) {
      if (!imp[1].startsWith('.')) { bad.push(`${where} (相対でない import)`); continue; }
      const target = posix.normalize(posix.join(posix.dirname(r.file), imp[1])).replace(/\.js$/, '.ts');
      if (!underAny(del, target)) bad.push(`${where} (${target} は delete に無い)`);
      continue;
    }
    const names = [...declared(r.file)];
    if (!names.some((n) => new RegExp(`\\b${n}\\b`).test(t))) bad.push(`${where} (消す import・宣言の名前を使っていない)`);
  }
  assert.deepEqual(bad, []);
});

test('C-5: removeLines の行が本家 1.146.0 のそのファイルにある（行の書き換えに気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const r of unit.removeLines ?? []) {
    const src = upShow(r.file);
    if (src === null) { bad.push(`${r.file} が本家に無い`); continue; }
    if (!src.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file}: ${r.line}`);
  }
  assert.deepEqual(bad, []);
});

test('C-5: removeLines が、ほかの単位の removeLines と同じ行を二重に消さない。ほかの単位の edits.patch が消す行とも重ならない。edits.patch と removeLines も二重にならない', { skip: noPatch }, () => {
  const bad = [];
  const mine = (unit.removeLines ?? []).map((r) => ({ f: r.file, l: r.line.trim() }));
  for (const o of others) {
    for (const r of o.unit.removeLines ?? []) if (mine.some((m) => m.f === r.file && m.l === r.line.trim())) bad.push(`${o.id} の removeLines と同じ: ${r.file}: ${r.line.trim().slice(0, 80)}`);
    for (const s of o.sections) for (const l of s.removed) if (l.trim() && mine.some((m) => m.f === s.path && m.l === l.trim())) bad.push(`${o.id} の edits.patch が消す行と同じ: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  for (const s of sections) {
    const my = (unit.removeLines ?? []).filter((r) => r.file === s.path).map((r) => r.line.trim());
    for (const l of s.removed) if (l.trim() && my.includes(l.trim())) bad.push(`C-5 の edits.patch と removeLines が二重: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-5: productRemove は空', { skip: noUnit }, () => {
  assert.deepEqual(unit.productRemove ?? [], []);
});

// --- edits.patch の形 ---
test('C-5: edits.patch が触るファイルは README の表の11ファイルだけ(新しいファイルは noopExtensionGalleryService.ts と nullExtensionRecommendations.ts の2つ)。ファイルは消さない', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path).sort(), [...EDITED_FILES].sort());
  assert.deepEqual(sections.filter((s) => s.isNew).map((s) => s.path).sort(), [NOOP_GALLERY, NULL_RECS].sort());
  assert.deepEqual(sections.filter((s) => s.isDelete).map((s) => s.path), []);
  for (const p of [NOOP_GALLERY, NULL_RECS]) assert.equal(section(p.split('/').pop()).removed.length, 0);
});

test('C-5: edits.patch が main のファイル・cliProcessMain.ts・platform/extensionManagement・code/node・environment に触れない。delete したファイルも直さない（5.3）', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const bad = sections.filter((s) => !s.isNew && (/(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$/.test(s.path) || underCliRoots(s.path) || underAny(del, s.path))).map((s) => s.path);
  assert.deepEqual(bad, []);
});

test('C-5: edits.patch の sharedProcessMain.ts のハンクは import の2行の書き換えだけ(IExtensionTipsService・ExtensionTipsChannel を外す)', { skip: noPatch }, () => {
  const s = section('sharedProcess/sharedProcessMain.ts');
  assert.ok(s);
  assert.equal(s.hunks.length, 1);
  assert.equal(s.removed.length, 2);
  assert.equal(s.added.length, 2);
  assert.ok(s.removed.every((l) => /^import /.test(l)) && s.added.every((l) => /^import /.test(l)));
  assert.ok(s.removed.some((l) => /IExtensionTipsService/.test(l)) && !s.added.some((l) => /IExtensionTipsService/.test(l)));
  assert.ok(s.removed.some((l) => /ExtensionTipsChannel/.test(l)) && !s.added.some((l) => /ExtensionTipsChannel/.test(l)));
  // 残す: ギャラリー・拡張の管理のチャンネル・おすすめの通知のクライアント
  assert.ok(s.added.some((l) => /IExtensionGalleryService/.test(l)) && s.added.some((l) => /ExtensionManagementChannel/.test(l)));
});

test('C-5: C-3・C-4 など、after に挙げない単位の edits.patch・removeLines に触れない。文脈が重ならない（独立）', { skip: noPatch }, () => {
  const heavy = (l) => l.trim().length >= 24 && !/^(?:readonly\s+)?[\w$]+\??: [\w<>[\]|.,\s]+;$/.test(l.trim());
  const bad = [];
  for (const o of others) {
    if (unit.after.includes(o.id)) continue;
    for (const mine of sections) {
      if (mine.isNew) continue;
      const theirs = o.sections.find((x) => x.path === mine.path && !x.isNew);
      if (!theirs) continue;
      const tr = new Set(theirs.removed.filter(heavy).map((l) => l.trim()));
      const mr = new Set(mine.removed.filter(heavy).map((l) => l.trim()));
      for (const l of mine.old) if (heavy(l) && tr.has(l.trim())) bad.push(`${o.id} ${mine.path}: ${l.trim().slice(0, 80)}`);
      for (const l of theirs.old) if (heavy(l) && mr.has(l.trim())) bad.push(`${o.id} ${mine.path}: (逆) ${l.trim().slice(0, 80)}`);
    }
    for (const r of o.unit.removeLines ?? []) if (sections.some((s) => s.path === r.file && !s.isNew && s.old.some((l) => l.trim() === r.line.trim()))) bad.push(`${o.id} の removeLines の行が C-5 の文脈にある: ${r.line.trim().slice(0, 80)}`);
  }
  // C-2〜C-4 の edits.patch とは、同じファイルに触れない
  for (const o of others) if (/^C-[2-4]/.test(o.id)) for (const s of o.sections) if (sections.some((m) => m.path === s.path)) bad.push(`${o.id} の edits.patch が C-5 と同じファイル ${s.path} に触る`);
  assert.deepEqual(bad, []);
});

// --- CLI の --install-extension の道 ---
test('C-5 CLI: unit.json の delete・removeLines・edits.patch は CLI の道(cliProcessMain.ts・extensionManagementCLI・platform の基底)に触れない。platform/extensionManagement は tips の1ファイルを delete するだけ', { skip: noPatch }, () => {
  const touched = [...(unit.delete ?? []), ...(unit.removeLines ?? []).map((r) => r.file), ...sections.map((s) => s.path)];
  const hit = touched.filter((p) => CLI_FILES.includes(p) || /extensionManagementCLI|cliProcessMain|extensionManagementService\.ts$|extensionGalleryManifest(Service)?\.ts$/.test(p) && underCliRoots(p));
  assert.deepEqual(hit, []);
  const underPlatformEm = touched.filter((p) => /^src\/vs\/platform\/extensionManagement\//.test(p));
  assert.deepEqual([...new Set(underPlatformEm)], ['src/vs/platform/extensionManagement/node/extensionTipsService.ts'], 'platform/extensionManagement で触れるのは tips の delete だけ');
  assert.ok((unit.kept ?? []).some((k) => k.path === 'src/vs/platform/extensionManagement/common/extensionGalleryService.ts'));
  assert.ok(!sections.some((s) => /^src\/vs\/platform\//.test(s.path)), 'platform の edits.patch は無い');
});

test('C-5 CLI: 本家の CLI の道(cliProcessMain.ts ほか)は、delete・edits.patch が消す tips・アカウント・おすすめのどれも import していない。自分でギャラリーとマニフェストを組む', { skip: skipUp }, () => {
  const names = (unit.delete ?? []).filter((d) => d.endsWith('.ts')).map((d) => posix.basename(d, '.ts'));
  const bad = [];
  for (const f of CLI_FILES) {
    const t = upShow(f);
    if (t === null) { bad.push(`${f} が本家に無い`); continue; }
    for (const n of names) if (new RegExp(`/${n}\\.js'`).test(t)) bad.push(`${f} が消す部品 ${n} を import している`);
  }
  assert.deepEqual(bad, []);
  const cli = upShow('src/vs/code/node/cliProcessMain.ts');
  assert.match(cli, /services\.set\(IExtensionGalleryManifestService, new SyncDescriptor\(ExtensionGalleryManifestService\)\);/);
  assert.match(cli, /services\.set\(IExtensionGalleryService, new SyncDescriptor\(ExtensionGalleryServiceWithNoStorageService/);
  assert.match(cli, /platform\/extensionManagement\/common\/extensionGalleryManifestService\.js'/, 'CLI は platform の ExtensionGalleryManifestService を使う(ワークベンチ側でない)');
  assert.ok(!/services\/extensionManagement\//.test(cli), 'CLI がワークベンチのサービスを使っていない');
});

test('C-5 CLI: install-extensions.mjs が CLI の --install-extension <vsix> --force で入れる(docs/04)。edits.patch はワークベンチのギャラリーだけを差し替える', { skip: noPatch }, () => {
  const ie = readFileSync(join(REPO, 'scripts', 'install-extensions.mjs'), 'utf8');
  assert.match(ie, /"--install-extension", it\.file, "--force"/);
  // 差し替えるのはワークベンチ側のギャラリーの登録だけ
  const s = section('services/extensionManagement/common/extensionGalleryService.ts');
  assert.ok(s.added.some((l) => /registerSingleton\(IExtensionGalleryService, NoopExtensionGalleryService, InstantiationType\.Delayed\);/.test(l)));
  assert.ok(s.removed.some((l) => /class WorkbenchExtensionGalleryService extends AbstractExtensionGalleryService/.test(l)));
  assert.ok(!s.added.some((l) => /AbstractExtensionGalleryService/.test(l)));
});

// --- 画面からの導入が消えたことの検査 ---
test('C-5 画面の導入: 右クリックのメニュー(エクスプローラーの .vsix)を外し、内部のコマンド installFromVSIX の登録は残す(menu だけを外す)', { skip: noPatch }, () => {
  const s = section('contrib/extensions/browser/extensions.contribution.ts');
  assert.ok(s.removed.some((l) => /id: MenuId\.ExplorerContext,/.test(l)), 'ExplorerContext のメニューを外していない');
  assert.ok(s.removed.some((l) => /ResourceContextKey\.Extension\.isEqualTo\('\.vsix'\)/.test(l)));
  assert.ok(!s.added.some((l) => /ExplorerContext|isEqualTo\('\.vsix'\)|ResourceContextKey/.test(l)), '右クリックのメニューを足している');
  // コマンドの登録(id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID)は文脈に残り、消えていない
  assert.ok(s.context.some((l) => /^\t\t\tid: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,$/.test(l)), 'installFromVSIX の登録が文脈に無い(消えた)');
  assert.ok(!s.removed.some((l) => /^\t\t\tid: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,$/.test(l)), 'installFromVSIX の登録を消している');
  assert.ok(s.context.some((l) => /title: localize\('installVSIX', "Install Extension VSIX"\),/.test(l)));
  // 「VSIX からインストール」(ファイルを選ぶ画面)は消えている
  assert.ok(s.removed.some((l) => /id: SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID,/.test(l)));
  assert.ok(s.removed.some((l) => /showOpenDialog\(/.test(l)));
});

test('C-5 画面の導入: ドロップ(拡張のビューへの VSIX のドロップ)を外す。DragAndDropObserver・isSupportedDragElement・extractEditorsAndFilesDropData を消し、足さない', { skip: noPatch }, () => {
  const s = section('contrib/extensions/browser/extensionsViewlet.ts');
  assert.ok(s.removed.some((l) => /new DragAndDropObserver\(this\.root,/.test(l)));
  assert.ok(s.removed.some((l) => /private isSupportedDragElement\(/.test(l)));
  assert.ok(s.removed.some((l) => /extractEditorsAndFilesDropData/.test(l)));
  assert.ok(s.removed.some((l) => /INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID/.test(l)), '拡張のビューからの installFromVSIX の呼び出しを外していない');
  assert.ok(!s.added.some((l) => /DragAndDropObserver|isSupportedDragElement|extractEditorsAndFilesDropData|INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID/.test(l)));
  // 重ねの表示(.overlay)を消す
  assert.ok(s.removed.some((l) => /overlay/.test(l)));
});

test('C-5 画面の導入: `ext install ` の Quick Access を外す(クラス InstallExtensionQuickAccessProvider・PREFIX・登録)。`ext ` で拡張のビューを開く ManageExtensionsQuickAccessProvider は残す', { skip: noPatch }, () => {
  const q = section('contrib/extensions/browser/extensionsQuickAccess.ts');
  assert.ok(q.removed.some((l) => /export class InstallExtensionQuickAccessProvider/.test(l)));
  assert.ok(q.removed.some((l) => /static PREFIX = 'ext install ';/.test(l)));
  assert.ok(!q.removed.some((l) => /ManageExtensionsQuickAccessProvider/.test(l)), '`ext ` の Quick Access を消している');
  assert.ok(q.context.some((l) => /export class ManageExtensionsQuickAccessProvider/.test(l)));
  assert.ok(!q.added.some((l) => !/^\s*\/\//.test(l) && /ext install|InstallExtensionQuickAccessProvider/.test(l)), '導入の Quick Access を足している');
  const c = section('contrib/extensions/browser/extensions.contribution.ts');
  assert.ok(c.removed.some((l) => /registerQuickAccessProvider\(\): void/.test(l)));
  assert.ok(c.removed.some((l) => /this\.registerQuickAccessProvider\(\);/.test(l)));
  // 登録の中の InstallExtensionQuickAccessProvider の参照を消し、`ext ` の登録 (ManageExtensionsQuickAccessProvider) は残す
  assert.ok(c.removed.some((l) => /InstallExtensionQuickAccessProvider/.test(l)));
  assert.ok(!c.removed.some((l) => /ManageExtensionsQuickAccessProvider\b.*ctor|ManageExtensionsQuickAccessProvider\.PREFIX/.test(l)));
  assert.ok(!c.added.some((l) => /InstallExtensionQuickAccessProvider/.test(l)));
});

test('C-5 画面の導入: 本家で消す対象が実在し、残すコマンド installFromVSIX は拡張の API のコマンドとして本家にある', { skip: skipUpPatch }, () => {
  const ec = upShow('src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts');
  assert.match(ec, /id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,/);
  assert.match(ec, /ResourceContextKey\.Extension\.isEqualTo\('\.vsix'\)/);
  const vl = upShow('src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts');
  assert.match(vl, /new DragAndDropObserver\(this\.root,/);
  assert.match(vl, /extractEditorsAndFilesDropData/);
  const qa = upShow('src/vs/workbench/contrib/extensions/browser/extensionsQuickAccess.ts');
  assert.match(qa, /static PREFIX = 'ext install ';/);
  assert.match(qa, /static PREFIX = 'ext ';/, '`ext ` の Quick Access が本家に無い(残すものの根拠)');
  assert.ok(!underAny(unit.delete ?? [], 'src/vs/workbench/contrib/extensions/common/extensions.ts'));
});

// --- 検索・おすすめ・ギャラリーのコマンドとビュー ---
test('C-5: おすすめ・ギャラリーのビューとコマンドを外す(popular・recommended・marketplace・サインインのコマンド、ビュー6つ)。入っている拡張の一覧・有効と無効・動作中の拡張は消さない', { skip: noPatch }, () => {
  const c = section('contrib/extensions/browser/extensions.contribution.ts');
  for (const id of ['workbench.extensions.action.showPopularExtensions', 'workbench.extensions.action.showRecommendedExtensions', 'workbench.extensions.action.installWorkspaceRecommendedExtensions',
    'workbench.extensions.action.ignoreRecommendation', 'workbench.extensions.actions.gallery.signIn']) {
    assert.ok(c.removed.some((l) => l.includes(`id: '${id}'`)), `${id} の登録を消していない`);
  }
  const act = section('contrib/extensions/browser/extensionsActions.ts');
  assert.ok(act.removed.some((l) => /class AbstractConfigureRecommendedExtensionsAction/.test(l)), '.vscode/extensions.json を編集するおすすめの操作のクラスを消していない');
  // 消してはいけない: 動作中の拡張・有効と無効・入っている拡張の一覧の登録は、消す行に無い
  const protectedIds = ['workbench.extensions.action.showRuntimeExtensions', 'workbench.extensions.action.showEnabledExtensions', 'workbench.extensions.action.showInstalledExtensions',
    'workbench.extensions.action.showDisabledExtensions', 'workbench.extensions.action.showBuiltInExtensions', 'workbench.extensions.action.disableAll', 'workbench.extensions.action.enableAll'];
  for (const id of protectedIds) assert.ok(!c.removed.some((l) => l.includes(`id: '${id}'`)), `${id} の登録を消している(残すもの)`);
  const v = section('contrib/extensions/browser/extensionsViewlet.ts');
  for (const id of ['workbench.views.extensions.marketplace', 'workbench.views.extensions.popular', 'workbench.views.extensions.marketplaceAccess']) {
    assert.ok(v.removed.some((l) => l.includes(id)) || v.removed.some((l) => /MarketplaceAccess|PopularExtensions|SearchMarketplace/i.test(l)), `${id} のビューを外していない`);
  }
  // 入っている拡張のビューの名前は、import の行の書き換えで消す行に出るが、足す行にも残る(足し直す)。クラスの宣言・使い所の行は消さない
  for (const n of ['ServerInstalledExtensionsView', 'EnabledExtensionsView', 'DisabledExtensionsView', 'OutdatedExtensionsView']) {
    assert.ok(!v.removed.some((l) => new RegExp(`\\b${n}\\b`).test(l) && !/^import /.test(l.trim())), `${n} の宣言か使い所を消している`);
    assert.ok(v.removed.every((l) => !new RegExp(`\\b${n}\\b`).test(l)) || v.added.some((l) => new RegExp(`\\b${n}\\b`).test(l)), `${n} の import を足し直していない`);
  }
  const views = section('contrib/extensions/browser/extensionsViews.ts');
  assert.ok(!views.removed.some((l) => /export class (ServerInstalledExtensionsView|EnabledExtensionsView|DisabledExtensionsView|OutdatedExtensionsView)\b/.test(l)), '入っている拡張のビューのクラスを消している');
});

// --- checks ---
test('C-5: checks の項目が、本家 1.146.0 にある（元から無いものを「無いこと」で守らない）。absentStrings は本家の kept でないファイルに当たる（C-2 で足した見張りの形）', { skip: skipUp }, () => {
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

test('C-5: checks の数(コマンド17・ビュー6・設定2・文字列19)と、画面の導入を守る文字列4つ。プロセスと接続先は空', { skip: noUnit }, () => {
  const ck = unit.checks ?? {};
  assert.equal((ck.absentCommands ?? []).length, 17);
  assert.equal((ck.absentViews ?? []).length, 6);
  assert.equal((ck.absentSettings ?? []).length, 2);
  assert.equal((ck.absentStrings ?? []).length, 19);
  const has = (text) => (ck.absentStrings ?? []).some((s) => s.text === text && s.in.includes('src/vs/workbench/contrib/extensions'));
  for (const t of ['InstallExtensionQuickAccessProvider', "'ext install '", "isEqualTo('.vsix')", 'extractEditorsAndFilesDropData']) assert.ok(has(t), `absentStrings に ${t} が無い`);
  assert.ok(!(ck.absentCommands ?? []).includes('workbench.extensions.command.installFromVSIX'), '残すコマンド installFromVSIX を「無いこと」にしている');
  assert.deepEqual(ck.absentProcesses ?? [], []);
  assert.deepEqual(ck.absentHosts ?? [], []);
  assert.ok((unit.smoke ?? []).includes('claude-code') && (unit.smoke ?? []).includes('absence'));
});

test('C-5: edits.patch が足す行に absentStrings の文字列が現れない（kept の対象を除く。当てた後の検査で自分が落ちない）', { skip: noPatch }, () => {
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
// 2. 何もしない実装の検査（文字列と構文）
// ---------------------------------------------------------------------------
const galleryText = noPatch ? '' : body('noopExtensionGalleryService.ts');
const recsText = noPatch ? '' : body('nullExtensionRecommendations.ts');
const noGallery = noPatch || (galleryText ? false : '実装なし: noopExtensionGalleryService.ts の本文が無い');
const noRecs = noPatch || (recsText ? false : '実装なし: nullExtensionRecommendations.ts の本文が無い');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// 本家の interface のメンバー名(1タブの行)
function interfaceMembers(src, name) {
  const m = new RegExp(`export interface ${name}\\b[^{]*\\{`).exec(src);
  if (!m) return null;
  let depth = 0; let end = -1;
  for (let i = m.index + m[0].length - 1; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
  const blockText = src.slice(m.index + m[0].length, end);
  return [...new Set([...blockText.matchAll(/^\t(?:readonly\s+)?(\w+)\s*[(<:?]/gm)].map((x) => x[1]).filter((n) => n !== '_serviceBrand'))];
}
const classHasMember = (text, cls, n) => {
  const m = new RegExp(`export class ${cls}\\b[^{]*\\{`).exec(text);
  if (!m) return false;
  const rest = text.slice(m.index);
  return new RegExp(`^\\t(?:readonly\\s+|async\\s+)?${n}\\b`, 'm').test(rest);
};

test('C-5 何もしない実装: NoopExtensionGalleryService は IExtensionGalleryService を実装し、本家の interface のメンバーが全部ある', { skip: noGallery }, () => {
  assert.match(galleryText, /export class NoopExtensionGalleryService implements IExtensionGalleryService/);
  const names = ['isEnabled', 'query', 'getExtensions', 'isExtensionCompatible', 'getCompatibleExtension', 'getAllCompatibleVersions', 'getAllVersions', 'download',
    'downloadSignatureArchive', 'reportStatistic', 'getReadme', 'getManifest', 'getChangelog', 'getCoreTranslation', 'getExtensionsControlManifest'];
  for (const n of names) assert.ok(classHasMember(galleryText, 'NoopExtensionGalleryService', n), `${n} が無い`);
  if (upOk) {
    const src = upShow('src/vs/platform/extensionManagement/common/extensionManagement.ts');
    const members = interfaceMembers(src, 'IExtensionGalleryService');
    assert.ok(members && members.length >= 10, '本家の IExtensionGalleryService が読めない');
    assert.deepEqual(members.filter((n) => !classHasMember(galleryText, 'NoopExtensionGalleryService', n)), [], '本家の interface のメンバーが足りない');
  }
});

test('C-5 何もしない実装: isEnabled は false、query は空の1ページ、getExtensions は [] で解決(誤りを投げない)。download・getReadme・getChangelog は reject、reportStatistic は何もしない', { skip: noGallery }, () => {
  assert.match(galleryText, /isEnabled\(\): boolean \{\s*return false;\s*\}/);
  assert.match(galleryText, /return singlePagePager<IGalleryExtension>\(\[\]\);/);
  assert.match(galleryText, /async getExtensions\(\): Promise<IGalleryExtension\[\]> \{\s*return \[\];\s*\}/);
  for (const n of ['download', 'downloadSignatureArchive', 'getReadme', 'getChangelog']) {
    assert.match(galleryText, new RegExp(`async ${n}\\([^)]*\\)[^{]*\\{\\s*throw new Error\\(galleryUnavailable\\);\\s*\\}`), `${n} が誤りを投げない`);
  }
  assert.match(galleryText, /const galleryUnavailable = 'The extension gallery is not available in this build';/);
  assert.match(galleryText, /async reportStatistic\([^)]*\)[^{]*\{\s*\/\/ nothing is reported\s*\}/);
});

test('C-5 何もしない実装: ギャラリーは通信しない(IRequestService・IConfigurationService・IStorageService・fetch・XMLHttpRequest・タイマー・DI・プロセスを持たない。constructor が無い)', { skip: noGallery }, () => {
  const c = code(galleryText);
  for (const re of [/\bIRequestService\b/, /\bIConfigurationService\b/, /\bIStorageService\b/, /\bITelemetryService\b/, /\bIFileService\b/, /\bIProductService\b/, /\bIExtensionGalleryManifestService\b/,
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\brequestService\b/, /\.request\(/, /\bsetTimeout\b/, /\bsetInterval\b/, /child_process/, /\bnew Emitter\b/, /\bconsole\./, /@I[A-Z]\w+/,
    /\bconstructor\s*\(/, /\bawait\b/, /\bAbstractExtensionGalleryService\b/, /https?:\/\//]) {
    assert.ok(!re.test(c), `使ってはいけないもの: ${re}`);
  }
  const specs = [...galleryText.matchAll(/^import\b[^;]*?\bfrom\s+'([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(specs, ['../../../../base/common/cancellation.js', '../../../../base/common/paging.js', '../../../../base/common/uri.js',
    '../../../../platform/extensionManagement/common/extensionManagement.js', '../../../../platform/extensions/common/extensions.js'].sort());
});

test('C-5 何もしない実装: ワークベンチのギャラリーの登録は NoopExtensionGalleryService に替わり、元の AbstractExtensionGalleryService を継ぐクラスは残らない', { skip: noPatch }, () => {
  const s = section('services/extensionManagement/common/extensionGalleryService.ts');
  assert.deepEqual(s.added.filter((l) => /^registerSingleton\(/.test(l)), ['registerSingleton(IExtensionGalleryService, NoopExtensionGalleryService, InstantiationType.Delayed);']);
  assert.ok(s.removed.some((l) => /registerSingleton\(IExtensionGalleryService, WorkbenchExtensionGalleryService/.test(l)));
  assert.ok(!s.added.some((l) => /WorkbenchExtensionGalleryService|AbstractExtensionGalleryService|IRequestService/.test(l)));
});

test('C-5 何もしない実装: おすすめの3つのサービスは本家の interface のメンバーが全部あり、空・無視・何も促さない。ID は残る extensionRecommendations.ts のもの', { skip: noRecs }, () => {
  for (const [cls, iface] of [['NullExtensionRecommendationsService', 'IExtensionRecommendationsService'], ['NullExtensionIgnoredRecommendationsService', 'IExtensionIgnoredRecommendationsService'],
    ['NullExtensionRecommendationNotificationService', 'IExtensionRecommendationNotificationService']]) {
    assert.match(recsText, new RegExp(`export class ${cls} implements ${iface}\\b`));
  }
  assert.match(recsText, /from '\.\/extensionRecommendations\.js'/);
  assert.match(recsText, /readonly onDidChangeRecommendations = Event\.None;/);
  assert.match(recsText, /getAllRecommendationsWithReason\(\)[^{]*\{\s*return \{\};\s*\}/);
  assert.match(recsText, /readonly globalIgnoredRecommendations: string\[\] = \[\];/);
  assert.match(recsText, /hasToIgnoreRecommendationNotifications\(\): boolean \{\s*return true;\s*\}/);
  assert.match(recsText, /return RecommendationsNotificationResult\.Ignored;/);
  if (upOk) {
    const mine = upShow(`${W}services/extensionRecommendations/common/extensionRecommendations.ts`);
    const plat = upShow('src/vs/platform/extensionRecommendations/common/extensionRecommendations.ts');
    for (const [src, cls, iface] of [[mine, 'NullExtensionRecommendationsService', 'IExtensionRecommendationsService'], [mine, 'NullExtensionIgnoredRecommendationsService', 'IExtensionIgnoredRecommendationsService'],
      [plat, 'NullExtensionRecommendationNotificationService', 'IExtensionRecommendationNotificationService']]) {
      const members = interfaceMembers(src ?? '', iface);
      assert.ok(members && members.length >= 1, `${iface} が本家に読めない`);
      assert.deepEqual(members.filter((n) => !classHasMember(recsText, cls, n)), [], `${cls}: 本家の interface のメンバーが足りない`);
    }
  }
});

test('C-5 何もしない実装: おすすめは通信も保存も持たない(import は event・uri・collections・おすすめの型だけ)', { skip: noRecs }, () => {
  const c = code(recsText);
  for (const re of [/\bIRequestService\b/, /\bIStorageService\b/, /\bIConfigurationService\b/, /\bINotificationService\b/, /\bfetch\s*\(/, /\bsetTimeout\b/, /@I[A-Z]\w+/, /\bconstructor\s*\(/, /\bnew Emitter\b/, /\bconsole\./]) {
    assert.ok(!re.test(c), `使ってはいけないもの: ${re}`);
  }
  const specs = [...recsText.matchAll(/^import\b[^;]*?\bfrom\s+'([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(specs, ['../../../../base/common/collections.js', '../../../../base/common/event.js', '../../../../base/common/uri.js',
    '../../../../platform/extensionRecommendations/common/extensionRecommendations.js', './extensionRecommendations.js'].sort());
});

test('C-5 何もしない実装: browser の extensions.contribution.ts が3つの Null を registerSingleton で登録し、electron-browser の登録は tips の通知のチャンネルを登録しない', { skip: noPatch }, () => {
  const c = section('contrib/extensions/browser/extensions.contribution.ts');
  for (const [id, impl] of [['IExtensionRecommendationNotificationService', 'NullExtensionRecommendationNotificationService'], ['IExtensionRecommendationsService', 'NullExtensionRecommendationsService'],
    ['IExtensionIgnoredRecommendationsService', 'NullExtensionIgnoredRecommendationsService']]) {
    assert.ok(c.added.some((l) => l.trim() === `registerSingleton(${id}, ${impl}, InstantiationType.Delayed);`), `${id} を ${impl} で登録していない`);
  }
  assert.ok(c.added.some((l) => /nullExtensionRecommendations\.js'/.test(l)));
  const e = section('contrib/extensions/electron-browser/extensions.contribution.ts');
  assert.ok(e.removed.some((l) => /registerChannel\('extensionRecommendationNotification'/.test(l)));
  assert.ok(!e.added.some((l) => /registerChannel|ISharedProcessService/.test(l)));
});

test('C-5 何もしない実装: マニフェストのサービスは、アカウントと私設のマーケットプレイスの取得だけを外し、共有プロセスへ送る所と製品の既定は残す', { skip: noPatch }, () => {
  const s = section('electron-browser/extensionGalleryManifestService.ts');
  for (const n of ['IExtensionGalleryAccountService', 'IRequestService', 'ExtensionGalleryServiceUrlConfigKey', 'resolveMarketplaceHeaders', 'handleMarketplaceAccountAccess', 'getExtensionGalleryManifestFromServiceUrl', 'requestRestart']) {
    assert.ok(s.removed.some((l) => l.includes(n)), `${n} を外していない`);
    assert.ok(!s.added.some((l) => l.includes(n)), `${n} を足している`);
  }
  assert.ok(s.added.some((l) => /const defaultExtensionGalleryManifest = await super\.getExtensionGalleryManifest\(\);/.test(l)));
  assert.ok(s.added.some((l) => /this\.update\(defaultExtensionGalleryManifest\);/.test(l)));
  assert.ok(s.context.some((l) => /sharedProcessService\.getChannel\('extensionGalleryManifest'\)/.test(l)), '共有プロセスへ送る所が文脈に無い(消えた)');
  assert.ok(s.context.some((l) => /registerSingleton\(IExtensionGalleryManifestService, WorkbenchExtensionGalleryManifestService, InstantiationType\.Eager\);/.test(l)));
});

// ---------------------------------------------------------------------------
// 3. 何もしない実装を走らせる（型を外した本文を node で。import は模擬）
// ---------------------------------------------------------------------------
const strip = nodeModule.stripTypeScriptTypes;
const noRun = (t) => (noPatch || !t ? '実装なし' : (typeof strip === 'function' ? false : 'node に module.stripTypeScriptTypes が無い'));
const None = () => ({ dispose() { } });
function loadClasses(text, names, stubs) {
  const src = text.replace(/^import .*$/gm, '').replace(/^export (class|function|interface) /gm, '$1 ');
  const js = strip(src, { mode: 'strip' });
  const keys = Object.keys(stubs);
  return new Function(...keys, `${js}\nreturn { ${names.join(', ')} };`)(...keys.map((k) => stubs[k]));
}
const loadGallery = () => loadClasses(galleryText, ['NoopExtensionGalleryService'], {
  singlePagePager: (elements) => ({ firstPage: elements, total: elements.length, pageSize: elements.length, getPage: async () => elements }),
}).NoopExtensionGalleryService;
const loadRecs = () => loadClasses(recsText, ['NullExtensionRecommendationsService', 'NullExtensionIgnoredRecommendationsService', 'NullExtensionRecommendationNotificationService'], {
  Event: { None }, RecommendationsNotificationResult: { Ignored: 'ignored', Accepted: 'accepted' },
});

test('C-5 何もしない実装(走らせる): NoopExtensionGalleryService は isEnabled が偽、query は空の1ページ、getExtensions は [] で解決する(2つの呼び方)。通信の口(fetch)を呼ばない', { skip: noRun(galleryText) }, async () => {
  const Gallery = loadGallery();
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('通信した'); };
  try {
    const g = new Gallery();
    assert.equal(g.isEnabled(), false);
    const page = await g.query({ text: 'x' }, {});
    assert.deepEqual([page.firstPage, page.total], [[], 0]);
    assert.deepEqual(await g.getExtensions([{ id: 'a.b' }], {}), []);
    assert.deepEqual(await g.getExtensions([{ id: 'a.b' }], { compatible: true }, {}), []);
    assert.deepEqual(await g.getExtensions([], {}), []);
    assert.equal(await g.isExtensionCompatible({}, false, 'win32-x64'), false);
    assert.equal(await g.getCompatibleExtension({}, false, 'win32-x64'), null);
    assert.deepEqual(await g.getAllCompatibleVersions({ id: 'a.b' }, false, 'win32-x64'), []);
    assert.deepEqual(await g.getAllVersions({ id: 'a.b' }), []);
    assert.equal(await g.getManifest({}, {}), null);
    assert.equal(await g.getCoreTranslation({}, 'ja'), null);
    assert.equal(await g.reportStatistic('a', 'b', '1.0.0', 'install'), undefined);
    assert.deepEqual(await g.getExtensionsControlManifest(), { malicious: [], deprecated: {}, search: [], autoUpdate: {} });
  } finally { globalThis.fetch = realFetch; }
});

test('C-5 何もしない実装(走らせる): download・downloadSignatureArchive・getReadme・getChangelog は reject する(同じ文言)', { skip: noRun(galleryText) }, async () => {
  const g = new (loadGallery())();
  await assert.rejects(g.download({}, {}, 'install'), /The extension gallery is not available in this build/);
  await assert.rejects(g.downloadSignatureArchive({}, {}), /not available/);
  await assert.rejects(g.getReadme({}, {}), /not available/);
  await assert.rejects(g.getChangelog({}, {}), /not available/);
});

test('C-5 何もしない実装(走らせる): 状態を持たない(何度呼んでも同じ。インスタンスごとに別。getExtensions の戻りは呼ぶたびに別の配列)', { skip: noRun(galleryText) }, async () => {
  const Gallery = loadGallery();
  const a = new Gallery(); const b = new Gallery();
  assert.notEqual(a, b);
  const x = await a.getExtensions([{ id: 'a.b' }], {}); x.push('汚す');
  assert.deepEqual(await a.getExtensions([{ id: 'a.b' }], {}), []);
  assert.deepEqual(Object.keys(a), [], 'インスタンスの持ち物が無い');
});

test('C-5 何もしない実装(走らせる): おすすめ — getAllRecommendationsWithReason は {}、各 get*Recommendations は []、getExe/ConfigBased は { important: [], others: [] }、getWorkspaceRecommendations は [] で resolve する', { skip: noRun(recsText) }, async () => {
  const { NullExtensionRecommendationsService: R } = loadRecs();
  const r = new R();
  assert.equal(r.onDidChangeRecommendations, None);
  assert.deepEqual(r.getAllRecommendationsWithReason(), {});
  assert.deepEqual(await r.getImportantRecommendations(), []);
  assert.deepEqual(await r.getOtherRecommendations(), []);
  assert.deepEqual(r.getFileBasedRecommendations(), []);
  assert.deepEqual(await r.getExeBasedRecommendations('git'), { important: [], others: [] });
  assert.deepEqual(await r.getConfigBasedRecommendations(), { important: [], others: [] });
  assert.deepEqual(await r.getWorkspaceRecommendations(), []);
  assert.deepEqual([r.getKeymapRecommendations(), r.getLanguageRecommendations(), r.getRemoteRecommendations()], [[], [], []]);
});

test('C-5 何もしない実装(走らせる): 無視されたおすすめは [] で、toggleGlobalIgnoredRecommendation の後も []。通知は無視すると答え、促すと "ignored" で resolve する', { skip: noRun(recsText) }, async () => {
  const { NullExtensionIgnoredRecommendationsService: I, NullExtensionRecommendationNotificationService: N } = loadRecs();
  const i = new I();
  assert.deepEqual(i.globalIgnoredRecommendations, []);
  assert.deepEqual(i.ignoredRecommendations, []);
  assert.equal(i.toggleGlobalIgnoredRecommendation('a.b', true), undefined);
  assert.deepEqual(i.globalIgnoredRecommendations, []);
  assert.equal(i.onDidChangeIgnoredRecommendations, None);
  assert.equal(i.onDidChangeGlobalIgnoredRecommendation, None);
  const n = new N();
  assert.equal(n.hasToIgnoreRecommendationNotifications(), true);
  assert.equal(await n.promptImportantExtensionsInstallNotification({ extensions: ['a.b'] }), 'ignored');
  assert.equal(await n.promptWorkspaceRecommendations(['a.b']), undefined);
  assert.deepEqual(n.ignoredRecommendations, []);
});

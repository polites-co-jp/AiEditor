// C-3-remote（リモート）の単位のファイルの静的な検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節（unit.json）・4節（C-3 の行と末尾の箇条書き）・5.1（after の確かめ）・5.3・5.4・9節、
//       docs/user-decisions.md の 2026-11-15（C-3 の edits.patch を作るときに出た点）、removals/C-3-remote/README.md。
// 行数・sha・パッチの並びには頼らない: edits.patch はファイルごとの区画に分ける。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-3 に固有の分だけ。
// 何もしない実装は無い(edits.patch は import の1行と定数の1つだけ)。
// Run: node --test tests/c3-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C3_UNIT_DIR: 単位のフォルダの代わり(tests/c3-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C3_UNIT_DIR ? resolve(process.env.AIED_C3_UNIT_DIR) : join(REPO, 'removals', 'C-3-remote');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-3-remote/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家を読む検査だけ飛ばす。
// AIED_C3_NO_UPSTREAM=1: 本家を読む検査を飛ばす(tests/c3-mutation.test.mjs が、本家を要さない壊し方を速く確かめるのに使う)
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = !process.env.AIED_C3_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
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
const patchText = noPatch ? '' : readFileSync(patchFile, 'utf8').replace(/\r\n/g, '\n');
const sections = parsePatch(patchText);

// ほかの単位(removals/ の C-3 以外)
const others = [];
for (const d of readdirSync(join(REPO, 'removals'), { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === 'C-3-remote') continue;
  const uj = join(REPO, 'removals', d.name, 'unit.json');
  if (!existsSync(uj)) continue;
  const u = readJson(uj);
  const pf = u.patch ? join(REPO, 'removals', d.name, u.patch) : null;
  others.push({ id: u.id ?? d.name, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] });
}

const VIEWS = 'src/vs/workbench/api/browser/viewsExtensionPoint.ts';
const IMPORT_LINE = "import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';";
const CONST_LINE = "const REMOTE = 'workbench.view.remote';";
const REMOTE_EXPLORER = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';

// ---------------------------------------------------------------------------
// 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-3: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-3: edits.patch の件名が [PATCH] unit C-3-remote: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-3-remote: edits$/m);
});

test('C-3: edits.patch の作者が sukuna-apply <apply@sukuna.invalid>（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: sukuna-apply <apply@sukuna\.invalid>$/m);
});

test('C-3: unit.json の id・stage・after（A-5 と C-1。C-2 は前提にしない）。order は前提にした単位より後', { skip: noUnit }, () => {
  assert.equal(unit.id, 'C-3-remote');
  assert.equal(unit.stage, 'C');
  assert.deepEqual([...unit.after].sort(), ['A-5-remote-extensions', 'C-1-ai']);
  assert.ok(!unit.after.includes('C-2-debug'), 'C-2 を前提にしている（C-3 は C-2 なしでも当たる）');
  for (const id of unit.after) {
    const o = others.find((x) => x.id === id);
    assert.ok(o, `after の単位 ${id} の unit.json が無い`);
    assert.ok(o.unit.order < unit.order, `after の ${id} の order(${o.unit.order}) が C-3 の ${unit.order} より後`);
  }
});

test('C-3: after の確かめ(5.1): --only から C-1 を外すと計画が誤りを返す。C-1 があれば通る。C-2 は無くても通る', { skip: noUnit }, async () => {
  const { planUnits } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'apply', 'units.mjs')).href);
  const all = [...others.map((o) => o.unit), unit];
  const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions', 'A-5-remote-extensions', 'A-6-themes',
    'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share', 'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
  const ok = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-3-remote'] });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.plan.map((u) => u.id).slice(-2), ['C-1-ai', 'C-3-remote']);
  const withC2 = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-3-remote'] });
  assert.deepEqual(withC2.errors, []);
  assert.deepEqual(withC2.plan.map((u) => u.id).slice(-3), ['C-1-ai', 'C-2-debug', 'C-3-remote']);
  const noC1 = planUnits(all, { only: [...BASE, 'C-3-remote'] });
  assert.ok(noC1.errors.some((e) => /C-3-remote: after の単位 C-1-ai が先に当たらない/.test(e)), JSON.stringify(noC1.errors));
  const noA5 = planUnits(all, { only: [...BASE.filter((x) => x !== 'A-5-remote-extensions'), 'C-1-ai', 'C-3-remote'] });
  assert.ok(noA5.errors.some((e) => /C-3-remote: after の単位 A-5-remote-extensions が先に当たらない/.test(e)), JSON.stringify(noA5.errors));
});

test('C-3: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
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

test('C-3: delete の中に重複が無い。delete は contrib/remote・contrib/remoteTunnel・platform/remoteTunnel・build/gulpfile.reh.ts の4つ', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
  assert.deepEqual([...del].sort(), ['build/gulpfile.reh.ts', 'src/vs/platform/remoteTunnel', 'src/vs/workbench/contrib/remote', 'src/vs/workbench/contrib/remoteTunnel']);
});

test('C-3: kept に Claude Code の受け手の土台（services/tunnel・services/remote・platform/remote・platform/tunnel）と、拡張 API の入口がある（理由つき）', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  for (const p of ['src/vs/workbench/services/tunnel', 'src/vs/workbench/services/remote', 'src/vs/platform/remote', 'src/vs/platform/tunnel',
    'src/vs/workbench/api/browser/mainThreadTunnelService.ts', 'remote', 'src/vs/server']) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
  assert.match(kept.get('src/vs/workbench/services/tunnel'), /Webview/, 'services/tunnel の理由に Webview（Claude Code のパネル）が無い');
});

test('C-3: delete したパスが本家 1.146.0 にある。kept のパスも本家にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-3: delete が、ほかの単位の delete と重ならない（上にも下にも）', { skip: noUnit }, () => {
  const bad = [];
  for (const o of others) {
    const od = (o.unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
    for (const d of (unit.delete ?? []).map((x) => x.replace(/\/+$/, ''))) {
      for (const x of od) if (d === x || d.startsWith(x + '/') || x.startsWith(d + '/')) bad.push(`${o.id}: ${x} と ${d}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('C-3: removeLines の中に重複が無い。file が delete の中ではない', { skip: noUnit }, () => {
  const keys = (unit.removeLines ?? []).map((r) => `${r.file}\n${r.line.trim()}`);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  const del = unit.delete ?? [];
  assert.deepEqual((unit.removeLines ?? []).filter((r) => underAny(del, r.file)).map((r) => `${r.file}: ${r.line}`), []);
});

test('C-3: removeLines の各行が、delete したファイルの import か、その import が取り込んだ名前を使う登録の1行である', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  const lines = unit.removeLines ?? [];
  const bad = [];
  // 同じファイルの、消す import が取り込んだ名前と、消す `const x =` が宣言した名前
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

test('C-3: removeLines の行が本家 1.146.0 のそのファイルにある（行の書き換えに気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const r of unit.removeLines ?? []) {
    const src = upShow(r.file);
    if (src === null) { bad.push(`${r.file} が本家に無い`); continue; }
    if (!src.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file}: ${r.line}`);
  }
  assert.deepEqual(bad, []);
});

test('C-3: removeLines の main のファイルは common 2・desktop 3・web 1、sharedProcessMain.ts 7（README と docs/03 の表のとおり）', { skip: noUnit }, () => {
  const count = (re) => (unit.removeLines ?? []).filter((r) => re.test(r.file)).length;
  assert.equal(count(/workbench\.common\.main\.ts$/), 2);
  assert.equal(count(/workbench\.desktop\.main\.ts$/), 3);
  assert.equal(count(/workbench\.web\.main\.ts$/), 1);
  assert.equal(count(/sharedProcessMain\.ts$/), 7);
  assert.equal((unit.removeLines ?? []).length, 13);
});

test('C-3: removeLines が、残す部品（services/tunnel・platform/remote・platform/tunnel・services/remote）の import や登録を消さない', { skip: noUnit }, () => {
  const keep = /services\/tunnel|platform\/remote\/|platform\/tunnel|services\/remote|ITunnelService|ISharedProcessTunnelService|IRemoteAgentService|IRemoteExplorerService/;
  assert.deepEqual((unit.removeLines ?? []).filter((r) => keep.test(r.line)).map((r) => `${r.file}: ${r.line}`), []);
});

test('C-3: removeLines が、ほかの単位の removeLines と同じ行を二重に消さない。ほかの単位の edits.patch が消す行とも重ならない', { skip: noUnit }, () => {
  const bad = [];
  const mine = (unit.removeLines ?? []).map((r) => ({ f: r.file, l: r.line.trim() }));
  for (const o of others) {
    for (const r of o.unit.removeLines ?? []) if (mine.some((m) => m.f === r.file && m.l === r.line.trim())) bad.push(`${o.id} の removeLines と同じ: ${r.file}: ${r.line.trim().slice(0, 80)}`);
    for (const s of o.sections) for (const l of s.removed) if (l.trim() && mine.some((m) => m.f === s.path && m.l === l.trim())) bad.push(`${o.id} の edits.patch が消す行と同じ: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-3: productRemove の9つのキーが本家の product.json にある。ほかの単位の productRemove と重ならない', { skip: noUnit }, () => {
  assert.deepEqual([...(unit.productRemove ?? [])].sort(), ['serverApplicationName', 'serverDataFolderName', 'serverGreeting', 'serverLicense', 'serverLicensePrompt',
    'serverLicenseUrl', 'tunnelApplicationName', 'win32TunnelMutex', 'win32TunnelServiceMutex']);
  const bad = [];
  for (const o of others) for (const k of o.unit.productRemove ?? []) if ((unit.productRemove ?? []).includes(k)) bad.push(`${o.id} も ${k} を消す`);
  assert.deepEqual(bad, []);
});

test('C-3: productRemove のキーが、本家 1.146.0 の product.json の最上位にある（無いキーを消しても何も起きない）', { skip: skipUp }, () => {
  const src = upShow('product.json');
  assert.ok(src, '本家の product.json が読めない');
  const missing = (unit.productRemove ?? []).filter((k) => !new RegExp(`^\\t"${k}"\\s*:`, 'm').test(src));
  assert.deepEqual(missing, []);
});

// --- edits.patch ---
test('C-3: edits.patch が触るファイルは viewsExtensionPoint.ts の1つだけ。新しいファイルも、消すファイルも無い', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path), [VIEWS]);
  assert.equal(sections[0].isNew, false);
  assert.equal(sections[0].isDelete, false);
  assert.equal(sections[0].hunks.length, 1);
});

test('C-3: edits.patch は main のファイル・sharedProcessMain.ts・extHost.api.impl.ts・extHost.protocol.ts に触れない（5.3）。delete したファイルも直さない', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const bad = sections.filter((s) => /(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$|sharedProcessMain\.ts$|extHost\.api\.impl\.ts$|extHost\.protocol\.ts$/.test(s.path) || underAny(del, s.path)).map((s) => s.path);
  assert.deepEqual(bad, []);
});

test('C-3: edits.patch の直しは、remoteExplorer.js の import の1行を消し、同じ値の定数 const REMOTE を1つ置く（足すのは定数とコメントだけ）', { skip: noPatch }, () => {
  const s = sections[0];
  assert.deepEqual(s.removed, [IMPORT_LINE]);
  assert.equal(s.added.filter((l) => l.trim() === CONST_LINE).length, 1, `${CONST_LINE} がちょうど1行でない`);
  const other = s.added.filter((l) => l.trim() !== CONST_LINE && l.trim() !== '' && !l.trim().startsWith('//'));
  assert.deepEqual(other, [], '定数とコメント以外を足している');
  assert.ok(s.added.some((l) => /^\/\/ Sukuna \(C-3-remote\)/.test(l)), '// Sukuna (C-3-remote) のコメントが無い');
});

test('C-3: 置いた定数の値が、本家 remoteExplorer.ts の VIEWLET_ID と同じ。消す import は本家にあり、REMOTE は本家で3か所以上使われる', { skip: skipUpPatch }, () => {
  const re = upShow(REMOTE_EXPLORER);
  assert.ok(re, '本家に remoteExplorer.ts が無い');
  const id = /export const VIEWLET_ID = '([^']+)';/.exec(re)?.[1];
  assert.ok(id, '本家の VIEWLET_ID が読めない');
  const placed = /^const REMOTE = '([^']+)';$/.exec(sections[0].added.map((l) => l.trim()).find((l) => /^const REMOTE =/.test(l)) ?? '')?.[1];
  assert.equal(placed, id, `定数の値 ${placed} が本家の VIEWLET_ID ${id} と違う`);
  const views = upShow(VIEWS);
  assert.ok(views.split('\n').some((l) => l === IMPORT_LINE), '消す import の行が本家の viewsExtensionPoint.ts に無い');
  assert.ok([...views.matchAll(/\bREMOTE\b/g)].length >= 4, 'REMOTE の使い所が少ない（import の1つ + 使う3か所）');
});

test('C-3: edits.patch が足す行の import に contrib/remote/ が無い（コメントを除く）。absentStrings の文字列も足さない', { skip: noPatch }, () => {
  const code = sections[0].added.filter((l) => !l.trim().startsWith('//'));
  assert.deepEqual(code.filter((l) => /contrib\/remote/.test(l)), []);
  const bad = [];
  for (const { in: where, text: t } of unit.checks?.absentStrings ?? []) {
    for (const s of sections) {
      if (!underAny(where, s.path)) continue;
      const hit = s.added.find((l) => l.includes(t));
      if (hit) bad.push(`${t} が ${s.path} の足す行にある: ${hit.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('C-3: C-3 の edits.patch が触るファイルを、ほかの単位の edits.patch が触らない。ほかの単位の removeLines も触らない（5.3）', { skip: noPatch }, () => {
  const mine = new Set(sections.map((s) => s.path));
  const bad = [];
  for (const o of others) {
    for (const s of o.sections) if (mine.has(s.path)) bad.push(`${o.id} の edits.patch が ${s.path} に触る`);
    for (const r of o.unit.removeLines ?? []) if (mine.has(r.file)) bad.push(`${o.id} の removeLines が ${r.file} に触る`);
  }
  assert.deepEqual(bad, []);
});

// --- checks ---
test('C-3: checks の項目が、本家 1.146.0 にある（元から無いものを「無いこと」で守らない）', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  const miss = [];
  for (const c of ck.absentCommands ?? []) if (!upGrep(c, ['src/vs'])) miss.push(`コマンド ${c}`);
  for (const v of ck.absentViews ?? []) if (!upGrep(v, ['src/vs'])) miss.push(`ビュー ${v}`);
  // 設定のキーは、定数の連結で組み立てる所がある(例 'remote.tunnels.access' + '.preventSleep')。全体の文字列が無ければ、前の部分と後ろの部分の両方を探す
  for (const s of ck.absentSettings ?? []) {
    if (upGrep(s, ['src/vs'])) continue;
    const cut = s.lastIndexOf('.');
    if (cut > 0 && upGrep(`'${s.slice(0, cut)}'`, ['src/vs']) && upGrep(`'${s.slice(cut)}'`, ['src/vs'])) continue;
    miss.push(`設定 ${s}`);
  }
  for (const { in: where, text } of ck.absentStrings ?? []) if (!upGrep(text, where)) miss.push(`文字列 ${text} (${where.join(', ')})`);
  assert.deepEqual(miss, []);
});

test('C-3: absentStrings の各項目は、本家の kept でないファイルに当たる（kept だけに当たる文字列は、検査から外れていて何も守らない）', { skip: skipUp }, () => {
  const kept = (unit.kept ?? []).map((k) => k.path);
  const dead = [];
  for (const { in: where, text } of unit.checks?.absentStrings ?? []) {
    const r = spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-l', '-e', text, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const files = (r.stdout ?? '').split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
    if (!files.some((f) => !underAny(kept, f))) dead.push(`${text} (${where.join(', ')}): 当たり ${files.length} 件、すべて kept`);
  }
  assert.deepEqual(dead, []);
});

test('C-3: checks は README の項目(コマンド4・ビュー2・設定4・文字列10)で、プロセスと接続先は空', { skip: noUnit }, () => {
  const ck = unit.checks ?? {};
  assert.equal((ck.absentCommands ?? []).length, 4);
  assert.equal((ck.absentViews ?? []).length, 2);
  assert.equal((ck.absentSettings ?? []).length, 4);
  assert.equal((ck.absentStrings ?? []).length, 10);
  assert.deepEqual(ck.absentProcesses ?? [], []);
  assert.deepEqual(ck.absentHosts ?? [], []);
  assert.ok((ck.absentStrings ?? []).some((s) => s.text === "remote/browser/remoteExplorer.js'"), 'viewsExtensionPoint.ts の import を守る文字列が無い');
});

test('C-3: smoke に claude-code がある（Claude Code の受け手を壊していないことを関門で見る）', { skip: noUnit }, () => {
  assert.ok((unit.smoke ?? []).includes('claude-code'));
  assert.ok((unit.smoke ?? []).includes('absence'));
});

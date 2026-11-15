// C-2-debug（デバッガ）の単位のファイルの静的な検査と、何もしない実装の検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節（unit.json）・4節（段階 C の表と末尾の箇条書き）・5.1・5.3（2026-11-15 に足した2つの例外）・5.4・9節、
//       docs/user-decisions.md の 2026-11-14（C-2 の案A）と 2026-11-15（C-2 の edits.patch を作るときに出た点）、
//       removals/C-2-debug/README.md の「消すもの」「残すもの」「edits.patch で直した点」。
// 行数・sha・パッチの並びには頼らない: edits.patch はファイルごとの区画に分け、新しいファイルの本文は「+ の行」から読む。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-2 に固有の分だけ。
// 何もしない実装は、文字列と構文で確かめるほかに、型を外した本文を node で走らせて振る舞いも確かめる
//   （import は模擬に差し替える。node に module.stripTypeScriptTypes が無ければ、その検査だけ飛ばす）。
// VS Code のテストの仕組みで走らせる形は tests/removals/c2-gate-script.md に書く（実行は大岡越前守）。
// Run: node --test tests/c2-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareMemberGates, memberGatesOf } from './gate-members.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C2_UNIT_DIR: 単位のフォルダの代わり(tests/c2-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C2_UNIT_DIR ? resolve(process.env.AIED_C2_UNIT_DIR) : join(REPO, 'removals', 'C-2-debug');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-2-debug/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家の実在を見る検査だけ飛ばす。
const UP_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
// AIED_C2_NO_UPSTREAM=1: 本家を読む検査を飛ばす(tests/c2-mutation.test.mjs が、本家を要さない壊し方を速く確かめるのに使う)
const upOk = !process.env.AIED_C2_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const skipUpPatch = noPatch || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const upHas = (p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p.replace(/\/+$/, '')}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upGrep = (text, where) => spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-q', '-e', text, UP_TAG, '--', ...where]).status === 0;
const upList = (dir) => (spawnSync('git', ['-C', UP_REPO, 'ls-tree', '--name-only', `${UP_TAG}:${dir}`], { encoding: 'utf8' }).stdout ?? '').split('\n').filter(Boolean);

const underAny = (list, p) => list.some((d) => {
  const dd = d.replace(/\/+$/, '');
  return p === dd || p.startsWith(dd + '/');
});

// ---------------------------------------------------------------------------
// patch を、ファイルごとの区画に分ける（ハンクの並びも残す）
// ---------------------------------------------------------------------------
function parsePatch(text) {
  const sections = []; // { path, isNew, isDelete, hunks: [[{k, t}]], added, removed, old }
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
const section = (suffix) => sections.find((s) => s.path.endsWith(suffix));
const body = (suffix) => (section(suffix)?.added ?? []).join('\n');

const NEW_API = 'src/vs/workbench/api/common/extHostRemovedApi.debug.ts';
const API_IMPL = 'src/vs/workbench/api/common/extHost.api.impl.ts';
const PROTOCOL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const REPL_CONTRIB = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const COMMON_MAIN = 'src/vs/workbench/workbench.common.main.ts';
const SERVICE_CONTRIB = 'src/vs/workbench/contrib/debug/browser/debug.service.contribution.ts';
const EDITED_FILES = [API_IMPL, PROTOCOL, NEW_API, SERVICE_CONTRIB,
  'src/vs/workbench/contrib/notebook/browser/controller/editActions.ts',
  'src/vs/workbench/contrib/notebook/browser/notebook.contribution.ts',
  REPL_CONTRIB, COMMON_MAIN];
const SERVICE_IMPORT = "import './contrib/debug/browser/debug.service.contribution.js';";

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-2: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-2: edits.patch の件名が [PATCH] unit C-2-debug: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-2-debug: edits$/m);
});

test('C-2: edits.patch の作者が shuko-apply <apply@shuko.invalid>（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: shuko-apply <apply@shuko\.invalid>$/m);
});

test('C-2: unit.json の id・stage・after（A-3 だけ。C-1 を前提にしない）', { skip: noUnit }, () => {
  assert.equal(unit.id, 'C-2-debug');
  assert.equal(unit.stage, 'C');
  assert.deepEqual(unit.after, ['A-3-debug-extensions']);
});

test('C-2: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い', { skip: noUnit }, () => {
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

test('C-2: delete の中に重複が無い', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
});

test('C-2: contrib/debug/common と platform/debug は、中のどれも delete しない（common はまとめて残す）', { skip: noUnit }, () => {
  const bad = (unit.delete ?? []).filter((d) => underAny(['src/vs/workbench/contrib/debug/common', 'src/vs/platform/debug'], d.replace(/\/+$/, '')));
  assert.deepEqual(bad, []);
  const kept = (unit.kept ?? []).map((k) => k.path);
  assert.ok(kept.includes('src/vs/workbench/contrib/debug/common'));
  assert.ok(kept.includes('src/vs/platform/debug'));
});

test('C-2: kept に、拡張ホストの起動・テストの呼び出し履歴・Null のサービスの登録・保留にした部品がある（理由つき）', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  const base = 'src/vs/workbench/contrib/debug/';
  for (const p of [`${base}browser/debug.service.contribution.ts`, `${base}browser/extensionHostDebugService.ts`, `${base}electron-browser/extensionHostDebugService.ts`,
    `${base}browser/callStackWidget.ts`, `${base}browser/callStackEditorContribution.ts`, `${base}browser/debugIcons.ts`, `${base}browser/debugColors.ts`,
    `${base}browser/media/callStackWidget.css`, `${base}browser/media/callStackEditorContribution.css`,
    'src/vs/platform/telemetry/node/customEndpointTelemetryService.ts']) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
});

test('C-2: delete したパスが本家 1.146.0 にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
});

test('C-2: kept のパスが本家 1.146.0 にある', { skip: skipUp }, () => {
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-2: removeLines の中に重複が無い', { skip: noUnit }, () => {
  const keys = (unit.removeLines ?? []).map((r) => `${r.file}\n${r.line.trim()}`);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
});

test('C-2: removeLines の file が、delete したファイルの中ではない（消えるファイルの行を消そうとしない）', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  assert.deepEqual((unit.removeLines ?? []).filter((r) => underAny(del, r.file)).map((r) => `${r.file}: ${r.line}`), []);
});

test('C-2: removeLines の各行が、delete したファイルの import か登録の1行（または決めた例外）である', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  const kept = (unit.kept ?? []).map((k) => k.path);
  const lines = unit.removeLines ?? [];
  // 例外: 残る部品への import だが、使い手が消えて使われなくなる行（README の「edits.patch で直した点」）
  const EXCEPT = [
    [PROTOCOL, 'src/vs/workbench/contrib/debug/common/debug.js'],
    [REPL_CONTRIB, 'src/vs/workbench/contrib/debug/common/debug.js'],
    [COMMON_MAIN, 'src/vs/workbench/contrib/debug/browser/callStackEditorContribution.js'], // 登録を読む行だけが消え、ファイルは callStackWidget.ts から読まれて残る
  ];
  const bad = [];
  for (const r of lines) {
    const line = r.line.trim();
    const where = `${r.file}: ${line}`;
    const imp = /^(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(line);
    if (imp) {
      if (!imp[1].startsWith('.')) { bad.push(`${where} (相対でない import)`); continue; }
      const noExt = posix.normalize(posix.join(posix.dirname(r.file), imp[1]));
      const target = noExt.replace(/\.js$/, '.ts');
      if (underAny(del, target)) continue;
      const ex = EXCEPT.find(([f, t]) => f === r.file && t === noExt);
      if (ex) { if (!underAny(kept, target)) bad.push(`${where} (例外の ${target} が kept に無い)`); continue; }
      bad.push(`${where} (${target} は delete に無い)`);
      continue;
    }
    // proxy の ID の行: 消す Shape のものだけ（Shape の定義は edits.patch が消す）
    const proxy = /^(\w+): createProxyIdentifier<(\w+)>\('(\w+)'\),$/.exec(line);
    if (proxy) {
      const [, key, shape, id] = proxy;
      if (key !== id) bad.push(`${where} (キーと ID の名前が違う)`);
      const shapeRemoved = section(PROTOCOL)?.removed.some((l) => new RegExp(`^export interface ${shape}\\b`).test(l.trim()));
      if (!shapeRemoved) bad.push(`${where} (${shape} を edits.patch が消していない。ID だけ消すと Shape が宙に浮く)`);
      continue;
    }
    // registerSingleton(...) / registerWorkbenchContribution(X, ...) の登録: 引数の名前が、同じファイルの消す import で取り込まれている
    const reg = /\bregister\w*\((.*)\)\)?;?$/.exec(line);
    if (reg) {
      const names = [...reg[1].matchAll(/\b([A-Z][A-Za-z0-9_]+)\b/g)].map((m) => m[1])
        .filter((n) => !['InstantiationType', 'WorkbenchPhase', 'LifecyclePhase', 'Delayed', 'Eager', 'AfterRestored', 'Eventually', 'ID'].includes(n));
      const importsHere = lines.filter((x) => x.file === r.file && /^(?:import|export)\b/.test(x.line.trim())).map((x) => x.line);
      if (names.length === 0 || !names.some((n) => importsHere.some((il) => new RegExp(`\\b${n}\\b`).test(il)))) bad.push(`${where} (登録の名前がどの消す import にも無い)`);
      continue;
    }
    // ビルドの一覧の中の、消す場所への参照 'vs/workbench/contrib/debug/...'
    const ref = /^'(vs\/[A-Za-z0-9_./*-]+)',?$/.exec(line);
    if (ref) {
      const p = 'src/' + ref[1];
      if (p.includes('*')) {
        // glob: 一致するファイルがすべて delete の中にある（本家が読めるときだけ。読めなければ別の検査で見る）
        const dir = p.slice(0, p.lastIndexOf('/'));
        if (!underAny(del, dir) && !del.some((d) => d.startsWith(dir + '/'))) bad.push(`${where} (${dir} の下に delete が無い)`);
      } else if (!underAny(del, p) && !underAny(del, p + '.ts')) bad.push(`${where} (${p} は delete に無い)`);
      continue;
    }
    bad.push(`${where} (import でも登録でも消す場所への参照でもない)`);
  }
  assert.deepEqual(bad, []);
});

test('C-2: removeLines の行が本家 1.146.0 のそのファイルにある（行の書き換えに気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const r of unit.removeLines ?? []) {
    const src = upShow(r.file);
    if (src === null) { bad.push(`${r.file} が本家に無い`); continue; }
    if (!src.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file}: ${r.line}`);
  }
  assert.deepEqual(bad, []);
});

test('C-2: build/next/resources.ts の glob \'debug/browser/media/*.png\' に当たる本家のファイルは、すべて delete にある（残る png を巻き込まない）', { skip: skipUp }, () => {
  const dir = 'src/vs/workbench/contrib/debug/browser/media';
  const pngs = upList(dir).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`);
  assert.ok(pngs.length > 0, '本家に png が無い（glob の行が空振りする）');
  assert.deepEqual(pngs.filter((p) => !underAny(unit.delete ?? [], p)), []);
});

test('C-2: removeLines が extensionHostDebugService の import（desktop・web の1行）と、足す debug.service.contribution の import を消さない', { skip: noUnit }, () => {
  const bad = (unit.removeLines ?? []).filter((r) => /extensionHostDebugService/.test(r.line) || /debug\.service\.contribution/.test(r.line)).map((r) => `${r.file}: ${r.line}`);
  assert.deepEqual(bad, []);
  assert.ok(!(unit.removeLines ?? []).some((r) => /workbench\.(desktop|web)\.main\.ts$/.test(r.file)), 'desktop・web の main には触れない（docs/03 の表の「desktop の1行」は消さない）');
});

test('C-2: workbench.common.main.ts の removeLines は Debug の節の6行（docs/03 の表のとおり）で、ほかの main には触れない', { skip: noUnit }, () => {
  const mains = (unit.removeLines ?? []).filter((r) => /(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$/.test(r.file));
  assert.ok(mains.every((r) => r.file === COMMON_MAIN), 'workbench.common.main.ts 以外の main に removeLines がある');
  assert.deepEqual(mains.map((r) => r.line.trim()).sort(), [
    "import './contrib/debug/browser/breakpointEditorContribution.js';", "import './contrib/debug/browser/callStackEditorContribution.js';",
    "import './contrib/debug/browser/debug.contribution.js';", "import './contrib/debug/browser/debugEditorContribution.js';",
    "import './contrib/debug/browser/debugViewlet.js';", "import './contrib/debug/browser/repl.js';"].sort());
});

test('C-2: C-1 の隣の行（extHost.protocol.ts の common の import と ID 2行、repl.contribution.ts の import 2行）は removeLines にある（隣）', { skip: noUnit }, () => {
  const has = (file, re) => (unit.removeLines ?? []).some((r) => r.file === file && re.test(r.line));
  assert.ok(has(PROTOCOL, /from '\.\.\/\.\.\/contrib\/debug\/common\/debug\.js';$/), 'extHost.protocol.ts の contrib/debug/common の import が removeLines に無い');
  assert.ok(has(PROTOCOL, /^MainThreadDebugService: createProxyIdentifier/), 'MainContext の ID が removeLines に無い');
  assert.ok(has(PROTOCOL, /^ExtHostDebugService: createProxyIdentifier/), 'ExtHostContext の ID が removeLines に無い');
  assert.ok(has(REPL_CONTRIB, /getReplView/), 'repl.contribution.ts の getReplView の import が removeLines に無い');
  assert.ok(has(REPL_CONTRIB, /REPL_VIEW_ID/), 'repl.contribution.ts の REPL_VIEW_ID の import が removeLines に無い');
});

test('C-2: edits.patch と removeLines が同じ行を二重に消さない（消す所がどちらかに決まっている）', { skip: noPatch }, () => {
  const dup = [];
  for (const s of sections) {
    const mine = (unit.removeLines ?? []).filter((r) => r.file === s.path).map((r) => r.line.trim());
    for (const l of s.removed) if (l.trim() && mine.includes(l.trim())) dup.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(dup, []);
});

test('C-2: edits.patch の区画のパスが相対で、.. を含まない', { skip: noPatch }, () => {
  assert.deepEqual(sections.filter((s) => s.path.startsWith('/') || s.path.includes('..')).map((s) => s.path), []);
});

test('C-2: edits.patch が触るファイルは README の表の8つだけ（自分の単位が消した部品への参照だけを直す）', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path).sort(), [...EDITED_FILES].sort());
});

test('C-2: edits.patch が delete したファイルを直そうとしていない（先に消えるので当たらない）', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  assert.deepEqual(sections.filter((s) => !s.isNew && underAny(del, s.path)).map((s) => s.path), []);
});

test('C-2: edits.patch はどのファイルも消さない（消すのは delete）。kept も消さない', { skip: noPatch }, () => {
  assert.deepEqual(sections.filter((s) => s.isDelete).map((s) => s.path), []);
});

test('C-2: edits.patch が作る新しいファイルは extHostRemovedApi.debug.ts の1つだけ', { skip: noPatch }, () => {
  const s = sections.find((x) => x.path === NEW_API);
  assert.ok(s, `区画が無い: ${NEW_API}`);
  assert.ok(s.isNew, `new file でない: ${NEW_API}`);
  assert.ok(s.added.length > 30, `本文が短すぎる: ${NEW_API}`);
  assert.equal(s.removed.length, 0, `新しいファイルに削除の行がある: ${NEW_API}`);
  assert.deepEqual(sections.filter((x) => x.isNew).map((x) => x.path), [NEW_API], '新しいファイルが extHostRemovedApi.debug.ts の1つだけでない');
  assert.equal(sections.filter((x) => x.path === NEW_API).length, 1, `区画が重複: ${NEW_API}`);
});

test('C-2: 新しいファイルは本家に元から無い。delete・kept の中でもない', { skip: skipUpPatch }, () => {
  assert.equal(upHas(NEW_API), false, `本家に既にある: ${NEW_API}`);
  assert.equal(underAny(unit.delete ?? [], NEW_API), false);
  assert.equal(underAny((unit.kept ?? []).map((k) => k.path), NEW_API), false);
});

test('C-2: workbench.*.main.ts への変更は、common の Debug の節への debug.service.contribution.js の import 1行の追加だけ（案A の例外）', { skip: noPatch }, () => {
  const mains = sections.filter((s) => /(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$/.test(s.path));
  assert.deepEqual(mains.map((s) => s.path), [COMMON_MAIN], 'workbench.common.main.ts だけが触られる');
  const s = mains[0];
  assert.equal(s.hunks.length, 1);
  assert.deepEqual(s.added, [SERVICE_IMPORT]);
  assert.deepEqual(s.removed, [], '行を消してはいけない（消す行は removeLines）');
  const h = s.hunks[0];
  const at = h.findIndex((x) => x.k === '+');
  assert.deepEqual(h[at - 1], { k: ' ', t: '// Debug' }, '足す行が Debug の節の見出しの次にない');
});

test('C-2: extHost.api.impl.ts の変更は3か所だけ（import の1行の差し替え、作る所の1行の削除、const debug の右辺）', { skip: noPatch }, () => {
  const s = section('api/common/extHost.api.impl.ts');
  assert.ok(s, 'extHost.api.impl.ts の区画が無い');
  assert.equal(s.hunks.length, 3, `変更が3か所でない: ${s.hunks.length}`);
  const rem = (h) => h.filter((x) => x.k === '-').map((x) => x.t);
  const add = (h) => h.filter((x) => x.k === '+').map((x) => x.t);
  const byImport = s.hunks.find((h) => rem(h).some((l) => /^import \{ IExtHostDebugService \} from '\.\/extHostDebugService\.js';$/.test(l)));
  assert.ok(byImport, 'IExtHostDebugService の import を消す所が無い');
  assert.deepEqual(rem(byImport).length, 1);
  assert.deepEqual(add(byImport), ["import { createRemovedDebugApi } from './extHostRemovedApi.debug.js';"]);
  const byCreate = s.hunks.find((h) => rem(h).some((l) => /rpcProtocol\.set\(ExtHostContext\.ExtHostDebugService,/.test(l)));
  assert.ok(byCreate, 'ExtHostDebugService を作る行を消す所が無い');
  assert.equal(rem(byCreate).length, 1);
  assert.deepEqual(add(byCreate), []);
  const byBlock = s.hunks.find((h) => rem(h).some((l) => /^\t\tconst debug: typeof vscode\.debug = \{$/.test(l)));
  assert.ok(byBlock, 'const debug の本体を消す所が無い');
  assert.deepEqual(add(byBlock), ['\t\tconst debug: typeof vscode.debug = createRemovedDebugApi(extension);']);
  // 消す行は途切れない1つの塊で、`const debug ... = {` から対応する `};` まで
  const idx = byBlock.map((x, i) => (x.k === '-' ? i : -1)).filter((i) => i >= 0);
  assert.equal(idx[idx.length - 1] - idx[0] + 1, idx.length, '消す行が1つの塊でない（間に文脈の行がある）');
  assert.equal(byBlock[idx[idx.length - 1]].t, '\t\t};');
  assert.deepEqual(s.hunks.filter((h) => h !== byImport && h !== byCreate && h !== byBlock), []);
  // 変えた行の合計は、この3か所の行だけ
  assert.equal(s.added.length, 2);
});

test('C-2: 残る extHost.api.impl.ts が createRemovedDebugApi(extension) を呼ぶ（作っただけで使われない、にならない）', { skip: noPatch }, () => {
  const s = section('api/common/extHost.api.impl.ts');
  assert.ok(s.added.some((l) => /createRemovedDebugApi\(extension\);$/.test(l)));
});

test('C-2: extHost.protocol.ts は削除だけ（足す行が無い）。MainThreadDebugServiceShape・ExtHostDebugServiceShape とその DTO を消す。ID と common の import は removeLines', { skip: noPatch }, () => {
  const s = section('api/common/extHost.protocol.ts');
  assert.ok(s, 'extHost.protocol.ts の区画が無い');
  assert.deepEqual(s.added, [], '削除だけのはず');
  for (const n of ['MainThreadDebugServiceShape', 'ExtHostDebugServiceShape', 'DebugSessionUUID', 'IDebugConfiguration', 'IStartDebuggingOptions',
    'IBreakpointDto', 'IFunctionBreakpointDto', 'IDataBreakpointDto', 'ISourceBreakpointDto', 'IBreakpointsDeltaDto', 'ISourceMultiBreakpointDto',
    'IDebugSessionFullDto', 'IDebugSessionDto', 'IThreadFocusDto', 'IStackFrameFocusDto']) {
    assert.ok(s.removed.some((l) => new RegExp(`^export (?:interface|type) ${n}\\b`).test(l.trim())), `${n} の定義を消していない`);
  }
  assert.ok(!s.removed.some((l) => /createProxyIdentifier|contrib\/debug\/common/.test(l)), 'ID の行・common の import は removeLines に回した（C-1 と隣り合う）');
});

test('C-2: debug.service.contribution.ts は IDebugService・IDebugVisualizerService を Null の実装で登録し、消した debugService.js を import しない', { skip: noPatch }, () => {
  const s = section('contrib/debug/browser/debug.service.contribution.ts');
  assert.ok(s, '区画が無い');
  assert.ok(s.added.some((l) => /^registerSingleton\(IDebugService, NullDebugService, InstantiationType\.Delayed\);$/.test(l)));
  assert.ok(s.added.some((l) => /^registerSingleton\(IDebugVisualizerService, NullDebugVisualizerService, InstantiationType\.Delayed\);$/.test(l)));
  assert.ok(s.added.some((l) => /^import \{ NullDebugService, NullDebugVisualizerService \} from '\.\.\/common\/nullDebugService\.js';$/.test(l)));
  assert.ok(s.removed.some((l) => /registerSingleton\(IDebugService, DebugService,/.test(l)), '元の DebugService の登録が消えていない');
  assert.ok(s.removed.some((l) => /registerSingleton\(IDebugVisualizerService, DebugVisualizerService,/.test(l)), '元の DebugVisualizerService の登録が消えていない');
  assert.ok(s.removed.some((l) => /from '\.\/debugService\.js'/.test(l)), './debugService.js の import が消えていない');
  assert.ok(!s.added.some((l) => /debugService\.js|registerSingleton\(\s*IDebugService\s*,\s*DebugService\b/.test(l)));
});

test('C-2: Null のサービスは本家 1.146.0 の common/nullDebugService.ts にあり、IDebugService・IDebugVisualizerService を実装している', { skip: skipUp }, () => {
  const src = upShow('src/vs/workbench/contrib/debug/common/nullDebugService.ts');
  assert.ok(src, '本家に nullDebugService.ts が無い');
  assert.match(src, /export class NullDebugService implements IDebugService/);
  assert.match(src, /export class NullDebugVisualizerService implements IDebugVisualizerService/);
  assert.equal(underAny(unit.delete ?? [], 'src/vs/workbench/contrib/debug/common/nullDebugService.ts'), false);
});

test('C-2: notebook.contribution.ts は設定 notebook.variablesView・notebook.inlineValues の登録を消し、repl.contribution.ts は list.find.replInputFocus を消す。足すのは import の整理だけ', { skip: noPatch }, () => {
  const nb = section('contrib/notebook/browser/notebook.contribution.ts');
  assert.ok(nb.removed.some((l) => /NotebookSetting\.notebookVariablesView\]/.test(l)));
  assert.ok(nb.removed.some((l) => /NotebookSetting\.notebookInlineValues\]/.test(l)));
  assert.deepEqual(nb.added.filter((l) => !/^import\b/.test(l.trim())), [], 'import の整理以外の行を足している');
  const repl = section('contrib/replNotebook/browser/repl.contribution.ts');
  assert.ok(repl.removed.some((l) => /id: 'list\.find\.replInputFocus'/.test(l)));
  assert.deepEqual(repl.added.filter((l) => !/^import\b/.test(l.trim())), [], 'import の整理以外の行を足している');
  const ea = section('contrib/notebook/browser/controller/editActions.ts');
  assert.deepEqual(ea.added, [], 'editActions.ts は削除だけ');
  assert.ok(ea.removed.some((l) => /NotebookInlineVariablesController/.test(l)));
});

test('C-2: C-1 の edits.patch と、文脈が重ならない（同じファイルで、一方の消す行を他方が文脈や消す行にしない。3-way に頼らない形）（独立）', { skip: noPatch || (existsSync(join(REPO, 'removals', 'C-1-ai', 'edits.patch')) ? false : 'C-1 の edits.patch が無い') }, () => {
  const c1 = parsePatch(readFileSync(join(REPO, 'removals', 'C-1-ai', 'edits.patch'), 'utf8'));
  // `}` や空行、`name: string;` のようなプロパティ宣言のように、どこにでもある行は数えない
  const heavy = (l) => l.trim().length >= 24 && !/^(?:readonly\s+)?[\w$]+\??: [\w<>[\]|.,\s]+;$/.test(l.trim());
  const overlap = [];
  for (const mine of sections) {
    if (mine.isNew) continue;
    const theirs = c1.find((x) => x.path === mine.path && !x.isNew);
    if (!theirs) continue;
    const theirRemoved = new Set(theirs.removed.filter(heavy).map((l) => l.trim()));
    const myRemoved = new Set(mine.removed.filter(heavy).map((l) => l.trim()));
    for (const l of mine.old) if (heavy(l) && theirRemoved.has(l.trim())) overlap.push(`${mine.path}: C-1 が消す行を C-2 が文脈か削除にしている: ${l.trim().slice(0, 90)}`);
    for (const l of theirs.old) if (heavy(l) && myRemoved.has(l.trim())) overlap.push(`${mine.path}: C-2 が消す行を C-1 が文脈か削除にしている: ${l.trim().slice(0, 90)}`);
  }
  assert.deepEqual(overlap, []);
});

test('C-2: C-1 の delete と重なるのは debugChatIntegration.ts だけ（C-1 を先に当てると「本家に無い」警告が1件出る。想定済み）', { skip: existsSync(join(REPO, 'removals', 'C-1-ai', 'unit.json')) ? noUnit : 'C-1 の unit.json が無い' }, () => {
  const c1 = readJson(join(REPO, 'removals', 'C-1-ai', 'unit.json'));
  const c1Del = c1.delete ?? [];
  // C-2 の delete のうち、C-1 が先に消してしまうもの（apply.mjs が「本家に無い」警告を出すのはこれ）
  const overlap = (unit.delete ?? []).filter((d) => underAny(c1Del, d.replace(/\/+$/, '')));
  assert.deepEqual(overlap, ['src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts']);
});

// --- checks ---
// 2026-11-15 の1回目のテストで、本家のどこにも無い文字列が2つ見つかった(`debug/browser/debugService.js'`・`linkDetector.js'`)。
// 蒙恬が `/debugService.js'`・`/linkDetector.js'` に直したので、除外は無い(2回目)。
test('C-2: checks.absentCommands・absentViews・absentSettings・absentStrings の項目が、本家 1.146.0 にある（元から無いものを「無いこと」で守らない）', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  const miss = [];
  for (const c of ck.absentCommands ?? []) if (!upGrep(c, ['src/vs'])) miss.push(`コマンド ${c}`);
  for (const v of ck.absentViews ?? []) if (!upGrep(v, ['src/vs'])) miss.push(`ビュー ${v}`);
  for (const s of ck.absentSettings ?? []) if (!upGrep(s, ['src/vs'])) miss.push(`設定 ${s}`);
  for (const { in: where, text } of ck.absentStrings ?? []) if (!upGrep(text, where)) miss.push(`文字列 ${text} (${where.join(', ')})`);
  assert.deepEqual(miss, []);
});

test('C-2: absentStrings の各項目は、本家の kept でないファイルに当たる（kept だけに当たる文字列は、検査から外れていて何も守らない）', { skip: skipUp }, () => {
  const kept = (unit.kept ?? []).map((k) => k.path);
  const dead = [];
  for (const { in: where, text } of unit.checks?.absentStrings ?? []) {
    const r = spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-l', '-e', text, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const files = (r.stdout ?? '').split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
    if (!files.some((f) => !underAny(kept, f))) dead.push(`${text} (${where.join(', ')}): 当たり ${files.length} 件、すべて kept`);
  }
  assert.deepEqual(dead, []);
});

test('C-2: checks に、2026-11-15 に足した設定 2つ・文字列 4つがある', { skip: noUnit }, () => {
  const ck = unit.checks ?? {};
  for (const k of ['debug.console.fontSize', 'notebook.variablesView', 'notebook.inlineValues']) assert.ok((ck.absentSettings ?? []).includes(k), `absentSettings に ${k} が無い`);
  const has = (file, text) => (ck.absentStrings ?? []).some((s) => s.in.includes(file) && s.text === text);
  assert.ok(has('build/next/resources.ts', 'debug/browser/media/*.png'));
  assert.ok(has('build/next/index.ts', 'debug/node/telemetryApp'));
  assert.ok(has('src/vs/workbench/contrib/notebook', 'contrib/notebookVariables/'));
  assert.ok(has(PROTOCOL, 'MainThreadDebugServiceShape'));
  assert.ok(has(PROTOCOL, 'ExtHostDebugServiceShape'));
});

test('C-2: edits.patch が足す行に absentStrings の文字列が現れない（kept の対象を除く。当てた後の検査で自分が落ちない）', { skip: noPatch }, () => {
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

test('C-2: 新しいファイルの import が、delete で消える場所を指さない・本家か新しいファイルにあり、使う名前が本家で export されている', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const text = body('extHostRemovedApi.debug.ts');
  const bad = [];
  for (const m of text.matchAll(/^\s*import\b(?:\s+type)?\s*([^;]*?)\bfrom\s+'([^']+)'/gm)) {
    const spec = m[2];
    if (spec === 'vscode') continue;
    const target = posix.normalize(posix.join(posix.dirname(NEW_API), spec)).replace(/\.js$/, '.ts');
    if (underAny(del, target)) { bad.push(`${spec} は delete の中`); continue; }
    if (!upOk) continue;
    const src = upShow(target);
    if (src === null) { bad.push(`${spec} (${target}) が本家に無い`); continue; }
    for (const n of [...m[1].matchAll(/\b(Event|URI|IExtensionDescription|checkProposedApiEnabled)\b/g)].map((x) => x[1])) {
      const ok = n === 'Event' ? /export (?:const|function|interface) Event\b|export namespace Event\b/.test(src)
        : new RegExp(`export (?:class|function|interface|const|type) ${n}\\b`).test(src);
      if (!ok) bad.push(`${target} に ${n} の export が無い`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// 2. 何もしない実装の検査（文字列と構文）
// ---------------------------------------------------------------------------
const apiText = noPatch ? '' : body('extHostRemovedApi.debug.ts');
const noApi = noPatch || (apiText ? false : '実装なし: extHostRemovedApi.debug.ts の本文が無い');

const fnBody = (text, startRe) => {
  const m = startRe.exec(text);
  if (!m) return null;
  const i = text.indexOf('{', m.index + m[0].length - 1);
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(i, j + 1); }
  }
  return null;
};
// createRemovedDebugApi の返すオブジェクトの、メンバーの文を取る（'x: Event.None,' / 'get x() { ... }' / 'x(...) { ... }'）
const apiFn = noApi ? '' : (fnBody(apiText, /export function createRemovedDebugApi\(/) ?? '');
const member = (name) => {
  const re = new RegExp(`^[ \\t]*(?:get\\s+)?${name}\\b[^\\n]*`, 'm');
  const m = re.exec(apiFn);
  if (!m) return null;
  const rest = apiFn.slice(m.index);
  const eol = rest.indexOf('\n');
  const first = rest.slice(0, eol < 0 ? undefined : eol);
  if (!first.includes('{')) return first;
  const open = rest.indexOf('{');
  let depth = 0;
  for (let j = open; j < rest.length; j++) {
    if (rest[j] === '{') depth++;
    else if (rest[j] === '}') { depth--; if (depth === 0) return rest.slice(0, j + 1); }
  }
  return null;
};
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const EVENTS = ['onDidStartDebugSession', 'onDidTerminateDebugSession', 'onDidChangeActiveDebugSession', 'onDidReceiveDebugSessionCustomEvent', 'onDidChangeBreakpoints', 'onDidChangeActiveStackItem'];
const GATED = ['registerDebugVisualizationProvider', 'registerDebugVisualizationTreeProvider'];
const REGISTERS = ['registerDebugConfigurationProvider', 'registerDebugAdapterDescriptorFactory', 'registerDebugAdapterTrackerFactory'];
// 消す前の vscode.debug の全メンバー（edits.patch が消す const debug の塊から読む。仕様の側の一覧）
const oldMembers = (() => {
  const s = section('api/common/extHost.api.impl.ts');
  if (!s) return [];
  const h = s.hunks.find((x) => x.some((y) => y.k === '-' && /const debug: typeof vscode\.debug = \{/.test(y.t)));
  if (!h) return [];
  return h.filter((x) => x.k === '-').map((x) => /^\t\t\t(?:get\s+)?([A-Za-z]\w*)\s*\(/.exec(x.t)?.[1]).filter(Boolean);
})();

test('C-2 何もしない実装: 消す前の vscode.debug のメンバーが、すべて残る（20個。増やしも減らしもしない）', { skip: noApi }, () => {
  assert.equal(oldMembers.length, 20, `元のメンバーの数（getter 4、提案中 2、イベント 6、register 3、start/stop/add/remove/asDebugSourceUri 5）: ${oldMembers.length}`);
  const now = [...apiFn.matchAll(/^\t\t(?:get\s+)?([A-Za-z]\w*)\s*[(:]/gm)].map((m) => m[1]);
  assert.deepEqual([...now].sort(), [...oldMembers].sort());
});

test('C-2 何もしない実装: startDebugging は false で resolve し、stopDebugging は resolve する。待ち・通信が無い', { skip: noApi }, () => {
  const s = member('startDebugging');
  assert.ok(s, 'startDebugging が無い');
  assert.match(s, /return Promise\.resolve\(false\);/);
  assert.ok(!/await|async|fetch|true/.test(s.replace(/startDebugging/, '')), '待ちか通信か true がある');
  const t = member('stopDebugging');
  assert.ok(t && /return Promise\.resolve\(\);/.test(t));
  assert.ok(!/reject|throw/.test(t));
});

test('C-2 何もしない実装: イベント6つは Event.None（値のイベント。Emitter も listener を受ける形も持たない）', { skip: noApi }, () => {
  for (const n of EVENTS) {
    const m = member(n);
    assert.ok(m, `${n} が無い`);
    assert.match(m.trim(), new RegExp(`^${n}: Event\\.None,?$`), `${n} が Event.None でない: ${m}`);
  }
  const names = [...apiFn.matchAll(/^\t\t(on[A-Z]\w*)\b/gm)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), [...EVENTS].sort(), 'on* のメンバーが6つだけでない');
  assert.ok(!/new Emitter\b/.test(code(apiText)));
});

test('C-2 何もしない実装: register* の3つは何もしない Disposable を返す。安定版なので門を通さない（PowerShell 拡張が呼んでも誤りにならない）', { skip: noApi }, () => {
  assert.match(apiText, /function noopDisposable\(\)[^{]*\{\s*return \{ dispose\(\) \{ \} \};\s*\}/);
  for (const n of REGISTERS) {
    const m = member(n);
    assert.ok(m, `${n} が無い`);
    assert.match(m, /return noopDisposable\(\);/, `${n} が noopDisposable を返さない`);
    assert.ok(!m.includes('checkProposedApiEnabled'), `${n} に門がある（安定版のはず）`);
    assert.ok(!/throw|reject/.test(m), `${n} が誤りを投げる道を持つ`);
  }
});

// 提案中の API の門の期待は、手で並べず、本家のタグの、C-2 が消す extHost のファイル(api/common の extHost*.ts)の
// `checkProposedApiEnabled(extension, '<名前>')` と、edits.patch が extHost.api.impl.ts から消す塊の同じ呼び出しから読む
// (C-4 で、手で並べた期待が実装の門の抜けを通した。大岡越前守の検証 2026-11-15。同じ見逃しが無いかを C-2 でも確かめた)。
test('C-2 何もしない実装: 提案中の API の門が、本家の消すファイルと edits.patch が消す塊の門と過不足なく残る(本家から読む。debugVisualization の2つ)', { skip: skipUpPatch || noApi }, () => {
  const names = [];
  const gate = /checkProposedApiEnabled\(extension, '(\w+)'\)/g;
  for (const d of unit.delete ?? []) {
    if (!/^src\/vs\/workbench\/api\/(common|node|browser)\/extHost[^/]*\.ts$/.test(d)) continue;
    const t = upShow(d);
    assert.ok(t !== null, `本家に無い: ${d}`);
    for (const m of t.matchAll(gate)) names.push(m[1]);
  }
  for (const l of section('api/common/extHost.api.impl.ts')?.removed ?? []) for (const m of l.matchAll(gate)) names.push(m[1]);
  const have = [...apiText.matchAll(gate)].map((m) => m[1]).sort();
  assert.ok(names.length >= 1, '本家の門が読めない');
  assert.deepEqual(have, names.sort(), '何もしない実装の門が、本家の消す側の門と違う(抜け・増え)');
});

test('C-2 何もしない実装: 提案中の API debugVisualization の2つは、門が最初の文に残り、通れば何もしない Disposable を返す（門）', { skip: noApi }, () => {
  assert.match(apiText, /import \{ checkProposedApiEnabled \} from '\.\.\/\.\.\/services\/extensions\/common\/extensions\.js';/);
  for (const n of GATED) {
    const m = member(n);
    assert.ok(m, `${n} が無い`);
    const gate = m.indexOf("checkProposedApiEnabled(extension, 'debugVisualization')");
    assert.ok(gate >= 0, `${n}: 門 debugVisualization が無い`);
    const ret = m.search(/\breturn\b/);
    assert.ok(ret > gate, `${n}: 門が return より後`);
    assert.match(m, /return noopDisposable\(\);/);
  }
  // 門を使うのはこの2つだけ
  assert.equal([...apiFn.matchAll(/checkProposedApiEnabled\(/g)].length, 2);
});

test('C-2 何もしない実装: activeDebugSession・activeStackItem は undefined、breakpoints は []、activeDebugConsole は何もしないコンソール', { skip: noApi }, () => {
  for (const n of ['activeDebugSession', 'activeStackItem']) {
    const m = member(n);
    assert.ok(m && /return undefined;/.test(m), `${n} が undefined を返さない`);
  }
  const b = member('breakpoints');
  assert.ok(b && /return \[\];/.test(b), 'breakpoints が [] を返さない');
  const c = member('activeDebugConsole');
  assert.ok(c && /return noopDebugConsole;/.test(c), 'activeDebugConsole が noopDebugConsole を返さない（undefined にすると appendLine を呼ぶ拡張が誤りになる）');
  const def = /const noopDebugConsole: vscode\.DebugConsole = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(apiText);
  assert.ok(def, 'noopDebugConsole の定義が無い');
  assert.match(def[1], /append\(\w+: string\): void \{\s*\}/);
  assert.match(def[1], /appendLine\(\w+: string\): void \{\s*\}/);
});

test('C-2 何もしない実装: addBreakpoints・removeBreakpoints は何もしない（空の本文）', { skip: noApi }, () => {
  for (const n of ['addBreakpoints', 'removeBreakpoints']) {
    const m = member(n);
    assert.ok(m, `${n} が無い`);
    assert.match(m, /\{\s*\}$/, `${n} の本文が空でない: ${m}`);
  }
});

test('C-2 何もしない実装: asDebugSourceUri は本家と同じ誤りの文言を持ち、セッションを要らない（computeだけ）', { skip: noApi }, () => {
  const m = member('asDebugSourceUri');
  assert.ok(m && /return asDebugSourceUri\(source, session\);/.test(m));
  const fn = fnBody(apiText, /function asDebugSourceUri\(/);
  assert.ok(fn, '内側の asDebugSourceUri が無い');
  assert.match(fn, /URI\.file\(source\.path\)/);
  assert.match(fn, /source\.sourceReference > 0/);
  assert.match(fn, /encodeURIComponent\(session\.id\)/);
  assert.match(fn, /ref=\$\{source\.sourceReference\}/);
  if (upOk) {
    const up = upShow('src/vs/workbench/api/common/extHostDebugService.ts') ?? '';
    const msg = /throw new Error\(`(cannot create uri from DAP 'source' object;[^`]*)`\)/.exec(fn)?.[1];
    assert.ok(msg, '誤りの文言が無い');
    assert.ok(up.includes(msg), `本家の文言と違う: ${msg}`);
  }
});

test('C-2 何もしない実装: 通信・プロセス・タイマー・DI・RPC・消した部品を持たない（何もしない）', { skip: noApi }, () => {
  const c = code(apiText);
  for (const re of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /child_process/,
    /\bIRPCProtocol\b/, /\brpcProtocol\b/, /\$register/, /\.\$\w+\(/, /@I[A-Z]\w+/, /\bnew Emitter\b/, /\bconsole\./,
    /ExtHostDebugService/, /extHostDebugService/, /MainThreadDebug/, /\bIDebugService\b/, /\basync\b/, /\bawait\b/]) {
    assert.ok(!re.test(c), `使ってはいけないもの: ${re}`);
  }
});

test('C-2 何もしない実装: import は vscode（型）・Event・URI・IExtensionDescription・checkProposedApiEnabled の4つだけ（残る本家の部品）', { skip: noApi }, () => {
  const specs = [...apiText.matchAll(/^import\b[^;]*?\bfrom\s+'([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(specs, ['../../../base/common/event.js', '../../../base/common/uri.js', '../../../platform/extensions/common/extensions.js',
    '../../services/extensions/common/extensions.js', 'vscode'].sort());
  assert.match(apiText, /^import type \* as vscode from 'vscode';$/m);
});

// ---------------------------------------------------------------------------
// 3. 何もしない実装を走らせる（型を外した本文を node で。import は模擬）
// ---------------------------------------------------------------------------
const strip = nodeModule.stripTypeScriptTypes;
const noRun = noApi || (typeof strip === 'function' ? false : 'node に module.stripTypeScriptTypes が無い');
function load() {
  const src = apiText.replace(/^import .*$/gm, '').replace(/^export function /gm, 'function ');
  const js = strip(src, { mode: 'strip' });
  const None = () => ({ dispose() { } });
  const Event = { None };
  const calls = [];
  const URI = {
    parse(s) { calls.push(['parse', s]); const m = /^([a-z]+):([^?]*)(?:\?(.*))?$/.exec(s); return { scheme: m[1], path: decodeURIComponent(m[2]), query: m[3] ?? '' }; },
    file(p) { calls.push(['file', p]); return { scheme: 'file', path: p }; },
  };
  const checkProposedApiEnabled = (ext, name) => { if (!(ext.enabledApiProposals ?? []).includes(name)) throw new Error(`Extension '${ext.name}' CANNOT use API proposal: ${name}.`); };
  const create = new Function('Event', 'URI', 'checkProposedApiEnabled', `${js}\nreturn createRemovedDebugApi;`)(Event, URI, checkProposedApiEnabled);
  return { create, None, calls };
}
const plain = { name: 'x.plain' };
const withProposal = { name: 'x.proposed', enabledApiProposals: ['debugVisualization'] };

// 所(メンバー)ごとの門(C-1 の 5回目と同じ形)。期待は本家の消す extHost のファイルのメンバーごとの checkProposedApiEnabled から読む。
test('C-2 何もしない実装(走らせる): 本家の消すファイルでメンバーごとに門があるものは、提案を有効にしていない拡張で門の誤りになる。有効にした拡張では誤りにならない。誤りの出方が本家と同じ', { skip: noRun || (upOk ? false : '本家のソースが読めない') }, async () => {
  const files = (unit.delete ?? []).filter((d) => /^src\/vs\/workbench\/api\/common\/extHost[^/]*\.ts$/.test(d)).map((d) => ({ path: d, text: upShow(d) })).filter((f) => f.text !== null);
  // C-2 の門(debugVisualization の2つ)は、消す extHost のファイルではなく、extHost.api.impl.ts の const debug の宣言(edits.patch が消す塊)にある。
  // その塊の消す行も、本家のメンバーの宣言として読む
  const implRemoved = (section('api/common/extHost.api.impl.ts')?.removed ?? []).join('\n');
  assert.ok(implRemoved.length > 0, 'extHost.api.impl.ts の消す塊が無い');
  files.push({ path: API_IMPL, text: implRemoved });
  const map = memberGatesOf(files);
  const { create } = load();
  const surfacesFor = (proposals) => ({ debug: create({ name: 'x.ext', identifier: { value: 'x.ext' }, enabledApiProposals: proposals }) });
  const { checked, bad, asyncBad } = await compareMemberGates({ map, surfacesFor });
  // 本家で門のあるメンバーが、実装の面(vscode.debug)に出るものは少ない。出るものはすべて合うこと。読み方が外れて 0 件になるのは誤り（名前の集まりの検査は別にある）
  const gated = [...map.values()].filter((v) => v.gates.size).map((v) => `${v.kind}:${v.name}:${[...v.gates].join('/')}`);
  assert.ok(checked.includes('debug.registerDebugVisualizationProvider') && checked.includes('debug.registerDebugVisualizationTreeProvider'), `debugVisualization の2つが本家と突き合わせられていない: ${checked.join(', ')} / 本家の門のあるメンバー: ${gated.join(', ')}`);
  assert.deepEqual(bad, [], `突き合わせたメンバー: ${checked.join(', ')} / 本家の門のあるメンバー: ${gated.join(', ')}`);
  assert.deepEqual(asyncBad, []);
});

test('C-2 何もしない実装(走らせる): startDebugging(undefined, "x") は false で resolve する。設定の形・親セッションの形でも同じ', { skip: noRun }, async () => {
  const { create } = load();
  const api = create(plain);
  assert.equal(await api.startDebugging(undefined, 'x'), false);
  assert.equal(await api.startDebugging(undefined, { type: 'PowerShell', name: 'n', request: 'launch' }), false);
  assert.equal(await api.startDebugging({ uri: {}, name: 'w', index: 0 }, 'x', { noDebug: true }), false);
  assert.equal(await api.stopDebugging(), undefined);
  assert.equal(await api.stopDebugging({ id: 's' }), undefined);
});

test('C-2 何もしない実装(走らせる): registerDebugConfigurationProvider("PowerShell", {})・registerDebugAdapterDescriptorFactory・Tracker の返り値は dispose を持ち、呼んでも誤りにならない', { skip: noRun }, () => {
  const { create } = load();
  const api = create(plain);
  for (const d of [api.registerDebugConfigurationProvider('PowerShell', {}), api.registerDebugConfigurationProvider('PowerShell', {}, 2),
    api.registerDebugAdapterDescriptorFactory('PowerShell', {}), api.registerDebugAdapterTrackerFactory('*', {})]) {
    assert.equal(typeof d.dispose, 'function');
    assert.doesNotThrow(() => d.dispose());
    assert.doesNotThrow(() => d.dispose());
  }
});

test('C-2 何もしない実装(走らせる): イベント6つは Event.None そのもので、購読すると Disposable が返る。発火しない', { skip: noRun }, () => {
  const { create, None } = load();
  const api = create(plain);
  for (const n of EVENTS) {
    assert.equal(api[n], None, `${n} が Event.None でない`);
    const d = api[n](() => assert.fail('発火した'));
    assert.equal(typeof d.dispose, 'function');
  }
});

test('C-2 何もしない実装(走らせる): activeDebugSession・activeStackItem が undefined、breakpoints が []、activeDebugConsole.append / appendLine が誤りにならない', { skip: noRun }, () => {
  const { create } = load();
  const api = create(plain);
  assert.equal(api.activeDebugSession, undefined);
  assert.equal(api.activeStackItem, undefined);
  assert.deepEqual(api.breakpoints, []);
  assert.ok(api.activeDebugConsole && typeof api.activeDebugConsole.appendLine === 'function');
  assert.doesNotThrow(() => api.activeDebugConsole.appendLine('x'));
  assert.doesNotThrow(() => api.activeDebugConsole.append('x'));
  assert.equal(api.activeDebugConsole.appendLine('x'), undefined);
  assert.equal(Object.isFrozen(api.activeDebugConsole), true);
  assert.equal(api.addBreakpoints([]), undefined);
  assert.equal(api.removeBreakpoints([]), undefined);
});

test('C-2 何もしない実装(走らせる): asDebugSourceUri は本家と同じ計算（path は file の URI、sourceReference は debug の URI、どちらも無ければ誤り）', { skip: noRun }, () => {
  const { create, calls } = load();
  const api = create(plain);
  const f = api.asDebugSourceUri({ path: 'C:\\a.ps1' });
  assert.equal(f.scheme, 'file');
  assert.equal(f.path, 'C:\\a.ps1');
  const d = api.asDebugSourceUri({ path: 'a', sourceReference: 3 });
  assert.deepEqual([d.scheme, d.path, d.query], ['debug', 'a', 'ref=3']);
  api.asDebugSourceUri({ path: 'a b', sourceReference: 3 }, { id: 'S/1' });
  assert.deepEqual(calls.at(-1), ['parse', 'debug:a%20b?session=S%2F1&ref=3']);
  // sourceReference が 0 のときは path を見る
  assert.equal(api.asDebugSourceUri({ path: 'p', sourceReference: 0 }).scheme, 'file');
  assert.throws(() => api.asDebugSourceUri({}), /cannot create uri from DAP 'source' object; properties 'path' and 'sourceReference' are both missing\./);
  assert.throws(() => api.asDebugSourceUri({ sourceReference: 0 }), /both missing/);
});

test('C-2 何もしない実装(走らせる): 提案を有効にしていない拡張が registerDebugVisualizationProvider・TreeProvider を呼ぶと誤りを投げる（門が残っている）。有効なら何もしない Disposable', { skip: noRun }, () => {
  const { create } = load();
  const bad = create(plain);
  assert.throws(() => bad.registerDebugVisualizationProvider('id', {}), /CANNOT use API proposal: debugVisualization/);
  assert.throws(() => bad.registerDebugVisualizationTreeProvider('id', {}), /CANNOT use API proposal: debugVisualization/);
  const ok = create(withProposal);
  for (const d of [ok.registerDebugVisualizationProvider('id', {}), ok.registerDebugVisualizationTreeProvider('id', {})]) {
    assert.equal(typeof d.dispose, 'function');
    assert.doesNotThrow(() => d.dispose());
  }
});

test('C-2 何もしない実装(走らせる): vscode.debug のメンバーは消す前と同じ名前の20個で、拡張ごとに別のオブジェクト（状態を持たない）', { skip: noRun }, () => {
  const { create } = load();
  const a = create(plain);
  const b = create(withProposal);
  assert.deepEqual(Object.keys(a).sort(), [...oldMembers].sort());
  assert.notEqual(a, b);
  assert.equal(Object.keys(a).length, oldMembers.length);
});

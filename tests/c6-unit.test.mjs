// C-6-settings-sync（設定の同期）の単位のファイルの静的な検査と、型検査に掛からない注入の外し損ねの検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節・4節（C-6 の行と末尾。型検査に掛からない注入が2か所。続きの編集は残す裁定）・5.1・5.3・5.4・9節、
//       docs/user-decisions.md の 2026-11-15（続きの編集の裁定、C-6 の edits.patch と C-4 のテストの直しで出た点）、removals/C-6-settings-sync/README.md。
// 期待は本家 1.146.0 から読む(手で並べない): 消す部品が登録するサービスの ID、その ID を注入・取得する所、消す部品が使う共有プロセスのチャンネル、
//   消すコマンドの登録、続きの編集(contrib/editSessions)の import。実装(edits.patch・unit.json)の一覧から写さない(C-4 の2回目の直しの教訓)。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-6 に固有の分だけ。何もしない実装は無い(edits.patch は注入と画面の部品を消すだけ)。
// Run: node --test tests/c6-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C6_UNIT_DIR: 単位のフォルダの代わり(tests/c6-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C6_UNIT_DIR ? resolve(process.env.AIED_C6_UNIT_DIR) : join(REPO, 'removals', 'C-6-settings-sync');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-6-settings-sync/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家を読む検査だけ飛ばす。
// AIED_C6_NO_UPSTREAM=1: 本家を読む検査を飛ばす(tests/c6-mutation.test.mjs が、本家を要さない壊し方を速く確かめるのに使う)
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = !process.env.AIED_C6_NO_UPSTREAM && existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const skipUpPatch = noPatch || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`);
const upHas = (p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p.replace(/\/+$/, '')}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upGrep = (text, where) => spawnSync('git', ['-C', UP_REPO, 'grep', '-F', '-q', '-e', text, UP_TAG, '--', ...where]).status === 0;
/** git grep の出力 `<タグ>:<パス>:<行>:<本文>` を { file, line, text } にする。-E の正規表現。 */
const upGrepLines = (re, where, flags = ['-n', '-E']) => (spawnSync('git', ['-C', UP_REPO, 'grep', ...flags, '-e', re, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => { const m = new RegExp(`^${UP_TAG.replace(/\./g, '\\.')}:(.*?):(\\d+):(.*)$`).exec(l); return m ? { file: m[1], line: Number(m[2]), text: m[3] } : null; }).filter(Boolean);
const upGrepFiles = (re, where, flags = ['-l', '-E']) => (spawnSync('git', ['-C', UP_REPO, 'grep', ...flags, '-e', re, UP_TAG, '--', ...where], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));

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

// ほかの単位(removals/ の C-6 以外)
const others = [];
for (const d of readdirSync(join(REPO, 'removals'), { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === 'C-6-settings-sync') continue;
  const uj = join(REPO, 'removals', d.name, 'unit.json');
  if (!existsSync(uj)) continue;
  const u = readJson(uj);
  const pf = u.patch ? join(REPO, 'removals', d.name, u.patch) : null;
  others.push({ id: u.id ?? d.name, unit: u, sections: pf && existsSync(pf) ? parsePatch(readFileSync(pf, 'utf8')) : [] });
}

const W = 'src/vs/workbench/';
const SETTINGS = `${W}contrib/preferences/browser/settingsEditor2.ts`;
const SETTINGS_CSS = `${W}contrib/preferences/browser/media/settingsEditor2.css`;
const SETTINGS_TEST = `${W}contrib/preferences/test/browser/settingsEditor2.test.ts`;
const RELAUNCHER = `${W}contrib/relauncher/browser/relauncher.contribution.ts`;
const RELAUNCHER_TEST = `${W}contrib/relauncher/test/browser/relauncher.test.ts`;
const UPDATE_TS = `${W}contrib/update/browser/update.ts`;
const SYNC_COMMON = `${W}services/userDataSync/common/userDataSync.ts`;
const EDITED_FILES = [SETTINGS, SETTINGS_CSS, SETTINGS_TEST, RELAUNCHER, RELAUNCHER_TEST];
const EDIT_SESSIONS = `${W}contrib/editSessions`;
// edits.patch が触れてはいけない所(プロファイル・拡張の管理・更新・拡張 API・続きの編集・main のファイル)
const FORBIDDEN_TOUCH = /(^|\/)(workbench|sessions)\.[\w.-]*main\.ts$|contrib\/editSessions\/|services\/userDataProfile\/|services\/extensionManagement\/|contrib\/update\/|src\/vs\/workbench\/api\/|platform\/userDataSync\/|services\/accounts\//;
// 注入の外し損ねの例外(判断済み): update.ts の accessor.get(IUserDataSyncWorkbenchService) は、Web の埋め込み側の値があるときだけ登録される操作の中で、デスクトップでは呼ばれない
const INJECTION_EXCEPTIONS = [UPDATE_TS];

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-6: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-6: edits.patch の件名が [PATCH] unit C-6-settings-sync: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-6-settings-sync: edits$/m);
});

test('C-6: edits.patch の作者が shuko-apply <apply@shuko.invalid>（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: shuko-apply <apply@shuko\.invalid>$/m);
});

test('C-6: unit.json の id・stage・after（C-1 だけ。C-2〜C-5 は前提にしない）。order は C-1 より後', { skip: noUnit }, () => {
  assert.equal(unit.id, 'C-6-settings-sync');
  assert.equal(unit.stage, 'C');
  assert.deepEqual(unit.after, ['C-1-ai']);
  const c1 = others.find((x) => x.id === 'C-1-ai');
  assert.ok(c1 && c1.unit.order < unit.order);
});

test('C-6: after の確かめ(5.1): --only から C-1 を外すと計画が誤りを返す。C-1 だけで通る。C-2〜C-5 があっても通る', { skip: noUnit }, async () => {
  const { planUnits } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'apply', 'units.mjs')).href);
  const all = [...others.map((o) => o.unit), unit];
  const BASE = ['A-1-copilot-extension', 'A-2-accounts-extensions', 'A-3-debug-extensions', 'A-4-notebook-extensions', 'A-5-remote-extensions', 'A-6-themes',
    'A-7-unused-extensions', 'B-1-telemetry', 'B-2-onboarding-experiments-surveys', 'B-3-issue-share', 'B-4-outline-view', 'B-5-theme-switching', 'B-6-online-feeds', 'B-7-terminal-suggest'];
  const a = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-6-settings-sync'] });
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.plan.map((u) => u.id).slice(-2), ['C-1-ai', 'C-6-settings-sync']);
  const b = planUnits(all, { only: [...BASE, 'C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery', 'C-6-settings-sync'] });
  assert.deepEqual(b.errors, []);
  assert.deepEqual(b.plan.map((u) => u.id).slice(-6), ['C-1-ai', 'C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery', 'C-6-settings-sync']);
  const noC1 = planUnits(all, { only: [...BASE, 'C-6-settings-sync'] });
  assert.ok(noC1.errors.some((e) => /C-6-settings-sync: after の単位 C-1-ai が先に当たらない/.test(e)), JSON.stringify(noC1.errors));
});

test('C-6: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い。delete に重複が無い。delete は2つ', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
  assert.deepEqual([...del].sort(), [`${W}contrib/userDataSync`, `${W}services/userDataSync/browser/userDataSyncWorkbenchService.ts`]);
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

test('C-6: kept にプロファイル・設定・拡張の管理・再起動の部品が注入する同期の状態のサービス・platform/userDataSync・アカウントのメニューがある(理由つき)', { skip: noUnit }, () => {
  const kept = new Map((unit.kept ?? []).map((k) => [k.path, k.reason]));
  for (const p of [SYNC_COMMON, `${W}services/userDataSync/browser/userDataSyncEnablementService.ts`, `${W}services/userDataSync/electron-browser`, `${W}services/userDataSync/common/userDataSyncUtil.ts`,
    'src/vs/platform/userDataSync', `${W}services/accounts`]) {
    assert.ok(kept.has(p), `kept に ${p} が無い`);
    assert.ok((kept.get(p) ?? '').length >= 10, `kept の ${p} に理由が無い`);
  }
});

test('C-6: プロファイル・設定の画面・拡張の管理・再起動・更新・アカウント・続きの編集の部品を、delete もしないし、removeLines・edits.patch で消しもしない', { skip: noPatch }, () => {
  const protectedRoots = [`${W}services/userDataProfile`, `${W}contrib/userDataProfile`, `${W}services/extensionManagement`, `${W}contrib/extensions`, `${W}services/accounts`,
    `${W}contrib/preferences`, `${W}contrib/relauncher`, `${W}contrib/update`, EDIT_SESSIONS, 'src/vs/platform/userDataSync', 'src/vs/platform/userDataProfile', `${W}services/preferences`];
  const del = (unit.delete ?? []).filter((d) => underAny(protectedRoots, d.replace(/\/+$/, '')));
  assert.deepEqual(del, [], '残す部品を delete している');
  assert.deepEqual((unit.removeLines ?? []).filter((r) => underAny(protectedRoots, r.file)).map((r) => r.file), [], '残す部品の import を removeLines で消している');
  // edits.patch が消す行は、同期の部品(SyncControls・最後に同期した時刻・注入)に限る。プロファイル・設定の木・検索・拡張の管理の行を消さない
  const PROTECT = [/IUserDataProfileService/, /IConfigurationService/, /SettingsTreeModel|SettingsTree\b|TOCTree/, /searchWidget|SearchWidget/, /IExtensionManagementService|IExtensionService/, /IUserDataSyncService\b(?!.*Sync)/,
    /updateInputAriaLabel\(\): void/, /relaunch|doConfirm|handleRestart/i];
  const bad = [];
  for (const s of sections) {
    if (/\.test\.ts$/.test(s.path) || /\.css$/.test(s.path)) continue;
    for (const l of s.removed) for (const re of PROTECT) if (re.test(l) && !/UserDataSync|lastSyncedLabel|SyncControls|syncControls/.test(l)) bad.push(`${s.path}: ${l.trim().slice(0, 100)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-6: delete したパスが本家 1.146.0 にある。kept のパスも本家にある（ファイルの改名に気づく）', { skip: skipUp }, () => {
  assert.deepEqual((unit.delete ?? []).filter((d) => !upHas(d)), []);
  assert.deepEqual((unit.kept ?? []).map((k) => k.path).filter((p) => !upHas(p)), []);
});

test('C-6: delete が、ほかの単位の delete と重ならない（C-1 は after なので除く）', { skip: noUnit }, () => {
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

test('C-6: removeLines は common 2・desktop 1 の3行。重複が無く、file が delete の中ではなく、delete した部品の import である。web・sessions の main には触れない', { skip: noUnit }, () => {
  const rl = unit.removeLines ?? [];
  const keys = rl.map((r) => `${r.file}\n${r.line.trim()}`);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  assert.deepEqual(rl.filter((r) => underAny(unit.delete ?? [], r.file)).map((r) => r.file), []);
  const count = (re) => rl.filter((r) => re.test(r.file)).length;
  assert.equal(count(/workbench\.common\.main\.ts$/), 2);
  assert.equal(count(/workbench\.desktop\.main\.ts$/), 1);
  assert.equal(rl.length, 3);
  assert.ok(!rl.some((r) => /workbench\.web\.main\.ts$|sessions\.[\w.-]*main\.ts$/.test(r.file)), 'web・sessions の main には触れない(sessions の2行は C-1 が消す)');
  const bad = [];
  for (const r of rl) {
    const imp = /^import\s+(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(r.line.trim());
    if (!imp) { bad.push(`${r.file}: ${r.line} (import でない)`); continue; }
    const target = posix.normalize(posix.join(posix.dirname(r.file), imp[1])).replace(/\.js$/, '.ts');
    if (!underAny(unit.delete ?? [], target)) bad.push(`${r.file}: ${r.line} (${target} は delete に無い)`);
  }
  assert.deepEqual(bad, []);
});

test('C-6: removeLines の行が本家 1.146.0 のそのファイルにある（行の書き換えに気づく）', { skip: skipUp }, () => {
  const bad = [];
  for (const r of unit.removeLines ?? []) {
    const src = upShow(r.file);
    if (src === null) { bad.push(`${r.file} が本家に無い`); continue; }
    if (!src.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file}: ${r.line}`);
  }
  assert.deepEqual(bad, []);
});

test('C-6: removeLines が、ほかの単位の removeLines と同じ行を二重に消さない。ほかの単位の edits.patch が消す行とも重ならない。edits.patch と removeLines も二重にならない', { skip: noPatch }, () => {
  const bad = [];
  const mine = (unit.removeLines ?? []).map((r) => ({ f: r.file, l: r.line.trim() }));
  for (const o of others) {
    for (const r of o.unit.removeLines ?? []) if (mine.some((m) => m.f === r.file && m.l === r.line.trim())) bad.push(`${o.id} の removeLines と同じ: ${r.file}: ${r.line.trim().slice(0, 80)}`);
    for (const s of o.sections) for (const l of s.removed) if (l.trim() && mine.some((m) => m.f === s.path && m.l === l.trim())) bad.push(`${o.id} の edits.patch が消す行と同じ: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  for (const s of sections) {
    const my = (unit.removeLines ?? []).filter((r) => r.file === s.path).map((r) => r.line.trim());
    for (const l of s.removed) if (l.trim() && my.includes(l.trim())) bad.push(`C-6 の edits.patch と removeLines が二重: ${s.path}: ${l.trim().slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('C-6: productRemove は空。依存も消さない(removeDependencies は空)', { skip: noUnit }, () => {
  assert.deepEqual(unit.productRemove ?? [], []);
  assert.deepEqual(unit.removeDependencies ?? {}, {});
});

// --- edits.patch の形 ---
test('C-6: edits.patch が触るファイルは設定の画面と再起動の部品の5ファイルだけ。新しいファイルも、消すファイルも無い', { skip: noPatch }, () => {
  assert.deepEqual(sections.map((s) => s.path).sort(), [...EDITED_FILES].sort());
  assert.deepEqual(sections.filter((s) => s.isNew || s.isDelete).map((s) => s.path), []);
});

test('C-6: edits.patch はプロファイル・拡張の管理・更新・アカウント・拡張 API・platform/userDataSync・main のファイル・続きの編集(contrib/editSessions)に触れない。delete したファイルも直さない', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  assert.deepEqual(sections.filter((s) => FORBIDDEN_TOUCH.test(s.path) || underAny(del, s.path)).map((s) => s.path), []);
});

test('C-6: 続きの編集(contrib/editSessions)に触れない(ユーザーの裁定で残す): unit.json の delete・kept・removeLines・checks と edits.patch のどこにも contrib/editSessions が出ない', { skip: noPatch }, () => {
  const text = JSON.stringify(unit);
  assert.ok(!/editSessions/i.test(text), 'unit.json に editSessions が出る');
  assert.ok(!/editSessions/i.test(patchText.replace(/^Subject:.*$/m, '')), 'edits.patch に editSessions が出る');
  assert.ok(!sections.some((s) => /editSessions/.test(s.path)));
  // 残す理由が README に書かれている(裁定を見失わない)
  const readme = join(UNIT_DIR, 'README.md');
  if (existsSync(readme)) assert.match(readFileSync(readme, 'utf8'), /editSessions|続きの編集/);
});

test('C-6: 続きの編集が頼る部品は、消さない側にある(本家の contrib/editSessions の userDataSync の import が、delete の外の platform/userDataSync・残るサービスに解決する)', { skip: skipUp }, () => {
  const files = upGrepFiles('userDataSync', [EDIT_SESSIONS]);
  assert.ok(files.length >= 3, `本家の editSessions の同期への依存が読めない: ${files.join(',')}`);
  const del = unit.delete ?? [];
  const bad = [];
  for (const f of files) {
    const t = upShow(f);
    for (const m of t.matchAll(/^import\b[^;]*?\bfrom\s+'([^']+)';/gm)) {
      if (!/userDataSync/i.test(m[1])) continue;
      const target = posix.normalize(posix.join(posix.dirname(f), m[1])).replace(/\.js$/, '.ts');
      if (underAny(del, target)) bad.push(`${f}: ${m[1]} は C-6 の delete の中`);
      else if (!upHas(target)) bad.push(`${f}: ${m[1]} (${target}) が本家に無い`);
      else if (!underAny((unit.kept ?? []).map((k) => k.path), target) && !/^src\/vs\/platform\/userDataSync\//.test(target)) bad.push(`${f}: ${m[1]} が kept の外(${target})`);
    }
    // 消す部品のサービスを注入していない
    if (/IUserDataSyncWorkbenchService/.test(t)) bad.push(`${f}: 消す IUserDataSyncWorkbenchService を使っている`);
  }
  assert.deepEqual(bad, []);
});

test('C-6: 設定の画面(settingsEditor2.ts)の直しは、同期の部品だけを消す: SyncControls のクラス、2つの注入、同期の部品を作る分岐、lastSyncedLabel と読み上げの連結。足すのは使われなくなった import の書き換えだけ', { skip: noPatch }, () => {
  const s = section('contrib/preferences/browser/settingsEditor2.ts');
  assert.ok(s);
  assert.ok(s.removed.some((l) => /^class SyncControls extends Disposable/.test(l)));
  assert.ok(s.removed.some((l) => /@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService/.test(l)));
  assert.ok(s.removed.some((l) => /@IUserDataSyncEnablementService private readonly userDataSyncEnablementService/.test(l)));
  assert.ok(s.removed.some((l) => /this\.userDataSyncWorkbenchService\.enabled && this\.userDataSyncEnablementService\.canToggleEnablement\(\)/.test(l)));
  assert.ok(s.removed.some((l) => /private lastSyncedLabel: string \| null = null;/.test(l)));
  assert.ok(s.removed.some((l) => /label \+= `\. \$\{this\.lastSyncedLabel\}`;/.test(l)));
  assert.ok(s.removed.some((l) => /Backup and Sync Settings/.test(l)));
  // 足す行は import の整理だけ(取り込む名前を減らす書き換え)
  assert.ok(s.added.length >= 1 && s.added.every((l) => /^import \{/.test(l)), `足す行が import 以外: ${JSON.stringify(s.added)}`);
  assert.ok(!s.added.some((l) => /UserDataSync|SyncControls|lastSynced/.test(l)));
  // 設定の画面の本体は消していない(クラス・ヘッダーの作り・検索の入力)
  assert.ok(s.context.some((l) => /headerControlsContainer|this\.controlsElement = DOM\.append\(this\.searchContainer/.test(l)), 'ヘッダーの作りが文脈に無い(消えた)');
  assert.ok(!s.removed.some((l) => /^export class SettingsEditor2 extends EditorPane/.test(l)));
  const css = section('settingsEditor2.css');
  assert.deepEqual(css.removed.filter((l) => l.trim()), ['.settings-editor > .settings-header > .settings-header-controls .last-synced-label {', '\topacity: 0.9;', '}']);
  assert.deepEqual(css.added, []);
});

test('C-6: 再起動の部品(relauncher.contribution.ts)の直しは、IUserDataSyncWorkbenchService の注入と onDidTurnOnSync の購読だけ。同期の状態を読む IUserDataSyncService・IUserDataSyncEnablementService の注入と、設定の変更で再起動を尋ねる所は残す', { skip: noPatch }, () => {
  const s = section('contrib/relauncher/browser/relauncher.contribution.ts');
  assert.deepEqual(s.added, []);
  assert.equal(s.removed.length, 3);
  assert.ok(s.removed.some((l) => /^import \{ IUserDataSyncWorkbenchService \}/.test(l)));
  assert.ok(s.removed.some((l) => /@IUserDataSyncWorkbenchService userDataSyncWorkbenchService/.test(l)));
  assert.ok(s.removed.some((l) => /userDataSyncWorkbenchService\.onDidTurnOnSync/.test(l)));
  assert.ok(s.context.some((l) => /@IUserDataSyncService private readonly userDataSyncService/.test(l)));
  assert.ok(s.context.some((l) => /@IUserDataSyncEnablementService private readonly userDataSyncEnablementService/.test(l)));
  assert.ok(s.context.some((l) => /this\._register\(this\.configurationService\.onDidChangeConfiguration/.test(l)));
  assert.ok(s.context.some((l) => /this\.update\(false\);/.test(l)));
  // テスト: コンストラクタの引数を1つ減らす
  const t = section('contrib/relauncher/test/browser/relauncher.test.ts');
  assert.ok(t.added.length === 1 && /new SettingsChangeRelauncher\(hostService, configurationService, userDataSyncService, userDataSyncEnablementService, productService, dialogService\)/.test(t.added[0]));
  assert.ok(t.removed.some((l) => /new SettingsChangeRelauncher\(.*userDataSyncWorkbenchService/.test(l)));
  const st = section('contrib/preferences/test/browser/settingsEditor2.test.ts');
  assert.deepEqual(st.added, []);
  assert.ok(st.removed.every((l) => /IUserDataSyncWorkbenchService/.test(l)));
});

test('C-6: 独立(5.3): 設定の画面・再起動の部品の5ファイルを、ほかの単位の edits.patch・removeLines が触らない。after に挙げない単位との文脈も重ならない', { skip: noPatch }, () => {
  const heavy = (l) => l.trim().length >= 24 && !/^(?:readonly\s+)?[\w$]+\??: [\w<>[\]|.,\s]+;$/.test(l.trim());
  const bad = [];
  for (const o of others) {
    for (const s of o.sections) if (EDITED_FILES.includes(s.path)) bad.push(`${o.id} の edits.patch が C-6 と同じファイル ${s.path} に触る`);
    for (const r of o.unit.removeLines ?? []) if (EDITED_FILES.includes(r.file)) bad.push(`${o.id} の removeLines が ${r.file} に触る`);
    if (unit.after.includes(o.id)) continue;
    for (const mine of sections) {
      const theirs = o.sections.find((x) => x.path === mine.path);
      if (!theirs) continue;
      const tr = new Set(theirs.removed.filter(heavy).map((l) => l.trim()));
      for (const l of mine.old) if (heavy(l) && tr.has(l.trim())) bad.push(`${o.id} ${mine.path}: ${l.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// 2. 型検査に掛からない注入の外し損ねの検査(期待は本家から読む)
// ---------------------------------------------------------------------------
// 消す部品が登録するサービスの ID。`registerSingleton(<ID>,` を、delete したパスの中から本家で探す。
function registeredIds() {
  const rows = upGrepLines('registerSingleton\\(\\s*\\w+\\s*,', (unit.delete ?? []).map((d) => d.replace(/\/+$/, '')));
  return [...new Set(rows.map((r) => /registerSingleton\(\s*(\w+)\s*,/.exec(r.text)?.[1]).filter(Boolean))].sort();
}
/** delete の外で、その ID を使う本家のファイル(定義のファイルを除く) */
function usersOutsideDelete(id) {
  const del = unit.delete ?? [];
  return upGrepFiles(`\\b${id}\\b`, ['src/vs']).filter((f) => !underAny(del, f)).filter((f) => !new RegExp(`createDecorator<${id}>`).test(upShow(f) ?? ''));
}

test('C-6 注入: 消す部品が登録するサービスは IUserDataSyncWorkbenchService だけ(本家から読む)。消したファイルが registerSingleton していたもの', { skip: skipUp }, () => {
  assert.deepEqual(registeredIds(), ['IUserDataSyncWorkbenchService']);
  // 窓の側に登録していた contribution も、サービスを登録しない(contrib/userDataSync に registerSingleton は他に無い)
  const rows = upGrepLines('registerSingleton\\(', [`${W}contrib/userDataSync`]);
  assert.deepEqual(rows.map((r) => r.file), []);
});

test('C-6 注入: 消したサービスの ID を使う所は、edits.patch を当てた後、update.ts(判断済みの例外)だけになる(定義の common/userDataSync.ts と delete の中を除く)。注入(@ID)も取得(.get(ID))も', { skip: skipUpPatch }, () => {
  const left = [];
  for (const id of registeredIds()) {
    for (const f of usersOutsideDelete(id)) {
      let t = upShow(f);
      const sec = sections.find((s) => s.path === f);
      if (sec) {
        const patched = applyHunks(t, sec.hunks);
        // 本家のままでは当たらない(C-1 が先に変える文脈)場合は、消す行・足す行で見る
        t = patched ?? t.split('\n').filter((l) => !sec.removed.includes(l)).concat(sec.added).join('\n');
      }
      if (new RegExp(`\\b${id}\\b`).test(t)) left.push(`${f} (${id})`);
    }
  }
  assert.deepEqual(left.sort(), INJECTION_EXCEPTIONS.map((f) => `${f} (IUserDataSyncWorkbenchService)`).sort(), '消したサービスを使う所が、例外の update.ts 以外に残る(起動時に UNKNOWN service になる)');
});

test('C-6 注入: 例外の update.ts の使い方は、デスクトップで呼ばれない(Web の埋め込み側の値があるときだけ登録される操作の中で accessor.get する)。edits.patch は update.ts に触れない', { skip: skipUp }, () => {
  const t = upShow(UPDATE_TS);
  const uses = [...t.matchAll(/accessor\.get\(IUserDataSyncWorkbenchService\)|@IUserDataSyncWorkbenchService/g)];
  assert.equal(uses.length, 1, 'update.ts の使い方が1つでない');
  assert.match(t, /accessor\.get\(IUserDataSyncWorkbenchService\)/, '注入(@ID)でなく取得(accessor.get)であること(コンストラクタ注入だと、デスクトップでも作られて落ちる)');
  // その取得が、操作の run の中にある(コンストラクタの外)
  const at = t.indexOf('accessor.get(IUserDataSyncWorkbenchService)');
  const before = t.slice(0, at);
  assert.ok(before.lastIndexOf('run(accessor') > before.lastIndexOf('constructor('), 'accessor.get が操作の run の中でない');
  assert.ok(!sections.some((s) => s.path === UPDATE_TS), 'update.ts を edits.patch が触っている(判断は「直さない」)');
});

test('C-6 注入: 残す同期のサービス(@IUserDataSync*Service・@IUserDataAutoSyncService)は、delete の外に登録がある(消した登録に頼っていない)', { skip: skipUp }, () => {
  const del = unit.delete ?? [];
  const ids = new Set(upGrepLines('@(IUserDataSync\\w*Service|IUserDataAutoSyncService)\\b', [`${W}`]).filter((r) => !underAny(del, r.file) && !EDITED_FILES.includes(r.file))
    .flatMap((r) => [...r.text.matchAll(/@(IUserDataSync\w*Service|IUserDataAutoSyncService)\b/g)].map((m) => m[1])));
  ids.delete('IUserDataSyncWorkbenchService');
  assert.ok(ids.size >= 4, `注入される同期のサービスが少ない: ${[...ids].join(',')}`);
  const unregistered = [];
  for (const id of ids) {
    const regs = upGrepFiles(`(registerSingleton|registerSharedProcessRemoteService|services\\.set)\\(\\s*${id}\\b`, ['src/vs']).filter((f) => !underAny(del, f));
    if (!regs.length) unregistered.push(id);
  }
  assert.deepEqual(unregistered, [], '注入されるのに、delete の外に登録が無いサービス');
});

test('C-6 注入: 消す部品が窓の側に登録していた共有プロセスのチャンネル(userDataSyncUtil)は、delete の外で registerChannel されない。共有プロセスの代理(IUserDataSyncUtilService)は残る', { skip: skipUp }, () => {
  const del = unit.delete ?? [];
  const channels = [...new Set(upGrepLines("registerChannel\\('\\w+'", del.map((d) => d.replace(/\/+$/, ''))).filter((r) => !/\/test\//.test(r.file)).map((r) => /registerChannel\('(\w+)'/.exec(r.text)[1]))];
  assert.deepEqual(channels, ['userDataSyncUtil']);
  for (const c of channels) {
    const remaining = upGrepLines(`registerChannel\\('${c}'`, ['src/vs']).filter((r) => !underAny(del, r.file) && !/\/test\//.test(r.file));
    assert.deepEqual(remaining.map((r) => r.file), [], `delete の外にチャンネル ${c} の登録が残る`);
  }
  assert.ok(upGrep('IUserDataSyncUtilService', [`${W}services/userDataSync/common/userDataSyncUtil.ts`]));
  assert.ok((unit.kept ?? []).some((k) => k.path === `${W}services/userDataSync/common/userDataSyncUtil.ts`));
});

// --- checks ---
test('C-6: checks は absentCommands 2つ・absentViews 空・absentSettings 空・absentStrings 9つ。消すコマンドは、本家の delete の中で条件なしに登録され、delete の外に無い(空振りしない)', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  assert.deepEqual([...(ck.absentCommands ?? [])].sort(), ['workbench.userData.actions.openSyncBackupsFolder', 'workbench.userDataSync.actions.downloadSyncActivity']);
  assert.deepEqual(ck.absentViews ?? [], []);
  assert.deepEqual(ck.absentSettings ?? [], []);
  assert.equal((ck.absentStrings ?? []).length, 9);
  assert.deepEqual(ck.absentProcesses ?? [], []);
  assert.deepEqual(ck.absentHosts ?? [], []);
  const del = unit.delete ?? [];
  for (const c of ck.absentCommands) {
    const files = upGrepFiles(c, ['src/vs'], ['-l', '-F']);
    // 残るのは、kept の common/userDataSync.ts にある ID の定義(DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR)だけ。登録(registerAction2)は delete の中にある
    const outside = files.filter((f) => !underAny(del, f));
    if (!files.some((f) => underAny(del, f))) {
      // ID の文字列は kept の定義にだけあり、登録は定数(…_DESCRIPTOR など)経由で delete の中がする
      const src = upShow(SYNC_COMMON);
      const at = src.indexOf(`'${c}'`);
      const name = [...src.slice(0, at).matchAll(/export const (\w+)\b/g)].pop()?.[1];
      assert.ok(name, `${c}: 定義の定数が読めない`);
      assert.ok(upGrepFiles(`\\b${name}\\b`, del.map((d) => d.replace(/\/+$/, ''))).length >= 1, `${c}: 定数 ${name} を delete の中が使っていない(登録が消えない)`);
      assert.ok(upGrepFiles(`\\b${name}\\b`, ['src/vs']).filter((f) => !underAny(del, f) && f !== SYNC_COMMON).length === 0, `${c}: 定数 ${name} を delete の外が使っている`);
    }
    assert.ok(outside.every((f) => f === SYNC_COMMON), `${c}: delete の外に、定義の common/userDataSync.ts 以外の当たりがある: ${outside.join(',')}`);
    if (outside.length) assert.ok(!/registerAction2|registerCommand|CommandsRegistry/.test(upShow(SYNC_COMMON)), `${c}: kept の定義のファイルが登録している`);
  }
});

test('C-6: checks の項目が本家 1.146.0 にあり、absentStrings は本家の kept でないファイルに当たる（C-2 の見張りの形）', { skip: skipUp }, () => {
  const ck = unit.checks ?? {};
  const miss = [];
  const kept = (unit.kept ?? []).map((k) => k.path);
  for (const { in: where, text } of ck.absentStrings ?? []) {
    const files = upGrepFiles(text, where, ['-l', '-F']);
    if (!files.length) miss.push(`文字列 ${text} (${where.join(', ')}): 本家に無い`);
    else if (!files.some((f) => !underAny(kept, f))) miss.push(`文字列 ${text} (${where.join(', ')}): 当たりがすべて kept`);
  }
  assert.deepEqual(miss, []);
});

test('C-6: edits.patch が足す行に absentStrings の文字列が現れない（kept の対象を除く。当てた後の検査で自分が落ちない）', { skip: noPatch }, () => {
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

test('C-6: smoke に claude-code がある(Claude Code の受け手を壊していないことを関門で見る)。本家の manifest に同期の語を持たない拡張を壊さない', { skip: noUnit }, () => {
  assert.ok((unit.smoke ?? []).includes('claude-code') && (unit.smoke ?? []).includes('absence'));
});

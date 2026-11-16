// tests/c6-check-worktree.mjs（当てた後の作業ツリーの照らし役）の検査。
// 本物の木(C:\b\wt\p2)は大岡越前守が当てるので、ここでは本家 1.146.0 のファイルに、前の単位（組 a は A・B と C-1、組 b はそれに C-2〜C-5）の
// removeLines と edits.patch、続けて C-6 の removeLines と edits.patch を、自前の小さな当て方で順に当てた木を一時のフォルダに作り、
// 期待どおり・壊した木を照らす(C-6 が触るファイル、消したサービスの ID を使う本家のファイル、続きの編集のファイルを追う)。当たらないハンクがあれば、そのこと自体が失敗になる。
// Run: node --test tests/c6-worktree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_WORD_FILES, checkWorktree, EDIT_SESSIONS, MAINS, MUST_STAY, REGISTERED_IDS, RELAUNCHER, RELAUNCHER_TEST, SETTINGS, SETTINGS_CSS, SETTINGS_TEST, SYNC_COMMON, UPDATE_TS } from './c6-check-worktree.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const ME = 'C-6-settings-sync';
const unit = readJson(join(REPO, 'removals', ME, 'unit.json'));
import { UPSTREAM_REPO as UP_DEFAULT } from './build/root.mjs';
const UP_REPO = UP_DEFAULT; // 常設の clone（<buildRoot>/vscode。tests/build/root.mjs）
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const skipUp = upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };
const upList = (dir) => (spawnSync('git', ['-C', UP_REPO, 'ls-tree', '-r', '--name-only', UP_TAG, dir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '').split('\n').filter(Boolean);
const upGrepFiles = (word) => (spawnSync('git', ['-C', UP_REPO, 'grep', '-l', '-w', '-e', word, UP_TAG, '--', 'src/vs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '')
  .split('\n').filter(Boolean).map((l) => l.slice(UP_TAG.length + 1));
const W = 'src/vs/workbench/';

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
  const want = (id) => /^[AB]-/.test(id) || id === 'C-1-ai' || id === ME || (full && ['C-2-debug', 'C-3-remote', 'C-4-notebook', 'C-5-extension-gallery'].includes(id));
  return allIds().filter(want).map(loadUnit).sort((a, b) => a.unit.order - b.unit.order);
};

/** 本家のファイルに、前の単位と C-6 の removeLines・edits.patch を順に当てた木を作る。追うのは、C-6 が触るファイル、main、消したサービスの ID を使う本家のファイル、続きの編集。 */
function makeAppliedTree({ full = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c6wt-'));
  const put = (rel, content) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
  const me = loadUnit(ME);
  const idUsers = REGISTERED_IDS.flatMap((id) => upGrepFiles(id)).filter((f) => !f.startsWith(`${W}contrib/userDataSync/`) && f !== `${W}services/userDataSync/browser/userDataSyncWorkbenchService.ts`);
  const tracked = new Set([...me.sections.map((s) => s.path), ...(me.unit.removeLines ?? []).map((r) => r.file), ...MAINS, ...idUsers, ...upList(EDIT_SESSIONS).filter((f) => f.endsWith('.ts'))]);
  const files = new Map();
  for (const p of tracked) { if (!me.sections.find((s) => s.path === p && s.isNew)) { const t = upShow(p); assert.ok(t !== null, `本家に無い: ${p}`); files.set(p, t); } }
  for (const u of chain(full)) {
    for (const r of u.unit.removeLines ?? []) {
      if (!files.has(r.file)) continue;
      const lines = files.get(r.file).split('\n');
      const i = lines.findIndex((l) => l.trim() === r.line.trim());
      if (i >= 0) { lines.splice(i, 1); files.set(r.file, lines.join('\n')); } else assert.ok(u.id !== ME, `C-6 の removeLines の行が無い: ${r.file}: ${r.line}`);
    }
    for (const s of u.sections) {
      if (s.isNew) continue;
      if (!files.has(s.path)) continue;
      files.set(s.path, applyHunks(files.get(s.path), s.hunks, `${u.id} ${s.path}`));
    }
  }
  for (const [p, t] of files) put(p, t);
  for (const k of [...me.unit.kept.map((x) => x.path), ...MUST_STAY]) {
    const f = join(root, ...k.split('/'));
    if (existsSync(f)) continue;
    if (/\.[A-Za-z0-9]+$/.test(k)) put(k, 'x'); else mkdirSync(f, { recursive: true });
  }
  return root;
}
const edit = (root, rel, fn) => { const f = join(root, ...rel.split('/')); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
const add = (root, rel, text) => { const f = join(root, ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };

for (const full of [false, true]) {
  test(`c6-check-worktree: 本家に前の単位(組 ${full ? 'b' : 'a'})と C-6 の removeLines・edits.patch を順に当てた木は、食い違いが無い(edits.patch の出力と照らし役の期待が合っている)`, { skip: skipUp }, () => {
    const root = makeAppliedTree({ full });
    try { assert.deepEqual(checkWorktree(root, unit), []); } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c6-check-worktree: 木の中に、消したサービスの語を持つ本家のファイルが追われている(例外の update.ts と定義のファイルが入っていて、空振りの木ではない)', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try {
    for (const f of ALLOWED_WORD_FILES) assert.ok(existsSync(join(root, ...f.split('/'))), `${f} が木に無い`);
    assert.match(readFileSync(join(root, ...UPDATE_TS.split('/')), 'utf8'), /IUserDataSyncWorkbenchService/);
    assert.ok(readdirSync(join(root, ...EDIT_SESSIONS.split('/')), { recursive: true }).length >= 3, '続きの編集のファイルが木に無い');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c6-check-worktree: 当てていない木(本家のまま)は、食い違いが多数出る(注入・import・チャンネル・SyncControls・onDidTurnOnSync・消すはずの行・消すはずのパス)', { skip: skipUp }, () => {
  const root = mkdtempSync(join(tmpdir(), 'c6wt-'));
  try {
    const paths = new Set([SETTINGS, SETTINGS_CSS, SETTINGS_TEST, RELAUNCHER, RELAUNCHER_TEST, ...MAINS, ...REGISTERED_IDS.flatMap((id) => upGrepFiles(id)),
      `${W}contrib/userDataSync/electron-browser/userDataSyncUtilChannel.contribution.ts`]);
    for (const p of paths) add(root, p, upShow(p));
    const bad = checkWorktree(root, unit);
    for (const re of [/に消したサービスの注入 @IUserDataSyncWorkbenchService が残る/, /に消した部品への import が残る/, /registerChannel|チャンネル userDataSyncUtil/, /SyncControls/, /lastSyncedLabel/, /last-synced-label/, /onDidTurnOnSync/,
      /にまだ消すはずの行がある/, /消えているはずのパスが残っている/, /残るはずのパスが無い/]) {
      assert.ok(bad.some((x) => re.test(x)), `${re} が出ない: ${bad.slice(0, 6).join(' / ')}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const BREAKERS = [
  ['消す部品のフォルダが残る', (r) => add(r, `${W}contrib/userDataSync/browser/userDataSync.ts`, 'x'), /消えているはずのパスが残っている: .*contrib\/userDataSync/],
  ['消すワークベンチのサービスが残る', (r) => add(r, `${W}services/userDataSync/browser/userDataSyncWorkbenchService.ts`, 'x'), /消えているはずのパスが残っている: .*userDataSyncWorkbenchService\.ts/],
  ['残すはずの同期の状態のサービスが消える', (r) => rmSync(join(r, ...`${W}services/userDataSync/browser/userDataSyncEnablementService.ts`.split('/'))), /残るはずのパスが無い: .*userDataSyncEnablementService\.ts/],
  ['残すはずの共有プロセスへの代理が消える', (r) => rmSync(join(r, ...`${W}services/userDataSync/electron-browser`.split('/')), { recursive: true }), /残るはずのパスが無い: .*electron-browser/],
  ['残すはずの定義のファイルが消える', (r) => rmSync(join(r, ...SYNC_COMMON.split('/'))), /残るはずのパスが無い: .*common\/userDataSync\.ts/],
  ['残すはずの platform/userDataSync が消える', (r) => rmSync(join(r, ...'src/vs/platform/userDataSync'.split('/')), { recursive: true }), /残るはずのパスが無い: .*platform\/userDataSync/],
  ['アカウントのメニューが消える', (r) => rmSync(join(r, ...`${W}services/accounts`.split('/')), { recursive: true }), /残るはずのパスが無い: .*services\/accounts/],
  ['続きの編集が消える', (r) => rmSync(join(r, ...EDIT_SESSIONS.split('/')), { recursive: true }), /残るはずのパスが無い: .*contrib\/editSessions/],
  ['続きの編集が消したサービスを使う', (r) => add(r, `${EDIT_SESSIONS}/browser/extra.ts`, 'const x = accessor.get(IUserDataSyncWorkbenchService);\n'), /contrib\/editSessions\/browser\/extra\.ts/],
  ['別の部品に注入が残る(型検査に掛からない)', (r) => add(r, `${W}contrib/foo/browser/foo.ts`, 'constructor(@IUserDataSyncWorkbenchService private readonly s: IUserDataSyncWorkbenchService) {}\n'), /foo\.ts に消したサービスの注入 @IUserDataSyncWorkbenchService が残る/],
  ['別の部品が accessor.get で取る', (r) => add(r, `${W}contrib/foo/browser/bar.ts`, 'const s = accessor.get(IUserDataSyncWorkbenchService);\n'), /bar\.ts に消したサービス IUserDataSyncWorkbenchService を使う所が残る/],
  ['設定の画面に注入が残る', (r) => edit(r, SETTINGS, (t) => t + '\nconstructor(@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService: any) {}\n'), /settingsEditor2\.ts に消したサービスの注入/],
  ['設定の画面に SyncControls が残る', (r) => edit(r, SETTINGS, (t) => t + '\nclass SyncControls extends Disposable {}\n'), /settingsEditor2\.ts にまだ SyncControls/],
  ['設定の画面に lastSyncedLabel が残る', (r) => edit(r, SETTINGS, (t) => t + '\nprivate lastSyncedLabel: string | null = null;\n'), /settingsEditor2\.ts にまだ lastSyncedLabel/],
  ['設定の画面の本体が消える', (r) => edit(r, SETTINGS, (t) => t.replace('export class SettingsEditor2 extends EditorPane', 'export class Other extends EditorPane')), /SettingsEditor2 が無い/],
  ['CSS に last-synced-label が残る', (r) => edit(r, SETTINGS_CSS, (t) => t + '\n.last-synced-label { opacity: 0.9; }\n'), /settingsEditor2\.css にまだ last-synced-label/],
  ['設定の画面のテストに消したサービスの stub が残る', (r) => edit(r, SETTINGS_TEST, (t) => t + '\ninstantiationService.stub(IUserDataSyncWorkbenchService, {});\n'), /settingsEditor2\.test\.ts にまだ IUserDataSyncWorkbenchService/],
  ['再起動の部品に onDidTurnOnSync が残る', (r) => edit(r, RELAUNCHER, (t) => t + '\nthis.x.onDidTurnOnSync(() => {});\n'), /relauncher\.contribution\.ts にまだ onDidTurnOnSync/],
  ['再起動の部品から @IUserDataSyncService の注入が消える', (r) => edit(r, RELAUNCHER, (t) => t.split('@IUserDataSyncService private readonly userDataSyncService').join('@IOther private readonly other')), /@IUserDataSyncService の注入が消えている/],
  ['再起動の部品から @IUserDataSyncEnablementService の注入が消える', (r) => edit(r, RELAUNCHER, (t) => t.split('@IUserDataSyncEnablementService private readonly userDataSyncEnablementService').join('@IOther private readonly other2')), /@IUserDataSyncEnablementService の注入が消えている/],
  ['再起動の部品から設定の変更の購読が消える', (r) => edit(r, RELAUNCHER, (t) => t.split('onDidChangeConfiguration').join('onOther')), /設定の変更で再起動を尋ねる所が消えている/],
  ['再起動のテストに消したサービスが残る', (r) => edit(r, RELAUNCHER_TEST, (t) => t + '\nconst userDataSyncWorkbenchService = {};\n'), /relauncher\.test\.ts にまだ/],
  ['消した部品への import が残る', (r) => add(r, `${W}contrib/foo/browser/baz.ts`, "import { X } from '../../userDataSync/browser/userDataSyncWorkbenchService.js';\n"), /baz\.ts に消した部品への import が残る/],
  ['消した部品の contribution の import が残る(main)', (r) => edit(r, MAINS[0], (t) => t + "\nimport './contrib/userDataSync/browser/userDataSync.contribution.js';\n"), /workbench\.common\.main\.ts に消した部品への import|にまだ contrib\/userDataSync\//],
  ['デスクトップの main に import が残る', (r) => edit(r, MAINS[1], (t) => t + "\nimport './contrib/userDataSync/electron-browser/userDataSync.contribution.js';\n"), /workbench\.desktop\.main\.ts に消した部品への import|にまだ消すはずの行がある/],
  ['共有プロセスのチャンネルの登録が残る', (r) => add(r, `${W}contrib/foo/electron-browser/chan.ts`, "sharedProcessService.registerChannel('userDataSyncUtil', x);\n"), /チャンネル userDataSyncUtil の登録が残る/],
];
for (const [name, brk, re] of BREAKERS) {
  test(`c6-check-worktree: 壊した木(${name})は食い違いが出る`, { skip: skipUp }, () => {
    const root = makeAppliedTree();
    try {
      brk(root);
      const bad = checkWorktree(root, unit);
      assert.ok(bad.some((x) => re.test(x)), `${name}: 見つけない: ${JSON.stringify(bad)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('c6-check-worktree: 例外の update.ts は許す(語があっても食い違いにならない)が、例外でないファイルに同じ語があれば出る', { skip: skipUp }, () => {
  const root = makeAppliedTree();
  try {
    assert.deepEqual(checkWorktree(root, unit), []);
    add(root, `${W}contrib/other/browser/update2.ts`, readFileSync(join(root, ...UPDATE_TS.split('/')), 'utf8'));
    assert.ok(checkWorktree(root, unit).some((x) => /update2\.ts に消したサービス/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('c6-check-worktree: コマンドとして走らせると、期待どおりの木で 0、壊した木で 1、引数が無い・フォルダが無いで 2', { skip: skipUp }, () => {
  const run = (...args) => spawnSync(process.execPath, [join('tests', 'c6-check-worktree.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
  const good = makeAppliedTree();
  try {
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /期待どおり/);
    edit(good, SETTINGS, (t) => t + '\nclass SyncControls {}\n');
    const ng = run(good);
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /食い違い/);
  } finally { rmSync(good, { recursive: true, force: true }); }
  assert.equal(run().status, 2);
  assert.equal(run(join(tmpdir(), 'c6wt-nonexistent-dir')).status, 2);
});

test('c6-check-worktree: 空の木(本家が読めなくても動く)は「ファイルが無い」「残るはずのパスが無い」を出し、「消えているはずのパスが残っている」は出さない', () => {
  const root = mkdtempSync(join(tmpdir(), 'c6wt-'));
  try {
    const bad = checkWorktree(root, unit);
    assert.ok(bad.some((x) => /ファイルが無い: .*settingsEditor2\.ts/.test(x)));
    assert.ok(bad.some((x) => /残るはずのパスが無い/.test(x)));
    assert.ok(!bad.some((x) => /消えているはずのパスが残っている/.test(x)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

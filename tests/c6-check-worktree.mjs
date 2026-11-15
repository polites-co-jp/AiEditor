// C-6 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c6-patch/handoff-notes.md の「テストの入口」、removals/C-6-settings-sync/unit.json と README、
//   本家 1.146.0（消す部品が登録するサービスの ID は IUserDataSyncWorkbenchService。tests/c6-unit.test.mjs が本家から読んで、この REGISTERED_IDS と合っていることを確かめる）。
//   - unit.json の delete が全部無い。kept がある（同期の状態のサービス・共有プロセスへの代理・platform/userDataSync・アカウント）
//   - 型検査に掛からない注入の外し損ね: src/vs の全体で、消したサービスの ID（IUserDataSyncWorkbenchService）を使う所が、定義の common/userDataSync.ts と
//     判断済みの例外 contrib/update/browser/update.ts だけ。`@IUserDataSyncWorkbenchService` の注入はどこにも無い。消した部品への import も無い
//   - 消した部品が窓の側に登録していた共有プロセスのチャンネル registerChannel('userDataSyncUtil' が無い
//   - 設定の画面(settingsEditor2.ts)に SyncControls・lastSyncedLabel・IUserDataSync の語が無く、CSS に last-synced-label が無い。設定の画面の本体はある
//   - 再起動の部品(relauncher.contribution.ts)に onDidTurnOnSync・IUserDataSyncWorkbenchService が無く、@IUserDataSyncService・@IUserDataSyncEnablementService はある
//   - 続きの編集(contrib/editSessions)は触れていない: ディレクトリが残り、消した部品への import も IUserDataSyncWorkbenchService の語も無い（裁定で残す）
//   - removeLines の行が各ファイルに残っていない
// 使い方: node tests/c6-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
export const SETTINGS = `${W}contrib/preferences/browser/settingsEditor2.ts`;
export const SETTINGS_CSS = `${W}contrib/preferences/browser/media/settingsEditor2.css`;
export const SETTINGS_TEST = `${W}contrib/preferences/test/browser/settingsEditor2.test.ts`;
export const RELAUNCHER = `${W}contrib/relauncher/browser/relauncher.contribution.ts`;
export const RELAUNCHER_TEST = `${W}contrib/relauncher/test/browser/relauncher.test.ts`;
export const UPDATE_TS = `${W}contrib/update/browser/update.ts`;
export const SYNC_COMMON = `${W}services/userDataSync/common/userDataSync.ts`;
export const EDIT_SESSIONS = `${W}contrib/editSessions`;
export const MAINS = [`${W}workbench.common.main.ts`, `${W}workbench.desktop.main.ts`];
/** 消す部品が登録するサービスの ID（本家の delete の中の registerSingleton から読んだもの） */
export const REGISTERED_IDS = ['IUserDataSyncWorkbenchService'];
/** その ID の語を、作業ツリーに残してよいファイル(定義と、判断済みの例外) */
export const ALLOWED_WORD_FILES = [SYNC_COMMON, UPDATE_TS];
export const MUST_BE_DELETED = [`${W}contrib/userDataSync`, `${W}services/userDataSync/browser/userDataSyncWorkbenchService.ts`];
export const MUST_STAY = [SYNC_COMMON, `${W}services/userDataSync/browser/userDataSyncEnablementService.ts`, `${W}services/userDataSync/electron-browser/userDataSyncService.ts`,
  `${W}services/userDataSync/common/userDataSyncUtil.ts`, 'src/vs/platform/userDataSync', `${W}services/accounts`, EDIT_SESSIONS];
const DELETED_IMPORT = /['"][^'"\n]*(contrib\/userDataSync\/|userDataSync\/browser\/userDataSyncWorkbenchService)[^'"\n]*['"]/;

/** src/vs の下の .ts を全部たどる(node_modules は除く)。[相対パス, 本文] の配列。 */
function allTs(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (e.name.endsWith('.ts')) out.push([r, readFileSync(join(dir, e.name), 'utf8').replace(/\r\n/g, '\n')]);
    }
  };
  const base = join(root, 'src', 'vs');
  if (existsSync(base)) walk(base, 'src/vs');
  return out;
}

/** root: 作業ツリーのフォルダ。unit: removals/C-6-settings-sync/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  const withText = (p, fn) => { const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t, p.split('/').pop()); };
  const forbid = (t, name, words) => { for (const w of words) if (t.includes(w)) bad.push(`${name} にまだ ${w} がある`); };

  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);

  // 型検査に掛からない注入の外し損ね: src/vs の全体で、消したサービスの ID の語・消した部品への import・チャンネルの登録を探す
  for (const [rel, t] of allTs(root)) {
    for (const id of REGISTERED_IDS) {
      if (new RegExp(`@${id}\\b`).test(t)) bad.push(`${rel} に消したサービスの注入 @${id} が残る(起動時に UNKNOWN service になる)`);
      else if (new RegExp(`\\b${id}\\b`).test(t) && !ALLOWED_WORD_FILES.includes(rel)) bad.push(`${rel} に消したサービス ${id} を使う所が残る(判断済みの例外は ${ALLOWED_WORD_FILES.join(' と ')} だけ)`);
    }
    // 試験用のデータファイル(ソースの断片を文字列で持つ)は、import の検査から除く
    if (!/\.perf-data\.ts$/.test(rel) && DELETED_IMPORT.test(t.split('\n').filter((l) => /^\s*(import|export)\b|\bfrom\s+['"]/.test(l)).join('\n'))) bad.push(`${rel} に消した部品への import が残る`);
    if (t.includes("registerChannel('userDataSyncUtil'")) bad.push(`${rel} に消した部品の共有プロセスのチャンネル userDataSyncUtil の登録が残る`);
  }

  withText(SETTINGS, (t, n) => {
    forbid(t, n, ['SyncControls', 'lastSyncedLabel', 'last-synced-label', 'IUserDataSync', 'userDataSyncWorkbenchService', 'userDataSyncEnablementService']);
    if (!/export class SettingsEditor2 extends EditorPane/.test(t)) bad.push(`${n} に SettingsEditor2 が無い(設定の画面の本体が消えた)`);
  });
  withText(SETTINGS_CSS, (t, n) => forbid(t, n, ['last-synced-label']));
  withText(SETTINGS_TEST, (t, n) => forbid(t, n, ['IUserDataSyncWorkbenchService']));
  withText(RELAUNCHER, (t, n) => {
    forbid(t, n, ['onDidTurnOnSync', 'IUserDataSyncWorkbenchService', 'userDataSyncWorkbenchService']);
    if (!/@IUserDataSyncService private readonly userDataSyncService/.test(t)) bad.push(`${n} から @IUserDataSyncService の注入が消えている(残す)`);
    if (!/@IUserDataSyncEnablementService private readonly userDataSyncEnablementService/.test(t)) bad.push(`${n} から @IUserDataSyncEnablementService の注入が消えている(残す)`);
    if (!/onDidChangeConfiguration/.test(t)) bad.push(`${n} から設定の変更で再起動を尋ねる所が消えている(残す)`);
  });
  withText(RELAUNCHER_TEST, (t, n) => forbid(t, n, ['IUserDataSyncWorkbenchService', 'userDataSyncWorkbenchService']));
  for (const f of MAINS) withText(f, (t, n) => forbid(t, n, ['contrib/userDataSync/', 'userDataSyncWorkbenchService']));

  // 続きの編集(contrib/editSessions): 裁定で残す。触れていない
  if (existsSync(at(EDIT_SESSIONS))) {
    const prefix = `${EDIT_SESSIONS}/`;
    const files = allTs(root).filter(([rel]) => rel.startsWith(prefix));
    if (files.length === 0) bad.push(`${EDIT_SESSIONS} に .ts が無い(続きの編集が消えた)`);
    for (const [rel, t] of files) {
      if (/IUserDataSyncWorkbenchService/.test(t)) bad.push(`${rel} が消したサービスを使っている`);
    }
  }

  for (const r of unit.removeLines ?? []) {
    const t = text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c6-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-6-settings-sync', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

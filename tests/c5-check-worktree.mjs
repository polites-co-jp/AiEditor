// C-5 を当てた後の作業ツリーを、期待の状態と照らす。読むだけ。大岡越前守が当て直しの後に走らせる。
// 期待の出どころ: tasks/2026-11-15-p5-c5-patch/handoff-notes.md の「テストの入口」の6（1回目と2回目）、removals/C-5-extension-gallery/unit.json と README。
//   - unit.json の delete が全部無い。kept と新しいファイル2つ(noopExtensionGalleryService.ts・nullExtensionRecommendations.ts)がある
//   - ワークベンチの extensionGalleryService.ts に AbstractExtensionGalleryService が無く、NoopExtensionGalleryService を登録する
//   - extensionGalleryManifestService.ts(electron-browser)にアカウント・要求・私設のマーケットプレイスの設定が無い
//   - browser の extensions.contribution.ts: Null のおすすめ3つを registerSingleton で登録。右クリックのメニュー(ExplorerContext)・ResourceContextKey・
//     「VSIX からインストール」(SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID の登録)・`ext install `・ギャラリーのコマンドが無い。installFromVSIX の登録はある
//   - extensionsViewlet.ts: ギャラリー・おすすめのビューの語、ドロップ(DragAndDropObserver・isSupportedDragElement)が無い
//   - extensionsQuickAccess.ts: ManageExtensionsQuickAccessProvider(`ext `)だけ。InstallExtensionQuickAccessProvider が無い
//   - electron-browser の extensions.contribution.ts に registerChannel('extensionRecommendationNotification' が無い
//   - sharedProcessMain.ts に tips の名前が無い。workbench.{common,desktop}.main.ts に消した部品の import が無い
//   - removeLines の行が各ファイルに残っていない
//   - CLI の道(code/node/cliProcessMain.ts など)は、作業ツリーにあれば、自分でギャラリーとマニフェストを組んでいること(触れていない)
// 使い方: node tests/c5-check-worktree.mjs <作業ツリー> （終了コード 0 = 期待どおり、1 = 食い違い、2 = 使い方の誤り）
// 置き場所: tests/ の直下(大岡越前守の許可 `node tests/*.mjs` に一致させるため)。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const W = 'src/vs/workbench/';
export const NOOP_GALLERY = `${W}services/extensionManagement/common/noopExtensionGalleryService.ts`;
export const NULL_RECS = `${W}services/extensionRecommendations/common/nullExtensionRecommendations.ts`;
export const GALLERY_COMMON = `${W}services/extensionManagement/common/extensionGalleryService.ts`;
export const MANIFEST = `${W}services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`;
export const EXT_CONTRIB = `${W}contrib/extensions/browser/extensions.contribution.ts`;
export const EXT_CONTRIB_ELECTRON = `${W}contrib/extensions/electron-browser/extensions.contribution.ts`;
export const VIEWLET = `${W}contrib/extensions/browser/extensionsViewlet.ts`;
export const QUICK = `${W}contrib/extensions/browser/extensionsQuickAccess.ts`;
export const SHARED = 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts';
export const MAINS = [`${W}workbench.common.main.ts`, `${W}workbench.desktop.main.ts`];
export const MUST_BE_DELETED = [`${W}contrib/extensions/browser/extensionRecommendationsService.ts`, `${W}contrib/extensions/browser/exeBasedRecommendations.ts`,
  `${W}services/extensionManagement/common/extensionGalleryAccount.ts`, `${W}services/extensionManagement/electron-browser/extensionTipsService.ts`,
  'src/vs/platform/extensionManagement/node/extensionTipsService.ts', `${W}services/extensionRecommendations/common/extensionIgnoredRecommendationsService.ts`];
export const MUST_STAY = [NOOP_GALLERY, NULL_RECS, `${W}services/extensionRecommendations/common/extensionRecommendations.ts`, MANIFEST,
  'src/vs/platform/extensionManagement/common/extensionGalleryService.ts', 'src/vs/platform/extensionRecommendations'];
const RECS = ['IExtensionRecommendationNotificationService', 'IExtensionRecommendationsService', 'IExtensionIgnoredRecommendationsService'];
const NULLS = ['NullExtensionRecommendationNotificationService', 'NullExtensionRecommendationsService', 'NullExtensionIgnoredRecommendationsService'];

/** root: 作業ツリーのフォルダ。unit: removals/C-5-extension-gallery/unit.json の中身。食い違いの文の配列を返す。 */
export function checkWorktree(root, unit) {
  const bad = [];
  const at = (p) => join(root, ...p.split('/'));
  const text = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8').replace(/\r\n/g, '\n') : null);
  const withText = (p, fn) => { const t = text(p); if (t === null) bad.push(`ファイルが無い: ${p}`); else fn(t, p.split('/').pop()); };
  const forbid = (t, name, words) => { for (const w of words) if (t.includes(w)) bad.push(`${name} にまだ ${w} がある`); };

  for (const d of [...new Set([...(unit.delete ?? []), ...MUST_BE_DELETED])]) if (existsSync(at(d.replace(/\/+$/, '')))) bad.push(`消えているはずのパスが残っている: ${d}`);
  for (const k of new Set([...(unit.kept ?? []).map((x) => x.path), ...MUST_STAY])) if (!existsSync(at(k))) bad.push(`残るはずのパスが無い: ${k}`);

  withText(NOOP_GALLERY, (t) => { if (!/export class NoopExtensionGalleryService implements IExtensionGalleryService/.test(t)) bad.push('noopExtensionGalleryService.ts に NoopExtensionGalleryService が無い'); });
  withText(NULL_RECS, (t) => { for (const n of NULLS) if (!new RegExp(`export class ${n}\\b`).test(t)) bad.push(`nullExtensionRecommendations.ts に ${n} が無い`); });
  withText(GALLERY_COMMON, (t, n) => {
    forbid(t, n, ['AbstractExtensionGalleryService', 'WorkbenchExtensionGalleryService', 'IRequestService']);
    if (!/registerSingleton\(IExtensionGalleryService, NoopExtensionGalleryService, InstantiationType\.Delayed\);/.test(t)) bad.push('ワークベンチの extensionGalleryService.ts が NoopExtensionGalleryService を登録していない');
  });
  withText(MANIFEST, (t, n) => {
    forbid(t, n, ['IExtensionGalleryAccountService', 'IRequestService', 'ExtensionGalleryServiceUrlConfigKey', 'ExtensionGalleryAuthProviderConfigKey', 'resolveMarketplaceHeaders', 'handleMarketplaceAccountAccess']);
    if (!/registerSingleton\(IExtensionGalleryManifestService, WorkbenchExtensionGalleryManifestService/.test(t)) bad.push('extensionGalleryManifestService.ts がマニフェストのサービスを登録していない(共有プロセスが待ち続ける)');
    if (!/getChannel\('extensionGalleryManifest'\)/.test(t)) bad.push('extensionGalleryManifestService.ts が共有プロセスのチャンネル extensionGalleryManifest を使っていない(共有プロセスへマニフェストを送る所が消えた)');
  });
  withText(EXT_CONTRIB, (t, n) => {
    for (let i = 0; i < RECS.length; i++) {
      if (!new RegExp(`registerSingleton\\(${RECS[i]}, ${NULLS[i]}, InstantiationType\\.Delayed\\);`).test(t)) bad.push(`${n} が ${RECS[i]} を ${NULLS[i]} で登録していない`);
    }
    forbid(t, n, ['MenuId.ExplorerContext', 'ResourceContextKey', 'InstallExtensionQuickAccessProvider', "'ext install '", "isEqualTo('.vsix')", 'id: SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID', 'this.registerQuickAccessProvider();']);
    if (!/id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,/.test(t)) bad.push(`${n} から内部のコマンド installFromVSIX の登録(INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID)が消えている(残す)`);
    for (const c of unit.checks?.absentCommands ?? []) if (t.includes(`id: '${c}'`)) bad.push(`${n} にまだコマンド ${c} の登録がある`);
  });
  withText(VIEWLET, (t, n) => {
    forbid(t, n, ['workbench.views.extensions.marketplace', 'workbench.views.extensions.popular', 'extensions.recommendedList', 'workbench.views.extensions.otherRecommendations',
      'workbench.views.extensions.marketplaceAccess', 'WORKSPACE_RECOMMENDATIONS_VIEW_ID', 'DragAndDropObserver', 'isSupportedDragElement', 'INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID', 'extractEditorsAndFilesDropData']);
  });
  withText(QUICK, (t, n) => {
    if (!/export class ManageExtensionsQuickAccessProvider/.test(t)) bad.push(`${n} に ManageExtensionsQuickAccessProvider が無い(\`ext \` の Quick Access は残す)`);
    if (!/static PREFIX = 'ext ';/.test(t)) bad.push(`${n} の PREFIX が 'ext ' でない`);
    forbid(t, n, ['InstallExtensionQuickAccessProvider', "'ext install '"]);
  });
  withText(EXT_CONTRIB_ELECTRON, (t, n) => forbid(t, n, ["registerChannel('extensionRecommendationNotification'"]));
  withText(SHARED, (t, n) => {
    forbid(t, n, ['ExtensionTipsService', 'ExtensionTipsChannel', 'extensionTipsService']);
    if (!/ExtensionManagementChannel/.test(t) || !/IExtensionGalleryService/.test(t)) bad.push(`${n} から拡張の管理のチャンネル・ギャラリーが消えている(CLI と共有プロセスの導入に要る)`);
  });
  for (const f of MAINS) withText(f, (t, n) => forbid(t, n, ['extensionIgnoredRecommendationsService', 'workspaceExtensionsConfig', 'extensionGalleryAccountService', 'electron-browser/extensionTipsService']));
  for (const r of unit.removeLines ?? []) {
    const t = text(r.file);
    if (t !== null && t.split('\n').some((l) => l.trim() === r.line.trim())) bad.push(`${r.file} にまだ消すはずの行がある: ${r.line.trim().slice(0, 100)}`);
  }
  // CLI の道: 作業ツリーにあれば、自分でギャラリーとマニフェストを組んでいること(--install-extension はここを通る)
  const cli = text('src/vs/code/node/cliProcessMain.ts');
  if (cli !== null) {
    if (!/ExtensionGalleryServiceWithNoStorageService/.test(cli)) bad.push('cliProcessMain.ts が ExtensionGalleryServiceWithNoStorageService を使っていない(CLI の道が変わった)');
    if (!/platform\/extensionManagement\/common\/extensionGalleryManifestService\.js'/.test(cli)) bad.push('cliProcessMain.ts が platform の ExtensionGalleryManifestService を使っていない(CLI の道が変わった)');
    forbid(cli, 'cliProcessMain.ts', ['nullExtensionRecommendations', 'noopExtensionGalleryService', 'services/extensionManagement/']);
  }
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2];
  if (!root || !existsSync(root)) { console.error('使い方: node tests/c5-check-worktree.mjs <作業ツリー>'); process.exit(2); }
  const bad = checkWorktree(root, readJson(join(REPO, 'removals', 'C-5-extension-gallery', 'unit.json')));
  if (bad.length === 0) console.log('期待どおり（作業ツリー）');
  else { console.log('食い違い:'); for (const x of bad) console.log('  ' + x); }
  process.exit(bad.length ? 1 : 0);
}

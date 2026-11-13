# C-5-extension-gallery 拡張のギャラリーとおすすめ

裁定（2026-11-12）: 削る候補に「拡張の追加インストール（同梱した拡張だけで動く固定構成）」。docs/03 の表: ギャラリーのサービスは何もしない実装に差し替え、おすすめ・tips・ギャラリーのアカウント・マニフェスト・拡張のビューのうち検索・おすすめ・「VSIX からインストール」を消す。残すのは CLI の `--install-extension`、入っている拡張の一覧と有効・無効の切り替え、動作中の拡張の一覧。

> 状態: 下準備（2026-11-14）。`unit.json` の ops だけを作った。`edits.patch` は型検査を走らせられるようになってから作り、そのときに `unit.json` に `"patch": "edits.patch"` を足す。

## 消すもの

- `src/vs/workbench/contrib/extensions/browser` のおすすめの部品11ファイル: おすすめのサービス（`extensionRecommendationsService.ts`）、おすすめの通知（`extensionRecommendationNotificationService.ts`）、実行ファイル・設定・開いたファイル・キー割り当て・言語・Web・リモート・ワークスペース（`.vscode/extensions.json`）に基づくおすすめ。テスト1つ。
- `src/vs/workbench/services/extensionRecommendations/common` の `extensionIgnoredRecommendationsService.ts`（無視したおすすめ）・`workspaceExtensionsConfig.ts`（`.vscode/extensions.json` の読み書き）。
- ギャラリーのアカウント: `services/extensionManagement/common/extensionGalleryAccount.ts`・`electron-browser/extensionGalleryAccountService.ts`（私設のマーケットプレイスへのサインイン）とテスト。
- tips（実行ファイルに基づく提案）: ワークベンチ側 `services/extensionManagement/electron-browser/extensionTipsService.ts`、共有プロセス側 `platform/extensionManagement/node/extensionTipsService.ts`（起動時に PC の実行ファイルを走査しておすすめを出す）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行、`workbench.desktop.main.ts` 2行、`sharedProcessMain.ts` 4行（tips の import・登録・チャンネル2行）。`sessions.common.main.ts`・`sessions.desktop.main.ts` の各2行は直さない（C-1 が `src/vs/sessions` を消す。`after` に `C-1-ai` を挙げた）。C-1 はチャットのツール `contrib/extensions/common/installExtensionsTool.ts`・`searchExtensionsTool.ts`（ギャラリーを使う）も消す。
- **差し替え**（edits.patch）: `services/extensionManagement/common/extensionGalleryService.ts` の登録を、何もしない `NoopExtensionGalleryService`（新しいファイル。`isEnabled()` は偽、`query` は空のページ、`getExtensions`・`getAllVersions` などは空、`download` などは「ギャラリーは無い」で reject、`getExtensionsControlManifest` は空の一覧）に替える。`IExtensionGalleryService` の実装は16の項目（`platform/extensionManagement/common/extensionManagement.ts` の434〜452行）。
- 画面（edits.patch）: 拡張のビューのうち「マーケットプレイス」（検索）・「人気」・「おすすめ」・「その他のおすすめ」・マーケットプレイスへのアクセスの案内のビュー、コマンド「VSIX からインストール」（`workbench.extensions.action.installVSIX`）・「おすすめの拡張を表示」・「人気の拡張を表示」・「おすすめのキーマップ」・「言語の拡張」・「ワークスペースのおすすめの設定」、設定 `extensions.ignoreRecommendations`・`extensions.showRecommendationsOnlyOnDemand`。

## 残すもの

- `services/extensionRecommendations/common/extensionRecommendations.ts`（ID と型）: 残す拡張の画面（一覧の項目の飾り、拡張の詳細、ビュー、操作、キーマップの衝突の検出 `extensionsUtils.ts`）が注入している。edits.patch で、何もしない `IExtensionRecommendationsService`・`IExtensionIgnoredRecommendationsService`・`IExtensionRecommendationNotificationService` を登録する（新しいファイル。sessions の `NullExtensionRecommendationNotificationService`（`src/vs/sessions/services/extensionRecommendations/common/extensionRecommendationNotificationService.ts`）が同じ形の前例。ただし C-1 が `src/vs/sessions` ごと消すので、形だけを写して新しいファイルに置く）。画面の注入を全部消すより変更が小さい。
- `services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`（**docs/03 の表と違う**）: 共有プロセスの `ExtensionGalleryManifestIPCService` は、ワークベンチがこのサービスから `setExtensionGalleryManifest` を送るまで `Barrier` で待つ（`platform/extensionManagement/common/extensionGalleryManifestServiceIpc.ts` の25・37・50行）。消すと共有プロセスでの拡張の導入（VSIX を含む）がマニフェストを待ち続ける恐れがある。型検査では見つからない。拡張の資源の読み込み（`extensionResourceLoaderService.ts`）も注入している。edits.patch でアカウント（消す）を使う部分だけを外し、product.json の既定（`extensionsGallery` が無いので `null`）を送る形にする。
- 共有プロセスと CLI のギャラリー（`platform/extensionManagement/common/extensionGalleryService.ts` など）: CLI の `--install-extension`（同梱の拡張の導入。docs/04）が使う。product.json に `extensionsGallery` が無い（`product.overlay.json` の `removeIfPresent` で外す）ので通信しない。
- 拡張のビューのうち、入っている拡張・有効・無効・組み込み・再起動が要るもの、動作中の拡張の一覧（`runtimeExtensionsEditor`）、拡張の有効・無効の操作。
- 設定 `extensions.autoUpdate`・`extensions.autoCheckUpdates`（`product.overlay.json` の `shukoConfigurationDefaults` が既定を置く）は消さない。

## 型検査で直す点（edits.patch の見込み）

1.146.0 の作業ツリーで `grep` した結果。行は 1.146.0 のもの。

| ファイル | 行 | 中身 | 直し方の見込み |
|---|---|---|---|
| `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts` | 28・56・57・76・77、92・93（登録）、1859〜1950（おすすめを無視・ワークスペースのおすすめに足す操作）、2143（アカウントのサインイン）、724・742・915〜990・1082・1101（コマンド）、196〜210（設定） | おすすめ・アカウント・`.vscode/extensions.json` の操作、VSIX からのインストールの UI | 登録を何もしない実装に替え、おすすめ・アカウントの操作、上のコマンドと設定を消す。`workbench.extensions.command.installFromVSIX`（内部のコマンド。ファイルのドロップなどが使う見込み）は残す |
| `src/vs/workbench/contrib/extensions/electron-browser/extensions.contribution.ts` | 9・10・59・64 | 共有プロセスの tips からの通知を受けるチャンネル `extensionRecommendationNotification` | チャンネルの登録をやめる（tips を消すので送り手が無い） |
| `src/vs/workbench/contrib/extensions/browser/extensionsActions.ts` | 19・53、1302・1303、2458・2481、2584 付近 | おすすめを無視する操作、ワークスペースのおすすめを設定する操作（`EXTENSIONS_CONFIG`・`IExtensionsConfigContent` は消すファイルの型） | おすすめの操作のクラスを消す。`IExtensionRecommendationsService` の注入は何もしない実装で通る |
| `src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts` | 142・270・285・338・431 付近 | マーケットプレイス・人気・おすすめ・その他のおすすめ・アクセスの案内のビューの登録 | 登録を消す。検索欄は入っている拡張の絞り込み（`@installed` など）に使うので残す |
| `src/vs/workbench/contrib/extensions/browser/extensionsViews.ts` | 13・144・1383 | おすすめのビューのクラス | おすすめのビューのクラスを消す（上の登録と一緒に） |
| `src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts` | 27・88、アカウントを使う所 | `IExtensionGalleryAccountService` | アカウントの分岐を消し、構成された私設のマーケットプレイスの取得をやめる |
| `src/vs/workbench/services/extensionManagement/common/extensionGalleryService.ts` | 19〜36 | `WorkbenchExtensionGalleryService` の登録 | 何もしない実装の登録に替える（上の「差し替え」） |
| `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts` | 33・35 | 複数の名前の import の中の `IExtensionTipsService`・`ExtensionTipsChannel` | 使わなくなった名前だけを import から外す（`noUnusedLocals`。1行に別の名前もあるので removeLines にできない） |
| テスト: `contrib/extensions/test/electron-browser/extensionsActions.test.ts`・`extensionsViews.test.ts`・`extensionsWorkbenchService.test.ts`、`services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts` | — | おすすめ・アカウント・tips のサービスを注入して組み立てる | 消したサービスの注入の行を外すか、何もしない実装に替える |

- **型検査に掛からない点**: 注入しているのに登録が無くなるもの（`IExtensionIgnoredRecommendationsService`・`IWorkspaceExtensionsConfigService`・`IExtensionTipsService`・`IExtensionGalleryAccountService`）。edits.patch の後に `grep '@IExtension'` で、残る部品の注入が全部登録されていることを確かめる。
- 共有プロセスの `IExtensionRecommendationNotificationService` の登録（`sharedProcessMain.ts` の330〜332行）は残る。tips を消すと使う部品が無くなる。消すと `activeWindowRouter`・`ActiveWindowManager` が使われなくなり、import の直しが連鎖するので残した。
- C-1 との関係: `contrib/extensions/common/installExtensionsTool.ts`・`searchExtensionsTool.ts`（チャットのツール。ギャラリーを使う）は、2026-11-14 時点の C-1 の `unit.json` が消している。

## 影響しうるもの

- 拡張のビューの検索欄にマーケットプレイスの結果が出なくなる（元から `extensionsGallery` が無いので出ていない）。
- `.vscode/extensions.json` を持つフォルダを開いても、おすすめの通知が出ない。
- 共有プロセスの起動時の実行ファイルの走査（tips）が無くなる。

## 壊れたときの症状と戻し方

- 拡張のビューが開かない、または拡張の詳細で誤りが出る: 何もしない実装の登録が読まれていない。`enabled: false` に戻す。
- VSIX の導入や `--install-extension` が終わらない: マニフェストのサービスが共有プロセスへ `null` を送っていない（上の「残すもの」）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。
- CLI の `--install-extension <VSIX>`（`scripts/install-extensions.mjs` が使う形）が、ワークベンチの変更の影響を受けないこと（CLI は `code/node/cliProcessMain.ts` の別のサービスで動く見込み）。
- 拡張の詳細（`extensionEditor.ts`）の「おすすめ」の印が、何もしない実装で消えること。

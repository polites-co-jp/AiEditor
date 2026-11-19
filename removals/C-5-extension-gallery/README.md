# C-5-extension-gallery 拡張のギャラリーとおすすめ

裁定（2026-11-12）: 削る候補に「拡張の追加インストール（同梱した拡張だけで動く固定構成）」。docs/03 の表: ギャラリーのサービスは何もしない実装に差し替え、おすすめ・tips・ギャラリーのアカウント・マニフェスト・拡張のビューのうち検索・おすすめ・「VSIX からインストール」を消す。残すのは CLI の `--install-extension`、入っている拡張の一覧と有効・無効の切り替え、動作中の拡張の一覧。

> 状態: edits.patch あり、関門の前（2026-11-15）。`unit.json` に `"patch": "edits.patch"` を足した。`enabled` は `false` のまま。型検査（`typecheck-client`）は誤り 0。ビルド・起動の確かめ・関門は、片づけの許可の後。記録は `tasks/2026-11-15-p5-c5-patch/`。

## 消すもの

- `src/vs/workbench/contrib/extensions/browser` のおすすめの部品11ファイル: おすすめのサービス（`extensionRecommendationsService.ts`）、おすすめの通知（`extensionRecommendationNotificationService.ts`）、実行ファイル・設定・開いたファイル・キー割り当て・言語・Web・リモート・ワークスペース（`.vscode/extensions.json`）に基づくおすすめ。テスト1つ。
- `src/vs/workbench/services/extensionRecommendations/common` の `extensionIgnoredRecommendationsService.ts`（無視したおすすめ）・`workspaceExtensionsConfig.ts`（`.vscode/extensions.json` の読み書き）。
- ギャラリーのアカウント: `services/extensionManagement/common/extensionGalleryAccount.ts`・`electron-browser/extensionGalleryAccountService.ts`（私設のマーケットプレイスへのサインイン）とテスト。
- マニフェストのサービスのテスト `services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`（2026-11-15 に足した）。約60の試験のほぼすべてが、消したアカウントと私設のマーケットプレイスの振る舞いを試すもの。
- tips（実行ファイルに基づく提案）: ワークベンチ側 `services/extensionManagement/electron-browser/extensionTipsService.ts`、共有プロセス側 `platform/extensionManagement/node/extensionTipsService.ts`（起動時に PC の実行ファイルを走査しておすすめを出す）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行、`workbench.desktop.main.ts` 2行、`sharedProcessMain.ts` 4行（tips の import・登録・チャンネル2行）。`sessions.common.main.ts`・`sessions.desktop.main.ts` の各2行は直さない（C-1 が `src/vs/sessions` を消す。`after` に `C-1-ai` を挙げた）。C-1 はチャットのツール `contrib/extensions/common/installExtensionsTool.ts`・`searchExtensionsTool.ts`（ギャラリーを使う）も消す。
- **差し替え**（edits.patch）: `services/extensionManagement/common/extensionGalleryService.ts` は、何もしない `NoopExtensionGalleryService`（新しいファイル `noopExtensionGalleryService.ts`）を登録するだけのファイルにした。本家の `WorkbenchExtensionGalleryService` は消えた。
- 画面（edits.patch）
  - 拡張のビュー: 「マーケットプレイス」（検索）・「人気」・「おすすめ」・「ワークスペースのおすすめ」・「その他のおすすめ」・マーケットプレイスへのアクセスの案内
  - コマンド: 「VSIX からインストール」（`workbench.extensions.action.installVSIX`）・「おすすめの拡張を表示」・「人気の拡張を表示」・「おすすめのキーマップ」・「言語の拡張」・ワークスペースのおすすめの設定（ワークスペース・フォルダ）・ワークスペースのおすすめの導入・おすすめの無視と取り消し・ワークスペースのおすすめへの追加と削除（6つ）・マーケットプレイスへのサインイン（`workbench.extensions.actions.gallery.signIn`）
  - 設定: `extensions.ignoreRecommendations`・`extensions.showRecommendationsOnlyOnDemand`
  - マーケットプレイスの状態のバッジ（`ExtensionMarketplaceStatusUpdater`。私設のマーケットプレイスでサインインが要るときだけ出た）
  - 画面からの VSIX の導入（2回目、2026-11-15。docs/user-decisions.md の「C-5 の edits.patch を作るときに出た点」）: エクスプローラーの右クリックの「拡張の VSIX のインストール」（`INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID` のメニュー）と、拡張のビューへのファイルのドロップ（`DragAndDropObserver` と重ねの表示）
  - `ext install ` の Quick Access（`InstallExtensionQuickAccessProvider`。2回目）
  - ワークベンチ側のチャンネル `extensionRecommendationNotification` の登録（`contrib/extensions/electron-browser/extensions.contribution.ts`。送り手の tips を消した）

## edits.patch で直した点（2026-11-15）

11ファイル（新規2）、245行の追加、1,170行の削除（2回目の後）。件名は `unit C-5-extension-gallery: edits`、作者は `sukuna-apply <apply@sukuna.invalid>`。

| ファイル | 直し方 |
|---|---|
| `services/extensionManagement/common/noopExtensionGalleryService.ts`（新規） | `NoopExtensionGalleryService`。`isEnabled()` は偽。`query` は空のページ、`getExtensions`・`getAllVersions`・`getAllCompatibleVersions` は空、`getCompatibleExtension`・`getManifest`・`getCoreTranslation` は `null`、`isExtensionCompatible` は偽、`reportStatistic` は何もしない、`getExtensionsControlManifest` は空の一覧。`download`・`downloadSignatureArchive`・`getReadme`・`getChangelog` は「ギャラリーは無い」で reject。どれも通信しない |
| `services/extensionManagement/common/extensionGalleryService.ts` | `WorkbenchExtensionGalleryService` を消し、`IExtensionGalleryService` に `NoopExtensionGalleryService` を登録する |
| `services/extensionRecommendations/common/nullExtensionRecommendations.ts`（新規） | `NullExtensionRecommendationsService`（おすすめは常に空、イベントは `Event.None`）、`NullExtensionIgnoredRecommendationsService`（無視の一覧は空、切り替えは何もしない）、`NullExtensionRecommendationNotificationService`（sessions の `NullExtensionRecommendationNotificationService` と同じ形。C-1 が sessions ごと消すので写した） |
| `contrib/extensions/browser/extensions.contribution.ts` | 上の3つを登録（本家の2つの登録を差し替え、無視のサービスの登録を1行足した）。上の「画面」のコマンド・設定・サインインの操作・バッジの登録を消した。使われなくなった import と `commandService` を外した。2回目: `installFromVSIX` のコマンドからエクスプローラーの右クリックのメニューを外し（コマンドの登録は残す）、`ext install ` の Quick Access の登録（`registerQuickAccessProvider`）を消した |
| `contrib/extensions/browser/extensionsViewlet.ts` | 上の「画面」のビューの登録と、アクセスの案内の歓迎の文、`ExtensionMarketplaceStatusUpdater` を消した。2回目: VSIX のドロップ（`DragAndDropObserver`・重ねの表示・`isSupportedDragElement`）と、使われなくなった `commandService` を消した |
| `contrib/extensions/browser/extensionsQuickAccess.ts`（2回目） | `InstallExtensionQuickAccessProvider` を消した。`ext ` の Quick Access（拡張のビューを開くだけ）は残す |
| `contrib/extensions/browser/extensionsViews.ts` | `DefaultPopularExtensionsView`・`SearchMarketplaceExtensionsView`・`DefaultRecommendedExtensionsView`・`RecommendedExtensionsView`・`WorkspaceRecommendedExtensionsView` を消した |
| `contrib/extensions/browser/extensionsActions.ts` | `IgnoreExtensionRecommendationAction`・`UndoIgnoreExtensionRecommendationAction`（使い手なし）、`AbstractConfigureRecommendedExtensionsAction` と2つの派生（消した `workspaceExtensionsConfig.ts` の型を使う）を消した |
| `contrib/extensions/electron-browser/extensions.contribution.ts` | `extensionRecommendationNotification` のチャンネルの登録をやめた |
| `services/extensionManagement/electron-browser/extensionGalleryManifestService.ts` | アカウント（`IExtensionGalleryAccountService`）と私設のマーケットプレイス（`extensions.gallery.serviceUrl` の取得、その検査、401 の扱い、設定の変更での再起動の確認、通信の頭書き）を外した。product.json の既定（無いので `null`）を作り、共有プロセスとリモートへ `setExtensionGalleryManifest` を送る所は前のまま |
| `code/electron-utility/sharedProcess/sharedProcessMain.ts` | 複数の名前の import から `IExtensionTipsService`・`ExtensionTipsChannel` を外した（`removeLines` にできない行） |

`unit.json` で足したもの

- `delete`: `services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`
- `patch`: `edits.patch`
- `kept`: `contrib/extensions/common/extensionsFileTemplate.ts`。ほかの4つの理由を、edits.patch の後の事実に直した
- `checks.absentCommands`: 11（上の「画面」のコマンドのうち前から挙げていない分）
- `checks.absentViews`: `workbench.views.extensions.workspaceRecommendations`
- `checks.absentStrings`: 9（消したクラスの名前とその呼び出し4つ、`class WorkbenchExtensionGalleryService `。2回目に `InstallExtensionQuickAccessProvider`・`'ext install '`・`isEqualTo('.vsix')`（右クリックのメニューの条件）・`extractEditorsAndFilesDropData`（ドロップ）の4つ。どれも 1.146.0 の `contrib/extensions` にある文字列で、空振りしない）。コマンドは残るので `absentCommands` には足せない。マニフェストのサービスのアカウントの残り（`galleryAccountService`）は、ファイルが `kept` にあり検査の外になるので項目にしなかった

## 残すもの

- `services/extensionRecommendations/common/extensionRecommendations.ts`（ID と型）: 残す拡張の画面（一覧の項目の飾り、拡張の詳細、ビュー、操作、キーマップの衝突の検出 `extensionsUtils.ts`）が注入している。何もしない実装（上の表）で受ける。画面の注入を全部消すより変更が小さい。
- `services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`（**docs/03 の表と違う**。docs/03 の4節の末尾と 2026-11-14 の記録で認められた）: 共有プロセスの `ExtensionGalleryManifestIPCService` は、ワークベンチがこのサービスから `setExtensionGalleryManifest` を送るまで `Barrier` で待つ（`platform/extensionManagement/common/extensionGalleryManifestServiceIpc.ts` の25・50・60行）。消すと共有プロセスでの拡張の導入（VSIX を含む）がマニフェストを待ち続ける恐れがある。型検査では見つからない。拡張の資源の読み込み（`extensionResourceLoaderService.ts`）も注入している。
- 共有プロセスと CLI のギャラリー（`platform/extensionManagement/common/extensionGalleryService.ts` など）: CLI の `--install-extension`（同梱の拡張の導入。docs/04）と共有プロセスの拡張の管理が使う。product.json に `extensionsGallery` が無い（`product.overlay.json` の `removeIfPresent` で外す）ので通信しない。
- `platform/extensionManagement/common/extensionTipsService.ts`: Web の入口（`workbench.web.main.ts`）が登録し、テストの部品（`workbenchTestServices.ts` の `TestExtensionTipsService`）が継承する。
- `platform/extensionRecommendations`: 共有プロセスの `IExtensionRecommendationNotificationService` の登録（`sharedProcessMain.ts` の `ExtensionRecommendationNotificationServiceChannelClient`）と、何もしない実装が使う。共有プロセスの登録は残る（tips を消すと使う部品は無くなる。消すと `activeWindowRouter`・`ActiveWindowManager` が使われなくなり、import の直しが連鎖する）。呼ばれれば、ワークベンチ側のチャンネルが無いので誤りになる。呼ぶ部品は無い。
- `contrib/extensions/common/extensionsFileTemplate.ts`: `.vscode/extensions.json` の JSON の検査の定義。編集の手伝いだけで通信しない（判断を仰ぐ点の4）。
- 拡張のビューのうち、入っている拡張・有効・無効・組み込み・古い・最近更新・非対応・非推奨・再起動が要るもの、動作中の拡張の一覧（`runtimeExtensionsEditor`）、拡張の有効・無効・アンインストールの操作。
- 内部のコマンド `workbench.extensions.command.installFromVSIX`（与えた VSIX を入れる）。メニューは無い。拡張の API のコマンド `workbench.extensions.installExtension`（VSIX の URI を受ける）も残る。画面からの導入（右クリック・ドロップ）は2回目に消した。
- ギャラリーがあるときだけ出る画面（`CONTEXT_HAS_GALLERY` の条件つき）: 「拡張のインストール」「更新の確認」「すべて更新」「注目」「最近公開」「分類」「特定の版のインストール」「プレリリースへの切り替え」（判断を仰ぐ点の2）。マニフェストの状態は常に `Unavailable` なので、条件は常に偽で出ない。
- 設定 `extensions.autoUpdate`・`extensions.autoCheckUpdates`（`product.overlay.json` の `sukunaConfigurationDefaults` が既定を置く）は消さない。`extensions.gallery.serviceUrl`・`extensions.gallery.authProvider`（`included: false`。ポリシーだけで置ける）の登録も残す（判断を仰ぐ点の3）。
- `contrib/extensions/common/extensions.ts` の `IWorkspaceRecommendedExtensionsView`・`WORKSPACE_RECOMMENDATIONS_VIEW_ID`・`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID`: 型と定数だけ。使い手の一部を消したが、共通のファイルに触れないために残した。`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID` は `PromptExtensionInstallFailureAction` の「VSIX からインストール」のボタンが読むが、ボタンはギャラリーの拡張（`extension.gallery`）のときだけ出るので、出ない。
- `terminalContrib/wslRecommendation`（WSL の拡張のおすすめ）: product.json の `exeBasedExtensionTips` が無いと何もしない。1.146.0 の OSS の product.json には無い。

## 拡張の導入と管理への影響

- **CLI の `--install-extension <vsix>`（`scripts/install-extensions.mjs`）**: 影響しない見込み。CLI は `code/node/cliProcessMain.ts` の別のサービスの組（`ExtensionGalleryServiceWithNoStorageService`・`platform` の `ExtensionGalleryManifestService`）で動き、edits.patch はどちらにも触れない（edits.patch のファイルの一覧で確かめた）。C-5 の ops が消すのは共有プロセス側の tips だけ。
- **画面からの VSIX の導入**: 2回目に消した（右クリックのメニューとドロップ）。拡張の導入は CLI だけになる（docs/01 の「拡張のインストール（CLI のみ）」）。内部のコマンドと拡張の API のコマンドで VSIX を入れたときは、ワークベンチのマニフェストのサービスが共有プロセスへ `null` を送るので、共有プロセスの導入は待たずに進む見込み（起動の確かめで見る）。
- **自動更新と更新の確かめ**: `ExtensionsWorkbenchService.checkForUpdates` は `galleryService.isEnabled()` が偽なら最初に戻る（`extensionsWorkbenchService.ts` の `checkForUpdates`。C-5 はこのファイルに触れない）。何もしない実装は常に偽なので、通信しない。自動更新（`autoUpdateExtensions`）は「古い」拡張（`outdated`。ギャラリーの拡張と比べて決まる）を更新するので、常に空で何もしない。ピン留めした組み込み拡張の同期（`syncPinnedBuiltinExtensions`）は `getExtensions` を直接呼ぶが、空が返るだけ。
- **拡張の一覧・有効・無効・アンインストール・動作中の拡張の一覧**: 触れていない。おすすめの印（`isExtensionRecommended` などの文脈）は常に偽になる。
- **拡張の詳細**（`extensionEditor.ts`）: おすすめのサービスは何もしない実装で受ける。ギャラリーの拡張は出ないので、README・変更履歴は入っている拡張のものだけ。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest に、`extensionDependencies`・`extensionPack`・`installExtension` の語は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`）。圧縮されたコードの中で `workbench.extensions.installExtension` を呼ぶかは、裁定で読まない。VSIX の URI を渡せば前のまま動き、ID を渡したときはギャラリーが無いので、前と同じく見つからない誤りになる。
- 台帳の拡張の VSIX（`C:\b\cache\vsix\*\package.json`）で `extensionDependencies`・`extensionPack` を持つのは `ms-vscode.powershell`（組み込みの `vscode.powershell` だけ）。組み込みなのでギャラリーは要らない。
- 拡張が `.vscode/extensions.json` を持つフォルダを開いても、おすすめの通知は出ない。

## 型検査に掛からない点

- 注入しているのに登録が無くなるもの: edits.patch の後の木で、`IWorkspaceExtensionsConfigService`・`IExtensionGalleryAccountService` を `Grep` した。残るのは消すテストだけ（`delete` に足した）。`IExtensionTipsService` を注入するのは、Web の入口と消した部品とテストだけ。`IExtensionRecommendationsService`・`IExtensionIgnoredRecommendationsService`・`IExtensionRecommendationNotificationService` は、browser の `extensions.contribution.ts` が登録する。
- 起動時の注入の外し損ねと、共有プロセスがマニフェストを待ち続けないことは、起動の確かめで見る。

## 影響しうるもの

- 拡張のビューの検索欄にマーケットプレイスの結果が出なくなる（元から `extensionsGallery` が無いので出ていない）。名前で探すと、前と同じく何も出ない。`@installed` などの絞り込みは前のまま。
- `.vscode/extensions.json` を持つフォルダを開いても、おすすめの通知が出ない。`@recommended` で探しても、ビューが無いので何も出ない。
- 共有プロセスの起動時の実行ファイルの走査（tips）が無くなる。

## 壊れたときの症状と戻し方

- 拡張のビューが開かない、または拡張の詳細で誤りが出る: 何もしない実装の登録が読まれていない。`enabled: false` に戻す。
- VSIX の導入や `--install-extension` が終わらない: マニフェストのサービスが共有プロセスへ `null` を送っていない（上の「残すもの」）。

## 別案と判断を仰ぐ点

リーダーの判断は `docs/user-decisions.md` の「C-5 の edits.patch を作るときに出た点」（2026-11-15）。1は別案を採り、`ext install ` は消した。ほかは採った案のまま。

1. （決着）画面からの VSIX の導入（エクスプローラーの右クリック・拡張のビューへのドロップ）は、別案を採って外した（2回目）。内部のコマンド `installFromVSIX` は残す。
2. （決着）ギャラリーがあるときだけ出る画面（`CONTEXT_HAS_GALLERY` の条件つきのコマンド）は残す。`ext install ` の Quick Access は消した（2回目。画面からの検索に当たる）。
3. （決着、残す）設定 `extensions.gallery.serviceUrl`・`extensions.gallery.authProvider` の登録を残した。読み手は消したが、2つともポリシーの一覧（`build/lib/policies/policyData.jsonc`）に載っているので、消すとその一覧と食い違う。別案: 消す。
4. （決着、残す）`.vscode/extensions.json` の JSON の検査を残した。別案: 消す（`extensionsFileTemplate.ts` を `delete` に足し、登録の2行を外す）。
5. （決着、消す）マーケットプレイスの状態のバッジ（`ExtensionMarketplaceStatusUpdater`）を消した（前の README に無かった、足したもの）。サインインが要る状態を作るのは消したアカウントだけなので、2026-11-14 の規則（消す部品だけが使うものは消す）に当てはめた。別案: 残す（常に何も出さない）。
6. （決着、空を返す）ギャラリーの何もしない実装は、`getExtensions` などで誤りを投げず空を返す。本家はギャラリーが無いとき「No extension gallery service configured.」を投げる。呼ぶ側は空を「見つからない」として扱う。別案: 本家と同じく投げる。

## 未確認（ビルドと起動で確かめる）

- CLI の `--install-extension <VSIX>`（`scripts/install-extensions.mjs` が使う形）で台帳の拡張が入ること。
- エクスプローラーの `.vsix` の右クリックに「拡張の VSIX のインストール」が出ず、拡張のビューに VSIX を落としても入らないこと。Quick Access で `ext install ` を打っても導入の候補が出ないこと。
- 拡張のビューが開き、入っている拡張・有効・無効の切り替え・アンインストールが動くこと。動作中の拡張の一覧が開くこと。
- 拡張の詳細（`extensionEditor.ts`）が誤りなく開き、「おすすめ」の印が出ないこと。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service` が無いこと。

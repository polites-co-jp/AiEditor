# Phase 5 の下ごしらえ（C-5 の検査とテスト）の引き継ぎ

曹参から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。依頼の1〜6がそろった。`C:\b\wt\p2`（大岡越前守が検証で使用中）には触れていない。本家の読み取りは常設の clone（`C:/b/vscode` のタグ 1.146.0）だけ。実記録は `trial/` の2回目のもの（`checks-r2-verify-{a,b}.json`・`build-typecheck-r2-verify-{a,b}.json`）。

## 成果物

すべて `tests/` の下（照らし役は直下）。本体のコード、`removals/`、`docs/` は直していない。

| ファイル | 中身 | 件数 |
|---|---|---|
| `tests/c5-unit.test.mjs` | 単位のファイルの静的な検査、CLI の道に触れていない検査、画面からの導入が消えた検査、何もしない実装の検査（文字列と構文）、何もしない実装を走らせる検査 | 42 |
| `tests/c5-mutation.test.mjs` | 壊した写しで `c5-unit.test.mjs` が落ちること（対照1 + 壊し方61） | 62 |
| `tests/c5-check-json.mjs` | 照らし役。当て直しの記録（a・b）と型検査の記録を照らす。`--stopped` で「C-1 を外すと止まる」記録も照らす | — |
| `tests/c5-check-json.test.mjs` | 照らし役の検査。蒙恬の2回目の実記録で「期待どおり」、壊した記録で食い違い | 12 |
| `tests/c5-check-worktree.mjs` | 照らし役。当てた後の木を照らす（入口の6。CLI の道が変わっていないことも見る） | — |
| `tests/c5-worktree.test.mjs` | 照らし役の検査。本家 1.146.0 に前の単位と C-5 の `removeLines`・`edits.patch` を順に当てた木（組 a・b）を一時のフォルダに作り、期待どおり・壊した木を照らす | 32 |
| `tests/removals/c5-gate-script.md` | 大岡越前守の台本（入口の1〜4・6・8・9。関門の起動の確かめを含む） | — |
| `tasks/2026-11-15-p5-c5-tests/run-all-result.txt` | `run-all --save` の結果（PowerShell のテスト込み） | — |

## 要点

1. **何もしないギャラリーが通信しないこと**（依頼の確かめ1）:
   - 静的: `NoopExtensionGalleryService` は constructor を持たず、`IRequestService`・`IConfigurationService`・`IStorageService`・`ITelemetryService`・`IFileService`・`IProductService`・`IExtensionGalleryManifestService`・`fetch`・`XMLHttpRequest`・`WebSocket`・タイマー・DI・URL の文字列を持たない。import は cancellation・paging・uri・拡張の管理の型・拡張の型の5つだけ。
   - 走らせる: 型を外した本文を node で走らせ、**`globalThis.fetch` を「呼ばれたら投げる」に差し替えた上で**、`isEnabled()` が偽、`query` が空の1ページ、`getExtensions`（2つの呼び方）が `[]`、`isExtensionCompatible` が偽、`getCompatibleExtension`・`getManifest`・`getCoreTranslation` が `null`、`getExtensionsControlManifest` が `{ malicious: [], deprecated: {}, search: [], autoUpdate: {} }`、`reportStatistic` が何もしない、`download`・`downloadSignatureArchive`・`getReadme`・`getChangelog` が reject（同じ文言）を確かめた。
   - メンバーは、本家の `IExtensionGalleryService` の interface から読んだ一覧と突き合わせた（足りなければ失敗）。おすすめの3つの Null（`IExtensionRecommendationsService`・`IExtensionIgnoredRecommendationsService`・`IExtensionRecommendationNotificationService`）も同じ。
   - 登録: ワークベンチの `extensionGalleryService.ts` は `registerSingleton(IExtensionGalleryService, NoopExtensionGalleryService, ...)` だけを足し、`WorkbenchExtensionGalleryService`（`AbstractExtensionGalleryService` を継ぐクラス）を消す。
2. **画面からの導入が消えたこと**（確かめ2。2回目の入口）:
   - 右クリック: `MenuId.ExplorerContext` の `menu` と `ResourceContextKey.Extension.isEqualTo('.vsix')` を消し、足さない。**`id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID`（内部のコマンド `installFromVSIX`）の登録は文脈に残り、消えていない**（`menu` だけを外す）。「VSIX からインストール」（`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID` の登録と `showOpenDialog`）も消える。
   - ドロップ: `DragAndDropObserver`・`isSupportedDragElement`・`extractEditorsAndFilesDropData`・ビューからの `installFromVSIX` の呼び出し・重ねの表示（`overlay`）を消し、足さない。
   - `ext install `: `InstallExtensionQuickAccessProvider` のクラスと `PREFIX = 'ext install '` と登録を消す。`ext ` の `ManageExtensionsQuickAccessProvider` は残る（本家に `PREFIX = 'ext '` があることも確かめた）。
   - `checks.absentStrings` に、この4つを守る文字列（`InstallExtensionQuickAccessProvider`・`'ext install '`・`isEqualTo('.vsix')`・`extractEditorsAndFilesDropData`）があり、**残すコマンド `installFromVSIX` は `absentCommands` に入っていない**ことを見張る。
   - 消してはいけないもの: 入っている拡張・有効・無効・動作中の拡張のコマンド（`showRuntimeExtensions` ほか）と、入っている拡張のビューのクラスを `edits.patch` が消さない。
3. **CLI の `--install-extension` の道に触れていないこと**（確かめ3）:
   - `unit.json` の `delete`・`removeLines` と `edits.patch` は、`cliProcessMain.ts`・`extensionManagementCLI.ts`・platform のギャラリーとマニフェストの基底・`extensionManagementService.ts` に触れない。`platform/extensionManagement` で触れるのは **`node/extensionTipsService.ts` の delete の1つだけ**。platform の `edits.patch` は無い。
   - 本家の CLI の道は、消す部品（tips・アカウント・おすすめ）を1つも import していない。`cliProcessMain.ts` は platform の `ExtensionGalleryManifestService` と `ExtensionGalleryServiceWithNoStorageService` を**自分で組む**（ワークベンチのサービスを使わない）ので、ワークベンチのギャラリーを Noop に替えても CLI は変わらない。
   - `scripts/install-extensions.mjs` が `"--install-extension", it.file, "--force"` で入れていること（docs/04）を確かめた。
   - 照らし役 `c5-check-worktree.mjs` は、作業ツリーに `cliProcessMain.ts` があれば、上の2つを使っていること、`noopExtensionGalleryService`・`nullExtensionRecommendations`・`services/extensionManagement/` を import していないことを見る。
4. **`sharedProcessMain.ts`**: `edits.patch` のハンクは import の2行の書き換えだけ（`IExtensionTipsService`・`ExtensionTipsChannel` を外す）。C-1・C-3 も同じファイルを直すが、`removeLines` や `edits.patch` が消す行が二重になっていない。
5. **当てた後の木の照らし役は、前の単位から順に当てた木で「期待どおり」を確かめた**: 本家に A・B・C-1（組 b は C-2〜C-4 も）と C-5 の `removeLines`・`edits.patch` を order の順に当て、全ハンクが衝突なく当たる。

## 実行結果

- C-5 の4ファイル: 148 tests（42 + 62 + 12 + 32）、全部通った。
- `node tests/run-all.mjs --save tasks/2026-11-15-p5-c5-tests/run-all-result.txt`: **2247 tests、pass 2240、fail 0、skip 7**（skip の7は `removals.test.mjs` の既存分。PowerShell のテスト込み）。
- 作る途中で落ちたものは、すべて**テストの誤り**で、その場で直した（実装の不具合は見つかっていない）。
  - CLI の道のファイルに `platform/extensionManagement/node/extensionManagementCLI.ts` を挙げたが、本家では `common/` の下だった。
  - `configureWorkspaceRecommendedExtensions` のコマンドの id は文字列でなくクラスの継承で付くので、登録の行では探せなかった（`AbstractConfigureRecommendedExtensionsAction` のクラスを消すことで見る形にした）。
  - 入っている拡張のビューの名前が、`import` の行の書き換えで「消す行」にも「足す行」にも出る（足し直す）のを、消したと見ていた。
  - 壊し方の1つが、`absentStrings` の範囲（`contrib/extensions`）の外のファイルに足していたため、見張りに当たらなかった（範囲の中のファイルに足す形にした）。

## 大岡越前守向けの台本の入口

`tests/removals/c5-gate-script.md`。

- 1a・1b: 当て直し a（16単位）・b（19単位。C-1〜C-5 の順）と `node tests/c5-check-json.mjs <checks.json>`（期待の表は a・b 並べた。b だけ C-2 の警告1件）
- 1c: C-1 を外すと止まること（入口の2）と `--stopped`
- 1d: `node tests/c5-check-worktree.mjs C:/b/wt/p2`（入口の6。CLI の道の確認を含む）
- 1e: ロックファイル
- 1f: C-5 の ops の commit での `git apply --check`（入口の4。**曹参の許可に `git -C` と `git checkout` が無く、走らせていない**。静的な代わりは、前から順に当てた木の検査と、他の単位と文脈が重ならない検査）
- 2: 型検査（a・b それぞれの上）
- 4: 走らせる形（`NoopExtensionGalleryService` ほか）と拡張のテスト（入口の8）。作業ツリーで走らせるのは蒙恬か大岡越前守
- 5: 関門の起動の確かめ（入口の9）。**最優先は `install-extensions.mjs` で台帳の拡張が入ること**。続けて、`UNKNOWN service` が無いこと、画面からの導入が消えたこと（右クリック・ドロップ・`ext install `）、共有プロセスがマニフェストを待ち続けないこと、通信の監査（`netaudit.ps1`）でギャラリーのホストへの接続が無いこと、Claude Code のパネル

## 仕様と実装についての指摘

1. **docs/03 の4節の表の C-5 の行が、残す部品を消す側に挙げたまま**（蒙恬の「docs/ との食い違い」と同じ）。`extensionGalleryManifestService`（ワークベンチ側）と `services/extensionRecommendations` の `extensionRecommendations.ts` は、実装と `kept` が残す側。テストは `kept` を正にしている。表の側を直すかはリーダーの判断。
2. **画面からの VSIX の導入は、拡張の API のコマンドから残る**: 内部のコマンド `installFromVSIX`（`workbench.extensions.command.installFromVSIX`）は、拡張やコマンドから VSIX の URI を渡せば動く。docs/01 の「拡張のインストールは CLI のみ」は**画面**（メニュー・ドロップ・Quick Access）の話で、リーダーの判断（2026-11-15）どおり。ただし、この残し方は `checks` では見張れない（メニューの項目を見る種類が無い。docs/03 の3.1）ので、`absentStrings`（4つ）と、`edits.patch` の中身の検査と、台本の5の見た目の確認で守っている。
3. 設定 `extensions.gallery.serviceUrl`・`extensions.gallery.authProvider` の登録は残す（`policyData.jsonc` のポリシーの一覧と食い違わないため。判断済み）。読み手のマニフェストのサービスはアカウントと私設のマーケットプレイスの取得を外したので、この2つの設定は設定画面に出るが効かない。`absentSettings` には入れていない。気になるなら別の単位で扱う。
4. 判断済みのもの（`docs/user-decisions.md` の 2026-11-15）はそのままテストに入れた: `ext install ` は消す、`CONTEXT_HAS_GALLERY` の条件つきの画面は残す、`.vscode/extensions.json` の検査（`extensionsFileTemplate.ts`）は残す、マーケットプレイスのバッジは消す、何もしないギャラリーは誤りを投げず空を返す。

## 仕様から想定した入口

実装（蒙恬の `edits.patch`、`unit.json`、2回目の実記録）が先にあったので、想定の入口は無い。本家の interface からメンバー名を読んで突き合わせたのは、仕様の側（実装に合わせて書き換えていない）。壊し方の文字列の置き換えは `edits.patch` の文言に依存する（パッチを書き直したら「置き換えが当たらない」で落ちる。落ちたら置き換えを直す）。

## 未解決の点

- 拡張のテスト（`extensionsActions.test.ts` ほか）、本物の VS Code での起動（`install-extensions.mjs` で台帳の拡張が入ること、DI の外し損ね、共有プロセスのマニフェスト、画面からの導入が消えたこと、通信の監査）は、台本の4・5（大岡越前守、片づけの後）。
- 当て直し a・b・「C-1 を外す」の再実行、`git apply --check`、型検査は、`C:\b\wt\p2` に書き込むため走らせていない。

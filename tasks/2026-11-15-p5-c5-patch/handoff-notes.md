# Phase 5 の下ごしらえ（C-5 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない。

## 成果物

- `removals/C-5-extension-gallery/edits.patch`（新規）
  - 10ファイル（新規2）、238行の追加、1,015行の削除
  - 件名は `unit C-5-extension-gallery: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `a7aad91d`
- `removals/C-5-extension-gallery/unit.json`（直した）。`enabled` は `false` のまま
  - `"patch": "edits.patch"` を足した
  - `delete` に1つ（`extensionGalleryManifestService.test.ts`）を足した
  - `kept` に1つ（`extensionsFileTemplate.ts`）を足し、4つの理由を edits.patch の後の事実に直した
  - `checks.absentCommands` に11、`checks.absentViews` に1、`checks.absentStrings` に5を足した
- `removals/C-5-extension-gallery/README.md`（書き直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「edits.patch で直した点（2026-11-15）」「拡張の導入と管理への影響」「Claude Code と台帳の拡張への影響」「型検査に掛からない点」「別案と判断を仰ぐ点」
  - 直した節: 「消すもの」「残すもの」「影響しうるもの」「未確認」
- `tasks/2026-11-15-p5-c5-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c5-patch/trial/`
  - 適用の検査5つ: `checks-ops.json`・`checks-ops2.json`・`checks-verify-a.json`・`checks-verify-b.json`・`checks-verify-a2.json`。verify-a・verify-b にはロックファイルの検査も追記した
  - 型検査の記録6つ: `build-typecheck-{1..4,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
  - `take-in/`（`build.mjs` が書く置き場）
- `tasks/2026-11-15-p5-c5-patch/disk-start.json`・`disk-end.json`
- `scripts/` と、ほかの単位の `removals/` は変えていない

## 要点

1. A・B の14単位と C-1・C-5 の ops の上で、型検査の誤りは 20 → 42 → 5 → 0。どれも README の「型検査で直す点」の見込みの範囲だった（2回目は、画面を消した後の使われなくなった import）。
2. ワークベンチのギャラリーは、新しいファイルの `NoopExtensionGalleryService` に差し替えた。`isEnabled()` は偽で、どの呼び出しも通信しない。おすすめの3つのサービスは、新しいファイルの何もしない実装を `extensions.contribution.ts` で登録した。
3. CLI の `--install-extension`・共有プロセスの拡張の管理・拡張の一覧・有効と無効・動作中の拡張の一覧には触れていない。マニフェストのサービスは、アカウントと私設のマーケットプレイスだけを外し、共有プロセスへ `null` を送る所は残した。
4. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。b（19単位）でも行のずれ無く当たり、`removeLines` に回すものは無かった。
5. 判断を仰ぐ点が6つある（下）。

## 直した点

一覧の正本は `removals/C-5-extension-gallery/README.md` の「edits.patch で直した点（2026-11-15）」。ここでは形だけを書く。

| 区分 | ファイル | 直し方 |
|---|---|---|
| ギャラリー | `services/extensionManagement/common/noopExtensionGalleryService.ts`（新規）、同じフォルダの `extensionGalleryService.ts` | 何もしない実装を作り、`WorkbenchExtensionGalleryService` の代わりに登録した |
| おすすめ | `services/extensionRecommendations/common/nullExtensionRecommendations.ts`（新規）、`contrib/extensions/browser/extensions.contribution.ts` | 3つの何もしない実装を作り、登録した |
| 画面 | `extensions.contribution.ts`・`extensionsViewlet.ts`・`extensionsViews.ts`・`extensionsActions.ts` | ビュー6つ、コマンド17、設定2つ、サインインの操作、状態のバッジ、ビューのクラス5つ、操作のクラス5つを消した |
| 共有プロセスとの間 | `contrib/extensions/electron-browser/extensions.contribution.ts`、`sharedProcessMain.ts` | tips の通知のチャンネルの登録をやめ、tips の名前を import から外した |
| マニフェスト | `services/extensionManagement/electron-browser/extensionGalleryManifestService.ts` | アカウントと私設のマーケットプレイスの取得を外した |

## 残した部品と理由

README の「残すもの」と `unit.json` の `kept` が正本。要点だけを書く。

| 部品 | 理由 |
|---|---|
| ワークベンチのマニフェストのサービス | 共有プロセスが `setExtensionGalleryManifest` を `Barrier` で待つ（`extensionGalleryManifestServiceIpc.ts` の25・50・60行）。前からの決まり（docs/03 の4節の末尾） |
| `services/extensionRecommendations/common/extensionRecommendations.ts` | 残る拡張の画面5つが注入する ID と型 |
| `platform/extensionManagement/common/extensionGalleryService.ts` | CLI と共有プロセスが使う。product.json に `extensionsGallery` が無いので通信しない |
| `platform/extensionManagement/common/extensionTipsService.ts` | Web の入口とテストの部品が使う |
| `platform/extensionRecommendations` | 共有プロセスの登録と、何もしない実装が使う |
| `contrib/extensions/common/extensionsFileTemplate.ts` | `.vscode/extensions.json` の JSON の検査（判断を仰ぐ点の4） |
| 内部のコマンド `workbench.extensions.command.installFromVSIX` と、右クリック・ドロップ | 前の README の決まり（判断を仰ぐ点の1） |
| `CONTEXT_HAS_GALLERY` の条件つきの画面と `ext install ` | 条件が常に偽で出ない（判断を仰ぐ点の2） |

## 拡張の導入・Claude Code・台帳の拡張への影響

- **`install-extensions.mjs`（CLI の `--install-extension <vsix> --force`）**: 影響しない見込み。CLI は `code/node/cliProcessMain.ts` で、`ExtensionGalleryServiceWithNoStorageService` と `platform` の `ExtensionGalleryManifestService` を自分で組む（`cliProcessMain.ts` の `services.set(IExtensionGalleryManifestService, ...)`・`services.set(IExtensionGalleryService, ...)` の2行）。edits.patch の10ファイルにも、C-5 の ops の `delete`・`removeLines` にも、CLI の組の部品は無い。
- **画面からの導入・管理**: 拡張の一覧・有効と無効・アンインストール・動作中の拡張の一覧のファイル（`extensionsWorkbenchService.ts`・`runtimeExtensionsEditor.ts` など）には触れていない。画面からの VSIX の導入は、共有プロセスへ `null` のマニフェストが届く限り待たずに進む見込み（起動の確かめで見る）。
- **自動更新・更新の確かめ**: `checkForUpdates` は `galleryService.isEnabled()` が偽なら最初に戻る。自動更新は `outdated`（常に空）を更新するので何もしない。ギャラリーへの通信は起きない。
- **Claude Code（2.1.322）**: manifest に `extensionDependencies`・`extensionPack`・`installExtension` の語は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`）。受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。
- **台帳の拡張**: VSIX の package.json で依存を持つのは `ms-vscode.powershell`（組み込みの `vscode.powershell` だけ）。ギャラリーは要らない。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）を6回走らせた。4回目で誤り 0（回ごとの数は `typecheck-log.md`）。
- 当て直し a（タグから16単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-5 の `delete` 20はどれも消え、`removeLines` 8行はどれも `found: 1`
  - C-5 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - 型検査は `ok`、誤り 0（HEAD `3d9a7a6f`）
  - `--lockfile-check` は `ok`
  - 最後の `unit.json` で当て直した a2（`trial/checks-verify-a2.json`）も `result: ok`
- 当て直し b（タグから19単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1〜C-5 の edits はどれも `conflicts: []`
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ
  - 型検査は `ok`、誤り 0（HEAD `2e03c80c`）
  - `--lockfile-check` は `ok`
- a・b それぞれの C-5 の ops の commit（`bc2f6da1`・`89e7f251`）の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-5-extension-gallery/edits.patch` が10ファイルとも当たった（行のずれの表示も無い）。
- 注入の外し損ね: edits.patch の後の木で `IWorkspaceExtensionsConfigService`・`IExtensionGalleryAccountService`・`@IExtensionTipsService` を `Grep` した。残るのは消すテストと Web の入口・テストの部品だけ。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 19.18 GB、終わり 18.60 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-5-extension-gallery --checks-out <file>`
   - b: 同じ `--only` の `C-1-ai,` の後に `C-2-debug,C-3-remote,C-4-notebook,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-5-extension-gallery].edits` が `{applied: "ok", subject: "unit C-5-extension-gallery: edits", conflicts: []}`
     - `units[id=C-5-extension-gallery].ops.removeLines` の8行がどれも `found: 1`、`ops.missingDeletes` が `[]`
     - `units[id=C-5-extension-gallery].warnings` が `[]`（a・b とも）
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`
     - `units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件（b だけ）
2. **`after` の確かめ**: `--only` から `C-1-ai` を外すと、C-5 の前で止まる（docs/03 の5.1 の2-1）
3. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
4. **3-way に頼らないこと**: a・b の C-5 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-5-extension-gallery/edits.patch` が 0 で終わる。
5. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-5-extension-gallery: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - edits.patch が `workbench.*.main.ts`・`sessions.*.main.ts`・`cliProcessMain.ts`・`platform/extensionManagement/` に触れない
   - edits.patch の `sharedProcessMain.ts` のハンクが import の2行の書き換えだけ
   - `delete` と `kept` に同じパスが無い。`kept` に `extensionGalleryManifestService.ts`・`extensionRecommendations.ts` がある。`delete` に `extensionGalleryManifestService.test.ts` がある
6. **当てた後の木**
   - `services/extensionManagement/common/noopExtensionGalleryService.ts`・`services/extensionRecommendations/common/nullExtensionRecommendations.ts` がある
   - `services/extensionManagement/common/extensionGalleryService.ts` に `AbstractExtensionGalleryService` の語が無く、`NoopExtensionGalleryService` を登録する
   - `extensionGalleryManifestService.ts`（electron-browser）に `IExtensionGalleryAccountService`・`IRequestService`・`ExtensionGalleryServiceUrlConfigKey` が無く、`setExtensionGalleryManifest` がある
   - browser の `extensions.contribution.ts` が `IExtensionRecommendationsService`・`IExtensionIgnoredRecommendationsService`・`IExtensionRecommendationNotificationService` を `Null*` で登録する（`registerSingleton` の3行）
   - browser の `extensions.contribution.ts` に `'workbench.extensions.action.installVSIX'` の登録（`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID`）が無く、`INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID` の登録はある
   - `extensionsViewlet.ts` に `workbench.views.extensions.marketplace`・`popular`・`extensions.recommendedList`・`otherRecommendations`・`marketplaceAccess` の語が無く、`WORKSPACE_RECOMMENDATIONS_VIEW_ID` の import が無い
   - electron-browser の `extensions.contribution.ts` に `registerChannel('extensionRecommendationNotification'` が無い
7. **何もしない実装**（作業ツリーの中で VS Code のテストの仕組みで書く場合）
   - `new NoopExtensionGalleryService()`: `isEnabled()` が偽、`query({}, CancellationToken.None)` の `firstPage` が `[]`・`total` が 0、`getExtensions([{ id: 'a.b' }], CancellationToken.None)` が `[]`、`getExtensionsControlManifest()` が `{ malicious: [], deprecated: {}, search: [], autoUpdate: {} }`、`download(...)`・`getReadme(...)` が reject、`getManifest(...)` が `null`。要求のサービスを持たないので、通信の口が無い
   - `new NullExtensionRecommendationsService()`: `getAllRecommendationsWithReason()` が `{}`、`getWorkspaceRecommendations()` が `[]` で resolve
   - `new NullExtensionIgnoredRecommendationsService()`: `globalIgnoredRecommendations` が `[]`、`toggleGlobalIgnoredRecommendation('a.b', true)` の後も `[]`
   - `new NullExtensionRecommendationNotificationService()`: `hasToIgnoreRecommendationNotifications()` が真、`promptImportantExtensionsInstallNotification(...)` が `'ignored'` で resolve
8. **拡張のテスト**（型検査は通るが、走らせていない）: `contrib/extensions/test/electron-browser` の `extensionsActions.test.ts`・`extensionsViews.test.ts`（`@recommended` の試験はおすすめのサービスを差し替えて試すので、そのまま通る見込み）・`extensionsWorkbenchService.test.ts`
9. **関門の起動の確かめ**（片づけの後）
   - `install-extensions.mjs` で台帳の拡張が入る（CLI の `--install-extension`）
   - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service` が無い
   - 拡張のビューが開き、入っている拡張・有効・無効の切り替え・アンインストールが動く。動作中の拡張の一覧が開く
   - 拡張の詳細が誤りなく開き、「おすすめ」の印が出ない
   - エクスプローラーから VSIX を入れて終わる（共有プロセスがマニフェストを待ち続けない）
   - `absentCommands`・`absentViews`・`absentSettings` が出ない
   - 通信の監査で、ギャラリー（`marketplace.visualstudio.com`・`open-vsx.org` など）への接続が無い

## 判断を仰ぐ点（別案）

README の「別案と判断を仰ぐ点」が正本。

1. **画面からの VSIX の導入（エクスプローラーの右クリック・拡張のビューへのドロップ）を残した**
   - 採った案: 前の README の「内部のコマンド `installFromVSIX` は残す」に従い、コマンドとそれを使う画面を残す。「VSIX からインストール」（ファイルを選ぶ画面）は消した
   - 別案: コマンドは残し、右クリックのメニューとドロップを外す。docs/01 の「画面からの検索・追加は消す」により近い
2. **`CONTEXT_HAS_GALLERY` の条件つきの画面と `ext install ` の Quick Access を残した**
   - 条件は常に偽で出ない。`ext install ` は何も見つからず、名前で探す項目だけを出す
   - 別案: 消す（`extensions.contribution.ts` のハンクが増え、毎週の衝突が増える）
3. **設定 `extensions.gallery.serviceUrl`・`extensions.gallery.authProvider` の登録を残した**
   - 読み手は消した。2つとも `build/lib/policies/policyData.jsonc` に載るポリシーで、消すとその一覧と食い違う
   - 別案: 消す（ポリシーの一覧も直す）
4. **`.vscode/extensions.json` の JSON の検査（`extensionsFileTemplate.ts`）を残した**（消すか迷ったもの）
   - 編集の手伝いだけで通信しない
   - 別案: 消す（`delete` に足し、登録の2行を外す）
5. **マーケットプレイスの状態のバッジ（`ExtensionMarketplaceStatusUpdater`）を消した**（前の README に無かった、足したもの）
   - サインインが要る状態を作るのは消したアカウントだけ。2026-11-14 の規則（消す部品だけが使うものは消す）の当てはめ
   - 別案: 残す（常に何も出さない）
6. **何もしないギャラリーは、`getExtensions` などで誤りを投げず空を返す**
   - 前の README の見込みどおり。本家はギャラリーが無いとき `No extension gallery service configured.` を投げる。呼ぶ側は空を「見つからない」として扱う
   - 別案: 本家と同じく投げる

## docs/ との食い違い

- docs/03 の4節の表（135行）の C-5 は `extensionGalleryManifestService` を消す側に挙げる。4節の末尾（147行）は「ワークベンチ側を残す」と書き、実装は後者に合わせた（前からの食い違い。C-3・C-4 と同じく、表の側を直すかはリーダーの判断）。
- docs/03 の4節の表の C-5 は「おすすめ（`services/extensionRecommendations`）」を消す側に挙げる。実際は、フォルダの中の `extensionRecommendations.ts`（ID と型）を残し、何もしない実装 `nullExtensionRecommendations.ts` を同じフォルダに足した（前の README の決まりどおり）。
- docs/01 の39行は「画面からの検索・追加は消す（C-5）」と書く。画面からの VSIX の導入（右クリック・ドロップ）は残した（判断を仰ぐ点の1）。

## 未解決の点

- 起動時の注入（DI）の外し損ねと、共有プロセスがマニフェストを待ち続けないことは、型検査では見えない。起動の確かめで見る。
- 拡張のテストは走らせていない（許可に無い。曹参の担当）。
- パッケージ化（`vscode-win32-x64-min`）、起動は、片づけの許可の後。
- 許可に無いコマンドで止まった所は、`cd` と、`|` を含む形（`apply.mjs ... 2>&1 | tail`）だけ。どちらも使わない形で済んだ。許可の追加は要らない。誤って作ったファイルは無い。
- `disk-end.json` は確かめ b の後（03:47 UTC）に測った。その後の a2 の当て直しは、作業ツリーの中の書き換えだけ。

## 2回目（2026-11-15、画面からの VSIX の導入と `ext install ` を外す）

依頼: `brief.md` の「追加の依頼（2026-11-15、1回目の後）」の1〜4。判断の記録は `docs/user-decisions.md` の「C-5 の edits.patch を作るときに出た点」（判断を仰ぐ点の1は別案、`ext install ` は消す、2〜6は採った案のまま）。

### 結果

**完了**。1〜4をすべて行った。パッケージ化と zip、ビルド・起動・関門は行っていない。

### 成果物（2回目に変えたもの）

- `removals/C-5-extension-gallery/edits.patch`（作り直した）: 11ファイル（新規2）、245行の追加、1,170行の削除。From の commit は `cd9cf41d`、件名と作者は1回目と同じ
- `removals/C-5-extension-gallery/unit.json`: `checks.absentStrings` に4つを足した（下）。ほかは変えていない
- `removals/C-5-extension-gallery/README.md`: 「消すもの」「edits.patch で直した点」「残すもの」「拡張の導入と管理への影響」「別案と判断を仰ぐ点」（6つとも決着と書いた）「未確認」を直した
- `tasks/2026-11-15-p5-c5-patch/typecheck-log.md`: 「5. 2回目」を足した
- `tasks/2026-11-15-p5-c5-patch/trial/`: `checks-r2-base.json`・`checks-r2-verify-a.json`・`checks-r2-verify-b.json`、`build-typecheck-r2-{1,2,verify-a,verify-b}.json`、`lockfile-r2-a.diff`・`lockfile-r2-b.diff`
- `tasks/2026-11-15-p5-c5-patch/disk-start-2.json`・`disk-end-2.json`

### 直した点

| 依頼 | ファイル | 直し方 |
|---|---|---|
| 1. 右クリックのメニュー | `contrib/extensions/browser/extensions.contribution.ts` | `INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID`（`workbench.extensions.command.installFromVSIX`）の登録から `menu`（`MenuId.ExplorerContext`、`.vsix` のとき）を外した。コマンドの登録と中身はそのまま。使われなくなった `ResourceContextKey` の import を外した |
| 1. ドロップ | `contrib/extensions/browser/extensionsViewlet.ts` | `ExtensionsViewPaneContainer.create` の重ねの表示（`.overlay`）と `DragAndDropObserver`、`isSupportedDragElement` を消した。使われなくなった import 8つと `commandService`（このクラスの注入）を外した |
| 2. `ext install ` | `extensions.contribution.ts`・`extensionsQuickAccess.ts` | 登録（`registerQuickAccessProvider`）と、使い手が無くなった `InstallExtensionQuickAccessProvider` のクラスを消した。`ext ` の Quick Access（`ManageExtensionsQuickAccessProvider`。拡張のビューを開くだけ）は残す |

`checks.absentStrings` に足した4つ（範囲は `src/vs/workbench/contrib/extensions`）

- `InstallExtensionQuickAccessProvider`、`'ext install '`（Quick Access）
- `isEqualTo('.vsix')`（右クリックのメニューの条件）
- `extractEditorsAndFilesDropData`（ドロップ）

4つとも 1.146.0 の `contrib/extensions` にある（`C:\b\wt\1.146.0` を `Grep`）ので、空振りしない。コマンド `installFromVSIX` は残すので `absentCommands` には足せない。メニューの項目を見る `checks` の種類は無い（docs/03 の3.1）。

### 影響

- 画面から拡張を入れる道は無くなった。導入は CLI の `--install-extension`（`install-extensions.mjs`）だけ。docs/01 の「拡張のインストール（CLI のみ）」と合う。
- 残る導入の入口は、内部のコマンド `installFromVSIX` と拡張の API のコマンド `workbench.extensions.installExtension`（拡張やコマンドから VSIX の URI を渡したときだけ動く）。
- 拡張のビューに VSIX 以外のファイルを落としたときの振る舞いは、ビューが受けなくなったので、ワークベンチの既定（エディタで開くなど）になる見込み（起動の確かめで見る）。
- CLI・共有プロセス・拡張の一覧・有効と無効・動作中の拡張の一覧には、2回目でも触れていない。

### 確かめたこと

- 1回目の edits.patch を含む16単位を土台に直し、型検査は 15 → 0（内訳は `typecheck-log.md` の5節）。
- 当て直し a（16単位）: 適用 `ok`、C-5 の edits `conflicts: []`、警告無し、足した4つを含む `absentStrings` は `ok`。型検査は誤り 0（HEAD `aaaf69c4`）。`--lockfile-check` は `ok`。
- 当て直し b（19単位）: 適用 `ok`、C-1〜C-5 の edits はどれも `conflicts: []`、警告は C-2 の想定の1件だけ。型検査は誤り 0（HEAD `735b2e2a`）。`--lockfile-check` は `ok`。
- a・b それぞれの C-5 の ops の commit（`d7021056`・`b3da2775`）の上で、`git apply --check -v` が11ファイルとも行のずれ無く当たった。新しく触れた `extensionsQuickAccess.ts` は、C-1〜C-4 のどの edits.patch も触れない。`removeLines` に回すものは無い。
- ロックファイルはどちらの組でも検査の後に戻した。
- ディスク: C: の空きは、始め 19.08 GB、終わり 19.09 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は `Grep` で読んだだけ）。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`status` は `HEAD detached at 1.146.0`、作業ツリーはきれい。

### テストの入口（曹参へ。1回目の節に足すもの）

- 当て直しの期待は1回目と同じ。`checks.absentStrings` の C-5 の項目が19（下準備の10、1回目に足した5、2回目に足した4）で、どれも `hitCount: 0`。
- 当てた後の木
  - `extensions.contribution.ts` に `MenuId.ExplorerContext`・`ResourceContextKey`・`InstallExtensionQuickAccessProvider`・`registerQuickAccessProvider()` が無く、`id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID` の登録はある（`menu` を持たない）
  - `extensionsViewlet.ts` に `DragAndDropObserver`・`isSupportedDragElement`・`INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID` が無い
  - `extensionsQuickAccess.ts` に `ManageExtensionsQuickAccessProvider` だけがあり、`PREFIX = 'ext '`
- 静的な検査: edits.patch が `extensionsQuickAccess.ts` を含む11ファイルに触れる（1回目の10に1つ増えた）
- 関門の起動の確かめ（片づけの後）
  - エクスプローラーで `.vsix` を右クリックしても「拡張の VSIX のインストール」が出ない
  - 拡張のビューに `.vsix` を落としても入らない（重ねの表示も出ない）
  - Quick Access で `ext install ` を打っても導入の候補が出ない。`ext ` は拡張のビューを開く
  - コマンドの一覧に `workbench.extensions.command.installFromVSIX` が残っている（内部のコマンド。コマンドパレットには出ない見込み）

### docs/ との食い違い

- 1回目に挙げた docs/01 の39行との食い違いは、この2回目で解けた。
- docs/03 の4節の表の2点（`extensionGalleryManifestService`、`services/extensionRecommendations`）は1回目のまま。

### 未解決の点

- 起動の確かめ（注入の外し損ね、上の画面の確かめ）は、片づけの許可の後。
- 拡張のテストは走らせていない（曹参の担当）。1.146.0 の `contrib/extensions/test` に、ドロップ・`InstallExtensionQuickAccessProvider`・`installFromVSIX` を試すテストは無い（`Grep` で 0 件）。
- 許可に無いコマンドで止まった所は無い。誤って作ったファイルも無い。
- SubagentHandback は、定義の `tools` に無いのでフックで止まる（1回目と同じ）。報告はこのファイル。

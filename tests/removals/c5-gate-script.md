# C-5（拡張のギャラリー）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` は大岡越前守が検証で使うので、触れていない）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c5-patch/handoff-notes.md` の1回目と2回目）と `removals/C-5-extension-gallery/unit.json` から写した。行数・sha は期待に含めない。記録は2回目の `trial/checks-r2-*`・`build-typecheck-r2-*` の形（`edits.patch` が11ファイル、`absentStrings` が19項目）。

前提: `tests/c5-unit.test.mjs`（静的な検査・何もしない実装の検査・画面からの導入が消えた検査・CLI の道に触れていない検査。`after` の確かめを含む）、`tests/c5-mutation.test.mjs`、`tests/c5-check-json.test.mjs`、`tests/c5-worktree.test.mjs` が先に通っている（`node tests/run-all.mjs` の fail が 0）。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-5 の当て直しは**2つの組**で見る（C-5 は C-1 だけを前提にする。C-2〜C-4 は前提にしないが、あっても当たること）。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、次を走らせる。

## 1. 当て直し（入口の1）

### 1a. 組 a: A・B の14単位と C-1・C-5（16単位。C-2〜C-4 なし）

```
node scripts/apply.mjs C:/b/wt/p2 --label c5-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-5-extension-gallery --checks-out C:/b/logs/c5-gate/checks-a.json
node tests/c5-check-json.mjs C:/b/logs/c5-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1〜C-5（19単位。この順）

```
node scripts/apply.mjs C:/b/wt/p2 --label c5-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery --checks-out C:/b/logs/c5-gate/checks-b.json
node tests/c5-check-json.mjs C:/b/logs/c5-gate/checks-b.json
```

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c5-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 16。すべて `applied: ok` | 19。すべて `applied: ok`。順序は C-1、C-2、C-3、C-4、C-5 |
| `units[id=C-5-extension-gallery].edits` | `applied: "ok"`、`subject: "unit C-5-extension-gallery: edits"`、`conflicts: []` | 同じ |
| `units[id=C-5-extension-gallery].ops` | `deleted` が `unit.json` の `delete` の数（20）と同じ。`missingDeletes` は `[]`。`removeLines` 8行がどれも `found: 1`・`count: 1`。`productRemoved`・`productMissing` は `[]` | 同じ |
| `units[id=C-5-extension-gallery].warnings` | `[]` | `[]` |
| `units[id=C-1-ai]` の `edits`（b は C-2〜C-4 も） | `applied: "ok"`、`conflicts: []` | 同じ |
| 記録の最上位の `warnings` | 空（C-2 が無い） | C-2 の `delete: ...debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ。想定済み |
| `checks.remnants.status` | `ok` | `ok` |
| `checks.absentStrings.status` | `ok`（C-5 の19項目すべて記録があり、`hitCount` が 0。画面の導入を守る4つ `InstallExtensionQuickAccessProvider`・`'ext install '`・`isEqualTo('.vsix')`・`extractEditorsAndFilesDropData` を含む） | 同じ |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-5-extension-gallery: ops` → `unit C-5-extension-gallery: edits`。C-1 の edits の後。作者はどれも `sukuna-apply <apply@sukuna.invalid>` | 同じ。C-2〜C-4 の edits の後 |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`。`git status` は使わない） | 同じ |

C-5 の edits に衝突が出る、C-5 の `warnings` が出る、のどれかなら、ほかの単位との重なりが増えている。蒙恬に返す（docs/03 の5.3: C-5 は `workbench.*.main.ts` に触れず、C-2〜C-4 の edits.patch と同じファイルに触れない）。

### 1c. C-1 を外すと止まること（入口の2。5.1 の `after` の確かめ）

`--only` から `C-1-ai` を外して走らせる。作業ツリーをタグに戻してから行う。

```
node scripts/apply.mjs C:/b/wt/p2 --label c5-gate-noc1 --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-5-extension-gallery --checks-out C:/b/logs/c5-gate/checks-noc1.json
node tests/c5-check-json.mjs --stopped C:/b/logs/c5-gate/checks-noc1.json
```

期待: `result` が `ok` でない（`fail`）。`errors` に `C-5-extension-gallery: after の単位 C-1-ai が先に当たらない（--only に入っていない）`、または `stoppedAt.message` に `C-5-extension-gallery: after の単位が当たっていない: C-1-ai`。C-5 は `applied: ok` にならない。終わったら作業ツリーを `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻す。静的な代わりは `c5-unit.test.mjs` の「after の確かめ」（`planUnits` を直接呼ぶ）。

### 1d. 当てた後の作業ツリーの状態（入口の6。a の後、b の後に1回ずつ）

```
node tests/c5-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- 無い: `unit.json` の `delete` の20（おすすめのサービス・exe ベース・ギャラリーのアカウント・tips ほか）と、`platform/extensionManagement/node/extensionTipsService.ts`
- ある: 新しいファイル2つ（`services/extensionManagement/common/noopExtensionGalleryService.ts`・`services/extensionRecommendations/common/nullExtensionRecommendations.ts`）、`unit.json` の `kept` の全部（`extensionRecommendations.ts`、ワークベンチのマニフェストのサービス、platform のギャラリーの基底、`platform/extensionRecommendations` ほか）
- ワークベンチの `extensionGalleryService.ts` に `AbstractExtensionGalleryService` が無く、`NoopExtensionGalleryService` を登録している
- マニフェストのサービス（electron-browser）に `IExtensionGalleryAccountService`・`IRequestService`・`ExtensionGalleryServiceUrlConfigKey` が無く、共有プロセスのチャンネル `extensionGalleryManifest` へ送る所と登録が残っている
- browser の `extensions.contribution.ts` が `IExtensionRecommendationNotificationService`・`IExtensionRecommendationsService`・`IExtensionIgnoredRecommendationsService` を `Null*` で登録している。**`MenuId.ExplorerContext`・`ResourceContextKey`・`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID` の登録・`'ext install '`・`InstallExtensionQuickAccessProvider` が無く、`id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID`（内部のコマンド）の登録は残っている**
- `extensionsViewlet.ts` にギャラリー・おすすめのビューの語、**`DragAndDropObserver`・`isSupportedDragElement`・`INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID`** が無い
- `extensionsQuickAccess.ts` に `ManageExtensionsQuickAccessProvider`（`PREFIX = 'ext '`）だけがある
- electron-browser の `extensions.contribution.ts` に `registerChannel('extensionRecommendationNotification'` が無い
- `sharedProcessMain.ts` に `ExtensionTipsService`・`ExtensionTipsChannel` が無く、`ExtensionManagementChannel`・`IExtensionGalleryService` は残る
- `workbench.common.main.ts`・`workbench.desktop.main.ts` に消した部品の import が無い
- `removeLines` の8行が各ファイルに残っていない
- **CLI の道**: `src/vs/code/node/cliProcessMain.ts` が `ExtensionGalleryServiceWithNoStorageService` と platform の `ExtensionGalleryManifestService` を自分で組んでいる（C-5 は触れていない）

### 1e. ロックファイル（a の後、b の後に1回ずつ。C-5 は依存もパッチも消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c5-lock-a --lockfile-check --checks-out C:/b/logs/c5-gate/checks-lock-a.json
```

（b の後は `c5-lock-b`、`checks-lock-b.json`。`--lockfile-check` の記録は単位の欄が違う形のことがある。`checks.lockfile` の行だけ見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。`removedPatches` は `["foundry-local-sdk"]`（C-1 の分）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1f. 3-way に頼らずに当たること（入口の4。a の後、b の後に1回ずつ）

C-5 の ops の commit を探して checkout し、パッチが文脈だけで当たるかを見る。

```
git -C C:/b/wt/p2 log --format="%H %s" -n 80
git -C C:/b/wt/p2 checkout <「unit C-5-extension-gallery: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-5-extension-gallery/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: 終了コードが 0。11ファイル（新規2）の全ハンクが当たり、行のずれ（offset）の表示も無い。

## 2. 型検査（入口の3。組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c5-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c5-gate/typecheck-a.json --take-in-dir C:/b/logs/c5-gate/take-in-a
node tests/c5-check-json.mjs C:/b/logs/c5-gate/checks-a.json C:/b/logs/c5-gate/typecheck-a.json
```

（b は `c5-gate-b`、`typecheck-b.json`、`checks-b.json`。型検査は a の当て直しの上で a、b の当て直しの上で b を走らせる。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ（`c5-check-json.mjs` が照らす） |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service`）と、共有プロセスがマニフェストを待ち続けること（5節で見る）。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c5-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c5-check-json.mjs --stopped <checks.json>
node tests/c5-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）、2 = 使い方の誤り。書き込みはしない。`c5-check-json.mjs` は単位の並びから組（a・b）を自動で見分け、組ごとの期待を使う。

## 4. 何もしない実装の「走らせる形」と拡張のテスト（VS Code のテストの仕組み。実行は大岡越前守、任意）

静的な検査と、型を外した本文を node で走らせる検査（`NoopExtensionGalleryService`・`NullExtensionRecommendationsService` ほかの振る舞いと、通信しないこと）は `tests/c5-unit.test.mjs` にある。本物の型の上で走らせる形と、拡張のテストは、作業ツリーで `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。作業ツリーに足すのは蒙恬か大岡越前守。ここに入口だけを書く。

- `new NoopExtensionGalleryService()`: `isEnabled()` が偽、`query({}, CancellationToken.None)` の `firstPage` が `[]`・`total` が 0、`getExtensions([{ id: 'a.b' }], CancellationToken.None)` が `[]`、`getExtensionsControlManifest()` が `{ malicious: [], deprecated: {}, search: [], autoUpdate: {} }`、`download(...)`・`getReadme(...)` が reject、`getManifest(...)` が `null`
- `NullExtensionRecommendationsService`・`NullExtensionIgnoredRecommendationsService`・`NullExtensionRecommendationNotificationService`: 空・何も無視しない・`promptImportantExtensionsInstallNotification(...)` が `'ignored'` で resolve
- 拡張のテスト（入口の8。型検査は通るが走らせていない）: `contrib/extensions/test/electron-browser` の `extensionsActions.test.ts`・`extensionsViews.test.ts`（`@recommended` の試験はおすすめのサービスを差し替えて試すのでそのまま通る見込み）・`extensionsWorkbenchService.test.ts`

## 5. 関門の起動の確かめ（入口の9。片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `absence`。

- **CLI の `--install-extension` の道が壊れていない（最重要。docs/04）**: `install-extensions.mjs` で台帳の拡張が入る（`<CLI> --install-extension <vsix> --force`）。Claude Code 拡張と PowerShell 拡張が入って起動する。この道は `cliProcessMain.ts` が自分でギャラリーとマニフェストを組むので、C-5 では変わらないはず。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`extensionRecommendationsService`・`extensionIgnoredRecommendationsService`・`extensionRecommendationNotificationService`・`extensionGalleryAccountService`・`extensionTipsService`）が無い。
- **画面からの導入が消えている**:
  - エクスプローラーで `.vsix` を右クリックしても「拡張の VSIX のインストール」が出ない。
  - 拡張のビューに `.vsix` を落としても入らない。重ねの表示も出ない（ワークベンチの既定の動き: エディタで開くなど）。
  - Quick Access で `ext install ` を打っても導入の候補が出ない。`ext ` は拡張のビューを開く。
  - コマンドパレットに「VSIX からインストール」（`workbench.extensions.action.installVSIX`）が出ない。
  - 内部のコマンド `workbench.extensions.command.installFromVSIX` は残っている（コマンドパレットには出ない）。
- 拡張のビューが開き、入っている拡張の一覧・有効と無効の切り替え・アンインストールが動く。動作中の拡張の一覧が開く。検索の入力欄・マーケットプレイスの一覧・人気・おすすめのビューは出ない。
- 拡張の詳細が誤りなく開き、「おすすめ」の印が出ない。
- 共有プロセスの導入が止まらない（共有プロセスがマニフェストを待ち続けない）: 拡張の導入の API（`workbench.extensions.installExtension` に VSIX の URI を渡す）で入る。
- `absentCommands`（17）・`absentViews`（6）・`absentSettings`（`extensions.ignoreRecommendations`・`extensions.showRecommendationsOnlyOnDemand`）が出ない。
- **通信の監査で、ギャラリーへの接続が無い**: `scripts/netaudit.ps1` で、`marketplace.visualstudio.com`・`open-vsx.org`・`gallery.vsassets.io` など拡張のギャラリーのホストへの接続が無い。更新の確かめ・自動更新・おすすめの取得でも通信しない（`NoopExtensionGalleryService` は要求のサービスを持たない）。
- Claude Code のパネル（Webview）が開き、差分とコメントが動く（docs/03 の9節。manifest に `extensionDependencies`・`extensionPack`・`installExtension` の語は無い）。

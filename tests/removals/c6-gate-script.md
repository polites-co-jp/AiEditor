# C-6（設定の同期）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` は大岡越前守が検証で使うので、触れていない）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c6-patch/handoff-notes.md`）、`removals/C-6-settings-sync/unit.json`、本家 1.146.0 から写した。行数・sha は期待に含めない。記録は `trial/checks-verify-{a,b}.json`・`build-typecheck-verify-{a,b}.json` の形（`edits.patch` が5ファイル、`absentStrings` が9項目）。

前提: `tests/c6-unit.test.mjs`（静的な検査・型検査に掛からない注入の外し損ねの検査・続きの編集に触れない検査。`after` の確かめを含む）、`tests/c6-mutation.test.mjs`、`tests/c6-check-json.test.mjs`、`tests/c6-worktree.test.mjs` が先に通っている（`node tests/run-all.mjs` の fail が 0。C-1 の門の抜けが直るまでは、既知の2本だけ落ちていてよい）。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-6 の当て直しは**2つの組**で見る（C-6 は C-1 だけを前提にする。C-2〜C-5 は前提にしないが、あっても当たること）。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、次を走らせる。

## 1. 当て直し

### 1a. 組 a: A・B の14単位と C-1・C-6（16単位。C-2〜C-5 なし）

```
node scripts/apply.mjs C:/b/wt/p2 --label c6-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-6-settings-sync --checks-out C:/b/logs/c6-gate/checks-a.json
node tests/c6-check-json.mjs C:/b/logs/c6-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1〜C-6（20単位。この順）

```
node scripts/apply.mjs C:/b/wt/p2 --label c6-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync --checks-out C:/b/logs/c6-gate/checks-b.json
node tests/c6-check-json.mjs C:/b/logs/c6-gate/checks-b.json
```

段階 C のすべて（C-1〜C-7。21単位。C-6 の後に C-7）の記録も、組 c として C-6 を照らせる（`node tests/c6-check-json.mjs <checks-21.json> <typecheck-21.json>`）。警告は C-2 の1件。

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c6-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 16。すべて `applied: ok` | 20。すべて `applied: ok`。順序は C-1、C-2、C-3、C-4、C-5、C-6 |
| `units[id=C-6-settings-sync].edits` | `applied: "ok"`、`subject: "unit C-6-settings-sync: edits"`、`conflicts: []` | 同じ |
| `units[id=C-6-settings-sync].ops` | `deleted` が `unit.json` の `delete` の数（2）と同じ。`missingDeletes` は `[]`。`removeLines` 3行がどれも `found: 1`・`count: 1`。`productRemoved`・`productMissing`・`removedDependencies` は `[]` | 同じ |
| `units[id=C-6-settings-sync].warnings` | `[]` | `[]` |
| `units[id=C-1-ai]` の `edits`（b は C-2〜C-5 も） | `applied: "ok"`、`conflicts: []` | 同じ |
| 記録の最上位の `warnings` | 空（C-2 が無い） | C-2 の `delete: ...debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ。想定済み |
| `checks.remnants.status` | `ok` | `ok` |
| `checks.absentStrings.status` | `ok`（C-6 の9項目すべて記録があり、`hitCount` が 0。注入の外し損ねを守る `IUserDataSyncWorkbenchService`（preferences・relauncher）、`SyncControls`、`onDidTurnOnSync` を含む） | 同じ |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-6-settings-sync: ops` → `unit C-6-settings-sync: edits`。C-1 の edits の後。作者はどれも `shuko-apply <apply@shuko.invalid>` | 同じ。C-2〜C-5 の edits の後 |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`。`git status` は使わない） | 同じ |

C-6 の edits に衝突が出る、C-6 の `warnings` が出る、のどれかなら、ほかの単位との重なりが増えている。蒙恬に返す（docs/03 の5.3: C-6 は `workbench.*.main.ts` の行を removeLines の3行だけで消し、ほかの単位の edits.patch と同じファイルに触れない）。

### 1c. C-1 を外すと止まること（5.1 の `after` の確かめ）

`--only` から `C-1-ai` を外して走らせる。作業ツリーをタグに戻してから行う。

```
node scripts/apply.mjs C:/b/wt/p2 --label c6-gate-noc1 --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-6-settings-sync --checks-out C:/b/logs/c6-gate/checks-noc1.json
node tests/c6-check-json.mjs --stopped C:/b/logs/c6-gate/checks-noc1.json
```

期待: `result` が `ok` でない（`fail`）。`errors` に `C-6-settings-sync: after の単位 C-1-ai が先に当たらない（--only に入っていない）`、または `stoppedAt.message` に `C-6-settings-sync: after の単位が当たっていない: C-1-ai`。C-6 は `applied: ok` にならない。終わったら作業ツリーを `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻す。静的な代わりは `c6-unit.test.mjs` の「after の確かめ」（`planUnits` を直接呼ぶ）。

### 1d. 当てた後の作業ツリーの状態（a の後、b の後に1回ずつ）

```
node tests/c6-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- 無い: `unit.json` の `delete` の2（`contrib/userDataSync` の全部、`services/userDataSync/browser/userDataSyncWorkbenchService.ts`）
- ある: `unit.json` の `kept` の全部（`services/userDataSync/common/userDataSync.ts`、`browser/userDataSyncEnablementService.ts`、`electron-browser`、`common/userDataSyncUtil.ts`、`platform/userDataSync`、`services/accounts`）
- **型検査に掛からない注入の外し損ね（src/vs の全体を走査する）**: `@IUserDataSyncWorkbenchService` の注入がどこにも無い。`IUserDataSyncWorkbenchService` の語は、定義の `services/userDataSync/common/userDataSync.ts` と、判断済みの例外 `contrib/update/browser/update.ts`（Web の入口だけが登録する操作の中で `accessor.get` する。デスクトップでは呼ばれない）だけにある。消した部品への import が無い。`registerChannel('userDataSyncUtil'` が無い
- `settingsEditor2.ts` に `SyncControls`・`lastSyncedLabel`・`IUserDataSync` が無く、`SettingsEditor2` の本体はある。CSS に `last-synced-label` が無い。テストに `IUserDataSyncWorkbenchService` の stub が無い
- `relauncher.contribution.ts` に `onDidTurnOnSync`・`IUserDataSyncWorkbenchService` が無く、`@IUserDataSyncService`・`@IUserDataSyncEnablementService` の注入と設定の変更で再起動を尋ねる所は残る
- **続きの編集（`contrib/editSessions`）は残り、消した部品を使っていない**（ユーザーの裁定）
- `workbench.common.main.ts`・`workbench.desktop.main.ts` に消した部品の import が無い。`removeLines` の3行が残っていない

（`src/vs/sessions` は C-1 が消すので、a・b とも当て直しの後は存在しない。存在すれば C-1 の問題で、ここでは「消した部品への import が残る」として出る。）

### 1e. ロックファイル（a の後、b の後に1回ずつ。C-6 は依存もパッチも消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c6-lock-a --lockfile-check --checks-out C:/b/logs/c6-gate/checks-lock-a.json
```

（b の後は `c6-lock-b`、`checks-lock-b.json`。`checks.lockfile` の行だけ見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。`removedPatches` は `["foundry-local-sdk"]`（C-1 の分）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1f. 3-way に頼らずに当たること（a の後、b の後に1回ずつ）

```
git -C C:/b/wt/p2 log --format="%H %s" -n 80
git -C C:/b/wt/p2 checkout <「unit C-6-settings-sync: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-6-settings-sync/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: 終了コードが 0。5ファイルの全ハンクが当たり、行のずれ（offset）の表示も無い。

## 2. 型検査（組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c6-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c6-gate/typecheck-a.json --take-in-dir C:/b/logs/c6-gate/take-in-a
node tests/c6-check-json.mjs C:/b/logs/c6-gate/checks-a.json C:/b/logs/c6-gate/typecheck-a.json
```

（b は `c6-gate-b`、`typecheck-b.json`、`checks-b.json`。型検査は a の当て直しの上で a、b の当て直しの上で b を走らせる。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ（`c6-check-json.mjs` が照らす） |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service`）。これは 1d の全体の走査と、5節の起動で見る。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c6-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c6-check-json.mjs --stopped <checks.json>
node tests/c6-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）、2 = 使い方の誤り。書き込みはしない。`c6-check-json.mjs` は単位の並びから組（a・b）を自動で見分け、組ごとの期待を使う。

## 4. 設定の画面・再起動の部品のテスト（VS Code のテストの仕組み。実行は大岡越前守、任意）

edits.patch が直した2つのテストは、作業ツリーで `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。作業ツリーに足すのは蒙恬か大岡越前守。入口だけを書く。

- `src/vs/workbench/contrib/relauncher/test/browser/relauncher.test.ts`: コンストラクタの引数を1つ減らした形（`hostService, configurationService, userDataSyncService, userDataSyncEnablementService, productService, dialogService`）で、設定の変更の再起動の案内の試験が通る
- `src/vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.ts`: `IUserDataSyncWorkbenchService` の stub を外しても通る（`IUserDataSyncEnablementService` の stub は残る）

## 5. 関門の起動の確かめ（片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `absence`。

- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（特に `userDataSyncWorkbenchService`）が無い。**設定の画面（`Ctrl+,`）が誤りなく開く**（ヘッダーに「Backup and Sync Settings」のボタンも「最後に同期した時刻」も出ない。検索の入力欄・設定の木は動く）
- **設定の変更で再起動を尋ねる案内**（例: `window.titleBarStyle` を変える）が出る。再起動の部品が壊れていない
- コマンドパレットに `Settings Sync` 系（`workbench.userDataSync.actions.turnOn`・`workbench.userData.actions.openSyncBackupsFolder`・`workbench.userDataSync.actions.downloadSyncActivity`）が出ない。アカウントのメニュー（アクティビティバー）に「Backup and Sync Settings」が出ない。同期の画面・競合のビュー（`workbench.view.sync` など）が出ない
- **続きの編集が残っている**: コマンドパレットで `Continue Working On...` を探すと出る（ユーザーの裁定。`contrib/editSessions` に触れていない）。起動時にこの contribution の誤りが出ない
- プロファイル（`Profiles: ...` のコマンド）と拡張の管理（拡張のビュー、有効・無効の切り替え）が動く。プロファイルを作る・切り替える画面に誤りが出ない（同期の状態のサービスは残してある）
- `absentCommands`（2）が出ない。**通信の監査で、設定の同期のサーバーへの接続が無い**: `scripts/netaudit.ps1` で、同期のストア（`vscode-sync.trafficmanager.net` など）への接続が無い。共有プロセスの同期は、ストアが無い（`product.json` に `configurationSync.store` が無い）ので動かない
- Claude Code のパネル（Webview）が開き、差分とコメントが動く（docs/03 の9節）。CLI の `--install-extension` で台帳の拡張が入る（C-6 は触れていないはずだが、docs/07 の関門として確かめる）

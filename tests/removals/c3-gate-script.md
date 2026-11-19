# C-3（リモート）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` に書き込むため）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c3-patch/handoff-notes.md`）の「テストの入口」と `removals/C-3-remote/unit.json` から写した。行数・sha は期待に含めない。

前提: `tests/c3-unit.test.mjs`（静的な検査。`after` の確かめを含む）、`tests/c3-mutation.test.mjs`、`tests/c3-check-json.test.mjs`、`tests/c3-worktree.test.mjs` が先に通っている（`node tests/run-all.mjs` の fail が 0）。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-3 の当て直しは**2つの組**で見る（docs/03 の4節の末尾: C-3 は C-1 を前提にする。C-2 は前提にしないが、C-2 があっても当たること）。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、次を走らせる。

## 1. 当て直し（入口の1）

### 1a. 組 a: A・B の14単位と C-1・C-3（16単位。C-2 なし）

```
node scripts/apply.mjs C:/b/wt/p2 --label c3-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-3-remote --checks-out C:/b/logs/c3-gate/checks-a.json
node tests/c3-check-json.mjs C:/b/logs/c3-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1・C-2・C-3（17単位。C-1、C-2、C-3 の順）

```
node scripts/apply.mjs C:/b/wt/p2 --label c3-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-3-remote --checks-out C:/b/logs/c3-gate/checks-b.json
node tests/c3-check-json.mjs C:/b/logs/c3-gate/checks-b.json
```

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c3-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 16。すべて `applied: ok` | 17。すべて `applied: ok`。順序は C-1、C-2、C-3 |
| `units[id=C-3-remote].edits` | `applied: "ok"`、`subject: "unit C-3-remote: edits"`、`conflicts: []` | 同じ |
| `units[id=C-3-remote].ops` | `deleted` 4つ（`missingDeletes` は `[]`）。`removeLines` 13行がどれも `found: 1`・`count: 1`。`productRemoved` 9つ（`serverLicenseUrl`・`serverGreeting`・`serverLicense`・`serverLicensePrompt`・`serverApplicationName`・`serverDataFolderName`・`tunnelApplicationName`・`win32TunnelServiceMutex`・`win32TunnelMutex`）、`productMissing` は `[]` | 同じ |
| `units[id=C-3-remote].warnings` | `[]` | `[]` |
| `units[id=C-1-ai].edits` | `applied: "ok"`、`conflicts: []` | 同じ。`units[id=C-2-debug].edits` も `conflicts: []` |
| 記録の最上位の `warnings` | 空 | C-2 の `delete: ...debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ。想定済み（C-2 の台本と同じ。C-2 は C-1 なしでも当たるために `delete` に持つ） |
| `checks.remnants.status` | `ok` | `ok` |
| `checks.absentStrings.status` | `ok`（C-3 の10項目すべて記録があり、`hitCount` が 0） | 同じ（C-1・C-2 の項目も 0） |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-3-remote: ops` → `unit C-3-remote: edits`。C-1 の edits の後。作者はどれも `sukuna-apply <apply@sukuna.invalid>` | 同じ。C-2 の edits の後 |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`。`git status` は使わない） | 同じ |

C-3 の edits に衝突が出る、C-3 の `warnings` が出る、のどれかなら、ほかの単位との重なりが増えている。蒙恬に返す（docs/03 の5.3: C-3 の edits.patch が触るのは `viewsExtensionPoint.ts` だけで、ほかの単位のパッチもそのファイルに触れない）。

### 1c. C-1 を外すと止まること（入口の2。5.1 の `after` の確かめ）

`--only` から `C-1-ai` を外して走らせる。作業ツリーをタグに戻してから行う。

```
node scripts/apply.mjs C:/b/wt/p2 --label c3-gate-noc1 --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-3-remote --checks-out C:/b/logs/c3-gate/checks-noc1.json
node tests/c3-check-json.mjs --stopped C:/b/logs/c3-gate/checks-noc1.json
```

期待: `result` が `ok` でない（`fail`）。`errors` に `C-3-remote: after の単位 C-1-ai が先に当たらない（--only に入っていない）`、または `stoppedAt.message` に `C-3-remote: after の単位が当たっていない: C-1-ai`。C-3 は `applied: ok` にならない。終わったら作業ツリーを `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻す（途中まで当たった単位が残るため）。静的な代わりは `c3-unit.test.mjs` の「after の確かめ」（`planUnits` を直接呼ぶ）。

### 1d. 当てた後の作業ツリーの状態（入口の6。a の後、b の後に1回ずつ）

```
node tests/c3-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- `src/vs/workbench/contrib/remote`・`contrib/remoteTunnel`・`src/vs/platform/remoteTunnel`・`build/gulpfile.reh.ts` が無い
- 残る: `services/tunnel`、`services/remote`（`common/remoteExplorerService.ts` を含む）、`platform/remote`（`electron-browser/sharedProcessTunnelService.ts` を含む）、`platform/tunnel`、`api/browser/mainThreadTunnelService.ts`、`unit.json` の `kept` の全部（`remote/`・`src/vs/server` を含む）
- `viewsExtensionPoint.ts` に `const REMOTE = 'workbench.view.remote';` がちょうど1行ある。`contrib/remote/` を import していない
- `sharedProcessMain.ts` に `remoteTunnel` の語（大文字小文字を問わない）が無い
- `workbench.common.main.ts`・`workbench.desktop.main.ts`・`workbench.web.main.ts` に `contrib/remote`・`contrib/remoteTunnel`・`platform/remoteTunnel` の import が無い
- `product.json` に `productRemove` の9つのキーが無い
- `removeLines` の13行が各ファイルに残っていない

### 1e. ロックファイル（a の後、b の後に1回ずつ。C-3 は依存もパッチも消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c3-lock-a --lockfile-check --checks-out C:/b/logs/c3-gate/checks-lock-a.json
```

（b の後は `c3-lock-b`、`checks-lock-b.json`。`--lockfile-check` の記録は単位の欄が違う形のことがある。`checks.lockfile` の行だけ見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。`removedPatches` は `["foundry-local-sdk"]`（C-1 の分。a・b とも）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1f. 3-way に頼らずに当たること（入口の4。b の後）

b の C-3 の ops の commit を探して checkout し、パッチが文脈だけで当たるかを見る。

```
git -C C:/b/wt/p2 log --format="%H %s" -n 60
git -C C:/b/wt/p2 checkout <「unit C-3-remote: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-3-remote/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: 終了コードが 0。1ファイル（`viewsExtensionPoint.ts`）の1ハンクが、行のずれ（offset）も無く当たる。

## 2. 型検査（入口の3。組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c3-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c3-gate/typecheck-a.json --take-in-dir C:/b/logs/c3-gate/take-in-a
node tests/c3-check-json.mjs C:/b/logs/c3-gate/checks-a.json C:/b/logs/c3-gate/typecheck-a.json
```

（b は `c3-gate-b`、`typecheck-b.json`、`checks-b.json`。型検査は a の当て直しの上で a、b の当て直しの上で b を走らせる。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ（`c3-check-json.mjs` が照らす） |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

誤りが出たとき: 誤りの出るファイルが edits.patch の中の直しの漏れか、ほかの単位との重なりかを分けて、蒙恬に返す。

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service`）と、共有プロセスのチャンネルの外し損ねは、4節の起動の確かめで見る。build/ の台本（`gulpfile.vscode.ts` など）の型の誤り6件（`productRemove` から来る）は、判断済みで直さない（`docs/user-decisions.md` の 2026-11-15）。`typecheck-client` の外なので、この型検査の記録には出ない。パッケージ化で止まったら、蒙恬に返す。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c3-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c3-check-json.mjs --stopped <checks.json>
node tests/c3-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）、2 = 使い方の誤り。書き込みはしない。`c3-check-json.mjs` は単位の並びから組（a・b）を自動で見分け、組ごとの期待を使う。

## 4. 関門の起動の確かめ（入口の7。片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `absence`。

- `absence`: `checks` の `absentCommands`（`workbench.action.remote.showMenu`、`workbench.action.remote.close`、`remote.tunnel.forwardCommandPalette`、`workbench.remoteTunnel.actions.turnOn`）・`absentViews`（`workbench.view.remote`、`~remote.forwardedPorts`）・`absentSettings`（`remote.autoForwardPorts`、`remote.localPortHost`、`remote.extensionKind`、`remote.tunnels.access.preventSleep`）を見る。`absentProcesses`・`absentHosts` は空。
- 見た目の確認: ステータスバーの左端の「><」（リモートの状態表示）が無い。リモートエクスプローラー、「ポート」のビュー、「リモート トンネル アクセス」が無い。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`tunnelService`・`remoteExplorerService`・`remoteTunnelService`）が無い。共有プロセスのログに `remoteTunnel` のチャンネルの誤りが無い。
- Claude Code が壊れていない（docs/03 の9節。Webview が `services/tunnel` を注入する）:
  - Claude Code のパネル（Webview）が開く。ログインの外部 URI が開く（`vscode.env.asExternalUri`。ローカルの窓では URI がそのまま返る）。
  - Claude Code の差分とコメントが動く。拡張ホストのログに `vscode.workspace.openTunnel` などの誤りが出ない（API の実装は残っている）。
- ターミナルの `http://localhost:<port>` のリンクを開ける（`ITunnelService` を通る所。ローカルでは `canTunnel` が偽で何もしない）。
- 拡張が `viewsContainers`・`views` の `remote` に足すビューは、コンテナーが無いので警告（`ViewContainerDoesnotExist`）が出てエクスプローラーに置かれる。台帳の拡張にそのビューを足すものは無いが、拡張ホストのログに予期しない誤りが出ないこと。

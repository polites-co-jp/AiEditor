# C-2（デバッガ）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` に書き込むため）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c2-patch/handoff-notes.md`）の「テストの入口」と `removals/C-2-debug/unit.json` から写した。行数・sha は期待に含めない。

前提: `tests/c2-unit.test.mjs`（静的な検査と、何もしない実装の検査）、`tests/c2-mutation.test.mjs`、`tests/c2-check-json.test.mjs`、`tests/c2-worktree.test.mjs` が先に通っている（`node tests/run-all.mjs` の fail が 0）。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-2 の当て直しは**2つの組**で見る（docs/03 の4節の末尾: C-2 は C-1 を前提にしない。C-1 がある・ない、どちらでも当たること）。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、b を走らせる。

## 1. 当て直し（入口の1）

### 1a. 組 a: A・B の14単位と C-2（15単位。C-1 なし）

```
node scripts/apply.mjs C:/b/wt/p2 --label c2-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-2-debug --checks-out C:/b/logs/c2-gate/checks-a.json
node tests/c2-check-json.mjs C:/b/logs/c2-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1 と C-2（16単位。C-1 の後に C-2）

```
node scripts/apply.mjs C:/b/wt/p2 --label c2-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug --checks-out C:/b/logs/c2-gate/checks-b.json
node tests/c2-check-json.mjs C:/b/logs/c2-gate/checks-b.json
```

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c2-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 15。すべて `applied: ok` | 16。すべて `applied: ok`。順序は C-1 の後に C-2 |
| `units[id=C-2-debug].edits` | `applied: "ok"`、`subject: "unit C-2-debug: edits"`、`conflicts: []` | 同じ |
| `units[id=C-2-debug].ops` | `removeLines` が 27 行すべて `ok`（`found` = `count` = 1）。`deleted` の数 = `unit.json` の `delete` の数（`missingDeletes` は空） | `removeLines` は同じ。`missingDeletes` は `debugChatIntegration.ts` の1件（C-1 が先に消した）。`deleted` + `missingDeletes` = `delete` の数 |
| `units[id=C-2-debug].warnings` | 無し | `delete: src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ。想定済み（記録の最上位の `warnings` も同じ1件だけ） |
| `units[id=C-1-ai].edits`（b だけ） | — | `applied: "ok"`、`conflicts: []` |
| `checks.remnants.status` | `ok` | `ok` |
| `checks.absentStrings.status` | `ok`（C-2 の15項目すべて記録があり、`hitCount` が 0） | 同じ（C-1 の項目も 0） |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-2-debug: ops` → `unit C-2-debug: edits`。作者はどれも `shuko-apply <apply@shuko.invalid>` | 同じ。C-1 の edits が C-2 の ops より前 |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`。`git status` は使わない） | 同じ |

b の警告が1件より多い、a で警告が出る、C-2 の edits に衝突が出る、のどれかなら、C-1 との重なりが増えている。蒙恬に返す（docs/03 の5.3: 隣り合う行は `removeLines` に回す）。

### 1c. 当てた後の作業ツリーの状態（入口の5。a の後、b の後に1回ずつ）

```
node tests/c2-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- 新しいファイル `src/vs/workbench/api/common/extHostRemovedApi.debug.ts` がある（`createRemovedDebugApi` を export する）
- `extHost.protocol.ts` に `MainThreadDebugService`・`ExtHostDebugService`・`contrib/debug/common` が無い
- `extHost.api.impl.ts` が `createRemovedDebugApi(extension)` を呼び、`IExtHostDebugService` を使わない
- `debug.service.contribution.ts` に `NullDebugService` があり、`./debugService.js` が無い
- `workbench.common.main.ts` に `debug.service.contribution.js` の import がちょうど1行ある。消した Debug の6行（`debug.contribution.js` など）が無い
- `workbench.desktop.main.ts`・`workbench.web.main.ts` に `extensionHostDebugService.js` の import が残っている
- `notebook.contribution.ts` に `notebookVariablesView`・`notebookInlineValues` の登録が無い。`repl.contribution.ts` に `list.find.replInputFocus` が無い。`variablesActions.ts` が無い
- `build/next/resources.ts` に `debug/browser/media` が、`build/next/index.ts` に `debug/node/telemetryApp` が無い
- `unit.json` の `delete` が全部無く、`kept` が全部ある（`contrib/debug/common`、`platform/debug`、`extensionHostDebugService.ts` 2つ、`callStackWidget.ts` ほか）。`removeLines` の行が各ファイルに残っていない

b の後は、C-1 の照らし役も走らせる: `node tests/c1-check-worktree.mjs C:/b/wt/p2`（C-1 が壊れていないこと）。

### 1d. ロックファイル（入口の1の期待。a の後、b の後に1回ずつ。C-2 は依存を消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c2-lock-a --lockfile-check --checks-out C:/b/logs/c2-gate/checks-lock-a.json
node tests/c2-check-json.mjs C:/b/logs/c2-gate/checks-lock-a.json
```

（b の後は `c2-lock-b`、`checks-lock-b.json`。`--lockfile-check` の記録は組を見分けられない形のときがある。その場合の食い違いは単位の欠けとして出るので、`checks.lockfile` の行だけを見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。a は `removedPatches` が空、b は `["foundry-local-sdk"]`（C-1 の分。C-2 は何も足さない）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1e. 3-way に頼らずに当たること（入口の3。b の後）

b の C-2 の ops の commit を探して checkout し、パッチが文脈だけで当たるかを見る。

```
git -C C:/b/wt/p2 log --format="%H %s" -n 50
git -C C:/b/wt/p2 checkout <「unit C-2-debug: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-2-debug/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: `apply --check` の終了コードが 0。8ファイルの全ハンクが「Hunk #n succeeded at ... (offset ...)」だけで、`error`・`rejected` が無い。C-1 が隣の行を変える `extHost.protocol.ts`・`repl.contribution.ts` でも当たる（隣の行を `removeLines` に回したため）。これが落ちると、常設の clone に「C-1 の無い木の blob」が要る形に戻っている。

## 2. 型検査（入口の2。組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c2-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c2-gate/typecheck-a.json --take-in-dir C:/b/logs/c2-gate/take-in-a
node tests/c2-check-json.mjs C:/b/logs/c2-gate/checks-a.json C:/b/logs/c2-gate/typecheck-a.json
```

（b は `c2-gate-b`、`typecheck-b.json`、`checks-b.json`。型検査は a の当て直しの上で a、b の当て直しの上で b を走らせる。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ（`c2-check-json.mjs` が照らす） |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

誤りが出たとき: 誤りの出るファイルが edits.patch の中の直しの漏れか、C-1 との重なりか（a で出ず b だけで出るなら重なり）を分けて、蒙恬に返す。

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service debugService`）と、`Missing proxy instance` は、5節の起動の確かめで見る。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c2-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c2-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）、2 = 使い方の誤り。書き込みはしない。`c2-check-json.mjs` は単位の並びから組（a・b）を自動で見分け、組ごとの期待を使う。

## 4. 何もしない実装の「走らせる形」（VS Code のテストの仕組み。実行は大岡越前守、任意）

静的な検査と、型を外した本文を node で走らせる検査は `tests/c2-unit.test.mjs` にある（本家の型は使えない模擬の上）。本物の型・本物の `URI`・`Event` の上で走らせる形は、作業ツリーに次のテストを足して `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。足す場所は作業ツリー側なので、書くのは蒙恬か大岡越前守。ここに入口だけを書く。

`createRemovedDebugApi(ext)` を `src/vs/workbench/api/test/` の下のテスト（例 `extHostRemovedApi.debug.test.ts`）で作る。

- `startDebugging(undefined, 'x')` が `false` で resolve する
- `registerDebugConfigurationProvider('PowerShell', {})`・`registerDebugAdapterDescriptorFactory('PowerShell', {})` の返り値が `dispose` を持ち、呼んでも誤りにならない
- `onDidStartDebugSession(() => {})` が Disposable を返す。6つのイベントはどれも発火しない
- `activeDebugSession` が `undefined`、`breakpoints` が `[]`
- `activeDebugConsole.appendLine('x')` が誤りにならない
- `asDebugSourceUri({ path: 'C:\\a.ps1' })` が `file` の URI、`asDebugSourceUri({ path: 'a', sourceReference: 3 })` が scheme `debug`・path `a`・query `ref=3` の URI、`asDebugSourceUri({})` は誤りを投げる（本家と同じ文言）
- 提案を有効にしていない拡張で `registerDebugVisualizationProvider` を呼ぶと誤りを投げる（門が残っていること）。`enabledApiProposals: ['debugVisualization']` の拡張なら何もしない Disposable が返る
- `NullDebugService`・`NullDebugVisualizerService` が `debug.service.contribution.ts` で登録され、`IDebugService` を取るサービス（テスト・タスクなど）が起動時に解決できる（起動の確かめ 5 の `UNKNOWN service` が出ないこと）
- 直したノートブックの部品のテスト（未実行）: `notebook.contribution.ts` の設定の登録（`notebook.variablesView`・`notebook.inlineValues` が無い）、「すべての出力をクリア」（`editActions.ts`）が出力と実行の記録だけを消すこと

## 5. 関門のスモーク（入口の7。片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `powershell`, `languages`, `absence`。

- `absence`: `checks` の `absentCommands`（`workbench.action.debug.start`、`editor.debug.action.toggleBreakpoint`）・`absentViews`（`workbench.view.debug`）・`absentSettings`（`debug.console.fontSize`、`notebook.variablesView`、`notebook.inlineValues`）を見る。`absentProcesses`・`absentHosts` は空。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service debugService` と `Missing proxy instance` が無い。
- 見た目の確認: 「実行とデバッグ」のビューが無い。F5 でデバッグが始まらない。エディタの余白をクリックしてもブレークポイントが付かない。デバッグのツールバーが出ない。
- 残すものが壊れていない:
  - テストのビューで普通の実行ができ、失敗したテストの呼び出し履歴が表示される（`callStackWidget`）。「テストをデバッグ」は何も始まらない（`NullDebugService`）。
  - 拡張が1つも起動しない、にならない（`extensionHostDebugService` の注入が残っている。`localProcessExtensionHost.ts`）。Claude Code 拡張が起動し、拡張ホストのログに `vscode.debug` の誤りが出ない（docs/03 の9節。manifest に `debuggers`・`breakpoints`・`enabledApiProposals` が無い）。
  - ワークスペースの信頼の画面が出る（`debugColors.ts` を使う）。
- `powershell` の組: PowerShell 拡張（`ms-vscode.powershell`）が起動し、`.ps1` で補完と診断が出る。**拡張ホストのログの警告（`debuggers`・`breakpoints` の「知らない contributes」）を記録する**（出る・出ないの両方が正で、記録が目的）。「実行」「デバッグ」は始まらない（`startDebugging` が `false`）。言語サーバー（補完・診断・書式）は残る見込み（推定）。
- ノートブックを開いて「すべての出力をクリア」が誤りにならない（C-4 で消えるまでの間）。

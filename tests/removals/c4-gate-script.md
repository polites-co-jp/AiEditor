# C-4（ノートブック）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` に書き込むため）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c4-patch/handoff-notes.md`）の「テストの入口」と `removals/C-4-notebook/unit.json` から写した。行数・sha は期待に含めない。

前提: `tests/c4-unit.test.mjs`（静的な検査・何もしない実装の検査・検索の直しの検査。`after` の確かめを含む）、`tests/c4-mutation.test.mjs`、`tests/c4-check-json.test.mjs`、`tests/c4-worktree.test.mjs` が先に通っている（`node tests/run-all.mjs` の fail が 0）。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-4 の当て直しは**2つの組**で見る（C-4 は A-4・B-4・C-1・C-2 を前提にする。C-3 は前提にしないが、C-3 があっても当たること）。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、次を走らせる。

## 1. 当て直し（入口の1）

### 1a. 組 a: A・B の14単位と C-1・C-2・C-4（17単位。C-3 なし）

```
node scripts/apply.mjs C:/b/wt/p2 --label c4-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-4-notebook --checks-out C:/b/logs/c4-gate/checks-a.json
node tests/c4-check-json.mjs C:/b/logs/c4-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1・C-2・C-3・C-4（18単位。この順）

```
node scripts/apply.mjs C:/b/wt/p2 --label c4-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-3-remote,C-4-notebook --checks-out C:/b/logs/c4-gate/checks-b.json
node tests/c4-check-json.mjs C:/b/logs/c4-gate/checks-b.json
```

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c4-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 17。すべて `applied: ok` | 18。すべて `applied: ok`。順序は C-1、C-2、C-3、C-4 |
| `units[id=C-4-notebook].edits` | `applied: "ok"`、`subject: "unit C-4-notebook: edits"`、`conflicts: []` | 同じ |
| `units[id=C-4-notebook].ops` | `deleted` が `unit.json` の `delete` の数（35）と同じ。`missingDeletes` は `[]`。`removeLines` 22行がどれも `found: 1`・`count: 1`。`productRemoved`・`productMissing` は `[]` | 同じ |
| `units[id=C-4-notebook].warnings` | `[]` | `[]` |
| `units[id=C-1-ai]`・`C-2-debug`（b は `C-3-remote` も）の `edits` | `applied: "ok"`、`conflicts: []` | 同じ |
| `units[id=C-2-debug].warnings` | `delete: ...debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件（C-1 が先に消した。想定済み） | 同じ |
| 記録の最上位の `warnings` | 上の1件だけ | 同じ |
| `checks.remnants.status` | `ok` | `ok` |
| `checks.absentStrings.status` | `ok`（C-4 の16項目すべて記録があり、`hitCount` が 0） | 同じ |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-4-notebook: ops` → `unit C-4-notebook: edits`。C-1・C-2 の edits の後。作者はどれも `sukuna-apply <apply@sukuna.invalid>` | 同じ。C-3 の edits の後 |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`。`git status` は使わない） | 同じ |

C-4 の edits に衝突が出る、C-4 の `warnings` が出る、のどれかなら、ほかの単位との重なりが増えている。蒙恬に返す（docs/03 の5.3: `extHost.protocol.ts` の ID の行は `removeLines`、C-3 が直す `viewsExtensionPoint.ts` に C-4 は触れない）。

### 1c. 前提の単位を外すと止まること（入口の2。5.1 の `after` の確かめ）

`--only` から前提の単位を1つ外して走らせる。外す単位は `C-2-debug`、`C-1-ai`、`B-4-outline-view`、`A-4-notebook-extensions` の4つ。それぞれ、作業ツリーをタグに戻してから行う。まず `C-2-debug` を外す。

```
node scripts/apply.mjs C:/b/wt/p2 --label c4-gate-noc2 --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-4-notebook --checks-out C:/b/logs/c4-gate/checks-noc2.json
node tests/c4-check-json.mjs --stopped C:/b/logs/c4-gate/checks-noc2.json C-2-debug
```

期待: `result` が `ok` でない（`fail`）。`errors` に `C-4-notebook: after の単位 C-2-debug が先に当たらない（--only に入っていない）`、または `stoppedAt.message` に `C-4-notebook: after の単位が当たっていない: C-2-debug`。C-4 は `applied: ok` にならない。他の3つも同じ形で、`node tests/c4-check-json.mjs --stopped <checks.json> <外した単位>` が 0。終わったら作業ツリーを `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻す。静的な代わりは `c4-unit.test.mjs` の「after の確かめ」（`planUnits` を直接呼び、4つ全部を試す）。時間が無ければ、実走は `C-2-debug` を外す1回だけでよい。

### 1d. 当てた後の作業ツリーの状態（入口の6。a の後、b の後に1回ずつ）

```
node tests/c4-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- 無い: `contrib/notebook/browser`・`contrib/interactive`・`contrib/replNotebook`・`contrib/outline`・`contrib/search/browser/notebookSearch`・`contrib/search/common/notebookSearch.ts`・`api/browser/mainThreadNotebookDto.ts`（`unit.json` の `delete` の全部）
- ある: `contrib/notebook/common`・`services/notebook`・`contrib/search/common/searchNotebookHelpers.ts`・`api/common/extHostRemovedApi.notebook.ts`・`unit.json` の `kept` の全部
- `extHost.protocol.ts` に Notebook・Interactive の Shape の interface の宣言と `createProxyIdentifier<...Notebook` が無い。`NotebookCellDataDto` はある
- `extHost.api.impl.ts` に `extHostNotebook` の語が無く、`createRemovedNotebookApi` がちょうど2回ある
- `folderMatch.ts` が `FileMatchImpl` を `createInstance` し、`notebook` の語の import が無い
- `searchModel.ts`・`searchResult.ts`・`searchView.ts`・`replaceService.ts`・`bulkCellEdits.ts` に `@INotebook` が無い
- `search.contribution.ts` に `closedNotebookRichContentResults` が無い
- `removeLines` の22行が各ファイルに残っていない

### 1e. ロックファイル（a の後、b の後に1回ずつ。C-4 は依存もパッチも消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c4-lock-a --lockfile-check --checks-out C:/b/logs/c4-gate/checks-lock-a.json
```

（b の後は `c4-lock-b`、`checks-lock-b.json`。`--lockfile-check` の記録は単位の欄が違う形のことがある。`checks.lockfile` の行だけ見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。`removedPatches` は `["foundry-local-sdk"]`（C-1 の分）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1f. 3-way に頼らずに当たること（入口の4。a の後、b の後に1回ずつ）

C-4 の ops の commit を探して checkout し、パッチが文脈だけで当たるかを見る。

```
git -C C:/b/wt/p2 log --format="%H %s" -n 80
git -C C:/b/wt/p2 checkout <「unit C-4-notebook: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-4-notebook/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: 終了コードが 0。25ファイル（新規1）の全ハンクが当たり、行のずれ（offset）の表示も無い。

## 2. 型検査（入口の3。組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c4-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c4-gate/typecheck-a.json --take-in-dir C:/b/logs/c4-gate/take-in-a
node tests/c4-check-json.mjs C:/b/logs/c4-gate/checks-a.json C:/b/logs/c4-gate/typecheck-a.json
```

（b は `c4-gate-b`、`typecheck-b.json`、`checks-b.json`。型検査は a の当て直しの上で a、b の当て直しの上で b を走らせる。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ（`c4-check-json.mjs` が照らす） |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

誤りが出たとき: 誤りの出るファイルが edits.patch の中の直しの漏れか、ほかの単位との重なりかを分けて、蒙恬に返す。

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service`）と、`extHost.protocol.ts` のうち使われなくなった DTO（残してある。判断済み）は、5節の起動の確かめで見る。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c4-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c4-check-json.mjs --stopped <checks.json> [<外した単位の ID>]
node tests/c4-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）、2 = 使い方の誤り。書き込みはしない。`c4-check-json.mjs` は単位の並びから組（a・b）を自動で見分け、組ごとの期待を使う。

## 4. 何もしない実装と検索の「走らせる形」（VS Code のテストの仕組み。実行は大岡越前守、任意）

静的な検査と、型を外した本文を node で走らせる検査（`createRemovedNotebookApi` の振る舞い）、検索のハンクを本家に当てる検査は `tests/c4-unit.test.mjs` にある。本物の型・本物の `URI`・`Event` の上で走らせる形と、検索の単体テストは、作業ツリーで `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。作業ツリーに足すのは蒙恬か大岡越前守。ここに入口だけを書く。

- 検索の単体テスト（入口の8。型検査は通るが走らせていない）: `contrib/search/test/browser` の `searchModel.test.ts`・`searchResult.test.ts`・`searchViewlet.test.ts`・`searchActions.test.ts`。差し替えを消した `IEditorService`・`IEditorGroupsService`・`IContextKeyService` を、残るテストが要しないか
- `createRemovedNotebookApi(ext)`（`api/test` の下に新しいテストを足す場合）:
  - `workspace.notebookDocuments` が `[]`、`window.visibleNotebookEditors` が `[]`、`window.activeNotebookEditor` が `undefined`
  - イベント9つが Disposable を返す。発火しない
  - `workspace.registerNotebookSerializer('jupyter-notebook', {})`・`notebooks.registerNotebookCellStatusBarItemProvider('x', {})` の返り値が `dispose` を持つ
  - `workspace.openNotebookDocument(URI.file('a.ipynb'))`・`window.showNotebookDocument({})` が reject する
  - `notebooks.createNotebookController('id', 'type', 'label')` の `id`・`notebookType`・`label` が渡した値。`createNotebookCellExecution()` が誤りを投げる
  - `notebooks.createRendererMessaging('r').postMessage('m')` が `false` で resolve する
  - 提案を有効にしていない拡張で、`createNotebookControllerDetectionTask`・`registerKernelSourceActionProvider`、コントローラーの `postMessage`・`asWebviewUri`・`createNotebookExecution` を呼ぶと誤りを投げる（門が残っていること）
- `BulkCellEdits.apply()` がセルの編集を含む `workspace.applyEdit` で reject する（`bulkCellEdits.ts`）

## 5. 関門の起動の確かめ（入口の9。片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `powershell`, `absence`。

- `absence`: `checks` の `absentCommands`（`workbench.notebook.layout.select`、`repl.execute`、`notebook.cell.execute`）・`absentSettings`（`notebook.lineNumbers`、`notebook.formatOnSave.enabled`、`interactiveWindow.collapseCellInputCode`、`search.experimental.closedNotebookRichContentResults`）を見る。`absentViews`・`absentProcesses`・`absentHosts` は空。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`notebookService`・`notebookEditorService`・`notebookSearchService`・`notebookEditorModelResolverService`）が無い。
- 検索のビューが開き、テキスト検索・置換・すべて置換・検索エディタ（前後の行つき）が動く。`.ipynb` がテキストの一致として出る（JSON のテキスト）。開くとテキストのエディタで開く。検索の入力欄にノートブックの絞り込みのボタンが出ない。
- 「ノートブックを作成」などのコマンド、`notebook.*`・`interactiveWindow.*` の設定が無い。
- TypeScript・Markdown・PowerShell・basedpyright の拡張が起動し、拡張ホストのログにノートブックの API の誤りが無い。「知らない contributes」（`notebooks`・`notebookRenderer`）の警告の有無を記録する（出る・出ないの両方が正で、記録が目的）。
- Claude Code のパネル（Webview）が開き、差分とコメントが動く（docs/03 の9節。manifest に `notebook` の語は無い。コメントは `contrib/notebook/common` の型に頼る）。

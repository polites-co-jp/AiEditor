# C-7（パンくずリストとアウトライン）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` は大岡越前守が検証で使うので、触れていない）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c7-patch/handoff-notes.md`）、`removals/C-7-breadcrumbs-outline/unit.json`、本家 1.146.0 から写した。行数・sha は期待に含めない。記録は `trial/checks-verify-{a,b}.json`・`build-typecheck-verify-{a,b}.json` の形（`edits.patch` が10ファイル、`absentStrings` が11項目）。

docs/07 の8節: C-7 は関門を**2回続けて通らなければ諮る**（枠のファイルのパッチが毎週の取り込みで衝突しやすいため）。この台本は1回分。

前提: `tests/c7-unit.test.mjs`（静的な検査・注入の外し損ねの検査・枠の4ファイルだけに触れる検査。`after` の確かめを含む）、`tests/c7-mutation.test.mjs`、`tests/c7-check-json.test.mjs`、`tests/c7-worktree.test.mjs` が先に通っている。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

C-7 の当て直しは**2つの組**で見る。どちらも作業ツリーがタグ 1.146.0（`HEAD detached at 1.146.0`、きれい）から始める。a が終わったら、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻し（ロックファイルを変えたときは先に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml`）、次を走らせる。

## 1. 当て直し

### 1a. 組 a: A・B の14単位と C-1・C-2・C-4・C-7（18単位）

C-7 の前提は B-4・C-1・C-4 で、C-4 の前提に C-2 が入るので、最小の組は C-2 を含む。

```
node scripts/apply.mjs C:/b/wt/p2 --label c7-gate-a --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-4-notebook,C-7-breadcrumbs-outline --checks-out C:/b/logs/c7-gate/checks-a.json
node tests/c7-check-json.mjs C:/b/logs/c7-gate/checks-a.json
```

### 1b. 組 b: A・B の14単位と C-1〜C-7（21単位。この順）

```
node scripts/apply.mjs C:/b/wt/p2 --label c7-gate-b --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync,C-7-breadcrumbs-outline --checks-out C:/b/logs/c7-gate/checks-b.json
node tests/c7-check-json.mjs C:/b/logs/c7-gate/checks-b.json
```

期待（`checks-a.json`・`checks-b.json`）。照らす手順は上の `node tests/c7-check-json.mjs`（3節）。

| 項目 | a | b |
|---|---|---|
| `result` | `ok` | `ok` |
| 単位の数 | 18。すべて `applied: ok` | 21。すべて `applied: ok`。順序は C-1、C-2、C-3、C-4、C-5、C-6、C-7 |
| `units[id=C-7-breadcrumbs-outline].edits` | `applied: "ok"`、`subject: "unit C-7-breadcrumbs-outline: edits"`、`conflicts: []` | 同じ |
| `units[id=C-7-breadcrumbs-outline].ops` | `deleted` が `unit.json` の `delete` の数（10）と同じ。`missingDeletes` は `[]`。`removeLines` 2行がどれも `found: 1`・`count: 1`。`productRemoved`・`productMissing`・`removedDependencies` は `[]` | 同じ |
| `units[id=C-7-breadcrumbs-outline].warnings` | `[]` | `[]` |
| `units` の C-1・C-2・C-4（b は C-3・C-5・C-6 も）の `edits` | `applied: "ok"`、`conflicts: []` | 同じ |
| 記録の最上位の `warnings` | C-2 の `delete: ...debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ。想定済み | 同じ |
| `checks.remnants.status`・`checks.absentStrings.status` | `ok`（C-7 の11項目すべて記録があり、`hitCount` が 0。注入の外し損ねを守る `@IOutlineService`・`notifyOutlineChanged`・`showBreadcrumbs`・`BreadcrumbsControlFactory` を含む） | 同じ |
| `checks.commitIdentity.status`・`checks.registeredKeys.status` | `ok` | `ok` |
| `commits` | `unit C-7-breadcrumbs-outline: ops` → `unit C-7-breadcrumbs-outline: edits`。前提の単位の edits の後。作者はどれも `shuko-apply <apply@shuko.invalid>` | 同じ |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries`） | 同じ |

C-7 の edits に衝突が出る、C-7 の `warnings` が出る、のどれかなら、枠のファイル（`editorHeaderControl.ts` など4つ）か、C-1 の edits.patch と重なる3ファイルで、ほかの単位との重なりが増えている。蒙恬に返す（docs/03 の5.3）。

### 1c. 前提の単位を外すと止まること（5.1 の `after` の確かめ）

`--only` から `C-1-ai` を外して走らせる（`B-4-outline-view`・`C-4-notebook` を外しても同じ）。作業ツリーをタグに戻してから行う。

```
node scripts/apply.mjs C:/b/wt/p2 --label c7-gate-noc1 --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-7-breadcrumbs-outline --checks-out C:/b/logs/c7-gate/checks-noc1.json
node tests/c7-check-json.mjs --stopped C:/b/logs/c7-gate/checks-noc1.json C-1-ai
```

外した単位の ID（`C-1-ai`・`B-4-outline-view`・`C-4-notebook`）を最後に渡すと、その単位が理由の誤りを見る（渡さなければ、3つのどれかの理由を見る）。B-4 を外す組は、`--only` から `B-4-outline-view` を除く。C-4 を外す組は `C-4-notebook` を除く（C-7 の誤りは `after の単位 C-4-notebook が先に当たらない`）。

期待: `result` が `ok` でない（`fail`）。`errors` に `C-7-breadcrumbs-outline: after の単位 C-1-ai が先に当たらない（--only に入っていない）`、または `stoppedAt.message` に `C-7-breadcrumbs-outline: after の単位が当たっていない: ...C-1-ai`。C-7 は `applied: ok` にならない。終わったら作業ツリーをタグに戻す。静的な代わりは `c7-unit.test.mjs` の「after の確かめ」（`planUnits` を直接呼ぶ）。

### 1d. 当てた後の作業ツリーの状態（a の後、b の後に1回ずつ）

```
node tests/c7-check-worktree.mjs C:/b/wt/p2
```

0 = 期待どおり。見ること:

- 無い: `unit.json` の `delete` の10（`browser/parts/editor/breadcrumbs.ts`・`breadcrumbsControl.ts`・`breadcrumbsModel.ts`・`breadcrumbsPicker.ts`・`media/breadcrumbscontrol.css`、`services/outline`、`contrib/codeEditor/browser/outline`、テスト3つ）
- ある（残す）: `base/browser/ui/breadcrumbs`、`editor/contrib/documentSymbols`、`editor/contrib/diffEditorBreadcrumbs`（差分エディタの「変更の無い部分」。Claude Code の差分エディタ）、`defaultStyles.ts`、タブの枠のファイル（`editorGroupView.ts`・`multiEditorTabsControl.ts`・`editorTabsControl.ts`・タブの CSS）
- **型検査に掛からない注入の外し損ね（src/vs の全体を走査する）**: `@IOutlineService`・`@IBreadcrumbsService` の注入がどこにも無い。`IOutlineService`・`IBreadcrumbsService` の語がコードに無い（コメントと試験用の資料 `*.perf-data.ts` を除く）。`BreadcrumbsControlFactory`・`notifyOutlineChanged`・`showBreadcrumbs` が 0 件。消した部品への import が無い。`registerOutlineCreator` を呼ぶ所が無い
- **エディタの枠**: `editorHeaderControl.ts` に `breadcrumbs` の語が無い。`editorTitleControl.ts` に `handleEditorsChange` が無い。`singleEditorTabsControl.ts` に `breadcrumbsControl` の語が無く、`breadcrumbsInHeader` は残る。`auxiliaryEditorPart.ts`・`common/editor.ts` に `showBreadcrumbs` が無い
- **記号へ移動（Ctrl+Shift+O）は残る**: `gotoSymbolQuickAccess.ts` に `provideWithoutTextEditor`・`installNavigablePicks`・`IOutlineService` が無く、`getSymbolPicks`・`workbench.action.gotoSymbol` の登録・`IOutlineModelService` は残る
- カスタムエディタの記号の移動は残る: `mainThreadCustomEditors.ts` に `input.navigation = navigation` があり、`IOutlineService`・`notifyOutlineChanged` が無い
- `workbench.common.main.ts` に消した部品の import が無い。`removeLines` の2行が残っていない

### 1e. ロックファイル（a の後、b の後に1回ずつ。C-7 は依存もパッチも消さない）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c7-lock-a --lockfile-check --checks-out C:/b/logs/c7-gate/checks-lock-a.json
```

（b の後は `c7-lock-b`、`checks-lock-b.json`。`checks.lockfile` の行だけ見る。）

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空。`removedPatches` は `["foundry-local-sdk"]`（C-1 の分）。検査の後、`git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。

### 1f. 3-way に頼らずに当たること（a の後、b の後に1回ずつ）

```
git -C C:/b/wt/p2 log --format="%H %s" -n 80
git -C C:/b/wt/p2 checkout <「unit C-7-breadcrumbs-outline: ops」の sha>
git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-7-breadcrumbs-outline/edits.patch
git -C C:/b/wt/p2 checkout 1.146.0
```

期待: 終了コードが 0。10ファイルの全ハンクが当たり、行のずれ（offset）の表示も無い。

## 2. 型検査（組 a・組 b それぞれの上で）

```
node scripts/build.mjs 1.146.0 --label c7-gate-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c7-gate/typecheck-a.json --take-in-dir C:/b/logs/c7-gate/take-in-a
node tests/c7-check-json.mjs C:/b/logs/c7-gate/checks-a.json C:/b/logs/c7-gate/typecheck-a.json
```

（b は `c7-gate-b`、`typecheck-b.json`、`checks-b.json`。）

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks-*.json` の `headCommit` と同じ |
| `sourceVersion.uncommittedEntries` | 0 |
| `sourceVersion.error` | `null` |

型検査で見えないもの: 起動時の注入（DI）の外し損ね（`depends on UNKNOWN service`）と、タブの高さ・帯の見た目。1d の全体の走査と、5節の起動で見る。

## 3. 期待を照らす補助（読むだけ）

```
node tests/c7-check-json.mjs <checks.json> [<typecheck.json>]
node tests/c7-check-json.mjs --stopped <checks.json>
node tests/c7-check-worktree.mjs <作業ツリー>
```

終了コード 0 = 期待どおり、1 = 食い違いあり、2 = 使い方の誤り。書き込みはしない。組（a・b）は単位の並びから自動で見分ける（C-3 の有無）。

## 4. 単体テスト（VS Code のテストの仕組み。実行は大岡越前守、任意）

作業ツリーで `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。入口だけを書く。

- `test/browser/parts/editor/editorHeaderControl.test.ts`（変えていない）: 7つの試験がそのまま通る。期待の高さ（`DEFAULT_HEIGHT`・`COMPACT_HEIGHT`・0）は変わらない
- `api/test/browser/mainThreadCustomEditors.test.ts`: 記号の移動の4つの試験が、`outlineChanges` の確かめを外した形で通る
- `contrib/search/test/browser/anythingQuickAccess.test.ts`: `IOutlineService` の差し替えが無くても通る
- `test/browser/componentFixtures/editor/tabs.fixture.ts`: 見本が描ける（見た目の基準の画像があれば、`ScrollbarPlacement` の Legacy の帯が変わりうる）

## 5. 関門の起動の確かめ（片づけの許可の後。ビルドして起動してから）

`smoke`: `base`, `claude-code`, `absence`。

- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`outlineService`・`breadcrumbsService`）が無い
- **エディタの枠が崩れていない（最重要。docs/03 の9節）**:
  - タブが複数・1枚（`workbench.editor.showTabs: single`）・無し（`none`）のそれぞれで、タブの高さとエディタの本体の位置が C-7 の前（`breadcrumbs.enabled: false`）と同じ。空の帯が無い
  - エディタの分割（右・下）、タブのドラッグでの並べ替えと別グループへの移動、補助ウィンドウ（エディタを別ウィンドウに出す）が動く
  - 1枚のタブでファイルの説明（パス）が出る条件が、パンくずが無効だったときと同じ
  - 差分エディタ（`git diff` や 2つのファイルの比較）が開き、変更の無い部分の折りたたみとそのパンくず（`diffEditorBreadcrumbs`）が動く
- **Claude Code**: パネル（Webview）が開く。差分の表示・受け入れ・却下（コメント）が動く。エディタ右上の `editor/title` のボタンが出る
- Ctrl+Shift+O がテキストエディタと差分エディタで記号の一覧を出す（`getSymbolPicks`）。ノートブックやカスタムエディタでは一覧が出なくてよい
- コマンドパレットに `absentCommands` の4つ（`breadcrumbs.toggle`・`breadcrumbs.focusAndSelect`・`breadcrumbs.focus`・`breadcrumbs.copyPath`）が出ない。設定の画面に `breadcrumbs.*`（`enabled`・`filePath`・`symbolPath`）が出ない
- アウトラインのビューは B-4 で既に無い。ステータスバー・タイトルバーにパンくずの名残が無い
- 通信の監査（`scripts/netaudit.ps1`）で新しい接続先が無い（C-7 は通信と無関係のはず）

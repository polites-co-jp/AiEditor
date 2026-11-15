# C-7 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。始めの状態は `HEAD detached at 1.146.0`、作業ツリーはきれいだった。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c7-ops） | 08:10 | `307dedcf` | — | fail（想定どおり。下） | — |
| 1 | c7tc-1 | 08:11 | `307dedcf` | 0 | error | 11 |
| 2 | c7tc-2 | 08:17 | 同上 | 10 | error | 13 |
| 3 | c7tc-3 | 08:18 | 同上 | 10 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c7tc-verify-a | 08:20 | `b1b998f7` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c7tc-verify-b | 08:23 | `6d278893` | 0 | **ok** / **ok** | 0 |

- 適用1は、A・B の14単位と C-1・C-2・C-4・C-7 の ops（`unit.json` は下準備のまま）を、タグから `apply.mjs --only` で当てたもの。18単位すべてが `applied: ok`。
  - C-7 の ops は `7cca76ea`。`delete` の10はどれも消え（`missingDeletes: []`）、`removeLines` の2行はどれも `found: 1`。C-7 に警告は無い。
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ。
  - 結果が fail なのは `absentStrings` の C-7 の4項目（`/breadcrumbsControl.js'` 2件、`parts/editor/breadcrumbs.js'` 1件、`services/outline/browser/outline.js'` 5件）。edits.patch で直す前の残りで、README の「型検査で直す点」の見込みどおり。`remnants` は `ok`。
- 1回目の11件
  - TS2307（消したファイルの import）7件: `mainThreadCustomEditors.ts`・そのテスト・`editorHeaderControl.ts`・`singleEditorTabsControl.ts`・`gotoSymbolQuickAccess.ts`・`anythingQuickAccess.test.ts`・`tabs.fixture.ts`（2件）
  - TS7006（型が分からなくなった引数）3件: `gotoSymbolQuickAccess.ts` の `outline`・`err`・`element`
  - どれも README の表の範囲。表に挙げた sessions のテスト2つ（`emptyStates.fixture.ts`・`layoutActions.test.ts`）とチャット・ノートブックの使い手は、C-1・C-4 で消えていて出なかった。
- 直しの1回目で、表のファイルに加えて次を直した（型検査には出ない。`Grep` で見つけた）。
  - `editorTitleControl.ts`: `headerControl.handleEditorsChange` の3か所（`EditorHeaderControl` からパンくずの更新の入口を消したため）
  - `auxiliaryEditorPart.ts`・`common/editor.ts`: `showBreadcrumbs`（読み手は消した `breadcrumbsControl.ts` だけ）
- 2回目の13件は、どれも使われなくなった import（TS6133・TS6192）。`gotoSymbolQuickAccess.ts` が10件（`IQuickPick`・`IDisposable`・`toDisposable`・`Disposable`・`MutableDisposable`・`CancellationTokenSource`・`SymbolKind`・`fuzzyScore`・`onUnexpectedError`、`iconLabels.js` の行）、`tabs.fixture.ts` が3件（`IWorkspaceContextService`・`testWorkspace`・`TestContextService`）。
- 3回目で誤り 0。
- commit と書き出し
  1. 直しを commit `a64bc779`（作者は `shuko-apply`）にした。10ファイル。
  2. C-7 の ops の commit（`7cca76ea`）を checkout した。後の commit（patches の2つ、assets、builtin）は10ファイルに触れない（`git diff --stat 7cca76ea a64bc779~1 -- <10ファイルの場所>` は assets の `letterpress-*.svg` 4つだけ）。
  3. 10ファイルを `git -C C:/b/wt/p2 checkout a64bc779 -- <10ファイル>` で取り出した。
  4. `unit C-7-breadcrumbs-outline: edits` の commit（`1547dc3e`、`--author=shuko-apply`）にした。
  5. `git -C C:/b/wt/p2 format-patch -1 1547dc3e --output=<ビルドリポジトリ>/removals/C-7-breadcrumbs-outline/edits.patch` で書き出した。10ファイル、13行の追加、323行の削除、42ハンク、738行。
  6. `unit.json` に `"patch": "edits.patch"` を足し、`checks.absentStrings` に4つを足した。`delete`・`removeLines`・`after`・`kept` は変えていない。

### build/ の側の型検査

C-7 の ops と edits.patch は `build/` に触れないので、走らせていない。`build/` に、消したファイルの名前は無い（`Grep`）。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-1・C-2・C-4・C-7（18単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c7-verify-a --only <A・B の14単位>,C-1-ai,C-2-debug,C-4-notebook,C-7-breadcrumbs-outline --checks-out tasks/2026-11-15-p5-c7-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c7tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c7-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c7-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c7-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c7-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c7-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。18単位すべてが `applied: ok`。
  - C-7 の ops は `84b6e33e`。`missingDeletes: []`、`removeLines` の2行はどれも `found: 1`
  - edits は `954def27`（`unit C-7-breadcrumbs-outline: edits`、`conflicts: []`）。C-7 の warnings は `[]`
  - 警告は C-2 の想定どおりの1件だけ
- 検査の `remnants`・`absentStrings`（足した4つを含む C-7 の11項目）は `ok`。`hitCount` が 1 以上の項目は無い。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c7tc-verify-a\typecheck.log`）。HEAD `b1b998f7307ee2785495d17f2d422b14111454a3`、未コミット 0。
- ロックファイル: `ok`。検査の後に戻した（`git -C C:/b/wt/p2 status` が空）。C-7 は依存を消さない。
- C-7 の ops の commit（`84b6e33e`）を checkout して、`git -C C:/b/wt/p2 apply --check -v removals/C-7-breadcrumbs-outline/edits.patch` が10ファイルとも当たった（行のずれの表示も無い）。

### b. A・B の14単位と C-1〜C-7（21単位。段階 C のすべて）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c7-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync,C-7-breadcrumbs-outline --checks-out tasks/2026-11-15-p5-c7-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c7tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c7-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c7-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c7-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c7-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c7-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。21単位すべてが `applied: ok`、`unitsSkipped: []`。
  - edits の commit: C-1-ai `dc073035`、C-2-debug `9383cd35`、C-3-remote `3f466578`、C-4-notebook `38e991b0`、C-5-extension-gallery `19fc3744`、C-6-settings-sync `564d98f8`、C-7-breadcrumbs-outline `3b7298ed`。どれも `conflicts: []`
  - C-7 の ops は `3edbaa94`。`removeLines` の2行はどれも `found: 1`
- 警告は C-2 の想定どおりの1件だけ（`debugChatIntegration.ts`）。C-7 には警告が無い。
- 検査の `remnants`・`absentStrings` は `ok`（`hitCount` が 1 以上の項目も、`status: fail` も無い）。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c7tc-verify-b\typecheck.log`）。HEAD `6d2788933d8bc40b6824728bc74dd329e432a35a`、未コミット 0。
- **ほかの単位と文脈が重ならないこと（docs/03 の5.3）**
  - edits.patch が触る10ファイルのうち、ほかの単位の edits.patch が触るのは3つ（`gotoSymbolQuickAccess.ts`・`anythingQuickAccess.test.ts`・`tabs.fixture.ts`）で、どれも C-1 の edits.patch（`removals/**/*.patch`・`patches/*.patch` の `diff --git` の行を `Grep`）。C-1 は C-7 の `after` にあるので、C-7 はいつも C-1 の後の形に当たる。`gotoSymbolQuickAccess.ts` の C-7 のハンクの前後の行には、C-1 が足したコメント（`// Shuko (C-1-ai): ...`）が入る。
  - C-2・C-3・C-5・C-6 の edits.patch と `patches/` は、10ファイルに触れない。
  - ops（`delete`・`removeLines`）で10ファイルに触れるのは、B-2 の `tabs.fixture.ts` の `removeLines` 1行（`gettingStarted.css` の import）だけ。B-2 は a・b のどちらにも入る（C-1 の `after` の連なりの中）。
  - b の C-7 の ops の commit（`3edbaa94`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-7-breadcrumbs-outline/edits.patch` を走らせた。10ファイルの全ハンクが、行のずれの表示も無く当たった。3-way の基底を探さずに当たる。
  - `removeLines` に回すものは無い。
- 注入の照らし（この木の `6d278893` で `Grep`）: `IOutlineService`・`IBreadcrumbsService`・`BreadcrumbsControl`・`BreadcrumbsConfig`・`OutlineTarget`・`IOutlineCreator`・`notifyOutlineChanged`・`showBreadcrumbs` は、`gotoSymbolQuickAccess.ts` のコメントの1行とテストの性能の資料を除いて 0 件。`breadcrumbsInHeader` は枠の4ファイルの引数の名前として残る（README の「残すもの」）。
- ロックファイル: `ok`。差分は前の単位（B-1・C-1 など）が消した依存だけ。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（08:09 UTC） | 18.82 GB（20,209,930,240 バイト） | `disk-start.json` |
| 終わり（08:24 UTC） | 18.60 GB（19,972,022,272 バイト） | `disk-end.json` |

- 減ったのは約 238 MB（git の commit とログの分と見込む）。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.8 GB（95,755ファイル）、b の後で 3.79 GB（95,691ファイル）。`build-typecheck-verify-*.json` の `disk.worktree`。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は前からあるもので、今回は作っていない。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない。`1.146.0` は `Grep` と Read で読んだだけ（`breadcrumbsControl.ts`・`breadcrumbs.ts`・`customEditorInput.ts`・`editorBrowser.ts`、`showHeader`・`registerOutlineCreator` などの検索）。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

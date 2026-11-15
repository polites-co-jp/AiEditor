# C-4 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数（`Grep` で数えた）。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c4-ops） | 02:51 | `3c423f6d` | — | `fail`（absentStrings 7件） | — |
| 1 | c4tc-1 | 02:52 | `3c423f6d` | 0 | error | 82 |
| 2 | c4tc-2 | 03:03 | 同上 | 18 | error | 21 |
| 3 | c4tc-3 | 03:07 | 同上 | 24 | error | 4 |
| 4 | c4tc-4 | 03:10 | 同上 | 25 | error | 1 |
| 適用2 | `trial/checks-ops2.json`（c4-ops2） | 03:11 | `303325b8` | — | `fail`（absentStrings。edits.patch の前なので想定どおり） | — |
| 5 | c4tc-5 | 03:12 | `303325b8` | 25 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c4tc-verify-a | 03:15 | `7db4c1bf` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c4tc-verify-b | 03:17 | `ab6bd301` | 0 | **ok** / **ok** | 0 |

- 適用1は、A・B の14単位と C-1・C-2 と C-4 の ops（`unit.json` は下準備のまま）を、タグから `apply.mjs --only` で当てたもの。17単位すべてが `applied: ok`。警告は C-2 の想定どおりの1件（`debugChatIntegration.ts` が本家に無い）だけ。`remnants` は `ok`。absentStrings の7件は、どれも edits.patch で直すファイル（検索・一括編集・`mainThreadEditorTabs.ts`・`extHost.api.impl.ts`）の import だった。
- 1回目の82件の内訳
  - `extHost.api.impl.ts` の19件（import 7件、`languages.match` の2件、`window`・`workspace` の名前空間の型の10件）
  - `mainThreadEditorTabs.ts` の3件（`InteractiveEditorInput`）
  - `bulkCellEdits.ts` の1件
  - 検索の browser の32件（`folderMatch.ts` 13、`searchView.ts` 4、`searchResult.ts` 4 など、12ファイル。`searchModel.ts` は注入の ID が common に残っていたので型の誤りにならなかった）
  - 検索のテストの20件（5ファイル）
  - `searchEditorSerialization.ts` の7件
  - README の「型検査で直す点」の見込みの範囲だった。`AISearch/aiSearchModel.ts` は C-1 が消すので出なかった。
- 2回目の21件: 検索のテスト5ファイルの import（20件）と、`searchView.ts` の使われなくなった `network` の import（1件）。
- 3回目の4件
  - `extHost.protocol.ts` の使われなくなった import 2件（`NotebookPriorityInfo`・`IRawClosedNotebookFileMatch`。Shape を消した結果）
  - `searchModel.test.ts` の使われなくなった `arrays` の import 1件
  - `bulkCellEdits.test.ts` の1件（`BulkCellEdits` の引数の数）
- 4回目の1件は `bulkCellEdits.test.ts`（`delete` に足すファイル。`rm` が許可に無いので、`unit.json` に足して当て直すまで残した）。
- 4回目の後
  1. 直しを仮の commit `6a3e322c`（作者は `shuko-apply`）にした。
  2. `unit.json` に `delete` 4つと `removeLines` 13行を足した。
  3. タグから当て直した（適用2）。この版の `unit.json` には `"patch"` をまだ書いていない（書くと edits.patch が無くて止まる）。
  4. 25ファイルを `git -C C:/b/wt/p2 checkout 6a3e322c -- <25ファイル>` で戻した。
- 5回目で誤り 0。
- commit と書き出し
  1. C-4 の ops の commit（`7ad7cbcb`）を checkout した。
  2. `unit C-4-notebook: edits` の commit（`de356cae`、`--author=shuko-apply`）にした。
  3. `git -C C:/b/wt/p2 format-patch -1 de356cae --output=<ビルドリポジトリ>/removals/C-4-notebook/edits.patch` で書き出した。
  4. `unit.json` に `"patch": "edits.patch"` を足した。
- 確かめ a の最初の1回は、absentStrings の `NotebookCompatibleFileMatch` が、edits.patch の `fileMatch.ts` の注釈（`// Shuko (C-4-notebook): the removed NotebookCompatibleFileMatch ...`）に1件当たって `fail` になった。import は別の項目（`/notebookSearch/notebookSearchModel.js'`）が見るので、この項目を `unit.json` から外し、タグから当て直した（表の確かめ a はこの2回目）。

### build/ の側の型検査

`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`（確かめ a の木）は1件だった。`build/gulpfile.vscode.ts`（139）の `never` で、A-3 の `builtInExtensions: []` から来る前からの1件。C-4 は `build/` に触れない。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-1・C-2・C-4（17単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c4-verify-a --only <A・B の14単位>,C-1-ai,C-2-debug,C-4-notebook --checks-out tasks/2026-11-15-p5-c4-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c4tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c4-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c4-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c4-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c4-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c4-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。17単位すべてが `applied: ok`。
  - C-4-notebook の ops は `5abf41f7`。`removeLines` の22行はどれも `found: 1`
  - edits は `1d12a6c8`（`unit C-4-notebook: edits`、`conflicts: []`）
  - 警告は C-2 の想定どおりの1件だけ。C-4 には警告が無い
- 検査の `remnants`・`absentStrings`（足した4つを含む）は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c4tc-verify-a\typecheck.log`）。HEAD `7db4c1bf85bbc541e18061455e735a3bd13c1e13`、未コミット 0。
- ロックファイル: `ok`。
  - ルートの `pnpm-lock.yaml`: `changedSections: []`、`unexpectedRemovedDeps: []`、`changedDeps: []`、`addedPackages: []`、`unexpectedPatchChanges: []`、`removedPatches: ["foundry-local-sdk"]`
  - 差分の削除の行は 11,695、追加の行は 0。C-3 の記録と同じ数。C-4 は依存を消さないので、C-1 の分だけ
  - 検査の後に戻した

### b. A・B の14単位と C-1・C-2・C-3・C-4（18単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c4-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook --checks-out tasks/2026-11-15-p5-c4-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c4tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c4-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c4-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c4-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c4-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c4-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。18単位すべてが `applied: ok`。
  - edits の commit: C-1-ai `12297389`、C-2-debug `3e46b702`、C-3-remote `30f406e3`、C-4-notebook `269e6973`。どれも `conflicts: []`
  - C-4-notebook の ops は `96ed4622`
- 警告は C-2 の想定どおりの1件だけ（`debugChatIntegration.ts`）。
- 検査の `remnants`・`absentStrings` は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c4tc-verify-b\typecheck.log`）。HEAD `ab6bd3018c4dcbf9ca45c641c8317907d1a6fd5c`、未コミット 0。
- **C-3 と文脈が重ならないこと（docs/03 の5.3）**
  - C-3 の edits.patch が触るのは `viewsExtensionPoint.ts` だけで、C-4 の edits.patch はこのファイルに触れない。
  - C-3 の ops が消すもの（`contrib/remote`・`contrib/remoteTunnel` など）と `removeLines` の行（main のファイルと `sharedProcessMain.ts`）も、C-4 の edits.patch の文脈に無い。
  - b の C-4 の ops の commit（`96ed4622`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-4-notebook/edits.patch` を走らせた。25ファイルの全ハンクが、行のずれ（offset）の表示も無く当たった。3-way の基底を探さずに当たる。
  - `removeLines` に回すものは無い。
- ロックファイル: `ok`。ルートの値は a と同じ。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（02:51 UTC） | 19.11 GB（20,518,830,080 バイト） | `disk-start.json` |
| 終わり（03:18 UTC） | 18.79 GB（20,180,684,800 バイト） | `disk-end.json` |

- 減ったのは約 0.32 GB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.8 GB（95,769ファイル）、b の後で 3.8 GB（95,732ファイル）。`build-typecheck-verify-*.json` の `disk.worktree`。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は前からあるもので、今回は作っていない。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない。`1.146.0` は読んだだけ（`notebookSearchModel.ts`・`notebookSearchContributions.ts`・`extHostNotebookKernels.ts` など）。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

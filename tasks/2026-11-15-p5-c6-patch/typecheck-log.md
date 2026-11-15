# C-6 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。始めの状態は `HEAD detached at 1.146.0`、作業ツリーはきれいだった。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c6-ops） | 04:42 | `70fad93f` | — | **ok** | — |
| 1 | c6tc-1 | 04:42 | `70fad93f` | 0 | **ok** | 0 |
| 2 | c6tc-2 | 04:46 | 同上 | 5 | error | 8 |
| 3 | c6tc-3 | 04:47 | 同上 | 5 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c6tc-verify-a | 04:50 | `1d553956` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c6tc-verify-b | 04:52 | `81a449ef` | 0 | **ok** / **ok** | 0 |

- 適用1は、A・B の14単位と C-1 と C-6 の ops（`unit.json` は下準備のまま）を、タグから `apply.mjs --only` で当てたもの。16単位すべてが `applied: ok`。C-6 の ops は `4d9785da`、`delete` の2つはどちらも消え（`missingDeletes: []`）、`removeLines` の3行はどれも `found: 1`。警告は無い。`remnants`・`absentStrings`（下準備の4つ）は `ok`。
- 1回目は誤り 0。README の見込みどおり、`contrib/userDataSync` と `userDataSyncWorkbenchService.ts` を import していたのは main の入口（`removeLines` の3行）と sessions の入口（C-1 が消す）だけだった。`IUserDataSyncWorkbenchService` の ID は残る `common/userDataSync.ts` にあるので、注入している2か所（`settingsEditor2.ts`・`relauncher.contribution.ts`）も型は通る。**型検査では何も見つからない単位**なので、直しは `Grep` の照らし（`handoff-notes.md` の「注入の照らし」）から作った。
- 2回目の8件は、どれも `settingsEditor2.ts` の使われなくなった import（`SyncControls` と注入を消した結果）。`Button`・`CodeWindow`・`fromNow`・`Emitter`・`Disposable`・`ICommandService`・`defaultButtonStyles` の7件と、`platform/userDataSync` の行（`IUserDataSyncEnablementService`・`IUserDataSyncService`・`SyncStatus`。TS6192）の1件。
- 3回目で誤り 0。
- commit と書き出し
  1. 直しを commit `0e163270`（作者は `shuko-apply`）にした。5ファイル。
  2. C-6 の ops の commit（`4d9785da`）を checkout した。後の commit（patches の2つ、assets、builtin）は5ファイルに触れない（`git diff --stat 4d9785da HEAD -- src/vs/workbench/contrib/preferences src/vs/workbench/contrib/relauncher` が空）。
  3. 5ファイルを `git -C C:/b/wt/p2 checkout 0e163270 -- src/vs/workbench/contrib/preferences src/vs/workbench/contrib/relauncher` で取り出した。
  4. `unit C-6-settings-sync: edits` の commit（`401af452`、`--author=shuko-apply`）にした。
  5. `git -C C:/b/wt/p2 format-patch -1 401af452 --output=<ビルドリポジトリ>/removals/C-6-settings-sync/edits.patch` で書き出した。5ファイル、4行の追加、115行の削除。
  6. `unit.json` に `"patch": "edits.patch"` を足し、`checks`（absentCommands を2つに、absentViews を空に、absentStrings に5つ）と `kept` の3つの理由を直した。`delete`・`removeLines` は変えていない。

### build/ の側の型検査

C-6 の ops と edits.patch は `build/` に触れないので、走らせていない。`build/lib/i18n.resources.json` に `vs/workbench/contrib/userDataSync` の名前が残る（訳の書き出し用。B-2・C-3・C-4 と同じ扱いで直さない）。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-1・C-6（16単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c6-verify-a --only <A・B の14単位>,C-1-ai,C-6-settings-sync --checks-out tasks/2026-11-15-p5-c6-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c6tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c6-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c6-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c6-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c6-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c6-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。16単位すべてが `applied: ok`。
  - C-6 の ops は `202003f2`。`missingDeletes: []`、`removeLines` の3行はどれも `found: 1`
  - edits は `c4aea971`（`unit C-6-settings-sync: edits`、`conflicts: []`）
  - 警告は無い（C-2 を当てないので、C-2 の想定の1件も出ない）
- 検査の `remnants`・`absentStrings`（足した5つを含む9つ。どれも `hitCount: 0`）は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c6tc-verify-a\typecheck.log`）。HEAD `1d553956a4004e4fb3b6647b0c44b294866ce755`、未コミット 0。
- ロックファイル: `ok`。`build/`・`extensions/` は変わらず、`extensions/copilot/` は A-1 が消したフォルダの中。ルートの差分は前の単位（B-1・C-1）が消した依存だけ。C-6 は依存を消さない。検査の後に戻した。
- C-6 の ops の commit（`202003f2`）を checkout して、`git -C C:/b/wt/p2 apply --check -v removals/C-6-settings-sync/edits.patch` が5ファイルとも当たった（行のずれの表示も無い）。

### b. A・B の14単位と C-1〜C-6（20単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c6-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync --checks-out tasks/2026-11-15-p5-c6-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c6tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c6-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c6-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c6-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c6-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c6-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。20単位すべてが `applied: ok`。
  - edits の commit: C-1-ai `052cf8eb`、C-2-debug `9cea6472`、C-3-remote `0bcc9700`、C-4-notebook `3fec99b6`、C-5-extension-gallery `41ec446a`、C-6-settings-sync `8bbb2357`。どれも `conflicts: []`
  - C-6 の ops は `4a3dd510`
- 警告は C-2 の想定どおりの1件だけ（`debugChatIntegration.ts`）。C-6 には警告が無い。
- 検査の `remnants`・`absentStrings` は `ok`（`hitCount` が 1 以上の項目も、`status: fail` も無い）。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c6tc-verify-b\typecheck.log`）。HEAD `81a449efb7f36dd3a87561a5acdf772ec24b30ad`、未コミット 0。
- **ほかの単位と文脈が重ならないこと（docs/03 の5.3）**
  - edits.patch が触る5ファイル（`contrib/preferences` の3つ、`contrib/relauncher` の2つ）は、ほかのどの単位の edits.patch も `patches/` も触れない（`removals/**/*.patch`・`patches/*.patch` の `diff --git` の行を `Grep`）。C-1 の edits.patch は `contrib/preferences` の別の4ファイル（`preferencesRenderers.ts`・そのテスト・`settingsTree.test.ts`・`settingsTreeModels.test.ts`）に触れるが、C-6 のファイルとは別。
  - C-2〜C-5 の ops（`delete`・`removeLines`）も、5ファイルに触れない。
  - b の C-6 の ops の commit（`4a3dd510`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-6-settings-sync/edits.patch` を走らせた。5ファイルの全ハンクが、行のずれの表示も無く当たった。3-way の基底を探さずに当たる。
  - `removeLines` に回すものは無い。
- 注入の照らし（この木で `Grep`）: `IUserDataSyncWorkbenchService` は `common/userDataSync.ts` の ID と型、`update.ts` の import と `accessor.get` の2行だけ。`registerChannel('userDataSyncUtil'` は 0 件（共有プロセスの代理の `getChannel('userDataSyncUtil', ...)` の1行は残る）。
- ロックファイル: `ok`。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（04:41 UTC） | 19.08 GB（20,484,362,240 バイト） | `disk-start.json` |
| 終わり（04:54 UTC） | 19.07 GB（20,479,406,080 バイト） | `disk-end.json` |

- 減ったのは約 5 MB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.8 GB（96,144ファイル）、b の後で 3.79 GB（95,705ファイル）。`build-typecheck-verify-*.json` の `disk.worktree`。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は前からあるもので、今回は作っていない。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない。`1.146.0` は `Grep` と Read で読んだだけ（`contrib/userDataSync`・`services/userDataSync`・`platform/userDataSync/common/userDataSyncStoreService.ts`・`contrib/extensions/browser/extensions.contribution.ts`）。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

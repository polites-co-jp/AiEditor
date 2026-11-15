# C-2 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数（`Grep` で数えた）。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c2-ops） | 02:12 | `8d45b289` | — | `fail`（absentStrings 2件） | — |
| 1 | c2tc-1 | 02:13 | `8d45b289` | 0 | error | 34 |
| 2 | c2tc-2 | 02:21 | 同上 | 8 | error | 5 |
| 3 | c2tc-3 | 02:23 | 同上 | 8 | error | 1 |
| 適用2 | `trial/checks-ops2.json`（c2-ops2） | 02:24 | `8ac50e06` | — | `fail`（absentStrings 1件） | — |
| 4 | c2tc-4 | 02:24 | `8ac50e06` | 8 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c2tc-verify-a | 02:27 | `20c43ac6` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c2tc-verify-b | 02:29 | `6b6aa860` | 0 | **ok** / **ok** | 0 |

- 適用1は、A・B の14単位と C-2 の ops だけの状態（`unit.json` は前からのもの）。absentStrings は `repl.contribution.ts` の `debug/browser/repl.js'` と `extHost.api.impl.ts` の `/extHostDebugService.js'` の2件で、どちらも edits.patch で直すもの。
- 1回目の34件の内訳:
  - `extHost.api.impl.ts` の29件（55行の import が無い、215行、`debug` の名前空間の27件）
  - `debug.service.contribution.ts` の1件（`./debugService.js` が無い）
  - ノートブックの3件（`editActions.ts`・`variablesActions.ts`・`notebook.contribution.ts`）
  - `repl.contribution.ts` の1件
  - README の「型検査で直す点」の見込みどおりで、ほかの所からの誤りは無かった。
- 2回目の5件は、直しで使われなくなった import とローカル（TS6133。`LifecyclePhase`・`workbenchContributionsRegistry`・`KeybindingsRegistry`・`IViewsService`）と、`variablesActions.ts` の1件。
- 3回目の1件は `variablesActions.ts`（`delete` に足すファイル。`rm` が許可に無いので、`unit.json` に足して当て直すまで残した）。
- 適用2は、`unit.json`（`delete` 1つ、`removeLines` 10行を足した）でタグから当て直したもの。このとき直しのファイルは、先に作った仮の commit `1fd0326a`（作者は `shuko-apply`）から `git -C C:/b/wt/p2 checkout <sha> -- <8ファイル>` で戻した。absentStrings の1件は `extHost.api.impl.ts` の import（edits.patch で替える）。
- 4回目で誤り 0。その後、C-2 の ops の commit（`0553a2ac`）を checkout し、8ファイルを仮の commit から戻して `unit C-2-debug: edits` の commit（`c448c247`、作者は `--author=shuko-apply`）にした。`git -C C:/b/wt/p2 format-patch -1 c448c247 --output=removals/C-2-debug/edits.patch` で書き出した。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-2（15単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c2-verify-a --only <A・B の14単位>,C-2-debug --checks-out tasks/2026-11-15-p5-c2-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c2tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c2-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c2-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c2-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c2-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c2-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。15単位すべてが `applied: ok`。C-2-debug の ops は `7eb4f02e`、edits は `344b28a2`（`unit C-2-debug: edits`、`conflicts: []`）。warnings は無い。
- 検査の `remnants`・`absentStrings`（足した4つを含む）は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c2tc-verify-a\typecheck.log`）。HEAD `20c43ac698fda55ed345314beaff0160e8398eb3`、未コミット 0。
- ロックファイル: `ok`。ルートの差分は削除だけ49行（A・B の単位の分。C-2 は依存を消さない）。`changedSections: []`、`unexpectedRemovedDeps: []`、`unexpectedPatchChanges: []`。検査の後に戻した。
- build/ の型検査（`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`）は1件（`build/gulpfile.vscode.ts` 167行の `never`）。A-3 の `builtInExtensions: []` から来るもので、C-1 の記録にある1件と同じもの（C-1 が無いので行がずれている）。C-2 による誤りは無い。

### b. A・B の14単位と C-1 と C-2（16単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c2-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug --checks-out tasks/2026-11-15-p5-c2-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c2tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c2-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c2-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c2-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c2-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c2-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。16単位すべてが `applied: ok`。C-1-ai の edits は `fce18f76`、C-2-debug の ops は `5eed91d8`、edits は `202e2568`（`conflicts: []`）。
- 警告は1件だけ: `C-2-debug: delete: src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts が本家に無い`。C-1 が先に消すファイルで、README の前からの想定どおり。
- 検査の `remnants`・`absentStrings` は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c2tc-verify-b\typecheck.log`）。HEAD `6b6aa860527f630c594dc2721b62fa90b62d584e`、未コミット 0。
- **3-way に頼らずに当たるか**: b の C-2 の ops の commit（`5eed91d8`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-2-debug/edits.patch` を走らせた。8ファイルの全ハンクが、行のずれ（offset）だけで当たった（例: `extHost.protocol.ts` は -507 行と -661 行、`extHost.api.impl.ts` は -9・-17・-31 行）。C-1 の有無で blob が違っても、3-way の基底を探さずに当たる。
- ロックファイル: `ok`。ルートの差分は削除だけ768行（C-1 の3回目の記録と同じ行数。C-2 は何も足していない）。`changedSections: []`、`removedPatches: ["foundry-local-sdk"]`、`unexpectedPatchChanges: []`。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（02:12 UTC） | 19.45 GB（20,883,435,520 バイト） | `disk-start.json` |
| 終わり（02:31 UTC） | 19.41 GB（20,838,473,728 バイト） | `disk-end.json` |

- 減ったのは約 0.04 GB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.93 GB（103,189ファイル）、b の後で 3.8 GB（96,049ファイル）。どちらも `build-typecheck-verify-*.json` の `disk.worktree`。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は読むだけで、書き換えていない。`disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は以前からあるもので、今回は作っていない。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

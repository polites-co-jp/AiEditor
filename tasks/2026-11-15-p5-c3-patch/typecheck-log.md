# C-3 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c3-ops） | 02:37 | `ffe9997b` | — | `fail`（absentStrings 1件） | — |
| 1 | c3tc-1 | 02:38 | `ffe9997b` | 0 | error | 1 |
| 2 | c3tc-2 | 02:40 | 同上 | 1 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c3tc-verify-a | 02:42 | `091c9aaf` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c3tc-verify-b | 02:44 | `91ef66ca` | 0 | **ok** / **ok** | 0 |

- 適用1は、A・B の14単位と C-1 と C-3 の ops（`unit.json` は下準備のまま）を、タグから `apply.mjs --only` で当てたもの。16単位すべてが `applied: ok`、warnings は無い。absentStrings の1件は `viewsExtensionPoint.ts` の27行（`remote/browser/remoteExplorer.js'`）で、edits.patch で直すもの。`remnants` は `ok`。
- 1回目の1件: `src/vs/workbench/api/browser/viewsExtensionPoint.ts(27,38): error TS2307: Cannot find module '../../contrib/remote/browser/remoteExplorer.js'`。README の「型検査で直す点」の見込みどおりで、ほかの所からの誤りは無かった。
- 直し: import の行を消し、import の並びの後に `const REMOTE = 'workbench.view.remote';`（本家の `remoteExplorer.ts` の42行 `VIEWLET_ID` と同じ値）を置いた。
- 2回目で誤り 0。
- commit と書き出し:
  1. 直しを仮の commit `a15f7b42`（作者は `shuko-apply`）にした。
  2. C-3 の ops の commit（`2030ccc6`）を checkout し、`git -C C:/b/wt/p2 checkout a15f7b42 -- <そのファイル>` で戻した。
  3. `unit C-3-remote: edits` の commit（`582bd5eb`、`--author=shuko-apply`）にした。
  4. `git -C C:/b/wt/p2 format-patch -1 582bd5eb --output=removals/C-3-remote/edits.patch` で書き出した。

### build/ の側の型検査

`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`（2回目の木と、確かめ b の木の2回）。どちらも7件で、中身は同じ。

| 件数 | ファイル（行） | 元 |
|---|---|---|
| 1 | `build/gulpfile.vscode.ts`（139） | A-3 の `builtInExtensions: []`。C-1 の記録にある、前からの1件 |
| 2 | `build/gulpfile.vscode.ts`（353・367）の `serverDataFolderName` | C-3 の `productRemove` |
| 3 | `build/gulpfile.vscode.win32.ts`（96〜98）の `win32TunnelMutex`・`win32TunnelServiceMutex`・`tunnelApplicationName` | 同上 |
| 1 | `build/linux/dependencies-generator.ts`（60）の `tunnelApplicationName` | 同上 |

- どれも product.json から推論される型の誤りで、実行時は止まらない（gulp は `node --experimental-strip-types` で走る。`serverDataFolderName` には `|| '.vscode-remote'` の既定がある。win32 の3件はインストーラーの作成の関数の中、linux の1件は Linux の版だけ）。
- 関門の型検査（`typecheck-client`）の外なので、直していない（handoff-notes の「判断を仰ぐ点」の1）。

### gulp のタスクの一覧

2回目の木（直しは未コミット）で `pnpm --dir C:/b/wt/p2 run gulp --tasks-simple` を走らせた。

- 誤りなく一覧が出た。`vscode-win32-x64-min`・`vscode-win32-x64`・`compile` などは残り、`vscode-reh-*`・`vscode-reh-web-*` は無い。
- 走らせた後の `git -C C:/b/wt/p2 status` は、直した1ファイルだけ（gulp の読み込みでファイルは増えていない）。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-1 と C-3（16単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c3-verify-a --only <A・B の14単位>,C-1-ai,C-3-remote --checks-out tasks/2026-11-15-p5-c3-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c3tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c3-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c3-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c3-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c3-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c3-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。16単位すべてが `applied: ok`。
  - C-3-remote の ops は `46bc2f19`。`removeLines` の13行はどれも `found: 1`、`productRemoved` は9つ、`productMissing: []`
  - edits は `ab660ad5`（`unit C-3-remote: edits`、`conflicts: []`）
  - warnings は無い
- 検査の `remnants`・`absentStrings` は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c3tc-verify-a\typecheck.log`）。HEAD `091c9aaf314aa63d55c681278cf4936997d08f87`、未コミット 0。
- ロックファイル: `ok`。
  - ルートの `pnpm-lock.yaml`: `changedSections: []`、`unexpectedRemovedDeps: []`、`changedDeps: []`、`addedPackages: []`、`unexpectedPatchChanges: []`、`removedPatches: ["foundry-local-sdk"]`
  - 差分の削除の行は 11,695（`extensions/copilot/pnpm-lock.yaml` を丸ごと消す分を含む）で、C-2 の確かめ b（C-1 と C-2）と同じ数。追加の行は 0。C-3 は依存を消さないので、C-1 の分だけ
  - 検査の後に戻した

### b. A・B の14単位と C-1・C-2・C-3（17単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c3-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug,C-3-remote --checks-out tasks/2026-11-15-p5-c3-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c3tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c3-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c3-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c3-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c3-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c3-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。17単位すべてが `applied: ok`。
  - edits の commit: C-1-ai `84346236`、C-2-debug `8ab71a30`、C-3-remote `cc6b9913`。どれも `conflicts: []`
  - C-3-remote の ops は `7285c8bc`
- 警告は1件だけ: `C-2-debug: delete: src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts が本家に無い`。C-1 が先に消すファイルで、C-2 の README の前からの想定どおり。C-3 には警告が無い。
- 検査の `remnants`・`absentStrings` は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c3tc-verify-b\typecheck.log`）。HEAD `91ef66ca66350a0809e05fe9d55193323b495cd2`、未コミット 0。
- **C-2 と文脈が重ならないこと（docs/03 の5.3）**:
  - C-3 の edits.patch が触るのは `viewsExtensionPoint.ts` だけ。C-2 の edits.patch はこのファイルに触れない。C-1、A・B の単位、`patches/` も同じ（`removals/`・`patches/` を `Grep` で確かめた）。
  - b の C-3 の ops の commit（`7285c8bc`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-3-remote/edits.patch` を走らせた。行のずれ（offset）も無く当たった。
  - `removeLines` に回すものは無い。
- ロックファイル: `ok`。ルートの値は a と同じ（`changedSections: []`、`removedPatches: ["foundry-local-sdk"]`、`unexpectedPatchChanges: []`）。差分の削除の行は 11,695、追加は 0。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（02:37 UTC） | 19.42 GB（20,848,492,544 バイト） | `disk-start.json` |
| 終わり（02:46 UTC） | 19.19 GB（20,604,657,664 バイト） | `disk-end.json` |

- 減ったのは約 0.23 GB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.8 GB（96,116ファイル）、b の後で 3.8 GB（96,012ファイル）。`build-typecheck-verify-*.json` の `disk.worktree`。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は前からあるもので、今回は作っていない。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない。`1.146.0` は読んだだけ（`remoteExplorer.ts`・`remote.contribution.ts`・`tunnel.ts`）。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

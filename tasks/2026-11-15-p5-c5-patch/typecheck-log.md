# C-5 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数（`Grep` で数えた）。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `trial/checks-ops.json`（c5-ops） | 03:27 | `d67712bf` | — | `fail`（absentStrings 5項目・7件） | — |
| 1 | c5tc-1 | 03:28 | `d67712bf` | 0 | error | 20 |
| 2 | c5tc-2 | 03:37 | 同上 | 10 | error | 42 |
| 3 | c5tc-3 | 03:39 | 同上 | 10 | error | 5 |
| 適用2 | `trial/checks-ops2.json`（c5-ops2） | 03:41 | `5ef136ec` | — | `fail`（absentStrings。edits.patch の前なので想定どおり） | — |
| 4 | c5tc-4 | 03:41 | `5ef136ec` | 10 | **ok** | 0 |
| 確かめ a | `trial/checks-verify-a.json` → c5tc-verify-a | 03:44 | `3d9a7a6f` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-verify-b.json` → c5tc-verify-b | 03:46 | `2e03c80c` | 0 | **ok** / **ok** | 0 |
| 確かめ a2 | `trial/checks-verify-a2.json`（適用だけ） | 03:48 | `90baf75d` | 0 | **ok** | — |

- 適用1は、A・B の14単位と C-1 と C-5 の ops（`unit.json` は下準備のまま）を、タグから `apply.mjs --only` で当てたもの。16単位すべてが `applied: ok`。C-5 の `removeLines` 8行はどれも `found: 1`。警告は無い。`remnants` は `ok`。absentStrings の7件は、どれも edits.patch で直すファイル（`extensions.contribution.ts` 4件、`extensionsActions.ts` 1件）と、消すことにしたテスト `extensionGalleryManifestService.test.ts` の2件の import だった。`extensionGalleryManifestService.ts` も消したファイルを import していたが、`kept` に挙げたファイルなので検査の外（型検査で見つけた）。
- 1回目の20件の内訳
  - `sharedProcessMain.ts` の2件（使われなくなった `IExtensionTipsService`・`ExtensionTipsChannel`）
  - `extensions.contribution.ts` の11件（消したファイルの import 4件、import が解けず `IWorkspaceExtensionsConfigService` が `unknown` になった6件、`IExtensionGalleryAccountService` が `unknown` になった1件）
  - `extensionsActions.ts` の1件（`workspaceExtensionsConfig.js` の import）
  - `extensionGalleryManifestService.ts` の1件（`extensionGalleryAccount.js` の import）
  - `extensionGalleryManifestService.test.ts` の5件
  - README の「型検査で直す点」の見込みの範囲だった。`extensionsViewlet.ts`・`extensionsViews.ts`・electron-browser の `extensions.contribution.ts` は型の誤りにならなかった（消す画面と登録は README の「画面」の一覧から直した）。
- 2回目の42件: 画面とクラスを消した結果、使われなくなった import とメンバー（`extensions.contribution.ts` 9件、`extensionsActions.ts` 10件、`extensionsViewlet.ts` 5件、`extensionsViews.ts` 3件）、`extensionsViewlet.ts` が import する消したビューのクラス（5件。各2行）、テストの5件。
- 3回目の5件は、`extensionGalleryManifestService.test.ts`（`delete` に足すファイル。`rm` が許可に無いので、`unit.json` に足して当て直すまで残した）。
- 3回目の後
  1. 直しを仮の commit `58710b26`（作者は `shuko-apply`）にした。
  2. `unit.json` の `delete` にテスト1つを足した。
  3. タグから当て直した（適用2。C-5 の ops は `cab7b627`）。この版の `unit.json` には `"patch"` をまだ書いていない。
  4. 10ファイルを `git -C C:/b/wt/p2 checkout 58710b26 -- <10ファイル>` で戻した。
- 4回目で誤り 0。
- commit と書き出し
  1. C-5 の ops の commit（`cab7b627`）を、直しを index に置いたまま checkout した（後の commit は C-5 のファイルに触れないので、そのまま運べた）。
  2. `unit C-5-extension-gallery: edits` の commit（`a7aad91d`、`--author=shuko-apply`）にした。
  3. `git -C C:/b/wt/p2 format-patch -1 a7aad91d --output=<ビルドリポジトリ>/removals/C-5-extension-gallery/edits.patch` で書き出した。
  4. `unit.json` に `"patch": "edits.patch"` と、checks の項目（absentCommands 11、absentViews 1、absentStrings 6）、`kept` 1つを足した。
- 確かめ a・b の後、absentStrings の1項目（`src/vs/workbench/services/extensionManagement` の `galleryAccountService`）を外した。当たるはずのファイル `extensionGalleryManifestService.ts` が `kept` にあり、検査の外になるため（網にならない）。外した後の `unit.json` で、a の組をタグから当て直した（`trial/checks-verify-a2.json`、下の 2 の a の末尾）。

### build/ の側の型検査

C-5 の ops と edits.patch は `build/` に触れないので、今回は走らせていない（C-4 の記録では、A-3 から来る前からの1件だけ）。

## 2. 当て直しの確かめ

### a. A・B の14単位と C-1・C-5（16単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c5-verify-a --only <A・B の14単位>,C-1-ai,C-5-extension-gallery --checks-out tasks/2026-11-15-p5-c5-patch/trial/checks-verify-a.json
node scripts/build.mjs 1.146.0 --label c5tc-verify-a --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c5-patch/trial/build-typecheck-verify-a.json --take-in-dir tasks/2026-11-15-p5-c5-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c5-verify-a --lockfile-check --checks-out tasks/2026-11-15-p5-c5-patch/trial/checks-verify-a.json --diff-out tasks/2026-11-15-p5-c5-patch/trial/lockfile-a.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。16単位すべてが `applied: ok`。
  - C-5 の ops は `bc2f6da1`。`delete` の20はどれも消え（`missingDeletes: []`）、`removeLines` の8行はどれも `found: 1`
  - edits は `b129f6e1`（`unit C-5-extension-gallery: edits`、`conflicts: []`）
  - 警告は無い（C-2 を当てないので、C-2 の想定の1件も出ない）
- 検査の `remnants`・`absentStrings`（このときは足した6つを含む）は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c5tc-verify-a\typecheck.log`）。HEAD `3d9a7a6fe41da4ef575e3be41ef2d1ebc3448a6b`、未コミット 0。
- ロックファイル: `ok`。`build/`・`extensions/` は変わらず、`extensions/copilot/` は A-1 が消したフォルダの中。ルートの差分は前の単位（B-1・C-1）が消した依存だけ。C-5 は依存を消さない。検査の後に戻した。
- C-5 の ops の commit（`bc2f6da1`）を checkout して、`git -C C:/b/wt/p2 apply --check -v removals/C-5-extension-gallery/edits.patch` が10ファイルとも当たった（行のずれの表示も無い）。
- 最後の `unit.json`（absentStrings を1つ外した版）で、タグから同じ16単位を当て直した（label c5-verify-a2、03:48 UTC、`trial/checks-verify-a2.json`）。`result: ok`、C-5 の edits は `0eb4ecda`（`conflicts: []`、作者・コミッターとも `shuko-apply <apply@shuko.invalid>`）、警告は無い。edits.patch は変えていないので、型検査とロックファイルの検査は流し直していない。

### b. A・B の14単位と C-1〜C-5（19単位）

```
git -C C:/b/wt/p2 checkout 1.146.0
node scripts/apply.mjs C:/b/wt/p2 --label c5-verify-b --only <A・B の14単位>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery --checks-out tasks/2026-11-15-p5-c5-patch/trial/checks-verify-b.json
node scripts/build.mjs 1.146.0 --label c5tc-verify-b --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c5-patch/trial/build-typecheck-verify-b.json --take-in-dir tasks/2026-11-15-p5-c5-patch/trial/take-in
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c5-verify-b --lockfile-check --checks-out tasks/2026-11-15-p5-c5-patch/trial/checks-verify-b.json --diff-out tasks/2026-11-15-p5-c5-patch/trial/lockfile-b.diff
git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml
```

- 適用は `result: ok`。19単位すべてが `applied: ok`。
  - edits の commit: C-1-ai `1f8bfb41`、C-2-debug `59187d39`、C-3-remote `ed8ed92b`、C-4-notebook `04a0fcf4`、C-5-extension-gallery `ef602449`。どれも `conflicts: []`
  - C-5 の ops は `89e7f251`
- 警告は C-2 の想定どおりの1件だけ（`debugChatIntegration.ts`）。C-5 には警告が無い。
- 検査の `remnants`・`absentStrings` は `ok`。
- 型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c5tc-verify-b\typecheck.log`）。HEAD `2e03c80cd351204fb62ca0443246e8f5b5577935`、未コミット 0。
- **ほかの単位と文脈が重ならないこと（docs/03 の5.3）**
  - edits.patch が触る10ファイルのうち、ほかの単位の edits.patch も触るのは C-1 の `extensions.contribution.ts`・`extensionsViewlet.ts`・`sharedProcessMain.ts` だけ（各単位の edits.patch の `diff --git` の行を `Grep`）。C-5 は `after` に C-1 を挙げるので、C-1 の後の木で作った。
  - C-2・C-3・C-4 の edits.patch は、C-5 の10ファイルのどれにも触れない。C-3 の `removeLines` が消す `sharedProcessMain.ts` の行（`remoteTunnel` の import・登録・チャンネル）は、C-5 のハンク（29〜37行の import）から離れている。
  - b の C-5 の ops の commit（`89e7f251`）を checkout して `git -C C:/b/wt/p2 apply --check -v removals/C-5-extension-gallery/edits.patch` を走らせた。10ファイルの全ハンクが、行のずれの表示も無く当たった。3-way の基底を探さずに当たる。
  - `removeLines` に回すものは無い。
- ロックファイル: `ok`。検査の後に戻した。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（03:26 UTC） | 19.18 GB（20,590,739,456 バイト） | `disk-start.json` |
| 終わり（03:47 UTC） | 18.60 GB（19,975,598,080 バイト） | `disk-end.json` |

- 減ったのは約 0.57 GB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は、a の後で 3.8 GB（96,135ファイル）、b の後で 3.79 GB（95,714ファイル）。`build-typecheck-verify-*.json` の `disk.worktree`。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は前からあるもので、今回は作っていない。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない。`1.146.0` は読んだだけ（`src/vs/sessions/services/extensionRecommendations/common/extensionRecommendationNotificationService.ts`）。

## 4. 終わりの状態

`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts`（C-1 のときに置いた写し）はそのまま残っている。

## 5. 2回目（2026-11-15、画面からの VSIX の導入と `ext install ` を外す）

依頼は `brief.md` の「追加の依頼（2026-11-15、1回目の後）」。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 土台 | `trial/checks-r2-base.json`（c5r2-base。1回目の edits.patch で16単位） | 03:56 | `b147094a` | — | **ok** | — |
| 1 | c5r2tc-1 | 03:57 | `b147094a` | 3 | error | 15 |
| 2 | c5r2tc-2 | 03:58 | 同上 | 3 | **ok** | 0 |
| 確かめ a | `trial/checks-r2-verify-a.json` → c5r2tc-verify-a | 03:59 | `aaaf69c4` | 0 | **ok** / **ok** | 0 |
| 確かめ b | `trial/checks-r2-verify-b.json` → c5r2tc-verify-b | 04:01 | `735b2e2a` | 0 | **ok** / **ok** | 0 |

- 土台は、1回目の edits.patch を含む16単位をタグから当てたもの（C-5 の ops `9a751383`、edits `c830a78d`）。この上で3ファイル（`extensions.contribution.ts`・`extensionsViewlet.ts`・`extensionsQuickAccess.ts`）を直した。
- 1回目の15件は、どれも使われなくなった名前（`extensions.contribution.ts` の `ResourceContextKey`、`extensionsQuickAccess.ts` の import 5件、`extensionsViewlet.ts` の import 8件と `commandService`）。2回目で誤り 0。
- commit と書き出し
  1. 直しを仮の commit `8cc66b6d`（作者は `shuko-apply`）にした。
  2. C-5 の ops の commit（`9a751383`）を checkout し、11ファイルを `git -C C:/b/wt/p2 checkout 8cc66b6d -- <11ファイル>` で取り出した。
  3. `unit C-5-extension-gallery: edits` の commit（`cd9cf41d`、`--author=shuko-apply`）にし、`format-patch -1 cd9cf41d --output=<ビルドリポジトリ>/removals/C-5-extension-gallery/edits.patch` で書き出し直した。11ファイル（新規2）、245行の追加、1,170行の削除。
  4. `unit.json` の `checks.absentStrings` に4つを足した（`InstallExtensionQuickAccessProvider`・`'ext install '`・`isEqualTo('.vsix')`・`extractEditorsAndFilesDropData`。範囲は `src/vs/workbench/contrib/extensions`）。4つとも `C:\b\wt\1.146.0` の `contrib/extensions` にあることを `Grep` で確かめた（空振りしない）。
- 確かめ a（16単位）: 適用は `result: ok`、C-5 の ops `d7021056`・edits `9073858c`（`conflicts: []`）、警告無し。`remnants`・`absentStrings`（足した4つを含む）は `ok`。型検査は誤り 0（HEAD `aaaf69c450278c2f1d3b543aa9ea72aca8b12c01`）。`--lockfile-check` は `ok`（`trial/lockfile-r2-a.diff`）。`d7021056` の上で `git apply --check -v` が11ファイルとも行のずれ無く当たった。
- 確かめ b（19単位）: 適用は `result: ok`、C-5 の ops `b3da2775`・edits `a66066cd`（`conflicts: []`）。警告は C-2 の想定の1件だけ。型検査は誤り 0（HEAD `735b2e2a0d67779b85ff9c0b2ea26224d962dafd`）。`--lockfile-check` は `ok`（`trial/lockfile-r2-b.diff`）。`b3da2775` の上で `git apply --check -v` が11ファイルとも行のずれ無く当たった。足した `extensionsQuickAccess.ts` は、C-1〜C-4 のどの edits.patch も触れない。
- ロックファイルは、どちらの組でも検査の後に戻した。
- ディスク: 始め 19.08 GB（`disk-start-2.json`、03:55 UTC）、終わり 19.09 GB（`disk-end-2.json`、04:01 UTC）。
- 終わりに `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。`status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。

# apply.mjs の試しの記録

- 試した人: 蒙恬（p2-apply）
- 日: 2026-11-14（記録の時刻は UTC で 2026-11-13T15 時台）
- 道具: Node.js v24.16.0、git 2.54.0.windows.1
- 作業ツリー: `C:\b\wt\dev-apply`（`git -C C:/b/vscode worktree add C:/b/wt/dev-apply 1.146.0` で作った。HEAD `69047191fc427f2f92828279aae1d90d8eeda7ab` = upstream.json の commit）。`C:\b\wt\1.146.0` には触れていない
- 試しごとに `git -C C:/b/wt/dev-apply checkout -f --detach 1.146.0` でタグへ戻した
- 入れ物: `fixtures/`（`removals/` に試し用の単位は置いていない）。記録: `trial/<名前>/checks.json`
- 依存の導入とビルドは走らせていない

## 1. 文法の確かめ

`node --check` を `scripts/apply.mjs` と `scripts/lib/apply/` の10ファイルに通した。すべて誤りなし（最後の変更の後にも通した）。

## 2. 試しの一覧

| # | 記録 | 中身 | 結果 | 見たこと |
|---|---|---|---|---|
| 1 | `trial/dry-run/` | `--dry-run --prev-tag 1.145.3`、fixtures の A-1・B-1（このときは edits なし） | `fail`（`registeredKeys` の `shukoConfigurationDefaults` が missing。試しのパッチを作る前）。作業ツリーは変わらず | `removeLines` 12件がすべて `found: 1`。`delete` の無いパス、`removeDependencies` の無い名前、`productRemove` の無いキー、overlay の `remove` の無いキーがそれぞれ警告になった。`removeIfPresent` の `voiceWsUrl`（本家 1.146.0 にある）が外されて警告になった |
| 2 | `trial/run1/` | 本番の当て方（edits と patches/ なし） | `fail` | コミット5つ（overlay、A-1 ops、B-1 ops、assets、builtin extensions）。`absentStrings` が `contrib/surveys/` を1件見つけた（`chatModelFeedbackSurveyConfig.ts` の11行目のコメント）。`kept` の `uri.perf.data.txt` は数えなかった。`registeredKeys` が `shukoConfigurationDefaults` を missing にした。この状態から edits.patch と試しのパッチを作った（3節） |
| 3 | `trial/run2/` | 本番の当て方（edits.patch と patches/ あり） | `hold`（未分類の組み込み拡張だけ） | コミット7つ（overlay、A-1 ops、B-1 ops、B-1 edits、patch、assets、builtin extensions）。B-1 の edits の件名が `unit B-1-trial-surveys: edits`。`absentStrings`・`remnants` が `ok`、`registeredKeys` が `ok`（`shukoConfigurationDefaults` は `referenced` で `src/vs/base/common/product.ts`） |
| 4 | `trial/run2/`（追記） | `--lockfile-check`。ロックファイルを手で「消した依存だけを消した」形に直した（`extensions/pnpm-lock.yaml` の importer `grunt`・`jake`、ルートの importer `.` の `@microsoft/1ds-core-js`） | ロックファイル `ok` | 予期した削除として数えた。このとき `remote/pnpm-lock.yaml` が、git では変更なしなのに `unchanged: false` になった（作業ツリーでは CRLF）。行末をそろえて比べるように直した |
| 5 | `trial/run2-lock-bad/` | `--lockfile-check --base 1.146.0`、`checks.json` なし。4の上に、残る依存の版の変更（`@hpke/core` 1.9.0 → 1.9.1）と依存の追加（importer `gulp` に `left-pad`）を足した | `fail` | `changedDeps` に `@hpke/core`、`addedDeps` に `left-pad`。単位を知らないので `grunt`・`jake`・`@microsoft/1ds-core-js` も「予期しない削除」になった（その旨の警告を足した）。`remote/pnpm-lock.yaml` は `unchanged: true`（直した後） |
| 6 | `trial/bad-zero/` | `--only A-2-bad-zero`（`removeLines` が0行） | `fail`、`stoppedAt` = `A-2-bad-zero: removeLines: build/npm/dirs.ts: 一致する行が無い: ...` | `found: 0` を記録 |
| 7 | `trial/bad-count/` | `--only A-3-bad-count`（`count: 2` に1行） | `fail`、`一致する行が 1 行（期待 2 行）` | ファイルは書き換えない |
| 8 | `trial/bad-after/` | `--only B-3-bad-after`（`after` の A-3 を入れない） | `fail`、`errors` に `B-3-bad-after: after の単位 A-3-bad-count が先に当たらない（--only に入っていない）` | 作業ツリーに何も書かずに止まった（`git status` が空） |
| 9 | `trial/bad-conflict/` | `--only B-2-bad-conflict`（ops で消した行の隣を edits.patch が直す） | `fail`、`edits.applied: "conflict"`、`conflicts` に `chatModelFeedbackSurveyConfig.ts` | `git am --abort` され、作業ツリーはきれい（ops のコミットは残る） |
| 10 | `trial/rerere-1/` | 9 と同じものに `--keep-conflict` | `fail`、`keptConflict: true` | 衝突のまま残った。手で解いて `git add`、`git am --continue` した（git が `Recorded resolution for ...` と出した） |
| 11 | `trial/rerere-2/` | タグへ戻して 9 と同じもの（`--keep-conflict` なし） | 単位は `applied: "ok"`、edits のコミットの件名 `unit B-2-bad-conflict: edits`。結果の `fail` は `registeredKeys`（patches/ を渡していないので `shukoConfigurationDefaults` が missing。予期どおり） | rerere が前の解き方で解き、`git am --continue` で進んだ |
| 12 | `trial/invalid/` | `--dry-run --removals fixtures/removals-invalid` | `fail`、`errors` 5件（id とフォルダの名前、stage、enabled、`../outside`、line が無い） | 入力の検査で止まった |
| 13 | `trial/until/` | `--until A-1-trial-grunt-jake` | `hold` | B-1 が `unitsSkipped` に `after --until`。patches/・assets・mydist は当たった |
| 14 | `trial/dry-nomanifest/` | `--dry-run --manifests <無い場所>` | `hold` | `basedpyright.importStrategy`・`claudeCode.environmentVariables` が `unverified`、`registeredKeys` が `warn`。dry-run でパッチを当てないための `shukoConfigurationDefaults` の missing は `warn` に下がった |
| 15 | `trial/run3/` | 最後のコードで 3 と同じもの、続けて 4 と同じ `--lockfile-check` | `hold`（ロックファイル `ok`） | コミット7つ（HEAD `fa47ddc3ac485b5abdfe912a1a02d60a422270a6`）。所要 約14秒（検査を含む）。作業ツリーはこの状態で残した（ロックファイルの手直しは戻した） |
| 参考 | `trial/real-dry/` | 本物の入力（他の蒙恬が作りかけの `removals/` A-1〜A-7・B-1〜B-6、`product.overlay.json`、`builtin/keep.json`、`patches/20-product-configuration-defaults.patch`）を `--only` で全部選んで `--dry-run --prev-tag 1.145.3` | ops はすべて当たった（警告なし）。未分類の組み込み拡張は0件（本家の95件を keep.json と単位で覆った）。`registeredKeys` の `fail` は dry-run でパッチを当てないため（直す前の実行。いまは `warn` に下げる） | 作りかけのものを読んだ一度きりの参考。単位の合否ではない |

## 3. 試しの edits.patch と patches/ の作り方

1. 試し2の状態（B-1 の ops まで当たった作業ツリー）で、`chatModelFeedbackSurveyConfig.ts` のコメントの `contrib/surveys/...` の参照を消し、`git -C C:/b/wt/dev-apply add ...`、`git -C C:/b/wt/dev-apply commit -m "unit B-1-trial-surveys: edits"`、`git -C C:/b/wt/dev-apply format-patch -1 HEAD -o <fixtures/removals/B-1-trial-surveys>`（docs/03 の5.2 の手順。出力の名前は `0001-unit-B-1-trial-surveys-edits.patch`）。
2. 同じく `src/vs/base/common/product.ts` の `IProductConfiguration` に `readonly shukoConfigurationDefaults?: IStringDictionary<unknown>;` を足してコミットし、`format-patch -o fixtures/patches`。
3. どちらも、パッチの `From:` の行に利用者の git の名前とメールが入ったので、`shuko-apply <apply@shuko.invalid>` に書き換えた（`doc-corrections.md` の4）。

## 4. 本家 1.146.0 で確かめた事実（試しで分かったこと）

- `pnpm-lock.yaml` は6つある: ルート、`build/`、`extensions/`、`extensions/copilot/`、`remote/`、`test/sanity/`（`git ls-tree -r` で数えた）。
- `remote/pnpm-lock.yaml` は作業ツリーで CRLF になる（git では差分なし）。
- `extensions/` の下で `package.json` の無いフォルダは `types` だけ。`package.json` のあるフォルダは95。
- 1.145.3 の Electron の版は `.npmrc` の `target`（43.8.3）にあり、1.146.0 はルートの `package.json` の `nativeBuild.target`（43.8.6）。`.nvmrc` は両方 24.22.1。
- 1.145.3 から 1.146.0 で増えたフォルダ: `src/vs/workbench/contrib/chatWindow`（chat を含むので目立たせた）、`contrib/sessionChanges`、`contrib/sessions`、`services/sessions`。`workbench.common.main.ts` に増えた import は `./services/lifecycle/common/unattendedRestart.js` の1行。ルートの package.json に増えた依存は devDependencies の8件（`@modelcontextprotocol/sdk` など）。
- `src/vs/sessions/sessions.desktop.main.ts`・`sessions.web.main.ts` も workbench の contrib を import している（例 `../workbench/contrib/surveys/browser/survey.contribution.js`）。contrib を消す単位は、これらの行も `removeLines` で消す必要がある（`doc-corrections.md` の3）。
- product.json はタブで字下げされている。overlay を当てても、変えたキーのほかの行は変わらなかった（`git diff` で確かめた）。

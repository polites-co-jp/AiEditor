# 引き渡しの覚え: build.mjs の commit の直し（蒙恬）

- 担当: 蒙恬、2026-11-14
- 依頼: `brief.md`（このフォルダ）
- 直したファイル: `scripts/build.mjs`（このほかは変えていない）

## 状態

- 直し（brief の1〜3）: 済み。`node --check scripts/build.mjs` 通る
- 作り直した A-1 の zip（brief の4）: 済み。下の「作り直した zip」（`C:\b\dist\1.146.0-p1-a1-r3.zip`、SHA-256 `e9215f2c…996c`）
- 結果: 完了

## 直したこと

1. **BUILD_SOURCEVERSION を渡す**: 型検査（`typecheck`）とパッケージ化（`package`）の子のプロセスの環境に、`BUILD_SOURCEVERSION=<作業ツリーの HEAD の40桁、小文字>` を足す。
   - HEAD は `scripts/lib/apply/git.mjs` の `head()`（`git -C <作業ツリー> rev-parse HEAD`）で読む。1回の実行で1回だけ読み、型検査・パッケージ化・後処理で同じ値を使う。
   - 読めない（作業ツリーが無い、git が落ちる、40桁でない）ときは、その手順で止める（`result: error`）。
   - 外から来た `BUILD_SOURCEVERSION` は、2つの手順では上書きする。
   - 本家のコードは変えていない。1.146.0 の `build/lib/getVersion.ts` は、`BUILD_SOURCEVERSION` が `/^[0-9a-f]{40}$/i` に合えばそれを使い、合わなければ `build/lib/git.ts` で `<root>\.git\HEAD` を読む（`C:\b\wt\1.146.0\build\lib\getVersion.ts` の9〜13行で確かめた）。`getVersion(root)` を呼ぶのは `gulpfile.vscode.ts`・`gulpfile.extensions.ts`・`lib/electron.ts` など。
2. **記録に残す**: ビルドの記録の最上位に `sourceVersion` を足した。各手順の記録（`steps[]` の typecheck・package）にも `env: { BUILD_SOURCEVERSION }` を書く。
3. **後処理の確かめ**: postprocess で、出力の `resources\app\product.json` の `commit` が40桁の16進で、`sourceVersion.value` と一致することを確かめる。commit が無い・40桁でない・違う・比べる値が無い、のどれでも `problems` に入り、postprocess で止まる。結果は `steps[].productCommit`。
4. **`--from install` でも units を埋める**: apply の手順を走らせないときも、`checks.json`（`--take-in-dir` の下）から `units`・`patches`・`applyResult` を埋める。どちらで埋めたかは `unitsFrom.applyRan`（true / false）。`--dry-run` でも埋める。

## テストの入口（曹参へ）

曹参が先に書いた `tests/build-commit.test.mjs` の想定（`headCommitOf`・`checkProductCommit(product, expected)` → `{ ok, problems }`・`unitsRecordFrom` → 配列）に、名前と形を合わせた。違うのは、子の環境を `childEnv` でなく `stepEnv` で作る点だけ（`childEnv(base, { BUILD_SOURCEVERSION })` も、想定どおりに値が載る。既存の部品で、変えていない）。

`scripts/build.mjs` から書き出している関数:

| 関数 | 引数 | 返り値 |
|---|---|---|
| `SOURCE_VERSION_STEPS` | （定数） | `["typecheck", "package"]`（凍結した配列） |
| `isFullSha(v)` | 任意 | 文字列で、trim した値が `/^[0-9a-f]{40}$/i` に合えば true。ほかは false（null・数・39桁・41桁・16進以外） |
| `headCommitOf(worktree)` | 作業ツリーのパス | `git -C <worktree> rev-parse HEAD` の40桁（小文字）。`.git` がファイル（git worktree）でも読める。リポジトリでない・40桁でないときは **例外**。git を起こす（純粋でない） |
| `stepEnv(name, env, sourceVersion)` | 手順の名前、環境（オブジェクト）、40桁の値 | env の写し。`BUILD_SOURCEVERSION` という名前のキー（大文字小文字を問わない）は外す。name が `SOURCE_VERSION_STEPS` にあれば `BUILD_SOURCEVERSION` に trim・小文字にした値を入れる。name がそれ以外なら足さない（sourceVersion は見ない）。name が2つのどれかで sourceVersion が40桁でなければ **例外**。元の env は変えない。main はこの返り値をそのまま子の `spawn` の env に渡す |
| `checkProductCommit(product, expected)` | 出力の product.json の中身（オブジェクト）、渡した値 | `{ ok, commit, expected, problems }`。problems は文の配列で、ok のとき `[]`。ok は、commit と expected がどちらも40桁で、大文字小文字を問わずに一致するときだけ true。commit が無い（キーごと・undefined・null・空文字）、文字列でない（数など）、40桁でない、expected が40桁でない、違う（文に両方の値が入る）、のどれでも false。product は変えない。`commit` は product の値（無ければ null） |
| `unitsRecordFrom(checks)` | checks.json を読んだオブジェクト | `[{ id, enabled, applied }]`（ほかのキーは落とす）。checks が null・オブジェクトでない・`units` が配列でないときは `[]` |
| `patchesRecordFrom(checks)` | 同上 | `[{ file, applied }]`。規則は unitsRecordFrom と同じ |

コマンドで試す入口（`--dry-run` は何も走らせない。`--record` を渡したときだけ記録を書く）:

1. `node scripts/build.mjs 1.146.0 --dry-run --worktree <git の作業ツリー> --from install --take-in-dir <checks.json のあるフォルダ>`
   - 出力の JSON（標準出力。先頭の `{` から）の `plan.typecheck.env.BUILD_SOURCEVERSION` と `plan.package.env.BUILD_SOURCEVERSION` が、`git -C <作業ツリー> rev-parse HEAD` と同じ。`sourceVersion.value` も同じ、`sourceVersion.source` は `"worktree HEAD"`
   - `units` が checks.json の `units` の `{ id, enabled, applied }`、`unitsFrom.applyRan` が false
   - 試しの作業ツリーは、`git init` して1つコミットした一時フォルダで足りる（`.git` がフォルダでも、`git worktree add` で作ったファイルでも、`rev-parse` は読める）
2. 作業ツリーが無いとき（`--worktree <無い場所>`）の dry-run: 終了コード 0、`sourceVersion.value` が null、`sourceVersion.error` が文字列、`plan.typecheck.env.BUILD_SOURCEVERSION` が `"<作業ツリーの HEAD（実行の時に読む）>"`
3. 後処理だけ（`--from postprocess --to postprocess --package-dir <出力> --worktree <作業ツリー> --take-in-dir <...> --record <json> --no-size`）:
   - 出力の `resources\app\product.json` に `commit` が無いか、作業ツリーの HEAD と違えば、終了コード 1、`stoppedAt: "postprocess"`、`steps[0].productCommit.ok: false`、`steps[0].problems` にその文
   - 一致すれば `productCommit.ok: true`（ほかの確かめ: exe・CLI・LICENSE・ThirdPartyNotices・keep.json の拡張・mydist も要る。既存のテスト `tests/build/` の作りの出力の試しに合わせる）
   - 実物で確かめた: 前回の出力（`C:\b\wt\VSCode-win32-x64\`、commit 無し）に当てると、`"problem": "出力の product.json に commit が無い"` で止まる（`ppcheck-r2-before.json`）
4. 記録のキー（`records/builds/<label>.json` か `--record`）:
   - `sourceVersion`: `{ name: "BUILD_SOURCEVERSION", value, source: "worktree HEAD", worktree, readAt, steps: ["typecheck","package"], error, uncommittedEntries, checksHeadCommit, matchesChecksHead }`
     - `readAt` は最初に読んだ手順の名前（`typecheck`・`package`・`postprocess`・`dry-run`）
     - `uncommittedEntries` は `git status --porcelain` の行の数（情報）
     - `checksHeadCommit` は checks.json の `headCommit`。HEAD と違えば `matchesChecksHead: false` で、`warnings` に1件
   - `steps[]` の typecheck・package: `env: { BUILD_SOURCEVERSION }`
   - `steps[]` の postprocess: `productCommit: { ok, commit, expected, problem }`
   - `unitsFrom: { checks: <checks.json のパス>, applyRan }`

テストが要る点:
- 子に本当に渡ること（プロセスの環境）は、`stepEnv` の返り値で見るのが近道。本物の pnpm を走らせずに確かめるなら、`--typecheck-script` に作業ツリーの package.json の試しの script（環境を書き出すもの）を指して `--from typecheck --to typecheck` で走らせる手がある（作業ツリーの package.json に script があることを確かめてから走る）。
- 既存の `tests/build-parts.test.mjs` などの postprocess の試しで、試しの出力の product.json に `commit` が無いものは、この直しで落ちるようになる。そのときは試しの product.json に作業ツリーの HEAD を入れる。

## 作り直した zip

| 項目 | 値 |
|---|---|
| label | `1.146.0-p1-a1-r3` |
| zip | `C:\b\dist\1.146.0-p1-a1-r3.zip`（406,723,259 バイト、3,190 項目、最上位 `Code-OSS-win32-x64-1.146.0-p1-a1-r3`） |
| SHA-256 | `e9215f2c2df15a3b4fdd910df1e63437d35b28bf844119c9517d57860daa996c` |
| 当て方 | r2 と同じ（`--only A-1-copilot-extension`、上書き・patches・assets は空、mydist だけ）。作業ツリー `C:\b\wt\p1-a1` をタグに戻して当て直した |
| 作業ツリーの HEAD（= product.json の commit） | `cff68091803f933ffbd34c93d1a7dc14633f7a72` |
| 本家の commit（記録の `upstream.commit`） | `69047191fc427f2f92828279aae1d90d8eeda7ab` |
| 記録 | `build-record-r3.json`、`take-in-r3/checks.json`・`lockfile.diff`、`launch-check-r3.json`、`build-log.md` |
| gulp の出力 | `C:\b\wt\VSCode-win32-x64\`。**この後の Phase 2 のビルドで上書きされる**。スモークは zip を展開して使う |

- 展開した product.json の commit と、`code-oss.cmd --version` の2行目が `cff68091…7a72`（`launch-check-r3.json`）。
- 25 秒の起動で、r2 では無かった `copilot-runtime.exe` が1つ起きた（`build-log.md` の3節）。スモークの見直しで見てほしい。
- 確かめ用に展開した `C:\b\p1\1.146.0-p1-a1-r3\` は残してある（ポータブルのデータが入っている。スモークには使わない方がよい）。

## 確かめたこと（まとめ）

- `node --check scripts/build.mjs` 通る。dry-run の plan に BUILD_SOURCEVERSION が出る。前回の出力の後処理は commit 無しで止まる。作り直した版は後処理を通り、zip の中の commit も渡した値と同じ。
- テスト（`node --test`）は許可が無く走らせていない。曹参の `tests/build-commit.test.mjs` の想定する名前と形には合わせた（読んで照らしただけ）。

## docs/ との食い違い

- docs/02 の4節の7（後処理）に、「出力の product.json の `commit` が40桁で、型検査・パッケージ化に渡した `BUILD_SOURCEVERSION`（作業ツリーの HEAD）と一致すること」を足すとよい。4節の9行目の「子のプロセスには …を渡さない」の箇所に、「型検査とパッケージ化には `BUILD_SOURCEVERSION=<作業ツリーの HEAD>` を渡す（作業ツリーの `.git` はファイルで、本家の `build/lib/git.ts` が読めないため）」を足すとよい。
- docs/02 の7節の記録の例に `sourceVersion` が無い。

## 未解決の点

- 直しの副作用（Phase 2 の土台の版で分かった。`tasks/2026-11-14-p2-builds/build-log.md` の2節）: 1.146.0 の `extensions/copilot/.esbuild.mts`（306〜309行・410〜414行）は、`BUILD_SOURCEVERSION` があると CI とみなし、`VSCODE_QUALITY` が無いとパッケージ化を止める。A-1 を当てた版では copilot の拡張が無いので起きない。A-1 を当てない版（1.146.0 では元から zip まで行かない）だけに効く。1.147.0 以降で A-1 を外してビルドするときに、`VSCODE_QUALITY`（`VSCODE_*` は子から外している）をどうするかの判断が要る。
- テストを走らせるのは曹参・検証役。

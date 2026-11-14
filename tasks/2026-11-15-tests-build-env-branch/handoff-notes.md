# 引き渡しの覚え: build.mjs の childEnv と枝のテスト（曹参）

## 結果: 完了

## 成果物

- `tests/build-env-branch.test.mjs`（新規、29件）
- `tasks/2026-11-15-tests-build-env-branch/run-all-result.txt`（`node tests/run-all.mjs --save` の出力）

## 件数

- `node --test tests/build-env-branch.test.mjs`: 29 件、通過 29、落ち 0、飛ばし 0（pnpm があったので型検査の結線も走った）
- 既存の `tests/build-commit.test.mjs`: 21/21、`tests/build-parts.test.mjs`: 38/38
- `node tests/run-all.mjs --save …`: TOTAL 1581、通過 1569、落ち 0、飛ばし 12
  - 検証役の前回（1521 / 1500 / 0 / 21）から、テストは 60 増えた。内訳は私の 29 のほか、p34-selfcheck などの未コミットの増え分。
  - 飛ばしは 21 から 12 に減った。`removals.test.mjs`（229 件中 12 件飛ばし）の差で、私の変更ではない（蒙恬の B-1 の直しの影響とみられるが、確かめていない）。

## テストの内容（`tests/build-env-branch.test.mjs`）

1. childEnv（4件）: 外の `BUILD_SOURCEVERSION` が大文字小文字を問わず外れる。値は `removed` に出ず、名前だけ出る。`extra` の値は残る。base は変えない。似た名前（`MY_BUILD_SOURCEVERSION`・`BUILD_SOURCEVERSION2`）は外さない。
2. 枝の名前・markBuildCommit
   - `buildBranchName`（2件）: 正しい形と、不正な8種類の例外。
   - 偽の `runGit`（8件）: created・unchanged（branch を呼ばない）・moved・branch が 128・読み直しの食い違い・runGit が例外・commit や label が不正なら runGit を呼ばない・小文字と trim。
   - 実の一時リポジトリ（4件）: 付く、同じなら unchanged、別の commit へ付け替え（`previous` に前の値）、存在しない commit は ok:false。
3. main の結線（実プロセス。全部、一時のリポジトリ）
   - `--dry-run`（2件）: `branch: null`、`plan.branch` に名前とコマンド、枝はできない。`--no-branch` なら `plan.branch` も無い。
   - `--from postprocess --to postprocess`（6件）:
     - 一致: 終了コード 0、`productCommit.ok: true`、枝が付く。
     - commit が無い・違う・40桁でない: 終了コード 1、`stoppedAt: postprocess`、`productCommit.ok: false`。無い・違うのときは枝を付けず `branch: null`。違うときは問題の文に両方の値が入る。
     - `--no-branch` は付けない。
     - 同じ label で HEAD が変わると moved になり、`warnings` に出る。
   - 型検査から始める（2件。pnpm が無ければ飛ばす）: `branch.ok: true` で枝が HEAD を指す。`--no-branch` なら `branch: null`。
   - 外の `BUILD_SOURCEVERSION` を親に置いた `--dry-run`（1件）: `envRemovedForChildren` に名前が出て、値は記録のどこにも出ない。`plan.typecheck.env` は作業ツリーの HEAD。

## 補足

- 後処理の偽物の出力は `tests/build/helpers.mjs` の `makeFakeEditor` に、自前の拡張 `mydist`・`notion-sync` の `package.json` を足したもの。keep は `[]`、removals は空のフォルダ。
- テストが使う一時の場所は `C:\b\tests-beb-*`。終わりに消える。常設の clone `C:\b\vscode` には触れない。
- 実装の不具合は見つからなかった。実装と docs の食い違いは、蒙恬が書いた 3 点（docs/02 の4節に枝が無い、など）以外に新しいものは無い。

## 未解決の点

- 許可の都合で、`node --test tests/*.test.mjs`（ワイルドカードそのまま）は打てなかった。ファイル名を指定して流した。
- `--from postprocess` で枝を付ける前の 14 版の commit に印を付ける件（蒙恬の未解決の2）は、この依頼の範囲外。

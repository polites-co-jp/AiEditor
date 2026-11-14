# テスト: build.mjs の childEnv（BUILD_SOURCEVERSION を外す）と、版の commit に付ける枝

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

蒙恬が `scripts/build.mjs` を2点直した（`tasks/2026-11-14-fix-b1-and-build/handoff-notes.md` の4節）。単体テストを付ける。検証で出た「後処理が commit の欠け・食い違いで本当に止まること（`--from postprocess` の結線）のテストが無い」（`tasks/2026-11-14-verify-commit-fix/handoff-notes.md`）も、この機会に足す。

## やること

1. `childEnv`: 外の `BUILD_SOURCEVERSION`（名前の大文字小文字を問わない）が外れること、`extra` で渡した値は残ること、記録の `envRemovedForChildren` に出ること。既存の `tests/build-commit.test.mjs`・`tests/build-parts.test.mjs` が通ること。
2. 枝 `builds/<label>`: 入口（関数・引数・失敗のときの扱い）は蒙恬の handoff-notes の4節を読む。一時の git のリポジトリで、当てた後の HEAD に枝が付くこと、同じ label でやり直したときの扱い、`--dry-run` で付けないこと。
3. 後処理の結線: 出力の偽物（`tests/build/` の作りにならう）で `--from postprocess --to postprocess` を流し、product.json の `commit` が無い・違うときに終了コード 1・`stoppedAt: postprocess` になること、一致すれば `productCommit.ok: true`。
4. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/`・`tasks/` だけ。`scripts/` は直さない（直しが要れば報告する）。
- 常設の clone `C:\b\vscode` に枝を付けるようなテストにしない（一時のリポジトリで）。

## 完了条件

- 1〜3 のテストがあり、4 の件数がある。

## 成果物

このディレクトリに `handoff-notes.md`。

## 結果

採用。`tests/build-env-branch.test.mjs`（29件。childEnv、枝 `builds/<label>`、後処理の結線）。run-all 1581 件、fail 0。実装の不具合なし。

## 未解決

なし

## 次の担当

ooka-echizen（大岡越前守）: 検証で走らせる。

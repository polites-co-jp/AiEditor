# テスト: notion-sync の翻訳の束（builtin-l10n）と、p1-launch-check の C:\b\p2

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

蒙恬が足した部品と変えた台本に、単体テストを付ける。

## 入力

- `tasks/2026-11-14-units-checks-revise/handoff-notes.md` の4節と「テストの入口（曹参へ）」（`extensions-src/notion-sync/builtin-l10n.mjs`、`build.mjs` の確かめ、`package.json` の `contributes.localizations`）
- `tasks/2026-11-14-p2-builds/handoff-notes.md` の「直した台本」（`scripts/p1-launch-check.ps1` の `-Dest` に `C:\b\p2` の下も許した）
- 既存の `tests/notion-sync.test.mjs`、`tests/cli-run.test.mjs`、`tests/p1-scripts.test.mjs`

## やること

1. `builtin-l10n.mjs` の単体テスト（入口のとおり。束の形、項目の形の確かめ、`path` が `dist/` の外のとき止める、自分の ID の項目が無いとき止める）。
2. `p1-launch-check.ps1`: `-Dest C:\b\p2\<x>` を受け付ける（引数の検査を通る。起動はしない形で）、`C:\b\p2` そのものと `C:\b\p3\<x>` は終了コード 2。既存の3件（`/outside C:\\b\\p1/i`）が新しい文に合うか。
3. 制約の網の案（`tasks/2026-11-14-units-checks-revise/` と `tasks/2026-11-14-p1-build-a1/` の提案）: `extensions-src/*/package.json` に `dependencies`・`optionalDependencies` が無いことのテスト。
4. `node tests/run-all.mjs --save <ファイル>` で件数を書く。

## 守ること

- 書き込みは `tests/`・`tasks/` だけ。台本と拡張は直さない（直しが要れば報告する）。
- 本物のエディタを起動しない。

## 完了条件

- 1〜3 のテストがあり、4 の件数がある。

## 成果物

このディレクトリに `handoff-notes.md`。

## 結果

採用。`tests/builtin-l10n.test.mjs`（19件）、`p1-scripts.test.mjs` に6件、`cli-run.test.mjs` に断言。run-all 1552 件、fail 0、skip 17。

## 未解決

なし

## 次の担当

ooka-echizen（大岡越前守）: 検証で走らせる。

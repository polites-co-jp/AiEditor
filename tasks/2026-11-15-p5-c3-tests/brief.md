# Phase 5 の下ごしらえ: C-3（リモート）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-3 の `edits.patch` を作った（`tasks/2026-11-15-p5-c3-patch/`）。C-1・C-2 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/03 の3節・4節（C-3 の行（2026-11-15 に直した）と末尾）・5.1（`after` の確かめ）・5.3・5.4・9節（Webview が `services/tunnel` を注入する）
- `docs/user-decisions.md` の 2026-11-15 の「C-3 の edits.patch を作るときに出た点」
- `removals/C-3-remote/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c3-patch/handoff-notes.md` の「テストの入口（曹参へ）」の1〜7
- C-1・C-2 のテストの形: `tests/c1-*.mjs`・`tests/c2-*.mjs`、`tests/removals/c1-gate-script.md`・`c2-gate-script.md`

## やること

1. **単位のファイルの静的な検査**（入口の5）: `tests/c3-unit.test.mjs`。edits.patch が触るのは `viewsExtensionPoint.ts` の1つだけ、ほかの単位の edits.patch とファイルが重ならない、`kept` に Claude Code の受け手の土台（`services/tunnel`・`services/remote`・`platform/remote`・`platform/tunnel`）がある、`removeLines` の行が本家にある、`productRemove` のキーが本家の product.json にある、`checks` の項目が本家にあって空振りしない、など。置いた定数の値が本家の `remoteExplorer.ts` の `VIEWLET_ID` と同じであること。
2. **壊した写しで落ちること**: `c2-mutation.test.mjs` の形。
3. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-1・C-3、b: A・B と C-1・C-2・C-3）の記録を照らす `tests/c3-check-json.mjs`、当てた後の木を照らす `tests/c3-check-worktree.mjs`（入口の6）、台本 `tests/removals/c3-gate-script.md`（入口の1〜4と7。`C-1` を外すと止まること＝入口の2を含む）。照らし役は `tests/` の直下に置く。実記録は `tasks/2026-11-15-p5-c3-patch/trial/` のものでテストする。
4. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`rm` が無いので、誤ってファイルを作らない。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜3のテストと照らし役・台本があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes.md`（足したテスト、件数、台本の入口、仕様と実装についての指摘）。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: C-2・C-3 の検証（パッケージ化の前まで）。

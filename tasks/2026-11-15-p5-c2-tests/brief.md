# Phase 5 の下ごしらえ: C-2（デバッガ）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-2 の `edits.patch` を作った（`tasks/2026-11-15-p5-c2-patch/`）。C-1 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/03 の3節・4節（C-2 の行と末尾）・5.1・5.3（2026-11-15 に足した2つの例外）・5.4・9節
- `docs/user-decisions.md` の 2026-11-14 の C-2 の項（案A）と 2026-11-15 の「C-2 の edits.patch を作るときに出た点」
- `removals/C-2-debug/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c2-patch/handoff-notes.md` の「テストの入口（曹参へ）」の1〜6
- C-1 のテストの形: `tests/c1-unit.test.mjs`・`c1-round2.test.mjs`・`c1-mutation.test.mjs`・`c1-check-json.mjs`・`c1-check-worktree.mjs`、`tests/removals/c1-gate-script.md`

## やること

1. **単位のファイルの静的な検査**（入口の4）: `tests/c2-unit.test.mjs`。C-1 の形にならう。edits.patch が `workbench.*.main.ts` で触るのは `workbench.common.main.ts` の1行の追加だけ、`extHost.api.impl.ts` の変更は3か所だけ、`removeLines` の行が本家にある、`delete` と `kept` が重ならない、`checks` の足した項目が本家にある、など。
2. **何もしない実装の検査**（入口の6）: `extHostRemovedApi.debug.ts` の本文を文字列と構文で確かめる。`startDebugging` が `false`、イベントが `Event.None`、`register*` が Disposable、`activeDebugConsole` が何もしないコンソール、提案中の2つの門が残る、通信・タイマー・RPC を持たない。
3. **壊した写しで落ちること**: `c1-mutation.test.mjs` の形で、主な検査が壊した写しで落ちることを確かめる。
4. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-2、b: A・B と C-1 と C-2）の記録を照らす `tests/c2-check-json.mjs`、当てた後の木を照らす `tests/c2-check-worktree.mjs`（入口の5）、台本 `tests/removals/c2-gate-script.md`（入口の1〜3と7）。照らし役は `tests/` の直下に置く（大岡越前守の許可 `node tests/*.mjs` に合わせる）。実記録は `tasks/2026-11-15-p5-c2-patch/trial/` のものでテストする。
5. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`rm` が無いので、誤ってファイルを作らない（作り直しの殻を残さない）。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜4のテストと照らし役・台本があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes.md`（足したテスト、件数、大岡越前守向けの台本の入口、仕様と実装についての指摘）。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: C-2 の検証（パッケージ化の前まで）。

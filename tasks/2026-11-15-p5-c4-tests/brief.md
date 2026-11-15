# Phase 5 の下ごしらえ: C-4（ノートブック）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-4 の `edits.patch` を作った（`tasks/2026-11-15-p5-c4-patch/`）。C-1〜C-3 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/03 の3節・4節（C-4 の行（2026-11-15 に直した）と末尾。全文検索はノートブックと結びついていて、検索は裁定で残す）・5.1（`after` の確かめ）・5.3（`extHost.api.impl.ts` の直し方。2026-11-15 に直した）・5.4・9節
- `docs/user-decisions.md` の 2026-11-15 の「C-4 の edits.patch を作るときに出た点」
- `removals/C-4-notebook/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c4-patch/handoff-notes.md` の「テストの入口（曹参へ）」の1〜9
- C-1〜C-3 のテストの形: `tests/c1-*.mjs`・`tests/c2-*.mjs`・`tests/c3-*.mjs`、`tests/removals/c*-gate-script.md`

## やること

1. **単位のファイルの静的な検査**（入口の5）: `tests/c4-unit.test.mjs`。edits.patch が main のファイル・`viewsExtensionPoint.ts`（C-3）に触れない、`extHost.protocol.ts` のハンクに ID の行が無い（`removeLines`）、ほかの単位の edits.patch と文脈が重ならない、`delete` と `kept` が重ならない、`kept` に `contrib/notebook/common`・`services/notebook` がある、`removeLines` と `checks` の項目が本家にあって空振りしない、など。
2. **何もしない実装の検査**（入口の7）: `extHostRemovedApi.notebook.ts` の本文を文字列・構文と、型を外して走らせる形（C-2 の `c2-unit.test.mjs` にならう）で確かめる。空の配列・`undefined`・`Event.None`・Disposable、`openNotebookDocument`・`showNotebookDocument` の reject、提案中の API の門が残る、通信・タイマー・RPC を持たない。
3. **検索の直しの検査**: edits.patch の検索のハンクが、ノートブックへの参照・注入・分岐を外すだけで、テキスト検索・置換・検索エディタの前後の行（`FileMatchImpl.createMatches` に足した1行）を壊していないことを、静的に確かめられる範囲で確かめる。
4. **壊した写しで落ちること**: `c2-mutation.test.mjs` の形。
5. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-1・C-2・C-4、b: A・B と C-1〜C-4）の記録を照らす `tests/c4-check-json.mjs`、当てた後の木を照らす `tests/c4-check-worktree.mjs`（入口の6）、台本 `tests/removals/c4-gate-script.md`（入口の1〜4・8・9。`after` の確かめを含む）。照らし役は `tests/` の直下に置く。実記録は `tasks/2026-11-15-p5-c4-patch/trial/` のものでテストする。
6. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`rm` が無いので、誤ってファイルを作らない。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜5のテストと照らし役・台本があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes.md`（足したテスト、件数、台本の入口、仕様と実装についての指摘）。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: C-2〜C-4 の検証（パッケージ化の前まで）。

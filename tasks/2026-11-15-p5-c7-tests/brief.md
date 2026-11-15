# Phase 5 の下ごしらえ: C-7（パンくずリストとアウトライン）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-7 の `edits.patch` を作った（`tasks/2026-11-15-p5-c7-patch/`）。C-1〜C-6 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/03 の3節・4節（C-7 の行（2026-11-15 に直した）と末尾）・5.1・5.3・5.4・9節（Claude Code は差分エディタ・エディタの枠を使う）
- docs/07 の8節（C-7 は関門を2回続けて通らなければ諮る）
- `docs/user-decisions.md` の 2026-11-15 の「C-7 の edits.patch を作るときに出た点」
- `removals/C-7-breadcrumbs-outline/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c7-patch/handoff-notes.md` の「テストの入口（曹参へ）」
- C-1〜C-6 のテストの形（期待は本家から読む形）

## やること

1. **単位のファイルの静的な検査**: `tests/c7-unit.test.mjs`。edits.patch が触るファイル（10）、エディタの枠のうち触るのは決まった4ファイルだけで、タブ・グループ・差分エディタ・Webview のファイルに触れない、ほかの単位の edits.patch と文脈が重ならない、`delete` と `kept` が重ならない、`checks` の項目が本家の `kept` でないファイルにあって空振りしない、など。
2. **注入の外し損ねの検査**: 当てた後に、消した部品（`IOutlineService`・`IBreadcrumbsService` など）を注入・呼び出す所が残っていないことを、照らし役か静的な検査で確かめる。期待は本家から読む。
3. **壊した写しで落ちること**: `c*-mutation.test.mjs` の形。
4. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-1・C-2・C-4・C-7、b: A・B と C-1〜C-7）の記録を照らす `tests/c7-check-json.mjs`、当てた後の木を照らす `tests/c7-check-worktree.mjs`、台本 `tests/removals/c7-gate-script.md`（関門の起動の確かめを含む。エディタのタブ・分割・差分エディタ・Claude Code の差分とパネルが崩れないこと）。照らし役は `tests/` の直下に置く。実記録は `trial/` のものでテストする。
5. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`C:\b\wt\p2` には触れない。`rm` が無いので、誤ってファイルを作らない。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜4のテストと照らし役・台本があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: C-1（6回目）・C-6・C-7 の検証。

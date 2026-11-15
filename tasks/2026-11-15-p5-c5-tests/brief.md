# Phase 5 の下ごしらえ: C-5（拡張のギャラリー）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-5 の `edits.patch` を作った（`tasks/2026-11-15-p5-c5-patch/`。2回目まで）。C-1〜C-4 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/01 の39・69行（拡張のインストールは CLI のみ。画面からの検索・追加は消す）、docs/04（`install-extensions.mjs` が CLI で VSIX を入れる）
- docs/03 の3節・4節（C-5 の行（2026-11-15 に直した）と末尾）・5.1・5.3・5.4・9節
- `docs/user-decisions.md` の 2026-11-15 の「C-5 の edits.patch を作るときに出た点」
- `removals/C-5-extension-gallery/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c5-patch/handoff-notes.md` の1回目と2回目の「テストの入口」
- C-1〜C-4 のテストの形: `tests/c1-*`〜`tests/c4-*`、`tests/removals/c*-gate-script.md`

## やること

1. **単位のファイルの静的な検査**: `tests/c5-unit.test.mjs`。edits.patch が触るファイル（11）、ほかの単位の edits.patch と文脈が重ならない、`delete` と `kept` が重ならない、`checks` の項目が本家の `kept` でないファイルにあって空振りしない（C-2 で足した見張りの形）、CLI の `--install-extension` の道（`platform/extensionManagement` の node 側・CLI）に触れない、など。
2. **何もしない実装の検査**: `NoopExtensionGalleryService` と、おすすめの何もしない実装の本文を、文字列・構文と、型を外して走らせる形で確かめる。`isEnabled()` が偽、通信（`IRequestService`・`fetch` など）を持たない、`getExtensions` などが誤りを投げずに空を返す。
3. **画面からの導入が消えたことの検査**: 2回目の入口のとおり（右クリックのメニュー、ドロップ、`ext install `）。内部のコマンド `installFromVSIX` の登録が残ること。
4. **壊した写しで落ちること**: `c*-mutation.test.mjs` の形。
5. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-1・C-5、b: A・B と C-1〜C-5）の記録を照らす `tests/c5-check-json.mjs`、当てた後の木を照らす `tests/c5-check-worktree.mjs`、台本 `tests/removals/c5-gate-script.md`（関門の起動の確かめを含む）。照らし役は `tests/` の直下に置く。実記録は `trial/` の2回目のもの（`checks-r2-*`・`build-typecheck-r2-*`）でテストする。
6. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`C:\b\wt\p2` には触れない（大岡越前守が検証で使う）。`rm` が無いので、誤ってファイルを作らない。
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

ooka-echizen（大岡越前守）: C-5 の検証（パッケージ化の前まで）。

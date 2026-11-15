# Phase 5 の下ごしらえ: C-6（設定の同期）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

蒙恬が C-6 の `edits.patch` を作った（`tasks/2026-11-15-p5-c6-patch/`）。C-1〜C-5 と同じ形で、単位のファイルの検査と、大岡越前守が走らせる照らし役と台本を書く。

## 入力

- docs/03 の3節・4節（C-6 の行（2026-11-15 に直した）と末尾。型検査に掛からない注入が2か所。続きの編集は残す裁定）・5.1・5.3・5.4・9節
- `docs/user-decisions.md` の 2026-11-15 の「続きの編集」の裁定と「C-6 の edits.patch と、C-4 のテストの直しで出た点」
- `removals/C-6-settings-sync/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c6-patch/handoff-notes.md` の「テストの入口（曹参へ）」
- C-1〜C-5 のテストの形（門や期待は本家から読む形。C-4 の2回目の直し）

## やること

1. **単位のファイルの静的な検査**: `tests/c6-unit.test.mjs`。edits.patch が触るファイル、ほかの単位の edits.patch と文脈が重ならない、`delete` と `kept` が重ならない、`checks` の項目が本家の `kept` でないファイルにあって空振りしない、プロファイル・設定・拡張の管理の部品を消さない、`contrib/editSessions` に触れない（裁定）、など。
2. **注入の外し損ねの検査**: 当てた後に、消した登録（`IUserDataSyncWorkbenchService` の実装など）を注入する所が、デスクトップで作られる部品に残っていないことを、照らし役か静的な検査で確かめる（`update.ts` は判断どおり例外）。期待は本家から読む。
3. **壊した写しで落ちること**: `c*-mutation.test.mjs` の形。
4. **照らし役と台本**: 当て直しの2つの組（a: A・B と C-1・C-6、b: A・B と C-1〜C-6）の記録を照らす `tests/c6-check-json.mjs`、当てた後の木を照らす `tests/c6-check-worktree.mjs`、台本 `tests/removals/c6-gate-script.md`（関門の起動の確かめを含む）。照らし役は `tests/` の直下に置く。
5. `node tests/run-all.mjs --save <ファイル>` の件数。C-1 の門の抜けの2本は、蒙恬が直すまで落ちたままでよい（そう書く）。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`C:\b\wt\p2` には触れない。`rm` が無いので、誤ってファイルを作らない。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜4のテストと照らし役・台本があり、`run-all` の fail が C-1 の既知の2本だけ（C-1 が直った後は 0）。

## 成果物

このディレクトリに `handoff-notes.md`。

## 結果

採用。`tests/c6-*`、照らし役、台本 `tests/removals/c6-gate-script.md`。大岡越前守の検証で「パッケージ化の前まで」合格（`tasks/2026-11-15-p5-c1-c6-c7-verify/verification-ooka.md`）。`enabled` は `false` のまま。

## 未解決

- ビルド（パッケージ化）・起動・関門は、古い版の片づけの許可の後。
- 検証役が自分で走らせていない組、ロックファイルの作り直し、`git apply --check` は、許可の追加（`tasks/2026-11-15-permission-requests/requests.md` の2）か関門のビルドで確かめる。
- 軽微な指摘: `c6-check-json.mjs` が20単位の組だけを前提にする。

## 次の担当

ooka-echizen（大岡越前守）: C-6 の検証。

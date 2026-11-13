# Phase 1 の検証（1）: スモークの台本と、環境の確かめ・作業ツリーの用意の台本

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ビルドの前にできた3つの成果を確かめ、合否を出す。合格したものからコミットする。

## 入力

- 曹参: `tasks/2026-11-13-p1-smoke/`（smoke-design.md、manual-checks.md、handoff-notes.md）、台本 `tests/smoke-run.mjs`・`tests/smoke-launch.mjs`・`tests/smoke-stop.mjs`・`tests/smoke/`、単体テスト `tests/smoke.test.mjs`、実行の記録 `C:\b\smoke\runs\`・`C:\b\smoke\baseline-official-1.146.0.json`
- 蒙恬: `tasks/2026-11-13-p1-build-upstream/`（env-check.md、build-log.md、handoff-notes.md の追記、prepare.json）、台本 `scripts/check-env.ps1`・`scripts/prepare.mjs`、`upstream.json`、作業ツリー `C:\b\wt\1.146.0`
- docs/06 の5節（スモークの組。2026-11-13 にリーダーが直した: 信頼は手、`.lock` は1個以上、本家の `test/smoke` は使わない、基準は3回の和）、docs/03 の7節、docs/02 の4節の1・5節、docs/07 の4節
- docs/user-decisions.md の末尾の2節（計測をやめる、通信の扱いの訂正）

## やること

1. 曹参の台本のレビュー。
   - 書き込み先が `C:\b\smoke\` に限られているか。
   - 普段使いのデータに触れないか。`VSCODE_PORTABLE` を使い、子の環境変数を外しているか。
   - 起動した PID の木だけを止めるか。
   - 普段使いの `~/.claude/ide/*.lock` を消さないか。
   - 試験専用の拡張（`tests/smoke/probe/`）が何をするか。
   - docs/06 の5節の「自」の項目を覆っているか。
2. 曹参の単体テストを走らせる（46件と申告）。公式の zip（`C:\b\p0\vscode-1.146.0\`）に向けて `tests/smoke-run.mjs` を1回走らせ、申告（落ちた項目 0）と合うかを見る。
3. 蒙恬の台本のレビュー。
   - `check-env.ps1` が読むだけか。版の判定が正しいか。
   - `prepare.mjs` が clone・fetch・worktree の範囲だけを行い、commit を照合しているか。
   - `upstream.json` の値。
   - `C:\b\wt\1.146.0` の HEAD が `69047191fc427f2f92828279aae1d90d8eeda7ab` で、変更が無いか。
   - `check-env.ps1` を走らせ、結果が env-check.md と合うか（ユーザーが道具を入れている途中なら、その時点の値でよい）。
4. 曹参が挙げた未決の点（揺れる誤り、.env の補完の期待、`C:\b\smoke\runs\` の容量）について、意見があれば書く。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 別の曹参（タスク `2026-11-13-p0-netaudit-hostnames`）が並行して `scripts/netaudit.ps1` と `tests/probe-*.ps1` を直している。それには触れない（レビューの対象外）。
- `C:\b\wt\1.146.0` で依存の導入やビルドを走らせない（ユーザーの道具の導入を待っている）。

## 完了条件

- 1〜3 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

蒙恬の台本は合格、曹参のスモークの台本は不合格（A〜E）で差し戻し。直しは検証（2）で合格。

## 未解決

なし

## 次の担当

合格なら、リーダーがコミットする。ビルドができたら、同じ台本をビルドに向ける。

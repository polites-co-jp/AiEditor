# Phase 0 の検証（4）: useBundled の反映、basedpyright の調べの台本、推定の役割の印（C-1）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

0-4（本家の基準値）の本番の前に、計測の条件に関わる変更を確かめて合否を出す。

## 入力

- 裁定: docs/user-decisions.md の「basedpyright が Python 拡張なしで起動しない件」（mydist の既定に `basedpyright.importStrategy: "useBundled"`、計測は本家と自作の両方に同じ値）
- 蒙恬: `tasks/2026-11-13-p0-basedpyright-probe/`（basedpyright-probe.md、handoff-notes.md）、`extensions-src/mydist/`、`scripts/lib/p0-common.ps1`、`scripts/p0-env.ps1`、新しい台本 `scripts/p0-openvsx-meta.mjs`・`scripts/p0-lsp-probe.mjs`、作り直した環境 `C:\b\p0\data\upstream-default\`・`testbed-measure\`
- 曹参: `tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md` の「追記: C-1 と試しのデータの扱い」、`scripts/measure.ps1`・`scripts/netaudit.ps1`、`tests/measure.tests.ps1`、trial/out-real5/
- 前の検証: `tasks/2026-11-13-p0-verify-measure-rework/`

## やること

1. 蒙恬: mydist と計測の2つの環境の設定が裁定のとおりか。bp-probe-a〜d が `-All` から外れたか。新しい台本2本のレビュー（書き込み先、普段使いのデータ・秘密に触れないか、JS の中身を読む作りになっていないか）。調べの出典が結論を支えるか。
2. 曹参: C-1（`RoleSource` 列）、`-CleanStale` が実行中のプロセスのフォルダを消さないか・`-WorkRoot` の外を消さないか、テストを走らせる（`tests/measure.tests.ps1` 125件と申告。ほかの3本も）。
3. `upstream-default` と `tmp\ws` で measure.ps1 を1回だけ短く走らせ、TS（tsserver）と Python（basedpyright）の両方の言語サーバーのプロセスが出ること、`roles.csv` に `RoleSource` があること、回のデータが残らないことを確かめる。
4. 合格なら、0-4 の本番の手順（コマンド、回数、節目の計測の一時停止でユーザーがすること、所要時間の見込み）を `p0-baseline-plan.md` に書く。docs/07 の2.5 では、本家（upstream-default）を5回（捨てる1回は別）、参考に試験台（testbed-measure）を5回。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- ユーザーが手の確かめ中なので、upstream-default 以外の環境は起動しない。`p0-stop.ps1` を使わない。
- 本番の5回の計測と10分の監査はまだ行わない。

## 完了条件

- 1〜3 に合否と理由がある。合格なら 4 がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`p0-baseline-plan.md`（合格のとき）、`handoff-notes.md`（報告）

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

合格なら、リーダーがユーザーと 0-4 の本番の日取りを決める。

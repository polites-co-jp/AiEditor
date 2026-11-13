# Phase 1 の検証（2）: スモークの台本の差し戻しの直しと、監査の台本の軽微な直し

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

検証（1）で不合格にしたスモークの台本の直し（A〜E と軽微な点、追加の F）と、監査の台本の軽微な3点の直しを確かめ、合否を出す。

## 入力

- 前の検証: `tasks/2026-11-13-p1-verify-smoke-prepare/`（handoff-notes.md、verification-log.md）、`tasks/2026-11-13-p0-network-inventory/verification-log.md` の1.6
- 曹参（スモーク）: `tasks/2026-11-13-p1-smoke/handoff-notes.md` の「差し戻しへの対応」と「合図後の実行の結果」、`tests/smoke-*.mjs`、`tests/smoke/`、`tests/smoke.test.mjs`、`C:\b\smoke\baseline-official-1.146.0.json`、`C:\b\smoke\runs\`
- 曹参（監査）: `tasks/2026-11-13-p0-netaudit-hostnames/handoff-notes.md` の最後の追記、`scripts/netaudit.ps1`、`tests/netaudit.tests.ps1`、`tests/measure.tests.ps1`
- docs/06 の5節（今日、`--prime` と基準の作り方を足した）

## やること

1. スモーク: A〜E と F の直しを読んで確かめる。特に次の3点を見る。
   - 置換の確かめが、別のファイルを書き換えない形になったか（実機で一度、`docs/readme.md` を空に置換した事故があった）。
   - `Get-CimInstance` の JSON の文字コードの直し。
   - `--keep-runs` が `runs\` の下だけを消すか。
2. スモーク: 単体テスト（60件と申告）を走らせる。公式の zip に向けて `--prime --baseline C:/b/smoke/baseline-official-1.146.0.json` で1回走らせ、FAIL 0 と、`probe-result.json` が `done:true` で残ることを見る。
3. 監査: 軽微な3点の直しを読み、テスト（netaudit 102件、measure 138件と申告）を走らせる。エディタを起動する監査の試しは要らない。
4. 普段使いのデータ、普段使いの `~/.claude/ide/*.lock` に触れていないことを、台本の結果で確かめる。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 蒙恬が並行して `extensions.lock.json` と `extensions-src/mydist/` を直している。スモークは今ある `C:\b\smoke\ext\` の拡張で走らせ、台帳から入れ直さない。
- `tests/probe-*.ps1`（調べ用の使い捨て）は対象外。走らせない。

## 完了条件

- 1〜4 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

合格なら、リーダーがコミットする。

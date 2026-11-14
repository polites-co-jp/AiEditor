# Phase 2 の締め: B の5単位の有効化と、全部を有効にした版のビルド

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

段階 A・B の14単位が関門に合格した（`tasks/2026-11-14-p2-regate-a/`、`tasks/2026-11-15-p2-gates-b-r2/`）。docs/07 の5節の4のために、`enabled: true` の単位だけで作る「本番の形」の版を作る（`--only` を使わない）。

## やること

1. `removals/B-1-telemetry`・`B-2-onboarding-experiments-surveys`・`B-3-issue-share`・`B-4-outline-view`・`B-7-terminal-suggest` の `unit.json` を `enabled: true` にする（`enabled` の1行だけ）。これで14単位がすべて有効になる。C の単位は無効のまま。
2. 全部を有効にした版をビルドする（label 例 `1.146.0-p2-all`）。`apply.mjs` も `build.mjs` も、単位の名指し（`--only`）をせず、有効な単位の組で当てる。上書き・patches・assets・mydist・notion-sync も当てる。zip を `C:\b\dist\` に置く。
3. `p1-launch-check.ps1 -Zip ... -Dest C:/b/p2/1.146.0-p2-all` で展開と1回の起動を確かめる。
4. 記録: `apply.mjs` の `checks.json`（当てた単位が14、検査の結果）、`build-record.json`（手順ごとの秒・ディスク・zip の SHA-256・commit・枝）、`-r2` の B-7 の版との違い（当てた単位が同じなら、ソースの差が無いこと。commit は違ってよい）。
5. C: の空きを記録する（今は約 28 GB）。15 GB を切りそうなら止めて報告する。

## 守ること

- 書き込みは `removals/`（B の5単位の `enabled` だけ）・`scripts/`（直しが要るときだけ。要るなら先に報告）・`tasks/`・`C:\b\` だけ。
- 既存の版の zip と展開した場所を消さない。普段使いのエディタのデータに触れない。

## 完了条件

- 1 の有効化と、2〜4 の版と記録がある。

## 成果物

このディレクトリに `handoff-notes.md`（展開した場所、zip、SHA-256、commit を含む）、`build-log.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 全部の組のスモークと通信の監査（`tasks/2026-11-15-p2-all-verify/`）。

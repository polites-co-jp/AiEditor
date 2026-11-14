# Phase 2 の締めの検証: 全部を有効にした版で、スモークの全部の組と通信の監査

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

docs/07 の5節の4と完了の条件。段階 A・B の14単位を `enabled: true` にした版（`tasks/2026-11-15-p2-all-build/`）で、スモークの全部の組（docs/06 の5節）と通信の監査（docs/07 の3.3）を通す。そのあとユーザーに渡して、手の項目を見てもらう。

## 入力

- `tasks/2026-11-15-p2-all-build/handoff-notes.md`（展開した場所、zip、SHA-256、commit、`checks.json`）
- docs/06 の5節（スモークの組。自と手）、`tasks/2026-11-13-p1-smoke/manual-checks.md`（手の項目）、docs/07 の3.3（通信の監査）、`records/network-allowlist.json`
- 比べる相手: `-r2` の B-7 の版の関門（`records/take-in/1.146.0-p2-B-7-r2/`）、公式の基準
- `docs/user-decisions.md`（基準は3回の和。通信は Claude・git のリモート・Notion だけを許す）

## やること

1. **当てたもの**: `checks.json` で、14単位が当たり、C の単位が当たっていない。B-7-r2 の版とソースの差が無い（あれば理由）。
2. **スモークの全部の組**: `smoke-run.mjs` で、自動の全部の組を走らせる。基準は docs/06 の5節のとおり3回の和で作る（`--prime --save-baseline` と `--merge-baseline` 2回）。前の版（B-7-r2）や公式の基準に無い誤りが無いこと。
3. **消えている**: 14単位の checks を全部 `--expect absent` で流す（fail 0）。
4. **通信の監査**: 起動してしばらく使ったときの外向きの宛先が、許した宛先（`records/network-allowlist.json`）だけであること。残るものは理由つきで書く。Claude の宛先は、ユーザーの手の項目の回で確定させる（裁定 2026-11-13）ので、今回は Claude のパネルからの送信をしない。
5. **記録**: `records/phase2/` に、Phase 2 の結び（14単位の関門の一覧と記録の場所、全部の版のスモーク・監査の結果、残る点）を書く。ユーザーに渡す手の項目の一覧（`manual-checks.md` のうち、この版で見るもの。どこを開いて何を確かめるか）を `records/phase2/manual-checks-p2-all.md` に書く。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・`C:\b\smoke\` だけ。
- 普段使いのエディタのデータに触れない。PC の設定を変えない。Claude Code のパネルから本物の送信はしない。

## 完了条件

- 1〜5 に合否と理由がある。

## 成果物

- `records/phase2/`（結びと、手の項目の一覧）
- このディレクトリに `verification-log.md`、`handoff-notes.md`

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: ユーザーに手の項目を頼む。通れば Phase 2 を閉じ、Phase 5（段階 C）へ。

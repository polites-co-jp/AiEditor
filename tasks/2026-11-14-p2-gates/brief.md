# Phase 2: 版ごとの関門（A-1〜B-7）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

docs/07 の5節の3。蒙恬が作る版（`tasks/2026-11-14-p2-builds/builds.md`。土台は A-1 を当てた版を兼ねる）ごとに、docs/03 の7節の関門を確かめる。合格した単位は蒙恬が `enabled: true` にする。

## 入力

- `tasks/2026-11-14-p2-builds/builds.md`（版・当てた単位・zip・SHA-256・commit）と版ごとの記録（`<label>/checks.json`・`build-record.json`）、ログ `C:\b\logs\<label>\`
- docs/03 の6節（検査）・7節（関門）、docs/06 の5節（スモークの組）、docs/07 の3.3（通信の監査）
- `removals/<id>/unit.json` の `checks`（`absentCommands`・`absentViews`・`absentSettings`・`absentProcesses`・`absentHosts`・`absentStrings`）と `smoke`
- 台本: `tests/smoke-run.mjs`、`tests/removals/run-absent.mjs`（消えているの検査）、通信の監査の台本（`netaudit.ps1`）とその README
- 前の版の結果（比べる相手）。最初の版（`1.146.0-p2-A-1`）は、公式の zip の基準（`C:\b\smoke\baseline-official-1.146.0.json`）と Phase 1 のスモーク（`tasks/2026-11-14-verify-commit-fix/` の結果）と比べる

## やること（版ごと。builds.md の上から順に）

1. **当たる**: `checks.json` の当てた結果と検査（`absentStrings` の残り 0 など）。
2. **型検査とビルド**: `build-record.json` の手順がすべて ok で、product.json の `commit` が作業ツリーの HEAD と一致すること。
3. **消えている**: zip を展開したものを起動し、足した単位の `absentCommands`・`absentViews`・`absentSettings`・`absentProcesses` を `run-absent.mjs` で確かめる。`absentHosts` は通信の監査で、その宛先への接続が無いことを確かめる（監査の台本に要る権限が無ければ、何が要るかを書いて、その項目は判定できないとする）。
4. **壊れていない**: 単位の `smoke` の組でスモークを走らせる。前の版に無かった誤りが出ないこと。Claude Code の組は必ず通す。
5. 結果を `records/take-in/<label>/gate-<id>.md` に書き、`handoff-notes.md` の版ごとの表（版・単位・1〜4 の合否・理由）に1行足す。
6. 次の版が `builds.md` にまだ無ければ、そこで止めて報告する（リーダーが改めて依頼する）。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・`C:\b\smoke\` などの検証の置き場所だけ。
- gulp の出力 `C:\b\wt\VSCode-win32-x64\` は蒙恬が上書きしているので使わない。zip を展開したものを使う。
- 普段使いのエディタのデータに触れない。PC の設定を変えない。Claude Code のパネルから本物の送信はしない。
- スモークは同時に2つ走らせない。

## 完了条件

- builds.md にある版のそれぞれに、1〜4 の合否と理由がある。

## 成果物

- `records/take-in/<label>/gate-<id>.md`
- このディレクトリに `handoff-notes.md`（版ごとの表）、`verification-log.md`

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

蒙恬: 合格した単位を `enabled: true` にする。リーダー: 全部の版の後、全部を有効にした版でスモークの全部の組と通信の監査、ユーザーの手の項目へ。

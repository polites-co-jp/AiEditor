# Phase 1 で足した台本のテスト: disk-usage・p1-launch-check・p1-ci-events・check-env の smartAppControl

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

蒙恬が Phase 1 の再開で足した台本に、単体テストを付ける。検証は大岡越前守が並行して行う（`tasks/2026-11-14-p1-verify-partial/`）。

## 入力

- `tasks/2026-11-13-p1-build-upstream/handoff-notes.md` の「テストの入口（曹参へ）」（入出力・終了コード・関数の仕様）
- `scripts/disk-usage.mjs`、`scripts/p1-launch-check.ps1`、`scripts/p1-ci-events.ps1`、`scripts/check-env.ps1`
- 既存のテストの形: `tests/run-all.mjs` と既存の `tests/*.test.mjs`（PowerShell の台本を子のプロセスで走らせる形を含む）

## やること

1. `disk-usage.mjs`: `parseArgs`・`expandEnv`・`countDir` の単体テスト（hard link を2つ置いた場所で `bytes` 2倍・`uniqueBytes` 1倍・`hardlinkedFiles` 2、シンボリックリンクとジャンクションをたどらない、引数の誤りで終了コード 2）。一時フォルダで作る。
2. `p1-launch-check.ps1`: 引数の誤りで断る（`-Zip` と `-Root` の両方・どちらも無し、`-Root` が `C:\b\` の外、`-Dest` が `C:\b\p1\` の外 → 2）。実際の起動はしない。
3. `p1-ci-events.ps1`: 出力の JSON の形（`readable`・`count`・`events`）と終了コード 0。
4. `check-env.ps1`: 出力に `smartAppControl` があり、`meaning` が off/on/evaluation/unknown のどれかで、`missing` に入らないこと。
5. `node tests/run-all.mjs` を走らせ、件数（fail 0）を記録する。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。台本は直さない（直しが要れば報告する）。
- 本物のエディタを起動しない。PC の設定を変えない。普段使いのエディタのデータに触れない。

## 完了条件

- 1〜4 のテストがあり、5 の結果がある。

## 成果物

- `tests/` のテスト
- このディレクトリに `handoff-notes.md`（報告。足したテストの一覧と件数）

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 検証で走らせる。

# 直し: C: に書く残りと、取り込みの記録の置き場所の守り

- 担当: meng-tian（蒙恬）。テストは cao-shen（曹参）
- 依頼日: 2026-11-16
- 状態: 完了

## 目的

判断の記録（`docs/user-decisions.md` の「C:\b を消す前の確かめで出た点」「Team の返答で課に求められた点」）で、関門の後にまとめると決めた3つの直し。

## やること（蒙恬）

1. **`extensions-src/notion-sync/dev/trial.mts`**: 既定の置き場所 `C:\b\notion-sync-trial` を、`<buildRoot>` か `tmp/` の下（例 `<buildRoot>\notion-sync-trial`）にする。C:\b を消した後に走らせても C: を作らないこと。
2. **`scripts/check-env.ps1`**: 本物の環境で起こす `pnpm --version`・`npm --version` などが C: のキャッシュ（`%LOCALAPPDATA%\pnpm-cache`・`npm-cache`）に書かないよう、子の環境のキャッシュの向け先を `<buildRoot>` の下にする（`build-env.mjs` と同じ向け先）。
3. **`scripts/take-in.mjs` の `--records-dir`**（Team の R22）: 記録の置き場所が `records/take-in/` の外を指したら止める（判定役の狄仁傑は `records/take-in/` しか読めない）。
4. 自己確認は許可にある `node --test tests/<名前>.test.mjs` で。

## やること（曹参）

1〜3 のテスト（既定の置き場所が C: でない、子の環境の向け先、`--records-dir` が外を指すと止まる）。`node --test` で関係するファイルを走らせ、件数を書く。

## 守ること

- 書き込みは、蒙恬が `scripts/`・`extensions-src/`（test/ を除く）・`tasks/`、曹参が `tests/`・`extensions-src/*/test/`・`tasks/`。
- C:\b と普段使いのデータに触れない。

## 完了条件

- 1〜3 の直しとテストがあり、関係するテストが通る。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`・`handoff-notes-cao-shen.md`。

## 結果

採用。notion-sync の試しの既定の置き場所を `<buildRoot>` の下にし、消さずに `run-*` を足す形にした。`check-env.ps1` は子のキャッシュと TEMP を `<buildRoot>` の下へ向ける。`take-in.mjs` は `--records-dir` が `records/take-in/` の外なら止める。大岡越前守の検証で合格（3d0ffc6）。テストの追加12件も合格（small-fixes 30/30）。

## 未解決

なし

## 次の担当

ooka-echizen（大岡越前守）: 検証。

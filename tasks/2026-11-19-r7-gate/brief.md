# r7（改名の後の版）の関門

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-19
- 状態: 完了

## 目的

改名（Shuko → Sukuna）を入れた版 `1.146.0-p5-c-all-r7` を、日常の利用へ移してよいかの合否を出す（`tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の4節の順5）。合格したら、権限の段1が入った後に移行（順6）へ進む。

## 入力

- 蒙恬のビルドの記録 `tasks/2026-11-19-r7-build/build-notes-r7.md`（「関門で見てほしい点」1〜6）と、同じフォルダの記録
- zip: `tmp\b\dist\1.146.0-p5-c-all-r7.zip`（SHA-256 `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`）。作業ツリー `tmp\b\wt\r7\w`
- 前の版 r6 の関門の記録（`records/take-in/1.146.0-p5-c-all-r6/`）。同じ項目を同じ形で見る
- 改名の検証 `tasks/2026-11-18-rename-sukuna-verify/verification-rename-sukuna.md`

## 完了条件

- r6 の関門と同じ項目を見た: 適用後の検査（`checks.json` を `tests/c*-check-json.mjs` に渡す。新しい作者で通ること）、スモーク、外向き通信の監査（`netaudit.ps1`。宛先が r6 と変わらないこと）、日本語の数え（除外の外の未訳 0）、起動の確かめ。
- 起動はすべてポータブルの形で行い、`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna` を作らない（作ると移行の台本が止まる）。前後で無いことを確かめて記録する。
- `tests/l10n-audit-more.test.mjs` の実物のテストは、`AIED_AUDIT_WT=<repo>\tmp\b\wt\r7\w` を渡して走らせる。
- スモークの台本が、実行ファイル・CLI・データの場所を版の product.json から求めているか（`Sukuna.exe`・`sukuna.cmd`）を見た。
- 版の中に `shuko` が残っていないこと（蒙恬の zip の調べ `zip-check-r7.json`）を確かめた。
- 合否と根拠を r6 と同じ置き場所の形で records/ に残した。

## 成果物

- `records/take-in/1.146.0-p5-c-all-r7/` の関門の記録（r6 と同じ形）
- このディレクトリに `gate-r7-notes.md`（見た項目・結果・指摘・移行の前に気をつける点）

## 結果

合格（2026-11-19）。正本は `records/take-in/1.146.0-p5-c-all-r7/gate-p5-c-all-r7.md`。日本語の網は未訳 0、適用後の検査14本は期待どおり、スモークは3回とも PASS 49 / FAIL 0、通信の監査は r6 と同じ宛先、起動の確かめは前後とも ok で Sukuna のデータの場所は作っていない、版の中に shuko は 0、run-all は落ちが既知の1件だけ。`AIED_AUDIT_WT` を付けた実物のテストは許可で打てなかったので、同じ入力を CLI に当てて代えた。

## 未解決

T1・T2（曹参のテスト）は移行の前に直す（`tasks/2026-11-19-gate-r7-test-fixes/`）。T3 は日常の Sukuna が動き始めたら前と同じ形で落ちる（既知）。M1（実行ファイルの版の情報の UTF-16 を見ていない）は移行の後の手の確かめ U6 で見る。P1（Sukuna の場所を大岡越前守が読めない）は許可を足さず、移行の確かめでリーダーが `ls` で有無と名前を見て記録に渡す。K1（`vlad-tepes.md`）は Team の開発部に依頼済み。3.3の手順1（今の値の控え）は改名のコミットの前にリーダーが済ませた（`tasks/2026-11-18-rename-sukuna-impl/brief.md` の結果）。

## 次の担当

合格なら、権限の段1が入った後に移行（蒙恬が展開と移行の台本、ユーザーが Shuko を閉じる・スタートメニュー・PATH）。

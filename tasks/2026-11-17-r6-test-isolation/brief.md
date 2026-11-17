# configure と move-off-c のテストを本物の置き場所から切り離す（T3）

- 担当: cao-shen（曹参）。検証は ooka-echizen（大岡越前守）
- 依頼日: 2026-11-17
- 状態: 依頼中

## 目的

`tests/configure.test.mjs` の1件と `tests/move-off-c.test.mjs` の1件は、日常の Shuko を使っている間の run-all で必ず落ちる。ファイルの無い一時の `local.json` で `configure.ps1` を走らせるため、前の `installRoot` が本物の `%LOCALAPPDATA%\Programs\Shuko` になる。そこで動いているエディタを `configure.ps1` が見つけ、`editor-running` で止まるのが原因。テストが本物の置き場所に頼らないようにする。

## 入力

- 切り分け: `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6-addendum.md`、`tasks/2026-11-17-r6-gate/handoff-notes-ooka-echizen.md` の5節
- 結果: `tasks/2026-11-17-r6-gate/run-all-r6.txt`
- 対象: `tests/configure.test.mjs` の187〜193行あたり、`tests/move-off-c.test.mjs` の該当の件。仕組みは `scripts/configure.ps1` の282〜289行

## やること

- 2つのテストが、一時の `local.json` に一時の場所の `installRoot` を先に書いてから走る形にする（大岡越前守の案）。テストが確かめたいこと（`%NAME%` を展開しない、PowerShell 側の既定が同じ）は変えない。
- 本物の `%LOCALAPPDATA%\Programs\Shuko` を読まず、書かないことを確かめる。

## 決まり

- `scripts/` は直さない。テストだけを直す。直すべきなのがスクリプトの方だと分かったら、直さずに報告する。
- 日常の Shuko は閉じない。動いたままで2つのテストが通ることを確かめる。
- `tmp/` の下を広く探さない。

## 完了条件

- 日常の Shuko が動いている状態で `tests/configure.test.mjs` と `tests/move-off-c.test.mjs` がすべて通る。
- 大岡越前守の検証に合格する。

## 成果物

- 直したテスト
- このディレクトリに `handoff-notes-cao-shen.md`（直した所、走らせたテストと結果）

## 結果

（リーダーが記入）

## 未解決

（リーダーが記入）

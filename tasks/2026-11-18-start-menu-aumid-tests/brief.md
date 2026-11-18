# スタートメニューのショートカットの台本のテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-18
- 状態: 依頼中

## 目的

蒙恬が並行して作る `scripts/start-menu-shortcut.ps1`（スタートメニューの Shuko のショートカットに AppUserModelID を付ける台本）と、`scripts/configure.ps1` の向け直しが ID を残すことを、テストで確かめる。背景と裁定は `tasks/2026-11-18-start-menu-aumid/brief.md` と `docs/user-decisions.md` の「裁定（2026-11-18、タスクバーの右クリックの「New Window」）」。

## 入力

- 台本の仕様: `tasks/2026-11-18-start-menu-aumid/brief.md` の「やること」の2と3（引数 `-InstallRoot`・`-ShortcutPath`・`-AppUserModelId`・`-Read`、出力の3行、止まる条件）
- 今の向け直し: `scripts/configure.ps1` の 5、今のテスト `tests/configure.test.mjs`（T3 で本物の installRoot から切り離した）

## やること

1. `tests/start-menu-shortcut.test.mjs`（`node --test`）を書く。模擬の installRoot（`current\Shuko.exe` の空のファイルと `current\resources\app\product.json`）と一時の .lnk を使う。
   - 指す先が `<root>\current\Shuko.exe`、作業フォルダが `<root>\current`、`System.AppUserModel.ID` が product.json の `win32AppUserModelId` になる
   - `-AppUserModelId` を渡すとその値になる。product.json が無いときは `product.overlay.json` の値になる
   - `-Read` は書かない（ファイルの時刻と中身が変わらない）
   - `current\Shuko.exe` が無ければ .lnk を作らずに 0 以外で終わる
   - 既にある同じ名前の .lnk を上書きし、同じフォルダのほかの .lnk に触れない
2. ID の読み取りは、台本の `-Read` に頼らず、テストの側の独立の読み手で行う（例: `Shell.Application` の `ExtendedProperty('System.AppUserModel.ID')`、または IPropertyStore）。
3. `configure.ps1` の向け直しの後も ID が残ることのテストを足す。向け直しは `[Environment]::GetFolderPath('Programs')` を見るので、**本物のスタートメニューに書かずに試せる形が無ければ、テストを書かずにその旨を報告する**（台本の作りを変えるのは蒙恬の仕事）。

## 決まり

- 本物のスタートメニュー・デスクトップ・`%LOCALAPPDATA%\Programs\Shuko` に書かない。一時のものは `tmp/` の下か OS の一時フォルダに作り、終わったら消す。
- 台本がまだ無い間は仕様から書き、揃ってから走らせる。台本の作りと仕様が食い違えば、どちらが仕様どおりかを報告に書く。

## 完了条件

- 上の1・2のテストがあり、蒙恬の台本に対して通る
- 3 のテストがある、または書けない理由が報告にある

## 成果物

このディレクトリに保存する。

- `tests/start-menu-shortcut.test.mjs`（と、足したなら configure のテスト）
- `handoff-notes-cao-shen.md`（走らせたコマンドと結果、仕様との食い違い）

## 結果

（未記入）

## 未解決

なし

## 次の担当

大岡越前守（検証）

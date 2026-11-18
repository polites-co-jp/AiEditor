# スタートメニューのショートカットに AppUserModelID を付ける台本

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-18
- 状態: 依頼中

## 目的

ユーザーの依頼「タスクバー上の右クリックメニューに、新しいウィンドウを開く選択肢を追加してほしい」に応える。

見立て: 上流のジャンプリストの「New Window」（`-n`）は Shuko に残っている（`platform/workspaces/electron-main/workspacesHistoryMainService.ts`。C-1 で外したのは「Agents Window」だけ）。main.log にジャンプリストの誤りは無い。Shuko の窓は明示の AppUserModelID `Shuko.Editor` を名乗るが、同じ ID を持つショートカットがスタートメニューに無いので、Windows がジャンプリストを出さない。今、スタートメニューにもデスクトップにも Shuko のショートカットは無い。

裁定（`docs/user-decisions.md` の「裁定（2026-11-18、タスクバーの右クリックの「New Window」）」）: 本体にパッチを当てず、ID 付きのスタートメニューのショートカットを作る台本を用意する。実行するのはユーザー。

## 入力

- 裁定: 上の節
- 今の作り方: `docs/install.md` の 3.1（WScript.Shell で作る。ID を付けていない）
- ID の値: `product.overlay.json` の `win32AppUserModelId`（`Shuko.Editor`）、入った版の `<installRoot>\current\resources\app\product.json`
- 向け直し: `scripts/configure.ps1` の 5（334〜354 行あたり。WScript.Shell で開いて `Save()` する）
- 上流のジャンプリスト: 作業ツリー `tmp/b/wt/` の中の `src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts`（見立ての裏付けに読む。直さない）

## やること

1. 見立てを裏付ける。上流のコードで「New Window」のタスクが今もジャンプリストに入ること、Shuko のどの削除の単位もそれを外していないことを確かめる。食い違えば手を止めて報告する。
2. `scripts/start-menu-shortcut.ps1` を作る。Windows PowerShell 5.1（`powershell.exe`）で動くこと。通信しない。
   - 引数: `-InstallRoot`（既定は `local.json` の `installRoot`、無ければ `%LOCALAPPDATA%\Programs\Shuko`）、`-ShortcutPath`（既定は `[Environment]::GetFolderPath('Programs')` の直下の `Shuko.lnk`）、`-AppUserModelId`（既定は `<InstallRoot>\current\resources\app\product.json` の `win32AppUserModelId`。読めなければ `product.overlay.json` の値）、`-Read`（書かずに、指したショートカットの3つの値を出すだけ）。
   - 作る中身: 指す先 `<InstallRoot>\current\Shuko.exe`、作業フォルダ `<InstallRoot>\current`、プロパティ `System.AppUserModel.ID`（PKEY `{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5`）。`versions\<版>` を直に指さない。
   - 作った後に読み直し、`TargetPath=`・`WorkingDirectory=`・`AppUserModelId=` の3行を出す。期待と違えば 0 以外で終わる。`current\Shuko.exe` が無ければ書かずに止める。
   - 既に同じ名前の .lnk があれば上書きしてよい。ほかの .lnk には触れない。
3. `scripts/configure.ps1` の向け直し（5）が、ショートカットの `System.AppUserModel.ID` を残すかを確かめる。消えるなら、向け直しの後に元の ID を付け直すよう直す（取り消し `Invoke-Undo` の側も同じ）。
4. 確かめは `tmp/` の下の一時の .lnk と模擬の installRoot で行う。**本物のスタートメニュー・デスクトップ・`%LOCALAPPDATA%\Programs\Shuko` に書かない**（スタートメニューの初めの設定はユーザーが行う裁定）。
5. `docs/install.md` の 3.1 の差し替え案（ユーザーが打つ1行と、出力の見方、ショートカットを作った後に Shuko を開き直すこと、タスクバーで右クリックして確かめること）を `install-3.1-draft.md` に書く。docs/ はリーダーが直す。

## 決まり

- 本体（removals/・patches/）には手を入れない。
- テストは曹参が同じ仕様から並行して書く（`tasks/2026-11-18-start-menu-aumid-tests/`）。台本の引数・出力の形は上の2のとおりにし、変えるなら報告に書く。

## 完了条件

- `scripts/start-menu-shortcut.ps1` が一時の .lnk に、指す先・作業フォルダ・ID を書き、`-Read` で3つが読める
- `configure.ps1` の向け直しの後も ID が残る（直したならその差分）
- 大岡越前守が、曹参のテストと独立の読み手で確かめる

## 成果物

このディレクトリに保存する。

- `scripts/start-menu-shortcut.ps1`（と、直したなら `scripts/configure.ps1`）
- `handoff-notes-meng-tian.md`（見立ての裏付け、走らせたコマンドと出力、configure の確かめの結果）
- `install-3.1-draft.md`（install.md 3.1 の差し替え案）

## 結果

（未記入）

## 未解決

- 効いたかどうかは、ユーザーがショートカットを作ってタスクバーで確かめるまで分からない。

## 次の担当

大岡越前守（検証）

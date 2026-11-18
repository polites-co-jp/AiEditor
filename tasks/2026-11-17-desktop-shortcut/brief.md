# デスクトップに Shuko のショートカットを置く

- 担当: meng-tian（蒙恬）。許可が入ってから依頼する
- 依頼日: 2026-11-17
- 状態: 完了（2026-11-18）

## 目的

ユーザーの依頼「エディタのビルドを実行して、デスクトップにバイナリのショートカットをおいてください」に応える。ユーザーの答え（2026-11-17）は2つ。

- ビルドはしない。関門に合格した版 `1.146.0-p5-c-all-r6` を使う（r6 の後の変更は版の中身に効かない）
- ショートカットは、蒙恬が作る許可を Team の開発部に依頼する。許可が入るまでは置かない

## 入力

- 裁定: `docs/user-decisions.md` の「裁定（2026-11-17、ビルドの依頼とデスクトップのショートカット）」
- 許可の依頼: このフォルダの `permission-requests.md`
- 作り方の手本: `docs/install.md` の 3.1（スタートメニューのショートカット。`current` を通したパスにする）

## やること（許可が入ってから）

1. ユーザーのデスクトップ（`[Environment]::GetFolderPath('Desktop')`。この PC では `C:\Users\kou_z\OneDrive\デスクトップ`）に `Shuko.lnk` を作る。指す先は `%LOCALAPPDATA%\Programs\Shuko\current\Shuko.exe`、作業フォルダは `...\current`。`versions\<版>` を直に指さない。
2. 作った後に `TargetPath` を読み、`current\Shuko.exe` を指すことを確かめる。

## 決まり

- 置くのはショートカット1つだけ。デスクトップのほかのファイルを読まない・変えない。
- スタートメニュー・PATH には触れない（ユーザーが行う。裁定）。

## 完了条件

- デスクトップに `Shuko.lnk` があり、`current\Shuko.exe` を指している
- 大岡越前守が `TargetPath` と `WorkingDirectory` を確かめる

## 成果物

- このフォルダに `handoff-notes-meng-tian.md`（走らせたコマンド、確かめの結果）

## 結果

蒙恬が許可の「作る行」を1回打ち、デスクトップに `Shuko.lnk` を作った（`TargetPath=C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe`、`WorkingDirectory=...\current`、引数なし）。大岡越前守が「読む行」で同じ値を確かめた（`tasks/2026-11-18-start-menu-aumid-verify/verification-start-menu-aumid.md` の5）。ID は付いていない。ジャンプリストに要る ID はスタートメニューのショートカットに付ける（2026-11-18 の裁定）。

## 未解決

- 許可が入るまで待つ（`permission-requests.md`）。
- `configure.ps1 -InstallRoot` で置き場所を変えるときに向け直すのは、スタートメニューのショートカットだけ。デスクトップのショートカットは向け直されない。置き場所を変えるときに作り直す。

## 次の担当

許可が入ったら蒙恬

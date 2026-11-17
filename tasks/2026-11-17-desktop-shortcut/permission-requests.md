# 権限の変更の依頼（AiEditor 課 → Team の開発部）: デスクトップにショートカットを置く許可

- 作成: ヴラド・ツェペシュ（2026-11-17）
- 承認: ユーザー（2026-11-17 の問いで「Team に許可を依頼」。`docs/user-decisions.md` の「裁定（2026-11-17、ビルドの依頼とデスクトップのショートカット）」）

## 1. 蒙恬に、デスクトップに Shuko のショートカットを1つ作る許可

| 欄 | 足すもの | 何のため |
|---|---|---|
| write_paths（または bash） | ユーザーのデスクトップの `Shuko.lnk` だけ。この PC では `C:/Users/kou_z/OneDrive/デスクトップ/Shuko.lnk`（`[Environment]::GetFolderPath('Desktop')`。OneDrive に移されている） | ユーザーの依頼（2026-11-17）「デスクトップにバイナリのショートカットをおいてください」。課には今、デスクトップに書ける者がいない |

- 作り方は `docs/install.md` の 3.1 と同じ（PowerShell の `WScript.Shell` の `CreateShortcut`）。指す先は `%LOCALAPPDATA%\Programs\Shuko\current\Shuko.exe`、作業フォルダは `...\current`。
- `.lnk` は PowerShell の COM で書くので、Write ツールの書き込み先の許可だけでは足りない見込み。書き方（その1行を `bash_exact` にする、`scripts/` に小さな台本を置いてその台本だけを許すなど）は開発部に任せる。
- 範囲: このファイル1つの作成と上書き（作り直し）。デスクトップのほかのファイルの読み書き・削除は要らない。
- 作った後の確かめのため、大岡越前守がこの `.lnk` の `TargetPath` と `WorkingDirectory` を読めるようにしてほしい（読むだけ）。

## 2. 知らせ

- 許可が入るまで、ショートカットは置かない。ビルドはしない（合格済みの版 r6 を使う。ユーザーの答え）。
- 前の依頼（`tasks/2026-11-17-l10n-ja/permission-requests.md`。拡張を外す許可）も、まだ入っていない。r6 への入れ替えはそちらを待っている。ショートカットは `current` を通すので、入れ替えの後も作り直さなくてよい。

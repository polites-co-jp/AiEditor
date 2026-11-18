# デスクトップのショートカットの作成（蒙恬の引き継ぎ）

- 作成: 蒙恬（2026-11-18）
- 依頼: `brief.md`、許可: `permission-response.md`

## 走らせたコマンド

`team/departments/development/meng-tian/permissions.json` の `bash_exact` の末尾の「作る行」（`powershell -NoProfile -NonInteractive -EncodedCommand JABF…AKAA=`）を、1字も変えずに写して1回だけ打った。フックには止められなかった。打ち直しはしていない。

## 出力の3行

```
TargetPath=C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe
WorkingDirectory=C:\Users\kou_z\AppData\Local\Programs\Shuko\current
Arguments=
```

- `Arguments=` は空だった（引数は付いていない）。
- 終了コードは 0 だった。
- 3行の後に、PowerShell の進み具合の CLIXML（`#< CLIXML` と、モジュールを初めて使う準備の進み具合の記録。文字化けしていた）が標準エラーに出た。非対話の `powershell.exe` がモジュールを読み込むときに出す既定の出力で、誤りの記録ではない。

## 確かめたこと

- `TargetPath` は `current\Shuko.exe` を指し、`versions\<版>` を直に指していない。
- `WorkingDirectory` は `...\current` である。
- 大岡越前守が「読む行」で `TargetPath` と `WorkingDirectory` を確かめる（brief の完了条件）。

## 注意

- このショートカットには AppUserModelID を付けていない（許可された行の中身のとおり）。タスクバーのジャンプリストは、スタートメニューの ID 付きのショートカット（`tasks/2026-11-18-start-menu-aumid/`）で出す。

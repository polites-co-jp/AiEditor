# docs/install.md 3.1 の差し替え案（スタートメニュー）

- 作成: 蒙恬（2026-11-18）
- 根拠: `docs/user-decisions.md` の「裁定（2026-11-18、タスクバーの右クリックの「New Window」）」
- docs/ はリーダーが直す。下の「### 3.1 スタートメニュー」から「### 3.2」の手前までを置き換える案。
- 3節の冒頭の1文「この登録をする台本はありません。」も、「スタートメニューは台本で、PATH は手で、1回だけ登録します。」に直す必要がある。

---

### 3.1 スタートメニュー

台本 `scripts/start-menu-shortcut.ps1` で、スタートメニューに Shuko のショートカットを1つ作ります。このショートカットには、Shuko の窓と同じアプリの ID（AppUserModelID。`product.json` の `win32AppUserModelId`、今は `Shuko.Editor`）が付きます。ID が付いたショートカットがスタートメニューに無いと、Windows はタスクバーのボタンを右クリックしたときのメニューに「New Window」（新しい窓を開く）を出しません。

普通の PowerShell の窓で、このリポジトリの直下から1行実行します（管理者は要りません。通信しません）。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1
```

- 置き場所は `local.json` の `installRoot`（手順1）から読みます。既定の場所なら、引数は要りません。
- ショートカットは「プログラム」フォルダ（`%APPDATA%\Microsoft\Windows\Start Menu\Programs`）の直下の `Shuko.lnk` です。同じ名前のものがあれば作り直します（手で付けた引数やアイコンは消えます）。ほかのショートカットには触れません。
- `current\Shuko.exe` が無いときは何も作らずに止まります（手順2の `switch.ps1` が済んでいるかを確かめます）。

出力の見方。最後に次の3行が出て、終了コードが 0 なら済んでいます。

```
TargetPath=C:\Users\<ユーザー>\AppData\Local\Programs\Shuko\current\Shuko.exe
WorkingDirectory=C:\Users\<ユーザー>\AppData\Local\Programs\Shuko\current
AppUserModelId=Shuko.Editor
```

- `TargetPath` が `current` を通したパスであることが大事です。`versions\1.146.0-1` を直に指していると、版を切り替えてもショートカットが古い版を開きます。
- `AppUserModelId=` が空、または `Shuko.Editor` でないなら、ジャンプリストは出ません。知らせてください。
- 3行の前に `[start-menu-shortcut] ...` で始まる行（どこから値を読んだか）が出ますが、誤りではありません。読み直した値が期待と違うと、`read-back differs: ...` を出して終了コード 2 で終わります。そのときは知らせてください。
- 書かずに今の中身だけを見るときは、末尾に `-Read` を付けます。

作った後に確かめます。

1. 開いている Shuko の窓を全部閉じ、スタートメニューの「Shuko」から開き直します（ID は窓を開くときに結び付くので、作る前から開いていた窓では出ないことがあります）。
2. タスクバーの Shuko のボタンを右クリックします。メニューの上の方に「New Window」（日本語の表示では訳された名前で出ることがある）が出て、選ぶと新しい窓が開けば済んでいます。
3. 出ないときは、Shuko を閉じて1分ほど待ってから開き直します（Windows がスタートメニューの変更を読み直すのに時間がかかることがあります）。それでも出なければ知らせてください。

置き場所を変えた（`configure.ps1 -InstallRoot`）後も、このショートカットは向け直され、ID は残ります。

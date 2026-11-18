# 引き継ぎ: スタートメニューのショートカットに AppUserModelID を付ける（蒙恬）

- 作成: 蒙恬（2026-11-18）
- 依頼: `brief.md`。途中で追加の依頼（`configure.ps1` に Programs フォルダを差し替える引数を足す）を受けた。

## 1. 見立ての裏付け

見立てどおりだった。食い違いは無い。

- 作業ツリー `tmp/b/wt/1.146.0`（C-1 の直しが入った木）の `src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts` の `updateWindowsJumpList`（377 行〜）が、タスク「New Window」（`title: localize('newWindow', "New Window")`、`args: '-n'`、`program: process.execPath`。386〜396 行）を必ず入れ、`app.setJumpList(jumpList)`（467 行）で渡している。
- 398〜399 行は C-1-ai の置き換え（「Agents Window」を外した跡）。`removals/C-1-ai/edits.patch` の 1017〜1049 行が、このファイルに当てる差分の全部で、`join` の import と「Agents Window」の `tasks.push` だけを外している。「New Window」の要素には触れていない。
- `removals/*/unit.json` に `platform/workspaces`・`isPortable`・`win32AppUserModelId`・`setAppUserModelId`・`AppUserModel` を含む行は無い（C-1-ai の unit.json 265 行・312 行は、`platform/chat` を残す理由と `'--agents'` が残っていないことの検査で、このファイルを消すものではない）。`patches/` にもジャンプリストの語は無い。
- 窓の ID: 同じ木の `src/vs/code/electron-main/app.ts` 701〜703 行が `app.setAppUserModelId(isPortable ? `${id}.Portable` : id)` を呼ぶ。`product.overlay.json` の `set.win32AppUserModelId` は `Shuko.Editor`。
- 注意: `updateWindowsJumpList` は portable のとき（アプリの横に `data` フォルダがあるとき）何もしない（363〜366 行）。そのとき ID も `Shuko.Editor.Portable` になる。日常の Shuko は zip を `versions\<版>` に展開しただけで `data` フォルダは無い前提。もしユーザーの環境で出ないときは、`current\data` が無いことを確かめる。

## 2. 作ったもの・直したもの

| ファイル | 中身 |
|---|---|
| `scripts/start-menu-shortcut.ps1` | 新規。ID 付きのショートカットを作る台本（ユーザーが1回打つ） |
| `scripts/lib/shell-link.ps1` | 新規。.lnk を ShellLink（IShellLinkW・IPersistFile・IPropertyStore）で読み書きする部品。WScript.Shell は ID を読み書きできないため |
| `scripts/configure.ps1` | `-ProgramsDir` を足した（追加の依頼）。ID を残すための直しは要らなかった（4節） |
| `scripts/trial-start-menu-aumid.ps1` | 新規。手元の確かめの台本。`tmp/` の下だけで動く。下の注意を参照 |

### start-menu-shortcut.ps1 の入口

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1 [-InstallRoot <root>] [-ShortcutPath <lnk>] [-AppUserModelId <id>] [-Read] [-ConfigPath <local.json>]
```

- 既定: `-InstallRoot` は `local.json` の `installRoot`（`Resolve-ShukoLocalConfig`。無ければ `%LOCALAPPDATA%\Programs\Shuko`）。`-ShortcutPath` は `[Environment]::GetFolderPath('Programs')\Shuko.lnk`。`-AppUserModelId` は `<InstallRoot>\current\resources\app\product.json` の `win32AppUserModelId`、無ければ `product.overlay.json` の `set.win32AppUserModelId`。
- 書く中身: 指す先 `<InstallRoot>\current\Shuko.exe`、作業フォルダ `<InstallRoot>\current`、`System.AppUserModel.ID`（PKEY `{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5`、VT_LPWSTR）。引数・アイコンは付けない。毎回新しい ShellLink を作って上書きする（前の .lnk の中身は引き継がない）。
- 標準出力: 読み直した値の3行 `TargetPath=`・`WorkingDirectory=`・`AppUserModelId=`（行頭から）。`-Read` も同じ3行（ID が無ければ `AppUserModelId=` は空）。そのほかの知らせは `[start-menu-shortcut] ...` で標準エラーに出す。
- 終了コード: 0 済み、1 誤り（何も書いていない。`current\Shuko.exe` が無い、.lnk の置き場所のフォルダが無い、拡張子が .lnk でない、ID が見つからない、`-Read` で .lnk が無い）、2 書いたが読み直した値が期待と違う。

## 3. 仕様から変えた点・足した点

- `-ConfigPath` を足した（`configure.ps1` と同じ。既定の `installRoot` を読む local.json を差し替える。試しとテスト用）。brief の引数はそのまま。
- 終了コードを 1 と 2 に分けた（brief は「0 以外」とだけ書いている）。
- `-ShortcutPath` の親のフォルダが無いときは、作らずに止める（終了 1）。本物の「プログラム」フォルダは常にある。
- `-Read` は `-InstallRoot` を見ない（local.json も読まない）。

## 4. configure.ps1 の確かめ（ID は残る。直しは不要）

`configure.ps1` の5（WScript.Shell で開いて `TargetPath`・`WorkingDirectory` を変えて `Save()`）と、取り消しの `'shortcut'`（同じく WScript.Shell で `Save()`）の両方で、`System.AppUserModel.ID` は残った。WScript.Shell の `Save()` が、読み込んだ .lnk のプロパティを保ったまま書いたと見る（この PC の Windows 11 で動かして確かめた結果。文書の出典は確かめていない）。下の trial の `repoint` と `undo` の結果。

### 足した引数 `-ProgramsDir`（追加の依頼）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1 -ConfigPath <tmp>\local.json -InstallRoot <tmp>\B -ProgramsDir <tmp>\programs
```

- 5でショートカットを探すフォルダを、`[Environment]::GetFolderPath('Programs')` の代わりに `<ProgramsDir>` にする（直下の `*.lnk` だけ。今と同じ）。既定は今どおり。
- 効くのは `-InstallRoot` で場所を変えるときだけ。`-NoShellIntegration` を付けると5ごと飛ばすので、意味が無い。
- ユーザーの PATH の段は変わらない。本物の `HKCU\Environment` を読み、`<旧 root>\current\bin` に一致する項目があるときだけ書く。`tmp/` の下の模擬の root なら一致する項目は無く、書かない（trial の出力で `userPath.changed = false`）。
- 取り消しの側も、記録したパスの .lnk を直すので `-ProgramsDir` の下だけに触れる。

## 5. 走らせたコマンドと結果

### 5.1 手元の確かめ（trial）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/trial-start-menu-aumid.ps1
```

`tmp/b/trial-aumid/20261118115759/` の下に模擬の root（`A\versions\v1\Shuko.exe`、`A\current` はジャンクション、`product.json` の ID は `Shuko.Editor`）と一時の Programs フォルダを作って試した。終了 0、`allOk: true`。

| 場合 | 結果 |
|---|---|
| create | 終了 0。3行は `TargetPath=...\A\current\Shuko.exe`・`WorkingDirectory=...\A\current`・`AppUserModelId=Shuko.Editor`。読み手で読み直しても同じ |
| read | `-Read` で同じ3行。.lnk のバイト列と更新時刻は変わらない |
| nocurrent | `current\Shuko.exe` の無い root で終了 1。`not found: ...\N\current\Shuko.exe (nothing written)`。.lnk は作られない |
| repoint | `configure.ps1 -ConfigPath ... -InstallRoot ...\B -ProgramsDir ...\programs` が終了 0。`Shuko.lnk` は `...\B\current\Shuko.exe`・`...\B\current` に向き、ID `Shuko.Editor` が残った。同じフォルダの `Other.lnk` はバイト列・時刻とも変わらない |
| undo | local.json の書き込みを失敗させた（`local.json.tmp` という名のフォルダを置いた）`configure.ps1` が終了 1、`undo shortcut ok` ほか全部 ok。`ShukoC.lnk` は元の `...\C\current\Shuko.exe`・`...\C\current` に戻り、ID `Shuko.Editor` が残った |

この trial の読み手は `scripts/lib/shell-link.ps1`（台本と同じ部品）なので、ID の読みは独立ではない。独立の読み手での確かめは 5.2（曹参のテストの `Shell.Application` の `ExtendedProperty('System.AppUserModel.ID')`）。

### 5.2 曹参のテスト

```
node --test tests/start-menu-shortcut.test.mjs
```

12件、通った11・落ちた1。

- 落ちた1件: 「no product.json: the value of product.overlay.json is used」。台本は `Shuko.Editor` を書いた（`actual: 'Shuko.Editor'`）が、期待の値が `undefined` だった。テストの 15 行が `product.overlay.json` の最上位の `win32AppUserModelId` を読んでいるが、overlay ではこの値は `set` の下にある（`set.win32AppUserModelId`）。**テストの誤り**と見る。曹参に `.set.win32AppUserModelId` を読むよう直してもらう必要がある。
- 独立の読み手（`Shell.Application`）での ID の確かめ（PKEY の取り違えを見る件を含む）は通った。

### 5.3 configure の既存のテスト（-ProgramsDir を足した後の退行の確かめ）

```
node --test tests/configure.test.mjs
```

17件、全部通った。

## 6. 曹参が試す入口

- `scripts/start-menu-shortcut.ps1`: 2節の入口と出力。
- `scripts/configure.ps1 -ProgramsDir <dir>`: 4節。ID 付きの .lnk（`start-menu-shortcut.ps1 -ShortcutPath <dir>\Shuko.lnk` で作れる）を置いて `-InstallRoot` で場所を変え、向け直しの後と、取り消し（例: `<ConfigPath>.tmp` という名のフォルダを置いて local.json の書き込みを失敗させる）の後に、ID が残ること。期待は `TargetPath` が新しい root（取り消しなら古い root）の `current\Shuko.exe`、ID は変わらない、`<dir>` のほかの .lnk は変わらない。
- `scripts/lib/shell-link.ps1`: `Read-ShukoShortcut -Path <lnk>`（`targetPath`・`workingDirectory`・`arguments`・`appUserModelId`）、`Write-ShukoShortcut`、`Set-ShukoShortcutAppUserModelId`（今は誰も呼ばない。configure の直しが要らなかったため）。

## 7. 注意・未解決

- `scripts/trial-start-menu-aumid.ps1` は、私の Bash の許可が `scripts/*.ps1` の形しか打てないため `scripts/` に置いた。曹参のテストができたので要らなければ、残すか外すかをリーダーが決める（私には消す許可が無い）。
- 確かめに使った `tmp/b/trial-aumid/` は残っている（削除の許可 `tmp/b/trial-*` の範囲）。
- 効いたかどうかは、ユーザーがショートカットを作り、Shuko を開き直してタスクバーで右クリックするまで分からない（brief の未解決のとおり）。
- `Set-ShukoShortcutAppUserModelId` は使っていない。要らなければ外してよい。

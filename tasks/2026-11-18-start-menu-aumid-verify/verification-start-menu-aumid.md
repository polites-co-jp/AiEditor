# 検証の記録: ID 付きスタートメニューのショートカットの台本とデスクトップのショートカット

- 検証: 大岡越前守（2026-11-18）
- 依頼: `brief.md`（このフォルダ）
- 対象: 蒙恬の `scripts/start-menu-shortcut.ps1`・`scripts/lib/shell-link.ps1`・`scripts/configure.ps1`（`-ProgramsDir`）・`install-3.1-draft.md`・デスクトップの `Shuko.lnk`、曹参の `tests/start-menu-shortcut.test.mjs`・`tests/configure.test.mjs`（末尾の2件）

## 判定

**不合格**。6（差し替え案）に、出力の並びの書き方の食い違いが1点ある。文言を直せば済む。1〜5 は合格。

| 項目 | 合否 |
|---|---|
| 1. 差分のレビュー | 合格 |
| 2. テストの実行と、本物の場所に書かないこと | 合格（31件通過、落ち0） |
| 3. テストが `-Read` に頼らず ID を読むこと | 合格 |
| 4. 見立ての裏付け | 合格 |
| 5. デスクトップのショートカット | 合格 |
| 6. 差し替え案と台本の振る舞い | **不合格**（1点。下の6） |

## 1. 差分のレビュー（合格）

- `start-menu-shortcut.ps1`: brief の「やること」の2のとおり。
  - 引数は `-InstallRoot`・`-ShortcutPath`・`-AppUserModelId`・`-Read` の4つ。足した `-ConfigPath` は引き継ぎの3節に書いてある。
  - 既定値は次のとおり。`-InstallRoot` は `Resolve-ShukoLocalConfig`（`lib/local-config.ps1` の45行で、既定は `%LOCALAPPDATA%\Programs\Shuko`）。`-ShortcutPath` は `GetFolderPath('Programs')\Shuko.lnk`。ID は product.json の値で、無ければ `product.overlay.json` の `set.win32AppUserModelId`（overlay の14行で `Shuko.Editor`）。
  - 書く中身は、指す先 `<root>\current\Shuko.exe`、作業フォルダ `<root>\current`、PKEY `{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5` を VT_LPWSTR で（`shell-link.ps1` の88〜93行と127〜139行）。
  - 書いた後に読み直して3行を出し、期待と違えば終了 2 で終わる（136〜139行）。`current\Shuko.exe` が無ければ、書く前に終了 1 で止まる（112行）。
- 本物の場所に書かないこと: 書く先は `$ShortcutPath` の1つだけ（129行）。本物の「プログラム」フォルダに書くのは、`-ShortcutPath` を省いたときの既定だけ。local.json は読むだけ。`-Read` は `STGM_READ` で開き、保存しない（`shell-link.ps1` の103行）。
- 通信しないこと: 3つのファイル（`start-menu-shortcut.ps1`・`lib/shell-link.ps1`・`lib/local-config.ps1`）に `Invoke-WebRequest`・`WebClient`・`HttpClient`・`http` などは無い（Grep で 0 件）。`Add-Type` はこの PC の中でコンパイルするだけ。
- `configure.ps1` の差分（`git diff`）: 足したのは引数1つ、説明の4行、345行の分岐だけ。`-ProgramsDir` を渡さなければ、前と同じく `[Environment]::GetFolderPath('Programs')` を使う。既定の振る舞いは変わっていない。PATH の段と取り消し（`Invoke-UndoStep` の `'shortcut'`）には差分が無い。
- 3（向け直しで ID が残るか）: 直しは要らなかった（蒙恬の判断）。それを裏付けるテストが configure.test.mjs の2件で、通った（2）。

## 2. テストの実行（合格）

```
node --test tests/start-menu-shortcut.test.mjs tests/configure.test.mjs
```

tests 31、pass 31、fail 0（台本12件、configure 19件。duration_ms 26220）。実行の後の `git status --short` は、始める前の状態と同じだった。

本物の場所に書かないことは、テストのコードで確かめた。

- `start-menu-shortcut.test.mjs`: 呼び出しは `run()`（76行）の1か所だけで、`-InstallRoot <sb>\rN` と `-ShortcutPath <sb>\rN\menu\Shuko.lnk` を毎回渡す。`sb` は `makeSandbox`（`tests/build/helpers.mjs` の21〜29行。置き場所は `<repo>\tmp\tests\`）。
- `configure.test.mjs` の末尾の2件: `-ConfigPath <sb>\tN\cfg\local.json` と `-ProgramsDir <sb>\tN\programs` を渡し、環境変数 `SHUKO_TEST_BASE` を設定する。古い root と新しい root も sandbox の中にある。
- PATH の段は本物の `HKCU\Environment` を読む。書くのは `<sandbox>\...\current\bin` に一致する項目があるときだけで、そういう項目は無い。テストは前後の `reg query` が同じであることと、`userPath.changed === false` を確かめている。

## 3. ID を独立に読んでいること（合格）

- 両方のテストの `readLnk` は、テストが自分で書いた `read-lnk.ps1` を使う。この台本は WScript.Shell で指す先と作業フォルダを、`Shell.Application` の `ExtendedProperty('System.AppUserModel.ID')` で ID を読む。台本の `-Read` も `shell-link.ps1` も使っていない。
- 読み手が値を区別できることは、通ったテストで分かる。`Test.FromProduct`・`Test.Explicit`・`Shuko.Editor` の3つを読み分けている。素のショートカット（ID 無し）では空を返している（132〜141行、186行）。
- `configure.test.mjs` の `setupShell` は、ID 付きの .lnk を作るのに台本を使う。ただし、確かめの読みは独立の読み手で行っている。
- 限り: 台本をわざと壊して（PKEY を変えるなど）テストが落ちるかの試しはしていない。私の許可では、台本の写しをテストに向けられないため。

## 4. 見立ての裏付け（合格）

- `tmp/b/wt/1.146.0/src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts`
  - 386〜396行: 「New Window」（`args: '-n'`、`program: process.execPath`）を `tasks` に入れている。
  - 401〜404行: それを `jumpList` に足している。
  - 467行: `app.setJumpList(jumpList)` で渡している。
  - 363〜366行: portable のときは何もしない。
- `git -C tmp/b/wt/1.146.0 diff 1.146.0 -- <このファイル> src/vs/code/electron-main/app.ts` で、上流の tag との差を見た。このファイルの差は2つだけで、`join` の import と「Agents Window」の `tasks.push` を外し、注釈に置き換えたもの。「New Window」の要素には触れていない。中身は `removals/C-1-ai/edits.patch` の1017〜1049行と同じ。
- `app.ts` の701〜704行（`setAppUserModelId`、703行）は、上流から変わっていない。この木で `app.ts` が上流と違うのは agentHost と MCP の箇所だけ。
- `removals/` の全体を Grep（`workspacesHistoryMainService|platform/workspaces|JumpList|newWindow|win32AppUserModelId|setAppUserModelId|AppUserModel|isPortable`）した。当たったのは C-1-ai の unit.json の265・312行、README の162・170行、edits.patch の上記の箇所だけ。どれも「New Window」を外すものではない。`patches/` では 0 件。

## 5. デスクトップのショートカット（合格）

`permissions.json` の `bash_exact` の末尾の「読む行」（`powershell -NoProfile -NonInteractive -EncodedCommand JABF…CgA=`）を、1字も変えずに1回だけ打った。フックには止められなかった。出力は次のとおり。

```
TargetPath=C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe
WorkingDirectory=C:\Users\kou_z\AppData\Local\Programs\Shuko\current
```

`missing` は出ず、誤りも出なかった。前後に CLIXML の進み具合の記録が標準エラーに出た。これは非対話の powershell の既定の出力で、蒙恬の引き継ぎにある内容と同じ。`TargetPath` は `current\Shuko.exe` を、`WorkingDirectory` は `current` を指していて、`versions\<版>` を直に指していない。どちらも蒙恬の報告と一致する。

## 6. 差し替え案（不合格、1点）

台本と合っている点は次のとおり。

- 打つ1行と、引数を省いたときの既定。
- 置き場所（「プログラム」フォルダの直下の `Shuko.lnk`）。
- 同名のものは作り直し、手で付けた引数とアイコンは消える。新しい ShellLink で上書きするので、正しい。
- `current\Shuko.exe` が無いときは止まる。
- 3行の形、終了 0 と終了 2（`read-back differs`）、`-Read`。
- 開き直してからタスクバーで確かめる手順。
- `configure.ps1 -InstallRoot` の後も ID が残る。

食い違う点:

- 24行の「最後に次の3行が出て」と、34行の「3行の前に `[start-menu-shortcut] ...` で始まる行が出ます」。台本は3行を出した後（`start-menu-shortcut.ps1` の134行の後、140行）に、標準エラーへ `[start-menu-shortcut] ok. Restart Shuko, then right-click its taskbar button to see "New Window".` を出す。終了 2 のときの `read-back differs: ...` も3行の後に出る。そのため、最後の行は3行ではない。

直し方: 24行を、たとえば「次の3行が出て、終了コードが 0 なら済んでいます」にする。34行は「3行の前後に…」とし、最後に `ok. Restart Shuko, …` が出ることを書く。台本の側を変えてもよい（ok の行をやめる、または3行の前に出す）が、案の文言を直すほうが小さく済む。

## 直すべき点

| 誰の | どこ | 何を | 重さ |
|---|---|---|---|
| 蒙恬（またはリーダーが install.md に写すとき） | `install-3.1-draft.md` の24行・34行 | 上の6のとおり、出力の並びの書き方を台本に合わせる | 合否に効く |
| 曹参 | `tests/configure.test.mjs` の3〜4行（先頭の注釈） | 「Every run passes ... -NoShellIntegration, so ... the Start menu shortcuts and the user PATH are never touched」は、末尾の2件（`-NoShellIntegration` を付けず、`-ProgramsDir` で一時のフォルダを渡し、本物の PATH は読むだけ）と合わない。注釈を直す | 軽い（合否に効かない） |
| 蒙恬 | 引き継ぎの1節の「`app.ts` 701〜703 行」 | 呼び出しは703行で、`if` のブロックは701〜704行 | 軽い（合否に効かない） |

参考（直さなくてよいもの）: テストに無いものが3つある。終了 2（読み直しの食い違い）の経路、拡張子が .lnk でないとき、置き場所のフォルダが無いとき。どれも brief の必須の項目ではない。

## 走らせたコマンド

1. `git diff scripts/configure.ps1 tests/configure.test.mjs`
2. `node --test tests/start-menu-shortcut.test.mjs tests/configure.test.mjs`（31件通過）
3. `git -C tmp/b/wt/1.146.0 diff -- src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts`（出力なし）
4. `git -C tmp/b/wt/1.146.0 status --short -- <上のファイル> src/vs/code/electron-main/app.ts`（出力なし）
5. `git -C tmp/b/wt/1.146.0 diff 1.146.0 -- <上のファイル> src/vs/code/electron-main/app.ts`
6. `bash_exact` の「読む行」（5節）
7. `git status --short`（実行の前後で変化なし）

本物のスタートメニュー、デスクトップ、`%LOCALAPPDATA%\Programs\Shuko` には書いていない。コードも直していない。

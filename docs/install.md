# Shuko のインストール（ビルドした zip から日常の利用まで）

ビルドした zip から Shuko を日常の利用に入れるまでの手順です（[07](07-phases.md) の7節の3）。普段使いの本家の VS Code は消さず、そのまま残します。Shuko が合わなかったときに戻る先にするためです（同じ節の4）。

- 対象: Windows 11、x64。利用者はこの PC のユーザー1人
- 入れる版: `C:\b\dist\1.146.0-p2-all.zip`（段階 A・B の14単位を当てた版。SHA-256 `15aa0ce75ead4e7455cfe4f40557f62c2b56b4822151319271e30916e3081f6f`、本体の commit `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`。全桁は `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json` の `zip.sha256`。締めの検証は `records/phase2/phase2-close.md`）
- 所要時間: 手順1〜4は10分ほど（zip の展開と拡張の導入はそれぞれ1分弱）。外部ツールと Notion の用意を含めると1時間ほど
- 管理者の権限: Shuko の手順はどれも要りません（全部ユーザーごとの場所に書きます）。外部ツール（手順5）の導入で UAC の確認が出ることがあります
- 前提: [build-env-setup](build-env-setup.md) の道具が入っていて、Smart App Control がオフ。自分でビルドした署名の無いネイティブの部品は、オンだと読み込めません（[02](02-repository-and-build.md) の5節。裁定 2026-11-14）

コマンドは、とくに断りが無ければ、普通の PowerShell の窓（管理者でなくてよい）で、ビルドリポジトリの直下で実行します。

```powershell
cd E:\develop\self\Team\projects\ai-editor
```

## 普段の VS Code とは分かれている

Shuko は product.json の名前を変えてあるので（`nameShort: Shuko`、`dataFolderName: .shuko`、`sharedDataFolderName: .shuko-shared`。`product.overlay.json`）、データの置き場所が本家と重なりません。Shuko の手順は、本家の場所には何も書きません。

| もの | 本家の VS Code | Shuko |
|---|---|---|
| ユーザーのデータ（`settings.json`・`keybindings.json`・`snippets\`・状態） | `%APPDATA%\Code` | `%APPDATA%\Shuko` |
| 拡張と `argv.json` | `%USERPROFILE%\.vscode\` | `%USERPROFILE%\.shuko\` |
| アプリケーションの共有の保存場所（`sharedStorage`） | `%USERPROFILE%\<本家の sharedDataFolderName>\`（公式の版の値は確かめていない。OSS のソースの値は `.vscode-oss-shared`） | `%USERPROFILE%\.shuko-shared\` |
| 本体 | 本家のインストール先 | `<installRoot>\versions\<ラベル>\`（既定 `%LOCALAPPDATA%\Programs\Shuko`） |
| コマンドラインの入口 | `code` | `shuko` |
| 道具の設定・更新の検知の状態とトークン | — | `%LOCALAPPDATA%\Shuko\`（`local.json`・`watch\`） |

- 置き場所は、1.146.0 のソース（`src/vs/platform/environment/node/userDataPath.ts`、`src/mainImpl.ts` の `getArgvConfigPath`、`src/vs/platform/environment/common/environmentService.ts` の `appSharedDataHome`、`src/vs/platform/storage/electron-main/storageMainService.ts` の `sharedStorage`）と `scripts/switch.ps1`・`scripts/install-extensions.mjs` の読みから決めたものです。手順4のあとの初めての起動で確かめます（`.shuko-shared` が実際に作られるかも、そこで見ます）。
- 本家と Shuko は同時に起動できる見込みです（データの置き場所も、多重起動の印 `win32MutexName` も別の名前のため）。
- 分かれていないもの: Claude Code の CLI の設定・ログイン・会話の記録（`%USERPROFILE%\.claude\`）は、どちらのエディタの Claude Code 拡張からも同じものが使われます（見込み）。
- 本家の設定は自動では写りません。持ってくるときは、Shuko を閉じてから、要る項目だけを `%APPDATA%\Shuko\User\settings.json` に手で写してください。

## 1. `local.json` を作る（`configure.ps1`）

PC ごとの設定ファイル `%LOCALAPPDATA%\Shuko\local.json` を作ります。切り替え・拡張の導入・取り込み・更新の検知の道具は、どれもこのファイルから場所を読みます（[02](02-repository-and-build.md) の6.1）。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1
```

- 初めてのときは既定の値で作ります。`builderRepo` には、このコマンドを実行したリポジトリの場所が入ります。
- 出力は JSON 1つです。`"result": "ok"`、`actions` に `created local.json with the defaults` があり、`resolved` が次のようになっていれば済んでいます。

  | キー | 値 |
  |---|---|
  | `installRoot` | `C:\Users\<ユーザー>\AppData\Local\Programs\Shuko`（ファイルの中は `%LOCALAPPDATA%\Programs\Shuko`） |
  | `keepVersions` | `3` |
  | `builderRepo` | `E:\develop\self\Team\projects\ai-editor` |
  | `buildRoot` | `C:\b` |

- 2回目からは、引数なしで実行しても何も変えず、今の値を出すだけです。今の値を確かめたいときにも使えます。

### 初めから別の場所に置きたいとき

手順2の前（版のフォルダがまだ無いうち）に、場所を指定して実行します。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1 -InstallRoot D:\Apps\Shuko
```

- 置ける場所は、ローカルの固定ドライブの NTFS だけです（`current` のジャンクションを作るため）。ネットワークのドライブや UNC のパスは誤りになります。
- 前の場所と入れ子になる場所（前の場所の中、または外側）も誤りになります。

### あとで版のフォルダの場所を変えるとき

1. Shuko を全部閉じます。
2. 新しい場所を指定して実行します。

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1 -InstallRoot D:\Apps\Shuko
   ```

   台本は次の順に動きます。

   1. 前の場所の版で動いている Shuko があれば止まります（終了コード 3。閉じてからやり直します）。
   2. 新しい場所がローカルの NTFS かを確かめます。
   3. `versions\`・`history.txt`・`backups\` を新しい場所へ移します。新しい場所に同じ名前のものがあれば、混ぜずに止まります。
   4. `current` のジャンクションを新しい場所に作り直します。
   5. スタートメニューのショートカットとユーザーの PATH のうち、前の `current` を指しているものを新しい `current` に向け直します（手順3で作ったものが対象）。新しくは作りません。
   6. 最後に `local.json` を書き換えます。途中で失敗したときは、行った操作を戻し、`local.json` は前のままにします。

3. 新しい PowerShell の窓を開き、`where.exe shuko` が新しい場所の `current\bin\shuko.cmd` を指すことを確かめます。

- `-NoMove` を付けると、何も移さず、新しい場所で空から始めます（前の場所はそのまま残ります）。そのときは手順2の `switch.ps1 … -Zip …` だけをやり直します。`-NoMove` でも、スタートメニューのショートカットとユーザーの PATH は新しい `current` に向け直されるので（上の5。`-NoShellIntegration` を付けたときだけ向け直しません）、手順3はやり直しません。やり直すと、PATH に同じ項目が2つ入ります。
- 更新の検知のタスク（手順7）は、実行のたびに `local.json` を読むので、登録し直さなくて構いません。
- ほかの値を変えるとき: `-KeepVersions <数>`（残す版の数。1以上）、`-BuildRoot <場所>`（ビルドの作業場所。前の場所の中身は移しません）、`-BuilderRepo <場所>`（ビルドリポジトリを動かしたとき。`extensions.lock.json` がある場所でないと止まります）。`-BuilderRepo` を変えたら、手順7の `register-task.ps1` を実行し直します（タスクに `watch.mjs` のパスが書かれているため）。

## 2. zip を展開し、`current` を作る（`switch.ps1`）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-1 -Zip C:\b\dist\1.146.0-p2-all.zip -Sha256 15aa0ce75ead4e7455cfe4f40557f62c2b56b4822151319271e30916e3081f6f
```

- zip の SHA-256 を確かめてから、`<installRoot>\versions\1.146.0-1\` に展開し、`<installRoot>\current` をそこへ向けるジャンクションを作り、`history.txt` に1行書きます。
- 版のフォルダの名前（ラベル）は「本家のタグ-ビルドの番号」にします（[02](02-repository-and-build.md) の6節）。zip の名前はビルドのときの `1.146.0-p2-all` ですが、ラベルは `1.146.0-1` にしてください。更新の検知は、`current` の指すフォルダの名前から今の版を読みます。読めるのは `1.146.0` か `1.146.0-1` の形だけです。
- 出力の見どころ: `"result": "ok"`、`target.exe` が `...\versions\1.146.0-1\Shuko.exe`、`engines.unsatisfied` が空、`history` が `<日時>\t-\t1.146.0-1`（`\t` はタブ。`-` は「前の版なし」）。
- 初めてのときは `backup.missing` に5つ全部が並びますが、写すユーザーのデータがまだ無いだけで、誤りではありません。
- `switch.ps1` は、どの使い方でも初めに、更新の検知（手順7）が最後に成功した日時を1行出します（[06](06-update-watch-and-take-in.md) の2.3。JSON では `watch`）。警告だけで、切り替えは止めず、終了コードも変えません。
  - `[switch] update watch last succeeded: <日時>`: 3日以内に成功している。
  - `[switch] WARNING: update watch has not succeeded for <日数> day(s) (last <日時>)`: 3日より前から成功していない。Notion のトークンの失効などで、ToDo にも失敗を出せていない恐れがあります。`%LOCALAPPDATA%\Shuko\watch\watch.log` の末尾を見ます。
  - `[switch] WARNING: no update watch record (...)`: 検知の記録が無い。手順7の前（今のこの手順2）はこれが出ますが、誤りではありません。手順7のあとも出るなら、検知が一度も成功していません。
- 確かめ:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -List
  ```

  `current` が `1.146.0-1`、`versions` に `1.146.0-1` があれば済んでいます。

## 3. スタートメニューと PATH に登録する

この登録をする台本はありません。下の手順で1回だけ手で行います。`configure.ps1 -InstallRoot` が場所を変えるときに向け直すのは、この形で作ったものだけです（ユーザーの「プログラム」フォルダの直下のショートカットと、ユーザーの PATH）。

### 3.1 スタートメニュー

普通の PowerShell の窓で実行します。`$root` は手順1の `installRoot` です（既定の場所なら、そのままで構いません）。

```powershell
$root = "$env:LOCALAPPDATA\Programs\Shuko"
$lnk  = Join-Path ([Environment]::GetFolderPath('Programs')) 'Shuko.lnk'
$ws   = New-Object -ComObject WScript.Shell
$s    = $ws.CreateShortcut($lnk)
$s.TargetPath       = "$root\current\Shuko.exe"
$s.WorkingDirectory = "$root\current"
$s.Save()
$ws.CreateShortcut($lnk).TargetPath
```

- 最後の行が `...\Programs\Shuko\current\Shuko.exe` を出せば済んでいます。`current` を通したパスであることが大事です。`versions\1.146.0-1` を直に指していると、版を切り替えてもショートカットが古い版を開きます。そうなっていたら知らせてください。
- ショートカットは、サブフォルダを作らず、「プログラム」フォルダ（`%APPDATA%\Microsoft\Windows\Start Menu\Programs`）の直下に置きます。

### 3.2 ユーザーの PATH

1. `Win + R` で `rundll32 sysdm.cpl,EditEnvironmentVariables` を実行し、環境変数の画面を開きます（管理者は要りません）。
2. 上の「ユーザー環境変数」の `Path` を選び、「編集」→「新規」で次を足し、OK で閉じます。

   ```
   %LOCALAPPDATA%\Programs\Shuko\current\bin
   ```

   場所を変えたときは `<installRoot>\current\bin` にします。
3. **新しい PowerShell の窓を開いてから**確かめます。

   ```powershell
   where.exe shuko
   shuko --version
   ```

   `where.exe` が `...\Shuko\current\bin\shuko.cmd` を出し、`shuko --version` が `1.146.0`・`d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`・`x64` の3行を出せば済んでいます。

- `setx PATH ...` は使わないでください。1024 文字で切れ、`%LOCALAPPDATA%` などの形も展開されて失われます。

## 4. 台帳の拡張を入れる（`install-extensions.mjs`）

台帳 `extensions.lock.json` の8つの拡張（Claude Code、basedpyright、PowerShell、bash-ide、Rainbow CSV、.env、PDF、日本語の言語パック）を入れ、`argv.json` に `"locale": "ja"` を書きます（[04](04-bundled-extensions.md) の5節）。Shuko を起動する前に行います。

まず、取得と照合だけを試します（何も入れません。ただし、キャッシュに無い VSIX はこのときに Open VSX から取ります。オフラインだと、キャッシュに無いものがあれば誤りになります）。

```powershell
node scripts/install-extensions.mjs --dry-run
```

- `"result": "dry-run"`、`vsix` の8件すべてが `"sha256Ok": true`、`argv.path` が `C:\Users\<ユーザー>\.shuko\argv.json` であることを確かめます。
- VSIX は `C:\b\cache\vsix\` にあればそれを使い、無ければ Open VSX（`open-vsx.org`）から取ってそこに置きます。

続けて、入れます。

```powershell
node scripts/install-extensions.mjs
```

- `"result": "ok"`、`compare.ok` が `true`、`argv.endsWithNewlineBrace` が `true` なら済んでいます。
- 拡張は `%USERPROFILE%\.shuko\extensions` に入ります。版のフォルダとは別なので、手順2の切り替えをしても入れ直す必要はありません。
- 終了コード:

  | コード | 意味 | すること |
  |---|---|---|
  | 0 | 済んだ | — |
  | 1 | 誤り（版のフォルダか CLI が無い、VSIX が取れない、入れた結果が台帳と合わない、など） | `message` を見る。`フォルダが無い: <installRoot>\current`（手順2がまだ済んでいない）か `CLI が無い: <場所>`（版のフォルダはあるが CLI が無い）なら、手順2をやり直す |
  | 2 | SHA-256 が台帳と違う。何も入れていない | 入れずに知らせてください（取得したファイルが壊れたか、すり替わった恐れ） |
  | 3 | 台帳に無い拡張が入っている。`argv.json` は書いていない | 一覧（`compare.extra`）を見て、消すなら `shuko --uninstall-extension <ID>` で消してからやり直す |

### 4.1 初めての起動と確かめ

スタートメニューの「Shuko」から起動します。新しいユーザーのデータでの初めての起動は、英語で表示されます（[06](06-update-watch-and-take-in.md) の5節。スモークの台本も、一度起動して言語パックを読ませてから起動し直しています）。そのときは一度閉じて、起動し直します。

- 表示が日本語で、テーマが Light Modern になっている。
- 拡張の画面に、手順4の8つが出ている。
- Claude Code のパネルが開き、送信して応答が返る（ログインを求められたら、画面の案内に従う）。
- エクスプローラーで、`%APPDATA%\Shuko\User` ができていて、`%APPDATA%\Code` の更新日時が変わっていない。
- `%USERPROFILE%\.shuko-shared\` ができているか（できていれば、8節の「すっかり消すとき」の対象。できていなくても誤りではありません）。

ほかに手で見る項目は `records/phase2/manual-checks-p2-all.md` にあります（ここでは全部をやり直さなくて構いません）。

## 5. 外部ツール

補完やエラーの表示に、エディタの外のツールを使う言語があります。ツールが無いと、その機能（検査・整形など）が動かないだけで、色付けは残ります（[01](01-requirements.md) の4節。裁定）。

| ツール | 何に要るか | 入れ方 |
|---|---|---|
| Git for Windows | git の操作（組み込みの git 拡張） | `winget install --id Git.Git -e --source winget` |
| PowerShell 7 | PowerShell の言語機能 | `winget install --id Microsoft.PowerShell --source winget`（7.6.0 から既定は MSIX。MSI にするときは `--installer-type wix`） |
| Python 3 | basedpyright（入れたパッケージの型を解決する） | `winget install 9NQ7512CXL7T -e --accept-package-agreements --disable-interactivity`（Python の公式の install manager） |
| ShellCheck | sh の検査 | `winget install --id koalaman.shellcheck` |
| shfmt | sh の整形 | `winget install --id mvdan.shfmt`（ID は winget-pkgs のフォルダの名前からの推定） |
| Claude Code の CLI | 毎週の取り込みの判定（`claude -p`）。拡張に同梱された CLI は PATH に入らないため、別に入れる | PowerShell で `irm https://claude.ai/install.ps1 \| iex`（管理者は要らない。https://code.claude.com/docs/en/setup ） |

- この PC には、Git（2.54.0）・PowerShell 7（7.7.0）・Python（3.14.7）が入っています（2026-11-15 に確かめた）。入っているものは飛ばして構いません。
- Python が無くても、basedpyright の型の検査は動きます（`mydist` の既定が `basedpyright.importStrategy: "useBundled"`）。
- 確かめ: 入れたあと、**新しい PowerShell の窓で**次がそれぞれ版を返すこと。

  ```powershell
  git --version
  pwsh --version
  python --version
  shellcheck --version
  shfmt --version
  claude --version
  ```

  そのあと Shuko を再起動し、`.sh` のファイルを開いて、ShellCheck の警告が問題パネルに出ることを確かめます。

## 6. Notion の設定（設定の同期 `notion-sync`）

ユーザーの `settings.json`・`keybindings.json`・`tasks.json`・`snippets\` を、Notion の設定ページ1枚を通して PC の間でそろえます（[05](05-settings-sync.md)。裁定）。拡張は台帳から入れるので同期しません。

Notion のインテグレーションは、設定の同期用と更新の検知用（手順7）の2つに分けます（裁定）。トークンも別々です。

1. **設定ページを作る**: Notion に空のページを1枚作ります（題名の例「Shuko の設定」）。中身は拡張が初めての書き出しで作ります。
2. **インテグレーションを作る**: `https://app.notion.com/developers/connections` の「New integration」で、内部のインテグレーション（例「Shuko 設定の同期」）を作ります。作るには、ワークスペースのオーナーの権限が要ります。
3. **ページだけに接続する**: 設定ページを開き、右上の「•••」→「Add connections」で、2で作ったインテグレーションを選びます。ほかのページには接続しません。
4. **ページの ID を設定する**: Shuko の設定（`Ctrl + ,`）で `notionSync.pageId` を探し、ページの URL をそのまま貼ります（32桁の ID でも構いません）。ページの ID は秘密ではないので、settings.json に置いて構いません。
5. **トークンを入れる**: Notion のインテグレーションの「Configuration」のタブでトークンを表示してコピーします。Shuko のコマンドパレット（`Ctrl + Shift + P`）で「Notion 同期: トークンを設定」を実行し、貼ります。
   - トークンは拡張の SecretStorage（Windows では DPAPI で暗号化され、`%APPDATA%\Shuko\User\globalStorage\state.vscdb` に入る）に保存されます。settings.json には書かれません。
   - トークンはユーザー本人が入れます。エージェントには渡さず、読ませません。
6. **同期を有効にする**: トークンを入れたときに聞かれたら有効にします。聞かれなかったときは、設定 `notionSync.enabled` を `true` にします。
7. **確かめる**: ステータスバーに「同期済み」が出て、Notion の設定ページに見出し `manifest`・`settings.json` などとコードブロックができていれば済んでいます。ログは出力パネルの「Notion 同期」にあります。

- PC ごとに違う設定（例 `terminal.integrated.defaultProfile.windows`）は、設定 `notionSync.ignoredSettings` に最上位のキーの名前を並べます。書き出すときに除き、取り込むときは手元の値を残します。
- `claudeCode.environmentVariables` をユーザー設定に書くと、`mydist` の既定の配列（CLI の付帯の通信を止める変数）が丸ごと置き換わります。書くときは既定の2件も含めてください。
- 2台目の PC: 1〜7と同じことをします（2・3は済んでいるので要りません。トークンは同じものを入れます）。初めての同期では、`settings.json` が「競合あり」になることが多いです。コマンド「Notion 同期: 差分を見る」で「Notion を採る」を選びます。
- トークンを替えるとき・消すときは、コマンド「Notion 同期: トークンを設定」「Notion 同期: トークンを消す」を使います。

## 7. 更新の検知を登録する（タスクスケジューラ）

本家の VS Code と台帳の拡張の新しい版を毎日1回調べ、Notion の ToDo に「取り込みの検証」を足すプログラム `tools/watch/watch.mjs` を登録します（[06](06-update-watch-and-take-in.md) の2節）。

1. **インテグレーションを作る**: 手順6の2と同じ画面で、更新の検知用の内部のインテグレーション（例「Shuko 更新の検知」）を作ります。
2. **ToDo のデータベースだけに接続する**: いつも使っている ToDo のデータベース（データソース ID `7949c589-2ebd-4419-be83-30c123be7fec`）を開き、「•••」→「Add connections」で1のインテグレーションを選びます。設定ページには接続しません。
3. **トークンを保存する**（ユーザー本人が行います）:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\set-token.ps1
   ```

   - 入力は画面に出ません。1のインテグレーションのトークンを貼り、Enter を押します。
   - `%LOCALAPPDATA%\Shuko\watch\notion-token.dpapi` に、今のユーザーの DPAPI で暗号化して保存します。読めるのは、この PC のこのユーザーだけです。
   - `set-token: saved to ... Read back OK; length <数>.` と出れば済んでいます。トークンの値そのものは出しません。
   - トークンを替えるときは `-Force` を付けて実行し直します。
   - このファイルはエージェントに開かせません。読むのは `scripts/lib/read-secret.ps1` だけです。
4. **登録の前に確かめる**:

   ```powershell
   node tools/watch/watch.mjs --check-token
   node tools/watch/watch.mjs --check
   node tools/watch/watch.mjs --dry-run
   ```

   | コマンド | 何を見るか | 済んだ印 |
   |---|---|---|
   | `--check-token` | トークンを読めるか（Notion には接続しない） | `"ok": true`、`"prefix": "ntn_"` か `"secret_"` |
   | `--check` | ToDo のデータベースの項目が想定と合うか（書かない） | `"ok": true`、`schemaErrors` が空 |
   | `--dry-run` | GitHub と Open VSX を取得し、作る ToDo の計画を出す（Notion に書かず、`state.json` も `watch.log` も書かない） | `"exitCode": 0`、`current.label` が `1.146.0-1` |

   `--dry-run` の `plan` に並ぶものが、初めての実行で ToDo になります（2026-11-15 の試しでは、Claude Code 拡張 2.1.325 と .env の拡張 0.2.4 の2件）。

5. **登録する内容を見る**（何も登録しません）:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -DryRun
   ```

   次のように出ます。

   ```
   register-task: task      \Shuko\watch
   register-task: run       C:\Program Files\nodejs\node.exe "E:\develop\self\Team\projects\ai-editor\tools\watch\watch.mjs"
   register-task: in        E:\develop\self\Team\projects\ai-editor  (builderRepo from local.json)
   register-task: daily at  06:00  (StartWhenAvailable, only while <PC>\<ユーザー> is logged on)
   register-task: (dry run) nothing registered.
   ```

6. **登録する**:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1
   ```

   - 毎日 6:00 に動きます。その時刻に PC が止まっていたら、次に動けるときに動きます。時刻を変えるときは `-At 07:30` のように付けます。
   - 「ユーザーがログオンしているときだけ実行」で登録します。トークンの復号に、このユーザーの権限が要るためです。
   - 管理者の権限は要らない見込みです（普通の権限で、自分のユーザーで動くタスクを登録するため。この PC ではまだ試していません）。`Access is denied` で止まったら、その出力を知らせてください。
   - `node.exe` の場所は登録のときに決めて書き込みます。Node.js を入れ直して場所が変わったら、もう一度登録します（同じ名前のタスクは上書きされます）。

7. **1回動かして確かめる**:

   ```powershell
   Start-ScheduledTask -TaskPath '\Shuko\' -TaskName watch
   Get-ScheduledTask -TaskPath '\Shuko\' | Get-ScheduledTaskInfo
   ```

   `LastTaskResult` が `0` で、Notion の ToDo に「取り込みの検証: …」ができていれば済んでいます。ログは `%LOCALAPPDATA%\Shuko\watch\watch.log` にあります。もう一度動かしても、同じ ToDo は増えません。

- 登録を外すとき: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -Unregister`

### 毎週の取り込み（ToDo が来たら）

流れは [06](06-update-watch-and-take-in.md) の1節と8節のとおりです。ここでは入口だけを書きます。

1. ToDo の「詳細・メモ」にある起動のコマンドを、ビルドリポジトリの直下で実行します（例 `node scripts/take-in.mjs core 1.147.0`、`node scripts/take-in.mjs ext anthropic.claude-code 2.1.325`）。今使っている版には触りません。
2. `records/take-in/<ラベル>/verdict.md` を読みます。
3. 採るなら `node scripts/adopt.mjs <ラベル>` を実行します。
4. 本体のとき: Shuko を閉じ、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 <ラベル>` で切り替えます。拡張のとき: `node scripts/install-extensions.mjs` を実行し、Shuko を再起動します。
5. 判定に書かれた「手で確かめる項目」を確かめ、ToDo を `Done` にします。

## 8. 戻し方

### 前の版に戻す

1. Shuko を全部閉じます。
2. 実行します。

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -Previous
   ```

   - `history.txt` を後ろから見て、今の版へ切り替えたときの「前」の版に戻します。2回続けると、2つの版を行き来します。
   - 版を名指しするときは `switch.ps1 <ラベル>`。どの版があるかは `switch.ps1 -List` で見ます。
   - 切り替えるたびに、その前のユーザーのデータ（`settings.json`・`keybindings.json`・`snippets\`・`tasks.json`・`globalStorage\state.vscdb`）を `<installRoot>\backups\<日時>\User\` に写します。
3. 新しい版がユーザーのデータを書き換えていて、戻した版で不具合が出るときは、Shuko を閉じ、`backups\<日時>\User\` の中身を `%APPDATA%\Shuko\User\` に写し戻します。どの切り替えの写しかは、同じフォルダの `backup.json`（`from`・`to`・`createdAt`）で分かります。

- 終了コード: 0 済んだ、1 誤り（`message` を見る）、3 Shuko が動いている（閉じてからやり直す）、4 切り替える先の版が、台帳の拡張の `engines` を満たさない（切り替えていない）。
- 版のフォルダは消しません。`keepVersions`（既定3）より多くなると、`switch.ps1` が消してよい版の一覧（`removable`）を出します。要らなければ、エクスプローラーで `<installRoot>\versions\<ラベル>` を消します。`current` が指している版は消さないでください。
- 初めて入れた版しか無いうちは、`-Previous` は「history.txt has no earlier version」で止まります。そのときは下の「本家の VS Code に戻る」にします。

### 拡張を前の版に戻す

台帳は git にあるので、前の台帳の版を入れ直します（[04](04-bundled-extensions.md) の5節）。

```powershell
git log --oneline -- extensions.lock.json
node scripts/install-extensions.mjs --rev <前のコミット>
```

前の版の VSIX は `C:\b\cache\vsix\` に残っているので、取り直しはしません。終わったら Shuko を再起動します。

### 本家の VS Code に戻る

本家の VS Code は消していないので、スタートメニューの「Visual Studio Code」から起動するだけです。本家のデータ（`%APPDATA%\Code`、`%USERPROFILE%\.vscode\`）には Shuko の手順は触れていません。

Shuko をしばらく使わないなら、次も行います（どれも、やり直せば戻せます）。

1. 更新の検知を止める: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -Unregister`
2. スタートメニューのショートカットを消す: `Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Shuko.lnk')`
3. 環境変数の画面（手順3.2）で、ユーザーの `Path` から `...\Shuko\current\bin` を消す。

すっかり消すときは、さらに次を消します: `<installRoot>`（既定 `%LOCALAPPDATA%\Programs\Shuko`）、`%APPDATA%\Shuko`、`%USERPROFILE%\.shuko`、`%USERPROFILE%\.shuko-shared`（あれば）、`%LOCALAPPDATA%\Shuko`（`local.json` と更新の検知のトークン）。Notion の2つのインテグレーションは、手順6の2の画面で消せます。Shuko は起動のときに URL の `shuko://` をユーザーのレジストリ（`HKCU\Software\Classes\shuko`）に登録します（本家と同じ動き。1.146.0 の `src/vs/platform/url/electron-main/electronUrlListener.ts`）。気になるなら、それも消します。

## うまくいかないとき

| 症状 | 対処 |
|---|---|
| `configure.ps1` が `is not valid JSON` か `has errors` で止まる | `%LOCALAPPDATA%\Shuko\local.json` を手で直したときの誤り。キーの名前は大文字と小文字を区別する（`installRoot`・`keepVersions`・`builderRepo`・`buildRoot` だけ）。直すか、ファイルを消して手順1をやり直す |
| `switch.ps1` が `zip SHA-256 ... does not match` で止まる | zip が違うか壊れている。`-Sha256` の値と zip を見直す |
| `switch.ps1` が `version folder already exists` で止まる | 同じラベルの版のフォルダが既にある。別のラベルにするか、`-Zip` を外して `switch.ps1 <ラベル>` だけを実行する |
| ショートカットを開いても何も起きない、すぐ閉じる | Smart App Control がオンになっていないかを見る（`scripts/check-env.ps1` の `smartAppControl`）。オフでも起きるときは `%APPDATA%\Shuko\logs\` の新しいフォルダを知らせてください |
| エディタの中のターミナルから `Shuko.exe` を直に起動すると、窓が開かない | そのターミナルに `ELECTRON_RUN_AS_NODE=1` が残っていると、Node.js として動く。スタートメニューか `shuko` から起動する |
| `shuko` が見つからない | PATH を足したあとに開いた窓かを確かめる。`where.exe shuko` が何も出さなければ、手順3.2 をやり直す |
| 起動し直しても表示が英語のまま | 手順4の `argv.json`（`%USERPROFILE%\.shuko\argv.json`）に `"locale": "ja"` があるか、拡張の画面に日本語の言語パックがあるかを見て、Shuko を再起動する |
| `watch.mjs --check-token` が `ok: false` | `error` を見る。トークンのファイルが無い（手順7の3をやり直す）、別のユーザーか別の PC で作ったので読めない（同じユーザーで作り直す）など |
| `watch.mjs --check` が `schemaErrors` を出す | ToDo のデータベースの項目の名前か型が、[06](06-update-watch-and-take-in.md) の2.3 の表と違う。プログラムは項目を作らず、書かずに止まる。出力をそのまま知らせてください |
| タスクの `LastTaskResult` が 0 でない | `%LOCALAPPDATA%\Shuko\watch\watch.log` の末尾を見る。終了コード 1 は取得か Notion のどこかの失敗、2 は設定の誤り |

## 参考

- 配布の形と `local.json`: [02](02-repository-and-build.md) の6節。台本の細目は `tasks/2026-11-13-p2-build-switch/build-switch-design.md`
- 台帳の拡張: [04](04-bundled-extensions.md) の5節
- 設定の同期: [05](05-settings-sync.md)、`extensions-src/notion-sync/README.md`
- 更新の検知と取り込み: [06](06-update-watch-and-take-in.md)、`TAKE-IN.md`
- 外部ツール: [01](01-requirements.md) の4.1

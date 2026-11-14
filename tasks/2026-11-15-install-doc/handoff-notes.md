# 引き継ぎ: docs/install.md の下書き

- 担当: 蒙恬（meng-tian）、2026-11-15
- 依頼: `tasks/2026-11-15-install-doc/brief.md`

## 結果

- 結果: 完了（下書き。リーダーが `docs/install.md` に置く）
- 成果物:
  - `tasks/2026-11-15-install-doc/install-draft.md`（手順書の下書き。2026-11-15 の再検証で合格し、リーダーが `docs/install.md` に移した）
  - `tasks/2026-11-15-install-doc/handoff-notes.md`（この文書）
  - 試しの場所 `C:\b\trial-install-doc\`（下の「試した範囲」。版のフォルダ2つで約 2.4 GB。消す道が私の許可に無いので残してある）
- 要点:
  1. brief の8項目（local.json、zip と `current`、スタートメニューと PATH、台帳の拡張、外部ツール、Notion、更新の検知、戻し方）を、台本の実際の引数に合わせて書いた。本家の VS Code のデータと分かれていることは冒頭の表に書いた。
  2. スタートメニューと PATH を初めて登録する台本は無い。手順書には手で行う手順を書いた。`configure.ps1 -InstallRoot` があとで向け直せる形（「プログラム」フォルダの直下の .lnk、ユーザーの PATH の `<installRoot>\current\bin`）にそろえてある。
  3. 版のラベルは `1.146.0-1` にした（zip の名前は `1.146.0-p2-all`）。更新の検知は、ラベルが `x.y.z` か `x.y.z-N` の形のときだけ、今の版をラベルから読むため。
  4. 実際の local.json・スタートメニュー・PATH・タスクスケジューラ・Notion には触れていない。ただし、試しの5（`install-extensions.mjs --portable`）は台本の欠陥で普段の場所（`%USERPROFILE%\.shuko`・`%APPDATA%\Shuko`）に書いていた（下の「試しが普段の場所に漏れた」。2026-11-15 に追記）。試しは `C:\b\trial-install-doc\` と、各台本が持つ試しの形（`-ConfigPath`・`-NoMove`・`-NoShellIntegration`・`-UserDataDir`・`-ExpandOnly`・`--dry-run`・`--portable`・`-DryRun`・`--state-dir`・`--token-file`）だけで行った。
  5. 確かめていない点が3つある（未解決の1〜3）。ショートカットがジャンクションを通したパスのまま保存されるか、タスクの登録に管理者の権限が要らないか、データの置き場所の実機での確認。

## 試した範囲（2026-11-15、この PC、普通の権限）

設定はすべて `C:\b\trial-install-doc\cfg\local.json`。上から順に行った。

| # | コマンド（リポジトリの直下） | 結果 |
|---|---|---|
| 1 | `configure.ps1 -ConfigPath C:/b/trial-install-doc/cfg/local.json` | ok。`created local.json with the defaults`。`installRoot` は `%LOCALAPPDATA%\Programs\Shuko`、`builderRepo` は `E:\develop\self\Team\projects\ai-editor`（このリポジトリ）、`keepVersions` 3、`buildRoot` `C:\b` |
| 2 | `configure.ps1 -ConfigPath … -InstallRoot C:/b/trial-install-doc/A -NoMove -NoShellIntegration` | ok。試しの installRoot に向けた。`-NoMove` は、普段の場所 `%LOCALAPPDATA%\Programs\Shuko` に何かがあっても動かさないため（私の許可ではその場所を読めず、有無を確かめられない） |
| 3 | `switch.ps1 1.146.0-1 -Zip C:/b/dist/1.146.0-p2-all.zip -Sha256 15aa0ce7…6f6f -ConfigPath … -UserDataDir C:/b/trial-install-doc/userdata` | ok（約20秒）。SHA-256 一致、zip の最上位のフォルダ `Shuko-win32-x64-1.146.0-p2-all` を `versions\1.146.0-1` にした。`exe` は `Shuko.exe`、`cli` は `bin\shuko.cmd`、`versionedFolder` は null。engines 8件すべて満たす。初めてなので `backup.missing` に5つ。history は `<日時>\t-\t1.146.0-1` |
| 4 | `node scripts/install-extensions.mjs --config … --dry-run` | `dry-run`。8件とも `sha256Ok: true`（キャッシュ `C:\b\cache\vsix` から）。`editor.dataFolderName` は `.shuko`、`argv.path` は `C:\Users\<ユーザー>\.shuko\argv.json`（書いていない） |
| 5 | `node scripts/install-extensions.mjs --config … --portable C:/b/trial-install-doc/portable` | ok（約18秒）と出たが、**試しの場所に入っていなかった**（2026-11-15 の検証で分かった。下の「試しが普段の場所に漏れた」）。`portable\` が無いまま CLI を走らせたので、エディタは `--portable` を捨て、8つの拡張を普段の `%USERPROFILE%\.shuko\extensions` に入れ、CLI のログを `%APPDATA%\Shuko` に書いた（01:33 ごろ）。`compare.ok: true` は普段の場所の一覧を読んだ結果。`argv.json` だけが `portable\argv.json` に作られた。台本は `tasks/2026-11-15-install-doc-fix/` で直し、`C:/b/trial-install-doc/portable-fix` でやり直した（8つとも `portable-fix\extensions` に入った） |
| 6 | `switch.ps1 1.146.0-2 -Zip <同じ zip> -ExpandOnly -ConfigPath …` | ok。展開だけ。`current` は `1.146.0-1` のまま |
| 7 | `switch.ps1 1.146.0-2 -ConfigPath … -UserDataDir C:/b/trial-install-doc/portable/user-data` | ok。`1.146.0-1 → 1.146.0-2` |
| 8 | `switch.ps1 -Previous -ConfigPath … -UserDataDir …` | ok。`1.146.0-2 → 1.146.0-1` に戻った |
| 9 | `configure.ps1 -ConfigPath … -InstallRoot C:/b/trial-install-doc/B -NoShellIntegration` | ok。`versions`・`history.txt`・`backups` を A から B へ移し、`B\current → B\versions\1.146.0-1` を作り直し、local.json を最後に書いた |
| 10 | `switch.ps1 -List -ConfigPath …` | ok。B の下で current `1.146.0-1`、版2つ、history 3行、removable なし |
| 11 | `tools/watch/register-task.ps1 -ConfigPath … -DryRun` | 登録せず。`\Shuko\watch`、`C:\Program Files\nodejs\node.exe "E:\…\tools\watch\watch.mjs"`、作業場所は builderRepo、毎日 06:00、`KOU-MAIN\kou_z` のログオン中だけ |
| 12 | `tools/watch/check-dpapi.ps1 -Dir C:/b/trial-install-doc/dpapi -Keep` | OK（ダミーの値。read-secret の終了コード 0、平文はファイルに無い） |
| 13 | `node tools/watch/watch.mjs --check-token --config … --state-dir C:/b/trial-install-doc/watch --token-file C:/b/trial-install-doc/dpapi/selfcheck.dpapi` | `ok: true`、`length: 57`、`prefix: ntn_`（ダミー） |
| 14 | `node tools/watch/watch.mjs --dry-run --quiet --config … --state-dir … --token-file …` | `exitCode: 0`。`current` は `{ version: 1.146.0, label: 1.146.0-1, source: current }`。計画は2件（`anthropic.claude-code 2.1.322 → 2.1.325`、`weixu.wx-vsce-dotenv 0.2.3 → 0.2.4`）。Notion に書かず、state も log も書いていない |
| 15 | `scripts/check-env.ps1`、`pwsh --version` | missing なし、Smart App Control は off、C: の空き 20.5 GB。PowerShell 7.7.0、Git 2.54.0、Python 3.14.7、Node.js 24.22.1 |

試していないもの（brief と裁定で、ユーザーが行うもの）: 本物の `local.json` の作成、スタートメニューと PATH の登録、Shuko の起動、`set-token.ps1`（秘密の場所に書くため）、`watch.mjs --check`（Notion に接続するため）、`register-task.ps1` の登録、`configure.ps1` の手順5（ショートカットと PATH の向け直し）、違うドライブへの移動。

### 試しが普段の場所に漏れた（2026-11-15 の検証で分かり、事実に合わせて直した）

- 前の版のこの節は「試していないもの」に「`install-extensions.mjs` を普段の場所（`%USERPROFILE%\.shuko`）に向けた導入」を挙げていた。事実と違った。上の表の5で、8つの拡張は `%USERPROFILE%\.shuko\extensions` に入っていた。
- 普段の場所にできたと見られるもの（2026-11-15 01:33 ごろ）: `%USERPROFILE%\.shuko\extensions\`（8つの拡張と `extensions.json`）、`%APPDATA%\Shuko\`（CLI のログ `logs\<日時>\cli.log`。やり直しの試しでは、ポータブルの `user-data\` に `logs\` と `CachedProfilesData\` ができたので、同じものが `%APPDATA%\Shuko\` にできたと見られる）。リーダーが有無と日時を確かめた（`tasks/2026-11-15-install-doc-fix/brief.md`）。私の許可ではその場所を読めない。
- 漏れていないもの: `argv.json`（`portable\argv.json` に書いた）、本家の VS Code のデータ（`.shuko` の版の CLI なので、本家の場所は使わない）、local.json・スタートメニュー・PATH・タスクスケジューラ・Notion。
- 原因: 1.146.0 の `src/bootstrap-node.ts` の `configurePortable`（239〜247行）は、`VSCODE_PORTABLE` の場所が在るときだけポータブルとして扱い、無ければ黙って消す。台本は場所を作らずに CLI を走らせていた。
- 直し: `scripts/install-extensions.mjs` は、CLI を走らせる前に `--portable` の場所を作り、ポータブルとして扱われる形（場所がフォルダとして在る、product.json に `target` が無い）を確かめてから走らせる。入れたあとに `<portable>\extensions` があることも確かめる（`tasks/2026-11-15-install-doc-fix/handoff-notes-meng-tian.md`）。

## 手順書のコマンドと台本の引数の照らし合わせ（大岡越前守の検証の入口）

| 手順書の節 | コマンド | 台本の根拠 |
|---|---|---|
| 1 | `configure.ps1`（引数なし）、`-InstallRoot`・`-NoMove`・`-KeepVersions`・`-BuildRoot`・`-BuilderRepo` | `scripts/configure.ps1` の param（36〜44行）。終了コード 0・1・3（26行）。`-BuilderRepo` は `extensions.lock.json` が無いと止まる（254行） |
| 2 | `switch.ps1 <label> -Zip <zip> -Sha256 <hex>`、`switch.ps1 -List` | `scripts/switch.ps1` の param（48〜59行）、SHA-256 の照合（307〜310行） |
| 3.1 | .lnk は `[Environment]::GetFolderPath('Programs')` の直下、`TargetPath` は `<installRoot>\current\Shuko.exe` | `configure.ps1` の340〜353行（直下の `*.lnk` だけを見て、`TargetPath` が `<前>\current` の下なら向け直す） |
| 3.2 | ユーザーの PATH に `%LOCALAPPDATA%\Programs\Shuko\current\bin` | `configure.ps1` の `Update-PathEntries`（各項目を展開して `<前>\current\bin` と比べる）。`HKCU\Environment` を生の値と種類のまま読み書き |
| 4 | `node scripts/install-extensions.mjs --dry-run`、引数なし、`--rev <commit>` | `scripts/install-extensions.mjs` の `parseArgs`（191〜224行）。終了コード 0・1・2・3（24行） |
| 7 | `tools\watch\set-token.ps1`（`-Force`）、`watch.mjs --check-token`・`--check`・`--dry-run`、`register-task.ps1`（`-DryRun`・`-At`・`-Unregister`） | `tools/watch/set-token.ps1` の param、`tools/watch/watch.mjs` の `parseArgs`（96〜116行）、`tools/watch/register-task.ps1` の param（34〜43行）と出力（87〜99行） |
| 7（取り込み） | `take-in.mjs core <tag>`・`ext <id> [<version>]`、`adopt.mjs <label>` | `scripts/take-in.mjs` の1〜13行、`scripts/adopt.mjs` の2〜11行 |
| 8 | `switch.ps1 -Previous`、`switch.ps1 <label>`、`install-extensions.mjs --rev`、`register-task.ps1 -Unregister` | `switch.ps1` の296〜301行（history が無いと `history.txt has no earlier version`）、終了コード 0・1・3・4（35行） |

曹参へ（テストが要る点）: 手順書そのものにテストは要らないと考える。手順書が頼る台本のふるまいのうち、次がテストで押さえられているかを見てほしい。

- `configure.ps1` の手順5: 「プログラム」フォルダの直下にある、`<前>\current\Shuko.exe` を指す .lnk が向け直されること、サブフォルダの .lnk は見ないこと。PATH の項目が `%LOCALAPPDATA%\...` の形でも一致すること（`Update-PathEntries -Raw '%LOCALAPPDATA%\Programs\Shuko\current\bin;C:\x' -OldBin '<展開した前>\current\bin' -NewBin 'D:\S\current\bin'` → `'D:\S\current\bin;C:\x'`）。
- `labelToVersion('1.146.0-p2-all')` が null で、`currentCoreVersion` が `upstream.json` に戻ること（ラベルの形の決めごとの根拠）。

## docs/ との食い違い・気づいたこと

1. **brief の `-WhatIf`**: どの台本も `-WhatIf` を持たない。試しの形は台本ごとに違う（`configure.ps1` は `-ConfigPath`・`-NoMove`・`-NoShellIntegration`、`switch.ps1` は `-ConfigPath`・`-UserDataDir`・`-ExpandOnly`、`install-extensions.mjs` は `--dry-run`・`--portable`、`register-task.ps1` は `-DryRun`、`watch.mjs` は `--dry-run`・`--state-dir`・`--token-file`）。それで試した。
2. **docs/02 の6節の「推定」**: ユーザーのデータ `%APPDATA%\Shuko\User`、拡張 `%USERPROFILE%\.shuko\extensions` は、docs では「推定。Phase 1 で確かめて直す」のまま。手順書ではソースと台本の読み（`switch.ps1` の既定の `UserDataDir` は `%APPDATA%\<nameShort>`、`install-extensions.mjs` の `argvPathFor` は `%USERPROFILE%\<dataFolderName>\argv.json`）として書き、手順4.1の初めての起動で確かめることにした。docs/04 の5節の「推定」も同じ。
3. **docs/01 の4.1 の Claude Code の CLI**: docs は「公式の手順」とだけ書く。手順書には公式のページ（https://code.claude.com/docs/en/setup 、2026-11-15 に読んだ）の Windows PowerShell のコマンド `irm https://claude.ai/install.ps1 | iex` を書いた。同じページに「You do not need to run as Administrator.」とある。winget（`winget install Anthropic.ClaudeCode`）もあるが、自動では更新されないと書かれているので、手順書には載せなかった。
4. **Notion のインテグレーションを作る場所**: docs/05 の7節と docs/06 の2.4 は場所を書いていない。公式のページ（https://developers.notion.com/docs/authorization 、2026-11-15 に読んだ）では、開発者のポータル `https://app.notion.com/developers/connections` の「New integration」で作り、ワークスペースのオーナーが要り（"You are required to be a workspace owner to create a connection."）、トークンは「Configuration」のタブにあり、ページへの接続は「•••」→「Add connections」。docs の「Add connections」と合う。
5. **docs/06 の5節（初めての起動は英語）**: `argv.json` に `locale` を書いても、新しいユーザーのデータでの初めての起動は英語になる。手順書の4.1に「一度閉じて起動し直す」と書いた。
6. **`register-task.ps1 -ConfigPath`**: 登録のときに `builderRepo` を読むのに使うだけ。登録されるタスクは `watch.mjs` を `--config` なしで動かすので、実行のときは普段の `%LOCALAPPDATA%\Shuko\local.json` を読む。普段の利用では問題ない。試しで登録する人が誤らないよう、台本の説明に一言あるとよい（直すかはリーダーの判断。私は変えていない）。
7. **`configure.ps1 -InstallRoot` が書く値**: 渡した文字列のまま `local.json` に書く（試しでは `C:/b/trial-install-doc/B` のようにスラッシュのまま）。読むときに正規化されるので動きは正しい。見た目だけの点。
8. **エージェントの環境の `ELECTRON_RUN_AS_NODE=1`**: `check-env.ps1` の `envVars` に出た。エディタの中のターミナルから `Shuko.exe` を直に起動すると Node.js として動く恐れがあるので、手順書の「うまくいかないとき」に1行書いた。`shuko.cmd` と `install-extensions.mjs` は自分で扱う（後者は `childEnv` で外している）。
9. **URL の登録**: Shuko は起動のときに `shuko://` を `HKCU\Software\Classes` に登録する（1.146.0 の `src/vs/platform/url/electron-main/electronUrlListener.ts` の53〜57行。ポータブルのときは登録しない）。docs には書かれていない。手順書の「すっかり消すとき」に書いた。

## 未解決の点（リーダーの判断・ユーザーの確かめが要るもの）

1. **ショートカットとジャンクション**: `WScript.Shell` の `CreateShortcut` で `TargetPath` を `...\current\Shuko.exe` にしたとき、Windows がジャンクションを解いて `versions\<label>\Shuko.exe` で保存しないかを確かめていない。brief の「台本の試しの形だけ」に従い、台本に無い PowerShell を走らせなかったため。解かれると、切り替えてもショートカットが古い版を開き、`configure.ps1` の向け直しも効かない。手順書には、保存のあとに `TargetPath` を読み直して確かめる行を入れた。ユーザーが手順3.1を行うときに分かる。
2. **タスクの登録に管理者の権限が要るか**: 「要らない見込み」と書いた。公式の明記は見つからなかった（Web の検索では、普通の権限で `\Shuko\` のような新しいフォルダを作れるかの決め手は無かった）。ユーザーが手順7の6を行うときに分かる。
3. **最初の版のラベル**: 下書きでは `1.146.0-1`。ビルドの記録の名前（`1.146.0-p2-all`）と違う名前で版のフォルダを作ることになる。docs/02 の7節の「採用した版にはタグを打つ」を最初の版にも当てるか（このリポジトリにタグ `1.146.0-1` を打つか）、ラベルを別の形にするかは、リーダーの判断。
4. **初めての登録の台本を作るか（別案）**: 今はスタートメニューと PATH の初めての登録が手作業。`configure.ps1` に初めての登録の入口（例 `-RegisterShell`。.lnk を作り、PATH に1項目を足す）を足せば、手順書の3節がコマンド1つになり、未解決の1も台本の試しで確かめられる。範囲外なので作っていない。採るならリーダーが決める。
5. **試しの場所の片付け**: `C:\b\trial-install-doc\`（`B\versions\1.146.0-1`・`1.146.0-2`、portable、dpapi のダミー、cfg）が残っている。私の許可には消すコマンドが無い。要らなければ消してほしい。
6. **台本のサブフォルダの .ps1**: `scripts/lib/local-config.ps1` を直に実行するのは、私の許可（`scripts/*.ps1`）に当たらず止められた。代わりに `configure.ps1`（引数なし）で値を確かめ、手順書もそちらで書いた。許可の追加は要らない。

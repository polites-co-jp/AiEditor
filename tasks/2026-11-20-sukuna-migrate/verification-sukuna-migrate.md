# Sukuna への移行の確かめ（手順3〜5）

- 記入: 大岡越前守（2026-11-24）
- 確かめた成果: 蒙恬の手順3（`switch.ps1` で版を展開）、手順4（移行の台本 `-List`・`-Apply`）、手順5（`install-extensions.mjs` の `--dry-run` と本番）。読んだのは `migrate-notes.md`・`migrate-list.txt`・`migrate-apply.txt`・`install-extensions-dryrun.json`・`install-extensions-result.json`
- 照らした基準: `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の3.2・3.3・4節（順7）、`docs/install.md` の2・4節、`records/take-in/1.146.0-p5-c-all-r7/gate-p5-c-all-r7.md`、`tasks/2026-11-18-rename-sukuna-survey/permission-response.md`、`brief.md` の完了条件
- 守ったこと: Sukuna を起動していない。秘密の場所（`watch`・`secrets`）と秘密のファイルは開いていない。Sukuna の場所（`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Programs\Sukuna`・`%LOCALAPPDATA%\Sukuna`）は私の `read_paths` の外なので読んでおらず、リーダーが 2026-11-24 に確かめて渡した事実を使った（2026-11-19 の記録 P1）。コードは直していない

## 判定: 合格

4つの見る点のどれにも、合格の条件を満たさない所は無かった。指摘は資料の古い記述と、確かめの残り（下の「指摘」と「手順7で見てほしい点」）で、移行の結果を変えるものは無い。

## 1. 版の展開（手順3）

| 項目 | 基準 | 結果 | 根拠 |
|---|---|---|---|
| zip の SHA-256 | r7 の関門の値 `5b7ea885…51d1` | 一致 | 自分で `sha256sum tmp/b/dist/1.146.0-p5-c-all-r7.zip` を打った: `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`。関門の6行・34行と同じ。蒙恬の記録でも `switch.ps1` の `zipSha256` が一致 |
| ラベル | `1.146.0-1`（docs/install.md の2、docs/02 の6節、rename-plan.md の3.2・3.3・6節） | 一致 | 蒙恬の打った行は `switch.ps1 1.146.0-1 -Zip tmp/b/dist/1.146.0-p5-c-all-r7.zip -Sha256 5b7ea885…51d1`（`migrate-notes.md` の6節の表 #4）。リーダーの事実でも `current` は `versions\1.146.0-1` を指す |
| `target.exe`・`target.cli` | `...\versions\1.146.0-1\Sukuna.exe`（install.md の2の見どころ） | 一致 | `migrate-notes.md` の6.1。`cli` は `...\versions\1.146.0-1\bin\sukuna.cmd` |
| `version`・`commit` | 1.146.0、r7 の commit `b76374c6…` | 一致 | 6.1 の `commit` `b76374c6fc633747549a7b1a44a1a5364c7fe8f2` は関門の6行と同じ |
| `engines.unsatisfied` | 空 | 一致 | `checked` 7、`unsatisfied` 空。台帳の `engines` の最も高いものは `^1.101.0` で、1.146.0 で満たす |
| `history` | `<日時>\t-\t1.146.0-1` | 一致 | `2026-11-24T21:37:16.9595714+09:00\t-\t1.146.0-1`。リーダーの事実でも `history.txt` がある |
| `backup.missing` | 初めてのときは5つ全部 | 一致 | 手順1で退けた後なので `copied` 空、`missing` 5つ。`backups\20261124-213716`（`backup.json` だけ）。リーダーの事実でも `backups` がある |
| 検知の警告 | 手順7の前は `no update watch record` が出てよい | 一致 | 6.1・6.2 |
| `switch.ps1 -List` | `current` が `1.146.0-1`、`versions` に `1.146.0-1` | 一致（蒙恬の記録） | 6.2。**私は打てなかった**（私の許可の `bash` に `scripts/switch.ps1` の行が無い）。リーダーの事実（`current` → `versions\1.146.0-1`、`backups`・`history.txt`・`versions` がある）と合う |

## 2. 移行（手順4）

### 2.1 写すもの・除くもの・名前を変えるもの（rename-plan.md の3.2 の表）

| 3.2 の行 | 求めること | 出力 | 判定 |
|---|---|---|---|
| ユーザーのデータ | `%APPDATA%\Shuko` → `%APPDATA%\Sukuna` へ写す（移さない） | `kind` appdata、`from`・`to` がそのとおり、`destState` absent | 合う |
| 除くもの | `Cache`・`CachedData`・`Code Cache`・`GPUCache`・`CachedExtensionVSIXs`・`logs`・`Crashpad`・`clp`・`languagepacks.json` | `excluded` は `Cache`・`CachedData`・`clp`・`Code Cache`・`GPUCache`・`languagepacks.json`・`logs`。台本の一覧（`migrate-from-shuko.ps1` の73行 `$script:ExcludedTop`）は3.2 の9つと `code.lock` の10。元に無い `CachedExtensionVSIXs`・`Crashpad`・`code.lock` は出ない | 合う（`code.lock` は3.2 に無い追加だが、多重起動の印で写すと害になるもの。除く側への足し算なので3.2 に反しない） |
| `Local State` は写す | 写す | `entries` に `Local State`（490 バイト） | 合う |
| 名前を変えるもの | `User\globalStorage\shuko.notion-sync\` → `sukuna.notion-sync\` | `renamed` 空。元に `shuko.<名前>` のフォルダが無い（`userFiles` の globalStorage は `state.vscdb`・`.backup`・`storage.json`・PowerShell のセッション1つだけ） | 合う（名前を変える対象が元に無い。台本の働きは `tests/migrate-from-shuko.test.mjs` の模擬で確かめ済み。下の2.4） |
| 拡張 | 写さない（台帳から入れ直す） | 台本の対象は `argv.json` の1ファイルだけ（`kind` argv）。`extensions` は写していない | 合う |
| `argv.json` | `%USERPROFILE%\.shuko\argv.json` → `%USERPROFILE%\.sukuna\argv.json` に写す | 1ファイル 309 バイト。写した後も 309 バイト | 合う |
| 検知の状態とトークン（`watch`） | あれば写す | `sourceExists` false、0 件。`writtenTo` に無い | 合う（元が無い） |
| 予備の秘密の場所（`secrets`） | あれば写す | `sourceExists` false、0 件。`writtenTo` に無い | 合う（元が無い） |
| `local.json` | 写さない（`configure.ps1` が作る） | 台本の対象に無い。リーダーの事実で `%LOCALAPPDATA%\Sukuna` には `local.json` だけ | 合う |

### 2.2 数と照らし合わせ

- `-List` と `-Apply` の `locations` は同じ中身（2つのファイルを並べて読み、appdata の18項目・除く7項目・`userFiles` 7件・argv・watch・secrets が同じ値であることを見た）。
- appdata の `entries` の18項目の `files` を足すと 87、`bytes` を足すと 16,793,154。最上位の `files`・`bytes` と合う（手で足した）。
- `copied`: appdata は 87 / 45 / 16,793,154（見込みと同じ、`verified` true、`mismatches` 空）。argv は 1 / 0 / 309（見込みと同じ、`verified` true、`mismatches` 空）。
- `writtenTo` は `%APPDATA%\Sukuna` と `%USERPROFILE%\.sukuna\argv.json` の2つだけ。
- `createdCount` 135 = appdata（写し先のフォルダ1 + フォルダ45 + ファイル87 = 133）+ argv（`.sukuna` のフォルダ1 + `argv.json` 1 = 2）。台本の `New-DirChain` が作ったフォルダとファイルを数える作り（399〜427行）と合う。`.sukuna` は手順1で退けてあったので、台本が作り直したことになり、数が合う。
- `running`・`blockers` は空、`result` ok、終了コード 0（どちらも）。

### 2.3 リーダーの事実との照らし

- `%APPDATA%\Sukuna` の最上位: 写した18項目（`Backups`・`blob_storage`・`CachedConfigurations`・`CachedProfilesData`・`DawnGraphiteCache`・`DawnWebGPUCache`・`DIPS`・`Local State`・`Local Storage`・`machineid`・`Network`・`Preferences`・`Service Worker`・`Session Storage`・`Shared Dictionary`・`SharedStorage`・`User`・`WebStorage`）と `logs` の19。除いたもののうち `logs` 以外（`Cache`・`CachedData`・`clp`・`Code Cache`・`GPUCache`・`languagepacks.json`）は無い。
- **`logs` は、`-Apply` の後に拡張を入れた CLI が作ったもの**と判断する。根拠は2つ。
  1. 本体のソース（r7 の作業ツリー `tmp\b\wt\r7\w`）: `src/vs/code/node/cliProcessMain.ts` の139・143行が、CLI の起動のたびに `environmentService.logsHome` に `cli` のログを作る。`src/vs/platform/environment/common/environmentService.ts` の73〜79行で、`logsHome` は `<userDataPath>\logs\<日時>`。`--install-extension` も `--list-extensions` もこの道を通る。
  2. `-Apply` の照らし合わせは、写し先を除く一覧なしで数え直す（`Get-Tree -Root $pl.dst`、438行）。その時に `logs` の下にファイルがあれば、`mismatches` に出るか数が合わなくなる。`verified` true・数が一致なので、`-Apply` の時点で `logs` にファイルは無かった。順も、`-Apply` → `install-extensions.mjs`（`startedAt` 2026-11-24T12:40:04Z = 21:40 JST）で、記録の順と合う。
- `User` の下（`History`・`globalStorage`・`settings.json`・`snippets`・`workspaceStorage`）: `User` の25ファイルは `settings.json` 1 + globalStorage 4 + `workspaceStorage` 18 + `History` 2 = 25 で、`snippets` はファイルの無いフォルダ。CLI が作る `User`（`appSettingsHome`、cliProcessMain.ts の134行）は写した後なので既にあった。`snippets` を CLI が作る道は無く、写したフォルダと見てよい（フォルダの数 45 が写した後に一致）。
- `%USERPROFILE%\.sukuna\argv.json` のキー3つ（`locale` "ja"、`enable-crash-reporter` false、`crash-reporter-id`）: 写したまま（309 バイトで照らし合わせ一致、`install-extensions.mjs` の `argv.changed` false・`created` false）。完了条件の `"locale": "ja"` を満たす。
- `%LOCALAPPDATA%\Sukuna` には `local.json` だけ: `watch`・`secrets` を台本が作っていない（元が無いので項目が0件で、台本は `items.Count -eq 0` の場所を飛ばす。416行）。秘密の場所に何も書かれていない。
- `%USERPROFILE%\.sukuna-shared` は台本の対象外で、残っている（触っていない）。退けた `Sukuna.old-20261124`・`.sukuna.old-20261124` は、台本の写し先（`Sukuna`・`.sukuna`）とも古い場所の守り（`$oldRoots` は Shuko の3つ）とも別の名前で、台本は触れない。

### 2.4 台本そのもの

- `scripts/migrate/migrate-from-shuko.ps1` は改名のコミット `43be443` から変わっていない（`git status` に出ない。`git log` で最後のコミットが `43be443`）。
- `node --test tests/migrate-from-shuko.test.mjs`: 20件すべて通る（fail 0。写す・除く・`shuko.<名前>` の名前を変える・止まる場合・出力に秘密が無いこと）。

## 3. 拡張（手順5）

| 項目 | 基準 | 結果 |
|---|---|---|
| 台帳 | `extensions.lock.json` の7件（日本語パックは 2026-11-17 に組み込みへ。docs/04 の28行） | `ledger.count` 7（dry-run も本番も）。台帳の SHA-256 を自分で計った: `27ad0e1b…db70`。r7 の関門の43行と同じで、関門の後に台帳は変わっていない |
| VSIX の `sha256Ok` | 7件すべて true | dry-run・本番とも7件すべて true。自分でも `sha256sum` で `tmp/b/cache/vsix/` の7つを計り、台帳の `sha256` と1件ずつ照らして全部一致 |
| 入れた結果 | どれも終了コード 0 | 7件とも 0、`was successfully installed`。入れた順は台帳の順（claude-code・basedpyright・powershell・bash-ide・rainbow-csv・dotenv・pdf） |
| `compare` | `ok` true、`extra`・`missing`・`versionMismatch` 空 | そのとおり。`installed` の7件の ID と版が台帳の7件と同じ |
| CLI | `current\bin\sukuna.cmd`（`local.json` から） | `cli` が `C:\Users\kou_z\AppData\Local\Programs\Sukuna\current\bin\sukuna.cmd`、`editor.nameShort` Sukuna、`dataFolderName` `.sukuna`、`version` 1.146.0 |
| `argv` | `argv.path` が `...\.sukuna\argv.json`、`endsWithNewlineBrace` true | そのとおり。`locale` ja |
| 入った場所 | `%USERPROFILE%\.sukuna\extensions` に7件 | リーダーの事実で7つのフォルダと `extensions.json` がある（フォルダ名は下の指摘 S2） |

## 4. 打ったコマンドと許可の行

- 移行の台本の2行は、`permission-response.md` の30・31行、蒙恬の `permissions.json` の71・72行、`migrate-list.txt`・`migrate-apply.txt` の1行目、`migrate-notes.md` の表 #6・#7 で1字も違わない。前後に何も付かない形の正規表現（コマンドの後ろが行末・閉じの記号だけ）で5つのファイルを一度に探し、すべてが同じ文字列に当たることを見た。
- フックは `bash_exact` を完全一致で照らし、一般の行 `scripts/*.ps1` は `scripts/migrate/` の下に当たらない（`permission-response.md` の2節）。出力の `sandbox` は false、`mode` は list と apply なので、通りうる行は30・31行の2つだけで、記録と合う。
- `switch.ps1`・`configure.ps1` は一般の行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1`、`install-extensions.mjs` は `node scripts/*.mjs` に当たる（蒙恬の許可の33行・27行）。
- このリポジトリには呼び出しの記録（作業ログ）が無いので、打った文字列そのものは、出力のファイルの頭の行と蒙恬の記録から確かめた。

## 5. 指摘

| # | 誰の何 | 中身 | 直すこと |
|---|---|---|---|
| S1 | リーダー（`docs/install.md`） | 手順書がまだ r4 の版を書いている。6行（入れる版 `1.146.0-p5-c-all-r4.zip`・SHA-256 `e3e52469…`・commit `7fac30e8…`）、93行（`switch.ps1` の例の zip と SHA-256）、97行（zip の名前）、168行（`sukuna --version` の期待の commit が `7fac30e886f79ebe44e1bac93acd7a86fbbafed8`）、212行（版の名前を r4 に読み替え）。入れたのは r7（commit `b76374c6…`）なので、ユーザーが手順7で3.2 のとおり `sukuna --version` を打つと、期待と違う commit が出る | r7 の値に直す（資料の直しはリーダーの担当）。直すまでは、ユーザーに「commit は `b76374c6fc633747549a7b1a44a1a5364c7fe8f2` が正しい」と伝える |
| S2 | リーダーの事実の写し（確かめの残り） | 拡張のフォルダの名前を `anthropic.claude-code-2.1.322` と渡されたが、本体は版の後ろに対象の環境を付ける（`src/vs/platform/extensionManagement/common/extensionManagementUtil.ts` の55〜56行。`targetPlatform` があれば `-win32-x64`）。実物は `anthropic.claude-code-2.1.322-win32-x64` のはず | 写しの省略なら直すことは無い。`ls` で付いていないなら知らせてほしい（`compare.ok` は `--list-extensions` の結果なので、入ったことは変わらない） |
| S3 | 蒙恬の記録（軽い） | `switch.ps1` の出力は要点だけが `migrate-notes.md` にあり、全文の控えがこのフォルダに無い。私の許可では `switch.ps1` を打てないので、展開の結果は蒙恬の要点とリーダーの事実でしか照らせなかった | この移行は直さなくてよい。次から、版の入れ替えの出力も `migrate-list.txt` と同じ形で全文を残すとよい |
| S4 | 記録の数え（済み） | `brief.md` の「台帳の8つ」は、リーダーが 2026-11-24 に7つへ直すと決めた（`migrate-notes.md` の6.4 の後の注）。`docs/install.md` の4節は作業ツリーで7つに直っている（まだコミットされていない） | リーダーがコミットする |

ほかに見たこと（指摘ではない）:

- `scripts/trial-migrate.ps1`（追跡外、2026-11-18 の改名の作業のもの）は、移行の台本を `-SandboxRoot tmp/b/trial-migrate/<場合>` だけで起こす試しの台本で、本物の場所には向かない。`permission-response.md` の3節の R1（`scripts/` の台本から移行の台本を起こせる穴）に当たる作りだが、今回の本番の出力は `sandbox` false で、許可の行から打ったものと合う。
- `Dawn*` の2つと PowerShell の古いセッションのファイルを写したことは、リーダーが 2026-11-24 に「写ってよい」と判断した（`migrate-notes.md` の6.4 の後の注）。

## 6. ユーザーの手の確かめ（手順7）で見てほしい点

起動の前に:

1. `start-menu-shortcut.ps1` の3行が `TargetPath=...\Programs\Sukuna\current\Sukuna.exe`・`WorkingDirectory=...\current`・`AppUserModelId=Sukuna.Editor` であること（install.md の3.1）。
2. PATH に `%LOCALAPPDATA%\Programs\Sukuna\current\bin` を足し、新しい窓で `where.exe sukuna` が `...\Sukuna\current\bin\sukuna.cmd` を出すこと。`sukuna --version` は `1.146.0`・**`b76374c6fc633747549a7b1a44a1a5364c7fe8f2`**・`x64`（手順書の168行の `7fac30e8…` は r4 の古い値。指摘 S1）。

起動して:

3. スタートメニューの「Sukuna」から起動する（`E:\application\sukuna` の古い展開から起動しない）。初めは英語でもよい。`languagepacks.json` は写していないので、初めの起動で作り直される。一度閉じて起動し直し、表示が日本語になること。
4. 拡張の画面に台帳の7つ（Claude Code 2.1.322、basedpyright 1.40.2、PowerShell 2025.4.0、Bash IDE 1.43.2、Rainbow CSV 3.24.1、.env 0.2.3、PDF 1.2.2）が出て、日本語の言語パックは組み込みの側に出ること。
5. **Claude Code のパネルが開き、送信して応答が返ること**（この依頼のもとの不具合。ログインを求められたら案内に従う）。
6. Shuko から写した設定が効いていること（例: テーマ、`settings.json` の中身、開いていたフォルダの一覧などの状態）。Claude Code 以外の拡張のログインや秘密（`Local State` ごと写したので引き継げる見込みだが推定）が求められたら、入れ直す。
7. タスクバーの Sukuna を右クリックして「New Window」が出ること（スタートメニューのショートカットを作った後に開いた窓で）。
8. notion-sync のトークンを「Notion 同期: トークンを設定」で入れ直すこと（publisher が `sukuna` に変わったため。同期の基準 `sync-base.json` は元に無かったので、初めての同期として扱われる）。
9. `%USERPROFILE%\.sukuna-shared\` が使われ続けているか（2026-11-20 の起動でできたもの。残してよい）と、`%APPDATA%\Code` の更新日時が変わっていないこと。

起動の後に（ユーザーの判断）:

10. 問題が無ければ `E:\application\sukuna` を消す。退けた `%APPDATA%\Sukuna.old-20261124`・`%USERPROFILE%\.sukuna.old-20261124` も要らなければ消す（課の削除の許可の外）。
11. 更新の検知（`watch`）とトークンは元から無かったので、引き継いでいない。検知を登録するときは install.md の7節の初めの設定から行う（`safety.daily-argv` の直しの後。`brief.md` のとおり）。

## 7. 流したコマンド

| コマンド | 結果 |
|---|---|
| `git status` | 台本・テストの追跡しているファイルに変更なし（`tests/probe-dns.ps1` だけ変更。移行と関係しない） |
| `git log --oneline -8 -- scripts/migrate/migrate-from-shuko.ps1 scripts/switch.ps1 scripts/install-extensions.mjs scripts/configure.ps1 extensions.lock.json` | 最後は改名のコミット `43be443` |
| `git diff docs/install.md` | 4節の「8つ」→「7つ」だけ（作業ツリー、未コミット） |
| `sha256sum tmp/b/dist/1.146.0-p5-c-all-r7.zip` | `5b7ea885…51d1`（関門と一致） |
| `sha256sum <tmp/b/cache/vsix の7つ>` | 7つとも台帳と一致 |
| `sha256sum extensions.lock.json` | `27ad0e1b…db70`（関門と一致） |
| `node --test tests/migrate-from-shuko.test.mjs` | 20 件、pass 20、fail 0 |

止められたもの: `git diff docs/install.md tasks/2026-11-20-sukuna-migrate/brief.md | head -80`（`head` が許可に無い）。`head` を外し、`docs/install.md` だけにして打ち直した。`switch.ps1 -List` は許可に無いので打っていない。

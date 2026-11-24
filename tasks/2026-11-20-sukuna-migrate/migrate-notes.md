# Sukuna への移行の記録（蒙恬）

- 記入: 蒙恬（2026-11-24）
- 依頼: リーダーから、`brief.md` の手順2・3だけ。手順4（移行の台本）と手順5（`install-extensions.mjs`）は打っていない。
- 触っていない場所: `%APPDATA%\Sukuna`、`%USERPROFILE%\.sukuna`、`E:\application\sukuna`、旧の `%LOCALAPPDATA%\Shuko\local.json`

## 1. 打った順

作業場所はリポジトリの直下。どれも許可の一般の行（`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1`）に当たる。

| # | コマンド | 終了コード | 要点 |
|---|---|---|---|
| 1 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1` | 0 | `"result": "ok"`、`actions` は `created local.json with the defaults`。`configPath` は `C:\Users\kou_z\AppData\Local\Sukuna\local.json` |
| 2 | 同じ（引数なしの2回目。今の値を出すだけ） | 0 | `actions` は空（何も変えていない）。値は下の表と同じ |
| 3 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -List` | 0 | 入れる前の状態。下の3節 |
| — | `switch.ps1 1.146.0-p5-c-all-r7 -Zip … -Sha256 …` | 打っていない | ラベルが資料と違う。下の4節 |

## 2. local.json の値（手順2。済み）

| キー | ファイルの中の値 | 解いた値 |
|---|---|---|
| `installRoot` | `%LOCALAPPDATA%\Programs\Sukuna` | `C:\Users\kou_z\AppData\Local\Programs\Sukuna` |
| `keepVersions` | `3` | `3` |
| `builderRepo` | `E:\develop\self\Team\projects\ai-editor` | 同じ |
| `buildRoot` | `E:\develop\self\Team\projects\ai-editor\tmp\b` | 同じ |

- 4つとも `sources` は `local.json`。`configExists` は true。
- 依頼の既定の値（installRoot・keepVersions 3・buildRoot = リポジトリの `tmp\b`・builderRepo = このリポジトリ）と一致する。
- `buildRoot` は、ファイルの中でも絶対パスで書かれる（`scripts/lib/local-config.ps1` の既定 `$script:SukunaDefaultBuildRoot` がそうなっている）。働きは同じ。

## 3. versions と current の状態（手順3の前）

`switch.ps1 -List` の出力:

- `installRoot`: `C:\Users\kou_z\AppData\Local\Programs\Sukuna`
- `current`: null、`versions`: 空、`history`: 空、`removable`: 空、`keepVersions`: 3
- 検知: `[switch] WARNING: no update watch record (C:\Users\kou_z\AppData\Local\Sukuna\watch\state.json)`。手順書の2のとおり、検知を登録する前なので誤りではない（`state.json` は移行の台本が写す予定）。

zip は `tmp\b\dist\1.146.0-p5-c-all-r7.zip` にある（Glob で確かめた。SHA-256 はまだ計っていない。`switch.ps1` が展開の前に照らす）。

## 4. 手順3を止めた理由（ラベルの食い違い）

（2026-11-24 の追記: リーダーが案1（`1.146.0-1`）を採り、`brief.md` を直した。打った結果は6節）

依頼のラベル `1.146.0-p5-c-all-r7` は、資料と計画が決めている版のフォルダの名前と違う。展開してからでは課が直せない（版のフォルダを消すのは削除の許可の外）。そのため、打たずにリーダーの判断を仰ぐ。

- `docs/install.md` の2: 「zip の名前は … `1.146.0-p5-c-all-r4` ですが、ラベルは `1.146.0-1` にしてください。更新の検知は、`current` の指すフォルダの名前から今の版を読みます。読めるのは `1.146.0` か `1.146.0-1` の形だけです」
- `docs/02-repository-and-build.md` の6節（156行）: `versions\1.146.0-1\`（版のラベル = 本家のタグ-ビルドの番号）
- `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の6節（241行）: 「版のラベルは `1.146.0-p5-c-all-r7`、新しい場所での版の名前は `1.146.0-1`」。3.2（143行）と 3.3（164行）も `switch.ps1 1.146.0-1 -Zip …`
- `docs/user-decisions.md` の「裁定（2026-11-18、改名の進め方）」（742行）は「版のラベルは `1.146.0-p5-c-all-r7`」で終わり、計画の後半「新しい場所での版の名前は `1.146.0-1`」が写っていない。`brief.md` の手順3はこの行に合わせたように読める。

ラベルを `1.146.0-p5-c-all-r7` にしたときに起きること（コードで確かめた）:

- 検知: `tools/watch/watch.mjs` の `currentCoreVersion` は、`current` の先の名前を `tools/watch/lib/judge.mjs` の `labelToVersion`（`/^(\d+\.\d+\.\d+)(?:-\d+)?$/`）で読む。`1.146.0-p5-c-all-r7` は読めないので、`upstream.json` の `tag`（今は `1.146.0`）に落ちる。今は同じ版になるので害は出ないが、取り込みで `upstream.json` が先に進むと、入れていない版を「今の版」と見る。
- `switch.ps1` の `Get-LabelSortKey` は `^(\d+)\.(\d+)\.(\d+)-(\d+)$` だけを版の順に並べ、ほかの名前は最も古い側に置く。`removable` の順が名前の順になる。
- ラベルの形の検査（`^[A-Za-z0-9][A-Za-z0-9._-]*$`）は通るので、台本は止まらない。

案（どちらにするかはリーダーが決める）:

1. （推奨。資料と計画のとおり）`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-1 -Zip tmp/b/dist/1.146.0-p5-c-all-r7.zip -Sha256 5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`
2. 依頼のとおり `1.146.0-p5-c-all-r7` で展開する。この場合、`docs/install.md` の2と docs/02 の6節を直すか、検知が `upstream.json` に落ちることを受け入れる記録が要る。

## 5. 気づいた点

- `switch.ps1` の手順3（ユーザーのデータの控え）は、`%APPDATA%\<nameShort>`（新しい版では `%APPDATA%\Sukuna`）の `User\settings.json` など5つを `<installRoot>\backups\<日時>\` へ**読んで写す**。`%APPDATA%\Sukuna` には書かないが、読みはする。ユーザーが手順1で `%APPDATA%\Sukuna` を退けた後に打てば、`backup.missing` に5つ並ぶだけで何も読まない。退ける前に打つと、今日できた `settings.json`（150 バイト）などが控えに入る（害は無いが、要らない控えになる）。手順3を手順1の後に回すかどうかもリーダーが決める。
- `switch.ps1` の「動いているか」の確かめは、新しい場所の `current` の下だけを見る。`current` がまだ無いので、今回は `E:\application\sukuna` で動いていても止まらない（依頼で Shuko・Sukuna とも動いていないことはリーダーが確かめ済み）。
- 許可の一般の行で `echo` と `wc` が止まった（終了コードは Bash の結果の成否で見た。どちらも成功）。回り道はしていない。

## 6. 手順3と手順4の一覧（2026-11-24 の続き）

リーダーの返事: ラベルは `1.146.0-1`（`brief.md` の手順3を直した）。手順1は済み（`%APPDATA%\Sukuna` → `Sukuna.old-20261124`、`%USERPROFILE%\.sukuna` → `.sukuna.old-20261124`。`%USERPROFILE%\.sukuna-shared` は残っている）。Shuko と Sukuna は動いていない（リーダーの tasklist）。

| # | コマンド | 終了コード | 要点 |
|---|---|---|---|
| 4 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-1 -Zip tmp/b/dist/1.146.0-p5-c-all-r7.zip -Sha256 5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1` | 0 | 下の6.1 |
| 5 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -List` | 0 | 下の6.2 |
| 6 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List`（許可の行のまま） | 0 | 出力の全文は `migrate-list.txt`。下の6.3 |

`-Apply` と `install-extensions.mjs` は打っていない。

### 6.1 手順3の結果（`switch.ps1 1.146.0-1 -Zip …`）

- `result`: ok。`zipSha256` は依頼の値と一致
- `expanded.topFolder`: `Sukuna-win32-x64-1.146.0-p5-c-all-r7` → `C:\Users\kou_z\AppData\Local\Programs\Sukuna\versions\1.146.0-1`
- `target.exe`: `...\Programs\Sukuna\versions\1.146.0-1\Sukuna.exe`、`target.cli`: `...\versions\1.146.0-1\bin\sukuna.cmd`、`version` 1.146.0、`commit` b76374c6fc633747549a7b1a44a1a5364c7fe8f2、`versionedFolder` null
- `engines`: `checked` 7、`unsatisfied` 空
- `backup.userDataDir`: `C:\Users\kou_z\AppData\Roaming\Sukuna`（手順1で退けた後なので無い）。`copied` 空、`missing` に5つ全部（`User\settings.json`・`User\keybindings.json`・`User\snippets`・`User\tasks.json`・`User\globalStorage\state.vscdb`）。控えのフォルダ `...\Programs\Sukuna\backups\20261124-213716`（`backup.json` だけ）
- `history`: `2026-11-24T21:37:16.9595714+09:00\t-\t1.146.0-1`
- `removable`: 空。検知の WARNING（記録が無い）は前と同じ

### 6.2 切り替えの後の状態（`switch.ps1 -List`）

- `current`: `1.146.0-1`。`versions`: `1.146.0-1`（version 1.146.0、current true）の1つだけ
- `history`: 上の1行。`removable`: 空

### 6.3 移行の台本の一覧（`-List`）の要点

- `result` ok、`written` false、`running` 空、`blockers` 空（止まる理由は無い）。`writtenTo` 空
- appdata（`%APPDATA%\Shuko` → `%APPDATA%\Sukuna`）: 写し先は無い（`destState` absent）。写すのは 87 ファイル・45 フォルダ・16,793,154 バイト。最上位の18項目は `Backups`・`blob_storage`・`CachedConfigurations`・`CachedProfilesData`・`DawnGraphiteCache`・`DawnWebGPUCache`・`DIPS`・`Local State`（490 バイト）・`Local Storage`・`machineid`・`Network`・`Preferences`・`Service Worker`・`Session Storage`・`Shared Dictionary`・`SharedStorage`・`User`（25 ファイル、1,227,540 バイト）・`WebStorage`（12 ファイル、13,089,912 バイト）
  - 除くもの（あったもの）: `Cache`・`CachedData`・`clp`・`Code Cache`・`GPUCache`・`languagepacks.json`・`logs`。台本の除く一覧（`$script:ExcludedTop`）のうち `CachedExtensionVSIXs`・`Crashpad`・`code.lock` は、元に無いので出ていない
  - 名前を変えるもの（`renamed`）: 無し。元の `User\globalStorage\` に `shuko.notion-sync\` が無い（同期の基準 `sync-base.json` はまだ作られていない）
  - ユーザーのファイルの例（`userFiles`）: `User\settings.json`（49 バイト）、`User\globalStorage\state.vscdb`（241,664）、同 `.backup`（241,664）、`storage.json`（6,210）、`User\workspaceStorage`（18 ファイル）、`User\History`（2 ファイル）、`User\globalStorage\ms-vscode.powershell\sessions\PSES-VSCode-68808-822254.json`（238）
- argv（`%USERPROFILE%\.shuko\argv.json` → `%USERPROFILE%\.sukuna\argv.json`）: 元はある（309 バイト）。写し先は無い
- watch（`%LOCALAPPDATA%\Shuko\watch`）: **元が無い**（`sourceExists` false）。写すものは無い
- secrets（`%LOCALAPPDATA%\Shuko\secrets`）: 元が無い

### 6.4 気づいた点

- watch の元が無いので、検知の `state.json` と Notion のトークン（`notion-token.dpapi`）は引き継げない。2026-11-18 の記録（検知のタスク `\Shuko\watch` は未登録）と合う。検知を登録する前に、ユーザーがトークンを初めの設定どおりに入れることになる（docs/06 の2.4。課の作業ではない）。開いている「Shuko」の ToDo のページ ID を失う心配も無い（元から無い）。
- `DawnGraphiteCache`・`DawnWebGPUCache`（どちらも 557,424 バイト）は、除く一覧に無いので写る。名前から見て GPU のシェーダーの控えで、作り直されるものと見られる（推定。確かめていない）。写しても害は無い見込みだが、除くかどうかは台本の直しになるのでリーダーが決める。
- `User\globalStorage\ms-vscode.powershell\sessions\` の古いセッションのファイルも写る。台帳の拡張ではない（Shuko に手で入れたものか、過去に入れたものの残り。未確認）。238 バイトで害は無い見込み。
- 台帳の拡張の数: `switch.ps1` の engines は `checked` 7。`brief.md` の「今の状態」と完了条件は「台帳の8つ」、r7 の `manual-checks-p5-c-all-r7.md` は「台帳の7つ」と書いている。今の `extensions.lock.json` は7つ（`%USERPROFILE%\.shuko\extensions` の8つとの差は、まだ確かめていない）。
- `%USERPROFILE%\.sukuna-shared` は台本の対象に無く、触っていない。

（リーダーの判断 2026-11-24: Dawn の2つと PowerShell の古いセッションのファイルは写ってよい。台本は直さない。台帳は7件で正しい。日本語パックは 2026-11-17 に組み込みへ移した。docs/04 の28行。`brief.md` の「8つ」はリーダーが直す）

## 7. 移行の本番と拡張の導入（2026-11-24 の続き）

| # | コマンド | 終了コード | 要点 |
|---|---|---|---|
| 7 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -Apply`（許可の行のまま） | 0 | 出力の全文は `migrate-apply.txt`。下の7.1 |
| 8 | `node scripts/install-extensions.mjs --dry-run --out tasks/2026-11-20-sukuna-migrate/install-extensions-dryrun.json` | 0 | `result` dry-run。台帳7件の VSIX がキャッシュにあり、SHA-256 はすべて一致（`sha256Ok` true） |
| 9 | `node scripts/install-extensions.mjs --out tasks/2026-11-20-sukuna-migrate/install-extensions-result.json` | 0 | `result` ok。下の7.2 |

Sukuna は起動していない（CLI の `--install-extension` と `--list-extensions` だけ）。

### 7.1 移行の本番（`-Apply`）

- `result` ok、`written` true、`running` 空、`blockers` 空。`locations` は一覧（`-List`）と同じ
- `writtenTo`: `%APPDATA%\Sukuna`、`%USERPROFILE%\.sukuna\argv.json`
- 照らし合わせ（`copied`）:

  | 種類 | 写した数（ファイル / フォルダ / バイト） | 見込み | `verified` | `mismatches` |
  |---|---|---|---|---|
  | appdata | 87 / 45 / 16,793,154 | 87 / 45 / 16,793,154 | true | 空 |
  | argv | 1 / 0 / 309 | 1 / 0 / 309 | true | 空 |

- `createdCount` 135
- watch・secrets は元が無いので、何も写していない（一覧のとおり）

### 7.2 拡張の導入

- CLI: `C:\Users\kou_z\AppData\Local\Programs\Sukuna\current\bin\sukuna.cmd`（`local.json` から求まった）。本体 1.146.0、`nameShort` Sukuna、`dataFolderName` `.sukuna`
- 入れた順（台帳の順。言語パックは台帳に無い）と結果: どれも終了コード 0、`was successfully installed`
- `--list-extensions --show-versions` の結果（`installed`）と台帳の照らし合わせ: `compare.ok` true、`extra`・`missing`・`versionMismatch` はどれも空

  | 拡張 | 版 |
  |---|---|
  | anthropic.claude-code | 2.1.322（win32-x64） |
  | detachhead.basedpyright | 1.40.2 |
  | mads-hartmann.bash-ide-vscode | 1.43.2 |
  | mechatroner.rainbow-csv | 3.24.1 |
  | ms-vscode.powershell | 2025.4.0 |
  | tomoki1207.pdf | 1.2.2 |
  | weixu.wx-vsce-dotenv | 0.2.3 |

- argv.json（`C:\Users\kou_z\.sukuna\argv.json`）: `locale` ja、`changed` false、`created` false、`endsWithNewlineBrace` true。写した argv.json に初めから `"locale": "ja"` があったので、台本は書き換えていない。そのため、ほかの項目は写したとき（309 バイト。照らし合わせ一致）のまま残っている。

### 7.3 気づいた点

- argv.json の中身のキーは、私の許可では読めない（`read_paths` に `%USERPROFILE%\.sukuna\` が無い。Read がフックで止まった。回り道はしていない）。ほかの項目が残っていることは、上の `changed` false と、写したときの大きさの一致から言える。キーの一覧は、許可のある人（大岡越前守かリーダー）に見てもらう必要がある。
- 2026-11-20 の状態の記録（`.sukuna\argv.json` に `locale` が無い）は、退けた古い `.sukuna.old-20261124` のこと。今の argv.json は Shuko から写したもので、`locale` はもとからある。
- ユーザーの次の手順（`brief.md` の7）で起動したとき、`%APPDATA%\Sukuna\languagepacks.json` が作られる。Shuko から写していない（除く一覧どおり）ので、初めの起動で作り直される。表示が英語なら一度閉じて起動し直す（手順書どおり）。

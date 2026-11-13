# 試しの記録（p2-build-switch）

- 作成: 蒙恬（2026-11-14 00:17〜00:33 JST）
- ビルド（依存の導入・型検査・パッケージ化）は走らせていない（道具の導入待ち。Node.js 24.16.0・pnpm 11.8.0 のまま）。
- 普段使いのデータとユーザーの `%LOCALAPPDATA%\Shuko\local.json` には触れていない。設定はすべて `--config` / `-ConfigPath` で `C:\b\trial-install\cfg\` の下のファイルを渡した。CLI は `VSCODE_PORTABLE`（`C:\b\trial-install\portable`）と `--extensions-dir` を付けて走らせた。スタートメニューと PATH は `-NoShellIntegration` で触れていない。
- 公式の zip の展開（`C:\b\p0\vscode-1.146.0\`）は読むだけで、動かしていない。
- build.mjs と install-extensions.mjs の記録の JSON は `trial/` に置いた（ファイル名は下の表）。switch.ps1 と configure.ps1 は標準出力の JSON を読んで、要点をこの記録に写した（ファイルには残していない）。

## 1. 置き場所

| 場所 | 中身 |
|---|---|
| `C:\b\trial-build\fake\VSCode-win32-x64\` | 後処理の試し用の小さな出力（`resources\app` が直下） |
| `C:\b\trial-build\fake-versioned\VSCode-win32-x64\` | 同（`69047191fc\resources\app`。ThirdPartyNotices と theme-defaults を置いていない） |
| `C:\b\trial-build\fixtures\` | keep.json（git・theme-defaults・vscode-test-resolver）、removals-ok（`extensions/grunt` を消す単位）、removals-bad（`extensions/git` を消す単位） |
| `C:\b\trial-build\dist\` | `1.146.0-t0.zip`（小さな出力）、`1.146.0-t1.zip`（公式の展開を包んだもの。414,537,065 バイト） |
| `C:\b\trial-install\cfg\` | 試しの local.json と、誤りのある local.json（bad-*.json）、試しの台帳（ledger-*.json） |
| `C:\b\trial-install\B\` | 試しの installRoot（`versions\1.146.0-t1`・`1.146.0-t2`・`1.146.0-3`、`current`、`history.txt`、`backups\`） |
| `C:\b\trial-install\userdata\` | 試しのユーザーのデータ（`User\settings.json`・`User\snippets\`） |
| `C:\b\trial-install\portable\` | CLI の `VSCODE_PORTABLE`（`extensions\`・`argv.json`） |

## 2. 構文

| 確かめ | 結果 |
|---|---|
| `node --check scripts/build.mjs`・`scripts/install-extensions.mjs`・`scripts/lib/local-config.mjs` | 誤りなし |
| `scripts/p0-check-ps.ps1`（PowerShell 5.1 の構文解析と ASCII の確かめ） | `configure.ps1`・`switch.ps1`・`lib/local-config.ps1` を含む 15 本で誤り 0、ASCII 以外 0 バイト |

## 3. build.mjs

| # | コマンド（要点） | 結果 | 記録 |
|---|---|---|---|
| b0 | `--dry-run`（設定ファイルなし／configure.ps1 が書いた local.json） | `result: dry-run`。既定の buildRoot `C:\b`（`buildRootFrom: default`）、configure.ps1 が書いたファイルでは `local.json`。手順ごとのコマンドと `checksBeforeRun`（apply.mjs・keep.json・作業ツリー・tar.exe あり、単位 13 件で有効 0） | `trial/b0-dry-run-config-from-configure.json` |
| b1 | `--from postprocess` で小さな出力（直下） | 1回目: zip で止まった。**System32 の bsdtar 3.8.9 は `-s`（名前の置き換え）を持たない**（"-s is not supported by this version of bsdtar"）。ジャンクションと `-H` に直して2回目: 後処理 ok（`residual` なし、`notShipped: vscode-test-resolver`、`unexpected: ms-vscode.js-debug` は情報）、zip ok（最上位 `Shuko-win32-x64-1.146.0-t0` の1つ、19 項目）。段のジャンクションは消え、元の出力は残った | `trial/b1-fake-flat.json` |
| b2 | `--from postprocess --to postprocess` で小さな出力（`69047191fc\` の下）と removals-bad | `stoppedAt: postprocess`。`versionedFolder: 69047191fc` を見つけ、問題を3つ出した: ThirdPartyNotices.txt が無い、消した拡張 git が残っている、keep.json の theme-defaults が無い | `trial/b2-fake-versioned-bad.json` |
| b3 | `--from zip --package-dir C:/b/p0/vscode-1.146.0`（公式の展開。読むだけ） | ok。72.3 秒、414,537,065 バイト、SHA-256 `49baf53be7db6b46ef4d8dbc7176547ae4a95fe25805aa2bfb5e6ff7ac0b205a`、最上位 `Code-win32-x64-1.146.0-t1` の1つ、3,944 項目 | `trial/b3-official-zip.json` |
| b4 | `--from postprocess --to postprocess` で公式の展開と本物の `builtin/keep.json`・`removals/` | `stoppedAt: postprocess`、問題は「自前の拡張が無い: mydist」だけ（公式なので当然）。keep.json の拡張はすべてそろい（`missingKeep` なし）、`notShipped` は本家の `excludedExtensions` の4件、`unexpected` は段階 A で消す予定の 32 件（単位がまだ有効でないため）。1回目は `extensions\node_modules` を拡張と数えていたので、package.json のあるフォルダだけを数えるよう直した（`nonExtensionDirs: ["node_modules"]`） | `trial/b4-official-postprocess-real-keep.json` |
| b5 | `--to prepare`（既定の `C:\b`、既にある作業ツリー） | ok。prepare.mjs が fetch --tags（7.0 秒）と照合を通した。作業ツリーは変えていない | `trial/b5-prepare.json` |
| b6 | `--from apply --to apply --worktree C:/b/wt/dev-build --take-in-dir trial/take-in-dev-build`（試しの作業ツリーを `git worktree add` で作った） | ok（12.6 秒）。apply.mjs（p2-apply）が上書きとパッチ `20-product-configuration-defaults.patch` を当て、`checks.json` の `result: ok`。記録の `patches` に写った | `trial/b6-apply-dev-build.json`、`trial/take-in-dev-build/checks.json` |
| b7 | `--from lockfile --to lockfile`（同じ作業ツリー。依存の導入はしていない） | ok。apply.mjs `--lockfile-check` がロックファイル6つ（ルート・build・extensions・extensions/copilot・remote・test/sanity）を「変わらず」とした | `trial/b7-lockfile-dev-build.json` |

b6・b7 の後、試しの作業ツリー `C:\b\wt\dev-build` は `git worktree remove` で消した。

## 4. install-extensions.mjs

CLI は試しの installRoot の `current\bin\code.cmd`（公式の 1.146.0）。VSIX のキャッシュは `--cache C:/b/p0/vsix`（Phase 0 で取ったもの。lock-fetch.mjs と同じ置き方）、`--no-download`。

| # | 内容 | 結果 | 記録 |
|---|---|---|---|
| i0 | `--portable` も `--extensions-dir` も無し | 止まった（終了コード 1）。「dataFolderName が .vscode（本家）。--portable か --extensions-dir を付ける」 | （標準出力のみ） |
| i1 | `--dry-run` | 8件すべて SHA-256 が台帳と一致。言語パックが先頭、残りは台帳の順。argv.json の場所は `C:\b\trial-install\portable\argv.json` | `trial/i1-dry-run.json` |
| i2 | 本番の順で入れる。前もって argv.json に、エディタの既定に似たコメントつきの中身（`enable-crash-reporter`・`crash-reporter-id` と行末のコメント）を置いた | ok。8件とも `--install-extension --force` が終了コード 0（0.5〜6.9 秒）。一覧が台帳と一致。argv.json はコメントを残して `"locale": "ja"` が足され、`\n}` で終わった | `trial/i2-install.json` |
| i3 | SHA-256 を違えた台帳（`--lock`） | 止まった（終了コード 2）。何も入れていない | `trial/i3-badsha.json` |
| i4 | 台帳に無い `dotenv.dotenv-vscode` 1.5.8 だけの台帳で入れる（次の試しの用意） | 入った後、台帳との比べで残りの8件を「台帳に無い」として止まった（終了コード 3）。argv.json は書いていない | `trial/i4-add-non-ledger.json` |
| i5 | `--rev HEAD`（git の台帳） | 8件を入れ直した後、`dotenv.dotenv-vscode@1.5.8` を「台帳に無い」として止まった（終了コード 3） | `trial/i5-rev-head-extra.json` |
| i6 | `configure.ps1` で installRoot を B に移した後に、背景で2回走らせた（下の s7・c5 の相手） | どちらも終了コード 3（i5 と同じ理由。dotenv を残してあるため）。移した後の `current\bin\code.cmd` で入った | `trial/i6-after-move.json`、`trial/i6-during-switch.json` |

CLI の出力には毎回 Node.js の DEP0169（`url.parse()`）の警告が出た（公式の 1.146.0 の CLI のもの。結果には影響しない）。

## 5. switch.ps1

試しの local.json: `{"installRoot": "C:\\b\\trial-install\\A", "keepVersions": 2, "buildRoot": "C:\\b\\trial-build"}`、`-UserDataDir C:/b/trial-install/userdata`。

| # | コマンド（要点） | 結果 |
|---|---|---|
| s1 | `1.146.0-t1 -Zip <b3 の zip> -Sha256 <b3 の値>` | ok。SHA-256 が一致、zip の最上位のフォルダの中身を `versions\1.146.0-t1` に展開、`resources\app` は `69047191fc\` の下と判定、engines は 8 件すべて満たす、backup に `settings.json`・`snippets` を写し、無い3つを `missing` に書いた。`current` を作り、history に `-` → `1.146.0-t1` |
| s2 | `1.146.0-t2 -Zip <同じ zip>` | ok（`1.146.0-t1` → `1.146.0-t2`） |
| s3 | `1.146.0-t1 -LedgerPath ledger-future.json`（`^1.200.0` の拡張を含む） | 止まった（終了コード 4）。`unsatisfied` に claude-code（`^1.200.0`）。`current` は変わらない |
| s4 | `-Previous` | ok（`1.146.0-t2` → `1.146.0-t1`） |
| s5 | `1.146.0-3 -Zip <同じ zip>` | ok。`keepVersions=2` を超える版として `1.146.0-t1` を一覧にした（消していない。案内は標準エラー） |
| s6 | `-List` | 版3つ（current は `1.146.0-3`）、history 4行、`removable: ["1.146.0-t1"]` |
| s7 | 背景で install-extensions.mjs（CLI が `current\Code.exe` で動く）を走らせながら切り替える | 1回目（`1.146.0-t1` → `1.146.0-3`）は、ちょうど CLI の動いていない間だったらしく、そのまま切り替わった。2回目（`1.146.0-3` → `1.146.0-t2`）は止まった（終了コード 3、`running: [{ pid: 1564, path: "C:\\b\\trial-install\\B\\current\\Code.exe" }]`）。ジャンクション経由で起動したプロセスの `ExecutablePath` は `current\` のパスで出る。確かめは「その瞬間に動いているか」なので、短い CLI の実行とはすれ違うことがある |
| s8 | 移した後（c4）の `-Previous` | ok（`C:\b\trial-install\B` で `1.146.0-3` → `1.146.0-t1`） |
| s9 | 空の場所（c6 の後）で `-Previous` | 止まった（終了コード 1、「no current version」） |

## 6. configure.ps1

| # | コマンド（要点） | 結果 |
|---|---|---|
| c1 | 引数なし、`-ConfigPath cfg/new/local.json`（無いファイル） | 既定値で作った。`installRoot` は `%LOCALAPPDATA%\Programs\Shuko` のまま書き、`builderRepo` は `E:\develop\self\Team\projects\ai-editor`。b0 で build.mjs（Node.js の部品）が同じファイルを読めた |
| c2 | 誤りのある local.json 4つ（知らないキー `InstallRoot`、`keepVersions: "3"`、末尾の `,`、知らない `%NO_SUCH_VAR_SHUKO%`） | どれも止まった（終了コード 1）。build.mjs `--dry-run --config` でも4つとも同じ理由で止まった（Node.js と PowerShell の部品の規則が一致）。1回目は知らない環境変数のとき PowerShell の例外がそのまま出たので、JSON で返すよう直した |
| c3 | `-InstallRoot C:/b/trial-install/B -NoShellIntegration`（1回目） | 移動とジャンクションの作り直しまで進んだ後、local.json の書き込みで失敗（`[IO.File]::Replace` に `$null` を渡すと空の文字列になり、パスの誤りになる）。**戻しが働き**、移したものを A に戻し、B を消し、A の `current` を作り直した（`undo` 6件すべて ok）。local.json は前のまま。`-List` で A が元どおりであることを確かめた。`[NullString]::Value` に直した |
| c4 | 同（2回目） | ok。`versions`・`history.txt`・`backups` を B に移し、`B\current` → `B\versions\1.146.0-3`、local.json を書き換えた |
| c5 | エディタ（CLI）が動いている間に `-InstallRoot C:/b/trial-install/C` | 止まった（終了コード 3、`running` に `B\current\Code.exe`）。何も変えていない |
| c6 | `-InstallRoot //localhost/c$/b/trial-install/U` | 止まった（「not a local volume (UNC path)」）。1回目は `//` で始まる UNC を絶対パスと認めていなかったので、両方の部品で `\\` と `//` を認めるよう直した |
| c7 | `-InstallRoot C:/b/trial-install/B/inner` | 止まった（入れ子） |
| c8 | `-KeepVersions 5` | ok |
| c9 | `-InstallRoot C:/b/trial-install/C -NoMove`、続けて `-InstallRoot C:/b/trial-install/B -NoMove` | ok。何も移さず local.json だけを書き換えた（s9 は C で走らせた） |

## 7. 試していないこと

- 依存の導入・型検査・パッケージ化（道具の導入待ち）。`pnpm install --no-frozen-lockfile` の振る舞い、`typecheck-client` の所要時間、出力の実際の形（`resources\app` が直下か）。
- 自分のビルドの CLI（`Shuko.exe`・`bin\shuko.cmd`、`dataFolderName: .shuko`）での install-extensions.mjs（守りに当たらない普段の場合）。
- configure.ps1 の5（スタートメニューのショートカットとユーザーの PATH の向け直し）と、違うドライブへの移動（robocopy /MOVE）。brief の指示で試しでは触れていない。この PC に別の NTFS の固定ドライブがあるかも確かめていない。
- 普段使いの `%USERPROFILE%\.vscode\` が CLI の試しで変わっていないことの直接の確かめ（蒙恬の読める場所の外）。`VSCODE_PORTABLE` と `--extensions-dir` を付け、Phase 0 の `p0-ext-allowed.ps1` と同じ形で走らせた。

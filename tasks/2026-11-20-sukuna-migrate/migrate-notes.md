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

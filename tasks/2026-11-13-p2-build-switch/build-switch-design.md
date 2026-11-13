# build.mjs・install-extensions.mjs・local.json の部品・configure.ps1・switch.ps1 の設計

- 作った人: 蒙恬（p2-build-switch）
- 状態: 初版（2026-11-14）。ビルドはまだ走らせていない（道具の導入待ち）
- 仕様の出どころ: docs/02 の4・6・6.1・7節、docs/04 の5・7節、docs/07 の3.2 の1、`tasks/2026-11-13-p1-build-upstream/`、`tasks/2026-11-13-p2-apply/apply-design.md`

## 1. ファイル

| ファイル | 役目 |
|---|---|
| `scripts/lib/local-config.mjs` | `local.json` を読む共通の部品（Node.js） |
| `scripts/lib/local-config.ps1` | 同じ部品（PowerShell。ドットで読み込む） |
| `scripts/configure.ps1` | `local.json` の作成・変更、`-InstallRoot` の移動 |
| `scripts/switch.ps1` | 版の切り替え・戻し・一覧 |
| `scripts/build.mjs` | ビルドの一連（docs/02 の4節の1〜8）と記録 |
| `scripts/install-extensions.mjs` | 台帳の拡張を入れる、`argv.json` の `locale` |

PowerShell の台本は ASCII だけで書いた（Windows PowerShell 5.1 は BOM の無い台本を ANSI で読むため。既存の台本と同じ）。

## 2. local.json の規則（両方の部品で同じ）

| 項目 | 規則 |
|---|---|
| 場所 | `%LOCALAPPDATA%\Shuko\local.json`。関数と台本には別のパスを渡せる（試しとテスト。`--config` / `-ConfigPath`） |
| 無いとき | ファイルが無い・キーが無い → 既定値（`installRoot` = `%LOCALAPPDATA%\Programs\Shuko`、`keepVersions` = 3、`builderRepo` = なし、`buildRoot` = `C:\b`） |
| 止めるとき | JSON として読めない、最上位がオブジェクトでない、知らないキー（大文字小文字を区別。`InstallRoot` は誤り）、型が違う、知らない `%NAME%`、展開した後に絶対パス（ドライブ文字か UNC）でない |
| 型 | `installRoot`・`buildRoot`・`builderRepo` は空でない文字列（`builderRepo` だけは `null` を「未設定」として認める）。`keepVersions` は 1 以上の整数 |
| 展開 | `%NAME%` を環境変数で展開する（名前の大文字小文字は問わない）。末尾の `\` は外す（ドライブの直下 `C:\` は残す） |
| 優先 | オプション → `local.json` → 既定値。結果に `sources`（`option` / `local.json` / `default`）を付ける |
| 書き方（configure.ps1） | キーを `installRoot`・`keepVersions`・`builderRepo`・`buildRoot` の順に、2 個の空白の字下げ、LF、末尾に改行、UTF-8（BOM なし）。一時ファイルに書いてから置き換える。値は利用者が渡した文字列のまま（`%LOCALAPPDATA%` を展開せずに残す） |

### 2.1 テストの入口（Node.js: `scripts/lib/local-config.mjs`）

| 関数 | 入力 | 出力 |
|---|---|---|
| `DEFAULTS`・`KNOWN_KEYS` | — | 既定値、キーの一覧 |
| `localConfigPath(env)` | 環境変数のオブジェクト | `<LOCALAPPDATA>\Shuko\local.json`。`LOCALAPPDATA` が無ければ例外 |
| `expandEnv(value, env)` | 文字列、環境変数 | 展開した文字列。知らない名前は例外 |
| `parseLocalConfig(text, source)` | 中身、名前 | オブジェクト（先頭の BOM は外す）。読めなければ例外 |
| `validateLocalConfig(obj)` | 値 | 誤りの文字列の配列（正しければ空） |
| `resolveLocalConfig({ configPath, overrides, env })` | パス、オプション、環境変数 | `{ installRoot, keepVersions, builderRepo, buildRoot, sources, configPath, configExists }`。誤りは例外 |

直接は走らせない（`node scripts/lib/*.mjs` は蒙恬の許可に無い）。`build.mjs --dry-run --config <file>` で読み方を確かめられる。

### 2.2 テストの入口（PowerShell: `scripts/lib/local-config.ps1`）

`. scripts\lib\local-config.ps1` で読み込む。台本に `param()` を置いていない（ドットで読むと呼び出し側の同じ名前の変数を上書きするため）。

| 関数 | 出力 |
|---|---|
| `Get-ShukoLocalConfigPath` | 既定のパス |
| `Expand-ShukoEnv -Value` | 展開した文字列。知らない名前は例外 |
| `Test-ShukoLocalConfig -Config` | 誤りの文字列の配列（`ConvertFrom-Json` の結果か IDictionary） |
| `Read-ShukoLocalConfig -Path` | 生の値の順序つきハッシュ（無ければ空）。誤りは例外 |
| `Resolve-ShukoLocalConfig [-ConfigPath] [-Overrides @{}]` | `installRoot keepVersions builderRepo buildRoot sources configPath configExists` を持つオブジェクト |
| `ConvertTo-ShukoLocalConfigJson -Values` | 書く JSON の文字列 |
| `Write-ShukoLocalConfig -Path -Values` | 検査して書く。誤りは例外 |

`powershell -File scripts/lib/local-config.ps1 [-ConfigPath <file>]` で、解決した値を JSON で出す（直接走らせたときだけ）。

## 3. build.mjs

```
node scripts/build.mjs <tag> [--label <label>] [--commit <sha>] [--build-root <dir>] [--config <local.json>]
                       [--record <json>] [--dry-run] [--from <step>] [--to <step>] [--fresh]
                       [--worktree <dir>] [--package-dir <dir>] [--keep <file>] [--removals <dir>] [--take-in-dir <dir>]
                       [--typecheck-script <name>] [--gulp-task <name>] [--force-zip] [--no-size]
```

- `--take-in-dir`: `checks.json` と `lockfile.diff` の置き場所（既定 `records/take-in/<label>`）。試しでリポジトリの記録を汚さないために使う。
- `--prev-tag`・`--keep-conflict`・`--patches`・`--assets`・`--overlay`・`--lock`・`--extensions-src`（2026-11-14 追加）: apply の手順で apply.mjs にそのまま渡す（指定のあるものだけ。パスは絶対パスにする。順は `applyPassThrough` のとおり）。取り込み（take-in.mjs）が build.mjs を区切らずに、取り込みのブランチの中身を当てられるようにするため（docs/06 の9節、`tasks/2026-11-14-p3-take-in/doc-corrections.md` の6）。lockfile の手順には `--removals` だけを渡す（lockfile の検査が使うのは単位だけ）。`--keep-conflict` で apply が衝突で止まったときは、build.mjs も apply で止まる（`stoppedAt: "apply"`）。
- `--worktree`・`--package-dir`: 既定 `<buildRoot>\wt\<tag>`・`<作業ツリーの親>\VSCode-win32-x64`。

| 手順（`STEPS`） | 中身 | 止まる条件 |
|---|---|---|
| `prepare` | `node scripts/prepare.mjs --tag <tag> --build-root <br> --worktree <作業ツリー> [--commit] --out <作業ツリー>.prepare.json`。`--fresh` なら先に `git -C <br>\vscode worktree remove --force <作業ツリー>`。`--worktree` は prepare・`--fresh`・apply 以降のすべてが同じ場所を見る（2026-11-14 の検証 D1 で直した） | 終了コードが 0 でない（SHA の不一致、作業ツリーに変更がある、など） |
| `apply` | `node scripts/apply.mjs <作業ツリー> --label <label> --checks-out records/take-in/<label>/checks.json --removals <dir> --keep <file> --build-root <br> --config <local.json>`（p2-apply の入口。`--build-root`・`--config` は build.mjs が決めた値をそのまま渡し、apply.mjs の `--manifests` の既定 `<br>\cache\vsix` を同じ場所にそろえる。`lockfile` の手順にも同じ2つを渡す。2026-11-14） | `apply.mjs` が無い、終了コードが 0 でない（`fail`）。`hold` は止めずに `warnings` に書く |
| `install` | 作業ツリーで `pnpm install --no-frozen-lockfile`（cmd.exe 経由） | 終了コードが 0 でない |
| `lockfile` | `node scripts/apply.mjs <作業ツリー> --label <label> --lockfile-check --checks-out <同じ> --diff-out records/take-in/<label>/lockfile.diff --removals <dir> --build-root <br> --config <local.json>`（docs/03 の5.4。`--removals` は apply・postprocess と同じ場所。取り込みのブランチの `removals/` を読ませるため。docs/06 の9節。2026-11-14） | 終了コードが 0 でない |
| `typecheck` | `pnpm run typecheck-client`（`--typecheck-script` で変えられる） | 作業ツリーの package.json にその script が無い、終了コードが 0 でない |
| `package` | `pnpm run gulp vscode-win32-x64-min` | 終了コードが 0 でない、出力のフォルダが無い |
| `postprocess` | 出力（既定 `<作業ツリーの親>\VSCode-win32-x64`）を読むだけで確かめる。下の 3.2 | 問題が1つでもある |
| `zip` | `%SystemRoot%\System32\tar.exe -a -c -H -f <br>\dist\<label>.zip -C <br>\dist\.stage-<label> <最上位の名前>`。最上位の名前は `<nameShort>-win32-x64-<label>`（`Shuko-win32-x64-1.146.0-1`）。`<br>\dist\.stage-<label>\<最上位の名前>` に出力を指すジャンクションを置いて包み、終わったらジャンクションだけを消す（出力は動かさない） | `tar.exe` が無い、zip が既にある（`--force-zip` で上書き）、終了コードが 0 でない、zip の中の最上位が1つでない |

- 子のプロセスには `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外した環境を渡す（docs/07 の3.2 の1。外した名前を記録に残す。値は残さない）。
- 長い手順の出力は、画面と `<br>\logs\<label>\<手順>.log` の両方に流す。失敗したら末尾 4 KB を記録の `tail` に写す。
- 記録は手順の始まりと終わりのたびに書き直す（途中で落ちても、どこまで進んだかが残る）。
- ラベルの既定は `<tag>-<n>`（`records/builds/<tag>-*.json` の番号の最大＋1）。
- 当てた後の作業ツリーは `prepare.mjs` が「変更がある・HEAD が違う」で拒む。最初からやり直すときは `--fresh`、途中からは `--from <手順>`。

### 3.1 記録 `records/builds/<label>.json` の形

docs/02 の7節の項目に、止まった場所と手順ごとの結果を足した。

```json
{
  "label": "1.146.0-1",
  "upstream": { "tag": "1.146.0", "commit": "69047191fc427f2f92828279aae1d90d8eeda7ab" },
  "units": [{ "id": "A-1-copilot-extension", "enabled": true, "applied": "ok" }],
  "patches": [{ "file": "patches/10-brand-assets.patch", "applied": "ok" }],
  "lockfileDiff": "records/take-in/1.146.0-1/lockfile.diff",
  "toolchain": { "node": "24.22.1", "electron": "43.8.6", "packageManager": "pnpm 12.16.0", "packageManagerDeclared": "pnpm@12.16.0", "nvmrc": "24.22.1", "nodeOfBuildScript": "v24.22.1" },
  "durations": { "install": 0, "typecheck": 0, "package": 0, "zip": 0 },
  "zip": { "path": "C:\\b\\dist\\1.146.0-1.zip", "sha256": "...", "bytes": 0, "topFolder": "Shuko-win32-x64-1.146.0-1" },
  "extensionsLockSha256": "...",
  "result": "ok | error | dry-run",
  "stoppedAt": "null | <手順の名前>",
  "message": "（error のとき）",
  "applyResult": "ok | hold | fail（checks.json の result）",
  "dryRun": false,
  "startedAt": "...", "finishedAt": "...",
  "paths": { "buildRoot": "...", "worktree": "...", "packageDir": "...", "checks": "...", "keep": "...", "removals": "...", "dist": "...", "logs": "..." },
  "config": { "path": "...", "exists": true, "buildRootFrom": "option | local.json | default" },
  "stepsSelected": ["prepare", "..."],
  "envRemovedForChildren": ["ELECTRON_RUN_AS_NODE", "VSCODE_PID"],
  "steps": [
    { "name": "install", "status": "ok | error | running", "startedAt": "...", "command": "...", "cwd": "...", "log": "...", "seconds": 0, "exitCode": 0, "tail": "（失敗のとき）", "message": "（失敗のとき）" }
  ],
  "disk": { "worktree": { "bytes": 0, "gb": 0, "files": 0 }, "package": {}, "zipBytes": 0, "countedSeconds": 0 },
  "warnings": []
}
```

- `durations` の値は秒（数）。
- `toolchain.node` は PATH の `node`（pnpm が使うもの）、`nodeOfBuildScript` は build.mjs 自身を動かす node。
- `postprocess` の手順には `layout`（`appDir`・`versionedFolder`・`exe`・`cli`・`version`・`commit`・`nameShort`）、`license`、`extensions`（3.2）、`problems` が付く。`zip` の手順には `topFolders`・`entries` が付く。
- `--dry-run` では何も走らせず、`plan`（手順ごとのコマンドと場所）と `checksBeforeRun`（`apply.mjs`・keep.json・作業ツリー・出力・tar.exe・zip の有無、有効な単位）を出す。`--record` を渡したときだけファイルに書く。

### 3.2 後処理（postprocess）の確かめ

| 項目 | 規則 | 結果 |
|---|---|---|
| `resources\app` の場所 | 出力の直下の `resources\app\product.json`、無ければ1段下のフォルダ（`<commit10>`）の下にちょうど1つ。決めつけない（docs/02 の4節の7。本家の OSS の product.json には `win32VersionedUpdate` が無いので直下になる見込み。1.146.0 の `build/lib/util.ts` の `getVersionedResourcesFolder`） | 見つからなければ誤り |
| exe と CLI | `<nameShort>.exe` と `bin\<applicationName>.cmd`（1.146.0 の `build/gulpfile.vscode.ts`） | 無ければ誤り |
| LICENSE と ThirdPartyNotices | `resources\app\<product.licenseFileName>` と `resources\app\ThirdPartyNotices.txt` | 無ければ誤り |
| 消した拡張が残っていない | 当てた単位（`checks.json` の `units[].applied == "ok"`。無ければ `removals/` の `enabled: true`）の `delete` の `extensions/<名前>` が、`resources\app\extensions\` に無い | 残っていれば誤り |
| keep.json の拡張がそろう | keep.json の名前（`scripts/lib/apply/classify.mjs` の `keepNamesOf` で読む。p2-apply と同じ読み方）が出力にある。ただし作業ツリーの `build/lib/extensions.ts` の `excludedExtensions`（本家が同梱しないもの。`vscode-test-resolver` など）は `notShipped` として誤りにしない | 足りなければ誤り |
| 自前の拡張 | `mydist` が出力にある（`notion-sync` は任意） | 無ければ誤り |
| 想定外 | 出力にあるが keep.json にも自前にも無いもの（本家の `builtInExtensions` で来る js-debug、別に作られる copilot など） | 情報（`warnings`） |

### 3.3 テストの入口（`scripts/build.mjs` が書き出す関数。main は直接走らせたときだけ動く）

| 関数 | 入力 | 出力 |
|---|---|---|
| `STEPS` | — | `["prepare","apply","install","lockfile","typecheck","package","postprocess","zip"]` |
| `parseArgs(argv)` | 引数の配列 | 引数のオブジェクト（項目は下の表）。誤りは `ArgError`（タグが無い・2つ、知らない引数、値の無いオプション、知らない手順、`--from` が `--to` より後ろ、タグ・ラベルの形） |
| `selectSteps(from, to)` | 手順の名前（`null` で端） | 両端を含む手順の配列 |
| `nextLabel(tag, existing)` | タグ、既にあるラベルの配列 | `<tag>-<最大＋1>`（`<tag>-<数>` の形だけを数える） |
| `childEnv(base, extra)` | 環境変数、足すもの | `{ env, removed }` |
| `appliedUnitsFrom(checks, removalsUnits)` | checks.json、unit.json の配列 | `{ source, units, ids }` |
| `parseExcludedExtensions(tsText)` | `build/lib/extensions.ts` の中身 | 名前の配列。見つからなければ `null` |
| `checkBuiltinExtensions({ present, removed, keep, excluded, own })` | 名前の配列 | `{ ok, residual, missingKeep, notShipped, missingOwn, unexpected }` |
| `findAppDir(root)` | フォルダ | `{ appDir, versionedFolder }`。無い・2つ以上は例外 |
| `resolveEditorLayout(root)` | フォルダ | `{ root, appDir, versionedFolder, product, version, commit, nameShort, applicationName, dataFolderName, exe, cli }`（`version` は `resources\app\package.json`、無ければ product.json） |
| `zipFolderName(nameShort, label)` | 名前、ラベル | `<nameShort の英数字と . 以外を - にしたもの>-win32-x64-<label>`（`Code - OSS` → `Code-OSS`） |
| `applyPassThrough(args)` | `parseArgs` の結果 | apply.mjs に渡す引数の配列。順は `--prev-tag <tag>`、`--keep-conflict`、`--patches`、`--assets`、`--overlay`、`--lock`、`--extensions-src`（パスは `path.resolve` した絶対パス）。指定の無いものは入れない（何も無ければ `[]`）。2026-11-14 追加 |
| `toolchainWarnings(toolchain)` | `toolchainOf` の結果（`node`・`nvmrc`・`packageManager`・`packageManagerDeclared`） | 警告の文字列の配列。node は `.nvmrc`、pnpm は `packageManager`（`pnpm@x.y.z`）に照らし、メジャーが同じで求める版以上でなければ警告（check-env.ps1 と本家の preinstall.ts と同じ規則）。読めない値も警告。`--dry-run` と `install` の手順で `warnings` に足す（止めない）。2026-11-14 追加 |
| `quoteCmdArg(s)` | 文字列 | cmd.exe に渡す引数（英数字と `_-.:\/=@` だけならそのまま、ほかは `"` で囲む。`"` を含めば例外） |

#### `parseArgs` が返す項目（2026-11-14 追記。`prevTag` 以下の7項目は同日の取り込みの依頼で追加し、全部で 26 項目）

すべての項目を必ず持つ（指定が無ければ既定値）。パスは渡された文字列のまま（解決は main で行う）。

| 項目 | 引数 | 型 | 既定 |
|---|---|---|---|
| `tag` | `<tag>`（位置の引数） | 文字列 | なし（必須。無ければ `ArgError`） |
| `label` | `--label` | 文字列か `null` | `null`（main で `nextLabel` を使う） |
| `commit` | `--commit` | 文字列か `null` | `null` |
| `buildRoot` | `--build-root` | 文字列か `null` | `null` |
| `config` | `--config` | 文字列か `null` | `null` |
| `record` | `--record` | 文字列か `null` | `null` |
| `dryRun` | `--dry-run` | 真偽 | `false` |
| `from` | `--from` | 手順の名前か `null` | `null` |
| `to` | `--to` | 手順の名前か `null` | `null` |
| `fresh` | `--fresh` | 真偽 | `false` |
| `worktree` | `--worktree` | 文字列か `null` | `null` |
| `packageDir` | `--package-dir` | 文字列か `null` | `null` |
| `keep` | `--keep` | 文字列か `null` | `null` |
| `removals` | `--removals` | 文字列か `null` | `null` |
| `takeInDir` | `--take-in-dir` | 文字列か `null` | `null` |
| `prevTag` | `--prev-tag` | タグの形の文字列か `null`（形が違えば `ArgError`） | `null` |
| `keepConflict` | `--keep-conflict` | 真偽 | `false` |
| `patches` | `--patches` | 文字列か `null` | `null` |
| `assets` | `--assets` | 文字列か `null` | `null` |
| `overlay` | `--overlay` | 文字列か `null` | `null` |
| `lock` | `--lock` | 文字列か `null` | `null` |
| `extensionsSrc` | `--extensions-src` | 文字列か `null` | `null` |
| `typecheckScript` | `--typecheck-script` | 文字列 | `"typecheck-client"` |
| `gulpTask` | `--gulp-task` | 文字列 | `"vscode-win32-x64-min"` |
| `forceZip` | `--force-zip` | 真偽 | `false` |
| `size` | `--no-size` で偽 | 真偽 | `true` |

#### `--dry-run` の `plan` の形（2026-11-14 追記）

`plan` は**オブジェクト**（配列ではない）。キーは選んだ手順（`--from`〜`--to`）の名前で、その手順があるときだけ持つ。

| キー | 値 |
|---|---|
| `prepare`・`apply`・`install`・`lockfile`・`typecheck`・`package` | `{ "command": "<コマンドの1行>", "cwd": "<走らせる場所>" }` |
| `fresh` | `--fresh` を付け、選んだ手順に `prepare` があるときだけ。`"git -C <buildRoot>\\vscode worktree remove --force <作業ツリー>"`（文字列） |
| `postprocess` | `{ "packageDir": "...", "keep": "...", "removals": "..." }` |
| `zip` | `{ "tar": "<tar.exe のパス>", "zip": "<zip のパス>" }` |

あわせて `checksBeforeRun` に `{ applyMjs, keepJson, worktree, packageDir, tarExe, zipExists }`（真偽）と `unitsEnabled`（ID の配列）、`unitsTotal`（数）を出す。作業ツリーがあれば `toolchain` も埋める。

終了コード: `0` = `ok` か `dry-run`、`1` = `error`、`2` = 引数の誤り。

## 4. install-extensions.mjs

```
node scripts/install-extensions.mjs [--install-root <dir>] [--build-root <dir>] [--config <local.json>]
     [--cli <cmd>] [--cache <dir>] [--lock <file> | --rev <commit>] [--portable <dir>] [--extensions-dir <dir>]
     [--user-data-dir <dir>] [--argv <file>] [--locale ja] [--no-download] [--dry-run] [--out <json>]
```

| 順 | 中身 |
|---|---|
| 1 | 台帳を読む（`--rev` なら `git -C <リポジトリ> show <rev>:extensions.lock.json`）。`validateLockEntry` で形を確かめる。CLI は `<installRoot>\current\bin\<applicationName>.cmd`（`current` の product.json から決める。`--cli` で上書き） |
| 守り | CLI の版の `dataFolderName` が `.vscode`・`.vscode-oss`・`.vscode-insiders`（本家）か不明で、`--portable` も `--extensions-dir` も無ければ止める（公式の zip で試すときに普段使いのデータへ入れる事故を防ぐ） |
| 2 | 言語パックを先に並べ（ID が `.vscode-language-pack-<言語>` で終わるもの）、各 VSIX を `<cache>\<id>-<版>[@<target>]\<download の URL の最後の名前>`（`lock-fetch.mjs` の置き方。既定 `<buildRoot>\cache\vsix`）から取る。無ければ台帳の `download` から取ってそこに置く（`--no-download` なら止める）。全部の SHA-256 を台帳と照合し、1件でも違えば何も入れずに止める（終了コード 2） |
| 3 | `<CLI> [--extensions-dir] [--user-data-dir] --install-extension <vsix> --force` を順に。`--portable` なら `VSCODE_PORTABLE` を渡す。子の環境から `ELECTRON_RUN_AS_NODE`・`VSCODE_*` などを外す（CLI の .cmd が自分で `ELECTRON_RUN_AS_NODE=1` を立てる） |
| 4 | `--list-extensions --show-versions` の `id@版` の行を読み、台帳と比べる。台帳に無い拡張があれば一覧を出して止める（終了コード 3。argv.json は書かない）。台帳の拡張が無い・版が違うときも止める（終了コード 1） |
| 5 | `argv.json` に `"locale": "ja"` を入れる（既にあれば値を置き換える）。コメントとほかのキーは残す。最後の `}` の前の空白を詰めて改行を1つ置き、`}` の後ろには何も置かない（末尾は必ず `\n}`）。場所は `--argv`、無ければ `--portable` の下、無ければ `%USERPROFILE%\<dataFolderName>\argv.json`（1.146.0 の `src/mainImpl.ts` の `getArgvConfigPath`。docs/04 の7節） |

出力: 標準出力に JSON 1つ（`--out` にも書く）。キー `result`（`ok` / `dry-run` / `error` / `sha256-mismatch` / `extra-extensions`）、`config`、`ledger`、`cli`、`editor`、`vsix[]`（`id`・`version`・`file`・`languagePack`・`sha256`・`sha256Ok`・`downloaded`）、`steps[]`、`installed[]`、`compare`、`argv`（`path`・`changed`・`created`・`endsWithNewlineBrace`）、`message`。

終了コード: `0` = ok・dry-run、`1` = 誤り、`2` = SHA-256 の不一致、`3` = 台帳に無い拡張が入っている。

### 4.1 テストの入口（書き出す関数）

| 関数 | 入力 | 出力 |
|---|---|---|
| `DAILY_DATA_FOLDERS` | — | `[".vscode", ".vscode-oss", ".vscode-insiders"]` |
| `isLanguagePack(entry)` | 台帳の1件 | ID が `.vscode-language-pack-<英数字と->` で終われば真 |
| `orderForInstall(entries)` | 台帳 | 言語パックを先に、残りは台帳の順（どちらの中でも元の順） |
| `vsixCachePath(cacheDir, entry)` | 置き場所、台帳の1件 | `<cache>\<id>-<版>[@<target>]\<ファイル>`（`universal` は付けない）。URL から名前が決まらなければ例外 |
| `parseListedExtensions(stdout)` | CLI の出力 | `[{ id, version }]`（`id@版` の行だけ） |
| `compareInstalled(installed, ledger)` | 2つの配列 | `{ ok, extra, missing, versionMismatch }`（ID は大文字小文字を問わない） |
| `scanJsonc(text)` | JSON with comments | 字句の配列 `{ type, start, end, depth, value }`。閉じない括弧・文字列・コメントは例外 |
| `setArgvLocale(text, locale)` | argv.json の中身（`null` か空なら新しく作る）、言語 | 書き換えた中身（必ず `\n}` で終わる）。最上位がオブジェクトでない・`locale` の値が文字列でない（数・`null`・真偽・オブジェクト・配列のどれも例外。2026-11-14 に数・`null`・真偽も止めるよう直した）・locale の形が違うときは例外 |
| `argvPathFor({ argv, portable, dataFolderName, env })` | — | argv.json の場所 |

`setArgvLocale` の例:

| 入力 | 出力 |
|---|---|
| `null` | `{\n\t"locale": "ja"\n}` |
| `{\n\t// c\n}` | `{\n\t"locale": "ja"\n\t// c\n}` |
| `{\n\t"a": 1 // c\n}\n` | `{\n\t"a": 1,\n\t"locale": "ja" // c\n}` |
| `{ "locale": "en" }` | `{ "locale": "ja"\n}` |

## 5. switch.ps1

```
switch.ps1 <label> [-Zip <zip>] [-Sha256 <hex>] [-InstallRoot <dir>] [-ConfigPath <file>] [-UserDataDir <dir>] [-LedgerPath <file>]
switch.ps1 -Previous [...]
switch.ps1 -List [...]
switch.ps1 <label> [-Zip <zip> [-Sha256 <hex>]] -ExpandOnly [...]
```

- `-ExpandOnly`（2026-11-14 追加。docs/06 の9節）: 下の表の 0（`-Zip` があれば展開。`-Sha256` があれば先に照合）と、版のフォルダの exe・CLI の確かめ（`Get-ShukoEditorInfo`）だけを行って `result: ok`、`expandOnly: true`、`current`（今のラベル。変わらない）を出して終わる。engines の確かめ・動いているエディタの確かめ・ユーザーのデータの写し・`current` の付け替え・`history.txt` は行わない。`versions\` が無ければ作る（`current`・`history.txt`・`backups\` は作らない）。`-Zip` が無ければ、既にある `versions\<label>` を確かめるだけ。`-List`・`-Previous` と一緒には使えない（誤り）。既にあるラベルへの `-Zip` は、普段と同じく誤り。取り込みは展開だけを行い、切り替えはユーザーが後で `switch.ps1 <label>` で行う。

| 順 | 中身 |
|---|---|
| 0 | `-Zip` なら `versions\<label>` に展開する（`System32\tar.exe -x`。既にあれば止める。zip の最上位がフォルダ1つならその中身を版のフォルダにする）。`-Sha256` があれば先に照合 |
| 1 | 版のフォルダの exe と CLI を確かめ（resources\app を決めつけない）、`resources\app\package.json` の版が台帳のすべての `engines` を満たすか（`^`・`>=`。lock.mjs の `satisfiesEngine` と同じ規則）。満たさなければ止める（終了コード 4） |
| 2 | `current` と、その指す `versions\<今のラベル>` の下の実行ファイルで動いているプロセスがあれば止める（終了コード 3。何も閉じない） |
| 3 | `<user data>\User\` の `settings.json`・`keybindings.json`・`snippets\`・`tasks.json`・`globalStorage\state.vscdb` を `backups\<yyyyMMdd-HHmmss>\User\` に写し、`backup.json`（`copied`・`missing`）を置く。無いものは誤りにしない。user data は `-UserDataDir`、無ければ `%VSCODE_APPDATA%` か `%APPDATA%` ＋ 今の版の `nameShort`（1.146.0 の `src/mainImpl.ts` と `userDataPath.ts`） |
| 4 | `current` のジャンクションを付け替える（古いジャンクションはリンクだけを消す。作れなければ元に戻す）。`history.txt` に `<ISO 8601>\t<前のラベルか ->\t<後のラベル>` を1行足す |
| 5 | `keepVersions` を超える版のフォルダを一覧にする（消さない）。並べ方は `<数>.<数>.<数>-<数>` のラベルを版と番号で、ほかの名前はそれより古い扱いで名前の順。`current` は必ず残す |

- `-Previous`: `history.txt` を後ろから見て、`to` が今のラベルの最初の行の `from` へ切り替える。2回続けると2つの版を行き来する。
- 同じラベルへの切り替えは何もしない（`result: ok` と理由）。
- 出力: 標準出力に JSON 1つ。`result`（`ok` / `error` / `editor-running` / `engines-unsatisfied`）、`installRoot`、`from`、`to`、`target`（`dir`・`version`・`commit`・`exe`・`cli`・`versionedFolder`）、`engines`（`unsatisfied[]`）、`backup`、`history`、`removable[]`、`expanded`。消してよい版の案内は標準エラーに出す。

### 5.1 テストの入口（台本の中の関数。ドットで読み込むと main まで走るので、テストは関数を写すか、台本を引数つきで走らせる）

| 関数 | 入力 | 出力 |
|---|---|---|
| `Test-EngineRange -Range -Version` | `^1.94.0`、`1.146.0` | 真偽 |
| `ConvertFrom-HistoryLine -Line` | 1行 | `{ time, from, to }` か `$null` |
| `Get-PreviousLabel -Entries -Current` | 履歴、今のラベル | 戻る先のラベルか `$null` |
| `Get-LabelSortKey -Name` | ラベル | 並べ替えの鍵 |
| `Get-RemovableVersions -Names -Current -Keep` | 版の名前、今、残す数 | 消してよい名前（古い順） |
| `Get-ShukoEditorInfo -Root` | 版のフォルダ | `root appDir versionedFolder exe cli version commit nameShort applicationName dataFolderName` |

## 6. configure.ps1

```
configure.ps1 [-InstallRoot <dir>] [-KeepVersions <n>] [-BuildRoot <dir>] [-BuilderRepo <dir>] [-NoMove] [-NoShellIntegration] [-ConfigPath <file>]
```

| 場合 | 動き |
|---|---|
| 引数なし・ファイルが無い | 既定値で作る。`builderRepo` は台本のあるリポジトリ |
| 引数なし・ファイルがある | 解決した値を出すだけ |
| `-KeepVersions`・`-BuildRoot`・`-BuilderRepo` | 確かめて書き換える（`-KeepVersions` は指定があるか `$PSBoundParameters` で見分け、0 や負の数なら終了コード 1 で止める。2026-11-14 に直した）（`-BuildRoot` は前の場所の物を動かさない。`-BuilderRepo` は `extensions.lock.json` があること） |
| `-InstallRoot` | docs/02 の6.1 の1〜6。1: 前の場所の下の実行ファイルで動くプロセスがあれば止める（終了コード 3）。2: 新しい場所がローカルの固定ドライブの NTFS（UNC は誤り）。入れ子（前の場所の中・外）も誤り。3: `versions\`・`history.txt`・`backups\` を移す（同じドライブは名前の変更、違うドライブは robocopy /MOVE。新しい場所に同じ名前があれば止める）。4: `current` を新しい場所に作り直す。5: 既にあるスタートメニューのショートカット（ユーザーの Programs の直下の .lnk）とユーザーの PATH のうち `<前>\current` を指すものだけを `<新>\current` に向け直す（新しく作らない。`-NoShellIntegration` で飛ばす）。6: 最後に local.json を書く。途中で失敗したら、行った操作を逆の順に戻し（ジャンクションの作り直しは最後）、local.json は前のまま |
| `-NoMove` | 何も移さず、新しい場所で空から始める。前の場所はそのまま残す |

出力: 標準出力に JSON 1つ（`result`・`actions[]`・`values`・`resolved`・`undo[]`・`userPath`・`message`）。終了コード: `0` = ok、`1` = 誤り、`3` = エディタが動いている。

ユーザーの PATH（2026-11-14 の検証 4節の6で直した）: `HKCU\Environment` の `Path` を `%変数%` を展開せずに読み（`DoNotExpandEnvironmentNames`）、種類（この PC では `ExpandString` = REG_EXPAND_SZ）を保って書き戻し、`WM_SETTINGCHANGE` を送る。`[Environment]::SetEnvironmentVariable` は使わない。結果の `userPath` に `{ found, kind, changed }` を出す。書き換えの規則は純粋な関数 `Update-PathEntries -Raw -OldBin -NewBin`（各項目を `%変数%` を展開して末尾の `\` を外し、大文字小文字を問わず `<前>\current\bin` と比べる。一致した項目だけを `<新>\current\bin` に置き換え、ほかの項目の `%変数%` の形と区切りは元のまま。一致が無ければ `$null`）。戻しは前の生の値と種類で書き戻す。

prepare.mjs（2026-11-14）: `--worktree <dir>` と `--config <local.json>` を足した。buildRoot は共通の部品（`resolveLocalConfig`）で決める（`resolveBuildRoot(cliValue, { configPath })` はその薄い包み）。作業ツリーの既定は `<buildRoot>\wt\<tag>`（`resolveWorktree(buildRoot, tag, cliValue)`）、記録の既定は `<作業ツリー>.prepare.json`。作業ツリーが常設の clone と同じか中にあれば止める。

## 7. 決めたこと・別案

- **zip の最上位の名前**: docs/02 の4節の8は「出力のフォルダを改名して tar」と書く。Windows の bsdtar 3.8.9 には名前の置き換え（`-s`）が無かった（"-s is not supported by this version of bsdtar"）。改名すると出力の場所が変わり、公式の zip での試しでは元のフォルダを動かせないので、ジャンクションと `-H` で包む形にした。zip の中身は改名と同じになる（試しで最上位が1つ、項目 3,944）。資料の直しは doc-corrections.md の1。
- **switch.ps1 の `-Zip`**: brief の範囲（版ごとのフォルダ）に含まれると読んで足した。docs/02 の6.1 の表では展開は `take-in.mjs`・`adopt.mjs` の役目なので、それらができたらこの入口を使うか、二重に持たないかを決める（未解決の2）。
- **install-extensions.mjs の順**: docs/04 の5節の順（入れる → 台帳に無いものを見て止める → argv.json）のとおり、台帳に無い拡張があれば argv.json を書かずに止める。
- **守り**: 公式の zip（`dataFolderName` が `.vscode`）の CLI を `--portable` なしで走らせると普段使いの `%USERPROFILE%\.vscode\extensions` に入るため、本家の名前のときは止める。

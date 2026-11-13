# 引き継ぎ（蒙恬 → リーダー・大岡越前守・曹参）

- タスク: 台帳と mydist を今日の裁定に合わせる（`brief.md`）
- 書いた日: 2026-11-13

## 結果

一部完了。1〜5 は済んだ。完了条件のうち、単体テスト（`node --test tests/*.test.mjs`）は私の許可に無く、走らせていない。`node --check` は通った。

## 成果物

- `e:\develop\self\Team\projects\ai-editor\extensions.lock.json`（`dotenv.dotenv-vscode` を外して8件。`weixu.wx-vsce-dotenv` の `note` を直した）
- `e:\develop\self\Team\projects\ai-editor\extensions-src\mydist\package.json`（`extensions.allowed` から外した。通信を止める4件と `claudeCode.environmentVariables` を足した）
- `e:\develop\self\Team\projects\ai-editor\extensions-src\mydist\README.md`（足した既定とその理由）
- `e:\develop\self\Team\projects\ai-editor\scripts\check-env.ps1`（Visual Studio の検査はパスが実在するときだけ通す）
- `e:\develop\self\Team\projects\ai-editor\scripts\prepare.mjs`（`commit` が無いときは止める）
- このディレクトリの `changes.md`・`doc-corrections.md`・`handoff-notes.md`

## 要点

1. 台帳は8件。台帳を読む台本（`lock-fetch`・`lock-verify`・`lib/lock.mjs`）は件数を決め打ちしていないので、8件で困らない。困るのは曹参のスモークの既定（下の「曹参へ」）。
2. 通信を止める4件は、どれも window スコープなので mydist の既定で効く。型定義の自動取得は、1.146.0 では新しい設定が既定値を読まないため、既定は古い `typescript.disableAutomaticTypeAcquisition` に入れた。
3. CLI に環境変数を渡す設定は `claudeCode.environmentVariables`（manifest で確かめた。配列で、要素は `{name, value}`、machine スコープ）。mydist の既定に `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を入れた。公式の文書で、この変数が止めるものと止めないものを確かめた（出典は下）。
4. **大きな事実**: application スコープの設定は、拡張の `configurationDefaults` では既定にできない（1.146.0 のソース）。今の mydist の `extensions.allowed` と `telemetry.telemetryLevel` は効かない。6.1 の `update.mode` など4件も同じ。`doc-corrections.md` の1。
5. `check-env.ps1` と `prepare.mjs` の軽微な2点を直した。

## 確かめたこと

- `node --check scripts/prepare.mjs`: 通った。
- `node scripts/lock-fetch.mjs --only none.none --out tmp/p1-ledger-check`: 何も取らずに台帳を読み、終わった（台帳は JSON として読める）。台帳の `"id"` は8件。
- `prepare.mjs` の `commit` が無いとき: `upstream.json` から一時的に `commit` を外して走らせ、終了コード 1、`result: "error"`、`steps: []` で止まった。走らせた後に元に戻し、`git diff` に出ないことを確かめた。
- `check-env.ps1`: 最後まで誤りなく走った（終了コード 2 は、道具の導入待ちという今の環境どおり）。この PC には Visual Studio も `vs20xx_install` も無いので、直した分かれ道は走らせていない。
- mydist の `package.json`: 書き換えた箇所を読み直して、JSON の形を目で確かめた（JSON を読み込んで確かめる台本は、私の許可で走らせられるものに無い）。
- ソースの事実は `C:\b\wt\1.146.0` を読んで確かめた（ビルドと依存の導入はしていない）。

## 出典（取得日 2026-11-13）

- manifest: `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` の 36〜58行（Open VSX の https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json と同じもの）。拡張の JS は読んでいない。
- https://code.claude.com/docs/en/env-vars の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` の行。原文: "Set to any non-empty value, such as `1`, to disable nonessential network traffic: auto-updates, telemetry, error reporting, the `/feedback` command, Claude-drafted feedback, release notes, the PR and MR status badge checks, and availability checks such as the fast mode check. … Setting it to `0` or `false` still disables this traffic … Also disables feature-flag fetching, which makes Remote Control and the other features that need feature-flag fetching unavailable. Official plugin marketplace auto-install isn't covered; disable it with `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`. Doesn't affect gateway model discovery …"
- https://code.claude.com/docs/en/data-usage の「Telemetry services」と「Default behaviors by API provider」。指標（`DISABLE_TELEMETRY`）とエラーの報告（`DISABLE_ERROR_REPORTING`）をこの変数1つでまとめて止められる。品質の調査も止まる。WebFetch の宛先の安全確認（`api.anthropic.com`）と公式のマーケットプレイスの自動登録は止まらない。
- https://code.claude.com/docs/en/vs-code の拡張の設定の表: `environmentVariables`、既定 `[]`、"Set environment variables for the Claude process. Use Claude Code settings instead for shared config."

## テストの入口（曹参・大岡越前守へ）

| 対象 | 入口 | 期待 |
|---|---|---|
| 台帳 | `extensions.lock.json` | 8件。`dotenv.dotenv-vscode` が無い。`weixu.wx-vsce-dotenv` の `note` が「.env の拡張。…決めた」。各行が `validateLockEntry`（`scripts/lib/lock.mjs`）で誤り0件 |
| mydist の許可 | `extensions-src/mydist/package.json` の `contributes.configurationDefaults["extensions.allowed"]` | キーが `"*"`（false）と台帳の8件の ID（小文字にしたもの）にちょうど一致する |
| mydist の既定 | 同じ `configurationDefaults` | `typescript.disableAutomaticTypeAcquisition: true`、`npm.fetchOnlinePackageInfo: false`、`json.schemaDownload.enable: false`、`workbench.settings.enableNaturalLanguageSearch: false`、`claudeCode.environmentVariables` が `[{ "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }]` |
| `prepare.mjs` | `upstream.json` に `commit` が無く `--commit` も無い状態で `node scripts/prepare.mjs --build-root <空のフォルダ> --out <json> --no-size` | 終了コード 1。出力の JSON が `result: "error"`、`message` に「commit が無く」、`steps: []`。`--commit` を渡したときは照合へ進む |
| `check-env.ps1` | `$env:vs2026_install = 'C:\nonexistent'` を設定して `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1` | `visualStudio.preinstallFolders` にその項目が `exists: false` で載り、`preinstallCheckPasses` が false（ほかに見つかるフォルダが無い PC で）。実在するパスを指せば true |
| 自作のビルドでの効き方（Phase 2、手かスモーク） | built のモードで `vscode.workspace.getConfiguration().inspect(<キー>).defaultValue` | 4件と `claudeCode.environmentVariables` が上の値。`extensions.allowed` と `telemetry.telemetryLevel` は mydist の値にならない見込み（拡張ホストのログに "Cannot register configuration defaults for …" の警告）。`claudeCode.environmentVariables` に同じ警告が出たら、起動の順に頼った見込みが外れている |
| CLI に変数が届くか（Phase 2、手） | 自作のビルドの Claude Code のパネルで、Bash に `echo $CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`（PowerShell なら `$env:...`）を走らせてもらう | `1` が返る。普段のターミナルの `claude` では空 |

## 曹参へ（スモークの台本。私は触れていない）

- `tests/smoke/lib/env.mjs` の `defaultExtensionIds(ledger, dotenv = 'a')` は、既定で `weixu.wx-vsce-dotenv` を除く。台帳が `weixu.wx-vsce-dotenv` だけになったので、既定のままでは .env の拡張が1つも入らず、`lang.env.dotenv` が skip になる。`--dotenv` の切り替え（`run.mjs` の既定 `'a'`、`DOTENV_A`/`DOTENV_B`、`tests/smoke.test.mjs` の334〜336行と561〜567行、`tests/smoke/probe/extension.js` の378〜390行）を、台帳のとおり全部を入れる形に直す必要がある。

## docs/ との食い違い

`doc-corrections.md` に6点。主なもの:

1. application スコープの設定（`extensions.allowed`、`telemetry.telemetryLevel`、`update.mode`、`workbench.enableExperiments`、`extensions.autoUpdate`、`extensions.autoCheckUpdates`）は、拡張の `configurationDefaults` で既定にできない。docs/04 の6.1 の注の「未確認」は、ソースで答えが出た。
2. `extensions.autoUpdate` の値は `false` ではなく `"off"`。
3. 6.1 の最後の行の「設定の名前と形は Phase 2 で確かめる」は、`claudeCode.environmentVariables` と確かめた。
4. `typescript.disableAutomaticTypeAcquisition` は 1.146.0 で非推奨。それでも既定は古い設定に入れるのが効く。
5. docs/00 の82行と docs/08 の75行で、.env の拡張がまだ未決の書き方のまま。
6. 6.1 の表の5件（`workbench.startupEditor` など）が mydist に入っていない。

## 未解決の点（リーダーの判断を仰ぐ）

1. application スコープの6件を、product.json の上書きとパッチのどちらで既定にするか。今の mydist の `extensions.allowed` と `telemetry.telemetryLevel` は残した（害は警告だけ）。
2. 6.1 の表にあって mydist に無い5件を足すか。`workbench.startupEditor: none` は mydist で効く。依頼の範囲の外なので足していない。
3. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` で止まらない CLI の通信（公式のプラグインのマーケットプレイスの自動登録、WebFetch の宛先の安全確認）も止めるか。裁定は「付帯の通信を止める」なので、当たりそうではある。ただし裁定にある方法は環境変数1つだけなので、足していない。足すなら `claudeCode.environmentVariables` に `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` を1件足すだけで済む。`skipWebFetchPreflight` は CLI の設定ファイルの値で、ブロックの一覧の確認を飛ばすことになる（安全の確認を外す）ので、勧めない。
4. `claudeCode.environmentVariables` が machine スコープなのに既定で効くのは、起動の処理の順に頼っている（`changes.md` の4節）。Phase 2 で実物で確かめるまでは見込み。本家の処理の順が変わると効かなくなる。毎週の取り込みで見る点に入れることを勧める。
5. ユーザー設定（Notion で同期する）に `claudeCode.environmentVariables` を書くと、配列が丸ごと置き換わり、この1件が消える。docs/05 に注意として書くことを勧める。
6. `lock-verify.mjs --write-lock` を、Phase 0 の古い `C:\b\p0\vsix\fetch-result.json`（9件）で走らせると、`dotenv.dotenv-vscode` が台帳に戻る。`lock-fetch` を先に走らせれば起きない（docs/04 の4節の4の手順どおり）。古い置き場所を消すかはリーダーの判断。
7. 単体テストを私は走らせていない（許可に `node --test` / `node tests/...` が無い）。大岡越前守か曹参に `node --test tests/*.test.mjs` を走らせてほしい。`tests/lock.test.mjs` は作った行で試していて本物の台帳を読まないので、結果は変わらない見込み。

報告の受け渡しについて: 報告を返す道具 `SubagentHandback` は、権限のフックに「定義の tools に無いツール」として4回止められた。報告はこのファイルと、最後の返答の本文で渡す。この道具を定義の `tools` に足すかを確かめてほしい（権限の変更なので、ユーザーの承認が要る）。

---

## 追記（リーダーの追加の依頼。2026-11-13、da6c586 の後）

### 結果

完了。依頼の1〜5を済ませた。tests/ と `C:\b\smoke\` には触れていない。`C:\b\wt\1.146.0` は読んだだけで、`git -C C:/b/wt/1.146.0 status` で変更が無いこと（working tree clean）を確かめた。

### 成果物

- `e:\develop\self\Team\projects\ai-editor\extensions-src\mydist\package.json`
  - 足した: `workbench.startupEditor: "none"`
  - `claudeCode.environmentVariables` に足した: `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1`
  - 外した: `extensions.allowed`、`telemetry.telemetryLevel`
- `e:\develop\self\Team\projects\ai-editor\extensions-src\mydist\README.md`（application スコープを書かない理由、2つ目の変数）
- `app-scope-options.md`（新規。依頼の4）
- `changes.md`（1節に「`lock-verify` の手順の注意」、6節に今回の変更）
- `doc-corrections.md`（7: docs/04 の5節、8: docs/02 の3節を足した）

### 要点

1. 依頼の1で足したのは `workbench.startupEditor`（RESOURCE スコープ）だけ。6.1 の表のほかの window 以下の設定は、すでに入っていた。この設定は実験で既定が上書きされうるが、実験は product.json に `tasConfig` が無いと動かないので、mydist の既定が効く見込み。
2. **product.json には、設定の既定を入れる仕組みが無い**（デスクトップ版の 1.146.0）。外から既定を渡す口は web 版の起動の引数だけ。
3. それでも6件のうち5件（`telemetry.telemetryLevel`・`update.mode`・`workbench.enableExperiments`・`extensions.autoUpdate`・`extensions.autoCheckUpdates`）は、OSS の product.json に `enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery` が無いので、設定の値によらず働かない。各機能のコードで、その分かれ道の行を確かめた。
4. **`extensions.allowed` だけは、product.json では代わりがきかない。** パッチの案は2つ。
   - B-1: 設定ごとに既定の値を書き換える（6か所・5ファイル）
   - B-2: 汎用のパッチ（`configurationRegistry.ts` 1180行の直後に数行。product.json の独自のキーを既定として登録する。このファイルは既に product を読み込んでいる）
   - 拡張の既定の検査（`allowedScopes`）を緩めるパッチは答えにならない。main・共有・CLI のプロセスには拡張の既定が届かないため（推定）。
5. 推奨（決めていない）:
   - 5件: 案A（product.json にキーを入れない）を主にし、本家がそのキーを足したら `apply.mjs` で外すか止める。
   - `extensions.allowed`: 案B-2。値は `product.overlay.json` に置く。
   - B-2 を入れるなら、5件も同じキーに入れて設定の画面の表示を合わせる。

### 確かめたこと

- mydist の `package.json` は、書き換えた後に読み直して、JSON の形と10キーを目で確かめた。
- ほかに走らせたものは無い。調べはソースを読むことだけで行った。

### テストの入口（追加分）

| 対象 | 期待 |
|---|---|
| mydist の `configurationDefaults` | `extensions.allowed` と `telemetry.telemetryLevel` のキーが無い。`workbench.startupEditor` が `"none"`。`claudeCode.environmentVariables` が2件（`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`=`"1"`、`CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`=`"1"`）の順 |
| mydist に application スコープの設定が無いこと | 6件のキーのどれも `configurationDefaults` に無い（警告を出さないため） |
| Phase 2 の実物 | 拡張ホストのログに "Cannot register configuration defaults" が mydist について1件も出ない |

上の「テストの入口」の表のうち、「mydist の許可」の行（`extensions.allowed` が台帳の ID と一致する）は、今回 mydist から `extensions.allowed` を外したので、もう当てはまらない。B-2 を採るなら、同じ照合を `product.overlay.json` の値に対して行う。

### docs/ との食い違い（追加分）

- docs/04 の5節（103行）が、まだ「`extensions.allowed` を mydist の既定で」と書いている（`doc-corrections.md` の7）。
- 案A をとるなら、docs/02 の3節の表に `enableTelemetry`・`aiConfig`・`updateUrl`・`extensionsGallery` を「あれば remove」として足す（`doc-corrections.md` の8）。

### 未解決の点（追加分）

- 6件の既定の扱い（`app-scope-options.md` の4）は、リーダーの判断を待つ。
- B-2 の「どのプロセスでも product の同じキーが見える」と、1.4 の「main・共有・CLI のプロセスには拡張の既定が届かない」は、ソースからの推定。Phase 2 で確かめる。
- 上の「未解決の点」の1・2・3・6は、今回の依頼で次のとおり扱いが決まった。
  - 1（6件の扱い）: `app-scope-options.md` に書き、判断待ち
  - 2（mydist に無い5件）: window 以下の1件（`workbench.startupEditor`）を足した
  - 3（マーケットプレイスの自動登録）: 変数を足した
  - 6（古い `fetch-result.json`）: `changes.md` に手順の注意として書き、置き場所は消さずに残した

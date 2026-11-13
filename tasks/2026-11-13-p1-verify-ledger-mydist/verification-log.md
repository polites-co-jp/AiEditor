# 検証の記録: Phase 1 の検証（3）台帳と mydist、スモークの G〜L

- 検証: 大岡越前守（2026-11-13）
- 依頼: `brief.md`（1〜5）と、リーダーの追加の依頼（曹参の G〜L と dotenv の対応、スモークの実行）
- 作業ツリー: `main`（HEAD `a54773c`）の未コミットの変更を `git diff` で読んだ
- 本家のソース: `C:\b\wt\1.146.0`（読んだだけ。ビルド・依存の導入はしていない）

## 第1部: 蒙恬の成果（台帳・mydist・check-env.ps1・prepare.mjs）

### 1. 台帳（`extensions.lock.json`）: 合格

| 確かめたこと | 方法 | 結果 |
|---|---|---|
| 8件で `dotenv.dotenv-vscode` が無い | ファイルを全部読んだ。`node --test tests/smoke.test.mjs` の `defaultExtensionIds` の試験が実物の台帳を `JSON.parse` で読み、8件・weixu あり・dotenv-vscode なしを確かめて PASS | 8件（anthropic.claude-code、detachhead.basedpyright、ms-vscode.powershell、mads-hartmann.bash-ide-vscode、mechatroner.rainbow-csv、weixu.wx-vsce-dotenv、tomoki1207.pdf、MS-CEINTL.vscode-language-pack-ja）。JSON として読める |
| 残りの行の値が変わっていない | `git diff -- extensions.lock.json` | 差分は2つだけ。(a) `dotenv.dotenv-vscode` の1件（`{` から `},` までの43行）を消した。(b) `weixu.wx-vsce-dotenv` の `note` の1行を書き換えた。版・`sha256`・`checks` など他の値は1文字も変わっていない（ハンクは `-227,49 +227,6` と `-310,7 +267,7`。削除44行、追加1行） |
| 各行が `validateLockEntry` を通るか | 実物の台帳に `validateLockEntry` を当てる台本は、私の許可で走らせられるものに無い。`scripts/lib/lock.mjs` 81〜126行の規則を、8行に手で当てた | 8行とも誤り0件。必須の8項目がある。id は `ID_PATTERN` に合う。version は x.y.z。source は `open-vsx`。download は https。sha256 は64桁の小文字の16進。publishedAt は ISO 8601（マイクロ秒と Z）。verified は true。engines は `^x.y.z`。`targetPlatform` は claude-code の `win32-x64` だけ。`tomoki1207.pdf` に `license` が無いのは任意の項目で、前からそう。`note` は検査の対象外。変更前の HEAD の行は Phase 0 の 0-6 で検査済みで、今回の変更は `note` の文字列だけ |
| 新しい `note` の中身 | 読んだ | 裁定（`docs/user-decisions.md` の「.env の拡張を決めた」）と事実（診断 4 件 / 0 件）に合う。JSON の文字列に ASCII の `"` を含まない |
| 台帳を読む台本が8件で困らないか | `scripts/` の `dotenv`・`9件` を検索した | 決め打ちは `scripts/lib/p0-common.ps1`（Phase 0 の環境の記録。打ち切り済み）だけで、蒙恬の申告と同じ。`lock-fetch.mjs` の実行は私の許可に無いので、走らせていない |

### 2. mydist（`extensions-src/mydist/package.json`・`README.md`）: 合格

| 確かめたこと | 根拠 | 結果 |
|---|---|---|
| `configurationDefaults` が docs/04 の6.1 の window スコープ以下の行とそろうか | 6.1 の表の16行から application の6件を除くと10行。mydist のキーは10個で、値まで一致する（`chat.disableAIFeatures: true`、`workbench.colorTheme: "Light Modern"`、`breadcrumbs.enabled: false`、`workbench.startupEditor: "none"`、`basedpyright.importStrategy: "useBundled"`、4件の通信止め、`claudeCode.environmentVariables` の2件） | 一致 |
| 各設定のスコープ（1.146.0 のソース） | `typescript-language-features/package.json` 2408〜2413行 `"scope": "window"`。`npm/package.json` 327〜331行 `"scope": "window"`。`json-language-features/package.json` 122〜128行（scope なし。拡張の設定は `configurationExtensionPoint.ts` 345行で WINDOW になる）。`preferencesContribution.ts` 117〜121行 `ConfigurationScope.WINDOW`。`gettingStarted.contribution.ts` 298〜299行 `ConfigurationScope.RESOURCE`。basedpyright 1.40.2 の manifest 1937〜1945行 `"scope": "resource"` | どれも許可されるスコープ |
| application スコープの6件が入っていないか | `package.json` の16〜36行。6件のスコープは、`extensionManagement.ts` 766行、`telemetryService.ts` 349行、`update.config.contribution.ts` 23行、`assignmentService.ts` 657行、`extensions.contribution.ts` 147・193行で、すべて `ConfigurationScope.APPLICATION` | 6件とも無い（`extensions.allowed` と `telemetry.telemetryLevel` は外した） |
| `claudeCode.environmentVariables` が2件か | `package.json` 26〜35行 | 2件。`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`=`"1"`、`CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`=`"1"` の順。裁定（0-5 の棚卸しの後）と記録（CLI の付帯の通信の当てはめ）に合う |
| 出典: manifest | `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` 36〜58行 | `type: array`、items は `{name: string, value: string}` で両方必須、`scope: machine`、`default: []`。蒙恬の記述と一致 |
| 出典: 公式の文書 | 私は Web の道具を持たないので、取り直していない | 蒙恬の引用（env-vars・data-usage・vs-code の3ページ、取得日つき）は、結論（この変数で付帯の通信を止める。マーケットプレイスの自動登録は別の変数）を支える書き方になっている。変数を渡すこと自体は裁定が決めているので、結論は文書の取り直しに左右されない |
| machine スコープなのに既定が効く見込み | `configurationExtensionPoint.ts` 188行（`configurationDefaults` の受け口）が 244行（`configuration`。`deps: [defaultConfigurationExtPoint]`）より先に登録される。`extensionsRegistry.ts` 678・697行は Map の値の順。`abstractExtensionService.ts` 581行で全部の拡張を1回で処理し、1169〜1175行で受け口の順に回す。スコープの検査（216〜233行）は、その時点で登録済みの設定にしか働かない。後から登録された設定には `configurationRegistry.ts` 1114〜1133行が既定を当て、スコープの検査は無い | 推論はソースで支えられる。ただし走らせての確認は無く、docs/04 の6.1 も「見込み。Phase 2 で確かめる」と書いている。合否には使わない |
| 型定義の自動取得を古い設定に入れた理由 | `typescript-language-features/src/configuration/configuration.ts` 229〜236行、`src/utils/configuration.ts` 23〜57行（`hasModifiedValue` は既定値を見ない）。package.json の ATA の設定は `js/ts.tsserver.automaticTypeAcquisition.enabled`（2398行）と古い設定の2つだけ | 蒙恬の説明どおり |
| `package.json` が JSON として正しいか | JSON の構文解析を走らせられる許可が私に無い。差分の範囲（16〜36行）を読んで括弧・カンマ・引用符を確かめた。ほかの行は差分に無い | 正しい（目視）。注: 自作のビルドで mydist を読むまで、機械での確認は無い |
| README | `git diff` | 書かない理由（スコープの検査の行）、4件と2つの変数の理由がある。事実と合う |

### 3. `check-env.ps1` と `prepare.mjs` の直し: 合格（走らせての確認は私の許可の外）

- `check-env.ps1`（171〜177行）: `exists` を持たない項目（フォルダを見つけたときだけ足す）か、`exists` が真の項目だけを数える。本家の `build/npm/preinstall.ts` 83〜87行（`if (vsPath && fs.existsSync(vsPath))`）と同じ判定。フォルダの項目は 140行で `Test-Path` が真のときだけ足しているので、判定と合う。`preinstallFolders` の形は変わらない。足した注は ASCII。
  - `$_.Contains('exists')` は `[ordered]@{}`（OrderedDictionary）のキーの有無を見るメソッドで、正しく効く。
  - 「テストの入口」の `$env:vs2026_install = 'C:\nonexistent'` での実行は、`scripts/check-env.ps1` を走らせる許可が私に無いので、していない。
- `prepare.mjs`（140〜141行、161行）: `expected` が空なら clone・fetch・worktree より前に `finish("error", …)` で止まる（`finish` は `process.exit` するので、その先に進まない）。`rec.steps` は空のまま。161行の照合から `expected &&` を外したのは、141行で空が除かれた後なので正しい。両方とも小文字にそろえて比べている。
  - 「テストの入口」の実行（`upstream.json` から `commit` を外す）は、`node scripts/prepare.mjs` の許可が私に無く、`upstream.json` も私の書き込み先の外なので、していない。蒙恬の実行の記録（終了コード 1、`result: "error"`、`steps: []`）と、読んだコードの流れが合う。

### 4. 単体テスト: 合格

| コマンド | 結果 |
|---|---|
| `node --test tests/lock.test.mjs tests/sublime-keys.test.mjs` | tests 165 / pass 165 / fail 0 |
| `node --test tests/smoke.test.mjs`（追加の依頼で解禁） | tests 70 / pass 70 / fail 0 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | passed 102 / failed 0 |

`extensions-src/*/test/*.test.mjs` は無い（Glob で0件）。

### 5. `app-scope-options.md` の事実: 合格

| 事実 | ソースの行 | 結果 |
|---|---|---|
| product.json に設定の既定の仕組みが無い | `src/vs/base/common/product.ts` に `configurationDefaults` は0件。外からの口は web 版の `web.api.ts` 315行と、それを読む `services/configuration/browser/configuration.ts` 48〜49行だけ | 支えられる |
| 1.146.0 の OSS の product.json に `enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery` が無い | `C:\b\wt\1.146.0\product.json` を検索して0件 | 支えられる |
| B-2 の場所 | `configurationRegistry.ts` 1179行 `new ConfigurationRegistry()`、1180行 `Registry.add(Extensions.Configuration, …)`。17行 `import product from '../../product/common/product.js'`、1253行で `product.defaultChatAgent` を使う | 支えられる |
| `source` を付けなければ `disallowConfigurationDefault` も越える | `configurationRegistry.ts` 1119行 `(!property.disallowConfigurationDefault \|\| !configurationdefaultOverride.source)` | 支えられる |
| 前例 | `src/vs/sessions/contrib/configuration/browser/configuration.contribution.ts` 9〜12行（「last resort」の注）、39行 `registerDefaultConfigurations` | 支えられる |
| B-1 の行番号 | `extensionManagement.ts` 756行 `default: '*'`、`telemetryService.ts` 347行、`update.config.contribution.ts` 22行、`assignmentService.ts` 656行、`extensions.contribution.ts` 146・192行 | 一致 |

「main・共有・CLI のプロセスに拡張の既定が届かない」「どのプロセスでも product の同じキーが見える」は、蒙恬自身が推定と書いており、そのとおり推定のまま（docs/02 の3節の表もパッチの方針として書くだけ）。

## 第2部: 曹参の成果（G〜L、dotenv の対応、PID の使い回し）

### 差分を読んで確かめたこと

| 指摘 | 読んだ箇所 | 判定 |
|---|---|---|
| G | `probe/extension.js`: `packageUri`（Extension の API に無い）をやめ、`e.extensionPath \|\| e.extensionUri.fsPath`。拡張・コマンド・診断を別々の try にし、失敗を `snapshotError` にまとめる。`run.mjs`: `probe.snapshot` を足し、`snapshotError`・拡張0件・コマンド0件・`commands.json` が無い、のどれでも FAIL | 正しい。単体テストは文字列の検査だが、実機の実行で PASS と `commands.json` を見た（下） |
| H | `fixtures.mjs` の `diffFixtures`（全 fixture をバイトで比べ、意図した3ファイル以外の変更と消失を拾う）、`run.mjs` の `base.fixtures-intact` | 正しい。試験は、過去の事故（readme.md の行が空になる）・消失・PDF の破損を入れて、落ちることを確かめている |
| I | `common.mjs` の `removeOwnLocks`（起動の後に増え、pid が木にあるかフォルダが一致するものだけ）、`smoke-launch.mjs` の prime の後 | 正しい。前からある `.lock`、他人の `.lock` は消さないことを試験が確かめる |
| J | `smoke-design.md` 2.6 | 語の有無の検査で PASS |
| K | `run.mjs` の `pruneRuns`: `.keep` のある置き場所は候補の一覧から外す（消さず、N にも数えない） | 正しい。`--keep-runs 0` でも残る試験あり |
| L | `scripts/netaudit.ps1` 874行の文の差し替えだけ（ASCII） | 正しい。netaudit 102/102 |
| PID の使い回し | `common.mjs` の `treeFromProcesses` は、作成時刻が両方分かるときだけ、親より古い子を木から外す。`run.mjs` の「残り」は `sameProc`（名前と親が同じ）で数える | **普段使いのプロセスに触れる範囲は広がらない**。この直しは木を狭めるだけ。実際に止めるのは `stopTree` の `taskkill /PID <根> /T /F` で、根の実行ファイルの照合（`rootMatches`）も変わっていない。`listProcesses` に `CreatedMs` を足しただけで、出力の UTF-8 の固定も残っている |
| 4桁の PID | `normalizeError` に `(node:\d+)` → `(node:<n>)` | 正しい。試験あり |
| dotenv | `env.mjs` の `defaultExtensionIds(ledger)` は台帳のとおり全部。`DOTENV_A/B`・`--dotenv` を外した。probe は `cfg.dotenvIds`（台本が渡す、入れた id のうち `dotenv` を含むもの）を見る。台帳に無い拡張は `--ext` で、拡張フォルダは `-custom` で分かれる | 正しい。台帳と台本の既定の経路が1本になった |
| `--reuse-ext` | `env.mjs` の印の比べに `\|\| reuse` | 既定は off。根拠にした実行では使っていない |

### スモークの実行（公式の zip）

コマンド: `node tests/smoke-run.mjs --prime --baseline C:/b/smoke/baseline-official-1.146.0.json`

- 置き場所: `C:\b\smoke\runs\official-20261113T143803\`
- 結果: **PASS 49 / FAIL 0 / SKIP 0 / INFO 9**（終了コード 0）
- `probe.snapshot` PASS: 拡張 13 件（動作中 8）、コマンド 3403 件、診断 22 件。`probe-result.json` に `snapshotError` は無い（`done: true`、`commandCount: 3403`、`diagnosticsTotal: 22`、`uiLanguage: "ja"`）
- `commands.json` ができた（先頭は `GetVsCodeSessionId`、`PowerShell.ClosePanel` …）
- `base.fixtures-intact` PASS（変わったのは `edit/replace.txt`・`edit/target.txt`・`tracked.txt` だけ）
- `base.ext-install` PASS（8 件。台帳の変更の後に曹参が作り直した拡張フォルダを使い回した）
- `lang.env.dotenv` PASS（`weixu.wx-vsce-dotenv` が動作中）。`lang.env.compare`（INFO）で `.env.bad`・`bad.env` に診断 4 件ずつ
- `safety.process-tree` PASS（木 27 個、残り 0、孤児 0）。`claude.lock` は自分の3個を後始末で消した
- `errors.new` PASS（基準は旧い台帳で作ったもの。リーダーの判断どおり作り直していない）
- 根拠のファイルの SHA-256:

| ファイル | SHA-256 |
|---|---|
| `commands.json` | `1e30ac7f2ec3dd70a18adfb22ab36fb18d5521c1c7a8a414161802d44c164b9d` |
| `probe-result.json` | `3d79dc4ea2eeba17a216e1df8dae7670b07f40e62313bda59e6640cf569f49ee` |
| `smoke-result.json` | `702126346ca35231528455a241a89f4da94494b4a64a3bbfd729842690a9fdac` |
| `smoke-result.md` | `3c9c2a72dcdf56cf05bce113defc73d348ca541a05b58284d741930321700bd1` |

**`.keep` は置けなかった。** 私の書き込み先は `records/` と `tasks/` だけで、`C:\b\smoke\` は入っていない。`runs\` には今10個の置き場所があり、`--keep-runs` の既定 10 のままだと、この置き場所はあと10回の実行で消える。上の SHA-256 とこの記録を残した。

## 第3部: 気づいた軽微な点（合否に影響しない）

1. docs/04 の5節（103行）の最後の文に、「`configurationDefaults` で既定にできるかは未確認」が残っている。同じ行の前半と 6.1 の注は「できない」と書いており、食い違う（蒙恬の doc-corrections.md の7で指摘済み。直すのはリーダー）。
2. `tests/smoke/lib/run.mjs` で、`pruneRuns` の説明の注（`/** runs\ の下から… */`）が、足した `sameProc` と `KEEP_MARK` の上に離れて残った（曹参。動作には影響なし）。
3. probe の `lang.env.dotenv` は、`cfg.dotenvIds` が空なら FAIL ではなく SKIP になる。台帳の拡張が入ったことは `base.ext-install` が見るので抜けは無いが、台帳から .env の拡張が消えたときは SKIP で通る。
4. 蒙恬の handoff-notes.md の最初の「テストの入口」表の「mydist の許可」の行は、追記のとおりもう当てはまらない（`extensions.allowed` は product.json の `shukoConfigurationDefaults` に移る。照合の単体テストは B-2 の実装のときに要る）。

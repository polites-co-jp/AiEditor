# 変えた点と確かめた結果（台帳と mydist を 2026-11-13 の裁定に合わせる）

- 担当: 蒙恬（2026-11-13）
- 依頼: `brief.md` の「やること」1〜5

## 1. 台帳から `dotenv.dotenv-vscode` を外した（`extensions.lock.json`）

- `dotenv.dotenv-vscode` 1.5.8 の行を消した。台帳は8件になった（anthropic.claude-code、detachhead.basedpyright、ms-vscode.powershell、mads-hartmann.bash-ide-vscode、mechatroner.rainbow-csv、weixu.wx-vsce-dotenv、tomoki1207.pdf、MS-CEINTL.vscode-language-pack-ja）。
- `weixu.wx-vsce-dotenv` の `note` を、決まったことに書き換えた。
  - 前: 「.env の候補B。0-3 の後に … どちらを残すかを決める」
  - 後: 「.env の拡張。裁定『エラー表示を持つほうを1つ載せる』により 2026-11-13 にこちらに決めた（誤りを含む .env で診断4件。dotenv.dotenv-vscode 1.5.8 は0件で、台帳から外した）。docs/user-decisions.md の『.env の拡張を決めた』、tasks/2026-11-13-p1-smoke/handoff-notes.md の『合図後の実行の結果』6節」
  - `note` は `lock-fetch.mjs` が台帳から読み（`readBaseline`）、`lock-verify.mjs --write-lock` がそのまま書き戻す（`lockEntry` の `note: item.note`）。次の取り込みで台帳を書き直しても消えない。

### 台帳を読む台本が8件で困らないか

| 台本 | 読み方 | 8件での扱い |
|---|---|---|
| `scripts/lock-fetch.mjs` | 台帳の行を順に読む（`readBaseline`）。件数・ID の決め打ちは無い | 困らない。`node scripts/lock-fetch.mjs --only none.none --out tmp/p1-ledger-check` で、取得をせずに台帳を読ませ、読み込みが通ることを確かめた |
| `scripts/lock-verify.mjs` | `fetch-result.json` の項目を順に検証する。`--write-lock` は今の台帳と ID ごとに合わせる（`mergeLock`） | 困らない。ただし下の「注意」 |
| `scripts/lib/lock.mjs` | 1行ずつの形の検査（`validateLockEntry`）と合わせ方。件数は見ない | 困らない |
| `scripts/lock-diff.mjs`・`scripts/convert-sublime-keys.mjs` | 拡張ごとの置き場所を読む。台帳の件数は見ない | 困らない |
| `scripts/lib/p0-common.ps1` | 台帳を読まず、Phase 0 の9件を `$script:P0LedgerIds` に決め打ちしている | Phase 0 の環境の記録として残した（Phase 0 は打ち切り済み。今後は使わない）。直すならリーダーの指示で |
| `tests/smoke/lib/env.mjs`（曹参の担当） | 台帳から dotenv の片方を除く（既定は `weixu.wx-vsce-dotenv` を除く） | **困る**。既定のままだと .env の拡張が1つも入らない。`handoff-notes.md` の「曹参へ」に書いた |

注意: `lock-verify.mjs --write-lock` は、`--dir` の `fetch-result.json` に載っている拡張を台帳に書く。Phase 0 の置き場所 `C:\b\p0\vsix\fetch-result.json` には9件（`dotenv.dotenv-vscode` を含む）が残っている。`lock-fetch.mjs` を走らせ直さずに、この古い結果で `--write-lock` を走らせると、`dotenv.dotenv-vscode` が台帳に戻る。docs/04 の4節の4のとおり、`lock-fetch` と `lock-verify` を続けて走らせれば起きない（`lock-fetch` は今の台帳の8件だけを取る）。

### `lock-verify` の手順の注意: Phase 0 の古い取得の結果（リーダーの依頼の5。消さずに残す）

- `C:\b\p0\vsix\fetch-result.json` は Phase 0 の 0-6 のときの取得の結果で、9件（`dotenv.dotenv-vscode` 1.5.8 を含む）を持つ。消さずに残す。
- `lock-verify.mjs` の `--dir` の既定はこの置き場所（`C:/b/p0/vsix`）。`--write-lock` は `fetch-result.json` に載っている拡張を台帳に書く。
- そのため、`lock-fetch.mjs` を走らせ直さずに `node scripts/lock-verify.mjs --write-lock extensions.lock.json` を走らせると、`dotenv.dotenv-vscode` が検証を通った行として台帳に戻る。
- 手順: `lock-verify` の前に、必ず同じ `--out`／`--dir` で `lock-fetch` を走らせる。`lock-fetch` は今の台帳（8件）を基準にするので、`fetch-result.json` は8件で書き直される。docs/04 の4節の4の「続けて走らせる」と同じ。
- 新しい取り込みでは、別の置き場所（例: `--out C:/b/take-in/<日付>/vsix`）を使えば、古い結果を誤って読む恐れが無い。

## 2. `mydist` の `extensions.allowed` から `dotenv.dotenv-vscode` を外した

- `extensions-src/mydist/package.json` の `contributes.configurationDefaults["extensions.allowed"]` から外した。残りは `"*": false` と台帳の8件の ID。
- ただし `extensions.allowed` は application スコープで、拡張の `configurationDefaults` では既定にできないことが 1.146.0 のソースで分かった（`doc-corrections.md` の1）。そのため、後でリーダーの依頼により、`extensions.allowed` そのものを mydist から外した（6節）。

## 3. `mydist` の既定に、通信を止める4件を足した

| 設定 | 値 | 1.146.0 での登録元とスコープ（ソースで確かめた） |
|---|---|---|
| `typescript.disableAutomaticTypeAcquisition` | `true` | `extensions/typescript-language-features/package.json` 2408行。`scope: window`。非推奨の表示つき（下の注） |
| `npm.fetchOnlinePackageInfo` | `false` | `extensions/npm/package.json` 327行。`scope: window` |
| `json.schemaDownload.enable` | `false` | `extensions/json-language-features/package.json` 122行。scope の指定なし（拡張の設定の既定は window） |
| `workbench.settings.enableNaturalLanguageSearch` | `false` | `src/vs/workbench/contrib/preferences/common/preferencesContribution.ts` 117行。`ConfigurationScope.WINDOW` |

4件とも window スコープなので、拡張の `configurationDefaults` で既定にできる（`configurationExtensionPoint.ts` 217行の `allowedScopes` に入る）。

注（型定義の自動取得）: 1.146.0 では `typescript.disableAutomaticTypeAcquisition` に「非推奨。`js/ts.tsserver.automaticTypeAcquisition.enabled` を使う」と表示される。それでも既定を入れるのは古いほうにした。理由はソースのとおり。

- `extensions/typescript-language-features/src/configuration/configuration.ts` 229〜236行の `readDisableAutomaticTypeAcquisition` は、まず新しい設定を `readUnifiedConfig` で読み、値が無ければ古い設定を `configuration.get('typescript.disableAutomaticTypeAcquisition', false)` で読む。
- `src/utils/configuration.ts` 23〜57行の `readUnifiedConfig` は、新しい設定を、ユーザー・ワークスペース・フォルダ・言語別のどれかに値が書かれたときだけ使う（`hasModifiedValue`。既定値は見ない）。書かれていなければ古い設定を `get` で読み、`get` は既定値も返す。
- したがって、新しい設定に既定を入れても読まれない。古い設定に既定を入れれば効く。ユーザーが新しい設定を書けば、そちらが勝つ。

`extensions-src/mydist/README.md` にも同じ理由を書いた。

## 4. Claude Code の CLI に `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を渡す設定を入れた

`mydist` の既定に次を足した。

```json
"claudeCode.environmentVariables": [
  { "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }
]
```

### 設定の名前と形（Claude Code 2.1.322 の manifest。JS は読んでいない）

出典: `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json`（Open VSX の `files.manifest`、https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json と同じもの）の `contributes.configuration.properties` 36〜58行。

- 名前: `claudeCode.environmentVariables`
- 型: `array`。要素は `object` で、`name`（string）と `value`（string）が必須。
- `scope`: `machine`
- `default`: `[]`
- 説明: "Environment variables to set when launching Claude. Prefer setting environment variables in Claude's settings.json. See documentation: https://code.claude.com/docs/en/settings"
- 同じ manifest の 23件の設定のうち、名前と値を指定して環境変数を渡せるものはこれだけ。`claudeCode.claudeProcessWrapper` は起動する実行ファイルの指定、`claudeCode.usePythonEnvironment` は Python 拡張があるときにワークスペースの Python 環境を有効にする設定で、どちらも任意の環境変数は渡せない（説明の文から）。

### この環境変数が止めるもの（Claude Code の公式の文書。取得日 2026-11-13）

- https://code.claude.com/docs/en/env-vars の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` の行（原文の要約。引用は handoff-notes.md）:
  - 止める: 自動更新、テレメトリ、エラーの報告、`/feedback` コマンド、Claude が下書きするフィードバック、リリースノート、PR・MR の状態のバッジの確認、可用性の確認（fast mode の確認など）、プラグインの `command` の取得元の裏での実行、機能フラグの取得。
  - 機能フラグの取得を止めるので、Remote Control など機能フラグが要る機能は使えなくなる。
  - 値が `0` や `false` でも止まる（変数があれば効く）。
  - 止めないもの: 公式のプラグインのマーケットプレイスの自動登録（`CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` が別にある）、ゲートウェイのモデルの発見。
- https://code.claude.com/docs/en/data-usage の「Telemetry services」「Default behaviors by API provider」:
  - 使用状況の指標（`DISABLE_TELEMETRY`）とエラーの報告（`DISABLE_ERROR_REPORTING`）を、この変数1つでまとめて止められる。
  - セッションの品質の調査（"How is Claude doing?"）も止まる。
  - 止めないもの: WebFetch の宛先の安全確認（ホスト名を `api.anthropic.com` に送る。`skipWebFetchPreflight` で止める）、公式のマーケットプレイスの自動登録。
- https://code.claude.com/docs/en/vs-code の拡張の設定の表: `environmentVariables`、既定 `[]`、"Set environment variables for the Claude process. Use Claude Code settings instead for shared config."

### 入れられるか（1.146.0 のソースで確かめたこと）

`claudeCode.environmentVariables` は `machine` スコープで、`configurationDefaults` が受け付けるスコープ（machine-overridable・window・resource・language-overridable）に入らない。それでも、起動のときは既定が入る見込み。理由は次のとおり。

- スコープの検査は `src/vs/workbench/api/common/configurationExtensionPoint.ts` 216〜233行にあり、**その時点で登録済みの設定**（`configurationRegistry.getConfigurationProperties()`）にだけ働く。
- `configurationDefaults` の受け口は `configuration` の受け口より先に登録され（同じファイルの 188行と 244行。`ExtensionsRegistry` は Map で、登録の順に処理する。`abstractExtensionService.ts` 1167〜1175行）、起動のときはすべての拡張を1回で処理する（同 581行）。Claude Code の `claudeCode.*` は、mydist の既定を検査する時点ではまだ登録されていないので、検査を通る。
- 後から設定が登録されたときは、`configurationRegistry.ts` 1114〜1133行の `updatePropertyDefaultValue` が既定を当てる。ここにスコープの検査は無い（`disallowConfigurationDefault` だけを見る。Claude Code の manifest にこの印は無い）。
- 走らせての確かめはしていない（`C:\b\wt\1.146.0` でのビルドは止められている）。Phase 2 で、自作のビルドで確かめる必要がある（`handoff-notes.md` の「テストの入口」）。

## 5. 検証（1）の軽微な2点

### 5.1 `scripts/check-env.ps1`: パスが実在するときだけ Visual Studio の検査を通す

- 前: `preinstallCheckPasses = ($vsFolders.Count -gt 0)`。`vs2026_install` などが無いパスを指していても、その項目が数に入って「通る」になった。
- 後: 項目のうち、`exists` を持たない（フォルダを見つけた項目。見つけたときだけ足している）か、`exists` が真の項目だけを数える。本家の `build/npm/preinstall.ts` 83〜87行（`if (vsPath && fs.existsSync(vsPath))`）と同じ判定。
- `preinstallFolders` の出力の形は変えていない。

### 5.2 `scripts/prepare.mjs`: `upstream.json` に `commit` が無いときは止める

- 前: `expected` が空なら照合を飛ばし、`ok` で終わった。
- 後: `upstream.json` に `commit` が無く、`--commit` も無いときは、clone・fetch・worktree に進まず `result: "error"`、終了コード 1 で止める。メッセージは「upstream.json に commit が無く、--commit も無い。タグの commit を照合できない」。タグの照合の行も `expected &&` を外した。

## 6. リーダーの追加の依頼（2026-11-13、docs/04 の6.1 を直した da6c586 の後）

| 依頼 | したこと |
|---|---|
| 1. 6.1 の表にあって mydist に無い、window スコープ以下の設定を足す | `workbench.startupEditor: "none"` を足した（`ConfigurationScope.RESOURCE`。`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts` 298〜299行）。6.1 の表のほかの window 以下の設定は、すでに入っていた。application スコープの6件は足していない |
| 2. `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` を足す | `claudeCode.environmentVariables` の配列の2件目に足した |
| 3. `extensions.allowed` と `telemetry.telemetryLevel` を mydist から外す | 外した。README にも、書かない理由と調べの場所を書いた |
| 4. application スコープの6件の2つの案 | `app-scope-options.md` |
| 5. 古い `fetch-result.json` の注意 | 上の1節に「`lock-verify` の手順の注意」として書いた |

`workbench.startupEditor` について: この設定は `experiment: { mode: 'auto' }` を持ち、実験の結果で既定が上書きされうる（`src/vs/workbench/services/configuration/browser/configurationService.ts` 1438〜1524行）。ただし実験は product.json に `tasConfig` が無いと動かない（`app-scope-options.md` の1.2）ので、自作では mydist の既定が効く見込み。

今の mydist の `configurationDefaults`（10キー）:

- `chat.disableAIFeatures: true`
- `workbench.colorTheme: "Light Modern"`
- `breadcrumbs.enabled: false`
- `workbench.startupEditor: "none"`
- `basedpyright.importStrategy: "useBundled"`
- `typescript.disableAutomaticTypeAcquisition: true`
- `npm.fetchOnlinePackageInfo: false`
- `json.schemaDownload.enable: false`
- `workbench.settings.enableNaturalLanguageSearch: false`
- `claudeCode.environmentVariables`: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` と `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` の2件

## 確かめたこと

| 確かめたこと | 結果 |
|---|---|
| `node --check scripts/prepare.mjs` | 通った（出力なし） |
| 台帳が読めるか: `node scripts/lock-fetch.mjs --only none.none --out tmp/p1-ledger-check` | 取得をせずに台帳を読み、`tmp/p1-ledger-check/fetch-result.json` を書いて終わった（JSON として読めた） |
| 台帳の件数 | `"id"` の行が8件 |
| `prepare.mjs` の commit が無いとき | `upstream.json` から `commit` を一時的に外して `node scripts/prepare.mjs --build-root tmp/p1-ledger-check/br --out tmp/p1-ledger-check/prepare-nocommit.json --no-size` を走らせた。終了コード 1、`result: "error"`、上のメッセージ、`steps: []`（git の操作に進んでいない）。走らせた後に `upstream.json` を元に戻し、`git diff` に出ないことを確かめた |
| `check-env.ps1` が動くか | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -OutFile tmp/p1-ledger-check/env-check.json` が誤りなく最後まで走った（終了コード 2。Node・pnpm・setuptools・Visual Studio が足りないのは、ユーザーの道具の導入待ちで今の環境どおり）。この PC には Visual Studio のフォルダも `vs20xx_install` も無いので、直した判定の分かれ道（無いパスを指す変数）は走らせて確かめていない |
| mydist の `package.json` | 書き換えた部分を読み直し、JSON の形を目で確かめた。`node --check` は JSON を JS として読むので使えない（試して確かめた） |

走らせていないもの: `node --test tests/*.test.mjs`（`node tests/...` は私の許可に無い）。`tests/lock.test.mjs` は作った行（`row(...)`）で試していて、本物の台帳を読まないので、この変更では結果が変わらない見込み。

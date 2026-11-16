# 蒙恬の引き継ぎ: C-1 が消した product.json のキーの読み手を直す

- 依頼: `tasks/2026-11-16-p5-c1-product-keys/brief.md` の「やること（蒙恬）」1〜5
- 作成: 蒙恬（2026-11-16）。時刻は UTC（JST は +9 時間）
- 結果: **完了**。21単位の版 `1.146.0-p5-c-all-r2` は prepare から zip まで `result: ok`。起動の確かめで、ワークベンチが立ち上がり、CLI の `--install-extension` が7つとも通った（`result: ok`）

## 0. 要点

1. `productRemove` の6つのキーの読み手を、21単位を当てた木（`tmp\b\wt\1.146.0`）で探した。`src/`・`build/`・`extensions/`・`cli/` の全部が対象で、`node_modules` は除いた。落ちる読み手は、大岡越前守の表と同じ8つのファイルにあり、ほかには無かった。
2. 直しは `removals/C-1-ai/edits.patch` に足した。8ファイル、12ハンク。キーが無ければ、空の配列・空の設定・何もしない、として扱う。
3. 型も直した。`IProductConfiguration`（`src/vs/base/common/product.ts`）の `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` を、省略できる型にした。`?.` なしの読み手が残れば、型検査で止まる。今回の誤りは、型が省略できない形だったので型検査を通っていた。
4. `scripts/p1-launch-check.ps1` が、ワークベンチが立ち上がったかを見るようにした。見るのは、ログの3つのしるしと、開発者ツールのコンソールの `Uncaught`。`-InstallExtension` を渡せば、CLI の導入も確かめる。ログだけを判定する `-LogsFolder` も足した。
5. 21単位の版 `1.146.0-p5-c-all-r2` を新しい作業ツリー（`tmp\b\wt-r2\1.146.0`）で作り直した。21単位すべて `applied: ok`、型検査は誤り 0、zip までできた。起動すると、ワークベンチのしるしが3つとも出て、コンソールの `Uncaught` は 0 だった。CLI の導入は7つの VSIX がすべて `successfully installed`。

## 成果物

| 種類 | パス |
|---|---|
| 直した | `removals/C-1-ai/edits.patch`、`removals/C-1-ai/README.md`、`scripts/p1-launch-check.ps1` |
| 記録（このフォルダ） | `1.146.0-p5-c-all-r2/build-record.json`・`checks.json`・`lockfile.diff`、`launch-check-p5-c-all-r2.json`、`logs-judge-p5-c-all.json`・`logs-judge-p2-all.json`・`logs-judge-p2-B-6-r2-webview.json` |
| 版 | `tmp\b\dist\1.146.0-p5-c-all-r2.zip`、展開先 `tmp\b\p2\1.146.0-p5-c-all-r2\`、作業ツリー `tmp\b\wt-r2\1.146.0`、gulp の出力 `tmp\b\wt-r2\VSCode-win32-x64`、枝 `builds/1.146.0-p5-c-all-r2`（`tmp\b\vscode`） |

## 1. 読み手を探した結果（brief の1）

探した場所: `tmp\b\wt\1.146.0`（21単位を当てた木。読むだけ）。Grep でキーの名前そのものを探したので、`product.<key>`・`productService.<key>`・`this._productService.<key>`・分割代入・`['<key>']` のどれも拾える。C-2〜C-7 が消すファイルは、この木にはもう無い。

| キー | 落ちる読み手（直した） | 落ちない読み手（直さない。理由） |
|---|---|---|
| `defaultChatAgent` | `services/accounts/browser/defaultAccount.ts` 158・1668行（`toDefaultAccountConfig(productService.defaultChatAgent)`。中の98〜116行が `.chatExtensionId` などを読む）、`platform/extensionManagement/common/extensionGalleryService.ts` 1234・2058・2061行、`platform/extensionManagement/common/abstractExtensionManagementService.ts` 1001行、`workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` 3000行 | `configurationRegistry.ts` 1260（三項）、`chatEntitlementService.ts`（`?.`・`if (!…)`）、`extensionsActions.ts` 9か所（`?.`）、`extensionEnablementService.ts`・`inlineCompletionsUnification.ts`（`?.`）、`inlineCompletionsModel.ts`・`completionsEnablement.ts`・`scmInput.ts`・`githubService.ts` 2つ（`?.`）。`platform/product/common/product.ts` 90行は Web の開発用の既定値（書くだけ） |
| `builtInExtensionsEnabledWithAutoUpdates` | `extensionsScannerService.ts` 113行（`for…of`。CLI の `--install-extension` の「not iterable」）、`node/extensionManagementService.ts` 947行・`extensionManagementCLI.ts` 389行（`.some`） | `extensionsWorkbenchService.ts` 403・2779行、`userDataSync/common/extensionsSync.ts` 387行（`?.`） |
| `trustedExtensionAuthAccess` | なし | `authenticationAccessService.ts`・`authenticationUsageService.ts`（`Array.isArray`・`typeof`・`?.`。型も省略できる） |
| `sessionsWindowAllowedExtensions` | なし | `extensionManifestPropertiesService.ts` 237行（`new ExtensionIdentifierSet(undefined)` は空の集まり。コンストラクタが `if (iterable)` で見る） |
| `voiceWsUrl` | なし | `server/node/webClientServer.ts` 398行（値を渡すだけ。サーバーの側） |
| `agentsTelemetryAppName` | なし | `localProcessExtensionHost.ts` 533行（`\|\|` の左） |

- テストのファイル（`extensionsScannerService.test.ts`・`extensionEnablementService.test.ts` 1299行の `!`・`extensionsActions.test.ts` などの値を置く所）は、値を自分で置くか `!` で読むので直さない。
- `build/vite/workbench-vite.html`・`build/rspack/workbench-rspack.html` に `trustedExtensionAuthAccess` などの値が書いてある。開発用の HTML で、ビルド（`gulp vscode-win32-x64-min`）には使わない。
- `build/`・`extensions/`・`cli/`（Rust）に、6つのキーの読み手は無い。

## 2. edits.patch の直し（brief の2）

足したのは8ファイル、12ハンク（`removals/C-1-ai/edits.patch`）。どのファイルも、21単位のほかの単位（A-1〜C-7 の edits.patch・removeLines・delete、`patches/`）は触れない。そのため、本家のタグの中身にそのまま当たる。ハンクの見出しの行数は、本家 1.146.0 の行で数えた。パッチの先頭の説明文（コミットの本文）に1文を足し、変更の一覧（diffstat）を 116 files changed、885 insertions、5427 deletions に直した。`removals/C-1-ai/README.md` に「product.json から外したキーの読み手（2026-11-16、7回目）」の節を足した。

| ファイル | 直し |
|---|---|
| `src/vs/base/common/product.ts` | `builtInExtensionsEnabledWithAutoUpdates?:`・`defaultChatAgent?:`（省略できる型に） |
| `.../extensionManagement/common/extensionsScannerService.ts` | `for (const id of productService.builtInExtensionsEnabledWithAutoUpdates ?? [])` |
| `.../extensionManagement/node/extensionManagementService.ts` | `…builtInExtensionsEnabledWithAutoUpdates?.some(…)`（無ければ「古い組み込みの拡張」は無い） |
| `.../extensionManagement/common/extensionManagementCLI.ts` | `…builtInExtensionsEnabledWithAutoUpdates?.some(…)`（無ければ、更新を断る対象は無い） |
| `.../extensionManagement/common/extensionGalleryService.ts` | 1234行: `this.productService.defaultChatAgent && areSameExtensions(…)`。2058行の前: キーが無ければ `deprecated` に足さずに返す（`if (!this.productService.defaultChatAgent) { return {…}; }`。2058〜2066行は変えない） |
| `.../extensionManagement/common/abstractExtensionManagementService.ts` | `this.productService.defaultChatAgent && areSameExtensions(…)` |
| `.../contrib/extensions/browser/extensionsWorkbenchService.ts` | `!this.productService.defaultChatAgent \|\| !areSameExtensions(…)`（無ければ、パックの拡張もいっしょに外す。ふつうの拡張と同じ） |
| `.../services/accounts/browser/defaultAccount.ts` | `toDefaultAccountConfig` が `undefined` を受け、空の設定（ID・URL・設定の名前は空の文字列、`preferredExtensions`・`scopes` は空の配列）を返す。`DefaultAccountService` は、キーが無ければ待ち（`initBarrier`）を最初に開く。`DefaultAccountProviderContribution` は、キーが無ければ提供者を作らない |

### defaultAccount.ts の形を選んだ理由

- 提供者（`DefaultAccountProvider`）を作ると、空の URL で権利・MCP の登録・管理された設定を取りに行く道が残る。サインインでは `scopes[0]` が `undefined` になり、`[...undefined]` で落ちる。作らないのが「何もしない」に合う。
- 提供者を作らないと、`DefaultAccountService` の `initBarrier` が開かない（開くのは `setDefaultAccountProvider` の中だけ）。`getDefaultAccount()`・`refresh()`・`signIn()`・`signOut()` が待ち続ける（GitHub のサービス・ポリシーなどが呼ぶ）。そこで、キーが無ければ構築の時に開く。開いた後は `this.defaultAccountProvider?.…` が `undefined` になり、アカウントは `null` と答える。エディタ単体の `StandaloneDefaultAccountService`（`editor/standalone/browser/standaloneServices.ts`）と同じふるまい。
- `getDefaultAccountAuthenticationProvider()` は `{ id: '', name: '', enterprise: false }` を返す。呼ぶ側（拡張の有効・無効、GitHub のサービス、ポリシー）は ID の一致を見るだけなので、空の ID はどの認証の提供者とも一致しない。

### 曹参の静的な検査（c1-unit）との関係

曹参の handoff-notes の1節にある判定（「edits.patch がその行を消している」か、同じ行の前に条件がある）では、次の4行が「直っていない」に見えるはず。行そのものは変えず、前の行の早い `return` か、受け側の関数で直したため。

| 行 | 直し方 |
|---|---|
| `defaultAccount.ts` 158 `this.defaultAccountConfig = toDefaultAccountConfig(productService.defaultChatAgent);` | 関数が `IDefaultChatAgent \| undefined` を受け、無ければ空の設定を返す |
| `defaultAccount.ts` 1668 `const defaultAccountProvider = … toDefaultAccountConfig(productService.defaultChatAgent) …` | 直前に `if (!productService.defaultChatAgent) { return; }`。さらに受け側の関数も上と同じ |
| `extensionGalleryService.ts` 2058・2061 | 直前に `if (!this.productService.defaultChatAgent) { return { … }; }` |

型を省略できる形にしたので、この4行が本当に危なければ型検査が止める（`strictNullChecks` は本家で有効）。静的な検査を「キーが省略できる型になっていること」と「型検査が通ること」に寄せるか、上の4つの形を安全と数えるかは、曹参とリーダーの判断に任せる。

### index の行

足した8つの区画には `index <旧>..<新>` の行を書いていない。`git hash-object` などの許可が無く、本家の blob の SHA-1 を出せないため。`git am -3` は、当たらないときの3方向の当て方に、この行の旧い blob を使う。今回はそのまま当たったので要らない。ただ、本家が同じ所を変えた週の取り込みでは、この8区画だけ3方向の当て方ができず、衝突ではなく「当たらない」で止まる。`C:/b/wt/*` か取り込みの直しの作業ツリーで `git format-patch` し直すと、行が入る。

## 3. p1-launch-check.ps1（brief の3）

プロセスが生きているかだけで ok にしない。起動の後、次の3つを見る。

1. **ワークベンチのしるし**（ログ）: 止めた後に、この起動のログのフォルダ（`<portable>\user-data\logs\<時刻>`。起動の後にできたもののうち、`window1\` があるいちばん新しいもの）を読む。
   - `window1\renderer.log` に `Started local extension host with pid <n>.`（`localProcessExtensionHost.ts` 453行。ワークベンチが拡張ホストを起こした）
   - `window1\exthost\exthost.log` に `Extension host with pid <n> started`（`extensionHostMain.ts` 197行）と `Eager extensions activated`（`extHostExtensionService.ts` 817行）
   - 3つとも要る。`1.146.0-p2-all` の起動の確かめのログ（`C:\b\p2\1.146.0-p2-all\portable\user-data\logs\20261115T004717\`）では、起動から2〜3秒で3つとも出ていた。
2. **コンソールの誤り**: 起動に `--enable-logging=file --log-file="<Dest>\chromium-<時刻>.log"` を足す（スモークと同じ Chromium の引数。データの置き場所は変わらない）。`:CONSOLE` の行のうち、本文が `"Uncaught` で始まり、`source:` が `vscode-file://`（ワークベンチそのもの）のものが1つでもあれば ok にしない。`vscode-webview://`（Webview の中）の `Uncaught` は数えて載せるだけで、落とさない。通った版のスモークにも、PDF の Webview の `Uncaught TypeError: … 'classList'` がある（`C:\b\smoke\runs\p2-B-6-r2-20261114T152608\chromium.log` 32行）。
3. **CLI の導入**（`-InstallExtension` を渡したときだけ）: 起動の前に、同じ環境（`VSCODE_PORTABLE`）で `<cli> --install-extension <vsix>` を VSIX ごとに走らせる。終了コード 0 で、`Error while installing`・`Failed Installing`・`is not iterable` の行が無いこと。値はカンマ区切り（`powershell -File` は `a,b` を1つの文字列で渡すため）。フォルダを渡すと、その下の `*.vsix` を全部入れる。

ok の条件は「生きている・ワークベンチのしるしが3つ・ワークベンチの `Uncaught` が0・導入が全部通った・普段使いのデータのフォルダが変わらない」。結果の JSON に `workbench`（`logsFolder`・`rendererLog`・`exthostLog`・`chromiumLog`・`markers`・`missing`・`consoleUncaught`・`ready`）と `installs`（VSIX ごとの `vsix`・`exitCode`・`ok`・`errors`・`output`）を足した。ワークベンチが立ち上がらないときの message は `the window stayed alive but the workbench did not come up (missing: …; uncaught workbench console errors: <n>)`。

**ログだけを判定する入口** `-LogsFolder <logs\<時刻> のフォルダ> [-ChromiumLog <ファイル>]`: 何も起動しない。上の1と2だけを判定し、JSON（`checkedAt`・`logsFolder`・`workbench`・`result`・`message`）を出す。終了コードは 0（立ち上がった）/ 1（立ち上がっていない）/ 2（引数の誤り）。スモークの実行のフォルダの判定し直しと、テストのための入口。`-Zip`・`-Root`・`-LogsFolder` のうち、ちょうど1つを渡す（2つ以上か0なら `give exactly one of -Zip, -Root and -LogsFolder` で 2）。`-LogsFolder` に `-InstallExtension` を添えると 2。

今あるログで試した（`-LogsFolder`。書いたのはこのフォルダの JSON だけ）:

| ログ | 結果 | 記録 |
|---|---|---|
| 21単位の版の壊れた起動（`tmp\b\smoke\runs\p5-c-82f-261116T024952\logs` と `chromium.log`） | 終了コード 1。`missing` は3つとも、ワークベンチの `Uncaught` は1（`chatExtensionId` の TypeError）。renderer.log は 0 バイト、exthost.log は無い | `logs-judge-p5-c-all.json` |
| 14単位の版のスモーク（`C:\b\smoke\runs\p2-all-1-20261114T155300\logs` と `chromium.log`。読むだけ） | 終了コード 0。3つのしるしがあり、`Uncaught` は0 | `logs-judge-p2-all.json` |
| PDF の Webview の誤りがある実行（`C:\b\smoke\runs\p2-B-6-r2-20261114T152608`） | 終了コード 0。`others` に Webview の `Uncaught` が1つ載り、落とさない | `logs-judge-p2-B-6-r2-webview.json` |
| 引数なし | 終了コード 2、`give exactly one of -Zip, -Root and -LogsFolder` | — |

## 4. ビルドと起動（brief の2・4）

### 作業ツリーをタグに戻す手順について

台本でタグに戻す手順は `build.mjs --fresh` だけ。`git worktree remove --force` で作業ツリーごと消してから、prepare が作り直す。消す先は `tmp\b\wt\1.146.0` で、削除の許可（`delete_paths` は `C:/b/p2/` など C: の下だけ）の外にあたる。そのため使わず、`--worktree` で別の場所に新しい作業ツリーを作った（6節）。apply.mjs には、当てた後の木をタグに戻す手順が無い（prepare は「HEAD がタグと違う」「変更がある」で止める）。

古い `tmp\b\wt\1.146.0`（`1.146.0-p5-c-all` の木）と、その gulp の出力 `tmp\b\wt\VSCode-win32-x64` は残っている。片づけるかどうかは、リーダーが決める（削除の許可が要る）。

### ビルド

```
node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r2 --worktree tmp/b/wt-r2/1.146.0 --take-in-dir tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2 --record tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/build-record.json
```

- 先に `--dry-run` で、21単位が `unitsEnabled` に入り、どの場所も `tmp\b` の下になることを確かめた。
- 記録: `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/build-record.json`、`checks.json`、`lockfile.diff`。ログ: `tmp\b\logs\1.146.0-p5-c-all-r2\`。

| 手順 | 結果 |
|---|---|
| prepare | ok（75 秒）。`tmp\b\vscode` から `tmp\b\wt-r2\1.146.0` に作業ツリーを足した |
| apply | ok（88 秒）。21単位すべて `applied: ok`。C-1 の edits は `applied: ok`、`conflicts: []`。`result: ok`、`errors: []`。警告は C-2 の想定の1件だけ（`debugChatIntegration.ts が本家に無い`。C-1 が先に消すため）。`commitIdentity` は ok。HEAD は `1efdfdf8230e97c9bd2d0076b8653e1a7d5cb1b2` |
| install | ok（1035 秒）。終了コード 0 |
| lockfile | ok |
| typecheck | ok（8.4 秒）。終了コード 0。ログは `$ tsc --project ./src/tsconfig.json --noEmit --skipLibCheck` の1行だけ。`IProductConfiguration` の2つを省略できる型にしても誤りが出ないので、`?.` なしの読み手は `src/` に残っていない |
| package | ok（309 秒）。gulp の出力は `tmp\b\wt-r2\VSCode-win32-x64` |
| postprocess | ok |
| zip | ok。`tmp\b\dist\1.146.0-p5-c-all-r2.zip`、219,115,745 B、SHA-256 `f41c4c77a8b6f04789fc288156a8665fcc98c7b852c9458d408f6916ee32a12e`、中の最上位は `Shuko-win32-x64-1.146.0-p5-c-all-r2` |

- `sourceVersion` は `1efdfdf8…cb1b2`（checks.json の `headCommit` と一致）。枝 `builds/1.146.0-p5-c-all-r2` を付けた（`action: created`）。記録の `warnings: []`。
- 出力の `resources\app\product.json` に、`productRemove` の6つのキーは無い（Grep で 0 件）。裁定「AI のキーは消す」のまま。

### 起動と CLI の導入

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip tmp/b/dist/1.146.0-p5-c-all-r2.zip -Dest tmp/b/p2/1.146.0-p5-c-all-r2 -InstallExtension tmp/b/cache/vsix/detachhead.basedpyright-1.40.2,tmp/b/cache/vsix/ms-vscode.powershell-2025.4.0,tmp/b/cache/vsix/mads-hartmann.bash-ide-vscode-1.43.2,tmp/b/cache/vsix/mechatroner.rainbow-csv-3.24.1,tmp/b/cache/vsix/weixu.wx-vsce-dotenv-0.2.3,tmp/b/cache/vsix/tomoki1207.pdf-1.2.2,tmp/b/cache/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0 -OutFile tasks/2026-11-16-p5-c1-product-keys/launch-check-p5-c-all-r2.json
```

結果（`launch-check-p5-c-all-r2.json`）: 終了コード 0、`result: ok`、message `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。

| 項目 | 結果 |
|---|---|
| 展開 | 34 秒。`tmp\b\p2\1.146.0-p5-c-all-r2\Shuko-win32-x64-1.146.0-p5-c-all-r2\` |
| `--version` | `1.146.0` / `1efdfdf8230e97c9bd2d0076b8653e1a7d5cb1b2` / `x64` |
| CLI の導入（7つ） | basedpyright・PowerShell・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パックが、どれも終了コード 0 で `Extension '<vsix>' was successfully installed.`。前の版で全部が落ちた `… is not iterable` は出ない |
| 起動 | 10秒後も生きていた。止めたのは Shuko.exe ×7 |
| ワークベンチ | ログのフォルダは `portable\user-data\logs\20261116T125224`。renderer.log に `Started local extension host with pid 91264.`、exthost.log に `Extension host with pid 91264 started`・`Eager extensions activated`（起動から約3秒）。`vscode.git`・`vscode.merge-conflict`・`shuko.notion-sync` が起動した。コンソールの `Uncaught` は 0。chromium のログは INFO の4行だけ |
| 普段使いのデータ | 6つのフォルダは変わらない |

- Claude Code（`anthropic.claude-code-2.1.322`）は、起動の確かめでは入れなかった。起動すると拡張が動き、ホームの Claude の設定に触れうるため。CLI の導入の道は、ほかの7つで確かめた（前の版では、8つとも同じ誤りで落ちていた）。Claude Code を入れて動かすのは、関門のスモーク（大岡越前守）に任せる。
- renderer.log に `[DefaultAccount] …` の行は無い。既定のアカウントの提供者が作られていないことと合う。

## 5. テストの入口（曹参へ）

### p1-launch-check.ps1 の新しい確かめ

偽のエディタを作らなくても、`-LogsFolder` で判定の全部を試せる。偽のログのフォルダを一時の場所に作って渡す。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -LogsFolder <dir> [-ChromiumLog <file>] [-OutFile <json>]
```

| 置くもの | 期待 |
|---|---|
| `<dir>\window1\renderer.log` に `... [info] Started local extension host with pid 123.`、`<dir>\window1\exthost\exthost.log` に `... Extension host with pid 123 started` と `... Eager extensions activated`。Chromium のログは渡さない | 終了コード 0、`result: "ok"`、`workbench.ready: true`、`workbench.missing: []`、`workbench.chromiumLog.exists: false` |
| 上の3つのうち1つを欠く（例: `Eager extensions activated` が無い） | 終了コード 1、`result: "error"`、`workbench.missing` にその名前（`rendererStartedExtHost` / `extHostStarted` / `eagerExtensionsActivated`）、message に `the workbench did not come up` |
| `renderer.log` が空で `exthost` のフォルダが無い（今回の壊れた起動の形） | 終了コード 1、`missing` が3つ、`rendererLog.bytes: 0`、`exthostLog.exists: false` |
| しるしは3つあり、`-ChromiumLog` の中に `[1:1116/115143.357:INFO:CONSOLE:1847] "Uncaught (in promise) TypeError: x", source: vscode-file://vscode-app/c:/a/workbench.desktop.main.js (1847)` | 終了コード 1、`consoleUncaught.workbenchCount: 1`、`workbench` にその行 |
| 同じく、`source: vscode-webview://abc/index.html?id=1` の `Uncaught` だけ | 終了コード 0、`othersCount: 1`、`workbenchCount: 0` |
| `INFO:CONSOLE(1847)`（古い形）の `"Uncaught` で `source: vscode-file://` | 1（古い形も拾う） |
| `"%c  ERR ..."` の行（`Uncaught` でないコンソールの誤り）だけ | 0（落とさない。通った版にもある） |
| `-LogsFolder` が無いフォルダ / `-ChromiumLog` が無いファイル / `-LogsFolder` と `-Zip` の両方 / `-LogsFolder` と `-InstallExtension` | 2 |
| 400文字を超える `Uncaught` の行 | `workbench`・`others` の中で、400文字＋`...` に切られる |

`-Zip`・`-Root` の起動の道（`installs`・`workbench` の欄、ok の条件）は、本物のエディタを起動しないと試せない。静的な検査（`tests/p1-launch-workbench.test.mjs`）との関係:

- 「ok を入れる所が1つ」の検査: 起動の道の `$result.result = 'ok'` は1か所のまま。`-LogsFolder` の道は `$verdict = $(if ($wbOnly.ready) { 'ok' } else { 'error' })` と書いたので、その検査の正規表現（`\$result\.result\s*=\s*'ok'`）には当たらない。`-LogsFolder` の道も ok をワークベンチの準備だけで決める。検査の意図（生きているだけの ok の道が無い）には反しないと考えるが、数え方を変えるかは曹参に任せる。
- ok の条件の行は `if ($alive -and $workbenchReady -and $installsOk -and $changed.Count -eq 0) {`。

### edits.patch（c1-unit・c1-round2 など）

- 2節の「曹参の静的な検査との関係」の4行を参照。
- 型の直しを見る検査の入口: `removals/C-1-ai/edits.patch` の `src/vs/base/common/product.ts` の区画に、`+	readonly builtInExtensionsEnabledWithAutoUpdates?: readonly string[];` と `+	readonly defaultChatAgent?: IDefaultChatAgent;` がある。`productRemove` のキーのうち、本家の `IProductConfiguration` で `?` の無いものはこの2つだけ（ほかの4つは本家でも `?:`）。
- 実際の当たり方: `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/checks.json` の C-1-ai の `edits.applied: "ok"`、`conflicts: []`。

### c2〜c5-check-json の21単位の組

21単位の本物の記録は `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/checks.json`（型検査の記録は同じフォルダの `build-record.json` の `steps[name=typecheck]`）。

## 6. 守ったこと

- `C:\b` は読むだけ。読んだのは、14単位の版のスモークのログ（`C:\b\smoke\runs\p2-*`）と起動の確かめのログ（`C:\b\p2\1.146.0-p2-all\portable\user-data\logs\`）。`--build-root` に `C:\b` は渡していない（buildRoot は既定の `tmp\b`。`local.json` は無い）。
- 何も消していない。21単位を当てた古い作業ツリー `tmp\b\wt\1.146.0` を当て直すには `--fresh`（`git worktree remove --force`）が要るが、`tmp\b\wt` は削除の許可（`delete_paths`）の外なので使わなかった。代わりに `--worktree tmp\b\wt-r2\1.146.0` で、新しい作業ツリーをタグから作った。gulp の出力も `tmp\b\wt-r2\VSCode-win32-x64` に新しくでき、前の版の出力（`tmp\b\wt\VSCode-win32-x64`）は上書きしていない。
- 作業ツリーへ直接 git を打っていない。edits.patch の本文を直し、当て直しは `build.mjs`（prepare・apply）に任せた。
- 書いたもの: `removals/C-1-ai/edits.patch`・`removals/C-1-ai/README.md`・`scripts/p1-launch-check.ps1`、このフォルダ、`tmp\b` の下（`build.mjs` と `p1-launch-check.ps1` が書く所）、`tmp\p1-wb-trial\`（`-LogsFolder` を試した偽のログ。消していない）。
- 普段使いのエディタのデータと、秘密の場所には触れていない。`unit.json` の `"enabled"` は前の版のまま（C-1〜C-7 が `true`。コミットしていない）。

## 7. docs/ との食い違い・未解決の点

### 自分で流した静的なテスト（合否は出さない。曹参と大岡越前守が見る）

| コマンド | 結果 |
|---|---|
| `node --test tests/p1-launch-workbench.test.mjs` | 8 pass / 0 fail（曹参が先に書いた「実装を要する」6件も通った） |
| `node --test tests/p1-scripts.test.mjs tests/apply-commits.test.mjs tests/c1-round2.test.mjs` | 終了コード 0（バックグラウンドに回ったので、件数は読めていない） |
| `node --test tests/c1-unit.test.mjs` | 48 pass / **2 fail**。下の「未解決の1」 |

### docs/ との食い違い

1. **docs/03 の `productRemove` の説明**（2節の表の71行「product.json から消すキー」）には、「残るコードの読み手を直す」ことが書かれていない。今回のように、本家の型で省略できないキーを外すと、型検査を通ったまま起動で落ちる。資料に足すかは、リーダーが決める。足すなら、「`productRemove` で外すキーは、残る読み手を edits.patch で直し、本家の `IProductConfiguration` で省略できない型なら省略できる型にして、型検査で見張る」の1文。

### 未解決の点

1. **曹参の c1-unit の新しい検査の2件が落ちる。** 中身は次の2つ。
   - 「直されていない読み手が 4 か所」: `extensionGalleryService.ts` 2058・2061、`defaultAccount.ts` 158・1668。2節の「曹参の静的な検査との関係」の4行。前の行の早い `return`、または `undefined` を受ける関数で直したので、行そのものは変えていない。型検査が通っている（省略できる型にしてある）ので、実際には落ちない。
   - 「edits.patch が足した行に、落ちる形の読みがある」: `extensionsWorkbenchService.ts` の `!this.productService.defaultChatAgent || !areSameExtensions(…, { id: this.productService.defaultChatAgent.extensionId })`。`||` の左の `!x` で守っているが、検査は `&&` の形しか安全と数えていない。
   - 直し方は2つある。検査が「前の行の早い `return`」「`!x ||`」「`undefined` を受ける関数」を安全と数えるか、型の直し（2つのキーが省略できる型になっていること）と型検査が通ることで見るか。もう1つは、私がコードをこの検査に合わせて書き直すか（`defaultAccount.ts` の158・1668行は、関数に渡す形のままでは、検査に合わせられない）。リーダーの判断を仰ぎたい。
2. **足した区画に `index` の行が無い**（2節の「index の行」）。本家が同じ所を変えた週の取り込みで、3方向の当て方ができない。`C:/b/wt/*`（許可がある場所）で format-patch し直せば入るが、今回は `tmp\b` の作業ツリーしか無く、そこへの git の許可が無い。
3. **古い作業ツリーの片づけ**: `tmp\b\wt\1.146.0`（`1.146.0-p5-c-all` の木）と `tmp\b\wt\VSCode-win32-x64` が残っている。今回の作業ツリー `tmp\b\wt-r2\1.146.0` と出力 `tmp\b\wt-r2\VSCode-win32-x64` も残した（関門で使う）。`tmp\b` の下を消す許可は無い。
4. **ほかの単位の `productRemove`**（範囲の外。気づいたことだけ）: C-3 が外す `serverApplicationName` も、本家の型では省略できない。読み手は `server/node/remoteExtensionHostAgentCli.ts` 189行だけで、サーバーの側なのでデスクトップの起動には関係しない。今回の起動では何も起きなかった。
5. `-InstallExtension` の値の区切りはカンマ。カンマを含むパスは渡せない。

---

# r3（2026-11-16、r2 の関門の後の追加の依頼）

- 依頼: brief.md の「追加の依頼（2026-11-16、r2 の関門の後）」の蒙恬の1〜5。誤りの記録は `records/take-in/1.146.0-p5-c-all-r2/gate-C-1-ai.md`、判断は `docs/user-decisions.md` の「段階 C の版 r2 の関門で出た点」
- 結果: **完了**（関門に使う版は `1.146.0-p5-c-all-r3c`。依頼のラベル `r3` で作ったあと、さらに2か所見つけて2回作り直したため）。ただし曹参の c1-unit が終了コード 1 のままで、中身を読めていない（R3-5 の未解決の1）

## R3-0. 要点

1. 関門の3種を直した。`ITerminalChatService` は何もしない `NullTerminalChatService` を登録した。`searchView.ts` の3か所は `?.` で読み、型の `searchView` を省略できる形にした。`_chat.editSessions.accept` は何もしないコマンドとして残した（B-1 の `_aiEdits.*` の隣）。
2. 同じ種類の残りを探し、3つ足して直した。統合ブラウザが注入する `IAgentNetworkFilterService` は、本家の実装をワークベンチに登録した。`viewHiddenChatTerminals` は何もしないコマンドとして残した。アカウントのメニューの「Manage Trusted MCP Servers」（`_manageTrustedMCPServersForAccount`）は項目ごと消した。
3. 直さないと決めたもの（通らない道、または `try/catch`・条件で守られている）は R3-2 の表に理由つきで並べた。設定と文脈キーで落ちる形は、`search.searchView` のほかに無かった。
4. 21単位の版 `1.146.0-p5-c-all-r3c` は prepare から zip まで ok、型検査は誤り 0。起動の確かめは ok（ワークベンチのしるし3つ、`Uncaught` 0、CLI の導入7つとも ok）。
5. 3種の誤りの道（ターミナル・検索の欄・git のステージ）は起動の確かめでは通らない。関門のスモークで見てほしい。

## R3-1. 直したもの（brief の1〜3）

`removals/C-1-ai/edits.patch` に5ファイルの区画を足し、2ファイル（`searchView.ts`・`globalCompositeBar.ts`）の区画にハンクを足した。下の表の3つのほかは、R3-2 で見つけた分（`browserView.contribution.ts`、`manageAccountsAction.ts`・`globalCompositeBar.ts`、`terminal.contribution.ts` の何もしないコマンド）。変更の一覧は 121 files changed、946 insertions、5457 deletions になった（r3 の時点は 120 files、939 insertions、5432 deletions）。パッチの先頭の説明文に1文を足し、`removals/C-1-ai/README.md` に「消した部品の受け手（2026-11-16、8回目。r3）」の節を足した。

| 誤り | 直し | ファイル |
|---|---|---|
| `depends on UNKNOWN service terminalChatService`（ターミナルのタブのビューが作れない） | 何もしない `NullTerminalChatService` を登録する（`NullChatEntitlementService` と同じ形）。注入を外す案より小さい（外すと `terminalTabbedView.ts` の3か所と `terminalTabsChatEntry.ts` の全体に手が入る）。ID のある `terminal.ts` ではなく、ターミナルのサービスを登録している `terminal.contribution.ts` にクラスと登録を置いた。インターフェースの25のメンバーを、どれも「何も無い」「何もしない」で実装した | `contrib/terminal/browser/terminal.contribution.ts`（import を3行足し、import の1行に `ITerminalChatService`・`ITerminalInstance` を足し、クラス36行と登録1行。r3b で、何もしないコマンド `workbench.action.terminal.chat.viewHiddenChatTerminals` の3行も足した） |
| `Cannot read properties of undefined (reading 'semanticSearchBehavior')` | `searchView.ts` の3か所（本家の701・2008・2014行）を `.searchView?.` で読む。型 `ISearchConfigurationProperties` の `searchView` を省略できる型（`searchView?:`）にした。ほかに `.searchView.` でたどる所が残れば、型検査で止まる | `contrib/search/browser/searchView.ts`（C-1 の区画にハンクを2つ足した。C-4 も同じファイルを直すが、離れた所なので当たり方は変わらない）、`services/search/common/search.ts` |
| `command '_chat.editSessions.accept' not found`（git のステージ・コミットのたび） | 何もしないコマンドとして登録する。B-1 の `_aiEdits.*` と同じファイルの末尾に置いた（同じく git の拡張が呼ぶコマンドの置き場所。`CommandsRegistry` の import は既にある） | `contrib/editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.ts` |

## R3-2. 同じ種類の残りを探した結果（brief の4）

探した木:
- 残るコード: r2 の21単位の木 `tmp\b\wt-r2\1.146.0`（`src/vs` と `extensions/`）。読むだけ。テスト（`**/test/**`）と、ビルドに入らないテスト用の拡張（`vscode-api-tests` など。postprocess が外す）は除いた。
- 消した部品: C-1 を当てる前の木 `C:\b\wt\1.146.0`（14単位の版の木。C-1 が消すフォルダはまだある）。読むだけ。本家のタグの木は `git -C` の許可が無く読めないので、これを代わりにした。C-1 が消すフォルダには、A・B の単位は手を入れていない。

### サービス（注入）

C-1 が消すファイルの `registerSingleton(I…` と `register{MainProcess,SharedProcess}RemoteService(I…` の ID を全部拾った（`contrib/chat`・`inlineChat`・`mcp`・`agentsVoice`・`chatWindow`・`remoteCodingAgents`・`canvases`・`terminalContrib/chat`・`chatAgentTools`、`services/agentHost`・`mcp`・`localTranscription`、`platform/agentHost`・`mcp`・`customizationMarketplace`、`vs/sessions` など。単独のファイルの `delete` も見た）。そのうち、ID の定義（`createDecorator`）が残るファイルにあるものだけが、型検査をすり抜けて `UNKNOWN service` になりうる。

| ID（定義が残る所） | 残る使い手 | 残る登録 | 扱い |
|---|---|---|---|
| `ITerminalChatService`（`contrib/terminal/browser/terminal.ts`） | `terminalTabbedView.ts`・`terminalTabsChatEntry.ts` | 無し | **直した**（R3-1） |
| `IAgentNetworkFilterService`（`platform/networkFilter/common/networkFilterService.ts`） | ワークベンチの `contrib/browserView/common/browserView.ts` 690行（`BrowserViewModel`）・`electron-browser/features/browserEditorErrorFeatures.ts` 55行 | main だけ（`code/electron-main/app.ts` 1264行）。ワークベンチの登録は消した `chat.shared.contribution.ts` 3466行だった | **直した**。本家の実装 `AgentNetworkFilterService` を `contrib/browserView/electron-browser/browserView.contribution.ts` で登録する。設定（`chat.agent.networkFilter` など）は chat とともに消えたので、フィルターは切れていて（`isEnabled()` が偽）、すべての URI を通す。r2 のスモークは統合ブラウザを開かないので出なかったが、開けば `UNKNOWN service agentNetworkFilterService` になるはずだった |
| `ITerminalSandboxService`（`platform/sandbox/common/terminalSandboxService.ts`） | ワークベンチには無い | main（`NullTerminalSandboxService`） | 直さない |
| `ICopilotHomeService`・`IAgentEditorCommentsBridge`・`ISandboxHelperService`・`IWorkspaceFolderLabelService`・`IEditSessionIdentityService`・`IGitHubCredentialBroker` | 残る | 残る所で登録されている | 直さない |
| `IDiffEditorOptionsService`・`ILocalGitService`・`IGitHubService` | ワークベンチには無い（共有プロセスだけ、または使い手なし） | Agents の窓の分は消えた。共有プロセスは残る | 直さない |

ID の定義ごと消えたサービスを残る所が使えば、import が消えて型検査で止まる（r2 で誤り 0）。

### コマンド

残るコードと組み込みの拡張が、文字列で呼ぶ・メニューやキー割り当てに置く・定数で呼ぶチャットの名のコマンドを探した（`executeCommand('…')`、`MenuRegistry`、`package.json` の `menus`・`keybindings`・`when`・`contributes`）。r3b の後に、`src/vs/workbench`・`editor`・`platform` の `executeCommand('…')` の文字列の呼び出しを、名前によらず全部（約100）見直し、定義が C-1 の消したファイルにしか無いものを拾った（`_manageTrustedMCPServersForAccount`・`workbench.action.unifiedQuickAccess` が増えた）。

| コマンド | 呼ぶ所 | 扱い |
|---|---|---|
| `_chat.editSessions.accept` | `extensions/git/src/repository.ts` 1286・1499行 | **直した**（R3-1） |
| `_manageTrustedMCPServersForAccount` | アカウントのメニュー（`browser/parts/globalCompositeBar.ts` の2か所。認証の提供者が `authorizationServers` を持つときと、動的な認証の提供者のとき）と「アカウントの管理」（`contrib/authentication/browser/actions/manageAccountsAction.ts` 114行）の「Manage Trusted MCP Servers」。コマンドは C-1 が消した `manageTrustedMcpServersForAccountAction.ts` にあった | **直した**（r3c）。項目を消した。MCP の画面の一部なので、何もしないコマンドで残すより消す方が合う。`globalCompositeBar.ts` の `canUseMcp` の変数と、`manageAccountsAction.ts` の分割代入の `canUseMcp` も、使い手が無くなるので外した |
| `workbench.action.unifiedQuickAccess` | `browser/actions/quickAccessActions.ts` 187行 | 直さない。消えた設定（統合の Agents バー）が真のときだけ呼び、`try/catch` でふつうのクイックアクセスに戻る。何もしないコマンドで残すと、戻らずに何も開かなくなる。曹参の網はこの行を数えるはずなので、例外（`ORPHAN_ALLOW`）にしてほしい |
| `workbench.action.chat.open` | `browser/actions/helpActions.ts` 353行（Ask @vscode）、`browser/parts/editor/editorGroupWatermark.ts` 47行（Open Chat） | 直さない。どちらも条件が `chatSetupHidden == false`。`NullChatEntitlementService` が `chatSetupHidden` を真にするので、出ない・押せない |
| `workbench.action.chat.triggerSetup` | `contrib/onboarding/browser/onboardingTryoutService.ts` 167行 | 直さない。AI の試しは135行の `sentiment.hidden` で先に隠れる |
| `workbench.action.terminal.chat.viewHiddenChatTerminals` | `contrib/terminal/browser/terminalTabsChatEntry.ts` 57行 | **直した**（r3b）。隠れたチャットのターミナルが0なので入口は出ないが、定義（消した `terminalContrib/chat/browser/terminalChatActions.ts`）が無い。何もしないコマンドとして `terminal.contribution.ts` に登録した。曹参の網（`tests/gate-orphans.mjs` の C）がこの形を「呼び手が残る」と数えると読めたので、r3 の後に足した |
| `vscode.editorChat.start` | `extensions/typescript-language-features/src/languageFeatures/util/copilot.ts` 73行 | 直さない。AI の直しを出すのは `github.copilot-chat` が動いているときだけ（`quickFix.ts` 363行） |
| `github.copilot.nes.postRename`・`prepareRename` | `editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts` | 直さない。Copilot の次の編集の候補を処理する中だけ |
| `inlineChat.start` | `editor/contrib/codeAction/browser/codeActionController.ts` 151行、`contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts` 207行 | 直さない。前者は id を比べるだけ。後者は C-1 の前の直しで出さない |
| `workbench.action.terminal.chat.*`（`contrib/terminal/common/terminal.ts` 659〜669行、`terminalContribExports.ts` 28〜34行） | シェルに渡さないコマンドの一覧と enum の文字列だけ | 直さない。呼ぶ所が無い（`TerminalContribCommandId.<チャットの名>` を使う所は0） |

組み込みの拡張の `package.json` には、チャットのコマンド・メニュー（`chat/…`）・`contributes`（`chatParticipants`・`languageModelTools` など）・`when` のチャットのキーは無かった。

### 設定

- 消えた設定を読む所（`chat.*`・`mcp.*`・`chat.tools.terminal.*`・`chat.agent.sandbox.*`・`chat.agent.networkFilter` など）は、`?? 既定値`・`=== true`・`!値` で読み、無いと `undefined`（切れている）になる。例: `platform/sandbox/common/terminalSandboxEngine.ts`（`?? AgentSandboxEnabledValue.Off`）、`networkFilterService.ts`（`?? false`）、`terminalInstallActions.ts`（`!getValue(...)`）、`mainThreadAuthentication.ts` 214行（`?? {}`）。
- 設定の塊（`getValue('search')` など）を `.` でたどる所は、`search.searchView` の3か所だけだった（R3-1）。`'search'` のほかの塊（`searchEditor`・`decorations` など）は残る `search.contribution.ts` が登録する。`'chat'`・`'inlineChat'`・`'mcp'` の塊を読む所は無い。
- `accessibility.voice.*` は残る `accessibilityConfiguration.ts` が登録する。

### 文脈キー

- 残るコードの `when` が使うチャットの文脈キーは `chatSetupHidden`・`chatSetupDisabledInWorkspace` だけ。`NullChatEntitlementService` が `chatSetupHidden`・`chatSetupDisabled` を真にする（`chatSetupDisabledInWorkspace` は既定の偽）。
- 値の無い文脈キーは偽になるだけで、誤りにならない。組み込みの拡張の `when` にチャットのキーは無い。

## R3-3. ビルドと起動（brief の5）

版を3つ作った。どれも新しい作業ツリーをタグから作った（前の作業ツリーは消さない。削除の許可の外のため）。同じラベルで作り直すには、zip の上書き（`--force-zip`）と作業ツリーの消し（`--fresh`）が要り、どちらも削除の許可の外なので、ラベルを分けた。

- **r3**（`1.146.0-p5-c-all-r3`）: 依頼の3つと `IAgentNetworkFilterService` の直しまでを入れた版。
- **r3b**（`1.146.0-p5-c-all-r3b`）: r3 の後、曹参の網（`tests/gate-orphans.mjs`）の作りを読んで、`viewHiddenChatTerminals` の呼び手が残ると分かった。何もしないコマンドを足した版。
- **r3c**（`1.146.0-p5-c-all-r3c`）: r3b を作っている間に、残るコードの `executeCommand('…')` を全部（チャットの名でないものも）見直し、アカウントのメニューの `_manageTrustedMCPServersForAccount` を見つけた。項目を消した版。**今の `edits.patch` と中身が合うのは r3c。関門には r3c を使ってほしい。**

### r3

```
node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r3 --worktree tmp/b/wt-r3/1.146.0 --take-in-dir tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3 --record tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3/build-record.json
```

| 手順 | 結果 |
|---|---|
| prepare | ok（191 秒） |
| apply | ok（419 秒。この間、ほかのテストを並べて走らせていたので遅い）。21単位すべて `applied: ok`。C-1 の edits は衝突なし。C-1 の後の C-4 の `searchView.ts` の区画もそのまま当たった。`result: ok`、`errors: []`、警告は C-2 の想定の1件だけ。HEAD は `44aa2e0bbb84e477d4995446318be3abaa2cf936` |
| install・lockfile | ok（638 秒・0.7 秒） |
| typecheck | ok（7.9 秒、終了コード 0、誤りの行なし）。`NullTerminalChatService` が `ITerminalChatService` を満たし、`searchView?:` にしても `.searchView.` でたどる所が残っていない |
| package・postprocess・zip | ok。`tmp\b\dist\1.146.0-p5-c-all-r3.zip`、219,120,326 B、SHA-256 `3f606f9a39494a8026bd987158c7ddfd8c75e6198bd67677786fa657860b1229`。記録の `warnings: []`。枝 `builds/1.146.0-p5-c-all-r3` |

起動の確かめ（`launch-check-p5-c-all-r3.json`。`-InstallExtension` は r2 と同じ7つ）: 終了コード 0、`result: ok`。CLI の導入は7つとも `successfully installed`。ワークベンチのしるしは3つとも出て、コンソールの `Uncaught` は 0。普段使いのデータのフォルダは変わらない。

### r3b

同じコマンドで、ラベル `1.146.0-p5-c-all-r3b`、作業ツリー `tmp/b/wt-r3b/1.146.0`。prepare から zip まで `result: ok`。21単位すべて `applied: ok`、`errors: []`、警告は C-2 の1件だけ。型検査は終了コード 0（8.4 秒）。HEAD `18e1d03083015d7c3c05a2bf497c3395eccdd88d`。zip `tmp\b\dist\1.146.0-p5-c-all-r3b.zip`、219,122,301 B、SHA-256 `f0ec6292fb32067e6e186853b6adcda040d3fa24ff8f3049012162b03701604e`。r3c に置き換わるので、起動の確かめは流していない。

### r3c（関門に使う版）

```
node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r3c --worktree tmp/b/wt-r3c/1.146.0 --take-in-dir tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3c --record tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3c/build-record.json
```

| 手順 | 結果 |
|---|---|
| prepare・apply | ok。21単位すべて `applied: ok`。C-1 の edits は衝突なし（`globalCompositeBar.ts` のハンクも当たった）。`result: ok`、`errors: []`、警告は C-2 の想定の1件だけ。HEAD は `827a712b63db17ef1326637343927c1d8fd86a0c` |
| install・lockfile | ok（661 秒） |
| typecheck | ok（7.1 秒、終了コード 0、誤りの行なし） |
| package・postprocess・zip | ok。`tmp\b\dist\1.146.0-p5-c-all-r3c.zip`、219,121,270 B、SHA-256 `56ad1c155a5f789ee2f1990873ff92cc889a853c81d686f85e6a818014fa9c8c`。`sourceVersion` は checks.json の HEAD と一致。記録の `warnings: []`。枝 `builds/1.146.0-p5-c-all-r3c` |

起動の確かめ（`launch-check-p5-c-all-r3c.json`。`-InstallExtension` は r2 と同じ7つ）: 終了コード 0、`result: ok`。CLI の導入は7つとも `ok`。ワークベンチのしるしは3つとも出て（ログのフォルダ `portable\user-data\logs\20261116T152109`）、コンソールの `Uncaught` は 0。renderer.log に誤りの行は無い。普段使いのデータのフォルダは変わらない。

### 起動の確かめで見えないもの

`p1-launch-check.ps1` は、ウィンドウを開いてワークベンチが立ち上がるまでを見る。今回の3種の誤りは、ターミナルを作る・検索の欄に打つ・git でステージする、のときに出るので、この確かめでは通らない。直ったかを動かして確かめるのは、関門のスモーク（`base.terminal`・`base.replace`・`base.git` と renderer.log・exthost.log の誤り）になる。私の許可では `tests/smoke-run.mjs` を走らせられない。

## R3-4. テストの入口（曹参へ）

- 網（`tests/gate-orphans.mjs` の `findOrphans`）が「解決された」と数える形に合わせてある。
  - A サービス: `registerSingleton(ITerminalChatService, NullTerminalChatService, …)`、`registerSingleton(IAgentNetworkFilterService, AgentNetworkFilterService, …)` を足した（patch の + の行）。ただし `IAgentNetworkFilterService` は本家で main の `app.ts` にも登録があるので、網の A は「C-1 だけが消した登録」と数えず、もともと見つけない。プロセスの違い（main にあってワークベンチに無い）は、網では見えない。
  - B 設定: `services/search/common/search.ts` の区画に `+	searchView?: {` がある（網の「親が省略できる型」）。`searchView.ts` の3行も書き換えた。
  - C コマンド: patch の + の行に `'_chat.editSessions.accept'` と `'workbench.action.terminal.chat.viewHiddenChatTerminals'` がある。
- 自分で流したテスト（合否は出さない）:
  - `node --test tests/c1-round2.test.mjs`: 14 pass / 0 fail。
  - `node --test tests/c1-unit.test.mjs`: **終了コード 1**。ただし中身は読めていない。網の検査が重く 175 秒を超え、バックグラウンドに回った。回った出力のファイル（`%LOCALAPPDATA%\Temp\claude\…`）は、私の読める場所の外。4回流して4回とも 1 だった（r3 の直しの後に2回、`viewHiddenChatTerminals` を足した後に1回、アカウントのメニューを直した今の `edits.patch` で1回）。網の作りから、少なくとも `workbench.action.unifiedQuickAccess`（直していない。例外にしてほしいもの）は数えられると読める。ほかに何が数えられているかは分からない。曹参に `node tests/orphans-report.mjs C-1-ai` か c1-unit の出力を見てもらいたい。
- 21単位の本物の記録: `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3c/checks.json`・`build-record.json`（r3・r3b の分は同じ形で `1.146.0-p5-c-all-r3/`・`1.146.0-p5-c-all-r3b/`）。
- 網の C は、`_manageTrustedMCPServersForAccount` の呼び手（`globalCompositeBar.ts`・`manageAccountsAction.ts`）も数えていたはず。r3c で呼ぶ行そのものを消したので、網の「消した行」として解決になる。
- `workbench.action.unifiedQuickAccess`（`quickAccessActions.ts` 187行）は直していないので、網が数えるなら例外に入れてほしい（R3-2 のコマンドの表）。

## R3-5. 守ったこと・未解決の点

### 守ったこと

- `C:\b` は読むだけ。読んだのは `C:\b\wt\1.146.0`（C-1 を当てる前の木。消した部品の登録・コマンド・設定を拾うため）。`--build-root` に `C:\b` は渡していない。
- 何も消していない。r2 の作業ツリー・出力・zip はそのまま。r3・r3b・r3c は新しい作業ツリー（`tmp\b\wt-r3\1.146.0`・`tmp\b\wt-r3b\1.146.0`・`tmp\b\wt-r3c\1.146.0`）と新しいラベルで作った。
- 作業ツリーへ直接 git を打っていない。直しは edits.patch の本文だけで、当て直しと型検査は `build.mjs` に任せた。
- 書いたもの: `removals/C-1-ai/edits.patch`・`removals/C-1-ai/README.md`、このフォルダ、`tmp\b` の下（`build.mjs`・`p1-launch-check.ps1` が書く所）。

### 未解決の点

1. **c1-unit の結果を読めていない**（R3-4）。曹参か大岡越前守に、出力を見てもらう必要がある。網が残りを数えたら、その場所を教えてほしい。直すか例外（`ORPHAN_ALLOW`）にするかを決めて直す。
2. **r3・r3b・r3c の3つの版がある**（R3-3）。関門は r3c で。r3 と r3b の zip・展開先・作業ツリー（`tmp\b\dist\1.146.0-p5-c-all-r3*.zip`・`tmp\b\p2\1.146.0-p5-c-all-r3\`・`tmp\b\wt-r3\`・`tmp\b\wt-r3b\`）は、今の `edits.patch` と中身が違う（r3 は `viewHiddenChatTerminals` とアカウントのメニュー、r3b はアカウントのメニューの直しが無い）。片づけは削除の許可が要る。依頼のラベル `1.146.0-p5-c-all-r3` と違うラベルで関門に出すことになる。
3. **edits.patch の空の文脈の行**: Edit の道具が、空の文脈の行の先頭の空白を落とした（r2 と r3 で足した区画の、空行の文脈が `" "` でなく `""` になっている）。`git am` は空の行を空の文脈として受け付けるので、r2・r3・r3b・r3c とも当たった。ただ、パッチを1行ずつ読むテストの読み手（`tests/c2-worktree.test.mjs` の `parsePatch` の形など）は、空の行を飛ばす。C-1 の edits.patch を本家に当てて木を作るテストを足すなら、空の行を文脈として扱う必要がある。`C:/b/wt/*` で format-patch し直せば、`" "` と `index` の行の両方が入る。
4. **起動の確かめは3種の誤りの道を通らない**（R3-3 の末尾）。関門のスモークで見てほしい。
4'. **`tmp\b` の作業ツリーが増えた**: `wt`・`wt-r2`・`wt-r3`・`wt-r3b`・`wt-r3c` の5つが、どれも `node_modules` と gulp の出力を持つ（1つ約 2.5 GB と出力 0.7 GB。build-record の `size`）。E: の空きには余裕があるが、片づけの許可が要る。
5. **統合ブラウザの網**: `IAgentNetworkFilterService` は、本家で main にも登録があるため網の A では見つからない。「main にあってワークベンチに無い」形は、ほかの単位でも網をすり抜けうる。曹参に伝えたい。

---

# r4（2026-11-16、r3c の関門の後。edits.patch の書式の直し）

- 依頼: リーダーの依頼（C-1 の edits.patch の書式の直しと r4）。関門の記録は `records/take-in/1.146.0-p5-c-all-r3c/gate-C-1-ai.md`、判断は `docs/user-decisions.md` の「段階 C の版 r3c の関門で出た点」
- 途中で権限の変更が入った（`tasks/2026-11-15-move-off-c/permission-response.md`）。`git -C tmp/b/wt/* format-patch` などが通るようになったので、index の行は台本で計算せず、**作業ツリーで format-patch して作り直す方**を選んだ（git そのものが作るので確か）。作業ツリーは `tmp/b/wt/` の下に作った（r4 は `tmp/b/wt/r4`）。
- 結果: 完了。edits.patch を format-patch で作り直した（index の行 121/121、空の文脈の行 0、見出しの行数は git が数えた）。3方向の当て方が効くことを確かめた。版 `1.146.0-p5-c-all-r4` を zip まで作り、`p1-launch-check.ps1` は `result: ok`。

## R4-0. 要点

1. `removals/C-1-ai/edits.patch` を、C-1 の edits のコミットを `git -C tmp/b/wt/c1fix format-patch` して丸ごと作り直した。中身（`+` / `-` の行）は前と1行も変えていない（`scripts/patch-compare.mjs` で121区画すべて同じ）。
2. 書式: 121区画すべてに `index <前>..<後> 100644` の行がある（前は13区画で欠けていた）。ハンクの中の空の行は 0（前は24）。ハンクの見出しの行数は本文と合う。CR は 0。
3. 3方向: 文脈の行をわざと1つ変えた木に当てると、ふつうの当て方は落ち、`apply --3way` は衝突 0 で当たった（R4-2）。
4. 版 r4: 21単位すべて `applied: ok`、C-1 の edits は衝突なしで当たった。木の中身は r3c と同じ（`diff --stat 827a712b 7fac30e8` が空）。型検査・package・zip は ok。起動の確かめも ok（ワークベンチの3つのしるし、`Uncaught` 0、7つの VSIX の導入）。
5. 作業ツリーは新しい置き場所 `tmp/b/wt/r4` を使った（権限の知らせの時点で r4 はまだ作り始めていなかったため）。

## R4-1. edits.patch を作り直した手順

1. 当てるだけの作業ツリーを `build.mjs` で作った。`--to apply` で、21単位を今の edits.patch で当てる（r3c と同じ中身）。
   ```
   node scripts/build.mjs 1.146.0 --label c1fix-r4prep --worktree tmp/b/wt/c1fix --to apply --no-branch --take-in-dir tasks/2026-11-16-p5-c1-product-keys/c1fix-r4prep --record tasks/2026-11-16-p5-c1-product-keys/c1fix-r4prep/build-record.json
   ```
   `result: ok`。C-1 の ops は `945352129f859ad28ed53ffbf5711f9b5377a79b`、edits は `dc8c21678aa7e3cb0c6929f8e3842e66b82a00f7`（`c1fix-r4prep/checks.json` の `commits`）。
2. C-1 の edits のコミットを format-patch した。先に試しの場所（`tmp/b/trial-c1fix/`。削除の許可の中）に出して比べ、同じと分かってから本物に書いた。
   ```
   git -C tmp/b/wt/c1fix format-patch -1 dc8c21678aa7e3cb0c6929f8e3842e66b82a00f7 --output=E:/develop/self/Team/projects/ai-editor/tmp/b/trial-c1fix/edits.patch
   git -C tmp/b/wt/c1fix format-patch -1 dc8c21678aa7e3cb0c6929f8e3842e66b82a00f7 --output=E:/develop/self/Team/projects/ai-editor/removals/C-1-ai/edits.patch
   ```
   - 件名・作者（`shuko-apply <apply@shuko.invalid>`）・日付（`Sun, 15 Nov 2026 10:50:31 +0900`）・本文は前と同じ（git am がパッチの値をそのまま使うため）。変わったのは先頭の `From <sha>` の行、各区画の `index` の行、空の文脈の行、ハンクの見出しの関数の文字、変更の一覧の桁揃え。
   - 121 files changed、946 insertions、5457 deletions（手で書いていた数と同じ）。区画は121、どれにも `index <前>..<後> 100644` の行がある。ハンクの中の空の行は 0。CR は 0。末尾は `-- ` と `2.54.0.windows.1`。
3. 前のパッチ（r3c の時点の本文）と新しいパッチを、台本で区画ごとに比べた。
   ```
   node scripts/patch-compare.mjs removals/C-1-ai/edits.patch tmp/b/trial-c1fix/edits.patch   （書く前。a = 手で直した前のもの）
   node scripts/patch-compare.mjs removals/C-1-ai/edits.patch tmp/b/trial-c1fix/edits.patch   （書いた後。a = 作り直したもの）
   ```
   | 項目 | 前のパッチ（a、書く前） | 作り直したもの（b） |
   |---|---|---|
   | 区画 | 121 | 121。片方にしか無い区画は無い |
   | `+` / `-` の行の並び | — | 121区画すべてで a と同じ（`bodyDiffs: []`） |
   | ハンクの見出しの行数と本文の数 | 合う（空の行を文脈と数えれば。`headerIssues: []`） | 合う |
   | `index` の行が無い区画 | 13（r2〜r3c で手で足した区画: product.ts、extensionManagement の5つ、manageAccountsAction.ts、browserView.contribution.ts、aiEditTelemetryService.ts、extensionsWorkbenchService.ts、terminal.contribution.ts、defaultAccount.ts、search.ts） | 0 |
   | ハンクの中の空の行（先頭の空白が落ちた文脈の行） | 24 | 0 |

   書いた後にもう一度比べ、a と b がすべて同じ（index の欠け 0、空の行 0）になったことを見た。

## R4-2. 3方向の当て方が効くこと

`tmp/b/wt/c1fix` を C-1 の ops のコミット（edits の前）に戻し、edits.patch の文脈の行を1つ、わざと変えてから当てた。

1. `git -C tmp/b/wt/c1fix checkout 945352129f859ad28ed53ffbf5711f9b5377a79b`
2. `src/vs/base/common/product.ts` 267行（product.ts の区画の1つ目のハンクの、後ろの文脈の行）`readonly msftInternalDomains?: string[];` の後ろに `// trial: …` を足し、`git -C tmp/b/wt/c1fix add src/vs/base/common/product.ts`
3. `git -C tmp/b/wt/c1fix apply --check E:/…/removals/C-1-ai/edits.patch` → `error: patch failed: src/vs/base/common/product.ts:261`（ふつうの当て方では当たらない）
4. `git -C tmp/b/wt/c1fix apply --3way E:/…/removals/C-1-ai/edits.patch` → 終了コード 0。120区画が `Applied patch to '<path>' cleanly.`（わざと変えた product.ts を含む）。新しいファイル `extHostRemovedApi.ai.ts` だけは前の blob が無いので `Falling back to direct application...` で当たった（新しいファイルはそれで正しい。status で `A`）。衝突（`U`）は 0
5. `git -C tmp/b/wt/c1fix diff --cached dc8c21678aa7e3cb0c6929f8e3842e66b82a00f7 --stat` → `src/vs/base/common/product.ts | 2 +-` だけ。3方向で当てた結果は、わざと変えた1行のほかは C-1 の edits のコミットと同じ

→ どの区画も、`index` の行の前の blob が本家の clone にあり、3方向の当て方に使える。`git am -3` はこの道（`apply --3way`）を使う。

`tmp/b/wt/c1fix` は、この試しの状態（わざと変えた1行と、3方向で当てた変更が index に入ったまま）で残した。確かめ専用の作業ツリーで、ビルドには使わない。

## R4-B. 版 1.146.0-p5-c-all-r4

作業ツリーは `tmp/b/wt/r4`（新しい置き場所）。

1. 1回目（prepare から）:
   ```
   node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r4 --worktree tmp/b/wt/r4 --take-in-dir tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4 --record tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4/build-record.json
   ```
   - prepare ok。apply ok（21単位すべて `applied: ok`、errors 0。警告はいつもの C-2 の1件 `debugChatIntegration.ts が本家に無い` だけ）。
   - C-1 の edits は `git am -3` で衝突なし（`checks.json` の `conflicts: []`）。edits のコミットは `d26dadac8274e94d34e347c02e355c67e0caa9e1`、HEAD は `7fac30e886f79ebe44e1bac93acd7a86fbbafed8`。
   - `git -C tmp/b/wt/r4 diff --stat dc8c216 d26dadac` は空。r4 で当たった C-1 の edits の結果は、c1fix で format-patch の元にしたコミットと同じ。
   - `git -C tmp/b/wt/r4 diff --stat 827a712b 7fac30e8` は空。r4 の木は r3c の木（関門で振る舞いが合格したもの）と1バイトも違わない。
   - install で止まった。`install.log` 1952〜1957行: `failed to rename staging directory "...\tmp\b\wt\r4\build\node_modules\@azure\cosmos_pacquet-stage_..." to "...\@azure\cosmos": concurrent package import did not settle`（`build/` の postinstall の中の pnpm install。`ERR_PNPM_EXECUTOR_LIFECYCLE_SCRIPT_FAILED`）。pnpm が並べて取り込むときの競り合いで、パスの長さの誤りではない。
2. 2回目（同じ作業ツリーで install から。何も消していない）:
   ```
   node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r4 --worktree tmp/b/wt/r4 --from install --take-in-dir tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4 --record tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4/build-record.json
   ```
   - `result: ok`。install 286.5秒、lockfile ok（予想の外の削除・追加 0）、typecheck ok（7.6秒。r2〜r3c も 7〜8.4秒）、package 235.7秒、postprocess ok（product.json の commit が HEAD と合う、残りの拡張 0）、zip ok。
   - zip: `tmp\b\dist\1.146.0-p5-c-all-r4.zip`、219,116,481 バイト、SHA-256 `e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e`、2037 項目、先頭のフォルダ `Shuko-win32-x64-1.146.0-p5-c-all-r4`。
   - 枝 `builds/1.146.0-p5-c-all-r4`（`7fac30e8`）を作った。
3. 起動の確かめ:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip tmp/b/dist/1.146.0-p5-c-all-r4.zip -Dest tmp/b/p2/1.146.0-p5-c-all-r4 -InstallExtension tmp/b/cache/vsix/detachhead.basedpyright-1.40.2,tmp/b/cache/vsix/ms-vscode.powershell-2025.4.0,tmp/b/cache/vsix/mads-hartmann.bash-ide-vscode-1.43.2,tmp/b/cache/vsix/mechatroner.rainbow-csv-3.24.1,tmp/b/cache/vsix/weixu.wx-vsce-dotenv-0.2.3,tmp/b/cache/vsix/tomoki1207.pdf-1.2.2,tmp/b/cache/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0 -OutFile tasks/2026-11-16-p5-c1-product-keys/launch-check-p5-c-all-r4.json
   ```
   - 終了コード 0、`result: ok`。message `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。
   - `--version` は `1.146.0` / `7fac30e8…` / `x64`。7つの VSIX はすべて `successfully installed`。
   - ワークベンチの3つのしるしはすべて true。コンソールの `Uncaught` は 0。普段使いのデータのフォルダは変わっていない。

記録（このフォルダ）: `1.146.0-p5-c-all-r4/build-record.json`・`checks.json`・`lockfile.diff`、`launch-check-p5-c-all-r4.json`、`c1fix-r4prep/build-record.json`・`checks.json`。

## R4-3. 曹参の網に合わせたこと

- edits.patch は、今は丸ごと git format-patch の出力なので、1行ずつ読む読み手と見出しで読む読み手のどちらで読んでも同じ `+` / `-` の行になるはず（空の行が無く、見出しの行数も git が数えた）。
- `scripts/patch-compare.mjs`（新規。読むだけで何も書かない）: 2つのパッチの区画・本文・見出しの行数・index の行・空の文脈の行を比べて JSON で出す。曹参の網が「どのハンクで合わないか」を出す直しの、照らしの相手に使える。入口は `parsePatch(text)`・`compareParsed(a, b)`。終了コード 0 = 本文が同じ、1 = 違う、2 = 引数の誤り。

- 曹参の網（`tests/patch-shape.mjs`）は、私の許可では `node tests/patch-shape.mjs …` を打てないので走らせていない。中身を読むと、見出しの行数と本文の照らし・空の行の扱い・2つの読み手の照らしを見ていた。`patch-compare.mjs` で同じ点（`headerIssues: []`、空の行 0）を確かめた。網を通すのは曹参か大岡越前守にお願いしたい。

## R4-4. テストの入口（曹参へ）

- `node scripts/patch-compare.mjs removals/C-1-ai/edits.patch <比べる相手>` の終了コードは、本文が同じなら 0。自分自身と比べると `indexLines.aMissing: []`、`blankContextLines.a: 0`、`headerIssues: []` になるはず。
- `tests/patch-shape.mjs` に `removals/C-1-ai/edits.patch` を渡すと、`problems` と `diffs` が空になるはず。
- `tests/c1-unit.test.mjs` の静的なテスト2件（r3c の関門で保留になったもの）は、空の文脈の行と index の行が原因だったなら、今は通るはず。私の許可では、c1-unit は175秒を超えて裏に回り、出力を読めないので、結果を見ていない。`tests/c1-round2` は 14 pass / 0 fail。

## R4-5. 未解決の点・残したもの

1. **入れ子の作業ツリーを誤って作った。** 権限の知らせの後、最初に `git -C tmp/b/vscode worktree add tmp/b/wt/c1fix …` と打った。`git -C` の先からの相対パスとして読まれたので、`tmp/b/vscode/tmp/b/wt/c1fix` に作業ツリーができてしまった（clone の中の入れ子。このリポジトリそのものには効いていない）。消していない。許しのある `git -C tmp/b/vscode worktree remove tmp/b/wt/*` を打っても、同じく入れ子の側を指すかどうかが確かでないため。後片付けのしかたをリーダーに決めてほしい（例: 許しの形を `git -C tmp/b/vscode worktree add E:/…/tmp/b/wt/*` のような絶対パスにする、または `worktree remove tmp/b/vscode/tmp/b/wt/c1fix` を一度だけ許す）。本物の `tmp/b/wt/c1fix` は、その後 `build.mjs` で作った（build.mjs は絶対パスを渡す）。
2. `tmp/b/wt/c1fix` は、3方向の試しの状態（R4-2）のまま残っている。ビルドには使わない。
3. `tmp/b/trial-c1fix/`（`0001-unit-C-1-ai-edits.patch`、`edits.patch`）が残っている。削除の許可の中。
4. 前の作業ツリー `tmp/b/wt-r2`・`wt-r3`・`wt-r3b`・`wt-r3c` と、それぞれの展開先が残っている（容量のため、いずれ片付けたい）。
5. gulp の出力 `tmp/b/wt/VSCode-win32-x64` は、`tmp/b/wt/` の下の作業ツリーみなで同じ場所を使う（build.mjs が作業ツリーの隣に置くため）。今は r4 の中身。`tmp/b/wt/` に作業ツリーを並べて同時に package すると取り合いになる。今のところ実害はない。
6. 1回目の install の失敗（pnpm の `concurrent package import did not settle`）は、install からやり直すと通った。続けて出るようなら、`build/` の postinstall の並べ方を見直す必要がある。今回は1回だけだった。
7. docs/ との食い違い: 見つけていない。

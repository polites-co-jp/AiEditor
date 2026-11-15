# C-3-remote リモート開発

裁定（2026-11-12）: 削る候補にリモート開発（SSH・WSL・コンテナ）。裁定（同日、荀彧の方針の後）: 段階的に全部消す。

> 状態: edits.patch あり、関門の前（2026-11-15）。`enabled` は `false` のまま。A・B の14単位と C-1 の上で型検査が誤り 0 で通り、C-2 を挟んだ17単位でも当たる（`tasks/2026-11-15-p5-c3-patch/`）。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 消すもの

- `src/vs/workbench/contrib/remote`: リモートエクスプローラー（`workbench.view.remote`）、ポートのビュー（`~remote.forwardedPorts`）とポートの転送の操作（`remote.tunnel.*`）、状態表示の左端のリモートのボタン（`workbench.action.remote.showMenu`）、リモートの再接続・接続の健全性の表示、Web の開始画面の入口、`remote.*` の設定（`remote.autoForwardPorts`・`remote.localPortHost`・`remote.extensionKind` など）、`vscode-remote` のラベルの書式。
- `src/vs/workbench/contrib/remoteTunnel`: 「リモート トンネル アクセス」（`code tunnel` でこの PC を外から開けるようにする機能）の画面とコマンド（`workbench.remoteTunnel.actions.*`）、設定 `remote.tunnels.access.*`。
- `src/vs/platform/remoteTunnel`: リモートトンネルのサービス（共有プロセスでトンネルの CLI を起動する部品、レンダラー側の代理）。
- `build/gulpfile.reh.ts`: サーバー（reh・reh-web）のビルドタスク。`build/gulpfile.ts` は `gulpfile.*.ts` を glob で読むので、ファイルを消せばタスクが無くなる（ほかに import している所は無い。`grep` で確かめた）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行、`workbench.desktop.main.ts` 3行、`workbench.web.main.ts` 1行。共有プロセスの入口 `sharedProcessMain.ts` のリモートトンネルの7行（import 3行、サービスの登録2行、チャンネルの登録2行。どれも1行で完結し、ほかの名前を含まない）。
- `src/vs/sessions/sessions.*.main.ts`（Agents の窓）の行は直さない。C-1 が `src/vs/sessions` を丸ごと消すので、C-1 の後に当たるこの単位が `removeLines` を書くと「ファイルが無い」で止まる。代わりに `after` に `C-1-ai` を挙げた（下の「前提の単位」）。

## 前提の単位

- `after`: `A-5-remote-extensions`、`C-1-ai`。
- `C-1-ai` を挙げた理由: (1) C-1 が `src/vs/sessions` を消すので、sessions の入口の行をこの単位で直さない。(2) リモートトンネルを import しているチャット・エージェントのセッション・`platform/agentHost` の部品（下の表）は C-1 で消える。C-1 が無効のままこの単位を当てると、sessions の入口とそれらの部品に消した部品への参照が残り、型検査が通らない。
- product.json のキー（`productRemove`）: `serverLicenseUrl`・`serverGreeting`・`serverLicense`・`serverLicensePrompt`・`serverApplicationName`・`serverDataFolderName`・`tunnelApplicationName`・`win32TunnelServiceMutex`・`win32TunnelMutex`（docs/02 の3節の「server*、tunnel*、win32Tunnel*」。1.146.0 の product.json にあるのはこの9つ）。
  - `tunnelApplicationName` が無いと、CLI の `code tunnel`・`code serve-web` は「not supported」と出して止まる（`src/vs/code/node/cli.ts` の56行）。
  - `serverDataFolderName` を読む残る部品は、どれも値が無いときの既定（`'.vscode-remote'` など）を持つ（`build/gulpfile.vscode.ts` の406・420・437行）。AI の部品（`platform/agentHost`・`contrib/chat`・`contrib/mcp`・`terminalContrib/chatAgentTools`）も読むが、C-1 で消える。
  - `win32Tunnel*` を読むのは `build/gulpfile.vscode.win32.ts`（インストーラーの作成。このビルドでは使わない）だけ。

## 残すもの

- `src/vs/workbench/services/remote`: ローカルの拡張ホストの部品（`services/extensions/browser/extensionService.ts` の41・69行、`electron-browser/nativeExtensionService.ts` の60・87行）が `IRemoteExplorerService` を注入し、`IRemoteAgentService` も多くの部品が使う。docs/03 の表は `remoteExplorerService.ts` を消す側に挙げているが、消すと拡張の起動の部品と拡張 API（`mainThreadTunnelService.ts`）を直すことになるので残した（下の別案1）。
- `src/vs/workbench/services/tunnel`: `ITunnelService` の登録。Webview（Claude Code のパネル）の `webviewElement.ts`、`electron-browser/window.ts`（外部 URI の解決）、ターミナルのリンクが注入している（docs/03 の9節の受け手）。ローカルのウィンドウでは `canTunnel` が偽になり、何もしない。docs/03 の表では消す側だが、消すと Webview が起動時に注入で失敗する（型検査では見つからない）ので残した。
- `src/vs/platform/remote`（`electron-browser/sharedProcessTunnelService.ts` を含む）と `src/vs/platform/tunnel`: 上の2つが使う。`sharedProcessTunnelService.ts` は docs/03 の表で消す側だが、`services/tunnel` の `TunnelService` が注入している。
- `src/vs/workbench/api/browser/mainThreadTunnelService.ts` と拡張ホスト側の `extHostTunnelService.ts`: 拡張 API の `workspace.openTunnel`・`registerPortAttributesProvider` の入口。
- `remote/`（サーバーとウェブの依存）と `src/vs/server`・`src/server-main.ts`・`src/server-cli.ts`: デスクトップの zip には入らない。消すにはビルドの道具（`build/npm/dirs.ts`・`preinstall.ts`・`postinstall.ts`・`build/lib/node.ts`・`esbuild.ts`・`i18n.ts`）への変更が要る（下の別案2）。

## 型検査で直す点（edits.patch の見込み）

1.146.0 の作業ツリーで `grep` した結果。行は 1.146.0 のもの。

| ファイル | 行 | 中身 | 直し方の見込み |
|---|---|---|---|
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | 27（使う所 525・536・632） | `import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';` | import をやめ、同じ値の定数 `const REMOTE = 'workbench.view.remote';` をファイルの中に置く。拡張が `viewsContainers`/`views` の `remote` に足すビューは、コンテナーが無いので既存の扱い（エクスプローラーへ回す警告）になる |
| C-1 の範囲（`after` に挙げた）: `contrib/chat/electron-browser/tunnelHost.contribution.ts`（20）・`toggleRemoteConnectionsActionViewItem.ts`（25）・`remoteConnectionsSharing.ts`（15）、`contrib/sessions/providers/remoteAgentHost/browser/remotesModel.ts`（27）・`browserTunnelAgentHostService.ts`（59）、`platform/agentHost/node/tunnelAgentHostService.ts`（13）、`src/vs/sessions/contrib/providers/remoteAgentHost/browser/tunnelAgentHost.contribution.ts`（16）・`remoteAgentHostActions.ts`（38）、それらのテスト9つ | — | `IRemoteTunnelService`・`tunnelServiceHeaders` などを import | C-1 がフォルダごと消す（`contrib/chat`・`contrib/sessions`・`platform/agentHost`・`src/vs/sessions`）。C-1 の ops の後に当てた試しで、`absentStrings` の残りは上の `viewsExtensionPoint.ts` の1件だけになった |

- 型検査に掛からない点: `services/dialogs/browser/fileDialogService.ts` の258行が `workbench.action.remote.showMenu` を文字列で実行する（Web の版だけ。デスクトップでは通らない）。
- lint の一覧（`.eslint-allowed-bracket-notation-files` の270・475・476行、`eslint.config.js` の441・845行）に消したファイルの名前が残る。関門は型検査とビルドなので直さない（ほかの単位と同じ扱い）。
- `build/lib/i18n.resources.json` の `vs/workbench/contrib/remote`・`remoteTunnel`（翻訳の書き出し用。自前のビルドでは使わない見込み。B-2 と同じ）。

## edits.patch で直した点（2026-11-15）

A・B の14単位と C-1 と C-3 の ops を当てた作業ツリーで、型検査（`pnpm run typecheck-client`）の誤りは1件だけだった（上の表の見込みどおり）。1件を直して 0 になった。

| ファイル | 直し方 |
|---|---|
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | `contrib/remote/browser/remoteExplorer.js` の import の1行を消し、import の並びの後に同じ値の定数 `const REMOTE = 'workbench.view.remote';` を置いた（コメント `// Shuko (C-3-remote): ...`）。使う所（`canMoveView`・`workspace`・`getViewContainer('remote')`）は変えていない |

- edits.patch は1ファイル、5行の追加、1行の削除。件名は `unit C-3-remote: edits`、作者は `shuko-apply <apply@shuko.invalid>`。
- 拡張 API は変えていない。`extHost.api.impl.ts`・`extHost.protocol.ts` に触れず、`api/common/extHostRemovedApi.remote.ts` も作っていない（残す `mainThreadTunnelService.ts`・`extHostTunnelService.ts` が `workspace.openTunnel` などをそのまま受ける）。
- `unit.json` は `"patch": "edits.patch"` を足しただけ。`delete`・`removeLines`・`kept`・`checks` は下準備のまま。

### ほかの単位と独立に保つ形（docs/03 の5.3）

- 直したファイル `viewsExtensionPoint.ts` は、A・B の単位・C-1・C-2 の edits.patch と `patches/` のどれも触らない（2026-11-15 に `removals/`・`patches/` を `grep` で確かめた）。前後の文脈の行（`contrib/debug/common/debug.js` の import を含む）も、C-2 は変えない。
- そのため、C-2 の有無で C-3 のパッチの文脈は変わらない。C-2 を挟んだ組の C-3 の ops の commit の上で、`git apply --check` が行のずれも無く当たった（3-way に頼らない）。`removeLines` に回すものは無い。
- `workbench.*.main.ts` と `sharedProcessMain.ts` は、下準備のとおり `removeLines` だけで直している（パッチに入れない）。

### build/ の型（関門の外。直していない）

`productRemove` で product.json から9つのキーを消すと、build/ の台本の型（product.json から推論される型）に誤りが6件出る（`npx tsc --noEmit --project build/tsconfig.json`）。

| ファイル | 行（C-1 の後） | 読むキー | 実行時 |
|---|---|---|---|
| `build/gulpfile.vscode.ts` | 353・367 | `serverDataFolderName` | `|| '.vscode-remote'` の既定がある。パッケージ化で通る所だが、誤りにならない |
| `build/gulpfile.vscode.win32.ts` | 96〜98 | `win32TunnelMutex`・`win32TunnelServiceMutex`・`tunnelApplicationName` | インストーラーの作成（`vscode-win32-x64-*-setup`）の中だけ。このビルドでは走らない |
| `build/linux/dependencies-generator.ts` | 60 | `tunnelApplicationName` | Linux の版だけ |

- gulp は `node --experimental-strip-types` で走る（`package.json` の `gulp`）ので、型の誤りでは止まらない。関門の型検査は `typecheck-client`（src だけ）。
- A-3 の `builtInExtensions: []` から来る1件（`gulpfile.vscode.ts` の139行）と同じ扱いにして、直していない。直すなら、`gulpfile.vscode.ts` を C-1 も直しているので、パッチの文脈が重ならない形にする必要がある（判断を仰ぐ点）。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest（`records/phase0/claude-code-manifest.md`、`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json`）に、`viewsContainers`・`views` の `remote`、`extensionKind`、`resolvers`・`remoteHelp`、`onResolveRemoteAuthority`・`onTunnel` などの起動の条件は無い。
- Claude Code の受け手は消していない。
  - Webview（パネル）が注入する `ITunnelService`（`services/tunnel`）、`ISharedProcessTunnelService`（`platform/remote`）、`platform/tunnel` は残した。ローカルの窓では `canTunnel` が偽で、何もしない。
  - `vscode.env.asExternalUri`（外部の URI の解決。`electron-browser/window.ts` が `ITunnelService` を使う）も残る部品だけを通る。ローカルでは URI はそのまま返る（本家と同じ）。
  - セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステムには触れていない。
- 台帳のほかの7つ（PowerShell・basedpyright・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パック）の package.json にも、上の項目は無い（2026-11-15 に `grep` で確かめた）。`tomoki1207.pdf` の `extensionKind` は manifest の項目で、リモートでどちら側に置くかの指定。ローカルだけの窓では効かない。
- 日本語の言語パックの `vs/workbench/contrib/remote`・`remoteTunnel` の訳は、読み手が無くなるだけ。
- 拡張が `viewsContainers`/`views` の `remote` に足すビューは、コンテナーが無いので、既存の扱い（「View container 'remote' does not exist」の警告を出して、エクスプローラーに置く）になる。台帳の拡張には該当が無い。

## 影響しうるもの

- 状態表示の左端の「><」（リモートの窓を開く）が消える。コマンドパレットの「Remote-*」「Ports」「Remote Tunnel」の項目が消える。
- `B-2` の `edits.patch` は `contrib/remote/browser/remote.ts` を直している。C-3 は B-2 の後に当たるので、直したファイルを消すだけになる（衝突しない）。B-2 の README の「リモートは C-3 で消える」のとおり。
- 拡張 API の `vscode.env.remoteName` などはローカルでは元から `undefined`。`extensionKind` の上書きの設定 `remote.extensionKind` は登録されなくなり、値は読まれても既定どおりになる。
- 残す部品が、登録の無くなった `remote.*` の設定を読む所（1.146.0 で `grep`。値は `undefined` になる）:
  - `platform/tunnel/common/tunnel.ts` の `remote.localPortHost`: 値が無いときは `127.0.0.1`。既定の `localhost` と同じ結果。
  - `services/remote/common/tunnelModel.ts` の `remote.restoreForwardedPorts`（既定は true だった）・`remote.portsAttributes`・`remote.otherPortsAttributes`: 転送したポートを戻さなくなる。ポートの転送はリモートの窓だけのもの。
  - `contrib/terminalContrib/links` の `remote.forwardOnOpen`: リモートの窓のときだけ読む。
  - `services/extensionManagement/electron-browser/remoteExtensionManagementService.ts` の `remote.downloadExtensionsLocally`: リモートの拡張の導入だけ。
  - `api/browser/mainThreadTunnelService.ts` が `remote.autoForwardPorts`・`remote.autoForwardPortsSource` の既定を上書きする登録: 拡張がポートの候補の出し方を指定したときだけ走る。登録の無いキーの既定を足すだけで、誤りにはならない（見込み。関門の起動で見る）。

## 壊れたときの症状と戻し方

- 起動時に `ITunnelService`・`IRemoteExplorerService` が見つからない誤りが出たら、残すはずの `services/tunnel`・`services/remote` の import の行が消えている。`removeLines` を見直す。
- 共有プロセスの起動の誤り（`remoteTunnel` のチャンネル）が出たら、`sharedProcessMain.ts` の7行のどれかが本家で形を変えた。`removeLines` を合わせる。
- 戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 別案（リーダーの判断を仰ぐ）

1. `remoteExplorerService.ts`・`tunnelModel.ts`・`mainThreadTunnelService.ts` も消す（docs/03 の表のとおり）。そのときは、`extensionService.ts`・`nativeExtensionService.ts` の注入と `setTunnelInformation` の呼び出しを消し、拡張 API の `workspace.openTunnel`・`tunnels`・`onDidChangeTunnels`・`registerTunnelProvider`・`registerPortAttributesProvider` を何もしない実装（`extHostRemovedApi.remote.ts`。docs/03 の5.3）にする。拡張の起動の部品（本家の変更が多い）へのパッチになる。
2. `remote/`・`src/vs/server`・`src/server-*.ts` も消す。依存の導入が軽くなる（メモリには効かない）。ビルドの道具への変更が要る。

## 未確認（型検査とビルドで確かめる）

2026-11-15 に確かめたもの:

- 型検査: 通った（上の「edits.patch で直した点」）。
- `gulpfile.reh.ts` が無くても、gulp のタスクの一覧（`pnpm run gulp --tasks-simple`）に `vscode-win32-x64-min` が残り、`vscode-reh-*` は無くなった。gulpfile の読み込みで誤りは出なかった。
- `build/next/index.ts` には、gulp のタスクではなく、引数で選ぶ束ねの対象 `server`・`server-web` がある（844・845行の使い方の例）。`gulpfile.vscode.ts` の72・73行の `esbuild-vscode-reh-min`・`esbuild-vscode-reh-web-min` はこれを呼ぶタスクで、定義は残る。呼ぶ所は消えた `gulpfile.reh.ts` だけで、`vscode-win32-x64-min` からは呼ばれない。
- ロックファイル: C-3 は依存を消さないので、差分は C-1 の分だけ（`--lockfile-check` は `ok`）。

まだのもの（片づけの許可の後）:

- 依存の導入（`build/npm/postinstall.ts`）が `remote/` を入れ続けること。C-3 は `build/npm/` に触れないので変わらない見込み。
- パッケージ化（`vscode-win32-x64-min`）と起動。起動時の開発者ツールのコンソールに、`ITunnelService`・`IRemoteExplorerService`・`remoteTunnel` のチャンネルの誤りが無いこと。共有プロセスが起動すること。
- Claude Code のパネル（Webview）が開き、ログインの外部 URI（`asExternalUri`）が動くこと。

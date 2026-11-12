# 調査報告: microsoft/vscode 1.146.0 のソースの事実（ダ・ヴィンチ依頼）

調査: 明石元二郎（取得は石光真清。4 班に分けて並行取得）。取得日はすべて 2026-11-12。
対象: タグ `1.146.0`、コミット `69047191fc427f2f92828279aae1d90d8eeda7ab`（軽量タグ、type=commit）[一次] https://api.github.com/repos/microsoft/vscode/git/refs/tags/1.146.0
凡例: [一次]=公式文書・原典。[二次]=記事・ミラー等。「原文で要照合」=要約モデル経由の引用。出典の無い行は書いていない。推測で埋めていない。
注意: 取得役は gh / curl を使えなかった。ディレクトリ一覧（api.github.com/contents）は要約経由で、件数・名前は原文で要照合。`git/trees?recursive=1` は未実施。

---

## 1. ルート product.json（OSS 版）
出典: https://raw.githubusercontent.com/microsoft/vscode/1.146.0/product.json [一次・原文]

- トップレベルのキー（46 個、出現順）: nameShort, nameLong, applicationName, dataFolderName, sharedDataFolderName, win32MutexName, licenseName, licenseUrl, serverLicenseUrl, serverGreeting, serverLicense, serverLicensePrompt, serverApplicationName, serverDataFolderName, tunnelApplicationName, win32DirName, win32NameVersion, win32RegValueName, win32x64AppId, win32arm64AppId, win32x64UserAppId, win32arm64UserAppId, win32AppUserModelId, win32ShellNameShort, win32TunnelServiceMutex, win32TunnelMutex, darwinBundleIdentifier, darwinProfileUUID, darwinProfilePayloadUUID, linuxDesktopName, linuxIconName, licenseFileName, reportIssueUrl, nodejsArtifactFeed, electronArtifactFeed, urlProtocol, agentsTelemetryAppName, webviewContentExternalBaseUrlTemplate, builtInExtensions, defaultChatAgent, trustedExtensionAuthAccess, onboardingKeymaps, onboardingThemes, builtInExtensionsEnabledWithAutoUpdates, sessionsWindowAllowedExtensions, voiceWsUrl
  - 訂正: 初稿は「43 個」と書いていた。並んだキー名を数えると 46 個で、同日に原文を取り直して数えても 46 個だった（取得日 2026-11-12）。
- 名前系の値: nameShort/nameLong = "Code - OSS"、applicationName = "code-oss"、dataFolderName = ".vscode-oss"、urlProtocol = "code-oss"、serverApplicationName = "code-server-oss"、serverDataFolderName = ".vscode-server-oss"、tunnelApplicationName = "code-tunnel-oss"。
- win32 系（12 個）: win32MutexName "vscodeoss" / win32DirName "Microsoft Code OSS" / win32NameVersion "Microsoft Code OSS" / win32RegValueName "CodeOSS" / win32x64AppId・win32arm64AppId・win32x64UserAppId・win32arm64UserAppId（各 GUID。値は上記 URL を参照）/ win32AppUserModelId "Microsoft.CodeOSS" / win32ShellNameShort "C&ode - OSS" / win32TunnelServiceMutex "vscodeoss-tunnelservice" / win32TunnelMutex "vscodeoss-tunnel"。
  - `win32ContextMenu`、`win32VersionedUpdate` は product.json に無い（build 側コードは型キャストで読む）。
- 無いキー: extensionsGallery、aiConfig、ariaKey（テレメトリ鍵）、updateUrl、extensionEnabledApiProposals。
- nodejsArtifactFeed / electronArtifactFeed: どちらも空文字。
- builtInExtensions（3 件。いずれも sha256 と metadata を持つ。取得元は repo の GitHub）:
  - ms-vscode.js-debug-companion 1.1.3（https://github.com/microsoft/vscode-js-debug-companion）
  - ms-vscode.js-debug 1.140.1（https://github.com/microsoft/vscode-js-debug）
  - ms-vscode.vscode-js-profile-table 1.0.11（https://github.com/microsoft/vscode-js-profile-visualizer）
- AI 関係のキー:
  - defaultChatAgent: extensionId "GitHub.copilot"、chatExtensionId "GitHub.copilot-chat"、providerExtensionId "vscode.github-authentication"、entitlementUrl / tokenEntitlementUrl / mcpRegistryDataUrl / mcpConnectorsUrl / managedSettingsUrl（いずれも api.github.com）、chatQuotaExceededContext など。
  - trustedExtensionAuthAccess（GitHub.copilot-chat 等）、builtInExtensionsEnabledWithAutoUpdates ["GitHub.copilot-chat"]、voiceWsUrl（wss://falcon-caas.mai.microsoft.com/...）、agentsTelemetryAppName "agents"、sessionsWindowAllowedExtensions []。
- `portable`、`target` キーも無い（項目 12 参照）。

## 2. Electron の版の決まり方
出典 [一次・原文]: https://raw.githubusercontent.com/microsoft/vscode/1.146.0/package.json 、同 build/lib/electronVersion.ts 、同 build/npm/pnpm/nativeBuildEnv.ts 、同 build/lib/electron.ts

- 決まる場所はルート package.json の `nativeBuild` フィールド: `"runtime": "electron", "target": "43.8.6", "disturl": "https://electronjs.org/headers", "msBuildId": "15893748", "buildFromSource": true`。
- **1.146.0 の Electron は 43.8.6**。
- `.npmrc` はルートも `remote/` も HTTP 404（直接確認）。build/ にも無い（一覧は要約経由で原文で要照合）。nativeBuildEnv.ts のコメントに「npm がルートの `.npmrc` から読んでいた設定を、ルートの `.pnpmfile.mjs` が各 install script に渡す」とある（パッケージマネージャは pnpm）。
- devDependencies に `electron` 本体は無い。`@vscode/gulp-electron ^1.43.0` がある。
- OSS は electronArtifactFeed が空なので、Electron の GitHub release から取得する（build/lib/electron.ts のコメント）。検証は build/checksums/electron.txt。

## 3. 組み込み拡張がビルドに入る仕組み
出典 [一次・原文]（URL は commit 固定）: https://raw.githubusercontent.com/microsoft/vscode/69047191fc427f2f92828279aae1d90d8eeda7ab/ に続けて build/npm/dirs.ts 、build/gulpfile.extensions.ts 、build/lib/extensions.ts 、build/lib/builtInExtensions.ts 、extensions/pnpm-workspace.yaml 、extensions/tsconfig.base.json

- **dirs**: `build/npm/dirs.ts`（TypeScript。dirs.js は無い）。export は workspaceMembers / separateRoots / separateRootMembers / standaloneRoots / distroRoots / dirs。
  - `separateRoots = ['build', 'remote', 'extensions', 'extensions/copilot']`。
  - 拡張の一覧は `separateRootMembers` の `'extensions': [...]` に直書き（38 件。configuration-editing、css/html/json-language-features（+/server）、git、git-base、github、github-authentication、ipynb、markdown-language-features（+サブ）、microsoft-authentication、npm、typescript-language-features、vscode-api-tests、vscode-test-resolver など）。この一覧が「依存を持つ拡張だけ」か全拡張かは未確認。
  - `'extensions/copilot': ['extensions/copilot/chat-lib']` は別ルート。
  - 同じ一覧が `extensions/pnpm-workspace.yaml` の `packages:` にも直書き（copilot を除く）。
- **コンパイル（build/gulpfile.extensions.ts）**: tsconfig のパスを直書きした配列 `compilations`（約 40 件）。glob 走査は使わず一覧で持つ（コメント「To save 250ms for each gulp startup, we are caching the result here」）。extensions/copilot は配列に無い。web 向けのみ `extensions/**/esbuild.browser.mts` を glob で探す。
- **同梱（build/lib/extensions.ts）**: 走査と一覧の併用。`glob.sync('extensions/*/package.json')` で拾い、名前の一覧で振り分ける。
  - `nativeExtensions = ['git', 'microsoft-authentication']`
  - `excludedExtensions = ['copilot', 'vscode-api-tests', 'vscode-colorize-tests', 'vscode-colorize-perf-tests', 'vscode-test-resolver', 'ms-vscode.node-debug', 'ms-vscode.node-debug2']`
  - `marketplaceWebExtensionsExclude`（5 件）、`packagedDependenciesByExtension = { 'git': ['@vscode/fs-copyfile'] }`
  - product.json の builtInExtensions に載る名前は除外（`builtInExtensions.every(b => b.name !== name)`）。
  - packageCopilotExtensionStream は `extensions/copilot` を直接扱う。
- **builtInExtensions の取得（build/lib/builtInExtensions.ts）**: product.json の `builtInExtensions` / `webBuiltInExtensions` を読み、次の順で取得する。(1) `extension.vsix`（ローカル VSIX）→ (2) `platformSpecific` なら GitHub release → (3) `productjson.extensionsGallery?.serviceUrl` があれば Marketplace → (4) 無ければ GitHub。保存先 `.build/builtInExtensions/<name>`。制御ファイル `~/.vscode-oss-dev/extensions/control.json`。1.146.0 は extensionsGallery が無いので GitHub になる。
- **extensions/ のフォルダを 1 つ消したときの直し先**
  - 確認済み: build/npm/dirs.ts の separateRootMembers['extensions']、extensions/pnpm-workspace.yaml の packages、build/gulpfile.extensions.ts の compilations（該当 tsconfig の行）、build/lib/extensions.ts の上記 4 つの一覧（名前が一致する場合のみ）、product.json の builtInExtensions（名前が載る場合のみ）。
  - 要約経由・原文で要照合: eslint.config.js（'extensions/git/src/**/*.ts'、'extensions/copilot/**/*' 等のパスが並ぶ）、build/lib/copilot.ts（extensions/copilot を直接参照）。
  - 確認した範囲では: ルート tsconfig.json は無い（404）。extensions/tsconfig.base.json は compilerOptions のみで、参照の一覧を持たない。
  - **未確認**: extensions/pnpm-lock.yaml、build/lib/i18n.resources.json、cgmanifest.json / cglicenses.json / ThirdPartyNotices.txt の中身、.vscode/ の中身、.vscode-test.js とテスト設定の中身（存在のみ確認）。全リポジトリの grep は未実施。

## 4. Windows 向けパッケージの gulp タスク
出典 [一次・原文]: https://raw.githubusercontent.com/microsoft/vscode/1.146.0/build/gulpfile.vscode.ts 、同 build/gulpfile.vscode.win32.ts

- `build/gulpfile.vscode.js` は 404。TS 版のみ。ルートの gulp エントリは gulpfile.mjs。
- タスク名は `vscode${dashed(platform)}${dashed(arch)}${dashed(minified)}[-ci]` で組み立てる。win32 x64 は **`vscode-win32-x64`、`vscode-win32-x64-min`、`vscode-win32-x64-ci`、`vscode-win32-x64-min-ci`**。ほかに `esbuild-bundle-win32-x64[-min]`、`package-win32-x64`。ホストが win32/x64 のときは別名 `vscode` / `vscode-min` も登録。
- **zip（archive）を作る gulp タスクは、この 2 ファイルには無い**。`archive` はコメント内に 1 回、`zip` は 0 回。ビルド全体（build/azure-pipelines 等）での zip 作成の有無は**未確認**。
- インストーラ（Inno Setup）: `vscode-win32-{x64,arm64}-{system,user}-setup`、`vscode-win32-{x64,arm64}-inno-updater`。定義ファイルは build/win32/code.iss。
- 出力先: `../VSCode-win32-x64`（リポジトリの親ディレクトリ直下。`path.join(path.dirname(root), 'VSCode-win32-x64')`）。入力は `out-vscode`（min は `out-vscode-min`）。setup の作業先は `.build/win32-x64/{system,user}-setup`。

## 5. workbench.common.main.ts / workbench.desktop.main.ts の import（C=common、D=desktop）
出典 [一次・原文]: https://raw.githubusercontent.com/microsoft/vscode/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/workbench/workbench.common.main.ts 、同 workbench.desktop.main.ts 。行番号は**未確認**。D は先頭で `./workbench.common.main.js` を読む。パスは `src/vs/workbench/` からの相対。

- chat
  - C: `./contrib/chat/browser/chat.shared.contribution.js`、`./contrib/chat/browser/chat.contribution.js`、`./contrib/chat/browser/agentSessions/agentHost/agentHost.contribution.js`、`./contrib/chat/browser/remoteAgentHost/remoteAgentHost.contribution.js`、`./contrib/chat/browser/chat.view.contribution.js`、`./contrib/chat/browser/chatSessions/chatSessions.contribution.js`、`./contrib/chat/browser/contextContrib/chatContext.contribution.js`、`./contrib/chat/browser/onboarding/modelPickerTryout.contribution.js`、`./contrib/chat/browser/onboarding/chatInputSpotlightTour.js`、`./services/chat/common/chatEntitlementService.js`
  - D: `./contrib/chat/electron-browser/chat.contribution.js`、`./contrib/chat/electron-browser/tunnelHost.contribution.js`
- inlineChat: C `./contrib/inlineChat/browser/inlineChat.contribution.js`。D なし。
- mcp
  - C: `./contrib/mcp/browser/mcp.contribution.js`、`./contrib/mcp/browser/mcp.view.contribution.js`、`../platform/mcp/common/mcpResourceScannerService.js`、`../platform/mcp/common/mcpManagement.js`（McpGalleryService / AllowedMcpServersService 経由）、`./services/authentication/browser/authenticationMcp*.js`（複数）、`../platform/agentHost/common/agentHostMcpOAuthMetadataService.js`
  - D: `./contrib/mcp/electron-browser/mcp.contribution.js`、`./services/mcp/electron-browser/mcpGalleryManifestService.js`、`./services/mcp/electron-browser/mcpWorkbenchManagementService.js`、`../platform/agentHost/electron-browser/agentHostMcpOAuthMetadataService.js`
- 言語モデル・エージェント関係（languageModels そのものの import 行はどちらにも見当たらない）
  - C: `./services/agentHost/common/agentHostResourceService.js`、`../platform/agentHost/browser/agentHostConnectionsService.js`、`./contrib/agentsVoice/browser/agentsVoice.contribution.js`
  - D: `./services/agentHost/electron-browser/agentHostService.js`、`../platform/agentHost/electron-browser/remoteAgentHostService.js`、`../platform/agentHost/browser/agentHostEnablementService.js`、`./contrib/agentsVoice/electron-browser/agentsVoiceNativeCommands.js`
- debug: C `./contrib/debug/browser/debug.contribution.js`、`debugEditorContribution.js`、`breakpointEditorContribution.js`、`callStackEditorContribution.js`、`repl.js`、`debugViewlet.js`（いずれも `./contrib/debug/browser/`）。D `./contrib/debug/electron-browser/extensionHostDebugService.js`。
- notebook: C `./contrib/notebook/browser/notebook.contribution.js`、`./services/notebook/common/notebookDocumentService.js`、`./contrib/replNotebook/browser/repl.contribution.js`。D なし。
- remote・remoteTunnel
  - C: `./contrib/remote/common/remote.contribution.js`、`./contrib/remote/browser/remote.contribution.js`、`./services/remote/common/remoteExplorerService.js`、`./services/remote/common/remoteExtensionsScanner.js`
  - D: `./contrib/remote/electron-browser/remote.contribution.js`、`./services/tunnel/electron-browser/tunnelService.js`、`../platform/remote/electron-browser/sharedProcessTunnelService.js`、`../platform/remoteTunnel/electron-browser/remoteTunnelService.js`、`./contrib/remoteTunnel/electron-browser/remoteTunnel.contribution.js`
- userDataSync
  - C: `./services/userDataSync/common/userDataSyncUtil.js`、`./services/userDataSync/browser/userDataSyncWorkbenchService.js`、`./contrib/userDataSync/browser/userDataSync.contribution.js`
  - D: `./services/userDataSync/electron-browser/userDataSyncService.js`、`./services/userDataSync/electron-browser/userDataAutoSyncService.js`、`./services/userDataSync/browser/userDataSyncEnablementService.js`、`./contrib/userDataSync/electron-browser/userDataSync.contribution.js`
- extensions（ビュー・ギャラリー）
  - C: `./contrib/extensions/browser/extensions.contribution.js`、`./contrib/extensions/browser/extensionsViewlet.js`、`./services/extensionManagement/common/extensionGalleryService.js`、`./services/extensionManagement/browser/extensionEnablementService.js`、`./services/extensionManagement/browser/builtinExtensionsScannerService.js`、`./services/extensionRecommendations/common/extensionIgnoredRecommendationsService.js`、`./services/extensionRecommendations/common/workspaceExtensionsConfig.js`、`./services/extensions/common/extensionManifestPropertiesService.js`
  - D: `./contrib/extensions/electron-browser/extensions.contribution.js`、`./contrib/extensions/electron-browser/devtoolsExtensionHost.contribution.js`、`./services/extensionManagement/electron-browser/extensionGalleryManifestService.js`、`./services/extensionManagement/electron-browser/extensionGalleryAccountService.js`、`./services/extensionManagement/electron-browser/extensionTipsService.js`、`./services/extensions/electron-browser/extensionsScannerService.js`
- telemetry
  - C: `./contrib/telemetry/browser/telemetry.contribution.js`、`./services/policies/browser/policyTelemetry.contribution.js`、`./contrib/editTelemetry/browser/editTelemetry.contribution.js`、`./contrib/bracketPairColorizer2Telemetry/browser/bracketPairColorizer2Telemetry.contribution.js`
  - D: `./services/telemetry/electron-browser/telemetryService.js`、`../platform/telemetry/electron-browser/customEndpointTelemetryService.js`
- welcome / gettingStarted / walkthrough
  - C: `./contrib/welcomeGettingStarted/browser/gettingStarted.contribution.js`、`./contrib/welcomeWalkthrough/browser/walkThrough.contribution.js`、`./contrib/welcomeViews/common/viewsWelcome.contribution.js`、`./contrib/welcomeViews/common/newFile.contribution.js`、`./contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.js`、`./contrib/onboarding/browser/onboarding.contribution.js`
  - D: `./contrib/onboarding/electron-browser/onboardingTryout.contribution.js`
- surveys: C `./contrib/surveys/browser/nps.contribution.js`、`./contrib/surveys/browser/languageSurveys.contribution.js`。D `./contrib/surveys/browser/survey.contribution.js`。
- issue: C なし。D `./contrib/issue/electron-browser/issue.contribution.js`。
- outline: C `./services/outline/browser/outlineService.js`、`./contrib/codeEditor/browser/outline/documentSymbolsOutline.js`、`./contrib/outline/browser/outline.contribution.js`。D なし。
- breadcrumbs: 両ファイルに import 行なし（他ファイルは未確認）。
- themes: C `./services/themes/browser/workbenchThemeService.js`、`./contrib/themes/browser/themes.contribution.js`。D `./contrib/themes/browser/themes.test.contribution.js`、`./services/themes/electron-browser/themes.contribution.js`、`./services/themes/electron-browser/nativeHostColorSchemeService.js`。
- testing: C `./contrib/testing/browser/testing.contribution.js`。D なし。
- comments: C `./contrib/comments/browser/comments.contribution.js`。D なし。
- interactive: C `./contrib/interactive/browser/interactive.contribution.js`。D なし。
- share: C `./contrib/share/browser/share.contribution.js`。D なし。
- accounts: C `./services/accounts/browser/defaultAccount.js`（authentication 系は多数あり、全列挙はしていない）。D なし。
- D 固有の本体: `./electron-browser/desktop.main.js`、`./electron-browser/desktop.contribution.js`。

## 6. src/vs/workbench/api/ の mainThread（chat・言語モデル・mcp）
出典 [一次・原文]: https://raw.githubusercontent.com/microsoft/vscode/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/workbench/api/browser/<各ファイル>。api/browser(103)・api/common(約122)・api/node(20) の一覧は要約経由で原文で要照合。

すべて `api/browser/`。contrib への import を各ファイルの import 節で確認:
- mainThreadChatAgents2.ts: contrib/chat を多数 import（chat.js、agentSessions、chatDynamicVariables、chatAgents、promptsService、chatModel、chatService、languageModelToolsService など）。
- mainThreadChatSessions.ts: contrib/chat を import（agentSessionsModel、chatSessionCommit、chatSessions.contribution、chatSessionsService）。
- mainThreadLanguageModels.ts: contrib/chat を import（chatImageUtils、ignoredFiles、languageModels）。
- mainThreadLanguageModelTools.ts: contrib/chat を import（languageModelToolsContribution、languageModelToolsService）。
- mainThreadMcp.ts: contrib/**mcp** を import（mcpGatewayService、mcpRegistryTypes、mcpTypes、mcpConfiguration、modelContextProtocol）。platform/mcp も import。
- mainThreadChatContext.ts / mainThreadChatDebug.ts / mainThreadChatStatus.ts / mainThreadChatInputNotification.ts / mainThreadChatOutputRenderer.ts / mainThreadChatCodeMapper.ts: いずれも contrib/chat を import（ChatOutputRenderer は加えて mainThreadWebviews）。
- mainThreadChatQuota.ts: contrib/chat の直接 import なし（services/chat/common/chatEntitlementService.js を使う）。
- mainThreadChatArtifactIntegrations.ts: contrib/chat の直接 import なし（platform/artifactIntegrations を使う）。
- 未確認: mainThreadAgentEditorComments.ts など上記以外。
- extHost.api.impl.ts（api/common）: contrib の import は debug（DebugConfigurationProviderTriggerKind）と contrib/chat の promptTypes（PromptsType）の 2 行。extHost 側の chat・LM・mcp（extHostChatAgents2、extHostLanguageModels、extHostMcp、extHostLanguageModelTools ほか）は import している。本文 135,228 字のうち前半 100,000 字のみ要約経由で読了、後半は未確認。ExtHost* ファイルの import 先は未確認。

## 7. テレメトリ送信部品
出典 [一次]: https://api.github.com/repos/microsoft/vscode/contents/src/vs/platform/telemetry?ref=1.146.0 （一覧）、raw の各 1dsAppender.ts（本文。一部要約経由で要照合）

- `src/vs/platform/telemetry/` のサブフォルダ: browser, common, electron-browser, electron-main, node, test。
- appender 系 3 ファイル:
  - `common/1dsAppender.ts`: 基底 `AbstractOneDataSystemAppender`。`@microsoft/1ds-core-js` / `@microsoft/1ds-post-js` を import。送信先 `https://mobile.events.data.microsoft.com/OneCollector/1.0`（原文で要照合）。
  - `browser/1dsAppender.ts`: `OneDataSystemWebAppender`（Web 用）。
  - `node/1dsAppender.ts`: `OneDataSystemAppender`（IRequestService または https で POST）。
- 他: common/telemetryService.ts、telemetryLogAppender.ts、node/customEndpointTelemetryService.ts、electron-browser/customEndpointTelemetryService.ts、各 errorTelemetry.ts など。これらの役割は本文を読んでおらず未確認。
- **VSCodium `patches/00-telemetry-disable.patch`** [一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/patches/00-telemetry-disable.patch が触るのは 6 ファイル。すべて設定の既定値を true/ON → false/OFF に変えるだけで、送信コードは消していない。
  1. src/vs/platform/telemetry/common/telemetryService.ts（`TelemetryConfiguration.ON`→`OFF`、`default: true`→`false`）
  2. src/vs/workbench/browser/workbench.contribution.ts（enableNaturalLanguageSearch）
  3. src/vs/workbench/contrib/editTelemetry/browser/editTelemetry.contribution.ts
  4. src/vs/workbench/contrib/preferences/common/preferencesContribution.ts（enableNaturalLanguageSettingsSearch）
  5. src/vs/workbench/electron-browser/desktop.contribution.ts（telemetry.enableCrashReporting）
  6. src/vs/workbench/services/assignment/common/assignmentService.ts（workbench.enableExperiments）
  - 設定キー名は原文の行との照合が未確認。
  - 版の注意: VSCodium の patches は 1.143.1 向けに更新されたもの（`feat(1.143.1): update patches (#3084)`、2026-10-24）。本家 1.146.0 との行の一致は保証されない。

## 8. VSCodium の Copilot / AI SDK 除去
出典 [一次]: https://raw.githubusercontent.com/VSCodium/vscodium/master/patches/52-ext-copilot-remove-it.json 、同 53-ext-copilot-remove-it.patch 、https://api.github.com/repos/VSCodium/vscodium/commits/33b0b0e96bc70e2deb8a9a63f9c5f3f8ab363357 、prepare_vscode.sh 、utils.sh

- **52 の JSON**: 配列 1 要素。`action: "remove"`、`paths` は 125 件の削除パス。`extensions/copilot`、`src/vs/platform/agentHost/node/{codex,otel,copilot/,claude/}`、`agentHostCommitOperation*.ts`、`agentHostGitHubTelemetryRouter.ts`、`shared/copilotApiService.ts`、`shared/copilotSkuTelemetry.ts`、関連のテスト・fixture・sessions 配下など。125 件を 1 件ずつ原文で確かめてはいない。
- **53 の patch**（約 215,000 字、29 ファイルまで確認。取りこぼしの有無は未確認）: build/gulpfile.reh.ts と build/gulpfile.vscode.ts（Copilot 拡張の build タスクを削除）、build/npm/dirs.ts（`extensions/copilot` を削除）、build/npm/postinstall.ts（`.claude/` symlink を削除）、package.json / package-lock.json / remote/package.json / remote/package-lock.json（`@github/copilot-sdk`、`@anthropic-ai/claude-agent-sdk`、`@openai/codex`、`@vscode/copilot-api` などの依存を削除）、agentHostMain.ts（Copilot/Claude/Codex の agent 登録を削除、`providerConfigurations` を `[]`）、agentHostServerMain.ts、agentHostServices.ts、agentService.ts、agentServiceComposition.ts、protocolServerHandler.ts、githubMcpServer.ts、dialog.ts、product.ts ほか。
- **「fix: remove ai sdks (#3060)」**: SHA `33b0b0e96bc70e2deb8a9a63f9c5f3f8ab363357`、2026-10-11T13:53:42Z。変更は `patches/53-ext-copilot-remove-it.patch` の 1 ファイルのみ（+660/-35）。**52 の JSON はこのコミットでは変わっていない**（52 の履歴: 2026-07-02、08-27、10-06、10-24）。つまりこのコミットは「patch 53 に AI SDK の依存と参照の除去を追加」したもの。
  - 2026-11-12 の再取得でも author / committer の日時はどちらも 2026-10-11T13:53:42Z（commit.message "fix: remove ai sdks (#3060)"）。fork-base-research.md の 2.1 節にある「2026-10-13」は、二次記事（linuxcompatible.org）の公開日時 "Published 2026-10-13 20:00" で、コミット日ではない。
- **消し方の仕組み**: prepare_vscode.sh が `patches/*.json` を先に `apply_actions` で処理し、続いて `patches/*.patch` を `apply_patch`（`git apply --ignore-whitespace`）で処理する。`apply_actions()` は `jq -r '.paths[]'` で読み、`rm -rf -- "<path>"` で消す。
- 二次情報 [二次] https://www.warp2search.net/story/vscodium-114006880-removes-copilot-claude-and-codex-ai-sdks/ は「1.140.06880 で Copilot / Claude / Codex SDK を削除」と報じる。一次と矛盾しない。同記事の「Claude / Codex / BYOK は動く」という記述は patch 53 の `providerConfigurations` を `[]` にする変更と合わない可能性があり、**未確認**。
- 「fix: copilot removal」のコミットはコミット検索（"copilot removal"）で 0 件。未確認。
- 取得時点の VSCodium の先頭コミット: `ca7f7b44b5e5`、2026-10-27、「fix: replace removed variable with correct variable (#3094)」（master HEAD との一致は未確認）。
- **ライセンス**: MIT（Copyright 2018-present The VSCodium contributors / Peter Squicciarini、2015-present Microsoft Corporation）[一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/LICENSE

## 9. 設定 extensions.allowed
出典 [一次・原文] https://code.visualstudio.com/docs/enterprise/extensions （ページ日付 11/11/2026）、[一次・要約経由・原文で要照合] https://code.visualstudio.com/updates/v1_96 、https://code.visualstudio.com/docs/enterprise/policies

- 導入: **1.96**。原文「Support for allowed extensions is available starting from VS Code version 1.96.」
- 範囲: 「application-wide な `extensions.allowed` で、ユーザーがインストール・有効化できる拡張を制御。publisher・拡張 ID・版・プラットフォームで許可／禁止できる」。既定は全許可。許可リストを使うと不一致は禁止。すでに入っている拡張を禁止すると無効化される。
- 書式（原文の例）:
  - publisher: ピリオドなしのキー `"microsoft": true`
  - 拡張 ID: `"esbenp.prettier-vscode": true`、`"ms-azuretools.vscode-containers": false`
  - **版の指定ができる**: 配列で列挙。`"dbaeumer.vscode-eslint": ["3.0.0"]`。原文「Version ranges are not supported, so you must list each version individually.」
  - プラットフォーム: `"rust-lang.rust-analyzer": ["5.0.0@win32-x64", "5.0.0@darwin-x64"]`（例にあるのは win32-x64 と darwin-x64。ほかの一覧は未確認）
  - `"stable"`（正式版のみ許可）、`"*": false`（全禁止）。より具体的な指定が優先。ワイルドカードは `"*"` のみ。キーの重複不可。
- **VSIX の手動インストール**: 原文「For locally supplied VSIX packages, these rules use identifiers declared in the package. They do not verify the package's origin, prevent changes to local extension files, or limit an extension's runtime permissions.」→ パッケージ内で宣言された ID で判定される。出所は検証しない。
- **CLI `--install-extension` への効き方: 未確認**（公式ページに CLI の言及なし。ソースの実装箇所も見つからず）。
- 設定かポリシーか: 設定として使える。管理者向けには `AllowedExtensions` ポリシーがあり、原文「This overrides any user-configured extensions.allowed」。ポリシーの構文エラー時は設定が適用されない。Windows のレジストリの場所等は要約経由で原文で要照合（本文では取れていない）。

## 10. test/smoke を自分のビルドに向ける
出典 [一次・原文] https://raw.githubusercontent.com/microsoft/vscode/main/test/smoke/README.md （main ブランチ。タグ 1.146.0 版との差は未確認）

- 開発版: `pnpm install && pnpm run compile` のあと `pnpm run smoketest`。
- ビルド済みに向ける: `pnpm run smoketest --build <path to latest version>`（例は macOS の .app のパスのみ。**Windows の例は無い**）。Web: `--build <path to server web build (ends in -web)> --web --browser [chromium|webkit]`。リモート: `--remote`。
- 注記: 「OSS が `.build/electron` に無い場合のみ、`--build` 無しの手順で必要」。「テストするリリースと一致する版の smoketest を使うこと」。
- README は "Make sure you are on Node v12.x" と書くが古い可能性あり（現行の要求は package.json で未確認）。
- Windows の注意: `C:\Users\<username>\AppData\Local\Temp\t` が存在すると `tmp` モジュールが動かず失敗する。その場合はフォルダ `t` を削除。

## 11. vscode-loc
- 最新コミット: 2026-10-19「Bump actions/upload-artifact (#2440)」（dependabot）。その前は 2026-09-04「Updated strings from microsoft/vscode-loc-drop@916f5bf…（#2391）」[一次・原文] https://github.com/microsoft/vscode-loc/commits/main
- README [一次・原文] https://raw.githubusercontent.com/microsoft/vscode-loc/main/README.md : 14 言語対応、日本語は ja (ja-jp)。文字列は Microsoft が管理・エクスポート。**版の付け方（どの本家の版に対応するか）の記述は無い。未確認**。
- 文字列更新コミットは「Updated strings from microsoft/vscode-loc-drop@<hash>」形式。hash と VS Code の版の対応は未確認。タグ・他ブランチも未確認。`microsoft/vscode-language-pack-ja` は 404。
- 日本語パックの版: Marketplace では版を取得できず**未確認**。[一次・Open VSX の API。Open VSX に載っている版についての事実で、本家の最新版との差の根拠としては二次] https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-ja/latest は version 1.131.0（2026-07-28）、allVersions は 1.96.0〜1.131.0 で、版番号は VS Code の版番号と一致する。本家は 1.146.0 なので、1.132〜1.146 が無いのがミラーの遅れによるものかは未確認。

## 12. ポータブルモード
- 公式 docs [一次・原文] https://code.visualstudio.com/docs/editor/portable （転送先 /docs/setup/portable）: 「ZIP ダウンロード（Windows）、TAR.GZ（Linux）、通常のアプリ（macOS）で対応」。「Windows の User / System インストーラのインストールでは設定しないこと。ポータブルは Windows ZIP のみ対応。ZIP は自動更新に対応しない」。ZIP を展開して VS Code のフォルダ内に `data` フォルダを作る。「data フォルダは `--user-data-dir` と `--extensions-dir` を上書きする」。空の `tmp` があれば TMP にも使う。docs は Code-OSS を名指しで扱っていない。
- ソース 1.146.0 [一次・原文]: `src/bootstrap-node.ts` の `configurePortable` が、`VSCODE_PORTABLE` が無ければ Windows/Linux で `path.join(getApplicationPath(), 'data')` を見る。`isPortable = !('target' in product) && fs.existsSync(portableDataPath)`。OSS の product.json には `target` も `portable` も `win32VersionedUpdate` も無いため、**Windows の OSS ビルドでも実行ファイルの隣に `data` があればポータブルになる**（ソースの読み。実機検証はしていない）。`src/vs/platform/environment/node/userDataPath.ts` は `VSCODE_PORTABLE` があれば `<VSCODE_PORTABLE>/user-data` を返し、`--user-data-dir` より先に判定する。
- 未確認: `--extensions-dir` との優先のソース、`configurePortable` の呼び出し元。

## 13. SecretStorage
出典 [一次・原文] （1.146.0）: src/vs/platform/encryption/electron-main/encryptionMainService.ts 、src/vs/platform/encryption/common/encryptionService.ts 、src/vs/platform/secrets/common/secrets.ts 、src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts 、src/vs/workbench/api/common/extHostSecrets.ts 、src/vs/platform/storage/electron-main/storageMain.ts （いずれも https://raw.githubusercontent.com/microsoft/vscode/1.146.0/ 配下）。Electron 公式 https://www.electronjs.org/docs/latest/api/safe-storage [一次・要約経由・原文で要照合]。

- 暗号化: encryptionMainService が Electron の `safeStorage`（`encryptString` / `decryptString`）を使う。Windows の KnownStorageProvider は `dplib = 'dpapi'`。Electron 公式は鍵が DPAPI で生成・保護されると記す（要約経由）。Windows で平文暗号化へ切り替える `setUsePlainTextEncryption` は「Windows では未対応」で例外。
- 論理層: キーは接頭辞 `secret://`。値は暗号化してから `StorageScope.APPLICATION` / `StorageTarget.MACHINE` で保存。暗号化が使えないときは in-memory（永続化されず、暗号化もしない）になり、通知が出る。
- 保存先ファイル: `state.vscdb`（SQLite）。ApplicationStorageMain は defaultProfile の `globalStorageHome` 直下を使う。`globalStorageHome` の Windows 上の実パスは**未確認**。
- OSS ビルドでも同じ経路か: 1.146.0 の取得範囲では OSS 専用の分岐は見当たらず、product.json に暗号化関係のキーも無い。ただし全ソースを調べたものではない。
- 未確認: 公式 API 参照（vscode.d.ts）の SecretStorage 説明の原文、ExtHostSecretState のキー組み立て、Credential Manager への言及（Electron 公式の取得範囲では見つからず）。
- 共有鍵: Windows のみ `CROSS_APP_SHARED_SECRET_KEYS`（vscode.github-authentication の github.auth）が APPLICATION_SHARED で扱われる。

---

## 見つからなかった・未確認の一覧（再掲）
- 4: zip（archive）を作る gulp タスク（2 ファイルには無し。ビルド全体は未確認）
- 3: extensions 削除時の pnpm-lock.yaml、i18n.resources.json、cgmanifest 等、.vscode/、テスト設定の中身。全体 grep 未実施
- 5: 行番号。breadcrumbs の import
- 6: 上記以外の mainThread ファイル、extHost.api.impl.ts の後半
- 7: telemetry 各ファイルの役割（1dsAppender 以外）、patch 00 の設定キー名の照合
- 8: 「fix: copilot removal」、patch 53 の全ファイル網羅、52 の 125 件の 1 件ずつの照合、Claude/Codex が動くかの記述の真偽
- 9: `--install-extension` への効き方
- 10: Windows の `--build` 例、現行の Node 要求
- 11: 言語パックの版の付け方、Marketplace の現行版
- 12: `--extensions-dir` の優先、実機検証
- 13: 公式 API 参照の原文、globalStorageHome の実パス

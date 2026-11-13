# C-1-ai 本家の AI

裁定（2026-11-12）: 本家の AI は消す。ただし Claude Code 拡張が依存する部分があれば特定して残す。拡張 API の入口（`vscode.lm`・`vscode.chat` など）は何もしない実装にして残し、中身のコードは消す。

状態: **下準備**（2026-11-14）。`unit.json` の ops（`delete`・`removeDependencies`・`removeLines`・`productRemove`）だけを作った。`edits.patch` は型検査が走るようになってから作る。それまで `unit.json` に `patch` のキーを書かない（docs/03 の3.1「無ければ書かない」。C-3〜C-7 と同じ形）。`edits.patch` を作ったときに `"patch": "edits.patch"` を足す。

## 消すもの

本家 1.146.0 で確かめた所在。docs/03 の表に無いものは「足した」と書いた。

- チャット・インラインチャット・MCP・音声のチャット: `contrib/chat`、`contrib/inlineChat`、`contrib/mcp`、`contrib/agentsVoice`
- エージェントのホスト（Copilot・Claude・Codex の SDK を動かす別プロセス）: `platform/agentHost`、`services/agentHost`。サーバー側の `server/node/agentHostChannel.ts`・`serverAgentHostManager.ts`（足した）
- MCP の基盤: `platform/mcp`、`services/mcp`、`services/authentication/browser/authenticationMcp{Usage,Access,}Service.ts` とそのテスト2つ
- **足した**: Agents の窓（`src/vs/sessions`。別の入口 `sessions.desktop.main`・`electron-browser/sessions.html` を持つ窓）と、本体側のエージェントのセッションの部品（`contrib/sessions`、`contrib/sessionChanges`、`services/sessions`、`browser/parts/sessions`）、チャットの窓（`contrib/chatWindow`）、エージェントのキャンバス（`contrib/canvases`）、リモートのコーディングエージェント（`contrib/remoteCodingAgents`）、ターミナルのチャット（`terminalContrib/chat`・`chatAgentTools`、`terminal/browser/agentHost*.ts`・`chatTerminalCommandMirror.ts`・`ahpTerminalCommandSource.ts`、`terminal/terminalContribChatExports.ts`）、ノートブックのチャット（`notebook/browser/controller/chat`・`contrib/chat`・`view/cellParts/chat`）、口述（チャットの音声認識に乗る `codeEditor/browser/dictation`・`terminalContrib/voice`、端末内の認識 `platform/localTranscription`・`services/localTranscription`）、エージェントのプラグイン（`platform/agentPlugins`）、MCP などのカスタマイズの市場（`platform/customizationMarketplace`）
- **AI の検索**（足した。2026-11-14 リーダーの判断）: `contrib/search/browser/AISearch`（`aiSearchModel.ts`・`aiSearchModelBase.ts`。提案中の API `aiTextSearchProvider` の結果を検索のビューに「AI の結果」として出す部品）。検索そのもの（裁定で残す）は消さない。AI の結果を出す操作（`search.action.showAIResults`・`hideAIResults`）と設定 `search.searchView.semanticSearchBehavior`・`keywordSuggestions` は、残る検索のファイルの中にあるので型検査で消す（下の表の5）。import は検索の中のファイルからだけで、1行の一覧の要素ではないので `removeLines` は無い
- 残る部品の中のチャット専用のファイル（足した）: `search/browser/searchChatContext.ts`、`scm/browser/scmHistoryChatContext.ts`、`markers/browser/markersChatContext.ts`、`debug/browser/debugChatIntegration.ts`、`extensions/common/{search,install}ExtensionsTool.ts`、`browserView/electron-browser/tools`・`features/browserEditorChatFeatures.ts`、`testing/common/testingChatAgentTool.ts`
- 拡張 API の実装: main thread 側 `api/browser/mainThread{AgentEditorComments,Chat*,LanguageModels,LanguageModelTools,Mcp}.ts`（14ファイル）、extHost 側 `api/common/extHost{AgentEditorComments,Chat*,CodeMapper,LanguageModels,LanguageModelTools,Mcp}.ts`（14ファイル）、`api/node/extHostMcpNode.ts`
- 消した部品だけを見るテストと部品の見本（`api/test` の12、ターミナル・テスト・拡張・デバッグ・ブラウザーのツールのテスト、`componentFixtures/{chat,sessions,agentsVoice}` など）。`src/typings/copilot-api.d.ts`
- 依存（`removeDependencies`）: ルートの `@anthropic-ai/sdk`・`@github/copilot-sdk`・`@vscode/copilot-api`・`foundry-local-sdk`・`@anthropic-ai/claude-agent-sdk`・`@openai/codex`・`@modelcontextprotocol/sdk`、`remote/package.json` の `@github/copilot-sdk`・`@vscode/copilot-api`。どれも src の中では消すフォルダ（`platform/agentHost`・`platform/localTranscription`）だけが import している（`grep` で確かめた）
- 一覧の行（`removeLines`）: `workbench.common.main.ts` 27行、`workbench.desktop.main.ts` 13行、`workbench.web.main.ts` 14行、`terminal.all.ts` 3行、`codeEditor.contribution.ts`・`notebook.contribution.ts`・`browserView.contribution.ts` 各1行、`api/browser/extensionHost.contribution.ts` 14行、`extHost.common.services.ts` 4行、`extHost.node.services.ts` 3行、ビルドの入口（`build/next/index.ts` の Agents の窓・エージェントのホスト・端末内の認識の入口。同じ行が2か所にあるものは `count: 2`）、`build/gulpfile.vscode.ts` の Agents の窓の4ファイル、`build/npm/dirs.ts`・`pnpm-workspace.yaml` の `src/vs/sessions/test/e2e`
- product.json（`productRemove`）: `defaultChatAgent`・`trustedExtensionAuthAccess`・`builtInExtensionsEnabledWithAutoUpdates`・`sessionsWindowAllowedExtensions`・`voiceWsUrl`・`agentsTelemetryAppName`（6つとも 1.146.0 の OSS の product.json にある）

## 残すもの

- `services/chat`（中身は `chatEntitlementService.ts` だけ）: サービスの ID `IChatEntitlementService` を、拡張の有効・無効（`services/extensionManagement/browser/extensionEnablementService.ts` 38行）をはじめ約12の残る部品が注入している。B-2 の実験のサービスと同じ形で、`edits.patch` で新しいファイル `services/chat/common/nullChatEntitlementService.ts` に「契約なし・AI 無効」を返す実装を置き、`chatEntitlementService.ts` の末尾の `registerSingleton` の1行をこちらに替える。Copilot の契約の確認の通信が無くなる。
- `platform/chat`: AI を止める設定の ID などの定数と、Agents の窓の招待の型。`layout.ts`・`commandCenterControl.ts`・`platform/native` などが import する。AI の部品は無い。
- `contrib/onboarding`（B-2 で残したもの）、`contrib/speech`・`common/agentsColors.ts`・`contrib/imageCarousel`（残る部品が使う。下の「決まったこと」の3）、`contrib/comments`（Claude Code が使う）。
- 下の「決まったこと」の3の規則で、`common/agentsSizes.ts`・`platform/artifactIntegrations`・`platform/otel` と依存 `@modelcontextprotocol/sdk` は消す側に移した。
- Claude Code が使う受け手（docs/03 の9節、`records/phase0/claude-code-manifest.md`）: Webview・セカンダリサイドバー・コメント・差分エディタ・拡張のファイルシステムの提供者・JSON の検査・ワークスペースの信頼。どれも消さない。セカンダリサイドバー（auxiliary bar）は既定でチャットのビューを置く場所だが、部品（`browser/parts/auxiliarybar`）は残る。

## 型検査で直す点（edits.patch で直す見込み）

行は A＋B＋C-1 の ops を当てた作業ツリー（`C:\b\wt\dev-c1`）か本家 1.146.0 のもの。`grep` で import の文を探した結果で、型だけの参照や文字列の参照は型検査で増える見込み。

### 1. 拡張 API（5.3 の形）

| ファイル | 行 | 直し方 |
|---|---|---|
| `api/common/extHost.api.impl.ts` | 27、40〜46、49、75、76、81、93、127、128（import）、179〜180・204・237・243・249・258・260〜264・272・274・285〜286（作る所）、1095〜1118（`window` の `createAgentEditorComments`・`createChatStatusItem`・`activeChatPanelSessionResource`）、1718（`workspace` の `transferActiveChat`）、1743〜1900（`chat`）、1902〜1990（`lm`） | 新しいファイル `api/common/extHostRemovedApi.ai.ts` に、`typeof vscode.lm`・`typeof vscode.chat` の形の何もしない実装を置く（`register*` は何もしない Disposable、`select*`・`get*` は空の配列、イベントは `Event.None`、`invokeTool` は「無い」の誤り、`isModelProxyAvailable` は false）。impl の変更は、名前空間の `const lm = ...`・`const chat = ...` の右辺と、上の作る所の行を消すことだけにする。`window`・`workspace` の中の4つも同じファイルの関数に向ける |
| `api/common/extHost.protocol.ts` | 46、63〜73、75、107（import）と、チャット・言語モデル・ツール・MCP・コードマッパー・エージェントのコメントの Shape と ID | 消した API の Shape と ID を消す（2026-11-14 リーダーの判断）。消すのは、消した extHost・mainThread の対（ChatAgents2・ChatSessions・ChatContext・ChatDebug・ChatStatus・ChatQuota・ChatInputNotification・ChatOutputRenderer・ChatArtifactIntegrations・CodeMapper・AgentEditorComments・LanguageModels（`ExtHostChatProvider`）・LanguageModelTools・Mcp）の `MainThread*Shape`・`ExtHost*Shape` と、`MainContext`・`ExtHostContext` の ID、それらだけが使う DTO の型。消した部品からの import（46、63〜73、75、107、artifactIntegrations の35）も消す。残す API（speech・search・authentication など）の Shape は変えない |
| `api/common/extHostTypeConverters.ts` | 44〜58（import）と、それを使う変換の名前空間 | 消した API だけが使う変換（ChatAgent・LanguageModel・Tool・McpServerDefinition など）を消す |
| `api/common/extHostTypes.ts` | 33（`HookTypeValue`） | 値を使う所をこのファイルの中の定義に置き換えるか、使う型ごと消す |
| `api/common/extHostApiCommands.ts` | 25〜26、541（`inlineChat.start` のコマンド） | プロンプトのファイルと inline chat の API コマンドを消す |
| `api/common/extHostExtensionService.ts` | 37（`IExtHostLanguageModels`）と使う所 | 言語モデルのプロキシに関わる所を消す |
| `api/browser/mainThreadWebviewManager.ts` | 14（`MainThreadChatOutputRenderer`） | チャットの出力の描き手の登録を消す |
| `api/browser/mainThreadEditorTabs.ts` | 19（`ChatEditorInput`） | チャットのエディタのタブの種類の判定を消す |
| `api/browser/mainThreadAuthentication.ts` | 34、37（MCP の OAuth の鍵・企業の IdP の設定） | MCP の分岐を消す |
| `api/browser/mainThreadBrowserTunnelProxy.ts`・`api/node/extHostBrowserTunnelProxy.ts` | 8〜9・14（agentHost の TCP の型と上限） | 型と定数をファイルの中に置くか、ブラウザーのトンネルの代理ごと消すかを型検査で決める |

### 2. Agents の窓と main・共有プロセス・CLI・サーバー

| ファイル | 行（1.146.0） | 直し方 |
|---|---|---|
| `code/electron-main/app.ts` | 138〜140、147〜151 と使う所 | エージェントのホストの起動と MCP の検出・ゲートウェイの IPC を消す |
| `code/electron-utility/sharedProcess/sharedProcessMain.ts` | 21、94〜102、141〜148 と使う所 | agentHost の SSH・WSL・dev container・トンネルの main のサービスと、MCP の管理のサービス・チャンネルを消す |
| `code/node/cliProcessMain.ts` | 69、72〜78 と使う所 | CLI の `--add-mcp` などの MCP の分を消す。`--install-extension` は残す（C-5 の注意） |
| `server/node/serverServices.ts` | 83〜87、92〜97、100〜107 と使う所 | サーバーのエージェントのホストと MCP を消す（サーバーは C-3 で消えるが、型検査の対象なので C-1 で直す） |
| `platform/windows/electron-main/windowImpl.ts` | 1370 | Agents の窓を開く分岐。型検査には掛からない（文字列）。開く入口が無くなるので残してよい見込み。消すかは型検査の後に決める |
| `platform/protocol/electron-main/protocolMainService.ts` | 130〜131 | `sessions.html` を許す分岐。同上 |
| `build/gulpfile.vscode.ts` | 29・46〜48（`@github/copilot-sdk` の版の照合。依存を消すと起動時に throw）、125〜133・261（foundry の除外）、207〜209（`copilotVersions` を product.json に書く）、253〜259・270（Copilot のランタイムの梱包）、429〜441（`copilot` の shim）、554〜567・607（ripgrep の shim）、634（`compileCopilotExtensionBuildTask`） | AI の SDK の梱包を外す。`build/lib/copilot.ts`（A-1 で残したもの）は使い手が無くなれば消す。A-1 の `edits.patch` と同じファイルに触らないことを確かめる |
| `build/next/index.ts` | 124〜127・200・712（web の Agents の窓の入口） | web の構成は作らないので触らない見込み。型検査（build）に掛かれば消す |

### 3. 画面の部品（workbench）

| ファイル | 行 | 直し方 |
|---|---|---|
| `browser/actions/developerActions.ts` | 63、64、68、69 | エージェントのホストの開発用の操作を消す |
| `browser/actions/policyDiagnosticsMarkdown.ts` | 9 | エージェントのホストのポリシーの節を消す |
| `browser/parts/globalCompositeBar.ts` | 53（Codex のアカウントのメニュー） | アカウントのメニューから Codex の分を消す |
| `services/workspaces/common/workspaceTrust.ts` | 18（`AGENT_HOST_SCHEME`） | **ワークスペースの信頼（Claude Code の受け手）**。agent host の URI を信頼済みにする分岐だけを消す。信頼の判定のほかの動きは変えない |
| `contrib/workspace/browser/workspace.contribution.ts` | 16（`AGENT_HOST_SCHEME`） | 同上 |
| `contrib/accessibility/browser/accessibleView.ts` | 48、49 | チャットのコードブロックの提供者を消す |
| `contrib/accessibility/browser/editorAccessibilityHelp.ts` | 16、23 | チャットの文脈キーの分岐を消す |
| `contrib/authentication/browser/actions/manage{TrustedMcpServersForAccount,AccountPreferencesForMcpServer}Action.ts` | 20〜21、16 | MCP の操作の2ファイルを消し、登録している所（authentication の contribution）を直す |
| `contrib/browserView/electron-browser/browserViewWorkbenchService.ts` | 27、29、36、37、44 | チャットへ渡す機能を消す |
| `contrib/browserView/electron-browser/features/browserWelcomeFeature.ts` | 9 | チャットの文脈キーの条件を消す |
| `contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts` | 30〜32 | 「Copilot に頼む」の案内を消す |
| `contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts` | 38〜40 | チャットへ記号を添付する操作を消す |
| `contrib/comments/browser/simpleCommentEditor.ts` | 16（`EditorDictation`） | **コメント（Claude Code の受け手）**。コメントの入力欄の部品の一覧から口述を外すだけ。コメントのほかの動きは変えない |
| `contrib/scm/browser/scmInput.ts` | 30、71、73 | 口述とチャットの文脈を外す |
| `contrib/scm/browser/scm.contribution.ts` | 41〜43 | 履歴をチャットへ添付する contribution を外す |
| `contrib/scm/browser/scmHistoryViewPane.ts` | 74（`SCMHistoryItemTransferData`） | ドラッグの型をこのファイルへ移すか、チャットへのドラッグを消す |
| `contrib/scm/browser/quickDiffModel.ts` | 29（`IChatEditingService`） | チャットの編集の差分の扱いを消す |
| `contrib/search/browser/search.contribution.ts` | 27 | 検索結果をチャットへ渡す contribution を外す |
| `contrib/search/browser/symbolsQuickAccess.ts`・`anythingQuickAccess.ts` | 27〜28・60〜61 | チャットへの添付と「質問する」を消す |
| `contrib/markers/browser/markers.contribution.ts` | 39 | 問題をチャットへ渡す contribution を外す |
| `contrib/extensions/browser/extensions.contribution.ts` | 64〜65、73 | 拡張の検索・インストールの言語モデルのツールの登録を消す |
| `contrib/extensions/browser/extensionsViewlet.ts` | 74〜76 | MCP のサーバーとカスタマイズの市場のビューの分を消す（IChatEntitlementService は残る） |
| `contrib/inlineCompletions/browser/inlineCompletionLanguageStatusBarContribution.ts` | 14 | 残るサービスなので直さない見込み（Null の実装で「未契約」になる） |
| `contrib/interactive/browser/interactiveEditor.ts`・`interactive.contribution.ts` | 67・63 | inline chat の分を消す（C-4 で消える部品だが C-1 が先なので直す） |
| `contrib/replNotebook/browser/repl.contribution.ts` | 40 | 同上 |
| `contrib/notebook/browser/...`（`viewModel/{base,markup,code}CellViewModel.ts`、`view/renderers/cellRenderer.ts` 28、`diff/notebookDiffActions.ts` 32、`diff/inlineDiff/notebookOriginalModelRefFactory.ts` 7、`contrib/cellDiagnostics/*`、`contrib/editorHint/emptyCellEditorHint.ts`、`contrib/navigation/arrow.ts`、`controller/editActions.ts`・`executeActions.ts`） | 各ファイルの import | ノートブックの中のインラインチャット・チャットの添付・診断の「修正を頼む」を消す（C-4 で消えるが C-1 が先） |
| `contrib/policyExport/electron-browser/policyExport.contribution.ts` | 25 | エージェントのホストのポリシーの書き出しを消す |
| `contrib/preferences/browser/preferencesRenderers.ts` | 49、50 | MCP の設定の節の飾りを消す |
| `contrib/quickaccess/browser/commandsQuickAccess.ts` | 39〜42 | コマンドパレットの「AI に聞く」を消す |
| `contrib/tasks/browser/abstractTaskService.ts`・`electron-browser/taskService.ts` | 51、88〜90・51〜52 | タスクの失敗をチャットへ渡す操作を消す |
| `contrib/terminal/browser/terminal.contribution.ts` | 50（`AgentHostTerminalService`） | 登録を消す |
| `contrib/terminal/browser/terminalMenus.ts`・`xterm/decorationAddon.ts`・`terminal/terminalContribExports.ts`・`electron-browser/terminalInstallActions.ts`・`terminalContrib/accessibility/browser/terminalAccessibilityHelp.ts`・`terminalContrib/inlineHint/browser/terminal.initialHint.contribution.ts` | 22・29〜35・10・22〜24・23・25〜32 | ターミナルのチャットの文脈キー・メニュー・案内を消す |
| `contrib/testing/browser/testing.contribution.ts` | 36 | テストの言語モデルのツールの登録を消す |
| `contrib/update/browser/updateTitleBarEntry.ts` | 27（`IChatService`） | 更新の案内のチャットの分岐を消す |
| `services/authentication/browser/authenticationQueryService.ts` | 29・31・32（消す MCP の認証のサービス3つの import）、817・819・821（コンストラクターでの注入） | MCP の分の問い合わせ（MCP のサーバーごとの許可・利用の照会）を消し、3つの注入を外す。**注入しているので、型検査に加えて起動時に `UNKNOWN service authenticationMcp*` が出ないことを確かめる**。拡張の認証の照会（Claude Code がサインインに使うかは未確認）は変えない |

### 5. AI の検索（`contrib/search/browser/AISearch` を消した分）

検索そのもの（全文検索・置換・検索のビュー）は裁定で残す。直すのは「AI の結果」の分岐だけにする。

| ファイル | 行（`C:\b\wt\dev-c1`） | 直し方 |
|---|---|---|
| `contrib/search/browser/searchView.ts` | 86（`AIFolderMatchWorkspaceRootImpl`）と AI の結果に関わる約70か所（`aiResults`・`AIResultsTitle`・`AIResultsRequested` など） | AI の結果の見出し・要求・表示の分岐を消す。普通の検索の流れは変えない |
| `contrib/search/browser/searchTreeModel/searchResult.ts` | 20（`AITextSearchHeadingImpl`）と約23か所 | AI の結果の見出しを持たないようにする |
| `contrib/search/browser/searchTreeModel/searchModel.ts`・`searchTreeCommon.ts` | AI の検索の呼び出し（`aiTextSearch`）約10か所・型 `ISearchTreeAIFileMatch` など約4か所 | AI の検索の呼び出しと型を消す |
| `contrib/search/browser/searchResultsView.ts`・`searchCompare.ts` | 37・11（`isSearchTreeAIFileMatch`） | AI の結果の判定を消す |
| `contrib/search/browser/searchActionsRemoveReplace.ts`・`searchActionsCopy.ts`・`searchActionsTopBar.ts` | 27（`AITextSearchHeadingImpl`）ほか数か所 | AI の結果の分岐と「AI の結果を表示」の操作を消す |
| `contrib/search/browser/search.contribution.ts` | 221〜245 付近（設定 `search.searchView.semanticSearchBehavior`・`keywordSuggestions`） | 2つの設定の登録を消す（`checks.absentSettings`） |
| `contrib/search/common/constants.ts` | 46〜47（`ShowAIResultsActionId`・`HideAIResultsActionId`）、87〜88（コンテキストキー） | 使い手が無くなれば消す |
| `api/common/extHost.api.impl.ts` | 1411〜1415（`workspace.registerAITextSearchProvider`。提案中の API） | `extHostRemovedApi.ai.ts` の何もしない登録に向ける |
| `api/common/extHostSearch.ts` | 25、40〜41、57〜58、100〜111、181〜216 | AI の検索の提供者の登録と実行を消す |
| `api/browser/mainThreadSearch.ts` | 48〜52、229 | 同上（main thread 側） |
| `api/common/extHost.protocol.ts` | 2070、2720 | 2つのメソッドを Shape から消す |
| `services/search/common/searchService.ts`・`search.ts` | 34〜38・63〜65・93〜112・251〜265 と 48・140・276（`QueryType.aiText`・`aiTextSearch`） | 案A（推す）: 提供者が登録されなければ使われないので残す（検索の中心のサービスなので、パッチを小さく保つ）。案B: 型検査で使い手が無くなった分を消す |

### 6. テストの土台（型検査に入る）

`workbench/test/browser/workbenchTestServices.ts`（8）、`workbench/test/common/workbenchTestServices.ts`（1）、`workbench/test/electron-browser/workbenchTestServices.ts`（1）、`componentFixtures/fixtureUtils.ts`（12）、`componentFixtures/editor/tabs.fixture.ts`（1）、`componentFixtures/migrationProgressNotification.fixture.ts`（1）。ほかに、残す部品のテストで消した部品を import するもの（`api/test/{browser/extHostTypeConverter,common/extHostTypeConverters}.test.ts`、`services/{assignment,policies,extensionManagement,workspaces,dialogs,configuration,remote,search,accounts}/test/*`、`contrib/{extensions,terminal,terminalContrib/inlineHint,workspace,browserView,notebook}/test/*`、`platform/remote/test/electron-browser/electronRemoteResourceLoader.test.ts`）。消した部品を差し替えるか、その検査の項目を消す。

検証（`tasks/2026-11-14-p5-verify-c-prep/handoff-notes.md` の指摘4）で足したテスト:

| ファイル | 行 | 直し方 |
|---|---|---|
| `api/test/browser/extHostAuthentication.integrationTest.ts` | 42〜44（MCP の認証のサービス3つの import）、843〜847（スタブと作成） | MCP の認証の部分を外す |
| `services/authentication/test/browser/authenticationQueryServiceMocks.ts` | 10、12、13 | MCP の認証のモックを外す（`urlsEqual` は使い手があれば別の場所から取る） |
| `services/authentication/test/browser/authenticationQueryService.test.ts` | 16、18、19 と MCP の照会の検査 | MCP の照会の検査を消す |
| `services/authentication/test/browser/authenticationMcpService.test.ts`・`authenticationMcpAccessService.test.ts` | 15〜17・12 | 消したサービスだけを見るテストなので `delete` に足した |
| `contrib/files/test/electron-browser/fileActions.contribution.test.ts` | 11（`AGENT_HOST_SCHEME`） | agent host の URI の検査を消す |
| `contrib/search/test/browser/searchChatContext.test.ts` | 13 | 消したファイルだけを見るので `delete` に足した |
| `contrib/search/test/browser/searchView.test.ts`・`searchModel.test.ts`、`api/test/node/extHostSearch.test.ts` | AI の検索の検査（`aiText` など） | AI の検索の検査の項目を消す |

単体テストは関門に入らない（B-7 と同じ扱い）が、型検査には入る。

## 影響しうるもの

- Claude Code 拡張: 宣言の上では本家のチャット・言語モデル・MCP の API を使っていない（docs/03 の9節）。宣言に出ない呼び出し（`vscode.lm` など）は何もしない実装が受ける。関門で Claude Code の組を丁寧に行う（docs/07）。
- 拡張 API の `vscode.lm`・`vscode.chat` を使う拡張（PowerShell 拡張などが起動時に呼ぶ見込み。推定）は、登録が成功して何も起きないか、モデル・ツールが空になる。
- `chat.disableAIFeatures` の既定（`mydist`）は設定が無くなるので、`apply.mjs` が写すときに外す（docs/04 の6.1 の「C-1 の後」）。
- 設定の画面・コマンドパレット・アカウントのメニュー・ステータスバーから AI の項目が消える。
- Agents の窓（Windows のスタートメニューの「Agents」、`resources/win32/sessions.ico`）を開く入口が無くなる。

## 壊れたときの症状と戻し方

- 起動時に `depends on UNKNOWN service authenticationMcp...` が出たら、`authenticationQueryService.ts` の MCP の注入が外れていない。edits.patch を直す。
- 起動時に `[createInstance] ... depends on UNKNOWN service chatEntitlementService` が出たら、Null の実装の登録が読まれていない。`enabled: false` に戻してビルドし直す。
- 拡張ホストのログに `vscode.lm`・`vscode.chat` の呼び出しの誤りが出たら、何もしない実装に足りない関数がある。`extHostRemovedApi.ai.ts` に足す。Claude Code が動かなくなったら、使われた API を特定して `kept` に入れて残す（docs/03 の9節）。

## 決まったこと（2026-11-14 リーダーの判断）

1. docs/03 の表に無い部品を足すこと（「消すもの」の「足した」）は認められた（docs/03 に反映済み）。
2. `extHost.protocol.ts` は、消した API の Shape と ID を消す（表1の書き方）。
3. 迷って残したものは「消す AI の部品だけが使うものは消す。残る部品が使うものは使い手を書いて残す。`platform/otel` はテレメトリなので使い手が残らなければ消す」の規則で、`grep` で使い手を確かめて振り分けた（作業ツリー `C:\b\wt\dev-c1`。A＋B＋C-1＋C-2 の ops を当てた状態で、消した部品の外に残る import を探した）。

| もの | 残る使い手 | 扱い |
|---|---|---|
| `contrib/speech` | アクセシビリティ（`accessibilityConfiguration.ts` 12行・`accessibility.contribution.ts` 16行・`editorAccessibilityHelp.ts` 17行）、ターミナル（`terminalMenus.ts` 21行・`terminalAccessibilityHelp.ts` 22行）、拡張 API（`mainThreadSpeech.ts` 11行・`extHost.protocol.ts` 84行） | 残す（`kept`） |
| `common/agentsColors.ts` | 残る CSS が色の変数を使う: `browser/parts/partGrid/media/partGrid.css` 182・214行、`browser/media/feedbackInputWidget.css` 10行、`contrib/modernUI/browser/media/frostedGlass.css` 66行 | 残す（`kept`） |
| `common/agentsSizes.ts` | 無し（main と部品の見本の副作用の import だけ。大きさの変数 `--vscode-agents-*` を使う CSS も無い） | 消す（`delete`、`removeLines` 2行） |
| `platform/artifactIntegrations` | 無し（`workbench.common.main.ts` の登録2行と、消すチャットの API の型を持つ `extHost.protocol.ts` 35行だけ） | 消す（`delete`、`removeLines` 2行。protocol の35行は表1で Shape と一緒に消す） |
| `contrib/imageCarousel` | 自分の中だけ。ただしエクスプローラーの「画像をカルーセルで開く」（`workbench.action.openImagesInCarousel`）で AI と関係なく使える画像の画面で、画像のプレビューは裁定で残す | 残す（`kept`）。チャットからの入口 `workbench.action.chat.openImageInCarousel` は害が無いが、型検査で消すかを決める |
| `platform/otel` | 無し（使い手はエージェントのホストだけで、C-1 で消える） | 消す（`delete`）。テレメトリなので何もしない実装も要らない |
| 依存 `@modelcontextprotocol/sdk` | src には無し。`build/agent-sdk/package.ts` 275行（AI の SDK を梱包する台本のメッセージの中）と `eslint.config.js` 1823行（agentHost の型のための許可の一覧）だけ | 消す（`removeDependencies`）。`eslint.config.js` は A-1 と同じく関門に入らないので直さない |

4. docs/02 の3節の `chatParticipantRegistry`・`agentSdks`・`dictationRuntime`・`copilotVersions` は 1.146.0 の OSS の product.json に無い（試しで4つとも「無い」の警告）。`productRemove` から外した。`product.overlay.json` の `removeIfPresent` に置く案（この作業の書き込みの範囲の外）。`copilotVersions` はパッケージ化のときに `build/gulpfile.vscode.ts` 207〜209行が書き込むので、上の2の表で消す。
5. `after` に A-1・B-1・B-2 を入れることは認められた。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。上の表は import の文から作ったもので、型だけの参照・文字列の参照・副作用の import の取りこぼしがありうる。
- `build/gulpfile.vscode.ts` を直したあと、`gulp vscode-win32-x64-min` が通るか。`build/next/index.ts` の esbuild の入口から消した4つが無くても束ねが通るか。
- 依存を消した後の `pnpm install` とロックファイルの差分（docs/03 の5.4）。
- 自作のビルドの通信の監査で、`release-assets.githubusercontent.com`（エージェントのホストがランタイムを取る通信）が出ないこと。

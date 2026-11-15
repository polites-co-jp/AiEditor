# C-1-ai 本家の AI

裁定（2026-11-12）: 本家の AI は消す。ただし Claude Code 拡張が依存する部分があれば特定して残す。拡張 API の入口（`vscode.lm`・`vscode.chat` など）は何もしない実装にして残し、中身のコードは消す。

状態: **edits.patch あり、関門の前**（2026-11-15）。A・B の14単位の上に C-1 を当てた作業ツリー（`C:\b\wt\p2`、本家 1.146.0）で、型検査（`pnpm run typecheck-client`）が誤り 0 で通る。タグに戻して A＋B＋C-1 を `apply.mjs` で当て直すと、edits.patch は衝突なく当たり（`git am -3`）、適用後の検査は `ok`、型検査も誤り 0（`tasks/2026-11-15-p5-c1-patch/typecheck-log.md`）。`enabled` はまだ `false`。ビルド（パッケージ化）・起動の確かめ・関門は、古い版の片づけの許可の後に行う。直した点の一覧は下の「edits.patch で直した点（2026-11-15）」。2回目（同じ日、パッケージ化の前に要る直し）は「edits.patch の2回目の直し（2026-11-15）」。3回目は「edits.patch の3回目の直し（2026-11-15）」。3回目の後も、当て直しは衝突なく `ok`、型検査は誤り 0。ロックファイルの検査（`--lockfile-check`）も `ok` になった。5回目（大岡越前守の検証の軽微な指摘の1〜4）の後の edits.patch は108ファイル（新しいファイルは `extHostRemovedApi.ai.ts` の1つ）、742行の追加、5418行の削除。当て直し・型検査・ロックファイルの検査はどれも `ok`。

## 消すもの

本家 1.146.0 で確かめた所在。docs/03 の表に無いものは「足した」と書いた。

- チャット・インラインチャット・MCP・音声のチャット: `contrib/chat`、`contrib/inlineChat`、`contrib/mcp`、`contrib/agentsVoice`
- エージェントのホスト（Copilot・Claude・Codex の SDK を動かす別プロセス）: `platform/agentHost`、`services/agentHost`。サーバー側の `server/node/agentHostChannel.ts`・`serverAgentHostManager.ts`（足した）
- MCP の基盤: `platform/mcp`、`services/mcp`。認証の MCP の操作2つ（`contrib/authentication/browser/actions/manage{TrustedMcpServersForAccount,AccountPreferencesForMcpServer}Action.ts`）。`services/authentication/browser/authenticationMcp{Usage,Access,}Service.ts` は 2026-11-15 に「残すもの」へ移した（下を見る）
- **足した**: Agents の窓（`src/vs/sessions`。別の入口 `sessions.desktop.main`・`electron-browser/sessions.html` を持つ窓）と、本体側のエージェントのセッションの部品（`contrib/sessions`、`contrib/sessionChanges`、`services/sessions`、`browser/parts/sessions`）、チャットの窓（`contrib/chatWindow`）、エージェントのキャンバス（`contrib/canvases`）、リモートのコーディングエージェント（`contrib/remoteCodingAgents`）、ターミナルのチャット（`terminalContrib/chat`・`chatAgentTools`、`terminal/browser/agentHost*.ts`・`chatTerminalCommandMirror.ts`・`ahpTerminalCommandSource.ts`、`terminal/terminalContribChatExports.ts`）、ノートブックのチャット（`notebook/browser/controller/chat`・`contrib/chat`・`view/cellParts/chat`）、口述（チャットの音声認識に乗る `codeEditor/browser/dictation`・`terminalContrib/voice`、端末内の認識 `platform/localTranscription`・`services/localTranscription`）、エージェントのプラグイン（`platform/agentPlugins`）、MCP などのカスタマイズの市場（`platform/customizationMarketplace`）
- **AI の検索**（足した。2026-11-14 リーダーの判断）: `contrib/search/browser/AISearch`（`aiSearchModel.ts`・`aiSearchModelBase.ts`。提案中の API `aiTextSearchProvider` の結果を検索のビューに「AI の結果」として出す部品）。検索そのもの（裁定で残す）は消さない。AI の結果を出す操作（`search.action.showAIResults`・`hideAIResults`）と設定 `search.searchView.semanticSearchBehavior`・`keywordSuggestions` は、残る検索のファイルの中にあるので型検査で消す（下の表の5）。import は検索の中のファイルからだけで、1行の一覧の要素ではないので `removeLines` は無い
- 残る部品の中のチャット専用のファイル（足した）: `search/browser/searchChatContext.ts`、`scm/browser/scmHistoryChatContext.ts`、`markers/browser/markersChatContext.ts`、`debug/browser/debugChatIntegration.ts`、`extensions/common/{search,install}ExtensionsTool.ts`、`browserView/electron-browser/tools`・`features/browserEditorChatFeatures.ts`、`testing/common/testingChatAgentTool.ts`
- 拡張 API の実装: main thread 側 `api/browser/mainThread{AgentEditorComments,Chat*,LanguageModels,LanguageModelTools,Mcp}.ts`（14ファイル）、extHost 側 `api/common/extHost{AgentEditorComments,Chat*,CodeMapper,LanguageModels,LanguageModelTools,Mcp}.ts`（14ファイル）、`api/node/extHostMcpNode.ts`
- 消した部品だけを見るテストと部品の見本（`api/test` の12、ターミナル・テスト・拡張・デバッグ・ブラウザーのツールのテスト、`componentFixtures/{chat,sessions,agentsVoice}` など）。`src/typings/copilot-api.d.ts`
- 依存（`removeDependencies`）:
  - ルートの17: `@anthropic-ai/sdk`・`@github/copilot-sdk`・`@vscode/copilot-api`・`foundry-local-sdk`・`@anthropic-ai/claude-agent-sdk`・`@openai/codex`・`@modelcontextprotocol/sdk`、`@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`@microsoft/dev-tunnels-{connections,contracts,management,ssh,ssh-tcp}`・`ssh2`・`ws`
  - `remote/package.json` の7: `@github/copilot-sdk`・`@vscode/copilot-api`・`@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`ssh2`・`ws`
  - どれも 1.146.0 の src の中では、消す部品（`platform/agentHost`・`platform/localTranscription`・`server/node/agentHostChannel.ts` など）と消す build の台本だけが使っている（`grep` で確かめた）。後の10と5は2回目に足した（下の「edits.patch の2回目の直し」の5）
  - 依存を消すのに合わせて、`pnpm-workspace.yaml` の行も `removeLines` で消す。`patchedDependencies` の `foundry-local-sdk`（2回目）と、`allowBuilds` の `foundry-local-sdk@2.2.1`・`bufferutil@4.1.0`・`utf-8-validate@5.0.10`・`koffi@3.2.1`（5回目）
- 一覧の行（`removeLines`）: `workbench.common.main.ts` 27行、`workbench.desktop.main.ts` 13行、`workbench.web.main.ts` 14行、`terminal.all.ts` 3行、`codeEditor.contribution.ts`・`notebook.contribution.ts`・`browserView.contribution.ts` 各1行、`api/browser/extensionHost.contribution.ts` 14行、`extHost.common.services.ts` 4行、`extHost.node.services.ts` 3行、ビルドの入口（`build/next/index.ts` の Agents の窓・エージェントのホスト・端末内の認識の入口。同じ行が2か所にあるものは `count: 2`）、`build/gulpfile.vscode.ts` の Agents の窓の4ファイル、`build/npm/dirs.ts`・`pnpm-workspace.yaml` の `src/vs/sessions/test/e2e`
- product.json（`productRemove`）: `defaultChatAgent`・`trustedExtensionAuthAccess`・`builtInExtensionsEnabledWithAutoUpdates`・`sessionsWindowAllowedExtensions`・`voiceWsUrl`・`agentsTelemetryAppName`（6つとも 1.146.0 の OSS の product.json にある）

## 残すもの

- `services/chat`（中身は `chatEntitlementService.ts` だけ）: サービスの ID `IChatEntitlementService` を、拡張の有効・無効（`services/extensionManagement/browser/extensionEnablementService.ts` 38行）をはじめ約12の残る部品が注入している。B-2 の実験のサービスと同じ形で、`edits.patch` で、`chatEntitlementService.ts` の末尾に「契約なし・AI 無効」を返す実装 `NullChatEntitlementService` を置き、末尾の `registerSingleton` をこちらに替えた（5回目に、別のファイル `nullChatEntitlementService.ts` から同じファイルの中へ移した。2つのファイルが互いに import し合う形をやめるため）。Copilot の契約の確認の通信が無くなる。
- `services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts`（2026-11-15 に消す側から移した）: 残る認証の照会（`authenticationQueryService.ts` が注入し、MCP の名前が119か所。共通の型 `common/authenticationQuery.ts` に31か所）が使う。保存だけで通信はしない。理由と別案は下の表。
- `platform/chat`: AI を止める設定の ID などの定数と、Agents の窓の招待の型。`layout.ts`・`commandCenterControl.ts`・`platform/native` などが import する。AI の部品は無い。
- `contrib/onboarding`（B-2 で残したもの）、`contrib/speech`・`common/agentsColors.ts`・`contrib/imageCarousel`（残る部品が使う。下の「決まったこと」の3）、`contrib/comments`（Claude Code が使う）。
- 下の「決まったこと」の3の規則で、`common/agentsSizes.ts`・`platform/artifactIntegrations`・`platform/otel` と依存 `@modelcontextprotocol/sdk` は消す側に移した。
- Claude Code が使う受け手（docs/03 の9節、`records/phase0/claude-code-manifest.md`）: Webview・セカンダリサイドバー・コメント・差分エディタ・拡張のファイルシステムの提供者・JSON の検査・ワークスペースの信頼。どれも消さない。セカンダリサイドバー（auxiliary bar）は既定でチャットのビューを置く場所だが、部品（`browser/parts/auxiliarybar`）は残る。
- build/ の AI の台本（2026-11-15 の大岡越前守の検証の指摘4。直さない）: 次のものは残る。どれも Copilot・foundry・エージェントの SDK の名前を文字列で持つが、手元のパッケージ化（`gulp vscode-win32-x64-min` → `build/gulpfile.vscode.ts`）からは呼ばれない。消すとパッチと毎週の衝突が増えるだけなので残す。
  - `build/agent-sdk/`（エージェントの SDK の取得・梱包）
  - `build/dictation-runtime/`（口述の foundry のランタイム）
  - `build/azure-pipelines/common/apply-sdk-canary-override.ts`（本家の CI の SDK の差し替え）
  - `build/lib/copilot.ts`（`getRipgrepExcludeFilter` は使う）
  - `build/lib/test/` の `copilot.test.ts`・`dictationRuntime.test.ts`・`agentHostDependencies.test.ts` など
  - `build/gulpfile.reh.ts`（サーバー。C-3 で消える）
  - `build/gulpfile.extensions.ts` の `compileCopilotExtensionBuildTask`
  - build/ の型検査の誤りは、これらから来ていない（A-3 の `builtInExtensions: []` による1件だけ）。

### edits.patch を作るとき（2026-11-15）に足した・変えたもの

リーダーの判断を仰ぐ点を含む。

| 何を | どう変えたか | 理由 |
|---|---|---|
| `services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts` | `delete` から外して `kept` へ。`workbench.common.main.ts` の import の3行の `removeLines` も外した。テスト2つ（`authenticationMcpService.test.ts`・`authenticationMcpAccessService.test.ts`）も消さない | MCP のサーバーごとの認証の許可・利用の記録（保存だけで通信しない）。残る認証の照会（`authenticationQueryService.ts`。共通の型 `common/authenticationQuery.ts` にも MCP の照会が31か所、実装に約120か所）と、そのテスト・拡張 API の認証のテストが使う。消すと照会のサービスの大きな書き換えになり、拡張の認証の照会（Claude Code のサインインに使うかは未確認）を壊す恐れがある。2026-11-14 の規則「残る部品が使うものは使い手を書いて残す」に当てた。**別案**: 照会のサービスから MCP の分を消して3つを消す（パッチが大きくなり、毎週の衝突が増える） |
| `contrib/authentication/.../manage{TrustedMcpServersForAccount,AccountPreferencesForMcpServer}Action.ts` | `delete` に足し、登録の4行を `removeLines` に足した | MCP の操作の画面。消した `contrib/mcp` とチャットの文脈キーを import する |
| `contrib/terminalContrib/inlineHint` | `delete` に足し、`terminal.all.ts` の import を `removeLines` に足した。設定 `terminal.integrated.initialHint` も無くなる | ターミナルの「Ctrl+I で Copilot に聞く」の案内。チャットのエージェントにだけ使う |
| `notebook/test/browser/contrib/notebookCellDiagnostics.test.ts`、`test/browser/componentFixtures/migrationProgressNotification.fixture.ts` | `delete` に足した | 消した部品（ノートブックのエージェント、AI のカスタマイズの移行）だけを見るテストと部品の見本 |
| 一覧の1行の参照（`debug.contribution.ts`・`markers.contribution.ts`・`search.contribution.ts`・`terminal.contribution.ts`・`testing.contribution.ts` の import と登録、`fixtureUtilsCss.ts` の import） | `removeLines` に足した（12行） | 消したファイル（`debugChatIntegration.ts` など）の import と登録の1行 |
| `checks.absentStrings` の `vs/sessions/`（build） | `'vs/sessions/`（引用符つき）に狭めた | `build/next/index.ts` 263行のコメントに当たるため。入口の文字列だけを見る |
| `kept` に足した6つ（`base/common/product.ts`・`notebookChatEditorOverlay.css`・`commandCenter.css`・`platform/github/README.md`・`componentFixtures/editor/multiDiffEditorChatChanges.json`・`notebookCellDiffDecorator.ts`） | `checks.absentStrings` の除外 | どれもコメント・資料・見本のデータの中の文字列だけで、import ではない。直さない |

## edits.patch で直した点（2026-11-15）

edits.patch は100ファイル（新しいファイル2つ）、710行の追加、5106行の削除。直しは「消した部品を参照している行」だけにした。直し方の形は次の5つ。

- **何もしない実装に向ける**: 拡張 API（新しいファイル `api/common/extHostRemovedApi.ai.ts`）、契約のサービス（`services/chat/common/chatEntitlementService.ts` の末尾の `NullChatEntitlementService`。5回目までは別のファイルだった）
- **値をファイルの中に写す**: 消した部品の定数だけを使う所は、同じ値の定数をファイルの中に置いた（コメント `Shuko (C-1-ai): ... same value as ...`）。振る舞いを変えないため
- **分岐・登録を消す**: チャット・インラインチャット・MCP・エージェントのホストに渡す操作、メニュー、案内
- **注入を外す**: 消したサービスの `@I...Service` の引数（派生クラスの `super(...)` の引数も合わせた）
- **テストの項目を消すか、代わりを置く**: 消した部品だけを見るテストの項目は消した。残る部品のテストが消した部品の小さな関数を使う所は、テストの中に最小の代わりを置いた

### 1. 拡張 API

| ファイル | 直し方 |
|---|---|
| `api/common/extHostRemovedApi.ai.ts`（新規） | `createRemovedChatApi`（`typeof vscode.chat`）、`createRemovedLanguageModelApi`（`typeof vscode.lm`。埋め込み（embeddings）の4つは消さずに `ExtHostEmbeddings` へ渡す）、`createRemovedAgentEditorComments`、`createRemovedChatStatusItem`、`createRemovedLanguageModelAccessInformation`、`removedTransferActiveChat`、`removedRegisterAITextSearchProvider`。登録は何もしない Disposable、問い合わせは空の配列か `false`・`undefined`、イベントは `Event.None`、`lm.invokeTool` と `lm.getModelProxy` は「AI が無い」の誤りで reject、`chat.createChatSessionItemController` は誤りを投げる。`checkProposedApiEnabled` は元と同じ所で行う（提案中の API の門は変えない） |
| `api/common/extHost.api.impl.ts` | 消した extHost のクラスの import・生成・`rpcProtocol.set` を消し、`const chat = createRemovedChatApi(extension)`、`const lm = createRemovedLanguageModelApi(extension, extHostEmbeddings)` にした。`window` の4つ（`createAgentEditorComments`・`createChatStatusItem`・`activeChatPanelSessionResource`・`onDidChangeActiveChatPanelSessionResource`）、`workspace.registerAITextSearchProvider`、`interactive.transferActiveChat` を上のファイルに向けた |
| `api/common/extHost.protocol.ts` | 消した API（LanguageModels・ChatContext・ChatDebug・ChatAgents2・CodeMapper・LanguageModelTools・ChatOutputRenderer・AgentEditorComments・ChatArtifactIntegrations・Mcp・ChatStatus・ChatQuota・ChatInputNotification・ChatSessions）の `MainThread*Shape`・`ExtHost*Shape`、それだけが使う DTO、`MainContext`・`ExtHostContext` の ID、消した部品からの import を消した（2026-11-14 のリーダーの判断のとおり）。AI の検索の2つのメソッド（`$registerAITextSearchProvider`・`$provideAITextSearchResults`）は残した（下の5） |
| `api/common/extHostTypeConverters.ts` | チャット・言語モデル・ツール・MCP・フック・チャットのセッションの変換の名前空間（`ChatFollowup` から `ChatAgentUserActionEvent` まで、`LanguageModelToolSource`・`LanguageModelToolResult`・`McpServerDefinition`・`ChatRequestHooksConverter`・`ChatHookCommand`・`ChatSessionItem`）と、それだけが使う import を消した。`NotebookEdit` の変換もチャットだけが使うので消した |
| `api/common/extHostTypes.ts` | `ChatResponseHookPart` の `hookType` の型を、消した `HookTypeValue` から `vscode.ChatHookType`（d.ts の同じ文字列の型）にした |
| `api/common/extHostApiCommands.ts` | API コマンド `vscode.editorChat.start`（`inlineChat.start`）と `vscode.extensionPromptFileProvider` を消した |
| `api/common/extHostExtensionService.ts` | `ExtensionContext.languageModelAccessInformation` を何もしない実装にし、`IExtHostLanguageModels` の注入を外した |
| `api/browser/mainThreadWebviewManager.ts` | **Webview（Claude Code の受け手）**。チャットの出力の描き手の登録の2行だけを消した。Webview・パネル・カスタムエディタ・ビューは変えていない |
| `api/browser/mainThreadEditorTabs.ts` | チャットのエディタのタブの種類の判定を消した（DTO `ChatEditorInputDto` は残る） |
| `api/browser/mainThreadAuthentication.ts` | MCP の2つの定数（設定 `mcp.enterpriseManagedAuth.idp` と、秘密の保存の鍵の形）を同じ値でファイルの中に写した。企業の IdP（XAA）の流れは変えていない |
| `api/browser/mainThreadBrowserTunnelProxy.ts`・`api/node/extHostBrowserTunnelProxy.ts` | エージェントのホストのネットワークは無いので、`$openNetworkConnection` は「つながっていない」の誤りを返す。接続の型はファイルの中に置いた。窓のリモートの代理は変えていない。上限の定数 256 は同じ値で写した |

### 2. main・共有プロセス・CLI・サーバー・ビルド

| ファイル | 直し方 |
|---|---|
| `code/electron-main/app.ts` | エージェントのホストの起動、MCP の検出とゲートウェイのサービス・チャンネル、エージェントのセッションのリンク（`parseExternalOpenSessionLinkUri`）を消した。Agents の窓の新しいセッションのリンク（`platform/window` に残る）は変えていない（下の「未確認」） |
| `code/electron-utility/sharedProcess/sharedProcessMain.ts` | MCP の管理のサービス・チャンネル、agentHost の SSH・WSL・dev container・トンネルのサービス・チャンネル、OAuth のメタデータのチャンネルを消した |
| `code/node/cliProcessMain.ts` | MCP のサービスと `--add-mcp` の処理を消した。`--install-extension` は変えていない |
| `server-main.ts` | `--agent-host-ca` の処理を消した |
| `server/node/serverServices.ts` | エージェントのホストの配線（約140行）と MCP のサービス・チャンネルを消した（サーバーは C-3 で消えるが、型検査の対象なので C-1 で直す） |
| `build/next/index.ts` | web の Agents の窓の入口と dev tunnels web の束ねを消した（`checks.absentStrings` の `'vs/sessions/`）。デスクトップの入口は変えていない |

### 3. 画面の部品（workbench）

| ファイル | 直し方 |
|---|---|
| `services/chat/common/chatEntitlementService.ts` | 末尾に `NullChatEntitlementService` を置き（5回目に新しいファイルから移した）、末尾の `registerSingleton` を、契約を取りに行かない実装に替えた（B-2 の実験のサービスと同じ形）。契約なし・クォータなし・BYOK なし、チャットは隠して無効（文脈キー `chatSetupHidden`・`chatSetupDisabled` を true にする）。Copilot の契約の確認の通信が無くなる |
| `services/workspaces/common/workspaceTrust.ts`・`contrib/workspace/browser/workspace.contribution.ts` | **ワークスペースの信頼（Claude Code の受け手）**。`AGENT_HOST_SCHEME` を同じ値（`vscode-agent-host`）でファイルの中に写しただけ。信頼の判定は1文字も変えていない |
| `contrib/comments/browser/simpleCommentEditor.ts` | **コメント（Claude Code の受け手）**。入力欄の部品の一覧から口述（`EditorDictation`）の1行と import を外しただけ |
| `browser/actions/developerActions.ts`・`policyDiagnosticsMarkdown.ts` | ポリシーの診断から、エージェントのホストの節（実行時の解決・準備度・チャットの実行環境）を消した。ほかの節は変えていない |
| `browser/parts/globalCompositeBar.ts` | アカウントのメニューから Codex の分を消した |
| `contrib/accessibility/browser/accessibleView.ts`・`editorAccessibilityHelp.ts` | チャットのコードブロックの提供者の登録とチャットの案内を消した。型 `ICodeBlockActionContext` は `platform/accessibility` の同名のものを使う |
| `contrib/browserView/electron-browser/browserViewWorkbenchService.ts`・`features/browserWelcomeFeature.ts` | チャットへの共有を「使えない」に固定し、チャットの部品の注入を外した。エージェントが開いたブラウザーは裏で開く |
| `contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts`・`notebook/.../emptyCellEditorHint.ts` | 「Copilot に頼む」の案内を消した（既定の「言語を選ぶ」の案内は残る）。派生クラスの引数も合わせた |
| `contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts`・`search/browser/symbolsQuickAccess.ts`・`anythingQuickAccess.ts` | チャットへの添付・チャットの見出しの移動・「Quick Chat を開く」を消した |
| `contrib/debug/browser/debugCommands.ts`・`debugEditorActions.ts` | `inChat` の否定の条件を外した（チャットが無いので常に真だった） |
| `contrib/extensions/browser/extensions.contribution.ts`・`extensionsViewlet.ts` | 言語モデルのツールの登録、エージェントのプラグインの更新、MCP の検索の通知を消した |
| `contrib/interactive/*`・`contrib/replNotebook/*`・`contrib/notebook/*`（13ファイル） | インラインチャット・チャットの添付・ノートブックのエージェント・セルのチャットの部品を消した（C-4 で消える部品だが C-1 が先） |
| `contrib/policyExport/electron-browser/policyExport.contribution.ts` | ポリシーの書き出しから、エージェントのホストの対応状況の付与を消した |
| `contrib/preferences/browser/preferencesRenderers.ts` | MCP の設定の節の定数を同じ値でファイルの中に写した（下の「未確認」） |
| `contrib/quickaccess/browser/commandsQuickAccess.ts` | コマンドパレットの「Ask in Chat」を消した |
| `contrib/scm/browser/*`（4ファイル） | 口述・チャットの文脈・「AI でコミットメッセージ」「AI で衝突を解く」・チャットの編集中の差分の抑止を消した。履歴のドラッグの型はファイルの中に移した |
| `contrib/search/browser/*`（7ファイル） | AI の結果（下の5）、検索結果のチャットへの受け渡し、「Search with AI」、設定2つを消した |
| `contrib/tasks/*` | タスクの失敗の「Fix with AI」を消した |
| `contrib/terminal/*`・`terminalContrib/accessibility` | エージェントのホストのターミナル、「Attach To Chat」、チャットの口述の条件を消した。`terminalContribExports.ts` の ID は B-7 と同じ形で文字列に写した（読む側のため。登録はしない）。チャットのエージェントのツールの設定の登録は消えた |
| `contrib/update/browser/updateTitleBarEntry.ts` | チャットの要求中の文脈キーの更新を消した（既定値のまま） |

### 4. テスト・部品の見本

`api/test`（2）、`browserView`・`notebook`・`preferences`（3）・`search`・`terminal`・`workspace`・`files` のテスト、`services/{accounts,configuration,dialogs,policies,remote,search,workspaces}` のテスト、`platform/remote` のテスト、`test/browser/{workbenchTestServices.ts,actions/policyDiagnosticsMarkdown.test.ts}`、`componentFixtures/{fixtureUtils.ts,fixtureUtilsCss.ts,editor/tabs.fixture.ts}`。消した部品だけを見る項目は消した。エージェントのホストの URI を使うテストは、同じ scheme の普通の URI を作るようにした（`workspaceTrust.test.ts` は最小の `toAgentHostUri` の代わりを置いた）。

### 5. AI の検索

`contrib/search/browser/AISearch` は消した。ただし検索のビューの AI の結果の分岐（`searchView.ts` だけで AI の名前が約60か所、`searchModel.ts` の `aiSearch` など）は消さず、`searchTreeModel/searchResult.ts` に、隠れていて空の見出し（`RemovedAITextSearchHeadingImpl`）を AI の見出しの代わりに置いた。AI の提供者は登録できない（`registerAITextSearchProvider` は何もしない）ので、AI の結果は出ない。設定2つ（`search.searchView.semanticSearchBehavior`・`keywordSuggestions`）と「Search with AI」の操作は消した。上の表5の「分岐を消す」より小さなパッチにした（毎週の衝突を減らすため）。**別案**: 表5のとおり分岐を全部消す（`searchView.ts` だけで数百行の差分）。`services/search` の `aiText` は案Aのとおり残した。

## edits.patch の2回目の直し（2026-11-15）

1回目の判断を仰ぐ点の1〜4はリーダーが認めた（`docs/user-decisions.md` の「C-1 の edits.patch を作るときに出た点」）。2回目は、パッケージ化の前に要る直しを同じ edits.patch に足した。edits.patch は108ファイル、746行の追加、5407行の削除になった。

### 1. ビルドの台本

| ファイル | 直し方 |
|---|---|
| `build/gulpfile.vscode.ts` | 消したものは次のとおり。`lib/copilot.ts` からは `getRipgrepExcludeFilter`（ripgrep の不要な版の除外。検索が使う）だけを残した。`gulpfile.reh.ts` と `gulpfile.extensions.ts` は変えていない（下の「未確認」） |
| | ・Copilot のランタイムの版の確かめ（46〜48行。`@github/copilot-sdk` が無いと誤りを投げる）と `getLockedPackageVersion` |
| | ・product.json に書く `copilotVersions`・`agentSdks`・`dictationRuntime` |
| | ・foundry-local-sdk の除外 |
| | ・Copilot のランタイムの梱包（`ensureCopilotPlatformPackage`・`getCopilotRuntimePrebuildFiles`・Copilot と tgrep の除外） |
| | ・asar の外に出す `@github/copilot-sdk-*` と `@devcontainers/cli` |
| | ・Windows の Copilot CLI の起動台本（`bin/copilot-shim`） |
| | ・`OneAuthInterop.dll` の版の書き込み |
| | ・`prepareCopilotRipgrepShimTask` |
| | ・`compileCopilotExtensionBuildTask` |
| `build/gulpfile.ts`・`build/next/index.ts` | エージェントのホストの資格情報の暗号の束ね（`bundleAgentHostCrypto`）を、transpile・compile・watch・bundle から外した |
| `test/unit/browser/renderer.html` | 単体テストの import map から、エージェントのホストの暗号のモジュールの対応を外した |

`delete` に足したもの:
- `build/next/agentHostCrypto.ts`・`agentHostCryptoEntry.ts`・`test/agentHostCrypto.test.ts`
- `build/next/devTunnelsWeb.ts`・`devTunnelsWebEntry.js`・`test/devTunnelsWeb.test.ts`（1回目で束ねから外した、Agents の窓の web の dev tunnels）
- `build/npm/patches/foundry-local-sdk.patch`

### 2. Agents の窓へのリンク

| ファイル | 直し方 |
|---|---|
| `platform/windows/electron-main/windowsMainService.ts` | `openAgentsWindow` を、何も開かない形にした（`[]` を返す）。起動のとき（`--agents`、起動時の Agents のリンク）だけは、窓の無いまま動き続けないように、普通の窓を開く。呼び手（`app.ts` の2か所、`launchMainService`・`nativeHostMainService`・`onboardingTryoutHandoff`）は変えていない。前の3つは戻り値の数を見るだけなので誤りにならない（リンクは「扱わなかった」として返る）。`onboardingTryoutHandoff`（ようこその画面の「機能の例を Agents の窓で試す」）だけは、窓が無いと「Agents の窓に送れなかった」の誤りを投げる。ただし、Agents の窓に向けた機能の例（`targetWindow: 'agents'`）を登録する部品は残る src に無い（テストを除いて `grep` で確かめた）。そのため、手前の `onboardingTryoutWindow.ts` が「Agents の窓では使えない」として止め、ここまで来ない。Agents の窓のワークスペースのファイルも作らない |
| `platform/windows/electron-main/windowImpl.ts` | Agents の窓のページ（`sessions.html`）を読む分岐を外した。万一 Agents の窓のワークスペースを開いても、普通の画面になる |
| `platform/protocol/electron-main/protocolMainService.ts` | `sessions.html` の応答の見出しの分岐を外した |
| `platform/workspaces/electron-main/workspacesHistoryMainService.ts` | Windows のジャンプリストの「Agents Window」（`--agents` で起動する項目）を外した。`chat.disableAIFeatures` は C-1 で登録が無くなり、値が「AI 有効」と読まれるので、残すとこの項目が出る（下の3） |

### 3. `chat.disableAIFeatures` の登録が無くなることの影響（2回目に見つけた）

C-1 は設定 `chat.disableAIFeatures` の登録を消し、apply.mjs は mydist の既定（true）を外す。そのため、残る部品が `getValue(ChatAIDisabledSettingId)` を読むと `undefined` になり、「AI 有効」と判定される。残る読み手を全部見て、振る舞いが変わる所だけを直した。

| 読み手 | 判定 |
|---|---|
| `workspacesHistoryMainService.ts`（ジャンプリスト） | 「Agents Window」の項目が出る。上の2で外した |
| `browser/layout.ts`（新しい利用者のセカンダリサイドバー） | AI 有効なら、新しい利用者にセカンダリサイドバー（チャット）を空のワークスペースでも出す分岐。C-1 の前（既定 true）と同じ振る舞いにするため、分岐を外した |
| `commandCenterControl.ts`・`quickAccessActions.ts` | ほかの設定（`disableAICustomizations`・統合のクイックアクセス）と組み合わせて読む。その設定も登録が無いので、C-1 の前と結果は変わらない。直さない |
| `extensionsActions.ts`（AI の有効・無効の操作4つ） | `defaultChatAgent.chatExtensionId` の拡張だけに出る。C-1 は product.json の `defaultChatAgent` を消すので出ない。直さない |
| `extensionEnablementService.ts` | Copilot 拡張の移行。Null の契約のサービスは `context` を持たないので通らない。直さない |
| `terminalInstallActions.ts` | Copilot CLI の導入。`chatSetupHidden` が true（Null の契約のサービス）なので出ない。直さない |
| `managedSettingsUpdate.contribution.ts` | 組織のポリシーの最低の版の通知。ポリシーが無ければ出ない。直さない |
| `settingsLayout.ts` | 設定の画面の目次の ID の一覧。登録の無い ID は出ない。直さない |
| `extensions/git`（`repository.ts`） | AI の共著者の行。`git.addAICoAuthor` の既定が `off` なので変わらない。直さない |

### 4. MCP の設定の警告

`contrib/preferences/browser/preferencesRenderers.ts` の `McpSettingsRenderer` を消した。これは、ユーザー設定に `mcp` があると警告を出し、無くなったコマンド（`workbench.mcp.openUserMcpJson` など）へのクイックフィックスを出す部品。定数 `mcpConfigurationSection` は、ワークスペースのファイルで使える鍵の一覧のために残した。

### 5. 依存

C-1 で消した7つ（`@anthropic-ai/sdk` など）は、当てた後の `package.json` に無いことを確かめた。2回目では、消した AI の部品だけが使っていた依存も `removeDependencies` に足した（2026-11-14 のリーダーの規則の3「消す AI の部品だけが使うものは消す」）。

| 依存 | 1.146.0 の使い手（すべて C-1 で消える） |
|---|---|
| `@hpke/core`・`libsodium-wrappers` | `platform/agentHost` の資格情報の封印、`build/next/agentHostCrypto*` |
| `@devcontainers/cli` | `platform/agentHost/node/devContainerAgentHostService.ts`（起動するファイルの場所） |
| `@microsoft/dev-tunnels-connections`・`-contracts`・`-management`・`-ssh`・`-ssh-tcp` | `platform/agentHost/node/tunnelAgentHostService.ts`、`contrib/sessions` の web の dev tunnels、`build/next/devTunnelsWeb*` |
| `ssh2` | `platform/agentHost/node/sshRemoteAgentHostService.ts` |
| `ws` | `platform/agentHost` の WebSocket、`server/node/agentHostChannel.ts` |

- `remote/package.json` からも、`@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`ssh2`・`ws` を外した。
- `tar` は残した。`build/lib/util.ts`・`npmPackage.ts` がルートの `tar` を使うため。
- `test/smoke` と `scripts` は自分の `package.json` に `ws`・`ssh2`・dev-tunnels を持つので、影響しない。
- 使われなくなった台本 `bundle-dev-tunnels-web` は、`package.json` の `removeLines` で消した。

**ロックファイル**: 依存を消すと、pnpm は `pnpm-workspace.yaml` の `patchedDependencies` にある `foundry-local-sdk` のパッチが使われないとして、`ERR_PNPM_UNUSED_PATCH` で止まる（`pnpm install --lockfile-only` で確かめた）。そこで次の2つを足した。
- `pnpm-workspace.yaml` の `patchedDependencies:` と `foundry-local-sdk: build/npm/patches/foundry-local-sdk.patch` の2行を `removeLines` に足した
- パッチのファイルを `delete` に足した

その後の `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` は、ルートのロックファイルの削除だけ（768行）になった（`tasks/2026-11-15-p5-c1-patch/trial/round2-lockfile.diff`）。

2回目の時点では、`apply.mjs --lockfile-check` の結果は `fail` だった。消えた依存は19、パッケージは80で、どれも想定どおり。落ちた理由は `changedSections: ["patchedDependencies"]` だけで、当時の `compareLockfile` が節の変化を1つも許さなかったため。3回目に `compareLockfile` を直し、`ok` になった（下の「edits.patch の3回目の直し」）。

### 6. build/ の側の型検査

`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json` を走らせた。

- 本家の `pretypecheck`（`copy-policy-dto`。`src/.../policyExport/common/policyDto.ts` を `build/lib/policies/` に写す）は許可に無い。そこで同じ写しを手で置いた（git の管理外のファイル）。
- 残る誤りは1つ、`build/gulpfile.vscode.ts` 139行 `Property 'name' does not exist on type 'never'`。原因は `product.overlay.json` の `builtInExtensions: []`（A-3。2026-11-14 のリーダーの指示）で、C-1 ではない。gulp は型を見ずに走る（`--experimental-strip-types`）ので、パッケージ化は止まらない。
- C-1 の直しから来る誤りは無い。

## edits.patch の3回目の直し（2026-11-15）

2回目の判断を仰ぐ点の1〜4は、リーダーが判断した（`docs/user-decisions.md`）。認められたのは3つ。
- 依存の追加の削除
- `chat.disableAIFeatures` を読み手ごとに直す形
- `remote/pnpm-lock.yaml` は片づけの後のビルドで見ること

edits.patch は109ファイル、750行の追加、5417行の削除になった。

- **「バージョン情報」の Copilot の2行**（`platform/dialogs/electron-browser/dialog.ts`）: `@github/copilot` と `@github/copilot-sdk` の行、それに `formatCopilotVersion` を消した。
  - 翻訳の文字列の鍵は `aboutDetail` から `aboutDetailWithoutCopilot` に替えた。言語パックを入れたときに、2行を含む古い訳（`{8}`〜`{10}`）が当たって、引数がずれるのを避けるため。新しい鍵には訳が無いので、英語で出る。
  - Copilot の版の表示だけを見るテスト `platform/dialogs/test/electron-browser/dialog.test.ts` は `delete` に足した。
  - `checks.absentStrings` に、`dialog.ts` の `@github/copilot` を足した。
- **ロックファイルの検査**（`scripts/lib/apply/lockfile.mjs`。docs/03 の5.4）: 単位が `pnpm-workspace.yaml` の `patchedDependencies` の行（`<名前>: <パス>.patch`）を `removeLines` で消したとき、ロックファイルの `patchedDependencies` の節がその名前の分だけ減るのを許すようにした。
  - ほかの名前の増減、残る名前の中身の変化、ほかの節の変化は、今までどおり止める。
  - C-1 を当ててロックファイルを作り直すと、`--lockfile-check` は `ok`（`changedSections: []`、`removedPatches: ["foundry-local-sdk"]`）。

## Claude Code が使う API への影響

manifest（2.1.322）には `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`enabledApiProposals` が無い（`records/phase0/claude-code-manifest.md`）。提案中の API は呼べない（`checkProposedApiEnabled` が元どおり止める）ので、影響は安定版の API だけ。

| API | 何もしない実装の振る舞い | Claude Code が呼んだときの見込み |
|---|---|---|
| `vscode.lm.selectChatModels` | 空の配列で resolve | モデルが無い扱い。存在を確かめずに `[0]` を使うと undefined になる（圧縮されたコードは読まないので未確認） |
| `vscode.lm.onDidChangeChatModels` など各イベント | `Event.None`（Disposable を返す） | 壊れない |
| `vscode.lm.registerTool`・`registerLanguageModelChatProvider`・`registerMcpServerDefinitionProvider`・`registerIgnoredFileProvider` | 何もしない Disposable | 壊れない。登録したものは使われない |
| `vscode.lm.tools` | 空の配列 | 壊れない |
| `vscode.lm.invokeTool` | 「AI が無い」の誤りで reject | 呼べば誤り。catch していなければ拡張ホストのログに出る |
| `vscode.lm.fileIsIgnored` | false で resolve | 壊れない |
| `vscode.chat.createChatParticipant` | 何もしない参加者（id・requestHandler を持ち、イベントは `Event.None`） | 壊れない。チャットには出ない |
| `ExtensionContext.languageModelAccessInformation` | `canSendRequest` は undefined、`onDidChange` は `Event.None` | 壊れない |

関門で Claude Code の組（docs/07）を丁寧に行い、拡張ホストのログに `vscode.lm`・`vscode.chat` の誤りが出ないかを見る（docs/03 の9節）。

## 型検査で直す点（2026-11-14 の見込み。実際に直した点は上の「edits.patch で直した点」）

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

- 起動時に `depends on UNKNOWN service ...` が出たら、edits.patch で注入を外し損ねた引数がある（型検査は DI の登録を見ない）。名前のサービスを注入しているファイルを探して edits.patch を直す。MCP の認証の3つのサービスは残しているので、`authenticationMcp...` の名前では出ない見込み。
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

## 未確認（ビルドと関門で確かめる）

- 型検査が通るか: 2026-11-15 に確かめた（1回目・2回目とも誤り 0）。
- 済み（2回目）: `build/gulpfile.vscode.ts` の Copilot の梱包、`agentHostCrypto` の入口、Agents の窓へのリンク、`preferencesRenderers.ts` の MCP の警告。上の「edits.patch の2回目の直し」。
- 済み（3回目）: ロックファイルの検査（`--lockfile-check` が `ok`）と、「バージョン情報」の Copilot の2行。
- `remote/pnpm-lock.yaml` は作り直していない（リーダーの判断で、片づけの後のビルドの依存の導入で見る）。`build/npm/postinstall.ts` が `remote` も入れるので、そこで作り直され、検査は `remote` の分も比べる見込み。
- `build/gulpfile.reh.ts`（サーバーのビルド）と `build/gulpfile.extensions.ts` の `compileCopilotExtensionBuildTask` は直していない。reh はこのビルドで走らず、C-3 でファイルごと消える。`compileCopilotExtensionBuildTask` は、`extensions/copilot` が無ければ空を返す（A-1）。
- `package.json` の `copilotRuntimeVersion` の欄は残る（`removeDependencies` は依存の欄だけを消す）。読むのは `platform/product/common/product.ts` だけで、`@github/copilot-sdk` の版が無いので使われない。
- 拡張側の AI の検索（`mainThreadSearch`・`extHostSearch`・protocol の2つのメソッド・`services/search` の `aiText`）は残した。登録の入口が何もしないので使われない
- ターミナルの口述のメニューは、条件を `HasSpeechProvider` だけにした
- `chat.tools.terminal.*` とサンドボックスのファイルシステムの設定の登録は消えた（ID は文字列で残る）。設定の画面での見え方を関門で見る
- 直したテストを実際に走らせていない（型検査だけ）。`workspaceTrust.test.ts`（`toAgentHostUri` の代わり）、`fileSystemFileSearchProvider` の scheme、`settingsTree` のサンドボックスの表示のテスト、項目を消したテスト
- 起動時の DI（上の「壊れたときの症状」）
- `gulp vscode-win32-x64-min` が通るか。`build/next/index.ts` の esbuild の入口から消したものが無くても束ねが通るか（パッケージ化は片づけの許可の後）。
- 依存を消した後の `pnpm install`（`node_modules` の作り直し）。ロックファイルだけは2回目に確かめた（削除だけ）。
- 自作のビルドの通信の監査で、`release-assets.githubusercontent.com`（エージェントのホストがランタイムを取る通信）が出ないこと。

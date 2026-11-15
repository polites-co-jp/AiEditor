# Phase 5 の下ごしらえ（C-1 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

この文書の上の節は1回目の報告。2回目（追加の依頼の1〜7）は末尾の「2回目」の節、3回目（2回目の後の追加の依頼の1〜5）は「3回目」の節にある。上の節の数値（100ファイルなど）は1回目の時点のもの。

## 結果

**完了**（パッケージ化と関門は、依頼どおり行っていない）。

## 成果物

- `removals/C-1-ai/edits.patch`（新規）: 100ファイル（新規2）、710行の追加、5106行の削除。件名は `unit C-1-ai: edits`、作者は `shuko-apply`
- `removals/C-1-ai/unit.json`（直した）: `"patch": "edits.patch"` を足した。`delete`・`removeLines`・`kept`・`checks.absentStrings` も直した（下の「直した点」の1）。`enabled` は `false` のまま
- `removals/C-1-ai/README.md`（直した）: 状態を「edits.patch あり、関門の前」にした。足した節は「残すもの」の追加、「edits.patch を作るとき（2026-11-15）に足した・変えたもの」「edits.patch で直した点（2026-11-15）」「Claude Code が使う API への影響」。「未確認」も書き直した
- `tasks/2026-11-15-p5-c1-patch/typecheck-log.md`（新規）: 型検査の誤りの数の移り変わり、当て直しの確かめ、ディスク
- `tasks/2026-11-15-p5-c1-patch/trial/`: 適用の検査3つ（`checks-ops.json`・`checks-round2.json`・`checks-verify.json`）、型検査の記録9つ（`build-typecheck-{1..8,verify}.json`）
- `tasks/2026-11-15-p5-c1-patch/disk-start.json`・`disk-end.json`
- `scripts/` は直していない

## 要点

1. A・B の14単位と C-1 を当てた作業ツリーで、型検査（`pnpm run typecheck-client`）が誤り 0 で通った。誤りは 397 → 342 → 266 → 208 → 126 → 11 → 0 と減った。
2. タグから当て直すと、15単位すべてが `applied: ok` で、edits.patch も衝突なく当たった。検査は `ok`、型検査も誤り 0（HEAD `76d2530f`）。
3. 拡張 API の `vscode.chat`・`vscode.lm` は、新しいファイル `api/common/extHostRemovedApi.ai.ts` の何もしない実装に向けた。提案中の API の門（`checkProposedApiEnabled`）は元どおり。埋め込み（embeddings）は消さずに残した。
4. Claude Code の受け手のうち3つ（ワークスペースの信頼・コメント・Webview）に触れた。どれも消した部品の参照の行だけで、振る舞いは変えていない。
5. リーダーの判断を仰ぐ点が4つある（下の「判断を仰ぐ点」）。特に、MCP の認証の3つのサービスは消さずに残した。

## 直した点

一覧の正本は `removals/C-1-ai/README.md` の「edits.patch で直した点（2026-11-15）」。ここでは形だけを書く。

### 1. unit.json

- `delete` から外したもの: `services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts` とそのテスト2つ。これらは `kept` へ移した（下の「残した部品と理由」）。
- `delete` に足したもの:
  - 認証の MCP の操作2つ（`manageTrustedMcpServersForAccountAction.ts`・`manageAccountPreferencesForMcpServerAction.ts`）
  - ターミナルの案内 `contrib/terminalContrib/inlineHint`
  - テスト `notebookCellDiagnostics.test.ts`
  - 部品の見本 `migrationProgressNotification.fixture.ts`
- `removeLines`:
  - 外したもの: `workbench.common.main.ts` の authenticationMcp の import の3行
  - 足したもの: 消したファイルの import と登録の行。対象は `terminal.all.ts`・`terminal.contribution.ts`・`authentication.contribution.ts`・`debug.contribution.ts`・`markers.contribution.ts`・`search.contribution.ts`・`testing.contribution.ts`・`fixtureUtilsCss.ts`
- `kept` に足したもの:
  - MCP の認証の3つのサービス
  - absentStrings の除外6つ。どれもコメント・CSS・資料・見本のデータの中の文字列だけで、import ではない
- `checks.absentStrings`: build の `vs/sessions/` を `'vs/sessions/` に狭めた。`build/next/index.ts` のコメントに当たっていたため。

### 2. edits.patch の直し方の形

- **何もしない実装に向ける**:
  - 新規 `api/common/extHostRemovedApi.ai.ts`: `vscode.chat`・`vscode.lm`・`window.createAgentEditorComments`・`window.createChatStatusItem`・`workspace.registerAITextSearchProvider`・`interactive.transferActiveChat`・`ExtensionContext.languageModelAccessInformation`
  - 新規 `services/chat/common/nullChatEntitlementService.ts`: 契約なし、チャットは隠して無効。文脈キー `chatSetupHidden`・`chatSetupDisabled` を true にする
- **protocol の整理**: `extHost.protocol.ts` から、消した API の Shape・DTO・`MainContext`／`ExtHostContext` の ID を消した。2026-11-14 の判断の2のとおり。ID を残すと `rpcProtocol.assertRegistered` で落ちる。`extHostTypeConverters.ts` からは、チャット・LM・ツール・MCP・フック・セッションの変換、約1,850行を消した。
- **値をファイルの中に写す**: 消した部品の定数だけを使う所は、同じ値をファイルの中に置いた。
  - 対象の定数: `AGENT_HOST_SCHEME`、`mcp.enterpriseManagedAuth.idp`、MCP の秘密の鍵の形、`agentHostTcpMaxConnections = 256`、ターミナルの設定の ID など
  - コメントは `// Shuko (C-1-ai): ... same value as ...`
- **分岐・登録・注入を消す**: チャット・インラインチャット・MCP・エージェントのホストに渡す操作、メニュー、案内、`@I...Service` の引数（派生クラスの `super(...)` の引数も合わせた）。main・共有プロセス・CLI（`--add-mcp`）・サーバー（`--agent-host-ca`）・`build/next/index.ts`（web の Agents の窓）も同様。
- **テスト**: 消した部品だけを見る項目は消した。残る部品のテストが消した部品の小さな関数を使う所は、テストの中に最小の代わりを置いた（`workspaceTrust.test.ts` の `toAgentHostUri` など）。

## 残した部品と理由

| 部品 | 理由 |
|---|---|
| `services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts`（新しく残した） | 残る認証の照会 `authenticationQueryService.ts` が3つを注入する。MCP の名前は、このファイルに119か所、共通の型 `common/authenticationQuery.ts` に31か所ある。保存だけで通信はしない。2026-11-14 の規則の3「残る部品が使うものは使い手を書いて残す」に当てた |
| 拡張側の AI の検索の配線（`mainThreadSearch`・`extHostSearch`・protocol の2つのメソッド・`services/search` の `aiText`） | 検索そのもの（裁定で残す）と同じファイルにある。登録の入口 `registerAITextSearchProvider` を何もしない実装にしたので、使われない |
| 検索のビューの AI の結果の分岐（`searchView.ts`・`searchModel.ts`） | 隠れていて空の見出し `RemovedAITextSearchHeadingImpl`（`searchTreeModel/searchResult.ts`）を AI の見出しの代わりに置き、分岐は残した。パッチを小さくし、毎週の衝突を減らすため |
| `ChatEditorInputDto`（protocol） | エディタのタブの DTO の種類の一つで、タブの API の型に入っている |
| 埋め込み（`vscode.lm` の embeddings の4つ） | `ExtHostEmbeddings` は C-1 で消すファイルに入っていない。何もしない実装からそのまま渡した |
| absentStrings の除外6ファイル | コメント・CSS・資料・見本のデータの中の文字列だけ |

前から残すと決まっていたもの（`services/chat`、`platform/chat`、`contrib/speech`、`common/agentsColors.ts`、`contrib/imageCarousel`、`contrib/comments`、Claude Code の受け手）は、README の「残すもの」のとおり。

## Claude Code の API への影響

- manifest（2.1.322、`records/phase0/claude-code-manifest.md`）には、`enabledApiProposals`・`chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders` が無い。提案中の API は元どおり止まるので、影響は安定版の API だけ。
- 安定版の API を呼んだときの振る舞い（README の「Claude Code が使う API への影響」の表）:

  | API | 振る舞い |
  |---|---|
  | `lm.selectChatModels` | `[]` |
  | `lm.tools` | `[]` |
  | `lm.registerTool`・`registerLanguageModelChatProvider`・`registerMcpServerDefinitionProvider`・`registerIgnoredFileProvider` | 何もしない Disposable |
  | 各イベント | `Event.None` |
  | `lm.invokeTool` | reject（`Tool "<name>" was not found: The built-in AI features are removed from this build`） |
  | `lm.fileIsIgnored` | `false` |
  | `chat.createChatParticipant` | 何もしない参加者 |
  | `languageModelAccessInformation` | `canSendRequest` は `undefined`、`onDidChange` は `Event.None` |

- 触れた受け手は次の3つ。どれも振る舞いは変えていない。
  - ワークスペースの信頼: `workspaceTrust.ts`・`workspace.contribution.ts`。定数 `vscode-agent-host` を同じ値で写しただけ
  - コメント: `simpleCommentEditor.ts`。口述の部品の1行を外しただけ
  - Webview: `mainThreadWebviewManager.ts`。チャットの出力の描き手の登録を外しただけ
- セカンダリサイドバー・差分エディタ・拡張のファイルシステム・JSON の検査には触れていない。
- 圧縮されたコードの中で `vscode.lm` を呼んでいるかは分からない（裁定で読まない）。関門の Claude Code の組で、拡張ホストのログを見る（docs/03 の9節）。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）は8回走らせ、7回目で誤り 0 になった。回ごとの数は `typecheck-log.md`。
- タグから当て直した結果（`node scripts/apply.mjs C:/b/wt/p2 --label c1-verify --only <15単位> --checks-out .../trial/checks-verify.json`）:
  - `result: ok`
  - C-1-ai の edits は `applied: ok`、`conflicts: []`
  - `remnants`・`absentStrings` は `ok`
  - `removedDefaults` に `chat.disableAIFeatures` が出た（想定どおり）
- その上の型検査は `result: ok`、`exitCode: 0`、誤り 0（`C:\b\logs\c1tc-verify\typecheck.log`）。
- ディスク: C: の空きは、始めが 21.22 GB、終わりが 20.09 GB。15 GB に近づかなかった。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れていない。新しい作業ツリーは作っていない。
- 作業ツリー `C:\b\wt\p2` は、15単位を当てた状態で残した。HEAD は `76d2530fb55f93556bcfaf85a0f937791249ef54`、未コミットの変更は 0。

## テストの入口（曹参へ）

1. **当て直し**
   - コマンド: `node scripts/apply.mjs C:/b/wt/p2 --label <label> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai --checks-out <file>`
   - 期待: `result` が `ok`。`units[id=C-1-ai].edits` が `{applied: "ok", subject: "unit C-1-ai: edits", conflicts: []}`。`checks.remnants.status` と `checks.absentStrings.status` が `ok`。`removedDefaults` に `{key: "chat.disableAIFeatures", unit: "C-1-ai"}` が入る
2. **型検査**
   - コマンド: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result` が `ok`、`steps[0].exitCode` が 0。`sourceVersion.value` が作業ツリーの HEAD と一致する
3. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `removals/C-1-ai/unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-1-ai: edits`
   - `kept` に `services/authentication/browser/authenticationMcpService.ts` など3つがある
   - `delete` と `kept` に同じパスが無い
   - `removeLines` の各行が、`delete` したファイルの import か登録の1行である
4. **何もしない実装**（作業ツリーの中。VS Code のテストの仕組みで書く場合）
   - `createRemovedLanguageModelApi(ext, embeddings)`: `selectChatModels()` が `[]` で resolve する。`registerTool('x', ...)` が `dispose` を持つ。`invokeTool('x', ...)` が reject する
   - `createRemovedChatApi(ext).createChatParticipant('p', handler).id` が `'p'`
   - 提案中の API のメンバー（たとえば `chat.registerChatSessionItemProvider`）は、提案を有効にしていない拡張では誤りを投げる
   - `NullChatEntitlementService` を作ると、文脈キー `chatSetupHidden`・`chatSetupDisabled` が true になる。`entitlement` は `Unknown`
5. **直した既存のテスト**（未実行）: `workspaceTrust.test.ts`、`fileSystemFileSearchProvider` のテスト、`settingsTree` のテスト、`policyDiagnosticsMarkdown.test.ts`、`accountPolicyService.test.ts`、`api/test` の2つ。型検査は通るが、走らせていない。関門の前に、作業ツリーの `scripts/test.bat`（ブラウザー・node のテスト）で走らせるのがよい

## 判断を仰ぐ点（別案）

1. **MCP の認証の3つのサービスを残した**（docs/03 の表と違う）
   - 採った案: 残す（`kept`）
   - 別案: `authenticationQueryService.ts` と `common/authenticationQuery.ts` から MCP の分を消して、3つも消す。2つのファイルにある約150か所の MCP の名前に触れることになり、パッチが大きくなって毎週の衝突が増える
2. **AI の検索を「分岐を残して空の見出しを置く」形にした**（README の 2026-11-14 の表5の「分岐を消す」より小さくした）
   - 別案: `searchView.ts` などの AI の分岐を全部消す
3. **ターミナルの案内 `terminalContrib/inlineHint` を消した**（README の表に無かった、足したもの）
   - 設定 `terminal.integrated.initialHint` が無くなる。この部品はチャットのエージェントにだけ使う
   - 別案: チャットの参照だけを外して部品を残す
4. **`chat.tools.terminal.*` とサンドボックスのファイルシステムの設定の登録が消えた**
   - ID は、読む側（ターミナルのサンドボックスなど）のために文字列で残した
   - 残る部品がこの設定の値を読むときは、既定値ではなく `undefined` になる。関門の設定の画面と、ターミナルで見る

## docs/ との食い違い

- docs/03 の表（131行）の C-1-ai は `services/authentication/browser/authenticationMcp*` を消すと書く。実際は残した（上の1）。採るなら docs/03 の表を直す必要がある。
- docs/03 の表（131行）は `services/chat` を消すものに挙げる。一方 141行と user-decisions（217行）は「何もしない実装で残す」と書く。実装は後者に合わせた（前からある食い違い）。

## 未解決の点

- **`build/gulpfile.vscode.ts` は直していない**。46〜48行は、`@github/copilot-sdk` が無いと誤りを投げる。ほかに foundry・`copilotVersions`・Copilot のランタイムの梱包・shim・`compileCopilotExtensionBuildTask` が残る。型検査の対象ではないが、**パッケージ化の前に edits.patch に足す必要がある**（README の「未確認」に行番号つきで書いた）。
- `build/next/index.ts` のデスクトップの束ねに、`agentHostCrypto` の入口が残る。
- Agents の窓の新しいセッションのリンク（`app.ts` の `openAgentsWindow`、`windowImpl`・`protocolMainService`）が残る。開く先が無いので、リンクを踏むと誤りになる見込み。
- `preferencesRenderers.ts` の MCP の設定の警告は、無くなったコマンドを指す（MCP の設定が無いので出ない見込み）。
- 起動時の DI（注入の外し損ね）は、型検査では見えない。起動の確かめで見る。
- 依存を消した後の `pnpm install` とロックファイルの差分は、まだ見ていない（`node_modules` は使い回した）。
- 許可に無かったコマンド: `ls`・`head`・`sed`・`awk`（読むだけの用途）。Read と Grep で代えたので、仕事は止まっていない。許可の追加は要らない。

---

## 2回目（2026-11-15、追加の依頼の1〜7）

### 結果

**一部完了**。直しの1〜4、6、7は済んだ。5の依存は外し、ルートのロックファイルの差分は削除だけになった。

ただし `apply.mjs --lockfile-check` は `fail`（`patchedDependencies` の節が変わるため）。これを通すには `scripts/` の直しが要る。brief の守りでは「先に報告」なので、手を付けていない。下の「判断を仰ぐ点」の1。

### 成果物

- `removals/C-1-ai/edits.patch`（作り直した）: 108ファイル（新規2）、746行の追加、5407行の削除。件名は `unit C-1-ai: edits`、作者は `shuko-apply`、From の commit は `a5eaaf68`
- `removals/C-1-ai/unit.json`（直した）
  - `delete` に7つ足した: `build/next/agentHostCrypto.ts`・`agentHostCryptoEntry.ts`・`test/agentHostCrypto.test.ts`・`devTunnelsWeb.ts`・`devTunnelsWebEntry.js`・`test/devTunnelsWeb.test.ts`、`build/npm/patches/foundry-local-sdk.patch`
  - `removeDependencies` に足した: ルートに10、`remote` に5
  - `removeLines` に3行足した: `package.json` の `bundle-dev-tunnels-web`、`pnpm-workspace.yaml` の `patchedDependencies` の2行
  - `checks.absentStrings` に7つ足した
- `removals/C-1-ai/README.md`: 足した節は「edits.patch の2回目の直し（2026-11-15）」。状態の行と「未確認」も直した
- `tasks/2026-11-15-p5-c1-patch/typecheck-log.md`: 4節「2回目」を足した
- `tasks/2026-11-15-p5-c1-patch/trial/`: `round2-typecheck-1.json`・`round2-typecheck-verify.json`・`round2-typecheck-verify2.json`・`round2-checks-verify.json`・`round2-lockfile.diff`
- `tasks/2026-11-15-p5-c1-patch/disk-start-2.json`・`disk-end-2.json`
- 作業ツリーに置いた、git の管理外のファイル: `C:\b\wt\p2\build\lib\policies\policyDto.ts`（本家の `copy-policy-dto` と同じ写し。build/ の型検査のため）
- 誤って作った空のファイル: `tasks/2026-11-15-p5-c1-patch/typecheck-log.md.round2.tmp`（中身は `placeholder` の1語）。`rm` が許可に無いので消せていない。**リーダーに消してほしい**
- `scripts/` は直していない

### 要点

1. パッケージ化の前に要る直し（gulpfile の Copilot の梱包、agentHostCrypto、Agents の窓へのリンク、MCP の警告）を edits.patch に足した。タグからの当て直しは15単位とも衝突なく `ok`、型検査は誤り 0（HEAD `f6336a8d`）。
2. **2回目に見つけた C-1 の副作用**: `chat.disableAIFeatures` の登録が消え、mydist の既定も外れる。そのため、残る読み手には「AI 有効」と読まれる。読み手を全部見て、振る舞いが変わる2か所を直した。
   - Windows のジャンプリストの「Agents Window」
   - 新しい利用者のセカンダリサイドバー
3. 依存: C-1 で消した7つが無いことを確かめた。加えて、消した AI の部品だけが使っていた依存を外した（2026-11-14 の規則の3）。ルートは `@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・dev-tunnels の5つ・`ssh2`・`ws`、`remote` は5つ。
4. **依存を外すと、本物の `pnpm install` は `ERR_PNPM_UNUSED_PATCH` で止まる**（`foundry-local-sdk` のパッチ）。`pnpm-workspace.yaml` の2行を消して直した。その後のルートのロックファイルの差分は削除だけ（768行）。
5. build/ の側の型検査は、C-1 による誤りが 0。残る1件は `product.overlay.json` の `builtInExtensions: []`（A-3）から来る、型だけの誤り。

### 直した点

一覧の正本は README の「edits.patch の2回目の直し（2026-11-15）」。

| 依頼 | ファイル | 直し方 |
|---|---|---|
| 1 | `build/gulpfile.vscode.ts` | 外したもの: Copilot のランタイムの版の確かめ（46〜48行）、`copilotVersions`・`agentSdks`・`dictationRuntime` の書き込み、foundry の除外、Copilot のランタイムの梱包と除外、asar の外の `copilot-sdk-*`・`@devcontainers/cli`、`bin/copilot-shim`、`OneAuthInterop.dll`、`prepareCopilotRipgrepShimTask`、`compileCopilotExtensionBuildTask`。残したのは `getRipgrepExcludeFilter` だけ |
| 2 | `build/next/index.ts`・`build/gulpfile.ts`・`test/unit/browser/renderer.html` | `bundleAgentHostCrypto` を bundle・transpile・watch・gulp の3つのタスクから外した。単体テストの import map も外した。台本とテストのファイルは `delete` |
| 3 | `windowsMainService.ts` | `openAgentsWindow` は何も開かず `[]` を返す。起動のときだけ普通の窓を開く |
| 3 | `windowImpl.ts`・`protocolMainService.ts` | `sessions.html` の分岐を外した |
| 3 | `workspacesHistoryMainService.ts` | ジャンプリストの「Agents Window」を外した |
| 3 | `layout.ts` | 新しい利用者のセカンダリサイドバーの特別扱いを外した（C-1 の前と同じ振る舞い） |
| 4 | `preferencesRenderers.ts` | `McpSettingsRenderer`（無くなったコマンドへのクイックフィックスを出す部品）を消した |
| 5 | `unit.json` | 依存、`pnpm-workspace.yaml` の2行、`bundle-dev-tunnels-web`、foundry のパッチのファイル |

### 確かめたこと

- 直しの後の型検査（`node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch ...`）は `ok`、誤り 0。
- タグに戻して（`git -C C:/b/wt/p2 checkout 1.146.0`）当て直した。
  - 15単位すべてが `applied: ok`。C-1-ai の edits は `conflicts: []`、warnings は空
  - 適用後の検査（remnants・absentStrings。足した7つを含む）は `ok`
  - その上の型検査は `ok`、誤り 0（HEAD `f6336a8d0fe5706100b1f3ca3f3bb69c6596a69e`、未コミット 0）
- `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts`:
  - `pnpm-workspace.yaml` を直す前は `ERR_PNPM_UNUSED_PATCH` で止まった
  - 直した後はルートの `pnpm-lock.yaml` が削除だけ（768行）になった。消えた依存は19、パッケージは80
- `apply.mjs --lockfile-check` は `fail`。理由は `changedSections: ["patchedDependencies"]` だけで、`unexpectedRemovedDeps`・`addedDeps`・`changedDeps`・`addedPackages` はどれも空だった。
- 検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- build/ の型検査（`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`）は、`policyDto.ts` を置いた後で誤り1件（139行、A-3 の `builtInExtensions: []`）。C-1 による誤りは 0。
- ディスク: C: の空きは 20.09 GB から 19.91 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのデータには触れていない。新しい作業ツリーは作っていない。

### テストの入口（曹参へ）

1. **当て直し**: 1回目と同じコマンド。期待は次のとおり。
   - `result: ok`、C-1-ai の edits は `conflicts: []`
   - 当てた後の `package.json` の `dependencies` に `@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`@microsoft/dev-tunnels-*`・`ssh2`・`ws` が無い
   - `remote/package.json` に `@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`ssh2`・`ws` が無く、`tar` は残る
   - `pnpm-workspace.yaml` に `patchedDependencies` が無い
   - `build/next/agentHostCrypto.ts`・`devTunnelsWeb.ts` と `build/npm/patches/foundry-local-sdk.patch` が無い
2. **単位のファイルの静的な検査**: `checks.absentStrings` に足した7つ（`getCopilotRuntimeVersion`・`renderCopilotShimLauncher`・`bundleAgentHostCrypto`・`electron-browser/sessions${`・`isSessionsWorkbench`・`'--agents'`・`workbench.mcp.open`）が、当てた後の対象のファイルに無い。
3. **ロックファイル**: `pnpm --dir <作業ツリー> install --lockfile-only --ignore-scripts` の後、`node scripts/apply.mjs <作業ツリー> --label <l> --lockfile-check --checks-out <f>` を走らせる。期待は今のところ `fail`（`changedSections` が `patchedDependencies` だけ）。下の判断の1で `scripts/` を直したら `ok`。`compareLockfile` の単体テストとして、「`patchedDependencies` の節が、単位の消したパッチの分だけ減るのは許す」を足すのがよい。
4. **起動の確かめ**（関門）:
   - `--agents` を付けて起動すると、普通の窓が1つ開く
   - 起動中に `<urlProtocol>://` の Agents の新しいセッションのリンクを開いても、何も開かず誤りも出ない
   - Windows のジャンプリストに「Agents Window」が無い（portable では、ジャンプリストそのものを作らない）
   - 新しいユーザーのデータで、空のワークスペースのときにセカンダリサイドバーが勝手に開かない
   - ユーザー設定に `"mcp": {}` を書いても、警告とクイックフィックスが出ない

### 判断を仰ぐ点

1. **ロックファイルの検査（`scripts/lib/apply/lockfile.mjs` の `compareLockfile`）**: 単位が `pnpm-workspace.yaml` の `patchedDependencies` の行を消したときに、ロックファイルの `patchedDependencies` の節がその名前の分だけ減ることを許すように直したい。これは `scripts/` の変更で、brief の守りでは「先に報告」なので行っていない。
   - 直さないと、ビルドの依存の導入の後の検査で C-1 を当てた版が止まる
   - 別案: C-1 では `foundry-local-sdk` の依存を消さず、パッチと一緒に残す。docs/03 の表の依存の削除と食い違う
2. **依存の追加の削除**（2回目の要点3）: 2026-11-14 の規則の3に当てはめて、10と5の依存を外した。どれも 1.146.0 の使い手が C-1 で消えることを `grep` で確かめた。外さない別案もある（パッケージが大きくなるだけで、動きは変わらない）。
3. **`chat.disableAIFeatures` の副作用への直し方**: 読み手ごとに直す形を採った（ジャンプリストと `layout.ts` の2か所）。
   - 別案: 設定 `chat.disableAIFeatures` を消さずに、隠した登録（既定 true）を残す。読み手を直さずに済むが、`checks.absentSettings` の `chat.disableAIFeatures` と食い違う
4. **「バージョン情報」の Copilot の2行**（`@github/copilot: Unknown` など）: 翻訳の文字列なので直していない。消すなら `platform/dialogs/electron-browser/dialog.ts` を edits.patch に足す。

### docs/ との食い違い

- docs/03 の5.4 は「差分が消した依存の削除だけであることを確かめる」とある。実際は、依存を消すと `pnpm-workspace.yaml` の `patchedDependencies` と、ロックファイルの同じ名前の節も変わる。検査の台本も docs/03 の5.4 も、この場合を扱っていない。
- docs/03 の表（C-1-ai）の依存は、1回目の7つまでで、2回目に足した依存（`@hpke/core` など）が無い。採るなら表を直す必要がある。

### 未解決の点

- 上の判断の1（ロックファイルの検査）。
- `remote/pnpm-lock.yaml` は作り直していない。`pnpm --dir C:/b/wt/p2/remote install --lockfile-only --ignore-scripts` が許可に無いため（許可の `pnpm --dir C:/b/wt/* install` の `*` が `p2/remote` に一致しない）。必要なら、`remote` の依存を作り直してロックファイルの差分を見るための許可を足してほしい。
- `build/gulpfile.reh.ts`（サーバー）は Copilot の梱包を持ったまま。このビルドで走らず、C-3 で消える。
- `gulp vscode-win32-x64-min`（パッケージ化）、起動、`node_modules` の作り直しはまだ（片づけの許可の後）。
- 直したテストはまだ走らせていない。
  - 1回目の分
  - `onboardingTryoutHandoff.test.ts`。`openAgentsWindow` を差し替えて試すので、影響しない見込み
  - レイアウトの新しい利用者のテスト（あれば）

---

## 3回目（2026-11-15、2回目の後の追加の依頼の1〜5）

### 結果

**完了**。

### 成果物

- `scripts/lib/apply/lockfile.mjs`（直した）: 直したのは `compareLockfile` と `expectedLockRemovals`。足したのは `sectionEntries` と `patchNameFromWorkspaceLine`。
- `scripts/lib/apply/checks.mjs`（直した）: `checkLockfiles` の記録に `unexpectedPatchChanges`・`removedPatches` を足した。
- `removals/C-1-ai/edits.patch`（作り直した）: 109ファイル（新規2）、750行の追加、5417行の削除。From の commit は `e51a893b`。
- `removals/C-1-ai/unit.json`（直した）:
  - `delete` に `src/vs/platform/dialogs/test/electron-browser/dialog.test.ts` を足した
  - `checks.absentStrings` に、`dialog.ts` の `@github/copilot` を足した
- `removals/C-1-ai/README.md`: 「edits.patch の3回目の直し（2026-11-15）」を足し、状態の行と「未確認」を直した。
- `tasks/2026-11-15-p5-c1-patch/trial/`: `round3-checks-verify.json`（適用とロックファイルの検査）、`round3-typecheck-verify.json`、`round3-lockfile.diff`。
- `tasks/2026-11-15-p5-c1-patch/disk-end-3.json`
- `typecheck-log.md.round2.tmp` は、指示どおり手を付けずに残した。

### 要点

1. `compareLockfile` は、単位が `pnpm-workspace.yaml` から消したパッチの名前の分だけ `patchedDependencies` の節が減るのを許す。ほかの変化は今までどおり止める。
2. C-1 を当ててロックファイルを作り直すと、`--lockfile-check` が `ok` になった。`changedSections: []`、`removedPatches: ["foundry-local-sdk"]`、`unexpectedPatchChanges: []`。
3. 「バージョン情報」から Copilot の2行を消した。翻訳の鍵は、言語パックの古い訳で引数がずれないように、新しい名前（`aboutDetailWithoutCopilot`）にした。
4. タグからの当て直しは15単位とも衝突なく `ok`、型検査は誤り 0（HEAD `15ac0428`）。

### 直した関数の入口（曹参へ）

`scripts/lib/apply/lockfile.mjs`:

```
compareLockfile(beforeText, afterText, expected) → { ok, changedSections, ..., removedPatches, unexpectedPatchChanges }
  expected.removedPatches: string[]  （単位が消した patchedDependencies の名前。tests/lockfile-patched.test.mjs の KEYS の 'removedPatches'）
```

許す条件は次のとおり。`patchedDependencies` の節を、2字下げのキーごとに比べる。キーの中身は、キーの行の値と、その下の深い行（`hash:`・`path:` など）を合わせたもの。

| 前と後の違い | 扱い |
|---|---|
| 前にあって後に無い名前が `expected.removedPatches` にある | 許す（`removedPatches` に入る） |
| 前にあって後に無い名前が `expected.removedPatches` に無い | `unexpectedPatchChanges` に `{ name, change: "removed" }` |
| 両方にある名前の中身が違う | `{ name, change: "changed" }` |
| 後にだけある名前 | `{ name, change: "added" }` |

- `unexpectedPatchChanges` が空なら、`patchedDependencies` は `changedSections` に入らない（節ごと無くなった場合も同じ）。空でなければ、今までどおり `changedSections` に入り、`ok` は false。
- 宣言（`expected.removedPatches`）は許可であって要求ではない。何も減っていなければ、宣言があっても `ok`。
- ほかの節（`settings` など）の変化、importer・依存・packages・snapshots の判定は変えていない。
- `removedPatches` は、実際に節から消えた名前（並べ替え済み）。宣言の有無に関係なく入る。

```
expectedLockRemovals(lockDir, importers, units) → { removedImporters, removedDeps, removedPatches }
```

- `removedPatches` は、`units[].removeLines` のうち `file` が `<lockDir>/pnpm-workspace.yaml`（ルートは `pnpm-workspace.yaml`）で、`line` が `<名前>: <…>.patch` の形のものの名前（重なりを除いて並べ替え済み）。
- `patchedDependencies:` の見出しの行や、`- src/...` のような行は名前にならない。
- 前からある `removedImporters`・`removedDeps` は変えていない。

```
patchNameFromWorkspaceLine(line) → string | null
```

`"foundry-local-sdk: build/npm/patches/foundry-local-sdk.patch"` は `"foundry-local-sdk"` を返す。`"patchedDependencies:"` と `"- src/vs/sessions/test/e2e"` は null。名前は引用符で囲まれていてもよい（`'@a/b@1.0.0': x.patch` は `@a/b@1.0.0`）。

```
sectionEntries(sectionText) → Map<名前, 中身>
```

`parsePnpmLock(text).sections[節]` を渡す。節が無い（undefined）なら、空の Map を返す。

足すとよいテスト:
- `expectedLockRemovals` が `removeLines` から `removedPatches` を読むこと（ルートと、`lockDir` が違う場合）
- `patchNameFromWorkspaceLine` の境目（`.patch` で終わらない値、引用符つきの名前）
- `checkLockfiles` の記録に、`unexpectedPatchChanges`・`removedPatches` が載ること

自分では `node --test` を走らせていない（許可に無い）。確かめたのは `node --check` と、実際のロックファイルでの `--lockfile-check`（下）。`tests/lockfile-patched.test.mjs` は、読んで、すべての項目が今の実装で期待どおりになることを追った。

### 確かめたこと

- `node --check scripts/lib/apply/lockfile.mjs`、`node --check scripts/lib/apply/checks.mjs`: 誤り無し。
- タグに戻して当て直した（`round3-checks-verify.json`、label `c1r3-verify`）。
  - `result: ok`、15単位すべてが `applied: ok`。C-1-ai の edits（commit `868d7f89`）は `conflicts: []`
  - warnings は無く、fail・warn の検査も無い
- 型検査（`round3-typecheck-verify.json`）は `ok`、誤り 0（HEAD `15ac04281d43300578d96ba0b219c8ac026a03f4`、未コミット 0）。
- `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` の後の `apply.mjs --lockfile-check` は `ok`。
  - ルートの `pnpm-lock.yaml` は `ok`: `changedSections: []`、`unexpectedPatchChanges: []`、`removedPatches: ["foundry-local-sdk"]`、`unexpectedRemovedDeps: []`、消えた依存は19
  - ほかのロックファイルは変わらず `ok`（`extensions/copilot` のものは `removed`）
  - 検査の後、ロックファイルを `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。作業ツリーは当てた直後の状態で、未コミット 0
- build/ の型検査は、2回目と同じ1件だけ（139行、A-3 の `builtInExtensions: []`）。
- ディスク: C: の空きは、3回目の始め 19.91 GB（`disk-end-2.json`）、終わり 19.70 GB（`disk-end-3.json`）。

### テストの入口（曹参へ。C-1 の分）

当て直しの後の確かめ:
- `src/vs/platform/dialogs/electron-browser/dialog.ts` に `@github/copilot`・`formatCopilotVersion`・`key: 'aboutDetail'` が無い（コメントには `'aboutDetail'` の語があるので、`key: ` を付けて探す）
- 同じファイルに `aboutDetailWithoutCopilot` がある
- `src/vs/platform/dialogs/test/electron-browser/dialog.test.ts` が無い

関門の起動の確かめ:
- 「ヘルプ > バージョン情報」の詳細が「Version / Commit / Date / Electron / ElectronBuildId / Chromium / Node.js / V8 / OS」の9行で、Copilot の行が無い

### docs/ との食い違い

無し。docs/03 の5.4 と C-1 の表は、リーダーが直した後の形に合っている。

### 未解決の点

- `node --test tests/lockfile-patched.test.mjs` は許可に無いので、走らせていない（曹参か大岡越前守の確かめ）。
- `remote/pnpm-lock.yaml`、パッケージ化、起動、`node_modules` の作り直しは、片づけの後。
- 直した既存のテストは、まだ走らせていない（1回目・2回目の分）。

---

## 4回目（2026-11-15、absentStrings の1項目の直し）

### 結果

**完了**。

### 直したこと

曹参の指摘（`tasks/2026-11-15-p5-c1-tests/handoff-notes.md` の「2回目」）を受けて、`removals/C-1-ai/unit.json` の `checks.absentStrings` の1項目を替えた。

- 対象のファイル: `src/vs/workbench/contrib/preferences/browser/preferencesRenderers.ts`
- 替える前: `"workbench.mcp.open"`。本家のファイルにもともと無い文字列で、守りになっていなかった。
- 替えた後: `"class McpSettingsRenderer"`。
  - 本家 1.146.0 にある: `C:\b\wt\1.146.0` の同じファイルの796行 `class McpSettingsRenderer extends Disposable implements languages.CodeActionProvider {`
  - 当てた後には無い。消し損ねると当たる。
  - 例に挙がった `McpSettingsRenderer` だけにしなかったのは、edits.patch が足したコメント（50行 `// in user settings (McpSettingsRenderer) is removed, ...`）に当たり、消しても検査が落ちるため。

edits.patch は変えていないので、型検査は走らせていない。

### 確かめたこと

タグに戻して（`git -C C:/b/wt/p2 checkout 1.146.0`）、15単位を当て直した。記録は `tasks/2026-11-15-p5-c1-patch/trial/round4-checks-verify.json`（label `c1r4-verify`）。

- `result: ok`。C-1-ai の edits（commit `96e8d790`）は `conflicts: []`。fail・warn の検査は無い。
- `checks.absentStrings.status` は `ok`。替えた項目 `{ unit: "C-1-ai", text: "class McpSettingsRenderer", in: ["src/vs/workbench/contrib/preferences/browser/preferencesRenderers.ts"] }` は `hitCount: 0`。
- HEAD は `76f002490184c560218c734381baf3845e7f674c`、作業ツリーの未コミットの変更は 0。

### 曹参へ

2回目の節の「テストの入口」の2に挙げた7つのうち、`workbench.mcp.open` は `class McpSettingsRenderer` に読み替えてほしい。

---

## 5回目（2026-11-15、大岡越前守の検証の軽微な指摘の1〜4）

### 結果

**完了**。作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した。`git -C C:/b/wt/p2 status --short` は空で、未コミットの変更は 0。`node_modules` と、git の管理外の `build/lib/policies/policyDto.ts` はそのまま残っている。

### 直したこと

| 指摘 | ファイル | 直し方 |
|---|---|---|
| 1 | `removals/C-1-ai/unit.json` | `kept` の `authenticationMcpService.ts` の理由の末尾を、「残すことは 2026-11-15 にリーダーが認めた（docs/user-decisions.md）」に直した。`services/chat` の理由も、下の2の置き方に合わせた |
| 1 | `removals/C-1-ai/README.md` | 「消すもの」の依存の行を、今の17と7に直した。`pnpm-workspace.yaml` の行の削除も足した。2回目の5の「直すには `scripts/` の変更が要る」は、3回目に直して `ok` になった、と書き直した |
| 2 | `services/chat/common/chatEntitlementService.ts` | `NullChatEntitlementService` を、別のファイル `nullChatEntitlementService.ts` から、同じファイルの末尾（`registerSingleton` の直前）に移した。新しいファイルは edits.patch から無くなり、2つのファイルが互いに import し合う形が無くなった。`workbench.*.main.ts` は変えていない（docs/03 の5.3） |
| 3 | `removals/C-1-ai/unit.json` | `pnpm-workspace.yaml` の `allowBuilds` の4行を `removeLines` に足した（下）。残したものも下 |
| 4 | `removals/C-1-ai/README.md` | 「残すもの」に、build/ の AI の台本（`build/agent-sdk/`・`build/dictation-runtime/`・`apply-sdk-canary-override.ts`・`build/lib/test/` の一部・`gulpfile.reh.ts` など）を、残す理由（手元のパッケージ化から呼ばれない）と一緒に書いた。台本は直していない |

指摘3で `removeLines` に足した4行（3回目のロックファイルの検査で、作り直したロックファイルから消えたパッケージ）:
- `foundry-local-sdk@2.2.1: true`
- `bufferutil@4.1.0: true`
- `utf-8-validate@5.0.10: true`
- `koffi@3.2.1: false`

残したもの:
- `ssh2: false` と `cpu-features: false`。ルートの依存からは外したが、`test/smoke`（pnpm のワークスペースの1つ）が `ssh2` を使うので、作り直したロックファイルにも `ssh2@1.17.0` と、その依存 `cpu-features` が残る。
- `overrides` の `koffi: 3.2.1`・`node-gyp-build: 4.8.1`。指摘の範囲の外で、ロックファイルの検査も `ok`。

edits.patch の2の直し方は、git の `rm` が許可に無いため、次の手順で作った。
1. C-1 の ops の commit を checkout した。
2. 前の edits の commit から、`nullChatEntitlementService.ts` を除く全部を `git -C C:/b/wt/p2 checkout <sha> -- . :!<そのファイル>` で戻した。
3. `chatEntitlementService.ts` を直した。
4. 新しい commit にした（作者は `shuko-apply`）。

edits.patch は108ファイル（新規は `extHostRemovedApi.ai.ts` の1つ）、742行の追加、5418行の削除。From の commit は `9ab6123d`。

### 確かめたこと

- 直した後、commit の前の型検査（`trial/round5-typecheck-1.json`）は `ok`、誤り 0。
- タグに戻して15単位を当て直した（`trial/round5-checks-verify.json`、label `c1r5-verify`）。
  - `result: ok`。C-1-ai の edits（commit `823bb30b`）は `conflicts: []`。fail・warn の検査は無い
  - HEAD は `bf504a70`
  - 当てた後の `pnpm-workspace.yaml` には、外した4行と `patchedDependencies` が無く、`ssh2: false` は残る
- 型検査（`trial/round5-typecheck-verify.json`）は `ok`、誤り 0（HEAD `bf504a70`、未コミット 0）。
- `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` の後の `--lockfile-check` も `ok`（同じ記録に追記した。差分は `trial/round5-lockfile.diff`）。
- ロックファイルを戻した後、`git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。未コミット 0。
- ディスク: C: の空きは 19.45 GB（`disk-end-5.json`）。

### 曹参・大岡越前守へ

- `services/chat/common/nullChatEntitlementService.ts` は無くなった。テストや検査がこのファイル名を見ているなら、`chatEntitlementService.ts` の中の `export class NullChatEntitlementService` に読み替えてほしい。
- `removeLines` に `pnpm-workspace.yaml` の4行が増えた。
- 大岡越前守の当て直しは、タグの状態の `C:\b\wt\p2` から、1回目と同じ `apply.mjs ... --only <15単位>` で始められる。

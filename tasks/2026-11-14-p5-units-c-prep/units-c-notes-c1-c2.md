# 段階 C の下準備: C-1-ai と C-2-debug（中身・根拠・未確認の点）

- 書いた人: 蒙恬（C-1・C-2 の分）。2026-11-14。
- 出典: 本家 1.146.0（commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）の作業ツリー `C:\b\wt\1.146.0`（読むだけ）と、試しの作業ツリー `C:\b\wt\dev-c1`。型検査とビルドは走らせていない。参照は `grep` で探した。
- 単位ごとの詳しい中身・残したもの・型検査で直す点の表・未決は、各単位の `README.md`（`removals/C-1-ai/`・`removals/C-2-debug/`）にある。ここには全体の判断と根拠を書く。

## 1. 作ったもの

| 単位 | order | after | delete | removeLines | removeDependencies | productRemove |
|---|---|---|---|---|---|---|
| C-1-ai | 310 | A-1・B-1・B-2 | 107 | 92 | ルート6・`remote` 2 | 6 |
| C-2-debug | 320 | A-3 | 71 | 17 | なし | なし |

どちらも `enabled: false`。`patch` のキーは `edits.patch` を作るまで書かない（差し戻しで直した。docs/03 の3.1）。C-1 の delete は差し戻しの後 111（AI の検索と、テスト3つを足した）。`smoke` は `base`・`claude-code`・`powershell`・`languages`・`absence`。

## 2. C-1 の範囲の決め方

docs/03 の表の C-1 の行を出発点に、1.146.0 で「chat・mcp・agentHost を import している部品」を `grep` で洗い、次の基準で分けた。

1. AI のためだけの部品（名前と中身が AI。chat を多く import する）→ 消す。docs/03 の表に無いものは README に「足した」と書いた。最大のものは Agents の窓（`src/vs/sessions`）で、本家 1.146.0 では別の入口（`build/next/index.ts` の `vs/sessions/sessions.desktop.main`・`vs/sessions/electron-browser/sessions`、`build/gulpfile.vscode.ts` の checksum の一覧）を持つ窓になっている。残すと chat への参照を数百か所直すことになるので、窓ごと消し、入口の行を `removeLines` で消した。
2. 残る部品が ID を注入しているサービス → 残して、何もしない実装を登録する（B-1〜B-3 の形）。C-1 では `services/chat`（`IChatEntitlementService`）がこれに当たる。docs/03 の表は消す側に入れているが、拡張の有効・無効のサービス（`extensionEnablementService.ts`）をはじめ約12の残る部品が注入しているため。
3. 残る部品の中のチャット専用のファイル（`*ChatContext.ts`、言語モデルのツール）→ ファイルを消し、登録している行を型検査で直す。1行の import なら `removeLines`（`browserView.contribution.ts`・`codeEditor.contribution.ts`・`notebook.contribution.ts`・`terminal.all.ts`）。
4. Claude Code が使う受け手（docs/03 の9節、`records/phase0/claude-code-manifest.md`）→ 消さない。コメント（`simpleCommentEditor.ts`）とワークスペースの信頼（`workspaceTrust.ts`）は、消した部品（口述・agent host の URI）を参照しているので型検査で直すが、直すのは参照の行だけにする（README に太字で書いた）。
5. 消すか迷うもの → 残して README の未決に書いた（`contrib/speech`・`agentsColors.ts`・`platform/artifactIntegrations`・`contrib/imageCarousel`・`platform/otel`・依存 `@modelcontextprotocol/sdk`）。

## 3. C-2 の範囲の決め方

- `contrib/debug/common` はまるごと残した。`IDebugService` と型・コンテキストキーを、テスト・タスク・アクセシビリティ・拡張の画面・リモート・ノートブック・拡張 API の protocol が使う。`debug.ts` が `debugModel.ts` などを import するので、一部だけ残すと芋づるで型検査が通らない。
- 本家 1.146.0 には、Agents の窓のための `NullDebugService`・`NullDebugVisualizerService`（`common/nullDebugService.ts`。`sessions.common.main.ts` 295〜299行で登録）がもうある。C-2 はこれを使う。登録の置き場所が main のファイルの1行になる（README の未決の1。docs/03 の5.3 との食い違い）。
- `extensionHostDebugService.ts`（browser・electron-browser）は残した。拡張機能のホストの起動が `IExtensionHostDebugService` を注入するため（`localProcessExtensionHost.ts` 135行）。docs/03 の表の「desktop の1行」はこの import なので、消すと全部の拡張が起動しない。
- テストの呼び出し履歴の部品（`callStackWidget.ts` と依存の3ファイル・CSS 2つ）は、テスト（裁定で残す）の結果のビューが使うので残した。
- ノートブックの中のデバッグの部品（`notebook/browser/contrib/debug`・`notebookVariables`）は C-2 で消した。C-4 より C-2 が先に当たり、消すデバッグの部品を import しているため。

## 4. 拡張 API の空の実装（docs/03 の2節の4、5.3）

- 置き場所: `src/vs/workbench/api/common/extHostRemovedApi.ai.ts`（C-1）、`extHostRemovedApi.debug.ts`（C-2）。単位ごとに別のファイル。
- 形: `typeof vscode.lm`・`typeof vscode.chat`・`typeof vscode.debug` を満たすオブジェクトを返す関数。登録は何もしない Disposable、問い合わせは空、イベントは `Event.None`、実行（`invokeTool`・`startDebugging`）は失敗か false。
- `extHost.api.impl.ts` の変更は、名前空間の `const lm/chat/debug = ...` の右辺と、消した extHost のサービスを作る行・import の行だけにする。`window`・`workspace` の中のチャットの4つ（エージェントのコメント・チャットのステータス・アクティブなチャットのセッション・チャットの移送）も C-1 のファイルの関数に向ける。
- extHost のサービスの登録（`extHost.common.services.ts`・`extHost.node.services.ts`）と main thread の受け手の import（`extensionHost.contribution.ts`）は1行ずつの一覧なので `removeLines` にした（C-1・C-2・C-4 が同じファイルを触るため）。
- `extHost.protocol.ts` は chat・言語モデル・MCP の型を import している（C-1 の README の未決の2）。C-2 は残す `debug/common` の型だけなので直さない。

## 5. docs/ との食い違い（リーダーへ）

1. docs/03 の4節の C-1 の行: `services/chat` は消せない（上の2の2）。表に無い AI の部品を足した（上の2の1。README の一覧）。
2. docs/03 の4節の C-2 の行: 「desktop の1行」は `extensionHostDebugService` の import で、消すと拡張が起動しない。消すのは common の6行だけ。
3. docs/03 の5.3: C-2 の `IDebugService` の登録に main のファイルへ1行足す必要がある（C-2 の README の未決の1）。
4. docs/02 の3節: `chatParticipantRegistry`・`agentSdks`・`dictationRuntime`・`copilotVersions` は 1.146.0 の OSS の product.json に無い（試しで4つとも「無い」の警告が出た）。C-1 の `productRemove` から外した。`removeIfPresent` に置く案。`copilotVersions` はパッケージ化のときに `build/gulpfile.vscode.ts` 207〜209行が書き込む。
5. docs/03 の4節の C-1 の依存: VSCodium の名前の4つ（`@github/copilot-sdk`・`@anthropic-ai/claude-agent-sdk`・`@openai/codex`・`@vscode/copilot-api`）は 1.146.0 にあった（「要照合」は解けた）。ほかに `@anthropic-ai/sdk`・`foundry-local-sdk` も AI の依存だったので足した。

## 6. 未確認（全体）

- 型検査（`compile`）とビルド。README の表は import の文から作ったもので、型だけの参照・文字列の参照の取りこぼしがありうる。
- `build/gulpfile.vscode.ts` が `@github/copilot-sdk` の版を起動時に照合して throw する（46〜48行）。C-1 の `edits.patch` で外さないと、依存を消した後のパッケージ化が止まる。
- 依存を消した後の `pnpm install` とロックファイル。
- Claude Code・PowerShell 拡張の起動（関門のスモーク）。とくに C-1 の後の Claude Code の組（docs/07 の8節）。

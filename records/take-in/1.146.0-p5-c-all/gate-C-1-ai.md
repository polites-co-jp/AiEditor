# 関門: C-1-ai（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16
- 全体の記録: `gate-p5-c-all.md`（同じフォルダ）
- 判定: **不合格**（7節の4「壊れていない」）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、edits は件名 `unit C-1-ai: edits`・衝突なし、absentStrings 28項目すべて記録があり `hitCount: 0`、removedDefaults に `chat.disableAIFeatures`。`node tests/c1-check-json.mjs <checks.json>` は「期待どおり」、`node tests/c1-check-worktree.mjs <作業ツリー>` も「期待どおり」 |
| 2 型検査とビルド | 合格（全体の記録の1節） |
| 3 消えている | 判定できない（起動して見る項目は、ワークベンチが起動しないため取れない） |
| 4 壊れていない | **不合格**。下の2つの症状 |

## 症状

### 症状1: ワークベンチが起動しない

- スモーク（`tmp\b\smoke\runs\p5-c-82f-261116T024952\`）の prime と本番、`absent-run`（`tmp\b\smoke\absent\p5-522-261116T025823\`）の3回とも、ウィンドウは開くが中身が動かない。probe が動かず timeout。
- `logs\window1\renderer.log` は空。共有プロセス・拡張ホストのログは作られない。`logs\main.log` は7行で止まる。
- 開発者ツールのコンソール（`chromium.log`）の、ただ1行の誤り:

```
[59188:1116/115143.357:INFO:CONSOLE:1847] "Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'chatExtensionId')", source: vscode-file://vscode-app/e:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all/Shuko-win32-x64-1.146.0-p5-c-all/resources/app/out/vs/workbench/workbench.desktop.main.js (1847)
```

### 症状2: CLI の `--install-extension` が全部落ちる

- スモークの `base.ext-install`: 台帳の8つ（Claude Code 2.1.322・basedpyright・PowerShell・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パック）すべてが `Error while installing extensions: i.builtInExtensionsEnabledWithAutoUpdates is not iterable`。
- docs/04 の「CLI の `--install-extension` で台帳の拡張を入れる」道が使えない。C-5 の台本で「最重要」とした道でもある。

## 切り分け（どの単位か）

原因は C-1 の `productRemove`（`removals/C-1-ai/unit.json` の254〜261行）。

- C-1 は product.json から `defaultChatAgent`・`trustedExtensionAuthAccess`・`builtInExtensionsEnabledWithAutoUpdates`・`sessionsWindowAllowedExtensions`・`voiceWsUrl`・`agentsTelemetryAppName` を外す。出力の `resources\app\product.json` に `defaultChatAgent` が無いことを Grep で確かめた（0件）。
- 残った本家のコードが、そのうち2つを `?.` なしで読む。`IProductConfiguration`（`src/vs/base/common/product.ts` の264行・282行）では、どちらも省略できない型なので、型検査には掛からない。
  - 症状1: `src/vs/workbench/services/accounts/browser/defaultAccount.ts` の `toDefaultAccountConfig(productService.defaultChatAgent)`（158行の `DefaultAccountService` の構築、1668行）。98行で `defaultChatAgent.chatExtensionId` を最初に読む。出力の `workbench.desktop.main.js` の1847行（コンソールの誤りの行と同じ）に `preferredExtensions:[s.chatExtensionId,s.extensionId]` があることを Grep で確かめた。`services/accounts` は C-6 が依存のため残すとしたもの（docs/03 の4節）で、本家のまま
  - 症状2: `src/vs/platform/extensionManagement/common/extensionsScannerService.ts` の113行 `for (const id of productService.builtInExtensionsEnabledWithAutoUpdates)`（「not iterable」の文と合う）
- 段階 A・B の14単位の版（`1.146.0-p2-all`）には、このキーが残っていた。その版は、同じスモークの組を3回とも通っている（`records/phase2/phase2-close.md`）。
- C-2〜C-7 は、このキーに触れていない（`removals/*/unit.json` の `productRemove` と `defaultChatAgent` を Grep。A-2 の理由の文に名前が出るだけ）。

同じ形の読み手（今回はまだ通っていない道。推定で同じく落ちる）:

| キー | 場所 |
|---|---|
| `defaultChatAgent` | `platform/extensionManagement/common/extensionGalleryService.ts` 1234行・2058〜2061行、`platform/extensionManagement/common/abstractExtensionManagementService.ts` 1001行、`workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` 3000行 |
| `builtInExtensionsEnabledWithAutoUpdates` | `platform/extensionManagement/node/extensionManagementService.ts` 947行、`platform/extensionManagement/common/extensionManagementCLI.ts` 389行 |

`trustedExtensionAuthAccess`（`typeof … === 'object'` と `?.` で見る）と `sessionsWindowAllowedExtensions`（`new ExtensionIdentifierSet(undefined)` は空の集まりになる）は、無くても落ちない作りだった。`voiceWsUrl` は server の側だけ、`agentsTelemetryAppName` は `||` の左にあるだけ。

## 直す必要があるところ（誰の成果のどこか）

- **蒙恬（C-1 の unit.json と edits.patch）**: 外した2つのキーの読み手を直すか、キーを外すのをやめる（または空の値を置く）。どちらにするかは、ほかの案（裁定の「product.json の AI のキーは消す」との兼ね合い。`defaultChatAgent` には URL が入っていて、残すと通信の元になりうる）があるので、リーダーが決める。直したら、上の表の読み手もまとめて見る。
- **曹参（C-1 のテスト）**: `tests/c1-unit.test.mjs` に、「`productRemove` のキーを、残る `src/` が `?.` や既定値なしで読んでいない」ことの検査が無い。この版の誤りは、静的なテストでは捕まえられなかった。
- スモークの台本の穴（コンソールの誤りを数えない）と、起動の確かめの穴（ワークベンチを見ない）は、全体の記録の5節。

## C-1 を無効にした版について

C-3〜C-7 は `after` に C-1 を挙げているので、C-1 だけを無効にした版は作れない（docs/03 の5.1、7節の末尾）。C-1 を無効にするなら C-3〜C-7 も無効になり、残るのは C-2 だけになる。直すか無効にするかは、リーダーが決める。

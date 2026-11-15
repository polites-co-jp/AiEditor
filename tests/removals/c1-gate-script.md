# C-1（本家の AI）: 大岡越前守が走らせる台本

曹参が書いた。自分では走らせていない（`C:\b\wt\p2` に書き込むため）。期待の値は、蒙恬の handoff-notes（`tasks/2026-11-15-p5-c1-patch/handoff-notes.md`）と `removals/C-1-ai/unit.json` から写した。行数・sha は期待に含めない。

前提: `tests/c1-unit.test.mjs`（静的な検査）が先に通っている。作業は `C:\b\wt\p2` と `C:\b\logs\` の下だけ。`C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0`・普段使いのエディタのデータには触れない。始める前と終わりに C: の空きを測る（15 GB を切ったら止める）。

## 1. 当て直し（タグから15単位）

```
node scripts/apply.mjs C:/b/wt/p2 --label c1-gate --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai --checks-out C:/b/logs/c1-gate/checks.json
```

期待（checks.json）。照らす手順は `node tests/c1-check-json.mjs C:/b/logs/c1-gate/checks.json`（下の3）。照らし役は `tests/` の直下に置いてある(許可 `node tests/*.mjs` に合わせた。以前は `tests/removals/` の下にあり、走らせられなかった)。

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| 単位の数 | 15。すべて `applied: ok`（A-1 から C-1 まで） |
| `units[id=C-1-ai].edits` | `applied: "ok"`、`subject: "unit C-1-ai: edits"`、`conflicts: []` |
| `checks.remnants.status` | `ok` |
| `checks.absentStrings.status` | `ok`（C-1 の `absentStrings` 21項目すべて。見つかったら出力の場所を見る） |
| `removedDefaults` | `{key: "chat.disableAIFeatures", unit: "C-1-ai"}` を含む |
| 作業ツリーの未コミットの変更 | 0（2の型検査の記録の `sourceVersion.uncommittedEntries` が 0。`git status` は使わない) |
| 作業ツリーに残ってはいけないもの | `src/vs/sessions/`、`src/vs/workbench/contrib/{chat,inlineChat,mcp}/`、`src/vs/platform/{agentHost,mcp}/`、`src/vs/workbench/services/{agentHost,mcp}/` |
| 作業ツリーに残るべきもの | `src/vs/workbench/services/chat/`、`src/vs/platform/chat/`、`contrib/comments/`、`contrib/speech/`、`services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts`、`api/common/extHostRemovedApi.ai.ts`(新しいファイルはこの1つだけ)、`services/chat/common/chatEntitlementService.ts`(末尾に `NullChatEntitlementService` の定義と登録。5回目で別のファイル `nullChatEntitlementService.ts` をやめた。このファイルが**残っていてはいけない**) |

### 1b. 当てた後の作業ツリーの状態（2回目の入口の1）

```
node tests/c1-check-worktree.mjs C:/b/wt/p2
```

`package.json`・`remote/package.json` に C-1 が外した依存（`unit.json` の `removeDependencies` の全部）が無い、`remote` に `tar` が残る、`pnpm-workspace.yaml` に `patchedDependencies` が無い、`scripts.bundle-dev-tunnels-web` が無い、`delete` したパス（`build/next/agentHostCrypto.ts`・`devTunnelsWeb.ts`・`build/npm/patches/foundry-local-sdk.patch` を含む）が無い、`kept` のパスと新しいファイル2つが残る。0 = 期待どおり。

`checks.absentStrings`（2回目で足した7つを含む28項目）は、1の checks.json の `checks.absentStrings` を `c1-check-json.mjs` が照らす（`unit.json` の項目が全部記録にあり、`hitCount` が 0）。7つ目は4回目で `workbench.mcp.open`（本家に文字列そのものが無く、守っていなかった）から `class McpSettingsRenderer` に替わった。

### 1c. ロックファイル（2回目の入口の3、3回目の直しの後）

```
pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts
node scripts/apply.mjs C:/b/wt/p2 --label c1-lock --lockfile-check --checks-out C:/b/logs/c1-gate/checks-lock.json
node tests/c1-check-json.mjs C:/b/logs/c1-gate/checks-lock.json
```

期待: `checks.lockfile.status` が `ok`。`pnpm-lock.yaml`（ルート）は削除だけで、`changedSections` が空、`unexpectedPatchChanges` が空。`compareLockfile` は `removedPatches: ["foundry-local-sdk"]` を受けて、`patchedDependencies` の節の減りを許す。直す前（2回目の記録 `round2-checks-verify.json`）は `fail`（`changedSections: ["patchedDependencies"]`）。検査の後、ロックファイルは `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻す。`remote/pnpm-lock.yaml` は、`pnpm --dir C:/b/wt/p2/remote install --lockfile-only --ignore-scripts` が許可に無く、まだ作り直していない（許可を足すか、片づけの後に行う）。

2回目の当て直し（べき等）: 同じ作業ツリーに同じコマンドをもう一度かけたときの扱いは、`apply.mjs` の仕様（docs/03 の5.3）に従う。タグから戻してやり直す形（`--label` を変える）で、結果が同じ（`result: ok`、HEAD の木が同じ）ことを見る。

## 2. 型検査

```
node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record C:/b/logs/c1-gate/typecheck.json --take-in-dir C:/b/logs/c1-gate/take-in
```

| 項目 | 期待 |
|---|---|
| `result` | `ok` |
| `steps[0].exitCode` | 0（誤り 0。ログ `typecheck.log` に `error TS` が無い） |
| `sourceVersion.value` | 40桁の sha。`checks.json` の `headCommit` と同じ(`node tests/c1-check-json.mjs` が照らす) |
| `sourceVersion.uncommittedEntries` | 0(未コミットの変更が無い。1の「未コミット 0」はここで見る) |
| `sourceVersion.error` | `null` |

誤りが出たとき: 誤りの出るファイルが edits.patch の中の直しの漏れか、他の単位との重なりかを分けて、蒙恬に返す。

## 3. 期待を照らす補助（読むだけ）

`tests/c1-check-json.mjs` は、上の1の checks.json と2の記録を読み、期待の表と照らして一覧を出す。書き込みはしない。

```
node tests/c1-check-json.mjs <checks.json> [<typecheck.json>]
```

終了コード 0 = 期待どおり、1 = 食い違いあり（理由を標準出力に出す）。

## 4. 何もしない実装の「走らせる形」（VS Code のテストの仕組み。実行は大岡越前守、任意）

静的な検査（`tests/c1-unit.test.mjs`）は文字列と構文で確かめる。振る舞いを実際に走らせる形は、作業ツリーで次のテストを足して `scripts/test.bat`（node のテスト）か `pnpm run test-node` で走らせる。足す場所は作業ツリー側なので、書くのは蒙恬か大岡越前守。ここに入口だけを書く。

- `createRemovedLanguageModelApi(ext, embeddings)`: `selectChatModels()` が `[]` で resolve。`registerTool('x', ...)` が `dispose` を持つ。`invokeTool('x', ...)` が reject し、文言が `Tool "x" was not found: The built-in AI features are removed from this build`
- `createRemovedChatApi(ext).createChatParticipant('p', handler).id` が `'p'`
- 提案を有効にしていない拡張で `chat.registerChatSessionItemProvider(...)` を呼ぶと誤り（`checkProposedApiEnabled`）
- `new NullChatEntitlementService(contextKeyService)` で、文脈キー `chatSetupHidden`・`chatSetupDisabled` が true、`entitlement` が `Unknown`
- 直した既存のテスト（未実行）: `workspaceTrust.test.ts`、`fileSystemFileSearchProvider` のテスト、`settingsTree` のテスト、`policyDiagnosticsMarkdown.test.ts`、`accountPolicyService.test.ts`、`api/test` の2つ

## 5. 関門のスモーク（片づけの許可の後）

`smoke`: `base`, `claude-code`, `powershell`, `languages`, `absence`。`absence` で、`checks` の `absentCommands`（`workbench.action.chat.open`、`inlineChat.start`、`search.action.showAIResults`）・`absentViews`（`workbench.panel.chat`、`workbench.views.mcp.installed`）・`absentSettings`（6つ）・`absentProcesses`（`agent-host`）・`absentHosts`（`release-assets.githubusercontent.com`）を見る。Claude Code の組では、拡張ホストのログに `vscode.lm`・`vscode.chat` の誤りが出ないことを見る（docs/03 の9節）。起動時の DI（`UNKNOWN service`）の外し損ねは、型検査では見えない。起動のログで見る。

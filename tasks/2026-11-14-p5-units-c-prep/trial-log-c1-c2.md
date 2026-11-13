# 試しの記録（C-1・C-2。作業ツリー C:\b\wt\dev-c1）

- 日付: 2026-11-14。担当: 蒙恬（C-1・C-2 の分）。
- 作業ツリー: `git -C C:/b/vscode worktree add C:/b/wt/dev-c1 1.146.0` で作った（HEAD `69047191fc4`）。`C:\b\wt\1.146.0` は読むだけで、最後に `git -C C:/b/wt/1.146.0 status --short` で変更が無いことを確かめた。
- 依存の導入・型検査・ビルドは走らせていない。
- 記録の JSON は `trial-c1c2/` に置いた。

## 当て方の工夫

C-1・C-2 は `patch: "edits.patch"` を宣言しているが、ファイルはまだ無い。`apply.mjs` は ops のコミットの後で「patch が無い」で止まり、`absentStrings` の検査を飛ばす。そこで試しの間だけ、`unit.json` の `patch` を外し、`after` を空にして当て、終わったら元に戻した（最後の f で、戻した後の形を確かめた）。2回目以降は `patches/` を当て直さないように、空のフォルダ `trial-c1c2/no-patches/` を `--patches` に渡した。

## 回と結果

| 回 | コマンド（要点） | 結果 | 記録 |
|---|---|---|---|
| a | `node scripts/apply.mjs C:/b/wt/dev-c1 --label trial-c1c2-ab --only A-1〜A-7,B-1〜B-7` | **ok**。A＋B の ops・edits、`patches/20`・`30`、assets、mydist が当たった。HEAD `3c73ea6f3b2` | `trial-c1c2/checks-ab.json` |
| b | a の上に `--only C-1-ai --patches trial-c1c2/no-patches` | ops は全部当たった（`missingDeletes` 0、`removeLines` 92件がすべて期待の数。`count: 2` の4件は2）。結果は fail（下の `absentStrings` の残りと、registeredKeys の注） | `trial-c1c2/checks-c1.json`（HEAD `8b2e9dbdde8`） |
| c | a に戻して `--only C-2-debug` | ops は全部当たった（`missingDeletes` 0、`removeLines` 17件すべて1）。fail は `absentStrings` の残り2件と registeredKeys の注 | `trial-c1c2/checks-c2.json`（HEAD `21329406eb8`） |
| d | b の上に `--only C-2-debug` | ops は全部当たった。警告1件: `debugChatIntegration.ts` が本家に無い（C-1 が先に消したため。意図どおり） | `trial-c1c2/checks-c1-c2.json`（HEAD `b928acfa4c4`） |
| e | 1.146.0 に戻して、元に戻した `unit.json` で `--dry-run --only A-1〜B-7,C-1-ai,C-2-debug` | A・B の全単位と C-1 の ops は当たり、C-1 の「patch が無い」で止まった（期待どおり。JSON の形と `after` の順は通った） | `trial-c1c2/checks-dry-run.json` |
| f | `--dry-run`（`--only` なし。今の `enabled` のまま） | **ok**。C-1・C-2 は `enabled: false` なので当たらない。普段のビルドに響かない | `trial-c1c2/checks-default-dry-run.json` |

作業ツリーは d の状態（A＋B＋C-1＋C-2 の ops、HEAD `b928acfa4c4`）で残した。検証と、型検査の後の `edits.patch` 作りに使える。

## absentStrings の残り（edits.patch で0にする数）

C-1（回 b）:

| 文字列 | 残り |
|---|---|
| `contrib/chat/` | 57 |
| `contrib/inlineChat/` | 1 |
| `contrib/mcp/` | 4 |
| `platform/agentHost/` | 38 |
| `services/agentHost/` | 1 |
| `platform/mcp/` | 36 |
| `services/mcp/` | 0 |
| `terminalContrib/chat/` | 1 |
| `/chat/common/participants/chatAgents.js'` | 13 |
| `/chat/common/languageModels.js'` | 3 |
| `/chat/common/tools/languageModelToolsService.js'` | 3 |
| `/mcp/common/mcpTypes.js'` | 5 |
| `/agentHost/common/agentService.js'` | 2 |
| `./extHostChatAgents2.js'`（api） | 1 |
| `./extHostLanguageModels.js'`（api） | 2 |
| `./extHostMcp.js'`（api） | 1 |
| `vs/sessions/`（`build/next/index.ts`・`gulpfile.vscode.ts`） | 3（web の入口。README の2の表） |
| `"@github/copilot-sdk"`（package.json） | 0 |

`contrib/chat/` などの数には、相対でない参照（`api` の import、`.md`・`.css`・テストの JSON の中の文字列）も入る。相対の import（`'../../chat/...'`）は下の名前の針で数えた。

C-2（回 c と d で同じ）: `debug/browser/repl.js'` 1（`replNotebook/browser/repl.contribution.ts` 38行）、`/extHostDebugService.js'` 1（`extHost.api.impl.ts` 55行）。ほかの9件は0。

## registeredKeys の fail について

b・c・d の registeredKeys の fail は、`mydist` の既定の `workbench.startupEditor`（B-2）・`terminal.integrated.suggest.enabled`（B-7）・`chat.disableAIFeatures`（C-1。d だけ）が「登録が無い」になったもの。`apply.mjs` は、その回に当てた単位の `absentSettings` だけを `mydist` から外す。A＋B と C を別の回に分けて当てたので、前の回の単位の分が外れなかった。単位の誤りではない（1回で全部当てれば外れる）。

## 差し戻しの後の当て直し（2026-11-14）

検証（`tasks/2026-11-14-p5-verify-c-prep/handoff-notes.md`）の差し戻しを受けて、`unit.json` から `patch` のキーを外し、C-1 に AI の検索（`contrib/search/browser/AISearch`）と、消したものだけを見るテスト3つ（`searchChatContext.test.ts`・`authenticationMcpService.test.ts`・`authenticationMcpAccessService.test.ts`）を足した。

| 回 | コマンド（要点） | 結果 | 記録 |
|---|---|---|---|
| g | 1.146.0 に戻して、本物の `removals/` のまま `--only A-1〜A-7,B-1〜B-7,C-1-ai,C-2-debug`（試し用の書き換えも `--patches` の差し替えもなし。1回で全部） | ops・edits・`patches/20`・`30`・assets・mydist まで止まらずに当たった（`stoppedAt` null）。removeLines はすべて期待の数（`count: 2` の4件は2）。`missingDeletes` は C-2 の `debugChatIntegration.ts` 1件だけ（意図どおり）。fail は `absentStrings` だけで、A・B の針はすべて0。**registeredKeys は ok**（1回で当てたので、前の回の注は消えた）。remnants・unclassifiedExtensions・commitIdentity も ok | `trial-c1c2/checks-ab-c1-c2-rework.json`（HEAD `e7197c49da0`） |
| h | `--dry-run`（`--only` なし。今の `enabled` のまま） | ok。C-1・C-2 は当たらない | `trial-c1c2/checks-default-dry-run.json`（上書き） |

g の `absentStrings` の残りは、上の表と同じ数に `AISearch/aiSearchModel` 5（`searchView.ts`・`searchResult.ts`・`searchResultsView.ts`・`searchCompare.ts`・`searchActionsRemoveReplace.ts`）が加わった。C-2 は1・1のまま。

作業ツリー `C:\b\wt\dev-c1` は g の状態（HEAD `e7197c49da0`）で残した。`C:\b\wt\verify-p2` には触れていない。`node tests/run-all.mjs` は私の許可に無いので走らせていない（曹参か大岡越前守に頼む）。

## リーダーの判断（未決の5点）の後の当て直し（2026-11-14）

| 回 | コマンド（要点） | 結果 | 記録 |
|---|---|---|---|
| i | 1.146.0 に戻して、本物の `removals/` のまま `--only A-1〜A-7,B-1〜B-7,C-1-ai,C-2-debug`（1回で全部） | 止まらずに当たった。removeLines はすべて期待の数（足した4行も1件ずつ）。依存は `@modelcontextprotocol/sdk`（devDependencies）を含めて消えた。`missingDeletes` は C-2 の `debugChatIntegration.ts` 1件だけ。fail は `absentStrings` だけ。足した針は `artifactIntegrations/common/` 1（`extHost.protocol.ts` 35行。Shape と一緒に消す）、`common/agentsSizes.js'` 0。ほかの数は回 g と同じ。registeredKeys・remnants・unclassifiedExtensions・commitIdentity は ok | `trial-c1c2/checks-ab-c1-c2-rework2.json`（HEAD `8d5cdfd0b17`） |

作業ツリー `C:\b\wt\dev-c1` は i の状態で残した。

## 参照の残りの洗い出し

- d の状態で、消したフォルダ・ファイルを指す import（`from '...'` と副作用の `import '...'`）を `grep` で探した。結果は各単位の README の「型検査で直す点」。
- `terminalContribChatExports`・`ahpTerminalCommandSource`・`chatTerminalCommandMirror`・`agentHostOutputChannel` を指す import は0件（消したテストを含めて）。
- `debug/test/`（`mockDebug` など）を指す import は0件。

# 検証の記録: C-1（本家の AI）の edits.patch と検査・テスト（パッケージ化の前まで）

大岡越前守から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

> 最新の判定は末尾の「再検証」の節にある。**パッケージ化の前まで: 合格**（ロックファイルは蒙恬の記録で照らしただけ）。下の「判定」から「記録」までは1回目の記録で、そのまま残した。

## 判定

**判定できない（一部の手順に権限が無い）**。

- 自分で確かめた範囲では、直す点は見つからなかった。差分のレビュー、型検査（自分で実行）、run-all（自分で実行）の3つがこれに当たる。
- 台本の手順のうち、次の3つは許可に無いコマンドが要るため走らせていない。
  - タグからの当て直し
  - 作業ツリーの照らし（`c1-check-worktree.mjs`）
  - ロックファイルの検査（1c）
- 「パッケージ化の前まで」の合否は、この3つを走らせてから出す。関門の合否は出していない（依頼どおり）。

| brief の項 | 結果 |
|---|---|
| 1. 差分のレビュー | 直す点なし。軽微な指摘が5つある（下の「軽微な指摘」） |
| 2a. タグからの当て直し（15単位） | **未実行**（権限が無い）。今の作業ツリーが蒙恬の4回目の当て直しの結果そのままであることは確かめた（下） |
| 2b. 作業ツリーの照らし | 台本のスクリプトは**未実行**（権限が無い）。主な項目は Read・Grep・Glob で自分で照らし、期待どおりだった |
| 2c. ロックファイルの検査 | **未実行**（権限が無い） |
| 2d. 型検査 | `result: ok`、`exitCode: 0`。`sourceVersion` は HEAD と一致し、未コミットは 0 |
| 2d. 照らし（`c1-check-json.mjs`） | **未実行**（権限が無い） |
| 3. run-all | tests 1682、pass 1675、**fail 0**、skip 7 |
| 4. 合否 | 判定できない（上の未実行の分） |

## 確かめた成果

- 蒙恬
  - `removals/C-1-ai/edits.patch`（109ファイル、750行の追加、5417行の削除。From `e51a893b`、作者 `shuko-apply`）
  - `removals/C-1-ai/unit.json`・`README.md`
  - `scripts/lib/apply/lockfile.mjs`・`scripts/lib/apply/checks.mjs`（3回目の直し）
- 曹参
  - `tests/c1-unit.test.mjs`（36）・`tests/c1-round2.test.mjs`（12）・`tests/c1-check-json.test.mjs`（8）・`tests/lockfile-patched.test.mjs`（17）
  - `tests/removals/c1-check-json.mjs`・`c1-check-worktree.mjs`・`c1-gate-script.md`

読んだときのファイルの sha256:

| ファイル | sha256 |
|---|---|
| `edits.patch` | `55b8aa5e16491c5c1dc6c9624f32a763ba6f659f36b43c1432a60355d8d7f84d` |
| `unit.json` | `fbe48dbf3c2827cc5741643eb950edef5149b5b90f7adf53c800827e41d78a96` |
| `lockfile.mjs` | `223e8156d03a62faf49450f9faf6dd09f8029074dc5df2aa9173a7a01359771a` |
| `checks.mjs` | `6f064f31be289d1d63004b8b85559309fbe39eefb7b5bb7413962da603036134` |

## 1. 差分のレビュー

### 裁定と docs/03 のとおりか（消すもの・残すもの）

- **消すもの**: `delete` は docs/03 の表と、4節の末尾の箇条書き（sessions・AISearch など）に合っている。user-decisions の 2026-11-15 で決まった `terminalContrib/inlineHint`・依存の追加（ルート10、`remote` 5）・`dialog.ts` の Copilot の2行・gulpfile の Copilot の梱包・`agentHostCrypto`・Agents の窓へのリンクも入っている。
  - 作業ツリーでは、主な消す場所が無いことを Glob で確かめた: `src/vs/sessions`、`contrib/{chat,inlineChat,mcp}`、`platform/{agentHost,mcp,otel,artifactIntegrations}`、`services/{agentHost,mcp}`、`search/browser/AISearch`、`build/next/agentHostCrypto.ts`、`build/next/devTunnelsWeb.ts`、`build/npm/patches/*.patch`
- **残すもの**: 次のファイルが作業ツリーに残っている。どれも user-decisions の 2026-11-14・2026-11-15 のとおり。
  - `services/chat`（null の実装へ差し替え）、`platform/chat`
  - `authenticationMcp{,Access,Usage}Service.ts`、`contrib/speech`、`contrib/comments`
  - 新しいファイル2つ
- **依存**: 作業ツリーの `package.json`・`remote/package.json` に、`removeDependencies` の名前（ルート17、`remote` 7）が1つも無い。`tar` は両方に残る。`scripts.bundle-dev-tunnels-web` も無い。`src/` に、外した依存の import は残っていない（Grep で0件）。
- **5.3（単位の独立）**: edits.patch は `workbench.*.main.ts`・`sessions.*.main.ts`・`build/npm/dirs.ts` を直していない（一覧の行は `removeLines` にある）。拡張 API の何もしない実装は、新しいファイル `extHostRemovedApi.ai.ts` に置いた。`extHost.api.impl.ts` で変わったのは、消した名前空間・メンバーの行と、消したクラスの import・生成の行だけ。
- **protocol**: `extHost.protocol.ts` の `ExtHostContext` の ID は70個ある。`extHost.api.impl.ts` は、同じ70個すべてを `rpcProtocol.set` などで使っている（名前を1つずつ照らした）。起動時の「named customers are missing」の検査には当たらない見込み。

### Claude Code が使う受け手を消していないか（docs/03 の9節）

edits.patch が触れた受け手は次の3つだけで、どれも消した部品への参照の行だけを外している。

| 受け手 | 変えたこと |
|---|---|
| Webview | `mainThreadWebviewManager.ts` から、チャットの出力の描き手の登録の3行を外した |
| コメント | `simpleCommentEditor.ts` から、消した口述（`codeEditor/browser/dictation`）の1行を外した |
| ワークスペースの信頼 | `workspaceTrust.ts`・`workspace.contribution.ts` で、定数 `vscode-agent-host` を同じ値で写した。判定は変わらない |

- タブの API（`mainThreadEditorTabs.ts`）は、`ChatEditorInput` の分岐だけを外した。Webview・差分エディタのタブの分岐は残る。
- セカンダリサイドバー・差分エディタ・拡張のファイルシステムの提供者・JSON の検査には触れていない。

### 安定版の API を呼んでも誤りを投げないか

`extHost.api.impl.ts` の元の `chat`・`lm` の全メンバー（edits.patch の `-` の行）と、`extHostRemovedApi.ai.ts` を1つずつ照らした。

| 安定版のメンバー | 振る舞い |
|---|---|
| `chat.createChatParticipant` | 何もしない参加者 |
| `lm.selectChatModels` | `[]` で resolve |
| `lm.onDidChangeChatModels` | `Event.None` |
| `lm.registerLanguageModelChatProvider`・`registerTool`・`registerToolDefinition`・`registerIgnoredFileProvider`・`registerMcpServerDefinitionProvider` | 何もしない Disposable |
| `lm.tools` | `[]` |
| `lm.fileIsIgnored` | `false` で resolve |
| `lm.invokeTool`（名前の文字列で呼ぶ形） | 同期では投げず、Promise を reject する。元も「無いツール」では reject するので、呼び手から見た形は変わらない |
| `ExtensionContext.languageModelAccessInformation` | `canSendRequest` は `undefined`、`onDidChange` は `Event.None` |

### 提案中の API の門が残っているか

- 元のコードにあった `checkProposedApiEnabled` は、`chat` と `lm` の全メンバーで、同じメンバー・同じ提案の名前のまま新しいファイルに移っている。数え漏れは無い。
- `window.createAgentEditorComments`・`createChatStatusItem`・`activeChatPanelSessionResource`、`workspace.registerAITextSearchProvider`、`interactive.transferActiveChat` の門も、`extHost.api.impl.ts` に元どおり残る。
- 元にあった `registerChatSessionItemProvider` の非推奨の報告は無くなった。提案中の API の中のことなので、門には影響しない。

### `compareLockfile` の緩めた条件が、宣言したパッチの名前だけに限られているか

限られている。

- `comparePatchedDependencies` は節の中身を名前ごとに比べ、次の3つを `unexpectedPatchChanges` に入れる。
  - `expected.removedPatches` に無い名前の削除
  - 残る名前の中身（`hash`・`path`）の変化
  - 名前の追加
- `patchedDependencies` を `changedSections` から外すのは、`unexpectedPatchChanges` が空のときだけ。ほかの節、importer、依存、packages、snapshots の判定は変わっていない。
- `ok` の式も変わっていない。
- `expectedLockRemovals` は、同じフォルダの `pnpm-workspace.yaml` の `removeLines` のうち、`<名前>: <…>.patch` の形の行からだけ名前を作る。見出しの行や `- src/...` の行は名前にならない。
- `checks.mjs` は、結果の `unexpectedPatchChanges`・`removedPatches` を記録に足しただけ。

### 軽微な指摘（直さなくても、パッケージ化の前の合否には響かない）

1. **蒙恬（unit.json）**: `kept` の `authenticationMcpService.ts` の理由が「リーダーの判断を仰ぐ」で終わっている。判断は user-decisions の 2026-11-15 で済んでいるので、文を直すとよい。README の「消すもの」の依存の行（19行。1回目の7つと `remote` の2つだけ）と、194行の「直すには `scripts/` の変更が要る」も、後の節で上書きされた古い記述のまま残っている。
2. **蒙恬（`chatEntitlementService.ts`）**: `import { NullChatEntitlementService }` をファイルの末尾に置き、2つのファイルが互いに import し合う形になっている。
   - 今は `chatEntitlementService.js` だけが `nullChatEntitlementService.js` を import するので、評価の順は正しく、ESM として動く。
   - ただし、別のファイル（テストなど）が `nullChatEntitlementService.js` を先に import すると、`registerSingleton` が初期化前のクラスを読み、ReferenceError になる。
   - 関門の起動の確かめで、DI の誤りと一緒に見る。直すかどうかはリーダーの判断に任せる。
3. **蒙恬（`pnpm-workspace.yaml`）**: `allowBuilds` に、外した依存の項目（`foundry-local-sdk@2.2.1`・`ssh2`）が残る。
   - `pnpm install --lockfile-only` は通っているので、実害は今のところ無い。
   - 片づけの後の本物の `pnpm install`（`strictDepBuilds: true`）で警告や誤りが出ないかを見る。
4. **蒙恬（build/ の残り）**: `build/agent-sdk/`・`build/dictation-runtime/`・`build/azure-pipelines/common/apply-sdk-canary-override.ts` と、`build/lib/test/` のテストの一部が残る。これらは Copilot・foundry の名前を文字列で持つ。
   - 手元のパッケージ化（gulpfile.vscode.ts）からは呼ばれない。
   - build/ の型検査の誤りは、蒙恬の報告と同じ1件だけ（`gulpfile.vscode.ts` 139行。A-3 の `builtInExtensions: []` が原因で、C-1 ではない）。
5. **曹参（テスト）**: どれも、テストの今の判定を誤りとするものではない。
   - `c1-unit.test.mjs` の門の検査は、門が「30以上ある」と、主な提案の名前があることを見る。元のコードの門と1対1で照らす形ではない。今の実装で漏れが無いことは、上のとおり自分で照らした。
   - 落ちるべきときに落ちることは、曹参の報告のとおり `c1-check-json` の分しか確かめていない。`c1-unit.test.mjs` は、壊した edits.patch で確かめていない。
   - `lockfile-patched.test.mjs` の17件は、仕様の「許す」「止める」の両方を、実装の中身ではなく入出力で確かめている。仕様を緩めて書いた所は無い。

## 2. 当て直し・照らし・ロックファイル・型検査

### 走らせたもの

| コマンド | 結果 |
|---|---|
| `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c1-verify/typecheck-ooka.json --take-in-dir tasks/2026-11-15-p5-c1-verify/take-in-ooka` | `result: ok` |
| `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`（参考） | 誤り1件。`gulpfile.vscode.ts(139,43) TS2339`。A-3 が原因で、蒙恬の2回目・3回目の報告と同じ |

型検査の記録の中身:
- `steps[0]`: `pnpm run typecheck-client`、`exitCode: 0`、6.1秒。ログ `C:\b\logs\1.146.0-1\typecheck.log` は、コマンドの1行だけで、`error TS` は無い。
  - 6秒と短いが、蒙恬の1回目は同じ時間で397件の誤りを出している。型検査は働いている。
- `sourceVersion.value` は `76f002490184c560218c734381baf3845e7f674c`。`uncommittedEntries` は 0。

### 今の作業ツリーの状態

- `C:\b\vscode\.git\worktrees\p2\HEAD` は `76f002490184c560218c734381baf3845e7f674c`。蒙恬の4回目のタグからの当て直し（`trial/round4-checks-verify.json`、label `c1r4-verify`）の `headCommit` と同じ。
  - その記録の `baseCommit` は 1.146.0 のタグの commit `69047191`。
  - 同じ記録では、15単位が `applied: ok`、C-1 の edits は `conflicts: []`、`remnants`・`absentStrings` は `ok`、`removedDefaults` に `chat.disableAIFeatures`（C-1-ai）がある。
- edits.patch は3回目から変わっていない（From `e51a893b`）。4回目の unit.json の直し（`class McpSettingsRenderer`）も、作業ツリーに反映されている。
  - `dialog.ts` に `aboutDetailWithoutCopilot` があり、`@github/copilot` は無い。
- 作業ツリーには何も書いていない。15単位を当てた状態で、未コミットは 0（型検査の記録の `uncommittedEntries`）。

### 走らせられなかったもの（権限）

フックが止めたもの。どれも許可の形に無い。

| 台本の手順 | 要るコマンド | 何のために |
|---|---|---|
| 1（タグからの当て直し）の前 | `git -C C:/b/wt/p2 checkout 1.146.0` | `apply.mjs` は今の HEAD の上に当てる（`scripts/apply.mjs` 226〜259行）。タグに戻せないと当て直せない |
| 1・1c の確かめ | `git -C C:/b/wt/p2 status --porcelain`（試して止まった） | 未コミットの変更が 0 かを見る（今回は build.mjs の記録で代えた） |
| 1b | `node tests/removals/c1-check-worktree.mjs C:/b/wt/p2`（試して止まった） | 許可 `node tests/*.mjs` の `*` は `/` に一致しないので、`tests/removals/` の下は通らない |
| 1・1c・2 の照らし | `node tests/removals/c1-check-json.mjs <checks.json> [<typecheck.json>]` | 同じ理由 |
| 1c | `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` | ロックファイルを作り直す |
| 1c の後 | `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` | ロックファイルを戻す |

- ロックファイルを作り直さないまま `--lockfile-check` をかけても、ロックファイルは本家のままなので、比べる意味が無い。走らせていない。
- C: の空きは、測るコマンドが許可に無いので測っていない。書いたのは型検査の記録とログだけ（数 KB）。

## 3. テスト

`node tests/run-all.mjs --save tasks/2026-11-15-p5-c1-verify/run-all-ooka.txt` を走らせた。終了コードは 0。

- TOTAL: tests 1682、pass 1675、**fail 0**、skip 7。
- skip 7 は `removals.test.mjs` の既存の分。曹参の3回目の記録（`run-all-result-3.txt`）と件数が一致する。
- C-1 の分の内訳: `c1-unit` 36、`c1-round2` 12、`c1-check-json` 8、`lockfile-patched` 17。どれも fail 0。

## 4. 合否と次にすること

- 「パッケージ化の前まで」: **判定できない**。走らせた範囲（レビュー・型検査・run-all）に不合格の点は無い。台本の当て直し・作業ツリーの照らし・ロックファイルの検査・照らしの4つを、自分で走らせていない。
- 進め方は2つ。どちらを採るかはリーダーが決める。
  1. 上の表のコマンドを大岡越前守の許可に足す（ユーザーの承認が要る）。足したら台本の1〜3を走らせ直し、合否を出す。
  2. 片づけの許可の後のビルド（`build.mjs` の prepare〜lockfile）で、当て直しとロックファイルの検査を一緒に行う。そのとき大岡越前守が照らし役を走らせる（この場合も `node tests/removals/*.mjs` の許可は要る）。
- 直す点: 必須のものは無い。軽微な指摘の1〜4は蒙恬の担当、5は曹参の担当。直すかどうかは任せる。

## 記録

- この文書: `tasks/2026-11-15-p5-c1-verify/verification-ooka.md`
- run-all: `tasks/2026-11-15-p5-c1-verify/run-all-ooka.txt`
- 型検査: `tasks/2026-11-15-p5-c1-verify/typecheck-ooka.json`、ログは `C:\b\logs\1.146.0-1\typecheck.log`
  - `build.mjs` の既定の label `1.146.0-1` のログの場所に書かれた。蒙恬の前の回のログと同じ場所の可能性がある
- `--take-in-dir` に渡した `tasks/2026-11-15-p5-c1-verify/take-in-ooka/` は作られなかった（`apply` を走らせていないため）

---

## 再検証（2026-11-15。蒙恬の5回目・曹参の4回目の後）

### 判定

**パッケージ化の前まで: 合格**。ただし、ロックファイルは自分で作り直していない（下の2c）。

関門の合否は出していない。

| brief の項 | 結果 |
|---|---|
| 1. 差分のレビュー（5回目の分） | 直す点なし。1回目の軽微な指摘の1〜4はどれも直っている |
| 2a. タグからの当て直し（15単位） | 自分で実行。`result: ok`。15単位すべて `applied: ok`。C-1 の edits は `conflicts: []` |
| 2b. 作業ツリーの照らし | 自分で実行。`node tests/c1-check-worktree.mjs C:/b/wt/p2` は「期待どおり（作業ツリー）」 |
| 2c. ロックファイルの検査 | **自分では作り直していない**（`pnpm install --lockfile-only` が許可に無い）。リーダーの指示どおり、蒙恬の記録 `trial/round5-checks-verify.json` を読んで照らした。期待どおり。自分での確かめは片づけの後のビルドで行う |
| 2d. 型検査 | 自分で実行。`result: ok`、`exitCode: 0`、`uncommittedEntries: 0`、`sourceVersion.error: null` |
| 2d. 照らし | 自分で実行。`node tests/c1-check-json.mjs <自分の当て直し> <自分の型検査>` は「期待どおり（当て直し・型検査）」 |
| 3. run-all | tests 1705、pass 1698、**fail 0**、skip 7 |
| 4. 合否 | 合格（パッケージ化の前まで。2c は記録の照らしだけ） |

### 確かめた成果と、読んだときの sha256

- 蒙恬の5回目:
  - `removals/C-1-ai/edits.patch`（108ファイル、742行の追加、5418行の削除。From `9ab6123d`、作者 `shuko-apply`、新しいファイルは `extHostRemovedApi.ai.ts` の1つ）
  - `unit.json`・`README.md`
  - `lockfile.mjs`・`checks.mjs`（1回目の検証から sha は変わっていない）
- 曹参の4回目:
  - `tests/c1-check-json.mjs`・`tests/c1-check-worktree.mjs`（`tests/` の直下へ移した）
  - `tests/c1-mutation.test.mjs`（新規、21）、`c1-unit`（37）・`c1-round2`（13）
  - `c1-gate-script.md`

| ファイル | sha256 |
|---|---|
| `edits.patch` | `d08829e0379c9e981af78d985c89c4da87c12701059f936b914cf2174d2f8eb1` |
| `unit.json` | `2d0ace480873f43e114c657816917e0ecfcb3cb3f1a1c93a3f664518e590256f` |
| `lockfile.mjs` | `223e8156d03a62faf49450f9faf6dd09f8029074dc5df2aa9173a7a01359771a`（1回目と同じ） |
| `checks.mjs` | `6f064f31be289d1d63004b8b85559309fbe39eefb7b5bb7413962da603036134`（1回目と同じ） |
| `tests/c1-check-json.mjs` | `d032da2eec8a9b212d2bc70d1e33e7e473b79012dd6f1150482c958ad34f7980` |
| `tests/c1-check-worktree.mjs` | `d940c76002ac96cc4bc4d9066d2cc95b10d3e26b53180044d9749903768ff980` |

### 1. 差分のレビュー（5回目の分）

| 1回目の指摘 | 5回目の対応 | 確かめたこと |
|---|---|---|
| 1. unit.json・README の古い記述 | 直した | `unit.json` に「判断を仰ぐ」が無くなり、271行が「リーダーが認めた」になった。README の依存の行は「ルートの17」（20行）に直った。2回目の5の記述も直っている |
| 2. 2つのファイルが互いに import し合う | `NullChatEntitlementService` を、`chatEntitlementService.ts` の末尾（登録の直前）へ移した | 下の「2の直し」 |
| 3. `allowBuilds` に外した依存が残る | `removeLines` に4行を足した。対象は `foundry-local-sdk@2.2.1: true`・`bufferutil@4.1.0: true`・`utf-8-validate@5.0.10: true`・`koffi@3.2.1: false` | 4行とも、蒙恬の round5 のロックファイルの差分から消えたパッケージに当たる（`round5-lockfile.diff` に `-  bufferutil@4.1.0:`・`-  foundry-local-sdk@2.2.1:`・`-  koffi@3.2.1:`・`-  utf-8-validate@5.0.10:` がある）。`ssh2: false`・`cpu-features: false` は `test/smoke` が `ssh2` を使うので残す。この理由も筋が通る |
| 4. build/ の AI の台本が残る | 直さず、README の「残すもの」に理由を書いた（36行ほか） | 手元のパッケージ化から呼ばれないことは1回目に確かめた。build/ の tsc の誤りは、今回も A-3 の1件だけ |

**2の直し**（`edits.patch` の `chatEntitlementService.ts` の区画を読んだ）:

- import に `constObservable` の1つを足した。
- 末尾の元の登録 `registerSingleton(IChatEntitlementService, ChatEntitlementService, ...)` を消し、次の順に置いた。
  1. `export class NullChatEntitlementService`（中身は1回目の別のファイルと同じ）
  2. `registerSingleton(IChatEntitlementService, NullChatEntitlementService, InstantiationType.Eager ...)`
- 登録はクラスの定義より後にある。互いに import し合う形は無くなった。
- `services/chat/common/` の下は `chatEntitlementService.ts` だけになった（作業ツリーで Glob）。`nullChatEntitlementService` を import する所も無い。
- `workbench.*.main.ts` には触れていない（5.3）。

ほかの区画は、新しいファイルが1つ減ったことを除いて、1回目にレビューした内容と同じ扱い（拡張 API・受け手・門）。安定版の API・提案中の API の門・Claude Code の受け手について、1回目の結論は変わらない。

### 2. 当て直し・照らし・型検査（自分で実行）

始める前の作業ツリーは、タグに戻してあった。
- `C:\b\vscode\.git\worktrees\p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`（1.146.0）。
- 未コミットの変更が無いことは、`apply.mjs` が当てる前に確かめる（変更があれば止まる。`scripts/apply.mjs` 256〜259行）。止まらずに当たった。

| 手順 | コマンド | 結果 |
|---|---|---|
| 1 | `node scripts/apply.mjs C:/b/wt/p2 --label c1-gate-ooka --only <15単位> --checks-out tasks/2026-11-15-p5-c1-verify/re/checks-ooka.json` | `結果: ok` |
| 1b | `node tests/c1-check-worktree.mjs C:/b/wt/p2` | 期待どおり（作業ツリー）。終了コード 0 |
| 2 | `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c1-verify/re/typecheck-ooka.json --take-in-dir tasks/2026-11-15-p5-c1-verify/re/take-in` | `result: ok` |
| 3 | `node tests/c1-check-json.mjs tasks/2026-11-15-p5-c1-verify/re/checks-ooka.json tasks/2026-11-15-p5-c1-verify/re/typecheck-ooka.json` | 期待どおり（当て直し・型検査）。終了コード 0 |
| 参考 | `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json` | 誤り1件。`gulpfile.vscode.ts(139,43) TS2339`。1回目と同じで、A-3 が原因（C-1 ではない） |

記録の中身（`re/checks-ooka.json`）:
- `baseCommit` は `69047191`（タグ）、`headCommit` は `00526d8ef0da6af1eb28c20bc0f8982c654b1226`、`result` は `ok`。
- 15単位の `applied` はすべて `ok`。`"applied": "fail"`・`"conflict"` は0件。`removeLines` の `"ok": false` も0件。`warnings` はすべて空。
- C-1 の edits は `applied: ok`、`subject: "unit C-1-ai: edits"`、`conflicts: []`（commit `9a2734db`）。
- `removeLines` の allowBuilds の4行は、それぞれ `found: 1`。
- `checks.remnants`・`checks.absentStrings` は `ok`。`hitCount` が1以上の項目は0件。
- `removedDefaults` に `{key: "chat.disableAIFeatures", unit: "C-1-ai"}` がある。

型検査の記録（`re/typecheck-ooka.json`）:
- `steps[0]`: `pnpm run typecheck-client`、`exitCode: 0`、6.1秒。ログ `C:\b\logs\1.146.0-1\typecheck.log` に `error TS` は無い。
- `sourceVersion.value` は `00526d8e…` で、当て直しの `headCommit` と同じ。`uncommittedEntries` は 0、`error` は `null`。

作業ツリーの照らしで、自分でも Read・Grep・Glob で見たもの:
- `pnpm-workspace.yaml` に `patchedDependencies`・`foundry`・`bufferutil`・`utf-8-validate`・`koffi@` が無い。`cpu-features: false`・`ssh2: false` は残る。
- `chatEntitlementService.ts` の1657行に `export class NullChatEntitlementService`、1701行に `registerSingleton(IChatEntitlementService, NullChatEntitlementService, ...)` がある。元の登録は無い。

HEAD は蒙恬の round5（`bf504a70`）と違う。commit の日時と、`apply.mjs` が作る commit の sha が回ごとに変わるためで、食い違いではない。両方の記録が同じ照らし役で「期待どおり」になることは、下の2cで見た。

### 2c. ロックファイル（蒙恬の記録を読んで照らしただけ）

**自分ではロックファイルを作り直していない**。`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` が大岡越前守の許可に無いため。リーダーの指示どおり、記録を読んで照らすだけにした。自分での確かめは、片づけの後のビルド（依存の導入とロックファイルの検査）で行う。

- `node tests/c1-check-json.mjs tasks/2026-11-15-p5-c1-patch/trial/round5-checks-verify.json tasks/2026-11-15-p5-c1-patch/trial/round5-typecheck-verify.json` は「期待どおり（当て直し・型検査）」。
  - この照らし役は、記録に `--lockfile-check` の結果があれば、各ロックファイルが `ok` か `removed` であることも見る。
- 記録 `round5-checks-verify.json` の `checks.lockfile` を読んだ（label `c1r5-verify`、`baseRef` `69047191`、`checkedAt` `2026-11-15T01:51:51Z`）。
  - `status: ok`。
  - ルートの `pnpm-lock.yaml`: `ok`。`changedSections: []`、`unexpectedPatchChanges: []`、`removedPatches: ["foundry-local-sdk"]`、`unexpectedRemovedDeps: []`、`addedDeps`・`changedDeps`・`addedPackages`・`addedSnapshots` はどれも空。消えた依存は19。`removedImporters` は `src/vs/sessions/test/e2e`。
  - `extensions/copilot/pnpm-lock.yaml`: `removed`（A-1 が消したフォルダの中）。
  - `build/`・`extensions/`・`remote/`・`test/sanity/` のロックファイル: `ok`、`unchanged: true`。
    - `remote/pnpm-lock.yaml` は作り直していないので、変わらないのは当たり前。user-decisions の 2026-11-15 のとおり、片づけの後のビルドで見る。

### 3. テスト

`node tests/run-all.mjs --save tasks/2026-11-15-p5-c1-verify/re/run-all-ooka.txt` を走らせた。終了コードは 0。

- TOTAL: tests 1705、pass 1698、**fail 0**、skip 7。
- skip 7 は `removals.test.mjs` の既存の分。曹参の4回目の記録（`run-all-result-5.txt`）と件数が一致する。
- C-1 の分: `c1-unit` 37、`c1-round2` 13、`c1-check-json` 8、`c1-mutation` 21、`lockfile-patched` 17。どれも fail 0。
- `node --test tests/c1-mutation.test.mjs` も単独で走らせた。21件とも pass。
  - 対照（壊さない写し）が全部通る。
  - 壊した写し20種のそれぞれで、`c1-unit.test.mjs` が落ちる。
  - 1回目の軽微な指摘の5の2点目（壊した edits.patch で落ちることを確かめていない）は、これで閉じた。

### 4. 合否と、残ること

- **パッケージ化の前まで: 合格**。条件の範囲は次のとおり。
  - 1 は5回目の分。
  - 2 の当て直し・作業ツリーの照らし・型検査・照らしは自分で走らせた。
  - 2c のロックファイルは、蒙恬の round5 の記録を照らしただけ。
  - 3 は run-all。
- 不合格の点・直す点: 無い。
- 残ること（関門と、片づけの後のビルドで見る）:
  - ロックファイルを自分で作り直しての検査（ルートと `remote/`）。
  - 本物の `pnpm install`（`strictDepBuilds: true`）で、`allowBuilds` の残り（`ssh2`・`cpu-features`）について警告や誤りが出ないこと。
  - 起動時の DI（`UNKNOWN service`）と、拡張ホストのログの `vscode.lm`・`vscode.chat` の誤り（docs/03 の9節。型検査では見えない）。
- 後始末（リーダーが消す。曹参・蒙恬の報告にあるもの）:
  - `tests/removals/c1-check-json.mjs`・`tests/removals/c1-check-worktree.mjs`（移動先を指すだけの殻）
  - `tasks/2026-11-15-p5-c1-tests/handoff-notes-round2-part.md`
  - `tasks/2026-11-15-p5-c1-patch/typecheck-log.md.round2.tmp`
- 作業ツリー `C:\b\wt\p2` は、15単位を当てた状態（HEAD `00526d8ef0da6af1eb28c20bc0f8982c654b1226`、未コミット 0）で残した。run-all の後も HEAD が変わっていないことを確かめた。
  - `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` と、普段使いのエディタのデータには触れていない。
- C: の空きは、測るコマンドが許可に無いので測っていない。書いたのは記録とログだけ（数 MB 以下）。当て直しの commit は、作業ツリーの git に入る。

### 記録（再検証）

- `tasks/2026-11-15-p5-c1-verify/re/checks-ooka.json`（当て直し）
- `tasks/2026-11-15-p5-c1-verify/re/typecheck-ooka.json`（型検査）。ログは `C:\b\logs\1.146.0-1\typecheck.log`（1回目と同じ場所に上書きされた）
- `tasks/2026-11-15-p5-c1-verify/re/run-all-ooka.txt`（run-all）
- `--take-in-dir` に渡した `tasks/2026-11-15-p5-c1-verify/re/take-in/` は作られなかった（型検査の手順だけでは書かれない）

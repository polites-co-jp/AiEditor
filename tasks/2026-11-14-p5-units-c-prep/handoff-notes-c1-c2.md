# 報告: 段階 C の下準備（C-1-ai・C-2-debug）

- 担当: 蒙恬（C-1・C-2 の分。C-3〜C-7 は別の蒙恬）。2026-11-14。
- 結果: **完了**（依頼書の完了条件を満たした。`edits.patch` は依頼どおり作っていない）

## 成果物

| パス | 中身 |
|---|---|
| `removals/C-1-ai/unit.json` | order 310、`enabled: false`、after A-1・B-1・B-2。delete 107、removeLines 92、依存 8、productRemove 6、kept 7、checks |
| `removals/C-1-ai/README.md` | 消すもの・残すもの・**型検査で直す点**（拡張 API、main・共有プロセス・CLI・サーバー、画面の部品、テストの土台）・影響・戻し方・未決 |
| `removals/C-2-debug/unit.json` | order 320、`enabled: false`、after A-3。delete 71、removeLines 17、kept 11、checks |
| `removals/C-2-debug/README.md` | 同上（型検査で直す点は7行） |
| `tasks/2026-11-14-p5-units-c-prep/units-c-notes-c1-c2.md` | 範囲の決め方・根拠・docs との食い違い・未確認 |
| `tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md` | 試しの6回の記録と absentStrings の残りの数 |
| `tasks/2026-11-14-p5-units-c-prep/trial-c1c2/` | `apply.mjs` の記録（`checks-*.json`）と、試し用の空の `no-patches/` |

## 要点

1. C-1 は docs/03 の表の部品に、Agents の窓（`src/vs/sessions`。別の入口を持つ窓）と本体側のエージェントのセッション・チャットの窓・キャンバス・ターミナルとノートブックのチャット・口述・端末内の音声認識などの AI の部品を足して消す。残すと chat への参照を数百か所直すことになるため。
2. C-1 の `services/chat`（`IChatEntitlementService`）は表と違って残す。拡張の有効・無効のサービスなど約12の残る部品が注入しているので、B-2 と同じ形で何もしない実装を登録する。
3. C-2 は `contrib/debug/common` を残し、本家にすでにある `NullDebugService` を登録する。`extensionHostDebugService`（拡張のホストの起動に要る）とテストの呼び出し履歴の部品も残す。docs/03 の表の「desktop の1行」は消さない。
4. ops は A＋B の上で全部当たった（`missingDeletes` 0、removeLines はすべて期待の数）。C-1 → C-2 の順でも C-2 だけでも当たる。
5. Claude Code の受け手は消していない。型検査で直すのは、コメント（口述の部品の参照）とワークスペースの信頼（agent host の URI の分岐）の参照の行だけ。

## 確かめたこと

- `apply.mjs` で6回当てた（`trial-log-c1-c2.md`）。A＋B は ok。C-1・C-2 の ops はすべて当たり、fail は `absentStrings` の残り（型検査で直す点）と、回を分けたための registeredKeys の注だけ。
- `--only` なしの dry-run（今の `enabled` のまま）は ok。普段のビルドに響かない。
- 元に戻した `unit.json` で、A・B・C-1・C-2 の dry-run が「C-1 の patch が無い」まで進む（JSON の形と after の順は通る）。
- `C:\b\wt\1.146.0` は書き換えていない（`git status --short` が空）。`C:\b\wt\dev-c1` は A＋B＋C-1＋C-2 の ops の状態（HEAD `b928acfa4c4`）で残した。

## テストの入口（曹参へ）

- `scripts/lib/apply/units.mjs` の `validateUnit(unit, dirName)`: `removals/C-1-ai/unit.json`・`C-2-debug/unit.json` で誤りが0件。
- `planUnits(units, { only: ["C-1-ai"] })` は after（A-1・B-1・B-2）が無いので誤りになる。`only` に A-1〜B-7 と C-1・C-2 を入れると誤り0件で、順は A → B → C-1 → C-2。order 310・320 がほかの単位と重ならない（C-3〜C-7 と合わせて検査する）。
- `removeLines` の各行が、本家 1.146.0 に A＋B を当てた木（`C:\b\wt\dev-c1` の `3c73ea6f3b2`）で `count`（既定1、`build/next/index.ts` の4件は2）の数だけ見つかること。`scripts/lib/apply/lines.mjs` の `removeLinesFromText` で照らせる。
- C-1 と C-2 の両方の `delete` に `src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts` がある（両方当てると C-2 で警告1件。意図どおり）。
- 期待の記録: `trial-c1c2/checks-c1.json`・`checks-c2.json`・`checks-c1-c2.json` の `units[0].ops`（missingDeletes が空、removeLines がすべて ok）。
- 型検査の後に要る検査（今は書けない）: C-1 の後、`vscode.lm.selectChatModels()` が空の配列、`vscode.chat.createChatParticipant` が例外を出さない。C-2 の後、`vscode.debug.startDebugging` が false、`vscode.debug.registerDebugConfigurationProvider` が Disposable を返す。拡張ホストのログに `UNKNOWN service`（chatEntitlementService・debugService・extensionHostDebugService）が無い。

## docs/ との食い違い

1. docs/03 の4節 C-1: `services/chat` は消せない（残して何もしない実装）。表に無い AI の部品を足した。
2. docs/03 の4節 C-2: 「desktop の1行」（`extensionHostDebugService`）は消さない。
3. docs/03 の5.3: C-2 の登録を読む1行を `workbench.common.main.ts` に足す必要がある（edits.patch で main に触る）。
4. docs/02 の3節: `chatParticipantRegistry`・`agentSdks`・`dictationRuntime`・`copilotVersions` は 1.146.0 の OSS の product.json に無い。C-1 の `productRemove` から外した。`product.overlay.json` の `removeIfPresent` に置く案（この作業の書き込みの範囲の外なので触っていない）。
5. docs/03 の4節 C-1 の依存の「要照合」: 4つとも 1.146.0 にあった。`@anthropic-ai/sdk`・`foundry-local-sdk` も足した。

## 追記: 差し戻しの直し（2026-11-14）

検証（`tasks/2026-11-14-p5-verify-c-prep/handoff-notes.md`）の差し戻しとリーダーの指示に従って直した。

| # | 指示 | 直したこと |
|---|---|---|
| 1 | まだ無い `edits.patch` を `patch` に挙げている | `removals/C-1-ai/unit.json`・`C-2-debug/unit.json` から `"patch"` のキーを外した（C-3〜C-7 と同じ形）。両 README の「状態」の段落を「`edits.patch` を作ったときに `patch` を足す」に直した |
| 2 | AI の検索を C-1 で消す | `delete` に `contrib/search/browser/AISearch` を足した。`removeLines` は無い（import は検索の中のファイルからだけで、一覧の1行ではない）。`checks` に `search.action.showAIResults`（コマンド）、`search.searchView.semanticSearchBehavior`・`keywordSuggestions`（設定）、`AISearch/aiSearchModel`（文字列）を足した。README の「型検査で直す点」に5の表（検索のビュー・木のモデル・操作、設定、拡張 API の `registerAITextSearchProvider`・`extHostSearch.ts`・`mainThreadSearch.ts`・protocol、`services/search` の扱いの案）を足した。検索そのものは消さない |
| 3 | `authenticationQueryService.ts` と、消した部品を import するテスト | `authenticationQueryService.ts`（29・31・32行の import、817・819・821行の注入）を表3に足し、起動時の確かめが要ると書いた。指摘4のテストは表6に足した。消したサービスだけを見るテスト（`authenticationMcpService.test.ts`・`authenticationMcpAccessService.test.ts`）と `searchChatContext.test.ts` は `delete` に足した（C-1 の delete は 111） |
| 4 | C-2 の after は A-3 だけでよい | 変えていない。C-2 の README の「状態」の下に理由を1行書いた（Agents の窓の入口に触れず、C-1 が無くても当たる） |

確かめたこと（`trial-log-c1-c2.md` の回 g・h）:

- 1.146.0 から、本物の `removals/` のまま A-1〜B-7・C-1・C-2 を1回で当てた（試し用の書き換えなし）。止まらずに最後まで当たった。removeLines はすべて期待の数、`missingDeletes` は意図どおりの1件だけ、fail は `absentStrings`（型検査で直す点）だけ。registeredKeys・remnants・unclassifiedExtensions・commitIdentity は ok。記録は `trial-c1c2/checks-ab-c1-c2-rework.json`。
- 今の `enabled` のままの dry-run は ok。
- `node tests/run-all.mjs` は私の Bash の許可に無いので走らせていない。fail 0 になるかは曹参か大岡越前守に確かめてもらう必要がある。
- `C:\b\wt\verify-p2` には触れていない。`C:\b\wt\dev-c1` は回 g の状態（HEAD `e7197c49da0`）。

## 未解決（リーダーの判断を仰ぐ）

1. Agents の窓など、docs/03 の表に無い部品を C-1 に足したこと（C-1 の README の未決の1）。
2. `extHost.protocol.ts` の直し方: 消した API の Shape と ID を消す（推す）か、型のために `contrib/chat/common` の一部を残すか。
3. 消すか迷って残したもの: `contrib/speech`、`common/agentsColors.ts`・`agentsSizes.ts`、`platform/artifactIntegrations`、`contrib/imageCarousel`、`platform/otel`、依存 `@modelcontextprotocol/sdk`。
4. C-2 の `IDebugService` の登録の置き場所（C-2 の README の未決の1。推すのは案A）。
5. C-1 の `after` に B-1・B-2・A-1 を入れた。C-1 はそれらが消した部品（`editTelemetry`・歓迎画面）の chat への参照を直さない前提になる。
6. C-1 の `edits.patch` は `build/gulpfile.vscode.ts` の Copilot の SDK の梱包・照合を外す必要がある（照合が依存の無いときに throw する）。A-1 で残した `build/lib/copilot.ts` の扱いもそのときに決める。

上の1〜5はリーダーが決めた（追記2）。6は edits.patch を作るときの作業として残る。

## 追記2: 未決の5点の反映（2026-11-14）

リーダーの判断（1〜5）を反映した。

| # | 判断 | 反映 |
|---|---|---|
| 1 | 表に無い部品を C-1 に足すことを認める | C-1 の README の「未決」を「決まったこと」に替えた |
| 2 | `extHost.protocol.ts` は消した API の Shape と ID を消す | C-1 の README の表1の行を、消す Shape・ID・DTO の一覧（ChatAgents2・ChatSessions・ChatContext・ChatDebug・ChatStatus・ChatQuota・ChatInputNotification・ChatOutputRenderer・ChatArtifactIntegrations・CodeMapper・AgentEditorComments・LanguageModels・LanguageModelTools・Mcp）と import の行（35、46、63〜73、75、107）に書き直した。残す API の Shape は変えない |
| 3 | 迷って残したものを規則で振り分ける | 下の表 |
| 4 | `IDebugService` の登録は案A | C-2 の README の未決の1に「決まった」と書いた |
| 5 | C-1 の after に A-1・B-1・B-2 を認める | C-1 の README に書いた。`unit.json` は変えていない |

3の振り分け。`C:\b\wt\dev-c1`（A＋B＋C-1＋C-2 の ops の状態）で、消した部品の外に残る import と CSS の変数を `grep` で探した。

| もの | 残る使い手 | 扱い |
|---|---|---|
| `contrib/speech` | アクセシビリティ（`accessibilityConfiguration.ts` 12・`accessibility.contribution.ts` 16・`editorAccessibilityHelp.ts` 17）、ターミナル（`terminalMenus.ts` 21・`terminalAccessibilityHelp.ts` 22）、拡張 API（`mainThreadSpeech.ts` 11・`extHost.protocol.ts` 84） | 残す（`kept` に使い手を書いた） |
| `common/agentsColors.ts` | 残る CSS が色の変数を使う（`partGrid.css` 182・214、`feedbackInputWidget.css` 10、`frostedGlass.css` 66） | 残す（同上） |
| `common/agentsSizes.ts` | 無し | 消す（`delete`、`removeLines` に main と `fixtureUtilsCss.ts` の2行） |
| `platform/artifactIntegrations` | 無し（main の登録2行と、消すチャットの API の型の `extHost.protocol.ts` 35だけ） | 消す（`delete`、`removeLines` に main の2行。35行は Shape と一緒に消す） |
| `contrib/imageCarousel` | 自分の中だけだが、エクスプローラーの「画像をカルーセルで開く」で AI と関係なく使う画像の画面（画像のプレビューは裁定で残す） | 残す（`kept` に理由を書いた）。チャットからの入口の操作1つは型検査で消すかを決める |
| `platform/otel` | 無し（使い手はエージェントのホストだけ） | 消す（`delete`）。使い手が残らないので何もしない実装は要らない |
| 依存 `@modelcontextprotocol/sdk` | src には無し。`build/agent-sdk/package.ts` 275（AI の SDK の梱包の台本の文言）と `eslint.config.js` 1823（agentHost のための許可の一覧）だけ | 消す（`removeDependencies` のルートに足した） |

`checks.absentStrings` に `artifactIntegrations/common/` と `common/agentsSizes.js'` を足した。C-1 の delete は 114、removeLines は 96、依存はルート7・`remote` 2。

確かめたこと（`trial-log-c1-c2.md` の回 i）:

- 1.146.0 から、本物の `removals/` のまま A-1〜B-7・C-1・C-2 を1回で当てた。止まらずに最後まで当たった。removeLines はすべて期待の数（足した4行も1件ずつ）。`@modelcontextprotocol/sdk` も消えた。`missingDeletes` は意図どおりの1件（`debugChatIntegration.ts`）だけ。fail は `absentStrings` だけで、足した針は `artifactIntegrations/common/` 1（`extHost.protocol.ts` 35）、`common/agentsSizes.js'` 0。registeredKeys・remnants・unclassifiedExtensions・commitIdentity は ok。記録は `trial-c1c2/checks-ab-c1-c2-rework2.json`（HEAD `8d5cdfd0b17`）。
- `node tests/run-all.mjs` は私の許可に無いので、今回も走らせていない（曹参か大岡越前守に頼む）。
- `C:\b\wt\verify-p2` には触れていない。`C:\b\wt\dev-c1` は回 i の状態。

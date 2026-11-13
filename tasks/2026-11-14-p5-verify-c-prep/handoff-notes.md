# 報告: 段階 C の単位（C-1〜C-7）の下準備の検証

- 検証: 大岡越前守（2026-11-14）
- 詳しい記録: `tasks/2026-11-14-p5-verify-c-prep/verification-log.md`
- 最新の判定: **合格**（2回目。末尾の「追記: 2回目」）

## 判定

**不合格**。理由は1つ。

C-1・C-2 の `unit.json` が、まだ無い `edits.patch` を `"patch"` に挙げている。そのため `node tests/run-all.mjs` が3件落ちる（TOTAL 1456、fail 3）。docs/03 の3.1 は `patch` を「無ければ書かない」と決めていて、C-3〜C-7 はそのとおりにしている。落ちたのは次の3件。

- `apply-commits.test.mjs`: edits.patch: unit.json が patch を指す単位は、そのファイルがあり…
- `removals.test.mjs`: unit C-1-ai: README.md がある。patch を指すなら、そのファイルがある
- `removals.test.mjs`: unit C-2-debug: 同上

同じ理由で、本物の `removals/` を使って C-1 込みで当てると、`apply.mjs` が「C-1-ai: patch が無い」で止まる（`trial/checks-real-dry.json`）。

ほかの項目はすべて合格。

## 確かめた成果

- 蒙恬（1人目）: `removals/C-1-ai`・`C-2-debug` の `unit.json`・`README.md`、`units-c-notes-c1-c2.md`・`trial-log-c1-c2.md`・`handoff-notes-c1-c2.md`
- 蒙恬（2人目）: `removals/C-3-remote`〜`C-7-breadcrumbs-outline` の `unit.json`・`README.md`、`units-c-notes-c3-c7.md`・`trial-log-c3-c7.md`・`handoff-notes-c3-c7.md`

## 項目ごとの結果

| 項目 | 結果 | 要点 |
|---|---|---|
| 1. 単位の形（3.1） | C-1・C-2 は不合格、C-3〜C-7 は合格 | order 310〜370、`enabled: false`、`after` の連なりは docs/03 の4節の末尾と一致する（循環なし）。不合格は `patch` の1点だけ |
| 1. Claude Code の受け手（9節） | **合格** | どの `delete` にも受け手は入っていない。C-1〜C-7 の ops を全部当てた `verify-p2` に、受け手の代表20ファイルと main の import の行が残っている。受け手から消したパスへの import は5行（`workspaceTrust.ts:18`・`workspace.contribution.ts:16`・`simpleCommentEditor.ts:16`・`viewsExtensionPoint.ts:27`・テスト1つ）。どれも README の「型検査で直す点」に、受け手であることを明記して挙がっている。受け手が使う部品（`debugColors.ts`・`notebook/common/notebookRange.ts`・`services/tunnel`・`editor/contrib/documentSymbols`）は `kept` に入っている。C-1 が消す window・workspace のチャットの4つは提案中の API（`checkProposedApiEnabled`）なので、Claude Code からは使えない |
| 1. 裁定との一致・残す根拠 | 合格（指摘2つ） | 消す範囲は裁定の7機能に入り、残す裁定の機能（検索・タスク・差分・プレビュー）を消していない。`kept` には全部理由があり、注入している側のファイルと行も書かれている |
| 1. 型検査で直す点（抜き取り） | 合格（指摘2つ） | 7単位で抜き取った50行あまりを `grep` で照らし、すべて実在した。取りこぼしもあった（下の指摘3・4） |
| 2. run-all | **不合格** | 上の3件 |
| 2. `verify-p2` に C-1〜C-7 の ops | 合格 | removeLines 144件すべて ok。依存8件・product の15キーがすべて消えた。`missingDeletes` は C-2 の `debugChatIntegration.ts` 1件だけ（意図どおり）。`absentStrings` の残りは C-1〜C-7 で蒙恬の記録と一致し、差分にもすべて説明がつく（C-1 56/4/38…、C-2 1、C-3 1、C-4 30、C-5 7、C-6 0、C-7 8）。C-2 は C-1 が無くても当たる（dry-run）。今の `enabled` のままの dry-run は ok（普段のビルドに響かない） |
| 3. SHA-256 | 済み | `verification-log.md` の0節 |

## 不合格の点と直し方

| # | 誰の成果のどこ | 直し方 |
|---|---|---|
| 1 | 蒙恬（1人目）: `removals/C-1-ai/unit.json` 215行と `removals/C-2-debug/unit.json` 101行の `"patch": "edits.patch"` | `edits.patch` を作るまでキーを外す（C-3〜C-7 と同じ形）。C-1・C-2 の README の「状態」の段落も合わせて直す。直した後、`node tests/run-all.mjs` が fail 0 になることを確かめ直す |

## 指摘（不合格の理由にはしない。リーダーの判断か、edits.patch を作るときの直しに回す）

1. C-1 は AI の検索（`contrib/search/browser/AISearch/aiSearchModel.ts`。提案中の API `aiTextSearchProvider` が結果を出す）を消していない。README の「消すか迷って残したもの」にも挙がっていない。裁定「本家の AI は消す」に入れるかどうかをリーダーが決める。結果を出す Copilot は A-1 で消えているので、残しても動かない見込み。
2. C-4 は `services/notebook` を残している（`kept` に理由はある）。ただ、docs/03 の4節の末尾にある「表から変えた点」には `contrib/notebook/common` しか書かれていない。docs に書き足す必要がある。
3. C-1 の README の一覧に `services/authentication/browser/authenticationQueryService.ts` が無い。このファイルは、消す MCP の認証のサービス3つを import していて（29・31・32行）、注入もしている（817〜821行）。型検査で見つかるが、注入しているので起動時の確かめも要る。
4. 消した部品を import するテストのうち、一覧に無いものがある。`api/test/browser/extHostAuthentication.integrationTest.ts`、`services/authentication/test/browser/*`、`contrib/search/test/browser/searchChatContext.test.ts`、`contrib/files/test/electron-browser/fileActions.contribution.test.ts`。
5. docs/03 の4節の箇条2は「C-2 以降は … after に C-1 を挙げる」と書いている。一方、同じ箇条の括弧と C-2 の `unit.json`（`after` は A-3 だけ）は C-2 を除いている。C-2 は sessions の入口に触れず、C-1 が無くても当たることを確かめた。直すべきは単位ではなく docs の言い回し（「C-3 以降」）。

## 記録

- `tasks/2026-11-14-p5-verify-c-prep/verification-log.md`（検証の記録）
- `tasks/2026-11-14-p5-verify-c-prep/run-all-result.txt`（run-all の結果）
- `tasks/2026-11-14-p5-verify-c-prep/trial/`: `checks-c1-c7.json`（本番の実行）、`checks-dry-c2.json`、`checks-default-dry.json`、`checks-real-dry.json`、試しの単位の写し `removals/`、空の `patches-none/`

## 作業ツリーの状態

- `C:\b\wt\verify-p2` は、A＋B＋C-1〜C-7 の ops を当てた状態で残した（HEAD `184966f5c5f9865d79cda6e01db70ef11de78766`。前は `ef5b647f…`）。A＋B だけの状態が要るなら、作り直すか `ef5b647f` に戻す必要がある。
- `C:\b\wt\1.146.0` は書き換えていない（HEAD `69047191…` のまま）。依存の導入・ビルド・型検査は走らせていない。

## 追記: 2回目（差し戻しの直しの確かめ、2026-11-14）

### 判定

**合格**。詳しくは `verification-log.md` の6節。

### 確かめた成果

蒙恬（1人目）が直した C-1・C-2（`handoff-notes-c1-c2.md` の追記と追記2）と、リーダーが記録した docs/03 の4節（`cb6a774`）・`docs/user-decisions.md`（`4d5af15`）。C-3〜C-7 は1回目から変わっていない（SHA-256 が同じ）。

### 根拠

| 項目 | 結果 | 要点 |
|---|---|---|
| 不合格の点（`patch`） | 合格 | C-1・C-2 の `unit.json` に `"patch"` が無い。両 README の「状態」も直っている |
| `node tests/run-all.mjs` | **合格** | TOTAL 1456、pass 1435、**fail 0**、skip 21。終了コード 0（`run-all-result-2.txt`）。1回目の3件が通った |
| 直した ops が 1.146.0 の A＋B の上に当たるか | 合格 | (a) 本物の `removals/` のまま 1.146.0 に A＋B＋C-1〜C-7 を dry-run で当てた。止まらず最後まで進み、removeLines 242件すべて ok（C-1 は96）。依存は `@modelcontextprotocol/sdk` を含めて全部消えた。`missingDeletes` は意図どおりの1件だけ（`trial2/checks-real-dry-2.json`）。(b) 実物の木 `verify-p2` で、増えた ops だけの差分の単位を当てた。delete 7件・removeLines 4件・依存1件がすべて当たった。増えた針の残りは `AISearch/aiSearchModel` 5（5つとも README の表5）、`artifactIntegrations/common/` 1（`extHost.protocol.ts:35`。表1）、`common/agentsSizes.js'` 0（`trial2/checks-c1-delta.json`） |
| Claude Code の受け手 | 合格 | 増えた delete（AI の検索・`artifactIntegrations`・`otel`・`agentsSizes.ts`・テスト3つ）に受け手は無い。受け手から消したパスへの import は1回目の5行から増えていない |
| speech を残す判断 | 合格 | 残る使い手7か所が README の `kept` のとおり実在した。Claude Code の manifest は音声の API を宣言していない。speech を残すので Claude Code から何も奪わない |
| 迷った部品の振り分け | 合格 | 消す側（`platform/otel`・`agentsSizes`・`artifactIntegrations`・`@modelcontextprotocol/sdk`）は、残る使い手が無いことを `grep` で確かめた（`agentsSizes` の CSS の変数を使う CSS も無い）。残す側の `agentsColors.ts` は、3つの CSS が色の変数を使うことを確かめた |
| 1回目の指摘1〜5 | 反映済み | 1は C-1 の delete と README の表5、2・5は docs/03（`cb6a774`）、3・4は README の表3・表6 |
| SHA-256 | 済み | `verification-log.md` の6.0 |

### 気づいた点（合否に関係しない）

- 設定の画面の AI の検索（`workbench.settings.enableNaturalLanguageSearch`。mydist の既定で false）は、まだ C-1 の範囲の外にある。今回の判断（検索のビューの AI の結果）とは別の部品。要るならリーダーが同じ規則で振り分ける。

### 記録

- `tasks/2026-11-14-p5-verify-c-prep/verification-log.md` の6節
- `tasks/2026-11-14-p5-verify-c-prep/run-all-result-2.txt`
- `tasks/2026-11-14-p5-verify-c-prep/trial2/`: `checks-real-dry-2.json`、`checks-c1-delta.json`、差分の単位と代役 `removals/`

### 作業ツリーの状態

- `C:\b\wt\verify-p2` の HEAD は `184966f5…` から `6fba38db6119ca8dbb2de9244f07b5ae8f323d0d` に変わった。A＋B に、直した C-1〜C-7 の ops を当てたのと同じ中身。`ef5b647f` に戻すことは私の許可ではできない（`git checkout`・`git -C` が許可に無い）ので、差分の単位で確かめた。
- `C:\b\wt\1.146.0` は dry-run で読んだだけで、HEAD は `69047191…` のまま。依存の導入・ビルド・型検査・`git fetch` は走らせていない。

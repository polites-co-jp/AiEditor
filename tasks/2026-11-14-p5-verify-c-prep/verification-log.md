# 検証の記録: 段階 C の単位（C-1〜C-7）の下準備

- 検証: 大岡越前守（2026-11-14）
- 依頼: `tasks/2026-11-14-p5-verify-c-prep/brief.md`
- 対象: 蒙恬（1人目）の C-1-ai・C-2-debug、蒙恬（2人目）の C-3〜C-7 の `unit.json`・`README.md` と、`tasks/2026-11-14-p5-units-c-prep/` の報告・メモ・試しの記録
- 判定（1回目）: **不合格**。理由は1つ。C-1・C-2 の `unit.json` が、まだ無い `edits.patch` を `patch` に挙げているため、`node tests/run-all.mjs` が3件落ちる（2の1）。それ以外の項目（形・Claude Code の受け手・裁定との一致・型検査で直す点の一覧・ops の当たり）は合格
- 判定（2回目、6節）: **合格**。差し戻しの直しを確かめた。run-all は fail 0。直した C-1 の ops は本家 1.146.0 に A＋B を当てた上で全部当たる。Claude Code の受け手は消していない（speech を残す判断を含む）

## 0. 確かめた版

- リポジトリ: `main` の `4187fed`（依頼書のコミット）に、未追跡の `removals/C-*` と `tasks/2026-11-14-p5-units-c-prep/*` が載った状態
- 本家: `C:\b\wt\1.146.0` の HEAD は `69047191fc427f2f92828279aae1d90d8eeda7ab`（作業の前後で同じ。`C:\b\vscode\.git\worktrees\1.146.0\HEAD` を読んだ）

SHA-256（`sha256sum`）:

```
fe1bbdaa00960617c7fab5d750f7b67033d3747ba489ad616eb887c982992631 *removals/C-1-ai/unit.json
3931ff7945dc9c20454c134dcacbcda42d414f1f73f5f4e2afb16eda1603af87 *removals/C-1-ai/README.md
a630b746012ec81d7e843b0d8c48cfd88e5876e273840119929172eb597829bc *removals/C-2-debug/unit.json
8cddfcea37eb232d2d2c07d2461097c69d9b5a2330042a7a23ff70be495da39b *removals/C-2-debug/README.md
3c662549a854b9e41c4230e2f637cd77192062ab53d48078f963ab1def892c31 *removals/C-3-remote/unit.json
48ae25beb54f0eb09c28cdeb828cc934a7109d9fced60a34fa6f4c5265313b17 *removals/C-3-remote/README.md
ec1d55aa4f8d1d725d703a5ce4a936e57ed92234c514196f2fc5978696047efd *removals/C-4-notebook/unit.json
cd646f084ca30f7b83555f8ec92bafd878f47b8025e154268d81f7bc7da32884 *removals/C-4-notebook/README.md
c38a12db1b0b67196fe4ddba31264eb73f2c08898111775cffce185cb88ff888 *removals/C-5-extension-gallery/unit.json
9c67cbde7d61e97e49d091f0d1c1f7067ec3b8ccf5054f44d60e8f1f9e495e54 *removals/C-5-extension-gallery/README.md
2740e3f6104ba57399979f8aa5fb3f9fc802bf589e45c8510a2b15142a435b44 *removals/C-6-settings-sync/unit.json
3bdd004188f4d64a27ce74e87f6efc323d27a2ad2049608dc741da773ac177d3 *removals/C-6-settings-sync/README.md
5f76a020d591de83a20facf67cb772d779768f0493a5a18c9560111c8e5a1df9 *removals/C-7-breadcrumbs-outline/unit.json
614a1b8ddc59e84da79547990f78570a053cb060ad68d1aefaf70f15e64a85eb *removals/C-7-breadcrumbs-outline/README.md
4f4443f5bd2ef44f35843e3b6e2457be75bde0f7fdda923bf966ab0c2d5f07a5 *tasks/2026-11-14-p5-units-c-prep/handoff-notes-c1-c2.md
230ddaaf05fa4753b2589fcbdd8eb0da07f0e007aaf53e88fffafbc1f07569e9 *tasks/2026-11-14-p5-units-c-prep/handoff-notes-c3-c7.md
1ea175ce5159a69ac6bec021468339265938e1a693dc6f3f9e94aebc824ba976 *tasks/2026-11-14-p5-units-c-prep/units-c-notes-c1-c2.md
c07d6203c8cb32b0199d1b37ce4e1abc50f62242cec4b592649e140bf38f42e5 *tasks/2026-11-14-p5-units-c-prep/units-c-notes-c3-c7.md
3ce568d36155b75f334caf9573c8259cebf649ee233349794577c9bd297808e1 *tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md
85f01669a618add307f8f2ffc454b6125e68f29ab72aa1989cb7bd079c78fcf5 *tasks/2026-11-14-p5-units-c-prep/trial-log-c3-c7.md
5d9350a55dabf99a2cb31699ee7d833593d9e525fd57a8c58e3f3f906402b234 *docs/03-removal-design.md
f4fe8c5083823e346316cf55f29cfae54de4d53578728bbcf8a5244d99945f57 *tests/removals.test.mjs
3bd4b2e9577dd78f8815cfe3b01f4a86966d920399f7992b8dd77d8e3776eeb9 *tests/apply-commits.test.mjs
241a8618fdbb81398bc121de6d64f19e2379f1c0f130b2d44a49bf1f4ed37b6b *scripts/apply.mjs
ee83271c10019fc9fc2a4dc9fe4f99bfa61fba033df48928fd4e874653dd6dff *scripts/lib/apply/units.mjs
```

## 1. レビュー

### 1.1 単位の形（docs/03 の3.1）— C-1・C-2 だけ不合格、C-3〜C-7 は合格

| 単位 | order | enabled | after | patch | 判定 |
|---|---|---|---|---|---|
| C-1-ai | 310 | false | A-1・B-1・B-2 | `edits.patch`（ファイル無し） | **不合格**（下） |
| C-2-debug | 320 | false | A-3 | `edits.patch`（ファイル無し） | **不合格**（下） |
| C-3-remote | 330 | false | A-5・C-1 | 書いていない | 合格 |
| C-4-notebook | 340 | false | A-4・B-4・C-1・C-2 | 書いていない | 合格 |
| C-5-extension-gallery | 350 | false | C-1 | 書いていない | 合格 |
| C-6-settings-sync | 360 | false | C-1 | 書いていない | 合格 |
| C-7-breadcrumbs-outline | 370 | false | B-4・C-1・C-4 | 書いていない | 合格 |

- docs/03 の3.1 の表は `patch` を「単位のフォルダの中のファイルの名前で、既定は `edits.patch`。**無ければ書かない**」と決めている。C-1・C-2 は無いファイルを挙げている。C-3〜C-7 はこの規則どおり `patch` を書かず、`units-c-notes-c3-c7.md` の冒頭で「edits.patch を作るときに足す」と書いている（同じ下準備で2人の扱いが分かれた）。
- 結果として、`tests/removals.test.mjs`・`tests/apply-commits.test.mjs` が落ち（2の1）、本物の `removals/` で C-1 を含めて当てると `apply.mjs` が「patch が無い」で止まる（2の3）。
- `after` の連なりは docs/03 の4節の末尾（2026-11-14 にリーダーが認めた点）と一致する。循環なし、すべて自分より小さい order（`removals.test.mjs` の該当の検査が通った）。
- C-2 の `after` に C-1 が無い点: docs/03 の4節の箇条2は「C-2 以降は sessions の入口を removeLines で直さず、after に C-1 を挙げる」と書くが、同じ箇条の括弧は「C-3〜C-7 は C-1、C-4 は C-2、C-7 は C-4」で C-2 を挙げない。`src/vs/sessions` を `grep` すると、C-2 が消すファイル（`debug/browser` の大半・`debug/node`）を import する行は無く、sessions は残す `nullDebugService.ts`・`debug.ts`・`debugVisualizers.ts`・`extensionHostDebugService.ts` だけを読む。C-2 は C-1 から独立して当たる（2の2の dry-run で確かめた）。単位は正しく、docs の箇条2の言い回し（「C-2 以降」）が括弧と合っていない。不合格の理由にはしない。

### 1.2 Claude Code が使う受け手（docs/03 の9節）を消していないか — 合格

確かめ方: (a) 各単位の `delete` を読む。(b) C-1〜C-7 の ops を全部当てた作業ツリー `C:\b\wt\verify-p2`（2の2）で、受け手のファイルが残っていることを Glob で見る。(c) 受け手のフォルダ・ファイルから、消したパスへの import を `grep` する。

- (a) どの `delete` にも、`contrib/webview`・`webviewPanel`・`webviewView`・`customEditor`・`contrib/comments`・`multiDiffEditor`・`browser/parts/auxiliarybar`・`browser/parts/editor/textDiffEditor.ts`・`editor/browser/widget/diffEditor`・`services/workspaces`・`contrib/workspace`・`api/common/jsonValidationExtensionPoint.ts`・`api/browser/viewsExtensionPoint.ts`・`services/actions/common/menusExtensionPoint.ts`・`api/browser/mainThread{Comments,FileSystem,WebviewManager}.ts`・`platform/files` は入っていない。
- (b) 上のうち代表の20ファイルが `verify-p2`（A＋B＋C-1〜C-7 の ops の後）に全部ある。`workbench.common.main.ts` の Comments・Webview（3行）・customEditor・multiDiffEditor・workspace、`workbench.desktop.main.ts` の webview・`services/tunnel`・`sharedProcessTunnelService`・`extensionHostDebugService` の import も残る。`extensionHost.contribution.ts` の `mainThreadComments`・`FileSystem`・`WebviewManager`・`TreeViews`・`Window`・`Workspace`・`Commands`・`Configuration`・`Authentication`・`TunnelService` の import も残る。
- (c) 受け手のフォルダから消したパスへの import は、`verify-p2` で次の5行だけ。どれも各 README の「型検査で直す点」に、受け手であることを明記して挙がっている（直すのは参照の1行だけと書いてある）。
  - `services/workspaces/common/workspaceTrust.ts:18`・`contrib/workspace/browser/workspace.contribution.ts:16`（`AGENT_HOST_SCHEME`。C-1 の README の3の表）
  - `contrib/comments/browser/simpleCommentEditor.ts:16`（`EditorDictation`。C-1 の README の3の表）
  - `api/browser/viewsExtensionPoint.ts:27`（`VIEWLET_ID as REMOTE`。C-3 の README の表。`secondarySidebar` の viewsContainers を受けるファイル）
  - `contrib/workspace/test/browser/workspaceTrustRequestHandler.test.ts:12`（テスト）
- 受け手が使う残す部品も確かめた: `contrib/debug/browser/debugColors.ts`（`workspaceTrustEditor.ts:44` が使う）は C-2 の `kept`。`contrib/notebook/common/notebookRange.ts`（コメントの6ファイルが `ICellRange` を使う）は C-4 の `kept`。`services/tunnel`（Webview が注入）は C-3 の `kept`。`editor/contrib/diffEditorBreadcrumbs` は `services/outline` でなく `editor/contrib/documentSymbols`（C-7 の `kept`）を使う。
- `window.createAgentEditorComments`・`createChatStatusItem`・`activeChatPanelSessionResource`・`workspace.transferActiveChat`（C-1 が実装を消すもの）は、`extHost.api.impl.ts` の1094・1109・1113・1717行でいずれも `checkProposedApiEnabled` を通る提案中の API。Claude Code の manifest に `enabledApiProposals` は無い（`records/phase0/claude-code-manifest.md`）ので、Claude Code はこれらを使えない。
- 未確認（関門のスモークで見る。docs/03 の9節の3つめ）: Claude Code が宣言に出さずに `vscode.lm` などを呼ぶか。下準備の範囲の外。

### 1.3 消す範囲が裁定に合うか・残す根拠が README にあるか — 合格（指摘あり）

- 裁定（`docs/user-decisions.md` の26・27・30・35・47・59行）: AI・デバッガ・リモート・ノートブック・拡張の追加インストール・設定の同期（Notion を使う）・アウトラインとパンくずを消す。全文検索・差分ビュー・言語機能・Markdown・画像と PDF のプレビュー・問題パネル・タスクは残す。
- 各単位の `delete` はこの範囲に入る。C-1 の docs/03 の表に無い追加（`src/vs/sessions` などの AI の部品）は docs/03 の4節の末尾でリーダーが認めた。
- 残す裁定の機能を消していない: C-2 は `contrib/tasks` を消さない（`debugTaskRunner.ts` はデバッグ側）。C-2 が消す `linkDetector.ts`・`debugANSIHandling.ts` を残る部品が読む行は `verify-p2` で0件（`absentStrings` も0）。C-4 は全文検索を消さず、検索からノートブックの部品を外す直しを README に約15ファイル挙げた。C-7 は `editor/contrib/documentSymbols`（記号へ移動）と `base/browser/ui/breadcrumbs`（差分エディタ）を残す。
- 残す判断の根拠: 7単位とも `kept` の各項目に理由があり（`removals.test.mjs` の「kept の各要素に path と reason」が通った）、README の「残すもの」に、注入している側のファイルと行が書いてある。抜き取りで確かめた例: C-3 の `ITunnelService` を Webview が注入（`kept` の理由）、C-5 の `extensionGalleryManifestService` の Barrier、C-6 の `@IUserDataSyncWorkbenchService` の注入3か所（`settingsEditor2.ts:285`・`relauncher.contribution.ts:115`・`update.ts:397`。`verify-p2` で `grep` して README の表と一致）。

指摘（不合格の理由にはしない。リーダーの判断と、edits.patch のときの直しに回す）:

1. C-1 が AI の検索（`contrib/search/browser/AISearch/aiSearchModel.ts`。拡張の提案中の API `aiTextSearchProvider` が結果を出す）を消さず、README の「消すか迷って残したもの」にも挙げていない。C-4 の README は C-1 が消さないことに触れている。裁定「本家の AI は消す」の範囲かどうかをリーダーが決める（提供者の Copilot は A-1 で消えているので、残しても動かない見込み）。
2. C-4 は `services/notebook` を残す（`kept` に理由あり）。docs/03 の表は消す側に挙げ、4節の末尾の「表から変えた点」は C-4 について `contrib/notebook/common` しか書いていない。docs の書き足しの対象。

### 1.4 「型検査で直す点」の一覧が grep で支えられるか（抜き取り）— 合格（指摘あり）

一覧に挙がった行を、`C:\b\wt\dev-c1`（A＋B＋C-1＋C-2 の ops）・`C:\b\wt\dev-c3`（A＋B＋C-1 の ops＋C-3〜C-7）・`verify-p2` で `grep` して照らした。挙がった行はすべて実在した。

| 単位 | 抜き取った項目 | 結果 |
|---|---|---|
| C-1 | `workspaceTrust.ts:18`、`workspace.contribution.ts:16`、`simpleCommentEditor.ts:16`、`globalCompositeBar.ts:53`、`extensionsViewlet.ts:74・75`、`extensions.contribution.ts:64・65・73`、`mainThreadAuthentication.ts:37`、`testing.contribution.ts:36`、`markers.contribution.ts:39`、`scm.contribution.ts:41`、`scmHistoryViewPane.ts:74`、`scmInput.ts:30`、`search.contribution.ts:27`、`extHost.api.impl.ts:127`、`extHostTypeConverters.ts:53`（44〜58 の範囲） | 一致 |
| C-2 | `repl.contribution.ts:38`、`extHost.api.impl.ts:55・215・1556〜1620`、`debug.service.contribution.ts:7`（`DebugService` の import） | 一致 |
| C-3 | `viewsExtensionPoint.ts:27`（`contrib/remote` を import する残りはこの1行だけ。相対の `../remote/` も0件） | 一致 |
| C-4 | 検索の木のモデル（`folderMatch.ts:21〜25`・`fileMatch.ts:19`・`searchResult.ts:13・14`・`searchTreeCommon.ts:14`・`textSearchHeading.ts:19`）、`searchView.ts:58・84`、`searchWidget.ts:39`、`searchFindInput.ts:12・13`、`searchCompare.ts:6`、`searchActionsRemoveReplace.ts:26`、`search.common.contribution.ts:14`、`replaceService.ts:33`、`aiSearchModel.ts:17`、`bulkCellEdits.ts:15`、`mainThreadEditorTabs.ts:22`、`searchEditorSerialization.ts:18`、検索のテスト5つ | 一致 |
| C-5 | `extensions.contribution.ts:28・56・57・76・77`、`extensionsActions.ts:19・53`、`extensionsViews.ts:13`、`extensionGalleryManifestService.ts:27`、`sharedProcessMain.ts:33・35`（複数の名前の import の中の `IExtensionTipsService`・`ExtensionTipsChannel`） | 一致 |
| C-6 | `settingsEditor2.ts:285`、`relauncher.contribution.ts:115`、`update.ts:397`（`@IUserDataSyncWorkbenchService` と `get(...)` はこの3か所だけ） | 一致 |
| C-7 | `editorHeaderControl.ts:12`、`singleEditorTabsControl.ts:21`、`gotoSymbolQuickAccess.ts:29・64`、`mainThreadCustomEditors.ts:14・115`、`tabs.fixture.ts:37・43`、`anythingQuickAccess.test.ts:27`、`mainThreadCustomEditors.test.ts:43`（`@IOutlineService`・`@IBreadcrumbsService` もこれだけ） | 一致 |

指摘（取りこぼし。どれも型検査で見つかる種類だが、一覧が「import の文を grep した結果」と書く以上は載るべきもの）:

3. C-1 の README の一覧に `services/authentication/browser/authenticationQueryService.ts` が無い。消す `authenticationMcp{Usage,Access,}Service.ts` を29・31・32行で import し、817・819・821行で3つとも**注入**している（`dev-c1` で確かめた）。`contrib/authentication`（拡張のアカウントの管理の操作）が使う。直しが要る製品のファイルで、注入なので型検査の後も起動時の確かめが要る。
4. 同じく、消した部品を import するテストが一覧に無い: `api/test/browser/extHostAuthentication.integrationTest.ts:42〜44`、`services/authentication/test/browser/*`（4ファイル）、`contrib/search/test/browser/searchChatContext.test.ts:13`（消す `searchChatContext.ts` のテストが残る）、`contrib/files/test/electron-browser/fileActions.contribution.test.ts:11`。

## 2. 実行

### 2.1 `node tests/run-all.mjs` — 不合格

```
node tests/run-all.mjs --save tasks/2026-11-14-p5-verify-c-prep/run-all-result.txt
```

結果（全文は `run-all-result.txt`）: TOTAL tests 1456、pass 1432、**fail 3**、skip 21。終了コード 1。

```
Failing:
  apply-commits.test.mjs: edits.patch: unit.json が patch を指す単位は、そのファイルがあり、From: と件名が揃っている
  removals.test.mjs: unit C-1-ai: README.md がある。patch を指すなら、そのファイルがある
  removals.test.mjs: unit C-2-debug: README.md がある。patch を指すなら、そのファイルがある
```

- 3件とも原因は1つ（1.1 の C-1・C-2 の `patch`）。テストは docs/03 の3.1（「無ければ書かない」）のとおりに書かれており、テストの側を緩める理由は無い。
- `removals.test.mjs`: 229件、pass 206、fail 2、skip 21。skip は「有効の単位の after はすべて有効」で、21単位がすべて `enabled: false` のため（正しい skip）。C の7単位の形の検査（id・stage・order の範囲・必須の項目・delete の相対パス・removeLines の形・kept の理由・checks の名前・after の実在と順・README）は、C-1・C-2 の patch の1件ずつを除いて通った。order と id の重複なし、after の循環なし。
- 注: `removals.test.mjs` が removeLines を本家に照らすのは段階 A・B だけ（225行）で、C の removeLines は見ない。C の removeLines は 2.2 の apply で確かめた。
- 注: 作業ツリーにある、この依頼と関係の無い未追跡の `tests/p34-selfcheck.test.mjs`（1件 pass）と変更中の `tests/probe-dns.ps1` も数に入っている。

### 2.2 `C:\b\wt\verify-p2` に C-1〜C-7 の ops を当てる — 合格

- 当てる前: `verify-p2` の HEAD は `ef5b647f852e1f0977a02c8b758abaa8c340382d`（A＋B と patches/20・30 を当てた状態。`tasks/2026-11-14-p2-verify-prebuild/verification-log.md` の6.4）。
- 単位の写し: `trial/removals/` に置いた。
  - C-3〜C-7 は `removals/` と同じ中身（SHA-256 が5つとも一致。0節の値と同じ）。
  - C-1・C-2 は `"patch": "edits.patch"` の1行だけを外した写し（行の数が 261→260、137→136）。ほかの行が同じことは、下の ops の結果（delete 107・removeLines 92 がすべて当たる、`absentStrings` の数が蒙恬の記録と同じ）で確かめた。
  - A・B の14単位は代役（ops なし、order は本物と同じ、`checks.absentSettings` は本物と同じ）。verify-p2 にはもう当たっているので、`after` を満たすためと、`mydist` の既定を本物と同じに外すために置いた。
- `--patches` には空のフォルダ `trial/patches-none/` を渡した（patches/20・30 を二重に当てないため）。

(a) C-2 だけ（C-1 なし）を dry-run で当てる:

```
node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-c-prep-dry-c2 --dry-run --only A-3-debug-extensions,C-2-debug --removals tasks/2026-11-14-p5-verify-c-prep/trial/removals --patches tasks/2026-11-14-p5-verify-c-prep/trial/patches-none --checks-out tasks/2026-11-14-p5-verify-c-prep/trial/checks-dry-c2.json
```

結果 ok。C-2 の removeLines 17件すべて `found: 1`。C-2 は C-1 が無くても ops が当たる（1.1 の独立）。

(b) C-1〜C-7 を全部当てる（本番の実行）:

```
node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-c-prep --only <A-1〜A-7・B-1〜B-7（代役）>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync,C-7-breadcrumbs-outline --removals tasks/2026-11-14-p5-verify-c-prep/trial/removals --patches tasks/2026-11-14-p5-verify-c-prep/trial/patches-none --checks-out tasks/2026-11-14-p5-verify-c-prep/trial/checks-c1-c7.json
```

結果（`trial/checks-c1-c7.json`）: `stoppedAt: null`、`errors: []`、終わりの HEAD `184966f5c5f9865d79cda6e01db70ef11de78766`。`result: fail` は `absentStrings` の残りだけ（edits.patch がまだ無いので想定どおり）。

| 検査 | 結果 |
|---|---|
| 単位 C-1〜C-7 の `applied` | 7つとも ok（edits は `none`） |
| `missingDeletes` | C-2 の `debugChatIntegration.ts` 1件だけ（C-1 が先に消すため。C-1・C-2 の README に書かれた意図どおりの警告） |
| removeLines | 144件すべて `ok: true`（C-1 92・C-2 17・C-3 13・C-4 9・C-5 8・C-6 3・C-7 2。C-1 の `count: 2` の4件も2） |
| removeDependencies | C-1 の8件すべて消えた（ルート6・`remote/package.json` 2）。`missingDependencies` なし |
| productRemove | C-1 の6キー・C-3 の9キーがすべて消えた。`productMissing` なし |
| remnants（delete の消え残り） | ok |
| unclassifiedExtensions | ok |
| registeredKeys | ok（mydist の既定から `chat.disableAIFeatures`（C-1）・`breadcrumbs.enabled`（C-7）・`workbench.startupEditor`（B-2）・`terminal.integrated.suggest.enabled`（B-7）が外れた） |
| commitIdentity | ok（`shuko-apply <apply@shuko.invalid>`） |

`absentStrings` の残り（edits.patch で0にする数）:

| 単位 | 残り | 蒙恬の記録との照合 |
|---|---|---|
| C-1 | `contrib/chat/` 56、`contrib/mcp/` 4、`platform/agentHost/` 38、`services/agentHost/` 1、`platform/mcp/` 36、`terminalContrib/chat/` 1、`chatAgents.js'` 9、`languageModels.js'` 3、`languageModelToolsService.js'` 3、`mcpTypes.js'` 5、`agentService.js'` 2、`./extHostChatAgents2.js'` 1、`./extHostLanguageModels.js'` 2、`./extHostMcp.js'` 1、`vs/sessions/` 3、ほか0 | trial-log-c1-c2 の回 b（C-1 だけ）より `contrib/chat/` が1、`contrib/inlineChat/` が1、`chatAgents.js'` が4少ない。C-2・C-4 が、それらを import するノートブックの部品を消したため（筋が通る） |
| C-2 | `/extHostDebugService.js'` 1（`extHost.api.impl.ts`） | 回 d の2件から `repl.js'` が消えた（C-4 が `replNotebook` を消すため） |
| C-3 | 1（`viewsExtensionPoint.ts`） | trial-log-c3-c7 の回 i と同じ |
| C-4 | 30（3・4・6・1・9・6・1） | 回 i と同じ |
| C-5 | 7 | 回 i と同じ |
| C-6 | 0 | 回 i と同じ |
| C-7 | 8（`breadcrumbsControl.js'` 2、`breadcrumbs.js'` 1、`services/outline/browser/outline.js'` 5） | 回 i と同じ |

(c) 今の `enabled` のまま（`--only` なし）で、本物の `removals/` を dry-run:

```
node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-c-prep-default-dry --dry-run --patches tasks/2026-11-14-p5-verify-c-prep/trial/patches-none --checks-out tasks/2026-11-14-p5-verify-c-prep/trial/checks-default-dry.json
```

結果 ok。全単位が `enabled: false` なので何も当たらず、本物の `removals/` の C の7単位を読んでも形の誤りで止まらない。普段のビルドには響かない。

### 2.3 本物の `removals/` で C-1 を含めて当てると止まる（2.1 の影響の確かめ）

```
node scripts/apply.mjs C:/b/wt/1.146.0 --label verify-c-prep-real-dry --dry-run --only <A-1〜B-7>,C-1-ai,…,C-7-breadcrumbs-outline --checks-out tasks/2026-11-14-p5-verify-c-prep/trial/checks-real-dry.json
```

`C-1-ai: patch が無い: …\removals\C-1-ai\edits.patch` で止まった（C-1 の ops までは当たる）。dry-run はメモリの上だけで書き、rerere の設定もしない（`apply.mjs` 262・263行）。`C:\b\wt\1.146.0` の HEAD は前後とも `69047191…`。

- これは edits.patch ができるまでの間、本物の `removals/` で C の単位の ops を当てる試し（関門の前の確かめ、曹参のテストの入口「実物での確かめ」）が C-1 の所で止まることを意味する。C-3〜C-7 の形（`patch` を書かない）に合わせれば、ops の後の `absentStrings` まで進む。

## 3. 確かめた版の SHA-256 — 済み

0節に記録した。

## 4. 不合格の点と直し方

| # | 誰の成果のどこ | 直し方 |
|---|---|---|
| 1 | 蒙恬（1人目）の `removals/C-1-ai/unit.json` の `"patch": "edits.patch"`（215行）と `removals/C-2-debug/unit.json` の同じ行（101行） | `edits.patch` を作るまで `patch` のキーを外す（docs/03 の3.1「無ければ書かない」。C-3〜C-7 と同じ扱い）。C-1・C-2 の README の「状態」の段落（「patch に挙げたファイルが無いので … ops のコミットの後で止まる」）も合わせて直す。直した後に `node tests/run-all.mjs` が fail 0 になることを確かめ直す |

## 5. 守ったこと

- コード・テスト・docs・`removals/` は直していない。書いたのは `tasks/2026-11-14-p5-verify-c-prep/` の下だけ（この記録、`handoff-notes.md`、`run-all-result.txt`、`trial/`）。
- 書き換えた作業ツリーは `C:\b\wt\verify-p2` だけ（HEAD `ef5b647f…` → `184966f5…`。A＋B＋C-1〜C-7 の ops の状態で残した）。`C:\b\wt\1.146.0` は dry-run で読んだだけで、HEAD は変わっていない。`dev-c1`・`dev-c3` は読んだだけ。
- 依存の導入・ビルド・型検査は走らせていない。
- `git -C C:/b/wt/verify-p2 status` は許可に無い形なので使っていない。作業ツリーが clean であることは、`apply.mjs` が当てる前に `git status --porcelain` で見て、変更があれば止める（止まらなかった）。

## 6. 2回目: 差し戻しの直しの確かめ（2026-11-14）

依頼: リーダーの伝言（差し戻した C-1・C-2 の直しが `tasks/2026-11-14-p5-units-c-prep/handoff-notes-c1-c2.md` の追記と追記2に届いた。run-all、直した ops が 1.146.0 の A＋B の上に当たるか、Claude Code の受け手（speech を残す判断を含む）、SHA-256 を確かめよ）。

判定: **合格**。

### 6.0 確かめた版

リポジトリは `main` の `4d5af15`（docs/03 の `cb6a774`、`docs/user-decisions.md` の `4d5af15` を含む）に、未追跡の `removals/C-*` が載った状態。

```
46f628647aef0dddb305eff30c214031fa1ae1b99fae71853f34dd323d319956 *removals/C-1-ai/unit.json
50bacba6d6fa98e69697e42d7fb9fad32e72418b41a9e144844891db9e47cb72 *removals/C-1-ai/README.md
cb882ea55d65e6aeadcb88df2ea54255d7a8d1972daf3a5056479bc7dd0835d9 *removals/C-2-debug/unit.json
b1e94937af2f0d3b9e1cd8c65b78edbd382a4598ce900f0b610acc06845fae87 *removals/C-2-debug/README.md
3c662549a854b9e41c4230e2f637cd77192062ab53d48078f963ab1def892c31 *removals/C-3-remote/unit.json
48ae25beb54f0eb09c28cdeb828cc934a7109d9fced60a34fa6f4c5265313b17 *removals/C-3-remote/README.md
ec1d55aa4f8d1d725d703a5ce4a936e57ed92234c514196f2fc5978696047efd *removals/C-4-notebook/unit.json
cd646f084ca30f7b83555f8ec92bafd878f47b8025e154268d81f7bc7da32884 *removals/C-4-notebook/README.md
c38a12db1b0b67196fe4ddba31264eb73f2c08898111775cffce185cb88ff888 *removals/C-5-extension-gallery/unit.json
9c67cbde7d61e97e49d091f0d1c1f7067ec3b8ccf5054f44d60e8f1f9e495e54 *removals/C-5-extension-gallery/README.md
2740e3f6104ba57399979f8aa5fb3f9fc802bf589e45c8510a2b15142a435b44 *removals/C-6-settings-sync/unit.json
3bdd004188f4d64a27ce74e87f6efc323d27a2ad2049608dc741da773ac177d3 *removals/C-6-settings-sync/README.md
5f76a020d591de83a20facf67cb772d779768f0493a5a18c9560111c8e5a1df9 *removals/C-7-breadcrumbs-outline/unit.json
614a1b8ddc59e84da79547990f78570a053cb060ad68d1aefaf70f15e64a85eb *removals/C-7-breadcrumbs-outline/README.md
5fe41fbd9ac78a3058fe97f5afc8a1b969e455b78aaad89d6f1e460ccacfa617 *tasks/2026-11-14-p5-units-c-prep/handoff-notes-c1-c2.md
865437119f2418783b9ab37e7451a2e62b3fa6a3dc336e6e47514ce548de150f *tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md
d8c999a596c81d6c2bd1a4a7141317ec61b1321bc60117b2dfb56aae79890518 *docs/03-removal-design.md
7460a482250c672c28086e558cce70fbcb9712c7cf2fd0ce1801e1ffb0f58379 *docs/user-decisions.md
```

- C-3〜C-7 の `unit.json`・`README.md` は1回目と同じ値（変わっていない）。変わったのは C-1・C-2 の4ファイル。

### 6.1 不合格の点の直し — 合格

- `removals/C-1-ai/unit.json`・`C-2-debug/unit.json` に `"patch"` のキーが無い（`grep '"patch"' removals/C-*/unit.json` が0件）。C-2 は1行減って136行（`patch` の行だけが抜けた。中身は 6.3 の dry-run で、delete・removeLines が1回目と同じに当たることで確かめた）。
- 両 README の「状態」の段落は「`patch` のキーを書かない（docs/03 の3.1）。`edits.patch` を作ったときに足す」に直っている。C-2 の README に `after` を A-3 だけにした理由の1行がある（1回目の指摘5）。

### 6.2 `node tests/run-all.mjs` — 合格

```
node tests/run-all.mjs --save tasks/2026-11-14-p5-verify-c-prep/run-all-result-2.txt
```

TOTAL tests 1456、pass 1435、**fail 0**、skip 21。終了コード 0。1回目に落ちた3件（`apply-commits.test.mjs` 1件、`removals.test.mjs` の C-1・C-2 の2件）が通った。`removals.test.mjs` は 229件、pass 208、skip 21（全21単位が `enabled: false` のための正しい skip）。

### 6.3 直した ops が 1.146.0 の A＋B の上に当たるか — 合格

`verify-p2` は 1回目の C-1〜C-7 の ops が当たった状態（`184966f5…`）で、私の許可では `ef5b647f` に戻せない（`git checkout` も `git -C` も許可に無い）。そこで次の2つで確かめた。

(a) 本物の `removals/` のまま、本家 1.146.0 に A＋B＋C-1〜C-7 を順に dry-run で当てる（メモリの上だけで書く。`C:\b\wt\1.146.0` は書き換えない）:

```
node scripts/apply.mjs C:/b/wt/1.146.0 --label verify-c-prep-real-dry-2 --dry-run --only <A-1〜A-7・B-1〜B-7>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync,C-7-breadcrumbs-outline --checks-out tasks/2026-11-14-p5-verify-c-prep/trial2/checks-real-dry-2.json
```

結果 ok、`stoppedAt: null`。1回目の 2.3 で止まった「C-1-ai: patch が無い」は出ず、21単位すべてと patches/20・30（dry-run なので skipped）まで進んだ。removeLines は 242件すべて `ok: true`（A＋B 94、C-1 96・C-2 17・C-3 13・C-4 9・C-5 8・C-6 3・C-7 2）。C-1 の依存は `@modelcontextprotocol/sdk` を含めて消え、`missingDependencies`・`productMissing` なし。`missingDeletes` は C-2 の `debugChatIntegration.ts` 1件だけ（意図どおり）。HEAD は前後とも `69047191…`。

(b) 実物の木で、増えた ops だけを当てる（別の試しの写し `trial2/removals/`）:

- `C-1-ai`: 直した C-1 で増えた分だけを持つ差分の単位（delete 7件＝`searchChatContext.test.ts`・`AISearch`・`authenticationMcpService.test.ts`・`authenticationMcpAccessService.test.ts`・`platform/artifactIntegrations`・`platform/otel`・`common/agentsSizes.ts`、removeLines 4件、依存1件）。`kept` と `checks` は直した C-1 と同じ。
- B-2・B-7・C-7 は代役（ops なし。mydist の既定を本物と同じに外すため `absentSettings` だけ）。

```
node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-c-prep-rework --only B-2-onboarding-experiments-surveys,B-7-terminal-suggest,C-1-ai,C-7-breadcrumbs-outline --removals tasks/2026-11-14-p5-verify-c-prep/trial2/removals --patches tasks/2026-11-14-p5-verify-c-prep/trial/patches-none --checks-out tasks/2026-11-14-p5-verify-c-prep/trial2/checks-c1-delta.json
```

結果: 単位は全部 `applied: ok`、delete 7件すべて消え（`missingDeletes` なし）、removeLines 4件すべて `found: 1`、`@modelcontextprotocol/sdk` が devDependencies から消えた。`result: fail` は `absentStrings` だけ（edits.patch が無いので想定どおり）。終わりの HEAD `6fba38db6119ca8dbb2de9244f07b5ae8f323d0d`。

| 増えた針 | 残り | 中身と README |
|---|---|---|
| `AISearch/aiSearchModel` | 5 | `searchActionsRemoveReplace.ts:27`・`searchCompare.ts:11`・`searchResultsView.ts:37`・`searchView.ts:86`・`searchTreeModel/searchResult.ts:20`。5つとも C-1 の README の表5（109〜113行）にある |
| `artifactIntegrations/common/` | 1 | `extHost.protocol.ts:35`。README は表1で Shape と一緒に消すと書く（蒙恬の記録の 1 と一致） |
| `common/agentsSizes.js'` | 0 | — |

ほかの C-1 の針の数は1回目の 2.2(b) と同じ（`contrib/chat/` 56 など）。remnants・registeredKeys も ok。

- 使い手の確かめ（`verify-p2`）: `platform/otel` を import する所は無い（自分の中のテストと注釈だけ）。`agentsSizes` が登録するサイズの CSS の変数（`--vscode-agents-…`）を使う CSS は無い。`@modelcontextprotocol/sdk` は src に無く、`eslint.config.js` 1823行と `build/agent-sdk/`（AI の SDK の梱包）だけ。
- 1回目の指摘3・4（`authenticationQueryService.ts`・テスト）は README の表3（101行）・表6（130〜134行）に入った。

### 6.4 Claude Code の受け手（speech を残す判断を含む）— 合格

- 増えた delete 7件は、どれも受け手（docs/03 の9節）ではない。AI の検索（`AISearch`）は検索のビューの中の AI の結果の部品で、検索そのもの（裁定で残す）は消さない。
- `verify-p2`（差分を当てた後）で、受け手のフォルダ（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム・メニューの場所）から消したパスへの import を `grep` した。1回目の5行（`workspaceTrust.ts:18`・`workspace.contribution.ts:16`・`simpleCommentEditor.ts:16`・`viewsExtensionPoint.ts:27`・テスト1つ）のほかに、新しい行は無い。範囲を広げて認証（`services/authentication`・`mainThreadAuthentication.ts`）も見た。残る参照は README の表にある `authenticationQueryService.ts`・`mainThreadAuthentication.ts:34・37` と、その試験だけ。
- `contrib/speech` を残す判断: 残る使い手は README の `kept` のとおり（`accessibilityConfiguration.ts:12`・`accessibility.contribution.ts:16`・`editorAccessibilityHelp.ts:17`・`terminalMenus.ts:21`・`terminalAccessibilityHelp.ts:22`・`mainThreadSpeech.ts:11`・`extHost.protocol.ts:84`。`verify-p2` で `grep` して一致）。Claude Code の manifest は音声の API を宣言しておらず（`records/phase0/claude-code-manifest.md`。音声の入力は拡張に同梱の `audio-capture.node` が担う見込み）、speech は残すので、どちらであっても Claude Code から何かを奪わない。
- `agentsColors.ts` を残す判断: 残る CSS が色の変数を使うことを確かめた（`partGrid.css:182・214` の `--vscode-agentsCard-border`、`feedbackInputWidget.css:10` の `--vscode-agentFeedbackInputWidget-border`、`frostedGlass.css:66` の `--vscode-agentFeedbackEditorWidget-background`）。
- `imageCarousel` を残す判断: 画像のプレビュー（裁定で残す）側の画面という README の理由を読んだ。受け手とは関係しない。

### 6.5 docs の記録

- `docs/03-removal-design.md` の4節の末尾（`cb6a774`）: C-1 が AI の検索も消すこと、C-4 が `services/notebook` も残すこと、C-2 は C-1 を前提にしないことが書かれた（1回目の指摘1・2・5）。単位の中身と一致する。

### 6.6 気づいた点（合否に関係しない）

- 設定の画面の AI の検索（`workbench.settings.enableNaturalLanguageSearch`。mydist の既定で false）は C-1 の範囲の外のまま。今回の判断（検索のビューの AI の結果）とは別の部品なので、要るならリーダーが同じ規則で振り分ける。

### 6.7 守ったこと

- コード・テスト・docs・`removals/` は直していない。書いたのは `tasks/2026-11-14-p5-verify-c-prep/` の下だけ（この追記、`handoff-notes.md` の追記、`run-all-result-2.txt`、`trial2/`）。
- `C:\b\wt\verify-p2` は HEAD `184966f5…` → `6fba38db…`（A＋B＋直した C-1〜C-7 の ops に相当する状態）。`C:\b\wt\1.146.0` は dry-run で読んだだけ（HEAD `69047191…` のまま）。依存の導入・ビルド・型検査・`git fetch` は走らせていない。

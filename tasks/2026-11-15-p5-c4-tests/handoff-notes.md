# Phase 5 の下ごしらえ（C-4 の検査とテスト）の引き継ぎ

曹参から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。依頼の1〜6がそろった。`C:\b\wt\p2` には触れていない（蒙恬が C-5 で使用中）。本家の読み取りは常設の clone（`C:/b/vscode` のタグ 1.146.0）だけ。

## 成果物

すべて `tests/` の下（照らし役は直下）。本体のコード、`removals/`、`docs/` は直していない。

| ファイル | 中身 | 件数 |
|---|---|---|
| `tests/c4-unit.test.mjs` | 単位のファイルの静的な検査、検索の直しの検査、何もしない実装の検査（文字列と構文）、何もしない実装を走らせる検査 | 52 |
| `tests/c4-mutation.test.mjs` | 壊した写しで `c4-unit.test.mjs` が落ちること（対照1 + 壊し方61） | 62 |
| `tests/c4-check-json.mjs` | 照らし役。当て直しの記録（a・b）と型検査の記録を照らす。`--stopped` で「前提の単位を外すと止まる」記録も照らす | — |
| `tests/c4-check-json.test.mjs` | 照らし役の検査。蒙恬の実記録（`tasks/2026-11-15-p5-c4-patch/trial/`）で「期待どおり」、壊した記録で食い違い | 12 |
| `tests/c4-check-worktree.mjs` | 照らし役。当てた後の木を照らす（入口の6） | — |
| `tests/c4-worktree.test.mjs` | 照らし役の検査。本家 1.146.0 に前の単位と C-4 の `removeLines`・`edits.patch` を順に当てた木（組 a・b）を一時のフォルダに作り、期待どおり・壊した木を照らす | 26 |
| `tests/removals/c4-gate-script.md` | 大岡越前守の台本（入口の1〜4・6・8・9） | — |
| `tasks/2026-11-15-p5-c4-tests/run-all-result.txt` | `run-all --save` の結果（PowerShell のテスト込み） | — |

## 要点

1. **`after` の確かめ（入口の2）を静的に見られる**: `planUnits` を直接呼び、`A-4`・`B-4`・`C-1`・`C-2` のどれを `--only` から外しても `C-4-notebook: after の単位 X が先に当たらない` が出る、4つ揃えば通る、C-3 は無くても・あっても通る、を確かめた。実走は台本の1c（`c4-check-json.mjs --stopped <checks.json> <外した単位>`）。
2. **何もしない実装（入口の7）**: 文字列と構文のほか、型を外した本文を node で走らせる（C-2 と同じ）。`workspace.notebookDocuments` が `[]`、`window.visibleNotebookEditors` が `[]`、`activeNotebookEditor` が `undefined`、イベント9つが `Event.None`、`registerNotebookSerializer`・`registerNotebookCellStatusBarItemProvider` が Disposable、`openNotebookDocument`・`showNotebookDocument` が reject、`createNotebookController` の `id`・`notebookType`・`label`（空なら拡張の識別子）、`createNotebookCellExecution` が誤りを投げる、`createRendererMessaging().postMessage` が `false`、提案中の API の門（`notebookKernelSource` 2・`notebookMessaging` 2・`notebookExecution`・`notebookVariableProvider`）が残り、提案を有効にした拡張では通ること。消した `vscode.window`・`workspace`・`notebooks` のメンバー20個は、`edits.patch` が**消す**塊から読んで、新しい実装と突き合わせた。
3. **検索の直し（やること3）**: 静的に確かめられる範囲で次を確かめた。
   - 検索・検索エディタ・一括編集のコードに**足す**行に、ノートブックの部品の参照（`@INotebook`・`notebook/browser`・`NotebookEditor`）が無い（許すのはコメント、`_notebookFilters` の定数1行、`notebook/common` の import、`Notebooks are not available` の誤り）。
   - **消す**行に、テキスト検索の呼び出し（`textSearchSplitSyncAsync`・`searchService.textSearch`）、`ReplacePattern`、`createMatches`、`addContext`、`bulkEditorService.apply`、`createEdit(match, match.replaceString, resource)` が無い（インデントを替えて足し直す行は除く）。検索の本体の import（検索サービス・置換・一致のモデル・一括編集・検索エディタの入力）も消していない。
   - `FileMatchImpl.createMatches` に足すのは `this.addContext(this.rawMatch.results);` の1行だけ。**本家の消す部品 `NotebookCompatibleFileMatch` が同じ行を呼んでいる**こと、`FileMatchImpl` に `addContext` があり constructor が `searchInstanceID` を取らないこと（`folderMatch.ts` が引数を外す根拠）を、本家のファイルで確かめた。
   - ファイルごと: `searchModel.ts`（`textSearchSplitSyncAsync` の呼び出しは文脈に残り、結果は閉じたエディタの分だけ）、`folderMatch.ts`（2か所を `FileMatchImpl` に、`searchInstanceID` を外す）、`replaceService.ts`（テキストの保存と編集が残る）、`searchView.ts`（置換のプレビュー・開く処理が残る）、`searchWidget.ts`（`getNotebookFilters()` は残り、定数は `markupInput`・`markupPreview`・`codeInput`・`codeOutput` がすべて真・`onDidChange` は `Event.None`）、`searchEditorSerialization.ts`（セルの一致の書き出しだけを外す）、検索のテスト（`FileMatchImpl` で一致を作る）。
   - **検索のハンクを本家のファイルに実際に当てた**: 検索・検索エディタ・一括編集のファイルに `edits.patch` を当て、ノートブックの部品の import・注入が残らず、`createMatches` の中に `addContext` の足し込みがちょうど1つ、`replaceService.ts` に `bulkEditorService.apply` とテキストの保存が残ることを確かめた（本家のまま当たらないファイルは飛ばす。当たったファイルが10未満なら失敗）。
4. **前の単位との独立**: `extHost.protocol.ts` の `edits.patch` のハンクに `createProxyIdentifier` の行が無く、ID の13行は `removeLines`（Shape を `edits.patch` が消す14個に対応）。`removeLines` と `edits.patch` が同じ行を二重に消さず、C-3 の `viewsExtensionPoint.ts` に触れず、`after` に挙げない単位（C-3 ほか）の `edits.patch`・`removeLines` と文脈が重ならない。`delete` が他の単位の `delete` と重なるのは `after` の単位とだけ（C-2 が先に消す `notebook/browser` の一部、B-4 が先に消す `outline`）。
5. **当てた後の木の照らし役は、前の単位から順に当てた木で「期待どおり」を確かめた**: 本家の `extHost.api.impl.ts`・`extHost.protocol.ts` などに、A・B・C-1・C-2（組 b は C-3 も）の `removeLines` と `edits.patch`、続けて C-4 のものを order の順に自前で当てた。**全ハンクが衝突なく当たる**（`edits.patch` が C-1・C-2 の出力の上に文脈だけで当たる証拠。`git apply --check` の代わり）。

## 実行結果

- C-4 の4ファイル: 152 tests（52 + 62 + 12 + 26）、全部通った。
- `node tests/run-all.mjs --save tasks/2026-11-15-p5-c4-tests/run-all-result.txt`: **2098 tests、pass 2091、fail 0、skip 7**（skip の7は `removals.test.mjs` の既存分。PowerShell のテスト 240 件込み）。
- 作る途中で落ちたものは、すべて**テストの誤り**で、その場で直した（実装の不具合は見つかっていない）。
  - `extHost.api.impl.ts` で消す行を「ノートブックの語を含む行」と見たため、塊の中の `uri = uriOrType;` のような行が引っかかった（連なりごとに見る形にした）。
  - 消すメンバーの数え方が、名前に `otebook` を含まない `createRendererMessaging`・`registerKernelSourceActionProvider` を落としていた。
  - 検索の「消す行」の見張りが、`else` の枝をほどいてインデントだけ替えた行（`edits.push(this.createEdit(...))`）や、未使用になった `nls` の import を消す行に当たった（足し直す行は除き、守る import を検索の本体のものに絞った）。
  - `on*` のメンバーを数えるとき、コントローラーの 2 つを入れていなかった。

## 大岡越前守向けの台本の入口

`tests/removals/c4-gate-script.md`。

- 1a・1b: 当て直し a（17単位）・b（18単位。C-1、C-2、C-3、C-4 の順）と `node tests/c4-check-json.mjs <checks.json>`（期待の表は a・b 並べた）
- 1c: 前提の単位（`C-2-debug`・`C-1-ai`・`B-4-outline-view`・`A-4-notebook-extensions`）を外すと止まること（入口の2）と `--stopped`
- 1d: `node tests/c4-check-worktree.mjs C:/b/wt/p2`（入口の6）
- 1e: ロックファイル
- 1f: C-4 の ops の commit での `git apply --check`（入口の4。**曹参の許可に `git -C` と `git checkout` が無く、走らせていない**。静的な代わりは、前から順に当てた木の検査と、他の単位と文脈が重ならない検査）
- 2: 型検査（a・b それぞれの上）
- 4: 走らせる形（入口の8の検索の単体テスト、`createRemovedNotebookApi`、`BulkCellEdits.apply()`）。作業ツリーで走らせるのは蒙恬か大岡越前守
- 5: 関門の起動の確かめ（入口の9。検索のビュー・置換・検索エディタ・`.ipynb` がテキストの一致、`UNKNOWN service`、Claude Code のパネル、拡張ホストのログ）

## 仕様と実装についての指摘

1. **C-4 の `edits.patch` は C-1・C-2 の出力の上でないと当たらない箇所がある**: `extHost.api.impl.ts` などは、本家のままの木には当たらない（C-4 の `after` が C-1・C-2 を挙げているので仕様どおり）。照らし役の木の検査は、前の単位から順に当てる形にした。単位を個別に無効にしたときの当たり方は、`after` に頼る。
2. **検索の `.ipynb` はテキストの一致になる**（README の「検索への影響」のとおり）。静的には、`FileMatchImpl` に context の足し込みが1行入り、前後の行（検索エディタの context）が前と同じに出る根拠は確かめた。実際に出るかは、台本の5（起動後）で見る。
3. docs/03 の5.3 の言い方（「`extHost.api.impl.ts` への変更は、その単位の名前空間の行だけ」）は、蒙恬の引き継ぎの「docs/ との食い違い」にあるとおり、C-4 の `window`・`workspace` のノートブックの項目の展開を含む。テストは「消す行はすべてノートブックまたは対話ウィンドウの塊」「足す行は import・`languages.match`・`createRemovedNotebookApi` の呼び出しと展開」という形で見ている。5.3 の文言を直すかはリーダーの判断。
4. 判断済みのもの（`docs/user-decisions.md` の 2026-11-15）はそのままテストに入れた: `searchWidget.getNotebookFilters()` は既定値の定数で残す、設定 `search.experimental.closedNotebookRichContentResults` の登録を消す、`mainThreadNotebookDto.ts`・`notebookSearch.ts`・`cellSearchModel.ts` を `delete` に移す、`extHost.protocol.ts` のノートブックの DTO は残す、`BulkCellEdits.apply()` はセルの編集で reject する。

## 仕様から想定した入口

実装（蒙恬の `edits.patch`、`unit.json`、実記録）が先にあったので、想定の入口は無い。壊し方の文字列の置き換えは `edits.patch` の文言に依存する（パッチを書き直したら「置き換えが当たらない」で落ちる。落ちたら置き換えを直す）。

## 未解決の点

- 検索の単体テスト（`searchModel.test.ts` ほか4つ）の実行、本物の VS Code での起動（DI の外し損ね、検索のビュー、`.ipynb` の一致、拡張ホストのログ）は、台本の4・5（大岡越前守、片づけの後）。
- 当て直し a・b・「前提を外す」の再実行、`git apply --check`、型検査は、`C:\b\wt\p2` に書き込むため走らせていない。

## 2回目（2026-11-15、大岡越前守の検証を受けた直し）

根拠: `tasks/2026-11-15-p5-c2-c4-verify/verification-ooka.md` の「直す点」の1（曹参の部分）と、軽微な指摘の1・2。`C:\b\wt\p2` には触れていない。

### 何が見逃されたか

1回目の `c4-unit.test.mjs` は、提案中の API の門の期待を**手で6つ並べていた**（実装の一覧から写した形）。そのため、本家の `extHostNotebookKernels.ts` にある7つ目の門（`updateNotebookAffinity` の `notebookControllerAffinityHidden`）の抜けを通した。`updateNotebookAffinity` を「空」と期待する行も、実装に合わせた期待だった。

### 直したこと

1. **門の検査を、本家から読む形にした**（`c4-unit.test.mjs`）
   - 期待の門 = 本家のタグの、C-4 が消す `api/common/extHost*.ts`（`delete` から拾う）の `checkProposedApiEnabled(extension, '<名前>')` と、`edits.patch` が `extHost.api.impl.ts` から消す塊の同じ呼び出し。実装の門と**過不足なく**一致することを確かめる（抜けも増えも落ちる）。
   - `updateNotebookAffinity` は、本家の形（`priority === NotebookControllerAffinity2.Hidden` のときだけ `notebookControllerAffinityHidden`）を本家のファイルで確かめた上で、実装にも条件つきの門があることを見る。
   - 「各メンバーの最初の文に門がある」の個別の確かめ（5つ）は別のテストに分け、期待の門の一覧は本家から読む方に任せた。
   - `updateNotebookAffinity` は「空」の期待をやめた（存在だけを見る。中身は門を含むので、上の検査が見る）。
2. **走らせる検査を足した**: 提案を有効にしていない拡張で `updateNotebookAffinity({}, -1)` が `CANNOT use API proposal: notebookControllerAffinityHidden` を投げ、`1`・`2` では投げない。提案を有効にした拡張では `-1` でも投げない。`Hidden` の値は本家 `extHostTypes.ts` の `NotebookControllerAffinity2` から読む（読めなければ -1）。
3. **壊し方を足した**（`c4-mutation.test.mjs`）: 門（`notebookControllerAffinityHidden`）を外す、門の条件（`if (affinity === ...Hidden)`）を外して常に門をかける。どちらも本家を読む検査が落とす。
4. **蒙恬の直しに合わせた**: 蒙恬が実装を直した（`updateNotebookAffinity` に門、`./extHostTypes.js` から `NotebookControllerAffinity2` を import、`createNotebookController` が `isProposedApiEnabled` で `rendererScripts` を通す）。import の一覧の検査は `./extHostTypes.js`（`NotebookControllerAffinity2` だけ）を許し、走らせる検査の模擬に `isProposedApiEnabled` と `NotebookControllerAffinity2` を足した。実装より先に書いた分は、書いた時点では落ちる状態だった（直しの後に通ることを確かめた）。
5. **照らし役（軽微な指摘の1）**: `c1-check-worktree.mjs`・`c2-check-worktree.mjs` は、新しいファイル `extHostRemovedApi.notebook.ts` がある木（= C-4 が当たった木）では、C-4 の `delete` の中のパスを見ない。C-4 の組 b の木で C-1〜C-4 を1回ずつ照らせる。C-4 が当たっていない木では、同じファイルが無いのは今までどおり食い違い。テストを `c1-round2.test.mjs`（`c1-check-worktree` の節）と `c2-worktree.test.mjs` に足した。
6. **軽微な指摘の2**: `c2-check-json.test.mjs` のコマンドのテストの名前を、中身（今の `unit.json` と合う記録は 0、古い記録は 1 と「検査の記録が無いもの」、壊した引数は 2、別の組の型検査は 1）に合わせた。

### 同じ見逃しが C-1・C-2・C-5 にも無いか（見つけた形）

| 単位 | 門の検査の元 | 結果 |
|---|---|---|
| C-2 | 1回目から `debugVisualization` の2つを手で書いていた（`count == 2`） | 本家の消す側（`extHostDebugService.ts` は門なし、`extHost.api.impl.ts` の消す塊に2つ）から読む形に直した。**抜けは無かった**（過不足なく一致） |
| C-5 | 何もしないギャラリーは提案中の API の門を持たない（本家の消すファイルに `checkProposedApiEnabled` が無い）。メンバーの期待は本家の interface から読んでいる | 同じ見逃しは無い |
| C-3 | 何もしない実装が無い | 対象外 |
| **C-1** | 門の期待を `calls.length >= 30` と11個の名前の手書きで見ていた | 本家の消す側から読む形を足した。**1件の抜けを見つけた** |

**C-1 の抜け（蒙恬へ。実装が直るまで、下の2本が落ちる）**

- `lm.registerToolDefinition`（`extHostRemovedApi.ai.ts`）が門を持たない。本家は `extHostLanguageModelTools.ts` の `registerToolDefinition` の最初で `checkProposedApiEnabled(extension, 'languageModelToolSupportsModel')`。提案を有効にしていない拡張が呼んでも、前は誤りを投げ、今は黙って通る（C-4 の `updateNotebookAffinity` と同じ種類）。
- 本家にあっても、何もしない実装からは呼べない所の門は期待から外した（`languageModelSystem` = 本物のモデルへ送るときのメッセージ変換で、`selectChatModels` が `[]` なので送る口が無い、`mcpToolDefinitions` = プロバイダーが返した定義の検証で、何もしない実装はプロバイダーを呼ばない）。
- 落ちるのは `tests/c1-unit.test.mjs` の「提案中の API の門が、本家の消すファイルと edits.patch が消す塊の門を、すべて含む」と、その結果として `tests/c1-mutation.test.mjs` の「壊さない写しは全部通る（対照）」。**この2本は、実装の不具合を正しく見つけた状態で、テストの誤りではない**。直す形の例: `registerToolDefinition` の最初の文に `checkProposedApiEnabled(extension, 'languageModelToolSupportsModel');` を足す（README の門の一覧にも足す）。直せば両方通る。

### 件数・実行結果

- C-4 の4ファイル: 156 tests（`c4-unit` 54、`c4-mutation` 64、`c4-check-json` 12、`c4-worktree` 26）、全部通った。
- `c1-round2` 14（1つ足した）、`c2-worktree` 23（1つ足した）、`c2-unit` 57（1つ足した）、`c1-unit` 38（1つ足した。**1つが C-1 の実装の抜けで落ちる**）。
- `node tests/run-all.mjs --save tasks/2026-11-15-p5-c4-tests/run-all-result-r2.txt`（C-5 のテストも含む）: **2255 tests、pass 2246、fail 2、skip 7**。落ちた2本は上の C-1 の実装の抜け（`c1-unit` の門の検査と、その結果の `c1-mutation` の対照）だけで、C-2〜C-5 は fail 0。C-1 の `edits.patch` が直れば fail 0 に戻る。

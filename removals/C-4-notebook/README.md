# C-4-notebook ノートブック・対話ウィンドウ・REPL

裁定（2026-11-12）: 削る候補に Jupyter ノートブック。裁定（同日）: 拡張 API の入口（`vscode.notebooks` など）は何もしない実装にして残し、中身のコードは消す。

> 状態: 下準備（2026-11-14）。`unit.json` の ops だけを作った。`edits.patch` は型検査を走らせられるようになってから作り、そのときに `unit.json` に `"patch": "edits.patch"` を足す。

## 消すもの

- `src/vs/workbench/contrib/notebook/browser`: ノートブックのエディタ（セルの一覧・セルのエディタ・出力の Webview の描画・差分・カーネルの選択・変数のビュー・ノートブックのアウトライン・検索の置換の UI）、拡張の宣言 `notebooks`・`notebookRenderer` の受け手、`notebook.*` の設定とコマンド。`contrib/notebook/test` も消す。
- `src/vs/workbench/contrib/interactive`: 対話ウィンドウ（Interactive Window）。
- `src/vs/workbench/contrib/replNotebook`: ノートブックの形の REPL。
- `src/vs/workbench/contrib/outline`: B-4 が「ノートブックのアウトラインが import しているので C-4 まで残す」と残した `outline.ts`（ビューの ID の定数だけ）。ノートブックのアウトラインと一緒に消す（B-4 が有効なら残りはこのファイルだけ。`after` に B-4 を挙げた）。
- `src/vs/workbench/contrib/search/browser/notebookSearch`: 検索のうち、開いているノートブックのエディタの中を探す部品（`NotebookEditorWidget` と検索の装飾を使う）。
- 拡張 API の main thread 側: `mainThreadNotebook.ts`・`mainThreadNotebookDocuments.ts`・`mainThreadNotebookDocumentsAndEditors.ts`・`mainThreadNotebookEditors.ts`・`mainThreadNotebookKernels.ts`・`mainThreadNotebookRenderers.ts`・`mainThreadNotebookSaveParticipant.ts`・`mainThreadInteractive.ts`。拡張ホスト側: `extHostNotebook*.ts`（8つ）・`extHostInteractive.ts`。対応するテスト7つ。
- import の行（`removeLines`）: `workbench.common.main.ts` 3行、`api/browser/extensionHost.contribution.ts` の main thread の一覧 6行。`sessions.common.main.ts` の3行は直さない（C-1 が `src/vs/sessions` を消す。下の「前提の単位」）。

## 前提の単位

- `after`: `A-4-notebook-extensions`、`B-4-outline-view`、`C-1-ai`、`C-2-debug`。
- `C-1-ai`: `src/vs/sessions` を消す（sessions の入口の行をこの単位で直さない）。チャット・インラインチャットのノートブックの部品（約40ファイル）も消える。
- `C-2-debug`: `contrib/debug/browser/debug.contribution.ts`（ノートブックの変数のコマンドを import）を消す。C-2 は `notebook/browser/notebook.contribution.ts` の4行を `removeLines` で消すので、C-4（`notebook/browser` を消す）より先に当たる必要もある（order 320 < 340）。
- `B-4-outline-view`: B-4 が残した `contrib/outline/browser/outline.ts` をこの単位で消す。

## 残すもの

- `src/vs/workbench/contrib/notebook/common`: ノートブックの型とモデル。拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`・`extHostTypes/workspaceEdit.ts`・`extHostApiCommands.ts`）、一括編集、検索の置換、コメント（`contrib/comments`。Claude Code の受け手）、言語の判定、エディタの入力の復元が import している。`browser` への import は無い（`grep` で確かめた）。動いて何かをする部品の登録は `browser` 側にあるので、残しても型とモデルのコードとして読み込まれるだけ。
- `src/vs/workbench/services/notebook`: `INotebookDocumentService`（セルの URI の解釈）。`workbench/browser/labels.ts` が注入している。
- `src/vs/workbench/api/browser/mainThreadNotebookDto.ts`: common の型だけを使う変換。チャットの main thread（C-1）も使うので、単位を独立に保つために残した。C-1 を `after` に挙げたので、型検査で使い手が無いと分かれば `delete` に足してよい。
- `src/vs/workbench/api/common/extHostTypes/notebooks.ts`: `vscode.NotebookCellData` などの公開のクラス。
- `src/vs/workbench/contrib/search/common/notebookSearch.ts`・`searchNotebookHelpers.ts`: 検索のサービスが使う型と ID。
- docs/03 の表は `contrib/notebook` を丸ごと消す側に挙げているが、common を消すと拡張 API の中心を書き換えることになるので、`browser` だけを消した（docs との食い違い。下の別案）。

## 拡張 API の空の実装（edits.patch の見込み）

新しいファイル `src/vs/workbench/api/common/extHostRemovedApi.notebook.ts`（docs/03 の5.3）に置き、`extHost.api.impl.ts` はノートブックの行だけを直す。

- `vscode.notebooks`: `createNotebookController`（ダミーのコントローラーを返す。`dispose`・`onDidChangeSelectedNotebooks`＝`Event.None`、`createNotebookCellExecution` は誤りを投げる）、`registerNotebookCellStatusBarItemProvider`・`registerKernelSourceActionProvider`（何もしない `Disposable`）、`createRendererMessaging`（`onDidReceiveMessage`＝`Event.None`、`postMessage` は `false`）、`createNotebookControllerDetectionTask`（`dispose` だけ）。
- `vscode.workspace`: `notebookDocuments`＝`[]`、`onDidOpenNotebookDocument`・`onDidCloseNotebookDocument`・`onDidChangeNotebookDocument`・`onDidSaveNotebookDocument`・`onWillSaveNotebookDocument`＝`Event.None`、`registerNotebookSerializer`＝何もしない `Disposable`、`openNotebookDocument` は「ノートブックは使えない」で reject。
- `vscode.window`: `activeNotebookEditor`＝`undefined`、`visibleNotebookEditors`＝`[]`、`onDidChangeActiveNotebookEditor`・`onDidChangeVisibleNotebookEditors`・`onDidChangeNotebookEditorSelection`・`onDidChangeNotebookEditorVisibleRanges`＝`Event.None`、`showNotebookDocument` は reject。
- 言語の `match`（`extHost.api.impl.ts` の678行。セルの文書からノートブックを探す）は `undefined` にする。
- 同梱の拡張のうち、言語クライアントを使うもの（basedpyright・PowerShell）と TypeScript の拡張は、起動時にノートブックのイベントと一覧を購読する見込み（推定）。誤りを投げずに空を返すことが要る。

## 型検査で直す点（edits.patch の見込み）

1.146.0 の作業ツリーで `grep` した結果。行は 1.146.0 のもの。AI（`contrib/chat`・`contrib/inlineChat`）は C-1 で消える前提で除いた（C-1 より前に当てるなら、そちらにも同じ形の直しが要る）。

| ファイル | 行 | 中身 | 直し方の見込み |
|---|---|---|---|
| `src/vs/workbench/api/common/extHost.api.impl.ts` | 72・83〜88（import）、225〜230・259（作成）、678、1041〜1059、1346〜1376、1674〜1688 | 拡張ホスト側のノートブックの部品を作り、名前空間に出す | 上の「空の実装」に置き換える |
| `src/vs/workbench/api/browser/mainThreadEditorTabs.ts` | 22（使う所は `InteractiveEditorInput` の判定） | 対話ウィンドウのタブの種類を見分ける | 対話ウィンドウの分岐を消す。`NotebookEditorInput`（common）の分岐は残る |
| `src/vs/workbench/contrib/bulkEdit/browser/bulkCellEdits.ts` | 15〜17・56 | ノートブックのエディタ（browser）と `INotebookEditorModelResolverService` を使ってセルを編集する | `ResourceNotebookCellEdit`（データのクラス。mainThreadBulkEdits・conflicts が使う）は残し、`BulkCellEdits` の適用は「ノートブックは使えない」で止める形にする。注入をやめる |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/folderMatch.ts` | 21〜25、333〜345、368〜375、401〜412、490、554 | 一致したファイルを `NotebookCompatibleFileMatch`（消すフォルダのクラス）で作り、開いたノートブックのエディタと結びつける | `FileMatchImpl`（`fileMatch.ts`）で作る。ノートブックの結びつけと分岐を消す |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/fileMatch.ts` | 19・63 | ノートブックの検索の装飾 `FindMatchDecorationModel` を持つ | フィールドと import を消す |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/searchResult.ts` | 13・14・38・51・52・158〜197 | `INotebookEditorService` を注入し、ノートブックのエディタの出入りを見る | 注入と監視を消す（**注入は型検査に掛からない**。残すと起動時に検索のビューが作れない） |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/searchTreeCommon.ts` | 14・206〜208 | インターフェイスの `bind/unbindNotebookEditorWidget` | メソッドを消す |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts` | 18・60 | `INotebookSearchService` を注入し、ノートブックを先に探す | ノートブックの検索をやめ、テキストの検索だけにする（**注入**） |
| `src/vs/workbench/contrib/search/browser/searchTreeModel/textSearchHeading.ts` | 19・231 | `isNotebookFileMatch` | 分岐を消す |
| `src/vs/workbench/contrib/search/browser/searchView.ts` | 58・76・84・237・2285 | `NotebookEditor`・`INotebookService`（**注入**）、ノートブックの一致の扱い | 注入と分岐を消す |
| `src/vs/workbench/contrib/search/browser/searchWidget.ts` | 39・42・47 | ノートブックの検索の絞り込み（`NotebookFindFilters`）とボタン | 絞り込みのボタンと設定を消す |
| `src/vs/workbench/contrib/search/browser/searchFindInput.ts` | 12・13 | `NotebookFindInputFilterButton` | 同上 |
| `src/vs/workbench/contrib/search/browser/replaceService.ts` | 30〜33・109 | ノートブックのセルの置換（`INotebookEditorModelResolverService` を**注入**） | セルの置換の分岐と注入を消す |
| `src/vs/workbench/contrib/search/browser/searchActionsRemoveReplace.ts`・`searchCompare.ts` | 26・6 | `MatchInNotebook`・`isIMatchInNotebook` | 分岐を消す |
| `src/vs/workbench/contrib/search/browser/search.common.contribution.ts` | 14（呼ぶ所も） | `notebookSearchContributions()` で `INotebookSearchService` を登録 | 呼び出しと import を消す（`searchModel.ts` の注入を消すので登録は要らない） |
| `src/vs/workbench/contrib/search/browser/AISearch/aiSearchModel.ts` | 17・294・297 | `NotebookEditorWidget` | 2026-11-14 時点の C-1 の `unit.json` は `AISearch` を消さない（C-1 の ops の後の試しでも残った）。上のインターフェイスに合わせて `bind/unbindNotebookEditorWidget` を消す |
| `src/vs/workbench/contrib/searchEditor/browser/searchEditorSerialization.ts` | 18 | `ICellMatch`・`isNotebookFileMatch` | ノートブックの分岐を消す |
| `src/vs/workbench/contrib/debug/browser/debug.contribution.ts` | 29 | ノートブックの変数のコマンドの ID | C-2 が消す（`after` に挙げた）。直さない |
| テスト: `contrib/search/test/browser/searchViewlet.test.ts`（22・26・27）・`searchTestCommon.ts`（18・19）・`searchResult.test.ts`（27・30・31・34・39・40）・`searchModel.test.ts`（28・31・33・35・44）・`searchActions.test.ts`（19・24・25）、`contrib/bulkEdit/test/browser/bulkCellEdits.test.ts` | — | `INotebookEditorService`・`NotebookEditorWidgetService`・`NotebookCompatibleFileMatch` などを使う | テストの注入の行と、ノートブックの一致を作る部分を消す。ノートブック専用のテストは `delete` に足す |
| C-1 の範囲: `contrib/chat`（chatEditing/notebook など約40ファイル）、`contrib/inlineChat`（inlineChatNotebook.ts など）、`src/vs/sessions` のテスト | — | ノートブックの browser を import | C-1 で消える（`after` に挙げた。C-1 の ops の後の試しで消えたことを確かめた） |

- **型検査に掛からない点**（起動時に注入で失敗する）: 上の表で「注入」と書いた5か所（`searchResult.ts`・`searchModel.ts`・`searchView.ts`・`replaceService.ts`・`bulkCellEdits.ts`）。`INotebookService`・`INotebookEditorService`・`INotebookEditorModelResolverService`・`INotebookSearchService` の登録は消えるので、残る部品が注入していないことを `grep '@INotebook'` で確かめる。
- lint の一覧（`eslint.config.js` の422・434〜438・810〜838・2632〜2652行、`.eslint-allowed-bracket-notation-files` の405〜409行）に消したファイルの名前が残る（関門の外）。
- `build/next/index.ts` の90行がワーカーの入口 `contrib/notebook/common/services/notebookWebWorkerMain` を挙げる。common を残すのでそのまま。

## 影響しうるもの

- 全文検索（裁定で残す）: docs/03 の表が恐れていたとおり、検索の木のモデルがノートブックの部品と結びついている（上の表）。直したあと、検索・置換・検索エディタが動くことをスモークで確かめる。
- `.ipynb` を開くと、ノートブックのエディタが無いのでテキスト（JSON）として開く見込み。
- 拡張の宣言 `notebooks`・`notebookRenderer`（例: `markdown-language-features` が `notebookRenderer` を持つ）は受け手が無くなる。拡張ホストのログに警告が出るかをスモークで見る。
- コメント（`contrib/comments`）は `notebookRange.ts`（common）の型だけを使うので影響しない見込み。

## 壊れたときの症状と戻し方

- 検索のビューが開かない、または検索で誤りが出る: 上の「注入」の直しが漏れている。`enabled: false` に戻す。
- 拡張の起動時に `vscode.notebooks` などで誤りが出る: 空の実装に足りない項目がある。拡張ホストのログから名前を特定して足す。

## 別案（リーダーの判断を仰ぐ）

1. docs/03 の表どおり `contrib/notebook` を丸ごと消す。`common` の型を拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`）から外すことになり、本家の変更と衝突しやすい大きなパッチになる。
2. 検索のノートブックの部品（`notebookSearch/`）を残し、そこから `notebook/browser` への参照だけを切る。検索の木のモデルへのパッチは小さくなるが、残したフォルダの中の書き換えが大きくなる。今の案（フォルダを消し、`FileMatchImpl` で作る）を推す。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。とくに `extHost.protocol.ts` の `MainThreadNotebook*Shape`・`ExtHostNotebook*Shape` は残るので、`ExtHostContext`・`MainContext` の ID に実装が無い状態になる（RPC は使われないので問題ない見込み）。
- `notebookCommon.ts` などの common が、消した browser 側の副作用（登録）に頼っていないか。
- 拡張ホストで `vscode.workspace.notebookDocuments` などを呼ぶ拡張（TypeScript・basedpyright・PowerShell）が誤りを出さないか（スモーク）。

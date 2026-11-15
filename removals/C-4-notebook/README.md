# C-4-notebook ノートブック・対話ウィンドウ・REPL

裁定（2026-11-12）: 削る候補に Jupyter ノートブック。裁定（同日）: 拡張 API の入口（`vscode.notebooks` など）は何もしない実装にして残し、中身のコードは消す。全文検索は裁定で残す。

> 状態: edits.patch あり、関門の前（2026-11-15）。`enabled` は `false` のまま。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 消すもの

- `src/vs/workbench/contrib/notebook/browser`: ノートブックのエディタ（セルの一覧・セルのエディタ・出力の Webview の描画・差分・カーネルの選択・変数のビュー・ノートブックのアウトライン・検索の置換の UI）、拡張の宣言 `notebooks`・`notebookRenderer`・`notebookPreload` の受け手（`notebookExtensionPoint.ts`）、`notebook.*` の設定とコマンド。`contrib/notebook/test` も消す。
- `src/vs/workbench/contrib/interactive`: 対話ウィンドウ（Interactive Window）。
- `src/vs/workbench/contrib/replNotebook`: ノートブックの形の REPL。
- `src/vs/workbench/contrib/outline`: B-4 が「ノートブックのアウトラインが import しているので C-4 まで残す」と残した `outline.ts`（ビューの ID の定数だけ）。
- `src/vs/workbench/contrib/search/browser/notebookSearch`: 検索のうち、ノートブックのセルと出力の中を探す部品（`NotebookCompatibleFileMatch`・`CellMatch`・`MatchInNotebook`・`NotebookSearchService`）。
- 検索の common のうち、ノートブックの検索だけが使っていたもの（2026-11-15 に足した）: `contrib/search/common/notebookSearch.ts`（`INotebookSearchService` の ID）、`contrib/search/common/cellSearchModel.ts`。
- 拡張 API の main thread 側: `mainThreadNotebook.ts`・`mainThreadNotebookDocuments.ts`・`mainThreadNotebookDocumentsAndEditors.ts`・`mainThreadNotebookEditors.ts`・`mainThreadNotebookKernels.ts`・`mainThreadNotebookRenderers.ts`・`mainThreadNotebookSaveParticipant.ts`・`mainThreadInteractive.ts`、`mainThreadNotebookDto.ts`（2026-11-15 に足した。下の「edits.patch で直した点」）。拡張ホスト側: `extHostNotebook*.ts`（8つ）・`extHostInteractive.ts`。
- テスト: 拡張 API のノートブックのテスト7つ、`contrib/search/test/browser/searchNotebookHelpers.test.ts`、`contrib/bulkEdit/test/browser/bulkCellEdits.test.ts`（2026-11-15 に足した。ノートブックのセルの編集だけを試すテスト）。
- import の行と一覧の要素（`removeLines`、22行）
  - `workbench.common.main.ts` 3行
  - `api/browser/extensionHost.contribution.ts` の main thread の一覧 6行
  - `api/common/extHost.protocol.ts` の `MainContext` の ID 6行と `ExtHostContext` の ID 7行（2026-11-15 に足した。2026-11-14 の判断「消した API の Shape と ID を消す」。C-2 と同じく一覧の1要素なのでパッチに入れない）
  - `sessions.common.main.ts` の3行は直さない（C-1 が `src/vs/sessions` を消す。下の「前提の単位」）
- 設定: `search.experimental.closedNotebookRichContentResults`（読み手は消したノートブックの検索だけ。2026-11-15 に足した）。

## 前提の単位

- `after`: `A-4-notebook-extensions`、`B-4-outline-view`、`C-1-ai`、`C-2-debug`。
- `C-1-ai`: `src/vs/sessions` を消す（sessions の入口の行をこの単位で直さない）。チャット・インラインチャットのノートブックの部品（約40ファイル）も消える。C-1 の edits.patch は、この単位も直す `extHost.api.impl.ts`・`extHost.protocol.ts`・`mainThreadEditorTabs.ts`・`searchView.ts`・`searchResult.ts`・`searchCompare.ts`・`searchActionsRemoveReplace.ts`・`search.contribution.ts` を先に直す。この単位の edits.patch は C-1 の後の木の上で作った。
- `C-2-debug`: `contrib/debug/browser/debug.contribution.ts`（ノートブックの変数のコマンドを import）を消す。C-2 は `notebook/browser/notebook.contribution.ts` の行を `removeLines` で消すので、C-4（`notebook/browser` を消す）より先に当たる必要もある（order 320 < 340）。C-2 の edits.patch も `extHost.api.impl.ts`・`extHost.protocol.ts` を直す。
- `B-4-outline-view`: B-4 が残した `contrib/outline/browser/outline.ts` をこの単位で消す。
- `C-3-remote` は前提にしない。C-3 の edits.patch が触る `viewsExtensionPoint.ts` に、この単位は触れない（C-3 の有無で当て方が変わらない。下の「確かめたこと」）。

## 残すもの

- `src/vs/workbench/contrib/notebook/common`: ノートブックの型とモデル。拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`・`extHostTypes/workspaceEdit.ts`・`extHostApiCommands.ts`）、一括編集（`bulkCellEdits.ts` の `ResourceNotebookCellEdit`）、コメント（`contrib/comments`。Claude Code の受け手）、言語の判定、エディタのタブ（`mainThreadEditorTabs.ts` の `NotebookEditorInput` の判定）が import している。`browser` への import は無い（型検査で確かめた）。中のサービスの実装（`notebookEditorModelResolverServiceImpl.ts` など）は、登録が `browser` 側にあるので作られない。
- `src/vs/workbench/services/notebook`: `INotebookDocumentService`（セルの URI の解釈）。`workbench/browser/labels.ts` が注入している。
- `src/vs/workbench/api/common/extHostTypes/notebooks.ts`: `vscode.NotebookCellData` などの公開のクラス。
- `src/vs/workbench/contrib/search/common/searchNotebookHelpers.ts`: 残す `notebook/common/notebookService.ts` が型（`INotebookFileMatchNoModel`）を import している。
- `contrib/notebook/common/services/notebookWebWorkerMain.ts`: `build/next/index.ts` の90行がワーカーの入口として名前を挙げている。
- `extHost.protocol.ts` のノートブックの DTO（`NotebookCellDataDto`・`NotebookDataDto`・`INotebookKernelDto2`・`VariablesResult`・`ICellExecute*Dto`・`INotebookDocumentsAndEditorsDelta` など）: Shape を消すと使い手が無くなるものもあるが、`extHostTypeConverters.ts`（`NotebookDto`）と `extHostApiCommands.ts` が一部を使う。どれが使われなくなるかの切り分けは型検査に掛からない（export の型は未使用でも誤りにならない）ので、消さずに残した（判断を仰ぐ点。handoff-notes の「判断を仰ぐ点」）。
- docs/03 の表は `contrib/notebook` と `services/notebook` を丸ごと消す側に挙げているが、common を消すと拡張 API の中心を書き換えることになるので、`browser` だけを消した（docs/03 の4節の末尾に書いてある）。

## edits.patch で直した点（2026-11-15）

edits.patch は25ファイル（新規1）、211行の追加、907行の削除（2026-11-15 の2回目の後）。件名は `unit C-4-notebook: edits`、作者は `shuko-apply <apply@shuko.invalid>`。

### 拡張 API

| ファイル | 直し方 |
|---|---|
| `api/common/extHostRemovedApi.notebook.ts`（新規） | `createRemovedNotebookApi(extension)` が `{ notebooks, window, workspace }` を返す。何もしない実装（下の「拡張 API の振る舞い」） |
| `api/common/extHost.api.impl.ts` | import を `./extHostRemovedApi.notebook.js` の1行に替えた（`extHostNotebook*`・`extHostInteractive` の7行を消した）。拡張ホスト側のノートブックの部品を作る7行を消した。`window` の名前空間のノートブックの7つは `...removedNotebookApi.window`、`workspace` の8つは `...removedNotebookApi.workspace`、`notebooks` は `removedNotebookApi.notebooks` にした。`languages.match` はセルの文書からノートブックを探すのをやめ、`score(..., undefined, undefined)` にした（`targetsNotebooks` の import を外した） |
| `api/common/extHost.protocol.ts` | `MainThreadNotebook{,Editors,Documents,Kernels,Renderers}Shape`・`MainThreadInteractiveShape`・`ExtHostNotebook{,DocumentSaveParticipant,Renderers,DocumentsAndEditors,Documents,Editors,Kernels}Shape`・`ExtHostInteractiveShape` を消した。使われなくなった import（`NotebookPriorityInfo`・`IRawClosedNotebookFileMatch`）を外した。ID の13行は `removeLines` |
| `api/browser/mainThreadEditorTabs.ts` | 対話ウィンドウのタブ（`InteractiveEditorInput`）の分岐と import を消した。`NotebookEditorInput`（common）の分岐は残る |

### 一括編集

| ファイル | 直し方 |
|---|---|
| `contrib/bulkEdit/browser/bulkCellEdits.ts` | `ResourceNotebookCellEdit`（データのクラス。`bulkEditService.ts`・`mainThreadBulkEdits` が使う）は残した。`BulkCellEdits` は注入（`IEditorService`・`INotebookEditorModelResolverService`）をやめ、`apply()` は「Notebooks are not available in this build」で reject する。作る側（`bulkEditService.ts` の `createInstance(BulkCellEdits, ...)`）の引数は変えていない |

### 全文検索（裁定で残す）

ノートブックへの参照を外すだけにした。テキスト検索・ファイル検索・置換・検索エディタの流れは変えていない。

| ファイル | 直し方 |
|---|---|
| `searchTreeModel/folderMatch.ts` | 一致したファイルを `NotebookCompatibleFileMatch` でなく `FileMatchImpl` で作る（2か所）。ノートブックのエディタとの結びつけ（`bind/unbindNotebookEditorWidget`）とセルの一致を足す分岐を消した |
| `searchTreeModel/fileMatch.ts` | ノートブックの検索の装飾 `FindMatchDecorationModel` のフィールドと import、それを消す1行を外した。開いていないファイルの一致で前後の行（context）を足す1行を `createMatches` に足した（消した `NotebookCompatibleFileMatch` がしていたこと。検索エディタの前後の行が消えないように） |
| `searchTreeModel/searchResult.ts` | `INotebookEditorService` の注入、ノートブックのエディタの出入りの監視、使われなくなった `MutableDisposable` の2つのフィールドと import を消した（**注入**） |
| `searchTreeModel/searchModel.ts` | `INotebookSearchService` の注入をやめ、`textSearchSplitSyncAsync` をノートブックの除外の引数なしで呼ぶ。結果の合成からノートブックの分を外した（**注入**） |
| `searchTreeModel/searchTreeCommon.ts` | インターフェイスの `bind/unbindNotebookEditorWidget`（3行）と import を消した |
| `searchTreeModel/textSearchHeading.ts` | `isNotebookFileMatch` の分岐と import を消した |
| `searchView.ts` | `INotebookService` の注入（**注入**）、`shouldOpenInNotebookEditor`、`open()` のノートブックのエディタの分岐、使われなくなった `network` の import を消した |
| `searchWidget.ts` | ノートブックの検索の絞り込み（`NotebookFindFilters`）を、既定値（すべて真）のまま変わらない定数の値（`onDidChange` は `Event.None`）に替えた。`IEditorService` の注入と、ノートブックのエディタの出入りでボタンを出し入れする監視を消した。`getNotebookFilters()` は残した（検索のビューと検索エディタが読む。下の判断を仰ぐ点） |
| `searchFindInput.ts` | 絞り込みのボタン（`NotebookFindInputFilterButton`）を消した。入力欄の右の余白は基底の `FindInput` が計算する |
| `replaceService.ts` | セルの置換の分岐（`isIMatchInNotebook`）とセルを保存する分岐、`INotebookEditorModelResolverService` の注入を消した（**注入**） |
| `searchActionsRemoveReplace.ts`・`searchCompare.ts` | `MatchInNotebook`・`isIMatchInNotebook` の分岐と import、`compareNotebookPos` を消した |
| `search.common.contribution.ts` | `notebookSearchContributions()` の呼び出しと import を消した（`INotebookSearchService` の登録） |
| `search.contribution.ts` | 設定 `search.experimental.closedNotebookRichContentResults` の登録を消した |
| `searchEditor/browser/searchEditorSerialization.ts` | セルの一致を書き出す部分と import を消した |
| テスト5つ（`searchActions.test.ts`・`searchModel.test.ts`・`searchResult.test.ts`・`searchTestCommon.ts`・`searchViewlet.test.ts`） | `INotebookEditorService`・`INotebookSearchService`・`INotebookService` の差し替えの行を消した。ファイルの一致を `FileMatchImpl` で作る。ノートブック専用のテスト2つ（「Search can return notebook results」「Test that notebook matches get added correctly」）を消した |

### unit.json

- `"patch": "edits.patch"` を足した。
- `delete` に4つ足した: `contrib/search/common/notebookSearch.ts`・`contrib/search/common/cellSearchModel.ts`・`contrib/bulkEdit/test/browser/bulkCellEdits.test.ts`・`api/browser/mainThreadNotebookDto.ts`。
- `removeLines` に `extHost.protocol.ts` の ID の13行を足した。
- `kept` から2つ外して `delete` に移し、1つの理由を直した（`searchNotebookHelpers.ts`。前の理由の「services/search が使う」は、1.146.0 で `grep` すると当たらなかった）。
  - `mainThreadNotebookDto.ts`: 使い手のチャットの main thread は C-1 で消え、この単位で消す main thread のノートブックの部品のほかに使い手が無い。
  - `notebookSearch.ts`: 注入していた `searchModel.ts` を直したので使い手が無い。
- `checks.absentSettings` に `search.experimental.closedNotebookRichContentResults` を足した。
- `checks.absentStrings` に4つ足した: `INotebookSearchService`（`src/vs`）、`notebook/browser/`（`contrib/search` と `contrib/searchEditor`）、`MainThreadNotebookShape`・`ExtHostNotebookShape`（`extHost.protocol.ts`）。

## 拡張 API の振る舞い

| API | 振る舞い |
|---|---|
| `workspace.notebookDocuments` | `[]` |
| `workspace.onDidOpenNotebookDocument`・`onDidCloseNotebookDocument`・`onDidChangeNotebookDocument`・`onDidSaveNotebookDocument`・`onWillSaveNotebookDocument` | `Event.None` |
| `workspace.registerNotebookSerializer` | 何もしない Disposable |
| `workspace.openNotebookDocument` | 「Notebooks are not available in this build」で reject |
| `window.activeNotebookEditor` | `undefined` |
| `window.visibleNotebookEditors` | `[]` |
| `window.onDidChangeActiveNotebookEditor`・`onDidChangeVisibleNotebookEditors`・`onDidChangeNotebookEditorSelection`・`onDidChangeNotebookEditorVisibleRanges` | `Event.None` |
| `window.showNotebookDocument` | reject |
| `notebooks.createNotebookController` | 何もしないコントローラー。`id`・`notebookType`・`label` は渡した値、`onDidChangeSelectedNotebooks`・`onDidReceiveMessage` は `Event.None`、`executeHandler`・`interruptHandler` は読み書きできる、`updateNotebookAffinity`・`dispose` は何もしない、`createNotebookCellExecution` は誤りを投げる。`rendererScripts` は、本家と同じく提案 notebookMessaging が有効なときだけ渡した値を持つ（無効なら `[]`） |
| `notebooks.registerNotebookCellStatusBarItemProvider` | 何もしない Disposable |
| `notebooks.createRendererMessaging` | `onDidReceiveMessage` は `Event.None`、`postMessage` は `false` |
| `notebooks.createNotebookControllerDetectionTask`・`registerKernelSourceActionProvider` | 提案中（notebookKernelSource）の門を残し、何もしない Disposable |
| `languages.match` | セルの文書をノートブックに結びつけない（ノートブックの文書が無いので、本家と同じ値） |

提案中の API の門（`checkProposedApiEnabled`）は、本家と同じ条件で7つすべてを残した（2026-11-15 の2回目に、抜けていた1つを足した）。本家の出どころは、消す `extHostNotebookKernels.ts` の5つと、`extHost.api.impl.ts` の `notebooks` の名前空間の2つ。ほかの消す拡張ホストのファイル（`extHostNotebook.ts`・`extHostNotebookDocument(s).ts`・`extHostNotebookDocumentSaveParticipant.ts`・`extHostNotebookEditor(s).ts`・`extHostNotebookRenderers.ts`・`extHostInteractive.ts`）には門が無い（1.146.0 を `Grep` で確かめた）。

| 門（提案の名前） | 本家の場所（1.146.0） | 何もしない実装での条件 |
|---|---|---|
| `notebookVariableProvider` | `extHostNotebookKernels.ts` 237行 | コントローラーの `variableProvider` に書き込んだとき |
| `notebookExecution` | 同 258行 | `createNotebookExecution` を呼んだとき（門の後に誤りを投げる） |
| `notebookControllerAffinityHidden` | 同 281〜285行 | `updateNotebookAffinity` に `NotebookControllerAffinity2.Hidden`（-1）を渡したときだけ |
| `notebookMessaging` | 同 291行 | コントローラーの `postMessage` |
| `notebookMessaging` | 同 295行 | コントローラーの `asWebviewUri` |
| `notebookKernelSource` | `extHost.api.impl.ts`（`notebooks` の名前空間） | `createNotebookControllerDetectionTask` |
| `notebookKernelSource` | 同 | `registerKernelSourceActionProvider` |

投げない判定（`isProposedApiEnabled`）は2つ。`notebookMessaging`（`createNotebookController` の `rendererScripts`）は本家と同じに残した。`notebookLiveShare`（`registerNotebookSerializer` の `registration`）は、何もしない実装では引数を使わないので要らない。

- 消したもの: 拡張ホスト側のノートブックの API のコマンド（`vscode.executeDataToNotebook`・`vscode.executeNotebookToData`・カーネルの選択・変数の取得・対話ウィンドウを開く）。呼ぶと「コマンドが無い」になる。受け手の main thread も無い。
- 公開のクラス（`vscode.NotebookCellData`・`NotebookEdit`・`NotebookRange` など）は残る。
- ノートブックのセルの編集を含む `workspace.applyEdit` は、`BulkCellEdits` の reject で失敗する（拡張には `false` が返る見込み。推定）。

## 検索への影響

- テキスト検索は ripgrep の検索だけになる。前は、開いているノートブックと、ノートブックの種類が登録された閉じたファイルを先にノートブックの検索で探し、ripgrep から外していた。今は `.ipynb` も ripgrep がテキスト（JSON）として探し、普通のファイルの一致として出る。
- `.ipynb` の一致を開くと、テキスト（JSON）のエディタで開く（ノートブックのエディタが無い）。置換もテキストとして行う。
- 検索の入力欄のノートブックの絞り込みのボタンは出ない（前もノートブックを開いたときだけ出た）。クエリの `notebookInfo` は前と同じ既定値（すべて真）で作られ、読み手は無い。
- 検索エディタ（`.code-search`）の書き出しは、セルの一致が無くなるだけ。前後の行（context）は `fileMatch.ts` の1行で前と同じに出る。
- ファイル検索（Quick Open）・シンボル検索・AI の検索の跡（C-1 の隠れた見出し）には触れていない。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json`）に、`notebook` の語（`notebooks`・`notebookRenderer`・`onNotebook`・`enabledApiProposals`）は無い（`Grep` で確かめた）。
  - 圧縮されたコードの中でノートブックの API を呼んでいても、上の何もしない実装が受け、誤りは投げない（`openNotebookDocument`・`showNotebookDocument`・`createNotebookCellExecution` を除く）。
  - 受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。コメントが使う `notebookRange.ts`（common）は残る。
- 台帳のほかの7つ（basedpyright・PowerShell・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パック）の package.json にも、ノートブックの contributes・起動の条件は無い。日本語の言語パックに `vscode.builtin-notebook-renderers` の訳の1項目がある（A-4 で拡張は消えている。読み手が無いだけ）。
- 残す組み込み拡張のうち、ノートブックの API を読むもの（1.146.0 のソースで確かめた）:
  - `typescript-language-features`: `workspace.notebookDocuments` をたどる（`bufferSyncSupport.ts`・`typescriptServiceClient.ts`）→ `[]` なので何もしない
  - `markdown-language-features`: 同じ（`util/file.ts`・`util/document.ts`）。manifest の `notebookRenderer` は受け手が無くなる
  - `git`: `window.activeNotebookEditor?.notebook.uri`（`commands.ts`）→ `undefined`
- 言語クライアントを使う拡張（basedpyright・PowerShell）が起動時にノートブックのイベントを購読しても、`Event.None` が受ける（vscode-languageclient のノートブックの同期。推定。関門のスモークで見る）。

## 型検査に掛からない点（起動の確かめで見る）

- 注入: `INotebookService`・`INotebookEditorService`・`INotebookEditorModelResolverService`・`INotebookSearchService` の登録は消える。edits.patch の後、残る部品のうち `@INotebook...` で注入しているのは、`labels.ts` の `INotebookDocumentService`（`services/notebook` が登録する）と、`notebook/common` の中の作られないクラスだけ（`grep '@INotebook'` で確かめた）。`accessor.get(INotebook...)` は無い。
- 拡張の宣言 `notebooks`・`notebookRenderer`・`notebookPreload` の受け手（`notebookExtensionPoint.ts`）が無くなる。拡張ホストのログに警告が出るかは未確認。
- lint とビルドの一覧に消したフォルダの名前が残る（関門の外）: `eslint.config.js`・`.eslint-allowed-bracket-notation-files`、`src/tsec.exemptions.json` の `notebook/browser/view/renderers/webviewPreloads.ts` の2行、`build/lib/i18n.resources.json` の `vs/workbench/contrib/interactive`・`vs/workbench/contrib/replNotebook`（訳の書き出し用。手元のパッケージ化では使わない。C-2 の `contrib/debug` と同じ扱い）。

## 影響しうるもの

- 全文検索（裁定で残す）: 上の「検索への影響」。直したあと、検索・置換・検索エディタが動くことをスモークで確かめる。
- `.ipynb` を開くと、テキスト（JSON）として開く。
- 拡張の宣言 `notebooks`・`notebookRenderer`（例: `markdown-language-features`・`markdown-math`）は受け手が無くなる。
- コメント（`contrib/comments`）は `notebookRange.ts`（common）の型だけを使うので影響しない見込み。

## 壊れたときの症状と戻し方

- 検索のビューが開かない、または検索で誤りが出る: 上の「注入」の直しが漏れている。`enabled: false` に戻す。
- 拡張の起動時に `vscode.notebooks` などで誤りが出る: 空の実装に足りない項目がある。拡張ホストのログから名前を特定して `extHostRemovedApi.notebook.ts` に足す。

## 別案（リーダーの判断を仰ぐ）

1. docs/03 の表どおり `contrib/notebook` を丸ごと消す。`common` の型を拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`）から外すことになり、本家の変更と衝突しやすい大きなパッチになる。採らない（依頼どおり）。
2. 検索のノートブックの部品（`notebookSearch/`）を残し、そこから `notebook/browser` への参照だけを切る。採らない（依頼どおり）。

edits.patch を作るときに出た判断を仰ぐ点は `tasks/2026-11-15-p5-c4-patch/handoff-notes.md` の「判断を仰ぐ点」。

## 未確認（ビルドと起動で確かめる）

- `extHost.protocol.ts` から消した Shape と ID のほかに、RPC でノートブックの actor を呼ぶ残りの部品が無いこと（`ExtHostContext.*Notebook*`・`MainContext.*Notebook*` を `grep` して、使い手が無いことは確かめた）。
- `notebookCommon.ts` などの common が、消した browser 側の副作用（登録）に頼っていないか。
- 拡張ホストで `vscode.workspace.notebookDocuments` などを呼ぶ拡張（TypeScript・basedpyright・PowerShell）が誤りを出さないか（スモーク）。
- 検索のテスト（`contrib/search/test/browser`）が通るか（型検査は通る。単体テストは走らせていない）。

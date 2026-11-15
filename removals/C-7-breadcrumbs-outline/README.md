# C-7-breadcrumbs-outline パンくずリストとアウトラインのサービス

裁定（2026-11-12）: 画面の部品で削る候補にアウトライン・パンくずリスト。アウトラインのビューは B-4 で消した。この単位でパンくずリストと、それが使うアウトラインのサービスを消す。

> 状態: **edits.patch あり、関門の前**（2026-11-15）。`enabled` は `false` のまま。型検査は誤り 0。ビルド・起動の確かめ・関門は、片づけの許可の後。
>
> docs/03 の表の注意: 本家の共有部品（エディタの枠）に入っているので、本家の変更と衝突しやすい。**関門を2回続けて通らなければ、ユーザーに諮る**（docs/08 の別案）。パッチの大きさと別案の見込みは下の「パッチの大きさ」。

## 消すもの

- `src/vs/workbench/browser/parts/editor/breadcrumbs.ts`（`IBreadcrumbsService` の登録と `breadcrumbs.*` の設定）・`breadcrumbsControl.ts`（パンくずの部品と `breadcrumbs.*` のコマンド13個）・`breadcrumbsModel.ts`・`breadcrumbsPicker.ts`・`media/breadcrumbscontrol.css`。
- `src/vs/workbench/services/outline`: アウトラインのサービス（`IOutlineService`。エディタの種類ごとにアウトラインを作る仕組み）。
- `src/vs/workbench/contrib/codeEditor/browser/outline`: テキストエディタの記号のアウトライン（パンくずの記号の部分とアウトラインのビューの中身）。
- テスト3つ（パンくずの部品とモデル、記号のアウトライン）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行。`sessions.common.main.ts` の2行は直さない（C-1 が `src/vs/sessions` を消す）。
- edits.patch で外したもの（下の「edits.patch で直した点」）
  - エディタの枠がパンくずを作る部分（全幅のヘッダー・タブの下・1枚のタブの表示）
  - 記号へ移動（Ctrl+Shift+O）のうち、テキスト以外のエディタでアウトラインのサービスから一覧を作る部分
  - カスタムテキストエディタがアウトラインのサービスへ変化を知らせる2か所
  - エディタの部分の設定 `IEditorPartOptions.showBreadcrumbs`（読み手は消した `breadcrumbsControl.ts` だけ。2026-11-14 の規則の当てはめ）

## 残すもの

- `src/vs/base/browser/ui/breadcrumbs`（パンくずの汎用の部品 `BreadcrumbsWidget`）: 共有の `platform/theme/browser/defaultStyles.ts`（14行）が型 `IBreadcrumbsWidgetStyles` を import する。消すと共有のファイルに触れることになり、毎週の衝突が増える。21単位の木でほかに使うのは、部品自身のテスト（`base/test/browser/ui/breadcrumbs/breadcrumbsWidget.test.ts`）だけ。差分エディタの「変更の無い部分」のパンくず（`editor/contrib/diffEditorBreadcrumbs`）はこの部品を使わない。チャットのデバッグのビュー（`contrib/chat/browser/chatDebug`）は C-1 で消える（2026-11-15 に `C:\b\wt\1.146.0` で確かめた）。
- `src/vs/editor/contrib/documentSymbols`（`IOutlineModelService`）: 記号へ移動（Ctrl+Shift+O。`gotoSymbolQuickAccess.ts`）とスティッキースクロールが使う。テキストエディタの記号へ移動は「従来の記号の取得」で動く。
- タブの枠の CSS（`singleeditortabscontrol.css`・`editortabscontrol.css`・`multieditortabscontrol.css`・`editortitlecontrol.css` のパンくずの規則）: 共有のファイルなので触らない。当てる要素が無くなり、効かないだけ。
- edits.patch を作るときに見つけて、残したもの（理由つき）
  - 引数の名前 `breadcrumbsInHeader`（`editorTabsControl.ts`・`multiEditorTabsControl.ts`・`multiRowEditorTabsControl.ts`・`singleEditorTabsControl.ts`）: 中身は「全幅のヘッダーを出すか」（`showHeader`）で、パンくずが無くても1枚のタブの並べ方に使う。名前を変えると枠の4ファイルにハンクが増えるので変えない。
  - カスタムテキストエディタの記号の移動（`CustomEditorInput.navigation`・`mainThreadCustomTextEditorNavigation.ts`）: 保存の処理（`contrib/codeEditor/browser/saveParticipants.ts` の132行）と、選択範囲の取得・開くときの位置の指定（`customEditorInput.ts` の69〜79行の `getSelection`・`applyOptions`）が読む。アウトラインのサービスへ知らせる2行だけを外した。
  - `gotoSymbolQuickAccess.ts` の `isCompositeEditor` の分岐と、その上のコメント（`IOutlineService` の語を含む TODO）: 分岐はテキスト以外のエディタで「テキストエディタが無い」の表示に回す。コメントは本家の文のまま。
  - `contrib/accessibility/browser/unfocusedViewDimmingContribution.ts` の `.breadcrumbs-below-tabs` の CSS の規則（文字列）と、`editorGroupView.ts` の `monaco-breadcrumb-item` のクリックの判定: 当てる要素が無いだけ。
  - `contrib/preferences/browser/settingsLayout.ts` の139行（設定の画面の目次の `breadcrumbs.*`）: 設定が無いので目次の項目が空になるだけ。
  - テストの設定値 `breadcrumbs: { enabled: false }`（`test/browser/parts/editor/editorHeaderControl.test.ts` の34行）と、`tabs.fixture.ts` の見た目の説明の文（「the breadcrumb bar and editor body remain below」）: 値と文だけで、読む部品は無い。直すと、触らない2つのテストのファイルにハンクが増える。
  - lint の一覧（`eslint.config.js` の759・904・905行）に、消したファイルの名前が残る（関門の外）。

## 前提の単位

- `after`: `B-4-outline-view`、`C-1-ai`、`C-4-notebook`（C-4 の `after` に C-2 がある）。
- `services/outline` は AI（`contrib/chat` の `chatOutline.ts`・`chatOutlineCreator.ts`。C-1）とノートブック（`notebookOutline.ts` など。C-4）も使う。どちらも先に消えている前提で、この単位はそれらを直さない。C-1 は `src/vs/sessions` も消すので、sessions の入口の行もこの単位では直さない。
- edits.patch は、C-1 の edits.patch が直した3つのファイル（`gotoSymbolQuickAccess.ts`・`anythingQuickAccess.test.ts`・`tabs.fixture.ts`）の C-1 の後の形に当たる。C-1 は `after` にあるので、C-1 を外すと C-7 は当たる前に止まる（docs/03 の5.1 の2-1）。

## edits.patch で直した点（2026-11-15）

A・B の14単位と C-1・C-2・C-4・C-7 の ops の上で、型検査の誤りは 11 → 13 → 0（回ごとの内訳は `tasks/2026-11-15-p5-c7-patch/typecheck-log.md`）。

| ファイル | 直し方 |
|---|---|
| `browser/parts/editor/editorHeaderControl.ts`（枠） | パンくずの入れ物・部品を作る所、表示の切り替え、`handleEditorsChange`、`layout` のパンくずの幅の計算を消した。高さはヘッダーがあるときだけ（無いときは 0）。ヘッダーの操作の並べ方は「パンくずが無いとき」の値（`flex: 1 1 auto`、`minmax(0, 1fr) auto auto`）に固定した。ヘッダーの要素の印 `breadcrumbs-in-header` を外した（CSS にも使い手にも無い） |
| `browser/parts/editor/editorTitleControl.ts`（枠） | `headerControl.handleEditorsChange` の3か所の呼び出しと、呼び出すだけの `handleOpenedEditors`・`handleClosedEditors` を消した |
| `browser/parts/editor/singleEditorTabsControl.ts`（枠） | パンくずの部品を作る所、`.title.breadcrumbs` の印、`handleBreadcrumbsEnablementChange`、`redraw` と `layout` のパンくずの更新を消した。ファイルの説明（description）を隠す条件からパンくずの分を外した |
| `browser/parts/editor/auxiliaryEditorPart.ts`（枠） | 小さい窓の強制の設定から `showBreadcrumbs: false` を外した |
| `common/editor.ts`（共有） | `IEditorPartOptions.showBreadcrumbs` を外した |
| `contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts` | `IOutlineService` の注入、`provideWithoutTextEditor` の上書き、`canPickWithOutlineService`・`doGetOutlinePicks`・`outlineToNavigableEntries`・`installNavigablePicks`、`INavigablePickEntry`、使われなくなった import を消した。テキスト以外のエディタでは、本家の基底の「記号が無い」の表示になる |
| `api/browser/mainThreadCustomEditors.ts` | `IOutlineService` の注入と `notifyOutlineChanged()` の2か所を消した |
| テスト: `api/test/browser/mainThreadCustomEditors.test.ts` | `IOutlineService` の差し替え、`outlineChanges` の数えと4つの確かめを外した。記号の移動そのものの確かめは残る |
| テスト: `contrib/search/test/browser/anythingQuickAccess.test.ts` | `IOutlineService` の差し替えと import を外した |
| テスト: `test/browser/componentFixtures/editor/tabs.fixture.ts` | 見本の `breadcrumbs` の選択肢、`breadcrumbs` の設定、`IBreadcrumbsService`・`IOutlineService`・作業場所の差し替え、見本 `ShowBreadCrumbs` を消した |

### パンくずが無くなった後の、エディタの枠の振る舞い

- 本家の既定（タブが複数、`showHeader` は偽）: 前はタブの下に `.breadcrumbs-below-tabs` の入れ物を必ず作り、パンくずが無効なら隠して高さ 0 にしていた。今は入れ物を作らず、高さはいつも 0。`mydist` の既定 `breadcrumbs.enabled: false` の下で見ていた画面と同じになる見込み。
- 1枚のタブ（`workbench.editor.showTabs: single`）: 前はラベルの横にパンくずを作っていた（無効なら作らない）。今は作らない。ファイルの説明は、パンくずが無効だったときと同じ条件（ラベルの書式とグループが前か）で出る。
- 全幅のヘッダー（`showHeader` が真）: このビルドで使っていたのは、C-1 が消すエージェントの窓とチャットの窓だけ（1.146.0 で `showHeader: true` を探した。ほかはテスト）。今はヘッダーは操作だけを並べ、操作が無く場所の確保も無いときは出さない。1枚のタブでは、前はヘッダーがあると説明を隠していたが、今は上の条件で出る。

## 注入の照らし（型検査に掛からない点）

18単位の木（edits.patch を作った木）と21単位の木（確かめ b）で `Grep` した。

- `src/vs` で `IOutlineService`・`IBreadcrumbsService`・`BreadcrumbsControl`・`BreadcrumbsConfig`・`OutlineTarget`・`IOutlineCreator`・`notifyOutlineChanged`・`showBreadcrumbs` は 0 件（`gotoSymbolQuickAccess.ts` のコメントの1行と、テストの性能の資料の文字列を除く）。`@IOutlineService`・`@IBreadcrumbsService` は 0 件。
- アウトラインを作る側（`registerOutlineCreator`）は、1.146.0 では消した `documentSymbolsOutline.ts`（C-7）、`notebookOutline.ts`（C-4）、`chatOutlineCreator.ts`（C-1）の3つだけ。残る部品に作る側は無い。
- 消したファイルを文字列で読み込む所: `breadcrumbscontrol.css`・`services/outline`・`codeEditor/browser/outline` の名前は、`eslint.config.js` とテストの性能の資料（`uri.perf.data.txt`）にだけ残る。
- 消したコマンド（`breadcrumbs.*`）を文字列で呼ぶ所は `src/vs` に無い。残す組み込み拡張の package.json と、台帳の拡張の package.json（`C:\b\cache\vsix\*`）に `breadcrumb`・`outline.` の語は無い。

## エディタの枠と Claude Code への影響

- 枠の4ファイル（`editorHeaderControl.ts`・`editorTitleControl.ts`・`singleEditorTabsControl.ts`・`auxiliaryEditorPart.ts`）と `common/editor.ts` は、パンくずの部分だけを外した。タブ（`multiEditorTabsControl.ts`・`multiRowEditorTabsControl.ts`・`editorTabsControl.ts`）、エディタのグループ（`editorGroupView.ts`）、差分エディタ（`editor/browser/widget/diffEditor`・`editor/contrib/diffEditorBreadcrumbs`）、Webview のエディタ（`contrib/webview*`・`contrib/customEditor`）のファイルには触れていない。
- タイトルの高さの計算（`EditorTitleControl.getHeight()` の `total` と `offset`）は形を変えていない。ヘッダーの高さがパンくずの分だけ 0 になる。
- Claude Code（2.1.322）の manifest に `breadcrumb`・`outline` の語は無い（`license` の文の「outlined」だけ）。受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム・`editor/title` のメニュー）には触れていない。`editor/title` のメニューは、タブの列の操作の部分（`editorTabsControl.ts`）が出すので変わらない。
- 拡張 API（`api/`）の何もしない実装は要らない。アウトラインのサービスは拡張 API から見えない（`api/common` に使い手が無い）。拡張の `DocumentSymbolProvider` は `IOutlineModelService` を通して残る。

## パッチの大きさ

| 項目 | 値 |
|---|---|
| edits.patch | 10ファイル（新規 0）、13行の追加、323行の削除、42ハンク、738行 |
| うちエディタの枠（`browser/parts/editor`） | 4ファイル、17ハンク（`editorHeaderControl.ts` 6・`singleEditorTabsControl.ts` 7・`editorTitleControl.ts` 3・`auxiliaryEditorPart.ts` 1） |
| うち共有の型（`common/editor.ts`） | 1ハンク（1行） |
| うちそのほかの本体 | 2ファイル、8ハンク（`gotoSymbolQuickAccess.ts` 4・`mainThreadCustomEditors.ts` 4） |
| うちテスト | 3ファイル、16ハンク（`mainThreadCustomEditors.test.ts` 7・`tabs.fixture.ts` 7・`anythingQuickAccess.test.ts` 2） |
| ops | `delete` 10（ファイル8とフォルダ2）、`removeLines` 2行 |

### 別案（docs/08 の5節。設定で隠して止める）の見込み

本家 1.146.0 のソースからの見込み（推定。作っていない）。

- 案1（最小）: `mydist` の既定 `breadcrumbs.enabled: false`（今ある）に加え、`breadcrumbsControl.ts` の812行の `isEnabled` を常に偽にする。1ファイル、1ハンク、1行。枠のファイルのハンクは 0。ただし `breadcrumbs.*` の設定・コマンド（「表示 > パンくずリストの切り替え」など）は残る。`checks` の `absentCommands`・`absentSettings` は通らないので、外すことになる。
- 案2（コマンドと設定も隠す）: 案1に加え、`breadcrumbsControl.ts` のコマンドの登録（873行からの `registerAction2` 4つ。キーの割り当て9つは文脈キーが立たないので残せる）と、`breadcrumbs.ts` の設定の登録（121〜346行）を消す。2ファイル、5〜6ハンク、約330行の削除。枠のファイルのハンクは 0。
- どちらの案でも、`services/outline`・`codeEditor/browser/outline` とパンくずのコードは読み込まれたまま残る（裁定の「コードごと消す」と違う）。パッチはパンくず自身のファイルにかかるので、本家がパンくずを直した週は衝突しうるが、枠のファイルの変更とは衝突しない。
- 今の edits.patch との差: 枠の 17ハンク・共有の型の 1ハンクが、案1・案2では 0 になる。毎週の衝突の起きやすさの差は、本家が枠のファイルをどれだけ変えるかによる（Phase 3 の手間の記録で測る）。

## checks の見直し（2026-11-15）

- `absentStrings` に4つを足した。どれも `C:\b\wt\1.146.0` の同じ範囲にある（空振りしない）。
  - `BreadcrumbsControlFactory`（`src/vs/workbench/browser/parts/editor`）
  - `@IOutlineService`・`notifyOutlineChanged`・`showBreadcrumbs`（`src/vs/workbench`）
- `absentCommands`（4つ）と `absentSettings`（3つ）は下準備のまま。`breadcrumbsControl.ts` と `breadcrumbs.ts` は C-7 の前は枠のファイルが import するので、条件なしに登録されていた。

## 影響しうるもの

- エディタの上のパンくずリスト（ファイルの経路と記号）が消える。`mydist` の既定 `breadcrumbs.enabled: false` は、この単位を有効にすると `apply.mjs` が `absentSettings` から外す（docs/03 の4節の末尾）。
- 記号へ移動（Ctrl+Shift+O）はテキストエディタでは変わらない。テキスト以外のエディタ（カスタムエディタなど）では、前はアウトラインのサービスで一覧を作れたが、今は「記号が無い」の表示になる。前に一覧を作っていたのは、消したノートブック（C-4）・チャット（C-1）と、記号の移動を持つカスタムテキストエディタ（`documentSymbolsOutline.ts` の415行。`CustomEditorInput.navigation` があるとき）。差分エディタはテキストエディタとして扱われる（`isCompositeEditor` が真になるのはノートブックの部品だけ）ので変わらない。同梱の拡張にカスタムテキストエディタがあるかは未確認（PDF のプレビュー `tomoki1207.pdf` はテキストでないカスタムエディタなので該当しない見込み。推定）。
- エディタの枠（タブ・ヘッダー）の高さの計算が変わる。タブの見た目・エディタの分割（裁定で残す）・1枚のタブの表示をスモークで見る。

## 壊れたときの症状と戻し方

- エディタの上に空の帯が残る、またはタブの高さがずれる: 枠の高さの計算の直しが不十分。`enabled: false` に戻す。
- 1枚のタブの表示で、ファイルの説明の出方が前と違う: `singleEditorTabsControl.ts` の説明の条件。`enabled: false` に戻す。
- 関門を2回続けて通らなければ、ユーザーに諮る（docs/03 の表、docs/08 の別案。上の「別案の見込み」）。

## 未確認（ビルドと起動で確かめる）

- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`outlineService`・`breadcrumbsService`）が無いこと。型検査と `Grep` では残る注入は見つからなかった。
- タブが複数・1枚・無しのそれぞれで、タブの高さとエディタの本体の位置が `breadcrumbs.enabled: false` のときと同じであること。エディタの分割・差分エディタ・Claude Code のパネル（Webview）と差分が動くこと。
- 単体テスト（`editorHeaderControl.test.ts`・`mainThreadCustomEditors.test.ts`・`anythingQuickAccess.test.ts`）と見本（`tabs.fixture.ts`）は走らせていない。

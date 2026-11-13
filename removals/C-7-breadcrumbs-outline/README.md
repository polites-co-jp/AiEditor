# C-7-breadcrumbs-outline パンくずリストとアウトラインのサービス

裁定（2026-11-12）: 画面の部品で削る候補にアウトライン・パンくずリスト。アウトラインのビューは B-4 で消した。この単位でパンくずリストと、それが使うアウトラインのサービスを消す。

> 状態: 下準備（2026-11-14）。`unit.json` の ops だけを作った。`edits.patch` は型検査を走らせられるようになってから作り、そのときに `unit.json` に `"patch": "edits.patch"` を足す。
>
> docs/03 の表の注意: 本家の共有部品（エディタの枠）に入っているので、パッチが大きく、本家の変更とも衝突しやすい見込み。**関門を2回続けて通らなければ、ユーザーに諮る**（docs/08 の別案）。

## 消すもの

- `src/vs/workbench/browser/parts/editor/breadcrumbs.ts`（`IBreadcrumbsService` の登録と `breadcrumbs.*` の設定）・`breadcrumbsControl.ts`（パンくずの部品と `breadcrumbs.*` のコマンド13個）・`breadcrumbsModel.ts`・`breadcrumbsPicker.ts`・`media/breadcrumbscontrol.css`。
- `src/vs/workbench/services/outline`: アウトラインのサービス（`IOutlineService`。エディタの種類ごとにアウトラインを作る仕組み）。
- `src/vs/workbench/contrib/codeEditor/browser/outline`: テキストエディタの記号のアウトライン（パンくずの記号の部分とアウトラインのビューの中身）。
- テスト3つ（パンくずの部品とモデル、記号のアウトライン）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行。`sessions.common.main.ts` の2行は直さない（C-1 が `src/vs/sessions` を消す）。

## 残すもの

- `src/vs/base/browser/ui/breadcrumbs`（パンくずの汎用の部品）: 差分エディタの「変更の無い部分」の表示（`editor/contrib/diffEditorBreadcrumbs`。差分エディタは Claude Code の受け手。docs/03 の9節）が使う。
- `src/vs/editor/contrib/documentSymbols`（`IOutlineModelService`）: 記号へ移動（Ctrl+Shift+O。`gotoSymbolQuickAccess.ts`）とスティッキースクロールが使う。テキストエディタの記号へ移動は「従来の記号の取得」で動き、`IOutlineService` を使うのはテキスト以外のエディタ（ノートブック・カスタムエディタ）のときだけ（`gotoSymbolQuickAccess.ts` の85〜96行・185〜195行）。
- タブの枠の CSS（`singleeditortabscontrol.css` などのパンくずの規則）: 共有のファイルなので触らない。残っても効かないだけ。

## 型検査で直す点（edits.patch の見込み）

1.146.0 の作業ツリーで `grep` した結果。行は 1.146.0 のもの。

| ファイル | 行 | 中身 | 直し方の見込み |
|---|---|---|---|
| `src/vs/workbench/browser/parts/editor/editorHeaderControl.ts`（共有部品） | 12・29〜32・42・70〜79・91・93・102〜115 | 全幅のヘッダーの中にパンくずを作り、高さと幅を計算する | パンくずの部分（`breadcrumbsContainer`・`breadcrumbsControlFactory`・表示の更新）を消し、高さの計算からパンくずの分を外す。ヘッダーの操作（アクション）は残す |
| `src/vs/workbench/browser/parts/editor/singleEditorTabsControl.ts`（共有部品） | 21・34・35・63〜73・243・288〜293・314・390 | 1枚のタブの表示でパンくずを作る | 同上。`breadcrumbsInHeader` の判定（314行）はヘッダーに移ったパンくずの判定なので、パンくずが無い前提に直す |
| `src/vs/workbench/contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts` | 29・64・185〜195・218〜257・260 | テキスト以外のエディタで `IOutlineService` を使って記号の一覧を作る | `IOutlineService` の注入と `canPickWithOutlineService`・`doGetOutlinePicks` を消し、テキスト以外のエディタでは従来どおり「記号が無い」を出す。`outlineToNavigableEntries` はチャット（C-1）の分岐も使うので、C-1 の後なら一緒に消える |
| `src/vs/workbench/api/browser/mainThreadCustomEditors.ts` | 14・115・368・389 | カスタムテキストエディタの記号の移動が変わったことをアウトラインのサービスへ知らせる | 注入と `notifyOutlineChanged()` の2か所を消す |
| テスト: `api/test/browser/mainThreadCustomEditors.test.ts`（43）、`contrib/search/test/browser/anythingQuickAccess.test.ts`（27）、`workbench/test/browser/componentFixtures/editor/tabs.fixture.ts`（37・43）、`sessions/contrib/editor/test/electron-browser/emptyStates.fixture.ts`（48）、`sessions/test/browser/layoutActions.test.ts`（46。`breadcrumbsControl.js` を import。試しの `absentStrings` で見つけた） | — | `IOutlineService`・`BreadcrumbsService` を注入して組み立てる | 注入の行を外す |
| C-1・C-4 の範囲: `contrib/chat/browser/chatOutline.ts`・`chatOutlineCreator.ts`・チャットのテスト、`contrib/notebook/browser/...`（`notebookOutline.ts` など）、`src/vs/sessions` のテスト（`layoutActions.test.ts`・`emptyStates.fixture.ts`） | — | `services/outline`・`breadcrumbsControl.js` を import | C-1・C-4 で消える（`after` に挙げた。C-1 と C-4 の ops の後の試しで消えたことを確かめた） |

- **型検査に掛からない点**: `IOutlineService`・`IBreadcrumbsService` の登録が無くなるので、残る部品が注入していないことを `grep '@IOutlineService\|@IBreadcrumbsService'` で確かめる（1.146.0 では上の表のほかに無い）。
- `contrib/preferences/browser/settingsLayout.ts` の139行が設定の画面の目次に `breadcrumbs.*` を挙げる。設定が無いので目次の項目が空になるだけの見込み（直さない）。
- lint の一覧（`eslint.config.js` の904・905行）に `services/outline` の名前が残る（関門の外）。

## 前提の単位

- `after`: `B-4-outline-view`、`C-1-ai`、`C-4-notebook`。
- `services/outline` は AI（`contrib/chat` の `chatOutline.ts`・`chatOutlineCreator.ts`。C-1）とノートブック（`notebookOutline.ts` など。C-4）も使う。どちらも先に消えている前提で、この単位はそれらを直さない。C-1 は `src/vs/sessions` も消すので、sessions の入口の行もこの単位では直さない。

## 影響しうるもの

- エディタの上のパンくずリスト（ファイルの経路と記号）が消える。`mydist` の既定 `breadcrumbs.enabled: false` は、この単位を有効にすると `apply.mjs` が `absentSettings` から外す（docs/03 の4節の末尾）。
- 記号へ移動（Ctrl+Shift+O）はテキストエディタでは変わらない。カスタムテキストエディタ（拡張がテキストの文書に独自の画面を出すもの）で記号の移動を提供していると、その一覧が出なくなる。同梱の拡張にあるかは未確認（PDF のプレビュー `tomoki1207.pdf` はテキストでないカスタムエディタなので該当しない見込み。推定）。
- エディタの枠（タブ・ヘッダー）の高さの計算が変わる。タブの見た目・エディタの分割（裁定で残す）をスモークで見る。

## 壊れたときの症状と戻し方

- エディタの上に空の帯が残る、またはタブの高さがずれる: 枠の高さの計算の直しが不十分。`enabled: false` に戻す。
- 関門を2回続けて通らなければ、ユーザーに諮る（docs/03 の表、docs/08 の別案）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。
- `editorHeaderControl.ts`・`singleEditorTabsControl.ts` のパンくずを外したときに、ヘッダーの表示の条件（`EditorGroupHeaderBehavior` など）が崩れないか。

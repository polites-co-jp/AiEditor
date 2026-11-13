# B-4-outline-view アウトラインのビュー

裁定（2026-11-12）: 画面の部品で削る候補にアウトライン・パンくずリスト。パンくずリストは C-7 で消す。

## 消すもの

- `src/vs/workbench/contrib/outline/browser` のうち、`outline.ts` を除く全部: アウトラインのビューの登録（エクスプローラーのコンテナーの中のビュー `outline`）、ビューの操作（`outline.collapse`・`outline.expand`・`outline.followCursor`・`outline.filterOnType`・`outline.sortBy*`）、設定 `outline.*`（`outline.icons`・`outline.collapseItems`・`outline.problems.*`・`outline.show*`）。
- import の行（`removeLines`）: `workbench.common.main.ts` の1行。sessions の入口は import していない（`grep` で確かめた）。
- `edits.patch` は無い。

## 残すもの

- `src/vs/workbench/contrib/outline/browser/outline.ts`: ビューの ID の定数 `IOutlinePane.Id` と context key だけのファイル。ノートブックのアウトライン（`contrib/notebook/browser/contrib/outline/notebookOutline.ts` の49行と899行。ビューのメニューの `when`）が import している。ノートブックは C-4 で消える。フォルダごと消すとノートブックへのパッチが要るので、ファイルを1つ残した。
- `src/vs/workbench/services/outline`、`src/vs/workbench/contrib/codeEditor/browser/outline`: パンくずリストとエディタの記号の一覧が使う（docs/03 の表のとおり C-7 まで残す）。

## 影響しうるもの

- 設定 `outline.icons`・`outline.problems.*`・`outline.collapseItems` が登録されなくなる。残る `documentSymbolsTree.ts`・`documentSymbolsOutline.ts`（パンくずリスト）と、ノートブックのアウトラインがこれらを読む。値は `undefined` になり、パンくずリストの記号のアイコンと問題の色が出なくなる見込み（推定）。パンくずリストは `mydist` の既定 `breadcrumbs.enabled: false` で隠れているので、見た目の影響は小さい。
- `outline.show*` の設定は、アウトラインのビューのための絞り込み。パンくずリストは `breadcrumbs.show*` を使うので影響しない（推定）。

## 壊れたときの症状と戻し方

- エクスプローラーの下に空の「アウトライン」が残る、またはビューの復元で誤りが出る場合は、以前の配置の記憶（ユーザーのデータ）が原因の見込み。`enabled: false` に戻すか、ビューの配置を初期化する。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか（残した `outline.ts` が `IView` の型を import しているだけで、消したファイルを参照していないことは読んで確かめた）。
- パンくずリストを有効にしたときに、`outline.*` の設定が無くても誤りが出ないか（C-7 までの間、ユーザーが `breadcrumbs.enabled` を入れた場合）。

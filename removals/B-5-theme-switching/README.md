# B-5-theme-switching テーマの切り替え

裁定（2026-11-12）: 画面の部品で削る候補に「テーマの切り替え（固定のテーマ1つ）」。固定するテーマは Light Modern。

## 消すもの

- `src/vs/workbench/contrib/themes/browser`（2ファイル）:
  - `themes.contribution.ts`: 色のテーマ・ファイルアイコンのテーマ・製品アイコンのテーマを選ぶクイックピック（`workbench.action.selectTheme`・`selectIconTheme`・`selectProductIconTheme`）、明暗の切り替え（`toggleLightDarkThemes`）、マーケットプレイスのテーマの閲覧（`browseColorThemesInMarketplace`）、色のテーマの書き出し（`generateColorTheme`）、新しい既定テーマの試し（`tryNewDefaultThemes`）、拡張の画面から呼ばれるテーマの試し（`workbench.action.previewColorTheme`）、管理のメニュー（歯車）と「基本設定」のメニューの「テーマ」。
  - `themes.test.contribution.ts`: 構文の色付けの記録（`_workbench.captureSyntaxTokens`・`_workbench.captureTreeSitterSyntaxTokens`。本家の試験用）。
- import の行（`removeLines`）: `workbench.common.main.ts`・`workbench.desktop.main.ts`・`sessions.common.main.ts`・`sessions.desktop.main.ts` の各1行。
- `edits.patch` は無い。ほかの部品は `contrib/themes/browser` を import していない（`grep` で確かめた。`manageExtensionIcon` は `contrib/extensions/browser/extensionsIcons.ts` に同じ名前の別のものがある）。

## 残すもの

- `src/vs/workbench/services/themes`: テーマのサービス。`workbench.colorTheme` の設定を読んで色を当てる。テーマは `mydist` の既定 `workbench.colorTheme: "Light Modern"` で決まる。
- `src/vs/workbench/contrib/themes/test`: 色の登録の試験（消した部分を import していない）。

## 影響しうるもの

- テーマは `settings.json` の `workbench.colorTheme` で変えられる（コマンドと画面が無くなるだけ）。
- 拡張の詳細の画面の「色のテーマを設定」のボタン、歓迎画面のテーマの選択（B-2 で消える）など、文字列でコマンドを呼ぶ所は「コマンドが見つからない」になる。
- A-6-themes（テーマの組み込み拡張を消す）とは独立。両方を当てると、残るテーマは `theme-defaults` の中だけになる。

## 壊れたときの症状と戻し方

- テーマが Light Modern にならないときは、この単位ではなく `mydist` の既定（docs/04 の6.1）を見る。この単位を `enabled: false` に戻せばコマンドで選べるようになる。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。
- 本家の拡張の試験（`extensions/vscode-colorize-tests` など。同梱されない）が `_workbench.captureSyntaxTokens` を使う。自前のビルドの関門には含まれないので影響しない見込み（推定）。

# A-6-themes

使わないテーマの組み込み拡張を消す（docs/03 の4節の段階 A。裁定でテーマは Light Modern に固定）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ（10件） | `extensions/theme-abyss`・`theme-kimbie-dark`・`theme-modern-icons`（アイコンのテーマ `vscode-modern-icons`）・`theme-monokai`・`theme-monokai-dimmed`・`theme-quietlight`・`theme-red`・`theme-solarized-dark`・`theme-solarized-light`・`theme-tomorrow-night-blue` |
| edits.patch | `src/vs/workbench/test/browser/componentFixtures/fixtureUtils.ts` の、消したテーマの JSON の `import` 5行と、それを使う項目10行（`themeJsonModules` の5行、`additionalThemeVariants` の5行） |

テーマの拡張はコードを持たないので、`build/npm/dirs.ts` などの一覧には載っていない（removeLines は無い）。

### パッチが要る理由

`fixtureUtils.ts`（部品の見本。同梱されない）は、テーマの JSON を `import ... from '../../../../../../extensions/theme-abyss/themes/abyss-color-theme.json' with { type: 'json' }` の形で読む。`src/tsconfig.json` は `./vs/**/*.ts` をすべて含むので、フォルダを消すと型検査（`typecheck-client` など）が「ファイルが無い」で落ちる。見本の中で、消したテーマの名前（`abyss` など）を値として使う所は無い（grep で0件）。

`fixtureUtils.ts` のアイコンのテーマ `vscode-modern-icons` の項目（URL の文字列と型）は残した。型（`ComponentFixtureFileIconTheme`）を `tabs.fixture.ts` が使うので、消すとパッチが広がる。URL は実行時に読むだけなので型検査には響かない。

## 残すもの

- `theme-defaults`（Light Modern。既定の Light 2026 / Dark 2026、ハイコントラスト、アイコンのテーマ `vs-minimal` も持つ）と `theme-seti`（既定のアイコンのテーマ `vs-seti`。`src/vs/workbench/services/themes/common/workbenchThemeService.ts` の `FILE_ICON_THEME`）。
- テーマのサービス（`services/themes`）とテーマを選ぶコマンド（B-5 で消す）。
- product.json の `onboardingThemes`（`Solarized Dark`・`Solarized Light` を指す）。B-2 で消す。

## 影響しうるもの

- テーマを選ぶ一覧から10件が消える。Light Modern は `mydist` の既定（`workbench.colorTheme`）。
- 歓迎画面が `onboardingThemes` の Solarized を探して警告を出す恐れがある（docs/03 の表の注。推定）。B-2 まで残る。
- 部品の見本のうち、アイコンのテーマ `vscode-modern-icons` を使う `tabs.fixture.ts` の1件は、実行時に読めずに失敗する見込み。見本は同梱されず、関門にも入っていない。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| 型検査で `Cannot find module '.../extensions/theme-*/...json'` | 本家が別のファイルでテーマの JSON を import した | そのファイルの import を edits.patch に足す |
| edits.patch が当たらない | 本家が `fixtureUtils.ts` のテーマの一覧を変えた | 作業ツリーで直して edits.patch を書き戻す（docs/03 の5.2） |
| 利用者の設定に消したテーマが残っていて既定に戻る | 想定どおり | 何もしない |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 未確認

- 型検査（`typecheck-client`）が edits.patch の後に通るか（`ComponentFixtureAdditionalTheme` から5件が減る。値として使う所は無いので通る見込み）。
- 歓迎画面の警告（スモークの base の開発者ツールのコンソール）。

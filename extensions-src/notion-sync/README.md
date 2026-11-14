# notion-sync

ユーザーの設定ファイルを Notion の設定ページで複数の PC にそろえる、Shuko の組み込み拡張（docs/05）。

## 使い方

1. Notion で設定ページを1枚作り、設定の同期用の内部インテグレーションをそのページだけに接続する（docs/05 の7節）。
2. 設定 `notionSync.pageId` にページの ID（ページの URL のままでもよい）を入れる。
3. コマンド「Notion 同期: トークンを設定」でトークンを入れる。トークンは拡張の SecretStorage（Windows では DPAPI）に保存され、settings.json には書かれない。
4. `notionSync.enabled` を true にする（トークンを設定したときに聞かれる）。

同期するのは、User フォルダの `settings.json`・`keybindings.json`・`tasks.json`・`snippets/*.json`・`snippets/*.code-snippets`。`notionSync.ignoredSettings` に挙げた settings.json の最上位のキーは、書き出すときに除き、取り込むときは手元の値を残す。

| きっかけ | 動き |
|---|---|
| 起動 | Notion を読み、取り込み・書き出しをする。両方が変わったファイルは競合にする |
| 対象のファイルの保存 | 5 秒待ってまとめ、書き出す（手元が変わっていなければ Notion を呼ばない） |
| 「取り込む」「書き出す」 | 手動で、その向きだけ行う |
| 「差分を見る」 | 差分ビューで Notion（左）と手元（右）を並べ、「手元を採る」「Notion を採る」「手で直して書き出す」から選ぶ |

ステータスバーに「同期済み」「未同期」「競合あり」を出す。ログは出力パネルの「Notion 同期」。

注意: `claudeCode.environmentVariables` をユーザー設定に書くと、`mydist` の既定の配列（CLI の付帯の通信を止める変数）が丸ごと置き換わる。書くときは既定の2件も含める（docs/05 の2節）。

## ビルド

```
pnpm --dir extensions-src/notion-sync install
pnpm --dir extensions-src/notion-sync run build            # 型検査 → dist/extension.js → dist/i18n の翻訳の束 → 読み込みの確かめ
pnpm --dir extensions-src/notion-sync run build --trial    # 加えて、差し替えた Notion で同期の流れを試す
```

- 本体の道具（Build Tools・node-gyp）は要らない。Node.js 24.16.0 と pnpm 11.8.0 で確かめた。
- このフォルダは独立した pnpm の作業場所（`pnpm-workspace.yaml`）。依存の install スクリプトは走らせない（`allowBuilds: esbuild: false`）。
- `apply.mjs` が作業ツリーの `extensions/notion-sync/` に写すのは `package.json`・`README.md`・`ThirdPartyNotices.txt`・`dist/` だけ。`dist/extension.js` が無ければ写さない。

## 日本語の表示と翻訳の束

組み込みの拡張は、表示の言語が英語でないと、拡張ホストがコードを読み込む前に言語パックからその拡張の ID の翻訳を探し、無いと `exthost.log` に `[error] No bundle location found for extension shuko.notion-sync` を出す（Phase 2 の関門 `records/take-in/1.146.0-p2-A-1/gate-A-1-copilot-extension.md` の3節）。組み込みでは manifest の `l10n` も `package.nls.*.json` も見られない（本家 1.146.0 の `src/vs/workbench/api/common/extHostLocalizationService.ts` の `getBundleLocation`）。

- 直し方（2026-11-14）: `package.json` の `contributes.localizations` に、`ja` の言語で自分の ID `shuko.notion-sync` を指す翻訳の項目を書き、`build.mjs` が空の束 `dist/i18n/shuko.notion-sync.ja.i18n.json`（`{"version":"1.0.0","contents":{"package":{},"bundle":{}}}`）を作る。
- 効く仕組み: 共有のプロセスが起動のたびに、入っている全部の拡張（組み込みを含む）の `contributes.localizations` から言語パックの一覧（ユーザーのデータの `languagepacks.json`）を作り直し、同じ言語の項目を1つにまとめる（`src/vs/platform/languagePacks/node/languagePacks.ts` の `update`・`createLanguagePacksFromExtension`、`src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts`）。台帳の日本語の言語パックに、この拡張の翻訳の場所が足される。
- 拡張は `vscode.l10n` も manifest の `%キー%` も使わないので、束は空でよい。表示の文字列は日本語で書いてある。
- `build.mjs` は、項目の形（本体の `isValidLocalization` と同じ条件）、自分の ID の項目があること、`path` が `dist/` の下であること（`apply.mjs` が写すのは `dist/` と `media/` だけ）、束が `contents.bundle` を持つことを確かめ、外れていれば止める（`builtin-l10n.mjs`）。
- 副作用: 言語パックの一覧の `ja` の `extensions` にこの拡張が加わり、一覧の hash（翻訳のキャッシュ `clp/` の名前）が変わる。台帳の言語パックが無いときは、本体の翻訳（ID `vscode`）が無いので表示は英語のまま（`src/vs/base/node/nls.ts` の `resolveNLSConfiguration`）。
- `ja` 以外の言語にすると、また出る（裁定で表示は日本語。ほかの言語の項目は足していない）。

## 依存

| 名前 | 版 | 種類 | 許諾 | 理由 |
|---|---|---|---|---|
| jsonc-parser | 3.3.1 | 実行時（dist に入る。`package.json` では `devDependencies`） | MIT | settings.json（JSONC）のキーを、コメントと並びを保って足し引きする（docs/05 の5節） |
| esbuild | 0.28.2 | ビルド | MIT | src を dist/extension.js の1ファイルにまとめる（docs/05 の9節） |
| typescript | 7.0.2 | ビルド | Apache-2.0 | 型検査（出力はしない） |
| @types/vscode | 1.146.0 | ビルド | MIT | 拡張 API の型（engines.vscode と同じ版） |
| @types/node | 24.19.2 | ビルド | MIT | Node.js の型（拡張ホストの Node.js 24 系） |

## フォルダ

- `src/`: 拡張のソース。`extension.mts` だけが vscode に依存し、ほかは Node.js で直接読める純粋な部品（テストの入口）。
- `dev/`: 差し替え用の Notion（`fake-notion.mts`）と試し（`trial.mts`）。dist には入らない。
- `builtin-l10n.mjs`: 組み込みの翻訳の束を作る・確かめる部品（`build.mjs` が使う。dist には入らない）。
- `test/`: テスト（曹参が書く）。

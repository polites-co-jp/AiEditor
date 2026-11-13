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
pnpm --dir extensions-src/notion-sync run build            # 型検査 → dist/extension.js → 読み込みの確かめ
pnpm --dir extensions-src/notion-sync run build --trial    # 加えて、差し替えた Notion で同期の流れを試す
```

- 本体の道具（Build Tools・node-gyp）は要らない。Node.js 24.16.0 と pnpm 11.8.0 で確かめた。
- このフォルダは独立した pnpm の作業場所（`pnpm-workspace.yaml`）。依存の install スクリプトは走らせない（`allowBuilds: esbuild: false`）。
- `apply.mjs` が作業ツリーの `extensions/notion-sync/` に写すのは `package.json`・`README.md`・`ThirdPartyNotices.txt`・`dist/` だけ。`dist/extension.js` が無ければ写さない。

## 依存

| 名前 | 版 | 種類 | 許諾 | 理由 |
|---|---|---|---|---|
| jsonc-parser | 3.3.1 | 実行時（dist に入る） | MIT | settings.json（JSONC）のキーを、コメントと並びを保って足し引きする（docs/05 の5節） |
| esbuild | 0.28.2 | ビルド | MIT | src を dist/extension.js の1ファイルにまとめる（docs/05 の9節） |
| typescript | 7.0.2 | ビルド | Apache-2.0 | 型検査（出力はしない） |
| @types/vscode | 1.146.0 | ビルド | MIT | 拡張 API の型（engines.vscode と同じ版） |
| @types/node | 24.19.2 | ビルド | MIT | Node.js の型（拡張ホストの Node.js 24 系） |

## フォルダ

- `src/`: 拡張のソース。`extension.mts` だけが vscode に依存し、ほかは Node.js で直接読める純粋な部品（テストの入口）。
- `dev/`: 差し替え用の Notion（`fake-notion.mts`）と試し（`trial.mts`）。dist には入らない。
- `test/`: テスト（曹参が書く）。

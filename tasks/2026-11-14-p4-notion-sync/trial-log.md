# notion-sync の試しの記録（2026-11-14）

環境: Windows 11、Node.js v24.16.0、pnpm 11.8.0。本物の Notion には接続していない（トークンもページもまだ無い）。

## 1. 依存の導入

```
pnpm --dir extensions-src/notion-sync install
```

- 結果: 成功（31 秒）。`Packages: +8`。jsonc-parser 3.3.1、@types/node 24.19.2、@types/vscode 1.146.0、esbuild 0.28.2、typescript 7.0.2。
- 依存の install スクリプトの警告・誤りは出なかった。esbuild の postinstall は `pnpm-workspace.yaml` の `allowBuilds: esbuild: false` で走らない。
- `extensions-src/notion-sync/pnpm-workspace.yaml` を置いたので、リポジトリ直下の作業場所とは別になった。直下の `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml` は変わっていない（`git status --short` で確かめた）。

## 2. ビルド

```
pnpm --dir extensions-src/notion-sync run build
```

- 型検査（typescript 7.0.2 の `tsc -p tsconfig.json`、`noEmit`・`strict`・`erasableSyntaxOnly`・`verbatimModuleSyntax`）: 誤りなし。
- esbuild: `dist/extension.js` 99,998 バイト（CJS、`target: node22`、`external: vscode`、jsonc-parser は `module` の側（ESM）を使う）。入力は src の 10 個と jsonc-parser の ESM の 6 個（第三者のコードは jsonc-parser だけ）。
- 読み込みの確かめ: `vscode` を空のものに差し替えて `require` し、`activate`・`deactivate` が関数として出ていることを確かめた。
- 本体の道具（Build Tools・node-gyp・Python）は使っていない。今の Node.js 24.16.0 で動いた。
- 最初の版では esbuild が「`default` はいつも undefined」の警告を出した（jsonc-parser の CJS と ESM の両方から読めるようにした行）。`Reflect.get` に変えて消えた。

## 3. 試し（差し替えた Notion で同期の流れ）

```
pnpm --dir extensions-src/notion-sync run build --trial
```

`dev/trial.mts` が、差し替えた Notion（`dev/fake-notion.mts`。fetch の形で Notion の5つの道を真似る。上限を超えれば 400 を返す）と、手元2台（PC-A・PC-B のメモリの置き場所）と、本物のファイル（`C:\b\notion-sync-trial\User`）で流れを動かした。Notion の呼び出しは本物の `createNotionClient` を通した（ページ送りを試すため、差し替えの Notion は1回に3ブロックしか返さない）。時計と待ちは差し替え、実際には待たない。

結果: 48 項目すべて期待どおり（最後の行「試し: すべて期待どおり」）。

| 流れ | 中身 | 結果 |
|---|---|---|
| 部品 | 2000 文字の境目での分割（サロゲートペアを切らない、4000→2、4001→3、200,000→100、200,001→例外）、競合の3通りと converged、ignoredSettings（除く・足す・手元に無いキーは入れない） | OK |
| 1 | PC-A が空のページへ初めて書き出す | rev 1、3 ファイル。先頭が manifest。Notion の settings.json に PC ごとのキーが無い。4500 字超の settings.json は rich_text 3 要素 |
| 2 | PC-B（手元に PC ごとのキーだけの settings.json）が初めて同期 | settings.json は競合、ほか2つは取り込み。ページ送りをたどって8ブロックを読んだ |
| 2b | PC-B が「Notion を採る」 | A の値＋B の PC ごとの値（Git Bash）。改行は CRLF のまま |
| 3 | PC-B が keybindings を直して export | rev 2。もう1回 export すると Notion を呼ばない（`contacted: false`） |
| 4 | PC-A が起動（both） | keybindings を取り込む |
| 5 | 両方が settings.json を別々に直し、B が先に書き出す | A は競合。A の手元は書き換えない |
| 5b | PC-A が「手元を採る」→ PC-B が同期 | A が rev 4 で書き出し、B が取り込む。B の PC ごとの値は残る |
| 6 | Notion で snippets/python.json を手で直す（manifest はそのまま） | 「Notion だけが変わった」として取り込み、警告「manifest と合わない」 |
| 7 | 書き出す直前にほかの PC が manifest の rev を上げる | `rev 4 → 5` を見つけ、読み直してやり直し、rev 6 で書き出す |
| 8 | 429（`Retry-After: 2`）を1回返す | 2000ms 待ってやり直し、書き出せた。流れ7の書き出しで manifest が手での直しに合わせ直され、警告が消えた |
| 9 | PC-A で snippets を消す → PC-B が同期 | Notion の見出しとコードを消し（DELETE 2回）、B の手元からも消えた |
| 10 | 200,108 文字の snippets | `error`（「本文が長すぎる」）。PATCH・DELETE を1回も送っていない |
| 11 | 構文の誤りのある keybindings.json | `skipped` に入り、書き出さない |
| 12 | fetch が失敗する | `status: offline` |
| 13 | 違うトークン | 401 の `NotionApiError`。エラーの文・ログ・基底のどれにもトークンが無い |
| 14 | 差分を見る（`readDiffs`） | 違う2ファイル（keybindings.json・tasks.json）を返す。何も書かない |
| 15 | 呼び出しの間隔 | 350ms の待ちを 73 回入れた（平均 3 回/秒を超えない） |
| 16 | 本物のファイル（`userDirFileStore`・`fileBaseStore`） | 取り込み、PC ごとの値（cmd）を保つ。一時ファイルが残らない。`globalStorage/shuko.notion-sync/sync-base.json` ができる。`snippets/../../evil.json` は書かない。globalStorage の2つ上が User |

## 4. 試しで最後にできたもの

manifest（rev 8）:

```json
{
  "schema": 1,
  "rev": 8,
  "files": {
    "settings.json": { "sha256": "7b98b3c2b8587ba660154d3e949869858a99eecd76afc0955f7d6b2366d7cd0d", "updatedAt": "2026-11-14T09:00:11Z", "machine": "PC-A" },
    "keybindings.json": { "sha256": "40bab49156d3a874b62843f33c02cf6b28183b51bdf121ab307516c9ba6d80f0", "updatedAt": "2026-11-14T09:00:04Z", "machine": "PC-B" },
    "tasks.json": { "sha256": "cf3e21eec6c47758add96ac7f35537e63be417119eb456e6ca6ce15276d4d694", "updatedAt": "2026-11-14T09:00:21Z", "machine": "PC-A" }
  }
}
```

PC-A の基底（`sync-base.json`）:

```json
{"schema":1,"pageId":"0123abcd-0123-4abc-8def-0123456789ab","rev":8,"files":{"settings.json":{"local":"7b98…cd0d","remote":"7b98…cd0d"},"keybindings.json":{"local":"40ba…80f0","remote":"40ba…80f0"},"tasks.json":{"local":"cf3e…d694","remote":"cf3e…d694"}},"syncedAt":"2026-11-14T09:00:24.400Z"}
```

Notion への呼び出しは全部で 79 回（GET 63、PATCH 14、DELETE 2）。同期の部品が出したログ（抜粋）:

```
[PC-A] ページに manifest を作った
[PC-A] 書き出し: settings.json
[PC-A] manifest を rev 1 にした
[PC-B] 取り込み: keybindings.json
…
[PC-A] manifest の rev が読んだときの 4 から 5 に変わった（ほかの PC が書いた）。読み直してやり直す
[PC-A] 書き出し: snippets/python.json を Notion から消した（手元に無い）
[PC-B] 取り込み: snippets/python.json を手元から消した（Notion に無い）
[PC-A] 同期に失敗: snippets/big.json: 本文が長すぎる（200108 文字。1ファイル 200000 文字まで）
[PC-A] 同期に失敗: Notion に接続できない（GET /blocks/…/children?page_size=100）: fetch failed
```

## 5. 試していないこと

- エディタの中での動き（ステータスバー、差分ビュー、QuickPick、SecretStorage、FileSystemWatcher、5 秒の待ち）。拡張ホストで動かすには Shuko のビルド（または本家）に入れて起動する必要がある。docs/07 の Phase 4 の1（2台目の PC での3通り）で確かめる。
- 本物の Notion。Notion がコードブロックの本文を変えずに返すか（末尾の改行、タブ、CRLF）は未確認。比べるときは正規の形（LF・末尾の空白なし）にそろえているので、改行の違いと末尾の違いでは差にならない。ほかの変え方をされたら、1回だけ「Notion が変わった」として取り込まれ、その後は落ち着く。
- 拡張ホストの `fetch`（Electron 43 の Node.js）と、プロキシの扱い。

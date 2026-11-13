# 05 設定の同期（Notion）

## 1. 方針

- 裁定: Notion に設定ページを作り、そこを同期先にする。本家の Settings Sync は使わない（本家は "Custom backends are not supported." [一次] https://code.visualstudio.com/docs/configure/settings-sync 。C-6 でコードも消す）。
- 自前の組み込み拡張 `notion-sync` が、エディタの中で Notion API を呼んで読み書きする。起動と保存に合わせて動くこと、競合を差分ビューで見せること、トークンを OS の保護の仕組みで守ることができるのは、エディタの中の拡張だけだから。
- 新しいフォルダなので、本家との衝突は無い。ビルドリポジトリの `extensions-src/notion-sync/` で先にビルドし、`extensions/notion-sync/` に写す（[02](02-repository-and-build.md) の4.1）。

## 2. 同期するもの・しないもの

| 対象 | 同期 | 理由 |
|---|---|---|
| ユーザーの `settings.json` | する | `notionSync.ignoredSettings` のキーを除く（5節） |
| ユーザーの `keybindings.json` | する | 個人の上書きだけ（Sublime のキーは `mydist` が持つ） |
| ユーザーの `snippets/*.json`・`*.code-snippets` | する | ファイルごと |
| ユーザーの `tasks.json` | する | — |
| 拡張の構成 | しない | 台帳（`extensions.lock.json`）で固定。どの PC でも台帳から入れる |
| UI の状態・globalState・秘密 | しない | PC ごと |
| ワークスペースの設定（`.vscode/`） | しない | 各リポジトリにある |
| PC ごとの設定 | しない | `notionSync.ignoredSettings` に列挙する。書き出すときに除き、取り込むときは手元の値を保つ |

ユーザーのデータの場所は、拡張の `context.globalStorageUri`（`.../User/globalStorage/<拡張の ID>`）の2つ上を `User` フォルダとして求める（推定。Phase 4 で確かめる）。

## 3. Notion のページの形

設定ページ1枚。中身は次の順に並べる。

```
（ページの題名）Shuko の設定
  見出し2  manifest
  コード（json）  {"schema":1,"rev":42,"files":{"settings.json":{"sha256":"...","updatedAt":"2026-11-12T09:00:00Z","machine":"DESKTOP-A"}, ...}}
  見出し2  settings.json
  コード（json）  ファイルの本文
  見出し2  keybindings.json
  コード（json）  ...
  見出し2  snippets/python.json
  コード（json）  ...
  見出し2  tasks.json
  コード（json）  ...
```

- **manifest のブロック**: 各ファイルの内容の SHA-256、更新日時、書き出した PC の名前（`os.hostname()`）、ページ全体の版の番号 `rev`。同期の判断はこのブロックで行う。
- **本文の分け方**: Notion の rich_text の1要素は 2000 文字まで、1つのブロックの rich_text の配列は 100 要素まで [一次] https://developers.notion.com/reference/request-limits 。本文を 2000 文字ごとに分けて1つのコードブロックの rich_text の配列に入れる。1ファイル 200,000 文字までになる。超えたら書き出さず、エラーにする。
- コードブロックの言語に `json` が使える [一次・要照合] https://developers.notion.com/reference/block 。
- 見出しの文字列（`settings.json` など）でファイルを見つける。ブロックの ID は手元にも覚えておき、見つからなければ見出しで探し直す。
- ユーザーが Notion で本文を手で直してもよい。次の取り込みで「Notion だけが変わった」として扱う（manifest の sha256 と本文が合わないことで気づく）。

## 4. いつ取り込み、いつ書き出すか

| きっかけ | 動き |
|---|---|
| 起動（`onStartupFinished`） | Notion の manifest を読み、取り込みが要るかを確かめる（6節） |
| 対象のファイルの保存 | 5秒待ってまとめ、書き出す |
| コマンド「Notion 同期: 取り込む」「書き出す」「差分を見る」 | 手動で行う |
| ネットワークが使えない | ステータスバーに「未同期」を出し、次のきっかけでやり直す |

書き出しの順: 変わったファイルのコードブロックを書き換える（`PATCH /v1/blocks/{id}`）→ 最後に manifest を書き換える。manifest が「書き終わった」印になる。

## 5. PC ごとの設定

- 設定 `notionSync.ignoredSettings`（文字列の配列。例 `["terminal.integrated.defaultProfile.windows", "python.pythonPath"]`）に挙げたキーは、書き出すときに除き、取り込むときは手元の値を残す。
- `settings.json` はコメントを含む JSON（JSONC）なので、手で文字列を組み立てない。`jsonc-parser`（MIT、Microsoft）の編集の関数でキーを足し引きし、コメントと並びを保つ。

## 6. 競合の扱い

手元に「前回同期した内容」の SHA-256（基底）と、そのときの `rev` を持つ（拡張の globalStorage の `sync-base.json`）。

| 手元 | Notion | 動き |
|---|---|---|
| 変わった | 変わっていない | 書き出す |
| 変わっていない | 変わった | 取り込む |
| 変わった | 変わった | **自動でマージしない**。差分ビューで手元と Notion を並べ、「手元を採る」「Notion を採る」「手で直して書き出す」から選ばせる |

- 書き出す直前に manifest を読み直し、`rev` が基底と違えば（ほかの PC が書いた）競合として扱う。書き出すときは `rev` を1つ上げる。
- ページの `last_edited_time` は使わない。分単位に丸められるかが公式に書かれていない（未確認）ので、自前の `rev` で判断する。
- 1人で使う前提なので、2台が同時に書く場合は扱わない（後から書いたほうが勝つ。次の起動で競合として見える）。

## 7. 資格情報

- **トークン**: 設定ページだけに接続した、専用の Notion の内部インテグレーション（internal integration）のトークンを使う。作るにはワークスペースのオーナーの権限が要る。ページの「…」→「Add connections」でそのインテグレーションを接続する [一次] https://developers.notion.com/docs/authorization 。
- **保管**: 拡張の SecretStorage（`context.secrets`）。Windows では Electron の safeStorage（DPAPI）で暗号化され、`state.vscdb`（SQLite）に保存される。OSS のビルドでも同じ経路の見込み（1.146.0 のソースに OSS 専用の分岐は見当たらない。全ソースは見ていない）[一次] `sources/research-vscode-source.md` の13節。暗号化が使えないときは保存されない（メモリだけ）ので、そのときは通知を出す。
- **入れ方**: コマンド「Notion 同期: トークンを設定」で入力する。settings.json には置かない（置くとそれ自体が同期されてしまう）。
- **ページの ID**: 秘密ではないので設定 `notionSync.pageId` に置く（同期されてよい）。
- 裁定: Notion のインテグレーションは2つに分ける。設定の同期用は設定ページだけ、更新の検知用（[06](06-update-watch-and-take-in.md)）は ToDo データベースだけに接続する。トークンも別々に持つ。

## 8. API の使い方

- Notion-Version ヘッダは必須 [一次] https://developers.notion.com/reference/versioning 。`2025-09-03` を使う（更新の検知と同じ版）。
- レート制限: 平均 3 回/秒（Business・Enterprise 以外）。超えると 429 と `Retry-After`（秒）が返るので、それに従って待つ。529 も同じに扱う [一次] https://developers.notion.com/reference/request-limits 。
- 1回の書き換えで送るのは、変わったファイルのブロックと manifest だけ。1リクエストは 500KB・1000 ブロック要素まで（同ページ）。
- 外向きの接続先は `api.notion.com` だけ。外向き通信の監査で、許した宛先として扱う。

## 9. 拡張の設計の大枠

- 起動: `onStartupFinished`。`main` は `dist/extension.js`（esbuild で1ファイルにまとめる）。
- 設定: `notionSync.pageId`、`notionSync.ignoredSettings`、`notionSync.enabled`（既定 false。トークンとページを設定したら true にする）。
- コマンド: 取り込む、書き出す、差分を見る、トークンを設定、トークンを消す。
- 状態: ステータスバーに「同期済み」「未同期」「競合あり」。
- メモリ: Claude Code などと同じ拡張ホストで動く小さな拡張（推定で小さい）。
- テスト: Notion API の呼び出しを差し替えられるようにし、競合の3通り、分割（2000 文字の境目）、ignoredSettings の保ち方、429 の再試行を単体テストにする。

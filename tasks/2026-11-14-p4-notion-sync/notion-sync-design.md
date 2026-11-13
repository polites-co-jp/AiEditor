# notion-sync の設計（部品・関数の入出力・ページの形・依存）

対象: `extensions-src/notion-sync/`（docs/05 の全体、docs/02 の2節・4.1）。

## 1. フォルダの中身

| パス | 中身 | dist に入るか |
|---|---|---|
| `package.json` | 拡張の宣言。`main: ./dist/extension.js`、`activationEvents: ["onStartupFinished"]`、設定3つ、コマンド5つ、`scripts.build` | 写す |
| `README.md`・`ThirdPartyNotices.txt` | 説明と、dist に入る jsonc-parser の MIT の表示 | 写す |
| `dist/extension.js` | esbuild で1つにまとめたもの（約 100KB、CJS） | 写す |
| `src/*.mts` | ソース。`extension.mts` だけが vscode に依存する | 写さない |
| `dev/fake-notion.mts`・`dev/trial.mts` | 差し替え用の Notion と試し | 写さない |
| `build.mjs` | 型検査 → まとめ → 読み込みの確かめ（`--trial` で試しも） | 写さない |
| `tsconfig.json` | 型検査だけ（`noEmit`） | 写さない |
| `pnpm-workspace.yaml`・`pnpm-lock.yaml` | このフォルダを独立した pnpm の作業場所にする。`allowBuilds: esbuild: false` | 写さない |

`apply.mjs` が写すのは `package.json`・`README.md`・`ThirdPartyNotices.txt`・`LICENSE*`・`dist/`・`media/` だけ（`scripts/apply.mjs` の `EXT_FILES`・`EXT_DIRS`）。

## 2. 宣言（package.json）

- ID は `shuko.notion-sync`（publisher `shuko`、name `notion-sync`）。`engines.vscode` は `^1.146.0`（mydist と同じ）。
- 設定（どれも `scope: application`）

| キー | 型・既定 | 意味 |
|---|---|---|
| `notionSync.enabled` | boolean・false | 同期を行う。トークンとページを設定したら true にする |
| `notionSync.pageId` | string・"" | ページの ID。32 桁・ハイフン付き・ページの URL のどれでもよい（`normalizePageId`） |
| `notionSync.ignoredSettings` | string[]・[] | PC ごとの設定のキー（settings.json の最上位のキー） |

- コマンド（カテゴリ「Notion 同期」）: `notionSync.import`（取り込む）、`notionSync.export`（書き出す）、`notionSync.showDiff`（差分を見る）、`notionSync.setToken`（トークンを設定）、`notionSync.clearToken`（トークンを消す）。

## 3. ページの形（例）

ページの子のブロックを上から読む。見出し（書くときは見出し2。読むときは1〜3 のどれでもよい）の文字列が `manifest` か同期の対象の名前なら、直後のコードブロックを本文とする。

```
見出し2  manifest
コード（json）
  {
    "schema": 1,
    "rev": 8,
    "files": {
      "settings.json":    { "sha256": "7b98b3c2…cd0d", "updatedAt": "2026-11-14T09:00:11Z", "machine": "PC-A" },
      "keybindings.json": { "sha256": "40bab491…80f0", "updatedAt": "2026-11-14T09:00:04Z", "machine": "PC-B" },
      "tasks.json":       { "sha256": "cf3e21ee…d694", "updatedAt": "2026-11-14T09:00:21Z", "machine": "PC-A" }
    }
  }
見出し2  settings.json
コード（json）  rich_text[0..n]（本文を 2000 文字ごとに分けたもの。PC ごとのキーは除いてある）
見出し2  keybindings.json
コード（json）  ...
見出し2  snippets/python.json
コード（json）  ...
見出し2  tasks.json
コード（json）  ...
```

- 空のページに初めて書き出すとき、先に manifest（`rev: 0`、`files: {}`）を足し、次にファイルの見出しとコードを足し、最後に manifest を書き換える（manifest が「書き終わった」印になる順を、初めてのときにも守る）。新しいファイルはページの末尾に足す。
- 本文は正規の形（BOM なし、改行は LF、末尾の空白と改行なし）で送る。sha256 はこの形のもの。
- manifest の JSON は字下げして書く（Notion で人が読めるように）。files は settings → keybindings → snippets（名前順）→ tasks の順。
- 試しで実際にできた manifest は `trial-log.md` の4節。

## 4. 同期の流れ

1回の同期（`runSync`）は次の順に動く。

1. 手元を読む。JSONC の構文の誤りがあるファイルは扱わない（`skipped`）。settings.json は `ignoredSettings` を除いた「共有する形」にする。
2. export のときは、手元が基底から変わっていなければ、Notion を呼ばずに終える（保存のたびに Notion を呼ばない。取り込みで書いたファイルの監視の通知もここで止まる）。
3. ページの子のブロックを全部（ページ送りをたどって）読む。manifest が読めなければ止める（`error`）。
4. ファイルごとに判断する（下の表）。手での選択（`force`）があればそれに従う。
5. 書き出すものが上限（200,000 文字）を超えないかを、何かを書く前に確かめる。超えたら何も書かずに `error`。
6. 取り込み: 手元に書く（settings.json は手元の PC ごとの値を足す。改行は手元のファイルの形、新しいファイルは CRLF）。基底を保存する。
7. 書き出し: manifest を読み直し、`rev` が手順3で読んだものと違えば、最初から1回だけやり直す。→ 変わったファイルのコードブロックを書き換え・足し・消し → 最後に manifest を書き換える（`rev` を1つ上げる）。→ 基底を保存する。

判断（`decide`。基底はファイルごとに「手元の側の sha256」と「Notion の側の sha256」の2つを持つ。無いことも状態の1つ）

| 手元（基底の local と比べて） | Notion（基底の remote と比べて） | 判断 | 動き |
|---|---|---|---|
| 同じ | 同じ | none | 何もしない |
| 変わった | 同じ | export | 書き出す（手元で消えていれば Notion の見出しとコードを消す） |
| 同じ | 変わった | import | 取り込む（Notion で消えていれば手元のファイルを消す） |
| 変わった | 変わった・同じ中身 | converged | 基底を今の値にそろえるだけ |
| 変わった | 変わった・違う中身 | conflict | 自動でマージしない。基底を動かさず `conflicts` に入れる |

- 基底が無い（初めて・ページを変えた）ときは、両側とも「無かった」とみなす。両方にあって中身が違えば競合になる（2台目の PC の初めての同期は、settings.json が競合として見えることが多い。「Notion を採る」で解く）。
- Notion で手で直された本文は、本文の sha256 が基底の remote と違うので「Notion が変わった」になる。manifest の sha256 と合わないときは警告を出し、次の書き出しで manifest の sha256 を本文に合わせ直す（updatedAt と machine は前のまま）。

きっかけ（`extension.mts`）

| きっかけ | 呼び方 |
|---|---|
| 起動（onStartupFinished）、`notionSync.enabled` を true にしたとき、トークンを入れ直したとき | `runSync(mode: "both")` |
| User フォルダの対象のファイルの変更・作成・削除（FileSystemWatcher）と保存（onDidSaveTextDocument） | 5 秒待ってまとめ、`runSync(mode: "export")` |
| コマンド「取り込む」「書き出す」 | `runSync(mode: "import")`・`runSync(mode: "export")` |
| 「差分を見る」→「手元を採る」「Notion を採る」「手で直して書き出す」 | `runSync(mode: "both", force: { <名前>: "local" | "remote" })` |

- 同期は1つずつ走らせる（走っている間のきっかけは後ろに並べる）。
- ステータスバー: 「同期済み」「未同期」（つながらない、トークンやページが無い、片方向だけ行って残りがある）「競合あり」と、走っている間の「同期中」。`notionSync.enabled` が false なら出さない。
- 差分ビューは、左が「Notion を採ったら手元がこうなる」中身（`notion-sync:` の読み取り専用の文書。settings.json は手元の PC ごとの値を足した形）、右が手元のファイル（直せる）。
- トークンは `context.secrets` のキー `notionSync.token` にだけ置く。出力パネル「Notion 同期」のログ、エラーの文、`sync-base.json` には書かない（試しで確かめた。`trial-log.md` の流れ13）。

## 5. 部品と関数の入出力（テストの入口）

すべて `extensions-src/notion-sync/src/` の .mts。`extension.mts` 以外は vscode に依存せず、Node.js 24.16 の型の除去で直接 import できる（例 `import { decide } from "../src/decide.mts"`）。

### text.mts（分割・正規化・ハッシュ）

| 関数 | 入力 → 出力 | 期待 |
|---|---|---|
| `canonicalize(text)` | string → string | 先頭の BOM を外し、CRLF・CR を LF に、末尾の空白と改行を落とす |
| `hashText(text)` | string → 64 桁の16進 | `canonicalize` した形の SHA-256。CRLF と LF、末尾の改行の有無で同じ値 |
| `splitText(text, max = 2000)` | string → string[] | 各要素は max 以下。上位サロゲートで終わる位置では1つ手前で切る（`"a"*1999 + "😀" + "b"*10` → 長さ `[1999, 12]`）。`"x"*4000` → 2 要素、4001 → 3 要素、空文字 → `[]`。max が2未満・整数でなければ RangeError |
| `toRichText(text)` | string → `{type:"text",text:{content}}[]` | canonicalize してから分ける。100 要素を超えれば `TooLargeError`（`chars`・`items` を持つ）。200,000 文字 → 100 要素、200,001 文字 → 例外 |
| `fromRichText(items)` | unknown → string | `plain_text` を優先、無ければ `text.content` をつなぐ。配列でなければ "" |
| `detectEol(text)` | string | null → `"\r\n"` | `"\n"` | null | CRLF が1つでもあれば CRLF |
| `toLocalText(canonical, eol)` | → string | 改行を eol にし、末尾に eol を1つ付ける（空なら ""） |
| 定数 | `RICH_TEXT_MAX_CHARS = 2000`、`RICH_TEXT_MAX_ITEMS = 100`、`FILE_MAX_CHARS = 200000` | |

### decide.mts（競合の3通り）

| 関数 | 入力 → 出力 | 期待 |
|---|---|---|
| `decide(local, remote, base)` | sha256 か null ×2、`{local, remote}` か undefined → `"none" | "export" | "import" | "conflict" | "converged"` | 4節の表。`decide("L2","R1",{local:"L1",remote:"R1"})` → export、`("L1","R2",…)` → import、`("L2","R2",…)` → conflict、`("X","X",…)` → converged、base undefined で `("A",null)` → export、`(null,"B")` → import、`("A","B")` → conflict |
| `decideAll(localMap, remoteMap, baseFiles)` | Map・Map・Record → `{name, decision, local, remote}[]` | 3つのどれかにある名前ごと。両方 null の名前は出さない |

### settings-filter.mts（ignoredSettings の保ち方）

| 関数 | 入力 → 出力 | 期待 |
|---|---|---|
| `stripIgnored(text, keys)` | JSONC・string[] → canonical | 最上位の keys を除く。コメントと並びは残る。同じキーが2回あれば両方除く。keys が空なら canonicalize だけ |
| `mergeIgnored(remoteText, localText, keys)` | → canonical | Notion の本文から keys を除き、手元にある keys の値を足す。手元に無いキーは Notion にあっても入れない。localText が null なら除くだけ。Notion が空なら `{}` から作る |
| `pickIgnored(text, keys)` | → `{key, value}[]` | 最上位にある keys の値（keys の順） |
| `jsoncErrors(text)` | → ParseError[] | 末尾のカンマとコメントは誤りにしない |
| `normalizeIgnoredKeys(value)` | unknown → string[] | 文字列だけ、空文字と重複を除く。配列でなければ [] |
| `detectFormatting(text)` | → FormattingOptions | 最初の字下げがタブならタブ、空白ならその数、無ければ空白4つ |

例（試しで確かめたもの）: 手元 `{ // 手元のコメント, "editor.fontSize": 14, "terminal.integrated.defaultProfile.windows": "PowerShell", "files.eol": "\n" }` を `stripIgnored(…, ["terminal.integrated.defaultProfile.windows"])` → コメントが残り、そのキーだけ消える。Notion `{ "editor.fontSize": 16, "terminal…windows": "Git Bash" }` と手元を `mergeIgnored` → `{ "editor.fontSize": 16, "terminal…windows": "PowerShell" }`。

### manifest.mts

| 関数 | 期待 |
|---|---|
| `parseManifest(text)` | `{schema:1, rev:整数≥0, files}` を返す。JSON でない・schema が1でない・rev が負や小数・files がオブジェクトでない → `ManifestError`。files の中の対象でない名前（`../x.json` など）は捨てる |
| `serializeManifest(m)` | 字下げした JSON。files は並べる順 |
| `nextManifest(prev, {written, deleted, healed?}, machine, now)` | rev+1。written は `{sha256, updatedAt(秒まで・Z), machine}` に置き換え、deleted は除き、healed は sha256 だけ置き換え（無ければ updatedAt・machine を空文字で作る）。ほかは前のまま |
| `emptyManifest()` | `{schema:1, rev:0, files:{}}` |

### names.mts

| 関数 | 期待 |
|---|---|
| `isSyncableName(name)` | true: `settings.json`・`keybindings.json`・`tasks.json`・`snippets/<名前>.json`・`snippets/<名前>.code-snippets`。false: サブフォルダ、`\ / : * ? " < > |`・制御文字を含む、`.` で始まる・`.` か空白で終わる、`con`・`nul`・`com1` などの予約名、200 文字超、文字列でない |
| `normalizePageId(input)` | 32 桁・ハイフン付き・URL（クエリと `#` を含んでよい）→ 小文字のハイフン付き。読めなければ null |
| `compareNames(a, b)` | settings → keybindings → snippets（名前順）→ tasks |

### notion-client.mts（Notion API の呼び出し）

`createNotionClient({ token, fetch, sleep?, now?, maxRetries = 5, minIntervalMs = 350, baseUrl?, notionVersion = "2025-09-03" })` → `NotionApi`。

| メソッド | HTTP |
|---|---|
| `listChildren(blockId)` | `GET /v1/blocks/{id}/children?page_size=100[&start_cursor=]`。`has_more` の間たどり、全部を返す |
| `getBlock(blockId)` | `GET /v1/blocks/{id}` |
| `updateCode(blockId, richText, language = "json")` | `PATCH /v1/blocks/{id}`、本文 `{type:"code", code:{rich_text, language}}` |
| `appendChildren(parentId, children)` | `PATCH /v1/blocks/{id}/children`、本文 `{children}`（100 個を超えれば送らずに例外） |
| `deleteBlock(blockId)` | `DELETE /v1/blocks/{id}` |

- ヘッダ: `Authorization: Bearer <token>`、`Notion-Version: 2025-09-03`、本文があれば `Content-Type: application/json`。
- 429・529: `Retry-After`（秒）だけ待ってやり直す（上限 60 秒）。無ければ 1・2・4… 秒（上限 30 秒）。`maxRetries` 回を超えたら `NotionApiError`。
- 呼び出しの間は `minIntervalMs` 以上空ける（平均 3 回/秒）。
- 2xx 以外 → `NotionApiError`（`status`・`code`・`method`・`path`。文にトークンを入れない）。fetch の失敗 → `NetworkError`。本文が 500,000 バイトを超える → 送らずに `PayloadTooLargeError`。
- 純粋な関数: `retryDelayMs(retryAfter, attempt)`（`("2", 0)` → 2000、`(null, 0)` → 1000、`(null, 3)` → 8000、`("120", 0)` → 60000）、`chunkForAppend(groups)`（見出しとコードの組を離さず、100 個・要素 1000（rich_text の要素も数える）・500,000 バイトに収まるよう分ける）、`countElements(blocks)`。

### page.mts

| 関数 | 期待 |
|---|---|
| `parsePage(blocks)` | → `{manifest, manifestHeadingId, manifestCodeId, files: Map<名前, {headingId, codeId, text}>, warnings}`。見出しの直後がコードでなければ読み飛ばして警告。同じ名前の見出しが2つなら先を採って警告。対象でない見出しは無視。manifest が読めなければ `ManifestError` |
| `headingBlock(name)`・`codeBlock(text)` | 見出し2・コード（json）のブロック。`codeBlock` は長すぎれば `TooLargeError` |

### stores.mts

| 関数 | 期待 |
|---|---|
| `userDirFileStore(userDir)` | `list()`（対象の名前だけ）・`read(name)`（無ければ null）・`write(name, text)`（隣に `.notion-sync.tmp` を書いて置き換える。snippets フォルダが無ければ作る）・`remove(name)`（無くてもよい）。対象でない名前・User フォルダの外になる名前は例外 |
| `fileBaseStore(file)` | `load()`（無い・読めない・形が違う → null）・`save(state)` |
| `memoryFileStore(initial)`・`memoryBaseStore(initial)` | 同じ形のメモリの実装（テスト用） |
| `userDirFromGlobalStorage(path)` | 2つ上のフォルダ |

基底（`<globalStorage>/sync-base.json`）の形: `{"schema":1, "pageId":"…", "rev":8, "files":{"settings.json":{"local":"<sha256>","remote":"<sha256>"}}, "syncedAt":"…"}`。`pageId` が設定と違えば使わない。

### sync.mts（同期の流れ）

| 関数 | 期待 |
|---|---|
| `runSync(deps, {mode = "both", force})` | → `SyncResult`。例外にしない。`status`: synced・conflict・offline（`NetworkError`）・error（それ以外）。`RevChangedError` は1回だけ読み直してやり直す |
| `syncOnce(deps, opts)` | 1回分。失敗は例外 |
| `readDiffs(deps)` | 手元と Notion で違うファイルの `{name, local, remote, remoteAsLocal}[]`。何も書かない |
| `sharedForm(name, raw, ignored)`・`remoteAsLocal(name, remote, localRaw, ignored)` | settings.json だけ ignored を除く・足す。ほかは canonicalize |
| `hasLocalChanges(localHash, base)` | export の近道の判定 |

`SyncDeps` = `{ api, store, baseStore, pageId, ignoredSettings, machine, now, defaultEol, log? }`。
`SyncResult` = `{ status, rev, imported, exported, deletedLocal, deletedRemote, conflicts: {name, local, remote, remoteAsLocal}[], pending: {name, decision}[], skipped: {name, reason}[], warnings, contacted, error? }`。

### dev/fake-notion.mts（差し替え用の Notion）

`new FakeNotion({ token, pageId, pageSize? })`。`fake.fetch` を `createNotionClient` の `fetch` に渡す。5つの道だけを持ち、本物の上限（text.content 2000 文字、rich_text 100 要素、children 100 個）を超えれば 400 `validation_error`、トークンが違えば 401 を返す。`calls`（呼び出しの記録）、`snapshot()`（ページの並び）、`handEdit(name, text)`（Notion で手で直す）、`bumpManifestRev()`（ほかの PC が書いた）、`beforeRequest`（割り込み。`fakeResponse(429, …, {"Retry-After":"2"})` を返すなど）。

## 6. 依存

版はすべて固定（`package.json` に範囲を書かない。`pnpm-lock.yaml` あり）。install スクリプトは走らせない。

| 名前 | 版 | 種類 | 許諾 | install スクリプト | 理由 |
|---|---|---|---|---|---|
| jsonc-parser | 3.3.1 | 実行時（dist に入る） | MIT | なし | settings.json（JSONC）のキーを、コメントと並びを保って足し引きする（docs/05 の5節が名指ししている） |
| esbuild | 0.28.2 | ビルド | MIT | postinstall（`node install.js`）あり → `allowBuilds: esbuild: false` で止めた。止めても `@esbuild/win32-x64` のバイナリで動いた | 1ファイルにまとめる（docs/05 の9節） |
| typescript | 7.0.2 | ビルド | Apache-2.0 | なし（ネイティブのバイナリは `@typescript/typescript-win32-x64` の optionalDependencies） | 型検査だけ |
| @types/vscode | 1.146.0 | ビルド | MIT | なし | 拡張 API の型（`engines.vscode` と同じ版） |
| @types/node | 24.19.2 | ビルド | MIT | なし | Node.js の型（拡張ホストは Node.js 24 系） |

版は 2026-11-14 に npm のレジストリで確かめた最新（@types/node は 24 系の最新。`latest` は 26.6.6）。ビルドの道具は dist に入らない。dist に入る第三者のコードは jsonc-parser だけ（esbuild の入力の一覧で確かめた）。

## 7. 確かめた外部の事実と出典

- Notion の上限: rich_text の `text.content` は 2000 文字、ブロックの配列（rich_text を含む）は 100 要素、1リクエストは 1000 ブロック要素・500KB。429 の `Retry-After` は整数の秒（本文の `additional_data.retry_after` にも同じ値）。529 は 429 と同じに扱う。Business・Enterprise 以外は 180 回/分（平均 3 回/秒）。[一次] https://developers.notion.com/reference/request-limits （2026-11-14 に読んだ。文字の数え方と 500KB の単位は書かれていない）
- 末尾に足す: `PATCH /v1/blocks/{id}/children`、children は 100 個まで。`after` は廃止予定で `position` に置き換え（このコードはどちらも使わない。末尾に足すだけ）。[一次] https://developers.notion.com/reference/patch-block-children
- 書き換え: `PATCH /v1/blocks/{id}`、`code` は `rich_text`・`language`・`caption` だけ。「フィールドの値を丸ごと置き換える」。[一次] https://developers.notion.com/reference/update-a-block
- 子の一覧: `GET /v1/blocks/{id}/children`、`start_cursor`・`page_size`、応答は `results`・`has_more`・`next_cursor`。[一次] https://developers.notion.com/reference/get-block-children
- コードブロックの言語に `json` がある（docs/05 の「要照合」を照合した）。[一次] https://developers.notion.com/reference/block
- Notion の最新の版は `2026-03-11`（`after` → `position`、`archived` → `in_trash` など）。docs/05 の裁定どおり `2025-09-03` を使う。使う5つの道はこの違いに当たらない。[一次] https://developers.notion.com/docs/upgrade-guide-2026-03-11
- 拡張の globalStorageUri: 拡張ホストは既定のプロファイルの `globalStorageHome`（`<User>/globalStorage`）を受け取り、拡張の ID の小文字を足す。[一次] 1.146.0 の `src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts` 540 行、`src/vs/workbench/api/common/extHostStoragePaths.ts` 90 行、`src/vs/platform/userDataProfile/common/userDataProfile.ts` 196 行
- SecretStorage で暗号化が使えないとき: 本体（`NativeSecretStorageService.set`）が1回だけエラーの通知（"An OS keyring couldn't be identified …"）を出し、メモリに置く。拡張から暗号化の可否（`type`）は見えない。[一次] 1.146.0 の `src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts` 41〜71 行、`src/vs/platform/secrets/common/secrets.ts` 225〜239 行

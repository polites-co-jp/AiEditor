# p4-notion-sync の報告（蒙恬 → ヴラド・ツェペシュ）

## 結果

完了。完了条件の4つ（1 拡張の形とソースと build の script、2 差し替えられる API と純粋な部品、3 ビルドが通る、4 試しの記録）を満たした。エディタの中での動きと本物の Notion は未確認（5節）。

## 成果物

拡張（`extensions-src/notion-sync/`）

- `package.json`（`onStartupFinished`、`main: ./dist/extension.js`、設定3つ、コマンド5つ、`scripts.build`。依存は版を固定）
- `pnpm-workspace.yaml`（このフォルダを独立した作業場所にし、`allowBuilds: esbuild: false`）、`pnpm-lock.yaml`
- `tsconfig.json`、`build.mjs`
- `src/`: `text.mts`（分割・正規化・ハッシュ）、`decide.mts`（競合の判断）、`settings-filter.mts`（ignoredSettings）、`manifest.mts`、`names.mts`、`notion-client.mts`（Notion API。fetch・待ち・時計を差し替えられる）、`page.mts`（ページの形）、`stores.mts`（手元のファイルと基底）、`sync.mts`（同期の流れ）、`extension.mts`（vscode とつなぐだけ）
- `dev/fake-notion.mts`（差し替え用の Notion）、`dev/trial.mts`（試し）
- `dist/extension.js`（ビルドの出力、99,998 バイト）
- `README.md`、`ThirdPartyNotices.txt`（jsonc-parser の MIT）

タスク（`tasks/2026-11-14-p4-notion-sync/`）

- `notion-sync-design.md`: 部品と関数の入出力（テストの入口）、ページの形の例、同期の流れ、依存の一覧、確かめた外部の事実と出典
- `trial-log.md`: install・build・試しの記録
- `doc-corrections.md`: docs/ との食い違いと直す案（13項目）
- この `handoff-notes.md`

## 要点

- 同期の流れ（`runSync`）は vscode に依存しない。Notion API（fetch の形）・手元のファイル・基底・時計を差し替えられる。`extension.mts` はきっかけ・ステータスバー・差分ビュー・SecretStorage をつなぐだけ。
- 競合はファイルごとに判断する。基底は「手元の sha256」と「Notion の sha256」の2つを持つ（settings.json は取り込んだ後の手元と Notion の本文が同じ文字列にならないため）。rev は書き終わりの印と追い越しの検出に使う。
- install・build は Node.js 24.16.0・pnpm 11.8.0 で通った。本体の道具（Build Tools）は要らない。依存の install スクリプトは走らせていない。
- 差し替えた Notion と手元2台＋本物のファイルで、取り込み・書き出し・競合の3通り・手での直し・rev の追い越し・429・分割・上限・消したファイル・つながらないとき・トークンが漏れないことを、48 項目確かめた（すべて期待どおり）。
- トークンは `context.secrets`（キー `notionSync.token`）にだけ置く。ログ・エラーの文・`sync-base.json` に入らないことを試しで確かめた。

## 確かめたこと

- `pnpm --dir extensions-src/notion-sync install`: 成功（+8 パッケージ、install スクリプトの警告なし）。リポジトリ直下の `package.json`・`pnpm-lock.yaml` は変わっていない。
- `pnpm --dir extensions-src/notion-sync run build`: 型検査（typescript 7.0.2、strict）誤りなし → esbuild で `dist/extension.js` → `vscode` を差し替えて読み込み、`activate`・`deactivate` があることを確かめた。dist に入る第三者のコードは jsonc-parser（ESM の側）だけ。
- `pnpm --dir extensions-src/notion-sync run build --trial`: 48 項目すべて期待どおり（`trial-log.md` の3節）。
- 試しの実行について: 私の権限で拡張のコードを Node.js で動かせる入口は `pnpm --dir extensions-src/* run build` だけなので、`build.mjs` に `--trial` を付けたときだけ `dev/trial.mts` を動かすようにした。走るのはこのフォルダの中のコードだけで、外のファイルを実行する道は作っていない。この形でよいか、または試し用の許可（例 `pnpm --dir extensions-src/* run trial`）を足すかを判断してほしい。

## テストの入口（曹参へ）

- 置き場所: `extensions-src/notion-sync/test/`（私は書いていない）。`../src/<部品>.mts` と `../dev/fake-notion.mts` を直接 import できる（Node.js 24.16 の型の除去。src は消せる書き方だけで書いた。拡張子 `.mts` まで書く）。先に `pnpm --dir extensions-src/notion-sync install` が要る（jsonc-parser のため）。`extension.mts` は vscode に依存するので import しない。
- 実行: `node --test extensions-src/notion-sync/test/<ファイル>.test.mts`（ファイルを名指しするのが確実。ディレクトリ指定で .mts を拾うかは確かめていない）。
- docs/05 の9節のテストの対象と入口:
  - 競合の3通り: `decide(local, remote, base)`（`decide("L2","R1",{local:"L1",remote:"R1"})` → `"export"`、`("L1","R2",…)` → `"import"`、`("L2","R2",…)` → `"conflict"`、`("X","X",…)` → `"converged"`）。流れとしては `runSync` に `FakeNotion` と `memoryFileStore`・`memoryBaseStore` を2組渡す（`dev/trial.mts` の流れ2〜5 が手本）。
  - 2000 文字の境目での分割: `splitText`・`toRichText`（2000→1 要素、2001→2、4000→2、4001→3、サロゲートペアを切らない、200,000→100、200,001→`TooLargeError`）。`FakeNotion` は 2000 文字・100 要素を超えると 400 を返すので、`runSync` を通しても確かめられる。
  - ignoredSettings の保ち方: `stripIgnored`・`mergeIgnored`（コメントが残る、手元の値が残る、手元に無いキーは Notion から入れない、同じキーが2回でも両方除く）。流れとしては `runSync` の取り込みで書いた settings.json に手元の値が残ること。
  - 429 の再試行: `createNotionClient({ token, fetch: fake.fetch, sleep: 記録する関数, now: 進める時計 })` に、`fake.beforeRequest` で `fakeResponse(429, {...}, {"Retry-After":"2"})` を1回返させる → `sleep` に 2000 が渡り、2回目で成功。`maxRetries` を超えたら `NotionApiError`（status 429）。529 も同じ。`retryDelayMs` は純粋な関数。
- ほかに試すとよいもの: `normalizePageId`（URL・32 桁・ハイフン付き・読めないもの）、`isSyncableName`（`snippets/../x.json`・`con.json`・サブフォルダを拒む）、`parseManifest`（形の違いで `ManifestError`）、`parsePage`（見出しの直後がコードでない・重複）、`chunkForAppend`（100 個・要素 1000・500,000 バイト）、`userDirFileStore`（User の外に書かない、一時ファイルを残さない）、`runSync` の `mode: "export"` で手元が変わっていなければ `contacted: false`、トークンがエラーの文に入らないこと。
- 期待する出力の形は `notion-sync-design.md` の5節。

## docs/ との食い違い

`doc-corrections.md` に13項目。主なもの:

- docs/05 の2節: User フォルダの求め方は推定でなく、本家のソースで確かめた（既定のプロファイルの User）。
- docs/05 の6節: 基底はファイルごとに2つの sha256。rev は「基底」ではなく「この同期で読んだときの rev」と比べ、違えば読み直す（基底の rev と比べると、ほかの PC が何を書いても全部が競合になる）。
- docs/05 の3節: ブロックの ID は覚えず、毎回ページを全部読んで見出しで探す。比べる形（LF・末尾の空白なし）を足す。
- docs/05 の7節: 暗号化が使えないときの通知は本体が出す（拡張からは見えない）。
- docs/05 に無いもの: 消したファイルを両方向に伝える、初めての同期で違えば競合、構文の誤りのあるファイルは扱わない、ignoredSettings は最上位のキーだけ。

## 未解決の点

1. **dist をリポジトリに入れるか**（リーダーの判断）。`apply.mjs` は dist が無ければ写さない。入れないなら、ビルドの手順（docs/02 の4.1、または `build.mjs`）に notion-sync の install と build を足す必要がある。`.gitignore` は触っていない。
2. **`notionSync.enabled` も同期される**。settings.json に書かれるので、トークンを入れていない PC でも true になり、起動のたびに「トークンが無い」の通知が1回出る（ステータスバーは「未同期」）。`notionSync.enabled` を、ignoredSettings に関係なくいつも PC ごとの設定として扱う案がある（docs/05 に無いので判断を仰ぐ）。
3. **消したファイルを両方向に伝える**のは docs/05 に無い動き（doc-corrections の7）。伝えない案にするなら直す。
4. エディタの中での確かめ（ステータスバー、差分ビュー、QuickPick、SecretStorage、ファイルの監視と 5 秒の待ち、拡張ホストの fetch）と、本物の Notion での確かめ（本文を変えずに返すか、レート制限）は Phase 4 の1で行う。
5. 試しの実行の入口（上の「確かめたこと」の最後）。
6. 取り込みで書くファイルがエディタで開かれて未保存のとき、エディタ側で「ディスクの内容が変わった」の扱いになる。取り込みを後回しにする守りは入れていない（起動の直後と 5 秒の待ちの後なので、起きにくい見込み）。

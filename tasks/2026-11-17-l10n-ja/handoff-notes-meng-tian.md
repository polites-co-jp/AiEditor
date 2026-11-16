# 引き継ぎ（蒙恬 → 曹参・大岡越前守・リーダー）: 本体と同じ版の日本語パック

作り方の詳しい理由と調べの結果は [l10n-design.md](l10n-design.md)。ここには、変えたファイル、数え方と結果、テストの入口、ビルドと入れ替えで要ること、諮るべき点を書く。

## 1. 採った作り方（要点）

- **入れ方**: 組み込みの拡張 `shuko.language-pack-ja`（`extensions-src/language-pack-ja/`）にする。Open VSX の `MS-CEINTL.vscode-language-pack-ja` 1.131.0 は台帳と `extensions.allowed` から外す（置き換え）。
- **訳の元**: vscode-loc（MIT）の PR #2450 の head `e0407b9e`（2026-10-23。Microsoft の自動の書き出しで、main には未マージ）を先に読む。その次に main `62d5443b`、Open VSX の 1.131.0 の順で読む。commit とファイルごとの SHA-256 を `sources.json` に記録して固定した。
- **足した訳**: `added/1.146.0.json` に置く。鍵はモジュールと鍵（本体）か、拡張の ID と package・bundle の鍵。訳したときの英語（`en`）も残す。
- **除外**: `exclusions.json` に置き、項目ごとに理由を書く。
- **パック（dist）**: `sources.json` と `added/` だけから決まる。台本は `scripts/l10n-ja.mjs`、純粋な部品は `scripts/lib/l10n-ja.mjs`。

## 2. 変えたファイル

| ファイル | 変更 |
|---|---|
| `scripts/l10n-ja.mjs`（新） | fetch・extract・todo・add・build・count |
| `scripts/lib/l10n-ja.mjs`（新） | 純粋な部品（4節） |
| `extensions-src/language-pack-ja/`（新） | `package.json`・`README.md`・`ThirdPartyNotices.txt`・`sources.json`・`added/1.146.0.json`・`exclusions.json`・`dist/translations/`（`main.i18n.json` 3.65 MB と `extensions/*.i18n.json` 94 個） |
| `scripts/apply.mjs` | 自前の組み込み拡張に `language-pack-ja` を足した。`package.json` があるのに訳の束が無ければ止める（`StopError`）。新しい関数 `languagePackMissingFiles(dir)` |
| `scripts/build.mjs`・`scripts/lib/apply/classify.mjs` | `OWN_EXTENSIONS` に `language-pack-ja` を足した（後処理の「必須」には入れていない。理由は5節の注） |
| `builtin/keep.json` | `own` に `language-pack-ja` を足した |
| `extensions.lock.json` | `MS-CEINTL.vscode-language-pack-ja` を外した（8件から7件） |
| `product.overlay.json` | `extensions.allowed` から `MS-CEINTL.vscode-language-pack-ja` を外した |
| `scripts/install-extensions.mjs` | `RETIRED_EXTENSIONS`・`retiredNotes(extra)` を足した。置き換えた拡張が入っていれば、台帳に無い拡張として止めるときの文に説明を添える（消しはしない） |
| `extensions-src/mydist/package.json` | `displayName` を `Shuko defaults` から `Shuko の既定` にした（画面に出る英語） |
| `extensions-src/notion-sync/package.json` | `displayName` を `Shuko Notion Sync` から `Shuko Notion 同期` にした |
| `scripts/l10n-probe.mjs`（新） | 調べに使った読むだけの台本（ls・todo・dups・suggest・pair・audit・english・test・lpcheck）。成果物ではない。残すか消すかはリーダーが決める（私は消せない） |

`scripts/make-icons.mjs`・`scripts/copy-icon-sources.mjs`・`scripts/icon-src/`・`assets/` は、アイコンの仕事の担当分なので触っていない。

## 3. 数え方と結果（今の日常の版 1.146.0-p5-c-all-r4）

### 3.1 文言の表（`extract`）

- **本体**: `out/nls.keys.json`・`out/nls.messages.json` から、モジュールと鍵で引く（本家の `src/vs/base/node/nls.ts` と同じ引き方）。並びの数は 12,355 だが、同じモジュール・同じ鍵が2度出るものが21組ある（英語もすべて同じ）。そのため、モジュールと鍵の組では **12,334** になる。曹参の網は並びで数えるので 12,355 になる。
- **組み込み拡張の package**: 出力の `extensions/<名前>/package.nls.json`。1,258 件。
- **組み込み拡張の bundle**: `vscode.l10n.t` の文言。1,545 件。作業ツリー（`tmp/b/wt/r4`）の拡張のソース `{src,client,server}/**/*.ts` と、依存（package.json の dependencies のうち `@vscode/*`・`vscode-*`）の JS を、作業ツリーにある `@vscode/l10n-dev` 0.0.35 の `getL10nJson` に渡して読み出す（本家の `build/lib/i18n.ts` の `createL10nBundleForExtension` と同じ引き方）。1.146.0 では、依存が pnpm で `extensions/node_modules` に持ち上げられているので、そこも探す。
- **自前の組み込み拡張の直書き（literal）**: mydist・notion-sync・language-pack-ja は `%key%` を使わない。画面に出る文字列（displayName・description・コマンドの title と category・設定の title と description・localizedLanguageName）は 22 件ある。日本語の文字を含めば訳がある、と数える。
- 合計 **15,159 件**（本体 12,334、package 1,258、bundle 1,545、literal 22）。

### 3.2 訳の元ごとの件数（それだけを当てたときに訳がある件数。literal を除く 15,137 件のうち）

| 訳の元 | 合計 | 本体 | package | bundle |
|---|---|---|---|---|
| vscode-loc PR #2450 head `e0407b9e`（2026-10-23） | 14,950 | 12,148 | 1,257 | 1,545 |
| vscode-loc main `62d5443b`（訳は 2026-09-04） | 14,559 | 11,816 | 1,245 | 1,498 |
| Open VSX 1.131.0（今の台帳） | 14,338 | 11,645 | 1,205 | 1,488 |

- 3つを合わせても 187 件（本体 186、package 1）に訳が無い。main と 1.131.0 は、PR #2450 に無い訳を1件も足さない。
- 187 件のうち、Shuko のパッチが足した文言は1件だけ（`vs/platform/dialogs/electron-browser/dialog` の `aboutDetailWithoutCopilot`）。公式の 1.146.0（`tmp/b/official/vscode-1.146.0/69047191fc`）に無い鍵はこの1件。同じ鍵で英語が公式と違うものは0件。

### 3.3 作ったパックの結果（`build --strings`・`count`）

| 区分 | 件数 |
|---|---|
| 公式の訳（PR #2450） | 14,941 |
| 課が足した訳（公式に無い文言） | 182（本体 181、package 1） |
| 課の上書き（公式の訳が英語のままの文言。`override: true`） | 9 |
| 自前の拡張の直書き（日本語） | 22 |
| 除外 | 5（すべて理由 `format`。`{0}: {1}` が2件、`{0} ({1})`、`{0}%`、`{0} (Esc)`） |
| **除外の外の未訳** | **0** |

- 足した訳の、英語が変わったもの（staleAdded）は0件。公式と重なる足した訳（redundantAdded）は0件。除外の英語が変わったもの（staleExclusions）は0件。
- 参考: 日本語の文字を含まない訳は 164 件ある（「Git」「CRLF」「{0}: {1}」など。公式の訳でも英字のまま）。曹参の網の粗い数え（日本語を含まず英字が3字以上並ぶもの）では、本体は 39 件になる（今の 1.131.0 では 768 件）。39 件の中身は、キーの名前（Ctrl・Shift）、略語（CLI・URL・PID）、製品名（Copilot Pro・Bing）、機能の名前（Quick Open・CodeLens）など。

### 3.4 曹参の網での照合（済み）

`tests/l10n-audit.mjs` の `auditL10n` を読み込んで走らせた（`node tests/...` は私の許可に無いため、`scripts/l10n-probe.mjs audit` から呼んだ）。

- 作ったパック: 本体 12,355 のうち訳あり 12,350、未訳 5（すべて除外）、除外の外 0。拡張 1,258 のうち訳あり 1,258。`pass: true`、`invalidExclusions: []`。
- 今の 1.131.0: 本体の未訳 689、拡張の未訳 53、合わせて 742。`pass: false`。

同じ結果を、大岡越前守がそのまま確かめられる。

```
node tests/l10n-audit.mjs --app tmp/b/p2/1.146.0-p5-c-all-r4/Shuko-win32-x64-1.146.0-p5-c-all-r4/resources/app --pack extensions-src/language-pack-ja/dist/translations --exclude extensions-src/language-pack-ja/exclusions.json --strict
```

- `--pack` には `dist/translations` を渡す。網の `resolvePack` は `<pack>/main.i18n.json` を見て、拡張の束は `<pack>/extensions/<ID>.i18n.json` の名前で探す。パックの `package.json` は1つ上の `extensions-src/language-pack-ja/` にあるので、網は読まない。それでも名前が一致するので数えられる。
- 除外の一覧は網の形（`{ exclusions: [{ module | extension, key, reason }] }`）にそろえた。拡張の項目には `section`（package・bundle・literal）と `en` を足してある。今の5件はすべて本体の項目。
- 網は bundle（`vscode.l10n.t`）と literal を数えない。bundle も数えるなら、作り方は3.1のとおり。

## 4. テストの入口（曹参）

純粋な部品は `scripts/lib/l10n-ja.mjs` にある。

| 関数 | 試すこと |
|---|---|
| `coreFromNls(keys, messages)` | `{ mod: { key: en } }`。数が合わないと例外。重複する鍵は1つになる |
| `recordFromL10nJson(json)` / `recordFromPackageNls(json)` | 値が文字列のものと `{ message, comment }` のものから `{ 鍵: 英語 }` を作る |
| `manifestLiterals(manifest)` | displayName などを拾う。`%key%` は拾わない |
| `flattenStrings(strings)` / `countStrings(strings)` | area（core・package・bundle・literal）ごとの平らな一覧と件数 |
| `lookup(tree, area, owner, key)` | 層・パックから鍵を引く |
| `buildPack({ strings, layers, added })` | 先の層が勝つ。足した訳は公式に無いときだけ使う（重なれば `redundantAdded`）。`override: true` は公式より先に使う。`en` が表と違う足した訳は使わず `staleAdded` に出す。空の訳は訳と見なさない |
| `exclusionTree(ex)` / `coverage({ strings, pack, exclusions })` | 未訳は「訳が無いか空」で、除外に無いもの。除外の `en` が今の英語と違えば未訳に数え、`staleExclusions` に出す。literal は日本語を含めば訳あり |
| `validateExclusions(ex)` / `validateAdded(a)` | 理由が `reasons` に無い、`section` が違う、鍵が重複する、`ja` が空、などを誤りにする |
| `placeholderMismatch(en, ja)` | `{0}`・`{name}` の過不足 |
| `hasJapanese(s)` | ひらがな・カタカナ・漢字・全角の記号 |

`scripts/l10n-ja.mjs` で書き出している関数: `loadSourcesConfig`、`sourceCacheDir`、`layerFromPackFiles(name, rels, readFile)`、`loadLayers`、`l10nDependencyNames(manifests)`、`loadAdded(dir)`、`loadExclusions(file)`、`translationsList(pack)`、`readBuiltPack(extDir)`、`resolveInput(strings, input)`。

ほかの台本:

- `scripts/apply.mjs` の `languagePackMissingFiles(dir)`: 今のリポジトリでは `[]`。`package.json` が無ければ `["package.json"]`、localizations が無ければ `["contributes.localizations の translations"]`、束のファイルが無ければそのパス。
- `scripts/install-extensions.mjs` の `retiredNotes(extra)`: `MS-CEINTL.vscode-language-pack-ja`（大文字小文字を問わない）にだけ説明が付く。

CLI と終了コード:

- `count --strings <表>`: 未訳が0なら 0、あれば 5。`build --strings <表>` は、未訳か staleAdded があれば 5。`fetch` は SHA-256 が違えば 2。誤りは 1。
- 手元の表は `tmp/l10n/strings-1.146.0-r4.json`（`extract` の出力）にある。`tmp/` の下なので git には入らない。テストで使うなら、`extract` を走らせて作り直すか、小さな作り物の表を使う。

テストが要る点（提案）:

- パックの `package.json` の translations が指すファイルがすべてある。`vscode` の項目がある。
- `added/*.json` の `en` が表の英語と同じ（staleAdded が0）。置き換えの印が合う。
- `exclusions.json` が網の `loadExclusions` で `invalid` にならない。
- `sources.json` の commit が40桁で、files に SHA-256 がある。
- 台帳と `extensions.allowed` に `MS-CEINTL.vscode-language-pack-ja` が無い（今の `removals.test.mjs` の一致の検査は通る）。
- 出力の `resources/app/extensions/language-pack-ja` があることを、後処理かスモークで見る（5節の注）。

## 5. ビルドと入れ替えで要ること（アイコンと同じ版で行う）

1. **ビルドの前**: なし。`dist/translations/` はリポジトリにあり、`apply.mjs` が `extensions/language-pack-ja` に写す。束を作り直すときだけ `node scripts/l10n-ja.mjs fetch` と `build`（キャッシュは `<buildRoot>\cache\l10n\`）。
2. **本体の作り直しが要る理由**: `extensions.allowed` の既定（product.json）が変わる。組み込みの拡張も増える。
3. **ビルドの後**: 新しい出力と作業ツリーで、次を走らせて未訳0を確かめる。
   ```
   node scripts/l10n-ja.mjs extract --app <出力>\resources\app --worktree <作業ツリー> --out tmp\l10n\strings-<label>.json
   node scripts/l10n-ja.mjs count --strings tmp\l10n\strings-<label>.json --pack <出力>\resources\app\extensions\language-pack-ja
   ```
   曹参の網は `--pack <出力>\resources\app\extensions\language-pack-ja\dist\translations` で走らせる。
4. **入れ替えのとき（課）**:
   - 古い言語パックを外す: `<installRoot>\current\bin\shuko.cmd --uninstall-extension MS-CEINTL.vscode-language-pack-ja`。入ったままだと、ユーザーの拡張がこのパックより後に読まれて上書きし、古い訳に戻る（l10n-design.md の2.2）。`extensions.allowed` から外しても、入っている拡張は言語パックの一覧に残る見込み。この操作は、私の削除の許可の外（`%USERPROFILE%\.shuko\extensions` の下を消す）なので、台本には入れていない。誰が行い、どの許可で行うかはリーダーが決める。
   - `install-extensions.mjs` は、古いパックが入っていると終了コード3で止まる（台帳に無い拡張）。止まるときの文に、外し方の説明が付く。外してから走らせる（台帳は7件）。
   - 確かめ: `%APPDATA%\Shuko\languagepacks.json` の `ja` の `extensions` が `shuko.language-pack-ja` と `shuko.notion-sync` になり、`translations.vscode` が `<版>\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json` を指す。
   - 入れ替えた後の最初の起動は英語になりうる。言語パックの一覧は、起動のたびに共有のプロセスが作り直す。本体はそれより前に一覧を読むので、日本語になるのは2回目の起動から（見込み。実物で確かめる）。
   - 画面で見る所の例: 画像を開いたときの「画像プレビュー」、エディターの透かしの「エディターのショートカット」、ヘルプの「バージョン情報」のダイアログ（Shuko のパッチの文言）。
5. **注**: `build.mjs` の後処理の「必須の自前の拡張」は mydist だけのままにした。language-pack-ja も必須にすると、`tests/build-env-branch.test.mjs` の偽物の出力（mydist と notion-sync だけ）が落ちる。代わりに、束が無ければ apply が止める。後処理でも見るなら、テストの偽物を直してから必須にする（曹参）。

## 6. 諮るべき点・リーダーの判断が要る点

1. **vscode-loc の未マージの PR の head を訳の元にしたこと**: PR #2450 は、Microsoft の訳の自動の書き出し（作者 `azure-pipelines[bot]`、本文 "Updated strings from microsoft/vscode-loc-drop@85cff18b..."）。main への取り込みは 2026-09-04 から止まっていて、PR が積み上がっている（#2439〜#2450 はどれも open）。main だけを使うと、課が訳す文言が 187 件から 578 件に増える。裁定の「vscode-loc の最新」に入ると読んだ。違えば `sources.json` から PR の項目を消して作り直す（`todo` で訳す文言が出る）。
2. **公式の訳が英語のままの文言の上書き（9件）**: 公式の訳があっても英語と同じ文言のものがある（「Some extensions are disabled because they are configured not to be allowed.」など）。裁定の「英語のまま残さない」に合わせ、普通の言葉の9件を日本語にした。製品名・略語・キーの名前・機能の名前（Quick Open など。公式の日本語でも英字で書く）はそのままにした。上書きをやめるなら、`added/1.146.0.json` の `override: true` の9件を消して作り直す。
3. **dist（3.65 MB ほか）をリポジトリに入れること**: notion-sync の `dist/` と同じ扱いにした。束は `sources.json` と `added/` から決まるので、ビルドのときに作る形にもできる。その場合は `fetch` のネットワークがビルドに要る。
4. **古い言語パックを外す操作の担い手と許可**（5節の4）。
5. **docs/ の直し（リーダー）**: 7節の「別案」の詳細を書くこと。2節の表から日本語パックの行を外すこと。5節の「言語パックを先に入れる」は台帳に言語パックが無くなるので空振りになること（コードは残した）。user-decisions の 2026-11-12「言語パックが本体より古い点」は 2026-11-17 で改まっていること。
6. **更新の検知**: 台帳から外したので、`tools/watch` は日本語パックを見なくなる。代わりに vscode-loc の新しい "Updated strings"（main の commit と bot の PR）を見るかどうか（l10n-design.md の6節）。

## 7. 次の版の手順（TAKE-IN.md に書く案。自動にするかはリーダーが決める）

l10n-design.md の6節に書いた。要点は次のとおり。

1. 取り込みのビルドの後で `extract` を走らせる。
2. vscode-loc に新しい訳があれば、`sources.json` の先頭の commit を新しい "Updated strings" の head にして、`fetch --update-lock` を走らせる。
3. `todo` を走らせる。訳の入力を作って `add --version <新しい版>` を走らせる。訳し直し（staleAdded・staleExclusions）も同じ手順で行う。
4. `build --strings` が 0 で終わることを確かめる。
5. パックは組み込みの拡張なので、作り直しが要る。apply から作り直す。
6. 判定（狄仁傑）には `count` の結果を渡す。

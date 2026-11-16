# 検証の記録: 日本語パック（ビルドの前）

- 検証: 大岡越前守（ooka-echizen）
- 日付: 2026-11-17
- 対象: 蒙恬の日本語パック（`tasks/2026-11-17-l10n-ja/`、`extensions-src/language-pack-ja/`、台本と台帳の差分）、曹参の未訳の網とテスト（`tasks/2026-11-17-icon-l10n-tests/`、`tests/l10n-audit.mjs`・`tests/l10n-audit.test.mjs`）
- 基準: `docs/user-decisions.md` の 2026-11-17 の3節、`docs/04-bundled-extensions.md` の7節（合格の条件は「除外の外の未訳 0」。対象は本体と組み込み拡張）
- 作った人の自己申告は根拠にしていない。数は、自分で走らせたコマンドと、自分で読んだファイルから出した。

## 判定

**合格（ビルドへ進めてよい）。** ただし次の2つを条件にする。

1. ビルドの前に、リーダーが docs/04 の2節の表（まだ `MS-CEINTL.vscode-language-pack-ja` が載っている）を直す。CLAUDE.md の「資料と食い違う事実は、資料を直してから先へ進む」による（下の L1）。
2. ビルドの後に、作った出力に対して網（`--strict`）と蒙恬の `count` をもう一度走らせ、bundle（`vscode.l10n.t`）を含めて未訳 0 を確かめる。bundle の全数は、今回は私の許可では数えられなかった（1節）。

直すべき点のうち、ビルドを止めるものは無い。テストの不足（6節）は、入れ替えの関門までに曹参が足す。

## 項目ごとの合否

| # | 項目 | 合否 | 要点 |
|---|---|---|---|
| 1 | 未訳（網で除外の外 0、count と食い違わない） | 合格（bundle の全数は判定できない） | 本体 12,355 のうち訳あり 12,350、除外 5、除外の外 0。拡張の package 1,258 は全部に訳がある。直書き 22 件はすべて日本語。bundle は12件を抜き取って全部に訳があった。`count` は許可が無く走らせていない |
| 2 | 訳の元（commit と SHA-256） | 合格（取り直しはできない） | キャッシュの PR #2450 の97ファイル、main の main.i18n.json と LICENSE、VSIX の SHA-256 が `sources.json` と一致した。取り直し（ネットワーク）は私の道具と許可に無い |
| 3 | 足した訳（印・言い回し・除外） | 合格 | 191件（足した訳 182、上書き 9）を全部読んだ。印のある44件はすべて英語と同じ印を持つ。訳語は公式の訳と15語を照合してそろっている。除外の5件の理由は成り立つ |
| 4 | 差分のレビュー | 合格（直すべき点あり） | 台帳 7件と `extensions.allowed` 7件が一致する。許可の外を消す処理は無い。apply が package.json の無いパックを黙って飛ばす点（M1）と、docs/04 の食い違い（L1）がある |
| 5 | テスト・ライセンス | 合格 | 11の試験ファイルで 843件。841件が通り、2件は試しの作業ツリーが無いので飛んだ。落ちたものは0件。`ThirdPartyNotices.txt` は vscode-loc の LICENSE.md と同じ文（著作権の表示と許諾の文）を含み、MIT の条件を満たす |
| 6 | 足りないテスト | 不足あり（曹参） | `scripts/lib/l10n-ja.mjs` の純粋な部品には、単体テストが1件も無い。ほかの不足も含めて6節に挙げる |

## 1. 未訳

### 1.1 曹参の網（独立の数え方）

走らせたコマンド（蒙恬の引き継ぎの4節と同じもの。`--out` は足した）:

```
node tests/l10n-audit.mjs --app tmp/b/p2/1.146.0-p5-c-all-r4/Shuko-win32-x64-1.146.0-p5-c-all-r4/resources/app --pack extensions-src/language-pack-ja/dist/translations --exclude extensions-src/language-pack-ja/exclusions.json --out tasks/2026-11-17-l10n-ja-verify/audit-new-pack-r4.json --strict
```

出力:

```
本体: 総数 12355 / 訳あり 12350 / 未訳 5（除外 5、除外の外 0）
拡張: 総数 1258 / 訳あり 1258 / 未訳 0（除外 0、除外の外 0）
粗い数え（英字のみの文言）: 本体の結果 39 / 元の英語 12200
合格（除外の外の未訳 0）
```

- 終了コードは 0。`--strict` なので、未訳があれば 1 になる。
- 出力の JSON は `pass: true`、`invalidExclusions: []`、`keysVsMessagesMismatch: false`。
- 訳はあるが英語と同じもの（`sameAsEnglish`）は、本体が113件、拡張が10件ある。網はこれを「訳がある」に数える（設計どおり）。

### 1.2 蒙恬の数との照合

- 網の本体 12,355 は、並びで数えた件数である。蒙恬の 12,334 は、モジュールと鍵の組で数えた件数である。差の21組は同じ鍵の重なりで、同じ訳を引く。数え方の違いで説明がつき、食い違いではない。
- 拡張の package は、網も蒙恬も 1,258 件で、全部に訳がある。
- 除外の5件は、網と `exclusions.json` で同じ鍵である。

### 1.3 網が数えないところ

- **直書き（literal）**: 自前の拡張3つの `package.json` から、表示の文字列を Grep で拾った。mydist が2件、language-pack-ja が3件、notion-sync が17件で、合わせて22件。どれも日本語を含む。蒙恬の数（22件、すべて日本語）と一致する。
- **bundle**: 作業ツリー `tmp/b/wt/r4` の拡張のソースにある `l10n.t('...')` から、新しい文言を12件抜き取った。そのすべてに、パックの訳があった。
  - markdown-language-features の6件: リッチ エディターと媒体の貼り付けの文言。1.146 で増えたもの
  - git の6件
- **判定できない部分**: bundle の全数（蒙恬の数では 1,545）は数えていない。`node scripts/l10n-ja.mjs count`（と `extract`）は、私の Bash の許可に無い。ビルドの後で、蒙恬がこれを走らせ、私が出力を確かめる。または、リーダーがユーザーの承認を取って私の許可に足す（L2）。

### 1.4 英語のまま残る訳

- 網の粗い数えでは、作ったパックを当てた本体に、英字だけの文言が39件残る（今の 1.131.0 では768件）。
- 蒙恬の説明では、この39件はキーの名前・略語・製品名・機能の名前である。この39件の一覧は、私の許可の範囲では出せず、中身を確かめていない。網が一覧を出すように曹参が直したら（C4 の d）、そこで確かめる。
- 参考までに、パック全体（本体 32k 件の鍵）には、英語のままの公式の訳が多くある（例: `vs/sessions/...` の "Toggle Details"）。しかし `vs/sessions` は r4 の `nls.keys.json` に無いので、画面には出ない。上書きの9件のうち、`Marketplace Info` が英語のまま残るのは `mcpServerEditor` の側である。このモジュールも r4 に無い。r4 にある `extensionEditor` の側は「マーケットプレース」になっている。

## 2. 訳の元

- `sources.json` の commit は、PR #2450 の head が `e0407b9e2508caa96cdb40bb3d109e8aa21843ee`、main が `62d5443b567022539ba6e8565b0f43f5f6b3682b` である。どちらも40桁。
- `sha256sum` で、キャッシュ `tmp/b/cache/l10n/vl-e0407b9e2508/` の97ファイル（LICENSE.md・package.json・main.i18n.json・拡張の94ファイル）を計算した。97ファイルすべてが `sources.json` の値と一致した。
- main（`vl-62d5443b5670`）の `translations/main.i18n.json`（`6c07b3d3…c855`）と `LICENSE.md` も一致した。VSIX（`vsix-fae5a90170d4/…-1.131.0.vsix`）は `fae5a901…f601` で、`sources.json` の値とも、外す前の台帳の値とも一致した。
- 取り直しはしていない。私の道具にはネットワークで取るものが無い。`node scripts/l10n-ja.mjs fetch` も許可に無い。確かめたのは「キャッシュと固定の値が一致すること」までである。
- パックの束が、このキャッシュから作られたことは、次の抜き取りで確かめた。
  - キャッシュの公式の訳で英語のまま（`expand all`、`shellIntegration.basic`、`fileWatcher`、`zenMode` の settingsLayout 側、`Marketplace Info`）の文言が、パックでは上書きの日本語になっている。
  - 公式の訳がある文言（「禅モード」「統合ブラウザーで開く」など）は、そのままの訳で入っている。
  - `dist` を作り直して比べることは、`build` の許可が無いのでしていない。

## 3. 足した訳

- `added/1.146.0.json` の `"en":` は191件、`"override": true` は9件ある（Grep の件数）。上書きの内訳は、本体8件と、拡張の package 1件（`vscode.restructuredtext` の displayName）。
- **書式の印**: 191件を全部読んだ。英語に `{n}`・`` ` ``・`\n` のどれかを持つ44件は、訳にも同じ印がそろっている。
  - 並びを替えたもの（`{0} on {1}` →「{1} 上の {0}」）も、印の過不足は無い。
  - `aboutDetailWithoutCopilot` の改行は、英語も訳も8つ。
  - `&&`・`$(icon)`・Markdown のリンクを持つ英語は、191件の中に無い。
- **言い回し**: 公式の訳（`dist` の main.i18n.json・media-preview の束）と、次の15語を照合した。
  - 再度開く（本体の公式は「再度開く」。旧 media-preview 拡張だけが「開き直す」）
  - 拡大／縮小
  - 画像全体
  - イメージのズーム
  - ズーム レベルの選択
  - Git LFS の3文（公式の束と同じ文）
  - 統合ブラウザーで開く
  - 制限モード
  - 禅モード
  - フォルダーを指定して検索
  - はじめに
  - 詳細の切り替え
  - マーケットプレース
  - すべてのリポジトリを展開
  - ファイル ウォッチャー

  どれも公式とそろっている。「画像」と「イメージ」が混ざっているが、公式の訳も同じように混ざっている。
- **上書きの9件**: キャッシュの PR #2450 で、9件とも公式の訳が英語のままである。具体的には `Marketplace Info`、`disallowed extensions` の2件、`zenMode`、`expand all`、`shellIntegration.basic`、`focusAccessibleBuffer`、`fileWatcher`、reStructuredText の displayName。上書きは、裁定「英語のまま残さない」の当てはめとして成り立つ（リーダーの判断の記録 2026-11-17 でも認めている）。
- **除外の5件**: `{0}: {1}` が2件、`{0} ({1})`、`{0}%`、`{0} (Esc)` で、すべて理由は `format`。
  - パックの main.i18n.json で、同じ形の文言が公式の訳で同じ形のまま残っているのは81件ある。
  - 全角の形（「{0}：{1}」「{0}（{1}）」など）に直した公式の訳は0件。
  - したがって「公式の訳も同じ文言」という理由は成り立つ。訳す言葉が無い、という判断も妥当である。

## 4. 差分のレビュー

`git diff` で9ファイルを読み、新しい台本・拡張のファイルも読んだ。

- `extensions.lock.json`: `MS-CEINTL.vscode-language-pack-ja` の1件だけを外した。残りは7件。
- `product.overlay.json`: `extensions.allowed` から同じ ID だけを外した。`*: false` と7件が残る。台帳と同じ7件である（`removals.test.mjs` の照合のテストも通った）。
- `builtin/keep.json`・`scripts/build.mjs`・`scripts/lib/apply/classify.mjs`: `own` と `OWN_EXTENSIONS` に `language-pack-ja` を足した。後処理の「必須」は mydist のままである。
- `scripts/apply.mjs`: 写す拡張に `language-pack-ja` を足し、`languagePackMissingFiles` で訳の束の有無を見て止める。今のリポジトリでは、package.json の translations は95件で、`dist/translations` のファイル（main と拡張の94）と1対1に合う。
  - **直すべき点 M1**: 423〜426行で、`language-pack-ja/package.json` が無いときは `continue` で黙って飛ばす。mydist は止める。束が無ければ止める作りなのに、フォルダごと無いと英語のビルドが黙ってできる。今はフォルダがあるので、今回のビルドには影響しない。
- `scripts/install-extensions.mjs`: `RETIRED_EXTENSIONS`・`retiredNotes` で、止めるときの文に説明を添えるだけである。外す（uninstall）処理は無い。
- `extensions-src/mydist/package.json`・`notion-sync/package.json`: displayName の日本語化だけ。古い名前（"Shuko defaults"・"Shuko Notion Sync"）を参照する箇所は、scripts・tests・docs・removals・patches に無い。
- `scripts/l10n-ja.mjs`: 消すのは `extensions-src/language-pack-ja/dist/translations` だけ（426行）。書くのは、パックのフォルダ、`<buildRoot>\cache\l10n\`、`--out` の先だけ。ネットワークで取るのは `fetch` だけで、api.github.com と raw.githubusercontent.com、Open VSX の固定の URL に限る。
- `scripts/lib/l10n-ja.mjs`: import の無い純粋な部品である。
  - **直すべき点 M2**: `placeholderMismatch` は印の有無だけを見て、数を見ない（`{0} {0}` と `{0}` を同じとみなす）。`&&`・`$(...)`・Markdown のリンクも見ない。今の191件には当たらないが、次の版で訳を足すときの網として弱い。
- 許可の外を消す処理は無い。古いパックを外す操作は、台本に入れていない（蒙恬の引き継ぎの5節の4。担い手はリーダーが決める）。
- **docs との食い違い（L1）**:
  - docs/04 の2節の表（25行）に、まだ `MS-CEINTL.vscode-language-pack-ja 1.131.0` が載っている。
  - 5節の3（98行）の「言語パックを先に」は、空振りになる。
  - 7節には、作り方の詳細がまだ書かれていない。
  - 実装とリーダーの判断の記録（2026-11-17）は「台帳から外す」で一致しているので、直すのは docs である。
- **参考（M4）**:
  - `scripts/lib/p0-common.ps1` は、Phase 0 の環境の台帳（`P0LedgerIds`）に、まだ `ms-ceintl.vscode-language-pack-ja` を持つ。台帳に無いときは `P0LangPackVersion = '1.131.0'` で VSIX を探す（359行）。
  - 本家の基準の環境（`upstream-default` など）に、Open VSX のパックを入れる作りである。
  - ビルドの後の計測（docs/07 の3節）で、本家と試作の条件をどうそろえるかは、この検証の外になる。ただ、VSIX の置き場所が `C:\b\p0\vsix` なので、`C:\b` を片づける前に確かめておく。

## 5. テストとライセンス

走らせたテスト（すべて `node --test tests/<名前>.test.mjs`）:

| ファイル | 件数 | 結果 |
|---|---|---|
| l10n-audit | 14 | 全部通る（実物の 1.131.0 での1件も走った） |
| install-ext | 46 | 全部通る |
| builtin-l10n・cli-run・build-env-branch | 62 | 全部通る |
| removals | 229 | 全部通る（台帳と `extensions.allowed` の一致を含む） |
| build-parts | 38 | 全部通る |
| apply-parts | 57 | 全部通る |
| take-in・take-in-more | 138 | 全部通る |
| watch | 104 | 全部通る |
| apply | 33 | 全部通る |
| apply-cli | 7 | 5件が通り、2件は飛ぶ（試しの作業ツリー `tmp/b/wt/dev-apply` が無い。今回の変更とは関係しない） |
| lock | 115 | 全部通る |
| 計 | 843 | 通る 841、飛ぶ 2、落ちる 0 |

ライセンス:

- `ThirdPartyNotices.txt` は、出典（`microsoft/vscode-loc`、commit `e0407b9e…`）を書いている。キャッシュの `LICENSE.md`（SHA-256 が固定の値と同じ）の全文、つまり著作権の表示と許諾の文と保証の否認も含む。MIT の条件（表示と許諾の文を含めること）を満たす。
- `apply.mjs` の `EXT_FILES` に `ThirdPartyNotices.txt` が入っているので、ビルドの出力にも写る。
- 下の層（main・Open VSX 1.131.0）は、今は訳を1件も足していない。もし下の層が訳を足すようになったら、表示にもその出典を足す（M3。急がない）。

テストの質:

- 曹参のテストは、模擬の本体とパックで、次のことを確かめている。どれも仕様（docs/04 の7節）の条件に沿っていて、落ちるべきときに落ちる形になっている。
  - 「別モジュールの同じ鍵を混ぜない」
  - 「空の訳は未訳」
  - 「部分だけの除外は不合格」
  - 「理由の無い除外は効かない」
  - 「`--strict` で終了コード 1」
- ただし、網の作りに次の穴がある（C4）。
  - 除外の `en` を見ないので、英語が変わった除外も効いたままになる。
  - `--pack dist/translations` で渡すと、パックの `package.json` を読まない（`root` が `dist` になる）。そのため、本体が実際に引く translations の対応は確かめていない。
  - 実物のテストは、古い 1.131.0 のパックだけを固定している。

## 6. 足りないテスト（曹参に足させる）

1. `scripts/lib/l10n-ja.mjs` の純粋な部品（テストが1件も無い）:
   - `coreFromNls`: 数の不一致で例外、重複の鍵
   - `recordFromL10nJson`・`recordFromPackageNls`: 文字列と `{message, comment}` の両方の形
   - `manifestLiterals`: `%key%` を拾わない
   - `flattenStrings`・`countStrings`
   - `lookup`
   - `buildPack`: 先の層が勝つ、`override` が公式より先に効く、`staleAdded`、`redundantAdded`、空の訳
   - `exclusionTree`・`coverage`: 除外の `en` の不一致で未訳と `staleExclusions` に数える、literal
   - `validateExclusions`・`validateAdded`
   - `placeholderMismatch`: 数の違いと、`&&`・`$(...)` を扱うなら、それも
   - `hasJapanese`
2. `scripts/l10n-ja.mjs` で書き出している関数: `loadSourcesConfig`（40桁でない commit を誤りにする）、`translationsList`、`readBuiltPack`、`resolveInput`（当たる行が0件・2件以上なら誤り、literal は訳を足せない、印の不一致）、`loadAdded`（版とファイル名の不一致）。
3. `scripts/apply.mjs` の `languagePackMissingFiles`（`[]`・package.json が無い・localizations が無い・束のファイルが無い）と、M1 を直した後の「パックのフォルダが無いと止まる」。
4. `scripts/install-extensions.mjs` の `retiredNotes`（大文字小文字を問わない、ほかの ID には付かない）。
5. `apply-parts` の classify: 今は「mydist・notion-sync は未分類に数えない」だけなので、`language-pack-ja` も含めて確かめる。
6. リポジトリの整合のテスト（蒙恬の引き継ぎの4節の提案）:
   - パックの `package.json` の translations が指すファイルが全部ある
   - `vscode` の項目がある
   - `exclusions.json` が網の `loadExclusions` で invalid にならない
   - `sources.json` の commit が40桁で、files に SHA-256 がある
   - 台帳と `extensions.allowed` に `MS-CEINTL.vscode-language-pack-ja` が無い
7. 網そのものの改め（C4）:
   - (a) 除外に `en` があれば、今の英語と比べる
   - (b) `--pack` に拡張のルートを渡したとき、`package.json` の translations（`./dist/translations/...`）で引けるようにする
   - (c) `--pack` の既定を、古い Open VSX のパックから改める
   - (d) `sameAsEnglish` と英字だけの文言の鍵の一覧を出す
   - (e) 作ったパックと日常の版で `pass: true` になることを、実物のテスト（無ければ飛ばす）に足す

## 直すべき点と担当

| 記号 | 担当 | 内容 | ビルドの前に要るか |
|---|---|---|---|
| L1 | リーダー | docs/04 の2節の表から日本語パックの行を外す。5節の3の「言語パックを先に」の扱いを書く。7節に作り方を書く。2026-11-12 の裁定が改まったことを、関係する箇所に反映する | 要る（CLAUDE.md の規約） |
| L2 | リーダー | ビルドの後の確かめのため、`node scripts/l10n-ja.mjs extract` と `count` を私の許可に足すか（ユーザーの承認が要る）、蒙恬が走らせた出力を私に渡すかを決める | ビルドの後の検証の前 |
| L3 | リーダー | 入れ替えのときに古いパックを外す操作（`--uninstall-extension`）を誰が、どの許可で行うかを決める | 入れ替えの前 |
| L4 | リーダー | 裁定どおり、`scripts/l10n-probe.mjs`・`tests/probe-l10n.mjs`・`audit-run-pack1131.json` をコミットに含めない | コミットのとき |
| M1 | 蒙恬 | `apply.mjs` の 423〜426行: `language-pack-ja/package.json` が無いときも止める | 要らない（入れ替えの関門まで） |
| M2 | 蒙恬 | `placeholderMismatch`: 印の数と、`&&`・`$(...)`・Markdown のリンクを見る | 要らない（次の版の訳の前） |
| M3 | 蒙恬 | 下の層が訳を足すようになったら、`ThirdPartyNotices.txt` にその出典を足す | 要らない |
| M4 | 蒙恬（判断はリーダー） | ビルドの後の計測で、本家の基準の環境の日本語パック（`p0-common.ps1`）の扱いと、VSIX の置き場所（`C:\b\p0\vsix`）を確かめる | 計測の前 |
| C1〜C4 | 曹参 | 6節の1〜7 | 要らない（入れ替えの関門まで） |

## 残した記録

- `tasks/2026-11-17-l10n-ja-verify/audit-new-pack-r4.json`: 網の出力（1.1節のコマンド）
- `tasks/2026-11-17-l10n-ja-verify/handoff-notes-ooka-echizen.md`: 走らせたコマンドの一覧

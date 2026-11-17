# 蒙恬の引き継ぎ: アイコン A の仕上げと新しい版のビルド

日付: 2026-11-17。依頼は `brief.md`（と、途中の追加の指示「bundle の鍵の直し（案 b）」）。

要点:

- アイコンは A（`center-spark`）が既定になり、`assets/` の8つを書き直した。`--check` は 0。
- M1（言語パックが無いと apply が止まる）と M2（印の照らしを数・`&&`・`$(...)`・リンクまで）を直した。
- 新しい版 `1.146.0-p5-c-all-r5` を作り、起動の確かめは `result: ok`。
- **ただし r5 は、bundle の鍵の直し（案 b）の前の束で作った。** 追加の指示が来た時点で、パッケージ化がもう走っていた。直した表で数えると、r5 の出力には git の bundle の2件（`↔` の書式だけの文言）が未訳で残る。直した束はリポジトリにあり、作り直せば 0 になる。作り直すかはリーダーが決める（5.3）。

## 1. 曹参へ（テストの入口）

### 1.1 M1: 言語パックが無いと apply が止まる

- 場所: `scripts/apply.mjs` の「5. 自前の組み込み拡張」（`for (const name of ["mydist", "notion-sync", "language-pack-ja"])` の中）。
- 変えたこと: `<extensionsSrc>/language-pack-ja/package.json` が無いとき、前は `continue` で黙って飛ばしていた。今は mydist と同じく `StopError("builtinExtensions", "language-pack-ja", "<src>/package.json が無い")` で止める。notion-sync は前のまま（無ければ写さずに進む）。
- 止まったときの記録（`checks.json`）: `stoppedAt: { phase: "builtinExtensions", id: "language-pack-ja", message: "<src>/package.json が無い" }`。`summarizeResult` は `"fail"`。終了コードは前からある StopError と同じ（mydist が無いときと同じ扱い）。
- 試し方: `apply.mjs <作業ツリー> --extensions-src <模擬の木>` に、`mydist/package.json` はあり `language-pack-ja/` が無い木を渡す。止まること、`extensions/language-pack-ja` が作業ツリーに写っていないことを見る。フォルダはあるが `package.json` だけ無い木でも同じく止まる。
- `languagePackMissingFiles(dir)` は変えていない（`package.json` があるのに束が無いときの止め方。前の引き継ぎの4節のとおり）。

### 1.2 M2: 印の照らしを強めた

場所: `scripts/lib/l10n-ja.mjs`。

| 入口 | 戻り |
|---|---|
| `placeholderMarks(s)`（新） | 印の配列（同じ印が2度出れば2つ）。並びは、`{0}`・`{name}`・`&&`・`$(name)` を出てくる順に、その後に Markdown のリンクの先を出てくる順に |
| `placeholderMismatch(en, ja)`（強めた） | 前と同じ形 `{ missing, extra }`（どちらも並べ替えた配列）か `null`。数まで見る |

拾う印:

- `{0}`・`{name}`（前と同じ形）
- `&&`（ニーモニック。訳では「ファイル(&&F)」と後ろへ回すので、位置は見ず数だけ）
- `$(name)`（codicon。`$(sync~spin)` も1つ）
- Markdown のリンクの先: `[表示](先)` を `[](先)` の形の印にする。表示の文字は訳すので見ない。先は英語と同じでなければならない。`[表示](<先>)` と `[表示](先 "題")` も読む（`<` `>` は残す。曹参の5節の2のとおり、角括弧の有無で書き分けた訳は不一致になる）。表示の文字の中の `{0}` なども数える（リンクと別に拾う）

期待する値（`node scripts/l10n-probe.mjs ph` で確かめた）:

| en | ja | `placeholderMismatch` |
|---|---|---|
| `{0} {0}` | `{0}` | `{ missing: ["{0}"], extra: [] }` |
| `{0}` | `{0} {0}` | `{ missing: [], extra: ["{0}"] }` |
| `&&File` | `ファイル(&&F)` | `null` |
| `&&File` | `ファイル` | `{ missing: ["&&"], extra: [] }` |
| `$(gear) Settings` | `$(gear) 設定` | `null` |
| `$(gear) Settings` | `設定` | `{ missing: ["$(gear)"], extra: [] }` |
| `See [docs](https://a.b/c)` | `[資料](https://a.b/c) を見る` | `null` |
| `See [docs](https://a.b/c)` | `[資料](https://a.b/d) を見る` | `{ missing: ["[](https://a.b/c)"], extra: ["[](https://a.b/d)"] }` |
| `[{0}](command:x)` | `[x](command:x)` | `{ missing: ["{0}"], extra: [] }` |
| `{name} and {0}` | `{0} と {name}` | `null`（並びは見ない） |
| `a` | `b` | `null` |

`placeholderMarks("[{0}](command:x)")` は `["{0}", "[](command:x)"]`。

使われ方:

- `l10n-ja.mjs build`: 足した訳に印の不一致があれば誤りで止まる（前から。照らしが強くなっただけ）。
- `l10n-ja.mjs add`（`resolveInput`）: 入力の訳の印が合わなければ誤り（前から）。
- **`l10n-ja.mjs count` に足した**: リポジトリの `added/*.json` を同じ照らしにかけ、出力に `placeholderProblems`（配列。要素は `{ version, area, owner, key, missing, extra }`）を出す。1つでもあれば `result: "placeholder"`、終了コード 1。無ければ前と同じ（未訳 0 なら 0、あれば 5）。パックを作り直さずに照らすため。
- 今の `added/1.146.0.json`（193件。前の191件と1.4の2件）は、強めた照らしで `placeholderProblems: []`。

参考（テストの対象ではない）: 同じ照らしを公式の訳（vscode-loc PR #2450）の 14,950 件に当てると、5件が合わない（リンク 3、`{}` 2、codicon 1）。公式の訳の誤りで、照らすのは課が足した訳だけなので、ビルドは止まらない。中身は9節の4。

### 1.3 アイコンの最終の形

- `scripts/make-icons.mjs` の `DEFAULT_VARIANT` は `"center-spark"`（候補 A）。`VARIANTS`・`VARIANT_ALIASES`・関数の名前と引数は変えていない。
- `assets/` の8つ（`resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`、`src/vs/workbench/browser/media/code-icon.svg`、`src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg`）を A で書き直した。
- 使わなかった意匠（`current`・`spark-badge`・`dark-tile`・`warm-ribbon`）の描き方は**残した**（2.2）。`--variant` で選べば今までどおり書ける。

### 1.4 bundle の鍵の直し（案 b。追加の指示で足した）

曹参が見つけた件（`tasks/2026-11-17-icon-ja-tests/handoff-notes-cao-shen.md` の5節の1）。リーダーの判断は案 b（除外で隠さず、鍵を実行時の鍵にそろえる）。

| 入口 | 中身 |
|---|---|
| `decodeUnicodeEscapes(src)`（`scripts/lib/l10n-ja.mjs`、新） | ソースの Unicode の書き方（逆斜線 + `u` + 16進4桁、と 逆斜線 + `u{…}`）を、実行時（JS のエンジン）と同じ文字に直した文字列を返す。U+0100 以上は文字そのもの、U+00FF 以下は 逆斜線 + `x` + 16進2桁（l10n-dev が正しく読む形）。対のサロゲートは1文字にまとめる。対にならないサロゲートと U+2028・U+2029 は書き方のまま。前に置いた逆斜線が偶数個なら（逆斜線そのものの後に `u` が来ている）書き方ではないので変えない。書き方を含まなければ同じ文字列 |
| `extract`（`scripts/l10n-ja.mjs`） | l10n-dev の `getL10nJson` に渡す前に `decodeUnicodeEscapes` をかける。直して鍵が変わったファイルは、文言の表の `bundleDetail.<拡張の ID>.escapeFixes` に `[{ file, asRead: [l10n-dev がそのまま読んだときの鍵], runtime: [実行時の鍵] }]` で出す（直す前の中身でも `getL10nJson` を走らせて比べる） |

`decodeUnicodeEscapes` の期待する値。下の「書き方」は、ソースの文字の並びを `+` でつないで書いた（この文書の中で書き方が文字に化けないように）。`BS` は逆斜線1文字。

| 入力のソースの書き方 | 出力 |
|---|---|
| `'{0} ` + `BS` + `u2194` + ` {1}'` | `'{0} ↔ {1}'`（↔ は U+2194 の文字そのもの） |
| `'` + `BS` + `u{1F600}` + `'` | U+1F600 の文字1つを `'` で囲んだもの |
| `'` + `BS` + `uD83D` + `BS` + `uDE00` + `'`（対のサロゲート） | 上と同じ |
| `'it` + `BS` + `u0027` + `s'` | `'it` + `BS` + `x27` + `s'` |
| `'a` + `BS` + `BS` + `u2194'`（逆斜線そのものの後に `u2194`） | 変わらない |
| `'` + `BS` + `uD83D` + `'`（対にならない） | 変わらない |
| `'` + `BS` + `u2028` + `'` | 変わらない |
| `'` + `BS` + `u12'`（4桁でない） | 変わらない |
| `BS` + `u` を含まない文字列 | 同じ文字列 |

1.146.0 での結果:

- 新しい表 `tmp/l10n/strings-1.146.0-r5.json`（r5 の出力と作業ツリー `tmp/b/wt/r5/w` から作った）で、`escapeFixes` は `vscode.git` の `git/src/commands.ts` の1件だけ。`asRead: ["{0} ({1}) ș {0} ({2})", "{0} ș {1}"]`、`runtime: ["{0} ({1}) ↔ {0} ({2})", "{0} ↔ {1}"]`。全体の件数は前と同じ 15,159（bundle 1,545。2件の鍵が入れ替わっただけ）。
- 公式の訳（vscode-loc PR #2450）は、鍵も値も `ș` のまま（Microsoft の書き出しも同じ誤りで作られている）。そこで、実行時の鍵の2件を足した訳にした（`added/1.146.0.json` の `extensions.vscode.git.bundle`。訳は記号のまま `{0} ↔ {1}`・`{0} ({1}) ↔ {0} ({2})`。本体の同じ形の公式の訳 `metadataDiff`・`sideBySideLabels` などにそろえた）。入力は `tasks/2026-11-17-icon-ja-build/l10n-input-escape-fix.json`、`node scripts/l10n-ja.mjs add --strings tmp/l10n/strings-1.146.0-r5.json --input <それ> --version 1.146.0`。除外は足していない（5件のまま）。
- `node scripts/l10n-ja.mjs build --strings tmp/l10n/strings-1.146.0-r5.json --out tasks/2026-11-17-icon-ja-build/l10n-build-escape-fix.json` で dist を作り直した（`result: ok`、未訳 0、staleAdded 0）。変わったのは `dist/translations/extensions/vscode.git.i18n.json` だけ（SHA-256 `6f554c858171c9298823b13b21aea6c8d2638a57cb73e4a49f9361930f3e253d` → `83751fa772e77cedd23e01b3c629e7e842cd90c52cb6b9cb59fcf7e0b57cb753`、89,239 → 89,329 バイト）。`main.i18n.json`（`256f559c20481eef1c653a7d785cbae638e2a1634250240bef073bfbedc7b425`）・`package.json`・`ThirdPartyNotices.txt`・`exclusions.json`・ほかの拡張の束は変わっていない（前後の SHA-256 が同じ）。公式の `ș` の鍵2件は束に残る（実行時に引かれないだけで害は無い。消すには build が文言の表に頼る形になるので、していない）。
- 作り直したパックと新しい表で `count`: 除外の外の未訳 0、`placeholderProblems: []`、`result: ok`（`l10n-count-repo-pack-fixed.json`）。

曹参へ:

- `tests/l10n-audit-more.test.mjs` の479行のテスト（追加の除外 `extra-exclusions-bundle-escape.json` を重ね、`bundle.totals.excluded === 2` を見るもの）は、今は落ちる（実際は 0。`0 !== 2`）。2件が除外ではなく訳になったため。471行の todo のテスト（除外は `exclusions.json` だけで `pass: true`）を、通常のテストに戻せる。ただし、網に渡すパックが**リポジトリのパック**（`DEFAULT_PACK`）なら通り、**r5 の出力のパック**なら落ちる（r5 は直す前の束で作った。5.3）。
- `decodeUnicodeEscapes` の単体テストは上の表で書ける。`extract` の `escapeFixes` は、`\u` を含む小さな ts を模擬の拡張に置けば出る（`getL10nJson` が要るので、作業ツリーの `@vscode/l10n-dev` を使う形になる）。

## 2. アイコンの仕上げ

### 2.1 変えたファイル

| パス | 変更 |
|---|---|
| `scripts/make-icons.mjs` | `DEFAULT_VARIANT` を `"current"` から `"center-spark"` にした。冒頭の説明に、裁定（2026-11-17）で A に決まったこと、ほかの4つは選ばれなかった意匠で `assets/` には使わないことを書いた。各意匠の行に「採用（既定）」「選ばれなかった」を付けた。`current` の節の見出しを「前の意匠」に直した。描き方と定数は1つも変えていない |
| `assets/` の8つ | A で書き直した（`node scripts/make-icons.mjs`）。大きさ: `code.ico` 25,929、`code_70x70.png` 3,329、`code_150x150.png` 6,820、`code-icon.svg` 5,634、`letterpress-light.svg`・`-dark.svg` 4,037、`-hcLight.svg`・`-hcDark.svg` 4,035 バイト |
| `assets/README.md` | 2026-11-12 の「名称とロゴは使わない」「他者の著作物は使っていない」の文を、2026-11-17 の裁定（Claude と VS Code を合わせる、名前は Shuko のまま、個人利用、商標は確かめていない）と、A の意匠の説明、元の絵の出どころ（`scripts/icon-src/SOURCES.json` の2つと SHA-256）に替えた。末尾の「正式な名前とアイコンが決まったら…」を「意匠を変えるとき」の手順に替えた |

### 2.2 使わなかった候補の描き方: 残した

理由:

1. 見本の画像（`tasks/2026-11-17-icon/preview-all.png` ほか。ユーザーが選ぶときに見たもの）を、同じバイト列で作り直せる。裁定の根拠を後から確かめられる。
2. 曹参のテスト（`ICON_TEST_ARGS_LIST="--variant a;--variant b;--variant c"` の走らせ方、`resolveVariant` の短い名前）が、名前と短い名前に頼っている。消すとテストも直すことになる。
3. 描き方は既定から外れていて、`--variant` を付けない限り `assets/` に出ない。`--check` も既定（A）とだけ照らす。

既定から外れていることは、台本の冒頭の説明と、各意匠の行の「選ばれなかった」で分かる。消すなら、`VARIANTS` から外し、描き方の節（`spark-badge`・`dark-tile`・`warm-ribbon`、`current` の `coverageAt` と SVG）を消し、`makePreviewFiles("all")` の並びを直す。`coverageAt` は前からあるテストの入口なので、消すなら曹参と合わせる。

### 2.3 確かめたこと

- `node scripts/make-icons.mjs --check`: 8つとも「同じ」（終了コード 0）。
- `node scripts/make-icons.mjs --check --out tasks/2026-11-17-icon/out/center-spark`: 8つとも「同じ」。ユーザーが見た候補 A の書き出しと、`assets/` は同じもの。
- `node --test tests/make-icons.test.mjs`: 33件が通り、落ちたものは 0。
- 出力（6.3）にも同じバイト列で入っている。

## 3. TAKE-IN.md

`TAKE-IN.md` に次を足した。前からある1〜3節の文は変えていない（3節の末尾に1項を足しただけ）。

- 3節（判定）の末尾: 材料に `l10n-count.json` があれば未訳の数を書く。未訳があっても、それだけで不合格・条件付きにしない。材料に無ければ「数えていない」と書き、`missingMaterials` に入れず判定を下げない。判定役は訳を作らない。
- 4節（新）「日本語パック（本体の版が上がったとき）」: 4.1 決まり（リーダーの判断の4つ: 訳すのは蒙恬で自動にしない、未訳が残っても採否を止めず判定に数を書く、急ぐセキュリティの修正では英語が残ったまま入れ替えて後で訳を足してよい、vscode-loc の見張りは足さない。ほかに、足した訳は版ごとのファイル、合格は除外の外の未訳 0）、4.2 手順（訳の元を探す → extract → count を材料に置く → todo → add → build → 本体を apply から作り直す → 作り直した版で count。extract の `escapeFixes` の扱いも書いた）、4.3 入れ替えのときに見ること。

手順の 3 で `count --out records\take-in\<label>\l10n-count.json` と書いたが、`records/` は私の書き込み先（`write_paths`）に無い。取り込みのときに私が手で置くには許可が要る。別案として、`take-in.mjs` のビルドの後に `extract` と `count` を自動で走らせ、材料に置く形がある（数えるだけで、訳すのではない）。どちらにするかはリーダーの判断（9節の2）。

## 4. 変えたファイル（M1・M2・鍵の直し）

| パス | 変更 |
|---|---|
| `scripts/apply.mjs` | M1。1.1 のとおり |
| `scripts/lib/l10n-ja.mjs` | M2: `placeholderMarks` を足し、`placeholderMismatch` を数まで見る照らしにした（1.2）。鍵の直し: `decodeUnicodeEscapes` を足した（1.4） |
| `scripts/l10n-ja.mjs` | `count` に `added/*.json` の印の照らし（`placeholderProblems`）を足した。`extract` で `decodeUnicodeEscapes` をかけ、`escapeFixes` を出すようにした。冒頭の使い方と終了コードの説明を直した |
| `extensions-src/language-pack-ja/added/1.146.0.json` | 実行時の鍵の2件（1.4）を足した（`add` が書いた） |
| `extensions-src/language-pack-ja/dist/translations/extensions/vscode.git.i18n.json` | 作り直した（1.4） |
| `TAKE-IN.md` | 3節 |
| `assets/`・`assets/README.md`・`scripts/make-icons.mjs` | 2節 |
| `scripts/l10n-probe.mjs` | 調べ用の使い捨ての台本（コミットしない。2026-11-17 のリーダーの判断）に `ph`（1.2 の表を出す・公式の訳に当てて数える）、`sha`（ファイルの SHA-256）、`test --out=<file>`（要約をファイルにも書く）を足した。成果物ではない |

このディレクトリに置いた記録: `1.146.0-p5-c-all-r5/`（`build-record.json`・`checks.json`・`lockfile.diff`）、`launch-check-p5-c-all-r5.json`、`l10n-count-r5-old-extract.json`・`l10n-count-r5-fixed-extract.json`・`l10n-count-repo-pack-fixed.json`、`l10n-build-escape-fix.json`、`l10n-input-escape-fix.json`。

## 5. ビルドの記録

### 5.1 版

| 項目 | 値 |
|---|---|
| ラベル | `1.146.0-p5-c-all-r5` |
| コマンド | `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r5 --worktree tmp/b/wt/r5/w --take-in-dir tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r5 --record tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r5/build-record.json`（1回で `result: ok`） |
| zip | `tmp/b/dist/1.146.0-p5-c-all-r5.zip`（220,100,928 バイト、2,139 項目、先頭のフォルダ `Shuko-win32-x64-1.146.0-p5-c-all-r5`） |
| zip の SHA-256 | `21d9ab57cce61078527d34429960521936c77a574589d213811a75a3401ce613`（記録の値と、私が計算し直した値が一致） |
| 版のフォルダ（展開したもの） | `tmp/b/p2/1.146.0-p5-c-all-r5/Shuko-win32-x64-1.146.0-p5-c-all-r5`（`p1-launch-check.ps1` が展開した） |
| gulp の出力 | `tmp/b/wt/r5/VSCode-win32-x64` |
| 作業ツリー | `tmp/b/wt/r5/w` |
| 版の commit（作業ツリーの HEAD、product.json の commit） | `027caf9afae37fe28643315867577ba2e4ba97d6`。枝 `builds/1.146.0-p5-c-all-r5` を作った |
| 本家 | 1.146.0（`69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| 台帳（`extensions.lock.json`）の SHA-256 | `27ad0e1b8ee24a93a2f7edce87c360f29da1e7429c0b3b27374cb81f33a6db70`（7件） |

ラベルの名前: 今までの決まり（`<tag>-p<段階>-<中身>-r<作り直しの番号>`）で、21単位を全部当てた版（`p5-c-all`）の5回目の作り直しとして `r5` にした。中身の違いは、アイコンと日本語パック（5.2）。長さは r4 と同じ19文字（長いパスが無効な PC のため）。削除の許可の残す側（`tmp/b/p2/1.146.0-p5*` など）にも入る。

作業ツリーの場所: 依頼書の `tmp/b/wt/<名前>` の下だが、`tmp/b/wt/r5` ではなく **`tmp/b/wt/r5/w`** にした。gulp は作業ツリーの親の `VSCode-win32-x64` を、パッケージ化の前に消して作り直す（本家 `build/gulpfile.vscode.ts` 524行の `util.rimraf(path.join(buildRoot, destinationFolderName))`）。`tmp/b/wt/r5` だと、r4 の出力 `tmp/b/wt/VSCode-win32-x64` を消すことになり、そこは私の削除の許可（`delete_paths`）の外である。`tmp/b/wt/r5/w` にすると、gulp の出力は新しいフォルダ `tmp/b/wt/r5/VSCode-win32-x64` になり、何も消さない。パスは r4 より2文字長いが、install・型検査・パッケージ化は通った。

所要時間（秒）: prepare 126.7、apply 62.6、install 802.8、lockfile 1.1、typecheck 12.0、package 141.2、postprocess 0.01、zip 20.1。全体は 19分40秒（2026-11-16T23:53:39Z〜2026-11-17T00:13:19Z）。install は r4（286.5秒）より長い。新しい作業ツリーで native の部品を全部作り直したためと見ている（pnpm の `_pacquet-stage_` のフォルダがしばらく残ったが、r4 のような失敗にはならなかった）。同じ時間に、私がテストを裏で走らせていた。

### 5.2 中身（r4 との違い）

`git -C tmp/b/wt/r4 diff --stat 7fac30e8（r4 の HEAD） 027caf9a（r5 の HEAD）` の結果は14ファイルで、次だけ:

- `extensions/language-pack-ja/`（`README.md`・`ThirdPartyNotices.txt`・`package.json`）が増えた
- `extensions/mydist/package.json`・`extensions/notion-sync/package.json`（displayName の日本語化）
- `product.json`（`extensions.allowed` から `MS-CEINTL.vscode-language-pack-ja` を外した）
- `resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`、`code-icon.svg`、`letterpress-*.svg` の4つ（アイコン）

21単位は r4 と同じに当たった（`checks.json`: 21単位すべて `applied: ok`、`stoppedAt: null`。警告はいつもの C-2 の `debugChatIntegration.ts が本家に無い` の1件だけ）。lockfile の検査は ok。後処理: product.json の commit が HEAD と一致、消した拡張の残り 0、`missingOwn: []`、LICENSE と ThirdPartyNotices あり。

注: パックの訳の束（`extensions/language-pack-ja/dist/translations/`）は、作業ツリーでは git の管理の外（本家の `.gitignore` の `dist`）なので、上の差分にも枝 `builds/…` の commit にも入らない。notion-sync の `dist/` と同じ。束は apply が写し、出力には入っている（`checks.json` の `builtinExtensions` で language-pack-ja は98ファイル = `package.json`・`README.md`・`ThirdPartyNotices.txt` と束の95）。

### 5.3 r5 に入っている束（鍵の直しの前）

- 追加の指示（bundle の鍵の直し）を受けた時点で、r5 はパッケージ化の途中だった。指示の「すでにパッケージ化が済んでいれば、作り直さずにその旨を報告」に当たるとみて、作り直していない。
- r5 の `extensions/language-pack-ja/dist/translations/extensions/vscode.git.i18n.json` は直す前のもの（`ș` の鍵だけ）。それ以外の束は、今のリポジトリと同じ（1.4 で変わったのは git の1ファイルだけ）。
- 画面への影響: git の2件の文言（`{0} ↔ {1}` と `{0} ({1}) ↔ {0} ({2})`。差分の題の書式）が英語の束のまま出る。訳しても同じ文字なので、見た目は変わらない。
- 作り直すなら、新しいラベル（例 `1.146.0-p5-c-all-r6`、作業ツリー `tmp/b/wt/r6/w`）で初めから作るのが確か（同じラベルの作り直しは zip の上書きと作業ツリーの削除が要り、許可の外）。所要は約20分。リーダーの判断を待つ。

## 6. 起動の確かめと count の結果

### 6.1 起動の確かめ

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip tmp/b/dist/1.146.0-p5-c-all-r5.zip -Dest tmp/b/p2/1.146.0-p5-c-all-r5 -InstallExtension tmp/b/cache/vsix/detachhead.basedpyright-1.40.2,tmp/b/cache/vsix/ms-vscode.powershell-2025.4.0,tmp/b/cache/vsix/mads-hartmann.bash-ide-vscode-1.43.2,tmp/b/cache/vsix/mechatroner.rainbow-csv-3.24.1,tmp/b/cache/vsix/weixu.wx-vsce-dotenv-0.2.3,tmp/b/cache/vsix/tomoki1207.pdf-1.2.2 -OutFile tasks/2026-11-17-icon-ja-build/launch-check-p5-c-all-r5.json
```

- 終了コード 0、`result: ok`。message `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。
- `--version` は `1.146.0` / `027caf9afae37fe28643315867577ba2e4ba97d6` / `x64`。
- VSIX は6つ（r4 の7つから古い日本語パックを外した）。すべて `successfully installed`。
- ワークベンチの3つのしるし（拡張ホストの起動、`Extension host … started`、`Eager extensions activated`）はすべて true。コンソールの `Uncaught` は 0（ワークベンチ 0、ほか 0）。
- 普段使いのデータのフォルダ（`%APPDATA%\Shuko`・`%USERPROFILE%\.shuko` など6つ）は変わっていない。
- 言語パックの一覧（展開先の `portable/user-data/languagepacks.json`）: `ja`（label「日本語」）の `extensions` が `shuko.language-pack-ja` 1.146.0 と `shuko.notion-sync` 0.0.1。`translations.vscode` が `…\Shuko-win32-x64-1.146.0-p5-c-all-r5\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json` を指す。組み込みのパックが1回目の起動で登録された。画面が日本語で出たかは見ていない（この確かめは画面を見ない）。

### 6.2 count

| 文言の表 | パック | 未訳（除外の外） | 結果 |
|---|---|---|---|
| `tmp/l10n/strings-1.146.0-r5.json`（直した extract。r5 の出力と作業ツリー） | r5 の出力 `…/resources/app/extensions/language-pack-ja` | **2**（bundle の `vscode.git` の `{0} ↔ {1}`・`{0} ({1}) ↔ {0} ({2})`） | `untranslated`、終了コード 5（`l10n-count-r5-fixed-extract.json`） |
| `tmp/l10n/strings-1.146.0-r4.json`（直す前の extract。r4。本体と拡張のソースは r5 と同じ） | r5 の出力 | 0 | `ok`（`l10n-count-r5-old-extract.json`） |
| `tmp/l10n/strings-1.146.0-r5.json` | リポジトリの今のパック（鍵を直した束） | 0 | `ok`（`l10n-count-repo-pack-fixed.json`） |

- どれも全体 15,159（本体 12,334、package 1,258、bundle 1,545、直書き 22）、除外 5、`staleExclusions: []`、`placeholderProblems: []`。
- 結論: r5 の出力は、実行時の鍵で数えると未訳 2（書式だけの文言）。リポジトリの束で作り直せば 0 になる。依頼書の完了条件「count で除外の外の未訳 0」は、r5 のままでは満たさない。
- extract のコマンド: `node scripts/l10n-ja.mjs extract --app tmp/b/wt/r5/VSCode-win32-x64/resources/app --worktree tmp/b/wt/r5/w --label 1.146.0-p5-c-all-r5 --out tmp/l10n/strings-1.146.0-r5.json`（gulp の出力から作った。展開した版のフォルダと同じ中身）。

### 6.3 出力の中身

- `resources/app/extensions/language-pack-ja/` がある（`package.json`、`dist/translations/main.i18n.json` と拡張の94）。`count` がここから読めた。
- アイコン: `resources/app/resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png` が `assets/` とバイト単位で同じ（`make-icons.mjs --check --out <app>` の3つが「同じ」）。`code.ico` の SHA-256 は `9ffbff5a635f490a33c8b266b4a107ae027c2706327255f527537ce69f325fbc`（作業ツリーの `resources/win32/code.ico` も同じ）。SVG の5つは出力では `out/media/` と `out/vs/workbench/browser/…/media/` にあり、SHA-256 が `assets/` と同じ（`code-icon.svg` `2dc63505…a8ad0`、`letterpress-light` `a20023ef…b95a`、`-dark` `d059254e…6727`、`-hcLight` `7936e3de…9a51`、`-hcDark` `ed919272…9b94`）。`--check --out <app>` は SVG の場所が `src/` の形なので「違う」（無い）と出て終了コード 1 になるが、これは場所の違いで、中身は上のとおり同じ。
- 実行ファイル（`Shuko.exe`）に埋め込まれたアイコンは、バイト単位では確かめていない。本家は `rcedit` で作業ツリーの `resources/win32/code.ico` を埋め込む（`assets/README.md` の表）。画面で見るのは入れ替えの後（8節）。

## 7. 大岡越前守の関門に渡すこと

| 項目 | 値 |
|---|---|
| ラベル | `1.146.0-p5-c-all-r5` |
| zip | `tmp/b/dist/1.146.0-p5-c-all-r5.zip`、SHA-256 `21d9ab57cce61078527d34429960521936c77a574589d213811a75a3401ce613`、220,100,928 バイト |
| 版のフォルダ | `tmp/b/p2/1.146.0-p5-c-all-r5/Shuko-win32-x64-1.146.0-p5-c-all-r5`（`resources/app` がその下） |
| 作業ツリー | `tmp/b/wt/r5/w`（HEAD `027caf9afae37fe28643315867577ba2e4ba97d6`） |
| gulp の出力 | `tmp/b/wt/r5/VSCode-win32-x64` |
| 記録 | `tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r5/build-record.json`・`checks.json`・`lockfile.diff`、`launch-check-p5-c-all-r5.json` |
| パック（出力） | `tmp/b/p2/1.146.0-p5-c-all-r5/Shuko-win32-x64-1.146.0-p5-c-all-r5/resources/app/extensions/language-pack-ja` |
| パック（リポジトリ。鍵を直した束） | `extensions-src/language-pack-ja` |
| 除外 | `extensions-src/language-pack-ja/exclusions.json`（5件） |

関門で見てほしいこと:

1. **スモーク**: 前の関門と同じ手順で。r4 との違いは5.2の14ファイル（アイコン・日本語パック・displayName・`extensions.allowed`）だけ。
2. **未訳の網**（曹参の `tests/l10n-audit.mjs`）: r5 の出力のパックで走らせると、bundle の git の2件が未訳に出る見込み（5.3）。曹参の追加の除外（`extra-exclusions-bundle-escape.json`）を重ねれば通る。リポジトリのパックを渡せば、追加の除外なしで通る見込み。r5 を関門に通すか、作り直した版で関門を行うかはリーダーの判断。
3. **アイコン**: 6.3 の照らし（PNG・ICO・SVG が `assets/` と同じ、`assets/` が台本の A の出力と同じ）。画面で見る確かめ（タスクバー・タイトルバー・透かし）は入れ替えの後。
4. `count` の結果は6.2。`l10n-ja.mjs count` は大岡越前守の許可に無いので、出力の JSON（`l10n-count-*.json`）を見てほしい。

## 8. 入れ替えのときの手順（許可が入ってから。今回はしていない）

前提: Team の開発部から、蒙恬に `--uninstall-extension` の許可が入っていること（`tasks/2026-11-17-l10n-ja/permission-requests.md`）。入れ替えは課が行う（裁定 2026-11-16）。入れる版は、関門に通った版（r5 か、作り直した版）。

1. 日常の Shuko を閉じる（`switch.ps1` は動いている Shuko があると止まる）。今、日常の Shuko は動いている（`tests/move-off-c.test.mjs` の1件が `editor-running` で落ちた。10節）。
2. 古い日本語パックを外す: `C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --uninstall-extension MS-CEINTL.vscode-language-pack-ja`。今の版（r4）の CLI で外す。入ったままだと、後から読まれる利用者の拡張（古い 1.131.0 の訳）が組み込みのパックに勝つ。
3. 版を入れる: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-2 -Zip tmp/b/dist/<版の zip> -Sha256 <zip の SHA-256>`。版のフォルダのラベルは「本家のタグ-ビルドの番号」（docs/02 の6節、docs/install.md の97行）なので、今の `1.146.0-1` の次の `1.146.0-2` にする見込み（ラベルはリーダーが決める）。
4. 台帳の拡張をそろえる: `node scripts/install-extensions.mjs`。台帳は7件。古いパックが残っていれば終了コード 3 で止まり、外し方の説明が出る（`retiredNotes`）。
5. Shuko を2回起動する。言語パックの一覧（`%APPDATA%\Shuko\languagepacks.json`）は起動のたびに共有のプロセスが作り直し、本体はそれより前に一覧を読むので、日本語になるのは2回目の起動からの見込み（確かめていない）。
6. 確かめる:
   - `%APPDATA%\Shuko\languagepacks.json` の `ja` の `extensions` が `shuko.language-pack-ja`（と `shuko.notion-sync`）で、`translations.vscode` が `<installRoot>\versions\<ラベル>\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json` を指す。`MS-CEINTL.vscode-language-pack-ja` が無い。`%APPDATA%\Shuko\` は私の `read_paths` に無いので、読む許可が要る（依頼書の1節の注）。
   - 画面: 画像を開いたときの「画像プレビュー」、エディターの透かしの「エディターのショートカット」、ヘルプの「バージョン情報」のダイアログ（Shuko のパッチの文言）が日本語。
   - アイコン: タスクバー・ウィンドウ・スタートメニュー（`code.ico`）、タイトルバーの左（`code-icon.svg`）、エディタが空のときの透かし（明るいテーマと暗いテーマ）が A の意匠。Windows はアイコンを覚えておくので、スタートメニューやタスクバーに古いアイコンが残ることがある（推定。確かめていない）。そのときはショートカットを作り直すか、ピン留めをし直す。
7. 戻すとき: `switch.ps1 -Previous`。r4 には組み込みのパックが無いので、戻した版で日本語にするには古いパックを入れ直す（今の台帳には無いので `install-extensions.mjs` は入れない。VSIX `tmp/b/cache/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0` から入れる）。

## 9. docs/ との食い違い・リーダーの判断が要る点

1. **r5 を作り直すか**（5.3）。作り直すなら新しいラベルで初めから（約20分）。
2. **取り込みのときの `count` の置き場所**（3節）: `records/take-in/<label>/` は私の書き込み先に無い。許可を足すか、`take-in.mjs` に `extract` と `count` を足して自動で材料に置くか。
3. **`TAKE-IN.md` の1節の4「入れ替えはユーザーが行う」**は、2026-11-16 の裁定（入れ替えは課が行う）と合わない。`claude -p`（修理・判定）が `switch.ps1` などを走らせない、という決まりは今も正しいので、直すとしても後半の文だけ。規約の文なので、私は変えていない。
4. **公式の訳の印の誤り（5件）**: 強めた照らしを公式の訳に当てると合わないもの。どれも画面に出る文言で、直すなら課の上書き（`override`）で直せる。
   - `vs/workbench/contrib/workspace/browser/workspaceTrustEditor` の `workspaceTrustEditorHeaderActions`: 訳が `[設定の構成] ({0})` で、`]` と `(` の間に空白があり、リンクが切れる（英語は `[Configure your settings]({0})`）
   - `vs/workbench/contrib/search/browser/anythingQuickAccess` の `openLinkToSide`: 訳に `({0})`（キーの表示）が無い
   - `vs/workbench/contrib/files/browser/files.contribution` の `fileNestingPatterns`: 訳で `{capture}` が `$(capture)` になっている
   - `emptyTextEditorHint` の2件: 訳で `]]` と `(` の間の空白が消え、`[[…]]({0})` がリンクの形になった（英語は `[[…]] ({0})`）。画面にどう出るかは確かめていない
5. **パックの束に、下の層（vscode-loc の main 640鍵、Open VSX 1.131.0 683鍵）の訳が入っている**（`build` の `packKeys`）。今の版の文言の表に当たる訳は PR #2450 と課の訳だけ（`provenanceForStrings`）で、下の層の鍵は本体が引かない。ただ、ファイルとしては入っているので、`ThirdPartyNotices.txt`（vscode-loc の MIT の表示だけ）に Open VSX のパック（MS-CEINTL、"SEE MIT LICENSE IN LICENSE.md"）の出典も足すかは、M3 の続きとしてリーダーの判断。束から下の層の、表に無い鍵を外す形にもできる。
6. **docs/02 の43行目**（前の引き継ぎから持ち越し）: 「`make-icons.mjs` assets/ の PNG・ICO を自作の意匠で書き出す」が、今の台本（SVG も書く、意匠は他者の絵を使う A）と合わない。`copy-icon-sources.mjs`・`scripts/icon-src/` もリポジトリの一覧に無い。
7. **docs/04 の7節の7「数える」**: `count` が足した訳の印も照らすようになったこと、`extract` が `\u` の書き方を直して読むこと（1.4）は、まだ書かれていない。
8. 依頼書の「作業ツリーは `tmp/b/wt/<名前>`」から外れて `tmp/b/wt/r5/w` にした理由は5.1。次から同じ形にするなら、依頼書のひな形の書き方を改めるとよい。

## 10. 走らせたテスト

すべて `node scripts/l10n-probe.mjs test …`（中で `node --test --test-reporter=tap` を呼ぶ。私の Bash の許可では `node --test` の出力を絞れないため）。

| ファイル | 件数 | 結果 | いつ |
|---|---|---|---|
| `make-icons` | 33 | 全部通る | A を既定にした後 |
| `apply-parts`・`l10n-audit`・`builtin-l10n`・`install-ext`・`build-parts`・`move-off-c` | 200 | 199 通る、1 落ちる | M1・M2 の後 |
| `watch`・`lock`・`cli-run`・`build-env-branch` | 262 | 全部通る | M1・M2 の後 |
| `removals`・`take-in`・`take-in-more`・`apply` | 400 | 全部通る | M1・M2 の後（要約は `tmp/probe-test-1.txt`） |
| `l10n-lib`・`l10n-repo`・`l10n-audit`・`l10n-audit-more`・`make-icons`・`apply-parts`（曹参が足したものを含む） | 256 | 254 通る、1 落ちる、1 todo | 鍵の直しの後（要約は `tmp/probe-test-2.txt`） |

落ちた2件:

- `move-off-c.test.mjs` の「PowerShell 側の部品（local-config.ps1）の既定も同じ（configure.ps1 の出力）」: `configure.ps1` が `result: editor-running`（日常の Shuko が動いている。`C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe` の2つの pid）で止まった。今回の変更と関係しない、環境の都合。
- `l10n-audit-more.test.mjs` 479行（1.4 の「曹参へ」）: 鍵を直した結果として想定どおり。曹参がテストを直す。

## r6（リーダーの判断の後。`docs/user-decisions.md` の「記録（2026-11-17、版 r5 のビルドで出た点）」）

r5 は関門に使わない。次の 1〜4 を済ませてから、版 `1.146.0-p5-c-all-r6` を作った。

### r6-1. 公式の訳の印の誤り5件を上書きで直した

入力 `tasks/2026-11-17-icon-ja-build/l10n-input-official-fixes.json`（`override`）を `node scripts/l10n-ja.mjs add --strings tmp/l10n/strings-1.146.0-r5.json --input <それ> --version 1.146.0` で `added/1.146.0.json` に書いた。訳は公式の訳を元にし、印の所だけを英語に合わせた。

| モジュール・鍵 | 直したこと |
|---|---|
| `vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint` の `emptyTextEditorHintWithInlineChat` | `[[コードの生成]]({0})` → `[[コードの生成]] ({0})`（英語と同じく `]]` と `(` の間に空白。空白が無いと Markdown のリンクの形になる） |
| 同じモジュールの `emptyTextEditorHintWithoutInlineChat` | `[[言語の選択]]({0})` → `[[言語の選択]] ({0})` |
| `vs/workbench/contrib/files/browser/files.contribution` の `fileNestingPatterns` | `` `$(capture)` `` → `` `${capture}` ``（設定の書き方そのもの。公式の訳では codicon の書き方に化けていた）。あわせて、改行を英語と同じ LF にし（公式は CRLF）、「ベース名 、」などの読点の前の余分な空白を3か所取った |
| `vs/workbench/contrib/search/browser/anythingQuickAccess` の `openLinkToSide` | 「横に並べて開く」→「横に並べて開く ({0})」（キーの表示 `{0}` が公式の訳で抜けていた） |
| `vs/workbench/contrib/workspace/browser/workspaceTrustEditor` の `workspaceTrustEditorHeaderActions` | `[設定の構成] ({0})` → `[設定の構成]({0})`（空白でリンクが切れていた） |

- `added/1.146.0.json` は 198件（足した訳 184、上書き 14）。SHA-256 `3b4e12cb4557dd993ba24a2c90854247400c5cfb9461ed82ff3e3bf093d9fb82`。
- 束を `node scripts/l10n-ja.mjs build --strings tmp/l10n/strings-1.146.0-r5.json --out tasks/2026-11-17-icon-ja-build/l10n-build-r6.json` で作り直した（`result: ok`、未訳 0、staleAdded 0）。`main.i18n.json` は `880f255a978942cee18e9ca4bfdd2bb88bb4358f59d16eb3ff0b404a410dea39`（3,653,167 バイト）、`vscode.git.i18n.json` は 1.4 と同じ `83751fa7…b753`。
- `count`（リポジトリのパック、r5 の表）: 除外の外の未訳 0、`placeholderProblems: []`（`l10n-count-repo-pack-r6prep.json`）。

### r6-2. ThirdPartyNotices.txt に下の層の出典を書いた

- `scripts/lib/l10n-ja.mjs` に `thirdPartyNotice(sources, licenses)` を足した（純粋な部品）。`sources.json` の訳の元を、勝つ順にすべて出典として並べる。vscode-loc は repo・commit・日付と「MIT（下に写す LICENSE.md）」。VSIX は ID・版・Open VSX の URL・SHA-256、manifest の repository と license の文、「VSIX に LICENSE.md が無いので、その repository の LICENSE.md を下に写す」。`licenses`（`[{ sha256, text }]`）は同じ SHA-256 を1つにまとめて写す。
- `l10n-ja.mjs build` はこれで `ThirdPartyNotices.txt` を書く（前は先頭の vscode-loc だけを書いていた）。束から鍵は外していない。
- `sources.json` の Open VSX の項目に `"repository": "https://github.com/Microsoft/vscode-loc"` を足した（VSIX の `extension/package.json` の `repository.url` を読んで確かめた値）。VSIX の中に LICENSE のファイルが無いことも、中の一覧で確かめた（`extension/` の下は package.json・languagepack.png・readme.md・changelog.md・translations だけ）。vscode-loc の main と PR #2450 の `LICENSE.md` は同じ SHA-256（`d8428ce0…a144`）なので、写すのは1つ。
- できた `ThirdPartyNotices.txt`: 2,602 バイト、SHA-256 `b84006fa94e5eadb3c735d5a2328c10f7575f68119e993fda2b2c43302704da4`。

### r6-3. TAKE-IN.md の「入れ替えはユーザーが行う」を直した

1節の4を「入れ替えは、判定の後に課が行う（2026-11-16 の裁定。前は「ユーザーが行う」）」にした。`switch.ps1`・`install-extensions.mjs` を `claude -p` が実行しない決まりはそのまま。`scripts/take-in.mjs` の冒頭の説明にも同じ文があったので直した。

### r6-4. take-in.mjs がビルドの後に未訳を数える

`scripts/take-in.mjs`（本体の取り込み `core`）:

- 手順 5（ビルド）の後、スモークの前に、`l10n-ja.mjs extract` → `count` を走らせる。新しい版の `resources\app` は `resolveEditorLayout(ctx.editorDir)` で決める（展開した版のフォルダか gulp の出力）。
  - 表: `<buildRoot>\take-in\<label>\l10n-strings.json`（大きいので記録には置かない）
  - 結果: `records/take-in/<label>/l10n-count.json`（判定の材料。`judge` の材料の一覧に自動で載る）と、`take-in.json` の `l10n`
  - ログ: `records/take-in/<label>/logs/l10n-extract.log`・`l10n-count.log`
- 数えるだけで、採否は止めない。`ok` でなければ `warnings` に1行足す（判定の依頼の notes に入る）。失敗しても `Stop` しない。
- 走るのは、ビルドの記録が `result: ok` のときで、手順 5 を走らせた回か、`l10n-count.json` がまだ無いとき（`--from smoke` などで続きからでも、数え漏れないように）。
- 書き出した関数（テストの入口）:
  - `l10nPlan(ctx, appDir = "<app>")` → `{ strings, out, extract: { cmd, args, cwd }, count: { cmd, args, cwd } }`。`--dry-run` の `plan.l10n` にも出る
  - `summarizeL10nCount(exitCode, out)` → `{ status, exitCode, result, untranslated, total, excluded, byArea, placeholderProblems }`。`status` は終了コード 0 なら `ok`、5 なら `untranslated`、ほかは `failed`。`out.result === "placeholder"` なら `failed`。`out` が無いときは `{ status: "failed"（0 のときも）, exitCode, reason: "l10n-count.json が無い" }`
- 確かめ: `node scripts/take-in.mjs core 1.147.0 --label 1.147.0-dryl10n --commit 69047191… --prev-tag 1.146.0 --dry-run` の `plan.l10n` に、上のとおりの extract と count が出た（`recordDirExists: false`。何も書いていない）。実物の取り込みでは走らせていない（新しいタグが無い）。
- `TAKE-IN.md` の4節: 前置きに「数えるのは `take-in.mjs` が自動で行い、訳して作り直すのは課が手で行う」と書き、4.2 の2・3 を「自動」にして、表と結果の置き場所、`take-in.json` の `l10n`、失敗のときの扱いを書いた。4.2 の6 の ThirdPartyNotices の文も r6-2 に合わせた。`records/` の許可は足していない（書くのは台本）。

### r6-5. 版 1.146.0-p5-c-all-r6

| 項目 | 値 |
|---|---|
| ラベル | `1.146.0-p5-c-all-r6` |
| コマンド | `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r6 --worktree tmp/b/wt/r6/w --take-in-dir tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r6 --record tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r6/build-record.json`（1回で `result: ok`、`warnings: []`） |
| zip | `tmp/b/dist/1.146.0-p5-c-all-r6.zip`（220,102,376 バイト、2,139 項目、先頭のフォルダ `Shuko-win32-x64-1.146.0-p5-c-all-r6`） |
| zip の SHA-256 | `a70b0a1cb3525b64775024840199fca2aca183c142f83bb88a50a941e0b55f09`（記録の値と、計算し直した値が一致） |
| 版のフォルダ（展開したもの） | `tmp/b/p2/1.146.0-p5-c-all-r6/Shuko-win32-x64-1.146.0-p5-c-all-r6` |
| gulp の出力 | `tmp/b/wt/r6/VSCode-win32-x64`（新しいフォルダ。何も消していない） |
| 作業ツリー | `tmp/b/wt/r6/w`（HEAD `3e1e616aa9f1538643a070f0684196c0cd688ddd`、枝 `builds/1.146.0-p5-c-all-r6` を作った） |
| 所要時間（秒） | prepare 132.7、apply 71.7、install 603.9、lockfile 0.7、typecheck 8.3、package 69.8、postprocess 0.01、zip 19.5。全体 15分24秒（00:30:14Z〜00:45:38Z） |
| 記録 | `1.146.0-p5-c-all-r6/build-record.json`・`checks.json`・`lockfile.diff`、`launch-check-p5-c-all-r6.json`、`l10n-count-r6.json`・`l10n-count-r6-unpacked.json` |

中身:

- `checks.json`: 21単位すべて `applied: ok`、`stoppedAt: null`。language-pack-ja は98ファイルを写した。lockfile の検査 ok。後処理 ok（product.json の commit が HEAD と一致、残りの拡張 0、`missingOwn: []`）。
- r5 の木との差（`git -C tmp/b/wt/r4 diff --stat 027caf9a 3e1e616a`）は `extensions/language-pack-ja/ThirdPartyNotices.txt` の1ファイルだけ（r6-2）。訳の束（`dist/translations/`）は git の外なので差分に出ないが、作業ツリーの `main.i18n.json` はリポジトリと同じ `880f255a…ea39`。
- 出力の束は、パッケージ化で JSON の空白が詰められる（`main.i18n.json` が 3,653,167 → 3,482,706 バイト。r5 も同じく詰められていた）。中身は上書きの5件が入っていることを出力の `main.i18n.json` で見た（例 `"openLinkToSide":"横に並べて開く ({0})"`、`"workspaceTrustEditorHeaderActions":"[設定の構成]({0}) または …"`）。`ThirdPartyNotices.txt` は出力でもリポジトリと同じ `b84006fa…04da4`。

起動の確かめ（`p1-launch-check.ps1`、VSIX は r5 と同じ6つ）:

- 終了コード 0、`result: ok`、message `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。
- `--version` の commit は `3e1e616aa9f1538643a070f0684196c0cd688ddd`。6つの VSIX はすべて `successfully installed`。ワークベンチの3つのしるしは true、`Uncaught` は 0（ワークベンチ 0、ほか 0）。普段使いのデータのフォルダの変化は無い。
- 展開先の `languagepacks.json`: `ja` の `extensions` は `shuko.language-pack-ja` 1.146.0 と `shuko.notion-sync` 0.0.1、`translations.vscode` は `…\Shuko-win32-x64-1.146.0-p5-c-all-r6\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json`。

`count`（直した extract。`node scripts/l10n-ja.mjs extract --app tmp/b/wt/r6/VSCode-win32-x64/resources/app --worktree tmp/b/wt/r6/w --label 1.146.0-p5-c-all-r6 --out tmp/l10n/strings-1.146.0-r6.json`）:

| パック | 全体 | 除外 | 除外の外の未訳 | `placeholderProblems` | 結果 |
|---|---|---|---|---|---|
| gulp の出力 `tmp/b/wt/r6/VSCode-win32-x64/resources/app/extensions/language-pack-ja` | 15,159 | 5 | **0** | 0 | `ok`（`l10n-count-r6.json`） |
| 展開した版のフォルダ `tmp/b/p2/1.146.0-p5-c-all-r6/…/resources/app/extensions/language-pack-ja` | 15,159 | 5 | **0** | 0 | `ok`（`l10n-count-r6-unpacked.json`） |

- 内訳: 本体 12,334（除外 5）、package 1,258、bundle 1,545、直書き 22。どれも未訳 0。`staleExclusions: []`。
- 表の `escapeFixes` は r5 と同じ git の1件（`↔` の2つの鍵）で、今は束に実行時の鍵がある。

アイコン（展開した版のフォルダ）: `resources/app/resources/win32/` の `code.ico`・`code_70x70.png`・`code_150x150.png` は `make-icons.mjs --check --out <app>` で「同じ」。SVG の5つ（`out/media/`）は `assets/` と SHA-256 が同じ（`code-icon.svg` `2dc63505…a8ad0` ほか、r5 の6.3 と同じ値）。`--check --out <app>` の終了コード 1 は、SVG の場所が `src/` の形で無いためで、r5 と同じ。

### r6-6. 大岡越前守の関門に渡すこと

| 項目 | 値 |
|---|---|
| ラベル | `1.146.0-p5-c-all-r6`（r5 は関門に使わない） |
| zip | `tmp/b/dist/1.146.0-p5-c-all-r6.zip`、SHA-256 `a70b0a1cb3525b64775024840199fca2aca183c142f83bb88a50a941e0b55f09` |
| 版のフォルダ | `tmp/b/p2/1.146.0-p5-c-all-r6/Shuko-win32-x64-1.146.0-p5-c-all-r6` |
| 作業ツリー | `tmp/b/wt/r6/w`（HEAD `3e1e616aa9f1538643a070f0684196c0cd688ddd`） |
| gulp の出力 | `tmp/b/wt/r6/VSCode-win32-x64` |
| パック（出力） | `…/resources/app/extensions/language-pack-ja` |
| 除外 | `extensions-src/language-pack-ja/exclusions.json`（5件。追加の除外なし） |

- スモーク: r4 との違いは r5 の5.2 の14ファイルと `ThirdPartyNotices.txt`、それに束の中身（上書き14件・足した訳184件）。
- 未訳の網: 出力のパックで、追加の除外なしに通る見込み（`count` は 0）。
- アイコン: 上のとおり。
- 入れ替えの手順は8節のまま（入れる版は r6、zip と SHA-256 は上）。入れ替えと拡張を外す操作はしていない。

### r6-7. 走らせたテスト

- `take-in`・`take-in-more`・`l10n-lib`・`l10n-repo`・`l10n-audit`・`l10n-audit-more`: 310件すべて通る（r6-1〜r6-4 の後。要約 `tmp/probe-test-3.txt`）。1.4 で落ちると書いた `l10n-audit-more` の479行は、曹参が直した後で通っている。
- `node --check scripts/take-in.mjs`・`scripts/l10n-ja.mjs`・`scripts/lib/l10n-ja.mjs`: 通る。

### r6-8. テストの入口（曹参へ）

- `thirdPartyNotice(sources, licenses)`（`scripts/lib/l10n-ja.mjs`）: 訳の元が並び順に番号つきで出る。`kind: "vsix"` は `repository` と `license` の文と「VSIX contains no LICENSE.md」の行。`licenses` の同じ `sha256` は1つにまとまる。`licenses` が空なら許諾の文は出ない（build は vscode-loc が無ければ書かない）。
- `l10nPlan(ctx, appDir)`・`summarizeL10nCount(exitCode, out)`（`scripts/take-in.mjs`）: r6-4 のとおり。`--dry-run` の `plan.l10n` でも見られる。
- リポジトリの整合: `added/1.146.0.json` の上書き（`override: true`）は14件。`ThirdPartyNotices.txt` に `62d5443b…`（main）と `MS-CEINTL.vscode-language-pack-ja 1.131.0` が出る。

### r6-9. 残る点

- 9節の6（docs/02 の43行目）と7（docs/04 の7節の7）は、まだ資料に入っていない（リーダー）。r6-4 で、docs/06 の取り込みの手順に「ビルドの後に未訳を数える」も足すことになる。
- `scripts/l10n-probe.mjs` に `keys`・`zipls`・`zipcat` を足した（使い捨て。コミットしない）。`tmp/handoff-table.txt` は誤って作った空のファイル（私は消せない）。

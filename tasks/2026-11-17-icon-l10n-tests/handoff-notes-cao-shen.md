# 曹参の引き継ぎ: アイコンのテストと日本語の未訳の網

日付: 2026-11-17。蒙恬の引き継ぎ（`tasks/2026-11-17-icon/`・`tasks/2026-11-17-l10n-ja/` の `handoff-notes-meng-tian.md`）は、作業の終わりの時点でまだ無かった。入口は仕様（docs/04 の7節、両方の依頼書）から想定した。蒙恬の実装は読んでいない。

## 作ったもの

| パス | 内容 |
|---|---|
| `tests/l10n-audit.mjs` | 日本語の未訳を数える台本（独立の数え方）。`auditL10n()` を export し、CLI でも動く |
| `tests/l10n-audit.test.mjs` | その台本のテスト（模擬の本体とパックで13件、実物で1件） |
| `tests/make-icons.test.mjs` | 直した。意匠に固有の検査（白い画素）を外し、どの候補でも成り立つ検査（下記）を足した |
| `tasks/2026-11-17-icon-l10n-tests/l10n-audit-current.json` | 今の版（1.146.0-1）と 1.131.0 のパックでの網の結果 |
| `tasks/2026-11-17-icon-l10n-tests/audit-run-pack1131.json` | 上と同じ内容（走らせ直しで余分にできた。消して構わない。私は削除できない） |
| `tests/probe-l10n.mjs` | 形を調べた使い捨て。消して構わない |

## 日本語の網

数え方は本家と同じ引き方（`src/vs/base/node/nls.ts` の `resolveNLSConfiguration`）。
- 本体: `out/nls.keys.json` の `[moduleId, keys[]]` を順に引き、`translations/main.i18n.json` の `contents[moduleId][key]` が空でなければ「訳がある」。無い・空なら未訳。同じ鍵名が別モジュールにあっても混ざらない。
- 拡張: `extensions/*/package.nls.json`（`{message, comment}` 形も読む）を、パックの `contents.package[key]` で引く。ファイルはパックの `package.json` の `contributes.localizations[].translations`（id から path）で探し、無ければ `<ID>.i18n.json`。ID は `package.json` の publisher.name。
- `bundle`（拡張のコードの `l10n.t` の文言）は数えない。組み込み拡張には `l10n/` が無く、英語の元の一覧がビルドに無いため。パック側の件数も出していない。
- 原文と同じ訳は「訳がある」に数え、`sameAsEnglish` に別に出す。
- `package.nls.json` を持たない組み込み拡張（`shuko.mydist`・`shuko.notion-sync`・`shuko.plain` 相当）は数えず、`extensionsWithoutNlsFile` に出す。**Shuko の2つの拡張の `package.json` の英語の表示文言は、この網では数えていない**（下の「蒙恬に確かめたいこと」）。

走らせ方:

```
node tests/l10n-audit.mjs [--app <resources/app>] [--pack <パックのフォルダ>] [--exclude <除外.json>] [--clp <clp/<id>.ja>] [--out <出力.json>] [--strict]
node --test tests/l10n-audit.test.mjs
```

- `--app` の既定は日常の版 `%LOCALAPPDATA%\Programs\Shuko\versions\1.146.0-1\resources\app`、`--pack` の既定は `%USERPROFILE%\.shuko\extensions\ms-ceintl.vscode-language-pack-ja-1.131.0`。
- `--pack` は、パックの拡張のルート（`package.json` と `translations/`）でも、`translations/` そのものでもよい。
- `--clp` は、本体が実際に作った `nls.messages.json` が、この台本の引き方の結果と一致するかの照合。
- `--strict` は除外の外の未訳が1件でもあれば終了コード 1。引数の誤り・パックが読めないときは 2。
- 出力 JSON: `core` と `extensions.<ID>` ごとに `total`・`translated`・`untranslated`・`sameAsEnglish`・`excluded`・`untranslatedOutsideExclusions`・`untranslatedKeys[]`。`pass` は「除外の外の未訳 0」かつ除外の書式に誤りが無いこと。
- 除外の一覧（任意。JSON の配列か `{"exclusions":[...]}`）の要素: `{module,key,reason}`（本体）、`{extension,key,reason}`（拡張）、`{messageRegex,scope?,reason}`（文言の正規表現）、`"module#key"` の文字列。**`reason` が無い・空の要素は効かず、`invalidExclusions` に出て不合格になる**。蒙恬の除外の一覧の形が違えば、台本の `loadExclusions` を合わせる（蒙恬の形を見てから直す）。

### 結果（今の版 1.146.0-1 と 1.131.0 のパック、除外なし）

| | 総数 | 訳あり | 未訳 |
|---|---|---|---|
| 本体 | 12,355 | 11,666 | 689 |
| 組み込み拡張（package.nls） | 1,258 | 1,205 | 53 |

- リーダーの粗い数え（約650）との比較: 厳密な未訳は 689 件で、大きくは食い違わない（差は約40件）。同じ粗い数えを本体が実際に使う文言（パックで置き換えた後）に当てると 768 件。これは「訳はあるが日本語を含まない」もの（`Git` のような固有名詞、`{0}` 付きの英字など）を含むため多い。粗い数えは未訳そのものではない。
- **本家の引き方で作った結果が、本体が実際に作った `clp\...ja\...\nls.messages.json` と12,355件すべて一致した**（差 0）。この台本の数え方は、本体が実際に使う結果と同じ。
- 拡張の未訳 53 件の内訳は `vscode.markdown-language-features` が52、`vscode.git` が1（ほかは0）。1.131.0 より後に増えた鍵とみられる（原因は確かめていない）。
- 除外の外の未訳は 742 件（本体 689 + 拡張 53）。除外の一覧はまだ無いので、合格にはならない（想定どおり）。

蒙恬のパックでの結果: **まだ走らせていない（パックが無い）**。パックができたら、次を走らせる。

```
node tests/l10n-audit.mjs --pack <蒙恬のパックのフォルダ> --exclude <蒙恬の除外の一覧> --out tasks/2026-11-17-icon-l10n-tests/l10n-audit-meng-pack.json --strict
```

## アイコンのテスト（`tests/make-icons.test.mjs`）

- 直した: `renderIcon` のテストの「中央の白い画素」を「中央の不透明な画素」に替えた（`>_` に固有だった）。ほかの書式（PNG・ICO・CRC・決定性）の検査はそのまま。
- 足した（`--out <dir>` の出力を見る。候補に依らない）:
  - `code.ico` の大きさが16・24・32・48・64・128・256 の7つで、中の PNG がその大きさ
  - 70×70・150×150 の PNG の大きさ
  - 256 px に VS Code の青の系統の画素と Claude の橙の系統の画素が、それぞれ256以上ある。最頻の橙が `#D97757` から（各成分の差の合計）60 以内。透明な画素があり、不透明が全体の10%超
  - 16 px で青・橙が各3以上、32 px で各10以上（alpha 128 以上）、150 px のタイルで各100以上
  - 2回の出力が全ファイル同じバイト列
  - SVG: `code-icon.svg` と `letterpress-{light,dark,hcLight,hcDark}.svg` の5つが出ること、よく形づくられていること（タグの釣り合い・`<svg>` の根・大きさの指定）、`<script>`・`<text>`・外部参照が無いこと、`code-icon.svg` に青と橙の色指定があること
- 候補の選び方: **蒙恬の引数が分からないので、環境変数 `ICON_TEST_ARGS_LIST` に渡す**。`;` 区切りで、1つごとに1回走る。例（引数が `--variant` だと決まったら）: `ICON_TEST_ARGS_LIST="--variant a;--variant b;--variant c" node --test tests/make-icons.test.mjs`。未指定なら引数なしの1回（台本の既定の意匠）。蒙恬の引数が決まったら環境変数なしで3つとも走る形に直す。
- 今の結果（蒙恬の実装がまだ既定の意匠のまま）: 23件のうち20件が通り、3件が落ちる。落ちるのは、今の台本（既定が青い角丸の四角に `>_`）に橙が無いこと、`--out` が SVG を書かないこと。**どちらも想定どおり（実装が候補をまだ出していないため）で、テストの誤りではない**。
- `makeIconFiles` の既存のテストは「3つのファイル（ico・70・150）」を前提にしている。蒙恬が戻りに SVG を足したり形を変えたりすると落ちる。変えたら、どれが落ちるかを蒙恬の引き継ぎに書いてもらい、テストの前提を直す。
- 既存の「`assets/` の下のファイルが台本の出力と同じ」のテストは、`assets/` を選ぶまで置き換えない約束なので通る。ユーザーが候補を選んで `assets/` を書き換え、既定を替えたら、台本の既定と同時に揃える。

## 蒙恬に確かめたいこと（実装と食い違うかもしれない所）

1. パックの除外の一覧の形（上の形で読めるか。`reason` が必須か）。
2. 日本語の網の対象に、Shuko の組み込み拡張 `shuko.notion-sync`・`shuko.mydist`（`package.nls.json` が無い）の表示文言を入れるか。入れるなら、どこに訳を置くか（`package.nls.json` を足すのが本家と同じ形）。今の網はこの2つを数えていない。
3. パックの拡張のファイルの組み方（`contributes.localizations` の `translations` に、`vscode`・各拡張の ID を載せるか）。載せないと網は拡張を「パックに無い」と数える。
4. アイコンの候補を選ぶ引数の名前と、`--out` が SVG を書く場所（相対のパスは問わず、拡張子が `.svg` のファイル名で探している）。

## 権限について

`%LOCALAPPDATA%` や `%USERPROFILE%` の下は、私の `read_paths`（`./` と `C:/b/`）の外なので、Read・Glob では読めない。結果の数え上げは、許可された `node tests/*.mjs` で台本が読む形で行った（台本の仕事そのものが日常の版とパックを読むこと）。台本は件数と未訳の鍵だけを出し、ファイルの全文は出していない。この形でよいかは確認してほしい。

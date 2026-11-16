# 蒙恬の引き継ぎ: アイコンの候補づくり

日付: 2026-11-17。依頼は `brief.md`。意匠の説明は `icon-variants.md`。

## 1. 変えたファイル

| パス | 変更 |
|---|---|
| `scripts/make-icons.mjs` | 意匠を `--variant` で選べるようにした。SVG のパスを折れ線にして塗る小さな描画の部品（走査線で塗り、縦は 16 本・横は区間の長さで縁を滑らかにする）を足した。SVG の5つ、見本の画像、`--check` も書けるようにした。今の意匠（`current`）の描き方と定数は変えていない |
| `scripts/copy-icon-sources.mjs`（新規） | 元の絵をリポジトリの中へ写し、出どころと SHA-256 を記録する台本 |
| `scripts/icon-src/vscode-code-icon.svg`（新規） | VS Code の元の絵の写し |
| `scripts/icon-src/claude-logo.svg`（新規） | Claude の元の絵の写し |
| `scripts/icon-src/SOURCES.json`（新規） | 上の2つの出どころと SHA-256 |
| `tasks/2026-11-17-icon/preview-*.png`・`out/<意匠>/` | 見本の画像と、候補ごとの書き出し一式 |

`assets/` は変えていない。`node scripts/make-icons.mjs --check` で、今の8つ（PNG・ICO の3つと SVG の5つ）が台本の既定の出力とバイト単位で同じことを確かめた。

## 2. 元の絵の写し

| 写し | SHA-256 | 写した元 |
|---|---|---|
| `scripts/icon-src/vscode-code-icon.svg` | `57270d907046995a87bb87c49a9e0ad683e87810718bcfa4c1d7ee6240400e13` | `tmp/b/official/vscode-1.146.0/69047191fc/resources/app/out/media/code-icon.svg` |
| `scripts/icon-src/claude-logo.svg` | `a3101f3047a119aa11825ad9369510f0c472428c8c52d420e31bc62db44a8364` | `tmp/b/cache/vsix/anthropic.claude-code-2.1.322@win32-x64/Anthropic.claude-code-2.1.322@win32-x64.vsix` の中の `extension/resources/claude-logo.svg`。VSIX の SHA-256 は `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4` で、同じフォルダの `.sha256` と一致した |

依頼書との違いが2つある。

- **Claude の絵は、依頼書の場所（`%USERPROFILE%\.shuko\extensions\anthropic.claude-code-2.1.322\resources\claude-logo.svg`）から写していない。** その場所は私の `read_paths`（`./`・`C:/b/`）の外で、Read が止まった。台本を通して読むと許可の回避になるので、それもしていない。代わりに、同じ版（2.1.322、win32-x64）の VSIX の中の同じファイルから取り出した。中身は `viewBox="0 0 24 24"`、塗り `#D97757` の1本のパスで、依頼書の説明と合う。入れた拡張のファイルと同じかは確かめていない。リーダーが確かめるなら、そのファイルの SHA-256 を上の `a3101f30…` と比べる。
- **写しは `cp` ではなく台本（`node scripts/copy-icon-sources.mjs`）で行った。** `cp` が私の Bash の許可に無いため。`--build-root <dir>` を省くと、`local.json` の `buildRoot`（無ければ `<リポジトリ>\tmp\b`）の下を読む。

写しの置き場所を `scripts/icon-src/` にしたのは、`apply.mjs` が `assets/` の下を（直下の `*.md` を除いて）すべて作業ツリーへ写すため。`scripts/` の下は作業ツリーへ写らない。`tests/move-off-c.test.mjs` の「`scripts/` に `C:\b` を書かない」「OS の一時フォルダを使わない」の2件は、足した台本でも通った（`.svg`・`.json` はこの検査の対象外）。

## 3. テストの入口の変化（曹参へ）

前からある入口は、名前も意味も変えていない。引数を足しただけ。

| 入口 | 変化 |
|---|---|
| `ICON_SIZES`・`crc32`・`encodePng`・`encodeIco` | 変えていない |
| `coverageAt(x, y)` | 変えていない（今の意匠 `current` だけの関数） |
| `renderIcon(size, samples?, variant?)` | 3つ目の引数 `variant` を足した（既定は `DEFAULT_VARIANT`）。`current` の `samples` は今までどおり1画素の縦横の点の数。候補では1画素の走査線の数（既定 16） |
| `makeIconFiles(variant?)` | 引数を足した。戻りは今までどおり3つ（`code.ico`・`code_70x70.png`・`code_150x150.png`）。SVG は入れていない |

足した入口:

| 入口 | 戻り |
|---|---|
| `VARIANTS` | `["current", "center-spark", "spark-badge", "dark-tile", "warm-ribbon"]` |
| `VARIANT_ALIASES` | `{ a: "center-spark", b: "spark-badge", c: "dark-tile" }` |
| `DEFAULT_VARIANT` | `"current"` |
| `resolveVariant(name)` | 正式の名前。短い名前（a・b・c）も受ける。知らない名前は例外。`variant` を受ける関数は、どれも短い名前を受ける |
| `makeSvgFiles(variant?)` | `[{ rel, data }]` の5つ。`rel` は `src/vs/workbench/browser/media/code-icon.svg` と `src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg`。`current` なら `assets/` の今の SVG と同じバイト列 |
| `renderLetterpress(size, variant)` | 長さ `size*size` の `Float32Array`（透かしの影絵の被覆 0〜1）。`current` は例外 |
| `makePreviewFiles(variant)` | `[{ rel, data }]`。`preview-<意匠>.png`（512×512）と `preview-<意匠>-sizes.png`。`"all"` なら全部の意匠の分と `preview-all.png` |
| `parsePathToPolygons(d, matrix?)` | SVG のパス（M L H V C S Q T A Z、大文字・小文字）を折れ線にした `Float64Array` の配列。`matrix` は `[a, b, c, d, e, f]` |

コマンド:

```
node scripts/make-icons.mjs [--variant <名前>] [--out <dir>] [--check] [--preview <dir>]
```

- `--out` を付けても付けなくても、8つ（PNG・ICO の3つと SVG の5つ）を書くようにした。**前は3つだけ書いていた。** 既定の `assets/` へ書いても、今の意匠なら中身は変わらない。
- `--check`: 何も書かずに、`<dir>`（既定 `assets/`）の8つが台本の出力と同じかを確かめる。同じなら終了コード 0、1つでも違えば 1。
- `--preview <dir>`: アイコンは書かず、見本の画像だけを書く。`--variant all` は `--preview` のときだけ使える（それ以外は終了コード 2）。
- `--check` と `--preview` を一緒に付けると終了コード 2。知らない引数・知らない意匠も 2 で、何も書かない。

曹参の確かめたいことの4（引数の名前と SVG の場所）への答え: 引数は `--variant`（`a`・`b`・`c` が使える）。SVG は `--out <dir>` の下の `src/vs/workbench/browser/media/code-icon.svg` と `src/vs/workbench/browser/parts/editor/media/letterpress-*.svg`。曹参の例 `ICON_TEST_ARGS_LIST="--variant a;--variant b;--variant c"` のまま動くはず。

## 4. テストの結果

`node --test tests/make-icons.test.mjs`（曹参が直した後の版。23件）:

- 既定（`current`）のまま: 20件が通り、3件が落ちる。落ちるのは意匠に固有の次の3件で、既定がまだ今の意匠なので想定どおり。
  - `design (default): 256 px has both VS Code blue and Claude orange pixels …`（橙が 0）
  - `design (default): both elements are still visible at 16 and 32 px …`（16 px の橙が 0）
  - `design (default): SVGs - … code-icon.svg has both a blue and an orange fill`（橙の色指定が無い）
- 書式の検査（PNG・ICO・CRC・決定性・3つのファイル・CLI）と「`assets/` の下が台本の出力と同じ」は、すべて通る。
- 候補ごとの確かめ: 環境変数を付けたコマンドは私の許可に無い。そこで `DEFAULT_VARIANT` を一時的に `center-spark`・`spark-badge`・`dark-tile` に替えて、それぞれ全件を走らせ、走らせた後に `current` へ戻した。3つとも、意匠の検査6件を含めて22件が通った。落ちたのは「`assets/` の下が台本の出力と同じ」の1件だけで、`assets/` を置き換えていないので想定どおり。
- 参考の `warm-ribbon` は、青が無いので意匠の検査に通らない（候補の外。`icon-variants.md` の5節）。

## 5. 曹参に書いてほしいテスト（足した入口）

- `parsePathToPolygons`: 円弧の旗を詰めて書いた形（`a2.97 2.97 0 01-.104-.729`）、相対の命令、`M` の後に続く座標を `L` として読むこと、`S`・`T` の制御点の折り返し、`Z` の後の命令が始点から続くこと、数の詰め書き（`.08-.23`・`1.476.389`）。簡単な四角や円で、塗った面積が数値で合うかを見られる。
- `resolveVariant`: 短い名前、正式の名前、知らない名前（例外）。
- `makeSvgFiles("current")` が `assets/` の今の SVG の5つとバイト単位で同じこと。
- CLI の `--check`（同じなら 0、1バイト違えば 1、何も書かない）、`--preview`（見本だけを書き、アイコンは書かない）、`--variant all` を `--preview` 無しで使うと 2、`--check` と `--preview` を一緒に使うと 2。
- `copy-icon-sources.mjs`: `--build-root` に模擬の木（`official/…/code-icon.svg` と、`claude-logo.svg` を入れた zip と、その `.sha256`）を渡すと写しと `SOURCES.json` ができること。`.sha256` が合わなければ終了コード 1 で何も書かないこと。**注意: この台本は写しの書き先が `scripts/icon-src/` に固定で、本物を上書きする。** テストで走らせるなら、書き先を変える引数が要る。要れば私が `--dest <dir>` を足すので、知らせてほしい。

## 6. 選ばれた後の仕上げ

1. ユーザーが選んだ意匠を `scripts/make-icons.mjs` の `DEFAULT_VARIANT` にする。要れば、細かい直しもここで行う（B なら、筋の先が欠片で残る所。`icon-variants.md` の3節）。
2. `node scripts/make-icons.mjs` を走らせて `assets/` の8つを書き直す。続けて `node scripts/make-icons.mjs --check` が 0 で終わることを確かめる。
3. `assets/README.md` を直す。5行目の「Microsoft・Visual Studio・Claude の名称とロゴは使わない」「他者の著作物は使っていない」は、2026-11-17 の裁定と合わなくなる。元の絵の出どころ（`scripts/icon-src/SOURCES.json`）も書く。
4. 曹参: `tests/make-icons.test.mjs` の既定の走らせ方で意匠の検査が通ることを確かめる。「`assets/` の下が台本の出力と同じ」は、2 の後なら通る。
5. 本体をビルドし（`scripts/build.mjs`。`apply.mjs` が `assets/` を作業ツリーへ写す）、入れ替える（`switch.ps1`）。
6. 画面で確かめる: タスクバー・ウィンドウ・スタートメニューのアイコン（`code.ico`）、タイトルバーの左のアイコン（`code-icon.svg`）、エディタが空のときの透かし（明るいテーマと暗いテーマ）。Windows はアイコンを覚えておくので、古いアイコンが出続けることがある（推定。確かめていない）。

## 7. 資料との食い違い（リーダーへ）

- `docs/02-repository-and-build.md` の43行目「`make-icons.mjs` assets/ の PNG・ICO を自作の意匠で書き出す」が、今の台本と合わない。今の台本は SVG も書き、候補の意匠は他者の絵（VS Code と Claude）を使う。`copy-icon-sources.mjs` と `scripts/icon-src/` も、リポジトリの一覧（同じ節）に無い。
- `assets/README.md` の5行目（上の6の3）。これは選ばれた後に私が直す。

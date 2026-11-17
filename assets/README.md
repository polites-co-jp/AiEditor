# assets（ブランドの資産）

`scripts/apply.mjs` が、このフォルダの下を作業ツリーの同じ相対パスへ写す（`tasks/2026-11-13-p2-apply/apply-design.md` の2.5。直下の `*.md` は写さない）。

## 意匠と元の絵

裁定（2026-11-17）: アイコンは Claude のアイコンと VS Code のアイコンを合わせた意匠にする（2026-11-12 の「Microsoft・Visual Studio・Claude の名称とロゴは使わない」を、アイコンについて改めた）。名前は Shuko（仮）のままで、名称の文字は絵に入れない。前提は個人利用（利用者は1人で、配布しない）。商標の扱いは確かめていない。

意匠は候補 A「中央に印」（裁定 2026-11-17、台本の `center-spark`）。VS Code の青いリボンを全面に置き、真ん中に Claude の橙の印（`#D97757`）を重ねる。印のまわりは透かす。候補の見本と比べは `tasks/2026-11-17-icon/icon-variants.md`・`preview-all.png`。

ここにあるファイルは、どれも `scripts/make-icons.mjs` が次の2つの元の絵から描いたもの。元の絵は他者の著作物で、写しは `scripts/icon-src/` にある（`assets/` の下に置くと作業ツリーへ写るため）。出どころと SHA-256 は `scripts/icon-src/SOURCES.json`。

| 写し | 元の絵 | SHA-256 |
|---|---|---|
| `scripts/icon-src/vscode-code-icon.svg` | VS Code 1.146.0（公式の Windows 版）の `resources/app/out/media/code-icon.svg` | `57270d907046995a87bb87c49a9e0ad683e87810718bcfa4c1d7ee6240400e13` |
| `scripts/icon-src/claude-logo.svg` | Claude Code 拡張 2.1.322（Open VSX の win32-x64 の VSIX）の `extension/resources/claude-logo.svg` | `a3101f3047a119aa11825ad9369510f0c472428c8c52d420e31bc62db44a8364` |

## 置いたもの（SVG）

| このフォルダのパス | 写す先（作業ツリー） | 使う所（1.146.0） |
|---|---|---|
| `src/vs/workbench/browser/media/code-icon.svg` | 同じ | タイトルバーの左のアプリのアイコン（`browser/parts/titlebar/media/titlebarpart.css` 297行）、通知のバナー（`browser/parts/banner/media/bannerpart.css` 33行） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-light.svg` | 同じ | エディタが空のときの透かし（`editorgroupview.css` 141〜158行）。Light Modern ではこれが出る |
| `src/vs/workbench/browser/parts/editor/media/letterpress-dark.svg` | 同じ | 同上（暗いテーマ） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-hcLight.svg` | 同じ | 同上（ハイコントラストの明るいテーマ） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-hcDark.svg` | 同じ | 同上（ハイコントラストの暗いテーマ） |

`code-icon.svg` は、元の2つの SVG のパスに位置と倍率（`matrix`）を付けて組んだもの。透かしの4つは1色の影絵（リボンの影絵の真ん中に、隙間を空けて印の影絵）で、本家のファイルの大きさ（260×260）・不透明度（明るい 0.1、暗い 0.3）・ハイコントラストの色（`#D9D9D9`・`#3C3C3C`）をそのまま写した。

## 置いたもの（台本で書き出した PNG と ICO）

台本の `makeIconFiles()` の戻りは配列 `[{ rel: string, data: Buffer }, ...]`（3つ。`rel` は `resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png` の順の、`/` 区切りの相対パス）。

`node scripts/make-icons.mjs` が、上の SVG と同じ意匠を Node.js の標準の `zlib` だけで描いて、PNG・ICO の3つと SVG の5つを書き出す（2026-11-14 リーダーの指示）。同じ入力からは毎回同じバイト列になる。`node scripts/make-icons.mjs --check` で、ここの8つが台本の出力と同じかを確かめられる（同じなら終了コード 0）。

| このフォルダのパス | 使う所（1.146.0 で確かめた） | 大きさ |
|---|---|---|
| `resources/win32/code.ico` | 実行ファイルのアイコン（`build/lib/electron.ts` 254行の `winIcon`、`build/gulpfile.vscode.win32.ts` 158行の `rcedit`）。タスクバー・ウィンドウ・スタートメニューのショートカットもこれ | 16・24・32・48・64・128・256 px（どれも PNG で格納。Windows Vista 以降で読める形） |
| `resources/win32/code_70x70.png` | スタートメニューのタイル（`resources/win32/VisualElementsManifest.xml`、`build/gulpfile.vscode.ts` 343行で同梱） | 70×70 |
| `resources/win32/code_150x150.png` | 同上。ソースから動かすときのウィンドウのアイコン（`src/vs/platform/windows/electron-main/windows.ts` 199行） | 150×150 |

## 置いていないもの（要らないもの）

| 作業ツリーのパス | 使う所 | 要る大きさ | 要否 |
|---|---|---|---|
| `resources/win32/sessions.ico` | Agents の窓のアイコン（`windowImpl.ts` 846行） | code.ico と同じ組 | 要らない見込み（Agents の窓は AI の機能で、C-1 で消す） |
| `resources/win32/*.ico`（`bower.ico`〜`yaml.ico` の28個） | インストーラーのファイルの関連付け | — | 要らない（インストーラーを作らない。docs/02 の6節） |
| `resources/win32/inno-*.bmp` | インストーラーの画面 | — | 要らない（同上） |
| `resources/server/*`、`resources/linux/code.png`、`resources/darwin/*.icns` | web・サーバー・Linux・macOS | — | 要らない（Windows 専用） |

## 意匠を変えるとき

`scripts/make-icons.mjs` の `DEFAULT_VARIANT` を替えるか描き方を直して、`node scripts/make-icons.mjs` で書き出し直し、`--check` で照らす。元の絵を取り直すときは `node scripts/copy-icon-sources.mjs`（`SOURCES.json` も書き直す）。本体に反映するには作り直す（`scripts/build.mjs`）。

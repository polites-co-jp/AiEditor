# assets（ブランドの資産）

`scripts/apply.mjs` が、このフォルダの下を作業ツリーの同じ相対パスへ写す（`tasks/2026-11-13-p2-apply/apply-design.md` の2.5。直下の `*.md` は写さない）。

裁定（2026-11-12）: エディタの名前・アイコンは後で決める。Microsoft・Visual Studio・Claude の名称とロゴは使わない。ここに置いたのは仮のアイコンで、自作の簡単な図形（角の丸い四角と、端末の入力の印 `>_`）。他者の著作物は使っていない。

## 置いたもの（自作の SVG）

| このフォルダのパス | 写す先（作業ツリー） | 使う所（1.146.0） |
|---|---|---|
| `src/vs/workbench/browser/media/code-icon.svg` | 同じ | タイトルバーの左のアプリのアイコン（`browser/parts/titlebar/media/titlebarpart.css` 297行）、通知のバナー（`browser/parts/banner/media/bannerpart.css` 33行） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-light.svg` | 同じ | エディタが空のときの透かし（`editorgroupview.css` 141〜158行）。Light Modern ではこれが出る |
| `src/vs/workbench/browser/parts/editor/media/letterpress-dark.svg` | 同じ | 同上（暗いテーマ） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-hcLight.svg` | 同じ | 同上（ハイコントラストの明るいテーマ） |
| `src/vs/workbench/browser/parts/editor/media/letterpress-hcDark.svg` | 同じ | 同上（ハイコントラストの暗いテーマ） |

透かしの4つは、本家のファイルの大きさ（260×260）・不透明度（明るい 0.1、暗い 0.3）・ハイコントラストの色（`#D9D9D9`・`#3C3C3C`）をそのまま写した。

## 置いたもの（台本で書き出した PNG と ICO）

台本の `makeIconFiles()` の戻りは配列 `[{ rel: string, data: Buffer }, ...]`（3つ。`rel` は `resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png` の順の、`/` 区切りの相対パス）。

`node scripts/make-icons.mjs` が、上の SVG と同じ意匠を Node.js の標準の `zlib` だけで描いて書き出す（2026-11-14 リーダーの指示）。意匠を変えたら台本の定数を直して書き出し直す。同じ入力からは毎回同じバイト列になる。

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

正式な名前とアイコンが決まったら、SVG を差し替え、`scripts/make-icons.mjs` の意匠の定数を直して書き出し直す。

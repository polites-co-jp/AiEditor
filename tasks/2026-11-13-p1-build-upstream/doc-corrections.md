# docs/02 の推定の箇所と食い違った事実、直し方の案

- 作成: 蒙恬（2026-11-13）
- 根拠: 本家 1.146.0 のタグのソース（GitHub の raw。2026-11-13 取得）と、この PC での `scripts/check-env.ps1` の結果（`env-check.json`）
- ビルドはまだ走らせていない（環境が足りないため）。ここに挙げるのは、タグのソースと環境の確かめで分かった点だけ。出力の形・実行ファイルの名前・データの場所などは、ビルドの後に足す。

| 箇所 | 今の記述 | 分かった事実 | 直し方の案 |
|---|---|---|---|
| 02 の4節の4（依存の導入） | 1.146.0 は pnpm を使っている「見込み」。どちらで動くかは Phase 1 で確かめる | ルートの `package.json` に `"packageManager": "pnpm@12.16.0"`。`build/npm/preinstall.ts` が `build/lib/pnpm.ts` の `checkPackageManager` で、pnpm 以外を「This repository uses pnpm. Run `pnpm install`.」で止める。pnpm の版は「メジャーが同じで、`packageManager` の版以上」でなければ止める。npm では入れられない | 「見込み」を外し、「1.146.0 は pnpm 12.16.0 以上の 12 系（`packageManager`）。npm では preinstall が止める。wiki の `npm install` は古い」と書く。取り込みのたびに `packageManager` を読む |
| 02 の4節の5（型検査） | 推定の候補 `compile`、`valid-layers-check` | `typecheck-client` が `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`。`compile` は `npm-run-all2 -lp compile-client compile-copilot` で、出力を作り copilot のコンパイルも含む（型検査だけではない）。`valid-layers-check` は層の規則の検査 | 候補を `typecheck-client` にする。ビルドの後に、所要時間と、無改造で誤りが 0 かを確かめて「推定」を外す |
| 02 の4節の6（パッケージ化） | `npm run gulp vscode-win32-x64-min`（タグが pnpm なら `pnpm run gulp ...`） | タグは pnpm。`gulp` の script は `node --experimental-strip-types --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js` | `pnpm run gulp vscode-win32-x64-min` に決める。npm の書き方を外す |
| 02 の4節の8（zip） | Windows 標準の `tar.exe` で `tar -a -c -f <label>.zip <フォルダ>` | この PC では PATH の先頭の `tar` が Git の GNU tar 1.35（zip を作れない）。Windows 標準は `C:\Windows\System32\tar.exe`（bsdtar 3.8.9） | 「`%SystemRoot%\System32\tar.exe` をフルパスで呼ぶ（PATH の `tar` は Git の GNU tar のことがある）」と書き足す。zip が作れるかはビルドの後に確かめる |
| 02 の5節の表（Node.js） | タグの `.nvmrc` の版（main で 24.22.1 [一次・要照合]） | タグ 1.146.0 の `.nvmrc` も 24.22.1。`preinstall.ts` は「メジャーが同じで、マイナーとパッチが `.nvmrc` 以上」を求める | 「1.146.0 の `.nvmrc` は 24.22.1（タグで確かめた）。メジャーが同じでそれ以上」と書き、要照合を外す。入れ方の注意として「winget の `OpenJS.NodeJS.LTS` は 26 系を含むので `--version` で 24 系を指定する」を足す |
| 02 の5節の表（パッケージマネージャー） | タグの手順に従う（1.146.0 は pnpm の見込み） | 上の 4節の4 と同じ。pnpm 12 は Rust で書き直された系で、npm の `pnpm@12.16.0` で入る | 「pnpm 12.16.0（`npm install -g pnpm@12.16.0`）」と書く |
| 02 の5節の表（C/C++） | Visual Studio 2026 Build Tools。wiki の winget の例 | winget の `Microsoft.VisualStudio.BuildTools` は 18.x（2026）。`preinstall.ts` の確かめは、`vs2026_install` などの環境変数か、`Program Files`（`(x86)` も）の `Microsoft Visual Studio\<18\|2022\|2019>\<版の種類>` のフォルダがあるかだけで、コンポーネントは見ない | 「preinstall はフォルダがあるかだけを見る。コンポーネントの不足は node-gyp のビルドで分かる」を足す |
| 02 の5節の表（Python） | node-gyp 用。setuptools を入れる | `preinstall.ts` は Python を確かめない。この PC の Python 3.14.7 には setuptools が入っていなかった | 変えなくてよい。「preinstall は確かめないので、setuptools の不足は install の途中で分かる」と足してもよい |

## 足すとよい点

- 02 の5節: 環境の確かめは `scripts/check-env.ps1`（読むだけ。タグの `.nvmrc`・`packageManager` を作業ツリーから読む `-WorkTree` を持つ）で行う、と書く。取り込みのたびに走らせれば、本家が Node.js や pnpm の版を上げたことに気づける。

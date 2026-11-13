# 資料（docs/）と事実の食い違い・書き足しの提案（p2-apply）

docs/ は書き換えていない。リーダーの判断を仰ぐ。

## 1. ロックファイルは6つある（docs/03 の5.4、docs/02 の4節の4）

- 資料: 「ロックファイル（1.146.0 は `pnpm-lock.yaml` の見込み）が変わる」（1つの前提の書き方）。
- 事実: 本家 1.146.0 には `pnpm-lock.yaml` が6つある。ルート、`build/`、`extensions/`、`extensions/copilot/`、`remote/`、`test/sanity/`（`git ls-tree -r 1.146.0` で数えた）。組み込み拡張の依存は `extensions/pnpm-lock.yaml`（importer は拡張の名前）にあり、ルートのものには無い。
- 実装: `checkLockfiles` はタグの時点のすべての `pnpm-lock.yaml` を比べ、単位が消したフォルダの中のもの（`extensions/copilot/`）は「無いこと」を確かめる。
- 提案: 5.4 を「ロックファイル（1.146.0 は6つの `pnpm-lock.yaml`）」に直し、`records/take-in/<label>/lockfile.diff` が6つ分の差分であることを書く。

## 2. product.overlay.json の項目の名前を資料に書く（docs/02 の3節）

- 資料: `set` と `remove` の2つを持つ、と書く。表には「本家が足したら remove」（enableTelemetry など）の行があるが、overlay の項目としての書き方が無い。
- 事実: p2-units-b が `product.overlay.json` に3つめの項目 `removeIfPresent` を作った。apply.mjs もそれに合わせた（本家に無ければ何もしない、あれば消して警告）。`remove` は「本家に無ければ警告」。
- 提案: 3節の冒頭を「`set`・`remove`・`removeIfPresent`（本家が足したら外す）の3つを持つ」に直す。

## 3. contrib を消す単位は src/vs/sessions の main の import も消す（docs/03 の4節の段階 B・C、6節）

- 資料: import の行は `workbench.common.main.ts`・`workbench.desktop.main.ts` で消す、と書く。適用後の検査の「本家が足した部品」も `workbench.*.main.ts` の import の行だけを見る。
- 事実: 1.146.0 の `src/vs/sessions/sessions.desktop.main.ts`・`sessions.web.main.ts` も workbench の contrib を import している（例 `import '../workbench/contrib/surveys/browser/survey.contribution.js';`。`workbench.web.main.ts` も同じ）。contrib のフォルダだけを消すと、これらの import が残って型検査が落ちる見込み（推定。型検査は未実行）。
- 提案: 4節の「import の行は removeLines で消す」に `src/vs/sessions/sessions.*.main.ts` と `workbench.web.main.ts` を足す。6節の「本家が足した部品」の import の行の比べに `src/vs/sessions/sessions.*.main.ts` を足すか（今の実装は資料どおり `workbench.*.main.ts` だけ）。足すなら apply.mjs の `checkUpstreamAdditions` を直す。

## 4. パッチに作った人の名前とメールが入る（docs/03 の5.2）

- 資料: `git format-patch -1 <edits のコミット> --stdout > removals/<id>/edits.patch`。
- 事実: `format-patch` の出力の `From:` の行に、コミットした人の git の名前とメールがそのまま入る。利用者の設定でコミットすると、利用者の名前とメールがビルドリポジトリに残る。apply.mjs は自分のコミットを `shuko-apply <apply@shuko.invalid>` で作るので、apply.mjs が当てた edits のコミットは元のパッチの `From:` を作者として持つ。
- 提案: 5.2 に「edits のコミットは `git -c user.name=shuko-apply -c user.email=apply@shuko.invalid commit` で作る（または書き出した後に `From:` を直す）」を書き足す。`TAKE-IN.md`（修理のとき `claude -p` がコミットする）にも同じ規約を書く。

## 5. Electron の版の置き場所は版によって違う（docs/02 の5節、docs/06 の4節の4）

- 資料: 「Electron の版はルートの package.json の `nativeBuild.target` で決まる（1.146.0 は 43.8.6）」。
- 事実: 1.146.0 はそのとおり。1.145.3 は `nativeBuild` が無く、`.npmrc` の `target="43.8.3"` にある。
- 実装: `checkToolchain` は `nativeBuild.target` を読み、無ければ `.npmrc` の `target` を読む（どちらから読んだかを記録する）。
- 提案: 5節に「1.145 系までは `.npmrc` の `target`」を書き足す。

## 6. edits.patch の名前（docs/03 の3.1）

- 資料: 例は `"patch": "edits.patch"`、2節の図も `edits.patch`。
- 事実: 5.2 の手順のとおり `--stdout >` で書けば `edits.patch` になる。`format-patch -o` を使うと `0001-<件名>.patch` の名前になる（試しではこちらを使い、`unit.json` の `patch` にその名前を書いた）。apply.mjs は `patch` に書かれた名前をそのまま読むので、どちらでも動く。
- 提案: 食い違いではない。`patch` は単位のフォルダの中のファイルの名前で、既定の名前が `edits.patch` であることを3.1 の表に書き足すとよい。

## 7. パッチのファイルの改行（資料に無い点）

- 事実: このリポジトリに `.gitattributes` が無い。今の作業ツリーでは改行は LF のまま（`git ls-files --eol` で確かめた）。もし別の PC で `core.autocrlf=true` でチェックアウトすると、`patches/*.patch` と `removals/*/edits.patch` の全行が CRLF になり、`git am` の当たり方が変わる恐れがある。
- 実装: apply.mjs は、パッチの全行が CRLF なら改行が変えられたものとみなして `--keep-cr` を付けず、一部の行だけが CRLF なら（本家の CRLF のファイルへの変更）付ける。
- 提案: `.gitattributes` に `*.patch -text` を置く（`.gitattributes` は私の書き込み先に無いので作っていない）。

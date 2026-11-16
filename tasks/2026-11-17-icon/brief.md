# アイコンを Claude と VS Code の合成にする（候補づくり）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-17
- 状態: 完了

## 目的

裁定（2026-11-17。`docs/user-decisions.md` の末尾）: エディタのアイコンを、Claude のアイコンと VS Code のアイコンを合わせた意匠にする。今の仮のアイコン（角の丸い青い四角に `>_`）を置き換える。

本体の作り直しは重いので、まず候補を3つ作ってユーザーに選んでもらう。この依頼は候補づくりまで。選ばれた後の仕上げとビルドは、同じタスクで追って依頼する。

## 入力

- `assets/README.md`（アイコンを使う所の一覧。PNG・ICO・SVG の置き場所）
- `scripts/make-icons.mjs`（今の台本。Node.js の標準の部品だけで PNG と ICO を書く）
- `tests/make-icons.test.mjs`（曹参が新しい意匠に合わせて直す。並行の依頼 `tasks/2026-11-17-icon-l10n-tests/`）
- 元の絵（どちらもこの PC にある）:
  - VS Code: 公式の 1.146.0 の `tmp/b/official/vscode-1.146.0/69047191fc/resources/app/out/media/code-icon.svg`（ほかに同じフォルダの `vscode-icon.svg`、`resources/app/resources/win32/code.ico`・`code_150x150.png`）
  - Claude: Claude Code 拡張の `%USERPROFILE%\.shuko\extensions\anthropic.claude-code-2.1.322\resources\claude-logo.svg`（`viewBox="0 0 24 24"`、塗り `#D97757`）

## 決まり

- 台本は Node.js の標準の部品（zlib・fs・path・url など）だけで書く。外部のパッケージ・外部の道具（ブラウザーでの描画など）は使わない。SVG のパスを描くなら、台本の中に小さな描画の部品（曲線を線分に分けて塗る、サンプリングで縁を滑らかにする）を作る。
- 同じ入力からは毎回同じバイト列にする（時刻を入れない）。
- 元の絵は、コマンド（`cp` など）でリポジトリの中へ写し、写した元の場所と SHA-256 を記録する。台本はリポジトリの中の写しを読む（ビルドのたびに `tmp/b` や拡張のフォルダを読まない）。写しは、`apply.mjs` が作業ツリーへ写す `assets/` の下以外に置く（`assets/` の下に置くなら、作業ツリーへ写らない所か、写っても害が無いことを確かめる）。
- 16・32 px でも、両方の要素（VS Code の形、Claude の橙の印）が見分けられること。
- 名称（Visual Studio Code・Claude の文字）は絵に入れない（名称は今までどおり使わない）。
- 本体のビルドはしない。`assets/` の今のファイルは、ユーザーが選ぶまで置き換えない（候補は台本の出力先を変えて書き出す）。

## 完了条件

- `scripts/make-icons.mjs` が、意匠の候補（3つ）を引数で選んで、今と同じ組のファイル（`code.ico` の7つの大きさ・`code_70x70.png`・`code_150x150.png`）と SVG（タイトルバーの `code-icon.svg`、透かしの `letterpress-*.svg` の4つ）を書き出せる。既定はまだ今の意匠のままでよい。
- 候補ごとの見本の画像がこのフォルダにある（大きい1枚と、16〜256 px を明るい背景・暗い背景に並べたもの）。
- テストの入口（`ICON_SIZES`・`crc32`・`encodePng`・`encodeIco`・`renderIcon`・`makeIconFiles`）を保つ。変えたときは引き継ぎに書く（曹参が読む）。
- 今の `node --test tests/make-icons.test.mjs` の形式の検査（PNG・ICO の書式、決定性）が通る（意匠に固有の検査は曹参が直すので落ちてよい。どれが落ちるかを書く）。

## 成果物

このディレクトリに保存する。

- `icon-variants.md`: 候補ごとの意匠の説明（何をどこに置いたか、色、小さい大きさでの見え方）と、見本の画像の名前
- `preview-<候補>.png` など: 見本の画像
- `handoff-notes-meng-tian.md`: 変えたファイル、元の絵の写しの場所と SHA-256、テストの入口の変化、落ちるテスト、選ばれた後の仕上げの手順

## 結果

- 候補 A（`center-spark`）・B（`spark-badge`）・C（`dark-tile`）と参考の D（`warm-ribbon`）を作った。見本は `preview-all.png`。`scripts/make-icons.mjs` に `--variant`・`--preview`・`--check` を足し、SVG のパスを描く部品を中に持つ（Node.js の標準の部品だけ）。元の絵の写しは `scripts/icon-src/`（出どころと SHA-256 は `SOURCES.json`）。
- Claude の絵は、依頼書の場所（`%USERPROFILE%\.shuko\extensions\…`）が蒙恬の `read_paths` の外だったので、ビルドのキャッシュの同じ版の VSIX から取り出した。入っている拡張のファイルと SHA-256（`a3101f30…8364`）が同じことをリーダーが確かめた。
- ユーザーの裁定（2026-11-17）: A「中央に印」に決まった。

## 未解決

- 仕上げ（既定を A にし `assets/` へ書き出す、`assets/README.md` を直す）とビルドは `tasks/2026-11-17-icon-ja-build/` へ。
- `docs/02-repository-and-build.md` の `make-icons.mjs` の説明と、`copy-icon-sources.mjs`・`scripts/icon-src/` がリポジトリの一覧に無い（関門の後にリーダーが直す）。

## 次の担当

蒙恬（`tasks/2026-11-17-icon-ja-build/`）

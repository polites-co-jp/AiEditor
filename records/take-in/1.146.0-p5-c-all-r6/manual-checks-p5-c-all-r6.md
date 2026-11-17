# 入れ替えの後に画面で見る項目（版 `1.146.0-p5-c-all-r6`）

- 作成: 大岡越前守、2026-11-17（関門の記録 `gate-p5-c-all-r6.md` の付け）
- 前提: 課（蒙恬）が、古い日本語パック `MS-CEINTL.vscode-language-pack-ja` を外し、`switch.ps1` で r6 を入れ、`install-extensions.mjs` で台帳の7つをそろえた後（`tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md` の8節）。
- 自動の関門で見られなかった所だけを挙げる。前の版の手の項目 C1〜C22（`records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`・`records/take-in/1.146.0-p5-c-all-r3c/manual-checks-p5-c-all-r3c.md`）は、版の名前を r6 に読み替えて、そのまま残る。

## 課が先に確かめること（画面の前）

| # | 何を | 合格の形 |
|---|---|---|
| K1 | `shuko --version` | `1.146.0`・`3e1e616aa9f1538643a070f0684196c0cd688ddd`・`x64` |
| K2 | `%APPDATA%\Shuko\languagepacks.json` の `ja`（Shuko を1回起動した後） | `extensions` が `shuko.language-pack-ja`（1.146.0）と `shuko.notion-sync`。`translations.vscode` が `<installRoot>\versions\<ラベル>\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json`。`MS-CEINTL.vscode-language-pack-ja` が無い |
| K3 | `install-extensions.mjs` の結果 | `result: ok`、`compare.extra` が空（古いパックが残っていれば終了コード 3 と `retired` の説明が出る） |
| K4 | 入れた版のフォルダに曹参の網を当てる: `node tests/l10n-audit.mjs --app <installRoot>\versions\<ラベル>\resources\app --pack <同じ>\resources\app\extensions\language-pack-ja --worktree tmp/b/wt/r6/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle` | 終了コード 0、除外の外の未訳 0（関門の結果と同じ） |

## ユーザーが画面で見ること

Shuko は2回起動する（言語パックの一覧は起動のたびに作り直され、日本語になるのは2回目からの見込み）。

### 日本語の表示

| # | 見る所 | 合格の形 |
|---|---|---|
| J1 | 全体（メニュー・サイド バー・コマンド パレット・設定の画面） | 日本語。英語のまま残っている所があれば、場所を書き留める |
| J2 | ヘルプ → バージョン情報 | 「バージョン:」「コミット:」「日付:」の行（Shuko のパッチの文言 `aboutDetailWithoutCopilot`） |
| J3 | エディターを全部閉じたときの透かしの下の文 | 日本語（キーの一覧の説明） |
| J4 | 画像ファイルを開く | 画像のプレビューの表示（状態バーなど）が日本語 |
| J5 | 新しい無題のファイルを開いたときのヒント | 「言語の選択」などの押せる語と、括弧のキーの表示が分かれて出る（課が上書きで直した2件。`]]` などの記号が文字で出ていないこと） |
| J6 | ワークスペースの信頼の画面（コマンド パレットで「ワークスペースの信頼」と打って開く） | 上の行の「設定の構成」と「詳細情報」がリンクとして押せる（課が上書きで直した1件） |
| J7 | 設定の「ファイルの入れ子」のパターンの説明（設定の画面で `fileNesting.patterns` を探す） | `${capture}`・`${basename}` などの書き方が、そのままの文字で出る（公式の訳では `$(capture)` に化けていた） |
| J8 | クイック オープン（Ctrl+P）で、ファイルの項目の右のボタンにマウスを載せる | 「横に並べて開く (…)」のように、後ろにキーの表示が付く |
| J9 | 拡張機能の画面の組み込みの一覧 | 「Shuko の既定」「Shuko Notion 同期」「Shuko 日本語パック」の名前で出る |
| J10 | ソース管理で、2つの版の差分を開いたときのエディターの題 | `<名前> ↔ <名前>` の形（記号のまま） |

### アイコン（A「中央に印」: VS Code の青いリボンの真ん中に Claude の橙の印）

| # | 見る所 | 合格の形 |
|---|---|---|
| I1 | タスク バーのアイコン、Alt+Tab の一覧 | A の意匠 |
| I2 | スタート メニューの「Shuko」 | A の意匠。古いアイコン（青い四角に `>_`）が残っていれば、Windows がアイコンを覚えているため。ショートカットを作り直すかピン留めをし直す（推定。確かめていない） |
| I3 | ウィンドウのタイトル バーの左のアイコン | A の意匠（`code-icon.svg`） |
| I4 | エディターを全部閉じたときの透かし | 明るいテーマ（既定の Light Modern）と暗いテーマの両方で、リボンと印の影絵。印のまわりに隙間がある |
| I5 | エクスプローラーで `Shuko.exe` を見たときのアイコン | A の意匠（実行ファイルに埋め込まれたアイコン。関門ではバイト列の照合ができず、画面で確かめる） |

## 戻すとき

`switch.ps1 -Previous`。r4 には組み込みの日本語パックが無いので、戻した版で日本語にするには古いパックを入れ直す（`tmp/b/cache/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0`。蒙恬の引き継ぎの8節の7）。

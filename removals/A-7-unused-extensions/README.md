# A-7-unused-extensions

使わない組み込み拡張をまとめて消す（docs/03 の4節の段階 A）。

## 消すもの

| フォルダ | 中身 | 消す理由 |
|---|---|---|
| `extensions/grunt`・`gulp`・`jake` | タスクの自動検出（Gruntfile・gulpfile・Jakefile） | docs/03 の表。npm のスクリプトとタスクの定義は残る |
| `extensions/simple-browser` | 簡易ブラウザ（`simpleBrowser.show`） | docs/03 の表 |
| `extensions/mermaid-markdown-features` | Markdown のプレビューの Mermaid の図 | docs/03 の表 |
| `extensions/extension-editing` | 拡張の開発の補助（拡張の package.json の補完など） | docs/03 の表 |
| `extensions/terminal-suggest` | ターミナルの入力候補（コマンドの補完の定義） | 裁定（2026-11-12 の「裁定に無かった機能」）で消す |
| `extensions/php-language-features` | PHP の言語機能 | 裁定の対象言語の外。PHP の色付け（`extensions/php`）は残す |

一覧の行（removeLines）: `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の8件ずつ、`build/lib/extensions.ts` の `esbuildMediaScripts` の2件（`mermaid-markdown-features/esbuild.webview.mts`・`simple-browser/esbuild.webview.mts`）。パッチは無い。

## 残すもの

- 文法だけの拡張（色付け）はすべて残す（`builtin/keep.json` の `kind: grammar`）。
- ターミナルの入力候補の本体の部品（`src/vs/workbench/contrib/terminalContrib/suggest`）と設定 `terminal.integrated.suggest.enabled`。拡張が持つのはコマンドの補完の定義で、部品は本体にある。本体の部品（と `src/vs/workbench/services/suggest`）と設定 `terminal.integrated.suggest.*` は **B-7-terminal-suggest** が消す。A-7 と B-7 は `after` を持たず、どちらか片方だけでも当たる。B-7 が有効でない間は、`mydist` の既定 `terminal.integrated.suggest.enabled: false` で候補を止める。
- `.vscode-test.js`・`scripts/test-integration.*` の `terminal-suggest` の組（本家のテスト。関門に入っていない）。

## 影響しうるもの

- 本体の AI のエージェントのウィンドウ（`src/vs/sessions/contrib/chat/browser/runScriptAction.ts`）が `simpleBrowser.show` を呼ぶ。C-1 で消す部品なので、それまでその操作だけがコマンドの無いエラーになる（推定）。
- `src/vs/workbench/browser/parts/editor/editorConfiguration.ts` に「Simple Browser」の表示名があるが、エディタの関連づけの説明の文字列だけ（推定）。
- Markdown のプレビューで Mermaid の図が描かれず、コードのブロックとして出る。
- ターミナルの入力候補は、拡張の補完の定義が無くなる。B-7 を当てない場合に、本体の部品が残す分の候補（パスなど）が出るかは未確認。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| `compile-extension-media-build` が `simple-browser`・`mermaid` の台本を探して止まる | 本家が別の一覧に台本を足した | 増えた一覧の行を `removeLines` に足す |
| ターミナルで入力候補が出続ける | 本体の部品が残っている（B-7 が無効で、mydist の既定も効いていない） | B-7 を有効にするか、`mydist` の既定を確かめる |
| `simpleBrowser.show` が無いというエラー | AI のエージェントのウィンドウから呼んだ | C-1 で部品ごと消える |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 消えたことの検査（checks）

- `absentCommands` の3件（`simpleBrowser.show`・`terminal.integrated.suggest.clearCachedGlobals`・`_mermaid-markdown.openInEditor`）は **manifest の網**（各拡張の `package.json` の `contributes.commands`・`menus`）で見る。8件の拡張は公式でも起動時に起動しない（公式の実行の `snapshot.json` で `active: false`。`terminal-suggest` は一覧にも出ない）ので、実行時の網では公式でも「無い」になる（関門の記録 `records/take-in/1.146.0-p2-A-7/gate-A-7-unused-extensions.md`）。
- 実行時の網で公式に「在る」になり、この単位で消えるコマンドは見つからなかった（出力チャネルも、起動しないので作られない）。実行時の網は設定の6件（登録簿で見える）が担う。`extension-editing`・`terminal-suggest` は設定を持たないので、manifest の網と absentStrings だけで見る。

## 未確認

- ターミナルの入力候補が、拡張を消した後に何を出すか（スモークの base のターミナルの項目で見る）。
- 起動時に、本体のターミナルの入力候補が `terminal-suggest` の提供者を探して誤りを出さないか（1.146.0 の `src` で `terminal-suggest` の名前を使うのはテストの2件だけ）。

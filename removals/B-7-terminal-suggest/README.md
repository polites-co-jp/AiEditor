# B-7-terminal-suggest ターミナルの入力候補

裁定（2026-11-12）: ターミナルの入力候補（terminal-suggest）は消す。不要な機能はコードごと消す。組み込み拡張 `extensions/terminal-suggest` は A-7 が消すが、本体の部品と設定が残るので、この単位で本体の側を消す（2026-11-14 リーダーの指示。段階 A の担当の提案）。

## 消すもの

- `src/vs/workbench/contrib/terminalContrib/suggest`（フォルダごと）: ターミナルの候補の窓、候補を集めるサービス（`ITerminalCompletionService`）、LSP の候補、Git Bash の補助、設定 `terminal.integrated.suggest.*`（`enabled` ほか11件）、コマンド `workbench.action.terminal.triggerSuggest` など、テスト。
- `src/vs/workbench/services/suggest`（フォルダごと）: 候補の小さな窓（`SimpleSuggestWidget`）と候補のモデル。本体で使っていたのはターミナルの入力候補だけ（`grep` で確かめた。ほかには `contrib/modernUI` のテストが CSS を1行 import しているだけ）。2026-11-14 リーダーの指示で足した。
- import の行（`removeLines`）: `src/vs/workbench/contrib/terminal/terminal.all.ts` の1行と、`src/vs/workbench/contrib/modernUI/test/browser/roundedCorners.test.ts` の CSS の1行。workbench と sessions の入口（`*.main.ts`）は直接 import していない（`terminal.all.ts` を通す。`grep` で確かめた）。
- `edits.patch`（残るファイルの参照を直す）:
  - `src/vs/workbench/contrib/terminal/terminalContribExports.ts`: 設定とコマンドの一覧から suggest の分を外す。`TerminalContribSettingId.SuggestEnabled` は文字列 `'terminal.integrated.suggest.enabled'` にして残す（`terminalProcessManager.ts` がシェル統合に渡す値として読み、`terminalConfiguration.ts` が説明文で参照するため）。設定は登録されないので値は無く、シェル統合は候補のための情報を集めない。
  - `src/vs/workbench/contrib/terminalContrib/inlineHint/browser/terminal.initialHint.contribution.ts`: 候補の案内を出さない（`suggestEnabled = false`）。コマンド ID は文字列にした。
  - `src/vs/workbench/contrib/terminalContrib/accessibility/browser/terminalAccessibilityHelp.ts`: アクセシビリティのヘルプから候補の説明を外す。
  - `src/vs/workbench/api/browser/mainThreadTerminalService.ts`: 拡張 API の補完の提供者の登録（`$registerCompletionProvider`）を、受け取って何もしない実装にする（docs/03 の2節の4「入口は空にして残す」）。
  - `src/vs/workbench/api/test/browser/mainThreadTerminalService.test.ts`: 消したサービスのスタブの2行。

## 残すもの

- `src/vs/workbench/contrib/terminal/common/terminalExtensionPoints.ts`: 拡張の `terminal` の contributes の受け手（プロファイルと同じファイル）。
- `terminalContextKey.ts` の `terminalSuggestWidgetVisible`、`terminalStorageKeys.ts` の `terminal.integrated.suggestSize` など、名前だけの残り（参照しても害が無い）。

## 影響しうるもの

- 拡張の提案中の API（`vscode.window.registerTerminalCompletionProvider`）で候補を出す拡張は、登録は通るが候補が出ない。台帳の拡張は使っていない見込み（A-7 で消える `terminal-suggest` 拡張が主な使い手）。
- `mydist` の既定 `terminal.integrated.suggest.enabled: false` は、この単位が有効になるまでのつなぎ。この単位の後は設定が無くなるので外してよい。

## 壊れたときの症状と戻し方

- ターミナルの作成で `terminalCompletionService` が見つからない誤りが出たら、ほかの部品がまだ注入している。`enabled: false` に戻し、型検査の誤りから参照を探して `edits.patch` を直す。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。とくに `const enum TerminalContribSettingId` に文字列の値を混ぜた行、`terminal.initialHint.contribution.ts` の `const suggestEnabled = false` のもとで `_keybindingService`・`_commandService` などが未使用と言われないか（ファイルのほかの所でも使っているのは見たが、クラスごとには確かめていない）。
- `chatAgentTools` など、ほかの terminalContrib が `ITerminalCompletionService` を名前で注入していないか（`grep` では見つからなかった）。
- `roundedCorners.test.ts` は、消した CSS を前提に `.workbench-suggest-widget` の角の丸みを確かめる試験を含む。型検査は通る見込みだが、本家の単体テストを走らせるとその試験が落ちる恐れがある（本家の単体テストは関門に含まない）。

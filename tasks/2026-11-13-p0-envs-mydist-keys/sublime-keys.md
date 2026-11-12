# 0-10 Sublime のキーの変換の試し（下書き）

- 作成: 蒙恬（2026-11-13）
- 清書の先: `records/phase0/sublime-keys.md`（大岡越前守）
- 台本: `node scripts/convert-sublime-keys.mjs --md C:/b/p0/sublime/conversion.md --apply`
- 部品: `scripts/lib/sublime-keys.mjs`（純粋な関数。曹参のテストの約束どおり）、`scripts/lib/zip-read.mjs`（VSIX から1ファイルを取り出す）

## 1. 元

| 項目 | 値 |
|---|---|
| 拡張 | `ms-vscode.sublime-keybindings` 4.1.10 |
| 取得元 | `https://open-vsx.org/api/ms-vscode/sublime-keybindings/4.1.10/file/ms-vscode.sublime-keybindings-4.1.10.vsix` |
| SHA-256 | `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`。Open VSX の `.sha256` と一致 |
| Open VSX のメタデータ | 公開 2024-01-22T04:13:03Z、`verified: true`、`license: "SEE LICENSE IN LICENSE.md"`、`engines.vscode: ^1.75.0`、`publishedBy: open-vsx`（Open VSX 側が公開した形）[一次] https://open-vsx.org/api/ms-vscode/sublime-keybindings/4.1.10 |
| ライセンス | VSIX 内の `extension/LICENSE.md` は MIT（Copyright (c) Microsoft Corporation）。本文は `extensions-src/mydist/ThirdPartyNotices.txt` に写した |
| 置き場所 | `C:\b\p0\sublime\`（VSIX、`.sha256`、取り出した manifest `sublime-4.1.10.package.json`、変換の結果の JSON） |
| `contributes.keybindings` | 71 項目。`args` を持つ項目は無い。`-` で始まる取り消しの項目も無い |

## 2. 変換の規則（docs/04 の6.2 と、決めたこと）

1. Windows 向けのキーは、`win` があればそれ、無ければ `key`。
2. 出力は `key`・`command`、元にあれば `when`・`args`。`mac`・`linux`・`win` は持たない（Windows 専用のため）。
3. **決めたこと**: 選んだキーが `none` の項目は落とす（理由 `no-windows-key`）。元の 4.1.10 は「Windows と Linux には割り当てない」の意味で `"key": "none"` を使っている（`workbench.action.files.saveAll`。mac だけ `alt+cmd+s`）。そのまま写すと `none` という名前のキーへの割り当てになるため。
4. **決めたこと**: `args` を残す。docs/04 の6.2 は `command`・`when` だけを挙げるが、`args` を落とすとコマンドの意味が変わる（今回の元には `args` は無いので結果は変わらない）。
5. 消した機能のコマンドを指す項目は落とす（理由 `removed-feature`）。判定は `REMOVED_COMMAND_RULES`（docs/03 の単位ごとの名前の型。C-1 の chat・inlineChat・mcp、C-2 の debug・ブレークポイント、C-3 の remote・tunnel、C-4 の notebook・interactive、C-5 の拡張のギャラリー、C-6 の userDataSync、C-7 の breadcrumbs、B-4 の outline、B-5 のテーマの切り替え、B-2 の歓迎画面、B-3 の issue・share）。**4.1.10 にはこれに当たるコマンドが無く、落ちた項目は0件**。
6. 並べ替えと重複の除去はしない。元の中で同じキーのものもそのまま（例 `ctrl+shift+/` は `when` の違う2項目、`ctrl+p` は `when` の無い2項目。元の拡張と同じふるまい）。
7. **決めたこと（2026-11-13 リーダーの決定）**: 知らない修飾キーを含むキー（元の書き誤り）は直さずに落とす（理由 `invalid-key`。下の4節）。

## 3. 結果

- 元 71 項目 → 変換 69 項目。落とした項目 2（`no-windows-key` 1、`invalid-key` 1）。
- 結果は `extensions-src/mydist/package.json` の `contributes.keybindings` に書いた（`--apply`）。機械の出力は `C:\b\p0\sublime\converted-keybindings.json`・`dropped.json`・`convert-meta.json`。

### 落とした項目

| 理由 | key | mac | command | when |
|---|---|---|---|---|
| no-windows-key | `none` | `alt+cmd+s` | `workbench.action.files.saveAll` |  |
| invalid-key（`ctr`） | `ctr+shift+[` | `alt+cmd+[` | `editor.fold` | `editorFocus` |

## 4. 元の書き誤り（落とした）

| key | command | when | 知らない修飾キー |
|---|---|---|---|
| `ctr+shift+[` | `editor.fold` | `editorFocus` | `ctr` |

`ctrl` の誤りとみられる。本家の既定でも Windows の `editor.fold` は `ctrl+shift+[` なので、落としても失うものは無い。2026-11-13 にリーダーが「落とす」と決め、`invalid-key` の規則として実装した。`extensions-src/mydist/package.json` に `ctr+` と `editor.fold` が無いことを確かめた。

## 5. Claude Code の既定のキーとの衝突

- Claude Code の manifest: 2.1.322（`C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\` の VSIX の `extension/package.json`。SHA-256 `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`）。`contributes.keybindings` は 9 件（docs/04 の6.2 の「9件」と一致）。
- 衝突の定義（約束）: 正規化したキー（小文字、修飾キーを ctrl・shift・alt・meta の順、和音は空白1つ）が同じで、`when` が両方とも無いか同じもの。
- **衝突: 0 件**。参考として、同じキーで `when` が違うものも数えたが **0 件**（Claude Code が使う `alt+k`・`ctrl+escape`・`ctrl+shift+escape`・`ctrl+alt+k`・`ctrl+n`・`ctrl+alt+f`・`ctrl+shift+t` を、4.1.10 は1つも使っていない）。
- 本家の既定のキー（Sublime のキーが上書きするもの）との重なりは、この一覧の対象外。例: Claude Code の `ctrl+n`（条件つき）は本家の「新しいファイル」と、`ctrl+shift+t` は本家の「閉じたエディターを開き直す」と重なる。

Claude Code の既定のキー（Windows 向けの見え方。`win` があればそれ、無ければ `key`。9件中7件は `win` を持つ）:

| キー | コマンド | when |
|---|---|---|
| `alt+k` | `claude-vscode.insertAtMention` | `editorTextFocus` |
| `ctrl+escape` | `claude-vscode.focus` | `!config.claudeCode.useTerminal && editorTextFocus` |
| `ctrl+escape` | `claude-vscode.blur` | `!config.claudeCode.useTerminal && !editorTextFocus` |
| `ctrl+shift+escape` | `claude-vscode.editor.open` | `!config.claudeCode.useTerminal` |
| `ctrl+escape` | `claude-vscode.terminal.open.keyboard` | `config.claudeCode.useTerminal` |
| `ctrl+alt+K` | `claude-code.insertAtMentioned` | `editorTextFocus` |
| `ctrl+n` | `claude-vscode.newConversation` | `config.claudeCode.enableNewConversationShortcut && (activeWebviewPanelId == 'claudeVSCodePanel' \|\| (claude-vscode.sideBarActive && !editorFocus && !panelFocus))` |
| `ctrl+alt+f` | `claude-vscode.toggleFocusView` | `(activeWebviewPanelId == 'claudeVSCodePanel' \|\| claude-vscode.sideBarActive) && (isMac \|\| (!(listFocus && listSupportsFind) && !inDebugRepl))` |
| `ctrl+shift+t` | `claude-vscode.reopenClosedSession` | `config.claudeCode.enableReopenClosedSessionShortcut && claude-vscode.lastClosedWasSession` |

`ctrl+alt+f` の `when` は `inDebugRepl` を参照する。C-2（デバッグを消す）の後はこのコンテキストキーが常に偽になり、条件は成り立つ側に倒れるので、動きは変わらない見込み（推定）。

## 6. 決まったこと・伝えること

1. `ctr+shift+[`（`editor.fold`）は落とす（2026-11-13 リーダーの決定。4節）。
2. `mydist` の `contributes.keybindings` に結果を書いた（docs/04 の6.2 どおり）。Phase 0 の 0-9 の環境（`mydist`）でも Sublime のキーが効くので、docs/06 の5節の base の「Sublime のキーが効く」を手で見られる。

## 7. 変換の結果（69 項目）

番号は `none` の1件を落とした後の通し番号。26 番（`ctr+shift+[`）は落としたので欠番にしてある。並びは元の項目の順。正本は `extensions-src/mydist/package.json`。

| # | key | command | when |
|---|---|---|---|
| 1 | `ctrl+y` | `redo` | `editorTextFocus && !editorReadonly` |
| 2 | `shift+f11` | `workbench.action.toggleZenMode` |  |
| 3 | `ctrl+w` | `workbench.action.closeActiveEditor` |  |
| 4 | `ctrl+pageup` | `workbench.action.previousEditor` |  |
| 5 | `ctrl+pagedown` | `workbench.action.nextEditor` |  |
| 6 | `ctrl+k ctrl+b` | `workbench.action.toggleSidebarVisibility` |  |
| 7 | `ctrl+up` | `scrollLineUp` | `editorTextFocus` |
| 8 | `ctrl+down` | `scrollLineDown` | `editorTextFocus` |
| 9 | `ctrl+p` | `workbench.action.quickOpen` |  |
| 10 | `ctrl+r` | `workbench.action.gotoSymbol` |  |
| 11 | `ctrl+;` | `workbench.action.gotoSymbol` |  |
| 12 | `f12` | `editor.action.goToDeclaration` |  |
| 13 | `alt+-` | `workbench.action.navigateBack` |  |
| 14 | `alt+shift+-` | `workbench.action.navigateForward` |  |
| 15 | `f3` | `editor.action.nextMatchFindAction` | `editorTextFocus` |
| 16 | `f4` | `editor.action.nextMatchFindAction` | `editorTextFocus` |
| 17 | `shift+f4` | `editor.action.previousMatchFindAction` | `editorTextFocus` |
| 18 | `ctrl+shift+up` | `editor.action.moveLinesUpAction` | `editorTextFocus` |
| 19 | `ctrl+shift+down` | `editor.action.moveLinesDownAction` | `editorTextFocus` |
| 20 | `ctrl+shift+/` | `editor.action.commentLine` | `editorTextFocus` |
| 21 | `ctrl+k ctrl+up` | `workbench.action.splitEditor` |  |
| 22 | `alt+shift+1` | `workbench.action.joinTwoGroups` |  |
| 23 | `alt+shift+2` | `workbench.action.splitEditor` |  |
| 24 | `alt+shift+8` | `workbench.action.toggleEditorGroupLayout` |  |
| 25 | `ctrl+k ctrl+down` | `workbench.action.closeActiveEditor` |  |
| 27 | `ctrl+shift+]` | `editor.unfold` | `editorFocus` |
| 28 | `ctrl+k ctrl+0` | `editor.unfoldAll` | `editorFocus` |
| 29 | `alt+f12` | `editor.action.showContextMenu` | `editorTextFocus` |
| 30 | `ctrl+shift+d` | `editor.action.copyLinesDownAction` | `editorFocus` |
| 31 | `ctrl+l` | `expandLineSelection` | `editorFocus` |
| 32 | `ctrl+d` | `editor.action.addSelectionToNextFindMatch` | `editorFocus` |
| 33 | `ctrl+m` | `editor.action.jumpToBracket` | `editorFocus` |
| 34 | `ctrl+shift+/` | `editor.action.blockComment` | `editorFocus` |
| 35 | `ctrl+h` | `editor.action.startFindReplaceAction` |  |
| 36 | `ctrl+shift+k` | `editor.action.deleteLines` | `editorFocus` |
| 37 | `ctrl+shift+backspace` | `deleteAllLeft` | `editorFocus` |
| 38 | `ctrl+shift+delete` | `deleteAllRight` | `editorFocus` |
| 39 | `alt+shift+up` | `editor.action.insertCursorAbove` | `editorTextFocus` |
| 40 | `alt+shift+down` | `editor.action.insertCursorBelow` | `editorTextFocus` |
| 41 | `alt+shift+pageup` | `cursorColumnSelectPageUp` | `editorTextFocus` |
| 42 | `alt+shift+pagedown` | `cursorColumnSelectPageDown` | `editorTextFocus` |
| 43 | `ctrl+shift+l` | `editor.action.insertCursorAtEndOfEachLineSelected` | `editorTextFocus` |
| 44〜52 | `alt+1`〜`alt+9` | `workbench.action.openEditorAtIndex1`〜`9` |  |
| 53 | `alt+f3` | `editor.action.selectHighlights` | `editorFocus` |
| 54 | `ctrl+shift+r` | `workbench.action.showAllSymbols` |  |
| 55 | `alt+left` | `cursorWordStartLeft` | `editorTextFocus` |
| 56 | `alt+right` | `cursorWordEndRight` | `editorTextFocus` |
| 57 | `alt+shift+left` | `cursorWordStartLeftSelect` | `editorTextFocus` |
| 58 | `alt+shift+right` | `cursorWordEndRightSelect` | `editorTextFocus` |
| 59 | `ctrl+j` | `editor.action.joinLines` | `editorTextFocus` |
| 60 | `ctrl+k ctrl+u` | `editor.action.transformToUppercase` | `editorTextFocus` |
| 61 | `ctrl+k ctrl+l` | `editor.action.transformToLowercase` | `editorTextFocus` |
| 62 | `ctrl+k a` | `workbench.action.showErrorsWarnings` |  |
| 63 | `ctrl+k n` | `editor.action.marker.next` | `editorFocus` |
| 64 | `ctrl+k p` | `editor.action.marker.prev` | `editorFocus` |
| 65 | `ctrl+1` | `workbench.action.focusFirstEditorGroup` | `editorFocus` |
| 66 | `ctrl+2` | `workbench.action.focusSecondEditorGroup` | `editorFocus` |
| 67 | `ctrl+3` | `workbench.action.focusThirdEditorGroup` | `editorFocus` |
| 68 | `ctrl+p` | `workbench.action.quickOpenPreviousEditor` |  |
| 69 | `ctrl+k ctrl+k` | `deleteAllRight` | `editorTextFocus && !editorReadonly` |
| 70 | `ctrl+shift+space` | `editor.action.smartSelect.grow` | `editorTextFocus` |

## 8. 曹参のテストの入口

`scripts/lib/sublime-keys.mjs` の export:

- `convertKeybindings(items, options?)` → 配列（約束の関数。`options.removedCommandRules` で消す機能の判定を差し替えられる。省略時は `REMOVED_COMMAND_RULES`）
- `findConflicts(a, b)` → `[{ key, a, b }]`（約束の関数。`key` は正規化したキー。並びは a の順、同じ a の中では b の順）
- 補助: `convertKeybindingsDetailed(items, options?)` → `{ keybindings, dropped: [{ item, reason, unit? }] }`（`reason` は `no-command`・`no-windows-key`・`invalid-key`・`removed-feature`。`invalid-key` のときは `unknown` に知らない修飾キーの名前の配列）、`toWindowsKeybinding(item)`、`removedUnitOf(command)`、`normalizeKey(key)`、`normalizeWhen(when)`、`unknownModifiersOf(key)`、`findSameKeyDifferentWhen(a, b)`、`REMOVED_COMMAND_RULES`

期待する例:

- `{ key: 'ctrl+a', win: 'ctrl+b', mac: 'cmd+a', command: 'x' }` → `{ key: 'ctrl+b', command: 'x' }`
- `{ key: 'none', mac: 'cmd+s', command: 'x' }` → 落ちる（`no-windows-key`）。`{ win: 'none', key: 'ctrl+s', command: 'x' }` も落ちる（`key` に戻らない）
- `{ key: 'f9', command: 'editor.debug.action.toggleBreakpoint' }` → 落ちる（`removed-feature`、`C-2-debug`）
- `{ key: 'ctr+shift+[', command: 'editor.fold' }` → 落ちる（`invalid-key`、`unknown: ['ctr']`）
- `normalizeKey('Shift+Ctrl+A')` → `'ctrl+shift+a'`、`normalizeKey('ctrl+k  ctrl+b')` → `'ctrl+k ctrl+b'`、`normalizeKey('cmd+k')` → `'meta+k'`
- `findConflicts([{key:'ctrl+alt+k',command:'a'}], [{key:'Alt+Ctrl+K',command:'b'}])` → 1件。片方だけ `when` を持つときは0件
- 入力が配列でないときは `TypeError`

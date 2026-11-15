<!-- node scripts/convert-sublime-keys.mjs が 2026-11-12T20:37:47.996Z に書き出した -->

- 元: ms-vscode.sublime-keybindings 4.1.10（項目 71）。SHA-256 fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34（Open VSX の .sha256 と一致）
- 変換の結果: 69 項目。落とした項目: 2（理由ごと: no-windows-key 1、invalid-key 1）
- Claude Code の manifest: 版 2.1.322（出どころ C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\Anthropic.claude-code-2.1.322@win32-x64.vsix）。keybindings 9 件
- 衝突（同じキーで when が両方とも無いか同じ）: 0 件。同じキーで when が違うもの（参考）: 0 件

### 衝突の一覧

なし

### 同じキーで when が違うもの（参考）

なし

### Claude Code の既定のキー（Windows 向けの見え方）

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

### 変換の結果に残った、知らない修飾キーを含むキー（invalid-key で落とすので、通常は無い）

なし

### 落とした項目

| 理由 | 単位・知らない修飾キー | key | win | command | when |
|---|---|---|---|---|---|
| no-windows-key |  | `none` |  | `workbench.action.files.saveAll` |  |
| invalid-key | ctr | `ctr+shift+[` |  | `editor.fold` | `editorFocus` |

### 変換の結果

| # | key | command | when | args |
|---|---|---|---|---|
| 1 | `ctrl+y` | `redo` | `editorTextFocus && !editorReadonly` |  |
| 2 | `shift+f11` | `workbench.action.toggleZenMode` |  |  |
| 3 | `ctrl+w` | `workbench.action.closeActiveEditor` |  |  |
| 4 | `ctrl+pageup` | `workbench.action.previousEditor` |  |  |
| 5 | `ctrl+pagedown` | `workbench.action.nextEditor` |  |  |
| 6 | `ctrl+k ctrl+b` | `workbench.action.toggleSidebarVisibility` |  |  |
| 7 | `ctrl+up` | `scrollLineUp` | `editorTextFocus` |  |
| 8 | `ctrl+down` | `scrollLineDown` | `editorTextFocus` |  |
| 9 | `ctrl+p` | `workbench.action.quickOpen` |  |  |
| 10 | `ctrl+r` | `workbench.action.gotoSymbol` |  |  |
| 11 | `ctrl+;` | `workbench.action.gotoSymbol` |  |  |
| 12 | `f12` | `editor.action.goToDeclaration` |  |  |
| 13 | `alt+-` | `workbench.action.navigateBack` |  |  |
| 14 | `alt+shift+-` | `workbench.action.navigateForward` |  |  |
| 15 | `f3` | `editor.action.nextMatchFindAction` | `editorTextFocus` |  |
| 16 | `f4` | `editor.action.nextMatchFindAction` | `editorTextFocus` |  |
| 17 | `shift+f4` | `editor.action.previousMatchFindAction` | `editorTextFocus` |  |
| 18 | `ctrl+shift+up` | `editor.action.moveLinesUpAction` | `editorTextFocus` |  |
| 19 | `ctrl+shift+down` | `editor.action.moveLinesDownAction` | `editorTextFocus` |  |
| 20 | `ctrl+shift+/` | `editor.action.commentLine` | `editorTextFocus` |  |
| 21 | `ctrl+k ctrl+up` | `workbench.action.splitEditor` |  |  |
| 22 | `alt+shift+1` | `workbench.action.joinTwoGroups` |  |  |
| 23 | `alt+shift+2` | `workbench.action.splitEditor` |  |  |
| 24 | `alt+shift+8` | `workbench.action.toggleEditorGroupLayout` |  |  |
| 25 | `ctrl+k ctrl+down` | `workbench.action.closeActiveEditor` |  |  |
| 26 | `ctrl+shift+]` | `editor.unfold` | `editorFocus` |  |
| 27 | `ctrl+k ctrl+0` | `editor.unfoldAll` | `editorFocus` |  |
| 28 | `alt+f12` | `editor.action.showContextMenu` | `editorTextFocus` |  |
| 29 | `ctrl+shift+d` | `editor.action.copyLinesDownAction` | `editorFocus` |  |
| 30 | `ctrl+l` | `expandLineSelection` | `editorFocus` |  |
| 31 | `ctrl+d` | `editor.action.addSelectionToNextFindMatch` | `editorFocus` |  |
| 32 | `ctrl+m` | `editor.action.jumpToBracket` | `editorFocus` |  |
| 33 | `ctrl+shift+/` | `editor.action.blockComment` | `editorFocus` |  |
| 34 | `ctrl+h` | `editor.action.startFindReplaceAction` |  |  |
| 35 | `ctrl+shift+k` | `editor.action.deleteLines` | `editorFocus` |  |
| 36 | `ctrl+shift+backspace` | `deleteAllLeft` | `editorFocus` |  |
| 37 | `ctrl+shift+delete` | `deleteAllRight` | `editorFocus` |  |
| 38 | `alt+shift+up` | `editor.action.insertCursorAbove` | `editorTextFocus` |  |
| 39 | `alt+shift+down` | `editor.action.insertCursorBelow` | `editorTextFocus` |  |
| 40 | `alt+shift+pageup` | `cursorColumnSelectPageUp` | `editorTextFocus` |  |
| 41 | `alt+shift+pagedown` | `cursorColumnSelectPageDown` | `editorTextFocus` |  |
| 42 | `ctrl+shift+l` | `editor.action.insertCursorAtEndOfEachLineSelected` | `editorTextFocus` |  |
| 43 | `alt+1` | `workbench.action.openEditorAtIndex1` |  |  |
| 44 | `alt+2` | `workbench.action.openEditorAtIndex2` |  |  |
| 45 | `alt+3` | `workbench.action.openEditorAtIndex3` |  |  |
| 46 | `alt+4` | `workbench.action.openEditorAtIndex4` |  |  |
| 47 | `alt+5` | `workbench.action.openEditorAtIndex5` |  |  |
| 48 | `alt+6` | `workbench.action.openEditorAtIndex6` |  |  |
| 49 | `alt+7` | `workbench.action.openEditorAtIndex7` |  |  |
| 50 | `alt+8` | `workbench.action.openEditorAtIndex8` |  |  |
| 51 | `alt+9` | `workbench.action.openEditorAtIndex9` |  |  |
| 52 | `alt+f3` | `editor.action.selectHighlights` | `editorFocus` |  |
| 53 | `ctrl+shift+r` | `workbench.action.showAllSymbols` |  |  |
| 54 | `alt+left` | `cursorWordStartLeft` | `editorTextFocus` |  |
| 55 | `alt+right` | `cursorWordEndRight` | `editorTextFocus` |  |
| 56 | `alt+shift+left` | `cursorWordStartLeftSelect` | `editorTextFocus` |  |
| 57 | `alt+shift+right` | `cursorWordEndRightSelect` | `editorTextFocus` |  |
| 58 | `ctrl+j` | `editor.action.joinLines` | `editorTextFocus` |  |
| 59 | `ctrl+k ctrl+u` | `editor.action.transformToUppercase` | `editorTextFocus` |  |
| 60 | `ctrl+k ctrl+l` | `editor.action.transformToLowercase` | `editorTextFocus` |  |
| 61 | `ctrl+k a` | `workbench.action.showErrorsWarnings` |  |  |
| 62 | `ctrl+k n` | `editor.action.marker.next` | `editorFocus` |  |
| 63 | `ctrl+k p` | `editor.action.marker.prev` | `editorFocus` |  |
| 64 | `ctrl+1` | `workbench.action.focusFirstEditorGroup` | `editorFocus` |  |
| 65 | `ctrl+2` | `workbench.action.focusSecondEditorGroup` | `editorFocus` |  |
| 66 | `ctrl+3` | `workbench.action.focusThirdEditorGroup` | `editorFocus` |  |
| 67 | `ctrl+p` | `workbench.action.quickOpenPreviousEditor` |  |  |
| 68 | `ctrl+k ctrl+k` | `deleteAllRight` | `editorTextFocus && !editorReadonly` |  |
| 69 | `ctrl+shift+space` | `editor.action.smartSelect.grow` | `editorTextFocus` |  |

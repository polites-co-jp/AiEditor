# 0-10 Sublime のキーの変換の試し

- 記録: 大岡越前守（2026-11-13）。下書き `tasks/2026-11-13-p0-envs-mydist-keys/sublime-keys.md`（蒙恬）を、材料と照らして確かめたうえで清書した。検証の記録は `tasks/2026-11-13-p0-verify-envs/verification-log.md`。
- 台本: `node scripts/convert-sublime-keys.mjs --md C:/b/p0/sublime/conversion.md --apply`（蒙恬が 2026-11-12T20:37:47Z に実行）。部品は `scripts/lib/sublime-keys.mjs`（純粋な関数）、`scripts/lib/zip-read.mjs`。
- 結果の正本: `extensions-src/mydist/package.json` の `contributes.keybindings`。機械の出力は `C:\b\p0\sublime\`（`converted-keybindings.json`・`dropped.json`・`claude-code-keybindings.json`・`conflicts.json`・`same-key-different-when.json`・`convert-meta.json`・`conversion.md`）。

## 確かめ方

- `sha256sum` で元の VSIX を独立にハッシュした: `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`（Open VSX の `.sha256` と一致）。Claude Code の VSIX も `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`（台帳と一致）。
- 元の manifest（`C:\b\p0\sublime\sublime-4.1.10.package.json`）の `contributes.keybindings` 71 項目を1つずつ読み、規則で選ばれる Windows のキーと `command`・`when` を、`extensions-src/mydist/package.json` の 69 項目と順に突き合わせた。過不足・取り違えは無い。
- `node tests/sublime-keys.test.mjs`（曹参のテスト）: 27 件すべて通過。
- Claude Code の既定のキーを、0-1 の記録（`records/phase0/claude-code-manifest.md`）の9件と突き合わせた。

## 1. 元

| 項目 | 値 |
|---|---|
| 拡張 | `ms-vscode.sublime-keybindings` 4.1.10（MIT。`extension/LICENSE.md` の本文を `extensions-src/mydist/ThirdPartyNotices.txt` に写した） |
| 取得元 | https://open-vsx.org/api/ms-vscode/sublime-keybindings/4.1.10/file/ms-vscode.sublime-keybindings-4.1.10.vsix |
| SHA-256 | `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`（Open VSX の `.sha256` と一致） |
| `contributes.keybindings` | 71 項目。`args` を持つ項目と、`-` で始まる取り消しの項目は無い |

## 2. 変換の規則

docs/04 の6.2 の規則に、次の3つを足した。

1. Windows のキーは、`win` があればそれ、無ければ `key`（docs/04 の6.2）。
2. 出力は `key`・`command` と、元にあれば `when`・`args`。`mac`・`linux`・`win` は持たない。`args` を残すのは足した規則（落とすとコマンドの意味が変わるため。今回の元には無い）。
3. 消した機能のコマンドを指す項目は落とす（docs/04 の6.2）。4.1.10 には当たるものが無く、0件。
4. 足した規則: 選んだキーが `none` の項目は落とす。元は「Windows と Linux には割り当てない」の意味で `"key": "none"` を使っている。`win` が `none` のときも `key` には戻らない。
5. 足した規則: 知らない修飾キーを含むキーの項目は、直さずに落とす（2026-11-13 リーダーの決定）。
6. 並べ替えと重複の除去はしない（元の拡張と同じふるまい）。

## 3. 結果

元の 71 項目のうち、69 項目を残した。落としたのは次の2項目。

| 理由 | key | mac | command | when |
|---|---|---|---|---|
| キーが `none`（規則4） | `none` | `alt+cmd+s` | `workbench.action.files.saveAll` | — |
| 知らない修飾キー `ctr`（規則5） | `ctr+shift+[` | `alt+cmd+[` | `editor.fold` | `editorFocus` |

`ctr+shift+[` は `ctrl` の書き誤りとみられる。本家の既定でも Windows の `editor.fold` は `ctrl+shift+[` なので、落としても失うものは無い。

元の中で同じキーを持つもの（そのまま残した）: `ctrl+shift+/`（`commentLine` は `editorTextFocus`、`blockComment` は `editorFocus`）、`ctrl+p`（`quickOpen` と `quickOpenPreviousEditor`。どちらも `when` 無し）。

## 4. Claude Code の既定のキーとの衝突

Claude Code 2.1.322 の manifest の `keybindings` は9件（docs/04 の6.2 と一致）。Windows で効くキーは次のとおり（7件は `win` の値、`insertAtMention` と `toggleFocusView` の2件は `win` が無いので `key` の値）。

| キー | コマンド | when |
|---|---|---|
| `alt+k` | `claude-vscode.insertAtMention` | `editorTextFocus` |
| `ctrl+escape` | `claude-vscode.focus` | `!config.claudeCode.useTerminal && editorTextFocus` |
| `ctrl+escape` | `claude-vscode.blur` | `!config.claudeCode.useTerminal && !editorTextFocus` |
| `ctrl+shift+escape` | `claude-vscode.editor.open` | `!config.claudeCode.useTerminal` |
| `ctrl+escape` | `claude-vscode.terminal.open.keyboard` | `config.claudeCode.useTerminal` |
| `ctrl+alt+K` | `claude-code.insertAtMentioned` | `editorTextFocus` |
| `ctrl+n` | `claude-vscode.newConversation` | `config.claudeCode.enableNewConversationShortcut && (...)` |
| `ctrl+alt+f` | `claude-vscode.toggleFocusView` | `(activeWebviewPanelId == 'claudeVSCodePanel' \|\| claude-vscode.sideBarActive) && (isMac \|\| (!(listFocus && listSupportsFind) && !inDebugRepl))` |
| `ctrl+shift+t` | `claude-vscode.reopenClosedSession` | `config.claudeCode.enableReopenClosedSessionShortcut && claude-vscode.lastClosedWasSession` |

- 衝突の定義: 正規化したキー（小文字にし、修飾キーを ctrl・shift・alt・meta の順に並べる。2段のキーは段ごとに比べる）が同じで、`when` が両方とも無いか同じもの。
- **衝突は0件**。同じキーで `when` だけが違うものも0件。変換した 69 項目は、上の7種類のキー（`alt+k`・`ctrl+escape`・`ctrl+shift+escape`・`ctrl+alt+k`・`ctrl+n`・`ctrl+alt+f`・`ctrl+shift+t`）を1つも使っていない。
- 本家の既定のキーとの重なりは、この一覧の対象外。例: Claude Code の `ctrl+n`（条件つき）は本家の「新しいファイル」と、`ctrl+shift+t` は「閉じたエディターを開き直す」と重なる。

## 5. docs への反映の案

docs/04 の6.2 に、上の2節の規則2（`args`）、規則4（`none`）、規則5（知らない修飾キー）を足す。

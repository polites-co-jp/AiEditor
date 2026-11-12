# 0-1 Claude Code 拡張の manifest とファイル一覧

- 記録: 大岡越前守（2026-11-13）。下書き `tasks/2026-11-13-p0-fetch-and-lock/claude-code-manifest.md`（蒙恬）を、材料と照らして確かめたうえで清書した。検証の記録は `tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`。
- 対象: `anthropic.claude-code` 2.1.322（win32-x64）。2026-11-13 の時点で Open VSX の最新。docs/04 の2節の版と同じ。
- 材料: `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\`（`package.json`＝Open VSX の `files.manifest`、`extension.vsixmanifest`、`files.json`＝VSIX の中央ディレクトリから読んだ名前とサイズ、`api.json`）
- JS の中身は開いていない（裁定）。確かめに開いたのは `package.json`・`extension.vsixmanifest`・`files.json`・`verify-result.json` だけ。

## 確かめ方

- `package.json` を自分で読み、下書きの表の項目・件数をすべて数え直した（configuration 23件、commands 31件、keybindings 9件、contributes のキー8個、walkthroughs 1件4段、menus 5か所）。
- `files.json` を自分で読み、49件の名前とサイズを確かめ、フォルダごとの合計を計算し直した。
- `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0`（2026-11-12T20:30Z に実行）で、`.sigzip` の `.signature.manifest` の49件と VSIX の49件の名前と SHA-256 が一致した（Open VSX の署名つきの一覧とも件数が合う）。
- `sha256sum` で VSIX を独立にハッシュした: `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`（docs/07 の2.7 の公開値と一致）。

## 1. manifest の項目と docs/03 の9節との比較

出典: https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json （24,521 バイト）

| 項目 | 値（2.1.322） | docs/03 の9節・docs/04 | 一致 |
|---|---|---|---|
| `engines` | `{"vscode": "^1.94.0"}` | ^1.94.0 | 一致 |
| `main` | `./extension.js` | — | 記録 |
| `browser` | キー無し | — | 記録 |
| `activationEvents` | `onStartupFinished`、`onWebviewPanel:claudeVSCodePanel` | 同じ | 一致 |
| `extensionKind` | manifest にキー無し。vsixmanifest の `Microsoft.VisualStudio.Code.ExtensionKind` は `workspace` | — | 記録 |
| `extensionDependencies` | キー無し（vsixmanifest も空） | 無い | 一致 |
| `extensionPack` | キー無し（vsixmanifest も空） | — | 記録 |
| `enabledApiProposals` | キー無し（vsixmanifest も空） | 無い | 一致 |
| `capabilities` | `untrustedWorkspaces: { supported: false }`。`virtualWorkspaces` は無し | ワークスペースの信頼を消さない | 一致 |
| `contributes` のキー | `configuration`・`jsonValidation`・`commands`・`keybindings`・`viewsContainers`・`views`・`walkthroughs`・`menus`（8個） | 同じ8個 | 一致 |
| `contributes.chatParticipants` | 無し | 無し | 一致 |
| `contributes.languageModelTools` | 無し | 無し | 一致 |
| `contributes.languageModelChatProviders` | 無し | 無し | 一致 |
| `contributes.mcpServerDefinitionProviders` | 無し | 無し | 一致 |
| `contributes.debuggers` | 無し | 記述なし | 記録 |
| `contributes.notebooks` | 無し | 記述なし | 記録 |
| `scripts`・`dependencies` | どちらも `{}` | — | 記録 |
| vsixmanifest の `ExecutesCode` | `true` | — | 記録 |

### contributes の中身

| キー | 件数・中身 |
|---|---|
| `configuration.properties` | 23件（すべて `claudeCode.*`） |
| `commands` | 31件（`claude-vscode.*` 28件、`claude-code.*` 3件） |
| `keybindings` | 9件（下の表） |
| `viewsContainers` | `activitybar` に `claude-sidebar`（`when: claude-code:doesNotSupportSecondarySidebar`）・`claude-sessions-sidebar`、`secondarySidebar` に `claude-sidebar-secondary` |
| `views` | webview の `claudeVSCodeSidebar`・`claudeVSCodeSidebarSecondary`・`claudeVSCodeSessionsList` |
| `jsonValidation` | `**/.claude/settings.json`・`**/.claude/settings.local.json`・`**/ClaudeCode/managed-settings.json`・`**/claude-code/managed-settings.json` を `./claude-code-settings.schema.json` で検査 |
| `walkthroughs` | 1件（`claude-code-walkthrough`、4段） |
| `menus` | `comments/commentThread/title`・`editor/context`・`editor/title`・`webview/context`・`commandPalette` |

### keybindings（Windows で効くキー。`win` があればそれ、無ければ `key`）

| command | キー | when |
|---|---|---|
| `claude-vscode.insertAtMention` | `alt+k` | `editorTextFocus` |
| `claude-vscode.focus` | `ctrl+escape` | `!config.claudeCode.useTerminal && editorTextFocus` |
| `claude-vscode.blur` | `ctrl+escape` | `!config.claudeCode.useTerminal && !editorTextFocus` |
| `claude-vscode.editor.open` | `ctrl+shift+escape` | `!config.claudeCode.useTerminal` |
| `claude-vscode.terminal.open.keyboard` | `ctrl+escape` | `config.claudeCode.useTerminal` |
| `claude-code.insertAtMentioned` | `ctrl+alt+K` | `editorTextFocus` |
| `claude-vscode.newConversation` | `ctrl+n` | `config.claudeCode.enableNewConversationShortcut && (...)` |
| `claude-vscode.toggleFocusView` | `ctrl+alt+f` | Claude のパネルかサイドバーにいるとき |
| `claude-vscode.reopenClosedSession` | `ctrl+shift+t` | `config.claudeCode.enableReopenClosedSessionShortcut && claude-vscode.lastClosedWasSession` |

## 2. 宣言から分かる受け手（docs/03 の9節に書かれていないもの）

宣言から読める事実だけを挙げる。右の列は推定。

| 宣言 | 事実 | 示唆（推定） |
|---|---|---|
| `menus."comments/commentThread/title"`（`when: commentController == claude-code-hunks`） | コメントのスレッドのタイトルにボタンを出す | 変更の塊の受け入れ・却下にコメントの API を使う見込み |
| `menus."editor/context"`（`when: resourceScheme == _claude_vscode_fs_right`） | 独自のスキームのエディタに右クリックの項目を出す | 独自のファイルシステムの提供者と差分エディタを使う見込み |
| `menus."editor/title"`、`commands` の `enablement: claude-vscode.viewingProposedDiff` | エディタのタイトルに受け入れ・却下のボタン | 同上 |
| `menus."webview/context"` | Webview の右クリックの項目 | — |
| `viewsContainers` の `when: claude-code:doesNotSupportSecondarySidebar` | セカンダリサイドバーが無い本体ではアクティビティバーに出す | — |
| `claudeCode.usePythonEnvironment` の説明 | "Requires the Python extension" | Python 拡張は入れない（docs/04 の2節）ので、この設定は効かないだけの見込み |

docs/03 の9節の「消さない受け手」に、コメント（`commentController`）・差分エディタ・拡張のファイルシステムの提供者を足す案が、蒙恬の `doc-corrections.md` の2.2 にある（docs の書き換えはリーダー）。

## 3. VSIX のファイルの一覧

- VSIX: `Anthropic.claude-code-2.1.322@win32-x64.vsix`（165,854,286 バイト、SHA-256 `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`）
- エントリーは49件（ディレクトリのエントリーは無い）。展開後の合計は 359,086,949 バイト。全件は `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\files.json`。
- `LICENSE` のファイルは無い。`node_modules` も無い。

| パス | サイズ（バイト） | 種類 |
|---|---|---|
| `extension.vsixmanifest` | 2,146 | 宣言（XML） |
| `[Content_Types].xml` | 754 | zip の約束 |
| `extension/package.json` | 24,521 | manifest |
| `extension/README.md` | 1,473 | 文書 |
| `extension/claude-code-settings.schema.json` | 288,691 | JSON スキーマ（jsonValidation の参照先） |
| `extension/extension.js` | 3,579,313 | 拡張の本体（開いていない） |
| `extension/webview/index.js` | 6,047,746 | Webview の JS（開いていない） |
| `extension/webview/index.css` | 474,592 | Webview の CSS |
| `extension/webview/fonts/KaTeX_*.woff2` | 20件で 259,792 | 数式のフォント |
| `extension/resources/native-binary/claude.exe` | 346,496,160 | 実行ファイル（同梱の CLI） |
| `extension/resources/audio-capture/x64-win32/audio-capture.node` | 509,440 | 実行ファイル（Node のネイティブアドオン） |
| `extension/resources/` 直下の `*.svg`・`*.png`・`*.jpg` | 11件で 944,920 | 画像 |
| `extension/resources/walkthrough/*` | 8件で 457,401 | walkthroughs の画像と step1〜4.md |

## 4. 実行ファイル・主なフォルダ・サイズ

### 実行ファイル（.exe・.dll・.node）

| パス | サイズ（バイト） | 確かめたこと |
|---|---|---|
| `extension/resources/native-binary/claude.exe` | 346,496,160 | `sha256sum` で `345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298`。`https://downloads.claude.ai/claude-code-releases/2.1.322/manifest.json` の `platforms.win32-x64.checksum` と一致し、`size` も一致。`manifest.json.sig` の GPG は指紋 `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE` で通った。Authenticode は `Valid`、署名者 `CN="Anthropic, PBC", O="Anthropic, PBC"`。Defender の走査で脅威なし（詳細は `lock-verification.md`） |
| `extension/resources/audio-capture/x64-win32/audio-capture.node` | 509,440 | VSIX ごとの Defender の走査（アーカイブの中も走査）で脅威なし。単体の署名とハッシュは見ていない（docs/04 の4節の3が対象にするのは CLI だけ） |

`.dll` は無い。

### 主なフォルダ（展開後のサイズの大きい順）

| フォルダ | ファイル数 | サイズ（バイト） | 割合 |
|---|---|---|---|
| `extension/resources/native-binary/` | 1 | 346,496,160 | 96.5% |
| `extension/webview/`（直下） | 2 | 6,522,338 | 1.8% |
| `extension/`（直下） | 4 | 3,893,998 | 1.1% |
| `extension/resources/`（直下） | 11 | 944,920 | 0.3% |
| `extension/resources/audio-capture/`（下の階層を含む） | 1 | 509,440 | 0.1% |
| `extension/resources/walkthrough/` | 8 | 457,401 | 0.1% |
| `extension/webview/fonts/` | 20 | 259,792 | 0.1% |
| 直下（`extension.vsixmanifest`・`[Content_Types].xml`） | 2 | 2,900 | 0.0% |

### docs/04 の4節の3の「未確認」で、決まったこと

- 同梱の CLI の場所: VSIX の中の `extension/resources/native-binary/claude.exe`。
- `manifest.json` の platform の名前: `win32-x64`。`platforms` は `darwin-arm64`・`darwin-x64`・`linux-arm64`・`linux-x64`・`linux-arm64-musl`・`linux-x64-musl`・`win32-x64`・`win32-arm64` の8つで、各要素は `binary`・`checksum`・`size`。
- `manifest.json` の最上位のキー: `version`（2.1.322）・`manifestSignatureEnforcement`・`commit`・`buildDate`・`platforms`・`sdkCompat`。

## 結論

宣言の上では、2.1.322 は本家のチャット（`chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`）にも、提案中の API（`enabledApiProposals`）にも、ほかの拡張（`extensionDependencies`）にも依存していない。docs/03 の9節の記述と食い違う点は無い。ただし、9節に書かれていない受け手（コメントの API、差分エディタ、独自のファイルシステム）が宣言に出てくる。

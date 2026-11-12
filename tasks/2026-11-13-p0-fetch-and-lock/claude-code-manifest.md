# 0-1 Claude Code 拡張の manifest とファイル一覧（下書き）

- 作成: 蒙恬（2026-11-13）。大岡越前守が確かめて `records/phase0/claude-code-manifest.md` に清書する。
- 対象: `anthropic.claude-code` 2.1.322（win32-x64）。2026-11-13 の時点の Open VSX の最新で、docs/04 の版と同じ。
- 取り方: `node scripts/lock-fetch.mjs`（Open VSX の `files.manifest` を `package.json` として保存）。ファイルの一覧は `node scripts/lock-verify.mjs` が VSIX（zip）の中央ディレクトリから名前とサイズだけを読んだもの。**JS の中身は開いていない**（裁定）。開いたのは package.json・extension.vsixmanifest（どちらも JSON / XML の宣言）だけ。
- 材料の置き場所: `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\`（`package.json`、`extension.vsixmanifest`、`files.json`＝ファイルの一覧、`api.json`＝Open VSX のメタデータ）

## 1. manifest の項目と 2.1.322 の値（docs/03 の9節）との比較

出典: https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json （SHA-256 `ab8fa8330ec7c5cd584ead332b9fa4488228b09824b3b66f34e37167fec5b4ff`、24,521 バイト）

| 項目 | 値（2.1.322） | docs/03 の9節・docs/sources の記述 | 一致 |
|---|---|---|---|
| `engines` | `{"vscode": "^1.94.0"}` | ^1.94.0（docs/04 の2節） | 一致 |
| `main` | `./extension.js` | `./extension.js`（sources 1-2） | 一致 |
| `browser` | キー無し | キー無し | 一致 |
| `activationEvents` | `["onStartupFinished", "onWebviewPanel:claudeVSCodePanel"]` | 同じ | 一致 |
| `extensionKind` | manifest にキー無し。vsixmanifest の `Microsoft.VisualStudio.Code.ExtensionKind` は `workspace` | 同じ（sources 1-2） | 一致 |
| `extensionDependencies` | キー無し（vsixmanifest も空） | 無い | 一致 |
| `extensionPack` | キー無し（vsixmanifest も空） | 無い | 一致 |
| `enabledApiProposals` | キー無し（vsixmanifest も空） | 無い | 一致 |
| `capabilities` | `{"untrustedWorkspaces": {"supported": false, "description": "untusted workspaces are not supported"}}`。`virtualWorkspaces` は無し | 同じ | 一致 |
| `contributes` のキー | `configuration`・`jsonValidation`・`commands`・`keybindings`・`viewsContainers`・`views`・`walkthroughs`・`menus`（8個） | 同じ8個 | 一致 |
| `contributes.chatParticipants` | 無し | 無し | 一致 |
| `contributes.languageModelTools` | 無し | 無し | 一致 |
| `contributes.languageModelChatProviders` | 無し | 無し | 一致 |
| `contributes.mcpServerDefinitionProviders` | 無し | 無し | 一致 |
| `contributes.debuggers` | 無し | 9節に記述なし（無いことは今回確かめた） | — |
| `contributes.notebooks` | 無し | 9節に記述なし（無いことは今回確かめた） | — |
| `scripts`・`dependencies` | どちらも `{}` | 空（sources 1-2） | 一致 |
| vsixmanifest の `ExecutesCode` | `true` | 記述なし | — |

### contributes の中身（件数）

| キー | 件数・中身 | docs/sources との比較 |
|---|---|---|
| `configuration.properties` | 23件（`claudeCode.*`） | 23件で一致 |
| `commands` | 31件（`claude-vscode.*` 28件、`claude-code.*` 3件） | 31件・3件で一致 |
| `keybindings` | 9件 | 9件で一致 |
| `viewsContainers` | `activitybar` に `claude-sidebar`・`claude-sessions-sidebar`、`secondarySidebar` に `claude-sidebar-secondary` | 一致 |
| `views` | webview の `claudeVSCodeSidebar`・`claudeVSCodeSidebarSecondary`・`claudeVSCodeSessionsList` | 一致 |
| `jsonValidation` | `**/.claude/settings.json`・`**/.claude/settings.local.json`・`**/ClaudeCode/managed-settings.json`・`**/claude-code/managed-settings.json` を `./claude-code-settings.schema.json` で検査 | 一致（ファイルの一覧は今回初めて書いた） |
| `walkthroughs` | 1件（`claude-code-walkthrough`、4段） | 一致 |
| `menus` | `comments/commentThread/title`・`editor/context`・`editor/title`・`webview/context`・`commandPalette` | **9節に書かれていない受け手がある**（下の2節） |

### keybindings（Windows で効くキー）

`win` があればそれ、無ければ `key`。docs/04 の6.2 の衝突の一覧に使う（変換は別の蒙恬の 0-10）。

| command | Windows のキー | when |
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

docs/04 の6.2 は例として `ctrl+escape`・`ctrl+shift+escape`・`ctrl+alt+f`・`ctrl+alt+k` を挙げている。ほかに `alt+k`・`ctrl+n`・`ctrl+shift+t`（条件つき）がある。

## 2. 宣言から分かる受け手（docs/03 の9節への足し）

9節は「受け手（Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼）は消さない」と書く。manifest の `menus` と `when` には、ほかの受け手も出てくる。宣言から読める事実だけを挙げる（コードは読んでいない）。

| 宣言 | 事実 | 示唆（推定） |
|---|---|---|
| `menus."comments/commentThread/title"` の `when: commentController == claude-code-hunks` | コメントのスレッドのタイトルにボタンを出す | 変更の塊（hunk）の受け入れ・却下に**コメントの API**（commentController）を使う見込み。裁定でコメント（contrib/comments）は残すので、今の設計で壊れないが、9節の「消さない受け手」に足すべき |
| `menus."editor/context"` の `when: resourceScheme == _claude_vscode_fs_right` | 独自のスキーム `_claude_vscode_fs_right` のエディタに右クリックの項目を出す | 提案した変更の表示に、**独自のファイルシステムの提供者**と**差分エディタ**を使う見込み。差分ビューは裁定で残す |
| `menus."editor/title"`、`commands` の `enablement: claude-vscode.viewingProposedDiff` | エディタのタイトルに受け入れ・却下のボタン | 同上 |
| `menus."webview/context"` | Webview の右クリックの項目 | Webview の文脈メニュー |
| `viewsContainers` の `when: claude-code:doesNotSupportSecondarySidebar` | セカンダリサイドバーが無い本体では、アクティビティバーに出す | セカンダリサイドバーを消しても代わりに出る作り |
| `claudeCode.usePythonEnvironment` の説明 | "Requires the Python extension" | Python 拡張は入れない（docs/04 の2節）。この設定は効かないだけの見込み |

## 3. VSIX のファイルの一覧

- VSIX: `Anthropic.claude-code-2.1.322@win32-x64.vsix`（165,854,286 バイト。SHA-256 `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`）
- エントリーは **49 件**（ディレクトリのエントリーは無い）、展開後の合計 **359,086,949 バイト**（約 342 MiB）。全件の名前とサイズは `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\files.json`。
- `.sigzip` の `.signature.manifest` の 49 件と、名前も SHA-256 も一致した（lock-verification.md の署名の項目）。

| パス | サイズ（バイト） | 種類 |
|---|---|---|
| `extension.vsixmanifest` | 2,146 | 宣言（XML） |
| `[Content_Types].xml` | 754 | zip の約束 |
| `extension/package.json` | 24,521 | manifest |
| `extension/README.md` | 1,473 | 文書 |
| `extension/claude-code-settings.schema.json` | 288,691 | JSON スキーマ（jsonValidation の参照先） |
| `extension/extension.js` | 3,579,313 | 拡張の本体（JS。開いていない） |
| `extension/webview/index.js` | 6,047,746 | Webview の JS（開いていない） |
| `extension/webview/index.css` | 474,592 | Webview の CSS |
| `extension/webview/fonts/KaTeX_*.woff2` | 20 件で 259,792 | 数式のフォント |
| `extension/resources/native-binary/claude.exe` | 346,496,160 | **実行ファイル（同梱の CLI）** |
| `extension/resources/audio-capture/x64-win32/audio-capture.node` | 509,440 | **実行ファイル（Node のネイティブアドオン）** |
| `extension/resources/*.svg`・`*.png`・`*.jpg` | 11 件で 944,920 | 画像（ロゴ、説明の図） |
| `extension/resources/walkthrough/*` | 8 件で 457,401 | walkthroughs の画像と step1〜4.md |

`LICENSE` のファイルは VSIX に無い（ライセンスは manifest の `license` の文と、Open VSX の API の `license` だけ）。`node_modules` は無い。

## 4. 実行ファイル・主なフォルダ・サイズ

### 実行ファイル（.exe・.dll・.node）

| パス | サイズ（バイト） | 確かめたこと |
|---|---|---|
| `extension/resources/native-binary/claude.exe` | 346,496,160 | 同梱の CLI。SHA-256 `345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298` が `https://downloads.claude.ai/claude-code-releases/2.1.322/manifest.json` の `platforms.win32-x64.checksum` と一致し、サイズも `platforms.win32-x64.size`（346,496,160）と一致。Authenticode は Valid、署名者 `CN="Anthropic, PBC", O="Anthropic, PBC"`（発行者 DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1、拇印 `60C2D9C51F09822FFF4F194DE9EEDB67451292D1`、期限 2027-10-29、タイムスタンプ DigiCert）。Defender で脅威なし |
| `extension/resources/audio-capture/x64-win32/audio-capture.node` | 509,440 | Node のネイティブアドオン（名前から音声の取り込み用と推定）。署名とハッシュはまだ見ていない（docs/04 の4節の3は CLI だけを対象にしている）。VSIX ごとの Defender の走査（アーカイブの中も走査する `-DisableRemediation`）で脅威なし |

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

### 決まったこと（docs/04 の4節の3の「未確認」）

- 同梱の CLI の場所: `extension/resources/native-binary/claude.exe`（VSIX の中のパス）。
- manifest.json の platform の名前: `win32-x64`（Open VSX の targetPlatform と同じ名前）。manifest.json の platforms は `darwin-arm64`・`darwin-x64`・`linux-arm64`・`linux-x64`・`linux-arm64-musl`・`linux-x64-musl`・`win32-x64`・`win32-arm64` の8つ。各要素は `binary`・`checksum`・`size`。
- manifest.json の最上位のキー: `version`・`manifestSignatureEnforcement`・`commit`・`buildDate`・`platforms`・`sdkCompat`。

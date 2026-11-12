# 拡張・外部サービスの調査（Claude VSCode フォーク設計用）

取得日: 2026-11-12 / 調査: 明石元二郎（取得は石光真清）
凡例: [一次]=公式文書・公式配布物・API、[二次]=第三者。「原文確認」=ページ本文を直接読んだ。「原文で要照合」=要約モデル経由の引用。
制約順守: Claude Code 拡張は API メタデータ・manifest・公式文書だけを見た。圧縮 JS は読んでいない。

---

## 1. Open VSX の Anthropic.claude-code

### 1-1 API メタデータ [一次・原文確認]
出典: https://open-vsx.org/api/Anthropic/claude-code ／ https://open-vsx.org/api/Anthropic/claude-code/win32-x64
- 最新版 2.1.322。公開日(timestamp): win32-x64 は 2026-11-10T02:30:51Z。上位 URL の既定は alpine-arm64 (2026-11-10T02:29:38Z)。
- verified: true。namespace: Anthropic。publishedBy: loginName igorkofman (github)。publishedWithTrustedPublishing: false。
- namespaceAccess / allTargetPlatforms のキーは API に無い。
- license: "© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance."
- engines: {"vscode":"^1.94.0"}。extensionKind: ["workspace"]。dependencies / bundledExtensions: 空。
- targetPlatform は 8 種（universal 版は一覧に無い）。VSIX サイズ(バイト): win32-x64 165,854,286 / win32-arm64 160,059,303 / linux-x64 163,851,619 / linux-arm64 164,887,698 / darwin-x64 158,697,431 / darwin-arm64 152,279,368 / alpine-x64 156,034,992 / alpine-arm64 156,382,207。
- files のキー(8 個。win32-x64):
  - download: .../win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.vsix
  - signature: 同 ...@win32-x64.sigzip
  - sha256: 同 ...@win32-x64.sha256
  - manifest: 同 .../file/package.json
  - readme, icon, vsixmanifest(extension.vsixmanifest)
  - publicKey: https://open-vsx.org/api/-/public-key/14ccb407-4e79-41ed-be5a-6d608325c45a
  （.../ は https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/）

### 1-2 manifest (package.json, win32-x64 2.1.322) [一次・原文確認]
出典: https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json
- main: ./extension.js。browser: キー無し。
- activationEvents: ["onStartupFinished", "onWebviewPanel:claudeVSCodePanel"]
- extensionKind: manifest にキー無し（API と vsixmanifest では workspace）。
- extensionDependencies / extensionPack / enabledApiProposals: manifest にキー無し（vsixmanifest でも空）。
- capabilities: {"untrustedWorkspaces":{"supported":false,...}}。virtualWorkspaces のキー無し。
- scripts / dependencies: 空。
- contributes のキー: configuration, jsonValidation, commands, keybindings, viewsContainers, views, walkthroughs, menus。
- 存在しないもの: chatParticipants, languageModelTools, languageModelChatProviders, mcpServerDefinitionProviders（contributes に無し）。uriHandler も contributes に無し（uriHandler は contributes のキーではなく、manifest 上に記述が無いという事実だけ。コード側の登録有無は読んでいないので未確認）。
- configuration: 23 件。主なもの claudeCode.environmentVariables, useTerminal, allowDangerouslySkipPermissions, claudeProcessWrapper, respectGitIgnore, initialPermissionMode (enum: default, manual, acceptEdits, plan, bypassPermissions), disableLoginPrompt, autosave, focusView, preferredLocation (sidebar/panel), attachOpenFile, attachSelection, archiveInactiveSessions, usePythonEnvironment。
- commands: 31 件。大半が claude-vscode.*（例 editor.open, newConversation, terminal.open, installPlugin, logout）。claude-code.* は 3 件（acceptProposedDiff, rejectProposedDiff, insertAtMentioned）。
- keybindings: 9 件。例 claude-vscode.focus=ctrl+escape、editor.open=ctrl+shift+escape、toggleFocusView=ctrl+alt+f、claude-code.insertAtMentioned=ctrl+alt+K。
- viewsContainers: activitybar の claude-sidebar / claude-sessions-sidebar、secondarySidebar の claude-sidebar-secondary。
- views: webview の claudeVSCodeSidebar, claudeVSCodeSidebarSecondary, claudeVSCodeSessionsList。
- jsonValidation: .claude/settings.json 等を ./claude-code-settings.schema.json で検証（スキーマ本体は未読）。
- vsixmanifest の Assets は extension/package.json, README.md, resources/claude-logo.png の 3 件のみ記載（Assets 欄の一覧であって、VSIX 全ファイルの一覧ではない）。

### 1-3 VSIX のファイル一覧
- **未確認**。取得役の許可（GET のみ、バイナリ拒否）では VSIX（win32-x64 は 165,854,286 バイト、約 166MB）の中身を列挙できなかった。.exe / .node / .dll の有無、主なフォルダは不明。サイズは 1-1 の API 値のみ。
- 補足: VSIX がプラットフォーム別に分かれ、各 152〜166MB（1-1 の API 値。win32-arm64 は 160,059,303 バイト、約 160MB）である事実から、ネイティブ成分を含む可能性は示唆されるが、中身は確認していない。

### 1-4 完全性（sha256・署名・公開鍵）
- sha256 [一次・原文確認]: files.sha256 の URL を GET すると 64 桁 16 進 1 行。win32-x64 2.1.322 の値 8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4。VSIX 本体との照合は未実施（未確認）。
- 署名: files.signature (.sigzip) の URL は Content-Type application/zip で応答。中身と検証結果は未確認。
- 公開鍵: 上記 publicKey URL の本文は PEM (BEGIN PUBLIC KEY)。ASN.1 の OID 1.3.101.112 から Ed25519 と推定（推定。公式の明記は未確認）。
- 検証の道具 [一次・原文で要照合]: https://raw.githubusercontent.com/eclipse/openvsx/master/cli/README.md
  - `ovsx verify <extension.vsix>`: 登録所の署名を確認。
  - `ovsx verify-signature -i <package.vsix> -m <manifest> -s <signature> -k <publicKey>`: registry へ通信せず検証。-k 必須。
- Open VSX wiki (Publishing Extensions) に sigzip・sha256・公開鍵の記述は見つからなかった。sigzip の仕様の公式文書も見つからなかった。

### 1-5 参照した VS Code 公式文書 [一次・原文で要照合]
- https://code.visualstudio.com/api/references/extension-manifest（main, extensionKind, capabilities）
- https://code.visualstudio.com/api/extension-guides/workspace-trust（untrustedWorkspaces.supported=false は Restricted Mode で動かない、未宣言は Restricted Mode で無効化）。virtualWorkspaces は当該ページに記述無し。

---

## 2. Claude Code CLI のハッシュ一覧（問い3）

[一次・原文確認] https://code.claude.com/docs/en/setup （Advanced setup）
- 出している。引用: "Each release publishes a `manifest.json` containing SHA256 checksums for every platform binary. The manifest is signed with an Anthropic GPG key, so verifying the signature on the manifest transitively verifies every binary it lists."
- 形式: 版ごとに `https://downloads.claude.ai/claude-code-releases/$VERSION/manifest.json` と `manifest.json.sig`（detached 署名）。ハッシュは `platforms.<platform>.checksum`。
- 署名は 2.1.89 以降のみ: "Manifest signatures are available for releases from `2.1.89` onward. Earlier releases publish checksums in `manifest.json` without a detached signature."
- 公開鍵: `curl -fsSL https://downloads.claude.ai/keys/claude-code.asc | gpg --import`。指紋 31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE（本文の指定）。
- Windows 計算例: `(Get-FileHash claude.exe -Algorithm SHA256).Hash.ToLower()`
- プラットフォーム署名: macOS は "Anthropic PBC" で署名・公証、Windows は "Anthropic, PBC"（Authenticode）、Linux は個別署名なし（本文）。
- npm [一次の配布物、registry JSON は要約経由・原文で要照合]: https://registry.npmjs.org/@anthropic-ai/claude-code/2.1.322 に dist.integrity (sha512-oP7oW4vM5DREWfL1jn4JSGlmLcrJ5QmppgADrVNJBUPiC1mQ5YvRrke0on+YZ/3QhKIaCJtdr6jPvehcAQIHLQ==)、shasum ddcbcd5148fa1027548ecf555419c5bd39f2906f、signatures 2 件（keyid SHA256:DhQ8wR5A...、所有者は未確認）。
- GitHub releases (anthropics/claude-code) のアセット名・checksum の有無: 未確認。

---

## 3. Notion API（問い4）

### 3-1 上限 [一次・原文確認] https://developers.notion.com/reference/request-limits
- rich_text 1 要素の text.content: 2000 文字。text.link.url: 2000 文字。equation.expression: 1000 文字。
- 「rich text を含むあらゆるブロック種の配列」: 100 要素。
- 1 リクエストのペイロード: "maximum size of 1000 block elements and 500KB overall."。超過は 400 validation_error。
- レート制限: Business/Enterprise は 600 回/分（平均 10/秒）、その他は 180 回/分（平均 3/秒）。データソースのクエリは別枠で接続あたり約 3 回/秒。超過は 429 rate_limited と Retry-After（整数秒）。429 と 529 を処理し Retry-After に従うこと。ワークスペース単位の共有上限もあり、その Retry-After は 1 分超もある。

### 3-2 append [一次・原文で要照合（ページが大きく原文取得失敗）] https://developers.notion.com/reference/patch-block-children
- 1 リクエストで足せる children は 100 ブロック。超えるとエラー。子を持てるブロックは 1 リクエスト内で 2 階層までのネスト。

### 3-3 code ブロックの language [一次・原文で要照合] https://developers.notion.com/reference/block
- 許可値の一覧に "json" がある（"javascript" - "json" - "julia" の並び）。

### 3-4 API 版 2025-09-03 [一次・原文確認] https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03
- ページ作成: `POST /v1/pages`、`"parent": {"type": "data_source_id", "data_source_id": "..."}`。
- "You can't use a database ID with the retrieve data source API, or vice-versa. The two types of IDs are not interchangeable."
- data_source_id の取得: `GET /v1/databases/{database_id}` の応答の `data_sources: [{id, name}]`（Notion-Version 2025-09-03 指定）。アプリでは Manage data sources の Copy data source ID。
- クエリ: https://developers.notion.com/reference/query-a-data-source [原文確認] `POST https://api.notion.com/v1/data_sources/{data_source_id}/query`。本体は filter, sorts, start_cursor, page_size など任意。ガイド内コメントには PATCH と書かれた箇所があるが、同ガイドのコード例とリファレンスは POST（文書内の食い違い）。
- Notion-Version ヘッダは全 REST リクエストで必須（Versioning ページ、原文確認）。最新版の値は本文から確認できず（公式例は 2026-03-11）。

### 3-5 内部インテグレーション [一次・原文確認] https://developers.notion.com/docs/authorization
- 作成: Developer portal で作る。作成にはワークスペースオーナーが必要。トークンは Configuration タブで取得。
- 使い方: `Authorization: Bearer {INTEGRATION_TOKEN}`。
- 共有: ページの ••• メニュー → Add connections で接続を選ぶ。共有していないページへのリクエストはエラー。
- トークンはソースやバージョン管理に入れず環境変数から読む、と公式が書いている。
- 内部インテグレーションで子ページが親の共有に従うかは本文で未確認。

### 3-6 last_edited_time [一次・原文確認] https://developers.notion.com/reference/page
- 型は ISO 8601 文字列。例 "2023-03-08T18:25:00.000Z"（ミリ秒 3 桁）。
- 分単位に丸められるかについて、公式文書に記述なし（未確認）。

---

## 4. Windows のトークン保管（問い5）

- ConvertFrom-SecureString [一次・原文で要照合]:
  - 5.1 https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring?view=powershell-5.1
  - 7.6 同 ?view=powershell-7.6
  - 両版とも: Key / SecureKey 指定時は AES、"If no key is specified, the Windows Data Protection API (DPAPI) is used to encrypt the standard string representation." （この文は両版で同じ）。
  - 「現在のユーザーに結びつく」という語句は両ページに無い。公式ページからは未確認。
  - 差分: 7.6 のみ Note "The contents of a SecureString aren't encrypted on non-Windows systems"。-AsPlainText は 7 のみ（7.0 で追加）。
- .NET SecureString [一次・原文で要照合] https://learn.microsoft.com/en-us/dotnet/api/system.security.securestring : 非 Windows では内部記憶を暗号化しない。新規開発での SecureString 利用は推奨しない旨の記述がある。
- Credential Manager を標準機能だけで読む方法:
  - cmdkey [一次・原文で要照合] https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmdkey : 作成・一覧・削除。"Passwords are not displayed after they're stored." 取り出しの記載は無い（取り出せないと公式が明言しているわけではない）。
  - CredReadW [一次・原文で要照合] https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw : Win32 API（Advapi32.dll）。PowerShell からの呼び出し（P/Invoke）の公式手順は無い。
  - PasswordVault [一次・原文で要照合] https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.passwordvault : WinRT クラス。PowerShell から使う公式手順は無い。
  - 結論: 追加モジュール無しで公式に手順が示された読み取り手段は、確認できなかった（未確認）。[二次・未検証] PowerShell Gallery の CredMan が CredRead を P/Invoke する例がある。

---

## 5. winget ID（問い6）

| ツール | ID | 根拠 |
|---|---|---|
| ShellCheck | koalaman.shellcheck | [一次・原文で要照合] https://github.com/koalaman/shellcheck#installing に `winget install --id koalaman.shellcheck`。winget-pkgs に 0.9.0 / 0.10.0 / 0.11.0（要約、要照合） |
| shfmt | mvdan.shfmt | [二次・パスからの推定] https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/mvdan/shfmt に 3.6.0〜3.14.1。公式 README (https://github.com/mvdan/sh) に winget の記述は無く、go install のみ（Go 1.26 以降が必要と記載） |
| PowerShell 7 | Microsoft.PowerShell | [一次・原文で要照合] https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows `winget install --id Microsoft.PowerShell --source winget`（7.6.0 以降は MSIX が既定。MSI は `--installer-type wix`）。公式文書は最新 7.6.6 と記すが、winget-pkgs の要約では最大 7.5.13.0 で食い違い（未解決） |
| Git for Windows | Git.Git | [一次・原文で要照合] https://git-scm.com/install/windows `winget install --id Git.Git -e --source winget`。同ページ注記: winget の Git.Git は Git for Windows プロジェクトが保守しておらず最新版とずれることがある。公式ビルドは 2.56.1 (2026-11-10) |
| Node.js LTS | OpenJS.NodeJS.LTS | [二次・パスからの推定] https://github.com/microsoft/winget-pkgs/tree/master/manifests/o/OpenJS/NodeJS/LTS（24.11.0〜26.13.1）。公式 https://nodejs.org/en/download に winget の記述は無い。最新 LTS は v26.13.1（要約） |
| Python 3 | 公式は 9NQ7512CXL7T（Python install manager） | [一次・原文で要照合] https://docs.python.org/3/using/windows.html `winget install 9NQ7512CXL7T -e --accept-package-agreements --disable-interactivity`。従来のインストーラは 3.14 から非推奨、3.16 以降は作られない。版別 ID は winget-pkgs のパス（Python/Python/3/13, 3/14）から Python.Python.3.13 / Python.Python.3.14 と推定（ID 文字列は公式文書で未確認）。Python.PythonInstallManager もパスで存在（二次） |

---

## 6. 言語拡張（問い7）

共通: Open VSX の JSON に namespaceAccess / namespaceDetails は無い。verified は API の `verified` 項目。publishedBy.loginName が open-vsx のものは Open VSX 側が公開した形。出典はいずれも https://open-vsx.org/api/<namespace>/<name>（原文確認）。機能欄の README 引用は要約経由で原文で要照合。

| 拡張 | 最新版 | 公開日 | license | engines.vscode | verified |
|---|---|---|---|---|---|
| dotenv.dotenv-vscode | 1.5.8 | 2026-10-01 | MIT | ^1.65.0 | true |
| mikestead.dotenv | 1.0.1 | 2020-04-13 | MIT | ^1.5.1 | true |
| weixu.wx-vsce-dotenv（参考） | 0.2.3 | 2026-10-15 | MIT | ^1.96.0（要照合） | true |
| mechatroner.rainbow-csv | 3.24.1 | 2026-03-01 | MIT | ^1.95.0 | true |
| mads-hartmann.bash-ide-vscode | 1.43.2 | 2026-09-21 | MIT | ^1.91.0 | true |
| detachhead.basedpyright | 1.40.2 | 2026-10-04 | MIT | ^1.101.0 | true |
| ms-vscode.powershell | 2025.4.0 | 2025-10-09 | "SEE LICENSE IN LICENSE.txt" | ^1.101.0 | true |
| tomoki1207.pdf | 1.2.2 | 2022-12-23 | API に license 項目無し。VSIX 内 LICENSE.txt あり | ^1.46.0 | true |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | 2026-07-28 | "SEE MIT LICENSE IN LICENSE.md" | ^1.131.0 | true |

- 追記（2026-11-12 の再取得）: ms-vscode.powershell の license 欄 "SEE LICENSE IN LICENSE.txt" は、Open VSX の API と GitHub の package.json の双方がそう書く値で、LICENSE.txt の本文（GitHub の main と、VSIX 内の LICENSE.txt の双方）の冒頭は "Copyright (c) Microsoft Corporation. MIT License" だった。tomoki1207.pdf の LICENSE（GitHub の master と、VSIX 内の LICENSE.txt の双方）は、冒頭に PDF.js 等の第三者表記があり、続いて "Copyright (c) tomoki1207 / MIT License" だった。

### 訂正
- 依頼の `dotenvx.dotenv-vscode` は Open VSX に無い（404）。実在 ID は `dotenv.dotenv-vscode`（表示名 Dotenv Official、namespaceDisplayName "dotenvx"、repository https://github.com/dotenvx/dotenv-vscode）。
- `ms-vscode.PowerShell` は小文字 `ms-vscode.powershell` で登録（API の URL は大文字小文字を問わず 200）。

### 機能
- dotenv.dotenv-vscode（publisher Scott Motte / motdotla）: 構文ハイライトあり、`process.env.` の補完あり（値はマスク）、暗号化 .env の decryption peeking。エラー表示（lint）の記述は README に見つからず（未確認）。
- mikestead.dotenv（publishedBy open-vsx、2020 年から更新なし）: README は "VSCode .env syntax highlighting" のみ。補完・診断の記述なし。
- weixu.wx-vsce-dotenv（参考の有力候補）: 構文ハイライト、`$`/`${` 補完、診断 7 種（ENV005 duplicate key など）。設定 dotenv.diagnostics.enabled（既定 true）/ onType。ほか apertacodex/dotenv-manager（"formatter, linter, and manager" と説明、未確認）。
- mechatroner.rainbow-csv: CSV の検査あり（"Automatic CSV consistency checks (CSVLint)"。行内の二重引用符の整合、各行のフィールド数の一致）。列の色分け、RBQL もあり。
- mads-hartmann.bash-ide-vscode [package.json 原文確認]: `bashIde.shellcheckPath`（既定 "shellcheck"、空文字で lint 無効）、`bashIde.shfmt.path`（既定 "shfmt"、空文字で整形無効）。dependencies に bash-language-server 5.8.1。VSIX への同梱は未確認。ShellCheck・shfmt 本体は別途必要（README は導入を推奨と記載）。
- detachhead.basedpyright [package.json 先頭 2 万字のみ原文確認]: `python.pythonPath`（既定 "python"）、`python.venvPath`。`python.defaultInterpreterPath` は設定一覧に無い（要約、要照合）。`basedpyright.importStrategy`（既定 fromEnvironment、他 useBundled）（要約）。拡張だけで言語サーバーが動くか、Python 本体が要るか、pyright の同梱は未確認。
- ms-vscode.powershell: `powershell.powerShellDefaultVersion`（セッションメニュー表示名と一致させる）、`powershell.powerShellAdditionalExePaths`（名前→実行ファイルの絶対パス）。`powershell.powerShellExePath` は非推奨。Windows PowerShell は "only version 5.1 is supported and only on a best-effort basis"（README、要約）。ウォークスルーに "To switch between PowerShell 7 and Windows PowerShell 5.1, use the menu"（原文確認）。extensionDependencies に vscode.powershell。
- tomoki1207.pdf: 3 年以上更新なし。LICENSE.txt はサードパーティ（PDF.js）の注記から始まり、公式リポジトリの LICENSE は MIT, Copyright tomoki1207（要約）。拡張本体のライセンスは確定できなかった。
  - 追記: 2026-11-12 の再取得で、LICENSE（GitHub と VSIX 内の LICENSE.txt の双方）が MIT License、著作権者 tomoki1207 と原文で確認できた。上の「確定できなかった」は、初回の取得が要約止まりだったことを指す。
- MS-CEINTL.vscode-language-pack-ja: engines が ^1.131.0 と最新版の VS Code に固定（localizedLanguages ["日本語"]）。

---

## 7. タスクスケジューラ（問い8）[一次・原文で要照合]

- https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset : "-StartWhenAvailable: Indicates that Task Scheduler can start the task at any time after its scheduled time has passed."
- スキーマ https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-startwhenavailable-settingstype-element : 既定 false。"This property applies only to timed tasks." 例 `<StartWhenAvailable>true</StartWhenAvailable>`。
- COM https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable : "This property applies only to time-based tasks with an end boundary or time-based tasks that are set to repeat infinitely." 遅れて起動するタスクはキューに入り、既定 10 分遅れて開始。スキーマ側より条件が狭く読めるが、範囲の差は確定できない（要照合）。
- 公式に「次の機会」という言い回しは無い。公式の語は「予定時刻を過ぎた後のいつでも」。

---

## 8. 未確認・見つからなかったものの一覧
- VSIX のファイル一覧（実行ファイル・ネイティブバイナリ、フォルダ、個別サイズ）
- sigzip の中身・仕様、署名の実検証、VSIX と sha256 の照合
- Open VSX の sigzip / 公開鍵の仕様を述べる公式文書
- DPAPI が「現在のユーザーに結びつく」との公式記述
- 追加モジュール無しで Credential Manager の値を読む公式手順
- last_edited_time の分単位丸めの有無（公式に記述なし）
- Notion の append・block リファレンスの原文照合、最新の Notion-Version 値
- basedpyright の同梱状況と Python 本体の要否、bash-language-server の VSIX 同梱
- dotenv.dotenv-vscode の診断機能（tomoki1207.pdf 本体のライセンスは、6 節の追記のとおり確認済み）
- shfmt / Node.js / Python 版別の winget ID の公式文書での裏付け、PowerShell の winget-pkgs 版の食い違い
- GitHub releases のチェックサム、npm 署名鍵の所有者

## 付記
- 取得役の報告に claude-code 拡張の設定値 `bypassPermissions` などの語が含まれ、ハーネスが「指示に似た文」と警告したが、manifest の enum 値の引用であり、指示としては扱っていない。

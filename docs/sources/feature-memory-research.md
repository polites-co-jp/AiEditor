# 調査2: 残す機能とメモリ（Claude Code 特化 VSCode フォーク）

- 作成: 明石元二郎（情報部）、取得: 石光真清
- 取得日: 2026-11-12（以下の出典はすべてこの日に取得）
- 凡例: [一次] 公式文書・原典・リポジトリ・Open VSX API。[二次] 記事・issue 報告・検索要約。「推定」は出典のない推測。
- 注意: 石光の取得は WebFetch の要約を経由したものが多い。法的判断に使う引用は原文で再確認すること。

## 1. Claude Code VSCode 拡張（anthropic.claude-code）

### 使う機能・API
- 公式 docs（vs-code）[一次] https://code.claude.com/docs/en/vs-code.md
  - ネイティブのグラフィカルなチャットパネル。docs 本文に "webview" の語は無く、実装方式は未確認（推定: Webview）。
  - 統合ターミナル（`claude` を実行）。差分は「VS Code's native diff viewer」で開く。
  - エディタの選択範囲を Claude が自動で見る。診断は「the errors and warnings in VS Code's Problems panel」を返す（`mcp__ide__getDiagnostics`）。
  - 新しいエディタグループにタブを開くとそのグループをロックする。URI ハンドラ `vscode://anthropic.claude-code/open`。
- IDE MCP 連携 [一次・同 docs]
  - 拡張が有効な間、ローカル MCP サーバーを起動し CLI が自動接続する。
  - `127.0.0.1` のランダムポート（10000–65535、固定不可）、`ws://`（非暗号化）。
  - 起動ごとにランダムな認証トークンを `~/.claude/ide/<port>.lock` に書く。CLI はヘッダ `X-Claude-Code-Ide-Authorization` で提示。
  - 道具は `mcp__ide__getDiagnostics`（読取専用）と `mcp__ide__executeCode`（Quick Pick で Execute/Cancel を確認）。
- 見つからなかった: package.json の contributes や使用 API の網羅一覧（VSIX の中身は未読）。

### 最低バージョン
- 公式 docs [一次]: 「VS Code 1.94.0 or later」。
- Open VSX API [一次] https://open-vsx.org/api/Anthropic/claude-code: `engines (vscode): ^1.94.0`、version 2.1.322（2026-11-10 公開）。
- Marketplace ページ [一次、要約経由] https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code: Requirements 欄は「VS Code 1.98.0 or higher」。
- 食い違い: 掲載文 1.98.0、manifest 1.94.0。両方を並べる。VSIX の package.json は直接読んでいない。

### 配布先
- Microsoft Marketplace に掲載あり（install 数 30,016,991）。Open VSX に掲載あり（downloadCount 65,821,087、extensionKind ["workspace"]、dependencies []）。
- docs: 「Anthropic submits extensions for publication to the Visual Studio Marketplace and Open VSX Registry.」[一次]
- VSIX: Open VSX API がプラットフォーム別 VSIX の URL を返す（win32-x64 を含む）。例 `https://open-vsx.org/api/Anthropic/claude-code/linux-x64/2.1.322/file/Anthropic.claude-code-2.1.322@linux-x64.vsix`。公式 docs に VSIX の記述は見つからなかった。
- 安全性（要注意）
  - GitHub #5762 [一次] https://github.com/anthropics/claude-code/issues/5762: Open VSX が拡張を malicious と判定し、Open VSX 利用のフォークが拡張を自動削除した件（2025-08-14 起票、"Closed as not planned"、2026-01 に自動 close）。「The extension is not malware.」との返信あり。
  - 2026-10-30 に悪性の 2.1.313 が Open VSX に出たとする報道 [二次・検索スニペットのみ、本文未読] https://www.chaincatcher.com/en/article/2300333 、https://runtimewire.com/article/trojanized-claude-code-extension-open-vsx-ssh-backdoor 。
  - 配布経路の信頼性は設計上の論点（後述）。

### 互換エディタ
- 公式 docs（ide-integrations）[一次] https://code.claude.com/docs/en/ide-integrations.md:
  - Cursor 向けの直接インストールリンクあり。
  - 「Other VS Code forks: the extension also installs in forks like Devin Desktop or Kiro … or install from the Open VSX Registry.」
  - 「Editors that can't install the extension: install the CLI and run `claude` in the integrated terminal」。
- VSCodium・Windsurf は今回の現行 docs に記述が見つからなかった。旧版らしき記述（Cursor/Windsurf/VSCodium で動作）は検索スニペットのみで未検証 [二次]。
- VSCodium で拡張が検出されない不具合報告 #5698（解決済み表示）は検索スニペットのみ [二次]。

### 本家 Copilot・チャットパネルへの依存
- docs・検索に Copilot / vscode.chat / languageModel の記述は見つからなかった。
- docs: 「The extension bundles its own copy of the CLI (command-line interface) for the chat panel.」独自のチャットパネルを持つ。
- ただし「依存なしの証明」ではない。API の使用を確かめるには VSIX の解析が必要。

### その他の依存
- 任意: Python 拡張（`usePythonEnvironment`）、Jupyter 拡張 `ms-toolsai.jupyter`（無いと該当道具を拒否）、Claude in Chrome 拡張。いずれも必須ではない。
- CLI: 拡張は CLI を同梱し、バージョン番号が同梱 CLI のバージョン。`claude` を PATH には入れない。v2.1.318 以降は拡張を自動インストールしない。
- Workspace trust: 「The extension doesn't work in Restricted Mode」（Workspace Trust の機能が必要）。
- ネイティブバイナリ同梱の記述は docs に無い。OS・CPU 別の VSIX があることから、バイナリ入りと推定。

## 2. メモリ消費の内訳

### プロセス構成
- VS Code 公式ブログ（2022-11-28）[一次] https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox
  - main は1つ、renderer はウィンドウごと。
  - shared process は「a hidden Electron window with Node.js enabled」。ターミナルとファイル監視は shared process の子プロセスに移った。同記事は shared process が「uses more resources than necessary」と書く。
  - extension host は「runs all the installed extensions isolated from the renderer」、ウィンドウごとに1つ。
- Electron 公式 [一次] https://www.electronjs.org/docs/latest/tutorial/process-model: main 1つ、BrowserWindow ごとに renderer、UtilityProcess で子プロセス。
- ptyHost の起動形態、GPU プロセス、tsserver の位置づけの一次確認は見つからなかった（tsserver は拡張側のプロセスと報告されている: issue #194322）。
- プロセス別の典型メモリ量（公式値）: 見つからなかった。

### 数値（すべて個別事例・二次扱い）
- Windows 10、アイドル 265 MB（一時 580〜600 MB）、Sublime Text 3 は 135 MB [二次、2018、拡張状態不明] https://gist.github.com/KDCinfo/3242af2ce580611bc525fc91e73c6aa5
- VS Code 1.90 アイドル macOS 187 MB（検索抜粋のみ、取得ページ 404）[二次] https://dev.to/johalputt/vs-code-190-vs-webstorm-20242-memory-usage-benchmarks-2026-1oag
- Zed 社側の比較記事: VS Code 約 730〜3,549 MB（23 プロセス、フォルダを開いた状態）、Zed 約 142〜222 MB（第三者の再現ではない、検索抜粋のみ）[二次] https://tech-insider.org/zed-vs-vscode-2026/
- 拡張を無効化した 4GB ノートで関連プロセス合計約 400 MB（出典不明の個人報告、検索抜粋のみ）[二次]
- issue #194322 [一次 issue、報告事例] https://github.com/microsoft/vscode/issues/194322: Activity Monitor で拡張系プロセスが 4 GB、Process Explorer の合計は 1 GB 未満。Process Explorer は ps の RSS を使い、OS 表示と一致しない。
- Electron の空アプリ下限: 一次の数値は見つからなかった。二次の検索抜粋に 200〜300 MB 程度（同一条件の比較ではない）。

### 機能別の削減効果
- `files.watcherExclude` の追加で 2 GB 超から 400 MB に下がったという報告（小さなテストプロジェクト、バージョン不明）[二次、SO 回答へのコメント] https://kaweah.freedombox.rocks/kiwix/stackoverflow.com_en_all_2023-11/questions/53658769/why-does-vs-code-require-so-much-memory-how-can-i-make-it-run-more-memory-effi
- VS Code 開発者の発言として「Disabling telemetry does absolutely nothing to reduce memory.」「search.exclude reduces no memory at all」[二次、dev.to コメント] https://dev.to/claudiodavi/reducing-vscode-memory-consumption-527k
- tsserver: 既定の上限 `typescript.tsserver.maxTsServerMemory` は 3072 [一次] https://raw.githubusercontent.com/microsoft/vscode/main/extensions/typescript-language-features/package.json 。大規模プロジェクトで上限に達し遅延した報告 #243448 [issue] https://github.com/microsoft/vscode/issues/243448
- 見つからなかった: git、markdown、emmet、検索、minimap、Settings Sync を個別に無効化した際の MB 実測。code-oss の最小化ビルド、Theia の実測値。

### 計測方法
- [一次] https://github.com/microsoft/vscode/wiki/Performance-Issues
  - Help > Open Process Explorer（wiki の記述。表記の公式 docs 確認は未了）。
  - Developer: Show Running Extensions、Help: Start Extension Bisect、拡張ホストのプロファイル。
  - `code --status`、`code --prof-startup`（起動の遅さ向け）。
- 拡張を外した比較は `code --disable-extensions` と Task Manager（二次）。
- 公式 FAQ: 「if you don't enable AI functionality in VS Code, no associated background processes will run that could affect performance.」[一次] https://code.visualstudio.com/docs/supporting/faq

## 3. 残す機能を担う部品

[一次] 出典の基本: https://github.com/microsoft/vscode/tree/main/extensions 、https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib 、https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code

前提: VS Code は Code-OSS（MIT）に Microsoft 固有のカスタマイズを加えた製品（Differences wiki）。非OSS は主にブランド、Marketplace URL、Remote Development の接続処理、C#/.NET デバッガ、テレメトリキー、更新サービス。

| 機能 | 所在（ソース上） | フォークで |
|---|---|---|
| git | `extensions/git`、`extensions/git-base`（組み込み拡張。無効化可・アンインストール不可と README） | OSS 内。推定: 使える |
| 差分ビュー | `src/vs/editor/browser/widget/diffEditor`（本体）、`extensions/diff`、`contrib/multiDiffEditor` | 推定: 使える |
| 全文検索・置換 | `src/vs/workbench/services/search/node`（ripgrep 系）、依存 `@vscode/ripgrep-universal` | 推定: 使える |
| ターミナル | `src/vs/platform/terminal/node`（ptyHost 等）、`contrib/terminal`、依存 node-pty・@xterm/xterm | 推定: 使える |
| エクスプローラー | `contrib/files` | 推定: 使える |
| Markdown プレビュー | `extensions/markdown-language-features`、数式 `extensions/markdown-math` | OSS 内 |
| 画像プレビュー | `contrib/mediaPreview`（`extensions/media-preview` は 404） | 推定: 使える |
| PDF プレビュー | 本体・extensions/ のいずれにも無い | 拡張で補う |
| 問題パネル | `contrib/markers`（Problems と明記する文は未確認） | 推定: 使える |
| タスク実行 | `contrib/tasks` | 推定: 使える |
| 設定の同期 | `contrib/userDataSync` | 下記 |

- PDF 拡張の候補: `tomoki1207.pdf` が Open VSX に掲載（version 1.2.2、最終更新 2022-12-23、MIT、PDF.js 同梱）[一次] https://open-vsx.org/api/tomoki1207/pdf 、https://github.com/tomoki1207/vscode-pdfviewer/blob/master/LICENSE 。`adamraichu.pdf-viewer` は検索結果のみ（Open VSX 在否未確認）。PDF.js のライセンスは未確認（推定: Apache-2.0）。
  - 訂正: tasks/2026-11-12-claude-vscode-design/sources/research-extensions-services.md の 6 節で、Open VSX の API には license 項目が無いと判明（2026-11-12）。上の MIT は GitHub の LICENSE（"Copyright (c) tomoki1207 / MIT License"、冒頭に PDF.js 等の第三者表記を含む）による。同じ本文が VSIX 内の LICENSE.txt にもあることを 2026-11-12 に再取得で確認した。
- 設定の同期 [一次] https://code.visualstudio.com/docs/configure/settings-sync
  - 対応は Microsoft アカウントと GitHub アカウントのみ。「Custom backends are not supported.」
  - docs に Code-OSS・VSCodium の言及は無い。product.json に同期ストアを足すフォークの事例が検索結果にある（GitLab web IDE フォーク、スニペットのみ）[二次] https://gitlab.com/gitlab-org/gitlab-web-ide-vscode-fork/-/merge_requests/68
  - 認証を担うのは `extensions/github-authentication`、`microsoft-authentication`。product.json の `settingsSyncStoreUrl` は要約で見つからず、原文再確認が必要。
  - フォークで動くことを示す公式記述は見つからなかった。

### 削る候補の所在
- `extensions/` 一覧（抜粋）: copilot、github、github-authentication、microsoft-authentication、ipynb、notebook-renderers、debug-auto-launch、debug-server-ready、tunnel-forwarding、simple-browser、terminal-suggest、dotenv、powershell、shellscript、bat、python、typescript-language-features、html/css/json-language-features、emmet、npm、grunt、gulp、jake、search-result、merge-conflict、references-view、mermaid-markdown-features、各種言語の文法とテーマ多数。
- デバッガ: 本体 `contrib/debug`。`product.json` の builtInExtensions に `ms-vscode.js-debug` など（ビルド時に取り込まれる外部拡張。Marketplace 由来と推定）。C#/C++ デバッガは公式 VS Code ビルド限定 [二次] https://github.com/VSCodium/vscodium/blob/master/docs/extensions.md
  - 訂正: tasks/2026-11-12-claude-vscode-design/sources/research-vscode-source.md の 3 節で、1.146.0 では product.json に extensionsGallery が無く、builtInExtensions は GitHub release から取得されると判明（2026-11-12）。Marketplace 由来との推定は、1.146.0 の OSS 版には当たらない。
- リモート: 本体 `contrib/remote` は存在。接続処理の一部は非OSS [一次、Differences wiki]。Remote Development 拡張は公式ビルド限定（VSCodium docs [二次]）。
- Jupyter: 本体 `contrib/notebook`、`extensions/ipynb`（.ipynb の開閉・保存のみ）。
- 内蔵 chat: 本体 `contrib/chat`、`inlineChat`、`mcp`。`extensions/copilot` は license が MIT ではなく「SEE LICENSE IN LICENSE.txt」、「releases in lockstep with VS Code due to its deep UI integration」[一次] https://github.com/microsoft/vscode/blob/main/extensions/copilot/package.json
- 具体的な「ビルドから外す手順」は見つからなかった（推定: ビルド時に extensions/ のどれを含めるかで決まる）。

### Marketplace とフォーク
- Marketplace ToU（2025-09 版、PDF 原本）[一次] https://cdn.vsassets.io/v/M264_20251020.18/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf
  - 2.b「Marketplace Offerings are intended for use only with In-Scope Products and Services」。In-Scope は Visual Studio、Visual Studio Code、GitHub Codespaces、Azure DevOps、Azure DevOps Server。
  - 3「You may not import, install, or use Offerings published by Microsoft or GitHub, or Microsoft affiliates in any products or services except for the In-Scope Products and Services.」
  - フォークがこの定義に入るか、VSIX の持ち出しを直接禁じるかは、文書から断定できない。
- VS Code FAQ [一次、要約経由] https://code.visualstudio.com/docs/supporting/faq: 「We provide the Visual Studio Marketplace for use only by the Visual Studio family of products」。
- VSCodium 側の説明 [二次] https://github.com/VSCodium/vscodium/blob/master/docs/extensions.md: Open VSX が既定のギャラリー。
- Open VSX の方針: 拡張は各ライセンスに従う [一次] https://www.eclipse.org/legal/open-vsx-registry-faq/

## 4. 対象言語の言語機能

共通: VSIX 手動導入では自動更新が既定で無効 [一次] https://code.visualstudio.com/docs/editor/extension-marketplace

| 言語 | 候補 | ライセンス | Open VSX | メモリ |
|---|---|---|---|---|
| TS/JS | 組み込み `typescript-language-features`（tsserver） | MIT | 不要（組み込み） | 実測見つからず。既定上限 3072 MB |
| Python | Pylance | Microsoft 製品専用 | なし（API 404、検索に無し） | 4GB 超が必要な構成あり（公式 TROUBLESHOOTING） |
| Python | basedpyright `detachhead.basedpyright` 1.40.2 | MIT | あり | 見つからなかった |
| Python | Pyright `ms-pyright.pyright` 1.1.402 | MIT | あり | 見つからなかった |
| Python | ruff `charliermarsh.ruff` | MIT | あり | 見つからなかった。リンター/フォーマッタで型検査は担わないと推定 |
| Python | python-lsp-server | MIT | pylsp 拡張は2件（ライセンス未確認） | 見つからなかった |
| HTML/CSS/JSON | 組み込み html/css/json-language-features | MIT | 不要 | 見つからなかった |
| CSV | Rainbow CSV `mechatroner.rainbow-csv` 3.24.1 | MIT | あり | 見つからなかった。補完・エラー表示は未確認 |
| .env | dotenvx.dotenv-vscode 1.5.8、mikestead.dotenv 1.0.1 ほか | MIT | あり | 見つからなかった。補完・検証の有無は説明文からの推定のみ |
| sh | bash-ide-vscode 1.43.2 | MIT | あり | 見つからなかった |
| sh | ShellCheck 拡張 timonwong.shellcheck 0.48.4 | 拡張 MIT、同梱バイナリ GPLv3 | あり | 見つからなかった |
| cmd | 組み込み `bat`（色付け・スニペットのみ。補完の宣言なし） | MIT | 不要 | - |
| cmd | 補完・エラー表示を持つ拡張 | - | 見つからなかった（Blinter は GitHub 上の Windows 用リンターとして検索に出るのみ） | - |
| PowerShell | `ms-vscode.PowerShell` 2025.4.0 | MIT（拡張・PSES とも） | あり（ms-vscode 名前空間。verified 表示は未確認） | メモリリーク報告 #5026（2024、完了済み）。常用量は見つからなかった |

- 訂正（.env）: tasks/2026-11-12-claude-vscode-design/sources/research-extensions-services.md の 6 節「訂正」で、`dotenvx.dotenv-vscode` は Open VSX で 404 であり、実在する ID は `dotenv.dotenv-vscode`（表示名 Dotenv Official、リポジトリ dotenvx/dotenv-vscode、1.5.8、MIT）と判明（2026-11-12。同日の再取得でも、dotenvx/dotenv-vscode は 404、dotenv/dotenv-vscode は 200）。上の表と出典欄の ID は dotenvx のまま残してある。
- 訂正（PowerShell）: 同 6 節で、Open VSX では小文字の `ms-vscode.powershell` で登録されていると判明（API の URL は大文字小文字を区別せず 200。2026-11-12）。Open VSX の license 欄は "SEE LICENSE IN LICENSE.txt" だが、同日の再取得で GitHub の LICENSE.txt と VSIX 内の LICENSE.txt の冒頭はいずれも MIT License だった。上の「MIT」は LICENSE.txt の本文による（PSES 側のライセンスは今回確認していない）。

出典（一次）
- Pylance FAQ https://github.com/microsoft/pylance-release/blob/main/FAQ.md: 「Pylance is licensed for use in Microsoft products and services only, so can only be used on official Microsoft builds of Visual Studio Code and GitHub Codespaces.」「Ensure you're running an official build of VS Code (not VS Codium or other variants).」「a substantial portion of Pylance's source code is open source via the Pyright type checker.」
- Pylance メモリ https://raw.githubusercontent.com/microsoft/pylance-release/main/TROUBLESHOOTING.md
- Open VSX API: https://open-vsx.org/api/detachhead/basedpyright 、/ms-pyright/pyright 、/charliermarsh/ruff 、/mechatroner/rainbow-csv 、/dotenvx/dotenv-vscode （404。上の訂正のとおり実在は /dotenv/dotenv-vscode）、/mikestead/dotenv 、/mads-hartmann/bash-ide-vscode 、/timonwong/shellcheck 、/ms-vscode/PowerShell （いずれも `https://open-vsx.org/api/<namespace>/<name>`）
- bash-language-server README https://raw.githubusercontent.com/bash-lsp/bash-language-server/main/README.md: shellcheck・shfmt は別途インストールを推奨（同梱とは書かれていない）。
- ShellCheck 拡張 README https://raw.githubusercontent.com/vscode-shellcheck/vscode-shellcheck/master/README.md: 「The bundled ShellCheck binaries are licensed under GPLv3」、Windows 向けバイナリ同梱。
- PowerShell: https://raw.githubusercontent.com/PowerShell/vscode-powershell/main/README.md 「PowerShell 7+ currently supported」「For Windows PowerShell, only version 5.1 is supported and only on a best-effort basis.」。メモリ報告 https://github.com/PowerShell/vscode-powershell/issues/5026 [二次]
- bat: https://raw.githubusercontent.com/microsoft/vscode/main/extensions/bat/package.json
- 見つからなかった: 通常時の実測メモリ（TS・Pylance・PowerShell・basedpyright など）、CSV・.env 拡張の補完/検証機能の一次確認、GPL バイナリ同梱時の配布上の扱い。

## 5. 日本語化とキー割り当て

### 日本語言語パック
- ライセンス: MIT。Marketplace 欄「The source code and strings are licensed under the MIT license.」[一次] https://marketplace.visualstudio.com/items?itemName=MS-CEINTL.vscode-language-pack-ja 。リポジトリ LICENSE.md も MIT（Copyright Microsoft）[一次] https://github.com/microsoft/vscode-loc/blob/main/LICENSE.md
- Open VSX: 掲載あり。version 1.131.0、verified true [一次] https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-ja
- 同梱・再配布: MIT 文言上は許諾あり。一方 Marketplace ToU は「Microsoft 発行の提供物は In-Scope 製品以外で使えない」と書く（3 節の引用）。Open VSX 掲載物を Open VSX 経由で取るなら ToU の対象外という見方もあるが、これは推定で未確定（石光も法務判断が要ると注記）。
- 翻訳の運用: 翻訳は Microsoft Localization Platform で管理され、PR は受け付けない。変更は Microsoft がエクスポートする [一次] https://raw.githubusercontent.com/microsoft/vscode-loc/main/README.md
- Code-OSS で日本語化する仕組み [一次]
  - 表示言語は Language Pack 拡張で切り替える https://code.visualstudio.com/docs/configure/locales （本文は直接取得できず README 経由）。
  - ビルド側 https://raw.githubusercontent.com/microsoft/vscode/main/build/lib/i18n.ts は、vscode-loc を vscode の隣に置くと翻訳を取り込み、nls.messages.<lang>.js を生成する（ログ文言: "To bundle translations please check out the vscode-loc repository as a sibling of the vscode repository."）。
  - 本体側 https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/nls.ts
  - 推定: 隣に置くビルドで日本語を既定に組み込める。実手順は未確認。
- 見つからなかった: VSCodium 公式の日本語化手順。

### Sublime Text キーマップ
- `ms-vscode.sublime-keybindings`: Open VSX に掲載（version 4.1.10、verified true）[一次] https://open-vsx.org/api/ms-vscode/sublime-keybindings 。ライセンスは MIT [一次] https://github.com/microsoft/vscode-sublime-keybindings/blob/main/LICENSE.md
- 中身は package.json の `contributes.keybindings`（各エントリに key / mac / linux / win / command）。README 記載。
- 他の拡張（[二次] 検索要約。LICENSE 本文は未確認、Open VSX 在否も未確認）: edmundstone/vscode-sublime-keybindings、Zarel/vscode-sublime-commands（コマンド追加）。jennynz/vscode-keybindings-for-sublime は逆方向（VS Code→Sublime）で対象外。

### 拡張なしで既定に組み込む方法
- `KeybindingsRegistry`: 「Stores all built-in and extension-provided keybindings」。`registerKeybindingRule` で primary/secondary と win/linux/mac を指定 [一次] https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/platform/keybinding/common/keybindingsRegistry.ts
- 各機能の既定キーの定義ファイル（`src/vs/workbench/` 配下）の具体例は未確認。
- 組み込み拡張の `contributes.keybindings` で同梱する方法あり。実例 `extensions/git/package.json`（3件）[一次] https://raw.githubusercontent.com/microsoft/vscode/main/extensions/git/package.json 、仕様 https://code.visualstudio.com/api/references/contribution-points
- ユーザーの keybindings.json は既定ルールの末尾に追加される（「appended at runtime to the bottom of the default rules」）、既定の無効化は `"command": ""` [一次] https://code.visualstudio.com/docs/configure/keybindings
- プロファイルは `.code-profile`。ショートカットを含めるかは選べる [一次] https://code.visualstudio.com/docs/configure/profiles 。「keybindings.json を既定として同梱する」専用の公式手順は見つからなかった。
- 推定: 既定に組み込む手段は、(a) 組み込み拡張として Sublime キーマップを同梱、(b) ビルド時に既定キーの表を書き換える、の2系統。

### ショートカット編集 UI
- 本体にある。`src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts`、エディタ ID `workbench.editor.keybindings` [一次] https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts
- Keymap 拡張の入口 Migrate Keyboard Shortcuts from... は docs に記載（Sublime などの具体名は無い）。

## 6. 設計上ユーザーに問うべき論点

事実に基づく論点の列挙。推奨は書かない。

1. 配布経路と拡張の信頼性: 固定構成にすると拡張は Open VSX 取得か VSIX 手動導入のいずれか。Claude Code 拡張には Open VSX 上の悪性版報道（2026-10-30、未検証）と、誤判定による自動削除の件（#5762）がある。取り込み時に検証する範囲（署名、ハッシュ、バージョン固定）をどうするか。
2. Marketplace 規約: Microsoft 製拡張（日本語パック、PowerShell）と、Anthropic 製の Claude Code 拡張を同梱する場合、Open VSX 経由の取得を前提にするか。規約解釈は未確定で、個人専用利用でも同じ扱いにするかは判断が要る。
3. Claude Code 拡張の動作確認: 最低 VS Code バージョン（1.94 か 1.98 か）、Workspace Trust 必須、本家 chat への依存の有無は VSIX 解析か実機検証でしか確定しない。削る前に確かめるか。
4. Python の言語機能: Pylance は不可。basedpyright か Pyright か（どちらも MIT、Open VSX あり）。型検査の強さとメモリ傾向が未計測。
5. cmd（バッチ）の補完・エラー表示: 見つかった拡張が無い。色付けのみに落とすか、自作するか。
6. PowerShell: 拡張は pwsh 7+ が前提（5.1 は best-effort）。拡張を同梱する場合、pwsh の用意をどうするか。メモリの常用量は未計測。
7. sh の ShellCheck: 同梱バイナリは GPLv3。bash-language-server は shellcheck を別途要する。同梱の可否と範囲。
8. 設定の同期: 公式は Microsoft/GitHub アカウント限定で、フォークで動く確証がない。認証拡張（github/microsoft-authentication）を残すか、別の方法（ファイル同期など）に置き換えるか。
9. PDF プレビュー: 組み込みが無いため拡張が必要。ただし「拡張の追加インストールを削る」裁定との整合から、同梱する拡張（`tomoki1207.pdf`、最終更新 2022 年）の保守をどうするか。
10. 本家 AI 機能の除去範囲: `contrib/chat`、`inlineChat`、`mcp`、`extensions/copilot` を除去しても Claude Code 拡張が動くかは未確認（論点3）。
11. 日本語化の実装: vscode-loc を隣に置くビルドで組み込むか、言語パック拡張として同梱するか。翻訳は Microsoft が管理しており更新追従が必要。
12. Sublime キーマップの実装: 組み込み拡張の同梱か、既定キー表の書き換えか。前者は拡張ホストを使う分、後者より重い可能性があるが、未計測（推定）。
13. メモリ目標の数値化: 計測の土台がない（一次の実測が無い）ため、まず手元の VS Code を Process Explorer で計測し、基準値を取る手順を調査の次工程に入れるか。
14. 追従通知（裁定済みの前提）で関係する点: 同梱拡張の更新（特に Claude Code 拡張は 2.1.x が頻繁に更新）を、本体と同様に通知対象に含めるか。

## 7. 調べきれなかった点

- 一次のメモリ実測（プロセス別・機能別・拡張別・Electron 空アプリ・最小ビルド）。
- Claude Code 拡張の VSIX 内部（contributes、使用 API、バイナリ同梱）、VSCodium・Windsurf での公式記述。
- Settings Sync の product.json 原文、Code-OSS で動く公式記述。
- 組み込み拡張・chat・debug・remote をビルドから外す具体手順。
- cmd の補完拡張、CSV と .env の補完・検証の一次確認、各言語サーバーの通常時メモリ。
- Marketplace ToU がフォークでの Open VSX 経由利用に及ぶかの法的判断。
- 検索スニペットのみで本文未読の項目: 悪性版報道、#5698、claudeissues の各報告、Zed 比較記事ほか（本文中に [二次・スニペットのみ] と明記）。

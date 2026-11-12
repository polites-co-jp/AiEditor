# Claude Code 用 VSCode フォーク — 調査1: フォークの土台

- 作成: 明石元二郎（取得: 石光真清）
- 取得日: 2026-11-12（以下、特記なき出典はすべてこの日に取得）
- 凡例: [一次] 公式文書・公式リポジトリ・公式 API、[二次] 記事・ブログ・検索スニペット・ミラー、「推定」は出典で確認できていない推測。
- 注意: 引用の多くは WebFetch の要約モデルを経由しており、原文と語句が完全には一致しない可能性がある。設計に使う前に原文で照合すること。検索スニペットだけで確認したものは「スニペットのみ」と書いた。

---

## 1. ソースとライセンス

### 1.1 Code - OSS と配布版 VSCode の違い
- [一次] 配布版は Code - OSS に Microsoft 独自のカスタマイズを加え、従来型の Microsoft 製品ライセンスで出している。
  - "Visual Studio Code is a distribution of the Code - OSS repository with Microsoft specific customizations released under a traditional Microsoft product license."
  - "The source code in this repository is available to everyone under a standard MIT license"
  - "Most customizations are done through the customization of `product.json`"
  - https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code
  - https://code.visualstudio.com/docs/supporting/faq
- [一次] MIT の著作権表示は "Copyright (c) 2015 - present Microsoft Corporation"。複製に表示と許諾文を含める条件がある。 https://github.com/microsoft/vscode/blob/main/LICENSE.txt
- [一次] 商標・ブランド: "Trademarked assets that define the brand (e.g. logos and product names)" は区別される資産。"Microsoft trademarks, which provide brand recognition for customers and helps to avoid confusion for downstream implementations." 上記 Differences wiki。
- [一次] product.json の役割（wiki の記述）: Marketplace の URL、telemetry の鍵（"are stored in `product.json` and are private so that other distributions cannot send us telemetry"）、更新サービスの URL（"`product.json` contains the URL of the update service."）。キー名（extensionsGallery 等）の定義そのものは本文で確認できていない（キー名は推定）。

### 1.2 Microsoft 製品専用のもの
- [一次] Marketplace: "We provide the Visual Studio Marketplace for use only by the Visual Studio family of products"（FAQ）。wiki: "The Marketplace is not a general purpose store designed to support any distribution or a subset of distributions."
- [二次・規約ミラー] 対象製品は Visual Studio、Visual Studio Code、GitHub Codespaces、Azure DevOps、Azure DevOps Server とその後継。規約正文（aka.ms/vsmarketplace-ToU、PDF）は読めず未確認。推定: Code - OSS のフォークは対象外。
  - 訂正: tasks/2026-11-12-claude-vscode-research-features/feature-memory-research.md の 3 節「Marketplace とフォーク」で、PDF 原本（https://cdn.vsassets.io/v/M264_20251020.18/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf、2025-09 版）から 2.b・3 の条文が引けると判明（2026-11-12 に再取得して原文を確認。2.b "Marketplace Offerings are intended for use only with In-Scope Products and Services and you may not install, reverse-engineer, import or use Marketplace Offerings in products and services except for the In-Scope Products and Services."、3 "You may not import, install, or use Offerings published by Microsoft or GitHub, or Microsoft affiliates in any products or services except for the In-Scope Products and Services."）。上の「読めず未確認」は WebFetch で PDF が読めなかったことを指す。フォークが In-Scope に入るかは、条文から断定できない（推定のまま）。
- [一次] Pylance: "Pylance is licensed for use in Microsoft products and services only" / "can only be used on official Microsoft builds of Visual Studio Code and GitHub Codespaces." / "Ensure you're running an official build of VS Code (not VS Codium or other variants)." https://github.com/microsoft/pylance-release/blob/main/FAQ.md
- [一次] C#/.NET デバッガーと VS Code Server は Visual Studio ファミリー限定ライセンス（"Certain Microsoft extensions (e.g. C#/.NET debugger) and the Visual Studio Code Server are distributed under a license that restricts their use to the Visual Studio family of products"）。Differences wiki。
- [二次・スニペットのみ] C# Dev Kit は Visual Studio Code・vscode.dev・Codespaces 等に限る。公式ライセンスページは 404 で未確認。
- 見つからなかった: Remote-SSH / WSL / Containers / Live Share / Copilot の公式ライセンス条項（Live Share が VSCodium に無いという GitHub Discussion の報告のみ［二次］）。推定: Remote 系も同様の制限だが未確認。

### 1.3 個人利用のフォークで守るべき点
- [一次] MIT 表示の保持（上記 LICENSE）。
- [一次] Microsoft の商標・ロゴ・製品名は MIT の対象外（上記）。ブランド差し替えは VSCodium が `00-brand-remove-branding.patch` で行っている（2 節）。
- [一次] Marketplace は Microsoft 製品向け。個人利用にも及ぶかは規約正文未確認（1.2 節の訂正も参照）。VSCodium docs は "prohibits usages of the Microsoft marketplace by any other products" と記す（二次扱いの要約経由）。 https://github.com/VSCodium/vscodium/blob/master/docs/extensions.md
- [一次] Claude Code 拡張側の条件（1.4 参照）: バイナリ非改変、名称・ロゴを自分の製品名に使わない。

### 1.4 Claude Code 拡張（anthropic.claude-code）
- ライセンス [一次・Open VSX API 要約]: "© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements ..." https://open-vsx.org/api/Anthropic/claude-code
- 利用条件 [一次]: "The Claude Code binary must not be modified. Claude Code must be installed and run as published by Anthropic"。名称・ロゴを自社製品名等に使えない。 https://code.claude.com/docs/en/legal-and-compliance
- 配布 [一次]: "Anthropic submits extensions for publication to the Visual Studio Marketplace and Open VSX Registry." フォークでは Open VSX からの導入を案内。 https://code.claude.com/docs/en/vs-code 。Open VSX 上の版 2.1.322、engines.vscode ^1.94.0。
- 依存 [一次]: Anthropic docs に Copilot / vscode.lm / chat API 依存の記述は見当たらない。"The extension bundles its own copy of the CLI" / ローカル MCP サーバーを起動。推定: 本体の Copilot・チャット部分への依存は無い（拡張のバンドルは未確認）。**user-decisions の「Claude Code が依存する AI 部分の特定」は、この調査では確定できていない。**
- [二次・未確認] 2.1.313 の悪性版が Open VSX に出たという報道（10/30）。https://runtimewire.com/article/trojanized-claude-code-extension-open-vsx-ssh-backdoor 。同梱固定構成にする場合の取り込み元の信頼性に関わる。

---

## 2. 既存フォーク・派生の事例

| 名称 | 方式 | 要点（出典） |
|---|---|---|
| VSCodium | ビルドスクリプト＋パッチ（フォークではない） | 下記 2.1 |
| Void | フォーク（microsoft/vscode の fork） | README: "Void is a fork of the vscode repository." / "Void is deprecated and no longer accepting contributions." https://github.com/voideditor/void [一次]。VSCodium のパッチを流用し、void-builder が rebase で追従（Gahrcoder/void-builder の README、スニペットのみ［二次］）。 |
| Positron | フォークブランチ＋マーカー | CLAUDE.md: "Positron forks VSCode. Minimize merge conflicts by isolating Positron code." / "Prefer new files over modifying upstream files" / 上流ファイル変更は `// --- Start Positron ---` ～ `// --- End Positron ---` で囲む。 https://raw.githubusercontent.com/posit-dev/positron/main/CLAUDE.md [一次・要約]。上流マージ手順の skill（"conflicts ... can usually be resolved by taking the upstream side"）は https://tessl.io/registry/skills/github/posit-dev/positron/merge-upstream-vscode [二次・スニペットのみ]。 |
| code-server | submodule＋パッチ（quilt） | MAINTAINING.md: "We keep code-server up to date with VS Code releases" / "we match VS Code's minor and patch version." https://raw.githubusercontent.com/coder/code-server/main/docs/MAINTAINING.md [一次・要約]。quilt・submodule 方式は古いコミットの CONTRIBUTING のスニペットのみ（現行版未確認）。 |
| Eclipse Theia | VSCode のフォークではなく別実装 | FAQ: "Theia is NOT a fork of VS Code, but a separate, independently developed platform" https://theia-ide.org/docs/faq/ [一次]。 |
| Cursor | フォーク | [二次・スニペットのみ] 2023-04 に CodeMirror ベースから VSCodium のフォークへ移行（https://cursor.com/changelog/0-2-0）。追従方式は見つからなかった。 |
| Windsurf | フォーク | [二次・スニペットのみ] "built on VS Code's open-source core ... but Codeium has modified the internals"。追従方式は見つからなかった。 |

### 2.1 VSCodium のビルドの仕組み
すべて [一次・要約]、取得 2026-11-12。
- 位置づけ: "This is not a fork. This is a repository of scripts to automatically build" / "The build scripts in this repo clone Microsoft's vscode repo, run the build commands," https://github.com/VSCodium/vscodium
- パッチ: `patches/` に `.patch` と `.json`。OS 別サブディレクトリ（alpine/reh, helper, insider, linux, osx, user, windows）。無効化は拡張子 `.no` / `.yet`。一部のファイル名: `00-telemetry-disable.patch`, `00-settings-gallery.patch`, `00-settings-user-product.patch`, `00-brand-remove-branding.patch`, `00-update-rename-cache-path.patch`, `00-copilot-disable-terminal-suggest.patch`, `52-ext-copilot-remove-it.json`, `53-ext-copilot-remove-it.patch`, `00-cloud-remove.patch`, `00-remote-*.patch`, `00-security-add-command-filter.patch`, `80-ui-disable-onboarding.json` ほか。各パッチの中身は未確認（名前からの読みは推定）。 https://github.com/VSCodium/vscodium/tree/master/patches
- ビルドの流れ（ci-build-linux.yml）: `./get_pr.sh` → `./get_repo.sh` → `./build.sh` → パッケージ工程。 https://github.com/VSCodium/vscodium/tree/master/.github/workflows
- product.json 差し替え・Open VSX: "By default, the `product.json` file is set up to use open-vsx.org as extension gallery"（`serviceUrl`, `itemUrl`, `extensionUrlTemplate` が必須）。 https://raw.githubusercontent.com/VSCodium/vscodium/master/docs/extensions.md 。telemetry.md は差し替えを `prepare_vscode.sh` が行うと書くが、現行ワークフローでは `prepare_vscode.sh` が呼ばれておらず、記述が古い可能性がある（推定）。
- テレメトリ: "We disable all the following telemetry-related settings by default"（telemetryLevel など）。一方 "we do not pass the telemetry build flags"。 https://raw.githubusercontent.com/VSCodium/vscodium/master/docs/telemetry.md
- 上流の検知と自動ビルド: README "The builds are run every day, but exit early if there isn't a new release from Microsoft."。`check_tags.sh` が GitHub API の `releases/latest` の `tag_name` を `MS_TAG` と比べ、異なれば `SHOULD_BUILD=yes`。 https://raw.githubusercontent.com/VSCodium/vscodium/master/check_tags.sh 。毎日の cron を持つファイルは未特定。
- パッチが当たらないとき: `./dev/update_patches.sh`（`*.rej` を直して続行）、単体は `./dev/patch.sh <name>.patch`。 https://raw.githubusercontent.com/VSCodium/vscodium/master/docs/howto-build.md
- 実例: 2026-10-13、VSCodium が Copilot・Claude Agent・Codex の AI SDK をソースツリーから削除（"fix: remove ai sdks"）。方式（パッチかビルド除外か）は記事に記載なし。 https://www.linuxcompatible.org/story/vscodium-114006880-removes-copilot-claude-and-codex-ai-sdks/ [二次]
  - 訂正: tasks/2026-11-12-claude-vscode-design/sources/research-vscode-source.md の 8 節で、"fix: remove ai sdks (#3060)" のコミット日時は 2026-10-11T13:53:42Z（SHA 33b0b0e96bc70e2deb8a9a63f9c5f3f8ab363357）、変更は `patches/53-ext-copilot-remove-it.patch` の 1 ファイルで、方式はパッチ（JSON の削除指示とパッチの併用）と判明（2026-11-12）。上の 10-13 は記事の公開日で、記事の公開日時は "Published 2026-10-13 20:00"（2026-11-12 に再取得して確認）。
- 所要時間: 見つからなかった。
- 追従の遅れ [一次・API]: VSCodium 最新 1.143.17232（2026-10-28）。上流は 1.146.0（2026-11-11）。推定: VSCodium は上流の全リリースを追ってはいない。

---

## 3. Windows でのビルド

- 前提 [一次・wiki 本文] https://github.com/microsoft/vscode/wiki/How-to-Contribute
  - Git。パス・プロフィールパスに空白・非 ASCII を含めない。
  - Node.js: "x64 or ARM64, version >=22.x (also see .nvmrc ...)"。.nvmrc の現行値は 24.22.1 [一次・要約] https://github.com/microsoft/vscode/blob/main/.nvmrc 。
  - Python（node-gyp 用、setuptools 推奨）。
  - C/C++: "Visual Studio 2026 Build Tools"。winget の例: `winget install --id Microsoft.VisualStudio.BuildTools -e --source winget --override "--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre"`。"Do not pick the option to install Windows Build Tools"。WSL ビルドはこの手順の対象外。
- 手順: `npm install` → `npm run watch`（"Finished compilation" 表示まで）→ `.\scripts\code.bat`。失敗時は `git clean -xfd` して再 install。node-gyp キャッシュ `%USERPROFILE%\AppData\Local\node-gyp` の削除も案内。
- パッケージング: wiki は `npm run gulp vscode-[platform]` と `-min` を記載（"Run gulp via npm to avoid potential out of memory issues"）。wiki の一覧は win32-ia32 / win32-x64 で、古い可能性がある。
- インストーラー [一次・要約] https://github.com/microsoft/vscode/blob/main/build/gulpfile.vscode.win32.ts : タスク `vscode-win32-{x64,arm64}-{system,user}-setup`。出力は `<repo の一つ上>\VSCode-win32-<arch>` と `<repo>\.build\win32-<arch>\{user,system}-setup`。`build/win32/code.iss`（Inno Setup）が `InstallTarget` でユーザー用（`PrivilegesRequired=lowest`, HKCU）とシステム用（HKLM）に分岐する。`OutputBaseFilename=VSCodeSetup`、`Compression=lzma`。要約器は gulpfile の先頭約 10 万字（全長 18.5 万字）しか読んでいない。
- zip のローカル生成手順: 公式の範囲では見つからなかった（CI の codesign.ts が `VSCode-win32-<arch>.zip` を作る）。
- 所要時間・ディスク容量: 公式・検索とも見つからなかった。メモリについては、wiki が Codespace に "at least 4 Cores and 6 GB of RAM (8 GB recommended)" と書く（ネイティブ Windows の要件ではない）。[二次・非公式ミラー、本文取得不可] "8 GB ... 9 GB recommended"、`--max-old-space-size=8192`。
- VSCodium の Windows ビルド [一次・要約] https://github.com/VSCodium/vscodium/blob/master/docs/howto-build.md : "The build scripts are written in Bash, so on Windows you must run them inside Git Bash"。Git for Windows、Node（.nvmrc）、jq、7-Zip、Python 3.11、Rustup が必要。WiX v3 は msi 用（`-p`）。スクリプトの場所は版により `dev/` と `build/` で異なる。
- 署名なしの SmartScreen: VS Code 固有の記述は見つからなかった。[二次・一般論] 署名・評判が無いと "Windows protected your PC" が出て、「詳細情報」→「実行」で回避できる。

---

## 4. 機能の削り方

- 組み込み拡張: `extensions/` の各サブフォルダが 1 つの組み込み拡張（Theia 側の資料: "Every sub-folder of vscode/extensions/ is one built-in vscode extension"［二次・スニペット］）。Theia は同梱拡張を MIT のソースから個別に build/package する（https://github.com/eclipse-theia/vscode-builtin-extensions README）。`build/gulpfile.extensions.js` 等の中身は未確認。推定: 不要フォルダの削除とビルド側の拡張リスト修正が要る。
- contrib の削除: 一次資料は見つからなかった。`workbench.*.main.ts` の import を外した具体事例も未確認。[二次・スニペット] フォーク独自の変更との衝突解消が手作業になる（GitLab web IDE フォーク RFC、Positron の merge 手順、EclipseSource "Is Forking VS Code a Good Idea?"）。推定: contrib の削除も同様に上流マージで手作業の衝突になる。
- 設定での無効化:
  - `chat.disableAIFeatures`（既定 false）: "Disable and hide built-in AI features in VS Code, such as chat and inline suggestions, and disable the Copilot extensions." https://code.visualstudio.com/docs/agents/reference/ai-settings [一次]。限界を示す issue（#344479, #342291 等）が検索で出たが現状は未確認 [二次]。
  - `telemetry.telemetryLevel`: all / error / crash / off。拡張の独自テレメトリは対象外。 https://code.visualstudio.com/docs/getstarted/telemetry [一次]。
  - `extensions.autoUpdate`・`workbench.*` の効き目: 未調査。
- メモリ・起動時間の要因: 公式 Performance Issues wiki は CPU 高負荷の原因として拡張を挙げ、Process Explorer（Help > Open Process Explorer）、Developer: Show Running Extensions、Extension Bisect、`--disable-extensions` を案内する。メモリの本文段落は無い。 https://github.com/microsoft/vscode/wiki/Performance-Issues [一次]。拡張ホストが数 GB に膨らむ個別報告（Claude Code 拡張関連の issue 等）はある［二次・個別事例］。「効く順」の公式資料は見つからなかった。推定: 拡張ホスト（言語サーバーを含む）が最大。ripgrep・Monaco・Electron 各プロセスの寄与は未調査。**省メモリ目標の数値を決めるための実測は、この調査の範囲では得られていない。**
- 軽量化事例: VSCodium（AI SDK 削除、2 節）、OpenVSCode Server（"minimal distribution of the Code - OSS repository"、スニペットのみ）、better-vscode（個人。スニペットのみ・未検証）。"vscode-minimal" は見つからなかった。
- 同梱したい拡張（裁定）の入手性:
  - Sublime キーマップ `ms-vscode.sublime-keybindings`: Open VSX に存在（4.1.10、2024-01-22）。ライセンスは Open VSX が "SEE LICENSE IN LICENSE.md"、Marketplace は MIT 表記で不一致。LICENSE.md 本文は未確認。 https://open-vsx.org/api/ms-vscode/sublime-keybindings [一次・API]
  - 日本語パック `MS-CEINTL.vscode-language-pack-ja`: Open VSX に存在（1.131.0、2026-07-28）、"SEE MIT LICENSE IN LICENSE.md"。vscode-loc リポジトリは MIT。 https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-ja 、 https://github.com/microsoft/vscode-loc [一次]。同梱（再配布）に関する Microsoft の明示方針は未確認。推定: MIT なら著作権表示の保持で同梱可。

---

## 5. 上流の更新の検知

- リリース頻度: 2026-03 に月次から週次の安定版へ移行（1.111 が最初の週次）。"we'll ship a new Stable release every week." https://www.devclass.com/development/2026/03/12/microsoft-ships-vs-code-weekly-adds-autopilot-mode-so-ai-can-wreak-havoc-without-bothering-you/5208978 [二次]。公式 updates ページでは週次の記述を確認できなかった。旧月次では回復版（recovery release）が付いた（同記事）。
- 現在の最新 [一次・API]: 1.146.0（2026-11-11T10:07:14Z）。直前に 1.145.3（2026-11-10）、1.145.2/1.145.1（2026-11-06）、1.145.0（2026-11-04）。タグは `1.146.0` 形式。1.145.3 の公式ノートに "The update addresses these security issues." https://code.visualstudio.com/updates/v1_145
- セキュリティ告知の場所:
  - [一次] GitHub Security Advisories: https://github.com/microsoft/vscode/security/advisories 。2026-11-10 に 9 件以上が公開（例: GHSA-xfg5-fq3p-cx69 "Remote Code Execution via serve-web Release Downgrade" High、GHSA-g3fj-wc2g-v3j5 "Remote Code Execution via Network Workspace Trust Bypass" High）。
  - [一次] SECURITY.md は報告方法のみで、修正の告知方法は書かれていない。
  - [二次] CVE-2026-47285（修正 1.132.1）、CVE-2026-81379（OSV では修正 1.136.2）。MSRC の一次ページは未取得。推定: CVE は修正リリースの告知で言及される。
- 機械取得（すべて取得に成功、未認証）:
  - `https://api.github.com/repos/microsoft/vscode/releases/latest`（tag_name, published_at）
  - `https://github.com/microsoft/vscode/releases.atom`（tags.atom も取得可。ただし /tags には vsda-v... など本体以外のタグが混在するので releases を使う）
  - `https://api.github.com/repos/microsoft/vscode/security-advisories`（公開アドバイザリ一覧、200）
  - `https://update.code.visualstudio.com/api/releases/stable`（バージョン文字列の配列）、`.../api/update/linux-x64/stable/latest`（コミット・timestamp）
  - code.visualstudio.com/updates に RSS リンクは確認できなかった。
  - レート制限: 未認証は 60/時（/rate_limit の core 値）。
- Electron: github.com/electron/electron/security/advisories と releases.atom は取得可（2026-10 に多数）。推定: VSCode 側の更新に Electron 更新が含まれるが、1.146 の Electron 版は未確認。**フォークの Electron を自分で上げる必要があるかは未確認。**
  - 訂正: tasks/2026-11-12-claude-vscode-design/sources/research-vscode-source.md の 2 節で、1.146.0 の Electron は 43.8.6（ルート package.json の `nativeBuild.target`）と判明（2026-11-12）。Electron の版は VSCode のタグごとに package.json で固定されている。フォークが Electron を自分で上げる必要があるかは、なお未確認。

---

## 6. 設定の同期

- 本家 Settings Sync [一次] https://code.visualstudio.com/docs/configure/settings-sync : 専用サービスに保存し（"Settings Sync uses a dedicated service to store data and coordinate updates."）、"Settings Sync supports Microsoft and GitHub accounts."、"Custom backends are not supported."。Stable と Insiders はサービスが別。同期対象は settings、keybindings、snippets、tasks、MCP 設定、UI state、extensions、profiles、prompt files 等。Code - OSS / VSCodium への言及は無し。
  - 推定: Microsoft が運営する専用サービスと product.json の設定に依存するため、フォークでの利用可否は公式に確認できない（出典なし）。VSCodium が configurationSync を既定で有効にしているという確証も見つからなかった。
- VSCodium docs の目次に "Semi-Automatic Migration with "Sync Settings" Extension" の節がある（https://github.com/VSCodium/vscodium/blob/master/docs/index.md ）。本文は取得失敗。
- 代替 [二次・多くはスニペットのみ]:
  - zokugun/sync-settings（Open VSX。リポジトリ式。詳細ページ取得不可）
  - shanalikhan/code-settings-sync（GitHub Gist 保存、GitHub トークン要。README は取得済み。Open VSX 上の存在は検索結果のみ）
  - 自前案（settings.json 等をリポジトリで管理しスクリプトで配置）: これは出典なしの一般案で、推定。
- 注意 [二次・見出しのみ・未検証]: Open VSX の同期系拡張に関するサプライチェーン攻撃（"GlassWorm"）の見出しが検索に出た（本文は 403）。

---

## 設計上ユーザーに問うべき論点
1. 方式: VSCodium 型（上流を clone しパッチを当てるビルドスクリプト）か、Positron/Void 型（フォークブランチ）か。「通知のみ・取り込みは都度 Claude が検証」の裁定とどちらが合うか。
2. 削る手段の許容度: 設定での無効化（上流追従が楽）か、拡張・contrib の物理削除（効くが衝突が増える）か。
3. 省メモリ目標の数値を決めるため、先に現行 VSCode のメモリ実測（拡張ホスト・各プロセス別）を取るか。今回の調査では得られていない。
4. 拡張の取り込み元: Open VSX の固定版を同梱するか、Marketplace の VSIX を手動取得するか。Marketplace の規約はフォークに不利（推定を含む）。Claude Code 拡張の悪性版報道を踏まえた検証手順が要るか。
5. Pylance が使えない前提で、Python の補完・エラー表示を何で代替するか（言語機能の裁定との整合）。
6. 設定の同期: 本家 Settings Sync の可否が確認できないため、拡張（Gist・リポジトリ式）か自前スクリプトか。
7. ブランド: Microsoft・Claude の名称・ロゴを製品名に使わない命名・アイコンの方針。
8. インストーラーと署名: Inno Setup のインストーラーを作るか、zip 配布か。署名なし（SmartScreen 警告）を許容するか。
9. 更新（セキュリティ）の追従: フォークが使う Electron の更新も通知対象にするか。通知手段（未確認事項）は何か。
10. 未確認の裁定（テレメトリ・外部通信の削除）。VSCodium は設定の既定オフ＋一部ビルド時無効化。

## 調べきれなかった点
- Marketplace 利用規約の正文（PDF が読めず。訂正: 1.2 節の注記のとおり、PDF 原本は後に読めた）、Remote 系・Live Share・Copilot・C# Dev Kit の公式ライセンス条項。
- 公式のビルド所要時間・ディスク容量。ネイティブ Windows のメモリ要件。
- contrib 削除の具体事例、`build/lib/extensions` の拡張除外の仕組み、メモリの寄与度の順位。
- Cursor・Windsurf・Void の上流追従方式（一次資料なし）。Positron の追従の遅れ。code-server の現行の取り込み手順。
- VSCodium の `check_tags.sh` を呼ぶ毎日の cron、`prepare_vscode.sh` の現状、各パッチの中身。
- 本家 Settings Sync のフォークでの動作、VSCodium の configurationSync 既定値、同期拡張の版・更新日。
- MSRC の CVE 一次ページ、1.146 の Electron 版（訂正: 5 節の注記のとおり 43.8.6 と判明）。
- Claude Code 拡張が本体のどの API に依存するかの確定（バンドルの実物は未確認）。

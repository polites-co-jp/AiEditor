# 01 機能の要件

この文書は何を残し、何を足し、何を消すかを決める。消し方の詳細は [03-removal-design.md](03-removal-design.md)、同梱する拡張の扱いは [04-bundled-extensions.md](04-bundled-extensions.md) にある。

凡例（1節・2節・4節の「層」の列と、3節の「単位」の列）は次のとおり。
- 本体: 本家のソースにある機能をそのまま残す。
- 組込: 本家の組み込み拡張（`extensions/<名前>`）で実現する。
- 同梱: 台帳で固定した第三者の拡張で実現する。
- 自前: 自前の組み込み拡張（`mydist`・`notion-sync`）で実現する。
- 設定: 既定の設定（`mydist` の `configurationDefaults`）で決める。
- 削除 A/B/C-n: [03](03-removal-design.md) の削除の単位の番号。

「所在」の列のパスは `src/vs/workbench/` からの相対（`contrib/...`、`services/...`、`api/...`）か、リポジトリのルートからの相対（`src/vs/...`、`extensions/...`）。workbench の import 行と組み込み拡張の一覧は 1.146.0 で確かめた（`sources/research-vscode-source.md` の3節・5節）。それ以外の所在（`contrib/timeline`、`contrib/localHistory`、`contrib/scm`、`contrib/processExplorer` など）は本家のソースの構成からの見立て（推定）で、Phase 2 でタグのソースを見て確かめる。

## 1. 残す機能

| 機能 | 層 | 担う部品（本家 1.146.0 での所在） | 出典・備考 |
|---|---|---|---|
| 基本のテキスト編集、ミニマップ | 本体 | `src/vs/editor` | — |
| エディタの分割・複数ウィンドウ | 本体 | `src/vs/workbench/browser/parts/editor` ほか | — |
| コマンドパレット | 本体 | `src/vs/workbench/contrib/quickaccess` ほか | — |
| ショートカットの編集画面 | 本体 | `contrib/preferences/browser/keybindingsEditor.ts` | [一次] https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts |
| ファイルエクスプローラー | 本体 | `contrib/files` | 推定: 単独で動く |
| ターミナル | 本体 | `contrib/terminal`、`src/vs/platform/terminal/node`（ptyHost） | Claude Code の CLI もここで動く |
| 全文検索・置換 | 本体＋組込 | `services/search/node`（ripgrep）、`contrib/search`、`extensions/search-result` | 検索は notebook と結びついている恐れがある（[03](03-removal-design.md) の C-4） |
| 差分ビュー | 本体＋組込 | `editor/browser/widget/diffEditor`、`contrib/multiDiffEditor`、`extensions/merge-conflict` | Claude Code は差分を本家の差分ビューで開く [一次] https://code.claude.com/docs/en/vs-code |
| git 操作 | 組込 | `extensions/git`、`extensions/git-base`、`contrib/scm` | Git for Windows が要る（4節） |
| 問題パネル | 本体 | `contrib/markers` | Claude Code の `mcp__ide__getDiagnostics` は問題パネルの診断を返す [一次] https://code.claude.com/docs/en/vs-code |
| タスク実行 | 本体＋組込 | `contrib/tasks`、`extensions/npm`（npm のタスクの検出） | — |
| Markdown プレビュー | 組込 | `extensions/markdown-language-features`、`extensions/markdown-math` | — |
| 画像プレビュー | 本体 | `contrib/mediaPreview` | — |
| スニペット | 本体 | `contrib/snippets` | 同期の対象（[05](05-settings-sync.md)） |
| 自動整形 | 本体＋各言語 | `contrib/format` と各言語機能 | — |
| タイムライン・ローカル履歴 | 本体 | `contrib/timeline`、`contrib/localHistory` | — |
| テスト（テストの一覧と実行） | 本体 | `contrib/testing` | 裁定で残す。計測で重ければ改めて諮る。デバッグを消す C-2 の影響を受ける見込み（推定） |
| コメント | 本体 | `contrib/comments` | 裁定で残す。計測で重ければ改めて諮る |
| ワークスペースの信頼・制限モード | 本体 | `contrib/workspace`、`services/workspaces` | **必須**。Claude Code 拡張は制限モードで動かない（manifest の `capabilities.untrustedWorkspaces.supported: false`）[一次] https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json |
| 拡張の実行（拡張ホスト） | 本体 | `src/vs/workbench/api`、`services/extensions` | 同梱した拡張を動かすために必須 |
| 拡張のインストール（CLI のみ） | 本体 | `src/vs/platform/extensionManagement` | 台帳の VSIX を `--install-extension` で入れるために残す。画面からの検索・追加は消す（C-5） |
| 動作中の拡張の一覧・Process Explorer | 本体 | `contrib/extensions/electron-browser` の runtime extensions、`contrib/processExplorer` | 計測と不具合の調査に使う。C-5 で消さずに残す |
| 日本語の表示 | 同梱 | 言語パック `MS-CEINTL.vscode-language-pack-ja` | [04](04-bundled-extensions.md) |
| Sublime Text のキー割り当て | 自前 | `mydist` の `contributes.keybindings` | `ms-vscode.sublime-keybindings`（MIT）から一度だけ変換する（[04](04-bundled-extensions.md)） |
| 固定のテーマ（Light Modern） | 組込＋設定 | `extensions/theme-defaults`、`workbench.colorTheme` を既定で固定 | 他の色のテーマは消す（A-6）。ファイルのアイコン `extensions/theme-seti` は残す |
| Claude Code 拡張 | 同梱 | `anthropic.claude-code` | [04](04-bundled-extensions.md) |
| 設定の同期 | 自前 | `notion-sync` | [05](05-settings-sync.md) |
| PDF プレビュー | 同梱 | `tomoki1207.pdf` | 本体・組み込み拡張に無い [一次] https://open-vsx.org/api/tomoki1207/pdf |

## 2. 足す機能

| 機能 | 層 | 中身 | 文書 |
|---|---|---|---|
| 既定の設定・キー割り当て・テーマの固定 | 自前 | `mydist` | [04](04-bundled-extensions.md) の6節 |
| Notion との設定の同期 | 自前 | `notion-sync` | [05](05-settings-sync.md) |
| 同梱拡張の台帳と検証の道具 | ビルドリポジトリ | `extensions.lock.json`、`scripts/lock-*.mjs` | [04](04-bundled-extensions.md) |
| 更新の検知と ToDo の書き込み | ビルドリポジトリ | `tools/watch/` | [06](06-update-watch-and-take-in.md) |
| 取り込みと判定 | ビルドリポジトリ | `scripts/take-in.mjs`、`TAKE-IN.md` | [06](06-update-watch-and-take-in.md) |
| 版ごとのフォルダと切り替え | ビルドリポジトリ | `scripts/switch.ps1` | [02](02-repository-and-build.md) の6節 |
| メモリの計測と外向き通信の監査 | ビルドリポジトリ | `scripts/measure.ps1`、`scripts/netaudit.ps1` | [07](07-phases.md) の3節 |

## 3. 消す機能

消すものはすべて、最終的にコードごと消す。消す順と単位は [03](03-removal-design.md) の4節。「裁定」の列は、消す根拠がユーザーの裁定にあるか、構想（必要な機能だけを残す）からの候補かを示す。構想からの候補のうち、最初の裁定に挙がっていなかったもの（ターミナルの入力候補・テスト・コメント）は、設計資料の論点への裁定で扱いが決まった（[00](00-overview.md) の4.3）。今後、新たに消す候補が出たら、ユーザーの確認を経てから単位に入れる。

| 機能 | 単位 | 消す部品（1.146.0 での所在） | 裁定 |
|---|---|---|---|
| 本家の AI（Copilot・チャット・インラインチャット・MCP・エージェント・音声） | A-1、C-1 | `extensions/copilot`、`contrib/chat`、`contrib/inlineChat`、`contrib/mcp`、`contrib/agentsVoice`、`platform/agentHost`、`services/agentHost`、`services/chat`、`api/browser/mainThreadChat*`・`mainThreadLanguageModel*`・`mainThreadMcp.ts`、product.json の `defaultChatAgent` などのキー、AI の SDK の依存 | あり |
| テレメトリ | B-1 | `platform/telemetry` の送信部品（`1dsAppender.ts` 3本）を何もしない実装に差し替える。`contrib/telemetry`、`contrib/editTelemetry`、`contrib/bracketPairColorizer2Telemetry`、依存 `@microsoft/1ds-core-js`・`@microsoft/1ds-post-js` | あり |
| 実験・調査・歓迎画面・課題報告（不要な外部通信） | B-2、B-3 | `services/assignment`（実験）、`contrib/surveys`、`contrib/welcomeGettingStarted`、`contrib/welcomeWalkthrough`、`contrib/welcomeOnboarding`、`contrib/onboarding`、`contrib/issue`、`contrib/share` | あり（外部通信として）。歓迎画面は通信を伴うかを Phase 0 の棚卸しで確かめる |
| 拡張の追加インストール（ギャラリー・おすすめ・拡張のビュー） | 設定、C-5 | product.json に `extensionsGallery` を書かない（1.146.0 の OSS 版には元から無い）、`mydist` の既定で自動更新と更新の確認を切り、`extensions.allowed` に台帳の拡張だけを載せる、`contrib/extensions` の画面（動作中の拡張の一覧は残す）、`extensionGalleryService`、`extensionRecommendations`、`extensionTipsService` | あり |
| デバッガ | A-3、C-2 | product.json の `builtInExtensions`（js-debug 系3件）、`extensions/debug-auto-launch`、`extensions/debug-server-ready`、`contrib/debug`、拡張 API の `vscode.debug` の実装 | あり |
| リモート開発 | A-5、C-3 | `extensions/tunnel-forwarding`、`contrib/remote`、`contrib/remoteTunnel`、`services/tunnel`、`platform/remoteTunnel`、サーバー（reh）のビルドタスク | あり |
| Jupyter ノートブック | A-4、C-4 | `extensions/ipynb`、`extensions/notebook-renderers`、`contrib/notebook`、`contrib/replNotebook`、`contrib/interactive`、`services/notebook` | あり |
| 本家の Settings Sync とアカウント | A-2、C-6 | `extensions/github-authentication`、`extensions/microsoft-authentication`、`extensions/github`、`contrib/userDataSync`、`services/userDataSync` | あり（同期は Notion を使う） |
| アウトライン | B-4 | `contrib/outline`、`contrib/codeEditor/browser/outline` | あり |
| パンくずリスト | C-7 | `browser/parts/editor/breadcrumbs*` | あり。本体の共有部品に深く入っているので最後に回す |
| テーマの切り替え | A-6、B-5 | `extensions/theme-*`（`theme-defaults`・`theme-seti` を除く）、`contrib/themes` の選択のコマンド | あり |
| 使わない組み込み拡張 | A-7 | `grunt`・`gulp`・`jake`・`simple-browser`・`mermaid-markdown-features`・`extension-editing`、対象外の言語の言語機能（例: `php-language-features`） | 構想から。文法（色付け）だけの拡張は残す |
| ターミナルの入力候補 | A-7 | `extensions/terminal-suggest` | あり（設計資料の論点への裁定） |

テスト（`contrib/testing`）とコメント（`contrib/comments`）は裁定で残す（1節）。

## 4. 対象言語ごとの言語機能

裁定: 補完・エラー表示を持たせるのは下の表の言語。cmd とそれ以外の言語は色付けだけ（文法の組み込み拡張を残す）。外部ツールはエディタに同梱せず、別途入れる。外部ツールが無いときは、その機能（検査・整形など）が動かないだけで、色付けは残る。

| 言語 | 担う拡張 | 層 | 外部ツール | 備考と出典 |
|---|---|---|---|---|
| TypeScript / JavaScript | `typescript-language-features`（tsserver） | 組込 | 不要 | tsserver の既定のメモリ上限は 3072 MB [一次] https://raw.githubusercontent.com/microsoft/vscode/main/extensions/typescript-language-features/package.json |
| Python | `detachhead.basedpyright` 1.40.2（MIT、engines ^1.101.0） | 同梱 | Python 3（インタプリタ。拡張の設定 `python.pythonPath`、既定 `"python"`） | [一次] https://open-vsx.org/api/detachhead/basedpyright 。既定の `basedpyright.importStrategy: "fromEnvironment"` では Python 拡張の API を求めて起動しない。`useBundled`（`mydist` の既定。裁定 2026-11-13）なら Python 拡張なしで起動し、Python 本体が無くても型の検査は動く（入れたパッケージの型の解決には Python が要る）。画面の問題パネルに出るかは 0-3 で確かめる |
| HTML / CSS / JSON | `html-language-features`・`css-language-features`・`json-language-features`、`emmet` | 組込 | 不要 | `json-language-features` は Claude Code 拡張の `jsonValidation`（`.claude/settings.json` の検査）にも使われる |
| CSV | `mechatroner.rainbow-csv` 3.24.1（MIT） | 同梱 | 不要 | 列の色分け、CSV の検査（"Automatic CSV consistency checks (CSVLint)"）[一次・要照合] https://open-vsx.org/api/mechatroner/rainbow-csv |
| .env | `dotenv.dotenv-vscode` 1.5.8（MIT）か `weixu.wx-vsce-dotenv` 0.2.3（MIT）。文法は組み込みの `dotenv` | 同梱 | 不要 | 裁定: Phase 0 の 0-3 で両方を試し、エラー表示を持つほうを採る。`dotenv.dotenv-vscode` は補完あり、エラー表示（診断）は README に記述が無い（未確認）[一次] https://open-vsx.org/api/dotenv/dotenv-vscode 。`weixu.wx-vsce-dotenv` は README に診断7種と補完がある（要照合）[一次] https://open-vsx.org/api/weixu/wx-vsce-dotenv |
| sh | `mads-hartmann.bash-ide-vscode` 1.43.2（MIT） | 同梱 | ShellCheck（検査）、shfmt（整形） | 設定 `bashIde.shellcheckPath`（既定 `"shellcheck"`、空文字で検査なし）、`bashIde.shfmt.path`（既定 `"shfmt"`）[一次] https://open-vsx.org/api/mads-hartmann/bash-ide-vscode |
| PowerShell | `ms-vscode.powershell` 2025.4.0（engines ^1.101.0） | 同梱 | PowerShell 7 | Windows PowerShell 5.1 は "only on a best-effort basis" [一次・要照合] https://raw.githubusercontent.com/PowerShell/vscode-powershell/main/README.md 。`extensionDependencies` に組み込みの `vscode.powershell`（文法）があるので、組み込みの `powershell` は消さない |
| cmd | 組み込みの `bat`（色付け・スニペット） | 組込 | 不要 | 裁定で色付けだけ |
| その他 | 各言語の文法の組み込み拡張 | 組込 | 不要 | 色付けだけ。言語機能を持つ組み込み拡張（例: `php-language-features`）は A-7 で消す |

### 4.1 外部ツールの入れ方

エディタの利用者がエディタとは別に入れる。winget の ID は下の表のとおり。インストールの手順書（`docs/install.md`、Phase 4 で作る）に写す。

| ツール | 何に要るか | 入れ方 | 出典 |
|---|---|---|---|
| Git for Windows | git 操作（組み込みの git 拡張） | `winget install --id Git.Git -e --source winget` | [一次・要照合] https://git-scm.com/install/windows 。winget の版は Git for Windows の公式より遅れることがある（同ページの注記） |
| PowerShell 7 | PowerShell の言語機能 | `winget install --id Microsoft.PowerShell --source winget` | [一次・要照合] https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows 。7.6.0 から既定は MSIX、MSI は `--installer-type wix` |
| Python 3 | basedpyright（インタプリタの解決） | 公式の Python install manager: `winget install 9NQ7512CXL7T -e --accept-package-agreements --disable-interactivity` | [一次・要照合] https://docs.python.org/3/using/windows.html 。版ごとの ID（例 `Python.Python.3.14`）は推定 |
| ShellCheck | sh の検査 | `winget install --id koalaman.shellcheck` | [一次・要照合] https://github.com/koalaman/shellcheck#installing |
| shfmt | sh の整形 | `winget install --id mvdan.shfmt`（推定） | ID は winget-pkgs のフォルダ名からの推定 [二次] https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/mvdan/shfmt 。公式 README は `go install` のみ |
| Claude Code の CLI | 取り込みの判定（`claude -p`） | 公式の手順 https://code.claude.com/docs/en/setup | 拡張に同梱の CLI は PATH に入らない [一次] https://code.claude.com/docs/en/vs-code 。取り込みの判定には別に入れた CLI を使う |

確かめ方（手順書に書く）: 各ツールを入れたあと、新しいターミナルで `git --version`、`pwsh --version`、`python --version`、`shellcheck --version`、`shfmt --version` が版を返すこと。エディタを再起動し、`.sh` を開いて ShellCheck の警告が問題パネルに出ること。

## 5. 操作の手数（目安）

| 操作 | 手数 |
|---|---|
| Claude Code のパネルを開く | Ctrl+Esc（拡張の既定のキー。Sublime のキーと衝突しないかは Phase 2 で確かめる） |
| 新版の取り込みの検証を始める | ToDo を見て、コマンドを1つ実行する |
| 新しい版へ切り替える／戻す | エディタを閉じ、`switch.ps1 <版>` を1回実行する |
| 別の PC で設定をそろえる | 初回だけ Notion のトークンとページを設定する。以後は起動時に自動で取り込む |

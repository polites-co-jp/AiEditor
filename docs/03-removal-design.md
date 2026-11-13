# 03 コードの消し方

## 1. 裁定とこの文書の目的

- 裁定: 不要な機能は**コードごと消す**。**段階的に全部消す**。まず組み込み拡張と軽い部分を消して試作・計測し、動くことを確かめながら、本体の深い部分（AI・デバッガ・リモート・ノートブックなど）も順に消す。壊れたら戻せるようにする。
- 裁定: テレメトリは、送り先と鍵を入れず、送信を担う部品を何もしない実装に差し替える。
- 裁定: 本家の AI は消す。ただし Claude Code 拡張が依存する部分があれば特定して残す。調べ方は manifest・ファイル一覧・実機の動作だけ。
- 裁定: 本家の新版は毎週すべて検証して取り込む。

この文書は毎週の取り込みと両立する消し方を決める。要は「消す変更を機能ごとの独立した単位にし、本家のファイルの変化に強い形で持つ」こと。

## 2. 原則

1. 機能ごとに1単位: 1つの単位は1つの機能だけを消す。単位ごとに有効・無効を切り替えられる。
2. 消すことは宣言で持つ: ファイルとフォルダの削除、依存の削除、一覧からの1行の削除は、パッチにせず `unit.json` に宣言する。本家がそのファイルを書き換えても衝突しない。本家がそのフォルダにファイルを足しても、フォルダごと消える。
3. パッチは残るファイルへの最小の変更だけ: 消した部品を参照している、残るファイルの行だけを直す。整形や改名を混ぜない。
4. 入口は空にして残す: 拡張 API の名前空間（`vscode.debug`、`vscode.notebooks`、`vscode.lm`、`vscode.chat` など）は、消した機能の分を「何もしない実装」にして残す。同梱する拡張が起動時にそれらを呼んで失敗しないようにするため（例: PowerShell 拡張はデバッガを持つので、起動時にデバッグの API を呼ぶ見込み。推定）。空の実装は新しいファイル（`src/vs/workbench/api/common/extHostRemovedApi.ts`、仮）にまとめ、本家のファイルの変更を減らす。裁定: 入口は何もしない実装にして残し、中身のコードは消す（[00](00-overview.md) の4.3）。
5. 残る機能が依存する部品は残す: 消すと、残す機能が壊れる部品は残し、`unit.json` の `kept` に理由を書く。Claude Code 拡張が依存する部分も同じ扱い。
6. 型検査を関門にする: 消したあとの参照の残りは、本家の型検査で見つける。型検査が通らない単位は有効にしない。
7. 浅いものから深いものへ: 段階 A（組み込み拡張）→ B（軽い部分）→ C（深い部分）。各単位の後に動作の確認を挟む（計測は裁定 2026-11-13 でやめた）。

## 3. 削除の単位の形

`removals/<id>/` に置く。`<id>` は `<段階>-<番号>-<名前>`。

### 3.1 unit.json

```json
{
  "id": "C-2-debug",
  "stage": "C",
  "order": 320,
  "enabled": false,
  "intent": "デバッガを消す。拡張 API の vscode.debug は何もしない実装にして残す",
  "after": ["A-3-debug-extensions"],
  "delete": [
    "src/vs/workbench/contrib/debug"
  ],
  "removeDependencies": {
    "package.json": []
  },
  "removeLines": [
    { "file": "src/vs/workbench/workbench.common.main.ts", "line": "import './contrib/debug/browser/debug.contribution.js';" },
    { "file": "src/vs/workbench/workbench.desktop.main.ts", "line": "import './contrib/debug/electron-browser/extensionHostDebugService.js';" }
  ],
  "productRemove": [],
  "patch": "edits.patch",
  "kept": [
    { "path": "src/vs/workbench/contrib/debug/common/debug.ts", "reason": "例: タスクが型を参照しているため（実際に要るかは型検査で決める）" }
  ],
  "checks": {
    "absentCommands": ["workbench.action.debug.start"],
    "absentViews": ["workbench.view.debug"],
    "absentSettings": ["debug.console.fontSize"],
    "absentStrings": [{ "in": ["src/vs"], "text": "contrib/debug/" }],
    "absentProcesses": [],
    "absentHosts": []
  },
  "smoke": ["base", "claude-code", "powershell"]
}
```

| 項目 | 中身 |
|---|---|
| order | 当てる順。段階 A は 100 台、B は 200 台、C は 300 台 |
| enabled | 有効にするか。関門（7節）を通るまでは `false` |
| after | 先に当たっている必要がある単位 |
| delete | 消すフォルダ・ファイル（リポジトリのルートからの相対）。本家に無くなっていたら警告（改名を見つけるため） |
| removeDependencies | package.json ごとに、消す依存の名前 |
| removeLines | 1行で完結する参照（import の行、一覧の1要素）を消す。前後の空白を除いて**完全に一致する行**を探し、**ちょうど1行**見つかれば消す。0行か2行以上なら止める（`count` で別の数を指定できる）。正規表現は使わない |
| productRemove | product.json から消すキー（[02](02-repository-and-build.md) の3節の表と同じもの） |
| patch | 残るファイルへの変更（5.2 の作り方）。単位のフォルダの中のファイルの名前で、既定は `edits.patch`。無ければ書かない |
| kept | 消さずに残した部品と理由 |
| checks | 消えたことの確かめ方（7節） |
| smoke | この単位の後に通すスモークテストの組（[06](06-update-watch-and-take-in.md) の5節） |

### 3.2 README.md

単位ごとに、何を消すか、何が残るか、どの本家の機能や拡張に影響しうるか、壊れたときの症状と戻し方を書く。Claude が取り込みのときに読む。

## 4. 単位の一覧

最終的な中身（消すパスの全部、パッチ）は、Phase 2 と Phase 5 で本家のタグのソースを見て決める。下の表の所在は 1.146.0 で確かめたもの（`sources/research-vscode-source.md`）と、本家の構成からの見立て（推定と書いた）。

### 段階 A: 組み込み拡張（Phase 2）

組み込み拡張のフォルダを消すときは、本家の次の一覧から名前を消す（1.146.0 で確かめた場所）[一次] `sources/research-vscode-source.md` の3節。

- `build/npm/dirs.ts` の `separateRootMembers['extensions']`
- `extensions/pnpm-workspace.yaml` の `packages`
- `build/gulpfile.extensions.ts` の `compilations`（tsconfig のパスの配列）
- `build/lib/extensions.ts` の名前の一覧（`nativeExtensions` など。名前が載っているときだけ）
- 要照合: `eslint.config.js`、`build/lib/copilot.ts` にもパスの参照がある

これらは1行1要素の一覧なので、`removeLines` で消す。

| 単位 | 消すもの | 注意 |
|---|---|---|
| A-1-copilot-extension | `extensions/copilot`。`build/npm/dirs.ts` の `'extensions/copilot'` の要素、Copilot 拡張のビルドタスク（`build/gulpfile.vscode.ts`、`build/gulpfile.reh.ts`、`build/lib/copilot.ts`）、`build/npm/postinstall.ts` の `.claude/` の symlink | VSCodium が同じことをしている（`patches/52-ext-copilot-remove-it.json` が 125 のパスを消し、`53-ext-copilot-remove-it.patch` がビルドの一覧と依存を直す）[一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/patches/52-ext-copilot-remove-it.json 。VSCodium の版は 1.143.1 向けなので、行は合わない。中身の参考にとどめる。Phase 0 で、本家 1.146.0 の zip に分類の無い AI 寄りの組み込み拡張 `TypeScriptTeam.jsts-chat-features`（TS/JS のチャット向けの機能と推定）と `prompt-basics`（プロンプトファイルの言語と推定）を見つけた。この単位に足す見込みで、Phase 2 でソースの場所と中身を見て決める |
| A-2-accounts-extensions | `extensions/github`、`extensions/github-authentication`、`extensions/microsoft-authentication` | `microsoft-authentication` は `build/lib/extensions.ts` の `nativeExtensions` に載っている。product.json の `defaultChatAgent.providerExtensionId` が `vscode.github-authentication` を指すので、C-1 までチャットの設定の画面がエラーを出す恐れがある（推定。スモークで見る） |
| A-3-debug-extensions | product.json の `builtInExtensions` を `[]` にする（js-debug 系3件）。`extensions/debug-auto-launch`、`extensions/debug-server-ready` | — |
| A-4-notebook-extensions | `extensions/ipynb`、`extensions/notebook-renderers` | — |
| A-5-remote-extensions | `extensions/tunnel-forwarding` | テスト用の `vscode-test-resolver` などは同梱されない（`build/lib/extensions.ts` の `excludedExtensions`）ので残す |
| A-6-themes | `extensions/theme-*` のうち `theme-defaults`（Light Modern を含む）と `theme-seti`（ファイルのアイコン）以外。`theme-modern-icons`（アイコンのテーマ `vscode-modern-icons`。Phase 0 で確認）も消す（既定のアイコンのテーマは `vs-seti`） | product.json の `onboardingThemes` が消した名前を指すので、B-2 まで歓迎画面が警告を出す恐れがある（推定） |
| A-7-unused-extensions | `grunt`、`gulp`、`jake`、`simple-browser`、`mermaid-markdown-features`、`extension-editing`、`terminal-suggest`（ターミナルの入力候補。裁定で消す）、対象外の言語の言語機能（例 `php-language-features`） | 文法だけの拡張（色付け）は残す |

**残す組み込み拡張**は `builtin/keep.json` に理由つきで持つ。少なくとも次を載せる: `git`、`git-base`、`merge-conflict`、`search-result`、`markdown-language-features`、`markdown-math`、`markdown-basics`、`typescript-language-features`、`html-language-features`、`css-language-features`、`json-language-features`、`emmet`、`configuration-editing`、`npm`、`references-view`、`theme-defaults`、`theme-seti`、各言語の文法（`powershell`・`dotenv`・`shellscript`・`bat`・`python` を含む。`powershell` は台帳の `ms-vscode.powershell` の `extensionDependencies` でもある。Phase 0 で確認）、テスト用で同梱されないもの。`media-preview`（画像などのプレビュー）は VSCodium 1.143 にはあるが本家 1.146.0 の zip には無い。画像のプレビュー（裁定で残す）が 1.146 でどこにあるかを Phase 2 のスモークで確かめる。**本家のタグのすべての `extensions/*` は、`keep.json` か削除の単位のどちらかに載っていなければならない**。どちらにも無いもの（本家が新しく足したもの）があれば、取り込みは止まり、Claude が分類を提案する（6節）。

### 段階 B: 軽い部分（Phase 2）

workbench の contrib のうち、他の部品から参照されることが少ないもの（推定。型検査で確かめる）。import の行（1.146.0 で確かめた）は `removeLines` で消す。

| 単位 | 消すもの（1.146.0 での所在） | 注意 |
|---|---|---|
| B-1-telemetry | **差し替え**: `src/vs/platform/telemetry/{common,browser,node}/1dsAppender.ts` を、同じ名前と型で何もしない実装にする（新しいファイルに置き換えるパッチ）。**削除**: `contrib/telemetry`、`contrib/editTelemetry`、`contrib/bracketPairColorizer2Telemetry` と、その import 行。依存 `@microsoft/1ds-core-js`・`@microsoft/1ds-post-js` | 送信先は `https://mobile.events.data.microsoft.com/OneCollector/1.0`（要照合）。テレメトリのサービスを呼ぶ側は残る（裁定どおり）。`telemetry.telemetryLevel: off` も `mydist` の既定に入れる。VSCodium の `00-telemetry-disable.patch` は設定の既定を OFF にするだけで、送信のコードは消していない [一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/patches/00-telemetry-disable.patch |
| B-2-onboarding-experiments-surveys | `contrib/welcomeGettingStarted`、`contrib/welcomeWalkthrough`、`contrib/welcomeOnboarding`、`contrib/onboarding`（desktop の `onboardingTryout` を含む）、`contrib/surveys`。実験（`services/assignment`）は多くの部品から注入されている見込み（推定）なので、**何もしない実装に差し替える**。product.json の `onboardingKeymaps`・`onboardingThemes` | `contrib/welcomeViews`（エクスプローラーの「フォルダーを開く」などの案内）は消さない。Claude Code 拡張は manifest に `walkthroughs` を持つ。受け手の contrib を消したときに、拡張ホストのログに警告が出るか、拡張が動くかをスモークで見る |
| B-3-issue-share | `contrib/issue`（desktop）、`contrib/share`、product.json の `reportIssueUrl` | — |
| B-4-outline-view | `contrib/outline`（アウトラインのビュー） | `services/outline` と `contrib/codeEditor/browser/outline/documentSymbolsOutline.ts` はパンくずリストが使う見込み（推定）なので、C-7 まで残す |
| B-5-theme-switching | `contrib/themes/browser/themes.contribution.ts`（テーマを選ぶコマンドなど。推定）と desktop の `themes.test.contribution.ts` | テーマのサービス（`services/themes`）は残す。`workbench.colorTheme` は `mydist` の既定で Light Modern に固定する |
| B-6-online-feeds | product.json の `emergencyAlertUrl`・`profileTemplatesUrl`（1.146.0 にあれば）を消し、それを読む部品が値の無いときに通信しないことを確かめる | 0-5 の棚卸しで、AI を止めても `main.vscode-cdn.net` へ必ず通信していた（`records/phase0/network-inventory.md`）。裁定（2026-11-13 の「通信の扱いの訂正」）の「不要な通信はすべて止める」を実行するために足した単位（リーダーの判断）。どのキーが通信の元かは未確認なので、Phase 2 で product.json とソースで確かめ、自作のビルドの監査で宛先が消えたことを見る。WPAD（`wpad` の名前の問い合わせ）の止め方も未確認で、ここで調べる |
| B-7-terminal-suggest | 本体の `src/vs/workbench/contrib/terminalContrib/suggest` と設定 `terminal.integrated.suggest.enabled`。ほかの terminalContrib からの参照は edits.patch で直す | 拡張の `terminal-suggest` は A-7 で消えるが、本体側の部品が残ると Phase 2 の段階 A の作業で分かった（`tasks/2026-11-13-p2-units-a/handoff-notes.md`）。裁定「ターミナルの入力候補は消す」「不要な機能はコードごと消す」を実行するために足した単位（リーダーの判断 2026-11-14）。有効になるまでは `mydist` の既定で `terminal.integrated.suggest.enabled: false`（スコープを確かめてから） |

### 段階 C: 深い部分（Phase 5。1単位ずつ）

ユーザーの裁定の例示の順（AI → デバッガ → リモート → ノートブック）に並べた。各単位は、前の単位が関門を通って日常の利用で1週間以上問題が無かった後に始める。

| 単位 | 消すもの（1.146.0 での所在） | 残すもの・注意 |
|---|---|---|
| C-1-ai | `contrib/chat`（common の import 10行、desktop の2行）、`contrib/inlineChat`、`contrib/mcp`、`contrib/agentsVoice`、`platform/agentHost`、`services/agentHost`、`services/chat`、`platform/mcp`、`services/mcp`、`services/authentication/browser/authenticationMcp*`。拡張 API の main thread 側 `api/browser/mainThreadChat*.ts`・`mainThreadLanguageModels.ts`・`mainThreadLanguageModelTools.ts`・`mainThreadMcp.ts` と、対になる extHost 側。依存 `@github/copilot-sdk`、`@anthropic-ai/claude-agent-sdk`、`@openai/codex`、`@vscode/copilot-api`（VSCodium の patch 53 が消している名前。1.146.0 での有無は要照合）。product.json の AI のキー | 拡張 API の `vscode.lm`・`vscode.chat` などは空の実装にして残す（2節の4）。`api/browser` の chat・言語モデル・mcp の main thread のファイルは、2本を除いて `contrib/chat` か `contrib/mcp` を import している [一次] `sources/research-vscode-source.md` の6節。ほかの contrib（エディタ・ターミナル・SCM・検索など）からの AI の参照も消す。数が多いので、型検査の誤りの一覧から順に直す |
| C-2-debug | `contrib/debug`（common の6行、desktop の1行）、拡張 API の `vscode.debug` の実装 | `vscode.debug` は空の実装で残す。テスト（`contrib/testing`。裁定で残す）、タスク、ノートブックがデバッグを参照している見込み（推定）。テストはデバッグでの実行だけが無くなり、普通の実行は残るようにする |
| C-3-remote | `contrib/remote`（common の2行、desktop の1行）、`contrib/remoteTunnel`、`services/tunnel`、`platform/remoteTunnel`、`platform/remote/electron-browser/sharedProcessTunnelService.ts`、`services/remote/common/remoteExplorerService.ts`、サーバー（reh）のビルドタスク。product.json の server・tunnel のキー | ローカルの拡張ホストが使うリモートの基盤のサービス（`IRemoteAgentService` など。推定）は残す |
| C-4-notebook | `contrib/notebook`、`contrib/replNotebook`、`contrib/interactive`、`services/notebook`、拡張 API のノートブックの実装 | `vscode.notebooks`、`workspace.notebookDocuments` などは空の実装で残す（言語サーバーの拡張がノートブックのイベントを購読する見込み。推定）。**全文検索がノートブックの検索と結びついている恐れ**（推定）。検索が壊れたら、検索が使う部分を `kept` に入れる |
| C-5-extension-gallery | 拡張のギャラリー（`services/extensionManagement/common/extensionGalleryService.ts` は**何もしない実装に差し替え**）、おすすめ（`services/extensionRecommendations`）、`extensionTipsService`、`extensionGalleryAccountService`、`extensionGalleryManifestService`、拡張のビューのうち検索・おすすめ・「VSIX からインストール」 | **残す**: CLI の `--install-extension`、入っている拡張の一覧と有効・無効の切り替え、動作中の拡張の一覧（計測に使う） |
| C-6-settings-sync | `contrib/userDataSync`、`services/userDataSync` の workbench 側（common・desktop の import 7行）、アカウントのメニュー（`services/accounts`。依存が無ければ） | プロファイルなどが `platform/userDataSync` を使っている見込み（推定）。使っていれば `kept` に入れる。拡張 API の `vscode.authentication` は残す |
| C-7-breadcrumbs-outline | `browser/parts/editor/breadcrumbs*`（推定）、`services/outline`、`contrib/codeEditor/browser/outline` | 本家の共有部品（エディタの枠）に入っているので、パッチが大きく、本家の変更とも衝突しやすい見込み。関門を2回続けて通らなければ、ユーザーに諮る（[08](08-risks-and-open-items.md) の別案） |

テスト（`contrib/testing`）とコメント（`contrib/comments`）は裁定で残す。使って重ければ改めてユーザーに諮る。ほかに、裁定に挙がっていない機能を消すときは、ユーザーの確認を経て単位を足す。

## 5. 当て方

`scripts/apply.mjs` が作業ツリーで行う。

### 5.1 順序

1. product.json の上書き（[02](02-repository-and-build.md) の3節）。
2. `enabled: true` の単位を `order` の順に当てる。各単位では次の順に進める。
   1. 当てる前に、`after` に挙げた単位がすべて有効で、すでに当たっていることを確かめる。満たさなければ止める。
   2. `delete` → `removeDependencies` → `removeLines` → `productRemove` を行い、コミット `unit <id>: ops` にする。
   3. `edits.patch` を `git am -3` で当て、コミット `unit <id>: edits` にする（パッチの中のコミットがそのまま入る）。
3. `patches/` を番号の順に `git am -3` で当てる。

単位ごとに2つのコミットができるので、「単位 k まで当てた状態」をいつでも取り出せる（壊れた単位を探すときに使う）。

### 5.2 パッチの作り方と直し方

- 作り方: 作業ツリーで前の単位までを当てた状態から、`ops` のコミットを作り、型検査の誤りを直してコミットする。`git format-patch -1 <edits のコミット> --stdout > removals/<id>/edits.patch`。
- edits のコミットは `git -c user.name=shuko-apply -c user.email=apply@shuko.invalid commit` で作る。利用者の名前とメールをパッチの `From:` に残さないため（2026-11-14 リーダーの判断。`tasks/2026-11-13-p2-apply/doc-corrections.md` の4）。修理のときの `claude -p` も同じ（`TAKE-IN.md` の規約）。
- `git rerere` を有効にしておく（`git config rerere.enabled true`）。3-way で当てるので、前後の行がずれても大半は自動で当たる。常設の clone は前のタグを持っているので、3-way の基底が見つかる。
- 取り込みで当たらなかったとき: 作業ツリーで衝突を解き、同じ手順で `edits.patch` を書き戻す。`TAKE-IN.md` の規約（本家側の変更を採る、消す意図が消えたら単位の README を直す）に従う。

### 5.3 単位どうしを独立に保つ規則

- パッチは、自分の単位が消した部品への参照だけを直す。ほかの単位の都合の変更を入れない。
- 本家の多くの単位が触るファイル（`workbench.common.main.ts`・`workbench.web.main.ts`・`src/vs/sessions/sessions.*.main.ts`（1.146.0 では sessions の main も workbench の contrib を import する。`tasks/2026-11-13-p2-apply/doc-corrections.md` の3）、`workbench.desktop.main.ts`、`build/npm/dirs.ts` などの一覧）は、`removeLines` で直し、パッチに入れない。こうしておけば、単位を1つ無効にしても、後の単位のパッチの前後の行が変わらない。
- 拡張 API の空の実装は、単位ごとに新しいファイル（例 `extHostRemovedApi.debug.ts`）に置く。`extHost.api.impl.ts` への変更は、その単位の名前空間の行だけにする。
- 単位を無効にしたら、後の単位を当て直し、当たらなければ後の単位のパッチを直す。この手間は Phase 3 で測る。

### 5.4 ロックファイル

依存とワークスペースの一覧を消すと、ロックファイルが変わる。1.146.0 には `pnpm-lock.yaml` が6つある（ルート、`build/`、`extensions/`、`extensions/copilot/`、`remote/`、`test/sanity/`。`tasks/2026-11-13-p2-apply/doc-corrections.md` の1）。`lockfile.diff` は6つ分の差分。単位が消したフォルダの中のものは「無いこと」を確かめる。単位が依存を消すので、依存の導入は `--frozen-lockfile` を付けずに行い、その後に比べる。ロックファイルはパッチにしない。依存の導入のときに作り直し、本家のロックファイルとの差分を `records/take-in/<label>/lockfile.diff` に残す。**差分が「消した依存の削除」だけであること**を適用後の検査で確かめる（残った依存の版が変わっていたら止める。推定の手順なので Phase 2 で確かめる）。

## 6. 適用後の検査（単位に共通）

`apply.mjs` が結果を `checks.json` に書く。1つでも満たさなければ、取り込みは止まる。

| 検査 | 中身 |
|---|---|
| 当て方の成否 | 単位ごと・パッチごとの結果。`removeLines` の見つかった行の数 |
| 消え残り | `delete` のパスが無いこと |
| 参照の残り | 単位の `checks.absentStrings`（例: `contrib/debug/`）が `src/` と `build/` に無いこと（`kept` に挙げたファイルを除く） |
| 未分類の組み込み拡張 | 本家の `extensions/*` のうち、`builtin/keep.json` にも単位にも無いもの |
| 本家が足した部品 | 前のタグから増えた `src/vs/workbench/contrib/*`、`src/vs/workbench/services/*`、`src/vs/platform/*` のフォルダと、`workbench.*.main.ts`・`src/vs/sessions/sessions.*.main.ts` の import の行。名前に chat・agent・copilot・mcp・telemetry・experiment・survey などを含むものは目立たせる |
| 依存の変化 | ルートの package.json に増えた依存（特に AI・テレメトリの SDK） |
| ロックファイル | 5.4 |

## 7. 関門（単位を有効にしてよい条件）

単位を `enabled: true` にする前に、次をすべて満たす。結果は `records/take-in/<label>/gate-<id>.md` に残す。

1. 当たる: 6節の検査を通る。
2. 型検査とビルドが通る: [02](02-repository-and-build.md) の4節の5・6。
3. 消えている: `checks` の `absentCommands`（コマンドパレットに出ない）、`absentViews`（ビュー・メニューに出ない）、`absentSettings`（設定の画面に出ない）、`absentProcesses`（Process Explorer にその機能のプロセスが無い）、`absentHosts`（その機能の外向きの接続が無い）。
4. 壊れていない: 単位の `smoke` の組を通る（[06](06-update-watch-and-take-in.md) の5節）。特に Claude Code 拡張の確認の組。起動時の開発者ツールのコンソールと拡張ホストのログに、前の段階に無かったエラーが出ない。
5. （やめた）増えていない: メモリの計測で前の段階を上回らない。計測をやめたので見ない（裁定 2026-11-13）。

通らないときは、直すか、`enabled: false` のままにして理由を README に書き、次の単位へ進む。ただし、無効のままにした単位を `after` に挙げている後の単位は当てられない（5.1）。その単位も無効にするか、`after` を見直す。

## 8. 戻し方

| 何が起きたか | 戻し方 |
|---|---|
| 新しい版を使い始めてから不具合が出た | `switch.ps1 -Previous` で前の版へ戻す（[02](02-repository-and-build.md) の6節） |
| ある単位が原因と分かった | その単位を `enabled: false` にしてビルドし直す。ビルドリポジトリの変更は git で戻せる |
| どの単位が原因か分からない | 作業ツリーの単位ごとのコミットを使い、半分ずつ当てた状態をビルドして絞る（`apply.mjs --until <id>`） |
| 取り込みでパッチが壊れ、直せない | その週の取り込みを見送る（`upstream.json` を変えない）。セキュリティ修正を含むなら、壊れた単位を無効にした版を作ることを判定に書き、ユーザーが決める |

## 9. Claude Code 拡張が依存する部分の扱い

- manifest（2.1.322、win32-x64）に、`chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`enabledApiProposals`・`extensionDependencies` は無い [一次] https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/package.json 。宣言の上では、本家のチャットにも提案中の API にも依存していない。
- contributes にあるのは `configuration`・`jsonValidation`・`commands`・`keybindings`・`viewsContainers`（アクティビティバーと**セカンダリサイドバー**）・`views`（Webview）・`walkthroughs`・`menus`。起動は `onStartupFinished` と `onWebviewPanel:claudeVSCodePanel`。これらの受け手（Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼）は消さない。Phase 0 の 0-1 で `menus` に、`comments/commentThread/title`（`commentController == claude-code-hunks`。変更の塊の受け入れ・却下にコメントの API を使う見込み）、`editor/context`・`editor/title`（独自のファイルシステムの提供者 `_claude_vscode_fs_right` と差分エディタ）、`webview/context`、`commandPalette` も見つけた。コメント（`contrib/comments`）、差分エディタ、拡張のファイルシステムの提供者、これらのメニューの場所も消さない（`records/phase0/claude-code-manifest.md`）。
- 宣言に出ない実行時の依存（コードの中で `vscode.lm` などを呼ぶか）は、圧縮されたコードを読まずには分からない（裁定で読まない）。C-1 の関門のスモークで確かめる。壊れたら、拡張ホストのログの誤りから使われた API を特定し、その部分を `kept` に入れて残す。
- manifest の確認は、Claude Code 拡張の版を上げるたびに行う（[04](04-bundled-extensions.md) の4節の5）。上の項目が増えたら、残す部分を見直す。

# basedpyright 1.40.2 が Python 拡張なしで起動しない件の調べ（事実の整理）

- 作成: 蒙恬（2026-11-13）。依頼: リーダー（曹参の試しで `upstream-default` の basedpyright が `Error: Python extension is not installed or is disabled` で起動に失敗した件）
- 判断は含めない。ユーザーに諮る材料。出典の取得日はすべて 2026-11-13。

## 0. 要点

1. basedpyright の VS Code 拡張は `ms-python.python` を**依存に持たない**（manifest に `extensionDependencies` も `extensionPack` も無い）。失敗の原因は、既定の `basedpyright.importStrategy: "fromEnvironment"` が Python 拡張の API で環境を探すこと。公式の文書と issue #1188 が、回避として「Python 拡張を入れる」か「`basedpyright.importStrategy` を `useBundled` にする」を挙げている。
2. 実機（本家 1.146.0、`upstream-default` と同じ拡張と設定）で再現し、`useBundled` にすると拡張が起動して `sample.py` を解析することを確かめた。`python.defaultInterpreterPath`・`python.pythonPath` を入れるだけでは直らない。
3. 同梱のサーバーを LSP で直に動かすと、`sample.py` の型の誤り（`reportOperatorIssue`）が診断として返る。**PATH に Python が無い状態でも返る**（標準ライブラリの型は拡張に同梱の typeshed を使う）。
4. `ms-python.python` を台帳に足すなら: Open VSX の最新は 2026.4.0（2026-03-13 公開、GitHub の最新 2026.10.0 より古い）。`extensionPack` に Pylance・debugpy・python-envs を持つ（Pylance は Open VSX に無い）。デバッガ（`python`）、AI の言語モデルツール6件、ノートブック系の提案中 API などを持つ。
5. 代わりの拡張の候補（事実だけ）: `astral-sh.ty`、`meta.pyrefly`、`ms-pyright.pyright`（Open VSX では 2025-06 で止まっている）、`charliermarsh.ruff`（型の検査ではなくリンター）。

## 1. 文書・README・issue・manifest

| 出典 | 書いてあること |
|---|---|
| [一次] https://docs.basedpyright.com/latest/installation/ides/ （VSCode / VSCodium の節） | 拡張は Python 環境の pypi パッケージを自動で探す。Microsoft の Python 拡張を使わずに basedpyright を（仮想環境に）入れていると「the VSCode extension will crash on load」。理由は、インタープリタの自動の検出が ms-python からしか得られないため。拡張は「by design does not depend explicitly on ms-python, due to concerns about telemetry」。回避は (1) ms-python を手で入れる、(2) `basedpyright.importStrategy` を `useBundled` にする（`.vscode/settings.json` に書く例）。issue #1188 へのリンクあり |
| [一次] https://github.com/DetachHead/basedpyright/issues/1188 「Activating extension failed. Error: Python extension is not installed or is disabled when `basedpyright.importStrategy` is `"fromEnvironment"`」（2025-04-02 起票、**未解決のまま open**） | 1.28.4 で `ms-python.python` への依存を外した（テレメトリの懸念）。保守者は `useBundled` でしか試していなかった。`fromEnvironment` は Python 拡張でインタープリタと `basedpyright-langserver` を探すため落ちる。回避は Python 拡張を入れるか `useBundled`（起票者が `useBundled` で直ったと確認）。2025-04-06 に保守者が「依存を戻してテレメトリを自動で切る」案を出したが、利用者は Microsoft の拡張を避けたいと答えた。2026-10 のコメントで `fromPATH` のような別の選択肢の案が出ている |
| VSIX の manifest（`C:\b\p0\vsix\detachhead.basedpyright-1.40.2\package.json`。JS は読んでいない） | `extensionDependencies`・`extensionPack`・`enabledApiProposals` は無い。`activationEvents`: `onLanguage:python`、`workspaceContains:pyrightconfig.json`、`workspaceContains:pyproject.toml`。設定 `basedpyright.importStrategy`（既定 `fromEnvironment`、選択肢 `fromEnvironment`・`useBundled`）、`python.pythonPath`（既定 `"python"`、"Path to Python, you can use a custom version of Python."）、`python.venvPath`。`configurationDefaults` に `python.languageServer: "None"`、`python.analysis.typeCheckingMode: "off"`（Python 拡張の言語サーバーを止めるため） |
| Open VSX の API（`https://open-vsx.org/api/detachhead/basedpyright`） | 1.40.2、2026-10-04 公開、verified、MIT、`engines ^1.101.0`、発行 DetachHead、universal、6,433,623 バイト |

## 2. 実機での試し

### 2.1 条件

- 本体: 本家 1.146.0（`C:\b\p0\vscode-1.146.0\`）。
- 環境: `upstream-default` と同じ拡張（台帳の9件、`detachhead.basedpyright@1.40.2` を含む）と計測の設定（`task.allowAutomaticTasks: on`、`security.workspace.trust.enabled: false`）、`argv.json` に `locale: ja`。これに次を足した4つの環境を新しく作った（`scripts/lib/p0-common.ps1` の `bp-probe-a`〜`d`。`C:\b\p0\data\bp-probe-*\`）。
  - 共通: `git.enabled: false`（開いたファイルの `.git` に触れないため）、`basedpyright.analysis.logLevel: "Trace"`、`basedpyright.trace.server`・`python.trace.server: "verbose"`（LSP の記録はどちらも出なかった）
  - a: そのまま（`importStrategy` は既定の `fromEnvironment`）
  - b: `python.defaultInterpreterPath` と `python.pythonPath` に `C:\Python314\python.exe`
  - c: `basedpyright.importStrategy: "useBundled"`
  - d: c と b の両方
- 起動: `p0-launch.ps1 -Name bp-probe-<x> -NoWorkspace -ExtraArgs C:/b/p0/scratch/sample.py -SmokeSeconds 45`（`sample.py` だけを開き、45 秒後に起動した PID の木だけを止めた。scratch のファイルは開いただけで、保存していない）。
- 手の確かめの環境（`upstream-ai-disabled`・`testbed` など）は起動も作り直しもしていない。
- `sample.py` の中身（`scripts/p0-scratch.ps1` が作ったもの）: `def add(x: int) -> int:` / `    return x + "one"` / `print(add(1))`。

### 2.2 結果

| 環境 | 拡張の起動 | 記録（`<data>\user\user-data\logs\<日時>\window1\exthost\`） |
|---|---|---|
| a（そのまま） | **失敗** | `exthost.log`: `[error] Activating extension detachhead.basedpyright failed due to an error:` / `[error] Error: Python extension is not installed or is disabled` / `at Object.api (c:\b\p0\data\bp-probe-a\ext\detachhead.basedpyright-1.40.2\dist\extension.js:1:221)`。`basedpyright` の出力のログは作られない |
| b（Python の場所だけ） | **失敗** | a と同じ3行（06:23:33）。インタープリタの場所を設定しても `fromEnvironment` の失敗は避けられない |
| c（`useBundled`） | **成功** | `exthost.log` に誤りは無く、`[warning] DiagnosticCollection with name 'basedpyright' does already exist.` が1行。`detachhead.basedpyright\basedpyright.log`: `basedpyright language server 1.40.2 starting`、`Python extension not found`（2回）、`Assuming Python version 3.14.7.final.0`、検索の場所に `c:\Python314\Lib` など（PATH の `python` を使った）、`checking: file:///c%3A/b/p0/scratch/sample.py (62ms)` |
| d（`useBundled` と Python の場所） | **成功** | c と同じ形。`Setting pythonPath for service "<default>": "c:\Python314\python.exe"`、`checking: ... sample.py (83ms)` |

- 画面の問題パネルに診断が出たかは、エディタの記録には残らない（LSP の記録の設定が効かなかった）。そこで 2.3 で、同じ同梱のサーバーを直に動かして診断の中身を確かめた。画面での確かめは、ユーザーが手で行う必要がある。

### 2.3 同梱のサーバーを LSP で直に動かした結果

`node scripts/p0-lsp-probe.mjs --server C:/b/p0/data/bp-probe-c/ext/detachhead.basedpyright-1.40.2/dist/server.js --file C:/b/p0/scratch/sample.py [--python C:/Python314/python.exe] [--strip-python-path]`（`--stdio` で起動し、`initialize` → `didOpen` → `publishDiagnostics` を待つ。設定の問い合わせには `importStrategy: useBundled` などを返す）。

| 条件 | 診断 | サーバーの記録 |
|---|---|---|
| Python の場所を渡さない（PATH の `python` を使う） | 2件: 2行目 `reportOperatorIssue`（エラー）「演算子 "+" は型 "int" と "Literal['one']" ではサポートされていません」、2行目 `reportUnknownVariableType`（警告）「戻り値の型が不明です」 | `Assuming Python version 3.14.7.final.0` |
| `pythonPath = C:\Python314\python.exe` | 同じ2件 | `Setting pythonPath ...`、`Assuming Python version 3.14.7.final.0` |
| PATH から Python を外す（`--strip-python-path`。`python` を含む場所と WindowsApps を外した） | 同じ2件 | `Unable to get Python version from interpreter` |

- 診断の文言が日本語なのは、サーバーが OS の言語に従うため（推定）。
- Python 本体が無くても、型の検査は動く（標準ライブラリの型は拡張の `dist\typeshed-fallback` を使う。2.2 の記録の検索の場所に出ている）。入っているパッケージ（`site-packages`）の型は、Python が見つかるときだけ解決される。

## 3. `ms-python.python` を台帳に足す場合の事実（Open VSX、manifest で分かる範囲）

取得: `node scripts/p0-openvsx-meta.mjs ms-python/python ms-python/debugpy/win32-x64 ms-python/vscode-python-envs ms-python/vscode-pylance`（保存先 `C:\b\p0\probe\openvsx\`）。

| 項目 | `ms-python.python` | `ms-python.debugpy`（win32-x64） | `ms-python.vscode-python-envs` | `ms-python.vscode-pylance` |
|---|---|---|---|---|
| Open VSX の最新 | 2026.4.0（2026-03-13） | 2026.6.0（2026-05-01） | 1.42.0（2026-11-05） | **無い**（API が 404） |
| 発行（publishedBy） | `open-vsx`（Open VSX 側が公開した形） | `open-vsx` | `open-vsx` | — |
| verified | true | true | true | — |
| ライセンス（表示） | MIT | MIT | （表示なし） | — |
| engines.vscode | ^1.95.0 | ^1.92.0 | ^1.110.0-20260204 | — |
| VSIX のサイズ | 6,826,731 バイト | 4,700,834 バイト | 1,580,578 バイト | — |
| extensionDependencies | なし | `ms-python.python` | なし | — |
| extensionPack | `ms-python.vscode-pylance`、`ms-python.debugpy`、`ms-python.vscode-python-envs` | なし | なし | — |

- GitHub の vscode-python のリリースの最新は v2026.10.0（2026-10-14 の表示）で、Open VSX の 2026.4.0 は半年ほど古い（[一次] https://github.com/microsoft/vscode-python/releases 。日付の年はタグの名前から）。
- `ms-python.python` 2026.4.0 の manifest:
  - `main`: `./out/client/extension`
  - `contributes` のキー: `problemMatchers`、`walkthroughs`（`pythonWelcome`、`pythonDataScienceWelcome`）、`breakpoints`、`commands`、`configuration`（41 項目）、`debuggers`（型 `python`）、`grammars`、`jsonValidation`、`keybindings`、`languages`、`menus`、`submenus`、`viewsWelcome`、`yamlValidation`、`languageModelTools`（`get_python_environment_details`、`get_python_executable_details`、`install_python_packages`、`configure_python_environment`、`create_virtual_environment`、`selectEnvironment` の6件）
  - `enabledApiProposals`: `contribEditorContentMenu`、`quickPickSortByLabel`、`testObserver`、`quickPickItemTooltip`、`terminalDataWriteEvent`、`terminalExecuteCommandEvent`、`codeActionAI`、`notebookReplDocument`、`notebookVariableProvider`。本家 1.146.0 の product.json の `extensionEnabledApiProposals` に `ms-python.python` の一覧があり、これらを含む（`terminalShellEnv`・`portsAttributes` も許可されている）
  - `activationEvents`: `onLanguage:python`、`onDebugInitialConfigurations`、`onDebugResolve:python`、`onCommand:python.copilotSetupTests`、`workspaceContains:`（pyproject.toml、requirements.txt、.venv など11件）、`onLanguageModelTool:`（5件）、`onTerminalShellIntegration:python`
- 消す機能との関わり（manifest から分かる範囲）:
  - デバッグ（C-2）: `debuggers`（`python`）、`breakpoints`、`onDebug*` の起動。debugpy は `extensionPack` に入っている（依存ではない）
  - AI（C-1）: `languageModelTools` 6件、`codeActionAI` の提案中 API、`onCommand:python.copilotSetupTests`
  - ノートブック（C-4）: `notebookReplDocument`・`notebookVariableProvider` の提案中 API、`pythonDataScienceWelcome` の walkthrough
  - 歓迎画面（B-2）: `walkthroughs` 2件
  - これらの受け手を消した後に拡張がどう動くかは、manifest からは分からない（実機で見る項目）
- `extensionPack` の扱い: VSIX を `--install-extension` で入れたとき、パックの残り（Pylance など）をギャラリーから取りにいくかは確かめていない。`extensions.allowed`（台帳の ID だけ）があれば、許可していない拡張は入らない（0-8 の結果）。Pylance は Open VSX に無い。
- `ms-python.debugpy` は `extensionDependencies` に `ms-python.python` を持つ（逆向き）。`python` 拡張を入れても debugpy は依存としては付いてこない。

## 4. 代わりの案（事実だけ。Open VSX、2026-11-13）

| 拡張 | 版（公開日） | 発行 | verified | ライセンス | engines | サイズ | 依存・パック | 提案中 API | 起動 |
|---|---|---|---|---|---|---|---|---|---|
| basedpyright を `useBundled` で使う（今の台帳のまま） | 1.40.2（2026-10-04） | DetachHead | true | MIT | ^1.101.0 | 6,433,623 | なし | なし | `onLanguage:python` ほか |
| `astral-sh.ty`（win32-x64） | 2026.96.0（2026-11-11） | charliermarsh | true | MIT | ^1.91.0 | 15,435,648 | なし | なし | `onLanguage:python`、`workspaceContains:*.py`、`*.ipynb` |
| `meta.pyrefly`（win32-x64） | 1.4.9001（2026-11-02） | kinto0 | true | MIT | ^1.103.0 | 16,316,764 | なし | `editorHoverVerbosityLevel` | `onLanguage:python`、`onNotebook:jupyter-notebook` |
| `ms-pyright.pyright` | 1.1.402（2025-06-12） | open-vsx | true | MIT | ^1.99.0 | 5,608,916 | なし | なし | `onLanguage:python`、`workspaceContains:pyrightconfig.json` |
| `charliermarsh.ruff`（win32-x64。リンター・整形で、型の検査ではない） | 2026.96.0（2026-11-12） | charliermarsh | true | MIT | ^1.91.0 | 11,204,189 | なし | なし | `onLanguage:python`、`onLanguage:markdown` ほか |

- 上の表は manifest と Open VSX の API の値だけ。ty・pyrefly が Python 拡張なしでインタープリタをどう探すか、診断の質、メモリの量は確かめていない。
- `ms-pyright.pyright` は Open VSX の版が 2025-06 から更新されていない。

## 5. 新しい台本の使い方（大岡越前守の確かめ用）

どちらもリポジトリの直下で走らせる。Node.js の標準だけで書いた（依存なし）。

### 5.1 `scripts/p0-openvsx-meta.mjs`

Open VSX の API からメタデータと manifest（package.json）だけを取る。VSIX は取らない（サイズは `HEAD` の `Content-Length` だけを見る）。

```
node scripts/p0-openvsx-meta.mjs [--out C:/b/p0/probe/openvsx] <namespace/name[/target][@version]> ...
例: node scripts/p0-openvsx-meta.mjs ms-python/python ms-python/debugpy/win32-x64 detachhead/basedpyright@1.40.2
```

- 出力（`--out` の下、拡張ごとのフォルダ `<namespace>.<name>[@target]\`）: `api.json`（Open VSX の API の応答そのまま）、`package.json`（manifest）、`summary.json`。
- 標準出力: `summary.json` の配列。項目は `id`・`version`・`timestamp`・`verified`・`license`・`engines`・`publishedBy`・`targetPlatform`・`vsixBytes`・`download`・`bundledExtensions`・`dependencies`・`extensionDependencies`・`extensionPack`・`enabledApiProposals`・`activationEvents`・`main`・`contributesKeys`・`debuggers`・`notebooks`・`notebookRenderer`・`chatParticipants`・`languageModelTools`・`walkthroughs`・`configurationKeysCount`。
- 見つからない拡張は `{ "spec": ..., "error": "GET ... -> 404" }` として並ぶ（例 `ms-python/vscode-pylance`）。
- 3節・4節の表はこの出力から作った。

### 5.2 `scripts/p0-lsp-probe.mjs`

言語サーバー（LSP、stdio）を、エディタを介さずに直に起動し、1つのファイルを開いて、返ってきた診断（`textDocument/publishDiagnostics`）を表示する。ファイルは読むだけで、書き換えない。

```
node scripts/p0-lsp-probe.mjs --server <server.js> --file <対象のファイル> [--python <python.exe>] [--strip-python-path] [--language python] [--timeout 30]
例: node scripts/p0-lsp-probe.mjs --server C:/b/p0/data/bp-probe-c/ext/detachhead.basedpyright-1.40.2/dist/server.js --file C:/b/p0/scratch/sample.py --strip-python-path
```

- 手順: `node <server> --stdio` で起動 → `initialize`（`rootUri: null`）→ `initialized` → `textDocument/didOpen` → 診断を待つ → `shutdown`・`exit`。
- サーバーからの `workspace/configuration` の問い合わせには、`basedpyright.importStrategy: "useBundled"`、`basedpyright.analysis.diagnosticMode: "openFilesOnly"`、`--python` があれば `python.pythonPath` を返す。ほかの要求（`client/registerCapability` など）には `null` を返す。
- `--strip-python-path`: サーバーの子のプロセスの PATH から、`python` を名前に含む場所と `WindowsApps`（python の別名）を外す（Python 本体が見つからない状態を作る）。
- URI は `file:///C:/...` と `file:///c%3A/...` を同じものとして比べる。開いた直後の空の診断は、2回目まで待つ。
- 出力（JSON）: `server`・`file`・`python`・`stripPythonPath`・`diagnostics`（`line`（1始まり）・`severity`（1 エラー、2 警告）・`code`・`message`）・`publishCount`・`logExcerpt`（サーバーの `window/logMessage` のうち Python・版・誤りに関わる行、20行まで）・`ms`・`exitCode`、あれば `stderr`。
- 時間内に診断が来なければ `diagnostics: null`（2.3 の1回目は、URI の比べ方の誤りでこうなった。直した）。

## 6. 裁定の後の対応（2026-11-13）

裁定（`docs/user-decisions.md` の「basedpyright が Python 拡張なしで起動しない件」）: `mydist` の既定に `basedpyright.importStrategy: "useBundled"` を入れる。台帳は9件のまま。計測では本家と自作の両方のユーザー設定に同じ値を入れる。

- `extensions-src/mydist/package.json` の `configurationDefaults` に `"basedpyright.importStrategy": "useBundled"` を足した。`extensions-src/mydist/README.md` に理由と裁定を書いた。
- `scripts/lib/p0-common.ps1` の計測の設定（`$P0MeasureSettings`）に同じ値を足した。これを使うのは `upstream-default` と `testbed-measure` だけ。2つだけを `p0-env.ps1 -Name` で作り直した（07:36・07:37 JST。導入は全部終了コード 0）。両方の `user\user-data\User\settings.json` が `{"task.allowAutomaticTasks": "on", "security.workspace.trust.enabled": false, "basedpyright.importStrategy": "useBundled"}` で、`p0-env.json` の `settings` も同じ。
- `bp-probe-a`〜`d` は記録として一覧に残し、`InAll = $false` で `p0-env.ps1 -All` の対象から外した（`-List` に `all=False` と出る。作り直すときは `-Name` で1つずつ）。土台の設定からは `basedpyright.importStrategy` を除くので、試しのときと同じ中身のまま。ログ（`C:\b\p0\data\bp-probe-*\user\user-data\logs\`）は消していない。
- 確かめ: `upstream-default` を1回だけ短く起動した（`p0-launch.ps1 -Name upstream-default -NoWorkspace -ExtraArgs C:/b/p0/scratch/sample.py -SmokeSeconds 30`、07:37 JST。pid 44192 の木 12 プロセスを生存の確認の後に止めた）。
  - `exthost.log`: `07:37:15.437 [info] ExtensionService#_doActivateExtension detachhead.basedpyright, startup: false, activationEvent: 'onLanguage:python'`、`07:37:16.250 [warning] DiagnosticCollection with name 'basedpyright' does already exist.`。`[error]` の行は1つも無い。
  - `detachhead.basedpyright\basedpyright.log`: `07:37:15.688 [info] basedpyright language server 1.40.2 starting`、`Python extension not found`（2回）、`Assuming Python version 3.14.7.final.0`。
  - その後、計測のひな形に初回の起動の名残（キャッシュ、`argv.json` に足される2項目）を残さないため、`upstream-default` をもう一度作り直した（07:38 JST ごろ）。そのため上のログはデータの場所から消えている。上の行は消える前に読んで写したもの。
- 手の確かめの環境（`upstream-ai-disabled`・`testbed`・`testbed-dotenv-a/b`・`langpack-*`・`ext-allowed`・`mydist`）は起動も作り直しもしていない。`p0-env.ps1 -All` は走らせていない。
  - ただし `mydist` の環境は `extensions-src\mydist` を直に読むので、次に起動したときから `basedpyright.importStrategy` の既定が入る（0-9 の手順の5項目の確かめには影響しない）。

## 7. 試しの後始末と残したもの

- `C:\b\p0\data\bp-probe-a`〜`d` は残した（ログを読むため）。`scripts/lib/p0-common.ps1` の環境の一覧に `bp-probe-a`〜`d` を足した。`p0-env.ps1 -All` の対象からは外してある（6節）。
- 起動したのは自分の4回（a は2回。1回目はファイルの場所の指定を誤った）だけで、毎回、起動した PID の木だけを止めた。scratch のファイルは変えていない。
- 新しく足した台本: `scripts/p0-openvsx-meta.mjs`（Open VSX のメタデータと manifest を取る。VSIX は取らない）、`scripts/p0-lsp-probe.mjs`（言語サーバーを LSP で直に動かして診断を取る。ファイルは読むだけ）。

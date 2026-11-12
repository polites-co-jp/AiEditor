# Phase 0 の試験環境（作り方・中身・起動のしかた）

- 作成: 蒙恬（2026-11-13）
- 台本: `scripts/p0-env.ps1`（作る・作り直す）、`scripts/p0-launch.ps1`（起動する）、`scripts/p0-stop.ps1`（止める）、`scripts/p0-ws.ps1`（計測用のワークスペースの準備と確かめ）、`scripts/p0-scratch.ps1`（手の確かめ用の使い捨てのフォルダ）、`scripts/p0-ext-allowed.ps1`（0-8 の自動の部分）、共通の部品 `scripts/lib/p0-common.ps1`、構文の検査 `scripts/p0-check-ps.ps1`
- どれも Windows PowerShell 5.1 で動く（PowerShell 7 はまだ入っていない）。5.1 は BOM の無い台本を ANSI で読むので、台本は ASCII だけで書いた。

## 1. 使い方

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -List                 # 環境の一覧
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name <名前>          # 1つ作る（作り直す）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -All                  # 全部作る
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name testbed -RebuildTestbed   # 試験台の写しも作り直す
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -PlanTestbed          # 試験台で消すフォルダを表示するだけ
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name <名前>       # 起動（tmp\ws を開く）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name <名前> -PrintOnly   # 起動のコマンドを表示するだけ
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name <名前> -NoWorkspace -SmokeSeconds 20   # 起動して生きているかを見て、その木だけを止める（台本の確かめ用）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-stop.ps1 -Name <名前>        # その環境のエディタだけを止める
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1                   # 使い捨てのフォルダ C:\b\p0\scratch を作り直す
```

コマンドはどれもリポジトリの直下（`E:\develop\self\Team\projects\ai-editor`）で、自分の端末から走らせる（5.1）。

`p0-launch.ps1` は、子のプロセスから `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外し、`VSCODE_PORTABLE` だけを設定して起動する（`scripts/measure.ps1` の `Start-EditorProcess` と同じ形）。起動の8秒後にプロセスが生きているかを見て、終わっていれば `FAILED` と終了コードを出して失敗する（同じ環境のエディタがすでに動いていて引き継いだときは、そう表示して成功）。CLI で拡張を入れるとき（`Invoke-P0Cli`）も `VSCODE_*` を外す。

`p0-env.ps1` の手順（1つの環境）:

1. 本体を決める。本家は `C:\b\p0\vscode-1.146.0\`。試験台は `C:\b\p0\testbed\`（3節）。
2. 入れる VSIX を全部先に探す（`C:\b\p0\vsix\<id>-<版>[@<target>]\`、Sublime は `C:\b\p0\sublime\`。台帳 `extensions.lock.json` があればその版、言語パックは 1.131.0）。見つからなければ何も消さずに止まる。
3. その環境のデータを使っているエディタがあれば止まる。無ければ `C:\b\p0\data\<名前>\` を消して作り直す。
4. `user\argv.json` を書く。
5. 拡張を CLI で入れる: `<bin\code.cmd か codium.cmd> --user-data-dir <data>\user\user-data --extensions-dir <data>\ext --install-extension <vsix> --force`（環境変数 `VSCODE_PORTABLE=<data>\user`）。言語パックを先に入れる。
6. ユーザー設定 `user\user-data\User\settings.json` を書く（拡張を入れた後。0-8 の (c) のため）。
7. `--list-extensions --show-versions` を記録し、`p0-env.json` と `p0-install.log` を書く。

何度走らせても同じ状態になる（データは毎回消して作る。試験台の写しは、元と消したフォルダの一覧が記録と合えば使い回し、合わなければ作り直す）。

## 2. データの置き場所と `VSCODE_PORTABLE`

| 場所 | 中身 |
|---|---|
| `C:\b\p0\data\<名前>\user\` | `VSCODE_PORTABLE` が指す。`argv.json` |
| `C:\b\p0\data\<名前>\user\user-data\` | ユーザーのデータ。設定は `User\settings.json` |
| `C:\b\p0\data\<名前>\ext\` | 拡張（`--extensions-dir`） |
| `C:\b\p0\data\<名前>\p0-env.json` | 作った中身の記録（本体の場所・版、データの場所、設定、`argv.json`、入れた拡張と SHA-256、CLI の出力、試験台の記録）。`p0-launch.ps1` が読む |
| `C:\b\p0\data\<名前>\p0-install.log` | CLI の出力 |

`--user-data-dir` だけで分けると、`argv.json` は普段使いの `%USERPROFILE%\.vscode\argv.json`（VSCodium は `.vscode-oss`）が読まれ、無ければ作られる。そのため `VSCODE_PORTABLE` を使う。ポータブルの状態では、ユーザーのデータの場所は `--user-data-dir` より `<VSCODE_PORTABLE>\user-data` が優先されるので、`--user-data-dir` にも同じ場所を渡している。出典と docs の直し方は `doc-corrections.md` の1節。

**計測の台本への影響**: 曹参の `measure.ps1`・`netaudit.ps1` も、起動の前に `VSCODE_PORTABLE=<写した先>\user` を設定する必要がある（`doc-corrections.md` の1節）。2026-11-13 05:40 JST の時点で、`measure.ps1` にはこの対応（`user\user-data` を使い、子のプロセスにだけ `VSCODE_PORTABLE` を渡す）が入っていた。

## 3. 試験台（`C:\b\p0\testbed\`）

- 元: VSCodium 1.143.17232（`C:\b\p0\vscodium-1.143.17232\`、commit `c072cf642cbbadabefa22f39c58cc902a8b7427f`）を robocopy `/MIR` で写す。
- docs/03 の4節の段階 A のフォルダを `resources\app\extensions\` から消す。product.json（`builtInExtensions` など）はそのまま（docs/07 の2.4 はフォルダを消すことだけを求めている）。
- 記録: `C:\b\p0\testbed\p0-testbed.json`（元、版、消したもの、飛ばしたもの、残ったフォルダ）。

### 消した組み込み拡張（29 フォルダ。2026-11-13 05:25 JST）

| 単位 | 消したフォルダ |
|---|---|
| A-2-accounts-extensions | `github`、`github-authentication`、`microsoft-authentication` |
| A-3-debug-extensions | `ms-vscode.js-debug`、`ms-vscode.js-debug-companion`、`ms-vscode.vscode-js-profile-table`、`debug-auto-launch`、`debug-server-ready` |
| A-4-notebook-extensions | `ipynb`、`notebook-renderers` |
| A-5-remote-extensions | `tunnel-forwarding` |
| A-6-themes | `theme-abyss`、`theme-kimbie-dark`、`theme-modern-icons`、`theme-monokai`、`theme-monokai-dimmed`、`theme-quietlight`、`theme-red`、`theme-solarized-dark`、`theme-solarized-light`、`theme-tomorrow-night-blue`（`theme-defaults`・`theme-seti` は残す） |
| A-7-unused-extensions | `grunt`、`gulp`、`jake`、`simple-browser`、`mermaid-markdown-features`、`extension-editing`、`terminal-suggest`、`php-language-features` |

- 飛ばしたもの（VSCodium に無い）: A-1 の `copilot`。
- 組み込み拡張のフォルダは 95 → 66。

## 4. 環境ごとの中身（2026-11-13 に全部を作った）

10 個とも、拡張の導入はすべて終了コード 0。`--list-extensions --show-versions` の結果が下の「拡張」の列。

| 名前 | 本体 | 拡張 | ユーザー設定 | `argv.json` | その他 | 使い道 |
|---|---|---|---|---|---|---|
| `upstream-default` | 本家 1.146.0 | 台帳の9件全部（.env は2つとも） | `{"task.allowAutomaticTasks": "on", "security.workspace.trust.enabled": false}` | `{"locale": "ja"}` | — | 0-4 の基準（計測） |
| `upstream-ai-disabled` | 本家 1.146.0 | `anthropic.claude-code@2.1.322` | `{"chat.disableAIFeatures": true}` | 設定なし | — | 0-2 |
| `testbed` | 試験台（VSCodium 1.143.17232 − 段階 A） | 台帳から .env の2件を除いた7件 | `{}` | `{"locale": "ja"}` | — | 0-3（base・claude-code・languages の .env 以外） |
| `testbed-dotenv-a` | 試験台 | 7件 + `dotenv.dotenv-vscode@1.5.8` | `{}` | `{"locale": "ja"}` | — | 0-3 の .env（A） |
| `testbed-dotenv-b` | 試験台 | 7件 + `weixu.wx-vsce-dotenv@0.2.3` | `{}` | `{"locale": "ja"}` | — | 0-3 の .env（B） |
| `testbed-measure` | 試験台 | 台帳の9件全部 | 計測の設定（`upstream-default` と同じ） | `{"locale": "ja"}` | — | 0-4 の参考（合否に使わない） |
| `langpack-upstream` | 本家 1.146.0 | `ms-ceintl.vscode-language-pack-ja@1.131.0`、`anthropic.claude-code@2.1.322` | `{}` | `{"locale": "ja"}` | — | 0-7 |
| `langpack-testbed` | 試験台 | 同上 | `{}` | `{"locale": "ja"}` | — | 0-7 |
| `ext-allowed` | 本家 1.146.0 | `anthropic.claude-code@2.1.322`、`mechatroner.rainbow-csv@3.24.1`（設定より前に入れた） | `{"extensions.allowed": {"*": false, "anthropic.claude-code": true}}` | 設定なし | — | 0-8 |
| `mydist` | 本家 1.146.0 | `anthropic.claude-code@2.1.322`、`ms-vscode.sublime-keybindings@4.1.10`（台帳に無い拡張。`extensions.allowed` の既定が効くかを見るため） | `{}` | 設定なし | 起動に `--extensionDevelopmentPath=<リポジトリ>\extensions-src\mydist` | 0-9 |

`argv.json` の「設定なし」は、中身がコメントの行だけの `{ … }`。どの環境も、末尾を改行と `}` で終える形で書く（エディタが初めての起動で `enable-crash-reporter` と `crash-reporter-id` を足すときに、末尾の2文字を切ってつなぐため。`doc-corrections.md` の7節）。この直しのため、2026-11-13 06:00 JST ごろに 10 の環境を作り直した（中身は上の表のまま）。

台帳の9件と版: `ms-ceintl.vscode-language-pack-ja@1.131.0`、`anthropic.claude-code@2.1.322`（win32-x64）、`detachhead.basedpyright@1.40.2`、`ms-vscode.powershell@2025.4.0`、`mads-hartmann.bash-ide-vscode@1.43.2`、`mechatroner.rainbow-csv@3.24.1`、`dotenv.dotenv-vscode@1.5.8`、`weixu.wx-vsce-dotenv@0.2.3`、`tomoki1207.pdf@1.2.2`。VSIX は別の蒙恬が `C:\b\p0\vsix\` に取ったもの（SHA-256 は各環境の `p0-env.json` の `extensions[].sha256`）。

決めたこと:

- 計測の2つの環境は、台帳の9件を全部入れた（.env は0-3 で1つに決まるまで2つとも。本家と自作で同じ組にすれば比べられる）。0-3 で決まったら `scripts/lib/p0-common.ps1` の `$P0LedgerIds` から1行消す。
- 計測の設定に `security.workspace.trust.enabled: false` を足した。制限モードでは folderOpen のタスクが動かず、信頼の確認の画面で無人の計測が止まるため（`doc-corrections.md` の5節）。
- 計測の環境と試験台の環境は `argv.json` に `locale: ja` を書いた（台帳に言語パックがあり、自作も日本語で動くため）。0-2（`upstream-ai-disabled`）と 0-8・0-9 の環境は書いていない（英語の表示のまま）。
- 0-2 の環境は手順どおり Claude Code だけ。言語パックは入れていない。

## 5. ユーザーが手で確かめる手順

項目ごとに使う環境と手順:

| 項目 | 環境 | 手順 | 記録の清書の先（大岡越前守） |
|---|---|---|---|
| 0-2 | `upstream-ai-disabled` | 5.3 | `records/phase0/upstream-ai-disabled.md` |
| 0-3 | `testbed`・`testbed-dotenv-a`・`testbed-dotenv-b` | 5.4 | `records/phase0/codeoss-testbed.md` |
| 0-7 | `langpack-upstream`・`langpack-testbed` | 5.5 | `records/phase0/language-pack.md` |
| 0-8 | `ext-allowed` | `extensions-allowed.md` の3節 | `records/phase0/extensions-allowed.md` |
| 0-9 | `mydist` | `configuration-defaults.md` の3節 | `records/phase0/configuration-defaults.md` |

### 5.1 守ること（全部の項目に共通）

- **計測用のワークスペース `tmp\ws` を変えない。** 計測の前提は「コミット `2385a2ff…` のまま、`.vscode/tasks.json` だけを足した状態」（docs/07 の3.1）。`tmp\ws` は開いて見るだけにする（ファイルの表示、診断、検索、ターミナルでの読むだけのコマンドはよい）。
  - 編集・保存・置換・ステージ・コミット・新しいファイルの作成は、**使い捨てのフォルダ `C:\b\p0\scratch\`** で行う。作り直すのは `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1`（git のリポジトリと、言語ごとの見本のファイルを作り、1回コミットしてある。何度でも消して作り直せる）。
  - `tmp\ws` を間違えて変えたときの戻し方は 5.6。
- **起動は自分の端末から。** Windows Terminal などのふつうの PowerShell を開き、そこからコマンドを走らせる。普段使いの VS Code の統合ターミナルや、Claude Code に頼んで走らせない（エディタの変数を引き継ぐと、起動に失敗することがある。`p0-launch.ps1` は変数を外してから起動し、失敗すれば `FAILED` と出す）。
- **作業する場所はリポジトリの直下。** 最初に `cd E:\develop\self\Team\projects\ai-editor`。下のコマンドは、この場所からの相対パスで書いてある。
- **同じ環境を2つ起動しない。** 別々の環境は同時に起動できる。終えたら窓を閉じる。閉じられないときは `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-stop.ps1 -Name <名前>`（その環境のエディタだけを止める。普段使いのエディタには触れない）。
- **ログの場所。** 環境ごとに `C:\b\p0\data\<名前>\user\user-data\logs\<起動の日時>\`。`main.log`（本体）、`window1\exthost\exthost.log`（拡張ホスト）、`window1\renderer.log`（画面）。画面の中からは、`Output` パネルの右上の選択で `Extension Host` を選ぶと同じものが見える。
- **本家の zip を起動したあとは、普段使いの VS Code を起動し直す。** 本家の zip が `vscode://` のリンクの受け手を自分に登録し直すおそれがある（大岡越前守の指摘。推定、未確認）。
- 記録は、項目ごとに1つの .md（例 `tasks/2026-11-13-p0-envs-mydist-keys/hand-0-2.md`）に、下の「記録すること」をそのまま表にして書く。画面の写しは同じディレクトリに置く。

### 5.2 準備（最初に1回）

1. **前提の道具を確かめる**（0-3 の languages の組で使う。裁定 2026-11-13 で、PowerShell 7 と ShellCheck はユーザーが winget で入れた）
   - すること: 自分の端末で `pwsh --version`、`shellcheck --version`、`python --version`（無ければ `py --version`）、`git --version`
   - 見る場所: 端末の出力。入っている場所は `where.exe pwsh shellcheck python` で見る（pwsh は `%LOCALAPPDATA%\Microsoft\WindowsApps\`、shellcheck は `%LOCALAPPDATA%\Microsoft\WinGet\Links\` に入った）
   - 記録すること: それぞれの版と場所。Python が無ければ「無し」（0-3 の basedpyright は Python 本体なしでも動くかを見る項目があるので、無いこと自体が記録になる）
2. **ワークスペースが計測の前提のままかを確かめる**
   - すること: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1`
   - 見る場所: 端末の `commit :` の行と、警告の有無。`C:\b\p0\ws-info.json` の `commit` と `dirtyExceptTasks`
   - 記録すること: `commit` が `2385a2ff1ea22ceaa5a039500f3f88361eef2392` で、`dirtyExceptTasks` が空（`[]`）であること
3. **使い捨てのフォルダを作る**
   - すること: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1`
   - 見る場所: 端末の `scratch: C:\b\p0\scratch (git commit ...)` の行
   - 記録すること: 無し（中身は `scripts/p0-scratch.ps1` の先頭の説明のとおり）

### 5.3 0-2 本家で AI を止めて Claude Code を使う（docs/07 の2.3）

環境 `upstream-ai-disabled`（本家 1.146.0、`chat.disableAIFeatures: true`、Claude Code 2.1.322 だけ。表示は英語）。

1. **起動する**
   - すること: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name upstream-ai-disabled`
   - 見る場所: 端末の `OK: pid ... is alive`。窓に `tmp\ws` が開き、「Do you trust the authors…」の確認が出る
   - 記録すること: pid。信頼の確認が出たか
2. **信頼する**（docs/07 の2.3 の3）
   - すること: 信頼の確認で `Yes, I trust the authors` を選ぶ。フォルダを開いたときのタスクの確認が出たら `Allow` を選ぶ
   - 見る場所: 窓の下のステータスバーの「Restricted Mode」の表示が消えるか。ターミナルのパネルに `p0-open-terminal` が開くか
   - 記録すること: 制限モードから信頼へ移れたか。タスクのターミナルが開いたか
3. **base の組**（docs/06 の5節。`tmp\ws` は見るだけ、変更は `C:\b\p0\scratch\`）
   - すること:
     - `tmp\ws` で: コマンドパレット（Ctrl+Shift+P）、エディタの分割（Ctrl+\）、2つめの窓（Ctrl+Shift+N）、ミニマップの表示、全文検索（Ctrl+Shift+F。置換はしない）、問題パネル（Ctrl+Shift+M）、ターミナル（Ctrl+@）で `git log --oneline -1` を実行
     - `C:\b\p0\scratch\` を別の窓で開いて（`File > Open Folder...`）: `notes.txt` を編集して保存、置換（Ctrl+H）、差分ビュー（ソース管理のビューで変更をクリック）、ステージとコミット、タスクの実行（`Terminal > Run Task...` で `p0-scratch-echo` を選ぶ。ターミナルに `p0-scratch-task-ok` と出れば成功。scratch の `.vscode\tasks.json` は `scripts/p0-scratch.ps1` が作る。`tmp\ws` の folderOpen のタスク `p0-open-terminal` はこの確かめに使わない）、`README.md` のプレビュー（Ctrl+Shift+V）、`image.png` のプレビュー、タイムライン（エクスプローラーの下）、スニペット、整形（Shift+Alt+F）
   - 見る場所: それぞれの画面。Help → Toggle Developer Tools の Console
   - 記録すること: 項目ごとに「できた / できない」。できないものは画面の表示と Console の赤い行。画像のプレビューを何が受け持っているか（本家 1.146.0 には組み込み拡張 `media-preview` が無い。`doc-corrections.md` の3節）
4. **claude-code の組**（docs/06 の5節。拡張の表示場所も見る）
   - すること:
     - アクティビティバーとセカンダリサイドバーに Claude Code のアイコンやパネルが出るかを見る
     - コマンドパレットの `Developer: Show Running Extensions` に Claude Code があるかを見る
     - `%USERPROFILE%\.claude\ide\` に `<番号>.lock` ができるかを見る（エクスプローラーで開く）
     - パネルを開き、1文を送り、応答が返るかを見る
     - `C:\b\p0\scratch\` の窓の統合ターミナルで `claude` を起動し、IDE に接続するか（`/ide`）、選択範囲が共有されるか、差分が差分ビューで開き採否できるかを見る。Claude に頼む変更は scratch のファイルにする（例「`notes.txt` の1行目を書き換えて」）。`tmp\ws` の窓のターミナルで `claude` に変更を頼まない
     - 問題パネルに `C:\b\p0\scratch\sample.ts` の誤りが出ている状態で、Claude に診断（`mcp__ide__getDiagnostics`）を求める
   - 見る場所: 画面、`.lock` のフォルダ、`Output` パネルの `Extension Host` と `Claude Code`
   - 記録すること: 項目ごとに「できた / できない」。拡張ホストのログのエラーの行（`[error]`）を写す
5. **終える**
   - すること: 全部の窓を閉じる。5.6 の確かめを行う
   - 記録すること: `C:\b\p0\data\upstream-ai-disabled\user\user-data\logs\` の一番新しいフォルダの名前（ログを清書に添えるため）

### 5.4 0-3 試験台で組み込み拡張を消して使う（docs/07 の2.4）

環境 `testbed`（.env の拡張なし）、`testbed-dotenv-a`（`dotenv.dotenv-vscode`）、`testbed-dotenv-b`（`weixu.wx-vsce-dotenv`）。どれも VSCodium 1.143.17232 から段階 A の 29 フォルダを消したもの（3節）。表示は日本語。

1. **起動する**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name testbed`。見る場所と記録することは 5.3 の1と同じ。
2. **信頼する**: 5.3 の2と同じ。
3. **起動の警告とエラー**
   - すること: Help → Toggle Developer Tools の Console と、`出力` パネルの `拡張機能ホスト` を開く
   - 見る場所: Console の赤と黄の行。拡張ホストのログ。`C:\b\p0\data\testbed\user\user-data\logs\<日時>\main.log`
   - 記録すること: 拡張のフォルダを消したことによる警告とエラー。「提案中の API の許可が要る」（proposed API）という誤りの有無。Claude Code の `walkthroughs` など、受け手の無い宣言についての警告の有無
4. **base と claude-code の組**: 5.3 の3・4と同じ（変更は `C:\b\p0\scratch\` で）。
5. **languages の組**（`C:\b\p0\scratch\` を開いて行う）
   - すること: 見本のファイルを1つずつ開く。`sample.ts`（TS の型の誤り）、`sample.py`（basedpyright）、`sample.html`・`sample.css`・`sample.json`（補完と誤り）、`sample.csv`（列の数の違い）、`sample.sh`（ShellCheck の警告 SC2086）、`sample.ps1`（PowerShell 7 のセッションと警告）
   - 見る場所: 問題パネル（Ctrl+Shift+M）、エディタの波線、補完の候補（Ctrl+Space）、ステータスバーの PowerShell の版
   - 記録すること: 言語ごとに「補完が出た / 出ない」「診断が出た / 出ない（出た内容）」。PowerShell のセッションの版（7 系か）
   - basedpyright: Python 本体が無い状態で診断が出るか。続けて、設定（Ctrl+,）で `python.pythonPath`（basedpyright では `python.defaultInterpreterPath` のこともある。設定の画面で検索して出る方）に Python の場所（5.2 の1で記録した場所）を入れ、診断が出るか。設定を変えた後は、この環境を作り直す（`scripts/p0-env.ps1 -Name testbed`）
6. **.env の比較**（`testbed-dotenv-a` と `testbed-dotenv-b` で同じことをする）
   - すること: 起動し（`-Name testbed-dotenv-a`、次に `-Name testbed-dotenv-b`）、`C:\b\p0\scratch\.env` を開く。新しい行で `API` と打ち、補完を見る
   - 見る場所: 問題パネル（`THIS LINE HAS NO EQUALS SIGN` の行に誤りが出るか）、補完の候補、色付け
   - 記録すること: 拡張ごとに「補完がある / 無い」「誤りの表示がある / 無い（内容）」。裁定により、誤りの表示を持つほうを台帳に載せる。両方とも持たない、または両方とも持つときは、その結果を添えて諮る
7. **終える**: 窓を閉じ、5.6 を行う。

### 5.5 0-7 言語パックの版のずれ（docs/07 の2.8）

環境 `langpack-upstream`（本家 1.146.0）と `langpack-testbed`（試験台）。どちらも言語パック 1.131.0 と Claude Code、`argv.json` に `"locale": "ja"`。

1. **起動する**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name langpack-upstream`（次に `langpack-testbed`）。信頼の確認は「はい、作成者を信頼します」を選ぶ。
2. **英語のまま残る場所を探す**
   - すること: 設定の画面（Ctrl+,）を上から見る。コマンドパレット（Ctrl+Shift+P）で `>` のあとに何も入れずに一覧を流し見る。上のメニュー（ファイル、編集、選択、表示、移動、実行、ターミナル、ヘルプ）を全部開く。Claude Code のパネルとコマンド（コマンドパレットで `Claude`）
   - 見る場所: それぞれの表示の言語
   - 記録すること: 場所ごとに「日本語 / 一部英語 / 英語」と、英語のまま出た文言の例（3つまで）。日常の操作で目立つと感じた場所には印を付ける（裁定により、目立つ場所があれば一覧を添えて諮る）。本家と試験台の違い
3. **終える**: 窓を閉じる。この項目では `tmp\ws` を変えないので、5.6 は 2 だけでよい。

### 5.6 終わった後の確かめと戻し方

1. **ワークスペースが変わっていないかを確かめる**
   - すること: 全部の窓を閉じてから `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1`
   - 見る場所: 端末の `commit :` の行、`workspace has other changes:` の警告の有無。`C:\b\p0\ws-info.json` の `commit` と `dirtyExceptTasks`
   - 記録すること: `commit` が `2385a2ff1ea22ceaa5a039500f3f88361eef2392` のままで、`dirtyExceptTasks` が `[]` であること
2. **変わっていたときの戻し方**（`tmp\ws` の中で、自分が変えたものだけを戻す。`.vscode\tasks.json` は残す）
   - 変更したファイルを戻す: `git -C tmp\ws restore -- <ファイル>`（`dirtyExceptTasks` に ` M ` で出たもの）
   - ステージしたものを戻す: `git -C tmp\ws restore --staged -- <ファイル>` の後に上の行
   - 作ってしまったファイルを消す: `dirtyExceptTasks` に `?? ` で出たものを、エクスプローラーで消す（`.vscode\tasks.json` は消さない）
   - コミットしてしまったとき: `git -C tmp\ws reset --hard 2385a2ff1ea22ceaa5a039500f3f88361eef2392`（`.vscode\tasks.json` は追跡されていないので残る）
   - 戻したら 1 をもう一度行う。
3. **使い捨てのフォルダを作り直す**（次の確かめの前）: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1`
4. **環境を作り直す**（設定を変えたときだけ）: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name <名前>`

## 6. 計測用のワークスペース

- ユーザーが kuebiko を GitHub（https://github.com/polites-co-jp/kuebiko.git の `main`、commit `2385a2ff1ea22ceaa5a039500f3f88361eef2392`）から、このリポジトリの `tmp\ws\` に clone した（`.gitignore` に `tmp/` を足した）。裁定（2026-11-13）の文言は「`E:\develop\kuebiko` を clone する」だが、実際の出どころは GitHub（`.git/config` の origin と、大岡越前守の確かめ）。

### 決まったもの（2026-11-13 05:37 JST、`scripts/p0-ws.ps1` を走らせた結果。記録 `C:\b\p0\ws-info.json`）

| 項目 | 値 |
|---|---|
| 場所 | `<リポジトリ>\tmp\ws\`（`E:\develop\self\Team\projects\ai-editor\tmp\ws`） |
| 元 | https://github.com/polites-co-jp/kuebiko.git の `main` |
| コミット | `2385a2ff1ea22ceaa5a039500f3f88361eef2392` |
| 作業ツリーの変更 | 足した `.vscode/tasks.json` のほかは無し |
| `.vscode/` | kuebiko には元々 `.vscode/` が無かった。足したのは `.vscode/tasks.json` だけ（中身は `ws-tasks.json`） |
| 開く TS のファイル | `apps/api/src/routes/extraction.ts`（92,532 バイト。Hono の API のルート。`apps/api/tsconfig.json` の `include: src/**/*` に入る） |
| 開く Python のファイル | `local-apps/topic-clusterer/topic_clusterer/labeling.py`（20,455 バイト。`topic-clusterer` パッケージ（`pyproject.toml`、Python 3.11 以上）のラベル生成のモジュール） |

- どちらも生成物ではない、手で書かれた実際のコード（冒頭を見て確かめた）。TS の候補の2位はテストファイル（`jobs.test.ts`）、Python の2〜5位は `.claude/skills` の台本や小さいモジュールだったので、1位をそのまま採った。
- clone には `node_modules` も Python の依存も入っていない。TS の import の解決や、basedpyright の外部パッケージの解決は失敗し、その分の診断が出る見込み（推定）。本家と自作で同じ条件なので計測の比べには影響しないが、0-2・0-3 の languages の組で「診断が出る」を見るときは、この前提で読む。依存を入れるかは決めていない（入れるならワークスペースに `node_modules` などが増え、「tasks.json だけを足す」から外れる）。
- 注意: このリポジトリは `tmp/` を `.gitignore` に入れたので、Glob・Grep（ripgrep）は `tmp\ws` の中を返さない（Read は読める）。中を探すときは、パスを指定して Read するか、`git -C tmp\ws ls-files` などを使う。
- 計測の台本の既定: `scripts/measure.ps1`・`scripts/netaudit.ps1` の `-Workspace` の既定は、曹参がすでに `<リポジトリ>\tmp\ws` に直していた（`Join-Path (Split-Path $PSScriptRoot -Parent) 'tmp\ws'`）。`VSCODE_PORTABLE` の対応も入っていた。`p0-launch.ps1` の既定も `tmp\ws`（`-PrintOnly` で確かめた）。

### `scripts/p0-ws.ps1` がすること

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1` を走らせると、次を行う。何度走らせても同じ（自分の tasks.json があればそのまま）。
  - `git rev-parse HEAD` のコミット、ブランチ、origin、作業ツリーの変更の有無を記録する。
  - `tmp\ws\.vscode\tasks.json` を足す（中身はこのディレクトリの `ws-tasks.json` と同じ。ラベル `p0-open-terminal`、`powershell.exe -NoLogo -NoProfile` を開いたままにするタスク、`"runOptions": {"runOn": "folderOpen"}`）。すでに自分のもの以外の tasks.json があれば触らずに止まる（終了コード 3）。
  - 開く2つのファイルを選ぶ: 追跡されているファイルのうち、100 KB 以下で最も大きい `.ts`/`.tsx`（`.d.ts` を除く）と `.py`（`__init__.py` を除く）。`node_modules`・`dist`・`build`・`out`・`vendor`・`venv` の下は除く。`-TsFile`・`-PyFile` で指定もできる。候補の上位5件も記録する。
  - 結果を `C:\b\p0\ws-info.json` に書く（ワークスペースの外）。

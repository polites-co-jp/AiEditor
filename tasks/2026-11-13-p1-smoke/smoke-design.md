# スモークテストの設計（Phase 1）

担当: 曹参。依頼: `tasks/2026-11-13-p1-smoke/brief.md`。計測と通信の監査はやめた（裁定 2026-11-13）ので、この台本が「壊れていない」（docs/03 の7節の4）の柱になる。

## 1. 本家の `test/smoke` を `--build` で向けられるか

### 結論

**Windows の公式 zip・自作のビルドに `--build` で向けること自体はできる。しかし、本家の試験をそのまま「壊れていない」の判定には使えない。使わない。** 起動・ログの検査と、エディタの中から API で確かめる自前の台本（`tests/smoke/`）にした。本家の試験は、ビルドが固まった後に「参考として手で1回走らせる」位置づけに留める（走らせる場合の前提は 1.4）。

### 1.1 向けられる根拠（出典つき）

| 事実 | 出典 |
|---|---|
| `--build <path>` で、インストール済みの製品を相手にした Electron の試験になる。例は macOS だけで、Windows の例は README に無い | `test/smoke/README.md` タグ 1.146.0。https://raw.githubusercontent.com/microsoft/vscode/1.146.0/test/smoke/README.md |
| `main.ts` は `--build` があれば `getBuildElectronPath(path)` で実行ファイルを決め、無ければ開発用の Electron（`.build/electron`）を使う。存在しなければ "Cannot find VSCode at ..." で止まる | `test/smoke/src/main.ts`。https://raw.githubusercontent.com/microsoft/vscode/1.146.0/test/smoke/src/main.ts |
| Windows の実行ファイルは `join(root, product.nameShort + '.exe')`。`product.json` は `root` の直下、または 1 段下のフォルダ（`<commit10>\resources\app`）から探す。**公式 zip の版つき配置（`Code.exe` はルート、`product.json` は `69047191fc\resources\app`）はこの作りに合う**（実機で確かめた配置と一致: `C:\b\p0\vscode-1.146.0\`） | `test/automation/src/electron.ts`。https://raw.githubusercontent.com/microsoft/vscode/1.146.0/test/automation/src/electron.ts |
| 起動は Playwright の `_electron.launch({ executablePath, args })`。引数に `--enable-smoke-test-driver` を足す。`--user-data-dir`・`--extensions-dir`・`--logsPath` などは試験側が決めて渡す | `test/automation/src/playwrightElectron.ts`。https://raw.githubusercontent.com/microsoft/vscode/1.146.0/test/automation/src/playwrightElectron.ts |

### 1.2 そのまま使えない理由

1. **ソースのビルドが要る。** `pnpm install && pnpm run compile`（ルート）と、`test/automation`・`test/smoke` それぞれの compile が要る（`test/smoke/package.json` の `compile`）。依存に Playwright（`@playwright/test`）、ネイティブの `@vscode/sqlite3`・`kerberos`・`ssh2` がある。蒙恬が作業ツリー `C:\b\wt\1.146.0` をビルドしている途中のため、今回は触らなかった（調べた時点でそのフォルダはまだ無かった）。
2. **試験が本家の設定の前提に結びついている。** 試すワークスペースは GitHub の `microsoft/vscode-smoketest-express`（`--test-repo` で手元のコピーに替えられる）で、検索の試験は「`body` が 6 件・3 ファイル」「`*.js` で 4 件・1 ファイル」、クイックオープンは「`.js` で 8 件」といった**固定の件数と固定のファイル名**を比べる（`areas/search/search.test.ts`）。言語の試験は `bin/www`・`public/stylesheets/style.css` を開く（`areas/languages/languages.test.ts`）。本家の構成を前提にした期待値で、我々の「削る」ビルドや台帳の拡張が入った状態の判定には向かない。
3. **削る機能の試験が混じる。** 領域には `chat`・`agentsWindow`・`notebook`・`accessibility`・`policy`・`browserView` がある（`test/smoke/src/areas/` の一覧）。docs/03 で消す機能の試験は、消した後に落ちるのが正しい。「壊れていない」の判定に混ぜると、削除の成否と区別できない。
4. **普段使いのデータに触れうる。** 試験は `VSCODE_PORTABLE` を使わない。`argv.json` は普段使いの `%USERPROFILE%\.vscode\argv.json` が読まれ、無ければ作られる（docs/07 の3.2 の1、Phase 0 で確認済み）。環境変数をそろえるにはこちらで包む必要がある。また親の環境から `ELECTRON_RUN_AS_NODE`・`VSCODE_*` を外す処理が無い（`electron.ts` は `process.env` のコピーを渡す）。
5. **ネットワークと時間。** 既定は GitHub からの clone と、移行試験用の古い安定版のダウンロード（`--skip-stable-build` で省ける）を行う。Claude Code 拡張（`onStartupFinished` で起動）は台帳の拡張で、試験のページオブジェクトが知らない。

### 1.3 docs/06 の5節との対応（本家の試験 → 我々の項目）

本家の試験を使わないが、「どの項目をどの試験が覆うか」を残す。本家の領域は `test/smoke/src/areas/` のフォルダ名（タグ 1.146.0）。

| docs/06 の5節の項目 | 本家の領域（参考） | 我々の台本での確かめ（id） |
|---|---|---|
| base: 起動する | `workbench/launch.test.ts`（非 ASCII のユーザーデータでの起動） | base.launch、base.window1 |
| base: 開発者ツールのコンソール・拡張ホストのログにエラーが無い | なし（本家の試験にログの検査は無い） | errors.*、errors.new（前の版との比べ） |
| base: フォルダを開く、編集して保存、コマンドパレット、分割、2つめのウィンドウ、ミニマップ | `workbench/`（data-loss）、`multiroot`、`statusbar`、`preferences` | base.open-folder、base.edit-save、base.palette、base.split、base.window2、base.minimap |
| base: ターミナル | `terminal/*` | base.terminal |
| base: 全文検索と置換、差分、git、問題パネル、タスク | `search/search.test.ts`、`task/*`（git、差分は別の領域に分散） | base.search、base.ripgrep、base.diff、base.git、base.problems、base.task |
| base: Markdown・画像・PDF のプレビュー、タイムライン・ローカル履歴、スニペット、整形 | なし（本家の試験に該当が薄い） | base.markdown-preview、base.image-preview、base.pdf-preview、base.timeline-localhistory、base.localhistory、base.snippet、base.format |
| claude-code: 動作中の拡張、`.lock` | なし（台帳の拡張なので本家の試験の外） | claude.running、claude.exthost-log、claude.lock |
| languages: TS、Python、HTML/CSS/JSON、CSV、.env、sh、PowerShell | `languages/languages.test.ts`（CSS だけ） | lang.* |
| absence: 単位の `checks` | なし | Phase 2 で `tests/removals/` に作る（本台本の `commands.json` を使える） |

### 1.4 それでも本家の試験を走らせたいとき

蒙恬のビルドが終わった後に、ユーザーの判断で手で1回だけ走らせる位置づけ。

- 前提: `C:\b\wt\1.146.0` で `pnpm install`・`pnpm run compile`、`test/automation` と `test/smoke` の compile が済んでいること。
- 例: `pnpm --dir C:/b/wt/1.146.0 run smoketest`（権限の許可にある形）に、`--build <出力フォルダ> --test-repo <手元の vscode-smoketest-express> --skip-stable-build` を付ける。
- 事前に `ELECTRON_RUN_AS_NODE`・`VSCODE_*` を外した環境で、`VSCODE_PORTABLE` を空のフォルダに向けておく（普段使いの `argv.json` を作らせないため）。
- 落ちるのは正常な項目が混じる（chat・notebook など消す機能）。判定には使わず、参考にする。

## 2. 台本の設計（自前）

### 2.1 方針

画面の描画は見ない。次の3方向で確かめる。

1. **外から**: 起動した `Code.exe` のプロセスの木、ログ（`--logsPath`）、Chromium のログ（`--enable-logging=file`。開発者ツールのコンソールの記録に当たる）、`~/.claude/ide/*.lock`。
2. **中から**: 試験専用の拡張 `tests/smoke/probe/`（`--extensionDevelopmentPath` で読み込む。配らない）が、拡張ホストの中から API で確かめて JSON に書く。動作中の拡張、診断、補完、タブの種類、保存、ターミナル、タスク、git。
3. **手**: 画面を見ないと分からない項目は `manual-checks.md` に回す。

### 2.2 構成

| パス | 役目 |
|---|---|
| `tests/smoke-run.mjs` | 入口（自動のスモーク）。終了コード 0 = FAIL なし / 1 = FAIL あり / 2 = 台本の誤り |
| `tests/smoke-launch.mjs` | 手の確認用に、同じ環境で起動して手を離す（止めない） |
| `tests/smoke-stop.mjs` | 台本が落ちて残ったエディタの後始末（実行の置き場所の名前を持つ本体の木だけを止める） |
| `tests/smoke.test.mjs` | 台本の部品の単体テスト（46件。エディタは起動しない） |
| `tests/smoke/lib/common.mjs` | 環境変数の掃除、書き込み先の安全、本体の場所、プロセスの木、ログの誤りの抽出と正規化、`.lock` |
| `tests/smoke/lib/env.mjs` | 拡張フォルダの用意（台帳の VSIX を CLI で入れ、使い回す）、argv.json・設定の書き出し |
| `tests/smoke/lib/fixtures.mjs` | 試験用ワークスペース（誤りを含むファイル。git のリポジトリ） |
| `tests/smoke/lib/run.mjs` | 起動 → 待つ → 外から確かめる → 木だけを止める → 後始末 → 結果 |
| `tests/smoke/probe/` | 中から確かめる拡張（`extension.js`、`package.json`） |

実行ごとの置き場所は `C:\b\smoke\runs\<label>-<時刻>\`（`user\`=VSCODE_PORTABLE、`logs\`、`ws\`、`probe-result.json`、`commands.json`、`chromium.log`、`smoke-result.json`・`.md`）。拡張フォルダは `C:\b\smoke\ext\<版>-<label>\`（実行をまたいで使い回す。VSIX かエディタの版が変われば作り直す）。書き込みは `C:\b\smoke\` の外に出ない（`assertSafeWritePath`。普段使いの `%APPDATA%`・`~\.vscode`・`~\.vscode-oss` の下は拒否）。

### 2.3 起動の注意（docs/07 の3.2 の1）の実装

- 子のプロセスの環境から `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外し、`VSCODE_PORTABLE=<実行の user>` だけを足す。`cleanEditorEnv` で行い、単体テストがある。
- 加えて `CLAUDECODE`・`CLAUDE_CODE_ENTRYPOINT`・`CLAUDE_CODE_SSE_PORT`・`CLAUDE_CODE_IDE_*` も外す（Claude Code から起動した場合に、試す相手の拡張の IDE 連携へ漏れないように。docs に無い追加で、蒙恬の `p0-common.ps1` には無い）。
- 台帳の拡張を入れる CLI は `Code.exe <app>\out\cli.js --install-extension` を `ELECTRON_RUN_AS_NODE=1` で呼ぶ（`bin\code.cmd` と同じ。Node の `spawn` は `.cmd` を直接呼べないため）。
- `argv.json` は末尾を `\n}` で終える（`Write-P0Argv` と同じ理由）。
- 止めるのは、起動した PID の木だけ（`taskkill /PID <起動した PID> /T /F`）。止めた後に、木にいた PID が残っていないこと、実行の置き場所の名前を持つ孤児が無いことを確かめる。ほかのエディタは止めない。

### 2.4 モード

- `--mode upstream`（既定）: 本家の zip。`basedpyright.importStrategy: "useBundled"` をユーザー設定に入れる（裁定 2026-11-13）。
- `--mode built`: 自作のビルド。同じ値を**入れない**。`lang.py.importStrategy` が「mydist の既定が効いて useBundled になっている」ことを確かめる。

### 2.5 「前の版に無かったエラー」の比べ方

- `--save-baseline <json>`: 今回の誤りの鍵（出どころの種類 + 時刻・パス・PID などを落とした文面）を書き出す。
- `--baseline <json>`: 鍵に無い誤りがあれば `errors.new` が FAIL。
- 誤りの出どころ: `main.log`・`renderer.log`・`exthost.log`・`sharedprocess.log` などの `[error]` 行、Chromium のログの `ERROR`（`CONSOLE` は開発者ツールのコンソール）。「拡張ホストのログ」は `exthost` 種類、「開発者ツールのコンソール」は `devtools-console` と `renderer` の2か所を見る（VS Code は console.error を `renderer.log` にも写す）。

## 3. 台本の項目一覧

結果は PASS / FAIL / SKIP（環境の都合で見られない）/ INFO（数えるだけ）。

### base

| id | 確かめること | 方法 |
|---|---|---|
| base.launch | 起動し、probe が完了する | 外 + probe |
| base.ext-install | 台帳の拡張が入る | CLI の出力 |
| base.open-folder | フォルダが開く | probe（`workspaceFolders`） |
| base.edit-save | 編集して保存。ディスクに反映 | probe |
| base.palette | `workbench.action.showCommands` が実行できる（見え方は手） | probe |
| base.split | エディタ分割でグループが2 | probe（`tabGroups`） |
| base.window1 / base.window2 | ウィンドウのログができる / `newWindow` で `window2` ができる | 外 |
| base.minimap | `editor.minimap.enabled` が true（描画は手） | probe |
| base.terminal | `powershell.exe` のターミナルでコマンドが実行される | probe（ファイルに書かせる） |
| base.search / base.ripgrep | ファイル列挙と検索コマンド / 本体の `rg.exe` が検索語を見つける | probe / 外 |
| base.diff | 差分ビュー（`TabInputTextDiff`） | probe |
| base.git | 変更の表示 → ステージ → コミット | probe（組み込みの git の API） |
| base.task | タスクの実行（終了コード 0） | probe |
| base.markdown-preview / image-preview / pdf-preview | プレビューのタブ（Webview / カスタムエディタ） | probe |
| base.timeline-localhistory / base.localhistory | コマンドが登録済み / 保存した版が `User/History` に残る | probe / 外 |
| base.snippet / base.format | スニペット挿入 / JSON の整形 | probe |
| base.problems | 言語の診断が出そろった後、診断の合計が 0 でない | probe |
| base.logs.files / base.logs.devtools | ログができている / Chromium のログが取れている | 外 |
| errors.* / errors.new | 誤りの一覧 / 前の版との比べ | 外 |
| safety.daily-argv | 普段使いの `argv.json` が前後で同じ | 外 |
| safety.process-tree | 止めた後にプロセスが残らない | 外 |

### claude-code

| id | 確かめること |
|---|---|
| claude.running | `anthropic.claude-code` の `isActive` が、台本が `activate()` せずに自然に true になる |
| claude.exthost-log | `exthost.log` に `_doActivateExtension Anthropic.claude-code` が出る（動作中の拡張の画面と同じ事実の、ログ側の証拠） |
| claude.lock | 起動の前後で `~/.claude/ide/` に増えた `.lock` のうち、起動した木の PID か開いたフォルダに当たるものがある（`authToken` は読んでも記録しない） |

`.lock` の後始末: 自分のものと決めたものだけを消す。普段使いの Claude Code の `.lock`（PID も開いたフォルダも違う）は「他人のもの」として残し、`claude.lock-foreign` に記録する。消さずに残したいときは `--keep-locks`。

### languages

| id | 確かめること |
|---|---|
| lang.ts.diagnostics / lang.ts.completion | tsserver の診断（`ts`）/ `Math.` の補完に `floor` |
| lang.py.importStrategy | `basedpyright.importStrategy` が `useBundled`（`built` では既定値がそうであること） |
| lang.py.diagnostics | basedpyright の診断（型の誤り） |
| lang.html.completion / lang.css.diagnostics / lang.css.completion / lang.json.diagnostics | HTML の `div` 補完 / CSS の `colr` の警告 / `color` の補完 / JSON の末尾カンマ |
| lang.csv.rainbow | Rainbow CSV が動作中で、検査のコマンドが通る（表示は手） |
| lang.env.dotenv | dotenv の拡張が動作中（補完の中身は手） |
| lang.sh.shellcheck | ShellCheck の警告（`shellcheck` が PATH に無ければ SKIP） |
| lang.ps1.session / lang.ps1.pwsh7 | PSScriptAnalyzer の診断 / 木に `pwsh.exe` がある（無ければ INFO） |

### absence（Phase 2 以降）

`probe-result.json` と同じ場所に、登録済みのコマンドの全一覧 `commands.json` が出る。`absentCommands`（コマンドパレットに出ない）の検査は、この一覧に対する確認で足りる。`absentViews`・`absentSettings`・`absentProcesses` は `tests/removals/` で作る（本台本の対象外）。

## 4. 使い方

```
# 公式の zip（既定）
node tests/smoke-run.mjs

# 前の版の誤りを保存 → 次の版と比べる
node tests/smoke-run.mjs --save-baseline C:/b/smoke/baseline-official-1.146.0.json
node tests/smoke-run.mjs --build C:/b/wt/1.146.0/<出力> --label built --mode built --baseline C:/b/smoke/baseline-official-1.146.0.json

# 組を絞る
node tests/smoke-run.mjs --groups base,claude-code

# 手の確認用に起動
node tests/smoke-launch.mjs --build <相手> --label manual --mode upstream

# 単体テスト
node --test tests/smoke.test.mjs
```

- 所要時間: 初回は台帳の拡張を入れるので数分、2回目からは拡張フォルダの使い回しで 2〜3分（下の記録を参照）。
- 蒙恬のビルドの出力フォルダは、`Code.exe` 相当の実行ファイルと `resources\app\product.json` が `--build` の直下（または1段下）にあること。`product.json` に `"target"` があると止まる（ポータブルにできず、普段使いのデータを避けられないため）。

## 5. 公式の zip に向けて通した記録

実行: 2026-11-13、`C:\b\p0\vscode-1.146.0\`（Code 1.146.0 / 69047191fc）、形態 upstream。結果は `C:\b\smoke\runs\official-<時刻>\smoke-result.md`。

### 5.1 結果

| 回 | 置き場所 | 結果 | 備考 |
|---|---|---|---|
| 1 | `official-20261113T123814` | PASS 39 / FAIL 3 / INFO 7 | 台本の誤り3件（ripgrep の場所、ローカル履歴の見方、`.lock` の port 照合）を直した |
| 2 | `official-20261113T124137` | probe が途中で落ちた | 結果ファイルの rename が、台本の読み込みと重なって EPERM。probe の書き出しを作り直した |
| 3 | `official-20261113T124612` | PASS 41 / FAIL 2 | `base.snippet`・`base.format` が、プレビュー直後のフォーカス違いで落ちた（1回目は通っていた）。フォーカスを戻してやり直す形に直した |
| 4 | `official-20261113T124737` | PASS 43 / FAIL 1 | `errors.new` が、強制終了に伴う「Server process exited with code 1」（CSS 言語サーバー）を拾った。止め始めた後の誤りは数えない形に直した |
| **5（確定）** | `official-20261113T124945` | **PASS 43 / FAIL 0 / SKIP 0 / INFO 8** | `--save-baseline` で誤りの鍵を保存 |
| **6（確定）** | `official-20261113T125044` | **PASS 44 / FAIL 0 / SKIP 0 / INFO 9** | `--baseline` で比べ、新しい誤りなし。普段使いの Claude Code の `.lock`（port 47905）が実行中に増え、「他人のもの」として残した |

- 5・6 回目はどちらも 30 項目の probe が最後まで走り、`base`・`claude-code`・`languages` の全項目が PASS。SKIP は無い（`shellcheck` が PATH にあった）。
- 所要時間: 起動から終了まで約 1分半〜2分（拡張フォルダの使い回し時）。初回の拡張のインストールを含めて約 4 分。
- 台帳の拡張: 台帳の9件から `weixu.wx-vsce-dotenv` を除く8件（dotenv の候補の片方は Phase 0 で未決のため）。
- 起動した木: Code.exe 約 30 個 + `copilot-runtime.exe`・`OpenConsole.exe`・`pwsh.exe`・`conhost.exe`（PowerShell 拡張のセッションは PowerShell 7）。全部止まり、残りは 0。
- 普段使いのデータ: `~/.vscode/argv.json`・`~/.vscode-oss/argv.json` は前後で同じ（`safety.daily-argv` PASS）。書き込みは `C:\b\smoke\` の中と、Claude Code 拡張が作る `~/.claude/ide/*.lock`（自分のものだけ消した）。
- 台本の外からの確認: 単体テスト `node --test tests/smoke.test.mjs` は 46 件すべて PASS。

### 5.2 誤りの一覧（本家の zip の基準）

`C:\b\smoke\baseline-official-1.146.0.json` に保存した。種類ごとの件数（5回目）: renderer 56、main 3、exthost 0、sharedprocess 0、開発者ツールのコンソール（Chromium の CONSOLE）0、Chromium 本体 0。止め始めた後の後始末の誤り 14 件は別に数えて除く。

| 種類 | 文面（時刻・パスを除く） | 件数 | 見立て |
|---|---|---|---|
| renderer | `[AgentHostCustomizationMarketplace] Unable to load session-bound SDK installation receipts Could not list installed MCP servers. (refused: policy-context-unavailable)` | 53（5回目）。2つめのウィンドウでも出る | AgentHost（Copilot の実行環境）。削る単位 C 系で消えるはず |
| renderer | `Channel name 'agentHostManagement' timed out after 1000ms` / `[CustomizationMarketplace] Unable to load provider-owned installations Channel name 'agentHostManagement' timed out ...` | 各1 | 同上（AgentHost の起動の競合） |
| renderer | `[Extension Host] (node:…) [DEP0169] DeprecationWarning: url.parse() …` | 1 | 本家・拡張の警告。誤りではないが `[error]` で記録される |
| main | `[AgentHost:stderr] Unknown channel: agentHostManagement` | 3（5回目。6回目は 0） | 同上。起動の競合で出たり出なかったりする。baseline に入れたので、揺れる分は出ない回に「消えた」だけで済む（FAIL しない向き） |

> 注意: 揺れる誤り（上の main の3件、後始末の誤り）があるので、`errors.new` は1回の実行で偶然 FAIL することがある。落ちたら、文面を見て、再実行でも出るか確かめる。基準を複数回の和集合にする案は handoff-notes.md の未解決の点に書いた。
> 実測: 4回目に CSS 言語サーバーの「Server process exited with code 1.」が拡張ホストのログに出て FAIL した。強制終了の後始末だったので、止め始めた後の誤りは除く形に直した（`errors.teardown` に件数と文面を残す）。

## 6. 分かった事実（資料の更新候補）

- **`.lock` はウィンドウごとにできる**。2つめのウィンドウ（`newWindow`）を開く実行では、起動した木に当たる `.lock` が2個できた（ウィンドウ1つなら1個で、port は拡張のログの `MCP Server running on port N` と一致した）。2個とも `pid` は起動したエディタの本体プロセスで、台本は PID と開いたフォルダの両方で「自分のもの」と決める。docs/06 の5節の「`~/.claude/ide/<port>.lock` ができる」は、「ウィンドウごとに1個できる」と読める。
- 台本が作った `.lock` は、エディタを強制終了しても残る（拡張が消す機会を持たない）。台本が自分のものだけ消す。**普段使いの Claude Code の `.lock` を消してよいか**は「消さない」とした（PID も開いたフォルダも違うものは触らない）。台本の外で消してよい基準: 該当 PID がもう生きていない `.lock`（本台本は実行しない）。
- 1.146.0 の ripgrep は `resources\app\node_modules.asar.unpacked\@vscode\ripgrep-universal\bin\win32-x64\rg.exe`（`@vscode\ripgrep\bin` ではない）。`extensions\copilot\...\rg.exe` と `@github\copilot-sdk-win32-x64\...\rg.exe` も別にある（削る単位 A-1 と C 系で消えるもの。台本は `@vscode` の下だけを探す）。
- ローカル履歴は、保存した版の本文が `User\History\<ハッシュ>\<名前>.txt` に書かれるが、`entries.json` は終了時にしか書かれない（強制終了した場合は無い）。台本は本文で見る。
- 本家の zip の起動で、`renderer.log` に `[AgentHostCustomizationMarketplace] Unable to load session-bound SDK installation receipts ...（policy-context-unavailable）` の `[error]` が63回出る（同一の文面）。拡張ホスト・main・sharedprocess・開発者ツールのコンソール（Chromium）には `[error]` が無い。AgentHost は C 系の単位で消す対象なので、消した後は無くなるはず（=「前の版に無かったエラー」の比べでは、消えるほうは問題にならない）。
- `[Extension Host] (node:...) [DEP0169] DeprecationWarning: url.parse()...` が `renderer.log` に `[error]` として1回入る（拡張のインストールの CLI でも同じ警告）。本家の既知の警告で、台本は誤りとして数える。baseline に入れて新規にならないようにする。

# 検証の記録: Phase 0 の試験環境、0-8 の自動の部分、0-9、0-10、計測用のワークスペース

- 検証: 大岡越前守（2026-11-13）
- 対象: 蒙恬の `tasks/2026-11-13-p0-envs-mydist-keys/` の成果と、`scripts/p0-*.ps1`・`scripts/lib/p0-common.ps1`・`scripts/convert-sublime-keys.mjs`・`scripts/lib/sublime-keys.mjs`・`extensions-src/mydist/`・`.gitignore`、置き場所 `C:\b\p0\`、`tmp\ws\`。曹参の `tests/sublime-keys.test.mjs`（0-10 の分だけ）。
- 対象外: `scripts/measure.ps1`・`scripts/netaudit.ps1`・`scripts/lock-verify.mjs`・`scripts/lib/lock.mjs`・`package.json`（並行して手直し中）。8節では、比べるために `measure.ps1` の `Start-EditorProcess` だけを読んだ。
- エディタは起動していない。

## 判定のまとめ

| # | 項目 | 判定 |
|---|---|---|
| 1 | 台本のレビュー（普段使いのデータ、VSCODE_PORTABLE、書き込み先） | 合格。起動のときの副作用（推定）について注意が1件ある |
| 2 | 環境の中身と試験台（段階 A）、doc-corrections の3 | 環境と試験台は合格。doc-corrections の3に誤りが1行あるため、項目としては不合格 |
| 3 | 0-8 の自動の部分 | 合格 |
| 4 | 0-9 の mydist の package.json、Light Modern の ID | 合格 |
| 5 | 0-10 の変換、テスト、衝突の一覧 | 合格。`records/phase0/sublime-keys.md` に清書した。曹参のテストに1件の不足がある（不合格の理由にはしない） |
| 6 | 計測用のワークスペース | 合格。権限が無く確かめきれなかった点が1つある |
| 7 | ユーザーが手で確かめる手順 | 不合格。このまま渡すと、ワークスペースを汚すおそれがあり、0-9 の手順5は証拠にならない |
| 8 | 子のプロセスに渡る `ELECTRON_RUN_AS_NODE`・`VSCODE_*`（リーダーが追加した項目） | 不合格（`p0-launch.ps1`）。`p0-env.ps1` と `p0-ext-allowed.ps1` は問題なし |

**総合: 不合格（2・7・8）。** 1・3〜6 は合格。2と7は文書（蒙恬の .md）を直せばよい。8は `p0-launch.ps1` に数行を足す直しで済む。環境は作り直さなくてよい。

## 走らせたコマンドと結果

| コマンド | 結果 |
|---|---|
| `git status` / `git diff -- docs/ .gitignore` / `git diff --stat` | 追跡しているファイルのうち、変更は `.gitignore`（`node_modules/`・`tmp/` を足した）と `tasks/2026-11-13-p0-fetch-and-lock/handoff-notes.md`。未追跡のものは `scripts/`・`extensions-src/`・`tests/`・`records/`・各タスクのディレクトリ・`extensions.lock.json`・`package.json`。どれも各担当の書き込み先の中で、予期しない場所の変更は無い |
| `node tests/sublime-keys.test.mjs` | 27 件のうち 27 件が通過（fail 0） |
| `sha256sum C:/b/p0/sublime/ms-vscode.sublime-keybindings-4.1.10.vsix ...claude-code-2.1.322@win32-x64.vsix` | `fe064eb9...fdb26a34`（`.sha256` と一致）、`8c0b09c6...c5e4a4`（台帳と一致） |

権限が無くて流せなかったもの: `scripts/p0-check-ps.ps1`（構文の検査）、`git -C tmp/ws status`、`%USERPROFILE%\.vscode` やレジストリの読み取り、自分の環境変数の表示。構文については、台本が実際に走って `C:\b\p0\` の記録を残していることを、動いた証拠とみなした。

## 1. 台本のレビュー — 合格（注意1件）

読んだもの: `scripts/p0-env.ps1`・`p0-launch.ps1`・`p0-ws.ps1`・`p0-ext-allowed.ps1`・`p0-check-ps.ps1`・`lib/p0-common.ps1`、`C:\b\p0\vscode-1.146.0\bin\code.cmd`。

- 消すのは `C:\b\p0\data\<名前>\`（`Assert-P0Path` が、`C:\b\p0\` の外と `%APPDATA%`・`%USERPROFILE%\.vscode`・`.vscode-oss` を拒む）と、試験台の写し `C:\b\p0\testbed\`（robocopy `/MIR`。写す先は `Assert-P0Path` を通す）だけ。
- `VSCODE_PORTABLE` について:
  - CLI（`Invoke-P0Cli`）は、呼ぶ間だけ `VSCODE_PORTABLE=<data>\user` を設定し、`finally` で元の値に戻す。
  - 起動（`p0-launch.ps1`）は、`powershell -File` の子プロセスの中で設定して `Start-Process` に引き継がせる。呼んだ側のシェルには残らない。
  - `--extensions-dir` は毎回渡している。
  - 試験台と本家の zip の product.json に `target` が無いことを、`PortableOk` で確かめてから進む。
  - `argv.json` の場所と、ポータブルでユーザーのデータの場所が `<VSCODE_PORTABLE>\user-data` に固定されること（doc-corrections の1）は、私の知る本家のソース（`getArgvConfigPath`・`userDataPath`・`configurePortable`）の動きと合う。
- 普段使いのデータ（`%APPDATA%\Code`・`%USERPROFILE%\.vscode`・`.vscode-oss`・`%APPDATA%\VSCodium`）を書く経路は、台本の中に無い。ただし、それらの場所を直接読んで確かめることは、権限が無くてできなかった。
- **注意（推定。確かめていない）**: 本家の Windows 版は、起動のたびに `vscode://` の URL のハンドラーとして自分を登録する（本家のソース `src/vs/platform/url/electron-main/electronUrlListener.ts` の `app.setAsDefaultProtocolClient`。私の記憶による。ポータブルのときに止める処理は無いと覚えている）。
  - これが正しければ、ユーザーが `p0-launch.ps1` で本家の zip を起動すると、HKCU の `vscode` のプロトコルが `C:\b\p0\vscode-1.146.0\Code.exe` を指すように変わる。その後 `vscode://` のリンクは、普段使いの VS Code を起動し直すまで試験の側で開く。
  - 台本のデータの扱いの誤りではなく、本体を起動したときの副作用なので、合否には含めない。リーダーからユーザーに伝えることを勧める（下の「リーダーへ」の L1）。
  - VSCodium（試験台）のプロトコルは `vscodium` なので、普段使いの VS Code には当たらない。

## 2. 環境の中身 — 環境は合格、doc-corrections の3は要修正

- 10 の環境すべてについて、`p0-env.json`、`user\argv.json`、`user\user-data\User\settings.json`、`ext\extensions.json` を読んだ。どれも env-setup.md の4節の表と一致した。
  - 設定と argv: upstream-default と testbed-measure は計測の設定と `locale: ja`。upstream-ai-disabled は `chat.disableAIFeatures: true` で argv は `{}`。ext-allowed は `extensions.allowed`。それ以外は `{}`。
  - 拡張: upstream-default と testbed-measure は9件、testbed は7件、dotenv-a と dotenv-b は8件、langpack の2つは2件、ext-allowed は Claude Code と rainbow-csv、mydist は Claude Code と sublime-keybindings。
  - `failed` は全部空で、導入の終了コードは全部 0。
  - VSIX の SHA-256 は、`extensions.lock.json` の9件と全部一致した。
- 本体の版: 本家は 1.146.0（commit `69047191fc`）、試験台は VSCodium 1.143.17232（commit `c072cf64`）。
- 試験台（`C:\b\p0\testbed\p0-testbed.json` と、`resources\app\extensions\*\package.json` の実物）:
  - VSCodium の組み込み拡張 94 に `node_modules` を足した 95 フォルダから、29 を消して 66 が残った。実物の数（package.json を持つもの 65 と `node_modules`）とも合う。
  - 消したものは、docs/03 の4節の A-2〜A-7 と一致した。A-3 の js-debug の3件はフォルダで消している（docs/07 の2.4 はフォルダを消すことを求めているので可）。A-6 は `theme-defaults`・`theme-seti` を残し、ほかの10件を消した。A-7 は8件。
  - 飛ばしたのは A-1 の `copilot` だけで、VSCodium に無いことは実物でも確かめた。
  - 残す一覧（git・git-base・merge-conflict・search-result・markdown の3つ・各 language-features・emmet・configuration-editing・npm・references-view・テーマ2つ・各文法）は全部残っている。消し過ぎも消し残しも無い。
- **doc-corrections.md の3（不正確）**: 「本家 1.146.0 の zip の `extensions\` にあって」とする表に `media-preview` があるが、本家 1.146.0 の zip（`C:\b\p0\vscode-1.146.0\69047191fc\resources\app\extensions\`）に `media-preview` は無い。Glob で中身が0件だった。product.json にも名前が無い。`media-preview` があるのは VSCodium 1.143.17232 だけ。
  - このまま docs/03 に写すと、1.146.0 の keep.json に存在しない拡張を載せることになる。
  - あわせて、1.146.0 で画像のプレビューを何が受け持つかが分からなくなる。docs/06 の5節の base にある「画像のプレビュー」に関わる。
  - ほかの行は合っている。`TypeScriptTeam.jsts-chat-features` は 1.146.0 にだけあり、description は "...improve the Copilot experience..." で A-1 の案と合う。`prompt-basics` は両方にある。`theme-modern-icons` は両方にあり、A-6 の `theme-*` に当たる。

## 3. 0-8 の自動の部分 — 合格

`C:\b\p0\logs\ext-allowed-20261113-052950\result.json` を読んだ。

- (a) 許可していない `tomoki1207.pdf` と `ms-vscode.sublime-keybindings` は、`--install-extension ... --force` で終了コード 1 になった。出力は `This extension cannot be installed because it is not in the [allowed list]` で、`cliProcessMain.js` の `install` から出ている。試した後の一覧・フォルダ・`extensions.json` のどれにも現れない。
  - 対照として、許可した Claude Code は同じ CLI で終了コード 0 で入った。
  - 同じ `tomoki1207.pdf` の VSIX は、`extensions.allowed` の無い upstream-default では終了コード 0 で入っている（`C:\b\p0\data\upstream-default\p0-env.json`）。
  - 以上から、止めたのは設定だと言える。結論「CLI の `--install-extension` にも効く」を支える。
- (c) 設定より前に入れた rainbow-csv は、設定の後の一覧・フォルダ・`extensions.json` に残る。「消されない。画面での無効化は未確認」という書き方は正しい。

## 4. 0-9 の mydist — 合格

- `extensions-src/mydist/package.json` を読んだ。
  - `main` は無い。`name` は `mydist`、`publisher` は `shuko`（docs/04 の6.3）。
  - `configurationDefaults` は5項目で、値は docs/04 の6.1 と5節のとおり: `chat.disableAIFeatures: true`、`telemetry.telemetryLevel: "off"`、`workbench.colorTheme: "Light Modern"`、`breadcrumbs.enabled: false`、`extensions.allowed`（`"*": false` と台帳の9件の ID だけ。版は書いていない）。
  - `keybindings` は 69 項目（5節）。
- Light Modern の ID: 本家 1.146.0 と試験台の `theme-defaults/package.json` の `id` に `"Light Modern"` がある。`Default Light Modern` は無い。doc-corrections の2は正しい。
- `ThirdPartyNotices.txt` に MIT の著作権表示と許諾文がある（docs/04 の6.2）。README.md に元の版と SHA-256 がある。

## 5. 0-10 — 合格（`records/phase0/sublime-keys.md` に清書した）

- 元の 71 項目を1つずつ読み、規則（`win` か `key`、`none` は落とす、知らない修飾キーは落とす）で選ばれるキーと `command`・`when` を、mydist の 69 項目と順に突き合わせた。一致した。`converted-keybindings.json` も 69 件。
- 落としたのは2件（`none` の saveAll、`ctr+shift+[` の editor.fold）で、`dropped.json` と一致。リーダーの決定どおり。
- Claude Code の9件（`claude-code-keybindings.json`）は、0-1 の manifest の記録（`tasks/2026-11-13-p0-fetch-and-lock/claude-code-manifest.md` の 46〜60 行）と一致。衝突0件、同じキーで `when` が違うもの0件を、キーを1つずつ見て確かめた。
- `node tests/sublime-keys.test.mjs` は 27 件すべて通過。テストは docs/04 の6.2 と約束から書かれており、規則を緩めた箇所は無い。
- 不足（曹参。不合格の理由にはしない）: リーダーの決定で足した規則「知らない修飾キーを含む項目は落とす」（`ctr+shift+[`）を確かめるテストが無い。
- 下書きの小さな誤り（蒙恬。清書では直した）: sublime-keys.md の5節の表の見出し「`win` が無いので `key`」は誤り。9件中7件は `win` を持つ。表のキーの値は正しい。

## 6. 計測用のワークスペース — 合格（確かめきれない点1つ）

- `tmp\ws\.vscode\tasks.json` を Read で読んだ。`ws-tasks.json` と同じ中身で、ラベルは `p0-open-terminal`、`powershell.exe -NoLogo -NoProfile`、`runOptions.runOn: "folderOpen"`。docs/07 の3.2 の3「フォルダを開いたときにターミナルを1つ開かせる」を満たす。
  - 計測の環境（upstream-default・testbed-measure）は `task.allowAutomaticTasks: "on"` と `security.workspace.trust.enabled: false` なので、無人でも動く条件がそろっている。
- コミット: `tmp\ws\.git\HEAD` は `refs/heads/main` で、`refs/heads/main` は `2385a2ff1ea22ceaa5a039500f3f88361eef2392`。env-setup.md と `C:\b\p0\ws-info.json` に一致。
- 2つのファイルは実在する（先頭を Read）。`apps/api/src/routes/extraction.ts`（Hono のルート）と `local-apps/topic-clusterer/topic_clusterer/labeling.py`（モジュールの docstring）。
- 変更が tasks.json だけであることは、`ws-info.json` の `dirtyExceptTasks: []` と `vscodeFolder: ["tasks.json"]`（蒙恬の台本の出力）に頼った。私の許可に `git -C tmp/ws status` が無く、独立には確かめていない。
- 事実の食い違い（リーダーへ。L2）: `tmp\ws\.git\logs\HEAD` は `clone: from https://github.com/polites-co-jp/kuebiko.git` で、`.git/config` の origin も GitHub。裁定の文言「`E:\develop\kuebiko` を clone」とは出どころが違う。
  - コミットが固定されているので、計測の条件には差し支えない。
  - ただし `p0-ws.ps1` は `source` に固定の文字列 `'E:\develop\kuebiko (cloned by the user)'` を書いており、`ws-info.json` の `source` は事実と違う（蒙恬。F6）。
- 補足: clone には kuebiko の `CLAUDE.md`（kuebiko の開発の規約）がある。そこで動く Claude Code はこれを読むが、裁定（2026-11-13）で受け入れ済み。

## 7. ユーザーが手で確かめる手順 — 不合格

起動のコマンドは使える形になっている。`p0-launch.ps1 -Name <名前>` は p0-env.json から exe・データ・mydist の開発パスを読み、`-PrintOnly` もある。ただし8節の条件がある。足りない点は次のとおり。

- **F1（必須）ワークスペースを汚さない手順が無い**: docs/06 の5節の base には「ファイルを編集して保存」「git の変更の表示・ステージ・コミット」がある。0-2・0-3 でこれを `tmp\ws` で行うと、計測の前提「同じコミット、tasks.json だけを足した状態」（docs/07 の3.1）が崩れる。
  - env-setup.md の5節に、編集・保存・コミットをどこで行うかを書く。例: `tmp\ws` ではコミットしない。試した変更は終わったら戻す。
  - 確かめた後に `p0-ws.ps1` を走らせ直し、commit が `2385a2ff...` のままで `dirtyExceptTasks` が空であることを見る手順を書く。
  - 0-3 の languages の組（CSV・.env・sh など）や 0-8 で使う試しのファイルを、どこに置くかも書く。
- **F2（必須）configuration-defaults.md の3節の手順5は証拠にならない**: 例に挙げた `Ctrl+D`（addSelectionToNextFindMatch）と `Ctrl+Shift+K`（deleteLines）は、本家の Windows の既定と同じ割り当てなので、mydist が無くても効く。さらに mydist の環境には `ms-vscode.sublime-keybindings` も入っており、`extensions.allowed` の既定が効かなければ、同じキーをその拡張が出す。直し方:
  - キーボードショートカットの画面（Ctrl+K Ctrl+S）で、該当のキーのソースが mydist（開発中の拡張 `shuko.mydist`）であることを見る手順にする。
  - 本家の既定と違うキーを例にする。例: `Ctrl+M` → jumpToBracket（本家はタブでフォーカスを移す切り替え）、`Ctrl+J` → joinLines（本家はパネルの表示の切り替え）、`Ctrl+R` → gotoSymbol（本家は最近開いたもの）、`Ctrl+Shift+D` → copyLinesDown（本家は実行とデバッグのビュー）。
- **F3 env-setup.md の5節の不足**:
  - (1) コマンドは相対パスなので、リポジトリの直下（`E:\develop\self\Team\projects\ai-editor`）で走らせることを書く。
  - (2) 0-2・0-3・0-7 の見る場所と記録することが書かれていない。docs/07 の2.3・2.4・2.8 と docs/06 の5節を手順として指し、出力の先（`records/phase0/upstream-ai-disabled.md` など）に何を写すかを書く。
  - (3) 拡張ホストのログの置き場所（ポータブルなので `C:\b\p0\data\<名前>\user\user-data\logs\<日時>\`）を書く。
  - (4) 0-3 の前提として、PowerShell 7 と ShellCheck をユーザーが winget で入れること（裁定 2026-11-13）と、Python 本体の有無を書く。
  - (5) 計測の環境以外では、`tmp\ws` を開くと信頼の確認が出る。0-2 は docs/07 の2.3 のとおり信頼する。
  - (6) 起動は、ユーザー自身の端末（Windows Terminal などのふつうの PowerShell）から行うと書く（8節）。
- **F4 extensions-allowed.md の3節の手順5**: 「CSV ファイルを開いて色が付くか」の CSV の場所が書かれていない。`tmp\ws` の外（例 `C:\b\p0\sample.csv`）に置くよう書く（F1 と同じ理由）。
- extensions-allowed.md の3節のほかの手順（作り直し、VSIX のパス、見るもの、写すもの）と、configuration-defaults.md の3節の手順1〜4・6は、そのまま使える。

## 8. 子のプロセスに渡る `ELECTRON_RUN_AS_NODE`・`VSCODE_*` — 不合格（`p0-launch.ps1`）

リーダーの追加の依頼（2026-11-13）による。曹参が見つけた事実（`tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md` の2）: claude から起動した子のプロセスには `ELECTRON_RUN_AS_NODE=1` と `VSCODE_*` が入っている。そのまま Code.exe を起動すると、Electron ではなく node として動き、終了コード 9 で終わる。曹参の `measure.ps1` の `Start-EditorProcess`（375〜391 行）は、`^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|VSCODE_.*)$` を子から外してから起動している。

蒙恬の台本で、`ELECTRON_*`・`VSCODE_*` に触れる箇所を `Grep` で探した。`VSCODE_PORTABLE` を設定するところ（`p0-launch.ps1` の 62 行、`lib/p0-common.ps1` の 321〜327 行）のほかには無い。

| 台本 | 起動のしかた | 変数を外すか | 判定 |
|---|---|---|---|
| `p0-launch.ps1` | `Start-Process <Code.exe か VSCodium.exe>`（63 行）。環境は親から全部引き継ぐ | 外さない | **不合格**。親に `ELECTRON_RUN_AS_NODE=1` があると、エディタが立ち上がらずに終了コード 9 で終わる |
| `p0-env.ps1`（`Invoke-P0Cli`） | `bin\code.cmd`・`codium.cmd` | 外さない | 問題なし。`code.cmd` は自分で `ELECTRON_RUN_AS_NODE=1` を設定して `cli.js` を node として走らせる（`C:\b\p0\vscode-1.146.0\bin\code.cmd` の4〜5行）。この変数はもともと要る |
| `p0-ext-allowed.ps1` | 同上（`Invoke-P0Cli`）。`p0-env.ps1` を `powershell -File` で呼ぶ | 外さない | 問題なし（同上） |

- CLI の側が実際に動く証拠: 10 の環境の導入と 0-8 の試しは、蒙恬（claude の下のサブエージェント）が走らせて、全部終了コード 0（0-8 の対照も 0）だった。曹参と同じ環境の変数があったと見込まれるが、CLI では差し支えなかった。`code.cmd` が消すのは `VSCODE_DEV` だけで、ほかの `VSCODE_*` は `cli.js` に渡る。ただ結果は正しく出ているので、今回は直さなくてよい（任意で `Invoke-P0Cli` でも外すとそろう。F9）。
- `p0-launch.ps1` のもう1つの問題: `Start-Process ... -PassThru` の直後に `started pid <番号>` と書くだけで、プロセスがすぐ終わっても誤りにならない。終了コード 9 で終わっても、使う人には「起動した」と見える。

**どの場面で問題になるか**

| 起動する場所 | `ELECTRON_RUN_AS_NODE` | 影響 |
|---|---|---|
| ユーザーが自分で開いた Windows Terminal・PowerShell・エクスプローラー | ふつうは無い | 小さい。そのまま起動できる見込み |
| 普段使いの VS Code の統合ターミナル | 本家はターミナルを作るとき、`ELECTRON_*` と `VSCODE_*`（`VSCODE_PORTABLE` などを除く）を環境から外す（`sanitizeProcessEnvironment`。私の記憶による。推定） | 小さい見込み。確かめてはいない |
| Claude Code（VS Code の拡張から開いたもの。CLI の `!` のシェルを含む）、リーダーやメンバーのエージェント | 入っている（曹参の観測） | **起動できない**（終了コード 9）。表示は「started pid ...」のまま |

ユーザーが自分の端末から起動するなら、影響は小さい。ただしユーザーが Claude Code に「p0-launch.ps1 で起動して」と頼んだときや、手の確かめの途中でエージェントが起動したときには、黙って失敗する。直しは小さいので、手の確かめを頼む前に直すことを勧める。

**直し方（蒙恬。F8）**: `p0-launch.ps1` の `Start-Process` の前に、`measure.ps1` の `Start-EditorProcess` と同じく `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を環境から外し、`VSCODE_PORTABLE` だけを設定する。あわせて、起動の数秒後にプロセスが生きているかを確かめ、終わっていれば終了コードを出して失敗にする。env-setup.md の5節にも「自分の端末から起動する」と書く（F3 の (6)）。

## 直すべき点（担当つき）

| ID | 担当 | 何を | どう直す |
|---|---|---|---|
| F1 | 蒙恬 | env-setup.md の5節 | 手での確かめで `tmp\ws` を汚さない手順、終わった後の戻し方、`p0-ws.ps1` での確かめを足す |
| F2 | 蒙恬 | configuration-defaults.md の3節の手順5 | キーボードショートカットの画面でソースが mydist であることを見る手順にし、本家の既定と違うキーを例にする |
| F3 | 蒙恬 | env-setup.md の5節 | 作業場所、0-2・0-3・0-7 の見る場所と記録すること、ログの場所、0-3 の前提、信頼の確認、自分の端末から起動することを書く |
| F4 | 蒙恬 | extensions-allowed.md の3節の手順5 | CSV の置き場所（`tmp\ws` の外）を書く |
| F5 | 蒙恬 | doc-corrections.md の3 | `media-preview` は本家 1.146.0 の zip に無く、VSCodium 1.143.17232 にだけあると直す。1.146.0 で画像のプレビューを何が受け持つかは、0-2 の手の確かめで見る点として書く |
| F6 | 蒙恬（軽微） | `scripts/p0-ws.ps1` の `source` | 固定の文字列をやめ、origin の値（または `.git/logs/HEAD` の clone の出どころ）を書く |
| F7 | 蒙恬（軽微） | sublime-keys.md の5節の見出し | 「`win` が無いので `key`」を直す（清書では直した） |
| F8 | 蒙恬 | `scripts/p0-launch.ps1` | 起動の前に `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を子から外し、`VSCODE_PORTABLE` だけを設定する。起動の後にプロセスが生きているかを確かめる |
| F9 | 蒙恬（任意） | `scripts/lib/p0-common.ps1` の `Invoke-P0Cli` | `VSCODE_*`（`VSCODE_PORTABLE` を除く）を CLI に渡さないようにすると、`measure.ps1` とそろう。今は結果が正しいので必須ではない |
| T1 | 曹参 | `tests/sublime-keys.test.mjs` | 知らない修飾キーを含む項目（例 `ctr+shift+[`）が落ちることのテストを足す |

## リーダーへ

- L1: 本家の zip を起動すると、`vscode://` のプロトコルの登録が試験の側に移るおそれがある（推定。1節）。ユーザーに伝える。手の確かめの前後で `HKCU\Software\Classes\vscode\shell\open\command` を見比べてもらうか、終わった後に普段使いの VS Code を起動し直してもらうとよい。
- L2: clone の出どころが GitHub で、裁定の文言（`E:\develop\kuebiko`）と違う（6節）。差し支えないか、ユーザーに確かめるか記録に書く。
- L3: doc-corrections の1・2・4・5・6・7 は、確かめた範囲で正しい。docs への反映はリーダーの担当。3は F5 の後に反映する。
- L4: F8 を直すまでは、`p0-launch.ps1` をエージェントから走らせない。ユーザーには、自分の端末から起動するよう伝える（8節）。

# 引き継ぎ（蒙恬 → ヴラド・ツェペシュ）: Phase 0 の試験環境・mydist の試作・Sublime のキーの変換

- 結果: 完了（計測用のワークスペースの準備だけは clone 待ち。台本はできている）

## 成果物

- 台本: `scripts/p0-env.ps1`、`scripts/p0-launch.ps1`、`scripts/p0-ws.ps1`、`scripts/p0-ext-allowed.ps1`、`scripts/p0-check-ps.ps1`、`scripts/lib/p0-common.ps1`
- 0-10: `scripts/convert-sublime-keys.mjs`、`scripts/lib/sublime-keys.mjs`、`scripts/lib/zip-read.mjs`
- 0-9: `extensions-src/mydist/package.json`（configurationDefaults 5項目 + Sublime のキー 70 項目）、`extensions-src/mydist/README.md`、`extensions-src/mydist/ThirdPartyNotices.txt`
- `.gitignore` に `tmp/` を足した
- 説明: `env-setup.md`、`extensions-allowed.md`、`configuration-defaults.md`、`sublime-keys.md`、`doc-corrections.md`、`ws-tasks.json`（tmp\ws に足す tasks.json の中身）

## 要点

1. 環境は 10 個すべて実際に作れた（`upstream-default`、`upstream-ai-disabled`、`testbed`、`testbed-dotenv-a`、`testbed-dotenv-b`、`testbed-measure`、`langpack-upstream`、`langpack-testbed`、`ext-allowed`、`mydist`）。拡張の導入は全部終了コード 0。作れなかった環境は無い。
2. **`argv.json` は `--user-data-dir` の下ではなく、普段使いの `%USERPROFILE%\.vscode\argv.json` が読まれる（無ければ作られる）**。`VSCODE_PORTABLE` で避けたが、ポータブルではユーザーのデータが `<VSCODE_PORTABLE>\user-data` に固定される（`--user-data-dir` より優先）。配置は `data\<名前>\user\`（VSCODE_PORTABLE、argv.json）、`user\user-data\`（データ）、`ext\`。**曹参の `measure.ps1`・`netaudit.ps1` に `VSCODE_PORTABLE=<写した先>\user` の設定が要る**（今のままだと計測の設定が効かず、普段使いの argv.json を読む）。
3. 0-8 の自動の部分: 許可していない VSIX は CLI の `--install-extension --force` でも入らない（終了コード 1、`not in the allowed list`）。すでに入っていた許可外の拡張は消されず、CLI の一覧に残る（画面で無効になるかは手で見る）。
4. 0-10: 元 71 項目 → 70 項目（`"key": "none"` の1件を落とした）。Claude Code 2.1.322 の既定のキー9件との衝突は0件。元に書き誤り `ctr+shift+[` が1件。
5. 試験台: VSCodium 1.143.17232 から段階 A の 29 フォルダを消した（A-1 の `copilot` は VSCodium に無いので飛ばした）。

## 確かめたこと

- `scripts/p0-check-ps.ps1`: PowerShell 5.1.26100 の構文解析で9本とも誤り無し、ASCII のみ。`node --check` は3本の .mjs で通った。
- `p0-env.ps1 -All`: 10 環境を作り、終了コード 0。`-List`、`-PlanTestbed`、`p0-launch.ps1 -PrintOnly` も動いた。
- `p0-ext-allowed.ps1`: 結果は `C:\b\p0\logs\ext-allowed-20261113-052950\result.json`。
- `convert-sublime-keys.mjs --apply`: VSIX の SHA-256 は Open VSX の `.sha256` と一致。結果は `C:\b\p0\sublime\`。
- エディタの画面はまだ起動していない（ウィンドウを止める手段が許可に無いため、ユーザーに任せた）。

## テストの入口（曹参）

- `scripts/lib/sublime-keys.mjs`: `convertKeybindings(items, options?)`・`findConflicts(a, b)`（約束どおり）。補助として `convertKeybindingsDetailed`・`toWindowsKeybinding`・`removedUnitOf`・`normalizeKey`・`normalizeWhen`・`unknownModifiersOf`・`findSameKeyDifferentWhen`・`REMOVED_COMMAND_RULES`。約束に足した規則は2つ: (1) キーが `none` なら落とす（`win: 'none'` なら `key` には戻らない）、(2) `args` を残す。期待する例は `sublime-keys.md` の8節。私は `node --test` を走らせる許可が無いので、曹参のテストは走らせていない。
- `scripts/lib/p0-common.ps1` の `Get-P0StageAPlan -FolderNames <string[]>`（純粋な関数）→ `{ Remove = [{Unit; Name}], Skipped = [{Unit; Name}] }`。`theme-*` は `theme-defaults`・`theme-seti` 以外を消す。
- 環境の記録 `C:\b\p0\data\<名前>\p0-env.json`（`editor.exe`、`data.user`・`data.userData`・`data.ext`・`data.portable`、`settings`、`argv`、`extensions[]`）は `measure.ps1` から読める。

## ユーザーが手で確かめる手順

- 共通: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name <名前>` で起動する（`env-setup.md` の5節）。
- 0-2: `upstream-ai-disabled` で docs/06 の5節の claude-code の組。
- 0-3: `testbed`・`testbed-dotenv-a`・`testbed-dotenv-b` で base・claude-code・languages の組。.env の比較は a と b で。
- 0-7: `langpack-upstream`・`langpack-testbed`。
- 0-8 (b)(c): `extensions-allowed.md` の3節。
- 0-9: `configuration-defaults.md` の3節。
- 計測用のワークスペース: `git clone E:\develop\kuebiko <リポジトリ>\tmp\ws` の後に `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1`（私が走らせてもよい。書き込み先に tmp/ が入ったことは確かめた）。

## docs との食い違い（`doc-corrections.md`）

1. `argv.json` の場所とポータブルの扱い（docs/07 の2.1・2.8・3.1、docs/04 の7節）。上の要点2。
2. Light Modern の ID は `Default Light Modern` ではなく `Light Modern`（docs/04 の6.1。試作はこの値にした）。
3. 段階 A の分類に無い 1.146.0 の組み込み拡張: `TypeScriptTeam.jsts-chat-features`、`prompt-basics`、`media-preview`（残す一覧に要る）、`theme-modern-icons`（docs/03 の4節）。
4. 試験台の VSCodium 1.143.17232 は本家 1.146.0 より古い（docs/07 の2.4）。
5. 計測の設定に `security.workspace.trust.enabled: false` が要る。表示言語もそろえた（docs/07 の3.1）。
6. Sublime の変換の規則に `none` と `args` の扱いが要る（docs/04 の6.2）。
7. CLI の `--install-extension` にも `extensions.allowed` が効く（docs/04 の5節の「未確認」を解消）。

## 未解決・判断を仰ぐ点

1. `ctr+shift+[`（`editor.fold`）を残すか直すか落とすか。推奨は落とす（本家の既定と同じ割り当てなので、無くても変わらない）。
2. `measure.ps1`・`netaudit.ps1` の `VSCODE_PORTABLE` の対応と、`-Workspace` の既定（今は `C:\b\p0\ws`）を `tmp\ws` へ直すこと（曹参の担当）。
3. 計測用のワークスペースの clone 待ち。clone の後にコミットと開く2つのファイルが決まる。
4. `scripts/lib/zip-read.mjs`（私）と `scripts/lib/zip.mjs`（別の蒙恬）が同じ役目で並んでいる。後でまとめるか決める。
5. `--extensionDevelopmentPath` で読み込んだ `mydist` が、自分の `extensions.allowed` の既定で止まるかはソースから断定できなかった（0-9 の手での確かめで分かる）。

---

## 追記（2026-11-13 05:40 JST）: 計測用のワークスペースと `ctr+shift+[`

結果: 完了。上の「未解決」の1と3は片づいた。

### ワークスペース（依頼書の「やること」の3）

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1` を走らせた。既定の場所は `<リポジトリ>\tmp\ws` になっていた（直す必要は無かった）。
- コミット: `2385a2ff1ea22ceaa5a039500f3f88361eef2392`（https://github.com/polites-co-jp/kuebiko.git の main）。作業ツリーの変更は、足した tasks.json のほかは無い。
- kuebiko には元々 `.vscode/` が無かった。足したのは `tmp\ws\.vscode\tasks.json` だけ（ラベル `p0-open-terminal`、`powershell.exe -NoLogo -NoProfile` を開いたままにする、`runOn: folderOpen`。中身は `ws-tasks.json` と同じ）。上書きは起きていない。
- 計測で開く2つのファイル:
  - TS: `apps/api/src/routes/extraction.ts`（92,532 バイト。Hono の API のルート。`apps/api/tsconfig.json` の対象）
  - Python: `local-apps/topic-clusterer/topic_clusterer/labeling.py`（20,455 バイト。`topic-clusterer` パッケージのモジュール）
  - どちらも手で書かれた実際のコード。選び方は「追跡されたファイルのうち 100 KB 以下で最大。テストの2位などは採らず1位」。記録は `C:\b\p0\ws-info.json` と `env-setup.md` の6節。
- 既定のワークスペースの確認: `p0-launch.ps1 -Name upstream-default -PrintOnly` が `...\tmp\ws` を開くことを確かめた。曹参の `measure.ps1`・`netaudit.ps1` の既定も、すでに `tmp\ws` で、`VSCODE_PORTABLE` の対応も入っていた。
- 注意:
  - clone に `node_modules` と Python の依存は無い。TS の import と basedpyright の外部パッケージは解決できず、その分の診断が出る見込み（推定）。本家と自作で同じ条件なので計測の比べには影響しない。依存を入れるかは決めていない（入れると tmp\ws の中が tasks.json 以外にも増える）。
  - `.gitignore` に `tmp/` を入れたので、Glob・Grep は `tmp\ws` の中を返さない（Read は読める）。大岡越前守が中を確かめるときの注意。
  - `git -C tmp/ws status` は私の Bash の許可に無いので、作業ツリーの状態は `p0-ws.ps1` の中の `git status --porcelain` で見た。

### `ctr+shift+[`（リーダーの決定: 落とす）

- `scripts/lib/sublime-keys.mjs` の `convertKeybindingsDetailed` に「知らない修飾キーを含むキーは落とす（理由 `invalid-key`、`unknown` に名前）」を足し、`node scripts/convert-sublime-keys.mjs --md C:/b/p0/sublime/conversion.md --apply` を走らせ直した。
- 結果: 元 71 項目 → 69 項目（落とした2件: `none` の `saveAll`、`ctr+shift+[` の `editor.fold`）。Claude Code との衝突は0件のまま。
- `extensions-src/mydist/package.json` に `ctr+` と `editor.fold` が無いことを Grep で確かめた。`sublime-keys.md`・`configuration-defaults.md`・`doc-corrections.md`・`extensions-src/mydist/README.md` を合わせて直した。
- 曹参のテストへの影響: `convertKeybindings` の約束の形は変わらない。足した規則は、入力のキーに知らない修飾キー（ctrl・shift・alt・meta とその別名 cmd・win・control・option・super 以外）があれば落とすこと。テストに `ctr+...` のような例があれば、出力から消える。
- `mydist` の環境（`C:\b\p0\data\mydist\`）は開発中の拡張としてリポジトリのフォルダを直に読むので、作り直さなくても次の起動から 69 項目になる。

### 確かめたこと

- `node --check`（sublime-keys.mjs、convert-sublime-keys.mjs）と `scripts/p0-check-ps.ps1`（9本とも誤り無し）。

### 残る未解決

- 上の「未解決」の2（measure.ps1 の対応）は、曹参がすでに直していたので片づいた。
- 残りは4（zip-read.mjs と zip.mjs の重なり）と5（開発中の mydist が自分の `extensions.allowed` で止まるか）。
- SubagentHandback は権限のフックで止められるため、この追記で報告とする。

---

## 追記2（2026-11-13 06:10 JST）: 差し戻し（F1〜F9）の直し

結果: 完了。F1〜F9 をすべて直した。直している途中で、`argv.json` の書き方の不具合を新しく1つ見つけて直し、10 の環境を作り直した（下の「新しく見つけた不具合」）。

### 直したこと

| # | 直したもの | 中身 |
|---|---|---|
| F1 | `env-setup.md` の5節 | 5.1 に「`tmp\ws` は見るだけ。編集・保存・置換・ステージ・コミットは使い捨てのフォルダ `C:\b\p0\scratch\`」を書いた。5.2 の2と 5.6 の1に `p0-ws.ps1` を走らせ直して commit と `dirtyExceptTasks` を確かめる手順、5.6 の2に戻し方（`git -C tmp\ws restore`、`reset --hard 2385a2ff…`。tasks.json は残る）を書いた。使い捨てのフォルダを作る台本 `scripts/p0-scratch.ps1` を足した（git のリポジトリと、言語ごとの見本のファイルを作って1回コミットする） |
| F2 | `configuration-defaults.md` の3節の手順5 | キーボードショートカットの画面（Ctrl+K Ctrl+S）で、Source の拡張が `Shuko defaults`（`shuko.mydist`）かを見る手順にした。例は本家と違う Ctrl+M・Ctrl+J・Ctrl+R・Ctrl+Shift+D。同じ環境に `ms-vscode.sublime-keybindings` が入っていることを冒頭に明記し、行の出方（mydist だけ / 両方 / Sublime だけ）での区別のしかたを書いた。3節の全部の手順を「すること・見る場所・記録すること」の形にした |
| F3 | `env-setup.md` の5節 | 作業の場所（リポジトリの直下、`cd` から）、自分の端末から起動すること、ログの場所（`<data>\user\user-data\logs\<日時>\` の `main.log`・`window1\exthost\exthost.log`）、0-3 の前提（pwsh・shellcheck・python・git の版と場所を確かめる手順）、信頼の確認、0-2（5.3）・0-3（5.4）・0-7（5.5）の手順を、番号つきで「すること・見る場所・記録すること」の形で書いた。清書の先の表も付けた。本家の zip の後に普段使いの VS Code を起動し直すこと（L1）も書いた |
| F4 | `extensions-allowed.md` の3節 | CSV は `C:\b\p0\scratch\sample.csv`（`p0-scratch.ps1` が作る）を使い、`tmp\ws` に置かないと書いた。3節の全部の手順を同じ形にした |
| F5 | `doc-corrections.md` の3 | 表に「本家 1.146.0」「VSCodium 1.143.17232」の列を足し、`media-preview` は本家に無く VSCodium にだけあると直した。1.146.0 で画像のプレビューを何が受け持つかは、0-2 の手順（5.3 の3）で見る点にした |
| F6 | `scripts/p0-ws.ps1` | `source` を `git remote get-url origin`（`.git/config`）の値にした。走らせ直して `C:\b\p0\ws-info.json` の `source` が `https://github.com/polites-co-jp/kuebiko.git` になった。commit は `2385a2ff…` のまま、`dirtyExceptTasks` は空 |
| F7 | `sublime-keys.md` の5節 | 見出しを「`win` があればそれ、無ければ `key`。9件中7件は `win` を持つ」に直した |
| F8 | `scripts/p0-launch.ps1` | 子から `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外し、`VSCODE_PORTABLE` だけを設定して起動する（共通の部品 `Invoke-P0WithEditorEnv`。起動の後に親の変数は元に戻す）。起動の8秒後（`-CheckSeconds`）にプロセスが生きているかを見て、終わっていれば `FAILED`、終了コード、ログの場所を出して終了コード 1。同じ環境のエディタがすでに動いていて引き継いだときは、そう表示して 0。確かめ用の `-SmokeSeconds <n>`（起動 → 生存の確認 → n 秒待つ → 起動した PID とその子孫だけを止める）を足した。止めるための `scripts/p0-stop.ps1 -Name <名前>`（その環境の exe とデータの場所をコマンドラインに持つ主プロセスと、その子孫だけ）も足した |
| F9 | `scripts/lib/p0-common.ps1` の `Invoke-P0Cli` | 同じ `Invoke-P0WithEditorEnv` を通し、`VSCODE_*` を外して `VSCODE_PORTABLE` だけを渡す（`ELECTRON_RUN_AS_NODE` は CLI の .cmd が自分で 1 にする） |

### F8 を実際の起動で確かめた結果

- 環境 `testbed`（VSCodium。`vscode://` の受け手の登録に関わらないように、本家ではなく VSCodium を選んだ）で、`p0-launch.ps1 -Name testbed -NoWorkspace -SmokeSeconds 15`、のちに `-SmokeSeconds 20`。
- 結果: 「OK: pid 81144 is alive with 7 process(es) in its tree」→ 20 秒後も生存（VSCodium.exe ×7）→ その7つだけを止め、その環境の主プロセスの残りは0。普段使いのエディタには触れていない（止めたのは起動した PID の木だけ）。
- ワークスペースは開かずに起動した（`-NoWorkspace`）ので、`tmp\ws` は変えていない（あとで `p0-ws.ps1` で commit と `dirtyExceptTasks` が空であることを確かめた）。
- 1回目の止め方（子から先に止めた）では、残った主プロセスが `main.log` に「extensionHost crashed」などを書いた。根を先に止める順に直した。

### 新しく見つけた不具合（直した。環境を作り直した）

- 1回目の起動のあと、試験台の `argv.json` が壊れていた。`{ "locale": "ja" }` の `}` の後ろに `, "enable-crash-reporter": false, "crash-reporter-id": "…" }` が足されていた。
- 原因: エディタは初めての起動で、この2項目を「元の中身の末尾2文字を切って `,\n…\n}` をつなぐ」形で足す（1.146.0 の `out/mainImpl.js`: `t.substring(0,t.length-2).concat(",\n", …)`）。私の台本は `}` の後ろに改行を書いていたので、切られたのが改行で、`}` が残った。壊れた `argv.json` は `{}` として扱われ、`locale: ja` が効かなくなる。
- 直し: `Write-P0Argv` を足し、`argv.json` の末尾を `\n}` で終えるようにした。設定の無い環境はコメントの行だけを持つ形（足される `,` がコメントの中に入る）。2回目の起動の後、足された形が正しい JSONC であることを確かめた。
- 10 の環境を `p0-env.ps1 -All` で作り直した（06:02 JST に終了。導入は全部終了コード 0。中身は前と同じ）。
- 計測（曹参の `measure.ps1`）は環境のひな形を写して使うので、この直しの後のひな形なら問題ない。docs への案は `doc-corrections.md` の7節（`install-extensions.mjs` が `argv.json` を書くときも末尾を `\n}` にする）。本家の環境では `enable-crash-reporter` が `true` になる（テレメトリの水準が1以上のため）ことも書いた。0-5 の通信の棚卸しで読むときの前提になる。

### 確かめたこと

- `scripts/p0-check-ps.ps1`: 11 本とも誤り無し、ASCII だけ。
- `p0-launch.ps1 -SmokeSeconds`（上のとおり）、`p0-stop.ps1 -Name testbed -WhatIfOnly`（「no editor of 'testbed' is running」）、`p0-scratch.ps1`（`C:\b\p0\scratch` に git のコミット `d630653` と見本の12ファイル）、`p0-ws.ps1`（commit 変わらず、変更なし）。
- `p0-launch.ps1` の失敗の道筋（起動してすぐ終わるとき）は、わざと失敗させる手段が無いので実機では試していない。

### 残ること・伝えること

- 不要なファイルを1つ作ってしまった: `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp`（中身は `placeholder` だけ）。私の Bash の許可では消せないので、消してほしい。
- `C:\b\p0\scratch` は git のリポジトリ（ローカルの user.name・user.email を `p0-scratch` にした使い捨て）。リモートは無い。
- 前からの未解決（zip-read.mjs と zip.mjs の重なり、開発中の mydist が自分の `extensions.allowed` で止まるか）は変わらない。

---

## 追記3（2026-11-13 06:20 JST）: 再検証の軽微な点（M1〜M3）

結果: 完了。

| # | 直したもの | 中身 |
|---|---|---|
| M1 | `scripts/lib/p0-common.ps1` の `Get-P0MainProcesses` | 条件に「`ExecutablePath` がその環境の exe（フルパス）と同じ」を足した。名前・データの場所・`--type=` が無いことの条件はそのまま |
| M2 | `scripts/p0-scratch.ps1`、`env-setup.md` の 5.3 の3 | scratch に `.vscode\tasks.json` を作る（タスク `p0-scratch-echo`、`echo p0-scratch-task-ok` を実行するだけ。`runOn` は付けず、手で動かすときだけ動く）。手順は「`Terminal > Run Task...` で `p0-scratch-echo` を選び、ターミナルに `p0-scratch-task-ok` と出れば成功。`tmp\ws` の folderOpen のタスクは使わない」に直した |
| M3 | `env-setup.md` の6節の最初の行 | 出どころを GitHub（https://github.com/polites-co-jp/kuebiko.git の `main`、commit `2385a2ff1ea22ceaa5a039500f3f88361eef2392`）に直した。裁定の文言（`E:\develop\kuebiko`）と違うことも添えた |

### 確かめたこと

- `scripts/p0-check-ps.ps1`: 11 本とも誤り無し、ASCII だけ。
- `scripts/p0-scratch.ps1`: `C:\b\p0\scratch` を作り直した（git のコミット `a8637ba`）。`.vscode\tasks.json` の中身が上のとおりであることを読んで確かめた。
- M1 を実機で確かめた: `p0-launch.ps1 -Name testbed -NoWorkspace` で起動（pid 85004、生存を確認）→ `p0-stop.ps1 -Name testbed -WhatIfOnly` が新しい条件で主プロセス pid 85004（木の 7 プロセス）を見つけた → `p0-stop.ps1 -Name testbed` でその 7 つだけを止めた → もう一度 `-WhatIfOnly` で「no editor of 'testbed' is running」。
- この起動で、試験台の環境 `testbed` の `argv.json` にエディタが `enable-crash-reporter: false` と `crash-reporter-id` を足した（正しい JSONC のまま）。初めての起動で必ず起きることで、手の確かめには差し支えない。まっさらにしたければ `p0-env.ps1 -Name testbed` で作り直す。計測の環境（`upstream-default`・`testbed-measure`）は起動していない。

### 残ること

- `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` の削除（追記2のとおり。私の許可では消せない）。
- zip-read.mjs と zip.mjs の重なり、開発中の mydist が自分の `extensions.allowed` で止まるか（変わらない）。

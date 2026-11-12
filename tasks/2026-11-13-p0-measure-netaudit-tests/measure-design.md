# measure.ps1 の使い方と設計

`scripts/measure.ps1`。docs/07 の3.1〜3.4 の台本。Windows PowerShell 5.1 で動く。ファイルは ASCII のみ（BOM なしの .ps1 を 5.1 は ANSI で読むため、日本語を入れると壊れる）。

## 計測する

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 `
  -Exe C:\b\p0\vscode-1.146.0\Code.exe `
  -EnvDir C:\b\p0\data\upstream-default `
  -OpenFiles <TSのファイル>,<Pythonのファイル> `
  -Label phase0-upstream
```

| 引数 | 既定 | 意味 |
|---|---|---|
| `-Exe` | `<EnvDir>\p0-env.json` の `editor.exe` | エディタの実行ファイル。省けば環境の記録から読む |
| `-EnvDir` | 必須 | 環境のひな形（蒙恬の `p0-env.ps1` が作る `C:\b\p0\data\<名前>\`）。`user\`（`VSCODE_PORTABLE` の先。`argv.json` と `user-data\`）と `ext\` を持つ。計測用は `upstream-default`・`testbed-measure` |
| `-Workspace` | `<リポジトリ>\tmp\ws`（裁定 2026-11-13）。本体の先頭で決める（5.1 の `-File` では param の既定値で `$PSScriptRoot` が空になるため） | 計測用ワークスペース |
| `-OpenFiles` | `C:\b\p0\ws-info.json` の `openFilesFull`（`p0-ws.ps1` が選んだ TS と Python） | 手順 2 で開く2つのファイル。`,` 区切りの1つの文字列でも配列でもよい（5.1 の `-File` は `a,b` を配列にせず1つの文字列にするので、本体で `,` で分ける）。相対パスはワークスペース基準。**ちょうど2つで、どちらも存在しなければ止まる**（TS と Python でなければ警告） |
| `-Label` | 必須 | 出力先の名前に使う |
| `-Runs` | 5 | 数える回数 |
| `-Warmup` | 1 | 捨てる回数（先に行う。記録は残すが数えない） |
| `-OutDir` | `records/measurements/<日付>-<ラベル>/` | 出力先。`runs.csv` があれば `-Force` が要る |
| `-Milestone` | なし | 節目の計測。下記 |
| `-LaunchWaitSeconds` / `-SettleSeconds` / `-StopWaitSeconds` | 30 / 120 / 10 | 手順 2 の前、手順 4、手順 8 の待ち |
| `-WorkRoot` | `C:\b\p0\run` | 毎回のデータの置き場所を作る親 |
| `-ProcessName` | `-Exe` のファイル名 | メインプロセスの名前（Code.exe など） |
| `-DefaultsNote` | なし | 「変えた既定値」に添える一言 |
| `-KeepData` | なし | 回ごとのデータを消さずに残す |
| `-SkipTaskCheck` | なし | `.vscode/tasks.json` の folderOpen の確認を飛ばす（試し用） |

## 1回の流れ（docs/07 3.2 との対応）

1. 新しいデータの置き場所を作る（3.1）。`-EnvDir` を `<WorkRoot>\<ラベル>-<回>\` に robocopy で写す。毎回、前の同名フォルダを消してから写すので、どの回も同じ初期状態から始まる。回が終わったらフォルダを消す。`Assert-SafeDataPath` が、`%APPDATA%`・`~\.vscode`・`~\.vscode-oss`・`~\.shuko` の下を指す `-EnvDir`・`-WorkRoot` を拒否する（普段使いのデータに触れない）。
2. 手順 1: `<exe> --user-data-dir <写した先>\user\user-data --extensions-dir <写した先>\ext <ワークスペース>`。起動する子プロセスにだけ次の環境を与え、起動後に自分の環境を戻す（`Start-EditorProcess`）。
   - `VSCODE_PORTABLE=<写した先>\user`。`argv.json` を `--user-data-dir` の下ではなく普段使いの `%USERPROFILE%\.vscode\argv.json` から読み、無ければ作る挙動を避けるため。ポータブルではユーザーのデータが `<VSCODE_PORTABLE>\user-data` に固定され `--user-data-dir` は無視されるが、コマンドラインに残るのでメインプロセスの特定に使える。
   - 親から引き継いだ `ELECTRON_RUN_AS_NODE` と `VSCODE_*` は外す。**`ELECTRON_RUN_AS_NODE=1` が残っていると Code.exe は node として動き、終了コード 9 で即座に終わる**（この環境で実際に起きた。claude 経由で起動するとこの変数が入る）。
   - 開始前と終了後に `%USERPROFILE%\.vscode`・`.vscode-oss`・`.shuko` の `argv.json` の有無と更新時刻を比べ、作られた・変わったら警告し、`summary.md/json` に書く。
3. `-LaunchWaitSeconds` 待ち、手順 2: 同じ引数に `-r <ファイル>` を付けて再度呼ぶ（実行中の窓に渡して終わる。同じ環境変数）。**ファイルは1つずつ、10 秒あけて開く**。2つを1回の `-r` で渡すと、見えるのは最後の1つだけで、もう1つは背景のタブのまま言語が有効にならず、その言語サーバーが起動しない（1.146.0 で、TS が起動して Python の `onLanguage:python` が来なかった）。1つずつ開けば両方の言語が有効になる。
4. 手順 3: 台本は tasks.json を書かない。ワークスペースに `.vscode/tasks.json` と `runOn: folderOpen` があるかを開始前に確かめ、無ければ止まる（蒙恬の `p0-ws.ps1` が足す）。`task.allowAutomaticTasks: "on"` は環境のひな形の設定に入れておく。
5. 節目の計測（`-Milestone`）: 手順 4 の前に `Read-Host` で止まる。ユーザーが Claude Code のパネルで決まった1文を送り、応答を待ってから Enter。捨てる回も含め毎回止まるので、`-Warmup 1 -Runs 5` なら6回手で行う。
6. 手順 4〜7: `-SettleSeconds` 待ち、`Get-CimInstance Win32_Process` を1回で全部取る。メインプロセスは「名前が `-ProcessName` で、`--type=` が無く、コマンドラインに回ごとの `--user-data-dir` の値がある」もの（普段使いのエディタと混ざらない）。そこから子孫を集める（PID の再利用と循環を防ぐ）。claude.exe とその子孫は別に分ける。
7. 手順 8: そのプロセス群だけを止め、消えるのを待ち、`-StopWaitSeconds` 待つ。

## 出力（`-OutDir`）

| ファイル | 内容 |
|---|---|
| `runs.csv` | 回ごとの合計。列 `Kind`（warmup / measured）、`PrivateExclClaude`（合否に使う主）、`PrivateInclClaude`、`WorkingSetExclClaude`、`WorkingSetInclClaude`、プロセス数、claude のプロセス数 |
| `<回>-processes.csv`、`processes-all.csv` | プロセスごと。`Role`（`CommandLine` から付ける）、`InClaudeSubtree`、`PrivateBytes`、`WorkingSetBytes`、`CommandLine` |
| `roles.csv` | 回ごと・役割ごとの合計 |
| `summary.json`、`summary.md` | 4つの合計の中央値・最小・最大・範囲（最大 - 最小）。実行ファイルの版、ワークスペースのコミット |
| `defaults-changed.md`、`env-template/` | ひな形の settings.json・argv.json の写しと一覧（「変えた既定値」） |
| `pc-state.json` | OS、CPU、メモリ、電源プラン、バッテリー、動いているプロセス数、ワーキングセット上位15 |

役割: claude-cli、copilot-runtime、extension-host、agent-host、pty-host、file-watcher、shared-process、ts-server、language-server、renderer、gpu、crashpad、utility-network/audio/node/other、shell、console-host、node-other、main（`--user-data-dir` 付きの無印）、other。判定の表は `tests/measure.tests.ps1` にある。

役割は2段で付ける。1段目は `Name`/`CommandLine` から（`Get-ProcessRole`）。2段目（`Get-RoleMap`）は、1.146.0 でコマンドラインだけでは区別できない `utility-node` を、CSV に残る手がかりで付け直す。

| 付ける役割 | 手がかり |
|---|---|
| extension-host | コマンドラインに `--inspect-port=0` |
| agent-host | 子に `copilot-runtime.exe` |
| pty-host | 子に OpenConsole / conhost / シェル |
| shared-process | 子に file-watcher があり、上のどれでもない（推定。確かめていない） |
| utility-node のまま | 手がかりが無いもの（上の試しでは2つ） |

優先は上から。`roles.csv`・`<回>-processes.csv`・netaudit の `samples.csv` に付け直した役割が入る。`jsonServerMain`（拡張子なしで渡される）も language-server になる（B-6）。

## 合否を出す（3.4）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 `
  -Baseline records/measurements/<日付>-phase0-upstream `
  -Candidate records/measurements/<日付>-<自作のラベル> [-OutDir <出力先>]
```

`-Candidate` の中に `verdict.md` と `verdict.json` を書く。終了コードは合格 0、不合格 1。既定の指標は `PrivateExclClaude`（`-Metric` で変えられるが合否は既定で見る）。

- 合格 = 自作の中央値が本家の中央値より**厳密に**小さい。等しければ不合格。
- 減った量が範囲より小さいとき、合格のまま `WithinRange: true` と注を書く（3.4 の「記録に書く」）。「範囲」は2つの範囲の大きいほうと決めた（docs に書いていない）。
- 数える回数が違うとき警告を出す。捨てた回は使わない。

## 試しの結果

### 最新の試し（B-5・役割の直し後。本家 1.146.0、`upstream-default`、`tmp\ws`、1回）

```
-EnvDir C:/b/p0/data/upstream-default -OpenFiles apps/api/src/routes/extraction.ts,local-apps/topic-clusterer/topic_clusterer/labeling.py -Runs 1 -Warmup 0 -LaunchWaitSeconds 30 -SettleSeconds 60 -StopWaitSeconds 5 -KeepData
```

`-File` 起動で `a,b` の1つの文字列を渡した。2つに分かれて、1つずつ開いた。出力は `trial/out-real4/`（`out-real2`・`out-real3` も同じ条件）。

- 18プロセス、プライベートバイト（claude 含めず）1,773.2 MiB、ワーキングセット 2,404.4 MiB。
- 役割（`roles.csv`）: main、gpu、utility-network、renderer、**agent-host**（198 MiB）、**extension-host**（188 MiB）、**pty-host**（89 MiB）、file-watcher、copilot-runtime（131 MiB）、language-server 1（json）、**ts-server 3**、console-host 2、shell 1、utility-node 2（手がかりなし）。以前の `utility-node` 5件（約42%）のうち3つに名前が付いた。
- **TS の言語サーバーは起動した**（`exthost.log` に `onLanguage:typescript`、ts-server 3プロセス）。
- **Python の言語サーバーは起動しない**。`onLanguage:python` は来て `detachhead.basedpyright` の有効化が始まるが、`Error: Python extension is not installed or is disabled` で失敗する。basedpyright 1.40.2 は Python 拡張（`ms-python.python`）を要る。台本の問題ではなく環境の中身の問題（台帳に Python 拡張が無い）。docs/07 の 0-3 の「basedpyright が Python 本体なしで動くか」の答えに関わる。0-4 の基準値は、この状態（TS のみ）で取ることになる。台帳に Python 拡張を足すかはユーザーの裁定が要る。
- 普段使いの `argv.json` は作られなかった。

### 以前の試し（B-5 を直す前。`-OpenFiles` が1要素の文字列で、2つ目のファイルが開かなかった。参考のみ）

### 実エディタ（本家 1.146.0、環境 `upstream-default`、1回、待ちを短くして）

```
-EnvDir C:/b/p0/data/upstream-default -Workspace <trial/ws> -OpenFiles a.ts,b.py -Label trial-real -Runs 1 -Warmup 0 -LaunchWaitSeconds 20 -SettleSeconds 25 -StopWaitSeconds 5
```

- `-Exe` を省き、`p0-env.json` の `editor.exe`（`C:\b\p0\vscode-1.146.0\Code.exe`）が使われた。
- 起動し、メインプロセス（`--user-data-dir ...\user\user-data` を含むコマンドライン）が見つかり、12プロセス、プライベートバイト（claude 含めず）1,318.4 MiB、ワーキングセット 1,650.2 MiB。claude.exe は未起動（パネルを開いていない）。出力は `trial/out-real/`。
- **VSCODE_PORTABLE の効き目**: 子プロセスのコマンドラインに `--lang=ja`（環境の `argv.json` の `locale: ja` が効いた印）。設定は `user\user-data\User\settings.json` から読まれた（`task.allowAutomaticTasks`）。**普段使いの `argv.json` は作られず変わらなかった**（`.vscode`・`.vscode-oss`・`.shuko` とも不存在のまま。`summary.json` の `DailyArgvAfter` の `Exists` がすべて false、`DailyArgvTouched` が空）。
- 最初の試しは `ELECTRON_RUN_AS_NODE` のせいで Code.exe が終了コード 9 で終わり、「no editor process found」になった（上の環境変数の除去で直した。`tests/probe-launch.ps1` で切り分けた）。
- 役割の実測（`roles.csv`）: main 1、gpu 1、utility-network 1、renderer 1、**utility-node 5**、file-watcher 1、console-host 1、**other 1**。限界: 1.146.0 では拡張ホスト・ptyHost・共有プロセスはどれも `--type=utility --utility-sub-type=node.mojom.NodeService` で、コマンドラインに区別できる印が無い（`CommandLine` だけでは `utility-node` までしか分からない）。親子関係や ExecutablePath でも区別できていない。「役割を `CommandLine` から付ける」（docs/07 の3.2）の限界として、大岡越前守に伝える。
- **発見**: `other` の1つは `copilot-runtime.exe --headless --stdio ...`（`resources\app\node_modules.asar.unpacked\@github\copilot-sdk-win32-x64\...`）で、本家の既定のまま（AI 有効）で常駐している。役割 `copilot-runtime` を足した。0-4 の比較で削る効き目の見当になる。

### 身代わりのエディタ（先に行った試し）

身代わりの実行ファイル（`tests/fixtures/fake-editor.cmd`。cmd.exe と ping.exe と conhost.exe の3プロセス）で次を確かめた。

```
-Exe tests/fixtures/fake-editor.cmd -ProcessName cmd.exe -SkipTaskCheck でなく本物の tasks.json を使用
-Runs 2 -Warmup 1 -LaunchWaitSeconds 3 -SettleSeconds 3 -StopWaitSeconds 2
```

- 3回（捨て1・数える2）が通り、毎回新しいデータが作られ、回の後に消えた。メイン検出、子孫の集計（3プロセス）、停止まで動いた。
- 出力は上の表のとおり揃った（`trial/out-a/`）。中央値 9.9 MiB、範囲 0。
- `-Baseline`/`-Candidate` に同じ出力を渡すと「等しい」で不合格（終了コード 1）になった。
- `-r` の2回目の呼び出しが 30 秒以内に終わったことは、実エディタの試しでも確認できた（待ちが発生せず進んだ）。
- まだ確かめていないこと: `tasks.json` のターミナルが開くか（ウィンドウを見ていない。`roles.csv` に shell が無く console-host だけ。`tmp\ws` の clone と tasks.json が来てから大岡越前守が見る）。節目の計測の一時停止。5回の通し。

# Phase 0 の検証（4）の記録: useBundled の反映、basedpyright の調べの台本、推定の役割の印（C-1）

- 検証: 大岡越前守（2026-11-13、日本時間 07:35〜07:50 ごろ）
- 依頼書: `brief.md`
- 起動したのは `upstream-default` の1回だけ（measure.ps1 経由）。ほかの環境は起動していない。`p0-stop.ps1`・`p0-env.ps1` は使っていない。

## 判定

| 項目 | 判定 | 理由の要点 |
|---|---|---|
| 1. 蒙恬: 裁定の反映・bp-probe の外し・新しい台本2本・調べの出典 | **合格** | 設定は裁定どおりで、bp-probe-a〜d も `-All` から外れていた。台本2本は書き込み先が限られ、普段使いのデータと秘密に触れない。調べの結論は、残ったログで支えられる。Web の出典は、私に Web の道具が無いので見ていない。mydist の既定が実際に効くかは、起動していないので見ていない |
| 2. 曹参: C-1（RoleSource）、`-CleanStale`、テスト | **合格**（D-1 は要修正） | RoleSource 列が CSV と roles.csv にある。`-CleanStale` は、実行中のプロセスが指すフォルダも、`-WorkRoot` の直下より外も消さない。テストは4本とも通った。ただし `-WorkRoot` の値そのものに制限が無い（D-1） |
| 3. 1回の短い試し（upstream-default、tmp\ws） | **合格** | tsserver が3つ、basedpyright の言語サーバーが1つ出た。roles.csv に RoleSource があり、回のデータは残らなかった |
| 4. 0-4 の本番の手順 | `p0-baseline-plan.md` に書いた | 決めてほしい点が1つある（節目の計測で送る「決まった1文」） |

## 1. 蒙恬

### 1.1 設定が裁定のとおりか

| 場所 | 値 | 判定 |
|---|---|---|
| `extensions-src/mydist/package.json` の `configurationDefaults` | `"basedpyright.importStrategy": "useBundled"`（33行）。ほかの5項目はそのまま | 裁定のとおり |
| `extensions-src/mydist/README.md` | 理由と裁定、調べへの参照 | よい |
| `scripts/lib/p0-common.ps1` の `$P0MeasureSettings` | `task.allowAutomaticTasks: on`、`security.workspace.trust.enabled: false`、`basedpyright.importStrategy: useBundled`。使うのは upstream-default と testbed-measure だけ（79・104行） | 裁定のとおり（本家と自作で同じ値） |
| `C:\b\p0\data\upstream-default\user\user-data\User\settings.json` | 上の3項目 | 読んで確かめた |
| `C:\b\p0\data\testbed-measure\user\user-data\User\settings.json` | 上の3項目。`p0-env.json` の `createdAt` は 07:37:01 | 読んで確かめた |
| 回のデータ（`C:\b\p0\run\ooka-trial3-run-1\user\user-data\User\settings.json`） | 同じ3項目（ひな形が写っている） | 確かめた |

- 台帳は9件のまま（ひな形の `ext\` は9件。`ms-python.*` は無い）。
- mydist の既定が実際に効くか（他の拡張の設定を `configurationDefaults` で変えられるか）は、mydist の環境を起動していないので見ていない。ユーザーの 0-9 の手の確かめで、設定の画面に `useBundled` が既定として出るかを1つ見てもらうのがよい（リーダー）。

### 1.2 bp-probe-a〜d が `-All` から外れたか

- `p0-common.ps1` の156行で `InAll = $false`。`p0-env.ps1` の154行で、`-All` の対象を `InAll` が無いか真のものに絞っている。43行では一覧の表示に使っている。読んで確かめた（`p0-env.ps1` を走らせる許可は私に無く、`-List` は走らせていない）。
- bp-probe の土台の設定から `basedpyright.importStrategy` を除いている（134-137行）。そのため、試しのときと同じ中身で作り直せる。

### 1.3 新しい台本2本のレビュー

| 観点 | `scripts/p0-openvsx-meta.mjs` | `scripts/p0-lsp-probe.mjs` |
|---|---|---|
| 書き込み先 | `--out`（既定 `C:/b/p0/probe/openvsx`）の下の `<namespace>.<name>[@target]\` に、`api.json`・`package.json`・`summary.json`。ほかは書かない | 書かない（標準出力だけ）。開くファイルは `readFileSync` で読むだけ |
| 通信 | `https://open-vsx.org/api/...` の GET と、API が返す `files.manifest` の GET、`files.download` の HEAD（VSIX の本体は取らない） | 無い |
| 普段使いのデータ・秘密 | 触れない（`%APPDATA%`・`~\.vscode`・`.env`・トークンを読む処理が無い） | 触れない。子のプロセスには自分の環境変数を渡す（`--strip-python-path` で PATH から python の場所を外すだけ） |
| JS の中身 | 拡張の JS は取らない。manifest（JSON）だけを読む | 拡張の JS を**読む・解析する作りではない**。ただし、拡張に同梱の `server.js` を `node <server.js> --stdio` として**エディタの外で実行する**。エディタが起動時に動かすのと同じコードで、調べのための実行として受け入れられる。取り込みの判定の自動の流れでは使わないこと（リーダー） |

軽微な点（直すかは任意。蒙恬）:
- lsp-probe: サーバーが `initialize` に応えないまま落ちると、`await request('initialize')` が待ち続ける（タイマーは診断の待ちにしか効かない）。また、待ちの途中で子が終わると、結果の JSON が出ない（`exit` の受け手を後で付けている）。
- openvsx-meta: `files.manifest` の URL を、API の応答のまま取りに行く（Open VSX を信頼する前提）。`--out` の値が無いときの検査が無い。

### 1.4 調べの出典が結論を支えるか

| 結論 | 支え | 判定 |
|---|---|---|
| basedpyright は `ms-python.python` を依存に持たない | `C:\b\p0\vsix\detachhead.basedpyright-1.40.2\package.json` に `extensionDependencies`・`extensionPack` が無い（grep で0件）。`basedpyright.importStrategy` の既定は `fromEnvironment`、選択肢は `fromEnvironment`・`useBundled`（1937-1946行） | 支えられる |
| `fromEnvironment` では起動に失敗し、Python の場所を設定しても直らず、`useBundled` で起動する | bp-probe-a（2回）・b の `exthost.log` に `Activating extension detachhead.basedpyright failed`・`at Object.api (...dist\extension.js:1:221)`。c・d は `[error]` が無く、`DiagnosticCollection with name 'basedpyright' does already exist.` の警告だけ。いずれも `C:\b\p0\data\bp-probe-*\user\user-data\logs\` で私が読んだ | 支えられる |
| 公式の文書と issue #1188 が回避として `useBundled` を挙げる | Web の出典。私には Web の道具が無いので見ていない。上の実機の結果と食い違いは無い | 未確認（実機で裏づけあり） |
| 同梱のサーバーが Python 本体なしでも診断を返す | lsp-probe の出力は記録に残っていない（蒙恬の要約だけ）。走らせ直してはいない（調べの範囲。0-4 の条件には要らない） | 要約のみ |

## 2. 曹参

### 2.1 テスト

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | `passed: 125  failed: 0`（申告どおり） |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | `passed: 67  failed: 0` |
| `node tests/lock.test.mjs` | `tests 115  pass 115  fail 0` |
| `node tests/sublime-keys.test.mjs` | `tests 50  pass 50  fail 0` |

- 足したテスト（11件）: role source（`commandline`・`child`・`inferred`、CSV の全行に RoleSource、推定の行を探せる）、stale dirs（参照されていないフォルダだけ、実行中のコマンドラインにあるフォルダは除く、名前の絞り込み、WorkRoot が無いとき、普段使いのデータの拒否）、remove run dir、`-File` で `-CleanStale` だけを渡すと、合うフォルダだけを消して終了コード 0。

### 2.2 C-1（RoleSource 列）

- `<回>-processes.csv`・`roles.csv` に `RoleSource` 列がある（私の試しで確かめた。下の3節）。`roles.csv` は Run・Role・RoleSource でまとめる（measure.ps1:876-883）。
- 推定（`inferred`）になるのは shared-process の規則だけ。今回の試しでは当てはまらず（file-watcher の親は AgentHost）、`inferred` の行は出なかった。テストで「推定の行を探せる」ことを確かめている。
- `measure-design.md` に「shared-process の規則は未確認」と書いた（曹参の申告。読んでいない）。

### 2.3 `-CleanStale`

読んだ箇所: `Find-StaleRunDirs`・`Remove-RunDataDir`・`Clear-StaleRunDirs`（measure.ps1:427-471）、呼び出し（789-792、944-949）。

| 問い | 答え | 根拠 |
|---|---|---|
| 実行中のプロセスのフォルダを消さないか | 消さない | 全プロセスのコマンドラインに、そのフォルダのフルパスが含まれていれば除く。エディタのメイン・子は `--user-data-dir` を、basedpyright のサーバーは `...\run\<名前>\ext\...\server.js` を、写し中の robocopy は宛先を、それぞれコマンドラインに持つ。`a-run-1` と `a-run-10` は部分一致で「使用中」と見なされる（安全側） |
| `-WorkRoot` の外を消さないか | 消さない | `Get-ChildItem -LiteralPath <WorkRoot> -Directory` の直下だけ。リパースポイント（ジャンクション）は飛ばすので、リンクの先へは行かない。`Assert-SafeDataPath` が、普段使いのデータ（`%APPDATA%`・`~\.vscode`・`~\.vscode-oss`・`~\.shuko`）の場所を拒む |

- **D-1（要修正。曹参。`-CleanStale` を既定以外の `-WorkRoot` で使う前に）**: `-WorkRoot` の値そのものに制限が無い。例えば `-CleanStale -WorkRoot C:\b\p0` と書き誤ると、`C:\b\p0` の直下の `data\`・`vsix\`・`vscode-1.146.0\`・`testbed\` なども「どのプロセスも指していないフォルダ」として消える。`-StaleFilter` の既定は `*`。直し方の案は次の3つで、`-CleanStale` が消すのは回のデータだけ、という約束にする。
  - 消す対象を回のデータの形（`<ラベル>-(warmup|run)-<数>`・`<ラベル>-netaudit` の名前、`user\user-data` と `ext\` を持つ中身）に限る。
  - `-WorkRoot` を `C:\b\p0\run` の下に限る。
  - テストを足す。
- 0-4 の本番の手順（`p0-baseline-plan.md`）では、`-WorkRoot` を既定のまま使い、`-CleanStale` は使わない（始める前に `C:\b\p0\run\` が空であることを見る）。そのため、D-1 は 0-4 を止める理由にしない。

## 3. 1回の短い試し

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -EnvDir C:/b/p0/data/upstream-default -Label ooka-trial3 -Runs 1 -Warmup 0 -OutDir tasks/2026-11-13-p0-verify-bundled-roles/trial/measure-upstream
```

`-Exe`・`-Workspace`・`-OpenFiles` は省いた（`p0-env.json` の Code.exe 1.146.0、`tmp\ws`、`ws-info.json` の2つ）。待ちは既定の 30/120/10 秒。終了コード 0。

| 確かめること | 結果 | 根拠 |
|---|---|---|
| TS の言語サーバー（tsserver） | 出た | ts-server 3プロセス（PID 74972・82584・58148、親は拡張ホスト 4340）。`exthost.log` 07:41:43.185 `onLanguage:typescript` |
| Python の言語サーバー（basedpyright） | **出た** | language-server PID 15572 `Code.exe --max-old-space-size=3072 c:\b\p0\run\ooka-trial3-run-1\ext\detachhead.basedpyright-1.40.2\dist\server.js ... --node-ipc --clientProcessId=4340`（プライベートバイト 161.5 MiB）。`exthost.log` 07:41:55.438 `onLanguage:python` で、`[error]` は無い。`basedpyright.log`: `basedpyright language server 1.40.2 starting`、`Python extension not found`（2回）、`No include entries specified; assuming ...\tmp\ws`、`Assuming Python version 3.14.7.final.0`、`Found 24 source files` |
| `roles.csv` に RoleSource | ある | 列 `Run,Role,RoleSource,Count,PrivateBytes,WorkingSetBytes`。agent-host・pty-host が `child`、ほかは `commandline` |
| 回のデータが残らない | 残らない | 終わった後、`C:\b\p0\run\` は空（Glob で0件）。`summary.json` の `RunDataLeftOver`・`StaleRunDirsBefore` はどちらも空 |
| 普段使いの argv.json | 作られなかった | `DailyArgvTouched` が空 |
| 合計 | 19プロセス、プライベートバイト（claude を含めない）1,979.3 MiB、ワーキングセット 2,679.6 MiB | 前の検証の 1,796〜1,804 MiB より約 175〜183 MiB 多い。basedpyright のサーバー（161.5 MiB）が加わったのが主な差 |

役割ごと（プライベートバイト）: renderer 402.7、ts-server 3つで 220.0、language-server 2つ（json 27.2・basedpyright 161.5）で 188.7、extension-host 184.5、agent-host 183.5、gpu 162.7、utility-node 2つで 162.2、copilot-runtime 141.9、main 105.8、pty-host 81.0、file-watcher 70.4、shell 59.7、utility-network 12.7、console-host 2つで 3.4（MiB）。

気づいた点:
- basedpyright は PATH の Python（3.14.7）を使った。本家と自作の計測は、同じ PC・同じ PATH で続けて測ること（`p0-baseline-plan.md` に書いた）。
- 言語サーバーの PID の分け方: basedpyright と json はどちらも `language-server` になる。役割の表で分けたいなら、`server.js` のパスにある拡張の ID を役割に添えるとよい（任意。曹参）。

## 4. 書いたもの

- `tasks/2026-11-13-p0-verify-bundled-roles/verification-log.md`（この記録）
- `tasks/2026-11-13-p0-verify-bundled-roles/p0-baseline-plan.md`（0-4 の本番の手順）
- `tasks/2026-11-13-p0-verify-bundled-roles/handoff-notes.md`（報告）
- `tasks/2026-11-13-p0-verify-bundled-roles/trial/measure-upstream/`（試しの出力）

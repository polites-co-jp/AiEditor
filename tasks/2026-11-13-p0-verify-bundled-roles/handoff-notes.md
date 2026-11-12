# 引き継ぎ（大岡越前守 → ヴラド・ツェペシュ）: Phase 0 の検証（4）

フックが SubagentHandback を止める（定義の tools に無い）ため、報告はこの文書に書く。詳細は `verification-log.md`、0-4 の本番の手順は `p0-baseline-plan.md`。最初の判定の後に、D-1 の再確認と手順の直しを行った。その結果は末尾の「追記」にあり、**判定は追記のほうが新しい。**

## 判定（最初の確認。追記で更新した）

| 項目 | 判定 |
|---|---|
| 1. 蒙恬: 裁定の反映、bp-probe の外し、新しい台本2本、調べの出典 | **合格** |
| 2. 曹参: C-1（RoleSource）、`-CleanStale`、テスト | **合格**（D-1 は要修正。0-4 は止めない） |
| 3. upstream-default・tmp\ws の1回の試し | **合格**（TS と Python の両方の言語サーバーが出た） |
| 4. 0-4 の本番の手順 | `p0-baseline-plan.md` に書いた。決めてほしい点が1つある |

## 根拠の要点

- **裁定の反映:** `useBundled` が次のすべてに入っていた。
  - mydist の `configurationDefaults`
  - `$P0MeasureSettings`
  - upstream-default・testbed-measure の `settings.json`
  - 回のデータの `settings.json`
  - 台帳は9件のまま。
- **bp-probe-a〜d:** `InAll = $false` で、`p0-env.ps1` の `-All` の対象から外れている（読んで確認）。
- **新しい台本2本:**
  - `p0-openvsx-meta.mjs` が書くのは `C:/b/p0/probe/openvsx` の下だけ。Open VSX の API と manifest を GET し、VSIX は HEAD だけ。
  - `p0-lsp-probe.mjs` は何も書かない。
  - どちらも普段使いのデータと秘密に触れない。拡張の JS を読む・解析する作りでもない。
  - ただし lsp-probe は、同梱の `server.js` をエディタの外で実行する。調べには受け入れられるが、取り込みの判定の自動の流れでは使わないこと。
  - 軽微な点が2つある（蒙恬）。`initialize` に応えないサーバーで待ち続ける。途中で子が終わると結果が出ない。
- **調べの結論:** manifest と bp-probe のログ（a・b は `extension.js:1:221` で失敗、c・d は起動）で支えられる。Web の出典（公式の文書・issue #1188）は、私に Web の道具が無いので見ていない。
- **テスト:** 125・67・115・50件がすべて通った。
- **C-1:** RoleSource 列が processes.csv と roles.csv にある。`inferred` は shared-process の規則だけで、今回は当てはまっていない。
- **`-CleanStale`:** 消さないものは次のとおり。
  - コマンドラインにフォルダのパスを持つ実行中のプロセス（エディタ・basedpyright のサーバー・robocopy）のフォルダ。
  - `-WorkRoot` の直下より外。リパースポイントも飛ばす。
- **試しの1回:**
  - tsserver が3つ出た。
  - basedpyright の言語サーバー（PID 15572、`...\ext\detachhead.basedpyright-1.40.2\dist\server.js --node-ipc`、161.5 MiB）が出た。`exthost.log` に `[error]` は無い。`basedpyright.log` に `basedpyright language server 1.40.2 starting`、`Found 24 source files` がある。
  - roles.csv に RoleSource がある。
  - 回のデータは残らなかった（`C:\b\p0\run\` は空、`RunDataLeftOver` も空）。
  - 普段使いの argv.json は作られなかった。
  - プライベートバイト（claude を含めない）は 1,979.3 MiB。前の検証より約180 MiB 多く、主に basedpyright の分。

## 直すべき点（最初の確認の時点）

- **D-1（曹参、要修正。`-CleanStale` を既定以外の `-WorkRoot` で使う前に）:** `-WorkRoot` の値そのものに制限が無い。追記で、直ったことを確かめた。
  - 例: `-CleanStale -WorkRoot C:\b\p0` と書き誤ると、`data\`・`vsix\`・`vscode-1.146.0\` なども消える。
  - 消す対象を回のデータの名前・形に限るか、`-WorkRoot` を `C:\b\p0\run` の下に限る。あわせてテストを足す。
  - 0-4 の手順では `-CleanStale` を使わない（追記で扱いを改めた）。
- **任意（曹参）:** basedpyright と json の言語サーバーが、どちらも `language-server` になる。分けるなら、役割に拡張の ID を添える（追記で、Extension 列として入ったことを確かめた）。
- **任意（蒙恬）:** lsp-probe の軽微な2点。

## リーダーに決めてほしいこと・伝えること（最初の確認の時点）

1. **節目の計測で送る「決まった1文」**（docs/07 の3.2。docs に文が無い）。推奨は「こんにちは。一言だけ返事をしてください。」（道具を使わせない短い文）。ユーザーに諮ってほしい。→ 裁定済み（追記）。
2. **Process Explorer の画面**は、数える回では撮らず、別の1回で撮ることを推奨する（開くと窓が増えて値が変わるため）。→ 裁定済み（追記）。
3. **試験台（testbed-measure）では、台本をまだ試していない**（ユーザーの手の確かめのため起動を控えた）。手順では、捨てる1回の結果を見て、おかしければ止めることにした。手の確かめが終わった後に、私が1回だけ短く試してもよい。
4. **mydist の既定 `useBundled` が実際に効くか**は見ていない（mydist の環境を起動していない）。ユーザーの 0-9 の手の確かめで、設定の画面に既定として出るかを1つ見てもらうとよい。
5. **0-4 は節目の計測**（docs/07 の3.2。Phase 0）なので、手順は `-Milestone` で、ユーザーが自分の PowerShell の窓で走らせる形にした。所要は1時間半ほど（本家と試験台、各6回）。
6. `tasks/2026-11-13-p0-envs-mydist-keys/env-setup.md` の4節の表に、`useBundled` がまだ無い（蒙恬の申し送り）。直す許可を蒙恬に出すかの判断。

## 守ったこと

- 起動したのは upstream-default の1回だけ（measure.ps1 経由）。ほかの環境は起動していない。`p0-stop.ps1`・`p0-env.ps1` は使っていない。
- 本番の5回の計測と10分の監査は行っていない。コードは直していない。書いたのは tasks の下だけ。

## 書いたもの

- `tasks/2026-11-13-p0-verify-bundled-roles/verification-log.md`
- `tasks/2026-11-13-p0-verify-bundled-roles/p0-baseline-plan.md`
- `tasks/2026-11-13-p0-verify-bundled-roles/handoff-notes.md`（この文書）
- `tasks/2026-11-13-p0-verify-bundled-roles/trial/measure-upstream/`

---

## 追記（2026-11-13 08:10 ごろ）: D-1 の再確認と、裁定による手順の直し

リーダーの連絡を受けて行った。対象は、曹参の `tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md` の「追記: D-1（-CleanStale の範囲の制限）」と、`docs/user-decisions.md` の「裁定（2026-11-13、0-4 の本番の前）」。起動したのは upstream-default の1回だけ（measure.ps1 経由）。ほかの環境は起動しておらず、`p0-stop.ps1` も使っていない。

### 判定（新しい）

| 項目 | 判定 |
|---|---|
| 曹参: D-1（`-CleanStale` の範囲の制限） | **合格** |
| 曹参: Extension 列（任意） | **合格** |
| 曹参: テスト4本 | **合格**（134・67・115・50件） |
| `p0-baseline-plan.md` の直し | 済み（0節を裁定に、1節の4・6節の `-CleanStale` の扱い、5節の4を裁定の手順に） |

これで、0-4 の本番に入る前の検証で残っているものは無い。試験台での台本の試しは未了のまま（手順の3節で、捨てる1回で見る）。

### 1. テスト4本

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | `passed: 134  failed: 0`（申告どおり。D-1 と Extension の9件を含む） |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | `passed: 67  failed: 0` |
| `node tests/lock.test.mjs` | `tests 115  pass 115  fail 0` |
| `node tests/sublime-keys.test.mjs` | `tests 50  pass 50  fail 0` |

### 2. D-1 の直し（読んだ箇所: `scripts/measure.ps1` の428-546行）

- **消してよい場所（`Test-CleanableRoot`）:** `-WorkRoot` が `C:\b\p0\run` か、その下（`\` 区切りで比べるので、似た名前の `C:\b\p0\runner` は不可）。または、印のファイル `.p0-run-root` があるフォルダ。それ以外では、`Clear-StaleRunDirs` が消す前に throw する。
- **消す対象（`Find-StaleRunDirs`）:** 次の3つをすべて満たすフォルダだけ。
  - 名前が `<ラベル>-run-<数>`・`<ラベル>-warmup-<数>`・`<ラベル>-netaudit`
  - 中に `user\` と `ext\` がある
  - どのプロセスのコマンドラインにも、そのパスが無い
  - リパースポイントは飛ばす。
- **印を書く場所（`New-RunDataDir`）:** 作業フォルダを新しく作ったとき、または空だったときだけ印を書く。中身のあるフォルダには書かない。回のデータを作る側も、上の名前でなければ止まる。

### 3. 実機での確かめ

使い捨ての作業フォルダは2つ使った。
- `tasks/2026-11-13-p0-verify-bundled-roles/trial/d1-root/`（私が作った囮。tasks の下なので、私の書き込みの範囲）
- `C:\b\p0\run\`。ここの回のデータは、upstream-default の1回を `-KeepData` で走らせて作った（`-Label ooka-d1 -Runs 1 -Warmup 0 -KeepData -OutDir tasks/.../trial/d1-measure`）。

| # | コマンド（いずれも `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 ...`） | 結果 |
|---|---|---|
| 1 | `-CleanStale -WorkRoot <d1-root>`（印なし。中に `x-run-1\{user,ext}`、`notrun\{user,ext}`、`y-run-2\user` だけ、`keep.txt`） | 終了コード 1、`refusing to delete under ... only C:\b\p0\run (or below it) or a work root with the marker file .p0-run-root may be cleaned`。何も消えなかった（Glob で6ファイルとも残った） |
| 2 | 同じフォルダに `.p0-run-root` を置いて、同じコマンド | `removed stale run dir: ...\d1-root\x-run-1`、`stale run dirs found: 1`。`notrun`（名前が違う）、`y-run-2`（`ext\` が無い）、`keep.txt`、印は残った |
| 3 | `-CleanStale`（既定の `C:\b\p0\run`）。`ooka-d1-run-1` のエディタが**動いている間**に | `stale run dirs found: 0`。`ooka-d1-run-1` は残り、その回は最後まで動いた（終了コード 0） |
| 4 | `-CleanStale -WorkRoot C:/b/p0` | 終了コード 1、`refusing to delete under C:/b/p0 ...`。何も消えなかった |
| 5 | `-CleanStale -WorkRoot C:/b` | 終了コード 1、同じ文言 |
| 6 | `-CleanStale -WorkRoot C:/b/p0/runner`（似た名前） | 終了コード 1、同じ文言 |
| 7 | `-CleanStale -WorkRoot C:/b/p0/data` | 終了コード 1、同じ文言。4〜7の後も、`C:\b\p0\data\` の14の環境の `p0-env.json` はすべて残っていた。`ooka-d1-run-1` も残っていた |
| 8 | `-CleanStale -StaleFilter ooka-d1-*`（エディタが止まった後） | `removed stale run dir: C:\b\p0\run\ooka-d1-run-1`、`stale run dirs found: 1`。残りは印 `.p0-run-root` だけ。環境の14件も残った |

- `-KeepData` の回の `summary.json` の `RunDataLeftOver` に、`C:\b\p0\run\ooka-d1-run-1` が正しく入った。

### 4. Extension 列（任意の直し）

`trial/d1-measure/roles.csv` の列は `Run,Role,RoleSource,Extension,Count,PrivateBytes,WorkingSetBytes`。language-server が次の2行に分かれた。
- `json-language-features`: 25.6 MiB
- `detachhead.basedpyright-1.40.2`: 140.2 MiB

ほかの役割の Extension は空。この回のプライベートバイト（claude を含めない）は、`trial/d1-measure/summary.md` のとおり。tsserver が3つ、basedpyright のサーバーも出た。

### 5. `p0-baseline-plan.md` の直し

- **0節:** 「決めること」を「決めたこと（裁定 2026-11-13）」に改めた。決まった1文は「こんにちは。一言だけ返事をしてください。」、Process Explorer は数える5回の後に数えない1回を足して撮る。
- **1節の4:** 「`C:\b\p0\run\` が空」を「回のデータのフォルダが無い（印 `.p0-run-root` はあってよい）」に改めた。残っていたときは、ほかの計測が動いていないことを確かめてから `-CleanStale`（`-WorkRoot` は付けない）で消す形にした。
- **2節の3:** 送る文を裁定の文にした。
- **5節の2:** basedpyright の有無を、`roles.csv` の Extension 列（`detachhead.basedpyright-1.40.2`）で見る形にした。
- **5節の4:** 裁定どおり、本家の5回の後に `-Label phase0-upstream-pe -Runs 1 -Warmup 0 -Milestone` の1回を足し、撮る手順を書いた。
- **6節:** 止めた回のデータは `-CleanStale` で消す形にした。
- メニューの表示名「ヘルプ」→「Process Explorer を開く」は、日本語の言語パックでの文言を確かめていない（「プロセス エクスプローラー」と訳されている見込み）。

### 6. 残ったこと

- 試験台（testbed-measure）での台本の試しは、未了のまま（ユーザーの手の確かめのため）。手順の3節で、捨てる1回の結果で見る。
- 私が作った囮のフォルダ `trial/d1-root/`（`notrun`・`y-run-2`・`keep.txt`・印）は、確かめの記録として残した。要らなければ消してよい。
- `C:\b\p0\run\.p0-run-root` は、台本が書いた印（曹参の試しのとき）。消さないこと。

### 7. 追記で書いたもの

- `tasks/2026-11-13-p0-verify-bundled-roles/p0-baseline-plan.md`（直した）
- `tasks/2026-11-13-p0-verify-bundled-roles/trial/d1-measure/`（`-KeepData` の1回の出力）
- `tasks/2026-11-13-p0-verify-bundled-roles/trial/d1-root/`（囮）
- この追記

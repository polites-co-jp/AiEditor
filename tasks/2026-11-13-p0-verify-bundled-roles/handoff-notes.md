# 引き継ぎ（大岡越前守 → ヴラド・ツェペシュ）: Phase 0 の検証（4）

フックが SubagentHandback を止める（定義の tools に無い）ため、報告はこの文書に書く。詳細は `verification-log.md`、0-4 の本番の手順は `p0-baseline-plan.md`。

## 判定

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

## 直すべき点

- **D-1（曹参、要修正。`-CleanStale` を既定以外の `-WorkRoot` で使う前に）:** `-WorkRoot` の値そのものに制限が無い。
  - 例: `-CleanStale -WorkRoot C:\b\p0` と書き誤ると、`data\`・`vsix\`・`vscode-1.146.0\` なども消える。
  - 消す対象を回のデータの名前・形に限るか、`-WorkRoot` を `C:\b\p0\run` の下に限る。あわせてテストを足す。
  - 0-4 の手順では `-CleanStale` を使わない。
- **任意（曹参）:** basedpyright と json の言語サーバーが、どちらも `language-server` になる。分けるなら、役割に拡張の ID を添える。
- **任意（蒙恬）:** lsp-probe の軽微な2点。

## リーダーに決めてほしいこと・伝えること

1. **節目の計測で送る「決まった1文」**（docs/07 の3.2。docs に文が無い）。推奨は「こんにちは。一言だけ返事をしてください。」（道具を使わせない短い文）。ユーザーに諮ってほしい。
2. **Process Explorer の画面**は、数える回では撮らず、別の1回で撮ることを推奨する（開くと窓が増えて値が変わるため）。
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

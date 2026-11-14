# 引き渡しの覚え: 「消えている」の検査の網の直し（曹参）

- 依頼: `brief.md`（このフォルダ）。2026-11-14
- 結果: 完了。unit.json の checks の形（キー）は変えていない（蒙恬との調整は不要）

## 直したもの

1. 設定の見方（`tests/removals/probe/extension.js`）
   - 原因: `getConfiguration().inspect(key)` は登録の無いキーでも、中身が全部 undefined のオブジェクトを返す。`!== undefined` は常に true。
   - 直し: `inspect(key).defaultValue !== undefined`（設定の登録簿の既定値）で見る。加えて `vscode.extensions.all` の `packageJSON.contributes.configuration` も見る（起動していない拡張の設定）。snapshot に `settingsVia`（registry / manifest / registry+manifest / none）を足した。
   - 実機の確認（公式の zip `C:\b\p0\vscode-1.146.0`）: 対照 `zzzShukoControl.never.registered` は「無い」（`C:\b\smoke\absent\fix-control-neg-20261114T142025\`）。`editor.fontSize`・`debug.console.fontSize` は「在る」（`fix-control-20261114T142012\`）。
2. コマンド・ビュー・設定の manifest の網（`tests/removals/lib/absent.mjs`、`run-absent.mjs`）
   - 出力の組み込み拡張（`resources/app/extensions/*/package.json`）の `contributes` の `commands`・`menus`・`keybindings`・`views`・`viewsContainers`・`configuration` を集める（`collectManifest` / `manifestOf`）。
   - 実行時の網（runtime）か manifest の網のどちらかに在れば「在る」。
   - 各結果に `net`（`runtime` / `manifest` / `runtime+manifest` / `none`）。標準出力の `網:` の行と、`absent-result.json` の `nets`（照会した件数、manifest の拡張数）に、どちらの網で見たかが出る。
   - 効果: 起動しない拡張のコマンド（github・ipynb・tunnel-forwarding・copilot・A-7 の拡張）が、公式で `manifest` の網で「在る」になる。

## 使い方の変わった点

- コマンドの形は変わらない: `node tests/absent-run.mjs --build <版> --units <単位> --expect absent`
- 網になっている条件の出し方: 公式の zip に `--expect present` で流し、全項目が pass なら網になっている。fail の項目は公式にも無いので網にならない（`run-absent.mjs` の冒頭にも書いた）。
  `node tests/absent-run.mjs --build C:\b\p0\vscode-1.146.0 --units all --expect present --label official`
- `--expect present` のときは pass の項目にも `net` を出す。

## 公式で `--expect present` を流した結果（全単位、`C:\b\smoke\absent\fix-units-official-20261114T142041\`）

網になっている: A-1・A-2・A-3・A-4・A-5・A-7・B-2・B-4・B-5・B-7・C-2〜C-7、B-1 と B-3 の他の項目、C-1 の他の項目。設定は全部 pass（probe の不備は解消）。A-6 は checks が空。

まだ網にならない項目（公式にも無い。蒙恬が checks を選び直す）:

| 単位 | 項目 | 備考 |
|---|---|---|
| B-1-telemetry | absentCommands `workbench.action.showTelemetry` | runtime・manifest のどちらにも無い |
| B-3-issue-share | absentCommands `workbench.action.share` | 同上 |
| C-1-ai | absentCommands `search.action.showAIResults` | 同上 |
| C-1-ai | absentProcesses `agent-host` | 起動した木に無い（公式でも） |

注: A-6 のように checks が空の単位は、この台本では見られない。拡張の一覧を照らす案（brief 外）は、必要なら別の依頼で。absentHosts は netaudit の担当で、ここでは見ない。

## テストの入口と件数

- `node --test tests/absent.test.mjs`: 20 件合格（旧 14 + 新 6: manifestOf、collectManifest、manifest の網の判定 2、probe の設定の見方 2）
- probe の2件は、偽の `vscode`（登録の無いキーでも inspect がオブジェクトを返す本物の振る舞いを模す）で `extension.js` をそのまま動かす。直す前の `!== undefined` に戻すと対照のキーで落ちる。偽物なので、本物での確認は上の実機の2回で行った。
- `node tests/run-all.mjs`（全ファイル。PowerShell のテストを含む）: 終了コード 0（fail なし）。合計件数は、出力が長く時間がかかって背景実行になり、出力の読み取りが許可外のため控えられなかった。件数が要るときは `node tests/run-all.mjs --save <ファイル>` で書き出して読む。`--only absent --no-ps` の単体: 20 件、合格 20、落ち 0

## 想定した入口（実装と合わせた点）

- 蒙恬の unit.json は読まない・書かない。`loadUnitChecks` の読み方は変えていない。

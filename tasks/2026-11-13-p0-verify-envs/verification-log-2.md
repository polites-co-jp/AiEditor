# 再検証の記録: 差し戻し（F1〜F9・T1）の直しと argv.json の不具合の直し

- 検証: 大岡越前守（2026-11-13、2回目）。1回目の記録は `verification-log.md`。
- 対象:
  - 蒙恬: `tasks/2026-11-13-p0-envs-mydist-keys/handoff-notes.md` の「追記2」に書かれた直し。`scripts/p0-launch.ps1`・`p0-stop.ps1`（新）・`p0-scratch.ps1`（新）・`p0-ws.ps1`・`lib/p0-common.ps1`、`env-setup.md`・`configuration-defaults.md`・`extensions-allowed.md`・`doc-corrections.md`・`sublime-keys.md`、作り直した10の環境、`C:\b\p0\scratch\`、`C:\b\p0\ws-info.json`。
  - 曹参: `tests/sublime-keys.test.mjs`（T1）。
- 合否に含めないもの: `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp`（蒙恬が誤って作ったもの。リーダーの指示による）。
- エディタは起動していない。

## 判定のまとめ

| # | 見ること | 判定 |
|---|---|---|
| 1 | F1〜F9 の直し、手順書、新しい台本 `p0-scratch.ps1`・`p0-stop.ps1` | 合格。軽微な点が3つある（直さなくても手の確かめは進められる） |
| 2 | argv.json の不具合の直し（`Write-P0Argv`）と10の環境の argv.json | 合格。起動の後の形は、環境が作り直されていて実物では見られなかった。本家の該当コードを読んで確かめた |
| 3 | 曹参の T1 | 合格（50件すべて通過） |
| 4 | records/phase0/ の5つの清書の書き方 | 手順書の「記録すること」で、docs/07 が求める中身を全部まかなえる。書き方を下の4節に決めた |

**総合: 合格。** 手の確かめ（0-2・0-3・0-7・0-8 (b)(c)・0-9）をユーザーに頼んでよい。

## 走らせたコマンドと結果

| コマンド | 結果 |
|---|---|
| `node tests/sublime-keys.test.mjs` | 50件のうち 50件が通過（1回目は27件。T1 で23件増えた） |

台本の構文の検査（`p0-check-ps.ps1`）は、私の許可に無く流していない。蒙恬の報告では11本とも誤りが無い。新しい台本は実際に走って記録を残している（`C:\b\p0\scratch\`、`ws-info.json`、作り直した10の環境）。

## 1. F1〜F9 と新しい台本 — 合格

| # | 直し | 確かめたこと | 判定 |
|---|---|---|---|
| F1 | env-setup.md の 5.1・5.2・5.6 | `tmp\ws` は見るだけ、変更はすべて `C:\b\p0\scratch\` で行うと書いてある。0-2〜0-9 の手順で、編集・保存・置換・コミット・Claude への変更の依頼は、どれも scratch を指している。5.2 の2と 5.6 の1で `p0-ws.ps1` を走らせ、commit `2385a2ff…` と `dirtyExceptTasks: []` を確かめる。5.6 の2の戻し方（`restore`・`restore --staged`・`??` の削除・`reset --hard 2385a2ff…`）は正しい。`.vscode/tasks.json` は追跡されていないので、`reset --hard` でも残る | 合格 |
| F2 | configuration-defaults.md の 3節の手順5 | キーボードショートカットの画面で割り当て元の拡張を見る手順になった。例の4つ（Ctrl+M・Ctrl+J・Ctrl+R・Ctrl+Shift+D）はどれも本家の Windows の既定と違う。行の出方（mydist だけ / 両方 / Sublime だけ）で読み分ける書き方は、手順4（拡張の状態）の結果と矛盾なく対応する | 合格 |
| F3 | env-setup.md の 5.1〜5.5 | 作業する場所（`cd E:\develop\self\Team\projects\ai-editor`）、自分の端末から起動すること、ログの場所、0-3 の前提（pwsh・shellcheck・python・git の版と場所）、信頼の確認の扱い、`vscode://` の注意（L1）を書いた。0-2・0-3・0-7 は番号つきの「すること・見る場所・記録すること」になった。docs/07 の2.3・2.4・2.8 が求める記録はすべて手順に入っている（4節の表） | 合格 |
| F4 | extensions-allowed.md の 3節 | CSV は `C:\b\p0\scratch\sample.csv` を使う（`p0-scratch.ps1` が作る。実物がある）。起動は `-NoWorkspace` で、`tmp\ws` を開かない。手順7で設定を変えたら作り直すと書いてある | 合格 |
| F5 | doc-corrections.md の3 | 表に本家と VSCodium の列を足し、`media-preview` は本家 1.146.0 に「無い」となった。実物と合う | 合格 |
| F6 | `p0-ws.ps1` の `source` | `git remote get-url origin` の値を書くようになった。`ws-info.json` の `source` は `https://github.com/polites-co-jp/kuebiko.git`、commit は `2385a2ff…`、`dirtyExceptTasks` は空（06:03 JST の実行） | 合格 |
| F7 | sublime-keys.md の 5節の見出し | 「`win` があればそれ、無ければ `key`。9件中7件は `win` を持つ」に直った | 合格 |
| F8 | `p0-launch.ps1` | `Invoke-P0WithEditorEnv` が `^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|VSCODE_.*)$` を外し、`VSCODE_PORTABLE` だけを設定して `Start-Process` を呼ぶ。終わったら親の変数を戻す。起動の8秒後に生きているかを見て、終わっていれば `FAILED`・終了コード・ログの場所を出し、終了コード 1 にする。同じ環境のエディタに引き継いだ場合は 0。`measure.ps1` の `Start-EditorProcess` と同じ形。蒙恬（claude の下）からの `-SmokeSeconds` の実行で起動に成功しており、変数を外せていることの実機の裏付けになる | 合格 |
| F9 | `Invoke-P0Cli` | 同じ `Invoke-P0WithEditorEnv` を通る。`ELECTRON_RUN_AS_NODE=1` は `code.cmd` が自分で設定する。作り直した10の環境の導入は全部終了コード 0 | 合格 |

### 新しい台本

- `scripts/p0-stop.ps1` — 普段使いのエディタを止めない。
  - 止める対象は `Get-P0MainProcesses` が選ぶ。条件は、プロセス名がその環境の exe の名前（`Code.exe` か `VSCodium.exe`）であること、コマンドラインにその環境のユーザーのデータの場所（`C:\b\p0\data\<名前>\user\user-data`）を含むこと、`--type=` を含まないこと（主プロセスだけ）。
  - そのうえで `Stop-P0ProcessTree` が、その主プロセスとその子孫だけを止める。普段使いの VS Code の主プロセスのコマンドラインに、この場所が入ることは通常ない。
  - `-WhatIfOnly` で、止めずに対象を表示できる。
  - 軽微（M1）: 名前だけで比べているので、`ExecutablePath` がその環境の exe と同じことも条件に足すと、より固い。例えば普段使いの `Code.exe` を `code C:\b\p0\data\<名前>\user\user-data\...` のように、その場所の引数つきで起動していた場合が考えられる（ふつうは起きない）。手の確かめを止める理由にはならない。
- `scripts/p0-scratch.ps1`:
  - `Assert-P0Path` で `C:\b\p0\` の下に限ってから、消して作る。そのフォルダを開いているエディタがあれば止まる。
  - git の名前とメールは、そのリポジトリの中だけに設定する（`git config` に `--global` を付けない）。
  - 実物の `C:\b\p0\scratch\` には、見本の11ファイルと `image.png`、`.git`（コミット `d630653`）がある。
- `Stop-P0ProcessTree` は、子孫の一覧を先に集めてから根のプロセスを先に止める（1回目に「extensionHost crashed」が出た件の直し）。止めるのはその木だけ。

### 軽微な点（どれも手の確かめを止める理由にはしない）

- **M1（蒙恬）** `p0-stop.ps1`: 上のとおり、`ExecutablePath` も比べるとよい。
- **M2（蒙恬）** env-setup.md の 5.3 の3: 「タスクの実行（`Terminal > Run Task...`）」を `C:\b\p0\scratch\` の窓で行うと書いてあるが、scratch には tasks.json が無い。自動で見つかるタスクも無いので、一覧が空になる見込み（推定）。`tmp\ws` の窓で `p0-open-terminal` を走らせるか（ファイルは変わらない）、`p0-scratch.ps1` に tasks.json を足すとよい。
- **M3（蒙恬）** env-setup.md の 6節の最初の行が、まだ「ユーザーが `E:\develop\kuebiko` を…clone した」のまま。すぐ下の表は GitHub になっていて、食い違う（L2 の件）。

## 2. argv.json の直し — 合格

- 原因の裏付け: 本家 1.146.0 の `out/mainImpl.js` の168行に、次の処理がある。`["","\t// Allows to disable crash reporting.",…,"\t\"enable-crash-reporter\": ${s},",…,"\t\"crash-reporter-id\": \"…\"","}"]` の行を用意し、`t.substring(0,t.length-2).concat(",\n", …)` でつなぐ。蒙恬の説明（末尾の2文字を切ってつなぐ）と一致する。
- `Write-P0Argv`（`lib/p0-common.ps1` の 195〜210 行）:
  - 設定がある環境は、`ConvertTo-Json` の CRLF を LF にして末尾の空白を落とし、`\n}` で終わることを確かめてから書く。
  - 設定が無い環境は `{\n\t// …コメント…\n}` を書く。
  - 書き方は UTF-8 で BOM なし。`p0-env.ps1` の 102 行がこれを使う。
- 10の環境の `user\argv.json` を確かめた。
  - Grep（multiline）で、10本とも末尾がちょうど `\n}` で、CR も末尾の空白も無いことを見た。
  - 中身: `locale: ja` が7本（upstream-default・testbed・testbed-dotenv-a・testbed-dotenv-b・testbed-measure・langpack-upstream・langpack-testbed）。コメントだけのものが3本（upstream-ai-disabled・ext-allowed・mydist）。env-setup.md の4節と一致する。
- 起動の後の形（コードから導いた。実物では見ていない）:
  - 設定がある環境は、`{\n    "locale":  "ja"` に `,\n\n\t// …\n\t"enable-crash-reporter": …,\n\n\t// …\n\t"crash-reporter-id": "…"\n}` がつながる。正しい JSONC になる。
  - コメントだけの環境は、切った後が `{\n\t// …コメント` で終わる。足される `,` はそのコメントの行の末尾に入るので、これも正しい JSONC になる。
  - 蒙恬が起動した testbed のデータは、その後の `p0-env.ps1 -All` で作り直されて残っていない。実物の起動の後の形は確かめられなかった（蒙恬は2回目の起動の後に確かめたと報告している）。
  - VSCodium の `mainImpl.js` は読んでいない。試験台で起動の後の形が正しかったことは、蒙恬の報告による。
- 作り直した10の環境の残りの中身:
  - 作り直しは 05:59〜06:02 JST。`failed` は全部空。
  - 拡張（`ext\extensions.json` の ID）とユーザー設定（行数）は、1回目に確かめた内容と同じ。

## 3. 曹参の T1 — 合格

- `node tests/sublime-keys.test.mjs`: 50件すべて通過。
- 足したテストは86〜139行。
  - 落ちることを見るもの: 知らない修飾キー6通り（`ctr+shift+[`・`ctrl+shfit+a`・`ctr+k`・`fn+a`・`ctrl+foo+k`・`CTR+SHIFT+[`）、実物の例（前後の項目の順が保たれる）、2段のキーのどちらの段に誤りがあっても落ちること、選ばれた `win` のキーで判定し無視される `key` では判定しないこと。
  - 残ることを見るもの: 知っている修飾キーと別名の12通り、2段のキー・修飾なし・角括弧のキー、別名で書いたキーも衝突の判定に加わること。
- 規則を緩めた箇所は無い。規則を外せば `ctr+shift+[` の項目が残り、テストは落ちる。

## 4. records/phase0/ の清書の書き方（ユーザーの結果が出たら、この形で書く）

ユーザーの記録の置き場所は、env-setup.md の 5.1 にある。項目ごとに `tasks/2026-11-13-p0-envs-mydist-keys/hand-<項目>.md` に、手順書の「記録すること」を表にして書く。清書は、それを手順書と docs/07 に照らして次の形にまとめる。どのファイルも、先頭に条件（環境の名前、本体の版と commit、拡張と版、設定、argv、ワークスペースの commit、日時）と、ユーザーの記録・ログの場所を置く。

| 清書 | docs/07 が求めるもの | 手順書のどこで記録するか | 形 |
|---|---|---|---|
| `upstream-ai-disabled.md`（0-2） | 項目ごとの可否、エラー（2.3 の3〜5） | env-setup.md の 5.3 の1〜5 | (1) 起動と信頼（制限モードから移れたか、folderOpen のタスク）。(2) base の組の表: 項目・可否・メモ。(3) claude-code の組の表: 項目・可否・メモ（表示の場所、`.lock`、パネル、`/ide` の接続、選択範囲、差分、診断）。(4) エラーの写し（開発者ツールの Console、拡張ホストのログ、どのログか）。(5) 画像のプレビューを何が受け持つか（`media-preview` が無いことへの答え）。(6) 通らなかった項目の原因と、docs/03 に足す案 |
| `codeoss-testbed.md`（0-3） | 2.4 の4の5点（消したことによる警告とエラー、proposed API、受け手の無い宣言、basedpyright、.env の2つ） | 5.4 の1〜7 | (1) 試験台の中身（VSCodium 1.143.17232、消した29フォルダ。`env-setup.md` の3節を参照、本家との版の差の注記）。(2) 起動の警告とエラー（3点を分けて表に）。(3) base と claude-code の組の表（0-2 と同じ形で、0-2 との違いの列を足す）。(4) languages の組の表: 言語・補完・診断（内容）。PowerShell のセッションの版も入れる。(5) basedpyright: Python なし / Python を指したとき。(6) .env の比較の表: 拡張・補完・誤りの表示。裁定に沿った結論（片方だけ誤りを表示するならそれを載せる。両方か無しなら、結果を添えて諮る） |
| `language-pack.md`（0-7） | 英語のまま残る場所の記録。目立つ場所があれば一覧を添えて諮る（2.8） | 5.5 の1〜3 | 場所（設定の画面・コマンドパレット・メニュー・Claude Code）×（本家・試験台）の表。値は 日本語 / 一部英語 / 英語。英語の文言の例は3つまで。目立つ印のついた場所の一覧。印があるときは、諮る案（受け入れる / vscode-loc から包む）を添える |
| `extensions-allowed.md`（0-8） | (a)(b)(c) の結果（2.9） | 自動の部分は extensions-allowed.md の2節。手の部分は3節の1〜7 | (1) 条件。(2) (a) CLI の結果（自動。終了コード、文言、一覧とフォルダへの影響、対照、`result.json` の場所）。(3) (b) 画面から入れた2つの VSIX（通知の文言、一覧に増えたか）。(4) (c) Rainbow CSV の表示、無効か、列の色。(5) 許可した Claude Code の状態。(6) 任意の7（設定を外したときにすぐ戻るか）。(7) docs/04 の5節に入れる文の案 |
| `configuration-defaults.md`（0-9） | 各設定の既定値が変わったか（2.10） | configuration-defaults.md の3節の1〜6 | (1) 試作の中身（5項目と値、`main` なし）。(2) 5つの設定の表: 画面の値・Modified の印・既定の JSON の値・期待どおりか。(3) 拡張の状態（Sublime の拡張が許可の一覧で無効か、Claude Code、動作中の一覧に `shuko.mydist` があるか）。(4) キー4つの表: 行の数・ソースの拡張・読み分けの結論。(5) まとめ（変わった / 変わらない。変わらないものは、product.json の上書きか小さなパッチの案に回す）。(6) 0-8 の結果と合わせた、`extensions.allowed` の効き方（CLI・VSIX・すでに入っているもの・組み込み・開発中の拡張） |

「記録すること」の抜けの確認:
- docs/07 の2.3〜2.4・2.8〜2.10 が求める記録は、すべて手順の「記録すること」に入っている。
- 0-2 の「通らない項目の原因を特定し docs/03 に書く」（2.13）は、手の確かめだけでは原因まで分からないことがある。清書では「現象とログ」までを書き、原因の調べはリーダーに回す。

## 直すべき点（担当つき。どれも軽微で、手の確かめを止めない）

| ID | 担当 | 何を | どう直す |
|---|---|---|---|
| M1 | 蒙恬 | `Get-P0MainProcesses` | プロセスの名前に加えて、`ExecutablePath` がその環境の exe と同じことを条件に足す |
| M2 | 蒙恬 | env-setup.md の 5.3 の3 | 「タスクの実行」をする場所を直す（`tmp\ws` の `p0-open-terminal` か、scratch に tasks.json を足す） |
| M3 | 蒙恬 | env-setup.md の 6節の最初の行 | clone の出どころを GitHub に直す（L2 の扱いが決まってから） |

## リーダーへ

- 手の確かめをユーザーに頼んでよい。順は env-setup.md の 5.2（準備）から。
- `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` の削除は、リーダーの担当（蒙恬も私も消す許可を持たない）。
- 1回目の L1（`vscode://` の登録。推定）は env-setup.md の 5.1 に書かれた。L2（clone の出どころ）は M3 とあわせて扱う。

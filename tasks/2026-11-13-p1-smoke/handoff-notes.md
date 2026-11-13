# 引き継ぎ: Phase 1 スモークテストの台本（曹参）

## 結果

**完了。** 公式の zip（`C:\b\p0\vscode-1.146.0\`）に向けて、30 項目の probe を最後まで走らせ、確定した2回で FAIL 0（PASS 43 / 44）。単体テスト 46 件も全部通った。蒙恬のビルド（`C:\b\wt\1.146.0`）には触れていない（調べた時点でそのフォルダはまだ無かった）。

## 成果物

- 台本: `tests/smoke-run.mjs`（入口）、`tests/smoke-launch.mjs`（手の確認用に起動）、`tests/smoke-stop.mjs`（残ったエディタの後始末）
- 部品: `tests/smoke/lib/{common,env,fixtures,run}.mjs`、`tests/smoke/probe/{extension.js,package.json}`（エディタの中から確かめる試験専用の拡張）
- 単体テスト: `tests/smoke.test.mjs`（46 件。`node --test tests/smoke.test.mjs`）
- このディレクトリ: `smoke-design.md`（調べ・対応表・設計・使い方・実行記録）、`manual-checks.md`（手の手順書。14 項目・約 5〜6 分）、この `handoff-notes.md`
- 実行記録の実体: `C:\b\smoke\runs\official-20261113T124945\`（保存）、`...T125044\`（比べ）、誤りの基準 `C:\b\smoke\baseline-official-1.146.0.json`

## 要点

1. **本家の `test/smoke` は `--build` で Windows の公式 zip に向けられる**（`electron.ts` が `product.json` を直下か1段下から探し、`<nameShort>.exe` を使う。公式 zip の版つき配置に合う）。ただし判定には使わない。ソースのコンパイルと Playwright・ネイティブ依存が要り、試験は `vscode-smoketest-express` の固定の件数・ファイル名を前提にし、chat・notebook など消す機能の試験を含み、`VSCODE_PORTABLE` を使わないので普段使いの `argv.json` に触れうる。出典と対応表は `smoke-design.md` の1節。
2. 代わりに「外から（プロセス・ログ・Chromium のログ・`.lock`）＋中から（probe 拡張が API で）」の自前の台本にした。docs/06 の5節の「自」を 30 項目で覆う。起動の注意（`VSCODE_PORTABLE`、`ELECTRON_RUN_AS_NODE`・`VSCODE_*` を外す）、起動した PID の木だけを止める、書き込みを `C:\b\smoke\` に限る、は実装とテストの両方で守った。
3. `claude-code`: 拡張が動作中（`isActive` を台本が `activate()` せずに自然に待つ）、`exthost.log` に起動の行、`~/.claude/ide/<port>.lock`（起動した木のものだけ消す。普段使いのものは触らず、実行中に増えた他人の `.lock` を実際に見分けて残した）。
4. `languages`: TS（診断・補完）、basedpyright（`useBundled` が有効、診断）、HTML/CSS/JSON、Rainbow CSV、dotenv、ShellCheck、PowerShell（PSScriptAnalyzer の診断、pwsh.exe のセッション）まで全部 PASS。
5. 前の版との比べは `--save-baseline` / `--baseline`（誤りの文面から時刻・パス・PID を落とした鍵）。計測と通信の監査はしていない。

## 実行結果

| 種別 | 通った | 落ちた | 切り分け |
|---|---|---|---|
| 単体テスト | 46 | 0 | — |
| 公式 zip の確定した2回（5・6 回目） | 43 / 44 | 0 | — |
| 途中の回（1〜4 回目） | — | 1回目 3、2回目 probe 停止、3回目 2、4回目 1 | 全部テスト（台本）の誤り。下記 |

途中で見つけて直した台本の誤り（実装の不具合ではない）:
- ripgrep の場所は 1.146.0 では `node_modules.asar.unpacked\@vscode\ripgrep-universal\bin\win32-x64\rg.exe`（想定と違った）。
- ローカル履歴の `entries.json` は終了時にしか書かれない。保存された版の本文で見る形にした。
- `.lock` の port と拡張のログの port の照合は、2つめのウィンドウがあると一致しない `.lock` が混ざる。照合を「いずれかと一致」にした。
- probe の結果ファイルの rename が、台本の読み込みと重なって EPERM（Windows）。書き出しを再試行つきにした。
- スニペット・整形は、プレビュー直後にフォーカスが別の場所にあると効かない。フォーカスを戻して再試行する形にした。
- 強制終了の後始末で「Server process exited with code 1」などが残る。止め始めた後の誤りは `errors.teardown` に分けた。
- 3回目の後に、台本が理由不明で終了コード 2 になった回が1つある（標準エラーを読めない形で実行したため原因を取れず、同じ手順の再実行では再現しなかった）。再発に備え、落ちたら標準エラーにスタックを出し、起動したエディタの木を止めるようにした。

## 仕様と実装の食い違い・資料の更新候補（リーダーが決める）

1. **docs/06 の5節「フォルダを開く（制限モード → 信頼する）」は「自」になっているが、台本では確かめられない。** 信頼のダイアログは API から操作できず、ダイアログが出ると無人実行が止まる。台本は信頼を切って走らせ（`security.workspace.trust.enabled=false`）、制限モード → 信頼するは `manual-checks.md` の手 1 に回した。5節の表を「手」に直すか、別の自動化（Playwright など）を足すかは未決。
2. **「`~/.claude/ide/<port>.lock` ができる」は、ウィンドウごとに1個できる。** 2つめのウィンドウを開く実行では2個（pid は同じ本体プロセス）。資料の書き方を「1個以上」にすると、台本と合う。
3. docs/06 の5節の「本家の `test/smoke` を向けられるか Phase 1 で確かめる」は、上の要点 1 のとおり「向けられるが使わない」で確定してよいか。7節の Phase 1 の3「`test/smoke` を `--build` で向けられるか」の記録欄はこれで埋まる。
4. 本家の zip の起動で出る誤り（`AgentHostCustomizationMarketplace ... policy-context-unavailable` が 50 回超、`agentHostManagement` のチャンネルの時間切れなど）はすべて AgentHost 絡み。削る単位 C 系で消えるはず。`smoke-design.md` の 5.2 に表を置いた。

## 権限について（要望）

- `permissions.json` の `write_paths` に `C:/b/` が無い（依頼書には `C:\b\` へ書いてよいとある）。台本は実行時に `C:\b\smoke\` へ書くが、これは Node の子プロセスの書き込みで、フックの対象外のため止まらなかった。書き込みを正式に許すなら `C:/b/smoke/` を `write_paths` に足す必要がある（権限の変更はユーザーの承認が要るので、私は変えていない）。
- 許可の `node tests/*.mjs` の `*` は `/` をまたがない。そのため入口は `tests/` の直下に置いた（`smoke-run.mjs`・`smoke-launch.mjs`・`smoke-stop.mjs`、単体テストは `smoke.test.mjs`）。実体は `tests/smoke/` の下。
- Bash の出力を、背景実行の出力ファイル（一時フォルダ）から読めない（`read_paths` 外）。そのため背景実行をやめ、前面で実行した。
- 台本が落ちて残ったエディタを止める道具は、許可に無い `taskkill` / `Stop-Process` を使わずに済むよう、`tests/smoke-stop.mjs` として Node 側に持たせた。

## 蒙恬のビルドに向けるとき（大岡越前守へ）

```
node tests/smoke-run.mjs --build <出力フォルダ> --label built --mode built --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300
```

- `<出力フォルダ>` は、直下（または1段下の `<commit10>`）に `resources\app\product.json` があり、`<nameShort>.exe` が直下にあること。`product.json` に `"target"` があると台本は止まる（ポータブルにできず、普段使いのデータを避けられないため）。
- `--mode built` は `basedpyright.importStrategy` をユーザー設定に入れない。`lang.py.importStrategy` が、mydist の既定が効いて `useBundled` になっていることを確かめる（落ちたら蒙恬の mydist の不具合）。
- **未検証の見込み**（自作のビルドに向けた実行は、まだ1回もしていない）: mydist の `extensions.allowed`（`"*": false` ほか）が、`--extensionDevelopmentPath` で読み込む probe 拡張を止めると、probe が一つも動かず、台本は `--timeout` まで待つ。`--timeout 300` を付けたのはそのため。そうなったら `base.launch` が FAIL になり、`probe-result.json` が無いので判別できる。そのときは probe の読み込み方を変える（曹参に戻す）。
- 本家との差が出るのが正しい項目: `claude.running`・`lang.*` は同じに通るはず。手の確認の 3（Light Modern）と 4（Sublime のキー）は自作のほうが○になる。
- 消えるはずの機能のうち、エラーの一覧（`errors.*`）は AgentHost 絡みが減る方向に変わる。`errors.new` は「増えた」ものだけを FAIL にする。

## 未解決の点

1. 揺れる誤りの扱い。実測で、同じ本家の zip でも main の `[AgentHost:stderr] Unknown channel: agentHostManagement`（3件）が出る回と出ない回があった。基準を複数回の和集合にする案（例: 3回走らせた鍵の和）を提案する。判断が要る。
2. 本家の `test/smoke` を実際に走らせる（参考として1回）かどうかは、蒙恬のビルドが固まってからのユーザーの判断。前提は `smoke-design.md` の1.4。
3. docs/03 の7節の3「消えている」の自動検査（`absentViews`・`absentSettings`・`absentProcesses`）は本台本の対象外で、Phase 2 の `tests/removals/` で作る。本台本は登録済みコマンドの全一覧（`commands.json`）を実行ごとに残すので、`absentCommands` はその一覧で足りる。
4. 手の確認の 8（.env の補完）は、期待する機能（dotenv 拡張が何を出すか）が資料に無い。ユーザーが決める。
（後始末は下の「差し戻しへの対応」の軽微の項で台本に入れた。以下は初回の記述）
5. 後始末: `C:\b\smoke\runs\` の実行ごとの置き場所は残してある（約 100 MB 前後ずつ）。容量は未測定。要らなければ削除してよい（`C:\b\smoke\ext\` は使い回すので残す）。

---

# 差し戻しへの対応（2026-11-13、検証の不合格 A〜F）

状態: **コードの直しと単体テストまで完了。エディタを起動する実行は、リーダーの「始めてよい」の合図まで一切していない**（通信の監査 0-5 が同じ `Code.exe` で走っているため）。単体テストは 56 件すべて PASS（`node --test tests/smoke.test.mjs`。前回の 46 件に 10 件を足した）。`node --check` も入口 3 本と `run.mjs` で通った。

## 直した内容

| 指摘 | 直し | 確かめ |
|---|---|---|
| A. probe が2つめのウィンドウでも動く | `activate()` の最初で、開いたフォルダが `cfg.ws` でなければ何もせず戻る（結果を作る前に置いた）。`newWindow` のウィンドウは空なので動かない | 単体テスト（ソースの検査）。実機は合図後 |
| B. 置換 | `base.replace` を追加。`workbench.action.replaceInFiles`（`replace_me` → `replaced_ok`）で検索ビューを開き、`search.action.replaceAll` を**待たずに**投げ、`edit/replace.txt` が書き換わるのを30秒待つ（確認のダイアログで止まる版に備えた）。ほかの確認の後、`base.problems` の前に置いた。手の確認に 15（置換）も足した | 単体テスト（コマンド名・ファイル）。**実機で通るかは未確認**。確認のダイアログが出る場合は FAIL になり、詳細にそう書く。その場合の見直しは合図後の実行で決める |
| C. JSON の補完 | `lang.json.completion` を追加。`web/schema-sample.json` の `"$schema": "./schema.json"`（相対パスのローカルの schema。網をつながない）の enum `red` を、`"color": "` の引用符の間で補完させる | 単体テスト（位置が引用符の間であること）。実機は合図後 |
| D. 基準を3回の和に | `--merge-baseline`（`--save-baseline` と併用）を追加。既存の基準と鍵の和を取り、`runs`（何回分か）と `seen`（鍵ごとに何回で見えたか）を残す。古い形式（1回分）も取り込める。`--baseline` は和に対して比べる（従来のまま）。実行の最後に `errors.baseline-saved` を INFO で出す | 単体テスト |
| E. 日本語の表示 | `smoke-launch.mjs` が、既定で一度起動し、`languagepacks.json` ができるのを待ち（最大90秒）、5秒後にその木だけを止めて、起動し直してから手を離す（`--no-prime` で省ける）。`manual-checks.md` の用意と手 2 に、英語なら開き直す手順を足した | 単体テスト（ソースと手順書の検査）。**起動し直しで本当に日本語になるかは未確認**（合図後に確かめる） |
| 軽微 | `smoke-stop.mjs` は `runs` 直下の置き場所だけ受け付ける（`runs` そのもの・孫・外は拒否）。`stopTree` は、木の根の実行ファイルが期待と違えば止めない（PID の使い回し）。`--keep-runs N`（既定 10）で、実行の最後に `runs\` の下の古い置き場所を消す（今回の置き場所と、名前が `<label>-<時刻>` でないものは消さない。`ext\` も触らない） | 単体テスト |
| F. dotenv の2候補の事実 | `lang.env.compare`（INFO。合否に使わない）を追加。誤りを含む `.env.bad`・`bad.env`、通常の `.env` を開き、拡張ごとに: `isActive`、manifest の言語 id と対象のファイル名、各ファイルの `languageId`、診断の件数と中身（出どころ・重さ・行・文言）、`${F` の位置などでの補完の件数と最初の8件、を詳細に残す。`--dotenv a|b` で入れる拡張を切り替える（a = `dotenv.dotenv-vscode`、b = `weixu.wx-vsce-dotenv`。b は拡張フォルダを別に作る） | 単体テスト（項目とファイル）。**事実はまだ取れていない**（合図後に a・b を1回ずつ走らせて報告する） |

## 合図後にやること（予定）

1. 通常の実行を1回: `node tests/smoke-run.mjs`（A〜C の実機確認。`probe-result.json` が `done:true` のまま残ること、`base.replace`・`lang.json.completion` の結果）。
2. 基準を3回で作り直す: `node tests/smoke-run.mjs --save-baseline C:/b/smoke/baseline-official-1.146.0.json`（1回目は上書き）、続けて同じ引数に `--merge-baseline` を付けて2回（計3回）。終わったら `--baseline` で1回比べる。
3. dotenv の比べ: `node tests/smoke-run.mjs --label env-a --groups languages` と `--label env-b --dotenv b --groups languages` を1回ずつ。`lang.env.compare` の詳細を報告に書く（判断はしない）。
4. `node tests/smoke-launch.mjs` で、起動し直しで日本語になるか（E）を確かめる。

## 注意

- `tests/smoke-run.mjs` は、5節に直した docs/06 の「基準は3回の和」に合わせて、`--merge-baseline` を使う手順を `smoke-design.md` の2.5に書き足す予定（合図後の実測と一緒に更新する）。
- （上の2行は合図前の記述。実測は下の「合図後の実行の結果」）

---

# 合図後の実行の結果（2026-11-13）

単体テスト: 60 件すべて PASS（`node --test tests/smoke.test.mjs`）。公式の zip（`C:\b\p0\vscode-1.146.0\`）で、probe の 33 項目が最後まで走り、確定した4回（基準の3回＋比べの1回）は FAIL 0 だった（比べの回は組を絞ったので別の事情で1件落ちた。下の 5）。

## 1. 通常の実行（A・B・C の実機確認）

| 指摘 | 結果 |
|---|---|
| A | 2つめのウィンドウ（`window2`）を開く実行で、`probe-result.json` が `done:true`・33 項目のまま残った。上書きは起きない |
| B（置換） | **最初の直しは通らなかった**。(1) 「すべて置換」（`search.action.replaceAll`）は本物の確認ダイアログが出て API で押せない。(2) `workbench.action.replaceInFiles` の引数は検索語に効かず、先に `base.search` を走らせると前の検索語と空の置換語が検索ビューに残り、**別のファイル（`docs/readme.md` の `smoke_needle` の行）を空に置換してしまった**。直し: 置換を `base.search` の前に移し、`workbench.action.findInFiles` の `query`/`replace` 引数で検索語と置換語を渡し、`search.action.focusSearchList` → `focusNextSearchResult` → `search.action.replace`（1件置換。確認なし）で、`edit/replace.txt` の `replace_me` → `replaced_ok` がディスクに現れるのを見る。直した後は 8 回すべて PASS |
| C（JSON の補完） | `$schema`（ローカルの `schema.json`）の enum の補完は通った。ただしラベルが引用符つき（`"blue","green","red"`）で返る。引用符を外して比べる形に直した |

実機で見つけて直した台本の誤り（ほか）:
- スニペット・整形（`editor.action.insertSnippet` / `formatDocument`）が、フォーカス次第で効かない回があった（フォーカスを戻す再試行でも直らなかった）。フォーカスに頼らない API（`TextEditor.insertSnippet`、`vscode.executeFormatDocumentProvider` で得た編集の適用）に替えた。以後 8 回すべて PASS。
- 止めた後の木の確認で「残り 1」の回があった。木が消えるのを最大 15 秒待つ形にした。
- **台本が理由不明の終了コード 2 になった原因を特定した**（初回の報告の「理由不明の1回」）: `Get-CimInstance` の JSON を OEM コードページ（cp932）で受けていたため、**日本語のコマンドラインを持つ別のプロセス**があるだけで JSON が壊れていた。PowerShell の出力を UTF-8 に固定し、読めないときは数回やり直して、それでも読めなければ投げる（空を返して「止める木が無い」と誤らない）形にした。
- `base.problems` は、`languages` の組を走らせないと診断が 0 件になって落ちる。`languages` を含むときだけ走らせる形にした。

## 2. 基準を3回の和で作り直した（D）

- `C:\b\smoke\baseline-official-1.146.0.json`: **`runs: 3`、鍵 4 個、各鍵が 3 回とも出ている**（`seen` が 3、3、3、3）。`--prime`（日本語の表示）で作った（下の 4 のとおり、日本語にすると増える誤りがあるため）。手順は `--prime --save-baseline <json>`（1回目は上書き）、続けて `--prime --save-baseline <json> --merge-baseline` を2回。
- 4 個の鍵（本家の zip・日本語・Claude Code 入り）:
  1. `renderer|[AgentHostCustomizationMarketplace] Unable to load session-bound SDK installation receipts ... (refused: policy-context-unavailable)`
  2. `renderer|Error: TextModel got disposed before DiffEditorWidget model got reset`（差分ビューを開く確認が出す）
  3. `renderer|[Extension Host] (node:<n>) [DEP0169] DeprecationWarning: url.parse() ...`
  4. `exthost|No bundle location found for extension TypeScriptTeam.jsts-chat-features`（言語パック 1.131.0 に、この拡張の翻訳のまとまりが無い。docs/07 の 0-7「言語パックの版のずれ」の実機の現れ）
- 以前の基準（1回分）に入っていた main の `Unknown channel: agentHostManagement` は、3回の和には出なかった（揺れる誤り。出ない回が多い）。止めた後の `[AgentHost:stderr] TypeError: this._token.cancel is not a function` は後始末の誤りとして数えない（毎回出る）。
- 比べの回（`--baseline` ）は「新しい誤りなし」で PASS。

## 3. 言語パックと表示（E）

- 新しいユーザーデータで1回だけ起動すると `vscode.env.language` は `en`（これまでの全 7 回の実行と同じ）。`--prime`（一度起動して `languagepacks.json` ができたら止め、起動し直す）を付けると **`ja`** になった（`base.ui-language` が PASS。基準の3回と比べの回の計4回すべて）。
- `smoke-launch.mjs` も同じ手順で動き、起動し直した窓の置き場所に `clp\...ja\nls.messages.json`（日本語の翻訳のまとまり）ができていた。ただし画面の目視はしていない（`vscode.env.language` を直接見たのは `smoke-run.mjs --prime` のほう）。

## 4. 日本語にすると増える誤りの注意

`--prime` なし（英語）の基準で比べると、日本語の実行は `exthost|No bundle location found for extension TypeScriptTeam.jsts-chat-features`（2件）が「新しい誤り」になって落ちる。基準と比べる実行は、**基準と同じ `--prime` の有無**にそろえる。

## 5. 落ちた1件（組を絞った実行）

比べの回は `--groups base,claude-code` で走らせたため、診断を出す `languages` が無く `base.problems` が 0 件で落ちた（上の 1 のとおり直した。直した後の再実行はしていない。単体テストで確かめた）。

## 6. dotenv の2候補の事実（F。判断はしない）

どちらも manifest が定める対象のファイル名と言語 id は `dotenv`。同じ3ファイルを開いた（`.env` は正常、`.env.bad`・`bad.env` は誤りを含む。内容は `GOOD=1` / `BAD LINE WITHOUT EQUALS` / `=NOKEY` / `DUP=1` / `DUP=2` / `UNCLOSED="abc`）。

| 項目 | `dotenv.dotenv-vscode` 1.5.8 | `weixu.wx-vsce-dotenv` 0.2.3 |
|---|---|---|
| 動作中（`isActive`） | true | true |
| 言語 id・対象 | `dotenv`（`.env*`、`.env`、`.flaskenv`） | `dotenv`（`.env`、`.env.local`、`.env.production` など多数、`*.env` ほか） |
| 3ファイルの `languageId` | すべて `dotenv` | すべて `dotenv` |
| `.env`（正常）の診断 | 0 件 | 0 件 |
| `.env.bad` の診断 | **0 件** | **4 件**（`ENV002` 行が空・コメント・代入のどれでもない [警告]、`ENV007` 代入にキーが無い [エラー]、`ENV004` 閉じていない二重引用符 [エラー]、`ENV005` キー `DUP` の重複 [警告]。出どころ名は無し） |
| `bad.env` の診断 | **0 件** | **4 件**（同上） |
| 補完（`FOO=` の直後） | 12 件（`abc,BAD,BAZ,DUP,EQUALS,F,FOO,GOOD` ほか。ファイル中の単語。拡張固有かは分からない） | 12 件（同じ並び） |
| 補完（`${F` の位置） | 12 件（`abc,BAD,bar,BAZ,DUP,EQUALS,FOO,GOOD` ほか。上と同種の単語） | **1 件**（`FOO`。変数参照の補完） |

実行: `official-20261113T140310`（a）、`env-b-20261113T140401`（b、`--dotenv b --groups languages`）。詳細は各 `probe-result.json` の `lang.env.compare`。補完の「単語」の12件は VS Code 本体の単語補完とみられる（拡張が出したかは未確認）。ほかの機能（ホバー、フォーマットなど）は見ていない。

## 7. そのほか（軽微の対応）

- `--keep-runs N`（既定 10）で `runs\` の古い置き場所を消す動作は、単体テストで確かめた（実機の実行でも毎回呼ばれ、消すのは `runs\` の下の古いものだけ）。`smoke-stop.mjs` は `runs` 直下の置き場所だけ受け付ける。
- `.lock` は、`--prime` の実行で3個になる（`prime` で起動した最初のエディタが作った `.lock` が残るため）。pid が起動した木でなくても、開いたフォルダ（`ws`）が一致するため、台本は自分のものとして後始末する。`prime` の本体は止めた後に `.lock` が残るので、これは正しい動作。普段使いの `.lock` は、フォルダも pid も違うので残る。

## 次にやること

- 蒙恬のビルドが出たら、`node tests/smoke-run.mjs --build <出力フォルダ> --label built --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300`（`--prime` の有無は基準にそろえる）。
- docs/06 の5節に、`--prime` を使うこと、基準を `--prime --save-baseline` / `--merge-baseline` で作ることを足すかはリーダーが決める。

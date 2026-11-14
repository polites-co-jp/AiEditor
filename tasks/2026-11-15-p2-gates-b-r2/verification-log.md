# 検証の記録: B-1 の直し・build.mjs の直しと、B-1〜B-7（-r2）の関門

- 検証: 大岡越前守、2026-11-15（JST 00:00〜01:00 ごろ。台本の置き場所の時刻は UTC で、+9 時間が JST）
- 依頼: `brief.md`（このフォルダ）
- 権限: `team/departments/development/ooka-echizen/permissions.json` を読んでから始めた
- 守ったこと: コードは直していない。書き込みは `records/take-in/`・`records/network-audits/`（台本が書く）・このフォルダ、台本が作る `C:\b\smoke\`・`C:\b\p0\run\`・`C:\b\p0\netlog\` だけ。スモークは1つずつ走らせた（通信の監査はスモークと時間が重なった。どれも自分の起動した木だけを見る。前回の関門と同じ）

## 1. レビュー

### 1.1 B-1 の edits.patch（蒙恬）

`git diff -- removals/B-1-telemetry scripts/build.mjs` で読んだ。

| 見たこと | 結果 |
|---|---|
| 3つの登録の中身 | `aiEditTelemetryService.ts` の末尾で `CommandsRegistry.registerCommand('_aiEdits.hasAiContributions', () => false)`。`clearAiContributions`・`clearAllAiContributions` は `() => { }`。本家 1.146.0（`C:\b\wt\1.146.0`）の `editTelemetryContribution.ts` 57〜59行の「何もしない代わり」と同じ。本物（`aiContributionFeature.ts` 58〜68行）は `git.addAICoAuthor` が off でないときだけ上書きする。消した後は常に何もしない側になり、本家で AI の部品が働かないときの振る舞いと同じ |
| import と hunk | `../../../../../../platform/commands/common/commands.js`（同じファイルのほかの import と同じ深さ）。hunk の行数 `-6,6 +6,8`・`-103,3 +105,28` は本文と合う |
| 呼び手が他に無いか | `C:\b\wt\1.146.0` の `src/`・`extensions/` を `_aiEdits\.` で Grep した。呼ぶのは `extensions/git/src/repository.ts` の8か所だけ。登録は消した2ファイルと試験だけ |
| 出力に入ったか | -r2 の7版とも、`out\vs\workbench\workbench.desktop.main.js` に3つの `registerCommand("_aiEdits.…",()…` がある（Grep） |
| unit.json | `kept` の理由に3つのコマンドを書き足した。`checks.absentCommands` は `[]`（裁定 2026-11-14 で認められたもの） |
| README | 「残すもの」に3つのコマンドと呼び手の行番号、「消えたことの確かめ方」に `showTelemetry` を外した理由、「影響しうるもの」にエージェントのホスト、「壊れたときの症状」に `command '_aiEdits.…' not found` がある。docs/03 の5.3（共有のファイルをパッチに入れない）を理由に新しいファイルにしなかった点も合う |

判定: **合格。**

### 1.2 build.mjs の2点（蒙恬）

| 直し | 読んだこと | 結果 |
|---|---|---|
| `childEnv` が外の `BUILD_SOURCEVERSION` を外す | 正規表現は `/^(ELECTRON_RUN_AS_NODE\|ELECTRON_NO_ATTACH_CONSOLE\|BUILD_SOURCEVERSION)$/i` で、名前の大文字小文字を問わない。`extra` の値は後から足すので残る。型検査・パッケージ化には `stepEnv` が作業ツリーの HEAD を入れる（前からの作り） | 合う |
| 版の commit に枝 `builds/<label>` | `buildBranchName` はラベルの形と ref の規則（`..`・`.lock`・末尾の `.`）を見る。`markBuildCommit` は「読む → 同じなら unchanged → `branch --force --no-track` → 読み直して一致を確かめる」の順。例外にせず `ok: false` で返し、main は `warnings` に書く（止めない）。main で付けるのは `envForStep`（型検査・パッケージ化）と、後処理で `productCommit.ok` のときだけ。dry-run と `--no-branch` では付けない | 合う |
| 実の版での結果 | 7版の `build-record-install.json` は `branch.action: created`、`build-record.json` は `unchanged`。どちらも `ok: true`。常設の clone の refs（`C:\b\vscode\.git\packed-refs` に B-1〜B-5、`refs\heads\builds\` に B-6・B-7）は7つとも builds.md の commit と一致。`envRemovedForChildren` に `BUILD_SOURCEVERSION` は無い（親の環境に無かったため。外す働きは曹参のテストで見ている） | 合う |

判定: **合格。** docs との食い違いは、リーダーが直している途中（作業ツリーの `docs/02` の4節の8に枝の行、`docs/03` の4節の B-1 に `_aiEdits.*` の行が足されている。docs/02 の7節の記録の例の `branch` は未確認）。

### 1.3 曹参のテスト（`tests/build-env-branch.test.mjs`、29件）

- childEnv の4件: 大文字小文字の違う3つの名前が外れ、`removed` に名前だけ出て値は出ない。似た名前（`MY_BUILD_SOURCEVERSION`・`BUILD_SOURCEVERSION2`）は外さない。読んだ限り、正規表現を前に戻すと1件目と3件目が落ちる
- markBuildCommit: 偽の `runGit` で、created・unchanged（branch を呼ばない）・moved・128・読み直しの食い違い・例外・不正な入力（runGit を呼ばない）・小文字と trim を見る。実の一時リポジトリで、created・unchanged・moved・存在しない commit を見る
- main の結線: dry-run（`plan.branch` が出て、枝はできない）、後処理（一致なら枝が付く。欠け・食い違い・40桁でないときは止まり、枝を付けない。`--no-branch`。付け替えの警告）、型検査から（pnpm があれば）、外の `BUILD_SOURCEVERSION` を親に置いた dry-run（値が記録に出ない）
- `node --test tests/build-env-branch.test.mjs tests/build-commit.test.mjs tests/build-parts.test.mjs`: 88件、合格 88、落ち 0（29 + 21 + 38）
- 実装に合わせて緩めた断言は見つからなかった。弱い点（合否に使わない）は2つ。「リポジトリでない場所」の件は `ok: false` だけを見ていて、コメントにある「親に枝ができないこと」は断言していない。外の値が子に渡らないことは dry-run の記録で見ていて、実際の子のプロセスの環境は見ていない

## 2. 版ごとの関門の1〜4

### 2.1 1・2（当たる・型検査とビルド）

- `sha256sum C:/b/dist/1.146.0-p2-B-{1..7}-r2.zip`（7つを1回で）: 7つとも builds.md の値と一致
- `checks.json`（7つ）: `result: ok`。次のものを Grep で探して 0 件だった:
  - `"applied": "(conflict|fail|error|skipped|partial)"` と `"ok": false`
  - 空でない `warnings`・`errors`・`conflicts`・`missingDeletes`・`missingDependencies`・`productMissing`・`manifestsMissing`
  - ロックファイルの `unexpected*`・`added*`・`changed*` の空でない配列
- 同じく `checks.json` の `status` は ok・upstream・referenced・lockManifest・extension・removed・skipped・info だけ。absentStrings の `hitCount` はすべて 0
- `build-record-install.json`・`build-record.json`（14）: `result: ok`、`exitCode` は 0 だけ、`warnings: []`、`matchesChecksHead: true`、`productCommit.ok: true`（commit = expected）。組み込み拡張は 65 で、`residual`・`missingKeep`・`unexpected` は空
- 展開した `resources\app\product.json` の commit: 7版とも builds.md の commit と一致
- `launch-check.json`（7）: `result: ok`

### 2.2 3（消えている）

前の版で `--expect present`、その版で `--expect absent` を流した（`node tests/absent-run.mjs`。置き場所は `C:\b\smoke\absent\` の下）。

| 単位 | 前の版（present） | この版（absent） | 置き場所 |
|---|---|---|---|
| B-1 | A-7: pass 2 | B-1-r2: pass 2 / fail 0 / unknown 0 | `r2-prev-B-1-on-A-7-20261114T150905`、`r2-B-1-20261114T150925` |
| B-2 | B-1-r2: pass 8 | B-2-r2: pass 8 / 0 / 0 | `r2-prev-B-2-on-B-1-r2-20261114T151056`、`r2-B-2-20261114T151112` |
| B-3 | B-2-r2: pass 4 | B-3-r2: pass 4 / 0 / 0 | `r2-prev-B-3-on-B-2-r2-20261114T151128`、`r2-B-3-20261114T151144` |
| B-4 | B-3-r2: pass 7 | B-4-r2: pass 7 / 0 / 0 | `r2-prev-B-4-on-B-3-r2-20261114T151211`、`r2-B-4-20261114T151227` |
| B-5 | B-4-r2: pass 6 | B-5-r2: pass 6 / 0 / 0 | `r2-prev-B-5-on-B-4-r2-20261114T151243`、`r2-B-5-20261114T151259` |
| B-6 | （台本で見る項目なし） | — | — |
| B-7 | B-6-r2: pass 4 | B-7-r2: pass 4 / 0 / 0 | `r2-prev-B-7-on-B-6-r2-20261114T151323`、`r2-B-7-20261114T151338` |
| A・B の全部（12単位） | — | B-7-r2: 全部 fail 0・unknown 0 | `r2-B-7-all-AB-20261114T151353` |

公式の zip（`C:\b\p0\vscode-1.146.0`）にも、B の6単位を今の unit.json で `--expect present` で流した。結果は B-1 2・B-2 8・B-3 4・B-4 7・B-5 6・B-7 4 で、すべて pass（`r2-official-B-20261114T153539`）。

absentHosts（B-1・B-2・B-6）は前回の結果を流用せず、`scripts/netaudit.ps1` を前回と同じ環境（`tasks/2026-11-14-p2-gates/netaudit-env`）・600 秒で流した。

| 版 | 結果 | 置き場所 |
|---|---|---|
| B-1-r2（前: A-7） | エディタ 0・claude 0・許可の外 0・新しい宛先 0 | `records/network-audits/2026-11-15-p2gate-B-1-r2/` |
| B-2-r2（前: B-1-r2） | 同上 | `records/network-audits/2026-11-15-p2gate-B-2-r2/` |
| B-6-r2（前: B-1-r2） | 同上 | `records/network-audits/2026-11-15-p2gate-B-6-r2/` |

名前で見えたのは、3回とも `wpad`（80 番、解決2回、答え無し）だけ。-r2 の7版の product.json にも `enableTelemetry`・`aiConfig`・`tasConfig`・`emergencyAlertUrl` は無い（Grep）。そのため単位の効き目そのものが監査で見えない点は、前回と同じ。

「在る」の確かめ（判定に使っていない）: `_aiEdits.*` を `--cmd … --expect present` で B-1-r2・前の B-1・A-7 に流すと、3版とも「無い」になった。probe が `vscode.commands.getCommands(true)` で `_` で始まるコマンドを除くため、本家の A-7 でも見えない。この網では見られない（4節）。

### 2.3 4（壊れていない）

コマンドの形は `node tests/smoke-run.mjs --build <版> --label p2-<id>-r2 --mode built --prime --baseline <前の版の基準> --save-baseline C:/b/smoke/baseline-p2-<id>-r2.json --timeout 300 --keep-runs 40`。組は台本の既定（base・claude-code・languages）で、どの単位の `smoke` の組も含む（absence は2.2で見た）。

| 版 | 基準 | 結果 | 誤り（exthost/renderer/other） | 置き場所（`C:\b\smoke\runs\`） |
|---|---|---|---|---|
| B-1-r2 | A-7 | PASS 49 / FAIL 0 | 3/2/2 | `p2-B-1-r2-20261114T151446` |
| B-2-r2 | B-1-r2 | PASS 49 / FAIL 0（2回） | 2/2/2、3/2/2 | `p2-B-2-r2-20261114T151630`、`p2-B-2-r2-run2-20261114T151956` |
| B-3-r2 | B-2-r2 | 1回目 PASS 48 / FAIL 1、2回目 PASS 49 / FAIL 0 | 3/2/2、3/2/2 | `p2-B-3-r2-20261114T151804`、`p2-B-3-r2-run2-20261114T152125` |
| B-4-r2 | B-3-r2 | PASS 49 / FAIL 0 | 1/2/2 | `p2-B-4-r2-20261114T152253` |
| B-5-r2 | B-4-r2 | PASS 49 / FAIL 0 | 1/2/2 | `p2-B-5-r2-20261114T152438` |
| B-6-r2 | B-5-r2 | PASS 49 / FAIL 0 | 1/2/2 | `p2-B-6-r2-20261114T152608` |
| B-7-r2 | B-6-r2 | PASS 49 / FAIL 0 | 1/2/2 | `p2-B-7-r2-20261114T152738` |

- B-1-r2: base.git「コミットできた」の後も、`_aiEdits` の行はどのログにも無い（`p2-B-*-r2*\logs\**\*.log` を Grep して 0 件）。前回の不合格は消えた
- B-3-r2 の1回目の FAIL は `[exthost] Remote Control auto-enable failed: Error: Remote Control initialization failed`。B-2-r2 の1回目にだけこの鍵が出ず、基準から抜けていたために落ちた
  - この誤りは A-7・B-1-r2 の基準にあり、B-2-r2 の2回目にも出た。出たり出なかったりする誤り（Claude Code 拡張）で、B-3 が足したものではない
  - B-2-r2 の基準を2回の和にして B-3-r2 を流し直し、PASS になった
- 誤りの鍵の数: A-7・B-1-r2・B-2-r2（和）・B-3-r2（和）は5個、B-4-r2〜B-7-r2 は4個（notion-sync の誤りが消えた。3節）。前の版に無い鍵は、B-3-r2 の1回目の揺れのほかに無い
- claude-code の組（claude.running・claude.exthost-log・claude.lock）は、全部の回で PASS

## 3. notion-sync の翻訳の直し

| 版 | `dist/i18n/shuko.notion-sync.ja.i18n.json` | `contributes.localizations` | errors の `No bundle location found for extension shuko.notion-sync` |
|---|---|---|---|
| B-1-r2・B-2-r2・B-3-r2 | 無い | 無い | 出る（window1・window2 の exthost.log） |
| B-4-r2・B-5-r2・B-6-r2・B-7-r2 | 在る（`{"version":"1.0.0","contents":{"package":{},"bundle":{}}}`） | 在る（`ja`。自分の ID を束に向ける1件） | **出ない** |

- B-1-r2〜B-3-r2 は、作り直しが翻訳の直しより前だった。`checks.json` の `builtinExtensions` でも、notion-sync はこの3版が4ファイルで、B-4-r2 から5ファイル
- B-4-r2 以降: 拡張ホストのログに `_doActivateExtension shuko.notion-sync` があり、`[error]` は無い。`languagepacks.json` の `ja` に `shuko.notion-sync` が言語パックと並んで入る。本体の翻訳（`vscode`）は言語パックのファイルを指していて、base.ui-language は PASS

判定: **束が入っている版（B-4-r2 以降）で、誤りは消えた。**

## 4. 気づいた点（合否に使っていない）

- 「在る」ことの網: 台本の runtime の網は `getCommands(true)` で、内部のコマンド（`_` で始まるもの）を見ない。B-1 の `_aiEdits.*` のような「消した部品の ID を、何もしない実装で残す」ものは台本では確かめられない（蒙恬の覚えにある docs/03 の7節の件と同じ根）。今はスモークの errors.new と出力の文字列で見ている
- 揺れる誤り `Remote Control auto-enable failed` は、1回だけで作った基準からは抜けることがある。基準を2回以上の和にすれば、空振りの FAIL が減る
- B-7-r2 は、`enabled` が A-3・A-6・B-5・B-6 だけ true の状態で、`--only` で当てた版。全部を `enabled: true` にした版は別に作る（brief の「次の担当」）
- 曹参の覚えにある「`removals.test.mjs` の飛ばしが 21 から 12 に減った」の理由は、B-1 の直しではない。`enabled: true` の単位が 9 になったため（コミット `6ba9e53` で A-1・A-2・A-4・A-5・A-7 を有効にした）。この試験（128行）は、有効でない単位の1件を飛ばす。単位は全部で21、無効は12
- 前回の B-1〜B-7（`-r2` の付かない版）の展開した場所と zip は残っている（片づけはリーダーの判断）

## 5. テスト

```
node tests/run-all.mjs --save tasks/2026-11-15-p2-gates-b-r2/run-all-counts.txt
```

- 最後に流した（スモーク・通信の監査・absent-run がすべて終わった後。曹参の完了の覚えが出た後）
- 終了コード 0。**TOTAL tests 1581、pass 1569、fail 0、skip 12**（曹参の報告と同じ）
- 曹参のテスト `build-env-branch.test.mjs` は **入っていた**（29件、合格 29）
- 作業ツリーの状態: B-1 の直し（`removals/B-1-telemetry/` の3ファイル）と `scripts/build.mjs` の直しは未コミットのまま入っている。`enabled: true` は9単位（コミット `6ba9e53` の時点のまま。流している間に `removals/A-*` の変更は無かった）。ほかに docs/02・docs/03 の書き換えの途中の変更と、`tests/p34*` などの未追跡のファイルがある
- skip 12 は全部 `removals.test.mjs`（無効の12単位）。ps1 は measure 138・netaudit 102 で、どちらも落ち 0

判定: **合格。**

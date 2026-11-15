# Phase 5 の下ごしらえ（C-2 の検査とテスト）の引き継ぎ

曹参から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。依頼の1〜5がそろい、`node tests/run-all.mjs` の fail は 0（下の「実行結果」）。

## 成果物

すべて `tests/` の下（照らし役は直下）。本体のコード、`removals/`、`docs/` は直していない。

| ファイル | 中身 | 件数 |
|---|---|---|
| `tests/c2-unit.test.mjs` | 単位のファイルの静的な検査、何もしない実装の検査（文字列と構文）、何もしない実装を走らせる検査 | 56 |
| `tests/c2-mutation.test.mjs` | 壊した写しで `c2-unit.test.mjs` が落ちること（対照1 + 壊し方46） | 47 |
| `tests/c2-check-json.mjs` | 照らし役。当て直しの記録（a・b）と型検査の記録を照らす。使い方 `node tests/c2-check-json.mjs <checks.json> [<typecheck.json>]` | — |
| `tests/c2-check-json.test.mjs` | 照らし役の検査。蒙恬の実記録（`tasks/2026-11-15-p5-c2-patch/trial/checks-verify-{a,b}.json`・`build-typecheck-verify-{a,b}.json`）で「期待どおり」、壊した記録で食い違い | 11 |
| `tests/c2-check-worktree.mjs` | 照らし役。当てた後の木を照らす（入口の5）。使い方 `node tests/c2-check-worktree.mjs <作業ツリー>` | — |
| `tests/c2-worktree.test.mjs` | 照らし役の検査。本家 1.146.0 に `removeLines` と `edits.patch` を当てた木を一時のフォルダに作り、期待どおり・壊した木を照らす | 22 |
| `tests/removals/c2-gate-script.md` | 大岡越前守の台本（入口の1〜3・5・7、走らせる形の4） | — |
| `tasks/2026-11-15-p5-c2-tests/run-all-result.txt` | `run-all --save` の結果（PowerShell のテスト込み） | — |
| `tasks/2026-11-15-p5-c2-tests/run-all-no-ps-result.txt` | `run-all --no-ps --save` の結果。確認のためもう1回走らせた分（終わっていれば残る）。`rm` が無く消せない。無視してよい | — |

## 要点

1. `c2-unit.test.mjs` の内訳は、単位の静的な検査 39 本、何もしない実装の文字列と構文 10 本、走らせる 7 本。C-1 の形に加えて、C-2 の仕様から次を足した。
   - `workbench.*.main.ts` に触るのは `workbench.common.main.ts` の Debug の節の1行の追加だけ（案A の例外。足す行が `// Debug` の次にあること）。
   - `extHost.api.impl.ts` の変更は3か所だけ（import の差し替え、作る1行の削除、`const debug` の右辺。消す塊は途切れない1つ）。
   - `extHost.protocol.ts` は削除だけ。ID と common の import は `removeLines` にあり、パッチと二重に消さない。
   - **C-1 との独立**: C-1 の `edits.patch` が消す行を C-2 のハンクが文脈や削除にしていないこと（3-way に頼らない形。入口の3の静的な代わり）。
   - `removeLines` の行が本家のそのファイルにある。glob `debug/browser/media/*.png` に当たる png が全部 `delete` にある（残る CSS を巻き込まない）。
2. 何もしない実装は、文字列と構文（20メンバーの網羅、`Event.None` 6つ、`register*` と提案中2つの門、`startDebugging` の `false`、何もしないコンソール、通信・タイマー・RPC・DI が無い）に加えて、**型を外した本文を node で走らせる**検査を足した（`module.stripTypeScriptTypes`、import は模擬。入口の6の振る舞いをほぼそのまま）。node に無ければ飛ばす。実行時に ExperimentalWarning が stderr に出るが害は無い。
3. 当てた後の木の照らし役は、**本家 1.146.0 に `removeLines` と `edits.patch` を自前の小さな当て方で当てた木**で「期待どおり」を確かめた。副産物として、edits.patch は A・B の単位を挟まない本家そのものにも、全ハンクが衝突なく当たる。
4. 照らし役は a（15単位）と b（16単位。C-1 の後に C-2）を、記録の単位の並びで見分ける。b の `warnings` は `debugChatIntegration.ts` の1件だけを許し、a は 0 件を求める。
5. 壊した写しの検査は、仕様のどの項目も「落ちる」ことを確かめた（壊し方46）。空振りの検査は無い。

## 実行結果

- `node tests/run-all.mjs --save tasks/2026-11-15-p5-c2-tests/run-all-result.txt`: **1843 tests、pass 1836、fail 0、skip 7**。skip の7は `removals.test.mjs` の既存分（C-2 のテストの skip は 0）。
- C-2 の4ファイル: 136 tests、pass 136、fail 0、skip 0。
- 作る途中で落ちた3本は、すべて**テストの誤り**で、その場で直した。
  - C-1 との独立の検査が、`name: string;` のようなどこにでもあるプロパティ宣言の行まで重なりと見た（短い行・プロパティ宣言を数えないようにした）。
  - `IExtensionDescription` が `export type` のため、export の確認の正規表現が外していた。
  - 下の「仕様と実装についての指摘」の1（空振りの absentStrings 2つ）。**実装の不具合ではなく、前からの仕様の弱さ**。テストは既知の2つを除いて通し、別のテストでその2つが今も空振りであることを見張る形にした。
- 実装の不具合は見つかっていない。

## 仕様から想定した入口

実装（蒙恬の edits.patch、unit.json）が先にあったので、想定の入口は無い。ただし、次は仕様の側から取った（実装に合わせて書き換えていない）。

- 消す前の `vscode.debug` の20メンバーの一覧は、edits.patch が**消す**塊（`const debug: typeof vscode.debug = {`）から読み、何もしない実装の側と突き合わせる。
- 誤りの文言は本家 `extHostDebugService.ts` の文字列と突き合わせる。
- 壊し方の文字列の置き換えは、edits.patch の文言に依存する（C-1 と同じ。パッチの文言を直したら `c2-mutation.test.mjs` の置き換えが当たらず、「置き換えが当たらない」で落ちる。落ちたら置き換えを直す）。

## 大岡越前守向けの台本の入口

`tests/removals/c2-gate-script.md`。

- 1a・1b: 当て直し a・b の `apply.mjs` と `node tests/c2-check-json.mjs <checks.json>`（期待の表は a・b 並べた）
- 1c: `node tests/c2-check-worktree.mjs C:/b/wt/p2`（入口の5）
- 1d: ロックファイル（`--lockfile-check`）
- 1e: b の C-2 の ops の commit での `git apply --check`（入口の3。**曹参の許可に `git -C` と `git checkout` が無く、走らせていない**。静的な代わりは `c2-unit.test.mjs` の「独立」）
- 2: 型検査（a・b それぞれの上）
- 4: 本物の型の上で走らせる形（作業ツリーにテストを足す。書くのは蒙恬か大岡越前守。任意）
- 5: 関門のスモーク（入口の7。UNKNOWN service・Missing proxy instance、F5・余白、テストのビューの呼び出し履歴、PowerShell 拡張の警告の記録）

## 仕様と実装についての指摘

1. **前からの `checks.absentStrings` 2つが空振り**（直す・残すの判断を仰ぐ）。`debug/browser/debugService.js'` と `debug/browser/linkDetector.js'`（`in: ["src/vs"]`）は、本家 1.146.0 の `src/vs` のどこにも文字列として無い（`git grep` と、常設の clone の作業ツリーの `src/vs/workbench` の検索の両方で確かめた。`./debugService.js'` のようにフォルダ名なしの import だけがある）。このままでは、消し損ねても当たらず、docs/03 の6節の「参照の残り」が働かない。直すなら、文字列を `./debugService.js'`（`in: ["src/vs/workbench/contrib/debug"]`、kept の `debug.service.contribution.ts` を除く）のように本家にある形へ替える。`c2-unit.test.mjs` の `KNOWN_DEAD_ABSENT` に2つを書いてあり、直したら外す。
2. **README の最後の項が古くなる**。「`vscode.debug` の何もしない実装と、直したノートブックの部品のテストは、まだ書いていない（曹参の担当）」は、静的・走らせる形の検査を書いたので、「`tests/c2-*.test.mjs` に書いた。VS Code のテストの仕組みで走らせる形は未実行（台本の4）」に直す。
3. docs/03 の4節の表（132行）の C-2 の「desktop の1行」の食い違いは、蒙恬の引き継ぎのとおりまだ残る。テストは**消さない**側（`removeLines` が desktop・web の `extensionHostDebugService` の import に触れない）を守っている。
4. b の組では、C-1 と C-2 の `delete` が `debugChatIntegration.ts` で重なる。C-2 の側が「本家に無い」警告になる（想定済み。照らし役は1件だけ許す）。どちらかの `delete` から外せば警告は消える。単位を独立に保つ（5.3）には、重なりは持たない方がよい。判断はリーダー。
5. `removeLines` は、残す `callStackEditorContribution.ts` の import（`workbench.common.main.ts`）を消す（README の「残すもの」に理由がある）。テストでは、この1行と、`extHost.protocol.ts`・`repl.contribution.ts` の common の import を「残る部品への import だが、使い手が消えて使われなくなる行」の例外として、名前を挙げて許している（`c2-unit.test.mjs` の `EXCEPT`）。増えたら、その都度理由とともに足す。

## 2回目（2026-11-15、指摘の扱いを受けて）

リーダーの扱い: 指摘1・2は蒙恬が直す。指摘4（`debugChatIntegration.ts` の重なり）はそのままにし、照らし役の「1件だけ許す」も今のまま。

- 蒙恬が `removals/C-2-debug/unit.json` の `checks.absentStrings` の2つを `/debugService.js'`・`/linkDetector.js'` に替えた（`tasks/2026-11-15-p5-c2-patch/handoff-notes.md` の「2回目」）。
- `tests/c2-unit.test.mjs` から `KNOWN_DEAD_ABSENT` と、その2つの見張りのテストを外した。absentStrings の本家確認は、除外なしで全項目を見る。
- 空振りの再発を防ぐテストを1本足した: **`absentStrings` の各項目は、本家の `kept` でないファイルに当たる**こと（`kept` だけに当たる文字列は検査から外れて何も守らない）。蒙恬が「例の形を採らなかった理由」に書いた落とし穴（`./debugService.js'` は `kept` の `debug.service.contribution.ts` にしか当たらない）を、機械で見張る。新しい2つを含め、15項目すべて通る。
- 壊した写しの検査に1つ足した（`kept` にしか当たらない文字列 `export class NullDebugService` を足すと落ちる）。
- 結果: `c2-unit.test.mjs` 56 件（件数は同じ。見張り1本を外し、1本を足した）、`c2-mutation.test.mjs` 48 件、全部通る。全体の run-all は `tasks/2026-11-15-p5-c3-tests/run-all-result.txt`（C-3 の分と一緒に取った）。
- **蒙恬の実記録（`checks-verify-a.json`・`-b.json`）は、文字列を替える前の `unit.json` で取った古い記録**。今の `unit.json` の2項目が記録に無いため、`c2-check-json.mjs` は「`/debugService.js'`, `/linkDetector.js'` の検査の記録が無い」と食い違いを出す（照らし役は正しく働いている）。`c2-check-json.test.mjs` は、記録に新しい文字列が無いときだけ古い文字列に読み替えて照らすようにした（記録が取り直されたら読み替えは働かない）。大岡越前守が当て直した新しい記録では、そのまま 0 になる。
- 上の「仕様と実装についての指摘」の1・2は解消。3は変わらない。4は上の扱いのまま。

## 未解決の点

- 実際の VS Code のテストの仕組みでの `createRemovedDebugApi` の実行、起動時の注入（DI）の外し損ね、PowerShell 拡張の警告の有無は、台本の4・5（大岡越前守、片づけの後）。私は走らせていない。
- 当て直し a・b の再実行、`git apply --check`、型検査は、`C:\b\wt\p2` に書き込むため走らせていない。照らし役の検査は、蒙恬の実記録と、自前で当てた木の上で済んでいる。
- 上の指摘の1・4はリーダーの判断を待つ。

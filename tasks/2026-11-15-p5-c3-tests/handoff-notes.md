# Phase 5 の下ごしらえ（C-3 の検査とテスト）の引き継ぎ

曹参から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。依頼の1〜4がそろった。`node tests/run-all.mjs --save tasks/2026-11-15-p5-c3-tests/run-all-result.txt` の結果は、末尾の「実行結果」。C-2 の指摘の扱い（`KNOWN_DEAD_ABSENT` の撤去）も済ませ、C-2 の handoff-notes に「2回目」の節を足した。

## 成果物

すべて `tests/` の下（照らし役は直下）。本体のコード、`removals/`、`docs/` は直していない。

| ファイル | 中身 | 件数 |
|---|---|---|
| `tests/c3-unit.test.mjs` | 単位のファイルの静的な検査（`after` の確かめ、`removeLines`、`productRemove`、`kept`、edits.patch の中身、`checks` を含む） | 28 |
| `tests/c3-mutation.test.mjs` | 壊した写しで `c3-unit.test.mjs` が落ちること（対照1 + 壊し方42） | 43 |
| `tests/c3-check-json.mjs` | 照らし役。当て直しの記録（a・b）と型検査の記録を照らす。`--stopped` で「C-1 を外すと止まる」記録も照らす | — |
| `tests/c3-check-json.test.mjs` | 照らし役の検査。蒙恬の実記録（`tasks/2026-11-15-p5-c3-patch/trial/`）で「期待どおり」、壊した記録で食い違い | 11 |
| `tests/c3-check-worktree.mjs` | 照らし役。当てた後の木を照らす（入口の6） | — |
| `tests/c3-worktree.test.mjs` | 照らし役の検査。本家 1.146.0 に `removeLines`・`productRemove`・`edits.patch` を当てた木を一時のフォルダに作り、期待どおり・壊した木を照らす | 19 |
| `tests/removals/c3-gate-script.md` | 大岡越前守の台本（入口の1〜4・6・7） | — |
| `tasks/2026-11-15-p5-c3-tests/run-all-result.txt` | `run-all --save` の結果（PowerShell のテスト込み） | — |

C-2 側の変更: `tests/c2-unit.test.mjs`（`KNOWN_DEAD_ABSENT` を撤去、`absentStrings` が `kept` にしか当たらない空振りを見張るテストを1本足した）、`tests/c2-mutation.test.mjs`（壊し方を1つ足した。48 件）、`tests/c2-check-json.test.mjs`（古い実記録の読み替え。下の指摘2）、`tasks/2026-11-15-p5-c2-tests/handoff-notes.md`（「2回目」の節）。

## 要点

1. **`after` の確かめ（入口の2）を、走らせずに静的に見られる**: `scripts/lib/apply/units.mjs` の `planUnits` を直接呼び、`--only` から `C-1-ai` を外すと `C-3-remote: after の単位 C-1-ai が先に当たらない`、`A-5` を外しても同じ、C-1 があれば通る、C-2 は無くても通る、を確かめた。実際の当て直しの記録は、台本の1c と `c3-check-json.mjs --stopped` で照らす。
2. **C-3 と他の単位の独立を、機械で見張る**（5.3）: C-3 の edits.patch が触る `viewsExtensionPoint.ts` を、ほかのどの単位の edits.patch も `removeLines` も触らない。C-3 の `removeLines` はほかの単位（特に同じ `sharedProcessMain.ts` を直す C-1）の `removeLines` や edits.patch の消す行と二重にならない。`delete`・`productRemove` もほかの単位と重ならない。
3. **置いた定数の値**は、本家 `remoteExplorer.ts` の `VIEWLET_ID` と同じ（`workbench.view.remote`）ことを、本家のファイルから読んで確かめる。消す import の行も、`REMOTE` の使い所（本家で import を含め4か所以上）も本家にある。
4. **`checks` の空振り防止**: コマンド・ビュー・設定・文字列がすべて本家にあり、`absentStrings` の各項目は本家の `kept` でないファイルに当たる。`productRemove` の9つのキーは本家の `product.json` の最上位にある。
5. **当てた後の木の照らし役は、本家に C-3 の操作を自前で当てた木で「期待どおり」を確かめた**（C-2 と同じやり方）。`product.json` からキー9つを消し、`removeLines` の13行を消し、edits.patch を当てた木に対して、食い違いが出ない。

## 実行結果

- C-3 の4ファイル: 101 tests、pass 101、fail 0、skip 0。
- `node tests/run-all.mjs --save tasks/2026-11-15-p5-c3-tests/run-all-result.txt`: **1946 tests、pass 1939、fail 0、skip 7**（skip の7は `removals.test.mjs` の既存分。PowerShell のテスト 240 件込み）。1回目は C-2 の実記録の読み替えを入れる前で、`c2-check-json.test.mjs` が 3 件落ちた（上の指摘2）。直して取り直した。
- 作る途中で落ちたものは1本で、**テストの誤り**: `remote.tunnels.access.preventSleep` が本家に文字列としてない（`'remote.tunnels.access'` と `'.preventSleep'` を連結して組み立てている）。設定のキーとしては実在する。設定のキーが連結で組み立てられる場合は、前の部分と後ろの部分の両方が本家にあれば通すようにした。
- 実装の不具合は見つかっていない。

## 大岡越前守向けの台本の入口

`tests/removals/c3-gate-script.md`。

- 1a・1b: 当て直し a（16単位）・b（17単位。C-1、C-2、C-3 の順）と `node tests/c3-check-json.mjs <checks.json>`
- 1c: `--only` から C-1 を外すと止まること（入口の2）と `node tests/c3-check-json.mjs --stopped <checks.json>`
- 1d: `node tests/c3-check-worktree.mjs C:/b/wt/p2`（入口の6）
- 1e: ロックファイル
- 1f: b の C-3 の ops の commit での `git apply --check`（入口の4。**曹参の許可に `git -C` と `git checkout` が無く、走らせていない**。静的な代わりは、`c3-unit.test.mjs` の「ほかの単位の edits.patch が触るファイルに触らない」と、本家に当てた木での照らし役の検査）
- 2: 型検査（a・b それぞれの上）
- 4: 関門の起動の確かめ（入口の7。Claude Code の Webview・外部 URI・ターミナルのリンク、`UNKNOWN service`、共有プロセスの `remoteTunnel` のチャンネル）

## 仕様と実装についての指摘

1. **`remote.tunnels.access.preventSleep`** は本家に文字列そのものが無い（定数の連結）。`checks.absentSettings` は設定の画面を見る検査なので、動きには関係しない。もし将来、設定のキーを文字列で grep する検査を足すなら、この1つは連結を考えること。
2. **C-2 の実記録が古くなった**（C-2 の指摘の扱いの副作用）。蒙恬が C-2 の `absentStrings` の2つを替えたので、`checks-verify-a.json`・`-b.json`（替える前に取った）には新しい2項目の検査の記録が無く、`c2-check-json.mjs` は「検査の記録が無いもの」と食い違いを出す。照らし役は正しく働いている。C-2 のテストは、記録に新しい文字列が無いときだけ古い文字列に読み替えて照らす。大岡越前守が当て直した新しい記録では 0 になる。
3. docs/03 の4節の表の C-3 の行は直っていて、`removals/C-3-remote/README.md` の数（common 2・desktop 3・web 1・`sharedProcessMain.ts` 7）と、テストの期待が合っている。
4. 判断済みのもの（`docs/user-decisions.md` の 2026-11-15）は、そのままテストに入れた: build/ の台本の型の誤り6件は直さない（台本の2に書いた）、`gulpfile.vscode.ts` の `esbuild-vscode-reh-*` の定義は残す。

## 仕様から想定した入口

実装（蒙恬の edits.patch、unit.json、実記録）が先にあったので、想定の入口は無い。壊し方の文字列の置き換えは edits.patch の文言に依存する（パッチを書き直したら「置き換えが当たらない」で落ちる。落ちたら置き換えを直す）。

## 未解決の点

- 本物の VS Code での起動（DI の外し損ね、共有プロセスのチャンネル、Claude Code の Webview・外部 URI）は、台本の4（大岡越前守、片づけの後）。
- 当て直し a・b・「C-1 を外す」の再実行、`git apply --check`、型検査は、`C:\b\wt\p2` に書き込むため走らせていない。

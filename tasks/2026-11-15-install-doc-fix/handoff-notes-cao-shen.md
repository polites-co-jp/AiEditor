# 引き継ぎ: --portable と switch.ps1 の検知の警告のテスト（曹参）

- 担当: 曹参（cao-shen）、2026-11-15
- 依頼: `tasks/2026-11-15-install-doc-fix/brief.md` の「やること（曹参）」1〜3
- 前の依頼（`tasks/2026-11-15-install-doc-verify/`）の報告 `handoff-notes-cao-shen.md` は既にある（書き直していない）。

## 結果

- 結果: 完了
- 成果物:
  - `tests/install-portable.test.mjs`（新規。13件）
  - `tests/switch-watch-warn.test.mjs`（新規。10件）
  - `tasks/2026-11-15-install-doc-fix/run-all-result.json`（`node tests/run-all.mjs --save` の出力。中身は表の文字列）
- 件数: 全体 1608 件、通った 1601、落ちた 0、飛ばした 7（`removals.test.mjs`。従来どおり）。

## 要点

1. 先にテストを書き、蒙恬の修正が入る前の台本で流した。`install-portable` は 9 件中 4 件、`switch-watch-warn` は 7 件中 4 件が落ちた（無い `--portable` の場所を黙って捨てて普段の場所に入る、警告が出ない、という不具合そのもの）。修正が入った後の台本では全部通る。
2. 偽の CLI は `.cmd` から node の小さなスクリプトを呼ぶ。エディタの `configurePortable` の真似をする（`VSCODE_PORTABLE` の場所が在るときだけポータブル、無ければ黙って捨てて `%USERPROFILE%\<dataFolderName>` に入れる）。普段の場所の代わりに、サンドボックスの `USERPROFILE` の下を使う。本物のエディタ・本物の `%USERPROFILE%`・`%APPDATA%` には触れない。
3. `switch.ps1` のテストは、サンドボックスの `LOCALAPPDATA` を渡し、本物の `%LOCALAPPDATA%\Shuko\watch\` は読まない。
4. 実装を読んでから、想定していた入口と一致するのを確かめた（下の表）。

## 確かめていること

`install-portable.test.mjs`

- 無い場所（親も無い場合を含む）が作られ、CLI の全呼び出しで `VSCODE_PORTABLE` がその絶対パスを指し、呼ぶ時点でフォルダが在る。拡張は `<portable>\extensions` に入り、`argv.json` も `<portable>` に書かれ、普段の場所は何もできない。
- 在る場所は中身を消さずに使う。相対パスは絶対パスにして渡す。
- 守り: 本家の `dataFolderName`（`.vscode`・`.vscode-oss`・`.vscode-insiders`）で `--portable` も `--extensions-dir` も無ければ止まり、CLI は走らない。`--portable` だけ、または `--extensions-dir` だけなら通り、本家の場所に入らない。
- `--dry-run` は CLI を走らせず、`argv.json` も書かず、場所も作らない。SHA-256 の不一致は何も入れず場所も作らない（終了コード 2）。
- `product.json` に `target` がある版は、何も入れずに止まる。CLI が `--portable` を黙って捨てた場合は成功にしない（終了コード 1）。出力 JSON の `portable`（`path`・`created`・`extensionsDir`・`extensionsDirExists`）。

`switch-watch-warn.test.mjs`

- 5 日前・30 日前は警告が出て、止まらず（終了コード 0）切り替えは済む。1 日前・たった今は警告なしで、日時は表示される。2 日前は警告なし、4 日前は警告あり。
- 状態が無い・壊れている・`lastSuccessAt` が無い・日時でない: どれも警告が出て、止まらない。
- `-WatchState` が効き、既定の場所は見ない。`-List` でも出る。エンジンの不一致（終了コード 4）の結果は警告があっても変わらない。

## 想定した入口と実装の一致

| 想定 | 実装 |
|---|---|
| 状態は `%LOCALAPPDATA%\Shuko\watch\state.json` が既定 | 一致（`-WatchState` で変えられる） |
| JSON の `watch.warn`、標準エラーの文に warn | 一致（`watch` と `[switch] WARNING: ...`） |
| 状態が無いとき | `take-in.mjs` と同じく警告（蒙恬が決めた扱い） |
| `--portable` の場所は CLI の前に作る | 一致（`ensurePortableDir`） |

## 見つけた点（直さず報告する）

1. **境目（ちょうど 3 日）は試していない**。実装は `> 3` で警告（`take-in.mjs` と同じ）。テストは 2 日と 4 日で挟んでいる。
2. **docs/02 の 6節の0 は「満たさなければ止まる（終了コード4）。最後に更新の検知が成功した日時を表示し…」と書く。** 実装は、検知の表示を全動作の最初に出す（エンジンの確認より前）。テストは「4 でも警告が出る」を確かめている。仕様の順序と食い違うとは言い切れないが、docs を確かめてほしい（仕様の食い違いの可能性。どちらが正しいかは決めない）。
3. **`--portable` の守りの範囲**: 蒙恬の実装は `product.json` を読めないとき（`--cli` で版の形を解けない）も止める。テストは `target` がある場合だけ確かめている。読めない場合の試しは足していない。
4. `node tests/wait-file.mjs` に `--help` を渡すと待ちに入る（前回と同じ。無害）。

## 未解決の点

なし。

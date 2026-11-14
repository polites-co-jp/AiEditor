# 直し: 「消えている」の検査の網（probe の設定の見方と、コマンドの見方）

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

Phase 2 の関門で、9版の関門の3「消えている」が判定できなかった（`tasks/2026-11-14-p2-gates/handoff-notes.md` の「直す必要があるところ」）。

1. `tests/removals/probe/extension.js` の15行の `getConfiguration().inspect(key) !== undefined` は、登録の無いキーでも true になる。absentSettings がどの版でも fail する。対照のキー `zzzShukoControl.never.registered` で再現できる（`C:\b\smoke\absent\p2-A-1-control-20261114T130636\`）。
2. absentCommands は実行時に登録されたコマンドしか見ない。起動しない拡張のコマンドは、公式でも「無い」になり、網にならない。

## やること

1. probe の設定の見方を直す。設定の登録（configuration registry の中身、たとえば `vscode.workspace.getConfiguration().inspect(key)` の `defaultValue` が登録の有無を表すか、拡張の `contributes.configuration` と本体の設定のスキーマ）で、登録されているかを正しく見分ける。対照のキー（登録の無いキー）が「無い」、確かに在るキー（`editor.fontSize` など）が「在る」になることを、テストで確かめる。
2. コマンドの見方を足す。実行時の一覧に加え、出力の組み込み拡張の `package.json` の `contributes.commands`（と `menus`）にも ID が無いことを見る（manifest の網）。`absent-run.mjs` の出力に、どちらの網で見たかを書く。
3. 公式の zip で `--expect present` が通ることを、checks の項目が網になっている条件として出せるようにする（今もある形なら、その使い方を README に書く）。
4. 単体テスト（`tests/absent.test.mjs` など）を足す。`node tests/run-all.mjs` の件数を書く。

## 守ること

- 書き込みは `tests/`・`tasks/`・`C:\b\smoke\` だけ。
- 蒙恬が並行して `removals/*/unit.json` の checks を直す（`tasks/2026-11-14-units-checks-revise/`）。unit.json は書かない。checks の形（キー）を変えるなら、蒙恬と合わせるため handoff-notes に先に書く。

## 完了条件

- 1・2 の直しとテストがあり、対照のキーで正しく見分けられる。

## 成果物

このディレクトリに `handoff-notes.md`（使い方の変わった点、テストの入口、件数）。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 関門の3の流し直し。

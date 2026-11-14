# 引き渡しの覚え: 網の直しの検証と、段階 A の関門の3の流し直し（大岡越前守）

- 担当: 大岡越前守、2026-11-14
- 依頼: `brief.md`（このフォルダ）。進め方と流したコマンドは `verification-log.md`、テストの件数は `run-all-counts.txt`
- 判定: **合格**（brief の1〜4のすべて）

## brief の1〜4

| 項目 | 合否 | 理由 |
|---|---|---|
| 1. レビュー | 合格 | 網の直し（設定は `defaultValue` と manifest、コマンド・ビューは runtime と manifest）は brief のとおり。checks の変更（A-2・A-5 は足し、B-3 は替え、A-1・A-4・A-7 は manifest の網だけで README に理由）と A-5・B-4 の README は裁定と合う。有効にした A-3・A-6・B-5・B-6 は4つとも関門の記録で 1〜4 が合格。notion-sync の翻訳の束の形は依頼のとおり（実機で誤りが消えるかは未確認） |
| 2. テスト | 合格 | `node tests/run-all.mjs --save`: tests 1552、pass 1535、fail 0、skip 17（曹参の報告と同じ） |
| 3. 網になっていること | 合格 | 公式の zip に全単位を `--expect present`: A-1〜B-7 の項目はすべて pass（B-1 の `showTelemetry` は B-1 の直しで checks から外れている）。fail は C-1 の既知の2件だけ（範囲の外） |
| 4. 関門の3の流し直し | 合格 | A-1・A-2・A-4・A-5・A-7 の版で、その単位を `--expect absent`: 5版とも fail 0・unknown 0。前の版での `--expect present` と、登録の無いキー・在るキーの対照でも、網が正しく落ちることを確かめた |

## 単位ごとの関門の結び

| 単位 | 1 | 2 | 3 | 4 | 結び |
|---|---|---|---|---|---|
| A-1-copilot-extension | 合格 | 合格 | **合格**（今回） | 合格 | 4つとも合格 |
| A-2-accounts-extensions | 合格 | 合格 | **合格**（今回） | 合格 | 4つとも合格 |
| A-3-debug-extensions | 合格 | 合格 | 合格 | 合格 | 前回に合格。`enabled: true` 済み |
| A-4-notebook-extensions | 合格 | 合格 | **合格**（今回） | 合格 | 4つとも合格 |
| A-5-remote-extensions | 合格 | 合格 | **合格**（今回） | 合格 | 4つとも合格 |
| A-6-themes | 合格 | 合格 | 合格 | 合格 | 前回に合格。`enabled: true` 済み |
| A-7-unused-extensions | 合格 | 合格 | **合格**（今回） | 合格 | 4つとも合格 |
| B-1〜B-7 | — | — | — | — | 今回は判定しない（`-r2` の版で関門をやり直す。B-5・B-6 は前回に合格、`enabled: true` 済み） |

### `enabled: true` にしてよい単位（今回の分）

- `A-1-copilot-extension`
- `A-2-accounts-extensions`
- `A-4-notebook-extensions`
- `A-5-remote-extensions`
- `A-7-unused-extensions`

（すでに `enabled: true` の A-3・A-6・B-5・B-6 と合わせて、段階 A は全部そろう）

## 記録

- 関門の記録への追記（追記だけ。消した行 0）:
  - `records/take-in/1.146.0-p2-A-1/gate-A-1-copilot-extension.md` の5節
  - `records/take-in/1.146.0-p2-A-2/gate-A-2-accounts-extensions.md` の4節
  - `records/take-in/1.146.0-p2-A-4/gate-A-4-notebook-extensions.md` の4節
  - `records/take-in/1.146.0-p2-A-5/gate-A-5-remote-extensions.md` の4節
  - `records/take-in/1.146.0-p2-A-7/gate-A-7-unused-extensions.md` の4節
- 台本の結果: `C:\b\smoke\absent\regate-*-20261114T14*\`（公式1・各版5・前の版4・対照1）

## リーダーに諮る点

- **A-1 は manifest の網だけで合格にした。** A-1 の3件は公式でも実行時の網に出ず（copilot の拡張が公式の実行で `vscode.extensions.all` に出ない）、出力の組み込み拡張の `package.json` の `contributes` で「在る／無い」を見ている。brief の1が「A-1・A-4・A-7 は manifest の網だけ」と挙げていて、直した台本の網そのものなので、裁定の「代わりの証拠（拡張の一覧・出力の文字列）」とは別と見た。リーダーが同じものと見るなら、A-1 の3は戻す（A-4・A-7 は設定が実行時の網にも出るので影響は小さい）

## 気づいた点（合否に使っていない）

- notion-sync の `No bundle location found` が消えるかは、次の版のスモークの errors.new で確かめる。`contributes.localizations` を持つと本体が言語パックとして扱う場面がある（言語の選択の一覧に「日本語」が出る、など）ので、ほかの副作用もそのスモークで見る
- manifest の網は menus の `command` も「在る」に数える。消した単位のコマンドを残る拡張の menus が名指ししていれば、`--expect absent` で厳しい側（fail）に倒れる。今回は該当なし
- 公式の present の実行で、C-1 の `search.action.showAIResults`・`agent-host` は網にならない（既知。段階 C の checks の見直しで扱う）
- テストの件数は、B-1 を直している途中の変更（`scripts/build.mjs`、`removals/B-1-telemetry/`）を含んだ作業ツリーで数えた。コミットの前にその変更が変われば、流し直しが要る

## 次の担当

- 蒙恬: A-1・A-2・A-4・A-5・A-7 を `enabled: true` にする
- リーダー: A-1 の manifest の網だけの判定でよいかを決める。B-1〜B-7 の `-r2` の版の関門を依頼する

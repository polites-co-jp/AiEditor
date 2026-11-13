# Phase 2: 適用・単位・上書きの単体テストと、「消えている」の検査

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで機能の削除を実装する。蒙恬が並行して作る適用の台本・削除の単位・上書きを、同じ仕様（docs/）からテストする。関門の「消えている」（docs/03 の7節の3）の自動の検査も作る。

## 入力

- docs/03 の3節（unit.json の形）・5節（当て方）・6節（適用後の検査）・7節（関門）
- docs/02 の3節（product.overlay.json。`shukoConfigurationDefaults` の `extensions.allowed` を台帳の ID と照らす）
- `extensions.lock.json`、`builtin/keep.json`（蒙恬が作る）、本家 1.146.0 の `extensions/*`（`C:\b\wt\1.146.0`、読むだけ）
- 既にあるスモークの台本 `tests/smoke-run.mjs`（`commands.json` に登録済みのコマンドの一覧が残る）
- 蒙恬の設計の書き物（でき次第）: `tasks/2026-11-13-p2-apply/apply-design.md`、`tasks/2026-11-13-p2-units-a/`、`tasks/2026-11-13-p2-units-b/`

## やること

1. 仕様から先に、次のテストを書く（蒙恬の実装を待たずに、仕様の規則で書く。入口の名前は、蒙恬の設計の書き物ができたら合わせる）。
   - `removeLines` の規則（完全一致・前後の空白・ちょうど1行・`count`・0行と2行以上で止める）
   - 単位の並べ替え（`order`）と `after` の検査、`enabled: false` を飛ばすこと
   - overlay の `set`・`remove`、remove のキーが本家に無いときの警告、「本家が足したら remove」
   - 未分類の組み込み拡張の検出、本家が足した部品の名前の目立たせ
2. `removals/*/unit.json` の形の検査（docs/03 の3.1 の項目、`id` とフォルダの名前、`order` の段階の範囲、`after` が実在する単位を指す）と、`builtin/keep.json` と単位で本家の `extensions/*` がすべて覆われることの検査。
3. `product.overlay.json` の `shukoConfigurationDefaults` の `extensions.allowed` が、台帳の ID とちょうど一致することの検査。
4. 「消えている」の自動の検査（`tests/removals/` など）: 単位の `checks.absentCommands`（スモークの `commands.json` と照らす）、`absentViews`・`absentSettings`（試験専用の拡張で取れる範囲）、`absentProcesses`。自作のビルドがまだ無いので、公式の zip で「まだ在る」ことを確かめる形で試す。
5. 単体テストを走らせる。

## 守ること

- 書き込みは `tests/`・`tasks/`・`C:\b\smoke\`（台本の実行の置き場所）だけ。`scripts/`・`removals/`・`builtin/`・`patches/`・`product.overlay.json` は蒙恬が書くので書かない（直しが要れば報告する）。
- 普段使いのデータに触れない。起動した PID の木だけを止める。

## 完了条件

- 1〜4 のテストと検査があり、走らせた結果がある。蒙恬の成果がまだ無くて走らせられないものは、どれかを書く。

## 成果物

このディレクトリに保存する。

- `tests-design.md`: テストの一覧と、仕様の出どころ。
- `handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 蒙恬の成果と合わせて検証する。

# basedpyright が Python 拡張を要るかの調べと試し

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

曹参の試しで、本家 1.146.0 の basedpyright 1.40.2 が "Error: Python extension is not installed or is disabled" で起動に失敗した。台帳に `ms-python.python` は無い。Python の言語機能（裁定: basedpyright）と、0-4 の基準値の条件に関わるので、ユーザーに諮る前に事実を固める。

## 入力

- `tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md` の最後の追記
- docs/01 の4節（言語機能）、docs/04 の2節（台帳）、docs/07 の2.4 の4（basedpyright が Python 本体なしで動くか）

## やること

1. 公式の文書・README・リリースノート・issue と VSIX の manifest で、ms-python.python を要るのか、要らない設定があるのかを確かめる（出典と取得日つき。JS の中身は読まない）。
2. upstream-default を写した新しい環境で、設定を変えて basedpyright が起動し診断を出すかを試す（手の確かめの環境には触れない。scratch は読むだけ）。
3. ms-python.python を台帳に足すとした場合の事実（発行元、verified、版、公開日、ライセンス、engines、サイズ、連れてくる依存、消す機能への依存）。
4. 代わりの案があれば事実だけ。

## 完了条件

- 1〜4 に、出典か試しの結果がある。

## 成果物

このディレクトリに保存する。

- `basedpyright-probe.md`: 調べと試しの結果。
- `handoff-notes.md`: 報告。

## 結果

採用。basedpyright 1.40.2 は ms-python.python を依存に持たず、既定の `importStrategy: fromEnvironment` が Python 拡張を探すために失敗すると分かった（公式の文書と issue #1188、実機の bp-probe-a〜d）。ユーザーの裁定で、mydist の既定に `basedpyright.importStrategy: "useBundled"` を入れ、台帳は9件のまま、計測は本家と自作の両方に同じ値を入れる（docs/user-decisions.md）。大岡越前守の検証（4）で反映を確かめた。

## 未解決

- 画面の問題パネルに診断が出るかは、ユーザーの手の確かめ（0-3）で見る。
- lsp-probe の軽微な2点（`initialize` に応えないサーバーで待ち続ける、途中で子が終わると結果が出ない）。急がない。

## 次の担当

リーダーが結果を添えてユーザーに諮る。

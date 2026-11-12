# basedpyright が Python 拡張を要るかの調べと試し

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 依頼中

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

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

リーダーが結果を添えてユーザーに諮る。

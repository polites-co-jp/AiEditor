# 検証: 「消えている」の網の直し・checks の見直し・notion-sync の翻訳の直しと、段階 A の版の関門の3の流し直し

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

Phase 2 の関門で「判定できない」になった関門の3（`tasks/2026-11-14-p2-gates/handoff-notes.md`）を、網と checks を直したうえで流し直す。段階 A の版は作り直さないので先に行う。B-1〜B-7 は蒙恬が作り直している（`tasks/2026-11-14-fix-b1-and-build/`）ので、届いてから別に依頼する。

## 入力

- 曹参: `tasks/2026-11-14-fix-absent-probe/handoff-notes.md`（`tests/removals/probe/extension.js`、`tests/removals/lib/absent.mjs`、`tests/removals/run-absent.mjs`、`tests/absent.test.mjs`）
- 曹参: `tasks/2026-11-14-tests-l10n-launch/handoff-notes.md`（`tests/builtin-l10n.test.mjs`、`tests/p1-scripts.test.mjs`、`tests/cli-run.test.mjs`）
- 蒙恬: `tasks/2026-11-14-units-checks-revise/handoff-notes.md`（`removals/*/unit.json`・README の変更、A-3・A-6・B-5・B-6 の有効化、`extensions-src/notion-sync/` の翻訳の束、`extensions-src/mydist/README.md`）
- `docs/user-decisions.md` の 2026-11-14「Phase 2 の関門で出た点」（代わりの証拠では合格にしない）
- 版の展開した場所: `tasks/2026-11-14-p2-builds/builds.md`

## やること

1. **レビュー**: 網の直し（設定は `defaultValue` と manifest、コマンド・ビューは runtime と manifest）、checks の変更（A-2・A-5・B-3 の足し・替え、A-1・A-4・A-7 は manifest の網だけ）、有効にした4単位が関門の記録と合うこと、notion-sync の翻訳の束の形。
2. **テスト**: `node tests/run-all.mjs --save <ファイル>` の件数（曹参の報告 1552 件、fail 0）。
3. **網になっていることの確かめ**: 公式の zip に全単位を `--expect present` で流し、A-1〜B-7 の項目が pass か（B-1 の `showTelemetry` は B-1 の蒙恬が直している途中なので、除いて書く）。
4. **関門の3の流し直し**: `1.146.0-p2-A-1`・`A-2`・`A-4`・`A-5`・`A-7` の版で、その単位を `--expect absent` で流す。合否を `records/take-in/1.146.0-p2-<id>/gate-<id>.md` に追記する。1・2・4 は前回の合格のまま（版を作り直していない）。
5. B-2・B-3・B-4・B-7 は、作り直した版（`-r2`）で関門をやり直すので、今回は流さない。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・`C:\b\smoke\` だけ。
- 蒙恬が B-1〜B-7 をビルドしている。gulp の出力と `C:\b\p2\*-r2` には触れない。

## 完了条件

- 1〜4 に合否と理由がある。

## 成果物

- `records/take-in/1.146.0-p2-<id>/gate-<id>.md` への追記
- このディレクトリに `verification-log.md`、`handoff-notes.md`（単位ごとの関門の結び。`enabled: true` にしてよい単位の一覧）

## 結果

合格（1〜4）。段階 A の7単位はすべて関門の1〜4が合格。run-all 1552 件、fail 0。A-1 の manifest の網だけの判定はリーダーが認めた（user-decisions）。

## 未解決

- A-1・A-2・A-4・A-5・A-7 の有効化（蒙恬）。
- notion-sync の誤りが消えるかを、次の版のスモークで確かめる。

## 次の担当

蒙恬: 合格した単位を `enabled: true` にする。リーダー: B-1〜B-7 の作り直した版の関門を依頼する。

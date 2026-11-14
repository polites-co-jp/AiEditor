# Phase 1 の検証: p1-ci-events の直しと、A-1 を当てた 1.146.0 のビルド・zip・起動

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

裁定（2026-11-14「Phase 1 のビルドの関門」）で、Phase 1 の関門は A-1 の単位と合わせて満たす。蒙恬が A-1 を当てた 1.146.0 を zip までビルドし、起動した。`p1-ci-events.ps1` の直しとあわせて合否を出す。

## 入力

- `tasks/2026-11-14-p1-build-a1/`（brief.md、handoff-notes.md の「検証役（大岡越前守）に渡す入口」、build-log.md、記録の JSON）
- `tasks/2026-11-14-p1-verify-partial/handoff-notes.md`（前回の不合格の点）
- `scripts/p1-ci-events.ps1`、`tests/p1-scripts.test.mjs`
- docs/07 の4節、docs/03 の5節・7節、`removals/A-1-*`

## やること

1. **直し**: `p1-ci-events.ps1` の53〜57行の直しが、言語によらずイベントが無いときを見分けるか。`node tests/run-all.mjs` を走らせ、fail 0 か（前回 fail 1）。件数を書く。
2. **当てたもの**: `take-in-r2/checks.json` で、A-1 と mydist だけが当たり、上書き・patches・assets・notion-sync が当たっていないこと。作業ツリー `C:\b\wt\p1-a1` の差分が A-1 の unit.json・edits.patch の範囲に収まること（読める範囲で）。
3. **ビルド**: `build-record-r2.json` と `C:\b\logs\1.146.0-p1-a1-r2\` のログで、install〜zip の6手順が通ったこと、所要時間・ディスク・zip の SHA-256 が記録と一致すること。A-1 の `absentStrings` などの検査（`checks.json`）の結果。
4. **起動**: `launch-check.json`・`ci-events.json`・`main.log` で、zip から起動し、25 秒後も生きていたこと、止められたモジュール（deviceid・keymapping・iselevated）、普段使いのデータに触れていないこと。
5. 判定: docs/07 の4節の完了の条件のうち、「zip から起動する」「所要時間とディスクの記録がある」を満たすか。Claude Code の組（スモーク）は、Smart App Control をオフにした後に別に行うので対象外。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 依存の導入とビルドは走らせない。PC の設定を変えない。

## 完了条件

- 1〜5 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）。Phase 1 の関門の記録を `records/phase1/` に残す。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: 合格ならコミットする。Smart App Control をオフにした後、スモーク（Claude Code の組）へ。

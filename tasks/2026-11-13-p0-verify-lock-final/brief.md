# Phase 0 の検証（5）: 台帳の全件の走らせ直しと、固定した ovsx（A-4）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

蒙恬が、固定した ovsx 1.4.0 で台帳の9件を走らせ直し、`extensions.lock.json` を書き直した。0-6（台帳の検証）を確定させるため、その結果を確かめて合否を出し、records に残す。

## 入力

- 蒙恬: `tasks/2026-11-13-p0-lock-final/`（lock-rerun.md、handoff-notes.md）、`extensions.lock.json`（`git diff` で前との差）、`tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` の末尾の追記、`C:\b\p0\vsix\verify-result.json`
- `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`node_modules/.modules.yaml`
- 前の記録: `records/phase0/lock-verification.md`（6節の残っている点）、`tasks/2026-11-13-p0-verify-measure-rework/handoff-notes.md`（A-4 の導入待ち）
- docs/04 の3節・4節、docs/user-decisions.md の「ovsx の版の固定」「ソースのタグ」

## やること

1. A-4: ovsx が `node_modules` の 1.4.0 から起動され、npx（npm の最新）を使っていないか。`pnpm-lock.yaml` の ovsx と依存の版・完全性の値。
2. 台帳: 9件すべてが docs/04 の3節の形か（`validateLockEntry` を通す）。前の台帳との差が `verifiedAt`・Claude Code の `checks.soak`・`sourceTag` の置き場所だけで、版・`sha256`・`publishedAt`・`crossCheck` が変わっていないか。Claude Code の寝かせる期間の計算（公開の時刻と判定の時刻）が正しいか。
3. 固定した ovsx で、1件（`tomoki1207.pdf`）を `--result C:/b/p0/trial/verify-result.json` で走らせ、結果が蒙恬の申告と合うか（本番の `verify-result.json` を上書きしない）。
4. `@vscode/vsce-sign` の install スクリプトを走らせなくても署名の検証が動く、という蒙恬の結論が、読んだ根拠と実行の結果で支えられるか。
5. 合格なら、`records/phase0/lock-verification.md` に追記する。6節の1（寝かせる期間）と3（ovsx の固定）が片付いたことを書く。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- ユーザーが画面での確かめの最中なので、`C:\b\p0\data\` の環境を起動しない。`p0-stop.ps1` を使わない。
- `pnpm install`・`pnpm approve-builds` を走らせない。`pnpm-workspace.yaml` を書き換えない（値はユーザーに諮っている）。

## 完了条件

- 1〜4 に合否と理由がある。合格なら 5 がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）。`records/phase0/lock-verification.md` への追記（合格のとき）。

## 結果

合格。A-4（固定した ovsx）、台帳の9件の形と差分、pdf の走らせ直し、vsce-sign の結論のすべてが合格。records/phase0/lock-verification.md に7節を追記した。指摘の N-2（取り下げの確認の時刻）・N-3（docs/07 の2.7の npx）・N-4（台帳の足した項目）は、リーダーが docs/04・docs/07 に反映した。

## 未解決

- N-1: `pnpm-workspace.yaml` の値の直しと、その後の `pnpm install` の確認（ユーザー）。
- N-5（曹参へ）: `--only` の結合テストでは、空の結果ファイルを渡すか、対象の行の `ok` を見る。テストを書くときに渡す。

## 次の担当

合格なら、リーダーが台帳と pnpm の2つのファイルをコミットする。

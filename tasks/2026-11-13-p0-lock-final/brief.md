# Phase 0 の 0-6 の仕上げ: 台帳の全件の走らせ直しと、固定した ovsx での検証

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ユーザーがリポジトリの直下で `pnpm install` を済ませ、固定した `ovsx` 1.4.0 が入った。Claude Code 2.1.322 の公開から72時間（日本時間 2026-11-13 11:30:52）も過ぎた。台帳の9件を走らせ直し、Claude Code の行の寝かせる期間を含めて台帳を確定させる。

## 入力

- ユーザーの `pnpm install` の出力（下の「事実」）
- `records/phase0/lock-verification.md`（とくに6節の残っている点）
- `tasks/2026-11-13-p0-fetch-and-lock/`（前の下書きと handoff-notes.md）
- docs/04 の4節（検証の手順。4.2 の ovsx は固定と裁定済み）、docs/user-decisions.md の「ovsx の版の固定」
- `scripts/lock-verify.mjs`・`scripts/lib/lock.mjs`（`checkPinnedTool`）、`package.json`、新しくできた `pnpm-lock.yaml`・`pnpm-workspace.yaml`

## 事実（ユーザーの `pnpm install` の出力）

- `devDependencies: + ovsx 1.4.0`
- `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @vscode/vsce-sign@2.1.0`（pnpm が依存の install スクリプトを走らせなかった）
- `pnpm-workspace.yaml` に `allowBuilds: '@vscode/vsce-sign': set this to true or false` が書かれた（値は未定）
- `node_modules/.pnpm/` に `@vscode+vsce-sign@2.1.0`、`@vscode+vsce-sign-win32-x64@2.0.6`、`@vscode+vsce@4.1.0` がある

## やること

1. `@vscode/vsce-sign` の install スクリプトが何をするのか（`package.json` の `scripts` と、それが呼ぶファイル）、走らせなくても `ovsx verify-signature` が動くのかを確かめる。出典を添える。
2. 台帳の9件すべて（`--only` を付けない）を、固定した ovsx（`node_modules` の中のもの。`npx` で npm の最新を取らない）で `lock-verify` し、`--write-lock` で台帳を書き直す。Claude Code の `checks.soak` が通ることを確かめる。
3. 1 で ovsx の署名の検証が動かないと分かったら、2 は署名の項目の結果を「できなかった」として残し、install スクリプトを許すかどうかの判断の材料（何がダウンロード・実行されるか、許さない場合の代わり）をまとめる。`pnpm approve-builds` を自分で走らせない。`pnpm-workspace.yaml` を書き換えない（ユーザーに諮る）。
4. 前の下書きと違った点を、下書きに追記する。

## 守ること

- 書き込みは自分の書き込み先（`scripts/`・`extensions.lock.json`・`tasks/`・`C:\b\`）だけ。`records/` は大岡越前守が書くので書かない。
- ユーザーが画面での確かめの最中なので、`C:\b\p0\data\` の環境を起動しない・書き換えない。`p0-stop.ps1` を使わない。
- 依存の追加や版の変更をしない。

## 完了条件

- 1 に出典つきの答えがある。
- 9件すべての検証の各項目に結果（通った・通らない・できなかった理由）があり、台帳が書き直されている（または 3 の材料がある）。

## 成果物

このディレクトリに保存する。

- `lock-rerun.md`: 1〜4 の結果。走らせたコマンドと出力の要点、台帳の差分。
- `handoff-notes.md`: 報告。

## 結果

採用。固定した ovsx 1.4.0（node_modules から起動、npx なし）で9件すべてが必須の項目を通り、台帳を書き直した。Claude Code 2.1.322 の寝かせる期間は72時間54分で通った。`@vscode/vsce-sign` の install スクリプトは署名の検証に要らないと分かり、ユーザーの裁定で走らせない（`allowBuilds` に `false`）。大岡越前守の検証（`tasks/2026-11-13-p0-verify-lock-final/`）で合格。

## 未解決

- `pnpm-workspace.yaml` を `false` に直し、`pnpm install` が 0 で終わるかを確かめる（ユーザー）。その後に pnpm の2つのファイルをコミットする。
- Claude Code 2.1.323 が出ている（72時間は 2026-11-15T22:13:36Z）。毎週の取り込みで扱う。
- `audio-capture.node` の署名、Defender の走査の権限（急がない）。

## 次の担当

ooka-echizen（大岡越前守）: 検証し、`records/phase0/lock-verification.md` に追記する（A-4 の固定の確認を含む）。

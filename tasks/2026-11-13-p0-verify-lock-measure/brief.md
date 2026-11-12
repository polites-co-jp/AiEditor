# Phase 0 の検証（1）: 台帳の取得と検証、0-1、計測と監査の台本とテスト

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

蒙恬の「材料の取得、0-1、0-6」と、曹参の「計測と通信の監査の台本、単体テスト」を確かめ、合否を出す。合格したものを `records/phase0/` に清書する。作った人の自己申告ではなく、自分で走らせた結果で判断する。

## 入力

- 蒙恬の成果: `tasks/2026-11-13-p0-fetch-and-lock/`（brief.md、fetch-log.md、claude-code-manifest.md、lock-verification.md、doc-corrections.md、handoff-notes.md）、`scripts/p0-fetch.mjs`・`scripts/p0-expand.ps1`・`scripts/lock-fetch.mjs`・`scripts/lock-verify.mjs`・`scripts/lock-diff.mjs`・`scripts/lib/`（lock.mjs・zip.mjs・http.mjs）、`extensions.lock.json`、材料 `C:\b\p0\`
- 曹参の成果: `tasks/2026-11-13-p0-measure-netaudit-tests/`（brief.md、measure-design.md、netaudit-design.md、test-results.md、doc-corrections.md、trial/）、`scripts/measure.ps1`・`scripts/netaudit.ps1`、`tests/`
- 仕様: docs/07 の2.2・2.5〜2.7・3節、docs/04 の2〜4節、docs/03 の9節

## やること

1. 蒙恬の成果
   - 差分のレビュー: 台本が docs/04 の4節の項目を正しく確かめているか（照合の相手、失敗を通ったと扱っていないか）、秘密や普段使いのデータに触れていないか、書き込み先の外を変えていないか（`git status`）。
   - `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0` を自分で走らせ、下書きの結果と合うか確かめる（台帳を書き換える `--write-lock` は、2.1.322 の72時間が過ぎた後＝日本時間 2026-11-13 11:30:52 以降に、全件が通ったときだけ付ける）。`sha256sum` で VSIX のハッシュを独立に確かめる（少なくとも Claude Code）。
   - `extensions.lock.json` が docs/04 の3節の形か（足した `checks`・`note` を含めて）。
   - 0-1 の下書き（claude-code-manifest.md）が manifest と合うか、JS の中身を開いていないか。
2. 曹参の成果
   - `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1`・`tests/netaudit.tests.ps1`、`node tests/lock.test.mjs`・`node tests/sublime-keys.test.mjs` を走らせる（`node --test tests/` は Node 24 では動かないと曹参が報告している。走らせて確かめ、記録する）。
   - 台本が docs/07 の3節（そろえる条件、手順、集計、claude.exe の分け方、合格の基準、監査）を満たすか。テストが中身のある確かめになっているか（常に通るテストでないか）。
3. 合否と清書
   - 合格なら `records/phase0/claude-code-manifest.md` と `records/phase0/lock-verification.md` を書く（下書きを確かめた結果に基づき、自分が走らせた結果を載せる）。
   - 72時間が過ぎていれば、Claude Code を走らせ直して結果を載せる。まだなら「時間待ち」として載せる。
   - 0-4（基準値の5回の計測）と 0-5（10分の監査）は、試験環境（蒙恬が並行して作っている）と計測用のワークスペースがそろってから、別に依頼する。今回は行わない。

## 守ること

- コードは直さない。不合格の点は、誰の何をどう直すべきかを書く。
- 書き込みは `records/` と `tasks/` だけ。
- 普段使いのエディタのデータと秘密に触れない。

## 完了条件

- 2件それぞれに合否と理由がある。
- 合格したものは `records/phase0/` に清書されている。

## 成果物

このディレクトリに保存する。

- `verification-log.md`: 走らせたコマンドと結果、レビューで見た点、2件の合否と理由、直すべき点（担当つき）。

## 結果

2026-11-13（リーダー）: 完了。
- 蒙恬（材料・0-1・0-6・台帳）: 合格。`records/phase0/claude-code-manifest.md`・`records/phase0/lock-verification.md` に清書された。台帳の Claude Code 2.1.322 は「公開から72時間」の時間待ち（日本時間 11:30:52 以降に走らせ直す）。
- 曹参の単体テスト4本: 合格（73・65・64・24件）。
- 曹参の measure.ps1・netaudit.ps1: 差し戻し（VSCODE_PORTABLE、B-1 の既定値の評価、B-3、B-4）。直った版で改めて検証する。
- 指摘 A-1〜A-3 は蒙恬に回し、直った（未検証）。A-4（ovsx の固定）、ソースのタグ、`node --test` の許可はユーザーの裁定を得た（docs/user-decisions.md）。

## 未解決

- Claude Code 2.1.322 の走らせ直しと台帳の確定。
- measure.ps1・netaudit.ps1 の再検証。蒙恬の A-1〜A-4 の直しの検証。
- audio-capture.node の署名、Defender の走査が管理者権限なしで有効だったかの確認。

## 次の担当

蒙恬（A-4、のちに Claude Code の走らせ直し）、曹参（差し戻しの直し）、その後に大岡越前守の再検証。

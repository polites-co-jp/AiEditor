# Phase 1 の検証（3）: 台帳と mydist を裁定に合わせた変更

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

蒙恬が、台帳（`extensions.lock.json`）と `mydist` を 2026-11-13 の裁定と記録に合わせ、`check-env.ps1`・`prepare.mjs` の軽微な2点を直した。それを確かめ、合否を出す。

## 入力

- 蒙恬: `tasks/2026-11-13-p1-ledger-mydist-decisions/`（changes.md、doc-corrections.md、app-scope-options.md、handoff-notes.md の本文と追記）、`extensions.lock.json`、`extensions-src/mydist/package.json`・`README.md`、`scripts/check-env.ps1`、`scripts/prepare.mjs`
- docs/user-decisions.md の末尾の節（通信の扱いの訂正、0-5 の後、.env の拡張、CLI の付帯の通信）
- docs/04 の2節・5節・6.1 と注（今日直した。application スコープの6件は mydist に入れない）、docs/02 の3節

## やること

1. 台帳: 8件で、`dotenv.dotenv-vscode` が無いか。各行が `validateLockEntry` を通るか。残りの行の値（版、`sha256` など）が前と変わっていないか（`git diff`）。
2. mydist: 次を確かめる。
   - `configurationDefaults` が、docs/04 の6.1 の window スコープ以下の設定とそろっているか。
   - application スコープの6件が入っていないか。
   - `claudeCode.environmentVariables` が2件か。その出典（manifest の `configuration` と公式の文書）が結論を支えるか。
   - `package.json` が JSON として正しいか。
3. `check-env.ps1` と `prepare.mjs` の直しのレビュー。蒙恬の「テストの入口」の表で確かめられるものは確かめる。
4. 単体テストを走らせる: `tests/lock.test.mjs`、`tests/sublime-keys.test.mjs` など、`tests/*.test.mjs` のうちスモーク以外のもの。
5. `app-scope-options.md` の事実（product.json に設定の既定の仕組みが無い、案B-2 の場所）が、読んだソースの行で支えられるか。B-2 の採用はリーダーが決めた。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 曹参が並行して `tests/smoke*` を直し、`C:\b\smoke\` で公式の zip を走らせている。そこには触れない（`tests/smoke.test.mjs` は走らせない）。
- `C:\b\wt\1.146.0` で依存の導入やビルドを走らせない。

## 完了条件

- 1〜5 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

合格（蒙恬の台帳と mydist、曹参の G〜L の両方）。

## 未解決

なし

## 次の担当

合格なら、リーダーがコミットする。

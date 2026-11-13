# 大岡越前守からリーダーへの報告（2026-11-13、p0-verify-lock-final）

## 判定: 合格

依頼書の 1〜4 はすべて合格。records への追記（5）も済ませた。ただし、コミットの前に `pnpm-workspace.yaml` の値を裁定どおりに直す必要がある（下の「コミットの前にやること」）。

## 確かめた成果

- 蒙恬: `tasks/2026-11-13-p0-lock-final/`（lock-rerun.md・handoff-notes.md）、書き直した `extensions.lock.json`、`tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` の末尾の追記、`C:\b\p0\vsix\verify-result.json`
- ユーザーの `pnpm install` でできたもの: `pnpm-lock.yaml`・`pnpm-workspace.yaml`・`node_modules/.modules.yaml`

## 根拠

| 項目 | 判定 | 根拠 |
|---|---|---|
| 1 A-4 | 合格 | ovsx は `node.exe <repo>\node_modules\ovsx\bin\ovsx verify-signature ...` で起動しており、npx は使っていない（本番の記録の9件と、私の試し）。版は package.json の `1.4.0`、`pnpm-lock.yaml` の `specifier: 1.4.0`・`version: 1.4.0`、入っている `package.json` の `1.4.0` の3つで一致した。`pnpm-lock.yaml` と `node_modules/.pnpm/lock.yaml` は SHA-256 が同じ。ovsx と依存（`@vscode/vsce` 4.1.0、`@vscode/vsce-sign` 2.1.0、`-win32-x64` 2.0.6 ほか）の完全性の値は lockfile にある |
| 2 台帳 | 合格 | 9件とも `validateLockEntry` の規則に合う（スクリプトを足す許可が無いので、規則を読んで1件ずつ当てた。台本も書く前に同じ検査をかけ、9件とも `written`）。`git diff` で変わったのは `verifiedAt`・Claude Code の `checks.soak`（fail → pass）・`sourceTag` の置き場所（`checks` → `references`）の3つだけ。版・`sha256`・`publishedAt`・`crossCheck` は変わっていない。9件の VSIX の `sha256sum` も台帳と一致した。寝かせる期間は、公開 02:30:51.973Z から判定 03:25:31.820Z まで72時間54分39.85秒で、計算は正しい |
| 3 pdf の走らせ直し | 合格 | `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --only tomoki1207.pdf --result C:/b/p0/trial/verify-result.json` を走らせた。pdf は `ok: true`。ovsx の項目は `pass`、`ovsxVersion: 1.4.0`、`exitCode: 0`、`✅  Signature is valid.` で、`command` に npx は無い。蒙恬の申告と同じ。終了コードは 1 だったが、原因は試しの結果ファイルに残っていた前の回の wx-vsce-dotenv の行（`--only` は対象外の行を前のファイルから写す）。pdf のせいではない。本番の `verify-result.json` は上書きしていない |
| 4 vsce-sign | 合格 | `postinstall.js` を読んだ。ふつうは `vsce-sign.exe` を `bin/` に写すだけで、写す元が無いときだけ `npm install --force` かレジストリから直に取る。ovsx の `lib/verify-signature.js` と `lib/zip.js` は `crypto`・`fs`・`yauzl-promise` だけを使い、vsce-sign を呼ばない。vsce-sign の `src/main.js` は、読み込まれたときに exe を起動しない。`bin/` が無い今の状態で、9件と私の試しのどちらも署名の検証が通った |

- 単体テスト: `node --test tests/lock.test.mjs` は 115件すべて通った。

## コミットの前にやること（N-1）

- `pnpm-workspace.yaml` は今も `allowBuilds: '@vscode/vsce-sign': set this to true or false`（pnpm が書いた仮の値）のまま。裁定（docs/user-decisions.md の 146 行。2026-11-13 12:31 のコミット bd2aabd で、蒙恬の走らせ直しの後に決まった）は `'@vscode/vsce-sign': false`。依頼書で書き換えを止められているので、私は触れていない。
- 裁定（147 行）では、コミットするのは `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml` の3つ。`package.json` はもう git が管理している。依頼書の「台帳と pnpm の2つのファイル」に加えて、`false` に直した `pnpm-workspace.yaml` もコミットすること。
- `false` にした後に `pnpm install` が 0 で終わるかは、誰も確かめていない（私にも蒙恬にも許可が無い）。

## そのほかの指摘（合否には効かない）

- N-2: 取り下げの確認（docs/04 の4節の4「確認の時点で」）は、`lock-fetch` の時点（2026-11-12T20:18Z）の `allVersions` を使っている。判定の時刻（2026-11-13T03:25Z）とは7時間ずれる。今回の手順は私が前の記録で決めた「取り直さずに走らせ直す」に従っている。毎週の取り込みで、判定の時刻に取り直すか、`lock-fetch` と `lock-verify` を続けて走らせるかを決めてほしい。
- N-3: docs/07 の2.7の3が、今も `npx ovsx verify-signature ...` と書いている。裁定（版の固定）と docs/04 の4節の2に合わせて直す必要がある。
- N-4: docs/04 の3節の例に `checks`・`references` が無い。形の誤りではない（`validateLockEntry` は足した項目を拒まない）が、書き足すかを判断してほしい。
- N-5（曹参へ）: `--only` で試すとき、結果ファイルに古い行が残っていると、対象が通っても終了コードは 1 になる。結合のテストでは、空の結果ファイルを渡すか、対象の行の `ok` を見ること。
- N-6: 蒙恬は `references` に分けたことを「A-4 の直しの新しい形」と書いているが、A-4 は ovsx の固定のこと。分けたのはソースのタグの裁定による直しで、言葉の食い違いにすぎない。
- Claude Code 2.1.323 が出ている（72時間が満ちるのは 2026-11-15T22:13:36Z）。台帳は 2.1.322 のまま。

## 記録

- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-verify-lock-final\verification-log.md`（検証の記録）
- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-verify-lock-final\handoff-notes.md`（この報告）
- `e:\develop\self\Team\projects\ai-editor\records\phase0\lock-verification.md`（7節を追記した。追記だけで、1〜6節は変えていない。`git diff --stat` で 45行の追加、削除は0）
- 試しの結果: `C:\b\p0\trial\verify-result.json`（pdf の行を書き直した。本番の `C:\b\p0\vsix\verify-result.json` は変えていない）

## 次の担当

- リーダー: `pnpm-workspace.yaml` を `false` に直してから、`extensions.lock.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・records の追記をコミットする。N-2〜N-4 を判断する。

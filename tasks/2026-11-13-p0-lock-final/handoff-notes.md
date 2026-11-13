# 蒙恬からリーダーへの報告（2026-11-13、p0-lock-final）

## 結果: 完了

9件すべてが、固定した ovsx 1.4.0 での検証を含めて、必須の項目を全部通った。台帳 `extensions.lock.json` は9件とも新しい値で書き直した。Claude Code 2.1.322 の寝かせる期間も通った。

## 成果物

- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-lock-final\lock-rerun.md`（1〜4 の結果）
- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-lock-final\handoff-notes.md`（この報告）
- `e:\develop\self\Team\projects\ai-editor\extensions.lock.json`（書き直した）
- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-fetch-and-lock\lock-verification.md`（末尾に追記した）
- `C:\b\p0\vsix\verify-result.json`（上書きした）

台本（`scripts/`）は変えていない。

## 要点

1. **9件の結果**: 9件とも `ok: true`。
   - 必須の項目（発行元・SHA-256・自前の署名・ovsx・72時間・engines・Defender）は、9件とも通った。
   - Claude Code の4項目（CLI のハッシュ・GPG・Authenticode・Marketplace）も通った。
   - 参考の項目のソースのタグは、前と同じく wx-vsce-dotenv・pdf・言語パックの3件で見つからない（必須ではない）。
2. **Claude Code の寝かせる期間**: 公開 2026-11-10T02:30:51.973288Z、判定 2026-11-13T03:25:31.820Z で、経過は72時間54分40秒。`checks.soak` は `pass` になった。
3. **vsce-sign の install スクリプトを許す必要は無い**。
   - スクリプト（`postinstall: node ./src/postinstall.js`）がするのは、もう入っている `@vscode/vsce-sign-win32-x64@2.0.6` の `vsce-sign.exe` を `bin/` に写すことだけ。
   - ovsx 1.4.0 の `verify-signature` はこの exe を使わない。Node.js の `crypto` だけで検証する。実際に、`bin/` が無い今の状態で9件とも `✅  Signature is valid.` になった。
4. ただし `pnpm-workspace.yaml` の値が仮のままだと、`pnpm install` が毎回 `ERR_PNPM_IGNORED_BUILDS` で 0 以外を返す（pnpm 11 の `strictDepBuilds` の既定が `true` のため）。そのため値を決める必要がある。推奨は `'@vscode/vsce-sign': false`。諮るときの材料は lock-rerun.md の2節にまとめた。
5. Marketplace と Open VSX の最新は、もう **2.1.323** になっている（Open VSX の公開 2026-11-12T22:13:36Z。72時間を満たすのは 2026-11-15T22:13:36Z）。今回は取り直していないので、台帳は 2.1.322 のまま。

## 確かめたこと

- `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --write-lock extensions.lock.json` を走らせた。
  - 終了コードは 0。`lockWrite` の `written` は9件で、`kept`・`omitted`・`untouched` は空。
  - ovsx の起動は `node.exe <repo>\node_modules\ovsx\bin\ovsx verify-signature ...` だった。`ovsxVersion` は9件とも `1.4.0` で、npx は呼んでいない。
- `git diff extensions.lock.json` で差分を見た（42行増え、26行減った）。変わったのは次の3つだけ。
  - `verifiedAt`
  - Claude Code の `checks.soak` が fail から pass になった
  - `checks.sourceTag` を `references.sourceTag`（found / not-found）に分けた
  - 版・`sha256`・`publishedAt`・`crossCheck` などの値は変わっていない。
- 次のファイルを読んだ。
  - `@vscode/vsce-sign@2.1.0` の `package.json`・`src/postinstall.js`・`src/main.js`・`src/target.js`
  - ovsx 1.4.0 の `lib/main.js`・`lib/verify-signature.js`
  - `@vscode/vsce@4.1.0` の `out/package.js` の vsce-sign を使う箇所
- npm のレジストリ（https://registry.npmjs.org/@vscode/vsce-sign/2.1.0）の `scripts.postinstall` と完全性の値を確かめた。完全性の値は `pnpm-lock.yaml` と一致した。
- pnpm の文書（https://pnpm.io/settings/build）で `allowBuilds`・`strictDepBuilds` の動きを確かめた。
- `node_modules/.modules.yaml` の `ignoredBuilds` は `@vscode/vsce-sign@2.1.0` の1件だけで、pnpm は 11.8.0 だった。

## テストの入口（曹参へ）

台本は変えていないので、新しい関数は無い。確かめるなら次の2つ。

- 固定した ovsx の起動（結合の確かめ。本番の結果を上書きしないよう `--result` を付ける）
  - コマンド: `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --only tomoki1207.pdf --result C:/b/p0/trial/verify-result.json`
  - 期待: `results[].ovsx` が `status: "pass"`、`ovsxVersion: "1.4.0"`、`exitCode: 0`、`stdout: "✅  Signature is valid."` で、`command` に `node_modules\ovsx\bin\ovsx` を含み、`npx` を含まない。
- 台帳の形
  - 確かめ方: `extensions.lock.json` の9件それぞれに `validateLockEntry`（`scripts/lib/lock.mjs`）をかける。
  - 期待: どれも誤り無し（`[]`）。`checks` の値は全部 `"pass"`。Claude Code 以外の8件は `references.sourceTag` が `"found"` か `"not-found"` で、`checks` に `sourceTag` が無い。

## docs/ との食い違い

- docs/04 の4節の2と `docs/user-decisions.md` の「ovsx の版の固定」は、「`package.json` の devDependencies に 1.4.0」までしか書いていない。次の3点を書き足すかは判断してほしい。
  - 入れる道具が pnpm であること
  - `pnpm-lock.yaml` を固定の対象にすること
  - `allowBuilds` の裁定
- `records/phase0/lock-verification.md` の6節の1（Claude Code の寝かせる期間）と3（ovsx の版の固定）は、今回で片付いた。records は大岡越前守が書くので、私は触れていない。

## 未解決

1. `pnpm-workspace.yaml` の `'@vscode/vsce-sign'` の値（ユーザーに諮る。推奨は `false`。材料は lock-rerun.md の2節）。
   - 値を決めた後に、`pnpm install` が 0 で終わるかは確かめていない（私の許可に `pnpm install` が無いため）。
2. `pnpm-lock.yaml`・`pnpm-workspace.yaml` をコミットするか（今は2つとも git の管理外）。コミットしないと、ovsx の依存の版は固定されない。
3. Claude Code 2.1.323 が出ている。上げるかは、取り込みの流れで扱う（72時間を満たすのは 2026-11-15T22:13:36Z 以降）。
4. 前から持ち越している点（今回は手を付けていない）。
   - ソースのタグ3件を、判定でどう扱うか
   - `audio-capture.node` の署名
   - Defender の走査に管理者の権限が要るかの切り分け

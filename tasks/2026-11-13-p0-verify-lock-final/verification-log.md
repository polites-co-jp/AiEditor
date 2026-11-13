# Phase 0 の検証（5）の記録: 台帳の全件の走らせ直しと、固定した ovsx（A-4）

- 検証: 大岡越前守（2026-11-13）
- 対象: 蒙恬の `tasks/2026-11-13-p0-lock-final/`（lock-rerun.md・handoff-notes.md）、書き直された `extensions.lock.json`（`git diff`）、`tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` の末尾の追記、`C:\b\p0\vsix\verify-result.json`、`package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`node_modules/.modules.yaml`
- 照らした基準: docs/04 の3節・4節、docs/user-decisions.md の「ovsx の版の固定」「ソースのタグ」「ovsx の依存の install スクリプト」（2026-11-13、コミット bd2aabd）
- 守ったこと: `pnpm install`・`pnpm approve-builds` は走らせていない。`pnpm-workspace.yaml` は書き換えていない。`C:\b\p0\data\` の環境は起動していない。本番の `verify-result.json` は上書きしていない（走らせる前後で `verifiedAt` が 2026-11-13T03:26:03.284Z のまま、SHA-256 `02bc6c36...e824e`）。

## 判定: 合格（1〜4 とも合格）

ただし、コミットの前にやることが1つ残っている（5節の N-1。`pnpm-workspace.yaml` の値が裁定と違う）。これは 1〜4 の合否の条件には入っていない。

| 項目 | 判定 | 要点 |
|---|---|---|
| 1 A-4（ovsx の固定） | 合格 | `node <repo>\node_modules\ovsx\bin\ovsx` を node で直に起動している。npx は使っていない。版は 1.4.0 で、package.json・pnpm-lock.yaml・入っている包みの3つが一致する |
| 2 台帳 | 合格 | 9件とも docs/04 の3節の形。前との差は `verifiedAt`・Claude Code の `checks.soak`・`sourceTag` の置き場所の3つだけ。寝かせる期間の計算も正しい |
| 3 1件の走らせ直し（pdf） | 合格 | 蒙恬の申告と同じ結果。終了コードが 1 だった理由は試しの結果ファイルに残っていた古い行で、pdf のせいではない（3節） |
| 4 vsce-sign の install スクリプト | 合格 | 読んだ中身と、`bin/` が無い状態で検証が通った事実の両方が、「走らせなくても署名の検証は動く」という結論を支える |

## 1. A-4: ovsx が固定した 1.4.0 から起動されているか

| 確かめたこと | 方法 | 結果 |
|---|---|---|
| 版の宣言 | `package.json` を読んだ | `devDependencies.ovsx: "1.4.0"`（正確な x.y.z。`^` や `~` は付いていない） |
| lockfile | `pnpm-lock.yaml` を読んだ | `importers['.'].devDependencies.ovsx`: `specifier: 1.4.0`、`version: 1.4.0`。`ovsx@1.4.0` の完全性 `sha512-QrbKEXh9EEaDfZ8kojxtsRkJTXXdhX4zH3gweANSbonDlMF69vDjLm0cYQFQOExlVAQ+0A0F5CATawTG/iN4iw==`。依存: `@vscode/vsce` 4.1.0（`sha512-iWNykEfL...ZQRExw==`）、`@vscode/vsce-sign` 2.1.0（`sha512-9AQrqazr...sATEE6g==`）、`@vscode/vsce-sign-win32-x64` 2.0.6（`sha512-mgth9Kvz...NuGrBTQ==`）、ほかに commander 14.0.3・semver 7.8.6・yauzl-promise 4.0.0 など |
| 入っているものが lockfile と同じか | `sha256sum pnpm-lock.yaml node_modules/.pnpm/lock.yaml` | 2つとも `92478f974215ce504ecb1fb089ea032dfc2a52998cd94300d0cc0b5b1a09bcaf` で一致。入っている依存の木は、リポジトリの直下の lockfile のとおり |
| `node_modules/ovsx` の実体 | `sha256sum` で `node_modules/ovsx/` と `node_modules/.pnpm/ovsx@1.4.0/node_modules/ovsx/` の `package.json`・`bin/ovsx` を比べた | `package.json` は2つとも `715a6c13...e2de`、`bin/ovsx` は2つとも `b0354671...2b47`。`package.json` の `version` は `1.4.0`、`bin` は `bin/ovsx` |
| pnpm の状態 | `node_modules/.modules.yaml` を読んだ | `packageManager: pnpm@11.8.0`、`ignoredBuilds: ["@vscode/vsce-sign@2.1.0"]`（この1件だけ）、`pendingBuilds: []`、`registries.default: https://registry.npmjs.org/` |
| 台本の起動の仕方 | `scripts/lock-verify.mjs` の 172〜215 行を読んだ | `resolveOvsx()` が `package.json` の宣言と `node_modules/ovsx/package.json` の版を `checkPinnedTool` で比べ、一致したときだけ `run(process.execPath, [bin, "verify-signature", ...])` で起動する。合わなければ `error` を返し、npx には逃げない。`scripts/` に `npx` で起動する箇所は無い（grep で、一致したのはコメントと説明の文だけ） |
| 実際の起動（本番の記録） | `C:\b\p0\vsix\verify-result.json` を grep した | 9件とも `ovsx.command` は `C:\Program Files\nodejs\node.exe e:\develop\self\Team\projects\ai-editor\node_modules\ovsx\bin\ovsx verify-signature -i ... -m ...\sig\.signature.manifest -s ...\sig\.signature.sig -k ...\public-key.pem`。`ovsxVersion: "1.4.0"`、`exitCode: 0`、`stdout: "✅  Signature is valid."` |
| 実際の起動（私の試し） | 3節 | 同じ形で、同じ出力 |

- 私には Web の道具が無いので、npm のレジストリの公開値（完全性・`scripts`）は見ていない。蒙恬が見て一致を報告している（lock-rerun.md の1節の1）。私が確かめたのは、lockfile と入っている依存の木が同じであること。
- 単体テスト: `node --test tests/lock.test.mjs` は 115件すべて通った（`checkPinnedTool` の14件を含む）。

## 2. 台帳（`extensions.lock.json`）

### 2.1 形（`validateLockEntry`）

- 私の許可ではスクリプトを書き足せない（`tasks/` に置いたものは `node` で起動できない）。そのため、`validateLockEntry`（`scripts/lib/lock.mjs` の 81〜126 行）の規則を読み、9件に1つずつ手で当てた。

| 規則 | 9件の結果 |
|---|---|
| 必須の8項目（`id`・`version`・`source`・`download`・`sha256`・`publishedAt`・`verified`・`engines`）がある | 9件ともある |
| `id` が `<発行元>.<名前>` | 9件とも合う（`MS-CEINTL.vscode-language-pack-ja` も合う） |
| `version` が x.y.z | 2.1.322・1.40.2・2025.4.0・1.43.2・3.24.1・1.5.8・0.2.3・1.2.2・1.131.0 |
| `source` が `open-vsx` | 9件とも |
| `download` が https の URL | 9件とも |
| `sha256` が64桁の16進の小文字 | 9件とも。値は `sha256sum` で計った VSIX の値と9件とも一致した（2.3） |
| `publishedAt` が ISO 8601 | 9件とも、マイクロ秒つきの `Z` の形（例 `2026-11-10T02:30:51.973288Z`）。正規表現 `(?:\.\d+)?` に合い、`Date.parse` でも読める（読めなければ `isSoaked` が偽になり soak は通らない。9件とも `soaked: true`） |
| `verified` が真偽値 | 9件とも `true` |
| `engines` が `^x.y.z` か `>=x.y.z` | 9件とも `^` の形 |
| `targetPlatform` が知っている値 | Claude Code だけが持ち、`win32-x64` |
| 任意の文字列の項目・`crossCheck`・`manifestDigest` の型 | 合う。`license` が無いのは pdf だけ、`licenseSha256` が無いのは Claude Code・bash-ide-vscode・言語パック（どちらも任意の項目） |

- 台本の側でも同じ検査がかかっている。`--write-lock` は、書く前に1件ずつ `validateLockEntry` をかけ、誤りがあれば `ok` にしない（`lock-verify.mjs` の 668〜671 行）。本番の記録の `lockWrite.written` は9件で、`kept`・`omitted`・`untouched` はどれも空。
- `checks` は必須の項目だけ（Claude Code は11項目、ほかは7項目）で、値は全部 `"pass"`。Claude Code 以外の8件は `checks` に `sourceTag` が無く、`references.sourceTag` が `found`（5件）か `not-found`（3件）。Claude Code は `references` を持たない。

### 2.2 前の台帳との差（`git diff extensions.lock.json`）

- `git diff --stat`: 68行の変化（42行増え、26行減った）。蒙恬の申告と同じ。
- 中身の変化は次の3つだけ。差分の全部の塊（hunk）を読んで確かめた。
  1. `verifiedAt`: 9件とも、前の回（2026-11-12T20:19:21Z〜20:21:29Z）から今回（2026-11-13T03:25:31.820Z〜03:26:01.687Z）に変わった。
  2. Claude Code の `checks.soak`: `"fail"` から `"pass"` に変わった。
  3. Claude Code 以外の8件: `checks.sourceTag` を外し、`references.sourceTag` を足した。`pass` は `found` に（basedpyright・powershell・bash-ide-vscode・rainbow-csv・dotenv-vscode）、`fail` は `not-found` に（wx-vsce-dotenv・pdf・言語パック）読み替えている。読み替えの規則は `sourceTagRef`（`lock-verify.mjs` の 556〜561 行）と合う。
- 版・`sha256`・`sha256Source`・`signature`・`publicKey`・`publishedAt`・`publishedBy`・`license`・`licenseSha256`・`engines`・`crossCheck`・`manifestDigest`・`note` は、差分に出てこない（変わっていない）。`crossCheck.sourceTag`（見つかったタグの名前、無ければ `null`）も前のまま。
- 裁定（ソースのタグは参考の項目）と合う。必須の `checks` から外れ、記録は `references` と `crossCheck` に残っている。

### 2.3 VSIX のハッシュ（`sha256sum`）

9件の VSIX をもう一度ハッシュし、台帳の `sha256` と9件とも一致した（Claude Code `8c0b09c6...e4a4`、basedpyright `9c87b0b9...f351`、powershell `458eef45...b283`、bash-ide-vscode `2eb16563...04c2`、rainbow-csv `0ecb7da3...514a`、dotenv-vscode `c8905977...2537`、wx-vsce-dotenv `9c081a0e...2b1a`、pdf `5697cd02...dce`、言語パック `fae5a901...f601`）。

### 2.4 Claude Code の寝かせる期間

- 公開: `2026-11-10T02:30:51.973288Z`（台帳の `publishedAt`、記録の `soak.publishedAt`）。
- 72時間が満ちる時刻: `2026-11-13T02:30:51.973Z`。
- 判定の時刻: `2026-11-13T03:25:31.820Z`（記録の `soak.now`。台帳の `verifiedAt` と同じ）。
- 経過: 72時間54分39.85秒。蒙恬の「72時間54分40秒」は秒を丸めた値で、合っている。`isSoaked` は「72時間以上で真」（`lock.mjs` の 137〜143 行。単体テストでも境界を確かめている）なので、`soaked: true`。
- `listedInAllVersions: true`、`security: false`。`soak.status` は `soaked && listedInAllVersions` で `pass`（`lock-verify.mjs` の 478〜485 行）。
- 注意: `listedInAllVersions` は `lock-fetch` で取った時点（`fetch-result.json` の `fetchedAt` 2026-11-12T20:18:09Z）の値で、判定の時刻（7時間後）に取り直したものではない（5節の N-2）。

## 3. 固定した ovsx での1件の走らせ直し（`tomoki1207.pdf`）

```
node scripts/lock-verify.mjs --dir C:/b/p0/vsix --only tomoki1207.pdf --result C:/b/p0/trial/verify-result.json
```

- 画面の出力: `[lock-verify] tomoki1207.pdf 1.2.2` → `-> 通った`、`参考（必須ではない）: ソースのタグ 見つからない`、`記録: C:\b\p0\trial\verify-result.json`。
- 終了コード: 1。理由は pdf ではない。`--only` を付けると、対象外の拡張は前の結果ファイルの行をそのまま写す（`lock-verify.mjs` の 625〜628 行）。試しのファイル `C:\b\p0\trial\verify-result.json` には、前の検証（2026-11-12T20:43Z）の `weixu.wx-vsce-dotenv` の行（`ok: false`、`failed: ["ovsx"]`、`skipped: ["defender"]`）が残っていて、それが写されたので `results.some(r => !r.ok)` が真になった（685 行）。走らせる前に、この行があることを確かめてある。
- pdf の結果（判定の時刻 `2026-11-13T03:33:35.876Z`）と、蒙恬の申告（handoff-notes.md の「テストの入口」）との照合:

| 期待 | 結果 |
|---|---|
| `ovsx.status: "pass"` | `pass` |
| `ovsxVersion: "1.4.0"` | `1.4.0` |
| `exitCode: 0` | `0` |
| `stdout: "✅  Signature is valid."` | 同じ。`stderr` は空、`error` は `null` |
| `command` に `node_modules\ovsx\bin\ovsx` を含み、`npx` を含まない | `C:\Program Files\nodejs\node.exe e:\develop\self\Team\projects\ai-editor\node_modules\ovsx\bin\ovsx verify-signature -i C:\b\p0\vsix\tomoki1207.pdf-1.2.2\tomoki1207.pdf-1.2.2.vsix -m ...\sig\.signature.manifest -s ...\sig\.signature.sig -k ...\public-key.pem`。npx は無い |

- ほかの項目も本番の記録と同じ: 発行元 `pass`（verified true）、SHA-256 `pass`（`5697cd02...dce`）、自前の署名 `pass`（ed25519、380件中380件、誤り0）、寝かせる期間 `pass`、engines `pass`（^1.46.0 と 1.146.0）、Defender `pass`（終了コード 0、`found no threats`）、ライセンスの本文のハッシュ `4a122ef7...ba3`（台帳の `licenseSha256` と同じ）、参考のソースのタグ `not-found`（タグ4件）。`failed`・`skipped` は空、`ok: true`。

## 4. `@vscode/vsce-sign` の install スクリプトを走らせなくても、署名の検証は動くか

蒙恬の結論（「走らせなくても `ovsx verify-signature` は動く。許す必要は無い」）を、次の根拠で確かめた。

| 蒙恬の主張 | 私が確かめたこと |
|---|---|
| install スクリプトは `postinstall: node ./src/postinstall.js` | 入っている `@vscode/vsce-sign@2.1.0` の `package.json` の `scripts.postinstall` がそのとおり。ほかの `package`・`download`・`test` は入れるときには走らない |
| ふつうは、同じ PC 向けの包みの `vsce-sign.exe` を `bin/` に写すだけ | `src/postinstall.js` の `setup()`（53〜56 行）は `require.resolve('@vscode/vsce-sign-win32-x64/bin/vsce-sign.exe')` を `fs.copyFileSync` するだけ。写す元が見つからないときだけ、`fallbackSetup()` が `npm install --force`（`cp.execSync`、95〜120 行）を走らせ、それも失敗するとレジストリから tgz を直に取る（`https.get`、129〜166 行）。直に取るときにハッシュを照らさないことも、コードのとおり |
| 写す元はもう入っている。`bin/` は今は無い | `node_modules/.pnpm/@vscode+vsce-sign-win32-x64@2.0.6/node_modules/@vscode/vsce-sign-win32-x64/bin/vsce-sign.exe` はある。`@vscode/vsce-sign/` の下には `src/`・`package.json` と文書だけがあり、`bin/` は無い（Glob で確かめた） |
| ovsx の `verify-signature` は vsce-sign を使わない | `ovsx/lib/verify-signature.js` が読み込むのは `crypto`・`fs`・`./zip` だけ。検証は `crypto.createPublicKey` と `crypto.verify(null, packageBytes, publicKey, signature)`、それに manifest の各エントリーの SHA-256 の照合。`./zip`（`lib/zip.js`）が読み込むのは `crypto`・`yauzl-promise`・`stream` だけ |
| vsce-sign は読み込まれるが、`bin/` が無くても読み込みは失敗しない | `lib/main.js` → `lib/publish.js` → `@vscode/vsce` → `out/package.js` の 81 行が `require("@vscode/vsce-sign")`。`vsce-sign/src/main.js` は、読み込まれたときに exe のパスを組み立てるだけで、exe を起動するのは `verify`・`generateManifest`・`zip` を呼んだときだけ（`execFile`、151〜185 行） |
| 私たちの台本は vsce を使わない | `scripts/` を grep した。一致したのは拡張の名前 `weixu.wx-vsce-dotenv` と、npx を使わないという説明の文だけ |
| 実行の結果 | `bin/` が無い今の状態で、本番の9件も私の試しの pdf も、終了コード 0 と `✅  Signature is valid.` になった |

- 結論は、読んだ根拠と実行の結果の両方で支えられる。合格。
- 蒙恬の「許した場合も (a)・(b) には進まない見込み」は、読んだ結果からの推定で、走らせてはいない（蒙恬もそう書いている）。裁定は「走らせない」なので、この推定は今は判定に効かない。

## 5. 指摘（1〜4 の合否には効かないが、知らせておく）

- **N-1（コミットの前に必須）: `pnpm-workspace.yaml` の値が裁定と違う。** 今の中身は `allowBuilds: '@vscode/vsce-sign': set this to true or false`（pnpm が書いた仮の値のまま）。裁定（docs/user-decisions.md 146 行、docs/04 の4節の2）は `'@vscode/vsce-sign': false`。依頼書で書き換えを止められているので、私は触れていない。リーダーが `false` に直してからコミットする必要がある。
  - コミットの対象も、裁定（147 行）では `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml` の3つ。今 git が管理しているのは `package.json` だけで、`pnpm-lock.yaml`・`pnpm-workspace.yaml` は管理外。
  - `false` にした後に `pnpm install` が 0 で終わるかは、誰も確かめていない（私も蒙恬も、`pnpm install` の許可が無い）。
- **N-2: 取り下げの確認が、判定の時刻のものではない。** docs/04 の4節の4は「確認の時点でその版が取り下げられていないことも見る」と書く。`lock-verify` の `listedInAllVersions` は `lock-fetch` で取った時点（2026-11-12T20:18:09Z）の値を使う。今回の判定（2026-11-13T03:25Z）とは7時間ずれる。
  - 前の記録（records の1節）で「取り直さずに走らせ直す」と決めたのは私で、今回の手順はそれに従っている。lock-rerun.md 3節の「取り下げられていない」も、取った時点の事実としては正しい。
  - 判定の時刻に Open VSX で 2.1.322 が残っているかは、記録に無い（Marketplace の 2.1.322 は判定の時刻に確かめていて、残っている）。
  - Phase 1 の毎週の取り込みでは、`lock-verify` が判定のときに `allVersions` を取り直すか、`lock-fetch` と `lock-verify` を続けて走らせる手順にするかを決める必要がある。リーダーの判断。
- **N-3: docs/07 の2.7の3が古い。** 今も `npx ovsx verify-signature ...` と書いてある。裁定（版の固定、npx を使わない）と docs/04 の4節の2に合わせて直す必要がある（docs はリーダーが直す）。
- **N-4: docs/04 の3節の例に `checks`・`references` が無い。** 台帳は、3節の例に `checks`（必須の項目の結果）と `references`（参考の項目）を足した形になっている。`validateLockEntry` は足した項目を拒まないので形の誤りではないが、3節に書き足すかはリーダーの判断（records の5節の前からの持ち越しと同じ）。
- **N-5（曹参へ）: `--only` の試しの終了コード。** 試しの結果ファイルに古い行が残っていると、`--only` の対象が通っても終了コードは 1 になる。結合のテストで終了コードを見るなら、空の結果ファイルを `--result` に渡すか、`results[]` の対象の行の `ok` を見ること。
- **N-6（言葉の小さな食い違い）:** lock-rerun.md の4節と下書きの追記の3は、`sourceTag` を `references` に分けたことを「A-4 の直しの新しい形」と書く。A-4 は ovsx の版の固定のことで、`references` に分けたのはソースのタグの裁定（2026-11-13）による直し。判定には効かない。
- 気づいたこと（蒙恬の報告と同じ）: Marketplace と Open VSX の最新は Claude Code 2.1.323（Open VSX の公開 2026-11-12T22:13:36Z、72時間が満ちるのは 2026-11-15T22:13:36Z）。台帳は 2.1.322 のまま。上げるかは取り込みの流れで扱う。

## 6. 流したコマンド

| コマンド | 結果 |
|---|---|
| `git status --short` | `extensions.lock.json` と下書きが変更、`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`tasks/2026-11-13-p0-lock-final/` の2件が管理外 |
| `git diff extensions.lock.json` / `git diff --stat` | 2.2 のとおり |
| `git diff tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` | 末尾に「追記（2026-11-13）」の21行。中身は lock-rerun.md と合う |
| `git log -3 ... -- docs/user-decisions.md docs/04-bundled-extensions.md` | 裁定のコミット bd2aabd（2026-11-13 12:31:35 +0900）。蒙恬の走らせ直し（12:25〜12:26）の後 |
| `git ls-files package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore` | `package.json` と `.gitignore` だけ |
| `sha256sum pnpm-lock.yaml node_modules/.pnpm/lock.yaml ...ovsx...` | 1節のとおり |
| `sha256sum C:/b/p0/vsix/verify-result.json ...pdf の VSIX・sig...` | 本番の記録は上書きされていない。pdf の VSIX は台帳と一致 |
| `sha256sum <ほかの8件の VSIX>` | 2.3 のとおり |
| `node --test tests/lock.test.mjs` | 115件すべて通った（fail 0） |
| `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --only tomoki1207.pdf --result C:/b/p0/trial/verify-result.json` | 3節のとおり |

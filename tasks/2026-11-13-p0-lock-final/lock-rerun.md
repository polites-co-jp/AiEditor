# 0-6 の仕上げ: 台帳の9件の走らせ直しと、固定した ovsx での検証

- 作成: 蒙恬（2026-11-13）
- 走らせた時刻: 2026-11-13T03:25:31Z〜03:26:03Z（日本時間 12:25:31〜12:26:03）
- 機械の記録: `C:\b\p0\vsix\verify-result.json`（前の回の結果を上書きした。前の回の内容は `tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` にある）
- 台帳: `extensions.lock.json`（9件とも新しい値で書き直した）
- 台本は変えていない（`scripts/` は前の回のまま）。`pnpm approve-builds` は走らせていない。`pnpm-workspace.yaml` も書き換えていない。`C:\b\p0\data\` には触れていない。

## 1. `@vscode/vsce-sign` の install スクリプトと、`ovsx verify-signature` が動くか

### 結論

- install スクリプトは `postinstall: node ./src/postinstall.js`。やることは、同じ PC 向けの別の包み（`@vscode/vsce-sign-win32-x64@2.0.6`）に入っている `bin/vsce-sign.exe` を、`@vscode/vsce-sign/bin/vsce-sign.exe` に**写すだけ**。
- **走らせなくても `ovsx verify-signature` は動く**。ovsx 1.4.0 の `verify-signature` は vsce-sign を使わず、Node.js の `crypto` だけで検証する。実際に、vsce-sign の `bin/` が無い今の状態で、9件とも終了コード 0、出力 `✅  Signature is valid.` になった（3節）。
- したがって、install スクリプトを許す（`true`）必要はない。

### 出典と確かめたこと

1. スクリプトの中身
   - 入っている `node_modules/.pnpm/@vscode+vsce-sign@2.1.0/node_modules/@vscode/vsce-sign/package.json` の `scripts`: `"postinstall": "node ./src/postinstall.js"`（ほかの `package`・`download`・`test` は開発用で、入れるときには走らない）。
   - npm のレジストリの公開値も同じ（https://registry.npmjs.org/@vscode/vsce-sign/2.1.0 の `scripts.postinstall`）。包みの完全性 `sha512-9AQrqazrBgTgRSuwleLVXUrIUphY02/SFCh2TKYoLV/xifJAdblhdmEmw5gUrYSPQ3sRwNs9iyCMD14sATEE6g==` も、`pnpm-lock.yaml` の値と一致した。
2. `src/postinstall.js` の流れ（入っているファイルを読んだ）
   - `getTarget(process.platform, npm_config_arch ?? process.arch)` で `win32-x64` を決める（`src/target.js`）。
   - `bin/` を作り、`require.resolve('@vscode/vsce-sign-win32-x64/bin/vsce-sign.exe')` を `bin/vsce-sign.exe` に `fs.copyFileSync` で写す。**ふつうはここで終わる**。通信もしないし、何も実行しない（node だけ）。
   - 写す元が見つからないときに限り、次の2段の代わりの手を使う。
     - (a) 仮のフォルダで `npm install --loglevel=error --prefer-offline --no-audit --progress=false --force @vscode/vsce-sign-win32-x64@2.0.6` を走らせ（`child_process.execSync`。npm のレジストリへの通信）、できた `vsce-sign.exe` を移す。
     - (b) それも失敗したら、`https://registry.npmjs.org/@vscode/vsce-sign-win32-x64/-/vsce-sign-win32-x64-2.0.6.tgz` を `https.get` で直に取り、tar.gz から `package/bin/vsce-sign.exe` を取り出して書く。**このとき、ハッシュの照合はしない**。
   - この PC では、写す元が pnpm の配置（`node_modules/.pnpm/@vscode+vsce-sign@2.1.0/node_modules/@vscode/vsce-sign-win32-x64/`）から見えている。そのため、許したとしても (a)・(b) には進まない見込み（読んだ結果で、走らせてはいない）。
   - 写す元の `vsce-sign.exe` は `@vscode/vsce-sign-win32-x64@2.0.6`（Microsoft の包み。`pnpm-lock.yaml` の完全性 `sha512-mgth9Kvze+u8CruYMmhHw6Zgy3GRX2S+Ed5oSokDEK5vPEwGGKnmuXua9tmFhomeAnhgJnL4DCna3TiNuGrBTQ==`）にもう入っている。install スクリプトが写さなかったので、`@vscode/vsce-sign/bin/` は今は無い（Glob で確かめた）。
3. vsce-sign を使うのは誰か
   - `@vscode/vsce@4.1.0` の `out/package.js` が `require("@vscode/vsce-sign")` で読み込む。使うのは `generateManifest`・`verify`（`.signature.p7s` を使う Marketplace の署名の検証）・`zip` の3つで、どれも `bin/vsce-sign.exe` を `execFile` で起動する。
   - `@vscode/vsce-sign` の `src/main.js` は、読み込まれたときに exe のパスを組み立てるだけで、exe には触れない。そのため、`bin/` が無くても読み込みは失敗しない。
   - ovsx 1.4.0 の `lib/main.js` は `lib/publish.js` を読み、`publish.js` は `@vscode/vsce` を読む。つまり vsce-sign は読み込まれる。しかし、`verify-signature` の命令（`lib/verify-signature.js`）は `crypto.createPublicKey`・`crypto.verify(null, packageBytes, publicKey, signature)`（Ed25519）と、`./zip` の `hashAllZipEntries` だけを使う。vsce-sign は呼ばない。
   - 私たちの台本（`scripts/`・`extensions-src/`・`tools/`）で vsce を使うものは無い（grep で確かめた。`vsce` に一致したのは拡張の名前 `weixu.wx-vsce-dotenv` だけ）。
4. pnpm の動き（pnpm 11.8.0。`node_modules/.modules.yaml` の `packageManager`）
   - https://pnpm.io/settings/build : `allowBuilds` は「包みの指定から、スクリプトの実行を許す（`true`）か許さない（`false`）かへの対応表」。載っていない包みは許さないうえに「まだ見ていない」扱いになる。`strictDepBuilds` は既定 `true` で、まだ見ていない install スクリプトがあると、入れる処理が 0 以外の終了コードで終わる（`ERR_PNPM_IGNORED_BUILDS`）。止めた包みは `pnpm-workspace.yaml` に仮の値で書き足され、手で `true` か `false` にする。
   - `node_modules/.modules.yaml` の `ignoredBuilds` は `@vscode/vsce-sign@2.1.0` の1件だけ。ほかに install スクリプトで止めたものは無い。ネイティブの部品（`@napi-rs/keyring-win32-x64-msvc`・`@node-rs/crc32-win32-x64-msvc`）は、ビルド済みの包みとして入っている。

## 2. 判断の材料: `pnpm-workspace.yaml` の `allowBuilds` の値（ユーザーに諮る）

1節のとおり、ovsx の署名の検証は動く。そのため、この判断は検証の結果を左右しない。ただし、値が仮のままだと `pnpm install` が毎回 `ERR_PNPM_IGNORED_BUILDS` で 0 以外を返す。`--frozen-lockfile` で入れ直す手順も、毎回この失敗の形で止まる。どれかに決める必要がある。

| 案 | 書き方 | 結果 |
|---|---|---|
| A（推奨） | `'@vscode/vsce-sign': false` | install スクリプトを走らせないことを「見たうえで許さない」と記録する。pnpm の文書の読みでは、エラーにならなくなる（「まだ見ていない」包みが無くなるため。実際に `pnpm install` を走らせて確かめてはいない）。ovsx の `verify-signature` は今と同じに動く。使えなくなるのは `@vscode/vsce` の Marketplace の署名まわり（`vsce` の packaging の署名・p7s の検証）だけで、私たちは使っていない |
| B | `'@vscode/vsce-sign': true` | 次の `pnpm install` で `node ./src/postinstall.js` が走る。ふつうは `vsce-sign.exe`（Microsoft の署名の道具。もう入っている包みのもの）を `bin/` に写すだけで、通信も実行もしない。写す元が見つからないときに限り、`npm install --force` を走らせ、それもだめならレジストリから直に取る（直に取るときはハッシュを照らさない）。得るものは無い |
| C | 仮の値のまま | `pnpm install` が毎回 0 以外で終わる。入れること自体はできるが、失敗と見分けがつかない |

- 別の手として `strictDepBuilds: false` もある。こうするとエラーが警告になる。ただし、これから増える依存の install スクリプトもまとめて黙らせることになるので、勧めない。
- どの案でも、`pnpm-lock.yaml` と `pnpm-workspace.yaml` をコミットしないと、依存の版は固定されない（今は2つとも git の管理外）。コミットするかどうかはリーダーが決める。

## 3. 台帳の9件の走らせ直し

### 走らせたコマンド

リポジトリの直下で、次を走らせた。`--only` は付けていない。

```
node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --write-lock extensions.lock.json
```

- 終了コード 0。
- ovsx の起動の形（verify-result.json の `ovsx.command`）: `C:\Program Files\nodejs\node.exe e:\develop\self\Team\projects\ai-editor\node_modules\ovsx\bin\ovsx verify-signature -i <vsix> -m <sig\.signature.manifest> -s <sig\.signature.sig> -k <public-key.pem>`。
  - `node_modules\ovsx` を起動しており、`npx` は使っていない。`ovsxVersion` は9件とも `1.4.0`。
  - `node_modules\ovsx` は pnpm の配置の `node_modules\.pnpm\ovsx@1.4.0\node_modules\ovsx` を指している。

### 結果

凡例: 通 = 通った。参考 = 必須ではない項目（裁定 2026-11-13）。

| ID | 版 | 発行元 | SHA-256 | 署名（自前） | ovsx 1.4.0 | 72時間 | engines | Defender | Claude Code の照合 | 参考: ソースのタグ |
|---|---|---|---|---|---|---|---|---|---|---|
| anthropic.claude-code（win32-x64） | 2.1.322 | 通 | 通 | 通（49） | 通 | **通** | 通 | 通（VSIX と claude.exe） | CLI のハッシュ 通、GPG 通、Authenticode 通、Marketplace 通 | — |
| detachhead.basedpyright | 1.40.2 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | あり |
| ms-vscode.powershell | 2025.4.0 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | あり |
| mads-hartmann.bash-ide-vscode | 1.43.2 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | あり |
| mechatroner.rainbow-csv | 3.24.1 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | あり |
| dotenv.dotenv-vscode | 1.5.8 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | あり |
| weixu.wx-vsce-dotenv | 0.2.3 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | 無い |
| tomoki1207.pdf | 1.2.2 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | 無い |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | 通 | 通 | 通 | 通 | 通 | 通 | 通 | — | 無い |

- 9件とも `ok: true`。`failed`・`skipped` はどれも空。
- **Claude Code の寝かせる期間**: 公開 2026-11-10T02:30:51.973288Z、判定の時刻 2026-11-13T03:25:31.820Z。**経過は72時間54分40秒で、`checks.soak` は `pass`**。Open VSX の `allVersions` に載っていて（取り下げられていない）、`security` は false。
- Claude Code の照合の値は前の回と同じ。
  - claude.exe の SHA-256: `345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298`、346,496,160 バイト
  - GPG: `GOODSIG`・`VALIDSIG 31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`
  - Authenticode: `Valid`、`CN="Anthropic, PBC"`、拇印 `60C2D9C51F09822FFF4F194DE9EEDB67451292D1`
  - Defender: 終了コード 0、`found no threats`
- 台帳への書き込み（`lockWrite`）: 新しく書いたのは9件全部。残した行（`kept`）・書かなかった行（`omitted`）・そのまま残した行（`untouched`）は、どれも無い。

### 気づいたこと（判定には効かないが、知らせておく）

- Marketplace の最新が **2.1.323** になっていた（verify-result.json の `marketplace.latestListed`。前の回は 2.1.322）。
- Open VSX の `https://open-vsx.org/api/Anthropic/claude-code/win32-x64/latest` も `version: 2.1.323`、`timestamp: 2026-11-12T22:13:36.105878Z`、`verified: true`、`publishedBy: igorkofman` だった。
- 72時間を満たすのは 2026-11-15T22:13:36Z（日本時間 11-16 07:13:36）。今回は `lock-fetch` を走らせ直していないので、台帳は 2.1.322 のまま。2.1.323 に上げるかは、毎週の取り込みの流れ（docs/06）で扱うことになる。

## 4. 台帳の差分（`git diff extensions.lock.json`）

42行増え、26行減った。中身の変化は次の3つだけ。版・`sha256`・`publishedAt`・`crossCheck`・`manifestDigest`・`license` などの値は変わっていない。

1. 9件とも `verifiedAt` を今回の時刻に書き直した（例: Claude Code は `2026-11-12T20:21:03.553Z` → `2026-11-13T03:25:31.820Z`）。
2. Claude Code の `checks.soak` を `"fail"` から `"pass"` にした。
3. Claude Code 以外の8件で、`checks.sourceTag` を外し、`references.sourceTag` に分けた（A-4 の直しの新しい形）。
   - `found`（`"pass"` から読み替え）: basedpyright・powershell・bash-ide-vscode・rainbow-csv・dotenv-vscode
   - `not-found`（`"fail"` から読み替え）: wx-vsce-dotenv・pdf・言語パック

## 5. 前の下書きへの追記

`tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md` の末尾に「追記（2026-11-13）: 固定した ovsx での走らせ直し」を足した。前の下書きと違った点は次の5つ。

- Claude Code の72時間が通らなかった（×）のが、通った。
- ovsx の起動が `npx ovsx` から固定した `node_modules\ovsx`（1.4.0）になった。結果は同じ。
- ソースのタグの置き場所が `checks` から `references` に移り、値が found / not-found になった。
- Marketplace の最新が 2.1.323 になった。
- 2節の終わりの「`npx ovsx` は初回に npm から取った」は、もう当てはまらない。

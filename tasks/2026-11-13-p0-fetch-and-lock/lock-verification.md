# 0-6 台帳の取得と検証（下書き）

- 作成: 蒙恬（2026-11-13）。大岡越前守が確かめて `records/phase0/lock-verification.md` に清書する。
- 検証した時刻: 2026-11-12T20:19Z〜20:21Z（日本時間 2026-11-13 05:19〜05:21）。1回目は Claude Code の GPG の項目が台本の誤り（gpg に渡すパスの形。2節の3）で通らなかったので、直して Claude Code だけを 20:21Z に走らせ直した（GPG が通った）。tomoki1207.pdf も、ovsx の呼び方を直した確認のために 20:21Z に走らせ直した（結果は1回目と同じ）。下の結果は走らせ直した後のもの。
- 台本: `node scripts/lock-fetch.mjs`（取得）→ `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --write-lock extensions.lock.json`（検証と台帳）
- 機械の記録: `C:\b\p0\vsix\verify-result.json`（拡張ごと・項目ごとの結果と、走らせたコマンド・出力）
- 台帳: `extensions.lock.json`（9件。docs/04 の3節の形に `checks` と `note` を足した）

## 1. 結果の一覧

凡例: 通 = 通った、×= 通らない、— = 対象外。

| ID | 版 | 1 発行元 | 2 SHA-256 | 2 署名（自前） | 2 ovsx | 4 72時間 | 9 engines（1.146.0） | 8 Defender | 3 ソースのタグ | 3 Claude Code の照合 |
|---|---|---|---|---|---|---|---|---|---|---|
| anthropic.claude-code（win32-x64） | 2.1.322 | 通 | 通 | 通 | 通 | **×（時間待ち）** | 通（^1.94.0） | 通 | — | CLI のハッシュ 通、GPG 通、Authenticode 通、Marketplace 通 |
| detachhead.basedpyright | 1.40.2 | 通 | 通 | 通 | 通 | 通 | 通（^1.101.0） | 通 | 通（`v1.40.2`） | — |
| ms-vscode.powershell | 2025.4.0 | 通 | 通 | 通 | 通 | 通 | 通（^1.101.0） | 通 | 通（`v2025.4.0`） | — |
| mads-hartmann.bash-ide-vscode | 1.43.2 | 通 | 通 | 通 | 通 | 通 | 通（^1.91.0） | 通 | 通（`vscode-client-1.43.2`、bash-lsp/bash-language-server） | — |
| mechatroner.rainbow-csv | 3.24.1 | 通 | 通 | 通 | 通 | 通 | 通（^1.95.0） | 通 | 通（`3.24.1`） | — |
| dotenv.dotenv-vscode | 1.5.8 | 通 | 通 | 通 | 通 | 通 | 通（^1.65.0） | 通 | 通（`v1.5.8`） | — |
| weixu.wx-vsce-dotenv | 0.2.3 | 通 | 通 | 通 | 通 | 通 | 通（^1.96.0） | 通 | ×（xuwaters/vscode-extensions にタグが1つも無い） | — |
| tomoki1207.pdf | 1.2.2 | 通 | 通 | 通 | 通 | 通 | 通（^1.46.0） | 通 | ×（tomoki1207/vscode-pdfviewer のタグ4つに 1.2.2 が無い） | — |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | 通 | 通 | 通 | 通 | 通 | 通（^1.131.0） | 通 | ×（Microsoft/vscode-loc のタグ141に 1.131.0 で終わるものが無い） | — |

- **通らなかった必須の項目は1つだけ**: Claude Code 2.1.322 の「公開から72時間」。公開は 2026-11-10T02:30:51.973288Z で、検証の時点で約65.8時間。**2026-11-13T02:30:52Z（日本時間 11:30:52）を過ぎれば通る**。走らせ直すコマンド: `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --only anthropic.claude-code --write-lock extensions.lock.json`（取り直しは要らない）。
- ソースのタグ（docs/04 の4節の3「ほかの拡張: ソースのリポジトリに同じ版のリリースかタグがある」）は、台本では必須にしていない（参考の記録）。3件が通らない。判定でどう扱うかはリーダーに諮る（doc-corrections.md の5）。
- 取り下げ: 9件とも、選んだ版が Open VSX の最新のメタデータの `allVersions` にあった（取り下げられていない）。

## 2. 項目ごとの手順と結果

### 1 発行元

- Open VSX の `verified` は9件とも true。`publishedBy`: claude-code `igorkofman`（github）、basedpyright `DetachHead`、rainbow-csv `mechatroner`、dotenv-vscode `motdotla`、wx-vsce-dotenv `xuwaters`、powershell・bash-ide-vscode・pdf・言語パックは `open-vsx`（Open VSX 側が公開した形）。前の台帳が無いので「前の版から変わったか」は今回は見ていない（`--prev-lock <前の台帳>` で見る）。
- Claude Code の `publishedWithTrustedPublishing` は false。

### 2 完全性: SHA-256

- 手順: VSIX を Node.js の `crypto` で SHA-256（`Get-FileHash -Algorithm SHA256` と同じ値）にし、Open VSX の `.sha256`（64桁の16進が1行）と比べた。9件とも一致。Claude Code は docs/07 の2.7 の公開値 `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4` と一致。

### 2 完全性: 署名（.sigzip）と `ovsx verify-signature`

- **.sigzip の中身**（9件とも同じ形）: `.signature.sig`・`.signature.manifest`・`.signature.p7s` の3つ。
- **`-m` に渡すもの**: .sigzip から取り出した **`.signature.manifest`**。`-s` には **`.signature.sig`**、`-k` には Open VSX の公開鍵（PEM）。出典:
  - `npx ovsx verify-signature --help`（ovsx 1.4.0）: `-i, --packagePath <path> Path to the .vsix package.`、`-m, --manifestPath <path> Path to the signature manifest file.`、`-s, --signaturePath <path> Path to the signature file.`、`-k, --publicKeyPath <path> Path to the registry's public key file.`
  - ovsx のソース https://raw.githubusercontent.com/eclipse/openvsx/master/cli/src/verify-signature.ts のコメント: "the `.sigzip` a registry serves has a `.signature.sig` and a `.signature.manifest` entry, matching `--signaturePath` and `--manifestPath` here"。署名は VSIX のバイト列全体に対する Ed25519（`crypto.verify(null, packageBytes, publicKey, signature)`）。manifest は `package.digests.sha256`（VSIX 全体）と `entries`（キーは zip のエントリー名の base64、値は `digests.sha256` が base64）を持ち、署名の対象ではない（中身の照合にだけ使う）。
  - README https://raw.githubusercontent.com/eclipse/openvsx/master/cli/README.md: `ovsx verify-signature -i <package.vsix> -m <manifest> -s <signature> -k <publicKey>`。
- 決めた手順: `npx ovsx verify-signature -i <vsix> -m <取り出した .signature.manifest> -s <取り出した .signature.sig> -k <public-key.pem>`。9件とも終了コード 0、出力 `✅  Signature is valid.`。
- 自前の照合（lock-verify.mjs、ovsx と同じ手順を Node.js の `crypto` で行う）: 公開鍵は **Ed25519**（`createPublicKey` の `asymmetricKeyType` が `ed25519`。docs/sources の「推定」が確かめられた）。署名は9件とも有効。`.signature.manifest` のエントリーの数と VSIX のファイルの数が一致し、全エントリーの SHA-256 が一致した（Claude Code 49、basedpyright 5,425、powershell 293、bash-ide-vscode 2,453、rainbow-csv 59、dotenv-vscode 276、wx-vsce-dotenv 12、pdf 380、言語パック 100）。
- 公開鍵は9件とも同じ `https://open-vsx.org/api/-/public-key/14ccb407-4e79-41ed-be5a-6d608325c45a`（PEM、SHA-256 `ef5759c51be559f00443ab7d568d26304430bdd422592bfa63e6ac584bfe983b`）。
- `.signature.p7s` は使っていない（ovsx の verify-signature も使わない）。中身は未確認。
- `npx ovsx` は初回に ovsx 1.4.0 を npm から取って入れた（`npm warn exec The following package was not found and will be installed: ovsx@1.4.0`）。版を固定するなら、`package.json` の devDependencies に入れる案がある（未着手。リーダーの判断）。

### 3 公式配布物との一致（Claude Code）

| 項目 | 手順 | 結果 |
|---|---|---|
| (a) Marketplace の同じ版 | `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`（`filterType: 7`＝拡張の名前 `anthropic.claude-code`、`flags: 145`＝版・版の属性・アセットの URL。`Accept: application/json;api-version=3.0-preview.1`）。メタデータだけで、VSIX は取らない | 通。発行元 `anthropic`（表示名 Anthropic、`https://anthropic.com`、`isDomainVerified: true`、flags `verified`）。2.1.322 が8つの platform（darwin-x64・win32-x64・linux-x64・win32-arm64・linux-arm64・alpine-arm64・darwin-arm64・alpine-x64）で載っている。win32-x64 の `lastUpdated` 2026-11-10T02:40:34.717Z。Marketplace の最新も 2.1.322 |
| (b) 同梱の CLI のハッシュ | VSIX から `extension/resources/native-binary/claude.exe` を取り出し（`C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\bundled-cli\claude.exe`。中身は読まない）、SHA-256 を `https://downloads.claude.ai/claude-code-releases/2.1.322/manifest.json` の `platforms.win32-x64.checksum` と比べた | 通。`345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298` で一致。サイズ 346,496,160 も `size` と一致。manifest の `version` は 2.1.322 |
| (b) manifest.json.sig の GPG | 鍵 `https://downloads.claude.ai/keys/claude-code.asc` を使い捨ての鍵束（`C:\b\p0\vsix\gnupg-tmp\`。終わったら消す）に入れ、`gpg --batch --status-fd 1 --verify manifest.json.sig manifest.json` | 通。入れた鍵の指紋 `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`（docs の指紋と一致）。`GOODSIG BAA929FF1A7ECACE Anthropic Claude Code Release Signing <security@anthropic.com>`、`VALIDSIG 31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE 2026-11-10 ...`（RSA） |
| (c) Authenticode | `Get-AuthenticodeSignature -LiteralPath <claude.exe>`（Windows PowerShell 5.1） | 通。Status `Valid`、署名者 `CN="Anthropic, PBC", O="Anthropic, PBC", L=San Francisco, S=California, C=US, ...`、発行者 `CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1`、拇印 `60C2D9C51F09822FFF4F194DE9EEDB67451292D1`、期限 2027-10-29、タイムスタンプ `CN=DigiCert SHA256 RSA4096 Timestamp Responder 2026 1` |

- 使った gpg: `E:\ProgramFiles\Git\usr\bin\gpg.exe`（Git for Windows に入っている GnuPG 2.4.9。PATH から見つけた）。台本は `C:\Program Files\Git\usr\bin\gpg.exe`・`C:\Program Files\GnuPG\bin\gpg.exe`・`C:\Program Files (x86)\GnuPG\bin\gpg.exe`・PATH の順に探す。
- 注意: Git for Windows の gpg は MSYS のプログラムで、`C:/b/...` の形のパスを相対パスと読む（1回目はこれで鍵の取り込みに失敗した）。`/c/b/...` の形に直して渡すようにした。

### 4 寝かせる期間

- 判定: `isSoaked(publishedAt, now)`（公開から72時間以上で真）。Claude Code 以外の8件は通る。Claude Code は上の1節のとおり時間待ち。
- 版の選び方（lock-fetch.mjs）: 最新が台帳（今回は docs/04 の版）より新しく、72時間たっていれば最新、そうでなければ台帳の版。今回は9件とも最新が docs/04 の版と同じ。

### 5 manifest の差分・6 ファイルの一覧の差分

- 前の版が無いので差分は取っていない。manifest の要約（`manifestDigest`）は台帳に、ファイルの一覧は拡張ごとの `files.json` に残した。次の版からは `node scripts/lock-diff.mjs --from <前の版の置き場所> --to <新しい版の置き場所>` で差を出せる（終了コード 2＝見る項目の変化か新しい実行ファイルがある）。
- 実行ファイルを持つ拡張: Claude Code（`claude.exe`、`audio-capture.node`。claude-code-manifest.md）、ms-vscode.powershell（`.dll` が多数。`extension/modules/PSScriptAnalyzer/`・`PowerShellEditorServices/`・`PSReadLine/`）。ほかの7件は .exe・.dll・.node を持たない（files.json の検索）。
- 気づいた manifest の事実（判定に影響しうるもの）:
  - ms-vscode.powershell: `extensionDependencies: ["vscode.powershell"]`（組み込みの `powershell` 拡張に依存）。`contributes.debuggers` がある。起動は `onDebugResolve:PowerShell` を含む。
  - dotenv.dotenv-vscode: `activationEvents` に `"*"`（起動時に必ず動く）。
  - ms-vscode.powershell の展開後のサイズは 315,561,343 バイトで、そのうち `extension/modules/PSScriptAnalyzer/` が 299,241,860 バイト。

### 7 ライセンス

| ID | VSIX の中のライセンスのファイル | 本文の SHA-256（台帳の `licenseSha256`） |
|---|---|---|
| anthropic.claude-code | 無い（manifest と API の `license` の文だけ） | 無し |
| detachhead.basedpyright | `extension/LICENSE*` | `f7c936bc43f132b08497ac952e9376cbc102e5eedb4bf6ec902ea8442bd9c68d` |
| ms-vscode.powershell | 同 | `296604f12546653ed97726dc5fc2f3945d4cca1f07abd2589f531647177b06fc` |
| mads-hartmann.bash-ide-vscode | 無い（`node_modules` の下の依存のライセンスだけ） | 無し |
| mechatroner.rainbow-csv | `extension/LICENSE*` | `513c680325145127f89c5b8e994325dd9235948428f959f7ad32be7659473d6d` |
| dotenv.dotenv-vscode | 同 | `3e52872c802245dfe69494710634b674ae45d06eed4a513462f33eabf0141faf` |
| weixu.wx-vsce-dotenv | 同 | `f1c342b0e6e3fc9d9bc9e68d490d91437db08962e56aa7f9e10c5675a0fbee41` |
| tomoki1207.pdf | 同 | `4a122ef7d968fb456f9ae28b8af03d45ece22438ac61556bf7121ca41ac4fba3` |
| MS-CEINTL.vscode-language-pack-ja | 無い | 無し |

ライセンスのファイルが無い3件は、台帳に `licenseSha256` が無い。版を上げたときの「本文のハッシュが同じか」は、Claude Code なら `license` の文そのものを比べる（docs/04 の4節の7の補い。doc-corrections.md の4）。

### 8 ウイルスの走査（Defender）

- **決めた引数**: `MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation`。出典 https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus （`-ScanType 3` はカスタムの走査、`-File` はカスタムの走査の対象、`-DisableRemediation` はカスタムの走査だけで「アーカイブも走査する・除外を無視する・検出しても処置しない・結果をコマンドの出力に出す」。戻り値 0＝見つからない、2＝見つかった・誤り）。docs/04 の4節の8の例に `-DisableRemediation` を足した。
- 実行ファイルの場所: `C:\ProgramData\Microsoft\Windows Defender\Platform\<版>\MpCmdRun.exe` の一番新しい版（今回 `4.18.26100.4-0`）。無ければ `C:\Program Files\Windows Defender\MpCmdRun.exe`。
- 結果: 9件の VSIX と、取り出した claude.exe のどれも終了コード 0、`... found no threats.`。
- 文書は「管理者のコマンドプロンプトで動かす」と書くが、今回の走査は通った。このセッションが管理者だったかは確かめていない。

### 9 engines

`satisfiesEngine(engines.vscode, "1.146.0")`。9件とも満たす。

## 3. 台帳（extensions.lock.json）

- 9件。docs/04 の2節の順。.env の2件には `note` に「0-3 の後にどちらを残すかを決める（裁定: エラー表示を持つほう）」と書いた。
- docs/04 の3節の項目に、次を足した: `checks`（項目ごとの結果。`pass`・`fail`）、`note`、`crossCheck` の `bundledCliPath`・`bundledCliSha256`・`manifestGpgSignature`（Claude Code）と `sourceTag`・`sourceRepository`（ほかの拡張）。
- `verdict` は、まだ取り込みの判定が無いので `records/phase0/lock-verification.md`（この下書きの清書の場所）を指す。
- `publishedAt` は Open VSX の値をそのまま（`2026-11-10T02:30:51.973288Z` のように小数の秒を含む）。
- `targetPlatform` は platform 別の版（Claude Code）だけに書いた。ほかは universal なので書いていない。
- 全件が `validateLockEntry` を誤り無しで通る（lock-verify.mjs が書く前に確かめる）。
- **Claude Code の `checks.soak` は `fail`**。72時間たってから上のコマンドで走らせ直すと `pass` になる。

## 4. 材料の置き場所

`C:\b\p0\vsix\<id>-<版>[@<target>]\`（fetch-log.md の2節）。全体の記録は `C:\b\p0\vsix\fetch-result.json`・`verify-result.json`。

## 追記（2026-11-13）: 固定した ovsx での走らせ直し

ユーザーがリポジトリの直下で `pnpm install` を済ませ、ovsx 1.4.0 が `node_modules` に入った。そのあと、9件すべて（`--only` なし）を走らせ直した。詳しくは `tasks/2026-11-13-p0-lock-final/lock-rerun.md`。

- 時刻: 2026-11-13T03:25:31Z〜03:26:03Z（日本時間 12:25:31〜12:26:03）。
- コマンド: `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --write-lock extensions.lock.json`。終了コード 0。
- `C:\b\p0\vsix\verify-result.json` と `extensions.lock.json` を書き直した。この下書きの1〜3節は、前の回（2026-11-12T20:19Z〜20:21Z）の記録としてそのまま残す。

上の節と違った点は次の5つ。

1. **1節の表の「4 72時間」**: Claude Code が「×（時間待ち）」から「通」になった。
   - 公開 2026-11-10T02:30:51.973288Z、判定 2026-11-13T03:25:31.820Z で、経過は72時間54分40秒。
   - 台帳の `checks.soak` は `pass`。9件とも `ok: true` で、通らない必須の項目は無い。
2. **2節の「2 ovsx」**: 起動が `npx ovsx` から、固定した `node <repo>\node_modules\ovsx\bin\ovsx verify-signature ...`（ovsx 1.4.0）になった。9件とも終了コード 0、`✅  Signature is valid.` で、結果は前と同じ。2節の終わりの「`npx ovsx` は初回に ovsx 1.4.0 を npm から取って入れた」は、もう当てはまらない。
   - `@vscode/vsce-sign` の install スクリプトは、pnpm が走らせなかった（`ERR_PNPM_IGNORED_BUILDS`）。それでも ovsx の `verify-signature` は動く。ovsx の `verify-signature` は vsce-sign を使わず、Node.js の `crypto` だけで検証するため（lock-rerun.md の1節）。
3. **3節（台帳）の `checks`**: ソースのタグを `checks.sourceTag`（pass / fail）から外し、`references.sourceTag`（found / not-found）に分けた（A-4 の直しの新しい形）。見つからない3件は前と同じで、wx-vsce-dotenv・pdf・言語パック。
4. **2節の「3 (a) Marketplace」**: Marketplace の最新が、2.1.322 から 2.1.323 になった。
   - Open VSX の 2.1.323（win32-x64）の公開は 2026-11-12T22:13:36.105878Z で、72時間を満たすのは 2026-11-15T22:13:36Z。
   - 今回は取り直していないので、台帳は 2.1.322 のまま。
5. **台帳の値**: 変わったのは `verifiedAt`・Claude Code の `checks.soak`・`checks` と `references` の分け方の3つだけ。版・`sha256`・`publishedAt`・`crossCheck`・`manifestDigest`・ライセンスの値は前と同じ。

# 0-6 台帳の取得と検証

- 記録: 大岡越前守（2026-11-13）。下書き `tasks/2026-11-13-p0-fetch-and-lock/lock-verification.md`（蒙恬）を、自分で走らせた結果と照らして清書した。検証の記録は `tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`。
- 自分で走らせた検証: `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0`。各拡張の判定の時刻は 2026-11-12T20:30:15Z〜20:30:48Z（日本時間 2026-11-13 05:30:15〜05:30:48）。記録は `C:\b\p0\vsix\verify-result.json`（`verifiedAt` 2026-11-12T20:30:50.657Z）。終了コード 1（Claude Code の寝かせる期間が通らないため）。
- `--write-lock` は付けていない。Claude Code 2.1.322 の寝かせる期間がまだ満ちていないため（下の1節）。
- 独立の照合: `sha256sum` で9件の VSIX、同梱の claude.exe、本体の zip 2件をハッシュした（4節）。

## 1. 状態: Claude Code 2.1.322 は「時間待ち」

- 公開: 2026-11-10T02:30:51.973288Z（Open VSX の timestamp）。
- 72時間が満ちる時刻: **2026-11-13T02:30:52Z（日本時間 2026-11-13 11:30:52）**。
- 検証の時点（2026-11-12T20:30:15Z）では約66時間で、`isSoaked` は偽。寝かせる期間の項目だけが通らず、ほかの必須の項目（発行元、SHA-256、署名、ovsx、engines、Defender、同梱の CLI のハッシュ、GPG、Authenticode、Marketplace）はすべて通った。
- 取り下げは無い（2.1.322 は最新のメタデータの `allVersions` にある）。
- 11:30:52 を過ぎたら、取り直さずに次を走らせ、全件が通ったときだけ台帳を書く。
  `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --only anthropic.claude-code --write-lock extensions.lock.json`
  その結果をこの記録に足す。それまでは、今の `extensions.lock.json` の Claude Code の行は `checks.soak: "fail"` のままで、台帳は確定していない（docs/04 の2節「台帳に載せる版は、4節の検証を通したものにする」）。

## 2. 結果の一覧（2026-11-12T20:30Z の実行）

凡例: 通 = 通った、× = 通らない、— = 対象外。

| ID | 版 | 1 発行元 | 2 SHA-256 | 2 署名（自前の照合） | 2 ovsx | 4 72時間 | 9 engines（1.146.0） | 8 Defender | 3 ソースのタグ | 3 Claude Code の照合 |
|---|---|---|---|---|---|---|---|---|---|---|
| anthropic.claude-code（win32-x64） | 2.1.322 | 通 | 通 | 通（49件） | 通 | **×（時間待ち）** | 通（^1.94.0） | 通 | — | CLI のハッシュ 通、GPG 通、Authenticode 通、Marketplace 通、CLI の Defender 通 |
| detachhead.basedpyright | 1.40.2 | 通 | 通 | 通（5,425件） | 通 | 通 | 通（^1.101.0） | 通 | 通（`v1.40.2`） | — |
| ms-vscode.powershell | 2025.4.0 | 通 | 通 | 通（293件） | 通 | 通 | 通（^1.101.0） | 通 | 通（`v2025.4.0`） | — |
| mads-hartmann.bash-ide-vscode | 1.43.2 | 通 | 通 | 通（2,453件） | 通 | 通 | 通（^1.91.0） | 通 | 通（`vscode-client-1.43.2`、bash-lsp/bash-language-server） | — |
| mechatroner.rainbow-csv | 3.24.1 | 通 | 通 | 通（59件） | 通 | 通 | 通（^1.95.0） | 通 | 通（`3.24.1`） | — |
| dotenv.dotenv-vscode | 1.5.8 | 通 | 通 | 通（276件） | 通 | 通 | 通（^1.65.0） | 通 | 通（`v1.5.8`） | — |
| weixu.wx-vsce-dotenv | 0.2.3 | 通 | 通 | 通（12件） | 通 | 通 | 通（^1.96.0） | 通 | **×**（xuwaters/vscode-extensions にタグが0件） | — |
| tomoki1207.pdf | 1.2.2 | 通 | 通 | 通（380件） | 通 | 通 | 通（^1.46.0） | 通 | **×**（tomoki1207/vscode-pdfviewer のタグ4件に 1.2.2 が無い） | — |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | 通 | 通 | 通（100件） | 通 | 通 | 通（^1.131.0） | 通 | **×**（Microsoft/vscode-loc のタグ141件に 1.131.0 が無い） | — |

下書きの表（2026-11-12T20:19Z〜20:21Z の実行）と、項目ごとの結果はすべて同じだった。

### 判定が要る点

- **ソースのタグ（docs/04 の4節の3「ほかの拡張: ソースのリポジトリに同じ版のリリースかタグがある」）**: 3件（weixu.wx-vsce-dotenv、tomoki1207.pdf、言語パック）が満たさない。台本はこの項目を必須にしておらず、終了コードにも効かない。docs は検証の項目として挙げているので、この3件は **docs/04 の4節を全部は通っていない**。扱い（docs を「記録だけ」に直すか、必須にして3件の扱いをユーザーに諮るか）はリーダーの判断を要する（蒙恬の `doc-corrections.md` の5の1）。
- .env の2件は両方とも台帳にあり、`note` に「0-3 の後にどちらを残すかを決める」と書いてある。

## 3. 項目ごとの手順（決まったもの）

| 項目 | 手順 | 確かめたこと |
|---|---|---|
| 1 発行元 | Open VSX の `verified` | 9件とも true。`publishedBy`: claude-code `igorkofman`（github）、basedpyright `DetachHead`、rainbow-csv `mechatroner`、dotenv-vscode `motdotla`、wx-vsce-dotenv `xuwaters`、ほかの4件は `open-vsx`。前の台帳が無いので変化は見ていない（`--prev-lock` で見る） |
| 2 SHA-256 | VSIX の SHA-256 を Open VSX の `.sha256`（64桁の16進が1行）と比べる | 9件とも一致。`sha256sum` でも同じ値（4節）。Claude Code の `.sha256` のファイルの中身も直接読み、`8c0b09c6...e4a4` で一致 |
| 2 署名 | `.sigzip` は `.signature.sig`・`.signature.manifest`・`.signature.p7s` の zip。`npx ovsx verify-signature -i <vsix> -m <.signature.manifest> -s <.signature.sig> -k <公開鍵の PEM>` | 9件とも終了コード 0、`Signature is valid.`。自前の照合（Ed25519 で VSIX 全体の署名を検証し、`.signature.manifest` の全エントリーの SHA-256 を VSIX の中身と照合）も9件とも通り、エントリーの数が一致し、誤りは0件 |
| 3 Claude Code (a) Marketplace | `extensionquery`（`filterType: 7`、`flags: 145`）でメタデータだけを取る。VSIX は取らない | 発行元 `anthropic`（`isDomainVerified: true`、flags `verified`）。2.1.322 が8つの platform で載り、win32-x64 の `lastUpdated` 2026-11-10T02:40:34.717Z。Marketplace の最新も 2.1.322 |
| 3 Claude Code (b) CLI のハッシュ | VSIX の `extension/resources/native-binary/claude.exe` を取り出し（中身は読まない）、`https://downloads.claude.ai/claude-code-releases/2.1.322/manifest.json` の `platforms.win32-x64.checksum` と比べる | `345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298` で一致、サイズ 346,496,160 も一致。`manifest.json` を直接読んで確かめた |
| 3 Claude Code (b) GPG | 鍵 `https://downloads.claude.ai/keys/claude-code.asc` を使い捨ての鍵束に入れ、`gpg --batch --status-fd 1 --verify manifest.json.sig manifest.json`。Git for Windows の gpg には `/c/...` の形でパスを渡す | `GOODSIG`、`VALIDSIG 31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`。取り込んだ鍵の指紋も docs の指紋と一致。使い捨ての鍵束は終わったら消える。gpg は GnuPG 2.4.9（Git for Windows） |
| 3 Claude Code (c) Authenticode | `Get-AuthenticodeSignature -LiteralPath <claude.exe>` | `Valid`。署名者 `CN="Anthropic, PBC", O="Anthropic, PBC"`、発行者 DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1、拇印 `60C2D9C51F09822FFF4F194DE9EEDB67451292D1`、期限 2027-10-29、タイムスタンプ DigiCert |
| 4 寝かせる期間 | `isSoaked(publishedAt, now)`（72時間以上で真）と、`allVersions` に版があること | Claude Code だけ時間待ち（1節） |
| 5 manifest の差分・6 ファイルの一覧の差分 | 前の版が無いので差は取っていない。次からは `node scripts/lock-diff.mjs --from <前> --to <新>` | 要約は台帳の `manifestDigest`、一覧は拡張ごとの `files.json` |
| 7 ライセンス | VSIX の `extension/LICENSE*` の本文の SHA-256 | Claude Code・bash-ide-vscode・言語パックは拡張自身の LICENSE のファイルを持たない（`files.json` で確かめた）。ほかの6件は台帳の `licenseSha256` にある |
| 8 Defender | `MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation`（`C:\ProgramData\Microsoft\Windows Defender\Platform\4.18.26100.4-0\MpCmdRun.exe`） | 9件の VSIX と取り出した claude.exe が、終了コード 0、`found no threats` |
| 9 engines | `satisfiesEngine(engines.vscode, "1.146.0")` | 9件とも満たす |

## 4. 独立の照合（`sha256sum`）

| ファイル | SHA-256 | 台帳・記録との一致 |
|---|---|---|
| Anthropic.claude-code-2.1.322@win32-x64.vsix | `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4` | 一致（台帳、`.sha256`、docs/07 の2.7） |
| bundled-cli\claude.exe | `345996b4bdbae21d817f750fae2f34cbf8d81224a5444c78136091d121beb298` | 一致（release の manifest.json） |
| detachhead.basedpyright-1.40.2.vsix | `9c87b0b992714ca2f9298cb7e98bda621612f0ee96121a8e77ee7fcccce2f351` | 一致 |
| ms-vscode.powershell-2025.4.0.vsix | `458eef45b6110e3d9867d23943b843ca4a9d0d96d1672db5ad156bc178f6b283` | 一致 |
| mads-hartmann.bash-ide-vscode-1.43.2.vsix | `2eb16563ed946b801a45d3d298f0ca35a268d39656ea18f33062ff9d65fc04c2` | 一致 |
| mechatroner.rainbow-csv-3.24.1.vsix | `0ecb7da3fb2a54517cd41fce8e858d6276ea8523bed6fbfd64d5ed281bd7514a` | 一致 |
| dotenv.dotenv-vscode-1.5.8.vsix | `c8905977784ddebcc2fd45ecafd7ce66d7675f7c3435c2a2d41c7023161f2537` | 一致 |
| weixu.wx-vsce-dotenv-0.2.3.vsix | `9c081a0e26328c86055bf722b9d99237a88151622187ef9709c54380198f2b1a` | 一致 |
| tomoki1207.pdf-1.2.2.vsix | `5697cd022caf93fa0fdb8c5b9c3624951394d8126ed09184ad4fdbcad62dadce` | 一致 |
| MS-CEINTL.vscode-language-pack-ja-1.131.0.vsix | `fae5a90170d48121bd8fe246d7d8ecbdab5bf88f21a0d58c94a3cc3af8c0f601` | 一致 |
| VSCode-win32-x64-1.146.0.zip | `0d47f5bbff72499c6a4a92f6d72dd8cc5ba4606185f624465032626614119d61` | 一致（fetch-log、版の API の `sha256hash`） |
| VSCodium-win32-x64-1.143.17232.zip | `a1090868af8ac0ac04c22d79fdd02246fa115a78daf38a741d8db06df1753c1d` | 一致（fetch-log） |

## 5. 台帳（`extensions.lock.json`）

- 9件。docs/04 の3節の形（`id`・`version`・`targetPlatform`（Claude Code だけ）・`source`・`download`・`sha256`・`sha256Source`・`signature`・`publicKey`・`publishedAt`・`publishedBy`・`verified`・`license`・`licenseSha256`・`engines`・`crossCheck`・`manifestDigest`・`verifiedAt`・`verdict`）に、`checks`（項目ごとの結果）と `note`（.env の2件）を足した。`crossCheck` には、Claude Code に `bundledCliPath`・`bundledCliSha256`・`manifestGpgSignature`、ほかの拡張に `sourceTag`・`sourceRepository` を足した。docs/04 の3節の例にこれらを書き足すかはリーダーの判断。
- 9件の `sha256` は、上の `sha256sum` の値とすべて一致した。
- 今の台帳は 2026-11-12T20:19Z〜20:21Z の実行で書かれたもので、Claude Code の `checks.soak` は `fail`。1節の走らせ直しで確定する。

## 6. 残っている点

1. Claude Code の寝かせる期間（日本時間 11:30:52 以降に走らせ直し、`--write-lock`）。
2. ソースのタグの3件の扱い（2節。リーダーの判断）。
3. `npx ovsx` の版が固定されていない（実行のたびに npm の最新を取る。今回は 1.4.0）。
4. `audio-capture.node` の署名とハッシュは見ていない（docs の対象外）。
5. Defender の走査が管理者の権限を要るかは切り分けていない（今回の実行では通った）。

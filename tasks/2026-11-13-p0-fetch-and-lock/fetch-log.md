# Phase 0 の材料の取得の記録

- 作成: 蒙恬（2026-11-13）
- 取得した時刻: 2026-11-12T20:11Z〜20:18Z（日本時間 2026-11-13 05:11〜05:18）
- 台本: `node scripts/p0-fetch.mjs`（本体の zip の取得と照合。展開は `scripts/p0-expand.ps1` を呼ぶ）、`node scripts/lock-fetch.mjs --seed tasks/2026-11-13-p0-fetch-and-lock/lock-seed.json --out C:/b/p0/vsix`（台帳の拡張）
- 機械の記録: `C:\b\p0\p0-fetch.json`（本体）、`C:\b\p0\vsix\fetch-result.json`（拡張）

## 1. 本体

| もの | 版 | 取得元 | SHA-256（取得したファイル） | 公開の値との照合 | 置き場所 |
|---|---|---|---|---|---|
| 本家 VS Code（Windows x64 の zip） | 1.146.0（commit `69047191fc427f2f92828279aae1d90d8eeda7ab`、2026-11-10T19:37:29Z） | `https://update.code.visualstudio.com/1.146.0/win32-x64-archive/stable` | `0d47f5bbff72499c6a4a92f6d72dd8cc5ba4606185f624465032626614119d61`（402,750,279 バイト） | 一致（`https://update.code.visualstudio.com/api/versions/1.146.0/win32-x64-archive/stable` の `sha256hash`） | zip: `C:\b\p0\downloads\VSCode-win32-x64-1.146.0.zip`、展開: `C:\b\p0\vscode-1.146.0\` |
| VSCodium（Windows x64 の zip） | 1.143.17232（GitHub の latest。2026-10-28T08:54:31Z 公開） | `https://github.com/VSCodium/vscodium/releases/download/1.143.17232/VSCodium-win32-x64-1.143.17232.zip` | `a1090868af8ac0ac04c22d79fdd02246fa115a78daf38a741d8db06df1753c1d`（231,406,156 バイト） | 一致（同じリリースの `.sha256` と、GitHub の API の asset の `digest` の両方） | zip: `C:\b\p0\downloads\VSCodium-win32-x64-1.143.17232.zip`、展開: `C:\b\p0\vscodium-1.143.17232\` |

- **版を指す URL は正しかった**（docs/07 の2.1 の「見込み（推定）」が確かめられた）。`https://update.code.visualstudio.com/1.146.0/win32-x64-archive/stable` は 302 で `https://vscode.download.prss.microsoft.com/dbazure/download/stable/69047191fc427f2f92828279aae1d90d8eeda7ab/VSCode-win32-x64-1.146.0.zip` へ転送され、これは版の API（`/api/versions/<版>/win32-x64-archive/stable`）の `url` と同じ。
- **本家の最新の安定版**: 1.146.0（`https://update.code.visualstudio.com/api/update/win32-x64-archive/stable/latest` の `productVersion`。`/api/releases/stable` の先頭も 1.146.0。続く 1.145.3・1.145.2・1.145.1・1.145.0）。1.146.0 より新しい安定版はまだ無い。
- **本家の zip の中の配置**: `Code.exe`・`bin\code.cmd` は展開先の直下にあるが、`resources\app\` は直下ではなく、commit の先頭10桁のフォルダの下（`C:\b\p0\vscode-1.146.0\69047191fc\resources\app\`）にある。組み込み拡張は `...\69047191fc\resources\app\extensions\`。VSCodium 1.143.17232 は従来どおり `resources\app\extensions\` が直下にある。
- 本家の zip の展開: 3,278 ファイル。VSCodium: 2,991 ファイル（`Glob` での数）。

## 2. 台帳の拡張（docs/04 の2節。.env は2つとも）

版の決め方: Open VSX の今の最新（取得の時点）と docs/04 の版を比べた。**9件とも、今の最新が docs/04 の版と同じだった**ため、docs と違う版にしたものは無い。

| ID | 版 | targetPlatform | 公開日（Open VSX の timestamp） | 公開から72時間 | VSIX の SHA-256（計算）＝`.sha256` の値 | サイズ（バイト） |
|---|---|---|---|---|---|---|
| anthropic.claude-code | 2.1.322 | win32-x64 | 2026-11-10T02:30:51.973288Z | **未満**（2026-11-13T02:30:51Z にたつ） | `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4` | 165,854,286 |
| detachhead.basedpyright | 1.40.2 | universal | 2026-10-04T12:25:49.914519Z | 以上 | `9c87b0b992714ca2f9298cb7e98bda621612f0ee96121a8e77ee7fcccce2f351` | 6,433,623 |
| ms-vscode.powershell | 2025.4.0 | universal | 2025-10-09T03:36:27.240064Z | 以上 | `458eef45b6110e3d9867d23943b843ca4a9d0d96d1672db5ad156bc178f6b283` | 20,672,771 |
| mads-hartmann.bash-ide-vscode | 1.43.2 | universal | 2026-09-21T03:38:44.995031Z | 以上 | `2eb16563ed946b801a45d3d298f0ca35a268d39656ea18f33062ff9d65fc04c2` | 5,334,250 |
| mechatroner.rainbow-csv | 3.24.1 | universal | 2026-03-01T03:14:35.623063Z | 以上 | `0ecb7da3fb2a54517cd41fce8e858d6276ea8523bed6fbfd64d5ed281bd7514a` | 880,552 |
| dotenv.dotenv-vscode | 1.5.8 | universal | 2026-10-01T16:02:32.595343Z | 以上 | `c8905977784ddebcc2fd45ecafd7ce66d7675f7c3435c2a2d41c7023161f2537` | 1,179,947 |
| weixu.wx-vsce-dotenv | 0.2.3 | universal | 2026-10-15T04:16:45.844718Z | 以上 | `9c081a0e26328c86055bf722b9d99237a88151622187ef9709c54380198f2b1a` | 87,986 |
| tomoki1207.pdf | 1.2.2 | universal | 2022-12-23T03:58:06.463846Z | 以上 | `5697cd022caf93fa0fdb8c5b9c3624951394d8126ed09184ad4fdbcad62dadce` | 3,093,014 |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | universal | 2026-07-28T04:15:48.245385Z | 以上 | `fae5a90170d48121bd8fe246d7d8ecbdab5bf88f21a0d58c94a3cc3af8c0f601` | 686,124 |

- 取得元の URL はどれも `https://open-vsx.org/api/<namespace>/<name>[/<target>]/<版>/file/<namespace>.<name>-<版>[@<target>].vsix`。`.sha256`・`.sigzip` は同じ名前で拡張子だけ違う。manifest は同じ場所の `package.json`。公開鍵は9件とも同じ `https://open-vsx.org/api/-/public-key/14ccb407-4e79-41ed-be5a-6d608325c45a`。
- 置き場所: `C:\b\p0\vsix\<id>-<版>[@<target>]\`。中身は VSIX、`.sha256`、`.sigzip`、`public-key.pem`、`package.json`（manifest）、`extension.vsixmanifest`（tomoki1207.pdf は Open VSX が 404 を返したので無い）、`LICENSE.*`（Open VSX の files にあるものだけ）、`api.json`（その版の Open VSX のメタデータ）。
- 検証の材料（lock-verify が作る）: `sig\.signature.sig`・`sig\.signature.manifest`（.sigzip の中身）、`files.json`（ファイルの一覧）、Claude Code は `bundled-cli\claude.exe`（同梱の CLI を取り出したもの）と `claude-release\manifest.json`・`manifest.json.sig`・`claude-code.asc`。
- basedpyright は Open VSX に win32-x64 向けの版が無く、universal を使った（`/api/detachhead/basedpyright/win32-x64` は universal を返さない）。
- 発行者（`publishedBy`）: claude-code は `igorkofman`、basedpyright は `DetachHead`、rainbow-csv は `mechatroner`、dotenv-vscode は `motdotla`、wx-vsce-dotenv は `xuwaters`、powershell・bash-ide-vscode・pdf・言語パックは `open-vsx`（Open VSX 側が公開した形）。verified は9件とも true。

## 3. docs と違う版にしたもの

無い（9件とも docs/04 の版のまま）。

ただし Claude Code 2.1.322 は、取得の時点で公開から約65.8時間で、**寝かせる期間（72時間）をまだ満たしていない**。docs/04 の版より新しい版も無いので版は変えず、検証の「寝かせる期間」の項目を「通らない（時間待ち）」として記録した。2026-11-13T02:30:51Z（日本時間 11:30:51）を過ぎてから `node scripts/lock-verify.mjs --only anthropic.claude-code --write-lock extensions.lock.json` を走らせ直せば通る見込み（`lock-verification.md`）。

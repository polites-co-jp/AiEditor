# Phase 0 の根拠のファイルの写し

- 写した人と日: 大岡越前守（2026-11-16）
- 理由: ユーザーの裁定（2026-11-15）で `C:\b\p0` を消すことになった。records が根拠に挙げる小さなファイルだけを、消す前にここへ写した（docs/user-decisions.md の「tmp\b へ移す段取りで出た点」）。
- 元の場所: `C:\b\p0\` の下。ここのフォルダの形は、`C:\b\p0\` からの相対の場所と同じにした（例: `C:\b\p0\sublime\conversion.md` → `sublime/conversion.md`）。
- 中身は直していない。ファイルの中に `C:\b\p0\...` の場所が書いてあっても、それは元の記録のまま。
- 経緯の詳しい記録: `tasks/2026-11-15-move-off-c/evidence-copy-ooka.md`

## 写したもの（SHA-256 は元と写しの両方を `sha256sum` で取った）

| 写し（このフォルダからの場所） | 指している記録 | SHA-256 | 元と |
|---|---|---|---|
| `vsix/verify-result.json` | `records/phase0/lock-verification.md`（4・92行） | `02bc6c36a7fb29319191f6147e7da242b065ee6095b1526d9160eb32d88e824e` | 一致 |
| `vsix/fetch-result.json` | `records/phase0/lock-verification.md`（92行） | `ad6e3e212f8fb28eb17b289e273222ddb6ddea772dac2d7c7cd65966dddfab16` | 一致 |
| `vsix/anthropic.claude-code-2.1.322@win32-x64/files.json` | `records/phase0/claude-code-manifest.md`（5・85行）、`lock-verification.md`（53・54行） | `4ff8062421b4aa24f5a5114dc6ea95d8e8d8af8018579ce3e14f17497268d979` | 一致 |
| `vsix/anthropic.claude-code-2.1.322@win32-x64/extension.vsixmanifest` | `records/phase0/claude-code-manifest.md`（5行） | 写し `ead27a228c81bc816a86fe3acdcde5f64ec6b392c695aef4317438b999120261`、元 `301bdf41b2eaf9dbb9604c588b5b6146e4e51cb5615b01a4ee5182a794fdd3e9` | **違う**（下） |
| `vsix/anthropic.claude-code-2.1.322@win32-x64/api.json` | `records/phase0/claude-code-manifest.md`（5行） | `902c6fcd94eb4fe60019ee8817722186cbce9568bcacc9de3913cf36b38db221` | 一致 |
| `vsix/ms-vscode.powershell-2025.4.0/files.json` | `records/phase0/lock-verification.md`（53行） | `00863dc16c99255e2d0ae71a3817492ab1fcbfedf65981c1903dc4f7bf6f17b5` | 一致 |
| `vsix/mechatroner.rainbow-csv-3.24.1/files.json` | 同上 | `3bc86b9a23c8e0747baacea03b8150c0713775253a640bf1aa8bec90a738037e` | 一致 |
| `vsix/dotenv.dotenv-vscode-1.5.8/files.json` | 同上 | `b27e95dde43e0165182dc0469f7c536a2ecf1632e0b42f35ccc2a8ec8f7c547e` | 一致 |
| `vsix/weixu.wx-vsce-dotenv-0.2.3/files.json` | 同上 | `324db8d81fad6e9c12539a3712c6a3c868857ead91d99a24c9026dad9254c929` | 一致 |
| `vsix/tomoki1207.pdf-1.2.2/files.json` | 同上 | `299011be3b0a3d75f563b92c716f043ce1200be8805a67b37c10d79066b54809` | 一致 |
| `vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0/files.json` | `records/phase0/lock-verification.md`（53・54行） | `4d7f30872b22d3e675b2cf91267a6abc999830b0523bfd6150d0ed8814c1d3c8` | 一致 |
| `trial/verify-result.json` | `records/phase0/lock-verification.md`（106行） | `a37909ba4f53356167cec42e57dff7d74fee8e31f31f9f7e36f2f826f355669a` | 一致 |
| `trial/lock.json` | `records/phase0/lock-verification.md`（106行。同じ試しの出力） | `9f5f055c2072e13e0437bc71ae3dba5c8db0ff03fe6b63c7ef042f655f967917` | 一致 |
| `sublime/conversion.md` | `records/phase0/sublime-keys.md`（4・5行） | `dcca00fdbdfb32629da7d4c9dc7aebc0bbb90fb00b2730538744d759039e644e` | 一致 |
| `sublime/converted-keybindings.json` | `records/phase0/sublime-keys.md`（5行） | `803bc242215d3283a4a5af710fb9f7a1d2ffaa64a272910aa7efc67c415a4c9c` | 一致 |
| `sublime/dropped.json` | 同上 | `5c342d685d87d81edae6abb58b820564aa57df9b6f4bdf4d5e2b148aa92a193c` | 一致 |
| `sublime/claude-code-keybindings.json` | 同上 | `f38ef2a8ebfb5c9dd8fbb0231212a6d40e55f2f56f893006524cfdc3ef398161` | 一致 |
| `sublime/conflicts.json` | 同上 | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | 一致 |
| `sublime/same-key-different-when.json` | 同上 | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | 一致 |
| `sublime/convert-meta.json` | 同上 | `5b8d414856fb0ffea70050a23e3dc49539b4d67196d92371856cf4bca78fdbff` | 一致 |
| `sublime/sublime-4.1.10.package.json` | `records/phase0/sublime-keys.md`（10行） | `fe956455ea2d09561544f83f301ad08f9bb443931f019671c297350b0fdb40fe` | 一致 |
| `sublime/ms-vscode.sublime-keybindings-4.1.10.sha256` | Open VSX の `.sha256`（`sublime-keys.md` の9・20行が照らした値） | `bf8120afe163fd08347807802d3ad4e84a0351d61c6f4d2d935ac0bd0fc1ad71` | 一致 |

- `conflicts.json` と `same-key-different-when.json` は、どちらも中身が `[]` と改行だけなので、同じ SHA-256 になる。
- `api.json` は `C:\b\p0` の側のもの。`C:\b\cache\vsix\` にも同じ版の `api.json` があるが、取得の時刻が違い、中身（`downloadCount` など）が違う。

## 元と同じでない写し: `extension.vsixmanifest`

- 違いは、空白だけの行のタブだけ。元の10行（10・32行目はタブ3つ、18・20・21・23・24・25・29・30行目はタブ4つ。合わせて38字）が、写しでは空の行になった。行の数（44行）、空白でない文字、最後に改行が無いことは同じ。
- 元の SHA-256 は `301bdf41b2eaf9dbb9604c588b5b6146e4e51cb5615b01a4ee5182a794fdd3e9`（2,146 バイト。`vsix/fetch-result.json` の `files.vsixmanifest` にも同じ値がある）。
- 原因: 写す道具（Read と Write）では、空白だけの行のタブを残せなかった。2回書き直して、同じ結果だった。
- 元と同じ中身は、Open VSX の `https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/extension.vsixmanifest` と、VSIX の中の `extension.vsixmanifest`（`files.json` の 2,146 バイト）にもある。取り直したら、上の元の SHA-256 で照らせる。

## 写していないもの

- `netlog\`: 秘密が載りうる（docs/07 の3節）。
- `data\`・`testbed\`・`vscodium-*`・`vsix\` の VSIX・`.sigzip`・`bundled-cli\` など: 大きい。消すと決まった。
- `sublime\ms-vscode.sublime-keybindings-4.1.10.vsix`: テキストでない（zip）。
- `vsix\anthropic.claude-code-2.1.322@win32-x64\package.json`: `C:\b\cache\vsix\` に同じもの（SHA-256 `ab8fa8330ec7c5cd584ead332b9fa4488228b09824b3b66f34e37167fec5b4ff`）がある。
- **`vsix\detachhead.basedpyright-1.40.2\files.json`（5,425件。元の SHA-256 `b1967fe60e834b2df8fea034b263f51a8717e2cb4d51e2f2e6ba49d4a9620695`）と `vsix\mads-hartmann.bash-ide-vscode-1.43.2\files.json`（2,453件。元の SHA-256 `4a69ac99a50cbe7e6debfa59f38a0a54f7ccbbeb3ad8b71444a1ed92d8c137b6`）**: 写すよう頼まれたが、写せていない（2026-11-16 時点）。大きすぎて、Read と Write で書き写せないため（行の数はおよそ 21,700 行と 9,800 行の見込み）。ファイル数とフォルダごとの合計は `vsix/verify-result.json` の `files` に残る。

# Phase 0 の根拠のファイルを records へ写した記録（大岡越前守）

- 作成: 大岡越前守（2026-11-16）
- 依頼: ヴラド・ツェペシュ「Phase 0 の根拠のファイルを records へ写す」。追加の依頼「Phase 0 の根拠のファイルの追加の写し」（8節）
- 判断の記録: docs/user-decisions.md の「記録（2026-11-16、tmp\b へ移す段取りで出た点。リーダーの判断）」の2行目
- 写すものの一覧の出どころ: `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md` の R2-2 の表と、`tasks/2026-11-15-move-off-c/survey-p0.json`
- 結果: **1回目は写し終えた。ただし1件（`extension.vsixmanifest`）は元とバイト単位で同じにできなかった**（3節）。**追加の依頼は、9件のうち7件を写した。大きい `files.json` 2件は写せていない**（8節）

## 0. 要点

1. 15ファイルを `records/phase0/evidence/` に写した。そのうち14ファイルは、元と写しの SHA-256 が一致した。
2. `extension.vsixmanifest` だけは一致しない。空白だけの10行にあるタブ（合わせて38字）が、写しで落ちた。空白でない文字と行の数は同じ。元と同じ中身は Open VSX と VSIX の中にもあり、元の SHA-256 は記録に残した。
3. records の3つのファイルで、`C:\b\p0\...` の場所でこれらのファイルを指す8行に、新しい場所を書き足した。元の文は消していない。`git diff` で、変わったのがその8行だけであることを確かめた。
4. `lock-verification.md` の4行目が指す `verify-result.json`（`verifiedAt` 2026-11-12T20:30:50.657Z）は、後の回（92行目の回）で上書きされていて、もう残っていない。写したのは後の回のもの。その旨を4行目に書き足した。
5. `C:\b` の中には何も書いていない。消してもいない。

## 1. 写したもの

元の場所はすべて `C:\b\p0\` の下。写し先は `records/phase0/evidence/` の下で、フォルダの形は `C:\b\p0\` からの相対の場所と同じにした。

| 元（`C:\b\p0\` からの場所） | 大きさ（バイト。survey-p0.json） | 頼まれた区分 | SHA-256（元） | 写しと |
|---|---|---|---|---|
| `vsix\verify-result.json` | 83,682 | 拡張の検証の結果の JSON | `02bc6c36a7fb29319191f6147e7da242b065ee6095b1526d9160eb32d88e824e` | 一致 |
| `vsix\fetch-result.json` | 33,548 | 同上（R2-2 の表で同じ行） | `ad6e3e212f8fb28eb17b289e273222ddb6ddea772dac2d7c7cd65966dddfab16` | 一致 |
| `trial\verify-result.json` | 9,185 | 同上（R2-2 の表の「任意」の行） | `a37909ba4f53356167cec42e57dff7d74fee8e31f31f9f7e36f2f826f355669a` | 一致 |
| `trial\lock.json` | 1,478 | 同上（同じ行） | `9f5f055c2072e13e0437bc71ae3dba5c8db0ff03fe6b63c7ef042f655f967917` | 一致 |
| `vsix\anthropic.claude-code-2.1.322@win32-x64\files.json` | 記録なし | Claude Code の files.json | `4ff8062421b4aa24f5a5114dc6ea95d8e8d8af8018579ce3e14f17497268d979` | 一致 |
| `vsix\anthropic.claude-code-2.1.322@win32-x64\extension.vsixmanifest` | 2,146（fetch-result.json） | Claude Code の extension.vsixmanifest | `301bdf41b2eaf9dbb9604c588b5b6146e4e51cb5615b01a4ee5182a794fdd3e9` | **違う**（写しは `ead27a228c81bc816a86fe3acdcde5f64ec6b392c695aef4317438b999120261`。3節） |
| `sublime\conversion.md` | 7,332 | Sublime のキーの変換の出力 | `dcca00fdbdfb32629da7d4c9dc7aebc0bbb90fb00b2730538744d759039e644e` | 一致 |
| `sublime\converted-keybindings.json` | 6,764 | 同上 | `803bc242215d3283a4a5af710fb9f7a1d2ffaa64a272910aa7efc67c415a4c9c` | 一致 |
| `sublime\dropped.json` | 369 | 同上 | `5c342d685d87d81edae6abb58b820564aa57df9b6f4bdf4d5e2b148aa92a193c` | 一致 |
| `sublime\claude-code-keybindings.json` | 2,012 | 同上 | `f38ef2a8ebfb5c9dd8fbb0231212a6d40e55f2f56f893006524cfdc3ef398161` | 一致 |
| `sublime\conflicts.json` | 3 | 同上 | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | 一致 |
| `sublime\same-key-different-when.json` | 3 | 同上 | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | 一致 |
| `sublime\convert-meta.json` | 1,002 | 同上 | `5b8d414856fb0ffea70050a23e3dc49539b4d67196d92371856cf4bca78fdbff` | 一致 |
| `sublime\sublime-4.1.10.package.json` | 15,923 | 同上（変換の元の manifest） | `fe956455ea2d09561544f83f301ad08f9bb443931f019671c297350b0fdb40fe` | 一致 |
| `sublime\ms-vscode.sublime-keybindings-4.1.10.sha256` | 64 | 同上（`.sha256`） | `bf8120afe163fd08347807802d3ad4e84a0351d61c6f4d2d935ac0bd0fc1ad71` | 一致 |

- 合計はおよそ 0.17 MB（files.json を除いて 163,473 バイト。files.json は49件の名前とサイズの JSON で、数 KB）。1 MB 未満の見込みどおり。
- 15ファイルとも UTF-8 のテキストで、読めた。テキストでないために写さなかったものは、この一覧の中には無い（一覧の外の VSIX は2節）。
- `conflicts.json` と `same-key-different-when.json` は、どちらも中身が `[]` と改行だけなので、SHA-256 も同じ。
- 写し方: `Read` で元を読み、`Write` で同じ中身を書いた（`cp` は許可に無い）。
- 照らし方: 許可にある `sha256sum` で、元と写しを同じコマンドで並べてハッシュした（4節のコマンド）。

## 2. 写さなかったもの

| もの | 理由 |
|---|---|
| `netlog\` | 秘密が載りうる（docs/07 の3節。依頼の4） |
| `data\`・`testbed\`・`vscodium-*`・`vsix\` の VSIX と `.sigzip`・`bundled-cli\` | 大きい。消すと決まった（依頼の4） |
| `sublime\ms-vscode.sublime-keybindings-4.1.10.vsix`（358,805 バイト） | テキストでない（zip）。VSIX の本体でもある |
| `vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` | 頼まれた一覧の外。`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` と SHA-256 が同じ（`ab8fa8330ec7c5cd584ead332b9fa4488228b09824b3b66f34e37167fec5b4ff`）ことを `sha256sum` で確かめた。`cache` は移す予定のもの |
| `vsix\anthropic.claude-code-2.1.322@win32-x64\api.json` | 1回目の時点では頼まれた一覧の外。蒙恬の R2-2 は「`C:\b\cache\vsix\` にも同じ版がある」と書くが、**中身は同じではない**（p0 は `902c6fcd…b221`、cache は `f5e7fe5b…4c18`。違いの例は 117行目の `downloadCount` 66,000,021 と 66,309,519。取得の時刻で変わる値）。**追加の依頼で写した**（8節） |
| `vsix\<Claude Code 以外の8件>\files.json` | 1回目の時点では頼まれた一覧の外。`lock-verification.md` の53・54行が「拡張ごとの `files.json`」で確かめたと書いている。**追加の依頼で8件のうち6件を写した**（8節） |

## 3. 元と同じにできなかった写し: `extension.vsixmanifest`

- 違い: 空白だけの行のタブ。元の10行（10・32行目はタブ3つ、18・20・21・23・24・25・29・30行目はタブ4つ。合わせて38字）が、写しでは空の行になった。
- 確かめたこと（Grep で元と写しを照らした）:
  - 元に CR は無い（LF だけ）。行の頭に空白（スペース）は無い。
  - 空白だけの行は、元も写しも同じ10行と28行目（28行目は元も空）。
  - タブ4つで始まる要素の行は、元も写しも10行。タブ3つで始まる要素の行は、元も写しも同じ12行（行番号も同じ）。タブ1〜2つの行と行頭に字下げの無い行も、行番号と中身が同じ。
  - 最後の行（44行目 `	</PackageManifest>`）の後に改行が無いのも同じ。
  - よって、写しの大きさは元の 2,146 バイトより38バイト少ない見込み（大きさを直接測る手段は許可に無い）。
- 原因: 写す道具（Read と Write）で、空白だけの行のタブを残せなかった。2回書いて、2回とも同じ SHA-256 になった。
- 元と同じ中身は、Open VSX（`https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/extension.vsixmanifest`。`fetch-result.json` の `files.vsixmanifest`）と、VSIX の中（`files.json` の `extension.vsixmanifest` 2,146 バイト）にもある。取り直せば、元の SHA-256（`301bdf41…e3d9`。`fetch-result.json` にも同じ値がある）で照らせる。
- 写しはそのまま残した（リーダーの答え: 今の写しでよい）。`claude-code-manifest.md` が使った値（`ExtensionKind` が `workspace`、`ExecutesCode` が `true`、依存・拡張パック・提案中の API が空）は、写しでも読める。元と同じでないことと元の SHA-256 は、写しを指す行と `records/phase0/evidence/README.md` に書いた。

## 4. 照らした結果（コマンドと出力）

元と写しを並べて、1回のコマンドでハッシュした。

```
sha256sum C:/b/p0/vsix/verify-result.json records/phase0/evidence/vsix/verify-result.json ...（15組30ファイル）
```

出力（元・写しの順。64桁の全部は1節の表と `records/phase0/evidence/README.md` にある）:

```
02bc6c36…824e  C:/b/p0/vsix/verify-result.json
02bc6c36…824e  records/phase0/evidence/vsix/verify-result.json
ad6e3e21…ab16  C:/b/p0/vsix/fetch-result.json
ad6e3e21…ab16  records/phase0/evidence/vsix/fetch-result.json
4ff80624…d979  C:/b/p0/vsix/anthropic.claude-code-2.1.322@win32-x64/files.json
4ff80624…d979  records/phase0/evidence/vsix/anthropic.claude-code-2.1.322@win32-x64/files.json
301bdf41…e3d9  C:/b/p0/vsix/anthropic.claude-code-2.1.322@win32-x64/extension.vsixmanifest
ead27a22…0261  records/phase0/evidence/vsix/anthropic.claude-code-2.1.322@win32-x64/extension.vsixmanifest
a37909ba…669a  C:/b/p0/trial/verify-result.json
a37909ba…669a  records/phase0/evidence/trial/verify-result.json
9f5f055c…7917  C:/b/p0/trial/lock.json
9f5f055c…7917  records/phase0/evidence/trial/lock.json
dcca00fd…644e  C:/b/p0/sublime/conversion.md
dcca00fd…644e  records/phase0/evidence/sublime/conversion.md
803bc242…4c9c  C:/b/p0/sublime/converted-keybindings.json
803bc242…4c9c  records/phase0/evidence/sublime/converted-keybindings.json
5c342d68…193c  C:/b/p0/sublime/dropped.json
5c342d68…193c  records/phase0/evidence/sublime/dropped.json
f38ef2a8…8161  C:/b/p0/sublime/claude-code-keybindings.json
f38ef2a8…8161  records/phase0/evidence/sublime/claude-code-keybindings.json
37517e5f…b570  C:/b/p0/sublime/conflicts.json
37517e5f…b570  records/phase0/evidence/sublime/conflicts.json
37517e5f…b570  C:/b/p0/sublime/same-key-different-when.json
37517e5f…b570  records/phase0/evidence/sublime/same-key-different-when.json
5b8d4148…fbff  C:/b/p0/sublime/convert-meta.json
5b8d4148…fbff  records/phase0/evidence/sublime/convert-meta.json
fe956455…40fe  C:/b/p0/sublime/sublime-4.1.10.package.json
fe956455…40fe  records/phase0/evidence/sublime/sublime-4.1.10.package.json
bf8120af…ad71  C:/b/p0/sublime/ms-vscode.sublime-keybindings-4.1.10.sha256
bf8120af…ad71  records/phase0/evidence/sublime/ms-vscode.sublime-keybindings-4.1.10.sha256
```

## 5. 書き足した records の行

元の文は消さず、行の終わりに新しい場所を足した。`git diff -U0` と `git diff --stat`（3 files changed, 8 insertions(+), 8 deletions(-)）で、変わったのが次の8行だけであることを確かめた（追加の依頼の分は8節）。

| ファイル | 行 | 指していたもの | 足したこと |
|---|---|---|---|
| `records/phase0/sublime-keys.md` | 4 | `C:/b/p0/sublime/conversion.md`（台本の引数） | 写しの場所。SHA-256 が一致 |
| `records/phase0/sublime-keys.md` | 5 | `C:\b\p0\sublime\` の7ファイル | 写しのフォルダ。7ファイルとも SHA-256 が一致 |
| `records/phase0/sublime-keys.md` | 10 | `C:\b\p0\sublime\sublime-4.1.10.package.json` | 写しの場所。SHA-256 が一致 |
| `records/phase0/claude-code-manifest.md` | 5 | `C:\b\p0\vsix\anthropic.claude-code-2.1.322@win32-x64\` の4ファイル | `files.json` と `extension.vsixmanifest` の写しの場所。vsixmanifest が元と同じでないことと、元の SHA-256・取り直せる場所。`package.json` は `C:\b\cache\vsix\` に同じものがあること。`api.json` は写していないこと（8節で書き直した） |
| `records/phase0/claude-code-manifest.md` | 85 | `C:\b\p0\vsix\...\files.json` | 写しの場所。SHA-256 が一致 |
| `records/phase0/lock-verification.md` | 4 | `C:\b\p0\vsix\verify-result.json`（`verifiedAt` 2026-11-12T20:30:50.657Z） | この回のファイルは7節の回に上書きされて残っていないこと。写しは7節の回のものであること |
| `records/phase0/lock-verification.md` | 92 | `C:\b\p0\vsix\verify-result.json`（`verifiedAt` 2026-11-13T03:26:03.284Z） | 写しの場所。同じ場所の `fetch-result.json` も写したこと。どちらも SHA-256 が一致 |
| `records/phase0/lock-verification.md` | 106 | `C:/b/p0/trial/verify-result.json`（台本の引数） | 写しの場所と、同じ場所の `lock.json` の写し。どちらも SHA-256 が一致 |

新しく作ったもの: `records/phase0/evidence/README.md`（写しの一覧・SHA-256・元と同じでない1件・写していないもの）。

書き足さなかった行（写したファイルを指していないため）:

- `claude-code-manifest.md` の12行、`lock-verification.md` の15行・92行の台本の引数 `--dir C:/b/p0/vsix`: フォルダを指す引数で、写したファイルではない。
- `records/phase1/`・`records/take-in/`・`records/network-audits/`・`records/phase2/` の `C:\b\p0\vscode-1.146.0`・`data\*`・`testbed\`・`netlog\*` を指す行: 今回写す対象ではない（公式の 1.146.0 は `<buildRoot>\official\` に写す別の段取り。`data`・`testbed`・`netlog` は消す）。

自分の手違い1件: `sublime-keys.md` を書き直す1回目で、ファイルの後ろの部分を落として書いてしまった。直後に全文を書き直し、`git diff` で、差が上の3行だけになったことを確かめた。

## 6. リーダーへ（判断が要る点。1回目の報告の時点）

1. `api.json`（Claude Code。`claude-code-manifest.md` の5行目が材料に挙げる）は写していない。`C:\b\cache\vsix\` のものは取得の時刻が違い、中身が同じではない。要るなら、`C:\b\p0` を消す前に写すよう頼んでほしい。→ **写すと答えがあった。写した（8節）**
2. ほかの8件の拡張の `files.json`（`lock-verification.md` の53・54行）も写していない。同じく、要るなら消す前に。→ **写すと答えがあった。6件を写し、2件は写せていない（8節）**
3. `extension.vsixmanifest` を元とバイト単位で同じに残したいなら、`cp` の許可か、写すだけの台本（蒙恬の `scripts/move-build-root.mjs`）で写す必要がある。読める中身は写しで足りている。→ **今の写しでよいと答えがあった**
4. 今回の写しと records の直し（`records/phase0/` の3ファイルと `evidence/`）は、まだコミットしていない。→ **コミットはリーダーがすると答えがあった**

## 7. 守ったこと

- 書いた場所は `records/` と `tasks/` だけ。`C:\b` の中は読むだけ（Read・Glob・Grep・`sha256sum`）。
- 普段使いのエディタのデータ（`%LOCALAPPDATA%\Programs\Shuko` など）と秘密の場所（`%LOCALAPPDATA%\Shuko\watch\`・`secrets\`）には触れていない。`netlog\` は開いていない。

## 8. 追記（2026-11-16）: 追加の写し

- 依頼: リーダー「Phase 0 の根拠のファイルの追加の写し」。Claude Code の `api.json`（p0 の側。`902c6fcd…`）と、ほかの8件の拡張の `files.json` を写し、SHA-256 を照らし、records の行に新しい場所を書き足す。
- 結果: **9件のうち7件を写し、7件とも SHA-256 が元と一致した。basedpyright と bash-ide-vscode の `files.json` 2件は写せていない。**

### 8.1 写したもの

写し方と照らし方は1節と同じ（Read で読み、Write で書き、元と写しを `sha256sum` で並べてハッシュした）。写す前に、9件とも行の終わりに空白・タブ・CR が無いことを Grep で確かめた（3節のような食い違いは起きない）。

| 元（`C:\b\p0\vsix\` からの場所） | 件数 | SHA-256（元＝写し） |
|---|---|---|
| `anthropic.claude-code-2.1.322@win32-x64\api.json` | 179行 | `902c6fcd94eb4fe60019ee8817722186cbce9568bcacc9de3913cf36b38db221` |
| `ms-vscode.powershell-2025.4.0\files.json` | 293件 | `00863dc16c99255e2d0ae71a3817492ab1fcbfedf65981c1903dc4f7bf6f17b5` |
| `mechatroner.rainbow-csv-3.24.1\files.json` | 59件 | `3bc86b9a23c8e0747baacea03b8150c0713775253a640bf1aa8bec90a738037e` |
| `dotenv.dotenv-vscode-1.5.8\files.json` | 276件 | `b27e95dde43e0165182dc0469f7c536a2ecf1632e0b42f35ccc2a8ec8f7c547e` |
| `weixu.wx-vsce-dotenv-0.2.3\files.json` | 12件 | `324db8d81fad6e9c12539a3712c6a3c868857ead91d99a24c9026dad9254c929` |
| `tomoki1207.pdf-1.2.2\files.json` | 380件 | `299011be3b0a3d75f563b92c716f043ce1200be8805a67b37c10d79066b54809` |
| `MS-CEINTL.vscode-language-pack-ja-1.131.0\files.json` | 100件 | `4d7f30872b22d3e675b2cf91267a6abc999830b0523bfd6150d0ed8814c1d3c8` |

照らしたコマンド（14ファイルを1回で）と出力:

```
sha256sum "C:/b/p0/vsix/anthropic.claude-code-2.1.322@win32-x64/api.json" "records/phase0/evidence/vsix/anthropic.claude-code-2.1.322@win32-x64/api.json" C:/b/p0/vsix/ms-vscode.powershell-2025.4.0/files.json records/phase0/evidence/vsix/ms-vscode.powershell-2025.4.0/files.json ...（7組）

902c6fcd…b221  C:/b/p0/vsix/anthropic.claude-code-2.1.322@win32-x64/api.json
902c6fcd…b221  records/phase0/evidence/vsix/anthropic.claude-code-2.1.322@win32-x64/api.json
00863dc1…17b5  C:/b/p0/vsix/ms-vscode.powershell-2025.4.0/files.json
00863dc1…17b5  records/phase0/evidence/vsix/ms-vscode.powershell-2025.4.0/files.json
3bc86b9a…037e  C:/b/p0/vsix/mechatroner.rainbow-csv-3.24.1/files.json
3bc86b9a…037e  records/phase0/evidence/vsix/mechatroner.rainbow-csv-3.24.1/files.json
b27e95dd…547e  C:/b/p0/vsix/dotenv.dotenv-vscode-1.5.8/files.json
b27e95dd…547e  records/phase0/evidence/vsix/dotenv.dotenv-vscode-1.5.8/files.json
324db8d8…c929  C:/b/p0/vsix/weixu.wx-vsce-dotenv-0.2.3/files.json
324db8d8…c929  records/phase0/evidence/vsix/weixu.wx-vsce-dotenv-0.2.3/files.json
299011be…4809  C:/b/p0/vsix/tomoki1207.pdf-1.2.2/files.json
299011be…4809  records/phase0/evidence/vsix/tomoki1207.pdf-1.2.2/files.json
4d7f3087…d3c8  C:/b/p0/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0/files.json
4d7f3087…d3c8  records/phase0/evidence/vsix/MS-CEINTL.vscode-language-pack-ja-1.131.0/files.json
```

### 8.2 写せていないもの

| 元（`C:\b\p0\vsix\` からの場所） | 件数 | SHA-256（元） | 理由 |
|---|---|---|---|
| `detachhead.basedpyright-1.40.2\files.json` | 5,425件（およそ 21,700 行の見込み） | `b1967fe60e834b2df8fea034b263f51a8717e2cb4d51e2f2e6ba49d4a9620695` | 大きすぎて、Read と Write で書き写せない。Write は1回で全文を書くので、数百 KB を一度に正しく出すことになり、確かにはできない |
| `mads-hartmann.bash-ide-vscode-1.43.2\files.json` | 2,453件（およそ 9,800 行の見込み） | `4a69ac99a50cbe7e6debfa59f38a0a54f7ccbbeb3ad8b71444a1ed92d8c137b6` | 同上 |

- 写したふりはしていない。空のファイルや、一部だけのファイルも作っていない。
- 代わりに残っているもの: 2件のファイル数（5,425・2,453）、フォルダごとのファイル数と大きさ、実行ファイルの一覧（どちらも0件）、LICENSE の有無（bash-ide-vscode は無い）は、写した `records/phase0/evidence/vsix/verify-result.json` の `files`・`license` にある。名前ごとの一覧（各ファイルのパスと大きさ）だけが残らない。
- 写す手段の案（どれもリーダーの判断が要る）:
  1. 大岡越前守の `bash_exact` に、写す2行を一時的に足す（例: `cp C:/b/p0/vsix/detachhead.basedpyright-1.40.2/files.json records/phase0/evidence/vsix/detachhead.basedpyright-1.40.2/files.json` と、bash-ide-vscode の同じ形）。許可の変更なので、ユーザーの承認が要る。写した後は、同じく `sha256sum` で照らす。
  2. 蒙恬の写すだけの台本（`scripts/move-build-root.mjs`）の写すものに、この2ファイルを足して走らせてもらう。ただし台本の写し先は `<buildRoot>` の下で、`records/` ではない。
  3. 写さずに消してよいと決める（名前ごとの一覧は、VSIX を Open VSX から取り直せば作り直せる。VSIX の SHA-256 は台帳と `lock-verification.md` の4節にある）。

### 8.3 書き足した records の行

元の文は消していない。

| ファイル | 行 | 足したこと |
|---|---|---|
| `records/phase0/claude-code-manifest.md` | 5 | `api.json` も写したこと、SHA-256 が一致したこと、写したのは p0 の側（`902c6fcd…`）であること。1回目に私が足した「`api.json` は写していない」の文を、この内容に書き直した（コミット前の、自分の足した文だけを直した。元の文はそのまま） |
| `records/phase0/lock-verification.md` | 53 | 拡張ごとの `files.json` の写しの場所。9件のうち7件で、SHA-256 が一致したこと。basedpyright と bash-ide-vscode の2件は写せていないこと |
| `records/phase0/lock-verification.md` | 54 | Claude Code と言語パックの `files.json` は写したこと。3件とも LICENSE が無いことは、写した `verify-result.json` の `license.reason` にも残ること |

- `git diff --stat -- records/phase0/` は 3 files changed, 10 insertions(+), 10 deletions(-)。1回目の8行に、`lock-verification.md` の53・54行の2行が足された。`claude-code-manifest.md` は1回目と同じ2行（5・85行）のまま。
- `records/phase0/evidence/README.md` も書き直した（写した7件の行、`api.json` の注記、写せていない2件と元の SHA-256）。vsixmanifest の違いが空白の行のタブだけであることと元の SHA-256 は、README に書いてある（リーダーの答えの4）。

### 8.4 合わせた量

- 写した数: 22ファイル（1回目 15、追加 7）。SHA-256 が元と一致したのは 21ファイル（vsixmanifest を除く）。
- 写せていない: 2ファイル（8.2）。

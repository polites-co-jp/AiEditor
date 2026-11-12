# Phase 0 の検証（1）の記録: 台帳の取得と検証・0-1、計測と監査の台本・単体テスト

- 検証: 大岡越前守（2026-11-13。作業は日本時間 05:30 ごろ）
- 依頼書: `brief.md`
- 途中の連絡（リーダー）: 曹参の `measure.ps1`・`netaudit.ps1` は差し戻した（argv.json が普段使いの `%USERPROFILE%\.vscode\argv.json` から読まれるため、`VSCODE_PORTABLE` を使う形に直させる）。計算のテストとレビューは今の版で進め、台本の合否は「差し戻し中」とし、直った版でもう一度見る。

## 判定

| 成果 | 判定 | 理由の要点 |
|---|---|---|
| 蒙恬: 材料の取得・0-1・0-6・台帳 | **合格**（ただし台帳の確定は時間待ち） | 自分で走らせた検証と独立のハッシュが、下書きとすべて一致した。必須の項目で通らないのは Claude Code 2.1.322 の寝かせる期間だけで、これは日本時間 11:30:52 まで満ちない。0-1 は manifest と一覧を数え直して一致した。JS の中身は開いていない。下の「直すべき点」は、今回の結果を変えない改善 |
| 曹参: 計算の単体テスト（PowerShell 2本、node 2本） | **合格** | 4本とも全部通った（73、65、64、24件）。中身のある確かめになっている |
| 曹参: `scripts/measure.ps1`・`scripts/netaudit.ps1` | **差し戻し中**（リーダーの連絡による。合否は直った版で出す） | 差し戻しの理由（argv.json）に加えて、私の実行で**書かれた使い方のとおりに起動すると引数の既定値の評価で落ちる**不具合を見つけた（下の B-1） |

`records/phase0/` に清書したもの: `claude-code-manifest.md`、`lock-verification.md`。

## 1. 走らせたコマンドと結果

| コマンド | 結果 |
|---|---|
| `git status` | 変更は `.gitignore`（tmp/ を足した。リーダーの裁定の分）と、未追跡の `extensions-src/`・`extensions.lock.json`・`scripts/`・`tests/`・`tasks/` の下だけ。`records/`・`docs/`・`team/`・`.claude/` に手は入っていない |
| `git diff` | `.gitignore` に `tmp/` の2行だけ |
| `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0` | 終了コード 1。Claude Code は `failed: ["soak"]`（`now` 2026-11-12T20:30:15Z、`soaked: false`）。ほかの8件は `ok: true`。項目ごとの結果は下書きと全部同じ（`records/phase0/lock-verification.md` の2節） |
| `sha256sum <9件の VSIX> <claude.exe> <本体の zip 2件>` | 12件とも、台帳・`.sha256`・release の manifest.json・fetch-log の値と一致 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | `passed: 73  failed: 0` |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | `passed: 65  failed: 0` |
| `node tests/lock.test.mjs` | `tests 64  pass 64  fail 0` |
| `node tests/sublime-keys.test.mjs` | `tests 24  pass 24  fail 0` |
| `node --test tests/` | 終了コード 1。`Error: Cannot find module 'e:\develop\self\Team\projects\ai-editor\tests'`（Node.js v24.16.0）。曹参の報告どおり、Node 24 ではフォルダを渡す形が動かない |
| `powershell ... -File scripts/measure.ps1 -Baseline <trial/out-a> -Candidate <trial/out-a> -OutDir <このディレクトリ>/trial/compare-same` | 終了コード 1、**判定は出ない**。`Split-Path : 空の文字列であるため、パラメーター 'Path' にバインドできません`（measure.ps1:25、`$Workspace` の既定値） |
| 同じコマンドに `-Workspace tasks/2026-11-13-p0-measure-netaudit-tests/trial/ws` を足す | 終了コード 1、`# Verdict: FAIL`（同じ中央値 9.9 MiB で「等しいので不合格」）。`trial/compare-same/verdict.md`・`verdict.json` が書かれた |
| `powershell ... -File scripts/netaudit.ps1`（引数なし） | 同じ誤り（netaudit.ps1:29、`$Workspace` の既定値） |

`--write-lock` は付けていない（Claude Code の72時間が満ちていないため。依頼書の指示どおり）。

## 2. 蒙恬の成果のレビュー

### 2.1 台本が docs/04 の4節を正しく確かめているか

- 照合の相手は正しい。SHA-256 は Open VSX の `.sha256`（取得時にファイルから読む）、署名は Open VSX の公開鍵、CLI は `downloads.claude.ai` の版ごとの `manifest.json` の `platforms.<targetPlatform>.checksum`、GPG は鍵の指紋（docs と同じ値）を、取り込んだ鍵と `VALIDSIG` の主鍵の両方で照らす。Authenticode は `Status = Valid` と、署名者の `O=`/`CN=` に `"Anthropic, PBC"` があること。Marketplace は発行元の名前と、同じ版・同じ platform があること。
- 失敗の扱い: Defender の `error`（MpCmdRun が無い・出力が読めない）、Claude Code の照合の例外、`.sigzip` の欠け、`manifest.json.sig` が取れないことは、どれも「通らない」になる。必須の項目が1つでも `pass` でなければ `ok: false` で、終了コードは 1。
- 寝かせる期間: `isSoaked` に加えて `allVersions` に版があること（取り下げの確認）を見ている。
- JS の中身: `readZipEntry` は `.sigzip` の中身にだけ使う。VSIX の各エントリーはハッシュを取るだけで、解釈しない。claude.exe は取り出してハッシュと署名だけを見る。
- 秘密と普段使いのデータ: GPG は使い捨ての `GNUPGHOME`（終わったら消す）で、普段の鍵束に触れない。`%APPDATA%` やエディタのデータを読み書きする処理は無い。`npx ovsx` は npm のキャッシュを使う（秘密ではない）。
- 書き込み先: 台本が書くのは `C:\b\p0\` と、`--write-lock` で指定した台帳だけ。`git status` に範囲外の変更は無い。

### 2.2 台帳の形

- 9件とも docs/04 の3節の項目を持つ。必須の8項目（`id`・`version`・`source`・`download`・`sha256`・`publishedAt`・`verified`・`engines`）がそろい、`sha256` は64桁の小文字。足した `checks`・`note`・`crossCheck` の追加の項目は、蒙恬の `doc-corrections.md` の3に書いてある。
- `license` は tomoki1207.pdf に無い（Open VSX の API に表示が無い。docs/04 の2節の表と同じ）。`licenseSha256` は LICENSE のファイルを持たない3件に無い（`files.json` で確かめた）。

### 2.3 0-1 の下書き

- `package.json` と `extension.vsixmanifest` を自分で読み、表の値・件数をすべて数え直して一致した（configuration 23件、commands 31件のうち `claude-code.*` 3件、keybindings 9件、contributes のキー8個、menus 5か所、walkthroughs 4段）。
- `files.json` の49件から、フォルダごとの件数と合計（例: `extension/resources/` 直下 11件 944,920、walkthrough 8件 457,401、`extension/` 直下 4件 3,893,998）を計算し直して一致した。
- 本家 1.146.0 は `C:\b\p0\vscode-1.146.0\Code.exe`・`bin\code.cmd`・`69047191fc\resources\app\package.json` が、VSCodium は `C:\b\p0\vscodium-1.143.17232\VSCodium.exe`・`resources\app\package.json` があることを確かめた。

## 3. 曹参の成果のレビュー

### 3.1 台本と docs/07 の3節（今の版。差し戻し中）

| 3節の条件 | 台本 | 見たこと |
|---|---|---|
| 3.1 データの置き場所を新しく作る | 毎回ひな形を `<WorkRoot>\<ラベル>-<回>\` に robocopy で写し、終わったら消す。普段使いのデータの場所を拒む | 満たす。ただし argv.json が `--user-data-dir` の下でなく `%USERPROFILE%\.vscode\argv.json` から読まれる件（リーダーの連絡）で、今の版は 3.1 の「同じユーザー設定」を守れない |
| 3.2 手順 1〜8 | 起動、30秒、`-r` で2つのファイル、tasks.json（folderOpen）の有無の確認、120秒、`Get-CimInstance Win32_Process`、合計2つ、claude.exe の子孫の分離と「含めた / 含めない」、停止と10秒 | 手順はそろっている |
| 捨てる1回と5回、中央値と範囲、節目の一時停止 | `-Warmup 1 -Runs 5`、`Get-RangeInfo`、`-Milestone` の `Read-Host` | 満たす |
| 記録（CSV、合計、中央値、範囲、変えた既定値、PC の状態） | `runs.csv`・`<回>-processes.csv`・`roles.csv`・`summary.*`・`defaults-changed.md`・`pc-state.json` | 満たす |
| 3.3 監査 | 10分・2秒、子孫の PID の接続、DNS キャッシュ（始め・終わり・30秒ごと）、宛先ごとの初出・プロセス・回数、前回との比較、許した一覧 | 手順はそろっている。DNS キャッシュが空になる件は 0-5 の実機で切り分ける |
| 3.4 合格の基準 | 中央値が厳密に小さければ合格。差が範囲より小さければ `WithinRange` で記録 | 満たす。「範囲」を2つの範囲の大きいほうとしたのは曹参の決め（docs に無い） |

### 3.2 テストの中身

- 常に通るテストではない。値を具体的に照らしている（例: 合計 490 / 1505 / 850 / 2876、中央値 2.5、合否の「等しい＝不合格」「1バイト減れば合格」「最良の1回でなく中央値で決める」、許した一覧の不正10件、ワイルドカードが頂点や似た名前を通さない）。台帳のテストは72時間の境界を ±1ms で見ており、`contributes` の6項目の出現と増加を項目ごとに確かめる。
- 実装に合わせて仕様を緩めた跡は見当たらない（台帳とキーのテストは実装の前に約束から書かれ、そのまま通った）。
- 抜けている確かめ（軽微）: `validateLockEntry` の `source` が `open-vsx` 以外、`verified` が真偽値でない、`engines` の形が違う、の3つ。
- **抜けている確かめ（B-1 に関わる）**: 台本を `powershell -File` で起動する形のテストが無い。テストは台本をドットソースで読み込むので、`-File` で起動したときだけ落ちる B-1 を捕まえられなかった。

## 4. 直すべき点（担当つき）

### 曹参（差し戻しの直しにあわせて）

- **B-1（要修正）**: `scripts/measure.ps1` の25行目と `scripts/netaudit.ps1` の29行目の `[string]$Workspace = (Join-Path (Split-Path $PSScriptRoot -Parent) 'tmp\ws')` が、Windows PowerShell 5.1 で `-File scripts/measure.ps1` として起動すると `$PSScriptRoot` が空のまま評価されて落ちる。measure-design.md・netaudit-design.md に書かれた使い方（`-Workspace` を省く計測、合否を出す `-Baseline`/`-Candidate`）はどれもこの形なので、そのままでは動かない。直し方の案: param の既定値を空にし、本体の先頭で `if (-not $Workspace) { $Workspace = Join-Path (Split-Path $PSScriptRoot -Parent) 'tmp\ws' }` のように決める（本体では `$PSScriptRoot` が入る）。あわせて、`powershell -File` で起動する形のテスト（例: 合否のモードを `-Workspace` なしで走らせ、終了コードと verdict.md を見る）を足す。
- B-2: argv.json と `VSCODE_PORTABLE`（リーダーの連絡のとおり。`tasks/2026-11-13-p0-envs-mydist-keys/handoff-notes.md` の要点2）。
- B-3（軽微）: テストのファイルの先頭の「Run: node --test tests/」は Node 24 では動かない。走らせ方の記述を `node tests/<名前>.mjs` に直す。
- B-4（軽微）: `validateLockEntry` のテストに、`source`・`verified`・`engines` の形の誤りを足す。

### 蒙恬（今回の結果は変えない。取り込みの自動化の前に直す）

- A-1: `checkOvsx` の合否が `/valid/i` で、`invalid` にも一致する（終了コード 0 も条件なので今は実害が小さい）。`/Signature is valid/` のように絞る。
- A-2: `--skip` で飛ばした必須の項目が「通らない」に数えられず、`ok: true`・終了コード 0 になる。台帳には `checks` に `skip` と残るが、終了コードだけを見る呼び手には通ったように見える。飛ばした必須の項目があれば終了コードを 0 にしない（または台帳を書かない）。
- A-3: `--write-lock` は、検証が通らなかった拡張も台帳に書く（今の Claude Code の行がそう。終了コードは 1）。docs/04 の2節「台帳に載せる版は、4節の検証を通したもの」と合わせるなら、通らない行は書かないか、`install-extensions.mjs` が `checks` に `pass` 以外がある行を拒むことを約束にする。
- A-4: `npx ovsx` の版の固定（蒙恬の提案どおり。リーダーの判断）。

### リーダー

- Claude Code 2.1.322 の走らせ直し（日本時間 11:30:52 以降）を、私か蒙恬に依頼する。それまで `extensions.lock.json` の Claude Code の行は `checks.soak: "fail"` で、台帳は確定していない。コミットするなら、未確定であることが分かる形にする。
- ソースのタグの3件（weixu.wx-vsce-dotenv、tomoki1207.pdf、言語パック）の扱いの判断（docs/04 の4節の3）。
- `node --test tests/` の許可の書き方（Node 24 で動かない。ユーザーの承認が要る）。
- 蒙恬の `doc-corrections.md`・曹参の `doc-corrections.md` にある docs の直し。

## 5. 今回行わなかったこと

- 0-4（本家の基準値の5回の計測）と 0-5（10分の監査）: 依頼書のとおり行わない。台本が差し戻し中でもある。
- 試験環境（`scripts/p0-env.ps1` など、別の蒙恬の担当）の検証: 対象外。
- 台本の試しの実行（身代わりのエディタでの計測）: B-1 で `-Workspace` を省けないこと、差し戻し中であることから、直った版で行う。

## 6. 書いたもの

- `records/phase0/claude-code-manifest.md`
- `records/phase0/lock-verification.md`
- `tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`（この記録）
- `tasks/2026-11-13-p0-verify-lock-measure/trial/compare-same/verdict.md`・`verdict.json`（合否のモードを確かめた出力）
- 依頼書の指示どおり、`C:\b\p0\vsix\verify-result.json` と拡張ごとの検証の材料（`sig\`・`files.json`・`bundled-cli\`・`claude-release\`）を `lock-verify.mjs` が書き直した。

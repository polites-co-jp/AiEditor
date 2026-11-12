# 蒙恬からリーダーへの引き渡し（2026-11-13）

SubagentHandback が定義の tools に無く、フック（team/hooks/allowlist.js）が3回とも止めたため、引き渡しの内容をここに残す。定義に足すにはユーザーの承認が要る。

## 結果: 一部完了

材料・0-1・0-6・台帳の最初の版はそろった。必須の検証で通らなかったのは、Claude Code 2.1.322 の「公開から72時間」だけ（時間待ち）。

## 通らなかった検証
- Claude Code 2.1.322 の寝かせる期間: 公開 2026-11-10T02:30:51Z。2026-11-13T02:30:52Z（日本時間 11:30:52）を過ぎてから次を走らせれば通る（取り直し不要）。
  `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --only anthropic.claude-code --write-lock extensions.lock.json`
- ソースのタグ（参考の項目。必須にしていない）: wx-vsce-dotenv・pdf・言語パックの3件で同じ版のタグが無い。必須にするかは判断を仰ぐ。
- ほかは9件すべて通った（発行元、SHA-256、Ed25519 の署名と ovsx、engines、Defender。Claude Code は CLI のハッシュ、GPG、Authenticode、Marketplace も通った）。

## 決めた手順
- ovsx: `-m` は .sigzip の `.signature.manifest`、`-s` は `.signature.sig`、`-k` は公開鍵の PEM。
- Defender: `MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation`。
- 同梱の CLI は VSIX の `extension/resources/native-binary/claude.exe`。platform の名前は `win32-x64`。
- Git for Windows の gpg には `/c/...` の形でパスを渡す。

## docs との食い違い
doc-corrections.md のとおり。要点は次の4つ。
- 推定・未確認を外せる点がいくつかある。
- 本家 1.146.0 の zip は `resources\app` を `<commit10>\` の下に置く。
- docs/03 の9節の「消さない受け手」に、コメントの API・差分エディタ・独自のファイルシステムを足すべき。
- 台帳に `checks`・`note` を足した。

## 置き場所と成果物
- 置き場所と各ファイルは fetch-log.md、claude-code-manifest.md、lock-verification.md のとおり。
- 台本: scripts/lib/lock.mjs、lib/zip.mjs、lib/http.mjs、lock-fetch.mjs、lock-verify.mjs、lock-diff.mjs、p0-fetch.mjs、p0-expand.ps1
- 台帳: extensions.lock.json

## 追記（2026-11-13）: 大岡越前守の指摘 A-1〜A-3 の直し

大岡越前守の検証（`tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`）で、取り込みを自動にする前に直す点が3つ出たので直した。今の結果（`C:\b\p0\vsix\verify-result.json`・`extensions.lock.json`）は変えていない。A-4（ovsx の版の固定）と Claude Code の走らせ直しには手を付けていない。

### 直したこと

| 指摘 | 直し方 | 分けた純粋な関数（`scripts/lib/lock.mjs`。`export`） |
|---|---|---|
| A-1 ovsx の判定 `/valid/i` が "invalid" にも一致する | 終了コードが 0 で、出力に `Signature is valid.` があるときだけ通す。直前が英字の位置の一致（`...isvalid.` など）は通さない | `isOvsxSuccess(exitCode, stdout)` → 真偽 |
| A-2 `--skip` で必須の項目を飛ばしても ok・終了コード 0 になる | 必須の項目を1つでも飛ばしたら ok にしない。飛ばした項目は結果の `skipped` に残り、画面に「必須の項目を飛ばした: …」と出る。終了コードは 1 | `judgeChecks(results, required)` → `{ ok, failed, skipped }` |
| A-3 `--write-lock` が、通らなかった行も台帳に書く | **「今の台帳の行を残す」形にした**。ok で台帳の形も正しい行だけを新しい値で書く。通らなかった行は、今の台帳に同じ ID の行があればそれを残し、無ければ書かない。今回の検証に無い今の台帳の行は、そのまま後ろに残す。どれにしたかを画面と、verify-result.json の `lockWrite` に残す。新しい値で書けなかった行があれば終了コード 1 | `mergeLock(current, candidates)` → `{ lock, written, kept, omitted, untouched }` |

A-3 で選ばなかった案は、通らなかった行を書かない形。こちらにすると、Claude Code の新しい版が72時間に満たないだけで、台帳から Claude Code が消えてしまう。そのため今の台帳の行を残す形を選んだ。

### 関数の形（曹参のテスト用）

- `isOvsxSuccess(exitCode, stdout)`: `exitCode === 0` で、`stdout` が文字列で、`Signature is valid.` を含む（直前が英字でない）ときだけ真。
  - 真の例: `(0, "✅  Signature is valid.")`
  - 偽の例: `(0, "Signature is invalid.")`、`(1, "Signature is valid.")`、`(0, "")`、`(0, undefined)`
- `judgeChecks(results, required)`: `results` は `{ <項目>: { status: "pass" | "fail" | "skip" | "error" | ... } }`、`required` は項目の名前の配列。
  - `failed`: 必須の項目のうち、無いもの、または status が pass でも skip でもないもの
  - `skipped`: 必須の項目のうち、status が skip のもの
  - `ok`: `failed` と `skipped` が両方とも空のときだけ真
  - 順はどちらも `required` の順
- `mergeLock(current, candidates)`: `current` は今の台帳の配列（オブジェクトでない要素は捨てる）、`candidates` は `[{ id, entry, ok }]`。
  - `ok === true` で `entry` がオブジェクトの行は、`entry` を書く（`written`）
  - それ以外の行は、`current` に同じ `id`（大文字小文字を問わない）の行があればそれを残し（`kept`）、無ければ書かない（`omitted`）
  - `candidates` で同じ `id` が重なれば、最初の1つだけを使う
  - `candidates` に無い `current` の行は、元の順で後ろに足す（`untouched`）
  - `lock` の順は、`candidates` の順のあとに `untouched`
  - 引数は書き換えない

### 足したオプション

`lock-verify.mjs --result <file>`: 結果の書き出し先を変える（既定 `<dir>/verify-result.json`）。試しで本番の結果を上書きしないため。

### 確かめたこと

`node --check` が通った。本番の結果と台帳には触れずに、試しの台帳 `C:\b\p0\trial\lock.json` で2回走らせた。最初の中身は、`tomoki1207.pdf`（古い版の行）と、検証に無い `trial.not-in-fetch` の2行。

1. `--only tomoki1207.pdf --skip defender,ovsx --result C:/b/p0/trial/verify-result.json --write-lock C:/b/p0/trial/lock.json`
   - 「ok にしない（必須の項目を飛ばした: ovsx, defender）」と出て、終了コード 1（A-2）
   - pdf は今の台帳の行（古い版）を残した。今の台帳に無いほかの8件は書かなかった。`trial.not-in-fetch` はそのまま残った（A-3）
2. 同じコマンドから `--skip` を外して走らせた。
   - pdf は「通った」。新しい判定でも、本物の ovsx の出力 `✅  Signature is valid.` が通ることを確かめた（A-1）
   - 台帳の pdf の行は新しい値に書き換わった（A-3 の written）
   - ほかの8件は結果が無いので書かず、終了コードは 1

なお、走らせ直しで `C:\b\p0\vsix\tomoki1207.pdf-1.2.2\` の `sig\`・`files.json` が同じ中身で書き直された。本番の `verify-result.json`・`extensions.lock.json` は変わっていない。

## 追記（2026-11-13）: A-4 ovsx の版の固定と、ソースのタグを参考の項目にする

### ovsx の版の固定（一部完了: 依存の導入で止めた）

- `package.json` をリポジトリの直下に新しく作り、`devDependencies` に `"ovsx": "1.4.0"` と書いた（`^` は付けていない。ほかに `private: true`、`engines.node >=22.0.0`）。ovsx 1.4.0 の `engines.node` は `>=22.0.0`。出典: https://registry.npmjs.org/ovsx/1.4.0 。この PC の Node は v24.16.0。
- `.gitignore` に `node_modules/` を足した。
- lock-verify.mjs の呼び方:
  - npx をやめた。`<repo>/node_modules/ovsx/package.json` を読み、package.json の `devDependencies.ovsx` と版が同じかを確かめる。同じなら、その `bin.ovsx`（`bin/ovsx`）を node で直に起動する。シェルは通さない。
  - 起動の形: `<node> <repo>\node_modules\ovsx\bin\ovsx verify-signature -i <vsix> -m <.signature.manifest> -s <.signature.sig> -k <public-key.pem>`
  - 入っていない・版が違う・package.json の指定が正確な x.y.z でないときは、ovsx の項目を `error` にする（必須なので ok にならない）。npm の最新を取りに行くことはしない。結果には `declared`・`installed`・`reason` を残し、通ったときは `ovsxVersion` を残す。
- 分けた純粋な関数: `checkPinnedTool(declared, installed)` → `{ ok, reason }`（`scripts/lib/lock.mjs`）。
  - `declared` は正確な `x.y.z` だけを認める。`^1.4.0`・`~1.4.0`・`>=1.4.0`・`latest`・空は ok にならない。
  - `installed` が null・undefined・空なら ok にならない（「node_modules に入っていない」）。`declared` と違えば ok にならない。
  - 同じなら `{ ok: true, reason: null }`。
- **止めたところ（私の許可では走らせられない）**: 依存の導入。リポジトリの直下で、次のどちらかが要る。
  - 推奨: pnpm（`C:\b\wt` の本家のビルドでも使う）。初回に `pnpm install`（直下で。`pnpm-lock.yaml` ができる）。以後は `pnpm install --frozen-lockfile`。
  - 別案: npm。初回に `npm install`（`package-lock.json` ができる）。以後は `npm ci`。
  - どちらも、lockfile をコミットして初めて、ovsx の依存（`@vscode/vsce ^4.0.0`・`commander ^14.0.3`・`yauzl-promise ^4.0.0` など。どれも `^` の範囲）の版まで固定できる。どちらで入れるかと、許可にコマンドを足すかは、リーダー（とユーザー）に決めてほしい。
  - 依存の中に、ネイティブのビルドが要るもの（例 `cross-keychain`）があるかは確かめていない。
- **影響**: 依存を入れるまでは、lock-verify.mjs の ovsx の項目が全部の拡張で `error` になり、ok にならない。そのため `--write-lock` は今の台帳の行を残す（A-3）。**Claude Code の走らせ直しの前に、依存の導入を済ませる必要がある**。済ませないと、Claude Code の行は古いまま残る。
- 確かめたこと:
  - `node --check` が通った。
  - 試しの結果と台帳（`C:\b\p0\trial\`）で `--only weixu.wx-vsce-dotenv` を走らせた。ovsx は `error`、理由は「node_modules に入っていない（依存の導入が要る）…」で、npx は呼ばれなかった。
  - 入れた後の実際の起動（`node bin/ovsx`）は、まだ確かめていない（依存の導入の後に要確認）。

### ソースのタグは参考の項目（必須にしない）

- 前から必須の一覧（REQUIRED）に入っておらず、ok には効いていなかった。ただ、結果が `pass` / `fail` で、台帳の `checks` にも並んでいた。そのため、必須の項目と見分けにくかった。次のように直した。
  - 結果の置き場所を `references.sourceTag` に移した。status は `found`（同じ版のタグがある）・`not-found`（無い）・`skip`（GitHub でない）・`error`（取れない）で、`required: false` を付けた。pass / fail は使わない。
  - 台帳では `checks` から外し、`references: { "sourceTag": "found" | "not-found" | ... }` に分けた。`crossCheck.sourceTag`（見つかったタグの名前）・`sourceRepository` は今までどおり。
  - 画面には「参考（必須ではない）: ソースのタグ 見つからない」のように出す。
  - 古い形の結果（`sourceTag` に pass / fail）を台帳に書くときは、found / not-found に読み替える。試しでは、前の結果の pdf の `fail` が、台帳で `references.sourceTag: "not-found"` になった。
- 今の `extensions.lock.json` は書き換えていない（`checks.sourceTag` が残っている）。次に `--write-lock` で書き直すとき、検証を通った行は新しい形になる。

## 未解決
0. 依存の導入（ovsx 1.4.0。上の A-4）。Claude Code の走らせ直しより先に要る。
1. Claude Code の走らせ直し（11:30:52 の後。リーダーが別に頼む）。直した後の `--write-lock` は、Claude Code が通れば新しい値で書き、通らなければ今の台帳の行を残す。
2. ソースのタグを必須にするか。
3. ovsx の版の固定。
4. audio-capture.node の署名は見ていない。
5. Defender の走査が管理者の権限なしで通ったかは確かめていない。
6. SubagentHandback の許可。

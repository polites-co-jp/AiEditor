# 写し直しの確かめ: Phase 0 の根拠のファイル（copy-verify.mjs）

- 検証: 大岡越前守（2026-11-16）
- 依頼: `tasks/2026-11-16-before-delete-c/brief.md` の「やること（大岡越前守）」と、リーダーの知らせ「Phase 0 の根拠のファイルをコマンドで写し直す」の1〜4
- 対象: 蒙恬の `scripts/copy-verify.mjs` と、一覧 `evidence-copy-list.json`（25行）。説明は `handoff-notes-meng-tian.md` の1回目・2回目

## 判定: 判定できない（写し直しを走らせる許可が無い）

| 知らせの項目 | 結果 |
|---|---|
| 1. 台本を読んで確かめる | 済み。消さない・一覧の外を書かない・柵の外へ出ない・誤りのある一覧では書かない、の4点を満たす（1節）。記録として伝える点が2つある |
| 2. 写す | **走らせていない**。私の許可（`permissions.json` の `bash`）に `node scripts/copy-verify.mjs` が無い。フックが「ホワイトリストに無いコマンドです」で止めた（2節）。回り道はしていない |
| 3. README を直す | **していない**。写し直しが済んでいないので、「写し直した」という事実がまだ無い。今直すと事実と合わなくなる |
| 4. 結果を書く | この書き物 |

`records/` と `kept/` には何も書いていない。`C:\b` は読むだけで、`tmp/b/vscode` には触れていない。

## 1. 台本を読んで確かめたこと（`scripts/copy-verify.mjs` 全226行）

| 確かめた点 | 結果 | 根拠 |
|---|---|---|
| 何も消さない | 満たす | `unlink`・`rm`・`rmdir`・`rename`・`truncate` を呼ぶ所は無い。書く呼び出しは次の3つだけ。`fs.mkdirSync(path.dirname(toAbs), { recursive: true })`、`fs.copyFileSync(fromAbs, toAbs)`（写し先を上書きする。brief の5のとおり）、`--out` の結果の JSON の `writeFileSync` |
| 一覧の外を書かない | 満たす | 写すのは `validateList` が返した `entries` の `toAbs` だけ。フォルダを作るのも、その親だけ。同じ `toRoot` の中にあるほかのファイルには触れない。`to` が重なる行は誤りにする |
| 柵の外へ出ない | 満たす（文字の上では。記録の1） | `from`・`to` は `path.resolve` で正規化してから `isInside` で照らす。`..` で外へ出る形も外と分かる。照らしは大文字小文字を区別せず、`r + path.sep` での前方一致なので、`evidence2` のような偽装も外と分かる。柵そのもの（根）は写す先にも元にもしない。`fromRoot` と `toRoot` が重なれば誤りにする。`fromRoot` は絶対パスでなければ誤りにする |
| 誤りのある一覧では何も書かない | 満たす | `validateList` は全部の行を照らしてから `ListError` を投げる。`main` はそれを捕まえて、終了コード 2 で終わる。誤りは、`from`・`to` の柵の外、`to` の重なり、元が無い、元がファイルでないかリンク、写し先がリンクかフォルダ、`expectSha256` の形。投げるのは `copyVerify` の前なので、写し先にも `--out` にも書かない。`expectSha256` が元と違う行は、その行だけ写さず `error` にする（ほかの行は写す）。この扱いは冒頭の説明に書いてある |
| 写した後の照らし | 満たす | 写した後に写し先の SHA-256 を取り、元の SHA-256 も取り直す。どちらも写す前の元と同じときだけ `match`。全部の行が `match` で `errors` が 0 のときだけ、終了コード 0 |

### 記録として伝える点（直す必要は無い）

1. **柵の照らしは文字の上だけ**
   - `to` の途中のフォルダがジャンクションやリンクだと、`mkdirSync`・`copyFileSync` はそれを辿る。その場合、柵の外へ書きうる。
   - リンクかどうかを見ているのは、元のファイルと写し先のファイル（末端）だけである。
   - 今の写し先（`records/phase0/evidence/`・`tasks/.../kept/`）はリポジトリの中のふつうのフォルダなので、この一覧では当たらない。
   - 台本を別の一覧に使い回すなら、途中のフォルダも `lstat` で見るとよい（蒙恬）。
2. **`--out` には柵が無い**
   - どこへでも書ける。今回のコマンドの `--out` は `tasks/2026-11-16-before-delete-c/copy-verify-run.json` で、私の書き込み先の中である。

### 一覧（`evidence-copy-list.json`）

- 25行。`fromRoot` は `C:/b/p0`・`C:/b/p4-watch/trial/real`、`toRoot` は `records/phase0/evidence`・`tasks/2026-11-16-before-delete-c/kept`。
- 各行の `from`・`to` は、どちらかの柵の下にある。
- 全部の行に `expectSha256` がある。`extension.vsixmanifest` の行は `301bdf41…d3e9`（元の値）。

## 2. 写す前の様子（私が確かめた分）

| 確かめ | 結果 |
|---|---|
| `node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json --out tasks/2026-11-16-before-delete-c/copy-verify-run.json` | フックが止めた: `[allowlist] ooka-echizen: ホワイトリストに無いコマンドです`。走っていない |
| `sha256sum` で `extension.vsixmanifest` の元と今の写しを照らす | 元（`C:/b/p0/vsix/anthropic.claude-code-2.1.322@win32-x64/`）は `301bdf41b2eaf9dbb9604c588b5b6146e4e51cb5615b01a4ee5182a794fdd3e9`。今の写し（`records/phase0/evidence/vsix/…`）は `ead27a228c81bc816a86fe3acdcde5f64ec6b392c695aef4317438b999120261`。違う（蒙恬の dry-run と同じ） |
| 新しくできるはずの3つ | まだ無い。`records/phase0/evidence/vsix/` の下に `detachhead.basedpyright-1.40.2`・`mads-hartmann.bash-ide-vscode-1.43.2` は無い。`tasks/2026-11-16-before-delete-c/kept/` も無い。`copy-verify-run.json` も無い |

## 3. 進めるのに要るもの（リーダーへ）

- **何のために**: 知らせの2（写し直し）を走らせ、3（README と `lock-verification.md` の直し）を、写し直した事実に合わせて書くため。
- **何が要るか**: 私の `permissions.json` の `bash` に、次の形を足すこと（ユーザーの承認が要る）。
  - `node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json`
  - 前方一致なので、このあとに `--out …` を付けた形も、`--dry-run` を付けた形も、これで打てる。
  - 台本が書く先（`records/phase0/evidence/`・`tasks/2026-11-16-before-delete-c/kept/`・`--out`）は、どれも今の `write_paths`（`records/`・`tasks/`）の中にある。
- 許可が付いたら、次の順で進める。
  1. 写す。終了 0、entries 25 / copied 25 / match 25 / errors 0、`extension.vsixmanifest` の `destSha256` が `301bdf41…`、新しいファイルが3つ、を確かめる。
  2. `sha256sum` で、写し先を自分でも照らす。
  3. `records/phase0/evidence/README.md` と `records/phase0/lock-verification.md`（53行など）を直す。
  4. この書き物に結果を足す。

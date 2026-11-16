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

（この2点は、蒙恬の4回目で直った。付記1を参照）

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

## 付記1（2026-11-16）: copy-verify.mjs の直しとテストの検証

- 依頼: リーダーの知らせ「copy-verify.mjs の直しの検証」
- 対象:
  - 蒙恬の直し（`handoff-notes-meng-tian.md` の「4回目」R4-1〜R4-6）
  - 曹参のテスト `tests/copy-verify.test.mjs`
- 判定: **合格**
  - 台本は、知らせの3点（消さない・一覧の写し先と `--out` のほかに書かない・途中のリンクも含めて柵を守る）を満たす。
  - テストは結果を見ていて、台本に合わせて緩めた所は見当たらない。44/44 で通った。
  - テストに直す点が1つある（下の「直す点」）。軽く、合否は変えない。
- 写し直しの本番（上の2・3節）は、許可が入るまで判定できないままである。

### 台本（`scripts/copy-verify.mjs`。未追跡なので全329行を読んだ）

| 確かめた点 | 結果 | 根拠 |
|---|---|---|
| 何も消さない | 満たす | `unlink`・`rm`・`rmdir`・`rename`・`truncate` は無い。書く呼び出しは次の4つだけ。写し先の親の `mkdirSync`、`copyFileSync`、`--out` の親の `mkdirSync`、`--out` の `writeFileSync` |
| 一覧の写し先と `--out` のほかには書かない | 満たす | 写すのは `validateList` を通った各行の `toAbs` だけ。`--out` は `checkOut` が返した絶対パスだけに書く。`main` の順は次のとおり。`validateList` → `checkOut` → `copyVerify` → `--out` を書く。一覧か `--out` に誤りがあれば、写す前に終了 2 で止まり、どこにも書かない |
| `--out` の柵 | 満たす | `OUT_ROOTS = ["tasks", "tmp/tests"]`（リポジトリからの相対）。どちらかの根の下に限り、根そのものは不可。`tmp/b` の下と `tmp/` の直下は外になる。次のどれかに当たれば誤りにする。根から `--out` の親までの途中にリンクがある。`fromRoot` の下にある。一覧のどれかの元・写し先と同じ。一覧のファイルと同じ。既にあるものがリンクかフォルダ |
| 途中のリンクも含めて柵を守る | 満たす | 新しい関数 `linkInChain(p, root)` が、柵の根そのものから `p` の親までのフォルダを1つずつ `lstat` で見る。Node は Windows のジャンクションも `isSymbolicLink()` で返す。リンクがあるか、フォルダでないものがあれば誤りにする。そのうえで、在るフォルダのうちいちばん深いものの実体（`realpathSync.native`）が、根の実体の下にあることを照らす。無いフォルダから先は `mkdir` が本物のフォルダを作る。`validateList` は、行ごとに元の側と写し先の側の両方にこれをかける。`copyVerify` も写す直前に同じ確かめをし直し、変わっていればその行を `error` にして写さない |

### テスト（`tests/copy-verify.test.mjs`。44件）

- 見ているのは結果である。柵の外にファイルができないこと、元が上書きされないこと、写し先の木の前後、終了コード、出力の JSON の欄を見ている。
- 「（見張り）」の3件は、前に私が知らせた2点を再現している。
  - 写し先の途中のジャンクション
  - 元の途中のジャンクション
  - `--out` が一覧の元か、元の柵の下
- 3件とも、先に「柵の外に書いていない・元が変わっていない」を見て、その後に終了 2 を見る。直し方の形（関数の名前や誤りの文）には頼らない。
- 落ちるべきときに落ちるか（読んで確かめた）:
  - `validateList` の `linkInChain` を外すと、写す直前の見直しが止めるので終了は 1 になる。見張りは 2 を期待するので落ちる。
  - 見直しも外すと、柵の外にファイルができるので落ちる。
- ジャンクションを作れない環境では飛ばす作りだが、今回は飛ばした件数が 0 だった。3件とも本当に試されている。
- 緩めた所: 見当たらない。`--out` を使う2件（316行・529行）は、最初は台本の決まり（tasks/ の下だけ）と食い違って落ちた。リーダーは、テストを書き換えるのでなく `--out` の柵を `tmp/tests/` まで広げると決めた（R4-6）。テストの期待は変わっていない。

### 直す点（曹参。軽い。合否は変えない）

1. **`--out` の置き場所の柵（`OUT_ROOTS`）を見張るテストが無い**
   - `--out` を `tasks/` と `tmp/tests/` の外に置いたときに断ることを確かめるテストが無い（例 `tmp/b/…`・`tmp/` の直下・リポジトリの外）。
   - 次の場合を確かめるテストも無い。
     - `--out` が一覧の写し先と同じ。
     - `--out` が一覧のファイルと同じ。
     - `--out` の途中にジャンクションがある。
   - 今は、`OUT_ROOTS` の確かめを台本から外しても、落ちるテストが無い。
   - 蒙恬は `tmp/b/…` と `tmp/` の直下が終了 2 になることを手で試している（R4-6 の表）。テストには無い。
2. **テストの冒頭の説明が古い**
   - 7〜10行は「台本は今、途中のフォルダのジャンクションを辿って…この3件は落ちる」と書いている。今は直って、3件とも通る。

### 記録として伝える点（直す必要は無い）

1. **柵の根より上のフォルダは見ない**
   - `linkInChain` が `lstat` で見るのは、柵の根そのものから下だけである。
   - 根より上（例 `records/` やリポジトリの上）がジャンクションでも、根の実体と照らすので誤りにはならない。根の指す先が柵、という扱いである。
   - 今の柵（`C:/b/p0`・`C:/b/p4-watch/trial/real`・`records/phase0/evidence`・`tasks/…/kept`・`tasks`・`tmp/tests`）では当たらない。
2. **`--out` は柵の中の既存のファイルを上書きする**
   - 例: `tasks/` の下の別の書き物。
   - 柵の中なので、決まりの上では許される。打つときに `--out` の名前を間違えないこと。
3. **`AIED_TEST_TMP` で試しの入れ物を `tmp/tests/` の外に向けると、`--out` を使う2件は落ちる**（蒙恬の R4-6 の注意）

### 走らせたもの

| コマンド | 結果 |
|---|---|
| `node --test tests/copy-verify.test.mjs` | **tests 44、pass 44、fail 0、skipped 0**（4.5 秒） |

`records/`・`kept/`・`C:\b`・`tmp/b` には何も書いていない。

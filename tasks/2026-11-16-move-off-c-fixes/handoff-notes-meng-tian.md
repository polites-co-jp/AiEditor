# 引き継ぎの書き付け（蒙恬）: C: から移す直しの残り

- 作成: 蒙恬（2026-11-16）
- 依頼: `tasks/2026-11-16-move-off-c-fixes/brief.md` の「やること（蒙恬）」の1〜4。指摘の出どころは `tasks/2026-11-15-move-off-c-verify/verification-ooka.md` の3節の1・3・4
- 結果: **完了**
- `C:\b` と本物の `tmp\b` には何も作っていない（Glob `tmp/b/**` で 0 件）。試しは `tmp\tests\meng-tian-mbr\` の下だけで行った（6節）

## 0. 要点

1. 取り込みの監査のラベルは**縮める**ことにした。スモークと同じ決まり（`shortLabel`）で 10 文字までにする。`<buildRoot>` が長くて縮めても 259 文字を超えるときは、手順 7 を含む実行を手順 1 の前に止める。
2. `move-build-root.mjs` は、**どの種類の項目でも**全部のファイルを SHA-256 で照らす。かかった時間は項目ごとに `seconds`（写す）と `verifySeconds`（照らす）に、全体は `seconds` に出る。
3. 写し先に途中まで写したものがあれば、元と同じファイル（大きさと SHA-256）は飛ばし、無いものだけを `COPYFILE_EXCL` で写して続ける。違うファイルが1つでもあれば、今までどおり problem で止まり、何も写さない。上書きはしない。
4. 3の直しで、前の版にあった誤りが1つ消えた。`smoke-baselines` の写し先は `smoke`。`smoke-ext` を先に写すと `smoke` ができるので、前の版では本番で `smoke-baselines` が「写し先に無い」の problem になるはずだった（2.3）。
5. 自己確認は 194 件すべて通った（brief の3ファイルと `move-off-c.test.mjs`。曹参が並行して足したテストを含む）。

## 1. 取り込みの監査の名前の長さ（直す点の1）

### 決めたこと: 縮める（長いときだけ止める）

- netaudit.ps1 は、実行のフォルダを `<WorkRoot>\<Label>-netaudit` に作る。take-in.mjs が渡す `-Label` は `take-in-<ラベル>`。
- いちばん長いファイルは `<WorkRoot>\take-in-<ラベル>-netaudit\user\user-data\Code Cache\electron-preload\<64>-<64>.cache`。WorkRoot は `<buildRoot>\audit` で、既定の `<buildRoot>` は 45 文字。このときの長さは 248 + ラベルの文字数になる（大岡越前守の数え方と同じ）。
- 上限は 259 文字なので、ラベルは 11 文字まで入る。スモーク（`tests/smoke/lib/common.mjs` の `RUN_DIR_NAME_MAX`）にならって 1 文字の余裕を残し、**10 文字**にした（`NETAUDIT_LABEL_MAX`）。
- 縮め方は曹参の `shortLabel` と同じにした。
  - 使えない文字（`A-Za-z0-9._-` の外）は `_` にする。
  - 収まるラベルはそのまま。
  - 長いラベルは「先頭の 7 文字 + ラベル全体の sha1 の先頭 3 桁」にする。同じラベルは、いつも同じ名前になる。
- 例:
  - 既定の形 `1.147.0-1`（9 文字）はそのまま `take-in-1.147.0-1`。長さは 257 文字。
  - `1.146.0-p2-A-1`（14 文字）は `take-in-1.146.085c`。長さは 258 文字（6節の dry-run）。
- 止める場合: `<buildRoot>` が長く（local.json で深い場所を指したときなど）、縮めても超えるとき。手順 7 を含む実行なら、手順 1 の前に `Stop`（終了コード 1）で止まり、何も作らない。
  - dry-run では止めない。計画の `netauditRun` に `ok: false` と文字数を出す。
  - 止めずに dry-run に出すのは、テストが深い試しの入れ物を `--build-root` に渡して dry-run を走らせるため。
- 縮めずに止めるだけの案は採らなかった。`take-in.mjs --label` で長いラベルを渡す使い方（例 `1.146.0-p2-A-1`）が、既に記録にあるため。
- スモークの関数は `tests/` から import せず、`scripts/lib/take-in/smoke-net.mjs` に同じ決まりで書いた。台本がテストの部品に頼らないようにするため。2つの決まりは同じなので、曹参のテストで両方を照らせる（5節）。

### 縮めたときに変わること

- 縮めた名前は次の場所に出る。
  - netaudit.ps1 の `-Label`
  - `destinations.json` の `Meta.Label` と、md の見出し
  - ネットのログのファイル名（`<buildRoot>\netlog\<Label>-<時刻>.*`。読んだ後すぐ消える）
- 完全なラベルは、記録の場所 `records/take-in/<ラベル>/netaudit/` と `take-in.json` に残る。take-in.mjs は前の版の監査を場所で探す（`netPreviousFor`）ので、`Meta.Label` が短くなっても困らない。
- sha1 の 3 桁がぶつかると、別のラベルが同じ実行のフォルダを使う。取り込みは1つずつ走り、実行のフォルダは監査のたびに `-Force` で作り直す一時の場所なので、害は無い。

## 2. 写す台本の SHA-256 と続き（直す点の3・4）

### 2.1 SHA-256（全部の項目）

- `verifySame` は、項目の種類（dir・git・file・files・results）を問わず、毎回すべてのファイルの SHA-256 を計算し直す。前の結果は使わない。消す前の最後の照らしだからである。
- `PLAN` の `sha256: true` は外した。全部の項目で照らすので、もう要らない。
- 時間の記録（結果の JSON）:
  - 項目: `seconds`（写した時間）、`verifySeconds`（写した後に照らした時間。already のときは前からあった写し先を照らした時間）、`existing.seconds`（写し先が既にあったときに照らした時間）
  - 全体: `seconds`
  - 標準エラーにも、項目ごとに「写す n 秒、照らす n 秒」を出す。
- 時間の見込み: 本物ではまだ測っていない。照らすには元と写し先を全部読むので、約 9.44 GB × 2 になる。前の版は zip 3つなど約 1.4 GB だけを照らしていた。8 GB 近い dir の分の読み込みが増えた。実際の時間は、本番の `move-result.json` の `verifySeconds` で分かる。

### 2.2 続きから写す

写し先（`dstRoot`）が既にあるときの扱い（dry-run も同じ。dry-run は写さない）:

| 写し先の様子 | 状態 | すること |
|---|---|---|
| 写すファイルが全部あり、大きさと SHA-256 が元と同じ | `already` | 何もしない |
| 違うもの（大きさか SHA-256 が違う、ファイルでない）が1つでもある | `problem` | 何も写さない。上書きしない。`problems` と `existing.differentFiles`（最大 20）に違うファイルを出す |
| 違うものが無く、無いものがある | `copied`（`resume: true`） | 無いものだけを `COPYFILE_EXCL` で写す。その後、全部のファイルを SHA-256 で照らし直す。dry-run では `planned`（`resume: true`） |

- 写し先にあって元に無いファイルは、数えない。照らさないし、消さない。
- 前からあった同じファイルは、続きの回では2回読む（照らすときと、最後の照らし）。
- git の項目は、続きで写した後にも refs と作業ツリーの数を照らす。
- **途中で切れたファイル**は「違うもの」になり、problem で止まる。写している途中で台本が止まると、そのファイルは写し先に途中まで残る（曹参のテストの「元より小さい」形）。
  - その1つのファイルを消せば続きから写せる。ただし台本は消さない。削除の許可も、今の形（`C:/b/` の下）と依頼中の形（前の書き付けの 4.1 の `tmp/b/` の下）のどちらも、`p2/`・`dist/`・`smoke/ext/`・`trial-*` しか無い（4節の未解決の1）。

### 2.3 前の版にあった誤り（ついでに消えた）

- `smoke-baselines`（`kind: files`）の写し先の根は `smoke`。`PLAN` の順では、その前に `smoke-ext` が `smoke\ext` を作る。
- そのため前の版では、本番の1回目で `smoke-baselines` の `destExists` が真になっていた。`verifySame` が「写し先に無い」を出し、**problem で止まるはずだった**。同じ根を持つ `official-zip`・`official-fetch-record` は file の項目で、根がファイルそのものなので当たらない。
- 今は「無いものだけ写す」になったので、そのまま `copied` になる（6節の試しで確かめた）。

## 3. 変えた関数の入口（曹参へ）

### `scripts/lib/take-in/smoke-net.mjs`（純粋な関数）

- `NETAUDIT_LABEL_MAX` = `10`
- `NETAUDIT_CC_TAIL_LENGTH` = `179`（`\user\user-data\Code Cache\electron-preload\` 44 文字 + `<64>-<64>.cache` 135 文字）
- `NETAUDIT_FILE_LIMIT` = `259`
- `shortLabel(label, max)`: `tests/smoke/lib/common.mjs` の `shortLabel` と同じ決まり。同じ引数なら同じ値を返す。
  - 例: `shortLabel('1.147.0-1', 10)` → `'1.147.0-1'`。`shortLabel('1.146.0-p2-A-1', 10)` → `'1.146.085c'`
- `netauditLabel(label, max = 10)` → `` `take-in-${shortLabel(label, max)}` ``
- `netauditPathCheck(workRoot, label)` → `{ label, runDir, longest, limit, ok }`
  - `runDir` = `path.win32.join(workRoot, '<netauditLabel>-netaudit')`
  - `longest` = `runDir.length + 179`
  - `ok` = `longest <= 259`
  - 例: `netauditPathCheck('E:\\develop\\self\\Team\\projects\\ai-editor\\tmp\\b\\audit', '1.147.0-1').longest` → `257`。ラベル `1.146.0-p2-A-1` なら `258`
- `netauditArgs({...})`: `-Label` が `netauditLabel(label)` になった。10 文字以下のラベルは前と同じ値になる（今のテスト `take-in-1.147.0-1` は通る）。

### `scripts/take-in.mjs`

- `core` の dry-run の出力と記録（`take-in.json`）に `netauditRun`（`netauditPathCheck` の結果）を足した。
- dry-run でない実行で、手順 7 を含み `netauditRun.ok === false` なら、手順 1 の前に止まる。
  - 標準エラー: `[take-in] 止めた: 通信の監査の実行のフォルダの中のパスが長すぎる（<n> 文字。上限 259）: <runDir>。…`
  - 終了コード 1。記録のフォルダも、buildRoot の下も作らない。
- 試しの形:
  - `node scripts/take-in.mjs core 1.147.0 --from 7 --to 7 --label <短い名前> --prev-tag 1.146.0 --skip-judge --no-writeback --build-root <80 文字ほどの、存在しない試しの入れ物の下>`
  - 止める検査が効かなくても、その後の「ブランチの作業ツリーが要る」で止まるので、安全に試せる。
- `--to 6` 以前（手順 7 を含まない）なら、長くても止めない。

### `scripts/move-build-root.mjs`

- `verifySame(item, sel)` → `{ ok, checked, problems }`（形は前と同じ）。全部のファイルの SHA-256 を毎回計算し直す。同じだったファイルには `f.sha256` を書く。
- `compareExisting(sel)`（新規。書き出した。読むだけ） → `{ same, missing, different, sameBytes, missingBytes, differentFiles, seconds }`。
  - 同じファイルには `f.existingSame = true` と `f.sha256` を書く。
  - `copyFiles` は `f.existingSame` のファイルを飛ばす。
- 結果の JSON の項目に足したもの:
  - `existing`: 写し先が既にあったとき。`compareExisting` の結果
  - `resume: true`: 続きから写したとき、または写す予定のとき
  - `seconds`・`verifySeconds`
- 全体に足したもの: `seconds`
- `PLAN` の file の項目から `sha256: true` を外した。
- 消さない決まりは前のまま。`unlink`・`rm`・`rmdir`・`rename` は呼ばず、`COPYFILE_EXCL` だけで写す。

## 4. 未解決の点・知らせ

1. **途中で切れたファイルの片づけ**（2.2）: 途中で切れたファイルが1つ残ると、その項目は problem で止まる。続けるには、そのファイルを消す必要がある。
   - 台本は消さない。
   - 削除の許可（今の形と依頼中の形）は、`official/`・`cache/vsix/`・`logs/`・`vscode/` などの写し先に届かない。
   - 本番で起きたら、リーダーが違うファイルを `existing.differentFiles` で確かめる。消すには、その1つを消す一時の許可が要る。手順書（前の書き付けの R2-4 の手順6）に足すかどうかは、リーダーが決める。
2. 時間の実測は無い（2.1）。本番の `move-result.json` の `seconds`・`verifySeconds` で分かる。
3. 試しの残り: `tmp\tests\meng-tian-mbr\`（`from\` と `to\` に小さなファイルが合わせて8個）。私には消す許可が無いので残っている。要らなければリーダーが消してほしい。
4. docs/ との食い違い: 無い。裁定（`docs/user-decisions.md` 2026-11-16 の「写す方法」の「数と大きさと SHA-256 を照らす」）に、全部の項目で合うようになった。docs/06 の9節は、監査の実行のフォルダの名前を書いていない。

## 5. 曹参のテストで照らせる点（並行して書いている分への知らせ）

`tests/move-build-root.test.mjs` に曹参が足したテスト（dir の SHA-256、時間、続き）は、私の実装ですべて通った（6節）。そこで使っている欄の名前（`seconds`・`verifySeconds`・`existing.same`・`existing.missing`）は、3節のとおり。

まだ見ていないと思われる点:

- `netauditLabel`・`netauditPathCheck`・`NETAUDIT_LABEL_MAX` と、`take-in.mjs` が手順 7 の前に止まること
- `scripts/lib/take-in/smoke-net.mjs` の `shortLabel` と `tests/smoke/lib/common.mjs` の `shortLabel` が、同じ引数で同じ値を返すこと
- `move-off-c.test.mjs` の最長のパスの見張りに、取り込みの監査（`<NEW_DEFAULT>\audit\` + `netauditLabel` の最長 + `-netaudit` + `CC_TAIL` が 259 以下）を足すこと
- `smoke-ext` を写した後に `smoke-baselines` を写す順（2.3）

## 6. 自分で確かめたこと

- `node --test tests/move-build-root.test.mjs tests/take-in.test.mjs tests/take-in-more.test.mjs tests/move-off-c.test.mjs`: **194 件、通った 194、落ちた 0**。
  - 1回目は、brief の3ファイルだけで 160 件中 159 件だった。`verifySame` の結果を同じ `sel` の上に覚えさせる形にしていたため、テストが2回目に呼んだときに SHA-256 を計算し直さなかった。毎回計算し直す形に直した。
- 写す台本の試し（試しの入れ物 `tmp\tests\meng-tian-mbr\`。`--only p2-all,smoke-ext,smoke-baselines`）。用意した写し先は次の3つ。
  - `p2-all`: 1ファイルは同じ、1ファイルは無い
  - `smoke-ext`: 同じ大きさで中身が違う
  - `smoke-baselines`: 写し先の根 `smoke` だけがある
  - 結果:
    - dry-run: `p2-all` は `planned`（`resume`、`existing.same 1`・`missing 1`）。`smoke-ext` は `problem`（`SHA-256 が違う`）。`smoke-baselines` は `planned`（`resume`）。何も写さなかった。
    - 実行: `p2-all` は `copied`（`copied 1`、照らした数 2）。`smoke-ext` は `problem` で、写し先の中身は `AAAB` のまま（上書きしていない）。`smoke-baselines` は `copied`。終了コード 1。
    - 2回目（`p2-all,smoke-baselines`）: どちらも `already`、終了コード 0。記録は `tasks/2026-11-16-move-off-c-fixes/trial-mbr-second-run.json`。
- `node scripts/take-in.mjs core 1.147.0 --dry-run --label 1.146.0-p2-A-1 --prev-tag 1.146.0 --skip-judge --no-writeback` の結果:
  - `netauditRun`: `label` = `take-in-1.146.085c`、`runDir` = `E:\develop\self\Team\projects\ai-editor\tmp\b\audit\take-in-1.146.085c-netaudit`、`longest` = 258、`ok` = true
  - `plan.netaudit.args` の `-Label` も同じ値
  - 何も作らなかった
- `node scripts/take-in.mjs core 1.147.0 --from 7 --to 7 --label mt-long-1 ... --build-root E:/develop/self/Team/projects/ai-editor/tmp/tests/meng-tian-longroot-0123456789-0123456789` の結果:
  - 「パスが長すぎる（302 文字。上限 259）」で止まった。終了コード 1。
  - `records/take-in/mt-long-1` も、その buildRoot も作らなかった（Glob で 0 件）。
- `node --check` は、私の許可の形（`node --check scripts/`）が「許可＋半角空白」に当たらないため、走らせていない。直した3本は、どれも上のテストと台本の実行で読み込まれて動いた。

## 7. 成果物

- 直した:
  - `scripts/lib/take-in/smoke-net.mjs`（`shortLabel`・`netauditLabel`・`netauditPathCheck`・定数3つ、`netauditArgs` の `-Label`）
  - `scripts/take-in.mjs`（`netauditRun` と、手順 7 の前に止める検査）
  - `scripts/move-build-root.mjs`（全部の項目の SHA-256、`compareExisting`、続きから写す、時間の記録）
- 新規:
  - `tasks/2026-11-16-move-off-c-fixes/handoff-notes-meng-tian.md`（この書き付け）
  - `tasks/2026-11-16-move-off-c-fixes/trial-mbr-second-run.json`（試しの2回目の結果）
- 試しの残り: `tmp\tests\meng-tian-mbr\`（4節の3）

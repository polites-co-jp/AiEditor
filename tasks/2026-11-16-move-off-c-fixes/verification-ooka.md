# 検証: C: から移す直しの残り（前回の直す点1〜5と、テストの副作用）

- 検証: 大岡越前守（2026-11-16）
- 依頼: `tasks/2026-11-16-move-off-c-fixes/brief.md`
- 対象: 蒙恬の台本の直し（`handoff-notes-meng-tian.md`）と、曹参のテストの直し（`handoff-notes-cao-shen.md` の1回目・2回目）
- 前回の検証: `tasks/2026-11-15-move-off-c-verify/verification-ooka.md` の3節

## 判定: 合格

brief の完了条件（蒙恬の1〜3、曹参の1〜4、run-all の fail が 0）を満たしている。前回の直す点の1〜5は、すべて閉じた。

直す点が2つある（4節）。どれも軽く、合否は変えない。記録として伝える点は6つある（5節）。

## 1. 前回の直す点が閉じたか（差分を読んで確かめた）

| 前回の点 | 結果 | 根拠 |
|---|---|---|
| 1. 取り込みの監査の名前の長さ（蒙恬） | 閉じた | `smoke-net.mjs` に `NETAUDIT_LABEL_MAX = 10`・`shortLabel`・`netauditLabel`・`netauditPathCheck` を足した。`netauditArgs` の `-Label` は `netauditLabel(label)` になった。`shortLabel` は `tests/smoke/lib/common.mjs` と同じ決まりで、「先頭の (max-3) 文字 + sha1 の先頭3桁」、使えない文字は `_`。`take-in.mjs` の `runCore` は、ラベルとステップを決めた直後で `netauditPathCheck(<buildRoot>\audit, label)` を計算する。dry-run でなく、手順 7 を含み、`ok:false` なら `Stop`（終了コード 1）で止まる。この位置は `fs.mkdirSync(ctx.recDir)`（654行）と手順 1 より前にある。それより前に何かを作るのは `setChildTemp` だけで、これは変数を決めるだけでフォルダは作らない。catch の後始末も `recDir` が無ければ書かない。止めずに縮める扱いは、裁定の記録「移す直しの残りで出た点」の1行目と合っている |
| 2. テストが本物の `tmp\b` に書く（曹参） | 閉じた | `p1-scripts.test.mjs` は `BR = path.join(sb, 'fake-build-root')` にした。`launch()` は、偽の `LOCALAPPDATA\Shuko\local.json` に `{ buildRoot: BR }` を書いて p1-launch-check.ps1 を走らせる。219行・289行の作って消す先は、どちらも試しの入れ物の中になった。`NEW_DEFAULT` の import も外した。直接走らせて 34件すべて通った。走らせる前も後も `tmp\b` の下は 0件だった（Glob `tmp/b/**`） |
| 3. SHA-256 で照らすのが file の項目だけ（蒙恬） | 閉じた | `verifySame` は `item.sha256` の分岐を外し、大きさが同じなら必ず SHA-256 を照らす。結果は毎回計算し直し、前の結果を覚えない。`PLAN` の `sha256: true` も外した。項目ごとに `seconds`・`verifySeconds`、全体に `seconds` を出す |
| 4. 途中から続けて写せない（蒙恬） | 閉じた | 新しい関数 `compareExisting(sel)` は読むだけ。写し先の各ファイルを stat し、無ければ missing、ファイルでないか大きさか SHA-256 が違えば different、同じなら `existingSame`。`main` の流れは次のとおり。different が1つでもあれば problem にして `continue` する（何も写さない）。missing が 0 なら already。それ以外は `resume: true` にして `copyFiles` へ進む。`copyFiles` は `existingSame` のファイルを飛ばし、ほかは `COPYFILE_EXCL` で写す（上書きしない）。写した後は、全部のファイルを `verifySame` で照らし直す。途中で切れたファイルは大きさが違うので different になり、problem で止まる |
| 5. 見張るテストの不足（曹参） | 閉じた | 新しいテスト `move-off-c-fixes.test.mjs` が次を確かめる。`build.mjs --dry-run` の `toolchainSteps` が install・typecheck・package であること。`all` に LOCALAPPDATA が無く、`toolchain` は `all` を含むこと。`envOf` の形と、`toolEnv` を直接使う行の数。take-in の `childTemp`（TEMP・TMP だけで、`<buildRoot>\tmp`）と `-WorkRoot <buildRoot>\audit`。`applyEnvVars` が `Temp`・`tmp`・`NPM_CONFIG_CACHE`・`Pnpm_Config_Store_Dir` を消してから入れること。`netaudit.tests.ps1` には、偽のエディタで `Invoke-NetAudit` の正常な経路を最後まで動かすテストを2件足した（ネットのログが読まれてから消えること、秘密が残らないこと、開いたままのファイルがあれば記録を書いてから止まること） |

### テストが仕様を確かめているか（落ちるべきときに落ちるか）

- dir の SHA-256: `verifySame` を大きさだけの照らしに戻すと、「dir の SHA-256: 写した後の照らし…」が落ちる（同じ3バイトで中身が違う `Shuko.exe`）。
- 続きから写す:
  - `compareExisting` が SHA-256 を見なくなると、「続き: 写し先に違うファイルが1つでもあれば problem。無いものも写さず…」が落ちる。`product.json` が写ってしまうため。
  - `copyFiles` が `existingSame` を飛ばさなくなると、`COPYFILE_EXCL` が失敗して problem になる。「続き: 途中で止まった写し先…」が落ちる。
  - 前からあったファイルの更新時刻が変わらないことも見ている。
- 監査の名前: 長いラベルのテストは、縮める実装でも止める実装でも通る形にしてある。それとは別に `netauditPathCheck` の値（`longest` が実際のパスの長さと一致すること）と、止める経路（終了コード 1、buildRoot も記録のフォルダも作らない）を固定している。実装に合わせて仕様を緩めた所は見当たらない。
- `shortLabel` の2つ（台本とスモーク）が同じ値を返すことを、ラベル6種 × max 4種で照らしている。

## 2. テストの一時のファイルが C: に出ないか

| 場面 | 結果 | 根拠 |
|---|---|---|
| run-all | 出ない | `run-all.mjs` は、子の `TEMP`・`TMP` を `<リポジトリ>\tmp\tests-temp` に向ける（前からの形）。走らせた後、`tmp\tests-temp` に `node-compile-cache` や `p34-wb-*` などが溜まっていた。子の道具の一時のファイルもそこへ向いたことが分かる |
| `node --test` で直接走らせる（temp-root.mjs） | os.tmpdir() を使う 23 ファイルは出ない | `tests/build/temp-root.mjs` は、読み込まれた時点で `process.env.TEMP`・`TMP` を `tmp\tests-temp` に向ける。Windows の Node の `os.tmpdir()` は、呼ぶたびに `TEMP` を読む。tmpdir() を呼ぶ所は、どれもテストの本体の中にある。23 ファイルの import の位置は差分で読んだ。`node:os` の import より前にあり、import の群の中にある。見張りのテスト（tmpdir を使う `.test.mjs` は全部 temp-root を読み込むこと）も通った。私が `node --test tests/move-off-c-fixes.test.mjs tests/c2-worktree.test.mjs` を直接走らせて 54件すべて通った。その中のテストは、`TEMP=C:\Windows\Temp` の子で `os.tmpdir()`・`TEMP`・`TMP` が `tmp\tests-temp` を返すことを確かめている。`c2-worktree.test.mjs` だけを直接走らせた回も、終了コード 0 だった |
| `.tests.ps1` を直接走らせる | 出ない | `measure.tests.ps1`・`netaudit.tests.ps1` の冒頭で、そのプロセスの `TEMP`・`TMP` を `tmp\tests-temp` に向けている |

限りは 5節の2に書いた（temp-root を読み込まないテストが起こす子のプロセス）。

## 3. 写す台本に、消す呼び出しが無いこと

- `scripts/move-build-root.mjs` を全文読み、grep した。
  - `unlink`・`rmSync`・`rmdir`・`rename`・`truncate`・`cpSync`・`Remove-Item` は無い。
  - 書くのは `mkdirSync`（recursive）、`copyFileSync(..., COPYFILE_EXCL)`、`utimesSync`（今回写したファイルだけ）、`--out` の結果の JSON だけ。
- git の呼び出しは `worktree list --porcelain` と `for-each-ref` だけで、どちらも読むだけ。
- 許可の外を消す手順は含まない。冒頭の説明は「消すのは…許可の中で `rm -rf` の形で行う（この台本の外）」と書いているだけ。
- 途中で切れたファイルの扱いは、裁定の記録（その項目の写し先を `rm -rf` で消して写し直す。一時の削除の許可は権限の依頼に足した）と合っている。台本はその手順を持たない。
- テスト「台本は何も消さない（unlink・rm・rmdir・rename を呼ばない）」も通った。

## 4. 走らせたもの

| コマンド | 結果 |
|---|---|
| `node tests/run-all.mjs --save tasks/2026-11-16-move-off-c-fixes/run-all-ooka.txt` | 終了コード 0。**2648件、通った 2641、落ちた 0、飛ばした 7**（`removals.test.mjs` の前からの7件）。曹参の2回目（`run-all-cao-shen-2.txt`）と、ファイルごとの件数まで同じ。見張り（本物の `C:\b`・`tmp\b`・local.json の buildRoot の前後の比較）でも fail は出なかった |
| `node --test tests/p1-scripts.test.mjs` | 34件すべて通った |
| `node --test tests/move-off-c-fixes.test.mjs tests/c2-worktree.test.mjs` | 54件すべて通った（31 + 23） |
| `node --test tests/c2-worktree.test.mjs` | 終了コード 0 |

走らせる前も後も、`tmp\b` の下は 0件だった（Glob `tmp/b/**`）。`tmp\tests\` の下にも残りは無かった。蒙恬の試しの残り `tmp\tests\meng-tian-mbr\` は、`move-off-c-fixes.test.mjs` の `after` が消した。`C:\b` には書いていない（ただし 5節の1）。

## 5. 指摘

### 直す点（軽い。合否は変えない）

1. **見張りが、根の直下で作って消したものを見つけられない（曹参。`tests/build/guard-roots.mjs`）**
   - `snapshotRoot` は根の中の項目の更新時刻を記録するが、根そのもの（`C:\b`・`tmp\b`）の更新時刻は記録しない。
   - そのため、根の直下にフォルダを作って消すと、差が出ない。例: `tmp\b\tests-l10n-fake-root-<pid>`。これは前回の直す点の2と同じ形の書き込みである。
   - 深さ2より下（例 `C:\b\wt\tests-ac-<pid>`）は、親の `wt` の更新時刻が動くので見つかる。
   - 書き付けにある「作って消しただけでも親フォルダの更新時刻が動くので見つかる」は、根の直下には当てはまらない。移した後は `tmp\b` が常にあるので、この穴が効いてくる。
   - 直し方: 根そのものの更新時刻も記録する（例 `snap['.']`）。あわせて、根の直下で作って消す場合のテストを足す。
2. **`apply-commits.test.mjs` の冒頭の説明が古い（曹参）**
   - 6〜7行は、まだ「`<buildRoot>\wt\` の下に作って行い」と書いている。実装は `sandboxBase()`（`tmp\tests\acw-<pid>`）である。

### 記録として伝える点（直す必要は無い）

1. **run-all は、今も常設の clone の `.git` に書く**
   - `apply-commits.test.mjs` の通しの試しは、`C:\b\vscode` に対して `git worktree add` / `remove` / `prune` を走らせる。そのため `C:\b\vscode\.git\worktrees\acw-<pid>` が作られては消える。
   - 見張りは `vscode\.git` を対象から外している（`IGNORED`）。
   - 曹参の書き付けに明記されている扱いである。それでも、依頼の「C:\b には何も作らず、何も消さない」は、run-all を走らせるだけで字面の上では破れる。前回の記録の6と同じ形が、`.git` の中だけに縮んだ。
2. **直接走らせたとき、temp-root を読み込まないテストの子のプロセスは、利用者の TEMP を使う**
   - temp-root は、os.tmpdir() を使う 23 ファイルだけに入っている。
   - ほかのテストを直接走らせると、起こす子（powershell・git・tsc など）は利用者の `TEMP`（C:）を受け継ぐ。
   - run-all の後の `tmp\tests-temp` に `node-compile-cache` が出ていた。子の道具は TEMP に書くことがある。
   - C: に実際に書いたかは、私の読める場所の外なので確かめていない。依頼の範囲（temp-root）の外の話として書いておく。
3. **`p1-scripts.test.mjs` の `BR` は、モジュールの読み込み時に `sb` を使う**
   - トップレベルの `before()` がその場で走ることに頼っている（Node v24.22.1 で通った）。
   - Node の振る舞いが変われば、`path.join(undefined)` で大きな音を立てて落ちる。黙って本物の場所に書くことは無い。
4. **`watch.test.mjs` の `p34-wb-*`・`p34-watch-*` は片づけない**
   - 約 100 個のフォルダが `tmp\tests-temp` に溜まっていた。C: ではなく、範囲外の未追跡の p34 のテストである。
5. **`move-off-c-fixes.test.mjs` の `after` は、蒙恬の試しの残り `tmp\tests\meng-tian-mbr` を消す**
   - 一度きりの片づけを、テストに持たせている。試しの入れ物の中だけなので害は無い。もう消えたので、後で外してよい。
6. **写す台本の時間は、本物ではまだ測っていない**（蒙恬の4節の2）
   - 全部の項目で SHA-256 を照らすので、元と写し先の約 9.44 GB × 2 を読む。本番の `move-result.json` の `seconds`・`verifySeconds` で分かる。
   - git の項目が already のときは、refs と作業ツリーの数を照らし直さない。前の版と同じで、全部のファイルの SHA-256 が同じことで代わりにしている。

## 6. 記録したファイル

- `tasks/2026-11-16-move-off-c-fixes/verification-ooka.md`（この書き物）
- `tasks/2026-11-16-move-off-c-fixes/run-all-ooka.txt`（run-all の件数）

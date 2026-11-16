# C: から移す直しの残りのテスト（曹参の引き継ぎ）

- 担当: cao-shen（曹参）
- 依頼: `tasks/2026-11-16-move-off-c-fixes/brief.md` の「やること（曹参）」の1〜5。指摘の出どころは `tasks/2026-11-15-move-off-c-verify/verification-ooka.md` の直す点の2・5と、記録の6
- 蒙恬の直しは入った後（`handoff-notes-meng-tian.md`）に書いたので、新しいテストは全部通る状態。先に書けたものを「落ちる状態で」残した所は無い。
- `C:\b` と本物の `tmp\b` には何も作っていない（Glob `tmp/b/**/*` で 0 件）。試しは `tmp\tests\` の下だけ。

## 1. テストが本物の `tmp\b` に書く（直す点の2）

`tests/p1-scripts.test.mjs`: `BR` を `NEW_DEFAULT`（本物の `tmp\b`）から、試しの入れ物の中の `fake-build-root` に変えた。`launch()` が偽の `LOCALAPPDATA` の `Shuko\local.json` に `{ buildRoot: BR }` を書く。`-Root` の入れ物（`tests-l10n-fake-root-*`）も `-Dest <buildRoot>\p2\...` の試しも、試しの入れ物の中になった。本物の `<buildRoot>\p2` で `rmSync` を走らせることはもう無い。

## 2. テストが C: と本物の `<buildRoot>` に書く

- `apply-commits.test.mjs`: 通しの試しの作業ツリーを `<buildRoot>\wt\tests-ac-<pid>` から、試しの入れ物の直下の `acw-<pid>`（短い名前。vscode の木は深い）にした。常設の clone への `git worktree add` の登録は残る（clone は読む・登録するだけ）。終わりに作業ツリーのフォルダも消す。
- `apply-cli.test.mjs`: checks.json の出力先を `<buildRoot>\smoke\apply-cli` から、`makeSandbox` の入れ物にした（`after` で消す）。`<buildRoot>\wt\dev-apply` は読むだけのまま。
- `measure.tests.ps1`・`netaudit.tests.ps1`: 一時のファイルが `GetTempPath()`（=`%TEMP%`）に出るので、冒頭でこの PowerShell のプロセスだけ `TEMP`・`TMP` を `<リポジトリ>\tmp\tests-temp`（`AIED_TEST_TEMP` で変更可）に向けた。直接走らせても C: に出ない。
- 新規の netaudit の通常経路の試しは `<リポジトリ>\tmp\tests\` の下。
- 見張り（足した）:
  - `tests/build/guard-roots.mjs`（新規）: `C:\b`、`<リポジトリ>\tmp\b`、`local.json` の buildRoot の浅い木（深さ3）の名前・大きさ・更新時刻を前後で比べる。常設の clone の `.git`（`vscode\.git`）は git が読むだけでも動くので見ない。
  - `tests/run-all.mjs`: テストのファイルごと（`.test.mjs` と `.tests.ps1`）に前後で比べ、変わっていたらそのファイルを fail 1 にして、差を `Failing:` に出す。`--no-guard` で外せる。作って消しただけでも親フォルダの更新時刻が動くので見つかる。
  - `tests/move-off-c-fixes.test.mjs` の静的な検査: テストのコードで、`BUILD_ROOT`・`WT_DIR`・`SMOKE_DIR`・`NEW_DEFAULT`・`LEGACY`・`SMOKE_ROOT`・`DEFAULT_BUILD` を書き込みの関数に渡す行が無いこと、`C:\b` のリテラルを書き込みの関数に渡す行が無いこと、apply-commits・apply-cli・p1-scripts の形。
- 見張れていない所:
  - 見張りは run-all の中だけ。`node --test` を直接走らせたときは働かない。
  - 本物の `<buildRoot>` で本物のビルドや取り込みが同時に走っていると、誤って検出する。
  - 深さ4より下の変化は見えない（例: `C:\b\vscode\src\...` の中身）。
  - `os.tmpdir()` を使う `.test.mjs`（24ファイル）は、直接走らせると OS の temp（C:）に書く。run-all 経由は `tmp\tests-temp`。直すなら各ファイルの冒頭に1行足す必要があり、今回は触っていない。
  - `tmp\ws`（`Get-DefaultWorkspace`）は見張りの外。

## 3. 見張るテストの不足（直す点の5）

新規 `tests/move-off-c-fixes.test.mjs`。

- `LOCALAPPDATA`: `build.mjs --dry-run` の `envRedirectedForChildren` で、`toolchainSteps` が install・typecheck・package だけ、`all` に LOCALAPPDATA が無く、`toolchain` にはあって `all` を全部含み、全部 `<buildRoot>` の下。`childEnv` の `toolchain: true` の有無。`build.mjs` のソースで `envOf(name)` が `TOOLCHAIN_STEPS` で決まり、`toolEnv` を直接使う行が3行以内（増えたら落ちる）。
- take-in の `childTemp`（TEMP・TMP だけ、`<buildRoot>\tmp`）と監査の `-WorkRoot`（`<buildRoot>\audit`）、`-Label`。ソースで `CHILD_ENV` が `runLogged` の既定の環境であること。
- `applyEnvVars`: `Temp`・`tmp`・`NPM_CONFIG_CACHE`・`Pnpm_Config_Store_Dir` などを消してから入れ、1変数1つだけが残る。base を書き換えない。置き換えた名前を返す。undefined/null は入れない。`childEnv` と `tempEnvVars` 経由でも同じ。
- netaudit の正常な経路（`tests/netaudit.tests.ps1`、2件足した。113件）: `Start-EditorProcess`・`Get-ProcessSnapshot`・`Get-NetTCPConnection`・`Get-DnsClientCache`・`Stop-EditorTree`・`Start-Sleep` を偽物にして `Invoke-NetAudit` を最後まで走らせる。
  - ネットのログは読まれてから消える（`named-hosts.csv` にホストが入り、ログの置き場は空、`NetLogFilesRemoved` が true、URL の秘密 `SECRET123` はどの出力にも無い、実行のデータの置き場は消える）。
  - 読んだ後に開いたままのファイルがあると、記録を書いてから `could not remove the net log files after reading them` で止まり、残ったファイルが名前で出て、ほかは消え、`ALSO` で二重にならない。

## 4. 蒙恬の1〜3と追加の3点のテスト

- 取り込みの監査の名前（`move-off-c-fixes.test.mjs`）:
  - 11文字以下は通り、12文字以上は縮めて259文字以下（`take-in.mjs --dry-run` の計画の `-Label`・`-WorkRoot` から、既定の `<buildRoot>`（45文字）に換算して数える）。同じラベルは同じ名前、先頭が同じ別のラベルは別の名前。止める実装でも通る形にしてある。
  - `shortLabel`（smoke-net.mjs）と `tests/smoke/lib/common.mjs` の `shortLabel` が、ラベル6種×max 4種で同じ値を返す。
  - `NETAUDIT_FILE_LIMIT`=259、`NETAUDIT_CC_TAIL_LENGTH`=179（実測の尾の長さと一致）、`netauditPathCheck.longest` が実際のパスの長さと一致、どんなラベルでも既定の `<buildRoot>\audit` で ok。
  - 深い `<buildRoot>` の dry-run は止めずに `netauditRun.ok:false` と文字数を出す。dry-run でなく手順7を含む実行（`--from 7 --to 7`）は、終了コード 1 で止まり、buildRoot も `records/take-in/<label>` も作らない。
  - `tests/move-off-c.test.mjs` の最長のパスの見張りに取り込みの監査の分を足した（最長のラベル `NETAUDIT_LABEL_MAX` 文字で 259 以下、代表のラベル4種も）。
- `tests/move-build-root.test.mjs`（22件→32件）:
  - dir の SHA-256: 写し先に同じ大きさで中身だけ違うファイルがあれば problem（上書きしない）、`verifySame` が dir の同じ大きさの違いを見つける、記録に `seconds`・`verifySeconds` が数値で出て、dir は全ファイル（2個）を照らす。
  - 続き: 一部だけ写してある dir は同じものを飛ばして無いものだけを写す（`existing.same 1`・`missing 1`・`copied 1`、前からあったファイルの更新時刻が変わらない）、2回目は already。違うものが1つでもあれば problem で、無いものも写さず上書きもしない。途中で切れたファイル（小さい）は problem。`results` の項目も同じ。dry-run は何も写さず `planned` と `existing`。写し先だけにあるファイルは触らない。
  - `smoke-ext` の後に `smoke-baselines` を写しても problem にならない（両方 copied、2回目は両方 already）。
  - 既存の `verifySame` の試しは、`verifySame` が照らし済みを覚える実装でなくなったので、書き換えの後に選び直す形に直した（蒙恬の実装は毎回計算し直すので、結果は同じ）。
- 蒙恬の試しの残り `tmp\tests\meng-tian-mbr\` は、`move-off-c-fixes.test.mjs` の `after` が消す（試しの入れ物の中だけ）。

## 5. 実行結果

- `node tests/run-all.mjs --save tasks/2026-11-16-move-off-c-fixes/run-all-cao-shen.txt`（見張りを有効にして。終了コード 0）: **2646件、通った 2639、落ちた 0、飛ばした 7**（`removals.test.mjs` の元からの7件）。前の 2604件から 42件増えた（move-build-root +10、move-off-c-fixes 新規 29、move-off-c +1、netaudit +2）。
  - 見張り（本物の `C:\b`・`tmp\b`・local.json の buildRoot の前後比較）は全ファイルで差が無かった。つまり run-all は本物の作業場所に何も書かなかった。
  - この全体の走らせの途中で、並行して個別に流したので時間が長引いた（約1時間）。走らせの途中に足した蒙恬の頼み3点のテストも、当該ファイルが走った時点で入っていて、件数に含まれる。
- 個別: `netaudit.tests.ps1` 113件、`measure.tests.ps1` 141件、`move-build-root.test.mjs` 32件、`move-off-c-fixes.test.mjs` 29件、`move-off-c.test.mjs` 26件、`p1-scripts.test.mjs` 34件、apply* 162件、take-in* 138件、すべて fail 0。

## 5b. 2回目: テストの一時ファイルを C: に出さない（未解決の1の直し）

- 新規 `tests/build/temp-root.mjs`: 読み込まれた時点で、このプロセスの `TEMP`・`TMP` を `<リポジトリ>\tmp\tests-temp`（`AIED_TEST_TEMP` で変更可）に向け、フォルダを作る。子のプロセスにも引き継がれる。利用者の全体の環境変数は変えない。
- `os.tmpdir()` を使う 23 ファイルの冒頭に `import './build/temp-root.mjs';` を1行ずつ足した（absent、c1-round2、c1-mutation、c2〜c7 の mutation・worktree、c3〜c7 の check-json、notion-sync、smoke、watch）。依頼文の「24」は数え違いで、実際は23。見張りのテストが `.test.mjs` を全部走査するので、取りこぼしは出ない。
- import の順: `os.tmpdir()` を読み込み時（モジュールの先頭）に呼ぶ所は無く、すべてテストの本体の中で呼ぶ。それでも、ほかの import より前に評価されるよう、`node:os` の import の直前に置いた。見張りのテストは、temp-root の import が最初の `tmpdir()` の行より前で、import の群の中にあることを確かめる。
- 見張り（`tests/move-off-c-fixes.test.mjs`、2件足した。31件）:
  1. `os.tmpdir()` を使う tests の `.test.mjs`（20個以上）は全部 temp-root を読み込んでいる。
  2. temp-root を読み込む子のプロセスを、`TEMP`・`TMP` が `C:\Windows\Temp` の環境で起こし、`os.tmpdir()`・`TEMP`・`TMP` が `<リポジトリ>\tmp\tests-temp` を返す。
- 直接走らせる確かめ: `node --test tests/move-off-c-fixes.test.mjs tests/c2-worktree.test.mjs`（run-all を通さない）が通った。上の2が、直接走らせても `os.tmpdir()` が `tmp\tests-temp` を返すことの確かめ。
- run-all: `node tests/run-all.mjs --save tasks/2026-11-16-move-off-c-fixes/run-all-cao-shen-2.txt`（見張り有効、終了コード 0）: **2648件、通った 2641、落ちた 0、飛ばした 7**（`removals.test.mjs` の元からの7件）。前の 2646件から 2件増えた（上の見張り2件）。本物の `C:\b`・`tmp\b` の見張りも差なし。足した import を持つ23ファイルは、個別にも走らせて全部 fail 0。
- 未解決の1（os.tmpdir を使う .test.mjs を直接走らせたときの C: への書き込み）は、これで解決。6節の1は無効。

## 5c. 3回目: 見張りの穴と説明文（verification-ooka.md の直す点1・2）

- `tests/build/guard-roots.mjs`: `snapshotRoot` が根そのものの更新時刻をキー `.` で記録するようにした。根の直下に作って消した跡も、`変わった .` として見つかる。
- `tests/move-off-c-fixes.test.mjs`: 根の直下で作って消す試し（中身のある根と、空の根）を1件足した（31件→32件）。
- `tests/apply-commits.test.mjs` の冒頭の説明を、作業ツリーは `<リポジトリ>\tmp\tests\acw-<pid>` に作る、に直した。
- 確かめ: `node --test tests/move-off-c-fixes.test.mjs tests/apply-commits.test.mjs` で 57件、通った 57、落ちた 0。run-all は走らせていない（指示どおり）。

## 6. 未解決の点・知らせ

1. `os.tmpdir()` を使う24ファイルを直接走らせたときの C: への書き込み（2節の見張れていない所）。直すかの判断を仰ぐ。
2. 見張りは深さ3まで。深くしたいなら `snapshotAll(roots, maxDepth)` の引数を変えるが、本物の clone の木だと遅くなる。
3. `tests/removals/c1〜c7-gate-script.md`・`probe-*.ps1` は、前の依頼のまま触っていない（関門の前にリーダーが書き直す）。
4. 権限: この作業では `ls`・`git -C` が許可に無く使えなかった（`git status` などは使える）。バックグラウンドの出力ファイルは読めなかった。変更は求めない。
5. 実装の不具合・仕様の食い違いは見つからなかった（落ちたテストは、自分の書き方の誤りが1件〈verifySame の覚え〉だけで、直した）。

## 7. 成果物

- 新規: `tests/move-off-c-fixes.test.mjs`、`tests/build/guard-roots.mjs`
- 直した: `tests/p1-scripts.test.mjs`、`tests/apply-commits.test.mjs`、`tests/apply-cli.test.mjs`、`tests/run-all.mjs`、`tests/move-build-root.test.mjs`、`tests/move-off-c.test.mjs`、`tests/netaudit.tests.ps1`、`tests/measure.tests.ps1`

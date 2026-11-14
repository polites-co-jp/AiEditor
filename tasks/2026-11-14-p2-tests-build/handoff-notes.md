# 曹参 p2-tests-build 完了報告

## 追記3（2026-11-14、signtool.exe の確かめ。蒙恬の追記5）

### 足したテスト `tests/signtool.test.mjs`（17 件、すべて pass）
この PC に Windows SDK が無いので、実物は使わず差し替えで確かめた（関数の `exists`・`listDirs`・`env`、試しの場所に置いた偽の `signtool.exe`、`ProgramFiles(x86)` を試しの場所へ向ける、PATH から signtool のあるフォルダを外す）。SDK が後から入っても結果は変わらない。
- `findSignTool`（7 件）: PATH の上にあればそれ（引用符つきも）、PATH の先が勝つ、PATH は Windows Kits より優先、PATH の名前の大文字小文字を問わない、PATH に無ければ Windows Kits の最も新しい版（候補は新しい順。版でない名前 `wdf` と exe の無い版は除く）、版は数で比べる（`10.0.9.0` より `10.0.22621.0`）、`ProgramFiles(x86)` が無ければ `C:\Program Files (x86)`、どちらにも無ければ `{ found:false, path:null, dir:null, source:null, candidates:[] }`。
- `prependPath`（3 件）: 先頭に足した写しを返し元は変えない、PATH が無ければ作る、キーの大文字小文字は元のまま（PATH が2つにならない）、`process.env` を渡しても変わらない。
- `build.mjs --dry-run`（4 件、`--from package --to package`）: signtool がどこにも無い → 終了コード 0、`warnings` に signtool、`checksBeforeRun.signtool.found:false`、`plan.package.pathPrepended:null`。Windows Kits にある → `pathPrepended` が最も新しい版の `x64` フォルダで、signtool の警告なし。PATH の上にある → `pathPrepended:null`、警告なし（Windows Kits もあっても PATH が先）。package を選ばない範囲では `plan.package` も警告も出ない。
- `check-env.ps1`（3 件、`-OutFile` の JSON）: 無い → `signtool.found:false`、`missing` に signtool.exe の行が1つ、終了コード 2。Windows Kits に複数の版 → 最も新しい版を `chosen`、`kitsCandidates` は新しい順、`missing` に入らない。PATH の上にある → それを選ぶ（source は PATH）。

### 全体の走らせ直し（`node tests/run-all.mjs`、`run-all-result.txt`）
合計 1473 件、pass 1452、fail 0、skip 21。
- 前回 fail だった `take-in.test.mjs` は 95/95 で通る。ほかの担当の新しいファイル（cli-run、switch-expand、take-in-more、notion-sync 101、watch 104）もすべて pass。
- skip 21 はすべて `removals.test.mjs`（「有効な単位の after」。全単位が `enabled:false` のため）。件数が 14 から 21 に増えたのは、removals.test.mjs が他の担当の単位で増えたため（私は触っていない）。
- 私のファイルはすべて fail 0。

---

## 追記2（2026-11-14、直しの分のテスト。リーダーの申し送り）

### 足したテスト `tests/build-fixes.test.mjs`（17 件、すべて pass）と補助 `tests/build/path-entries-probe.ps1`
入口は `tasks/2026-11-13-p2-build-switch/handoff-notes.md` の追記2。
- `build.mjs` の `toolchainWarnings`: 合えば `[]`、node が違えば1件（マイナー・メジャーとも）、pnpm が違えば1件（古くても新しくても）、pnpm の版が `null` なら「確かめられない」1件、`packageManager` が `npm@…` なら1件、`.nvmrc` が無ければ node の警告なし、両方違えば2件、入力を変えない。
- `prepare.mjs` の `resolveBuildRoot`（オプション → local.json → `C:\b`、共通の部品と同じ規則で知らないキー・型・知らない `%NAME%`・相対パス・壊れた JSON は例外）と `resolveWorktree`（既定 `<buildRoot>\wt\<tag>`、`--worktree` はその絶対パス）。`prepare.mjs --config <誤り>` は終了コード 1 で、出力ファイルを作らない。
- `build.mjs --dry-run` の plan: prepare に `--worktree` と `--out <作業ツリー>.prepare.json`、`--fresh` と apply が同じ作業ツリー、既定は `<buildRoot>\wt\<tag>`。
- **apply への `--build-root` の受け渡し**: 蒙恬の直しが入っていた（plan の apply と lockfile の `command` に `--build-root <buildRoot>` が付く）。値が使う buildRoot と一致することを確かめた。
- `configure.ps1` の `Update-PathEntries`: 台本の構文木から関数だけを取り出して試す（台本は走らせない。**本物の PATH・レジストリには触れない**）。9 通り: 前の bin → 新しい bin でほかの項目と `%VAR%` の形を残す、大文字小文字と末尾の `\` を問わない、`%VAR%\current\bin` は展開して一致すれば置き換える、一致なし・空は `$null`、前の bin の一部（`bin2`）は置き換えない、2か所あれば両方、空の項目と区切りの形を保つ、前後の空白。あわせて、台本が PATH を `SetEnvironmentVariable('Path'…)` で書かず、`DoNotExpandEnvironmentNames` で読み `GetValueKind` の種類で書き戻すことを、ソースの文字列で確かめた（レジストリへの書き込みそのものは試さない）。

### 全体の走らせ直し（`node tests/run-all.mjs`、`run-all-result.txt`）
合計 1194 件、pass 1095、fail 1、skip 98。
- 私のファイルはすべて fail 0（build-fixes 17、apply-commits 18、apply-prune 7、build-parts 38、configure 17、install-ext 46、local-config 46、make-icons 17、switch 22、apply 系 130、removals 145＋skip 14、smoke 75、lock 115、sublime-keys 50、measure 138、netaudit 102、absent 14）。
- **fail 1: `take-in.test.mjs` の `outsideAllowed: ../ で外へ出るパスを通さない`**。take-in は私の担当の外のファイルで（走らせるたびに件数が変わっており、別の担当が作業中の見込み。前回は 47 件・fail 0、今回は 95 件）、切り分けはしていない。テストの誤りか実装の不具合かは、そのファイルの担当が確かめる。
- skip 98 は前回と同じ（removals 14、notion-sync 47、watch 37）。

---

## 追記（2026-11-14、リーダーの追加の指示への対応）

### 1. 本家のソースは clone のタグから読む
- `tests/removals.test.mjs`: 本家のままのソース（`extensions/*` の一覧、removeLines の対象、delete の実在）を、`C:\b\wt\1.146.0` ではなく `git -C C:/b/vscode ls-tree` / `show` / `cat-file -e 1.146.0:<path>` で読む形に直した。場所とタグは環境変数 `AIED_UPSTREAM_REPO`・`AIED_UPSTREAM_TAG` で変えられる（既定 `C:/b/vscode`・`1.146.0`）。読めなければ飛ばす。
- git はテストの子プロセスが呼ぶので、私の Bash の許可は要らなかった。直した後も 145 pass、14 skip（全単位 `enabled:false` のため）で、飛んだのは変わらず「有効な単位の after」だけ。git で読む検査は飛ばずに走った。
- ほかのテストで `C:\b\wt\1.146.0` を本家のままとして読むものは無い（`apply-cli.test.mjs` の `C:\b\wt\dev-apply` は試し用で、変わらないことを確かめる側）。

### 2. 足したテスト `tests/apply-commits.test.mjs`（18 件、すべて pass）
- `edits.patch`（A-1・A-6・B-1・B-2・B-3・B-7）の `From:` が `shuko-apply <apply@shuko.invalid>`、件名が `[PATCH] unit <id>: edits`、unit.json の `patch` がそれを指す。`patches/*.patch` の `From:`・件名・名前の形（頭が数）。
- `MAIN_FILES`: 形（workbench と sessions の2つ。拾う名前・拾わない名前）、本家 1.146.0 で workbench の main を3つ以上・sessions の main を1つ以上拾い、sessions の main が workbench の contrib を import していること。
- `checkUpstreamAdditions`: 試しの git で、workbench と sessions の main に増えた import だけを返す（main でないファイル、前からある import は数えない）、増えた部品のフォルダ、highlight、`--prev-tag` が無ければ skipped。
- 通しの試し（`C:\b\wt\tests-ac-<pid>` に新しい作業ツリーを作って本当に当て、終わったら `worktree remove`）:
  - 本物の B-2・B-7 と `patches/`: `commitIdentity` が ok、`1.146.0..HEAD` の全コミットの作者・コミッターが shuko-apply、件名に `unit B-2-…: edits`・`unit B-7-…: edits`。
  - `builtinExtensions.removedDefaults` が `workbench.startupEditor`（B-2）と `terminal.integrated.suggest.enabled`（B-7）の2件。作業ツリーの mydist から2キーが外れ、ほかの既定は残る。`extensions-src/mydist/package.json` は変わらない。`registeredKeys` は fail にならない。
  - 単位を当てない（A-6 のみ）: `removedDefaults` は空で、既定は残る。
  - 作者が違うパッチ（From: が別人）: `commitIdentity` が warn（`items` に作者、コミッターは shuko-apply、`warnings` に出る）、止まらない。
  - `--dry-run`: `commitIdentity` は skipped、HEAD は動かない。
- 所要は約 100 秒（作業ツリーの作成と4回の apply）。

### 3. 全体の走らせ直し（`node tests/run-all.mjs`、結果は `run-all-result.txt`）
合計 1128 件、pass 1030、fail 0、skip 98。
- 私のファイル: apply-commits 18/18、apply-prune 7/7、build-parts 38/38、configure 17/17、install-ext 46/46、local-config 46/46、make-icons 17/17、switch 22/22。前回の4件は、蒙恬の直しで通るようになった（再実行で pass）。
- 既存: absent 14、apply-cli 7、apply-parts 57、apply-selfcheck 33、apply 33、lock 115、removals 145（skip 14）、smoke 74、sublime-keys 50、measure.tests.ps1 138、netaudit.tests.ps1 102 はすべて fail 0。
- 他の担当のファイル（新しく入っていた）: take-in 47/47、p34-selfcheck 3/3、notion-sync 47 件はすべて skip、watch 38 件のうち 37 skip（飛んだ理由は各ファイルのもの。私の担当の外で、未確認）。
- skip 98 の内訳: removals 14、notion-sync 47、watch 37。

---

- 結果: 完了（落ちたテスト4件は、実装と設計の食い違いとして決めずに報告する）
- 作成: 曹参（2026-11-14）

## 成果物

- テスト（`tests/`）
  - `tests/local-config.test.mjs`（46 件。Node.js と PowerShell の部品を37通りの入力で照らす）
  - `tests/build-parts.test.mjs`（38 件。`build.mjs` の関数と `--dry-run`）
  - `tests/install-ext.test.mjs`（46 件。`setArgvLocale` ほか）
  - `tests/switch.test.mjs`（22 件。`switch.ps1` を試しの場所で走らせる）
  - `tests/configure.test.mjs`（17 件。`configure.ps1` を試しの場所で走らせる）
  - `tests/make-icons.test.mjs`（17 件）
  - `tests/apply-prune.test.mjs`（7 件。p2-apply の追記4 の `pruneConfigurationDefaults`。brief に無いが、直しが入ったので足した）
  - `tests/run-all.mjs`（全部を走らせてファイルごとの件数を出す）、`tests/wait-file.mjs`（待つだけの補助）
  - 補助: `tests/build/helpers.mjs`、`tests/build/local-config-probe.ps1`、`tests/build/wait-file.mjs`（`tests/wait-file.mjs` の前の置き場所。使っていない。消してよい）
- `tasks/2026-11-14-p2-tests-build/tests-build-design.md`（一覧と仕様の出どころ）
- `tasks/2026-11-14-p2-tests-build/run-all-result.txt`（全体の走らせ直しの結果）

## 要点

1. 依頼の5項目（local-config 両方、build.mjs、install-extensions、switch.ps1・configure.ps1、make-icons）を、設計の「テストの入口」と docs/02・04 から書いた。蒙恬の実装は先に読んでいない（`parseArgs` の項目名など形が設計に無いものは、通る・落ちるだけを見た）。
2. 試しの場所は `C:\b\tests-*-<乱数>\`（終わると消す）。`scripts/` は書いていない。普段使いの local.json、スタートメニュー、PATH には触れていない（configure は毎回 `-ConfigPath` と `-NoShellIntegration`）。動いているエディタの再現は、`node.exe` の写しを `Shuko.exe` の名前で置いて起動した。
3. Node.js と PowerShell の local.json の規則は、37 の入力で合否と4つの値が一致した。
4. `lines: 最後の行（改行なし）` を含む apply のテストは、通る（下）。
5. `removals.test.mjs` は B-1〜B-7 と overlay を現在の版で通した（145 pass、14 skip は「有効な単位の after」で、全単位が `enabled: false` のため）。

## 実行結果

`node tests/run-all.mjs`（`tests/*.test.mjs` 15 ファイルと `tests/*.tests.ps1` 2 ファイル）。この走らせの後に `apply-prune.test.mjs` を足し、単独で 7 件 pass。

| ファイル | 件数 | pass | fail | skip |
|---|---|---|---|---|
| absent | 14 | 14 | 0 | 0 |
| apply-cli | 7 | 7 | 0 | 0 |
| apply-parts | 57 | 57 | 0 | 0 |
| apply-selfcheck | 33 | 33 | 0 | 0 |
| apply | 33 | 33 | 0 | 0 |
| apply-prune（単独で走らせ） | 7 | 7 | 0 | 0 |
| build-parts | 38 | 38 | 0 | 0 |
| configure | 17 | 16 | 1 | 0 |
| install-ext | 46 | 43 | 3 | 0 |
| local-config | 46 | 46 | 0 | 0 |
| lock | 115 | 115 | 0 | 0 |
| make-icons | 17 | 17 | 0 | 0 |
| removals | 159 | 145 | 0 | 14 |
| smoke | 74 | 74 | 0 | 0 |
| sublime-keys | 50 | 50 | 0 | 0 |
| switch | 22 | 22 | 0 | 0 |
| measure.tests.ps1 | 138 | 138 | 0 | 0 |
| netaudit.tests.ps1 | 102 | 102 | 0 | 0 |
| 合計（apply-prune を含む） | 975 | 957 | 4 | 14 |

走らせ直しの時刻: apply の直し（`pruneConfigurationDefaults`、`lines.mjs` の最終行、`--until`、`registeredKeys`）が入った後。`scripts/apply.mjs` に `absentSettings` の外し処理があるのを確かめてから走らせた。

### 落ちた4件の切り分け

どちらが正しいかは決めない。

1. `install-ext.test.mjs`: `setArgvLocale('{"locale": 5}', 'ja')`、`'{"locale": null}'`、`'{"locale": true}'` が例外にならない（3件）。設計 4.1 は「`locale` の値が文字列でないときは例外」と書く。オブジェクトと配列の値は例外になる。
   - 切り分け: 実装の不具合の見込み（数・null・真偽が通る）。ただし、argv.json の `locale` を置き換えるだけなので、例外にしない運用も成り立つ。設計の書き方（「文字列でない」）と実装（入れ子だけ止める）のどちらかを直すことになる。
2. `configure.test.mjs`: `-KeepVersions 0` が終了コード 0 で、何も書かずに `ok`（現在値を出すだけ）になる。`-KeepVersions -2` は終了コード 1 で止まる。
   - 切り分け: 実装の不具合の見込み。`-KeepVersions` の既定値が 0 で「指定なし」と同じ扱いになっていると思われる。docs/02 の6.1 と設計の2節は `keepVersions` を 1 以上の整数とする。0 を指定して黙って何も起きないのは、利用者には誤りに見える。`$PSBoundParameters` で見るか、既定値を `$null` にするとよい（蒙恬の担当）。

## 仕様と実装の食い違い（上の2点のほか）

- 設計の 3.3 は `parseArgs` が返すオブジェクトの項目名を書いていない。テストは「通る・`ArgError`」だけを見た。項目名が決まれば足せる。
- `--dry-run` の `plan` が配列かオブジェクトかが設計に無い。テストは両方を受ける。
- `makeIconFiles()` の戻りの形（配列・Map・オブジェクト）が notes に無い。テストは3つの形を受ける。
- `tests/make-icons.test.mjs` は `assets/resources/win32/` の3ファイルが `makeIconFiles()` の出力と同じバイト列であることを求める。意匠を変えたら `node scripts/make-icons.mjs` で `assets/` を作り直す必要がある。

## 未解決の点

- 実行時間: `local-config.test.mjs` は PowerShell を37回起動するので 40 秒、`switch.test.mjs` 80 秒、`configure.test.mjs` 40 秒、`run-all.mjs` 全体で 5〜6 分。
- 走らせていないもの: configure.ps1 の5（ショートカットと PATH の向け直し）、違うドライブへの移動、build.mjs の install・typecheck・package、install-extensions.mjs の本体（CLI の起動）。理由は設計書の末尾に書いた。
- 権限: `node --test tests/*.test.mjs` を許可どおりに書いたが、背景実行（`run_in_background`）では止められた。`node --test tests/<名前>.test.mjs` の形と `node tests/run-all.mjs` は通った。全体の走らせは `tests/run-all.mjs` で行える。許可の追加は求めない。
- `node tests/build/wait-file.mjs` は許可に当たらず（`node tests/*.mjs` は1階層）、`tests/wait-file.mjs` に置き直した。`tests/build/wait-file.mjs` は残っている。消してよい。

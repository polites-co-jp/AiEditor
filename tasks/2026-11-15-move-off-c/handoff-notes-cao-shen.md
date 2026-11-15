# C: から移す直しのテスト（曹参の引き継ぎ）

- 担当: cao-shen（曹参）
- 状態: 1回目は、蒙恬の scripts/ の直しが入る前に仕様（brief と docs/02 の6.1）から書いた（その時点では新しいテストが落ちた）。**2回目（下の節）で蒙恬の直しに合わせ、全部通る状態にした。** 古い「落ちる」の記述は1回目の時点のもの。
- 蒙恬の handoff-notes は、1回目を書いた時点でまだ無かった。

## 想定した入口（実装より先に書いた）

1. `scripts/lib/local-config.mjs` の `DEFAULTS.buildRoot` と `resolveLocalConfig`: 既定は `<リポジトリ>\tmp\b`（brief の候補。絶対パス、C: でない、空白と ASCII 以外なし）。優先は「オプション → local.json → 既定」のまま。local.json に `C:\b` と書いてあればそれが勝つ。PowerShell 側（`local-config.ps1`）も `configure.ps1` の出力で同じ値を確かめる。
2. `scripts/build.mjs` の `childEnv(base, extra, { buildRoot })`（第3引数。文字列で渡す形も受ける）: 子の環境の `TEMP`・`TMP`・`npm_config_cache`・`npm_config_store_dir`（pnpm の store）を `<buildRoot>` の下に向ける。向け先の名前は決まっていないので「`<buildRoot>` の下であること」だけを確かめる。`TEMP` と `TMP` は同じ、各向け先は別のフォルダ。electron・electron-builder・node-gyp などは環境変数で向けられないことがある（蒙恬の調べ）ので必須にせず、`ELECTRON_CACHE`・`ELECTRON_BUILDER_CACHE`・`npm_config_devdir` などが出ているなら `<buildRoot>` の下、という確かめだけにした。`LOCALAPPDATA` は変えない（秘密と普段使いのデータの場所）。これまでの外す変数（`VSCODE_*` など）・base を書き換えないこと・extra が勝つことも確かめる。
3. `scripts/` と `tools/` のコード行（コメント以外）に `C:\b`・`C:/b` を文字で持たない。`os.tmpdir()`・`GetTempPath`・`$env:TEMP` も使わない。**例外は `scripts/move-survey.mjs` だけ**（古い置き場所を読むのが仕事）。

入口の形が違えば、`tests/move-off-c.test.mjs` の `callChildEnv` と `REDIRECTED`/`OPTIONAL`、`tests/build/root.mjs` の `NEW_DEFAULT` の3か所だけ直せばよい。

## 成果物

- 新規 `tests/move-off-c.test.mjs`（15件。上の1〜3）
- 新規 `tests/build/root.mjs`（テストが使う置き場所の1か所の定義）
  - `NEW_DEFAULT` = `<リポジトリ>\tmp\b`。既定の値を確かめるテストはこれを使う。
  - `BUILD_ROOT` = 環境変数 `AIED_BUILD_ROOT`、無ければ `<root>\vscode`（常設の clone）がある方（新しい既定 → `C:\b` の順）、どちらも無ければ新しい既定。本物の clone・作業ツリーを読むテストはこれを使う。移す前（`C:\b` に実体がある間）も、移した後（`tmp\b` に実体がある）も、同じテストが動く。
  - `UPSTREAM_REPO`（`AIED_UPSTREAM_REPO` が優先）、`WT_DIR`、`SMOKE_DIR`。
- 直したテスト（`C:\b`・`C:/b` の期待を新しい既定か `BUILD_ROOT` へ）:
  - 既定を確かめるもの: `local-config.test.mjs`（Node と PowerShell の共通ケースを含む。ドライブ文字の大文字小文字は区別しない比べ方にした）、`build-fixes.test.mjs`（`resolveBuildRoot`・`resolveWorktree`）、`configure.test.mjs`、`smoke.test.mjs`（`parseArgs` の既定の `--build`、`resolveVsixRoot`、`vsixRootFor`）
  - 本家の clone・作業ツリーを読むもの: `c1-unit`・`c1-round2`・`c2〜c7` の `-unit`・`-worktree`・`-mutation`、`removals.test`、`apply-commits.test`（通しの試しの作業ツリーも `<buildRoot>\wt\`）、`apply-cli.test`
  - 文字列の部品の試し（どの根でも同じ結果）: `take-in.test`、`take-in-more.test`、`install-ext.test`、`build-parts.test`
- `tests/build/helpers.mjs` の試しの入れ物: これまでは `C:\b` があれば `C:\b`、無ければ OS の temp だった。今は `<リポジトリ>\tmp\tests\`（`AIED_TEST_TEMP` ではなく `AIED_TEST_TMP` で変えられる）。
- `tests/run-all.mjs`: 子のプロセスの `TEMP`・`TMP` を `<リポジトリ>\tmp\tests-temp\`（`AIED_TEST_TEMP` で変えられる）に向ける。`os.tmpdir()` を使うテスト（約20ファイル）の一時のファイルが C: に出ない。利用者の全体の環境変数は変えない（子の環境だけ）。`node --test` を直接走らせたときは、これまでどおり OS の temp。
- `tests/smoke/lib/common.mjs`: `SMOKE_ROOT`・`DEFAULT_BUILD`（`<buildRoot>\p0\vscode-1.146.0`）を、固定の `C:\b\...` から「`resolveLocalConfig` の buildRoot の下」に変えた（local.json が壊れていれば既定）。`smoke-launch.mjs`・`smoke-stop.mjs`・`removals/run-absent.mjs` はこれを使うので、実行の置き場所が `<buildRoot>\smoke` に移る。

## 実行結果

- `node --test tests/move-off-c.test.mjs`（蒙恬の直しが入る前）: 15件、通った 7、落ちた 8。落ちた8件はすべて「仕様の期待に実装がまだ追いついていない」もの（実装の不具合ではなく、未着手）。
  - 既定の buildRoot が `C:\b` のまま（Node 側 2件、PowerShell 側 1件）
  - `childEnv` が TEMP・キャッシュを向けない（3件）
  - コード行に `C:\b` が残る（下の一覧）／`os.tmpdir` 等（`move-survey.mjs` 以外は無し、除外後はこの1件は通る見込み）
- 直した既存テストを個別に流した結果: `local-config`（既定のところ以外）、`build-fixes`、`configure`、`smoke`、`take-in*`、`install-ext`、`build-parts`、`c2-*`（140件全部通過）は、既定の期待が変わるもの以外は通る。既定の期待に直したもの（`build-fixes` の `resolveBuildRoot`、`configure` の「引数なし」、`local-config` の既定の3件）は、蒙恬の直しが入るまで落ちる。
- `node tests/run-all.mjs --save <ファイル>` の全体の件数: **この書き物を書いた時点では出せていない**。最初の全体の走らせ（直す前の基準）が長引いて（`adopt` の試しだけで数分）終わっていない。蒙恬の直しが入ったあと、リーダーか大岡越前守が `node tests/run-all.mjs --save tasks/2026-11-15-move-off-c/run-all-after.json` を走らせて fail 0 を確かめてほしい。

## 蒙恬の直しが入るまで落ちる／直す必要があるもの（未解決の点）

`scripts/` のコード行に今 `C:\b` が残っている所（`tests/move-off-c.test.mjs` の静的な検査が出す一覧）:

- `scripts/lib/local-config.mjs`（`DEFAULTS.buildRoot`）、`scripts/lib/local-config.ps1`、`scripts/check-env.ps1`（`-BuildRoot` の既定）
- `scripts/measure.ps1`（`WorkRoot`・`InfoPath` の既定、`P0DefaultRunRoot`、削除してよい根の判定と文言）、`scripts/netaudit.ps1`（`WorkRoot` の既定）
- `scripts/p1-launch-check.ps1`（`$p1Root`・`$destRoots`・`-Root` の判定と文言）
- `scripts/p0-*.ps1`・`p0-*.mjs`・`lib/p0-common.ps1`（Phase 0 の道具。`C:\b\p0` 決め打ち）、`scripts/convert-sublime-keys.mjs`（既定 `C:/b/p0/sublime`）

Phase 0 の道具を直す範囲は brief に書かれていない。直さないなら、`tests/move-off-c.test.mjs` の静的な検査の例外に足す（SURVEY と同じ書き方）か、リーダーが範囲を決める。**決めずに報告する。**

テスト側で、台本の直しを待っているもの（今は `C:\b` のまま。台本が `<buildRoot>` を取る形に変わったら合わせる）:

- `tests/measure.tests.ps1`（22か所）、`tests/netaudit.tests.ps1`（2か所）: 台本の `C:\b\p0\run` の根の判定を試している。台本の既定が `<buildRoot>\p0\run` になれば、期待もそれに。
- `tests/p1-scripts.test.mjs`（24か所）: `p1-launch-check.ps1` の「`C:\b\p1` と `C:\b\p2` の外は断る」文言と判定を試している。台本の判定が変われば直す。`fs.existsSync('C:\\b')` で飛ばす所もある。
- `tests/probe-launch.ps1`・`probe-netlog*.ps1`・`probe-nodedebug.ps1`（試し用の道具。`C:\b` の実体を読む）。
- `tests/removals/c1〜c7-gate-script.md`（関門の手順書。`C:\b\wt\p2` などの実行時の置き場所を書いている）、`tests/smoke/lib/env.mjs` と `run.mjs` のコメント・使い方の文（`C:\b` の言及）。移した後の実体に合わせて、リーダーか大岡越前守が関門の前に書き直す必要がある。
- `tests/signtool.test.mjs` の `C:\b` は PATH の中の例の文字列で、buildRoot と関係ない。直さない。

## 2回目（リーダーの判断を受けて。docs/user-decisions.md の「C: から移す直しの範囲」）

### やったこと

1. **scripts/measure.ps1・netaudit.ps1（曹参の担当になった）**: `C:\b` の決め打ちを外した。
   - `-WorkRoot` の既定値を無くし（param に既定を書くと `$PSScriptRoot` が空になるため）、本体で `<buildRoot>\p0\run` を決める（`Get-DefaultWorkRoot`）。`<buildRoot>` は `scripts/lib/local-config.ps1` の `Resolve-ShukoLocalConfig` で読む（local.json → 既定 `<リポジトリ>\tmp\b`。壊れた local.json は止める）。
   - `Get-DefaultBuildRoot`・`Get-DefaultWorkRoot`（どちらも `-ConfigPath` で試しの local.json を渡せる）を足した。`Get-DefaultOpenFiles` の ws-info.json は `<buildRoot>\p0\ws-info.json`。
   - `Test-CleanableRoot` の「掃除してよい根」は、固定の `C:\b\p0\run` をやめて「既定の作業の根 `<buildRoot>\p0\run` かその下、または目印ファイル `.p0-run-root` がある所」にした。試しのために `-DefaultRoot` を取る。拒む文言も同じ根を出す。
   - netaudit のネットのログの置き場 `<WorkRoot の親>\netlog` は `<buildRoot>\p0\netlog`（git 管理外の `tmp/` の下）になった。秘密を含みうるので、追跡されるフォルダには置かない、という点は変わらない（コメントを直した）。
   - 2本とも ASCII のまま（PowerShell 5.1 の読み込みの都合）。
2. **tests/measure.tests.ps1・netaudit.tests.ps1** の期待を合わせた。
   - 既定の根は `<リポジトリ>\tmp\b\p0\run`（C: でない）、local.json の buildRoot が勝つ、壊れた local.json は止める、掃除してよい根の判定（`D:\bt\p0\run` を `-DefaultRoot` に渡して決まった結果にした。実際の `C:\b\p0\run` に今ある目印ファイルに左右されない）、`<buildRoot>\p0` を `-WorkRoot` にすると `-CleanStale` が拒む、の4件を足した／直した。
   - netaudit.tests.ps1 に、2本の param の `-WorkRoot` に既定値が無いことと、文字列に `C:\b` が無いことを構文木で確かめる2件を足した。
   - 文字列の部品の試し（コマンドラインの例など、根に左右されないもの）の `C:\b\p0\...` は残してある。
3. **静的な検査の例外**: `tests/move-off-c.test.mjs` の `C:\b` 検査から Phase 0 だけの道具（`scripts/p0-*.ps1`・`p0-*.mjs`・`lib/p0-common.ps1`）を外した。理由は「Phase 0 は閉じ、今は走らせない」。例外は `move-survey.mjs` と合わせて2つ。
4. **p1-scripts.test.mjs**（蒙恬の p1-launch-check.ps1 の直しに合わせた）: 台本が `<buildRoot>` を local.json から読むので、試しは `LOCALAPPDATA` を空の一時の場所に向けて走らせる（利用者の実際の local.json を読まない。既定の `<リポジトリ>\tmp\b` になる）。拒む文言は `outside <buildRoot>\p1 and <buildRoot>\p2` に変わったので期待を直した。`C:\b` が無ければ飛ばす条件は外した。`-Root` の試しは、`<buildRoot>` の下に一時の入れ物を作って終わりに消す形にした。local.json の buildRoot が効くこと（`C:\b\p1` を出さないこと）を確かめる試しを1件足した。
5. **childEnv の実際の入口に合わせた**: 蒙恬の実装は `childEnv(base, extra, { buildRoot, toolchain })`（文字列でも可）で、pnpm の変数は `pnpm_config_store_dir`・`pnpm_config_cache_dir`（pnpm 11 以降は `pnpm_config_*` だけを読む）、`npm_config_cache`、TEMP・TMP は `<buildRoot>\tmp`。`tests/move-off-c.test.mjs` の必須の変数を `npm_config_store_dir` から `pnpm_config_*` に直し、`toolchain: true` で LOCALAPPDATA も向く／省けば何も向けない、の試しを足した。これで想定の入口の食い違いは解けた。

6. **試しの一時の場所が、このリポジトリの中になった副作用を直した**: `tests/build/helpers.mjs` の入れ物と run-all の TEMP を `<リポジトリ>\tmp\` の下にしたため、「git のリポジトリでない場所」を作る試し（`build-commit.test.mjs` の `headCommitOf`）が、上の階の `<リポジトリ>\.git` を見つけて落ちた。`GIT_CEILING_DIRECTORIES=<リポジトリ>` を `helpers.mjs` の読み込み時と run-all の子の環境に足して直した（`<リポジトリ>` そのものの中で走らせる git には効かない）。
7. `tests/build-parts.test.mjs` の `--dry-run` の既定の buildRoot（小文字の `c:\b` を比べていたため、1回目に見落とした）を新しい既定に直した。

### 実行結果

- `node tests/run-all.mjs --only measure`: 141件、通った 141。`--only netaudit`: 104件、通った 104（直した後。netaudit は新しい2件を含む）。
- `tests/move-off-c.test.mjs`: 17件、通った 17（静的な検査の `C:\b` も、Phase 0 と move-survey を除いて 0 か所）。
- `tests/p1-scripts.test.mjs`: 34件、通った 34。
- 個別: apply* 162件、take-in* 138件、smoke 75件、switch* 49件、notion-sync 101件、watch* 114件、c2-* 140件、すべて fail 0。
- 直す途中に1回だけ全体を走らせた基準（`run-all-before.json`。走っている間に直しも入ったので、混ざった状態）: 2550件、通った 2542、落ちた 1、飛ばした 7。落ちた1件は p1-scripts の `-Root` の試し（上の4で直した）。
- **最後の全体の走らせ（`node tests/run-all.mjs --save tasks/2026-11-15-move-off-c/run-all-after.txt`、終了コード 0）: 2567件、通った 2560、落ちた 0、飛ばした 7。** 飛ばした7件は `removals.test.mjs` の、本家の clone が読めない等で飛ぶもので、直す前から同じ（基準の走らせでも 7）。
- その1つ前の全体の走らせでは 2 件落ちた（build-commit の `headCommitOf`、build-parts の既定 `c:\b`）。上の6・7で直して、通った。

### 未解決の点

- `C:\b` をまだ文字で持つ scripts（Phase 0 の道具を除く）は、静的な検査が 0 件になった時点で無い。蒙恬の直しで消えたもの。
- 関門の手順書（`tests/removals/c1〜c7-gate-script.md`）は、リーダーの指示（4）で今は触っていない。移した後に書き直す。
- `probe-*.ps1`（試し用）は `C:\b` のままで、リーダーの指示に入っていない。run-all には入らない（`*.tests.ps1` ではない）。直すか、閉じた試しとして残すかの判断を仰ぐ。
- 権限: scripts/measure.ps1・netaudit.ps1 を書くことは、このとき hook に止められなかった（定義の `tools` と permissions.json の `write_paths` は確かめていない）。

## 3回目（スモークの作業フォルダ名を短くする。LongPathsEnabled=0 の PC のため）

置き場所は `<リポジトリ>\tmp\b`（45 文字）に決まった。C:\b にも tmp\b にも何も作っていない（試しの入れ物は `tmp\tests\` の下だけ）。

### 縮め方の決まり

- 名前 = `<短いラベル>-<YYMMDDThhmmss>`（時刻は UTC。前の `YYYYMMDDThhmmss` の先頭2桁を落とした13文字）。
- 全体は **スモークの runs で 22 文字以下、absent で 20 文字以下**（リーダーの上限 24・22 より 2 文字ずつ余裕）。ラベルは runs で 8 文字、absent で 6 文字まで。
- 長いラベルは「先頭 (最大-3) 文字 + ラベル全体の sha1 の先頭3桁」に縮める。同じラベルはいつも同じ名前になり、先頭が同じ別のラベル（`take-in-trial-official-1.146.0-2` と `-3` など）は分かれる。使えない文字は `_`。完全なラベルは `smoke-result.json` の `label` に残る。名前から元のラベルは戻さない。
- 前の記録の名前（`official-20261113T124359` など）は名前として読め、`selectPrune`（古い実行の掃除）は新旧を時刻順にそろえて比べる。`C:\b\smoke\...` の名前を読むテストはそのまま。
- 拡張のフォルダ名 `<SMOKE_ROOT>\ext\<版>-<ラベル>` のラベルも 12 文字以下に縮めた（同じ縮め方）。ここは Electron の Code Cache ほど長いファイルを書かないが、拡張の中の深い木に余裕を残すため。
- 変えた場所: `tests/smoke/lib/common.mjs`（`runDirName`・`shortLabel`・`runStamp`・`RUN_DIR_NAME_MAX`・`ABSENT_DIR_NAME_MAX`・`isRunDirName`・`selectPrune`）、`tests/smoke/lib/env.mjs`（`prepareRunDir`。`smoke-launch.mjs` もこれを通る）、`tests/smoke/lib/run.mjs`（拡張のフォルダ名と使い方の文）、`tests/removals/run-absent.mjs`（absent の置き場所）。

### 最長のパスの見積もり

実測した最長のファイルは `Code Cache\electron-preload\<64桁>-<64桁>.cache`（`C:\b\smoke\runs` の 28 ファイルで確かめた）。

- runs: `<buildRoot>`(45) + `\smoke\runs\`(12) + 名前(22) + `\user\user-data\Code Cache\electron-preload\<135>`(179) = **258 文字**（上限 259、余裕 1）
- absent: 45 + `\smoke\absent\`(14) + 名前(20) + 179 = **258 文字**（余裕 1）
- 蒙恬の見積もりは「固定部分 190、名前は 24 文字まで」だったが、私の数え方では固定部分が 191（`\smoke\runs\` の後ろの 12 文字を含めて 45+12+179=236）で、名前は **23 文字まで**（24 だと 260 文字で MAX_PATH に当たる）。そのため余裕を 1 文字見て 22 にした。absent も同じ理由で 20。
- テストで見張る（`tests/move-off-c.test.mjs`、8件足した）: 名前の形と長さ、縮め方、前の名前の読み、`prepareRunDir` の実際の名前、runs・absent それぞれの最長パスが 259 以下、台本が `runDirName` を通ること。`<リポジトリ>` の場所が深くなって `tmp\b` が 45 文字より長くなると、最長パスの試しが落ちる（余裕は各1文字なので、リポジトリを 1 文字深い場所へ移すだけでも落ちる。それが見張りの狙い）。

### 見張れていない所

- 本物のエディタを `tmp\b` で動かしての確かめはしていない（何も作らない指示）。見積もりは実測のファイル名の長さからの計算。
- `userdata` の下のほかのキャッシュ（`Cache\Cache_Data`、`GPUCache` など）は、蒙恬の実測の最長（Code Cache の 284 文字）より短いので見ていない。
- 同梱拡張を外さない公式の木の 263 文字（蒙恬の調べ）はスモークの作業フォルダ名では直らない。別の判断。

### 実行結果

- `tests/move-off-c.test.mjs` 25 件、通った 25。`tests/smoke.test.mjs` 75 件、通った 75。
- run-all の件数（`--save tasks/2026-11-15-move-off-c/run-all-after3.txt`）: RUN_ALL_RESULT

### その他

- `probe-*.ps1` は直さない（閉じた試し、git の管理外）。
- 2回目の報告は SubagentHandback が先に出した報告で閉じていたため届いていなかった。内容は上の「2回目」の節にある。

## 権限について（リーダーへ）

- 曹参の `read_paths` に `C:/b/` が入っている。新しい置き場所（`<リポジトリ>/tmp/`）は `./` に含まれるので読めるが、移したあとの `C:/b` を読む必要はなくなる。
- この作業で Bash の `cd`・`sed`・`node -e` は許可に無く使えなかった（`node tests/...` は使えた）。権限の変更は求めない。
- `permissions.json` 自体は読む許可が無く、中身を確かめていない。

# 検証: C: に書く残りの直し3つ（trial.mts・check-env.ps1・take-in の --records-dir）

- 検証: 大岡越前守（2026-11-16）
- 依頼: `tasks/2026-11-16-small-fixes/brief.md` と、リーダーの知らせ「C: に書く残りの直しの検証」
- 対象: 蒙恬の直し（`handoff-notes-meng-tian.md`）、曹参のテスト `tests/small-fixes.test.mjs`（`handoff-notes-cao-shen.md`）
- 判断の記録: `docs/user-decisions.md` の「記録（2026-11-16、C: に書く残りの直し。リーダーの判断）」

## 判定: 合格

brief の完了条件（1〜3 の直しとテストがあり、関係するテストが通る）を満たしている。知らせの3点も満たす。

- 既定で C: に書かない。
- 直した台本は何も消さない。
- `--records-dir` の守りが、外・`..`・前方一致の偽装・途中のジャンクションで止まる。

ただし途中のジャンクションは、コードを読んで確かめた。それを試すテストが無い（直す点の1）。直す点は3つで、どれも軽く、合否は変えない。

## 1. 差分を読んで確かめたこと

### 1.1 `extensions-src/notion-sync/dev/trial.mts`

| 点 | 結果 | 根拠 |
|---|---|---|
| 既定で C: に書かない | 満たす | 流れ16 の置き場所は `defaultTrialRoot()` で決める。`NOTION_SYNC_TRIAL_DIR` があればそれを `path.resolve` して使う。無ければ `scripts/lib/local-config.mjs` の `resolveLocalConfig` の `buildRoot` に `trial-notion-sync` を足した場所で、local.json が無ければ `<リポジトリ>\tmp\b\trial-notion-sync` になる。`C:\b\notion-sync-trial` の決め打ちは消えた。既定を決めるだけでフォルダは作らない |
| 何も消さない | 満たす | 前の `await fsp.rm(root, { recursive: true, force: true })` を外した。新しい `makeTrialRunDir(root)` は `mkdir(root, recursive)` と `mkdtemp(root\run-)` だけで、毎回新しい `run-XXXXXX` を足す。`.rm(`・`rmSync`・`rmdir`・`unlink` は台本に無い（grep）。裁定の記録の「消さずに、毎回その下に新しい run-XXXXXX を作る形」と合っている |

### 1.2 `scripts/check-env.ps1` と新しい `scripts/lib/child-cache-env.ps1`

| 点 | 結果 | 根拠 |
|---|---|---|
| 既定で C: に書かない | 満たす | 台本の頭で `Set-ShukoChildCacheEnv -BuildRoot $BuildRoot -CreateTemp` を呼ぶ。これは、このプロセスの環境（子が受け継ぐ）に次を `<buildRoot>` の下で入れる。`TEMP`・`TMP` = `tmp`、`pnpm_config_store_dir` = `cache\pnpm-store`、`pnpm_config_cache_dir` = `cache\pnpm-cache`、`npm_config_cache` = `cache\npm-cache`。base にあるときだけ、ELECTRON_CACHE などの6つも入れる。この形は `build-env.mjs` の `cacheEnvVars`・`IF_PRESENT_VARS` と同じ名前・同じ場所である（読んで照らした）。`[Environment]::SetEnvironmentVariable(..., 'Process')` なので、大文字小文字だけ違う既存の変数（`Temp` など）も置き換わる。LOCALAPPDATA は変えない。利用者の全体の環境（User・Machine）と `~/.npmrc` も変えない。いずれも裁定の記録の3行目と合っている |
| 何も消さない | 満たす | `Remove-Item` などは無い（grep）。新しく作るのは `-CreateTemp` の `<buildRoot>\tmp` だけ。`disk.buildRootExists` は作る前の値を記録する |
| 結果の形 | 変えていない | 足したのは `childEnv`（`vars`・`replaced`・`createdTemp`）だけ |

### 1.3 `scripts/take-in.mjs`・`scripts/lib/take-in/records.mjs`・`args.mjs`

| 点 | 結果 | 根拠 |
|---|---|---|
| 外を指したら止める | 満たす | `main` は引数を読んだ直後に、`--records-dir` があれば `recordsDirProblem(a.recordsDir, { repoRoot: REPO })` を呼ぶ。理由があれば `[take-in] 引数の誤り: …` と使い方を出して終了 2 にする。`runCore`・`runExt` に入る前なので、フォルダも枝も作らない。core・ext・probe、`--dry-run`・`--skip-judge` のどれでも同じ。前の「外でも警告だけで続ける」の行（`startsWith(REPO…)` の前方一致の比べ）は消えた |
| `..`・前方一致の偽装 | 止まる | `path.resolve(cwd, dir)` で正規化してから、大文字小文字を区別せずに `<repo>\records\take-in` + `\` で前方一致を見る。`..` で抜ける形、`records/take-in-evil`、`<repo>-evil` は外になる。`records/take-in` そのものも外になる。`cwd` の既定は、`runCore`・`runExt` が `path.resolve(a.recordsDir)` で使う基準と同じ |
| 途中のジャンクション | 止まる（コードで確かめた） | `records/take-in` そのものから `dir` まで（`dir` そのものも含む）の、在るフォルダを1つずつ `lstat` で見る。リンク（Node は Windows のジャンクションも `isSymbolicLink()` で返す）か、フォルダでないものがあれば外とする。そのうえで、在るもののうちいちばん深いフォルダの実体（`realpathSync.native`）が `records/take-in` の実体の下になければ外とする。形は `copy-verify.mjs` の `linkInChain` と同じで、あちらは本物のジャンクションで試すテストが通っている（`tasks/2026-11-16-before-delete-c/copy-verify-ooka.md` の付記1・2）。このテストには、ジャンクションの試しが無い（直す点の1） |
| 何も消さない | この直しでは足していない | 足したのは読むだけの関数と、止める分岐だけ。`take-in.mjs` に前からある `rmSync`（288・483・533行。作業場所の後片づけ・`verdict.json`・監査の環境）は、今回の差分の外で、変わっていない |

## 2. テスト（`tests/small-fixes.test.mjs`。18件）を読んで

- trial.mts:
  - 静的な検査3件（C:\b の決め打ちが無い、既定が `<buildRoot>`・tmp の式、消す行が無い）。
  - 関数の検査4件。`defaultTrialRoot` の、local.json がある・無い・`NOTION_SYNC_TRIAL_DIR` の3つの場合と、`makeTrialRunDir` が前の `run-*` とファイルを残すこと。
  - README の表記。
- check-env:
  - PATH の先頭に、子の環境変数を書き出す偽の `pnpm.cmd`・`npm.cmd` を置き、台本に本当に起こさせて、子が見た値を照らしている。結果を見る形で、よい。
  - 期待の向け先は `build-env.mjs` の `cacheLayout` から取っていて、手で並べていない。
  - 親に `C:\parent-junk\…` を入れても上書きされること、親に何も無くても `<BuildRoot>` の下で `%LOCALAPPDATA%` の下でないこと、を見ている。
- take-in:
  - 外4か所、外へ出る形4種、ext、`--skip-judge` で止まり、何も作らないことを見ている。
  - 内側3つ（大文字・相対を含む）では止めないことも見ている。
  - 古い警告の文と前方一致の比べが残っていないことも見ている。
- 実装に合わせて緩めた所は見当たらない。ただし、見張りが足りない所と、古い説明が残っている所がある（直す点）。

## 3. 走らせたもの

| コマンド | 結果 |
|---|---|
| `node --test tests/small-fixes.test.mjs` | **tests 18、pass 18、fail 0、skipped 0**（12.6 秒） |
| `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs tests/p1-scripts.test.mjs tests/signtool.test.mjs` | **tests 189、pass 189、fail 0、skipped 0**（69 秒）。check-env.ps1 を走らせる4件（p1-scripts 1・signtool 3）を含む。どれも `-BuildRoot` に試しの入れ物を渡すので、`<buildRoot>\tmp` は入れ物の中にできる |

`C:\b` と普段使いのデータには触れていない。書いたのはこの書き物だけ。

## 4. 指摘

### 直す点（曹参。軽い。合否は変えない）

1. **`--records-dir` の途中のジャンクションと、`records/take-in` そのものを試すテストが無い**
   - 実装は両方を断る（1.3）。しかし、`recordsDirProblem` のジャンクションの照らし（`lstat` と `realpath`）を外しても、落ちるテストが無い。
   - 蒙恬も、書き付けの6節で足すとよいと書いている。
   - 足し方の例:
     - 試しの入れ物を指すジャンクションを `records/take-in/<一意の名前>` に作り、その下を `--records-dir` に渡して終了 2 になることを見る。終わりにジャンクションだけを外す。
     - `records/take-in` そのものを渡して終了 2 になることを見る。
     - 関数 `recordsDirProblem` を直接呼んで、`cwd`・`repoRoot` に試しの入れ物を渡す形なら、本物の `records/` に触れずに済む。
2. **`..` の形で「作っていない」の確かめを外している**
   - 228行の `assert.ok(!fs.existsSync(path.resolve(dir)) || name.startsWith('..'))` は、`..` の2件について、置き場所ができていないことを見ない。
   - どちらも正規化した先（`tmp\tests\smallfix-dotdot`・`records\smallfix-up`）は前から無い場所なので、例外にする理由が無い。外してよい。
3. **テストの冒頭の説明が古い**
   - 6〜7行は「直しが入るまで落ちてよい」と書いている。25行は「本物の試し(trial.mts)は走らせない(root を rm -r するため)」と書いている。
   - どちらも今の実装と合わない。今は18件とも通り、trial.mts は消さない。

（この3点と、下の記録の1は、曹参の追加で閉じた。付記を参照）

### 記録として伝える点（直す必要は無い）

1. **check-env の子の TEMP・TMP と、ELECTRON_CACHE など6つは、テストで見ていない**
   - 偽の pnpm・npm は3つのキャッシュの変数しか書き出さない。冒頭の注には「と TEMP」とあるが、書き出していない。
   - PowerShell の `child-cache-env.ps1` と `build-env.mjs` が同じ名前・同じ場所を返すことは、私が読んで照らした。照らすテストは無い（蒙恬の6節の2つ目）。
   - 2つは「同じに保つ」と注にあるので、片方だけ変えたときに落ちるテストがあるとよい。
2. **check-env.ps1 は `<buildRoot>\tmp` を作るようになった**
   - 冒頭の説明（「changes no settings」「creates <buildRoot>\tmp when missing」）と、結果の `createdTemp` に出る。
   - 本物の環境で走らせると、子の pnpm・npm が `<buildRoot>\cache\…` に書く（蒙恬の7節）。裁定どおりで、C: ではない。
3. **trial.mts の `run-*` は溜まる**
   - 毎回 `<buildRoot>\trial-notion-sync\run-XXXXXX` が増える（蒙恬の試しで `run-01eS8J` が1つある）。
   - 裁定どおり、要らなければ人が消す。置き場所は削除の許可の `tmp/b/trial-*` に入る。
4. **`recordsDirProblem` も、柵の根（`records/take-in`）より上のフォルダは見ない**
   - `records/` やリポジトリの上がジャンクションでも、根の実体と照らすので誤りにはならない。copy-verify と同じ扱いで、今の作業場所では当たらない。

## 5. 記録したファイル

- `tasks/2026-11-16-small-fixes/verification-ooka.md`（この書き物）

## 付記（2026-11-16）: small-fixes のテストの追加の確かめ

- 依頼: リーダーの知らせ「small-fixes のテストの追加の確かめ」
- 対象: 曹参の `tests/small-fixes.test.mjs` の追加（`handoff-notes-cao-shen.md` の追記）
  - 4節の直す点の1〜3
  - 記録の1（check-env の TEMP・TMP と6つ、PowerShell 版と mjs 版の一致）
- 判定: **合格**
  - 足した12件は結果を見ていて、台本に合わせて緩めた所は見当たらない。
  - ジャンクションの後片づけは、テストが作ったものだけに限られている。
  - 30/30 で通った。
  - 4節の直す点の1〜3と記録の1は、閉じた。

### 足した12件（`git diff tests/small-fixes.test.mjs`）

| 件 | 見ているもの（結果） |
|---|---|
| check-env: 子の TEMP・TMP と、親にある6つ | 親に `C:\parent-junk\…` の6つと TEMP・TMP を入れて台本を走らせる。偽の pnpm・npm が見た値が、`build-env.mjs` の `cacheEnvVars(br, 親)` の全部の名前で同じ場所になり、`parent-junk` が残らないこと。期待は mjs 版から読んでいて、手で並べていない |
| check-env: 親に6つが無ければ足さない | 子の TEMP・TMP が `<BuildRoot>\tmp`。親に無い6つは、子の環境でも空のまま。このテストの環境の親に元からある変数だけは飛ばす。その変数は向け直されて当然なので、緩めではない |
| check-env: 結果の JSON の `childEnv.vars` | `cacheEnvVars(br, 親)` と、名前の集まりも値も同じ（`deepEqual`） |
| child-cache-env.ps1 と mjs 版の一致 | `Get-ShukoChildCacheEnv` を PowerShell で直接呼ぶ。親の名前が無い・6つ全部（小文字に変えて）・一部、の3つの場合で、`cacheEnvVars` と同じ値を返すこと。絶対でない buildRoot は断ること |
| recordsDirProblem: 根そのもの | `records/take-in` と、末尾に区切りのついた形を止める。下の新しい場所・前からある下のフォルダは通す |
| recordsDirProblem: 外 | 別の場所・`records/other`・`tmp/x`・`..` で抜ける2形・`take-in-evil`・`<repo>-evil`・リポジトリそのもの、の8つを止める |
| recordsDirProblem: 大文字小文字・相対 | 大文字の形は通す。相対は `cwd` から数え、`cwd` が別の場所なら外にする。`..` を通って中に入る相対は通す |
| recordsDirProblem: 空・型・repoRoot | 空・undefined・null は止める。`repoRoot` が無ければ例外 |
| recordsDirProblem: 途中のジャンクション | `records/take-in/jn` を柵の外のフォルダへのジャンクションにする。次の3つをすべて止める。`jn\label`、`jn` そのもの、`jn\a\b\c`。ジャンクションの先に何もできないこと（読むだけ）も見る。対照として、ふつうのフォルダの兄弟は通す |
| recordsDirProblem: 中を指すジャンクション | 行き先が `records/take-in` の中でも、リンクは一律に止める |
| recordsDirProblem: 途中がファイル | 止める |
| recordsDirProblem: 読むだけ | 呼ぶ前後で、試しの repoRoot の木（名前・大きさ・更新時刻）が同じ。新しい場所を作らない |

- ほかの直し:
  - 228行の `|| name.startsWith('..')` を外した。`..` の2件も含めて、置き場所ができていないことを全部で見る（直す点の2）。
  - 冒頭の説明（6〜8行）と1節の注（47〜49行）を今の実装に合わせた（直す点の3）。
  - 既存の「親に何も無くても」の件の照らしの範囲を、書き出す変数が増えた分に合わせて、3つのキャッシュと TEMP・TMP に決めた。6つは空のままが正しいので、別の件で見ている。緩めではない。
- 落ちるべきときに落ちるか（読んで確かめた）:
  - `recordsDirProblem` の `lstat` のリンクの照らしを外すと、ジャンクションは `isDirectory()` が偽なので「フォルダでない」の文になる。ジャンクションの件は `/リンクかジャンクション/` を期待するので落ちる。
  - 両方の照らしを外すと、`jn\label` が通るので落ちる。
  - PowerShell 版と mjs 版のどちらかだけ名前や場所を変えると、一致の件と JSON の件が落ちる。
- ジャンクションの2件は、飛ばされずに本当に試された（skipped 0）。

### ジャンクションの後片づけ

- ジャンクションは、どちらも試しの入れ物（`tmp\tests\tests-smallfix-*`）の中の、試しの repoRoot に作る。
  - `<sb>\recrepo-junction\records\take-in\jn` は `<sb>\recjunction-target` を指す。
  - `<sb>\recrepo-junction-in\records\take-in\alias` は同じ repoRoot の中の `real` を指す。
- 本物の `records/` には作らない。
- 後片づけは `finally` の `dropLink(linkPath)` で、テストが作ったジャンクションのパス1つだけを対象にする。
  - `unlinkSync` を試し、だめなら `rmdirSync`。どちらもジャンクションそのものを外すだけで、指す先の中身は消さない。`recursive` は使わない。
- 指す先も試しの入れ物の中にあり、終わりに `after` の `removeSandbox(sb)` が入れ物ごと片づける。ほかの物を巻き込まない。

### 走らせたもの

| コマンド | 結果 |
|---|---|
| `node --test tests/small-fixes.test.mjs` | **tests 30、pass 30、fail 0、skipped 0**（19.3 秒） |

`C:\b`・本物の `records/`・普段使いのデータには触れていない。書いたのはこの書き物だけ。

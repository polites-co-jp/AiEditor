# 蒙恬の引き継ぎ: C: に書く残りと、取り込みの記録の置き場所の守り

- 依頼: `tasks/2026-11-16-small-fixes/brief.md` の「やること（蒙恬）」1〜4
- 作成: 蒙恬（2026-11-16）
- 結果: **完了**。3つを直した。曹参が先に書いた `tests/small-fixes.test.mjs` は 18件すべてが通る

## 0. 要点

1. `trial.mts`: 流れ16の既定の置き場所を `<buildRoot>\trial-notion-sync` にした（buildRoot は local.json から。無ければ `<リポジトリ>\tmp\b`）。毎回その下に新しい `run-XXXXXX` を作って使う。前のように置き場所を丸ごと消す処理はやめた。
2. `check-env.ps1`: 起こす子（pnpm・npm・corepack・python など）の TEMP・TMP と pnpm・npm のキャッシュを、`<buildRoot>` の下に向ける。向け先は `build-env.mjs` の `cacheEnvVars` と同じ。部品は新しい `scripts/lib/child-cache-env.ps1` に置いた。
3. `take-in.mjs`: `--records-dir` が `records/take-in/` の下でなければ、何かを作る前に終了 2 で止める。`--skip-judge` でも止め、ext でも core でも同じ。前の「外なら警告だけ」の処理は消した。

## 1. trial.mts（brief の1）

直したファイル: `extensions-src/notion-sync/dev/trial.mts`

- 新しく書き出したもの:
  - `REPO_ROOT`: このリポジトリの直下（`dev` の3つ上）
  - `TRIAL_DIR_NAME`: `"trial-notion-sync"`
  - `defaultTrialRoot({ env, configPath })`: 流れ16の置き場所の根を返す（Promise）。フォルダは作らない。
    - `env.NOTION_SYNC_TRIAL_DIR` があれば、それを絶対パスにして返す（前と同じ優先）。
    - 無ければ `scripts/lib/local-config.mjs` の `resolveLocalConfig({ env, configPath })` の `buildRoot` に `trial-notion-sync` を足した場所を返す。local.json が無ければ `<リポジトリ>\tmp\b\trial-notion-sync`。
    - local-config.mjs は動的な import で読む（.mts から型の無い .mjs を静的に import すると、strict の型検査で止まるため）。
  - `makeTrialRunDir(root)`: `root` を作り、その下に `fsp.mkdtemp` で新しい空の `run-XXXXXX` を作って返す。何も消さない。
- 流れ16は `makeTrialRunDir(await defaultTrialRoot())` の下の `User` を使う。見出しの表示も、その場所を出す形にした（`C:\b` の文字は無くなった）。
- **変えた振る舞い（指示の外の1点）**: 前は置き場所を `fsp.rm(root, { recursive: true, force: true })` で消してから作っていた。この形のまま場所だけ `<buildRoot>` の下に移すと、私の削除の許可（`delete_paths`）の外を台本が消すことになる。そのため消す処理をやめ、毎回新しいフォルダを作る形にした。
  - `NOTION_SYNC_TRIAL_DIR` を渡したときも、その場所を消さずに、下に `run-*` を作る。前は渡した場所そのものを使い、消していた。
  - 古い `run-*` は残る（1回で4ファイル、数 KB）。要らなければ人が消す。
- `<buildRoot>\trial-notion-sync` は、既定の buildRoot（`tmp\b`）では `delete_paths` の `tmp/b/trial-*` に入る。
- local.json の `buildRoot` を C: に向けた場合は、C: に作る（台本では止めない）。既定のままなら C: には作らない。

## 2. check-env.ps1（brief の2）

直したファイル: `scripts/check-env.ps1`。新規: `scripts/lib/child-cache-env.ps1`（ASCII だけ。Windows PowerShell 5.1 のため）

- `check-env.ps1` は buildRoot を決めた直後に、`Set-ShukoChildCacheEnv -BuildRoot $BuildRoot -CreateTemp` を呼ぶ。この後に起こす子は、すべて向けた環境を受け継ぐ。
- 向け先（`build-env.mjs` の `cacheEnvVars` と同じ名前・同じ場所）:

| 変数 | 向け先 |
|---|---|
| `TEMP`・`TMP` | `<buildRoot>\tmp` |
| `pnpm_config_store_dir` | `<buildRoot>\cache\pnpm-store` |
| `pnpm_config_cache_dir` | `<buildRoot>\cache\pnpm-cache` |
| `npm_config_cache` | `<buildRoot>\cache\npm-cache` |
| 既にあるときだけ: `ELECTRON_CACHE`・`electron_config_cache`・`ELECTRON_BUILDER_CACHE`・`npm_config_devdir`・`PLAYWRIGHT_BROWSERS_PATH`・`COREPACK_HOME` | `build-env.mjs` の `IF_PRESENT_VARS` と同じ場所 |

- `LOCALAPPDATA` は変えない。`build-env.mjs` も、`LOCALAPPDATA` を向けるのは build.mjs の道具の手順（導入・型検査・パッケージ化）だけ。check-env が起こす `pnpm --version` などに `LOCALAPPDATA` まで向けると、corepack の置き場所が変わって取り直しが起きうる。
- 変えるのは台本のプロセスの環境だけ（`[Environment]::SetEnvironmentVariable(…, 'Process')`）。`powershell -File` で起こす別のプロセスなので、呼んだ側と、利用者の全体の設定（ユーザー・マシンの環境変数、`~/.npmrc`）は変わらない。
- `<buildRoot>\tmp` が無ければ作る。在らない TEMP で落ちる道具があるため。ほかのフォルダは作らない（pnpm・npm が要るときに自分で作る）。
- 結果の JSON に `childEnv`（`vars`・`replaced`・`createdTemp`）を足した。`disk.buildRootExists` は、`<buildRoot>\tmp` を作る前の値にした（作ったせいで「ある」にならないように）。
- 台本の頭の説明を「設定は変えない。子の一時のファイルとキャッシュは `<buildRoot>` の下へ向ける」に直した。
- 2つの部品は同じ規則を持つ（`build-env.mjs` と `child-cache-env.ps1`）。規則を変えるときは両方を直す（`child-cache-env.ps1` の頭に書いた）。

## 3. take-in.mjs の --records-dir（brief の3。Team の R22）

直したファイル: `scripts/take-in.mjs`、`scripts/lib/take-in/records.mjs`、`scripts/lib/take-in/args.mjs`（使い方の文だけ）

- 新しい関数 `recordsDirProblem(dir, { repoRoot, cwd })`（`scripts/lib/take-in/records.mjs` が書き出す。読むだけ）。問題が無ければ `null`、あれば理由の文を返す。理由の文は、どれも `--records-dir` で始まる。
  - `dir` は `cwd`（既定は今の作業場所）からの相対か絶対。正規化してから、大文字小文字を区別せずに `<repoRoot>\records\take-in\` の下かを見る。
    - `records/take-in` そのものは外とする。
    - `..` で抜ける形は外とする。
    - 前方一致の偽装（`records/take-in-evil`、`<repo>-evil`）も外とする。
  - `records/take-in` から `dir` までの在るフォルダを lstat で見る。リンク（ジャンクションを含む）があれば外とする。
  - 在るもののうちいちばん深いフォルダの実体（realpath）が、`records/take-in` の実体の下でなければ外とする。
  - `dir` が空なら `--records-dir が空`。`repoRoot` が無ければ例外。
- `main` は、引数を読んだ直後に `--records-dir` があれば `recordsDirProblem` を呼び、理由があれば `[take-in] 引数の誤り: <理由>` と使い方を出して **終了 2**（引数の誤りと同じ）にする。
  - core・ext・probe-claude のどれでも、`--dry-run`・`--skip-judge` でも同じ。
  - フォルダも枝も作る前に止まる。
- 消したもの: `runCore` の「`--records-dir` がビルドリポジトリの外。判定役は読めない」の警告（`startsWith(REPO…)` の前方一致の比べ）。
- 使い方の文（`USAGE`）の `--records-dir` の説明を「records/take-in/ の下に限る（外を指すと止める）」に直した。

## 4. 確かめたこと（brief の4）

| コマンド | 結果 |
|---|---|
| `node --check scripts/take-in.mjs`・`node --check scripts/lib/take-in/records.mjs` | 誤りなし |
| `node --test tests/small-fixes.test.mjs`（曹参） | **tests 18、pass 18、fail 0** |
| `pnpm --dir extensions-src/notion-sync run build --trial` | 型検査（tsc）・esbuild・読み込みの確かめ・試しの全部が通り、「試し: すべて期待どおり」。流れ16は `E:\develop\self\Team\projects\ai-editor\tmp\b\trial-notion-sync\run-01eS8J\User` で動いた |
| `powershell … -File scripts/check-env.ps1 -OutFile tasks/2026-11-16-small-fixes/check-env-after.json` | 終了 0、`missing` は空。`childEnv.vars` が上の表の5つ（`tmp\b` の下）、`replaced` は `TEMP`・`TMP`（もとは C: の `%LOCALAPPDATA%\Temp`）、`createdTemp` は null（`tmp\b\tmp` は既にあった）。pnpm 12.16.0・npm 11.19.1 は前と同じに読めた |
| 前からあるテスト（take-in・take-in-more・signtool・p1-scripts） | 189件すべてが通った（下の5節） |

## 5. 前からあるテスト

直したファイルを使う、前からあるテストを流した（合否は出さない。曹参と大岡越前守が見る）。

| コマンド | 結果 |
|---|---|
| `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs` | tests 138、pass 138、fail 0 |
| `node --test tests/signtool.test.mjs tests/p1-scripts.test.mjs` | tests 51、pass 51、fail 0（check-env.ps1 を走らせる4件を含む） |

`run-all` 全体は走らせていない。

## 6. テストの入口（曹参へ）

曹参の `tests/small-fixes.test.mjs` が想定した入口と同じにした（1節の関数の名前と形は、曹参のテストの50行の注のとおり）。

| 入口 | 形 | 期待 |
|---|---|---|
| `trial.mts` の `defaultTrialRoot({ env, configPath })` | Promise<string> | `NOTION_SYNC_TRIAL_DIR` があれば `path.resolve` したそれ。無ければ `<buildRoot>\trial-notion-sync`。フォルダは作らない |
| `trial.mts` の `makeTrialRunDir(root)` | Promise<string> | `root\run-XXXXXX`（新しい空のフォルダ）。前からあるものは消さない |
| `trial.mts` の `TRIAL_DIR_NAME`・`REPO_ROOT` | 定数 | `"trial-notion-sync"`・リポジトリの直下 |
| `scripts/lib/child-cache-env.ps1` の `Get-ShukoChildCacheEnv -BuildRoot <dir> [-BaseNames <string[]>]` | ordered hashtable | 上の2節の表。`-BaseNames` に `COREPACK_HOME` などがあるときだけ、その名前も入る（大文字小文字を問わない）。絶対パスでない `-BuildRoot` は例外 |
| 同 `Set-ShukoChildCacheEnv -BuildRoot <dir> [-CreateTemp]` | `{ vars; replaced; createdTemp }` | 今のプロセスに設定する。`replaced` は前からあった名前。`-CreateTemp` で `<buildRoot>\tmp` が無ければ作る |
| `check-env.ps1` の結果の JSON | `childEnv` | `vars`・`replaced`・`createdTemp` |
| `scripts/lib/take-in/records.mjs` の `recordsDirProblem(dir, { repoRoot, cwd })` | `null` か文字列 | 3節の規則。`records/take-in/<x>` は `null`。`records/take-in` そのもの・`records/take-in-evil/x`・`records/take-in/../x`・リポジトリの外・途中のジャンクションは、どれも `--records-dir` で始まる文 |
| `node scripts/take-in.mjs … --records-dir <外>` | 終了コード | 2。stderr に `引数の誤り: --records-dir …`。何も作らない |

テストを足すとよい点（曹参の判断に任せる）:

- `recordsDirProblem` の、途中のジャンクション（`records/take-in/jn` が外を指す）と、`records/take-in` そのもの。
- `Get-ShukoChildCacheEnv` の `-BaseNames`（`COREPACK_HOME` があるときだけ入る）と、`build-env.mjs` の `cacheEnvVars` との一致。

## 7. 守ったこと

- 書いたもの: `extensions-src/notion-sync/dev/trial.mts`、`scripts/check-env.ps1`、`scripts/lib/child-cache-env.ps1`（新規）、`scripts/take-in.mjs`、`scripts/lib/take-in/records.mjs`、`scripts/lib/take-in/args.mjs`、このフォルダ（`check-env-after.json` とこの書き物）。
- 走らせたものが書いた所:
  - 試し: `tmp\b\trial-notion-sync\run-01eS8J\`
  - build: `extensions-src/notion-sync/dist/`（build.mjs がいつも作り直す出力）
  - check-env: `tmp\b\cache\…`（pnpm・npm が書いたもの）
- `C:\b` と普段使いのデータには触れていない。テスト（`tests/`）は変えていない。
- 何も消していない。build.mjs が自分の `dist/` を作り直すのは、前からの build の手順。

## 8. docs/ との食い違い

- なし。

## 9. 未解決の点

1. `trial.mts` は、置き場所を消さずに `run-*` を毎回足す形に変えた（1節）。消す形のほうがよければ、消す場所の許可と合わせて決めてほしい。
2. `check-env.ps1` は `LOCALAPPDATA` を向けない（2節）。`pnpm --version` が `%LOCALAPPDATA%\pnpm-state`（pnpm の更新の確かめの記録）に書くかどうかは確かめていない。

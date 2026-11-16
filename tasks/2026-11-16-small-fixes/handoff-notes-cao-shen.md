# 曹参の引き継ぎ: C: に書く残りの直し3つのテスト

- 依頼: tasks/2026-11-16-small-fixes/brief.md の「やること（曹参）」
- 日付: 2026-11-16
- 結果: **一部完了**。テストは書けた。1・2 の直しは蒙恬の実装が入っていて通る。3（take-in の `--records-dir`）は、書いた時点で実装が無く、**落ちる状態**（落ちるのは実装がまだ無いため）

## 成果物

- `tests/small-fixes.test.mjs`（新規。18件）
- 記録: `tasks/2026-11-16-small-fixes/run-small-fixes.txt`
- 試しは `tmp\tests` の下（`makeSandbox`）と、偽の `local.json`（buildRoot を入れ物の中へ）。`C:\b`・本物の `tmp\b`・普段使いのデータには触れていない。take-in は `--dry-run`（記録も枝も作らない）だけで走らせた。

## 実行結果

`node tests/run-all.mjs --only small-fixes --no-ps --no-guard`: **18件、pass 13、fail 5**。

| 直し | 検査 | 結果 | 切り分け |
|---|---|---|---|
| 1 trial.mts | 静的3件（`C:\b` の決め打ちが無い・既定が `<buildRoot>` か tmp の式・台本が何も消さない）、README の表記、関数4件（下） | 通る | 蒙恬の直し済み（`defaultTrialRoot`・`makeTrialRunDir`） |
| 2 check-env.ps1 | 偽の `pnpm.cmd`・`npm.cmd` を PATH の先頭に置いて台本に起こさせ、子が見た環境変数を書き出させた。親に C: の向け先を入れても上書き／親に何も無くても `<BuildRoot>\cache\…`／結果の JSON の形は同じ／環境変数を直接書き換えて戻さない形でない | 通る（4件） | 蒙恬の直し済み |
| 3 take-in.mjs | 外を指すと止まる（4か所）・外へ出る形（4種）・`ext`・`--skip-judge` つき・古い「警告だけ」の文が残っていない | **落ちる 5件** | **実装の不足**（今は警告を出して続け、終了コード 0 で dry-run の計画を出す。`startsWith(REPO)` の前方一致の比べも残っている） |

## 見たこと

### 1 trial.mts（蒙恬の入口: `defaultTrialRoot({ env, configPath })`・`makeTrialRunDir(root)`・`TRIAL_DIR_NAME`・`REPO_ROOT`。trial.mts の冒頭の注に出ていた）

- 既定は `<buildRoot>\trial-notion-sync`（`local.json` の buildRoot）。`local.json` が無ければ `<リポジトリ>\tmp\b\trial-notion-sync`。どちらも C:\b でない。既定を決めるだけでフォルダは作らない。
- `NOTION_SYNC_TRIAL_DIR` があればそれを使う。相対なら絶対にする（前と同じ）。
- `makeTrialRunDir(root)`: root の下に新しい空の `run-XXXXXX` を作り、前からあるファイル・前の `run-*` は消さない。2回呼べば別のフォルダ。
- 台本が何も消さない（`.rm(`・`rmSync(`・`rmdir` が無い）。前は `NOTION_SYNC_TRIAL_DIR` に渡された場所を丸ごと消した。
- 本物の試し（trial.mts の main）は走らせていない。

### 2 check-env.ps1

- 期待の向け先は `scripts/lib/build-env.mjs` の `cacheLayout(<BuildRoot>)` から読んだ（`pnpm_config_store_dir`・`pnpm_config_cache_dir`・`npm_config_cache`）。手で並べていない。
- 子（偽の pnpm・npm の両方）が見た3つの変数が、すべて `<BuildRoot>` の下。親の環境に `C:\parent-junk\…` を入れても残らない。`%LOCALAPPDATA%` の下に向かない。
- TEMP・TMP は見ていない（依頼はキャッシュの向け先）。

### 3 take-in.mjs の `--records-dir`（想定した入口）

- 想定: `records/take-in/` の下でなければ、台本が止まる（終了コードが 0 でない。メッセージに `--records-dir`）。止まる前に何も作らない。core・ext の両方、`--skip-judge` を付けても同じ。
- 外として試す場所: 入れ物の中（リポジトリの外）・`records/phase0/…`・`tmp/tests/…`・`tasks/…`、`..` で抜ける形 2種、`records/take-in-evil/…`、`<リポジトリ>-evil/records/take-in/…`（前方一致の偽装）。
- 内として試す場所（止めない）: `records/take-in/<名前>`、その大文字、相対 `records/take-in/<名前>`。`--dry-run` なので何も作らない。**この対照は今も通る**。
- 古い「警告だけで続ける」文（`--records-dir がビルドリポジトリの外。判定役は読めない`）と `startsWith(REPO.toLowerCase())` の比べが、ソースに残っていないこと。

## 追記（2026-11-16、大岡越前守の検証 verification-ooka.md の「直す点」3つと任意1つ）

- 結果: **完了**。`node tests/run-all.mjs --only small-fixes --no-ps --no-guard`: **30件、pass 30、fail 0**（18件 + 足した12件）。上の「落ちる 5件」は、蒙恬の実装が入って通っている。
- 直す点1（`--records-dir` の途中のジャンクションと records/take-in そのもの）: `recordsDirProblem(dir, { repoRoot, cwd })` を、試しの入れ物を `repoRoot`・`cwd` に渡して直接呼ぶ8件を足した。本物の `records/` には触れない（入れ物の `records/take-in` を作る）。
  - 根そのもの（末尾の区切りつきも）は止める。下の新しい場所・前からある下のフォルダ・深い下は通す。
  - 外（別の場所・records の直下・tmp・`..` で抜ける 2種・`records/take-in-evil`・`<repo>-evil`・リポジトリ直下）は止める。大文字小文字は区別しない。相対は `cwd` から数える。空・文字列でない・`repoRoot` 無しも。
  - **途中がジャンクション**: ジャンクションを通る形・ジャンクションそのもの・深い下を、`リンクかジャンクション` で止める。行き先に何もできない。ジャンクションが `records/take-in` の中を指していても止める（行き先を信用しない）。ジャンクションを外す退行（`lstat`・`realpath` の照らしを外す）は、これで落ちる。ふつうのフォルダの兄弟は通る対照つき。今回は作れた（skip 0）。
  - 途中がファイルなら `フォルダでない` で止める。呼んでも何も作らず消さない（前後の木が同じ）。
- 直す点2（`..` の2件の「作っていない」）: 228行の例外 `|| name.startsWith('..')` を外した。全8形で、正規化した先（`tmp\tests\smallfix-dotdot`・`records\smallfix-up` を含む）が存在しないことを見る。
- 直す点3（冒頭の説明）: 6〜7行を「3つの直しは入り、検証で合格した。退行の見張りとして残す。入口は defaultTrialRoot・makeTrialRunDir、Get-ShukoChildCacheEnv、recordsDirProblem」に、25行（旧「rm -r するため」）を「main は走らせない。消す行が無いことは静的に、defaultTrialRoot・makeTrialRunDir は関数で試す」に直した。
- 任意4（check-env の TEMP・TMP と6つ）: 4件を足した。
  - 偽の pnpm・npm が、TEMP・TMP と `IF_PRESENT_VARS` の6つ（ELECTRON_CACHE・electron_config_cache・ELECTRON_BUILDER_CACHE・npm_config_devdir・PLAYWRIGHT_BROWSERS_PATH・COREPACK_HOME）も書き出すようにした。親に6つ（と TEMP・TMP）を C: の値で入れると、子は `build-env.mjs` の `cacheEnvVars(<BuildRoot>, 親)` と同じ場所を見る。親に無ければ6つは足さない。TEMP・TMP は `<BuildRoot>\tmp`。
  - 結果の JSON の `childEnv.vars` の名前の集まりと値が、`cacheEnvVars` と同じ。
  - **PowerShell 版 `Get-ShukoChildCacheEnv` と mjs 版を、同じ入力で並べて照らす**: 親の名前なし・6つとも小文字・一部、の3通りで同じ値。絶対でない buildRoot は断る。片方だけ変えると落ちる。
  - 前からあった「親に何も無くても `<BuildRoot>` の下」の検査は、見る変数を3つのキャッシュと TEMP・TMP に絞った（6つは親にあるときだけ向くので）。
- 今回は台本・実装を直していない。

## 未解決・注意

- 終了コードと文言は決めていない（0 でなく、`--records-dir` を含む）。蒙恬の入口が違えば、どちらを直すかを決めてから直す。
- `records/take-in` そのもの（根）を `--records-dir` にしたときの扱いは、試していない（仕様に無い）。
- `ext` のテストは、台帳（`extensions.lock.json`）にある id（`detachhead.basedpyright`）を使う。台帳から消えたらテストの直しが要る。
- check-env のテストは、台本が本物の git・node などの確認も走らせるので、1件 4 秒ほどかかる。
- `run-all` 全体は走らせていない（`--only small-fixes`）。

# 引き渡しの覚え: B-1 の直しと build.mjs の軽微な直し（蒙恬）

- 担当: 蒙恬、2026-11-14（JST 23:05〜23:58）
- 依頼: `brief.md`（このフォルダ）と、リーダーの追加の指示（B-1 の absentCommands を網になるものに替える）
- 記録: `build-log.md`（このフォルダ）。版の一覧は `tasks/2026-11-14-p2-builds/builds.md` の「作り直した版（`-r2`）」の節

## 結果: 完了

ただし、リーダーの追加の指示の確かめ（`node tests/absent-run.mjs … --expect present`）は、許可に無いので走らせていない（下の「未解決の点」の1）。

## 要点

1. B-1 が消した `editTelemetryContribution.ts`・`aiContributionFeature.ts` は、`_aiEdits.hasAiContributions`・`_aiEdits.clearAiContributions`・`_aiEdits.clearAllAiContributions` を登録していた。git の拡張がこの3つを呼ぶ。`edits.patch` で、残したファイル `aiEditTelemetryService.ts` の末尾に、本家の「何もしない代わり」と同じ中身で登録し直した。
2. B-1〜B-7 の版を `-r2` で作り直した。7版とも zip までできて、起動 ok。出力の本体の束に、3つの登録が入っている。
3. B-1 の `absentCommands` は空にした。`workbench.action.showTelemetry` は `--disable-telemetry` のもとでは公式でも登録されない。替えられるコマンドも無い。理由は README に書いた。
4. `build.mjs` を2点直した。`childEnv` が外の `BUILD_SOURCEVERSION` を外すようにした。版の commit に、常設の clone の枝 `builds/<label>` を付けるようにした。
5. C: の空きは 38.36 GB から 27.86 GB に減った（15 GB の線より上）。

## 1. B-1 の直し

### 本家 1.146.0 で確かめたこと

`C:\b\wt\1.146.0` で確かめた。タグ `69047191…` との差は、`git diff` で、`src/vs/workbench/contrib/editTelemetry` と `extensions/git/src/repository.ts` について 0。

| 場所 | 中身 |
|---|---|
| `src/vs/workbench/contrib/editTelemetry/browser/editTelemetryContribution.ts` 53〜59行 | 「AiContributionFeature が働いていなくても拡張がいつでも呼べるように」、何もしない代わりを3つ登録する。has は `() => false`、clear と clearAll は `() => { }` |
| `src/vs/workbench/contrib/editTelemetry/browser/aiContributionFeature.ts` 58〜68行 | `git.addAICoAuthor` が off でないときに、本物で上書きする |
| `extensions/git/src/repository.ts` | clear を 1349・1433・1502・1629 行、clearAll を 2318・2328・2363 行、has を 1543 行（`await`。try/catch つき）で呼ぶ |

ほかに、B-1 が消す部品が持っていて、残る部品が呼ぶものも探した（`src/`・`extensions/` を grep）。見つからなかった。

- `IRandomService` は、`contrib/editTelemetry` の中だけで注入される。
- `editTelemetry.toggleDebugDecorations` と `aiStats.statusBar.settings` は、消す部品の中だけで使う。
- `contrib/telemetry`・`bracketPairColorizer2Telemetry`・`terminalContrib/telemetry` は、コンテキストキー・サービス・コマンド（`showTelemetry` を除く）を持たない。
- 影響が残るのはエージェントのホストだけ。設定 `editTelemetryEnabled` を写してもらえなくなり、既定の「有効」で動く。送り手は B-1 が空にしているので、外へは出ない（推定。README の「影響しうるもの」）。

### 直したファイル

- `removals/B-1-telemetry/edits.patch`
  - `aiEditTelemetryService.ts` に `import { CommandsRegistry }` を1行と、3つの `CommandsRegistry.registerCommand` を足した（コメントつき）。
  - 当てた後の commit から `format-patch` で書き出し、`From`・diffstat・blob の値をそろえた（`build-log.md` の1節）。
  - 新しいファイルにしなかったのは、読み込ませる import の行を `workbench.common.main.ts` に足す必要があり、docs/03 の5.3 に触れるため。
- `removals/B-1-telemetry/unit.json`
  - `kept` の理由に、3つのコマンドの登録を書き足した。
  - `checks.absentCommands` を `[]` にした（3節）。
- `removals/B-1-telemetry/README.md`: 「残すもの」（3つのコマンド）、「消えたことの確かめ方（checks）」（新しい節）、「影響しうるもの」（エージェントのホスト、ほかの ID）、「壊れたときの症状と戻し方」（`command '_aiEdits.…' not found` が出たとき）を書いた。

### 「在る」ことの確かめ（brief の checks の件）

`checks` には「在る」を書く形が無い。項目は `absent*` だけで、`tests/removals.test.mjs` の98〜101行は知らない項目を誤りにする。そのため README に書いた。

- 関門の4（スモークの `errors.new`）で、git のコミットの後に `not found` が出ないことで確かめる。
- 静的には、出力の `workbench.desktop.main.js` にある登録の文字列で見られる。

## 2. 作り直した版

`tasks/2026-11-14-p2-builds/builds.md` に7行を足した（もとの行は残し、B-1 の直しを含まないことを書いた）。

| 版 | 展開した場所（エディタ） | commit |
|---|---|---|
| `1.146.0-p2-B-1-r2` | `C:\b\p2\1.146.0-p2-B-1-r2\Shuko-win32-x64-1.146.0-p2-B-1-r2\` | `f47742d9…450c` |
| `1.146.0-p2-B-2-r2` | `C:\b\p2\1.146.0-p2-B-2-r2\Shuko-win32-x64-1.146.0-p2-B-2-r2\` | `b9c0a9c1…80e0` |
| `1.146.0-p2-B-3-r2` | `C:\b\p2\1.146.0-p2-B-3-r2\Shuko-win32-x64-1.146.0-p2-B-3-r2\` | `cd09c201…afb` |
| `1.146.0-p2-B-4-r2` | `C:\b\p2\1.146.0-p2-B-4-r2\Shuko-win32-x64-1.146.0-p2-B-4-r2\` | `b4417153…c35d` |
| `1.146.0-p2-B-5-r2` | `C:\b\p2\1.146.0-p2-B-5-r2\Shuko-win32-x64-1.146.0-p2-B-5-r2\` | `4dd38929…b6b0` |
| `1.146.0-p2-B-6-r2` | `C:\b\p2\1.146.0-p2-B-6-r2\Shuko-win32-x64-1.146.0-p2-B-6-r2\` | `1f4abbee…3e6d` |
| `1.146.0-p2-B-7-r2` | `C:\b\p2\1.146.0-p2-B-7-r2\Shuko-win32-x64-1.146.0-p2-B-7-r2\` | `680e99e9…4e39` |

- `-r2` の付かない版の展開した場所と zip には触れていない。
- 隣の `portable\` には、私の1回の起動のデータがある。関門は別の場所で始めること（前と同じ）。
- gulp の出力 `C:\b\wt\VSCode-win32-x64\` は、今は B-7-r2 の版。作業ツリー `C:\b\wt\p2` も B-7-r2 の HEAD（`680e99e9…`）で、作り直したロックファイル3つの変更が残っている。

## 3. B-1 の absentCommands（リーダーの追加の指示）

- `workbench.action.showTelemetry` は `telemetry.contribution.ts` の152行で、`supportsTelemetry()` が真のときだけ登録される。
- `supportsTelemetry()`（`telemetryUtils.ts` の96〜102行）は、ビルドした版では `--disable-telemetry` があると偽を返す。
- 検査の台本 `tests/removals/run-absent.mjs` の90行は、`--disable-telemetry` を付けて起動する。そのため、公式でも登録されない。
- 替えの候補を探したが無かった。
  - `editTelemetry.toggleDebugDecorations` は、設定とテレメトリが on のときだけ登録される。
  - `_aiEdits.*` はわざと残すので、「無い」の網にはならない。
  - ほかの部品はコマンドを持たない。
- そのため `absentCommands` を `[]` にし、理由を README の「消えたことの確かめ方」に書いた。網として残るのは absentSettings 2件・absentStrings・absentHosts。
- 別案（リーダーの判断）: 台本が公式を `--disable-telemetry` なしで起動すれば、`showTelemetry` は公式で在り、網になる見込み（推定。曹参の範囲）。そうするなら、`absentCommands` に戻す。

## 4. build.mjs の直し

- **`childEnv`**: 外す名前に `BUILD_SOURCEVERSION` を足した（正規表現。名前の大文字小文字を問わない）。これで prepare・apply・install・lockfile・zip の子に、外の値が漏れない。
  - `extra` で渡した値は残る。既存のテスト `tests/build-commit.test.mjs` の32〜40行、`tests/build-parts.test.mjs` の87〜109行の期待とは食い違わない見込み（走らせていない）。
  - 外した名前は、記録の `envRemovedForChildren` に出る。
- **版の commit の枝**
  - 新しい関数: `BUILD_BRANCH_PREFIX`（`"builds/"`）、`buildBranchName(label)`、`markBuildCommit({ worktree, label, commit, runGit })`。
  - main では、型検査・パッケージ化・後処理のうち最初に走る手順で、`git -C <作業ツリー> branch --force --no-track builds/<label> <sourceVersion>` を走らせる（refs は常設の clone と共有）。
  - 後処理から始めたときは、`checkProductCommit` が ok のときだけ付ける。
  - 結果は記録の `branch`（`{ name, commit, previous, action, ok, error, at }`）に書く。付けられなくても止めず、`warnings` に書く。同じラベルで別の commit に付け替えたときも `warnings` に書く。
  - `--no-branch` で付けない。dry-run では付けず、`plan.branch` に名前とコマンドを出す。
- 許可の範囲: 枝は台本の中の `git` で付ける。私が直に打ったのは、許可にある `node scripts/build.mjs` だけ。
- 前の14版（`-r2` の付かない版）の commit には枝を付けていない（6節の2）。

## 5. 確かめたこと

- `node --check scripts/build.mjs`: 誤り 0。
- dry-run（`node scripts/build.mjs 1.146.0 --label 1.146.0-p2-B-1-r2 --worktree C:/b/wt/p2 --from typecheck --to postprocess --dry-run … --record tasks/2026-11-14-fix-b1-and-build/dry-run-branch.json`）: `branch: null`。`plan.branch` は `{ name: "builds/1.146.0-p2-B-1-r2", command: "git -C C:\\b\\wt\\p2 branch --force --no-track builds/1.146.0-p2-B-1-r2 f47742d9…" }`。
- 本番の7版
  - 記録の `branch` は、1回目が `action: "created", ok: true`、2回目が `action: "unchanged", previous = commit`。
  - `git -C C:/b/wt/p2 diff --quiet builds/<label> <commit>` が終了コード 0（B-1-r2・B-7-r2）。
- 7版とも `build-record.json` は `result: ok`。`productCommit.ok: true`、`launch-check.json` は `result: ok`、`--version` の2行目は commit と同じ。
- `BUILD_SOURCEVERSION` を親に置いて走らせる試しはしていない。環境変数を付けて起動する形が、私の許可に無い。
- スモーク（`tests/smoke-run.mjs`）と `node --test` は、許可に無いので走らせていない。

## テストの入口（曹参へ）

`scripts/build.mjs` の書き出した関数。

1. `childEnv(base, extra)`
   - `childEnv({ PATH: 'x', BUILD_SOURCEVERSION: 'a'.repeat(40), build_sourceversion: 'b' }, {})` の `env` に、どちらの名前も無い。`removed` は `['BUILD_SOURCEVERSION', 'build_sourceversion']`（並べ替えた順）。値は `removed` に出ない。
   - `childEnv({ BUILD_SOURCEVERSION: OTHER }, { BUILD_SOURCEVERSION: SHA }).env.BUILD_SOURCEVERSION === SHA`（既存のテストと同じ）。`removed` に `BUILD_SOURCEVERSION` が入る（既存のテストは `removed` を見ていない）。
2. `buildBranchName(label)`
   - `'1.146.0-p2-B-1-r2'` から `'builds/1.146.0-p2-B-1-r2'` を返す。
   - 例外になるもの: `''`、`'-x'`、`'a/b'`、`'a b'`、`'a..b'`、`'x.lock'`、`'x.'`、`null`。
3. `markBuildCommit({ worktree, label, commit, runGit })`。`runGit(args)` を偽物にして試せる（`{ status, stdout, stderr }` を返す）。
   - 新規: 1回目の `['rev-parse','--verify','--quiet','refs/heads/builds/<label>']` が status 1、`['branch','--force','--no-track','builds/<label>', <commit>]` が 0、2回目の rev-parse が `<commit>\n`。このとき `{ ok: true, action: 'created', previous: null }`。
   - 同じ commit: 1回目の rev-parse が `<commit>`。`{ ok: true, action: 'unchanged' }` で、`branch` を呼ばない。
   - 付け替え: rev-parse が別の40桁、branch が 0、読み直しが `<commit>`。`{ ok: true, action: 'moved', previous: <別の値> }`。
   - 失敗: branch が 128。`{ ok: false, error: 'git branch が 128 で終わった: …' }`。例外にしない。
   - 読み直しが違う値: `{ ok: false }`。
   - commit が40桁でない、label が不正: `runGit` を呼ばずに `{ ok: false, error }`。
   - commit は小文字・trim して扱う。
4. main の結線（実の git の一時リポジトリで）
   - `node scripts/build.mjs <tag> --worktree <tmp> --from typecheck --to typecheck --typecheck-script <何もしない script> --record <json>` の記録の `branch.ok: true`。`git -C <tmp> rev-parse refs/heads/builds/<label>` が HEAD と同じ。
   - `--no-branch` なら `branch: null` で、枝ができない。
   - `--dry-run` なら `branch: null`、`plan.branch.name` があり、枝ができない。
   - `--from postprocess` で出力の commit が HEAD と違うときは、枝を付けない（`branch: null`）。

`removals/B-1-telemetry/unit.json`: `checks.absentCommands` は `[]`。既存の `tests/removals.test.mjs` の形の検査は通る見込み（空の配列は「文字列の配列」）。

## 6. 未解決の点

1. **absent-run の確かめを走らせていない**: リーダーの指示の `node tests/absent-run.mjs --build C:\b\p0\vscode-1.146.0 --units B-1-telemetry --expect present` は、私の許可（`node scripts/*.mjs` だけ）に無い。検証役か曹参に流してもらう必要がある。`absentCommands` を空にしたので、残る absentSettings 2件（曹参の覚えでは公式で pass）だけが見られる見込み。
2. **前の14版の commit に枝が無い**: 直した `build.mjs` は、これから作る版にだけ枝を付ける。`-r2` の付かない A-1〜B-7 の commit（`builds.md` の上の表）は、どの枝からもたどれないまま。A-1〜A-7 は関門で使い続けるので、残すなら印が要る。台本で付けるなら、`build.mjs --from postprocess --to postprocess --label <label> --package-dir <展開した場所>` は使えない（作業ツリーの HEAD が違うので、一致しない版には付けない作り）。付ける小さな台本を足すか、許可に `git -C C:/b/vscode branch` を足すか、リーダーの判断が要る。
3. **一時のファイル**: `C:\b\tmp\b1-r2-patch\0001-unit-B-1-telemetry-edits.patch` が残っている（消すコマンドが私の許可に無い）。
4. **ディスク**: C: の空きは 27.86 GB。`C:\b\p2` は 23.27 GB（21版）。`-r2` の付かない B-1〜B-7 は、関門が `-r2` に移ったら片づけられる（リーダーの判断）。
5. `scripts/p1-launch-check.ps1` は、この依頼では変えていない（brief の「次の担当」の曹参のテストは、前のタスクの直しのもの）。

## docs/ との食い違い

- docs/03 の7節の3（消えている）は、checks の項目を `absent*` だけに定める。「消した部品が持っていた ID を、何もしない実装で残した」ことを確かめる形（在ることの検査）は無い。B-1 の `_aiEdits.*`、B-2・B-3 の何もしない実装も同じ。今はスモークの `errors.new` に任せている。形を足すかどうかは、リーダーの判断。
- docs/03 の4節の B-1 の行は、`contrib/editTelemetry` の削除だけを書く。`aiEditTelemetryService.ts` を残すことと、`_aiEdits.*` を登録し直すことは README にだけある（5.3 の単位の独立の例として書き足すとよい）。
- docs/02 の4節には、build.mjs が版の commit に枝 `builds/<label>` を付けることが無い（7節の記録の例にも `branch` が無い）。

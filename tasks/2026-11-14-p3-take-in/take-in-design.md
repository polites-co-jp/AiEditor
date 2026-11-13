# 取り込みの台本の設計（take-in.mjs・adopt.mjs・TAKE-IN.md）

- 担当: 蒙恬（p3-take-in）。2026-11-14
- 根拠: docs/06 の1・3・4・6・7・8節、docs/03 の5.2、docs/02 の2・6.1・7・8節、CLAUDE.md の狄仁傑の起動の注意、リーダーの判断（2026-11-14: 修理と判定の作業場所、`ext` の版の省略）

## 1. ファイル

| ファイル | 中身 |
|---|---|
| `scripts/take-in.mjs` | 入口（CLI）。`core`・`ext`・`probe-claude` |
| `scripts/adopt.mjs` | 入口（CLI）。採ると決めた版の確定 |
| `scripts/lib/take-in/steps.mjs` | 手順の並べ方と、手順の結果から次を決める関数 |
| `scripts/lib/take-in/verdict.mjs` | 判定の形（JSON Schema）、検査、台本の側の照らし合わせ、`verdict.md` の組み立て |
| `scripts/lib/take-in/claude.mjs` | `claude -p` の起動の引数の組み立て、子の環境変数、出力の読み取り、起動 |
| `scripts/lib/take-in/repair.mjs` | 当たらなかった理由の分類、衝突の印の検出、修理の依頼文、修理の結果の検査 |
| `scripts/lib/take-in/args.mjs` | 引数の読み取り、ラベル、ブランチの名前 |
| `scripts/lib/take-in/upstream-info.mjs` | 前回から後の版のリリースとアドバイザリの選び出し（と取得） |
| `scripts/lib/take-in/ext.mjs` | 拡張の取り込みの部品（前の版の取得場所を探す、取得の結果から1件を選ぶ） |
| `scripts/lib/take-in/writeback.mjs` | ToDo への書き戻しの部品を探して呼ぶ（部品は p4-watch が作る）、検知の最後の成功日時 |
| `scripts/lib/take-in/adopt.mjs` | adopt の計画を立てる純粋な関数 |
| `scripts/lib/take-in/records.mjs` | 判定の依頼文・材料の一覧・`records/builds/<label>.json` の組み立て・監査の結果の読み |
| `scripts/lib/take-in/smoke-net.mjs` | 手順 6 のスモークの3回と基準、手順 7 の通信の監査の一時の環境（docs/06 の9節） |
| `TAKE-IN.md` | `claude -p` に渡す規約（docs/06 の7.2） |

`scripts/lib/take-in/*.mjs` は読み込んでも何も走らない（副作用なし）。CLI の2つだけが走る。

## 2. 引数

```
node scripts/take-in.mjs core <tag> [オプション]
node scripts/take-in.mjs ext <id> [<version>] [オプション]
node scripts/take-in.mjs probe-claude [--claude <path>] [--out <dir>]
node scripts/adopt.mjs <label> [--force] [--no-records] [--keep-branch] [--dry-run]
```

共通のオプション（take-in）:

| オプション | 意味 | 既定 |
|---|---|---|
| `--dry-run` | 何も変えずに、手順ごとのコマンド・場所・`claude -p` の引数を JSON で出す | — |
| `--label <label>` | 版のラベル | core: `<tag>-<n>`（`records/builds/` と `records/take-in/` の既存の最大＋1）。ext: `ext-<id>-<version>` |
| `--config <local.json>` / `--build-root` / `--install-root` | `local.json` と上書き（docs/02 の6.1） | `%LOCALAPPDATA%\Shuko\local.json` |
| `--claude <path>` | `claude` の実行ファイル | PATH の `claude.exe`（`where.exe claude` の最初の .exe） |
| `--no-repair` | 修理（手順 3・5）をしない | — |
| `--max-repair <n>` | 修理の回数の上限（手順 3 と 5 で別に数える） | 3 |
| `--skip-judge` | 手順 9 を行わない（試し） | — |
| `--no-writeback` | 手順 10 の ToDo への書き戻しをしない | — |
| `--watch-state <path>` | 検知の `state.json`（最後に成功した日時を見る。書き戻しの部品にも `stateFile` として渡す） | `%LOCALAPPDATA%\Shuko\watch\state.json` |
| `--records-dir <dir>` | 試し: 記録の置き場所（`build.mjs --take-in-dir` と同じ考え。判定役はビルドリポジトリの外を読めないので、判定まで走らせるときは使わない） | `records/take-in/<label>` |
| `--builder-worktree <dir>` | 試し: 取り込みのブランチの作業ツリー（渡したときは作らない。`.git` が無くてもよい） | `<buildRoot>\take-in\<label>\repo` |

`--editor-dir <dir>`: 手順 6・7（ext は手順 4）で試すエディタ（既定 core は展開した版のフォルダ、無ければ gulp の出力。ext は `<installRoot>\current`）。

core だけ: `--commit <sha>`（既定は `git ls-remote <repository> refs/tags/<tag>` の値）、`--prev-tag <tag>`（既定は main の `upstream.json` の tag）、`--from <手順>`・`--to <手順>`（手順の名前は3節）、`--net-env <dir>`（`netaudit.ps1 -EnvDir` を作らずにこれを使う。既定は手順 7 で作る）、`--net-previous <path>`、`--net-duration <秒>`（既定 600）、`--smoke-baseline <json>`（既定 `<buildRoot>\smoke\baseline-<今の版のラベル>.json`、無ければ `baseline-official-<prev-tag>.json`）、`--repair-model <model>`。

ext だけ: `--security`（寝かせる期間を問わない。`lock-fetch --security`）、`--now <ISO 8601>`。`<version>` を省くと、寝かせる期間を満たした最新の版（`lock-fetch.mjs` の版の決め方そのもの）。台帳と同じ版になったら「新しい版が無い」で止まる（終了コード 3）。`<version>` を渡し、`lock-fetch` が別の版を選んだら（より新しく寝かせた版がある）止まる。

終了コード（take-in）: 0 = 判定まで済んだ（判定の中身は問わない）、1 = 途中で止まった、2 = 引数の誤り、3 = 取り込む新しい版が無い（ext）。
終了コード（adopt）: 0 = 済んだ、1 = 誤り、2 = 引数の誤り、4 = 判定が fail で `--force` が無い。

## 3. 本体の手順（`take-in.mjs core`）と呼ぶ台本

手順の番号は docs/06 の4節の表のまま（8 は欠番）。`coreStepOrder()` は `[1,2,3,4,5,6,7,9,10]`。

| 手順 | 名前（`--from`/`--to`） | 中身 | 呼ぶもの |
|---|---|---|---|
| 1 | `prepare` | (a) ラベルを決める。(b) タグの commit を `git ls-remote` で取る（無ければ止める）。(c) ビルドリポジトリの作業ツリー `<buildRoot>\take-in\<label>\repo` をブランチ `take-in/<label>`（main から）で作り、`upstream.json` を新しい tag・commit に書いてコミット。(d) 本家の作業ツリーを用意。(e) 前回から後のリリースとアドバイザリを取って `records/take-in/<label>/upstream/` に置く | `git -C <REPO> worktree add -b take-in/<label> <dir> main`、`node scripts/build.mjs <tag> --label <label> --commit <sha> --to prepare --record records/take-in/<label>/build-prepare.json`、GitHub の API |
| 2 | `apply` | 当て直し。衝突を残して止める | `node scripts/apply.mjs <wt> --label <label> --prev-tag <prev> --keep-conflict --checks-out records/take-in/<label>/checks.json --removals <brepo>\removals --patches <brepo>\patches --assets <brepo>\assets --overlay <brepo>\product.overlay.json --keep <brepo>\builtin\keep.json --lock <brepo>\extensions.lock.json --extensions-src <REPO>\extensions-src --build-root <buildRoot> [--config <local.json>]`（`--build-root`・`--config` は `--manifests` の既定 `<buildRoot>\cache\vsix` を take-in と同じ場所にするため。検証 M-1）。実行したコマンドは `take-in.json` の手順 2 の `command` に残す |
| 3 | `repair` | 当たらなかったら `claude -p` に直させ、手順 2 からやり直す（3回まで）。4節 | `claude -p`（修理）、`git am --continue`、`git format-patch -1 HEAD --stdout` |
| 4 | `checks` | `checks.json` の `result` が `fail` なら止める。`hold`（未分類の組み込み拡張だけ）は止めずに判定へ | — |
| 5 | `build` | 依存の導入〜zip。型検査で落ちたら `claude -p` に直させ、手順 2 からやり直す（3回まで）。通ったら `switch.ps1 <label> -Zip <zip> -Sha256 <sha> -ExpandOnly` で版のフォルダに展開（6節の注） | `node scripts/build.mjs <tag> --label <label> --commit <sha> --from install --record records/take-in/<label>/build-main.json --removals <brepo>\removals --keep <brepo>\builtin\keep.json --take-in-dir records/take-in/<label>` |
| 6 | `smoke` | スモークを `--prime` で3回。どの回も今の版の基準と比べ（`--baseline`）、1回目は `--save-baseline <buildRoot>\smoke\baseline-<label>.json`、2・3回目は `--merge-baseline` を足して3回の和を新しい版の基準にする（docs/06 の9節）。続けて「消えている」の検査。結果を `records/take-in/<label>/smoke/run-<n>/`・`smoke/baseline-<label>.json`・`absent/` に写す | `node tests/smoke-run.mjs --build <editor> --label take-in-<label>-<n> --mode built --prime --timeout 600 [--baseline <今の基準>] --save-baseline <新しい基準> [--merge-baseline]`、`node tests/absent-run.mjs --build <editor> --units <当てた単位> --expect absent --label take-in-<label>` |
| 7 | `netaudit` | 一時の環境 `<buildRoot>\take-in\<label>\netaudit-env`（`user\`・`ext\`）を作り直し、新しい版の CLI で台帳（ブランチの `extensions.lock.json`）の拡張を入れ、`user\user-data\User\settings.json` に監査が要る設定を書いてから、通信の監査（docs/06 の9節）。`--net-env` を渡したときは作らずにそれを使う | `node scripts/install-extensions.mjs --cli <新しい版>\bin\<applicationName>.cmd --portable <env>\user --extensions-dir <env>\ext --argv <env>\user\argv.json --lock <ブランチ>\extensions.lock.json --out records/take-in/<label>/netaudit-env/install-extensions.json`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <exe> -EnvDir <env> -Label take-in-<label> -DurationSeconds 600 -OutDir records/take-in/<label>/netaudit -WorkRoot <buildRoot>\take-in\<label>\netaudit-run [-Previous <前>] -Force` |
| 9 | `judge` | 材料の一覧 `judge-request.md` を書き、`claude -p --agent di-renjie` に判定させる。`verdict.json`・`verdict.md` を書く | `claude -p`（判定） |
| 10 | `record` | ブランチに変わったもの（修理したパッチ）をコミットし、`records/builds/<label>.json` を組み立て、ToDo に書き戻す | `git -C <brepo> commit`、書き戻しの部品（7節） |

`nextAction(step, result)` が次を決める（返り値 `'next' | 'repair' | 'retry' | 'hold' | 'stop' | 'done'`）。

| step | result | 返り値 |
|---|---|---|
| 1 | `ok` | `next`。そうでなければ `stop` |
| 2 | `ok` | `next`。`ok:false` は `repair`（`repairable:false` か `noRepair:true` なら `stop`） |
| 3 | `ok` | `retry`（手順 2 から）。`ok:false` は `attempt < max`（既定3）なら `repair`、そうでなければ `stop` |
| 4 | `ok` | `next`。`ok:false, unclassifiedOnly:true` は `hold`（止めない）。ほかは `stop` |
| 5 | `ok` | `next`。`ok:false, typecheck:true, attempt < max` は `repair`。ほかは `stop` |
| 6・7・9 | どれでも | `next`（結果は判定に渡す） |
| 10 | どれでも | `done`（書けなかったことは記録に残し、止めない） |

## 4. 修理（手順 3・5）

### 4.1 当たらなかった理由の分類（`classifyApplyFailure(checks)`）

`checks.json` の `stoppedAt`（`apply.mjs` の出力）から決める。返り値 `{ kind, unitId, patchName, file, conflicts, message, repairable }`。

| kind | 条件 | Claude が直すもの | 台本がそのあと行うこと |
|---|---|---|---|
| `removeLines` | `phase:"unit"` で message に `removeLines:` | `<brepo>\removals\<id>\unit.json` の `removeLines` | なし |
| `editsConflict` | `phase:"unit"` で message に `edits.patch が当たらない` | 作業ツリーの衝突（`git am` は途中で残っている） | 衝突の印が残っていないことを確かめ、`git add -A`、`git -c user.name=shuko-apply -c user.email=apply@shuko.invalid am --continue`、`git format-patch -1 HEAD --stdout` を単位の `edits.patch` に書く |
| `patchConflict` | `phase:"patch"` | 同上 | 同上を `patches/<name>` に書く |
| `missing` | `phase:"unit"` で `が無い`（removeLines・removeDependencies の対象のファイルが消えた） | `unit.json` | なし |
| （修理しない） | `phase` が `inputs`・`worktree`・`overlay`・`builtinExtensions`、`after の単位が当たっていない` | — | 止める（`repairable:false`） |

### 4.2 型検査の誤り（手順 5）

Claude は作業ツリーのファイルを直し、直したファイルごとに、どの単位（`unit:<id>`）かパッチ（`patch:<name>`）の分かを構造化出力で返す。台本は、ファイルごとの差分を取り、単位・パッチごとに、`checks.json` のその単位の最後のコミット（edits が無ければ ops）に戻して `git apply --3way` し、edits のコミットを作り直す（あれば `--amend`）。`format-patch` で `edits.patch`（無かった単位は作って `unit.json` に `"patch": "edits.patch"` を足す）か `patches/<name>` に書く。どれにも属さない直し（`unknown`）があれば止める。

### 4.3 修理の後

- ビルドリポジトリの作業ツリーの変更が `removals/` と `patches/` の中だけかを `git status --porcelain --untracked-files=all` で確かめる（修理の前からあった行は除く）。外に変更があれば、その変更を戻して修理の失敗として数える（規約 `TAKE-IN.md` の守りを台本の側でも確かめる）。`removals/`・`patches/` の中身の印（SHA-256）が修理の前と同じなら「何も変わっていない」として失敗。
- 本家の作業ツリーを `git am --abort`（途中なら）、`git reset --hard <タグの commit>`、`git clean -fd` で戻し、手順 2 からやり直す。
- 各回の材料と結果を `records/take-in/<label>/repair-<n>/`（`request.md`・`claude-args.json`・`claude-output.json`・`changes.diff`・`result.json`）に残す。

## 5. `claude -p` の起動（`buildClaudeInvocation`）

```js
buildClaudeInvocation({ kind, repoRoot, worktree, env, prompt, claudePath, schema, builderWorktree, model, maxTurns })
  → { cmd, args, cwd, env, input, envRemoved }
```

- `kind: 'verdict'`（判定）: `cwd = repoRoot`（ビルドリポジトリの直下。リーダーの判断 1、CLAUDE.md）。
  `args = ['-p', '--agent', 'di-renjie', '--output-format', 'json', '--json-schema', <判定の schema>, '--permission-mode', 'dontAsk', '--strict-mcp-config', '--no-session-persistence', '--max-turns', '60', <短い依頼文>]`。
  `--bare` を付けない。`--setting-sources` を付けない（project を外さない）。材料はすべて `records/take-in/<label>/` に写し、依頼文はそのパスの一覧（相対パス）を書く。
- `kind: 'repair'`（修理）: `cwd = worktree`（本家の作業ツリー）。`--add-dir <builderWorktree か repoRoot>`（ビルドリポジトリ。リーダーの判断 1）。
  `args = ['-p', '--output-format', 'json', '--json-schema', <修理の schema>, '--tools', 'Read,Glob,Grep,Edit,Write', '--permission-mode', 'acceptEdits', '--strict-mcp-config', '--disallowedTools', 'mcp__*', '--append-system-prompt-file', <TAKE-IN.md>, '--add-dir', <ビルドリポジトリ>, '--no-session-persistence', '--max-turns', '80', <短い依頼文>]`。依頼の本文は標準入力で渡す（`input`）。
  Bash は渡さない（`git diff`・`git status` の中身は台本が依頼文に入れる。`switch.ps1`・`install-extensions.mjs` を実行する手段を持たせない）。`--strict-mcp-config` は本家の作業ツリーの `.mcp.json`（1.146.0 にある。`-p` では承認なしに接続される）を読ませないため。
- `env`: 渡された env の写しから `ANTHROPIC_API_KEY`・`ANTHROPIC_AUTH_TOKEN`・`CLAUDE_CODE_SIMPLE`（`--bare` と同じになる）・`CLAUDECODE`・`CLAUDE_CODE_ENTRYPOINT` と、`build.mjs` の `childEnv` が外すもの（`ELECTRON_RUN_AS_NODE` など）を外す。呼び出し側の env は変えない。`envRemoved` に外した名前（値は持たない）。
- `parseClaudeOutput(stdout)` → `{ ok, structured, result, isError, subtype, sessionId, costUsd, numTurns, error }`。`--output-format json` の1つの JSON の `structured_output` を読む（無ければ `ok:false`）。
- 実行ファイル: `claudeCandidates(env)`（`where.exe claude` と `%USERPROFILE%\.local\bin\claude.exe`）→ `resolveClaudeCommand(candidates)`。`.exe` があればそれ。無ければ npm の `.cmd` の包みの中身を `parseCmdShim(text, dir)` で読み、中の `.exe`（または node で走らせる `.js`）を直接起動する。`.cmd` を cmd.exe 経由で起動すると、`--json-schema` の JSON などの引数の引用が崩れるため。この PC は npm の包み（`%APPDATA%\npm\claude.cmd` → `node_modules\@anthropic-ai\claude-code\bin\claude.exe`、2.1.318）だった。`buildClaudeInvocation` の `claudePath` は文字列か `{ cmd, prefixArgs }`。
- `--no-repair` で止めたときは、修理の依頼文と起動の形だけを `repair-preview/`（`request.md`・`claude-args.json`）に残す（手で直すときの材料）。

## 6. 版のフォルダへの展開（手順 5 の終わり）

docs/06 の9節（リーダーの判断）: 取り込みは `switch.ps1 <label> -Zip <zip> -Sha256 <sha> -ExpandOnly` で展開と確かめだけを行い、`current`・`history.txt`・`backups` に触らない。`switch.ps1` の `-ExpandOnly` は別の蒙恬が足した（2026-11-14 に、`[switch]$ExpandOnly`・使い方の行・`current` に触らずに終わる処理を確かめた）。take-in はファイルに `$ExpandOnly` があるときだけ呼び、無ければ展開を `blocked` と記録して手順 6・7 を gulp の出力に向ける（古い `switch.ps1` との組み合わせの守り）。版のフォルダが既にあれば、`-Zip`・`-Sha256` を外して確かめだけを行い、警告を残す（`-Zip` は既にあるラベルを拒むため）。

## 6.1 スモークの基準と通信の監査の環境（docs/06 の9節）

- スモークの基準: 今の版の基準は `--smoke-baseline`、無ければ `<buildRoot>\smoke\baseline-<今の版のラベル>.json`、無ければ `baseline-official-<前のタグ>.json`。新しい版の基準は `<buildRoot>\smoke\baseline-<label>.json`（`smoke-run.mjs` の置き場所 `C:\b\smoke` と同じ。`buildRoot` を変えたときは `--smoke-baseline` で今の基準を渡す）。手順 6 の結果: 3回とも 0 → `ok`、どれかが 1（FAIL あり）→ `failed`、2 か起動できない → `error`。「消えている」の検査が通らなければ `failed`。`smoke.status` が `ok` でなければ判定は合格にならない。
- 通信の監査の環境: `netaudit.ps1`（measure.ps1 の `New-RunDataDir`）は `-EnvDir` の `user\` と `ext\` を実行ごとの場所に写し、`user\` を `VSCODE_PORTABLE`、`user\user-data` をユーザーのデータ、`ext\` を `--extensions-dir` にして起動する（p0-env.ps1 と同じ形）。take-in はこの形で作る。設定は計測と監査の台本が要るもの（`scripts/lib/p0-common.ps1` の `P0MeasureSettings` のうち `task.allowAutomaticTasks: on`・`security.workspace.trust.enabled: false`。`basedpyright.importStrategy` は自作のビルドでは mydist の既定）。記録として `take-in-env.json` を置く（`p0-env.json` は置かない。`-Exe` を渡すので要らない）。`-WorkRoot` は `<buildRoot>\take-in\<label>\netaudit-run`（ネットのログはその親の `netlog\`。リポジトリの外）。

## 7. 記録の形（`records/take-in/<label>/`）

| ファイル | 中身 |
|---|---|
| `take-in.json` | 実行の記録: `{ kind, label, tag, commit, prevTag, branch, paths, steps: [{ n, name, status, startedAt, finishedAt, exitCode, message, failure?, ... }], repairs: [...], claude: [{ kind, cmd, args, cwd, envRemoved, exitCode, ok, costUsd }], watch, warnings, verdict, result, message }`。`result` は `judged`（判定まで済んだ）・`partial`（`--to` で途中まで）・`judge-failed`（判定を受け取れない）・`stopped`（止める条件に当たった）・`crashed` |
| `logs/` | 呼んだ台本の出力（`prepare.log`・`apply-<n>.log`・`build-<n>.log`・`smoke.log`・`absent.log`・`netaudit.log`） |
| `repair-preview/` | `--no-repair` で止めたときの、修理の依頼文と起動の形 |
| `build-prepare.json`・`build-main.json` | `build.mjs` の記録（区切って走らせたもの） |
| `checks.json`・`lockfile.diff` | `apply.mjs` の出力 |
| `upstream/releases.json`・`advisories.json`・`release-notes-v1_<minor>.txt` | 前回から後の版のリリース・アドバイザリ・リリースノート |
| `repair-<n>/` | 4.3 |
| `typecheck-tail.txt` | 型検査のログの末尾 |
| `smoke/`・`absent/` | スモークの結果の写し |
| `netaudit/` | 通信の監査の出力 |
| `branch-diff.txt` | ブランチの main からの差（`git diff --stat` と修理したパッチ） |
| `judge-request.md`・`judge-output.json` | 判定の依頼文と、`claude -p` の出力そのまま |
| `verdict.json`・`verdict.md` | 判定（docs/06 の7.3）。`verdict.json` は判定役の構造化出力に、台本の照らし合わせ `scriptGuard: { violations }` を足したもの |
| `writeback.json` | ToDo への書き戻しの結果 |

`records/builds/<label>.json` は、`build-main.json` を元に、`units`・`patches`（`checks.json` から）と `upstream`（tag・commit）を埋めて書く（`composeBuildRecord`）。

拡張（`ext`）の記録も同じ場所（ラベル `ext-<id>-<version>`）に `fetch-result.json`・`verify-result.json`・`lock-diff.json`・`smoke/`・判定を置く。

## 8. 拡張の手順（`take-in.mjs ext`）

| 手順 | 中身 | 呼ぶもの |
|---|---|---|
| 1 fetch | 取得。置き場所は実行ごと `<buildRoot>\take-in\ext\<id>\<時刻>\` | `node scripts/lock-fetch.mjs --lock extensions.lock.json --only <id> --out <dir>`（版を渡したときは `--seed <dir>\seed.json`）[`--security <id>`] |
| 2 verify | docs/04 の4節の1〜9。台帳をブランチ `take-in/ext-<id>-<version>` の作業ツリーに書く | `node scripts/lock-verify.mjs --dir <dir> --only <id> --vscode <今の版> --prev-lock extensions.lock.json --prev-dir <前の版の取得場所> --write-lock <brepo>\extensions.lock.json --result records/take-in/<label>/verify-result.json` |
| 3 diff | manifest とファイル一覧の差 | `node scripts/lock-diff.mjs --from <前> --to <新> --json` |
| 4 smoke | 一時的な置き場所でのスモーク（10） | `node tests/smoke-run.mjs --build <今の版> --label take-in-<label> --mode built --lock <brepo>\extensions.lock.json --prime --baseline <json>` |
| 5 judge・record | 台帳の行の `verdict` を `records/take-in/<label>/verdict.md` に直してコミット、判定、書き戻し | `claude -p --agent di-renjie` |

前の版の取得場所（`findPrevFetchDir`）: `<buildRoot>\take-in\ext\<id>\*\`、`<buildRoot>\cache\vsix\`、`C:\b\p0\vsix\` のうち、`fetch-result.json` にその ID・前の版の行があるもの（新しい順）。

## 9. ToDo への書き戻しの約束（p4-watch と合わせる）

`scripts/lib/take-in/writeback.mjs` は、`scripts/lib/notion*.mjs`（先）と `tools/watch/lib/*.mjs` のうち `writeBackTakeIn`（p4-watch の `scripts/lib/notion-todo.mjs` が書き出す。2026-11-14 に形を確かめた）か `writeTakeInResult` を書き出しているものを探して呼ぶ。無ければ `writeback.json` に「部品が無い」と書いて続ける（docs/06 の4節の10: 止めない）。書けなかったことは `verdict.md` の頭と `verdict.json` の `writeback` に書く。

```js
// p4-watch の部品（scripts/lib/notion-todo.mjs）。toWritebackArgs(payload) がこの形にする
writeBackTakeIn({ kind: 'core' | 'ext', extId, label, verdict, reasons, verdictPath, recommendation, stateFile? })
  → Promise<{ ok: boolean, pageId: string | null, reason: string | null }>   // 例外を投げない
```

ToDo のページ ID とトークンは部品の側（`state.json` と `read-secret.ps1`）で扱う。take-in はトークンに触らない。`--no-writeback` のときと、判定していないとき（`--skip-judge`）は呼ばない。

### 9.1 書き戻す ToDo の選び方（2026-11-14、検証 M-3 の反映）

書くのは開いている ToDo だけ（`notion-todo.mjs` の `isOpenPage`: ページがあり、ごみ箱・アーカイブに無く、状態が Done・Archived でない）。

| 場合 | 扱い | 返り値 |
|---|---|---|
| `state.json` の覚えたページが開いている | そのページの本文に判定の要約を足し、状態を In progress にする | `{ ok: true, pageId }` |
| 覚えたページが閉じている（Done・Archived・ごみ箱） | そのページには書かず、状態も変えない（ユーザーが閉じた ToDo を台本が開き直さない）。データソースを題名の前方一致で探し、開いているものがあればそこに書く | 見つかれば `{ ok: true, pageId, closedPageId }`、無ければ `{ ok: false, closedPageId, reason }` |
| 覚えたページが無い・消えている | データソースを探し、開いているものがあれば書く | 見つかれば `{ ok: true, pageId }`、無ければ `{ ok: false, reason }` |
| 開いている ToDo がどこにも無い | 新しい ToDo は作らない（ToDo を作るのは検知の役目） | `{ ok: false, reason }` |

`ok: false` のとき、take-in は止めずに `writeback.json` と `verdict.md` の頭（「ToDo への書き戻し: できなかった（理由）」）と `take-in.json` の `warnings` に書く（docs/06 の4節の10）。後から手で書き戻すときは `node tools/watch/watch.mjs --write-back <verdict.json> --target core|ext:<ID>`。

拡張の対象の ID は、台帳の `id` を大文字小文字のまま渡す（検証 M-2）。検知が ToDo の題名に書く ID（例 `MS-CEINTL.vscode-language-pack-ja`）と同じにしないと、`state.json` が無いときの題名の前方一致の検索が当たらないおそれがある（偽の Notion は大文字小文字を区別し、試しで小文字の ID は当たらなかった。本物の Notion の `starts_with` が区別するかは確かめていない。同じ文字にしておけばどちらでも当たる）。

検知の最後の成功日時: `readWatchStatus({ statePath, now })` → `{ found, lastSuccessAt, ageDays, warn }`。`state.json` の `lastSuccessAt`（ISO 8601）を読む（キーの名前は p4-watch と合わせる）。3日より古ければ `warn: true` で、画面と `take-in.json` に出す。

## 10. adopt.mjs

`planAdopt({ label, verdict, branchExists, onMain, clean, tagExists, force, records, keepBranch })` → `{ ok, errors, steps }`。手順:

1. ビルドリポジトリ（REPO）が main にいて、追跡しているファイルに変更が無いこと。ブランチ `take-in/<label>` があること。タグ `<label>` がまだ無いこと。
2. `records/take-in/<label>/verdict.json` を読む。`fail` なら `--force` が無ければ止める（終了コード 4）。判定が無ければ止める。
3. `git merge --no-ff take-in/<label> -m "取り込み <label> を採る"`。衝突したら `git merge --abort` して止める。
4. core なら `upstream.json` が判定の tag になったことを確かめる（確定）。
5. `records/take-in/<label>/` と `records/builds/<label>.json` をコミット（`--no-records` で飛ばす）。
6. `git tag -a <label> -m "<label>: <verdict> / <recommendation>"`。
7. ブランチの作業ツリー `<buildRoot>\take-in\<label>\repo` を `git worktree remove` し、ブランチを `git branch -d`（`--keep-branch` で残す）。
8. 次にユーザーが行うことを出す: core は `switch.ps1 <label>`（展開していなければ `-Zip <zip> -Sha256 <sha>`）、ext は `node scripts/install-extensions.mjs`。

`--dry-run` は 1・2 の確かめだけをして計画を出す。プッシュはしない。

## 11. テストの入口（関数）

| 関数 | モジュール | 入出力 |
|---|---|---|
| `coreStepOrder()` | steps.mjs | `[1,2,3,4,5,6,7,9,10]` |
| `CORE_STEPS` | steps.mjs | `[{ n, name, title }]` |
| `nextAction(step, result)` | steps.mjs | 3節の表 |
| `validateVerdict(v, { label? })` | verdict.mjs | 誤りの文字列の配列（空なら正しい）。オブジェクトでなければ誤り1つ。必須のキー（docs/06 の7.3 の11個）、`verdict` の列挙、`network.newHosts` は配列、`relevant` は真偽値、`proposal` は `keep` か `removal-unit:<ID>`、`pass` なのに `build`・`checks` が `ok`/`n/a` でない・`smoke.auto` が `ok`/`n/a` でない・`newHosts` が空でない、は矛盾 |
| `guardVerdict(v, facts)` | verdict.mjs | 台本が知る事実（`{ checks, build, smokeAuto, netaudit, newHosts }`）と判定の食い違い → 違反の配列 |
| `VERDICT_SCHEMA` | verdict.mjs | `--json-schema` に渡す JSON Schema |
| `renderVerdictMarkdown(v, guard)` | verdict.mjs | `verdict.md` の本文 |
| `buildClaudeInvocation(opts)` | claude.mjs | 5節 |
| `claudeChildEnv(env)` | claude.mjs | `{ env, removed }` |
| `parseClaudeOutput(text)` | claude.mjs | 5節 |
| `classifyApplyFailure(checks)` | repair.mjs | 4.1 |
| `findConflictMarkers(text)` | repair.mjs | 衝突の印の行番号の配列 |
| `normalizeRepoPath(p)` | repair.mjs | `/` 区切りにし、`.` と空の区切りを除き、`..` を畳んだ相対パス。絶対パス（`/`・`\` で始まる、UNC）・ドライブ文字（`C:`）・根の外へ出る `..` は `null` |
| `isInsideAllowed(p, allowed)` | repair.mjs | 正規化してから `removals/`・`patches/` の中（フォルダそのものを含む）に留まるか。`removals/../src/x.ts`・`../x`・`C:/x`・`/x` は外 |
| `outsideAllowed(porcelain)` | repair.mjs | `git status --porcelain` の行のうち `removals/`・`patches/` の外のパス（`isInsideAllowed` で見る。名前を変えた行は両方を見る。引用を外す）。2026-11-14 に曹参のテストの指摘（`startsWith` だけで `removals/../src/x.ts` を許した）で直した |
| `groupFixes(fixes)` | repair.mjs | `[{ file, owner }]` → `{ groups: { "unit:<id>": [file] }, unknown: [file] }` |
| `parseTakeInArgs(argv)` | args.mjs | 2節。誤りは `ArgError` |
| `extLabel(id, version)`・`branchFor(label)` | args.mjs | `ext-<id>-<version>`・`take-in/<label>` |
| `selectReleases(releases, prevTag, newTag)` | upstream-info.mjs | prev より後で new 以下の版（新しい順） |
| `selectAdvisories(advisories, { prevTag, newTag, since })` | upstream-info.mjs | 関係するアドバイザリ |
| `findPrevFetchDir(candidates, id, version)` | ext.mjs | 見つかった置き場所か null |
| `readWatchStatus({ statePath, now, read? })` | writeback.mjs | 9節 |
| `toWritebackArgs(payload)` | writeback.mjs | take-in の書き戻しの中身 → `writeBackTakeIn` の引数 |
| `writeBack(repoRoot, payload, { find })` | writeback.mjs | `find` を差し替えて部品の有無・例外・`reason` の写しを確かめる。止めない |
| `checksOutcome(checks)` | steps.mjs | `checks.json` → 手順 4 の `nextAction` に渡す `{ ok, unclassifiedOnly, failed, held, reason }` |
| `selectCoreSteps(from, to)` | steps.mjs | `--from`/`--to` の手順（名前か番号）。逆順・知らない名前は例外 |
| `parseLsRemote(text, tag)` | upstream-info.mjs | `git ls-remote` の出力 → commit（`^{}` を優先。無ければ null） |
| `minorsBetween(prev, new)`・`htmlToText(html)`・`versionsIn(text)` | upstream-info.mjs | リリースノートの minor の一覧、HTML の文字化、版の拾い出し |
| `decideExtVersion(item, { requested, ledgerVersion })` | ext.mjs | `{ ok, version, reason, noNewVersion }`。版の指定と違う・台帳と同じ（新しい版なし）を止める |
| `seedFor(lock, id, version)`・`setLedgerVerdict(lock, id, version, path)`・`pickFetchedItem(fetchResult, id)` | ext.mjs | lock-fetch の seed、台帳の `verdict` の書き換え、取得の結果の1件 |
| `parseCmdShim(text, dir, nodePath)`・`resolveClaudeCommand(candidates, { read, exists })`・`claudeCommandOf(p)` | claude.mjs | 5節の実行ファイル |
| `describeInvocation(inv)` | claude.mjs | 記録の形（schema は長さだけ、env は外した名前だけ） |
| `buildRepairRequest(ctx)`・`REPAIR_PROMPT` | repair.mjs | 修理の依頼文（標準入力で渡す） |
| `buildJudgeRequest(ctx)`・`JUDGE_PROMPT(path)`・`listMaterials(dir, repoRoot)`・`listIssues(repoRoot)` | records.mjs | 判定の依頼文と材料の一覧（相対パス） |
| `factsFrom({ kind, checks, buildMain, smoke, netaudit })`・`auditHosts(destinations)`・`composeBuildRecord(...)` | records.mjs | 台本が知る事実、`netaudit.ps1` の `destinations.json`（`{ Meta, Destinations: [{ Group, HostKey, New, Allowed }] }`）の読み、`records/builds/<label>.json` |
| `todoSummary(v, path)` | verdict.mjs | ToDo に書く1行の要約 |
| `labelKind(label)` | adopt.mjs（lib） | `ext-` で始まれば `ext` |
| `smokeRunArgs({ editorDir, label, currentBaseline, newBaseline, runs, timeout, lock })` | smoke-net.mjs | 3回分の `smoke-run.mjs` の引数。全回 `--prime` と `--save-baseline`、`currentBaseline` があれば全回 `--baseline`、2回目から `--merge-baseline`。ラベルは `take-in-<label>-<n>` |
| `newBaselinePath(smokeRoot, label)` | smoke-net.mjs | `<smokeRoot>\baseline-<label>.json` |
| `summarizeSmoke(runs, { absent, baselineSaved, currentBaseline })` | smoke-net.mjs | `{ status: ok \| failed \| error \| skipped, runs, passedRuns, comparedWith, baselineSaved, absent }`（6.1） |
| `NETAUDIT_SETTINGS`・`netEnvLayout(envDir)`・`netEnvInstallArgs(...)`・`netauditArgs(...)` | smoke-net.mjs | 通信の監査の環境の形と、install-extensions.mjs・netaudit.ps1 の引数 |
| `planAdopt(opts)` | adopt.mjs（lib） | 10節 |

CLI（副作用の無い範囲）: `node scripts/take-in.mjs` は使い方を出して 2、`core` だけ・`ext` だけ・知らないサブコマンドは 2。`node scripts/adopt.mjs` は 2。`--dry-run` は計画の JSON を出して 0。

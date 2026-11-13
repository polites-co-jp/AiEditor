# 引き継ぎ（p3-take-in）

- 担当: 蒙恬。2026-11-14
- 結果: 完了（依頼の 1〜4。ビルドの要る手順は走らせていない。修理の `claude -p` は本物では走らせていない）

## 追記（2026-11-14、リーダーの判断 docs/06 の9節の反映）

- 結果: 完了。
- 直したもの: `scripts/take-in.mjs`、`scripts/lib/take-in/args.mjs`、新しく `scripts/lib/take-in/smoke-net.mjs`。あわせて `take-in-design.md` の1・2・3・6・6.1・11節、`trial-log.md` の9節、`doc-corrections.md` の頭書きと12・13を直した。
- 1（展開）: take-in は `switch.ps1 <label> -Zip <zip> -Sha256 <sha> -ExpandOnly` を呼ぶ形のまま。
  - 別の蒙恬が入れた `-ExpandOnly`（引数の形、使い方の行、`current` に触らずに終わる処理）を読んで、呼び方が合うことを確かめた。dry-run の `expandOnlySupported` は `true` になった。
  - 版のフォルダが既にあるとき（やり直し）は、`-Zip`・`-Sha256` を外して確かめだけを行い、警告を残すようにした。
- 8（通信の監査の環境）: 手順 7 で次の順に行う。`--net-env` は「作らずにこれを使う」の上書きとして残した。
  1. `<buildRoot>\take-in\<label>\netaudit-env` を作り直す。
  2. 新しい版の CLI で `install-extensions.mjs --portable <env>\user --extensions-dir <env>\ext --argv <env>\user\argv.json --lock <ブランチの台帳>` を走らせる。
  3. 監査が要る設定（`task.allowAutomaticTasks: on`、`security.workspace.trust.enabled: false`）を `user\user-data\User\settings.json` に書く。
  4. `netaudit.ps1 -EnvDir <env> -WorkRoot <buildRoot>\take-in\<label>\netaudit-run` に渡す。
- 9（スモークの基準）: 手順 6 で `smoke-run.mjs --prime` を3回走らせ、`<buildRoot>\smoke\baseline-<label>.json` に3回の和を残す。
  - 引数: どの回も今の版の基準を `--baseline` で渡す。1回目は `--save-baseline`、2・3回目は `--merge-baseline` も付ける。
  - 結果の決め方: 3回とも 0 なら `ok`、FAIL があれば `failed`、台本の誤りなら `error`。
  - 3回の結果と新しい基準は `records/take-in/<label>/smoke/` に写す。
- 試しで確かめたこと（`trial-log.md` の9節）: 本家の公式 1.146.0 を `--editor-dir` で渡し、手順 6・7 を走らせた。
  - スモーク: 3回走り、`runs: 3` の基準ができた。FAIL は公式の zip で予期どおりの basedpyright の2件。
  - 環境づくり: 台帳の8件が入った。
  - 監査: 60 秒の `netaudit.ps1` が、作った環境で最後まで走った。
  - 今の版の基準との比べは、この試しでは基準のファイルが無く働かなかった。引数の形は dry-run で確かめた。
- `netaudit.ps1` と合わない点（`doc-corrections.md` の12。台本は書き換えていない）:
  - 作業場所と開く2つのファイルを、Phase 0 の物（`<repo>\tmp\ws`、`C:\b\p0\ws-info.json`）から読む。取り込みもそれに頼る。
  - 監査が要る設定が `p0-common.ps1` と `smoke-net.mjs` の2か所にある。
  - 最初の取り込みでは前の版の宛先の一覧が無い。
- `smoke-run.mjs` は、`C:\b\smoke\runs\` の古い実行を最新10個まで消す（`doc-corrections.md` の13）。取り込みは1回に3つの実行を作るので、ほかの人の実行が早く消えうる。
- テストの入口を足した（`smoke-net.mjs`）:
  - `smokeRunArgs`: 3回分の引数を返す。全回に `--prime`・`--save-baseline`、基準があれば全回に `--baseline`、2回目からは `--merge-baseline`。
  - `summarizeSmoke`: 終了コードの組から ok・failed・error・skipped を返す。「消えている」の検査が通らなければ failed。
  - そのほか `newBaselinePath`・`netEnvLayout`・`netEnvInstallArgs`・`netauditArgs`・`NETAUDIT_SETTINGS`。

## 追記2（2026-11-14、曹参のテストの指摘: `outsideAllowed`）

- `scripts/lib/take-in/repair.mjs` を直した。`outsideAllowed` は `startsWith` だけで `removals/../src/x.ts` を許していた。
  - `normalizeRepoPath`: `/` 区切りにし、`.` を除き、`..` を畳む。絶対パス・UNC・ドライブ文字・根の外へ出る `..` は null を返す。
  - `isInsideAllowed`: 正規化してから、`removals/`・`patches/` の中に留まるかを見る。
  - 名前を変えた行（`R a -> b`）は、両方のパスを見る。
- `scripts/take-in.mjs` の守り（`guardBuilder`）も直した。戻すときは、正規化してビルドリポジトリの作業ツリーの中に留まるものだけに触る。
- 試し（`trial-log.md` の10節）: 偽の claude に `removals\..\outside-by-fake.txt` を書かせると、守りが「外を変えた（戻した）: outside-by-fake.txt」で修理を失敗と数え、そのファイルを消した。
  - 関数を直接走らせる許可が無いので、`removals/../src/x.ts`・`C:/x`・`/x` などの組は曹参のテストで確かめてほしい。
- テストの入口: `normalizeRepoPath(p)`、`isInsideAllowed(p, allowed)`、`outsideAllowed(porcelain)`（repair.mjs）。
  - 期待する値: `removals/../src/x.ts`・`../x`・`C:/x`・`C:x`・`/x`・`\\srv\x` は外。
  - 中とみなすもの: `removals/A-1/edits.patch`・`removals/A-1/../B-2/unit.json`（中に留まる）・`removals/`（フォルダそのもの）・`patches\20-x.patch`。

## 追記3（2026-11-14、検証 p34-verify の軽微な指摘 M-1〜M-3）

- **M-1**（`scripts/take-in.mjs`）: 手順 2 で `apply.mjs` に `--build-root`・`--config` を渡すようにした（`corePlan.apply` に `common` を足した）。
  - 試し: `--build-root C:/b` を付けて手順 2 を走らせた（`C:\b\take-in-trial\t11`・`t12`）。
  - `take-in.json` の手順 2 の `command` に `--build-root C:\b` が入った（記録に残すようにした）。`checks.json` の `inputs.manifests` は `C:\b\cache\vsix` だった。
- **M-2**（`scripts/take-in.mjs`）: ext の書き戻しには、台帳の `entry.id` を大文字小文字のまま渡すようにした。
  - 試し: `watch.mjs --write-back ... --notion-fake` で、題名が `取り込みの検証: 拡張 MS-CEINTL.vscode-language-pack-ja 1.132.0` の ToDo を相手にした。
  - `--target ext:MS-CEINTL.vscode-language-pack-ja` では当たった。小文字の `ext:ms-ceintl.vscode-language-pack-ja` では「開いている ToDo が見つからない」になった（直した理由の確かめ）。
- **M-3**（`scripts/lib/notion-todo.mjs` の `writeBackTakeIn`。p4-watch の担当のファイルだが、リーダーの許しで直した）: 開いている ToDo（`isOpenPage`）にだけ書く。
  - 覚えたページが閉じていれば、書かず、状態も変えない。開いているものを探し、無ければ `{ ok: false, closedPageId, reason }` を返す。
  - 返り値に `closedPageId` を足した。扱いの表は `take-in-design.md` の9.1。
  - 試し（`C:\b\take-in-trial\m3\`、偽の Notion）:
    1. 覚えたページが Done で、ほかに無い → `ok: false`、`closedPageId: "done-page"`。Done のページへの `updatePage`・`appendBlockChildren` の呼び出しは無く、状態は Done のまま。
    2. 開いている ToDo を足す → `ok: true`、`pageId: "open-page"`。開いているページだけが In progress になり、本文に要約が足された。Done のページはそのまま。
- `node --check` は `take-in.mjs`・`notion-todo.mjs` とも通った。
- p4-watch の `watch-design.md` には、`writeBackTakeIn` の返り値の `closedPageId` と、閉じたページには書かないことを足す必要がある（その書き物は p4-watch の担当なので触っていない）。
- テストの入口: `writeBackTakeIn({ kind, extId, ..., notion: <差し替え>, stateFile })`。
  - 覚えたページが Done・Archived・`in_trash` → 書かない（`updatePage`・`appendBlockChildren` が呼ばれない）。
  - 開いているページが別にある → そこに書く。
  - 無い → `ok: false`。

## 成果物

- `TAKE-IN.md`（`claude -p` に渡す規約。docs/06 の7.2、コミットの名前 `shuko-apply <apply@shuko.invalid>`、判定の基準と形）
- `scripts/take-in.mjs`（`core <tag>`・`ext <id> [<version>]`・`probe-claude`）
- `scripts/adopt.mjs`
- `scripts/lib/take-in/`: `steps.mjs`・`verdict.mjs`・`claude.mjs`・`repair.mjs`・`args.mjs`・`upstream-info.mjs`・`ext.mjs`・`writeback.mjs`・`records.mjs`・`adopt.mjs`
- このディレクトリ: `take-in-design.md`（引数・手順と呼ぶ台本・関数の入出力・記録の形）、`trial-log.md`、`doc-corrections.md`、`trial/probe/`（本物の起動の出力）

## 要点

1. `take-in.mjs core <tag>` は docs/06 の4節の手順 1〜10（8 は欠番）を、既にある台本（`build.mjs --to prepare`、`apply.mjs --keep-conflict --prev-tag`、`build.mjs --from install`、`smoke-run.mjs`・`absent-run.mjs`、`netaudit.ps1`）を呼んで進める。修理（手順 3・5）と判定（手順 9）は `claude -p` を子のプロセスで起動する。
2. 修理は本家の作業ツリーで、取り込みのブランチ `take-in/<label>` の作業ツリー（`<buildRoot>\take-in\<label>\repo`）を `--add-dir` で渡す。判定は `--agent di-renjie`、作業場所はビルドリポジトリの直下で、材料は `records/take-in/<label>/` に写す（リーダーの判断 1）。子の環境変数から `ANTHROPIC_API_KEY`・`ANTHROPIC_AUTH_TOKEN`・`CLAUDE_CODE_SIMPLE`・`CLAUDECODE` などを外す。`--bare` を付けず、`--setting-sources` も付けない。
3. 判定は `--json-schema` の構造化出力で受け、`validateVerdict` で形を、`guardVerdict` で台本の記録との食い違いを確かめ、`verdict.json`・`verdict.md` を書く。食い違いは判定を書き換えず、`verdict.md` の頭に出す。
4. `ext` は版を省くと寝かせる期間を満たした最新（`lock-fetch.mjs` の決め方。リーダーの判断 2）。台帳と同じ版なら終了コード 3。
5. `adopt.mjs <label>` は main・変更なし・ブランチあり・判定あり（fail は `--force`）を確かめ、マージ・記録のコミット・注釈つきタグを行う。プッシュはしない。

## 確かめたこと（詳しくは `trial-log.md`）

- `node --check`: 12 本とも通った。
- 引数の誤り 5 通りが終了コード 2 と使い方を出した。
- 本物の `claude -p` の起動 1 回（`probe-claude`）: `--agent di-renjie --output-format json --json-schema ... --permission-mode dontAsk --strict-mcp-config --no-session-persistence --max-turns 5`、作業場所はリポジトリの直下。終了 0、`structured_output` は `{"ok":true,"agent":"di-renjie"}`、道具 4 つ、モデル opus、ログインの資格情報で動いた（API キーなし）、プロジェクトのフックが読まれた。
- dry-run（core・ext・adopt）が計画とコマンドを出した。
- 本家 1.145.3 の作業ツリーで、試しの単位を使って、手順 2 の止まり方（removeLines、edits.patch の衝突）、手順 4 の止まり方、偽の claude による修理の一巡（衝突 → 修理 → `am --continue` → `format-patch` で `edits.patch` を書き戻す → 作業ツリーを戻す → 当て直しが通る）、偽の判定役による手順 9・10 を確かめた。試しで見つけた 7 点は直した（`trial-log.md` の7節）。

## テストの入口（曹参へ）

`tests/p34/api.mjs` の4つ（`coreStepOrder`・`nextAction`・`validateVerdict`・`buildClaudeInvocation`）はこの名前で書き出した（`scripts/lib/take-in/steps.mjs`・`verdict.mjs`・`claude.mjs`）。`validateVerdict` は誤りの文字列の配列を返す（空なら正しい）。読み比べた限り、`tests/take-in.test.mjs` の期待と合う（`node --test` は私の許可に無く、走らせていない）。

ほかに試すとよいもの（`take-in-design.md` の11節に一覧）:

- `nextAction(5, { ok: false, typecheck: true, attempt: 0 })` → `'repair'`、`attempt: 3` → `'stop'`、`noRepair: true` → `'stop'`。`nextAction(2, { ok: false, repairable: false })` → `'stop'`。`nextAction(3, { ok: true })` → `'retry'`。`nextAction(4, { ok: false, unclassifiedOnly: true })` → `'hold'`。
- `checksOutcome(checks)`: `result: hold` で hold の検査が `unclassifiedExtensions` だけ → `{ ok: false, unclassifiedOnly: true }`。`fail` の検査があれば `unclassifiedOnly` は付かない。
- `classifyApplyFailure(checks)`: `stoppedAt.message` が `A-9-x: removeLines: build/npm/dirs.ts: 一致する行が無い: ...` → `kind: 'removeLines'`、`... removeLines: a/b.ts が無い` → `'missing'`、`... edits.patch が当たらない（衝突: x）` → `'editsConflict'`（`conflicts` は `units[].edits.conflicts`）、`phase: 'patch'` → `'patchConflict'`、`after の単位が当たっていない`・`phase: 'inputs'` → `repairable: false`。
- `buildClaudeInvocation`: `kind: 'repair'` の args に `Bash` が無い、`--strict-mcp-config` がある、`--append-system-prompt-file` が TAKE-IN.md、`input` がそのまま返る。`claudePath: { cmd: 'node', prefixArgs: ['x.js'] }` で `cmd` が node、args の先頭が `x.js`。`env` に `CLAUDE_CODE_SIMPLE`・`CLAUDECODE`・`VSCODE_PID` があれば外す。
- `parseCmdShim('node "%~dp0\\fake.js" %*', 'C:\\d')` → `{ cmd: <node>, prefixArgs: ['C:\\d\\fake.js'] }`、`"%dp0%\\node_modules\\x\\bin\\claude.exe"   %*` → `{ cmd: 'C:\\d\\node_modules\\x\\bin\\claude.exe' }`。
- `parseClaudeOutput`: `trial/probe/claude-output.json` の中身 → `ok: true`、`structured` が `{ ok: true, agent: 'di-renjie' }`。`is_error: true` → `ok: false`。`structured_output` 無し → `ok: false`。
- `guardVerdict(v, { build: 'failed' })` で `v.verdict === 'pass'` → 違反あり。`recommendation` が判定の言い方と違う → 違反あり。
- `findConflictMarkers`、`outsideAllowed`（`?? removals/x`・` M patches/y` は外でない、`?? scripts/z` は外）、`groupFixes`（`unit:A-1-copilot-extension`・`patch:20-x.patch` は持ち主、`unknown`・形の違うものは `unknown`）。
- `parseLsRemote`（`^{}` を優先、40 桁でない行を無視）、`selectReleases`（prev より後で new 以下、下書きとプレリリースを除く、新しい順）、`selectAdvisories`（修正版が範囲に入るか `since` 以後）。
- `decideExtVersion`（版の指定と違う → 止める、台帳と同じ → `noNewVersion`）、`findPrevFetchDir`（`exists`・`read` を差し替え）、`setLedgerVerdict`。
- `readWatchStatus({ statePath, now, read })`（`lastSuccessAt` が4日前 → `warn: true`）、`writeBack(repo, payload, { find })`（部品なし → `attempted: false`、例外 → `ok: false`、`reason` を `message` に写す）、`toWritebackArgs`。
- `planAdopt`: main でない・変更あり・ブランチなし・タグあり・判定なし → `ok: false, code: 1`。判定 `fail` で `force` なし → `code: 4`。`force` あり → 警告つきで進む。手順の並びが merge → (core なら confirm-upstream) → commit-records → tag → remove-worktree → delete-branch → next。
- CLI: 引数なし・`core`・`ext`・`bogus` → 2。`adopt.mjs` 引数なし → 2。`core 1.147.0 --dry-run --watch-state <無いファイル>` → 0 で JSON（`result: 'dry-run'`、`claude.verdict.args` に `--agent di-renjie`）。

## docs/ との食い違い

`doc-corrections.md` に 11 点。決めてほしいのは次の3つ:

1. 版のフォルダへの展開: `switch.ps1 -Zip` は展開と切り替えを一度に行い、展開だけの入口が無い（docs/02 の8節・docs/06 の3節と合わない）。案A（推奨）`switch.ps1` に `-ExpandOnly` を足す / 案B 資料を「展開と切り替えはユーザーが一度に行う」に直す。今の take-in は `-ExpandOnly` があるときだけ呼び、無ければスモークと監査を gulp の出力に向ける。
2. 通信の監査の雛形: 自作のビルド向けの `netaudit.ps1 -EnvDir` の作り方が決まっていない。今は `--net-env` が無ければ手順 7 を skipped にし、合格にしない。
3. スモークの基準: 新しい版を採った後の `baseline-<label>.json`（3回の和）を誰がいつ作るか。

## 未解決の点

- 修理の `claude -p`（`--tools Read,Glob,Grep,Edit,Write --permission-mode acceptEdits --strict-mcp-config --disallowedTools mcp__* --add-dir <ブランチ> --append-system-prompt-file TAKE-IN.md`）は、本物では起動していない（依頼の「1回だけ」を判定の形に使った）。オプションの名前は公式の CLI の資料（https://code.claude.com/docs/en/cli-reference）で確かめた。本物での確かめ（編集が作業場所の中だけで通ること、`--add-dir` の中の編集が承認なしで通ること）はリーダーの許可があれば1回行う。
- 修理の守りは「修理の前からあった `git status` の行」を除いて見るので、前から変更のあった追跡しているファイルをさらに変えても気づかない（取り込みのブランチは作ったばかりで、ふつうは変更が無い）。
- `adopt.mjs` のマージとタグ付けは、試しの clone を作る許可（ビルドリポジトリの `git clone`）が私に無いので、本物の git では試していない。`planAdopt` の計画と、拒む道（dry-run）だけを確かめた。
- 書き戻しは p4-watch の `writeBackTakeIn` に合わせたが、本物の Notion と、合わせた後の呼び出しは走らせていない（トークンの場所に触れるため）。
- 試しの作業ツリー `C:\b\wt\1.145.3`・`C:\b\wt\trial-bwt` と `C:\b\take-in-trial\` を残した（大岡越前守の確かめのため）。消すコマンドは `trial-log.md` の8節。
- `build.mjs` の lockfile の手順が `--removals` を渡さない点（`doc-corrections.md` の6）は、`build.mjs` が私のこのタスクの書き込みの範囲の外なので直していない。

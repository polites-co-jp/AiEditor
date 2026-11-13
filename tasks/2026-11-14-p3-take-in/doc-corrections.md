# 資料と事実の食い違い・決めてほしいこと（p3-take-in）

> 2026-11-14 追記: リーダーが1・8・9を決め、docs/06 の9節に書いた（1: `switch.ps1 -ExpandOnly`、8: 取り込みのたびに `install-extensions.mjs --portable` で一時の環境を作る、9: 手順 6 で3回の和を新しい版の基準に）。4・5・2・3・10・11 は今の実装で認められた。反映は take-in-design.md の3節・6節・6.1。8 を反映して分かった `netaudit.ps1` との合わない点は末尾の12。

docs/ は書き換えていない。直す案と、リーダーに決めてほしいことを挙げる。

## 1. 版のフォルダへの展開の入口が無い（決めてほしい）

- 資料: docs/02 の8節「版のフォルダへの展開は `switch.ps1 -Zip` が行う。取り込み（`take-in.mjs`・`adopt.mjs`）もこの入口を使う」。docs/06 の3節「新しい版はブランチ `take-in/<label>` と版のフォルダ `<installRoot>\versions\<label>` に作る」「取り込みは今使っている版に触らない」。
- 事実: `switch.ps1 -Zip` は展開の後にそのまま切り替える（`current` の付け替え・`history.txt`・ユーザーのデータの写し）。展開だけで止める入口が無い。取り込みが呼ぶと今の版を切り替えてしまう。
- 今の実装: `take-in.mjs` は `switch.ps1` に `$ExpandOnly` があるときだけ `switch.ps1 <label> -Zip <zip> -Sha256 <sha> -ExpandOnly` を呼ぶ。無いときは展開を `blocked` と記録し、スモークと監査を gulp の出力（`<buildRoot>\wt\VSCode-win32-x64`）に向ける。`adopt.mjs` は、展開していなければ `switch.ps1 <label> -Zip <zip> -Sha256 <sha>` を次のコマンドとして出す。
- 案A（推奨）: `switch.ps1` に `-ExpandOnly` を足す（`-Zip` の展開と、版のフォルダの exe・CLI の確かめまでで止め、`current`・`history.txt`・`backups` に触らない）。小さな変更。蒙恬が別のタスクで行える。
- 案B: 資料を「取り込みは installRoot に触らない。展開と切り替えはユーザーが `switch.ps1 <label> -Zip <zip> -Sha256 <sha>` で一度に行う」に直す。

## 2. 修理の道具（docs/06 の7.1）

- 資料: 使ってよい道具は「読む・探す・`removals/` と `patches/` と作業ツリーの中の編集・`git diff` と `git status`」。
- 実装: 修理の `claude -p` には Bash を渡さない（`--tools Read,Glob,Grep,Edit,Write`）。`git status --porcelain` と `git diff` の中身は台本が依頼文に入れる。git の操作（`add`・`am --continue`・`format-patch`・`commit`）は台本が `shuko-apply` の名前で行う。Bash を渡すと `git diff`・`git status` 以外を止める確かな手段が無く、`switch.ps1` なども走らせられるため。
- 直す案: 7.1 を「`git diff` と `git status` の中身は台本が渡す。git の操作は台本が行う」に直す。
- そのほか、本家の作業ツリーに `.mcp.json`（1.146.0 にある。`component-explorer` を `npm exec` で起動する）がある。`-p` はフォルダを信頼していなくても `.mcp.json` のサーバーにつなぐ（https://code.claude.com/docs/en/headless の bare mode の節）ので、修理と判定の両方に `--strict-mcp-config` を付けた。7.1 に書き足す案。

## 3. 修理の追加の作業場所（docs/06 の7.1）

- 資料: 「ビルドリポジトリを追加の作業場所として渡す」。
- 実装: 渡すのは、取り込みのブランチ `take-in/<label>` の作業ツリー `<buildRoot>\take-in\<label>\repo`（main から作る）。修理が `removals/`・`patches/` を直すのはそこで、main の作業ツリーは変えない。docs/02 の2節のフォルダの図に `C:\b\take-in\<label>\repo` を足す案。

## 4. 「判定できない」の扱い（docs/06 の7.3）

- 判定役の定義（`.claude/agents/di-renjie.md`）は「材料が足りなければ『判定できない』とし、足りない材料を書く」。docs/06 の7.3 の `verdict` は pass・conditional・fail の3つ。
- 実装: 判定の形に `missingMaterials` を足し、材料が足りないときは pass にしない（`TAKE-IN.md` の3節では fail）。docs/06 の7.3 の JSON に `kind`・`reasons`・`materialsRead`・`missingMaterials`・`userChecksBeforeSwitch`・`markdown` を足す案。判定役の定義の「計測」（判定の基準の列挙）は裁定 2026-11-13 でやめたので、定義を直すかはリーダーが決める（`.claude/` は書いていない）。

## 5. 記録のコミット（docs/06 の8節）

- 資料: `adopt.mjs` は「ブランチを main に取り込み、`upstream.json` を確定し、タグを打つ」。
- 実装: 記録 `records/take-in/<label>/` は判定役が読めるよう main の作業ツリー（ビルドリポジトリの直下）に書く（リーダーの判断 1）ので、ブランチには入らない。`adopt.mjs` は、マージの後に `records/take-in/<label>/` と `records/builds/<label>.json` をコミットしてからタグを打つ（`--no-records` で飛ばす）。8節の2に書き足す案。採らなかった取り込みの記録は、未追跡のまま残る。

## 6. `build.mjs` を区切って呼ぶ

- `build.mjs` は `apply.mjs` に `--prev-tag`（本家が足した部品の検査に要る）と `--keep-conflict`（修理に要る）を渡す手段を持たない。take-in は `build.mjs --to prepare` → `apply.mjs` を直接 → `build.mjs --from install` と区切り、`records/builds/<label>.json` を2つの記録と `checks.json` から組み立てる（`composeBuildRecord`。`composedBy` に書く）。
- `build.mjs` の lockfile の手順（`apply.mjs --lockfile-check`）は `--removals` を渡さないので、ブランチの `removals/` でなく main の作業ツリーの `removals/` を読む。修理で単位の `delete`・`removeDependencies` が変わると、ロックファイルの検査が古い単位で行われる。`build.mjs` の `plan.lockfile` に `--removals` を渡す小さな直しを提案する（`build.mjs` は今回の書き込みの範囲の外なので直していない）。

## 7. `lock-verify.mjs` の台帳の `verdict`

- `lock-verify.mjs --write-lock` は台帳の行の `verdict` を `records/phase0/lock-verification.md` に固定で書く。docs/04 の3節の例は `records/take-in/ext-<id>-<版>/verdict.md`。take-in はブランチの台帳のその行の `verdict` を書き換えている（`setLedgerVerdict`）。`lock-verify.mjs` に `--verdict <path>` を足すと二度手間が無くなる。

## 8. 通信の監査の雛形（決めてほしい）

- `netaudit.ps1` は `-EnvDir`（Phase 0 の `p0-env.ps1` が作るデータの雛形）が要る。自作のビルド（新しい版）向けの雛形の作り方が決まっていない。
- 実装: `take-in.mjs core --net-env <dir>` で渡す。無ければ手順 7 は `skipped` と記録し、判定は合格にならない（`missingMaterials`・`guardVerdict`）。
- 決めてほしいこと: 自作のビルドの雛形を誰がどう作るか（例: `p0-env.ps1` に自作の版の名前を足す、取り込みのたびに `install-extensions.mjs --portable` で作る）。曹参の `netaudit.ps1` の担当とも関わる。

## 9. スモークの基準（baseline）

- docs/06 の5節は「基準は3回の和」。新しい版を採った後の基準（`C:\b\smoke\baseline-<label>.json`）を誰がいつ作るかが決まっていない。take-in は `--smoke-baseline` が無ければ `baseline-<今の版のラベル>.json`、無ければ `baseline-official-<前のタグ>.json` を使う（今は後者 `baseline-official-1.146.0.json` だけがある）。採った後に3回で作り直す手順を docs/06 の8節に足すかを決めてほしい。

## 10. Claude Code の CLI の場所（docs/02 の5節）

- この PC の `claude` は npm の包み（`%APPDATA%\npm\claude.cmd` → `node_modules\@anthropic-ai\claude-code\bin\claude.exe`、2.1.318）。`.cmd` を cmd.exe 経由で起動すると `--json-schema` の JSON の引用が崩れるので、take-in は包みの中身を読んで `claude.exe` を直接起動する。`--claude <path>` で上書きできる。docs/02 の5節の表に書き足す案。

## 12. 通信の監査の環境を作って分かった `netaudit.ps1` との合わない点（8 の反映。`netaudit.ps1` は曹参の台本なので書き換えていない）

- `-EnvDir` の形（`user\` と `ext\`、`user` が `VSCODE_PORTABLE`、ユーザーのデータは `user\user-data`）は、`install-extensions.mjs --portable <env>\user --extensions-dir <env>\ext --argv <env>\user\argv.json` で作れた。試し（`trial-log.md` の9節）で `netaudit.ps1` はこの環境で最後まで走った。
- `netaudit.ps1` は作業場所（既定 `<repo>\tmp\ws`）と開く2つのファイル（既定 `C:\b\p0\ws-info.json` の `openFilesFull`）を Phase 0 の物から読む。取り込みもこれに頼る（無いと「need exactly 2 files」で止まる）。Phase 0 の物を消すと取り込みの手順 7 が止まる。`netaudit.ps1` に取り込み向けの既定を足すか、取り込みが `-Workspace`・`-OpenFiles` を渡すかを決めたい（今は渡していない）。
- 監査が要る設定（`task.allowAutomaticTasks`・`security.workspace.trust.enabled`）は `scripts/lib/p0-common.ps1` の `P0MeasureSettings` にあり、PowerShell からしか読めない。take-in は同じ値を `smoke-net.mjs` の `NETAUDIT_SETTINGS` に写した（2か所に同じ値がある）。どちらかを変えるときは両方を直す。
- `-Exe` を渡すので `p0-env.json` は要らない（`Read-P0EnvRecord` は `-Exe` が無いときだけ読む）。代わりに `take-in-env.json` を置いた。
- `-Previous`（前の版の宛先の一覧）は `records/take-in/<今の版のラベル>/netaudit/destinations.json`。最初の取り込みでは無いので、「前の版から増えた宛先」は出ない（許した宛先の外かどうかは出る）。

## 13. スモークの3回と、`smoke-run.mjs` の古い実行の消し方

- `smoke-run.mjs` は既定で `C:\b\smoke\runs\` の最新 10 個だけを残し、古いものを消す（`--keep-runs`。`.keep` の印のあるものは消さない）。取り込みは1回に3つの実行を作るので、ほかの人の実行が早く消えることがある。結果は `records/take-in/<label>/smoke/run-<n>/` に写すので取り込みには困らない。根拠にする実行には `.keep` を置くこと。

## 11. rerere の記録の共有

- `apply.mjs` は作業ツリーで `git config rerere.enabled true` を行い、これは常設の clone の共通の設定に入る。衝突の解決の記録（`rr-cache`）も作業ツリーの間で共有される。試し（t6）では、前の回の解決で衝突が自動で解けた。取り込みでは前の週の解決を使い回せて都合がよいが、解決が自動で入ったことは `checks.json` からは分からない（`amApply` は `--continue` するだけ）。判定の材料にするなら、`apply.mjs` が rerere で解いたファイルを記録する直しが要る（今回の範囲の外）。

# 試しの記録（p3-take-in）

- 日時: 2026-11-14（記録の時刻は UTC で 2026-11-13T16:3x〜16:4x）
- 場所: ビルドリポジトリ `e:\develop\self\Team\projects\ai-editor`、作業場所 `C:\b\`
- ビルドは走らせていない（依頼のとおり）。main へのマージ、タグ付け、ビルドリポジトリへの `git worktree add` は行っていない。
- 本物の `claude -p` の起動は 1 回だけ（3節）。修理と判定の流れは偽の claude で確かめた（5・6節）。

## 1. 構文の検査

```
node --check scripts/take-in.mjs        （ほか scripts/adopt.mjs、scripts/lib/take-in/*.mjs の 10 本）
```

全部、出力なしで通った（最後の修正の後に取り直した）。

## 2. 引数の誤り（副作用なし）

| コマンド | 終了コード | 出たもの |
|---|---|---|
| `node scripts/take-in.mjs` | 2 | 「サブコマンドが無い」と使い方 |
| `node scripts/take-in.mjs core` | 2 | 「core にタグが無い」と使い方 |
| `node scripts/take-in.mjs ext` | 2 | 「ext に拡張の ID が無い」と使い方 |
| `node scripts/take-in.mjs bogus` | 2 | 「知らないサブコマンド」と使い方 |
| `node scripts/adopt.mjs` | 2 | 「ラベルが無い」と使い方 |

## 3. 本物の `claude -p` の起動（1 回）

```
node scripts/take-in.mjs probe-claude --out tasks/2026-11-14-p3-take-in/trial/probe
```

- 見つけた CLI: `C:\Users\kou_z\AppData\Roaming\npm\claude.cmd`（npm の包み）の中の `...\node_modules\@anthropic-ai\claude-code\bin\claude.exe`。版 `2.1.318 (Claude Code)`（`claude --version`。API を使わない）。
- 使った引数（`buildClaudeInvocation` の `kind: 'probe'`。判定と同じ形で、schema と依頼文だけ違う）:
  `-p --output-format json --agent di-renjie --json-schema <137 文字> --permission-mode dontAsk --strict-mcp-config --no-session-persistence --max-turns 5 "<これは take-in.mjs の起動の試しである。ファイルを読まず…>"`、作業場所はビルドリポジトリの直下。
- 子の環境変数から外したもの: `CLAUDECODE`・`CLAUDE_CODE_ENTRYPOINT`・`ELECTRON_RUN_AS_NODE`・`VSCODE_*`（10 個）。`ANTHROPIC_API_KEY` はもともと無かった。
- 結果: 終了コード 0、15.2 秒。`structured_output` は `{"ok":true,"agent":"di-renjie"}`、`subtype: success`、`num_turns: 2`、`permission_denials: []`、道具の数 4（di-renjie の定義の Read・Glob・Grep・StructuredOutput と同じ）、モデル `claude-opus-5-5`（定義の `model: opus`）、`credential_expires_at` あり（ログインの資格情報で動いた。API キーではない）、`input_hooks` 406 ms（プロジェクトのフックが読まれた）。
- 費用の見積もり（`total_cost_usd`）: 0.087（クライアント側の見積もり。購読のログインなので請求ではない）。
- 出力そのもの: `trial/probe/claude-output.json`、まとめ: `trial/probe/probe.json`。

## 4. dry-run

### 4.1 本体

```
node scripts/take-in.mjs core 1.147.0 --dry-run --watch-state C:/b/take-in-trial/no-state.json
```

終了コード 0。ラベル `1.147.0-1`、前のタグ `1.146.0`（main の `upstream.json`）、ブランチ `take-in/1.147.0-1`、ブランチの作業ツリー `C:\b\take-in\1.147.0-1\repo`、本家の作業ツリー `C:\b\wt\1.147.0`。手順ごとのコマンド（`build.mjs --to prepare`、`apply.mjs ... --keep-conflict --prev-tag 1.146.0 --removals <ブランチ>\removals ...`、`build.mjs --from install --force-zip ...`、`switch.ps1 ... -ExpandOnly`（`supported: false`）、`smoke-run.mjs ... --baseline C:\b\smoke\baseline-official-1.146.0.json`、`absent-run.mjs`、`netaudit.ps1`）と、修理・判定の `claude -p` の引数を出した。`--watch-state` の無いファイルで「検知の記録が無い」の警告が出た。

### 4.2 拡張

```
node scripts/take-in.mjs ext anthropic.claude-code --dry-run --watch-state C:/b/take-in-trial/no-state.json
```

終了コード 0。台帳の版 `2.1.322`、今の本体の版 `1.146.0`（`<installRoot>\current` が無いので main の `upstream.json`）、`lock-fetch`・`lock-verify`・`lock-diff`・`smoke-run` の引数、判定の引数、前の版の取得場所の候補（`C:\b\cache\vsix`、`C:\b\p0\vsix`）を出した。

### 4.3 adopt

```
node scripts/adopt.mjs 1.147.0-1 --dry-run
```

終了コード 1、`result: refused`。誤り 3 つ（追跡しているファイルに変更がある、ブランチが無い、`verdict.json` が無い）。何もしていない。

## 5. 当て直しと修理（本家の作業ツリー `C:\b\wt\1.145.3`）

用意: `git -C C:/b/vscode worktree add C:/b/wt/1.145.3 1.145.3`（試しの使い捨て）。タグの commit は `C:\b\vscode\.git\packed-refs` で `dcd3ad6e368fbe19d03f37054a40dbaf40d676f4`（軽いタグ。`^{}` の行が無い）を確かめて `--commit` で渡した。記録は `--records-dir C:\b\take-in-trial\t<n>` に書いた（ビルドリポジトリの `records/` は汚していない）。

| 回 | 入力 | コマンドの要点 | 結果 |
|---|---|---|---|
| t1 | ビルドリポジトリの今の removals（有効な単位は無い） | `--from apply --to checks --no-repair --skip-judge --no-writeback --builder-worktree <リポジトリ>` | 終了 0。overlay と patches/ の 2 本が当たり `checks.json` の result `ok`、手順 4 も通った。`result: partial` |
| t2・t3 | 試しの単位 `A-9-trial`（本家に無い行を `removeLines` に書いた。`C:\b\take-in-trial\bwt-fail\`） | 同上（`--builder-worktree C:/b/take-in-trial/bwt-fail`） | 終了 1。手順 2 が止まり、`failure.kind` が t2 は誤って `missing`（直した）、t3 で `removeLines`（直した後の分類は 7節）。`take-in.json` の `result: stopped`・`message`、`repair-preview/request.md`・`claude-args.json` ができた |
| t4 | 試しの単位 `A-8-trial`（ops で `issue.ts` の `createDecorator` の import を消し、B-3 と同じ edits.patch を当てて、わざと衝突させる。`C:\b\take-in-trial\bwt-conflict\`） | `--no-repair` | 終了 1。`edits.patch が当たらない（衝突: src/vs/workbench/contrib/issue/common/issue.ts）`。`git am` は途中で残った（`--keep-conflict`）。修理の依頼文に `UU` の状態と `diff --cc` の衝突が入った |
| t5 | t4 と同じ単位を、git の作業ツリー `C:\b\wt\trial-bwt`（`git -C C:/b/vscode worktree add C:/b/wt/trial-bwt 1.145.3`）に置き、偽の claude で修理 | `--to checks --claude C:/b/take-in-trial/fake-claude/claude.cmd` | 修理の後処理（衝突の印の確かめ → `git add -A` → `am --continue` → `format-patch -1 HEAD --stdout` を `removals/A-8-trial/edits.patch` に）は動いた。書き戻したパッチの `From:` は `shuko-apply <apply@shuko.invalid>`。ただし守り（removals/・patches/ の外の変更を戻す）が、修理の前から未追跡だった試しの `product.overlay.json` を消してしまい、修理を失敗と数え、やり直しの当て直しが overlay 無しで止まった（直した後の動きは 7節） |
| t6 | 同上（overlay を置き直し） | 同上 | 衝突が出ずに当たった。t5 の解決を git の rerere が覚えていて、自動で解いた（`apply.mjs` が `rerere.enabled` を付ける）。手順 4 で `registeredKeys` の fail（試しの overlay に既定の設定のキーが無い）で止まった（終了 1）。手順 4 の止める条件が効くことの確かめになった |
| t7 | edits.patch の追加の行を少し変えて rerere を外した | `--to repair` | 衝突 → 修理（偽の claude）→ `am --continue`・`format-patch` で書き戻し → 作業ツリーをタグに戻す → 当て直し → 単位が当たった。終了 0、`result: partial`。`repair-1/` に `request.md`（4,125 文字）・`claude-args.json`・`claude-output.json`・`changes.diff`・`result.json` |

偽の claude（`C:\b\take-in-trial\fake-claude\`）は、`.cmd` の包み（`node "%~dp0\fake-claude.js" %*`）を `parseCmdShim` が読んで node で直接起動した。呼ばれ方の記録 `calls.jsonl`: 作業場所 `C:\b\wt\1.145.3`、引数 `-p --output-format json --json-schema <644> --tools Read,Glob,Grep,Edit,Write --permission-mode acceptEdits --strict-mcp-config --disallowedTools mcp__* --add-dir C:\b\wt\trial-bwt --append-system-prompt-file <リポジトリ>\TAKE-IN.md --no-session-persistence --max-turns 80 <短い依頼文>`、標準入力 4,102 / 4,125 文字、`ANTHROPIC_API_KEY`・`CLAUDECODE`・`CLAUDE_CODE_SIMPLE` は子に無かった。

## 6. 判定と記録（偽の判定役）

```
node scripts/take-in.mjs core 1.145.3 --prev-tag 1.145.2 --commit dcd3ad6e... --label trial-1.145.3-repair2 --from judge --to record \
  --builder-worktree C:/b/wt/trial-bwt --records-dir C:/b/take-in-trial/t7 --claude C:/b/take-in-trial/fake-claude/claude.cmd --watch-state C:/b/take-in-trial/no-state.json
```

- 終了 0、`result: judged`、判定 `conditional`。
- `judge-request.md`: 台本の事実（checks `fail`・build `skipped`・smokeAuto `skipped`・netaudit `skipped`）と材料 11 件（`TAKE-IN.md`、`checks.json`、`repair-1/*`、`logs/*`、`branch-diff.txt`、`take-in.json`）を挙げた。
- `verdict.json` と `verdict.md` ができた。台本の照らし合わせ（`guardVerdict`）が「checks の値が台本の記録（fail）と違う: ok」を `verdict.md` の頭に出した。
- 書き戻し: この時点の `writeback.mjs` は `writeTakeInResult` だけを探していて「部品が無い」と記録した（止めなかった）。その後、p4-watch の `scripts/lib/notion-todo.mjs` が `writeBackTakeIn` を書き出していると分かったので、それを呼ぶように直した（7節）。直した後の書き戻しは走らせていない（本物の書き戻しの部品が `%LOCALAPPDATA%\Shuko\watch\` のトークンを読みに行くため。試しでは `--no-writeback` を使うこと）。

## 7. 試しで見つけて直したこと

1. `classifyApplyFailure`: `removeLines` の「一致する行が無い」を、ファイルが無い（`missing`）と取り違えていた → apply.mjs の文の形（`<file> が無い` で終わるか）で分けた。`removeDependencies` の誤りは `removeDependencies` に分けた。
2. 修理の守り: 修理の前からあった未追跡のファイルまで戻していた → 修理の前の `git status --porcelain --untracked-files=all` を覚え、増えた行だけを見る。「何も変わっていない」は `removals/`・`patches/` の中身の SHA-256 で比べる。
3. 止まったときに `take-in.json` の `result` が `running` のままだった → `stopped`（または `crashed`）と `message` を書く。走っていた手順は `error` にする。
4. `--no-repair` で止めたときに、修理の材料が残らなかった → `repair-preview/` に依頼文と起動の形を残す。
5. `claude.exe` が PATH に無い（npm の `.cmd` だけ）と起動できなかった → `.cmd` の包みの中身を読んで実体を直接起動する。
6. ブランチの差（`branch-diff.txt`）と、ブランチへのコミットが、無いパスや `main` の無いリポジトリで止まっていた → 無いパスを除き、差が取れなければ記録して続ける。
7. 書き戻しの部品の名前 → p4-watch の `writeBackTakeIn`（`{ ok, pageId, reason }`）に合わせた。

## 9. リーダーの判断（docs/06 の9節）の反映の試し（手順 6・7）

ビルドが無いので、本家の公式 1.146.0（`C:\b\p0\vscode-1.146.0`）を `--editor-dir` で渡して手順 6・7 だけを走らせた。

```
node scripts/take-in.mjs core 1.146.0 --prev-tag 1.145.3 --commit 69047191fc427f2f92828279aae1d90d8eeda7ab --label trial-official-1.146.0 \
  --from smoke --to netaudit --editor-dir C:/b/p0/vscode-1.146.0 --builder-worktree e:/develop/self/Team/projects/ai-editor \
  --records-dir C:/b/take-in-trial/t8 --net-duration 60 --watch-state C:/b/take-in-trial/no-state.json
```

- 終了 0、`result: partial`、所要 約 15 分（スモーク 3 回で約 12.5 分、環境づくりと監査 60 秒で約 2 分）。
- 手順 6: `smoke-run.mjs` を `--prime` で3回（ラベル `take-in-trial-official-1.146.0-1`〜`-3`。1回目 `--save-baseline`、2・3回目は `--merge-baseline` も付けた）。
  - 3回とも終了 1（FAIL あり）で、`status: failed`、`passedRuns: 0`。FAIL は `lang.py.importStrategy`・`lang.py.diagnostics`（`--mode built` は mydist の既定を前提にするので、公式の zip では落ちる。予期どおり）。
  - 新しい基準 `C:\b\smoke\baseline-trial-official-1.146.0.json` ができ、`runs: 3` だった（鍵の `seen` も 3）。記録に `smoke/baseline-trial-official-1.146.0.json` と `smoke/run-1`〜`run-3/smoke-result.*` を写した。
  - 今の版の基準との比べ（`--baseline`）は、この試しでは働いていない（`--prev-tag 1.145.3` にしたので、探した `baseline-official-1.145.3.json` が無く、警告「今の版のスモークの基準が無い」を出した）。ふつうの取り込み（前のタグ 1.146.0）では `baseline-official-1.146.0.json` を全回に `--baseline` で渡すことを dry-run で確かめた（`plan.smoke[*].args`）。
- 手順 7: 一時の環境 `C:\b\take-in\trial-official-1.146.0\netaudit-env` を作った。
  - `install-extensions.mjs --cli C:\b\p0\vscode-1.146.0\bin\code.cmd --portable <env>\user --extensions-dir <env>\ext --argv <env>\user\argv.json --lock <台帳>` が `result: ok`、台帳の 8 件を入れた。
  - `user\user-data\User\settings.json` と `take-in-env.json` を書いた。
  - `netaudit.ps1 -Exe C:\b\p0\vscode-1.146.0\Code.exe -EnvDir <env> -WorkRoot C:\b\take-in\trial-official-1.146.0\netaudit-run -DurationSeconds 60 ...` は最後まで走った（30 サンプル、ネットのログ 8,247 件、`audit.md`・`destinations.json` ができた）。
  - 公式の zip なので、許した宛先の外の接続先が 9 件あった（`main.vscode-cdn.net`・`update.code.visualstudio.com`・`marketplace.visualstudio.com` ほか）。`status: attention` で、判定では合格にならない（`guardVerdict`）。
- `switch.ps1` に `-ExpandOnly` が入ったので、dry-run の `expandOnlySupported` が `true` になった（展開そのものは zip が無いので走らせていない）。

## 10. 修理の守りの正規化（曹参のテストの指摘の反映）

`outsideAllowed` が `startsWith` だけで `removals/../src/x.ts` を許していた（曹参のテスト）。パスを正規化してから `removals/`・`patches/` の中に留まるかを見る形（`normalizeRepoPath`・`isInsideAllowed`）に直した。`..`・絶対パス・ドライブ文字で外へ出るものは外とする。守りが戻すときも、正規化してビルドリポジトリの作業ツリーの中に留まるものだけに触る。

関数そのものを走らせる許可（`node --test`・`node -e`）が私に無いので、台本を通して確かめた。偽の claude に印のファイル（`C:\b\take-in-trial\fake-claude\write-outside.flag`）を置き、修理のときに `--add-dir` の `removals\..\outside-by-fake.txt` を書かせた。

```
node scripts/take-in.mjs core 1.145.3 --prev-tag 1.145.2 --commit dcd3ad6e... --label trial-1.145.3-guard2 --from apply --to repair --max-repair 1 \
  --skip-judge --no-writeback --builder-worktree C:/b/wt/trial-bwt --records-dir C:/b/take-in-trial/t10 --claude C:/b/take-in-trial/fake-claude/claude.cmd ...
```

- 終了 1。「修理が 1 回で直らない: removals/・patches/ の外を変えた（戻した）: outside-by-fake.txt」で止まった。
- `C:\b\wt\trial-bwt\outside-by-fake.txt` は消えていた（守りが戻した）。
- 守りは修理の後処理（`am --continue`・`format-patch`）の後に見るので、`removals/A-8-trial/edits.patch` は書き戻されたまま残る（中の変更なので許す。失敗と数えた回の書き戻しを元に戻すかは、今は戻さない）。
- 印のファイル `write-outside.flag` は残した（私に消すコマンドが無い）。偽の claude を使う次の試しの前に消すこと。

## 8. 残したもの

- `tasks/2026-11-14-p3-take-in/trial/probe/`（本物の起動の出力）
- `C:\b\take-in-trial\`（t1〜t8 の記録、試しの単位、偽の claude と `calls.jsonl`）
- `C:\b\take-in\trial-official-1.146.0\`（t8 の通信の監査の環境と実行の場所、ネットのログ）、`C:\b\smoke\baseline-trial-official-1.146.0.json`（t8 の基準）、`C:\b\smoke\runs\take-in-trial-official-1.146.0-*`（スモークの実行）
- `C:\b\wt\1.145.3`、`C:\b\wt\trial-bwt`（試しの作業ツリー。要らなくなったら `git -C C:/b/vscode worktree remove --force C:/b/wt/1.145.3` と `... C:/b/wt/trial-bwt`）。`trial-bwt` には手順 9 が切り離した HEAD の上に試しのコミットを 1 つ作った（`C:\b\vscode` の枝やタグには触れていない）
- 常設の clone `C:\b\vscode` の rerere の記録（`rr-cache`）に、試しの衝突の解決が 1 件残った（中身は試しの行だけ）

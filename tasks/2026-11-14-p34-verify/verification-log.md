# 検証の記録: Phase 3・4 の準備（取り込み・更新の検知・notion-sync と、その後の直し）

- 担当: 大岡越前守（ooka-echizen）。2026-11-14
- 依頼: `tasks/2026-11-14-p34-verify/brief.md`
- 確かめた版: HEAD `1a29089` に、作業ツリーの未コミットの変更を足したもの（SHA-256 は5節と追記の A.4）
- 守ったこと:
  - 本物の Notion に書いていない。秘密の場所（`%LOCALAPPDATA%\Shuko\watch\`・`secrets\`）を開いていない。
  - タスクスケジューラに登録していない。`claude -p` を起動していない。
  - 普段使いのデータ・実際の `local.json`・スタートメニュー・PATH に触れていない。build.mjs の dry-run には、試しの `C:\b\trial-install\cfg\local.json` を `--config` で渡した。
- コードとテストは直していない。書いたのはこのディレクトリの4つだけ: この記録、`handoff-notes.md`、`run-all-result.txt`、`run-all-result-2.txt`。

## 追記 A（2回目の確かめ。リーダーの依頼: 判定できなかった分を曹参のテストで埋める）

### A.0 判定: **合格**

- 1回目に「判定できない」とした3つは、曹参の新しいテストが子のプロセスで走らせる形で埋まった。私は run-all でそれらを走らせ、テストの中身を読んで確かめた。
  - `take-in.mjs core/ext --dry-run`
  - `adopt.mjs --dry-run`
  - notion-sync の build
- 蒙恬の M-1〜M-3 の直しは、どれも指摘どおりに入っている。
- 曹参の T-1〜T-4 はテストが足された。T-5 はリーダーの指示で対象外。
- 不合格の点は無い。

| 項目 | 合否 |
|---|---|
| 1 レビュー | 合格（M-1〜M-3 は直った） |
| 2 `node tests/run-all.mjs` | 合格。1386 件、pass 1372、fail 0、skip 14（既存の removals の 14）。曹参の申告（1386 件、fail 0）と一致 |
| 2 take-in・adopt の dry-run | 合格（`take-in-more.test.mjs` の CLI の 17 件が通る。take-in 10、adopt 7） |
| 2 watch の CLI（`--fixtures`・`--notion-fake`） | 合格（`cli-run.test.mjs` の watch の 11 件が通る） |
| 2 notion-sync の build | 合格（`cli-run.test.mjs` の build の試しは飛ばされずに通った。`P34_SKIP_BUILD` は付けていない） |
| 3 SHA-256 | 済み（A.4） |

### A.1 蒙恬の M-1〜M-3 の直し（`tasks/2026-11-14-p3-take-in/handoff-notes.md` の追記3）

- **M-1** `scripts/take-in.mjs`: `corePlan.apply` の引数の最後に `...common` が入った（`--config`・`--build-root`、568 行）。
  - `take-in-more.test.mjs`「core --dry-run の計画: apply に … --build-root と --config（M-1）」で確かめた。`--build-root` が試しの buildRoot、`--config` が試しの local.json になっている。
  - 合格。
- **M-2** `scripts/take-in.mjs` 976 行: `recordAndWriteBack(ctx, judged, { kind: "ext", id: entry.id })`。書き戻しの対象は台帳の ID（大文字小文字のまま）になった。
  - 動きは `watch.test.mjs`「writeBackTakeIn（M-2）」で確かめた。`MS-CEINTL.vscode-language-pack-ja` の ToDo を、state.json 無しで、台帳の ID で見つけて書く。
  - 判定の依頼文の `extId: a.id`（969 行）は小文字のままだが、これは判定役が読む材料の中の表記だけで、検索には使わない。直す必要は無い。
  - 合格。
- **M-3** `scripts/lib/notion-todo.mjs` の `writeBackTakeIn`（406〜430 行）:
  - 覚えたページは `isOpenPage` のときだけ使う。閉じていれば `closedPageId` に残して検索に回る。見つからなければ `ok: false` と理由を返す。
  - 閉じたページには `updatePage`・`appendBlockChildren` を呼ばない。
  - `watch.test.mjs` の M-3 の3件（Done で別の開いた ToDo がある / Done・Archived でほかに無い / in_trash・archived）が、ページの状態と本文が変わらないことまで見ている。
  - 合格。
- 申し送り（蒙恬の記載どおり）: p4-watch の `watch-design.md` に、`closedPageId` と「閉じたページには書かない」を足すこと。書き物だけの話で、合否には含めない。

### A.2 曹参の新しいテストの読み（期待が仕様どおりか、緩めていないか）

- `tests/switch-expand.test.mjs`（17 件。T-1）:
  - 試しの installRoot・local.json・台帳・UserDataDir をすべて一時フォルダに置く。普段使いの `%APPDATA%` には触れない。
  - `-ExpandOnly` の前後で、current の行き先・history.txt・backups・ユーザーのデータの一覧と中身を丸ごと比べる。今の版がある場合も、無い場合（何も作らない）も確かめる。
  - 止まる場合（Sha256 が違う・既にある版・`-List`/`-Previous` との併用・版が無い）は終了コード 1 と、何も変わらないことを確かめる。
  - engines を見ないことは、続く普通の切り替えが 4 で止まるのと対にして確かめる。
  - build.mjs は `applyPassThrough` の順と絶対パス、dry-run の apply・lockfile の両方の `--removals`、既定の `removals/`、試しの buildRoot に何も作らないことを確かめる。
  - docs/06 の3・9節と合い、緩めていない。
  - 弱い点（指摘のみ）: 「実行中のエディタを見ない」の1件は `running` が無いことを見るだけ。
- `tests/take-in-more.test.mjs`（43 件。T-2・T-3・M-1・M-2・CLI）:
  - T-2: 修理の引数を値まで見る。
    - `--strict-mcp-config` と `--disallowedTools mcp__*`。
    - `--tools` が Edit・Glob・Grep・Read・Write の5つだけ（並べ替えて一致）で、Bash・PowerShell が無い。
    - `--add-dir` は builderWorktree が先。
    - `--append-system-prompt-file`、`acceptEdits`。`bypassPermissions` を使わない。
  - T-3:
    - `normalizeRepoPath`: `C:/x`・`C:x`・`/x`・`\x`・UNC・`../x`・`a/../../x`・空・`.` が null。
    - `isInsideAllowed`: 中に留まる `..` は中、外へ出る `..`・`removals-evil`・`removalsx` は外。
    - `smokeRunArgs`: 3回、全回 `--prime`、1回目は `--save-baseline` だけで `--merge-baseline` を付けず、2・3回目は付ける。今の基準があれば全回 `--baseline`。
    - `summarizeSmoke`、`netEnvLayout`・`netEnvInstallArgs`・`netauditArgs`。
    - どれも docs/06 の5・9節、TAKE-IN.md と合う。
  - CLI（子のプロセス）:
    - `core 1.147.0 --dry-run`: 手順の並び、記録・ブランチ・試しの buildRoot を作らないこと。
    - 判定は `--agent di-renjie`・cwd はリポジトリ直下・`--bare`/`--setting-sources` なし。
    - `ANTHROPIC_API_KEY` を持つ環境でも外したと記録し、値を出さない。
    - `-ExpandOnly`、スモーク3回、同じタグは終了コード 3。
    - `ext --dry-run`（版の省略、`--security`、台帳に無い ID は 1）、`probe-claude --dry-run`（起動しない）。
    - `--claude` には `node.exe` を渡すので、claude は起動しない。
  - adopt:
    - `scripts/` を写した一時の git リポジトリで動かす。本物のリポジトリには触れない。
    - dry-run・fail は 4・`--force`・各止まり方・実際のマージ・記録のコミット・注釈つきタグ・ブランチの削除を確かめる。
    - remote が無くても済む、つまり push しない。
    - 衝突なら `--abort` して main が動かない。
  - 緩めていない。
  - 弱い点（指摘のみ）: M-2 の1件はソースの文字列を正規表現で見るだけ。動きは `watch.test.mjs` の M-2 が見ているので、合否には響かない。
- `tests/cli-run.test.mjs`（14 件。watch 11、notion-sync 3）:
  - watch.mjs を、一時の builderRepo・installRoot・state-dir・`LOCALAPPDATA`、`--fixtures`・`--notion-fake` で子のプロセスとして呼ぶ。
    - `--dry-run`: Notion・state・log に何も作らない。
    - security の版は高・翌日。取得の失敗は 1。
    - 作成と2回目で足さない。state を消しても重複しない。Done の後は新規。
    - `--check`、項目違いは書かずに 1、`--check-token` は値を出さない、`--write-back` で In progress。
  - notion-sync は一時の写しで `install --frozen-lockfile --ignore-scripts` → `run build`。dist ができ、jsonc-parser が中に入り、vscode を差し替えて `activate` があることを見る。
  - package.json の宣言と、依存の版の固定も見る。
  - 弱い点（指摘のみ）:
    - `deactivate` は「function か undefined」を許している。拡張の build.mjs 自身は両方を要求しており、その build がこのテストの中で通っているので、実害は無い。
    - npm のレジストリへの接続が要る。
- `tests/watch.test.mjs` の追記（99 → 104 件）:
  - T-4: `-ExecutionPolicy` の次が `Bypass`。
  - M-3 の3件、M-2 の1件、state のキーの小文字化の1件。

### A.3 実行

- `node tests/run-all.mjs --save tasks/2026-11-14-p34-verify/run-all-result-2.txt`: 終了コード 0。新しいファイルと変わったファイルの件数は次のとおり。
  - switch-expand 17
  - take-in-more 43
  - cli-run 14
  - watch 104
  - take-in 95
  - notion-sync 101
  - build-fixes 17

  すべて fail 0。
- 走らせた後の確かめ:
  - `git status --porcelain --untracked-files=all records extensions-src/notion-sync/dist` は、前からある `dist/extension.js` の1行だけで、`records/` に何も足されていない。
  - `dist/extension.js` の SHA-256 は走らせる前と同じ `613fb847…`。build の試しが一時の写しで行われ、リポジトリの dist に触れていないことを確かめた。

### A.4 2回目に確かめた版の SHA-256（1回目から変わったもの・新しいもの）

```
ac003deaa32f507312de6fc7e482ca7b09af41b2616b06321efa11302cb5ec33  scripts/take-in.mjs           （M-1・M-2 で変わった）
4babffd66ecb291f6dbd00f5e5e0b4001124b05c88e25fdb4934bb626e16b389  scripts/lib/notion-todo.mjs   （M-3 で変わった）
a294c81b949964262a00c512a0e30815e8245f839e2ed4ccd6529e764e48b528  tests/watch.test.mjs          （追記で変わった）
43e00765e9fdae10d8f2b541aada0ffd80e40f0fd33a3d4ba0cc21dc518e92fa  tests/take-in-more.test.mjs   （新）
0930829be9fb3c11af005ed3240778b3f0e7a2074ecfe16f7d3d16c9c68e2833  tests/cli-run.test.mjs        （新）
df17a2fbf8e1174980294260efd98ea57afdc865f055fb5e69011bc5c5f0124a  tests/switch-expand.test.mjs  （新）
bbaa88969519c785e3306b6ae3dc206af1e01392660ba3596bdb7d08df5699b4  tests/build/helpers.mjs       （既存・追跡済み、変更なし。新しいテストが使う）
525c87a0457343ac6fd8b39e9d9dfef02b9134a0a372648410d7cf7035897ebc  tasks/2026-11-14-p34-verify/run-all-result-2.txt
```

次のファイルは5節の値から変わっていない（2回目に取り直して一致した）。

- `scripts/adopt.mjs`
- `scripts/lib/take-in/claude.mjs`・`repair.mjs`・`smoke-net.mjs`・`writeback.mjs`
- `scripts/switch.ps1`・`build.mjs`・`apply.mjs`
- `tools/watch/watch.mjs`
- notion-sync の `package.json`・`pnpm-lock.yaml`・`dist/extension.js`
- `tests/take-in.test.mjs`・`notion-sync.test.mjs`・`build-fixes.test.mjs`・`run-all.mjs`

### A.5 残る申し送り（合否には含めない）

- p4-watch の `watch-design.md` に、`writeBackTakeIn` の `closedPageId` と「閉じたページには書かない」を足すこと（蒙恬の申し送りのとおり）。
- notion-sync の `dist/` をリポジトリに入れるかは、リーダーの判断待ちのまま（p4-notion-sync の未解決 1）。
- 作業ツリーにある範囲の外の変更（7節）は、コミットの前に誰のものか確かめること。

---

（以下は1回目の記録。そのまま残す）

## 0. 総合（1回目）

| 項目 | 合否 |
|---|---|
| 1 レビュー（取り込み・検知・notion-sync・`-ExpandOnly`） | 合格（軽微な指摘 3 件。4.1） |
| 2 実行: `node tests/run-all.mjs` | 合格（1307 件、pass 1293、fail 0、skip 14） |
| 2 実行: build.mjs の dry-run（apply への受け渡し・lockfile の `--removals`） | 合格 |
| 2 実行: watch の dry-run（差し替えの入力） | 合格（`runWatch` を差し替えの取得と Notion で通すテストで確かめた。CLI の `--fixtures`・`--notion-fake` の読み込みの道は走らせていない） |
| 2 実行: `take-in.mjs core/ext --dry-run`、`adopt.mjs --dry-run` | 判定できない（私の許可に無い。蒙恬の `trial-log.md` の4節を読んだだけ） |
| 2 実行: `pnpm --dir extensions-src/notion-sync run build` | 判定できない（許可にあるのは `run test` だけで、`build` は無い。`test` の script は無い） |
| 3 SHA-256 | 済み（5節） |

不合格の点は無い。ただし 2 の CLI の dry-run 3 本と notion-sync の build は、私の権限では走らせられなかった。そのため総合は「判定できない（部分）」とする。リーダーが自分で流すか、許可を足すか、蒙恬の記録で足りるとするかを決めてほしい（6節）。

## 1. レビュー: 取り込み（蒙恬。`TAKE-IN.md`・`scripts/take-in.mjs`・`scripts/adopt.mjs`・`scripts/lib/take-in/`）

### 1.1 手順が docs/06 の4節・9節のとおりか — 合格

- 手順の並びは `CORE_STEPS` = 1・2・3・4・5・6・7・9・10 で、8 は欠番（`steps.mjs`）。止める条件は `nextAction` のとおり: 1 はタグが無ければ止める。2 は修理へ回す。3 は3回まで。4 は fail で止め、未分類の拡張だけなら hold。5 は型検査の誤りだけ修理へ回す。6・7・9・10 は止めない。docs/06 の4節の表と合う。
- 9節の各点:
  - 展開: 手順 5 の終わりに `switch.ps1 <label> -Zip -Sha256 -ExpandOnly` を呼ぶ（`take-in.mjs` 726〜743 行）。
  - 修理の作業場所: `--add-dir` は取り込みのブランチの作業ツリー `<buildRoot>\take-in\<label>\repo`（`ctx.bwt`）。
  - 判定の形: `VERDICT_SCHEMA` に `kind`・`reasons`・`materialsRead`・`missingMaterials`・`userChecksBeforeSwitch`・`markdown` がある。`missingMaterials` があれば pass を誤りにする（`validateVerdict`）。
  - 記録: main の作業ツリーの `records/take-in/<label>/` に置く。
  - 通信の監査の環境: `install-extensions.mjs --portable` で作る（`buildNetEnv`）。
  - スモークの基準: 3回の `--prime` を `--save-baseline` と、2回目からの `--merge-baseline` で残す（`smokeRunArgs`）。
  - ロックファイルの検査: `build.mjs --removals <ブランチ>\removals`。
- 台本の照らし合わせ（`guardVerdict`）は、手順 7 を走らせなかったとき（`netaudit: skipped`）にも「合格にしない」を出す（`factsFrom` が skipped を入れ、`notOk` が拾う）。

### 1.2 `claude -p` の起動が規約どおりか — 合格

- 判定（`buildClaudeInvocation` の `kind: 'verdict'`、`claude.mjs` 91〜98 行）:
  - `--agent di-renjie` を付ける。`--bare` も `--setting-sources` も付けない。
  - 作業場所はリポジトリの直下（`path.resolve(repoRoot)`、`take-in.mjs` の呼び出しは `repoRoot: REPO`）。
- 子の環境変数（`claudeChildEnv`）: `ANTHROPIC_API_KEY`・`ANTHROPIC_AUTH_TOKEN`・`CLAUDE_CODE_SIMPLE`・`CLAUDECODE`・`CLAUDE_CODE_ENTRYPOINT`・`ELECTRON_*`・`VSCODE_*` を、大文字小文字を問わず外す。呼び出し側の env は変えない。
- 本物の起動の記録 `tasks/2026-11-14-p3-take-in/trial/probe/probe.json`:
  - 引数は `-p --output-format json --agent di-renjie --json-schema … --permission-mode dontAsk --strict-mcp-config --no-session-persistence --max-turns 5`。cwd はリポジトリの直下。
  - 終了 0。`structured_output` は `{"ok":true,"agent":"di-renjie"}`。

### 1.3 修理は Bash なしで、`--strict-mcp-config` を付けているか — 合格

- `kind: 'repair'`（`claude.mjs` 100〜110 行）の引数: `--tools Read,Glob,Grep,Edit,Write --permission-mode acceptEdits --strict-mcp-config --disallowedTools mcp__* --add-dir <ブランチの作業ツリー> --append-system-prompt-file <REPO>\TAKE-IN.md`。Bash は無い。
- git の操作（`add`・`am --continue`・`format-patch`・`commit`）は、台本が `G.COMMIT_IDENTITY`（shuko-apply）で行う。
- 修理の後の守り（`guardBuilder`）は、`outsideAllowed` を正規化した形（`normalizeRepoPath`・`isInsideAllowed`）で見て、外の変更を戻す。曹参のテストが前回落とした `removals/../src/x.ts` は、今回は外として扱われた（`take-in.test.mjs` の該当テストが通る）。

### 1.4 `adopt.mjs` がプッシュしないか — 合格

- `planAdopt` の手順は merge → confirm-upstream（core）→ commit-records → tag → remove-worktree → delete-branch → next。`push` の段は無い。`adopt.mjs` が呼ぶ git は `planAdopt` の段と `status`・`rev-parse`・`add`・`commit`・`diff --cached` だけ（`adopt.mjs` 全文を読んだ）。

## 2. レビュー: 検知（蒙恬。`tools/watch/`・`scripts/lib/read-secret.ps1`・`notion-client.mjs`・`notion-todo.mjs`）

### 2.1 秘密を `read-secret.ps1` だけが読み、値がログ・記録・引数に出ないか — 合格

- トークンのファイル（`notion-token.dpapi`）を開くのは `read-secret.ps1` だけ（`ConvertTo-SecureString` を grep したところ、ほかに当たるのは `check-dpapi.ps1` のでたらめな値の自己確かめだけ）。
- 呼び方は `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File read-secret.ps1 -Path <file>`（`readNotionToken`）。値は標準出力でだけ受ける。引数に入るのはファイルのパスだけ。
- 誤りの文: `readNotionToken` は stderr の先頭3行と終了コードだけ、`NotionError` は HTTP の状態・code・message だけを持つ。`--check-token` は長さと先頭の種類だけを出す。
- テスト（`watch.test.mjs`）: 「トークンはログにも state.json にも出ない」「誤りの文に標準出力（値）を入れない」が通る。
- `set-token.ps1` は `Read-Host -AsSecureString` で受け、引数で受け取らない。

### 2.2 重複を防ぐか — 合格

- `upsertTodo` の順: `state.json` の開いているページ ID → 無い・閉じていればデータソースを検索（プロジェクト・題名の前方一致・状態が Done/Archived でない）→ 見つからなければ作る。
- 直すときは、優先度を高いほうへ、期限を早いほうへ寄せる。docs/06 の9節の最後の項のとおり。失敗の ToDo は高・翌日。
- テストの通し（同じ入力の2回目は足さない、Done の後は新しく作る、state.json を失っても重複しない、壊れた state.json）が通る。蒙恬の試し A1〜A6 の記録とも合う。

### 2.3 「セキュリティ修正あり」の判定が docs/06 の2.2 のとおりか — 合格

- (a) `relevantAdvisories`: 修正版 P が「今の版 < P ≤ 最新の版」にあり、今の版が影響の範囲に入るもの。範囲が読めないときは入るとみなす。
- (b) `finishCore`: リリースノートの、その版の「Update x.y.z」の文の security、または GitHub のリリース本文の security。
- 通知のきっかけは「まだ見ていないアドバイザリの ID」（`seenAdvisories`。docs/06 の9節）。セキュリティの印は、今の版にまだ入っていない修正すべてで決める。取り込むまで印が残るのは、資料の意図に合う。
- 拡張は常に「セキュリティ修正なし」（Open VSX に印が無い）。これは蒙恬の判断待ち（p4-watch の未解決 3）のまま。

## 3. レビュー: notion-sync（蒙恬。`extensions-src/notion-sync/`、`node_modules` を除く）

### 3.1 トークンが SecretStorage だけに置かれるか — 合格

- `extension.mts` は `context.secrets`（キー `notionSync.token`）にだけ `store`・`get`・`delete` する。入力欄は `password: true`。settings.json・`sync-base.json`・ログには書かない。
- `notion-client.mts` の誤りの文に URL とヘッダを入れない。テスト「トークンの値は結果・ログ・基底に出ない」が通る。

### 3.2 競合・分割・`ignoredSettings` — 合格

- 競合: `decide` は、手元と Notion の sha256 をそれぞれの基底と比べ、export・import・conflict・converged・none を返す。書き出す直前に manifest の rev を読み直し、違えば1回やり直す（`RevChangedError`）。docs/05 の6節と10節（基底は2つの sha256、rev は読んだときの値と比べる）のとおり。
- 分割: `splitText` は 2000 文字ごとに分け、サロゲートペアを割らない。100 要素を超えれば `TooLargeError`（書かない）。
- `ignoredSettings`: jsonc-parser の `modify` で最上位のキーだけを足し引きする。コメントを保ち、手元の値を残し、手元に無いキーは入れない。
- テストは `notion-sync.test.mjs` の 101 件がすべて通る。

### 3.3 依存の版の固定と install スクリプトの扱い — 合格

- `package.json` の依存は5つとも版を固定している: `jsonc-parser 3.3.1`・`@types/node 24.19.2`・`@types/vscode 1.146.0`・`esbuild 0.28.2`・`typescript 7.0.2`。
- `pnpm-lock.yaml` は lockfileVersion 9.0 で、どのパッケージにも `integrity`（sha512）がある。
- `pnpm-workspace.yaml` の `allowBuilds: esbuild: false` は、ルートの `pnpm-workspace.yaml`（`'@vscode/vsce-sign': false`）と同じ書き方。
- `dist/extension.js` に入る第三者のコードは jsonc-parser（MIT）だけ。`ThirdPartyNotices.txt` がある。

## 4. レビュー: `switch.ps1 -ExpandOnly` と build.mjs の受け渡し（蒙恬、p2-build-switch の追記3・4）

- `-ExpandOnly`（`git diff scripts/switch.ps1`）:
  - `-Zip` の展開と `Get-ShukoEditorInfo` の確かめの後、`Out-Summary -Code 0` で `exit` する。
  - その前に通る処理は `current` の読み、`versions` の列挙、`Read-History`（読むだけ）。
  - `history.txt` への追記、`backups` への写し、ジャンクションの付け替えは、どれも `ExpandOnly` の分岐より後ろにあり、通らない。`-List`・`-Previous` と一緒なら誤り。
  - → `current`・`history.txt`・`backups` に触れない。合格（コードを読んで確かめた。自動のテストは無い。4.1 の T-1）。
- build.mjs（`git diff scripts/build.mjs`）と dry-run（2節）:
  - apply の手順に `--prev-tag`・`--keep-conflict`・`--patches`・`--assets`・`--overlay`・`--lock`・`--extensions-src`（絶対パス）と、`--build-root`・`--config` が付く。
  - lockfile の手順に `--removals` と `--build-root`・`--config` が付く。
  - 合格。

### 4.1 指摘（不合格の点ではない。直すかはリーダーが決める）

コード（蒙恬）:

- M-1 `take-in.mjs` の手順 2 は `apply.mjs` を直接呼ぶ（`corePlan.apply`、564〜566 行）。このとき `--build-root`・`--config` を渡していない。
  - 影響: take-in に `--config` か `--build-root` を渡すと、apply.mjs の `--manifests` の既定（`<buildRoot>\cache\vsix`）が、既定の local.json の buildRoot になる。take-in と build.mjs が使う buildRoot とずれる。
  - 追記3 で build.mjs をそろえた趣旨と同じ穴。既定どおりの使い方では起きない。
  - 直し方: `corePlan.apply` の引数に `common`（`--config`・`--build-root`）を足す。
- M-2 `take-in.mjs` の ext は、書き戻しに `extId: a.id` を渡す（`args.mjs` 120 行で小文字にしている）。
  - 影響: `state.json` が無いときの題名の前方一致の検索（`findOpenTodo`）が、大文字を含む ID（台帳の `MS-CEINTL.vscode-language-pack-ja`）で、検知が作った題名（台帳の大小のまま）に当たらないおそれがある。state.json があるときは、キーが小文字にそろうので当たる。
  - 直し方: 台帳の行の `entry.id` を渡す。
- M-3 `writeBackTakeIn` は、`state.json` の覚えたページが Done・Archived でも、そのページに書いて In progress に戻す（`retrievePage` の後に `isOpenPage` を見ない。`notion-todo.mjs` 406〜409 行）。
  - 影響: docs/06 の4節の10「開いている ToDo のページ ID で見つけ」と少し違う。起きるのは、ToDo を閉じてから取り込みを走らせたときだけ。

テスト（曹参）。どれも、今日の 9節と後の直しの分のテストが無いというもの。今あるテストが仕様を緩めている箇所は見つけていない。

- T-1 `switch.ps1 -ExpandOnly`（current・history・backups が変わらないこと、`-List`・`-Previous` と一緒なら終了コード 1）、build.mjs の `applyPassThrough`、lockfile の `--removals` を確かめるテストが無い。蒙恬の追記4の「テストの入口」に挙がっているが、曹参の依頼（p2-tests-build の追記2）の範囲の外だった。割り当てはリーダーが決める。
- T-2 修理の起動の引数のうち、`--strict-mcp-config` があること、`--tools` が `Read,Glob,Grep,Edit,Write` であることを直接確かめるテストが無い。Bash が無いことは正規表現で確かめている。`--add-dir` に `builderWorktree` が先に使われることも確かめていない（今のテストは `builderWorktree` を渡さずに REPO を期待する）。
- T-3 `smoke-net.mjs`（`smokeRunArgs`・`summarizeSmoke`・`netauditArgs` など。9節のスモークの基準と監査の環境）と、`normalizeRepoPath`・`isInsideAllowed` を直接確かめるテストが無い。後者の確かめは `outsideAllowed` の `removals/../src/x.ts` の1例だけ。蒙恬の追記2が挙げた `C:/x`・`/x`・`\\srv\x`・`removals/A-1/../B-2/unit.json` などの組が無い。
- T-4 `readNotionToken` の引数に `-ExecutionPolicy Bypass` があることを確かめていない（docs/06 の9節の事実）。
- T-5 廃止の空のファイル（`tests/p34/api.mjs`、`tests/fixtures/ref-p34/ref.mjs`、`tests/p34-selfcheck.test.mjs`）が未追跡のまま残っている。`p34-selfcheck.test.mjs` は run-all で1件と数えられている。コミットに含めないこと。

テストが落ちるべきときに落ちることの裏付けとして、曹参の前回の run-all（`tasks/2026-11-14-p34-tests/run-all-result.txt`）で、`outsideAllowed: ../ で外へ出るパスを通さない` が直す前の実装で落ちていた。直した後の今回は通る。

## 2（実行）の詳しい記録

### 2.a `node tests/run-all.mjs --save tasks/2026-11-14-p34-verify/run-all-result.txt`

終了コード 0。合計 1307 件、pass 1293、fail 0、skip 14（skip は既存の removals.test.mjs の 14 件）。今回の対象の内訳は次のとおり。

| ファイル | 件数 | pass | fail |
|---|---|---|---|
| take-in.test.mjs | 95 | 95 | 0 |
| watch.test.mjs | 99 | 99 | 0 |
| notion-sync.test.mjs | 101 | 101 | 0 |
| build-fixes.test.mjs | 17 | 17 | 0 |

`node --test tests/take-in.test.mjs`、`node --test tests/notion-sync.test.mjs tests/build-fixes.test.mjs`、`node --test tests/watch.test.mjs` を別にも流し、同じ件数ですべて通った（95、118、99）。

### 2.b build.mjs の dry-run

```
node scripts/build.mjs 1.146.0 --dry-run --from apply --to lockfile --config C:/b/trial-install/cfg/local.json --prev-tag 1.145.3 --keep-conflict --patches patches --assets assets --overlay product.overlay.json --lock extensions.lock.json --extensions-src extensions-src --removals removals
```

- `result: dry-run`。buildRoot `C:\b\trial-build`（試しの local.json から）。
- `plan.apply.command` には `--prev-tag 1.145.3 --keep-conflict --patches <絶対> --assets <絶対> --overlay <絶対> --lock <絶対> --extensions-src <絶対> --build-root C:\b\trial-build --config C:/b/trial-install/cfg/local.json` が付いた。
- `plan.lockfile.command` には `--lockfile-check … --removals <絶対> --build-root … --config …` が付いた。

### 2.c watch の dry-run

- 許可に `node tools/watch/watch.mjs` が無いので、CLI は走らせていない。
- `watch.test.mjs` の「通し: --dry-run は Notion に書かず、state.json も watch.log も作らない。計画を返す」で確かめた。このテストは `parseArgs` と `runWatch` を、差し替えの取得と Notion で通す。通っている。
- 蒙恬の試し（`tasks/2026-11-14-p4-watch/trial-log.md` の3・4節）の CLI の出力の記録とも矛盾しない。

### 2.d take-in・adopt の dry-run（判定できない）

- 許可に `node scripts/take-in.mjs`・`node scripts/adopt.mjs` が無い。テストも CLI の dry-run を走らせていない（引数の誤りの終了コード 2 だけ）。
- 蒙恬の `trial-log.md` の4節（core・ext の dry-run の終了 0、adopt の dry-run の refused）と9節（`expandOnlySupported: true`）を読んだ。中身は、私が読んだ `corePlan`・`runExt` の dry-run の分岐と合う。

### 2.e notion-sync の build（判定できない）

- 許可にあるのは `pnpm --dir extensions-src/* run test` だけ。`package.json` に `test` の script は無く、`build` は許可に無い。
- 蒙恬の `trial-log.md` の記録（型検査の誤りなし、dist の読み込みの確かめ、`--trial` の 48 項目）を読んだだけ。

## 5. 確かめた版の SHA-256

```
93d73b145cf8bd5b27c2d8b4455080adb0639b4d6efcfd357390ddb7af8eac1f  TAKE-IN.md
89c5e41f1b711e1645f2bdb9790e9b5255c8012d64337f1faed2ffb08d674984  scripts/take-in.mjs
7cbc2cd435348e43cd4dc26c9d02011cc4d74d33540fb8b2dbd90228f8ba5162  scripts/adopt.mjs
31de7b7fda00998b093c79093eb8243ad48ea47267c017af742d402f303dba0d  scripts/lib/take-in/adopt.mjs
88a04b62a2f9b2fcf348201349fc90e440dd7a40cdf08ef35bb0e7b8b27de625  scripts/lib/take-in/args.mjs
4f9ee1cf0df939efbc41ad1c09a9258c147b3d40e6eeef47e5392c60341e5084  scripts/lib/take-in/claude.mjs
6e69bb9047cbd67f67e58c06bf7259f241e0ec0d581fe812719523d34f59fa92  scripts/lib/take-in/ext.mjs
3c9bc2265907e78dfef083e734ce7114dc268d1c1254044cf1bad8ae99f9b621  scripts/lib/take-in/records.mjs
5b44bc2dca466448b602593dadec08564bda6f3069e3ec4711140e2540b5cac0  scripts/lib/take-in/repair.mjs
ec881db16e45bdbdb68204c6efe977d864ea53a6327811698065c9d058d2b62f  scripts/lib/take-in/smoke-net.mjs
0d91e2a14426a2d1b834441625127be794ea70c7512c1377262a6cc42684bf48  scripts/lib/take-in/steps.mjs
14ee3a443cb325a8e6f31fea42f8c7b97c7b4413bd53656b1cd7c5200a13323e  scripts/lib/take-in/upstream-info.mjs
f30f6917df88dc4d3a899af946e923d6fe6ec5cf68bb51e03534aa77d5db2578  scripts/lib/take-in/verdict.mjs
75bdf98cd1ed16146a00dca1acb0883334bcddc4fbedcbe7772f4dcdfcd316e1  scripts/lib/take-in/writeback.mjs
51123305e7d6c60391bf6e150e95534ad6220611520f0fdacc96caa3c3e8d72f  scripts/lib/read-secret.ps1
fde1d6a56974ce828473acc1e01a5ebe0df9da01d3552817137f423df2ca3605  scripts/lib/notion-client.mjs
8308a152ab9fc020ca4867d3dfe09c81e11bcfaf988db48022d086910613cff3  scripts/lib/notion-todo.mjs
eae02cfc899336ce6456e29b4e3e22e937c0e88d6de54a6315463e416b5a8495  tools/watch/watch.mjs
c118fac3ee8e40e90054a1f2d5fdee9046af6ea1e2fde660ca39e5a1f53f60ac  tools/watch/lib/fake-notion.mjs
5dfd6f8e06b0d371f8be30339880918fde724c487767cf6bf459b78bf9f5b922  tools/watch/lib/judge.mjs
9885e05f93166157ef1ad8a06c0b02d6c67650700da2916c3fab58bd90d8f847  tools/watch/lib/sources.mjs
744f84b59835ec42d959eab71cf6e1a06000afcef9d112941573838ac6324adf  tools/watch/lib/state.mjs
dcf8ce49e7b96b77bedde22c0986dbe1bcaf7d002881fcddb7674ad39e396168  tools/watch/check-dpapi.ps1
4e66e9a4c735db1e9161a2b5af1f2f8bbc1c19ac4946b20312285b798542c9d2  tools/watch/register-task.ps1
48a07aa6fcfa6a6aba7b4d4f9136792150c518313f33d527fec0f94f9e4586f0  tools/watch/set-token.ps1
b97f0bf0989f66cecab4584fc91287cc212c72fc0035aaeef70c527c4f5e34cd  scripts/switch.ps1
8f3e66cd2767e5288fc6519c81453940cefac1515c1203be379ed87fff93a167  scripts/build.mjs
241a8618fdbb81398bc121de6d64f19e2379f1c0f130b2d44a49bf1f4ed37b6b  scripts/apply.mjs
9059f24e35702df3669adb31de75b252d07b934a420e0d2d7459dff3d4b35b72  extensions-src/notion-sync/package.json
fc1ec1f853eeb0531f8292a881285930ad2b8557dea329f49e705215bb6f67e1  extensions-src/notion-sync/pnpm-lock.yaml
104a0b9b4484cb237e8856d7b058c51ed4469923479c0f263ec97dd0d96e0fbd  extensions-src/notion-sync/pnpm-workspace.yaml
53762b6c6331e281d523a1f02c1fb50803359583243ac248708d822886d51e42  extensions-src/notion-sync/tsconfig.json
e73e095524908ccf35dde1ed1be780bd3198876f4a17915d739e251a05a70de8  extensions-src/notion-sync/build.mjs
b63db4235362b64c1b46ea0f9f997022c7930a18b62a3e6ebe447d78b84c4b54  extensions-src/notion-sync/README.md
55bcd110db1a4091f6a4de38a1ef0517d20fb32d62ae912ab73e72a4f97bfa24  extensions-src/notion-sync/ThirdPartyNotices.txt
613fb847e5869422818cf23f6815b7ab372d4b802d843d556e401b835a77b41d  extensions-src/notion-sync/dist/extension.js
4dcf7b1aa67b20cd6b51f8594d387a742be64be39a0f79a88809e3c3b639c6d8  extensions-src/notion-sync/dev/fake-notion.mts
e55b4e72d13c8585a66556ded4c02ca5fc29245318dbdc4692e5e72475d66deb  extensions-src/notion-sync/dev/trial.mts
b2d85bbad59051bb4dc063e590a23ab84f3329ba4a453fa6467e57694e952f51  extensions-src/notion-sync/src/decide.mts
13532929d77bf044040dc386525f1e6025593e5d44b951954dff064af3a6a43c  extensions-src/notion-sync/src/extension.mts
3e78a07fb969ad082de81bbd0313a1dabbb51472f825f4efc4a042ba4472625d  extensions-src/notion-sync/src/manifest.mts
96cbf6b519b6629bccfe05962ee9102625011cb2990f084cc301a1730a6842cb  extensions-src/notion-sync/src/names.mts
50da7037abf0becfbee76597caaa60db6ba664ad2add84d9b46f06253e832f20  extensions-src/notion-sync/src/notion-client.mts
7d2886ebcbfd45b1fd7a42f4eb64569f001165931078b119a865b55ab5f56c0d  extensions-src/notion-sync/src/page.mts
c7d82e1fcd2da3a86ce3a832cd9a78c10a16fead05ad53bc814bd87d37482733  extensions-src/notion-sync/src/settings-filter.mts
3c448e9f581a3db374a002094e9c71f0b54a692b5c65dead5197da0d7789d7a6  extensions-src/notion-sync/src/stores.mts
6c51e567211af1edcbaa05296330d93897a3b77d2b3831292734724d678d8327  extensions-src/notion-sync/src/sync.mts
2e4f726c2380489a3036af92d6957bfb2d648a1a4ee7e425a3a07ed6938e4d26  extensions-src/notion-sync/src/text.mts
c9494e02148f418a3749262f6c0e73d1c0ed60b705438d72082e48a4e7d5a3e1  tests/take-in.test.mjs
eacc2972d4e042a0876e199e84ef683a0c352e3a301ecdfd63cb8e6fc5a57204  tests/watch.test.mjs
c60f81420e038045021657104541321b5a2fd3a6b4b1bfa4224760175ac4e6f8  tests/notion-sync.test.mjs
86f40946c958187a97a554d44596bd89d983d7b408d25043b258b11391321fbf  tests/build-fixes.test.mjs
669b4c38b02b3c793bb9109e5d47d4931dee336c0df7689fb9677d8c17329d62  tests/build/path-entries-probe.ps1
24612a676fa1325e4024559e875249e89e0e05e19143258d111f4e5e32494a38  tests/run-all.mjs
```

## 6. 判定できない分と、要るもの（リーダーへ）

| 何のために | 要るもの |
|---|---|
| `take-in.mjs core 1.147.0 --dry-run`・`ext anthropic.claude-code --dry-run` を自分で流す | Bash の許可 `node scripts/take-in.mjs`（`--dry-run --watch-state <無いファイル>` で使う） |
| `adopt.mjs <label> --dry-run` を自分で流す | Bash の許可 `node scripts/adopt.mjs` |
| watch の CLI を `--fixtures`・`--notion-fake` で流す | Bash の許可 `node tools/watch/watch.mjs` |
| notion-sync の build | Bash の許可 `pnpm --dir extensions-src/* run build` |
| `switch.ps1 -ExpandOnly` を試しの installRoot で流す（任意） | Bash の許可 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1` |

権限の変更にはユーザーの承認が要る。許可を足さずに、リーダーが自分で流すか、蒙恬の記録で足りるとして進める道もある。

## 7. コミットの前に見てほしい作業ツリーの物（範囲の外）

- `tests/probe-dns.ps1` の書き換え、未追跡の `tests/probe-netlog.ps1`・`probe-netlog2.ps1`・`probe-nodedebug.ps1`。この検証の対象の外で、誰の作業かは確かめていない。どれも `.tests.ps1` でないので、run-all には入らない。
- `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` などの一時のファイル。

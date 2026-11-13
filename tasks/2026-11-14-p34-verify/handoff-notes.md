# 引き継ぎ（p34-verify。大岡越前守 → ヴラド・ツェペシュ）

- 日付: 2026-11-14
- 詳しい記録: `verification-log.md`（先頭の「追記 A」が2回目）。全体の走らせの結果: `run-all-result.txt`（1回目）、`run-all-result-2.txt`（2回目）

## 追記（2回目の確かめ。判定できなかった分を曹参のテストで埋めた。権限は変えていない）

### 判定: **合格**

- 1回目に「判定できない」とした3つは、曹参の新しいテストが子のプロセスで走らせて確かめる形になった。私は run-all で走らせ、テストの中身を読んだ。
  - take-in・adopt の dry-run
  - watch の CLI
  - notion-sync の build
- 蒙恬の M-1〜M-3 の直しは、指摘どおりに入っている。
- 曹参の T-1〜T-4 はテストが足された。T-5（廃止の空のファイル）はリーダーの指示で対象外とした。
- 不合格の点は無い。合格なので、リーダーがコミットしてよい。

| 項目 | 合否 |
|---|---|
| 1 レビュー | 合格（M-1〜M-3 直った） |
| 2 `node tests/run-all.mjs` | 合格: 1386 件、pass 1372、fail 0、skip 14（既存の removals）。曹参の申告と一致 |
| 2 take-in・adopt の dry-run | 合格: `take-in-more.test.mjs` の CLI の 17 件（take-in 10、adopt 7） |
| 2 watch の CLI（`--fixtures`・`--notion-fake`） | 合格: `cli-run.test.mjs` の 11 件 |
| 2 notion-sync の build | 合格: `cli-run.test.mjs` の build の試し。一時の写しで `install --frozen-lockfile --ignore-scripts` → `run build`。飛ばしていない |
| 3 SHA-256 | 済み（`verification-log.md` の A.4） |

### 確かめた成果

- 蒙恬の M-1〜M-3 の直し（`tasks/2026-11-14-p3-take-in/handoff-notes.md` の追記3）:
  - `scripts/take-in.mjs`: SHA-256 `ac003dea…`
  - `scripts/lib/notion-todo.mjs`: SHA-256 `4babffd6…`
- 曹参の新しいテスト:
  - `tests/switch-expand.test.mjs`: 17 件
  - `tests/take-in-more.test.mjs`: 43 件
  - `tests/cli-run.test.mjs`: 14 件
  - `tests/watch.test.mjs` の追記: 104 件

### 根拠の要点

- **M-1**: `corePlan.apply` に `...common`（`--config`・`--build-root`）が入った。CLI の dry-run のテストで、試しの値が渡ることを確かめた。
- **M-2**: 書き戻しの対象が `entry.id`（台帳の大小のまま）になった。`MS-CEINTL.vscode-language-pack-ja` を state.json 無しで見つけるテストが通る。
- **M-3**: `writeBackTakeIn` は `isOpenPage` のページにだけ書く。閉じたページは状態も本文も変えず、検索に回り、無ければ `ok: false` を返す（テスト3件）。
- テストの期待は仕様どおりで、緩めていない。
  - `-ExpandOnly` の前後で、current・history・backups・ユーザーのデータを丸ごと比べる。
  - 修理の引数は値まで見る（`--tools` は5つだけ、`--strict-mcp-config`、`--add-dir` はブランチの作業ツリーが先）。
  - パスの正規化は、ドライブ文字・UNC・外へ出る `..` を外として扱う。
  - スモークは3回の基準。
  - adopt は一時の git リポジトリで実際にマージ・タグ・ブランチ削除まで行い、push しない。
  - claude は起動しない（`--claude` に node.exe を渡す）。
  - 本物の Notion・LOCALAPPDATA に触れない（一時の場所を渡す）。
- 走らせた後も、`records/` に何も足されていない。`extensions-src/notion-sync/dist/extension.js` の SHA-256 も前と同じだった。

### 弱い点（指摘のみ。合否に含めない）

- `take-in-more` の M-2 の1件は、ソースの文字列を見るだけ（動きは watch の M-2 のテストが見ている）。
- `cli-run` の build の試しは、`deactivate` が undefined でも通す。拡張の build.mjs 自身は両方を要求していて、その build が通っているので実害は無い。npm のレジストリへの接続が要る。
- `switch-expand` の「実行中のエディタを見ない」の1件は、`running` が無いことを見るだけ。

### 残る申し送り

- p4-watch の `watch-design.md` に、`closedPageId` と「閉じたページには書かない」を足すこと（蒙恬の申し送り）。
- notion-sync の `dist/` をリポジトリに入れるかは、判断待ちのまま。
- 範囲の外の作業ツリーの変更は、コミットの前に誰のものか確かめること。
  - `tests/probe-dns.ps1`
  - `tests/probe-netlog*.ps1`・`tests/probe-nodedebug.ps1`
  - `*.section3.tmp`
  - 廃止の空のファイル3つ

---

（以下は1回目の報告。そのまま残す）

## 判定（1回目）

**判定できない（部分）。** 確かめられた範囲はすべて合格で、不合格の点は無い。

ただし、依頼書の 2 のうち次の 3 つは、私の許可に無いので走らせていない。蒙恬の試しの記録を読んだだけである。

- `take-in.mjs core/ext --dry-run`
- `adopt.mjs --dry-run`
- `pnpm --dir extensions-src/notion-sync run build`

| 依頼書の項目 | 合否 |
|---|---|
| 1 レビュー（取り込み・検知・notion-sync・`-ExpandOnly`） | 合格。軽微な指摘あり（下） |
| 2 `node tests/run-all.mjs` | 合格: 1307 件、pass 1293、fail 0、skip 14（既存の removals の 14） |
| 2 build.mjs の dry-run（apply への受け渡し、lockfile の `--removals`） | 合格 |
| 2 watch の dry-run | 合格。`runWatch` を差し替えの入力で通すテストで確かめた（CLI は許可に無い） |
| 2 take-in・adopt の dry-run、notion-sync の build | 判定できない（許可に無い） |
| 3 SHA-256 | 済み（`verification-log.md` の5節） |

## 確かめた成果

- 蒙恬:
  - 取り込み: `TAKE-IN.md`、`scripts/take-in.mjs`、`scripts/adopt.mjs`、`scripts/lib/take-in/`
  - 検知: `tools/watch/`、`read-secret.ps1`、`notion-client.mjs`、`notion-todo.mjs`
  - `extensions-src/notion-sync/`
  - `switch.ps1 -ExpandOnly`、build.mjs から apply.mjs への受け渡し（p2-build-switch の追記3・4）
- 曹参: `tests/take-in.test.mjs`・`watch.test.mjs`・`notion-sync.test.mjs`・`build-fixes.test.mjs`

## 根拠の要点

- 判定の `claude -p`:
  - `--agent di-renjie` を付け、`--bare` も `--setting-sources` も付けない。
  - 作業場所はリポジトリの直下。
  - `ANTHROPIC_API_KEY`・`ANTHROPIC_AUTH_TOKEN`・`CLAUDE_CODE_SIMPLE` などを外す。
  - 本物の起動の記録（`probe.json`）でも、この形で終了 0 だった。
- 修理の `claude -p`:
  - `--tools Read,Glob,Grep,Edit,Write`（Bash なし）、`--strict-mcp-config`、`--disallowedTools mcp__*`。
  - `--add-dir` は取り込みのブランチの作業ツリー。
  - 外の変更を戻す守りは、正規化したパスで見る（前回落ちた `../` のテストが今回は通る）。
- `adopt.mjs` に push の段は無い。
- 検知:
  - トークンを読むのは `read-secret.ps1` だけ。値は標準出力でだけ受け、ログ・state・誤りの文に出ない（テストあり）。
  - 重複は「state の開いているページ → データソースの検索 → 作る」で防ぐ。
  - 「セキュリティ修正あり」は docs/06 の2.2 の (a)(b) と 9節（まだ見ていない ID）のとおり。
- notion-sync:
  - トークンは `context.secrets` だけに置く。
  - 競合は2つの sha256 と rev の読み直しで判断し、分割は 2000 文字（サロゲートを割らない、100 要素まで）。ignoredSettings は jsonc-parser で最上位のキーだけを扱う。
  - 依存5つは版を固定。lock に integrity がある。`allowBuilds: esbuild: false`。
- `switch.ps1 -ExpandOnly` は、確かめの後に `exit 0` する。engines・バックアップ・ジャンクション・history の処理より前で抜ける。
- build.mjs の dry-run（試しの local.json）で、apply と lockfile の手順に受け渡しの引数と `--removals` が付くことを見た。

## 直す必要がある点（不合格の点ではない。軽微。直すかはリーダーが決める）

蒙恬:

1. M-1 `take-in.mjs` の手順 2 は、`apply.mjs` に `--build-root`・`--config` を渡していない（`corePlan.apply`）。
   - take-in に `--config`・`--build-root` を渡すと、apply の `--manifests` の既定がずれる。
   - 直し方: `common` を足す。
2. M-2 ext の書き戻しに、小文字にした ID を渡している。
   - state.json が無いときの題名の検索が、大文字を含む ID（`MS-CEINTL.vscode-language-pack-ja`）で当たらないおそれがある。
   - 直し方: 台帳の `entry.id` を渡す。
3. M-3 `writeBackTakeIn` は、覚えたページが Done・Archived でも書き、In progress に戻す（`isOpenPage` を見ない）。

曹参（足りないテスト。今日の 9節と後の直しの分）:

1. T-1 `-ExpandOnly`・`applyPassThrough`・lockfile の `--removals` のテストが無い。曹参の依頼の範囲の外だったので、割り当てを決めてほしい。
2. T-2 修理の引数の `--strict-mcp-config`・`--tools` を直接見るテストが無い。`--add-dir` が `builderWorktree` を先に使うことも見ていない。
3. T-3 `smoke-net.mjs`（3回の基準・監査の環境）と `normalizeRepoPath`・`isInsideAllowed` の組（`C:/x`・`/x`・UNC・中に留まる `..`）のテストが無い。
4. T-4 `readNotionToken` の `-ExecutionPolicy Bypass` を見ていない。
5. T-5 廃止の空のファイル（`tests/p34/api.mjs`、`tests/fixtures/ref-p34/ref.mjs`、`tests/p34-selfcheck.test.mjs`）が未追跡のまま。コミットに含めないこと。

## 判定できない分を埋めるのに要るもの

権限の変更は、ユーザーの承認が要る。

- `take-in.mjs`・`adopt.mjs` の dry-run を自分で流すには: Bash の許可 `node scripts/take-in.mjs`・`node scripts/adopt.mjs`
- watch の CLI（`--fixtures`・`--notion-fake`）を流すには: `node tools/watch/watch.mjs`
- notion-sync の build には: `pnpm --dir extensions-src/* run build`

許可を足さずに、リーダーが自分で流すか、蒙恬の記録で足りるとして進めてもよい。

## 範囲の外で気づいたこと

- 作業ツリーに、この検証の対象でない変更がある: `tests/probe-dns.ps1` の書き換え、未追跡の `tests/probe-netlog*.ps1`・`probe-nodedebug.ps1`、`*.section3.tmp`。コミットの前に誰のものか確かめてほしい。

## 記録

- `tasks/2026-11-14-p34-verify/verification-log.md`
- `tasks/2026-11-14-p34-verify/handoff-notes.md`（この報告）
- `tasks/2026-11-14-p34-verify/run-all-result.txt`
- `records/` には書いていない（計測・ビルドの記録の対象が無い）。

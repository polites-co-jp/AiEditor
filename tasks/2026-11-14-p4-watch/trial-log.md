# 試しの記録（p4-watch）

日付: 2026-11-14（JST）。Node.js 24.16.0、Windows PowerShell 5.1.26100。作業ディレクトリはリポジトリの直下。
試しの場所は `C:\b\p4-watch\trial\`。秘密の場所（`%LOCALAPPDATA%\Shuko\watch\`・`secrets\`）は開いていない。本物の Notion には接続していない。タスクスケジューラには登録していない。

差し替えの入力は `tasks/2026-11-14-p4-watch/fixtures/` に置いた（曹参もそのまま使える）。

| ファイル | 中身 |
|---|---|
| `fixtures/repo/` | 試しのビルドリポジトリ（`upstream.json` の tag 1.146.0、台帳3件: claude-code 2.1.322 win32-x64、rainbow-csv 3.24.1、pdf 1.2.2） |
| `fixtures/repo-1.145.0/` | tag 1.145.0 と本物の台帳の8件（記録した本物の応答を流すため） |
| `fixtures/f1-new-core-and-ext.json` | 1.147.0 が出た（プレリリース 1.148.0 と `vsda-v1.2.3` を混ぜた）。リリースノートの本文に security の語（Update の文ではない）。claude-code 2.1.330 |
| `fixtures/f2-security-update.json` | 1.147.1（Update の文に security issues）、アドバイザリ3件（high・medium・今の版が直っている修正の写し）。claude-code 2.1.331、rainbow-csv 3.25.0 |
| `fixtures/f3-after-done.json` | 1.147.2（Update の文は "these issues"） |
| `fixtures/f4-fetch-fail.json` | releases は接続の誤り、アドバイザリは HTTP 500、claude-code は時間切れ、pdf は応答なし |
| `fixtures/verdict-1.147.1-1.json` | 書き戻しの試しの `verdict.json`（docs/06 の7.3 の形。条件付き） |

## 1. 構文の検査

| コマンド | 結果 |
|---|---|
| `node --check` を `tools/watch/watch.mjs`・`lib/sources.mjs`・`lib/judge.mjs`・`lib/state.mjs`・`lib/fake-notion.mjs`・`scripts/lib/notion-client.mjs`・`scripts/lib/notion-todo.mjs` に | すべて通った（出力なし） |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-check-ps.ps1 -Path <各ファイル>` を `scripts/lib/read-secret.ps1`・`tools/watch/set-token.ps1`・`check-dpapi.ps1`・`register-task.ps1` に | 4件とも `OK (non-ASCII bytes: 0)`、PowerShell 5.1.26100.9818 |

## 2. 秘密の読み出し（DPAPI）

| コマンド | 結果 |
|---|---|
| `powershell … -File tools/watch/check-dpapi.ps1 -Dir C:/b/p4-watch/trial` | `read-secret exit=0 same=True plainTextInFile=False` → OK（ファイルは消した） |
| 同 `-Keep` | 同じく OK。`C:\b\p4-watch\trial\selfcheck.dpapi`（686 バイト）を残した |
| `node tools/watch/watch.mjs --check-token --state-dir C:/b/p4-watch/trial/s0 --token-file C:/b/p4-watch/trial/selfcheck.dpapi` | `{ ok: true, length: 57, prefix: "ntn_" }`（Node → powershell.exe → read-secret.ps1 の経路で読めた。値は出ていない） |
| 同 `--token-file …/missing.dpapi` | `ok: false`、`read-secret.ps1 の終了コード 2`: the secret file does not exist |
| 同 `--token-file …/garbage.dpapi`（DPAPI の形の頭だけの16進） | `ok: false`、終了コード 4: cannot decrypt … CryptographicException |
| 同 `--token-file …/empty.dpapi` | `ok: false`、終了コード 3: the secret file is empty |

`set-token.ps1` は隠れた入力欄（`Read-Host -AsSecureString`）を使うので、この環境（対話の入力が無い）では走らせていない。保存の書き方（`ConvertFrom-SecureString` → `Set-Content -Encoding Ascii`）は `check-dpapi.ps1` と同じで、その経路は上で確かめた。

## 3. 本物の取得（読むだけ、1回）

```
node tools/watch/watch.mjs --dry-run --config C:/b/p4-watch/trial/local.json --state-dir C:/b/p4-watch/trial/real --record C:/b/p4-watch/trial/real/responses.json --time-zone Asia/Tokyo
```

`local.json` は `installRoot` = `C:\b\p4-watch\trial\install`（`current` なし）、`builderRepo` = このリポジトリ。取得は GitHub 2件（releases、security-advisories）と Open VSX 8件。リリースノートは本体の候補が無かったので取っていない。

- 結果: `exitCode 0`、取得の誤り 0件。今の本体 1.146.0（upstream.json）。本体の候補なし。拡張の候補1件: `取り込みの検証: 拡張 anthropic.claude-code 2.1.323`（優先度 中、期限 2026-11-21、公開 2026-11-12T22:13:36Z、入れてよい日時 2026-11-15T22:13:36Z）。
- 確かめた事実（応答は `C:\b\p4-watch\trial\real\responses.json`）:
  - `releases?per_page=10` は未認証で取れた。最新は 1.146.0（2026-11-11T10:07:14Z）、その前は 1.145.3・1.145.2・1.145.1・1.145.0・1.144.0・1.143.1・1.143.0・1.142.0・1.141.2。
  - リリースの `body` は、リリースノートの URL だけ（例 `"https://code.visualstudio.com/updates/v1_146"`）。
  - `security-advisories` は未認証で取れた。1.145.3 で直ったものが多数（2026-11-10 公開。high 14・medium 2 を含む）。`vulnerabilities[].package` は `{ "ecosystem": "vs code" | "other", "name": "" }`、`vulnerable_version_range` は `"< 1.145.3"`、`patched_versions` は `"1.145.3"`。
  - Open VSX の `/api/anthropic/claude-code/win32-x64` は小文字の ID で取れ、応答の `namespace` は `Anthropic`。

## 4. 差し替えの入力での試し（Notion は `--notion-fake`）

共通の引数: `--config C:/b/p4-watch/trial/none.json`（無いファイル＝既定値）`--builder-repo <fixtures/repo>` `--install-root C:/b/p4-watch/trial/install` `--time-zone Asia/Tokyo`。

### A. 重複しないこと・セキュリティ修正・書き戻し（state `C:\b\p4-watch\trial\A\state`、Notion `A\notion.json`）

| 回 | 入力・`--now` | 期待 | 結果 |
|---|---|---|---|
| A1 | f1、2026-11-20T00:00Z | 本体 1.147.0（中・11-27）と claude-code 2.1.330（中・11-27）を作る。プレリリースと `vsda-v` は無視。リリースノートの本文の security に釣られない | そのとおり。`created` 2件。題名にセキュリティ修正の印なし |
| A2 | f1、11-21 | 何も書かない | `plan: []`、`results: []`、終了コード 0 |
| A3 | f2、11-22 | 本体は同じページを直す: 題名 `1.147.1（セキュリティ修正あり）`、優先度 中→高、期限 11-27→11-23、本文に「更新: 1.147.1 も出た」。アドバイザリは2件（今の版が直っている修正の写し GHSA-test-cccc は外す）。claude-code は同じページを直す（期限は早い方の 11-27 のまま）。rainbow-csv 3.25.0 を作る（低・11-29） | そのとおり。core `updated`（高・11-23）、claude-code `updated`（中・11-27）、rainbow-csv `created`（低・11-29）。詳細・メモ「セキュリティ修正（アドバイザリ）: 2件（high 1、medium 1）」「リリースノートに security の記述: 1.147.1」 |
| A-wb | `--write-back fixtures/verdict-1.147.1-1.json --target core`、11-22T12:00Z | 本体のページに判定の要約を足し、状態を In progress | `ok: true`、同じページ。本文に「取り込みの判定: 1.147.1-1（…）」「判定: 条件付き　推奨: 条件を満たしてから」「適用後の検査: ok」「条件: …」「verdict.md: records/take-in/1.147.1-1/verdict.md」、状態 In progress |
| A4 | 本体のページを `notion.json` で Done に変えてから、f3、11-25 | 閉じたページは直さず、新しい本体の ToDo を作る。今の版 1.146.0 は 1.147.1 の修正を持たないので、セキュリティ修正あり（高・11-26）。1.147.2 の Update の文（"these issues"）は security と数えない | そのとおり。`created`、題名 `1.147.2（セキュリティ修正あり）`、「リリースノートに security の記述: 1.147.1」だけ |
| A5 | 空の state（`A\state-lost`）で f3、11-26 | state.json が無くなったときの検索で、開いている3件（本体 1.147.2・claude-code・rainbow-csv）を見つけて直す。作らない | そのとおり。3件とも `updated`、ページ数は4のまま（Done の1件を含む）。本体の期限は 11-26 のまま（早い方） |
| A6 | `notion.json` に `"fail": { "status": 401, "code": "unauthorized" }`、f3、11-27 | Notion を使えない → 書かない、終了コード 1、`lastSuccessAt` は進まない | ログ `ERROR Notion を使えない: … HTTP 401 unauthorized（retrieveDataSource）`、終了コード 1。`state.json` は `lastRunAt`・`lastFetchOkAt` が 11-27、`lastSuccessAt` は 11-25 のまま |

A5 で気づいた点: state が無いと、直したときの見出しが「1.147.0, 1.147.1, 1.147.2 も出た」になる（前回の通知の版を覚えていないため）。重複はしない。

### B. 取得が3日続けて失敗（state `B\state`、Notion `B\notion.json`、入力 f4）

| 回 | `--now` | 結果 |
|---|---|---|
| B1 | 11-20 | 終了コード 1、誤り4件（releases の接続の誤り、アドバイザリ HTTP 500、claude-code の時間切れ、pdf の応答なし）、`failingDays: 1`、ToDo なし |
| B2 | 11-21 | `failingDays: 2`、ToDo なし |
| B3 | 11-22 | `failingDays: 3`、「更新の検知が失敗しています」を作った（高・11-23。詳細に起点と直近の誤り） |
| B4 | 11-23 | `failingDays: 4`、同じページを直した（`updated`） |

B1・B2 は `--install-root` を付け忘れ、既定（`%LOCALAPPDATA%\Programs\Shuko`。秘密の場所ではない）の `current` を見に行った。無かったので upstream.json の版を使った。B3 から付けた。

### C. データソースの項目の違い（Notion `C\notion.json`）

| 回 | 操作 | 結果 |
|---|---|---|
| C1 | `--check`（差し替えの既定の項目） | `ok: true`、誤りなし |
| C2 | 状態の選択肢 Archived を Archive に、優先度の型を multi_select に変えて `--check` | `ok: false`、「項目「状態」に選択肢 Archived が無い」「項目「優先度」の型が multi_select（select であるはず）」 |
| C3 | 同じ状態で f1 を本番の形で | 候補2件を出したが書かない。`ERROR ToDo のデータソースの項目が設計と違うので書かない: …`、終了コード 1、ページは0件のまま |

### D. 本物の応答を流す（`--fixtures C:/b/p4-watch/trial/real/responses.json`、builderRepo `fixtures/repo-1.145.0`、Notion `D\notion.json`、`--now 2026-11-14T01:30:00Z`）

- 今の版 1.145.0 → 本体 1.146.0（セキュリティ修正あり。高・期限 11-15）。並べた版 1.145.1・1.145.2・1.145.3・1.146.0。アドバイザリ 16件（high 14、medium 2）。リリースノートのページは記録に無いので取得の失敗として扱い、(b) を飛ばした（WARN 2件。取得の失敗には数えない。終了コード 0）。
- claude-code 2.1.323（中・11-21）。ほかの7件は台帳と同じ版で、候補なし。
- 差し替えの Notion の検査（rich_text 2000 文字、children 100 個、選択肢）に引っかからずに書けた。

### E. 壊れた state.json（state `E\state`）

`{ "version": 1, "targets": { broken` を置いて f1 で走らせた → `state.json.broken-1794587573877` に寄せ、空から始めて2件を作った。終了コード 0。
同じ場所で `--write-back … --target ext:tomoki1207.pdf`（対応する ToDo なし）→ `{ ok: false, reason: "対応する ToDo が見つからない（state.json にも、データソースの検索にも無い）" }`、例外なし。

## 5. タスクスケジューラ（登録しない）

| コマンド | 結果 |
|---|---|
| `powershell … -File tools/watch/register-task.ps1 -ConfigPath C:/b/p4-watch/trial/local.json -DryRun` | `\Shuko\watch`、`C:\Program Files\nodejs\node.exe "E:\…\tools\watch\watch.mjs"`、作業場所 builderRepo、毎日 06:00（StartWhenAvailable、ログオン中だけ）。`(dry run) nothing registered.`。登録の部品（`New-ScheduledTaskAction`・`Trigger`・`SettingsSet`・`Principal`）は誤りなく作れた |
| 同 `-ConfigPath …/none.json`（builderRepo なし） | 「builderRepo is not set in local.json. Run scripts\configure.ps1 …」で止まる |
| 同 `-At 6:00` | 「-At must be HH:mm」で止まる |

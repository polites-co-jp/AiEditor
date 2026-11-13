# 更新の検知（tools/watch）と秘密の読み出しの設計

docs/06 の2節（検知）と4節の10（取り込みの書き戻し）、docs/02 の6.1（`local.json`）を実装した。この書き物は、引数・関数の入出力（テストの入口）・`state.json` の形・ToDo の中身の例をまとめる。

## 1. 置いたもの

| パス | 役目 |
|---|---|
| `scripts/lib/read-secret.ps1` | DPAPI で保護したファイルを `ConvertTo-SecureString` で戻し、値を標準出力に出す（改行なし）。docs/06 の2.4 |
| `scripts/lib/notion-client.mjs` | Notion の API の呼び出し（fetch だけ）と、`read-secret.ps1` を子のプロセスで呼んでトークンを受け取る部品。検知と取り込みが共有する |
| `scripts/lib/notion-todo.mjs` | ToDo の項目の照合、properties とブロックの組み立て、重複を避ける作成・更新（`upsertTodo`）、検知の状態の読み方、取り込みの書き戻し（`writeBackTakeIn`）。検知と取り込みが共有する |
| `tools/watch/watch.mjs` | 検知の本体（CLI）。タスクスケジューラが動かす |
| `tools/watch/lib/sources.mjs` | 取りに行く URL、取得の部品（本物と差し替え）、応答の読み方 |
| `tools/watch/lib/judge.mjs` | 前回との比べ、セキュリティ修正の判定、ToDo の中身（純粋な関数） |
| `tools/watch/lib/state.mjs` | `state.json` の正規化と保存、ログ |
| `tools/watch/lib/fake-notion.mjs` | 試し用の Notion の差し替え（JSON ファイル1つに中身を保つ） |
| `tools/watch/set-token.ps1` | トークンの保存（ユーザーが行う。隠れた入力欄で受け取る） |
| `tools/watch/check-dpapi.ps1` | 本物のトークンなしで、この PC・このユーザーで DPAPI の保存と読み出しが動くかを確かめる |
| `tools/watch/register-task.ps1` | タスクスケジューラへの登録（`-DryRun`・`-Unregister` あり） |

Notion への書き込みの部品を `scripts/lib/` に置いたのは、取り込み（`scripts/take-in.mjs`）が `./lib/notion-todo.mjs` から直接 import できるようにするため。検知だけが使う部品は `tools/watch/lib/` に置いた。

## 2. 引数

### 2.1 `node tools/watch/watch.mjs`

| 引数 | 意味 |
|---|---|
| （なし） | 本番。取得 → 判定 → Notion に書く → `state.json`・`watch.log` |
| `--dry-run` | 取得と判定まで。Notion に書かず、state も log も書かない。計画（作る ToDo の中身）を JSON で出す |
| `--check` | トークンを読み、ToDo のデータソースの項目を確かめるだけ（書かない） |
| `--check-token` | トークンを読めるかだけ。Notion に接続しない。長さと先頭の種類（`ntn_` / `secret_`）だけを出す |
| `--write-back <verdict.json> --target core\|ext:<ID>` | 取り込みの判定の要約を ToDo に書き戻す（取り込みの時に書けなかったときの手直し） |
| `--config <file>`、`--builder-repo <dir>`、`--install-root <dir>` | 場所の設定。優先は「オプション → local.json → 既定」（docs/02 の6.1） |
| `--state-dir <dir>` | `state.json`・`watch.log` の場所。既定 `%LOCALAPPDATA%\Shuko\watch`。試しでは必ず別の場所を渡す |
| `--token-file <file>` | 既定 `<state-dir>\notion-token.dpapi` |
| `--data-source <id>` | 既定 `7949c589-2ebd-4419-be83-30c123be7fec`（docs/06 の2.3） |
| `--fixtures <file>` | 取得の差し替え。`{ "<url>": { "status": 200, "json": … } \| { "status": 200, "text": "…" } \| { "status": 404 } \| { "error": "…" } }`。書いていない URL は取得の失敗 |
| `--record <file>` | 本物の取得の応答を `--fixtures` の形で書き出す |
| `--notion-fake <file>` | Notion を `fake-notion.mjs` に差し替える。中身をこのファイルに保つ |
| `--now <ISO>`、`--time-zone <IANA>` | 試しの日時と、期限の日付を数えるタイムゾーン（既定はこの PC） |
| `--quiet` | ログを標準エラーに出さない |

終了コード: 0 = 取得も Notion も成功、1 = どこかが失敗、2 = 設定などの誤りで動けない（`builderRepo` が未設定、台帳が読めない、など）。

### 2.2 PowerShell

| 台本 | 引数 |
|---|---|
| `scripts/lib/read-secret.ps1` | `-Path <file>`（必須）。終了コード 0 成功、2 ファイルが無い、3 空、4 復号できない（別のユーザー・別の PC・DPAPI の出力でない）、5 戻した値が空。誤りの文に値は入らない |
| `tools/watch/set-token.ps1` | `[-Path <file>] [-Force]`。既定 `%LOCALAPPDATA%\Shuko\watch\notion-token.dpapi`。隠れた入力欄（`Read-Host -AsSecureString`）で受け取り、`ConvertFrom-SecureString`（鍵なし＝DPAPI）で書く。保存の後に `read-secret.ps1` で読み戻し、長さだけを出す |
| `tools/watch/check-dpapi.ps1` | `-Dir <dir> [-Keep]`。でたらめな値で保存と読み出しを確かめ、OK / NG を出す。`-Keep` でファイルを残す（別のユーザーで復号できないことの確認、試しのトークンのファイル） |
| `tools/watch/register-task.ps1` | `[-ConfigPath] [-BuilderRepo] [-At HH:mm] [-TaskName watch] [-TaskPath \Shuko\] [-NodePath] [-DryRun] [-Unregister]` |

`register-task.ps1` が登録するもの: 動かすのは `<node.exe の絶対パス> "<builderRepo>\tools\watch\watch.mjs"`（作業場所は builderRepo）。`New-ScheduledTaskTrigger -Daily -At 06:00`、`New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit 30分`、`New-ScheduledTaskPrincipal -UserId <ドメイン\ユーザー> -LogonType Interactive -RunLevel Limited`（ログオンしているときだけ）、`Register-ScheduledTask -Force`。

## 3. 関数の入出力（テストの入口）

### 3.1 `scripts/lib/notion-client.mjs`

| 関数 | 入力 → 出力 |
|---|---|
| `createNotionClient({ token, fetchImpl, version, sleep, maxRetries })` | クライアント。メソッドは `retrieveDataSource(id)`、`queryDataSource(id, body)`、`retrievePage(id)`（404 は null）、`createPage(body)`、`updatePage(id, body)`、`appendBlockChildren(blockId, children)` |
| 　やり直しの規則 | 429・529 は `Retry-After`（秒。上限 120）だけ待って `maxRetries`（既定 3）回まで。503 は読み出し（GET と query）だけやり直す。書き込み（POST /pages・PATCH）は 503 でやり直さない |
| 　送る見出し | `Authorization: Bearer <token>`、`Notion-Version: 2025-09-03`、`Content-Type: application/json` |
| 　誤り | `NotionError`（`status`・`code`）。文は `HTTP <status> <code>（<method> <path>）: <message>`。トークンは入らない |
| `retryAfterMs(header, fallbackSeconds)` | ミリ秒 |
| `readNotionToken({ tokenFile, readSecretScript, powershellExe, spawnSyncImpl })` | `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File read-secret.ps1 -Path <tokenFile>` の標準出力（前後の空白を落とす）。終了コード ≠ 0・空は例外（文に標準エラーの先頭3行） |

### 3.2 `scripts/lib/notion-todo.mjs`

| 関数 | 入力 → 出力 |
|---|---|
| `checkTodoSchema(dataSource)` | 誤りの文字列の配列。名前・型に加え、使う選択肢（状態の4つ、種別の ToDo、優先度の高・中・低、期限の形式の終了日のみ）があるかを見る。`properties` のキーでなく値の `name` で探す |
| `titlePrefixFor(kind, extId)` | `"取り込みの検証: 本体 "`、`"取り込みの検証: 拡張 <ID> "`、`"更新の検知が失敗しています"` |
| `stateKeyFor(kind, extId)` | `"core"`、`"ext:<ID の小文字>"` |
| `localDate(now, timeZone)`・`addDays(ymd, n)` | `"YYYY-MM-DD"` |
| `dueDateFor({ security, now, timeZone })` | セキュリティ修正あり: 翌日、それ以外: 7日後（検知した日を timeZone で数える） |
| `higherPriority(a, b)`・`earlierDate(a, b)` | 高い方・早い方 |
| `buildTodoProperties({ title, priority, due, detail })` | 作成の properties（状態 Not started、種別 ToDo、期限の形式 終了日のみ、プロジェクト Shuko） |
| `text(content, url)`・`paragraph`・`heading3`・`bullet` | rich_text とブロック。`text.content` は 2000 文字（UTF-16 の単位）で切り、末尾に「…」 |
| `isOpenPage(page)` | ページがあり、`archived`・`in_trash` でなく、状態が Done・Archived でない |
| `findOpenTodo(notion, dsId, titlePrefix)` | プロジェクト＝Shuko、題名の前方一致、状態≠Done、状態≠Archived で query し、作成の新しい順の先頭 |
| `upsertTodo({ notion, dataSourceId, rememberedPageId, todo })` | `{ pageId, action: "created"\|"updated", priority, due }`。下の5節の規則 |
| `watchDir(env)`・`watchStatePath(env)`・`watchTokenPath(env)` | `%LOCALAPPDATA%\Shuko\watch\`、その下の `state.json`・`notion-token.dpapi` |
| `readWatchState(file)` | 無ければ null、読めなければ例外 |
| `watchFreshness(state, now)` | `{ lastSuccessAt, stale, message }`。`stale` は最後の成功から3日（72時間）を超えたか、成功の記録が無いとき真 |
| `summarizeVerdict(verdictJson)` | `{ label, verdict, recommendation, reasons, verdictPath }` |
| `buildTakeInBlocks({ label, verdict, reasons, verdictPath, recommendation, now })` | 見出し「取り込みの判定: <label>（日時）」、判定（合格・条件付き・不合格）と推奨、理由の箇条、`verdict.md` のパス |
| `appendTakeInResult({ notion, pageId, … })` | 本文に足し、状態を In progress にする |
| `writeBackTakeIn({ kind, extId, label, verdict, reasons, verdictPath, recommendation, stateFile, tokenFile, notion, readToken, dataSourceId, now, env })` | `{ ok, pageId, reason }`。例外を投げない。ページは `state.json` の `targets[<key>].openPageId`、無ければデータソースの検索で探す |

### 3.3 `tools/watch/lib/sources.mjs`

| 関数 | 入力 → 出力 |
|---|---|
| `GITHUB_RELEASES_URL` | `https://api.github.com/repos/microsoft/vscode/releases?per_page=10` |
| `GITHUB_ADVISORIES_URL` | `https://api.github.com/repos/microsoft/vscode/security-advisories?state=published&sort=published&direction=desc&per_page=50` |
| `releaseNotesUrl("1.147.1")` | `https://code.visualstudio.com/updates/v1_147` |
| `openVsxApiUrl(entry)` | `https://open-vsx.org/api/<ns>/<name>`。`targetPlatform` が universal 以外なら後ろに付ける |
| `openVsxPageUrl(ns, name, version)` | `https://open-vsx.org/extension/<ns>/<name>/<version>` |
| `createHttpFetcher({ record })`・`createFixtureFetcher(responses)` | `{ getJson(url), getText(url) }`。404 は null、ほかの失敗は例外 |
| `parseReleases(json)` | `[{ version, tag, publishedAt, url, body }]`。下書き・プレリリース・`x.y.z` でないタグを外し、版の昇順 |
| `parseAdvisories(json)` | `[{ id, cve, severity, summary, publishedAt, url, patched: ["1.145.3"], vulnerableRanges: ["< 1.145.3"] }]` |
| `inVersionRange(version, range)` | `"< 1.145.3"`、`">= 1.140.0, < 1.147.1"`、`"= 1.2.3"` を解く。読めない範囲は null |
| `releaseNotesSecurityLine(html, version)` | その版の「Update x.y.z: …」の文（次の Update か 300 文字まで）に security があればその文、無ければ null |
| `mentionsSecurity(text)` | `/security/i` |
| `parseOpenVsx(json)` | `{ version, timestamp, verified, preRelease, namespace, name, targetPlatform }` |

### 3.4 `tools/watch/lib/judge.mjs`

| 関数 | 入力 → 出力 |
|---|---|
| `labelToVersion("1.146.0-1")` | `"1.146.0"` |
| `relevantAdvisories(advisories, current, target)` | 修正版 P が `current < P <= target` にあり、影響の範囲が読めるときは current がどれかに入るもの |
| `planCore({ current, releases, advisories, target, seenAdvisories })` | null か候補 `{ kind, key, current, version, previousNotified, releases, newVersions, advisories, newAdvisories, advisoriesUnavailable, security }` |
| `finishCore(candidate, { notes })` | `notes` は `{ "<版>": "<security の文>" \| null }` か Map。`notesSecurity`・`bodySecurity` を足し、`security` を決め直す |
| `planExtension({ entry, meta, target })` | null か候補 `{ kind: "ext", key, id, current, version, publishedAt, installableAt, verified, preRelease, namespace, name, security: false, isClaudeCode }` |
| `priorityFor(candidate)` | 高（security）、中（本体・Claude Code 拡張）、低（ほかの拡張） |
| `buildCoreTodo(c, { now, timeZone })`・`buildExtTodo(c, …)`・`buildFailureTodo({ failingSince, errors, now, timeZone })` | `{ kind, key, titlePrefix, title, priority, due, detail, bodyBlocks, updateBlocks }` |
| `failingDays(failingSince, now, timeZone)` | 起点の日から今日まで（両端を含む）の日数 |

### 3.5 `tools/watch/lib/state.mjs` と `tools/watch/watch.mjs`

| 関数 | 入力 → 出力 |
|---|---|
| `normalizeState(obj)` | 下の4節の形（欠けた項目を埋める） |
| `saveState(file, state)` | `<file>.tmp` に書いて置き換える |
| `nextFailingSince(prev, fetchOk, now)` | 成功なら null、失敗なら前の起点か今 |
| `createLogger(file, { echo })` | 1行 `<ISO>\t<INFO\|WARN\|ERROR>\t<文>`。1MB を超えたら `watch.log.1` に回す。時刻は本物の時計（`--now` に従わない） |
| `parseArgs(argv)` | 2.1 の引数 |
| `currentCoreVersion(installRoot, upstreamTag, { realpath })` | `{ version, label, source: "current"\|"upstream.json" }`。`<installRoot>\current` の行き先のフォルダ名をラベルとして読む |
| `runWatch(opts, deps)` | deps `{ fetcher, notion, readToken, now, timeZone, env, echo, record, realpath }`。返り値 `{ exitCode, current, plan, results, errors, fetchOk, notionOk, failingDays, state, log }`（dry-run は `todos` を含み `results`・`state` を含まない） |
| `runCheck(opts, deps)`・`runCheckToken(opts, deps)`・`runWriteBack(opts, deps)` | 2.1 の `--check`・`--check-token`・`--write-back` |

## 4. `state.json` の形

`%LOCALAPPDATA%\Shuko\watch\state.json`（UTF-8、2字下げ）。

```json
{
  "version": 1,
  "lastRunAt": "2026-11-27T00:00:00.000Z",
  "lastFetchOkAt": "2026-11-27T00:00:00.000Z",
  "lastSuccessAt": "2026-11-25T00:00:00.000Z",
  "failingSince": null,
  "lastErrors": [],
  "failureTodo": null,
  "seenAdvisories": ["GHSA-f56j-7499-5hch", "GHSA-test-aaaa-0001"],
  "targets": {
    "core": {
      "kind": "core", "id": null,
      "lastNotifiedVersion": "1.147.2",
      "openPageId": "a5543cb6-42f6-4899-8a59-a6c32e3b2b21",
      "title": "取り込みの検証: 本体 1.147.2（セキュリティ修正あり）",
      "priority": "高", "due": "2026-11-26", "security": true,
      "advisories": ["GHSA-test-aaaa-0001", "GHSA-test-bbbb-0002"],
      "notifiedAt": "2026-11-25T00:00:00.000Z"
    },
    "ext:anthropic.claude-code": {
      "kind": "ext", "id": "anthropic.claude-code",
      "lastNotifiedVersion": "2.1.331",
      "openPageId": "db4854b3-72a0-498c-9f00-119e0b9972b2",
      "title": "取り込みの検証: 拡張 anthropic.claude-code 2.1.331",
      "priority": "中", "due": "2026-11-27", "security": false, "advisories": [],
      "notifiedAt": "2026-11-22T00:00:00.000Z"
    }
  }
}
```

| 項目 | 意味 |
|---|---|
| `lastRunAt` | 最後に動いた日時 |
| `lastFetchOkAt` | GitHub・Open VSX の取得がすべて成功した最後の日時 |
| `lastSuccessAt` | 取得も Notion もすべて成功した最後の日時。`take-in.mjs`・`switch.ps1` が「最後に検知が成功した日時」として表示し、3日より古ければ警告する（docs/06 の2.3。`watchFreshness`） |
| `failingSince` | 取得の失敗が続いている起点。取得がすべて成功したら null |
| `failureTodo` | 「更新の検知が失敗しています」の ToDo（`{ pageId, at }`） |
| `seenAdvisories` | これまでに見たアドバイザリの ID。まだ見ていないものがあると、新しい版が無くても本体の ToDo を出し直す |
| `targets[<key>]` | 対象ごとの「最後に通知した版」と「開いている ToDo のページ ID」（docs/06 の2.3 の「重複を避ける」の1） |

Notion に書けなかった対象は `targets` を直さない（次の回に通知し直す）。壊れた `state.json` は `state.json.broken-<時刻>` に寄せて空から始める（ToDo はデータソースの検索で見つける）。

## 5. 判定の規則

### 5.1 本体

- 今の版: `<installRoot>\current` の行き先のフォルダ名（ラベル `1.146.0-1`）から取る。`current` が無ければ `upstream.json` の `tag`。
- 基準: 前回の通知の版（`targets.core.lastNotifiedVersion`）が今の版より新しければそれ、ほかは今の版。
- 通知する条件: (1) 基準より新しい正式版が出た、または (2) 今の版から最新の版までの範囲に、まだ見ていない（`seenAdvisories` に無い）アドバイザリの修正が入った。
- 題名の版は最新の正式版。ToDo に並べる版は「今の版より新しい版」すべて（docs/06 の3節。1週に複数出たら最新のタグで1回取り込む）。
- 「セキュリティ修正あり」（docs/06 の2.2）:
  - (a) アドバイザリの修正版 P が `今の版 < P <= 最新の版` にある。影響の範囲（`vulnerable_version_range`）が読めて、今の版がどれにも入らないものは外す（古い版への修正の写しで、今の版がすでに直っているもの）。
  - (b) その版のリリースノートの「Update x.y.z: …」の文に security がある。または GitHub のリリースの本文に security がある（2026-11-14 の取得では本文はリリースノートの URL だけだったので、実際には (b) はリリースノートのページで決まる）。
  - リリースノートのページが取れなくても止めない（(b) を飛ばし、ログに残す）。取得の失敗にも数えない。
- アドバイザリが取れなかったときも本体の ToDo は出す。詳細・メモに「アドバイザリを取れなかった（要確認）」と書く。

### 5.2 拡張

- 台帳の版と、前回の通知の版の両方より新しい版が Open VSX に出ていれば通知する。
- Open VSX にはセキュリティ修正の印が無いので、拡張は常に「セキュリティ修正でない」として扱う（優先度は Claude Code 拡張が中、ほかが低。期限は7日後）。「入れてよい日時」は公開の72時間後。
- `verified` が false なら詳細・メモに「要確認」と書く。プレリリースなら書き添える。

### 5.3 重複を避ける（`upsertTodo`）

1. `targets[<key>].openPageId` のページを読み、開いていればそれを直す。
2. 無い・閉じている・消えているときは、データソースをプロジェクト＝Shuko・題名の前方一致・状態（Done・Archived 以外）で検索し、見つかればそれを直す。
3. 見つからなければ作る。
4. 直すとき: 題名と詳細・メモは新しいものにする。優先度は「今の値と新しい値の高い方」、期限は「早い方」にする（下げない・延ばさない）。本文の後ろに「更新（日時）: 1.147.1 も出た」と、加わった版・アドバイザリを足す。
   - docs/06 の2.3 は「最新の版に直し」「セキュリティ修正が加わったら上げる」と書く。新しい版のたびに期限が7日後へ延びるのを避けるため、下げない・延ばさない側にした（6節の判断を仰ぐ点）。

### 5.4 失敗

- GitHub（releases・アドバイザリ）と Open VSX の取得が1つでも失敗した回は「取得の失敗」。`failingSince` を起点に、その日を含めて3日目になったら「更新の検知が失敗しています」の ToDo を作る（開いていれば直す）。優先度と期限は表に無いので、高・翌日にした（6節の判断を仰ぐ点）。
- Notion に書けないとき（トークンの失効、項目の違い）はログに残し、終了コード 1。`lastSuccessAt` を進めない。
- データソースの項目が設計と違えば、書かずに止める（毎回、書く前に1回読む）。

## 6. ToDo の中身の例（試し A3 の出力）

本体（セキュリティ修正あり。前の ToDo を直した例）:

- タスク: `取り込みの検証: 本体 1.147.1（セキュリティ修正あり）`
- 状態 Not started（作ったとき）、種別 ToDo、優先度 高、期限 2026-11-23（検知 2026-11-22 の翌日。既にあった期限 11-27 より早いので直した）、期限の形式 終了日のみ、プロジェクト Shuko
- 詳細・メモ:

```
今の版: 1.146.0 → 新しい版: 1.147.1
今の版から後の版: 1.147.0, 1.147.1
セキュリティ修正（アドバイザリ）: 2件（high 1、medium 1）
リリースノートに security の記述: 1.147.1
起動するコマンド: node scripts/take-in.mjs core 1.147.1
```

- 本文（作ったとき）: 「更新の検知が <日時> に見つけた。今の版 1.146.0 → 1.147.0」、見出し「リリースノート」と版ごとの箇条（公開日時、リリースノートと GitHub のリリースのリンク、security の文）、見出し「セキュリティ修正（アドバイザリ）」と箇条（ID のリンク・重さ・要約・修正版・公開日時）、起動するコマンド。
- 本文（直したときに足すもの）: 見出し「更新（2026-11-22T00:00:00.000Z）: 1.147.1 も出た」、加わった版の箇条、「加わったセキュリティ修正:」とアドバイザリの箇条、起動するコマンド。

拡張:

- タスク: `取り込みの検証: 拡張 anthropic.claude-code 2.1.330`、優先度 中、期限 7日後
- 詳細・メモ:

```
今の版（台帳）: 2.1.322 → 新しい版: 2.1.330
公開: 2026-11-19T01:00:00.000000Z ／ 入れてよい日時: 2026-11-22T01:00:00.000Z（公開の72時間後）
Open VSX の verified: true
起動するコマンド: node scripts/take-in.mjs ext anthropic.claude-code 2.1.330
```

- 本文: 公開日時、入れてよい日時、Open VSX のページのリンク、verified、起動するコマンド。

取り込みの書き戻し（`--write-back`、試し A-wb）: 見出し「取り込みの判定: 1.147.1-1（日時）」、「判定: 条件付き　推奨: 条件を満たしてから」、箇条「適用後の検査: ok」「ビルド: ok」「スモーク（自動）: ok、手で確かめる項目 1件」「新しい接続先: なし」「アドバイザリ: 2件（この構成に関係するもの 1件）」「条件: …」、「verdict.md: records/take-in/1.147.1-1/verdict.md」。状態は In progress。

## 7. 取り込み（p3-take-in）からの使い方

```js
import { writeBackTakeIn, summarizeVerdict, watchFreshness, readWatchState, watchStatePath } from "./lib/notion-todo.mjs";

// 起動時の表示（docs/06 の2.3 の「失敗したとき」）
const fresh = watchFreshness(readWatchState(watchStatePath()));   // state.json が無ければ null を渡してよい
console.log(fresh.message);   // stale なら警告の文

// 手順 10（本体）・6節の4（拡張）
const r = await writeBackTakeIn({ kind: "core", ...summarizeVerdict(verdictJson) });
// 拡張: { kind: "ext", extId: "anthropic.claude-code", ...summarizeVerdict(verdictJson) }
if (!r.ok) { /* 判定に「ToDo に書けなかった: r.reason」を書く。取り込みは止めない */ }
```

- `writeBackTakeIn` は例外を投げない。トークンは検知と同じ（`%LOCALAPPDATA%\Shuko\watch\notion-token.dpapi`）を `read-secret.ps1` で読む。
- `switch.ps1`（PowerShell）は `state.json` の `lastSuccessAt` を直接読めばよい（72時間より古ければ警告）。

## 8. 秘密の扱い

- トークンは `read-secret.ps1` だけがファイルから読み、`watch.mjs` は子のプロセスの標準出力で受け取ってメモリにだけ持つ。ログ・誤りの文・`state.json`・標準出力に出さない（`--check-token` も長さと先頭の種類だけ）。
- `set-token.ps1` は値を引数で受け取らない（隠れた入力欄だけ）。
- 試しはすべて `C:\b\p4-watch\` の下で行い、`%LOCALAPPDATA%\Shuko\watch\` は開いていない。

## 9. テストが要る点（曹参へ）

- 判定: `planCore`（基準の取り方、`seenAdvisories` による出し直し、プレリリース・`vsda-v` の除外）、`relevantAdvisories`（範囲の内外、修正の写し）、`releaseNotesSecurityLine`（`1.145.3` と `1.145.30` の取り違えをしない、x.y.0 は null、本文の security に釣られない）、`finishCore`。
- ToDo: `priorityFor`・`dueDateFor`（timeZone の日付で翌日・7日後）、`buildCoreTodo`・`buildExtTodo` の題名・詳細、`text` の 2000 文字の切り方。
- 重複: `upsertTodo` の3つの道（覚えたページが開いている／閉じている→検索で見つかる／見つからない→作る）、直すときの「高い方・早い方」。`createFakeNotion` か自前の差し替えで。
- 失敗: `failingDays` と3日目の失敗の ToDo、Notion の 401 で `lastSuccessAt` が進まないこと、`createNotionClient` の 429・529・503 の扱い（`fetchImpl`・`sleep` を差し替える）。
- 秘密: `readNotionToken` の終了コード ≠ 0 と空の出力（`spawnSyncImpl` を差し替える）、`read-secret.ps1` の終了コード 2・3・4（`check-dpapi.ps1 -Keep` で作ったファイルと、壊したファイル）。

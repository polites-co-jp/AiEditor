# 引き継ぎ（p4-watch: 更新の検知 tools/watch と read-secret.ps1）

- 担当: 蒙恬
- 日付: 2026-11-14

## 結果

完了。依頼書の1〜3を作った。`node --check` と PowerShell の構文の検査が通った。4の試し（差し替えた入力で、ToDo の中身・重複の防止・セキュリティ修正の判定・書き戻し・失敗の扱い。本物の GitHub と Open VSX の取得を読むだけで1回）の記録は `trial-log.md` にある。

## 成果物

作ったもの（すべて新規）:

- `scripts/lib/read-secret.ps1`: DPAPI のファイルを戻して標準出力に出す。終了コード 0・2・3・4・5
- `scripts/lib/notion-client.mjs`: Notion の API（429・529 は Retry-After、503 は読み出しだけやり直す）と、トークンの読み出し（`readNotionToken`）
- `scripts/lib/notion-todo.mjs`: ToDo の項目の照合、中身の組み立て、重複を避ける作成・更新（`upsertTodo`）、`state.json` の読み方、取り込みの書き戻し（`writeBackTakeIn`・`summarizeVerdict`）、`watchFreshness`
- `tools/watch/watch.mjs`: 検知の本体。`--dry-run`・`--check`・`--check-token`・`--write-back`・差し替え（`--fixtures`・`--notion-fake`）
- `tools/watch/lib/sources.mjs`、`lib/judge.mjs`、`lib/state.mjs`、`lib/fake-notion.mjs`
- `tools/watch/set-token.ps1`: トークンの保存（隠れた入力欄。引数で受け取らない）
- `tools/watch/check-dpapi.ps1`: 本物のトークンなしで DPAPI の保存と読み出しを確かめる
- `tools/watch/register-task.ps1`: タスクスケジューラへの登録（`-DryRun`・`-Unregister`）

このディレクトリの書き物: `watch-design.md`（引数、関数の入出力、`state.json` の形、判定の規則、ToDo の中身の例、取り込みからの使い方）、`trial-log.md`、`doc-corrections.md`、`install-watch-draft.md`（docs/install.md に入れる分の下書き）、`fixtures/`（試しの入力。曹参もそのまま使える）。

## 要点

1. Notion への書き込みの部品は `scripts/lib/notion-client.mjs`・`scripts/lib/notion-todo.mjs` に置いた。取り込みは `writeBackTakeIn({ kind, extId, ...summarizeVerdict(verdict) })` を呼ぶだけで、ToDo を探して本文に要約を足し、状態を In progress にする（例外を投げない）。`watch-design.md` の7節に書いた。
2. 重複の防止は、`state.json` の開いている ToDo、無ければデータソースの検索（プロジェクト・題名の前方一致・状態）で行う。差し替えた Notion で、同じ入力の2回目は書かない、開いていれば直す、Done なら作り直す、state を失っても作らない、を確かめた。
3. 「セキュリティ修正あり」は、(a) 修正版が「今の版 < P ≤ 最新」にあり今の版が影響の範囲に入るアドバイザリ、(b) リリースノートのその版の「Update x.y.z: …」の文の security、で決める。本物の応答で、本家のリリースの本文はリリースノートの URL だけと分かった。
4. 秘密は `read-secret.ps1` だけがファイルから読む。`watch.mjs` は値をメモリにだけ持ち、どこにも出さない。試しは `C:\b\p4-watch\` の下だけで行い、秘密の場所は開いていない。
5. 本物の取得（2026-11-14）では、本体は 1.146.0 が最新で候補なし、Claude Code 拡張 2.1.323（2026-11-12 公開）が候補になった（ToDo は書いていない）。

## 確かめたこと

- 構文: `node --check` 7ファイル、`scripts/p0-check-ps.ps1` で PowerShell 4ファイル（ASCII だけ）。
- DPAPI: `check-dpapi.ps1` で保存と読み出しが一致し、ファイルに平文が無い。Node → powershell.exe → `read-secret.ps1` の経路で読めた（`--check-token`）。無い・空・復号できないファイルで終了コード 2・3・4。
- 検知: 差し替えの入力で A1〜A6・B1〜B4・C1〜C3・D・E（`trial-log.md` の4節）。期待どおり。
- 登録: `register-task.ps1 -DryRun` で登録の部品が作れること、builderRepo が無い・`-At` の形の誤りで止まること。登録はしていない。
- 外部の事実の出典:
  - GitHub のリポジトリのアドバイザリの一覧の API（引数 `state`・`sort`・`direction`・`per_page`、項目 `ghsa_id`・`severity`・`summary`・`published_at`・`vulnerabilities[].vulnerable_version_range`・`patched_versions`）: https://docs.github.com/en/rest/security-advisories/repository-advisories 。未認証で取れることは本物の取得で確かめた。
  - リリースノートの書き方（`**Update 1.145.3**: The update addresses these [security issues](…)`）: https://code.visualstudio.com/updates/v1_145 と https://github.com/microsoft/vscode-docs の `release-notes/v1_145.md`。
  - Notion: 429・529・Retry-After・503 の注意・2000 文字・100 個（https://developers.notion.com/reference/request-limits ）、データソースの読み出しの応答の形（https://developers.notion.com/reference/retrieve-a-data-source ）、query の filter（https://developers.notion.com/reference/query-a-data-source ）、作成の parent と properties（https://developers.notion.com/reference/post-page ）。
  - タスクスケジューラの `-LogonType` の値: https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal

## テストの入口（曹参へ）

`watch-design.md` の3節に関数の一覧、9節にテストが要る点を書いた。主なもの:

- 純粋な関数: `tools/watch/lib/judge.mjs` の `planCore`・`finishCore`・`relevantAdvisories`・`planExtension`・`priorityFor`・`buildCoreTodo`・`buildExtTodo`・`buildFailureTodo`・`failingDays`、`tools/watch/lib/sources.mjs` の `parseReleases`・`parseAdvisories`・`inVersionRange`・`releaseNotesSecurityLine`、`scripts/lib/notion-todo.mjs` の `checkTodoSchema`・`dueDateFor`・`higherPriority`・`earlierDate`・`text`・`isOpenPage`・`summarizeVerdict`・`watchFreshness`。
- 差し替えて動かすもの: `runWatch(opts, { fetcher, notion, now, timeZone, env, echo: false })`（`fetcher` は `createFixtureFetcher(responses)`、`notion` は `createFakeNotion({ file })` か自前）、`upsertTodo`、`writeBackTakeIn({ notion, stateFile, … })`、`createNotionClient({ token, fetchImpl, sleep })`、`readNotionToken({ spawnSyncImpl })`。
- コマンドで試す例（期待する出力は `trial-log.md`）:
  - `node tools/watch/watch.mjs --quiet --config C:/b/<試し>/none.json --builder-repo <リポジトリ>/tasks/2026-11-14-p4-watch/fixtures/repo --install-root C:/b/<試し>/install --state-dir C:/b/<試し>/state --notion-fake C:/b/<試し>/notion.json --fixtures tasks/2026-11-14-p4-watch/fixtures/f1-new-core-and-ext.json --time-zone Asia/Tokyo --now 2026-11-20T00:00:00Z` → `results` に `created` 2件（本体 1.147.0 中 11-27、claude-code 2.1.330 中 11-27）。同じものをもう一度 → `results: []`。
  - `--fixtures …/f2-security-update.json --now 2026-11-22T00:00:00Z` → 本体は `updated`、題名 `取り込みの検証: 本体 1.147.1（セキュリティ修正あり）`、優先度 高、期限 2026-11-23。
  - `powershell -NoProfile -ExecutionPolicy Bypass -File tools/watch/check-dpapi.ps1 -Dir C:/b/<試し>` → `check-dpapi: OK`、終了コード 0。

## docs/ との食い違い

`doc-corrections.md` に19件。主なもの:

- 06 の2.2: 一覧の API と アドバイザリの API は未認証で取れた（「未確認」を外せる）。リリースの `body` は URL だけで、(b) はリリースノートのページの「Update x.y.z」の文で決まる。アドバイザリはパッケージの名前で絞れない。
- 06 の2.4: `read-secret.ps1` の呼び出しに `-ExecutionPolicy Bypass` が要る（既定の実行ポリシーで `-File` が止まるため）。
- 02 の2節: フォルダの図に `tools/watch/` の中身と `scripts/lib/notion-*.mjs` を足す。

## 未解決の点（リーダーの判断を仰ぐ）

1. 開いている ToDo を直すときの期限（`doc-corrections.md` の16）: 「早い方」にした（新しい版のたびに延ばさない）。資料の「最新の版に直し」を「毎回7日後に直す」と読むなら変える。
2. 「更新の検知が失敗しています」の優先度と期限（同17）: 高・翌日にした。資料に無い。
3. 拡張のセキュリティ修正（同18）: Open VSX に印が無いので、拡張は常に「セキュリティ修正なし」。
4. 拡張の取り込みの引数（同19）: ToDo の「起動するコマンド」は docs/06 の `take-in.mjs ext <id> <version>`。p3-take-in の依頼書は `ext <id>`（版なし）。どちらかに揃える。
5. `switch.ps1` の「最後に検知が成功した日時」の表示（docs/06 の2.3）は、この依頼の範囲外なので作っていない。`state.json` の `lastSuccessAt` を読めばよい（`watch-design.md` の4節）。
6. タスクスケジューラから node.exe を直接動かすので、6:00 にコンソールの窓が一瞬出る見込み（未確認）。気になるなら、隠して動かす包み（例 `conhost.exe --headless`。未確認）を Phase 4 で試す。
7. `install-watch-draft.md` のインテグレーションの作成の画面の URL（https://www.notion.so/profile/integrations ）と、Open VSX のページの URL の形（`/extension/<ns>/<name>/<version>`）は開いて確かめていない（推定）。
8. 試しの後始末: `C:\b\p4-watch\trial\` に試しの state・差し替えの Notion・記録した本物の応答・`selfcheck.dpapi`（でたらめな値）が残っている。消してよい。

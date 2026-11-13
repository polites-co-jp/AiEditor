# 06 更新の検知と取り込み

## 1. 裁定と全体の流れ

- 本家には自動で追従しない。新版（特にセキュリティ修正）が出たら、Notion の ToDo に「取り込みの検証」を足す。本体に加え、同梱する拡張（特に Claude Code 拡張）の新版も対象。
- 通知だけにする。通知に修正差分を試しに当て直した結果は添えない。
- 取り込みの検証は本家の新版ごとに毎週すべて行う（1週に複数の版が出たときの扱いは3節）。検証は Claude（`claude -p`。API キーは使わない）が行う。
- 新しい版への入れ替えは、Claude の判定を見て、ユーザーが自分で行う。
- ToDo は、更新の検知のプログラムが自分で Notion にアクセスして書く。

```
[毎日] 検知のプログラム（タスクスケジューラ）
   │ 新版あり
   ▼
Notion の ToDo「取り込みの検証: 本体 1.147.0（セキュリティ修正あり）」
   │ ユーザーが見る（毎週）
   ▼
[ユーザーが起動] take-in.mjs core 1.147.0
   │ 当て直し → 検査 → ビルド → スモーク → claude -p の判定
   ▼
records/take-in/1.147.0-1/verdict.md（合格・条件付き・不合格）
   │ ユーザーが読む
   ▼
[ユーザーが実行] switch.ps1 1.147.0-1   （戻すときは switch.ps1 -Previous）
```

## 2. 検知のプログラム

### 2.1 置き場所と動かし方

- `tools/watch/watch.mjs`（Node.js。ビルドに Node が要るので前提が増えない）。LLM は使わない。決まった処理だけで判断する。
- Windows のタスクスケジューラで毎日1回動かす（例 6:00）。予定の時刻に PC が止まっていたときに備え、`-StartWhenAvailable`（"Task Scheduler can start the task at any time after its scheduled time has passed."）を付ける [一次・要照合] https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset 。
- 登録は `tools/watch/register-task.ps1` が行う（`New-ScheduledTaskTrigger -Daily`、`New-ScheduledTaskSettingsSet -StartWhenAvailable`、`Register-ScheduledTask`）。「ユーザーがログオンしているときだけ実行」にする。トークンの復号（2.4）がそのユーザーの権限で要るため。
- 状態とログ: `%LOCALAPPDATA%\Shuko\watch\state.json`、`watch.log`（固定の場所）。
- ビルドリポジトリの場所（台帳を読むため）と版のフォルダの場所（今の版を知るため）は、PC ごとの設定ファイル `%LOCALAPPDATA%\Shuko\local.json` の `builderRepo`・`installRoot` から読む（道具ごとに使うキーは [02](02-repository-and-build.md) の6.1 の表のとおり。検知のプログラムはタスクスケジューラから動くので、ビルドリポジトリの場所を `builderRepo` で知る）。

### 2.2 取得するもの

| 対象 | 取得先 | 見る項目 |
|---|---|---|
| 本体の新版 | `https://api.github.com/repos/microsoft/vscode/releases?per_page=10` | `tag_name`、`published_at`、`html_url`、`body`。前回の通知以降のものをすべて拾う（週次で出るので、1週に複数出ることがある）。`releases/latest` と `releases.atom` は未認証で取れることを確かめた（2026-11-12）。一覧の API（`releases?per_page=`）での取得は未確認。タグの一覧（`/tags`）は本体以外のタグ（`vsda-v...` など）が混ざるので使わない |
| セキュリティ修正 | `https://api.github.com/repos/microsoft/vscode/security-advisories` | 前回以降に公開されたもの。`ghsa_id`、`severity`、`summary`、影響を受ける版と修正版 |
| リリースノート | `https://code.visualstudio.com/updates/v1_<minor>` | 本文に security の記述（例: 1.145.3 の "The update addresses these security issues."）があるか [一次] https://code.visualstudio.com/updates/v1_145 |
| 同梱拡張の新版 | `https://open-vsx.org/api/<namespace>/<name>`（プラットフォーム別の拡張は `/<namespace>/<name>/win32-x64`） | `version`、`timestamp`、`verified`。台帳の版と比べる |

- 本家の新版は 2026-03 から週次（[二次] https://www.devclass.com/development/2026/03/12/microsoft-ships-vs-code-weekly-adds-autopilot-mode-so-ai-can-wreak-havoc-without-bothering-you/5208978）。
- GitHub の未認証の API の上限は 60 回/時。1日1回の数リクエストで収まる。
- Electron は別に追わない。本家のタグに付いてくる（ルートの package.json の `nativeBuild.target`）ので、取り込みの検査で版の変化を見る。
- 「セキュリティ修正あり」は、(a) 前回以降に公開されたアドバイザリの修正版がその版以下、または (b) リリースノートに security の記述がある、のどちらかで決める。

### 2.3 Notion の ToDo への書き込み

**書き込む先**: ユーザーの今の ToDo データベース。2026-11-12 時点の項目は次のとおり（ユーザーの既存の ToDo の道具の定義から写した。Notion API の版は `2025-09-03`、データソース ID `7949c589-2ebd-4419-be83-30c123be7fec`）。プログラムは起動時にデータソースの項目を読み、名前と型が下の表と違えば書かずに止め、ログに残す（項目を勝手に作らない）。

| 項目 | 型 | 書く値 |
|---|---|---|
| タスク | title | 本体: `取り込みの検証: 本体 1.147.0（セキュリティ修正あり）`。拡張: `取り込みの検証: 拡張 anthropic.claude-code 2.1.330` |
| 状態 | status（Not started / In progress / Done / Archived） | `Not started` |
| 種別 | select（ToDo / 予定 / 期間タスク） | `ToDo` |
| 優先度 | select（高 / 中 / 低） | セキュリティ修正あり: `高`。本体のその他と Claude Code 拡張: `中`。ほかの拡張: `低`（裁定） |
| 期限 | date | セキュリティ修正あり: 検知の翌日。それ以外: 検知の7日後（裁定） |
| 期限の形式 | select（From-To / 終了日のみ） | `終了日のみ` |
| プロジェクト | rich_text | `Shuko`（仮の名前。名前が決まったら直す） |
| 詳細・メモ | rich_text（2000 文字まで） | 今の版 → 新しい版、セキュリティ修正の件数と重さ、起動するコマンド（例 `node scripts/take-in.mjs core 1.147.0`） |
| 開始日時・終了日時 | date | 書かない |

**本文**（ページの子ブロック）: リリースノートのリンク、アドバイザリの一覧（ID・重さ・要約・修正版）、拡張なら公開日時と「入れてよい日時」（公開の72時間後。セキュリティ修正なら公開の時点。裁定。[04](04-bundled-extensions.md) の4節の4）、Open VSX のページのリンク。

**API**:
- 作成: `POST /v1/pages`、`"parent": {"type": "data_source_id", "data_source_id": "<ID>"}` [一次] https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03 。
- 検索: `POST /v1/data_sources/{data_source_id}/query` [一次] https://developers.notion.com/reference/query-a-data-source 。
- 429・529 は `Retry-After` に従う [一次] https://developers.notion.com/reference/request-limits 。

**重複を避ける**:
1. `state.json` に、対象（本体、拡張ごと）の「最後に通知した版」と「開いている ToDo のページ ID」を持つ。
2. 同じ対象の ToDo がまだ開いていれば（ページを読み、状態が Done・Archived でなければ）、新しく足さず、タスク・詳細・メモ・優先度・期限を最新の版に直し、本文に「更新: 1.147.1 も出た」を足す。セキュリティ修正が加わったら、優先度と期限を上げる。
3. `state.json` が無くなったときは、データソースをプロジェクトと題名の前方一致（`取り込みの検証: 本体`）と状態で検索して見つける。

**失敗したとき**: ログに残す。GitHub・Open VSX の取得が3日続けて失敗したら、ToDo「更新の検知が失敗しています」を足す。Notion に書けないとき（トークンの失効など）は ToDo にも出せないので、`take-in.mjs` と `switch.ps1` が起動時に「最後に検知が成功した日時」を表示し、3日より古ければ警告する。

### 2.4 トークンの置き場所

- 裁定: 専用の Notion の内部インテグレーションを作り、**ToDo データベースだけ**に接続する。設定の同期（[05](05-settings-sync.md)）のインテグレーションとは分ける。作るにはワークスペースのオーナーの権限が要る [一次] https://developers.notion.com/docs/authorization 。
- 保管（裁定）: DPAPI で暗号化したファイル `%LOCALAPPDATA%\Shuko\watch\notion-token.dpapi`。
  - 入れる: `tools/watch/set-token.ps1` が `Read-Host -AsSecureString | ConvertFrom-SecureString | Set-Content <path>` を行う。鍵を指定しない `ConvertFrom-SecureString` は DPAPI を使う（"If no key is specified, the Windows Data Protection API (DPAPI) is used"。Windows PowerShell 5.1 と PowerShell 7 で同じ文）[一次・要照合] https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring 。
  - 読む: `scripts/lib/read-secret.ps1` が `ConvertTo-SecureString` で戻し、標準出力に出す。`watch.mjs` は `powershell.exe -NoProfile -NonInteractive -File` で呼び、値をメモリにだけ持つ。ログに出さない。
  - DPAPI の保護が「今のユーザーに結びつく」ことは公式ページに明記が無い（未確認）。Phase 4 で、別のユーザーで復号できないことを確かめる。
- 採らない案: リポジトリや設定ファイルに平文で置く（公式も「ソースやバージョン管理に入れない」と書く）。資格情報マネージャー（標準の機能だけで読む公式の手順が見当たらない）、ユーザーの環境変数（平文）。

## 3. 取り込みの起動

- ToDo を見たユーザーが、ビルドリポジトリで `node scripts/take-in.mjs core <tag>` または `node scripts/take-in.mjs ext <id> <version>` を実行する。
- 本体は、新版が出た週ごとに1回行う（裁定の「毎週すべて検証」）。その週に新版が複数出たときは、最新のタグで1回ビルドして検証し、前回の取り込みから後のすべての版のリリースノートとアドバイザリを判定の対象に含める。最新のタグはそれまでの版の修正を含むので、途中の版の中身も漏れなく確かめられる。当て直しとビルドは1回で済む。セキュリティ修正を含む版が出たら、その週のうちに行う。
- 取り込みは今使っている版に触らない。新しい版はブランチ `take-in/<label>` と版のフォルダ `<installRoot>\versions\<label>` に作る（`installRoot` は `local.json` から読む。[02](02-repository-and-build.md) の6.1）。

## 4. 本体の取り込みの手順（`take-in.mjs core`）

| 手順 | 中身 | 止める条件 |
|---|---|---|
| 1. 用意 | 新しいタグを fetch し、作業ツリーを作る。`upstream.json` の新しい値をブランチに書く | タグが無い |
| 2. 当て直し | [03](03-removal-design.md) の5節 | 当たらない → 手順 3 |
| 3. 修理（必要なとき） | `claude -p` に、当たらなかった単位・パッチと衝突を渡し、`edits.patch` と `removeLines` を直させる（7節）。直したら手順 2 からやり直す。3回まで | 3回で直らない |
| 4. 適用後の検査 | [03](03-removal-design.md) の6節。加えて、overlay のキーと mydist の既定の設定のキーが新しい版でも登録されているか（本家の改名の検出）、`.nvmrc` と Electron の版の変化 | 検査を満たさない（未分類の組み込み拡張は止めずに「保留」として残し、判定で扱う） |
| 5. ビルド | [02](02-repository-and-build.md) の4節。型検査の誤りは手順 3 と同じく `claude -p` に直させる（3回まで） | ビルドが通らない |
| 6. スモーク | 5節。一時的なデータの置き場所と、台帳の拡張を入れた一時的な拡張の置き場所で行う | — （結果を判定に渡す） |
| 7. 通信の監査 | やめた（裁定 2026-11-13）。番号は詰めずに残す | — |
| 8. 計測 | やめた（裁定 2026-11-13）。番号は詰めずに残す | — |
| 9. 判定 | `claude -p` が判定を書く（7節） | — |
| 10. 記録と書き戻し | `records/take-in/<label>/` に全部を残す。対応する ToDo の本文に判定の要約（判定、理由の要点、`verdict.md` のパス）を足し、状態を `In progress` にする（裁定）。ToDo は `state.json` の開いている ToDo のページ ID で見つけ、トークンは更新の検知と同じもの（2.4）を使う | ToDo に書けなくても取り込みは止めず、書けなかったことを判定に書く |

公式の zip の取得先は `https://update.code.visualstudio.com/<版>/win32-x64-archive/stable`（Phase 0 で取得に使った）。計測をやめたので、取り込みでは使わない（裁定 2026-11-13）。

## 5. スモークの組

「自」は自動で確かめるもの、「手」はユーザーが入れ替えの前後に手で確かめるもの。自動の部分は、本家の `test/smoke` を自作のビルドに向けて使えるかを Phase 1 で確かめる（`pnpm run smoketest --build <path>`。Windows の例は README に無い）[一次] https://raw.githubusercontent.com/microsoft/vscode/main/test/smoke/README.md 。使えなければ、起動・ログの検査だけを自動にし、残りは手で行う。

| 組 | 項目 | 自/手 |
|---|---|---|
| base | 起動する。開発者ツールのコンソールと拡張ホストのログに、前の版に無かったエラーが無い | 自 |
| base | フォルダを開く（制限モード → 信頼する）、ファイルを編集して保存、コマンドパレット、エディタの分割、2つめのウィンドウ、ミニマップ | 自 |
| base | ターミナル（PowerShell）を開いてコマンドを実行 | 自 |
| base | 全文検索と置換、差分ビュー、git の変更の表示・ステージ・コミット、問題パネル、タスクの実行 | 自 |
| base | Markdown・画像・PDF のプレビュー、タイムライン・ローカル履歴、スニペット、整形 | 自 |
| base | 日本語で表示される、テーマが Light Modern、Sublime のキー（例: 複数カーソルの追加）が効く | 手 |
| claude-code | 拡張が動作中の拡張の一覧に出る。`~/.claude/ide/<port>.lock` ができる | 自 |
| claude-code | パネル（サイドバーとセカンダリサイドバー）が開き、送信して応答が返る | 手 |
| claude-code | 統合ターミナルの `claude` が IDE に接続する。選択範囲が共有される。差分が差分ビューで開き、採否できる。診断（`mcp__ide__getDiagnostics`）が問題パネルの内容を返す | 手 |
| languages | TS の補完とエラー、Python（basedpyright）の診断、HTML/CSS/JSON の補完、CSV の検査、.env の補完、sh の ShellCheck の警告、PowerShell 7 のセッション | 自（診断が問題パネルに出ることで見る） |
| absence | 有効な削除の単位の `checks`（[03](03-removal-design.md) の7節の3） | 自 |

Claude Code の項目は、裁定の「実機の動作で判断する」に当たる。Claude Code の公式文書が挙げる機能（パネル、差分、選択範囲、診断、`.lock` による CLI の接続）[一次] https://code.claude.com/docs/en/vs-code に沿う。

## 6. 拡張の取り込みの手順（`take-in.mjs ext`）

1. 新しい版の VSIX・`.sha256`・`.sigzip`・manifest を取る。
2. [04](04-bundled-extensions.md) の4節の検証の項目 1〜10 を行う。
3. 台帳の新しい1件をブランチ `take-in/ext-<id>-<版>` に書く。
4. `claude -p` が判定を書く（7節）。本体と同じく、ToDo の本文に判定の要約を足し、状態を `In progress` にする（裁定）。
5. ユーザーが判定を読み、採るなら台帳のブランチを取り込み、`node scripts/install-extensions.mjs` を実行してエディタを再起動する。戻すときは `install-extensions.mjs --rev <前のコミット>`。

## 7. Claude による修理と判定

### 7.1 起動のしかた

- `take-in.mjs` が `claude -p` を子プロセスとして起動する。ユーザーがログインした Claude Code の CLI を使い、API キーは使わない。子プロセスの環境変数から `ANTHROPIC_API_KEY` を外す。
- 作業の場所は作業ツリー。ビルドリポジトリを追加の作業場所として渡す。使ってよい道具は、読む・探す・`removals/` と `patches/` と作業ツリーの中の編集・`git diff` と `git status` だけにする。オプションの書き方（`--output-format json`、`--allowedTools`、`--add-dir` など）は、実装のときに `claude --help` で確かめる。
- 渡すもの: `TAKE-IN.md`（規約）、`checks.json`、ビルドと型検査のログの末尾、スモークの結果、前回の取り込みから後のすべての版のリリースノートとアドバイザリ、ロックファイルの差分、本家が足した部品の一覧、変わったパッチ。

### 7.2 `TAKE-IN.md` に書く規約

- 単位の意図（`unit.json` の `intent`）を変えない。消す範囲を広げたり狭めたりしない。それが要るときは判定に「要判断」と書いて止める。
- 衝突は本家側の変更を採り、そのうえで単位の意図どおりに参照を消す。
- パッチは最小にする。整形・改名・ついでの修正を入れない。
- 作業ツリーと `removals/`・`patches/` の外を書き換えない。`switch.ps1` や `install-extensions.mjs` を実行しない。
- 拡張の圧縮された JS を読まない。拡張の判断は manifest・ファイル一覧・ハッシュ・署名・実機の結果だけで行う。
- 本家が足した部品（未分類の組み込み拡張、新しい contrib など）は、残すか、どの単位で消すかを提案するだけにし、自分で単位に入れない。

### 7.3 判定の形

`verdict.json`（機械が読む）と `verdict.md`（ユーザーが読む。日本語）を書く。

```json
{
  "label": "1.147.0-1",
  "verdict": "pass | conditional | fail",
  "security": { "advisories": ["GHSA-..."], "relevantToThisBuild": [{ "id": "GHSA-...", "relevant": false, "why": "消したリモートの機能の修正" }] },
  "patches": { "changed": ["removals/C-1-ai/edits.patch"], "why": "..." },
  "checks": "ok",
  "build": "ok",
  "smoke": { "auto": "ok", "manualToDo": ["claude-code のパネルで送信"] },
  "newUpstreamParts": [{ "path": "extensions/foo", "proposal": "keep | removal-unit:A-7", "why": "..." }],
  "conditions": [],
  "recommendation": "入れ替えてよい / 条件を満たしてから / 見送る"
}
```

- **合格**: すべての検査・ビルド・自動のスモークが通る（通信の監査と計測は裁定 2026-11-13 でやめた）。
- **条件付き**: 合格だが、未分類の部品など、ユーザーが決めることがある。
- **不合格**: どれかが通らない。セキュリティ修正を含むときは、修正の重さと、自分の構成に関係するか（例: 消したリモートの機能の修正は関係が薄い）を書き、見送ってよいかの見立てを添える。

## 8. ユーザーが入れ替える手順と戻す手順

入れ替える:
1. `records/take-in/<label>/verdict.md` を読む。
2. 採るなら `node scripts/adopt.mjs <label>` を実行する（ブランチ `take-in/<label>` を main に取り込み、`upstream.json` を確定し、タグを打つ）。
3. エディタを閉じ、`switch.ps1 <label>` を実行する（[02](02-repository-and-build.md) の6節。ユーザーのデータの写しを取ってから切り替える）。
4. エディタを開き、5節の「手」の項目を確かめる。
5. ToDo を `Done` にする。

戻す:
- エディタを閉じ、`switch.ps1 -Previous` を実行する。設定がおかしければ `backups\<日時>\` から戻す。
- 原因を `records/take-in/<label>/issues.md` に書く。次の取り込みのとき Claude が読む。

# AiEditor

Claude Code でのコーディングに特化した、省メモリの VS Code 派生エディタ（Windows 専用、利用者は1人）のビルドリポジトリ。仮の名前は「Shuko」（正式な名前は後で決める）。

## 設計資料

- 設計資料の正本は `docs/`。読む順は [docs/README.md](docs/README.md)。
- ユーザーの裁定は [docs/user-decisions.md](docs/user-decisions.md) が原本。裁定が最優先で、裁定と違う案は別案として分け、ユーザーに諮る。勝手に採らない。
- 実装中に分かった事実で資料と食い違うものは、資料を直してから先へ進む。

## チーム

このリポジトリで `claude` を起動すると、メインセッションはリーダーのヴラド・ツェペシュ（`.claude/agents/vlad-tepes.md`）になる（`.claude/settings.json` の `"agent"`）。

- 全員が開発部の AiEditor 課に属する。名簿は `team/roster.md`、課の説明は `team/departments/development/README.md`。
- メンバー定義の正本は `.claude/agents/<id>.md`（フラットに置く）。
- 権限はホワイトリスト方式。ツール（Web の利用を含む）は定義の `tools`、Bash コマンド・書き込み先・読める場所・秘密の場所は `team/departments/development/<id>/permissions.json` に書く。`.claude/settings.json` のフック（`team/hooks/`）が、呼び出し元（フック入力の `agent_type`）ごとに強制する。リーダーは対象外。
- フック（`team/hooks/`）と `.claude/settings.json` は、設計を行ったエージェントチーム（`E:\develop\self\Team`）の開発部が作り、保守する。このリポジトリのメンバーは書き換えない。
- 権限の追加・変更は、書き方の修正だけであってもユーザーの承認を取ってから行う。
- メンバー定義の frontmatter には hooks を書かない（定義のフックは登録されないことがある。守りは settings.json に置く）。

## 仕事の流れ

- 仕事は `tasks/<YYYY-MM-DD>-<slug>/` に、依頼書 `brief.md`（ひな形 `team/templates/brief.md`）と成果物を置く。
- 作るのは蒙恬（本体のスクリプト・削除の単位・拡張・検知）、テストを書くのは曹参。2人は同じ仕様（docs/）から並行して作る。
- 大岡越前守が両方の成果を確かめ、関門の合否を出す。作った人が自分で合格を出さない。
- 毎週の取り込みの採否は、スクリプトが `claude -p --agent di-renjie` で狄仁傑を起動して判定させる。入れ替えはユーザーが行う。
  - 起動するときは `--agent di-renjie` を必ず付ける（付け忘れると、settings の `"agent"` によりリーダーとして起動され、フックの対象外になる）。
  - `--bare` を付けない。`--setting-sources` から project を外さない（どちらもフックが読まれず、判定役が無制限になる）。
  - 起動の作業場所（cwd）はこのリポジトリの直下にする（直下でないと、相対パスの Read が止まる）。
- コミットとプッシュはリーダーが行う。検証が落ちている状態ではコミットしない。

## 規約

- LLM の処理は Anthropic の API キーを使わず、すべて `claude -p` で起動する。
- 成果物のファイル名を、`report` / `summary` / `findings` / `analysis` で始まる `.md` にしない（大文字小文字を問わない）。サブエージェントがこの名前を書こうとすると、Claude Code 本体が拒否する。例: `report.md` ではなく `verification-report.md`、`summary.md` ではなく `phase0-summary.md`。
- トークンなどの秘密は、DPAPI で保護したファイル（`%LOCALAPPDATA%\<editor>\` の下。docs/06 の2.4）に置く。エージェントは直接開かず、スクリプト（`scripts/lib/read-secret.ps1`）だけが読む。
- ビルドの作業場所はリポジトリの外（既定 `C:\b\`。`local.json` の `buildRoot`）。

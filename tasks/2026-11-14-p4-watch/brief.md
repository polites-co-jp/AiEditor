# Phase 4 の準備: 更新の検知 tools/watch と、秘密の読み出し read-secret.ps1

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。本体と同梱拡張の新版を毎日調べ、Notion の ToDo を書く検知のプログラムを作る。

## 入力

- docs/06 の2節（2.1 置き場所と動かし方、2.2 取得するもの、2.3 Notion の ToDo への書き込み、2.4 トークンの置き場所。DPAPI）、4節の10（取り込みの結果の書き戻し。部品を共有する）
- docs/02 の6.1（`local.json` と共通の部品 `scripts/lib/local-config.*`）
- `extensions.lock.json`、`upstream.json`、`scripts/lib/lock.mjs`（台帳の読み方）
- CLAUDE.md の秘密の規約（DPAPI で保護したファイル、エージェントは直接開かず `scripts/lib/read-secret.ps1` だけが読む）

## やること

1. `scripts/lib/read-secret.ps1`（docs/06 の2.4。`ConvertTo-SecureString` で戻して標準出力に出す）と、トークンを保存する手順（ユーザーが行う。保存の台本を作るなら、トークンを引数やログに残さない形）。
2. `tools/watch/watch.mjs`: 2.2 の取得、前回の状態との比べ、「セキュリティ修正あり」の判定、2.3 の ToDo の作成（重複しない）、`state.json`・`watch.log`。Notion への書き込みの部品は、取り込みの書き戻し（4節の10）でも使えるよう `tools/watch/lib/` か `scripts/lib/` に置く。
3. `tools/watch/register-task.ps1`（タスクスケジューラへの登録。2.1）。
4. 試し: Notion と GitHub の API は差し替えられる形にし、差し替えた入力で、ToDo の中身・重複の防止・セキュリティ修正の判定を確かめる。本物の Notion には書かない（トークンも ToDo の DB もまだ無い）。GitHub と Open VSX の本物の取得は、読むだけで1回試してよい。タスクスケジューラへの登録は試しで行わない。

## 守ること

- 書き込みは `tools/watch/`・`scripts/lib/read-secret.ps1`・`scripts/lib/notion*`（作るなら）・`tasks/`・`C:\b\` だけ。ほかの蒙恬が並行して `scripts/take-in.mjs`・`adopt.mjs`・`TAKE-IN.md`（p3-take-in）と `extensions-src/notion-sync/`（p4-notion-sync）を作る。それらを書かない。
- 秘密の場所（`%LOCALAPPDATA%\Shuko\watch\`、`secrets\`）を直接開かない。試しは別の場所を引数で渡す。
- `.claude/` と `team/hooks/` を書き換えない。

## 完了条件

- 1〜3 があり、`node --check` と PowerShell の構文の検査が通る。4 の試しの記録がある。

## 成果物

このディレクトリに保存する。

- `watch-design.md`: 引数、関数の入出力（テストの入口）、`state.json` の形、ToDo の中身の例。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。ユーザーがトークンを用意して登録する手順の下書き（`docs/install.md` に入れる分）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

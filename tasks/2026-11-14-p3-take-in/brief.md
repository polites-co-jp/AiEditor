# Phase 3 の準備: 取り込みの台本 take-in.mjs・adopt.mjs と TAKE-IN.md

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。毎週の取り込みの一連（本体と拡張）と、採ると決めた版の確定を作る。ビルドの道具がそろう前でも、台本と規約は書ける。

## 入力

- docs/06 の1節・3節・4節（本体の取り込みの手順 1〜10。手順 7 の通信の監査は残り、手順 8 の計測はやめた）・6節（拡張の取り込み）・7節（`claude -p` による修理と判定。`TAKE-IN.md` の規約、判定の形 `verdict.json`・`verdict.md`）・8節（入れ替えと戻し。入れ替えはユーザーが行う）
- CLAUDE.md の「毎週の取り込みの採否は、スクリプトが `claude -p --agent di-renjie` で狄仁傑を起動」の注意（`--agent di-renjie` を必ず付ける、`--bare` を付けない、`--setting-sources` から project を外さない、cwd はリポジトリの直下）。`.claude/agents/di-renjie.md`（読むだけ）
- docs/03 の5.2（edits のコミットの名前 `shuko-apply <apply@shuko.invalid>`。修理のときの `claude -p` も同じ）
- 既にある台本: `scripts/prepare.mjs`・`apply.mjs`・`build.mjs`・`lock-fetch.mjs`・`lock-verify.mjs`・`lock-diff.mjs`・`install-extensions.mjs`・`switch.ps1`（`-Zip` で版のフォルダへの展開。取り込みもこの入口を使う。docs/02 の8節）・`netaudit.ps1`・`tests/smoke-run.mjs`
- `scripts/lib/read-secret.ps1` と Notion への書き戻し（docs/06 の4節の10）は、別の蒙恬（タスク p4-watch）が作る部品を使う。まだ無ければ、呼ぶ形だけを決めて置く

## やること

1. `TAKE-IN.md`（`claude -p` に渡す規約。docs/06 の7.2）。コミットの名前の規約を含める。
2. `scripts/take-in.mjs core <tag>` と `scripts/take-in.mjs ext <id>`（docs/06 の4節・6節）。
   - 各手順は既にある台本を呼ぶ。修理（手順 3・5）と判定（手順 9）は `claude -p` を子のプロセスで起動する。
   - 子の環境変数から `ANTHROPIC_API_KEY` を外す。判定は `--agent di-renjie`。
   - 記録は `records/take-in/<label>/`。
3. `scripts/adopt.mjs`（採ると決めた版の確定: 取り込みのブランチを main へ、タグ。docs/02 の2節）。入れ替えそのもの（`switch.ps1`）はユーザーが行う。
4. ビルドが要る手順は、まだ走らせられない。走らせられる範囲（引数、手順の並べ方、`--dry-run`、`claude -p` の起動の引数の組み立て、判定の JSON の検査）で試す。`claude -p` を実際に起動する試しは、短い無害な入力で1回だけ行い、使った引数を記録する（API キーを使わない）。

## 守ること

- 書き込みは `scripts/take-in.mjs`・`scripts/adopt.mjs`・`scripts/lib/take-in/`・`TAKE-IN.md`・`tasks/`・`C:\b\` だけ。ほかの蒙恬が並行して `tools/watch/`・`scripts/lib/read-secret.ps1`（p4-watch）と `extensions-src/notion-sync/`（p4-notion-sync）を作る。それらを書かない。
- `.claude/` と `team/hooks/` を書き換えない。
- `main` へのマージやタグ付けを、試しで実際のリポジトリに対して行わない（試しの clone で行う）。

## 完了条件

- 1〜3 があり、`node --check` が通る。4 の試しの記録がある。

## 成果物

このディレクトリに保存する。

- `take-in-design.md`: 引数、手順と呼ぶ台本、関数の入出力（テストの入口）、記録の形。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

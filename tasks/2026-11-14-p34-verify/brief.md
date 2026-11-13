# Phase 3・4 の準備の検証: 取り込み・更新の検知・notion-sync と、その後の直し

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

ビルドの道具がそろう前に作れる Phase 3・4 の成果を確かめ、合否を出す。ビルド・本物の Notion・タスクスケジューラの登録が要る確かめは、この検証の対象外にする。

## 入力

- 蒙恬:
  - `tasks/2026-11-14-p3-take-in/`（take-in-design.md、handoff-notes.md と追記1・2）。対象は `TAKE-IN.md`・`scripts/take-in.mjs`・`scripts/adopt.mjs`・`scripts/lib/take-in/`
  - `tasks/2026-11-14-p4-watch/`。対象は `tools/watch/`・`scripts/lib/read-secret.ps1`・`scripts/lib/notion-client.mjs`・`scripts/lib/notion-todo.mjs`
  - `tasks/2026-11-14-p4-notion-sync/`。対象は `extensions-src/notion-sync/`（`node_modules` を除く）
  - `tasks/2026-11-13-p2-build-switch/handoff-notes.md` の追記3・4。対象は `switch.ps1 -ExpandOnly`、`build.mjs` から `apply.mjs` への受け渡し
- 曹参: `tasks/2026-11-14-p34-tests/`（`tests/take-in.test.mjs`・`watch.test.mjs`・`notion-sync.test.mjs`）、`tasks/2026-11-14-p2-tests-build/handoff-notes.md` の追記2（`tests/build-fixes.test.mjs`）
- docs/05、docs/06（9節は今日書いた決めごと）、CLAUDE.md の狄仁傑の起動の注意と秘密の規約

## やること

1. レビュー（コードは直さない）。
   - 取り込み:
     - 手順が docs/06 の4節・9節のとおりか。
     - `claude -p` の起動が規約どおりか（判定は `--agent di-renjie`、`--bare` なし、`--setting-sources` から project を外さない、作業場所はリポジトリの直下、`ANTHROPIC_API_KEY` を外す）。
     - 修理は Bash なしで、`--strict-mcp-config` を付けているか。
     - `adopt.mjs` がプッシュしないか。
   - 検知:
     - 秘密を `read-secret.ps1` だけが読み、値がログ・記録・引数に出ないか。
     - 重複を防ぐか。
     - 「セキュリティ修正あり」の判定が docs/06 の2.2 のとおりか。
   - notion-sync:
     - トークンが SecretStorage だけに置かれるか。
     - 競合・分割・`ignoredSettings` の扱い。
     - 依存の版の固定と install スクリプトの扱い。
   - `switch.ps1 -ExpandOnly` が `current`・`history.txt`・`backups` に触れないか。
2. 実行。
   - `node tests/run-all.mjs` で全部を走らせ、件数を記録する（直しの後の版で）。
   - `node scripts/take-in.mjs core 1.147.0 --dry-run`、`ext anthropic.claude-code --dry-run`、`adopt.mjs` の dry-run を見る。
   - `tools/watch/watch.mjs --dry-run` を差し替えの入力（`--fixtures`・`--notion-fake`）で走らせる。
   - `pnpm --dir extensions-src/notion-sync run build` が通るか（許可にあれば）。
3. 確かめた版の SHA-256 を記録する。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 本物の Notion に書かない。秘密の場所を開かない。タスクスケジューラに登録しない。`claude -p` を本物で起動しない（蒙恬の試しの記録を読む）。
- 普段使いのデータ、実際の `local.json`、スタートメニュー、PATH に触れない。

## 完了条件

- 1〜3 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

合格（3回目で `apply.mjs` の `--config` も合格）。

## 未解決

なし

## 次の担当

合格なら、リーダーがコミットする。

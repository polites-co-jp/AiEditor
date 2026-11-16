# 関門: C-4-notebook（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-4 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、absentStrings 0 件。`node tests/c4-check-json.mjs <checks.json>` の食い違いは「想定していない単位が当たっている: C-5〜C-7」だけ（照らし役が21単位の組を持たないため）。`node tests/c4-check-worktree.mjs <作業ツリー>` は「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 判定できない |
| 4 壊れていない | 判定できない（原因は C-1。`gate-C-1-ai.md`） |

C-1 を直した版で見ること（`tests/removals/c4-gate-script.md` の5節）: `absence` の組（コマンド3・設定4）、コンソールに `UNKNOWN service`（`notebookService` ほか3つ）が無い、**全文検索**（テキスト検索・置換・すべて置換・検索エディタ、`.ipynb` がテキストとして出る、ノートブックの絞り込みのボタンが無い）、TypeScript・Markdown・PowerShell・basedpyright の起動とノートブックの API の誤りが無いこと、「知らない contributes」（`notebooks`・`notebookRenderer`）の記録、Claude Code のパネル・差分・コメント。

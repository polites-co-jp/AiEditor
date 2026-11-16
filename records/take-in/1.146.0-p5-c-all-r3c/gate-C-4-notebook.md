# 関門: C-4-notebook（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。手の項目 C7・C8 が残る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c4-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c4-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」。C-1 が `searchView.ts` に足したハンクの後でも、C-4 の同じファイルの区画は衝突なく当たった |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の7項目が pass |
| 4 壊れていない | 合格。3回のスモークに `depends on UNKNOWN service`（`notebookService` ほか3つ）は無い。全文検索は `base.search`・`base.replace`・`base.ripgrep` が3回とも PASS で、**r2 で `semanticSearchBehavior` の誤りが出た検索の欄の入力の道（`findInFiles` → 欄の値の設定 → `onSearchInputChanged` → `submitSearch`）でも、誤りは出なかった**（全体の記録の4節）。TypeScript・Markdown・PowerShell・basedpyright が起動して診断・補完が出た。「知らない contributes」（`notebooks`・`notebookRenderer`）の警告は出ない |

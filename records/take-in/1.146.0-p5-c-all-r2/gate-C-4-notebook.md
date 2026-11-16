# 関門: C-4-notebook（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-4 の誤りは見つからない）。全文検索の欄に打ったときの振る舞いは、手の項目 C7 で見る（C-1 の誤りが同じ所に出ているため）。版としては C-1 の誤りで不合格

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c4-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c4-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の7項目（コマンド3・設定4）が pass。公式の版では7とも在る |
| 4 壊れていない | C-4 の分は合格。3回のスモークに `depends on UNKNOWN service`（`notebookService`・`notebookEditorService`・`notebookSearchService`・`notebookEditorModelResolverService`）は無い。全文検索は `base.search`・`base.replace`（検索の結果の一致を1件置換）・`base.ripgrep` が3回とも PASS。TypeScript・Markdown（プレビュー）・PowerShell・basedpyright が起動して診断・補完が出た。拡張ホストのログにノートブックの API の誤りは無い。「知らない contributes」（`notebooks`・`notebookRenderer`）の警告は出ない（記録が目的） |

**全文検索の誤りについて**: 3回とも、検索の欄の入力の聞き手で `Cannot read properties of undefined (reading 'semanticSearchBehavior')` が出た。出どころは C-1 が消した AI の検索の設定（`search.searchView.*`）の読み手で、C-4 の検索の直しではない（`gate-C-1-ai.md` の症状2）。C-4 の台本が「検索が壊れたら」と恐れていた部分とは別の原因。

手の項目: 欄に打った検索・置換・すべて置換・検索エディター・ノートブックの絞り込みのボタンが無いこと（C7）、ノートブックのコマンドが無いこと（C8）。

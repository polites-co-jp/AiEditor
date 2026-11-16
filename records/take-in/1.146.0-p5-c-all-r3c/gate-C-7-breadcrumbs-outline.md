# 関門: C-7-breadcrumbs-outline（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。台本が最重要とするエディタの枠の見た目は、手の項目 C16〜C20 で見る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c7-check-json.mjs <checks.json>` は「期待どおり（組 b。C-3 の有無で見分ける照らし役）」、`node tests/c7-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の7項目が pass |
| 4 壊れていない | 合格。3回のスモークに `depends on UNKNOWN service`（`outlineService`・`breadcrumbsService`）は無い。分割・差分・2つめのウィンドウが3回とも PASS。`TextModel got disposed before DiffEditorWidget model got reset` は各回1回ずつで、本家の公式の基準にもある既知の誤り |

docs/07 の8節の「C-7 は2回続けて通らなければ諮る」: r2・r3c とも、C-7 の自動の関門で落ちた所は無い。

# 関門: C-7-breadcrumbs-outline（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-7 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、absentStrings 0 件。`node tests/c7-check-json.mjs <checks.json>` は「期待どおり」。`node tests/c7-check-worktree.mjs <作業ツリー>` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 判定できない |
| 4 壊れていない | 判定できない（原因は C-1。`gate-C-1-ai.md`） |

docs/07 の8節の「C-7 は2回続けて通らなければ諮る」の数え方: 今回は C-7 を確かめる所まで行っていない（C-1 の誤りで起動しない）。「通らなかった1回」に数えるかは、リーダーが決める。私の見方では、C-7 の関門は行えていないので、数えない方が事実に合う。

C-1 を直した版で見ること（`tests/removals/c7-gate-script.md` の5節）: コンソールに `UNKNOWN service`（`outlineService`・`breadcrumbsService`）が無い、**エディタの枠**（タブが複数・1枚・無しでの高さと本体の位置、空の帯が無い、分割・タブの移動・補助ウィンドウ、差分エディタと変更の無い部分の折りたたみ）、Claude Code のパネル・差分の受け入れと却下・`editor/title` のボタン、Ctrl+Shift+O、`absentCommands`（4）と `breadcrumbs.*` の設定が無い、通信の監査で新しい接続先が無い。

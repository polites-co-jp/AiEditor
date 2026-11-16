# 関門: C-7-breadcrumbs-outline（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-7 の誤りは見つからない）。台本が「最重要」とするエディタの枠の見た目は、手の項目 C16〜C20 で見る。版としては C-1 の誤りで不合格

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c7-check-json.mjs <checks.json>` は「期待どおり（組 b。C-3 の有無で見分ける照らし役）」、`node tests/c7-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の7項目（コマンド4・設定3）が pass。公式の版では7とも在る |
| 4 壊れていない | C-7 の分は合格。3回のスモークに `depends on UNKNOWN service`（`outlineService`・`breadcrumbsService`）は無い。エディタの分割（`base.split`）・差分（`base.diff`）・2つめのウィンドウ（`base.window2`）が3回とも PASS。`workbench.action.gotoSymbol`・`workbench.action.splitEditorDown`・`workbench.action.moveEditorToNewWindow`・`workbench.action.compareEditor.nextChange` は登録されている。Claude Code は3回とも起動した |

`TextModel got disposed before DiffEditorWidget model got reset` は3回とも1回ずつ出た。本家の公式の版の基準にもある既知の誤りで（`baseline-official-1.146.0.json`）、C-7 では増えていない。

docs/07 の8節の「C-7 は2回続けて通らなければ諮る」: 今回、C-7 の自動の関門で落ちた所は無い。前回（`1.146.0-p5-c-all`）は C-7 を確かめる所まで行かなかった。

手の項目: タブが複数・1枚・無しでの帯と本体の位置（C16）、分割・タブの移動・別ウィンドウ（C17）、差分エディタの折りたたみ（C18）、Ctrl+Shift+O（C19）、Claude Code の `editor/title` のボタン（C20）。

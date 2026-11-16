# 関門: C-2-debug（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-2 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、edits の衝突なし、removeLines 27行すべて `found = count = 1`、`missingDeletes` は `debugChatIntegration.ts` の1件だけ（C-1 が先に消す。台本の b の組の想定どおり）、警告も同じ1件だけ、absentStrings 15項目すべて 0 件、コミットの並びと作者も想定どおり。`node tests/c2-check-json.mjs <checks.json>` の食い違いは「想定していない単位が当たっている: C-3〜C-7」だけ（照らし役が21単位の組を持たないため。全体の記録の1節）。`node tests/c2-check-worktree.mjs <作業ツリー>` は「期待どおり」 |
| 2 型検査とビルド | 合格（全体の記録の1節） |
| 3 消えている | 判定できない（absentStrings は 0 件。起動して見る項目は取れない） |
| 4 壊れていない | 判定できない（ワークベンチが起動しない。原因は C-1。`gate-C-1-ai.md`） |

C-1 を直した版で見ること（`tests/removals/c2-gate-script.md` の5節）: `absence` の組（`workbench.action.debug.start`・`editor.debug.action.toggleBreakpoint`・`workbench.view.debug`・設定3つ）、コンソールに `depends on UNKNOWN service debugService`・`Missing proxy instance` が無い、テストのビューの普通の実行と呼び出し履歴、拡張ホストのログに `vscode.debug` の誤りが無い、ワークスペースの信頼の画面、PowerShell 拡張の起動と「知らない contributes」（`debuggers`・`breakpoints`）の警告の記録。

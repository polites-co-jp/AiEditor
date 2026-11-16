# 関門: C-2-debug（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。手の項目 C3・C4（`records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`）が残る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c2-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c2-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」。警告は想定の1件（`debugChatIntegration.ts`）だけ |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の6項目が pass（公式の版で網になっていることは r2 で確かめた）。absentHosts は空。監査2通りで宛先 0 |
| 4 壊れていない | 合格。3回のスモークに `depends on UNKNOWN service debugService`・`Missing proxy instance`・`vscode.debug` の誤りは無い。PowerShell のセッション・診断・pwsh.exe、タスクの実行が3回とも PASS。「知らない contributes」（`debuggers`・`breakpoints`）の警告は出ない |

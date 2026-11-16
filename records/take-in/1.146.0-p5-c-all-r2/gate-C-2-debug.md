# 関門: C-2-debug（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-2 の誤りは見つからない）。手の項目（`manual-checks-p5-c-all-r2.md` の C3・C4）が残る。版としては C-1 の誤りで不合格なので、C-1 を直した版でもう一度見る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c2-check-json.mjs <checks.json>` は「期待どおり（組 c）」。組 c は21単位ちょうど・並び・C-3〜C-7 の edits の衝突なしまで見る（照らし役を読んで確かめた）。`missingDeletes` と警告は想定の1件（`debugChatIntegration.ts`。C-1 が先に消す）だけ。`node tests/c2-check-worktree.mjs tmp/b/wt-r2/1.146.0` は「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の6項目（`workbench.action.debug.start`・`editor.debug.action.toggleBreakpoint`・`workbench.view.debug`・設定3つ）が pass。公式の版では6つとも在る（網になっている）。absentHosts は空 |
| 4 壊れていない | C-2 の分は合格。3回のスモークの誤りに `depends on UNKNOWN service debugService`・`Missing proxy instance`・`vscode.debug` の誤りは無い。拡張ホストは3回とも起動し、PowerShell のセッションと PSScriptAnalyzer の診断が出た（`lang.ps1.session`・`lang.ps1.pwsh7` が PASS）。タスクの実行（`base.task`）も PASS。テストの部品のコマンド（`testing.runAll`・`workbench.view.testing.open`）は登録されている。「知らない contributes」（`debuggers`・`breakpoints`）の警告は、拡張ホストのログにも renderer のログにも出ない（記録が目的） |

残っているデバッグの名のコマンド: `workbench.action.debugExtensionHostAndRenderer`・`workbench.action.debugRenderer`（拡張機能の開発用。C-2 が残すとした `extensionHostDebugService` の側）。

手の項目: F5・余白のクリック・「実行とデバッグ」のビューが無いこと（C3）、テストのビュー（C4）。

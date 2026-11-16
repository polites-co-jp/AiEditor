# 関門: C-5-extension-gallery（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-5 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、absentStrings 0 件。`node tests/c5-check-json.mjs <checks.json>` の食い違いは「想定していない単位が当たっている: C-6・C-7」だけ（照らし役が21単位の組を持たないため）。`node tests/c5-check-worktree.mjs <作業ツリー>` は「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 判定できない |
| 4 壊れていない | 判定できない（原因は C-1。`gate-C-1-ai.md`） |

台本で最重要とした「CLI の `--install-extension` の道」は、この版では落ちている。ただし原因は C-1 が外した `builtInExtensionsEnabledWithAutoUpdates`（`extensionsScannerService.ts` の113行。C-5 の部品ではない）で、C-5 の成否はまだ分からない。

C-1 を直した版で見ること（`tests/removals/c5-gate-script.md` の5節）: CLI の導入で台帳の拡張が入って起動する、コンソールに `UNKNOWN service`（おすすめ・tips・ギャラリーのアカウントの5つ）が無い、画面からの導入（VSIX の右クリック・落とす・`ext install`・コマンドパレット）が消えている、拡張の一覧・有効と無効・アンインストール・動作中の拡張の一覧・詳細、共有プロセスの導入が止まらない、`absentCommands`（17）・`absentViews`（6）・設定2つ、**通信の監査でギャラリーのホストへの接続が無い**、Claude Code のパネル・差分・コメント。

# 関門: C-3-remote（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-3 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、absentStrings 0 件。`node tests/c3-check-json.mjs <checks.json>` の食い違いは「想定していない単位が当たっている: C-4〜C-7」だけ（照らし役が21単位の組を持たないため）。`node tests/c3-check-worktree.mjs <作業ツリー>` は「期待どおり」 |
| 2 型検査とビルド | 合格。build/ の台本の型の誤り（判断済みの6件）でパッケージ化は止まらなかった |
| 3 消えている | 判定できない |
| 4 壊れていない | 判定できない（原因は C-1。`gate-C-1-ai.md`） |

C-1 を直した版で見ること（`tests/removals/c3-gate-script.md` の4節）: `absence` の組（コマンド4・ビュー2・設定4）、ステータスバーの「><」とリモートのビューが無い、コンソールに `UNKNOWN service`（`tunnelService`・`remoteExplorerService`・`remoteTunnelService`）が無い、共有プロセスのログに `remoteTunnel` のチャンネルの誤りが無い、Claude Code のパネル・ログインの外部 URI・差分とコメント、拡張ホストのログに `openTunnel` などの誤りが無い、ターミナルの localhost のリンク。

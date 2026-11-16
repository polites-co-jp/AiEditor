# 関門: C-6-settings-sync（版 `1.146.0-p5-c-all`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all.md`
- 判定: **判定できない**（3・4 が C-1 の誤りで見られない。C-6 の誤りは見つかっていない）

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`applied: ok`、absentStrings 0 件。`node tests/c6-check-json.mjs <checks.json>` は「期待どおり」。`node tests/c6-check-worktree.mjs <作業ツリー>` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 判定できない |
| 4 壊れていない | 判定できない（原因は C-1。`gate-C-1-ai.md`） |

起動を止めた `services/accounts/browser/defaultAccount.ts` は、C-6 が「依存があるので残す」とした `services/accounts` の中にある。ただし、ファイルは本家のままで、落ちるのは C-1 が product.json から `defaultChatAgent` を外したため。C-6 の成果の誤りではない。

C-1 を直した版で見ること（`tests/removals/c6-gate-script.md` の5節）: コンソールに `UNKNOWN service`（特に `userDataSyncWorkbenchService`）が無い、**設定の画面（`Ctrl+,`）が誤りなく開く**、設定の変更で再起動を尋ねる案内、Settings Sync のコマンド・メニュー・ビューが無い、**続きの編集（`Continue Working On...`）が残っている**、プロファイルと拡張の管理、**通信の監査で同期のストアへの接続が無いこと・続きの編集が通信しないこと**（裁定。通信があれば諮る）、Claude Code のパネル・差分・コメント、CLI で台帳の拡張が入る。

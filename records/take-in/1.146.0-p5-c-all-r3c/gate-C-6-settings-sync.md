# 関門: C-6-settings-sync（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。手の項目 C12〜C15 が残る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c6-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c6-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の2項目が pass。`workbench.userDataSync.*`・`workbench.userData.*`・`workbench.view.sync*` のコマンドは、スモークの commands.json に1つも無い。監査2通りで、同期のストアへの接続も名前の問い合わせも無い |
| 4 壊れていない | 合格。3回のスモークに `depends on UNKNOWN service userDataSyncWorkbenchService` は無い。`userDataSync.log` は3回とも空。設定を開くコマンドとプロファイルを作るコマンドは登録されている |

## 続きの編集（裁定 2026-11-15「通信があれば諮る」）

- 通信は見つからなかった（監査2通り×600秒でエディタの宛先 0）。スモークの `editSessions.log` は3回とも空。
- 公開のコマンドは r2・p2-all と同じく `workbench.editSessions.actions.resetAuth` だけ。C-6 はこの部品に触れていない。

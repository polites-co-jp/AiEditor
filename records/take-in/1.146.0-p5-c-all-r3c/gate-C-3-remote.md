# 関門: C-3-remote（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。手の項目 C5・C6、9・C1（Claude Code のパネルとログイン）が残る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c3-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c3-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格。build/ の台本の型の誤り（判断済み）でパッケージ化は止まらなかった |
| 3 消えている | 合格。absent の10項目が pass。absentHosts は空。監査2通りで宛先 0 |
| 4 壊れていない | 合格。3回のスモークに `depends on UNKNOWN service`（`tunnelService`・`remoteExplorerService`・`remoteTunnelService`）は無い。共有プロセスのログに誤りは無い。拡張ホストのログに `openTunnel` などの誤りと `ViewContainerDoesnotExist` は無い。Claude Code は3回とも起動した |

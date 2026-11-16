# 関門: C-3-remote（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-3 の誤りは見つからない）。手の項目（C5・C6、9〜14 の Claude Code のパネル）が残る。版としては C-1 の誤りで不合格

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c3-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c3-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格。build/ の台本の型の誤り（判断済みの6件）でパッケージ化は止まらなかった |
| 3 消えている | 合格。absent の10項目（コマンド4・ビュー2・設定4）が pass。公式の版では10とも在る。absentHosts は空 |
| 4 壊れていない | C-3 の分は合格。3回のスモークに `depends on UNKNOWN service`（`tunnelService`・`remoteExplorerService`・`remoteTunnelService`）は無い。共有プロセスのログ（`sharedprocess.log`）は3回とも空で、`remoteTunnel` のチャンネルの誤りは無い。拡張ホストのログに `openTunnel` などの誤りと `ViewContainerDoesnotExist` は無い。Claude Code は3回とも起動した |

前の版（p2-all）にあった `Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json` は、3回とも出なくなった（C-3 がトンネルの部品を消したため。見込みどおり）。

手の項目: 「><」・リモートエクスプローラー・ポートのビューが無いこと（C5）、ターミナルの localhost のリンク（C6）、Claude Code のパネルとログインの外部 URI（9・C1）。

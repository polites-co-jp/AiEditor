# 関門: C-6-settings-sync（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-6 の誤りは見つからない）。設定の画面・再起動の案内・アカウントのメニューは、手の項目 C12〜C15 で見る。版としては C-1 の誤りで不合格

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c6-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c6-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の2項目（`workbench.userData.actions.openSyncBackupsFolder`・`workbench.userDataSync.actions.downloadSyncActivity`）が pass（公式の版では在る）。台本が挙げる `workbench.userDataSync.actions.turnOn` などの `workbench.userDataSync.*`・`workbench.userData.*`・`workbench.view.sync*` のコマンドは、スモークの commands.json に1つも無い。**通信の監査（2通り×600秒）で、同期のストア（`vscode-sync.trafficmanager.net` など）への接続も名前の問い合わせも無い**。出力の product.json に `configurationSync` は無い |
| 4 壊れていない | C-6 の分は合格。3回のスモークに `depends on UNKNOWN service userDataSyncWorkbenchService` は無い。`userDataSync.log` は空。設定を開くコマンド（`workbench.action.openSettings2`）とプロファイルを作るコマンド（`workbench.profiles.actions.createProfile`）は登録されている |

## 続きの編集（裁定 2026-11-15「今は残す。通信が見つかったら改めて諮る」）

- **通信は見つからなかった**。2通りの監査（関門の環境、台帳の拡張あり。各600秒）で、エディタの外向きの宛先は 0。名前で見えたのは `wpad`（手元のネットワークの名前の問い合わせ。答えも接続も無い。前の版からある）だけ。スモークの `editSessions.log` も3回とも空。
- 部品は残っている。続きの編集の公開のコマンドのうち、登録されているのは `workbench.editSessions.actions.resetAuth` だけ。p2-all（C-6 の前の版）の commands.json も同じく `resetAuth` だけ。出力の product.json に預け先の設定が無いので、ほかのコマンドは条件つきで出ない形と見られる（推定）。C-6 はこの部品に触れていない。
- 「Continue Working On...」（`_workbench.editSessions.actions.continueEditSession`）は、`_` で始まる内部のコマンドなので、スモークの一覧（`getCommands(true)`）には出ない。コマンドパレットに出るかは手の項目 C14 で見る。
- 監査の限界: ログインして預けるなどの操作はしていない。操作で起きる通信は見ていない（docs/07 の3.3）。

手の項目: 設定の画面（C12）、再起動の案内（C13）、アカウントのメニューと「Continue Working On...」（C14）、プロファイル（C15）。

# Phase 1 の関門の記録: A-1 を当てた本家 1.146.0（ビルド・zip・起動）

- 検証: 大岡越前守、2026-11-14（JST）
- タスク: `tasks/2026-11-14-p1-verify-a1/`（検証）、`tasks/2026-11-14-p1-build-a1/`（蒙恬のビルド）
- 根拠の裁定: `docs/user-decisions.md` の「裁定（2026-11-14、Phase 1 のビルドの関門）」（1.146.0 では、関門を A-1 の単位と合わせて満たす）
- 関門の条件: `docs/07-phases.md` の4節「完了の条件: 無改造のビルドが zip から起動し、Claude Code の組が通り、所要時間とディスクの記録がある」。今回見たのは「zip から起動する」「所要時間とディスクの記録がある」の2つ。Claude Code の組（スモーク）は Smart App Control をオフにした後に別に行うので、この記録の対象外

## 判定

| 条件 | 判定 |
|---|---|
| zip から起動する（A-1 を当てた 1.146.0） | **満たす** |
| 所要時間とディスクの記録がある | **満たす** |
| Claude Code の組が通る | 対象外（未実施。Smart App Control をオフにした後に行う） |

Phase 1 の関門は、上の2つの条件について合格。関門の全体は、Claude Code の組が通るまで閉じない。

## 何をビルドしたか

| 項目 | 値 |
|---|---|
| 本家 | 1.146.0、commit `69047191fc427f2f92828279aae1d90d8eeda7ab` |
| 作業ツリー | `C:\b\wt\p1-a1`、HEAD `72f454338508f617631589f6f3f6cfc1aff1ca8b`（`C:\b\vscode\.git\worktrees\p1-a1\HEAD` で確かめた） |
| 当てたもの | A-1-copilot-extension（`--only`）と mydist だけ。product.json の上書き・`patches/`・`assets/`・notion-sync は当てていない（`take-in-r2/checks.json`）。作業ツリーで本家と違うのは、A-1 が触る4ファイルだけ（比べた範囲） |
| 道具 | node 24.22.1、pnpm 12.16.0、Electron 43.8.6 |
| zip | `C:\b\dist\1.146.0-p1-a1-r2.zip`、406,720,616 バイト、SHA-256 `9348d66c02d84deb8c0b5aa9da7adbff82f1d9eed9a756e8c8619008910c32b1`（検証役が `sha256sum` で計算し直して一致） |

## 所要時間（キャッシュが温まった状態）

| 手順 | 秒 | 記録 |
|---|---|---|
| 作業ツリーの用意（fetch 9.7・worktree add 13.7 ほか） | 27.7 | `prepare.json` |
| 適用（`apply.mjs`） | 7.2 | `take-in-r2/checks.json` の startedAt〜finishedAt |
| 依存の導入（1回目の値） | 164.0 | `build-record-install.json` |
| ロックファイルの検査 | 0.5 | `build-record-r2.json` |
| 型検査（`typecheck-client`） | 18.5 | 同上 |
| パッケージ化（`gulp vscode-win32-x64-min`） | 156.6 | 同上。`package.log` の131行「after 2.57 min」 |
| 後処理の確かめと zip | 35.5 | 同上 |
| 合計 | 410（約 6.8 分） | |

2回目の依存の導入は 2.5 秒だった（1回目で済んでいたため）。上の合計は、1回目の導入の値で足したもの。

## ディスク

| 項目 | 値 | 記録 |
|---|---|---|
| C: の空き（作業ツリーを作る前 → zip の後） | 81.15 → 78.82 GB（減り 2.33 GB） | `disk-before.json`・`disk-after-zip.json` |
| C: の空き（展開と起動の後） | 77.6 GB（さらに 1.2 GB 減った） | `env-check.json` |
| 作業ツリー | 4.50 GB（hard link を1回だけ数えると 3.86 GB）、131,106 ファイル | `disk-after-zip.json` |
| gulp の出力 | 1.18 GB、2,612 ファイル | 同上 |
| zip | 0.38 GB | 同上 |
| pnpm の store / Electron | 3.46 GB / 0.91 GB（前後で増えない） | `disk-before.json`・`disk-after-zip.json` |

## 起動

- `p1-launch-check.ps1 -Zip` の結果は `ok`（`launch-check.json`）。`code-oss.cmd --version` は終了コード 0（1.146.0 / x64）。`Code - OSS.exe` は、10 秒の確かめと 15 秒の待ちの後も生きていた（8プロセス）。展開したものは gulp の出力と同じ（主なファイルの SHA-256 が一致）。
- Smart App Control（オン）が、`@vscode/deviceid` の `windows.node`、`native-keymap` の `keymapping.node`、`native-is-elevated` の `iselevated.node` を止めた（`ci-events.json`。ID 3077 と 3033 が3組、ポリシー `VerifiedAndReputableDesktop`）。エディタは終わらなかった。
- 普段使いのデータ（`%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss`）は、前後とも無い（`launch-check.json`。検証役が読める場所の外なので、記録だけで判断した）。
- その後、裁定により Smart App Control はオフにされた。この起動の結果は、オンのときのもの。

## 台本とテスト

- `scripts/p1-ci-events.ps1` の直し（`FullyQualifiedErrorId` で「イベントが無い」を見分ける）は合格。`node --test tests/p1-scripts.test.mjs` は 27/27。
- `node tests/run-all.mjs`: TOTAL 1500、pass 1479、fail 0、skip 21（`tasks/2026-11-14-p1-verify-a1/run-all-output.txt`）。走らせた時点の `extensions-src/notion-sync/` は、蒙恬の直しの途中の状態（`jsonc-parser` を `devDependencies` へ移した変更）で、その状態で通った。

詳細と根拠のコマンドは `tasks/2026-11-14-p1-verify-a1/verification-log.md`。

---

## 追記（2026-11-14 22:00 頃、大岡越前守）: Claude Code の組と、関門の結び

- タスク: `tasks/2026-11-14-p1-smoke-built/`（r2 のスモーク。不合格）、`tasks/2026-11-14-build-commit-fix/`（蒙恬の build.mjs の直しと r3 の作り直し、曹参のテスト）、`tasks/2026-11-14-verify-commit-fix/`（この検証）
- スモークの記録: `records/phase1/smoke-built-1.146.0-p1-a1.md`（r2）、`records/phase1/smoke-built-1.146.0-p1-a1-r3.md`（r3）

### 経緯

r2 の zip のスモークは不合格だった。作業ツリーの `.git` がファイルで、本家の `build/lib/git.ts` が HEAD を読めない。そのため出力の product.json に `commit` が無く、ターミナル・タスク・PowerShell のセッション・言語パックが落ちた。蒙恬が `scripts/build.mjs` を直した。型検査とパッケージ化の子のプロセスに `BUILD_SOURCEVERSION=<作業ツリーの HEAD>` を渡し（リーダーの判断）、後処理で出力の `commit` を確かめる。直した build.mjs で r3 を作り直した。

### 作り直した版（r3）

| 項目 | 値 |
|---|---|
| zip | `C:\b\dist\1.146.0-p1-a1-r3.zip`、406,723,259 バイト、SHA-256 `e9215f2c2df15a3b4fdd910df1e63437d35b28bf844119c9517d57860daa996c`（検証役が `sha256sum` で計算し直して一致） |
| 当て方 | r2 と同じ（`--only A-1-copilot-extension`、上書き・patches・assets は空、mydist だけ） |
| 作業ツリーの HEAD | `cff68091803f933ffbd34c93d1a7dc14633f7a72`（`C:\b\vscode\.git\worktrees\p1-a1\HEAD` を検証役が読んで確かめた。`take-in-r3/checks.json` の `headCommit` と同じ） |
| 出力の product.json の `commit` | 同じ値（展開したものの215行。後処理の `productCommit.ok: true`） |
| 所要時間（依存の導入から zip まで。導入済みの作業ツリー） | install 3.7・lockfile 0.5・typecheck 19.7・package 166.2・postprocess 0.01・zip 38.7 秒。4分2秒（`tasks/2026-11-14-build-commit-fix/build-record-r3.json`） |
| ディスク | 作業ツリー 4.5 GB・131,105 ファイル、出力 1.18 GB・2,612 ファイル、zip 0.38 GB（同上の `disk`） |
| zip からの起動 | `p1-launch-check.ps1 -Zip` が `ok`。`code-oss.cmd --version` の2行目が `cff68091…7a72`（`launch-check-r3.json`） |

### 判定（関門の結び）

| 条件（docs/07 の4節の完了の条件） | 判定 |
|---|---|
| zip から起動する | **満たす**（r2 で確かめ、r3 でも `launch-check-r3.json` と、zip を展開したものでのスモークで確かめた） |
| Claude Code の組が通る | **満たす**（自動の3項目 claude.running・claude.exthost-log・claude.lock が PASS。r3 のスモーク） |
| 所要時間とディスクの記録がある | **満たす**（上の r2 の表と、r3 の `build-record-r3.json`） |

**Phase 1 の関門は合格。** r3 のスモークは PASS 48 / FAIL 1。残った FAIL の errors.new の3件（トンネルの設定が無い ×2、Claude Code の Remote Control）は、Code - OSS の product.json と A-1 の範囲で説明できる（Remote Control の方は推定を含む。スモークの記録の4節）。

対象外: docs/06 の5節の claude-code の組の手の項目（パネルからの送信、統合ターミナルの `claude` の接続、選択範囲、差分、診断）は、Phase 2 の最後にユーザーが行う（依頼書の5）。この関門では見ていない。

あわせて見たもの（docs/07 の4節の4）: 言語パックは効いた（表示が ja）。mydist の既定（`basedpyright.importStrategy` = `useBundled`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`）は効いた。`extensions.allowed` は上書きを当てていないので Phase 2 で見る。

詳細と根拠のコマンドは `tasks/2026-11-14-verify-commit-fix/verification-log.md`。

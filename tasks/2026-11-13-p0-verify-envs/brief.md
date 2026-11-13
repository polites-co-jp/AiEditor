# Phase 0 の検証（2）: 試験環境、0-8 の自動の部分、0-9 の mydist、0-10 の Sublime のキー、計測用のワークスペース

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

蒙恬の「試験環境の台本と環境、0-8 の自動の部分、0-9、0-10、計測用のワークスペース」を確かめて合否を出す。合格したものは、ユーザーが手で確かめる段（0-2・0-3・0-7・0-8 (b)(c)・0-9）と計測（0-4・0-5）に進める。

## 入力

- 蒙恬の成果: `tasks/2026-11-13-p0-envs-mydist-keys/`（brief.md、env-setup.md、extensions-allowed.md、configuration-defaults.md、sublime-keys.md、doc-corrections.md、ws-tasks.json、handoff-notes.md）、`scripts/p0-env.ps1`・`scripts/p0-launch.ps1`・`scripts/p0-ws.ps1`・`scripts/p0-ext-allowed.ps1`・`scripts/p0-check-ps.ps1`・`scripts/lib/p0-common.ps1`・`scripts/convert-sublime-keys.mjs`・`scripts/lib/sublime-keys.mjs`・`scripts/lib/zip-read.mjs`、`extensions-src/mydist/`、`.gitignore`
- 置き場所: `C:\b\p0\data\<名前>\`（10の環境と `p0-env.json`）、`C:\b\p0\testbed\`、`C:\b\p0\sublime\`、`C:\b\p0\logs\`、`C:\b\p0\ws-info.json`、計測用のワークスペース `tmp\ws\`（`.gitignore` の対象なので Glob・Grep は中を返さない。Read で読む）
- 仕様: docs/07 の2.1・2.3〜2.4・2.8〜2.11・3.1、docs/06 の5節、docs/03 の4節の段階 A、docs/04 の6〜7節
- ユーザーの決定: `ctr+shift+[` の項目は落とす（リーダーの決定、2026-11-13）

## やること

1. 台本のレビュー: docs のとおりの環境を作るか。普段使いのエディタのデータ（`%APPDATA%\Code`、`%USERPROFILE%\.vscode`、`~\.vscode-oss`、`%APPDATA%\VSCodium` など）に触れないか（`VSCODE_PORTABLE` の扱いを含む）。書き込み先の外を変えていないか（`git status`）。
2. 環境の中身: 各環境の `p0-env.json`・設定・`argv.json`・入った拡張（`ext\extensions.json` など）が env-setup.md のとおりか。試験台で消した組み込み拡張が docs/03 の段階 A のとおりか（消し過ぎ・消し残し）。段階 A の分類に無い組み込み拡張の報告（doc-corrections.md の3）が正しいか。
3. 0-8: `C:\b\p0\logs\ext-allowed-*\result.json` が、extensions-allowed.md の結論（CLI の `--install-extension` にも `extensions.allowed` が効く）を支えるか。
4. 0-9: `extensions-src/mydist/package.json` が docs/04 の6節に合うか（`main` なし、既定の5項目と値、キー割り当て）。Light Modern の ID の件（doc-corrections.md の2）。
5. 0-10: `node scripts/convert-sublime-keys.mjs` の結果（`C:\b\p0\sublime\`）と sublime-keys.md、`node tests/sublime-keys.test.mjs` の結果。Claude Code の既定のキーとの衝突の一覧が manifest と合うか。
6. 計測用のワークスペース: `tmp\ws\` の変更が `.vscode/tasks.json` だけか、tasks.json が docs/07 の3.2 の3を満たすか、選んだ2つのファイルが実在するか。
7. ユーザーが手で確かめる手順（env-setup.md の5節、extensions-allowed.md の3節、configuration-defaults.md の3節）が、そのまま使える形か（起動のコマンド、見る場所、記録すること）。足りない点を挙げる。

## 守ること

- コードは直さない。不合格の点は、誰の何をどう直すべきかを書く。
- 書き込みは `records/` と `tasks/` だけ。エディタは起動しなくてよい（手の確かめはユーザーが行う）。
- 普段使いのエディタのデータと秘密に触れない。

## 完了条件

- 1〜7 それぞれに合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`: 走らせたコマンドと結果、見た点、合否と理由、直すべき点（担当つき）。
- `handoff-notes.md`: 報告（SubagentHandback が止められたとき）。

`records/phase0/` への清書は、ユーザーの手の確かめが終わってから（0-8・0-9・0-10 の結果は手の確かめと合わせて書く）。0-10 は手の確かめが要らないので、合格なら `records/phase0/sublime-keys.md` を書いてよい。

## 結果

合格（3回目）。最初は項目2・7・8で不合格。蒙恬の文書3本と `p0-launch.ps1` の直し、argv.json の直し（`Write-P0Argv`）の後に合格し、ユーザーへの手の確かめの依頼が通った。

## 未解決

- records/phase0/ の5つの清書は、ユーザーの手の確かめの結果を待って書く。

## 次の担当

合格なら、リーダーがユーザーに手の確かめを頼む。

# Phase 0 の検証（3）: 計測と監査の台本の手直し、台帳の台本の手直し（A-1〜A-3）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

差し戻した曹参の `scripts/measure.ps1`・`scripts/netaudit.ps1` と、蒙恬の台帳の台本の手直し（A-1〜A-3）を確かめ、合否を出す。合格なら、0-4（本家の基準値）と 0-5（通信の棚卸し）の本番に進める。

## 入力

- 曹参: `tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md`（直したこと）、measure-design.md、netaudit-design.md、test-results.md、doc-corrections.md、trial/out-real/・trial/net-real/、`scripts/measure.ps1`・`scripts/netaudit.ps1`、`tests/`
- 蒙恬: `tasks/2026-11-13-p0-fetch-and-lock/handoff-notes.md` の追記（A-1〜A-3、A-4、ソースのタグ）、`scripts/lock-verify.mjs`・`scripts/lib/lock.mjs`、`package.json`、`.gitignore`
- 前の検証: `tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`（B-1〜B-4、A-1〜A-4）
- 仕様: docs/07 の3節、docs/04 の4節（裁定 2026-11-13: ソースのタグは参考の項目、ovsx は 1.4.0 に固定）
- 計測用の環境: `C:\b\p0\data\upstream-default\`・`testbed-measure\`、ワークスペース `tmp\ws\`（`.vscode/tasks.json` あり。開く2つのファイルは `C:\b\p0\ws-info.json`）

## やること

1. 曹参の台本: 前の検証の B-1〜B-4 と、VSCODE_PORTABLE・環境変数の除去が直ったか。テスト4本を自分で走らせる。台本を `upstream-default` と `tmp\ws` で1回だけ短く走らせ（例 `-Runs 1 -Warmup 0`）、次を確かめる。
   - tasks.json のターミナルが開く（ptyHost とシェルのプロセスが出る）、2つのファイルが開く。
   - 普段使いの `argv.json`（`%USERPROFILE%\.vscode`・`~\.vscode-oss`）が作られない。
   - claude.exe とその子孫が分けて集計される（パネルを使わないなら、0件として正しく出る）。
   - 節目の計測の一時停止の仕組みが docs/07 の3.2 のとおりか（読んで確かめる。手の操作が要るので、実際の一時停止は本番で）。
   - netaudit を短く（例 60秒）走らせ、出力の形が docs/07 の3.3 のとおりか。
2. 役割の判定で、拡張ホスト・ptyHost・共有プロセスが区別できない件（曹参の報告）が、3.2 の6 の目的（プロセスごとの値から重い部分を示す）にどれだけ響くかを書く。
3. 蒙恬の A-1〜A-3: 直し方が指摘に合うか、試しの結果が支えるか。ovsx の依存はユーザーが `pnpm install` を入れる予定なので、入っていなければ A-4 は「導入待ち」とする。入っていれば、`node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --result <tasks の下の試しの置き場所>` で、ovsx の項目が固定の版で通るかを見る（本番の `verify-result.json` と `extensions.lock.json` を書き換えない）。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 本番の5回の計測と10分の監査はまだ行わない（合格の後に、ユーザーの立ち会いで行う）。
- 普段使いのエディタのデータと秘密に触れない。

## 完了条件

- 曹参の台本と、蒙恬の A-1〜A-3（と、入っていれば A-4）に、合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`: 走らせたコマンドと結果、見た点、合否と理由、直すべき点（担当つき）。
- `handoff-notes.md`: 報告（SubagentHandback が止められたとき）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

合格なら、リーダーがユーザーと 0-4・0-5 の本番の日取りを決める。

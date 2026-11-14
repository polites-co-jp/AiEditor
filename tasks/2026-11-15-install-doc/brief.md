# docs/install.md の下書き（インストールの手順書）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

docs/07 の7節（Phase 4）の3。利用者（ユーザー本人）が、ビルドした zip から Shuko を日常の利用に入れるまでの手順書を作る。下書きはこのフォルダに置き、リーダーが `docs/install.md` に置く。

## 入力

- docs/07 の7節の3（書く項目）、docs/02 の6節（版のフォルダ、`current` のジャンクション、`switch.ps1`、6.1 の `local.json` と `configure.ps1`）、docs/04（台帳の拡張と `install-extensions.mjs`）、docs/05（notion-sync の設定）、docs/06（更新の検知の登録、毎週の取り込み）、docs/01 の4.1（外部ツール）
- `scripts/configure.ps1`、`scripts/switch.ps1`、`scripts/install-extensions.mjs`、`scripts/lib/local-config.*`、`tools/watch/`、`scripts/lib/read-secret.ps1`、`extensions-src/notion-sync/README.md`、`TAKE-IN.md`
- 既にある手順書の書き方: `docs/build-env-setup.md`
- 版: `C:\b\dist\1.146.0-p2-all.zip`（段階 A・B を当てた版）

## やること

1. 項目（docs/07 の7節の3のとおり）:
   1. `configure.ps1` による `local.json` の作成（版のフォルダの場所を変えるときの手順を含む）
   2. zip の展開と版のフォルダ、`current` のジャンクション（`switch.ps1`）
   3. スタートメニューと PATH
   4. 台帳の拡張の導入（`install-extensions.mjs`）
   5. 外部ツール（docs/01 の4.1）
   6. Notion の設定（notion-sync。トークンの置き方は DPAPI。エージェントは読まない）
   7. 更新の検知の登録（タスクスケジューラ）
   8. 戻し方（`switch.ps1 -Previous`、本家の VS Code に戻る）
2. コマンドは台本の実際の引数に合わせる（台本を読んで確かめる。`--help` などで読むだけの確かめはしてよい）。管理者の権限が要る手順は、そう書く。
3. 普段使いの本家の VS Code のデータ（`%APPDATA%\Code`）と分かれていることを書く。
4. 試し: 実際の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion は変えない（ユーザーが行う。裁定）。手順が通るかを試すなら、`C:\b\` の下の試しの場所と `-WhatIf` などの台本の試しの形だけで行う。

## 守ること

- 書き込みは `tasks/` と `C:\b\` の試しの場所だけ。`docs/` は書かない（リーダーが置く）。
- 秘密の場所を開かない。

## 完了条件

- `install-draft.md` があり、各手順のコマンドが台本の引数と合っている。

## 成果物

このディレクトリに `install-draft.md`、`handoff-notes.md`（台本と食い違った点、試した範囲）。

## 結果

採用。再検証で合格（`tasks/2026-11-15-install-doc-fix/verification-ooka.md`）。`docs/install.md` に置いた。

## 未解決

- 実機（本物の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion）での手順はユーザーが行う。

## 次の担当

ooka-echizen（大岡越前守）: 手順のコマンドが台本と合うかの検証。

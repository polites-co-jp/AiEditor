# ビルドの環境の調べ: Linux で Windows 版を作れるか、Windows コンテナの条件

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーが「コンテナ環境を作って、そこにフルセットを用意して、そこでビルドしてほしい」と指示した。VS Code の Windows 版（win32-x64）を、どの種類のコンテナで作れるかを、ユーザーが決めるための事実を集める。ユーザーは「Linux でビルドできないか確認中」。

## 入力

- docs/02 の4節・5節（ビルドの流れと Windows のビルド環境）
- `tasks/2026-11-13-p1-build-upstream/`（env-check.md、build-log.md）
- 本家のタグ 1.146.0 のソース（`C:\b\wt\1.146.0`。読むだけ）: `build/`、`build/azure-pipelines/`（本家の CI がどの OS で Windows 版を作るか）、`package.json`、ネイティブの依存
- この PC: Windows 11 Pro、Docker Desktop 29.5.3（いまは Linux コンテナ。WSL2）

## やること（出典と取得日つき。推定は推定と書く）

1. **Linux で Windows 版を作れるか。**
   - 本家の CI（`build/azure-pipelines/`）と VSCodium の CI は、Windows 版をどの OS で作っているか。
   - 1.146.0 のネイティブの依存（`node-pty`、`@vscode/windows-*`、`@parcel/watcher`、`native-keymap`、`kerberos` など）を一覧にする。それぞれに win32-x64 の配布済みの実行形式（prebuild）があるか、Linux から取れるか、MSVC で作る必要があるかを調べる。
   - gulp の `vscode-win32-x64-min` が Linux で動くか（Electron の Windows 版の取得、rcedit などの Windows の道具が要るか、wine が要るか）。
   - 結論を「作れる / 条件つきで作れる（何が要るか）/ 作れない」で書く。
2. **Windows コンテナの条件。**
   - Windows 11 Pro の上で Windows コンテナ（Server Core など）を使うときのライセンスの条件。
   - Visual Studio Build Tools をコンテナに入れて使うときのライセンスの条件（オープンソースのビルド）。
   - Docker Desktop の Windows コンテナの要件: Windows の機能、Hyper-V の分離、Linux コンテナとの切り替えの影響、同時に使えるか。
   - 土台のイメージと道具を入れたときの大きさの見込み、初回の用意の時間の見込み。
3. **ほかの案の事実**（あれば）。GitHub Actions の Windows の実行環境など、PC の外で作る案。外に出すものは、ユーザーの裁定（Windows 専用、利用者は1人、秘密を外に出さない）に照らして書く。

## 守ること

- 調べと読むことだけ。何も入れない。Docker の設定を変えない。コンテナを起動しない。
- 書き込みは `tasks/` だけ。

## 完了条件

- 1〜3 に、出典か読んだソースの場所がある。

## 成果物

このディレクトリに保存する。

- `build-env-options.md`: 1〜3 の結果と、案ごとの得失の表（推奨を付ける。決めるのはユーザー）。
- `handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

リーダーが結果を添えてユーザーに諮る。

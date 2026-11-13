# Phase 4 の準備: 設定の同期の組み込み拡張 notion-sync

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。設定を Notion のページで複数の PC にそろえる自前の組み込み拡張を作る。

## 入力

- docs/05 の全体（1 方針、2 同期するもの・しないもの、3 ページの形、4 いつ取り込み・書き出すか、5 PC ごとの設定、6 競合の扱い、7 資格情報、8 API の使い方、9 拡張の設計の大枠）
- docs/05 の2節の注意（`claudeCode.environmentVariables` をユーザー設定に書くと mydist の既定の配列が丸ごと置き換わる）
- docs/02 の2節（`extensions-src/notion-sync/` でビルドして `dist/` を作る）・4.1（自前の組み込み拡張の入れ方）
- `extensions-src/mydist/`（形の参考）

## やること

1. `extensions-src/notion-sync/`: `package.json`（`onStartupFinished`、`main: dist/extension.js`、設定 `notionSync.pageId`・`notionSync.ignoredSettings`・`notionSync.enabled`、コマンド5つ）、ソース、esbuild で1ファイルにまとめる build の script。
2. Notion の API の呼び出しを差し替えられる形にし、docs/05 の9節のテストの対象（競合の3通り、2000 文字の境目での分割、ignoredSettings の保ち方）を、単体で試せるように純粋な部品に分ける。
3. 依存の導入とビルド（`pnpm --dir extensions-src/notion-sync install`、`... run build`）を試す。この拡張のビルドは本体の道具（Build Tools）を要らない見込み。今の Node.js（24.16）で動くかを書く。
4. 本物の Notion には書かない（トークンもページもまだ無い）。差し替えた API で、取り込み・書き出し・競合の流れを試す。

## 守ること

- 書き込みは `extensions-src/notion-sync/`・`tasks/`・`C:\b\` だけ。ほかの蒙恬が並行して `scripts/take-in.mjs` など（p3-take-in）と `tools/watch/`・`scripts/lib/read-secret.ps1`（p4-watch）を作る。それらを書かない。
- 依存を足すときは、版を固定し、install スクリプトを走らせない形にする（ルートの `pnpm-workspace.yaml` の扱いにならう）。足した依存の名前と理由を書く。
- トークンは拡張の SecretStorage に置く（docs/05 の7節）。ログや設定に書かない。

## 完了条件

- 1・2 があり、3 のビルドが通るか、通らない理由がある。4 の試しの記録がある。

## 成果物

このディレクトリに保存する。

- `notion-sync-design.md`: 部品と関数の入出力（テストの入口）、ページの形の例、依存の一覧。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

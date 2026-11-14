# build.mjs の直し: 出力の product.json に commit を入れる

- 担当: meng-tian（蒙恬）。テストは cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

A-1 を当てたビルドのスモークが不合格だった（`tasks/2026-11-14-p1-smoke-built/handoff-notes.md`、`records/phase1/smoke-built-1.146.0-p1-a1.md`）。作業ツリーの `.git` はファイル（`gitdir: ...`）なので、本家の `build/lib/git.ts` が HEAD を読めない。そのため出力の product.json に `commit` が入らない。`commit` が無いと `isBuilt` が false になり、`node_modules.asar` を使わずに xterm が読めず、ターミナル・タスク・PowerShell のセッションが落ちる。言語パックも使われない。

リーダーの判断: 入れる値は**作業ツリーの HEAD**（単位を当てた後の commit。実際にビルドしたソース）。本家の commit は `upstream.json` と記録に別に残る。

## やること（蒙恬）

1. `scripts/build.mjs`: gulp の手順（型検査・パッケージ化。本家が commit を読むすべての手順）の子のプロセスに、`BUILD_SOURCEVERSION=<作業ツリーの HEAD の40桁>` を渡す。HEAD の読み方は既存の部品（`scripts/lib/apply/git.mjs` など）にならう。ビルドの記録（`build-record`）に、渡した値を残す。
2. 後処理の確かめ（docs/02 の4節の7）に、出力の `resources\app\product.json` の `commit` が40桁で、渡した値と一致することを足す。一致しなければ失敗にする。
3. 気づいた点（`tasks/2026-11-14-p1-verify-a1/handoff-notes.md` の1）: `--from install` のときも `build-record` の `units` を `checks.json` から埋める。
4. A-1 だけを当てた版を作り直す（label 例 `1.146.0-p1-a1-r3`。前回と同じ当て方）。zip を `C:\b\dist\` に置き、product.json の `commit` を確かめる。
5. `tests/` の既存のテストに合わせ、入口（関数の名前・引数・記録のキー）を handoff-notes.md の「テストの入口（曹参へ）」に書く。

終わったら、同じ蒙恬が `tasks/2026-11-14-p2-builds/brief.md` に進む（直した build.mjs で）。

## やること（曹参）

1. `build.mjs` の直しの単体テスト: 子のプロセスの環境に `BUILD_SOURCEVERSION` が渡ること、後処理の確かめが `commit` の欠け・食い違いで失敗すること、`--from install` で `units` が埋まること。蒙恬の入口が決まる前は、docs/02 の4節とこの brief から書き、入口が決まったら合わせる。
2. `node tests/run-all.mjs` の件数を書く。

## 守ること

- 書き込みは、蒙恬が `scripts/`・`tasks/`・`C:\b\`、曹参が `tests/`・`tasks/`。
- 本家のコードは変えない（環境変数で渡す）。

## 完了条件

- 直しとテストがあり、作り直した zip の product.json に `commit` がある。

## 成果物

- このディレクトリに `handoff-notes-meng-tian.md`、`handoff-notes-cao-shen.md`、`build-log.md`

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 直しの検証と、作り直した zip でのスモークのやり直し。

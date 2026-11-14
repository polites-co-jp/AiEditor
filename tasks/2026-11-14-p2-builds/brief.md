# Phase 2: 上書き・mydist の土台のビルドと、A-1〜B-7 を1単位ずつ足した版のビルド

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

docs/07 の5節の2〜3。単位を1つも有効にしない土台の版（上書き・patches・assets・mydist・notion-sync）をビルドし、そこに A-1 から B-7 を順に1単位ずつ足した版を、それぞれ zip にする。各版の関門（docs/03 の7節の 3・4。消えている・壊れていない）は大岡越前守が zip を受け取って並行して確かめる。蒙恬は次の版のビルドへ進んでよい。

## 入力

- docs/07 の5節、docs/03 の5節（当て方）・6節（検査）・7節（関門）、docs/02 の4節
- `records/phase1/gate-1.146.0-p1-a1.md`、`tasks/2026-11-14-p1-build-a1/`（A-1 だけのビルドの形と所要時間）
- `tasks/2026-11-14-notion-sync-deps/handoff-notes.md`（notion-sync の `dependencies` を直した。土台の版で通るかを確かめる）
- `removals/A-*`・`B-*`、`product.overlay.json`、`patches/`、`assets/`、`extensions-src/`
- `scripts/apply.mjs`（`--only`・`--until`）、`scripts/build.mjs`

## やること

1. **土台の版（label 例 `1.146.0-p2-base`）**: 単位を当てずに、上書き・patches・assets・mydist・notion-sync を当ててビルドし、zip にする。
   - 注意: 1.146.0 は copilot の不具合で、A-1 が無いとパッケージ化で落ちる（裁定 2026-11-14）。土台の版が落ちたら、A-1 を含めた版（`--only A-1-copilot-extension`）を土台とし、そのことを記録する。
2. **単位を足した版**: A-1 → A-2 → … → B-7 の順に、前の版までの単位に1つを足した版をビルドする（`--until <id>` などの台本の形で。`unit.json` の `enabled` は書き換えない。有効にするのは関門の後）。label は `1.146.0-p2-<id の頭>`（例 `1.146.0-p2-A-2`）。版ごとに zip を `C:\b\dist\` に残す。
   - 当てる・型検査・ビルドのどこかで落ちたら、その単位を外した版で続け、落ちた単位の誤りの要点と直し方の案を書く。単位の中身を直すのが小さく確かなら直してよい（`removals/<id>/` の中だけ。直した点を書く）。
3. **版ごとに記録する**: `apply.mjs` の `checks.json`（当てた結果、`absentStrings` などの検査）、`build.mjs` の記録（手順ごとの秒・ディスク・zip の SHA-256）、落ちた点。一覧を `builds.md` にまとめる（版・当てた単位・結果・zip のパス・SHA-256）。
4. 版が1つできるごとに、`builds.md` に行を足す（検証役がそれを見て関門を進める）。

## 守ること

- 書き込みは `scripts/`・`removals/`（直すときだけ。`enabled` は書き換えない）・`tasks/`・`C:\b\` だけ。
- gulp の出力 `C:\b\wt\VSCode-win32-x64\` は版ごとに上書きされる。検証役は zip を展開したものを使うので、zip を消さない。
- 本家のタグの作業ツリー `C:\b\wt\1.146.0` を書き換えない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは走らせず、何のために何が要るかを書く。

## 完了条件

- 土台の版と、A-1〜B-7 の各版の zip（または落ちた理由）があり、`builds.md` に一覧がある。

## 成果物

このディレクトリに保存する。

- `builds.md`、`build-log.md`、版ごとの記録（`<label>/` の下）、`handoff-notes.md`（報告）

## 結果

採用。単位なしの土台はパッケージ化で落ち（copilot）、A-1 の版を土台とした。A-1〜B-7 の14版が zip まで通り、`C:\b\p2\<label>\` に展開して起動した。組み込み拡張は 91 から 65 に、zip は 405 MB から 373 MB に減った。

## 未解決

- B-1 の不合格の直しと B-1〜B-7 の作り直し（`tasks/2026-11-14-fix-b1-and-build/`）。
- C: の空き（約 39 GB）。関門の済んだ版の片づけ。
- 版の commit に枝を付ける（同じ依頼）。

## 次の担当

ooka-echizen（大岡越前守）: 版ごとの関門（`tasks/2026-11-14-p2-gates/`）。

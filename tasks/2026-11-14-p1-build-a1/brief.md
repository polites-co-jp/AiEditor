# Phase 1 の続き: p1-ci-events の直しと、A-1 を当てた本家 1.146.0 のビルド

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

本家 1.146.0 は copilot の不具合で、無改造では zip まで行かない。ユーザーの裁定（2026-11-14「Phase 1 のビルドの関門」）で、Phase 1 の関門を A-1 の単位と合わせて満たす。あわせて、検証で不合格になった台本を直す。

## 入力

- `docs/user-decisions.md` の 2026-11-14「Phase 1 のビルドの関門」、`docs/07-phases.md` の4節（1.146.0 での扱い）
- `tasks/2026-11-14-p1-verify-partial/handoff-notes.md`（直す必要のあるもの）
- `tasks/2026-11-13-p1-build-upstream/`（前回のビルドの記録と handoff-notes.md）
- `removals/A-1-*`（unit.json、README.md、edits.patch）、docs/03 の5節（当て方）・7節（関門）
- `scripts/apply.mjs`、`scripts/build.mjs`

## やること

1. **直し**
   - `scripts/p1-ci-events.ps1` の54行: 例外の文言でなく、`$_.FullyQualifiedErrorId` が `NoMatchingEventsFound` で始まるかで見分ける。`node --test tests/p1-scripts.test.mjs` で、落ちていた1件が通ることを確かめる。
   - `tasks/2026-11-13-p1-build-upstream/doc-corrections.md` の A8 に、docs/02 の6節（「署名はしない。…SmartScreen は出にくい（推定）」）を足す。Smart App Control がオンだと成り立たない。
2. **A-1 を当てたビルド**
   - 新しい作業ツリー（例 `C:\b\wt\p1-a1`。タグ 1.146.0）に、`apply.mjs` で A-1 だけを当てる（`unit.json` の `enabled` は書き換えず、`--only` などの台本の形を使う）。
   - `build.mjs` で、依存の導入 → 型検査 → `vscode-win32-x64-min` → zip まで進める。所要時間・ディスク・出力の場所を記録する。
   - 作業ツリー `C:\b\wt\1.146.0` は書き換えない。gulp の出力 `C:\b\wt\VSCode-win32-x64\` は作業ツリーによらず同じ場所なので、前回の出力は上書きされる（ほかにビルドは走っていない）。
3. **起動の確かめ**: Smart App Control の扱いは未決（蒙恬の別の調べ `tasks/2026-11-14-sac-override-research/`）。zip ができたら、`p1-launch-check.ps1 -Zip` で1回だけ起動を試し、止められたかを記録する。PC の設定は変えない。
4. 失敗したら、誤りの要点を残して止める。許可に無いコマンドが要るときは走らせず、「何のために何が要るか」を報告する。

## 守ること

- 書き込みは `scripts/`・`tasks/`・`C:\b\` だけ。`removals/` の unit.json の `enabled` は書き換えない（単位の関門は検証の後）。
- 普段使いのエディタのデータに触れない。起動は `VSCODE_PORTABLE` で分け、子のプロセスから `ELECTRON_RUN_AS_NODE` などを外す。

## 完了条件

- 1 の直しが済み、テストが通る。
- 2 の zip（またはできなかった理由）と記録がある。3 の結果がある。

## 成果物

このディレクトリに保存する。

- `build-log.md`、`handoff-notes.md`（報告。検証役への入口を含む）

## 結果

採用。A-1 を当てた 1.146.0 が zip まで通り、起動した（約 6.8 分、C: の空きの減り 2.3 GB）。`p1-ci-events.ps1` の直しも合格。検証: `tasks/2026-11-14-p1-verify-a1/`。

## 未解決

- notion-sync の `dependencies`（`tasks/2026-11-14-notion-sync-deps/` で直した。本ビルドで確かめる）。
- `build-record` の `units` が `--from install` のとき空（気づいた点）。

## 次の担当

ooka-echizen（大岡越前守）: 直しとビルドを検証する。

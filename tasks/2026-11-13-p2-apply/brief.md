# Phase 2: 適用の台本 apply.mjs（上書き・削除の単位・パッチ・適用後の検査）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで機能の削除を実装する。その中心の `scripts/apply.mjs` を作る。ビルドの道具がそろう前でも、作業ツリーへの適用と適用後の検査はできるので、先に作る。

## 入力

- docs/03 の3節（unit.json の形）・5節（当て方。順序、ops と edits の2つのコミット、rerere）・6節（適用後の検査と `checks.json`）・9節
- docs/02 の2節（フォルダの構成）・3節（product.overlay.json の `set` と `remove`。`shukoConfigurationDefaults`、「本家が足したら remove」の行、remove のキーが本家に無いときの警告）・4節の2・3
- docs/06 の4節の4（適用後の検査に足すもの: overlay のキーと mydist の既定のキーが新しい版でも登録されているか、`.nvmrc` と Electron の版の変化）
- 作業ツリー: `C:\b\wt\1.146.0`（本家のタグ。読むだけ）。試しの作業ツリーは `git -C C:/b/vscode worktree add C:/b/wt/<名前> 1.146.0` で別に作る（例 `C:\b\wt\dev-apply`）

## やること

1. `scripts/apply.mjs` を作る。
   - 引数: 作業ツリーのパス、`--label`、`--only <id,...>`（試し用）、`--dry-run`、`--checks-out <path>`（既定 `records/take-in/<label>/checks.json`）。
   - 順序: docs/03 の5.1 のとおり。product.json の上書き → `enabled: true` の単位を `order` 順に → `patches/` を番号順に → `assets/` の写し → `extensions-src/mydist`（と、あれば `notion-sync` の dist）を作業ツリーの `extensions/` に写す。
   - `removeLines` の規則（前後の空白を除いて完全に一致、ちょうど1行。`count`）。`delete` のパスが本家に無ければ警告する。
   - 単位ごとに `unit <id>: ops` と `unit <id>: edits` のコミット。`git am -3`、rerere。
2. 適用後の検査（docs/03 の6節と docs/06 の4節の4）を実装し、`checks.json` を書く。
   - 前のタグとの比べ（本家が足した部品）は、前のタグを引数で渡す形にする（`--prev-tag`）。
   - ロックファイルの検査（5.4）は、依存の導入の後に走るので、`build.mjs` から呼べる関数にしておく（今は単体で試せる範囲まで）。
3. 部品は `scripts/lib/apply/` に置き、純粋な関数（`removeLines` の照合、overlay の適用、単位の並べ替えと `after` の検査、未分類の組み込み拡張の検出、名前の目立たせ）を `export` する。曹参が同じ仕様からテストを書くので、関数の名前と入出力を `apply-design.md` に書く。
4. 試し: 削除の単位がまだ無いので、`removals/` に試し用の単位を置かずに、`--only` と試しのフォルダ（`tasks/2026-11-13-p2-apply/fixtures/` に小さな unit.json を置く）で、作業ツリー `C:\b\wt\dev-apply` に当てて確かめる。

## 守ること

- 書き込みは自分の書き込み先だけ。ほかの蒙恬が並行して `removals/A-*`・`builtin/keep.json`（タスク p2-units-a）、`removals/B-*`・`patches/`・`product.overlay.json`・`assets/`（p2-units-b）、`scripts/build.mjs`・`install-extensions.mjs`・`configure.ps1`・`switch.ps1`・`scripts/lib/local-config.*`（p2-build-switch）を作る。それらのファイルを書かない（読むのはよい）。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない（ユーザーの道具の導入待ち）。
- 許可に無いコマンドが要るときは、走らせずに報告する。

## 完了条件

- `apply.mjs` と部品があり、`node --check` が通る。試しの作業ツリーで、試しの単位の ops・edits のコミットと `checks.json` ができた記録がある。

## 成果物

このディレクトリに保存する。

- `apply-design.md`: 引数、関数の名前と入出力（テストの入口）、`checks.json` の形。
- `trial-log.md`: 試しの記録。
- `doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

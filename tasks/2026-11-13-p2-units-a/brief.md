# Phase 2: 段階 A の削除の単位（A-1〜A-7）と builtin/keep.json

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで機能の削除を実装する。段階 A（組み込み拡張）の単位を作る。

## 入力

- docs/03 の2節（原則）、3節（unit.json と README.md の形）、4節の段階 A の表と「残す組み込み拡張」、5.3（単位どうしを独立に保つ規則）、9節（Claude Code が依存する部分）
- docs/01（残す機能）、docs/04 の6節（mydist）、`records/phase0/claude-code-manifest.md`
- Phase 0 で分かったこと: `tasks/2026-11-13-p0-close/design-changes.md`、蒙恬の `tasks/2026-11-13-p0-envs-mydist-keys/doc-corrections.md` の3（分類の無い組み込み拡張: `jsts-chat-features`・`prompt-basics`・`theme-modern-icons`・`media-preview`）
- 作業ツリー: `C:\b\wt\1.146.0`（読むだけ）。パッチを作る作業ツリーは `git -C C:/b/vscode worktree add C:/b/wt/dev-a 1.146.0` で別に作る

## やること

1. `builtin/keep.json` を作る: タグ 1.146.0 の `extensions/*` をすべて、`keep.json`（残す。理由つき）か段階 A の単位のどちらかに振り分ける。文法だけの拡張も載せる。どちらにも入れられないものは、推奨つきで報告する。
2. `removals/A-1-copilot-extension/` 〜 `removals/A-7-unused-extensions/` を作る。各単位に `unit.json`（`enabled: false`、`order` は 100 台）、`README.md`、要れば `edits.patch`。
   - `delete`・`removeLines`（`build/npm/dirs.ts`、`build/lib/extensions.ts` などの一覧の要素）・`removeDependencies`・`productRemove`・`checks`（`absentCommands` など。分かる範囲）・`smoke` を書く。
   - A-1 は VSCodium の patch 52・53 を参考にする（docs/03 の表）。`jsts-chat-features`・`prompt-basics` を足すかは中身を見て決め、理由を README に書く。A-6 に `theme-modern-icons` を入れる。
   - 残るファイルへの変更が要るなら `edits.patch` にする（docs/03 の5.2）。ただし、型検査とビルドはまだ走らせられない。参照の残りは `grep` で見つけ、型検査で確かめる点を README の「未確認」に書く。
3. 作った単位を、`dev-a` の作業ツリーで手で当てられるか確かめる（`apply.mjs` は別の蒙恬が並行して作っているので、出来ていれば `--only` で使い、無ければ手順を `trial-log.md` に書いて手で確かめる）。

## 守ること

- 書き込みは自分の書き込み先の中の `removals/A-*`、`builtin/keep.json`、`tasks/`、`C:\b\wt\dev-a` だけ。ほかの蒙恬が並行して `scripts/apply.mjs`・`scripts/lib/apply/`（p2-apply）、`removals/B-*`・`patches/`・`product.overlay.json`・`assets/`（p2-units-b）、`scripts/build.mjs` など（p2-build-switch）を作る。それらを書かない。
- Claude Code が使う受け手（docs/03 の9節）を消さない。消すか迷うものは消さずに報告する。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない。

## 完了条件

- `builtin/keep.json` と A-1〜A-7 の単位があり、本家 1.146.0 の `extensions/*` に未分類が無い（あれば報告にある）。各単位に、作業ツリーで当てた（または当て方を確かめた）記録がある。

## 成果物

このディレクトリに保存する。

- `units-a-notes.md`: 単位ごとの中身と根拠、未確認の点。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

採用。A-1〜A-7 と `builtin/keep.json`（本家の拡張95件を残す67・消す28に振り分け、未分類0）。検証で合格。

## 未解決

- 型検査・ビルド・関門は道具の導入の後。

## 次の担当

ooka-echizen（大岡越前守）: 検証する。ビルドの道具がそろったら、単位ごとに関門（docs/03 の7節）を通す。

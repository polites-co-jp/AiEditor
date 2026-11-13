# Phase 5 の下準備: 段階 C の削除の単位（C-1〜C-7）の ops の部分と、型検査で直す点の一覧

- 担当: meng-tian（蒙恬）。2人で分ける。1人目は C-1・C-2、2人目は C-3〜C-7
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。段階 C の単位は、型検査の誤りを手がかりに直しを詰めるので、ビルドの道具がそろってから仕上げる。ここでは道具がそろう前にできる部分を先に作る。

## 入力

- docs/03 の2節（原則）、3節（unit.json の形）、4節の段階 C の表、5節（当て方。5.3 の単位どうしを独立に保つ規則、sessions の main と `workbench.web.main.ts` の import）、6節、9節（Claude Code が使う受け手を消さない）
- docs/02 の3節（product.json の上書き。C-1 の時期に remove するキー、C-3 の server*・tunnel* など）
- `records/phase0/claude-code-manifest.md`（Claude Code が使う受け手）
- 段階 A・B の単位（`removals/A-*`・`B-*`）の作り方。とくに、残る部品が消した部品のサービスを注入しているときに、ID を残して何もしない実装を登録する形（B-1〜B-3 の README）
- 作業ツリー: `C:\b\wt\1.146.0` は読むだけ。試しの作業ツリーは `git -C C:/b/vscode worktree add C:/b/wt/dev-c<n> 1.146.0` で別に作る

## やること（各単位）

1. `removals/<id>/unit.json`（`enabled: false`、`order` は 300 台、`after`）と `README.md` を作る。
   - `delete`・`removeLines`（`workbench.*.main.ts`・`sessions.*.main.ts`・一覧の要素）・`removeDependencies`・`productRemove`・`kept`・`checks`・`smoke` を書く。
2. 消す部品への参照の残りを `grep` で洗い出し、`README.md` の「型検査で直す点」に、ファイルと行と直し方の見込みを並べる。
   - 拡張 API の空の実装（`vscode.lm`・`vscode.chat`・`vscode.debug`・`vscode.notebooks` など）は、単位ごとの新しいファイルに置く方針（5.3）で、置き場所と形の見込みを書く。
3. 当て方の試し: A＋B を当てた後に、その単位の ops（`delete`・`removeLines`）を `apply.mjs --only` で当て、ops が当たることと `absentStrings` の残りの数を記録する。`edits.patch` は、型検査が走らせられるようになってから作る。今は作らない。
4. Claude Code が使う受け手（docs/03 の9節）に触れる部品は消さない。消すか迷うものは消さずに報告する。

## 守ること

- 書き込みは `removals/C-*`・`tasks/`・`C:\b\wt\dev-c<n>` だけ。2人で単位を分け、相手の単位のフォルダを書かない。`scripts/`・`removals/A-*`・`B-*` は書かない（直しが要れば報告する）。
- `C:\b\wt\1.146.0`・`C:\b\wt\verify-p2` を書き換えない。依存の導入とビルドは走らせない。

## 完了条件

- 担当の単位の `unit.json` と `README.md` があり、ops が当たる記録と「型検査で直す点」の一覧がある。

## 成果物

このディレクトリに保存する。

- `units-c-notes-<担当の範囲>.md`（例 `units-c-notes-c1-c2.md`）: 単位ごとの中身・根拠・未確認の点。
- `trial-log-<担当の範囲>.md`、`handoff-notes-<担当の範囲>.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 下準備の検証。ビルドの道具がそろったら、蒙恬が型検査で edits.patch を作り、関門を通す。

# Phase 5 の下準備の検証: 段階 C の単位（C-1〜C-7）の ops と「型検査で直す点」

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

蒙恬2人が作った段階 C の単位の下準備（`unit.json`・`README.md`。`edits.patch` はまだ無い）を確かめ、合否を出す。単位を有効にする関門は、ビルドの道具がそろってからなので対象外。

## 入力

- `tasks/2026-11-14-p5-units-c-prep/`（brief.md、handoff-notes-c1-c2.md、handoff-notes-c3-c7.md、units-c-notes-*.md、trial-log-*.md、trial-c1c2/、trial-c3c7/）
- `removals/C-1-ai/` 〜 `removals/C-7-breadcrumbs-outline/`
- docs/03 の3節・4節（今日、段階 C の表から変えた点を書いた）・5.3・9節、docs/02 の3節、`records/phase0/claude-code-manifest.md`
- 試しの作業ツリー `C:\b\wt\dev-c1`・`C:\b\wt\dev-c3`（蒙恬が残した。読むだけ）

## やること

1. レビュー（コードは直さない）。
   - 単位の形が docs/03 の3.1 のとおりか。`order`（310〜370）、`after` の連なり、`enabled: false`。
   - Claude Code が使う受け手（docs/03 の9節。Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼、コメント、差分エディタ、拡張のファイルシステムの提供者、メニューの場所）を消していないか。
   - 消す範囲が裁定（AI・デバッガ・リモート・ノートブック・ギャラリー・設定の同期・パンくずとアウトライン）に合い、残す判断の根拠が README にあるか。
   - 「型検査で直す点」の一覧が、`grep` の結果で支えられるか（抜き取りでよい）。
2. 実行。
   - `node tests/run-all.mjs`。`tests/removals.test.mjs` が C の単位の形も検査するはず。件数を記録する。
   - 新しい作業ツリーが要るなら `C:\b\wt\verify-p2` を使う（今は A＋B を当てた状態）。そこへ C-1〜C-7 の ops を当てる試しをする。`edits.patch` が無い単位は、蒙恬の試しの形（`--removals` に写し、`--patches` に空のフォルダ）にならう。
3. 確かめた版の SHA-256 を記録する。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない。

## 完了条件

- 1〜3 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

合格なら、リーダーがコミットする。ビルドの道具がそろったら、蒙恬が型検査で edits.patch を作る。

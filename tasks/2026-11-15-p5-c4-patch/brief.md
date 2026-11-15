# Phase 5 の下ごしらえ: C-4（ノートブック）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、段階 C を1単位ずつ下ごしらえする。C-1 は合格、C-2・C-3 は edits.patch ができた。次の C-4 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` で作る。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 入力

- `removals/C-4-notebook/`（unit.json、README の「消すもの」「残すもの」「型検査で直す点」「別案」）。別案の1・2は採らない（README の今の案: `contrib/notebook/common` と `services/notebook` を残し、検索のノートブックの部品のフォルダを消して `FileMatchImpl` で作る。docs/03 の4節の末尾）
- docs/03 の3節・4節（C-4 の行と末尾。**全文検索がノートブックと結びついている。検索は裁定で残す**）・5.1・5.3（2026-11-15 に足した例外を含む）・5.4・9節
- `records/phase0/claude-code-manifest.md`、docs/04 の台帳の拡張（言語サーバーの拡張がノートブックのイベントを購読する見込み）
- C-1〜C-3 の作り方: `tasks/2026-11-15-p5-c{1,2,3}-patch/` の handoff-notes と typecheck-log
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`node_modules` は消さない）、A・B の14単位と C-1・C-2・C-4 を `apply.mjs --only` で当てる（C-4 の `after` は A-4・B-4・C-1・C-2）。
2. **型検査で直す**: 誤りを直し、`format-patch` で `removals/C-4-notebook/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。
   - 拡張 API の `vscode.notebooks`・`workspace.notebookDocuments`・ノートブックのイベントなどは、新しいファイル `api/common/extHostRemovedApi.notebook.ts` に何もしない実装を置く（空の配列、`Event.None`、何もしない Disposable）。台帳の拡張と Claude Code が呼んでも誤りを投げないこと。
   - **全文検索（テキスト検索・ファイル検索・検索のビュー・置換）を壊さない**。検索の部品の直しは、ノートブックへの参照を外すだけにする。
   - 消すか迷うものは消さずに README に書く。2026-11-14 の規則に当てはめる。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組。どちらも `--lockfile-check` 付き。終わったらロックファイルを戻す）:
   - a. タグから A・B の14と C-1・C-2・C-4（17単位）。
   - b. タグから A・B の14と C-1・C-2・C-3・C-4（18単位）。C-3 とパッチの文脈が重ならないこと（重なるなら `removeLines` に回す。docs/03 の5.3）。
   - 3-way に頼らず当たるか（`git apply --check`）も、C-2・C-3 と同じく確かめる。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧、検索への影響、Claude Code と台帳の拡張への影響を書く。
7. **終わったら `C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**。

## 守ること

- 書き込みは `removals/C-4-notebook/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。ほかの単位の `removals/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らない。

## 完了条件

- `removals/C-4-notebook/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、検索・Claude Code・台帳の拡張への影響、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-4 の検査とテスト。ooka-echizen（大岡越前守）: 検証。

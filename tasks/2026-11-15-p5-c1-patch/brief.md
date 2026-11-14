# Phase 5 の下ごしらえ: C-1（本家の AI）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md`）で、古い版の片づけの許可を待つ間に段階 C の下ごしらえを始める。使い終わった作業ツリー `C:\b\wt\p2`（依存が入っている）を使い回し、ディスクをほとんど増やさずに、C-1 の `edits.patch` を型検査の誤りを手がかりに作る。ビルド・起動の確かめ・関門は、片づけの許可が入ってから行う。

## 入力

- `removals/C-1-ai/`（unit.json の ops、README の「消すもの」「残すもの」「型検査で直す点」の一覧）
- docs/03 の3節（unit.json の形）・4節の段階 C の表と末尾・5節（5.1 当て方、5.3 単位どうしを独立に保つ規則、拡張 API の何もしない実装を単位ごとの新しいファイルに置く形）・9節（Claude Code が使う受け手を消さない）
- `records/phase0/claude-code-manifest.md`（Claude Code が使う受け手と API）
- 段階 A・B の形: `removals/B-1-telemetry/`（残る部品が呼ぶコマンドを何もしない形で残した例）、`removals/B-2-*`（何もしないサービスを `registerSingleton` で差し替えた例）
- `tasks/2026-11-14-p5-units-c-prep/`（下準備の記録）、`tasks/2026-11-14-p5-verify-c-prep/`（下準備の検証）
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（型検査の手順 `typecheck`。`--from`・`--to`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`git -C C:/b/wt/p2 checkout` と `clean` の許された形で。`node_modules` は消さない）、`apply.mjs` で有効な単位（A・B の14）と C-1 を当てる（`--only` に14単位と C-1）。
2. **型検査で直す**: `build.mjs --from typecheck --to typecheck`（または許可にある `npx --prefix C:/b/wt/p2 tsc --noEmit`）で誤りを出し、README の「型検査で直す点」を手がかりに直す。直しは作業ツリーで行い、`format-patch` で `removals/C-1-ai/edits.patch` に書き出す（B-1 の作り方にならう）。`unit.json` に `"patch": "edits.patch"` を足す。
   - 拡張 API（`vscode.lm`・`vscode.chat` など）は、README の1の表のとおり、新しいファイル `api/common/extHostRemovedApi.ai.ts` に何もしない実装を置く。Claude Code が使う API（`records/phase0/claude-code-manifest.md`）は、何もしない実装で壊れないか（例: 存在を確かめてから呼ぶか）を見て、README に書く。
   - Claude Code が使う受け手（docs/03 の9節）は消さない。消すか迷うものは消さずに README に書く。
3. **型検査が誤り 0 で通る**ことを確かめる。通らない誤りが残ったら、その一覧と、直せない理由を書いて止める。
4. **当て直しの確かめ**: タグに戻した素の作業ツリー（または同じ `C:\b\wt\p2` を戻して）で、A・B の14と C-1 を `apply.mjs` で当て直し、edits.patch が衝突なく当たり、型検査が通ることを確かめる。
5. **パッケージ化と zip はしない**（片づけの許可の後）。C: の空きを始めと終わりに記録する（`node scripts/disk-usage.mjs`）。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、型検査で直した点の一覧（ファイル・直し方）を書く。

## 守ること

- 書き込みは `removals/C-1-ai/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。
- `C:\b\p2\`・`C:\b\dist\` の既存の版を消さない、書き換えない。新しい作業ツリーを作らない（ディスクのため）。
- 本家のタグの作業ツリー `C:\b\wt\1.146.0` を書き換えない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。

## 完了条件

- `removals/C-1-ai/edits.patch` があり、A・B＋C-1 で型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、Claude Code の API への影響、テストの入口）、`typecheck-log.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-1 の検査（`tests/removals.test.mjs` など）。ooka-echizen（大岡越前守）: edits.patch の検証。片づけの許可の後、ビルドと関門。

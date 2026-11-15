# Phase 5 の下ごしらえ: C-2（デバッガ）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、C-1 から1単位ずつ edits.patch を作る。C-1 は「パッケージ化の前まで」合格した（`tasks/2026-11-15-p5-c1-verify/`）。次の C-2 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` を使い回し、型検査の誤りを手がかりに作る。ビルド・起動の確かめ・関門は、片づけの許可が入ってから行う。

## 入力

- `removals/C-2-debug/`（unit.json の ops、README の「消すもの」「残すもの」「型検査で直す点」「未決」。未決の1は 2026-11-14 に案A で決まった）
- docs/03 の3節・4節の段階 C の表と末尾（C-2 は `contrib/debug/common` と `extensionHostDebugService` を残し、本家の `NullDebugService` を登録する）・5.1・5.3・5.4・9節
- `records/phase0/claude-code-manifest.md`（Claude Code が使う API。`vscode.debug` を使うか）
- C-1 の作り方: `tasks/2026-11-15-p5-c1-patch/handoff-notes.md`・`typecheck-log.md`、`removals/C-1-ai/`（`api/common/extHostRemovedApi.ai.ts` の形、protocol の整理の仕方）
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`node_modules` は消さない）、A・B の14単位と C-2 を `apply.mjs --only` で当てる。C-2 は C-1 を前提にしない（`after` は A-3 だけ。docs/03 の4節の末尾）。
2. **型検査で直す**: 誤りを README の「型検査で直す点」を手がかりに直し、`format-patch` で `removals/C-2-debug/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。
   - 拡張 API の `vscode.debug` は、新しいファイル `api/common/extHostRemovedApi.debug.ts` に何もしない実装を置く。Claude Code と、台帳の拡張（docs/04。PowerShell 拡張など）が `vscode.debug` を呼んでも誤りを投げないこと。
   - 未決の2（`contrib/debug/common` の使われなくなるファイル）は、今は残す。
   - 消すか迷うものは消さずに README に書く。2026-11-14 の規則（消す部品だけが使うものは消す、残る部品が使うものは使い手を書いて残す）に当てはめる。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組）:
   - a. タグから A・B の14と C-2（15単位）。
   - b. タグから A・B の14と C-1 と C-2（16単位）。C-1 の後に C-2 が衝突なく当たり、型検査が誤り 0 で通ること。衝突するなら、C-2 の edits.patch を C-1 と独立に保つ形（docs/03 の5.3）を探し、無理なら理由を書く。
   - どちらも `--lockfile-check` を付ける（`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` の後。終わったらロックファイルを戻す）。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する（`node scripts/disk-usage.mjs`）。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧（ファイル・直し方）、Claude Code と台帳の拡張への影響を書く。
7. **終わったら、`C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**（大岡越前守が自分で当てる）。

## 守ること

- 書き込みは `removals/C-2-debug/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。`removals/C-1-ai/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らないよう気をつける。

## 完了条件

- `removals/C-2-debug/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、Claude Code と台帳の拡張の API への影響、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`（記録）。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-2 の検査とテスト。ooka-echizen（大岡越前守）: 検証。片づけの許可の後、ビルドと関門。

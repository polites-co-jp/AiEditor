# Phase 5 の下ごしらえ: C-3（リモート）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、段階 C を1単位ずつ下ごしらえする。C-1 は合格（`tasks/2026-11-15-p5-c1-verify/`）、C-2 は edits.patch ができてテストを書いているところ（`tasks/2026-11-15-p5-c2-*`）。次の C-3 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` で作る。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 入力

- `removals/C-3-remote/`（unit.json、README の「消すもの」「前提の単位」「残すもの」「型検査で直す点」「別案」）。別案の1・2は採らない（README の既定どおり、`services/tunnel`・`sharedProcessTunnelService`・`remoteExplorerService` と `remote/`・`src/vs/server` は残す。docs/03 の4節の末尾）
- docs/03 の3節・4節（C-3 の行と末尾）・5.1・5.3（2026-11-15 に足した2つの例外を含む）・5.4・9節（Claude Code の Webview のパネルが `services/tunnel` を注入する）
- `records/phase0/claude-code-manifest.md`
- C-1・C-2 の作り方: `tasks/2026-11-15-p5-c1-patch/`・`tasks/2026-11-15-p5-c2-patch/` の handoff-notes と typecheck-log
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`node_modules` は消さない）、A・B の14単位と C-1 と C-3 を `apply.mjs --only` で当てる（C-3 の `after` は A-5 と C-1）。
2. **型検査で直す**: 誤りを直し、`format-patch` で `removals/C-3-remote/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。拡張 API を何もしない実装にするときは `api/common/extHostRemovedApi.remote.ts` に置く（要るときだけ）。Claude Code の受け手（Webview・`services/tunnel`）は消さない。消すか迷うものは消さずに README に書く。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組。どちらも `--lockfile-check` 付き。終わったらロックファイルを戻す）:
   - a. タグから A・B の14と C-1 と C-3（16単位）。
   - b. タグから A・B の14と C-1・C-2・C-3（17単位）。C-2 と C-3 のパッチの文脈が重ならないこと（docs/03 の5.3。重なるなら `removeLines` に回す）。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧、Claude Code と台帳の拡張への影響を書く。
7. **終わったら `C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**。

## 守ること

- 書き込みは `removals/C-3-remote/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。`removals/C-1-ai/`・`removals/C-2-debug/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らない。

## 完了条件

- `removals/C-3-remote/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、Claude Code と台帳の拡張への影響、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-3 の検査とテスト。ooka-echizen（大岡越前守）: 検証。

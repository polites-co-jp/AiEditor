# Phase 5 の下ごしらえ: C-5（拡張のギャラリー）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、段階 C を1単位ずつ下ごしらえする。C-1 は合格、C-2〜C-4 は edits.patch ができた。次の C-5 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` で作る。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 入力

- `removals/C-5-extension-gallery/`（unit.json、README の「消すもの」「残すもの」「型検査で直す点」）
- docs/03 の3節・4節（C-5 の行。**残す: CLI の `--install-extension`、入っている拡張の一覧と有効・無効の切り替え、動作中の拡張の一覧**。`extensionGalleryService.ts` は何もしない実装に差し替え）・5.1・5.3・5.4・9節
- docs/04（台帳の拡張は `install-extensions.mjs` が CLI の `--install-extension <vsix>` で入れる。これが壊れないこと）
- `records/phase0/claude-code-manifest.md`
- C-1〜C-4 の作り方: `tasks/2026-11-15-p5-c{1,2,3,4}-patch/` の handoff-notes と typecheck-log
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`node_modules` は消さない）、A・B の14単位と C-1・C-5 を `apply.mjs --only` で当てる（C-5 の `after` は C-1）。
2. **型検査で直す**: 誤りを直し、`format-patch` で `removals/C-5-extension-gallery/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。
   - ギャラリーのサービスは、通信をしない何もしない実装に差し替える（ギャラリーへの通信が起きないこと。docs/01 の通信の裁定）。
   - **VSIX からの CLI の導入（`--install-extension <path>`）、拡張の一覧、有効・無効、アンインストール、動作中の拡張の一覧は残す**。これらがギャラリーのサービスを呼ぶ所は、ギャラリーが無くても誤りにならない形にする。
   - 拡張の自動更新・更新の確かめが、何もしない実装で止まる（通信しない）こと。
   - 消すか迷うものは消さずに README に書く。2026-11-14 の規則に当てはめる。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組。どちらも `--lockfile-check` 付き。終わったらロックファイルを戻す）:
   - a. タグから A・B の14と C-1・C-5（16単位）。
   - b. タグから A・B の14と C-1〜C-5（19単位）。ほかの単位とパッチの文脈が重ならないこと（重なるなら `removeLines` に回す。docs/03 の5.3）。3-way に頼らず当たるか（`git apply --check`）も確かめる。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧、拡張の導入（`install-extensions.mjs`）・Claude Code・台帳の拡張への影響を書く。
7. **終わったら `C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**。

## 守ること

- 書き込みは `removals/C-5-extension-gallery/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。ほかの単位の `removals/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らない。

## 完了条件

- `removals/C-5-extension-gallery/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、拡張の導入・Claude Code・台帳の拡張への影響、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-5 の検査とテスト。ooka-echizen（大岡越前守）: 検証。

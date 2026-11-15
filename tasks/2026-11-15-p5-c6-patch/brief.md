# Phase 5 の下ごしらえ: C-6（設定の同期）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、段階 C を1単位ずつ下ごしらえする。C-1〜C-3 は合格、C-4・C-5 は edits.patch ができて検証の前。次の C-6 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` で作る。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 入力

- `removals/C-6-settings-sync/`（unit.json、README の「消すもの」「残すもの」「型検査で直す点」「別案」）。**別案の1は採らない**（同期の状態のサービスと共有プロセスの同期のサービスは残す）。**別案の2（続きの編集 `contrib/editSessions`）は C-6 に入れない**（裁定に無い機能。扱いはリーダーがユーザーに諮る）
- docs/03 の3節・4節（C-6 の行と末尾。型検査に掛からず起動時に壊れる注入が2か所ある `IUserDataSyncWorkbenchService`）・5.1・5.3・5.4・9節。拡張 API の `vscode.authentication` は残す
- `records/phase0/claude-code-manifest.md`
- C-1〜C-5 の作り方: `tasks/2026-11-15-p5-c{1..5}-patch/` の handoff-notes と typecheck-log
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` はタグ 1.146.0 にある（違えば戻す。`node_modules` は消さない）。A・B の14単位と C-1・C-6 を `apply.mjs --only` で当てる（C-6 の `after` は C-1）。
2. **型検査で直す**: 誤りを直し、`format-patch` で `removals/C-6-settings-sync/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。
   - **型検査に掛からない注入**（`IUserDataSyncWorkbenchService` の2か所など）は、`@I...Service` と `registerSingleton` の対応を Grep で照らし、注入の外し損ねが無いことを確かめる（C-4 の handoff-notes の「注入の外し損ね」の形）。外し損ねがあれば、何もしない実装か、注入を外す直しを入れる。
   - 同期の画面・コマンド・アカウントのメニューの同期の項目を消し、プロファイル・設定・拡張の管理は壊さない。
   - 消すか迷うものは消さずに README に書く。2026-11-14 の規則に当てはめる。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組。どちらも `--lockfile-check` 付き。終わったらロックファイルを戻す）:
   - a. タグから A・B の14と C-1・C-6（16単位）。
   - b. タグから A・B の14と C-1〜C-6（20単位）。ほかの単位とパッチの文脈が重ならないこと（重なるなら `removeLines` に回す）。3-way に頼らず当たるか（`git apply --check`）も確かめる。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧、注入の照らしの結果、Claude Code と台帳の拡張への影響を書く。
7. **終わったら `C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**。

## 守ること

- 書き込みは `removals/C-6-settings-sync/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。ほかの単位の `removals/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らない。

## 完了条件

- `removals/C-6-settings-sync/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、注入の照らし、Claude Code と台帳の拡張への影響、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

cao-shen（曹参）: C-6 の検査とテスト。ooka-echizen（大岡越前守）: 検証。

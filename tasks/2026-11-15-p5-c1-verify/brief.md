# 検証: C-1（本家の AI）の edits.patch と検査・テスト（関門の前）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が C-1 の `edits.patch` を作り（`tasks/2026-11-15-p5-c1-patch/`。1〜4回目）、曹参が検査とテストを書いた（`tasks/2026-11-15-p5-c1-tests/`。1〜3回目）。片づけの許可を待つ間、パッケージ化の前までを確かめる。ビルド・起動・関門（docs/03 の7節の2の後半〜4）は、片づけの許可の後に別に行う。

## 入力

- docs/03 の3節・4節（段階 C の表と末尾の箇条書き）・5.1・5.3・5.4・9節、docs/user-decisions.md の C-1 の項（2026-11-14、2026-11-15 の2つの「C-1 の edits.patch を作るときに出た点」）
- `removals/C-1-ai/`（unit.json、README、edits.patch）
- `scripts/lib/apply/lockfile.mjs`・`scripts/lib/apply/checks.mjs`（3回目の直し）
- 蒙恬の `handoff-notes.md`（1〜4回目）・`typecheck-log.md`・`trial/`
- 曹参の `handoff-notes.md`（1〜3回目）、`tests/c1-unit.test.mjs`・`tests/c1-round2.test.mjs`・`tests/c1-check-json.test.mjs`・`tests/lockfile-patched.test.mjs`、`tests/removals/c1-check-json.mjs`・`c1-check-worktree.mjs`・`c1-gate-script.md`

## やること

1. **差分のレビュー**: edits.patch・unit.json・lockfile.mjs・checks.mjs を読み、次を確かめる。
   - 裁定と docs/03 のとおりか（消すもの・残すもの）
   - Claude Code が使う受け手を消していないか（docs/03 の9節、`records/phase0/claude-code-manifest.md`）
   - 拡張 API の何もしない実装が、安定版の API を呼んでも誤りを投げないか
   - 提案中の API の門が残っているか
   - `compareLockfile` の緩めた条件が、宣言したパッチの名前だけに限られているか
2. **当て直しと型検査を自分で走らせる**: 曹参の台本 `tests/removals/c1-gate-script.md` の1〜3（1b・1c を含む）を `C:\b\wt\p2` で行う。中身は次の4つ。
   - タグからの当て直し（15単位）
   - 作業ツリーの照らし（`c1-check-worktree.mjs`）
   - ロックファイルの検査（`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` の後に `--lockfile-check`。終わったらロックファイルを戻す）
   - 型検査と照らし（`c1-check-json.mjs`）
3. **テスト**: `node tests/run-all.mjs --save <ファイル>` を走らせ、件数と fail が 0 であることを確かめる。
4. **合否**: 「パッケージ化の前まで」の合否を、`records/take-in/` ではなくこのディレクトリの `verification-ooka.md` に書く。直す点があれば、担当（蒙恬か曹参）と中身を書く。関門の合否は出さない。

## 守ること

- コード・テスト・unit.json は直さない。書き込みは `records/`・`tasks/`・`C:\b\logs\` と、許可にある `C:\b\wt\p2` の操作だけ。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` と、普段使いのエディタのデータに触れない。パッケージ化と zip はしない。
- 作業ツリー `C:\b\wt\p2` は、終わったら15単位を当てた状態で、未コミットの変更を 0 にして残す。

## 完了条件

- 1〜4に結果がある。

## 成果物

このディレクトリに `verification-ooka.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: 合格ならコミット。片づけの許可の後に、C-1 のビルドと関門。

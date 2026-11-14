# Phase 2: B-1 の直しと build.mjs の直しの検証、作り直した B-1〜B-7（-r2）の関門

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

B-1 が消した `_aiEdits.*` のコマンドを、蒙恬が何もしない登録で残した。B-1〜B-7 を `-r2` で作り直した（`tasks/2026-11-14-fix-b1-and-build/`）。直しを確かめ、7版の関門（docs/03 の7節の1〜4）を通す。段階 A はすべて合格（`tasks/2026-11-14-p2-regate-a/`）。

## 入力

- `tasks/2026-11-14-fix-b1-and-build/`（handoff-notes.md、build-log.md）
- `removals/B-1-telemetry/`（edits.patch・unit.json・README の差分）、`scripts/build.mjs` の差分（`childEnv` が外の `BUILD_SOURCEVERSION` を外す、版の commit に枝 `builds/<label>` を付ける）
- `tasks/2026-11-14-p2-builds/builds.md` の「作り直した版（-r2）」の節（展開した場所）
- 前回の関門 `tasks/2026-11-14-p2-gates/`（B-1 の不合格の中身）、`docs/user-decisions.md` の 2026-11-14「Phase 2 の関門で出た点」（B-1 の `absentCommands` を空にしてよい）
- 網の直し `tasks/2026-11-14-fix-absent-probe/handoff-notes.md`

## やること

1. **レビュー**: B-1 の edits.patch（3つのコマンドの登録が本家の「何もしない代わり」と同じ中身か）、README の理由、`build.mjs` の2点の直し。
2. **B-1〜B-7（-r2）の版ごとに関門の1〜4**:
   - 1・2: `<label>/checks.json` と `build-record.json`（commit の一致、`sourceVersion`）。
   - 3: `node tests/absent-run.mjs --build <版> --units <単位> --expect absent`（前の版で `--expect present` も）。absentHosts は通信の監査で（前回の結果が版の違いで変わらない根拠があれば、それを書いて流用してよい）。
   - 4: 単位の `smoke` の組でスモーク。B-1-r2 では `_aiEdits.* not found` が出ないこと（git のコミットの後を含む）。前の版に無い誤りが出ないこと。Claude Code の組は必ず通す。
3. **notion-sync の翻訳の直し**: `-r2` の版に `dist/i18n/` の束が入っているか（入っていなければ、作り直しが直しの前だったと書く）。入っていれば、errors.new から `No bundle location found for extension shuko.notion-sync` が消えたか。
4. 記録: `records/take-in/<label>/gate-<id>.md`。handoff-notes に単位ごとの結びと、`enabled: true` にしてよい単位の一覧。
5. `node tests/run-all.mjs --save <ファイル>` の件数（B-1 と build.mjs の直しを含む状態）。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・`C:\b\smoke\` だけ。
- 普段使いのエディタのデータに触れない。PC の設定を変えない。スモークは同時に2つ走らせない。

## 完了条件

- 1〜5 に合否と理由がある。

## 成果物

- `records/take-in/1.146.0-p2-B-*-r2/gate-*.md`
- このディレクトリに `verification-log.md`、`handoff-notes.md`

## 結果

合格（1〜5）。B-1-r2〜B-7-r2 の7版とも関門の1〜4が合格。B-1 は `_aiEdits.*` の何もしない登録で直った。notion-sync の誤りは B-4-r2 以降で消えた。run-all 1581 件、fail 0、skip 12。段階 A・B の14単位がそろった。

## 未解決

- B-1・B-2・B-3・B-4・B-7 の有効化（蒙恬）。
- 全部を有効にした版で、スモークの全部の組・通信の監査・ユーザーの手の項目。

## 次の担当

蒙恬: 合格した単位を `enabled: true` にする。リーダー: 全部を有効にした版でスモークの全部の組と通信の監査、ユーザーの手の項目へ。

# 関門の記録: B-3-issue-share（版 `1.146.0-p2-B-3-r2`。A-1〜A-7, B-1〜B-3）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-3-r2.zip`（SHA-256 `cb392698…3d64`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-3-r2\Shuko-win32-x64-1.146.0-p2-B-3-r2\`（commit `cd09c201…4afb`）
- 比べる相手: 前の版 `1.146.0-p2-B-2-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-2-r2.json`。2回の和）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `cd09c201…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-3-r2` が同じ commit を指す |
| 3. 消えている | **合格** | 前の版（B-2-r2）で `--expect present` が pass 4、この版で `--expect absent` が pass 4 / fail 0 / unknown 0（コマンド2・設定2。runtime の網。替えた `toggle.workbench.experimental.share.enabled` を含む） |
| 4. 壊れていない | **合格** | 2回目で PASS 49 / FAIL 0、errors.new「新しい誤りなし」。1回目の FAIL 1 は前の段階からある揺れる誤り（下の3節）。claude-code の組は2回とも3項目 PASS |

## 1. 当たる

edits.patch は前回の関門（`records/take-in/1.146.0-p2-B-3/gate-B-3-issue-share.md`）から変わっていない。checks の `workbench.action.share` → `toggle.workbench.experimental.share.enabled` の替えは前の依頼でレビュー済み（`tasks/2026-11-14-p2-regate-a/verification-log.md` の1.2）。

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-2-r2/Shuko-win32-x64-1.146.0-p2-B-2-r2 --units B-3-issue-share --expect present --label r2-prev-B-3-on-B-2-r2
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-3-r2/Shuko-win32-x64-1.146.0-p2-B-3-r2 --units B-3-issue-share --expect absent --label r2-B-3
```

| 項目 | B-2-r2（present） | B-3-r2（absent） |
|---|---|---|
| absentCommands `workbench.action.openIssueReporter`・`toggle.workbench.experimental.share.enabled` | 在る（runtime） | **無い** |
| absentSettings `issueReporter.wizard.enabled`・`workbench.experimental.share.enabled` | 在る（runtime） | **無い** |

- 結果: `C:\b\smoke\absent\r2-prev-B-3-on-B-2-r2-20261114T151128\`、`C:\b\smoke\absent\r2-B-3-20261114T151144\`

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-3-r2/Shuko-win32-x64-1.146.0-p2-B-3-r2 --label p2-B-3-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-2-r2.json --save-baseline C:/b/smoke/baseline-p2-B-3-r2.json --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-3-r2/Shuko-win32-x64-1.146.0-p2-B-3-r2 --label p2-B-3-r2-run2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-2-r2.json --save-baseline C:/b/smoke/baseline-p2-B-3-r2.json --merge-baseline --timeout 300 --keep-runs 40
```

- 1回目 `C:\b\smoke\runs\p2-B-3-r2-20261114T151804\`: PASS 48 / **FAIL 1**。errors.new の1件は `[exthost] Remote Control auto-enable failed: Error: Remote Control initialization failed`。このときの基準は B-2-r2 の1回目だけ（その回にだけこの鍵が無かった）
- この誤りは B-3 が足したものではない: A-7・B-1-r2 の基準にあり、B-2-r2 の2回目でも出た（B-2-r2 の記録の3節）。Claude Code 拡張のリモートの機能の初期化の誤りで、出たり出なかったりする
- 2回目 `C:\b\smoke\runs\p2-B-3-r2-run2-20261114T152125\`（基準は B-2-r2 の2回の和）: **PASS 49 / FAIL 0**、errors.new「新しい誤りなし」。基準は2回の和で鍵 5 個
- claude-code の組: 2回とも3項目 PASS。コマンドの数 3259 → 3251

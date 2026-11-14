# 関門の記録: B-2-onboarding-experiments-surveys（版 `1.146.0-p2-B-2-r2`。A-1〜A-7, B-1, B-2）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-2-r2.zip`（SHA-256 `9bf4869b…3577`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-2-r2\Shuko-win32-x64-1.146.0-p2-B-2-r2\`（commit `b9c0a9c1…80e0`）
- 比べる相手: 前の版 `1.146.0-p2-B-1-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-1-r2.json`、通信の監査 `records/network-audits/2026-11-15-p2gate-B-1-r2/`）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし、`missingDeletes`・`productMissing` は空。検査6つ ok、absentStrings はすべて 0 件。mydist の既定から `workbench.startupEditor` が外れた（`removedDefaults`、B-2 による） |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `b9c0a9c1…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-2-r2` が同じ commit を指す |
| 3. 消えている | **合格** | 前の版（B-1-r2）で `--expect present` が pass 8、この版で `--expect absent` が pass 8 / fail 0 / unknown 0（コマンド5・設定3。すべて runtime の網）。absentHosts `default.exp-tas.com` は通信の監査で接続なし |
| 4. 壊れていない | **合格** | 2回とも PASS 49 / FAIL 0、errors.new「新しい誤りなし」（B-1-r2 と比べて）。claude-code の組は3項目 PASS |

## 1. 当たる

edits.patch は前回の関門（`records/take-in/1.146.0-p2-B-2/gate-B-2-onboarding-experiments-surveys.md` の1節）から変わっていない（`git status` で `removals/` の変更は B-1 だけ）。

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-1-r2/Shuko-win32-x64-1.146.0-p2-B-1-r2 --units B-2-onboarding-experiments-surveys --expect present --label r2-prev-B-2-on-B-1-r2
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-2-r2/Shuko-win32-x64-1.146.0-p2-B-2-r2 --units B-2-onboarding-experiments-surveys --expect absent --label r2-B-2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-2-r2/Shuko-win32-x64-1.146.0-p2-B-2-r2/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-2-r2 -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2gate-B-1-r2
```

| 項目 | B-1-r2（present） | B-2-r2（absent） |
|---|---|---|
| absentCommands `workbench.action.openWalkthrough`・`welcome.showAllWalkthroughs`・`workbench.action.showInteractivePlayground`・`workbench.action.welcomeOnboarding2026`・`workbench.action.openSurvey` | 5件とも在る（runtime） | **5件とも無い** |
| absentSettings `workbench.startupEditor`・`workbench.welcomePage.walkthroughs.openOnInstall`・`workbench.welcomePage.experimentalOnboarding` | 3件とも在る（runtime） | **3件とも無い** |
| absentHosts `default.exp-tas.com` | 接続なし | **接続なし** |

- 結果: `C:\b\smoke\absent\r2-prev-B-2-on-B-1-r2-20261114T151056\`、`C:\b\smoke\absent\r2-B-2-20261114T151112\`、通信 `records/network-audits/2026-11-15-p2gate-B-2-r2/audit.md`（エディタの宛先 0、claude 0、許可の外 0、前回に無い宛先 0。`wpad` の解決2回だけ）
- 公式の zip でも在ることは前の依頼で確かめ済み（`C:\b\smoke\absent\regate-official-20261114T144944\`、B-2 は 8/0）
- 通信の監査で単位の効き目が見えない点（出力の product.json に `tasConfig` が無い）は前回と同じ

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-2-r2/Shuko-win32-x64-1.146.0-p2-B-2-r2 --label p2-B-2-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-1-r2.json --save-baseline C:/b/smoke/baseline-p2-B-2-r2.json --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-2-r2/Shuko-win32-x64-1.146.0-p2-B-2-r2 --label p2-B-2-r2-run2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-1-r2.json --save-baseline C:/b/smoke/baseline-p2-B-2-r2.json --merge-baseline --timeout 300 --keep-runs 40
```

- 1回目 `C:\b\smoke\runs\p2-B-2-r2-20261114T151630\`: PASS 49 / FAIL 0。exthost 2・renderer 2・other 2。基準の鍵 4 個（`Remote Control auto-enable failed` が出なかった）
- 2回目 `C:\b\smoke\runs\p2-B-2-r2-run2-20261114T151956\`: PASS 49 / FAIL 0。exthost 3。基準は2回の和で鍵 5 個（B-1-r2 と同じ5個）
- 2回目を走らせた理由: 1回目の基準に `Remote Control` の鍵が無く、次の B-3-r2 の1回目がその鍵を「新しい誤り」として落としたため。この誤りは Claude Code 拡張のもので、A-1〜A-4・A-7・B-1-r2 の基準にもあり、出たり出なかったりする（A-5 の前回の関門と同じ揺れ）
- claude-code の組: 2回とも3項目 PASS。コマンドの数 3273 → 3259

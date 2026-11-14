# 関門の記録: B-5-theme-switching（版 `1.146.0-p2-B-5-r2`。A-1〜A-7, B-1〜B-5）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-5-r2.zip`（SHA-256 `bda0d33e…d97a`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-5-r2\Shuko-win32-x64-1.146.0-p2-B-5-r2\`（commit `4dd38929…b6b0`）
- 比べる相手: 前の版 `1.146.0-p2-B-4-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-4-r2.json`）
- 前回（`1.146.0-p2-B-5`）も4つとも合格し、`enabled: true` 済み。今回は B-1 を直した版の上で確かめ直した

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `4dd38929…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-5-r2` が同じ commit を指す |
| 3. 消えている | **合格** | 前の版（B-4-r2）で `--expect present` が pass 6、この版で `--expect absent` が pass 6 / fail 0 / unknown 0（コマンド6。runtime の網） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0、errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-4-r2/Shuko-win32-x64-1.146.0-p2-B-4-r2 --units B-5-theme-switching --expect present --label r2-prev-B-5-on-B-4-r2
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-5-r2/Shuko-win32-x64-1.146.0-p2-B-5-r2 --units B-5-theme-switching --expect absent --label r2-B-5
```

- absentCommands `workbench.action.selectTheme`・`selectIconTheme`・`selectProductIconTheme`・`toggleLightDarkThemes`・`browseColorThemesInMarketplace`・`generateColorTheme`: B-4-r2 で6件とも在る、B-5-r2 で6件とも無い
- 結果: `C:\b\smoke\absent\r2-prev-B-5-on-B-4-r2-20261114T151243\`、`C:\b\smoke\absent\r2-B-5-20261114T151259\`

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-5-r2/Shuko-win32-x64-1.146.0-p2-B-5-r2 --label p2-B-5-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-4-r2.json --save-baseline C:/b/smoke/baseline-p2-B-5-r2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-5-r2-20261114T152438\`。PASS 49 / FAIL 0 / INFO 9。exthost 1・renderer 2・other 2。基準の鍵 4 個
- claude-code の組: 3項目 PASS。コマンドの数 3239 → 3231

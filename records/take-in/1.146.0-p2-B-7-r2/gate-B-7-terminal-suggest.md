# 関門の記録: B-7-terminal-suggest（版 `1.146.0-p2-B-7-r2`。段階 A・B の全部）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-7-r2.zip`（SHA-256 `e50d69b5…53cf`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-7-r2\Shuko-win32-x64-1.146.0-p2-B-7-r2\`（commit `680e99e9…4e39`）
- 比べる相手: 前の版 `1.146.0-p2-B-6-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-6-r2.json`）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件。mydist の既定から `workbench.startupEditor`（B-2）と `terminal.integrated.suggest.enabled`（B-7）が外れた |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `680e99e9…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-7-r2` が同じ commit を指す（`C:\b\vscode\.git\refs\heads\builds\1.146.0-p2-B-7-r2`） |
| 3. 消えている | **合格** | 前の版（B-6-r2）で `--expect present` が pass 4、この版で `--expect absent` が pass 4 / fail 0 / unknown 0（コマンド2・設定2。runtime の網） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0、errors.new「新しい誤りなし」。base.terminal・lang.ps1.session・lang.ps1.pwsh7 と claude-code の組の3項目は PASS |

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-6-r2/Shuko-win32-x64-1.146.0-p2-B-6-r2 --units B-7-terminal-suggest --expect present --label r2-prev-B-7-on-B-6-r2
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-7-r2/Shuko-win32-x64-1.146.0-p2-B-7-r2 --units B-7-terminal-suggest --expect absent --label r2-B-7
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-7-r2/Shuko-win32-x64-1.146.0-p2-B-7-r2 --units A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-7-terminal-suggest --expect absent --label r2-B-7-all-AB
```

- absentCommands `workbench.action.terminal.triggerSuggest`・`configureSuggestSettings`、absentSettings `terminal.integrated.suggest.enabled`・`quickSuggestions`: B-6-r2 で4件とも在る、B-7-r2 で4件とも無い
- 段階 A・B の全部（checks を持つ12単位）をこの版で `--expect absent`: 全部 fail 0・unknown 0（A-1 3・A-2 7・A-3 1・A-4 3・A-5 3・A-7 9・B-1 2・B-2 8・B-3 4・B-4 7・B-5 6・B-7 4）。A-6・B-6 は台本で見る項目が無い
- 結果: `C:\b\smoke\absent\r2-prev-B-7-on-B-6-r2-20261114T151323\`、`r2-B-7-20261114T151338\`、`r2-B-7-all-AB-20261114T151353\`

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-7-r2/Shuko-win32-x64-1.146.0-p2-B-7-r2 --label p2-B-7-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-6-r2.json --save-baseline C:/b/smoke/baseline-p2-B-7-r2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-7-r2-20261114T152738\`。PASS 49 / FAIL 0 / INFO 9。exthost 1・renderer 2・other 2。基準の鍵 4 個
- claude-code の組: 3項目 PASS。コマンドの数 3231 → 3211

この版は段階 A・B の全部を当てた版を兼ねる。ただし `enabled` は前回の合格の単位だけ true の状態で作ったもので、全部を `enabled: true` にして作った版ではない（当て方は `--only` で同じ）。docs/07 の5節の4（全部を有効にした版でのスモークの全部の組・通信の監査・手の項目）は、この関門の外（リーダーの次の段取り）。

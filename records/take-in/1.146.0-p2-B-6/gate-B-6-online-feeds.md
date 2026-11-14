# 関門の記録: B-6-online-feeds（版 `1.146.0-p2-B-6`。A-1〜A-7, B-1〜B-6）

- 検証: 大岡越前守、2026-11-14（JST 23:00〜23:14）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-6.zip`（SHA-256 `0790e2d7…75f0`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-6\Shuko-win32-x64-1.146.0-p2-B-6\`（commit `f9ada20a…3eac`）
- 比べる相手: 前の版 `1.146.0-p2-B-5`（スモークの基準 `C:\b\smoke\baseline-p2-B-5.json`。2回の和、鍵 7 個）。通信は A-7・B-1・B-2 の監査

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。delete 1・removeLines 2、パッチ無し。検査6つ ok、absentStrings（`emergencyAlert.contribution.js'`・`productService.emergencyAlertUrl`）は 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `f9ada20a…`（`matchesChecksHead`） |
| 3. 消えている | **合格** | 検査は absentHosts `main.vscode-cdn.net` だけ。通信の監査で接続なし（2節）。起動して見るほかの項目は空 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

**4つとも合格。B-6 を `enabled: true` にしてよい。** ただし3は、単位を当てる前の版でも接続が無い（2節）。

## 2. 消えている

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-6/Shuko-win32-x64-1.146.0-p2-B-6/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-6 -DurationSeconds 600 -Previous records/network-audits/2026-11-14-p2gate-B-1
```

- 結果 `records/network-audits/2026-11-14-p2gate-B-6/audit.md`: 600 秒・300 回。エディタの宛先 0、claude 0。名前で見えたのは `wpad`（80 番、名前の解決2回、答え無し、接続なし）だけ。`main.vscode-cdn.net` への接続は無い
- 環境は B-1 の記録の2節と同じ（台帳の拡張なし）
- A-7・B-1・B-2 の監査でも `main.vscode-cdn.net` への接続は無かった。出力の product.json（OSS のもの）に `emergencyAlertUrl` が無いので、単位を当てる前から取りに行かない（unit.json の intent が書くとおり）。Phase 0 の公式の監査では、この宛先に接続があった（`records/network-audits/2026-11-13-p05-upstream-ai-disabled/`）
- 静的にも: B-6 の出力の `out\` に `emergencyAlert` と `main.vscode-cdn.net` の文字列は無い（B-5 の版の `out\` には `workbench.desktop.main.js` などにある）
- WPAD（docs/03 の表の B-6 の注意）: patch 30 は全版に当たっているが、名前の解決 `wpad` は A-7・B-1・B-2・B-6 の監査のどれにも2回ずつ残る（公式の Phase 0 の監査では7回）。接続は無い。止め方の判断は patch 30 の側（この単位の外）

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-6/Shuko-win32-x64-1.146.0-p2-B-6 --label p2-B-6 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-5.json --save-baseline C:/b/smoke/baseline-p2-B-6.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-6-20261114T140153\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は B-5 と同じ
- claude-code の組: 3項目 PASS
- コマンドの数 3231（B-5 と同じ。緊急の知らせの部品はコマンドを持たない）

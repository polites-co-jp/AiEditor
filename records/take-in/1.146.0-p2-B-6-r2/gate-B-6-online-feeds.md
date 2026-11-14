# 関門の記録: B-6-online-feeds（版 `1.146.0-p2-B-6-r2`。A-1〜A-7, B-1〜B-6）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-6-r2.zip`（SHA-256 `f793414d…60ba`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-6-r2\Shuko-win32-x64-1.146.0-p2-B-6-r2\`（commit `1f4abbee…3e6d`）
- 比べる相手: 前の版 `1.146.0-p2-B-5-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-5-r2.json`）
- 前回（`1.146.0-p2-B-6`）も4つとも合格し、`enabled: true` 済み。今回は B-1 を直した版の上で確かめ直した

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `1f4abbee…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-6-r2` が同じ commit を指す |
| 3. 消えている | **合格** | checks は absentHosts `main.vscode-cdn.net` だけ。通信の監査（600 秒）で接続なし |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0、errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 2. 消えている

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-6-r2/Shuko-win32-x64-1.146.0-p2-B-6-r2/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-6-r2 -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2gate-B-1-r2
```

- 結果 `records/network-audits/2026-11-15-p2gate-B-6-r2/audit.md`: エディタの宛先 0、claude 0、許可の外 0、前回に無い宛先 0。名前で見えたのは `wpad` の解決2回だけ（接続なし）
- 比べる相手は B-1-r2 の監査（B-5-r2 の監査は取っていない。B-1-r2 も宛先 0）
- 単位の効き目がこの監査では見えない点（出力の product.json に `emergencyAlertUrl` が無い）は前回と同じ。-r2 の7版の product.json にも無い（Grep で確かめた）
- B-2-r2 の監査と時間が重なった（どちらも自分の起動した木だけを見る。前回の関門と同じ）

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-6-r2/Shuko-win32-x64-1.146.0-p2-B-6-r2 --label p2-B-6-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-5-r2.json --save-baseline C:/b/smoke/baseline-p2-B-6-r2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-6-r2-20261114T152608\`。PASS 49 / FAIL 0 / INFO 9。exthost 1・renderer 2・other 2。基準の鍵 4 個
- claude-code の組: 3項目 PASS。コマンドの数 3231 → 3231

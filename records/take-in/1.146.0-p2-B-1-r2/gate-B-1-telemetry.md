# 関門の記録: B-1-telemetry（版 `1.146.0-p2-B-1-r2`。A-1〜A-7, B-1。B-1 の直しを含む）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-1-r2.zip`（SHA-256 `44a71752…399b`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-1-r2\Shuko-win32-x64-1.146.0-p2-B-1-r2\`（commit `f47742d9…450c`）
- 比べる相手: 前の版 `1.146.0-p2-A-7`（スモークの基準 `C:\b\smoke\baseline-p2-A-7.json`、通信の監査 `records/network-audits/2026-11-14-p2gate-A-7/`）
- 前回（直す前の版 `1.146.0-p2-B-1`）の関門: `records/take-in/1.146.0-p2-B-1/gate-B-1-telemetry.md`（4 が不合格）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。B-1 は delete 23（`missingDeletes` 0）・removeDependencies 6（`missingDependencies` 0）・removeLines 6（すべて `found: 1`）、edits は `applied: ok`・衝突なし（commit `508f32a1…`）。検査（remnants・absentStrings・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity）はすべて ok、absentStrings はすべて 0 件。ロックファイルは消した依存の削除だけ（追加・版の変化・予期しない削除 0） |
| 2. 型検査とビルド | **合格** | `build-record-install.json`（install・lockfile・typecheck）と `build-record.json`（package・postprocess・zip）の `result: ok`、手順の終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `f47742d9…`、`matchesChecksHead: true`、`productCommit.ok: true`。展開した `resources\app\product.json` の commit も同じ。枝 `builds/1.146.0-p2-B-1-r2` が同じ commit を指す（`C:\b\vscode\.git\packed-refs`）。組み込み拡張 65、消え残り 0 |
| 3. 消えている | **合格** | 前の版（A-7）で `--expect present` が pass 2、この版で `--expect absent` が pass 2 / fail 0 / unknown 0（absentSettings の2件。runtime の網）。absentHosts `mobile.events.data.microsoft.com` は通信の監査で接続なし。absentCommands は裁定（2026-11-14）で空 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」（A-7 と比べて）。git のコミットの後も `_aiEdits.* not found` は出ない。claude-code の組は3項目 PASS |

**B-1 は `enabled: true` にしてよい。**

## 1. 直し（edits.patch）を読んだ

- `aiEditTelemetryService.ts` の末尾に `CommandsRegistry.registerCommand` で3つを登録: `_aiEdits.hasAiContributions` は `() => false`、`_aiEdits.clearAiContributions`・`_aiEdits.clearAllAiContributions` は `() => { }`。本家 1.146.0 の `editTelemetryContribution.ts` 57〜59行の「何もしない代わり」と同じ中身（`C:\b\wt\1.146.0` で読んだ）
- import は `../../../../../../platform/commands/common/commands.js`（同じファイルのほかの import と同じ深さ）。hunk の行数（`-6,6 +6,8`、`-103,3 +105,28`）は本文と合う
- 呼び手は git の拡張だけ（`extensions/git/src/repository.ts` の 1349・1433・1502・1629・1543・2318・2328・2363 行。`src/` と `extensions/` を grep して、ほかに `_aiEdits.` を呼ぶ・登録する場所は消した部品と試験だけ）
- 出力の `out\vs\workbench\workbench.desktop.main.js` に `registerCommand("_aiEdits.hasAiContributions",()…`・`clearAiContributions`・`clearAllAiContributions` の3つがある（-r2 の7版とも）

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-7/Shuko-win32-x64-1.146.0-p2-A-7 --units B-1-telemetry --expect present --label r2-prev-B-1-on-A-7
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-1-r2/Shuko-win32-x64-1.146.0-p2-B-1-r2 --units B-1-telemetry --expect absent --label r2-B-1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-1-r2/Shuko-win32-x64-1.146.0-p2-B-1-r2/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-1-r2 -DurationSeconds 600 -Previous records/network-audits/2026-11-14-p2gate-A-7
```

| 項目 | A-7（present） | B-1-r2（absent） |
|---|---|---|
| absentSettings `telemetry.editStats.enabled`・`editor.aiStats.enabled` | 在る（runtime） | **無い**（pass 2） |
| absentHosts `mobile.events.data.microsoft.com` | 接続なし（前回の監査） | **接続なし** |

- 結果: `C:\b\smoke\absent\r2-prev-B-1-on-A-7-20261114T150905\`、`C:\b\smoke\absent\r2-B-1-20261114T150925\`、通信 `records/network-audits/2026-11-15-p2gate-B-1-r2/audit.md`（エディタの宛先 0、claude 0、許可の外 0、前回に無い宛先 0。名前で見えたのは `wpad` の解決2回だけ）
- 通信の監査の環境は前回と同じ（`telemetry.telemetryLevel: all`・`workbench.enableExperiments: true`）。A-7 にも接続が無いので、単位の効き目そのものはこの監査では見えない（出力の product.json に `enableTelemetry`・`aiConfig` が無い。-r2 の7版でも同じことを Grep で確かめた）

### 「在る」の確かめを台本で試した結果（判定に使っていない）

`--cmd _aiEdits.hasAiContributions --cmd _aiEdits.clearAiContributions --cmd _aiEdits.clearAllAiContributions --expect present` を B-1-r2・前の B-1・A-7 に流すと、3版とも「無い」になった（`C:\b\smoke\absent\r2-B-1-aiEdits-present-20261114T150948\`・`r2-control-old-B-1-aiEdits-20261114T151004\`・`r2-control-A-7-aiEdits-20261114T151030\`）。probe は `vscode.commands.getCommands(true)`（`tests/removals/probe/extension.js` の13行）で、`_` で始まる内部のコマンドを除いた一覧を取るため、`_aiEdits.*` は本家の A-7 でも見えない。この網では「在る」を確かめられない。在ることは、下のスモークと出力の文字列で確かめた。

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-1-r2/Shuko-win32-x64-1.146.0-p2-B-1-r2 --label p2-B-1-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-7.json --save-baseline C:/b/smoke/baseline-p2-B-1-r2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-1-r2-20261114T151446\`。**PASS 49 / FAIL 0** / INFO 9。誤りの件数 exthost 3・renderer 2・other 2（前の B-1 は exthost 4・renderer 3）。保存した基準の鍵 5 個は A-7 の基準と同じ5個
- base.git「コミットできた」（コミットの後に `_aiEdits.clearAiContributions` が呼ばれる。`repository.ts` の1502行）。run の `logs\` の全部の `.log` に `_aiEdits` の行は無い（Grep）
- `No bundle location found for extension shuko.notion-sync` は残る（この版は notion-sync の翻訳の束の直しの前に作った。A-7 の基準にある鍵なので新しい誤りではない）
- claude-code の組: 3項目 PASS（claude.running・claude.exthost-log・claude.lock）
- 単位の `smoke` の組（base・claude-code・languages・absence）: base・claude-code・languages はこのスモーク、absence は2節

## 4. 前回からの変わり目

- 前回の不合格（`_aiEdits.clearAiContributions` not found）は消えた
- absentCommands の `workbench.action.showTelemetry` は checks から外れた（`--disable-telemetry` のもとで公式でも登録されない。裁定 2026-11-14 で空にしてよい）

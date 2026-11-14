# 関門の記録: B-1-telemetry（版 `1.146.0-p2-B-1`。A-1〜A-7, B-1）

- 検証: 大岡越前守、2026-11-14（JST 22:39〜23:00）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-1.zip`（SHA-256 `13d3b825…4a3b`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-1\Shuko-win32-x64-1.146.0-p2-B-1\`（commit `76c0069e…a386`）
- 比べる相手: 前の版 `1.146.0-p2-A-7`（スモークの基準 `C:\b\smoke\baseline-p2-A-7.json`、通信の監査 `records/network-audits/2026-11-14-p2gate-A-7/`）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。delete 23・removeDependencies（3つの package.json から 1DS の2件）・removeLines 6、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件。ロックファイルは消した依存の削除だけ（3節） |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `76c0069e…`（`matchesChecksHead`）。`uncommittedEntries: 3` は作り直したロックファイル3つ |
| 3. 消えている | **判定できない** | absentHosts `mobile.events.data.microsoft.com` は通信の監査で接続なし（合格の条件を満たす）。absentCommands `workbench.action.showTelemetry` は公式でも登録されない。absentSettings の2件は台本の不備 |
| 4. 壊れていない | **不合格** | スモークの errors.new が FAIL: `Error: command '_aiEdits.clearAiContributions' not found`（renderer と exthost に各1件）。B-1 が消した部品が登録していたコマンドを、残る git の拡張が呼ぶ（4節） |

**B-1 は `enabled: false` のまま。4 を直す必要がある。**

## 1. 当たる・型検査とビルド

- `edits.patch`（4ファイル、38 行の追加・256 行の削除）を読んだ: `platform/telemetry` の common・browser・node の `1dsAppender.ts` を、送り先も鍵も持たず 1DS の依存を読まない実装に置き換える。`aiEditTelemetryService.ts` に何もしない実装を登録する。ほかの単位の都合の変更は無い
- ロックファイル（`checks.json` の `lockfile`）: `pnpm-lock.yaml`（ルート）は依存2件と packages 5件の削除、`remote/pnpm-lock.yaml` は依存4件と packages 5件の削除、`extensions/pnpm-lock.yaml` は前の単位の分。追加・版の変化・予期しない削除は 0

## 2. 消えている

### コマンドと設定

```
node tests/absent-run.mjs --units A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys --expect present --label p2-A7-B2-official-present
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-1/Shuko-win32-x64-1.146.0-p2-B-1 --units A-3-debug-extensions,A-5-remote-extensions,B-1-telemetry --expect absent --label p2-B-1
```

| 項目 | 公式（present） | B-1（absent） |
|---|---|---|
| absentCommands `workbench.action.showTelemetry` | **無い** | 無い |
| absentSettings `telemetry.editStats.enabled`・`editor.aiStats.enabled` | 在る | **在る**（台本の不備） |

参考（判定には使わない）: 3件の ID は、出力の `out\` のどこにも無い（A-7 の版の `out\` には `workbench.desktop.main.js` などにある）。

### 通信の監査（absentHosts）

台本 `scripts/netaudit.ps1` で、A-7 と B-1 を同じ条件で 600 秒ずつ見た。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-A-7/Shuko-win32-x64-1.146.0-p2-A-7/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-A-7 -DurationSeconds 600
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-1/Shuko-win32-x64-1.146.0-p2-B-1/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-1 -DurationSeconds 600 -Previous records/network-audits/2026-11-14-p2gate-A-7
```

- 環境のひな形 `tasks/2026-11-14-p2-gates/netaudit-env/` は検証役が作った。ユーザー設定で `telemetry.telemetryLevel: all` と `workbench.enableExperiments: true` にして、単位がコードを消していなければ送り先に接続するようにした（上書きの既定 `shukoConfigurationDefaults` はどちらも止める側なので、既定のままでは単位の効き目が見えない）。台帳の拡張は入れていない（見るのはエディタ本体の宛先。docs/06 の 9 節の、台帳の拡張を入れた環境とは違う）
- 結果: A-7・B-1 とも、エディタの宛先 0 件、claude の宛先 0 件。名前で見えたのは `wpad`（80 番、名前の解決 2 回、答え無し）だけ。`mobile.events.data.microsoft.com` への接続は無い（`records/network-audits/2026-11-14-p2gate-A-7/`・`2026-11-14-p2gate-B-1/` の `audit.md`）
- **absentHosts は条件を満たす**（B-1 の版に接続が無い）。ただし A-7 にも接続が無いので、B-1 の単位の効き目はこの監査では見えない。理由: 出力の product.json（OSS のもの）に `enableTelemetry`・`aiConfig`（`ariaKey`）が無く、公式（`enableTelemetry: true`、`aiConfig.ariaKey` あり）と違って、単位を当てる前からテレメトリの送り手が作られない
- 参考: B-1 の出力でも、組み込み拡張（html・json・typescript・git・markdown・merge-conflict の `dist`）には `mobile.events.data.microsoft.com` の文字列が残る（拡張に同梱の `@vscode/extension-telemetry`）。上の監査では、テレメトリを all にしても接続は無かった

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-1/Shuko-win32-x64-1.146.0-p2-B-1 --label p2-B-1 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-7.json --save-baseline C:/b/smoke/baseline-p2-B-1.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-1-20261114T134326\`。**PASS 48 / FAIL 1**（errors.new）/ INFO 9。誤りの件数 exthost 3 → 4、renderer 2 → 3
- 新しい誤り2件:
  - `logs\window1\renderer.log` 44行: `[error] Error: command '_aiEdits.clearAiContributions' not found`（直前の行は検索の置換 `batchReplace` の中の stack）
  - `logs\window1\exthost\exthost.log` 104行: 同じ文面
- 呼び手: 出力の `extensions\git\dist\main.js` が `_.commands.executeCommand("_aiEdits.clearAiContributions", …)` を、ステージ・取り消し・コミットなどで呼ぶ（4か所）。このコマンドは B-1 が消した `contrib/editTelemetry/browser/aiContributionFeature.ts` の側が登録していたもの（B-1 の出力の `out\` には登録が無い）。呼ぶだけで結果を待たないので、git の操作そのものは通った（base.git PASS）
- ほかの項目（base・languages・safety）はすべて PASS。claude-code の組の3項目も PASS
- この誤りは決まった操作（スモークの git のコミット）で起きるので、揺れではない（1回で判定した）

## 4. 直す必要があるところ

- 蒙恬（`removals/B-1-telemetry/edits.patch`）: `_aiEdits.clearAiContributions` を、何もしないコマンドとして登録する（`IAiEditTelemetryService` の何もしない実装と同じ扱い）。または、このコマンドを登録している部品を消さずに `kept` に入れる。直した後、スモークで errors.new が PASS になることを確かめる
- 曹参（probe）と蒙恬（`checks`）: 2節の網の不備（handoff-notes.md の「直す必要があるところ」）

次の版（B-2 以降）の比べは、この誤りを含めた基準 `baseline-p2-B-1.json` で行う（後の単位が足した誤りだけを見るため）。B-1 を直した版が出たら、改めて確かめる。

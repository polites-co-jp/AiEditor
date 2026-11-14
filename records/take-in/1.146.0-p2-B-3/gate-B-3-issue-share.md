# 関門の記録: B-3-issue-share（版 `1.146.0-p2-B-3`。A-1〜A-7, B-1〜B-3）

- 検証: 大岡越前守、2026-11-14（JST 22:50〜22:53）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-3.zip`（SHA-256 `22bcd4c7…63e1`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-3\Shuko-win32-x64-1.146.0-p2-B-3\`（commit `8ea9b15c…9cb0`）
- 比べる相手: 前の版 `1.146.0-p2-B-2`（基準 `C:\b\smoke\baseline-p2-B-2.json`。1回分、鍵 7 個。B-1 の新しい誤り2件を含む）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。検査6つ ok、absentStrings はすべて 0 件、removeLines はすべて found 1、edits は衝突なし。productRemove の `reportIssueUrl` は外れた |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `8ea9b15c…`（`matchesChecksHead`）。`uncommittedEntries: 3` は作り直したロックファイル（B-1 から3つ） |
| 3. 消えている | **判定できない** | `workbench.action.openIssueReporter` は公式・B-2 に在り B-3 に無い（網が働く）。`workbench.action.share` は公式でも登録されない。absentSettings の2件は台本の不備 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 2. 消えている

```
node tests/absent-run.mjs --units B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-7-terminal-suggest --expect present --label p2-B3-B7-official-present
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-3/Shuko-win32-x64-1.146.0-p2-B-3 --units A-3-debug-extensions,A-5-remote-extensions,B-2-onboarding-experiments-surveys,B-3-issue-share --expect absent --label p2-B-3
```

| 項目 | 公式（present） | B-2 の版 | B-3（absent） |
|---|---|---|---|
| absentCommands `workbench.action.openIssueReporter` | 在る | 在る | **無い**（pass） |
| absentCommands `workbench.action.share` | **無い** | — | 無い |
| absentSettings `issueReporter.wizard.enabled`・`workbench.experimental.share.enabled` | 在る | — | **在る**（台本の不備） |

結果: 公式 `C:\b\smoke\absent\p2-B3-B7-official-present-20261114T135012\`、B-3 `C:\b\smoke\absent\p2-B-3-20261114T135030\`

参考（判定には使わない）: 2件の設定の名前は、出力の `workbench.desktop.main.js` では、設定の名前の並び（`workbench.experimental.share.enabled` を含む一覧）に1回出るだけで、登録の文は無い。

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-3/Shuko-win32-x64-1.146.0-p2-B-3 --label p2-B-3 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-2.json --save-baseline C:/b/smoke/baseline-p2-B-3.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-3-20261114T135109\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は B-2 と同じ（exthost 4・renderer 3・other 2）
- claude-code の組: 3項目 PASS
- コマンドの数 3259 → 3251
- 残したサービスの ID（`IWorkbenchIssueService`・`IShareService`）の何もしない実装について: 拡張ホストの起動（`mainThreadShare` が注入する）で誤りは出なかった

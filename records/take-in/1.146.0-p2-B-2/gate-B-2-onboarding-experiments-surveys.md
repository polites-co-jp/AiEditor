# 関門の記録: B-2-onboarding-experiments-surveys（版 `1.146.0-p2-B-2`。A-1〜A-7, B-1, B-2）

- 検証: 大岡越前守、2026-11-14（JST 22:45〜23:11）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-2.zip`（SHA-256 `c1416ac6…ac87`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-2\Shuko-win32-x64-1.146.0-p2-B-2\`（commit `f77fe72c…3964`）
- 比べる相手: 前の版 `1.146.0-p2-B-1`（スモークの基準 `C:\b\smoke\baseline-p2-B-1.json`。B-1 の新しい誤り2件を含む。通信の監査 `records/network-audits/2026-11-14-p2gate-B-1/`）。B-1 は関門の4が不合格なので、この版は B-1 の誤りを持ったまま確かめた

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。delete 4・removeLines 12、productRemove の `onboardingKeymaps`・`onboardingThemes` は外れた（出力の product.json に無い）。edits は衝突なし。検査6つ ok。mydist の既定から `workbench.startupEditor` が外れた（`builtinExtensions.removedDefaults`） |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `f77fe72c…`（`matchesChecksHead`）。`uncommittedEntries: 3` は作り直したロックファイル |
| 3. 消えている | **判定できない** | absentCommands の5件は公式・B-1 に在り B-2 に無い（網が働く）。absentHosts `default.exp-tas.com` は接続なし。absentSettings の3件は台本の不備 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」（B-1 と比べて）。claude-code の組は3項目 PASS |

## 1. 当たる（edits.patch を読んだ）

3ファイル、38 行の追加・15 行の削除。`contrib/remote/browser/remote.ts` から、消したウォークスルーのサービスの注入を外す。`services/assignment` に、割り当てを取りに行かない実装 `noopAssignmentService.ts` を足し、それを登録する。ほかの単位の都合の変更は無い。

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-2/Shuko-win32-x64-1.146.0-p2-B-2 --units A-3-debug-extensions,A-5-remote-extensions,B-2-onboarding-experiments-surveys --expect absent --label p2-B-2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-B-2/Shuko-win32-x64-1.146.0-p2-B-2/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-B-2 -DurationSeconds 600 -Previous records/network-audits/2026-11-14-p2gate-B-1
```

| 項目 | 公式（present） | B-1 の版 | B-2（absent） |
|---|---|---|---|
| absentCommands `workbench.action.openWalkthrough`・`welcome.showAllWalkthroughs`・`workbench.action.showInteractivePlayground`・`workbench.action.welcomeOnboarding2026`・`workbench.action.openSurvey` | 5件とも在る | 5件とも在る | **5件とも無い**（pass 5） |
| absentSettings `workbench.startupEditor`・`workbench.welcomePage.walkthroughs.openOnInstall`・`workbench.welcomePage.experimentalOnboarding` | 在る | — | **在る**（台本の不備） |
| absentHosts `default.exp-tas.com` | Phase 0 の公式の監査で接続あり | 接続なし | **接続なし** |

- 結果: 公式 `C:\b\smoke\absent\p2-A7-B2-official-present-20261114T133943\`、B-1 の版 `p2-B-1-20261114T134256\snapshot.json`、B-2 `C:\b\smoke\absent\p2-B-2-20261114T134516\`、通信 `records/network-audits/2026-11-14-p2gate-B-2/audit.md`（エディタの宛先 0、claude 0、名前で見えたのは `wpad` の解決2回だけ）
- 通信の監査の環境は B-1 の記録の2節と同じ（実験を true にしたユーザー設定）。A-7・B-1 にも接続は無く、B-2 の単位の効き目はこの監査では見えない。出力の product.json（OSS のもの）に `tasConfig` が無いため（公式にはある）
- 参考（判定には使わない）: 3件の設定の名前は、出力の `workbench.desktop.main.js` では値を読む文（`getValue("workbench.startupEditor")`）にだけ出る。`default.exp-tas.com` の文字列は `extensions\typescript-language-features\dist\extension.js` に残る（拡張の実験の仕組み。上の監査では接続なし）

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-2/Shuko-win32-x64-1.146.0-p2-B-2 --label p2-B-2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-1.json --save-baseline C:/b/smoke/baseline-p2-B-2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-2-20261114T134637\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は B-1 と同じ（exthost 4・renderer 3・other 2。B-1 の `_aiEdits.clearAiContributions` を含む）
- claude-code の組: 3項目 PASS。docs/03 の注意（Claude Code の manifest の `walkthroughs` の受け手を消したときの警告）: 拡張ホストのログに walkthrough を含む行は無かった
- コマンドの数 3273 → 3259

# 関門の記録: B-7-terminal-suggest（版 `1.146.0-p2-B-7`。段階 A・B の全部）

- 検証: 大岡越前守、2026-11-14（JST 23:11〜23:14）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-7.zip`（SHA-256 `4bd9fac9…0ea5`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-7\Shuko-win32-x64-1.146.0-p2-B-7\`（commit `cc5d4fd8…e77e`）
- 比べる相手: 前の版 `1.146.0-p2-B-6`（基準 `C:\b\smoke\baseline-p2-B-6.json`。1回分、鍵 7 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。delete 2・removeLines 2、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件。mydist の既定から `terminal.integrated.suggest.enabled` が外れた（`removedDefaults`） |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `cc5d4fd8…`（`matchesChecksHead`、展開した product.json）。`uncommittedEntries: 3` は作り直したロックファイル |
| 3. 消えている | **判定できない** | absentCommands の2件は公式・B-5 に在り B-7 に無い（網が働く）。absentSettings の2件は台本の不備 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。base.terminal（PowerShell でコマンドの実行）と claude-code の組の3項目は PASS |

## 1. 当たる（edits.patch を読んだ）

5ファイル、7 行の追加・52 行の削除。拡張 API の `mainThreadTerminalService.ts` は、補完の提供者の登録を受け取って何もしない（intent のとおり）。ほかは試験・アクセシビリティの案内・初期のヒントから、消した部品への参照を外すだけ。

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-7/Shuko-win32-x64-1.146.0-p2-B-7 --units A-3-debug-extensions,A-5-remote-extensions,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-7-terminal-suggest --expect absent --label p2-B-7
```

| 項目 | 公式（present） | B-5 の版 | B-7（absent） |
|---|---|---|---|
| absentCommands `workbench.action.terminal.triggerSuggest`・`configureSuggestSettings` | 在る | 在る | **無い**（pass 2） |
| absentSettings `terminal.integrated.suggest.enabled`・`quickSuggestions` | 在る | — | **在る**（台本の不備） |

- 結果: 公式 `C:\b\smoke\absent\p2-B3-B7-official-present-20261114T135012\`、B-5 の版 `p2-B-5-20261114T135524\snapshot.json`、B-7 `C:\b\smoke\absent\p2-B-7-20261114T141123\`。同じ実行の A-3・A-5・B-5 は pass、B-2・B-3・B-4 は設定だけ fail（台本の不備）
- 参考（判定には使わない）: `terminal.integrated.suggest.enabled` は出力の `workbench.desktop.main.js` で、設定の名前の列挙と、値を読む文（シェル統合に渡す `suggestEnabled`）にだけ出る。登録の文は無い

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-7/Shuko-win32-x64-1.146.0-p2-B-7 --label p2-B-7 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-6.json --save-baseline C:/b/smoke/baseline-p2-B-7.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-7-20261114T141151\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は B-6 と同じ（exthost 4・renderer 3・other 2。B-1 の誤り2件を含む）
- ターミナル（base.terminal）・PowerShell のセッション（lang.ps1.session・pwsh7）は PASS
- claude-code の組: 3項目 PASS
- コマンドの数 3231 → 3211

この版は段階 A・B の全部を当てた版を兼ねる。docs/07 の5節の4（全部を有効にした版でのスモークの全部の組・通信の監査・手の項目）は、この関門の外（リーダーの次の段取り）。

# 関門の記録: B-4-outline-view（版 `1.146.0-p2-B-4`。A-1〜A-7, B-1〜B-4）

- 検証: 大岡越前守、2026-11-14（JST 22:52〜22:55）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-4.zip`（SHA-256 `169526d3…f454`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-4\Shuko-win32-x64-1.146.0-p2-B-4\`（commit `24d98ea7…449a`）
- 比べる相手: 前の版 `1.146.0-p2-B-3`（基準 `C:\b\smoke\baseline-p2-B-3.json`。1回分、鍵 7 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。B-4 の delete 5・removeLines 1、パッチ無し。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `24d98ea7…`（`matchesChecksHead`） |
| 3. 消えている | **判定できない** | absentCommands 3件（`outline.focus`・`outline.collapse`・`outline.expand`）と absentViews `outline` は、公式・B-3 に在り B-4 に無い（網が働く）。absentSettings の3件は台本の不備 |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-4/Shuko-win32-x64-1.146.0-p2-B-4 --units A-3-debug-extensions,A-5-remote-extensions,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view --expect absent --label p2-B-4
```

- 公式（`p2-B3-B7-official-present-20261114T135012`）: B-4 は pass 7 / fail 0（コマンド3・ビュー1・設定3。設定の「在る」は台本の不備のため意味が無い）
- B-3 の版の `snapshot.json`（`p2-B-3-20261114T135030`）に3件のコマンドがある
- B-4（`C:\b\smoke\absent\p2-B-4-20261114T135233\`）: コマンド3・ビュー1 は pass。設定3件 `outline.icons`・`outline.collapseItems`・`outline.showFiles` は「在る」（台本の不備）

参考（判定には使わない）: 出力の `workbench.desktop.main.js` に `outline.icons` と `outline.collapseItems` が残るが、どちらも値を読む文（`getValue("outline.icons")` など）で、登録の文ではない。

### 指摘（蒙恬。合否とは別）

残したパンくずリストの記号の部品（`contrib/codeEditor/browser/outline` の `documentSymbolsOutline`）が、消えた設定 `outline.icons`・`outline.collapseItems` を読んでいる。登録が無くなったので値は undefined になり、パンくずリストの記号のアイコンが出なくなる見込み（推定。`getValue("outline.icons")&&(...codicon...)` の形）。mydist の既定は `breadcrumbs.enabled: false` なので、既定のままでは見えない。利用者がパンくずリストを有効にしたときの見え方を README に書くか、残す設定にするかの判断が要る。

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-4/Shuko-win32-x64-1.146.0-p2-B-4 --label p2-B-4 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-3.json --save-baseline C:/b/smoke/baseline-p2-B-4.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-4-20261114T135323\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は B-3 と同じ
- claude-code の組: 3項目 PASS
- コマンドの数 3251 → 3239

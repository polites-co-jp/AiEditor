# 関門の記録: B-5-theme-switching（版 `1.146.0-p2-B-5`。A-1〜A-7, B-1〜B-5）

- 検証: 大岡越前守、2026-11-14（JST 22:55〜23:00）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-5.zip`（builds.md の SHA-256 `6ab4a2c8…aafe`）を展開した `C:\b\p2\1.146.0-p2-B-5\Shuko-win32-x64-1.146.0-p2-B-5\`（commit `7e9e1646…f85b`）
- 比べる相手: 前の版 `1.146.0-p2-B-4`（基準 `C:\b\smoke\baseline-p2-B-4.json`。1回分、鍵 7 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。B-5 の delete 1・removeLines 4、パッチ無し。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、手順の終了コードはすべて 0。product.json の commit = HEAD `7e9e1646…`（`matchesChecksHead`） |
| 3. 消えている | **合格** | B-5 の検査は absentCommands の6件だけ。6件とも公式・B-4 に在り、B-5 に無い（網が働く） |
| 4. 壊れていない | **合格** | 2回とも PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は2回とも3項目 PASS |

**4つとも合格。B-5 を `enabled: true` にしてよい。**

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-5/Shuko-win32-x64-1.146.0-p2-B-5 --units A-3-debug-extensions,A-5-remote-extensions,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching --expect absent --label p2-B-5
```

| 項目 | 公式（present） | B-4 の版 | B-5（absent） |
|---|---|---|---|
| `workbench.action.selectTheme`・`selectIconTheme`・`selectProductIconTheme`・`toggleLightDarkThemes`・`browseColorThemesInMarketplace`・`generateColorTheme` | 6件とも在る | 6件とも在る | **6件とも無い**（pass 6） |

- 公式: `C:\b\smoke\absent\p2-B3-B7-official-present-20261114T135012\`（B-5: pass 6 / fail 0）
- B-4 の版: `C:\b\smoke\absent\p2-B-4-20261114T135233\snapshot.json` に6件ある
- B-5: `C:\b\smoke\absent\p2-B-5-20261114T135524\`。同じ実行の A-3・A-5 は pass、B-2・B-3・B-4 は設定の検査だけが台本の不備で fail（それぞれの記録）

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-5/Shuko-win32-x64-1.146.0-p2-B-5 --label p2-B-5 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-4.json --save-baseline C:/b/smoke/baseline-p2-B-5.json --timeout 300 --keep-runs 40
（同じ引数で --label p2-B-5-b2、--merge-baseline を足して1回）
```

| 実行 | 置き場所 | 結果 | `.lock` |
|---|---|---|---|
| 1 | `C:\b\smoke\runs\p2-B-5-20261114T135551\` | PASS 49 / FAIL 0 / INFO 9 | 2 個 |
| 2 | `C:\b\smoke\runs\p2-B-5-b2-20261114T135751\` | PASS 49 / FAIL 0 / INFO 9 | 3 個 |

- 1回目は `.lock` が2個（prime の本体の1個と、本番の本体の1個）で、2つめのウィンドウの分が無かった。2つめのウィンドウの Claude Code のログには `MCP Server running on port 43274` があるが、`43274.lock` は台本が数えた時点で無かった。2回目は3個（それまでの版と同じ）なので、時間の揺れと見て2回目まで走らせた。`claude.lock` は2回とも PASS（1個以上）
- テーマの適用（mydist の既定 Light Modern）は、テーマのサービスが残るので変わらない見込み。見え方は手の項目
- コマンドの数 3239 → 3231

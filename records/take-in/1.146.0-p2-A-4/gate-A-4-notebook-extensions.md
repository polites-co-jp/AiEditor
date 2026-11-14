# 関門の記録: A-4-notebook-extensions（版 `1.146.0-p2-A-4`。A-1〜A-4）

- 検証: 大岡越前守、2026-11-14（JST 22:19〜22:23）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-4.zip`（SHA-256 `4a198f11…d8ae`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-A-4\Shuko-win32-x64-1.146.0-p2-A-4\`（commit `35a89e77…609c`）
- 比べる相手: 前の版 `1.146.0-p2-A-3`（基準 `C:\b\smoke\baseline-p2-A-3.json`。1回分、鍵 5 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。A-4 の delete 2・removeLines 8、パッチ無し。検査6つ ok。absentStrings は 13 項目とも 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の6つの手順がすべて ok・終了コード 0。product.json の commit = HEAD `35a89e77…`（`productCommit.ok`、`matchesChecksHead`、展開した product.json の 188 行） |
| 3. 消えている | **判定できない** | absentSettings の1件は台本の不備で区別できない。absentCommands の2件は公式でも取れない（2節） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 1. 当たる・型検査とビルド

- ロックファイル: ok。`uncommittedEntries: 1` は作り直したロックファイル
- 後処理: 組み込み拡張 84、消え残り 0、keep.json の不足 0。`ipynb`・`notebook-renderers` は出力に無い

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-4/Shuko-win32-x64-1.146.0-p2-A-4 --units A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions --expect absent --label p2-A-4
```

| 項目 | 公式（present） | A-4（absent） |
|---|---|---|
| absentCommands `ipynb.newUntitledIpynb` | **無い** | 無い |
| absentCommands `ipynb.openIpynbInNotebookEditor` | **無い** | 無い |
| absentSettings `ipynb.pasteImagesAsAttachments.enabled` | 在る | **在る** |

結果: 公式 `C:\b\smoke\absent\p2-A2-A5-official-present-20261114T131251\`、A-4 `C:\b\smoke\absent\p2-A-4-20261114T131951\`。同じ実行の A-3 は pass 1 / fail 0（A-3 の網はこの版でも働く）。

- 設定の検査は、登録の無いキーでも「在る」を返す（A-1 の記録の2節の対照）
- コマンドの2件は、公式の実行でも登録されていない（ipynb の拡張はノートブックを開くまで起動しない見込み。推定）
- 参考（判定には使わない）: 3件の ID の文字列は、出力の `resources\app` のどこにも無い。公式では `extensions\ipynb\package.json`・`package.nls.json`・`dist\ipynbMain.node.js` にある

直す必要があるところ: A-1 の記録の2節と同じ。

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-4/Shuko-win32-x64-1.146.0-p2-A-4 --label p2-A-4 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-3.json --save-baseline C:/b/smoke/baseline-p2-A-4.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-A-4-20261114T132021\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は A-3 と同じ
- claude-code の組: 3項目 PASS
- コマンドの数 3281（A-3 と同じ）。ノートブックの部品（本体の contrib/notebook）は C-4 まで残る

# 関門の記録: B-4-outline-view（版 `1.146.0-p2-B-4-r2`。A-1〜A-7, B-1〜B-4）

- 検証: 大岡越前守、2026-11-15（JST 00:00〜00:40）
- 依頼: `tasks/2026-11-15-p2-gates-b-r2/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-B-4-r2.zip`（SHA-256 `dcf3a5d8…42a8`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-B-4-r2\Shuko-win32-x64-1.146.0-p2-B-4-r2\`（commit `b4417153…c35d`）
- 比べる相手: 前の版 `1.146.0-p2-B-3-r2`（スモークの基準 `C:\b\smoke\baseline-p2-B-3-r2.json`。2回の和）
- 注: この版から、組み込みの notion-sync に翻訳の束（`dist/i18n/shuko.notion-sync.ja.i18n.json`）と `contributes.localizations` が入っている（B-1-r2〜B-3-r2 には無い）。B-4 の単位と同じ版に入った変わり目なので、誤りの比べではそれも見た

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`、`warnings: []`。どの単位も `applied: ok`、edits は衝突なし。検査6つ ok、absentStrings はすべて 0 件。notion-sync の写しは5ファイル（翻訳の束を含む） |
| 2. 型検査とビルド | **合格** | 2つの記録の `result: ok`、終了コードはすべて 0、`warnings: []`。`sourceVersion.value` = HEAD `b4417153…`、`matchesChecksHead: true`、`productCommit.ok: true`、展開した product.json の commit も同じ。枝 `builds/1.146.0-p2-B-4-r2` が同じ commit を指す |
| 3. 消えている | **合格** | 前の版（B-3-r2）で `--expect present` が pass 7、この版で `--expect absent` が pass 7 / fail 0 / unknown 0（コマンド3・ビュー1・設定3。runtime の網） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0、errors.new「新しい誤りなし」。claude-code の組は3項目 PASS。notion-sync の `No bundle location found` が消えた（誤りが減った） |

## 1. 当たる

edits.patch は前回の関門（`records/take-in/1.146.0-p2-B-4/gate-B-4-outline-view.md`）から変わっていない。README のパンくずリストの `outline.icons` の件は前の依頼でレビュー済み。

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-3-r2/Shuko-win32-x64-1.146.0-p2-B-3-r2 --units B-4-outline-view --expect present --label r2-prev-B-4-on-B-3-r2
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-B-4-r2/Shuko-win32-x64-1.146.0-p2-B-4-r2 --units B-4-outline-view --expect absent --label r2-B-4
```

| 項目 | B-3-r2（present） | B-4-r2（absent） |
|---|---|---|
| absentCommands `outline.focus`・`outline.collapse`・`outline.expand` | 在る（runtime） | **無い** |
| absentViews `outline` | 在る（runtime） | **無い** |
| absentSettings `outline.icons`・`outline.collapseItems`・`outline.showFiles` | 在る（runtime） | **無い** |

- 結果: `C:\b\smoke\absent\r2-prev-B-4-on-B-3-r2-20261114T151211\`、`C:\b\smoke\absent\r2-B-4-20261114T151227\`

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-B-4-r2/Shuko-win32-x64-1.146.0-p2-B-4-r2 --label p2-B-4-r2 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-3-r2.json --save-baseline C:/b/smoke/baseline-p2-B-4-r2.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-B-4-r2-20261114T152253\`。PASS 49 / FAIL 0 / INFO 9。exthost 1・renderer 2・other 2。基準の鍵 4 個（B-3-r2 の5個から `No bundle location found for extension shuko.notion-sync` が抜けた）
- notion-sync: 拡張ホストのログに `_doActivateExtension shuko.notion-sync`（window1・window2）があり、`[error]` の行は無い
- 言語パック: `user-data\languagepacks.json` の `ja` に、`ms-ceintl.vscode-language-pack-ja` と並んで `shuko.notion-sync` が入る。本体の翻訳（`vscode`）は言語パックのファイルを指す。base.ui-language は PASS（`vscode.env.language = ja`）
- claude-code の組: 3項目 PASS。コマンドの数 3251 → 3239

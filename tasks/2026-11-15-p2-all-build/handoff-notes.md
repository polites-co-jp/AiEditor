# 引き渡しの覚え: B の5単位の有効化と、全部を有効にした版（蒙恬）

- 担当: 蒙恬、2026-11-15（00:41〜00:48 JST）
- 依頼: `brief.md`（このフォルダ）。手順と数字の詳細: `build-log.md`
- 結果: **完了**（brief の1〜5のすべて）

## 版

| 項目 | 値 |
|---|---|
| label | `1.146.0-p2-all` |
| 当てた単位 | 14（A-1〜A-7、B-1〜B-7。`--only` なし、`enabled: true` で選ばれた）。C-1〜C-7 は `disabled` で外れた |
| zip | `C:\b\dist\1.146.0-p2-all.zip`（373,218,781 B、2371 項目） |
| SHA-256 | `15aa0ce75ead4e7455cfe4f40557f62c2b56b4822151319271e30916e3081f6f` |
| product.json の commit | `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa` |
| 枝 | `builds/1.146.0-p2-all`（常設の clone `C:\b\vscode`。上の commit を指す） |
| 本家 | 1.146.0（`69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| 展開した場所（エディタ） | `C:\b\p2\1.146.0-p2-all\Shuko-win32-x64-1.146.0-p2-all\` |
| 起動のデータ | `C:\b\p2\1.146.0-p2-all\portable\`（私の1回の起動の分が残る。関門を空のデータで始めるなら別の場所を使う） |
| 記録 | `1.146.0-p2-all/checks.json`・`lockfile.diff`・`build-record-install.json`・`build-record.json`・`launch-check.json`（このフォルダの下） |
| ログ | `C:\b\logs\1.146.0-p2-all\` |

## brief の1〜5

| 項目 | 結果 |
|---|---|
| 1. 有効化 | `removals/` の B-1・B-2・B-3・B-4・B-7 の `unit.json` の `enabled` を `true` にした（各1行。ほかの行は触っていない）。14単位がすべて有効、C は無効のまま |
| 2. ビルド | apply・install・lockfile・typecheck（誤り 0）・package・postprocess・zip がすべて ok、終了コード 0。上書き・patches 20・30・assets・mydist・notion-sync（翻訳の束を含む）も当たった |
| 3. 起動 | `p1-launch-check.ps1` は `result: ok`。`shuko.cmd --version` の2行目は commit と同じ。普段使いのデータの6か所は変わらない。起動のログの `[error]` は前の版にもある2つだけ |
| 4. 記録 | `checks.json`: `result: ok`、当てた単位 14、`errors`・`warnings` は空、検査は ok（`--prev-tag` が無い2つは skipped）。`build-record.json`: 手順ごとの秒・ディスク・zip の SHA-256・commit・枝がある。B-7-r2 との違いは下 |
| 5. C: の空き | 始め 22.76 GB、終わり 21.33 GB（この版で 1.43 GB）。15 GB は切っていない |

## `-r2` の B-7 の版との違い

- 当てた単位は同じ14。違いは選び方（`--only` → `enabled`）と、外した C の理由の文（`not in --only` → `disabled`）だけ。
- **ソースの差は無い**。単位を当てた後の木を `git -C C:/b/wt/p2 diff --quiet` で比べた（`builds/1.146.0-p2-B-7-r2` と `builds/1.146.0-p2-all`、`680e99e9…4e39` と `d5fd4c3a…0aa` の両方で終了コード 0、`--stat` も空）。commit が違うのは apply のコミットの日時のため。
- ロックファイルの差の行数（13,611）、組み込み拡張（65 と、消した28）、zip の項目数（2371）は同じ。zip は 12,892 B 小さい（ラベルが3文字短いためと見られる。推定）。パッケージのフォルダは 8 B 大きい（理由は調べていない）。

## リーダーに知らせる点

- **C: の空きが brief の見込みより少ない**: 始めの時点で 22.76 GB だった（brief は約 28 GB）。`C:\b\dist` と `C:\b\p2` は前のビルドの終わりから増えていないので、減った 5.1 GB はほかの場所（関門の検証が書いた `C:\b\smoke\` などと見られる。測っていない。私の許可の `disk-usage.mjs` で測れる）。次の検証（スモークの全部の組と3回の基準）で 1〜数 GB 使うと見込むと、15 GB まではまだ余裕がある。
- `unit.json` の5つの変更は未コミット（コミットはリーダーの担当）。
- 作業ツリー `C:\b\wt\p2` は、この版の HEAD（`d5fd4c3a…`）と作り直したロックファイル3つの変更が残った状態。
- 既存の版の zip と展開した場所は消していない。普段使いのエディタのデータには触れていない。`scripts/` は直していない。

## docs/ との食い違い

- 見つけていない。

## テストの入口（曹参・大岡越前守向け）

- 当てたもの: `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/checks.json` の `options.only` が `null`、`units[].id` が14（すべて `enabled: true`・`applied: ok`）、`unitsSkipped` が C-1〜C-7（`reason: "disabled"`）。
- ソースの差: `git -C C:/b/wt/p2 diff --quiet builds/1.146.0-p2-B-7-r2 builds/1.146.0-p2-all` が終了コード 0。
- zip: `C:\b\dist\1.146.0-p2-all.zip` の SHA-256 が上の値と一致。展開したエディタの `resources\app\product.json` の `commit` が `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`。

## 未解決の点

- なし

## 次の担当

- 大岡越前守: 全部の組のスモークと通信の監査（`tasks/2026-11-15-p2-all-verify/`）

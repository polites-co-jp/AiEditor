# 段階 A の5単位の有効化（蒙恬、2026-11-15）

- 根拠: このフォルダの `handoff-notes.md` の「`enabled: true` にしてよい単位（今回の分）」
- 結果: 完了

## 変えたもの

次の5つの `unit.json` の5行目を `"enabled": false,` から `"enabled": true,` にした。ほかの行は変えていない（`git diff -U0` で見ると、各ファイルの変更は `@@ -5 +5 @@` の1行だけ）。

- `removals/A-1-copilot-extension/unit.json`
- `removals/A-2-accounts-extensions/unit.json`
- `removals/A-4-notebook-extensions/unit.json`
- `removals/A-5-remote-extensions/unit.json`
- `removals/A-7-unused-extensions/unit.json`

B の単位（B-1〜B-7）と C の単位には触れていない。

## 台本で確かめたこと

### 1. 本家のタグの素の作業ツリーで dry-run

`C:/b/wt/p2` はビルドを済ませた状態なので、A-1 の removeLines が一致せず途中で止まる（後述）。そこで本家のタグ 1.146.0（69047191fc4）の素の作業ツリーを別に作り、そこで流した。

```
git -C C:/b/vscode worktree add C:/b/wt/enable-a-dry --detach 1.146.0
node scripts/apply.mjs C:/b/wt/enable-a-dry --label enable-a-dryrun --dry-run --checks-out tasks/2026-11-14-p2-regate-a/enable-dry-run.json
git -C C:/b/vscode worktree remove C:/b/wt/enable-a-dry   （確かめた後に外した）
```

- 当てた単位（`units`。order の順）: A-1(110)・A-2(120)・A-3(130)・A-4(140)・A-5(150)・A-6(160)・A-7(170)・B-5(250)・B-6(260) の9つ。どれも `applied: "ok"` で、`missingDeletes`・単位の `warnings`・`conflicts` は空
- 外した単位（`unitsSkipped`）: B-1・B-2・B-3・B-4・B-7・C-1〜C-7 の12個。理由はすべて `disabled`
- パッチ: `20-product-configuration-defaults.patch`・`30-proxy-direct-without-settings.patch`（dry-run なので `skipped`）
- `errors`: 空。`result`: `ok`
- 検査: `unclassifiedExtensions` は ok（本家の組み込み拡張 95件。未分類 0）。`registeredKeys` の warn は dry-run で決まって出る `shukoConfigurationDefaults` の missing（パッチが足すキー）だけ。`remnants`・`absentStrings` は dry-run なので skipped
- 記録: `tasks/2026-11-14-p2-regate-a/enable-dry-run.json`

### 2. ビルド済みの `C:/b/wt/p2` での dry-run（参考）

最初に `C:/b/wt/p2` で流した（同じ `--checks-out` に書いたので、記録は1.で上書きした）。p2 はすでに単位を当てた後の状態のため、A-1 で `removeLines: build/npm/dirs.ts: 一致する行が無い` で止まった。これは作業ツリーの状態によるもので、単位の誤りではない。このときも `unitsSkipped` は1.と同じ12個（`disabled`）、`errors` は空だった。

## after の連なり

- 有効な9つ（A-1〜A-7・B-5・B-6）は、どれも `after: []`。`planUnits` の after の検査で誤りは出ていない（`errors` が空）
- 無効の単位の after（いまの組には効かない。有効にするときの覚え）:
  - C-1-ai: A-1・B-1・B-2
  - C-2-debug: A-3
  - C-3-remote: A-5・C-1
  - C-4-notebook: A-4・B-4・C-1・C-2
  - C-5-extension-gallery: C-1
  - C-7-breadcrumbs-outline: B-4・C-1・C-4
  - A の側は全部有効になったので、C の単位を有効にするときに足りなくなるのは B-1・B-2・B-4 と C どうしの関係だけになる。順番（order）は after の向きと合っている（after の相手はどれも order が小さい）
- A-7 と B-7 は互いに after を持たない（A-7 の keep の理由に書かれているとおり）。B-7 が無効の間も、A-7 は単独で当たる

## テストの入口（曹参へ）

- `node scripts/apply.mjs <本家のタグの素の作業ツリー> --label <label> --dry-run --checks-out <path>` を流し、`units[].id` が上の9つ（order の順）、`unitsSkipped` がほかの12個（`reason: "disabled"`）、`errors` が空、`result` が `ok` になること
- `planUnits`（`scripts/lib/apply/units.mjs`）に `removals/*/unit.json` を読ませたとき、`plan` の ID が同じ9つで、`errors` が空になること

## 気づいた点

- `git diff` が5つの `unit.json` に「LF will be replaced by CRLF」の警告を出す。変更は1行だけで、改行の種類は変えていない（作業コピーがもともと LF）
- ブランチ `builds/<label>` などのビルド済みの作業ツリーで dry-run をすると、1つめの単位で止まり、当てる単位の組は `unitsSkipped` からしか読めない。組を確かめるなら素の作業ツリーで流すのが確実

# 関門の記録: A-7-unused-extensions（版 `1.146.0-p2-A-7`。A-1〜A-7）

- 検証: 大岡越前守、2026-11-14（JST 22:39〜22:43）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-7.zip`（builds.md の SHA-256 `9db64c70…e98c`）を展開した `C:\b\p2\1.146.0-p2-A-7\Shuko-win32-x64-1.146.0-p2-A-7\`（commit `a0690779…c4c7`）
- 比べる相手: 前の版 `1.146.0-p2-A-6`（基準 `C:\b\smoke\baseline-p2-A-6.json`。3回の和、鍵 5 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。A-7 の delete 8・removeLines 26（どれも found 1）。検査6つ ok、absentStrings はすべて 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の `result: ok`、6つの手順の終了コードはすべて 0。product.json の commit = HEAD `a0690779…`（`matchesChecksHead`、展開した product.json） |
| 3. 消えている | **判定できない** | absentSettings の6件は台本の不備で区別できない。absentCommands の3件は公式でも登録されない（2節） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

## 2. 消えている

```
node tests/absent-run.mjs --units A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys --expect present --label p2-A7-B2-official-present
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-7/Shuko-win32-x64-1.146.0-p2-A-7/ --units A-3-debug-extensions,A-5-remote-extensions,A-7-unused-extensions --expect absent --label p2-A-7
```

| 項目 | 公式（present） | A-7（absent） |
|---|---|---|
| absentCommands `simpleBrowser.show`・`terminal.integrated.suggest.clearCachedGlobals`・`_mermaid-markdown.openInEditor` | **3件とも無い** | 無い |
| absentSettings `grunt.autoDetect`・`gulp.autoDetect`・`jake.autoDetect`・`simpleBrowser.focusLockIndicator.enabled`・`markdown-mermaid.languages`・`php.validate.enable` | 6件とも在る | **6件とも在る**（台本の不備） |

結果: 公式 `C:\b\smoke\absent\p2-A7-B2-official-present-20261114T133943\`、A-7 `C:\b\smoke\absent\p2-A-7-20261114T134012\`（A-3・A-5 は pass）

代わりの証拠（判定には使わない。リーダーが扱いを決める）:
- 拡張の一覧（同じ台本の `snapshot.json`）: `vscode.extension-editing`・`grunt`・`gulp`・`jake`・`mermaid-markdown-features`・`php-language-features`・`simple-browser` は A-6 の実行に在り、A-7 に無い。文法の `vscode.php` は残っている。`terminal-suggest` は A-6 の実行でも一覧に出なかった（mydist の既定 `terminal.integrated.suggest.enabled: false` の下で。理由は確かめていない）
- 9件の ID の文字列: 出力の `resources\app` では `out\vs\sessions\sessions.desktop.main.js`（と map）だけにある。中身は AI の窓（sessions）が `simpleBrowser.show` を実行する呼び出しで、登録ではない。sessions は C-1 で消す

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-7/Shuko-win32-x64-1.146.0-p2-A-7 --label p2-A-7 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-6.json --save-baseline C:/b/smoke/baseline-p2-A-7.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-A-7-20261114T134117\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は A-6 と同じ（exthost 3・renderer 2・other 2）
- ターミナル（base.terminal）・タスク（base.task。grunt・gulp・jake の自動検出が無くなっても通る）・Markdown のプレビューは PASS
- claude-code の組: 3項目 PASS（木 25 個、`claude.exe` x1）
- コマンドの数 3274 → 3273
- この版の zip は 379,089,309 B（A-6 から約 22.7 MB 減った）

## 4. 関門の3の流し直し（追記。2026-11-14 JST 23:52〜23:54）

- 依頼: `tasks/2026-11-14-p2-regate-a/brief.md`。曹参の網の直し（`tasks/2026-11-14-fix-absent-probe/`）の後に、関門の3だけを流し直した。A-7 の checks は変わっていない。2節の「代わりの証拠」は、裁定（`docs/user-decisions.md` の 2026-11-14「Phase 2 の関門で出た点」）のとおり、ここでも判定に使っていない
- 版は作り直していない（展開した `resources\app\product.json` の commit `a0690779…c4c7` は builds.md と同じ）。1・2・4 は上の合格のまま

### 実行したこと

```
node tests/absent-run.mjs --build C:/b/p0/vscode-1.146.0 --units all --expect present --label regate-official
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-6/Shuko-win32-x64-1.146.0-p2-A-6 --units A-7-unused-extensions --expect present --label regate-prev-A-7-on-A-6
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-7/Shuko-win32-x64-1.146.0-p2-A-7 --units A-7-unused-extensions --expect absent --label regate-A-7
```

| 項目 | 公式（present） | A-6 の版（present） | A-7（absent） |
|---|---|---|---|
| absentCommands `simpleBrowser.show`・`terminal.integrated.suggest.clearCachedGlobals`・`_mermaid-markdown.openInEditor` | 3件とも在る（manifest） | 3件とも在る（manifest） | 3件とも無い（pass） |
| absentSettings `grunt.autoDetect`・`gulp.autoDetect`・`jake.autoDetect`・`simpleBrowser.focusLockIndicator.enabled`・`markdown-mermaid.languages`・`php.validate.enable` | 6件とも在る（runtime+manifest） | 6件とも在る（runtime+manifest） | 6件とも無い（pass） |

結果: `C:\b\smoke\absent\regate-official-20261114T144944\`、`regate-prev-A-7-on-A-6-20261114T145333\`、`regate-A-7-20261114T145200\`。A-7 の実行は pass 9 / fail 0 / unknown 0。設定の網の対照は A-1 の記録の5節。

### 判定（流し直し）

| 関門 | 結果 | 要点 |
|---|---|---|
| 3. 消えている | **合格** | 9件とも公式と前の版（A-6）で在り、A-7 の版で無い。設定6件は実行時の網（runtime+manifest）でも見える |

**1〜4 がすべて合格。A-7 は `enabled: true` にしてよい。**

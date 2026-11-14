# 関門の記録: A-6-themes（版 `1.146.0-p2-A-6`。A-1〜A-6）

- 検証: 大岡越前守、2026-11-14（JST 22:28〜22:35）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-6.zip`（SHA-256 `f209bdf7…ebfd`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-A-6\Shuko-win32-x64-1.146.0-p2-A-6\`（commit `d6fdf3ca…5a53`）
- 比べる相手: 前の版 `1.146.0-p2-A-5`（基準 `C:\b\smoke\baseline-p2-A-5.json`。2回の和、鍵 4 個）と、その前の A-1〜A-4

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。A-6 の delete 10、edits は衝突なし。検査6つ ok。absentStrings は 19 項目とも 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の6つの手順がすべて ok・終了コード 0。product.json の commit = HEAD `d6fdf3ca…`（`productCommit.ok`、`matchesChecksHead`、展開した product.json の 188 行） |
| 3. 消えている | **合格** | A-6 の `checks` の起動して見る項目は空（消すのはテーマの拡張だけ）。起動した版の拡張の一覧で、消した10件が A-5 に在り A-6 に無く、残す2件が在ることを確かめた（2節） |
| 4. 壊れていない | **合格** | 3回とも PASS 48 / FAIL 1（errors.new の1件は A-1〜A-4 にあった既知の誤り）。claude-code の組は3回とも3項目 PASS（3節） |

**4つとも合格。A-6 を `enabled: true` にしてよい。**

## 1. 当たる・型検査とビルド

- `edits.patch` を読んだ: 変えるのは `src/vs/workbench/test/browser/componentFixtures/fixtureUtils.ts` の1ファイルで、消したテーマ5件の import と表の行を消すだけ（15 行の削除）。試験用のファイルで、ほかの単位の都合の変更は無い（docs/03 の5.3）
- ロックファイル: ok。`uncommittedEntries: 1` は作り直したロックファイル
- 後処理: 組み込み拡張 73、消え残り 0、keep.json の不足 0

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-6/Shuko-win32-x64-1.146.0-p2-A-6 --units A-3-debug-extensions,A-5-remote-extensions,A-6-themes --expect absent --label p2-A-6
```

A-6 の `absentCommands`・`absentViews`・`absentSettings`・`absentProcesses`・`absentHosts` はすべて空。台本は項目が無いと A-6 の結果を出さない（A-3・A-5 の分だけ出た。どちらも pass）。そこで、同じ台本の `snapshot.json` の拡張の一覧（`vscode.extensions.all`）を、前の版の実行と比べた。

| 拡張 | A-5（`p2-A-5-20261114T132442`） | A-6（`p2-A-6-20261114T132918`） |
|---|---|---|
| `vscode.theme-abyss`・`theme-kimbie-dark`・`vscode-modern-icons`・`theme-monokai`・`theme-monokai-dimmed`・`theme-quietlight`・`theme-red`・`theme-solarized-dark`・`theme-solarized-light`・`theme-tomorrow-night-blue`（10件） | 在る | **無い** |
| `vscode.theme-defaults`・`vscode.vscode-theme-seti`（残す2件） | 在る | 在る |

- 指摘（蒙恬）: A-6 の `checks` に起動して見る項目が1つも無い。この版では拡張の一覧で確かめたが、取り込みのたびに自動で見るには、台本が拡張の一覧を照らせるようにするか（曹参）、テーマの拡張が登録するものを `checks` に入れる必要がある

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-6/Shuko-win32-x64-1.146.0-p2-A-6 --label p2-A-6 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-5.json --save-baseline C:/b/smoke/baseline-p2-A-6.json --timeout 300 --keep-runs 40
（同じ引数で --label p2-A-6-b2 / p2-A-6-b3、--merge-baseline を足して2回）
```

| 実行 | 置き場所 | 結果 | chromium.log |
|---|---|---|---|
| 1 | `C:\b\smoke\runs\p2-A-6-20261114T132946\` | PASS 48 / FAIL 1 / INFO 9 | 1,040,196 文字 |
| 2 | `C:\b\smoke\runs\p2-A-6-b2-20261114T133131\` | PASS 48 / FAIL 1 / INFO 9 | 15,227 文字 |
| 3 | `C:\b\smoke\runs\p2-A-6-b3-20261114T133255\` | PASS 48 / FAIL 1 / INFO 9 | 15,226 文字 |

### errors.new の1件

3回とも `[exthost] Remote Control auto-enable failed: Error: Remote Control initialization failed` の1件だけ。
- この誤りは A-1〜A-4 の版の実行（8回）と Phase 1 の r3 にあり、A-1 の記録で仕分けた（セカンダリサイドバーに Claude Code のビューが開いて `claude.exe` が起動するときだけ出る）
- A-5 の2回はビューが開かなかったので出ず、A-5 の基準に入らなかった。そのため A-5 と比べると「新しい」になる
- A-6 の3回はビューが開き（`claude.exe` x1 を含む木 25 個）、A-4 までと同じ形に戻った
- 判定: テーマの単位が足した誤りではない（既知の誤り）。次の版と比べる基準 `baseline-p2-A-6.json`（3回の和、鍵 5 個）はこの誤りを含む

### 気づいた点（合否には使わない）

- 1回目だけ、Chromium のログ（開発者ツールのコンソール）に `"ResizeObserver loop completed with undelivered notifications."` が 1,943 行出た（INFO。台本は誤りに数えない）。出どころは Claude Code の Webview（`extensionId=Anthropic.claude-code`、`purpose=webviewView`）。2・3回目と、A-1〜A-5 の実行のログには無い。1回だけ起きたことで、原因は分からない。Claude Code のパネルの表示がちらつく・重くなるような症状が無いかを、ユーザーの手の項目で見てもらう
- 起動のときの Claude Code のビューは、A-5 の版の2回だけ開かなかった（A-5 の記録の3節）。A-6 の3回はすべて開いた
- claude-code の組: 3回とも `claude.running`・`claude.exthost-log`・`claude.lock` が PASS
- テーマ: 既定の `workbench.colorTheme`（mydist の Light Modern）は theme-defaults にあり、残っている。表示がそうなっているかは手の項目
- product.json の `onboardingThemes` が消したテーマ（Solarized）を指すことによる警告は、誤りの一覧に出なかった（歓迎画面は `--skip-welcome` で開いていない。B-2 で消す）

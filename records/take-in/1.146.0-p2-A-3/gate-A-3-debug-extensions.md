# 関門の記録: A-3-debug-extensions（版 `1.146.0-p2-A-3`。A-1〜A-3）

- 検証: 大岡越前守、2026-11-14（JST 22:17〜22:20）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-3.zip`（SHA-256 `259c0176…c471`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-A-3\Shuko-win32-x64-1.146.0-p2-A-3\`（commit `52359930…09ea`）
- 比べる相手: 前の版 `1.146.0-p2-A-2`（基準 `C:\b\smoke\baseline-p2-A-2.json`。3回の和、鍵 5 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。A-3 の delete 2・removeLines 6/6、パッチ無し。検査6つ ok。absentStrings は 11 項目とも 0 件（A-3 の `ms-vscode.js-debug`（product.json）は、上書きの `builtInExtensions: []` で 0 件） |
| 2. 型検査とビルド | **合格** | `build-record.json` の6つの手順がすべて ok・終了コード 0。product.json の commit = HEAD `52359930…`（`productCommit.ok`、`matchesChecksHead`、展開した product.json の 188 行） |
| 3. 消えている | **合格** | A-3 の検査は `absentCommands` の `extension.node-debug.toggleAutoAttach` の1件だけ。公式・A-1・A-2 では在り、A-3 では無い（網が働いている） |
| 4. 壊れていない | **合格** | PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は3項目 PASS |

**4つとも合格。A-3 を `enabled: true` にしてよい。** ただし A-3 は、この版で A-1・A-2 を含めて確かめた。A-1・A-2 は関門の3が判定できていない（各単位の記録）。

## 1. 当たる・型検査とビルド

- ロックファイル: ok（`extensions/pnpm-lock.yaml` だけが変わる。A-3 は依存を消さない）。`uncommittedEntries: 1` は作り直したロックファイル
- 後処理: 組み込み拡張 86、消え残り 0、keep.json の不足 0。`debug-auto-launch`・`debug-server-ready` は出力に無い
- js-debug 系3件（`builtInExtensions`）は A-1 の版から入っていない（上書きの set。build-log の 3.1）

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-3/Shuko-win32-x64-1.146.0-p2-A-3 --units A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions --expect absent --label p2-A-3
```

| 項目 | 公式（present） | A-1・A-2 の版 | A-3（absent） |
|---|---|---|---|
| absentCommands `extension.node-debug.toggleAutoAttach` | 在る | 在る | **無い**（pass） |

- 公式: `C:\b\smoke\absent\p2-A2-A5-official-present-20261114T131251\`（A-3: pass 1 / fail 0）
- A-1・A-2 の版で在ること: `p2-A-1-20261114T130554\snapshot.json`・`p2-A-2-20261114T131316\snapshot.json` にこの ID がある
- A-3: `C:\b\smoke\absent\p2-A-3-20261114T131800\`（A-3: pass 1 / fail 0）。同じ実行の A-1・A-2 の結果は、それぞれの記録と同じ（設定の検査が「在る」を返す台本の不備）
- absentViews・absentSettings・absentProcesses・absentHosts は空（通信の監査は要らない）

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-3/Shuko-win32-x64-1.146.0-p2-A-3 --label p2-A-3 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-2.json --save-baseline C:/b/smoke/baseline-p2-A-3.json --timeout 300 --keep-runs 40
```

- 置き場所 `C:\b\smoke\runs\p2-A-3-20261114T131826\`。PASS 49 / FAIL 0 / INFO 9。誤りの件数は A-2 と同じ（exthost 3・renderer 2・other 2）
- claude-code の組: `claude.running`・`claude.exthost-log`・`claude.lock` が PASS
- base の組の全項目（ターミナル・タスク・git・プレビューなど）が PASS。デバッグの組み込み拡張が消えても、タスクの実行は通った
- コマンドの数 3282 → 3281
- 1回だけ走らせた（A-1・A-2 の3回で、誤りの鍵は毎回同じ5個だった。新しい誤りが出た版だけ繰り返して揺れを見る。`tasks/2026-11-14-p2-gates/verification-log.md` の方針）。次の版の基準 `baseline-p2-A-3.json` は1回分（鍵 5 個）

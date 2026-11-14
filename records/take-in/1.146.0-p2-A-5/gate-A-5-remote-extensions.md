# 関門の記録: A-5-remote-extensions（版 `1.146.0-p2-A-5`。A-1〜A-5）

- 検証: 大岡越前守、2026-11-14（JST 22:24〜22:28）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-5.zip`（SHA-256 `d237a98e…8253`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-A-5\Shuko-win32-x64-1.146.0-p2-A-5\`（commit `ffa17004…f748`）
- 比べる相手: 前の版 `1.146.0-p2-A-4`（基準 `C:\b\smoke\baseline-p2-A-4.json`。1回分、鍵 5 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`、`errors: []`。A-5 の delete 1・removeLines 3（どれも found 1）、パッチ無し。検査6つ ok。absentStrings は 14 項目とも 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の6つの手順がすべて ok・終了コード 0。product.json の commit = HEAD `ffa17004…`（`productCommit.ok`、`matchesChecksHead`、展開した product.json の 188 行） |
| 3. 消えている | **判定できない** | 検査は `absentCommands` の2件だけで、2件とも公式でも取れない（2節） |
| 4. 壊れていない | **合格** | 2回とも PASS 49 / FAIL 0。errors.new「新しい誤りなし」。claude-code の組は2回とも3項目 PASS。起動のときのふるまいに違いがあった（3節） |

## 1. 当たる・型検査とビルド

- ロックファイル: ok。`uncommittedEntries: 1` は作り直したロックファイル
- 後処理: 組み込み拡張 83、消え残り 0、keep.json の不足 0。`tunnel-forwarding` は出力に無い

## 2. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-5/Shuko-win32-x64-1.146.0-p2-A-5 --units A-3-debug-extensions,A-5-remote-extensions --expect absent --label p2-A-5
```

| 項目 | 公式（present） | A-5（absent） |
|---|---|---|
| absentCommands `tunnel-forwarding.showLog` | **無い** | 無い |
| absentCommands `tunnel-forwarding.restart` | **無い** | 無い |

結果: 公式 `C:\b\smoke\absent\p2-A2-A5-official-present-20261114T131251\`（A-5: pass 0 / fail 2）、A-5 `C:\b\smoke\absent\p2-A-5-20261114T132442\`（A-5: pass 2、A-3: pass 1）

- 公式の `extensions\tunnel-forwarding\package.json` の `activationEvents` は `["onTunnel"]` だけで、トンネルを使わなければ起動しない。2件のコマンドは実行時に登録されないので、A-5 での「無い」は証拠にならない（蒙恬の `unit.json` の `checks`）
- 参考（判定には使わない）:
  - 2件の ID の文字列は、出力の `resources\app` のどこにも無い
  - 登録されたコマンドの一覧（スモークの `commands.json`）で、A-4 にあった `~remote.forwardedPorts.*` と `~remote.forwardedPortsContainer*` の7件が A-5 で無くなった（3281 → 3274）。ポートのビュー（パネル）が出なくなったと見られる（推定。画面は見ていない）
- 直す必要があるところ: 蒙恬が、公式の実行で「在る」になるものを `checks` に選ぶ（例: 上の `~remote.forwardedPorts.focus` は、A-4 の版で在り、A-5 の版で無い。`absentViews` に `~remote.forwardedPorts` を書けば、今の台本でも区別できる見込み。推定）
- README との食い違い（蒙恬）: `unit.json` の `intent` は「本体のリモート（contrib/remote・ポートのビュー）は C-3 まで残す」と書くが、上のとおりポートのビューのコマンドが消えた。消える範囲を README に書き足すか、残す必要があるかをリーダーが決める

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-5/Shuko-win32-x64-1.146.0-p2-A-5 --label p2-A-5 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-4.json --save-baseline C:/b/smoke/baseline-p2-A-5.json --timeout 300 --keep-runs 40
（同じ引数で --label p2-A-5-b2、--merge-baseline を足して1回）
```

| 実行 | 置き場所 | 結果 |
|---|---|---|
| 1 | `C:\b\smoke\runs\p2-A-5-20261114T132507\` | PASS 49 / FAIL 0 / INFO 9 |
| 2 | `C:\b\smoke\runs\p2-A-5-b2-20261114T132635\` | PASS 49 / FAIL 0 / INFO 9 |

起動のときのふるまいの違い（2回とも同じ）:
- Claude Code の起動のきっかけが `onStartupFinished` になった（A-1〜A-4 は `onView:claudeVSCodeSidebarSecondary`。公式は `onStartupFinished`）。セカンダリサイドバーの Claude Code のビューが起動のときに開かず、`claude.exe` が起動しなかった（止める直前の木 22 個: Shuko.exe x20、OpenConsole.exe x1、pwsh.exe x1）
- そのため、A-1〜A-4 にあった `Remote Control auto-enable failed` の誤りが出なかった（誤りの鍵 5 → 4）
- 次の版 A-6 では、3回とも元のふるまい（ビューが開き、`claude.exe` が起動する）に戻った。A-6 は A-5 を含むので、A-5 の単位がこの違いの原因とは言えない（原因は分かっていない）
- claude-code の組の自動の3項目（動作中・ログ・`.lock`）は2回とも PASS。パネルが開くこと自体は手の項目（ユーザーが Phase 2 の最後に確かめる）

判定: 新しい誤りは無く、自動の組はすべて通った。**合格。** ふるまいの違いは記録に残し、合否には使わない。

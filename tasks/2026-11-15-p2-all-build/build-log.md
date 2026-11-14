# 全部を有効にした版（`1.146.0-p2-all`）のビルドの記録

- 作成: 蒙恬（2026-11-15）。時刻は JST（記録の JSON は UTC。+9 時間）
- 依頼: `brief.md`。版の記録は `1.146.0-p2-all/`（`checks.json`・`lockfile.diff`・`build-record-install.json`・`build-record.json`・`launch-check.json`）、ログは `C:\b\logs\1.146.0-p2-all\`

## 0. 有効化

`removals/` の次の5つの `unit.json` の `"enabled": false` を `true` にした（各1行。`git diff --stat -- removals/` は 5 files changed、5 insertions、5 deletions）。

- `B-1-telemetry`・`B-2-onboarding-experiments-surveys`・`B-3-issue-share`・`B-4-outline-view`・`B-7-terminal-suggest`

根拠は `tasks/2026-11-15-p2-gates-b-r2/handoff-notes.md` の「`enabled: true` にしてよい単位（今回の分）」。これで A-1〜A-7・B-1〜B-7 の14単位が `enabled: true` になった。C-1〜C-7 は `false` のまま。

## 1. 走らせ方

作業ツリーは前と同じ `C:\b\wt\p2`。`--only` は付けていない。

```
git -C C:/b/wt/p2 checkout -f --detach 69047191fc427f2f92828279aae1d90d8eeda7ab
node scripts/apply.mjs C:/b/wt/p2 --label 1.146.0-p2-all --checks-out tasks/2026-11-15-p2-all-build/1.146.0-p2-all/checks.json
node scripts/build.mjs 1.146.0 --label 1.146.0-p2-all --worktree C:/b/wt/p2 --from install --to typecheck --take-in-dir tasks/2026-11-15-p2-all-build/1.146.0-p2-all --record tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record-install.json --no-size
node scripts/build.mjs 1.146.0 --label 1.146.0-p2-all --worktree C:/b/wt/p2 --from package --to zip --take-in-dir tasks/2026-11-15-p2-all-build/1.146.0-p2-all --record tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip C:/b/dist/1.146.0-p2-all.zip -Dest C:/b/p2/1.146.0-p2-all -OutFile tasks/2026-11-15-p2-all-build/1.146.0-p2-all/launch-check.json
```

- checkout の前、作業ツリーには B-7-r2 の版のロックファイルの変更3つが残っていた（`-f` で戻した。前の版と同じ手順）。
- `scripts/` は直していない。

## 2. 当てる（apply.mjs）00:41:45〜00:42:14（29.1 秒）

- `checks.json` の `result: ok`。`options.only: null`（単位は `enabled` で選ばれた）。`warnings`・`errors` は空。
- 当てた単位: 14（A-1〜A-7、B-1〜B-7。すべて `enabled: true`、`applied: ok`）。`unitsSkipped` は C-1〜C-7 の7つで、理由はすべて `disabled`。
- 上書き（product.overlay.json）ok、patches の 20・30 は ok（衝突なし）、assets ok（8ファイル）、組み込み拡張は mydist（3ファイル）と notion-sync（5ファイル。`dist/i18n/shuko.notion-sync.ja.i18n.json` を含む）。
- mydist の既定から外した鍵: `workbench.startupEditor`（B-2 の absentSettings）、`terminal.integrated.suggest.enabled`（B-7 の absentSettings）。
- 検査: remnants・absentStrings・unclassifiedExtensions（本家 95、未分類 0）・registeredKeys・lockfile・commitIdentity が ok。upstreamAdditions・dependencies は `--prev-tag` が無いので skipped、toolchain は info（前の版と同じ）。
- headCommit（単位を当てた後の HEAD）: `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`。

## 3. ビルド（build.mjs を2回）

| 手順 | 始め（JST） | 秒 | 終了コード | 要点 |
|---|---|---|---|---|
| install | 00:42:22 | 3.031 | 0 | `pnpm install --no-frozen-lockfile` |
| lockfile | 00:42:25 | 0.558 | 0 | `status: ok`。予期しない追加・削除・版の変化は 0 |
| typecheck | 00:42:26 | 18.897 | 0 | 誤り 0。枝 `builds/1.146.0-p2-all` を作った（`created`） |
| package | 00:42:56 | 178.474 | 0 | `pnpm run gulp vscode-win32-x64-min` |
| postprocess | 00:45:55 | 0.007 | — | `productCommit.ok: true`、組み込み拡張 65、消え残り 0、keep.json の不足 0、予期しないもの 0 |
| zip | 00:45:55 | 31.196 | 0 | 2371 項目、最上位のフォルダ `Shuko-win32-x64-1.146.0-p2-all` |

- 2つの build-record とも `result: ok`、`warnings` は空。
- `sourceVersion`: `BUILD_SOURCEVERSION` = `d5fd4c3a…0aa`（作業ツリーの HEAD）、`matchesChecksHead: true`、`uncommittedEntries: 3`（作り直したロックファイル3つ。ロックファイルはパッチにしない規則どおり）。
- 枝: install の回が `created`、package の回が `unchanged`（同じ commit を指していた）。`git -C C:/b/wt/p2 diff --quiet builds/1.146.0-p2-all d5fd4c3a…0aa` は終了コード 0。
- ディスク（build-record の `disk`）: 作業ツリー 3.94 GB（103,294 ファイル）、パッケージ 1.06 GB（1,889 ファイル）、zip 373,218,781 B。

## 4. 起動（p1-launch-check.ps1）00:47:10

- `result: ok`（"started, stayed alive, stopped; daily editor data folders unchanged"）。展開 3 秒、10 秒の確かめと 15 秒の待ち。
- プロセスの木: `Shuko.exe x8, copilot-runtime.exe x1, conhost.exe x1`（前の版と同じ）。
- `bin\shuko.cmd --version`: `1.146.0` / `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa` / `x64`（2行目が product.json の commit と同じ）。
- 普段使いのデータの6か所（`%APPDATA%\Code`・`Code - OSS`・`Shuko`、`%USERPROFILE%\.vscode`・`.vscode-oss`・`.shuko`）は前後とも無い。`changed` は空。
- 起動のログの `[error]` は2つ。`remoteTunnelService.log` の `Missing 'tunnelApplicationConfig' …`、`renderer.log` の `CodeExpectedError: No default agent contributed`。どちらも前の版にあるもの（B-1-r2 の記録と同じ）。
- 出力の `out\vs\workbench\workbench.desktop.main.js` に `_aiEdits.*` の登録の文字列が入っている（B-1 の直し）。

## 5. `-r2` の B-7 の版との違い

| 項目 | `1.146.0-p2-B-7-r2` | `1.146.0-p2-all` | 同じか |
|---|---|---|---|
| 単位の選び方 | `--only`（14単位の名指し） | `enabled: true`（`only: null`） | 違う（依頼どおり） |
| 当てた単位 | A-1〜A-7, B-1〜B-7 | A-1〜A-7, B-1〜B-7 | 同じ |
| 外した単位の理由 | C-1〜C-7、`not in --only` | C-1〜C-7、`disabled` | 理由の文だけ違う |
| ソース（単位を当てた後の木） | commit `680e99e9…4e39` | commit `d5fd4c3a…0aa` | **同じ**（`git -C C:/b/wt/p2 diff --quiet` を枝の名前と SHA の両方で流し、終了コード 0。`--stat` も空） |
| lockfile.diff | 差の行 13,611 | 差の行 13,611 | 行数が同じ |
| 組み込み拡張 | 65、消したもの 28 | 65、消したもの 28 | 同じ |
| zip の項目 | 2371 | 2371 | 同じ |
| zip の大きさ | 373,231,673 B | 373,218,781 B | 12,892 B 小さい |
| パッケージの大きさ | 1,137,741,398 B | 1,137,741,406 B | 8 B 大きい |

- commit が違うのは、apply のコミットの日時が違うため（木は同じ）。
- zip が小さいのは、ラベルが3文字短く、2371 項目すべての名前（`Shuko-win32-x64-<label>/…`）が短くなるためと見られる（推定。zip の中の名前は項目ごとに2回書かれる。2371×3×2 ≒ 14 KB）。
- パッケージの 8 B の差は調べていない。product.json の `date` は同じ長さ（`2026-11-15T00:42:05+09:00`）。

## 6. ディスク

- 始め（00:41、`node scripts/disk-usage.mjs dist=C:/b/dist p2=C:/b/p2`）: C: の空き **22.76 GB**。`C:\b\dist` 8.23 GB（zip 23個）、`C:\b\p2` 23.27 GB。
  - brief にある「約 28 GB」（前のビルドの終わり 27.86 GB）より 5.1 GB 少ない。`dist` と `p2` は前のビルドの終わりと同じ大きさなので、減った分はほかの場所（関門の検証が書いた `C:\b\smoke\` などと見られる。推定、測っていない）。
- 終わり（00:48）: C: の空き **21.33 GB**。`C:\b\dist` 8.58 GB（zip 24個）、`C:\b\p2` 24.35 GB。この版で 1.43 GB 減った。15 GB は切っていない。

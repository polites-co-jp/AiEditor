# 作り直した B-1〜B-7（`-r2`）のビルドの記録

- 作成: 蒙恬（2026-11-14）。時刻は JST
- 依頼: `brief.md`。一覧は `tasks/2026-11-14-p2-builds/builds.md`（行を足した）、版ごとの記録は `tasks/2026-11-14-p2-builds/<label>/`

## 0. 走らせ方

作業ツリーは前と同じ `C:\b\wt\p2`（Phase 2 の版を作ったもの）。版ごとに次を繰り返す（`tasks/2026-11-14-p2-builds/build-log.md` の0節と同じ）。

```
git -C C:/b/wt/p2 checkout -f --detach 69047191fc427f2f92828279aae1d90d8eeda7ab
node scripts/apply.mjs C:/b/wt/p2 --label <label> --only <A-1〜A-7, B-1〜B-k> --checks-out tasks/2026-11-14-p2-builds/<label>/checks.json
node scripts/build.mjs 1.146.0 --label <label> --worktree C:/b/wt/p2 --from install --to typecheck --take-in-dir tasks/2026-11-14-p2-builds/<label> --record tasks/2026-11-14-p2-builds/<label>/build-record-install.json --no-size
node scripts/build.mjs 1.146.0 --label <label> --worktree C:/b/wt/p2 --from package --to zip --take-in-dir tasks/2026-11-14-p2-builds/<label> --record tasks/2026-11-14-p2-builds/<label>/build-record.json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip C:/b/dist/<label>.zip -Dest C:/b/p2/<label> -OutFile tasks/2026-11-14-p2-builds/<label>/launch-check.json
```

- `build.mjs` は、この依頼で直したもの（`childEnv` が外の `BUILD_SOURCEVERSION` を外す、版の commit に枝 `builds/<label>` を付ける）。
- 作り直す前の版の展開した場所（`C:\b\p2\1.146.0-p2-B-*\`、`-r2` の付かないもの）と zip には触れていない。
- B-2-r2 以降は、1版の checkout から起動の確かめまでを `&&` でつないで背景で走らせた（B-4・B-5 と B-6・B-7 は2版ずつ）。

## 1. B-1 の直し（edits.patch）

- B-1-r2 の apply は、手で直した `edits.patch`（`aiEditTelemetryService.ts` の hunk に import 1行と登録の8行を足し、hunk の行数を直した）で当たった（`git am -3`、衝突なし。edits のコミット `508f32a1dab1e5da310798ee4f5cd56e9c452016`）。
- その commit を `git -C C:/b/wt/p2 format-patch -1 508f32a1… -o C:/b/tmp/b1-r2-patch` で書き出し、リポジトリの `edits.patch` と比べた。違いは先頭の `From <sha>`、diffstat、`index` の後の blob（`a0306222d0e`）だけだったので、その3か所をそろえた（本文の行は同じ。リポジトリの patch は空のコンテキスト行が空白なしで、前の版と同じ）。
- 出力の `out\vs\workbench\workbench.desktop.main.js` に `registerCommand("_aiEdits.hasAiContributions",()=>!1);…("_aiEdits.clearAiContributions",()=>{});…("_aiEdits.clearAllAiContributions",()=>{})` が入った（B-1-r2 と B-7-r2 で確かめた。`sessions.desktop.main.js` にも入る）。

## 2. 版ごとの結果

時間の単位は秒。install は依存の導入、pkg はパッケージ化。

| 版 | apply | install | typecheck | pkg | zip | zip の大きさ | commit | 枝（install の回 / package の回） | 起動 |
|---|---|---|---|---|---|---|---|---|---|
| B-1-r2 | ok | 2.1 | 21.9（誤り 0） | 162.5 | 33.4 | 375,088,150 | `f47742d9…450c` | created / unchanged | ok |
| B-2-r2 | ok（mydist から `workbench.startupEditor` を外した） | 3.7 | 22.5 | 175.0 | 34.8 | 374,062,449 | `b9c0a9c1…80e0` | created / unchanged | ok |
| B-3-r2 | ok | 2.8 | 26.5 | 165.7 | 35.2 | 373,532,000 | `cd09c201…afb` | created / unchanged | ok |
| B-4-r2 | ok | 2.5 | 22.5 | 158.0 | 31.0 | 373,526,904 | `b4417153…c35d` | created / unchanged | ok |
| B-5-r2 | ok | 2.1 | 18.2 | 147.5 | 32.4 | 373,474,007 | `4dd38929…b6b0` | created / unchanged | ok |
| B-6-r2 | ok | 4.2 | 33.4 | 236.7 | 38.0 | 373,463,351 | `1f4abbee…3e6d` | created / unchanged | ok |
| B-7-r2 | ok | 4.9 | 32.9 | 242.6 | 37.0 | 373,231,673 | `680e99e9…4e39` | created / unchanged | ok |

- 「枝」: 1回目の `build.mjs`（install〜typecheck）の型検査の前に `builds/<label>` を作り（`created`）、2回目（package〜zip）はすでに同じ commit を指していたので `unchanged`。記録の `branch`。
- 枝が commit を指すことを `git -C C:/b/wt/p2 diff --quiet builds/<label> <commit>` で確かめた（B-1-r2・B-7-r2。終了コード 0）。
- 後処理: どの版も `productCommit.ok: true`、`sourceVersion.matchesChecksHead: true`、組み込み拡張 65（消え残り 0、keep.json の不足 0）。
- B-6-r2・B-7-r2 は型検査とパッケージ化が前の版より長い（33 秒・240 秒ほど）。2版を続けて走らせた後半で、機械の負荷と見られる（推定。誤りは無い）。
- 起動（`p1-launch-check.ps1`）: 7版とも `result: ok`、プロセスの木は `Shuko.exe x8, copilot-runtime.exe x1, conhost.exe x1`（前の版と同じ）。B-1-r2 の起動のログの `[error]` は、`remoteTunnelService.log` の tunnelApplicationConfig と `renderer.log` の `No default agent contributed` の2つ（前の版にもあるもの）。`_aiEdits` の誤りは git の操作で出るものなので、起動だけでは見えない（関門のスモークで見る）。

## 3. ディスク

- 始め（23:14）: C: の空き 38.36 GB。
- 終わり（23:57、`node scripts/disk-usage.mjs dist=C:/b/dist p2=C:/b/p2`）: C: の空き **27.86 GB**。`C:\b\dist` 8.23 GB（zip 23個）、`C:\b\p2` 23.27 GB（展開した21版と起動のデータ）。1版でおよそ 1.5 GB 増えた（zip 0.37 GB、展開と起動のデータ 1.1 GB）。
- 一時の `C:\b\tmp\b1-r2-patch\`（format-patch の出力1つ）が残っている。私の許可には消すコマンドが無い。


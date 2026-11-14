# build.mjs の commit の直しと、A-1 だけを当てた版の作り直し（r3）の記録

- 作成: 蒙恬（2026-11-14）。時刻は JST
- 依頼: `brief.md`。直しの中身とテストの入口は `handoff-notes-meng-tian.md`

## 1. 直しの確かめ（本物の出力に当てた）

- `node --check scripts/build.mjs`: 誤りなし
- `--dry-run --worktree C:/b/wt/p1-a1 --from install --to zip --take-in-dir tasks/2026-11-14-p1-build-a1/take-in-r2`（直しの前の作業ツリーの状態。HEAD `72f45433…`）
  - `plan.typecheck.env.BUILD_SOURCEVERSION` と `plan.package.env.BUILD_SOURCEVERSION` が `72f454338508f617631589f6f3f6cfc1aff1ca8b`
  - `units` は checks.json から `A-1-copilot-extension`（`applied: ok`）、`unitsFrom.applyRan: false`
  - `sourceVersion.checksHeadCommit` が HEAD と同じ（`matchesChecksHead: true`）、`uncommittedEntries: 0`
- 後処理だけを前回の出力（`C:\b\wt\VSCode-win32-x64\`、r2、commit 無し）に当てた: 終了コード 1、`stoppedAt: postprocess`、`problems: ["出力の product.json に commit が無い"]`。記録 `ppcheck-r2-before.json`

## 2. A-1 だけを当てた版の作り直し（label `1.146.0-p1-a1-r3`）

前回（r2）と同じ当て方。作業ツリー `C:\b\wt\p1-a1` をタグの commit に戻し、同じ入力で当て直してから、依存の導入から zip まで。

```
git -C C:/b/wt/p1-a1 checkout --detach 69047191fc427f2f92828279aae1d90d8eeda7ab
node scripts/apply.mjs C:/b/wt/p1-a1 --label 1.146.0-p1-a1-r3 --only A-1-copilot-extension --overlay tasks/2026-11-14-p1-build-a1/a1-inputs/overlay-empty.json --patches tasks/2026-11-14-p1-build-a1/a1-inputs/patches-none --assets tasks/2026-11-14-p1-build-a1/a1-inputs/assets-none --extensions-src tasks/2026-11-14-p1-build-a1/a1-inputs/extensions-src --checks-out tasks/2026-11-14-build-commit-fix/take-in-r3/checks.json
node scripts/build.mjs 1.146.0 --label 1.146.0-p1-a1-r3 --worktree C:/b/wt/p1-a1 --from install --to zip --take-in-dir tasks/2026-11-14-build-commit-fix/take-in-r3 --record tasks/2026-11-14-build-commit-fix/build-record-r3.json
```

- 当てた結果（`take-in-r3/checks.json`）: `result: ok`。作業ツリーの HEAD は `cff68091803f933ffbd34c93d1a7dc14633f7a72`（当て直したので、コミットの時刻が変わり r2 の `72f45433…` とは違う。中身は同じ当て方）
- ビルド（`build-record-r3.json`、ログ `C:\b\logs\1.146.0-p1-a1-r3\`）:

| 手順 | 秒 | 結果 |
|---|---|---|
| install | 3.7 | ok（導入済みの作業ツリー） |
| lockfile | 0.5 | ok（5つ変わらず、`extensions/copilot/pnpm-lock.yaml` は removed） |
| typecheck | 19.7 | ok。`env.BUILD_SOURCEVERSION` = `cff68091…7a72` |
| package | 166.2 | ok。`env.BUILD_SOURCEVERSION` = `cff68091…7a72` |
| postprocess | 0.01 | ok。`productCommit.ok: true`（出力の commit = 渡した値） |
| zip | 38.7 | ok。3,190 項目、最上位 `Code-OSS-win32-x64-1.146.0-p1-a1-r3` |

- 出力 `C:\b\wt\VSCode-win32-x64\resources\app\product.json`: `"commit": "cff68091803f933ffbd34c93d1a7dc14633f7a72"`（215行）、`"date": "2026-11-14T21:28:15+09:00"`。`resources\app\` は直下のまま（`versionedFolder: null`。予想どおり）
- zip: `C:\b\dist\1.146.0-p1-a1-r3.zip`、406,723,259 バイト、SHA-256 `e9215f2c2df15a3b4fdd910df1e63437d35b28bf844119c9517d57860daa996c`
- 12:28:39〜12:32:41 UTC（21:28〜21:32 JST）、4分2秒

## 3. zip の中の commit の確かめ

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip C:/b/dist/1.146.0-p1-a1-r3.zip -Dest C:/b/p1/1.146.0-p1-a1-r3 -OutFile tasks/2026-11-14-build-commit-fix/launch-check-r3.json`（21:33）

- 展開した `resources\app\product.json` の `commit`: `cff68091803f933ffbd34c93d1a7dc14633f7a72`（渡した値と同じ）
- `bin\code-oss.cmd --version`: 終了コード 0、「1.146.0 / cff68091803f933ffbd34c93d1a7dc14633f7a72 / x64」（r2 は「Unknown commit」だった）
- 起動: 25 秒生きていた（`result: ok`）。プロセスの木は `Code - OSS.exe x8, copilot-runtime.exe x1, conhost.exe x1`。普段使いのデータの4か所は前後とも無い
- 気づいた点: r2 の起動とスモークでは無かった `copilot-runtime.exe` が1つ起きた。commit が入って `isBuilt` が true になり、本体の AI のエージェントのホスト（C-1 で消す部品）が asar の中の部品を読めるようになったためと見られる（推定。確かめていない）。スモークの「説明できる違い」の見直しに関わる

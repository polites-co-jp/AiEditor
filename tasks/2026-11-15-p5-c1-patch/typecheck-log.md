# C-1 の edits.patch を作るときの型検査の記録（2026-11-15）

作業ツリーは `C:\b\wt\p2`（本家 1.146.0、タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。`node_modules` は消さずに使い回した。新しい作業ツリーは作っていない。パッケージ化と zip はしていない。

型検査のコマンドは `pnpm run typecheck-client`（`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`）。`scripts/build.mjs` の `typecheck` の段だけを、`--from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch` で走らせた。記録は `trial/build-typecheck-*.json`、ログは `C:\b\logs\<label>\typecheck.log`。

## 1. 誤りの数の移り変わり

誤りの数は、ログの `error TS` の行の数（`Grep` で数えた）。

| 回 | label | 始めた時刻（UTC） | 作業ツリーの HEAD | 未コミットの変更 | 結果 | 誤り |
|---|---|---|---|---|---|---|
| 適用1 | `checks-ops.json` | 2026-11-14 23:27 | `d85cf5d7` | — | `fail`（absentStrings） | — |
| 1 | c1tc-1 | 2026-11-14 23:28 | `4518424d` | 0 | error | 397 |
| 2 | c1tc-2 | 2026-11-14 23:42 | 同上 | 5 | error | 342 |
| 3 | c1tc-3 | 2026-11-14 23:48 | 同上 | 17 | error | 266 |
| 4 | c1tc-4 | 2026-11-15 00:01 | 同上 | 44 | error | 208 |
| 5 | c1tc-5 | 2026-11-15 00:17 | 同上 | 86 | error | 126 |
| 適用2 | `checks-round2.json` | 2026-11-15 00:30 | `747ae2db` | — | `fail`（absentStrings） | — |
| 6 | c1tc-6 | 2026-11-15 00:33 | `eb36b54e` | 1 | error | 11 |
| 7 | c1tc-7 | 2026-11-15 00:34 | 同上 | 6 | **ok** | 0 |
| 8 | c1tc-8 | 2026-11-15 00:36 | 同上 | 8 | **ok** | 0 |
| 確かめ | `checks-verify.json` → c1tc-verify | 2026-11-15 00:37 | `76d2530f` | 0 | **ok** / **ok** | 0 |

- 適用1は ops だけの状態。1〜5回目はこの上で直した。
- 適用2は、`unit.json` の直し（`delete`・`removeLines` への追加、MCP の認証の3つのサービスを `kept` へ移したこと）と、その時点の edits.patch を、タグから当て直したもの。edits.patch は衝突なく当たった。absentStrings だけが落ちた。
  - 落ちた所: `contrib/chat/` 9件、`contrib/inlineChat/` 1件、`platform/agentHost/` 1件、`vs/sessions/` 3件（`build/next/index.ts`）。
  - 直し方: `build/next/index.ts` を edits.patch で直した。コメント・CSS・資料・見本のデータの6ファイルは `kept` で除外した。build の検査の文字列は `'vs/sessions/` に狭めた。
- 6〜8回目は、適用2の上で直したもの。7回目で誤りが 0 になった。8回目は残りのテストの直しの後の再確認。

### 誤りの主な種類と直し方

| 種類 | 主な所 | 直し方 |
|---|---|---|
| TS2307（消したモジュールの import） | 1〜3回目の大半。extHost の API、main・共有プロセス、workbench の残る部品、テスト | import の行と、それを使う分岐・登録・注入を消すか、何もしない実装に向けた |
| TS2304・TS2339・TS2305（消した型・名前・メンバー） | `extHost.protocol.ts`・`extHostTypeConverters.ts`・`extHost.api.impl.ts` | 消した API の Shape・DTO・ID と変換を消した。`vscode.chat`・`vscode.lm` は `extHostRemovedApi.ai.ts` へ |
| TS2554（引数の数） | 注入を外したクラスの派生（`emptyCellEditorHint.ts` など） | `super(...)` の引数を合わせた |
| TS6133・TS6138（使われなくなった import・private のメンバー。`noUnusedLocals`） | 6回目の11件の多く | 消した。`decorationAddon.ts` の `_resource` はふつうの引数にした |

## 2. タグからの当て直しで確かめたこと

コマンド（作業ツリーは `C:\b\wt\p2` を使い回した）:

```
node scripts/apply.mjs C:/b/wt/p2 --label c1-verify --only <A・B の14単位>,C-1-ai --checks-out tasks/2026-11-15-p5-c1-patch/trial/checks-verify.json
node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c1-patch/trial/build-typecheck-verify.json ...
```

- 適用の結果は `result: ok`。15単位すべてが `applied: ok`。
  - C-1-ai の ops は commit `6b4bb83c`、edits（`unit C-1-ai: edits`）は commit `38c06920`。`conflicts: []`。
  - その後の `patches/20`・`patches/30`・assets・組み込み拡張（mydist・notion-sync）も `ok`。HEAD は `76d2530fb55f93556bcfaf85a0f937791249ef54`。
- 検査の `remnants` は `ok`（items 空）、`absentStrings` も `ok`。
- `removedDefaults` に `chat.disableAIFeatures`（C-1-ai）が出た。設定が無くなるので、`mydist` の既定から外れる（README の「影響しうるもの」の想定どおり）。
- 型検査は `result: ok`、`exitCode: 0`。誤りは 0（ログ `C:\b\logs\c1tc-verify\typecheck.log`）。`BUILD_SOURCEVERSION` は HEAD と一致し、未コミットの変更は 0。
- edits.patch: 100ファイル（新規2）、710行の追加、5106行の削除。From の commit は `223634df21c76b09e9ad1afc2445780e31df3e1b`（作った時の commit。当て直すと別の sha になる）。作者は `shuko-apply`。

## 3. ディスク

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（2026-11-14 23:26 UTC） | 21.22 GB（22,786,871,296 バイト） | `disk-start.json` |
| 終わり（2026-11-15 00:38 UTC） | 20.09 GB（21,573,709,824 バイト） | `disk-end.json` |

- 減ったのは約 1.13 GB。15 GB には近づいていない。
- 作業ツリー `C:\b\wt\p2` は 3.8 GB（96,161ファイル。`build-typecheck-verify.json` の `disk.worktree`）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` には触れていない。
- `disk.package`（`C:\b\wt\VSCode-win32-x64`、1.06 GB）は以前からあるもので、今回は作っていない。

## 4. 2回目（2026-11-15、パッケージ化の前に要る直し）

| 回 | 記録 | 時刻（UTC） | HEAD | 結果 | 誤り |
|---|---|---|---|---|---|
| 直しの後の型検査 | `trial/round2-typecheck-1.json`（c1tc2-1） | 00:58 | `38c06920`＋未コミット10 | ok | 0 |
| 当て直し（1） | apply（c1r2-verify。記録は（2）で上書きした） | 01:00 ごろ | `5c04a6fe` | ok（C-1 の edits は衝突なし） | — |
| 型検査 | `trial/round2-typecheck-verify.json`（c1tc2-verify） | 01:01 | `5c04a6fe` | ok | 0 |
| 当て直し（2）。unit.json に `pnpm-workspace.yaml` の2行を足した後 | `trial/round2-checks-verify.json`（c1r2-verify2） | 01:03 | `f6336a8d` | ok（衝突なし、warnings 空） | — |
| ロックファイルだけ作り直す | `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` | 01:03 | 同上 | 削除だけ768行（`trial/round2-lockfile.diff`） | — |
| ロックファイルの検査 | `apply.mjs --lockfile-check`（同じ記録に追記） | 01:04 | 同上 | **fail**（`changedSections: patchedDependencies` だけ） | — |
| 型検査 | `trial/round2-typecheck-verify2.json`（c1tc2-verify2） | 01:04 | `f6336a8d` | ok | 0 |

- 2つ目の当て直しの前に、`pnpm install --lockfile-only` は `ERR_PNPM_UNUSED_PATCH`（`foundry-local-sdk` のパッチが使われない）で止まった。そこで、`pnpm-workspace.yaml` の `patchedDependencies` の2行とパッチのファイルを unit.json に足した。
- `round2-checks-verify.json` の `result` は、ロックファイルの検査を追記したので `fail` になっている。適用そのものの結果は `ok`。
- ロックファイルは検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。作業ツリーは当てた直後の状態で、未コミットの変更は 0。
- build/ の側: `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`。
  - 最初は20件の誤り。うち19件は、生成されるファイル `build/lib/policies/policyDto.ts` が無いためだった。本家の `pretypecheck` の `copy-policy-dto` に当たるが、許可に無い。
  - そこで同じ写しを手で置いた。git の管理外（`build/.gitignore`）。
  - 残る1件は `build/gulpfile.vscode.ts` 139行の `never`。原因は `product.overlay.json` の `builtInExtensions: []`（A-3）で、C-1 とは関係ない。
- ディスク: 始め 20.09 GB（`disk-start-2.json`）、終わり 19.91 GB（`disk-end-2.json`）。

## 5. 3回目（2026-11-15、`compareLockfile` の直しと「バージョン情報」）

| 回 | 記録 | 時刻（UTC） | HEAD | 結果 | 誤り |
|---|---|---|---|---|---|
| 当て直し | `trial/round3-checks-verify.json`（c1r3-verify） | 01:13 | `15ac0428` | ok（15単位、C-1 の edits は衝突なし） | — |
| 型検査 | `trial/round3-typecheck-verify.json`（c1tc3-verify） | 01:14 | `15ac0428` | ok | 0 |
| ロックファイルだけ作り直す、検査 | `--lockfile-check`（同じ記録に追記。差分は `trial/round3-lockfile.diff`） | 01:14 | 同上 | **ok**（`changedSections: []`、`removedPatches: ["foundry-local-sdk"]`） | — |

- ロックファイルは検査の後に戻した。作業ツリーの未コミットの変更は 0。
- build/ の型検査は、2回目と同じ1件（A-3 の `builtInExtensions: []`）だけ。
- ディスク: 終わり 19.70 GB（`disk-end-3.json`）。

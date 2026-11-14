# Phase 2: 土台と、A-1〜B-7 を1単位ずつ足した版のビルドの記録

- 作成: 蒙恬（2026-11-14）。時刻は JST
- 依頼: `brief.md`。一覧は `builds.md`、版ごとの記録は `<label>/`

## 0. 走らせ方

作業ツリーは1つ（`C:\b\wt\p2`）。版ごとに次を繰り返す（依存の導入を2回目から短くするため。Phase 1 の r2・r3 と同じやり方）。

```
git -C C:/b/wt/p2 checkout --detach 69047191fc427f2f92828279aae1d90d8eeda7ab      # 2版目から
node scripts/apply.mjs C:/b/wt/p2 --label <label> [--only <id,...>] --checks-out tasks/2026-11-14-p2-builds/<label>/checks.json
node scripts/build.mjs 1.146.0 --label <label> --worktree C:/b/wt/p2 --from install --to typecheck --take-in-dir tasks/2026-11-14-p2-builds/<label> --record tasks/2026-11-14-p2-builds/<label>/build-record-install.json --no-size
node scripts/build.mjs 1.146.0 --label <label> --worktree C:/b/wt/p2 --from package --to zip --take-in-dir tasks/2026-11-14-p2-builds/<label> --record tasks/2026-11-14-p2-builds/<label>/build-record.json
```

- `apply.mjs` の入力は既定（`product.overlay.json`・`patches/`・`assets/`・`extensions-src/`・`builtin/keep.json`）。単位は `--only` で選ぶ。`--until` は `enabled: true` の単位の中でしか効かない（`scripts/lib/apply/units.mjs` の `planUnits`。今はどの単位も `enabled: false`）ので、`--only` に「それまでの単位」を並べる。
- `build.mjs` を2回に分けたのは、1回の台本の待ちの上限（10分）に収めるため。記録は2つ（`build-record-install.json`・`build-record.json`）。
- 作業ツリー `C:\b\wt\1.146.0` には触れない。gulp の出力 `C:\b\wt\VSCode-win32-x64\` は版ごとに上書きされる（zip は消さない）。

## 1. 作業ツリーの用意

- `node scripts/prepare.mjs --tag 1.146.0 --worktree C:/b/wt/p2 --out tasks/2026-11-14-p2-builds/prepare.json`（21:30）: fetch 3.1 秒、worktree add 11.8 秒。タグの commit と HEAD はどちらも `69047191…7ab`、`status` は空。

## 2. 土台の版 `1.146.0-p2-base`: パッケージ化で落ちた

- 当てた結果（`1.146.0-p2-base/checks.json`）: `result: ok`。上書きは18キー、patches 20・30 は衝突なし、assets は8ファイル、mydist と notion-sync を写した。単位は0。HEAD `4a8f3f31b604d64a4dca5eced94eabd117db9072`
- 依存の導入 202.3 秒（新しい作業ツリーの初回。キャッシュは温まっている）、ロックファイル ok（6つとも変わらない）、型検査 20.3 秒で誤り 0（`build-record-install.json`）
- **パッケージ化は 8.7 秒（gulp の 6.47 秒）で落ちた**（`build-record.json`、`C:\b\logs\1.146.0-p2-base\package.log` の76〜82行）:

```
'vscode-win32-x64-min' errored after 6.47 s
Error: Command failed: C:\Program Files\nodejs\node.exe C:\b\wt\p2\extensions\copilot\.esbuild.mts
Error: VSCODE_QUALITY environment variable is not set. This should be set by the build pipeline to ensure correct versioning and pre-release status in package.json.
```

- 原因: `extensions/copilot/.esbuild.mts` の306〜309行は、`BUILD_SOURCEVERSION` があると CI とみなして `applyPackageJsonPatch()` を呼ぶ。410〜414行は、そこで `VSCODE_QUALITY` が無いと止める。commit の直し（`tasks/2026-11-14-build-commit-fix/`）で `BUILD_SOURCEVERSION` を渡すようになったため、Phase 1 の無改造のビルド（このタスクは 63 秒で通り、後の `prepareCopilotRipgrepShimTask` で落ちた）より前で落ちる。
  - `VSCODE_QUALITY` を足しても、その先の `prepareCopilotRipgrepShimTask` で落ちる見込み（裁定 2026-11-14 の不具合）。どちらも A-1 で copilot の拡張を消せば起きない。
  - 作業ツリーで `BUILD_SOURCEVERSION` を読むのは、ほかに `build/lib/getVersion.ts`・`build/hygiene.ts`・`build/azure-pipelines/*`・試験のファイルだけ（`.esbuild.mts` のほかに、パッケージ化で通るところは見つからなかった）。
- **brief の注意のとおり、A-1 を含めた版（`1.146.0-p2-A-1`。`--only A-1-copilot-extension`）を土台とする。** この版は「土台」と「A-1 を足した版」を兼ねる。

## 3. 版ごとの結果

時間の単位は秒。install は依存の導入、pkg はパッケージ化。ディスクは build.mjs の `disk`（作業ツリーは `.git` を除く）。

### 3.1 `1.146.0-p2-A-1`（土台を兼ねる）

- 当てた結果: `result: ok`。A-1 は delete 2・removeLines 8/8・edits 衝突なし。上書き・patches 20・30・assets・mydist・notion-sync も当たった。検査は remnants・absentStrings・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity が ok（upstreamAdditions・dependencies は `--prev-tag` が無いので skipped）
- install 3.8 / lockfile 0.6 / typecheck 20.0（誤り 0）/ pkg 167.0 / postprocess 0.01 / zip 36.7
- 出力: `Shuko.exe`、`bin\shuko.cmd`、`resources\app\` は直下。product.json の commit は HEAD `3f478e8b…c684` と一致。組み込み拡張 91（消え残り 0、keep.json の不足 0、mydist・notion-sync あり。notion-sync は `dist\extension.js` も入った）。`notShipped` 4（本家の試験の拡張）、keep.json に無いもの（情報）26
- **notion-sync はパッケージ化を通った**（`package.log` に「has production dependencies」は無い。`tasks/2026-11-14-notion-sync-deps/` の直しが効いた）
- product.json の上書きの `builtInExtensions: []` により、js-debug 系3つ（`ms-vscode.js-debug` など）は出力に入らなかった（Phase 1 の r2・r3 には入っていた）
- ディスク: 作業ツリー 4.50 GB（131,024 ファイル）、出力 1.17 GB（2,528）、zip 404,985,774 B（3,092 項目）

### 3.2 `1.146.0-p2-A-2`（A-1, A-2）

- 当てた結果: ok。A-2 は delete 3・removeLines 10/10、パッチ無し
- install 4.3 / lockfile 0.6 / typecheck 20.8（誤り 0）/ pkg 175.1 / zip 39.6
- ロックファイル: `extensions/pnpm-lock.yaml` が変わった。importers から github・github-authentication・microsoft-authentication が消え（期待どおり）、packages・snapshots から 43 件（msal・octokit・keytar の mock など）が消えた。追加・版の変化は 0（`lockfile.status: ok`）。作業ツリーには、この作り直したロックファイルの変更が1つ残る（`sourceVersion.uncommittedEntries: 1`。ロックファイルはパッチにしない規則どおり）
  - README の未確認「overrides の `file:microsoft-authentication/packageMocks/keytar` で止まらないか」: 止まらなかった
- 出力: 組み込み拡張 88（消え残り 0、keep.json の不足 0）。commit は HEAD `47a15a84…9546` と一致
- ディスク: 作業ツリー 4.41 GB、出力 1.16 GB、zip 402,107,091 B（3,054 項目）
- 次の版から、作業ツリーを戻すときは `checkout -f`（作り直したロックファイルの変更を捨てる）にした

### 3.3 `1.146.0-p2-A-3`（A-1〜A-3）

- 当てた結果: ok。A-3 は delete 2・removeLines 6/6。absentStrings の `ms-vscode.js-debug`（product.json）は 0 件（上書きの `builtInExtensions: []`）
- install 2.9 / typecheck 20.7（誤り 0）/ pkg 190.5 / zip 39.7。ロックファイル ok（`extensions/pnpm-lock.yaml` だけ変わる）
- 出力: 組み込み拡張 86。commit は HEAD `52359930…09ea` と一致。zip 402,063,558 B（3,036 項目）

### 3.4 `1.146.0-p2-A-4`（A-1〜A-4）

- 当てた結果: ok。A-4 は delete 2・removeLines 8/8
- install 3.4 / typecheck 21.5（誤り 0）/ pkg 185.5 / zip 40.5。`compile-extension-media-build` は消した台本を探さずに通った（README の未確認）
- 出力: 組み込み拡張 84。commit は HEAD `35a89e77…609c` と一致。zip 401,919,773 B（3,015 項目）

### 3.5 `1.146.0-p2-A-5`（A-1〜A-5）

- 当てた結果: ok。A-5 は delete 1・removeLines 3/3
- install 5.5 / typecheck 21.1（誤り 0）/ pkg 182.7 / zip 38.6
- 出力: 組み込み拡張 83。commit は HEAD `ffa17004…f748` と一致。zip 401,906,673 B（3,005 項目）。起動 ok

### 3.6 `1.146.0-p2-A-6`（A-1〜A-6）

- 当てた結果: ok。A-6 は delete 10・edits（`fixtureUtils.ts`）衝突なし
- install 3.0 / typecheck 21.1（誤り 0。README の未確認「edits.patch の後に型検査が通るか」は通った）/ pkg 171.0 / zip 37.6
- 出力: 組み込み拡張 73（テーマ10が消えた）。commit は HEAD `d6fdf3ca…5a53` と一致。zip 401,740,834 B（2,836 項目）。起動 ok

### 3.7 `1.146.0-p2-A-7`（A-1〜A-7。段階 A の全部）

- 当てた結果: ok。A-7 は delete 8・removeLines 26/26
- install 5.3 / typecheck 21.6（誤り 0）/ pkg 163.8 / zip 34.2
- 出力: 組み込み拡張 65。**keep.json に無い拡張は 0**（`unexpected: []`。段階 A で未分類のものが無くなった）。commit は HEAD `a0690779…c4c7` と一致。zip 379,089,309 B（2,409 項目。terminal-suggest などが消えて 23 MB 減った）。作業ツリー 4.00 GB、出力 1.09 GB。起動 ok

### 3.8 `1.146.0-p2-B-1`（A-1〜A-7, B-1）

- 当てた結果: ok。B-1 は delete・removeDependencies（1ds の2つを3つの package.json から）・removeLines・edits（1dsAppender の3ファイルの差し替え、`NullAiEditTelemetryService`）が衝突なし
- install 4.8 / typecheck 25.2（誤り 0。README の未確認「`noUnusedLocals` のもとで差し替えの3ファイルが通るか」「`EditSuggestionId.newId()`」は通った）/ pkg 169.2 / zip 37.3
- ロックファイル: `pnpm-lock.yaml` と `remote/pnpm-lock.yaml` から 1ds の2つ（と依存の applicationinsights の3つ）が消えた。版の変化・追加・想定外の削除は 0（`status: ok`）。README の未確認「依存の削除の後の `pnpm install` が通るか」は通った
- 出力: 組み込み拡張 65（変わらず）。commit は HEAD `76c0069e…a386` と一致。zip 375,085,283 B（2,409 項目）、出力 1.07 GB（1ds の SDK が抜けた）。起動 ok

### 3.9 `1.146.0-p2-B-2`（A-1〜A-7, B-1, B-2）

- 当てた結果: ok。B-2 は delete 4・removeLines 12/12・productRemove 2（`onboardingKeymaps`・`onboardingThemes`）・edits（`noopAssignmentService.ts`、`remote.ts`）衝突なし。`apply.mjs` が mydist の既定から `workbench.startupEditor` を外した（B-2 の absentSettings。`checks.json` の `builtinExtensions.removedDefaults`）
- install 5.3 / typecheck 23.1（誤り 0。README の未確認「`assignmentService.ts` の末尾の import」「`import type` の循環」は型検査では問題なし。lint は走らせていない）/ pkg 179.0 / zip 32.3
- `build/next/resources.ts` の画像の glob（消したフォルダ）でパッケージ化は止まらなかった（README の未確認）
- 出力: 組み込み拡張 65。commit は HEAD `f77fe72c…3964` と一致。zip 374,047,294 B（2,369 項目）。起動 ok

### 3.10 `1.146.0-p2-B-3`（A-1〜A-7, B-1〜B-3）

- 当てた結果: ok。B-3 は delete・removeLines 6/6・productRemove（`reportIssueUrl`）・edits（`NullWorkbenchIssueService`・`NullShareService`）衝突なし
- install 3.4 / typecheck 19.1（誤り 0。README の未確認「`NullShareService` が `IShareService` に合うか」は通った）/ pkg 151.9 / zip 45.3
- 出力: 組み込み拡張 65。commit は HEAD `8ea9b15c…cb0` と一致。zip 373,520,775 B（2,369 項目）。起動 ok

### 3.11 `1.146.0-p2-B-4`（A-1〜A-7, B-1〜B-4）

- 当てた結果: ok。B-4 は delete・removeLines 1/1、パッチ無し
- install 2.2 / typecheck 25.4（誤り 0）/ pkg 166.4 / zip 31.6
- 出力: 組み込み拡張 65。commit は HEAD `24d98ea7…449a` と一致。zip 373,505,675 B（2,369 項目）。起動 ok

### 3.12 `1.146.0-p2-B-5`（A-1〜A-7, B-1〜B-5）

- 当てた結果: ok。B-5 は delete 1・removeLines 4/4、パッチ無し
- install 2.4 / typecheck 21.1（誤り 0）/ pkg 173.9 / zip 33.8
- 出力: 組み込み拡張 65。commit は HEAD `7e9e1646…f85b` と一致。zip 373,449,690 B（2,369 項目）。起動 ok

### 3.13 `1.146.0-p2-B-6`（A-1〜A-7, B-1〜B-6）

- 当てた結果: ok。B-6 は delete 1・removeLines 2/2、パッチ無し
- install 2.5 / typecheck 21.2（誤り 0）/ pkg 167.1 / zip 39.1
- 出力: 組み込み拡張 65。commit は HEAD `f9ada20a…eac` と一致。zip 373,448,580 B（2,369 項目）。起動 ok

### 3.14 `1.146.0-p2-B-7`（A-1〜A-7, B-1〜B-7。段階 A・B の全部）

- 当てた結果: ok。B-7 は delete 2・removeLines 2/2・edits（5ファイル）衝突なし。`apply.mjs` が mydist の既定から `terminal.integrated.suggest.enabled` も外した（B-7 の absentSettings）
- install 2.4 / typecheck 23.3（誤り 0。README の未確認「`const enum` に文字列の値を混ぜた行」「`suggestEnabled = false` のもとでの未使用」は通った）/ pkg 170.7 / zip 33.0
- 出力: 組み込み拡張 65。commit は HEAD `cc5d4fd8…e77e` と一致。zip 373,218,259 B（2,369 項目）。作業ツリー 3.94 GB、出力 1.06 GB。起動 ok

### 3.15 まとめ

| 版 | install | typecheck | pkg | zip | 出力 | zip |
|---|---|---|---|---|---|---|
| A-1 | 3.8 | 20.0 | 167.0 | 36.7 | 1.17 GB | 405.0 MB |
| A-7 | 5.3 | 21.6 | 163.8 | 34.2 | 1.09 GB | 379.1 MB |
| B-7 | 2.4 | 23.3 | 170.7 | 33.0 | 1.06 GB | 373.2 MB |

- 型検査・パッケージ化は、単位が増えても目立って変わらなかった（型検査 19〜25 秒、パッケージ化 152〜191 秒）。1版の当て直しから zip と起動の確かめまで、おおよそ 5 分（依存の導入済みの作業ツリーで）。
- ディスク（23:05、`disk-after.json`）: `C:\b\dist` 5.80 GB（zip 16個。Phase 1 の r2・r3 を含む）、`C:\b\p2` 15.73 GB（展開した14版と起動のデータ）、作業ツリー `C:\b\wt\p2` 3.94 GB（hard link を1回だけ数えると 3.35 GB）、gulp の出力 1.06 GB。**C: の空きは 39.09 GB**（作業を始めた 21:30 ごろは約 77 GB）。

## 4. 展開と1回の起動（リーダーの追加の指示、22:01〜）

検証役には zip を展開する許可が無いので、版ごとに `scripts/p1-launch-check.ps1 -Zip C:/b/dist/<label>.zip -Dest C:/b/p2/<label> -OutFile tasks/2026-11-14-p2-builds/<label>/launch-check.json` を走らせる。A-1〜A-4 はさかのぼって行った。

- `p1-launch-check.ps1` は `-Dest` を `C:\b\p1` の下に限っていた。`C:\b\p1` と `C:\b\p2` の下を許すように直した（`$destRoots`。既定は `C:\b\p1` のまま。断るときの文は「refusing a path outside C:\b\p1 and C:\b\p2」で、`tests/p1-scripts.test.mjs` の `/outside C:\\b\\p1/` にも合う）。`scripts/p0-check-ps.ps1` で構文の誤り 0・ASCII 以外 0 バイト。
- A-1〜A-4: どれも `result: ok`。展開 4〜14 秒。プロセスの木はどれも `Shuko.exe x8, copilot-runtime.exe x1, conhost.exe x1`。`--version` の2行目が product.json の commit と同じ。普段使いのデータの6か所は前後とも無い。
- `copilot-runtime.exe` が1つ起きる（A-1 で copilot の拡張は消えたが、本体の AI のエージェントのホストが同梱の runtime を起こす。C-1 の範囲。推定）。

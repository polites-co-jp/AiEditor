# Phase 1: 本家 1.146.0 の無改造のビルドの記録

- 作成: 蒙恬（2026-11-13）
- 状態: **パッケージ化で止まった**（2026-11-14 19:32）。依存の導入と型検査は通った。パッケージ化（`vscode-win32-x64-min`）は本家 1.146.0 の手元のビルドの不具合で落ち、`git clean -xfd` の後もう一度走らせても同じだった。zip はまだ無い。落ちる前にできた出力を起動すると、Smart App Control が自分でビルドしたネイティブのモジュールを止めた（5.7）。再開の記録は5節。
- 前の状態（2026-11-13 21:44）: 作業ツリーまで済み。環境に足りないものが4つあった（`env-check.md`）。clone と作業ツリーは、リーダーの指示（ユーザーが環境を入れている間に進める）で先に作った（4節）。

## 1. 再開するときに走らせる順（予定）

環境が足りたら（`scripts/check-env.ps1` の `missing` が空）、次の順に進め、各手順の開始と終了の時刻とディスクをこの記録に足す。

| 順 | コマンド | 確かめること |
|---|---|---|
| 1 | `git clone https://github.com/microsoft/vscode.git C:/b/vscode` | 済み（4節） |
| 2 | `git -C C:/b/vscode worktree add C:/b/wt/1.146.0 1.146.0` | 済み（4節。commit は一致） |
| 3 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -WorkTree C:\b\wt\1.146.0` | 作業ツリーの `.nvmrc` と `packageManager` で、もう一度確かめる |
| 4 | `pnpm --dir C:/b/wt/1.146.0 install` | 所要時間、`node_modules` と pnpm の store・node-gyp と Electron のキャッシュの大きさ、ロックファイルが変わらないこと |
| 5 | 型検査（候補 `typecheck-client`。下の2節） | 所要時間、誤りの数（無改造なので 0 の見込み） |
| 6 | `pnpm --dir C:/b/wt/1.146.0 run gulp vscode-win32-x64-min` | 所要時間、出力 `C:\b\VSCode-win32-x64\` の大きさと形（`resources\app\` が直下か、commit の先頭10桁の下か）、実行ファイルの名前 |
| 7 | `C:\Windows\System32\tar.exe -a -c -f C:\b\dist\<label>.zip -C C:\b <フォルダ>` | zip が作れるか、SHA-256、大きさ |
| 8 | `VSCODE_PORTABLE` で置き場所を分けて起動 | ユーザーのデータ・拡張・`argv.json` の実際の場所（子のプロセスから `ELECTRON_RUN_AS_NODE` などを外す） |

時刻とディスクの記録、1 と 2 の commit の照合、7 と 8 は、許可に無いコマンドを使わずに済むよう `scripts/` の台本（Phase 1 の再開のときに作る `build.mjs` の一部）から走らせる。

## 2. タグのソースで先に確かめたこと（ビルドの前）

GitHub の raw（タグ 1.146.0）で読んだ。

- `package.json`: `"packageManager": "pnpm@12.16.0"`。`nativeBuild.target` は `43.8.6`。`engines` は無い。
- scripts:
  - `gulp`: `node --experimental-strip-types --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js`
  - `compile`: `npm-run-all2 -lp compile-client compile-copilot`（`compile-client` は `pnpm run gulp compile`）。型検査だけではなく、出力を作り、copilot のコンパイルも含む
  - `typecheck-client`: `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`。**型検査だけを走らせる script の第一候補**
  - `valid-layers-check`: `node build/checker/layersChecker.ts && node build/checker/layersTypeCheck.ts`（層の規則の検査）
  - `monaco-compile-check`・`vscode-dts-compile-check`・`tsec-compile-check`: 部分の検査
  - `preinstall`: `node build/npm/preinstall.ts`、`postinstall`: `node build/npm/postinstall.ts`
  - `smoketest`: `node build/lib/preLaunch.ts && cd test/smoke && pnpm run compile && node test/index.js`
- `build/npm/preinstall.ts` が止める条件: `npm_config_node_gyp` が無い、Node.js が `.nvmrc` と違うメジャーか古い（`VSCODE_SKIP_NODE_VERSION_CHECK` で飛ばせるが使わない）、pnpm でないか pnpm の版が合わない、Windows で Visual Studio のフォルダが無い。続けて Electron と node のヘッダーを入れ、`build/npm/headers` を重ねる。
- `pnpm-workspace.yaml`: `nodeLinker: hoisted`、`strictDepBuilds: true`、`minimumReleaseAge: 10080`（7日。`@anthropic-ai/*`・`@vscode/*` などは除外）、`allowBuilds` でネイティブのビルドを許す・許さないを列挙。

## 3. 誤り

- 4節（clone と作業ツリー）: 無し。
- 5節（2026-11-14）: パッケージ化が本家 1.146.0 の不具合で落ちる（5.5）。落ちる前の出力を起動すると Smart App Control が止める（5.7）。

## 4. clone と作業ツリー（2026-11-13 21:39〜21:44、JST）

台本 `scripts/prepare.mjs`（新規。docs/02 の4節の1）で走らせた。記録は同じフォルダの `prepare.json`。中で走らせた git のコマンドは、リーダーの指示の3つと、確かめの `rev-parse`・`status --porcelain`。

```
node scripts/prepare.mjs --out tasks/2026-11-13-p1-build-upstream/prepare.json
```

| 手順 | 中で走らせたコマンド | 所要時間 | 結果 |
|---|---|---|---|
| clone | `git clone https://github.com/microsoft/vscode.git C:\b\vscode` | 171.4 秒 | 成功（全履歴、main を checkout） |
| fetch | `git -C C:\b\vscode fetch --tags` | 51.9 秒 | 成功 |
| タグの commit | `git -C C:\b\vscode rev-parse refs/tags/1.146.0^{commit}` | 0.02 秒 | `69047191fc427f2f92828279aae1d90d8eeda7ab`（`upstream.json` と一致） |
| 作業ツリー | `git -C C:\b\vscode worktree add --detach C:\b\wt\1.146.0 refs/tags/1.146.0` | 43.3 秒 | 成功 |
| 作業ツリーの HEAD | `git -C C:\b\wt\1.146.0 rev-parse HEAD` | 0.04 秒 | `69047191fc427f2f92828279aae1d90d8eeda7ab`（一致） |
| 変更が無いこと | `git -C C:\b\wt\1.146.0 status --porcelain` | 0.4 秒 | 空（変更なし） |

合計 約 4 分 30 秒（台本の開始 12:39:32Z〜終了 12:44:02Z）。

許可の形で直接も確かめた: `git -C C:/b/wt/1.146.0 status` は「Not currently on any branch. / nothing to commit, working tree clean」（タグで切り離した HEAD）。`C:\b\wt\1.146.0\.nvmrc` は `24.22.1`。`scripts/check-env.ps1 -WorkTree C:/b/wt/1.146.0` は作業ツリーから `node 24.22.1`・`pnpm 12.16.0` を読み、GitHub の raw で読んだ値と一致した。

ディスク（台本が数えた。シンボリックリンクはたどらない）:

| 場所 | 大きさ | ファイル数 |
|---|---|---|
| `C:\b\vscode\.git`（全履歴） | 1.64 GB（1,755,875,426 バイト） | 72 |
| `C:\b\vscode` の checkout（main。`.git` を除く） | 0.34 GB | 21,342 |
| `C:\b\wt\1.146.0`（`.git` のファイルを除く） | 0.34 GB | 21,005 |

C: の空きは 137.1 GB から 132.8 GB に減った。

気づいた点:

- 常設の clone は「fetch だけする」（docs/02 の2節）ので、main の checkout（0.34 GB）は使わない。指示と許可のコマンドの形（`git clone <url> C:/b/vscode`）のとおりに作った。`--no-checkout` で作れば、この分が要らない（別案。今は変えない）。
- 作業ツリーは、毎週の取り込みでは clone を作り直さず、fetch（約 50 秒）と worktree add（約 45 秒）だけになる見込み。

## 5. 再開（2026-11-14）: 依存の導入から zip まで

### 5.1 走らせ方

ユーザーが道具を入れ、`check-env.ps1` の `missing` が空になったので再開した。すべて `scripts/build.mjs` 経由で走らせた。本家のコードは変えていない。手順ごとに `--from`・`--to` で1つずつ走らせ、記録を手順ごとのファイルに分けた（`records/` は検証役が書くので、記録はこのフォルダに置いた）。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -WorkTree C:/b/wt/1.146.0 -OutFile tasks/2026-11-13-p1-build-upstream/env-check-resume.json
node scripts/build.mjs 1.146.0 --label 1.146.0-upstream --from install   --to install   --take-in-dir tasks/2026-11-13-p1-build-upstream/take-in --record tasks/2026-11-13-p1-build-upstream/build-record-install.json
node scripts/build.mjs 1.146.0 --label 1.146.0-upstream --from typecheck --to typecheck --no-size --take-in-dir tasks/2026-11-13-p1-build-upstream/take-in --record tasks/2026-11-13-p1-build-upstream/build-record-typecheck.json
node scripts/build.mjs 1.146.0 --label 1.146.0-upstream --from package   --to package   --take-in-dir tasks/2026-11-13-p1-build-upstream/take-in --record tasks/2026-11-13-p1-build-upstream/build-record-package.json
# ↑ 落ちた。本家の案内どおり作業ツリーを空にして、導入から入れ直した（5.6）
git -C C:/b/wt/1.146.0 clean -xfd -q
node scripts/build.mjs 1.146.0 --label 1.146.0-upstream-r2 --from install   --to package   --take-in-dir tasks/2026-11-13-p1-build-upstream/take-in --record tasks/2026-11-13-p1-build-upstream/build-record-r2.json
# ↑ install の後の lockfile の手順で止まった（apply を飛ばしたので比べる元が無い。想定どおり）。続きを走らせた
node scripts/build.mjs 1.146.0 --label 1.146.0-upstream-r2 --from typecheck --to package   --take-in-dir tasks/2026-11-13-p1-build-upstream/take-in --record tasks/2026-11-13-p1-build-upstream/build-record-r2-package.json
```

zip の手順（`--from zip --to zip`）は、パッケージ化が通らないので走らせていない。

- 飛ばした手順: `prepare`（済み）、`apply`（無改造なので当てない）、`lockfile`（消した単位が無いので比べるものが無い。代わりに `git status` でロックファイルが変わらないことを見た）、`postprocess`（`mydist` がそろうことなど、自分のビルドの検査なので、無改造では落ちる。出力の形は 5.5 で別に見た）。
- 子のプロセスから外した環境変数（build.mjs の `childEnv`）: `ELECTRON_RUN_AS_NODE`、`VSCODE_CODE_CACHE_PATH`、`VSCODE_CRASH_REPORTER_PROCESS_TYPE`、`VSCODE_CWD`、`VSCODE_ESM_ENTRYPOINT`、`VSCODE_HANDLES_UNCAUGHT_ERRORS`、`VSCODE_IPC_HOOK`、`VSCODE_NLS_CONFIG`、`VSCODE_PID`、`VSCODE_PROCESS_TITLE`。
- ログ: `C:\b\logs\1.146.0-upstream\<手順>.log`。
- ディスクは新しい台本 `scripts/disk-usage.mjs` で数えた（読むだけ。hard link を1回だけ数える値も出す）。記録は `disk-before-install.json`・`disk-after-install.json`・`disk-after-package-failed.json`・`disk-after-r2.json`。

### 5.2 環境（再開のとき）

`env-check-resume.json`（19:07 JST）: `missing` は空。Node.js v24.22.1 x64、pnpm 12.16.0（`%APPDATA%\npm`）、Python 3.14.7 と setuptools 84.2.1、Visual Studio Build Tools 2026（18.11.12328.437、wiki の5つのコンポーネントと `VC.Tools.x86.x64` がそろう）、Windows Kits 10.0.26100.0（signtool は `bin\10.0.26100.0\x64\signtool.exe`。PATH には無い）、System32 の tar.exe（bsdtar 3.8.9）、C: の空き 90.6 GB、`longPathsEnabled` 0。作業ツリーの `.nvmrc`（24.22.1）と `packageManager`（`pnpm@12.16.0`）に合う。

### 5.3 依存の導入（19:09:26〜19:14:25 JST）

| 項目 | 値 |
|---|---|
| コマンド | `pnpm install --no-frozen-lockfile`（cwd `C:\b\wt\1.146.0`。build.mjs の install の手順） |
| 所要時間 | 278.1 秒（pnpm の表示は「Done in 4m 37.9s using pnpm v12.16.0」）。build.mjs の手順の全体（ディスクを数える 20 秒を含む）は 299 秒 |
| 終了コード | 0 |
| ロックファイル | 変わらなかった。走らせた後の `git -C C:/b/wt/1.146.0 status --porcelain` は空（6つの `pnpm-lock.yaml` を含め、追跡しているファイルに変更なし） |
| 誤り | 無し |

中で起きたこと（ログから）:

1. preinstall（`build/npm/preinstall.ts`）: 版の確かめを通り、node-gyp 12.3.0（pnpm に同梱のもの）で Electron 43.8.6 と Node.js 24.22.1 のヘッダーを `%LOCALAPPDATA%\node-gyp\Cache\<版>\` に取り、本家の `build/npm/headers` を重ねた。
2. ルートの install: 1,468 の依存を解決し、供給網の規則（`minimumReleaseAge` など）でロックファイルを確かめた（1,531 件）。大きい取得物は `@openai/codex` の win32-x64（168 MB）、`@anthropic-ai/claude-agent-sdk` の win32-x64（134 MB）、`@github/copilot-sdk` の win32-x64（77 MB）、`foundry-local-sdk`（36 MB。インストールのスクリプトが api.nuget.org から ONNX Runtime を取る）。
3. ネイティブのモジュールのビルド（node-gyp。Python 3.14.7 と VS2026 の MSBuild で通った）: `node-pty`、`@parcel/watcher`、`@vscode/fs-copyfile` など。`@vscode/ripgrep` は GitHub の releases から ripgrep 15.0.1 を取った（`%TEMP%\vscode-ripgrep-cache-1.17.1\`）。
4. postinstall（`build/npm/postinstall.ts`）: `build`・`remote`・`extensions`・`extensions/copilot` の4つの install を並べて走らせた（それぞれ 2分23秒・1分54秒・1分35秒・1分38秒）。続けて `git config pull.rebase merges` と `git config blame.ignoreRevsFile .git-blame-ignore-revs` を走らせた。これは常設の clone の共有の設定（`C:\b\vscode\.git\config`）に書かれる（作業ツリーのファイルは変わらない）。
5. pnpm の案内「Update available! 12.16.0 → 12.18.0」が出た。上げない（本家の `packageManager` は 12.16.0）。
6. pnpm の store は `%LOCALAPPDATA%\pnpm\store\v11`。作業ツリーの `node_modules` は store からの hard link（`nodeLinker: hoisted`）。

### 5.4 型検査（19:15:18〜19:15:41 JST）

| 項目 | 値 |
|---|---|
| コマンド | `pnpm run typecheck-client`（= `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck`） |
| 所要時間 | 21.2 秒 |
| 終了コード | 0。誤り 0（ログは script の行だけ） |
| 使われた tsc | `node_modules\.bin\tsc` は `@typescript/native`（TypeScript 7.0.2。Go で書かれた版）を指す。速いのはこのため。`typescript` の名前は `@typescript/typescript6` 6.0.2 の別名（install の出力 `typescript <- @typescript/typescript6 6.0.2`、`@typescript/native <- typescript 7.0.2`） |

### 5.5 パッケージ化（19:16:04〜19:20:03 JST）: 落ちた

| 項目 | 値 |
|---|---|
| コマンド | `pnpm run gulp vscode-win32-x64-min`（signtool は PATH に無いので、build.mjs が `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` を子の PATH の先に足した） |
| 所要時間 | 238.9 秒で落ちた（gulp の表示は「'vscode-win32-x64-min' errored after 3.93 min」） |
| 終了コード | 1 |

gulp の手順ごとの時間（`package.log`）:

| 手順 | 時間 |
|---|---|
| `bundle-marketplace-extensions-build` | 1.2 秒 |
| `bundle-non-native-extensions-build`（拡張の型検査は tsgo、誤り 0） | 5.8 秒 |
| `compile-copilot-extension-build` | 63.1 秒 |
| `compile-extension-media-build` | 3.6 秒 |
| `esbuild-bundle-win32-x64-min`（本体を `out-vscode-min` へ。minify・nls・mangle-privates） | 105.3 秒 |
| `compile-native-extensions-build` | 0.7 秒 |
| `package-win32-x64`（Electron 43.8.6 を取り、出力 `C:\b\wt\VSCode-win32-x64\` を作る） | 56.3 秒 |
| `prepareCopilotRipgrepShimTask`（名前は `<anonymous>`） | **ここで落ちた** |
| `patchWin32DependenciesTask`・`generateNodeCompileCache` | 走らず |

誤りの要点:

```
[19:20:03] 'vscode-win32-x64-min' errored after 3.93 min
[19:20:03] Error: [prepareBuiltInCopilotRipgrepShim] Copilot SDK directory not found at C:\b\wt\VSCode-win32-x64\resources\app\extensions\copilot\node_modules\@github\copilot\sdk
    at prepareBuiltInCopilotRipgrepShim (file:///C:/b/wt/1.146.0/build/lib/copilot.ts:278:9)
    at file:///C:/b/wt/1.146.0/build/gulpfile.vscode.ts:567:3
[ELIFECYCLE] Command failed with exit code 1.
```

原因（作業ツリーのソースで確かめた。本家のコードは変えていない）:

1. `vscode-win32-x64-min`（`build/gulpfile.vscode.ts` の630〜639行）は、手元のビルドのために `compileCopilotExtensionBuildTask` を走らせる。これは `build/lib/extensions.ts` の `packageCopilotExtensionStream`（551〜571行。注釈は「non-CI local builds where copilot is not downloaded as a VSIX」）で、`extensions/copilot` の本番の依存を写し、`build/.moduleignore` と `.moduleignore.win32` を通す。
2. `build/.moduleignore` の226行 `@github/copilot/**` が、`util.cleanNodeModules` で `!**/node_modules/@github/copilot/**` になり、copilot の拡張の `node_modules\@github\copilot` を丸ごと外す（`.build\extensions\copilot\node_modules\@github\copilot` は空のフォルダだった。作業ツリーの `extensions\copilot\node_modules\@github\copilot\sdk` は 37 ファイル・106 MB ある）。
3. その後の `prepareCopilotRipgrepShimTask`（554〜568行。`packageTasks` の中で、`-ci` のタスクでも走る）が、`build/lib/copilot.ts` の277〜279行で `sdk` が無ければ止める。
4. 本家の CI は copilot を別の段（`build/azure-pipelines/product-copilot.yml`。`vsce package` で VSIX にする）で作り、`downloadCopilotVsix.ts` で `.build/extensions/copilot/` に展開して `vscode-win32-x64-min-ci` を走らせる。VSIX は `.moduleignore` を通らないので `sdk` が残る。手元のビルドだけがこの道を通る。
5. 本家の main では PR #347312「build: compile Copilot in the platform Compile jobs」（2026-11-10 にマージ、マイルストーン 1.147.0）が、手元のビルドも CI と同じ包み方にした（PR の説明: 「Local builds use the same packaging task as CI」）。main の `packageCopilotExtensionStream` は VSIX を作って展開し、`.moduleignore` を通さない（https://raw.githubusercontent.com/microsoft/vscode/main/build/lib/extensions.ts 、2026-11-14 取得）。

### 5.6 本家の案内を試した: `git clean -xfd` してから入れ直す（19:24:39〜19:32:13 JST）

- `git -C C:/b/wt/1.146.0 clean -xfd -q` の後、`git -C C:/b/wt/1.146.0 status --porcelain --ignored` が空（追跡していないファイルも無視するファイルも無い）ことを確かめた。
- 依存の導入: 173.8 秒（キャッシュが温まった状態。pnpm の表示は「Done in 2m 53.7s」）。postinstall の4つは 55 秒〜1分44秒。走らせた後も `git status --porcelain` は空（ロックファイルは変わらない）。
- 型検査: 19.3 秒、誤り 0。
- パッケージ化: 249.5 秒で**同じ誤りで落ちた**（「'vscode-win32-x64-min' errored after 4.07 min」、`package-win32-x64` は 54 秒）。ログは `C:\b\logs\1.146.0-upstream-r2\`。
- node-gyp のキャッシュを消す案内は試していない。`%LOCALAPPDATA%\node-gyp` は書き込み先の外で、今回の誤りはネイティブのビルドと関係が無い（ヘッダーの取得とネイティブのモジュールのビルドは2回とも通った）。
- ここで止めた（依頼の5）。

### 5.7 落ちる前の出力を起動した（19:32 JST）: Smart App Control が止めた

パッケージ化は落ちたが、`package-win32-x64` までの出力 `C:\b\wt\VSCode-win32-x64\` はできている（足りないのは copilot の ripgrep の shim、ネイティブのファイルの版の情報の書き換え、node のコンパイルのキャッシュ）。データの置き場所を見るため、新しい台本 `scripts/p1-launch-check.ps1` で1回起動した（記録 `launch-check-partial.json`）。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Root C:/b/wt/VSCode-win32-x64 -Dest C:/b/p1/1.146.0-upstream-partial -OutFile tasks/2026-11-13-p1-build-upstream/launch-check-partial.json
```

- 子のプロセスから `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外し、`VSCODE_PORTABLE=C:\b\p1\1.146.0-upstream-partial\portable` だけを渡した。`--user-data-dir`・`--extensions-dir` は渡していない（ポータブルモードの既定を見るため）。
- CLI: `bin\code-oss.cmd --version` は終了コード 0、「1.146.0 / Unknown commit / x64」。
- 起動: `Code - OSS.exe --new-window` は **10 秒以内に終了コード 1 で終わった**。`portable\user-data\logs\20261114T193232\main.log` の誤り:

```
[error] Error: An Application Control policy has blocked this file.
\\?\C:\b\wt\VSCode-win32-x64\resources\app\node_modules.asar.unpacked\@vscode\windows-registry\build\Release\winregistry.node
```

- 新しい台本 `scripts/p1-ci-events.ps1` で Code Integrity のイベントを読んだ（記録 `ci-events.json`）: 19:32:34 に ID 3077（ポリシーによる阻止）と 3033。ポリシーの名前は **`VerifiedAndReputableDesktop`（Smart App Control）**。「`Code - OSS.exe` が `winregistry.node` を読み込もうとしたが、署名の水準を満たさない」。
- `check-env.ps1`（Smart App Control の状態を読む行を足した。記録 `env-check-after.json`）: `HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy` の `VerifiedAndReputablePolicyState` は **1（オン）**。
- 意味: この PC では Smart App Control がオンなので、自分でビルドした署名の無いネイティブのモジュール（node-gyp で作った `*.node`）は読み込みが止められる。実行ファイル自体は起動した（`main.log` が書かれた）。Microsoft の文書は「Smart App Control は信頼できる提供元が発行した証明書だけを考慮する」と書く（https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control 、2026-11-14 取得）。自己署名の証明書では足りない見込み。copilot の不具合が片付いても、Smart App Control がオンのままでは自分のビルドは起動しない見込み。
- ポータブルの置き場所に、エディタが作ったもの（落ちる前に作った）: `portable\user-data\`（設定は `user-data\User\`）、`portable\extensions\`、`portable\argv.json`。ソース（`src/mainImpl.ts` の `getArgvConfigPath`、`src/vs/platform/environment/common/environmentService.ts` の `argvResource`・`extensionsPath`）のとおり。ポータブルでないときの場所（ソースから。起動していない）: `argv.json` と拡張は `%USERPROFILE%\.vscode-oss\`（`dataFolderName`）、ユーザーのデータは `%APPDATA%\Code - OSS\`（`nameShort`）。
- 普段使いのエディタのデータ: `%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` は、前も後も無かった（変わらない）。
- 止めたプロセス: 0（自分で終わっていた）。

### 5.8 出力の形（落ちた時点の `C:\b\wt\VSCode-win32-x64\`）

| 項目 | 値 |
|---|---|
| 場所 | `C:\b\wt\VSCode-win32-x64\`（作業ツリーの親の直下。作業ツリーが違っても同じ場所） |
| `resources\app\` | **直下**（`resources\app\product.json`。公式の zip の `<commit10>\resources\app\` の形ではない） |
| 実行ファイル | `Code - OSS.exe`（`nameShort`） |
| CLI | `bin\code-oss.cmd`（`applicationName`）。ほかに `bin\code-oss`、`bin\copilot-shim\copilot` |
| product.json | `nameShort`・`nameLong` `Code - OSS`、`applicationName` `code-oss`、`dataFolderName` `.vscode-oss`、`version` 1.146.0、`commit` は無い（CLI は「Unknown commit」） |
| LICENSE と ThirdPartyNotices | `resources\app\LICENSE.txt`、`resources\app\ThirdPartyNotices.txt` がある |
| 大きさ | 1.40 GB、20,325 ファイル（copilot の拡張とその依存を含む） |

`test/smoke` を `--build` で向けられるか（docs/07 の4節の3）: ソースでは向けられる。`test/automation/src/electron.ts` の `getBuildElectronPath` は Windows で `<root>\<nameShort>.exe` を使い、`resources\app\product.json` を下の階層まで探す（`findFilePath`）。走らせてはいない。

### 5.9 ディスク

C: の空き（`disk-usage.mjs` の `drive`）:

| 時点 | 空き | 減り |
|---|---|---|
| 依存の導入の前（19:09） | 90.65 GB | — |
| 依存の導入の後（19:15） | 85.28 GB | 5.37 GB |
| パッケージ化が落ちた後（19:23） | 82.32 GB | 2.96 GB |
| `git clean -xfd` と2回目の後（19:35） | 82.16 GB | 0.16 GB |

場所ごと（19:35、`disk-after-r2.json`。`bytes` はファイルの大きさの和、`unique` は hard link を1回だけ数えた和）:

| 場所 | 大きさ | unique | ファイル数 | 前（19:09） |
|---|---|---|---|---|
| 作業ツリー `C:\b\wt\1.146.0`（`.git` のファイルを含む全部） | 6.14 GB | 5.22 GB | 215,646 | 0.34 GB |
| その中の `node_modules`（ルートだけ） | 1.87 GB | 1.81 GB | 42,740 | — |
| その中の `.build` | 0.38 GB | 0.38 GB | 19,083 | — |
| その中の `out-vscode-min` | 0.38 GB | 0.38 GB | 337 | — |
| gulp の出力 `C:\b\wt\VSCode-win32-x64` | 1.40 GB | 1.40 GB | 20,325 | 無し |
| pnpm の store `%LOCALAPPDATA%\pnpm`（`store\v11`） | 3.46 GB | 3.46 GB | 108,171 | 0.48 GB |
| pnpm のメタデータのキャッシュ `%LOCALAPPDATA%\pnpm-cache` | 1.64 GB | 1.64 GB | 3,474 | 0.90 GB |
| node-gyp のヘッダー `%LOCALAPPDATA%\node-gyp` | 0.12 GB | 0.12 GB | 5,666 | 0.06 GB |
| Electron の取得物 `%LOCALAPPDATA%\electron` | 0.91 GB | 0.91 GB | 7 | 0.77 GB |
| 常設の clone の `.git` `C:\b\vscode\.git` | 1.73 GB | 1.73 GB | 301 | 1.64 GB（11-13） |

- 作業ツリーのファイルの 172,786 個は hard link（pnpm の store と同じ実体）。作業ツリーと store を通して1回だけ数えると、ビルドのために増えたのは C: の空きの減り（約 8.5 GB）に近い。
- pnpm の store・pnpm-cache・Electron の取得物には、ほかのプロジェクトの分が前からあった（「前」の列）。
- `%TEMP%\vscode-ripgrep-cache-1.17.1\` は数えていない（小さい）。

### 5.10 所要時間のまとめ

| 手順 | 1回目（キャッシュが冷えた状態） | 2回目（`git clean -xfd` の後） |
|---|---|---|
| 依存の導入 | 278.1 秒 | 173.8 秒 |
| 型検査 | 21.2 秒 | 19.3 秒 |
| パッケージ化（落ちるまで） | 238.9 秒 | 249.5 秒 |
| zip | 走らず | 走らず |

落ちたのは最後の方の手順なので、通れば、パッケージ化は残りの手順（shim・版の情報の書き換え・コンパイルのキャッシュ）を足して5分前後、clone を作り直さない毎週の取り込みは fetch と worktree add（約1.5分）・導入（約3分）・型検査（約20秒）・パッケージ化（約5分）・zip（公式の展開で 72 秒の実績。`tasks/2026-11-13-p2-build-switch/doc-corrections.md` の1）で、合わせて 10〜15 分の見込み（推定。zip までは通っていない）。

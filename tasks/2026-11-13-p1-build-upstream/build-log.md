# Phase 1: 本家 1.146.0 の無改造のビルドの記録

- 作成: 蒙恬（2026-11-13）
- 状態: **作業ツリーまで済み**（2026-11-13 21:44）。環境に足りないものが4つあり（`env-check.md`）、依存の導入・型検査・パッケージ化・zip はまだ走らせていない。clone と作業ツリーは、リーダーの指示（ユーザーが環境を入れている間に進める）で先に作った（4節）。

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

まだ無い（4節の手順は誤りなしで通った）。

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

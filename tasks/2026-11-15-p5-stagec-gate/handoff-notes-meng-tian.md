# 引き継ぎの書き付け（蒙恬）: 段階 C をまとめた版の片づけとビルド

- 作成: 蒙恬（2026-11-15）
- 結果: **一部完了**。片づけ（brief の1）は済ませた。ビルド（brief の2）は**始めていない**。

## 止めた理由

片づけの途中で、リーダーから中止の知らせが来た（2026-11-15）。ユーザーの新しい指示で、C: に一時ファイルとビルド用のファイルを置かないことになったためだ。知らせは次のとおり。

- C: でのビルドは始めない。
- 片づけは、許可の範囲（`rm -rf` の形、`delete_keep` を残す）で続けてよい。
- 移す先の調べと段取りは、別の依頼で頼む。

ビルドは、作業ツリーの用意（タグに戻すこと）も含めて何も始めていない。

## 消した版

段取りは brief のとおり。まず1つの版（`1.146.0-p2-A-1` の展開・zip・スモークの拡張・マーカー）を試しに消した。そのあと、残す版が残っていることを確かめてから、残りを消した。

| 場所 | 消したもの |
|---|---|
| `C:\b\p2\` | 20個: `1.146.0-p2-A-1`〜`A-7`、`B-1`〜`B-7`、`B-1-r2`〜`B-7-r2` |
| `C:\b\dist\` | 22個: `1.146.0-p1-a1-r2.zip`、`1.146.0-p2-A-1`〜`A-7.zip`、`B-1`〜`B-7.zip`、`B-1-r2`〜`B-7-r2.zip` |
| `C:\b\smoke\ext\` | フォルダ39個とマーカー39個（`<名前>.marker.json`）。名前は `1.146.0-` に続けて、`ooka-verify`・`env-b-dotenvb`・`manual`・`official`・`take-in-trial-official-1.146.0-1`〜`-3`・`p1-a1`・`p2-A-1`・`p2-A-1-b2`・`p2-A-1-b3`・`p2-A-2`・`p2-A-2-b2`・`p2-A-2-b3`・`p2-A-3`・`p2-A-4`・`p2-A-5`・`p2-A-5-b2`・`p2-A-6`・`p2-A-6-b2`・`p2-A-6-b3`・`p2-A-7`・`p2-B-1`〜`B-4`・`p2-B-5`・`p2-B-5-b2`・`p2-B-6`・`p2-B-7`・`p2-B-1-r2`〜`B-3-r2`・`p2-B-2-r2-run2`・`p2-B-3-r2-run2`・`p2-B-4-r2`〜`B-7-r2` |
| `C:\b\trial-*` | `C:\b\trial-install-doc\`（ほかの `trial-*` は無かった） |

削除はすべて `rm -rf <パス>` の形で行い、許可の外は消していない。台本も書いていない。消した版は、常設の clone の枝 `builds/<label>` から作り直せる（requests.md の1）。

## 残した版

片づけの後に、ファイルを探して有無を確かめた。

- `C:\b\p2\1.146.0-p2-all\`（中の `Shuko-win32-x64-1.146.0-p2-all\Shuko.exe` があることを確かめた）
- `C:\b\dist\1.146.0-p2-all.zip`、`C:\b\dist\1.146.0-p1-a1-r3.zip`
- `C:\b\smoke\ext\1.146.0-p1-a1-r3\` とそのマーカー
- `C:\b\smoke\ext\1.146.0-p2-all-1\`〜`-3\` とそのマーカー

`1.146.0-p1-a1-r3` を展開したものは、片づけの前から `C:\b\p2\` に無かった。

## C: の空き

| 時点 | C: の空き | 記録 |
|---|---|---|
| 片づけの前（2026-11-15 12:59 UTC） | 27.73 GB。p2 24.35 GB、dist 8.58 GB、smoke/ext 29.23 GB | `tasks/2026-11-15-p5-stagec-gate/disk-before-cleanup.json` |
| 片づけの後（2026-11-15 13:12 UTC） | **92.78 GB**（約 65 GB 増えた）。dist 0.73 GB（zip 2個） | `tasks/2026-11-15-p5-stagec-gate/disk-after-cleanup-drive.json` |
| ビルドの後 | ビルドしていないので無い | - |

- 片づけの後の、場所ごとの大きさ（2026-11-15 13:13 UTC。`tasks/2026-11-15-p5-stagec-gate/disk-after-cleanup.json`）:
  - C: の空き: 92.75 GB
  - `C:\b\p2`: 1.08 GB
  - `C:\b\dist`: 0.73 GB
  - `C:\b\smoke\ext`: 2.72 GB
  - `C:\b\trial-install-doc`: 無い
  - `C:\b\wt`: 17.83 GB。同じファイルを1回だけ数えると 11.58 GB（pnpm の store からの hard link が 365,459 個）
  - この計測は、報告を返した後に終わった。

## 作業ツリーと unit.json の状態

- `C:\b\wt\p2`: 触っていない。`git -C C:/b/wt/p2 status --short --branch` の結果は `## HEAD (no branch)` で、変更は無かった。HEAD は、依頼文によれば大岡越前守の21単位の `ed59899d` のまま。ただし `git -C C:/b/wt/* rev-parse` は許可に無いため、自分では確かめていない。
- `removals/C-1-ai/`〜`C-7-breadcrumbs-outline/` の `unit.json`: `enabled` は**書き換えていない**（`false` のまま）。`git diff -- removals/` は空だった。C-1 の `"enabled": false` は、ファイルを開いて確かめた。
- `removals/` の `edits.patch` も直していない。

## ビルドの記録・zip・ロックファイル・pnpm install

どれもビルドしていないので無い。

## 大岡越前守への引き継ぎ

- 関門に使う21単位の版（`1.146.0-p5-c-all`）は**まだ無い**。関門は始められない。
- C: でビルドするかどうかは、移す先が決まるまで保留。別の依頼で決まる。

## 未解決の点

- ビルドの置き場所を C: の外に移すこと（ユーザーの新しい指示）。`local.json` の `buildRoot`（既定 `C:\b\`）、作業ツリー（`C:\b\wt\`）、常設の clone（`C:\b\vscode`）、pnpm の store、スモークの拡張の置き場（`C:\b\smoke\ext\`）が関わる。どれも別の依頼で扱う。
- 次の点は docs/ との食い違いになりうる: docs の「ビルドの作業場所は既定 `C:\b\`」と CLAUDE.md の同じ記述。新しい指示に合わせて直すのはリーダーの仕事。
- 今の蒙恬の許可（`write_paths`・`delete_paths`・Bash の `C:/b/wt/*`）は、どれも C:/b/ を前提にしている。移す先が決まったら権限の変更が要る（Team への依頼になる）。

---

# 2回目（2026-11-16。`tmp\b` でのビルド。brief の「変更（2026-11-16）」の 1'・2'）

- 作成: 蒙恬（2026-11-16）。時刻は UTC（JST は +9 時間）
- 結果: **完了**。写す（1'）は全15項目が `copied`。21単位の版 `1.146.0-p5-c-all` は、prepare から zip まで `result: ok`
- `C:\b` には書いていない。消してもいない。`--build-root` に `C:\b` は渡していない（buildRoot は既定の `<リポジトリ>\tmp\b`。`local.json` は無い）
- 直接打つ git・pnpm のコマンドは要らなかった。台本の中でも、許可の外の操作はしていない（R2-6 の1に、フックに止められた確かめが1つある）

## R2-0. 要点

1. `node scripts/move-build-root.mjs --from C:/b` で、clone 以外の15項目（7.35 GB）を `tmp\b` に写した。全部のファイルで大きさと SHA-256 が元と同じ。かかった時間は 900 秒。
2. 本家の clone は、prepare が `tmp\b\vscode` に GitHub から新しく作った（162 秒）。作業ツリーは `tmp\b\wt\1.146.0`。
3. ビルドは `result: ok`。21単位がすべて `applied: ok`。型検査の誤りは 0 で、パッケージ化も止まらなかった（A-3・C-3 の build/ の型の誤りは、パッケージ化を止めなかった）。zip は 219,102,721 B、SHA-256 は `e798cce0a39cad4a7e890df79cbeee52964704ffb387296ca0040007354b63a1`。
4. ロックファイルの検査は、ルート・`remote/` を含む全部が `ok`。予期しない追加・削除・版の変化は 0。本物の `pnpm install` は終了コード 0（12分30秒）。警告は、遅い通信の `Request took` が 185 行、deprecated が 3 行など（R2-3）。
5. node-gyp は、`LOCALAPPDATA` を向けても Python を見つけた。PATH の `C:\Python314\python.exe`（3.14.7）を使っている（R2-4）。
6. ビルドは、C: に新しく書いていない（R2-5）。ビルドの間に C: に増えたもの（`%LOCALAPPDATA%\pnpm\package-manager-store` の 0.58 GB）は、時刻からみて、このビルドではなく別の pnpm の実行が書いたもの（推定）。

## R2-1. 写した結果（1'）

- 計画: `node scripts/move-build-root.mjs --from C:/b --dry-run --out tasks/2026-11-15-p5-stagec-gate/move-plan-dry-run2.json --only <clone 以外の15項目>`
  - 15項目すべてが `planned` になった。`result: ok`。長すぎるパスとリンクは無い
  - clone は `--only` から外した。作業ツリーが付いていて写せないため（前提どおり）
- 写す: 同じ `--only` で `--out tasks/2026-11-15-p5-stagec-gate/move-result.json`
  - 結果: `result: ok`、終了コード 0
  - 01:55:25〜02:10:25（`seconds` 899.968）。15項目すべてが `copied` で、`verify.ok: true`
- 記録: `tasks/2026-11-15-p5-stagec-gate/move-result.json`

| name | ファイル | 大きさ | seconds（写す） | verifySeconds（照らす） |
|---|---|---|---|---|
| dist-p2-all | 1 | 0.35 GB | 7.265 | 0.543 |
| dist-p1-a1-r3 | 1 | 0.38 GB | 16.755 | 0.407 |
| p2-all | 1,974 | 1.08 GB | 23.159 | 45.927 |
| p1-a1-r3 | 2,698 | 1.19 GB | 48.243 | 85.173 |
| smoke-ext | 35,060 | 2.72 GB | 348.512 | 221.866 |
| smoke-baselines | 24 | 34 KB | 0.434 | 0.248 |
| smoke-runs（→ `smoke\archive\runs`） | 349 | 9.5 MB | 10.464 | 0.849 |
| smoke-absent（→ `smoke\archive\absent`） | 153 | 6.4 MB | 0.253 | 0.239 |
| vsix-cache | 62 | 0.19 GB | 1.697 | 0.421 |
| logs | 208 | 1.9 MB | 0.331 | 0.198 |
| work-b | 1 | 94 B | 0.001 | 0.001 |
| official-1.146.0（→ `official\vscode-1.146.0`） | 3,278 | 1.05 GB | 25.533 | 51.241 |
| official-zip（→ `official\downloads\`） | 1 | 0.38 GB | 2.211 | 3.194 |
| official-fetch-record（→ `official\downloads\p0-fetch.json`） | 1 | 2.4 KB | 0.002 | 0.001 |
| ws-info（→ `measure\ws-info.json`） | 1 | 3.9 KB | 0.001 | 0.002 |

- smoke-baselines の `destExists: true`（`resume: true`、`existing.missing` 24、`same` 0、`different` 0）は、直前の smoke-ext が `tmp\b\smoke\` を作ったため。上書きはしていない。
- smoke-ext の写す・照らす時間には、蒙恬が同じ時間に走らせた `disk-usage.mjs` の数え（進み具合の確かめ）の読み込みが重なっている。そのため、実力より長く出ている見込み（推定）。
- `C:\b` は、写す前と後で同じ: 44,467,666,638 B、775,898 ファイル（`disk-c-before-build2.json` と `disk-c-after-build2.json` の `cb`）。

## R2-2. ビルド（2'）

### 走らせ方

```
（removals/C-1-ai〜C-7-breadcrumbs-outline の unit.json の "enabled": false を true に。各1行、7 files changed）
node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all --take-in-dir tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all --record tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/build-record.json
```

- `--build-root` は渡していない。既定の `tmp\b` になった（記録の `config.buildRootFrom: "default"`）。
- 記録と checks.json は、p2-all のときと同じく tasks の下に置いた。`records/` には書いていない。
- `unit.json` の変更はコミットしていない（`git diff --stat -- removals/` は 7 files changed、7 insertions、7 deletions）。
- 先に `--dry-run` で、21単位が `unitsEnabled` に入ること（`unitsTotal: 21`）と、どの場所も `tmp\b` の下になることを確かめた。

### 手順ごとの結果（02:10:37〜02:34:36、合わせて約24分）

| 手順 | 始め（UTC） | 秒 | 終了コード | 要点 |
|---|---|---|---|---|
| prepare | 02:10:37 | 223.66 | 0 | clone 162.0 秒（GitHub から。`.git` 1.78 GB）、fetch --tags 2.9 秒、worktree add 54.8 秒。タグの commit `69047191…d8eeda7ab` が upstream.json と一致。作業ツリーはきれい |
| apply | 02:14:21 | 246.25 | 0 | `checks.json` の `result: ok`。21単位すべて `applied: ok`。パッチ 20・30 も ok。headCommit `101e832240f4f92b1eddb2b505078bed96f84d43` |
| install | 02:18:27 | 750.12 | 0 | `pnpm install --no-frozen-lockfile`。冷えた状態からの導入（store・Electron・ヘッダの取り直し）。R2-3 |
| lockfile | 02:30:57 | 0.85 | 0 | `status: ok`。R2-3 |
| typecheck | 02:30:58 | 6.60 | 0 | `pnpm run typecheck-client`。誤り 0。枝 `builds/1.146.0-p5-c-all` を作った（`created`） |
| package | 02:31:05 | 155.18 | 0 | `pnpm run gulp vscode-win32-x64-min`。誤り 0（gulp の 'vscode-win32-x64-min' は 2.48 分で終わった） |
| postprocess | 02:33:40 | 0.19 | — | `productCommit.ok: true`。組み込み拡張 65、消え残り 0、keep.json の不足 0、予期しないもの 0。消した拡張 28 |
| zip | 02:33:41 | 27.71 | 0 | 2037 項目。最上位のフォルダ `Shuko-win32-x64-1.146.0-p5-c-all` |

- 記録の `warnings` は空、`stoppedAt: null`。
- `sourceVersion`: `BUILD_SOURCEVERSION` = `101e8322…f84d43`（作業ツリーの HEAD）。`matchesChecksHead: true`、`uncommittedEntries: 3`（作り直したロックファイル3つ。p2-all と同じ）。
- 出力の `product.json` の commit も `101e8322…f84d43`。
- ディスク（記録の `disk`）: 作業ツリー 2.30 GB（89,741 ファイル）、パッケージ 0.62 GB（1,632 ファイル）、zip 219,102,721 B。p2-all（パッケージ 1.06 GB、zip 373,218,781 B、2371 項目）より小さい。

### apply の警告（1つ。止まってはいない）

- `C-2-debug: delete: src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts が本家に無い（改名の恐れ）`
- 原因: このファイルは `C-1-ai/unit.json` の `delete`（31行）と `C-2-debug/unit.json` の `delete`（18行）の両方にある。C-1（order 310）が先に消すので、C-2 のときには無い。改名ではない。
- 害は無い（消え残りの検査 `remnants` は ok）。ただし、C-1 を無効にして作り直したときに、C-2 がこのファイルを消すことになる。そのときは、C-1 の `removeLines` の `debug.contribution.ts` の import の1行（202行）が当たらなくなる。その組み合わせで当たるかどうかは確かめていない。
- 直すかどうか（C-2 の `delete` から外す、または C-2 に `after: C-1` を書く）は、リーダーが決める。今は直していない。

### 記録の場所

- ビルドの記録: `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/build-record.json`
- 適用後の検査: `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/checks.json`
- ロックファイルの差: `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/lockfile.diff`
- 手順ごとのログ: `tmp\b\logs\1.146.0-p5-c-all\`（`prepare.log`・`apply.log`・`install.log`・`lockfile.log`・`typecheck.log`・`package.log`・`zip.log`）
- prepare の記録: `tmp\b\wt\1.146.0.prepare.json`

### zip

- 場所: `E:\develop\self\Team\projects\ai-editor\tmp\b\dist\1.146.0-p5-c-all.zip`
- sha256: `e798cce0a39cad4a7e890df79cbeee52964704ffb387296ca0040007354b63a1`
- 大きさ: 219,102,721 B。2037 項目。最上位のフォルダは `Shuko-win32-x64-1.146.0-p5-c-all`
- 展開と起動の確かめ（`p1-launch-check.ps1`）は走らせていない（依頼に無いため）

## R2-3. ロックファイルと pnpm install

### ロックファイルの検査（docs/03 の5.4。`lockfile` の手順）

全体は `status: ok`。どのファイルも、予期しない追加・削除・版の変化は 0。

| ファイル | 状態 | 中身 |
|---|---|---|
| `pnpm-lock.yaml`（ルート） | ok（変わった） | importer `src/vs/sessions/test/e2e` が消えた（予期どおり）。消えた依存 19（`@anthropic-ai/sdk`・`@github/copilot-sdk`・`@vscode/copilot-api`・`foundry-local-sdk`・`@anthropic-ai/claude-agent-sdk`・`@openai/codex`・`@modelcontextprotocol/sdk`・`@microsoft/1ds-*`・`@microsoft/dev-tunnels-*` の5つ・`@devcontainers/cli`・`ssh2`・`ws` など。すべて予期の中）。消えた packages 80。パッチ `foundry-local-sdk` が消えた（予期どおり） |
| `remote/pnpm-lock.yaml` | ok（変わった） | 消えた依存 11（`.` の9つ: `@microsoft/1ds-core-js`・`1ds-post-js`・`@github/copilot-sdk`・`@vscode/copilot-api`・`@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・`ssh2`・`ws`。`web` の2つ: `1ds-*`）。すべて予期の中。消えた packages 50 |
| `extensions/pnpm-lock.yaml` | ok（変わった） | importer 16 が消えた（A の単位が消した拡張。予期どおり）。消えた packages 280 |
| `extensions/copilot/pnpm-lock.yaml` | removed | 単位が消したフォルダの中 |
| `build/pnpm-lock.yaml`・`test/sanity/pnpm-lock.yaml` | ok | 変わらない |

### 本物の pnpm install（`strictDepBuilds: true`）

- 終了コード 0。`Done in 12m 30s using pnpm v12.16.0`
  - postinstall の中で、`extensions` が 3分19秒、`remote` が 4分9.8秒、`build` が 5分40.5秒
- `strictDepBuilds` による止まりと「ignored build scripts」の知らせは無かった（ログに `Ignored`・`ignored` の行は無い）
- 供給網の検査: ルート 1451 件（15.9 秒）、`remote` 114 件（2.4 秒）、`extensions` 664 件、`build` 634 件。どれも通った（`✓ Lockfile passes supply-chain policies`）
- store・キャッシュ: `Content-addressable store is at: E:\develop\self\Team\projects\ai-editor\tmp\b\cache\pnpm-store\v11`（ルートと remote の両方）

警告（`install.log` の WARN は 188 行）:

| 種類 | 数 | 出どころ |
|---|---|---|
| `[WARN] Request took <n>ms: https://registry.npmjs.org/...`（遅い通信。10〜39 秒） | 185 | postinstall の `extensions` と `build` のメタデータの取得。冷えたキャッシュのため |
| `[WARN] deprecated glob@5.0.15`（css-language-features/server）・`deprecated sinon@12.0.1`（git）・`4 deprecated subdependencies found: @sinonjs/text-encoding@0.7.1, glob@8.1.0, inflight@1.0.6, lodash.get@4.4.2` | 3 | `extensions` |
| `Update available! 12.16.0 → 12.21.0` | 1 | pnpm の版の知らせ（本家の packageManager は 12.16.0 のまま） |
| `prebuild-install warn This package does not support N-API version 43.8.6`（ルート）・`... version undefined`（remote） | 2 | `kerberos`。そのあと node-gyp でビルドした |
| `[DEP0190] DeprecationWarning: Passing args to a child process with shell option true ...` | 6 | `@parcel/watcher`（ルート・extensions・remote）、`tree-sitter`・`tree-sitter-javascript`・`tree-sitter-typescript`（build） |
| C++ のコンパイラの警告 `D9002`（`/ZH:SHA_256/Zi` を無視）・`D9025`（`/std:c++20` より `/std:c++17`）・`C6285`・`C28251` | 多数 | `@vscode/deviceid`・`@parcel/watcher`・`@vscode/spdlog`・`@vscode/sqlite3` のネイティブのビルド |

- p2-all の install は 3 秒だった（温まった store のため）。今回は冷えた store で 750 秒になった。
- `--no-frozen-lockfile` の導入なので、`extensions` の postinstall がメタデータを取り直した。その結果、上の遅い通信の WARN が出た（推定）。

## R2-4. LOCALAPPDATA を向けたときの node-gyp と Python

- install・typecheck・package の子の `LOCALAPPDATA` は `tmp\b\cache\localappdata` になった（記録の `envRedirectedForChildren.toolchain`）。
- node-gyp は、すべてのネイティブのモジュールで Python を見つけた。
  - 例: `gyp info find Python using Python version 3.14.7 found at "C:\Python314\python.exe"`
  - `@vscode/fs-copyfile`・`native-watchdog`・`deviceid`・`policy-watcher`・`windows-ca-certs`・`spdlog`・`sqlite3`・`windows-mutex`・`windows-process-tree`・`windows-registry`・`native-is-elevated`・`kerberos`、remote の同じもの
- 見つかった理由: Python は `%LOCALAPPDATA%\Programs\Python` ではなく、PATH の `C:\Python314` にある。
  - `scripts/check-env.ps1` の結果（`tasks/2026-11-15-p5-stagec-gate/env-check-build2.json`）でも、`python.commandPath` は `C:\Python314\python.exe`、setuptools は 84.2.1
  - PATH の2番目は `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`（別名）。使われていない
  - この PC では、`LOCALAPPDATA` を向けても、Python の見つけ方は変わらない
  - Python を `%LOCALAPPDATA%\Programs\Python` にだけ入れた PC では、見つからなくなる恐れが残る（1回目の 1.3 の恐れ。この PC では確かめられない）
- VS も見つかった: `gyp info find VS using VS2026 (18.11.12328.437)`
- ヘッダは向け先に取った:
  - Electron 43.8.6 と Node 24.22.1 のヘッダ → `tmp\b\cache\localappdata\node-gyp\Cache\`
  - 本家の preinstall の重ね（`Overlaying custom header ...\tmp\b\cache\localappdata\node-gyp\Cache\43.8.6\include\node\v8config.h` など）も同じ場所に当たった
- Electron の zip も `tmp\b\cache\localappdata\` の下に取った。install の途中で 0.73 GB になった。

## R2-5. C: の空きと、C: に書かれたもの

| 時点 | C: の空き | 記録 |
|---|---|---|
| 始め（01:55:12） | **96.58 GB** | `tasks/2026-11-15-p5-stagec-gate/disk-c-before-build2.json`、`disk-c-before-build2-extra.json`（02:03:44、96.43 GB） |
| 終わり（02:39:08） | **96.11 GB** | `tasks/2026-11-15-p5-stagec-gate/disk-c-after-build2.json`、`disk-c-after-build2-extra.json`（02:40:15、96.08 GB） |

`tmp\b` は、始めは 0 B、終わりは 14.75 GB（同じファイルを1回だけ数えると 13.50 GB）。

C: の場所ごとの前と後:

| 場所 | 前 | 後 | 違い |
|---|---|---|---|
| `C:\b` | 44,467,666,638 B / 775,898 | 同じ | なし（01:55〜02:39 に14回数えて、いつも同じ） |
| `%LOCALAPPDATA%\pnpm\store` | 3,713,457,387 B / 108,171 | 同じ | なし |
| `%LOCALAPPDATA%\pnpm`（全体） | 3,713,457,387 B / 108,171 | 4,337,314,748 B / 109,107 | **+0.58 GB、+936 ファイル**（下の1） |
| `%LOCALAPPDATA%\pnpm-cache` | 1,823,519,198 B / 3,983 | 1,831,996,150 B / 4,001 | **+8.5 MB、+18 ファイル**（下の2） |
| `%LOCALAPPDATA%\npm-cache` | 11,806,307,933 B / 60,662 | 11,806,307,990 B / 60,662 | +57 B（下の3） |
| `%LOCALAPPDATA%\electron`・`node-gyp`・`pnpm-state`・`node\corepack`・`ms-playwright`・`electron-builder`・`Microsoft\TypeScript`、`%USERPROFILE%\.electron-gyp`・`.cache`、`%APPDATA%\npm` | — | 同じ | なし |
| `%TEMP%` | 7.37 GB / 61,612 | 7.34 GB / 73,982 | 共用のため、切り分けられない |

1. **`%LOCALAPPDATA%\pnpm\package-manager-store\v11`**（0.58 GB、935 ファイル）と `global\v11\pnpm-lock.yaml` が新しくできていた。
   - 中身は `@pnpm/exe` 11.8.0（`pnpm-engine-11.8.0`）。pnpm が別の版に切り替えるときに取るもの
   - フォルダの時刻は 02:14:41〜02:14:43（`tasks/2026-11-15-p5-stagec-gate/survey-c-localappdata-pnpm-after-build2.json`）
   - この時刻、ビルドは apply の手順の中だった。apply.mjs は pnpm を起こさない（ソースで確かめた）。蒙恬もこの時刻には pnpm を走らせていない（`disk-usage.mjs` だけ）
   - 本家 1.146.0 の packageManager は pnpm@12.16.0 で、install の手順は 02:18:27 から
   - **このビルドが書いたものではない見込み**。この PC の別の作業が pnpm 11.8.0 を求めて取った、と見られる（推定。store の `projects\` には、ほかのプロジェクトの scratchpad からのリンクがある）
2. `%LOCALAPPDATA%\pnpm-cache` の +18 ファイルは、01:55〜02:21 の間に増えた。そのあと終わりまで変わっていない。
   - install（02:18〜02:30）の後も増えていないので、install が書いたものではない
   - 1と同じ時刻の pnpm の実行がメタデータを書いた見込み（推定）
   - 蒙恬が 02:11 に走らせた `check-env.ps1` は、本物の環境で `pnpm --version` を起こす。これが書いた可能性も残る（推定）
3. `npm-cache` の +57 B（ファイルの数は同じ）。誰が書いたかは分からない。蒙恬の `check-env.ps1` の `npm --version` が、本物の環境で何かを書き足した可能性がある（推定）。
4. C: の空きは 0.47 GB 減った。大半は1（0.58 GB）で説明がつく。
5. どのファイルが変わったかの一覧は取れなかった。蒙恬の read_paths は `./` と `C:/b/` だけだからだ。数えたのは、`disk-usage.mjs` と `move-survey.mjs`（どちらも読むだけ）の大きさとフォルダの時刻だけ。

ビルドの子の向け先（TEMP・TMP・pnpm の store とキャッシュ・npm のキャッシュ・LOCALAPPDATA）は、どれも `tmp\b` の下に書いていた。
- `tmp\b\cache\pnpm-store`
- `tmp\b\cache\pnpm-cache`（メタデータ 241 ファイル以上）
- `tmp\b\cache\localappdata`（Electron とヘッダ）
- `tmp\b\tmp`

## R2-6. 確かめたこと・止まった所

1. `git -C tmp/b/vscode worktree list` は、フックに止められた（許可が `C:/b` を前提にしているため）。
   - 何のために: 新しい clone の作業ツリーが main と `wt\1.146.0` の2つだけであることを確かめたかった
   - 代わりに、prepare の記録（`worktree add: status 0`、`worktreeHead` が一致）で確かめた
   - 要るなら、Team に依頼中の権限の変更（`tasks/2026-11-15-move-off-c/permission-requests.md`）で入る形
2. 本家の clone の取得先は `upstream.json` の `repository`（無ければ `https://github.com/microsoft/vscode.git`）。prepare.mjs の113行。
3. `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all --dry-run`: 21単位が `unitsEnabled` に入る。どの場所も `tmp\b` の下。signtool は Windows Kits の 10.0.26100.0 から見つかった。
4. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/env-check-build2.json`: `missing` は空。E: の空きは 4188.4 GB。`longPathsEnabled: 0`。
5. 作業ツリーの最長のパスは測っていない。ビルドは長すぎるパスで止まらなかった。

## R2-7. 大岡越前守への引き継ぎ

**関門に使う版**

| もの | 場所 |
|---|---|
| zip | `E:\develop\self\Team\projects\ai-editor\tmp\b\dist\1.146.0-p5-c-all.zip`（sha256 `e798cce0a39cad4a7e890df79cbeee52964704ffb387296ca0040007354b63a1`、219,102,721 B、2037 項目） |
| gulp の出力（展開した木と同じ中身） | `tmp\b\wt\VSCode-win32-x64`（`Shuko.exe`・`bin\shuko.cmd`。version 1.146.0、commit `101e832240f4f92b1eddb2b505078bed96f84d43`） |
| 作業ツリー | `tmp\b\wt\1.146.0`（HEAD `101e8322…f84d43`。作り直したロックファイル3つが未コミット） |
| 版のソースの枝 | 常設の clone `tmp\b\vscode` の `builds/1.146.0-p5-c-all`（`101e8322…f84d43`） |
| 比べる相手の公式版 | `tmp\b\official\vscode-1.146.0`（`C:\b\p0\vscode-1.146.0` を写したもの。SHA-256 を照らし済み） |
| 記録（2 の照らし役が読むもの） | `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/`（`build-record.json`・`checks.json`・`lockfile.diff`）、ログは `tmp\b\logs\1.146.0-p5-c-all\` |

**気をつける点**

1. 大岡越前守の許可（`git -C C:/b/wt/* ...`・`pnpm --dir C:/b/wt/* ...`・`npx --prefix C:/b/wt/* ...`、bash_exact のロックファイルの再現）は `C:/b` を前提にしている。`tmp/b/wt/1.146.0` には当たらない。
   - 走るのは `node scripts/*.mjs`・`node tests/*.mjs` の形だけ
   - `tmp/b/...` の形の許可は、Team に依頼中の権限の変更で入る
2. この版は、まだ展開も起動もしていない。
   - `p1-launch-check.ps1` は走らせていない
   - この版のスモークの拡張（`tmp\b\smoke\ext\1.146.0-p5-c-all-*`）も無い
3. apply の警告（C-2 の `debugChatIntegration.ts`）は、R2-2 の「apply の警告」のとおり。C-1 と C-2 の重なりで、害は無い。ただし、C-1 だけを無効にして作り直すときは、当たるかどうかを先に確かめる必要がある。
4. 古いスモークの結果は `tmp\b\smoke\archive\runs`・`archive\absent` に写した。`removals/*/README.md` が根拠に挙げる `C:\b\smoke\absent\<名前>\snapshot.json` などは、`tmp\b\smoke\archive\absent\<名前>\` にある。
5. 基準の `tmp\b\smoke\baseline-p2-all.json` などは `tmp\b\smoke\` の直下に写した。
6. 型検査は 6.6 秒で終わった（p2-all は 18.9 秒）。typecheck-client の誤りは 0、終了コードも 0。
   - 短くなった理由は確かめていない。消したソースが多いことや、ファイルのキャッシュが温まっていたことが考えられる
   - 2 の照らし役で、`typecheck.log` が `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck` の1行だけであること（誤りの行が無いこと）を見てほしい

## R2-8. 未解決の点

1. C-1 と C-2 の `delete` の重なり（`debugChatIntegration.ts`）を直すかどうか（R2-2）。リーダーが決める。
2. `%LOCALAPPDATA%\pnpm\package-manager-store`（0.58 GB）と `pnpm-cache` の +18 ファイルを誰が書いたか。時刻からみて、このビルドではない見込みだが、確かめきれていない（R2-5）。
   - 確かめるには、C: の中のファイルの一覧と時刻を読む必要がある。蒙恬の read_paths の外なので、リーダーか Team の側で見てほしい
3. `check-env.ps1` は、本物の環境で `pnpm --version`・`npm --version`・`python` を起こす。C: の pnpm・npm のキャッシュに書く恐れがある（R2-5 の2・3。推定）。
   - 「C: に置かない」の裁定の下で、この台本を使い続けるか、子の環境を向けるように直すかを、リーダーが決める
4. `C:\b` を消すこと（Team に依頼中の権限の変更）。写した15項目は、どれも SHA-256 まで照らし済み。clone（`C:\b\vscode`）と作業ツリー（`C:\b\wt\*`）は写していない。
   - `C:\b\vscode` の枝 `builds/*`・`keep/wt-*` の予定の ref は、新しい clone `tmp\b\vscode` には無い。新しい clone は GitHub から作ったため、`builds/1.146.0-p5-c-all` だけがある
   - 古い版のソース（`builds/1.146.0-p2-all` など）を残すなら、`C:\b\vscode` を消す前に扱いを決める必要がある
5. docs/ との食い違い: 1回目（このファイルの上の「未解決の点」）と、`tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md` の6節・R2-7 の8のとおり。今回、新しく見つけたものは無い。

## R2-9. 成果物（2回目）

- 書き換えた: `removals/C-1-ai/unit.json`・`C-2-debug`・`C-3-remote`・`C-4-notebook`・`C-5-extension-gallery`・`C-6-settings-sync`・`C-7-breadcrumbs-outline` の `unit.json`（`enabled` を `true` に。各1行。コミットしていない）
- 新規（tasks の下）:
  - `tasks/2026-11-15-p5-stagec-gate/move-plan-dry-run2.json`（写す計画）
  - `tasks/2026-11-15-p5-stagec-gate/move-result.json`（写した結果）
  - `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/build-record.json`・`checks.json`・`lockfile.diff`
  - `tasks/2026-11-15-p5-stagec-gate/env-check-build2.json`
  - `tasks/2026-11-15-p5-stagec-gate/disk-c-before-build2.json`・`disk-c-before-build2-extra.json`・`disk-c-after-build2.json`・`disk-c-after-build2-extra.json`
  - `tasks/2026-11-15-p5-stagec-gate/survey-c-pnpm-cache-during-build2.json`・`survey-c-localappdata-pnpm-after-build2.json`
- `tmp\b` の下（git の管理外）:
  - 写したもの15項目
  - 新しい clone `vscode`
  - 作業ツリー `wt\1.146.0`、gulp の出力 `wt\VSCode-win32-x64`
  - `dist\1.146.0-p5-c-all.zip`
  - `logs\1.146.0-p5-c-all\`
  - `cache\`（pnpm の store・キャッシュ、localappdata）、`tmp\`
- 台本（`scripts/`）は直していない。

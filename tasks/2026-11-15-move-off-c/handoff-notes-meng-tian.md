# 引き継ぎの書き付け（蒙恬）: ビルドと一時のファイルを C: から移す

- 作成: 蒙恬（2026-11-15）
- 依頼: `tasks/2026-11-15-move-off-c/brief.md` の「やること（蒙恬）」の1〜3。途中でリーダーから3つの知らせを受けた（キャッシュの大きさ、範囲の追加、`C:\b` の大きさと trial-* の片づけ）
- 結果: **完了**。ただし、置き場所の判断は1つ残る（1.2節の終わり。リーダーがユーザーに諮る）
- 移す・作り直すは走らせていない。消したのは、リーダーの知らせで許可された `C:\b\trial-install`・`C:\b\trial-build` だけ（5節）

## 0. 要点

1. **`<リポジトリ>\tmp\b` は使える**。ただし条件が2つある。
   - スモークの実行の置き場所の名前を短くする（曹参の担当）。そうしないと、Electron のキャッシュのファイルが 260 文字を超える。
   - 同梱拡張を外さない公式の木（`.build\extensions\copilot`）では、3つのファイルが 263 文字になる。
   - 代わりの場所 `E:\b` なら、パスの長さは今と変わらない。
2. 既定の `buildRoot` を `<リポジトリ>\tmp\b` にした（`local-config.mjs`・`local-config.ps1`）。`local.json` は今この PC に無いので、この既定がそのまま効く。
3. ビルドの子の環境で、`TEMP`・`TMP` と pnpm・npm のキャッシュを `<buildRoot>` の下へ向けた。道具の手順（install・typecheck・package）は `LOCALAPPDATA` も向ける。Electron のキャッシュは、`LOCALAPPDATA` を変える以外に向け先を変える方法が無いため（本家のソースで確かめた）。
4. 常設の clone は**写して移す**。作業ツリーは**作り直す**。12個の作業ツリーのうち9個は、HEAD がどの枝からもたどれない。消す前に枝を付ける（`p2` の `ed59899d`〔21単位の木〕を含む）。
5. 権限の変更の一覧は4節にある。今の許可では、作業ツリーを消すこと、`C:\b` の大半を消すこと、写すことができない。

---

## 1. 調べ

### 1.1 C: にある、このプロジェクトが作ったもの

計測は2つある。

- 蒙恬の計測: `node scripts/move-survey.mjs --from C:/b --out tasks/2026-11-15-move-off-c/survey-c-before-move.json`。2026-11-15 13:26 UTC。同じファイルは全体で1回だけ数えた（`globalGB`）。
- リーダーの計測: `du`。

GB の値はおおむね合う。`wt` だけが大きく違う（蒙恬の 17.83 GB に対してリーダーは 13 GB）。違いは hard link の数え方による見込み。

| 場所 | 蒙恬（GB。重なりを除いた値） | リーダーの du | 中身 |
|---|---|---|---|
| `C:\b\wt` | 17.83（11.58） | 13 GB | 作業ツリー12個と gulp の出力 `VSCode-win32-x64`（1.06）。pnpm の store からの hard link が 365,459 個 |
| `C:\b\p0` | 11.37 | 12 GB | `data` 7.98（Phase 0 の環境）、`vscode-1.146.0` 1.05、`vscodium-*` 0.63、`downloads` 0.59、`testbed` 0.57、`vsix` 0.52、`netlog` 0.02、`ws-info.json` |
| `C:\b\smoke` | 5.08 | 5.2 GB | `ext` 2.72（残す版の拡張）、`runs` 1.45、`absent` 0.91、`baseline-*.json` 24個 |
| `C:\b\trial-install` | 4.91 | 5.0 GB | **消した**（5節） |
| `C:\b\p1` | 2.37 | 2.4 GB | `1.146.0-p1-a1-r2`・`-r3` を展開したもの（portable を含む） |
| `C:\b\vscode` | 2.09 | 2.2 GB | 常設の clone（`.git` 1.75、main を checkout した木） |
| `C:\b\p2` | 1.08 | 1.1 GB | `1.146.0-p2-all`（残す版） |
| `C:\b\dist` | 0.73 | 744 MB | `1.146.0-p2-all.zip`・`1.146.0-p1-a1-r3.zip` |
| `C:\b\take-in` | 0.68 | 717 MB | `trial-official-1.146.0`（取り込みの試し） |
| `C:\b\trial-build` | 0.39 | 396 MB | **消した**（5節） |
| `C:\b\cache` | 0.19 | 195 MB | `vsix`（台帳の VSIX のキャッシュ） |
| `C:\b\logs` | 0 | 2.2 MB | ビルドのログ（ラベルごと） |
| `take-in-trial`・`p4-watch`・`notion-sync-trial`・`tmp`・`work-b` | 0 | 1 MB 未満 | 試しの残り |

**ビルドが使う C: のキャッシュ**。どれもほかの用途と共用のため、このプロジェクトの分だけを切り分けることはできない。

| 場所 | 蒙恬（GB） | リーダー | 種類 | 調べた事実 |
|---|---|---|---|---|
| `%LOCALAPPDATA%\pnpm\store` | 3.46（作業ツリーと重ならない分は 0.45） | 3.8 GB | 共用。中身の大半はこのプロジェクトの分 | 3.0 GB は `C:\b\wt` からの hard link。作業ツリーを消すと、この store にしか残らない |
| `%LOCALAPPDATA%\pnpm-cache` | 1.70 | 1.8 GB | 共用 | pnpm のメタデータのキャッシュ |
| `%LOCALAPPDATA%\electron\Cache` | 0.91 | 933 MB | 共用 | Electron の zip。本家のビルドは `@electron/get` 5.0.0 でここに取る |
| `%LOCALAPPDATA%\electron-builder` | 0.06 | 65 MB | ほかの用途 | 本家のビルドは electron-builder を使わない |
| `%LOCALAPPDATA%\node-gyp` | 0.12 | 137 MB | 共用。大半はこのプロジェクトの分の見込み | Electron 43.8.6 と Node 24 のヘッダ |
| `%LOCALAPPDATA%\npm-cache` | 11.0 | 12 GB | 共用 | cacache の形。このプロジェクトの分を分けるには、索引のキー（URL）を1つずつ見るしかない。分けない |
| `%LOCALAPPDATA%\ms-playwright` | 1.84 | — | ほかの用途の見込み | 本家の導入は、ブラウザを取らない見込み（確かめていない） |
| `%LOCALAPPDATA%\node\corepack` | 0.03 | — | 共用 | |
| `%USERPROFILE%\.electron-gyp` | 0.00 | 3 MB | 共用 | |
| `%TEMP%` | 6.76 | — | 共用 | ビルドの分は切り分けられない（Claude Code の一時のファイルも入っている） |
| `%USERPROFILE%\.shuko` | 測っていない | 713 MB | このプロジェクト | 手順書の試しで漏れた拡張。**ユーザーが消す**（リーダーの知らせ） |
| `%APPDATA%\Shuko` | 測っていない | 0.5 MB | このプロジェクト | 同じ試しのログ。**ユーザーが消す** |
| `%LOCALAPPDATA%\Shuko` | — | — | 対象外 | `local.json`（今は無い）・検知の状態・秘密（docs/06 の2.4） |
| `%LOCALAPPDATA%\Programs\Shuko` | — | — | 対象外 | 普段使いのエディタの版（installRoot） |

- C: の空き: 調べの始め（13:23 UTC）は 92.15 GB。trial-* を消した後（13:36 UTC）は **98.15 GB**。
- 環境: `local.json` は無い（4つの値はすべて既定）。`~/.npmrc` は無い。pnpm の全体の設定（`%LOCALAPPDATA%\pnpm\config\rc`）も無い。

### 1.2 置き場所の候補

**第一の候補 `E:\develop\self\Team\projects\ai-editor\tmp\b`**

- 長さは 45 文字（`C:\b` より 41 文字長い）。空白も ASCII 以外の文字も無い（本家の条件。docs/02 の2節）。E: の空きは約 4,197 GB。
- 長いパスの設定（読むだけで確かめた）:
  - `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` = `0x0`（無効）
  - git の `core.longpaths` は未設定（git 2.54.0.windows.1）
  - Node は v24.22.1、pnpm は 12.16.0
- 移した後のパスの長さ（ファイル 259 文字、フォルダ 247 文字が上限。今の木の最長に 41 文字を足した値）:

| 木 | 今の最長 | 移した後 | 判定 |
|---|---|---|---|
| 作業ツリー（14単位を当てた `wt\p2`。node_modules と native のビルドを含む） | 187（`C:\b\wt\p2` の下で 177） | 新しい既定の `wt\1.146.0` の下で **233** | 通る |
| 作業ツリー（本家のまま。`.build\extensions\copilot\node_modules\...` がある） | 222 | **263**（3ファイル） | 超える。A-1 で copilot を消す版には、このフォルダが無い（p2 の木の最長は 187）。公式のままビルドしたときだけ当たる |
| 常設の clone（`src\...\__snapshots__\*.snap`） | 約 200 | 約 241 | 通る |
| gulp の出力 `VSCode-win32-x64` | 156 | 197 | 通る |
| 展開した版（`p1`・`p2` の portable の Code Cache） | 205〜207 | 246〜248 | 通る（余裕は 11 文字） |
| スモークの拡張 `smoke\ext` | 189 | 230 | 通る |
| 取り込みの監査の環境 `take-in\<label>\netaudit-env` | 210 | 251 | 通る |
| Phase 0 の環境 `p0\data` | 202 | 243 | 通る |
| **スモークの実行 `smoke\runs\<label>-<時刻>\user\user-data\Code Cache\electron-preload\<129 文字>.cache`** | 243 | **284**（今ある 28 ファイル） | **超える** |
| **「消えている」の検査 `smoke\absent\<label>-<時刻>\...`（同じ形）** | 239 | **280**（今ある 50 ファイル） | **超える** |

- スモークの置き場所で超える理由: `smoke\runs\` の下の決まった部分は、Code Cache のファイル名を含めて約 190 文字ある。`tmp\b` の 45 文字を足すと 235 文字になり、実行のフォルダの名前に使えるのは **24 文字まで**になる（`absent` では 22 文字まで）。今の名前（例 `p2-B-7-r2-20261114T152738` は 25 文字、`take-in-trial-official-1.146.0-3-20261113T170741` は 47 文字）は収まらない。Electron（Chromium）が自分で書くファイルで、LongPathsEnabled=0 では書けない。キャッシュなので起動は止まらない見込みだが、ログに誤りが出てスモークの結果が変わるかどうかは確かめていない。
  - 直し方の案: 曹参が `tests/smoke` の実行のフォルダの名前を短くする（例: 時刻を短くし、ラベルを縮める）。または `E:\b` を使う。
- git の作業ツリーと clone を、このリポジトリの `tmp\` の下に置いてよいか:
  - git: `tmp/` は `.gitignore` にあり（11行）、このリポジトリの status には出ない。中の clone と作業ツリーは、それぞれの `.git` で動く。取り込みのブランチの作業ツリー（`<buildRoot>\take-in\<label>\repo`。このリポジトリの git worktree）も、リポジトリの中の無視されたフォルダに入る。git はこれを止めない。
  - **Claude Code の Glob は `.gitignore` を見ない**（2026-11-15 に確かめた。リポジトリの直下で `**/package.json` を探すと、無視されている `node_modules\.pnpm\...` が返った。`C:/b` で `*` を探したときは 20 秒で時間切れになった）。`tmp\b` に 60 万近いファイルを置くと、チームのメンバーがリポジトリの直下で広い Glob を使ったときに、遅くなるか時間切れになる。Grep（ripgrep）は既定で `.gitignore` を見る。
  - **取り込みの修理役（`claude -p`。作業場所は `<buildRoot>\wt\<tag>`）が、祖先の CLAUDE.md を読む**。Claude Code は作業場所から上へ向かって CLAUDE.md を読む。修理役は、このリポジトリの CLAUDE.md（「メインセッションはヴラド・ツェペシュ」など）、`E:\develop\self\Team\CLAUDE.md`、`E:\develop\CLAUDE.md` を読むことになる。今の `C:\b\wt\...` には祖先の CLAUDE.md が無い。修理の振る舞いが変わる恐れがあるが、試していない。
  - エディタでこのリポジトリを開いたとき: 検索は既定（`search.useIgnoreFiles`）で `.gitignore` を見る。ファイルの監視は `files.watcherExclude` の既定（`**/node_modules/*/**` など）に入らない部分を見る。リポジトリに `.vscode/settings.json` は無い。`tmp/**` を監視から外す設定を足すかどうかは、蒙恬の書き込み先の外なので、リーダーが決める。
  - **通信の監査の Electron のネットのログ（`<buildRoot>\p0\netlog\`）がリポジトリの中に入る**。docs/07 の3節は「ログには秘密が載りうるので、リポジトリの外に置く」と書く。`./` を読めるメンバー（判定役の狄仁傑を含む）が読める場所になる。食い違いの2に書いた。
- **代わりの場所 `E:\b`**: 長さが `C:\b` と同じ 4 文字なので、上の表の値は今と変わらない（全部 259 文字以下）。リポジトリの外なので、Glob・祖先の CLAUDE.md・netlog の3点も起きない。E: の空きは同じ約 4,197 GB。
- **置き場所の判断（リーダーがユーザーに諮る）**:
  - `tmp\b` は条件つきで使える（スモークの名前の短縮、公式の木の3ファイル、上の3点を受け入れる）。
  - `E:\b` はパスの面でも運用の面でも今と同じに使える。
  - 台本の既定は brief と裁定の第一の候補の `tmp\b` にした。`E:\b` にするときは、`local.json` に `"buildRoot": "E:\\b"` と書くだけでよい（または `DEFAULT_BUILD_ROOT` の1行と `tests/build/root.mjs` の `NEW_DEFAULT`）。

### 1.3 キャッシュの向け先（子の環境だけで向けられるか）

本家と道具のソースで確かめた。利用者の全体の設定は変えない。

| キャッシュ | 子の環境だけで向けられるか | 方法と出典 |
|---|---|---|
| pnpm の store | 向けられる | `pnpm_config_store_dir`。pnpm は `npm_config_*` を読まず、`pnpm_config_*`（大文字も可）を読む（https://pnpm.io/configuring 。本家 `build/azure-pipelines/dependencies-check.yml` の163行にも「pnpm reads `pnpm_config_*`, not `npm_config_*`」とある。本家のテスト `build/lib/test/cloudSandbox.test.ts` の675行が `pnpm_config_store_dir`・`pnpm_config_cache_dir` を使う）。**向けないと、E: で導入したとき pnpm は `E:\.pnpm-store\v11` を作る**（`pnpm store path` を `tmp\` で走らせて確かめた。「store は導入するディスクに1つずつ置く」https://pnpm.io/settings/store ） |
| pnpm のメタデータのキャッシュ | 向けられる | `pnpm_config_cache_dir`（既定 `%LOCALAPPDATA%\pnpm-cache`。https://pnpm.io/settings/other ） |
| pnpm の状態 | `LOCALAPPDATA` で向けられる | 既定 `%LOCALAPPDATA%\pnpm-state`。`stateDir` は環境変数からでも読むかを確かめていないので、名前では向けず、`LOCALAPPDATA` に任せた |
| Electron の取得のキャッシュ | **`LOCALAPPDATA` を変えるしかない** | 本家 1.146.0 の `@vscode/gulp-electron`（`src/download.js` の191〜238行）は、`@electron/get` の `downloadArtifact` に `cacheRoot` を渡さない。`@electron/get` 5.0.0 の `dist/Cache.js` は、既定を `envPaths('electron').cache` にする。env-paths（`index.js` の23・29行）は Windows では `env.LOCALAPPDATA` から `<LOCALAPPDATA>\electron\Cache` を作る。専用の環境変数（昔の `electron_config_cache`）は読まない |
| node-gyp のヘッダ | `LOCALAPPDATA` で向ける | 本家 `build/npm/nodeGypHeaders.ts` の79〜86行が `%LOCALAPPDATA%\node-gyp\Cache\<target>\include\node` を決め打ちで読み、`preinstall.ts` の132〜143行がそこへ本家のヘッダを重ねる。`npm_config_devdir` で node-gyp だけを向けると、この前提と食い違う。`LOCALAPPDATA` を向ければ、node-gyp（env-paths）と本家の両方が同じ場所を見る |
| npm のキャッシュ | 向けられる | `npm_config_cache` |
| TEMP/TMP | 向けられる | 本家のビルドは `os.tmpdir()` を使う（`build/lib/nodeCompileCache.ts` の73行。Windows では `os.tmpdir()` の下に portable の置き場所を作り、作った版を起動する）。`@electron/get` の一時の展開も `os.tmpdir()` |

`LOCALAPPDATA` を向けるのは、道具の手順（install・typecheck・package）の子だけにした。prepare・apply・zip と、エディタを起動する子（install-extensions など）には渡さない。理由は2つある。

- `local.json` と秘密（DPAPI）は本物の `%LOCALAPPDATA%\Shuko\` にあり、node の台本が読む。
- 普段使いのエディタの CLI に偽の `LOCALAPPDATA` を渡したくない。

`LOCALAPPDATA` を向けたときの恐れ（**最初のビルドで確かめる**）:

- node-gyp の Python の探し方は、PATH・`py` ランチャーのほかに `%LOCALAPPDATA%\Programs\Python\Python3*` も見る。PATH に Python が無い PC では見つからなくなる。
- 最初の導入では、Electron の zip（約 140 MB）・ヘッダ・pnpm の全部の依存を取り直す。冷えた状態の導入は、前の実測で 278 秒だった。

---

## 2. 台本の直し（直した点と、曹参が試す入口）

### 2.1 直したファイル

| ファイル | 直したこと |
|---|---|
| `scripts/lib/local-config.mjs` | `REPO_ROOT`（scripts/lib の2つ上。ドライブ文字は大文字）と `DEFAULT_BUILD_ROOT` = `<REPO_ROOT>\tmp\b` を書き出した。`DEFAULTS.buildRoot` = `DEFAULT_BUILD_ROOT`。優先の順（オプション → local.json → 既定）と検査は変えていない |
| `scripts/lib/local-config.ps1` | `$script:ShukoRepoRoot`・`$script:ShukoDefaultBuildRoot`（`$PSCommandPath` から求める。dot-source しても、このファイルの場所になる）。既定の `buildRoot` をそれにした |
| `scripts/lib/build-env.mjs`（新規） | 向け先の名前と、子の環境の部品（2.2） |
| `scripts/build.mjs` | `childEnv(base, extra, opts)` に第3引数を足した。すべての手順に TEMP・TMP と pnpm・npm のキャッシュを、install・typecheck・package にはさらに `LOCALAPPDATA` を渡す。向け先のフォルダは走らせる前に作る（dry-run では作らない）。記録に `envRedirectedForChildren` を足した |
| `scripts/take-in.mjs` | `runLogged` で起こす子（build.mjs・apply.mjs・スモーク・監査・install-extensions・switch.ps1）に、TEMP・TMP = `<buildRoot>\tmp` を渡す。記録と dry-run の出力に `childTemp` を足した。`claude -p`（判定と修理）の環境は変えていない |
| `scripts/p1-launch-check.ps1` | `C:\b\p1`・`C:\b\p2`・「`C:\b` の外は断る」を、`local-config.ps1` の `buildRoot` の下（`<buildRoot>\p1`・`<buildRoot>\p2`・`<buildRoot>\`）にした |
| `scripts/check-env.ps1` | `-BuildRoot` の既定を `local-config.ps1` の `buildRoot` にした |
| `scripts/convert-sublime-keys.mjs` | `--cache` の既定を `<buildRoot>\p0\sublime` にした |
| `scripts/move-survey.mjs`（新規） | 1節の調べの台本。読むだけ（2.3） |
| 説明の文だけ | `apply.mjs`・`prepare.mjs`・`lock-fetch.mjs`・`lock-verify.mjs`・`switch.ps1`・`configure.ps1`・`lib/read-secret.ps1`・`tools/watch/check-dpapi.ps1` の「既定 C:\b」と使い方の例を、`<buildRoot>` か `<リポジトリ>\tmp\b` にした |

**直さなかったもの**（リーダーの範囲の判断。2026-11-15）:

- `scripts/p0-*`・`scripts/lib/p0-common.ps1`: Phase 0 だけの道具なので、`C:\b\p0` の決め打ちのまま。一度直したが、知らせを受けて元に戻した。
- `scripts/measure.ps1`・`scripts/netaudit.ps1`: 曹参の担当。
- `extensions-src/notion-sync/dev/trial.mts`: 既定 `C:\b\notion-sync-trial` を `rm` してから作る。範囲の外なので、一度直したが元に戻した。必要なら別の依頼にしてほしい。直すなら、消す場所を新しく決めるのではなく、`NOTION_SYNC_TRIAL_DIR` を必須にする案を勧める（新しい削除先を足さないため）。
- TAKE-IN.md: `C:\b` の文字は無かった。

### 2.2 子の環境の向け先（決めた名前）

`<buildRoot>` の下:

| 変数 | 値 | 渡す子 |
|---|---|---|
| `TEMP`・`TMP` | `<buildRoot>\tmp` | build.mjs のすべての手順、take-in.mjs の runLogged の子 |
| `pnpm_config_store_dir` | `<buildRoot>\cache\pnpm-store` | build.mjs のすべての手順 |
| `pnpm_config_cache_dir` | `<buildRoot>\cache\pnpm-cache` | 同上 |
| `npm_config_cache` | `<buildRoot>\cache\npm-cache` | 同上 |
| `LOCALAPPDATA` | `<buildRoot>\cache\localappdata` | build.mjs の install・typecheck・package だけ |
| （元の環境にあるときだけ）`ELECTRON_CACHE`・`electron_config_cache` | `<buildRoot>\cache\localappdata\electron\Cache` | build.mjs のすべての手順 |
| （同）`ELECTRON_BUILDER_CACHE` | `<buildRoot>\cache\electron-builder` | 同上 |
| （同）`npm_config_devdir` | `<buildRoot>\cache\localappdata\node-gyp\Cache` | 同上 |
| （同）`PLAYWRIGHT_BROWSERS_PATH` | `<buildRoot>\cache\localappdata\ms-playwright` | 同上 |
| （同）`COREPACK_HOME` | `<buildRoot>\cache\localappdata\node\corepack` | 同上 |

- 「あるときだけ」の変数は、利用者の全体の環境で C: を指していたときに道具がそこへ書くのを防ぐためのもの。無ければ足さない。
- 同じ変数の大文字小文字違い（`Temp`・`NPM_CONFIG_CACHE`・`PNPM_CONFIG_STORE_DIR` など）は、消してから入れる。
- `LOCALAPPDATA` を向けた結果、Electron は `<buildRoot>\cache\localappdata\electron\Cache` に、node-gyp は `<buildRoot>\cache\localappdata\node-gyp\Cache` に取る。

### 2.3 テストの入口（曹参へ）

**`scripts/lib/local-config.mjs`**

- `REPO_ROOT` → `E:\develop\self\Team\projects\ai-editor`（ドライブ文字は大文字）
- `DEFAULT_BUILD_ROOT` → `<REPO_ROOT>\tmp\b`
- `DEFAULTS.buildRoot === DEFAULT_BUILD_ROOT`
- `resolveLocalConfig({ configPath: <無いファイル> }).buildRoot` → `DEFAULT_BUILD_ROOT`、`sources.buildRoot` → `"default"`

**`scripts/lib/local-config.ps1`**: `Resolve-ShukoLocalConfig` の既定の `buildRoot` が Node 側と同じ（`configure.ps1` の出力で確かめる形は、そのまま通った）。

**`scripts/lib/build-env.mjs`**（純粋な関数）

- `CACHE_SUBDIRS` = `{ temp: "tmp", localAppData: "cache\\localappdata", pnpmStore: "cache\\pnpm-store", pnpmCache: "cache\\pnpm-cache", npmCache: "cache\\npm-cache" }`
- `TOOLCHAIN_STEPS` = `["install", "typecheck", "package"]`
- `IF_PRESENT_VARS`（2.2 の表の「あるときだけ」の6つ）
- `cacheLayout(buildRoot)` → `{ root, temp, localAppData, pnpmStore, pnpmCache, npmCache, electronCache, nodeGypCache }`。絶対パスでなければ例外。末尾の `\` は外す（ドライブの直下は残す）
- `tempEnvVars(buildRoot)` → `{ TEMP, TMP }`
- `cacheEnvVars(buildRoot, base)` → `{ TEMP, TMP, pnpm_config_store_dir, pnpm_config_cache_dir, npm_config_cache }` ＋ base にある IF_PRESENT_VARS
- `toolchainEnvVars(buildRoot, base)` → `cacheEnvVars` ＋ `LOCALAPPDATA`
- `applyEnvVars(base, vars)` → `{ env, replaced }`。base は変えない。同じ名前の大文字小文字違いを消してから入れる。値が `undefined`・`null` のものは足さない
- `ensureEnvDirs(vars, { mkdir, exists })` → 作ったフォルダの配列。ドライブ文字の絶対パスの値だけを作る。`mkdir`・`exists` は差し替えられる

**`scripts/build.mjs` の `childEnv(base, extra, opts)`** → `{ env, removed, redirected }`

- `opts` を省くと前と同じで、何も向けない。`redirected` は `{}`。
- `opts = { buildRoot }`（文字列だけを渡してもよい） → `cacheEnvVars` を当てる。`LOCALAPPDATA` は変えない。
- `opts = { buildRoot, toolchain: true }` → `toolchainEnvVars` を当てる（`LOCALAPPDATA` も向ける）。
- 外す変数（`ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`BUILD_SOURCEVERSION`・`VSCODE_*`）は前と同じ。`extra` は向け先にも勝つ。base は変えない。

**`tests/move-off-c.test.mjs` の想定と違う点**: 曹参が3か所を直す。

- `npm_config_store_dir` ではなく `pnpm_config_store_dir`。pnpm 11 以降は `npm_config_*` を読まないため。
- `ELECTRON_CACHE`・`ELECTRON_BUILDER_CACHE`・`npm_config_devdir` は、元の環境にあるときだけ向ける。無ければ足さない。
- `LOCALAPPDATA` は `toolchain: true` のときだけ変わる。曹参の「LOCALAPPDATA は変えない」は `{ buildRoot }` のときに当たる。

なお、最後に走らせたとき（2.4）は、`move-off-c.test.mjs` の16件がすべて通った。

**`build.mjs --dry-run` の記録**: `envRedirectedForChildren` = `{ all, toolchain, toolchainSteps, layout }`（走らせたときは、作ったフォルダの `created` も入る）。

- 試し: `node scripts/build.mjs 1.146.0 --dry-run --label trial-moc --to install`
- 期待: `all.TEMP` = `<buildRoot>\tmp`、`toolchain.LOCALAPPDATA` = `<buildRoot>\cache\localappdata`

**`take-in.mjs --dry-run`**: core と ext の出力に `childTemp` = `{ TEMP, TMP }`（`<buildRoot>\tmp`）。

**`scripts/move-survey.mjs`**（読むだけ）

- 入口: `parseArgs`（`--from` は必須。`--to` の既定は `DEFAULT_BUILD_ROOT`）、`pathShape(p)`（`{ path, length, hasSpace, nonAscii, drive }`）、`lengthAfterMove(p, from, to)`、`CACHE_CANDIDATES`（`{ name, base: <環境変数の名前>, sub: [...], owner, how }`）、`expandCandidate(c, env)` → `{ path, missing }`、`surveyTree(root, { seen, lengths, sample })` → 大きさ・hard link・最長のパス・上限を超える数・リンクの一覧（`links`。たどらない）
- 定数: `FILE_LIMIT = 259`、`DIR_LIMIT = 247`
- 使い方: `node scripts/move-survey.mjs --from C:/b [--to <dir>] [--out <json>] [--no-sizes] [--no-caches] [--only a,b]`

**静的な検査**: `scripts/move-survey.mjs` は C: の古い場所を読むのが仕事だが、`C:\b` も `%TEMP%` もコードの行に持たない形にした（`--from` を必須にし、キャッシュの場所は環境変数の名前と区切りで持つ）。曹参の例外に入れなくても、静的な検査は通る。

### 2.4 自分で確かめたこと

`node --check` は、直した `.mjs` のすべてで通った（`build.mjs`・`take-in.mjs`・`move-survey.mjs`・`lib/build-env.mjs`・`lib/local-config.mjs`・`convert-sublime-keys.mjs`・`apply.mjs`・`prepare.mjs`・`lock-fetch.mjs`・`lock-verify.mjs`・元に戻した `p0-fetch.mjs`・`p0-openvsx-meta.mjs`）。

テストの結果:

- `node --test tests/move-off-c.test.mjs tests/local-config.test.mjs tests/build-fixes.test.mjs tests/configure.test.mjs`（最初）: 96件中 92件が通った。落ちた4件は、どれも `childEnv` の変数の名前の想定の違いだった（上）。直した後の回では、move-off-c の16件がすべて通った。
- 上の4ファイルに `build-parts`・`take-in-more` を足した回: 178件中 177件が通った。**落ちた1件は `tests/build-parts.test.mjs` の290行**で、`--dry-run` の既定の buildRoot に古い `c:\b` を期待している。曹参が新しい既定に直す。
- `node --test tests/take-in.test.mjs tests/install-ext.test.mjs`: 141件がすべて通った。
- `node --test tests/p1-scripts.test.mjs tests/take-in-more.test.mjs`: 77件がすべて通った（`p1-launch-check.ps1` の `<buildRoot>\p1`・`p2` の判定と、local.json の buildRoot を含む）。

dry-run の結果:

- `node scripts/build.mjs 1.146.0 --dry-run --label trial-moc --to install`: buildRoot は `E:\develop\self\Team\projects\ai-editor\tmp\b`（出どころは default）。worktree・dist・logs もその下になった。向け先は 2.2 のとおりに出た。何も書いていない。
- `node scripts/take-in.mjs core 1.147.0 --dry-run --to prepare --skip-judge --no-writeback`: 取り込みのブランチの作業ツリー・作業ツリー・dist・smoke の基準・監査の環境は、どれも `tmp\b` の下になった。

`node tests/run-all.mjs` の全体は走らせていない（曹参の直しの後に、リーダーか大岡越前守が走らせる）。

---

## 3. 移す段取り（書くだけ。走らせていない）

### 3.1 移すもの・作り直すもの・消すもの

新しい場所は `<新>` と書く（`tmp\b` か `E:\b`）。

| 場所 | 扱い | 理由・中身 |
|---|---|---|
| `C:\b\vscode`（常設の clone、2.09 GB） | **写して移す** | 枝 `builds/<label>`（版のソース）・タグ・本家の origin の設定をそのまま残すため。clone し直すと、`builds/*` が origin の追跡の ref になり、本家に向けて fetch したときに扱いが変わる。作業ツリーを先に外してから写す（3.2 の手順4・5） |
| `C:\b\wt\*`（作業ツリー12個、17.83 GB） | **作り直す**（移さない） | node_modules は C: の pnpm の store からの hard link なので、ドライブをまたいで写すと実体が全部写される。`.modules.yaml` の store の場所も変わる。build.mjs の prepare が `<新>\wt\<tag>` を作る。外す前に、たどれない HEAD に枝を付ける（手順3） |
| `C:\b\wt\VSCode-win32-x64`（gulp の出力、1.06 GB）と `*.prepare.json` | 消す | 次のビルドで作り直す |
| `C:\b\dist`（zip 2個） | 移す | 残す版 |
| `C:\b\p2\1.146.0-p2-all` | 移す | 残す版（展開したもの） |
| `C:\b\p1\1.146.0-p1-a1-r3` | 移す | 残す版（Phase 1 の記録）。zip からも作り直せる |
| `C:\b\p1\1.146.0-p1-a1-r2`・`1.146.0-upstream-partial` | 消す | 残す版の外（r2 の zip は前の片づけで消した） |
| `C:\b\smoke\ext`（`1.146.0-p1-a1-r3` と `1.146.0-p2-all-1`〜`-3`、マーカー） | 移す | 残す版のスモークの拡張 |
| `C:\b\smoke\baseline-*.json`（24個） | 移す | スモークの基準（`baseline-p2-all.json` は次の取り込みの比べる元） |
| `C:\b\smoke\runs`・`C:\b\smoke\absent` | **結果のファイルだけ移す**（`*.json`・`*.md`・`*.txt`・`*.log`）。残りは消す | 記録に使うログ（`removals/*/README.md` が `C:\b\smoke\absent\...\snapshot.json` などを根拠に挙げている）。Electron のキャッシュは移すと 260 文字を超え、要らない |
| `C:\b\smoke\apply-cli` | 消す | 試しの残り |
| `C:\b\cache\vsix` | 移す | VSIX のキャッシュ（取り直すと Open VSX への通信が増える） |
| `C:\b\logs` | 移す | ビルドの記録（`records/builds/*.json` の `steps[].log`）が指す |
| `C:\b\p0`（`netlog` を除く、11.35 GB） | 移す | `vscode-1.146.0` はスモークの既定（曹参の `tests/smoke/lib/common.mjs` の `<buildRoot>\p0\vscode-1.146.0`）。`ws-info.json` は measure.ps1 が読む。`data` は Phase 0 の環境と、手作業の監査に使った `upstream-default`（`records/phase2/manual-checks-p2-all.md`）。E: は空きが大きいので、まとめて移すのがいちばん安全。容れ物を減らしたいときは、`data`・`testbed`・`vscodium-*`・`probe`・`run`・`scratch`・`trial` を消してよいかを別に決める |
| `C:\b\p0\netlog` | 消す（移さない） | 秘密が載りうる（docs/07 の3節）。ホスト名は records に写してある見込み。消す前に、`records/network-audits/` にあることを確かめる |
| `C:\b\take-in\trial-official-1.146.0` | 消す | 取り込みの試し |
| `C:\b\take-in-trial`・`C:\b\p4-watch`・`C:\b\notion-sync-trial`・`C:\b\tmp` | 消す | 試しの残り（`p4-watch\trial` は DPAPI の自己確認のファイル） |
| `C:\b\work-b` | 移す（README.txt だけ） | 用途を確かめていない。小さいので残す |
| `C:\b\trial-install`・`C:\b\trial-build` | **消した**（5節） | |
| `C:\b` そのもの | 最後に消す | |
| `%USERPROFILE%\.shuko`（713 MB）・`%APPDATA%\Shuko` | **ユーザーが消す** | 手順書の試しの漏れ（リーダーの知らせ） |
| `%LOCALAPPDATA%\pnpm\store`（3.46 GB）・`pnpm-cache`（1.7）・`electron\Cache`（0.91）・`node-gyp`（0.12） | ユーザーが決める | 利用者の全体のキャッシュ。移した後のビルドは `<新>\cache` を使うので、このプロジェクトはもう足さない。store は作業ツリーを消すと、ほかから使われない分が残る（`pnpm store prune` で減る見込み。確かめていない） |
| `%LOCALAPPDATA%\npm-cache`（11 GB）・`ms-playwright`（1.84）・`electron-builder`・`%TEMP%` | ユーザーが決める | 共用で、このプロジェクトの分を分けられない |

E: に移す量は約 19 GB（p0 の 11.35 を含む）。C: で空くのは `C:\b` の全部で、約 38 GB。trial-* を消した後の量。

### 3.2 手順

前提: 4節の権限の変更が入っている。`C:\b` の下から起動したエディタ・ビルドが無い。段階 C のビルドを始めていない。

1. 前の記録を取る: `node scripts/move-survey.mjs --from C:/b --out tasks/<日付>-move-off-c-run/survey-before.json`（今の許可で走る）。
2. 作業ツリーに作業中の変更が無いことを確かめる: 12個それぞれに `git -C C:/b/wt/<名前> status --porcelain`（今の許可で走る）。変更があれば止めて、リーダーに知らせる。
3. たどれない HEAD に枝を付ける（1節の調べで、枝からもタグからもたどれなかった9個）:

   | 作業ツリー | HEAD |
   |---|---|
   | `1.145.3` | `79055c2c` |
   | `dev-a-apply` | `28869a09` |
   | `dev-b` | `44be84f8` |
   | `dev-c1` | `8d5cdfd0` |
   | `dev-c3` | `526d25d7` |
   | `p1-a1` | `cff68091` |
   | `p2` | `ed59899d`（21単位の木） |
   | `trial-bwt` | `4be87ac6` |
   | `verify-p2` | `6fba38db` |

   それぞれに `git -C C:/b/vscode branch keep/wt-<名前> <40桁>` を走らせる。全桁は `survey-c-before-move.json` の `worktrees.clone.items`。**今の許可では走らない。**
4. 作業ツリーを外す: 12個それぞれに `git -C C:/b/vscode worktree remove --force C:/b/wt/<名前>`。その後 `git -C C:/b/vscode worktree prune` と `rm -rf C:/b/wt`（gulp の出力と `*.prepare.json`）。
   - `--force` の形と `rm -rf C:/b/wt` は、今の許可では走らない。
   - `--force` が要る理由: node_modules など、追跡しないファイルがあるため。
5. 写す（コピーだけ。消さない）:
   - `cp -a C:/b/vscode <新>/vscode`
   - `cp -a C:/b/dist <新>/dist`
   - `cp -a C:/b/p2/1.146.0-p2-all <新>/p2/1.146.0-p2-all`
   - `cp -a C:/b/p1/1.146.0-p1-a1-r3 <新>/p1/1.146.0-p1-a1-r3`
   - `cp -a C:/b/smoke/ext <新>/smoke/ext`
   - `cp -a C:/b/cache <新>/cache`
   - `cp -a C:/b/logs <新>/logs`
   - `cp -a C:/b/work-b <新>/work-b`
   - `p0` の `netlog` 以外の子
   - `baseline-*.json` と、`runs`・`absent` の結果のファイル（拡張子で選ぶ）

   **今の許可ではどれも走らない。** ワイルドカードを含む写し方は、フックがコマンドの `*` を止める見込み。そのため、**写すだけで消さない台本**（例 `scripts/move-build-root.mjs`。3.1 の表を持ち、`--dry-run` で計画を出し、写した後に数と大きさを照らす）を蒙恬が書く案を勧める。これなら許可の追加は不要（`node scripts/*.mjs` に入る）。書くかどうかはリーダーが決める（今は書いていない）。
6. 確かめる（走らせるのは、5を走らせたとき）:
   - `git -C <新>/vscode worktree list`（main だけになっていること）
   - `git -C <新>/vscode rev-parse builds/1.146.0-p2-all keep/wt-p2`
   - `git -C <新>/vscode config --list --show-origin`（`C:\b` のパスが無いこと）
   - zip の SHA-256 を記録と照らす（`1.146.0-p2-all.zip` は `15aa0ce7…6f6f`。`tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json`）
   - `node scripts/move-survey.mjs --from <新> --no-caches` で、数と大きさを前と比べる
   - `node tests/run-all.mjs --save tasks/<dir>/run-all-after-move.json`（`tests/build/root.mjs` は `<新>\vscode` があればそちらを使う）
7. 消す: `rm -rf C:/b`。消した後に C: の空きを `node scripts/disk-usage.mjs --out ... x=C:/b` で記録する。**今の許可では走らない。**
8. ユーザーに頼む: `%USERPROFILE%\.shuko`・`%APPDATA%\Shuko` を消す。共用のキャッシュ（3.1 の表の下の段）の扱いを決める。
9. 移すための一時の許可を外す（4節）。
10. 新しい場所で、段階 C をまとめた版を最初にビルドする（別の依頼）。冷えた状態の導入（約 5 分と、Electron・ヘッダ・依存の取り直し）、node-gyp の Python の見つけ方（1.3 の恐れ）、スモークの置き場所の長さ（1.2）を、その回で確かめる。

### 3.3 今の許可で走るもの・走らないもの

- **走る**: 手順1、2、6 の一部（`node scripts/*.mjs`・`node tests/*.mjs` は曹参・大岡越前守の許可の形）。`git -C <新>/vscode ...` は、4節で足す形に入る。
- **走らない**: 手順3（`git branch`）、4（`--force` と `rm -rf C:/b/wt`）、5（`cp`）、7（`rm -rf C:/b`）。

---

## 4. 権限の変更の一覧（リーダーが Team の開発部へ依頼する）

書き方は今の `permissions.json` に合わせた。新しい場所は `tmp\b` を例に、リポジトリからの相対で `tmp/b/` と書く。`E:\b` にするときは `tmp/b/` を `E:/b/` に読み替える。

- コマンドはリポジトリの直下で、この相対の形で打つ（フックは文字で照らすので、絶対パスで打つと一致しない）。
- 台本（build.mjs など）が中で起こす git・pnpm には、フックはかからない。

### 4.1 蒙恬（`team/departments/development/meng-tian/permissions.json`）

**ずっと使う（`C:/b` の行を置き換える）**

| 欄 | 今 | 新しい書き方の案 |
|---|---|---|
| bash | `git -C C:/b/vscode fetch --tags` | `git -C tmp/b/vscode fetch --tags` |
| bash | `git -C C:/b/vscode worktree add C:/b/wt/*` | `git -C tmp/b/vscode worktree add tmp/b/wt/*` |
| bash | `git -C C:/b/vscode worktree remove C:/b/wt/*` | `git -C tmp/b/vscode worktree remove tmp/b/wt/*` |
| bash | `git -C C:/b/vscode worktree prune` | `git -C tmp/b/vscode worktree prune` |
| bash | `git -C C:/b/vscode tag --list` | `git -C tmp/b/vscode tag --list` |
| bash | `git -C C:/b/wt/* status`・`diff`・`apply`・`am -3`・`am --abort`・`am --continue`・`format-patch`・`checkout`・`clean -xfd`・`rerere`・`add`・`commit -m`（12行） | 同じ12行の `C:/b/wt/*` を `tmp/b/wt/*` に |
| bash | `git clone https://github.com/microsoft/vscode.git C:/b/vscode` | `git clone https://github.com/microsoft/vscode.git tmp/b/vscode` |
| bash | `pnpm --dir C:/b/wt/* install`・`run gulp`・`run compile`・`run smoketest`（4行） | `C:/b/wt/*` を `tmp/b/wt/*` に |
| bash | `npx --prefix C:/b/wt/* tsc --noEmit` | `npx --prefix tmp/b/wt/* tsc --noEmit` |
| write_paths | `C:/b/` | 外す（`tmp/` で足りる。`E:\b` なら `E:/b/` に置き換える） |
| read_paths | `C:/b/` | 移した後に外す（`./` で足りる。`E:\b` なら `E:/b/`） |
| delete_paths | `C:/b/p2/`・`C:/b/dist/`・`C:/b/smoke/ext/`・`C:/b/trial-*` | `tmp/b/p2/`・`tmp/b/dist/`・`tmp/b/smoke/ext/`・`tmp/b/trial-*` |
| delete_keep | `C:/b/p2/1.146.0-p2-all` ほか7行 | 同じ7行の `C:/b/` を `tmp/b/` に |

**移すための一時の許可（手順9で外す）**

| 欄 | 足す行 | 使う手順 |
|---|---|---|
| bash | `git -C C:/b/vscode branch keep/wt-*` | 3 |
| bash | `git -C C:/b/vscode worktree remove --force C:/b/wt/*` | 4 |
| bash（`git -C <新>` の確かめ） | `git -C tmp/b/vscode worktree list`・`git -C tmp/b/vscode rev-parse`・`git -C tmp/b/vscode config --list --show-origin` | 6 |
| bash_exact（写す。手順5で台本を使わないとき） | `cp -a C:/b/vscode tmp/b/vscode`・`cp -a C:/b/dist tmp/b/dist`・`cp -a C:/b/p2/1.146.0-p2-all tmp/b/p2/1.146.0-p2-all`・`cp -a C:/b/p1/1.146.0-p1-a1-r3 tmp/b/p1/1.146.0-p1-a1-r3`・`cp -a C:/b/smoke/ext tmp/b/smoke/ext`・`cp -a C:/b/cache tmp/b/cache`・`cp -a C:/b/logs tmp/b/logs`・`cp -a C:/b/work-b tmp/b/work-b`、`p0` の子ごとの同じ形 | 5 |
| delete_paths | `C:/b/wt/` | 4（`rm -rf C:/b/wt`） |
| delete_paths | `C:/b`（末尾の `/` なし。区切りそのものとその下） | 7（`rm -rf C:/b`）。手順6の確かめが済んでから使う。そのときは `delete_keep` の `C:/b/` の行を外す |

- 手順5を「写すだけの台本」で行うなら、bash_exact の `cp -a` の行は要らない。
- 台本を通して消すことはしない。消すのは `rm -rf` の形だけで、許可の中に限る。

### 4.2 曹参（`team/departments/development/cao-shen/permissions.json`）

| 欄 | 今 | 新しい書き方の案 |
|---|---|---|
| bash | `pnpm --dir C:/b/wt/* run smoketest` | `pnpm --dir tmp/b/wt/* run smoketest` |
| read_paths | `C:/b/` | 移した後に外す（`./` で足りる。`E:\b` なら `E:/b/`） |

### 4.3 大岡越前守（`team/departments/development/ooka-echizen/permissions.json`）

| 欄 | 今 | 新しい書き方の案 |
|---|---|---|
| bash | `pnpm --dir C:/b/wt/* run smoketest` | `pnpm --dir tmp/b/wt/* run smoketest` |
| bash | `npx --prefix C:/b/wt/* tsc --noEmit` | `npx --prefix tmp/b/wt/* tsc --noEmit` |
| bash | `git -C C:/b/wt/* status`・`git -C C:/b/wt/* diff` | `git -C tmp/b/wt/* status`・`git -C tmp/b/wt/* diff` |
| bash_exact | `git -C C:/b/wt/* checkout *.*.*`・`git -C C:/b/wt/* checkout -- pnpm-lock.yaml`・`pnpm --dir C:/b/wt/* install --lockfile-only --ignore-scripts` | 同じ3行の `C:/b/wt/*` を `tmp/b/wt/*` に |
| read_paths | `C:/b/` | 移した後に外す（`./` で足りる。`E:\b` なら `E:/b/`） |

### 4.4 狄仁傑（判定役。参考）

- `read_paths` は `./` だけ。`tmp\b` に置くと、作業ツリー・展開した版・`p0\netlog`（秘密が載りうる）・取り込みの監査の作業場所（`take-in\<label>\netaudit-run`）を読めるようになる。今の `C:\b` は読めない。
- 案: 4人の `secret_paths` に `tmp/b/p0/netlog/` と `tmp/b/take-in/*/netaudit-run/` を足す。または `E:\b` にする（リポジトリの外なので、今と同じく読めない）。
- netaudit.ps1 の netlog の既定の場所は曹参が直す。リポジトリの外に置くかどうかも、合わせて決める必要がある。

---

## 5. trial-* の片づけ（リーダーの知らせで行った）

- 消したもの: `C:\b\trial-build`（0.39 GB）と `C:\b\trial-install`（4.91 GB）。`rm -rf C:/b/trial-build` と `rm -rf C:/b/trial-install` で消した。今の delete_paths（`C:/b/trial-*`）の中で、台本は使っていない。
- 消す前に確かめたこと:
  - `records/`・`docs/`・`removals/` に、この2つを指す行は無かった。`tasks/` にある言及は、Phase 2 の切り替え・ビルドの試し（`tasks/2026-11-13-p2-build-switch/` など）の残りだけ。結果は tasks の JSON に残っている。
  - 中のリンクは `C:\b\trial-install\B\current` → `C:\b\trial-install\B\versions\1.146.0-3` の1つだけで、中を指していた（`tasks/2026-11-15-move-off-c/survey-trial-links.json`）。外を指すジャンクションは無かった。
- C: の空き: 消す前は 92.84 GB（13:35 UTC）、消した後は **98.15 GB**（13:36 UTC。`tasks/2026-11-15-move-off-c/disk-after-trial-delete.json`）。約 5.3 GB 増えた。

---

## 6. docs/ との食い違い（リーダーが直す）

1. docs/02 の2節（「ビルドの作業場所はリポジトリの外に置く」「既定 `C:\b\`」と、`C:\b\...` の図）、6.1 の例と表（`buildRoot` の既定 `C:\b`）、7節の例。CLAUDE.md の「ビルドの作業場所はリポジトリの外（既定 `C:\b\`）」も同じ。既定はリポジトリの中の `tmp\b` になった（`E:\b` に決まれば、リポジトリの外のまま）。
2. docs/07 の3節「ネットのログはリポジトリの外（既定 `C:\b\p0\netlog\`）に置く」。`tmp\b` にすると、既定でリポジトリの中になる（1.2・4.4）。
3. docs/06 の9節「スモークの基準 `C:\b\smoke\baseline-<label>.json`」。今は `<buildRoot>\smoke\...`。
4. docs/install.md: `buildRoot` の表（`C:\b`）、`C:\b\dist\...` の手順、`C:\b\cache\vsix\`。
5. docs/02 の5節の Phase 1 の実測（「C: の空きの減り 2.3 GB」）は、移した後は C: ではなく新しい場所の値になる（記録としては残してよい）。
6. docs/07 の2.1・2.x の Phase 0 の置き場所（`C:\b\p0\...`）: Phase 0 の道具は直さない判断なので、資料もそのまま。ただし `p0` を移すと、資料の場所と実体が食い違う。

---

## 7. 未解決の点

1. **置き場所の判断**: `tmp\b`（条件つき）か `E:\b` か（1.2）。ユーザーに諮る。台本の既定は `tmp\b`。
2. スモークの実行の置き場所の名前を短くする（`tmp\b` のとき。runs は 24 文字まで、absent は 22 文字まで）。曹参の担当（`tests/smoke`）。
3. `tests/build-parts.test.mjs` の290行が、古い既定 `c:\b` を期待している。曹参の担当。
4. 取り込みの修理役が祖先の CLAUDE.md を読む件（`tmp\b` のとき）。試していない。
5. エディタでこのリポジトリを開いたときのファイルの監視（`tmp/**` を `files.watcherExclude` に足すか）。`.vscode/` は蒙恬の書き込み先の外。
6. 手順5で、写すだけの台本を書くかどうか（書けば許可の `cp` の行が要らない）。
7. Phase 0 の道具は `C:\b\p0` の決め打ちのまま。移した後にこれらを走らせると、C: に `C:\b\p0` を作り直す。使わないか、引退させるかを決める必要がある。
8. `extensions-src/notion-sync/dev/trial.mts` の既定 `C:\b\notion-sync-trial`（範囲の外なので戻した。2.1）。
9. `LOCALAPPDATA` を向けたときの node-gyp の Python の見つけ方と、Electron などの取り直しは、最初のビルドで確かめる（1.3）。
10. 共用のキャッシュ（pnpm の store など）と `.shuko`・`%APPDATA%\Shuko` は、ユーザーが扱いを決めて消す。

## 8. 成果物

- `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md`（この書き物）
- `tasks/2026-11-15-move-off-c/survey-c-before-move.json`（1節の調べ。`C:\b` の大きさ・パスの長さ・キャッシュ・設定・作業ツリーの一覧）
- `tasks/2026-11-15-move-off-c/survey-trial-links.json`（trial-* のリンクの確かめ）
- `tasks/2026-11-15-move-off-c/disk-after-trial-delete.json`（trial-* を消した後の C: の空き）
- 新規: `scripts/lib/build-env.mjs`、`scripts/move-survey.mjs`
- 直した: `scripts/lib/local-config.mjs`、`scripts/lib/local-config.ps1`、`scripts/build.mjs`、`scripts/take-in.mjs`、`scripts/p1-launch-check.ps1`、`scripts/check-env.ps1`、`scripts/convert-sublime-keys.mjs`、説明の文だけ（`scripts/apply.mjs`・`prepare.mjs`・`lock-fetch.mjs`・`lock-verify.mjs`・`switch.ps1`・`configure.ps1`・`lib/read-secret.ps1`・`tools/watch/check-dpapi.ps1`）
- 一度直して元に戻した: `scripts/p0-*.ps1`・`p0-*.mjs`・`scripts/lib/p0-common.ps1`、`extensions-src/notion-sync/dev/trial.mts`

---

# 2回目（2026-11-16。`tmp\b` の裁定を受けた直し）

- 依頼: リーダーの知らせ「tmp\b の裁定を受けた直し」の1〜5。裁定は docs/user-decisions.md の 2026-11-15「ビルドの置き場所と Phase 0 の残り」
- 結果: **完了**。ただし秘密の場所（R2-3）は、フックの作りのため、頼まれた形（secret_paths に足す）のままでは入れられない。案を3つ書いた。リーダーが決める
- `C:\b` には何も作っていない。消してもいない。`tmp\b` には、写す台本の dry-run を含めて何も作っていない。ただし、中身の無い `tmp\b` というフォルダが1つある（R2-7 の1）

## R2-0. 要点

1. Phase 0 の道具12本の先頭に「引退」の注記を足した。動きは変えていない。`lib/p0-common.ps1` は、今も `p1-launch-check.ps1` が dot-source している。注記に、使ってよい関数と使わない関数を分けて書いた。
2. `C:\b\p0` の下で、まだ要るものは2種類ある。
   - **公式の 1.146.0**（展開したもの 1.05 GB と zip 0.38 GB）: スモーク・「消えている」の検査・取り込みが、比べる相手として今も使う。`<buildRoot>\official\` に写す。
   - **記録が根拠に挙げる小さなファイル**（`records/phase0/` が指す JSON・md。合わせて 1 MB 未満）: `records/phase0/evidence/` に写す案。
   - そのほか（`data` 7.98 GB・`testbed`・`vscodium`・`vsix` の VSIX・`netlog` など）は写さずに消してよい。
3. **秘密の場所を secret_paths に足すと、4人全員がリポジトリの直下で Glob・Grep を使えなくなる**（フックのソースで確かめた）。secret_paths には `*` も書けない（書くと、全員のすべての呼び出しが止まる）。案は R2-3。
4. 写す段取りは**写すだけの台本** `scripts/move-build-root.mjs` にした（新規。消さない、上書きしない、写した後に照らす）。dry-run で計画を確かめた。写す量は 9.44 GB で、長すぎるパスは無い。clone は、作業ツリーが付いているので止まった（前提どおり）。
5. 取り込みの通信の監査の作業場所を `<buildRoot>\take-in\<label>\netaudit-run` から `<buildRoot>\audit` に移した（take-in.mjs）。`tmp\b` の下では、実行のフォルダの Code Cache が 282 文字になるため（移した後は 257 文字）。ネットのログは `<buildRoot>\netlog` に出る（netaudit.ps1 の「WorkRoot の親\netlog」の決まり）。

## R2-1. Phase 0 の道具の引退

注記を足したファイル（12本。動きは変えていない）:

- `scripts/p0-check-ps.ps1`・`p0-env.ps1`・`p0-expand.ps1`・`p0-ext-allowed.ps1`・`p0-launch.ps1`・`p0-scratch.ps1`・`p0-stop.ps1`・`p0-ws.ps1`
- `scripts/lib/p0-common.ps1`
- `scripts/p0-fetch.mjs`・`p0-lsp-probe.mjs`・`p0-openvsx-meta.mjs`

注記の文:

- `.ps1` は英語にした（ASCII だけにする決まりのため）。「RETIRED (2026-11-15): Phase 0 is closed. Do not run this script. If it has to run again, first change it to use buildRoot (scripts\lib\local-config.ps1) instead of C:\b.」と、裁定の出典。
- `.mjs` は日本語にした。「引退（2026-11-15。Phase 0 は閉じた。走らせない。走らせるなら先に buildRoot を使う形に直す）」と、裁定の出典。shebang の次の行に入れた。

注記の場所:

- `.ps1` は、コメントによるヘルプ（`<# ... #>`）の前のコメント行にした。PowerShell は、ヘルプの前のコメントと空行を許す。

例外として扱ったもの:

- `lib/p0-common.ps1` は、引退の道具でありながら、今も使う `p1-launch-check.ps1` が dot-source している。`p1-launch-check.ps1` が使うのは `Invoke-P0Native`・`Resolve-P0Editor`・`Read-P0Json`・`Invoke-P0WithEditorEnv`・`Get-P0ProcessTree`・`Stop-P0ProcessTree` だけで、どれも `$script:P0Root`（`C:\b\p0`）に触れない（呼び出しを grep で確かめた）。dot-source しただけでは何も作らない。注記には、`C:\b\p0` を使う関数（`Get-P0EnvPaths`・`Assert-P0Path`・`Get-P0UpstreamRoot`・`Get-P0VscodiumRoot`・`Find-P0Vsix`・`Get-P0TestbedRoot`・`Initialize-P0Testbed`）を使わないと書いた。
- `p0-check-ps.ps1`（PowerShell の構文と ASCII の検査）と `p0-lsp-probe.mjs` は、`C:\b` を使わない。名前が p0 なので引退の注記を付けた。そのことも注記に書いた。`p0-check-ps.ps1` は今の `.ps1` の検査にも役に立つ。名前を変えて残すかどうかは、リーダーが決める。

確かめたこと:

- `node --check` を `p0-fetch.mjs`・`p0-openvsx-meta.mjs`・`p0-lsp-probe.mjs` に走らせ、通った。
- `p0-check-ps.ps1` で `.ps1` 18本の構文と ASCII を確かめた。誤りは 0、ASCII 以外のバイトは 0。この検査はファイルを読むだけだが、引退の注記を付けた台本そのものを走らせたことになる。

## R2-2. `C:\b\p0` を消す前の確かめ（読むだけ）

調べ方は trial-* のときと同じにした。

- `records/`・`docs/`・`removals/`・`tests/`・`scripts/` で、`C:\b\p0` を指す行を grep した。
- `node scripts/move-survey.mjs --from C:/b/p0 --only data,vsix,sublime,downloads,run,trial,probe,logs,netlog --no-caches --out tasks/2026-11-15-move-off-c/survey-p0.json` で、中身と大きさを読んだ。

| `C:\b\p0` の下 | 大きさ | 指しているもの | 扱いの案 |
|---|---|---|---|
| `vscode-1.146.0`（公式の zip を展開したもの） | 1.05 GB | スモークの既定の `--build`（曹参の `tests/smoke/lib/common.mjs` の `DEFAULT_BUILD` = `<buildRoot>\p0\vscode-1.146.0`）、「消えている」の検査の公式との比べ（`records/take-in/1.146.0-p2-A-*/gate-*.md`）、`records/phase1/smoke-verify*-official-1.146.0.md`、`removals/B-1-telemetry/README.md` | **写す** → `<buildRoot>\official\vscode-1.146.0`。比べる相手として今も要る。曹参が `DEFAULT_BUILD` を直す（1行） |
| `downloads\VSCode-win32-x64-1.146.0.zip` と `p0-fetch.json`（版・URL・SHA-256） | 0.38 GB | 上の展開の元 | **写す** → `<buildRoot>\official\downloads\`。展開を照らし直せるようにする |
| `downloads\VSCodium-*.zip`・`vscodium-1.143.17232`・`testbed` | 1.43 GB | Phase 0 の比べ（`records/network-audits/2026-11-13-p05-testbed/` は宛先の一覧だけを持つ） | 消す |
| `data\*`（15の環境。`bp-probe-a`〜`d`、`testbed*`、`upstream-default`、`upstream-ai-disabled` など） | 7.98 GB | `records/network-audits/*/destinations.json` に、`EnvDir` として名前だけが残る。`records/phase2/manual-checks-p2-all.md` の手作業の監査の手順が `-EnvDir C:/b/p0/data/upstream-default` を使う | 消す。要るのは環境そのものではなく、宛先の記録で、それは records にある。ただし `upstream-default` は、台帳の拡張を入れた監査の環境（p2-all-ledger）だった。段階 C の手作業の監査で同じ形が要るなら、`install-extensions.mjs --portable` で作り直す（取り込みの `buildNetEnv` と同じ作り方）。手順書の直しはリーダーが決める（R2-8 の5） |
| `vsix\verify-result.json`（83,682 B）・`vsix\fetch-result.json`（33,548 B） | 小 | `records/phase0/lock-verification.md`（4・92行）が根拠に挙げる | **records に写す案** → `records/phase0/evidence/vsix/` |
| `vsix\anthropic.claude-code-2.1.322@win32-x64\` の `files.json`・`extension.vsixmanifest`・`package.json`・`api.json` | 小 | `records/phase0/claude-code-manifest.md`（5・85行）が根拠に挙げる。`package.json`・`api.json` は `C:\b\cache\vsix\` にも同じ版がある。`files.json`・`extension.vsixmanifest` はここにしか無い | **records に写す案** → `records/phase0/evidence/claude-code-2.1.322/`。VSIX 本体・`bundled-cli\claude.exe`・署名は写さない |
| `vsix\` のそのほか（VSIX 本体。合わせて 0.52 GB） | 0.52 GB | 台帳の VSIX は `C:\b\cache\vsix` にある（docs/02 の8節。こちらを写す） | 消す |
| `trial\verify-result.json`・`trial\lock.json` | 小 | `records/phase0/lock-verification.md`（106行。大岡越前守の試し） | records に写す案 → `records/phase0/evidence/trial/`（任意） |
| `sublime\` の機械の出力（`conversion.md`・`converted-keybindings.json`・`dropped.json`・`claude-code-keybindings.json`・`conflicts.json`・`same-key-different-when.json`・`convert-meta.json`・`sublime-4.1.10.package.json`・`.sha256`） | 合わせて約 38 KB | `records/phase0/sublime-keys.md`（4・5・10行）。結果の正本は `extensions-src/mydist/package.json` | **records に写す案** → `records/phase0/evidence/sublime/`。VSIX（359 KB）は写さない |
| `ws-info.json` | 3.9 KB | 計測が開く2つのファイル（`measure.ps1` の既定 `<buildRoot>\p0\ws-info.json`。曹参が直した） | **写す** → `<buildRoot>\measure\ws-info.json`。曹参が measure.ps1 の既定をここに合わせる（R2-3 の表） |
| `netlog\`（Electron のネットのログ 39 個） | 0.02 GB | `records/network-audits/*/destinations.json` に、ファイルの名前だけが残る（宛先は records に写してある） | 消す。秘密が載りうるので写さない（docs/07 の3節） |
| `run\`（`.p0-run-root` だけ）・`probe\openvsx`・`logs\ext-allowed-*`・`scratch` | 0 | records は指していない | 消す |

- **records に写す作業**は、蒙恬の書き込み先（`records/` は無い）の外にある。写す台本（R2-4）にも入れていない。台本を通して許可の外に書くことになるため。リーダーか大岡越前守（`records/` に書ける）が `C:\b\p0\...` から写すか、蒙恬の書き込み先に `records/phase0/evidence/` を足すかを、リーダーが決める。
- records の文の中の `C:\b\p0\...` は過去の記録として残す案にした。書き換えるかどうかはリーダーが決める。
- 消す量: `C:\b\p0` の 11.37 GB。写すのは `official` 1.43 GB と小さなファイルだけ。

## R2-3. 秘密が載りうる場所（ネットのログと監査の作業場所）

### フックの作り（`team/hooks/allowlist.js` を読んで確かめた）

1. **secret_paths に `*` は書けない**。
   - `compileSecrets`（1061〜1098行）は、各行を `normalizePath` に通す。`normalizePath` は `*` を「Windows のパスに使えない文字」として誤りにする（947行）。
   - 誤りがあると `{ error }` を返し、`checkSecretText`・`checkSecretPath` がすべての呼び出しを止める（1112・1130行）。
   - そのため、1回目の 4.4 に書いた `tmp/b/take-in/*/netaudit-run/` の形は使えない。
2. **リポジトリの中の場所を secret_paths に入れると、Glob と Grep がリポジトリの直下から使えなくなる**。
   - Glob・Grep は、path を省くと cwd（リポジトリの直下）を探す（1289〜1294行）。
   - `checkSecretPath(..., search=true)` は、探す範囲が秘密の場所の**祖先**であっても止める（1134行の `search && under(s.segs, t.segs)`）。
   - 今の秘密の場所は `%LOCALAPPDATA%` の下で、リポジトリの祖先にも子孫にもならないので、このことは起きていない。
3. secret_paths の文字（相対のときは行の全体）を含む Bash のコマンドも止まる（`checkSecretText`、1089〜1094行）。
4. 消す対象が secret_paths の場所か、その祖先なら止まる（ファイル先頭の説明の46行）。`rm -rf tmp/b/...` で片づけるときにも当たる。

### ネットのログの置き場所の案（曹参の netaudit.ps1 と合わせる）

- netaudit.ps1 は、ネットのログを `<WorkRoot の親>\netlog` に書く（928行）。
- 今の既定の WorkRoot は `measure.ps1` の `Get-DefaultWorkRoot` = `<buildRoot>\p0\run` なので、ログは `<buildRoot>\p0\netlog` に出る。
- 取り込みは、1回目の形では `-WorkRoot <buildRoot>\take-in\<label>\netaudit-run` を渡していた。ログは `<buildRoot>\take-in\<label>\netlog` に出ていた。
- **パスの長さも超える**: 取り込みの監査の実行のフォルダは `<WorkRoot>\take-in-<label>-netaudit\user\user-data\Code Cache\electron-preload\<135 文字>`。前の WorkRoot だと、1.147.0-1 で **282 文字**になる（45＋`\take-in` 8＋`\1.147.0-1` 10＋`\netaudit-run` 13＋`\take-in-1.147.0-1-netaudit` 27＋`\user\user-data\Code Cache\electron-preload\` 44＋ファイル名 135）。

案（取り込み側の1つは直した）:

| 何 | 前 | 案 | 担当 |
|---|---|---|---|
| 取り込みの監査の WorkRoot | `<buildRoot>\take-in\<label>\netaudit-run` | `<buildRoot>\audit`（**直した**。`take-in.mjs` の `netauditWorkRoot`）。Code Cache のファイルまでの長さは 1.147.0-1 で 257 文字。`1.150.10-12` のような11文字のラベルで、ちょうど上限の 259 文字（これより長いラベルは超える） | 蒙恬（済み） |
| 計測・監査の既定の WorkRoot | `<buildRoot>\p0\run` | `<buildRoot>\audit`（取り込みと同じ）。`measure.ps1` の `Get-DefaultWorkRoot` | 曹参 |
| ネットのログ | `<buildRoot>\p0\netlog`、取り込みは `<buildRoot>\take-in\<label>\netlog` | `<buildRoot>\netlog`（WorkRoot が `<buildRoot>\audit` になれば、決まりから自動でそうなる。台本の直しは要らない） | 上の2つで決まる |
| ws-info.json | `<buildRoot>\p0\ws-info.json` | `<buildRoot>\measure\ws-info.json`（写す台本の写し先。`<buildRoot>\audit\` には置かない。監査の作業場所の片づけと混ぜないため） | 曹参（measure.ps1 の既定） |

- WorkRoot を2つの台本で共有しても、片づけ（D-1）は自分が名付けた実行のフォルダ（`<label>-run-<n>`・`<label>-netaudit`）しか消さない。初めて使う空の根には `.p0-run-root` の印が付く（measure.ps1 の465・528行の決まり）。
- 印の名前 `.p0-run-root` は p0 のまま。名前を変えるかどうかは曹参が決める。

### secret_paths の行（頼まれた形と、その影響）

足すなら、場所が上の案に決まった後の形は次の2行になる。4人（蒙恬・曹参・大岡越前守・狄仁傑）の `secret_paths` に足す。

```
"tmp/b/netlog/",
"tmp/b/audit/"
```

ただし、上のフックの作り（2）により、**この2行を足すと、4人全員がリポジトリの直下（path を省いたとき）で Glob・Grep を使えなくなる**。狄仁傑の判定も、材料を Grep・Glob で探すと止まる。この形は勧めない。代わりの案:

1. **（勧める）Team の開発部に、フックへ「読むことだけを止める」欄を足してもらう**。例: `read_paths_deny`。
   - Read と、path がその場所の下の Glob・Grep を止める。祖先から探すときは止めない。Bash の文字も止めない。
   - そのうえで、4人に `tmp/b/netlog/`・`tmp/b/audit/` を入れる。
   - Grep（ripgrep）は既定で `.gitignore` を見るので、直下から探しても `tmp/` に入らない。Glob は `.gitignore` を見ないので、ファイルの名前は出る（中身は Read で止まる）。
   - フックの変更なので、ユーザーの承認と Team の開発部の作業が要る。
2. **ネットのログを長く残さない**（曹参の netaudit.ps1）。
   - 宛先を読み取って records に書いた後、ログをすぐ消す。実行のフォルダも `-KeepData` が無ければ消す（今の既定）。
   - そうすれば、秘密が載りうるファイルが残るのは監査の間だけになる。1と合わせてもよい。
   - 台本で消すことになるので、曹参の削除の決まりと合うかをリーダーが確かめる。
3. ネットのログだけをリポジトリの外に置く（例: `E:\shuko-audit\netlog`。`-NetLogDir` で渡す）。
   - secret_paths に足しても Glob・Grep は止まらない。
   - ただし「プロジェクトの tmp の下」の裁定から外れるので、ユーザーに諮ることになる。

## R2-4. 移す手順の確定（`tmp\b` を前提に）

### 写し方: 写すだけの台本にした

`scripts/move-build-root.mjs`（新規）。`cp -a` ではなく台本にした理由:

- `node scripts/*.mjs` の許可で走る。`cp -a` の bash_exact を十数行足さなくてよい。
- フックがコマンドの `*` を止めるので、`baseline-*.json` のような写し方は `cp` ではできない。
- 写した後に、数・大きさ・SHA-256・git の refs を照らす手順を、台本の中に固められる。

決まり:

- **消さない**。元（`--from`）には書かない。写し先にあるファイルを上書きしない（`COPYFILE_EXCL`）。
- 写し先が既にあれば、元と同じなら `already`、違えば問題にする。
- リンク・ジャンクションがあれば、写さずに止める。写し先のパスが 259 文字（フォルダは 247 文字）を超えるものがあれば、その項目を写さない。
- clone は、付いている作業ツリーが main だけのときにしか写さない。写した後に、`git for-each-ref` の全部（commit と ref の名前）が元と同じこと、写し先の作業ツリーが main だけであることを確かめる。

写すもの（台本の `PLAN`）:

| name | 元（`C:\b\` の下） | 写し先（`<buildRoot>\` の下） | 種類 |
|---|---|---|---|
| clone | `vscode` | `vscode` | git |
| dist-p2-all・dist-p1-a1-r3 | `dist\1.146.0-p2-all.zip`・`dist\1.146.0-p1-a1-r3.zip` | `dist\` | file（SHA-256） |
| p2-all | `p2\1.146.0-p2-all` | 同じ | dir |
| p1-a1-r3 | `p1\1.146.0-p1-a1-r3` | 同じ | dir |
| smoke-ext | `smoke\ext` | 同じ | dir |
| smoke-baselines | `smoke\baseline-*.json`（24個） | `smoke\` | files |
| smoke-runs・smoke-absent | `smoke\runs`・`smoke\absent` の各実行の**直下のファイルだけ**（`smoke-result.*`・`probe-result.json`・`snapshot.json`・`chromium.log` など。`user\`・`ws\`・`logs\` の下は写さない） | `smoke\archive\runs`・`smoke\archive\absent` | results |
| vsix-cache | `cache\vsix` | 同じ | dir |
| logs | `logs` | 同じ | dir |
| work-b | `work-b` | 同じ | dir |
| official-1.146.0 | `p0\vscode-1.146.0` | `official\vscode-1.146.0` | dir |
| official-zip・official-fetch-record | `p0\downloads\VSCode-win32-x64-1.146.0.zip`・`p0\p0-fetch.json` | `official\downloads\` | file（SHA-256） |
| ws-info | `p0\ws-info.json` | `measure\ws-info.json` | file |

- スモークの古い結果は `smoke\archive\` に置く。理由は2つある。曹参のスモークの台本は `smoke\runs` の直下を、名前の時刻で選んで片づける（`selectPrune`）。古い結果がその片づけに巻き込まれないようにするため。もう1つは、古い長い名前のフォルダを `runs` の決まり（22 文字以下）と混ぜないため。
- `removals/*/README.md` が根拠に挙げる `C:\b\smoke\absent\<名前>\snapshot.json` などは、`<buildRoot>\smoke\archive\absent\<名前>\` に入る。

### 手順（確定）

前提:

- 4節（1回目）の権限と、R2-5 の権限の変更が入っている。
- `C:\b` の下から起動したエディタ・ビルドが無い。

1. 前の記録: `node scripts/move-survey.mjs --from C:/b --out tasks/<日付>-move-off-c-run/survey-before.json`（今の許可で走る）。
2. 作業ツリーに作業中の変更が無いことを確かめる: `git -C C:/b/wt/<名前> status --porcelain` を12個（今の許可で走る）。変更があれば止めて、リーダーに知らせる。
3. たどれない9個の HEAD に枝を付ける（1回目の 3.2 の手順3の表）: `git -C C:/b/vscode branch keep/wt-<名前> <40桁>`。
4. 作業ツリーを外す: `git -C C:/b/vscode worktree remove --force C:/b/wt/<名前>` を12個。その後 `git -C C:/b/vscode worktree prune`。残り（gulp の出力と `*.prepare.json`）は `rm -rf C:/b/wt`。
5. 写す計画を見る: `node scripts/move-build-root.mjs --from C:/b --dry-run --out tasks/<dir>/move-plan.json`。全部の項目が `planned` になること（今は clone が「作業ツリーが付いている」で `problem`。手順4の後に `planned` になる）。
6. 写す: `node scripts/move-build-root.mjs --from C:/b --out tasks/<dir>/move-result.json`。全部の項目が `copied` で、終了コードが 0 であること。途中で止まったら、同じコマンドをもう一度走らせる。写し終えた項目は `already` になる。
7. records に根拠のファイルを写す（R2-2。リーダーか大岡越前守）。
8. 確かめる:
   - `node tests/run-all.mjs --save tasks/<dir>/run-all-after-move.json`（`tests/build/root.mjs` は `<buildRoot>\vscode` があればそちらを使う）
   - `git -C tmp/b/vscode rev-parse builds/1.146.0-p2-all keep/wt-p2`
9. 消す: `rm -rf C:/b`。その後、`node scripts/disk-usage.mjs --out tasks/<dir>/disk-after-move.json x=C:/b` で C: の空きを記録する。
10. ユーザーに頼む: `%USERPROFILE%\.shuko`・`%APPDATA%\Shuko` を消す。共用のキャッシュの扱いを決める（1回目の 3.1 の表の下の段）。
11. 一時の許可を外す。
12. 新しい場所で、段階 C をまとめた版を最初にビルドする（別の依頼）。

### 権限の一覧（確定。1回目の4節を改める）

**蒙恬**:

- ずっと使う形への置き換え: 1回目の 4.1 の上の表のとおり（`C:/b/...` を `tmp/b/...` に）。
- 一時の許可（手順11で外す）:
  - bash `git -C C:/b/vscode branch keep/wt-*`（手順3）
  - bash `git -C C:/b/vscode worktree remove --force C:/b/wt/*`（手順4）
  - delete_paths `C:/b/wt/`（手順4）
  - delete_paths `C:/b`（末尾の `/` なし。手順9。手順6の結果が全部 `copied` か `already` で、手順8が通ってから使う。そのときは `delete_keep` の `C:/b/...` の7行を外す）
- 1回目の表にあった `cp -a` の bash_exact と、`git -C tmp/b/vscode ...` の確かめの行は**要らない**（写す台本が走らせて確かめる）。
- 確かめてほしいこと（Team の開発部へ）: `rm -rf C:/b` は、中に `.git`（`C:\b\vscode\.git`）を含む。フックの自己防護（「どこであれ .git」）は、消す対象の中身まで見るのか。見るなら、手順9が止まる。

**曹参・大岡越前守**: 1回目の 4.2・4.3 のとおり（`C:/b/wt/*` を `tmp/b/wt/*` に。移した後に read_paths の `C:/b/` を外す）。

**secret_paths（4人）**: R2-3 の案1（読むことだけを止める欄の追加）を勧める。今の作りのまま足すなら `tmp/b/netlog/`・`tmp/b/audit/` の2行で、その場合はリポジトリの直下での Glob・Grep が止まる。

**組み込みの Explore**: フックの固定の読める場所に `C:/b/` が入っている（allowlist.js の49・84行）。移した後に外すかどうかを、Team の開発部に確かめる。

## R2-5. スモークの作業フォルダの名前（曹参の直しに合わせる）

- 曹参は `tests/smoke/lib/common.mjs` に `runDirName`・`shortLabel` を作った。runs は 22 文字以下、absent は 20 文字以下で、長いラベルは先頭と sha1 の3桁に縮める。
- 蒙恬の台本で、スモークの名前に関わる所は `scripts/lib/take-in/smoke-net.mjs` の `smokeRunArgs` だけ。ここは `--label take-in-<label>-<n>` を渡すだけで、置き場所の名前は作らない。名前はスモークの台本が縮めるので、**直さなかった**。
  - 例: `take-in-1.147.0-1-1` は `take-` と sha1 の3桁になる。
  - 縮めても、ラベルの全体は結果の中に残る。取り込みの記録は、実行のフォルダを `records/take-in/<label>/smoke/run-<n>/run-dir.txt` に書く。
- 写す台本は、古い名前の結果を `smoke\archive\` に置くので、新しい名前の決まりと混ざらない（R2-4）。
- 取り込みの通信の監査の実行のフォルダ（`take-in-<label>-netaudit`）は netaudit.ps1 が名付ける。WorkRoot を浅くしたので 257 文字になった。ラベルが11文字までなら 259 文字以下に収まる（R2-3）。曹参がこの名前にも縮める決まりを入れるかどうかは、曹参が決める。

## R2-6. 直した点と、テストの入口

**`scripts/take-in.mjs`**

- `netauditWorkRoot(ctx)` → `<buildRoot>\audit` を作った。計画（dry-run）と実行の両方で、`-WorkRoot` に渡す。
- 子の TEMP のフォルダは、子を最初に起こすときに作る形にした（1回目は `setChildTemp` の中で作っていた）。止まったときや dry-run では作らない。

**`scripts/move-build-root.mjs`（新規）**

- 入口:
  - `PLAN`（R2-4 の表）
  - `parseArgs(argv)`（`--from` は必須。`--to`・`--dry-run`・`--out`・`--only <name>,...`。知らない名前は ArgError）
  - `selectFiles(item, from, to)` → `{ srcRoot, dstRoot, exists, files: [{ rel, size, src, dst }], dirs, links, tooLong, bytes }`。読むだけ
  - `planItem(item, from, to)` → `{ name, kind, src, dst, files, bytes, gb, problems, destExists, sourceWorktrees? }`。読むだけ
  - `verifySame(item, sel)` → `{ ok, checked, problems }`
  - 定数 `FILE_LIMIT = 259`、`DIR_LIMIT = 247`
- 試しの形（曹参へ）:
  - 一時のフォルダに偽の元を作り、`--from <偽の元> --to <別の一時のフォルダ>` で走らせる。
  - `results` は、各実行の直下のファイルだけを写す（`user\` の下は写さない）。
  - 写し先にファイルがあれば上書きしない（元と同じなら `already`、違えば `problem` で終了コード 1）。
  - リンクがあれば `problem`。
  - 写し先のパスが 259 文字を超えれば `problem`。
  - `git` の種類は、作業ツリーが付いている clone を `problem` にする。
  - `--from` と `--to` が重なれば終了コード 2。
  - 元を何も変えないこと（写した後の元の数・大きさが同じ）。
- 静的な検査: `C:\b` も `%TEMP%` もコードの行に持たない。

**Phase 0 の道具12本**: 注記だけ（R2-1）。

**自分で確かめたこと**

- `node --check` を `scripts/take-in.mjs`・`scripts/move-build-root.mjs` に走らせ、通った。
- `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs tests/move-off-c.test.mjs`: 163件がすべて通った（曹参の新しいスモークの名前の検査、長さの検査を含む）。
- `node scripts/move-build-root.mjs --from C:/b --dry-run --out tasks/2026-11-15-move-off-c/move-plan-dry-run.json`:
  - 16項目のうち 15項目が `planned` になった。clone は「作業ツリーが13個付いている（main を含む）」で `problem` になった（前提どおり）。
  - 写す量は合わせて **9.44 GB**。長すぎるパスとリンクは、どの項目にも無かった。
  - 終了コードは 1（clone のため）。何も写していない。
- `node scripts/move-survey.mjs --from C:/b/p0 ...`: R2-2 の表の大きさ（`tasks/2026-11-15-move-off-c/survey-p0.json`）。

## R2-7. 未解決の点・知らせ

1. **中身の無いフォルダ `tmp\b` がある**（`node scripts/disk-usage.mjs` で、ファイル 0 を確かめた。`tmp\b\tmp`・`cache`・`wt`・`smoke` は無い）。蒙恬の走らせたコマンドの中に、これを作るものは見当たらない。テストの実行で作られた見込みが高い（どのテストかは確かめていない）。蒙恬には消す許可が無いので、残っている。
2. secret_paths の扱い（R2-3 の案1〜3）。リーダーが決める。案1はフックの変更になる。
3. records に根拠のファイルを写す役（R2-2）。リーダーか大岡越前守にするか、蒙恬の書き込み先に `records/phase0/evidence/` を足すか。
4. 曹参への頼み:
   - `tests/smoke/lib/common.mjs` の `DEFAULT_BUILD` を `<buildRoot>\official\vscode-1.146.0` にする。
   - `measure.ps1` の `Get-DefaultWorkRoot` を `<buildRoot>\audit` にする。
   - `ws-info.json` の既定を `<buildRoot>\measure\ws-info.json` にする。
   - `tests/removals/run-absent.mjs` の説明の `C:\b\p0\vscode-1.146.0`。
5. `records/phase2/manual-checks-p2-all.md` の手作業の監査は `-EnvDir C:/b/p0/data/upstream-default` を使う。この環境は消える。段階 C で同じ形の監査をするなら、手順書と環境の作り方（`install-extensions.mjs --portable`）を直す必要がある。
6. `rm -rf C:/b` が、フックの「.git」の自己防護に当たるか（R2-4 の権限）。
7. 組み込みの Explore の固定の読める場所 `C:/b/`（フックの中。Team の開発部）。
8. docs/ との食い違い（1回目の6節に足す分）:
   - docs/07 の1・2節の Phase 0 の置き場所（`C:\b\p0\...`）は、データを消すと実体が無くなる。
   - docs/07 の3節の netlog の既定（`C:\b\p0\netlog\`）は、案では `<buildRoot>\netlog`。
   - docs/06 の9節の取り込みの監査の作業場所は、`<buildRoot>\audit` になった。

## R2-8. 成果物（2回目）

- 新規:
  - `scripts/move-build-root.mjs`（写すだけの台本）
  - `tasks/2026-11-15-move-off-c/survey-p0.json`（`C:\b\p0` の中身）
  - `tasks/2026-11-15-move-off-c/move-plan-dry-run.json`（写す計画の dry-run）
- 直した: `scripts/take-in.mjs`（監査の作業場所、TEMP のフォルダを作る時）
- 注記だけ: `scripts/p0-check-ps.ps1`・`p0-env.ps1`・`p0-expand.ps1`・`p0-ext-allowed.ps1`・`p0-launch.ps1`・`p0-scratch.ps1`・`p0-stop.ps1`・`p0-ws.ps1`・`lib/p0-common.ps1`・`p0-fetch.mjs`・`p0-lsp-probe.mjs`・`p0-openvsx-meta.mjs`

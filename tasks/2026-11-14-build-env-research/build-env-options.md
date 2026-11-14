# ビルドの環境の案: Linux で Windows 版を作れるか、Windows コンテナの条件

- 作成: 蒙恬（2026-11-14）
- 調べ方: 本家のタグ 1.146.0 のソース（`C:\b\wt\1.146.0`）を読んだ。Web の出典の取得日はすべて **2026-11-14**。何も入れず、Docker の設定も変えず、コンテナも起動していない。
- 表記: 出典や読んだソースの場所がある事実には根拠を添えた。根拠がなく自分で見積もったものには **（推定）** と付けた。

## 0. 結論

| 問い | 答え |
|---|---|
| Linux（コンテナ）で 1.146.0 の Windows 版を作れるか | **作れない**（ソースからのビルドとしては）。ネイティブのモジュールのうち13個は `node-gyp rebuild` しか持たず（`allowBuilds` の一覧から数えた。製品に入るかは1つずつは確かめていない）、win32-x64 の配布済みの実行形式がない。node-gyp には対象の OS を変えるオプションがない。パッケージ化の手順も、ビルドした PC の `node_modules` を写し、`signtool.exe` を呼ぶ。「条件つき」の抜け道はあるが、Windows で作ったネイティブの部品を持ち込むうえに、本家のビルドの台本へ恒常的なパッチを当てる必要がある（1.5節）。 |
| Windows コンテナで作れるか | **作れる見込み**（推定。前例は見つからなかった）。条件は、Docker Desktop を Windows コンテナに切り替えること（その間は Linux コンテナが動かない）、Windows の機能（Containers と Hyper-V）を有効にすること、ライセンス上「テストか開発の用途」に限られること（2節）。 |
| 推奨 | **案 B（Windows コンテナ、Hyper-V 分離）**。ただし、ビルド中は Linux コンテナが止まる。それを避けたいなら **案 A（PC に直接入れる。いまの docs/02 の5節）**。決めるのはユーザー（4節）。 |

## 1. Linux で Windows 版を作れるか

### 1.1 本家の CI は Windows 版を Windows で作っている

- `build/azure-pipelines/product-build.yml` の206〜215行: Windows のプールは `1es-windows-2022-x64`（公開用は `-publishing`）。Linux は `1es-ubuntu-22.04-x64`。
- 同じファイルの374〜394行: ステージ `Windows`（`Windows X64`）を `os: windows` のプールで走らせる。
- `build/azure-pipelines/win32/product-build-win32.yml`: Compile のジョブ（`Windows_x64_Compile`）も Windows のプールで走る。Linux で作ったものを Windows が受け取る形ではない。
- `build/azure-pipelines/win32/steps/product-build-win32-compile.yml`:
  - 61行: `pnpm run gulp core-ci`
  - 108行: `pnpm run gulp "vscode-win32-$(VSCODE_ARCH)-min-ci"`
  - 105〜107行: その前に `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` を PATH に足す。コメントは「Add Windows SDK to PATH for patchWin32DependenciesTask signtool usage」。
- `build/azure-pipelines/win32/steps/product-build-win32-setup.yml` の94行: 依存の導入（`pnpm install --frozen-lockfile`）も Windows で行う。
- GitHub Actions の PR 用（`.github/workflows/pr-win32-test.yml` など）も `vscode-large-runners-windows-8-core` で走る。

### 1.2 VSCodium の CI も Windows 版を Windows で作っている

`https://raw.githubusercontent.com/VSCodium/vscodium/master/.github/workflows/publish-stable-windows.yml`（取得 2026-11-14）:

| ジョブ | `runs-on` | すること |
|---|---|---|
| check | `ubuntu-latest` | タグとリリースの有無を調べるだけ。成果物は作らない |
| compile | `windows-2022` | `./get_repo.sh` と `./build.sh` でコンパイルし、`vscode.tar.gz` を上げる |
| build | `windows-2022` | `vscode` を受け取り、`./build/windows/package.sh` でパッケージ化する（x64・arm64） |

`build/windows/package.sh` は `npm run gulp "vscode-win32-${VSCODE_ARCH}-min-packing"` を走らせる（取得 2026-11-14。VSCodium の master は npm を使っており、1.146.0 の pnpm にはまだ合わせていない）。

補足: VSCodium の最新リリースは `1.143.17232`（2026-10-28 公開。GitHub API `repos/VSCodium/vscodium/releases`、取得 2026-11-14）で、本家の 1.146.0 より3版遅れている。

### 1.3 ネイティブの依存（1.146.0）

1.146.0 のルートの `package.json` は `"nativeBuild": { "runtime": "electron", "target": "43.8.6", ..., "buildFromSource": true }`。`build/npm/pnpm/nativeBuildEnv.ts` の135・138行は、これを `npm_config_build_from_source=true` として渡す。つまり **配布済みの実行形式があっても使わず、ソースから作る設定**である。

install スクリプトの許可（`pnpm-workspace.yaml` の `allowBuilds`）に載っているネイティブのモジュールを、npm の registry（`https://registry.npmjs.org/<名前>/<版>`、取得 2026-11-14）で1つずつ確かめた。

| モジュール（版） | install の形 | win32-x64 の配布済みの実行形式 | 1.146.0 での扱い |
|---|---|---|---|
| node-pty（1.2.0-beta.18） | `node scripts/prebuild.js \|\| node-gyp rebuild` | **ある**（パッケージの中の `prebuilds/win32-x64/`、12.2 MB。`app.unpkg.com/node-pty@1.2.0-beta.18/files/prebuilds`） | `prebuild.js` は `npm_config_build_from_source === 'true'` なら `prebuilds` を消して node-gyp に回す。置き場所は `process.platform`-`process.arch` で選び、`npm_config_arch` は読まない（`unpkg.com/node-pty@1.2.0-beta.18/scripts/prebuild.js`） |
| @parcel/watcher（2.5.6） | `node scripts/build-from-source.js` | **ある**（別のパッケージ `@parcel/watcher-win32-x64`） | ルートと `extensions/` の `pnpm-workspace.yaml` が `ignoredOptionalDependencies: '@parcel/watcher-*'` で外し、ソースから作る |
| kerberos（2.1.1） | `prebuild-install --runtime napi \|\| node-gyp rebuild` | GitHub Releases から N-API 版を取る形（win32-x64 があるかは確かめていない） | build_from_source のときは取らない見込み（推定） |
| bufferutil（4.1.0） | `node-gyp-build`（prebuildify で同梱） | 同梱の形（win32 を含むかは確かめていない） | — |
| utf-8-validate（5.0.10） | 同上の形（registry では確かめていない） | 確かめていない | — |
| native-keymap（3.3.9） | `node-gyp rebuild` | **ない** | MSVC で作る |
| @vscode/spdlog（0.15.8） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/sqlite3（5.1.12-vscode） | `node-gyp rebuild`（`binary` 欄に node-pre-gyp の設定が残るが、install では使わない） | **ない** | 同上 |
| @vscode/policy-watcher（1.7.0） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/native-watchdog（1.4.6） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/deviceid（0.1.5） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/fs-copyfile（2.0.0） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/windows-mutex（0.5.3） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/windows-process-tree（0.8.0） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/windows-registry（1.3.0） | `node-gyp rebuild` | **ない** | 同上 |
| @vscode/windows-ca-certs（0.3.4） | `node-gyp rebuild`（`"os": ["win32"]`） | **ない** | 同上 |
| native-is-elevated（0.9.0） | `node-gyp rebuild` | **ない** | 同上 |
| windows-foreground-love（0.6.1） | `node-gyp rebuild` | **ない** | 同上 |
| foundry-local-sdk（2.2.1） | `node script/install-native.cjs`（中身は読んでいない） | 確かめていない | 本家の CI は場合により `FOUNDRY_LOCAL_SKIP_INSTALL=1` で飛ばす（setup.yml の100〜101行） |
| @azure/msal-node-runtime（0.20.1）など `extensions/` の分 | 確かめていない | 確かめていない | `extensions/pnpm-workspace.yaml` の `allowBuilds` |

ネイティブではなく、OS ごとのパッケージを gulp が `platform`・`arch` の引数で選ぶもの: `@vscode/ripgrep-universal`、`@vscode/os-proxy-resolver`、`@github/copilot-sdk-*`、`@anthropic-ai/claude-agent-sdk-*`、`@openai/codex-*`（`build/gulpfile.vscode.ts` の253〜262行の `ensureCopilotPlatformPackage`・`ensureOSProxyResolverPlatformPackage`・`getRipgrepExcludeFilter`）。これらは作る PC の OS によらない見込み（推定）。

この表の範囲外: `allowBuilds` に載っていても製品に入らない開発用のもの（playwright など）は除いた。各モジュールが製品の `node_modules` に入るかは1つずつは確かめていない。

### 1.4 node-gyp と gulp の Windows の手順

- **node-gyp に対象の OS を選ぶオプションはない。** README のオプションの一覧には `--arch`・`--target`・`--dist-url` などしかない。`--platform` もなく、Windows への cross-compile の記述もない（`https://github.com/nodejs/node-gyp/blob/main/README.md`、取得 2026-11-14）。
- **electron-builder の文書**: 「If your app has native dependencies, they can only be compiled on the target platform unless prebuild is used.」「You cannot build for Windows using Docker if your app has native dependencies that don't use prebuild.」（`https://www.electron.build/docs/features/multi-platform-build`、取得 2026-11-14）。VS Code は electron-builder を使わないが、Electron のネイティブのモジュールに共通の制約である。
- **パッケージ化は、作った PC の `node_modules` をそのまま写す。** `build/gulpfile.vscode.ts` の241〜252行は `getProductionDependencies(root)` の `node_modules` を `gulp.src` で集める。Linux で `pnpm install` すると、中の `.node` は Linux の ELF になる。さらに252行は `.moduleignore.${process.platform}` を使う。win32 を作るときでも、作る PC の OS の除外の一覧が当たる。
- **`patchWin32DependenciesTask`**（`build/gulpfile.vscode.ts` の513〜552行）: win32 のときは必ず走る（610〜612行）。各 `.node`・`rg.exe` などについて、まず `signtool.exe verify /pa` を `cp.spawn` で呼ぶ（483行）。spawn が失敗すると `proc.on('error', reject)` でタスクが落ちる。続けて `rcedit` で版の情報を書く。
  - Linux には `signtool.exe` がないので、このタスクで止まる。パッチで飛ばす必要がある。
  - `rcedit`（ルートの devDependencies の `^1.1.0`。ロックは `rcedit@1.1.0`）は、Windows 以外では `wine` で `rcedit.exe` を起動する（`unpkg.com/rcedit@1.1.2/lib/rcedit.js` の `if (process.platform !== 'win32') { args.unshift(rcedit); rcedit = 'wine' }`。README も「On platforms other than Windows, you will need to have Wine 1.6 or later installed」。`https://github.com/electron/node-rcedit`、取得 2026-11-14）。
- **`@vscode/gulp-electron`（1.43.1）**: Electron の Windows 版の zip は GitHub から取るので、取得そのものは OS によらない（`build/lib/electron.ts` の131〜141行）。ただし `src/win32.js` の `patchExecutable` は `process.platform !== "win32"` のとき何もしない。Linux で作ると、実行ファイルのアイコンと版の情報（rcedit で書くもの）が付かない。つまり `assets/` のアイコンが `Shuko.exe` に入らない（`unpkg.com/@vscode/gulp-electron@1.43.1/src/win32.js`、取得 2026-11-14）。

### 1.5 判定: 作れない（条件つきの抜け道はあるが勧めない）

ソースからのビルドとしては **作れない**。理由は次のとおり。

1. node-gyp でしか作れない win32 のモジュールが13個ある（1.3節）。node-gyp に OS を変えるオプションはない。
2. パッケージ化は作った PC の `node_modules` を写す。`signtool.exe` も必須である（1.4節）。

条件つきの抜け道と、その代償（どれも推定。試していない）:

| 抜け道 | 要るもの | 代償 |
|---|---|---|
| Windows で作った `.node` を持ち込む | 同じ版（Electron 43.8.6）の Windows のビルドの出力。VSCodium は 1.143 で止まっており 1.146.0 がない。本家の公式の zip の `.node` は Microsoft の製品のライセンスの配布物になる | 結局 Windows のビルドが要る。毎週の取り込みで版を合わせ続けられない。本家の台本への恒常的なパッチ（`.moduleignore`、`signtool`、rcedit）が要り、削除の単位とは別の保守が増える |
| Linux で MSVC を wine の上で動かす（msvc-wine など）か、clang-cl と xwin で cross-compile する | MSVC の取得（VS のライセンスへの同意）と、node-gyp の生成器の改造 | 本家・VSCodium・Electron の文書のどれも採っていない。毎週の取り込みに耐える見込みが薄い |
| wine で rcedit と signtool を代わりに動かす | wine | ネイティブのモジュールの問題は残る |

## 2. Windows コンテナの条件

### 2.1 Windows 11 Pro の上で Windows コンテナを使うライセンス

Windows コンテナの土台のイメージの追加のライセンス（`https://learn.microsoft.com/en-us/virtualization/windowscontainers/images-eula`、ms.date 2025-01-23、取得 2026-11-14）:

- 「The Container Image may only be used with a validly licensed copy of: ... Microsoft Windows Operating System (version 10) software ("Client Host Software")」。Windows 11 Pro は内部の版が 10.0 だが、文書は「version 10」とだけ書き、Windows 11 を名指ししていない。
- 「When running a Container Image on Client Host Software you may run any number of the Container Image instantiated as Windows containers **for test or development purposes only**. You may not use these Windows containers in a production environment on Client Host Software.」
- 「Use Rights. ... You may use the Container Image to create, build, and run your Consolidated Image on Host Software」

**判断が要る点**: 自分が使うエディタをコンテナでビルドする用途は「development」に当たると読める（推定）。ただし、できたものを自分で毎日使うので、ビルドの環境が「production environment」かどうかは文言からは決まらない。ビルドの成果（zip）はコンテナの外で使い、コンテナの中では動かさない。それでも解釈の余地は残るので、ユーザーが判断する。

### 2.2 Visual Studio Build Tools をコンテナに入れて使うライセンス

- ダウンロードのページの Build Tools for Visual Studio 2026 の欄: 「Use of this tool requires a valid Visual Studio license, unless you are building open-source dependencies for your project.」（`https://visualstudio.microsoft.com/downloads/`、取得 2026-11-14）
- 同じページの Community: 「free for students, open-source contributors, and individuals」
- Microsoft の C++ チームのブログ（2022-08-18）: 2022年のライセンスの改定で、OSI の承認するライセンスの第三者のオープンソースの依存を、Visual Studio のライセンスなしで Build Tools でビルドできるようになった。プロプライエタリな C++ の開発には Visual Studio のライセンスが要る（`https://devblogs.microsoft.com/cppblog/updates-to-visual-studio-build-tools-license-for-c-and-cpp-open-source-projects/`、取得 2026-11-14）。
- Build Tools 2026 のライセンスの全文: `visualstudio.microsoft.com/license-terms/vs2026-ga-diagnosticbuildtools/` は 404 だった。2022 版のページは本文を取れなかった。**全文の条文は確かめていない。**
- コンテナに入れる手順そのものは Microsoft が文書にしている（`https://learn.microsoft.com/en-us/visualstudio/install/build-tools-container`、ms.date 2025-02-05、取得 2026-11-14）。

**当てはめ**（推定。判断はユーザー）: Build Tools でビルドするのは、npm の第三者のネイティブのモジュールだけである（MIT など。`@vscode/*` は Microsoft のものだが MIT で公開されている）。手を入れる予定もない。「open-source dependencies for your project」に当たると読める。当たらない場合でも、ユーザーが Community の個人の条件を満たせば Community のライセンスで足りる。組織での利用には、エンタープライズ（PC 250台以上か、年の売上 100万ドル超。第三者の解説。`https://samexpert.com/visual-studio-2026-licensing-update/`）なら Community を使えない、という制限がある。ここは確かめていない。

### 2.3 Docker Desktop の Windows コンテナの要件

`https://docs.docker.com/desktop/setup/install/windows-install/`・`https://docs.docker.com/desktop/setup/install/windows-permission-requirements/`・`https://docs.docker.com/reference/cli/dockerd/`（取得 2026-11-14）:

| 項目 | 事実 |
|---|---|
| Windows の版 | 「To run [Windows containers], you need Windows 10 or Windows 11 Professional or Enterprise edition.」（Pro なので満たす） |
| Windows の機能 | Hyper-V のバックエンドには「Turn on Hyper-V and Containers Windows features」。有効にするには管理者の権限と再起動が要る見込み（推定） |
| 入れ方 | Windows コンテナは「only supported in all-users installation mode」。ユーザーごとの入れ方では使えない。**この PC がどちらで入っているかは確かめていない**（読める場所の外） |
| 切り替え | メニューの「Switch to Windows containers」「Switch to Linux containers」。プロキシとデーモンの設定はモードごとに別に持つ |
| 切り替えの権限 | 切り替えると UAC の確認が出て、特権のサービス `com.docker.service`（SYSTEM で動く）を起動する。以後は Windows の起動時に自動で起動する |
| セキュリティ | 「Windows containers ... run directly on the Windows host」「members of the `docker-users` group are able to elevate to administrators on the host」 |
| 分離の既定 | 「on Windows client, the default is `hyperv`」（dockerd の文書） |
| 同時に使えるか | **使えない**（二次情報）。切り替えると、今のモードで動いているコンテナは止まる。もう一方のモードのコンテナは消えないが、切り替えている間は動かない（`https://oneuptime.com/blog/post/2026-02-08-how-to-switch-between-linux-and-windows-containers-on-docker-desktop/markdown`、2026-02-08。Docker の公式の文言は見つからなかった）。2018〜2019年の「同時に動く」記事は、実験的な機能 LCOW のもので、今は当てはまらない見込み |
| 有料の条件 | Docker Desktop は、個人の利用と小さな事業（従業員250人未満かつ年の売上1000万ドル未満）では無料。それを超える商用の利用には有料の契約が要る（windows-install のページ） |

土台のイメージと分離の方式（`https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility`、ms.date 2025-01-23、取得 2026-11-14）:

- Windows 11 の上では、Windows Server 2025 のイメージは Hyper-V 分離・プロセス分離の両方に対応する。ただし「Supported from Windows 11 24H2 ... onwards」。Server 2022 のイメージも両方に対応する。
- **この PC は 10.0.26300**。Windows Insider の Dev Channel の版（25H2 を土台にした 26300 系。`https://blogs.windows.com/windows-insider/2026/01/27/announcing-windows-11-insider-preview-build-26300-7674-dev-channel/`）である。表は Insider の版を明記していない。プロセス分離が通るかは確かめていない。Hyper-V 分離なら、ホストの版によらず動く（同じ文書「running with Hyper-V isolation provides the container with a set of matching Kernel binaries and does not depend on the version of the host」）。
- Build Tools の文書の VS 2026 の例は `mcr.microsoft.com/dotnet/framework/runtime:4.8.1-windowsservercore-ltsc2025` を土台にする。素の `servercore` を土台にすると .NET Framework が正しく入らないことがあると警告している。MSBuild（node-gyp が Windows で使う）は .NET Framework で動くので、この土台を使うのがよい（推定）。
- 同じ文書の既知の問題: `docker build -m 2GB` を付ける（既定の 1 GB では足りない）。ディスクを既定の 20 GB より大きくする。`--norestart` を付ける。
- Windows コンテナには画面がない（「Windows containers don't support an interactive user interface」、Build Tools の文書）。**スモーク（Electron を起動する動作の確認）はコンテナの中では走らない**（推定）。ビルドだけをコンテナで行い、スモークと切り替えは PC の上で行う形になる。

### 2.4 大きさと時間の見込み（すべて推定）

| もの | 見込み | 根拠 |
|---|---|---|
| 土台のイメージ（Server Core ltsc2025） | 圧縮で約 2〜2.5 GB。展開すると数 GB | Microsoft の Tech Community の「Server Core is around 2GB compressed」。ltsc2025 を土台にした openjdk のイメージが圧縮 2.52 GB（Docker Hub）。.NET Framework の土台はこれより大きい |
| Build Tools（VCTools、Windows 11 SDK 26100、Spectre のライブラリ、ATL・MFC の Spectre） | 8〜15 GB | 公式の値は見つからなかった。Spectre と ATL・MFC は大きい |
| Node.js・Python・Git・pnpm | 1 GB 前後 | — |
| イメージの合計 | 15〜25 GB | 上の合計 |
| 作業ツリーと依存（clone 1.64 GB＋worktree 0.34 GB は実測。`build-log.md`） | 合計で 10〜20 GB | node_modules とキャッシュ、出力 |
| 初回の用意（イメージの取得と Build Tools の導入） | 40〜90 分 | 回線しだい |
| 1回のビルド（install・型検査・パッケージ化） | 1〜3 時間 | 本家の Windows の Compile のジョブの上限が 90 分（`product-build-win32.yml` の38行。サーバーの分も含む）。ホストの CPU の数しだい |
| コンテナのメモリ | 12〜16 GB 以上を `-m` で割り当てる | gulp を `--max-old-space-size=8192` で走らせる（`package.json` の `gulp`）。Hyper-V 分離の既定（1 GB）では足りない |

C: の空きは 132.8 GB（2026-11-13 の記録）。Windows コンテナのイメージの既定の置き場所は C: の下になる見込み（推定）。

## 3. ほかの案

| 案 | 事実 | 裁定との照合 |
|---|---|---|
| GitHub Actions の Windows の実行環境 | 標準の Windows x64 は、公開のリポジトリで 4 vCPU・16 GB・SSD 14 GB、非公開で 2 vCPU・8 GB・14 GB。ラベルは `windows-2025`・`windows-2022`、公開だけ `windows-2025-vs2026`（`https://docs.github.com/en/actions/reference/runners/github-hosted-runners`）。公開のリポジトリなら標準の実行環境は無料。非公開の Free のプランは月 12 ドル分が含まれ、Windows の 2 コアは 1分 0.010 ドル（`https://docs.github.com/en/billing/concepts/product-billing/github-actions`、どちらも取得 2026-11-14）。本家も PR 用に Windows の 8 コアの大きい実行環境を使う | ビルドに秘密は要らない（Notion のトークンは実行時だけ使う）。ただしこのリポジトリ（`github.com/polites-co-jp/AiEditor`）は非公開と見られ、非公開の標準の 2 vCPU・8 GB では、8 GB のヒープを使う gulp が足りない見込み（推定）。公開にするか大きい実行環境（有料）が要る。zip を GitHub の成果物から取って入れることになる |
| Hyper-V の仮想マシンに Windows を入れる | Windows 11 の使用許諾は「one instance of the software ... whether that device is physical or virtual」。別の仮想の機器に入れるには、それぞれ別のライセンスが要る（`https://microsoft.com/en-us/UseTerms/OEM/Windows/11/UseTerms_OEM_Windows_11_English.htm`、OEM 版の条文。小売版は確かめていない） | ライセンスを1つ買い足すことになる。画面があるので、スモークも中で走らせられる（推定） |
| 混ぜる形（Linux コンテナで型検査と JS のコンパイル、Windows でネイティブとパッケージ化） | 本家 1.146.0 の CI はこの形を取らず、Windows で compile から行う（1.1節） | Windows の側に MSVC が要ることは変わらない。2つの環境の受け渡しの台本が増える |

## 4. 案ごとの得失（推奨つき。決めるのはユーザー）

| 案 | 作れるか | 得 | 失 | 推奨 |
|---|---|---|---|---|
| A. PC に直接入れる（docs/02 の5節のまま） | 作れる（本家の手順のとおり） | 前例がいちばん多い。スモークまで同じ場所で走る。いまの台本と許可がそのまま使える | PC に VS Build Tools などが入る（ユーザーの指示「コンテナで」に合わない） | 次点 |
| **B. Windows コンテナ（Hyper-V 分離。土台は `dotnet/framework/runtime:4.8.1-windowsservercore-ltsc2025`）** | 作れる見込み（推定。前例は見つからなかった） | 道具一式をイメージに閉じ込められ、PC を汚さない。版を Dockerfile に固定できる | ビルドの間は Docker Desktop を Windows コンテナに切り替えるので、**Linux コンテナが止まる**。Containers と Hyper-V の機能の有効化、すべてのユーザー向けの入れ方、UAC が要る。ライセンスは「test or development」に限られる。スモークは PC の上で行う。イメージ 15〜25 GB（推定）。台本が `docker` を呼ぶので、蒙恬の許可の追加が要る | **推奨**（ユーザーの指示に合う。Linux では作れないため） |
| C. Linux コンテナ | 作れない（1.5節） | — | — | 採らない |
| D. GitHub Actions の Windows | 作れる（VSCodium と同じ形） | PC に何も入らない。Docker のモードの切り替えも要らない | 非公開のリポジトリの標準の実行環境では資源が足りない見込み。公開にするか有料にする。ビルドの成果を外から取り込む | 代案（公開してよいなら有力） |
| E. Hyper-V の仮想マシン | 作れる | 画面があり、スモークまで中で走る。Linux コンテナと同時に使える（推定） | Windows のライセンスを1つ買い足す。用意に時間がかかる | 代案 |

B を採るときに、ユーザーに確かめたい点:

1. ビルドの間（1〜3時間の見込み）、Linux コンテナ（ほかのプロジェクトのもの）が止まってよいか。
2. Windows の機能（Containers・Hyper-V）を有効にし、再起動してよいか。Docker Desktop が「すべてのユーザー向け」で入っているか。
3. コンテナの土台のライセンスの「test or development purposes only」を、この用途に当てはめてよいか（2.1節）。

## 5. docs/ との食い違いと、気づいた点

1. **`signtool.exe` が PATH に要る（docs/02 の5節に無い）。** 1.146.0 の `patchWin32DependenciesTask` は `signtool.exe` を PATH から呼ぶ（`build/gulpfile.vscode.ts` の483・497行）。無いとタスクが落ちる。本家の CI は Windows SDK の `bin\10.0.26100.0\x64` を PATH に足している。PC に直接入れる場合もコンテナの場合も、`build.mjs` が PATH に足すか、`check-env.ps1` で確かめる必要がある。winget の手順の `Windows11SDK.26100` で signtool が入るかは確かめていない（推定では入る）。
2. **`nativeBuild.buildFromSource: true`。** 配布済みの実行形式（node-pty の同梱分など）は使わず、すべてソースから作る。docs/02 の5節は MSVC が要るとだけ書いており、食い違いではない。ただし「配布済みの実行形式で MSVC を省ける」という案は、本家の設定を変えない限り成り立たない。
3. `@vscode/gulp-electron` の Windows の処理（`getSignTool`）は `C:\Program Files (x86)\Windows Kits\10\bin\` を固定の場所として探す（`src/win32.js`）。1.146.0 のビルドがこの経路を通るかは確かめていない。

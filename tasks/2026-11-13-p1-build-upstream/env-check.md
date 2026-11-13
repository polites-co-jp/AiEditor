# Phase 1: ビルドの環境の確かめ（本家 1.146.0）

- 作成: 蒙恬（2026-11-13）
- 確かめ方: `scripts/check-env.ps1`（新規。読むだけで、何も入れず何も変えない）を走らせた。出力は同じフォルダの `env-check.json`
- 求める版: 本家 1.146.0 のタグから読んだ（GitHub の raw。2026-11-13 取得）

## 1. 結果

**足りないものが4つある。** そのため、clone とビルドには進まず止めた（brief の 1）。

| 要るもの | 求める版・条件 | この PC | 判定 |
|---|---|---|---|
| Git | — | 2.54.0.windows.1（`E:\ProgramFiles\Git`） | 足りている |
| Node.js | タグの `.nvmrc` は **24.22.1**。x64 | **24.16.0** x64（`C:\Program Files\nodejs`） | **足りない** |
| pnpm | タグの `packageManager` は **`pnpm@12.16.0`** | **11.8.0**（`%APPDATA%\npm`。npm の global で入れたもの） | **足りない** |
| Python | node-gyp 用。`python` がコマンドラインで動くこと | 3.14.7（`C:\Python314`） | 足りている |
| setuptools | Python に入っていること | **入っていない**（`ModuleNotFoundError`） | **足りない** |
| Visual Studio Build Tools | 2026（18）・2022・2019 のどれか。wiki が挙げるコンポーネント | **無い**（vswhere も無い。`Microsoft Visual Studio\18` などのフォルダも無い。Windows Kits 10 も無い） | **足りない** |
| tar.exe（zip を作る） | Windows 標準の bsdtar | `C:\Windows\System32\tar.exe` は bsdtar 3.8.9。ただし PATH の先頭は Git の GNU tar 1.35 | 足りている（呼び方に注意。下の3節） |
| ディスク | 公式の目安は無い | C: の空き 137.1 GB | 足りる見込み（実測は Phase 1 で取る） |

どの条件で判定したか（タグのソースで確かめた）:

- Node.js: `build/npm/preinstall.ts` が `.nvmrc` を読み、**メジャーが同じで、マイナーとパッチが `.nvmrc` 以上**でなければ止まる。24.16.0 は 24.22.1 より古いので止まる。
- pnpm: `build/lib/pnpm.ts` の `checkPackageManager` が `npm_config_user_agent` を見て、pnpm でなければ「This repository uses pnpm. Run `pnpm install`.」で止まる。pnpm でも、**メジャーが 12 で 12.16.0 以上**でなければ止まる（13 以上も止まる）。npm では入れられない。
- Visual Studio: `preinstall.ts` の `hasSupportedVisualStudioVersion()` は、環境変数 `vs2026_install`・`vs2022_install`・`vs2019_install` か、`Program Files`（と `Program Files (x86)`）の `Microsoft Visual Studio\<18|2022|2019>\<Enterprise|Professional|Community|Preview|BuildTools|IntPreview>` のフォルダがあるかだけを見る。コンポーネントの中身は見ない。中身が足りないと、ネイティブのモジュールのビルド（node-gyp）で落ちる。
- Python と setuptools: `preinstall.ts` は確かめない。wiki が「`python` がエラーなしで動くこと、`setuptools` を入れること」と書く。

## 2. ユーザーが入れる手順

**PowerShell の普通の窓（管理者でなくてよい）で、上から順に実行する。** UAC の確認が出るものは「はい」で進める。全部が終わったら、新しい窓を開いてから最後の確かめを走らせる（PATH を読み直すため）。

### 2.1 Visual Studio 2026 Build Tools（いちばん時間がかかるので最初に）

本家の wiki のコマンドのまま。

```powershell
winget install --id Microsoft.VisualStudio.BuildTools -e --source winget --override "--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre"
```

- 管理者の権限: 要る（UAC の確認が出る）。
- 入るもの: winget の `Microsoft.VisualStudio.BuildTools` は 18.x（= Visual Studio 2026。winget-pkgs の版のフォルダは 18.0.0〜18.11.3。2026-11-13 に確かめた）。
- `--override` を付けると winget は静かに入れる引数を足さないので、Visual Studio Installer の画面が出る。画面で「インストール」を押し、終わるまで待つ。
- 所要時間とディスクの見込み（推定。公式の値は見つからなかった）: 回線しだいで 20〜60 分、数 GB〜10 GB 程度。
- wiki の注意「Do not pick the option to install Windows Build Tools」は、Node.js のインストーラーの「必要な道具を自動で入れる」の選択肢のこと。下の 2.2 の winget では選ばれない。

### 2.2 Node.js 24.22.1

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1
```

- 「既にインストールされている」と言われたら、同じ引数で `winget upgrade --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1` を実行する。
- 管理者の権限: 要る（`C:\Program Files\nodejs` に入る MSI。UAC の確認が出る）。
- 所要時間: 数分（推定）。
- **注意**: `--version` を付けずに `winget upgrade` や `winget upgrade --all` をしない。winget の `OpenJS.NodeJS.LTS` には 26.13.x があり（2026-11-13 に確かめた）、26 系に上がると、本家の preinstall がメジャーの違いで止まる。
- 今の 24.16.0 は上書きされる。このリポジトリの道具（`package.json` の `engines` は `>=22.0.0`）はそのまま動く。

### 2.3 pnpm 12.16.0（2.2 の後に）

```powershell
npm install -g pnpm@12.16.0
```

- 管理者の権限: 要らない（npm の global の置き場所が `%APPDATA%\npm` で、今の pnpm 11.8.0 もそこにある）。
- 所要時間: 1 分程度（推定）。
- 今の pnpm 11.8.0 は 12.16.0 に置き換わる。pnpm 12 は Rust で書き直された版で、npm のパッケージ `pnpm@12.16.0` は `@pnpm/exe.win32-x64` などの実行ファイルを optionalDependencies に持ち、install のスクリプト（`node install.js`）で選ぶ（npm の registry で確かめた）。
- このリポジトリの道具の依存（`pnpm-lock.yaml`、`pnpm-workspace.yaml` の `allowBuilds`）への影響: pnpm 12 の公式のお知らせは「Existing lockfiles keep working」と書き、`allowBuilds` は pnpm の設定の一覧にある。ただし、pnpm 12 で `pnpm install` をしたときに lockfile に差分が出ないかは試していない（下の4節）。
- Defender が pnpm の実行ファイルを止めたら、その旨を知らせてほしい（pnpm の案内に、Defender が止めることがあると書いてある）。

### 2.4 setuptools

```powershell
python -m pip install --user setuptools
```

- 管理者の権限: 要らない（`--user` でユーザーの site-packages に入る）。
- 所要時間: 1 分以内（推定）。

### 2.5 最後の確かめ

新しい PowerShell の窓で、このリポジトリの直下から:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1
```

末尾の `"missing"` が空（`[]`）で、終了コードが 0 なら足りている。蒙恬がビルドを再開するときにも、同じものを走らせて確かめる。

## 3. 気づいた点（入れるものではない）

- **tar.exe の呼び方**: PATH の先頭にある `tar` は Git の GNU tar（zip を作れない）。zip は `C:\Windows\System32\tar.exe`（bsdtar 3.8.9）をフルパスで呼ぶ。zip が実際に作れるかはビルドの後に確かめる。
- **長いパス**: レジストリの `LongPathsEnabled` は 0、git の `core.longpaths` は未設定。作業ツリーは `C:\b\wt\1.146.0` と短いので、今は変えない。ビルドでパスの長さの誤りが出たときに考える。
- **`ELECTRON_RUN_AS_NODE=1`**: Claude Code から走らせる環境に入っている（Phase 0 と同じ）。ビルドしたものを起動するとき（スモーク、起動の確かめ）は、子のプロセスから外す。
- **Python 3.14**: 本家のネイティブのモジュールをビルドする node-gyp が 3.14 で動くかは、まだ確かめていない。`pnpm install` で落ちたら、誤りのログを見て判断する。

## 4. 確かめていないこと

- pnpm 12.16.0 でこのリポジトリの `pnpm-lock.yaml` を読んだとき差分が出るか（ovsx の検証を走らせ直すときに見る）。
- Visual Studio Build Tools の実際の所要時間とディスク。

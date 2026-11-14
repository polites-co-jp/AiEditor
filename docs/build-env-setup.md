# ビルドの道具の入れ方（この Windows に直接入れる）

本家 VS Code 1.146.0 をこの PC でビルドするために、道具を4つ入れる手順です。ビルドはこの Windows で行うと決めました（[user-decisions](user-decisions.md) の 2026-11-14「ビルドの環境」）。

- 対象: Windows 11 Pro、x64
- 所要時間: 1時間ほど（Build Tools が 20〜60 分。回線しだい）
- ディスク: 数 GB〜10 GB ほど（Build Tools の分。公式の値は見つかっていない）
- 管理者の権限: 手順1と2で要ります（UAC の確認が出ます）。3と4は要りません

## 入れるもの

| # | 道具 | 版 | 何に使うか |
|---|---|---|---|
| 1 | Visual Studio 2026 Build Tools（C++ の道具と Windows 11 SDK） | 18.x | ネイティブの部品を作る（MSVC）。パッケージ化で使う署名の道具 `signtool.exe` も、この中の Windows 11 SDK に入る |
| 2 | Node.js | 24.22.1 | 本家 1.146.0 の `.nvmrc` の版。メジャーが違うと本家の準備の台本が止まる |
| 3 | pnpm | 12.16.0 | 本家 1.146.0 の `package.json` の `packageManager` の版。npm では入れられない |
| 4 | Python の setuptools | 最新 | ネイティブの部品を作る node-gyp が使う |

## 手順

普通の PowerShell の窓（管理者でなくてよい）で、上から順に実行します。UAC の確認が出たら「はい」で進めます。

### 1. Visual Studio 2026 Build Tools（いちばん時間がかかるので最初に）

```powershell
winget install --id Microsoft.VisualStudio.BuildTools -e --source winget --override "--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre"
```

- 本家の wiki（https://github.com/microsoft/vscode/wiki/How-to-Contribute ）のコマンドのままです。
- Visual Studio Installer の画面が出ます。「インストール」を押し、終わるまで待ちます。
- ライセンス: Build Tools はオープンソースのプロジェクトのビルドに使う場合、追加のライセンスは要りません（VS Code もこのリポジトリも当てはまります）。

### 2. Node.js 24.22.1

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1
```

- 「既にインストールされている」と出たら、同じ引数で `upgrade` を実行します。

  ```powershell
  winget upgrade --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1
  ```

- **`--version` を外さないでください。** winget には 26 系もあり、26 系に上がると本家のビルドが止まります。`winget upgrade --all` も避けてください。
- いまの 24.16.0 は上書きされます。このリポジトリの道具（`engines` は `>=22.0.0`）はそのまま動きます。

### 3. pnpm 12.16.0（手順2の後に）

```powershell
npm install -g pnpm@12.16.0
```

- いまの pnpm 11.8.0 が 12.16.0 に置き換わります。
- Microsoft Defender が pnpm の実行ファイルを止めたら、知らせてください（pnpm の案内に、Defender が止めることがあると書かれています）。

### 4. setuptools

```powershell
python -m pip install --user setuptools
```

### 4.5. Smart App Control をオフにする

Windows セキュリティ → アプリとブラウザーの制御 → スマート アプリ コントロールの設定 →「オフ」。オンのままだと、自分でビルドした署名の無い部品（`.node`）の読み込みが止められ、止めたものを通す道はありません（裁定 2026-11-14）。後でオンに戻すときは、先に `winver` で 26300.9818 以上かを確かめてください。

### 5. 確かめる

**新しい PowerShell の窓を開いてから**（PATH を読み直すため）、リポジトリの直下で次を実行します。

```powershell
cd E:\develop\self\Team\projects\ai-editor
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1
```

- 終了コードが 0 で、出力の末尾の `"missing"` が空（`[]`）なら、全部そろっています。
- 確かめる項目: Git、Node.js 24.22.1、pnpm 12.16.0、Python と setuptools、Visual Studio の C++ の道具、`signtool.exe`、`tar.exe`、ディスクの空き。
- `missing` に残ったものがあれば、その行をそのまま知らせてください。

## 終わったら

このチャットで「入れた」と知らせてください。`check-env.ps1` の出力の末尾を貼っていただけると確実です。そこから次の順に進めます。

1. 本家 1.146.0 を無改造でビルドし、zip にして起動する（かかった時間とディスクの量を記録する）。
2. 段階 A・B の14単位を1つずつ有効にし、型検査・ビルド・動作の確認・通信の監査を通す。
3. 段階 C の7単位を、1単位ずつ仕上げる。

## うまくいかないとき

| 症状 | 対処 |
|---|---|
| 手順1で Installer の画面が出ない、途中で止まる | スタートメニューの「Visual Studio Installer」を開き、Build Tools 2026 の「変更」から、C++ によるデスクトップ開発と Windows 11 SDK（10.0.26100）に印を付けて入れる |
| 手順2で「適用できる更新が見つかりません」 | `node --version` が `v24.22.1` なら済んでいる |
| `node --version` が `v26.x` など 24.22.1 でない（`upgrade` では版を下げられない） | 一度消して版を指定して入れ直し、自動で上がらないよう止める。`winget uninstall --id OpenJS.NodeJS.LTS -e --source winget` → `winget install --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1` → `winget pin add --id OpenJS.NodeJS.LTS -e`。その後に手順3（pnpm）をやり直す。npm で入れた道具（Claude Code など）は消えない |
| 手順3で `EEXIST: file already exists ... AppData\Roaming\npm\pnpm` | 前に corepack が置いた pnpm の入口が残っている。`npm install -g pnpm@12.16.0 --force` で上書きする |
| `pnpm --version` が Node.js の版だけ出して止まる | 今の pnpm は Node.js 24 に付いていた corepack 経由で入っていて、Node.js 26 には corepack が無い。Node.js を 24.22.1 に戻してから手順3を実行する |
| 手順3で `pnpm --version` が 11.8.0 のまま | 新しい窓を開いて確かめる。それでも古ければ `where.exe pnpm` の出力を知らせてください |
| 手順5で `signtool` だけが missing | 手順1の Windows 11 SDK が入っていない。上の Installer の「変更」で入れる |

## 参考

- 調べの記録: `tasks/2026-11-13-p1-build-upstream/env-check.md`（版の出典）、`tasks/2026-11-14-build-env-research/build-env-options.md`（コンテナでなくこの Windows で作る理由）
- ビルドの環境の設計: [02](02-repository-and-build.md) の5節

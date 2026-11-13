# 引き継ぎ: Phase 1 の本家 1.146.0 の無改造のビルド

- 作成: 蒙恬（2026-11-13）
- 宛先: ヴラド・ツェペシュ

## 追記（2026-11-13 21:44）: clone と作業ツリー

リーダーの指示（ユーザーが環境を入れている間に clone を進める。依存の導入とビルドはまだ）で進めた。

- 結果: **完了**。`C:\b\vscode`（常設の clone）と `C:\b\wt\1.146.0`（作業ツリー）を作った。タグ 1.146.0 の commit と作業ツリーの HEAD は、どちらも `69047191fc427f2f92828279aae1d90d8eeda7ab` で、`upstream.json` と一致した。作業ツリーに変更は無い。
- 所要時間: clone 171.4 秒、fetch --tags 51.9 秒、worktree add 43.3 秒。合計 約 4 分 30 秒。
- ディスク: clone の `.git` 1.64 GB、clone の checkout（main）0.34 GB、作業ツリー 0.34 GB。C: の空きは 137.1 GB から 132.8 GB に減った。
- 新しく作ったもの:
  - `scripts/prepare.mjs`: clone（無ければ）→ fetch --tags → タグの commit の照合 → worktree add → HEAD と変更なしの確かめ → ディスクを数えて JSON に書く（docs/02 の4節の1）
  - `upstream.json`: `tag` 1.146.0、`commit`、`repository`
  - `tasks/2026-11-13-p1-build-upstream/prepare.json`: 台本の記録
- 許可の形で直接も確かめた: `git -C C:/b/wt/1.146.0 status` は、タグで切り離した HEAD で変更なし。`check-env.ps1 -WorkTree C:/b/wt/1.146.0` は作業ツリーから Node.js 24.22.1・pnpm 12.16.0 を読んだ（GitHub の raw の値と一致）。
- 気づいた点: 常設の clone は fetch だけに使うので、main の checkout（0.34 GB）は要らない。`--no-checkout` で作れば省ける（別案。指示と許可の形どおりに作ったので、今は変えない）。
- 次: ユーザーが4つを入れ終え、`check-env.ps1` の `missing` が空になったら、依存の導入（`pnpm --dir C:/b/wt/1.146.0 install`）から再開する。

### テストの入口（曹参へ。追記分）

- `node scripts/prepare.mjs [--tag <tag>] [--commit <sha>] [--build-root <dir>] [--out <json>] [--no-size]`
  - 既定の tag・commit は `upstream.json`。build root は `--build-root` → `%LOCALAPPDATA%\Shuko\local.json` の `buildRoot` → `C:\b` の順（`local.json` の `buildRoot` が文字列でなければ止まる）
  - 出力: 標準出力と `--out`（既定 `<build-root>/wt/<tag>.prepare.json`）に JSON。キー `steps[]`（`name`・`seconds`・`status`、失敗なら `stderr`）、`tagCommit`、`worktreeHead`、`worktreeClean`、`disk`、`result`（`ok` / `error`）、`message`
  - 終了コード: 一致して変更なしなら 0。タグが無い、タグの commit が違う、HEAD が違う、作業ツリーに変更がある、git が失敗した、のどれかで 1
  - clone や作業ツリーが既にあれば作り直さない（`steps` に `skipped: "already exists"`）
  - 書き出している関数: `resolveBuildRoot(cliValue)`、`dirSize(root, { skip })`（`{ bytes, gb, files }`。シンボリックリンクはたどらない）

## 結果（最初の報告）

**一部完了**（brief の 1 まで）。環境に足りないものが4つあり、brief どおり止めた。clone・ビルド・zip はまだ走らせていない。所要時間とディスクの実測は無い。

## 成果物

- `scripts/check-env.ps1`（新規）: ビルドの環境を読むだけで確かめる台本。JSON を出す。足りないものがあれば終了コード 2
- `tasks/2026-11-13-p1-build-upstream/env-check.md`: 確かめの結果と、ユーザーが入れる手順
- `tasks/2026-11-13-p1-build-upstream/env-check.json`: 台本の出力（2026-11-13 21:33）
- `tasks/2026-11-13-p1-build-upstream/build-log.md`: 再開したときの手順と、タグのソースで先に確かめたこと
- `tasks/2026-11-13-p1-build-upstream/doc-corrections.md`: docs/02 の4節・5節を直す案

## 要点

1. 足りないもの: Node.js（24.16.0 → **24.22.1** が要る）、pnpm（11.8.0 → **12.16.0** の 12 系が要る）、Python の **setuptools**、**Visual Studio 2026 Build Tools**（無い）。
2. 足りているもの: Git 2.54.0、Python 3.14.7、`C:\Windows\System32\tar.exe`（bsdtar 3.8.9）、C: の空き 137.1 GB。
3. 1.146.0 は pnpm だけで入る（`packageManager: pnpm@12.16.0`。preinstall が npm を止める）。型検査だけの script は `typecheck-client`（`tsc --noEmit --skipLibCheck`）が第一候補。
4. PATH の先頭の `tar` は Git の GNU tar で zip を作れない。zip は System32 の tar.exe をフルパスで呼ぶ。

## ユーザーにしてほしいこと

`env-check.md` の2節を順に実行する。

1. `winget install --id Microsoft.VisualStudio.BuildTools -e --source winget --override "--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre"`（管理者の権限が要る。Installer の画面が出る。見込み 20〜60 分）
2. `winget install --id OpenJS.NodeJS.LTS -e --source winget --version 24.22.1`（管理者の権限が要る。既に入っていると言われたら `winget upgrade` で同じ引数。`--version` なしで上げると 26 系になって止まる）
3. `npm install -g pnpm@12.16.0`（管理者の権限は要らない）
4. `python -m pip install --user setuptools`（管理者の権限は要らない）
5. 新しい窓で `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1` を走らせ、`"missing": []` を確かめる

## 確かめたこと

- `scripts/check-env.ps1` を3回走らせた（1回目は `node -p` の引数の渡し方の誤りで Node.js を見落とした。直して2回目、`-OutFile` を足して3回目）。`scripts/p0-check-ps.ps1` で構文と ASCII だけであることを確かめた（誤り 0、ASCII 以外 0 バイト）。
- `git --version`、`node --version`、`pwsh --version`（7.7.0）を直接走らせて、台本の値と一致することを確かめた。
- 外部の事実の出典（2026-11-13 取得）:
  - タグ 1.146.0 の `.nvmrc`（24.22.1）、`package.json`（`packageManager`、scripts）、`build/npm/preinstall.ts`、`build/lib/pnpm.ts`、`pnpm-workspace.yaml`: `https://raw.githubusercontent.com/microsoft/vscode/1.146.0/<パス>`
  - 本家の wiki: https://github.com/microsoft/vscode/wiki/How-to-Contribute （まだ npm と書く。pnpm に触れない）
  - Node.js 24.22.1 の配布: https://nodejs.org/dist/v24.22.1/ 。winget の版: https://github.com/microsoft/winget-pkgs/tree/master/manifests/o/OpenJS/NodeJS/LTS （24.22.1 と 26.13.x がある）
  - Build Tools の winget の版: https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Microsoft/VisualStudio/BuildTools （18.x）
  - pnpm 12.16.0: https://registry.npmjs.org/pnpm/12.16.0 、https://pnpm.io/blog/releases/12.0 、https://pnpm.io/installation 、https://pnpm.io/settings （`allowBuilds` がある）

## テストの入口（曹参へ）

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 [-WorkTree <dir>] [-NodeRequired <ver>] [-PnpmRequired <ver>] [-BuildRoot <dir>] [-OutFile <path>]`
  - 出力: 標準出力に JSON 1つ。キー `required`・`git`・`node`（`version`・`arch`・`satisfies`）・`pnpm`（`version`・`satisfies`）・`python`（`setuptools`）・`visualStudio`（`preinstallCheckPasses`・`instances[].components`）・`tar`（`system32`・`found`）・`disk`・`missing`（文字列の配列）
  - 終了コード: `missing` が空なら 0、空でなければ 2
  - 版の判定の規則（`Compare-SemVer`）: メジャーが同じで、求める版以上なら真。例 `24.22.1` に対して `v24.22.1`・`24.23.0` は真、`24.16.0`・`26.13.1` は偽。pnpm も同じで `12.16.0` に対して `12.16.1` は真、`11.8.0`・`13.0.0` は偽
  - `-WorkTree` を渡すと、そのフォルダの `.nvmrc` と `package.json` の `packageManager`（`pnpm@X.Y.Z`）で求める版を上書きする
  - 何も書き換えないこと（`-OutFile` の先を除く）

## docs/ との食い違い

`doc-corrections.md` のとおり。要点は、02 の4節の4・6（pnpm は「見込み」でなく事実。npm の書き方は使えない）、4節の5（型検査の候補は `typecheck-client`）、4節の8（tar.exe はフルパスで呼ぶ）、5節の表（Node.js の版を確かめた、winget で 26 系に上げない注意、pnpm 12.16.0、preinstall の Visual Studio の確かめ方）。

## 未解決の点

- **再開の条件**: ユーザーが入れ終えて `check-env.ps1` の `missing` が空になったら、蒙恬を再び起動してほしい（clone から始める）。
- **許可**: 再開したあと、型検査（`typecheck-client`）、commit の照合（`git -C C:/b/vscode rev-parse`）、ディスクの大きさ、zip（System32 の tar.exe）は、今の許可の形には無い。docs/02 の4節の設計どおり `scripts/build.mjs`（`node scripts/*.mjs` で許されている）の中から走らせるつもりでいる。直接走らせる形がよければ、`pnpm --dir C:/b/wt/* run typecheck-client` を許可に足すことをユーザーに諮ってほしい。
- **pnpm 12 とこのリポジトリの道具**: global の pnpm が 11.8.0 から 12.16.0 に変わる。このリポジトリの `pnpm-lock.yaml`（pnpm 11 で作った）で `pnpm install` したとき差分が出ないかは試していない。差分が出たら ovsx の固定の確かめをやり直す必要があるかもしれない。
- **Python 3.14 と node-gyp**: 動くかは `pnpm install` で分かる。
- ~~clone を先に進めるか~~: リーダーの指示で進めた（冒頭の追記）。
- **報告の受け渡し**: `SubagentHandback` は許可のフックに「定義の tools に無いツール」として止められ、届けられなかった。蒙恬の定義の `tools` に足すかを、設計を行ったチームの開発部に諮ってほしい（権限の変更なのでユーザーの承認が要る）。

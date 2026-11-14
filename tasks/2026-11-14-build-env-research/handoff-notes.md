# 引き継ぎ: ビルドの環境の調べ（build-env-research）

- 担当: 蒙恬（2026-11-14）
- 依頼書: `brief.md`
- 成果: `build-env-options.md`

## 結果

完了。

## 成果物

- `tasks/2026-11-14-build-env-research/build-env-options.md`（1〜3の結果、案ごとの得失の表、推奨）
- `tasks/2026-11-14-build-env-research/handoff-notes.md`（この文書）

## 要点

1. **Linux で 1.146.0 の Windows 版は作れない**（ソースからのビルドとしては）。本家の CI（`1es-windows-2022-x64`）も VSCodium（`windows-2022`）も、Windows で compile からパッケージ化まで行う。
   - 理由1: ネイティブのモジュールのうち13個は `node-gyp rebuild` しか持たない。node-gyp には対象の OS を変えるオプションがない。
   - 理由2: パッケージ化は、作った PC の `node_modules` を写す。さらに `signtool.exe` を呼ぶ。
2. **Windows コンテナなら作れる見込み**（推定。前例は見つからなかった）。条件は次のとおり。
   - Docker Desktop を Windows コンテナに切り替える。その間は Linux コンテナが止まる（二次情報）。
   - Windows の機能 Containers・Hyper-V を有効にする。Docker Desktop が「すべてのユーザー向け」で入っていること。
   - 土台のイメージは Windows 11 の上では「test or development purposes only」。
   - VS Build Tools は「open-source dependencies」のビルドならライセンスなしで使える。
3. この PC は Insider の Dev Channel（10.0.26300）。プロセス分離が通るかは表に無い。Hyper-V 分離なら動く。
4. スモーク（Electron の起動）はコンテナの中では走らない見込み。ビルドだけをコンテナで行い、確かめは PC の上で行う。
5. 推奨は B（Windows コンテナ、Hyper-V 分離）。Linux コンテナが止まるのを避けたいなら A（PC に直接入れる）。公開してよいなら D（GitHub Actions）も有力。

## 確かめたこと

- 本家 1.146.0 の作業ツリー（`C:\b\wt\1.146.0`）を読んだ: `build/azure-pipelines/product-build.yml`、`win32/product-build-win32.yml`、`win32/steps/product-build-win32-compile.yml`・`-setup.yml`、`win32/product-build-win32-node-modules.yml`、`build/gulpfile.vscode.ts`（241〜252、483〜552、584〜649行）、`build/npm/preinstall.ts`、`build/lib/electron.ts`、`package.json`、`pnpm-workspace.yaml`（ルート・`extensions/`・`build/`・`extensions/copilot/`）、`pnpm-lock.yaml`（rcedit・gulp-electron の版）、`.moduleignore.win32`・`.moduleignore.linux`、`.github/workflows` の `runs-on`。
- Web（取得はすべて 2026-11-14）:
  - VSCodium の workflow と `package.sh`、VSCodium のリリース（最新は 1.143.17232）
  - npm の registry で、ネイティブのモジュール17個の install の形
  - node-pty の `prebuild.js` と `prebuilds/` の一覧
  - rcedit のソースと README、`@vscode/gulp-electron@1.43.1` の `src/win32.js`
  - node-gyp の README、electron-builder の文書
  - Microsoft Learn（Windows コンテナの要件・版の互換性・土台のイメージの追加のライセンス・資源の制御・Build Tools のコンテナ）
  - VS のダウンロードのページ、C++ チームのブログ
  - Docker の文書（入れ方・権限・dockerd）
  - GitHub Actions の文書（実行環境・課金）、Windows Insider の blog
- 何も入れていない。Docker の設定は変えていない。コンテナも起動していない。書き込みは `tasks/2026-11-14-build-env-research/` だけ。

## テストの入口

コードを作っていないので、曹参が試すものは無い。

B を採ったときに試す点（作るのは次の仕事）:

- イメージの中で `scripts/check-env.ps1` の `missing` が空になること。
- `signtool.exe` が PATH で見つかること。
- `pnpm run gulp vscode-win32-x64-min` の出力をホストへ写し、PC の上でスモークが通ること。

## docs/ との食い違い

1. **docs/02 の5節に `signtool.exe` が無い。** 1.146.0 の `patchWin32DependenciesTask`（`build/gulpfile.vscode.ts` の513〜552行）は、`signtool.exe` を PATH から `cp.spawn` で呼ぶ。見つからないと `reject` でタスクが落ちる。本家の CI は `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` を PATH に足している（`product-build-win32-compile.yml` の105〜107行）。PC に直接入れる場合もコンテナの場合も、`build.mjs` で PATH に足すか、`check-env.ps1` で確かめる必要がある。直すのはリーダー。台本の直しは指示があれば蒙恬が行う。
2. docs/02 の5節は「ネイティブの依存は MSVC で作る」としか書いていない。補足すると、1.146.0 は `nativeBuild.buildFromSource: true` なので、配布済みの実行形式があっても使わない。食い違いではないが、資料に書いておくと「prebuild で MSVC を省く」という案の誤解を防げる。

## 未解決の点

1. Docker Desktop の入れ方（すべてのユーザー向けか、ユーザーごとか）と、PC のメモリの量は確かめていない（許可の読める場所の外）。B を採るなら、ユーザーかリーダーに確かめてもらう。
2. Linux コンテナと Windows コンテナを同時に使えないことは、Docker の公式の文言では確かめられなかった（二次情報の 2026-02-08 の記事による）。
3. VS Build Tools 2026 のライセンスの条文の全文は取れなかった（404）。ダウンロードのページの一文と 2022 年のブログで判断している。
4. Insider の版（26300）でプロセス分離が通るかは未確認。Hyper-V 分離を前提にすれば問題にならない。
5. B を採ると、台本が `docker` を呼ぶ。蒙恬の `permissions.json` には `docker` のコマンドが無いので、許可の追加（ユーザーの承認）が要る。定義の置き場所（Dockerfile をどこに置くか）は、`write_paths` との兼ね合いでリーダーが決める。
6. 2節のライセンスの当てはめ（「development」に当たるか、Community・オープンソースの例外に当たるか）は推定である。決めるのはユーザー。

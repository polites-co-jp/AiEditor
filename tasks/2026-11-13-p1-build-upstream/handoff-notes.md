# 引き継ぎ: Phase 1 の本家 1.146.0 の無改造のビルド（2026-11-14 の再開）

- 作成: 蒙恬（2026-11-14）
- 宛先: ヴラド・ツェペシュ
- 前回（2026-11-13）の報告は、この文書の末尾の「前回の報告」に残した。

## 結果

**一部完了**。依存の導入と型検査は通った。パッケージ化（`vscode-win32-x64-min`）は、本家 1.146.0 の手元のビルドの不具合で落ちる。そのため zip はまだ無い。本家の案内（`git clean -xfd` してから入れ直す）を試したが、同じところで落ちた（2回目は 249.5 秒で落ちた）。誤りの要点を残して止めた。本家のコードは変えていない。

もう1つ、関門に響く事実が分かった。落ちる前にできた出力を起動すると、この PC の **Smart App Control（オン）** が、自分でビルドした署名の無いネイティブのモジュール（`winregistry.node`）の読み込みを止め、エディタは起動の途中で終わった。copilot の不具合が片付いても、Smart App Control がオンのままでは自分のビルドは起動しない見込み。

## 要点

1. 落ちる場所: `package-win32-x64`（出力 `C:\b\wt\VSCode-win32-x64\` を作る手順）は通る。その次の `prepareCopilotRipgrepShimTask` が「Copilot SDK directory not found at …\resources\app\extensions\copilot\node_modules\@github\copilot\sdk」で落ちる。
2. 原因（本家のソースで確かめた）: 手元のビルドは copilot の拡張の依存を写すとき `build/.moduleignore` を通す。その226行の `@github/copilot/**` が `@github/copilot` を丸ごと外すのに、`build/lib/copilot.ts` の278行は、その下の `sdk` が無いと止める。本家の CI は copilot を別に VSIX にして `vscode-win32-x64-min-ci` を走らせるので、この道を通らない。main では PR #347312（2026-11-10 にマージ、マイルストーン 1.147.0）が直した。
3. 依存の導入: pnpm 12.16.0、278 秒（キャッシュが冷えた状態）、2回目は 174 秒（`git clean -xfd` の後で、キャッシュが温まった状態）。6つの `pnpm-lock.yaml` は変わらなかった。型検査 `typecheck-client` は 21 秒・19 秒で、誤り 0（tsc は TypeScript 7 の `@typescript/native`）。
4. ディスク（C: の空きの減り）: 依存の導入で 5.4 GB、パッケージ化（落ちるまで）で 3.0 GB。作業ツリーは 5.2 GB（hard link を1回だけ数えると。重ねて数えると 6.1 GB）、gulp の出力は 1.40 GB、pnpm の store は 3.5 GB（0.5 GB から増えた）。
5. 出力の形（落ちた時点の出力で見た）: `resources\app\` は**直下**（`<commit10>` の下ではない）、実行ファイルは `Code - OSS.exe`、CLI は `bin\code-oss.cmd`。`VSCODE_PORTABLE` で起動すると `<portable>\user-data\`・`<portable>\extensions\`・`<portable>\argv.json` ができた。普段使いのエディタのデータのフォルダは変わらなかった。
6. Smart App Control: `VerifiedAndReputablePolicyState` が 1（オン）。Code Integrity のイベント 3077（ポリシー `VerifiedAndReputableDesktop`）が `Code - OSS.exe` による `winregistry.node` の読み込みを止めた。Microsoft の文書は「信頼できる提供元が発行した証明書だけを考慮する」と書く。

## 判断を仰ぎたい点

### 判断1（ユーザーに諮る）: Smart App Control

自分でビルドしたエディタは、Smart App Control がオンのこの PC では起動しない見込み（落ちる前の出力で確かめた）。copilot の件より先に決める必要がある。考えられる道:

1. **Smart App Control をオフにする**（Windows セキュリティ → アプリとブラウザーの制御 → スマート アプリ コントロール）。自分のビルドがそのまま動く見込み。PC 全体の守りが1つ減る。オフにした後にまたオンにできるかは Windows のビルドによって違うという情報があり、この PC（10.0.26300）で戻せるかは確かめていない。
2. **信頼できる提供元のコード署名の証明書で、出力の全部のネイティブのファイル（`*.node`・`*.dll`・`*.exe`）に署名する**。費用と手間がかかる（Microsoft の文書は Artifact Signing を勧める）。自己署名の証明書は足りない見込み。毎週の取り込みのたびに署名する手順が増える。
3. **予備案（VSCodium の zip の後処理で運用）に寄せる**（docs/07 の4節の関門）。VSCodium の zip は Phase 0 の試験台で起動していた。自分でネイティブのモジュールをビルドしないので、この件に当たらない見込み（未確認）。

### 判断2: copilot の不具合

Phase 1 の関門（無改造のビルドが zip から起動する）を 1.146.0 でどう満たすか。どれも、本家のコードを変えずに済むか、変える範囲が違う。

1. **1.147.0 を待つ**: 直しは 1.147.0 のマイルストーンに入っている。出たら、同じ台本（`build.mjs`）で取り込みのリハーサルを兼ねて Phase 1 をやり直す。無改造のまま満たせる。1.147.0 が出るまで待つ。
2. **本家の CI の道をまねる（無改造）**: copilot を本家の CI と同じに VSIX にし（`extensions/copilot` で `vsce package`。`build/azure-pipelines/product-copilot.yml`）、`.build/extensions/copilot` に展開してから `vscode-win32-x64-min-ci` を走らせる。本家のコードは変えないが、手順が本家の手元のビルドの手順と違う。CI の copilot の手順は Linux 向けの YAML なので、Windows で通るかは試していない。今の許可に無いコマンド（`extensions/copilot` での `pnpm exec vsce package` など）が要る。
3. **無改造の関門を Phase 2 の A-1 の単位（copilot の拡張を消す）と合わせる**: A-1 は copilot の拡張を消し、`build/lib/copilot.ts` に「拡張のフォルダが無ければ戻る3行」を足す（`docs/user-decisions.md` の 2026-11-14 の記録）。これを当てるとこの不具合は起きない。ただし「無改造」ではなくなる。
4. **1.146.0 の不具合だけを直す小さなパッチを当てる**: `.moduleignore` の扱いを main の形に寄せるなど。本家のコードを変えるので、「無改造」ではなくなる。

蒙恬の見立て: 3 が今の計画（Phase 2 で copilot は消す）と合い、すぐ進める。無改造の確かめにこだわるなら 1。2 は手間のわりに、毎週の取り込みで使わない道を確かめることになる。どれを選んでも、判断1が「自分のビルドを使う」側に決まらないと起動の確かめはできない。

## 成果物

- `scripts/disk-usage.mjs`（新規）: 場所ごとのディスクの使用量を数える（読むだけ。hard link を1回だけ数える値と、C: の空きも出す）
- `scripts/p1-launch-check.ps1`（新規）: zip（`-Zip`）か既にあるフォルダ（`-Root`）を、`VSCODE_PORTABLE` で置き場所を分けて1回起動し、ユーザーのデータ・拡張・`argv.json` がどこにできたかと、普段使いのエディタのデータのフォルダが変わらないことを確かめる
- `tasks/2026-11-13-p1-build-upstream/build-log.md`（5節を追記）
- `tasks/2026-11-13-p1-build-upstream/doc-corrections.md`（「追記（2026-11-14）」の A1〜A7）
- `scripts/p1-ci-events.ps1`（新規）: Code Integrity の阻止のイベント（3033・3034・3076・3077）を読むだけで並べる（どのポリシーがどのファイルを止めたか）
- `scripts/check-env.ps1`（変更）: Smart App Control の状態（`smartAppControl`）を出す行を足した（`missing` には入れない）
- `tasks/2026-11-13-p1-build-upstream/env-check-resume.json`、`env-check-after.json`、`build-record-install.json`、`build-record-typecheck.json`、`build-record-package.json`、`build-record-r2.json`、`build-record-r2-package.json`、`disk-before-install.json`、`disk-after-install.json`、`disk-after-package-failed.json`、`disk-after-r2.json`、`launch-check-partial.json`、`ci-events.json`
- 試しの置き場所: `C:\b\p1\1.146.0-upstream-partial\portable\`（起動したときのポータブルのデータ。消してよい）
- ログ: `C:\b\logs\1.146.0-upstream\`（1回目）、`C:\b\logs\1.146.0-upstream-r2\`（`git clean -xfd` の後）

## 確かめたこと

- `check-env.ps1 -WorkTree C:/b/wt/1.146.0`: `missing` は空。
- `build.mjs --dry-run --from install --to zip`: 計画どおり（signtool は Windows Kits から子の PATH に足す）。
- 依存の導入・型検査・パッケージ化を `build.mjs` で走らせた（`build-log.md` の5節）。導入の後に `git -C C:/b/wt/1.146.0 status --porcelain` が空。
- `git -C C:/b/wt/1.146.0 clean -xfd` の後、`status --porcelain --ignored` が空になったことを確かめ、導入から入れ直した。同じ誤りで落ちた。
- 作業ツリーの HEAD は `69047191fc427f2f92828279aae1d90d8eeda7ab` のまま（`C:\b\vscode\.git\worktrees\1.146.0\HEAD`）。
- 新しい台本: `node --check scripts/disk-usage.mjs` が通る。`scripts/p0-check-ps.ps1` で `p1-launch-check.ps1`・`p1-ci-events.ps1`・`check-env.ps1` の構文の誤り 0、ASCII 以外 0 バイト。`p1-launch-check.ps1 -Root C:/Windows` は終了コード 2 で断る。
- 落ちる前の出力を `p1-launch-check.ps1 -Root` で1回起動した: CLI の `--version` は通り、エディタは 10 秒以内に終了コード 1。`main.log` に「An Application Control policy has blocked this file」。`p1-ci-events.ps1` でイベント 3077（`VerifiedAndReputableDesktop`）を確かめた。`check-env.ps1` の `smartAppControl` は `on`。普段使いのエディタのデータのフォルダは前後で変わらない（4つとも無いまま）。
- Smart App Control の出典（2026-11-14 取得）: https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control 。オフの後に戻せるかの情報は Microsoft のコミュニティの掲示板など（https://techcommunity.microsoft.com/discussions/windowsinsiderprogram/unable-to-re-enable-smart-app-control-after-disabling-it-in-windows-11---any-sol/4490326/replies/4490671 、https://www.elevenforum.com/t/turn-on-or-off-smart-app-control-in-windows-11.4996 ）で、公式の文書では確かめていない。
- 外部の事実の出典（2026-11-14 取得）: main の `build/lib/extensions.ts`（https://raw.githubusercontent.com/microsoft/vscode/main/build/lib/extensions.ts 。`packageCopilotExtensionStream` は VSIX から包み、`.moduleignore` を通さない）、`build/lib/extensions.ts` の変更の一覧（https://api.github.com/repos/microsoft/vscode/commits?path=build/lib/extensions.ts ）、PR #347312（https://github.com/microsoft/vscode/pull/347312 。2026-11-10 にマージ、マイルストーン 1.147.0、「Local builds use the same packaging task as CI」）。

## テストの入口（曹参へ）

- `node scripts/disk-usage.mjs [--out <json>] [--drive <X:>] <name>=<dir> ...`
  - 出力: `{ countedAt, seconds, drive: { root, freeBytes, freeGB }, entries: [{ name, path, exists, bytes, gb, files, hardlinkedFiles, uniqueBytes, uniqueGB }], uniqueTotal: { bytes, gb } }`。無い場所は `{ name, path, exists: false }` だけ
  - 終了コード: 0。引数の誤り（`<name>=<dir>` の形でない、場所が1つも無い、知らない `--` の引数、`--drive` が `X:` の形でない）は 2
  - `%NAME%` を環境変数で展開する（知らない名前はそのまま残す）
  - 書き出している関数: `parseArgs(argv, env)`、`expandEnv(s, env)`、`countDir(root, seen)`。同じファイルへの hard link を2つ置いた場所で、`bytes` は2倍、`uniqueBytes` は1倍、`hardlinkedFiles` は 2 になる。シンボリックリンクとジャンクションはたどらない
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 (-Zip <zip> | -Root <folder>) [-Dest <C:\b\p1\...>] [-CheckSeconds 10] [-SmokeSeconds 15] [-OutFile <json>]`
  - `-Zip` と `-Root` のどちらか1つ（両方・どちらも無しは 2）。`-Root` は `C:\b\` の下だけ、`-Dest` は `C:\b\p1\` の下だけ（外は 2）
  - 出力の JSON: `unpack`、`editor`（`exe`・`cli`・`appDirRelative`・`nameShort`・`dataFolderName` など）、`cliVersion`、`started`（`aliveAfterCheck`・`tree`・`stoppedProcesses`）、`portable`（`entries`・`userData`・`extensions`・`argvJson`）、`dailyData`（`before`・`after`・`changed`）、`result`（`ok` / `error`）、`message`
  - 終了コード: 起動して生きていて、普段使いのエディタのデータのフォルダ（`%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` と product の `nameLong`・`dataFolderName` のもの）の有無と更新時刻が変わらなければ 0、ほかは 1
  - 子のプロセスには `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を渡さず、`VSCODE_PORTABLE` だけを渡す（`scripts/lib/p0-common.ps1` の `Invoke-P0WithEditorEnv`）
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1 [-Minutes 60] [-Filter <文字列>] [-Max 50] [-OutFile <json>]`
  - 出力: `{ readable, error, since, count, events: [{ time, id, file, process, policy, message }] }`。ID は 3033・3034・3076・3077 だけ。`-Filter` は `message` に含む文字列で絞る（大文字小文字を区別しない）。イベントが無いときは `readable: true`・`count: 0`
  - 終了コード: 常に 0（読めないときは `error` に理由）
- `check-env.ps1` の出力に `smartAppControl: { verifiedAndReputablePolicyState, meaning }` を足した（0→`off`、1→`on`、2→`evaluation`、読めない→`null`・`unknown`）。`missing` には入れない（終了コードは変わらない）
- `build.mjs` は今回変えていない。

## 検証役（大岡越前守）に渡す入口

- 記録: `build-log.md` の5節と、`build-record-*.json`・`disk-*.json`（このフォルダ）。ログは `C:\b\logs\1.146.0-upstream\` と `C:\b\logs\1.146.0-upstream-r2\`
- 誤りの再現: `node scripts/build.mjs 1.146.0 --label <新しいラベル> --from package --to package --take-in-dir <試しの場所> --record <試しの場所>\r.json`（依存の導入が済んだ作業ツリーで、約4分。`package.log` の末尾に上の誤り）
- 原因の行: `C:\b\wt\1.146.0\build\.moduleignore` の226行、`build\lib\copilot.ts` の268〜279行、`build\lib\extensions.ts` の551〜571行、`build\gulpfile.vscode.ts` の554〜568行と603〜617行（CI の `-ci` のタスクとの違い）
- 出力の形: `C:\b\wt\VSCode-win32-x64\`（落ちた時点のもの。`resources\app\product.json` が直下）
- Smart App Control の再現: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Root C:/b/wt/VSCode-win32-x64 -Dest C:/b/p1/<新しい名前>` が終了コード 1（`started.aliveAfterCheck` が false）。続けて `scripts/p1-ci-events.ps1 -Minutes 10 -Filter 'wt\VSCode-win32-x64'` に ID 3077・ポリシー `VerifiedAndReputableDesktop` が出る。状態は `check-env.ps1` の `smartAppControl`

## docs/ との食い違い

`doc-corrections.md` の「追記（2026-11-14）」A1〜A9。大きいのは A1（02 の4節の6と 07 の4節の2が前提にする「無改造で zip まで行く」が 1.146.0 では成り立たない）と A8（Smart App Control がオンだと自分のビルドが起動しない。02 の5節に書かれていない）。

## 未解決の点

1. **上の「判断を仰ぎたい点」の判断1・判断2**（zip と起動の確かめ、`claude-code` の組を通すスモークは、これが決まるまで進められない）。判断1はユーザーの PC の守りの設定なので、ユーザーに諮ってほしい。
2. **このリポジトリのルートの `pnpm install --frozen-lockfile`（依頼の4）を走らせていない**。許可に無いため。要るもの: 「リポジトリの直下で `pnpm install --frozen-lockfile`」を走らせる許可（何のため: pnpm 12.16.0 でこのリポジトリの `pnpm-lock.yaml` が通るか、差分が出ないかを確かめるため）。分かっていること（読むだけで）: ルートの `pnpm-lock.yaml` は `lockfileVersion: '9.0'`（本家 1.146.0 の pnpm 12 のロックファイルも `'9.0'`）。今の `node_modules\.modules.yaml` は pnpm 11.8.0 で入れたもの（store は `E:\.pnpm-store\v11`）。リーダーが走らせるか、許可を足すかを決めてほしい。
3. **node-gyp のキャッシュを消す案内は試していない**。`%LOCALAPPDATA%\node-gyp` は書き込み先の外で、今回の誤りはネイティブのビルドと関係が無い（ヘッダーの取得とネイティブのモジュールのビルドは通っている）ため。
4. **postinstall が常設の clone の共有の設定に書く**（`pull.rebase = merges`、`blame.ignoreRevsFile`）。害は無いが、clone の設定が本家の postinstall で変わることは `prepare.mjs` の確かめの外にある。
5. **gulp の出力 `C:\b\wt\VSCode-win32-x64\` は作業ツリーが違っても同じ場所**。Phase 2 の作業ツリー（`C:\b\wt\dev-*` など）でビルドが並んで走ると、互いの出力を消す（`build-switch` の doc-corrections の2と同じ）。今回は並べて走らせていない。
6. pnpm が「12.16.0 → 12.18.0」の更新を案内する。上げない（本家の `packageManager` は 12.16.0）。

---

## 前回の報告（2026-11-13）

### 追記（2026-11-13 21:44）: clone と作業ツリー

- 結果: 完了。`C:\b\vscode`（常設の clone）と `C:\b\wt\1.146.0`（作業ツリー）を作った。タグ 1.146.0 の commit と作業ツリーの HEAD は、どちらも `69047191fc427f2f92828279aae1d90d8eeda7ab` で、`upstream.json` と一致した。
- 所要時間: clone 171.4 秒、fetch --tags 51.9 秒、worktree add 43.3 秒。
- ディスク: clone の `.git` 1.64 GB、clone の checkout（main）0.34 GB、作業ツリー 0.34 GB。
- `scripts/prepare.mjs` の入口は `build-log.md` の4節と前回の版のこの文書のとおり（`node scripts/prepare.mjs [--tag <tag>] [--commit <sha>] [--build-root <dir>] [--out <json>] [--no-size]`）。

### 最初の報告（環境の確かめ）

- 足りなかったもの4つ（Node.js 24.22.1、pnpm 12.16.0、setuptools、Visual Studio 2026 Build Tools）は、ユーザーが入れて解消した（2026-11-14）。
- `scripts/check-env.ps1` の入口: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 [-WorkTree <dir>] [-NodeRequired <ver>] [-PnpmRequired <ver>] [-BuildRoot <dir>] [-OutFile <path>]`。`missing` が空なら 0、空でなければ 2。
- 報告の受け渡し（`SubagentHandback` が許可のフックに止められた件）は、前回の未解決のまま。

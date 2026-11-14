# Phase 1: A-1 を当てた本家 1.146.0 のビルドの記録

- 作成: 蒙恬（2026-11-14）
- 状態: **zip までできた。zip から起動し、25 秒生きていた**（Smart App Control はオンのまま。ネイティブのモジュール3つが止められたが、エディタは終わらなかった）。1回目はパッケージ化で落ちた（原因は A-1 でなく notion-sync。3.3）。入力を A-1 だけに直した2回目で通った。
- 依頼: `brief.md`。裁定: `docs/user-decisions.md` の 2026-11-14「Phase 1 のビルドの関門」、`docs/07-phases.md` の4節「1.146.0 での扱い」
- 時刻は JST。記録の JSON はこのフォルダにある。ログは `C:\b\logs\1.146.0-p1-a1\`（1回目）と `C:\b\logs\1.146.0-p1-a1-r2\`（2回目）。

## 1. 直し（依頼の1）

### 1.1 `scripts/p1-ci-events.ps1` の54行

- 前: `if ($_.Exception.Message -match 'No events were found') ...`（英語の文言と照らしていた。日本語の Windows では一致せず、イベントが無いと `readable: false` になった）
- 後: `if ([string]$_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') ...`（`Get-WinEvent` は、当たるイベントが無いと `FullyQualifiedErrorId` が `NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand` の誤りを投げる。言語によらない）。理由を2行の注釈に書いた（ASCII だけ）。
- 確かめ:
  - `scripts/p0-check-ps.ps1 scripts/p1-ci-events.ps1` で、構文の誤り 0、ASCII 以外 0 バイト。
  - 落ちていたテストと同じ引数（`-Minutes 1 -Filter no-such-text-zzqq-91827`）で走らせて、`readable: true`、`error: null`、`count: 0`。
  - `-Filter` なしの `-Minutes 0`（必ず「イベントが無い」の経路を通る）でも、`readable: true`、`error: null`、`count: 0`。
- **`node --test tests/p1-scripts.test.mjs` は走らせていない**。この役の許可に無い（フックが止めた）。上の2つは、そのテストが見る経路を台本だけで確かめたもの。

### 1.2 `tasks/2026-11-13-p1-build-upstream/doc-corrections.md` の A8

- 「箇所」の列に、docs/02 の6節の157行（「署名はしない。手元でビルドしたものにはダウンロードの印が付かないので、SmartScreen は出にくい（推定）」）を足した。
- 「直し方の案」の列に、「Smart App Control がオンだと、署名の無いネイティブのファイルの読み込みが止められる。扱いはユーザーの判断」と書き足す案を足した。SmartScreen の推定（ダウンロードの印の話）は残してよい、とした。
- 2.6 の起動の結果（止められても起動は続いた）は、A8 にはまだ書いていない（4節）。

## 2. 当てたもの

A-1 の単位だけを当てた。`unit.json` の `enabled` は書き換えていない（`false` のまま）。`apply.mjs` の `--only` で選んだ。

`apply.mjs` は `--only` でも、product.json の上書き・`patches/`・`assets/`・自前の組み込み拡張（mydist、notion-sync）をいつも当てる。これらは A-1 ではないので、台本の引数で外した。

| 当てるもの | 扱い | どう外したか |
|---|---|---|
| product.json の上書き | 当てない（本家の `Code - OSS` のまま） | `--overlay a1-inputs/overlay-empty.json`（`set`・`remove`・`removeIfPresent` が空）。product.json は1バイトも変わらなかった（`git diff` で確かめた。コミット「apply: product.json overlay」は空） |
| A-1 の単位 | **当てる** | `--only A-1-copilot-extension` |
| `patches/`（20・30） | 当てない | `--patches a1-inputs/patches-none`（`*.patch` の無いフォルダ） |
| `assets/` | 当てない | `--assets a1-inputs/assets-none`（無いフォルダ。`apply.mjs` は `none` にする） |
| mydist | **当てる**（外せない） | `apply.mjs` は mydist が無いと止まる。`build.mjs` の postprocess も mydist が無いと落とす。コードの無い宣言だけの拡張（既定の設定とキー割り当て）。docs/07 の4節の4は「`mydist` の既定を見る」とも書いている |
| notion-sync | 2回目は当てない | 1回目は当ててしまい、パッケージ化で落ちた（3.3）。2回目は `--extensions-src a1-inputs/extensions-src`（mydist だけを写したもの）を渡した |

- `a1-inputs/extensions-src/mydist/` は `extensions-src/mydist/` の3つのファイル（`package.json`・`README.md`・`ThirdPartyNotices.txt`）を写したもの。作業ツリーで比べて、1回目に当てた mydist と中身が同じだった（`git diff --stat` の差は `extensions/notion-sync/` の3ファイルだけ）。

## 3. 走らせたこと

### 3.1 走らせ方

```
node scripts/disk-usage.mjs --out tasks/2026-11-14-p1-build-a1/disk-before.json pnpmStore=... pnpmCache=... electron=... nodeGyp=... clone=C:/b/vscode/.git package=C:/b/wt/VSCode-win32-x64 dist=C:/b/dist
node scripts/prepare.mjs --tag 1.146.0 --worktree C:/b/wt/p1-a1 --out tasks/2026-11-14-p1-build-a1/prepare.json
node scripts/apply.mjs C:/b/wt/p1-a1 --label 1.146.0-p1-a1 --only A-1-copilot-extension --dry-run --overlay ... --patches ... --assets ... --checks-out tasks/2026-11-14-p1-build-a1/dry-run/checks.json
# 1回目
node scripts/apply.mjs C:/b/wt/p1-a1 --label 1.146.0-p1-a1 --only A-1-copilot-extension --overlay tasks/2026-11-14-p1-build-a1/a1-inputs/overlay-empty.json --patches tasks/2026-11-14-p1-build-a1/a1-inputs/patches-none --assets tasks/2026-11-14-p1-build-a1/a1-inputs/assets-none --checks-out tasks/2026-11-14-p1-build-a1/take-in/checks.json
node scripts/build.mjs 1.146.0 --label 1.146.0-p1-a1 --worktree C:/b/wt/p1-a1 --from install --to typecheck --take-in-dir tasks/2026-11-14-p1-build-a1/take-in --record tasks/2026-11-14-p1-build-a1/build-record-install.json
node scripts/build.mjs 1.146.0 --label 1.146.0-p1-a1 --worktree C:/b/wt/p1-a1 --from package --to zip --take-in-dir tasks/2026-11-14-p1-build-a1/take-in --record tasks/2026-11-14-p1-build-a1/build-record-package.json
# ↑ notion-sync で落ちた（3.3）。作業ツリーをタグの commit に戻し、mydist だけで当て直した
git -C C:/b/wt/p1-a1 checkout --detach 69047191fc427f2f92828279aae1d90d8eeda7ab
node scripts/apply.mjs C:/b/wt/p1-a1 --label 1.146.0-p1-a1-r2 --only A-1-copilot-extension --overlay tasks/2026-11-14-p1-build-a1/a1-inputs/overlay-empty.json --patches tasks/2026-11-14-p1-build-a1/a1-inputs/patches-none --assets tasks/2026-11-14-p1-build-a1/a1-inputs/assets-none --extensions-src tasks/2026-11-14-p1-build-a1/a1-inputs/extensions-src --checks-out tasks/2026-11-14-p1-build-a1/take-in-r2/checks.json
node scripts/build.mjs 1.146.0 --label 1.146.0-p1-a1-r2 --worktree C:/b/wt/p1-a1 --from install --to zip --take-in-dir tasks/2026-11-14-p1-build-a1/take-in-r2 --record tasks/2026-11-14-p1-build-a1/build-record-r2.json
node scripts/disk-usage.mjs --out tasks/2026-11-14-p1-build-a1/disk-after-zip.json worktree=C:/b/wt/p1-a1 package=C:/b/wt/VSCode-win32-x64 dist=C:/b/dist pnpmStore=... electron=...
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip C:/b/dist/1.146.0-p1-a1-r2.zip -Dest C:/b/p1/1.146.0-p1-a1-r2 -OutFile tasks/2026-11-14-p1-build-a1/launch-check.json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1 -Minutes 15 -OutFile tasks/2026-11-14-p1-build-a1/ci-events.json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -WorkTree C:/b/wt/p1-a1 -OutFile tasks/2026-11-14-p1-build-a1/env-check.json
```

- 子のプロセスから外した環境変数（`build.mjs` の `childEnv`）は前回と同じ10個（`ELECTRON_RUN_AS_NODE`、`VSCODE_*`）。
- 作業ツリー `C:\b\wt\1.146.0` には触れていない。gulp の出力 `C:\b\wt\VSCode-win32-x64\` は上書きした（brief のとおり）。

### 3.2 作業ツリーと当てた結果（20:02〜20:03）

- `prepare.mjs`: fetch --tags 9.7 秒、worktree add 13.7 秒、合わせて 27.7 秒。タグの commit と作業ツリーの HEAD は、どちらも `69047191fc427f2f92828279aae1d90d8eeda7ab`（`upstream.json` と一致）。`status --porcelain` は空。記録 `prepare.json`。
- `apply.mjs`（2回目、`take-in-r2/checks.json`）: `result: ok`、7.2 秒。
  - A-1: `delete` は2つとも消した（`extensions/copilot`、`extensions/prompt-basics`）。`removeLines` は8行とも1つずつ見つかった。`edits.patch` は衝突なしで当たった（件名「unit A-1-copilot-extension: edits」）。
  - 適用後の検査: `remnants`・`absentStrings`・`unclassifiedExtensions`・`registeredKeys` は ok。`upstreamAdditions`・`dependencies` は `--prev-tag` が無いので skipped。
  - 作業ツリーの HEAD: `72f454338508f617631589f6f3f6cfc1aff1ca8b`。当てた後も `git status` は「nothing to commit, working tree clean」。
  - 1回目のコミット（`78f2c63b8df` まで4つ）は、作業ツリーを戻したのでどのブランチからもたどれない（害は無い。常設の clone の gc で消える）。

### 3.3 1回目のパッケージ化: notion-sync で落ちた（20:07:55〜20:07:57）

- 依存の導入（164.0 秒）・ロックファイルの検査（ok）・型検査（19.0 秒、誤り 0）は通った（`build-record-install.json`）。
- パッケージ化は 4.5 秒（gulp の 2.25 秒）で落ちた（`build-record-package.json`、`C:\b\logs\1.146.0-p1-a1\package.log`）:

```
[20:07:57] 'vscode-win32-x64-min' errored after 2.25 s
[20:07:57] Error: Extension notion-sync has production dependencies (jsonc-parser) but is packaged without bundling, so they would be missing. Bundle it with esbuild.mts (and esbuild.browser.mts for the web), or package its dependencies explicitly (packagedDependenciesByExtension in build/lib/extensions.ts).
    at fromLocalNormal (file:///C:/b/wt/p1-a1/build/lib/extensions.ts:171:9)
```

- 原因:
  - `apply.mjs` は、`extensions-src/notion-sync/dist/extension.js` があると notion-sync を `extensions/notion-sync/` に写す（今はある）。
  - `extensions-src/notion-sync/package.json` の83行は `"dependencies": { "jsonc-parser": "3.3.1" }` を持つ。
  - 本家 1.146.0 の `build/lib/extensions.ts` の `fromLocalNormal`（162〜172行）は、`esbuild.mts` を持たない拡張に `dependencies` か `optionalDependencies` があると止める。
  - `dist/extension.js` には jsonc-parser が中に入っている（esbuild の `// node_modules/.pnpm/jsonc-parser@3.3.1/...` の印が7つ）。実行には `dependencies` は要らない。
- A-1 とは関係が無い。notion-sync は A-1 だけの関門の範囲の外なので、2回目は外した（2節）。ただし、Phase 2 の本ビルド（全部の単位と自前の拡張を当てたもの）でも同じところで落ちる。直し方の案は `handoff-notes.md` の「判断を仰ぎたい点」。

### 3.4 2回目: 依存の導入から zip まで（20:10:49〜20:14:35、3分46秒）

| 手順 | 所要時間 | 結果 |
|---|---|---|
| 依存の導入（`pnpm install --no-frozen-lockfile`） | 2.5 秒 | ok。1回目の導入が済んだ作業ツリーなので、ほぼ何もしなかった。**キャッシュが温まった状態の導入の値は、1回目の 164.0 秒**（前回の無改造は 173.8 秒） |
| ロックファイルの検査 | 0.5 秒 | ok。5つは変わらない（`unchanged: true`）。`extensions/copilot/pnpm-lock.yaml` は `removed`（単位が消したフォルダの中）。`take-in-r2/lockfile.diff` |
| 型検査（`typecheck-client`） | 18.5 秒 | ok、誤り 0 |
| パッケージ化（`gulp vscode-win32-x64-min`） | 156.6 秒（gulp の 2.57 分） | **ok**。signtool は前回と同じく Windows Kits の `10.0.26100.0\x64` を子の PATH に足した |
| 後処理の確かめ（postprocess） | 0.01 秒 | ok（下の 3.5） |
| zip（System32 の `tar.exe`） | 35.5 秒 | ok |

パッケージ化の中の手順（`C:\b\logs\1.146.0-p1-a1-r2\package.log`）:

| 手順 | 時間 |
|---|---|
| `bundle-marketplace-extensions-build` | 0.9 秒 |
| `bundle-non-native-extensions-build`（拡張の型検査は tsgo、誤り 0） | 4.4 秒 |
| `compile-copilot-extension-build` | **1 ms**（拡張のフォルダが無いので空。前回は 63.1 秒） |
| `compile-extension-media-build` | 2.4 秒 |
| `esbuild-bundle-win32-x64-min` | 107.0 秒 |
| `compile-native-extensions-build` | 0.6 秒 |
| `clean-vscode-win32-x64` | 3.3 秒 |
| `package-win32-x64` | 31.6 秒 |
| `<anonymous>`（`prepareCopilotRipgrepShimTask`） | **1 ms**（A-1 の3行で戻った。前回はここで落ちた） |
| `vscode-win32-x64-min-ci`（`patchWin32DependenciesTask`・`generateNodeCompileCache` を含む） | 4.0 秒 |

A-1 の README の「未確認」のうち、「`gulp vscode-win32-x64-min` が `compileCopilotExtensionBuildTask`（空の流れ）と `prepareCopilotRipgrepShimTask`（何もしない）を通り抜けるか」は、通り抜けた。

### 3.5 出力と zip

| 項目 | 値 |
|---|---|
| gulp の出力 | `C:\b\wt\VSCode-win32-x64\`。1.18 GB、2,612 ファイル（前回の落ちた時点は 1.40 GB・20,325 ファイル。copilot の拡張とその依存が無く、`node_modules.asar` に包まれたため） |
| 出力の形 | `resources\app\` は直下、実行ファイルは `Code - OSS.exe`、CLI は `bin\code-oss.cmd`、`version` 1.146.0、`commit` は無い。`LICENSE.txt`・`ThirdPartyNotices.txt` がある |
| 組み込み拡張（postprocess） | 93。消え残り 0（`copilot`・`prompt-basics` は無い）、`keep.json` の不足 0、mydist はある。`notShipped`（本家が同梱しない試験の拡張）4つ。`keep.json` に無いもの（情報）29（`github`・`terminal-suggest`・テーマなど。後の単位が消すもの） |
| zip | `C:\b\dist\1.146.0-p1-a1-r2.zip`。406,720,616 バイト（0.38 GB）、3,190 項目、最上位のフォルダは `Code-OSS-win32-x64-1.146.0-p1-a1-r2` だけ |
| zip の SHA-256 | `9348d66c02d84deb8c0b5aa9da7adbff82f1d9eed9a756e8c8619008910c32b1` |
| 展開した場所 | `C:\b\p1\1.146.0-p1-a1-r2\Code-OSS-win32-x64-1.146.0-p1-a1-r2\`（展開 16.1 秒） |

`tar.exe` で zip が作れるか（docs/07 の4節の3）: 作れた（bsdtar 3.8.9、`-a -c -H`、ジャンクション経由で最上位の名前を変えた）。

### 3.6 ディスク

C: の空き（`disk-usage.mjs` の `drive`。最後だけ `check-env.ps1`）:

| 時点 | 空き | 減り |
|---|---|---|
| 作業ツリーを作る前（20:02） | 81.15 GB | — |
| 1回目の依存の導入の後（20:07） | 79.61 GB | 1.54 GB（作業ツリーの checkout 0.34 GB を含む） |
| 2回目の zip の後（20:15） | 78.82 GB | 0.79 GB（出力は前回の分を置き換えた。zip 0.38 GB） |
| zip を展開して起動した後（20:16） | 77.6 GB | 1.2 GB（`C:\b\p1\1.146.0-p1-a1-r2\` の展開とポータブルのデータ） |

場所ごと（20:15、`disk-after-zip.json`）:

| 場所 | 大きさ | hard link を1回だけ数えると | ファイル数 |
|---|---|---|---|
| 作業ツリー `C:\b\wt\p1-a1` | 4.50 GB | 3.86 GB | 131,106（うち hard link 109,681） |
| gulp の出力 `C:\b\wt\VSCode-win32-x64` | 1.18 GB | 1.18 GB | 2,612 |
| `C:\b\dist`（zip） | 0.38 GB | 0.38 GB | 1 |
| pnpm の store | 3.46 GB（前回から増えない） | 3.46 GB | 108,171 |
| Electron の取得物 | 0.91 GB（増えない） | 0.91 GB | 7 |

- pnpm の store・pnpm-cache・Electron・node-gyp は、前回の無改造のビルドで温まっていたので増えなかった。作業ツリーの大部分は store からの hard link なので、C: の空きの減りは作業ツリーの大きさよりずっと小さい。
- 作業ツリー `C:\b\wt\1.146.0`（前回、5.2 GB）は残っている。

### 3.7 所要時間のまとめ

キャッシュが温まった状態で、作業ツリーの用意から zip まで（1回目の導入の値と2回目のほかの手順を足したもの）:

| 手順 | 時間 |
|---|---|
| 作業ツリーの用意（fetch と worktree add） | 27.7 秒 |
| 適用（`apply.mjs`） | 7.2 秒 |
| 依存の導入 | 164.0 秒 |
| ロックファイルの検査 | 0.5 秒 |
| 型検査 | 18.5 秒 |
| パッケージ化 | 156.6 秒 |
| 後処理の確かめと zip | 35.5 秒 |
| 合計 | **約 6.8 分**（410 秒） |

単位が増えれば、適用・型検査・パッケージ化は変わる。全部の単位での値は Phase 2 で測る。

## 4. 起動の確かめ（依頼の3。20:15:12〜20:15:45）

`p1-launch-check.ps1 -Zip` で1回だけ起動した（記録 `launch-check.json`）。PC の設定は変えていない。`check-env.ps1` の `smartAppControl` は、起動の後も `verifiedAndReputablePolicyState: 1`（`on`）。

| 項目 | 結果 |
|---|---|
| 終了コード | 0（`result: ok`、「started, stayed alive, stopped; daily editor data folders unchanged」） |
| CLI | `bin\code-oss.cmd --version` が終了コード 0、「1.146.0 / Unknown commit / x64」 |
| 起動 | `Code - OSS.exe --new-window` が、10 秒の確かめと 15 秒の待ちの後も生きていた。プロセスは `Code - OSS.exe` が8つ。台本が8つとも止めた |
| ポータブルの置き場所 | `C:\b\p1\1.146.0-p1-a1-r2\portable\` に `user-data\`（設定は `user-data\User\`）、`extensions\`、`shared-data\`、`argv.json` ができた。`shared-data\`（`sharedStorage\state.vscdb`）は前回の落ちた起動では見ていなかった |
| 普段使いのエディタのデータ | `%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` は、前も後も無い（変わらない） |

### 4.1 Smart App Control が止めたもの

**止められたが、エディタは終わらなかった。** Code Integrity のイベント（`ci-events.json`、20:01 から 15 分）は6件で、どれも今回の展開先のファイル。ID 3077 はポリシー `VerifiedAndReputableDesktop`（Smart App Control）。

| 時刻 | 止められたファイル（`resources\app\node_modules.asar.unpacked\` の下） | エディタのログ |
|---|---|---|
| 20:15:34.79 | `@vscode\deviceid\build\Release\windows.node` | `main.log` の2行と56行に「An Application Control policy has blocked this file.」（`@vscode/deviceid` の `storage.js` から。起動は続いた） |
| 20:15:37.05 | `native-keymap\build\Release\keymapping.node` | ログに誤りの行は無い |
| 20:15:39.50 | `native-is-elevated\build\Release\iselevated.node` | ログに誤りの行は無い |

- 前回の落ちる前の出力で止められて致命になった `@vscode\windows-registry\build\Release\winregistry.node` は、今回はイベントに出なかった。展開したフォルダには、そのファイルがある。
  - 読み込まれなかったのか、読み込みが許されたのかは分からない。前回の出力との違いは、パッケージ化の最後の手順（`patchWin32DependenciesTask`・`generateNodeCompileCache` など）を通ったか、copilot の拡張があるか、作業ツリーが違うか。どれが効いたのかは確かめていない。
- ほかのネイティブのモジュール（`@vscode\sqlite3`・`@vscode\spdlog`・`@vscode\windows-mutex` など。展開先に全部で 20）は、イベントに出なかった。共有のストレージの `state.vscdb` ができ、ログのファイルが書かれたので、少なくとも sqlite3 と spdlog は読み込まれたと見られる（推定）。
- 止められた3つが効く機能（推定。本家のソースは確かめていない）: `deviceid` は機器の ID（テレメトリ向け。消す方向の部品）、`native-keymap` はキーボードの配列の読み取り（キー割り当ての表示などに響く恐れ）、`native-is-elevated` は管理者で起動したかの判定。
- この結果は Smart App Control の調べ（`tasks/2026-11-14-sac-override-research/`）にも関わる。そのフォルダには書いていない。

### 4.2 そのほかのログの誤り（起動の1回）

| ログ | 誤り | 見立て |
|---|---|---|
| `main.log` 103〜105行 | `[AgentHost:stderr] failed to asynchronously prepare wasm: ENOENT ... node_modules\@vscode\tree-sitter-wasm\wasm\tree-sitter.wasm` | 本体の AI のエージェントのホスト（C-1 で消す部品）。A-1 によるものかは分からない（無改造の zip が無いので比べられない） |
| `window1\renderer.log` 80行 | `CodeExpectedError: No default agent contributed` | 既定の AI の拡張（`GitHub.copilot-chat`）が無いため。A-1 の README の「影響しうるもの」の見込みどおり |
| `remoteTunnelService.log` | `Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json` | OSS の product.json にトンネルの設定が無いため（本家の OSS のまま） |

拡張ホストのログ（`window1\exthost\`）に誤りの行は無かった。画面は見ていない（台本は起動して 25 秒後に止めるだけ）。

## 5. していないこと

- Claude Code の組（docs/07 の4節の4）・スモーク・`test/smoke` を `--build` で向けること: 依頼の範囲の外。
- `pnpm -C build run typecheck`（A-1 の README の「未確認」の1つ目）: 許可に無い。パッケージ化は `build/` の TypeScript を型検査せずに走らせる（`--experimental-strip-types`）ので、ビルドが通っても `build/` の型の誤りが無いとはいえない。
- `node --test tests/p1-scripts.test.mjs`: 許可に無い（1.1）。

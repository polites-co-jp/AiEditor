# 改名の後の本体の作り直し（1.146.0-p5-c-all-r7）: ビルドの記録

- 担当: 蒙恬、2026-11-19
- 依頼: `brief.md`（同じフォルダ）
- 状態: 完了。`switch.ps1` での展開と移行の台本の本番は、まだ行っていない。

## 0. 要点

- リポジトリのコミット `c56bb37`（改名のコミット `43be443` に依頼書を足しただけ。差は `brief.md` の1ファイル）から、21単位と2本のパッチを全部当てた版を作った。`build.mjs` を1回打ち、`result: ok` で終わった。
- zip は `tmp/b/dist/1.146.0-p5-c-all-r7.zip`（220,100,121 バイト）、SHA-256 は `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`。中には `Sukuna.exe` と `bin\sukuna.cmd` があり、product.json の名前の12キーは `rename-plan.md` の2節の表どおり。
- 組み込み拡張は `sukuna.mydist`・`sukuna.notion-sync`・`sukuna.language-pack-ja` の ID で入っている。zip の 1,730 ファイルを全部ほどいて調べ、`shuko` の文字（大文字小文字を問わない）は名前にも中身にも 0 だった。
- 警告は、前から出ている C-2 の1件（`debugChatIntegration.ts が本家に無い`）だけ。起動の確かめ（ポータブルの形で打つもの）は `result: ok`。日本語は除外の外の未訳が 0。

## 1. 打ったコマンドと時間

作業の場所はリポジトリの直下。`local.json`（`%LOCALAPPDATA%\Sukuna\local.json`）はまだ無いので、`buildRoot` には既定の `tmp\b` が使われた。

| # | コマンド | 結果 |
|---|---|---|
| 1 | `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r7 --worktree tmp/b/wt/r7/w --take-in-dir tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7 --record tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7/build-plan.json --dry-run` | 計画だけを出した（`build-plan.json`）。21単位が有効、signtool あり、zip はまだ無い |
| 2 | `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r7 --worktree tmp/b/wt/r7/w --take-in-dir tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7 --record tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7/build-record.json` | `result: ok`、`stoppedAt: null`、終了コード 0 |
| 3 | `node scripts/trial-r7-verify.mjs tmp/b/dist/1.146.0-p5-c-all-r7.zip tmp/b/dist/1.146.0-p5-c-all-r6.zip tasks/2026-11-19-r7-build/zip-check-r7.json` | zip を読んで確かめ、r6 と比べた（3節・4節） |
| 4 | `node scripts/trial-r7-verify.mjs tmp/b/dist/1.146.0-p5-c-all-r6.zip tmp/b/dist/1.146.0-p5-c-all-r5.zip tasks/2026-11-19-r7-build/zip-check-baseline-r6-vs-r5.json` | 比べるときの基準として、r6 と r5 の差を取った（4節） |
| 5 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip tmp/b/dist/1.146.0-p5-c-all-r7.zip -Dest tmp/b/p2/1.146.0-p5-c-all-r7 -InstallExtension <r6 と同じ VSIX 6つ>` | `result: ok`（5節） |
| 6 | `node scripts/l10n-ja.mjs extract --app tmp/b/wt/r7/VSCode-win32-x64/resources/app --worktree tmp/b/wt/r7/w --label 1.146.0-p5-c-all-r7 --out tmp/l10n/strings-1.146.0-r7.json` | 文言は全部で 15,159（本体 12,334、拡張 2,825） |
| 7 | `node scripts/l10n-ja.mjs count --strings tmp/l10n/strings-1.146.0-r7.json --pack tmp/b/p2/1.146.0-p5-c-all-r7/Sukuna-win32-x64-1.146.0-p5-c-all-r7/resources/app/extensions/language-pack-ja --out tasks/2026-11-19-r7-build/l10n-count-r7-unpacked.json` | `result: ok`、除外の外の未訳 0（6節） |
| 8 | `node scripts/l10n-probe.mjs sha <lockfile.diff 2つ> <zip>` | zip の SHA-256 が記録の値と合った。lockfile の差は r6 と同じバイト列だった |

ビルドの手順ごとの時間（秒。`build-record.json` の `steps`）:

| prepare | apply | install | lockfile | typecheck | package | postprocess | zip | 全体 |
|---|---|---|---|---|---|---|---|---|
| 95.5 | 48.2 | 912.8 | 0.6 | 10.1 | 114.6 | 0.01 | 17.8 | 20分14秒（02:13:44Z〜02:33:58Z） |

- install はこれまでで最も長かった（r6 は 604 秒、r5 は 803 秒）。新しい作業ツリーでネイティブの部品を全部作り直したためと見ている（r5 のときと同じ見立て）。失敗やリトライは無い。
- 失敗は 0。手順はすべて `status: ok`。

## 2. 版の値

| 項目 | 値 |
|---|---|
| ラベル | `1.146.0-p5-c-all-r7` |
| 本家 | 1.146.0（`69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| リポジトリのコミット | `c56bb37abaa7ed118b4dd5dfd45fe93c26851902`（`43be443039051bc6f8df9baf43704c9259589ec6` に `brief.md` を足しただけ） |
| zip | `tmp/b/dist/1.146.0-p5-c-all-r7.zip`（220,100,121 バイト、2,139 項目、最上位のフォルダ `Sukuna-win32-x64-1.146.0-p5-c-all-r7`） |
| zip の SHA-256 | `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`（記録の値と、`trial-r7-verify.mjs`・`l10n-probe.mjs sha` で計算し直した値が一致） |
| 版の commit（作業ツリーの HEAD。product.json の `commit`） | `b76374c6fc633747549a7b1a44a1a5364c7fe8f2`。枝 `builds/1.146.0-p5-c-all-r7` を新しく作った（`action: created`） |
| 作業ツリー | `tmp/b/wt/r7/w` |
| gulp の出力 | `tmp/b/wt/r7/VSCode-win32-x64`（新しいフォルダ。何も消していない） |
| 試しに展開した場所（起動の確かめ用。版のフォルダではない） | `tmp/b/p2/1.146.0-p5-c-all-r7/Sukuna-win32-x64-1.146.0-p5-c-all-r7` |
| 道具の版 | node 24.22.1、Electron 43.8.6、pnpm 12.16.0 |
| 台帳（`extensions.lock.json`）の SHA-256 | `27ad0e1b8ee24a93a2f7edce87c360f29da1e7429c0b3b27374cb81f33a6db70`（r6 と同じ） |

作業ツリーを `tmp/b/wt/r7` ではなく `tmp/b/wt/r7/w` にした理由は、r5・r6 と同じ。gulp はパッケージ化の前に、作業ツリーの親にある `VSCode-win32-x64` を消して作り直す（本家 `build/gulpfile.vscode.ts` の `util.rimraf`）。`tmp/b/wt/r7` に置くと `tmp/b/wt/VSCode-win32-x64` を消すことになり、そこは私の削除の許可の外にある。

## 3. 確かめた中身（zip を読んで確かめた。`zip-check-r7.json`）

### 3.1 実行ファイルと CLI

- 最上位の `.exe` は `Sukuna.exe` の1つだけ。`bin\` には `sukuna` と `sukuna.cmd` の2つ。`Shuko.exe`・`bin\shuko.cmd` は無い。
- `bin\sukuna.cmd` の中身: `"%~dp0..\Sukuna.exe" "%~dp0..\resources\app\out\cli.js" %*`。
- `resources\app\` の下に `LICENSE.txt`・`ThirdPartyNotices.txt` がある。
- 名前に `sukuna` を含む項目は5つ: `Sukuna.exe`、`Sukuna.VisualElementsManifest.xml`、`bin/sukuna`、`bin/sukuna.cmd`、`resources/app/extensions/notion-sync/dist/i18n/sukuna.notion-sync.ja.i18n.json`。

### 3.2 product.json（`resources/app/product.json`）

| キー | 値 | 2節の表 |
|---|---|---|
| `nameShort` | `Sukuna` | 合う |
| `nameLong` | `Sukuna` | 合う |
| `applicationName` | `sukuna` | 合う |
| `dataFolderName` | `.sukuna` | 合う |
| `sharedDataFolderName` | `.sukuna-shared` | 合う |
| `urlProtocol` | `sukuna` | 合う |
| `win32MutexName` | `sukuna` | 合う |
| `win32DirName` | `Sukuna` | 合う |
| `win32NameVersion` | `Sukuna` | 合う |
| `win32RegValueName` | `Sukuna` | 合う |
| `win32AppUserModelId` | `Sukuna.Editor` | 合う |
| `win32ShellNameShort` | `&Sukuna` | 合う |
| `win32x64AppId`・`win32arm64AppId`・`win32x64UserAppId`・`win32arm64UserAppId` | `product.overlay.json` と同じ GUID（r6 から変えていない） | 合う（変えない） |
| `sukunaConfigurationDefaults` | `product.overlay.json` の値と同じ（`extensions.allowed` は `*` が false で、台帳の7件が true。ほかの5つの設定も同じ） | 合う |
| `shukoConfigurationDefaults` | 無い | — |
| `commit` | `b76374c6fc633747549a7b1a44a1a5364c7fe8f2`（作業ツリーの HEAD と一致。後処理の `productCommit.ok: true`） | — |
| `version` | `1.146.0` | — |
| `builtInExtensions` | `[]` | — |

r6 の product.json との差（`productDiffFromR6`）は 19 キー。内訳は次のとおり。

- 名前の置き換えだけで説明がつくもの（13）: 上の12キーと、独自のキーの名前（`shukoConfigurationDefaults` → `sukunaConfigurationDefaults`。中身は同じ）。
- ビルドごとに変わるもの（4）: `commit`、`date`、`checksums`、`nlsMetadataHash`。

### 3.3 組み込み拡張

| フォルダ | ID | displayName | 版 | ファイルの数 | 翻訳の束 |
|---|---|---|---|---|---|
| `extensions/mydist` | `sukuna.mydist` | `Sukuna の既定` | 0.0.1 | 3 | — |
| `extensions/notion-sync` | `sukuna.notion-sync` | `Sukuna Notion 同期` | 0.0.1 | 5 | `localizations` は `ja` → `{ id: sukuna.notion-sync, path: ./dist/i18n/sukuna.notion-sync.ja.i18n.json }`。束のファイルは zip にある |
| `extensions/language-pack-ja` | `sukuna.language-pack-ja` | `Sukuna 日本語パック` | 1.146.0 | 98 | `localizations` は `ja` で、`vscode` と拡張の94件 |

3つの `package.json` のどれにも `shuko` の文字は無い。

### 3.4 古い名前が残っていないか

- zip の 2,139 項目の名前に `shuko` を含むものは 0。
- ファイル 1,730 を全部ほどいて中身を調べた（バイナリも含む。大文字小文字を問わない）。`shuko` を含むものは 0（`contentScan`）。比べると、r6 の zip では 30 ファイルに含まれていた（`zip-check-baseline-r6-vs-r5.json` の `filesWithShuko`）。

## 4. r6 との差（zip の項目ごと。中央ディレクトリの CRC-32 と大きさで比べた）

- 名前を `Shuko`→`Sukuna` と読み替えると、項目の並びは r6 と同じ（r7 だけにあるもの 0、r6 だけにあるもの 0。どちらも 2,139）。
- 中身が違う項目は 71。内訳は次のとおり。
  - 名前が入るもの（33）: `Sukuna.exe`、`bin/sukuna`・`bin/sukuna.cmd`、`resources/app/product.json`・`package.json`、`node_modules.asar`、組み込み拡張3つの `package.json`・`README.md`・`ThirdPartyNotices.txt`（9）、`out/` の 18（product.json が埋め込まれる束の JS と map の 17、それに `out/date`）。
  - 大きさが同じで中身が違うもの・その1（18）: `.node` の 17 と `rg.exe`。本家のパッケージ化（`build/gulpfile.vscode.ts` の 448 行の `patchWin32DependenciesTask`）が、`**/*.node` と `**/rg.exe` に rcedit で `FileDescription`・`ProductName` = `product.nameLong` を書き込むため（473・478 行）。このうち `rg.exe` と `os_proxy_resolver.node`（どちらもビルドしない取得物）は、r5 と r6 の間では変わっていなかった。名前が変わったので今回は変わった、という説明と合う。
  - 大きさが同じで中身が違うもの・その2（20）: `@vscode/sandbox-runtime/dist/` の 18 と、`node-pty/lib/` の JS の2つ。r5 と r6 の間でも、同じものが同じ形で変わっていた（`zip-check-baseline-r6-vs-r5.json`）。作業ツリーを作り直すたびに変わるものと見ている。
  - `language-pack-ja/README.md` は 344 バイト増えた。r6 の後で README の説明を直したため（改名の実装の引き継ぎ `tasks/2026-11-18-rename-sukuna-impl/handoff-notes-meng-tian.md` の3節の5）。
- 本体のソースの差: r6 の版の commit `3e1e616a` と r7 の `b76374c6` の差は、112 ファイル、追加 179 行・削除 179 行（`git -C tmp/b/wt/rn diff --shortstat`）。改名の実装のときに当て直した作業ツリー `tmp/b/wt/rn` の HEAD と r7 の commit の間には、差が無い。改名の実装の照らし（引き継ぎの3節。178 行の組は名前だけで、残りの1組は README の1行）がそのまま当てはまる。
- `lockfile.diff` は r6 とバイト単位で同じ（SHA-256 `ef5f98ab…3862`、591,689 バイト）。
- 注: `zip-check-baseline-r6-vs-r5.json` は同じ台本の出力なので、項目の名前が「r7」「r6」のままになっている。この基準のファイルでは「r7」を r6、「r6」を r5 と読む。

## 5. 起動の確かめ（`launch-check-p5-c-all-r7.json`）

- 終了コード 0、`result: ok`。message は `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。
- `--version` の出力は `1.146.0` / `b76374c6fc633747549a7b1a44a1a5364c7fe8f2` / `x64`。VSIX は r6 と同じ6つで、すべて `successfully installed`。
- ワークベンチの3つのしるし（拡張ホストの起動、`Extension host … started`、`Eager extensions activated`）はすべて true。コンソールの `Uncaught` は 0。動いていたプロセスは `Sukuna.exe` が7つで、確かめの後にすべて止めた。
- 見張った6つの場所（`%APPDATA%\Code`・`Code - OSS`、`%USERPROFILE%\.vscode`・`.vscode-oss`、**`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`**）は、前も後も「無い」のまま。移行の台本は書き込む先が空であることを前提にしているが、その前提は崩していない（`rename-plan.md` の3.3）。
- URL の登録（`HKCU\Software\Classes\sukuna`）はしていない見込み。本家 1.146.0 の `src/vs/platform/url/electron-main/electronUrlListener.ts` の 51〜58 行が、ポータブルの形では `setAsDefaultProtocolClient` を飛ばすため（作業ツリーの `tmp/b/wt/r6/w` で読んだ。r7 も同じ本家のファイル）。レジストリそのものは見ていない。
- 展開した場所の `portable/user-data/languagepacks.json` では、`ja` の `extensions` が `sukuna.language-pack-ja` 1.146.0 と `sukuna.notion-sync` 0.0.1 になっている。`translations.vscode` は `…\Sukuna-win32-x64-1.146.0-p5-c-all-r7\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json` を、`translations["sukuna.notion-sync"]` は `…\extensions\notion-sync\dist\i18n\sukuna.notion-sync.ja.i18n.json` を指す。画面は見ていない。

## 6. 日本語の数え（`l10n-count-r7-unpacked.json`）

| パック | 全体 | 除外 | 除外の外の未訳 | `placeholderProblems` | `staleExclusions` | 結果 |
|---|---|---|---|---|---|---|
| 展開した場所の `resources/app/extensions/language-pack-ja` | 15,159 | 5 | **0** | 0 | 0 | `ok` |

- 内訳は 本体 12,334（除外 5）、package 1,258、bundle 1,545、直書き 22。どれも未訳は 0。`notJapanese` は 164 で、r6 と同じ。
- 文言の表は `tmp/l10n/strings-1.146.0-r7.json`（大きいので記録には置かない）。

## 7. 警告

| 出どころ | 中身 | 扱い |
|---|---|---|
| `checks.json` の C-2-debug | `delete: src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts が本家に無い（改名の恐れ）` | 前から毎回出るもの（r5・r6 と同じ）。`build-record.json` の `warnings` は `[]`（apply の警告は `checks.json` にだけ出る。r6 も同じ形） |
| install のログ | `deprecated glob@5.0.15`・`deprecated sinon@12.0.1`・`4 deprecated subdependencies found` | 本家の依存の知らせ。r6 のログと同じ数（警告と誤りの語を数えると、どちらも install 92・package 1） |
| package のログ | Node の deprecation の知らせ1行（`node --trace-deprecation …`） | r6 と同じ |

- `commitIdentity` は `ok`（`sukuna-apply <apply@sukuna.invalid>`）。`checks.json` に `shuko` の文字は 0。
- `sourceVersion.uncommittedEntries` は 3。r6 も 3 で、install が変える lockfile の分と見ている。

## 8. 関門で見てほしい点

1. **曹参の実物のテスト（`tests/l10n-audit-more.test.mjs` の 446〜480 行）は、そのままでは飛ばされる。** このテストは作業ツリーを `tmp/b/wt/r7` と決め打ちしていて、`tmp/b/wt/r7/extensions` が無いと飛ばす。実際の作業ツリーは `tmp/b/wt/r7/w` にある（2節の理由による）。走らせるには `AIED_AUDIT_WT=<リポジトリ>\tmp\b\wt\r7\w` を渡す。アプリ側の既定（`tmp/b/p2/1.146.0-p5-c-all-r7/Sukuna-win32-x64-1.146.0-p5-c-all-r7/resources/app`）は、今は実物がある。テストの既定を `tmp/b/wt/r7/w` に直すかどうかは曹参が決める。
2. **関門の起動は、すべてポータブルの形で行ってほしい**（`p1-launch-check.ps1`・`netaudit.ps1` は、どちらもポータブルの形で起動する）。普通に起動したり、ポータブルでない CLI を打ったりすると、移行の前に `%APPDATA%\Sukuna\User` か `%USERPROFILE%\.sukuna` ができ、移行の台本が `destNotEmpty` で止まる（`rename-plan.md` の3.3）。URL の登録も同じ理由で、移行の後に回るのがよい。
3. **作者の照らし**: r7 の `checks.json` は新しい作者 `sukuna-apply` で作られている。`tests/c*-check-json.mjs`（`tests/build/commit-author.mjs` の作者の分け方）に、この記録を渡すと通る見込み。私は打っていない。
4. **スモーク**: r6 との差は4節のとおりで、名前とビルドごとに変わるものだけのはず。実行ファイルの名前・CLI・データの場所（`.sukuna`）・AppUserModelID が変わったので、スモークの台本が名前を版の product.json から求めているかを見てほしい。
5. **外向き通信の監査**: 本体のコードの差は注釈と名前だけ（4節）なので、宛先は r6 から変わらない見込み。UA は `sukuna-build/0.1`・`sukuna-watch/0.1` に変わったが、どちらも課の道具の UA で、エディタの外向き通信には出ない。
6. **日本語の数え**: 6節の `count` は 0。曹参の網（`tests/l10n-audit.mjs`）でも、1 の環境変数を渡せば見られる。notion-sync の束の ID が `sukuna.notion-sync` に変わったので、`builtin-l10n` 系の照らしが新しい ID で引けているかも見てほしい（`languagepacks.json` には新しい ID で載っている。5節）。
7. 実行ファイルに埋め込まれた版の情報（`Sukuna.exe` の ProductName など）とアイコンは、バイト単位では確かめていない。中身が違うことだけを4節で見た。

## 9. 置いたもの（このフォルダ）

| ファイル | 中身 |
|---|---|
| `1.146.0-p5-c-all-r7/build-record.json` | ビルドの記録（`build.mjs` が書いた） |
| `1.146.0-p5-c-all-r7/build-plan.json` | 本番の前の計画（`--dry-run`） |
| `1.146.0-p5-c-all-r7/checks.json` | 適用と適用の後の検査の記録（`apply.mjs` が書いた） |
| `1.146.0-p5-c-all-r7/lockfile.diff` | ロックファイルの差（r6 と同じバイト列） |
| `zip-check-r7.json` | zip を読んで確かめた結果と、r6 との差（3節・4節） |
| `zip-check-baseline-r6-vs-r5.json` | 比べるときの基準として取った r6 と r5 の差（4節の注のとおり、項目の名前の読み替えが要る） |
| `launch-check-p5-c-all-r7.json` | 起動の確かめ（5節） |
| `l10n-count-r7-unpacked.json` | 日本語の数え（6節） |

ほかの場所に置いたもの: zip（`tmp/b/dist/`）、作業ツリーと gulp の出力（`tmp/b/wt/r7/`）、試しに展開したもの（`tmp/b/p2/1.146.0-p5-c-all-r7/`）、ビルドのログ（`tmp/b/logs/1.146.0-p5-c-all-r7/`）、文言の表（`tmp/l10n/strings-1.146.0-r7.json`）、常設の clone の枝 `builds/1.146.0-p5-c-all-r7`。

手元の道具 `scripts/trial-r7-verify.mjs` を新しく作った。使い捨てで、コミットしない（`trial-*` のほかの道具と同じ扱い）。zip を読むだけで、何も書き換えない。

## 10. していないこと

- `switch.ps1` での版のフォルダへの展開（`%LOCALAPPDATA%\Programs\Sukuna`）、`configure.ps1`、移行の台本（`-List` も含む）、拡張の導入。権限の段1の後に、リーダーの指示を受けてから行う。
- 何も消していない。前の版の zip・作業ツリー・出力は、そのまま残してある。

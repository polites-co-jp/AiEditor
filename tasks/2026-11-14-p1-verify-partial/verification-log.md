# 検証の記録: Phase 1 の途中（copilot の不具合と Smart App Control）

- 検証: 大岡越前守（2026-11-14）
- 対象: 蒙恬の `tasks/2026-11-13-p1-build-upstream/`（handoff-notes.md、build-log.md の5節、doc-corrections.md の追記、記録の JSON）と新しい台本4つ。曹参のテスト `tests/p1-scripts.test.mjs`（並行して作っているもの。曹参の handoff-notes.md は、検証を終えた時点ではまだ無かった）
- 依頼: `tasks/2026-11-14-p1-verify-partial/brief.md`
- 守ったこと: コード・台本・テストは直していない。`C:\b\wt\1.146.0` には、読むこととハッシュを取ること以外はしていない。依存の導入・ビルド・エディタの起動は走らせていない。PC の守りの設定は変えていない。

## 判定のまとめ

| # | 項目 | 判定 | 理由の要点 |
|---|---|---|---|
| 1 | copilot の不具合 | **合格**（PR の出典の部分だけ判定できない） | 2回のログとも `package-win32-x64` が通り、次の `<anonymous>`（`prepareCopilotRipgrepShimTask`）が「Copilot SDK directory not found」で落ちている。原因の行は本家のソースで確かめた。PR #347312 の番号・マージの日付・マイルストーンは、出典を開く道具が無いので確かめていない。ただし、2026-11-13 に clone した main では包み方が VSIX に変わっており、直っているという記述と合う |
| 2 | Smart App Control | **記録の確かめは合格、再現は判定できない** | エディタ自身が書いた `main.log`、イベント 3077（`VerifiedAndReputableDesktop`）、`smartAppControl: on` の記録は、互いに食い違いが無い。再現の1回は走らせていない。`scripts/p1-launch-check.ps1`・`p1-ci-events.ps1`・`check-env.ps1` を走らせる許可が無いため |
| 3 | 記録の確かめ | **所要時間・ディスク・出力の形は合格。ロックファイルと普段使いのデータは、間接の確かめだけ** | 所要時間・ディスク・出力の形は、ログ・記録・実物と一致した。`git -C C:/b/wt/1.146.0 status` は許可が無くて止められた。代わりに、pnpm のログで2回とも5つの install が「Lockfile is up to date, resolution step is skipped」だったことを確かめ、6つの SHA-256 を控えた。普段使いのデータのフォルダ（`%APPDATA%` など）は読める場所の外なので、`launch-check-partial.json` の前後の比較だけで判断した |
| 4 | 新しい台本のレビュー | **不合格** | 台本を走らせて害が出るところは無い（書き込み先と、子のプロセスへの環境変数の渡し方を確かめた）。ただし `p1-ci-events.ps1` が仕様（イベントが無いときは `readable: true`・`count: 0`）を日本語の Windows で満たさない。曹参のテストがこれを捉えて落ちた。run-all は 1500件のうち fail 1 |

## 1. copilot の不具合

### ログ（`C:\b\logs\1.146.0-upstream\package.log`・`C:\b\logs\1.146.0-upstream-r2\package.log`）

| | 1回目 | 2回目（`git clean -xfd` の後） |
|---|---|---|
| `package-win32-x64` | 19:19:07 に始まり、19:20:03 に 56340 ms で Finished | 19:31:19 に始まり、19:32:13 に 54213 ms で Finished |
| 次の手順 | `Starting <anonymous>` | 同じ |
| 誤り | `'vscode-win32-x64-min' errored after 3.93 min`、`Error: [prepareBuiltInCopilotRipgrepShim] Copilot SDK directory not found at C:\b\wt\VSCode-win32-x64\resources\app\extensions\copilot\node_modules\@github\copilot\sdk`、`at prepareBuiltInCopilotRipgrepShim (file:///C:/b/wt/1.146.0/build/lib/copilot.ts:278:9)`、`at file:///C:/b/wt/1.146.0/build/gulpfile.vscode.ts:567:3` | `errored after 4.07 min`。誤りの文は同じ |
| 終了 | `[ELIFECYCLE] Command failed with exit code 1.` | 同じ |

記録（`build-record-package.json`）の `steps[0]` は `exitCode: 1`・`seconds: 238.865` で、`tail` はログの末尾と同じだった。`build-record-r2-package.json` は `seconds: 249.529`・`exitCode: 1`。

### 本家のソース（`C:\b\wt\1.146.0`。読むだけ）

- `build/.moduleignore` の226行は `@github/copilot/**`。`!` で始まって `@github/copilot/sdk` を戻す行は無い（`copilot` を含む行を全部見た）。
- `build/lib/util.ts` の172〜188行の `cleanNodeModules` は、`!` で始まらない行を `!**/node_modules/<行>` にして外す。そのため `@github/copilot` の中身が全部外れる。
- `build/lib/extensions.ts` の546〜571行の `packageCopilotExtensionStream`（注釈は「non-CI local builds where copilot is not downloaded as a VSIX」）は、copilot の本番の依存を `.moduleignore` と `.moduleignore.win32` に通す。
- `build/lib/copilot.ts` の276〜279行は、`<拡張>\node_modules\@github\copilot\sdk` が無ければ throw する（278行が throw の行）。
- `build/gulpfile.vscode.ts` の554〜568行が `prepareCopilotRipgrepShimTask` で、567行が上の関数を呼ぶ。603〜608行の `packageTasks` は `-ci` のタスクにも入り、630〜639行の手元向けのタスクだけが `compileCopilotExtensionBuildTask` を先に走らせる。
- 実物で確かめたこと:
  - 作業ツリーの `extensions\copilot\node_modules\@github\copilot\sdk\` にはファイルが37ある。
  - `.build\extensions\copilot\node_modules\@github\copilot\` の下にはファイルが無い。
  - 出力の `resources\app\extensions\copilot\node_modules\@github\` の下にあるのは `blackbird-external-ingest-utils` だけで、`copilot` は無い。
- CI の道: `build/azure-pipelines/product-copilot.yml` と `build/azure-pipelines/common/downloadCopilotVsix.ts` があることを確かめた。
- 出力の場所が直下になること: `getVersionedResourcesFolder`（`util.ts` の376〜380行）は `product.json` の `win32VersionedUpdate` を見る。作業ツリーの `product.json` にこのキーは無い。

### PR #347312（判定できない部分）

- この役には Web の道具が無い。また Bash の許可に `curl`・`gh` が無い。このため、PR の番号・マージの日付（2026-11-10）・マイルストーン（1.147.0）・説明の文は、出典を開いて確かめていない。
- 代わりの裏づけ: 常設の clone `C:\b\vscode`（`logs/HEAD` によれば 2026-11-13 21:41 JST に clone し、main を checkout）の `build/lib/extensions.ts` の543〜576行では、`packageCopilotExtensionStream` が `.build/copilot-vsix/copilot-chat.vsix` を作って展開する形になっており、`.moduleignore` を通さない。main でも `.moduleignore` の226行（`@github/copilot/**`）と `copilot.ts` の throw（280行）は残っている。つまり、包み方を VSIX に変えたことで直った、という記述と合う。

## 2. Smart App Control

### 記録の突き合わせ

- `launch-check-partial.json`（19:32:25）:
  - `cliVersion` は終了コード 0 で「1.146.0 / Unknown commit / x64」。
  - `started.aliveAfterCheck` は false、`exitCode` は 1（`checkSeconds` は 10）。
  - `result` は `error`、`message` は「the editor ended within the check (exit code 1)」。
- `C:\b\p1\1.146.0-upstream-partial\portable\user-data\logs\20261114T193232\main.log` は、エディタ自身が書いたもので、蒙恬の台本の出力ではない。19:32:34.827 に `[error] Error: An Application Control policy has blocked this file.` と書かれ、対象は `\\?\C:\b\wt\VSCode-win32-x64\resources\app\node_modules.asar.unpacked\@vscode\windows-registry\build\Release\winregistry.node`。呼び出し元は `@vscode\windows-registry\dist\index.js` で、`mainImpl.js` の startup から呼ばれている。
- `ci-events.json`:
  - 19:32:34.457 に ID 3077 が出ている。`process` は `...\b\wt\VSCode-win32-x64\Code - OSS.exe`、`file` は上の `winregistry.node`、`policy` は `VerifiedAndReputableDesktop`。メッセージの Policy ID は `{0283ac0f-fff1-49ae-ada1-8a933...`（以降は台本が切り詰めている）。
  - 同じ時刻に ID 3033 もある。
  - 時刻は main.log の誤りと同じ秒。
- `env-check-after.json`（19:33:10）: `smartAppControl` は `{ verifiedAndReputablePolicyState: 1, meaning: "on" }`。
- `winregistry.node` がこの PC でビルドされたものであること: `C:\b\logs\1.146.0-upstream-r2\install.log` の751〜783行に `node_modules/@vscode/windows-registry install$ node-gyp rebuild`、node-gyp 12.3.0、VS2026 がある。出力の中にも同じ名前のファイルがあることを確かめた。
- 時刻の順: 2回目のパッケージ化は 19:32:13 に落ち、起動は 19:32:32。起動したのは2回目の出力である。

### 再現（走らせていない）

- 依頼の `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Root C:/b/wt/VSCode-win32-x64 -Dest C:/b/p1/<新しい名前>` は、この役の許可に無い。許可にある PowerShell は `tests/*.ps1`・`scripts/measure.ps1`・`scripts/netaudit.ps1` だけ。`p1-ci-events.ps1`・`check-env.ps1` も同じく許可に無い。回り道はしていない。
- このため、今の Smart App Control の状態も直接は読んでいない。曹参のテスト（`check-env.ps1` を走らせ、`state` と `meaning` が対応するかを見るもの）は通ったが、値はテストの出力に出ない。

## 3. 記録の確かめ

### 所要時間（記録とログを照らした）

| 手順 | 記録 | 照らしたもの | 一致 |
|---|---|---|---|
| 導入（1回目） | 278.06 秒。全体は 299 秒 | `startedAt` 10:09:26.836Z と `finishedAt` 10:14:25.535Z の差は 298.7 秒。ログは「Done in 4m 37.9s」 | 一致 |
| 導入（2回目） | 173.789 秒 | ログは「Done in 2m 53.7s」。postinstall の4つは 55秒・56.8秒・1分16.6秒・1分43.9秒 | 一致 |
| postinstall（1回目） | 2分23秒・1分54秒・1分35秒・1分38秒 | ログは build 2m 23s、remote 1m 53.5s、extensions 1m 34.5s、extensions/copilot 1m 37.5s | 一致 |
| 型検査 | 21.213 秒・19.34 秒、終了コード 0 | `typecheck.log` には script の行だけがあり、誤りの行は無い | 一致 |
| パッケージ化 | 238.865 秒・249.529 秒 | gulp の 3.93 分・4.07 分。手順ごとの時間（1160・5810・63112・3636・105344・717・56340 ms）は build-log の表と同じ | 一致 |

### ディスク

- `disk-*.json` の C: の空きは 90.65 → 85.28 → 82.32 → 82.16 GB で、減りは 5.37・2.96・0.16 GB。build-log の 5.9 と一致した。
- `disk-after-r2.json` の作業ツリーは、bytes 6,587,800,530（6.14 GB）、unique 5.22 GB、215,646 ファイル、hard link 172,786。出力は 1.4 GB・20,325 ファイル。どれも build-log と一致した。
- 出力のファイル数は、Glob で数えても 20,325 だった。

### 出力の形（`C:\b\wt\VSCode-win32-x64\`）

- 直下に `Code - OSS.exe` がある。`resources\app\product.json` も直下にあり、`<commit10>` の階層は無い。`bin\code-oss.cmd`・`bin\code-oss`・`bin\copilot-shim\copilot` もある。`resources\app\LICENSE.txt`・`ThirdPartyNotices.txt` もある。
- `product.json` は、`nameShort`・`nameLong` が `Code - OSS`、`applicationName` が `code-oss`、`dataFolderName` が `.vscode-oss`、`version` が 1.146.0。トップレベルに `commit` は無い。
- 記録と一致した。

### 6つの `pnpm-lock.yaml`

- `git -C C:/b/wt/1.146.0 status --porcelain` は、許可のフックに止められた（「ホワイトリストに無いコマンドです」）。直接は確かめていない。
- 間接の確かめ: 2回の `install.log` で、ルート・`extensions`・`extensions/copilot`・`remote`・`build` の5つが、どれも「Lockfile is up to date, resolution step is skipped」だった（1回目は43・1189・1382・1612・2314行、2回目は17・1121・1353・1531・2222行）。`test/sanity` は install の対象ではなかった（ログに `sanity` が出てこない）。
- 作業ツリーの HEAD は `C:\b\vscode\.git\worktrees\1.146.0\HEAD` で `69047191fc427f2f92828279aae1d90d8eeda7ab` のまま。
- 後で比べるための SHA-256（2026-11-14、`sha256sum`）:

```
38aeff89c0448763151b5252b4c5215c2e70e26ba560ef6cc06cfce041b771b4  pnpm-lock.yaml
a03d529c3ace34f04898e833f979ec728e7bc162e42bdf141d50bd54fa62d058  build/pnpm-lock.yaml
b25012048d04fe129707a2c46d73048d855a22769e124d2888ab52e1cee2537e  extensions/pnpm-lock.yaml
462af7565ad695d3b8c2a473adfc3a84383330a993be02dd8170f3e1e338d23a  extensions/copilot/pnpm-lock.yaml
6d8350134dfc8e4dd9900b519676b9da93676c7b5f3a4d3f4629f707ab744f65  remote/pnpm-lock.yaml
83704713f21e7dc6cea53c0872d10c8f3a96d7019c126152383ab95fbc1988c6  test/sanity/pnpm-lock.yaml
```

- postinstall が常設の clone の設定に書いた値: `C:\b\vscode\.git\config` の19〜22行に、`[pull] rebase = merges` と `[blame] ignoreRevsFile = .git-blame-ignore-revs` がある。build-log の 5.3 の4と一致した。

### 普段使いのエディタのデータ

- `launch-check-partial.json` の `dailyData` では、`%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` の4つが、前も後も `exists: false` で、`changed` は空だった。`nameLong` と `dataFolderName` から作る場所は上の4つと重なるので、重複を除いて4つになる。
- この役の読める場所は `./` と `C:/b/` だけなので、今のフォルダを直接は見ていない。
- 起動はポータブルの置き場所 `C:\b\p1\1.146.0-upstream-partial\portable\` に `user-data\`・`extensions\`・`argv.json` を作った（記録と、実物の `main.log` の場所が一致する）。

## 4. 新しい台本のレビュー

### 害の有無（読んで確かめた）

| 台本 | 書き込み先 | 子のプロセスと環境変数 | 判定 |
|---|---|---|---|
| `scripts/disk-usage.mjs` | `--out` に渡したファイルだけ（親のフォルダを作る）。数える側は `readdirSync`・`statSync` だけ | 子のプロセスは無い。シンボリックリンクとジャンクションはたどらない（71行。`withFileTypes` の `isSymbolicLink`） | 害なし |
| `scripts/p1-launch-check.ps1` | `-Dest`（`C:\b\p1\` の下に限る。54行の `Assert-P1Path`）と `-OutFile`。`-Root` は `C:\b\` の下に限る（75行） | `Invoke-P0WithEditorEnv`（`scripts/lib/p0-common.ps1` の372〜390行）。`ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外し、`VSCODE_PORTABLE` だけを渡して、終わったら元に戻す（finally）。止めるのは、自分が起動したプロセスとその子孫だけ | 害なし |
| `scripts/p1-ci-events.ps1` | `-OutFile` だけ。`Get-WinEvent` で読むだけ | 子のプロセスは無い | 害なし |
| `scripts/check-env.ps1` の差分 | 追加は `HKLM:\...\CI\Policy` の `VerifiedAndReputablePolicyState` を `Get-ItemProperty` で読む10行だけ（書かない）。`missing` には入れない | 変更なし | 害なし |

### 仕様に合わない点（不合格の理由）

- `scripts/p1-ci-events.ps1` の54行: `if ($_.Exception.Message -match 'No events were found') { $out.readable = $true } else { $out.error = $_.Exception.Message }`
  - 英語の文言と照らしている。この PC の Windows では、`Get-WinEvent` の「当たるイベントが無い」の例外の文言が日本語（「指定された選択条件に一致するイベントは見つかりませんでした。」）になる。そのため `readable: false` になり、`error` にその文言が入る。
  - 仕様（handoff-notes の「イベントが無いときは `readable: true`・`count: 0`」）に合わない。
  - 曹参のテスト「p1-ci-events.ps1: 当たるイベントが無いとき readable:true・count 0（仕様。日本語の Windows でも）」が、これで落ちた。
  - 直し方の案（蒙恬）: 例外の文言でなく、言語によらない ID（`$_.FullyQualifiedErrorId` が `NoMatchingEventsFound` で始まるか）で見分ける。
  - 2節の記録（`ci-events.json`）への影響は無い。そのときはイベントが2件あって、この経路を通っていない。

### 気づいた点（不合格の理由ではない）

1. `p1-launch-check.ps1` の普段使いのデータの比較は、フォルダの有無と、フォルダ自体の更新時刻だけを見る。フォルダの中のファイル（例: `User\settings.json`）が書き換わっても、更新時刻は変わらないことがある。今回は4つとも無かったので、有無の比較で足りている。普段使いのデータのフォルダが既にある PC で使うときは、検出が弱い。
2. `p1-ci-events.ps1` の標準出力は、子のプロセスとして読むとコードページの違いで日本語が化ける（テストの `error` の表示が化けた）。`-OutFile` は UTF-8 なので、記録には響かない。
3. docs との食い違いで、蒙恬の doc-corrections の A8 に入っていないものがある。`docs/02-repository-and-build.md` の157行（6節）「署名はしない。手元でビルドしたものにはダウンロードの印が付かないので、SmartScreen は出にくい（推定）」は、Smart App Control がオンの PC では成り立たない。A8 は02の5節と07の4節だけを挙げているので、この行も直す先に足す必要がある。

### テスト（曹参の `tests/p1-scripts.test.mjs`）

- 単独で `node --test tests/p1-scripts.test.mjs` を走らせた。27件で、pass 26、fail 1（上の1件）。
- テストの中身を読んだ。仕様（handoff-notes の「テストの入口」）を緩めていない。落ちた1件は台本の誤りを正しく捉えている。
  - `p1-launch-check.ps1` の8件は、どれも引数の誤りで断る経路だけを通る。エディタは起動しない。`-Dest` の外の件は「何も作らない」まで見る。
  - 一時フォルダは `C:\b\tests-p1-*` に作り、`removeSandbox` で消す。リンクの先も一時フォルダの中にある。
- 最後に `node tests/run-all.mjs --save tasks/2026-11-14-p1-verify-partial/run-all-output.txt` を走らせた。終了コードは 1。

```
p1-scripts.test.mjs                tests   27  pass   26  fail   1  skip   0
measure.tests.ps1                  tests  138  pass  138  fail   0  skip   0  exit 0
netaudit.tests.ps1                 tests  102  pass  102  fail   0  skip   0  exit 0
TOTAL                              tests 1500  pass 1478  fail   1  skip  21

Failing:
  p1-scripts.test.mjs: p1-ci-events.ps1: 当たるイベントが無いとき readable:true・count 0（仕様。日本語の Windows でも）
```

  - 前回（`tasks/2026-11-14-p2-verify-prebuild/run-all-result-3.txt`）の 1473件から、`p1-scripts.test.mjs` の27件が増えた。ほかのファイルの件数と結果は前回と同じ。skip 21 は `removals.test.mjs` の21単位が `enabled: false` であるため。
  - 全体の出力は `run-all-output.txt` にある。

## 権限が足りなかったもの（リーダーへ）

| 要るもの | 何のため |
|---|---|
| `git -C C:/b/wt/1.146.0 status`（`--porcelain` を含む） | 依頼の3。6つの `pnpm-lock.yaml` が変わっていないことを直接確かめるため |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1` | 依頼の2。Smart App Control が起動を止めることを1回だけ再現するため |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1` と `.../scripts/check-env.ps1` | 依頼の2。再現の後にイベント 3077 と今の状態を読むため |
| Web を読む道具（WebFetch など） | 依頼の1。PR #347312 の番号・日付・マイルストーンを出典で確かめるため |
| 読める場所に `%APPDATA%`・`%USERPROFILE%` の4つのフォルダ（有無だけ） | 依頼の3。普段使いのデータのフォルダに触れていないことを、記録によらず確かめるため |

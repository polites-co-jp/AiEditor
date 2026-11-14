# 検証の記録: Phase 1（p1-ci-events の直しと、A-1 を当てた 1.146.0 のビルド・zip・起動）

- 検証: 大岡越前守（2026-11-14）
- 対象: 蒙恬の `tasks/2026-11-14-p1-build-a1/`（handoff-notes.md、build-log.md、記録の JSON）、`scripts/p1-ci-events.ps1` の直し、作業ツリー `C:\b\wt\p1-a1`、出力 `C:\b\wt\VSCode-win32-x64\`、zip `C:\b\dist\1.146.0-p1-a1-r2.zip`、展開先 `C:\b\p1\1.146.0-p1-a1-r2\`。曹参のテスト `tests/p1-scripts.test.mjs`
- 依頼: `tasks/2026-11-14-p1-verify-a1/brief.md`
- 守ったこと: コード・台本・テストは直していない。依存の導入・ビルド・エディタの起動は走らせていない。PC の設定は変えていない。書き込みは `records/phase1/` とこのフォルダだけ。

## 判定のまとめ

| # | 項目 | 判定 | 理由の要点 |
|---|---|---|---|
| 1 | 直し（`p1-ci-events.ps1`） | **合格** | 53〜57行の `catch` は、`FullyQualifiedErrorId` が `NoMatchingEventsFound*` かで見分ける（例外の文言を見ない）。日本語の Windows で `node --test tests/p1-scripts.test.mjs` を2回走らせ、2回とも 27/27。前回落ちた1件も通った。`node tests/run-all.mjs` は TOTAL 1500・pass 1479・**fail 0**・skip 21（前回は fail 1） |
| 2 | 当てたもの | **合格** | `take-in-r2/checks.json` で、当たったのは A-1 と mydist だけ。上書き（set・remove が空）・patches（空）・assets（`none`）・notion-sync（写していない）は当たっていない。作業ツリーで本家と違うのは、A-1 が触るファイル（`package.json`・`build/npm/dirs.ts`・`build/npm/postinstall.ts`・`build/lib/copilot.ts`）だけ。`product.json` などは本家とハッシュが一致した |
| 3 | ビルド | **合格** | `build-record-r2.json` の6手順（install・lockfile・typecheck・package・postprocess・zip）がどれも `ok`・終了コード 0 で、ログに誤りの行が無い。所要時間・ディスクの値は記録どうしで一致した。zip の SHA-256 は計算し直して一致した。A-1 の検査（`remnants`・`absentStrings`・`unclassifiedExtensions`・`registeredKeys`・`lockfile`）は ok |
| 4 | 起動 | **合格** | `launch-check.json` は `result: ok`。10 秒の確かめと 15 秒の待ちの後も生きていた（台本は待ちの後にもう一度 `HasExited` を見る）。止められたのは deviceid・keymapping・iselevated の3つ（`ci-events.json`、ポリシー `VerifiedAndReputableDesktop`）。`main.log` の誤りは、deviceid の2回と AgentHost の wasm だけ。展開したエディタは出力と同じもの（ハッシュが一致）。普段使いのデータは前後とも無い（記録による） |
| 5 | Phase 1 の関門（2つの条件） | **合格** | 「zip から起動する」「所要時間とディスクの記録がある」を満たす。Claude Code の組は対象外（Smart App Control をオフにした後に行う）。関門の記録は `records/phase1/gate-1.146.0-p1-a1.md` |

## 1. 直し（`scripts/p1-ci-events.ps1`）

### 1.1 差分

台本は git にまだ入っていない（`git status` で `??`）。前回の検証で見た54行（`$_.Exception.Message -match 'No events were found'`）は、次の3行（54〜56行）になった。

```
# No events: Get-WinEvent throws with FullyQualifiedErrorId "NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand".
# Match the id, not the message (the message is localized, e.g. Japanese Windows).
if ([string]$_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $out.readable = $true } else { $out.error = $_.Exception.Message }
```

- 言語によらない: `FullyQualifiedErrorId` は誤りの種類を表す ID で、訳されない。訳される `Exception.Message` は見なくなった。
- ほかの誤り（ログが無い・読む権限が無いなど）は、これまでどおり `readable: false` になり、`error` に理由が入る。
- ASCII 以外の文字は 0（Grep で `[^\x00-\x7F]` が 0 件）。入口（引数）と出力の形は変わっていない。

### 1.2 テスト

```
node --test tests/p1-scripts.test.mjs
```

tests 27 / pass 27 / fail 0（約 13.9 秒。2回目は約 14.5 秒で同じ結果）。前回落ちた「p1-ci-events.ps1: 当たるイベントが無いとき readable:true・count 0（仕様。日本語の Windows でも）」が通った。

- このテストは `-Minutes 1 -Filter no-such-text-zzqq-91827` で台本を走らせ、`count: 0` と `readable: true` を求める。前回は、元の台本でこのテストが落ちた（`tasks/2026-11-14-p1-verify-partial/`）。落ちるべきときに落ちることは、前回の結果で確かめてある。
- テストは仕様（イベントが無いときも読めている）を緩めていない。

### 1.3 run-all

```
node tests/run-all.mjs --save tasks/2026-11-14-p1-verify-a1/run-all-output.txt
```

終了コード 0。**TOTAL 1500、pass 1479、fail 0、skip 21**（skip は前回と同じ removals.test.mjs の21件）。前回（fail 1）との違いは、p1-scripts.test.mjs が 26 → 27 通ったことだけ。ほかのファイルの件数は、前回の `tasks/2026-11-14-p1-verify-partial/run-all-output.txt` と同じ。出力は `run-all-output.txt`。保存しない形でも2回走らせ、どちらも終了コード 0 だった。

**notion-sync の途中の状態に当たった。** 走らせた時点の `extensions-src/notion-sync/` には、蒙恬の直しの途中の変更があった。`git diff --stat` は3ファイル、5行の追加と8行の削除。

- `package.json`: `jsonc-parser` が `dependencies` から `devDependencies` に移った。
- `pnpm-lock.yaml`: これに合う変更。
- `README.md`: 表の1行。

run-all の中の `cli-run.test.mjs`（notion-sync を一時の場所に写し、`pnpm install --frozen-lockfile` と `pnpm run build` を行うテストを含む）、`notion-sync.test.mjs`（101件）、`apply-parts.test.mjs` は、この途中の状態で走って、どれも通った。走らせている間に、この3ファイルの SHA-256 は変わらなかった（前後で `package.json` `5a81f11e…`、`pnpm-lock.yaml` `f78fadc8…`、`README.md` `5b70603a…`）。この結果は、notion-sync の直しの検証を兼ねるものではない（直しが終わった後に、改めて確かめる必要がある）。

## 2. 当てたもの

### 2.1 `take-in-r2/checks.json`

| 項目 | 値 |
|---|---|
| `options.only` | `["A-1-copilot-extension"]` |
| `inputs.overlay` | `a1-inputs/overlay-empty.json`。`overlay.set`・`removed`・`removedIfPresent` は空 |
| `inputs.patches` | `a1-inputs/patches-none`。`patches` は `[]` |
| `inputs.assets` | `a1-inputs/assets-none`。`assets.applied` は `none`、`copied` は空 |
| `inputs.extensionsSrc` | `a1-inputs/extensions-src`。`builtinExtensions.copied` は mydist（3ファイル）だけ |
| `units[0]` | A-1、`enabled: false`（書き換えていない。`git status` で `removals/` に変更なし）、`applied: ok`。`delete` は2つ（`extensions/copilot`・`extensions/prompt-basics`）、`removeLines` は8行とも found 1、`edits.applied: ok`・衝突なし |
| `unitsSkipped` | ほかの20単位は「not in --only」 |
| `result` | `ok`。`warnings`・`errors` は空 |
| コミット | 4つ（overlay・A-1 ops・A-1 edits・builtin extensions）。作者・コミッターとも `shuko-apply <apply@shuko.invalid>`（`commitIdentity: ok`） |

1回目（`take-in/checks.json`）との違いは、`builtinExtensions` に notion-sync があるかどうかだけ（1回目は mydist と notion-sync、2回目は mydist だけ）。

### 2.2 作業ツリー `C:\b\wt\p1-a1` の差分（読める範囲）

`git -C` と `git diff --no-index` は、この役の許可に無い。代わりに、無改造の作業ツリー `C:\b\wt\1.146.0`（HEAD `69047191...`。`C:\b\vscode\.git\worktrees\1.146.0\HEAD` で確かめた）と、同じファイルの SHA-256 を比べた。

| ファイル | 本家と | A-1 が触るか |
|---|---|---|
| `package.json` | 違う | 触る（removeLines の6行と edits.patch） |
| `build/npm/dirs.ts` | 違う | 触る（removeLines の2行） |
| `build/npm/postinstall.ts` | 違う | 触る（edits.patch） |
| `build/lib/copilot.ts` | 違う | 触る（edits.patch の3行） |
| `product.json` | **同じ** | 触らない（上書きを当てていない） |
| `build/lib/extensions.ts`・`build/gulpfile.vscode.ts`・`build/gulpfile.extensions.ts`・`extensions/pnpm-workspace.yaml`・`pnpm-lock.yaml` | 同じ | 触らない |

違うファイルは、中身も読んで確かめた。

- `build/npm/dirs.ts`: 本家の44行 `'extensions/copilot',` と99行 `'extensions/copilot': [...]` が無い（注釈の36行だけが残る）。
- `package.json`: `compile-copilot`・`watch-copilot`・`watch-copilotd`・`kill-watch-copilotd`・`copilot:setup`・`copilot:get_token` が無く、`compile`・`watch`・`watch-transpile` からも外れた。ファイルは6行短い。`@github/copilot-sdk`・`@vscode/copilot-api`・`copilotRuntimeVersion`（C-1 で消すもの）は残っている。
- `build/npm/postinstall.ts`: `ensureAgentHarnessLink`・`.claude`・`copilot-instructions` が0件。
- `build/lib/copilot.ts`: 269〜271行に `if (!fs.existsSync(builtInCopilotExtensionDir)) { return; }` がある。
- `extensions/`: `copilot`・`prompt-basics`・`notion-sync` が無く、`mydist` がある。拡張は 94（本家の 95 から2つ減り、mydist が1つ増えた）。
- 作業ツリーの HEAD は `72f454338508f617631589f6f3f6cfc1aff1ca8b`（`C:\b\vscode\.git\worktrees\p1-a1\HEAD`）で、`checks.json` の `headCommit` と一致した。

比べたファイルには、A-1 の `unit.json`・`edits.patch` の範囲の外の変更は無かった。作業ツリーのすべてのファイルは比べていない（`git status` を直接見る許可が無い）。

### 2.3 mydist の写し

`a1-inputs/extensions-src/mydist/` の `package.json`・`README.md` は、`extensions-src/mydist/` と同じハッシュ。`ThirdPartyNotices.txt` は文面が同じで、改行だけが違う（元は CRLF と LF が混ざっていて、CRLF の行が9つ。写しは LF だけ）。作業ツリーと出力には、写しの方（LF だけ）が入った。A-1 の検査には響かないが、build-log.md の「写した」は、厳密にはバイト単位の一致ではない（気づいた点）。

## 3. ビルド

### 3.1 手順（`build-record-r2.json`）

| 手順 | 状態 | 終了コード | 秒 | ログ |
|---|---|---|---|---|
| install（`pnpm install --no-frozen-lockfile`） | ok | 0 | 2.453 | `install.log` は39行。「Lockfile is up to date」。誤りの行は無い |
| lockfile | ok | 0 | 0.504 | 5つが `unchanged: true`、`extensions/copilot/pnpm-lock.yaml` は `removed`。`lockfile.diff` の中身は、そのファイルの削除だけ |
| typecheck（`typecheck-client`） | ok | 0 | 18.501 | `typecheck.log` は `tsc` の1行だけ（誤りは無い） |
| package（`gulp vscode-win32-x64-min`） | ok | 0 | 156.56 | `package.log` の131行に「Finished 'vscode-win32-x64-min' after 2.57 min」。77行の `compile-copilot-extension-build` は 1 ms、126行の `<anonymous>` も 1 ms。errored は無い |
| postprocess | ok | — | 0.01 | 組み込み拡張は 93（residual 0、missingKeep 0、missingOwn 0）。removed に copilot・prompt-basics |
| zip（System32 の `tar.exe`） | ok | 0 | 35.493 | 3,190 項目、最上位は `Code-OSS-win32-x64-1.146.0-p1-a1-r2` だけ |

- 出力の拡張のフォルダを数えた。93 で、内訳は本家の拡張から copilot・prompt-basics と試験用の4つを除いた89、mydist、marketplace の3つ。postprocess の `presentCount: 93` と一致する。copilot・prompt-basics・notion-sync は無い。
- 1回目の落ち方（`build-record-package.json` の status error・exitCode 1、`C:\b\logs\1.146.0-p1-a1\package.log` の16〜17行）: notion-sync の `dependencies`（jsonc-parser）を、`fromLocalNormal` が止めた。原因の行は `C:\b\wt\p1-a1\build\lib\extensions.ts` の162〜172行で確かめた。A-1 とは関係が無い。

### 3.2 所要時間

| 手順 | 秒 | 出どころ |
|---|---|---|
| 作業ツリーの用意 | 27.7 | `prepare.json`（11:02:23.5Z〜11:02:51.3Z） |
| 適用 | 7.2 | `take-in-r2/checks.json`（11:10:23.2Z〜11:10:30.4Z） |
| 依存の導入 | 164.0 | `build-record-install.json`（1回目、163.961） |
| ロックファイルの検査 | 0.5 | `build-record-r2.json` |
| 型検査 | 18.5 | 同上 |
| パッケージ化 | 156.6 | 同上 |
| zip | 35.5 | 同上 |
| 合計 | 410.0（6.83 分） | 足し算は build-log.md の 3.7 と一致 |

- 合計は、1回目の導入（notion-sync を含む作業ツリー）と、2回目のほかの手順を足したもの。導入の中身は少し違う（2回目の導入で、extensions の依存が「+3 -61」になった）が、導入の時間の目安としては足りる。
- build-log.md の 3.4 の「20:10:49〜20:14:35」は、`startedAt`・`finishedAt` と一致する。

### 3.3 ディスク

| 時点 | C: の空き | 出どころ |
|---|---|---|
| 作業ツリーを作る前 | 81.15 GB（87,136,555,008 バイト） | `disk-before.json` |
| 1回目の導入の後 | 79.61 GB | `disk-after-install.json` |
| zip の後 | 78.82 GB（84,629,241,856 バイト） | `disk-after-zip.json` |
| 展開と起動の後 | 77.6 GB | `env-check.json` |

- 作業ツリーを作る前から zip の後までの減りは 2,507,313,152 バイト（2.33 GB）で、build-log.md の「2.3 GB」と一致する。
- 作業ツリー 4.50 GB（uniqueGB 3.86、131,106 ファイル、hard link 109,681）、出力 1.18 GB・2,612 ファイル、zip 0.38 GB は、`disk-after-zip.json` と `build-record-r2.json` の `disk` で一致する。作業ツリーだけはバイト数が 41、ファイル数が1つ違うが、数えた時刻の差によるもので、害は無い。
- pnpm の store（3.46 GB）と Electron（0.91 GB）は、前後でバイト数まで同じ。

### 3.4 zip の SHA-256

```
sha256sum C:/b/dist/1.146.0-p1-a1-r2.zip
9348d66c02d84deb8c0b5aa9da7adbff82f1d9eed9a756e8c8619008910c32b1 *C:/b/dist/1.146.0-p1-a1-r2.zip
```

`build-record-r2.json` の `zip.sha256`、build-log.md と handoff-notes.md の値と一致する（3回計算して3回とも同じ）。バイト数 406,720,616 も、`disk-after-zip.json` の dist と一致する。

### 3.5 A-1 の検査（`checks.json` の `checks`）

| 検査 | 結果 |
|---|---|
| remnants | ok（items 0） |
| absentStrings | ok。5つ（`'extensions/copilot'`・`-C extensions/copilot`・`watch-copilot`・`ensureAgentHarnessLink`・`copilot-instructions.md`）とも hitCount 0。検証役も作業ツリーを Grep して、`dirs.ts`・`package.json`・`postinstall.ts` に0件であることを確かめた |
| unclassifiedExtensions | ok（本家 95、未分類 0） |
| registeredKeys | ok（mydist の設定 11 が、本家・拡張・台帳のどこかにある） |
| lockfile | ok（3.1） |
| commitIdentity | ok |
| upstreamAdditions・dependencies・toolchain | skipped / info（`--prev-tag` が無いため。Phase 1 には前のタグが無いので妥当） |

`absentCommands`・`absentViews`・`absentSettings`（画面で見るもの）は、この関門では見ていない。docs/03 の7節の単位の関門（A-1 を `enabled: true` にする条件）は、スモークの後に別に確かめる。

## 4. 起動

### 4.1 `launch-check.json`

| 項目 | 値 |
|---|---|
| 結果 | `ok`。「started, stayed alive, stopped; daily editor data folders unchanged」 |
| 展開 | 16.1 秒。`C:\b\p1\1.146.0-p1-a1-r2\Code-OSS-win32-x64-1.146.0-p1-a1-r2\` |
| CLI | `bin\code-oss.cmd --version` が終了コード 0、「1.146.0 / Unknown commit / x64」 |
| 起動 | `aliveAfterCheck: true`、`exitCode: null`、10 秒＋15 秒、`Code - OSS.exe x8`、8つとも止めた |
| ポータブル | `portableOk: true`。`extensions\`・`shared-data\`・`user-data\`・`argv.json` ができた |
| 普段使いのデータ | 4つとも前後で `exists: false`、`changed` は空 |

- 「25 秒後も生きていた」: 台本（`scripts/p1-launch-check.ps1` の153〜159行）は、10 秒の確かめの後に `-SmokeSeconds` だけ待ち、もう一度 `-not $p.HasExited` を `aliveAfterCheck` に入れる。これが `true` なので、25 秒の時点で生きていた。
- `agenthost.log` の最後の行は 20:15:56.630 で、ログのフォルダ名（`20261114T201530`）から 25 秒あまり後まで書かれている。生きていたことと合う。一方、build-log.md の4節の見出しにある「20:15:12〜20:15:45」の終わりの時刻は、ログより 10 秒ほど早い（記録の小さなずれ。判定には響かない）。
- 起動したのは今回の zip のもの: 展開先と gulp の出力で、`Code - OSS.exe`・`resources\app\product.json`・`node_modules.asar`・`out\main.js` の SHA-256 が一致した。
- 普段使いのデータの4つの場所は、この役が読める場所の外にある。そのため、`launch-check.json` の前後の記録だけで判断した。

### 4.2 止められたモジュール（`ci-events.json`）

`readable: true`、`error: null`、`count: 6`。20:01:06 以降の分。3つのファイルについて、ID 3033 と 3077 が1件ずつ。

| 時刻 | ファイル（`resources\app\node_modules.asar.unpacked\` の下） | 3077 のポリシー |
|---|---|---|
| 20:15:34.79 | `@vscode\deviceid\build\Release\windows.node` | `VerifiedAndReputableDesktop` |
| 20:15:37.05 | `native-keymap\build\Release\keymapping.node` | `VerifiedAndReputableDesktop` |
| 20:15:39.50 | `native-is-elevated\build\Release\iselevated.node` | `VerifiedAndReputableDesktop` |

- 6件とも、今回の `Code - OSS.exe` が、今回の展開先のファイルを読み込もうとしたもの。
- `winregistry.node` はイベントに無い。展開先にはある（`.node` は全部で 20。Glob で確かめた）。build-log.md の 4.1 と同じ。止められなかった理由は確かめられていない（蒙恬の未解決の3）。
- 気づいた点: ID 3033 の行は `file`・`process`・`policy` が `null` になる（3033 のイベントは、データの名前が 3077 と違うため。ファイルの名前は `message` には入っている）。台本の仕様（3033 も一覧に出す）には反しないが、3033 のファイル名が要る人は `message` を読む必要がある。

### 4.3 ログ（`C:\b\p1\1.146.0-p1-a1-r2\portable\user-data\logs\20261114T201530\`）

`main.log`（106行）:

| 行 | 中身 |
|---|---|
| 2・56 | `[error] Error: An Application Control policy has blocked this file.`（`@vscode\deviceid\...\windows.node`。`deviceid\dist\storage.js:34` から）。その後も 49〜55行で共有のストレージを作り、AgentHost を始めている |
| 103・105 | `[AgentHost:stderr] ... ENOENT ... @vscode\tree-sitter-wasm\wasm\tree-sitter.wasm`（本体の AI のエージェントのホスト。C-1 で消す部品） |

`main.log` には、ほかに `[error]` の行は無い。keymapping と iselevated は `main.log` に誤りを出していない（build-log.md のとおり）。

ほかのログの `[error]` は全部で3つ。

- `window1\renderer.log` の80行「No default agent contributed」
- `remoteTunnelService.log` の1行「Missing 'tunnelApplicationConfig'…」
- `agenthost.log` の35行「[ProtocolServer] Request 'listSessions' id=2 failed Unable to resolve @github/copilot SDK runtime paths. Tried: …\@github\copilot-sdk-win32-x64\prebuilds\win32-x64\copilot-runtime.exe …」

最初の2つは build-log.md の 4.2 にある。`agenthost.log` の行は build-log.md に載っていない。本体の AI（C-1 で消す部品）の誤りで、起動は続いた（気づいた点）。`window1\exthost\exthost.log` に、error・fail の行は無い。

## 5. 判定（docs/07 の4節の完了の条件）

| 条件 | 判定 | 根拠 |
|---|---|---|
| zip から起動する | **満たす** | A-1 を当てた 1.146.0 の zip（SHA-256 一致）を展開し、`Code - OSS.exe` が 25 秒後も生きていた。CLI も動いた。裁定（2026-11-14）により、1.146.0 では A-1 と合わせて満たせばよい |
| 所要時間とディスクの記録がある | **満たす** | 各手順の秒（3.2）と、C: の空きの減り、作業ツリー・キャッシュ・出力・zip の大きさ（3.3）が記録にあり、記録どうしで一致した |
| Claude Code の組が通る | 対象外 | brief の5のとおり。Smart App Control をオフにした後に行う |

## 6. 食い違いと気づいた点（合否には響かない）

1. `build-record-r2.json` の `units` が `[]` になっている。`build.mjs` は、apply の手順を自分で走らせたときだけ `units` を埋める（612行）。今回は `apply.mjs` を別に走らせて `--from install` にしたので、空になった。A-1 が当たったことは、同じ記録の `postprocess.extensions.unitIds`（`["A-1-copilot-extension"]`）と `checks.json` にある。ただ、ビルドの記録だけを見ると「単位なし」に見えるので、読む人は注意が要る。
2. `doc-corrections.md` の A8 には、6節の追記（前回の指摘）が入った。ただし、A8 の「起動しない」は今回の結果（止められても起動が続いた）と合わない。蒙恬も、判断を仰ぎたい点の3で挙げている。docs/07 の4節には、すでに「無改造の出力は起動の途中で終わり、A-1 を当てた出力は起動が続いた」と書いてある。
3. 2.3 の、mydist の `ThirdPartyNotices.txt` の改行の違い。
4. 4.1 の、build-log.md の起動の終わりの時刻。
5. 4.2 の、ID 3033 の `file` が `null` になること。
6. 4.3 の、`agenthost.log` の35行の誤りが build-log.md に無いこと。
7. 起動の確かめの時点では Smart App Control はオン（`env-check.json` の `verifiedAndReputablePolicyState: 1`）。その後、裁定によりユーザーがオフにした（`docs/user-decisions.md`）。今回の起動の結果は、オンのときのもの。

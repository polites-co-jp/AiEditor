# Phase 2 の検証（ビルドの前の分）の記録

- 検証: 大岡越前守（2026-11-14）
- 依頼: `tasks/2026-11-14-p2-verify-prebuild/brief.md`
- 判定（1回目）: **判定できない**。理由は、2の「新しい作業ツリーを作って A＋B を当てる」が権限で行えないため。それ以外の項目は合格。別に、関門の条件の外の不具合を1件見つけた（4節の D1）
- 判定（2回目、6節）: **合格**。作業ツリー `C:\b\wt\verify-p2` で A＋B を当てて、`result: ok` と各検査を確かめた。D1 と軽微な点の直しも確かめた

## 0. 確かめた版

下の SHA-256 の版で確かめた（`sha256sum` の出力）。コミットの前に変わっていれば、検証をやり直す。2回目の版は6節と `trial/sha256-2.txt`。

| ファイル | SHA-256（先頭16桁） |
|---|---|
| scripts/apply.mjs | ec9ec4759264b013 |
| scripts/lib/apply/checks.mjs | c674b9888e3e7856 |
| scripts/lib/apply/classify.mjs | a7946ccc422068b7 |
| scripts/lib/apply/deps.mjs | 8f1a69934a478e9a |
| scripts/lib/apply/git.mjs | eec1f0f189036a0f |
| scripts/lib/apply/keys.mjs | 570ee5d8d2805148 |
| scripts/lib/apply/lines.mjs | 9f04278524269d80 |
| scripts/lib/apply/lockfile.mjs | fc088b0f54cee2c5 |
| scripts/lib/apply/overlay.mjs | 2e1369d4fc6fcca9 |
| scripts/lib/apply/tree.mjs | 74fa9afd6fe79d5d |
| scripts/lib/apply/units.mjs | ee83271c10019fc9 |
| scripts/build.mjs | 33ec77692e8fc7aa |
| scripts/install-extensions.mjs | 80ec6ad06cd6761c |
| scripts/configure.ps1 | d0a23d1d0c88338a |
| scripts/switch.ps1 | d21b498a5794a3dd |
| scripts/lib/local-config.mjs | 0df9a120b17c489b |
| scripts/lib/local-config.ps1 | 0b3e6d0edd3d794f |
| scripts/make-icons.mjs | 247e17c61e1ca7b5 |
| product.overlay.json | 3cdfbd77210039b5 |
| builtin/keep.json | 6d5258e03ca7d912 |
| patches/20-product-configuration-defaults.patch | a8b344f8820b2fe2 |
| patches/30-proxy-direct-without-settings.patch | dae74800d71919f3 |
| extensions-src/mydist/package.json | 54335613b70c8bc6 |
| tests/run-all.mjs | 24612a676fa1325e |
| tests/smoke-stop.mjs | 7084d1064ff64611 |
| tests/smoke/lib/common.mjs | 74c1eaea8b7a93fd |

`removals/*/unit.json` の14件と `edits.patch` の6件も同じ時刻に取った。全部の全桁は `trial/sha256.txt`。

## 1. レビュー（コードは直していない）

### 1.1 apply.mjs と docs/03 の5〜6節 — 合格

| 観点 | 仕様 | 実装（読んだ箇所） | 結果 |
|---|---|---|---|
| 順序 | 上書き → 単位（order の順。各単位は ops → edits）→ patches/（docs/03 の5.1、docs/02 の4節の2） | `runApply` の 1〜5（上書き → `plan` の順 → `listPatches` の番号の順 → assets → 自前の拡張） | 合う |
| after | 先に当たっていなければ止める | `planUnits` で入力の段で誤りにし、`checkAfter` で当てる前にもう一度見る | 合う |
| 2つのコミット | `unit <id>: ops`、パッチの中のコミットの `unit <id>: edits` | `commitAll`（`--allow-empty`）と `amApply`（`git am -3`）。件名が違えば警告 | 合う |
| removeLines | 前後の空白を除いた完全一致、ちょうど count 行、正規表現なし | `lines.mjs`（`trim()` の比べ、`hits.length !== count` で止める）。最後の行の規則も設計（行末は行ごとに保つ）どおり | 合う |
| 検査 | 消え残り・参照の残り（kept を除く）・未分類・本家が足した部品（workbench と sessions の main）・依存・ロックファイル（docs/03 の6節） | `checks.mjs`。`MAIN_FILES` に `sessions.*.main.ts`。ロックファイルは導入の後まで `pending` | 合う |
| mydist の既定を外す規則 | 有効な単位の `absentSettings` のキーを、写した mydist から外す。リポジトリの mydist は書き換えない（docs/03 の4節の末尾） | `pruneConfigurationDefaults` を写した後の `extensions/mydist/package.json` にだけ書く。`removedDefaults` に記録 | 合う |
| コミットの名前 | `shuko-apply <apply@shuko.invalid>`（docs/03 の5.2） | `COMMIT_IDENTITY` を commit と am に付ける。`commitIdentity` の検査。パッチ 8 本の `From:` はすべて `shuko-apply <apply@shuko.invalid>`（grep で確かめた） | 合う |

### 1.2 単位（A-1〜A-7・B-1〜B-7） — 合格

- 形: 14件とも docs/03 の3.1 の項目を持つ（`validateUnit` は `tests/removals.test.mjs` で通った）。order は 110〜170・210〜270 で重ならない。全件 `enabled: false`。
- 裁定と表の変更の記録（docs/03 の4節の末尾、user-decisions の 2026-11-14 の2節）との照合:
  - A-1 の後処理は `build/lib/copilot.ts` の3行（裁定どおり）。A-3 の `builtInExtensions: []` は overlay の `set`（裁定どおり）。
  - B-1 に `terminalContrib/telemetry`、B-2 は `contrib/onboarding` を `kept`、B-6 は `contrib/emergencyAlert` を消す、WPAD は `patches/30`。どれも記録どおり。
  - B-7 の `services/suggest`: 1.146.0 の `src` で `services/suggest/` を参照するのは `terminalContrib/suggest` の5ファイルと `modernUI` のテスト1ファイル（B-7 の `removeLines`）、ほかは試験のデータ `uri.perf.data.txt` だけ（grep）。「入力候補だけが使うなら消す」に当たる。
  - A-7 の `absentCommands` の `terminal.integrated.suggest.clearCachedGlobals` は拡張 `terminal-suggest` のコマンドで、本体には無い（grep）。A-7 だけで消える。
- Claude Code が使う受け手（docs/03 の9節）: Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼、コメント、差分エディタ、拡張のファイルシステムの提供者、メニューの場所は、どの単位の `delete` にも入っていない。`walkthroughs` の受け手（`welcomeGettingStarted`）は B-2 が消すが、docs/03 の表がスモークで見ると決めている点で、範囲どおり。
- `builtin/keep.json`: docs/03 の4節が「少なくとも載せる」とした名前はすべてある。dry-run で本家 1.146.0 の拡張95件のうち未分類は0件。

### 1.3 overlay とパッチ — 合格

- `shukoConfigurationDefaults` の `extensions.allowed` は `"*": false` と台帳の8件（`extensions.lock.json` の `id`。大文字小文字も同じ）。ほかの5件の値は docs/02 の3節の表と同じ。
- overlay の `set` は docs/02 の3節の表の set の行と同じ値。GUID は本家と別の値。
- パッチ 20: 1.146.0 の `configurationRegistry.ts` の1179〜1181行に文脈が合う。使う `product`・`types`・`IStringDictionary` はこのファイルが既に import している。`registerDefaultConfigurations` の引数の型（`IConfigurationDefaults` の `overrides`）にも合う。型検査は未実施。
- パッチ 30: 1.146.0 の `windowImpl.ts` の1290〜1293行に文脈が合う。`http.proxy` も環境変数のプロキシも無い初回（`!e`）だけ `mode: 'direct'` にする。設定がある・後で設定を外したときは本家の道（`proxyRules`）のまま。効いたかは自作のビルドの通信の監査で見る。

### 1.4 ビルドと切り替えの台本 — 合格（普段使いのデータ・local.json・スタートメニュー・PATH）

- `build.mjs`: 書くのは `records/`、`<buildRoot>` の下（記録・ログ・dist）だけ。local.json は読むだけ（`resolveLocalConfig`）。zip の段はジャンクションだけを `unlinkSync` で外し、中身を消さない。
- `install-extensions.mjs`: 本家の `dataFolderName`（`.vscode` など）の CLI は `--portable` か `--extensions-dir` が無ければ止める。
- `configure.ps1`: スタートメニューと PATH を触るのは `-InstallRoot` のときだけで、既にある `<前>\current` を指すものだけを向け直す。`-NoShellIntegration` で飛ばせる。テスト（`tests/configure.test.mjs`）は毎回 `-ConfigPath` と `-NoShellIntegration` を付ける。
- `switch.ps1`: ユーザーのデータは読んで `backups\` に写すだけ。

## 2. 実行

### 2.1 `node tests/run-all.mjs` — 合格

蒙恬の2点の直し（`setArgvLocale`、`-KeepVersions 0`）の後に走らせた。結果は `run-all-result.txt`。

| 合計 | 件数 975 | pass 961 | fail 0 | skip 14 |
|---|---|---|---|---|

- skip 14 は `removals.test.mjs` の「有効な単位の after は有効」（14単位とも `enabled: false` なので飛ぶ）。正当。
- 前回落ちた4件（`install-ext` の3件、`configure` の1件）は通った。テストを読み、仕様を緩めていないことを確かめた: 値が数・null・真偽・オブジェクト・配列の `locale` は例外（`install-ext.test.mjs` 225〜229行）、`-KeepVersions 0` と `-2` は終了コード 1 で local.json が変わらない（`configure.test.mjs` 106〜114行）、最後の行の removeLines は `'a\n'`（`apply-parts.test.mjs` 24〜28行）。

### 2.2 新しい作業ツリーに A＋B を当てる — 判定できない（1回目。2回目は6.1で合格）

- `C:\b\wt\verify-p2` を作れなかった。`git worktree add` が私の許可に無い（`permissions.json` の bash は `git worktree list` だけ）。`cd C:/b/wt/1.146.0` もフックに止められた。許可に無い形は試していない。
- 代わりに、作業ツリーを書き換えない `--dry-run` を `C:\b\wt\1.146.0` に当てた（`tree.mjs` の dry-run はメモリの上でだけ書き、rerere の設定もしない。コードで確かめてから使った）。

```
node scripts/apply.mjs C:/b/wt/1.146.0 --label verify-p2-dry --dry-run --only <A-1〜A-7・B-1〜B-7> --prev-tag 1.145.3 --checks-out tasks/2026-11-14-p2-verify-prebuild/trial/dry-ab/checks.json
```

結果（`trial/dry-ab/checks.json`）:

| 項目 | 結果 |
|---|---|
| result | `ok`（終了コード 0）。`errors` 0、`stoppedAt` なし |
| 単位 | 14件とも `applied: "ok"`。removeLines 94行すべて `found: 1`。`missingDeletes`・`missingDependencies`・`productMissing` は0件 |
| overlay | `ok`。`removed`・`removedIfPresent` は0件（1.146.0 の product.json に該当のキーが無い） |
| assets | 8ファイル（ICO・PNG 3つ、SVG 5つ） |
| mydist | `removedDefaults` に `workbench.startupEditor`（B-2）と `terminal.integrated.suggest.enabled`（B-7） |
| unclassifiedExtensions | `ok`（本家95件、未分類0、拡張でないフォルダは `types`） |
| upstreamAdditions | `info`。1.145.3 から増えたフォルダ4（`contrib/chatWindow` ほか）、import の行19（sessions の main を含む）。目立たせ14 |
| registeredKeys | `warn`。`shukoConfigurationDefaults` だけが `missing`（パッチ 20 を dry-run では当てないため。設計どおり）。設定のキー15件はすべて登録が見つかった |
| toolchain | `.nvmrc` 24.22.1 は変化なし、Electron 43.8.3 → 43.8.6 |
| remnants・absentStrings・commitIdentity・edits・patches | dry-run なので `skipped`。**ここが確かめられていない** |

- `C:\b\wt\1.146.0` が変わっていないこと: 1回目と2回目（`trial/clean-check/checks.json`）の dry-run のどちらでも、apply.mjs は「作業ツリーに変更がある」の警告を出さなかった。HEAD は `69047191fc427f2f92828279aae1d90d8eeda7ab`（タグ 1.146.0）のまま。

### 2.3 `node scripts/build.mjs 1.146.0 --dry-run` — 合格

- 終了コード 0、`result: "dry-run"`。8つの手順の `plan` は設計の3節どおり（`pnpm install --no-frozen-lockfile`、`--lockfile-check`、`typecheck-client`、`gulp vscode-win32-x64-min`、System32 の tar.exe）。
- `config.exists: false`（`%LOCALAPPDATA%\Shuko\local.json` は無い）、`buildRootFrom: default`。何も書かなかった（`--record` なし）。
- `checksBeforeRun`: `unitsEnabled: []`、`unitsTotal: 14`。
- 参考: この PC の道具は node 24.16.0（`.nvmrc` は 24.22.1）、pnpm 11.8.0（宣言は 12.16.0）。道具の導入待ちのとおり。

## 3. スモークの `--mark-keep` — 合格

| 実行 | 結果 |
|---|---|
| `node tests/smoke-stop.mjs --mark-keep official-20261113T143803` | 終了コード 0。既にある `.keep` のまま（2回目は何もしない） |
| `--mark-keep ../ext/p-20261113T143803` | 終了コード 2（名前の形でない） |
| `--mark-keep official-20990101T000000` | 終了コード 2（置き場所が無い）。フォルダは作られていない（Glob） |
| `--mark-keep`（名前なし） | 終了コード 2 |

`markKeep` は `isRunDirName` と `isRunDirPath` の2つで runs の直下に限る。`pruneRuns` は `.keep` のある置き場所を消さない（`smoke.test.mjs` の追加4件が通った）。

## 4. 見つけた点（1回目）

### D1（不具合。関門の条件の外。最初のビルドの前に直す） — 蒙恬の `scripts/build.mjs`

`--worktree` を渡しても、prepare の手順は `<buildRoot>\wt\<tag>` を相手にする（`build.mjs` 424行の prepare の引数に作業ツリーが無く、`prepare.mjs` 109行は `path.join(buildRoot, "wt", tag)` で決まる）。`--fresh` は `--worktree` の場所を消す。そのため「別の作業ツリーでビルドする」が動かない。あわせて、テストが `C:\b\wt\1.146.0` を本家のままとして読む点と、build.mjs の既定がそこに当てる点が食い違う。→ 6.2 で直ったことを確かめた。

### 軽微（合否に関わらない。申し送り。6.2 で対応を確かめた）

1. `apply.mjs` の `--manifests` の既定が `C:/b/p0/vsix`（docs/02 の8節と違う）。
2. B-1〜B-7 の `smoke` に `absence` が無い。
3. A-7 の `kept`（`terminalContrib/suggest`）の理由が古い。
4. docs/02 の3節の表に、overlay の `removeIfPresent` の4キーが無い（リーダー）。
5. ルートに `.gitattributes`（`*.patch -text`）が無い（リーダー）。
6. `configure.ps1` の PATH の書き戻しで `%変数%` が展開される恐れ（推定）。
7. テストの抜け（`From:` と件名、sessions の main、`commitIdentity`）。
8. `build.mjs --dry-run` が道具の版の違いを警告しない（提案）。
9. `--mark-keep` は既に印があるときも「印を置いた」と出す（表示だけ）。

## 5. 守ったこと（1回目）

- コード・テスト・docs は直していない。書いたのは `tasks/2026-11-14-p2-verify-prebuild/` の下だけ。
- `C:\b\wt\1.146.0` は dry-run でだけ読んだ（変更なし）。依存の導入とビルドは走らせていない。`git fetch` もしていない。
- 実際の local.json（無い）、スタートメニュー、PATH、普段使いのデータには触れていない。

## 6. 2回目（2026-11-14、リーダーの続きの依頼）

対象外: 取り込み・検知・notion-sync（take-in・watch・notion-sync）。別の検証にする。

### 6.0 確かめた版

全桁は `trial/sha256-2.txt`。1回目から変わったもの:

| ファイル | SHA-256（先頭16桁） |
|---|---|
| scripts/apply.mjs | 63c9c87dac3a69a2 |
| scripts/build.mjs | 4848a7c4cec05f1b |
| scripts/prepare.mjs | fab32969125be97c |
| scripts/configure.ps1 | e9a6b4ae18cec8b6 |
| scripts/lock-fetch.mjs | 256d0f181a825fe6 |
| scripts/lock-verify.mjs | 1314bee84eb9608f |
| scripts/convert-sublime-keys.mjs | cc38f2024cd30f74 |
| removals/A-7-unused-extensions/unit.json | 38b3ff9b809ac711 |
| removals/B-1〜B-7 の unit.json | `trial/sha256-2.txt`（`smoke` に `absence` が入った） |
| tests/smoke/lib/common.mjs | 7fd813817da6ae54 |
| tests/removals.test.mjs | f4fe8c5083823e34 |
| tests/apply-commits.test.mjs（新規） | 3bd4b2e9577dd78f |

`lib/apply/*`、overlay、keep.json、台帳、パッチ8本、mydist、assets は1回目と同じ。

### 6.1 `C:\b\wt\verify-p2` に A＋B を当てる — 合格

- 当てる前: `C:\b\vscode\.git\worktrees\verify-p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`（タグ 1.146.0）。clean かどうかは apply.mjs が当てる前に `git status --porcelain` で見て、変更があれば止める（止まらなかった）。

```
node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-p2 --only <A-1〜A-7・B-1〜B-7> --prev-tag 1.145.3
```

結果（`records/take-in/verify-p2/checks.json`）。終了コード 0、`result: "ok"`、`stoppedAt: null`、`errors: []`、`warnings: []`。

| 検査 | 結果 |
|---|---|
| 単位 | 14件とも `applied: "ok"`。各単位の `warnings` は空 |
| edits.patch | A-1・A-6・B-1・B-2・B-3・B-7 の6本とも `edits.applied: "ok"`、件名 `unit <id>: edits`。ほかの8単位は `none` |
| patches/ | 20・30 とも `applied: "ok"` |
| remnants（消え残り） | `ok`（items 0） |
| absentStrings（参照の残り） | `ok`（すべての項目の `hitCount` が 0） |
| unclassifiedExtensions | `ok`（95件、未分類0） |
| registeredKeys | `ok`。`shukoConfigurationDefaults` は `referenced`（`configurationRegistry.ts`。パッチ 20 が入った）。台帳の拡張の設定のキーは `lockManifest`（`basedpyright.importStrategy` → `detachhead.basedpyright`、`claudeCode.environmentVariables` → `anthropic.claude-code`）、`manifestsMissing: []`。`inputs.manifests` は `C:\b\cache\vsix` |
| commitIdentity | `ok`（items 0）。コミット25個（overlay 1、ops 14、edits 6、パッチ 2、assets 1、組み込み拡張 1）の作者とコミッターがすべて `shuko-apply <apply@shuko.invalid>` |
| lockfile | `pending`（依存の導入の前なので設計どおり） |

作業ツリーの中身も読んで確かめた（Read・Grep・Glob）:
- `product.json` の `nameShort` が `Shuko`、`builtInExtensions` が `[]`。`reportIssueUrl`・`onboardingThemes` は無い。
- `extensions/mydist/package.json` に `workbench.startupEditor`・`terminal.integrated.suggest.enabled` が無い。リポジトリの `extensions-src/mydist/package.json` は SHA-256 が1回目と同じ。
- `configurationRegistry.ts` の1182〜1186行にパッチ 20 の登録、`windowImpl.ts` の1297〜1298行にパッチ 30 の `mode: 'direct'` がある。
- `extensions/copilot`・`prompt-basics`・`github`・`theme-abyss`・`terminal-suggest`・`ipynb` の `package.json` は無い。
- 当てた後の HEAD は `ef5b647f852e1f0977a02c8b758abaa8c340382d`（checks.json の `headCommit` と同じ）。`C:\b\wt\1.146.0` の HEAD は `69047191…` のまま。

### 6.2 指摘への直し

| 指摘 | 確かめたこと | 結果 |
|---|---|---|
| D1（build.mjs・prepare.mjs） | `node scripts/build.mjs 1.146.0 --dry-run --label verify-d1 --worktree C:/b/wt/verify-p2 --fresh --to apply` の plan で、prepare が `--worktree C:\b\wt\verify-p2 --out C:\b\wt\verify-p2.prepare.json`、fresh と apply も同じ場所になった。`prepare.mjs` は `resolveWorktree`（`--worktree`、無ければ `<buildRoot>\wt\<tag>`）で場所を決め、常設の clone と同じか中の場所は止める。build.mjs の既定の場所（`<buildRoot>\wt\<tag>`。使い捨て）は変えていない（リーダーの決定） | 合格 |
| テストが 1.146.0 の作業ツリーを本家のままとして読む点 | `tests/removals.test.mjs` は `git -C C:/b/vscode ls-tree` / `show` / `cat-file -e 1.146.0:<path>` で読む形になった（曹参の追記の1）。`C:\b\wt\1.146.0` を読むテストは残っていない（grep） | 合格 |
| 軽微1 `--manifests` の既定 | `apply.mjs` 110〜119行: `--build-root` → local.json → `C:\b` の `cache\vsix`。`lock-fetch.mjs` の `--out`、`lock-verify.mjs` の `--dir`、`install-extensions.mjs` の `--cache` も同じ場所。`C:\b\cache\vsix` の VSIX 8件の SHA-256 は台帳の `sha256` と8件とも一致した（`sha256sum`）。6.1 で `lockManifest` として読まれた | 合格 |
| 軽微2 B の `smoke` に `absence` | B-1 は `["base","claude-code","languages","absence"]`、B-2〜B-7 は `["base","claude-code","absence"]`。A は前から持つ | 合格 |
| 軽微3 A-7 の `kept` の理由 | B-7 が本体の部品を消すこと、A-7 と B-7 は互いに `after` を持たないこと、B-7 が無効な間は mydist の既定で止めること、を書いた | 合格 |
| 軽微6 PATH の書き戻し | `configure.ps1` は `HKCU\Environment` の `Path` を `DoNotExpandEnvironmentNames` で生のまま読み、同じ種類で書き戻し、`WM_SETTINGCHANGE` を送る（`Update-PathEntries` 119行〜、139〜167行）。コードを読んで確かめた。実際の書き戻しは本物の PATH を変えるので、蒙恬も私も走らせていない | 合格（コードの読み） |
| 軽微7 テストの抜け | `tests/apply-commits.test.mjs`（18件）を読んだ。edits.patch 6本とパッチ2本の `From:`・件名、`MAIN_FILES`（形と本家での拾い方）、`checkUpstreamAdditions`（試しの git で増えた import だけ）、新しい作業ツリーに本当に当てる通しの試し（commitIdentity ok、作者違いのパッチで warn、dry-run で skipped、mydist の2キーが外れて extensions-src は変わらない）。期待は仕様どおりで緩めていない。試しの作業ツリー `C:\b\wt\tests-ac-*` は終わった後に残っていない（Glob） | 合格 |
| 軽微8 道具の版の警告 | 上の dry-run の `warnings` に「node 24.16.0 が .nvmrc の 24.22.1 に合わない」「pnpm 11.8.0 が packageManager の 12.16.0 に合わない」 | 合格 |
| 軽微4・5（docs/02 の表、`.gitattributes`） | リーダーの担当。今回は対象にしていない | — |
| 軽微9（`--mark-keep` の表示） | 表示だけなので直しを求めていない | — |

### 6.3 `node tests/run-all.mjs`（2回目） — 合格

結果は `run-all-result-2.txt`。合計 1129件、pass 1031、fail 0、skip 98。リーダーの言う1128件より1件多いのは `smoke.test.mjs` が75件になったため（その後の追加と見る）。

- この検証の範囲（take-in・watch・notion-sync・p34-selfcheck を除く）: 994件、pass 980、fail 0、skip 14。skip 14 は1回目と同じ「有効な単位の after」。
- 範囲の外: take-in 47 pass、p34-selfcheck 3 pass、notion-sync 47 skip、watch 1 pass・37 skip。理由は見ていない（別の検証）。

### 6.4 申し送り（合否に関わらない）

1. 直しのテストが無い（曹参）: `build.mjs` の `toolchainWarnings`、`prepare.mjs` の `resolveWorktree`・`resolveBuildRoot`、`configure.ps1` の `Update-PathEntries`。蒙恬が追記2に「テストの入口」を書いているが、`tests/` に当たるテストは無い（grep）。`build-parts.test.mjs` は38件のまま。
2. `build.mjs` は apply.mjs に `--build-root`・`--config` を渡さない（453行）。`build.mjs --build-root D:\b` のように既定と違う場所で走らせると、apply.mjs は manifest を local.json か `C:\b` の `cache\vsix` から読む。今の使い方（既定の場所）では食い違わない。食い違っても `registeredKeys` が `warn` になるだけで、止まらない（蒙恬）。
3. `C:\b\wt\verify-p2` は当てた状態（HEAD `ef5b647f…`）で残した。要らなければ消してよい。

### 6.5 守ったこと（2回目）

- コード・テスト・docs は直していない。書いたのは `tasks/2026-11-14-p2-verify-prebuild/`（この追記、`handoff-notes.md`、`run-all-result-2.txt`、`trial/sha256-2.txt`）と `records/take-in/verify-p2/checks.json`。
- 書き換えた作業ツリーは `C:\b\wt\verify-p2` だけ。`C:\b\wt\1.146.0` は HEAD がタグのまま。依存の導入・ビルド・`git fetch`・`lock-fetch`・`lock-verify` は走らせていない。
- 実際の local.json（無い）、スタートメニュー、PATH、普段使いのデータには触れていない。

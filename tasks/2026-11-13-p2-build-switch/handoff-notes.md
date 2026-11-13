# 引き継ぎ: Phase 2 の build.mjs・install-extensions.mjs・local.json の部品・configure.ps1・switch.ps1

- 作成: 蒙恬（2026-11-14）
- 宛先: ヴラド・ツェペシュ

## 追記2（2026-11-14）: 大岡越前守の検証の D1 と、4節の蒙恬宛ての点

リーダーの指示（`tasks/2026-11-14-p2-verify-prebuild/handoff-notes.md` の「直す必要がある点」、`verification-log.md` の4節）で直した。作業ツリー `C:\b\wt\<tag>` はビルドで書き換わる使い捨てのまま（リーダーの決定。テストの読み方は曹参が直す）なので、build.mjs の既定の場所は変えていない。

- 結果: 完了（D1・4節の6・4節の8）。4節の1〜3（apply.mjs の `--manifests` の既定、B 単位の `smoke` の `absence`、A-7 の `kept` の理由）は、確かめたところ別の蒙恬の直しで既に入っていた（apply.mjs の既定は `<buildRoot>\cache\vsix`、B-1〜B-7 は `absence` を持つ、A-7 の理由は B-7 を指す）。触っていない。
- 直したもの:
  1. **D1**（`scripts/build.mjs`・`scripts/prepare.mjs`）: build.mjs は prepare に `--worktree <作業ツリー>` と `--out <作業ツリー>.prepare.json` を渡す。prepare.mjs に `--worktree` を足し、作業ツリーの場所をそこから決める（既定は前と同じ `<buildRoot>\wt\<tag>`。記録の既定も前と同じ場所になる）。これで prepare・`--fresh`・apply 以降が同じ場所を見る。あわせて prepare.mjs の local.json の読み方を共通の部品（`scripts/lib/local-config.mjs`）に寄せ（`--config` も足した。未解決の3が片づいた）、作業ツリーが常設の clone と同じか中にあれば止めるようにした。
  2. **4節の6**（`scripts/configure.ps1`）: ユーザーの PATH を `[Environment]::SetEnvironmentVariable` で書かず、`HKCU\Environment` の `Path` を生のまま（`%変数%` を展開せず）読み、同じ種類（REG_EXPAND_SZ は REG_EXPAND_SZ のまま）で書き戻して `WM_SETTINGCHANGE` を送る形にした。一致を見るときだけ各項目を展開し、置き換えるのは `<前>\current\bin` の項目だけ。ほかの項目の `%変数%` の形は保つ。戻しも生の値と種類で書き戻す。規則は純粋な関数 `Update-PathEntries` にした。
  3. **4節の8**（`scripts/build.mjs`、提案の採用）: `toolchainWarnings(toolchain)` を足し、`--dry-run` と `install` の手順で、node が `.nvmrc`、pnpm が `packageManager` に合わないとき `warnings` に書く（止めない。本番は preinstall.ts が止める）。
  4. `build-switch-design.md` の3節・3.3・6節に書き足した。
- 確かめたこと:
  - `node --check scripts/build.mjs`・`scripts/prepare.mjs`: 誤りなし。`scripts/p0-check-ps.ps1`: 16 本で構文の誤り 0、ASCII 以外 0 バイト。
  - D1（記録は `trial/d1-*.json`）:
    - `--dry-run --fresh --to apply --worktree C:/b/wt/dev-d1`: plan の prepare に `--worktree C:\b\wt\dev-d1 --out C:\b\wt\dev-d1.prepare.json`、fresh・apply も同じ場所（d1-0）。
    - `--to apply --worktree C:/b/wt/dev-d1`: prepare が `C:\b\wt\dev-d1` を作り（worktree add 31.4 秒）、HEAD がタグと一致。apply が同じ場所に当てて `result: ok`（d1-1）。`C:\b\wt\1.146.0` は見ていない。
    - 同じ場所で `--to prepare`（`--fresh` なし）: 当てた後の HEAD `3b73491c…` がタグと違うとして prepare で止まった（d1-2）。
    - `--to prepare --fresh`: 同じ場所を消して作り直し、ok（d1-3）。その後 `git worktree remove` で消した。
    - prepare.mjs に誤りのある local.json（知らないキー、知らない環境変数）を `--config` で渡すと、共通の部品の誤りで終了コード 1。
  - 4節の8: 既にある作業ツリーで `--dry-run` → `warnings` に「node 24.16.0 が .nvmrc の 24.22.1 に合わない」「pnpm 11.8.0 が packageManager の 12.16.0 に合わない」（d1-0b）。
  - 4節の6: 試しの installRoot を `-NoShellIntegration` なしで B → D に移した。スタートメニューと PATH を読むだけで、一致が無いので何も書かなかった（`userPath: { found: true, kind: "ExpandString", changed: false }`）。**この PC のユーザーの PATH は REG_EXPAND_SZ** で、検証の指摘の恐れは実際にあった。その後 `-NoShellIntegration` で B に戻した。一致があったときの書き戻しは、本物の PATH を書き換えることになるので試していない（brief の「PATH への登録は試しで行わない」）。
- テストの入口（曹参へ）:
  - `scripts/build.mjs` の `toolchainWarnings`: `{node:"24.22.1", nvmrc:"24.22.1", packageManager:"pnpm 12.16.0", packageManagerDeclared:"pnpm@12.16.0"}` → `[]`。node `24.16.0` → 1件、`26.1.0` → 1件（メジャーが違う）、pnpm `11.8.0`・`13.0.0` → 1件、`packageManager` が `null` → 「確かめられない」1件、`packageManagerDeclared` が `npm@10.0.0` → 「pnpm 以外」1件、`nvmrc` が無い → node の警告なし。
  - `scripts/prepare.mjs` の `resolveBuildRoot(cliValue, { configPath })`・`resolveWorktree(buildRoot, tag, cliValue)`: 前者は `resolveLocalConfig` と同じ規則（知らないキー・相対パスで例外）、後者は `cliValue` が無ければ `<buildRoot>\wt\<tag>`。`node scripts/prepare.mjs --config <bad>` は終了コード 1。
  - `scripts/configure.ps1` の `Update-PathEntries`（純粋。台本の AST から取り出して試せる）: `Raw = '%USERPROFILE%\bin;C:\old\current\bin;C:\x'`、`OldBin = 'C:\old\current\bin'`、`NewBin = 'C:\new\current\bin'` → `'%USERPROFILE%\bin;C:\new\current\bin;C:\x'`。`C:\OLD\current\bin\`（大文字・末尾 `\`）も一致。`%FOO%\current\bin` は `FOO` を `C:\old` にして展開すれば一致。一致が無い・`Raw` が空 → `$null`。
- docs/ との食い違い: 無し（D1 は台本の誤りで、docs/02 の4節の1のとおりに直した）。
- 未解決: 未解決の4（VSIX のキャッシュ）は、apply.mjs の `--manifests` が `<buildRoot>\cache\vsix\<id>-<版>[@<target>]\package.json` を読むようになったので、そこに manifest を置くのは lock-fetch.mjs（`--out <buildRoot>\cache\vsix`）の役目になる。install-extensions.mjs は VSIX しか置かない。lock-fetch.mjs の既定の `--out` をそこへ変えるかは、引き続き決めてほしい。SubagentHandback は引き続き許可フックで止められる。

## 追記（2026-11-14）: 曹参のテストで落ちた2点の直しと、設計の書き足し

リーダーの指示（設計を正として実装を直す。`tasks/2026-11-14-p2-tests-build/handoff-notes.md` の「落ちた4件の切り分け」）で直した。

- 結果: 完了
- 直したもの:
  1. `scripts/install-extensions.mjs` の `setArgvLocale`: `locale` の値が文字列でなければ、数・`null`・真偽も例外にした（前はオブジェクトと配列だけを止めていた）。字句の種類が `string` でなければ `"locale" の値が文字列でない` を投げる。
  2. `scripts/configure.ps1`: `-KeepVersions` の既定値 0 を外し、指定があるかを `$PSBoundParameters.ContainsKey('KeepVersions')` で見分けるようにした。`-KeepVersions 0`（と負の数）は `KeepVersions must be an integer >= 1` で終了コード 1。
  3. `build-switch-design.md` の3.3に、`parseArgs` が返す項目の表（19 項目と既定値）と、`--dry-run` の `plan` の形（オブジェクト。キーは選んだ手順の名前）を書き足した。4.1 と6節にも今回の直しを書いた。
- 確かめたこと:
  - `node --check scripts/install-extensions.mjs`・`scripts/build.mjs`: 誤りなし。`scripts/p0-check-ps.ps1`: 15 本で構文の誤り 0、ASCII 以外 0 バイト。
  - `configure.ps1 -ConfigPath C:/b/trial-install/cfg/local.json -KeepVersions 0` → 終了コード 1、local.json は変わらない。`-KeepVersions 3` → ok で書き換え。引数なし → 値を出すだけ（終了コード 0）。
  - 試しの portable（`C:\b\trial-install\portable2`）に `{"locale": 5}` の argv.json を置き、`ledger-dotenv.json` で install-extensions.mjs を走らせた → 導入と照合の後、argv.json の段で `"locale" の値が文字列でない` により終了コード 1（`trial/i7-locale-number.json`）。argv.json は書き換わっていない。
  - `null`・真偽の場合は、同じ分岐（字句が `string` でない）で止まる。台本からは数の場合だけを走らせた（`node -e` などで関数を直接呼ぶ形は蒙恬の許可に無い）。曹参のテストを走らせ直して確かめてほしい。
- テストの入口: 曹参の `tests/install-ext.test.mjs`（`setArgvLocale` の3件）と `tests/configure.test.mjs`（`-KeepVersions 0`）が通る見込み。`parseArgs` の項目名と `plan` の形は設計の3.3の表のとおりに足せる。
- 未解決: SubagentHandback は引き続き許可フックで止められる（下の「未解決の点」の9の続き）。

## 結果

**完了**（brief の1〜5）。ビルド（依存の導入・型検査・パッケージ化）は道具の導入待ちのため走らせていない。走らせられる範囲（引数、local.json、記録の形、`--dry-run`、prepare・apply・lockfile・後処理・zip の各手順、切り替え・戻し・移動・拡張の導入）は、試しの場所で確かめた。

## 成果物

- `scripts/lib/local-config.mjs`（新規）: local.json を読む部品（Node.js）
- `scripts/lib/local-config.ps1`（新規）: 同（PowerShell）
- `scripts/configure.ps1`（新規）: local.json の作成・変更、`-InstallRoot` の移動（失敗したら戻す）
- `scripts/switch.ps1`（新規）: 版の切り替え・`-Previous`・`-List`・`-Zip`、engines の確かめ、ユーザーのデータの写し
- `scripts/build.mjs`（新規）: docs/02 の4節の1〜8 と記録
- `scripts/install-extensions.mjs`（新規）: 台帳の拡張の導入と `argv.json` の `locale`
- `tasks/2026-11-13-p2-build-switch/build-switch-design.md`: 引数、関数の入出力（テストの入口）、記録の形
- `tasks/2026-11-13-p2-build-switch/trial-log.md`: 試しの記録（`trial/` に JSON）
- `tasks/2026-11-13-p2-build-switch/doc-corrections.md`: docs/ の直し方の案 15 件

## 要点

1. build.mjs は prepare.mjs と apply.mjs（p2-apply の入口。`--lockfile-check` も）を呼ぶだけにし、依存の導入は `pnpm install --no-frozen-lockfile`、型検査は `typecheck-client`、パッケージ化は `gulp vscode-win32-x64-min`。手順ごとに記録を書き直すので、止まった場所（`stoppedAt`）が残る。
2. **System32 の bsdtar には名前の置き換え（`-s`）が無い**。zip は出力を改名せず、`<dist>\.stage-<label>\Shuko-win32-x64-<label>` のジャンクションを `tar -H` で包む形にした（公式の展開で 414 MB・72 秒、最上位は1つ）。
3. gulp の出力は `C:\b\VSCode-win32-x64` ではなく `C:\b\wt\VSCode-win32-x64`（作業ツリーの親の直下。1.146.0 の gulpfile）。資料の図が違う。
4. switch.ps1・configure.ps1 は公式の zip の写し（`C:\b\trial-install\`）で、展開・切り替え・engines で止まる・`-Previous`・動いているエディタで止まる・別の場所への移動・失敗時の戻しまで確かめた。install-extensions.mjs は台帳の8件を試しの portable の場所に入れ、SHA-256 の不一致・台帳に無い拡張・`--rev HEAD` で止まることを確かめた。
5. 公式の CLI を守りなしで走らせると普段使いの `%USERPROFILE%\.vscode\extensions` に入るので、本家の `dataFolderName` のときは `--portable` か `--extensions-dir` が無ければ止める守りを入れた。

## 確かめたこと

- `node --check`: build.mjs・install-extensions.mjs・lib/local-config.mjs は誤りなし。`scripts/p0-check-ps.ps1`: PowerShell 15 本で構文の誤り 0、ASCII 以外 0 バイト。
- 試しの結果は `trial-log.md` の3〜6節（build 8通り、install 7通り、switch 9通り、configure 9通り）。試しの途中で見つけて直した誤りは5つ: bsdtar に `-s` が無い、`extensions\node_modules` を拡張と数えていた、知らない環境変数で PowerShell の例外がそのまま出た、`[IO.File]::Replace` に `$null` を渡すと空の文字列になる（このとき戻しが働き、元の場所が元どおりになったことも確かめた）、`//` で始まる UNC を絶対パスと認めていなかった。
- 外部の事実の出典:
  - 本家 1.146.0 のソース（`C:\b\wt\1.146.0`。読むだけ）: `build/gulpfile.vscode.ts`（出力の場所、CLI と exe の名前）、`build/lib/util.ts`（`getVersionedResourcesFolder`）、`build/lib/extensions.ts`（`excludedExtensions`）、`src/mainImpl.ts`・`src/vs/platform/environment/node/userDataPath.ts`（ユーザーのデータの場所）、`product.json`（`win32VersionedUpdate` が無い、`licenseFileName`）、`package.json`（`nativeBuild.target`、`typecheck-client`）
  - pnpm の `--frozen-lockfile` の既定（CI では真）と `--no-frozen-lockfile`: https://pnpm.io/cli/install （12.x の資料）
  - bsdtar の `-s` が無いこと: この PC の `C:\Windows\System32\tar.exe` の出力

## テストの入口（曹参へ）

詳しくは `build-switch-design.md` の 2.1・2.2・3.3・4.1・5.1。

- `scripts/lib/local-config.mjs`: `resolveLocalConfig({ configPath, overrides, env })`、`validateLocalConfig(obj)`、`expandEnv(value, env)`、`parseLocalConfig(text)`、`localConfigPath(env)`。期待: 無いファイル → 既定値（`sources` がすべて `default`）、`{"InstallRoot": ...}` → 例外、`keepVersions: "3"`・`0`・`1.5` → 誤り、`%NO_SUCH%` → 例外、`relative\path` → 例外、`C:\` は `C:\` のまま、`C:\x\` → `C:\x`、オプションが local.json に勝つ。
- `scripts/lib/local-config.ps1`（ドットで読み込む）: 同じ規則の `Resolve-ShukoLocalConfig`・`Test-ShukoLocalConfig`・`Read-ShukoLocalConfig`・`Write-ShukoLocalConfig`・`ConvertTo-ShukoLocalConfigJson`。Node.js と PowerShell で同じ入力に同じ合否を出すことを照らすとよい（試しでは4通りで一致）。
- `scripts/build.mjs`: `parseArgs`・`selectSteps`・`nextLabel`・`childEnv`・`appliedUnitsFrom`・`parseExcludedExtensions`・`checkBuiltinExtensions`・`findAppDir`・`resolveEditorLayout`・`zipFolderName`・`quoteCmdArg`。例: `nextLabel("1.146.0", ["1.146.0-1","1.146.0-3","1.146.0-x","1.145.0-9"])` → `"1.146.0-4"`、`selectSteps("postprocess", null)` → `["postprocess","zip"]`、`zipFolderName("Code - OSS","1.146.0-1")` → `"Code-OSS-win32-x64-1.146.0-1"`。コマンド: `node scripts/build.mjs <tag> --dry-run [--config <file>]` は終了コード 0 で JSON（`result: "dry-run"`、`plan`、`checksBeforeRun`）。`--from postprocess --package-dir <小さな出力> --keep <file> --removals <dir> --build-root <試しの場所> --record <json>` で後処理と zip を試せる（`trial-log.md` の b1・b2）。
- `scripts/install-extensions.mjs`: `orderForInstall`・`isLanguagePack`・`vsixCachePath`・`parseListedExtensions`・`compareInstalled`・`scanJsonc`・`setArgvLocale`・`argvPathFor`。`setArgvLocale` の期待の例は設計の4.1の表。どの入力でも結果が `\n}` で終わり、`scanJsonc` で読み直して `locale` があること。
- `scripts/switch.ps1`・`scripts/configure.ps1`: 台本の中の関数（`Test-EngineRange`・`Get-PreviousLabel`・`Get-RemovableVersions` など）は、ドットで読むと main まで走るので、台本を引数つきで走らせて標準出力の JSON と終了コードを見るのが早い。試しの場所は `-ConfigPath` で渡す（`trial-log.md` の5・6節の形）。
- テストが要る点: Node.js と PowerShell の local.json の規則の一致、`setArgvLocale` のコメント・末尾の `,`・空のオブジェクト、`Get-RemovableVersions`（current が数に入る、ラベルの並べ方）、`checkBuiltinExtensions` の `notShipped` と `missingKeep` の分け方。

## docs/ との食い違い

`doc-corrections.md` の 15 件。要点:
- 02 の2節の図: gulp の出力は `C:\b\wt\VSCode-win32-x64`（作業ツリーの親の直下）。
- 02 の4節の8: tar.exe で zip は作れた。`-s` が無いので改名でなくジャンクションと `-H`。
- 02 の4節の4: ロックファイルは6つ。`--no-frozen-lockfile` を明示する。
- 02 の6節: exe・CLI の名前とユーザーのデータの場所はソースで確かめた。history.txt の形と `-Previous` の規則を決めた。
- 02 の6.1: switch.ps1 は台帳（自分のリポジトリ）も読む。読み方の細目を決めた。

## 未解決の点

1. **ビルドの一連は未実行**: install・typecheck・package と、自分のビルドの出力（`Shuko.exe`、`resources\app` が直下か）は、道具の導入の後に確かめる。そのとき `C:\b\wt\1.146.0` に当てると prepare.mjs が次から拒むので、`--fresh` か別の作業ツリー（`--worktree`）を使う。
2. **展開の役目**: switch.ps1 に `-Zip`（版のフォルダへの展開）を足した。docs/02 の6.1 の表では展開は `take-in.mjs`・`adopt.mjs` の役目なので、それらができたときに switch.ps1 の入口を使うかを決めてほしい。
3. **prepare.mjs の local.json の読み方**: prepare.mjs は自分の `resolveBuildRoot` を持ち、知らないキーや相対パスを止めない（共通の部品より緩い）。build.mjs からは `--build-root` を渡すので食い違いは出ないが、prepare.mjs を共通の部品に置き換えるのがよい（今回の書き込み先の外なので触っていない）。
4. **VSIX のキャッシュの場所**: lock-fetch.mjs の既定は `C:/b/p0/vsix`、install-extensions.mjs の既定は `<buildRoot>\cache\vsix`（docs のとおり）。lock-fetch.mjs の既定を変えるか、取り込みで `--out` を渡すかを決めてほしい（doc-corrections の13）。
5. **スタートメニューと PATH の登録の手順書**: brief の指示で試しでは触れず、configure.ps1 も既にあるものを向け直すだけにした。初めての登録の手順書をどこに書くか（docs/ か README か）を決めてほしい。
6. **動いているエディタの確かめ**: その瞬間のプロセスだけを見るので、短い CLI の実行とはすれ違う（試しの s7 の1回目）。エディタの画面を開いている場合は捕まえられる見込み（実際の画面での確かめはしていない）。
7. **試しの残り**: `C:\b\trial-install\`（版のフォルダ3つ、portable に拡張8件＋1件）と `C:\b\trial-build\`（zip 2つ、小さな出力）が残っている。大岡越前守の検証で使えるよう残した。要らなくなったら消してよい（公式の zip の写しの分で、合わせて 2 GB 前後の見込み。数えてはいない）。
8. **普段使いのデータに触れていないことの直接の確かめ**: CLI は `VSCODE_PORTABLE` と `--extensions-dir` を付けて走らせたが、`%USERPROFILE%\.vscode\` が変わっていないかは、蒙恬の読める場所の外なので見ていない。
9. **権限**: 試しで `node scripts/lib/*.mjs` と `powershell -File scripts/lib/*.ps1` は許可に無く、部品を直接は走らせられなかった（build.mjs と configure.ps1 を通して確かめた）。今のままで進められるので、追加は求めない。

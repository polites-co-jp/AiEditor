# 検証の記録: Phase 1 の検証（2）（スモークの台本の差し戻しの直し、監査の台本の軽微な直し）

- 検証: 大岡越前守（2026-11-13）
- 実行の記録: `records/phase1/smoke-verify2-official-1.146.0.md`

## 1. スモーク: A〜F の直しのレビュー

読んだもの: `tests/smoke/probe/extension.js`、`tests/smoke/lib/{common,env,fixtures,run}.mjs`、`tests/smoke-run.mjs`・`smoke-launch.mjs`・`smoke-stop.mjs`、`tests/smoke.test.mjs`、`tasks/2026-11-13-p1-smoke/handoff-notes.md`（差し戻しへの対応・合図後の実行の結果）。

| 指摘 | 直し | 確かめ | 判定 |
|---|---|---|---|
| A. probe が2つめのウィンドウでも動く | `activate()` の冒頭（`result` を作る前）で、`workspaceFolders[0]` が `cfg.ws` でなければ戻る（extension.js 47〜48 行） | 実機: window2 で probe は起動した（window2 の exthost.log 19 行目）が、`probe-result.json` は window1 の `done: true`・33 項目のまま | 満たす |
| B. 置換 | `base.replace`（433〜460 行）。`findInFiles` の `query`/`replace` 引数で検索語と置換語を渡し、1件置換（確認なし）を行う。`base.search` より前に呼ぶ | 実機: PASS。`ws\` の全ファイルを fixtures と照らし、意図しない変更なし（下の 1.1） | 満たす |
| C. JSON の補完 | `lang.json.completion`（`$schema` のローカルの enum） | 実機: PASS（3 件に red） | 満たす |
| D. 基準を3回の和に | `mergeBaseline`・`--merge-baseline`。基準のファイルは `runs: 3`、鍵 4 個、`seen` がすべて 3 | 単体テスト 2 件。実機の比べは PASS | 満たす |
| E. 日本語の表示 | `--prime`（smoke-run）と、既定で起動し直す smoke-launch | 実機: `base.ui-language` PASS（`ja`） | 満たす |
| F. dotenv の2候補の事実 | `lang.env.compare`（INFO）、`--dotenv a|b` | 実機（a）: 申告の表の a 列と同じ値（診断 0 件、補完 12 件） | 満たす |
| 軽微 | `smoke-stop` は `runs` 直下だけ、`stopTree` は根の実行ファイルを照合、`--keep-runs` | 下の 1.3 | 満たす |

### 1.1 置換が別のファイルを書き換えない形か

- 置換の確認は、他の確認より前（ターミナルの後、`base.search` の前）に呼ぶ。そのため検索ビューに前の検索語が残らない。単体テストが呼ぶ順を確かめている（`replaceCheck()` が `check('base.search'` より前）。
- 検索語 `replace_me` は、fixtures では `edit/replace.txt` にしか無い（`tests/` を検索して確かめた）。置換語の引数が効かなかった場合でも、置換されるのは `replace_me` を含む `edit/replace.txt` だけ。
- `--prime` の最初の起動は `--extensionDevelopmentPath` も `AIED_SMOKE_CONFIG` も渡さない（run.mjs 317〜319 行）。probe は動かず、置換は1回だけ。
- 実機（`official-20261113T141800`）: `ws\` の `.git` を除く全ファイルの中身を読み、fixtures.mjs と照らした。変わっていたのは意図した3つだけだった。`edit/replace.txt` は `replaced_ok`、`edit/target.txt` は `smoke-edit-before`、`tracked.txt` は `changed` の行が増えた。`docs/readme.md` は `# smoke` / 空行 / `smoke_needle` のまま。`base.ripgrep` も readme.md の `smoke_needle` を見つけて PASS。
- 残る弱さ（判定には入れない）: 「ほかのファイルが変わっていない」ことを台本が自分では確かめない。readme.md の事故は `base.ripgrep` が落ちて気づけるが、ほかのファイルが変わっても FAIL にはならない。3節の H を参照。
- 判定: 満たす。

### 1.2 `Get-CimInstance` の JSON の文字コード

- `listProcessesOnce`（common.mjs 154〜166 行）: `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` を先に置き、Node 側は `encoding: 'utf8'` で受ける。先頭の BOM（U+FEFF）は正規表現で外す（文字 U+FEFF が入っていることを検索で確かめた）。
- `listProcesses` は3回まで試し、読めなければ投げる。空の一覧を返して「止める木が無い」と誤る形ではなくなった。投げた場合は `smoke-run.mjs` の catch が `emergencyStop()`（置き場所の名前で木を探して止める）を呼び、終了コード 2 を返す。
- 実機: 単体テスト `listProcesses`（自分の PID を含む配列）が通った。スモークの実行でも木 27 個の取得と止めた後の確認が働いた。
- 確かめられなかったこと: 日本語のコマンドラインを持つプロセスがある状態での再現。許可の形で任意のプロセスを起動できないため。修正の考え方（出力の文字コードを UTF-8 にそろえる）は原因の説明と合う。
- 判定: 満たす。

### 1.3 `--keep-runs` が `runs\` の下だけを消すか

- `pruneRuns`（run.mjs 115〜126 行）が消す対象は `readdirSync(<root>\runs)` の、ディレクトリである直下の名前だけ。`selectPrune` は名前が `-<8桁>T<6桁>` で終わるものだけを選ぶ。今回の置き場所は除き、さらに1つずつ `assertSafeWritePath(…, root)` を通す。`readdir` の `withFileTypes` では、ジャンクションやシンボリックリンクは `isDirectory()` にならないので、対象から外れる。
- `ext\`、基準のファイル（`C:\b\smoke\` の直下）、名前の読めないフォルダは対象外。単体テスト（`pruneRuns`、`selectPrune`）がこれを確かめている。
- 実機: 実行の前の `runs\` は 10 個（`manual-20261113T140546` を含む）。今回の分で 11 個になり、最も古い `official-20261113T140132` だけが消えた（`smoke-result.json` の `pruned`）。基準のファイル・拡張の印・`ext\1.146.0-official\extensions.json` は、実行の前後で sha256 が同じ。`ext\` の4つのフォルダも残っている。
- `--root` を渡すと、消す範囲は `<--root>\runs` の直下になる。利用者が指定したときだけで、既定では `C:\b\smoke\runs`。
- 判定: 満たす。

## 2. スモーク: テストと実行

| コマンド | 結果 |
|---|---|
| `node --test tests/smoke.test.mjs` | tests 60 / pass 60 / fail 0（申告どおり） |
| `node tests/smoke-run.mjs --prime --baseline C:/b/smoke/baseline-official-1.146.0.json` | PASS 47 / FAIL 0 / SKIP 0 / INFO 9、終了コード 0。`probe-result.json` は `done: true`・33 項目 |

- 拡張は「拡張のフォルダを使い回す: C:\b\smoke\ext\1.146.0-official」。台帳から入れ直していない（`base.ext-install` は「8 件（使い回し）」）。実行の直前に `git status` で `extensions.lock.json` が未変更であることを確かめた（使い回しの判定は、台帳から選ぶ VSIX の印で決まるため）。
- 足したテスト 14 件（46 → 60）を読んだ。純粋な関数（`mergeBaseline`・`selectPrune`・`pruneRuns`・`isRunDirPath`・`rootMatches`・`parseArgs`）は入出力で確かめている。probe の側（A・B・C・E・スニペット）は、ソースの文字列の検査にとどまる（エディタの API は単体では動かせない）。実機の確かめは上の実行で補った。実装に合わせて期待値を緩めた形跡は無い。
- 判定: 合格。

## 3. 監査: 軽微な3点の直し

`git diff scripts/netaudit.ps1 tests/netaudit.tests.ps1 tests/measure.tests.ps1` を読んだ。`scripts/measure.ps1` は変わっていない。

| 指摘（0-5 の検証の 1.6） | 直し | 判定 |
|---|---|---|
| 1. Node の接続に Chromium の強い名前が付く | `New-DestinationRows`: `OnlyRoles` を持つ対応表（netlog。`utility-network`・`main`）は、行の Roles がすべてその中にあるときだけ名前を付ける。ほかの役割が混じれば `名前 [netlog, shared with other process]` のヒントに落とす（`HostKey` は IP のまま、`Resolved`・`Allowed` に効かない）。DNS キャッシュは従来どおり | 満たす |
| 2. `ExtraEnv` の戻しのテストが無い | measure.tests.ps1 に4件（子が値を見る・親に残らない、元の値を戻す・`VSCODE_PORTABLE` も戻る、起動に失敗しても戻る、`-StdoutFile`/`-StderrFile`） | 満たす |
| 3. 冒頭の説明のファイル名 | 16 行目を `named-hosts.csv` に直した | 満たす |

- 役割の名前の照合: `utility-network` と `main` は `measure.ps1` の `Get-ProcessRole` が返す名前と同じ。試しの出力 `trial/net60/destinations.csv` の Roles 列（`extension-host utility-network`、`agent-host extension-host utility-network`）とも合う。
- 足したテスト4件（netaudit）は、直しを戻すと落ちる形になっている。拡張ホストだけの行で `HostKey` が名前になれば1件目が落ちる。網と拡張ホストが混じった行で、許可の一覧にある名前が付けば2件目の `Allowed` が落ちる（同じ `$list` で名前が付くと許可になることは、既存のテストが示している）。網だけの行と DNS キャッシュの経路は、前と同じ動きであることを確かめている。
- measure の4件は、実際に `cmd.exe` を子として起動し、子が見た値を終了コードで返させる。親の環境に残らないことも確かめている。

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | passed: 102  failed: 0（申告どおり） |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | passed: 138  failed: 0（申告どおり。netaudit.ps1 の構文と ASCII だけかの検査を含む） |

- 判定: 合格。エディタを起動する監査の試しは、依頼どおりしていない。
- 軽微な点（判定には入れない）: audit.md の Limits の claude.exe の行（`… or when the same address is in the net log.`）が、直しの後の動きと合わない。claude.exe の行の役割は `claude-cli` なので、ネットのログの名前は今はヒントにしかならない。下の L。

## 4. 普段使いのデータと `.lock`

台本の結果で確かめた（`~/.claude/ide/` と `~/.vscode/` は `read_paths` の外なので直接は見ていない）。

- `safety.daily-argv`: PASS（`~/.vscode`・`~/.vscode-oss` の `argv.json` は前後で同じ）。
- `.lock`: 増えたのは3個で、3個とも自分のもの。18660 は prime の本体 48916、19317・56676 は本番の本体 4404 で、いずれも開いたフォルダが ws。後始末で消したのはこの3個だけ（`smoke-result.json` の `locks.removed`）。消す候補は「起動の前の一覧に無く、増えたもの」に限られる。前からある普段使いの `.lock` は候補に入らない（`newLocks`・`lockBelongsTo`）。`claude.lock-foreign` は出ていない。
- 書き込み先: 置き場所は `C:\b\smoke\runs\official-20261113T141800\`。`VSCODE_PORTABLE` は `user\`、`--user-data-dir`・`--extensions-dir`・`--logsPath` も `C:\b\smoke\` の下。
- プロセス: 止めたのは起動した PID 4404 の木 27 個だけ。残り 0、孤児 0。
- 判定: 満たす。

## 5. 指摘（判定には入れない。G は直すまで当てにしないこと）

- **G（曹参・要修正）: probe の最後の一覧（動作中の拡張・登録済みコマンド）が毎回失敗している。**
  - 根拠: `probe-result.json` に `"snapshotError": "Cannot read properties of undefined (reading 'fsPath')"`、`"extensions": []`。`runs\` に残る 10 回すべて同じで、`commands.json` は1つも無い。
  - 原因: extension.js 115 行の `e.packageUri.fsPath`。VS Code の `Extension` の API に `packageUri` は無い（`extensionUri`・`extensionPath` がある）ので、最初の1件で投げる。
  - 影響: `smoke-design.md`（77・153 行）と初回の引き継ぎ（未解決の 3）は「`commands.json` を実行ごとに残し、`absentCommands` はこの一覧で足りる」としているが、実際には作られていない。`smoke-result.json` の `probe.extensions`・`commandCount`・`diagnosticsTotal` も空。誤りは `snapshotError` に残るだけで、どの確認も落ちない。
  - docs/06 の5節の「自」の項目は、ほかの確認（`claude.running` など）で覆えているので、今回の合否には入れない。ただし、Phase 2 で `absentCommands` に使う前と、蒙恬のビルドに向ける前に直す必要がある。
  - 直し方: `extensionUri.fsPath`（または `extensionPath`）を使う。`run.mjs` で `probe.snapshotError` を FAIL（少なくとも見える項目）にする。
- H（曹参・軽微）: 置換の後に「ほかのファイルが変わっていない」ことを台本が確かめていない（1.1）。fixtures のうち変えるはずのない全ファイルを、実行の後に照らす確認を足すとよい。extension.js 431 行のコメント「『すべて置換』を実行し」も、今の実装と合わない。
- I（曹参・軽微・推定）: `smoke-launch.mjs` の prime は Claude Code の入った本体を強制終了する。そのため prime が作った `~/.claude/ide/<port>.lock` が残る見込みで、smoke-launch には `.lock` の後始末が無い。普段使いの `.lock` に触れるわけではないが、古い `.lock` が普段使いの場所に溜まる。`~/.claude` は `read_paths` の外なので、実物は見ていない。
- J（曹参・軽微）: `smoke-design.md` に `--prime`・`--merge-baseline`・`--keep-runs` の使い方が無い（引き継ぎで 2.5 に足す予定とした分）。docs/06 の5節には入っている。
- K（リーダー）: `--keep-runs` の既定 10 により、以前の記録が指す置き場所（検証（1）の `ooka-verify-20261113T125822`、曹参の初回の確定2回）はすでに消えた。記録の根拠を残したい実行は、ラベルを変えても消える（名前の形が同じなら対象になる）。残すなら、`--keep-runs` を大きくするか、記録に要点を写す運用にする。
- L（曹参・軽微）: netaudit.ps1 の audit.md の Limits の claude.exe の行を、直しの後の動きに合わせる（3節）。
- M（リーダー）: `git status` で `tests/probe-dns.ps1`（追跡済みの調べ用）が変更されている。対象外として読んでいない。`tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` もまだある。コミットに混ぜるかどうかは確かめてほしい。

## 6. 判定

| 項目 | 判定 |
|---|---|
| 1. スモーク: A〜F の直し（置換・文字コード・`--keep-runs` を含む） | 合格 |
| 2. スモーク: 単体テスト 60 件、公式の zip での `--prime --baseline` の実行 | 合格（60/60、PASS 47 / FAIL 0、`done: true`） |
| 3. 監査: 軽微な3点の直しとテスト | 合格（102/102、138/138） |
| 4. 普段使いのデータ・`.lock` | 合格 |

全体: **合格**。G は判定に入れないが、Phase 2 の `absentCommands` に使う前と、蒙恬のビルドに向ける前に直す必要がある。

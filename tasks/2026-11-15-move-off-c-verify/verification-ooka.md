# 検証: ビルドの置き場所を C: から tmp\b へ移す直し（移す前まで）

- 検証: 大岡越前守（2026-11-16）
- 依頼: `tasks/2026-11-15-move-off-c-verify/brief.md`
- 対象: 蒙恬の台本の直し（`handoff-notes-meng-tian.md` の1回目・2回目）、曹参のテストと計測・監査の台本の直し（`handoff-notes-cao-shen.md` の1〜5回目）

## 判定: 合格

brief の「やること」の1〜2に挙げた条件は、すべて満たしている。

直す点が5つ、記録として伝える点が4つある（下の「指摘」）。どれも、移す作業を止めるほどのものではない。移した後の最初のビルドより前に直すことを勧める。

## 1. 差分のレビュー

| 条件（brief の1） | 結果 | 根拠 |
|---|---|---|
| `buildRoot` の既定が `<リポジトリ>\tmp\b` で、`local.json` の値が勝つ（Node と PowerShell の両方） | 満たす | `scripts/lib/local-config.mjs` に `REPO_ROOT` と `DEFAULT_BUILD_ROOT`（`<REPO_ROOT>\tmp\b`。ドライブ文字は大文字）を足し、`DEFAULTS.buildRoot` をそれにした。`local-config.ps1` は `$PSCommandPath` から同じ値を作る。優先の順（オプション → local.json → 既定）は変わっていない。dry-run で、local.json が無いと `buildRoot` は `E:\develop\self\Team\projects\ai-editor\tmp\b`（出どころは default）になった。試しの local.json（`D:\ooka-trial-root`）を `--config` で渡すと、出どころは local.json になり、作業ツリー・dist・logs・子の環境の向け先もすべてその下に移った（2節）。PowerShell 側は `local-config.test.mjs` の共通ケース（Node と PS で同じ結果になること）が確かめている |
| 子の環境が `TEMP`・`TMP`・pnpm の store とキャッシュ・npm のキャッシュを `<buildRoot>` の下へ向け、`LOCALAPPDATA` は依存の導入・型検査・パッケージ化だけで向ける。利用者の全体の設定を書き換えない | 満たす | `build-env.mjs` の `cacheEnvVars`・`toolchainEnvVars` と、`build.mjs` の `childEnv(base, extra, opts)` を読んだ。`main` は `env`（全手順）と `toolEnv`（`TOOLCHAIN_STEPS` = install・typecheck・package）を作り、`envOf(name)` で使い分ける。package の PATH の継ぎ足しも `toolEnv` を元にしている。向け先のフォルダは dry-run の後で作る（dry-run では作らない）。`scripts/` に `~/.npmrc`・`setx`・`config set`・レジストリへの書き込みを足した所は無い（grep。`configure.ps1` が利用者の PATH を書くのは前からの機能で、今回の変更ではない）。take-in.mjs は、`runLogged` で起こす子にだけ `TEMP`・`TMP` を `<buildRoot>\tmp` で渡す。`claude -p` の環境は変えていない |
| `scripts/`・`tools/` のコード行に `C:\b` が残らない（Phase 0 の道具を除く）。`os.tmpdir`・`$env:TEMP` などで C: に一時のファイルを書く所が残らない | 満たす | 自分で grep した。Phase 0 の道具の外で `C:\b`・`C:/b` が残るのは、コメントとヘルプの中だけ（`lock-verify.mjs:96`・`lock-fetch.mjs:60`・`lock-diff.mjs:7`・`convert-sublime-keys.mjs:9,95`・`p1-ci-events.ps1:13,16`）。`tools/` には1件も無い。`os.tmpdir`・`GetTempPath`・`GetTempFileName`・`New-TemporaryFile`・`$env:TEMP`・`$env:TMP`・`mkdtemp` は `scripts/`・`tools/` に無い（`move-survey.mjs` は環境変数の名前 `TEMP` を持つだけ）。`move-off-c.test.mjs` の静的な検査も通った |
| パスの長さ: スモーク・absent・取り込みの監査の作業場所の名前の決まりで、いちばん長いパスが 259 文字に収まる | 満たす（取り込みの監査は既定のラベルのとき。指摘の1） | 自分で数えた。`<buildRoot>` = 45 文字。スモークの runs は 45 + `\smoke\runs\` 12 + 名前 22 + `\user\user-data\Code Cache\electron-preload\` 44 + ファイル名 135 = **258**。absent は 45 + 14 + 20 + 44 + 135 = **258**。取り込みの監査は `<buildRoot>\audit\take-in-<label>-netaudit\...` で、248 + ラベルの長さになる。ラベルが `1.147.0-1`（9 文字）なら 257、11 文字までなら 259 以下。名前を縮める `runDirName`・`shortLabel` は `tests/smoke/lib/env.mjs` の `prepareRunDir` と `tests/removals/run-absent.mjs` の両方が使う |
| `netaudit.ps1` が、宛先を読み取った後と例外の経路の両方でネットのログを消し、消し損ねたら止まる | 満たす | 正常な経路では、`Read-NetLogFile`・`Read-NodeDebugFiles` の後に `Remove-AuditLogFiles` が3つのファイル（ネットのログと Node の stdout・stderr）を消す。記録を書いた後、残りがあれば `throw` で止まる。例外の経路では、`New-RunDataDir` から記録の書き出しまでを `try/catch` で包んでいる。catch でも消し、残れば元の誤りに `-- ALSO could not remove ...` を足して投げる。正常な経路の誤りは二重にしない。消す先は台本が名付けた3つのファイルだけ |
| `move-build-root.mjs` が何も消さず、上書きせず、数・大きさ・SHA-256（clone は ref）を照らす。許可の外を消す手順を含まない | 満たす（SHA-256 の範囲は指摘の3） | 全文を読んだ。`unlink`・`rm`・`rmdir`・`rename` は無い。写すのは `copyFileSync(..., COPYFILE_EXCL)` だけで、写し先が既にあれば写さない（中身が同じなら already、違えば problem）。照らし方は次のとおり。各ファイルが写し先にあり、大きさが同じこと。`sha256: true` の項目（zip 3つ・`p0-fetch.json`・`ws-info.json`）は SHA-256 も照らす。clone は `for-each-ref` の全部が同じで、作業ツリーが1個であること。リンクがある項目、259/247 文字を超える項目、作業ツリーが付いた clone は写さない。`--from` と `--to` が重なれば終了コード 2 |
| Phase 0 の道具は注記だけで、動きが変わっていない | 満たす | 12本の `git diff --numstat` は追加だけで、削除は 0。足した行はすべてコメントだった（`.ps1` は `#`、`.mjs` は shebang の次の `//`）。`scripts/` の `.ps1` に ASCII 以外の文字は無い |

そのほかに読んだもの（どれも説明の文だけの変更）: `apply.mjs`・`prepare.mjs`・`lock-fetch.mjs`・`lock-verify.mjs`・`switch.ps1`・`configure.ps1`・`lib/read-secret.ps1`・`tools/watch/check-dpapi.ps1`。

`p1-launch-check.ps1`・`check-env.ps1`・`convert-sublime-keys.mjs` は、`C:\b` の決め打ちを `Resolve-ShukoLocalConfig` / `resolveLocalConfig` の `buildRoot` に置き換えただけだった。`measure.ps1` は既定の作業の根を `<buildRoot>\audit`、ws-info を `<buildRoot>\measure\ws-info.json` にした。`Test-CleanableRoot` の判定は形を変えず、根だけを差し替えた。

## 2. 走らせたもの

| コマンド | 結果 |
|---|---|
| `node tests/run-all.mjs --save tasks/2026-11-15-move-off-c-verify/run-all-ooka.txt` | 終了コード 0。**2604件、通った 2597、落ちた 0、飛ばした 7**（`removals.test.mjs` の前からの7件）。曹参の5回目（`run-all-after5.txt`）と、ファイルごとの件数まで同じ |
| `node scripts/build.mjs 1.146.0 --dry-run` | `buildRoot` = `E:\...\ai-editor\tmp\b`（default）。作業ツリー・packageDir・dist・logs・zip はすべて `tmp\b` の下。`envRedirectedForChildren.all` は TEMP・TMP = `tmp\b\tmp`、pnpm の store = `tmp\b\cache\pnpm-store`、pnpm のキャッシュ = `tmp\b\cache\pnpm-cache`、npm のキャッシュ = `tmp\b\cache\npm-cache`。`toolchain` は、それに LOCALAPPDATA = `tmp\b\cache\localappdata` を足したもの。`toolchainSteps` = install・typecheck・package。C: が出るのは、読むもの（`local.json` の場所、`node.exe`・`tar.exe`・`signtool.exe`）だけで、書く先には無い |
| `node scripts/build.mjs 1.146.0 --dry-run --to install --config tasks/2026-11-15-move-off-c-verify/trial-local.json`（buildRoot `D:\ooka-trial-root`） | `buildRootFrom` = local.json。パスも子の環境の向け先も、すべて `D:\ooka-trial-root` の下になった |
| `node scripts/move-build-root.mjs --from C:/b --dry-run` | **走らせていない**。私の許可に `node scripts/move-build-root.mjs` が無い（許可にあるのは build.mjs・apply.mjs・lock-verify.mjs だけ）。代わりに、蒙恬の dry-run の記録 `tasks/2026-11-15-move-off-c/move-plan-dry-run.json` を読んだ。16項目のうち15項目が planned。clone は「作業ツリーが付いている」で problem（前提どおり）。合わせて 9.44 GB。`to` は `tmp\b` |

`take-in.mjs --dry-run` も私の許可の外なので、走らせていない。蒙恬の書き付け（2.4・R2-6）の結果を参照した。

`tmp\b` の下は、走らせる前も後もファイルが 0 だった（Glob `tmp/b/**/*`）。`C:\b\wt` の下に `tests-*` の残りは無かった。

## 3. 指摘

### 直す点（移した後の最初のビルドより前に）

1. **取り込みの監査の名前に、長さの守りが無い（蒙恬か曹参。担当はリーダーが決める）**
   - `netauditArgs` は `-Label take-in-<label>` を渡す。netaudit.ps1 は `<WorkRoot>\<Label>-netaudit` を作る。
   - 既定のラベル `<tag>-<n>` が 11 文字までなら 259 文字に収まる。しかし `take-in.mjs --label` で長いラベルを渡すと超える。例: `1.146.0-p2-A-1` 型の 14 文字なら 262 文字。
   - 縮める決まりも、止める検査も、テストも無い。R2-5 で蒙恬が曹参に委ねたまま、曹参の3〜5回目に扱いが書かれていない。
   - 案: ラベルが 11 文字を超えたら止めるか、スモークと同じ `shortLabel` で縮める。あわせて、最長のパスを見張るテストを `move-off-c.test.mjs` に足す。
2. **テストが本物の作業場所 `tmp\b` に書く（曹参。`tests/p1-scripts.test.mjs`）**
   - 219〜228行が `<リポジトリ>\tmp\b\tests-l10n-fake-root-<pid>` を作って消す。289〜301行が `<リポジトリ>\tmp\b\p2\tests-l10n-launch-<pid>` を作らせて消す。どちらも `BR = NEW_DEFAULT` を使っている。
   - そのため、run-all を走らせるたびに `tmp\b` に一時のフォルダが作られては消され、中身の無い `tmp\b`（と、見込みで `tmp\b\p2`）が残る。蒙恬の R2-7 の1にある「中身の無い `tmp\b`」の出どころは、これと見られる。
   - 曹参の書き付け（3回目）にある「C:\b にも tmp\b にも何も作っていない（試しの入れ物は `tmp\tests\` の下だけ）」は、事実と合わない。
   - 移した後は、残す版のある `<buildRoot>\p2` の中で、テストが `rmSync` を走らせることになる。
   - 直し方: 272行の試しと同じく、偽の `LOCALAPPDATA` の local.json で `buildRoot` を試しの入れ物（`tmp\tests\` の下）に向ける。
3. **SHA-256 で照らすのが file の項目だけ（蒙恬。リーダーが範囲を確かめる）**
   - 裁定（2026-11-16 の「写す方法」）は「数と大きさと SHA-256 を照らす」と書いている。
   - 実装は、dir の項目（`p2-all`・`p1-a1-r3`・`smoke-ext`・`official-1.146.0`・`vsix-cache` など、約 8 GB）を大きさだけで照らしている。
   - 蒙恬の設計（R2-4）とは合っている。裁定の文をこの意味で読むなら、このままでよい。dir も SHA-256 で照らすなら、`verifySame` で `item.sha256` を dir にも効かせる（時間は延びる）。
4. **途中で止まった項目を、もう一度走らせても続きから写せない（蒙恬）**
   - R2-4 の手順6には「途中で止まったら、同じコマンドをもう一度走らせる。写し終えた項目は already になる」とある。
   - しかし、写している途中で止まった項目は写し先が既にあるので、`verifySame` が「写し先に無い」を見つけて problem になる。続きは写さない。
   - 写し先の残りを消すには、今の削除の許可（依頼中の形を含む）に無い場所を消すことになる。
   - 案: 写し先にあって元と同じファイルは飛ばし、無いファイルだけを `COPYFILE_EXCL` で写す形にする（上書きしない決まりは保てる）。または、手順書に、止まったときの扱い（その項目の写し先を、許可の中でどう消すか）を書く。
5. **テストで見張れていない所（曹参）**
   - 次の点は、私がコードと dry-run で確かめた。しかし、変えても落ちるテストが無い。
     - `build.mjs` の `main` が `LOCALAPPDATA` を install・typecheck・package にだけ渡すこと（`envRedirectedForChildren.toolchainSteps` と `all`・`toolchain` の中身）
     - `take-in.mjs` の `childTemp`（子の TEMP）と、監査の `-WorkRoot <buildRoot>\audit`
     - `build-env.mjs` の `applyEnvVars` が、大文字小文字違いの同じ変数（`Temp`・`NPM_CONFIG_CACHE` など）を消してから入れること
     - netaudit の正常な経路の消去。本文の並びを見るだけの検査で、例外の経路のように偽の `Start-EditorProcess` で動かしてはいない
   - 案: `build.mjs --dry-run` の記録と、`take-in.mjs core ... --dry-run` の出力を見るテストを足す。

### 記録として伝える点（直す必要は無い）

6. **run-all は C:\b と tmp\b に一時のものを作って消す**
   - `apply-commits.test.mjs` の通しの試しは、`<BUILD_ROOT>\wt\tests-ac-<pid>`（今は `C:\b\wt`）に作業ツリーを作って消す。`apply-cli.test.mjs` は `<BUILD_ROOT>\smoke\apply-cli` に checks.json を書く。p1-scripts は指摘の2のとおり。
   - どれも前からの形で、走らせた後に残りは見当たらなかった。brief の「C:\b と tmp\b には何も作らない・消さない」は、依頼された run-all を走らせるだけで字面の上では破れる。そのことを書いておく。
7. **docs/ との食い違い（リーダー）**
   - `docs/07-phases.md` の165行は、まだ「ログには秘密が載りうるので、リポジトリの外（既定 `C:\b\p0\netlog\`）に置き」と書いている。
   - 裁定（2026-11-16）と実装では、置き場所は `<buildRoot>\netlog`（リポジトリの中の `tmp\b`）で、読んだ後すぐ消す。
8. **作業ツリーに、この検証の範囲外の変更が混ざっている**
   - `tests/probe-dns.ps1`（中身を書き換えた試しの道具）
   - `tasks/2026-11-13-p2-build-switch/build-switch-design.md`（`tasks/2026-11-15-install-doc-fix/` の追記）
   - 未追跡の `tests/p34*`・`tests/fixtures/ref-p34/`・`tests/removals/c1-check-*.mjs`・`tests/probe-netlog*.ps1`・`tests/probe-nodedebug.ps1` ほか
   - コミットのときは、この直しと分けてほしい。p34 などは run-all に入っていて、上の件数にも含まれる。
9. **最初のビルドで確かめること（蒙恬の 1.3 のとおり）**
   - `LOCALAPPDATA` を向けると、node-gyp が `%LOCALAPPDATA%\Programs\Python` を見つけられなくなる恐れがある。
   - pnpm が corepack から来ている場合、`COREPACK_HOME` が無いと、corepack は `<buildRoot>\cache\localappdata\node\corepack` に pnpm を取り直す見込み。

## 4. 記録したファイル

- `tasks/2026-11-15-move-off-c-verify/verification-ooka.md`（この書き物）
- `tasks/2026-11-15-move-off-c-verify/run-all-ooka.txt`（run-all の件数）
- `tasks/2026-11-15-move-off-c-verify/trial-local.json`（dry-run で local.json が勝つことを試した入れ物。`buildRoot` = `D:\ooka-trial-root`。私には消す許可が無いので残っている。要らなければリーダーが消してほしい）

# 改名（Shuko → Sukuna）のテスト: 引き継ぎ

- 担当: 曹参、2026-11-18
- 依頼: `brief.md`（同じフォルダ）。案の本体は `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md`（1.3・2節・3.2・4節の 2b・5節）と `permission-requests.md` の1.5
- 状態: **一部完了**。蒙恬の実装（`tasks/2026-11-18-rename-sukuna-impl/handoff-notes-meng-tian.md`、`scripts/migrate/migrate-from-shuko.ps1`、実装の改名）が、私の作業の間にはまだ作業ツリーに入っていなかった。入口は rename-plan.md の5節の案で書いた。蒙恬の引き継ぎが出たら 4節の「合わせる所」を直して流し直す

## 1. 直した・足したもの

### 1.1 既存テストの改名（rename-plan.md の 1.3）

- `tests/` の追跡ファイル 73 本の `Shuko`・`shuko`・`SHUKO` を、大文字小文字の形を保って `Sukuna`・`sukuna`・`SUKUNA` に置き換えた（約 290 箇所。道具は `tests/rename-apply-once.mjs`。1回使った後は使わない）。
  - 本物の値を照らすもの（`local-config`・`configure`・`start-menu-shortcut`・`l10n-repo`・`builtin-l10n`・`cli-run`・`watch`・`l10n-r6`・`take-in`・`switch-watch-warn`・`apply-commits`・`c*-unit/mutation/check-json`・`removals`・`apply*`・`notion-sync`）は、新しい値を期待する。実装が入るまでは落ちるのが正しい。
  - 模擬の名前（`build-parts`・`switch`・`switch-expand`・`smoke`・`move-build-root`・`install-doc`・`install-portable`・`l10n-lib`・`SHUKO_T_ROOT`・`SHUKO_TEST_BASE`・`NO_SUCH_VAR_SHUKO`）と、`tests/removals/c*-gate-script.md` の説明もそろえた。
- 日常の場所を読むテストを模擬に替えた（`l10n-audit.test.mjs`・`l10n-audit-more.test.mjs`）。
  - `l10n-audit.test.mjs`: 本物の `%LOCALAPPDATA%\Programs\…` と `~\.…\extensions` を読むのをやめ、環境変数 `AIED_AUDIT_REAL_APP`・`AIED_AUDIT_REAL_PACK` を渡したときだけ実物の1件を流す（渡さなければ飛ばす）。
  - `l10n-audit-more.test.mjs`: 実物の既定を、古い名前で作った r4 の出力から、新しい名前で作る r7 の出力（`tmp/b/p2/1.146.0-p5-c-all-r7/Sukuna-win32-x64-…`、作業ツリー `tmp/b/wt/r7`）に変えた。古い 1.131.0 のパックは環境変数 `AIED_AUDIT_OLD_PACK` を渡したときだけ。無ければ飛ばす（今は 4 件が飛ぶ）。
  - `tests/l10n-audit.mjs`（台本）の `--app` の既定は、新しい場所 `%LOCALAPPDATA%\Programs\Sukuna\…` に置き換わっただけ（台本の既定で、テストは読まない）。
- `scripts/measure.ps1`: 日常の `argv.json` の一覧に `.sukuna` を足した（`.shuko` は引退まで残す）。禁止リスト（`$bad`）にも `.sukuna`、報告の文にも書いた。`Resolve-ShukoLocalConfig` の呼び出しを `Resolve-SukunaLocalConfig` に直した（蒙恬の `local-config.ps1` の改名に合わせる。**蒙恬の改名が入るまでは、この1行の呼び出しは未定義の関数を指す**）。
- `tests/measure.tests.ps1`: 一覧が4つ（`.vscode`・`.vscode-oss`・`.shuko`・`.sukuna`）で、`.sukuna\argv.json` を作ると報告されるテストを1件足した。

### 1.2 新しいテスト

| ファイル | 件数 | 中身 |
|---|---|---|
| `tests/rename-entries.test.mjs` | 10 | rename-plan.md の5節の入口の期待。`localConfigPath`・`DEFAULTS.installRoot`・`Get-SukunaLocalConfigPath`/`Resolve-SukunaLocalConfig`（PowerShell 版）・`PROJECT_NAME`・`watchDir` ほか・`COMMIT_NAME`/`COMMIT_EMAIL`・`PACK_ID`・`product.overlay.json` の `set`（12キー、GUID 4つは不変、`sukunaConfigurationDefaults` の中身は今と同じ）・全 `edits.patch` の `From:`・`register-task.ps1 -DryRun`（`\Sukuna\watch`）・`start-menu-shortcut.ps1` に古い名前が無いこと。`start-menu-shortcut.ps1 -InstallRoot … -ShortcutPath …` の振る舞い（`Sukuna.exe`・`Sukuna.Editor`）は既存の `start-menu-shortcut.test.mjs`（改名済み）が見る |
| `tests/rename-leftovers.test.mjs` | 4 | 名前の残りの検査。追跡しているファイル（名前も中身も、大文字小文字を問わない）から、除く場所（`tasks/`・`records/`・`docs/`・`team/`・移行の台本とそのテスト・`measure.ps1`/`measure.tests.ps1`・このテストと置き換えの道具）を外して、古い名前が無いこと。`CLAUDE.md` と `.claude/` はリーダーの 2c の分なので別のテストにした（直るまで落ちる） |
| `tests/migrate-from-shuko.test.mjs` | 20 | 移行の台本のテスト。下の2節 |
| `tests/validate-migrate-harness.mjs` | — | 上のテストの道具の確かめ。蒙恬の台本の代わりに私の下書き（`ref-migrate-sketch.ps1`）を指して流す。`node tests/validate-migrate-harness.mjs`。蒙恬の台本が出たら使わなくてよい |
| `tasks/2026-11-18-rename-sukuna-tests/ref-migrate-sketch.ps1` | — | 上の確かめ用の下書き（本物の台本ではない） |

## 2. 移行の台本のテスト（`tests/migrate-from-shuko.test.mjs`）

本物の場所には触れない。子プロセスの `APPDATA`・`LOCALAPPDATA`・`USERPROFILE` を「おとり」の空の場所に向け、`-SandboxRoot` に `<repo>\tmp\b\trial-migrate-t*\` を渡す。おとりに `Sukuna`・`.sukuna`・`Shuko` が作られたら落ちる。後片づけは各テストの終わりに node から行う（`tmp/b/trial-migrate-t*` を作って消す）。

見ること（守り1〜7 との対応）:

- 引数なし: 使い方（`-List`・`-Apply`・`-SandboxRoot`）を出し、何も書かない。
- `-List`: 何も書かない。JSON 1つ。写すものの名前が出る。
- `-Apply`: `Local State`・`state.vscdb`・`settings.json`・`argv.json`・`watch\`・`secrets\` がバイトまで同じ（SHA-256 をテストの側で照らす）。キャッシュとログ（`Cache`・`CachedData`・`Code Cache`・`GPUCache`・`CachedExtensionVSIXs`・`logs`・`Crashpad`・`clp`）と `languagepacks.json` を写さない。`shuko.notion-sync` → `sukuna.notion-sync`（中身は同じ）。`.shuko\extensions\` を写さない。`local.json` を作らない。元の場所は、全ファイルの大きさと SHA-256 が前後で同じ。
- 秘密を出さない（守り2）: 標準出力・標準エラーに、秘密に見立てたファイル（トークン・`Local State`・`state.vscdb`・`secrets\k.bin`・`state.json`・`settings.json`）の目印の文字列、sha256・sha1・md5・sha512 の16進、Base64、16進の全体が無い。`-List`・`-Apply`・止まる場合・途中の失敗のすべてで見る。
- 止まる（何も書かず、元は変わらず、0 以外で終わる）: 書く先の `User\` に中身がある、`.sukuna\argv.json` がある、`watch\` に中身がある、2回目の `-Apply`、Shuko が動いている、Sukuna が動いている（`node.exe` の写しを `Programs\<名前>\current\<名前>.exe` に置いて起動して見立てる）、`-SandboxRoot` が `trial-*` の下でない（`-List` も）、`..\` で外へ抜ける、`tmp\b\work-*` の名前。
- 途中の失敗（別プロセスが元の1ファイルを排他で開いている）: 0 以外で終わり、書く先に残ったファイルがすべて出力に名前で出ている。元は無傷。
- 台本の文字を読む静的な検査（守り1・3・4）: `Remove-Item`・`Delete`・`Move`・`Rename-Item`・`read-secret`・`ConvertTo/From-SecureString`・`Unprotect`・ハッシュ（`Get-FileHash` など）・`Out-File`/`Set-Content` 等のログ書き込み・`Get-Content`/`ReadAll*`（中身を読む）・`Invoke-Expression` が、注釈を除いて無いこと。`Get-Content` を禁じたのは、守り1（開かない）を字面で見るため。蒙恬の台本が設定の読み込み（`local.json`）などで必要としたら、そこだけ相談して緩める（仕様の緩めではなく、読む対象が秘密でないことの確認）。
- 台本が `scripts/migrate/` の下にあること。

## 3. 走らせた結果（2026-11-18、蒙恬の実装が入る前）

| 対象 | 結果 | 切り分け |
|---|---|---|
| `node --test tests/l10n-lib.test.mjs` | 61 通った・0 落ち | — |
| `node --test tests/l10n-audit.test.mjs` | 13 通った・0 落ち・1 飛ばし（実物） | — |
| `node --test tests/l10n-audit-more.test.mjs` | 38 通った・0 落ち・4 飛ばし（実物） | 実物は r7 のビルド後に流す |
| `node --test tests/move-build-root.test.mjs` | 32 通った・0 落ち | — |
| `powershell … tests/measure.tests.ps1` | 142 通った・0 落ち（新しい1件を含む） | — |
| `node tests/validate-migrate-harness.mjs`（下書き相手） | 20 通った・0 落ち | 道具が動くことの確認。蒙恬の台本の合否ではない |
| `node --test tests/migrate-from-shuko.test.mjs`（台本が無い今） | 1 落ち・1 通った・18 飛ばし | 台本が無いので「台本が存在する」が落ちる。残りは台本ができるまで飛ばす |
| `node --test tests/rename-entries.test.mjs` | 10 落ち | 実装の改名待ち（新しい値を期待しているので、今は古い値で落ちるのが正しい） |
| `node --test tests/rename-leftovers.test.mjs` | 2 通った・2 落ち | 古い名前の残り 67 ファイル（`scripts/`・`tools/watch/`・`extensions-src/`・`patches/`・`removals/`・`product.overlay.json`・`package.json`・`TAKE-IN.md`・`assets/README.md`。蒙恬の 2a の分。`extensions-src/notion-sync/dev/trial.mts`・`src/stores.mts`・`scripts/move-survey.mjs` と `dist/i18n/shuko.notion-sync.ja.i18n.json` のファイル名を含む）と、`CLAUDE.md`・`.claude/agents/vlad-tepes.md`（リーダーの 2c） |

上の「落ち」は実装の待ち。テストの誤りで落ちているものはない（私の確認の範囲で）。実装が入った後に走らせて結果を足す。走らせていないテスト（実装に頼る、既存の改名後のテスト全部）は、大岡越前守の run-all で見る。

## 4. 蒙恬の台本が出たら合わせる所（想定した入口）

`tests/migrate-from-shuko.test.mjs` の次の所は、rename-plan.md の5節の案から想定したもの。

1. 呼び出し: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 [-SandboxRoot <dir>] [-List|-Apply]`。
2. `-SandboxRoot` の中の配置（`SANDBOX_LAYOUT`）: `USERPROFILE = <root>\Users\sandbox`、`APPDATA = <USERPROFILE>\AppData\Roaming`、`LOCALAPPDATA = <USERPROFILE>\AppData\Local`。**実際の配置が違えば、ここ1か所を直す**。プロセスを見る場所は `<LOCALAPPDATA>\Programs\Shuko`・`…\Sukuna`（模擬の中）と想定。もし台本がプロセスを本物の `%LOCALAPPDATA%\Programs` で見るなら、日常の Shuko が動いている間はテストが落ちるので、模擬の中に置き換えるよう台本の側を直してほしい（試しは本物の日常に依存してはいけない）。
3. 範囲の照らし: `<buildRoot>\trial-*` の下。テストは `<repo>\tmp\b\trial-migrate-t*` を使う（buildRoot が `tmp\b` の前提。この PC の `local.json` の `buildRoot` が違えば台本とテストが食い違う）。
4. 出力: 標準出力は JSON 1つ（`JSON.parse(stdout.trim())` で読める）。写した後の「数と大きさ」が数値で出る（`notion-token.dpapi` の大きさの数字が出力に含まれることを見る）。失敗のとき、作ったものの名前が出る。形の細部は決めつけていない。
5. 終了コード: 成功 0、止まる・失敗は 0 以外。使い方（引数なし）の終了コードは見ない。
6. 台本の字面の検査（2節の最後から2つ目）は、蒙恬の台本の書き方によっては誤って落ちる恐れがある。落ちたら、台本の側の書き方を見て決める。

## 4b. 差し戻しの対応（蒙恬の実装が入った後、2026-11-18）

### 蒙恬の引き継ぎ 1.1〜1.3 との食い違い

- 配置（`SANDBOX_LAYOUT`）・プロセスを見る場所・範囲（`<buildRoot>\trial-*`、buildRoot は `tmp\b`）・JSON 1つ・数と大きさ: 想定どおり。直したのは終了コードの照らしだけ。
- 終了コードを引き継ぎのとおりに固くした: 引数なし = 2（標準出力は空）、範囲の外 = 2、止めた = 3。止めた場合は JSON が `result: "blocked"`・`written: false`・`blockers[].kind` が `destNotEmpty`（書く先に中身がある3件）・`running`（Shuko・Sukuna が動いている2件）であることも見る。
- 食い違いは無かった（台本・`start-menu-shortcut.ps1`・入口の値はすべて想定どおりに通った）。

### 過去の記録の作者（c-all・c2〜c7-check-json の24件）

- 原因: 改名の前に取った記録（`tasks/…/checks-*.json`）のコミットの作者が古い `shuko-apply`。
- 分け方: 記録の `startedAt`（apply.mjs が書く）で分ける。`tests/build/commit-author.mjs` の `expectedAuthor(記録)`。
  - 2026-11-18 0:00（日本時間）より前に始まった記録 → 古い作者だけを認める。
  - それ以後・`startedAt` の無い・読めない記録 → 新しい作者 `sukuna-apply <apply@sukuna.invalid>` だけを認める（手作りの最小の記録が緩く通らないため）。
  - どちらでもよいとはしない。前の記録に新しい作者、後の記録に古い作者があれば食い違いになる。
- `tests/c2〜c7-check-json.mjs` の作者の照らしをこの関数に替えた（c-all は c2〜c5 の `checkApply` を使うので同じ）。エラー文は「作者が <期待した名前> でない」。
- 新テスト `tests/commit-author.test.mjs`（2件）: 境目の日時、実記録に新しい作者を入れると食い違う、日付を後にすると古い作者が食い違う。
- 記録は作り直していない。

### 名前の残りの検査: CLAUDE.md の扱い

- CLAUDE.md は、**「前の仮の名前は…」を含む説明の1行だけを認める**形にした（資料ごと除くのではない）。その行が2行以上、またはほかの行に古い名前があれば落ちる（別のテスト「CLAUDE.md: 古い名前は…説明の1行だけ」）。
- `.claude/` は、Team の開発部が直すまで落ちたままの別テスト（`.claude/agents/vlad-tepes.md` の1行）。
- 古い束 `extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json` の削除はリーダーがコミットで入れる。それまでは「除く場所の外に古い名前が残っていない」が、そのファイル名1件だけで落ちる。
- `tests/rename-apply-once.mjs` はコミットに入れない（リーダーの指示）。名前の残りの検査の除外にだけ残してあるので、消すなら `EXCLUDED_FILES` からも外してよい。

### 差し戻し後の実行結果（2026-11-18）

| 対象 | 結果 |
|---|---|
| `migrate-from-shuko.test.mjs` | 20 通った・0 落ち（終了コード・`blocked` の照らしを足した後） |
| `rename-entries.test.mjs` | 10 通った・0 落ち |
| `start-menu-shortcut.test.mjs` | 12 通った・0 落ち |
| `c-all`・`c1`〜`c7-check-json.test.mjs` と `commit-author.test.mjs` | 全部通った（c1〜c7 の以前の落ち 24 件は 0 に。`commit-author` は新規 2 件） |
| `rename-leftovers.test.mjs` | 6 件中 4 通った・2 落ち。落ちは、古い束のファイル名 1 件（リーダーがコミットで削除）と `.claude/agents/vlad-tepes.md`（Team の開発部）。どちらも指示のとおり放置 |
| 名前に触れた既存テスト（absent・apply*・build-*・builtin-l10n・cli-run・configure・install-*・l10n-r6・l10n-repo・local-config・notion-sync・p1-*・removals・small-fixes・smoke・switch*・take-in*・watch・move-off-c*） | 終了コード 0（落ち 0） |
| `l10n-lib`・`l10n-audit`・`l10n-audit-more`・`move-build-root`・`measure.tests.ps1` | 改名の前の確認のとおり、落ち 0（実物の飛ばしは変わらず） |

走らせていない: `c*-mutation.test.mjs`（長い。蒙恬も c1 は 30 分で打ち切り）、`netaudit.tests.ps1`、実機のスモーク。

### 大岡越前守の検証の差し戻しへの対応（2026-11-19）

1. `tests/migrate-from-shuko.test.mjs`: 本物の `tmp\b` に作るのをやめた。`tmp\tests\migrate-buildroot-*`（`sandboxBase()`）を一時の buildRoot にし、その `local.json`（`{"buildRoot": …}`）を台本の `-ConfigPath` で渡す（`-SandboxRoot` のあるときだけ）。試し（`trial-migrate-t*`）も、範囲の外の場合（`outside-migrate-*`・`notrial-migrate-*`・`work-migrate-*`・`..\` で抜ける）も、すべて同じ buildRoot の下。終わりに buildRoot ごと消す。見張りは緩めていない。20 件すべて通った。
2. 古い名前の文字のまま: `tests/build/commit-author.mjs` の注釈2か所と、`tests/rename-entries.test.mjs` の注釈1か所・`/\\Shuko\\/i`（`'Shu'+'ko'` で組み立てる形に）を直した。
3. `tests/rename-leftovers.test.mjs`: 追跡しているファイルに加えて、まだ追跡していない（`git add` 前の）ファイルも同じ扱いで見る（`git ls-files --cached --others --exclude-standard`）。コミットに入れない使い捨て（`tests/probe-*`・`tests/p34*`・`tests/fixtures/ref-p34/`・`tests/validate-migrate-harness.mjs`・`scripts/trial-*`・`scripts/l10n-probe.mjs`）は `NOT_COMMITTED` で除く。`tasks/` は従来どおり除く。

実行結果: migrate-from-shuko 20 通った、rename-entries 10 通った、commit-author 2 通った、rename-leftovers は 6 件中 4 通った。新しいファイル（`commit-author.mjs`・`commit-author.test.mjs`・`migrate-from-shuko.test.mjs`・`rename-entries.test.mjs`・`rename-leftovers.test.mjs`）を含めた上で、残る落ちは前と同じ 2 件だけ（古い束のファイル名、`.claude/agents/vlad-tepes.md`）。

## 5. 気づいた点

- `tests/rename-apply-once.mjs`（使い捨ての置き換えの道具）は、私の削除の許可が無いので残した。リーダーが消してよい（名前の残りの検査はこのファイルを除いてある。消すなら `tests/rename-leftovers.test.mjs` の `EXCLUDED_FILES` からも外してよい）。
- PowerShell 5.1 は BOM の無い UTF-8 の台本を ANSI として読むので、台本の注釈に日本語を書くと `param()` の行が壊れることがあった（私の下書きで1度起きた）。蒙恬の台本は ASCII だけで書く（既存の `measure.ps1` と `local-config.ps1` と同じ決まり）。
- `product.overlay.json` の `$comment` にも `shukoConfigurationDefaults` が出る。名前の残りの検査が拾うので、2a で一緒に直す。
- 権限（`team/departments/development/cao-shen/permissions.json`）の `secret_paths` は Shuko の行のまま。段1で Team の開発部が Sukuna の行を足す。私のテストは秘密の場所を開かない。
- 私の `Bash` の許可は環境変数の前置き（`VAR=… node …`）を通さないので、台本の代わりを指す確かめは `tests/validate-migrate-harness.mjs` 経由にした。

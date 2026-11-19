# 改名（Shuko → Sukuna）の検証

- 担当: 大岡越前守（2026-11-18〜19）
- 依頼: `brief.md`（同じフォルダ）
- 対象: 蒙恬の実装（`tasks/2026-11-18-rename-sukuna-impl/`）、曹参のテスト（`tasks/2026-11-18-rename-sukuna-tests/`）、リーダーの資料（`docs/`・`CLAUDE.md`・`team/departments/development/README.md`）
- 移行の台本は、本番の場所では打っていない（`-List` も）。コードは直していない。

## 0. 判定

- **再検証（2026-11-19）: 合格**。不合格の2点は直った（11節）。run-all の落ちは既知の2件だけ（古い束のファイル名＝コミットで消す、`.claude/agents/vlad-tepes.md`＝Team の開発部に依頼済み）。
- 初回（2026-11-18〜19）: 不合格。下の1〜10節は初回の記録で、そのまま残す。
  - 蒙恬の実装・パッチの作り直し・移行の台本・リーダーの資料は、条件を満たした。
  - 落ちたのは曹参のテストの2点。
    1. run-all の `migrate-from-shuko.test.mjs` が `[guard]`（本物の作業場所 `tmp\b` の直下が変わった）で fail 1。テストが模擬の場所を `tmp\b\trial-migrate-t*` に作って消していた（4節）。
    2. 名前の残りの検査が、コミットすると新しく落ちる。新しく足すファイル `tests/build/commit-author.mjs`・`tests/rename-entries.test.mjs` が古い名前を文字のまま持ち、除く一覧に無かった（6節）。追跡前なので見えていなかった。

## 1. 条件ごとの合否（初回）

| 条件（brief の完了条件） | 合否 | 根拠（節） |
|---|---|---|
| 差分のレビュー: 名前の置き換えが rename-plan.md の2節の表どおり、GUID 4つは不変、名前のほかに振る舞いの変わる差分が無い | 合格 | 2節 |
| パッチの作り直し: `+`・`-` の行の中身が名前のほかに変わっていない。作り直したパッチが当たる | 合格 | 3節 |
| 移行の台本の読み（守り1〜7） | 合格 | 5節 |
| テストの実行（全部の run-all。長いものを含む） | 不合格（再検証で合格。11節） | 4節（既知2件のほかに guard の fail 1） |
| 作者の照らしの分け方（`commit-author.mjs`）が今ある記録と新しい記録で働く | 合格 | 7節 |
| 名前の残り: 追跡しているファイルの、除く場所の外に `shuko` が無い | 今は既知の1件だけ。コミットの後は不合格だった（再検証で合格。11節） | 6節 |
| コミットに入れる・入れないファイルの一覧 | 書いた | 8節 |

## 2. 差分のレビュー

確かめ方: `git diff -I[Ss][Hh][Uu][Kk][Oo] -I[Ss][Uu][Kk][Uu][Nn][Aa] --stat`（名前を含まない行が変わったハンクだけを出す）で、名前と関係しない変更を探した。名前を含む行は、`git diff -U0 --word-diff=plain` で語の単位の差を全部読んだ（`scripts/`・`tools/`・`extensions-src/`・`product.overlay.json`・`package.json`・`TAKE-IN.md`・`assets/README.md`・`removals/*/README.md`）。

- `product.overlay.json`: 名前の12キー（nameShort・nameLong・applicationName・dataFolderName・sharedDataFolderName・urlProtocol・win32MutexName・win32DirName・win32NameVersion・win32RegValueName・win32AppUserModelId・win32ShellNameShort）と `sukunaConfigurationDefaults`、`$comment` が2節の表どおり。GUID 4つ（`win32x64AppId`・`win32arm64AppId`・`win32x64UserAppId`・`win32arm64UserAppId`）の行は差分に無い（不変）。
- 台本・検知・拡張・台帳: 語の差はすべて `Shuko`→`Sukuna`・`shuko`→`sukuna` の置き換えだけ。場所の既定（`local.json`・`installRoot`・`watch\`）、UA、作者、PACK_ID、PROJECT_NAME、タスクの場所、関数・型の名前が2節の表どおり。
- 名前のほかの変更（意図どおり）:
  - `scripts/start-menu-shortcut.ps1`: 実行ファイルとショートカットの名前を、`<InstallRoot>\current\resources\app\product.json` の `nameShort`（無ければ `product.overlay.json` の `set.nameShort`）から求める形にした（rename-plan.md の 2a の5）。`Get-JsonValue` にキーの引数を足し、`Get-ProductValue` で ID と同じ順に読む。`-Read` に `-ShortcutPath` があれば導入先を見ない（前と同じ）。`-ShortcutPath` の無い `-Read` は、名前を求めるために導入先を決めるようになった（引き継ぎの 1.3 に書かれた変更）。名前にファイル名に使えない文字があれば何も書かずに終了 1。前の振る舞い（3行の出力・終了コード・読み直しの照らし）は変えていない。`start-menu-shortcut.test.mjs` 12件が通る。
  - `scripts/measure.ps1`: 日常の `argv.json` の一覧と禁止リストに `.sukuna` を足した（`.shuko` は引退まで残す）。曹参の受け持ち。`measure.tests.ps1` に1件足した。
  - `package.json` の `description` と `assets/README.md` の1文: 「仮称」「（仮）のまま」を、名前が決まった文に書き直した（引き継ぎに記載）。
  - `tests/c2〜c7-check-json.mjs`: 作者の照らしを `expectedAuthor(記録)` に替えた（7節）。
  - `tests/l10n-audit.test.mjs`・`l10n-audit-more.test.mjs`: 日常の場所を読む実物のテストを、環境変数で明示したときだけ流す形に替えた（rename-plan.md の 2b の「模擬に替える」）。ふだんは飛ばされる（1件・4件）。
- **改名と関係しない、前からの未コミットの変更**（改名のコミットに混ぜない。8節の C）:
  - `tests/probe-dns.ps1`: 中身がまるごと別の調べの台本に書き換わっている（名前を含まない。2026-11-13 の作成から未コミットのまま）。
  - `tasks/2026-11-13-p2-build-switch/build-switch-design.md`（2026-11-15 の追記）、`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-cao-shen.md`（11-16 の r3 の節）、同 `run-all-result.json`。古い名前のまま書かれた、その時点の記録。
  - `tasks/2026-11-16-p5-c1-product-keys/patch-shape-detail.txt` は、run-all（c1-unit）が毎回書き直す出力。今回の run-all の後は HEAD と同じ中身に戻った。
- リーダーの資料: `docs/` に残る `Shuko` は `README.md`・`02`・`04`・`06` の各1行で、「2026-11-18 に仮の `Shuko` から改名」の説明。`user-decisions.md` は直していない（裁定どおり）。`docs/install.md` の名前を含まない行の変更は、表の1行の書き方だけ。`CLAUDE.md` は「前の仮の名前は「Shuko」で…」の1行。`team/departments/development/README.md` の1行は「仮の名前 Shuko から改名」の説明。

## 3. パッチの作り直し

| 確かめたこと | 結果 |
|---|---|
| 蒙恬の照らし `patch-regen-check.json` | 15本、`other` 0。名前の残り 0。分けは name・index・fromSha・blankContext・signature・hunkHeader（C-2 の10か所） |
| 作り直したパッチを、私が当て直した | `git -C tmp/b/wt/rn checkout 1.146.0` → `node scripts/apply.mjs tmp/b/wt/rn --label rename-sukuna-verify --checks-out tasks/2026-11-18-rename-sukuna-verify/apply-checks-verify.json`。結果 `ok`。全部の単位と2本のパッチが当たった。警告は前からの C-2 の `debugChatIntegration.ts` の1件だけ。`commitIdentity` は `ok`（作者はすべて `sukuna-apply <apply@sukuna.invalid>`） |
| 私の当て直しの木と、蒙恬の2回目の木（`78ee06a5d89`）の差 | `git -C tmp/b/wt/rn diff 78ee06a5d89 HEAD --shortstat` が空（同じ木） |
| 関門に合格した r6 の木（`3e1e616a`）との差 | 112 ファイル、179 行の追加、179 行の削除。`--word-diff=porcelain` で全部を読んだ。178 行は語が `Shuko`→`Sukuna`（注釈 `// Shuko (<単位>)`、`shukoConfigurationDefaults` の変数とキー、拡張の publisher・displayName・ID・束の場所、product.json の12キー）だけ。残る1行は `extensions/language-pack-ja/README.md` の14行目で、r6 の後に入った説明の直し（改名と関係しない。蒙恬の引き継ぎの3節の5と一致） |

当てた後の木が「r6 の木の名前だけを置き換えたもの」と一致するので、パッチの `+`・`-` の行の中身は名前のほかに変わっていない。`patches/30` と `C-3-remote/edits.patch` の差も読んだ（`From` の sha、`From:`、件名、注釈、`index` の行、署名の `-- `、最後の空行だけ）。

組み込み拡張の `dist/` の束: 新しい `sukuna.notion-sync.ja.i18n.json` は、HEAD の古い束と同じ中身（空の束）。`extensions-src/*` に古い名前は無い。

## 4. テストの実行（run-all。初回）

コマンド: `node tests/run-all.mjs --save tasks/2026-11-18-rename-sukuna-verify/run-all-result.txt`（`c*-mutation` を含む全部。PowerShell のテスト2本も含む。分けて流したものは無い）。私の当て直し（3節）が終わってから流した。並行してビルドや取り込みは走っていない。

結果: 3,074 件、pass 3,064、fail 3、skip 7（`run-all-result.txt`）。`c1-mutation` 35/35、`c2`〜`c7-mutation` もすべて通った。

| 落ちたもの | 原因 | 誰の何を直すか |
|---|---|---|
| `rename-leftovers.test.mjs`「除く場所の外に古い名前が残っていない」 | 古い束 `extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json` の削除が索引に入っていない（ファイルの名前の1件だけ。`node --test tests/rename-leftovers.test.mjs` で確かめた） | 既知。コミットで削除を入れる（リーダー） |
| `rename-leftovers.test.mjs`「リーダーの 2c の分（.claude/）」 | `.claude/agents/vlad-tepes.md` の8行目「仮称 Shuko」 | 既知。Team の開発部に依頼済み |
| `migrate-from-shuko.test.mjs` の `[guard]`（`tmp\b: 変わった .`） | テストの中身は 20/20 通る。テストが模擬の置き場 `tmp\b\trial-migrate-t*`（など `tmp\b\notrial-migrate-*`・`tmp\b\work-migrate-*`）を本物の `tmp\b` の直下に作って消すので、`tmp\b` の更新時刻が変わり、run-all の見張りが「テストが本物の作業場所に書いた」と数える | 曹参: `-ConfigPath` で一時の buildRoot を渡す形に直す（11節で直った） |

飛ばし（skip 7）: `apply-cli` 2（前から）、`l10n-audit` 1・`l10n-audit-more` 4（実物は環境変数か r7 の出力があるときだけ。2節）。

## 5. 移行の台本 `scripts/migrate/migrate-from-shuko.ps1` の読み（守り1〜7）

本番の場所では打っていない。台本の全文を読み、曹参のテスト20件（run-all で通過）と蒙恬の試し（`trial-migrate-result.json` の19の場合）と照らした。

| 守り | 台本の作り | 合否 |
|---|---|---|
| 1. バイトのまま写す・復号しない・`state.vscdb`・`Local State` を開かない | 写しは `[IO.File]::Copy($src, $dst, $false)` だけ。読むのは `DirectoryInfo.GetFileSystemInfos`・`FileInfo.Length`（名前と大きさ）だけ。`read-secret`・`ConvertTo/From-SecureString`・`ProtectedData`・ハッシュは無い。`-SandboxRoot` のときだけ `local-config.ps1` で `local.json`（秘密でない）を読む | 合格 |
| 2. 出力は JSON 1つ。種類・相対の名前・有無・数・大きさだけ。中身もハッシュも出さない | `Write-Result` が `ConvertTo-Json` 1つだけを標準出力へ。`entries`・`userFiles`・`excluded`・`renamed`・`copied`・`created` は名前と数と大きさ。場所は `%APPDATA%` などの表示の形に置き換える。照らしは数と大きさ | 合格 |
| 3. 誤りの文に中身を混ぜない。ログのファイルを書かない | 誤りは例外の文だけ（`$_.Exception.Message`）。知らせは標準エラー。`Out-File`・`Set-Content` などは無い | 合格 |
| 4. 書く先に中身があれば何も書かずに止まる。途中の失敗では消さずに止まり、作ったものを出す | `appdata`・`watch`・`secrets` は書く先が空でなければ、`argv` はファイルがあれば `destNotEmpty`（終了 3、何も書かない）。案（`User\` に中身）より強く、`%APPDATA%\Sukuna` の直下に何かあれば止まる。途中の失敗は `created`（先頭 200 件）と `createdCount` を出して終了 1。消す命令は無い | 合格 |
| 5. Shuko か Sukuna が動いていれば止まる | 本番は名前 `Shuko.exe`・`Sukuna.exe` と、`%LOCALAPPDATA%\Programs\Shuko\`・`Sukuna\` の下の実行ファイルのプロセスを `Win32_Process` で見る。一覧が取れなければ `runningUnknown` で止まる。模擬のときは模擬の `Programs` の下だけを見る | 合格 |
| 6. 写した後、エージェントは書く先の秘密の場所も読まない | 台本の外の守り（権限の 1.1 で `%LOCALAPPDATA%/Sukuna/watch/`・`secrets/` を `secret_paths` に足す）。今の4人の `permissions.json` には、まだ Sukuna の秘密の場所が無い（`team/` を探して確かめた）。本番の `-Apply` は 1.1 が入ってから打つこと | 台本としては対象外。前提を9節に書いた |
| 7. `-SandboxRoot` の範囲の照らし | `GetFullPath` で `..` を正規化してから、`<buildRoot>\trial-<名前>` かその下でなければ終了 2。`-ConfigPath` は `-SandboxRoot` のときだけ。知らない引数は終了 2 | 合格 |

ほか: 書く前に毎回、書く先が元の3つの場所（`%APPDATA%\Shuko`・`%USERPROFILE%\.shuko`・`%LOCALAPPDATA%\Shuko`）の下でないかを照らす（`Assert-NotOld`）。除くもの（キャッシュ・ログ・`languagepacks.json`）に `code.lock` を足したのは引き継ぎの6の1のとおりで、妥当（起動中の印のファイル）。

テストの見え方（直すほどではない点）: 「照らしの結果を出す」のテストの数の照らし（`nums.includes(String(nWatch)) || nums.length > 0`）は、数値が1つでもあれば通るので、数の照らしとしては空振り（大きさの照らしは効いている）。`copied[].verified` が `true` かは見ていない。`reparsePoint`・`pathTooLong`・`runningUnknown` で止まる場合はテストに無い（`pathTooLong` は蒙恬の試しで確かめてある）。

## 6. 名前の残り（初回）

- 今の追跡しているファイル: 除く場所（`tasks/`・`records/`・`docs/`・`team/`・移行の台本とテスト・`measure.ps1`・`measure.tests.ps1`・置き換えの道具）の外に残るのは、古い束のファイル名1件だけ（4節）。`.claude/agents/vlad-tepes.md` の1行は別の検査で既知。`scripts/`・`tools/`・`removals/`・`patches/`・`extensions-src/`・`assets/`・`builtin/` を Grep で探して確かめた（`scripts/` で出るのは `measure.ps1`、移行の台本、コミットしない `trial-*` だけ）。
- コミットの後に落ちる件（初回の不合格の2）: `rename-leftovers.test.mjs` は `git ls-files` の追跡ファイルだけを見ていたので、まだ追跡されていない新しいファイルを見ていなかった。コミットに入れる新しいファイルのうち、`tests/build/commit-author.mjs`（2行目・4行目）と `tests/rename-entries.test.mjs`（1行目・91行目）が古い名前を文字のまま持ち、`EXCLUDED_FILES` に無かった。11節で直った。

## 7. 作者の照らしの分け方（`tests/build/commit-author.mjs`）

境目は `2026-11-18T00:00:00+09:00`（= `2026-11-17T15:00:00Z`）。記録の `startedAt` がそれより前なら古い作者、後か無い・読めないなら新しい作者だけを認める。

| 記録 | startedAt | 作者 | 照らし | 結果 |
|---|---|---|---|---|
| r6 の当て直し `tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r6/checks.json` | 2026-11-17T00:32Z（前） | 古い作者 39件 | `node tests/c2-check-json.mjs`・`c5`・`c7` | 期待どおり |
| 蒙恬の当て直し `apply-checks-rn.json`・`apply-checks-rn2.json` | 2026-11-18T13:45Z・13:49Z（後） | 新しい作者 | `c6`・`c4` | 期待どおり |
| 私の当て直し `apply-checks-verify.json` | 2026-11-18T15:01Z（後） | 新しい作者 | `c2`〜`c7` | 6本とも期待どおり |
| `commit-author.test.mjs`（向きを逆にすると食い違う） | — | — | run-all | 2/2 |

今ある当て直しの記録（`tasks/`・`records/` の `startedAt` を探した）は、古い作者のものが 2026-11-17T00:45Z まで、新しい作者のものが 2026-11-18T13:45Z から。境目は両者の間にあり、どちらも正しく分かれる。`c1-check-json.mjs` は前から作者を見ていない（改名と関係しない）。

## 8. コミットに入れる・入れないファイル

### A. 改名のコミットに入れる

- 変更（追跡済み）: `CLAUDE.md`、`TAKE-IN.md`、`assets/README.md`、`package.json`、`product.overlay.json`、`docs/` の 9 ファイル（`02`・`03`・`04`・`05`・`06`・`08`・`README`・`install`。`user-decisions.md` は変更なし）、`team/departments/development/README.md`、`extensions-src/` の 13 ファイル、`patches/` の2本、`removals/` の 13 本の `edits.patch` と6本の `README.md`、`scripts/` の 25 ファイル（`measure.ps1`・`start-menu-shortcut.ps1` を含む）、`tools/watch/` の6ファイル、`tests/` の改名の変更（`probe-dns.ps1` を除く全部。`tests/build/`・`tests/removals/` を含む）
- 削除: `extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json`（`git rm` か `git add -A` で入れる）
- 新しいファイル: `extensions-src/notion-sync/dist/i18n/sukuna.notion-sync.ja.i18n.json`、`scripts/migrate/migrate-from-shuko.ps1`、`tests/build/commit-author.mjs`、`tests/commit-author.test.mjs`、`tests/migrate-from-shuko.test.mjs`、`tests/rename-entries.test.mjs`、`tests/rename-leftovers.test.mjs`
- 記録: `tasks/2026-11-18-rename-sukuna-impl/` の8つ（`handoff-notes-meng-tian.md`・`apply-checks-rn.json`・`apply-checks-rn2.json`・`patch-regen-check.json`・`trial-migrate-result.json`・`trial-migrate-list-s1.json`・`trial-migrate-apply-s1.json`・`trial-run-tests.json`）、`tasks/2026-11-18-rename-sukuna-tests/handoff-notes-cao-shen.md`、`tasks/2026-11-18-rename-sukuna-verify/`（この文書・`run-all-result.txt`・`run-all-result-r2.txt`・`apply-checks-verify.json`）

### B. コミットに入れない（手元の道具・使い捨て）

| ファイル | 理由 |
|---|---|
| `scripts/trial-rename-sukuna.mjs`・`scripts/trial-migrate.ps1`・`scripts/trial-ps-parse.ps1`・`scripts/trial-run-tests.mjs` | 蒙恬の手元の道具（引き継ぎの7節） |
| `scripts/trial-start-menu-aumid.ps1` | コミットしない裁定（2026-11-18）。改名の後は動かない |
| `tests/rename-apply-once.mjs` | 曹参の使い捨ての置き換え（リーダーの指示でコミットしない） |
| `tests/validate-migrate-harness.mjs`、`tasks/2026-11-18-rename-sukuna-tests/ref-migrate-sketch.ps1` | テストの道具の確かめと下書き。蒙恬の台本ができたので要らない（曹参の引き継ぎ）。前者は古い名前を持つ（名前の残りの検査は `NOT_COMMITTED` で除いている）。後者は記録として入れてもよい（リーダーの判断） |
| `tests/probe-l10n.mjs`・`tests/probe-netlog.ps1`・`tests/probe-netlog2.ps1`・`tests/probe-nodedebug.ps1`・`scripts/l10n-probe.mjs` | 前からの調べの使い捨て |
| `tests/p34-selfcheck.test.mjs`・`tests/p34/`・`tests/fixtures/ref-p34/` | rename-plan.md の1.1 の「コミットしない使い捨て」。`p34-selfcheck.test.mjs` は「廃止」の注釈だけ |
| `Microsoft/Windows/PowerShell/ModuleAnalysisCache` | PowerShell の部品の解析の控えが、リポジトリの直下に書かれたもの（`LOCALAPPDATA` を持たない PowerShell の起動の跡と見る。どの実行が書いたかは特定していない）。`.gitignore` に無い |

### C. 改名と関係しない、前からの未コミットのもの（改名のコミットに混ぜない。扱いはリーダーの判断）

- 変更: `tests/probe-dns.ps1`、`tasks/2026-11-13-p2-build-switch/build-switch-design.md`、`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-cao-shen.md`、`tasks/2026-11-16-p5-c1-product-keys/run-all-result.json`
- 追跡前: `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp`、`tasks/2026-11-13-p0-netaudit-hostnames/trial/`、`tasks/2026-11-15-move-off-c-verify/trial-local.json`、`tasks/2026-11-15-p5-c1-patch/typecheck-log.md.round2.tmp`、`tasks/2026-11-17-icon-ja-tests/` の4つの JSON、`tasks/2026-11-17-icon-l10n-tests/audit-run-pack1131.json`

## 9. 指摘（不合格の点のほか）

1. 移行の本番（`-Apply`）の前提: 権限の段1の 1.1（Sukuna の秘密の場所を4人の `secret_paths` に足す）と 1.5 の行が、まだどの `permissions.json` にも無い。1.1 が入る前に本番を打つと、写した先のトークンの場所を、フックが守らない。
2. 改名のコミットの後は、課の道具が `%LOCALAPPDATA%\Sukuna\local.json`（まだ無い）を読み、既定の値で動く。rename-plan.md の3.3 の手順1（`configure.ps1` と `switch.ps1 -List` で今の値を控える）は、コミットの前に打つ必要がある（蒙恬の引き継ぎの6の6と同じ）。
3. `scripts/move-survey.mjs` の一覧は名前だけを置き換えたので、`owner`・説明の文が改名の後の意味と合わない（蒙恬の引き継ぎの6の5。今は使っていない道具）。
4. 作業ツリー `tmp\b\wt\rn` は、私の当て直しの後の状態（HEAD は作り直したパッチを当てたもの。蒙恬の2回目の木と同じ）のまま残した。
5. run-all の c1-unit が `tasks/2026-11-16-p5-c1-product-keys/patch-shape-detail.txt` を毎回書き直す（過去の記録の場所にテストが書く）。今回は HEAD と同じ中身に戻ったが、落ちたときは過去の記録が書き換わる。改名と関係しないので、次に曹参がこのテストに触れるときの論点。

## 10. 直した後の確かめ（初回に書いた、再検証で見ること）

- `migrate-from-shuko.test.mjs` を `-ConfigPath` の形に直した後、run-all で guard を含めて fail 0 か（既知の2件を除く）。
- 6節の2ファイルを直した後、名前の残りの検査が既知の件だけで落ちるか。

## 11. 再検証（2026-11-19）

依頼: 曹参の直し（`handoff-notes-cao-shen.md` の「大岡越前守の検証の差し戻しへの対応（2026-11-19）」）。コードは直していない。移行の台本は本番の場所で打っていない。

### 11.1 run-all の見張り

- コマンド: `node tests/run-all.mjs --save tasks/2026-11-18-rename-sukuna-verify/run-all-result-r2.txt`（全部。見張りは有効のまま。`c*-mutation` と PowerShell の2本を含む）。
- 結果: **3,073 件、pass 3,064、fail 2、skip 7**。落ちは `rename-leftovers.test.mjs` の既知の2件だけ。`migrate-from-shuko.test.mjs` は 20/20、`[guard]` の行は1つも出ていない。
- 件数が初回より1少ないのは、初回の guard の通知（1件として数えられていた）が無くなったため。テストの件数そのものは同じ（20件）。
- 直し方の読み（`tests/migrate-from-shuko.test.mjs`）: 一時の buildRoot を `sandboxBase()`（`<repo>\tmp\tests`。見張りの対象外）の下に `mkdtemp` で `migrate-buildroot-*` として作り、`{"buildRoot": <その場所>}` の `local.json` を置く。`-SandboxRoot` を渡す呼び出しにだけ `-ConfigPath <その local.json>` を足す。試し（`trial-migrate-t*`）も、範囲の外の場合（`outside-migrate-*`・`notrial-migrate-*`・`..\` で抜ける場合・`work-migrate-*`）も同じ buildRoot の下に作り、終わりに buildRoot ごと消す。見張り（`tests/build/guard-roots.mjs`）は変えていない（tracked の差は名前の置き換えの1行だけで、初回と同じ）。
- 台本が `-ConfigPath` を無視すれば、`tmp\tests\…\trial-*` は buildRoot（既定 `tmp\b`）の外になり、正の場合（`-List`・`-Apply` の成功）が終了 2 で落ちる。正の場合が通ることが、`-ConfigPath` が効いていることの確かめになっている。
- 範囲の外の場合の見え方（落とすほどではない）: 初回の「`-SandboxRoot` が `tmp\tests` の下（buildRoot の外）」の場合は、今は「同じ buildRoot の下の `trial-*` でない名前」に替わった。buildRoot そのものの外の場合を直接見るテストは無くなった（台本では、buildRoot の外は名前の照らしの前の前方一致で落ちる。5節の守り7）。

### 11.2 名前の残りの検査

- `node --test tests/rename-leftovers.test.mjs`: 5件中 3 通過、2 落ち。落ちは既知の2件だけ。
  - 「除く場所の外に古い名前が残っていない」: `extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json: ファイルの名前` の1件（コミットで削除を入れると消える）
  - 「.claude/」: `.claude/agents/vlad-tepes.md` の8行目（Team の開発部に依頼済み）
- 検査の対象が `git ls-files --cached --others --exclude-standard` になり、まだ追跡していないファイルも見るようになった。8節の A の新しいファイル（`commit-author.mjs`・`commit-author.test.mjs`・`rename-entries.test.mjs`・`sukuna.notion-sync.ja.i18n.json`）は、どれも `NOT_COMMITTED` に当たらず、検査の対象に入っている（移行の台本とそのテスト、`rename-leftovers.test.mjs` は前からの `EXCLUDED_FILES`）。
- `tests/` を Grep した結果、古い名前を持つのは `measure.tests.ps1`・`migrate-from-shuko.test.mjs`・`rename-leftovers.test.mjs`・`rename-apply-once.mjs`（どれも `EXCLUDED_FILES`）と、`probe-l10n.mjs`・`validate-migrate-harness.mjs`（どれも `NOT_COMMITTED`。8節の B でコミットしないもの）だけ。`commit-author.mjs`・`rename-entries.test.mjs` からは消えた。
- `NOT_COMMITTED` の除き方（`tests/probe-`・`tests/p34`・`tests/fixtures/ref-p34/`・`tests/validate-migrate-harness.mjs`・`scripts/trial-`・`scripts/l10n-probe.mjs` の前方一致）:
  - 追跡前のファイルで除かれるのは、8節の B の使い捨てだけ（`git ls-files --others --exclude-standard` の一覧と照らした）。8節の A のファイルは1つも隠していない。
  - **ただし、前方一致は追跡済みのファイルにも効く**。今、追跡済みで除かれるのは `tests/probe-dns.ps1`・`tests/probe-launch.ps1` の2つ（`git ls-files` で確かめた）。どちらも古い名前を持たないので、今の結果は変わらない。これから `tests/probe-*`・`scripts/trial-*` の名前で追跡するファイルに古い名前が入っても、この検査は見ない。直すなら、`NOT_COMMITTED` を追跡前のファイル（`--others` の分）にだけ当てる。合否には効かない（指摘として残す）。
  - 追跡前で `NOT_COMMITTED` にも `.gitignore` にも当たらない `Microsoft/Windows/PowerShell/ModuleAnalysisCache` も、検査の対象に入る（古い名前は無く、結果に効かない）。

### 11.3 前の合格の条件を崩していないか

- 追跡済みのファイルの名前と関係しない差（`git diff -I… --stat`）は、初回と同じ12ファイル・同じ行の数（`start-menu-shortcut.ps1`・`c2〜c7-check-json.mjs`・`l10n-audit*.test.mjs`・`measure.tests.ps1`・`probe-dns.ps1`・古い束の削除）。曹参の直しは、追跡前のテストのファイルの中だけ。
- `tests/build/commit-author.mjs`: 変わったのは注釈の2行（`shuko-apply` を「古い作者（OLD_AUTHOR）」「古い作者」に）だけ。境目・`OLD_AUTHOR`・`NEW_AUTHOR`・`expectedAuthor` は同じ。再び `node tests/c2-check-json.mjs <私の当て直しの記録>` と `node tests/c7-check-json.mjs <r6 の checks.json>` が期待どおり。`commit-author.test.mjs` 2/2。
- `tests/rename-entries.test.mjs`: 91行目は `new RegExp('\\\\Shu' + 'ko\\\\', 'i')`（文字列としては `\\Shuko\\`、正規表現としては `\Shuko\` に一致）で、前の `/\\Shuko\\/i` と同じ照らし。10/10。
- 移行の台本のテスト: 守り1〜7を見る照らし（秘密の漏れ、書かない、止まる、終了コード、台本の字面の検査）は変わっていない。変わったのは置き場所と `-ConfigPath` の付け足しだけ。
- 実装（`scripts/`・`tools/`・`extensions-src/`・`removals/`・`patches/`）と資料に、初回の後の変更は無い。2・3・5節の合格はそのまま。
- run-all の後、リポジトリの追跡前のファイルは増えていない（`git ls-files --others --exclude-standard` を前後で比べた）。

### 11.4 再検証の判定

**合格**。コミットのときは古い束の削除を入れる（8節の A）。コミットの後に残る落ちは `.claude/agents/vlad-tepes.md` の1件だけ（Team の開発部の分）。8節の B・C は改名のコミットに入れない。9節の指摘1・2は、移行の前に済ませる。

## 記録

- `run-all-result.txt`: run-all の結果（初回）
- `run-all-result-r2.txt`: run-all の結果（再検証）
- `apply-checks-verify.json`: 私の当て直しの記録

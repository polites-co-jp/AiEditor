# 権限の変更の依頼（AiEditor 課 → Team の開発部）: 改名（Shuko → Sukuna）に合わせた行の差し替え（案）

- 作成: 蒙恬（2026-11-18。案）。リーダーが確かめて出す
- 承認: 段1（1.1〜1.5）をユーザーが承認した（2026-11-18。`docs/user-decisions.md` の「裁定（2026-11-18、改名の権限）」）。段2は引退の後に改めて承認を取る
- 進め方の裁定: `docs/user-decisions.md` の「裁定（2026-11-18、改名の進め方）」。設定・`argv.json`・検知の状態とトークンを写す台本は**課（蒙恬）が打つ**。エージェントが秘密の中身を開かない決まりは変えない（台本がファイルを写すだけ）。その許可を1.5に書いた
- 背景: エディタの名前が少名毘古那（Sukuna）に決まった。product.json の名前を変えると、データ・版のフォルダ・CLI・検知の状態の場所の名前が変わる。改名の調べは `rename-plan.md`（同じフォルダ）
- 段を2つに分ける。移行の間（`rename-plan.md` の3.3）は、日常の Shuko と新しい Sukuna が並んで残るため、古い行と新しい行の両方が要る
  - **段1**: 改名の前に当てる。Sukuna の行を**足す**。Shuko の行は残す
  - **段2**: ユーザーが旧の Shuko を引退させ、古い場所を消した後に当てる。Shuko の行を**外す**

行番号は 2026-11-18 の作業ツリーのもの。

## 1. 段1（Sukuna の行を足す）

### 1.1 秘密の場所（4人と組み込みの Explore）

新しい検知の状態とトークンの場所 `%LOCALAPPDATA%\Sukuna\watch\`（と予備の `secrets\`）を、今の Shuko の場所と同じく秘密として止める。移行の台本（ユーザーが打つ）がここへ `state.json` と `notion-token.dpapi` を写す。

| ファイル | 行 | 前 | 後 |
|---|---|---|---|
| `team/departments/development/meng-tian/permissions.json` | 99〜102 の `secret_paths` | `"%LOCALAPPDATA%/Shuko/watch/", "%LOCALAPPDATA%/Shuko/secrets/"` | 前の2つに `"%LOCALAPPDATA%/Sukuna/watch/", "%LOCALAPPDATA%/Sukuna/secrets/"` を足す |
| `team/departments/development/cao-shen/permissions.json` | 33〜34 | 同上 | 同上 |
| `team/departments/development/ooka-echizen/permissions.json` | 47〜48 | 同上 | 同上 |
| `team/departments/development/di-renjie/permissions.json` | 10〜11 | 同上 | 同上 |
| `team/hooks/allowlist.js` | 116（`EXPLORE_ALLOWLIST.secret_paths`） | `["%LOCALAPPDATA%/Shuko/watch/", "%LOCALAPPDATA%/Shuko/secrets/"]` | 同じく2つを足す |

- 足す場所はまだ無いが、`allowlist.js` の `realize` は実在する親までたどって登録するので、無い場所でも止められる（1230〜1254 行の読み）。
- 注釈の例（1361 行「`%LOCALAPPDATA%/Shuko/secrets/` なら `shuko/secrets`」、1389 行「`Shu\ko`」）は働きに効かない。直すかは任せる。

### 1.2 デスクトップのショートカット（蒙恬が作る、大岡越前守が読む）

今の行は `-EncodedCommand` の Base64 の中に `Shuko.lnk`・`Programs\Shuko\current`・`Shuko.exe` を決め打ちで持つ（元の台本は `team/hooks/tests/test_shortcut_l10n.py` の `CREATE_PS`・`READ_PS`）。同じ形で、名前だけを変えた行を足す。Base64 にする作業は前回と同じく開発部に任せる。

| ファイル | 欄 | 足す行の元の台本（UTF-16LE の Base64 にして `powershell -NoProfile -NonInteractive -EncodedCommand ` の後ろに置く） |
|---|---|---|
| `meng-tian/permissions.json` | `bash_exact`（今の 68 行の隣） | 下の「作る台本」 |
| `ooka-echizen/permissions.json` | `bash_exact`（今の 36 行の隣） | 下の「読む台本」 |

作る台本（今の `CREATE_PS` の `Shuko` を `Sukuna` にしただけ。行の終わりは LF、最後にも LF）:

```
$ErrorActionPreference = 'Stop'
$lnk = 'C:\Users\kou_z\OneDrive\デスクトップ\Sukuna.lnk'
$cur = 'C:\Users\kou_z\AppData\Local\Programs\Sukuna\current'
[IO.File]::Delete($lnk)
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $cur + '\Sukuna.exe'
$s.WorkingDirectory = $cur
$s.Save()
$r = $ws.CreateShortcut($lnk)
'TargetPath=' + $r.TargetPath
'WorkingDirectory=' + $r.WorkingDirectory
'Arguments=' + $r.Arguments
```

読む台本:

```
$ErrorActionPreference = 'Stop'
$lnk = 'C:\Users\kou_z\OneDrive\デスクトップ\Sukuna.lnk'
if (-not [IO.File]::Exists($lnk)) { 'missing'; exit 3 }
$r = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
'TargetPath=' + $r.TargetPath
'WorkingDirectory=' + $r.WorkingDirectory
```

- 範囲: デスクトップの `Sukuna.lnk` 1つの作成と作り直し。古い `Shuko.lnk` は、この行では消さない（引退のときにユーザーが消す）。
- ID（AppUserModelID）は付けない（2026-11-18 の裁定「ID はスタートメニューの1つにあれば足りる」）。
- 「デスクトップ」の区切りは今の行と同じ NFC の6字（`test_scripts_name_only_the_fixed_paths` の照らし）。

### 1.3 拡張を外す CLI と言語パックの一覧（蒙恬）

拡張を外す代行（2026-11-17 の裁定）と、日本語パックが効いているかの確かめを、Sukuna でも続けるため。

| ファイル | 欄 | 今の行（残す） | 足す行 |
|---|---|---|---|
| `meng-tian/permissions.json` | `bash_exact`（67 行の隣） | `C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --uninstall-extension=*.*` | `C:/Users/kou_z/AppData/Local/Programs/Sukuna/current/bin/sukuna.cmd --uninstall-extension=*.*` |
| `meng-tian/permissions.json` | `read_paths`（97 行の隣） | `C:/Users/kou_z/AppData/Roaming/Shuko/languagepacks.json` | `C:/Users/kou_z/AppData/Roaming/Sukuna/languagepacks.json` |

- `sukuna.cmd` と `%APPDATA%\Sukuna` は、移行（`switch.ps1` と初めての起動）の後にできる。段1を当てる時点では無い。

### 1.4 フックのテスト（段1で落ちるもの）

| ファイル | 落ちる理由 | 直し方の案 |
|---|---|---|
| `team/hooks/tests/test_shortcut_l10n.py` | `test_encoded_command_lines_are_the_two` が「Base64 の行はちょうど2つ」を見る。`test_shuko_cmd_line_is_meng_tian_only`・`test_outside_read_paths` が「外を指す read_paths は `B_READ` の1つだけ」を見る。`test_paths_match_this_pc` が `Path(SHUKO_CMD).is_file()` を見る（`sukuna.cmd` は移行まで無い） | Sukuna の定数（`A_CREATE`・`A_READ`・`B_UNINSTALL`・`B_READ` の新しい組）を足し、期待を「Shuko の組と Sukuna の組」にする。新しい CLI の `is_file` は移行の後に確かめる（それまでは skip か、段2で足す） |
| `team/hooks/tests/test_v21_temporary.py` | 98 行の期待（蒙恬の `read_paths` が `["./", "C:/b/", LANGUAGEPACKS]`） | Sukuna の `languagepacks.json` を期待に足す |
| `team/hooks/tests/test_shortcut_l10n.py` の `test_new_lines_hit_no_secret_needle` | 新しい行も秘密の文字列に当たらないことを見る（`sukuna/watch`・`sukuna/secrets` を含まない） | 新しい行を対象に足す |

ほかのテスト（`test_bash.py`・`test_read.py`・`test_write.py`・`test_identity_tools.py`・`test_delete.py`・`e2e_run.py`）は、Shuko の秘密の場所を例に使う。段1では Shuko の行が残るので通る見込み。Sukuna の場所でも止まることを見る例を足すかは任せる。1.5 の行を足したら、その行が通ることと、形を変えた行（引数を足す・場所を渡す）が止まることを見るテストも要る。

### 1.5 移行の台本を蒙恬が打つ（一覧と本番）

裁定（2026-11-18、改名の進め方）: 日常の Shuko の設定・`argv.json`・検知の状態とトークンを Sukuna の場所へ写す台本は、蒙恬が作って打つ。台本はファイルを写すだけで、エージェントは秘密の中身を開かない。

今の蒙恬の許可（`bash` の `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1`）でも打ててしまう見込みだが、秘密の場所を写す台本なので、明示の行として頼む。

#### 頼む行（案）

| 欄 | 行 | 何のため |
|---|---|---|
| `bash_exact` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List` | 写すものの一覧を出す。何も書かない |
| `bash_exact` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -Apply` | 本番。ユーザーが Shuko を閉じた後に1回打つ |
| `bash`（前方一致） | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -SandboxRoot tmp/b/trial-migrate` | 本番の前の試し。後ろに ` -List` か ` -Apply` が付く。6つの場所をすべて `tmp/b/trial-migrate` の下の模擬に置き換える |

行の形を決めるための材料:

- **本番の2行は引数を持たない**。読む元と書く先は、台本の中で環境変数 `APPDATA`・`USERPROFILE`・`LOCALAPPDATA` から決める。コマンドの文字列に場所も環境変数も出ないので、フックの秘密の文字列の検査（`checkSecretText`。`%localappdata%`・`shuko/watch`・`sukuna/watch` などに当たると止める）には当たらない。台本の名前の `shuko` だけでは、秘密の文字列（`shuko/watch`・`shuko/secrets` など）には当たらない。
- **台本の置き場所を `scripts/migrate/` の下にする案**（推す）。今の一般の行 `scripts/*.ps1` の `*` が区切り（`/`）をまたがないなら、下のフォルダの台本はこの一般の行に当たらない。そうなれば、上の3行の形でしか打てなくなる（`test_shortcut_l10n.py` の注釈「bash_exact の * は STAR（区切り1つの一部）」からの読み。`bash` の前方一致の行でも同じかは、開発部で確かめてほしい）。`scripts/migrate-from-shuko.ps1` に置くなら、一般の行で任意の引数を付けて打てる状態が残る。そのときは、明示の行は記録のためだけになる。
- **試しの行の範囲**: `-SandboxRoot` に渡せるのは `tmp/b/trial-migrate` だけにする（前方一致の行の形で固定する）。台本の側でも、`-SandboxRoot` が `<buildRoot>\trial-*` の下でなければ止める。試しの後の片づけは、今の削除の許可 `tmp/b/trial-*` に入る。曹参のテストは `node --test` から台本を起こし、自分の一時の場所を渡す（フックはテストの中までは見ない。今と同じ）。
- 本番は1回だけ使う行なので、移行が済んだら外してよい（2節の段2で外す）。

#### 台本が触れる場所

| 向き | 場所 | 中身 |
|---|---|---|
| 読む元（読むだけ。書かない・消さない・動かさない） | `%APPDATA%\Shuko\` | ユーザーのデータ。キャッシュとログ（`Cache`・`CachedData`・`Code Cache`・`GPUCache`・`CachedExtensionVSIXs`・`logs`・`Crashpad`・`clp`・`languagepacks.json`）は写さない。`Local State` と `User\globalStorage\state.vscdb` は、本体の暗号で守られた秘密（拡張の SecretStorage）を含むが、バイトのまま写すだけ |
| | `%USERPROFILE%\.shuko\argv.json` | このファイル1つ（`extensions\` は写さない。拡張は台帳から入れ直す） |
| | `%LOCALAPPDATA%\Shuko\watch\` | `state.json`・`notion-token.dpapi`（DPAPI で暗号化したトークン）・`watch.log` |
| | `%LOCALAPPDATA%\Shuko\secrets\` | あれば中身をそのまま写す（今の台本は使っていない） |
| 書く先（無いか空のときだけ作る） | `%APPDATA%\Sukuna\` | 上の写し。`User\globalStorage\shuko.notion-sync\` は `sukuna.notion-sync\` という名前で写す |
| | `%USERPROFILE%\.sukuna\argv.json` | 写し |
| | `%LOCALAPPDATA%\Sukuna\watch\`（・`secrets\`） | 写し |

`%LOCALAPPDATA%\Sukuna\local.json` は台本では作らない（`configure.ps1` が作る。今の許可で打てる）。

#### 秘密の中身を読まないための守り（台本の作り）

1. ファイルはバイトのまま写す（`[IO.File]::Copy` など）。トークンを戻さない（`scripts/lib/read-secret.ps1` を呼ばない。`ConvertTo-SecureString` も DPAPI の復号も使わない）。`state.vscdb`・`Local State` も開かない。
2. 標準出力は JSON 1つ。中身は、場所の種類（`appdata`・`argv`・`watch`・`secrets`）、ファイルの相対の名前、有無、数、大きさだけ。`watch\` と `secrets\` の下のファイルは、名前と大きさだけを出し、中身もハッシュも出さない。写した後の照らしも、数と大きさで行う。`%APPDATA%` の下も中身は出さない。
3. 誤りの文に、ファイルの中身を混ぜない（例外の文だけ）。ログのファイルは書かない。
4. 書く先に `User\`・`argv.json`・`watch\` の中身があれば、何も書かずに止まる（混ぜない）。途中で失敗したら、作ったものを残したまま止まり、作ったものの一覧を出す。台本は何も消さない（書く先は課の削除の許可の外なので、消す台本は書かない決まり）。片づけはユーザーにお願いする。やり直すには書く先が空である必要があるので、失敗したらユーザーの片づけを待つ。
5. 日常の Shuko か Sukuna が動いていれば止まる（`%LOCALAPPDATA%\Programs\Shuko`・`Sukuna` の下の実行ファイルのプロセスを見る）。閉じるのはユーザーにお願いする。
6. 写した後、エージェントは書く先の秘密の場所も読まない。1.1 の `%LOCALAPPDATA%/Sukuna/watch/`・`secrets/` を `secret_paths` に足す行と同時に当ててほしい（Read・Glob・Grep とコマンドの文字列で止まる）。
7. 台本の中は、フックが見ない（`docs/08` の1節の最後の行、2026-11-15 のユーザーの判断「台本で穴は塞がずに決まりで守る」）。上の守りは台本のコードと、曹参のテストと、大岡越前守の読みで確かめる。

## 2. 段2（引退の後に Shuko の行を外す）

前提: ユーザーが旧の Shuko を引退させ、`%LOCALAPPDATA%\Shuko`・`%APPDATA%\Shuko`・`%LOCALAPPDATA%\Programs\Shuko`・デスクトップの `Shuko.lnk` を消した（`rename-plan.md` の3.4）。課が知らせる。

| ファイル | 行 | 外す |
|---|---|---|
| 4人の `permissions.json`・`allowlist.js` の 116 行 | `secret_paths` | `%LOCALAPPDATA%/Shuko/watch/`、`%LOCALAPPDATA%/Shuko/secrets/` |
| `meng-tian/permissions.json` | `bash_exact` 67 行 | `.../Programs/Shuko/current/bin/shuko.cmd --uninstall-extension=*.*` |
| `meng-tian/permissions.json` | `bash_exact` 68 行 | Shuko.lnk を作る `-EncodedCommand` の行 |
| `meng-tian/permissions.json` | `read_paths` 97 行 | `C:/Users/kou_z/AppData/Roaming/Shuko/languagepacks.json` |
| `ooka-echizen/permissions.json` | `bash_exact` 36 行 | Shuko.lnk を読む `-EncodedCommand` の行 |
| `meng-tian/permissions.json` | 1.5 で足した3行 | 移行の台本の一覧・本番・試しの行（移行が済んだら、段2を待たずに外してもよい） |
| `team/hooks/tests/` | `test_shortcut_l10n.py`・`test_v21_temporary.py` の Shuko の定数と期待。秘密の場所の例（`test_bash.py` 965〜1030 行、`test_read.py` 43〜209 行、`test_write.py` 258〜276 行、`test_identity_tools.py` 201〜202 行、`test_delete.py` 552 行、`e2e_run.py` 537〜623 行、`test_checkers.py` 59 行）は Sukuna に置き換える | — |

## 3. 知らせ

- 足さないもの: 課の削除の許可は変えない（移行の台本は何も消さない）。Write・Edit の書き込み先（`write_paths`）にも、`%APPDATA%`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna` は足さない。ユーザーのデータ・`argv.json`・検知の状態とトークンの写しは、1.5 の移行の台本の行だけで行う（2026-11-18 の裁定「課が打つ」）。タスクスケジューラ・スタートメニュー・PATH への許可は頼まない（ユーザーが行う裁定のまま）。
- 移行の台本の行（1.5）は、1.1 の秘密の場所の行と同時に当ててほしい。写した先の秘密を、エージェントが読めないようにするため。
- 課の台本が使う今の許可（`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1`、`node scripts/*.mjs`）で、`configure.ps1`・`switch.ps1`・`install-extensions.mjs` は改名の後も打てる（場所は台本の中で決まり、コマンドの文字列に出ない）。
- このリポジトリの外（Team の側）に、AiEditor の Shuko の行を写したテストや記録（例: Team の `tasks/2026-11-17-ai-editor-shortcut-l10n-perms/perm-tests/`）があれば、同じく直す必要があるかを見てほしい。課からは読めない。
- 段1が入るまで、移行は始めない（`rename-plan.md` の4節の順6）。実装の改名・テスト・ビルド・関門は先に進める。

## 4. あわせて頼むこと（権限ではない。リーダーが追記 2026-11-18）

- `.claude/agents/vlad-tepes.md` の8行「AiEditor（仮称 Shuko）」を「AiEditor（Sukuna）」に直してほしい。メンバーの定義なので課では書き換えない。曹参の名前の残りの検査（`tests/rename-leftovers.test.mjs`）が、直るまでこの行を拾う。
- 段1のテストで AiEditor の Shuko の行を写したもの（Team の側）があれば、あわせて見てほしい（3節の3つ目と同じ）。

# 権限の変更の依頼（AiEditor 課 → Team の開発部）: 改名（Shuko → Sukuna）に合わせた行の差し替え（案）

- 作成: 蒙恬（2026-11-18。案）。リーダーが確かめて出す
- 承認: 未（ユーザーの承認を取ってから出す。`docs/user-decisions.md` の「裁定（2026-11-18、エディタの名前）」は「権限とフックの変更は案ができてからユーザーの承認を取り、Team の開発部に依頼する」）
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

ほかのテスト（`test_bash.py`・`test_read.py`・`test_write.py`・`test_identity_tools.py`・`test_delete.py`・`e2e_run.py`）は、Shuko の秘密の場所を例に使う。段1では Shuko の行が残るので通る見込み。Sukuna の場所でも止まることを見る例を足すかは任せる。

## 2. 段2（引退の後に Shuko の行を外す）

前提: ユーザーが旧の Shuko を引退させ、`%LOCALAPPDATA%\Shuko`・`%APPDATA%\Shuko`・`%LOCALAPPDATA%\Programs\Shuko`・デスクトップの `Shuko.lnk` を消した（`rename-plan.md` の3.4）。課が知らせる。

| ファイル | 行 | 外す |
|---|---|---|
| 4人の `permissions.json`・`allowlist.js` の 116 行 | `secret_paths` | `%LOCALAPPDATA%/Shuko/watch/`、`%LOCALAPPDATA%/Shuko/secrets/` |
| `meng-tian/permissions.json` | `bash_exact` 67 行 | `.../Programs/Shuko/current/bin/shuko.cmd --uninstall-extension=*.*` |
| `meng-tian/permissions.json` | `bash_exact` 68 行 | Shuko.lnk を作る `-EncodedCommand` の行 |
| `meng-tian/permissions.json` | `read_paths` 97 行 | `C:/Users/kou_z/AppData/Roaming/Shuko/languagepacks.json` |
| `ooka-echizen/permissions.json` | `bash_exact` 36 行 | Shuko.lnk を読む `-EncodedCommand` の行 |
| `team/hooks/tests/` | `test_shortcut_l10n.py`・`test_v21_temporary.py` の Shuko の定数と期待。秘密の場所の例（`test_bash.py` 965〜1030 行、`test_read.py` 43〜209 行、`test_write.py` 258〜276 行、`test_identity_tools.py` 201〜202 行、`test_delete.py` 552 行、`e2e_run.py` 537〜623 行、`test_checkers.py` 59 行）は Sukuna に置き換える | — |

## 3. 知らせ

- 足さないもの: 課の書き込み先・削除の許可は変えない。ユーザーのデータ（`%APPDATA%`）・`%USERPROFILE%\.sukuna`・タスクスケジューラ・スタートメニューへの新しい許可は頼まない。ユーザーのデータと検知の状態の写しは、ユーザーが移行の台本を1回打つ案（`rename-plan.md` の6節の論点3。推奨）。ユーザーが「課が打つ」を選んだら、別に依頼する。
- 課の台本が使う今の許可（`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1`、`node scripts/*.mjs`）で、`configure.ps1`・`switch.ps1`・`install-extensions.mjs` は改名の後も打てる（場所は台本の中で決まり、コマンドの文字列に出ない）。
- このリポジトリの外（Team の側）に、AiEditor の Shuko の行を写したテストや記録（例: Team の `tasks/2026-11-17-ai-editor-shortcut-l10n-perms/perm-tests/`）があれば、同じく直す必要があるかを見てほしい。課からは読めない。
- 段1が入るまで、移行は始めない（`rename-plan.md` の4節の順6）。実装の改名・テスト・ビルド・関門は先に進める。

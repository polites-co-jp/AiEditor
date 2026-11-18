# 改名（Shuko → Sukuna）の影響の範囲と移行の手順の案

- 作成: 蒙恬（2026-11-18）
- 依頼: `brief.md`（同じフォルダ）
- 根拠の裁定: `docs/user-decisions.md` の「裁定（2026-11-18、エディタの名前）」
- この文書は調べと案だけ。コード・設定・ユーザーのデータは何も変えていない

## 0. 要点

- 「Shuko」「shuko」を含む行は、過去の記録を除いて **約 890 行・165 ファイル**（1節の表。数は大文字と小文字を区別しない行の数）。過去の記録は `tasks/` が 8,504 行・519 ファイル、`records/` が 257 行・64 ファイルで、直さない。
- 識別子は ASCII の `Sukuna`・`sukuna` にそろえる案（2節）。ほかの製品とのぶつかりは見つからなかった（Open VSX に名前空間 `sukuna` は無い。Sukuna という名前のエディタも見つからない）。
- 移行は**並べて入れる**案を推す（3節）。新しい Sukuna を別の場所（`%LOCALAPPDATA%\Programs\Sukuna`・`%APPDATA%\Sukuna` など）に入れ、日常の Shuko は消さずに残す。Sukuna を確かめてから、ユーザーの答えを待って Shuko を引退させる。戻すときは、残っている Shuko を起動するだけで済む。
- 本体の作り直しが要る（product.json の名前・パッチの中の印・組み込み拡張の ID が変わるため）。ビルド約 20 分と関門を1回通す。
- ユーザーに諮る論点は6つ（6節）。

## 1. 影響の範囲

数は `Grep`（大文字と小文字を区別しない。`.gitignore` の対象は数えていない）で数えた**行の数**。2026-11-18 の作業ツリーの時点。

### 1.1 種類ごとの数と担当

| 種類 | 場所 | 行 / ファイル | 中身 | 直す人 |
|---|---|---|---|---|
| product.json の上書き | `product.overlay.json` | 14 / 1 | 名前の12キー（2節）、独自キー `shukoConfigurationDefaults`、`$comment` | 蒙恬 |
| 台本 | `scripts/`（下の2つを除く） | 142 / 24 | 1.2 の表 | 蒙恬 |
| 台本（計測） | `scripts/measure.ps1` | 4 / 1 | 日常の `argv.json` を守る一覧の `.shuko`、関数名 | 曹参 |
| 検知 | `tools/watch/` | 11 / 6 | `%LOCALAPPDATA%\Shuko\watch`、タスクの場所 `\Shuko\`、UA `shuko-watch/0.1`、説明の文 | 蒙恬 |
| 削除の単位のパッチ | `removals/*/edits.patch` | 164 / 13 | 作者 `From: shuko-apply <apply@shuko.invalid>`（13）、コードの注釈 `// Shuko (<単位>): ...`（151）。画面に出る文言は無い（`+` の行で注釈でないものは0。確かめた） | 蒙恬 |
| 削除の単位の説明 | `removals/*/README.md` | 8 / 6 | 作者の名前、`shukoConfigurationDefaults`、注釈の例 | 蒙恬 |
| 本体へのパッチ | `patches/20-*.patch`・`30-*.patch` | 9 / 2 | 作者、件名 `shuko:`、注釈、**変数名と product.json のキー `shukoConfigurationDefaults`**（20番） | 蒙恬 |
| 組み込み拡張 | `extensions-src/` | 21 / 11（＋ファイル名1） | publisher `shuko`（3つ）、`displayName`（「Shuko の既定」「Shuko Notion 同期」「Shuko 日本語パック」）、notion-sync の翻訳の束 `dist/i18n/shuko.notion-sync.ja.i18n.json`（ファイル名と `package.json` の `localizations`）、README・ThirdPartyNotices | 蒙恬 |
| テスト | `tests/` | 291 / 72 | 1.3 の表 | 曹参 |
| ルートの台帳 | `package.json`（2）・`TAKE-IN.md`（3）・`assets/README.md`（1） | 6 / 3 | 名前 `shuko-build`、作者の名前、`shuko.language-pack-ja`、`%APPDATA%\Shuko\languagepacks.json` | 蒙恬 |
| ルートの説明 | `CLAUDE.md`（1）、`.claude/agents/vlad-tepes.md`（1）、`team/departments/development/README.md`（1） | 3 / 3 | 「仮称 Shuko」 | リーダー（`.claude/`・`team/` はメンバーが書けない） |
| 権限 | `team/departments/development/*/permissions.json` | 平文 10 行・Base64 の中 2 行 / 4 | 秘密の場所、日常の CLI、`languagepacks.json`、デスクトップの `.lnk` | Team の開発部（`permission-requests.md`） |
| フック | `team/hooks/allowlist.js` | 3 / 1 | 組み込みの Explore の秘密の場所（1行は働く値）、注釈2 | Team の開発部 |
| フックのテスト | `team/hooks/tests/` | 87 / 9 | 本物の行を照らす定数（`test_shortcut_l10n.py`・`test_v21_temporary.py`）、秘密の場所の例 | Team の開発部 |
| 設計資料 | `docs/`（`user-decisions.md` を除く） | 111 / 8 | `install.md` 73、`02` 17、`04` 10、`06` 5、`README` 3、`03`・`05`・`08` 各1 | リーダー |
| 裁定の原本 | `docs/user-decisions.md` | 15 / 1 | 過去の裁定の文。**直さない**（その時点の記録） | — |
| 過去の記録 | `tasks/`（過去の分）・`records/` | 8,504 / 519、257 / 64 | 直さない | — |

数に入れていないもの: コミットしない使い捨て（`scripts/trial-start-menu-aumid.ps1` の 15 行、`tests/probe-l10n.mjs` の 2 行、`tests/p34*` など）。

### 1.2 台本（`scripts/`）の中身

| 分け | 場所 | 中身 |
|---|---|---|
| **場所を決める値**（変えないと移行できない） | `lib/local-config.mjs`（40・52 行）、`lib/local-config.ps1`（45・53 行） | `local.json` の置き場所 `%LOCALAPPDATA%\Shuko\local.json`、`installRoot` の既定 `%LOCALAPPDATA%\Programs\Shuko` |
| | `lib/notion-todo.mjs`（32・294 行） | ToDo の「プロジェクト」`Shuko`、検知の状態の場所 `%LOCALAPPDATA%\Shuko\watch` |
| | `switch.ps1`（324 行）、`take-in.mjs`（714・1013 行） | 検知の状態 `%LOCALAPPDATA%\Shuko\watch\state.json` の既定 |
| | `start-menu-shortcut.ps1`（89・111 行） | ショートカットの名前 `Shuko.lnk`、実行ファイル `current\Shuko.exe`（決め打ち） |
| | `l10n-ja.mjs`（46 行） | 日本語パックの ID `shuko.language-pack-ja` |
| | `lib/apply/git.mjs`（9・10 行）、`apply.mjs`（491 行） | コミットの作者 `shuko-apply <apply@shuko.invalid>` と、その照合 |
| | `lib/apply/keys.mjs`（25・26 行） | `shukoConfigurationDefaults` を読む |
| | `build.mjs`（371 行） | zip の最上位のフォルダの名前の予備値 `Shuko` |
| 外に出る文字列 | `lib/http.mjs`（10 行） | UA `shuko-build/0.1 (+lock-fetch)` |
| | `lib/l10n-ja.mjs`（367・388 行）、`convert-sublime-keys.mjs`（227 行） | ThirdPartyNotices の題名と文 |
| | `install-extensions.mjs`（57 行） | 知らせの文の中の `shuko.language-pack-ja` |
| | `move-survey.mjs`（98〜102 行） | 置き場所の調べの一覧（`.shuko`・`%APPDATA%\Shuko` など） |
| 中だけの名前 | `lib/local-config.ps1`（関数 `*-ShukoLocal*` など約 40 行）、`configure.ps1`（型 `ShukoEnvBroadcast` と関数の呼び出し）、`lib/shell-link.ps1`（型 `ShukoShellLink`、関数 `*-ShukoShortcut*`）、`lib/child-cache-env.ps1`（関数 `*-ShukoChildCacheEnv`）、`switch.ps1`（`Get-ShukoEditorInfo`）、`check-env.ps1`・`p1-launch-check.ps1` | PowerShell の関数・型・変数の名前 |
| 注釈・説明だけ | `configure.ps1`・`build.mjs`・`apply.mjs`・`prepare.mjs`・`copy-icon-sources.mjs`・`lib/apply/checks.mjs` など | 既定の場所の説明、例 |

もう名前に頼っていない所（直さなくてよい）: `switch.ps1`・`build.mjs`・`install-extensions.mjs` は、実行ファイル・CLI・データの場所を版の `product.json` の `nameShort`・`applicationName`・`dataFolderName` から求める。

### 1.3 テスト（`tests/`）の中身

| 分け | 主な場所 | 直し方 |
|---|---|---|
| 本物の値を照らすもの（直さないと落ちる） | `local-config.test.mjs`（既定と置き場所）、`configure.test.mjs`（書かれる `installRoot`）、`start-menu-shortcut.test.mjs`（`OVERLAY_ID` が `Shuko.Editor`、`Shuko.exe`）、`l10n-repo.test.mjs`（`PACK_ID`）、`builtin-l10n.test.mjs`・`cli-run.test.mjs`（`shuko.notion-sync` の束）、`watch.test.mjs`（プロジェクト `Shuko`）、`l10n-r6.test.mjs`（ThirdPartyNotices の題名）、`take-in.test.mjs`（依頼文の `shuko-apply`）、`switch-watch-warn.test.mjs`（`<LOCALAPPDATA>\Shuko\watch`）、`apply-commits.test.mjs`・`c*-unit/mutation/check-json`（作者 `shuko-apply`、注釈 `// Shuko (C-3-remote)` など）、`removals.test.mjs`・`apply*.test.mjs`（`shukoConfigurationDefaults`）、`notion-sync.test.mjs`（`globalStorage\shuko.notion-sync`） | 新しい値に直す |
| 日常の場所を読むもの | `l10n-audit.test.mjs`（175・176 行）・`l10n-audit-more.test.mjs`（446・486・490 行）・`l10n-audit.mjs`（674 行の既定） | 本物の `%LOCALAPPDATA%\Programs\Shuko`・`~\.shuko` を読む。r6 の関門の T2（模擬に替える）と合わせて直すのがよい |
| 模擬の名前（どちらでも通る） | `build-parts`・`switch`・`switch-expand`・`smoke`・`move-build-root`・`install-doc`・`install-portable`・`l10n-lib`・`l10n-audit-more` の模擬の editor・拡張、環境変数 `SHUKO_T_ROOT`・`SHUKO_TEST_BASE`・`NO_SUCH_VAR_SHUKO` | そろえて直す案（5節の「名前の残りの検査」を素直にするため） |
| 説明だけ | `tests/removals/c*-gate-script.md`、各ファイルの冒頭の注釈 | そろえて直す |

### 1.4 気づいた点

- **パッチの注釈は、後の単位のパッチの文脈の行にも出る**。例: `C-1-ai/edits.patch` の 9001 行は B-7 の注釈が文脈の行、`C-7-breadcrumbs-outline/edits.patch` の 485 行は C-1 の注釈が文脈の行。注釈を変えるなら、全部の単位を同じ規則で一度に変えないと、後の単位が当たらなくなる。
- パッチの `index <前>..<後>` の行（git の blob の ID）は、注釈を変えると前の形の中身と合わなくなる。`git apply` は見ないが、`git am -3` の3方向の当て直し（毎週の取り込みの修理）は使う。文字の置き換えの後に、当てた作業ツリーから `format-patch` で作り直して、`index` の行を正しくする（4節の手順2）。
- `shukoConfigurationDefaults` は本体の `product.json` に入るキー。パッチ 20 番がこの名前で読む。キーとパッチと `keys.mjs`・`checks.mjs` を同時に変える。
- デスクトップのショートカットを作る行（蒙恬）と読む行（大岡越前守）は、`-EncodedCommand` の Base64 の中に `Shuko.lnk`・`Programs\Shuko\current`・`Shuko.exe` を持つ。平文の検索では見つからない（`team/hooks/tests/test_shortcut_l10n.py` の `CREATE_PS`・`READ_PS` が元の台本）。

## 2. 識別子の案

方針: 識別子はすべて ASCII の `Sukuna`（表示・Windows の名前）か `sukuna`（小文字の名前）にそろえる。漢字「少名毘古那」は、資料と、必要なら画面の説明の文だけに使う（6節の論点1）。

| 識別子 | 今 | 案 | 見立て |
|---|---|---|---|
| `nameShort` | `Shuko` | `Sukuna` | 実行ファイル `Sukuna.exe`、ユーザーのデータ `%APPDATA%\Sukuna` |
| `nameLong` | `Shuko` | `Sukuna` | 窓の題名・「バージョン情報」。漢字にする案は6節の論点1 |
| `applicationName` | `shuko` | `sukuna` | CLI `current\bin\sukuna.cmd` |
| `dataFolderName` | `.shuko` | `.sukuna` | 拡張と `argv.json` が `%USERPROFILE%\.sukuna\` |
| `sharedDataFolderName` | `.shuko-shared` | `.sukuna-shared` | |
| `urlProtocol` | `shuko` | `sukuna` | 初めての起動で `HKCU\Software\Classes\sukuna` が登録される（本家と同じ動き。install.md の8節） |
| `win32MutexName` | `shuko` | `sukuna` | 多重起動の印。Shuko と別なので、移行の間は両方を同時に起動できる |
| `win32DirName` | `Shuko` | `Sukuna` | インストーラーの値。zip の配布では使わない |
| `win32NameVersion` | `Shuko` | `Sukuna` | 同上 |
| `win32RegValueName` | `Shuko` | `Sukuna` | 同上（エクスプローラーの右クリックの登録。インストーラーが無いので使われない） |
| `win32AppUserModelId` | `Shuko.Editor` | `Sukuna.Editor` | スタートメニューのショートカットにも同じ ID を付ける（2026-11-18 の裁定） |
| `win32ShellNameShort` | `&Shuko` | `&Sukuna` | インストーラーの値 |
| `win32x64AppId` など GUID 4つ | 自前の GUID | **変えない** | インストーラーの値で、名前を含まない。本家と分かれていれば足りる |
| 独自キー `shukoConfigurationDefaults` | | `sukunaConfigurationDefaults` | パッチ 20 番・`keys.mjs`・`checks.mjs`・テストと同時に（6節の論点4） |
| 組み込み拡張の publisher | `shuko` | `sukuna` | ID は `sukuna.mydist`・`sukuna.notion-sync`・`sukuna.language-pack-ja`（6節の論点5） |
| 組み込み拡張の `displayName` | `Shuko の既定` など | `Sukuna の既定`・`Sukuna Notion 同期`・`Sukuna 日本語パック` | |
| CLI の名前 | `shuko` | `sukuna` | `applicationName` から決まる |
| zip の最上位のフォルダ | `Shuko-win32-x64-<label>` | `Sukuna-win32-x64-<label>` | `nameShort` から決まる（`build.mjs` の予備値だけ直す） |
| `local.json` の置き場所 | `%LOCALAPPDATA%\Shuko\local.json` | `%LOCALAPPDATA%\Sukuna\local.json` | |
| `installRoot` の既定 | `%LOCALAPPDATA%\Programs\Shuko` | `%LOCALAPPDATA%\Programs\Sukuna` | |
| 検知の状態とトークン | `%LOCALAPPDATA%\Shuko\watch\` | `%LOCALAPPDATA%\Sukuna\watch\` | 秘密の場所。権限の `secret_paths` に足す |
| 予備の秘密の場所 | `%LOCALAPPDATA%\Shuko\secrets\` | `%LOCALAPPDATA%\Sukuna\secrets\` | 台本は使っていない（権限にだけある） |
| タスクスケジューラの場所 | `\Shuko\watch` | `\Sukuna\watch` | `register-task.ps1` の `-TaskPath` の既定 |
| スタートメニュー・デスクトップのショートカット | `Shuko.lnk` | `Sukuna.lnk` | |
| ToDo の「プロジェクト」 | `Shuko` | `Sukuna` | 6節の論点6 |
| コミットの作者（パッチの `From:`） | `shuko-apply <apply@shuko.invalid>` | `sukuna-apply <apply@sukuna.invalid>` | `.invalid` は使われない予約の名前なので、そのまま使える |
| パッチの中の注釈 | `// Shuko (<単位>): ...` | `// Sukuna (<単位>): ...` | 6節の論点4 |
| 取得の UA | `shuko-build/0.1 (+lock-fetch)`、`shuko-watch/0.1` | `sukuna-build/0.1 (+lock-fetch)`、`sukuna-watch/0.1` | 名前の値は相手の側で意味を持たない |
| ルートの `package.json` の `name` | `shuko-build` | `sukuna-build` | 公開しない |
| PowerShell の中の名前 | `Resolve-ShukoLocalConfig`・`ShukoShellLink` など | `Resolve-SukunaLocalConfig`・`SukunaShellLink` など | 6節の論点4 |

### 2.1 ぶつからないかの見立て

| 見たもの | 結果 | 出典 |
|---|---|---|
| Open VSX の名前空間 `sukuna`（組み込み拡張の publisher と同じ名前の拡張がギャラリーにあるか） | 無い（`https://open-vsx.org/api/sukuna` が 404。2026-11-18） | Open VSX の API |
| Sukuna という名前のコードエディタ・VS Code の派生 | 見つからない | Web の検索（2026-11-18） |
| 名前の知られ方 | 漫画『呪術廻戦』の登場人物「両面宿儺（りょうめんすくな）」のローマ字と同じ綴り。ソフトウェアの名前とはぶつからないが、検索で混ざる。配布しない個人の利用なので、商標は確かめていない | — |
| `sukuna://`・多重起動の印 `sukuna`・アプリの ID `Sukuna.Editor`・`%USERPROFILE%\.sukuna` | この PC で使われているかは見ていない（課には読む許可が無い）。移行の台本（4節）は、移す先が既にあれば止まる作りにする | — |

## 3. 移行の手順

### 3.1 形: 並べて入れて、確かめてから旧を引退させる（推奨）

- 新しい Sukuna は、名前の変わった場所（`%LOCALAPPDATA%\Programs\Sukuna`、`%APPDATA%\Sukuna`、`%USERPROFILE%\.sukuna`、`%LOCALAPPDATA%\Sukuna`）に入れる。日常の Shuko の場所は何も変えず、そのまま残す。
- 2つは多重起動の印もデータの場所も別なので、同時に起動できる（Shuko を確かめ用に開いておける）。
- **戻し方**: Sukuna を使うのをやめて、残してある Shuko のショートカットから起動するだけ。課の道具（`switch.ps1` など）は改名の後は Sukuna の場所だけを見るので、Shuko の版の切り替えまで戻すときは、改名のコミットを戻す（`git revert`）。
- 別案（採らない）: `configure.ps1 -InstallRoot %LOCALAPPDATA%\Programs\Sukuna` で Shuko の版のフォルダを移す。移した後の `versions\` に Shuko の名前の版と Sukuna の名前の版が混ざり、`switch.ps1 -Previous` で Shuko の版へ戻すと、データの場所（`%APPDATA%\Shuko`）が古いまま使われる。スタートメニューのショートカットも `...\Sukuna\current\Shuko.exe` に向け直されて、Sukuna の版では壊れる。

### 3.2 移すものごとの手順

「誰」は既存の裁定に照らした。課の今の許可で打てるものは「課」。

| 移すもの | 手順 | 誰（根拠） | 日常の Shuko を止めるか | 戻し方 |
|---|---|---|---|---|
| `local.json`（`%LOCALAPPDATA%\Shuko\local.json`） | 写さない。改名した `configure.ps1` を引数なしで打つと、`%LOCALAPPDATA%\Sukuna\local.json` を既定の値（`installRoot` = `%LOCALAPPDATA%\Programs\Sukuna`、`builderRepo` = このリポジトリ、`buildRoot` = `tmp\b`、`keepVersions` 3）で作る。今の `local.json` に既定と違う値があれば、移行の前に `configure.ps1`（引数なし。今の値を出すだけ）で控え、同じ値を `-KeepVersions` などで入れる | 課（2026-11-16 の裁定。`configure.ps1` は手順書の1で課が打つ） | 止めない | 新しいファイルを消す。古いファイルは触っていない |
| 版のフォルダ（`%LOCALAPPDATA%\Programs\Shuko`） | 移さない。新しく作った Sukuna の zip を `switch.ps1 1.146.0-1 -Zip <zip> -Sha256 <hex>` で `%LOCALAPPDATA%\Programs\Sukuna\versions\1.146.0-1` に展開し、`current` を作る | 課（2026-11-16 の裁定。版の入れ替えは課） | 止めない（場所が別。`switch.ps1` が見る「動いている版」は新しい場所の `current` だけ） | 新しい場所を消す（ユーザー。課の削除の許可の外） |
| ユーザーのデータ（`%APPDATA%\Shuko`） | 移行の台本（新しく作る。4節の手順2）で `%APPDATA%\Sukuna` へ**写す**（移さない）。除くもの（案）: `Cache`・`CachedData`・`Code Cache`・`GPUCache`・`CachedExtensionVSIXs`・`logs`・`Crashpad`・`clp`・`languagepacks.json`（どれも作り直されるか、古い版の場所を指す）。`Local State` は写す（下の注）。`User\globalStorage\shuko.notion-sync\` は `sukuna.notion-sync\` という名前で写す（同期の基準 `sync-base.json` を引き継ぐため） | **論点3**（推奨はユーザーが台本を1回打つ） | **止める**（`state.vscdb` が書きかけにならないように。台本は Shuko が動いていれば止まる） | `%APPDATA%\Sukuna` を消す。元の `%APPDATA%\Shuko` は触っていない |
| 拡張（`%USERPROFILE%\.shuko\extensions`） | 写さない。台帳から入れ直す（`install-extensions.mjs`。VSIX は `<buildRoot>\cache\vsix\` にあるので取り直さない）。`extensions.json` に古い場所の絶対パスが入っている恐れがあるため（未確認）。`argv.json` だけは移行の台本で `%USERPROFILE%\.sukuna\argv.json` に写し、手で足した項目を残す（`install-extensions.mjs` は `locale` だけを書き足す） | 課（2026-11-16・11-17 の裁定。拡張の導入は課）。`argv.json` の写しは移行の台本 | 止めない（Sukuna を閉じておく） | `%USERPROFILE%\.sukuna` を消す |
| 検知の状態とトークン（`%LOCALAPPDATA%\Shuko\watch\`） | 移行の台本で `state.json`・`notion-token.dpapi`（・`watch.log`）を `%LOCALAPPDATA%\Sukuna\watch\` へ写す。DPAPI の暗号はユーザーに結び付き、ファイルの場所には結び付かないので、写しても読める（`ConvertFrom-SecureString` の DPAPI）。`state.json` を写さないと、開いている ToDo のページ ID を失い、検知が「プロジェクト = Sukuna」で探して古い「Shuko」の ToDo を見つけられず、同じ ToDo を作り直す（docs/06 の2.3 の重複を避ける3） | ユーザー（秘密の場所。エージェントは開かない決まり）。写さずに `set-token.ps1` でトークンを入れ直す道もある | 止めない（タスクの 6:00 の実行と重ねない） | 新しい `watch\` を消す。古いものは触っていない |
| 予備の秘密の場所（`%LOCALAPPDATA%\Shuko\secrets\`） | 台本は使っていない。あれば同じく写す | ユーザー | 止めない | 同上 |
| スタートメニューのショートカット | 改名した `start-menu-shortcut.ps1` を1回打つ（`Sukuna.lnk`、ID `Sukuna.Editor`）。古い `Shuko.lnk` は引退まで残す | ユーザー（2026-11-16 の裁定、2026-11-18 の裁定「台本はユーザーが1回実行」） | 止めない | `Sukuna.lnk` を消す |
| デスクトップのショートカット | `Sukuna.lnk` を作る（今の許可の行は `Shuko.lnk` 決め打ち。新しい行が要る。`permission-requests.md` の1.2） | 蒙恬（2026-11-17 の裁定。許可が入ってから） | 止めない | ユーザーが消す |
| PATH | ユーザーの `Path` に `%LOCALAPPDATA%\Programs\Sukuna\current\bin` を足す。古い `...\Shuko\current\bin` は引退まで残してよい（コマンドの名前が `shuko` と `sukuna` で別なので、ぶつからない） | ユーザー（2026-11-16 の裁定。手の手順） | 止めない | 足した行を消す |
| タスクスケジューラ | 改名した `register-task.ps1` で `\Sukuna\watch` を登録し、古いものは `register-task.ps1 -Unregister -TaskPath '\Shuko\'` で外す。**古いタスクも同じリポジトリの `watch.mjs` を動かす**ので、改名のコミットの後は古いタスクも新しい場所を読む。2つを残すと同じ処理が2回動く | ユーザー（2026-11-16 の裁定。トークンの復号にユーザーの権限が要る） | 止めない | `-Unregister` で外し、古いほうを登録し直す（ただしコードを戻さないと古い場所は読まない） |
| notion-sync のトークン（設定の同期） | **入れ直す**。拡張の秘密は「拡張の ID とキー」の組で保存される（本家 1.146.0 の `src/vs/workbench/api/browser/mainThreadSecretState.ts` の `getKey` が `JSON.stringify({ extensionId, key })`）。publisher を変えると ID が `sukuna.notion-sync` になり、古いトークンは見えない。Sukuna のコマンド「Notion 同期: トークンを設定」で入れる | ユーザー（秘密はユーザーだけが入れる決まり） | 止めない | — |
| ほかの拡張の秘密（Claude Code の拡張などが使っていれば） | `Local State` ごと写せば引き継げる見込み（推定。本体の秘密の暗号は Electron の `safeStorage`（`src/vs/platform/encryption/electron-main/encryptionMainService.ts`）で、Windows では DPAPI で守った鍵をユーザーのデータのフォルダの `Local State` に置く、と読める。鍵の置き場所は Chromium の内部で、公式の文書では確かめていない）。引き継げなければ、各拡張でログインし直す | 移行の台本 | — | — |
| URL の登録（`HKCU\Software\Classes\shuko`） | Sukuna の初めての起動で `sukuna` が登録される。古いものは引退のときに消してよい | 引退のときにユーザー | — | — |
| タスクバーにピン留めした Shuko | ID が変わるので、Sukuna を開いてピン留めし直す | ユーザー | — | — |
| Notion の設定ページの題名・2つのインテグレーションの名前（例「Shuko の設定」） | 働きには効かない（ページ ID とトークンで動く）。変えるかはユーザーの好み | ユーザー | — | — |

### 3.3 移行の日の順番

移す順に意味がある所: ユーザーのデータの写しは、Sukuna を初めて起動する前に行う（先に起動すると、空のデータで `%APPDATA%\Sukuna\User` ができ、台本は混ぜずに止まる）。拡張の導入は、データの写しの後に行う（CLI が `%APPDATA%\Sukuna` を作りうるため）。

1. （課）改名のコミットを入れる直前に、今の値を控える: `configure.ps1`（引数なし）、`switch.ps1 -List`。
2. （リーダー）改名のコミットを入れる。この時から、課の道具と検知は Sukuna の場所を見る。**以下を同じ日のうちに行う**（検知のタスクが登録済みなら、次の 6:00 の前。登録前なら急がない）。
3. （課）`configure.ps1` で新しい `local.json`。`switch.ps1 1.146.0-1 -Zip ...` で新しい版のフォルダ。
4. （ユーザー）Shuko を全部閉じて、移行の台本を打つ（まず `-DryRun` で写すものの一覧を見る。次に本番）。
5. （課）`install-extensions.mjs`（`--dry-run` の後に本番）。
6. （ユーザー）`start-menu-shortcut.ps1`、PATH を足す、`register-task.ps1`（新）と古いタスクの `-Unregister`。
7. （蒙恬）デスクトップの `Sukuna.lnk`（許可が入っていれば）。
8. （ユーザー）スタートメニューの「Sukuna」から起動。表示が英語なら一度閉じて起動し直す（言語パックの一覧は起動のたびに作り直される）。notion-sync のトークンを入れ直す。タスクバーの右クリックに「New Window」が出るか、Claude Code のパネルが動くかを見る。
9. （大岡越前守とリーダー）許可の範囲で確かめる（4節の手順7）。
10. （ユーザー）しばらく使って、引退してよいと答える。

### 3.4 引退（ユーザーの答えの後）

消すのはユーザー（どれも課の削除の許可の外）: スタートメニューとデスクトップの `Shuko.lnk`、PATH の `...\Shuko\current\bin`、`%LOCALAPPDATA%\Programs\Shuko`、`%APPDATA%\Shuko`、`%USERPROFILE%\.shuko`、`%USERPROFILE%\.shuko-shared`（あれば）、`%LOCALAPPDATA%\Shuko`（トークンを含む）、`HKCU\Software\Classes\shuko`。消した後に、権限の古い行を外す（`permission-requests.md` の2節）。

## 4. 作業の順番と分担

| 順 | 中身 | 担当 | 待つもの |
|---|---|---|---|
| 0 | 論点（6節）をユーザーに諮り、裁定を記録する | リーダー | — |
| 1 | 権限とフックの段1（Sukuna の行を足す。Shuko の行は残す）。フックのテストも同時に直す | Team の開発部（依頼はリーダー） | 0 と、権限の変更のユーザーの承認 |
| 2a | 実装の改名（下の内訳） | 蒙恬 | 0。1 は 6 の前までに入ればよい |
| 2b | テストの改名と、移行の台本のテスト、名前の残りの検査 | 曹参（2a と並行。同じ表（2節）から作る） | 0 |
| 2c | 資料の改名（`docs/` の 8 ファイル、`CLAUDE.md`、`team/departments/development/README.md`、`vlad-tepes.md`）。裁定の原本は直さない | リーダー | 0 |
| 3 | 2a・2b の検証（全部のテスト、名前の残りの検査、パッチが当たること） | 大岡越前守 | 2a・2b |
| 4 | 本体の作り直し（`build.mjs`。約 20 分）。版のラベルの案 `1.146.0-p5-c-all-r7` | 蒙恬 | 3 |
| 5 | 新しい版の関門（適用後の検査、スモーク、外向き通信の監査、日本語の数え（除外の外の未訳 0）、起動の確かめ） | 大岡越前守（通信の監査の台本は曹参） | 4 |
| 6 | 移行（3.3 の手順） | 課とユーザー | 1・5、改名のコミット |
| 7 | 移行の確かめ | 大岡越前守・リーダー | 6 |
| 8 | 引退と権限の段2 | ユーザー・Team の開発部 | ユーザーの答え |

### 2a の内訳（蒙恬）

1. `product.overlay.json` の12キーと独自キー、`scripts/`・`tools/watch/` の場所の値・ID・UA・作者・関数の名前、`extensions-src/` の publisher と `displayName`、`TAKE-IN.md`・`package.json`・`assets/README.md`。
2. パッチの注釈と作者: 全部の `removals/*/edits.patch` と `patches/*.patch` を同じ規則で置き換え（`From:` の行、`// Shuko (`・`* Shuko (`・`// Shuko:` の注釈、件名の `shuko:`、`shukoConfigurationDefaults`）→ 新しい作業ツリーに当て直し → 単位ごとの edits のコミットから `format-patch` で作り直して `index` の行を正す。置き換えの前後の差が「`Shuko`→`Sukuna` と `index` の行」だけであることを照らす。
3. notion-sync と日本語パックを作り直す（`pnpm --dir extensions-src/notion-sync run build` は `dist/` を作り直すので、`dist/i18n/sukuna.notion-sync.ja.i18n.json` ができ、古い束は消える。日本語パックの `dist/` は ID を含まないので変わらない見込み）。
4. 移行の台本 `scripts/migrate-from-shuko.ps1`（新規。名前は案）: 3.2 の表の「移行の台本」の行だけを行う。既定は `-DryRun` 相当の一覧だけで、本番は `-Apply` を付けたときだけ。元の場所には書かない・消さない。Shuko が動いていれば止まる。移す先に `User\` や `argv.json` や `watch\` の中身があれば、混ぜずに止まる。写した後に、ファイルの数と大きさを照らして出す。改名の後にも `Shuko` を書くのはこの台本だけになる。
5. `start-menu-shortcut.ps1` の実行ファイルとショートカットの名前を、版の `product.json` の `nameShort` から求める形にする（今は `Shuko.exe`・`Shuko.lnk` の決め打ち。ほかの台本と同じ作りにそろえる提案）。

### 2b の内訳（曹参）

- 1.3 の表のテストを直す。日常の場所を読むテスト（`l10n-audit*.test.mjs`）は、T2 と合わせて模擬に替える。
- `measure.ps1` の日常の `argv.json` の一覧に `.sukuna` を足す（引退までは `.shuko` も残す）。
- 移行の台本のテスト: 一時の場所に模擬の `%APPDATA%\Shuko`・`.shuko\argv.json`・`watch\` を置き、写す・除く・名前を変える・止まる場合を見る。本物の場所には触れない（台本に場所を渡す引数を持たせる）。
- 名前の残りの検査: 追跡しているファイルのうち、`tasks/`・`records/`・`docs/user-decisions.md`・移行の台本・権限の移行の間の行を除いて、`shuko` が残っていないことを見るテスト（案）。

## 5. 曹参が試す入口（案）

| 入口 | 期待 |
|---|---|
| `scripts/lib/local-config.mjs` の `localConfigPath({ LOCALAPPDATA: 'C:\\L' })` | `C:\L\Sukuna\local.json` |
| 同じく `DEFAULTS.installRoot` | `%LOCALAPPDATA%\Programs\Sukuna` |
| `scripts/lib/local-config.ps1` の `Get-SukunaLocalConfigPath`・`Resolve-SukunaLocalConfig` | 同上（PowerShell 版） |
| `scripts/lib/notion-todo.mjs` の `PROJECT_NAME`、`watchStateDir` 相当 | `Sukuna`、`<LOCALAPPDATA>\Sukuna\watch` |
| `scripts/lib/apply/git.mjs` の `COMMIT_NAME`・`COMMIT_EMAIL` | `sukuna-apply`・`apply@sukuna.invalid` |
| `scripts/l10n-ja.mjs` の `PACK_ID` | `sukuna.language-pack-ja` |
| `product.overlay.json` の `set` | 2節の表の値。`sukunaConfigurationDefaults` の中身は今と同じ |
| `removals/*/edits.patch` の `From:` | `From: sukuna-apply <apply@sukuna.invalid>` |
| `scripts/start-menu-shortcut.ps1 -InstallRoot <模擬> -ShortcutPath <tmp>\Sukuna.lnk` | `TargetPath=<模擬>\current\Sukuna.exe`、`AppUserModelId=Sukuna.Editor` |
| `tools/watch/register-task.ps1 -DryRun` | `register-task: task \Sukuna\watch` |
| `scripts/migrate-from-shuko.ps1`（場所の引数で模擬を渡す） | 4節の2a の4の振る舞い |

関数名・引数・出力の形は、2a で作ったときに引き継ぎの文書に確定させる。

## 6. ユーザーに諮る論点

| # | 論点 | 選択肢（先頭が推奨） | 選んだ結果 |
|---|---|---|---|
| 1 | 表示の名前（`nameLong`。窓の題名と「バージョン情報」に出る）を漢字にするか | **(推奨) すべて `Sukuna`** / `nameLong` だけ「少名毘古那」 | 推奨: 名前がそろい、確かめる所が増えない。漢字: 窓の題名などが漢字になる。`nameLong` がほかに使われる所（ログ・登録の名前など）で非 ASCII が問題にならないかを確かめる手間が増える（未確認） |
| 2 | 移行の形 | **(推奨) 並べて入れ、確かめてから旧を引退** / 旧の版のフォルダを `configure.ps1 -InstallRoot` で移す | 推奨: 旧がそのまま残り、戻すのは旧を起動するだけ。引退までディスクを旧の分（版のフォルダ・データ）だけ多く使う。移す案: 3.1 の別案の問題が出る |
| 3 | ユーザーのデータ・`argv.json`・検知の状態とトークンを写す台本を誰が打つか | **(推奨) ユーザーが1回打つ**（課が台本を作り、試しで確かめておく） / 課が打つ（新しい許可が要る。秘密の場所に触れるので、今の決まりに反する） | 推奨: 秘密の場所の決まりを変えずに済む。ユーザーの手は、Shuko を閉じて2行（一覧と本番）。課が打つ案: 書き込み先と秘密の扱いの許可を Team に新しく頼むことになる |
| 4 | 内部の印（パッチの作者 `shuko-apply`、パッチの中の注釈、product.json の独自キー、PowerShell の関数の名前、UA）も変えるか | **(推奨) 全部変える** / 外から見えるもの（2節の表の上から「タスクスケジューラ・ショートカット・ToDo」まで）だけ変える | 推奨: 本体の作り直しは名前のためにどのみち1回要るので、同じビルドに乗る。パッチの作り直しは1回（4節の2a の2）。残すと、これから先も検索で Shuko と Sukuna が混ざる。一部の案: パッチを作り直さずに済むが、`shukoConfigurationDefaults` は本体の product.json に残る |
| 5 | 組み込み拡張の publisher を `sukuna` に変えるか | **(推奨) 変える** / `shuko` のまま残す | 推奨: 拡張の一覧の ID も新しい名前になる。代わりに notion-sync のトークンを入れ直す（ユーザー。1回）。同期の基準は移行の台本で引き継ぐ。残す案: トークンも引き継げる見込みだが、ID に旧の名前が残る |
| 6 | ToDo の「プロジェクト」の値 | **(推奨) `Sukuna`。開いている「Shuko」の ToDo は書き換えない** / 「少名毘古那」 / `Shuko` のまま | 推奨: 新しい ToDo から `Sukuna`。開いている ToDo は検知が `state.json` のページ ID で更新を続ける（移行の台本で `state.json` を写すのが前提）。Notion の画面を「プロジェクト」で絞っていれば、ユーザーが絞りの条件を直す |

諮らずに進める点（リーダーが変えるなら指示してほしい）:

- インストーラー用の GUID 4つは変えない。
- 過去の記録（`tasks/`・`records/`・`docs/user-decisions.md`）は直さない。
- 版のラベルは `1.146.0-p5-c-all-r7`、新しい場所での版の名前は `1.146.0-1`。

## 7. 確かめたことと出典

- 数: `Grep`（大文字と小文字を区別しない）で、`docs/`・`scripts/`・`tools/`・`removals/`・`patches/`・`extensions-src/`・`builtin/`・`assets/`・`tests/`・`team/`・`.claude/`・ルートのファイル・`tasks/`・`records/` を数えた。`builtin/` は 0。`tmp/` の下は探していない。
- 注釈が後の単位の文脈の行に出ること: `removals/C-1-ai/edits.patch` の 9001 行、`removals/C-7-breadcrumbs-outline/edits.patch` の 485 行。
- `+` の行で注釈でない `Shuko` は無い（パッチの `+` の行を `^\+[^/]*shuko` で探し、出たのは11行で、どれも `/** ... */` の注釈の中）。
- 拡張の秘密の鍵: 本家 1.146.0 の `src/vs/workbench/api/browser/mainThreadSecretState.ts` の 90〜91 行（作業ツリー `tmp/b/wt/1.146.0`）。
- 本体の秘密の暗号: 同じ版の `src/vs/platform/encryption/electron-main/encryptionMainService.ts`（`safeStorage.encryptString`）。Windows では DPAPI で鍵を作る（[Electron の safeStorage の文書](https://electronjs.org/docs/latest/api/safe-storage)）。鍵を `Local State` に置くことは二次の情報（[Joplin のフォーラム](https://discourse.joplinapp.org/t/joplin-portable-security-risk/34550)）で、推定。
- Open VSX の名前空間: `https://open-vsx.org/api/sukuna` が 404（2026-11-18）。
- 同じ名前のエディタ: Web の検索で見つからなかった（2026-11-18）。
- 台本の読み: `scripts/configure.ps1`（`-InstallRoot` のショートカットと PATH の向け直しは、旧の `current` の下を指すものの頭だけを付け替える）、`scripts/switch.ps1`（実行ファイルとデータの場所を版の product.json から求める）、`scripts/start-menu-shortcut.ps1`（`Shuko.exe`・`Shuko.lnk` は決め打ち）、`scripts/lib/notion-todo.mjs`（重複を探す条件にプロジェクトを使う）、`extensions-src/notion-sync/src/extension.mts`（秘密と `globalStorage\<ID>\sync-base.json`）、`extensions-src/notion-sync/build.mjs`（40 行で `dist/` を消して作り直す）、`team/hooks/allowlist.js`（秘密の場所は無い場所でも親をたどって登録できる。`realize`）。

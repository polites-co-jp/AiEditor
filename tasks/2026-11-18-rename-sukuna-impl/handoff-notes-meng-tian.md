# 改名（Shuko → Sukuna）の実装: 引き継ぎ

- 担当: 蒙恬、2026-11-18
- 依頼: `brief.md`（同じフォルダ）
- 状態: 完了（`brief.md` の完了条件の 2a の1〜5。移行の台本は本番の場所で打っていない。ビルドはしていない。コミットはしていない）

## 1. テストの入口（確定）

### 1.1 移行の台本 `scripts/migrate/migrate-from-shuko.ps1`

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List | -Apply [-SandboxRoot <dir> [-ConfigPath <local.json>]]
```

| 引数 | 振る舞い |
|---|---|
| なし | 使い方を標準エラーに出し、標準出力は空、何も書かない。終了 2 |
| `-List` | 写すものと止める理由を JSON で出す。何も書かない。止める理由があれば終了 3、無ければ 0 |
| `-Apply` | 止める理由が無いときだけ写し、写した後に数と大きさで照らす。終了 0。止める理由があれば何も書かずに 3 |
| `-List -Apply`・知らない引数・`-SandboxRoot` の無い `-ConfigPath` | 終了 2 |
| `-SandboxRoot <dir>` | 場所の3つを模擬に替える（下の表）。`<dir>` は `<buildRoot>\trial-<名前>` かその下（`..` は正規化してから照らす）。外なら終了 2。`buildRoot` は `local.json`（既定 `%LOCALAPPDATA%\Sukuna\local.json`、無ければ `<リポジトリ>\tmp\b`） |
| `-ConfigPath <file>` | `-SandboxRoot` のときだけ。`buildRoot` を決める `local.json`（テスト用） |

`-SandboxRoot` の中の置き方（曹参の `SANDBOX_LAYOUT` に合わせた）:

| 本番 | 模擬 |
|---|---|
| `%USERPROFILE%` | `<dir>\Users\sandbox` |
| `%APPDATA%` | `<dir>\Users\sandbox\AppData\Roaming` |
| `%LOCALAPPDATA%` | `<dir>\Users\sandbox\AppData\Local` |
| 動いているかを見る場所 | 模擬の `<LOCALAPPDATA>\Programs\Shuko\`・`…\Sukuna\` の下の実行ファイルだけ（本物の場所も名前も見ない） |

本番（`-SandboxRoot` なし）は、`%LOCALAPPDATA%\Programs\Shuko\`・`Sukuna\` の下の実行ファイルと、名前が `Shuko.exe`・`Sukuna.exe` のプロセスを見る。

写すもの:

| 種類（`kind`） | 元 → 先 | 中身 |
|---|---|---|
| `appdata` | `<APPDATA>\Shuko` → `<APPDATA>\Sukuna` | 直下の `Cache`・`CachedData`・`Code Cache`・`GPUCache`・`CachedExtensionVSIXs`・`logs`・`Crashpad`・`clp`・`languagepacks.json`・`code.lock` を除く全部。`User\globalStorage\shuko.<名前>` は `sukuna.<名前>` に名前を変えて写す |
| `argv` | `<USERPROFILE>\.shuko\argv.json` → `<USERPROFILE>\.sukuna\argv.json` | このファイル1つ（`extensions\` は写さない） |
| `watch` | `<LOCALAPPDATA>\Shuko\watch` → `<LOCALAPPDATA>\Sukuna\watch` | 全部 |
| `secrets` | `<LOCALAPPDATA>\Shuko\secrets` → `<LOCALAPPDATA>\Sukuna\secrets` | あれば全部 |

`local.json` は写さない。元の場所には書かない・動かさない・消さない（書く前に、書く先が元の場所の下でないかを毎回照らす）。

止める理由（`blockers[].kind`。どれかがあれば `-Apply` は何も書かずに終了 3）:

| `kind` | 条件 |
|---|---|
| `running` | Shuko か Sukuna が動いている（`running[]` に `pid`・`name`・`path`） |
| `runningUnknown` | プロセスの一覧を取れない |
| `destNotEmpty` | 写すものがある種類で、書く先が空でない（`appdata`・`watch`・`secrets` はフォルダが無いか空なら可。`argv` はファイルが無ければ可。`.sukuna\extensions\` があっても `argv.json` が無ければ可） |
| `pathTooLong` | 元か先のパスが長すぎる（ファイル 259 字、フォルダ 247 字を超える。この PC は長いパスが無効） |
| `reparsePoint` | 元にジャンクションやリンクがある |
| `unreadable` | 元のフォルダが読めない |

標準出力（JSON 1つ。PowerShell 5.1 の `ConvertTo-Json`）:

```
{
  "tool": "migrate-from-shuko", "mode": "list" | "apply", "sandbox": true | false,
  "result": "ok" | "blocked" | "failed", "written": true | false,
  "running": [ { "pid", "name", "path" } ],
  "blockers": [ { "kind", "location"?, "detail" } ],
  "locations": [
    { "kind": "appdata", "from": "%APPDATA%\\Shuko", "to": "%APPDATA%\\Sukuna",   // 模擬では "<sandbox>\\Users\\sandbox\\..."
      "sourceExists", "destState": "absent" | "empty" | "notEmpty",                // argv は "absent" | "exists"
      "files", "dirs", "bytes",
      "entries":   [ { "name", "type": "dir"|"file", "files", "bytes" } ],         // appdata は直下ごとの合計
      "userFiles": [ { "name": "User\\settings.json", "type": "file", "bytes" } ],  // appdata だけ。User\ の下のファイルを1つずつ（workspaceStorage と History は合計の1行）
      "excluded":  [ { "name", "type" } ],
      "renamed":   [ { "from": "User\\globalStorage\\shuko.notion-sync", "to": "User\\globalStorage\\sukuna.notion-sync" } ] },
    { "kind": "argv", ..., "entries": [ { "name": "argv.json", "type": "file", "bytes" } ] },
    { "kind": "watch", ..., "entries": [ { "name": "<相対の名前>", "type": "file", "bytes" } ] },  // ファイルごと
    { "kind": "secrets", ... }
  ],
  "writtenTo": [ "<書いた先>" ],
  // -Apply のとき
  "copied": [ { "kind", "files", "dirs", "bytes", "expectedFiles", "expectedDirs", "expectedBytes", "verified", "mismatches": [ { "name", "sourceBytes", "destBytes" } ] } ],
  "createdCount": <作ったフォルダとファイルの数>,
  // 失敗のとき（終了 1）
  "error": "<例外の文>", "created": [ "<作ったフォルダ・ファイル（表示の形。先頭 200 件）>" ]
}
```

出すのは場所の種類・相対の名前・有無・数・大きさだけ。中身もハッシュも出さない。台本はファイルを開かず（`[IO.File]::Copy` でバイトのまま写す）、ログのファイルを書かない。ASCII だけで書いた。

終了コード: 0 = ok、1 = 途中の失敗（または写した後の照らしが合わない。何も消さない）、2 = 使い方・引数・範囲の外、3 = 止めた（何も書いていない）。

### 1.2 そのほかの入口（rename-plan.md の5節のとおり）

| 入口 | 値 |
|---|---|
| `scripts/lib/local-config.mjs` の `localConfigPath({ LOCALAPPDATA: 'C:\\L' })`・`DEFAULTS.installRoot` | `C:\L\Sukuna\local.json`・`%LOCALAPPDATA%\Programs\Sukuna` |
| `scripts/lib/local-config.ps1` | 関数の名前の `Shuko` を `Sukuna` に（`Get-SukunaLocalConfigPath`・`Expand-SukunaEnv`・`Test-SukunaLocalConfig`・`Read-SukunaLocalConfig`・`Resolve-SukunaLocalConfig`・`Write-SukunaLocalConfig`・`ConvertTo-SukunaLocalConfigJson`・`ConvertTo-SukunaLocalPath`・`ConvertTo-SukunaJsonString`・`Test-SukunaAbsolutePath`）。中身は同じ |
| `scripts/lib/shell-link.ps1` | `Read-SukunaShortcut`・`Write-SukunaShortcut`・`Set-SukunaShortcutAppUserModelId`、型 `SukunaShellLink` |
| `scripts/lib/child-cache-env.ps1` | `Get-SukunaChildCacheEnv`・`Set-SukunaChildCacheEnv` |
| `scripts/switch.ps1` | `Get-SukunaEditorInfo`。検知の状態の既定 `%LOCALAPPDATA%\Sukuna\watch\state.json` |
| `scripts/lib/notion-todo.mjs` | `PROJECT_NAME` = `Sukuna`、検知の状態 `<LOCALAPPDATA>\Sukuna\watch` |
| `scripts/lib/apply/git.mjs` | `COMMIT_NAME` = `sukuna-apply`、`COMMIT_EMAIL` = `apply@sukuna.invalid` |
| `scripts/l10n-ja.mjs` | `PACK_ID` = `sukuna.language-pack-ja` |
| `scripts/lib/http.mjs`・`tools/watch/lib/sources.mjs` | UA `sukuna-build/0.1 (+lock-fetch)`・`sukuna-watch/0.1` |
| `tools/watch/register-task.ps1` | `-TaskPath` の既定 `\Sukuna\` |
| `product.overlay.json` | 2節の12キー、`sukunaConfigurationDefaults`（中身は同じ）。GUID 4つは変えていない |
| `scripts/start-menu-shortcut.ps1` | 下の 1.3 |

### 1.3 `scripts/start-menu-shortcut.ps1`（名前を版から求める形）

- 実行ファイルとショートカットの名前 `<name>` は、`<InstallRoot>\current\resources\app\product.json` の `nameShort`。無い・読めないときは `product.overlay.json` の `set.nameShort`（AppUserModelID と同じ順）。どちらにも無ければ終了 1、何も書かない。ファイル名に使えない文字があれば終了 1。
- 実行ファイル `<InstallRoot>\current\<name>.exe`、ショートカットの既定 `<Programs>\<name>.lnk`。
- `-Read` に `-ShortcutPath` を付けたときは、今までどおり導入先を見ない。`-ShortcutPath` が無い `-Read` は、`<name>` を求めるために導入先を決める。
- 標準エラーに `nameShort from product.json: <name>`（または `product.overlay.json`）の行が足された。標準出力の3行と終了コードは今までどおり。
- 既存の `tests/start-menu-shortcut.test.mjs` は 12 件すべて通った（2026-11-18、蒙恬の手元）。

## 2. 変えたファイル

置き換えの規則: `Shuko`→`Sukuna`、`shuko`→`sukuna`、`SHUKO`→`SUKUNA`（大文字小文字の形を保つ。ほかの形の綴りは無かった）。対象は追跡しているファイルのうち `scripts/`（`measure.ps1`・`netaudit.ps1` を除く）・`tools/`・`removals/`・`patches/`・`extensions-src/`・`product.overlay.json`・`package.json`・`TAKE-IN.md`・`assets/README.md`。バイトのまま置き換えた（改行と BOM は変わらない）。66 ファイル・412 か所。

| 分け | ファイル |
|---|---|
| 上書きの台帳 | `product.overlay.json`（名前の12キー、`sukunaConfigurationDefaults`、`$comment`。GUID 4つは変えていない） |
| 台本（名前の置き換え） | `scripts/apply.mjs`・`build.mjs`・`check-env.ps1`・`configure.ps1`・`convert-sublime-keys.mjs`・`copy-icon-sources.mjs`・`install-extensions.mjs`・`l10n-ja.mjs`・`move-survey.mjs`・`p1-launch-check.ps1`・`prepare.mjs`・`switch.ps1`・`take-in.mjs`、`scripts/lib/` の `apply/checks.mjs`・`apply/git.mjs`・`apply/keys.mjs`・`child-cache-env.ps1`・`http.mjs`・`l10n-ja.mjs`・`local-config.mjs`・`local-config.ps1`・`notion-todo.mjs`・`shell-link.ps1` |
| 台本（作りを変えた） | `scripts/start-menu-shortcut.ps1`（1.3） |
| 台本（新規） | `scripts/migrate/migrate-from-shuko.ps1`（1.1） |
| 検知 | `tools/watch/watch.mjs`・`register-task.ps1`・`set-token.ps1`・`lib/judge.mjs`・`lib/sources.mjs`・`lib/state.mjs` |
| 削除の単位 | `removals/*/edits.patch` 13 本（3節で作り直した）、`removals/{C-1,C-2,C-3,C-4,C-5,C-6}*/README.md` |
| 本体へのパッチ | `patches/20-product-configuration-defaults.patch`・`30-proxy-direct-without-settings.patch`（3節で作り直した） |
| 組み込み拡張 | `extensions-src/mydist/`（`package.json`・`README.md`・`ThirdPartyNotices.txt`）、`extensions-src/notion-sync/`（`package.json`・`README.md`・`ThirdPartyNotices.txt`・`src/stores.mts`・`dev/trial.mts`、`dist/i18n/` の束の入れ替え）、`extensions-src/language-pack-ja/`（`package.json`・`README.md`・`ThirdPartyNotices.txt`） |
| ルートの台帳 | `package.json`（`sukuna-build`。説明の「仮称」を外した）、`TAKE-IN.md`、`assets/README.md`（「名前は（仮）のまま」を、名前が決まった文に書き直した） |

notion-sync の束: ビルドが `dist/i18n/shuko.notion-sync.ja.i18n.json` を消し、`dist/i18n/sukuna.notion-sync.ja.i18n.json` を作った。`dist/extension.js` は前とバイトが同じ（git の差なし）。**古い束の削除は作業ツリーにだけあり、索引には残っている**。コミットのときに `git add -A`（か `git rm`）で削除を入れてほしい（入れるまで `tests/rename-leftovers.test.mjs` の1件が落ちる）。

## 3. パッチの作り直しと照らし

手順:

1. 15 本（`removals/*/edits.patch` 13・`patches/*.patch` 2）を上の規則で置き換えた。
2. `git -C tmp/b/vscode worktree add ../wt/rn 1.146.0` の新しい作業ツリーに `node scripts/apply.mjs tmp/b/wt/rn --label rename-sukuna-check --checks-out tasks/2026-11-18-rename-sukuna-impl/apply-checks-rn.json` で全部を当てた。結果 `ok`。全部の単位と2本のパッチが `git am -3` で当たった。警告は前からの C-2 の `debugChatIntegration.ts` の1件だけ。`commitIdentity` は `ok`（`sukuna-apply <apply@sukuna.invalid>`）。
3. 各 edits のコミットと2本のパッチのコミットから `git -C tmp/b/wt/rn format-patch -1 <sha> --output=<リポジトリ>/<元の場所>` で書き出した。
4. 作業ツリーをタグに戻し（`checkout --detach` と `clean -xfd`）、作り直したパッチで当て直した（`apply-checks-rn2.json`。`ok`）。1回目の HEAD（`07050a96`）と2回目の HEAD の差は無い（`git diff --stat` が空）。
5. 関門に合格した r6 の HEAD（`3e1e616a`。`records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md`）と、新しい HEAD の差: 112 ファイル、179 行の追加と 179 行の削除。行ごとに照らすと、178 行の組は名前の置き換えだけ。残りの1組は `extensions/language-pack-ja/README.md` の表の1行で、r6 の後に入っていた README の説明の直し（改名と関係しない）。

置き換えの前（HEAD の版）と後（作り直した版）の行の差の分け（`patch-regen-check.json`。別の分けは 0）:

| 分け | 中身 | 本数 |
|---|---|---|
| name | 名前の置き換えだけの違い（`From:`・注釈・件名・独自キー） | 15 本すべて。HEAD の版の古い名前 192 か所は、作り直した版で 0 |
| index | `index <前>..<後>` の blob の値 | 12 本（A-1・A-6・C-6 は名前が `From:` の行にしか無く、変わらない） |
| fromSha | 1行目の `From <commit> Mon Sep 17 ...` | 15 本 |
| blankContext | 先頭の空白が落ちていた空の文脈の行が `" "` に戻った | 前に手で写した7本（`patches/20`・A-1・A-6・B-1・B-2・B-3・B-7） |
| signature | 署名の区切りの `--` が `-- ` に戻り、最後の空の行が付いた | 同じ7本と `patches/30` |
| hunkHeader | ハンクの見出しの行番号だけの違い（見出しの後ろの文脈の文字は同じ） | C-2 の 10 か所。前の C-2 のパッチは、当てたときにずれ（offset）で当たっていた。作り直した版は今の位置の番号 |

blankContext・signature・hunkHeader は `format-patch` で書き出せば必ず出る形の違いで、当たり方の中身（`+`・`-` の行の並び）は変わらない（4・5 の照らし）。依頼書の「名前と index の行だけ」より広いので、ここに分けて書いた。

作業ツリー `tmp/b/wt/rn`（HEAD は作り直したパッチを当てた状態）は消していない。検証で使ってよい。要らなければ `git -C tmp/b/vscode worktree remove ../wt/rn` で外せる（課の許可の行にある）。

## 4. 確かめたこと（2026-11-18、蒙恬の手元）

| 対象 | 結果 |
|---|---|
| `node --check`（直した .mjs 20 本） | 誤り無し |
| PowerShell の構文（直した .ps1 11 本と `measure.ps1`。`Parser.ParseFile`） | 誤り無し。どれも ASCII だけ |
| `pnpm --dir extensions-src/notion-sync run build` | 型検査・束・読み込みの確かめが通った。束は `dist/i18n/sukuna.notion-sync.ja.i18n.json` |
| `node scripts/l10n-ja.mjs build` | `result: ok`、translations 95。`dist/` は変わらない（ID を含まない）。`package.json` と `ThirdPartyNotices.txt` は置き換えと同じ中身に書き直された |
| 移行の台本の試し（`-SandboxRoot tmp/b/trial-migrate/<場合>`、手元の確かめの台本から起こした） | 19 の場合がすべて期待どおり（`trial-migrate-result.json`。一覧と本番の出力の見本は `trial-migrate-list-s1.json`・`trial-migrate-apply-s1.json`） |
| `tests/migrate-from-shuko.test.mjs`（曹参） | 20 件すべて通った |
| `tests/rename-entries.test.mjs`（曹参） | 10 件すべて通った |
| `tests/` の全部の `*.test.mjs` をファイルごとに（`trial-run-tests.json`） | 2,746 通った・27 落ちた・7 飛ばし。`c1-mutation.test.mjs` は 30 分で打ち切った（結果なし）。落ちの内訳は下 |

落ちの内訳（どれも実装の誤りではないと見る）:

| テスト | 件数 | 理由 |
|---|---|---|
| `c-all-check-json`・`c2`〜`c7-check-json` | 24 | 過去の実際の記録（`checks-21.json` など。古い名前の作者 `shuko-apply` で作られた）を、改名後の照らし（`tests/c*-check-json.mjs` の「作者が `sukuna-apply` でない」）で読んでいる。曹参の側で、過去の記録の照らしは古い作者も認めるか、記録を新しい作者で作り直すかを決める必要がある |
| `move-off-c.test.mjs` | 1 → 0 | 私の手元の道具（`scripts/trial-rename-sukuna.mjs`）が OS の一時フォルダを使っていた。直して、流し直して 26 件すべて通った |
| `rename-leftovers.test.mjs` | 2 | 1件は、古い束のファイルの削除が索引に入っていないため（2節）。もう1件はリーダーの分（`CLAUDE.md`・`.claude/agents/vlad-tepes.md`） |

## 5. 残った `shuko`（追跡しているファイル。大文字小文字を問わない）

| 場所 | ファイル | 担当 |
|---|---|---|
| `tasks/` | 520 ファイル | 過去の記録。直さない |
| `records/` | 64 ファイル | 過去の記録。直さない |
| `docs/` | `02`(24)・`03`(2)・`04`(11)・`05`(1)・`06`(5)・`08`(2)・`README`(3)・`install`(99)・`user-decisions`(29) | リーダー（`user-decisions.md` は直さない） |
| `team/` | 4人の `permissions.json`・`README.md`・`hooks/allowlist.js`・`hooks/tests/` の 9 ファイル | Team の開発部 |
| ルートの説明 | `CLAUDE.md`(1)・`.claude/agents/vlad-tepes.md`(1) | リーダー |
| `scripts/measure.ps1`(3)・`tests/measure.tests.ps1`(2) | 日常の `.shuko\argv.json` を守る一覧（引退まで残す） | 曹参 |
| `extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json` | ファイル名。作業ツリーでは消えている（2節） | コミットのときに削除を入れる |
| `scripts/migrate/migrate-from-shuko.ps1`（追跡前） | 旧の場所の名前 | 残す（移行の台本） |

私の受け持ち（`scripts/`・`tools/`・`removals/`・`patches/`・`extensions-src/`・ルートの台帳）では、上のほかに残りは無い。

## 6. 気づいた点

1. **移行の台本の除くものに `code.lock` を足した**（rename-plan.md の3.2 の案に無い）。本体が起動中に書き、終わるときに消す、多重起動の印のファイル（本家 1.146.0 の `src/vs/platform/environment/electron-main/environmentMainService.ts` の 55 行、`src/vs/code/electron-main/main.ts` の 141〜154 行）。落ちた後に残っていても写す意味が無いため。
2. 移行の台本の `-List` は、`%APPDATA%` の中身を直下ごとの合計と、`User\` の下のファイルの名前と大きさ（`workspaceStorage` と `History` は合計の1行）で出す。本番の `%APPDATA%\Shuko` が大きいと、出力も長くなる。
3. 移行の台本は、本番の場所で打っていない（`-List` も）。今の私の許可では、`scripts/migrate/` の下の台本はどの形でも打てなかった（一般の行 `scripts/*.ps1` に当たらないことを確かめた）。試しは、手元の確かめの台本 `scripts/trial-migrate.ps1`（`-SandboxRoot tmp/b/trial-migrate/<場合>` だけを渡す）から起こした。本番は、権限の段1の 1.5 の行が入ってから。
4. 移行の台本の `-SandboxRoot` の範囲の照らしは、`-ConfigPath` で別の `local.json`（`buildRoot`）を渡せる。テストの場所を `<その buildRoot>\trial-*` に置ける。今の曹参のテストは使っていない（`tmp\b\trial-migrate-t*` に置く）。
5. `scripts/move-survey.mjs`（C: から移したときの調べの道具）の一覧は名前だけを置き換えた。改名の後は `.sukuna`・`%APPDATA%\Sukuna` が日常のエディタの場所になるので、一覧の `owner: "build"`・説明（「手順書の試しで漏れた…」）は合わなくなる。今は使っていない道具なので直していない。使うときに直す。
6. 改名のコミットを入れると、課の道具は `%LOCALAPPDATA%\Sukuna\local.json`（まだ無い）を読み、既定の値で動く（`buildRoot` は `tmp\b`、`installRoot` は `%LOCALAPPDATA%\Programs\Sukuna`）。日常の Shuko の版（`switch.ps1 -List` など）は見えなくなる。rename-plan.md の3.3 の手順1（今の値の控え）は、コミットの前に打つ必要がある。
7. ビルドで作られる zip の最上位のフォルダは `Sukuna-win32-x64-<label>`。曹参の `l10n-audit-more.test.mjs` は r7 の出力を `tmp/b/p2/1.146.0-p5-c-all-r7/Sukuna-win32-x64-…`、作業ツリーを `tmp/b/wt/r7` と想定している。ビルドの依頼のときに作業ツリーの名前を合わせる。

## 7. 手元の道具（コミットしない）

| ファイル | 中身 |
|---|---|
| `scripts/trial-rename-sukuna.mjs` | 置き換え（`subst`）、パッチの照らし（`check-patches`）、作業ツリーの差の照らし（`check-tree`）、残りの数え（`leftovers`） |
| `scripts/trial-migrate.ps1` | 移行の台本の試し（模擬の場所だけ。`tmp/b/trial-migrate` を作り直す） |
| `scripts/trial-ps-parse.ps1` | PowerShell の構文の確かめ |
| `scripts/trial-run-tests.mjs` | テストのファイルごとの実行とまとめ |

前からある `scripts/trial-start-menu-aumid.ps1`（コミットしない裁定のもの）は、`Read-ShukoShortcut` を呼ぶので、改名の後は動かない。直していない。

## 8. 置いたもの（このフォルダ）

- `apply-checks-rn.json`・`apply-checks-rn2.json`: 当て直しの記録（1回目と、作り直したパッチでの2回目）
- `patch-regen-check.json`: 3節の照らし
- `trial-migrate-result.json`・`trial-migrate-list-s1.json`・`trial-migrate-apply-s1.json`: 移行の台本の試し
- `trial-run-tests.json`: 4節のテストの結果

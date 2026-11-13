# 02 リポジトリの構成とビルド

## 1. 方式

本家を fork しない。本家の固定タグに、自前の変更を毎回当て直してビルドする、小さなビルドリポジトリを持つ。

- 自前の変更は「削除の単位」（[03](03-removal-design.md)）、少数のパッチ、product.json の上書き、自前の組み込み拡張、台帳として持つ。本家の履歴は持たない。
- 取り込みは `upstream.json` のタグを書き換え、当て直す作業になる。見送りも巻き戻しも、この1か所で表せる。
- 採らなかった方式: microsoft/vscode の fork ブランチに本家をマージする方式（本家の全履歴を抱え、数週間分の衝突が1塊になる）。VSCodium のビルドリポジトリを土台にする方式（調査時点で VSCodium は 1.143 系、本家は 1.146.0 で、その遅れがセキュリティ修正の遅れになる。スクリプトが Bash 前提）[一次] https://github.com/VSCodium/vscodium 。VSCodium のパッチは参考にし、写すときは MIT の表示を残す [一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/LICENSE 。

## 2. フォルダの構成

名前は仮。`<editor>` は applicationName（仮 `shuko`）。

```
<editor>/                         ビルドリポジトリ（このリポジトリ）
  docs/                           この設計資料
  upstream.json                   本家のタグとコミット SHA。取り込み＝ここの書き換え
  product.overlay.json            product.json への上書き（3節）
  removals/                       削除の単位（03 の3節）
    A-1-copilot-extension/
      unit.json                   意図・段階・有効/無効・消すパス・宣言的な編集・検査
      edits.patch                 残るファイルへの変更（無ければ置かない）
      README.md                   何を消し、何が残るか、壊れたときの症状
    ...
  patches/                        削除以外の変更（ブランド、テレメトリの差し替えは B-1 の単位に入れる）
    10-brand-assets.patch など
  assets/                         アイコンなど、作業ツリーに写すファイル（ブランド）
  builtin/
    keep.json                     残す組み込み拡張の一覧（理由つき）
  extensions-src/
    mydist/                       自前の組み込み拡張（宣言だけ。04 の6節）
    notion-sync/                  自前の組み込み拡張（05）。ここでビルドして dist/ を作る
  extensions.lock.json            同梱する第三者の拡張の台帳（04）
  scripts/                        Node.js（.mjs）と PowerShell（.ps1）
    prepare.mjs                   作業ツリーの用意
    apply.mjs                     上書き・削除の単位・パッチの適用と、適用後の検査
    build.mjs                     依存の導入・型検査・パッケージ化・後処理・zip
    take-in.mjs                   取り込みの一連（06）
    adopt.mjs                     判定を見て採ると決めた版の確定（取り込みのブランチを main へ、タグ）
    convert-sublime-keys.mjs      Sublime のキーの一度だけの変換（04 の6.2）
    lock-fetch.mjs / lock-verify.mjs / install-extensions.mjs   台帳（04）
    switch.ps1                    版の切り替え（6節）
    configure.ps1                 PC ごとの設定ファイル local.json の作成・変更（6.1）
    lib/local-config.mjs / lib/local-config.ps1   local.json を読む共通の部品（6.1）
    measure.ps1 / netaudit.ps1    計測と通信の監査（07）
    lib/read-secret.ps1           DPAPI で保護したトークンの読み出し（06）
  tools/watch/                    更新の検知（06）
  TAKE-IN.md                      取り込みのとき claude -p に渡す規約（06）
  records/
    builds/<label>.json           ビルドの記録（7節）
    take-in/<label>/              取り込みの結果と判定
    measurements/<date>-<label>/  計測の記録
  .gitignore                      作業ツリー・キャッシュ・zip・秘密を外す
```

ビルドの作業場所はリポジトリの外に置く。パスに空白と ASCII 以外の文字を入れない（本家の手順の条件）[一次] https://github.com/microsoft/vscode/wiki/How-to-Contribute 。Windows のパス長の制限を避けるため、短い場所にする（推定。既定 `C:\b\`。`local.json` の `buildRoot` で変えられる。6.1）。

```
C:\b\vscode\                      本家の常設 clone（fetch だけする）
C:\b\wt\<tag>\                    タグごとの作業ツリー（git worktree。使い捨て）
C:\b\VSCode-win32-x64\            gulp の出力（作業ツリーの親の直下に出る）
C:\b\cache\vsix\                  台帳の VSIX のキャッシュ
C:\b\dist\                        zip の置き場
```

## 3. product.json の上書き

`product.overlay.json` は `set`（値を入れる・置き換える）、`remove`（キーを消す。本家に無ければ警告）、`removeIfPresent`（本家が足したら外す。無ければ何もせず、あれば消して警告）の3つを持つ（2026-11-14、`tasks/2026-11-13-p2-apply/doc-corrections.md` の2）。`apply.mjs` が作業ツリーの `product.json` に当てる。

1.146.0 の OSS の product.json には `extensionsGallery`・`aiConfig`・`ariaKey`（テレメトリの鍵）・`updateUrl`・`extensionEnabledApiProposals` が無い [一次] https://raw.githubusercontent.com/microsoft/vscode/1.146.0/product.json 。これらは足さない。

| キー | 扱い | 値（仮） | 理由 |
|---|---|---|---|
| nameShort / nameLong | set | `Shuko` | ブランド。本家と並べて計測するため、データの置き場所も分ける |
| applicationName | set | `shuko` | CLI の名前など |
| dataFolderName / sharedDataFolderName | set | `.shuko` / `.shuko-shared` | 本家（`.vscode-oss`）と分ける |
| urlProtocol | set | `shuko` | 本家の `code-oss` と分ける。Claude Code の URI ハンドラ（`vscode://anthropic.claude-code/open`）との関係は [08](08-risks-and-open-items.md) のリスク |
| win32MutexName、win32DirName、win32NameVersion、win32RegValueName、win32AppUserModelId、win32ShellNameShort | set | `shuko`、`Shuko`、`Shuko`、`Shuko`、`Shuko.Editor`、`&Shuko` | 本家・Code - OSS と衝突させない |
| win32x64AppId、win32x64UserAppId（arm64 も） | set | 新しく作った GUID | 同上。インストーラーは作らないが、値は本家と分ける |
| licenseName / licenseUrl / licenseFileName | 残す | — | MIT の表示 |
| reportIssueUrl | remove（B-3 の `productRemove` で消す。単位と時期をそろえるため） | — | 課題報告を消す（B-3） |
| shukoConfigurationDefaults | set | `{"extensions.allowed": {"*": false, <台帳の ID>: true, ...}, "telemetry.telemetryLevel": "off", "update.mode": "none", "workbench.enableExperiments": false, "extensions.autoUpdate": "off", "extensions.autoCheckUpdates": false}` | application スコープの設定の既定。拡張の `configurationDefaults` では既定にできないので、`patches/` の小さなパッチ（`src/vs/platform/configuration/common/configurationRegistry.ts` の登録の直後で、このキーを既定として登録する）で読む（2026-11-13 リーダーの判断。`tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md` の案B-2）。`extensions.allowed` の ID が台帳と合っているかを単体テストで照合する |
| enableTelemetry、aiConfig、updateUrl、tasConfig、extensionsGallery | 本家が足したら remove | — | 1.146.0 の OSS の product.json には無く、無いことでテレメトリ・更新の確認・実験・ギャラリーが働かない。本家が足したら `apply.mjs` が外して警告する |
| server*、tunnel*、win32Tunnel* | remove（C-3） | — | リモートを消すとき。先に消すと参照するコードが値を見失う |
| builtInExtensions | set（A-3） | `[]` | js-debug 系3件（GitHub から取得される）を入れない。1.146.0 は `extensionsGallery` が無いので、取得元は GitHub [一次] `build/lib/builtInExtensions.ts`（`sources/research-vscode-source.md` の3節） |
| defaultChatAgent、trustedExtensionAuthAccess、builtInExtensionsEnabledWithAutoUpdates、sessionsWindowAllowedExtensions、voiceWsUrl、agentsTelemetryAppName、chatParticipantRegistry、agentSdks、dictationRuntime、copilotVersions | remove（C-1。後の4つは 0-5 の棚卸しで `main.vscode-cdn.net` への通信の元と見たもの `records/phase0/network-inventory.md`） | — | AI を消すとき。C-1 より前に消すと、残っている AI のコードが値を見失って起動時のエラーになる恐れがある（推定） |
| onboardingKeymaps / onboardingThemes | remove（B-2） | — | 歓迎画面を消すとき |
| tasConfig | remove（B-2。1.146.0 の product.json にあれば） | — | 実験の設定の取得（`default.exp-tas.com`）を止める（0-5 の棚卸し） |
| emergencyAlertUrl、profileTemplatesUrl | remove（B-6。1.146.0 の product.json にあれば） | — | `main.vscode-cdn.net` への通信（AI 以外の分）を止める（0-5 の棚卸し） |
| webviewContentExternalBaseUrlTemplate | 残す | — | Webview の読み込みに関わるキー（推定）。Claude Code のパネルは Webview（manifest の `views` が `webview`）なので触らない。外向き通信の棚卸しで宛先を確かめる |

`apply.mjs` は、`remove` に挙げたキーが本家に無くなっていたら警告を出す（本家の改名を見つけるため）。

## 4. ビルドの流れ

`scripts/build.mjs <tag>` が次を順に行い、どこで止まったかを `records/builds/<label>.json` に書く。

1. 作業ツリーの用意（`prepare.mjs`）: 常設の clone で `git fetch --tags`、`git worktree add C:\b\wt\<tag> <tag>`。`upstream.json` の SHA と一致するかを確かめる。
2. 適用（`apply.mjs`）: product.json の上書き → 削除の単位を番号の順に（[03](03-removal-design.md) の5節） → `patches/` → `assets/` の写し → 自前の組み込み拡張を `extensions/mydist`・`extensions/notion-sync` に写す。単位ごとに、作業ツリーで `ops` と `edits` の2つのコミットにする（戻す・調べるときの区切り。[03](03-removal-design.md) の5.1）。
3. 適用後の検査: [03](03-removal-design.md) の6節と [06](06-update-watch-and-take-in.md) の4節。結果は `records/take-in/<label>/checks.json`。
4. 依存の導入: 本家のタグの手順に従う。1.146.0 は pnpm を使っている見込み（`extensions/pnpm-workspace.yaml` があり、smoke テストの README が `pnpm install` と書く）。How-to-Contribute の wiki はまだ `npm install` と書いている [一次] `sources/research-vscode-source.md` の2節・10節。どちらで動くかは Phase 1 で確かめる。消した拡張の分だけロックファイルが変わる。ロックファイルはパッチにせず、ここで作り直し、差分を記録に残す（[03](03-removal-design.md) の5.4）。
5. 型検査: 本家の package.json の scripts から、型検査だけを走らせるものを Phase 1 で選ぶ（推定の候補 `compile`、`valid-layers-check`）。コードを消したあとの参照の残りは、ここで見つかる。
6. パッケージ化: `npm run gulp vscode-win32-x64-min`（タグが pnpm なら `pnpm run gulp ...`）。gulp は npm 経由で動かす（"Run gulp via npm to avoid potential out of memory issues"）[一次] https://github.com/microsoft/vscode/wiki/How-to-Contribute 。タスク名と出力先（作業ツリーの親の直下の `VSCode-win32-x64`）は 1.146.0 の `build/gulpfile.vscode.ts` で確かめた [一次] `sources/research-vscode-source.md` の4節。
7. 後処理: 出力の `resources/app/extensions` に、消した拡張のフォルダが残っていないこと、`builtin/keep.json` の拡張がそろっていることを確かめる。LICENSE と ThirdPartyNotices を残す。本家 1.146 系の公式の zip は `resources\app\` を commit の先頭10桁のフォルダの下に置く（`<展開先>\69047191fc\resources\app\`。Phase 0 で確認）。自分のビルドの出力が同じ形かを Phase 1 で確かめ、後処理と `switch.ps1` が `resources\app` を直下と決めつけないようにする。
8. zip: 本家の gulp には zip を作るタスクが見当たらない（`build/gulpfile.vscode.ts` と `build/gulpfile.vscode.win32.ts` には無い。ビルド全体は未確認）。出力のフォルダを `Shuko-win32-x64-<label>` に改名し、Windows 標準の `tar.exe` で `tar -a -c -f <label>.zip <フォルダ>` とする（tar.exe の zip 作成は推定。Phase 1 で確かめ、だめなら 7-Zip）。zip の SHA-256 を記録する。

### 4.1 自前の組み込み拡張の入れ方

- `mydist` はコードを持たない（`main` なし）。`extensions/mydist/package.json` を置くだけで、`build/lib/extensions.ts` が `extensions/*/package.json` を走査して同梱する見込み [一次] `sources/research-vscode-source.md` の3節（同梱されるかは Phase 2 で確かめる）。
- `notion-sync` はコードを持つ。本家のコンパイルの一覧（`build/gulpfile.extensions.ts` の `compilations`）に足すと本家のファイルへのパッチが増えるので、**ビルドリポジトリ側で先にビルドして `dist/extension.js` にまとめ、できあがったものを写す**。依存は MIT などの許諾の緩いものに限り、表示を残す。

## 5. Windows のビルド環境

本家の手順 [一次] https://github.com/microsoft/vscode/wiki/How-to-Contribute に従う。版はタグの時点の wiki と `.nvmrc` で確かめる。

| 要るもの | 中身 |
|---|---|
| Git | 本家の clone と worktree |
| Node.js | タグの `.nvmrc` の版（main で 24.22.1 [一次・要照合] https://github.com/microsoft/vscode/blob/main/.nvmrc）。x64 |
| Python | node-gyp 用。setuptools を入れる |
| C/C++ | Visual Studio 2026 Build Tools。wiki の例: `winget install --id Microsoft.VisualStudio.BuildTools -e --source winget --override "--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre"`。"Do not pick the option to install Windows Build Tools" |
| パッケージマネージャー | タグの手順に従う（1.146.0 は pnpm の見込み。4節） |
| Claude Code の CLI | 取り込みの判定（`claude -p`） |

- Electron の版はルートの package.json の `nativeBuild.target` で決まる（1.146.0 は 43.8.6）。Electron は本家のタグに付いてくるので、別に上げない。取得物は `build/checksums/electron.txt` で照合される [一次] `sources/research-vscode-source.md` の2節。 1.145 系までは `.npmrc` の `target` にある（`tasks/2026-11-13-p2-apply/doc-corrections.md` の5）。`apply.mjs` はどちらからでも読む。
- 所要時間・ディスク・ピークのメモリの公式の値は見つからなかった。Phase 1 で所要時間とディスクを記録する。
- 失敗したときは、本家の案内どおり `git clean -xfd` してから入れ直す。node-gyp のキャッシュ（`%USERPROFILE%\AppData\Local\node-gyp`）を消すことも案内されている。

## 6. 配布の形（版ごとのフォルダと切り替え）

裁定: zip を版ごとのフォルダに展開し、参照先を切り替える。前の版へすぐ戻せる。版のフォルダの場所は設定で変えられるようにする（6.1）。

下の図は既定の場所（`<installRoot>` = `%LOCALAPPDATA%\Programs\Shuko`）のとき。

```
<installRoot>\
  versions\1.146.0-1\            zip を展開したもの（版のラベル = 本家のタグ-ビルドの番号）
  versions\1.147.0-1\
  current  →  versions\1.147.0-1  ジャンクション
  history.txt                    切り替えの履歴（日時、前、後）
  backups\<日時>\                切り替えの前に取ったユーザー設定の写し
```

- スタートメニューのショートカットと PATH は `current` を指す。CLI は `current\bin\<editor>.cmd`（実行ファイルの名前は nameShort から決まる見込み。推定。Phase 1 で確かめる）。
- `switch.ps1 <label>` は次の順に動く。
  1. `current` の版のプロセスが動いていたら止まる（閉じてから実行するよう促す）。
  2. ユーザーのデータ（`settings.json`、`keybindings.json`、`snippets`、`tasks.json`、`globalStorage\state.vscdb`）を `backups\<日時>\` に写す。
  3. `current` のジャンクションを付け替え、`history.txt` に書く。
- **戻し方**: `switch.ps1 <前のラベル>`。`switch.ps1 -Previous` で `history.txt` の1つ前へ戻す。新しい版がユーザーのデータを書き換えていて前の版で不具合が出たときは、`backups\` から戻す。
- 版のフォルダは `keepVersions`（既定3。6.1）の数だけ残す。それより古いものは、`switch.ps1` が一覧を出し、ユーザーが消す。
- ユーザーのデータの置き場所は、product.json の `nameShort`・`dataFolderName` から決まる（推定: `%APPDATA%\Shuko\User`、拡張は `%USERPROFILE%\.shuko\extensions`）。版のフォルダとは別なので、切り替えても設定と拡張はそのまま。Phase 1 で実際の場所を確かめて、この節を直す。
- 署名はしない。手元でビルドしたものにはダウンロードの印が付かないので、SmartScreen は出にくい（推定）。
- 別案: ポータブルモード（実行ファイルの隣の `data` フォルダ）。OSS のビルドでも Windows で効く見込み（1.146.0 の `src/bootstrap-node.ts` の読み。実機は未確認）。ただし版ごとにデータが分かれ、切り替えのたびに写す必要が出るので採らない。

### 6.1 場所の設定（PC ごとの設定ファイル `local.json`）

裁定: 版のフォルダの場所は設定で変えられるようにする。既定値の扱いは設計で決める。

**置き場所**: `%LOCALAPPDATA%\Shuko\local.json`。この1つのパスだけを固定にし、中身で場所を変える。

- PC ごとに違う値なので、ビルドリポジトリには置かない。
- エディタの外の道具（切り替え、取り込み、更新の検知）が、エディタを起動する前に読む。Notion で同期される `settings.json` にも置かない（ほかの PC の値で上書きされるため）。
- `%LOCALAPPDATA%` はユーザーごとの場所で、管理者の権限が要らない。

**中身と既定値**: 下の JSON は記入の例。`builderRepo` の値は例で、既定値は無い（表を参照）。

```json
{
  "installRoot": "%LOCALAPPDATA%\\Programs\\Shuko",
  "keepVersions": 3,
  "builderRepo": "E:\\develop\\shuko",
  "buildRoot": "C:\\b"
}
```

| キー | 意味 | 既定値 |
|---|---|---|
| `installRoot` | 版のフォルダ（`versions\`・`current`・`history.txt`・`backups\`）を置く場所 | `%LOCALAPPDATA%\Programs\Shuko` |
| `keepVersions` | 残す版のフォルダの数 | `3` |
| `builderRepo` | ビルドリポジトリの場所（台帳 `extensions.lock.json` やスクリプトを読むため） | 既定なし。`configure.ps1` を実行したリポジトリの場所を書く |
| `buildRoot` | ビルドの作業場所（本家の clone、作業ツリー、キャッシュ、zip。2節） | `C:\b` |

- 値の中の `%NAME%` は、読むときに環境変数で展開する。
- ファイルやキーが無ければ既定値を使う。JSON として読めない、型が違う、などのときは止めてエラーを出す（推測で既定値に戻さない）。
- 1回だけ別の場所を使いたいときは、各道具のオプション（例 `-InstallRoot`）で上書きできる。優先の順は「オプション → `local.json` → 既定値」。
- 更新の検知の状態とトークンの置き場所（`%LOCALAPPDATA%\Shuko\watch\`。[06](06-update-watch-and-take-in.md) の2節）は設定にしない。秘密の置き場所を1つに決めておくため。
- `local.json` は Notion で同期しない。

**読む道具**: どれも共通の部品（`scripts/lib/local-config.mjs` と `scripts/lib/local-config.ps1`。既定値と展開の規則を1か所に持つ）を通して読む。

| 道具 | 使うキー | 何に使うか |
|---|---|---|
| `switch.ps1` | `installRoot`、`keepVersions` | 切り替え、戻し、古い版の一覧 |
| `take-in.mjs`・`adopt.mjs` | `installRoot`、`buildRoot`、`builderRepo` | 新しい版を `<installRoot>\versions\<label>` に展開する。作業ツリーを作る |
| `prepare.mjs`・`build.mjs` | `buildRoot` | 本家の clone、作業ツリー、zip の場所 |
| `install-extensions.mjs` | `installRoot`、`buildRoot` | `current\bin` の CLI で拡張を入れる。VSIX のキャッシュ |
| `measure.ps1`・`netaudit.ps1` | `installRoot` | 今の版の実行ファイルを見つける |
| `tools/watch/watch.mjs` | `builderRepo`、`installRoot` | 台帳の版と比べる。ToDo に「今の版」（`current` の指す版）を書く |
| `tools/watch/register-task.ps1` | `builderRepo` | タスクスケジューラに登録する `watch.mjs` のパス |

**場所を変える**: `configure.ps1 -InstallRoot <新しい場所>`。

1. エディタが動いていたら止まる。
2. 新しい場所が、ローカルの NTFS のボリュームかを確かめる（ジャンクションを作るため）。
3. `versions\`・`history.txt`・`backups\` を新しい場所へ移す。`-NoMove` を付けたときは移さず、新しい場所で空から始める。
4. `current` のジャンクションを新しい場所に作り直す（ジャンクションは絶対パスを指すので、移すだけでは切れる）。
5. スタートメニューのショートカットとユーザーの PATH を新しい `current` に向け直す。
6. 最後に `local.json` を書き換える。途中で失敗したら、`local.json` は前のまま残す。

初めて使うときは、`configure.ps1` を引数なしで実行すると、既定値で `local.json` を作る（`builderRepo` は実行したリポジトリ）。

## 7. 記録

`records/builds/<label>.json` の項目は次のとおり。

```json
{
  "label": "1.146.0-1",
  "upstream": { "tag": "1.146.0", "commit": "69047191fc427f2f92828279aae1d90d8eeda7ab" },
  "units": [{ "id": "A-1-copilot-extension", "enabled": true, "applied": "ok" }],
  "patches": [{ "file": "patches/10-brand-assets.patch", "applied": "ok" }],
  "lockfileDiff": "records/take-in/1.146.0-1/lockfile.diff",
  "toolchain": { "node": "24.22.1", "electron": "43.8.6", "packageManager": "pnpm x.y" },
  "durations": { "install": "...", "typecheck": "...", "package": "..." },
  "zip": { "path": "C:\\b\\dist\\1.146.0-1.zip", "sha256": "..." },
  "extensionsLockSha256": "...",
  "result": "ok"
}
```

採用した版には、ビルドリポジトリでタグ（例 `1.146.0-1`）を打つ。

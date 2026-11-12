# docs と食い違った事実と、直し方の案

- 作成: 蒙恬（2026-11-13）。docs/ はリーダーが直す。

## 1. `argv.json` は `--user-data-dir` の下ではない（docs/07 の2.1・2.8・3.1、docs/04 の7節）

**事実**（[一次] 本家のソース、タグ 1.146.0）

- `argv.json` の場所は `src/mainImpl.ts` の `getArgvConfigPath` が決める。環境変数 `VSCODE_PORTABLE` があれば `<VSCODE_PORTABLE>\argv.json`、無ければ `%USERPROFILE%\<product.dataFolderName>\argv.json`（本家は `.vscode`、VSCodium は `.vscode-oss`）。`--user-data-dir` は関係しない。
- ファイルが無いと、起動のたびに既定の中身で作る（`createDefaultArgvConfigSync`）。
- そのため、docs/07 の2.1 のとおり `--user-data-dir`・`--extensions-dir` だけで分けて本家の zip を起動すると、**普段使いの `%USERPROFILE%\.vscode\argv.json` を読み、無ければ作る**。2.1 の「普段使いのエディタの設定に触れない」が守れない。2.8 の「`argv.json` に `"locale": "ja"` を書く」も、その環境だけに効かせられない。
- `VSCODE_PORTABLE` を、すでにあるフォルダに向けると避けられる（`src/bootstrap-node.ts` の `configurePortable`。product.json に `target` が無いことが条件で、本家 1.146.0 と VSCodium 1.143.17232 の zip はどちらも `target` を持たない）。
- ただし、ポータブルの状態では **ユーザーのデータの場所は常に `<VSCODE_PORTABLE>\user-data`** になり、`--user-data-dir` より優先される（`src/vs/platform/environment/node/userDataPath.ts`。順は VSCODE_PORTABLE → VSCODE_APPDATA → `--user-data-dir`）。`--extensions-dir` は `VSCODE_PORTABLE` より優先される（`src/vs/platform/environment/common/environmentService.ts` の `extensionsPath`）。実機でも、`--user-data-dir <data>\user` を渡した CLI が `<data>\user\user-data\` に書いたのを確かめた。

**この仕事で採った配置**（`scripts/lib/p0-common.ps1`）

| 場所 | 中身 |
|---|---|
| `C:\b\p0\data\<名前>\user\` | `VSCODE_PORTABLE`。`argv.json` はここ |
| `C:\b\p0\data\<名前>\user\user-data\` | ユーザーのデータ（実際に使われる場所）。`--user-data-dir` にも同じ値を渡す。設定は `user-data\User\settings.json` |
| `C:\b\p0\data\<名前>\ext\` | `--extensions-dir` |

**直し方の案**

- docs/07 の2.1: データの置き場所の例を上の表に直し、「`argv.json` を分けるため `VSCODE_PORTABLE=<データ>\user` を設定して起動する。ポータブルではユーザーのデータが `<VSCODE_PORTABLE>\user-data` に固定される」と足す。
- docs/07 の3.1・3.2: 計測の台本の起動（3.2 の1）に `VSCODE_PORTABLE` を足す。**曹参の `scripts/measure.ps1` と `scripts/netaudit.ps1` にも影響がある**: 今の `measure.ps1` は `<作業>\user` と `<作業>\ext` を写して `--user-data-dir <作業>\user` で起動し、`VSCODE_PORTABLE` を設定していない。このままだと (1) 環境の `argv.json`（locale）が効かず、普段使いの `%USERPROFILE%\.vscode\argv.json` を読む（無ければ作る）、(2) 設定 `user\user-data\User\settings.json` が使われない（`task.allowAutomaticTasks` が効かない）。起動の前に `$env:VSCODE_PORTABLE = '<作業>\user'` を設定する直しが要る（`--user-data-dir` は無視されるが、コマンドラインに残るので `Find-MainProcesses` の照合には使える）。`Write-DefaultsChanged` が見る設定の場所も `user\user-data\User\settings.json` になる。
- docs/04 の7節: `argv.json` の場所「推定 `%USERPROFILE%\.shuko\argv.json`」は、ポータブルでない自作のビルドでは `product.dataFolderName` が `.shuko` なら正しい（仕組みは上のとおり）。Phase 1 で確かめる点として残し、仕組みの出典を足す。

## 2. Light Modern の ID（docs/04 の6.1）

- docs: 「Light Modern の ID（`Default Light Modern` の見込み。要確認）」
- 事実: 1.146.0 の `extensions/theme-defaults/package.json` の `id` は **`"Light Modern"`**（zip の `69047191fc\resources\app\extensions\theme-defaults\package.json` で確かめた。GitHub のタグ 1.146.0 も同じ）。本家の既定のテーマは `Light 2026` / `Dark 2026`。
- 案: 6.1 の値を `Light Modern` にし、「要確認」を外す。

## 3. 段階 A の分類に無い組み込み拡張（docs/03 の4節）

本家 1.146.0 の zip か VSCodium 1.143.17232 の `extensions\` にあって、docs/03 の段階 A の単位にも「残す組み込み拡張」の一覧にも名前が無く、文法だけの拡張でもないもの:

| フォルダ | 本家 1.146.0 | VSCodium 1.143.17232 | 中身 | 案 |
|---|---|---|---|---|
| `TypeScriptTeam.jsts-chat-features` | ある | 無い | 名前から、TS/JS のチャット向けの機能（推定。中身は見ていない） | A-1 に足す（AI の部品） |
| `prompt-basics` | ある | ある | プロンプトファイルの言語（推定） | A-1 に足すか、C-1 で消す |
| `media-preview` | **無い** | ある | 画像などのプレビュー（1.143 系まで） | 本家 1.146.0 には無いので、keep.json には載せない。画像のプレビュー（裁定で残す）が 1.146.0 でどこにあるか（本体に移ったか）を Phase 2 のスモーク（docs/06 の5節 base の「画像のプレビュー」）で確かめる。試験台（VSCodium）では残っている |
| `theme-modern-icons` | ある | ある | ファイルのアイコンのテーマ `vscode-modern-icons` | A-6 の `theme-*` に当たるので消してよい（既定のアイコンのテーマは `vs-seti`。`workbench.desktop.main.js` の `FILE_ICON_THEME="vs-seti"`）。A-6 の注に名前を足す |

（2026-11-13 の検証で、`media-preview` を本家にあると書いた誤りを指摘され、直した。）

ほかに文法だけの拡張（`log`、`diff`、`ini`、`docker` など）がある。keep.json を作るとき（Phase 2）に全部を載せる。

## 4. 試験台の VSCodium は本家より古い（docs/07 の2.1・2.4）

- VSCodium の最新は 1.143.17232（2026-10-28 公開。別の蒙恬の `fetch-log.md`）で、本家 1.146.0 より3つ前の版。試験台（0-3）の結果には、本家 1.146 との差（1.144〜1.146 の変更）が混ざる。
- 案: 2.4 に「試験台の版は VSCodium の最新で、本家の基準の版と一致しないことがある。結果を読むときに版の差を書く」と足す。

## 5. 計測の設定に、ワークスペースの信頼を切る設定が要る（docs/07 の3.1・3.2）

- フォルダを開いたときのタスク（3.2 の3）は、制限モードでは動かない。また信頼の確認の画面が出ると、無人の計測が止まる。
- この仕事では、計測に使う環境（`upstream-default`・`testbed-measure`）のユーザー設定を `{"task.allowAutomaticTasks": "on", "security.workspace.trust.enabled": false}` にした。
- 案: 3.1 の「ユーザー設定」の例に `security.workspace.trust.enabled: false` を足す。
- あわせて、計測の環境の `argv.json` を両方とも `{"locale": "ja"}` にした（台帳に言語パックがあり、自作は `install-extensions.mjs` が `locale` を書くため。docs/04 の5節の5）。本家と自作で表示言語をそろえる。3.1 の表に「表示言語（`argv.json` の `locale`）: そろえる」の行を足す案。

## 6. Sublime のキーの変換の規則（docs/04 の6.2）

- 元の 4.1.10 は、Windows と Linux に割り当てない項目を `"key": "none"` で書いている（`workbench.action.files.saveAll`）。規則「`win` があればそれ、無ければ `key`」のままだと `none` を写す。→ 「選んだキーが `none` なら落とす」を規則に足す案。
- 規則は `command`・`when` だけを挙げるが、`args` も残すべき（今回の元には無い）。→ 規則に `args` を足す案。
- 元の 4.1.10 に書き誤りとみられるキー `ctr+shift+[`（`editor.fold`）がある。→ 2026-11-13 にリーダーが「落とす」と決めた。規則に「知らない修飾キーを含むキーの項目は落とす」を足す案。
- 元の 4.1.10 には消す機能（デバッグなど）のコマンドが無く、「消した機能のコマンドを指す項目は落とす」で落ちたものは0件。
- Claude Code 2.1.322 の `keybindings` は 9 件（docs と一致）。衝突は0件。
- Open VSX の `publishedBy` は `open-vsx`（Open VSX 側が公開した形）。docs/04 の6.2 の「verified」は true で正しい。

## 7. 台本が書く `argv.json` は末尾を `\n}` で終える（docs/04 の5節の5、docs/02 の install-extensions）

- 事実: 初めての起動で、エディタは `argv.json` に `enable-crash-reporter` と `crash-reporter-id` が無ければ足す。そのやり方は「元の中身の末尾2文字を切り、`,\n` と2項目と `\n}` をつなぐ」（1.146.0 の `out/mainImpl.js`: `t.substring(0,t.length-2).concat(",\n", ...)`）。
- 末尾に改行のある `{...}\r\n` を書くと、`}` の後ろに項目が足されて壊れた JSON になる（2026-11-13、試験台の起動で実際に起きた）。壊れると読めずに `{}` として扱われ、`locale` が効かなくなる。
- `enable-crash-reporter` の値はテレメトリの水準が1以上かどうかで決まる（同じ所）。本家の既定（テレメトリ all）では `true` になり、クラッシュの報告が有効になる。
- この仕事では `scripts/lib/p0-common.ps1` の `Write-P0Argv` で末尾を `\n}` にそろえ（空のときはコメントの行を置く）、10 の環境を作り直した。
- 案: docs/04 の5節の5（`install-extensions.mjs` が `argv.json` に `locale` を書く）に「末尾を `\n}` で終える。既存の中身を書き換えるときも同じ」を足す。0-5（通信の棚卸し）では、本家の環境の `argv.json` に `enable-crash-reporter: true` が入ることを前提に読む。

## 8. 0-8 と 0-9 の結果による直し

`extensions-allowed.md` と `configuration-defaults.md` を参照（自動で分かった範囲。画面での確かめの後に大岡越前守が清書する）。

# 引き継ぎ（曹参 → ヴラド・ツェペシュ）: 計測・通信監査の台本と単体テスト（差し戻し対応済み）

- 結果: 完了。SubagentHandback は hook に止められたため（cao-shen の tools に無い）、この文書が報告。

## 直したこと

1. `VSCODE_PORTABLE`: measure.ps1・netaudit.ps1 は、写した先の `user` を `VSCODE_PORTABLE` にして起動する（子プロセスにだけ。起動後に自分の環境を戻す）。ユーザーのデータは `<写した先>\user\user-data`、`--user-data-dir` も同じ値を渡す（メイン検出に使う）。開始前と終了後に `%USERPROFILE%\.vscode`・`.vscode-oss`・`.shuko` の `argv.json` を比べ、作られたら警告する。
2. `ELECTRON_RUN_AS_NODE` と `VSCODE_*` を子から外す。実エディタの最初の試しで Code.exe が終了コード 9 で終わった原因がこれ（claude 経由の起動では `ELECTRON_RUN_AS_NODE=1` が入っている）。蒙恬の `p0-launch.ps1` も同じ状況なら要対策。
3. `-Exe` を省くと `<EnvDir>\p0-env.json` の `editor.exe` を使う。計測用の環境は `upstream-default`・`testbed-measure`。
4. B-1: `-Workspace` の既定は空にし、本体の先頭で `<リポジトリ>\tmp\ws`（`Get-DefaultWorkspace`）に決める。`powershell -File` で `-Workspace` を省いて起動するテスト4件を足した（比較モードの合格 0 / 不合格 1 と verdict.md、計測モードと netaudit が自分の検査まで進む）。
5. B-3: node テスト2本の先頭の「Run:」を `node tests/<名前>.mjs` に直した。
6. B-4: `validateLockEntry` に `source`・`verified`・`engines` の形の誤りのテストを足した。
7. 役割 `copilot-runtime` を足した。

## テスト結果

| テスト | 結果 |
|---|---|
| `tests/measure.tests.ps1`（PowerShell 5.1） | 88 通過 / 0 失敗 |
| `tests/netaudit.tests.ps1` | 65 通過 / 0 失敗 |
| `node tests/lock.test.mjs`（蒙恬の実装に対して） | 79 通過 / 0 失敗 |
| `node tests/sublime-keys.test.mjs`（同） | 27 通過 / 0 失敗 |

蒙恬が足した規則（キーが `none` なら落とす、`win: 'none'` は `key` に戻らない、`args` を残す）はテストにした。実装と食い違いは無い。docs/04 の6.2 の規則は「win があればそれ、無ければ key」だけだが、そのまま `none` に当てると `none` というキーへの割り当てを作るので、追加規則のほうが6.2 の意図に合う。6.2 に足すのが妥当。

## 実エディタでの短い試し（本家 1.146.0、`upstream-default`、各1回）

- measure（`-Runs 1 -Warmup 0`、待ち 20/25/5 秒）: 12プロセス、プライベートバイト（claude 含めず）1,318.4 MiB、ワーキングセット 1,650.2 MiB。`--lang=ja` が子のコマンドラインに出て、環境の `argv.json` が効いた。**普段使いの `argv.json` は作られなかった**（3か所とも不存在のまま）。
- netaudit（45秒）: editor の宛先 9件（443、Code.exe）。DNS キャッシュは実エディタでも0件でホスト名は付かず、IP のまま。
- 出力は `trial/out-real/`、`trial/net-real/`。

## 自分で決めた点と食い違い

- 前回までの決め（doc-corrections.md）に加えて、`--user-data-dir` は `<User>\user-data` を渡す、`-Exe` は env 記録から読む、普段使いの `argv.json` の検査を入れた。
- 食い違い: docs/07 の3.2 の1に `VSCODE_PORTABLE` と環境変数の除去が要る。3.2 の6「役割を `CommandLine` から付ける」は、1.146.0 では拡張ホスト・ptyHost・共有プロセスが同じ `NodeService` で区別できない（`utility-node` 5件まで）。Node 24 の `node --test tests/` は変わらず動かない（権限の書き方の直しはユーザーの承認が要る）。DNS キャッシュが空の件は 0-5 の実機で決める。

## 残った課題

- `tmp\ws` の clone と `.vscode/tasks.json` がまだ無く、tasks.json のターミナルが開くか、節目の計測の一時停止、本測定5回は未確認（大岡越前守）。
- 役割の細分化（拡張ホストなど）が要るかを決める。
- 蒙恬の `p0-launch.ps1` に `ELECTRON_RUN_AS_NODE` の除去が要るか確かめる。

## 追記: T1（知らない修飾キーを含むキーを落とす規則）のテスト

- 結果: 完了。`tests/sublime-keys.test.mjs` に23件を足し、`node tests/sublime-keys.test.mjs` を実装に対して走らせた: **50 通過 / 0 失敗**（足す前は 27）。`measure.ps1`・`netaudit.ps1` には触れていない。
- 落ちること: `ctr+shift+[`（実際の元の例）、`ctrl+shfit+a`、`ctr+k`、`fn+a`、`ctrl+foo+k`、大文字の `CTR+SHIFT+[`。和音のどの手でも（`ctrl+k ctr+c`、`ctr+k ctrl+c`）。選んだ Windows のキー（`win`）で判定し、使われない `key` は見ない（`key: ctr+a, win: ctrl+b` は残り、`key: ctrl+a, win: ctr+b` は落ちる）。前後の項目は順序を保って残る。
- 通ること（知っている修飾キー）: `ctrl`・`control`・`shift`・`alt`・`option`・`meta`・`cmd`・`win`・`super`、大文字小文字混じり（`CMD+K`、`Control+Shift+K`）、4つ全部の組み合わせ、`cmd` を含む和音、修飾キーなし（`f5`、`escape`）、`ctrl+[`、`ctrl+shift+pageup`。別名で書いたキー（`control+shift+escape`）は `findConflicts` で標準の綴り（`ctrl+shift+escape`）と衝突として見つかる。
- 実装との食い違いは無い。落とした理由（`invalid-key`、`unknown`）を返す `convertKeybindingsDetailed` は約束の外の補助関数なのでテストしていない。

## 追記: 再差し戻し（B-5、役割の付け直し、B-6、B-7、O-3）への対応

結果: 完了。

### 直したこと

- **B-5:** `-OpenFiles` は、本体で `,` で分け、ちょうど2つで、どちらも存在することを確かめ、満たさなければ止まる（TS と Python でなければ警告）。measure.ps1・netaudit.ps1 とも。省けば `C:\b\p0\ws-info.json` の `openFilesFull` を使う。`powershell -File` で `-OpenFiles "a,b"` を渡すテストを4件足した（2つとして受け入れられる、欠落が単独のパスで報告される、3つで止まる、netaudit も同じ）。
- **ファイルは1つずつ開く（新しく分かったこと）:** 2つを1回の `-r` で渡すと、背景のタブの言語は有効にならない（TS だけ起動して `onLanguage:python` が来なかった）。1つずつ 10 秒あけて開くようにした。直した後は両方の言語が有効になる。netaudit はサンプリングを止めずに同じ間隔で開く。
- **役割の付け直し（`Get-RoleMap`）:** `--inspect-port=0` = extension-host、子 copilot-runtime = agent-host、子 OpenConsole/シェル = pty-host、子 file-watcher のみ = shared-process（推定）。手がかりなしは utility-node のまま。`<回>-processes.csv`・`roles.csv`・netaudit の `samples.csv` に反映。
- **B-6:** 拡張子なしの `jsonServerMain` が language-server になる。
- **B-7:** netaudit の「起動から何秒」の 0 を、エディタを起動する直前の時刻にし、各サンプルの秒数は接続を読んだ後の時刻で出す。
- **O-3:** `isOvsxSuccess`・`judgeChecks`・`mergeLock`・`checkPinnedTool` のテストを `tests/lock.test.mjs` に足した（36件）。蒙恬の実装に対して全部通った。

### テスト結果

| テスト | 結果 |
|---|---|
| `tests/measure.tests.ps1` | 114 通過 / 0 失敗 |
| `tests/netaudit.tests.ps1` | 67 通過 / 0 失敗 |
| `node tests/lock.test.mjs` | 115 通過 / 0 失敗 |
| `node tests/sublime-keys.test.mjs` | 50 通過 / 0 失敗 |

### 短い試し（本家 1.146.0、`upstream-default`、`tmp\ws`、1回、`-File` 起動、`a,b` の文字列）

- 18プロセス、プライベートバイト（claude 含めず）1,773.2 MiB。役割: agent-host 198 MiB、extension-host 188 MiB、pty-host 89 MiB、copilot-runtime 131 MiB、ts-server 3プロセス、language-server（json）1、utility-node（手がかりなし）2。`utility-node` 5件のうち3つに名前が付いた。
- **TS の言語サーバーは出た**（`onLanguage:typescript`、ts-server 3）。
- **Python の言語サーバーは出ない（台本のせいではない）**: `onLanguage:python` は来て basedpyright の有効化が始まるが、`Error: Python extension is not installed or is disabled` で失敗する。basedpyright 1.40.2 は Python 拡張（`ms-python.python`）を要る。台帳に Python 拡張が無いので、0-4 の基準値は TS のみの状態になる。台帳に Python 拡張を足すか、docs/07 の 0-3「basedpyright が Python 本体なしで動くか」の答えにどう書くかは、ユーザーの裁定が要る。
- netaudit（60秒）も同じ条件で動いた。宛先9件。DNS キャッシュは0件のまま。普段使いの `argv.json` は作られなかった。
- 出力: `trial/out-real2/`、`out-real3/`、`out-real4/`（最新）、`trial/net-real2/`。

### 残った課題

- Python 拡張を台帳に入れるか（上）。入れるなら 0-4 の基準値の環境に Python 拡張を足してから測る。
- shared-process の推定、utility-node の残り2つの役割は未確認。
- 本測定5回、10分の監査、節目の計測の一時停止は大岡越前守。

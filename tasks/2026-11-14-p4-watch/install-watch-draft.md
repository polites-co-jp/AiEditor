# docs/install.md に入れる分の下書き: 更新の検知の用意

ユーザーが一度だけ行う。ビルドリポジトリの直下で PowerShell を開いて進める。`local.json` の `builderRepo` が要るので、先に `scripts\configure.ps1` を済ませておく（docs/02 の6.1）。

## 1. Notion のインテグレーションを作る（ワークスペースのオーナーの権限が要る）

1. https://www.notion.so/profile/integrations で「新しいインテグレーション」を作る。種類は内部（Internal）。名前は例えば「Shuko 更新の検知」。設定の同期（docs/05）のインテグレーションとは別に作る（裁定）。
2. 機能（Capabilities）は、コンテンツの読み取り・更新・挿入だけにする。ユーザーの情報は要らない。
3. ToDo のデータベースを開き、右上の「…」→「接続」から、このインテグレーションだけを接続する。ほかのページには接続しない（裁定）。
4. インテグレーションの画面で、内部インテグレーションのシークレット（`ntn_` で始まる）を写す。

## 2. この PC で DPAPI が動くかを確かめる（任意）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\check-dpapi.ps1 -Dir C:\b\dpapi-check
```

`check-dpapi: OK` が出ればよい。本物のトークンは使わない。

## 3. トークンを保存する

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\set-token.ps1
```

- 入力欄に 1.4 で写したシークレットを貼り、Enter を押す。入力は画面に出ない。
- `%LOCALAPPDATA%\Shuko\watch\notion-token.dpapi` に、今のユーザーの DPAPI で暗号化して保存する。最後に読み戻して「length N」を出す（値は出さない）。
- トークンを作り直したときは `-Force` を付けて実行する。
- トークンをコマンドの引数やファイルに平文で書かない。

## 4. 確かめる（Notion に書かない）

```powershell
node tools\watch\watch.mjs --check-token   # トークンを読めるか（Notion に接続しない）
node tools\watch\watch.mjs --check         # ToDo のデータベースの項目が設計どおりか（読むだけ）
node tools\watch\watch.mjs --dry-run       # 今の時点で作る ToDo の中身（書かない）
```

- `--check` が `ok: false` なら、表示された項目（名前・型・選択肢）をデータベースで直すか、リーダーに知らせる。プログラムは項目を勝手に作らない。
- `HTTP 401` や `object_not_found` なら、インテグレーションをデータベースに接続し忘れているか、トークンが違う。

## 5. タスクスケジューラに登録する

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -DryRun   # 中身を見るだけ
powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1           # 登録
```

- `\Shuko\watch` という名前で、毎日 6:00 に `node.exe "<builderRepo>\tools\watch\watch.mjs"` を動かす。その時刻に PC が止まっていたら、次に動いたときに走る。ログオンしているときだけ動く（トークンの復号に今のユーザーが要るため）。
- 時刻を変えるときは `-At 07:30` のように付ける。Node.js を入れ直して場所が変わったら、もう一度登録する。
- 1回だけ今すぐ走らせて確かめる: `Start-ScheduledTask -TaskPath '\Shuko\' -TaskName 'watch'`。結果は `%LOCALAPPDATA%\Shuko\watch\watch.log` の最後の行と、`Get-ScheduledTaskInfo -TaskPath '\Shuko\' -TaskName 'watch'` の `LastTaskResult`（0 が成功、1 はどこかが失敗、2 は設定の誤り）。
- やめるとき: `register-task.ps1 -Unregister`。

## 6. 別のユーザーで復号できないことを確かめる（Phase 4。docs/06 の2.4）

1. 今のユーザーで `check-dpapi.ps1 -Dir C:\b\dpapi-check -Keep` を実行する（`selfcheck.dpapi` が残る。中身はでたらめな値）。
2. 別のユーザーでログオンし、`powershell -NoProfile -ExecutionPolicy Bypass -File <ビルドリポジトリ>\scripts\lib\read-secret.ps1 -Path C:\b\dpapi-check\selfcheck.dpapi` を実行する。
3. 終了コード 4（cannot decrypt）になれば、保護が今のユーザーに結びついている。結果を docs/06 の2.4 に書く。

# 検証の記録: 0-5（監査の台本の検証と、本家の外向き通信の棚卸し）

担当: 大岡越前守（ooka-echizen）。日付: 2026-11-13。依頼書: `brief.md`。

## 1. 曹参の直しのレビュー（tasks/2026-11-13-p0-netaudit-hostnames/、scripts/netaudit.ps1、scripts/measure.ps1）

判定: **合格**。指摘が3件ある（1.6）。どれも 0-5 の結果を損なわないので、合否には響かない。

### 1.1 ネットのログの置き場所と、記録に写すもの

- 置き場所: `Invoke-NetAudit` は、`-NetLogDir` が無ければ `<WorkRoot の親>\netlog`（既定 `C:\b\p0\netlog\`）にログを置く（netaudit.ps1 の 916〜925 行）。Node のデバッグ出力（stdout・stderr）も同じ場所で、リポジトリの外。
- 記録に写すもの: `Get-NetLogInfo` が残すのは、ホスト名・ポート・回数（Requests / Resolutions / Answered）と、IP とホスト名の対応だけ。URL は `Get-NetLogUrlParts` でホストとポートだけを取り、パス・クエリ・ユーザー情報は読み取りの時点で捨てる（199〜217 行）。`Meta.NetLogPath` に入るのはファイルのパスだけ。
- 単体テスト「netlog: nothing but host names and counts is kept」は、クエリの値（`SECRET123`）・パス（`_apis`）・ユーザー情報（`user:pw`）が結果に残らないことを確かめている。実装が URL をそのまま残すように変われば落ちる。
- 実機の出力も確かめた。`records/network-audits/` の3回分を `://|\?[a-z]+=|[Bb]earer|token` で検索すると0件だった。
- 判定: 満たす。

### 1.2 普段使いのデータに触れないか

- 起動は従来どおり `Start-EditorProcess` で行う。`VSCODE_PORTABLE` は子にだけ渡し、`--user-data-dir`・`--extensions-dir` には実行ごとの写し `C:\b\p0\run\<ラベル>-netaudit` を使う。
- 足したのは3つだけ。子にだけ渡す `NODE_DEBUG=net`・`ELECTRON_ENABLE_LOGGING=1` と、`--log-net-log="<C:\b\p0\netlog\...>"`。どれも普段使いの `%APPDATA%\Code`・`%USERPROFILE%\.vscode`・`~\.vscode-oss` を指さない。
- 普段使いの `argv.json` の検査（前後で `Get-DailyArgvState` を比べ、作られたら警告する）は残っている（926 行、1021〜1022 行）。
- 止め方: 起動した PID に `CloseMainWindow` を送り、最大15秒待つ。そのあと、起動した PID の木（`Get-Descendants`）だけを `Stop-EditorTree` で止める（1004〜1009 行）。ほかのエディタ（並行しているスモークを含む）には触れない。
- 判定: 満たす。実機の4回（10分×3、30秒×1）とも `DailyArgvTouched` は空、`RunDataLeftOver` も空だった。

### 1.3 アドレスとホストの取り違えへの備え

- 対応表 `Map`（強い名前）は、「そのアドレスへ実際に接続を開いたジョブ」のホスト名だけで作る。答えに出ただけのアドレスは `AnswerMap`（ヒント）に分けた（294〜316 行）。単体テスト「an address that is only in a resolver answer is not in Map」は、共有の CDN アドレス（`13.107.5.93`）を答えに持つ別のホスト（marketplace）が `Map` に入らないことを確かめている。答えのアドレスを `Map` に入れる実装に変われば落ちる。
- ヒント（Node のデバッグ出力の対応、逆引き、順引き、`netlog-answer`）は、`HostKey` にも `Allowed` にも効かない（666〜691 行）。テスト「a weak name stays a hint ... never makes the row allowed」がある。
- ホストごとの表（「Hosts seen by name」、`named-hosts.csv`）は、ホストを1つずつ許可の一覧と照らす。アドレスを共有していても、許可にないホストは報告に出る（419〜452 行）。
- 実機の例: upstream-default では `main.vscode-cdn.net` と `update.code.visualstudio.com` が同じアドレスを使い、宛先の表で1行にまとまった。ホストごとの表には別々に出た。
- 判定: 満たす。ただし残る穴が1つある（1.6 の指摘1）。

### 1.4 measure.ps1 の変更が既定の動きを変えないか

- 差分（`git diff scripts/measure.ps1`）: `Start-EditorProcess` に省略できる引数を3つ足しただけ。`-ExtraEnv`（既定 `$null`）と `-StdoutFile`・`-StderrFile`（既定 `''`）。3つとも省けば `Start-Process -FilePath $Exe -ArgumentList $Arguments -PassThru` と同じ呼び出しになり、環境変数の退避と戻しも従来どおり。
- `ExtraEnv` で入れた変数は、`finally` で元の値に戻す（元が無ければ消す）。
- 判定: 満たす。

### 1.5 テスト

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | passed: 98  failed: 0（申告どおり） |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | passed: 134  failed: 0（申告どおり。netaudit.ps1 の構文と ASCII だけかの検査を含む） |

足したテスト31件を読んだ。素材は、合成したネットのログの行（問い合わせ・答え・接続・URL の4種）と NODE_DEBUG の行。確かめているのは、名前の付け方、共有アドレスの扱い、秘密を残さないこと、途中で切れたファイル、ヒントが許可に効かないこと、ホストごとの照合。実装に合わせて期待値を緩めた形跡は無い。

### 1.6 指摘（合否には響かない。直すのは曹参）

1. **Node の接続が、Chromium が開いたのと同じアドレスへ行くと、強い名前（netlog）が付く。** `Map` はアドレスで引く。そのため、拡張ホストなどが共有の CDN アドレスへ別のホストのために接続すると、その行は Chromium 側のホスト名になる（audit.md の Limits にも「valid for any process that reached the same address」とある）。実機でも upstream-default の `default.exp-tas.com` と `mobile.events.data.microsoft.com` の行の Roles に、extension-host や agent-host が混じった。この2件は Node の名前でも同じホストが出ているので、取り違えではない。行の名前を取り違えることはありうるが、Node が引いたホストは「Hosts seen by name」に `node` として別に必ず出るので、ホストを見落とすことにはならない。棚卸しでは、行の Roles（destinations.csv）と「Hosts seen by name」を併せて読んだ。直すなら、`Map` の名前は `utility-network` と本体のプロセスの接続にだけ付ける。
2. **`ExtraEnv` の戻しに単体テストが無い。** 既存の「portable env」のテストは、`-ExtraEnv` を渡さない経路だけを確かめている。`ExtraEnv` で渡した変数が台本の環境に残らないことのテストを足す。
3. **台本の冒頭の説明で、出力のファイル名が古い。** 16 行目は `netlog-hosts.csv` だが、実際の出力は `named-hosts.csv`（1054 行）。説明を直す。

## 2. 0-5 の本番（3通り×10分）

### 2.1 流したコマンド（すべて終了コード 0）

| 環境 | コマンド | 開始 | 取得 | ネットのログ | 出力 |
|---|---|---|---|---|---|
| upstream-ai-disabled | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -EnvDir C:/b/p0/data/upstream-ai-disabled -Label p05-upstream-ai-disabled -DurationSeconds 600 -Allowlist tasks/2026-11-13-p0-network-inventory/allowlist-draft.json` | 22:13:03 | 300回 | 9520 件、complete | `records/network-audits/2026-11-13-p05-upstream-ai-disabled/` |
| upstream-default | 同じ形（`-EnvDir C:/b/p0/data/upstream-default -Label p05-upstream-default`） | 22:23:28 | 300回 | 10907 件、complete | `records/network-audits/2026-11-13-p05-upstream-default/` |
| testbed | 同じ形（`-EnvDir C:/b/p0/data/testbed -Label p05-testbed`） | 22:34:16 | 300回 | 2732 件、complete | `records/network-audits/2026-11-13-p05-testbed/` |

- 3回は順に走らせた（同時に走らせない）。使った環境は上の3つだけ。`C:\b\smoke\` と `C:\b\wt\1.146.0` には触れていない。`p0-stop.ps1` は使っていない。
- `allowlist-draft.json`（このディレクトリ）は、claude.exe の順引きのヒントと許可の仮の線引きのために作った下書き。本番の一覧ではない。
- Node のデバッグ出力が出ていることは、`C:\b\p0\netlog\` の出力の行数で確かめた（中身は写していない。Grep で数だけ）。`NET <pid>:` の行は D 200、U 922、T 183。外向きの接続の行（`connect: find host` / `attempting to connect`）は D 0、U 47、T 0。

### 2.2 結果の要点（表は records/phase0/network-inventory.md）

| 環境 | エディタの宛先 | 名前が付いた数（netlog） | 名前なし（ヒントだけ） | claude.exe |
|---|---|---|---|---|
| upstream-ai-disabled | 5 | 5 | 0 | 起動せず |
| upstream-default | 7 | 4（1行は2ホストが同じアドレス） | 3（すべて Node 側。AgentHost・拡張ホスト） | 起動せず |
| testbed | 2 | 2 | 0 | 起動せず |

- 本家の Chromium 側の5件（テレメトリ、実験、更新の確認、ギャラリー、`main.vscode-cdn.net`）は、AI を止めても止めなくても出る。AI を止めると、Node 側（AgentHost・Copilot）の通信は出なくなった。
- 要る通信（Claude・git のリモート・Notion）は、3回とも1件も出なかった。claude.exe はパネルを開かないので起動せず、git は fetch をせず、notion-sync はまだ無い。

### 2.3 許可の一覧の確かめ

- `records/network-allowlist.json` を書いたあと、既定の場所から読ませて30秒だけ走らせ、形式の誤りで止まらないことを確かめた: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -EnvDir C:/b/p0/data/upstream-ai-disabled -Label p05-allowlist-check -DurationSeconds 30 -OutDir tasks/2026-11-13-p0-network-inventory/allowlist-check`。
- 結果: 終了コード 0。「allowlist is invalid」も「file not found」も出なかった。宛先5件はすべて「not in allowlist」で、10分の D と同じホストだった。

## 3. 判定

- 1（台本の直し）: **合格**。
- 2〜4（棚卸し・許可の一覧）: 依頼書の完了条件にある成果物はそろった。ただし claude.exe の表は観測なしで空。許可の一覧の Claude の宛先も、観測ではなく裁定から書いた（handoff-notes.md の未解決 1）。

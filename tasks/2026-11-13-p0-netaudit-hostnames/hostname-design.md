# 通信の監査で宛先のホスト名を取る: 調べと設計

担当: 曹参（cao-shen）。日付: 2026-11-13。対象: `scripts/netaudit.ps1`（docs/07 の 3.3）。

## 1. DNS のキャッシュが空になる理由

試しの結果、理由は2つあった。

### 1.1 Chromium が OS の DNS クライアントを通さず、自前で名前を引く

- Chromium のネットワーク層には、OS の `getaddrinfo()` を呼ぶ「システムのリゾルバー」と、自前の DNS クライアント（`net::DnsClient`）で DNS サーバーへ直接問い合わせる「組み込みのリゾルバー」がある。組み込みのほうは OS のキャッシュを通らない。出典: [Chromium net/dns README](https://chromium.googlesource.com/chromium/src/+/main/net/dns/README.md)、[Chromium host-resolver.md](https://chromium.googlesource.com/chromium/src/+/2f7dfeb1/net/docs/host-resolver.md)。
- 実機の確認: 40秒の試しで取ったネットのログ（1.8 MB）に、`DNS_TRANSACTION` が54件、`HOST_RESOLVER_MANAGER_REQUEST` が150件あった。`DNS_TRANSACTION` は Chromium 自身が DNS の問い合わせを組み立てて送った印である。エディタ（Code.exe 1.146.0）はこの経路で名前を引いている。

### 1.2 この PC では、PowerShell の名前引きでも `Get-DnsClientCache` が空のまま（原因は未確定）

- `tests/probe-dns.ps1` の結果（管理者ではない通常の権限）: `Resolve-DnsName api.notion.com`（8件の答え）と `[Dns]::GetHostAddresses`（8件）を実行した直後でも、`Get-DnsClientCache` は0件。`Dnscache` サービスは Running / Automatic、エラーは出ない。`ipconfig /displaydns` の出力も1行（見出しだけ）。
- つまり、OS の標準の経路で名前を引くプロセス（拡張ホストの Node、claude.exe）の名前も、キャッシュからは取れない。原因は特定できていない。管理者でないと読めない仕様なのか、キャッシュを無効にする設定なのかは、管理者の権限が要る確認になるので行っていない（7節）。
- したがって、`Get-DnsClientCache` に頼る手順（docs/07 の 3.3 の2）は、この PC では成り立たない。

## 2. 手段を試した結果

| 手段 | 結果 | 採否 |
|---|---|---|
| Electron の `--log-net-log=<file>`（出典: [Electron: command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)） | 動く。Code.exe の起動引数に足すだけ。10千行 / 40〜60秒。名前の付いた接続元は Chromium のネットワークサービス（`utility-network`）だけ。拡張ホストなど Node の通信は載らない。ファイルの終わり（`]}`）は Chromium が閉じるときに書く | 採用（主） |
| Node の `NODE_DEBUG=net`（環境変数。`ELECTRON_ENABLE_LOGGING=1` を併用） | 動く。`NET <pid>: connect: find host <名前>` と `attempting to connect to <ip>:<port>` が stderr に出る。拡張ホスト（renderer のコンソール経由）とエージェントホスト（`[AgentHost:stderr]`）の両方で出た。同じ行が2〜3回エコーされる。名前の一覧は正確だが、名前とアドレスの対応は出現順なので推測になる | 採用（Node 用。対応は「ヒント」扱い） |
| 逆引き（PTR） | CDN のアドレスでは `cdn-185-199-108-133.github.com` のように使える名前が出ることもあるが、出ないことが多い。PTR の名前はアドレスの持ち主が決める | 採用（ヒントだけ。「許可」の判定には使わない） |
| 許可の一覧の名前を今、順引きして、アドレスと結ぶ | 共有の CDN アドレスでは別のホストと取り違える恐れがある | 採用（ヒントだけ。claude.exe 用に用意。試しでは例の一覧 `tests/fixtures/network-allowlist.example.json` を渡したが、claude.exe の接続が出ず該当なし。動作は単体テストで確認） |
| TLS の SNI | パケットの取得（管理者の権限）が要る。また ECH（`ech_enabled: true` が net log に出ている）が使われると SNI は隠れる | 見送り（7節） |
| `pktmon`、DNS クライアントのイベントログ（`Microsoft-Windows-DNS-Client/Operational`） | どちらも管理者の権限が要る | 自分では有効にしない。7節に報告 |

## 3. ネットのログの読み方（実際の形）

`--log-net-log` のファイルは、1行に1つのイベント（JSON）が並ぶ形で、先頭の2行は定数（`{"constants":...` と `"events": [`）。必要な3種のイベントだけを、行の文字列で絞ってから JSON として読む（10万行でも速く、途中で切れたファイルでも読める）。

- 名前の問い合わせ: `params.dns_query_type` と `params.host` がある行。host は `https://host` や `host:443` の形。これで「どのホストを引いたか」と回数が分かる。
- 答え: `params.results.ip_endpoints[].endpoint_address`、`aliases`、`canonical_names` がある行。
- 接続: `params.address`（`ip:port`）と `source_dependency` がある行。同じ `source.id`（接続のジョブ）に、問い合わせの行がある。
- URL の要求: `params.url`、`load_flags`、`method` がある行（http/https/ws/wss だけ。ホストと回数だけを残す）。

**共有の CDN アドレス**: Microsoft の Front Door では、`marketplace.visualstudio.com`・`update.code.visualstudio.com`・`mobile.events.data.microsoft.com` などが同じアドレスを返すことがある（40秒の試しで確認）。答えのアドレスをそのまま対応表にすると、1つの接続が全部のホスト名に見えてしまい、許可の一覧を持っていると「許可のホストと同じアドレスだから許可」と誤判定する。そこで次の二重の守りにした。

1. 対応表（`Map`、`name from = netlog`）は、「そのアドレスへ実際に接続を開いたジョブ」のホスト名だけで作る。答えだけに出たアドレス（`AnswerMap`）は、ヒントに降格する。
2. ホストごとの表（「Hosts seen by name」）を別に出し、**ホストを1つずつ**許可の一覧と照らす。アドレスを共有していても、許可にないホストは必ず報告に出る。

## 4. 出力の形

`audit.md` と `destinations.csv/json` に次を足した（既存の列は変えていない）。

- 宛先の表に列 **name from**（CSV では `NameMethod`）: `netlog` / `dns-cache` / `netlog+dns-cache` / `none`。ヒントがあるときは `WeakNames` に `名前 [手段]` を残す（手段は `node-debug` / `netlog-answer` / `rdns` / `forward`）。ヒントはホストの列に「hint only」と出し、`Resolved` や `Allowed` には効かない。
- 表「Hosts seen by name」と `named-hosts.csv`: 列は `Host, Port, SeenBy(netlog / node / netlog+node), Requests, Resolutions, Answered, NodeLookups, SeenInSampling, Allowed, AllowReason`。サンプリング（2秒ごと）で拾えない短い接続のホストも載る。
- 「Not in the allowlist」に、名前で見えたホストの項目（`[by name: ...]`）を追加。
- `destinations.json` の Meta に `NetLogPath`、`NetLogEvents`、`NetLogComplete`。
- 許可の一覧の形（`records/network-allowlist.json`、docs/07 の 3.3 の5）は変えていない。照合は、`Names`（接続を開いたホストの別名つき）と IP だけで行い、ヒントは使わない。

ネットのログの扱い: ログ本体は `C:\b\p0\netlog\<ラベル>-<日時>.netlog.json`（`-NetLogDir` で変更可）に置く。Node の出力も同じ場所（`*.node-stdout.txt`、`*.node-stderr.txt`）。リポジトリの出力に写すのはホスト名と回数だけ（URL のパス・クエリ・ユーザー情報は読み取りの時点で捨てる。単体テストあり）。ネットのログに秘密が載るかどうかは確かめていないので、秘密を含むものとして扱い、使い終えたら `C:\b\p0\netlog\` を消す。

## 5. 起動と停止の変更

- `scripts/netaudit.ps1`: 起動の引数に `--log-net-log="<path>"` を足す。子プロセスにだけ `NODE_DEBUG=net` と `ELECTRON_ENABLE_LOGGING=1` を渡し、出力をファイルへ向ける。止めるときは、先にメインウィンドウへ閉じる要求（`CloseMainWindow`）を出して最大15秒待ち、Chromium にネットのログを閉じさせる。それから、起動した PID の木だけを強制終了する（既存の `Stop-EditorTree`）。
- `scripts/measure.ps1`: `Start-EditorProcess` に省略可の引数 `-ExtraEnv`、`-StdoutFile`、`-StderrFile` を足した（省くと従来と同じ）。`tests/measure.tests.ps1` は134件すべて通る。
- 切り替え: `-NoNetLog`、`-NoNodeDebug`、`-NoHints`。

## 6. 試しの結果（公式の zip、`C:\b\p0\data\upstream-default`、60秒、2回目）

出力: `trial/net60/`（`audit.md`、`destinations.csv`、`named-hosts.csv`）。

| 項目 | 前（DNS キャッシュだけ） | 後 |
|---|---|---|
| 宛先9件のうちホスト名が付いた数 | 0 | 5（すべて `netlog`） |
| 付いた名前 | なし | `default.exp-tas.com`（実験の設定）、`main.vscode-cdn.net`（CDN）、`marketplace.visualstudio.com`、`mobile.events.data.microsoft.com`（テレメトリ）、`update.code.visualstudio.com`（更新の確認） |
| 付かなかった4件 | - | すべて Node 側（役割は agent-host 2件、extension-host 2件）。ヒントだけ付いた: `github.com`・`release-assets.githubusercontent.com`・`exp.individual.githubcopilot.com`・`default.exp-tas.com` などの候補（対応は推測）、`cdn-185-199-108-133.github.com`（逆引き） |
| 名前で見えたホスト | - | 9件（net log 6、Node の名前 5、重なり 2）。そのうち `wpad` は WPAD の自動検出で、接続ではない |

この 60秒では、不要な通信（テレメトリ `mobile.events.data.microsoft.com`、更新の確認 `update.code.visualstudio.com`、実験の設定 `default.exp-tas.com`）が実際に出ていることを、ホスト名で確認できた。0-5 の本番（10分）では、これらが「設定で止める」「単位で消す」の候補になる。

## 7. できなかったこと（管理者の権限が要る。自分では有効にしていない）

| 手段 | 何のために要るか | 要る権限 |
|---|---|---|
| `wevtutil sl Microsoft-Windows-DNS-Client/Operational /e:true`（DNS クライアントのイベントログ） | claude.exe と、NODE_DEBUG が出さないプロセスの名前の問い合わせを、OS 側から取る（Node 側の対応も推測でなく確定できる見込み。イベントにプロセス ID が入るかは、有効にして確かめる） | 管理者 |
| `pktmon` | 2秒より短い接続、UDP、パケットから SNI を取る（ECH のホストは隠れる） | 管理者 |
| `Get-DnsClientCache` が空の原因の切り分け（管理者で実行したら出るのか） | 1.2 の原因の確定 | 管理者 |

## 8. 残る穴

- claude.exe の接続（api.anthropic.com など）には名前が付かない。Node のデバッグ出力は出ず（Bun 製の実行ファイル。出力を確かめていない）、net log にも載らないため。許可の一覧があれば、順引きのヒントが付く。claude.exe の宛先は「要る通信」なので、0-5 では別の表（claude の表）で見る。実際の IP は表に残る。
- Node の名前とアドレスの対応は、同じ PID の出現順による推測。名前の一覧のほうは正確。
- 2秒より短い接続はサンプリングに載らないが、net log の「Hosts seen by name」には載る。Node 側の短い接続は、`NODE_DEBUG` の「名前」には載る（アドレスは載らない）。

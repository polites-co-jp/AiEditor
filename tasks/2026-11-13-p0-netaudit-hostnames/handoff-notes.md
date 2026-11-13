# 引き継ぎ: 通信の監査で宛先のホスト名を取る（曹参）

## 完了報告

- 結果: 完了
- 成果物:
  - `scripts/netaudit.ps1`（ホスト名の取得を追加）、`scripts/measure.ps1`（`Start-EditorProcess` に省略可の引数を3つ足しただけ）
  - `tests/netaudit.tests.ps1`（31件を足した）
  - `tasks/2026-11-13-p0-netaudit-hostnames/hostname-design.md`（調べ・選んだ手段・出力の形）
  - 試しの出力 `tasks/2026-11-13-p0-netaudit-hostnames/trial/net60/`（60秒、公式の zip）
- 要点:
  1. 空になる理由は2つ。Chromium が自前の DNS クライアントで名前を引く（net log に `DNS_TRANSACTION` 54件）ことと、この PC では PowerShell の名前引きの後でも `Get-DnsClientCache` が0件のままであること（原因は未確定）。
  2. 主な手段は Electron の `--log-net-log`。Node（拡張ホスト・エージェントホスト）には `NODE_DEBUG=net` が使える。逆引きと順引きはヒントだけ。
  3. 60秒の試しで、宛先9件のうち5件にホスト名が付いた（前は0件）。テレメトリ・更新の確認・実験の設定のホストが実際に出ていることが見えた。残り4件は Node 側で、ヒントの候補だけ付く。
  4. 共有の CDN アドレスで別のホストと取り違えないよう、アドレスの対応表は「実際に接続を開いたホスト」だけで作り、さらにホストを1つずつ許可の一覧と照らす表を足した。
  5. 管理者の権限が要る手段（DNS クライアントのイベントログ、pktmon）は有効にしていない。理由は `hostname-design.md` の7節。
- 実行結果:
  - `tests/netaudit.tests.ps1`: 通過 98 / 失敗 0（足す前は67）
  - `tests/measure.tests.ps1`: 通過 134 / 失敗 0（measure.ps1 を触ったので走らせた）
  - 実機: `scripts/netaudit.ps1 -EnvDir C:/b/p0/data/upstream-default -DurationSeconds 60 ...` を2回（40秒の予備と60秒の本試し）。普段使いの `argv.json` は作られていない（警告なし）。
  - 落ちたテストは途中で1件（空のファイルを null にしない実装の不備）。直して通した。
- 仕様から想定した入口: なし（実装済みの台本に足した）。

## 出力の変更点（大岡越前守の検証用）

- `audit.md` の宛先の表に列 `name from`、新しい表「Hosts seen by name」、「Not in the allowlist」に `[by name: ...]` の項目。
- `destinations.csv/json` に `NameMethod`、`WeakNames`。`named-hosts.csv` を新設。
- 新しい引数: `-NetLogDir`（既定 `C:\b\p0\netlog`）、`-NoNetLog`、`-NoNodeDebug`、`-NoHints`。
- 許可の一覧（`records/network-allowlist.json`）の形は変えていない。ヒントの名前は「許可」の判定に使わない。

## docs/ との食い違い（リーダーが直す）

- docs/07 の 3.3 の2「始めと終わりに `Get-DnsClientCache` を取り、IP アドレスとホスト名を結びつける」は、この PC では成り立たない。実装は「ネットのログ → DNS キャッシュ → ヒント（Node のデバッグ出力・逆引き・順引き）」の順になった。3.3 に、ネットのログと Node のデバッグ出力の記述を足す必要がある。どちらが正しいかを決めずに報告する。
- 3.3 の末尾「必要になったら pktmon か Resource Monitor で補う」: 管理者の権限が要る。要否は大岡越前守の 0-5 の結果を見て決める。

## 未解決の点

1. **claude.exe の接続は名前が付かない。** Node のデバッグ出力が出ないため（Bun 製の実行ファイル。出力そのものは確かめていない）。実行ファイルの接続は claude の表に分かれており、要る通信（Anthropic）が対象なので、0-5 では IP と接続先の組で見ればよい。名前を確定させるには、管理者の権限で DNS クライアントのイベントログを有効にする必要がある（hostname-design.md の7節。有効にしてよいかはリーダーとユーザーの判断）。
2. **`Get-DnsClientCache` が空の原因が未確定。** 管理者で実行すると出るのかは確かめていない（同上）。
3. **Node の名前とアドレスの対応は推測。** 同じ PID の出現順で結ぶ。ホスト名の一覧は正確。
4. **ネットのログに秘密が載るかは未確認。** 秘密を含むものとして `C:\b\p0\netlog\` に置いた。使い終えたら消す（私の権限では消せない）。リポジトリに写したのはホスト名と回数だけ。
5. **試しの跡。**
   - `tests/probe-dns.ps1`、`tests/probe-netlog.ps1`、`tests/probe-netlog2.ps1`、`tests/probe-nodedebug.ps1` は調べ用の使い捨て（テストではない）。私の権限では消せないので、不要ならリーダーが消す。`probe-netlog*.ps1` はネットのログのイベントを生で表示するので、秘密が出る恐れがある。
   - `trial/net60/netlog-hosts.csv` は途中の版の出力の残り（最新は `named-hosts.csv`）。`trial/probe1/` は最初の予備（40秒、名前なしの版との比較用）。
## 追記: 検証の指摘3点（verification-log.md の1.6）への対応

- 結果: 完了。エディタを起動する実機の試しはしていない（依頼どおり）。
- 指摘1（Node の接続に Chromium 側の強い名前が付く）: `New-DestinationRows` が、ネットのログの対応表（`OnlyRoles = utility-network, main`）の名前を、行の Roles がすべてその2つのときだけ「強い名前」にするようにした。行に extension-host や agent-host などが混じるときは、名前を `名前 [netlog, shared with other process]` のヒントに落とす（`HostKey` は IP のまま、`Resolved` と `Allowed` に効かない）。DNS キャッシュの名前は従来どおり強い名前。
  - 影響: 実機で Roles が混じった行（例: `default.exp-tas.com`、`mobile.events.data.microsoft.com`）は、これまで名前が付いていたが、ヒント表示になる。ホストごとの表（Hosts seen by name）には両方とも出るので、ホストは見落とさない。Chromium と Node を分けて数えれば混じった行の名前も保てるが、行の作り方が変わるので今回は見送った。必要ならリーダーの判断。
  - audit.md の Limits の文も、この規則に合わせて直した。
- 指摘2（`ExtraEnv` の戻しの単体テスト）: `tests/measure.tests.ps1` に4件を足した。子が値を見る・元が無ければ親に残らない、元の値を戻す（`VSCODE_PORTABLE` と併用）、起動に失敗しても戻る、`-StdoutFile`/`-StderrFile` に出力が入る。
- 指摘3（冒頭の説明のファイル名）: `scripts/netaudit.ps1` の説明を `named-hosts.csv` に直した。
- テスト: `tests/netaudit.tests.ps1` 通過102 / 失敗0（指摘1の4件を足した）。`tests/measure.tests.ps1` 通過138 / 失敗0（指摘2の4件を足した）。ASCII のみの検査も通っている。

6. 10分の本番（0-5）はまだ行っていない。ネットのログは10分で 25 MB 前後になる見込み（40秒で 1.8 MB から見積もり。実測ではない）。

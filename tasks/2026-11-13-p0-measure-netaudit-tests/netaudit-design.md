# netaudit.ps1 の使い方と設計

`scripts/netaudit.ps1`。docs/07 の3.3 の台本。Windows PowerShell 5.1 で動く、ASCII のみ。共通の関数（子孫の集め方、claude の分け方、データの置き場所、起動、停止）は `scripts/measure.ps1` を読み込んで使う。

## 使い方

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 `
  -Exe C:\b\p0\vscode-1.146.0\Code.exe -EnvDir C:\b\p0\data\upstream-ai-disabled `
  -Label upstream-ai-disabled [-Previous <前回の出力先>] [-Allowlist <一覧>]
```

| 引数 | 既定 | 意味 |
|---|---|---|
| `-Exe` `-EnvDir` `-Label` | 必須 | measure.ps1 と同じ |
| `-Workspace` | `<リポジトリ>\tmp\ws` | ワークスペース |
| `-OpenFiles` | `C:\b\p0\ws-info.json` の2つ | measure.ps1 と同じ（`,` 区切りの文字列を分け、ちょうど2つで存在しなければ止まる）。`-LaunchWaitSeconds`（30秒）後に、1つずつ 10 秒あけて `-r` で開く（サンプリングは止めない） |
| `-DurationSeconds` / `-IntervalSeconds` | 600 / 2 | 監査の長さと間隔 |
| `-DnsIntervalSeconds` | 30 | DNS キャッシュを取る間隔（下記） |
| `-Previous` | なし | 前の版の出力先（または `destinations.json`）。新しい宛先を目立たせる |
| `-Allowlist` | `records/network-allowlist.json` | 許した宛先の一覧 |
| `-OutDir` | `records/network-audits/<日付>-<ラベル>/` | 出力先。`destinations.json` があれば `-Force` |
| `-WorkRoot` `-ProcessName` `-KeepData` | measure.ps1 と同じ | |

流れ: 毎回新しいデータを作る → 起動（ここが 0 秒）→ 2秒ごとに ① Win32_Process でメインから子孫を集める ② `Get-NetTCPConnection -State Established` を取り、子孫の PID の接続だけ残す（ループバックと未指定アドレスは宛先にしない）→ 終わりに停止してデータを消す。

## 出力

- `audit.md`: エディタの宛先表、claude.exe の宛先表（別。削る対象ではない）、許した一覧にないもの、新しい宛先、限界。
- `destinations.csv` / `destinations.json`: 宛先ごとに、グループ（editor / claude）、ホスト名（無ければ IP）、別名の列、IP、ポート、初出（起動から何秒、時刻）、プロセス名、役割、回数（その宛先が見えたサンプル数。IP が複数あれば足す）、New、Allowed、許した理由。同じホストの複数 IP は1行にまとめる。
- `samples.csv`: サンプルごとの接続（時刻、PID、プロセス、役割、グループ、宛先、ポート）。
- `dns-cache.csv`: 取った DNS キャッシュの全部。

## 判定

- ホスト名との結びつけ: DNS キャッシュの A/AAAA で IP からホスト名を引く。CNAME をたどり、プログラムが問い合わせた名前（別名の外側）を先頭、実体の名前を最後に並べる。結びつかない IP は IP のまま「unresolved」と表示する。
- 新しい宛先: `-Previous` の一覧に同じグループ・同じホスト名（無ければ IP）が無いもの。IP が変わっただけでは新しくない。`-Previous` が無いときは何も新しいとしない（その旨を audit.md に書く）。
- 許した一覧にないもの: 判定で報告する。台本は合否を出さず、終了コードは常に 0。一覧のファイルが無いときは全部「一覧にない」になる（0-5 の最初の棚卸しでは一覧がまだ無いため）。

## 許した宛先の一覧の形（`records/network-allowlist.json`）

```json
{
  "version": 1,
  "updated": "2026-11-13",
  "allow": [
    { "host": "api.notion.com", "ports": [443], "reason": "Notion sync (docs/05)" },
    { "host": "api.anthropic.com", "ports": [443], "processes": ["claude.exe"], "reason": "Claude Code CLI" },
    { "host": "*.claude.ai", "reason": "Claude Code login" },
    { "host": "198.51.100.7", "reason": "IP literal for an unresolved destination" }
  ]
}
```

- `host`（必須）: ホスト名、`*.example.com`（任意の深さのサブドメイン。`example.com` 自体は含まない）、IP。`*` 単独や途中の `*` は不可（全部を許す事故を防ぐ）。
- `reason`（必須）: 許す理由。
- `ports`（任意）: 空なら全ポート。`processes`（任意）: 空なら全プロセス。指定したときは、その宛先に接続したプロセスの全部が含まれる必要がある（エディタが claude 用の宛先に出たら一覧にない扱い）。
- 別名と実体のどちらの名前でも一致する。例のファイルは `tests/fixtures/network-allowlist.example.json`（テストの材料。本物は大岡越前守が 0-5 で作る）。形の検査は `Test-AllowlistFormat`（不正なら台本が始める前に止まる）。

## 初出の時刻（B-7）

「起動から何秒」の 0 は、エディタを起動する直前の時刻。各サンプルの秒数は、接続を読んだ後の時刻で出す（サンプル開始の時刻ではない。以前は最大でサンプル1回分ずれた）。役割は measure.ps1 の `Get-RoleMap` で付け直した役割を `samples.csv` と宛先表に使う。

## 環境の与え方（measure.ps1 と共通）

毎回のデータはひな形（`<EnvDir>\user`・`ext`）の写し。起動する子にだけ `VSCODE_PORTABLE=<写した先>\user` を与え、`ELECTRON_RUN_AS_NODE` と `VSCODE_*` は外す（詳細は measure-design.md）。`-Exe` を省くと `<EnvDir>\p0-env.json` の `editor.exe` を使う。開始前と終了後に普段使いの `argv.json` を比べ、作られたら audit.md に警告する。

## 試しの結果

### 最新の試し（B-5・B-7 の直し後。本家 1.146.0、`upstream-default`、`tmp\ws`、60秒）

2つのファイルを `a,b` の文字列で渡し、1つずつ開いた（15秒、25秒）。30サンプル、editor の宛先 9件（443、Code.exe。初出 4.4〜19.5 秒）、claude の宛先 0件。ホスト名はやはり付かない（`Get-DnsClientCache` が0件）。出力は `trial/net-real2/`。

### 以前の試し（B-5 の前。参考）

### 実エディタ（本家 1.146.0、`upstream-default`、45秒）

```
-EnvDir C:/b/p0/data/upstream-default -Workspace <trial/ws> -OpenFiles a.ts,b.py -Label trial-real -DurationSeconds 45 -LaunchWaitSeconds 15 -Allowlist tests/fixtures/network-allowlist.example.json
```

- 23サンプル。editor の宛先 9件（すべて 443、プロセスは Code.exe。4〜8 秒で初出。13.107.5.93、185.199.111.133、20.27.163.208、4.150.223.100/.104、52.175.140.176、IPv6 3件）。claude.exe の宛先は0件（パネルを開いていない）。出力は `trial/net-real/`。
- 例の許可一覧には載っていないので9件とも「一覧にない」と報告された。
- **ホスト名は付かなかった**: 実エディタでも `Get-DnsClientCache` が全スナップショットで0件。この環境で取れない（非管理者。サービスは Running）ことが再確認できた。0-5 では、管理者で実行するか pktmon を併用するか、大岡越前守の実機で決める必要がある。
- 普段使いの `argv.json` は作られなかった。

### 身代わりのエディタ（先に行った試し）

- `tests/fixtures/fake-editor.cmd`（接続なし）14秒: 7サンプル、宛先なし、DNS が空である旨の警告つきの audit.md。
- `tests/fixtures/fake-net-editor.cmd`（example.com:443 に1接続を40秒保つ。`-ProcessName powershell.exe`）24秒、`-Previous` に上の出力を渡して: 12サンプル、宛先1件（`104.20.23.154:443`、初出 0 秒、プロセス powershell.exe、9サンプル）が見え、一覧にない・新しい宛先として報告された。接続の収集、グループ分け、新しい宛先、一覧の判定は実機で通った。
- **ホスト名の結びつけは実機で通らなかった**: この環境では `Get-DnsClientCache` が、名前を引いた直後でも 0 件を返した（非管理者。DNS Client サービスは Running。`tests/probe-dns.ps1` で確認）。そのため IP のまま unresolved になった。この PC の環境の問題か、非管理者だと読めないのかは未切り分け。台本は、全部のスナップショットが空だと audit.md に警告を書く。大岡越前守の実機（0-5）で、①管理者でなくても取れるか ②取れなければ管理者で実行するか pktmon（docs/07 3.3 の補い）を使うか、を決める必要がある。
- DNS キャッシュは TTL で消えるので、始めと終わりに加え 30 秒ごとにも取って合算する（docs の「始めと終わり」から広げた点）。

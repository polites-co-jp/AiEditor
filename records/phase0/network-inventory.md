# 0-5 外向き通信の棚卸し

- 日付: 2026-11-13。担当: 大岡越前守（ooka-echizen）。手順: docs/07 の2.6・3.3。台本: `scripts/netaudit.ps1`（曹参がホスト名の取得を足した版。検証は `tasks/2026-11-13-p0-network-inventory/verification-log.md` の1節）。
- 方針（裁定 2026-11-13「通信の扱いの訂正」）: 要る通信は Claude・git のリモート・Notion だけ。ほかは「設定で止める」か「単位で消す」。
- 許可の一覧の最初の版: `records/network-allowlist.json`。

## 1. 条件

| 環境 | 実行ファイル | 中身 | 記録 |
|---|---|---|---|
| upstream-ai-disabled | 本家 1.146.0（`C:\b\p0\vscode-1.146.0\Code.exe`） | `chat.disableAIFeatures: true`、Claude Code 2.1.322 | `records/network-audits/2026-11-13-p05-upstream-ai-disabled/` |
| upstream-default | 本家 1.146.0 | AI は既定のまま、台帳の拡張9件（言語パックを含む） | `records/network-audits/2026-11-13-p05-upstream-default/` |
| testbed | VSCodium 1.143.17232（段階 A の組み込み拡張を消したもの） | 台帳の拡張7件 | `records/network-audits/2026-11-13-p05-testbed/` |

- 3通りとも、起動から600秒、2秒ごとに300回の取得。ワークスペースは `tmp\ws\`、30秒後から TS と Python のファイルを1つずつ開いた。
- 名前は、Chromium 側はネットのログ（`--log-net-log`）、Node 側（拡張ホスト・AgentHost など）は `NODE_DEBUG=net` の出力で取った。ネットのログは3回とも閉じた状態で残った（complete）。`Get-DnsClientCache` は3回とも0件。
- 画面の操作は行っていない（Claude Code のパネルも開いていない）。そのため **claude.exe は3回とも起動せず、CLI の表は空**（3節）。設定の検索・package.json の編集など、操作で起きる通信もこの表には無い（4節）。

## 2. エディタの宛先

「プロセス」の列: `utility-network` は Chromium のネットワークサービス（本体とウィンドウの要求をまとめて出す）。どの部品が要求したかは、ネットのログの中身を写さない方針なので、product.json の URL と組の出方から推した（推定と書いた）。「出た環境」: D = upstream-ai-disabled、U = upstream-default、T = testbed。

### 2.1 本家 1.146.0

| 宛先（ホスト名） | 接続したプロセス | 出た環境 | 何のための通信か | 要るか | 止め方 |
|---|---|---|---|---|---|
| `mobile.events.data.microsoft.com` | utility-network（D・U）、AgentHost と拡張ホスト（U だけ） | D・U | テレメトリ（1DS の送信先。docs/03 の B-1 の注に同じ） | 設定で止める・単位で消す | 設定: `telemetry.telemetryLevel: off`（docs/04 の6.1 にある）。単位: B-1-telemetry（1dsAppender の差し替え）。自作は OSS の product.json に `ariaKey`・`aiConfig` が無い（docs/02 の3節）。Node 側の送信（AgentHost・拡張ホスト）は C-1-ai と A-1-copilot-extension で消える見込み（推定。D では出なかった） |
| `default.exp-tas.com` | utility-network（D・U）、拡張ホスト（U だけ） | D・U | 実験の設定（product.json の `tasConfig.endpoint` = `https://default.exp-tas.com/vscode/ab`）。拡張ホスト側は組み込みの Copilot 拡張の実験と推定 | 設定で止める・単位で消す | 設定: `workbench.enableExperiments: false`（6.1 にある）。単位: B-2-onboarding-experiments-surveys（`services/assignment` の差し替え）。自作の product.json に `tasConfig` を入れない（OSS の product.json にあるかは未確認。あれば docs/02 の3節で remove に足す案）。拡張ホスト側は A-1 |
| `update.code.visualstudio.com` | utility-network | D・U | 本体の更新の確認（product.json の `updateUrl`） | 設定で止める | 設定: `update.mode: none`（6.1 にある）。自作は OSS の product.json に `updateUrl` が無いので、更新のサービスは働かない見込み（docs/02 の3節） |
| `marketplace.visualstudio.com` | utility-network | D・U | 拡張のギャラリー（product.json の `extensionsGallery.serviceUrl`。入っている拡張の更新の確認・おすすめと推定） | 設定で止める・単位で消す | 設定: `extensions.autoCheckUpdates: false`・`extensions.autoUpdate: false`（6.1 にある）。自作は OSS の product.json に `extensionsGallery` が無い（docs/02 の3節）。単位: C-5-extension-gallery |
| `main.vscode-cdn.net` | utility-network | D・U | 未確認。product.json でこのホストを指すのは `extensionsGallery.controlUrl`（拡張の禁止・非推奨の一覧）、`extensionsGallery.mcpUrl`、`emergencyAlertUrl`、`profileTemplatesUrl`、`chatParticipantRegistry`、`agentSdks`、`dictationRuntime`、`webEndpointUrl`。D（AI を止めた状態）でも出るので、AI 以外のキー（controlUrl か emergencyAlertUrl）を含むと推定 | 単位で消す | product.json の上書き（docs/02 の3節）の `remove` に、OSS の product.json にあるものを足す案。`controlUrl`・`mcpUrl` は `extensionsGallery` の中なので自作には無い。`chatParticipantRegistry`・`agentSdks`・`dictationRuntime` は C-1 の remove に足す案。`emergencyAlertUrl`・`profileTemplatesUrl` は新しい単位の案「B-6-online-feeds」（product.json のキーを消し、読む側が値の無いときに何もしないことを確かめる）。どのキーかは、自作のビルドで監査して残るかで確かめる |
| `exp.individual.githubcopilot.com` | 拡張ホスト（Node の名前。アドレス 52.175.140.176 との対応はヒント） | U | 組み込みの Copilot 拡張の実験の設定（推定） | 単位で消す | 単位: A-1-copilot-extension。D（`chat.disableAIFeatures: true`）では出なかった |
| `github.com`（git のリモートではない） | AgentHost（Node の名前。アドレス 20.27.177.113 との対応はヒント） | U | AgentHost が GitHub のリリースから何かを取る通信と推定（次の行と組で出た）。git のリモートではない | 単位で消す | 単位: C-1-ai（`platform/agentHost`・`services/agentHost`）。設定: `chat.disableAIFeatures: true`（6.1 にある。D では出なかった）。許可の一覧では `github.com` を git のプロセスだけに絞った |
| `release-assets.githubusercontent.com` | AgentHost（Node の名前） | U | GitHub のリリースの添付ファイルの取得。AgentHost が Copilot のランタイムなどを取ると推定（product.json の `copilotVersions`） | 単位で消す | 同上（C-1-ai。D では出なかった） |
| 185.199.108.133（名前なし。逆引きは `cdn-185-199-108-133.github.com`） | AgentHost・共有プロセス | U | GitHub の CDN のアドレス。上の2行の取得の続きと推定 | 単位で消す | 同上（C-1-ai。D では出なかった） |
| `wpad`（ポート 80。名前の問い合わせだけで、答えも接続も無い） | utility-network | D・U・T | Chromium のプロキシの自動検出（WPAD）。社外への接続ではなく、手元のネットワークでの名前の問い合わせ | 設定で止める（案。未確認） | 未確認。候補: Windows の「設定を自動的に検出する」を切る（エディタの外の設定）、または Chromium の起動の引数でプロキシの自動検出を切る。git・Claude のプロキシの設定と干渉しないかを確かめてから決める |

- D と U の差: Chromium 側の5件（上の表の1〜5行）は両方で同じ。U だけに出たのは Node 側（AgentHost・拡張ホスト）の通信で、どれも本家の AI（Copilot、AgentHost）のもの。`chat.disableAIFeatures: true` で止まった。
- U では `main.vscode-cdn.net` と `update.code.visualstudio.com` が同じアドレス（Front Door）を使い、宛先の表で1行にまとまった（`destinations.csv` の2行目）。ホストごとの表（`audit.md` の「Hosts seen by name」）では別々に出ている。
- 20.27.177.113 の行のヒントには `mobile.events.data.microsoft.com` も並ぶ（同じ PID の候補）。名前の一覧（`NodeLookups`）は正確だが、アドレスとの対応は推定。

### 2.2 試験台（VSCodium 1.143。自作のビルドには無い宛先だが記録する）

| 宛先（ホスト名） | 接続したプロセス | 出た環境 | 何のための通信か | 要るか | 止め方 |
|---|---|---|---|---|---|
| `open-vsx.org` | utility-network | T | 拡張のギャラリー（VSCodium の `extensionsGallery.serviceUrl`）。入っている拡張の更新の確認と推定 | 設定で止める | `extensions.autoCheckUpdates: false`・`extensions.autoUpdate: false`。自作は `extensionsGallery` を持たない |
| `raw.githubusercontent.com` | utility-network | T | VSCodium の `updateUrl`（本体の更新の確認）と `extensionsGallery.controlUrl`（拡張の禁止の一覧）が両方このホスト | 設定で止める | `update.mode: none`。自作の product.json にはどちらも無い |

- 試験台では Node 側の外向きの接続は0件だった（`NODE_DEBUG=net` の出力に接続の行が無い）。

## 3. Claude Code の CLI（claude.exe）の宛先

| 宛先 | 接続したプロセス | 何のための通信か | 要るか | 止め方 |
|---|---|---|---|---|
| （観測なし） | — | 3回とも claude.exe は起動しなかった。Claude Code のパネルを開いていないため | — | — |

- Claude Code 拡張そのもの（拡張ホストの中）は、D の10分で外向きの接続をしなかった（`NODE_DEBUG=net` の接続の行が0件）。
- 許可の一覧には、裁定に沿って Claude の宛先（`api.anthropic.com`、`*.anthropic.com`（claude.exe だけ）、`claude.ai`、`platform.claude.com`）を、観測なしのまま入れた。パネルを開いて決まった1文を送る監査（手で行う）を1回行い、実際の宛先で一覧を絞る必要がある。

## 4. この表に無いもの（10分の起動では出なかった）

- docs/04 の6.1 の候補（`typescript.disableAutomaticTypeAcquisition`、`npm.fetchOnlinePackageInfo`、`json.schemaDownload.enable`、`workbench.settings.enableNaturalLanguageSearch`）が止める通信は、3回とも出なかった。どれも操作（JS の型の取得、package.json の編集、JSON のスキーマ、設定の検索）で起きる通信なので、起動の監査には出ない。止める設定として 6.1 に入れておくことを勧める（本家の product.json には設定の検索の宛先 `bingsettingssearch.trafficmanager.net` もある）。
- git のリモート: ワークスペースの git は自動の fetch をしないので、出なかった。
- Notion: `notion-sync` はまだ無い。
- UDP と2秒より短い接続は、サンプリングでは取りこぼす。Chromium 側はネットのログの「Hosts seen by name」で補った（ここに出たホストは全部上の表にある）。Node 側も `NODE_DEBUG=net` の名前で補った。claude.exe など、どちらも出さないプロセスの短い接続は取れない。

## 5. 止める設定・単位のまとめ（リーダーが docs/04 の6.1・docs/03 に反映する案）

| 種類 | 中身 | 対象の宛先 |
|---|---|---|
| 6.1 にすでにある設定 | `telemetry.telemetryLevel: off`、`workbench.enableExperiments: false`、`update.mode: none`、`extensions.autoCheckUpdates: false`・`extensions.autoUpdate: false`、`chat.disableAIFeatures: true` | テレメトリ、実験、更新の確認、拡張のギャラリー、AgentHost と Copilot の通信 |
| 6.1 の候補を確定する | `typescript.disableAutomaticTypeAcquisition: true`、`npm.fetchOnlinePackageInfo: false`、`json.schemaDownload.enable: false`、`workbench.settings.enableNaturalLanguageSearch: false` | 操作で起きる通信（4節） |
| 既存の単位 | B-1（テレメトリ）、B-2（実験）、C-5（ギャラリー）、A-1（Copilot）、C-1（AI・AgentHost） | 2.1 の表のとおり |
| 新しい単位の案 | B-6-online-feeds: product.json の `emergencyAlertUrl`・`profileTemplatesUrl`（OSS にあれば）を消す | `main.vscode-cdn.net`（AI 以外の分） |
| product.json の上書きに足す案 | C-1 の remove に `chatParticipantRegistry`・`agentSdks`・`dictationRuntime`・`copilotVersions`。`tasConfig` が OSS にあれば remove | `main.vscode-cdn.net`（AI の分）、`default.exp-tas.com` |
| 未確認 | WPAD（`wpad`）の止め方 | `wpad` |

設定が実際に効くかは、この棚卸しでは確かめていない（設定を入れた環境の監査が要る）。自作のビルドで同じ監査を行い、上の宛先が残らないことを確かめる。

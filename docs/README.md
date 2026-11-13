# Shuko（仮称）設計資料

Claude Code でのコーディングに特化した、省メモリの VS Code 派生エディタ（Windows 専用、利用者は1人）の設計資料。実装する人がこの資料だけを読んで Phase 0 に着手できるように書いた。

- 「Shuko」は仮の名前。正式な名前とアイコンは後でユーザーが決める（[08-risks-and-open-items.md](08-risks-and-open-items.md)）。Microsoft・Visual Studio・Claude の名称とロゴは使わない。
- 本文の `<editor>` は決まった名前（applicationName）に置き換えて読む。

## 読む順

| 順 | ファイル | 中身 | いつ読むか |
|---|---|---|---|
| 1 | [00-overview.md](00-overview.md) | 目的、使う場面、方針、ユーザーの裁定の一覧、用語 | 最初に必ず |
| 2 | [07-phases.md](07-phases.md) | Phase 0 から運用までの段取り、各段階の完了条件（計測の手順は残すが使わない） | 次に。Phase 0 の手順はここにある |
| 3 | [01-requirements.md](01-requirements.md) | 残す・足す・消す機能の一覧、言語ごとの言語機能、外部ツールの入れ方 | 何を作るかを知るとき |
| 4 | [02-repository-and-build.md](02-repository-and-build.md) | リポジトリの構成、product.json の上書き、Windows でのビルド、zip、版ごとのフォルダ | Phase 1 の前 |
| 5 | [03-removal-design.md](03-removal-design.md) | コードを消す方法（削除の単位、適用の順、パッチの保ち方、戻し方）、削除の単位の一覧 | Phase 2 の前 |
| 6 | [04-bundled-extensions.md](04-bundled-extensions.md) | 同梱する拡張の台帳 `extensions.lock.json`、検証、入れ方、自前の組み込み拡張 `mydist` | Phase 0 の手順 0-6 と Phase 2 の前 |
| 7 | [05-settings-sync.md](05-settings-sync.md) | Notion を使った設定の同期（自前の拡張 `notion-sync`） | Phase 4 の前 |
| 8 | [06-update-watch-and-take-in.md](06-update-watch-and-take-in.md) | 本体と拡張の新版の検知、Notion の ToDo への書き込み、毎週の取り込みと検証、入れ替えと戻し方 | Phase 3 の前 |
| 9 | [08-risks-and-open-items.md](08-risks-and-open-items.md) | リスク、実機で確かめること、調べること、決定済みの論点と未決の論点、別案 | 各 Phase の終わりに見直す |

`sources/` には設計の根拠にした調査メモがある（2026-11-12 取得）。
- `sources/research-vscode-source.md`: 本家 1.146.0 のソース、ビルド、VSCodium
- `sources/research-extensions-services.md`: Open VSX、Claude Code 拡張の manifest、Notion API、Windows の道具
- `sources/fork-base-research.md`: 最初の調査1。ライセンス、既存のフォークの事例、Windows でのビルド、上流の更新の検知、設定の同期（後の調査で訂正された箇所には注記がある）
- `sources/feature-memory-research.md`: 最初の調査2。Claude Code 拡張の依存、メモリ消費の内訳、残す機能の部品、言語機能、日本語化とキー割り当て（同上）

[user-decisions.md](user-decisions.md) は、ユーザーの裁定を決まった順に記録した原本。[00-overview.md](00-overview.md) の4節はその一覧。

## 凡例

- [一次]: 公式文書・公式リポジトリ・公式 API で確かめた事実。[二次]: 記事・issue・検索の要約。
- 推定: 出典で確かめていない見立て。実機か調査で確かめるまで、前提として扱わない。
- 未確認: 調べたが確かめられなかったこと。
- 要照合: 要約を経由した引用。設計の判断に使う前に原文で照合する。
- 事実の取得日は、特記がなければ 2026-11-12。本家の基準の版は 1.146.0（コミット `69047191fc427f2f92828279aae1d90d8eeda7ab`）。

## この資料の扱い

- ユーザーの裁定（[00-overview.md](00-overview.md) の4節。設計資料の論点への裁定は4.3）が最優先。裁定と違う案は「別案」として分け、[08-risks-and-open-items.md](08-risks-and-open-items.md) に載せた。実装者は別案を勝手に採らない。
- 実装中に分かった事実で資料と食い違うものは、資料を直してから先へ進む。どの事実で直したかを書き残す。
- LLM の処理は Anthropic の API キーを使わず、Claude Code の CLI（`claude -p`）で起動する。

# 台帳と mydist を今日の裁定に合わせる

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

2026-11-13 の裁定と記録を、台帳（`extensions.lock.json`）と自前の組み込み拡張 `mydist` に反映する。Phase 1 のビルドに入る前に済ませる。

## 入力

- docs/user-decisions.md の末尾の4節（通信の扱いの訂正、0-5 の棚卸しの後、.env の拡張）
- docs/04 の2節（台帳の表。.env は `weixu.wx-vsce-dotenv` だけ）、6.1（既定の設定。通信を止める4件と、Claude Code の CLI に渡す環境変数を足した）
- `records/phase0/network-inventory.md`、`records/phase0/claude-code-manifest.md`
- 検証（1）の軽微な指摘: `tasks/2026-11-13-p1-verify-smoke-prepare/handoff-notes.md` の「蒙恬への軽微な指摘」

## やること

1. 台帳から `dotenv.dotenv-vscode` を外す。`weixu.wx-vsce-dotenv` の `note` を、決まったことに合わせる。台帳を読む台本（`lock-fetch.mjs`・`lock-verify.mjs` など）が、件数（8件になる）で困らないか確かめる。
2. `mydist` の `extensions.allowed` から `dotenv.dotenv-vscode` を外す（入っていれば）。
3. `mydist` の `configurationDefaults` に、docs/04 の6.1 の通信を止める4件を足す（`typescript.disableAutomaticTypeAcquisition`、`npm.fetchOnlinePackageInfo`、`json.schemaDownload.enable`、`workbench.settings.enableNaturalLanguageSearch`）。
4. Claude Code の CLI に `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を渡す設定を調べて入れる。
   - Claude Code 2.1.322 の manifest の `configuration` から、拡張が CLI に環境変数を渡す設定の名前と形を探す。拡張の JS の中身は読まない（裁定）。
   - Claude Code の公式の文書で、この環境変数が何を止めるかを確かめる。出典と取得日を付ける。
   - 設定があれば `mydist` の既定に入れる。無ければ、代わりの方法の事実をまとめて報告する（入れない）。
5. 検証（1）の軽微な2点を直す。
   - `check-env.ps1`: パスが実在するときだけ、Visual Studio の検査を通す。
   - `prepare.mjs`: `upstream.json` に `commit` が無いときは止める。

## 守ること

- 書き込みは自分の書き込み先だけ。`records/` と docs/ には書かない（docs の直しが要れば doc-corrections.md に書く）。
- `tests/` のスモークの台本に触れない（`dotenv` の既定の切り替えが要れば、報告に書く。曹参に回す）。
- 大岡越前守が並行して `C:\b\smoke\` でスモークを走らせている。そこには触れない。`C:\b\wt\1.146.0` で依存の導入やビルドを走らせない（ユーザーの道具の導入を待っている）。

## 完了条件

- 1〜5 が済み、`node --check` と、関係する単体テスト（`node tests/lock.test.mjs` など）が通る。4 には出典がある。

## 成果物

このディレクトリに保存する。

- `changes.md`: 変えた点と確かめた結果。
- `doc-corrections.md`: 資料との食い違い（あれば）。
- `handoff-notes.md`: 報告。

## 結果

採用。台帳を8件に（.env は weixu.wx-vsce-dotenv）、mydist の既定を裁定に合わせた（通信を止める4件、`claudeCode.environmentVariables`、application スコープの6件は外す）。application スコープの既定は案B-2（product.json と小さなパッチ）に決めた。検証（3）で合格。

## 未解決

なし

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

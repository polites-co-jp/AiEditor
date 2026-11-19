# 改名（Shuko → Sukuna）の検証

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-18
- 状態: 完了

## 目的

蒙恬の実装の改名（`tasks/2026-11-18-rename-sukuna-impl/`）と曹参のテスト（`tasks/2026-11-18-rename-sukuna-tests/`）、リーダーの資料の改名（docs/ と CLAUDE.md）を確かめ、改名をコミットしてよいかの合否を出す。本体の作り直し（r7）と関門は、この合格の後に別に依頼する。

## 入力

- 裁定: `docs/user-decisions.md` の末尾の 2026-11-18 の4つ（エディタの名前・改名の進め方・改名の権限）
- 案: `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md`、`permission-requests.md` の1.5（移行の台本の守り1〜7）
- 引き継ぎ: `tasks/2026-11-18-rename-sukuna-impl/handoff-notes-meng-tian.md`、`tasks/2026-11-18-rename-sukuna-tests/handoff-notes-cao-shen.md`
- 作業ツリーの差分（`git status`・`git diff`）。蒙恬の手元の作業ツリー `tmp\b\wt\rn`（作り直したパッチを当てた状態）

## 完了条件

- 差分のレビュー: 名前の置き換えが `rename-plan.md` の2節の表どおりで、インストーラー用の GUID 4つが変わっていない。名前のほかに振る舞いの変わる差分が無い（あれば挙げる。`start-menu-shortcut.ps1` の作りの変更は意図どおりかを見る）。
- パッチの作り直し: 蒙恬の照らし（`patch-regen-check.json`）を読み、置き換えの前後で `+`・`-` の行の中身が名前のほかに変わっていないことを確かめる。作り直したパッチが当たる（`apply.mjs` の結果）。
- 移行の台本 `scripts/migrate/migrate-from-shuko.ps1` の読み: 守り1〜7を満たす（バイトのまま写す、復号しない、出力に中身もハッシュも出さない、元の場所に書かない・消さない、書く先に中身があれば止まる、動いていれば止まる、`-SandboxRoot` の範囲の照らし）。本番の場所では打たない（`-List` も）。
- テストの実行: 全部の run-all（c*-mutation など長いものを含む。時間が長すぎるものは理由と共に分けて記録する）。落ちたものは原因を分ける。`rename-leftovers` の2件（古い束のファイル名＝コミットで消す、`.claude/agents/vlad-tepes.md`＝Team の開発部に依頼済み）は既知として扱う。
- 曹参の作者の照らしの分け方（`tests/build/commit-author.mjs`。記録の `startedAt` で新旧を分ける）が、今ある記録と新しい記録の両方で正しく働くかを見る。
- 名前の残り: 追跡しているファイルのうち、除く場所の外に `shuko` が残っていない。
- コミットに入れないファイル（手元の道具）の一覧と、入れるファイルの一覧を分けて書く（蒙恬の引き継ぎ・曹参の報告の「コミットしない」ものを含む）。

## 成果物

このディレクトリに保存する。

- `verification-rename-sukuna.md`: 各条件の合否、根拠、落ちたテストの原因の分け方、コミットに入れる・入れないファイルの一覧、指摘
- テストの実行の記録（run-all の結果の JSON など）

## 結果

初回は不合格（曹参のテストの2点）。差し戻しの後の再検証で合格（2026-11-19）。run-all 3,073件、落ちは既知の2件（古い束のファイル名＝このコミットで削除、`vlad-tepes.md`＝Team の開発部）。

## 未解決

c1-unit が過去の記録 `tasks/2026-11-16-p5-c1-product-keys/patch-shape-detail.txt` を毎回書き直す（指摘4）。次に曹参が c1 に触れるときに直す。リポジトリの直下にできた `Microsoft/`（PowerShell の控え）はコミットしない。

## 次の担当

合格ならリーダーがコミットし、本体の作り直し（`1.146.0-p5-c-all-r7`）を蒙恬に、関門を大岡越前守に依頼する。

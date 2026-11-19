# 改名（Shuko → Sukuna）の実装

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-18
- 状態: 完了

## 目的

エディタの名前を少名毘古那（Sukuna）に変える（2026-11-18 の裁定「エディタの名前」「改名の進め方」「改名の権限」。`docs/user-decisions.md` の末尾）。実装に残る仮の名前 Shuko を、`rename-plan.md` の案どおり Sukuna に変え、移行の台本を新しく作る。テストは曹参が同じ案から並行して書く（`tasks/2026-11-18-rename-sukuna-tests/`）。

## 入力

- `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md`（2節の識別子の表、3節の移行、4節の 2a の内訳、5節の入口、6.1 の答え）
- `tasks/2026-11-18-rename-sukuna-survey/permission-requests.md`（1.5 の移行の台本の行の形と守り）
- `docs/user-decisions.md` の 2026-11-18 の裁定（エディタの名前・改名の進め方・改名の権限）

## 完了条件

- `rename-plan.md` の 4節の 2a の1〜5を行った。
  1. `product.overlay.json` の名前のキーと独自キー、`scripts/`・`tools/watch/` の場所の値・ID・UA・作者・関数の名前、`extensions-src/` の publisher と `displayName`、`TAKE-IN.md`・`package.json`・`assets/README.md`。インストーラー用の GUID 4つは変えない。
  2. 全部の `removals/*/edits.patch` と `patches/*.patch` の作者・注釈・件名・独自キーを同じ規則で置き換え、当て直して `format-patch` で作り直した。置き換えの前後の差が名前と `index` の行だけであることを照らした記録がある。
  3. notion-sync と日本語パックを作り直した（`dist/` の中の ID が `sukuna.*` になった）。
  4. 移行の台本 `scripts/migrate/migrate-from-shuko.ps1` を作った（`-List`・`-Apply`・`-SandboxRoot`。permission-requests.md の1.5の「秘密の中身を読まないための守り」1〜7を満たす。元の場所に書かない・消さない）。
  5. `start-menu-shortcut.ps1` の実行ファイルとショートカットの名前を、版の `product.json` の `nameShort` から求める形にした。
- 追跡しているファイルに `shuko`（大文字小文字を問わない）が残るのは、`tasks/`・`records/`・`docs/`（資料はリーダーが直す）・`team/`（権限とフックは Team の開発部）・移行の台本の中の旧の場所だけである。残りの一覧を引き継ぎに書く。
- 今ある自分の検査（型検査・`node --check` など打てるもの）が通る。
- 移行の台本は**本番の場所で打たない**（`-List` も含む。権限の段1が入ってから、リーダーの指示で打つ）。ビルドもまだしない（検証の後に別に依頼する）。
- 曹参が試すための入口（関数名・引数・出力の形）を引き継ぎの文書に確定させた。

## 成果物

このディレクトリに保存する。

- `handoff-notes-meng-tian.md`: 変えたファイルの一覧、パッチの作り直しの照らしの結果、移行の台本の使い方と出力の形、テストの入口、残った `shuko` の一覧、気づいた点
- コードの変更は作業ツリーに置く（コミットはリーダー）

## 結果

完了（2026-11-19、大岡越前守の検証に合格）。名前の置き換え 66 ファイル・412 か所、パッチ15本の作り直し（中身の行は名前のほかに変わらない。`patch-regen-check.json`）、移行の台本 `scripts/migrate/migrate-from-shuko.ps1`、`start-menu-shortcut.ps1` の名前を版から求める作り。改名の前の今の値の控え（`rename-plan.md` の3.3の手順1）はリーダーが行った: `%LOCALAPPDATA%\Shuko\local.json` は既定の値のまま（`installRoot` `%LOCALAPPDATA%\Programs\Shuko`、`keepVersions` 3、`builderRepo` このリポジトリ、`buildRoot` `tmp`）。`history.txt` は 2026-11-16 の `1.146.0-1` の1行だけ。

## 未解決

移行の台本の本番は権限の段1（1.1・1.5）が入ってから。`scripts/move-survey.mjs` の説明の文が改名の後と合わない（使っていない道具。直さない）。手元の道具（`scripts/trial-*`）はコミットしない。

## 次の担当

大岡越前守の検証（曹参のテストと合わせて）。その後に本体の作り直し（`1.146.0-p5-c-all-r7`）と関門。

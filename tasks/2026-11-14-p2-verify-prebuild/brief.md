# Phase 2 の検証（ビルドの前の分）: 適用の台本・段階 A と B の単位・上書きとパッチ・ビルドと切り替えの台本・テスト

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

ビルドの道具がそろう前に作れる Phase 2 の成果を、まとめて確かめて合否を出す。単位を有効にする関門（docs/03 の7節）は、型検査とビルドが要るので、この検証の対象外にする（道具がそろってから単位ごとに行う）。

## 入力

- 蒙恬:
  - `tasks/2026-11-13-p2-apply/`（apply-design.md、handoff-notes.md と追記1〜4）。対象は `scripts/apply.mjs`・`scripts/lib/apply/`
  - `tasks/2026-11-13-p2-units-a/`。対象は `removals/A-*`・`builtin/keep.json`
  - `tasks/2026-11-13-p2-units-b/`。対象は `removals/B-*`・`product.overlay.json`・`patches/`・`assets/`・`scripts/make-icons.mjs`・mydist の変更
  - `tasks/2026-11-13-p2-build-switch/`。対象は `scripts/build.mjs`・`install-extensions.mjs`・`configure.ps1`・`switch.ps1`・`scripts/lib/local-config.*`
- 曹参: `tasks/2026-11-13-p2-tests/`、`tasks/2026-11-14-p2-tests-build/`、`tests/` の新しいテスト、`tests/run-all.mjs`
- 前回の検証で残したもの: スモークの `.keep` の入口（`tests/smoke-stop.mjs --mark-keep`。`tasks/2026-11-13-p1-smoke/handoff-notes.md` の最後の追記）
- docs/02（2〜4節、6節、6.1、8節）、docs/03（2〜6節、9節。今日の変更を含む）、docs/04 の5節・6.1、docs/user-decisions.md の 2026-11-13〜14 の節

## やること

1. レビュー（コードは直さない）。
   - `apply.mjs` が docs/03 の5〜6節のとおりか（順序、2つのコミット、removeLines の規則、検査、mydist の既定を外す規則、コミットの名前）。
   - 単位が docs/03 の3節の形で、Claude Code が使う受け手（9節）を消していないか。消す範囲が裁定（docs/user-decisions.md）と表の変更の記録に合うか。
   - overlay の `shukoConfigurationDefaults` と台帳が合うか。パッチ 20・30 の中身。
   - ビルドと切り替えの台本が、普段使いのデータ・実際の `local.json`・スタートメニュー・PATH に触れない作りか。
2. 実行。
   - `node tests/run-all.mjs` で全部のテストを走らせ、件数を記録する。蒙恬が2点（`setArgvLocale` の文字列でない値、`-KeepVersions 0`）を直した後に走らせる。
   - タグ 1.146.0 から新しい作業ツリー（例 `C:\b\wt\verify-p2`）を作り、`node scripts/apply.mjs <作業ツリー> --label verify-p2 --only <A-1〜A-7・B-1〜B-7> --prev-tag 1.145.3` で当て、`result: ok` と各検査を確かめる。
   - `node scripts/build.mjs 1.146.0 --dry-run` の出力を見る。
3. 前回の小さな直し（スモークの `--mark-keep`）を確かめる。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ（作業ツリーは `C:\b\wt\verify-p2` を作ってよい）。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない（道具の導入待ち）。
- 普段使いのデータ、ユーザーの実際の `local.json`、スタートメニュー、PATH に触れない。

## 完了条件

- 1〜3 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

合格（2回目）。verify-p2 に A＋B を当てて result: ok。run-all fail 0。

## 未解決

なし

## 次の担当

合格なら、リーダーがコミットする。ビルドの道具がそろったら、単位ごとに関門を通す。

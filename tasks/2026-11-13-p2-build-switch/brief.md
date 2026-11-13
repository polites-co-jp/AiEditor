# Phase 2: build.mjs、install-extensions.mjs、local.json と configure.ps1、switch.ps1

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。ビルドの一連と、配布・切り替え・拡張の導入の台本を作る（docs/07 の5節の1）。

## 入力

- docs/02 の4節（ビルドの流れ。今日までの事実: pnpm 12.16.0、型検査は `typecheck-client`、zip は System32 の tar.exe）、6節（版ごとのフォルダと切り替え）、6.1（`local.json` と共通の部品、`configure.ps1`）、7節（記録 `records/builds/<label>.json`）
- docs/04 の5節（`install-extensions.mjs`。台帳の拡張の導入、`argv.json` の `locale`、末尾は `\n}`）
- `tasks/2026-11-13-p1-build-upstream/`（build-log.md、doc-corrections.md）、既にある `scripts/prepare.mjs`・`scripts/check-env.ps1`
- 起動の注意（docs/07 の3.2 の1）: 普段使いのデータに触れない。試しは `VSCODE_PORTABLE` で置き場所を分ける

## やること

1. `scripts/lib/local-config.mjs` と `scripts/lib/local-config.ps1`（`%LOCALAPPDATA%\Shuko\local.json` を読む。`buildRoot`・`installRoot` など、docs/02 の6.1）と `scripts/configure.ps1`。
2. `scripts/build.mjs <tag>`: docs/02 の4節の1〜8 を順に行い、止まった場所を `records/builds/<label>.json` に書く。作業ツリーの用意は `prepare.mjs`、適用は `scripts/apply.mjs`（別の蒙恬が並行して作る。その入口を呼ぶだけにする）。依存の導入・型検査・パッケージ化・後処理（消した拡張が残っていない、keep.json の拡張がそろう、`resources\app` の置き場所を決めつけない）・zip。
3. `scripts/install-extensions.mjs`: 台帳の拡張を、検証済みの VSIX（キャッシュ `C:\b\cache\vsix\`）から、指定の版の CLI で入れる。`argv.json` に `locale` を書く。
4. `scripts/switch.ps1`: 版ごとのフォルダ、`current` のジャンクション、`-Previous` で戻す、`engines` の確かめ（docs/02 の6節、docs/04 の5節）。
5. ビルドはまだ走らせられない（道具の導入待ち）。走らせられる範囲（引数の解釈、`local.json`、記録の形、`--dry-run`）で試し、`switch.ps1` と `install-extensions.mjs` は公式の zip（`C:\b\p0\vscode-1.146.0\`）の写しと試しの `installRoot`（`C:\b\trial-install\` など）で確かめる。

## 守ること

- 書き込みは `scripts/build.mjs`・`scripts/install-extensions.mjs`・`scripts/configure.ps1`・`scripts/switch.ps1`・`scripts/lib/local-config.*`・`tasks/`・`C:\b\` だけ。ほかの蒙恬が並行して `scripts/apply.mjs`・`scripts/lib/apply/`（p2-apply）、`removals/`・`builtin/`・`patches/`・`product.overlay.json`・`assets/`（p2-units-a・b）を作る。それらを書かない。
- 普段使いのエディタのデータと、ユーザーの実際の `%LOCALAPPDATA%\Shuko\local.json`（あれば）を書き換えない。試しは別の場所を引数で渡す。
- スタートメニューや PATH への登録は試しで行わない（手順書に回す）。

## 完了条件

- 1〜4 の台本があり、`node --check` が通る。5 の試しの記録がある。

## 成果物

このディレクトリに保存する。

- `build-switch-design.md`: 引数、関数の名前と入出力（テストの入口）、記録の形。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

採用。`build.mjs`・`install-extensions.mjs`・`configure.ps1`・`switch.ps1`（`-ExpandOnly` を含む）・`local-config.*`。検証で合格。ビルドの一連の実行は道具の導入の後。

## 未解決

- ビルドの一連（install・typecheck・package）の実行。

## 次の担当

ooka-echizen（大岡越前守）: 検証する。

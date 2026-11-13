# Phase 2: ビルドと切り替えの台本・アイコンの台本の単体テストと、テスト全体の走らせ直し

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

Phase 2 の成果をまとめて大岡越前守の検証に回す前に、まだテストの無い台本のテストを、同じ仕様から書く。

## 入力

- 蒙恬の設計の書き物と「テストの入口」:
  - `tasks/2026-11-13-p2-build-switch/build-switch-design.md`・`handoff-notes.md`（`local-config.mjs`/`.ps1`、`build.mjs`、`install-extensions.mjs`、`switch.ps1`、`configure.ps1`）
  - `tasks/2026-11-13-p2-units-b/handoff-notes.md` の追記（`scripts/make-icons.mjs`、`patches/30-proxy-direct-without-settings.patch`）
  - `tasks/2026-11-13-p2-apply/handoff-notes.md` の追記2〜4（removeLines の最終行、`--until`、registeredKeys、mydist の既定を外す）
- docs/02 の4節・6節・6.1・8節、docs/04 の5節
- 既存のテスト: `tests/apply*.test.mjs`、`tests/removals.test.mjs`、`tests/lock.test.mjs` ほか

## やること

1. 次のテストを書く。
   - `local-config.mjs` と `local-config.ps1` の規則。同じ入力に同じ合否を出すことを照らす。
   - `build.mjs` の純粋な関数（`nextLabel`・`selectSteps`・`zipFolderName`・`checkBuiltinExtensions`・`findAppDir` など）と、`--dry-run` の出力の形。
   - `install-extensions.mjs` の `setArgvLocale`（結果が `\n}` で終わる。コメント・末尾の `,`・空）、`orderForInstall` など。
   - `switch.ps1`・`configure.ps1` を、試しの場所（`-ConfigPath`）で引数つきで走らせ、標準出力の JSON と終了コードを見る。普段使いの場所は使わない。
   - `make-icons.mjs` の export（`crc32`、`encodePng`、`encodeIco`、`renderIcon`、`makeIconFiles` の決まった出力）。
2. 既存の apply のテスト（とくに `lines: 最後の行（改行なし）`）を走らせ直し、通ることを確かめる。
3. `tests/*.test.mjs` と `tests/*.tests.ps1` を全部走らせ、件数をまとめる。

## 守ること

- 書き込みは `tests/`・`tasks/`・試しの場所（`C:\b\` の下の新しいフォルダ）だけ。`scripts/` などは書かない（直しが要れば報告する）。
- 普段使いのエディタのデータ、ユーザーの実際の `%LOCALAPPDATA%\Shuko\local.json`、スタートメニュー、PATH に触れない。
- 別の蒙恬が並行して `scripts/apply.mjs` と `scripts/lib/apply/` を直している（mydist の既定を外す件）。その直しの後に、apply のテストをもう一度走らせる。

## 完了条件

- 1 のテストがあり、2・3 の走らせた結果がある。仕様と実装の食い違いは、決めずに報告にある。

## 成果物

このディレクトリに保存する。

- `tests-build-design.md`: テストの一覧と仕様の出どころ。
- `handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: Phase 2 の成果をまとめて検証する。

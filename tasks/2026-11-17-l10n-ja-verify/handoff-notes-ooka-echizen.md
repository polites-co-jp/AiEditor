# 引き継ぎ（大岡越前守 → リーダー・蒙恬・曹参）: 日本語パックの検証（ビルドの前）

判定と根拠は [verification-l10n-ja.md](verification-l10n-ja.md) にある。ここには、走らせたコマンドと残した記録の場所を書く。作業の場所はすべてリポジトリの直下。`tmp/b` の下には何も書いていない。

## 走らせたコマンド

| # | コマンド | 結果 |
|---|---|---|
| 1 | `node tests/l10n-audit.mjs --app tmp/b/p2/1.146.0-p5-c-all-r4/Shuko-win32-x64-1.146.0-p5-c-all-r4/resources/app --pack extensions-src/language-pack-ja/dist/translations --exclude extensions-src/language-pack-ja/exclusions.json --out tasks/2026-11-17-l10n-ja-verify/audit-new-pack-r4.json --strict` | 本体 12,355 / 訳あり 12,350 / 除外 5 / 除外の外 0。拡張 1,258 / 未訳 0。合格 |
| 2 | `sha256sum tmp/b/cache/l10n/vl-e0407b9e2508/LICENSE.md …/package.json …/translations/main.i18n.json …/translations/extensions/*.json` | 97ファイルすべてが `sources.json` と一致 |
| 3 | `sha256sum tmp/b/cache/l10n/vl-62d5443b5670/translations/main.i18n.json …/LICENSE.md tmp/b/cache/l10n/vsix-fae5a90170d4/MS-CEINTL.vscode-language-pack-ja-1.131.0.vsix` | 3つとも一致 |
| 4 | `git diff -- scripts/apply.mjs scripts/build.mjs scripts/lib/apply/classify.mjs builtin/keep.json extensions.lock.json product.overlay.json scripts/install-extensions.mjs extensions-src/mydist/package.json extensions-src/notion-sync/package.json` | 差分を読んだ（verification の4節） |
| 5 | `git ls-files --others --exclude-standard -- extensions-src/language-pack-ja scripts/l10n-ja.mjs scripts/lib/l10n-ja.mjs tests/l10n-audit.mjs tests/l10n-audit.test.mjs tests/probe-l10n.mjs scripts/l10n-probe.mjs` | 新しいファイルの一覧。`dist/translations` は .gitignore で外れていない |
| 6 | `node --test tests/l10n-audit.test.mjs` | 14件が通る |
| 7 | `node --test tests/install-ext.test.mjs` | 46件が通る |
| 8 | `node --test tests/builtin-l10n.test.mjs tests/cli-run.test.mjs tests/build-env-branch.test.mjs` | 62件が通る |
| 9 | `node --test tests/removals.test.mjs` | 229件が通る |
| 10 | `node --test tests/build-parts.test.mjs` | 38件が通る |
| 11 | `node --test tests/apply-parts.test.mjs` | 57件が通る |
| 12 | `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs` | 138件が通る |
| 13 | `node --test tests/watch.test.mjs` | 104件が通る |
| 14 | `node --test tests/apply.test.mjs` | 33件が通る |
| 15 | `node --test tests/apply-cli.test.mjs` | 5件が通り、2件は飛ぶ（試しの作業ツリーが無い） |
| 16 | `node --test tests/lock.test.mjs` | 115件が通る |

このほかに、Read と Grep で次のファイルを読んだ。

- `added/1.146.0.json`（全部）
- `exclusions.json`
- `sources.json`
- パックの `package.json`
- `ThirdPartyNotices.txt`
- `dist/translations` の main.i18n.json と拡張の束（抜き取り）
- キャッシュの main.i18n.json と LICENSE.md
- r4 の `nls.keys.json`（モジュールの有無）
- 作業ツリー `tmp/b/wt/r4/extensions/{markdown-language-features,git}/src` の `l10n.t` の文言（抜き取り）

## 走らせられなかったもの（許可の外）

- `node scripts/l10n-ja.mjs count`・`extract`・`build`・`fetch`: Bash の許可に無い。そのため、bundle の全数と `dist` の作り直しの一致は確かめていない。訳の元の取り直しもしていない。
- 一時の台本を書いて走らせること: 書ける場所（`records/`・`tasks/`）の台本は、`node tests/*.mjs` の形に当たらない。
- 長い出力のファイル（`~/.claude/.../tool-results/`）: `read_paths` の外で読めない。長い出力が出る試験は、ファイルを1つずつ走らせた。

ビルドの後に同じ確かめをするには、次のどちらかが要る（verification の L2）。

- `node scripts/l10n-ja.mjs extract --app <出力>\resources\app --worktree <作業ツリー> --out tmp\l10n\strings-<label>.json` と `node scripts/l10n-ja.mjs count --strings … --pack <出力>\resources\app\extensions\language-pack-ja` を、私の許可に足す。
- 蒙恬がこの2つを走らせ、出力を tasks に置く。

網は、`node tests/l10n-audit.mjs --app <出力>\resources\app --pack <出力>\resources\app\extensions\language-pack-ja\dist\translations --exclude extensions-src/language-pack-ja/exclusions.json --strict` で、今の許可のまま走らせられる。

## 残した記録

- `tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md`: 項目ごとの合否、判定、直すべき点と担当
- `tasks/2026-11-17-l10n-ja-verify/audit-new-pack-r4.json`: 網の出力（コマンド 1）
- `records/` には何も足していない（計測とビルドをしていないため）

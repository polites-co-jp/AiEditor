# 日本語パックとアイコンのテストを足す（検証の指摘）

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-17
- 状態: 依頼中

## 目的

日本語パックの検証（`tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md`。大岡越前守）で「足りないテスト」に挙がった項目を足し、網（`tests/l10n-audit.mjs`）を広げる。新しい版の関門で大岡越前守がこの網を使う。並行して蒙恬がアイコン（候補 A に決まった）を仕上げ、新しい版をビルドしている（`tasks/2026-11-17-icon-ja-build/`）。

## 入力

- `docs/user-decisions.md` の 2026-11-17 の節、`docs/04-bundled-extensions.md` の7節
- `tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md` の「C（曹参）」と L2
- `tasks/2026-11-17-l10n-ja/l10n-design.md`・`handoff-notes-meng-tian.md`（4節がテストの入口）
- `tasks/2026-11-17-icon/handoff-notes-meng-tian.md`（5節がテストの候補）

## やること

1. 網を広げる（L2 の代わり。大岡越前守の許可を足さずに、bundle も独立に数えるため）:
   - 組み込み拡張の bundle（`vscode.l10n.t`。拡張の `l10n/bundle.l10n.json` などの英語の束と、パックの `contents.bundle`）と、自前の拡張の直書きも数える。数え方は本家と同じ引き方で、蒙恬の `count` に頼らない
   - 除外の `en` を今の英語と比べる（英語が変わったら除外を効かせない）
   - `--pack` に拡張のルートを渡したとき、`package.json` の `contributes.localizations` の translations で引く（本体が実際に引く対応を確かめる）
   - `--pack` の既定を、古い 1.131.0 から `extensions-src/language-pack-ja/` に改める
   - 英語と同じ訳（`sameAsEnglish`）と英字だけの文言の鍵の一覧を出す
   - 新しいパックで `pass: true` になることを、実物のテストに足す
2. 単体テストを足す: `scripts/lib/l10n-ja.mjs` の純粋な部品（`coreFromNls`・`manifestLiterals`・`buildPack`・`coverage`・`exclusionTree`・`validateExclusions`・`validateAdded`・`placeholderMismatch`・`hasJapanese`）、`apply.mjs` の `languagePackMissingFiles`、`install-extensions.mjs` の `retiredNotes`。classify の自前の拡張の確かめに `language-pack-ja` を含める。リポジトリの整合（`dist/translations` のファイルがそろう、`sources.json` の形）
3. 蒙恬が直す M1（パックが無いと apply が止まる）・M2（印の照らしを強める）にもテストを足す。入口は蒙恬の引き継ぎ（`tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md`）を読んで合わせる
4. アイコン: A が既定になった後、`node --test tests/make-icons.test.mjs` が通ることを確かめる（「`assets/` の下が台本の出力と同じ」の検査を含む）

## 決まり

- テストの作業場所は `tmp/tests/` の下。`tmp/b` の下に書かない。
- コードの本体は直さない。直すべき所は引き継ぎに書く。

## 完了条件

- 上のテストと網の改めがあり、通る（蒙恬の直しの前に落ちるものは、どれが何を待っているかを書く）
- 今の日常の版（r4）の文言と新しいパックで、網（bundle を含む）が除外の外の未訳 0 を出す

## 成果物

このディレクトリに保存する。

- `handoff-notes-cao-shen.md`: 足した・直したテストと網、走らせ方、結果、蒙恬の実装と食い違った所
- 網の出力（JSON）

## 結果

（リーダーが記入）

## 未解決

（リーダーが記入）

## 次の担当

大岡越前守（関門）

# アイコンのテストの直しと、日本語の未訳を数える網

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-17
- 状態: 完了

## 目的

裁定（2026-11-17。`docs/user-decisions.md` の末尾）の2つについて、作る側（蒙恬）と同じ仕様からテストを並行して作る。

- アイコン: Claude と VS Code のアイコンを合わせた意匠にする（蒙恬の依頼 `tasks/2026-11-17-icon/brief.md`）
- 日本語化: 未訳を残さない（`docs/04-bundled-extensions.md` の7節。蒙恬の依頼 `tasks/2026-11-17-l10n-ja/brief.md`）

## 入力

- 上の2つの依頼書と、蒙恬の引き継ぎ（`tasks/2026-11-17-icon/handoff-notes-meng-tian.md`・`tasks/2026-11-17-l10n-ja/handoff-notes-meng-tian.md`。できしだい読む）
- `tests/make-icons.test.mjs`、`assets/README.md`、`scripts/make-icons.mjs`
- 日本語の仕組みは本家の 1.146.0 のソース（`tmp/b/vscode` の clone。探すときは `path` を絞る）: 言語パックの読み方（`src/vs/base/node/nls.ts`、`src/vs/platform/languagePacks/`、`build/lib/i18n.ts` など）
- 今の日常の版: `%LOCALAPPDATA%\Programs\Shuko\versions\1.146.0-1\resources\app\`（`out/nls.keys.json`・`nls.messages.json`・`nls.metadata.json`、`extensions/*/package.nls.json`・`l10n/`）
- 今の日本語パック: `%USERPROFILE%\.shuko\extensions\ms-ceintl.vscode-language-pack-ja-1.131.0\`（`translations/main.i18n.json`・`translations/extensions/*.i18n.json`）

## やること

1. アイコン: `tests/make-icons.test.mjs` を新しい意匠に合わせる。書式（PNG・ICO）と決定性の検査は保つ。今の意匠に固有の検査（`>_`・`#2E6DA4` など）は、どの候補でも成り立つ検査に替える（例: 256 px の出力に VS Code の青の系統の画素と Claude の橙 `#D97757` の系統の画素が両方ある、7つの大きさがそろう、SVG がよく形づくられ両方の要素を持つ）。候補の選び方の引数は、蒙恬の引き継ぎに合わせる。
2. 日本語の網: 蒙恬の作り方に頼らない、独立の数え方の台本とそのテストを作る。
   - 入力: ビルドの文言の一覧（`out/` の nls のファイル）と組み込み拡張のフォルダ、言語パックのフォルダ（`translations/`）、除外の一覧（任意）
   - 出力: 本体と組み込み拡張ごとの、文言の総数・訳がある数・未訳の数と未訳の鍵の一覧（JSON）。本家と同じ引き方（モジュールと鍵で引く）で数える
   - 確かめ: 今の日常の版と 1.131.0 のパックで走らせ、本体の未訳がリーダーの数え（12,355 件のうち約 650 件が英語のまま。clp の `nls.messages.json` を英字の並びで粗く数えた値）と大きく食い違わないこと。食い違えば理由を書く
   - 蒙恬のパックができたら、それでも走らせて結果を書く（大岡越前守の検証でもこの台本を使う）

## 決まり

- テストの作業場所は `tmp/tests/` の下。`tmp/b` の下に書かない。
- コードの本体（`scripts/` など）は直さない。直すべき所は引き継ぎに書く。

## 完了条件

- `node --test tests/make-icons.test.mjs` が蒙恬の候補づくりの出力で通るか、落ちるなら理由（実装の誤りか、テストの前提か）を書いている
- 日本語の網の台本とテストがあり、テストが通る。今の版と 1.131.0 のパックでの結果がある

## 成果物

このディレクトリに保存する。

- `l10n-audit-current.json`: 今の版と 1.131.0 のパックでの網の結果
- `handoff-notes-cao-shen.md`: 作った・直したテストと台本、走らせ方、結果、蒙恬の実装と食い違った所

## 結果

- 独立の網 `tests/l10n-audit.mjs` とテスト（14件が通る）。本家と同じ引き方で、本体 12,355 件の結果が clp の `nls.messages.json` と全件一致した。r4 と 1.131.0 のパックで未訳 742（本体 689、拡張の package 53）。
- `tests/make-icons.test.mjs` を候補に依らない検査に直した（`ICON_TEST_ARGS_LIST` で候補ごとに走る）。

## 未解決

- bundle と直書きを数えない、除外の `en` を比べない、など網の改めと、足りないテストは `tasks/2026-11-17-icon-ja-tests/` へ。
- 使い捨ての `tests/probe-l10n.mjs` と重複の `audit-run-pack1131.json` はコミットしない。
- 曹参が `%LOCALAPPDATA%`・`%USERPROFILE%` を Read できず、台本を通して読んだ件: 台本は件数と鍵だけを出し、`node tests/*.mjs` は許可の範囲なので、この形でよい（リーダー）。

## 次の担当

曹参（`tasks/2026-11-17-icon-ja-tests/`）

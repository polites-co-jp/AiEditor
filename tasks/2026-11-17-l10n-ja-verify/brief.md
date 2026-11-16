# 日本語パックの検証（ビルドの前）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-17
- 状態: 完了

## 目的

蒙恬が作った本体と同じ版の日本語パック（`tasks/2026-11-17-l10n-ja/`）と、曹参が作った独立の未訳の網（`tasks/2026-11-17-icon-l10n-tests/`）を確かめ、ビルドへ進めてよいかの合否を出す。ビルドはアイコンと同じ版で後に行う（この依頼の外）。

## 入力

- 裁定と判断: `docs/user-decisions.md` の 2026-11-17 の3つの節、`docs/04-bundled-extensions.md` の7節
- 蒙恬: `tasks/2026-11-17-l10n-ja/l10n-design.md`・`handoff-notes-meng-tian.md`
- 曹参: `tasks/2026-11-17-icon-l10n-tests/handoff-notes-cao-shen.md`、`tests/l10n-audit.mjs`・`tests/l10n-audit.test.mjs`

## 確かめること

1. 未訳: 曹参の網で、作ったパックが今の日常の版（`1.146.0-p5-c-all-r4`）の文言に対して「除外の外の未訳 0」になる（蒙恬の引き継ぎの4節のコマンド。`--strict`）。蒙恬の `count` の結果と食い違わない。網が数えない所（bundle・直書き）は蒙恬の `count` で見る
2. 訳の元: `sources.json` の commit とファイルごとの SHA-256 が、取り直した元と一致する（取り直せる許可の範囲で。できなければ理由を書く）
3. 足した訳（`added/1.146.0.json` の182件と上書きの9件）: 書式の印（`{0}`・`&&`・`$(icon)`・Markdown のリンクなど）が英語と同じに残っている。訳語が公式の訳の言い回しとそろっている（抜き取りでよい。件数と見た範囲を書く）。除外の5件の理由が成り立つ
4. 差分のレビュー: `scripts/apply.mjs`・`scripts/build.mjs`・`scripts/lib/apply/classify.mjs`・`builtin/keep.json`・`extensions.lock.json`・`product.overlay.json`・`scripts/install-extensions.mjs`・`extensions-src/mydist/package.json`・`extensions-src/notion-sync/package.json`、新しい `scripts/l10n-ja.mjs`・`scripts/lib/l10n-ja.mjs`・`extensions-src/language-pack-ja/`。台帳と `extensions.allowed` の照合が合っている。許可の外を消す処理が無い
5. テスト: `tests/l10n-audit.test.mjs`、蒙恬が挙げた関係する既存のテスト（install-ext・build-parts・apply-parts・removals・builtin-l10n・cli-run・build-env-branch・take-in・watch・apply など）が通る。ライセンスの表記（`ThirdPartyNotices.txt`）が vscode-loc の MIT を満たす
6. 足りないテスト: `scripts/lib/l10n-ja.mjs` の純粋な部品に単体テストが無いなら、曹参に足させるべき項目として挙げる

## 決まり

- コードは直さない。直すべき所は、誰に何を直させるかを書く。
- 作業場所は `tmp/tests/` などの許可の範囲。`tmp/b` の下に書かない。

## 完了条件

- 1〜5 の合否と根拠（走らせたコマンドと結果）がそろっている
- ビルドへ進めてよいかの判定と、進む前に直すべき点（担当つき）がある

## 成果物

このディレクトリに保存する。

- `verification-l10n-ja.md`: 確かめた項目ごとの合否と根拠、判定、直すべき点
- `handoff-notes-ooka-echizen.md`: 走らせたコマンド、残した記録の場所

## 結果

- 判定: 条件つきの合格（ビルドへ進めてよい）。未訳・訳の元・足した訳・差分・テスト（843件中841件が通り、2件は飛んだ）とライセンスは合格。足りないテストあり。
- 条件の L1（docs/04 の2節・5節・7節）はリーダーが直した。L2 は曹参が網を広げて bundle を独立に数える形にした（許可は足さない）。L3 はユーザーの裁定で Team に許可を依頼。L4 は probe をコミットしない。M1・M2 は蒙恬、C は曹参へ。M4（`p0-common.ps1`）は引退の道具なので直さない。

## 未解決

- ビルドの後に、新しい出力で網（`--strict`）と `count` を走らせ直す（関門）。

## 次の担当

蒙恬（直し・ビルド）、曹参（テストの追加）

# 版 1.146.0-p5-c-all-r6（アイコン A と日本語パック）の関門

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-17
- 状態: 完了

## 目的

裁定（2026-11-17）のアイコン（A「中央に印」）と日本語化（未訳を残さない）を入れた版 r6 が、日常の版 r4 と入れ替えてよいかの合否を出す。合格なら、許可が入りしだい課が入れ替える。

## 入力

- 裁定と判断: `docs/user-decisions.md` の 2026-11-17 の節すべて、`docs/04-bundled-extensions.md` の7節、`docs/06-update-watch-and-take-in.md` の4節（手順 5a）
- 蒙恬: `tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md`（r6 の節。r6-6 が関門に渡すこと）、同じフォルダの記録
- 曹参: `tasks/2026-11-17-icon-ja-tests/handoff-notes-cao-shen.md`、網 `tests/l10n-audit.mjs`
- 前の検証: `tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md`
- 前の版の関門の形: `records/take-in/1.146.0-p5-c-all-r4/`

## 確かめること

1. 版: zip の SHA-256（`a70b0a1c…5f09`）、版のフォルダ、作業ツリーの HEAD と記録の一致。r4 の木との差が、アイコン・日本語パック・displayName・`product.json`・`ThirdPartyNotices.txt` だけであること
2. 日本語: 網を r6 の出力に当て（`--require-bundle --strict`、除外は `exclusions.json` だけ）、除外の外の未訳 0。蒙恬の `count` の記録と食い違わない。上書き14件・足した訳184件の書式の印（抜き取りでなく、強めた照らしの結果と、自分での抜き取り）
3. アイコン: 出力の `code.ico`・PNG・SVG が `assets/` と同じ。exe に埋め込まれたアイコンが A であること（確かめられる範囲で。できなければ、何で代えたかを書く）
4. 壊れていない: スモーク（3回。基準は `baseline-p5-c-all-r3c.json`）で新しい誤りが無い。起動の確かめ。通信の監査で許した宛先の外への接続が無い
5. 差分のレビュー: 前のコミット（`git log` の最後のコードのコミット）から今の作業ツリーまでの、蒙恬と曹参のコードの変更すべて（`scripts/make-icons.mjs`・`copy-icon-sources.mjs`・`icon-src/`・`assets/`・`apply.mjs`・`build.mjs`・`classify.mjs`・`install-extensions.mjs`・`take-in.mjs`・`l10n-ja.mjs`・`lib/l10n-ja.mjs`・`extensions-src/`・`builtin/keep.json`・`extensions.lock.json`・`product.overlay.json`・`TAKE-IN.md`・`tests/` の新しいテストと直したテスト）。許可の外を消す処理が無い。コミットしてよいもの・いけないもの（`scripts/l10n-probe.mjs`・`tests/probe-l10n.mjs` と古い出力はコミットしない）を一覧にする
6. テスト: 関係するテストがすべて通る（走らせた数と結果）

## 決まり

- コードは直さない。直すべき所は担当つきで書く。記録は `records/take-in/1.146.0-p5-c-all-r6/` に残す。

## 完了条件

- 1〜6 の合否と根拠、版の判定（入れ替えてよいか）、コミットしてよいファイルの一覧がある
- 入れ替えの後にユーザーが画面で見る項目（日本語の表示、アイコン）を挙げている

## 成果物

- `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md` ほか関門の記録
- このディレクトリに `handoff-notes-ooka-echizen.md`（走らせたコマンド、記録の場所、コミットしてよいファイルの一覧）

## 結果

- 判定: 合格。r6 は日常の版 r4 と入れ替えてよい（古いパックを外す許可が入ってから、入れ替えの後に画面の確かめ）。
- 版の一致・未訳 0（曹参の網、`--strict`）・アイコン・起動・スモーク 49/0 を3回・通信の監査 600 秒を2回（宛先 0）・差分のレビュー・テスト 1,416 pass（落ち1件は環境の都合）。
- 記録は `records/take-in/1.146.0-p5-c-all-r6/`（`gate-p5-c-all-r6.md`、`manual-checks-p5-c-all-r6.md`）と、このフォルダ。

## 未解決

- 直すべき点 L1〜L3・T1 は `tasks/2026-11-17-r6-followups/`。T2 と D1 は入れ替えのとき。D2 は docs/04 の7節で直した。
- 全体の run-all（見張りあり）は報告の時点で終わっていない。結果は `run-all-r6.txt`。

## 次の担当

許可が入ったら蒙恬（入れ替え）

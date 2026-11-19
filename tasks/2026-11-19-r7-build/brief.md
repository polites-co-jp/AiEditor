# 改名の後の本体の作り直し（1.146.0-p5-c-all-r7）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-19
- 状態: 完了

## 目的

改名（Shuko → Sukuna。コミット `43be443`）を入れた本体を作り直し、移行に使う zip を作る（`tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の4節の順4）。関門は大岡越前守に別に依頼する。

## 入力

- `rename-plan.md` の4節（順4・順5）と 3.3（移行の日の順番）
- `docs/02-repository-and-build.md`（ビルドの手順、zip の作り方と SHA-256）
- 前の版 r6 の作り方の記録（`records/take-in/1.146.0-p5-c-all-r6/` など）

## 完了条件

- 今のコミットから、全部の削除の単位を当てた本体を作った。版のラベルは `1.146.0-p5-c-all-r7`。
- zip と SHA-256 がある。zip の中の実行ファイルは `Sukuna.exe`、CLI は `bin\sukuna.cmd`、`product.json` の名前のキーが `rename-plan.md` の2節の表どおりである（読んで確かめる）。
- 組み込み拡張（mydist・notion-sync・日本語パック）が、新しい ID（`sukuna.*`）で入っている。
- 版のフォルダへの展開（`switch.ps1`）と移行はまだしない（権限の段1の後に、リーダーの指示で行う）。
- 手順ごとの時間と、警告・失敗の有無を記録した。

## 成果物

このディレクトリに保存する。

- `build-notes-r7.md`: 打ったコマンド、時間、zip の場所と SHA-256、確かめた product.json の値、警告、関門で見てほしい点
- ビルドの記録（JSON など）

## 結果

完了（2026-11-19）。ビルド1回で ok（20分14秒）。zip `tmp\dist.146.0-p5-c-all-r7.zip`、SHA-256 `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`、版の commit `b76374c6`（枝 `builds/1.146.0-p5-c-all-r7`）。実行ファイルは `Sukuna.exe`、CLI は `bin\sukuna.cmd`、組み込み拡張は `sukuna.*` の3つ。product.json は `rename-plan.md` の2節どおり。zip の中に `shuko` は無い。起動の確かめと日本語の数え（未訳 0）は ok。合否は関門（`tasks/2026-11-19-r7-gate/`）で出す。

## 未解決

`tests/l10n-audit-more.test.mjs` の実物のテストが作業ツリーを `tmp\wt7` と決め打ちしている（実際は `tmp\wt7\w`）。関門では環境変数で渡す。テストの既定は、次に曹参が触れるときに直す。作業ツリー `tmp\wtn` は移行が済むまで残す。使い捨ての `scripts/trial-r7-verify.mjs` はコミットしない。

## 次の担当

大岡越前守の関門（適用後の検査、スモーク、外向き通信の監査、日本語の数え、起動の確かめ）。

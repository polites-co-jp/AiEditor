# 直し: 段階 A・B の単位の checks の見直し、合格した単位の有効化、notion-sync の翻訳の誤り

- 担当: meng-tian（蒙恬。B-1 を直している蒙恬とは別）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

Phase 2 の関門（`tasks/2026-11-14-p2-gates/handoff-notes.md`）で出た点を直す。リーダーの判断は `docs/user-decisions.md` の 2026-11-14「Phase 2 の関門で出た点」。

## やること

1. **合格した単位を有効にする**: A-3・A-6・B-5・B-6 の `unit.json` を `enabled: true` にする（関門の記録 `records/take-in/1.146.0-p2-<id>/gate-<id>.md`）。
2. **checks の見直し**（A-1・A-2・A-4・A-5・A-7・B-2・B-3・B-4・B-7。B-1 は別の蒙恬が直しているので触れない）:
   - `absentCommands` から、公式でも実行時に登録されないコマンド（関門の記録で「公式でも登録されない」とされたもの）を外し、公式で登録される（公式に `--expect present` が通る）ものに替える。替えられるものが無ければ、そのことを README に書く。
   - 曹参が並行して、manifest（`contributes.commands`）も見る網を足している（`tasks/2026-11-14-fix-absent-probe/`）。その網で見られるなら、起動しない拡張のコマンドを残してよい。曹参の handoff-notes に checks の形の変更が書かれたら、それに合わせる。
   - 公式で在ることの確かめには、検証役のスナップショット（`C:\b\smoke\absent\` の下）と、公式の zip（`C:\b\p0\vscode-1.146.0\`）の拡張の `package.json` を読んでよい。
3. **README を直す**: A-5（ポートのビューも消える。リモートは C-3 で消すので受け入れる）、B-4（残したパンくずリストが消えた設定 `outline.icons` を読む。既定で無効で、C-7 で消す）。
4. **notion-sync の翻訳の誤り**: 日本語の表示で、起動のたびに `[error] No bundle location found for extension shuko.notion-sync` が出る（組み込みの拡張に言語パックの翻訳が無いと出る）。`package.nls.json` や `l10n` の扱いなど、mydist も含めて、自前の組み込み拡張でこの誤りが出ない形にする。直したら `pnpm --dir extensions-src/notion-sync run build` と `--trial` が通ることを確かめる。

## 守ること

- 書き込みは `removals/`（B-1 を除く）・`extensions-src/`・`tasks/` だけ。`tests/` は曹参が書く。
- ビルドは走らせない（B-1 の蒙恬がビルドを使っている）。

## 完了条件

- 1〜4 が済み、変えた checks の一覧（単位・外したもの・足したもの・理由）が handoff-notes にある。

## 成果物

このディレクトリに `handoff-notes.md`。

## 結果

採用。A-3・A-6・B-5・B-6 を有効にした。checks は A-2・A-5・B-3 で足し・替え、A-1・A-4・A-7 は manifest の網だけで見ることを README に書いた。A-5・B-4 の README を裁定どおり直した。notion-sync の `No bundle location found` は、`contributes.localizations` の `ja` に自分の ID の空の束を出す形で直した（実機の確かめは次のビルド）。

## 未解決

- notion-sync の直しを実機で確かめる（次のビルドとスモーク）。
- テスト（`tasks/2026-11-14-tests-l10n-launch/`）。

## 次の担当

ooka-echizen（大岡越前守）: 関門の3の流し直し。

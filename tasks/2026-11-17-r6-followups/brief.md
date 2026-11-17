# 版 r6 の関門で出た小さな直し（L1〜L3、T1）

- 担当: meng-tian（蒙恬。L1〜L3）、cao-shen（曹参。T1）。検証は ooka-echizen（大岡越前守）
- 依頼日: 2026-11-17
- 状態: 依頼中

## 目的

r6 の関門（合格）で挙がった、次の取り込みの前に直す点を片づける。r6 の版の中身には効かないので、ビルドはしない。

## 入力

- 関門の記録: `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md`、`tasks/2026-11-17-r6-gate/handoff-notes-ooka-echizen.md`（直すべき点の表）
- 判断: `docs/user-decisions.md` の「記録（2026-11-17、版 r6 の関門。リーダーの判断）」
- 仕様: `docs/04-bundled-extensions.md` の7節（7. 数える）、`docs/06-update-watch-and-take-in.md` の4節（手順 5a）、`TAKE-IN.md`

## やること

### 蒙恬

- L1: `scripts/take-in.mjs` の `runL10nCount`。`count` が出力を書く前に落ちたとき、前の回の `l10n-count.json` の古い数を記録と warnings に写さない（走らせる前に古い出力を消すか、走らせた後の出力だけを読む）。
- L2: `summarizeL10nCount(終了コード, 出力なし)` は、終了コードが何であれ `failed` にする。
- L3: `extensions-src/language-pack-ja/README.md` の ThirdPartyNotices の行の説明を今の作り（下の層の出典も書く）に合わせる。

### 曹参

- T1: `tests/l10n-r6.test.mjs` の take-in の3件は、ソースの書き方を正規表現で照らすだけ。模擬の記録（`tmp/` の下の一時の場所）で `runL10nCount`・`summarizeL10nCount`（要れば `runCore`）を実際に走らせて振る舞いを見る形に替える。L1・L2 の直った振る舞い（古い出力を写さない、出力なしは `failed`）を確かめる件を入れる。蒙恬の直しより先に書いてよい（直す前は落ちることを確かめる）。

## 決まり

- 同じ仕様から並行して作る。互いの成果を待たない。
- ビルド・入れ替え・拡張の操作はしない。
- T2（`~/.shuko/extensions` に頼るテスト）はこの依頼に入れない（入れ替えの後に出す）。

## 完了条件

- L1〜L3 が直り、T1 のテストが通る。関係するテスト（`tests/l10n-*.test.mjs`、`tests/take-in*.test.mjs`）がすべて通る。
- 大岡越前守の検証に合格する。

## 成果物

- コードとテストの変更
- このディレクトリに `handoff-notes-meng-tian.md`、`handoff-notes-cao-shen.md`（変えた所、走らせたテストと結果）

## 結果

（リーダーが記入）

## 未解決

（リーダーが記入）

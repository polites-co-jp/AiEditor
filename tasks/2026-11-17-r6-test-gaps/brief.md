# 取り込みの日本語の数えのテストの網の穴（G1〜G3）

- 担当: cao-shen（曹参）。検証は ooka-echizen（大岡越前守）
- 依頼日: 2026-11-17
- 状態: 依頼中

## 目的

`tasks/2026-11-17-r6-followups/` の検証で挙がった、テストの網の穴を埋める。今の実装の一部を元に戻しても落ちない所を、落ちるようにする。

## 入力

- 検証の記録: `tasks/2026-11-17-r6-followups/verification-r6-followups.md`（「直すべき点」の G1〜G3）
- 作った人の記録: 同じフォルダの `handoff-notes-meng-tian.md`（5節。テストの入口）、`handoff-notes-cao-shen.md`
- 判断: `docs/user-decisions.md` の「記録（2026-11-17、r6 の直し（L1）で出た点）」
- 仕様: `TAKE-IN.md` の3節、`docs/06-update-watch-and-take-in.md` の4節（手順 5a）

## やること

- G1: count の前（版の形・パック・extract）で落ちたとき、前の回の `l10n-count.json` が残っていれば `staleOutput: true` が付くことを見る件。`withStale` を外すと落ちること。
- G2: 配線を見る件。次の3か所のどれを元に戻しても落ちること。
  - `judge` が `listMaterials` に `l10nMaterialSkip(ctx.rec.l10n)` を渡す所
  - `runCore` が `shouldCountL10n` に `prevL10n` を渡す所
  - 続きの回で前の回の `take-in.json` の `l10n` を `ctx.rec.l10n` に写す所
  - 振る舞いで見られない所（`runCore` を走らせるのに作業ツリー・ビルド・`claude` が要る）は、ソースの構造の確かめでよい。どの件が振る舞いで、どの件が構造かを記録に書く。
- G3: 案 b の件で `dir` と `repoRoot` に違うフォルダを渡し、照らす基準の取り違えを見分けられるようにする。

## 決まり

- コードは直さない。テストを書いた後、各件で、元に戻した実装（一時の写し）なら落ちることを確かめて記録する。一時の写しは消す。
- 一時の場所は `tmp/tests/` の下。`tmp/` の下を広く探さない。

## 完了条件

- G1〜G3 の件があり、関係するテスト（`tests/l10n-*.test.mjs`、`tests/take-in*.test.mjs`）がすべて通る。
- 大岡越前守の検証に合格する。

## 成果物

- `tests/l10n-r6.test.mjs`（または新しいテストのファイル）
- このディレクトリに `handoff-notes-cao-shen.md`（足した件、元に戻したときに落ちたことの記録、走らせたテストと結果）

## 結果

（リーダーが記入）

## 未解決

（リーダーが記入）

# Phase 3・4 の準備: 取り込み・更新の検知・notion-sync の単体テスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで実装する。蒙恬3人が並行して作る取り込み（`take-in.mjs`・`adopt.mjs`）、更新の検知（`tools/watch`）、`notion-sync` を、同じ仕様（docs/）からテストする。

## 入力

- docs/06 の2節（検知）・4節・6節・7.3（判定の形 `verdict.json`）、docs/05 の6節（競合）・8節・9節（テストの対象）
- 蒙恬の設計の書き物（でき次第）: `tasks/2026-11-14-p3-take-in/take-in-design.md`、`tasks/2026-11-14-p4-watch/watch-design.md`、`tasks/2026-11-14-p4-notion-sync/notion-sync-design.md`

## やること

1. 仕様から先に、次のテストを書く（入口の名前は設計の書き物ができたら合わせる）。
   - 検知: 前回の状態との比べ、「セキュリティ修正あり」の判定（2.2 の (a)(b)）、ToDo の中身（2.3 の表。優先度・期限の規則）、重複しないこと。
   - 取り込み: 手順の並べ方、止まる条件（docs/06 の4節の表）、`verdict.json` の形の検査、`claude -p` の起動の引数（`--agent di-renjie`、`--bare` を付けない、`ANTHROPIC_API_KEY` を外す）。
   - notion-sync: 競合の3通り、2000 文字の境目での分割、`ignoredSettings` の保ち方、同期するもの・しないもの（docs/05 の2節）。
2. 実装ができたら当てて走らせる。

## 守ること

- 書き込みは `tests/`・`tasks/`・試しの場所（`C:\b\` の下）だけ。`scripts/`・`tools/`・`extensions-src/` は書かない。
- 本物の Notion・GitHub に書かない。秘密の場所を開かない。

## 完了条件

- 1 のテストがあり、2 の結果がある（実装が無くて走らせられないものは、どれかを書く）。

## 成果物

このディレクトリに保存する。

- `tests-p34-design.md`、`handoff-notes.md`（報告）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 蒙恬の成果と合わせて検証する。

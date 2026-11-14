# notion-sync の依存の書き方の直し（本家の gulp に止められる）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

A-1 を当てたビルドの1回目で、本家 1.146.0 の `build/lib/extensions.ts` の162〜172行（`fromLocalNormal`）が、`esbuild.mts` を持たない拡張に `dependencies` があるとして notion-sync を止めた（`tasks/2026-11-14-p1-build-a1/handoff-notes.md` の「判断を仰ぎたい点1」）。`dist/extension.js` には jsonc-parser がもうバンドルされているので、実行には要らない。リーダーの判断で、案1（`devDependencies` に移す）を採る。

## やること

1. `extensions-src/notion-sync/package.json` の `jsonc-parser` を `devDependencies` に移す。版は固定のまま。
2. `pnpm --dir extensions-src/notion-sync install` でロックファイルを直し、`... run build` で `dist/extension.js` が作れること、バンドルに jsonc-parser が入ったままであることを確かめる。
3. notion-sync の単体テスト（`tests/` の notion-sync のもの）が通るかを、走らせられる範囲で確かめる。走らせられなければ、何が要るかを書く。
4. `apply-design.md` など、自前の拡張の書き方の規則に「バンドルする拡張は実行の依存を `dependencies` に書かない（本家の gulp が止める）」を足す（`scripts/` の設計の文書にあれば）。

## 守ること

- 書き込みは `extensions-src/notion-sync/`・`scripts/`（設計の文書だけ）・`tasks/`・`C:\b\` だけ。
- `C:\b\wt\` の作業ツリーとビルドの出力に触れない（検証が並行して読んでいる）。本体のビルドは走らせない。

## 完了条件

- 1・2 が済み、3 の結果がある。

## 成果物

このディレクトリに `handoff-notes.md`（報告）。

## 結果

採用。`jsonc-parser` を `devDependencies` に移し、ロックファイルとバンドルを作り直した（バンドルに入ったまま）。`--trial` の流れは全部 OK。単体テストの実行と本ビルドでの確かめは、次の検証とビルドで。docs/02 の4.1 に規則を足した。

## 未解決

- `tests/notion-sync.test.mjs` の実行（検証役）、本ビルドで notion-sync が通るか。

## 次の担当

ooka-echizen（大岡越前守）: 次の検証にまとめる。

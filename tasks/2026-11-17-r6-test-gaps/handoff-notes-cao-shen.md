# 曹参の引き継ぎ（G1〜G3）

## 変えた所

`tests/l10n-r6.test.mjs` の末尾に 6 件を足しただけ（29 件 → 35 件）。本体のコード（scripts/）は触っていない。

| ID | 件 | 種類 |
|---|---|---|
| G1 | `runL10nCount（走らせる）: G1 count の前（版の形・パック無し・extract）…staleOutput…` | 振る舞い。前の回の `l10n-count.json` を置いて3通り（パック無し・版の形を読めない・extract 失敗）を本物の `l10n-ja.mjs` で走らせ、`failed`・`staleOutput: true`・元の `reason`（extract は `step`）・数なし・ファイルが残り書き換わらない、を見る |
| G1 | `…G1 前の回のファイルが無ければ…staleOutput は付かない` | 振る舞い（対）。同じ3通りで、前のファイルが無ければ付かない |
| G2 | `take-in.mjs（構造）: G2 judge は listMaterials に l10nMaterialSkip(ctx.rec.l10n) を skip として渡す` | 構造（ソースの形） |
| G2 | `take-in.mjs（構造）: G2 runCore は shouldCountL10n に buildRec・ranBuild: run(5)・recDir・prevL10n: ctx.rec.l10n を渡し…` | 構造。元の `run(5) \|\| !exists` に戻していないことも見る |
| G2 | `take-in.mjs（構造）: G2 続きの回は、前の回の take-in.json の l10n を ctx.rec.l10n に写してから save する` | 構造。`prevRec` 読み込み → 写す → `save(ctx)` の順 |
| G3 | `l10nMaterialSkip + listMaterials: G3 dir と repoRoot が違うフォルダでも…` | 振る舞い。`dir` = `<repo>/records/take-in/lbl`、`repoRoot` = `<repo>`。直下の `l10n-count.json` だけ外れ、`logs/` と `sub/` の下の同名は残る。返る path は repoRoot 基準 |

### 振る舞いと構造の分け

- 振る舞いで見られる: G1（`runL10nCount` は走らせられる）、G3（`listMaterials` は純粋関数）、`shouldCountL10n` の真偽（前から）。
- 構造でしか見られない: G2 の3か所。`judge`・`runCore` を走らせるには作業ツリー・ビルド・`claude` が要るため。呼び出しの形（引数の名前と値、順序）を正規表現で照らす。関数の中身は上の振る舞いの件で見ているので、構造の件は「配線」だけを見る。
- 構造の件は書き方（空白・改行）には寛容にしたが、引数の名前と式（`ranBuild: run(5)`、`prevL10n: ctx.rec.l10n`、`skip: l10nMaterialSkip(ctx.rec.l10n)`）は固定している。書き方を変える修正で落ちたら、テストの正規表現を直す（仕様は変わらない）。

## 元に戻した写しで落ちることの確認

`take-in.mjs`（と G3 は `records.mjs`）の写しを `tmp/tests/mut-g/` に作り（`scripts/` の相対 import は実ファイルの URL に書き換え）、テストの写し（`records.mjs` の読み込みと `takeInSrc` の読み込み先を写しに向けたもの）に `AIED_TAKEIN_MODULE` で流した。使った一時のスクリプト `tests/_mutcheck.mjs`、写し、テストの写しは、すべて消した。

結果は7通りとも、期待した1件だけが落ち、残りは通った（34 通り・1 落ち）。

| 戻した所 | 落ちた件 |
|---|---|
| G1: `withStale` を `(r) => r` にする | G1 の1件目（`staleOutput` が付かない） |
| G2a: `judge` が `{ skip: l10nMaterialSkip(...) }` の代わりに `{}` を渡す | G2 judge |
| G2b: `runCore` が `prevL10n` を渡さない | G2 runCore |
| G2b: `runCore` の条件を `buildRec.result === "ok" && (run(5) \|\| !exists)` に戻す | G2 runCore |
| G2c: 前の回の `l10n` を写す行を消す | G2 続きの回 |
| G2c: 写す行を `save(ctx)` の後ろに動かす | G2 続きの回 |
| G3: `listMaterials` が `path.relative(repoRoot, p)` で skip を照らす | G3 |

補足: G3 は、前からある `dir` と `repoRoot` が同じ件では、この戻しを見分けられない（同じ件は通る）。新しい G3 の件だけが落ちる。

## 走らせたテストと結果

| コマンド | 件数 | 結果 |
|---|---|---|
| `node --test tests/l10n-r6.test.mjs` | 35 | 35 通った（落ち 0） |
| `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs` | 138 | 138 通った |
| `node --test tests/l10n-lib.test.mjs tests/l10n-repo.test.mjs tests/l10n-audit.test.mjs tests/l10n-audit-more.test.mjs` | 172 | 172 通った |

合わせて 345 件、落ち 0。

## 未解決

- なし。実装の不具合も仕様の食い違いも見つからなかった。
- 注: 構造の件の前提は、`runCore` と `judge` の関数名・`// ---` の区切りコメント（終わりの目印）。この形が変わったら件が「終わりが見つからない」で落ちる。

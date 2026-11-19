# r7 の関門の指摘 T1・T2 のテストの直し

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-19
- 状態: 完了

## 目的

r7 の関門（合格）で大岡越前守が挙げたテストの指摘のうち、移行の前に直すのが望ましい2つを直す。根拠は `records/take-in/1.146.0-p5-c-all-r7/gate-p5-c-all-r7.md` と `tasks/2026-11-19-r7-gate/gate-r7-notes.md`。

## 入力

- 上の関門の記録の指摘 T1・T2
- `tests/l10n-audit-more.test.mjs`（448〜451 行あたり）
- `tests/smoke/lib/run.mjs`（207〜209 行あたりの `safety.daily-argv`）
- product.json の `dataFolderName`・`nameLong`（`product.overlay.json`）

## 完了条件

- T1: `tests/l10n-audit-more.test.mjs` の実物のテストの既定の作業ツリーを、実際の置き方（`tmp/b/wt/<label>/w`）に合わせる。テストの題と、飛ぶ理由の文の「r4」を、今の版に合わせて直す。最新の版を決め打ちで書かずに求められるなら、そうする。
- T2: スモークの `safety.daily-argv` が、`~/.vscode`・`~/.vscode-oss` に加えて、`~/.<dataFolderName>`（`.sukuna`）と `%APPDATA%\<nameLong>` も「日常の場所に書いていない」ことを見るようにする。名前は版の product.json か overlay から求め、決め打ちしない。旧の `.shuko`・`%APPDATA%\Shuko` も、引退までは同じく見る（名前の残りの検査に当たらないよう、ほかのテストと同じく組み立てて書く）。
- 直したテストと、関係するテスト（l10n-audit-more、スモークの単体のテスト、rename-leftovers）を流した結果を残す。
- 日常の場所に何も作らない。

## 成果物

このディレクトリに保存する。

- `handoff-notes-cao-shen.md`: 直した場所、流した結果、気づいた点

## 結果

合格（2026-11-19、大岡越前守。`verification-gate-r7-test-fixes.md`）。T1: 実物のテストの既定を最新の版から求める形にし、環境変数なしで r7 に対して走って通る。T2: `safety.daily-argv` が版の product.json から求めた Sukuna と旧名の場所も見る。実際のスモークも PASS 49 / FAIL 0。run-all は 3,075 件で落ちは既知の1件だけ。

## 未解決

日常のエディタが動いていると、`safety.daily-argv` がフォルダの mtime の変化で偽の FAIL になりうる（大岡越前守の見立て4の1。安全な側に倒れる）。移行は止めない。検知のタスクを登録して毎週の取り込みを自動で回し始める前に、曹参が直す（始めにあるフォルダは消えていないか、無かったフォルダはできていないか、`argv.json` はファイルの mtime）。mtime で奥の書き換えを見ない点（4の2）も同じときに扱う。U1（`-rN` だけで最新を選ぶ）・U2（止める前に後の状態を取る）は直さない。

## 次の担当

大岡越前守の確かめ。

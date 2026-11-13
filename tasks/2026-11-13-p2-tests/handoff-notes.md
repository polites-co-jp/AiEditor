# 曹参 Phase 2 テスト 完了報告

## 追記（2026-11-14）実装に当てた結果

- 結果: 完了。落ちたのは1件（下の食い違い1。決めずに報告）。
- 入口: `tests/apply/api.mjs` を設計書の名前（`removeLinesFromText`・`planUnits`・`applyProductOverlay`・`classify.findUnclassifiedExtensions`・`highlightWords`）に合わせた。形の写しだけで、判定は変えていない。`removeIfPresent` で確定。
- 飛んでいた 33 件（`tests/apply.test.mjs`）: 33 件 pass。
- 足したテスト:
  - `tests/apply-parts.test.mjs` 57 件（lines の BOM・CRLF・最終行・count の不正値、deps の最後の要素・全消し・同名2区分・タブ・不正 JSON、overlay の重なり・`$`・入力不変・`stringifyLike`、`planUnits` の同 order・同 id・until、`validateUnit` の範囲・patch、classify・keys、lockfile の引用符・`''`・節の変化・link:・packages 増加、`shouldKeepCr`）: 56 pass・1 fail。
  - `tests/apply-cli.test.mjs` 7 件（引数なし → 終了コード 2、`parseArgs`、`summarizeResult`、`listPatches`、試しの入れ物での `--dry-run` が `C:\b\wt\dev-apply` の HEAD と status を変えない、`--only` に無い ID → fail）: 7 pass。
  - `tests/removals.test.mjs` に、段階 A・B の removeLines が本家 1.146.0 に順にちょうど当たること、delete の実在、A-3 の overlay の `builtInExtensions: []` を足した。
- `tests/removals.test.mjs`: 159 件、pass 145・skip 14・fail 0。skip は「有効な単位の after が有効」（全単位が `enabled:false` のため）。
  - A-1〜A-7 と `builtin/keep.json` の形、keep.json と単位で本家の拡張 95 件を覆うこと: pass（未分類 0）。
  - B-1〜B-7 と `product.overlay.json`（`extensions.allowed` と台帳の一致を含む）は、**作業中の版で** pass。B と overlay が変わったら再実行が要る。
- 全体の合計: pass 288・fail 1・skip 14（apply 33、selfcheck 33、parts 57、cli 7、absent 14、removals 159 のうち）。

## 仕様と実装の食い違い（どちらが正しいかは決めない）

1. `removeLinesFromText('a\n<消す行>', …)`（消す行が最終行で改行なし）が `'a'` を返す。前の行の改行も消える。設計書の「行末は行ごとに保つ」どおりなら `'a\n'`。テスト `lines: 最後の行（改行なし）を消す…` が落ちている。ファイルの末尾に改行を付けない方針なら実装が正しく、設計書に一文足せばよい。
2. docs/02 の3節の表は `reportIssueUrl` を overlay の `remove` にする。実装は B-3 の `productRemove` に置いた（overlay の `$comment` に理由）。テストは「どちらかで消える」ことを通した。docs 側を直すかどうかの判断が要る。
3. docs/03 の4節は「すべての `extensions/*`」を分類せよと書く。`extensions/types` は `package.json` が無く拡張ではないので、テストと apply.mjs は `package.json` のあるフォルダだけを数える。docs の書き方の問題。
4. `until` が無効な単位を指したときの規則は設計書に無い。テストは「無効な単位を plan に入れない」ことだけを確かめた。

## 未解決

- 残りは「消えている」を自作のビルドで走らせること（`tests/absent-run.mjs --expect absent --units all`）。自作のビルドができてからになる。`absentSettings` は取れるが、`absentHosts` は netaudit の担当。
- `dev-apply` への `--dry-run` は、`git config`（rerere）を共有の設定に書く。ファイルは変わらない。

---
（以下は最初の報告）

- 結果: 一部完了（蒙恬の成果が未着のため、実装に当てる部分は未実行）
- 成果物: `tests/apply.test.mjs`、`tests/apply/api.mjs`（入口の集約）、`tests/apply-selfcheck.test.mjs`、`tests/fixtures/ref-apply/ref.mjs`、`tests/removals.test.mjs`、`tests/absent.test.mjs`、`tests/absent-run.mjs`、`tests/removals/lib/absent.mjs`、`tests/removals/run-absent.mjs`、`tests/removals/probe/`、`tasks/2026-11-13-p2-tests/tests-design.md`
- 要点:
  1. 規則のテスト（removeLines・order と after・overlay・未分類の検出・目立たせ）33 件を仕様から書いた。参照実装で自己矛盾が無いことを確認済み。
  2. 形の検査（unit.json、keep.json が本家 1.146.0 の `extensions/*` を覆うこと、`extensions.allowed` と台帳の一致）は、実装が出ると動く。出ていないので現在は飛ぶ。
  3. 「消えている」は、コマンド・ビュー・設定・プロセスを `tests/absent-run.mjs` でビルドを起動して取る。公式 zip で「在る」を 5 件取れた。
  4. `absentStrings` は apply.mjs の検査、`absentHosts` は netaudit の担当で、ここでは扱わない。
  5. 許可が `node tests/*.mjs`（1階層）なので、台本の入口を `tests/absent-run.mjs` に置き、中身を `tests/removals/` に分けた。
- 実行結果: 62 件のうち pass 15・fail 0・skip 47（実装なし）。自己検査 33 件 pass。公式 zip での起動は成功し、起動した木だけを止めた。落ちたものは無い。
- 仕様から想定した入口: `tests-design.md` の「仕様から想定した入口」。`tests/apply/api.mjs` の `ALIASES` だけを直せば合わせられる。
- 未解決の点:
  - `apply-design.md` が未着のため、関数名と引数を合わせていない。出たら `api.mjs` を合わせ、飛んでいる 33 件を実装に当てる。
  - docs/02 に「本家が足したら remove」の overlay での書き方が無い（`removeIfPresent` と仮定）。決めて docs に書く必要がある。
  - 仮定した 4 点（設計書に列挙）が蒙恬の実装と食い違えば、どちらが正しいかは決めずに報告する。
  - removals/・keep.json・overlay の形の検査は、蒙恬の成果が出てから 1 回走らせて結果を足す必要がある。

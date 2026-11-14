# 引き渡しの覚え: Phase 2 の版のビルド（蒙恬）

- 担当: 蒙恬、2026-11-14
- 依頼: `brief.md`（このフォルダ）と、リーダーの追加の指示（版ごとに zip を `C:\b\p2\<label>` へ展開して1回起動する）
- 一覧: `builds.md`。記録: `build-log.md`、版ごとの `<label>/`（`checks.json`・`lockfile.diff`・`build-record.json`・`launch-check.json`）、ログ `C:\b\logs\<label>\`

## 結果: 完了

- 土台の版 `1.146.0-p2-base`（単位なし）は、パッケージ化で落ちた。brief の注意のとおり、A-1 を含めた版 `1.146.0-p2-A-1` を土台とした（`build-log.md` の2節）。
- A-1〜B-7 の14版は、どれも「当てる・適用後の検査・依存の導入・ロックファイル・型検査・パッケージ化・後処理（commit の一致を含む）・zip」が通った。落ちた単位は無く、`removals/` は何も変えていない。`unit.json` の `enabled` も書き換えていない。
- 14版とも `C:\b\p2\<label>\` に展開し、1回起動した（`result: ok`。普段使いのデータは変わらない）。

## 要点

1. 土台が落ちた理由: commit の直しで `BUILD_SOURCEVERSION` を渡すようになった。そのため、`extensions/copilot/.esbuild.mts` が CI とみなして `VSCODE_QUALITY` を求めた。A-1 で copilot の拡張を消せば起きない。A-1 が無ければ、元から後の手順で落ちる（裁定 2026-11-14）。
2. notion-sync は、どの版でもパッケージ化を通った（`tasks/2026-11-14-notion-sync-deps/` の直しが効いた）。`dist\extension.js` も出力に入っている。
3. ロックファイル: A-2 から `extensions/pnpm-lock.yaml` が、B-1 から `pnpm-lock.yaml`・`remote/pnpm-lock.yaml` が変わる。中身はどれも「消した依存の削除」だけ（`status: ok`）。
4. 出力の組み込み拡張は 91（A-1）から 65（A-7 以降）に減った。A-7 で `keep.json` に無い拡張が 0 になった。zip は 405 MB から 373 MB に、出力は 1.17 GB から 1.06 GB になった。
5. どの版の起動でも `copilot-runtime.exe` が1つ起きる（本体の AI のエージェントのホスト。C-1 の範囲。推定）。

## 検証役（大岡越前守）へ

- 関門に使う場所は、`builds.md` の「展開した場所（エディタ）」の列（`C:\b\p2\<label>\Shuko-win32-x64-<label>\`）。
- その隣の `C:\b\p2\<label>\portable\` には、私の1回の起動のデータが残っている（`VSCODE_PORTABLE` で使った場所）。空のデータで関門を始めるなら、別の場所（`--user-data-dir` など）を使うこと。
- gulp の出力 `C:\b\wt\VSCode-win32-x64\` は、今は B-7 の版。

## 直した台本

- `scripts/p1-launch-check.ps1`: `-Dest` に `C:\b\p2` の下も許した（`$destRoots = @('C:\b\p1', 'C:\b\p2')`。既定は `C:\b\p1` のまま）。`scripts/p0-check-ps.ps1` で構文の誤り 0、ASCII 以外 0 バイト。断るときの文は「refusing a path outside C:\b\p1 and C:\b\p2 : …」。`tests/p1-scripts.test.mjs` の3つのテスト（`/outside C:\\b\\p1/i`）にも合う見込み（走らせていない）。
- テストが要る点（曹参へ）: `-Dest C:\b\p2\<x>` を受け付けること、`C:\b\p2` そのものと `C:\b\p3\<x>` は断る（終了コード 2）こと。
- `build.mjs` は、ビルドの途中では変えていない（リーダーの指示）。

## 確かめたこと

- 14版の `build-record.json` は、どれも `result: ok`。`steps[].productCommit.ok: true`、`sourceVersion.matchesChecksHead: true`。
- `launch-check.json` は、どれも `result: ok`。`bin\shuko.cmd --version` の2行目が product.json の commit と同じ。
- テスト（`node --test`）は許可が無く、走らせていない。

## 未解決の点

1. **ディスク**: C: の空きは 39.09 GB（作業を始めたときは約 77 GB）。展開した14版（`C:\b\p2` 15.73 GB）と zip（`C:\b\dist` 5.80 GB）が大きい。関門が終わった版から片づけるかどうかは、リーダーの判断。私の許可には、消すコマンドが無い。
2. **版の commit がどの枝からもたどれない**: 版ごとに作業ツリーをタグに戻して当て直した。そのため、各版の product.json の commit（`builds.md` の列）は、常設の clone のどのブランチ・タグからもたどれない。git の gc で、既定では2週間ほどで消える。版のソースを後で取り出すなら、`git -C C:/b/vscode branch p2/<label> <commit>` などで印を付ける必要がある。この許可は私に無い。
3. 検証役から出た `build.mjs` の軽微な点（`childEnv` が外の `BUILD_SOURCEVERSION` を外さない、など）は、指示どおり手を付けていない。依頼を待つ。

## docs/ との食い違い

- docs/07 の5節の2（単位なしの土台）は、1.146.0 では A-1 が無いとパッケージ化で落ちるため、その形のままでは作れない。1.146.0 での扱い（A-1 を含めた版を土台にする）を5節にも書き足すとよい。
- docs/03 の5.1 の当て方（`enabled: true` の単位を当てる）に対し、関門の前の版は `apply.mjs --only` で単位を選んだ。`--until` は `enabled: true` の単位の中でしか効かない（`scripts/lib/apply/units.mjs` の `planUnits`）。brief の「`--until <id>` などの台本の形で」とは違うやり方になった。

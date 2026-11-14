# Phase 1 で足した台本のテスト: 引き継ぎ

- 担当: cao-shen（曹参）、2026-11-14
- 結果: 完了（テストは書いた。ただし 1 件が実装の不具合で落ちる。台本は直していない）

## 足したテスト

`tests/p1-scripts.test.mjs`（27 件。`node --test tests/p1-scripts.test.mjs`）。`run-all.mjs` が自動で拾う。一時フォルダは `C:\b\tests-p1-*`（終了時に消す）。

1. disk-usage.mjs（15 件）
   - `expandEnv` 2、`parseArgs` 3、`countDir` 6（hard link 2 つで bytes 2 倍・uniqueBytes 1 倍・hardlinkedFiles 2、hard link なし、`seen` をまたぐ重なり、ジャンクション・シンボリックリンクをたどらない、無い場所）
   - 実行 4（JSON の形と `--out`、無い場所は `exists:false` のみ、2 場所の重なりが `uniqueTotal` に 1 回、`%NAME%` 展開、引数の誤り 5 通りで終了コード 2）
2. p1-launch-check.ps1（8 件）: どちらも無し・両方・zip 無し・root 無し・`-Root` が `C:\b\` の外（`C:\Windows`、読むだけ）・`-Dest` が `C:\b\p1\` の外（`-Zip` と `-Root`）・`-Dest` が `C:\b\p1` そのもの、すべて終了コード 2。起動・展開はしない（`-Dest` の外は何も作られないことも確認）
3. p1-ci-events.ps1（3 件）: JSON の形・終了コード 0・`-OutFile` が標準出力と一致（error 以外）・id が 3033/3034/3076/3077 のみ、当たらない `-Filter` と `-Max`、「イベントが無いとき readable:true」（これが落ちる）
4. check-env.ps1（1 件）: `smartAppControl` があり、`meaning` が off/on/evaluation/unknown で、state の値と対応し、`missing` に入らず、終了コードが missing だけで決まる

## 実行結果

- `node tests/run-all.mjs`（結果は `run-all-result.txt`）: tests 1500、pass 1478、fail 1、skip 21。skip 21 は既存の `removals.test.mjs`（このテストの skip は 0）
- 落ちた 1 件: `p1-scripts.test.mjs: p1-ci-events.ps1: 当たるイベントが無いとき readable:true・count 0`
- brief の完了条件「fail 0」は、下の不具合が直るまで満たせない。仕様を緩めてテストを通すことはしていない

## 不具合（実装。蒙恬へ）

`scripts/p1-ci-events.ps1` の 54 行目 `$_.Exception.Message -match 'No events were found'` は英語のメッセージにしか一致しない。この PC（日本語の Windows）では「指定した選択条件に一致するイベントが見つかりませんでした。」が返り、イベントが無いだけなのに `readable: false`・`error` に日本語の文が入る（再現: `-Minutes 1 -Filter x`）。仕様（handoff-notes の「イベントが無いときは `readable: true`・`count: 0`」）と食い違う。直し方の案: メッセージでなく、例外の型 `[System.Exception]` の `FullyQualifiedErrorId` が `NoMatchingEventsFound` を含むかで見分ける。

## 気づいた点（直しを求めない）

- 標準出力は OEM コードページで出るため、`error` の日本語が Node で読むと化ける（ファイルの `-OutFile` は UTF-8 で正しい）。テストは `error` 以外を比べている。
- 実行中に `run-all` を 2 本並べて走らせてしまった（私の操作）。どちらも一時フォルダは別名で、結果に影響は無い。
- 本物のエディタの起動・PC の設定の変更・普段使いのエディタのデータへの接触は無い。

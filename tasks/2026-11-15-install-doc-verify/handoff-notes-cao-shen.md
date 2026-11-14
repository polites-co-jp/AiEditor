# 引き継ぎ: インストールの手順書が頼る台本のテスト（曹参）

- 担当: 曹参（cao-shen）、2026-11-15
- 依頼: `tasks/2026-11-15-install-doc-verify/brief.md` の「やること（曹参）」

## 結果

- 結果: 完了
- 成果物:
  - `tests/install-doc.test.mjs`（新規。4件）
  - `tests/build/shortcut-probe.ps1`（新規。configure.ps1 の手順5のショートカット部分を、一時のフォルダで動かす試し役）
  - `tasks/2026-11-15-install-doc-verify/run-all-result.json`（`node tests/run-all.mjs --save` の出力。名前は json だが中身は一覧の文字列）
- 要点:
  1. PATH の `%LOCALAPPDATA%\...` の形の一致は、`Update-PathEntries` の規則としては `tests/build-fixes.test.mjs` に「`%FOO%\current\bin`」の形で既にあった。`%LOCALAPPDATA%` そのもの（大文字小文字違い・末尾 `\`・別の場所なら null）を `install-doc.test.mjs` に足した。handoff-notes の例（`'D:\S\current\bin;C:\x'`）も同じ結果。
  2. ショートカットの向け直し（直下の .lnk だけ、サブフォルダは見ない）には、これまでテストが無かった。台本の `if ($programs -and ...)` の塊を構文木で取り出し、`$programs` だけを一時のフォルダに差し替えて動かす。台本の写しではなく本物のコードが動く。
  3. `labelToVersion('1.146.0-p2-all')` が null、`currentCoreVersion` が `upstream.json` に戻ること（`source: 'upstream.json'`、`label: null`）を足した。`labelToVersion` の既存テストは `1.146.0-1`・`1.146.0`・`ext-a.b-1.0.0` だけだったので、`-p2-all` の形は新規。
  4. 全体は 1585 件、通った 1578、落ちた 0、飛ばした 7。落ちたものは無く、切り分けは要らない。飛ばした 7 件は `removals.test.mjs`（今回の変更とは無関係。従来どおり）。
  5. 本物のスタートメニュー・PATH・レジストリには触れていない。試し役は、フォルダ名に `tests-` か `trial` が無いと止まる。

## テストの場所（「既にテストがあれば場所を書く」への答え）

| 点 | 既存か | 場所 |
|---|---|---|
| `Update-PathEntries` の規則（%VAR% の展開、大文字小文字、末尾の `\`、2か所、空の項目） | 既存 | `tests/build-fixes.test.mjs` の `Update-PathEntries: 規則` と `tests/build/path-entries-probe.ps1` |
| 同じ、`%LOCALAPPDATA%` の形 | 新規 | `tests/install-doc.test.mjs` の最初のテスト（試し役は既存の probe を流用） |
| 手順5のショートカット | 新規 | `tests/install-doc.test.mjs` の2つ目のテストと `tests/build/shortcut-probe.ps1` |
| `labelToVersion('1.146.0-1')` など | 既存 | `tests/watch.test.mjs` 119行 |
| `labelToVersion('1.146.0-p2-all')` が null | 新規 | `tests/install-doc.test.mjs` |
| `currentCoreVersion` の current 優先と upstream.json への戻り | 既存の一部 | `tests/watch.test.mjs` 739〜741行（current が読める場合と無い場合）。ラベルが読めない場合は新規 |

## 手順5のテストの中身

一時のフォルダの「プログラム」に .lnk を5つ作り、台本の塊を動かして読み戻す。

- 直下の `Shuko.lnk`（`<前>\current\Shuko.exe`、作業場所 `<前>\current`）→ 向け先も作業場所も `<新>\current` に変わる。
- 直下の `Shuko Bin.lnk`（`<前>\current\bin\shuko.cmd`）→ 下の部分を保ったまま `<新>\current\bin\shuko.cmd`。
- `Sub\Shuko in Sub.lnk`（`<前>\current\Shuko.exe`）→ 変わらない（サブフォルダは見ない）。
- `Other.lnk`（前の current の外）、`Similar.lnk`（`<前>\current2\...`、名前が前方一致するだけ）→ 変わらない。
- 戻しの記録（`kind = shortcut`）と `actions` は向け直した2つだけ。

## 仕様から想定した入口

- 実装（`configure.ps1`）は既にあったが、実装に合わせて作ったのは試し役の取り出し方だけ（構文木で `$programs -and ...` で始まる if 文を探す）。台本の塊の書き方が大きく変わると、試し役が「見つからない」と落ちる。落ちたらテストの入口の問題で、台本の不具合ではない。

## 見つけた点（直さず報告する）

1. **ジャンクション越しの保存は試せていない**。蒙恬の未解決の1（`TargetPath` を `...\current\Shuko.exe` にして Save したとき、Windows がジャンクションを解くか）は、今回のテストでも確かめていない。試しの入力は普通のフォルダで、`current` はジャンクションではない。確かめるなら、一時のフォルダにジャンクションを作って .lnk を保存し、読み戻す試しを足せる（`WScript.Shell` を使うだけで、本物のスタートメニューには触れない）。必要なら次の依頼で足す。
2. **許可の不足は無かった**。ただし、`node tests/*.mjs` の形は `--help` などの引数付きでは通らない（許可は「完全一致か許可＋空白の前方一致」で、`tests/*.mjs` の `*` は実在のファイル名でないと一致しない）。`wait-file.mjs --help` は引数が足りず待ちに入ってしまい、バックグラウンドに回った（無害。使うなら引数を付けて呼ぶこと）。
3. `node tests/run-all.mjs --save <ファイル>` の出力は、拡張子が `.json` でも中身は表の文字列。brief の名前のままにした。

## 未解決の点

なし（上の見つけた点の1は、必要ならリーダーの判断で次の依頼にする）。

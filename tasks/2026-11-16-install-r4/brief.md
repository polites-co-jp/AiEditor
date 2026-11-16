# 版の入れ替え: 1.146.0-p5-c-all-r4 を日常の利用に入れる（手順書の1・2・4）

- 担当: meng-tian（蒙恬）。確かめは ooka-echizen（大岡越前守）
- 依頼日: 2026-11-16
- 状態: 完了

## 目的

ユーザーの裁定（2026-11-16「版の入れ替え」）で、版の入れ替えを課が行う。手順書 `docs/install.md` の1・2・4を打ち、段階 A・B・C の21単位を当てた版 `1.146.0-p5-c-all-r4`（関門に合格。`records/take-in/1.146.0-p5-c-all-r4/gate-p5-c-all-r4.md`）を日常の利用に入れる。3（スタートメニューと PATH）・5（外部ツール）・6（Notion のトークン）・7（タスクスケジューラ）と画面を見る確かめは、ユーザーが行う。

## やること（蒙恬）

手順書 `docs/install.md` のとおりに、ビルドリポジトリの直下で打つ。

1. **手順1**: `configure.ps1` で本物の `local.json`（`%LOCALAPPDATA%\Shuko\local.json`）を作る。`buildRoot` は既定（`<リポジトリ>\tmp\b`）、`installRoot` は手順書の既定、`builderRepo` はこのリポジトリ。既に `local.json` があれば、中身を読んで書き付けに写し（秘密は入らない）、上書きする前に止めて知らせる。
2. **手順2**: `switch.ps1 1.146.0-1 -Zip tmp\b\dist\1.146.0-p5-c-all-r4.zip -Sha256 e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e`。出力の見どころ（手順書の2）を確かめる。
3. **手順4**: `install-extensions.mjs` で台帳の拡張を入れる（手順書の4のとおり。`--portable` ではなく、入れた版に入れる形）。
4. **起動の確かめ**: `current\bin\shuko.cmd --version` が `1.146.0`・`7fac30e886f79ebe44e1bac93acd7a86fbbafed8`・`x64` を出すこと。`scripts/p1-launch-check.ps1` などの許可にある形で、入れた版のワークベンチが立ち上がることを確かめられるなら確かめる（普段使いのデータを変えない形で）。
5. 書き付けに、打ったコマンド・出力の要点・作ったもの（`local.json` の中身、版のフォルダ、`current` の向き、`history.txt` の行、入れた拡張の一覧）を書く。

## 守ること

- 普段使いの本家の VS Code のデータ（`%APPDATA%\Code`・`%USERPROFILE%\.vscode`）に触れない。
- スタートメニュー・PATH・タスクスケジューラ・Notion・秘密の場所に触れない（ユーザーが行う）。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。
- 何かが期待と違えば、その場で止めて知らせる（戻し方は手順書の8）。

## 完了条件

- `current` が `1.146.0-1` を指し、`shuko --version` が上の3行を出し、台帳の拡張が入っている。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`。

## 結果

済み。蒙恬が手順書の1・2・4を打った（`local.json` を新しく作り、`switch.ps1 1.146.0-1` は `result: ok`・SHA-256 一致、台帳の拡張8件は `compare.ok: true`）。リーダーが読むだけの確かめで、入れた版の `current\bin\shuko.cmd --version` が `1.146.0`・`7fac30e886f79ebe44e1bac93acd7a86fbbafed8`・`x64` を出し、`current` が `versions\1.146.0-1` を指し、`history.txt` が1行であることを確かめた。同じ zip のポータブルの起動の確かめ（`launch-check-r4.json`）はワークベンチ `ready: true`。

## 未解決

- ユーザーが行うもの: 手順書の3（スタートメニューと PATH）・5（外部ツール）・6（Notion のトークン）・7（タスクスケジューラ）、画面を見る確かめ（C1〜C22）。
- 本家の VS Code のデータ（`%APPDATA%\Code` など）がこの PC に無い。手順書の「本家に戻る」の前提を、ユーザーに知らせる。
- `%APPDATA%\Shuko` に前の試しの残り（2026-11-14）がある。消すかはユーザーが決める。
- 試しの展開 `tmp\b\p1\1.146.0-p5-c-all-r4-install-check\` は削除の許可の外にある。

## 次の担当

ooka-echizen（大岡越前守）: 入った版の確かめ。ユーザー: 手順書の3・5・6・7 と画面を見る確かめ。

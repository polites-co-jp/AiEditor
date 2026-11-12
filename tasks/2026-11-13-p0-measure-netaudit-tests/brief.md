# 計測と通信の監査の台本（0-4・0-5）と、Phase 0 の部品の単体テスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-13
- 状態: 依頼中

## 目的

docs/07 の3節の計測と通信の監査を台本 `scripts/measure.ps1`・`scripts/netaudit.ps1` として固める（以後ずっと使う）。あわせて、蒙恬が並行して作る台帳と Sublime のキーの部品の単体テストを、同じ仕様から書く。

## 入力

- docs/07 の2.5（0-4）、2.6（0-5）、3節（計測の手順、そろえる条件、集計、外向き通信の監査、合格の基準）
- docs/04 の3節（台帳の形）、4節（検証の項目）、6.2（Sublime のキー）
- 蒙恬への依頼書: `tasks/2026-11-13-p0-fetch-and-lock/brief.md` の「やること」の5、`tasks/2026-11-13-p0-envs-mydist-keys/brief.md` の「やること」の6（関数の名前と形の約束）

## やること

1. `scripts/measure.ps1`: docs/07 の3.2 の台本。
   - 引数の例: 実行ファイル、環境のひな形（蒙恬の `scripts/p0-env.ps1` が作る `C:\b\p0\data\<名前>\`）、ワークスペース（`C:\b\p0\ws\`）、開く2つのファイル、ラベル、回数（既定 5。その前に捨てる1回）、出力先（既定 `records/measurements/<日付>-<ラベル>/`）、節目の計測（手順 4 の前に、ユーザーが Claude Code のパネルで決まった1文を送って応答を待つための一時停止）。
   - 3.1 の「データの置き場所を新しく作る」を毎回守る（ひな形から写すなど、やり方は仕様に沿って決め、成果物に書く）。
   - 集計: プロセスごとの CSV（役割を `CommandLine` から付ける）、プライベートバイトの合計（主）とワーキングセットの合計（従）、claude.exe とその子孫を「含めた合計」と「含めない合計」、5回の中央値と範囲、変えた既定値の一覧、PC の状態。
   - 本家と自作を比べて 3.4 の合否を出す方法（2つの出力先を渡すと合否を出す、など）も用意する。
2. `scripts/netaudit.ps1`: docs/07 の3.3 の台本（10分、2秒ごと、子孫の PID の接続、DNS のキャッシュでの名前の結びつけ、宛先ごとの初出・プロセス・回数、前の一覧との比較、`records/network-allowlist.json` にない宛先の報告）。許した宛先の一覧の形を決め、例のファイルをテストの材料として `tests/` に置く（本物の `records/network-allowlist.json` は大岡越前守が 0-5 で作る）。
3. 台本の中の計算（役割の判定、子孫の集め方、claude.exe の子孫の分け方、中央値と範囲、合否、DNS の結びつけ、新しい宛先の判定）を、実機なしで確かめるテストを `tests/` に書く（`powershell -NoProfile -ExecutionPolicy Bypass -File tests/<名前>.ps1` で走らせる。Windows PowerShell 5.1 で動くこと。PowerShell 7 はまだ入っていない）。計算の部分を台本から読み込めるよう、台本の作りを決めてよい（あなたが書けるのは `scripts/measure.ps1`・`scripts/netaudit.ps1` と `tests/` だけ）。
4. 蒙恬の部品の単体テスト（`node --test tests/` で走る）。
   - `tests/lock.test.mjs`: `scripts/lib/lock.mjs` の `validateLockEntry`・`isSoaked`・`satisfiesEngine`・`compareFileLists`・`diffManifest`。docs/04 の3節・4節から、正常の例と、境界（72時間のちょうど前後、セキュリティ修正、`^` と `>=`、新しい .node、`contributes.chatParticipants` が増えた）を書く。
   - `tests/sublime-keys.test.mjs`: `scripts/lib/sublime-keys.mjs` の `convertKeybindings`・`findConflicts`。docs/04 の6.2 の規則から書く。
   - 蒙恬の実装はまだ無い。仕様と約束から書き、実装が届く前は失敗してよい。走らせた時点の結果を成果物に書く。

## 守ること

- 書き込みは `scripts/measure.ps1`・`scripts/netaudit.ps1`・`tests/`・`tasks/` だけ。`records/` は書かない。
- 実機での計測（5回の本測定、10分の監査）は大岡越前守が行う。あなたは短い試し（例: 1回、短い時間）で台本が動くことを確かめるところまで。試すなら本家 1.146.0（`C:\b\p0\vscode-1.146.0\`。蒙恬が並行して取っている）か、すでに PC にあるもので、普段使いのエディタのデータに触れない。
- docs と食い違う点や、仕様が足りず決めた点は成果物に書く。

## 完了条件

- `scripts/measure.ps1`・`scripts/netaudit.ps1` があり、構文の誤りが無い。
- 計算の部分のテスト（PowerShell）がすべて通る。
- 台帳と Sublime のキーのテスト（node）があり、走らせた結果がある。

## 成果物

このディレクトリに保存する。

- `measure-design.md`: 台本の使い方（引数、出力の形、データの置き場所の作り方、節目の計測の一時停止、合否の出し方）と、試しの結果。
- `netaudit-design.md`: 同じく監査の台本の使い方と、許した宛先の一覧の形。
- `test-results.md`: テストの一覧と走らせた結果。
- `doc-corrections.md`: docs と食い違った点、仕様が足りず決めた点（無ければ置かない）。

## 結果

<完了後にリーダーが記入する。成果の要点と採否>

## 未解決

<残った課題・持ち越し。無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 台本とテストを確かめ、0-4 の基準値と 0-5 の棚卸しを実機で取る。

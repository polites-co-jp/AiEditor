# 0-4 の本番の手順（本家の基準値と、参考の試験台）

- 作成: 大岡越前守（2026-11-13）。この手順で使える状態であることは、`verification-log.md` の検証（4）で確かめた。D-1 の直しの確認は `handoff-notes.md` の追記。
- 根拠: docs/07 の2.5（本家を5回、参考に試験台を5回）、3.1（そろえる条件）、3.2（台本と集計。節目の計測）、3.4（合格の基準）、docs/user-decisions.md の「裁定（2026-11-13、0-4 の本番の前）」
- 行うのはユーザー（節目の計測で、手で Claude Code のパネルに1文を送るため）。台本は `Read-Host` で止まるので、ユーザー自身の PowerShell の窓で走らせる。エージェントからは走らせない。

## 0. 決めたこと（裁定 2026-11-13）

| 論点 | 裁定 |
|---|---|
| 節目の計測で Claude Code のパネルに送る「決まった1文」 | **「こんにちは。一言だけ返事をしてください。」**。以後の節目もこの文を使う |
| Process Explorer の画面の写し（docs/07 の3.2 の補い。合否には使わない） | **数える5回の後に、数えない1回を足して撮る**（手順は5節の4） |

## 1. 前の準備（10分ほど）

1. 手の確かめのエディタ（`upstream-ai-disabled`・`testbed`・`mydist` など、`C:\b\p0\` の下のもの）をすべて閉じる。
2. docs/07 の3.1 のとおり、ほかのアプリを閉じる。検証の時点では、Cursor、Brave、WSL（vmmemWSL 13.5 GB）などが動いていた（`trial/measure-upstream/pc-state.json`）。
   - 閉じたものと残したものは、終わった後に `pc-state.json` の上位15を見て記録に書く。
   - 本家と試験台は、同じ状態で続けて測る。
3. 電源の設定はそのまま（検証の時点は「バランス」）。途中で変えない。
4. リポジトリの直下で、次を確かめる。
   - `C:\b\p0\run\` に回のデータのフォルダ（`<ラベル>-run-<n>` など）が無いこと。印のファイル `.p0-run-root` はあってよい。
     - 残っていたら、ほかの計測が動いていないことを確かめてから、次で消す（D-1 の直しで、消すのは `C:\b\p0\run` の下の回のデータの名前と形を持つフォルダだけ。使用中のフォルダは消さない。検証で確かめた）。
       ```
       powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -CleanStale
       ```
     - `-WorkRoot` は付けない（既定の `C:\b\p0\run`）。
   - `tmp\ws` のコミットが `2385a2ff1ea22ceaa5a039500f3f88361eef2392` で、`.vscode\tasks.json` があること。
   - `C:\b\p0\data\upstream-default\` と `C:\b\p0\data\testbed-measure\` が 07:36〜07:38 に作り直したもので、`user\user-data\User\settings.json` に `basedpyright.importStrategy: "useBundled"` があること。
5. 同じ PowerShell の窓を、本家と試験台の両方で使う（PATH を揃える。basedpyright は PATH の Python 3.14 を使う）。

## 2. 本家（upstream-default）: 捨てる1回 + 数える5回

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -EnvDir C:/b/p0/data/upstream-default -Label phase0-upstream -Milestone
```

- `-Runs 5 -Warmup 1` は既定なので書かない。`-Exe`・`-Workspace`・`-OpenFiles` も省く（環境の記録、`tmp\ws`、`C:\b\p0\ws-info.json` の2つが使われる）。
- 出力: `records/measurements/<日付>-phase0-upstream/`。

各回の流れ（6回とも同じ。捨てる回も止まる）:

1. 台本がデータを写して、エディタを起動する（自動）。
2. 30秒後に、TS のファイルと Python のファイルが10秒あけて開く（自動）。ターミナルが1つ開く（tasks.json）。
3. 窓に `MILESTONE: send the fixed sentence ...` と出て止まる。**ここからがユーザーの手の操作。**
   1. Claude Code のパネルを開く（活動バーか、エディタの右上の Claude のアイコン）。
   2. **「こんにちは。一言だけ返事をしてください。」** を貼って送る。
   3. 応答が出終わるのを待つ。
   4. PowerShell の窓に戻って Enter を押す。
   - パネルがログインや初回の案内を求めたら、その回は Ctrl+C で止め、リーダーに知らせる（普段のログインが使われる見込みだが、未確認）。
   - パネル以外のもの（ファイル、ターミナル）には触れない。
4. 120秒待ってから、プロセスを集める（自動）。窓に `[run-N] private (no claude) ..., processes ..., claude ...` と出る。`claude` が 1 以上なら、パネルの CLI が分けて数えられている。
5. エディタを止め、10秒待ち、回のデータを消す（自動）。

## 3. 参考: 試験台（testbed-measure）: 捨てる1回 + 数える5回（合否には使わない）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -EnvDir C:/b/p0/data/testbed-measure -Label phase0-testbed -Milestone
```

- 流れは2節と同じ（送る文も同じ）。実行ファイルは VSCodium（`C:\b\p0\testbed\VSCodium.exe`、環境の記録から）。
- **試験台では台本をまだ試していない**（検証の間、ユーザーの手の確かめのため起動を控えた）。捨てる1回が終わったときに、窓の `processes` が 10 以上、`private` が数百 MiB 以上あることを見る。1桁や `no editor process found` なら、Ctrl+C で止めてリーダーに知らせる。

## 4. 所要時間の見込み

| 区切り | 1回あたり | 6回 |
|---|---|---|
| データの写し | 15〜70秒（検証では 15秒と 70秒） | |
| 起動から開くまで | 約40秒（30秒 + 10秒） | |
| 節目の手の操作 | 1〜2分（応答の待ちを含む） | |
| 落ち着くまでの待ち | 120秒 | |
| 集める・止める・消す | 20〜40秒 | |
| 計 | 約5〜6分 | 約30〜36分 |

本家と試験台で約60〜75分。Process Explorer の1回（約5分）と、準備・確認を入れて **1時間半ほど**。途中で PC を使わない。

## 5. 終わった後（リーダー・大岡越前守）

1. 出力（`runs.csv`・`summary.md`・`roles.csv`・`<回>-processes.csv`・`pc-state.json`・`defaults-changed.md`）がそろっていることを見る。`summary.json` の `DailyArgvTouched`・`RunDataLeftOver` が空であること。
2. 各回に ts-server と、basedpyright の language-server があることを `roles.csv` で見る（`Extension` の列が `detachhead.basedpyright-1.40.2` の行）。無い回があれば、その回は条件が揃っていないので、記録に書いて判断を仰ぐ。
3. 5回の中央値と範囲（主は `PrivateExclClaude`）を `records/measurements/<日付>-phase0-upstream/summary.md` から読む。試験台の値は参考として並べる（合否には使わない）。
4. Process Explorer の画面（裁定: 数える5回の後に、数えない1回を足して撮る）。本家の5回が終わった後に、続けて次を走らせる。出力は数える回と分ける。
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -EnvDir C:/b/p0/data/upstream-default -Label phase0-upstream-pe -Runs 1 -Warmup 0 -Milestone
   ```
   1. `MILESTONE` で止まったら、決まった1文を送り、応答を待つ。
   2. メニューの「ヘルプ」→「Process Explorer を開く」を選び、窓を撮る。
   3. Process Explorer の窓を閉じてから Enter を押す。
   4. 画像は `records/measurements/<日付>-phase0-upstream/process-explorer.png` に置く。この回の値（`<日付>-phase0-upstream-pe/`）は数えない。
5. 0-5（10分の監査）は別の手順。この手順には含めない。

## 6. 止めるとき

- 途中で Ctrl+C で止めると、その回のエディタが残ることがある。そのときは、ユーザーがその窓を閉じる。`p0-stop.ps1` は使わない（手の確かめのエディタまで止めないため）。
- 止めた回のデータは `C:\b\p0\run\` に残る。ほかの計測が動いていないときに、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1 -CleanStale` で消す（1節の4と同じ。`-WorkRoot` は付けない）。
- 出力の場所に `runs.csv` が残っているため、やり直すときは `-Force` を付けるか、別の `-Label` にする。

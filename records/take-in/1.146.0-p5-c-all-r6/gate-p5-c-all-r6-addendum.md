# 関門の記録の追記: 全体の run-all の結果（版 `1.146.0-p5-c-all-r6`）

- 大岡越前守、2026-11-17。`gate-p5-c-all-r6.md` の6節で「終わっていない」と書いた全体の run-all（見張りあり）が終わったので、結果と、落ちた2件の切り分けを足す。判定（合格）は変わらない。

## 結果

`node tests/run-all.mjs --save tasks/2026-11-17-r6-gate/run-all-r6.txt`（PowerShell のテストを含む、見張りあり）

- 77ファイル（`*.test.mjs` 75・`*.tests.ps1` 2）、**3,021件。pass 3,017・fail 2・skip 2**。
- 見張り（`[guard]`）の通知は無かった。本物の作業場所に書いたテストは無い。
- skip の2件は `apply-cli.test.mjs`（試しの作業ツリーが無い。前の検証と同じ）。
- `l10n-r6.test.mjs` は 35件で全部通った（私が先に流したときは22件）。

## 落ちた2件の切り分け（どちらも、動いている日常の Shuko による環境の都合。r6 の変更と関係しない）

| ファイル | テスト | 原因（失敗の文で確かめた） |
|---|---|---|
| `move-off-c.test.mjs` | `PowerShell 側の部品（local-config.ps1）の既定も同じ（configure.ps1 の出力）` | `configure.ps1` が `result: editor-running`（終了コード 3）で止まった。報告済みのものと同じ |
| `configure.test.mjs` | `-InstallRoot: the value is written as the user gave it (a %NAME% is not expanded)` | 同じく `editor-running`（終了コード 3）。`running` に `C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe` の20のプロセスと `versions\1.146.0-1\…\OpenConsole.exe` の1つ、`oldInstallRoot` は本物の `C:\Users\kou_z\AppData\Local\Programs\Shuko` |

仕組み:

- このテスト（`tests/configure.test.mjs` 187〜193行）は、空のサンドボックスの `local.json`（ファイル無し）で `configure.ps1 -InstallRoot %SHUKO_TEST_BASE%\Pct -NoMove` を走らせる。`local.json` が無いので、前の `installRoot` は既定の本物の場所（`%LOCALAPPDATA%\Programs\Shuko`）になる。
- `configure.ps1` の 282〜289行は、`-NoMove` かどうかを見る前に、前の `installRoot` の下で動いているエディタを探し、あれば `editor-running` で止める（`-NoMove` は 305行以降の移す手順だけを外す）。
- 今は日常の版（`1.146.0-1` = r4）がそこで動いているので止まる。`move-off-c.test.mjs` の1件も同じ形（サンドボックスの `local.json` に前の `installRoot` を書かずに `configure.ps1 -InstallRoot …` を走らせる）。
- `node --test tests/configure.test.mjs` を単独で流し直しても、同じ1件が同じ文で落ち、ほかの16件は通った。

r6 の変更と関係しないこと:

- `scripts/configure.ps1`・`scripts/lib/local-config.ps1`・`tests/configure.test.mjs`・`tests/move-off-c.test.mjs`・`tests/build/helpers.mjs` は、作業ツリーで変わっていない（`git status --short` が空）。最後に変わったのは `e75b216`（2026-11-16 10:43）で、r6 の作業より前。

前の run-all との比べ:

| run-all | `configure.test.mjs` | `move-off-c.test.mjs` | そのときの日常の Shuko |
|---|---|---|---|
| `tasks/2026-11-16-p5-c1-product-keys/run-all-result.json`（r4 を作った回。r4 の関門と同じ日） | 17 / 17 | 26 / 26 | まだ `%LOCALAPPDATA%\Programs\Shuko` に入れていない（r4 の入れ替えは関門の合格の後。裁定 2026-11-16「版の入れ替え」） |
| `tasks/2026-11-16-move-off-c-fixes/run-all-ooka.txt`・`run-all-cao-shen*.txt`（2026-11-16） | 17 / 17 | 26 / 26 | 同上 |
| 2026-11-14〜15 の run-all（`tasks/` の `run-all-*` の全部） | どれも 17 / 17 | 25 / 25 か 17 / 17（落ちなし） | 同上 |
| 今回 `tasks/2026-11-17-r6-gate/run-all-r6.txt` | **16 / 17** | **25 / 26** | r4 が入って動いている（21のプロセス） |

コードが同じで、変わったのは「日常の Shuko が本物の `installRoot` で動いているか」だけ。2件とも、日常の Shuko を閉じて流せば通る見込み（閉じる操作は私の範囲の外なので、確かめていない）。

直すなら（曹参。急がない）: 2つのテストが、サンドボックスの `local.json` に前の `installRoot` としてサンドボックスの中の場所を書いてから `configure.ps1` を走らせる形にする（本物の `installRoot` を見ない）。今の形では、日常の Shuko を使っている間の run-all で必ず落ちる。

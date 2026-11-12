# Phase 0 の検証（3）の記録: 計測と監査の台本の手直し、台帳の台本の手直し（A-1〜A-3）

- 検証: 大岡越前守（2026-11-13。作業は日本時間 05:45〜06:00 ごろ）
- 依頼書: `brief.md`
- 対象外: 試験環境（`scripts/p0-env.ps1` など。並行する検証の2件目の担当）

## 判定

| 成果 | 判定 | 理由の要点 |
|---|---|---|
| 曹参: `scripts/measure.ps1`・`scripts/netaudit.ps1`（差し戻しの直し） | **不合格** | B-1〜B-4、VSCODE_PORTABLE、環境変数の除去は直っていた。ターミナルも開き、普段使いの `argv.json` も作られなかった。ただし、**書かれた使い方（`-File` で `-OpenFiles <TS>,<Py>`）では2つのファイルが開かない**（B-5）。docs/07 の3.2 の2を満たさないので、このまま 0-4 の基準値を取ると値が狂う。直しは小さい |
| 曹参: 単体テスト4本 | **合格** | 4本とも全部通った（88、65、79、27件）。足した `-File` 起動のテスト、VSCODE_PORTABLE と環境変数のテスト、B-4 の形の誤りのテストは中身のある確かめになっている。ただし B-5 を捕まえるテストは無い |
| 蒙恬: A-1〜A-3 | **合格** | 直し方は指摘に合っている。私の試し（試しの台帳と `--result` を tasks の下に置いた）でも、A-2 と A-3 のとおりに動いた |
| 蒙恬: A-4（ovsx 1.4.0 の固定） | **導入待ち** | `node_modules/ovsx` と lockfile が無い（ユーザーの `pnpm install` がまだ）。入っていないときに npx へ逃げず `error` になることは確かめた |

## 1. 走らせたコマンドと結果

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | `passed: 88  failed: 0` |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | `passed: 65  failed: 0` |
| `node tests/lock.test.mjs` | `tests 79  pass 79  fail 0` |
| `node tests/sublime-keys.test.mjs` | `tests 27  pass 27  fail 0` |
| `powershell ... -File scripts/measure.ps1 -EnvDir C:/b/p0/data/upstream-default -OpenFiles apps/api/src/routes/extraction.ts,local-apps/topic-clusterer/topic_clusterer/labeling.py -Label ooka-trial-upstream -Runs 1 -Warmup 0 -OutDir tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream` | 終了コード 0。`-Exe`・`-Workspace` は省いた（`p0-env.json` の Code.exe 1.146.0 と `tmp\ws` が使われた）。待ちは既定の 30/120/10 秒。15プロセス、プライベートバイト（claude を含めない）1,412.3 MiB、ワーキングセット 1,808.5 MiB、claude のプロセス 0 |
| `powershell ... -File scripts/netaudit.ps1 -EnvDir C:/b/p0/data/upstream-default -Label ooka-trial-net -DurationSeconds 60 -OutDir tasks/2026-11-13-p0-verify-measure-rework/trial/netaudit-upstream` | 終了コード 0。30サンプル、editor の宛先 8件（すべて 443、Code.exe）、claude 0件。DNS キャッシュは全スナップショットで0件（警告つき）。許可の一覧のファイルが無いので8件とも「一覧にない」 |
| `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --only tomoki1207.pdf,weixu.wx-vsce-dotenv --skip defender --result tasks/.../trial-lock/verify-result.json --write-lock tasks/.../trial-lock/lock.json` | 終了コード 1。下の4節 |

本番の5回の計測と10分の監査は行っていない。本番の `C:\b\p0\vsix\verify-result.json` と `extensions.lock.json` は書き換えていない（`--result` と `--write-lock` は tasks の下を指した）。ただし lock-verify.mjs は、走らせた2件の `C:\b\p0\vsix\<拡張>\sig\`・`files.json` を同じ中身で書き直す（蒙恬の試しと同じ）。

## 2. 曹参の台本

### 2.1 前の指摘と差し戻しの理由

| 指摘 | 結果 | 根拠 |
|---|---|---|
| B-1 `-File` 起動で `-Workspace` の既定値が落ちる | 直った | param の既定を空にし、本体で `Get-DefaultWorkspace` が決める（measure.ps1:310-315、615 行。netaudit.ps1:469 行）。私の2回の実行は `-Workspace` を省いて `tmp\ws` で動いた。`-File` で起動するテスト4件がある |
| B-2 argv.json と VSCODE_PORTABLE | 直った | `Start-EditorProcess` が子にだけ `VSCODE_PORTABLE=<写した先>\user` を与え、後で戻す。子のコマンドラインに `--lang=ja`（環境の `argv.json` の `locale: ja`）が出た。`summary.json` の `DailyArgvAfter` は `.vscode`・`.vscode-oss`・`.shuko` の3つとも `Exists: false`、`DailyArgvTouched` は空。netaudit の `destinations.json` も `DailyArgvTouched` が空 |
| 環境変数の除去（`ELECTRON_RUN_AS_NODE`・`VSCODE_*`） | 直った | claude から起動した私の実行で、Code.exe は普通に起動した。テスト2件が、子に見えないことと親に戻ることを確かめている |
| B-3 テストの「Run:」 | 直った | `tests/lock.test.mjs`・`tests/sublime-keys.test.mjs` の3行目が `node tests/<名前>.mjs` |
| B-4 `validateLockEntry` の形の誤り | 直った | `source`（数・空・null・知らない置き場）、`verified`（文字列・数・null・オブジェクト）、`engines`（数・空・版なし・オブジェクト・null）のテストがある |

### 2.2 依頼書の確認の項目（`upstream-default`・`tmp\ws`・1回）

| 項目 | 結果 | 根拠 |
|---|---|---|
| tasks.json のターミナルが開く | **開いた** | `run-1-processes.csv` に、ptyHost（PID 63532、`utility-node`）の子の `OpenConsole.exe`（conpty）と `powershell.exe -NoLogo -NoProfile`（`shell`。tasks.json の `p0-open-terminal` の引数と同じ）がある |
| 2つのファイルが開く | **開かない（B-5）** | 下の 2.3 |
| 普段使いの `argv.json` が作られない | 作られなかった | 2.1 の B-2 の行 |
| claude.exe とその子孫を分けて集計 | 正しく0件 | パネルを使っていないので `claude procs 0`、「含めた」と「含めない」の合計が同じ値。分け方の中身は単体テスト（入れ子の claude.exe も含む）が確かめている |
| 節目の計測の一時停止（読んで確認） | docs/07 の3.2 のとおり | `-Milestone` のとき、`-r` で開いた後、120秒の待ち（手順 4）の前に `Read-Host` で止まる（measure.ps1:653-655）。捨てる回も止まる。実際の一時停止は本番で行う |
| netaudit の出力の形（docs/07 の3.3） | 3.3 のとおり | 2秒ごと（60秒で30サンプル）、子孫の PID の接続だけ、DNS キャッシュは始め・30秒ごと・終わり、宛先ごとの初出・プロセス・回数（`destinations.csv`）、前回との比較（`-Previous` が無い旨を書く）、許可の一覧にない宛先の報告、claude の表を別にする。DNS が空の件は前回から既知（0-5 の実機で決める） |

### 2.3 B-5（要修正）: `-File` で `-OpenFiles a,b` と書くと、2つのファイルが開かない

- `measure-design.md` の使い方は `powershell ... -File scripts/measure.ps1 ... -OpenFiles <TSのファイル>,<Pythonのファイル>`。Windows PowerShell 5.1 の `-File` では、`a,b` は配列にならず、`"a,b"` という1つの文字列のまま `[string[]]$OpenFiles` に入る。
- 証拠:
  - 私の実行の `summary.json` の `OpenFiles` が要素1つ（`"apps/api/src/routes/extraction.ts,local-apps/topic-clusterer/topic_clusterer/labeling.py"`）。曹参の試し（`trial/out-real/summary.json`）も `"a.ts,b.py"` の1要素で、同じ状態だった。
  - そのため `Get-EditorArguments` は `-r "<ws>\apps/api/src/routes/extraction.ts,local-apps/.../labeling.py"` という、存在しない1つのパスを渡す。
  - 回のデータが消える前に拡張ホストのログ（`exthost.log`）を見た。`onLanguage:python` の起動はあった（存在しないパスの末尾が `.py` のため）。一方 `onLanguage:typescript` の起動は無かった。プロセスにも tsserver が無い（`roles.csv` に `ts-server` が無い）。TS のファイル（`tmp\ws\apps\api\src\routes\extraction.ts`）があることは確かめた。
- 影響: docs/07 の3.2 の2（決まった2つのファイルを開く）を満たさない。TS の言語サーバーが動かない分、本家の基準値が小さく出る。また、自作の側で同じ誤りが起きるかどうかで比較が狂う。0-4 の本番の前に直す必要がある。
- 直し方の案（曹参）:
  - 本体の先頭で `$OpenFiles` の各要素を `,` で分け、空を捨てる。
  - 分けた後のファイルが**2つ**あること、ワークスペース基準で**存在する**ことを確かめ、満たさなければ止める。
  - netaudit.ps1 の `-OpenFiles` も同じに直す。
  - `-File` で `-OpenFiles a.ts,b.py` と起動し、2要素に分かれて `-r` に2つのパスが並ぶことを確かめるテストを足す。例: 存在しないファイルを渡すと止まることを、終了コードと文言で確かめる。

### 2.4 軽微な点（直すのが望ましい。合否には響かない）

- B-6（曹参）: json の言語サーバー（`Code.exe ...\json-language-features\server\dist\node\jsonServerMain --node-ipc --clientProcessId=...`）が、役割 `other` になった。`Get-ProcessRole` の言語サーバーの正規表現が `.js` の拡張子を求めているため。拡張子なしの `...ServerMain` も `language-server` にする。
- B-7（曹参）: netaudit の `FirstSeenSeconds` は、サンプルの取り始めの経過秒になっている。時刻の `FirstSeen` は、取り終えた時点（`$now`）を使っている。このため、2つの値が最大でサンプル1回分ずれる。今回は始まり 05:56:06.43、最初のサンプル 05:56:08.67 で、`FirstSeenSeconds` は 0 だった。経過秒も `$now` から計算すると揃う。

## 3. 役割の判定（拡張ホスト・ptyHost・共有プロセスが区別できない件）が、3.2 の6 の目的にどれだけ響くか

- 合否への影響: **無い**。3.4 の合否は、プロセスごとの値の合計（プライベートバイト、claude を含めない）だけで決まる。役割はこの合計に使わない。
- 「重い部分を示す」目的への影響: **大きい**。今回の1回では、`utility-node` の5プロセスが 595 MiB（プライベートバイトの合計 1,412 MiB の約42%）で、一番大きい塊だった。この5つの中に、次の両方が混ざっている。
  - 削る候補の AI の部品: AgentHost（PID 54064、194 MiB。`main.log` の `[AgentHost:stderr] (node:54064)` で特定した）。子の `copilot-runtime.exe`（104 MiB）と fileWatcher も持つ。
  - 残す部品: 拡張ホスト（PID 10488、171 MiB）、ptyHost（PID 63532、82 MiB）、共有プロセスなど（残り2つ、82 MiB と 67 MiB）。
  `utility-node` の1行のままでは、Phase 2・5 で「どの単位を消したから何 MiB 減ったか」を役割の表から読めない。
- ただし、区別する手がかりは CSV に残っている（`CommandLine` と親子関係。ETW は要らない）。
  - 拡張ホスト: `CommandLine` に `--inspect-port=0`・`--dns-result-order=ipv4first` がある（1.146.0 では、5つのうちこの1つだけ）。言語サーバーの `--clientProcessId=<PID>` もこの PID を指す。
  - ptyHost: 子に `OpenConsole.exe`（conpty）とシェルを持つ。
  - AgentHost: 子に `copilot-runtime.exe` を持つ。
  - 残りの2つ（共有プロセスと、もう1つ）は、今の手がかりでは分けられない。
- 結論: 0-4 の本番を止める理由にはならない（生のデータは残るので、後から分け直せる）。Phase 2 の比較の前に、役割を付け直す処理を `New-ProcessRows` の後に足すのがよい（曹参）。付け直しの規則は「子に OpenConsole かシェル → `pty-host`、子に copilot-runtime → `agent-host`、`--inspect-port` があるか言語サーバーの `--clientProcessId` の先 → `extension-host`」。docs/07 の3.2 の6 にも「`CommandLine` と親子関係から」と書き足すのがよい（リーダー）。

## 4. 蒙恬の A-1〜A-3（と A-4）

### 4.1 直し方と指摘の対応（差分を読んだ）

| 指摘 | 直し方 | 見たこと |
|---|---|---|
| A-1 `/valid/i` が `invalid` にも一致する | `isOvsxSuccess`: 終了コード 0 で、`(^|[^A-Za-z])Signature is valid\.` に一致するときだけ真（`scripts/lib/lock.mjs:284-287`）。`checkOvsx` がこれを使う（`lock-verify.mjs:206`） | 指摘に合う。`Signature is invalid.`・`Signature is not valid.` は一致しない。蒙恬の試しで、本物の出力 `✅  Signature is valid.` は通った（`C:\b\p0\trial\verify-result.json` の pdf）。ovsx が入っていないので、新しい起動の形（`node bin/ovsx`）での実際の出力は私は見ていない（A-4 の後で要確認） |
| A-2 `--skip` で必須の項目を飛ばしても ok・終了コード 0 | `judgeChecks`: 必須の項目の skip を `skipped` に入れ、`failed` と `skipped` の両方が空のときだけ ok（`lock.mjs:293-300`。`lock-verify.mjs:542-545`）。`results.some(!ok)` で終了コード 1 | 指摘に合う。私の試しで、2件とも `skipped: ["defender"]`・`failed: ["ovsx"]`・`ok: false`、画面に「必須の項目を飛ばした: defender」、終了コード 1 |
| A-3 `--write-lock` が通らない行も台帳に書く | `mergeLock`: ok の行だけ新しい値で書く。通らない行は、今の台帳に同じ ID があれば残し、無ければ書かない。検証に無い行は後ろに残す。書けなかった行があれば終了コード 1（`lock.mjs:307-337`。`lock-verify.mjs:657-684`） | 前の検証で挙げた2案の1つ（通らない行は書かない）を、「今の行を残す」形に広げた。docs/04 の2節（台帳に載せる版は検証を通したもの）に合う。私の試し: 試しの台帳（`TOMOKI1207.PDF` の印つきの行と、`ooka.not-in-fetch` の行）に対して、pdf は「今の台帳の行を残した」（ID の大文字小文字を問わず一致し、中身はそのまま）。dotenv ほか8件は「書かなかった」、`ooka.not-in-fetch` は「そのまま残した」。`verify-result.json` に `lockWrite` が残る |

### 4.2 A-4

- `package.json` に `"ovsx": "1.4.0"`（`^` なし）。裁定（`docs/user-decisions.md` 114行）に合う。`.gitignore` に `node_modules/` がある。
- `node_modules/ovsx/package.json`・`pnpm-lock.yaml`・`package-lock.json` が無い。そのため **導入待ち**。
- 入っていないときの動き: 私の試しで、ovsx は `status: "error"`、`declared: "1.4.0"`、`installed: null`、理由は「node_modules に入っていない…npx で別の版は取りに行かない」。npx は呼ばれなかった。`checkPinnedTool` は `x.y.z` 以外（`^`・`~`・範囲・タグ）と、版の違いを拒む。
- 導入の後に、依頼書の3のコマンド（`--result` を tasks の下に）で、ovsx の項目が `pass`・`ovsxVersion: "1.4.0"` になるかを確かめる必要がある。

### 4.3 気づいた点（合否には響かない。取り込みを自動にする前に）

- O-1（蒙恬・リーダー）: `--only` で走らせると、ほかの拡張の結果は前の `verify-result.json` からそのまま使われる（`lock-verify.mjs:625-628`）。`--write-lock` は、それらを判定し直さずに「新しく書いた」とする。今の本番の結果は、前の判定（npx の版を固定しない ovsx）で出したもの。そのため、Claude Code だけを `--only` で走らせ直すと、ほかの8件は固定していない ovsx の結果のまま台帳に書かれる。ovsx の導入の後は、`--only` を付けずに9件とも走らせ直すのがよい（今の本番の結果に skip は無いので、A-2 の抜け道にはならない）。
- O-2（蒙恬・リーダー）: A-3 の「今の行を残す」は、今の行が検証を通ったものであることを前提にしている。今の `extensions.lock.json` の Claude Code の行は、前の台本が書いた `checks.soak: "fail"` の行で、検証を通っていない。走らせ直しでまた通らなければ、この行が残る。走らせ直しで通ることを確かめるか、入れる側（`install-extensions.mjs`）で `checks` に `pass` 以外がある行を拒むことを約束にする。
- O-3（リーダー → 曹参）: 新しい純粋な関数4つ（`isOvsxSuccess`・`judgeChecks`・`mergeLock`・`checkPinnedTool`）には、まだ曹参のテストが無い（`tests/lock.test.mjs` に出てこない）。蒙恬の handoff-notes に約束の形が書いてあるので、曹参に依頼するのがよい。

## 5. ついでに見えたこと（対象外。報告だけ）

- `upstream-default` で `detachhead.basedpyright` の起動が失敗していた（`exthost.log`: `Activating extension detachhead.basedpyright failed due to an error: ... at Object.api (...\dist\extension.js:1:221)`）。開いた「Python のファイル」が B-5 による存在しないパスだったためかは、切り分けていない。B-5 を直した後の計測で、もう一度見る必要がある（0-2・0-4 に関わる）。
- AgentHost（`AgentHostProcessManager: agent host started`）が、本家の既定のまま動いている。copilot-runtime はこの子。0-4・0-5 の材料になる。

## 6. 直すべき点（担当つき）

### 曹参

- **B-5（要修正。直れば台本は合格にできる）**: `-OpenFiles` の `,` 区切りを本体で分け、2つあり存在することを確かめる（measure.ps1・netaudit.ps1）。`-File` で起動するテストを足す。`measure-design.md`・`netaudit-design.md` の試しの記述（`a.ts,b.py` で開いたとする箇所）も直す。
- B-6（軽微）: 拡張子なしの `...ServerMain` を `language-server` にする。
- B-7（軽微）: `FirstSeenSeconds` を `$now` から計算する。
- 役割の付け直し（3節。Phase 2 の比較の前に）。
- O-3: 蒙恬の新しい関数4つのテスト（リーダーの依頼があれば）。

### 蒙恬

- A-4: ovsx の導入の後に、実際の起動（`node bin/ovsx`）で `Signature is valid.` が通ることを確かめる（私が依頼書の3のコマンドで見てもよい）。
- O-1・O-2 は、リーダーの判断で次の手直しに入れる。

### リーダー

- B-5 の差し戻し。直った版で、私が同じ1回の試しをもう一度行う（2つのファイルが開くかを `exthost.log` の `onLanguage:typescript` と tsserver のプロセスで見る）。
- ovsx の導入（ユーザーの `pnpm install`）の後に A-4 の確認を依頼する。その後、Claude Code の走らせ直しは `--only` なしで9件とも行う（O-1）。
- docs/07 の3.2 の1（VSCODE_PORTABLE と環境変数の除去）と6（役割は親子関係からも付ける）の書き足し（曹参の `doc-corrections.md` の4）。

## 7. 書いたもの

- `tasks/2026-11-13-p0-verify-measure-rework/verification-log.md`（この記録）
- `tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream/`（measure.ps1 の1回の出力: `runs.csv`・`run-1-processes.csv`・`processes-all.csv`・`roles.csv`・`summary.*`・`defaults-changed.md`・`env-template/`・`pc-state.json`）
- `tasks/2026-11-13-p0-verify-measure-rework/trial/netaudit-upstream/`（netaudit.ps1 の60秒の出力: `audit.md`・`destinations.*`・`samples.csv`・`dns-cache.csv`）
- `tasks/2026-11-13-p0-verify-measure-rework/trial-lock/lock.json`・`verify-result.json`（A-2・A-3 の試し）
- 回のデータ（`C:\b\p0\run\ooka-trial-*`）は台本が消した（残っていないことを確かめた）

# 引き継ぎ（大岡越前守 → ヴラド・ツェペシュ）: Phase 0 の検証（3）

フックが SubagentHandback を止めた（定義の tools に無い）。そのため、報告はこの文書に書く。詳しい記録は `verification-log.md`。最初の判定のあとに再確認を行い、その結果を末尾の「追記」に書いた。**判定は追記のほうが新しい。**

## 判定（最初の確認。追記で更新した）

- **曹参の台本（measure.ps1・netaudit.ps1）: 不合格。** 直すところは1つで、小さな修正で済む（B-5）。
- **曹参の単体テスト4本: 合格。** 88、65、79、27件がすべて通った。
- **蒙恬の A-1〜A-3: 合格。**
- **蒙恬の A-4: 導入待ち。** `node_modules/ovsx` と lockfile がまだ無い。

## 台本が不合格の理由（B-5、要修正、曹参）

書かれた使い方の `-File ... -OpenFiles <TS>,<Py>` では、2つのファイルが開かない。

- Windows PowerShell 5.1 の `-File` では `a,b` が配列にならず、`"a,b"` という1つの文字列になる。
- その結果 `-r` に、存在しない1つのパスが渡る。
- 私の実行の `summary.json` の `OpenFiles` は1要素だった。曹参の試し（`trial/out-real`）も `"a.ts,b.py"` の1要素で、同じ状態だった。
- 回のデータが消える前に `exthost.log` を見た。`onLanguage:python`（パスの末尾が .py のため）はあったが、`onLanguage:typescript` は無く、tsserver のプロセスも無かった。TS のファイル自体は `tmp\ws` にあることを確かめた。

docs/07 の3.2 の2を満たさず、このままでは 0-4 の基準値が小さく出る。

**直し方の案:**

- 本体で `,` を区切りとして分ける。
- 2つあること、存在することを確かめ、満たさなければ止める。
- netaudit も同じように直す。
- `-File` で起動するテストを足す。
- measure-design.md・netaudit-design.md の試しの記述も直す。

## そのほかは確かめられた

- **B-1:** `-File` 起動で `-Workspace` を省いても、`tmp\ws` で動いた。
- **B-2:** VSCODE_PORTABLE で環境の argv.json が効いた（子のコマンドラインに `--lang=ja`）。普段使いの argv.json は3つとも作られず、`DailyArgvTouched` は空だった。
- **環境変数の除去:** claude から起動しても Code.exe は普通に起動した。
- **B-3・B-4:** どちらも直っていた。
- **ターミナル:** tasks.json のタスクで開いた。ptyHost の子に `OpenConsole.exe` と `powershell.exe -NoLogo -NoProfile` がある。
- **claude.exe の分離:** パネルを使っていないので0件で、「含めた」と「含めない」の合計が同じ値になった。
- **節目の一時停止:** `-r` の後、120秒の待ちの前に `Read-Host` で止まる。docs/07 の3.2 のとおり（読んで確認。実際の一時停止は本番で）。
- **netaudit の出力:** 60秒で30サンプル、宛先8件、claude の表は別で、docs/07 の3.3 の形どおり。DNS キャッシュが空になる件は前回から既知。
- **軽微（曹参、合否には響かない）:**
  - B-6: json の言語サーバー `jsonServerMain` が役割 `other` になる（正規表現が `.js` を求めるため）。
  - B-7: netaudit の `FirstSeenSeconds` が取り始めの時刻を基準にしていて、最大でサンプル1回分ずれる。

## 役割を区別できない件の影響（依頼書の2）

- **合否には響かない。** 3.4 は合計だけで決まる。
- **「重い部分を示す」目的には大きく響く。** 今回の1回では、`utility-node` の5プロセスが 595 MiB で、合計 1,412 MiB の約42%を占めた。この中に、削る候補の AgentHost（194 MiB、子に copilot-runtime 104 MiB）と、残す部品が混ざっている。
  - 拡張ホスト: 171 MiB
  - ptyHost: 82 MiB
  - 残りの2つ: 82 MiB と 67 MiB
- **手がかりは CSV に残っているので、0-4 は止めなくてよい。**
  - 拡張ホストは `--inspect-port=0` で分かる。
  - ptyHost は子の OpenConsole とシェルで分かる。
  - AgentHost は子の copilot-runtime で分かる。
- Phase 2 の比較の前に、役割を付け直す処理を足すことを勧める（曹参）。docs/07 の3.2 の6への書き足しも勧める（リーダー）。

## 蒙恬の A-1〜A-3（差分と試し）

試しは、tasks の下に置いた台帳と `--result`、`--only pdf,dotenv --skip defender` で行った。

- **A-1:** `isOvsxSuccess` は、終了コード 0 で `Signature is valid.` があるときだけ通す。指摘に合う。
- **A-2:** 飛ばした defender は `skipped` に、ovsx は `failed` に入り、`ok: false`、終了コード 1 になった。
- **A-3:** `mergeLock` が次のとおり動いた。
  - 今の台帳の行がある pdf は、ID の大文字小文字を問わずそのまま残した。
  - 今の台帳に無い行は書かなかった。
  - 検証に無い行は後ろに残した。
  - `lockWrite` が記録された。
- **A-4:** 入っていないときは npx を呼ばず `error` になった（`declared: 1.4.0`、`installed: null`）。導入後の実際の起動（`node bin/ovsx`）はまだ確かめていない。

## 気づいた点（合否には響かない）

- **O-1:** `--only` で走らせると、ほかの拡張は前の結果を判定し直さずに台帳へ書く。ovsx を導入したら、Claude Code の走らせ直しは `--only` なしで9件とも行うことを勧める。
- **O-2:** 今の台帳の Claude Code の行は `soak: fail`（前の台本が書いたもの）。走らせ直しでまた通らなければ、この行がそのまま残る。
- **O-3:** 新しい関数4つ（`isOvsxSuccess`・`judgeChecks`・`mergeLock`・`checkPinnedTool`）のテストがまだ無い。曹参への依頼を勧める。
- **対象外:** upstream-default で basedpyright の起動が失敗していた。B-5 のせいかは切り分けていない。

## 守ったこと

- 本番の5回の計測と10分の監査は行っていない。
- 本番の verify-result.json と extensions.lock.json は書き換えていない。
- lock-verify は、走らせた2件の `C:\b\p0\vsix\<拡張>\sig\` と files.json を同じ中身で書き直す。
- 回のデータ（`C:\b\p0\run\ooka-trial-*`）は台本が消した。
- コードは直していない。

## 次の手

- B-5 を曹参に差し戻す。直った版で、私が同じ1回の試しをもう一度行う。
- `pnpm install` の後に、A-4 の確認を私に依頼する。

## 記録

- `tasks/2026-11-13-p0-verify-measure-rework/verification-log.md`
- `tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream/`
- `tasks/2026-11-13-p0-verify-measure-rework/trial/netaudit-upstream/`
- `tasks/2026-11-13-p0-verify-measure-rework/trial-lock/`（lock.json・verify-result.json）

---

## 追記（2026-11-13 06:30 ごろ）: 再差し戻し（B-5・役割の付け直し・B-6・B-7・O-3）の再確認

リーダーの連絡を受けて確かめた。対象は、曹参の `tasks/2026-11-13-p0-measure-netaudit-tests/handoff-notes.md` の「追記: 再差し戻し…への対応」。起動したのは upstream-default だけで、p0-stop.ps1 は使っていない。

### 判定（新しい）

| 成果 | 判定 |
|---|---|
| 曹参の台本（measure.ps1・netaudit.ps1） | **合格**。B-5 は直った。ただし推定の役割に印が無い点（C-1）を、Phase 2 の比較の前に直すこと |
| 曹参の単体テスト4本（O-3 を含む） | **合格** |
| 蒙恬の A-1〜A-3 | 合格（変わらず） |
| 蒙恬の A-4 | 導入待ち（変わらず） |

合格にした理由: 0-4 の合否に使う合計（docs/07 の3.4）と、3.2 の手順1〜8は満たした。C-1 は役割の表示の問題で、合計には響かない。生の CSV（PID・親・CommandLine）も残る。

### 1. テスト4本

| コマンド | 結果 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | `passed: 114  failed: 0` |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | `passed: 67  failed: 0` |
| `node tests/lock.test.mjs` | `tests 115  pass 115  fail 0` |
| `node tests/sublime-keys.test.mjs` | `tests 50  pass 50  fail 0` |

申告（114・67・115・50）と一致した。

### 2. 2つのファイルが1つずつ開き、tsserver が出るか（upstream-default・tmp\ws・各1回、`-Runs 1 -Warmup 0`、待ちは既定）

| 起動の形 | 開いたファイル（summary.md） | TS | Python | プロセス | 普段使いの argv.json |
|---|---|---|---|---|---|
| `-File` で `-OpenFiles "apps/api/src/routes/extraction.ts,local-apps/topic-clusterer/topic_clusterer/labeling.py"`（`trial/measure-upstream-2-given/`） | 2つのフルパス（`tmp\ws\...\extraction.ts`、`tmp\ws\...\labeling.py`） | `exthost.log` 06:19:19.746 `onLanguage:typescript`、`TypeScript.log` 06:19:19.979 `Starting TS Server`、ts-server のプロセス3つ | 06:19:31.941 `onLanguage:python`（TS の約12秒後。10秒の間をあけた1つずつの開き方のとおり） | 18、プライベートバイト（claude を含めない）1,796.2 MiB | 作られなかった |
| `-OpenFiles` を省いた（`trial/measure-upstream-2-default/`） | 同じ2つ（`C:\b\p0\ws-info.json` の `openFilesFull`） | ts-server のプロセス3つ（`roles.csv`） | ログは回のデータと一緒に消えたため見ていない。開く処理は上と同じ関数で、2つ目も渡っている（summary.md） | 1,804.3 MiB | 作られなかった |

- B-5 は直った。前回は1要素で TS が開かず、1,412 MiB だった。今回は約 1.8 GiB で、tsserver の3つ（約 218 MiB）が加わった。
- docs/07 の3.2 の2「CLI（`-r`）で2つのファイルを開く」との違い: 1回の `-r` で2つを渡すと、背景のタブの言語が有効にならない（曹参の発見）。そのため、1つずつ10秒あけて開くようにした。手順の意図に合う直しだが、docs に書き足す必要がある（リーダー。曹参の doc-corrections に入れさせる）。

### 3. 役割の付け直し（Get-RoleMap）は実物で支えられるか

`trial/measure-upstream-2-given/run-1-processes.csv` を、同じ回のログの PID と照らした。

| 付けた役割 | CSV の手がかり | ログでの裏づけ | 判定 |
|---|---|---|---|
| extension-host（PID 82260） | `--inspect-port=0`。子に ts-server 3つと json の language-server | `renderer.log`「Started local extension host with pid 82260」、`exthost.log`「Extension host with pid 82260 started」 | 支えられる |
| agent-host（PID 3652） | 子に copilot-runtime.exe と file-watcher | `main.log`「[AgentHost:stderr] (node:3652)」、「AgentHostProcessManager: agent host started」 | 支えられる |
| pty-host（PID 2348） | 子に OpenConsole.exe と `powershell.exe -NoLogo -NoProfile` | ptyHost のログに PID は出ない。子の形（conpty とタスクのシェル）が強い手がかり | 支えられる |
| language-server（json、B-6） | `jsonServerMain --node-ipc --clientProcessId=82260` | 親が拡張ホスト | 直った |
| shared-process（推定） | 「子が file-watcher だけ」の utility-node | **実物では一度も当てはまっていない。** 私の3回と曹参の out-real4 では、file-watcher はいつも AgentHost の子で、AgentHost が先に決まる | 根拠が無い |

- 残りの utility-node 2つ（今回 86 MiB と 69 MiB）は手がかりなしのまま。名前を付けずに残しているのは正しい。
- **C-1（要修正。Phase 2 の比較の前に、曹参）:** 推定の役割が、推定と分かる形で残らない。CSV と roles.csv の `Role` 列には、コマンドラインから付けた `shared-process`（measure.ps1:63）と同じ文字列が入る。「推定」は関数のコメント（measure.ps1:107）にしかない。`shared-process?` のように名前を分けるか、`RoleSource`（commandline / child / inferred）の列を足して、CSV を見る人に分かるようにすること。あわせて、この規則の根拠（file-watcher だけを子に持つ utility-node が共有プロセスであること）は実物で確かめていないので、design 資料に「未確認」と書く。
- 第1段の役割は、`--inspect-port=0` が子の手がかりより優先される。agent-host の判定も、子に file-watcher があっても copilot-runtime が優先される。どちらもテストがある（measure.tests.ps1 の role map の10件）。

### 4. O-3 の lock のテスト

`tests/lock.test.mjs` に36件ある。中身のある確かめになっている。
- `isOvsxSuccess`: 本物の出力、`invalid`、終了コードが 0 でない、空・非文字列、直前が英字（`Signature isvalid.`・`xSignature is valid.`）
- `judgeChecks`: skip は failed でなく skipped に入り、ok にならない。fail・error・未知の status・欠けは failed。順は required の順
- `mergeLock`: written・kept・omitted・untouched の各分かれ、ID の大文字小文字、重複は最初、entry が非オブジェクト、current の非オブジェクトを捨てる、引数を変えない、試しの実例
- `checkPinnedTool`: `^`・`~`・`>=`・`latest`・空・`1.4`・`1`・`*` を拒む。installed が null・undefined・空、版の違い、declared の欠け

どれも期待値を具体的に照らしており、常に通るテストではない。

### 5. B-7（読んで確認）

netaudit.ps1:507-508 で、起動の直前に `$t0` を取る。各サンプルの経過秒は、接続を読んだ後の `$now` から計算する（532-535 行）。指摘に合う。曹参の `trial/net-real2/destinations.csv` で、最初の宛先は 4.4 秒（前回は 0 秒）。netaudit は今回、私は走らせていない（依頼の範囲外）。

### 6. basedpyright の起動の失敗（事実だけ）

- `exthost.log`（`trial/measure-upstream-2-given` の回）:
  - 06:19:31.941 `ExtensionService#_doActivateExtension detachhead.basedpyright, startup: false, activationEvent: 'onLanguage:python'`
  - 06:19:31.975 `Activating extension detachhead.basedpyright failed due to an error:`
  - `Error: Python extension is not installed or is disabled`
  - `at Object.api (...\ext\detachhead.basedpyright-1.40.2\dist\extension.js:1:221)`
- エラーを出しているのは basedpyright 自身のコード（`dist/extension.js` の `api`）。台本のコードではない。
- 有効化のきっかけは、実在する `labeling.py` を開いたこと（`onLanguage:python`）で、正しく起きている。
- 環境のひな形 `C:\b\p0\data\upstream-default\ext\` に `ms-python.*` は無い（入っているのは台帳の9件）。basedpyright 1.40.2 の `package.json` に `extensionDependencies`・`ms-python` の記述は無い（宣言なしで、有効化のときに求める）。
- 前回（B-5 の前）の失敗も、同じ場所（`extension.js:1:221`）で起きていた。そのため、台本の開き方が原因ではない。

### 7. ついでに見えたこと

- 曹参の試しの回のデータ `C:\b\p0\run\trial-real3-run-1\`・`trial-real4-run-1\` が消えずに残っている（`-KeepData` か途中の停止によるものと思われる）。私の2回の回のデータは台本が消した。0-4 の本番の前に消しておくのがよい（曹参か蒙恬。私の権限では消せない）。
- `upstream-default` のひな形は 05:59 に作り直されていた（`p0-env.json` の `createdAt` が `2026-11-13T05:59:12`）。今回の2回は作り直した後のひな形で測っている。

### 8. 次の手

- リーダー: 台本は 0-4・0-5 の本番に使える。C-1 は Phase 2 の比較の前に曹参へ。docs/07 の3.2 の2（1つずつ開く）と6（親子関係から役割を付ける。推定は印つき）の書き足し。
- Python 拡張を台帳に足すかの裁定（曹参の残った課題）が、0-4 の本番より先に要る。足すなら、ひな形に入れてから測る。
- `pnpm install` の後に、A-4 の確認を私に依頼する（変わらず）。

### 9. 追記で書いたもの

- `tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream-2-given/`（`-OpenFiles "a,b"` の1回）
- `tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream-2-default/`（`-OpenFiles` を省いた1回）
- この追記

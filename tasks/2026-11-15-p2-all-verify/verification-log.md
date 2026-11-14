# 検証の記録: Phase 2 の締め（全部を有効にした版 `1.146.0-p2-all`）

- 検証: 大岡越前守、2026-11-15（JST 00:50〜01:10 ごろ）
- 依頼: `brief.md`（このフォルダ）
- 相手: `C:\b\dist\1.146.0-p2-all.zip` を展開した `C:\b\p2\1.146.0-p2-all\Shuko-win32-x64-1.146.0-p2-all\`（蒙恬の成果。`tasks/2026-11-15-p2-all-build/`）
- 比べる相手: `-r2` の B-7 の版（`records/take-in/1.146.0-p2-B-7-r2/`、基準 `C:\b\smoke\baseline-p2-B-7-r2.json`）と、公式の基準 `C:\b\smoke\baseline-official-1.146.0.json`（本家 1.146.0 の3回の和）

## 判定

| brief | 結果 | 要点 |
|---|---|---|
| 1. 当てたもの | **合格** | 14単位が当たり、C の7単位は `disabled` で外れた。B-7-r2 の版とのソースの差は無いと見てよい（git での比べは蒙恬の記録による。私は出力で裏を取った。1節） |
| 2. スモークの全部の組 | **合格** | 3回とも、FAIL は公式の基準と比べた回の既知の1種だけ。3回の和の基準は鍵4個で、B-7-r2 の基準と同じ。claude-code・languages の組は3回とも全部 PASS |
| 3. 消えている | **合格** | 14単位を `--expect absent`: fail 0・unknown 0（12単位・57項目）。A-6・B-6 は起動して見る項目が無い（ほかの方法で見た） |
| 4. 通信の監査 | **合格** | 2通り×600秒。エディタの宛先 0、claude の宛先 0、許可の外 0。残るのは `wpad` の名前の問い合わせ（答え・接続なし）だけ。Claude の宛先はユーザーの手の回で確定させる |
| 5. 記録 | **済み** | `records/phase2/phase2-close.md`（結び）、`records/phase2/manual-checks-p2-all.md`（手の項目） |

## 1. 当てたもの

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum C:/b/dist/1.146.0-p2-all.zip` | `15aa0ce75ead4e7455cfe4f40557f62c2b56b4822151319271e30916e3081f6f`。handoff-notes と一致 |
| product.json の commit | 展開した `resources\app\product.json` の126行 | `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`。checks.json の `headCommit` と同じ |
| 当てた単位 | `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/checks.json` | `options.only: null`。`units` は A-1〜A-7・B-1〜B-7 の14で、すべて `enabled: true`・`applied: ok`、edits の衝突なし。`unitsSkipped` は C-1〜C-7（`reason: "disabled"`）。`result: ok`、`errors: []`、`warnings: []`。absentStrings は全項目 `hitCount: 0`、remnants・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity は ok |
| `unit.json` の状態 | `removals/*/unit.json` の `enabled`、`git show --stat be77bef` | A・B の14が true、C の7が false。be77bef で変わった unit.json は B-1・B-2・B-3・B-4・B-7 の各1行だけ。作業ツリーに未コミットの変更なし（`git status --short removals` が空） |
| 単位の定義の検査 | `node --test tests/removals.test.mjs` | 229件、pass 222・fail 0・skip 7（C の7単位の「有効の単位の after」の項。無効なので飛ばすのが正しい） |
| B-7-r2 とのロックファイルの差 | `sha256sum` で両方の `lockfile.diff` | どちらも `672b86f2…e6f8`。同じ |
| B-7-r2 との checks.json の差 | 両方の `checks.json` を読み比べた | `options.only` の配列（B-7-r2 は14の id）と、C の `reason`（`not in --only` → `disabled`）だけが違う。`errors` の行が 2430 → 2415 で、ずれは `only` の配列の15行分。commit の値は日時のために違う |
| 出力の中身 | `sha256sum` で、両方の版の出力のファイル4つ | `out/main.js` と `extensions/mydist/package.json` は同じ。`workbench.desktop.main.js` と `extensionHostProcess.js` は違うが、どちらも中に commit を持ち（Grep で `d5fd4c3a` を見た）、拡張ホストの方はビルドの日時も持つ。違いはこれで説明がつく（全体の一致までは見ていない） |

ソースの差（`git -C C:/b/wt/p2 diff --quiet builds/1.146.0-p2-B-7-r2 builds/1.146.0-p2-all`）は流していない。私の許可にあるのは、このリポジトリで動く `git diff` で、`git -C` は無いため。上の3つ（ロックファイルの差が同じ、checks.json の違いが選び方だけ、出力の違いが埋め込みの commit と日時で説明がつく）で、蒙恬の記録（終了コード 0、`--stat` も空）と食い違わないことを確かめた。

## 2. スモークの全部の組

docs/06 の5節のとおり、基準は `--prime --save-baseline` の1回と、`--merge-baseline` を足した2回で作った（`--prime` は3回ともそろえた）。比べる相手は、1回目と3回目を B-7-r2、2回目を公式の基準にした。

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all --label p2-all-1 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-7-r2.json --save-baseline C:/b/smoke/baseline-p2-all.json --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all --label p2-all-2 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --save-baseline C:/b/smoke/baseline-p2-all.json --merge-baseline --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all --label p2-all-3 --mode built --prime --baseline C:/b/smoke/baseline-p2-B-7-r2.json --save-baseline C:/b/smoke/baseline-p2-all.json --merge-baseline --timeout 300 --keep-runs 40
```

| 回 | 置き場所（`.keep` を置いた） | 比べた基準 | 結果 | 誤り（種類） |
|---|---|---|---|---|
| 1 | `C:\b\smoke\runs\p2-all-1-20261114T155300\` | B-7-r2 | PASS 49 / FAIL 0 / INFO 9。errors.new「新しい誤りなし」 | other 2・renderer 2（3種） |
| 2 | `C:\b\smoke\runs\p2-all-2-20261114T155448\` | 公式 | PASS 48 / FAIL 1 / INFO 9。FAIL は errors.new の `tunnelApplicationConfig` ×2（下） | other 2・renderer 2（3種） |
| 3 | `C:\b\smoke\runs\p2-all-3-20261114T155620\` | B-7-r2 | PASS 49 / FAIL 0 / INFO 9。errors.new「新しい誤りなし」 | exthost 1・other 2・renderer 2（4種） |

- 3回の和 `C:\b\smoke\baseline-p2-all.json`: `runs: 3`、鍵4個。`tunnelApplicationConfig`・`TextModel got disposed before DiffEditorWidget model got reset`・`DEP0169 url.parse()` が3回、`Remote Control auto-enable failed` が1回。**鍵の集まりは B-7-r2 の基準の4個と同じ**。
- 公式の基準（鍵4個）と比べた差:
  - 公式に無く、この版にある2種: `tunnelApplicationConfig`（Code - OSS の product.json にトンネルの設定が無い。Phase 1 から）と `Remote Control auto-enable failed`（Claude Code が `claude.exe` を起動した回だけ出る。Phase 1 の r3 と A-1 の関門で仕分け済み。B-7-r2 の基準にもある）。どちらも前の関門で理由つきで受け入れたもので、この版で新しく出たものではない。
  - 公式にあり、この版に無い2種: `No bundle location found for extension TypeScriptTeam.jsts-chat-features` と `[AgentHostCustomizationMarketplace] …`。この版では3回とも出なかった（本家の AI に関わる部品の誤りと見られる。推定）。
- 組ごと: 2回目の FAIL は errors.new の1項目だけで、ほかの項目は3回とも PASS（INFO を除く）。claude-code の3項目（`claude.running`・`claude.exthost-log`・`claude.lock`）は3回とも PASS（Claude Code 2.1.322）。languages の14項目は3回とも PASS（ほかに INFO の `lang.env.compare`）。1回目と3回目のコマンドの数は 3211 で、B-7-r2 と同じ。
- `safety.daily-argv`（普段使いの `argv.json` が変わらない）と `safety.process-tree`（止めた後に残るプロセス 0）も3回とも PASS。

判定: 前の版（B-7-r2）に無い誤りは無い。公式の基準に無い2種は既知で、理由つきで受け入れ済み。よって合格。

## 3. 消えている

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all --units A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest --expect absent --label p2-all-14
```

- 網: runtime（コマンド 2798 件・設定 23 件を照会）＋ manifest（拡張 65 件の package.json）。結果は `C:\b\smoke\absent\p2-all-14-20261114T155501\absent-result.json`。
- A-1 3・A-2 7・A-3 1・A-4 3・A-5 3・A-7 9・B-1 2・B-2 8・B-3 4・B-4 7・B-5 6・B-7 4、すべて pass で fail 0・unknown 0。数は B-7-r2 の関門の「段階 A・B の全部」と同じ。
- 起動して見る項目を持たない単位:
  - A-6: 出力の `resources\app\extensions\theme-*` は `theme-defaults` と `theme-seti` の2つだけ。消した10個は無い。
  - B-6: absentStrings（checks.json で 0 件）と absentHosts（4節で接続なし）だけ。product.json に `emergencyAlertUrl` は無い（`updateUrl`・`extensionsGallery`・`tasConfig`・`reportIssueUrl` も無い。Grep で 0 件）。
- absentStrings は checks.json で全項目 0 件（1節）。absentHosts は4節。

## 4. 通信の監査

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2-all -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2gate-B-6-r2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all/Shuko.exe -EnvDir C:/b/p0/data/upstream-default -Label p2-all-ledger -DurationSeconds 600 -Previous records/network-audits/2026-11-13-p05-upstream-default
```

2通りにした理由: 関門の監査に使ってきた環境（`netaudit-env`）は、拡張を入れず、ユーザー設定でテレメトリと実験を入れたもの。消した部品が残っていれば宛先に出るので、その確かめには向く。ただ、「使ったとき」の監査としては、台帳の拡張が入っていない点が足りない。そこで、0-5 で本家を測った upstream-default（台帳の拡張と言語パック。信頼を切り、自動のタスクを入れた設定）でも流し、本家の同じ環境の結果と比べた。

| 監査 | 記録 | エディタの宛先 | claude の宛先 | 許可の外 | 前の一覧に無い | 名前で見えたもの |
|---|---|---|---|---|---|---|
| p2-all（関門と同じ環境） | `records/network-audits/2026-11-15-p2-all/` | 0 | 0 | 0 | 0（B-6-r2 と比べて） | `wpad` の解決2回（答えなし・接続なし）だけ |
| p2-all-ledger（台帳の拡張あり） | `records/network-audits/2026-11-15-p2-all-ledger/` | 0 | 0 | 0 | 0（本家の upstream-default と比べて） | 同上 |

- 2つとも 300 回の取得、ネットのログは complete（76 件）、`Get-DnsClientCache` は空（この PC ではいつもそう）。
- 本家の同じ環境（0-5 の upstream-default）で見えた7宛先（`default.exp-tas.com`、`main.vscode-cdn.net`・`update.code.visualstudio.com`、`mobile.events.data.microsoft.com`、`marketplace.visualstudio.com`、GitHub と Copilot の名前の付かないアドレス3つ）は、どれも無い。名前の一覧（ネットのログと Node の問い合わせ）にも出ない。
- 単位の absentHosts（B-1 `mobile.events.data.microsoft.com`、B-2 `default.exp-tas.com`、B-6 `main.vscode-cdn.net`）: 2つとも、接続も名前の問い合わせも無い。
- ledger の環境には、台帳に無い `dotenv.dotenv-vscode` 1.5.8 が入っている（0-5 のときのまま）。この版では `extensions.allowed`（`"*": false`）で外れるはずだが、外れたことは今回見ていない。宛先が0件なので、結果には響いていない。
- 残るもの:
  - `wpad`（ポート 80）: Chromium のプロキシの自動検出の名前の問い合わせ。手元のネットワークへの問い合わせで、答えも接続も無い。0-5 で「止め方は未確認」とした項目。社外への接続ではないので許可の一覧には入れず、残る点として結びに書いた。
  - Claude の宛先: 今回は Claude Code のパネルから送信していない（brief と裁定 2026-11-13）。claude の表が空なのはそのため。ユーザーが手の項目の 10〜14 を監査の中で行う手順を、`records/phase2/manual-checks-p2-all.md` の後半に書いた。
  - 監査の限界（UDP・2秒より短い接続・管理者の権限が要る名前の取得・操作で起きる通信）は docs/07 の3.3 のとおりで、変わらない。

## 5. ほかに流したもの

| コマンド | 結果 |
|---|---|
| `node --test tests/smoke.test.mjs tests/absent.test.mjs` | 95 pass / 0 fail |
| `node --test tests/lock.test.mjs` | 115 pass / 0 fail |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1` | passed 102 / failed 0 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1` | passed 138 / failed 0 |
| `node tests/smoke-stop.mjs --mark-keep <置き場所>` ×3 | 3回分の実行の置き場所に `.keep` を置いた（記録の根拠なので、`--keep-runs` の掃除で消えない） |

## 6. 守ったこと・気づいたこと

- コード・テスト・台本・docs/ は直していない。書いたのは `records/phase2/`・このフォルダと、台本が書く `C:\b\smoke\`・`C:\b\p0\run\`（監査の後に台本が消す）・`C:\b\p0\netlog\`・`records/network-audits/`。
- 普段使いのデータ: スモークの `safety.daily-argv` が3回とも PASS。PC の設定は変えていない。Claude Code のパネルからの送信はしていない。
- C: の空き: **測れていない**。空きを数える `scripts/disk-usage.mjs` は私の許可に無く、ほかの手段も無い。今回増えたのは、スモークの3回分（`C:\b\smoke\runs\p2-all-{1,2,3}-*` と `C:\b\smoke\ext\1.146.0-p2-all-{1,2,3}\`）、`C:\b\smoke\absent\p2-all-14-*`、`C:\b\p0\netlog\p2-all*`。ビルドの終わりの 21.33 GB からの減りは1 GB 前後と見ている（推定）。
- 気づいた点（推定）: `C:\b\smoke\ext\` に、ラベルごとの拡張のフォルダが43個たまっている。蒙恬が「ほかの場所で 5.1 GB 減った」とした分の多くは、これと見られる（測っていない）。消してよいかはリーダーの判断。

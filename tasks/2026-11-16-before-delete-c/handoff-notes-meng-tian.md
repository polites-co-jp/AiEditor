# 蒙恬の引き継ぎ: C:\b を消す前の確かめ（v2-2 の条件）

- 依頼: `tasks/2026-11-16-before-delete-c/brief.md` の「やること（蒙恬）」1〜5
- 作成: 蒙恬（2026-11-16）。時刻は UTC（JST は +9 時間）
- 結果: **一部完了**。2〜5 は済んだ。1（枝の取り込み）は、本家の clone `tmp\b\vscode` を別の蒙恬の作業が使っている間なので、まだ打っていない（1節）

## 0. 要点

1. **作業ツリー12個のうち11個は、変更も stash も無い。`trial-bwt` には変更が2行ある**（3節）。どちらも取り込みの試しの残り（試しの単位 `A-8-trial` の edits.patch と、試しの `product.overlay.json`）。私は要らないと見るが、条件の「変更が無い」には当たらないので、リーダーが決めてほしい。
2. 写していない5項目の中身は、どれも試しの残り（2節）。`tasks/` の記録に結果が書いてある。強いて残すなら、`C:\b\p4-watch\trial\real\responses.json`（GitHub と Open VSX の本物の応答を記録したもの）だけ。
3. 直下は15個のままで、HEAD は13個とも 2026-11-15 の survey と同じ。ロックは無い（4節）。
4. 写し直しの台本 `scripts/copy-verify.mjs` と一覧 `evidence-copy-list.json`（22行）を作った（5節）。dry-run では、元の22ファイルが README の表の SHA-256 とすべて合った。写しは21ファイルが元と同じで、`extension.vsixmanifest` だけが違う。records には何も書いていない。
5. Team の `perm-proposal.md` は、私の読める場所（`read_paths`）の外なので読めなかった。手順は brief と `tasks/2026-11-15-move-off-c/permission-response.md` の2・3節に従った。

## 1. 枝の取り込み（brief の1）: まだ打っていない

- 2026-11-16 07:20:37 から、別の蒙恬が `tasks/2026-11-16-p5-c1-product-keys/c1fix-r4prep/` の build.mjs（prepare・apply）を走らせている。作業ツリーは `tmp\b\wt\c1fix` で、`tmp\b\vscode` に worktree を足す作業になる。私が確かめた時点では、build-record の prepare が `running` だった。
- `tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` に「r4」の節はまだ無い。
- brief の注意（r4 の間は打たない）に従って、fetch の11行も for-each-ref も打っていない。

r4 が終わった後に打つコマンド（どれも許可の bash_exact にある形。リポジトリの直下で打つ）:

```
git -C tmp/b/vscode fetch C:/b/vscode refs/heads/builds/1.146.0-p2-B-1-r2:refs/heads/builds/1.146.0-p2-B-1-r2 refs/heads/builds/1.146.0-p2-B-2-r2:refs/heads/builds/1.146.0-p2-B-2-r2 refs/heads/builds/1.146.0-p2-B-3-r2:refs/heads/builds/1.146.0-p2-B-3-r2 refs/heads/builds/1.146.0-p2-B-4-r2:refs/heads/builds/1.146.0-p2-B-4-r2 refs/heads/builds/1.146.0-p2-B-5-r2:refs/heads/builds/1.146.0-p2-B-5-r2 refs/heads/builds/1.146.0-p2-B-6-r2:refs/heads/builds/1.146.0-p2-B-6-r2 refs/heads/builds/1.146.0-p2-B-7-r2:refs/heads/builds/1.146.0-p2-B-7-r2 refs/heads/builds/1.146.0-p2-all:refs/heads/builds/1.146.0-p2-all
git -C tmp/b/vscode fetch C:/b/wt/1.145.3 HEAD:refs/heads/keep/wt-1.145.3
git -C tmp/b/vscode fetch C:/b/wt/dev-a HEAD:refs/heads/keep/wt-dev-a
git -C tmp/b/vscode fetch C:/b/wt/dev-a-apply HEAD:refs/heads/keep/wt-dev-a-apply
git -C tmp/b/vscode fetch C:/b/wt/dev-b HEAD:refs/heads/keep/wt-dev-b
git -C tmp/b/vscode fetch C:/b/wt/dev-c1 HEAD:refs/heads/keep/wt-dev-c1
git -C tmp/b/vscode fetch C:/b/wt/dev-c3 HEAD:refs/heads/keep/wt-dev-c3
git -C tmp/b/vscode fetch C:/b/wt/p1-a1 HEAD:refs/heads/keep/wt-p1-a1
git -C tmp/b/vscode fetch C:/b/wt/p2 HEAD:refs/heads/keep/wt-p2
git -C tmp/b/vscode fetch C:/b/wt/trial-bwt HEAD:refs/heads/keep/wt-trial-bwt
git -C tmp/b/vscode fetch C:/b/wt/verify-p2 HEAD:refs/heads/keep/wt-verify-p2
git -C tmp/b/vscode for-each-ref refs/heads/builds refs/heads/keep
```

照らす相手（keep の10本。今日の survey と 2026-11-15 の survey で同じ値）:

| 枝 | 期待する commit |
|---|---|
| `keep/wt-1.145.3` | `79055c2cb190e7937d217a2928ed0079881686cc` |
| `keep/wt-dev-a` | `a8145cd7bee686d8b9ac63fe366a7ddfdbe879ee`（古い clone の `units-a`） |
| `keep/wt-dev-a-apply` | `28869a097e3553e56440ca20561d79915c7e8ebd` |
| `keep/wt-dev-b` | `44be84f8aa6d5f3c61b8badfc75f5c4fef492c61` |
| `keep/wt-dev-c1` | `8d5cdfd0b1767e434a4205d9ead55a3030d03a9e` |
| `keep/wt-dev-c3` | `526d25d777f5a7c2abe71513cf9f6c870121cbe2` |
| `keep/wt-p1-a1` | `cff68091803f933ffbd34c93d1a7dc14633f7a72` |
| `keep/wt-p2` | `ed59899d41cd3035594ff62df3a57c3e62f2f483` |
| `keep/wt-trial-bwt` | `4be87ac66ef0fb21941e9d4e1830efb134d94156` |
| `keep/wt-verify-p2` | `6fba38db6119ca8dbb2de9244f07b5ae8f323d0d` |

- builds の8本の照らす相手は、古い clone の `C:\b\vscode\.git\packed-refs`（または `refs/heads/builds/`）にある値。fetch の後に、for-each-ref の出力と Grep で照らす。
- `tmp/b/vscode` に builds の同じ名前の枝が既にあり、値が違えば、`+` が無いので fetch は断る（non-fast-forward）。そのときは止めて知らせる。

## 2. 写していない5項目の中身（brief の2）

調べ: `node scripts/move-survey.mjs --from C:/b --no-caches --only take-in,take-in-trial,notion-sync-trial,p4-watch,tmp --out tasks/2026-11-16-before-delete-c/survey-c-five.json`（07:18 UTC、106 秒、終了 0）。中身は Glob で一覧を取り、判断に要るものだけ Read で開いた。`*.dpapi` と `netlog` は開いていない（秘密が載りうる形のため）。

| 項目 | 大きさ | 中身 | 作った作業と記録 | 要りそうか |
|---|---|---|---|---|
| `take-in\trial-official-1.146.0` | 0.68 GB、8,781 ファイル | `netaudit-env`（公式 1.146.0 に台帳の8つの拡張を入れた一時の環境。`ext\` がほぼ全部）、`netaudit-run`（印の `.p0-run-root` だけ）、`netlog\`（ネットのログ1本と node の出力2本） | 取り込みの試し t8（`tasks/2026-11-14-p3-take-in/trial-log.md` 9節） | 要らない。環境は台本で作り直せる。結果は下の `t8\netaudit\` にある。netlog は秘密が載りうるので開いていない（docs/07 の3節。p0 の netlog と同じ扱い） |
| `take-in-trial` | 97 ファイル | t1〜t12（取り込みの試しの記録: `take-in.json`・`checks.json`・`logs\`・修理の依頼文と偽の返答・判定）、`bwt-fail`・`bwt-conflict`（試しの単位 `A-9-trial`・`A-8-trial`）、`fake-claude`（偽の claude と `calls.jsonl`・`write-outside.flag`）、`m3`（偽の Notion の試し） | `tasks/2026-11-14-p3-take-in/trial-log.md`・`handoff-notes.md` | 要らない。判定は偽の判定役の返答（`t7\verdict.md` の理由は「偽の判定役の返答（試し）」）。結果は trial-log に書いてある。下に「判定の材料」になりうるものを挙げる |
| `notion-sync-trial` | 4 ファイル | `User\settings.json`・`keybindings.json`・`tasks.json`、`globalStorage\shuko.notion-sync\sync-base.json` | notion-sync の試しの流れ16（`tasks/2026-11-14-notion-sync-deps/handoff-notes.md`、`tasks/2026-11-14-p4-notion-sync/trial-log.md`）。Notion は差し替え | 要らない。`extensions-src/notion-sync/dev/trial.mts` が作り直す（既定の置き場所がこのフォルダのまま。下の未解決の3） |
| `p4-watch\trial` | 23 ファイル | A〜E の試しの state と `watch.log`、差し替えの Notion（`notion.json`）、`local.json`、`real\responses.json`、`selfcheck.dpapi`・`garbage.dpapi`・`empty.dpapi`、`E\state\state.json.broken-*` | 監視の試し（`tasks/2026-11-14-p4-watch/trial-log.md`）。handoff-notes の8に「消してよい」とある | ほぼ要らない。`real\responses.json` だけは下 |
| `tmp\b1-r2-patch` | 1 ファイル | `0001-unit-B-1-telemetry-edits.patch`（`git format-patch` の出力） | `tasks/2026-11-14-fix-b1-and-build/build-log.md` 25行。違い（`From` の行・diffstat・`index` の blob）はリポジトリの `removals/B-1-*/edits.patch` に取り込み済み | 要らない |

要りそうなもの（残すかはリーダーが決める）:

| ファイル | 種類 | 理由 | 残さないときに失うもの |
|---|---|---|---|
| `C:\b\p4-watch\trial\real\responses.json` | 監視の材料 | 2026-11-14 に GitHub（releases・security-advisories）2件と Open VSX 8件を本物から取った応答の記録。監視の試し D（`--fixtures`）で流した。`tasks/2026-11-14-p4-watch/fixtures/` の f1〜f4 は手で作った応答で、本物の応答の形はこれにしか無い | 本物の応答の形の見本。取り直せばまた取れる（そのときの値になる） |
| `C:\b\take-in-trial\t8\netaudit\`（`audit.md`・`destinations.json` など6つ） | 判定の材料 | 公式 1.146.0 を取り込みの台本（手順7）で60秒監査した結果。許した宛先の外が9件 | 公式の版の宛先の記録は `records/network-audits/2026-11-13-p05-upstream-default/` に別にある。こちらは台本の試しの1回なので、失っても困らない見込み |
| `C:\b\take-in-trial\t7\`（`judge-request.md`・`verdict.*`・`writeback.json`） | 判定の材料の形 | 判定役への依頼文と判定の記録の実物 | 偽の判定役の返答なので、判定そのものの価値は無い。形は `scripts/lib/take-in/` が作り直す |

- 監視の状態（`p4-watch\trial\*\state\state.json`）は、試しの state で、本物の監視の状態（`%LOCALAPPDATA%\Shuko\watch\`）ではない。要らない。
- 写すと決めたら、5節の台本に一覧を渡して写せる（`fromRoot` を `C:/b/p4-watch` などにした別の一覧を作る）。

## 3. 12個の作業ツリーの状態（brief の3）

それぞれ `git -C C:/b/wt/<名前> status --porcelain=v2 --branch --show-stash --untracked-files=all` を打った（07:2x UTC。どれも終了 0、stderr なし）。

| 作業ツリー | `# branch.oid` | `# branch.head` | 変更の行 | `# stash` |
|---|---|---|---|---|
| `1.145.3` | `79055c2cb190e7937d217a2928ed0079881686cc` | (detached) | なし | なし |
| `1.146.0` | `69047191fc427f2f92828279aae1d90d8eeda7ab` | (detached) | なし | なし |
| `dev-a` | `a8145cd7bee686d8b9ac63fe366a7ddfdbe879ee` | `units-a` | なし | なし |
| `dev-a-apply` | `28869a097e3553e56440ca20561d79915c7e8ebd` | (detached) | なし | なし |
| `dev-apply` | `69047191fc427f2f92828279aae1d90d8eeda7ab` | (detached) | なし | なし |
| `dev-b` | `44be84f8aa6d5f3c61b8badfc75f5c4fef492c61` | (detached) | なし | なし |
| `dev-c1` | `8d5cdfd0b1767e434a4205d9ead55a3030d03a9e` | (detached) | なし | なし |
| `dev-c3` | `526d25d777f5a7c2abe71513cf9f6c870121cbe2` | (detached) | なし | なし |
| `p1-a1` | `cff68091803f933ffbd34c93d1a7dc14633f7a72` | (detached) | なし | なし |
| `p2` | `ed59899d41cd3035594ff62df3a57c3e62f2f483` | (detached) | なし | なし |
| **`trial-bwt`** | `4be87ac66ef0fb21941e9d4e1830efb134d94156` | (detached) | **2行**（下） | なし |
| `verify-p2` | `6fba38db6119ca8dbb2de9244f07b5ae8f323d0d` | (detached) | なし | なし |

どの `# branch.oid` も、4節の survey の `head` と同じ。

`trial-bwt` の2行:

```
1 .M N... 100644 100644 100644 2a0f39c20fbc6fa9335e8c01f5c9d8bfc5d5b7d9 2a0f39c20fbc6fa9335e8c01f5c9d8bfc5d5b7d9 removals/A-8-trial/edits.patch
? product.overlay.json
```

- `removals/A-8-trial/edits.patch`: 作業ツリーの中身だけが HEAD と違う（index は HEAD と同じ）。試しの単位 `A-8-trial`（B-3 の edits.patch を写した、わざと衝突させる単位）で、取り込みの試し t10 の偽の修理役が書き戻したもの（`tasks/2026-11-14-p3-take-in/trial-log.md` の10節「`removals/A-8-trial/edits.patch` は書き戻されたまま残る」）。中身を Read で見た。12行を足すパッチで、import の行の末尾に `// trial-3` がある。差分そのものは見ていない（`git -C C:/b/wt/* diff` の許可が無い）。
- `product.overlay.json`: 中身は `{ "set": { "nameShort": "Shuko" } }` だけ。試しのために置いた overlay（trial-log の5節 t5・t6）。
- 判断の材料: どちらも試しの単位と試しの設定で、本物の単位（`removals/` の A〜C）とは関係しない。HEAD（試しのコミット）は `keep/wt-trial-bwt` で残る。作業ツリーの変更は fetch では残らない。

stash の確かめ（手順の3の2）:

- `C:/b/vscode/.git/HEAD` は `ref: refs/heads/main`（Read）。
- Glob（`C:/b/vscode/.git` の下）: `refs/stash`・`logs/refs/stash`・`worktrees/*/refs/**`・`worktrees/*/logs/refs/**` は無い。
- `packed-refs` の `stash` を含む行は9行で、どれも `refs/remotes/origin/…`（本家の枝の名前。例 `refs/remotes/origin/joshspicer/stash`）。`refs/stash` は無い。
- 途中の操作の印（`worktrees/*/rebase-apply`・`rebase-merge`・`MERGE_HEAD`・`CHERRY_PICK_HEAD`・`BISECT_LOG`、`.git` 直下の同じもの）は無い。`worktrees/*/MERGE_RR`（rerere の記録）はある。

注意: `--untracked-files=all` は、`.gitignore` で無視するファイル（`node_modules`・`out`・`.build` など）を出さない。無視するファイルに手で置いた物があっても、この確かめでは分からない。

## 4. 直下の数え直し（brief の4）

調べ: `node scripts/move-survey.mjs --from C:/b --no-caches --out tasks/2026-11-16-before-delete-c/survey-c-before-v2-2.json`（07:22 UTC に始めて 269 秒、終了 0）。

- **直下は15個**: `cache`・`dist`・`logs`・`notion-sync-trial`・`p0`・`p1`・`p2`・`p4-watch`・`smoke`・`take-in`・`take-in-trial`・`tmp`・`vscode`・`work-b`・`wt`。直下にファイルとリンクは無い。2026-11-15 の survey（`tasks/2026-11-15-move-off-c/survey-c-before-move.json`）の17個から、消した `trial-build`・`trial-install` を除いたものと同じ。
- **HEAD**: clone 本体と作業ツリー12個の13個とも、2026-11-15 の survey と同じ（clone 本体は `9f2bcd2269d23919b216d23529e5fb3cc2badc8f`、`refs/heads/main`）。
- **ロック**: worktree の一覧に `locked`・`prunable` は無い。Glob で `C:/b/vscode/.git` の `*.lock`・`refs/**/*.lock`・`worktrees/*/*.lock`・`worktrees/*/locked`・`gc.pid` を探して、無かった（`FETCH_HEAD` はある）。
- 大きさ（GB）: `wt` 17.83（重なりを除いて 11.58。中のリンク 57）、`p0` 11.37、`smoke` 5.08、`p1` 2.37、`vscode` 2.09、`p2` 1.08、`dist` 0.73、`take-in` 0.68、`cache` 0.19、ほかは 0。C: の空きは 98.44 GB。

## 5. 写し直しの台本（brief の5）

### 作ったもの

- `scripts/copy-verify.mjs`（新規）
- `tasks/2026-11-16-before-delete-c/evidence-copy-list.json`（22行。`records/phase0/evidence/README.md` の「写したもの」の表から作った）

### 使い方

```
node scripts/copy-verify.mjs --list <json> [--dry-run] [--out <json>]
```

- 一覧の形: `fromRoot`（元の柵。絶対パス）、`toRoot`（写し先の柵。リポジトリからの相対か絶対）、`entries`（`from` は絶対パス、`to` はリポジトリからの相対か絶対、`expectSha256` は任意）。
- 写し方: `fs.copyFileSync` でバイトのまま写す（Read・Write を通さない）。写し先のフォルダが無ければ作る。写した後に写し先の SHA-256 を取り、元と照らす。写している間に元が変わっていないことも、元を読み直して見る。
- 守り:
  - 書くのは一覧の `to` だけ。一覧の外のファイルには触れない。消す処理は台本の中に無い。
  - 一覧に誤りが1つでもあれば、何も写さずに終了コード 2。誤りの種類は、`from` が `fromRoot` の外、`to` が `toRoot` の外（`..` で外へ出るものを含む）、`to` が重なる、元が無い、元がファイルでないかリンク、写し先がフォルダかリンク。
  - `expectSha256` が元と違う行は写さない（元が記録の後に変わった恐れ）。ほかの行は写す。
- 終了コード: 0 は全部の行が元と一致した、1 は一致しない行か写せない行がある、2 は引数か一覧の誤り。
- 出力（標準出力と `--out`）: `{ checkedAt, list, dryRun, fromRoot, toRoot, entries[], counts, result, message }`。行ごとに `from`・`to`・`bytes`・`sourceSha256`・`expectSha256`・`expectMatch`・`destBefore{exists,sha256,bytes}`・`changed`・`copied`・`destSha256`・`match`・`error` が入る。

### 一覧（evidence-copy-list.json）

- `fromRoot` は `C:/b/p0`、`toRoot` は `records/phase0/evidence`。22行の `to` は README の表の「写し」の列そのまま、`from` は `C:/b/p0/` の下の同じ相対の場所（README の4行目「フォルダの形は `C:\b\p0\` からの相対の場所と同じ」）。
- `expectSha256` は表の値。`extension.vsixmanifest` だけは「元」の値 `301bdf41…d3e9`。
- 22の元のファイルがあることは、Glob で確かめた。
- 表の「写していないもの」にある `basedpyright`・`bash-ide` の `files.json` の2つは、brief が22ファイルなので入れていない。写すなら一覧に2行足せば写せる（元の SHA-256 は README の52行）。足すかはリーダーが決める。

### 試した結果

| 試し | 結果 |
|---|---|
| `node --check scripts/copy-verify.mjs` | 誤りなし |
| `node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json --dry-run --out tasks/2026-11-16-before-delete-c/copy-verify-dry-run.json` | 終了 1（期待どおり）。22行とも `expectMatch: true`（元は README の表の値と同じ）。写しは21行が `match: true`。`extension.vsixmanifest` だけが `match: false`（写し `ead27a22…0261`、2,108 B。元 `301bdf41…d3e9`、2,146 B。README の記述と同じ）。records には何も書いていない |
| `tmp/copy-verify-trial/` の試し（ふつう） | 終了 0。違う写し先の上書きと、無い写し先（フォルダも無い）の作成の2行とも `match: true`。一覧に無い `dst/untouched.txt` は変わらなかった |
| 同（`expectSha256` を違う値にした行と、ふつうの行） | 終了 1。違う行は `copied: false` と誤り、ふつうの行は写した |
| 同（誤りの一覧: `toRoot` の外、元が無い、`dst/sub/../a2.txt` で `to` が重なる、元がフォルダ、`fromRoot` の外） | 終了 2。5つの誤りをまとめて出し、何も書かなかった（`--out` のファイルも作らない） |
| `--list` なし | 終了 2、`--list（写す一覧）が無い` |

`tmp/copy-verify-trial/` は試しの入力と出力の置き場所。消していない（削除の許可の外）。

### 大岡越前守が打つコマンド

```
node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json --out tasks/2026-11-16-before-delete-c/copy-verify-run.json
```

期待: 終了 0、`counts` が `entries: 22, copied: 22, match: 22, errors: 0`、`extension.vsixmanifest` の行の `destSha256` が `301bdf41b2eaf9dbb9604c588b5b6146e4e51cb5615b01a4ee5182a794fdd3e9`。21ファイルは中身が同じものを上書きするだけ（`changed: false`）。先に `--dry-run` を付けて確かめることもできる。

## 6. テストの入口（曹参へ）

`scripts/copy-verify.mjs` が書き出す関数:

| 関数 | 入力 | 期待 |
|---|---|---|
| `parseArgs(argv)` | `["--list","x.json","--dry-run","--out","o.json"]` | `{ list: "x.json", dryRun: true, out: "o.json" }`。`--list` が無い・値が無い・知らない引数は `ArgError` |
| `isInside(child, root)` | `("C:\\a\\b\\c","c:/a/b")` | `true`（大文字小文字を区別しない）。`("C:\\a\\bc","C:\\a\\b")` は `false` |
| `sha256File(p)` | ファイル | 小文字の64桁 |
| `validateList(list, { baseDir })` | 一覧のオブジェクト。`baseDir` は `to`・`toRoot` の相対の基準（既定はリポジトリの直下） | 正しければ `{ fromRoot, toRoot, entries: [{ from, to, fromAbs, toAbs, expectSha256 }] }`。誤りは `ListError` で、message に全部の誤りを `; ` で並べる（上の5節の種類。`fromRoot` と `toRoot` が重なる、`expectSha256` が64桁の小文字の16進でない、も含む） |
| `copyVerify(checked, { dryRun })` | `validateList` の戻り値 | `{ entries, counts: { entries, copied, unchanged, match, mismatch, errors }, result: "ok" \| "error", message }`。`dryRun` では何も書かない |

テストが要る点:

- 誤りの一覧では、一覧のどの写し先にも書かないこと（`validateList` が投げるので `copyVerify` まで行かない）。
- 一覧の外のファイル（同じ `toRoot` の中のほかのファイル）が変わらないこと。
- 空白だけの行やタブ・CRLF・最後の改行なしのファイルが、バイトのまま写ること（今回の `extension.vsixmanifest` の誤りの形）。
- `to` に `..` を入れて `toRoot` の外へ出る形が止まること。

## 7. 守ったこと

- `C:\b` は読むだけ。打ったのは `git -C C:/b/wt/<名前> status`（12回）と、move-survey（読むだけの台本。中で `git worktree list`・`branch --contains`・`tag --contains` を打つ）。Read・Glob・Grep で読んだのは、5項目の一覧と判断に要る数ファイル、`C:/b/vscode/.git` の HEAD・packed-refs・worktrees の一覧、`trial-bwt` の2ファイル。
- `*.dpapi` と netlog は開いていない。普段使いのエディタのデータと、秘密の場所に触れていない。
- 書いたもの: `scripts/copy-verify.mjs`、このフォルダ（`handoff-notes-meng-tian.md`・`evidence-copy-list.json`・`survey-c-five.json`・`survey-c-before-v2-2.json`・`copy-verify-dry-run.json`）、`tmp/copy-verify-trial/`。`records/` には書いていない。
- 何も消していない。`tmp/b/vscode` には触れていない（fetch を打っていない）。

## 8. docs/ との食い違い

- なし（今回の範囲で見つけたものは無い）。

## 9. 未解決の点

1. **brief の1（枝の取り込み）が残っている。** r4 のビルドが終わったら、1節の12行を打ち、for-each-ref を照らす。リーダーが r4 の終わりを知らせてくれれば、私が打つ。
2. **`trial-bwt` の変更の2行**（3節）。条件「未コミットの変更が無い」に当たらない。試しの残りとして捨ててよいかを、リーダーが決める。
3. `extensions-src/notion-sync/dev/trial.mts` の既定の置き場所が、まだ `C:\b\notion-sync-trial`（`tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md` の未解決の8）。C:\b を消した後にこの試しを走らせると、C: に `C:\b` を作り直す。範囲の外なので直していない。
4. 写していない5項目のうち、`p4-watch\trial\real\responses.json` を残すか（2節）。
5. `basedpyright`・`bash-ide` の `files.json` を一覧に足すか（5節）。
6. Team の `perm-proposal.md`（85行からの手順の全文）を、私の許可では読めない。brief とこのリポジトリの `permission-response.md` で足りたが、全文と食い違う手順があれば知らせてほしい。

---

# 2回目（2026-11-16。リーダーの判断を受けた一覧の追加と残りの確かめ）

- 依頼: リーダーの知らせ「写し直しの一覧の追加と残りの確かめ」の1〜4。判断は `docs/user-decisions.md` の「C:\b を消す前の確かめで出た点」
- 結果: **一部完了**。一覧に3行を足し、dry-run で確かめた。brief の1（fetch と for-each-ref）は、r4 の終わりが見えないので、まだ打っていない（R2-3）

## R2-0. 要点

1. 一覧 `evidence-copy-list.json` に3行を足して25行にした。`basedpyright` と `bash-ide` の `files.json`（写し先は `records/phase0/evidence/vsix/` の下）と、`C:\b\p4-watch\trial\real\responses.json`（写し先は `kept/` の下）。
2. 写し先が2つの場所になるので、台本の `fromRoot`・`toRoot` に配列も書けるようにした（柵を複数置ける）。文字列1つの一覧は今までどおりに動く。
3. dry-run（`copy-verify-dry-run-2.json`）では、25行とも元が `expectSha256` と同じだった。一致しないのは4行で、既にある `extension.vsixmanifest` と、まだ無い3つの写し先。何も書いていない。
4. `trial-bwt` の変更の2行は、判断（捨ててよい）のとおり何もしていない。
5. copy-verify.mjs のテストは曹参に任せる（入口は6節。下の R2-1 の配列の形も足してほしい）。

## R2-1. 台本の直し（`scripts/copy-verify.mjs`）

- `fromRoot`・`toRoot` は、文字列か文字列の配列。行ごとに、`from` がどれかの `fromRoot` の下にあり、`to` がどれかの `toRoot` の下にあればよい。柵そのもの（`fromRoot`・`toRoot` のパスと同じもの）は元にも写し先にもしない（1回目と同じ）。
- `fromRoot` と `toRoot` が重なるかは、すべての組で見る（`fromRoot と toRoot が重なる: <元の柵> / <写し先の柵>`）。
- 出力の `fromRoot`・`toRoot` は、柵が1つなら文字列、2つ以上なら配列（1回目の出力の形を変えないため）。
- 誤りの文の「fromRoot の外」「toRoot の外」はそのまま（どの柵の下にも無いときに出る）。
- 試し: `node --check` は誤りなし。`tmp/copy-verify-trial/list-bad.json` は1回目と同じ5つの誤りで終了 2、`list-ok.json`（柵が1つ）の `--dry-run` は終了 0 で、出力の `fromRoot`・`toRoot` は文字列のままだった。

曹参へ（6節に足す）: `validateList` に配列の柵を渡す形。次のことを確かめてほしい。

- 2つの柵のどちらかの下なら通ること。
- どちらの下にも無ければ止まること。
- 片方の `toRoot` が片方の `fromRoot` の中なら「重なる」で止まること。
- 空の配列は `fromRoot が絶対パス（かその配列）でない`・`toRoot が無い` で止まること。

## R2-2. 一覧に足した3行

| 元 | 写し先 | expectSha256 | 大きさ | 値の出どころ |
|---|---|---|---|---|
| `C:/b/p0/vsix/detachhead.basedpyright-1.40.2/files.json` | `records/phase0/evidence/vsix/detachhead.basedpyright-1.40.2/files.json` | `b1967fe60e834b2df8fea034b263f51a8717e2cb4d51e2f2e6ba49d4a9620695` | 626,794 B | `records/phase0/evidence/README.md` の52行（元の SHA-256） |
| `C:/b/p0/vsix/mads-hartmann.bash-ide-vscode-1.43.2/files.json` | `records/phase0/evidence/vsix/mads-hartmann.bash-ide-vscode-1.43.2/files.json` | `4a69ac99a50cbe7e6debfa59f38a0a54f7ccbbeb3ad8b71444a1ed92d8c137b6` | 271,629 B | 同上 |
| `C:/b/p4-watch/trial/real/responses.json` | `tasks/2026-11-16-before-delete-c/kept/p4-watch/trial/real/responses.json` | `e895facc9e3b61935eeb696f53f47bde24452e5c8407f251a33309f764c61a86` | 321,393 B | 記録した値が無いので、`expectSha256` を付けずに dry-run（`copy-verify-dry-run-2a.json`）を流し、台本が出した元の `sourceSha256` を写した |

- 柵: `fromRoot` は `["C:/b/p0", "C:/b/p4-watch/trial/real"]`、`toRoot` は `["records/phase0/evidence", "tasks/2026-11-16-before-delete-c/kept"]`。p4-watch の柵は `real` のフォルダまでに絞った（`*.dpapi` のある `trial` の直下は柵の外）。
- `responses.json` の写し先は、`kept/` の下に `C:\b` からの相対の形（`p4-watch/trial/real/`）で置く。出どころがパスで分かるようにするため。
- `responses.json` の `expectSha256` は、2026-11-16 07:35 UTC の元の値。前に取った値と照らしたのではない。役目は、写すまでの間に元が変わっていないことの確かめだけ。
- 一覧の `description` に、2回目で足したことを書いた。

## R2-3. dry-run の結果

```
node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json --dry-run --out tasks/2026-11-16-before-delete-c/copy-verify-dry-run-2.json
```

- 終了 1（期待どおり。写し先がまだ元と同じでないため）。`counts` は `entries 25 / copied 0 / unchanged 21 / match 21 / mismatch 4 / errors 0`。
- 25行とも `expectMatch: true`。
- `match: false` の4行:
  - `extension.vsixmanifest`: 写し `ead27a22…0261`（2,108 B）、元 `301bdf41…d3e9`（2,146 B）
  - `basedpyright` の `files.json`: 写し先は無い
  - `bash-ide` の `files.json`: 写し先は無い
  - `responses.json`: 写し先は無い
- records と `kept/` には何も書いていない（`kept/` のフォルダも作っていない）。

大岡越前守が打つコマンドは1回目と同じ（5節）。期待は次のとおり。

- 終了 0
- `counts` が `entries 25 / copied 25 / match 25 / errors 0`
- 新しく `records/phase0/evidence/vsix/` の下に2つ、`tasks/2026-11-16-before-delete-c/kept/p4-watch/trial/real/responses.json` が1つできる
- README の「写していないもの」の basedpyright・bash-ide の記述も直すことになる（`records/` の書き手の大岡越前守）

## R2-4. brief の1（枝の取り込み）: まだ打っていない

- 07:35:32 UTC に `c1fix-r4prep`（prepare・apply）が終わった（build-record の `finishedAt`。2つの手順とも `ok`）。これは r4 の準備で、r4 そのものではない。
- `tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` に「r4」の節はまだ無い。r4 のビルドはこれから `tmp/b/vscode` に作業ツリーを足すはずなので、終わりはまだ見えない。
- 知らせのとおり、ここで終える。r4 の終わりを知らせてもらったら、1節の12行を打ち、keep の10本を1節の表と、builds の8本を古い clone の packed-refs と照らす。

## R2-5. 守ったこと

- 書いたもの: `scripts/copy-verify.mjs`（柵の配列）、`evidence-copy-list.json`（3行と description）、`copy-verify-dry-run-2a.json`・`copy-verify-dry-run-2.json`、この節。`records/`・`kept/` には書いていない。
- `C:\b` は読むだけ（台本が元の SHA-256 を取っただけ）。`tmp/b/vscode` には触れていない。何も消していない。

## R2-6. 未解決の点

1. brief の1（R2-4）。r4 の後に打つ。
2. 1回目の未解決の3（`trial.mts` の既定の置き場所 `C:\b\notion-sync-trial`）と6（`perm-proposal.md` を読めない）は残っている。2・4・5は、リーダーの判断で片づいた。

---

# 3回目（2026-11-16。古い clone の枝の取り込み）

- 依頼: リーダーの知らせ「古い clone の枝の取り込み」（r4 のビルドが終わった後）
- 結果: **完了**。fetch の11行と for-each-ref を打った。builds の8本と keep の10本が、古い clone の値と1節の表の値にすべて一致した

## R3-1. 打つ前に確かめたこと

- `tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` に「r4」の節（377行の `# r4`、434行の `## R4-B. 版 1.146.0-p5-c-all-r4`）がある。
- リーダーの知らせでは、今 `tmp/b/vscode` を使うのは大岡越前守の r4 の関門だけで、関門は clone の参照を書き換えない。
- 照らす相手の builds の8本を、古い clone から読んだ（Read・Grep。読むだけ）:
  - `C:/b/vscode/.git/packed-refs` の2〜6行に、B-1〜B-5 の5本があった。
  - B-6・B-7・all の3本は `refs/heads/builds/` の単独のファイルにあった。packed-refs にこの3本の古い行は無い。

## R3-2. 打ったコマンドと結果

1節の12行を、そのままの形で順に打った（リポジトリの直下）。どれも終了 0 で、ロックの誤りは出なかった。fetch はパスを取らないので、`-C` の先からの相対で読まれる件（リーダーの注意）には当たらない。元は `C:/b/...` の絶対パスで渡している。

| 回 | コマンド（要点） | 出力 |
|---|---|---|
| 1 | `fetch C:/b/vscode`（builds の8本を名指し、`+` なし） | `* [new branch]` が8行（B-1-r2〜B-7-r2、p2-all） |
| 2〜11 | `fetch C:/b/wt/<名前> HEAD:refs/heads/keep/wt-<名前>`（10個） | どれも `* [new ref] HEAD -> keep/wt-<名前>` |
| 12 | `for-each-ref refs/heads/builds refs/heads/keep` | 下 |

for-each-ref の出力は24行（builds が14本、keep が10本）。取り込んだ builds の8本と keep の10本は下の表のとおり。ほかに `tmp/b` で作った builds の6本（`1.146.0-p5-c-all`・`-r2`・`-r3`・`-r3b`・`-r3c`・`-r4`）も出た。r4 は `7fac30e886f79ebe44e1bac93acd7a86fbbafed8`。

- 出力を写したファイルは作っていない。私の許可ではリダイレクトが打てない。また、出力を Read・Write で書き写すのは、写し方の裁定に触れるため。
- 下の表の値は、出力と照らして書いた。原本が要るときは、同じ for-each-ref を打ち直せば取れる（読むだけ）。

## R3-3. 照らした結果

builds の8本（期待する値は古い clone の値）:

| 枝 | `tmp/b/vscode` の値 | 古い clone の値（出どころ） | 一致 |
|---|---|---|---|
| `builds/1.146.0-p2-B-1-r2` | `f47742d90bcc30886f716c9d5d1365f7c29b450c` | 同じ（packed-refs 2行） | 一致 |
| `builds/1.146.0-p2-B-2-r2` | `b9c0a9c1adc39b212af85c00115f5bd4a32780e0` | 同じ（packed-refs 3行） | 一致 |
| `builds/1.146.0-p2-B-3-r2` | `cd09c2010487b3c5e740ad7ffbb58f4d61b04afb` | 同じ（packed-refs 4行） | 一致 |
| `builds/1.146.0-p2-B-4-r2` | `b4417153ede5a54479f066e8ddbce6a22839c35d` | 同じ（packed-refs 5行） | 一致 |
| `builds/1.146.0-p2-B-5-r2` | `4dd38929c46e0026691afece4a2c3f476bb0b6b0` | 同じ（packed-refs 6行） | 一致 |
| `builds/1.146.0-p2-B-6-r2` | `1f4abbee7a679a3bdad05200fc7289dbd0543e6d` | 同じ（`refs/heads/builds/1.146.0-p2-B-6-r2`） | 一致 |
| `builds/1.146.0-p2-B-7-r2` | `680e99e95c9988295b29a2a5ee7a8ecc107c4e39` | 同じ（`refs/heads/builds/1.146.0-p2-B-7-r2`） | 一致 |
| `builds/1.146.0-p2-all` | `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa` | 同じ（`refs/heads/builds/1.146.0-p2-all`） | 一致 |

keep の10本（期待する値は1節の表。今日の survey と 2026-11-15 の survey の `head`）:

| 枝 | `tmp/b/vscode` の値 | 一致 |
|---|---|---|
| `keep/wt-1.145.3` | `79055c2cb190e7937d217a2928ed0079881686cc` | 一致 |
| `keep/wt-dev-a` | `a8145cd7bee686d8b9ac63fe366a7ddfdbe879ee` | 一致（古い clone の `units-a`） |
| `keep/wt-dev-a-apply` | `28869a097e3553e56440ca20561d79915c7e8ebd` | 一致 |
| `keep/wt-dev-b` | `44be84f8aa6d5f3c61b8badfc75f5c4fef492c61` | 一致 |
| `keep/wt-dev-c1` | `8d5cdfd0b1767e434a4205d9ead55a3030d03a9e` | 一致 |
| `keep/wt-dev-c3` | `526d25d777f5a7c2abe71513cf9f6c870121cbe2` | 一致 |
| `keep/wt-p1-a1` | `cff68091803f933ffbd34c93d1a7dc14633f7a72` | 一致 |
| `keep/wt-p2` | `ed59899d41cd3035594ff62df3a57c3e62f2f483` | 一致 |
| `keep/wt-trial-bwt` | `4be87ac66ef0fb21941e9d4e1830efb134d94156` | 一致 |
| `keep/wt-verify-p2` | `6fba38db6119ca8dbb2de9244f07b5ae8f323d0d` | 一致 |

- どれも種類は `commit`。
- これで、条件の1（Team の返答の3節の1）は満たした。作業ツリーの `1.146.0` と `dev-apply` は取っていない（HEAD がタグ `1.146.0` と同じ `69047191…a7ab`。返答の2節）。

## R3-4. 守ったこと

- 打ったのは、許可の bash_exact にある12行だけ。`C:\b` は読むだけ（fetch の元にして、packed-refs と refs を Read・Grep した）。
- `tmp/b/vscode` に足したのは、名前の重ならない新しい枝の18本だけ。既にあった枝は変えていない（どの行も `new`）。
- 何も消していない。

## R3-5. 未解決の点

- この節で増えたものは無い。2回目の R2-6 の2（`trial.mts` の既定の置き場所、`perm-proposal.md` を読めない）は残っている。

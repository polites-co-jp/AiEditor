# C:\b を消す前の確かめ（Team の v2-2 の条件）

- 担当: meng-tian（蒙恬）。写し直しは ooka-echizen（大岡越前守）
- 依頼日: 2026-11-16
- 状態: 依頼中

## 目的

Team の返答（`tasks/2026-11-15-move-off-c/permission-response.md` の3節）で、`C:\b` を消す段（v2-2・v2-3）は、ユーザーが条件付きで承認した。条件は (1) 古い clone の枝の取り込みと照らし、(2) 課の確かめ、(3) リーダーの「消してよい」。手順の全文は Team の記録 `E:\develop\self\Team\tasks\2026-11-16-ai-editor-move-off-c-perms\perm-proposal.md` の「v2-2 の前に課がする確かめ（ヴラドに渡す手順）」（85行から）。

ユーザーの裁定（2026-11-16「写し方」）: 写すのはコマンド（台本を含む）で行い、LLM の機能（Read で読んで Write で書く）で写さない。

reflog の確かめはリーダーが済ませた（下）。

## リーダーが済ませたこと（reflog だけが指す commit）

- `C:/b/vscode/.git/HEAD` は `ref: refs/heads/main`。作業ツリーの id は12個（フォルダの名前と同じ）。
- `git -C C:/b/vscode rev-list --reflog --not --branches --tags --remotes HEAD worktrees/<12個>/HEAD`: 2300 個。作者と件名で分けると、`shuko-apply` の `unit …`（1745）・`apply …`（330）・`shuko …`（162）・`patch …`（6）・`tmp …`（4）、`shuko-units`・`Shuko removals`・`KOU-MAIN\kou_z` の `unit …`（24）がほとんどで、本家の作者の commit が少し（本家の取り直しの範囲）。stderr は空。
- 判断: どれも単位を当てるたびに台本が作る途中の commit で、単位の定義（`removals/`）とタグから作り直せる。残す版の commit は `builds/*` と `keep/wt-*` の取り込みで残る。reflog だけが指す commit は残さない。

## やること（蒙恬）

手順の全文は Team の `perm-proposal.md` の85行から。どれも今の許可で打てる。結果はこのディレクトリに残す。

1. **枝の取り込み**（条件の1）: Team の返答の2節の fetch の1行目（builds の8本）を1回、作業ツリーの10行を10回打つ。その後 `git -C tmp/b/vscode for-each-ref refs/heads/builds refs/heads/keep` を打ち、builds の8本と keep の10本があること、commit が古い clone の値と survey の `head` と同じことを照らす。**本家の clone `tmp/b/vscode` を使う別の作業（版 r4 のビルド）が走っている間は打たない**（git のロックがぶつかる）。r4 が終わってから打つ。
2. **写していない5項目の中身**（`take-in`・`take-in-trial`・`notion-sync-trial`・`p4-watch`・`tmp`）: `node scripts/move-survey.mjs --from C:/b --no-caches --only … --out tasks/2026-11-16-before-delete-c/survey-c-five.json`。中身を Glob・Read で見て、要りそうなもの（記録・判定の材料・監視の状態）の一覧を書く。要るかどうかはリーダーが決める。
3. **12個の作業ツリーの状態**: それぞれ `git -C C:/b/wt/<名前> status --porcelain=v2 --branch --show-stash --untracked-files=all` を打ち、変更の行が無いこと、`# stash` が無いことを確かめる。stash は Glob と Read でも確かめる（手順の3の2）。
4. **直下の数え直し**: `node scripts/move-survey.mjs --from C:/b --no-caches --out tasks/2026-11-16-before-delete-c/survey-c-before-v2-2.json`。直下が15個のままか、HEAD が survey のときと同じか、ロックが無いかを見る。
5. **写し直しの台本**: `records/phase0/evidence/` の22ファイルを `C:\b\p0` からコマンドで写し直すための台本 `scripts/copy-verify.mjs` を作る。写す一覧（元と写し先の組）を JSON で受け、写し先が一覧にあるものだけを上書きし（今は LLM で書き写した物があるため）、写した後に SHA-256 を元と照らす。何も消さない。一覧は `records/phase0/evidence/README.md` の表から作り、このディレクトリに `evidence-copy-list.json` として置く。走らせるのは大岡越前守（`records/` の書き手）。

## やること（大岡越前守。蒙恬の5の後）

- `node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json` で写し直し、22ファイルの SHA-256 が元と一致すること（`extension.vsixmanifest` を含む）を確かめる。`records/phase0/evidence/README.md` の「元と同じでない1件」の記述を直す。

## 守ること

- `C:\b` は読むだけ（`git status` が index の stat を書き直すことだけは許される。Team の R20）。消さない。
- 写すのはコマンドか台本。Read・Write で書き写さない。
- 普段使いのエディタのデータと、秘密の場所に触れない。

## 完了条件

- 1〜4の結果と、5の台本と一覧があり、大岡越前守の写し直しで22ファイルが元と一致する。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`・`copy-verify-ooka.md` と、survey の JSON・for-each-ref の結果。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: 結果を見て「消してよい」と言い、ユーザーに知らせる（張良が v2-2 を当てる）。

## 途中の結果（2026-11-16、リーダー）

- 条件の1（枝の取り込み）: 済み。蒙恬の fetch 11行の後、リーダーが読むだけの照らしで、古い clone の18本（`builds/` の8本は packed-refs と refs/heads の値、`keep/wt-*` の10本は `worktrees/<名前>/HEAD` の値）が `tmp/b/vscode` の for-each-ref の24本にすべて同じ値であることを確かめた（食い違い 0）。
- 条件の2（課の確かめ）: 5項目の中身・12個の作業ツリーの状態・直下の数え直し・reflog は済み（判断は `docs/user-decisions.md` の「C:\b を消す前の確かめで出た点」）。残りは Phase 0 の根拠のファイルの写し直し（大岡越前守の許可の追加を Team に依頼中。`permission-requests-2.md`）。
- 条件の3（リーダーの「消してよい」）: 写し直しと照らしが済んでから出す。

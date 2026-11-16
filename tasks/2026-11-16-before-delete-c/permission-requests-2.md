# 権限の変更の依頼（AiEditor 課 → Team の開発部）: 写し直しの許可と、作業ツリーの片づけ

- 作成: ヴラド・ツェペシュ（2026-11-16）
- 承認: ユーザー（1は 2026-11-16 の問いで「大岡越前守に許可を足す（推奨）」。2・3 は書き換える前にユーザーの承認を取る）
- 前の依頼と返答: `tasks/2026-11-15-move-off-c/permission-requests.md`・`permission-response.md`

## 1. 大岡越前守に、写し直しの台本を走らせる許可（ユーザーが承認済み）

| 欄 | 足す行 | 何のため |
|---|---|---|
| bash（前方一致） | `node scripts/copy-verify.mjs --list tasks/2026-11-16-before-delete-c/evidence-copy-list.json` | ユーザーの裁定（2026-11-16「写し方」: C:\b から写すのはコマンドで行い、LLM の Read・Write で写さない）。前に Read・Write で写した `records/phase0/evidence/` の22ファイル（1ファイルは元とバイト単位で違う）と、写せなかった2ファイル・残す1ファイルを、台本で写し直す。`records/` の書き手は大岡越前守（課の台帳の書き込みの分け方）。台本は蒙恬が作り、大岡越前守が読んで確かめた（何も消さない・一覧の外を書かない・柵の外へ出ない。`tasks/2026-11-16-before-delete-c/copy-verify-ooka.md`）。後ろに `--out …`・`--dry-run` を付けて打つ |

写し直しと照らしが済むまで、C:\b を消す段（v2-2）は進めない。

## 2. 作業ツリーを作る許可の書き方の穴（蒙恬）

`git -C tmp/b/vscode worktree add tmp/b/wt/<名前> …` は、git が `-C` の先（`tmp/b/vscode`）からの相対パスとして読むので、`tmp/b/vscode/tmp/b/wt/<名前>` に作られた（2026-11-16、蒙恬。clone の中なので、このリポジトリそのものには効いていない）。`worktree remove tmp/b/wt/*` も同じく読まれうる。

- 案: 許しの形を、`-C` の先からの相対で正しく効く形（`git -C tmp/b/vscode worktree add ../wt/<名前>`・`worktree remove ../wt/<名前>`）か、絶対パスの形にする。どちらがフックの照らし方に合うかは開発部に任せる。
- あわせて、誤ってできた `tmp/b/vscode/tmp/b/wt/c1fix` を外す一度だけの許可（`git -C tmp/b/vscode worktree remove tmp/b/vscode/tmp/b/wt/c1fix` に当たる正しい形）。

## 3. 使い捨ての作業ツリーと版の片づけ（蒙恬。関門が済んだら）

Team の返答の U9。`tmp/b/wt/` の外に作った作業ツリーと、関門に使わなくなった版がある。

| 片づけるもの | 形 |
|---|---|
| 作業ツリー `tmp/b/wt-r2/1.146.0`・`tmp/b/wt-r3/1.146.0`・`tmp/b/wt-r3b/1.146.0`・`tmp/b/wt-r3c/1.146.0` | `worktree remove` の名指しの行（2の正しい形で）と、その後に空のフォルダ `tmp/b/wt-r2` などを消す行 |
| 作業ツリー `tmp/b/wt/c1fix`（3方向の試しの状態） | 同上（`tmp/b/wt/` の下なので、2の形が直れば今の許しで外せる見込み） |
| 段階 C の古い版（`tmp/b/p2/1.146.0-p5-c-all`・`-r2`・`-r3`・`-r3b`・`-r3c` と、`tmp/b/dist/` の同じ名前の zip） | 今の `delete_keep` が `tmp/b/p2/1.146.0-p5*`・`tmp/b/dist/1.146.0-p5*` を残すので消せない。関門に合格した版（r4 の後の版）だけを残す形に `delete_keep` を直す。どの版を残すかは、関門の後に改めて知らせる |

## 4. 知らせ

- 版 r4 は `tmp/b/wt/r4` に作った（Team の返答の後。今の許しの中）。
- `tmp/b/wt/VSCode-win32-x64`（gulp の出力）は、`tmp/b/wt/` の下の作業ツリーが同じ場所を使う。課では同時に2つの版をパッケージ化しない決まりにする。

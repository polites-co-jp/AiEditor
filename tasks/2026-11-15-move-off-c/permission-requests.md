# 権限の変更の依頼（AiEditor 課 → Team の開発部）: ビルドの置き場所を C: から tmp\b へ移す

- 作成: ヴラド・ツェペシュ（2026-11-16）
- 根拠: ユーザーの裁定（2026-11-15、`docs/user-decisions.md` の「C: に置かない」「ビルドの置き場所と Phase 0 の残り」）。一時的なファイルとビルドのためのファイルを C: に置かない。置き場所はビルドリポジトリの `tmp\b`（`.gitignore` 済み）。`C:\b` に前から作ったものは移すか消す。
- 細目: `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md` の4節（1回目）と「2回目」の R2-4（手順の12段）
- 承認: ユーザー（権限の変更は、書き換える前にユーザーの承認を取る）
- 書き換える場所: `team/departments/development/<id>/permissions.json`。AiEditor 課のメンバーとリーダーは書き換えない
- 新しい場所は、リポジトリの直下からの相対 `tmp/b/` で書く（フックは文字で照らすので、メンバーはこの形で打つ）

## 1. ずっと使う（`C:/b` の行を置き換える）

### 蒙恬（meng-tian）

| 欄 | 今 | 新しい書き方 |
|---|---|---|
| bash | `git -C C:/b/vscode fetch --tags`・`worktree add C:/b/wt/*`・`worktree remove C:/b/wt/*`・`worktree prune`・`tag --list` | `C:/b/vscode` を `tmp/b/vscode`、`C:/b/wt/*` を `tmp/b/wt/*` に |
| bash | `git -C C:/b/wt/* status`・`diff`・`apply`・`am -3`・`am --abort`・`am --continue`・`format-patch`・`checkout`・`clean -xfd`・`rerere`・`add`・`commit -m`（12行） | `C:/b/wt/*` を `tmp/b/wt/*` に |
| bash | `git clone https://github.com/microsoft/vscode.git C:/b/vscode` | `… tmp/b/vscode` |
| bash | `pnpm --dir C:/b/wt/* install`・`run gulp`・`run compile`・`run smoketest` | `C:/b/wt/*` を `tmp/b/wt/*` に |
| bash | `npx --prefix C:/b/wt/* tsc --noEmit` | `npx --prefix tmp/b/wt/* tsc --noEmit` |
| write_paths | `C:/b/` | 外す（`tmp/` で足りる） |
| read_paths | `C:/b/` | 移した後に外す（`./` で足りる） |
| delete_paths | `C:/b/p2/`・`C:/b/dist/`・`C:/b/smoke/ext/`・`C:/b/trial-*` | `tmp/b/p2/`・`tmp/b/dist/`・`tmp/b/smoke/ext/`・`tmp/b/trial-*` |
| delete_keep | `C:/b/p2/1.146.0-p2-all` ほか7行 | 同じ7行の `C:/b/` を `tmp/b/` に（新しい段階 C の版の名前は、関門の後に改めて依頼する） |
| delete_paths（2026-11-16 追記） | — | `tmp/b/wt-*`（版を作り直すたびに台本 `build.mjs --worktree` で作る使い捨ての作業ツリー。いま `wt-r2`・`wt-r3`・`wt-r3b`・`wt-r3c` の4つ、1つ約 2.5 GB と出力 0.7 GB）。関門が済んだ版の作業ツリーだけを消す。常設の作業場所 `tmp/b/wt` は git の `worktree remove` の形で外す |

### 曹参（cao-shen）

| 欄 | 今 | 新しい書き方 |
|---|---|---|
| bash | `pnpm --dir C:/b/wt/* run smoketest` | `pnpm --dir tmp/b/wt/* run smoketest` |
| read_paths | `C:/b/` | 移した後に外す |

### 大岡越前守（ooka-echizen）

| 欄 | 今 | 新しい書き方 |
|---|---|---|
| bash | `pnpm --dir C:/b/wt/* run smoketest`、`npx --prefix C:/b/wt/* tsc --noEmit`、`git -C C:/b/wt/* status`・`diff` | `C:/b/wt/*` を `tmp/b/wt/*` に |
| bash_exact | `git -C C:/b/wt/* checkout *.*.*`・`git -C C:/b/wt/* checkout -- pnpm-lock.yaml`・`pnpm --dir C:/b/wt/* install --lockfile-only --ignore-scripts` | `C:/b/wt/*` を `tmp/b/wt/*` に |
| read_paths | `C:/b/` | 移した後に外す |

## 2. 移すための一時の許可（蒙恬。手順が済んだら外す）

| 欄 | 足す行 | 使う段（R2-4） |
|---|---|---|
| bash | `git -C C:/b/vscode branch keep/wt-*` | 作業ツリーの HEAD（13個のうち9個はどの枝からもたどれない。段階 C の21単位の木 `ed59899d` を含む）に枝を付ける |
| bash | `git -C C:/b/vscode worktree remove --force C:/b/wt/*` | 作業ツリーを外す（作業ツリーは新しい場所で作り直す） |
| delete_paths | `C:/b/wt/` | `rm -rf C:/b/wt` |
| delete_paths | `C:/b`（末尾の `/` なし。そのものとその下） | 最後に `rm -rf C:/b`。写した物の照らし（台本 `scripts/move-build-root.mjs`）が済んでから。そのとき `delete_keep` の `C:/b/...` の7行を外す |

| delete_paths | `tmp/b/official/`・`tmp/b/cache/`・`tmp/b/logs/`・`tmp/b/vscode/`・`tmp/b/smoke/`・`tmp/b/work-b/` | 写す途中で止まり、写し先に途中まで書いたファイルが残ったとき、その項目の写し先を消して写し直す（台本は消さない。元の `C:\b` は残っているので、写し直せる）。移し終えたら外す（2026-11-16 追記） |

| bash_exact | `git -C tmp/b/vscode fetch C:/b/vscode +refs/heads/builds/*:refs/heads/builds/* +refs/heads/keep/*:refs/heads/keep/*` | 2026-11-16 追記。本家の clone は `tmp\b\vscode` に GitHub から新しく作った（段階 C の版のビルドのとき）ので、古い clone `C:\b\vscode` にある版ごとの枝 `builds/<label>`（版を作り直すため。docs/02 の4節）と、作業ツリーの HEAD に付ける `keep/wt-*` が無い。`C:\b` を消す前に、新しい clone へ取り込む。これにより、作業ツリーごと clone を写す段（`move-build-root.mjs` の clone の項目）は要らなくなる |

- 写す作業は台本 `node scripts/move-build-root.mjs`（今の許可 `node scripts/*.mjs` で走る。消さない・上書きしない・数と大きさと SHA-256 を照らす）で行うので、`cp` の許可は要らない。
- `C:\b\p0` は、要るもの（公式の 1.146.0 と、records の根拠の小さなファイル）を写した後、`rm -rf C:/b` でまとめて消す（ユーザーの裁定「データを消し、道具は引退」）。

## 3. 確かめてほしいこと（フックの側）

1. `rm -rf C:/b` は中に `.git`（常設の clone `C:\b\vscode\.git`）を含む。フックの「`.git` を守る」決まりが消す対象の中身まで見るなら、最後の段で止まる。止まるなら、どの形なら通るかを教えてほしい。
2. フックに、組み込みの Explore が読める場所として `C:/b/` が決め打ちで入っている（蒙恬の調べ）。移した後は外してよい。`tmp/b/` に替えるかは任せる。
3. `tmp\b` はリポジトリの中なので、`read_paths` が `./` のメンバー（判定役の狄仁傑を含む）は、作業ツリー・展開した版・スモークのデータを読めるようになる。秘密が載りうるネットのログは、課の側で「宛先を読み取ったらすぐ消す」形にした（`docs/user-decisions.md` 2026-11-16）。ほかに読ませたくない所があれば教えてほしい（`secret_paths` に場所を足すと、リポジトリの直下で Glob・Grep が止まる作りであることは承知している）。

## 4. ユーザーに扱いを決めてもらうもの（権限ではない）

- `%USERPROFILE%\.shuko`（0.7 GB）・`%APPDATA%\Shuko`: 手順書の試しで漏れたもの。消してよい。
- 共用のキャッシュ（`%LOCALAPPDATA%\npm-cache` 11〜12 GB、`pnpm\store` 3.5〜3.8 GB、`pnpm-cache` 1.7 GB、`electron` 0.9 GB、`ms-playwright` 1.8 GB、`%TEMP%` 6.8 GB）: ほかのプロジェクトと共用の見込み。これからのビルドは `tmp\b` の下のキャッシュを使う。

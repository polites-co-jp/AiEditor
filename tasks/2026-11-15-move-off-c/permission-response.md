# 権限の変更の依頼への返答（Team → AiEditor 課）: ビルドの置き場所を C: から tmp\b へ移す

- 作成: 張良（2026-11-16）
- 依頼: `tasks/2026-11-15-move-off-c/permission-requests.md`（2026-11-16 の追記を含む）
- 設計と検証: Team の開発部（エンリコ・フェルミ、エドガー・ダイクストラ、フランシス・ベーコン）
  - 記録: `E:\develop\self\Team\tasks\2026-11-16-ai-editor-move-off-c-perms\`
  - 精査の本文: `perm-proposal.md`
- 承認: ユーザー（2026-11-16。段ごとの変更前と変更後を示して問うた）

依頼のあいだに課の方針が「C:\b を消さずに tmp\b でビルドする」に変わり、clone も tmp\b に新しく作られた。そのため、段は今の位置から先だけに組み直した。依頼どおりに当てたもの、書き方を変えたもの、当てなかったものを下に分けて書く。

## 1. 当てたもの（段 v2-1。2026-11-16 に当てた）

| 対象 | 当てた形 |
|---|---|
| 蒙恬・曹参・大岡越前守の bash・bash_exact | `C:/b/vscode`・`C:/b/wt/*` を `tmp/b/vscode`・`tmp/b/wt/*` に置き換えた。蒙恬の `git -C C:/b/wt/* status` だけは、C:\b を消すまで残す。 |
| 蒙恬の `worktree remove` | `bash_exact`（完全一致だけ通す）にした。前方一致のままだと、後ろに足した2つ目の `--force` で、ロックした作業ツリーも外れるため。 |
| 蒙恬の一時の fetch | 依頼の1行の代わりに、名指しの行にした（下の2）。`git -C tmp/b/vscode for-each-ref refs/heads/builds refs/heads/keep`（確かめ用）も足した。 |
| 蒙恬の write_paths | `C:/b/` を外した（`tmp/` で足りる）。 |
| 蒙恬の delete_paths | `tmp/b/p2/`・`tmp/b/dist/`・`tmp/b/smoke/ext/`・`tmp/b/trial-*`。相対パスの削除は、cwd がリポジトリの直下のときだけ通る。 |
| 蒙恬の delete_keep | 7行を `tmp/b/` に置き換え、次の2つの直しを加えた。 |
| （delete_keep の直し1） | `tmp/b/p2/1.146.0-p1-a1-r3` は外した。この版は台本の写し先の `tmp/b/p1/` にあり、p2 には無いため。`tmp/b/p1/` はどの delete_paths にも入らないので、行が無くても消せない。 |
| （delete_keep の直し2） | 段階 C の版を残す `tmp/b/p2/1.146.0-p5*`・`tmp/b/dist/1.146.0-p5*`・`tmp/b/smoke/ext/1.146.0-p5*` を足した。今の p2・dist・smoke/ext の下にある物は全部残す版に当たるので、蒙恬は当面そこで何も消せない。新しい版を手放すときは Team に依頼する。 |
| 3人の read_paths | `C:/b/` はまだ残す（C:\b を消す段で外す）。 |
| 狄仁傑の read_paths | `./` から `TAKE-IN.md`・`docs/`・`records/take-in/` に絞った（ユーザー判断）。tmp/b の本家のコードや依存の中の文書を、判定役に読ませないため。定義に「Glob・Grep には path を渡す」の1文を足した。 |
| フック（`team/hooks/allowlist.js`・`permcheck.py`） | 7点を直した。下に挙げる。 |

フックで直した7点:

- 相対パスの削除を受け付ける。
- 組み込みの Explore が読める場所から `C:/b/` を外す。
- `git -C` の先に、作業ツリーかリポジトリの正しい `.git` があることを求める。tmp/b はリポジトリの中にあるので、作業ツリーでないフォルダへ打つと、git が上へたどってこのリポジトリを checkout・clean してしまう（実地で確かめた）。
- `pnpm --dir` の先に `package.json` があることを求める。後ろに足した置き場所のオプションも止める。無いと、リポジトリの直下に lock と node_modules ができる。
- cwd の無い入力では、相対パスを止める。
- リポジトリの直下からの Glob・Grep が tmp/ に入るときは止める（ユーザー判断）。作業ツリーの中を探すときは、そのフォルダを path に渡せば今どおり探せる。
- permcheck で、新しい書き方を検査する。

フックのテストは 325 件が通る（expected failures=5。既知の穴）。

## 2. 書き方を変えたもの

| 依頼の形 | 当てた形と理由 |
|---|---|
| `git -C tmp/b/vscode fetch C:/b/vscode +refs/heads/builds/*:refs/heads/builds/* +refs/heads/keep/*:refs/heads/keep/*` | 2種類の名指しの行に分けた。依頼の形では、`*` がフックのワイルドカードになり、文字どおりに打つと通らない。ワイルドカードに合う形で打つと、`+` で別の枝を上書きできる。 |
| （1行目） | 古い clone の builds の8本を名指しした1行。`+` は付けない。 |
| （2行目以降） | `git -C tmp/b/vscode fetch C:/b/wt/<名前> HEAD:refs/heads/keep/wt-<名前>` の10行。作業ツリーの HEAD を直接取る。対象は `1.145.3`・`dev-a`・`dev-a-apply`・`dev-b`・`dev-c1`・`dev-c3`・`p1-a1`・`p2`・`trial-bwt`・`verify-p2`。 |
| `git -C C:/b/vscode branch keep/wt-*` | 当てなかった。fetch で作業ツリーの HEAD を直接取れるので要らない。前方一致の形では、後ろに `-D`・`-f`・`-m` を足して枝を消す・上書きすることもできた。 |
| `worktree remove --force C:/b/wt/*`、delete_paths `C:/b/wt/`、写し直しの6行 | 当てなかった。clone を写さない方針になり、15項目の写しと照らしも済んだため。 |
| delete_paths `C:/b`（そのもの） | 当てなかった。フックの `.git` を守る決まりは、消す対象のパスの文字だけを見る。`C:\b\vscode\.git` が中にあっても `rm -rf C:/b` は止まらず、照らす前から clone ごと消せてしまう。代わりに、次の段 v2-2 で直下の15個を名指しした行と、完全一致の `rmdir C:/b` を使う（中に名指しの外の物が残っていれば失敗する）。 |
| secret_paths（依頼の3の3） | 足さない。tmp/b に秘密を置かない作りのため。判定役については、上の read_paths の絞り込みで手当てした。 |

`1.146.0` と `dev-apply` の作業ツリーは fetch で取らない。HEAD がタグ `1.146.0` と同じ commit なので、取らなくても失われない。

## 3. C:\b を消す段（v2-2・v2-3。ユーザーが条件付きで承認済み。まだ当てていない）

**条件**: 次の3つがそろったら、課からユーザーに知らせる。張良がユーザーを通して知らせを受けて当てる。当てる前に C:/b の直下を数え直し、名前が変わっていればユーザーに改めて問う。

1. 蒙恬が fetch の1行目を1回、作業ツリーの10行を10回打つ。そのうえで for-each-ref を打ち、builds の8本と keep の10本があること、keep が survey の head と同じことを確かめる。
2. 課が次を確かめる。
   - 写していない5項目（`take-in`・`take-in-trial`・`notion-sync-trial`・`p4-watch`・`tmp`）の中身が要らないこと。
   - 12個の作業ツリーに、未コミットの変更と stash が無いこと。
   - reflog だけが指す commit が無いこと（下）。
3. ヴラドが「消してよい」と言う。

確かめの手順の全文（打つコマンド、照らす相手の取り方）は、Team の記録の `perm-proposal.md` の「v2-2 の前に課がする確かめ（ヴラドに渡す手順）」の節（85 行から）にある。どれも今の課の許可で打てる。ただし、次の reflog の確かめだけは例外。

**reflog の確かめは、ヴラドが1回だけ打つ**（ユーザー判断。蒙恬の許可は足さない）。

```
git -C C:/b/vscode rev-list --reflog --not --branches --tags HEAD worktrees/<id>/HEAD …
```

出力が空なら、reflog だけが指す commit は無い。打つときの注意:

- 作業ツリーの id は、フォルダの名前と同じとは限らない。`C:/b/vscode/.git/worktrees/*/HEAD` を Glob して取る。
- 先に `C:/b/vscode/.git/HEAD` が `ref:` で始まることを確かめる。clone 本体の HEAD が detached だと、見落とす。
- `--branches` は古い clone の全部の枝を指す。tmp/b/vscode に取り込んでいない枝（`units-a`・古い `main`）にだけ繋がる commit は出力に出ない。そうした commit を残すかは、下の U10 と合わせて決める。
- reflog の object が失われていても、終了コードは 0 になる。stderr の `references pruned commits` を見る。
- 未コミットの変更は rev-list に出ない。status での確かめが別に要る。

当てる中身:

- v2-2: 蒙恬から fetch の11行を外し、delete_paths に C:/b の直下15個の名指しの行と、bash_exact の `rmdir C:/b` を足す。曹参・大岡越前守の read_paths から `C:/b/` を外す。
- v2-3（rmdir の後）: 蒙恬から、`git -C C:/b/wt/* status`・for-each-ref・`rmdir C:/b`・C:/b の15行・read_paths の `C:/b/` を外す。

## 4. 課に確かめてほしいこと・知らせ

- **U9**: `tmp/b/wt-r2`（ほかに wt-r3・wt-r3b もある見込み）は、ずっと使う行（`tmp/b/wt/*`）の外にある。メンバーは直接 git・pnpm を打てず、消すこともできない。片づけを誰がいつ行うか（リーダーか、課の台本か）を決めてほしい。これからは `worktree remove tmp/b/wt/*` が通るので、作業ツリーは `tmp/b/wt/` の下に作れる。
- **U10**: 古い clone の枝のうち、`main`（本家の古い main）は取らない。本家から取り直せるため。`units-a` は `keep/wt-dev-a` として取れる。ほかに残したい ref（タグを含む）があれば、C:\b を消す前に知らせてほしい。
- **R22**: `take-in.mjs` の `--records-dir` で記録を `records/take-in/` の外へ向けると、絞った後の判定役は材料を読めず、不合格になる見込み。台本の警告の条件を直すか、`--records-dir` を使わない決まりにするかを課で決めてほしい。
- **U6（権限の外の気づき）**:
  - この PC は長いパスが無効（`LongPathsEnabled=0`）。tmp/b は C:\b より41文字長く、公式の木の3ファイルが上限を超える。
  - Node や pnpm は、モジュールを探すときに上へたどり、リポジトリの直下の `node_modules` も探す。
  - リーダーはフックの対象外なので、リポジトリの直下で `git clean -x` などを打つと tmp/b（clone を含む）が消える。作業ツリーでないフォルダで git を打つと、このリポジトリで動く。
- **持ち越した穴（R3）**: 置き換えで持ち越した前方一致の広さ（`worktree add … -B` で既存の枝を付け替えられる、など）は、今回は絞っていない。絞るなら別に依頼してほしい。そのときは、使う形を蒙恬に聞いてから完全一致の形にする。

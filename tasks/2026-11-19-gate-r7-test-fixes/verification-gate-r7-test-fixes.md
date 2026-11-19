# 確かめ: r7 の関門の指摘 T1・T2 のテストの直し（曹参）

- 検証: 大岡越前守、2026-11-19
- 依頼: リーダー（このフォルダの `brief.md` と `handoff-notes-cao-shen.md`）
- 相手: 曹参の変更 `tests/l10n-audit-more.test.mjs`・`tests/smoke/lib/run.mjs`・`tests/smoke.test.mjs`（`git status` で見て、テストとコードの変更はこの3つだけ。`tests/probe-dns.ps1` の変更は前からあるもの）
- コードは直していない。

## 判定

**合格**。T1・T2 とも、`brief.md` の完了条件を満たしている。

ただし、T2 には移行の前に知っておくべき点がある（4節の1）。旧の名前の場所（`%APPDATA%\Shuko`・`~/.shuko`）をフォルダの mtime で見るようになった。そのため、日常の Shuko を使っている間にスモークを流すと、偽の FAIL が出うる。合否には効かない（偽の FAIL は安全な側に倒れる）。だが、毎週の取り込み（take-in の手順6）を自動で回し始める前には、直しておくのがよい。

## 1. 差分と完了条件

| 完了条件 | 見たこと | 結果 |
|---|---|---|
| T1: 実物の既定の作業ツリーを、実際の置き方 `tmp/b/wt/<label>/w` に合わせる | `latestReal()` が `tmp/b/p2` の直下の名前を読む。名前の末尾が `-rN` の版のうち、`<名前>-win32-x64-<版>\resources\app\out\nls.keys.json` があるものから N が最大のものを選ぶ。作業ツリーは `tmp/b/wt/rN/w` にする。環境変数 `AIED_AUDIT_APP`・`AIED_AUDIT_WT` は今までどおり優先する | 合う |
| T1: 題と、飛ぶ理由の文の「r4」を直す | 題に `最新の版（<版>）` が入る。飛ぶ理由の文には版と作業ツリーのパスが入る。冒頭の注と周りの説明も直した | 合う |
| T1: 最新の版を決め打ちしない | 版の名前・`Sukuna`・`r7` の文字はコードに無い。`<名前>` は `-win32-x64-<版>` で終わるフォルダとして見つける | 合う |
| T2: `~/.<dataFolderName>`・`%APPDATA%\<nameLong>` も見る | `dailyWatchTargets(product, home, appData)` は、次の場所を見る。`~/.vscode/argv.json`・`~/.vscode-oss/argv.json`（前からのもの）、`~/<dataFolderName>`（フォルダ）とその `argv.json`、`%APPDATA%\<nameLong>`（フォルダ） | 合う |
| T2: 名前を版の product.json から求め、決め打ちしない | 呼び出しは `run.mjs` の 346・426 行の2か所で、どちらも `dailyArgvState(editor.productJson)`。`editor.productJson` は `resolveEditor` が版の `resources\app\product.json` から読んだもの。ほかに呼んでいる所は無い（`tests/`・`scripts/` を Grep で見た） | 合う |
| T2: 旧の `.shuko`・`%APPDATA%\Shuko` も見る（名前は組み立てて書く） | `'.' + 'shu' + 'ko'`・`'Shu' + 'ko'` で組み立てている。`rename-leftovers` の「除く場所の外に古い名前が残っていない」は通る | 合う |
| 日常の場所に何も作らない | `dailyArgvState` は `statSync` だけで、書く命令は無い。単体のテストは `tmp()` の一時の場所だけを使う。`l10n-audit-more` の実物のテストは読むだけ | 合う |
| 流した結果を残す | 引き継ぎに、`l10n-audit-more` 41/42 と、`smoke`＋`rename-leftovers` 86/87 が書いてある。下の2節で私が流した結果と合う | 合う |

## 2. 流したもの

| コマンド | 結果 |
|---|---|
| `node --test tests/l10n-audit-more.test.mjs`（環境変数なし） | 42件中 pass 41・skip 1。実物の3件（題は `最新の版（1.146.0-p5-c-all-r7）`）が、`tmp\b\p2\1.146.0-p5-c-all-r7\…\resources\app` と `tmp\b\wt\r7\w` に対して走って通った。飛んだのは古い 1.131.0 のパックの1件だけ（`AIED_AUDIT_OLD_PACK` が要る。前からの作り） |
| `node --test tests/smoke.test.mjs tests/rename-leftovers.test.mjs` | 87件中 pass 86・fail 1。落ちたのは既知の `.claude/agents/vlad-tepes.md` の8行目の1件（Team の開発部が直すまで）。足した2件（`dailyWatchTargets`・`dailyArgvState`）は通る |
| 実際のスモーク1回: `node tests/smoke-run.mjs --build <私が展開した r7> --label p5r7-fix --mode built --prime --baseline …/baseline-p5-c-all-r7.json --timeout 300 --keep-runs 40` | PASS 49 / FAIL 0（`tmp\b\smoke\runs\p5r7-fix-261119T060642\`）。`safety.daily-argv` の詳細は「前後で同じ: vscode, vscodeOss, ~/.sukuna, ~/.sukuna/argv.json, ~/.shuko, ~/.shuko/argv.json, %APPDATA%\Sukuna, %APPDATA%\Shuko」。つなぎ（`editor.productJson` を渡すこと）が実際に働き、版の名前から8つの場所を見ていると分かった。このときに日常の Shuko が動いていたかどうかは、私の許可では見られない |
| 全部の run-all（見張りあり）: `node tests/run-all.mjs --save tasks/2026-11-19-gate-r7-test-fixes/run-all-ooka.txt` | **3,075件、pass 3,070・fail 1・skip 4**。落ちたのは既知の `vlad-tepes.md` の1件だけ。見張り（`[guard]`）の通知は無い。r7 の関門のとき（3,073件、skip 7）と比べると、`smoke.test` が 80→82（足した2件）、`l10n-audit-more` の skip が 4→1（実物の3件が走るようになった）。ほかの数は同じ |

## 3. 気づいた点（直すかどうかは曹参とリーダーの判断）

- U1（低い）: `latestReal()` は、上流の版によらず `-rN` の N だけで最新を選ぶ。作業ツリーも N だけから `tmp/b/wt/rN/w` を作る。次の上流の版で番号を r1 から振り直すと、古い版の大きい rN が選ばれる。また、実物のテストの件数（本体 12,355 など）は 1.146.0 の値を決め打ちしているので、新しい版が選ばれると、飛ばずに落ちる。今の版の付け方では問題にならない。
- U2（低い、前からの作り）: 後の状態（`argvAfter`、426 行）は、エディタを止める前に取っている。止めるときに日常の場所へ書かれても見えない。今回の変更の前から同じ順で、T2 の範囲の外。

## 4. 曹参の未解決の2点の見立て

### 4.1 日常のエディタが動いていると FAIL になりうる

- **移行の前でも起こりうる**（曹参の引き継ぎは日常の Sukuna について書いているが、旧の名前の場所でも同じ）。今の日常は Shuko（r4）。直した照らしは `%APPDATA%\Shuko` と `~/.shuko` もフォルダの mtime で見る。Chromium の系統のエディタは、ユーザーのデータのフォルダの直下で設定のファイル（`Preferences`・`Local State` など）を「一時のファイルに書いて名前を替える」形で書き直す（推定。本家のソースでは確かめていない）。そうだとすると、日常の Shuko を使っている間はフォルダの mtime が変わり、スモークが `safety.daily-argv` で FAIL になる。
- 今回の1回のスモークは PASS だった。ただし、そのとき日常の Shuko が動いていたかは分からないので、起こらないことの根拠にはならない。
- 偽の FAIL は安全な側に倒れる（日常の場所に書いたことを隠さない）ので、版の合否を誤って通すことは無い。害は、スモークが落ちてやり直しになること。take-in の手順6（`scripts/take-in.mjs` の 892〜927 行）は、スモークの結果を取り込みの採否の材料にする。そのため、毎週の取り込みを自動で回すと、ユーザーがエディタを使っている時間に偽の不合格が出うる。
- **見立て: 移行（3.3の手順）そのものを止める理由にはならない**。移行ではスモークを流さないから。直すのは、**毎週の取り込みを自動で回し始める前（検知のタスクを登録する前）**がよい。直し方の案: 始めの時点で既にあるフォルダは「消えていないか」だけを見て、mtime は見ない。始めに無かったフォルダは「できていないか」を見る。`argv.json` はファイルとして mtime を見る。こうすれば、移行の前に `%APPDATA%\Sukuna`・`~/.sukuna` ができることは捕まえ、使っている日常のエディタでは落ちない。

### 4.2 フォルダの変化を mtime で見ている（直下の追加・削除しか分からない）

- 移行の前の目的（スモークが `%APPDATA%\Sukuna`・`~/.sukuna` を作って移行の台本を止めないこと）には足りる。この2つは今は無いので、「できたか」は有無で確実に分かる。移行の台本が止まるのも、この2つの有無と中身による。
- 移行の後は、既にあるフォルダの奥のファイルの書き換えを見逃す。ただし、スモークは `VSCODE_PORTABLE` と `--user-data-dir` で別の場所に書く作りで、この照らしは念のための守り。フォルダの中身を全部たどると、日常のエディタが使っている間は必ず変わるので、4.1と同じく偽の FAIL になる。
- **見立て: 移行の前に直す必要は無い**。4.1を直すときに一緒に、既にあるフォルダは見ない（4.1の案）と決めれば足りる。

## 5. 記録

- この文書: `tasks/2026-11-19-gate-r7-test-fixes/verification-gate-r7-test-fixes.md`
- 全部の run-all: `tasks/2026-11-19-gate-r7-test-fixes/run-all-ooka.txt`
- 実際のスモーク: `tmp\b\smoke\runs\p5r7-fix-261119T060642\smoke-result.md`（`tmp\b` は私の書き込みの許可の外なので、`.keep` は置いていない。`--keep-runs 40` で残る）

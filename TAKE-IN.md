# TAKE-IN.md — 取り込みのときに `claude -p` が守る規約

本家（microsoft/vscode）の新しい版や、同梱する拡張の新しい版を取り込むとき、`scripts/take-in.mjs` が `claude -p` を起動して、修理（当て直しと型検査の誤りを直す）と判定（採るかどうかを決める）をさせる。この文書はその両方が守る規約である。設計の正本は `docs/06-update-watch-and-take-in.md` の7節。

## 1. 共通の規約

1. 単位の意図（`removals/<id>/unit.json` の `intent`）を変えない。消す範囲を広げたり狭めたりしない。それが要るときは直さず、「要判断」として返す（修理なら `needsJudgment`、判定なら `conditions` か `reasons`）。
2. 衝突は本家側の変更を採り、そのうえで単位の意図どおりに参照を消す。
3. パッチは最小にする。整形・改名・ついでの修正を入れない。
4. 書き換えてよいのは、本家の作業ツリーと、ビルドリポジトリの `removals/` と `patches/` の中だけ。`switch.ps1` や `install-extensions.mjs` を実行しない。入れ替えは、判定の後に課が行う（2026-11-16 の裁定。前は「ユーザーが行う」）。
5. 拡張の圧縮された JS を読まない。拡張の判断は manifest・ファイルの一覧・ハッシュ・署名・実機の結果だけで行う。
6. 本家が足した部品（未分類の組み込み拡張、新しい contrib など）は、残すか、どの単位で消すかを提案するだけにする。自分で単位に入れない。
7. 材料に無い事実を推測で補わない。足りなければ足りないと書く。
8. コミットの名前は `shuko-apply <apply@shuko.invalid>` にする（docs/03 の5.2）。利用者の名前とメールをパッチの `From:` に残さないため。修理では git の操作（`add`・`am --continue`・`commit`・`format-patch`）を台本が行い、台本がこの名前を使う。自分で git の操作をしない。

## 2. 修理（手順 3・5）

- 作業の場所は本家の作業ツリー（`<buildRoot>\wt\<tag>`）。ビルドリポジトリは取り込みのブランチ `take-in/<label>` の作業ツリーで、追加の作業場所として渡される。
- 使える道具は読む・探す・編集だけ。`git diff` と `git status` の中身は依頼文に入っている。
- 当たらなかったとき:
  - `removeLines` が見つからない: 本家のファイルの今の行を読み、同じ参照を消す行に `unit.json` を書き換える。参照そのものが本家から無くなっていれば、その要素を消してよい（意図は変わらない）。
  - `edits.patch`・`patches/` の衝突: 作業ツリーの衝突の印（`<<<<<<<`・`=======`・`>>>>>>>`）を、本家側の変更を採ったうえでパッチの意図どおりに解く。印を残さない。台本が `git am --continue` と `git format-patch` でパッチを書き戻す。
- 型検査の誤り: 作業ツリーのファイルを直し、直したファイルごとに、どの単位（`unit:<ID>`）かパッチ（`patch:<ファイル名>`）の都合かを返す。分からなければ `unknown`（台本は止まる）。単位どうしを独立に保つ（docs/03 の5.3）: 単位のパッチは、その単位が消した部品への参照だけを直す。
- 単位の意図が本家の変更で消えたとき（例: 消す対象を本家が自分で消した）は、直さずに `needsJudgment` に書く。単位の README を直す提案はそこに書く。
- 返すもの: 構造化出力 `{ status: "fixed" | "partial" | "gave-up", summary, fixes: [{ file, owner, why }], needsJudgment: [] }`。

## 3. 判定（手順 9。判定役 狄仁傑）

- 作業の場所はビルドリポジトリの直下。材料は `records/take-in/<label>/` に台本が写したもの。依頼文 `records/take-in/<label>/judge-request.md` に一覧がある。
- 判定は3つ（docs/06 の7.3）:
  - **合格（pass）**: すべての検査・ビルド・自動のスモークが通り、許した宛先の外への接続が無い。条件が無い。材料が足りている。推奨は「入れ替えてよい」。
  - **条件付き（conditional）**: 合格だが、ユーザーが決めることがある（未分類の部品、新しい宛先、手で確かめる項目で特に注意が要るもの、など）。条件を `conditions` に書く。推奨は「条件を満たしてから」。
  - **不合格（fail）**: どれかが通らない、または材料が足りず判定できない。推奨は「見送る」。セキュリティ修正を含むときは、修正の重さと、この構成に関係するか（例: 消したリモートの機能の修正は関係が薄い）を書き、見送ってよいかの見立てを添える。壊れた単位を無効にした版を作る案があれば `conditions` に書く（決めるのはユーザー）。
- セキュリティ: 前回の取り込みから後のすべての版のアドバイザリについて、このエディタに残っている機能に関わるかを `security.relevantToThisBuild` に書く。関係が無いとするときは根拠（どの単位で消したか）を `why` に書く。
- 本家が足した部品（`checks.json` の `unclassifiedExtensions`・`upstreamAdditions`・`dependencies`）は `newUpstreamParts` に、`keep` か `removal-unit:<ID>` を提案として書く。
- 拡張の取り込みでは、`build`・`checks` を `n/a` にし、docs/04 の4節の項目（発行元、完全性、公式配布物との一致、寝かせる期間、manifest の差、ファイル一覧の差、ライセンス、ウイルスの走査、engines、スモーク）を見る。manifest に `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`debuggers`・`notebooks`・`enabledApiProposals`・`extensionDependencies` が増えていたら、消した機能に依存し始めた恐れとして書く。
- 返すもの: 構造化出力。docs/06 の7.3 の項目（`label`・`verdict`・`security`・`patches`・`checks`・`build`・`smoke`・`network`・`newUpstreamParts`・`conditions`・`recommendation`）に、`kind`・`reasons`（理由の要点。ToDo に写る）・`materialsRead`（読んだ材料のパス）・`missingMaterials`・`userChecksBeforeSwitch`（ユーザーが入れ替えの前に見るべき点）・`markdown`（`verdict.md` の本文。日本語。ユーザーが読む）を足したもの。
- `markdown` には、判定と推奨、理由、セキュリティ修正の扱い、変わったパッチ、本家が足した部品の提案、ユーザーが手で確かめる項目（docs/06 の5節の「手」）、入れ替えと戻し方（`node scripts/adopt.mjs <label>` → `switch.ps1 <label>`、戻すときは `switch.ps1 -Previous`）を書く。
- 日本語の未訳（4節）: 材料に `l10n-count.json`（`node scripts/l10n-ja.mjs count` の出力）があれば、`result`・`untranslated`（除外の外の未訳の数）・`byArea` の数を `markdown` と `reasons` に書く。**未訳があっても、それだけで不合格・条件付きにしない**（セキュリティの修正を遅らせないため。2026-11-17 のリーダーの判断）。`untranslated > 0` なら「入れ替えの前に課が訳を足して作り直す。急ぐセキュリティの修正なら、英語が残ったまま入れ替えて後で訳を足してよい」と書く。材料に無ければ「未訳は数えていない」と書く。この回の数えが失敗し、前の回の `l10n-count.json` だけが残っているとき（`take-in.json` の `l10n.staleOutput` が true）は、台本がそのファイルを材料から外す（古い数を読ませないため。2026-11-17 のリーダーの判断）。そのときも「未訳は数えていない」と書き、`take-in.json` の `l10n` の `status` と `reason` を添える。材料から外した `l10n-count.json` を自分で読みにいかない。これも `missingMaterials` に入れず、判定を下げる理由にしない。訳を作ったり、訳を提案したりしない（訳すのは課）。

## 4. 日本語パック（本体の版が上がったとき）

日本語の言語パックは自前の組み込み拡張 `extensions-src/language-pack-ja/`（`shuko.language-pack-ja`）。本体と同じ版の文言を、公式の訳（vscode-loc。MIT）と課が足した訳（`added/<版>.json`）で埋める。作り方は `tasks/2026-11-17-l10n-ja/l10n-design.md`、台本は `scripts/l10n-ja.mjs`（純粋な部品は `scripts/lib/l10n-ja.mjs`）、正本の決まりは docs/04 の7節。

未訳を数えること（4.2 の2・3）は、`take-in.mjs` がビルドの後に自動で行う。訳を足して作り直すこと（4.2 の1・4〜8）は、課（蒙恬）が手で行う。修理（2節）と判定（3節）の `claude -p` は、訳を作らず、`extensions-src/language-pack-ja/` を書き換えない（2026-11-17 のリーダーの判断: 訳すのは蒙恬で、自動にしない。数えるのは台本）。

### 4.1 決まり

1. 未訳が残っても採否は止めない。判定には未訳の数を書く（3節）。
2. 入れ替えの前に、課が訳を足して作り直すのを基本とする。急ぐセキュリティの修正では、英語が残ったまま入れ替えて、後で訳を足した版を作ってよい。
3. 日本語パックの新版を見張る項目（vscode-loc の commit や PR の検知）は `tools/watch` に足さない。新しい訳の元は、本体の版を取り込むときに探す。
4. 足した訳は版ごとのファイル（`added/<版>.json`）に置き、前の版のファイルは消さない。訳したときの英語（`en`）は台本が文言の表から写す（手で写さない）。
5. 合格の条件は、除外の外の未訳 0（`count` の `result: ok`、終了コード 0）。除外（`exclusions.json`）は項目ごとに理由を書く。訳す言葉が無いもの（`{0}: {1}` の形など）だけを除外にする。

### 4.2 手順

`<tag>` は本家の新しい版、`<出力>` はその版のビルドの出力（gulp の出力か、zip を展開したもの）、`<作業ツリー>` はその版の本家の作業ツリー。

1. **新しい訳の元を探す**。vscode-loc（https://github.com/microsoft/vscode-loc）の main の新しい "Updated strings" の commit を探す。main に無ければ、open の bot の PR（作者 `azure-pipelines[bot]`、題 "Updated strings from microsoft/vscode-loc-drop@..."）の最も新しい head を探す。今より新しいものがあれば、`extensions-src/language-pack-ja/sources.json` の先頭の項目の `commit`・`ref`・`date`・`note` を書き換え、`node scripts/l10n-ja.mjs fetch --update-lock` で取り直す（ファイルごとの SHA-256 が書き込まれる）。新しいものが無ければ `node scripts/l10n-ja.mjs fetch`（固定の値と照合する）。
2. **文言の表を作る**（自動。`take-in.mjs core` がビルド（手順 5）の後に走らせる）:
   ```
   node scripts/l10n-ja.mjs extract --app <出力>\resources\app --worktree <作業ツリー> --label <label> --out <buildRoot>\take-in\<label>\l10n-strings.json
   ```
   拡張のソースの `\uXXXX` は実行時と同じ文字に直して読む（`@vscode/l10n-dev` の読み誤りの直し）。直して鍵が変わったものは表の `bundleDetail.<ID>.escapeFixes` に出る。公式の訳の束は読み誤った鍵のままなので、`runtime` の鍵は未訳として 4 に出る。訳して足す（除外で隠さない。2026-11-17 のリーダーの判断）。取り込みの外で作った版では、同じコマンドを手で打つ（`--out` は `tmp\l10n\strings-<label>.json` など）。
3. **数えて、判定の材料に置く**（自動。2 の続き）:
   ```
   node scripts/l10n-ja.mjs count --strings <buildRoot>\take-in\<label>\l10n-strings.json --pack <出力>\resources\app\extensions\language-pack-ja --out records\take-in\<label>\l10n-count.json
   ```
   結果は `records/take-in/<label>/l10n-count.json`（判定の材料。3節）と、`take-in.json` の `l10n`（`status` は `ok`・`untranslated`・`failed`、`untranslated`・`byArea`・`placeholderProblems` の数）に書かれる。`ok` でなければ `take-in.json` の `warnings` にも1行入る。数えるのに失敗しても、取り込みは止まらない（記録に `failed` と理由が残る。そのときは課が 2・3 を手で打つ）。ログは `records/take-in/<label>/logs/l10n-extract.log`・`l10n-count.log`。
4. **訳す仕事の一覧を出す**:
   ```
   node scripts/l10n-ja.mjs todo --strings tmp\l10n\strings-<tag>.json --out tmp\l10n\todo-<tag>.json
   ```
   未訳、`staleAdded`（足した訳の英語が変わったもの）、`staleExclusions`（除外の英語が変わったもの）の3つが訳す仕事。`redundantAdded`（公式の訳が追いついた足した訳）が出たら、その項目を `added/` から消してよい。
5. **訳を足す**。入力（`{ translate: { "<owner>#<key>": "<訳>" }, override: { ... }, exclude: { "<owner>#<key>": { reason, note } } }`）を作り、
   ```
   node scripts/l10n-ja.mjs add --strings tmp\l10n\strings-<tag>.json --input <入力> --version <tag>
   ```
   で `added/<tag>.json` と `exclusions.json` に書く。訳語は公式の訳の言い回しにそろえる（`l10n-design.md` の3.3の表）。印（`{0}`・`{name}`・`&&`・`$(name)`・Markdown のリンクの先）は英語と同じ数だけ残す（台本が照らし、合わなければ止まる）。公式の訳が英語のままの普通の言葉は `override` で日本語にしてよい。製品名・略語・キーの名前・公式でも英字で書く機能の名前はそのままにする。
6. **束を作り直す**:
   ```
   node scripts/l10n-ja.mjs build --strings tmp\l10n\strings-<tag>.json
   ```
   終了コード 0（除外の外の未訳 0、`staleAdded` 0、印の不一致 0）で終わることを確かめる。`package.json` の `version` と `engines.vscode` を本体の版にそろえる（台本は translations だけを合わせる）。`ThirdPartyNotices.txt` は、台本が `sources.json` のすべての訳の元（下の層の vscode-loc の main・Open VSX も）を出典に書き、vscode-loc の `LICENSE.md` を写して作る。訳の元の種類を増やしたら、表示の書き方（`scripts/lib/l10n-ja.mjs` の `thirdPartyNotice`）も直す。
7. **本体を作り直す**。パックは組み込みの拡張なので、`dist/translations/` を作り直したら、本体のビルドを apply からやり直す（`node scripts/build.mjs <tag> ... --from apply` か、新しいラベルで初めから）。前の週の版で先に 4〜6 を済ませておくと、作り直しを1回で済ませられる。
8. **作り直した版で確かめる**: 2・3 を新しい出力でもう一度走らせ、`count` が `result: ok`（終了コード 0）になることを見る。曹参の網（`tests/l10n-audit.mjs`）でも同じ結論になることを、関門で大岡越前守が確かめる。

### 4.3 入れ替えのときに見ること

- 古い Open VSX の日本語パック（`MS-CEINTL.vscode-language-pack-ja`）が利用者の拡張に入っていれば外す（入ったままだと、後から読まれる古い訳が勝つ）。外す操作は許可を持つ者が行う。
- `%APPDATA%\Shuko\languagepacks.json` の `ja` の `translations.vscode` が、新しい版の `resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json` を指すことを確かめる。言語パックの一覧は起動のたびに作り直されるので、日本語になるのは入れ替えた後の2回目の起動からの見込み。

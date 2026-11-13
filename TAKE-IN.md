# TAKE-IN.md — 取り込みのときに `claude -p` が守る規約

本家（microsoft/vscode）の新しい版や、同梱する拡張の新しい版を取り込むとき、`scripts/take-in.mjs` が `claude -p` を起動して、修理（当て直しと型検査の誤りを直す）と判定（採るかどうかを決める）をさせる。この文書はその両方が守る規約である。設計の正本は `docs/06-update-watch-and-take-in.md` の7節。

## 1. 共通の規約

1. 単位の意図（`removals/<id>/unit.json` の `intent`）を変えない。消す範囲を広げたり狭めたりしない。それが要るときは直さず、「要判断」として返す（修理なら `needsJudgment`、判定なら `conditions` か `reasons`）。
2. 衝突は本家側の変更を採り、そのうえで単位の意図どおりに参照を消す。
3. パッチは最小にする。整形・改名・ついでの修正を入れない。
4. 書き換えてよいのは、本家の作業ツリーと、ビルドリポジトリの `removals/` と `patches/` の中だけ。`switch.ps1` や `install-extensions.mjs` を実行しない。入れ替えはユーザーが行う。
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

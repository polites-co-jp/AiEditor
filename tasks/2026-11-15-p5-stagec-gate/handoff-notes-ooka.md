# 引き継ぎの書き付け（大岡越前守）: 段階 C をまとめた版の関門

- 作成: 大岡越前守（2026-11-16。時刻は UTC）
- 依頼: brief の「3. 関門」「3'.」。相手は蒙恬の `1.146.0-p5-c-all`（R2-7）
- 結果: **不合格**。原因は C-1-ai。C-2〜C-7 は 1・2 が合格で、3・4 は C-1 の誤りのせいで判定できない
- 記録: `records/take-in/1.146.0-p5-c-all/`（`gate-p5-c-all.md` が全体。単位ごとに `gate-C-1-ai.md`〜`gate-C-7-breadcrumbs-outline.md`）
- 直した版の関門は、このファイルの末尾の「r2」「r3c」の節

## 1. 要点

1. 当たる・型検査とビルドは合格。21単位すべて `applied: ok`、型検査の誤り 0、パッケージ化と zip は終了コード 0、ロックファイルは ok。照らし役 c1〜c7 の中身の項目は全部期待どおり（c2〜c5 は「後の単位が当たっている」ことだけを食い違いに出す。照らし役が21単位の組を持たないため）。
2. zip から展開して起動した。プロセスは生きている（`p1-launch-check.ps1` は ok）。ただし、**ワークベンチが起動しない**。開発者ツールのコンソールに、ただ1行の誤り `Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'chatExtensionId')` が出る。renderer.log は空で、共有プロセスと拡張ホストは起動しない。
3. **CLI の `--install-extension` が全部落ちる**: `i.builtInExtensionsEnabledWithAutoUpdates is not iterable`。
4. 原因: C-1 の `productRemove` が product.json から `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` を外した。一方で、残った本家のコードがこの2つを `?.` なしで読んでいる。`services/accounts/browser/defaultAccount.ts` の `toDefaultAccountConfig` と、`platform/extensionManagement/common/extensionsScannerService.ts` の113行だ。型では省略できないキーなので、型検査にも静的なテストにも掛からなかった。出力の1847行がコンソールの誤りの行と一致することまで確かめた。
5. このため、消えているの起動して見る項目、スモーク（Claude Code の組・UNKNOWN service・Missing proxy instance・全文検索・拡張の一覧・設定の画面・タブと差分エディタ・台帳の拡張）、各単位の台本の「関門の起動の確かめ」は、1つも行えていない。

## 2. 流したもの

| 何 | コマンド | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all.zip` | 一致 |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/checks.json`（c1〜c7） | c1・c6・c7 は期待どおり。c2〜c5 は後の単位の分だけ食い違い |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt/1.146.0`（c1〜c7） | 7つとも期待どおり |
| 静的なテスト | `node tests/run-all.mjs --no-ps --only -unit`、`--only removals` | 282/282、229/229 pass |
| 展開と起動 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all.json -Zip <zip> -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all` | `result: ok`（プロセスだけを見る） |
| スモーク1回目 | `node tests/smoke-run.mjs --build <展開先> --label p5-c-all-1 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all.json --timeout 300 --keep-runs 40`（パスは絶対パスで渡した） | PASS 8 / FAIL 8。`tmp\b\smoke\runs\p5-c-82f-261116T024952\`（`.keep` を置いた） |
| 消えている | `node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5-c-all-21` | snapshot が取れず timeout（終了コード 2） |
| C: の空き | `node scripts/disk-usage.mjs records=records` | 96.33 GB（03:02） |

## 3. 飛ばしたもの（理由）

| 何 | 理由 |
|---|---|
| スモークの2回目・3回目と3回の和の基準 | 起動を3回（prime・本番・absent）行い、3回とも同じく立ち上がらなかった。product.json にキーが無いことによる決まった誤りで、回を重ねても変わらない。基準は、C-1 を直した版で作る（`baseline-p5-c-all.json` はまだできていない） |
| 通信の監査（netaudit） | ワークベンチも拡張ホストも動かない版の監査では、関門の条件（Claude・git・Notion のほかへ通信しない、absentHosts、続きの編集の通信）を判定できないため。権限の問題ではない。直した版で流す |
| 各単位の台本の「関門の起動の確かめ」 | ワークベンチが起動しないため、どれも行えない |

許可の外で止まったものは無い。ほかに、確かめの途中で `ls`・`head`・`cd`・パイプの形がフックに止められ、Glob・Read・単体のコマンドで代えた（関門の結果には響いていない）。`run_in_background` の出力のファイルと、大きな出力を移した先（どちらも `C:\Users\…` の下）は read_paths の外で読めなかった。そこで、前で流す形と `run-all.mjs` のまとめで代えた。

## 4. 直す必要があるところ

| 誰 | どこ | 何を |
|---|---|---|
| 蒙恬 | `removals/C-1-ai/unit.json` の `productRemove`（254〜261行）と `edits.patch` | `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` の読み手を直すか、キーを外すのをやめる（空の値を置く案もある）。同じ形の読み手（`gate-C-1-ai.md` の表の6か所）もまとめて見る。どちらの案にするかは、裁定の「product.json の AI のキーは消す」との兼ね合いがあるので、リーダーが決める（`defaultChatAgent` には URL が入っていて、残すと通信の元になりうる） |
| 曹参 | `tests/c1-unit.test.mjs` | 「`productRemove` のキーを、残る `src/` が `?.` や既定値なしで読んでいない」ことの検査を足す |
| スモークの台本の持ち主（リーダーが決める） | `tests/smoke/lib/common.mjs` の `extractChromiumErrors` | `chromium.log` の `ERROR`・`FATAL` の行だけを拾う。この Electron ではコンソールの誤りも `INFO:CONSOLE` で出るので、今回の `Uncaught (in promise) TypeError` を数えず、`errors.new` が PASS になった。`depends on UNKNOWN service` がログのサービスより前に出ると、同じ穴に落ちる |
| 起動の確かめの持ち主 | `scripts/p1-launch-check.ps1` | プロセスが生きているかだけを見る。ワークベンチが立ち上がったかは見ない（今回は ok と出た） |
| 曹参 | `tests/c2-check-json.mjs`〜`c5-check-json.mjs` | 21単位の組が無い。段階 C をまとめた版を照らすなら、組を足すか、後の単位を許す形にする |

## 5. 次の担当への注意

- C-1 だけを無効にした版は作れない。C-3〜C-7 が `after` に C-1 を挙げているので、無効にすると C-2 しか残らない。
- C-1 を直した版でもう一度関門を流すときは、スモーク3回（1回目・3回目は `baseline-p2-all.json`、2回目は `baseline-official-1.146.0.json` と比べる）、`absent-run` の21単位、netaudit（関門の環境 `tasks/2026-11-14-p2-gates/netaudit-env` と、台帳の拡張あり）、各単位の台本の5節（C-3 は4節）を流す。
- C-7 の「2回続けて通らなければ諮る」の数え方: 今回は C-7 を確かめていない。数えない方が事実に合う（`gate-C-7-breadcrumbs-outline.md`）。リーダーが決める。
- 展開した版 `tmp\b\p2\1.146.0-p5-c-all\`（portable を含む）、スモークの拡張のフォルダ `tmp\b\smoke\ext\1.146.0-p5-c-all-1\`（入らなかったので中身はほぼ空）、`tmp\b\smoke\absent\p5-522-261116T025823\` は残してある。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。`C:\b` には触れていない。普段使いのデータは、起動の確かめ（6つのフォルダが不変）とスモークの `safety.daily-argv`（PASS）で見た。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。netaudit を流していないので、ネットのログは作っていない。秘密の場所には触れていない。

---

# r2（2026-11-16。直した版 `1.146.0-p5-c-all-r2`）

- 依頼: リーダー（タスクの名称「段階 C の版の関門（r2）」）。相手は蒙恬の `1.146.0-p5-c-all-r2`（`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md`）
- 結果: **不合格**。原因は C-1-ai（7節の4）。**C-2〜C-7 は自動で見られる関門 1〜4 をすべて通った**（手の項目が残る）
- 記録: `records/take-in/1.146.0-p5-c-all-r2/`（`gate-p5-c-all-r2.md` が全体、単位ごとに `gate-C-1-ai.md`〜`gate-C-7-breadcrumbs-outline.md`、手の項目 `manual-checks-p5-c-all-r2.md`）

## R2-1. 要点

1. 前回の2つの症状は直った。ワークベンチが立ち上がり（新しい起動の確かめで、しるし3つと `Uncaught` 0）、CLI の導入は台帳の拡張がすべて通る。C-1 の直し（8ファイル。省略できる型と `?.`）は、裁定「product.json の AI のキーは消す」を守った形。
2. 1・2 は合格。照らし役 c1〜c7（曹参が足した21単位の組 c を含む）は全部期待どおり。型検査の誤り 0。静的なテストは c1〜c7-unit 292/292（c1-unit 53/53。依頼文の「直している最中の2件」は直っていた）、removals 229/229、smoke 79/79、p1 の3つ 50/50。
3. 3 は合格。absent の21単位で fail 0・unknown 0（19単位。公式の版で網になっていることも確かめた。C-1 の2項目は網にならず、ソースの検査を根拠にした）。通信の監査2通り×600秒で、エディタの宛先 0・claude の宛先 0・許可の外 0・前の版に無い宛先 0。absentHosts、ギャラリーのホスト、同期のストアへの接続も名前の問い合わせも無い。**続きの編集の通信も無い**（裁定で諮る条件に当たらない）。
4. 4 は **C-1 で不合格**。スモーク3回とも、前の段階に無い誤りが同じ3種出た。
   - `depends on UNKNOWN service terminalChatService`（ターミナルのタブのビューが作れない。C-1 が `terminalContrib/chat` を消し、何もしない実装が無い）
   - `Cannot read properties of undefined (reading 'semanticSearchBehavior')`（全文検索の欄の入力の聞き手。C-1 が `search.searchView.*` の設定を消した）
   - `command '_chat.editSessions.accept' not found`（git のステージ・コミットのたび。C-1 が `contrib/chat` を消した）
5. 4 のほかの項目はすべて通った。Claude Code の組（3回とも起動・拡張ホストのログ・.lock）、`vscode.lm`・`vscode.chat`・`vscode.debug` の誤りなし、`Missing proxy instance` なし、ほかの単位の UNKNOWN service なし、台帳の拡張（PowerShell・basedpyright ほか）と言語の組、全文検索・分割・差分・2つめのウィンドウ・git・ターミナル・タスク、「知らない contributes」の警告なし。
6. 3回目だけ `base.ui-language` が落ちた（翻訳の束の置き場ができず英語）。原因未確認の揺れとして記録した（単位の合否には使わない）。

## R2-2. 流したもの

| 何 | コマンド（パスは絶対パスで渡した） | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r2.zip` | 一致 |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/checks.json`（c1〜c7） | 7つとも期待どおり |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt-r2/1.146.0`（c1〜c7） | 7つとも期待どおり |
| ロックファイルの差 | `sha256sum` で前の版と r2 の `lockfile.diff` | 同じ |
| 静的なテスト | `node tests/run-all.mjs --no-ps --only -unit`・`--only removals`・`--only smoke`・`--only p1-` | 292/292、229/229、79/79、50/50 |
| 展開と起動・CLI の導入 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all-r2-ooka.json -Zip <zip> -Dest tmp/b/p2/1.146.0-p5-c-all-r2-ooka -InstallExtension <7つの VSIX>` | `result: ok`（ワークベンチが立ち上がり、7つとも導入） |
| スモーク3回 | `node tests/smoke-run.mjs --build <展開先> --label p5r2-1/2/3 --mode built --prime --baseline <p2-all・公式・p2-all> --save-baseline tmp/b/smoke/baseline-p5-c-all-r2.json [--merge-baseline] --timeout 300 --keep-runs 40` | 48/1、48/1、47/2。置き場所に `.keep` を置いた |
| 消えている | `node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5r2-21` | fail 0・unknown 0 |
| 網の確かめ | `node tests/absent-run.mjs --units <C の7単位> --expect present --label off-c-present`（公式の版） | C-1 の2項目を除いて全部在る |
| 通信の監査 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開先>/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r2 -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2-all` と、`-EnvDir C:/b/p0/data/upstream-default -Label p5r2-ledger -Previous records/network-audits/2026-11-15-p2-all-ledger` | 2通りとも宛先 0。ネットのログは消えた |
| C: の空き | `node scripts/disk-usage.mjs records=records` | 95.86 GB（04:26）、95.60 GB（04:38） |

許可の外で止まったものは無い。飛ばしたものも無い。各単位の台本の「関門の起動の確かめ」のうち、画面を見て操作する項目（タブの帯の見た目、右クリックのメニュー、設定の画面の見た目など）は自動では見られないので、手の項目 C1〜C21 に分けた。これは C-1 を直した次の版でユーザーが行う。

## R2-3. 直す必要があるところ

| 誰 | どこ | 何を |
|---|---|---|
| 蒙恬 | C-1 の `edits.patch` | (1) `ITerminalChatService` の何もしない実装を登録する（またはターミナルの2ファイルの注入を外す）。(2) `searchView.ts` の 695・2002・2008 行を、`searchView` が無くても落ちない形にする（`?.`、または設定の型の `searchView` を省略できる形に）。(3) `_chat.editSessions.accept` を何もしないコマンドで残すか、git の拡張の2か所の呼び出しを外す（B-1 の `_aiEdits.*` の直し方に合わせる） |
| 曹参 | C-1 のテスト | 消した部品の「サービスの ID の注入」「設定のキーの読み手」「コマンドの呼び手（組み込みの拡張を含む）」が残っていないことを見る静的な検査が無い |
| 曹参 | `tests/smoke/lib/common.mjs` の誤りの鍵 | devtools-console の鍵に版の置き場所のパスがそのまま入る。置き場所の違う版どうしで同じ誤りが「新しい誤り」に見えるので、パスをそろえるとよい |

## R2-4. 次の担当への注意

- `tmp\b\smoke\baseline-p5-c-all-r2.json`（3回の和、鍵10個）は C-1 の誤りを含む。次の版の比べの相手にしない。次の版のスモークも、1回目・3回目は `baseline-p2-all.json`、2回目は `baseline-official-1.146.0.json` と比べ、和は新しいファイルに作る。
- C-1 を直した次の版で流すもの: スモーク3回、absent の21単位、監査2通り（各600秒）。直しが C-1 の edits.patch の中だけなら、照らし役と監査の結果は変わらない見込み（推定。流し直して確かめる）。合格したら、手の項目（`records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`。版の名前を読み替える）をユーザーへ。
- base.ui-language の揺れ（3回目だけ）は、次の版でもう一度見る。2回以上出たら調べる。
- C-7 の「2回続けて通らなければ諮る」: 今回、C-7 の自動の関門で落ちた所は無い。
- 残してあるもの: `tmp\b\p2\1.146.0-p5-c-all-r2-ooka\`（起動の確かめの展開と portable）、`tmp\b\smoke\runs\p5r2-{1,2,3}-*`、`tmp\b\smoke\ext\1.146.0-p5r2-{1,2,3}\`、`tmp\b\smoke\absent\p5rdf7-*`・`off362-*`。

## R2-5. 守ったこと

- コード・テスト・台本・docs/ は直していない。
- `C:\b` は読むだけ（監査の環境の写しの元 `C:\b\p0\data\upstream-default`）。書いていない。
- 普段使いのデータは、起動の確かめで6つのフォルダが変わらないこと、スモークの `safety.daily-argv` が3回とも PASS であることで確かめた。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。秘密の場所には触れていない。ネットのログは台本が読んだ直後に消した（`tmp\b\netlog\` は空）。
- C: の空きは 96.33 GB から 95.60 GB に減った。何が増えたかは、私の読める場所の外で分からない（Claude Code を入れたスモーク・監査の間。推定）。

---

# r3c（2026-11-16。r2 の C-1 の3種を直した版 `1.146.0-p5-c-all-r3c`）

- 依頼: リーダー（タスクの名称「段階 C の版の関門（r3c）」）。相手は蒙恬の `1.146.0-p5-c-all-r3c`（HEAD `827a712b`。書き付けの「r3」）。r3・r3b は使っていない
- 結果:
  - **起動した版の振る舞い（7節の1〜4、21単位）: 合格**。r2 の3種の誤りは、同じ道を通しても出ない
  - **網: c1-unit の2件が落ちる**（ほかの静的なテストは全部通る）
  - **総合: C-2〜C-7 は合格。C-1 は保留**（振る舞いは合格。検証が落ちたままなので合格にしない）
- 記録: `records/take-in/1.146.0-p5-c-all-r3c/`（`gate-p5-c-all-r3c.md` が全体、単位ごとに `gate-C-1-ai.md`〜`gate-C-7-breadcrumbs-outline.md`、手の項目の追加 `manual-checks-p5-c-all-r3c.md`）

## R3C-1. 要点

1. 1・2 は合格。照らし役 c1〜c7（当て直し・作業ツリー）は全部期待どおり。型検査の誤り 0。ロックファイルの差は r2 と同じ。C-1 の直しは、リーダーの判断どおりの形（何もしない `NullTerminalChatService`、`searchView?.` と型 `searchView?:`、何もしない `_chat.editSessions.accept`）に加え、蒙恬が見つけた3つ（`AgentNetworkFilterService` のワークベンチへの登録、何もしない `viewHiddenChatTerminals`、アカウントのメニューの MCP の項目の削除）。
2. 3 は合格。absent の19単位で fail 0・unknown 0。監査2通り（関門の環境、台帳の拡張と Claude Code を含む）×600秒で、エディタの宛先 0・claude の宛先 0・許可の外 0・r2 に無い宛先 0。続きの編集の通信も無い。
3. 4 は合格。スモーク3回とも PASS 49 / FAIL 0。3回の和の新しい基準 `baseline-p5-c-all-r3c.json` は鍵2個（DEP0169・DiffEditorWidget。公式と p2-all の基準にある既知のもの）。**`baseline-p5-c-all-r2.json` は使っていない**（依頼の2）。r2 で各回8件あった `UNKNOWN service` は0件。`Missing proxy instance` も無い。Claude Code の組は3回とも PASS。r2 の3回目の `base.ui-language` の揺れは、今回は3回とも出なかった。
4. **r2 の3種の道を通した（依頼の1）**。スモークの probe の道を、r2 の誤りの呼び出し履歴と照らした。
   - ターミナルのタブのビュー: `base.terminal`（`createTerminal` → `createGroup` → `_createTabsView`）
   - 検索の欄に打つ検索: `base.search`・`base.replace`（`findInFiles` → `setSearchParameters` → `onValueChange` → `onSearchInputChanged` → `submitSearch`。欄に打ったときも `onValueChange` 以降は同じ）
   - git のステージとコミット: `base.git`（Git.log に `git add -A -- tracked.txt` と `git … commit …` がある）
   - 3つとも3回 PASS し、誤りは出なかった。
5. **網（依頼の3）**: c1-unit は 59件中 57 pass・2 fail。
   - 「消した部品の使い手」の網は18件を数えた。1件ずつ見て、どれも実害が無い。`IInstantiationService` の注入16件は網の誤検出（`instantiationService.ts` 46行で集まりが自分を登録する）。`IGitHubService` は共有プロセスに登録が残る（`sharedProcessMain.ts` 341行）。`workbench.action.unifiedQuickAccess` は `try/catch` で守られた、直さないと決めた呼び出し。→ 曹参の網の直しで片づく。
   - 「edits.patch の形」は、どこが合わないかを私の読める形で取り出せなかった（c1-unit は3分を超えて背景に回り、背景の出力は読めない。run-all のまとめは名前だけ）。版は正しく当たっているが、本家が同じ所を変えた週の取り込みで当たらない恐れがある。→ 蒙恬が format-patch し直すか、曹参が落ちた場所を出す。
6. 統合ブラウザ（`AgentNetworkFilterService`）は、スモークも absent も開かない。手の項目 C22 に足した。

## R3C-2. 流したもの

| 何 | コマンド（パスは絶対パスで渡した） | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r3c.zip` | 一致 |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3c/checks.json`（c1〜c7） | 7つとも期待どおり |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt-r3c/1.146.0`（c1〜c7） | 7つとも期待どおり |
| ロックファイルの差 | `sha256sum` で r2 と r3c の `lockfile.diff` | 同じ |
| c1-unit | `node tests/run-all.mjs --no-ps --only c1-unit --save tasks/2026-11-15-p5-stagec-gate/c1-unit-r3c.txt` | 59件、57 pass・2 fail |
| 網の報告 | `node tests/orphans-report.mjs C-1-ai --out tasks/2026-11-15-p5-stagec-gate/orphans-C-1-r3c.txt` | サービス 17・設定 0・コマンド 1（上の5） |
| ほかの静的なテスト | `node tests/run-all.mjs --no-ps --only c2-unit`〜`c7-unit`・`--only removals`・`--only smoke`・`--only p1-` | 58・28・55・42・30・26、229、80、50。全部 pass |
| 展開と起動・CLI の導入 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all-r3c-ooka.json -Zip <zip> -Dest tmp/b/p2/1.146.0-p5-c-all-r3c-ooka -InstallExtension <7つの VSIX>` | `result: ok` |
| スモーク3回 | `node tests/smoke-run.mjs --build <展開先> --label p5r3c-1/2/3 --mode built --prime --baseline <p2-all・公式・p2-all> --save-baseline tmp/b/smoke/baseline-p5-c-all-r3c.json [--merge-baseline] --timeout 300 --keep-runs 40` | 49/0、49/0、49/0。置き場所に `.keep` を置いた |
| 消えている | `node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5r3c-21` | fail 0・unknown 0 |
| 通信の監査 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開先>/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r3c -DurationSeconds 600 -Previous records/network-audits/2026-11-16-p5r2` と、`-EnvDir C:/b/p0/data/upstream-default -Label p5r3c-ledger -Previous records/network-audits/2026-11-16-p5r2-ledger` | 2通りとも宛先 0。ネットのログは消えた |
| C: の空き | `node scripts/disk-usage.mjs records=records` | 98.67 GB（07:11） |

許可の外で止まったものは無い。飛ばしたものも無い。読めなかったもの: c1-unit の落ちた検査の中身（3分を超えて背景に回った出力は、私の読める場所の外になる）。

## R3C-3. 直す必要があるところ

| 誰 | どこ | 何を |
|---|---|---|
| 曹参 | `tests/gate-orphans.mjs`（c1-unit の使い手の網） | `IInstantiationService`（集まりが自分を登録する）を数えない。`sharedProcessMain.ts` の `services.set(IGitHubService, …)` のような、edits.patch が直すファイルの中に残る登録を「残る登録」と数える。`workbench.action.unifiedQuickAccess` を理由つきの例外にする（`try/catch` で守られている） |
| 蒙恬（または曹参） | `removals/C-1-ai/edits.patch` の形（c1-unit の2件目） | ハンクの行数と2通りの読み手が合わない所がある。蒙恬が許可のある作業ツリーで format-patch し直す（空の文脈の行と `index` の行が入る）か、曹参が落ちたハンクの場所を出力に出す。どちらにするかはリーダーが決める |

## R3C-4. 次の担当への注意

- C-1 の保留が片づいたら、C-1 も合格にできる。edits.patch の書き方だけを直して作り直した版なら、照らし役 c1〜c7 とスモーク1回で振る舞いが同じことを見れば足りる見込み（推定。中身が変わるなら全部流し直す）。
- 比べの相手: 次の版のスモークは、`baseline-p5-c-all-r3c.json`（鍵2個。C-1 の誤りを含まない）を前の段階の基準に使ってよい。
- 手の項目: `records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`（C1〜C21。版の名前を r3c に読み替える）と、`records/take-in/1.146.0-p5-c-all-r3c/manual-checks-p5-c-all-r3c.md`（C22 の統合ブラウザ）。
- C-7 の「2回続けて通らなければ諮る」: r2・r3c とも、C-7 の自動の関門で落ちた所は無い。
- 残してあるもの: `tmp\b\p2\1.146.0-p5-c-all-r3c-ooka\`、`tmp\b\smoke\runs\p5r3c-{1,2,3}-*`、`tmp\b\smoke\ext\1.146.0-p5r3c-{1,2,3}\`、`tmp\b\smoke\absent\p5rc63-*`。

## R3C-5. 守ったこと

- コード・テスト・台本・docs/ は直していない。`C:\b` は読むだけ（監査の環境の写しの元）。
- 普段使いのデータは、起動の確かめで6つのフォルダが変わらないこと、スモークの `safety.daily-argv` が3回とも PASS であることで確かめた。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。秘密の場所には触れていない。ネットのログは台本が読んだ直後に消した（`tmp\b\netlog\` は空）。

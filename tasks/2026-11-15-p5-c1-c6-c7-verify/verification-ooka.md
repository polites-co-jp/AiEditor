# 検証の記録: C-1（6・7回目）・C-6・C-7 の edits.patch と検査・テスト（パッケージ化の前まで）

大岡越前守から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 判定

| 単位 | パッケージ化の前まで | 理由の要点 |
|---|---|---|
| C-1-ai（6・7回目） | **合格** | 門と誤りの出方が本家と一致した（本家 1.146.0 と自分で照らした）。テストは門の期待を本家から読み、外側の口を優先する形になり、通る |
| C-6-settings-sync | **合格** | 直す点なし。消した登録（`IUserDataSyncWorkbenchService`）を注入する所が残らない（判断済みの `update.ts` を除く）。プロファイル・設定・拡張の管理と `contrib/editSessions` に触れない |
| C-7-breadcrumbs-outline | **合格** | 直す点なし。エディタの枠は決まった4ファイルだけで、タブ・グループ・差分エディタ・Webview に触れない。注入の外し損ねも無い。`kept` の理由の1つが事実と違う（軽微な指摘の1） |

関門の合否は出していない。これで C-1〜C-7 の全部が「パッケージ化の前まで」合格になった。

| brief の項 | 結果 |
|---|---|
| 1. 差分のレビュー | 3単位とも直す点なし。軽微な指摘が2つと、リーダーへの記録の指摘が1つ |
| 2. 21単位の組（A・B の14と C-1〜C-7） | 自分で実行。`result: ok`。`c1-check-json`・`c7-check-json`（当て直し・型検査）は「期待どおり」。作業ツリーの照らし役は `c1`〜`c7` の7つとも「期待どおり」。型検査は誤り 0 |
| 2. `after` の止まり | C-6 の1つ・C-7 の3つを、作業ツリーに書かずに自分で実行。4つとも正しい理由で止まった |
| 2. ほかの組 | 走らせていない（組の間でタグに戻す許可が無い）。蒙恬の記録を照らした（C-1 の15単位、C-6 の a・b、C-7 の a・b。5つとも期待どおり） |
| 2. ロックファイル・`git apply --check` | 走らせていない（許可に無い）。蒙恬の記録のロックファイルの検査は `ok` |
| 3. run-all | tests 2538、pass 2531、**fail 0**、skip 7 |
| 4. 合否 | 上の表 |

## 確かめた成果と、読んだときの sha256

- 蒙恬
  - C-1 の6・7回目: `removals/C-1-ai/edits.patch`（108ファイル。From `f2cf5706`）。`unit.json` は5回目と同じ
  - C-6: `removals/C-6-settings-sync/edits.patch`（5ファイル。From `401af452`）・`unit.json`
  - C-7: `removals/C-7-breadcrumbs-outline/edits.patch`（10ファイル。From `1547dc3e`）・`unit.json`
- 曹参
  - C-1 の5・6回目: `tests/c1-*`、共通の部品 `tests/gate-members.mjs`
  - C-6・C-7: `tests/c6-*`・`tests/c7-*`、台本 `tests/removals/c6-gate-script.md`・`c7-gate-script.md`

| ファイル | sha256 |
|---|---|
| `removals/C-1-ai/edits.patch` | `f1e2143cc3a346e45e6eef7b9c6542c8362d618105a401dc7de390eebbd5f75f` |
| `removals/C-1-ai/unit.json` | `2d0ace480873f43e114c657816917e0ecfcb3cb3f1a1c93a3f664518e590256f`（5回目の検証と同じ） |
| `removals/C-6-settings-sync/edits.patch` | `a4c971e76e69adfc598011d304a1a3c4eed8903591abb56f3a4be7c2aa36e7c8` |
| `removals/C-6-settings-sync/unit.json` | `b2e51d37d06fdba5622f109df61e707f533fa64525ccbbeba4b969eee59d309a` |
| `removals/C-7-breadcrumbs-outline/edits.patch` | `a0584bbb34003c980ba4f226a7e605a302f3c978d5527328067ce951dd7b65b8` |
| `removals/C-7-breadcrumbs-outline/unit.json` | `7c4cef400e546967ea9f1574651809a13a9ed11612b77edd82bbded04224047b` |
| `tests/gate-members.mjs` | `508911691391d73a0d1f34260b4e3493fa0e511e36778283b62b144e861a874e` |
| `tests/c1-unit.test.mjs` | `a6f322dedba34970998248c93b952f42a0ef2774a08fa4bf068759ccb5b16641` |
| `tests/c1-mutation.test.mjs` | `38c1767f95f4f062eda51e62bb3682a4fb9cbb929f227839c2d99b41ff196e6c` |
| `tests/c1-check-json.mjs` | `d032da2eec8a9b212d2bc70d1e33e7e473b79012dd6f1150482c958ad34f7980` |
| `tests/c1-check-worktree.mjs` | `e04c19f86ad3a98e5568fe5dac911b882c481192771ac6437d96090952118674` |
| `tests/c6-unit.test.mjs` | `277fba02d2a99bd0b1207f3e1def0e74163801eb4800f88ca1295b1763539992` |
| `tests/c6-check-json.mjs` | `af934b7f82e2a6761a055f991e7b07b4f12545c6ff347ca5965f6bcc4b785662` |
| `tests/c6-check-worktree.mjs` | `c3159d9eff886f3245cb04ef01f3e6732fd186cda7f2c6695ce60c92931b01be` |
| `tests/c7-unit.test.mjs` | `7c63d410bf83cd328fa352b01a2ec7e7a8cf4f13348b362b11da0176fc6232b8` |
| `tests/c7-check-json.mjs` | `23383a41313101f3c478446ff0e3282e07c15769468b2cadb67dd8eecd4ab3ed` |
| `tests/c7-check-worktree.mjs` | `9384159bf4f67d291f45fd917bb19eeb99bc47a16e8510931c8f5a0f579122bb` |

## 1. 差分のレビュー

### C-1（6・7回目）

**門の直し（6回目）**: 本家 1.146.0（作業ツリーがタグにあるうちに読んだ）と1つずつ照らした。どれも本家と同じ門・同じ条件。

| 所 | 本家 | edits.patch（`extHostRemovedApi.ai.ts`） |
|---|---|---|
| `lm.registerToolDefinition` | `extHostLanguageModelTools.ts` 351〜352行の先頭で `languageModelToolSupportsModel` | 3357〜3361行。最初の文に同じ門 |
| `lm.fileIsIgnored` | `extHostLanguageModels.ts` 749〜750行。`async` でない関数の先頭で `chatParticipantAdditions` | 3372〜3376行。最初の文に同じ門（同期で投げる） |
| `lm.registerIgnoredFileProvider` | 同 790〜791行。`chatParticipantPrivate` | 3377〜3381行。同じ門 |
| 参加者（`createChatParticipant`・`createDynamicChatParticipant` が返すもの） | `extHostChatAgents2.ts` の `apiAgent`（1425〜1526行）。getter・setter ごとに `defaultChatParticipant`・`chatParticipantPrivate`・`chatParticipantAdditions` | 3042〜3127行。同じ名前の getter・setter に同じ門。`onDidPerformAction` は提案が無ければ undefined（本家の1526行と同じ） |

- 本家の `extHostChatAgents2.ts` の162〜460行の門は、応答の流れ（stream）の中にある。何もしない実装は応答を作らないので、呼べない所。README に理由がある。
- `invokeTool` は、本家と同じく情報オブジェクトを渡したときだけ門をかける（3362〜3368行）。

**誤りの出方（7回目）**:

- `lm.fileIsIgnored`: 本家は、外側の口（`extHost.api.impl.ts` の1964〜1966行）も内側（`extHostLanguageModels.ts` の749行）も `async` でなく、同期で投げる。7回目で、同期で投げる形になった（3373〜3375行）。
- `lm.getModelProxy`: 本家の外側の口（`extHost.api.impl.ts` の1920〜1923行）は `async` でなく、内側の `async getModelProxy` を呼ぶ前に同期で門を呼ぶ。拡張から見ると同期で投げる。
  - 実装（3323〜3327行）も、門を同期で呼んでから `Promise.reject` を返す。出方は本家と同じ。
  - 蒙恬が実装を変えなかった判断は正しい。

**曹参のテストの直し（5・6回目）**:

- `gate-members.mjs` は、本家の消す extHost のファイルから「メンバー（getter・setter・メソッドを区別）→ 門の名前」を読み、何もしない実装のメンバーを実際に触る。期待を実装から写していない。触って確かめることは2つ。
  - 提案を有効にしていない拡張では、門の誤りになる
  - 有効にした拡張では、誤りにならない
- 6回目で `outerSyncGateNames` を足した（外側の口を優先する決め方）。
  - 本家の `extHost.api.impl.ts` の `lm`・`chat` の宣言から、「`async` でなく、先頭で門を呼ぶ外側の口」を読む。
  - その口は、内側が `async` でも「同期で投げる」を期待する。上の本家の読みと合う。
- 読み方の退行を見張る検査もある（`c1-unit.test.mjs` の464行。`getModelProxy` が外側の同期の集まりに読めていること）。
- 単独で走らせて、`c1-unit` 43件・`c1-mutation` 33件はすべて通った。前の検証で落ちていた「門の誤りが、本家と同じ形で返る」と、その対照も通る。
  - この検査は、7回目の前の実装で実際に落ちていた。落ちるべきときに落ちることは確かめ済み。

### C-6

- **裁定・docs のとおりか**: とおり。
  - 消すのは `contrib/userDataSync`、`IUserDataSyncWorkbenchService` を登録する `services/userDataSync/browser/userDataSyncWorkbenchService.ts`、main の3行。
  - edits.patch は5ファイル（設定の画面とその CSS・テスト、再起動の部品とそのテスト）だけ。足す行は import の書き換えと、テストの呼び出し1行だけ。
  - user-decisions の 2026-11-15 の C-6 の3点のとおり（条件が常に偽の画面は残す、`checks` の見直し、`update.ts` は直さない）。
  - 「続きの編集」の裁定（今は残す）のとおり、`contrib/editSessions` には delete・removeLines・edits.patch のどれも触れない。
- **注入の外し損ね**: 本家で `IUserDataSyncWorkbenchService` の使い手を探した。残るのは次のとおりで、外し損ねは無い。
  - 消す `contrib/userDataSync` の中
  - edits.patch で直す `settingsEditor2.ts`（285行）と `relauncher.contribution.ts`（115行）
  - `contrib/update/browser/update.ts` の397行の `accessor.get`。
    - `SwitchQuality` の操作の中にあり、`environmentService.options?.productQualityChangeHandler` があるときだけ登録される（374行）。この値を渡すのは web の埋め込み側だけ。
    - デスクトップでは登録されないので、裁定どおり直さなくてよい。
  - 当てた21単位の木で `@IUserDataSyncWorkbenchService`・`accessor.get(IUserDataSyncWorkbenchService)` を探すと、残るのは上の `update.ts` の1か所だけ。
- **プロファイル・設定・拡張の管理を壊さないか**: 壊さない。
  - `kept` の部品は残り、edits.patch はこれらに触れない。対象は `userDataSyncEnablementService.ts`（同期は常に無効と答える）・`electron-browser`（共有プロセスへの代理）・`userDataSyncUtil.ts`・`platform/userDataSync`・`services/accounts`。
  - 設定の画面からは、同期の操作（`SyncControls`）だけを外した。ほかの注入・描画は変えていない。
  - 再起動の部品は、同期の状態を読む注入と、設定の変更で再起動を尋ねる所を残す。
- **5.3**: edits.patch は main のファイルに触れない。C-1・C-5 とも同じファイルに触れない（`c6-unit` が見張る）。

### C-7

- **裁定・docs のとおりか**: とおり。
  - user-decisions の 2026-11-15 の C-7 の5点のとおり。
    - `showBreadcrumbs` を消す
    - `handleEditorsChange` と呼ぶ側を消す
    - 1枚のタブの説明の出し方
    - テストの値は残す
    - 今の案で関門へ進める
  - docs/07 の8節（C-7 は関門を2回続けて通らなければ諮る）は、関門で扱う。
  - B-4 が「C-7 まで」と残した `contrib/codeEditor/browser/outline` を、C-7 の `delete` で消す。
- **エディタの枠は4ファイルだけか**: `browser/parts/editor` で edits.patch が触るのは、`editorHeaderControl.ts`・`editorTitleControl.ts`・`singleEditorTabsControl.ts`・`auxiliaryEditorPart.ts` の4つだけ。
  - 次の部品には触れない。
    - タブの列（`multiEditorTabsControl.ts`・`editorTabsControl.ts`）
    - グループ（`editorGroupView.ts`・`editorPart.ts`）
    - 差分エディタ（`editor/browser/widget/diffEditor`・`editor/contrib/diffEditorBreadcrumbs`）
    - Webview・カスタムエディタの本体
  - 枠の外で触るのは次のものだけ。
    - 共有の型 `common/editor.ts` の1行（`showBreadcrumbs`。判断済み）
    - 記号へ移動（`gotoSymbolQuickAccess.ts`）
    - カスタムエディタの main thread（`mainThreadCustomEditors.ts`。`IOutlineService` の注入と `notifyOutlineChanged` の2か所だけ）
    - テスト3つ
- **枠の直しの中身**: パンくずを作る部分と、その更新の呼び出しだけを外した。
  - `editorHeaderControl.ts` の `height` は、ヘッダーが無いとき 0 を返す。前もパンくずが隠れていれば 0 だった。`mydist` の既定（`breadcrumbs.enabled: false`）の下の画面と同じになる見込み。
  - 操作の並べ方は「パンくずが無いとき」の値に固定した。
- **注入の外し損ね**: 当てた21単位の木で探した。外し損ねは無い。
  - `@IOutlineService`・`IBreadcrumbsService`・`accessor.get(IOutlineService)`・`showBreadcrumbs` は0件。
  - `IOutlineService` の語は、`gotoSymbolQuickAccess.ts` の62行にある本家のコメントだけ。
- **残すもの**: 次のものは残る。
  - 記号へ移動（`GotoSymbolAction`・`getSymbolPicks`）
  - カスタムエディタの記号の移動（`input.navigation`）
  - `editor/contrib/documentSymbols`（`IOutlineModelService`）

  記号へ移動のうち、テキスト以外のエディタでアウトラインから一覧を作る部分（`provideWithoutTextEditor` の上書き）は消え、基底の振る舞いに戻る（蒙恬の報告のとおり）。
- **5.3**: 10ファイルのうち3つは C-1 の edits.patch も触る。`after` に C-1 があるので、いつも C-1 の後の形に当たる。21単位の組でも衝突なく当たった。

## 2. 当て直し・照らし・型検査

始める前の作業ツリーはタグ（`C:\b\vscode\.git\worktrees\p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`）。記録はすべて `tasks/2026-11-15-p5-c1-c6-c7-verify/run/` に書いた。

### 2.1 `after` の止まり（タグのまま。作業ツリーに書かない）

| 外した単位 | 記録 | `errors` | 照らし役 |
|---|---|---|---|
| C-6 から C-1-ai | `checks-c6-noc1.json` | `C-6-settings-sync: after の単位 C-1-ai が先に当たらない（--only に入っていない）` | `node tests/c6-check-json.mjs --stopped …` → 期待どおり |
| C-7 から C-1-ai（台本のとおり。C-4 も入らない） | `checks-c7-noc1.json` | C-1-ai と C-4-notebook の2件 | `node tests/c7-check-json.mjs --stopped …` → 期待どおり |
| C-7 から C-4-notebook | `checks-c7-noc4.json` | `C-7-breadcrumbs-outline: after の単位 C-4-notebook が先に当たらない（…）` の1件 | 照らし役は「C-1 を外す」組だけを前提にしている。記録を読んで確かめた |
| C-7 から B-4-outline-view | `checks-c7-nob4.json` | B-4 についての2件（C-4-notebook と C-7。C-4 も B-4 を前提にする） | 同上 |

- 4つとも `stoppedAt.phase: inputs`、`commits: []`。走らせた後も、HEAD は `69047191` のままだった。
- 「B-4 を外す」組は、はじめ C-4 も入れ忘れて走らせた。C-4 を入れて走らせ直し、記録を上書きした。

### 2.2 21単位の組（A・B の14と C-1〜C-7）

| 手順 | コマンド | 結果 |
|---|---|---|
| 当て直し | `node scripts/apply.mjs C:/b/wt/p2 --label c7-gate-b-ooka --only <A・B の14>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,C-6-settings-sync,C-7-breadcrumbs-outline --checks-out …/run/checks-21.json` | `結果: ok`。警告は `C-2-debug: delete: …debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ（想定済み） |
| 照らし | `node tests/c7-check-json.mjs …/run/checks-21.json` | 期待どおり（組 b: 当て直しのみ） |
| 照らし | `node tests/c1-check-json.mjs …/run/checks-21.json` | 期待どおり（当て直しのみ） |
| 参考 | `node tests/c6-check-json.mjs …/run/checks-21.json` | 食い違いは「想定していない単位が当たっている: C-7-breadcrumbs-outline（b の組は 20 単位）」の1件だけ。照らし役が20単位の組を前提にしているため。C-6 のほかの期待は、この記録でも満たす |
| 照らし | `node tests/c1-check-worktree.mjs`〜`c7-check-worktree.mjs C:/b/wt/p2`（7つ） | 7つとも期待どおり（作業ツリー） |
| 型検査 | `node scripts/build.mjs 1.146.0 --label c7-gate-b-ooka --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record …/run/typecheck-21.json --take-in-dir …/run/take-in-21` | `result: ok` |
| 照らし | `node tests/c7-check-json.mjs …/run/checks-21.json …/run/typecheck-21.json` | 期待どおり（組 b: 当て直し・型検査） |
| 照らし | `node tests/c1-check-json.mjs …/run/checks-21.json …/run/typecheck-21.json` | 期待どおり（当て直し・型検査） |
| 参考 | `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json` | 誤り7件。A-3 の1件と C-3 の `productRemove` の6件で、前回までと同じ（判断済み）。C-6・C-7 による増えは無い |

当て直しの記録（`checks-21.json`）の中身:

- `baseCommit` は `69047191`（タグ）、`headCommit` は `ed59899d41cd3035594ff62df3a57c3e62f2f483`、`result` は `ok`。
- 21単位すべてが `applied: ok`。C-1〜C-7 の edits は、どれも `conflicts: []` で、件名は `unit C-<n>-…: edits`。
- 次のものは、どれも0件。
  - `"applied"` が `"fail"`・`"conflict"`・`"error"` のもの
  - `removeLines` の `"ok": false`
  - `hitCount` が1以上の項目
- `mydist` の既定から、C-7 の `breadcrumbs.enabled` が外された。`absentSettings` に載るためで、apply.mjs の決まりどおり。

型検査の記録（`typecheck-21.json`）:

- `steps[0]`: `pnpm run typecheck-client`、`exitCode: 0`、5.5秒。ログ `C:\b\logs\c7-gate-b-ooka\typecheck.log` に `error` の語は無い。
- `sourceVersion.value` は `ed59899d…` で、当て直しの `headCommit` と同じ。`uncommittedEntries` は 0、`error` は `null`。

### 2.3 自分で走らせていない組（蒙恬の記録の照らし）

組の間で作業ツリーをタグに戻すには `git -C C:/b/wt/p2 checkout 1.146.0` が要るが、許可に無い。

| 記録 | コマンド | 結果 |
|---|---|---|
| C-1 の15単位（7回目） | `node tests/c1-check-json.mjs tasks/2026-11-15-p5-c1-patch/trial/round7-checks-verify.json …/round7-typecheck-verify.json` | 期待どおり（当て直し・型検査） |
| C-6 の組 a（16単位） | `node tests/c6-check-json.mjs tasks/2026-11-15-p5-c6-patch/trial/checks-verify-a.json …/build-typecheck-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |
| C-6 の組 b（20単位） | 同じ形（`-b`） | 期待どおり（組 b: 当て直し・型検査） |
| C-7 の組 a（18単位） | `node tests/c7-check-json.mjs tasks/2026-11-15-p5-c7-patch/trial/checks-verify-a.json …/build-typecheck-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |
| C-7 の組 b（21単位） | 同じ形（`-b`） | 期待どおり（組 b: 当て直し・型検査） |

C-6・C-7 の記録は、C-1 の edits.patch が6・7回目に変わる前に取ったものかもしれない。C-1 の今の edits.patch を含む組が当たることは、自分の21単位の組で確かめた。

### 2.4 ロックファイル（蒙恬の記録を読んだだけ）

`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` が許可に無いので、作り直していない。C-1 の6・7回目、C-6、C-7 は、依存もパッチの行も変えない。

- C-6・C-7 の組 b の記録の `checks.lockfile` は `status: ok`。`unexpected…` の一覧に中身は無い。
- 照らし役（`c1`・`c6`・`c7-check-json`）は、記録にロックファイルの検査があれば、それも見る。上の「期待どおり」はそれを含む。

## 3. テスト

`node tests/run-all.mjs --save tasks/2026-11-15-p5-c1-c6-c7-verify/run/run-all-ooka.txt` を走らせた。終了コードは 0。

- TOTAL: tests 2538、pass 2531、**fail 0**、skip 7。
- skip 7 は `removals.test.mjs` の既存の分（単位が有効でないときの `after` の検査）。
- 前の検証で落ちていた C-1 の2本（`c1-unit` の「門の誤りが、本家と同じ形で返る」、`c1-mutation` の対照）は通る。
- C-1・C-6・C-7 の分は次のとおり。どれも fail 0。

| ファイル | 件数 |
|---|---|
| `c1-unit` | 43 |
| `c1-mutation` | 33 |
| `c1-round2` | 14 |
| `c1-check-json.test` | 8 |
| `c6-unit` | 30 |
| `c6-mutation` | 59 |
| `c6-check-json.test` | 12 |
| `c6-worktree` | 33 |
| `c7-unit` | 26 |
| `c7-mutation` | 59 |
| `c7-check-json.test` | 12 |
| `c7-worktree` | 31 |

- C-2〜C-5 の分も、どれも fail 0。
- 上の12ファイルと、`c2-unit`・`c3-unit`・`c4-unit`・`c5-unit`・`removals` は、単独でも `node --test` で走らせ、どれも fail 0 だった。
- 作業ツリーの HEAD は、run-all の後も `ed59899d` のままだった。

**テストが仕様を正しく確かめているか**:

- C-1: 門の期待を本家の消すファイルから読み、メンバーごとに実際に触って確かめる。出方は外側の口を優先する。壊した写し33件で、それぞれ落ちることを確かめている。
- C-6: 消す部品が登録するサービスの ID を、本家の `delete` の中の `registerSingleton` から読む。注入の残りを、静的な検査と木の全体の走査の2つで見る。`contrib/editSessions` に触れないことを3か所で見る。壊した写しは59件。
- C-7:
  - 枠のファイルが4つだけであることを、禁止の一覧と壊した写しで見る。
  - 消すサービスの ID を本家から読む。
  - アウトラインを登録する側が残らないことも見る。
  - 壊した写しは59件。
- 3単位とも、実装に合わせて書いた所は見つからなかった。

## 4. 合否と指摘

- **C-1-ai（6・7回目）: 合格**（パッケージ化の前まで）。
  - 前の検証で落ちていた2本は、7回目の実装（`fileIsIgnored`）と、曹参の6回目のテストの直し（`getModelProxy` の期待）で通る。
  - 21単位の組での当て直し・照らし・型検査は、自分で確かめた。15単位の組・ロックファイル・`git apply --check` は、蒙恬の記録の照らしだけ。
- **C-6-settings-sync: 合格**（パッケージ化の前まで）。
  - 21単位の組での当て直し・照らし・型検査と、`after` の止まりは、自分で確かめた。組 a・b・ロックファイル・`git apply --check` は、蒙恬の記録の照らしだけ。
- **C-7-breadcrumbs-outline: 合格**（パッケージ化の前まで）。
  - 21単位の組での当て直し・照らし・型検査と、`after` の止まり（3つ）は、自分で確かめた。組 a・ロックファイル・`git apply --check` は、蒙恬の記録の照らしだけ。
- 直す点: 無い。

### 軽微な指摘（直さなくても、パッケージ化の前の合否には響かない）

1. **蒙恬（C-7 の `kept` の `src/vs/base/browser/ui/breadcrumbs` の理由。`unit.json` の28行と README の24行）**: 理由は「差分エディタの変更の無い部分の表示（`editor/contrib/diffEditorBreadcrumbs`）とチャットのデバッグのビュー（C-1）が使う」。これは事実と違う。
   - `editor/contrib/diffEditorBreadcrumbs/browser/contribution.ts` は `BreadcrumbsWidget` を使わない。import は配列・observable・差分エディタの部品・`IOutlineModelService` など。
   - チャットのデバッグのビューは C-1 で消える。
   - 21単位の木で `BreadcrumbsWidget` を使うのは、共有の `platform/theme/browser/defaultStyles.ts`（14行で型を import）と、部品自身のテストだけ。
   - 残す理由として当たるのは「共有の `defaultStyles.ts`（`kept`）が型を import するので、消すと共有のファイルに触れる」。取り込みのときに Claude が README を読むので、理由を事実に合わせるとよい。
   - 2026-11-14 の規則（消す部品だけが使うものは消す）に照らして消すかどうかは、リーダーの判断（消すなら `defaultStyles.ts` にハンクが増える）。
2. **曹参（C-6・C-7 の照らし役）**: 照らし役が使えない組がある（今回は記録を読んで確かめた）。
   - `c6-check-json.mjs` は20単位の組だけを前提にしている。段階 C の全部（21単位）で C-6 の記録も1回で照らしたいときに使えない。
   - `c7-check-json.mjs` の `--stopped` は「C-1 を外す」組だけを前提にしている。C-7 の前提の B-4・C-4 を外す組には使えない。
   - C-4 の照らし役（外した単位を引数で渡す形）にそろえるとよい。

### リーダーへ（記録の食い違い）

- `docs/user-decisions.md` の387行（「C-1 の6回目のテストで出た点」）は、次のように書く。
  - `lm.getModelProxy` は「本家が reject するのに同期で投げる」
  - 「テストの期待（本家の形）は変えない」
- その後の本家の読みでは、本家の外側の口（`extHost.api.impl.ts` の1920〜1923行）は同期で投げる（蒙恬の7回目、曹参の6回目。私も上で照らした）。実装は変えず、テストの期待の側を直した。
- 結論（本家と同じ出方にそろえる）は守られているが、記録の文が実際の扱いと違う。記録を直すのはリーダーの担当なので、ここに書く。

### 許可が足りなかったもの（前回までと同じ）

| 何のために | 要るコマンド |
|---|---|
| 組と組の間で、作業ツリーをタグに戻す | `git -C C:/b/wt/p2 checkout 1.146.0` |
| ロックファイルを作り直す・戻す | `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts`、`git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` |
| 3-way に頼らずに当たることの確かめ | `git -C C:/b/wt/p2 log --format="%H %s" -n 80`、`git -C C:/b/wt/p2 checkout <ops の sha>`、`git -C C:/b/wt/p2 apply --check -v <edits.patch>` |
| C: の空きを測る | 測るコマンドが許可に無い。書いたのは記録とログだけ（数 MB 以下）。当て直しの commit は作業ツリーの git に入る |

## 作業ツリーの状態（終わったとき）

- `C:\b\wt\p2` の HEAD は `ed59899d41cd3035594ff62df3a57c3e62f2f483`（`C:\b\vscode\.git\worktrees\p2\HEAD` を読んだ）。run-all の後も変わっていない。
- 当てた単位は次のとおり（label `c7-gate-b-ooka`）。未コミットの変更は 0（型検査の記録の `uncommittedEntries`）。
  - A-1〜A-7・B-1〜B-7 の14
  - C-1〜C-7 の7
  - `patches/` の2つ
- タグには戻していない（戻すコマンドが許可に無い）。次に `apply.mjs` を使う前に、`git -C C:/b/wt/p2 checkout 1.146.0` が要る。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` と、普段使いのエディタのデータには触れていない。パッケージ化と zip はしていない。

## 記録

- この文書: `tasks/2026-11-15-p5-c1-c6-c7-verify/verification-ooka.md`
- `tasks/2026-11-15-p5-c1-c6-c7-verify/run/`
  - `checks-c6-noc1.json`・`checks-c7-noc1.json`・`checks-c7-noc4.json`・`checks-c7-nob4.json`（`after` の止まり）
  - `checks-21.json`（21単位の当て直し）
  - `typecheck-21.json`（型検査）。ログは `C:\b\logs\c7-gate-b-ooka\typecheck.log`
  - `run-all-ooka.txt`（run-all）
- `--take-in-dir` に渡した `run/take-in-21/` は作られなかった（型検査の手順だけでは書かれない）。

# Phase 5 の下ごしらえ（C-4 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

1回目の報告は「結果」の節から後。2回目（大岡越前守の検証の「直す点」の1）は、すぐ下の節。

## 2回目（2026-11-15。提案中の API の門の抜けを直した）

### 結果

**完了**。依頼の1〜6をすべて行った。作業ツリーはタグ 1.146.0 に戻した。パッケージ化と zip はしていない。

### 直した点

`api/common/extHostRemovedApi.notebook.ts`（edits.patch の中の新規ファイル）の2か所。

1. **`updateNotebookAffinity` の門**（依頼の点）
   - 本家（1.146.0 の `extHostNotebookKernels.ts` 280〜287行）と同じ条件にした。affinity が `NotebookControllerAffinity2.Hidden`（-1）のときだけ、`checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden')` をかける。
   - 引数の型は、提案の d.ts（`vscode.proposed.notebookControllerAffinityHidden.d.ts` の15行）と同じ `vscode.NotebookControllerAffinity | vscode.NotebookControllerAffinity2` にした。
   - `NotebookControllerAffinity2` は `./extHostTypes.js` から import する（本家の `extHostNotebookKernels.ts` の21行と同じ）。
2. **`createNotebookController` の `rendererScripts`**（突き合わせで見つけた、門でない食い違い）
   - 本家（`extHost.api.impl.ts` の `notebooks` の名前空間）は、`isProposedApiEnabled(extension, 'notebookMessaging')` が偽なら `rendererScripts` を渡さない。前の版は、何もしないコントローラーにそのまま渡していた。
   - 本家と同じ判定にした。提案が無効なら、`controller.rendererScripts` は `[]` になる。
   - 誤りを投げる門ではないが、提案が無効の拡張から見える値が本家と違っていた。

edits.patch は25ファイル（新規1）、211行の追加、907行の削除。From の commit は `21079a10`（前の版は `de356cae`）。ほかの24ファイルのハンクは変えていない。`unit.json` も変えていない。

### 門の突き合わせ（依頼の3）

本家 1.146.0 の、C-4 が消す拡張ホストのファイル（`extHostNotebook*.ts` の8つと `extHostInteractive.ts`）と、`extHost.api.impl.ts` から消した行を対象にした。`checkProposedApiEnabled`・`isProposedApiEnabled` を `Grep` で数えた。

| 本家の場所 | 判定 | 提案 | 何もしない実装 |
|---|---|---|---|
| `extHostNotebookKernels.ts` 237 | check | `notebookVariableProvider` | あり（`variableProvider` の書き込み） |
| 同 258 | check | `notebookExecution` | あり（`createNotebookExecution`） |
| 同 284 | check（`Hidden` のときだけ） | `notebookControllerAffinityHidden` | **今回足した** |
| 同 291 | check | `notebookMessaging` | あり（`postMessage`） |
| 同 295 | check | `notebookMessaging` | あり（`asWebviewUri`） |
| `extHost.api.impl.ts`（`createNotebookControllerDetectionTask`） | check | `notebookKernelSource` | あり |
| 同（`registerKernelSourceActionProvider`） | check | `notebookKernelSource` | あり |
| 同（`createNotebookController` の `rendererScripts`） | is（投げない） | `notebookMessaging` | **今回そろえた** |
| 同（`registerNotebookSerializer` の `registration`） | is（投げない） | `notebookLiveShare` | 要らない（何もしない実装は引数を使わない） |

- ほかの消すファイル（`extHostNotebook.ts`・`extHostNotebookDocument.ts`・`extHostNotebookDocuments.ts`・`extHostNotebookDocumentSaveParticipant.ts`・`extHostNotebookEditor.ts`・`extHostNotebookEditors.ts`・`extHostNotebookRenderers.ts`・`extHostInteractive.ts`）には、門も判定も無い。
- 結果: check の門は本家と同じ7つ。投げない判定は、要る1つを本家と同じにした。ほかに抜けは無い。
- README の「拡張 API の振る舞い」に門の一覧（7つ）と判定（2つ）を足した。

### 確かめたこと

- 作業ツリーは、依頼どおり HEAD `a1f0963f`（大岡越前守の18単位）から `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻して始めた。
- 直しの作り方
  1. A・B の14単位と C-1・C-2・C-4 を当てた（`trial/round2-checks-base.json`）。
  2. C-4 の edits の commit（`14a17753`。ops は `356a5242`）を checkout した。
  3. 上の2か所を直して、型検査を2回走らせた（`trial/round2-typecheck-{1,2}.json`）。どちらも誤り 0。
  4. `git commit -m "unit C-4-notebook: edits" --amend --author=shuko-apply` で同じ件名・作者の commit（`21079a10`）にした。
  5. `git -C C:/b/wt/p2 format-patch -1 21079a10 --output=<ビルドリポジトリ>/removals/C-4-notebook/edits.patch` で書き出した。
- 当て直し a（タグから17単位。`trial/round2-checks-verify-a.json`）
  - 適用は `result: ok`、C-4 の edits は `conflicts: []`（ops `be3c8fdb`、edits `b6da02c2`）
  - 型検査は `ok`、誤り 0（`trial/round2-typecheck-verify-a.json`。HEAD `7ede85f2`）
  - `--lockfile-check` は `ok`（`trial/round2-lockfile-a.diff`）
  - a の ops の commit の上で `git apply --check -v` が25ファイルとも当たった
- 当て直し b（タグから18単位。`trial/round2-checks-verify-b.json`）
  - 適用は `result: ok`、C-1〜C-4 の edits はどれも `conflicts: []`（C-4 は ops `d999e545`、edits `45131cb9`）
  - 型検査は `ok`、誤り 0（`trial/round2-typecheck-verify-b.json`。HEAD `3a80a832`）
  - `--lockfile-check` は `ok`（`trial/round2-lockfile-b.diff`）
  - b の ops の commit の上で `git apply --check` が 0 で終わった
- 警告は、a・b とも C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 19.31 GB（`disk-start-2.json`）、終わり 19.08 GB（`disk-end-2.json`）。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0`、作業ツリーはきれい。

### テストの入口（曹参へ。1回目の7に足す）

- 提案を有効にしていない拡張の何もしないコントローラーで確かめる。
  - `updateNotebookAffinity(doc, NotebookControllerAffinity2.Hidden)`（-1）が誤りを投げる（`notebookControllerAffinityHidden`）
  - `updateNotebookAffinity(doc, NotebookControllerAffinity.Default)`（1）・`Preferred`（2）は誤りを投げない
- 提案を有効にした拡張では、`Hidden` を渡しても誤りを投げない。
- `createNotebookController('id', 'type', 'label', undefined, [script])` の `rendererScripts`
  - 提案 `notebookMessaging` が無効なら `[]`
  - 有効なら `[script]`
- 門の期待は、本家 1.146.0 の `extHostNotebookKernels.ts` の `checkProposedApiEnabled` と、`extHost.api.impl.ts` の `notebooks` の名前空間の `checkProposedApiEnabled` から読める（上の表の7つ）。

### 未解決の点

なし。1回目の未解決の点（起動時の注入、拡張ホストのログ、検索の単体テスト、パッケージ化と起動）は変わらない。

## 結果

**完了**。パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない。

## 成果物

- `removals/C-4-notebook/edits.patch`（新規）
  - 25ファイル（新規1）、206行の追加、907行の削除
  - 件名は `unit C-4-notebook: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `de356cae`
- `removals/C-4-notebook/unit.json`（直した）。`enabled` は `false` のまま
  - `"patch": "edits.patch"` を足した
  - `delete` に4つ、`removeLines` に13行を足した
  - `kept` から2つ外し（`delete` に移した）、2つの理由を直した
  - `checks.absentSettings` に1つ、`checks.absentStrings` に4つ足した
- `removals/C-4-notebook/README.md`（書き直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「edits.patch で直した点（2026-11-15）」「拡張 API の振る舞い」「検索への影響」「Claude Code と台帳の拡張への影響」「型検査に掛からない点」
  - 直した節: 「消すもの」「前提の単位」「残すもの」「別案」「未確認」
- `tasks/2026-11-15-p5-c4-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、build/ の型検査、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c4-patch/trial/`
  - 適用の検査4つ: `checks-ops.json`・`checks-ops2.json`・`checks-verify-a.json`・`checks-verify-b.json`。verify の2つにはロックファイルの検査も追記した
  - 型検査の記録7つ: `build-typecheck-{1..5,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
  - `take-in/`（`build.mjs` が書く置き場）
- `tasks/2026-11-15-p5-c4-patch/disk-start.json`・`disk-end.json`
- `scripts/` と、ほかの単位の `removals/` は変えていない

## 要点

1. A・B の14単位と C-1・C-2・C-4 の ops の上で、型検査の誤りは 82 → 21 → 4 → 1 → 0。どれも README の「型検査で直す点」の見込みの範囲だった。
2. 拡張 API は、新しいファイル `api/common/extHostRemovedApi.notebook.ts` の何もしない実装に向けた。`extHost.api.impl.ts` は、`window`・`workspace` のノートブックの項目を1行の展開（`...removedNotebookApi.window` など）に、`notebooks` を1行にした。
3. 全文検索は、ノートブックへの参照を外すだけにした。一致は `FileMatchImpl` で作り、注入4か所（`searchResult.ts`・`searchModel.ts`・`searchView.ts`・`replaceService.ts`）と一括編集の注入を外した。テキスト検索は ripgrep だけになり、`.ipynb` はテキストとして当たる。
4. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。
   - a: 17単位
   - b: 18単位。C-3 を挟む。行のずれも無く当たり、`removeLines` に回すものは無かった
5. 判断を仰ぐ点が5つある（下）。

## 直した点

一覧の正本は `removals/C-4-notebook/README.md` の「edits.patch で直した点（2026-11-15）」。ここでは形だけを書く。

| 区分 | ファイル | 直し方 |
|---|---|---|
| 拡張 API | `api/common/extHostRemovedApi.notebook.ts`（新規） | `createRemovedNotebookApi(extension)` が `{ notebooks, window, workspace }` を返す |
| 拡張 API | `api/common/extHost.api.impl.ts` | import の差し替え、作る所の7行の削除、3つの名前空間の項目の差し替え、`languages.match` |
| 拡張 API | `api/common/extHost.protocol.ts` | Shape 14個と、使われなくなった import 2つを消した（ID の13行は `removeLines`） |
| 拡張 API | `api/browser/mainThreadEditorTabs.ts` | 対話ウィンドウのタブの分岐 |
| 一括編集 | `contrib/bulkEdit/browser/bulkCellEdits.ts` | 注入をやめ、セルの編集は reject |
| 検索 | `searchTreeModel/` の6つ、`searchView.ts`・`searchWidget.ts`・`searchFindInput.ts`・`replaceService.ts`・`searchActionsRemoveReplace.ts`・`searchCompare.ts`・`search.common.contribution.ts`・`search.contribution.ts` | ノートブックへの参照・注入・分岐を外した |
| 検索エディタ | `searchEditor/browser/searchEditorSerialization.ts` | セルの一致の書き出しを外した |
| テスト | 検索のテスト5つ | 差し替えの行を外し、一致を `FileMatchImpl` で作る。ノートブック専用のテスト2つを消した |

`unit.json` で足したもの

- `delete`: `contrib/search/common/notebookSearch.ts`・`contrib/search/common/cellSearchModel.ts`・`contrib/bulkEdit/test/browser/bulkCellEdits.test.ts`・`api/browser/mainThreadNotebookDto.ts`
- `removeLines`: `extHost.protocol.ts` の `MainContext` の ID 6行と `ExtHostContext` の ID 7行
- `checks.absentSettings`: `search.experimental.closedNotebookRichContentResults`
- `checks.absentStrings`: `INotebookSearchService`、`notebook/browser/`（`contrib/search`・`contrib/searchEditor` の中）、`MainThreadNotebookShape`・`ExtHostNotebookShape`（`extHost.protocol.ts`）

## 残した部品と理由

前からの決まり（README の「残すもの」と `unit.json` の `kept`）から、2つを `delete` に移した（下の判断を仰ぐ点の3）。依頼どおり、別案の1・2は採っていない。

| 部品 | 理由 |
|---|---|
| `contrib/notebook/common` | 拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`・`extHostApiCommands.ts`）、一括編集の `ResourceNotebookCellEdit`、`mainThreadEditorTabs.ts` の `NotebookEditorInput`、コメントが import する。中のサービスの実装は登録が browser 側にあるので作られない |
| `services/notebook` | `labels.ts` が `INotebookDocumentService` を注入する |
| `api/common/extHostTypes/notebooks.ts` | 公開のクラス（`vscode.NotebookCellData` など） |
| `contrib/search/common/searchNotebookHelpers.ts` | 残す `notebook/common/notebookService.ts` が型を import する（前の理由「services/search が使う」は当たらなかったので直した） |
| `notebook/common/services/notebookWebWorkerMain.ts` | `build/next/index.ts` がワーカーの入口に挙げる |
| `extHost.protocol.ts` のノートブックの DTO | 一部は `extHostTypeConverters.ts`・`extHostApiCommands.ts` が使う。使われなくなるものの切り分けは型検査に掛からないので残した（判断を仰ぐ点の4） |
| `searchWidget.getNotebookFilters()` | 検索のビューと検索エディタが読む。既定値の定数にした（判断を仰ぐ点の1） |

## 検索への影響

- テキスト検索は ripgrep の検索だけになる。前は、ノートブックの検索が先に `.ipynb` を探して ripgrep から外していた。今は `.ipynb` も ripgrep がテキスト（JSON）として探し、普通の一致として出る。開くとテキストのエディタで開き、置換もテキストとして行う。
- 開いていないファイルの一致の前後の行（検索エディタの context）は、消した `NotebookCompatibleFileMatch` が足していた。`FileMatchImpl.createMatches` に同じ1行を足して、前と同じに出るようにした。
- 検索の入力欄のノートブックの絞り込みのボタンは出ない（前もノートブックを開いたときだけ出た）。
- ファイル検索（Quick Open）・シンボル検索・C-1 の AI の検索の跡には触れていない。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest に `notebook` の語は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`）。
  - 圧縮されたコードの中でノートブックの API を呼んでも、何もしない実装が受ける。誤りを投げるのは `openNotebookDocument`・`showNotebookDocument`（reject）と `createNotebookCellExecution` だけ。
  - 受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。
- 台帳のほかの7つの package.json にも、ノートブックの contributes・起動の条件は無い（`Grep`）。日本語の言語パックの `vscode.builtin-notebook-renderers` の訳は、読み手が無くなるだけ。
- 残す組み込み拡張のうち、`typescript-language-features`・`markdown-language-features` は `workspace.notebookDocuments` をたどり、`git` は `window.activeNotebookEditor` を読む（1.146.0 のソースで確かめた）。どちらも空の値が返る。
- 言語クライアントを使う拡張（basedpyright・PowerShell）のノートブックの同期は、イベントが `Event.None` なので何も起きない見込み（推定。関門のスモークで見る）。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）を7回走らせた。5回目で誤り 0（回ごとの数は `typecheck-log.md`）。
- build/ の型検査（`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`。a の木）は、A-3 から来る前からの1件だけ。
- 当て直し a（タグから17単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-4 の ops の `removeLines` 22行はどれも `found: 1`
  - C-4 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - 型検査は `ok`、誤り 0（HEAD `7db4c1bf`）
  - `--lockfile-check` は `ok`。差分は削除だけ 11,695行で、C-1 の分と同じ
- 当て直し b（タグから18単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1・C-2・C-3・C-4 の edits はどれも `conflicts: []`
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ
  - 型検査は `ok`、誤り 0（HEAD `ab6bd301`）
  - `--lockfile-check` は `ok`
- b の C-4 の ops の commit（`96ed4622`）の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-4-notebook/edits.patch` が25ファイルとも当たった（行のずれの表示も無い）。
- 注入の外し損ね: edits.patch の後の木で `@INotebook\w+` を `Grep` した。残るのは `labels.ts` の `INotebookDocumentService`（登録あり）と、`notebook/common` の中の作られないクラスだけ。`get(INotebook...)` は無い。`ExtHostContext.*Notebook*`・`MainContext.*Notebook*` の使い手も無い。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 19.11 GB、終わり 18.79 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-4-notebook --checks-out <file>`
   - b: 同じ `--only` の `C-2-debug,` の後に `C-3-remote,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-4-notebook].edits` が `{applied: "ok", subject: "unit C-4-notebook: edits", conflicts: []}`
     - `units[id=C-4-notebook].ops.removeLines` の22行がどれも `found: 1`
     - `units[id=C-4-notebook].warnings` が `[]`（a・b とも）
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`
     - `units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件（a・b とも）
2. **`after` の確かめ**: `--only` から `C-2-debug`（または `C-1-ai`・`B-4-outline-view`・`A-4-notebook-extensions`）を外すと、C-4 の前で止まる（docs/03 の5.1 の2-1）
3. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
4. **3-way に頼らないこと**: b の C-4 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-4-notebook/edits.patch` が 0 で終わる。a の C-4 の ops の commit でも同じ。
5. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `removals/C-4-notebook/unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-4-notebook: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - edits.patch が `workbench.*.main.ts`・`sessions.*.main.ts`・`extensionHost.contribution.ts` に触れない
   - edits.patch の `extHost.protocol.ts` のハンクに `createProxyIdentifier` の行が無い（ID は `removeLines`）
   - edits.patch が `viewsExtensionPoint.ts`（C-3 が直すファイル）に触れない
   - `delete` と `kept` に同じパスが無い。`kept` に `contrib/notebook/common`・`services/notebook` がある。`delete` に `mainThreadNotebookDto.ts`・`notebookSearch.ts` がある
6. **当てた後の木**
   - `contrib/notebook/browser`・`contrib/interactive`・`contrib/replNotebook`・`contrib/outline`・`contrib/search/browser/notebookSearch`・`contrib/search/common/notebookSearch.ts`・`api/browser/mainThreadNotebookDto.ts` が無い
   - `contrib/notebook/common`・`services/notebook`・`contrib/search/common/searchNotebookHelpers.ts`・`api/common/extHostRemovedApi.notebook.ts` がある
   - `extHost.protocol.ts` に `Notebook\w*Shape` の interface の宣言と `createProxyIdentifier<\w*Notebook` が無い。`NotebookCellDataDto` はある
   - `extHost.api.impl.ts` に `extHostNotebook` の語が無く、`createRemovedNotebookApi` がちょうど2回（import と呼び出し）ある
   - `folderMatch.ts` が `FileMatchImpl` を `createInstance` し、`notebook` の語の import が無い
   - `searchModel.ts`・`searchResult.ts`・`searchView.ts`・`replaceService.ts`・`bulkCellEdits.ts` に `@INotebook` が無い
   - `search.contribution.ts` に `closedNotebookRichContentResults` が無い
7. **何もしない実装**（作業ツリーの中で VS Code のテストの仕組みで書く場合）。`createRemovedNotebookApi(ext)` を作る。
   - `workspace.notebookDocuments` が `[]`、`window.visibleNotebookEditors` が `[]`、`window.activeNotebookEditor` が `undefined`
   - `workspace.onDidOpenNotebookDocument(() => {})` などのイベント9つが Disposable を返す
   - `workspace.registerNotebookSerializer('jupyter-notebook', {})`・`notebooks.registerNotebookCellStatusBarItemProvider('x', {})` の返り値が `dispose` を持ち、呼んでも誤りにならない
   - `workspace.openNotebookDocument(URI.file('a.ipynb'))`・`window.showNotebookDocument({})` が reject する
   - `notebooks.createNotebookController('id', 'type', 'label')` の `id`・`notebookType`・`label` が渡した値、`dispose()`・`updateNotebookAffinity()` が誤りにならず、`createNotebookCellExecution()` が誤りを投げる
   - `notebooks.createRendererMessaging('r').postMessage('m')` が `false` で resolve する
   - 提案を有効にしていない拡張で `notebooks.createNotebookControllerDetectionTask('t')`・`registerKernelSourceActionProvider('t', {})`、コントローラーの `postMessage`・`asWebviewUri`・`createNotebookExecution` を呼ぶと誤りを投げる（門が残っていること）
8. **検索の単体テスト**（型検査は通るが、走らせていない）: `contrib/search/test/browser` の `searchModel.test.ts`・`searchResult.test.ts`・`searchViewlet.test.ts`・`searchActions.test.ts`。差し替えを消した `IEditorService`・`IEditorGroupsService`・`IContextKeyService` を、残るテストが要しないか
9. **関門の起動の確かめ**（片づけの後）
   - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`notebookService`・`notebookEditorService`・`notebookSearchService`・`notebookEditorModelResolverService`）が無い
   - 検索のビューが開き、テキスト検索・置換・すべて置換・検索エディタ（前後の行つき）が動く。`.ipynb` がテキストの一致として出る
   - 「ノートブックを作成」などのコマンド、`notebook.*`・`interactiveWindow.*` の設定が無い（`checks` の `absentCommands`・`absentSettings`）
   - TypeScript・Markdown・PowerShell・basedpyright の拡張が起動し、拡張ホストのログにノートブックの API の誤りが無い。「知らない contributes」の警告の有無を記録する
   - Claude Code のパネル（Webview）が開き、差分とコメントが動く

## 判断を仰ぐ点（別案）

1. **検索の入力欄のノートブックの絞り込みを、既定値の定数で残した**（`searchWidget.getNotebookFilters()`）
   - 採った案: `searchWidget.ts` の中だけで、すべて真のまま変わらない値（`onDidChange` は `Event.None`）に替える。検索のビューと検索エディタ（`searchEditor.ts`）は読むだけなので触れない。パッチが小さく、毎週の衝突が減る
   - 別案: 絞り込みを読む所（`searchView.ts` の4か所、`searchEditor.ts` の1か所、`searchEditor/browser/constants.ts` の型）をすべて消す。名前に「notebook」の残りが無くなるが、検索のファイルのハンクが増える
2. **`search.experimental.closedNotebookRichContentResults` の設定の登録を消した**（README に無かった、足したもの）
   - 読み手は消したノートブックの検索だけ。2026-11-14 の規則（消す部品だけが使うものは消す）に当てはめた。`checks.absentSettings` に足した
   - 別案: 登録を残す（`search.contribution.ts` に触れない）
3. **前に `kept` に挙げていた2つを `delete` に移した**: `api/browser/mainThreadNotebookDto.ts`（使い手のチャットの main thread は C-1 で消える）と `contrib/search/common/notebookSearch.ts`（注入していた `searchModel.ts` を直した）。あわせて `contrib/search/common/cellSearchModel.ts`（ノートブックの検索だけが使う）も消した
   - README は前から「型検査で使い手が無いと分かれば delete に足してよい」と書いていた。規則の当てはめ
   - 別案: 残す（呼ばれないので動きは変わらない）
4. **`extHost.protocol.ts` のノートブックの DTO を残した**（消すか迷ったもの）
   - 2026-11-14 の判断「消した API の Shape と ID を消す」に従い、Shape 14個と ID 13行は消した。DTO（`INotebookKernelDto2`・`VariablesResult`・`ICellExecute*Dto`・`INotebookDocumentsAndEditorsDelta`・`INotebookEditorAddData` など）は判断の対象に入っていないので残した。一部は `extHostTypeConverters.ts`・`extHostApiCommands.ts` が使う。未使用の export は型検査の誤りにならないので、どれが使われなくなるかは手で切り分ける必要がある
   - 別案: 使い手の無くなった DTO も消す（`extHost.protocol.ts` のハンクが増え、C-1・C-2 が直す同じファイルの差分が大きくなる）
5. **ノートブックのセルの編集を含む `workspace.applyEdit` を、reject で失敗させる**（`BulkCellEdits.apply()`）
   - 前の README の見込みどおり。テキストの編集と混ざった編集では、先のテキストの編集だけが当たった後で失敗する
   - 別案: セルの編集を黙って捨て、残りの編集は成功させる（拡張には成功と見える）

## docs/ との食い違い

- docs/03 の4節の表（134行）の C-4 は `contrib/notebook`・`services/notebook` を消す側に挙げる。4節の末尾（146行）の「C-4 は `contrib/notebook/common` と `services/notebook` を残す」と、実装は後者に合わせた（前からの食い違い。C-3 のときと同じく、表の側を直すかはリーダーの判断）。
- docs/03 の4節の末尾（146行）は「直しは検索の約15ファイルに及ぶ見込み」と書く。実際は検索の browser 14、検索エディタ 1、検索のテスト 5（計20。テストを除くと15）。
- docs/03 の5.3 は「拡張 API の空の実装は、単位ごとに新しいファイルに置き、`extHost.api.impl.ts` への変更は、その単位の名前空間の行だけにする」と書く。C-4 の拡張 API は `notebooks` のほかに `window`・`workspace` の名前空間にまたがるので、その2つの名前空間の中のノートブックの行も直した（展開の1行ずつ）。食い違いではないが、5.3 の言い方は「その単位の API の行だけ」と読める方が正確。

## 未解決の点

- 起動時の注入（DI）の外し損ねは、型検査では見えない。起動の確かめで見る（特に検索のビューと、`labels.ts` の `INotebookDocumentService`）。
- 拡張の宣言 `notebooks`・`notebookRenderer` の受け手が無くなったときの拡張ホストのログの警告（関門のスモーク）。
- 検索の単体テストは走らせていない（許可に無い。曹参の担当）。
- パッケージ化（`vscode-win32-x64-min`）、起動は、片づけの許可の後。
- 許可に無いコマンドで止まった所は、`<` `>` を含む `--author="... <...>"` だけ。C-2 と同じく `--author=shuko-apply`（既存の commit の作者を探す形）で済んだ。許可の追加は要らない。誤って作ったファイルは無い。

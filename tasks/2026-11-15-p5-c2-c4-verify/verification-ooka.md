# 検証の記録: C-2・C-3・C-4 の edits.patch と検査・テスト（パッケージ化の前まで）

大岡越前守から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 判定

| 単位 | パッケージ化の前まで | 理由の要点 |
|---|---|---|
| C-2-debug | **合格** | 直す点なし。自分で当てたのは C-4 の組 b（C-1 の後）の上だけ。C-2 の組 a（C-1 なし）は、蒙恬の記録を照らしただけ |
| C-3-remote | **合格** | 直す点なし。「C-1 を外すと止まる」は自分で走らせた。C-3 の組 a は、蒙恬の記録を照らしただけ |
| C-4-notebook | **不合格**（直す点1つ。小さい） | 何もしない実装から、提案中の API の門が1つ抜けている（`notebookControllerAffinityHidden`）。曹参のテストも、この抜けを見逃している |

関門の合否は出していない（依頼どおり）。

| brief の項 | 結果 |
|---|---|
| 1. 差分のレビュー | C-2・C-3 は直す点なし。C-4 は門の抜けが1つ（下の「直す点」）。ほかは裁定・docs/03 のとおり |
| 2. C-4 の組 b（18単位） | 自分で実行。`result: ok`。照らし役 `c4-check-json`（当て直し・型検査）・`c4-check-worktree`・`c3-check-worktree` は「期待どおり」。型検査は誤り 0 |
| 2. `after` の止まり（`--stopped`） | 自分で実行。C-3 の1つ（C-1 を外す）と C-4 の4つ（C-2・C-1・B-4・A-4 を外す）。5つとも「期待どおり」 |
| 2. ほかの組（C-2 の a・b、C-3 の a・b、C-4 の a） | **走らせていない**。組 b の後、作業ツリーをタグに戻すコマンドが許可に無い。蒙恬の記録を照らした（2.3） |
| 2. ロックファイル | **自分では作り直していない**（許可に無い）。蒙恬の記録の照らしだけ（2.4） |
| 2. 3-way に頼らずに当たること（`git apply --check`） | **走らせていない**（許可に無い） |
| 3. run-all | tests 2203、pass 2196、**fail 0**、skip 7 |
| 4. 合否 | 上の表 |

## 確かめた成果

- 蒙恬
  - `removals/C-2-debug/edits.patch`（8ファイル、新規1。From `c448c247`）・`unit.json`（2回目の `absentStrings` の直しの後）
  - `removals/C-3-remote/edits.patch`（1ファイル。From `582bd5eb`）・`unit.json`
  - `removals/C-4-notebook/edits.patch`（25ファイル、新規1。From `de356cae`）・`unit.json`
- 曹参
  - `tests/c2-*`（2回目まで）・`tests/c3-*`・`tests/c4-*` の検査と照らし役
  - 台本 `tests/removals/c2-gate-script.md`・`c3-gate-script.md`・`c4-gate-script.md`

読んだときのファイルの sha256:

| ファイル | sha256 |
|---|---|
| `removals/C-2-debug/edits.patch` | `290e6d5f94b81d9b1d1ac0234fd9a8f69a2b11d892dc8e6265d0080b751ce849` |
| `removals/C-2-debug/unit.json` | `ff86b2fb87f0a139aea2db572e15563a006cf058768774aff32e4931f6061743` |
| `removals/C-3-remote/edits.patch` | `2dd86b9adc5be3304047f57ac6dc4d013cc72092bc89a9b4b030b3c0bd367b3f` |
| `removals/C-3-remote/unit.json` | `7ba66e6f33f801b50c73e4dbdb7f46442af56f74f66fdc5f5d901b0d869c81e0` |
| `removals/C-4-notebook/edits.patch` | `ca9c8b99194acbcfd30268d871f19d42ec489c19fdcb5720c713719852b08c4f` |
| `removals/C-4-notebook/unit.json` | `29437ab5005e587396ee92f6514c813b009c781d1cf57faadc7353f2a0e6f6d7` |
| `tests/c2-check-json.mjs` | `d6dfd72e38bfdf275eb6f7fa93ab9b1c1815c2b3a8bc18d2994fed6dda914d6d` |
| `tests/c2-check-worktree.mjs` | `de44b0858276d8c5525cdbbd3a8f5e1f131c5ada2d0e3482da208c2d72527362` |
| `tests/c3-check-json.mjs` | `3350521e662bcc47a2f7484be296db4b00983fe4212079b37897fd82fc2d3e3c` |
| `tests/c3-check-worktree.mjs` | `f449a4d1764d1130c2c88d3afa9a919152f9be765d872e2ce74fd8da6cba06dd` |
| `tests/c4-check-json.mjs` | `6217b0f6a66d31595ada6edb653b089bdc2b3f191c5e439c44bbdd91ca074c3e` |
| `tests/c4-check-worktree.mjs` | `ba87212ddc583bd624ef75ce82d33d8ab313372307b3659141e050c0e877185b` |

## 直す点

### 1. C-4: `updateNotebookAffinity` の提案中の API の門が抜けている（蒙恬・曹参）

**蒙恬（`removals/C-4-notebook/edits.patch` の `extHostRemovedApi.notebook.ts`）**

本家 1.146.0 の `src/vs/workbench/api/common/extHostNotebookKernels.ts`（C-4 が消すファイル）の 280〜287行は、コントローラーの `updateNotebookAffinity` で、提案中の値を渡したときだけ門をかける。

```ts
updateNotebookAffinity(notebook, priority) {
	if (priority === NotebookControllerAffinity2.Hidden) {
		// This api only adds an extra enum value, the function is the same, so just gate on the new value being passed
		// for proposedAPI check.
		checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden');
	}
	...
```

C-4 の何もしない実装（edits.patch の 460〜461行）は中身が空で、この門が無い。

```ts
updateNotebookAffinity(_notebook: vscode.NotebookDocument, _affinity: vscode.NotebookControllerAffinity): void {
},
```

- 提案の値 `NotebookControllerAffinity2`（`extHostTypes.ts` の2660行。`Hidden = -1`）は、当てた後も `extHost.api.impl.ts` の1784行から拡張に見える。提案 `notebookControllerAffinityHidden` も `extensionsApiProposals.ts` の375行に登録されている。
- 提案を有効にしていない拡張が `Hidden` を渡すと、前は誤りを投げ、今は黙って通る。
- 新しいファイルの冒頭の説明は「Proposed API checks are kept so that the gating is the same as before.」と書くが、この1つについては当たらない。README の106行の門の一覧にも、この門が無い。
- 直し方の例: 空の本体の代わりに、本家と同じ条件で門をかける（引数を `affinity` にして、`affinity === -1` のとき `checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden')`）。値の比べ方は、`extHostTypes` の `NotebookControllerAffinity2.Hidden` を import しても、数の -1 でもよい。README の106行の門の一覧にも足す。
- 安定版の API の振る舞い（`Default`・`Preferred` を渡したときに誤りを投げない）は変わらない。直してもパッチの他の所に響かない。

**曹参（`tests/c4-unit.test.mjs`）**

- 642〜659行の門の検査は、期待の門を手で6つ並べている（645行）。実装の門と同じ一覧で、本家の消すファイルから読んでいない。そのため、本家にある7つ目の門の抜けを通している。
- 662〜666行は「`updateNotebookAffinity` は空」を期待している（`/updateNotebookAffinity\([^)]*\): void \{\s*\},/`）。実装に合わせた期待で、本家の振る舞い（`Hidden` のときは門）と合わない。
- 直し方の例:
  - 門の期待を、本家のタグの `extHostNotebookKernels.ts`（と、消す extHost のノートブックのファイル）の `checkProposedApiEnabled(extension, '<名前>')` から読む。消すメンバーの20個を edits.patch の消す塊から読んだのと同じく、仕様の側から取る。
  - 走らせる検査（755〜793行）に、次の2つを足す。
    - 提案を有効にしていない拡張で、`c.updateNotebookAffinity({}, -1)` が `CANNOT use API proposal: notebookControllerAffinityHidden` を投げる。
    - `1`・`2` では投げない。
  - `c4-mutation.test.mjs` に、この門を外すと落ちる壊し方を足す。

C-2 の消すファイル（`extHostDebugService.ts`）には `checkProposedApiEnabled` が無く、門は `extHost.api.impl.ts` の2つだけ。C-2 の何もしない実装は、2つとも残している（抜けは無い）。

### 軽微な指摘（直さなくても、パッケージ化の前の合否には響かない）

1. **曹参（照らし役）**: `c1-check-worktree.mjs`・`c2-check-worktree.mjs` は、C-4 を含む組を前提にしていない。C-4 の組 b の木では、C-4 が消すファイルを「無い」と言う（2.2）。組 b で C-1〜C-4 の作業ツリーの照らしを1回で済ませたいなら、「C-4 が当たっていれば、C-4 の `delete` の中のパスは見ない」形にするとよい。
2. **曹参（`c2-check-json.test.mjs` の199行）**: テストの名前は「実際の記録で 0」だが、中身は「古い記録なら 1 と食い違いの文言」を期待する枝を持つ。名前を中身に合わせるとよい。判定には響かない。

## 1. 差分のレビュー

### C-2-debug

- **裁定と docs/03 のとおりか**: とおり。
  - `contrib/debug/common`・`extensionHostDebugService` 2つ・`callStackWidget.ts` などを残し、本家の `NullDebugService`・`NullDebugVisualizerService`（`common/nullDebugService.ts` の97・144行。本家にあることを確かめた）を登録する（docs/03 の4節の末尾）。
  - `workbench.common.main.ts` への1行の追加は、`// Debug` の節の1行だけ（docs/03 の5.3 の例外。案A）。
  - C-1 と隣り合う import の3行は `removeLines` に回した（5.3、user-decisions の 2026-11-15）。
  - `notebook.variablesView`・`notebook.inlineValues` の登録を消した（user-decisions の 2026-11-15）。
  - `activeDebugConsole` は何もしないコンソール（同）。
  - `customEndpointTelemetryService.ts` は `kept`（同）。
  - `absentStrings` の2つは `/debugService.js'`・`/linkDetector.js'` に替わっている（user-decisions の「C-2 のテストで出た点」）。新しい記録では2つとも検査され、`hitCount: 0`（2.2）。
- **Claude Code の受け手**: 触れていない。`debugColors.ts`（ワークスペースの信頼の画面が使う）は `kept` に残り、当てた木にある。
- **安定版の API**: `createRemovedDebugApi` は `typeof vscode.debug` を返す型で書かれ、型検査が通るので、安定版のメンバーの欠けは無い。
  - 誤りを投げるのは `asDebugSourceUri({})` だけで、本家と同じ文言・同じ条件。
  - `startDebugging` は `false` で resolve、`stopDebugging` は resolve、`register*` は Disposable、イベント6つは `Event.None`。
- **提案中の API の門**: 本家の門は、`extHost.api.impl.ts` の `registerDebugVisualizationProvider`・`registerDebugVisualizationTreeProvider` の2つ（`debugVisualization`）。2つとも残る。消す `extHostDebugService.ts` には門が無い（本家を Grep した）。
- **5.3**: `extHost.api.impl.ts` の変更は、import の差し替え、作る1行の削除、`const debug` の右辺の3か所。ほかの単位の都合の変更は無い。

### C-3-remote

- **裁定と docs/03 のとおりか**: とおり。
  - edits.patch は `viewsExtensionPoint.ts` の1ハンクだけ。消した `remoteExplorer.js` の import を、同じ値の定数 `const REMOTE = 'workbench.view.remote';` に替えた。
  - `delete` 4つ、`removeLines` 13行、`productRemove` 9つは、docs/03 の4節の表（直した後）と README の数に合う。
  - `services/tunnel`・`services/remote`・`platform/remote`・`platform/tunnel`・`mainThreadTunnelService.ts` は `kept`（4節の末尾）。
  - build/ の型の誤り6件を直さないこと、`esbuild-vscode-reh-*` の定義を残すことは、user-decisions の 2026-11-15 のとおり。build/ の tsc で、誤りは A-3 の1件と C-3 の6件の計7件。蒙恬の記録と同じ（2.2）。
- **Claude Code の受け手**: Webview が注入する `ITunnelService`（`services/tunnel/browser/tunnelService.ts`）が当てた木に残る。拡張 API の `openTunnel` などの実装も残る。
- **拡張 API**: 触れていない（`extHostRemovedApi.remote.ts` は無い。要らない）。
- **5.3**: `viewsExtensionPoint.ts` は、ほかの単位のパッチが触らない。`after` は `A-5`・`C-1`（4節の末尾の「C-3〜C-7 は C-1」）。

### C-4-notebook

- **裁定と docs/03 のとおりか**: 門の1つ（上の「直す点」）を除いて、とおり。
  - `contrib/notebook/common`・`services/notebook` を残す（4節の末尾）。
  - B-4 が「C-4 まで」と残した `contrib/outline/browser/outline.ts` を、`delete` の `contrib/outline` で消す（B-4 の `kept` の理由と合う）。
  - user-decisions の 2026-11-15 の6点は、どれもそのとおり。
    - 検索の絞り込みを既定値の定数で残す（`searchWidget.ts`）
    - `search.experimental.closedNotebookRichContentResults` を消す
    - `mainThreadNotebookDto.ts`・`notebookSearch.ts`・`cellSearchModel.ts` を `delete` へ移す
    - DTO を残す
    - セルの編集を含む `workspace.applyEdit` を reject する（`BulkCellEdits.apply()`）
    - `.ipynb` はテキストとして探す
  - `extHost.protocol.ts` は Shape を14個消し、ID の13行は `removeLines`（5.3）。
- **Claude Code の受け手**: `mainThreadEditorTabs.ts` から、対話ウィンドウのタブの分岐だけを外した（`NotebookEditorInput`・Webview・差分エディタの分岐は残る）。コメント（`contrib/comments`）が使う `notebook/common` は残る。当てた木で、Webview・Webview のビュー・コメント・ワークスペースの信頼・ファイルシステムの提供者・セカンダリサイドバーの部品があることを確かめた。
- **全文検索を壊していないか**:
  - 消した `NotebookCompatibleFileMatch.createMatches` は、モデルが無いときの最後に `this.addContext(this.rawMatch.results)` を呼んでいた（本家 `notebookSearch/notebookSearchModel.ts` の472行）。`FileMatchImpl.createMatches` の同じ枝（本家 `fileMatch.ts` の123〜133行）に、この1行を足した。前後の行（検索エディタの context）は前と同じに出る見込み。
  - `folderMatch.ts` は2か所で `FileMatchImpl` を作り、`searchInstanceID` の引数を外した（`FileMatchImpl` の constructor は取らない）。
  - `searchModel.ts` は `textSearchSplitSyncAsync` を残し、ノートブックの結果を混ぜる所だけを外した。
  - `replaceService.ts` は一括編集とテキストの保存を残す。`searchView.ts` は置換のプレビューと開く処理を残す。`searchEditorSerialization.ts` は、セルの一致の書き出しだけを外した。
  - 検索のテストは、ノートブック専用の2つを消し、残りは一致を `FileMatchImpl` で作る形にした。消したテストはノートブックの一致だけを見るもので、テキストの検索のテストは消していない。
  - 型検査は通る。検索の単体テストは、作業ツリーで走らせる許可が無く、走らせていない（関門で見る）。
- **安定版の API**: `IRemovedNotebookApi` は、`typeof vscode.notebooks` と、`window`・`workspace` の該当のメンバーの `Pick` で型づけされる。`extHost.api.impl.ts` で `typeof vscode.window` などに展開される。型検査が通るので、メンバーの欠けは無い。
  - 同期で誤りを投げるのは `createNotebookCellExecution` だけ。本家も、ノートブックに結びつかないコントローラーでは投げる。
  - `openNotebookDocument`・`showNotebookDocument` は Promise の reject（README の101行に書いてある）。
- **提案中の API の門**: 本家の門は計7つ。
  - `extHost.api.impl.ts` の `notebookKernelSource` の2つ
  - `extHostNotebookKernels.ts` の5つ（`notebookVariableProvider`・`notebookExecution`・`notebookControllerAffinityHidden`・`notebookMessaging` の2つ）

  何もしない実装に残るのは6つで、`notebookControllerAffinityHidden` が抜けている（上の「直す点」）。`registerNotebookSerializer`・`createNotebookController` の `isProposedApiEnabled`（投げない分岐）は、何もしない実装では要らない。
- **5.3**:
  - C-4 のパッチは、C-3 の `viewsExtensionPoint.ts` に触れない。
  - C-1・C-2 の出力の上でしか当たらない箇所があるが、`after` が C-1・C-2 を挙げているので仕様どおり。
  - `extHost.api.impl.ts` で直したのは、ノートブックの部品への参照（`window`・`workspace`・`notebooks` の項目、作る所、`languages.match`）だけ。

### 起動時の検査に掛かるもの（当てた18単位の木で照らした）

型検査には掛からないが、起動時に壊れるもの。

- 拡張ホスト側: `extHost.api.impl.ts` の235行で `rpcProtocol.assertRegistered(Object.values(ExtHostContext))` を呼ぶ。`ExtHostContext` の62個は、164〜231行の `rpcProtocol.set(ExtHostContext.…)` で62個とも登録される。
- main 側: `MainContext` の68個は、`extHostNamedCustomer(MainContext.…)` の62個と、ほかの受け手が作る6個で埋まる。6個は `MainThreadDocuments`・`MainThreadTextEditors`・Webview の4つで、本家と同じ形。消した ID の受け手が残っている所も、受け手の無い ID も無い。
- 注入: 木の全体（テストを除く）で `@INotebook…`・`@IInteractive…`・`@IRemoteTunnelService` を探した。
  - 残るのは、`labels.ts` の `INotebookDocumentService` と、`notebook/common` の中のクラスだけ。前者は `workbench.common.main.ts` の85行で登録がある。
  - `notebook/common` のクラスを外から作る所は無い。
  - `@IDebugService` は残る部品が注入し、`NullDebugService` が受ける。

## 2. 当て直し・照らし・型検査

始める前の作業ツリーは、タグに戻してあった（`C:\b\vscode\.git\worktrees\p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`）。記録はすべて `tasks/2026-11-15-p5-c2-c4-verify/run/` に書いた。

### 2.1 `after` の止まり（タグのまま。作業ツリーに書かない）

`apply.mjs` は、`--only` に `after` の単位が無いと `planUnits` の誤りになる。作業ツリーの状態を見る前（`scripts/apply.mjs` の255行）に止まり、止めた後の検査も読むだけ（446〜465行）。そのため、タグに戻さずに5つとも走らせた。走らせた後も、HEAD は `69047191` のままだった。

| 外した単位 | 記録 | `errors` | 照らし役 |
|---|---|---|---|
| C-3 から C-1-ai | `checks-c3-noc1.json` | `C-3-remote: after の単位 C-1-ai が先に当たらない（--only に入っていない）` | `node tests/c3-check-json.mjs --stopped …` → 期待どおり |
| C-4 から C-2-debug | `checks-c4-noc2.json` | `C-4-notebook: after の単位 C-2-debug が先に当たらない（…）` | `node tests/c4-check-json.mjs --stopped … C-2-debug` → 期待どおり |
| C-4 から C-1-ai | `checks-c4-noc1.json` | `C-4-notebook: after の単位 C-1-ai が先に当たらない（…）` | 同 `C-1-ai` → 期待どおり |
| C-4 から B-4-outline-view | `checks-c4-nob4.json` | `C-4-notebook: after の単位 B-4-outline-view が先に当たらない（…）` | 同 `B-4-outline-view` → 期待どおり |
| C-4 から A-4-notebook-extensions | `checks-c4-noa4.json` | `C-4-notebook: after の単位 A-4-notebook-extensions が先に当たらない（…）` | 同 `A-4-notebook-extensions` → 期待どおり |

5つとも、`stoppedAt.phase: inputs`、`commits: []`、`baseCommit` = `headCommit` = `69047191`。終了コードは 1（`result: fail`）。

### 2.2 C-4 の組 b（18単位）

| 手順 | コマンド | 結果 |
|---|---|---|
| 1b | `node scripts/apply.mjs C:/b/wt/p2 --label c4-gate-b-ooka --only <A・B の14>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook --checks-out tasks/2026-11-15-p5-c2-c4-verify/run/checks-c4-b.json` | `結果: ok`。警告は `C-2-debug: delete: …debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ（想定済み） |
| 1b | `node tests/c4-check-json.mjs tasks/2026-11-15-p5-c2-c4-verify/run/checks-c4-b.json` | 期待どおり（組 b: 当て直しのみ） |
| 1d | `node tests/c4-check-worktree.mjs C:/b/wt/p2` | 期待どおり（作業ツリー） |
| 参考 | `node tests/c3-check-worktree.mjs C:/b/wt/p2` | 期待どおり（作業ツリー） |
| 参考 | `node tests/c2-check-worktree.mjs C:/b/wt/p2` | 食い違い3件。下の「c1・c2 の照らし役」 |
| 参考 | `node tests/c1-check-worktree.mjs C:/b/wt/p2` | 食い違い2件。同 |
| 参考 | `node tests/c2-check-json.mjs …/checks-c4-b.json` | 食い違いは「想定していない単位: C-3-remote・C-4-notebook」の2件だけ。C-2 のほかの期待（`removeLines` 27行、警告1件、新しい2項目を含む `absentStrings` 15項目の記録、コミット）は満たす |
| 参考 | `node tests/c3-check-json.mjs …/checks-c4-b.json` | 食い違いは「想定していない単位: C-4-notebook」の1件だけ。C-3 のほかの期待は満たす |
| 2 | `node scripts/build.mjs 1.146.0 --label c4-gate-b-ooka --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record tasks/2026-11-15-p5-c2-c4-verify/run/typecheck-c4-b.json --take-in-dir tasks/2026-11-15-p5-c2-c4-verify/run/take-in-b` | `result: ok` |
| 2 | `node tests/c4-check-json.mjs …/checks-c4-b.json …/typecheck-c4-b.json` | 期待どおり（組 b: 当て直し・型検査） |
| 参考 | `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json` | 誤り7件。下の箇条書き |

build/ の tsc の誤り7件の内訳。どちらも判断済みで、蒙恬の記録と同じ。

- `gulpfile.vscode.ts(139,43)` の1件: A-3 から。
- 残りの6件: C-3 の `productRemove` から（`serverDataFolderName` 2・`win32TunnelMutex`・`win32TunnelServiceMutex`・`tunnelApplicationName` 2）。

照らし役が落ちるべきときに落ちることも見た。

- 当たった組 b の記録を `--stopped` で照らすと、食い違い4件で 1 を返す。
- 組 b の当て直しに、蒙恬の組 b の型検査の記録（別の HEAD）を組み合わせると、「型検査の HEAD が当て直しの HEAD と違う」で 1 を返す。

当て直しの記録（`checks-c4-b.json`）の中身:

- `baseCommit` は `69047191`（タグ）、`headCommit` は `a1f0963f93f0ab9f1d4a78789335a00036d7ae16`、`result` は `ok`。
- 18単位すべてが `applied: ok`。C-1・C-2・C-3・C-4 の edits は、どれも `applied: ok`・`conflicts: []`。件名は `unit C-<n>-…: edits`。
- 次のものは、どれも0件。
  - `"applied": "fail"`・`"conflict"`・`"error"`
  - `removeLines` の `"ok": false`
  - `hitCount` が1以上の項目
- 単位の `warnings` は C-2 の1件だけで、C-3・C-4 は `[]`。
- C-2 で替えた `absentStrings` の `/debugService.js'`・`/linkDetector.js'` は記録にあり、どちらも `hitCount: 0`。
- `patches/` の2つ（`20-product-configuration-defaults.patch`・`30-proxy-direct-without-settings.patch`）も `applied: ok`。

型検査の記録（`typecheck-c4-b.json`）:

- `steps[0]`: `pnpm run typecheck-client`、`exitCode: 0`、5.15秒。ログ `C:\b\logs\c4-gate-b-ooka\typecheck.log` はコマンドの1行だけで、`error` の語は無い。
  - 短いが、この木の TypeScript は `@typescript/typescript6`。蒙恬の同じ手順は誤りを 82 → 0 と数えているので、型検査は働いている。
- `sourceVersion.value` は `a1f0963f…` で、当て直しの `headCommit` と同じ。`uncommittedEntries` は 0、`error` は `null`。

**c1・c2 の照らし役の食い違い**（実装の不具合ではない）:

- `c2-check-worktree.mjs` は、次の3つが無いと言う。
  - `contrib/notebook/browser/notebook.contribution.ts`
  - `contrib/notebook/browser/controller/editActions.ts`
  - `contrib/replNotebook/browser/repl.contribution.ts`
- `c1-check-worktree.mjs` は、次の2つが無いと言う。
  - `contrib/notebook/browser/media/notebookChatEditorOverlay.css`
  - `contrib/notebook/browser/diff/inlineDiff/notebookCellDiffDecorator.ts`
- どれも C-4 の `delete`（`contrib/notebook/browser`・`contrib/replNotebook`）が消すファイルで、ほかの項目の食い違いは出ていない。
- 2つの照らし役は、C-4 を含まない組を前提に書かれている。依頼の「4単位すべての照らしが1回で済む」は、C-3・C-4 の照らし役と、C-2・C-3 の記録の照らし（上の「参考」の行）についてだけ当たる（軽微な指摘の1）。

### 2.3 自分で走らせていない組（蒙恬の記録の照らし）

組 b の後に作業ツリーをタグに戻すには、`git -C C:/b/wt/p2 checkout 1.146.0` が要る。大岡越前守の許可に無いので、ほかの組はそこで止めた。代わりに、蒙恬の記録（タグから当てたもの）を照らし役にかけた。

| 記録 | コマンド | 結果 |
|---|---|---|
| C-2 の組 a | `node tests/c2-check-json.mjs tasks/2026-11-15-p5-c2-patch/trial/checks-verify-a.json tasks/2026-11-15-p5-c2-patch/trial/build-typecheck-verify-a.json` | 食い違い1件: `C-2-debug の absentStrings のうち検査の記録が無いもの: /debugService.js', /linkDetector.js'` |
| C-2 の組 b | 同じ形（`-b`） | 同じ1件だけ |
| C-3 の組 a | `node tests/c3-check-json.mjs tasks/2026-11-15-p5-c3-patch/trial/checks-verify-a.json …/build-typecheck-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |
| C-3 の組 b | 同じ形（`-b`） | 期待どおり（組 b: 当て直し・型検査） |
| C-4 の組 a | `node tests/c4-check-json.mjs tasks/2026-11-15-p5-c4-patch/trial/checks-verify-a.json …/build-typecheck-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |

- C-2 の記録の食い違いは、曹参の C-3 の引き継ぎの指摘2のとおり。蒙恬の記録は、`absentStrings` を替える前の `unit.json` で取った古いもの。新しい2項目は、自分の組 b の記録で検査され、0 件だった。
- ただし、C-2 の組 a（C-1 なし）で新しい2項目が 0 件になることは、記録が無く確かめていない。蒙恬の2回目の調べ（本家で当たるのは `kept` と `delete` の中だけ）からは、0 件の見込み。
- C-2 の組 a で、C-2 の edits が C-1 なしで当たること（`conflicts: []`）と型検査の誤り 0 は、蒙恬の記録で照らした範囲では食い違いが無い（上の1件の他）。

### 2.4 ロックファイル（蒙恬の記録を読んだだけ）

`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` が許可に無いので、作り直していない。C-2〜C-4 は依存もパッチの行も消さないので、変わるのは C-1 の分だけの見込み。

- C-2〜C-4 の照らし役は、記録に `--lockfile-check` の結果があれば、それも見る。上の表の「期待どおり」はそれを含む。
- C-4 の組 b の記録 `tasks/2026-11-15-p5-c4-patch/trial/checks-verify-b.json`（label `c4-verify-b`、`baseRef` `69047191`、`checkedAt` `2026-11-15T03:18:22Z`）の `checks.lockfile` を読んだ。
  - `status: ok`。ルートの `pnpm-lock.yaml` は `changedSections: []`、`removedPatches: ["foundry-local-sdk"]`（C-1 の分）。`unexpected…` の一覧はどれも空。
  - ほかのロックファイルは `unchanged: true`。

## 3. テスト

`node tests/run-all.mjs --save tasks/2026-11-15-p5-c2-c4-verify/run/run-all-ooka.txt` を走らせた。終了コードは 0。

- TOTAL: tests 2203、pass 2196、**fail 0**、skip 7。
- skip 7 は `removals.test.mjs` の既存の分。曹参の C-4 の記録（`tasks/2026-11-15-p5-c4-tests/run-all-result.txt`）と同じ。
- C-2〜C-4 の分は、どれも fail 0。

| ファイル | 件数 |
|---|---|
| `c2-unit` | 56 |
| `c2-mutation` | 48 |
| `c2-check-json` | 11 |
| `c2-worktree` | 22 |
| `c3-unit` | 28 |
| `c3-mutation` | 43 |
| `c3-check-json` | 11 |
| `c3-worktree` | 19 |
| `c4-unit` | 52 |
| `c4-mutation` | 62 |
| `c4-check-json` | 12 |
| `c4-worktree` | 26 |

- C-1 の分（`c1-unit` 37、`c1-round2` 13、`c1-check-json` 8、`c1-mutation` 21、`lockfile-patched` 17）も fail 0。
- 範囲の外: run-all には、C-5 の `c5-unit`（42）・`c5-mutation`（62）も入り、fail 0。`tests/c5-check-json.test.mjs`・`c5-worktree.test.mjs` は、run-all が一覧を読んだ後に置かれたようで、この結果に入っていない（曹参が作っている途中と見られる）。
- 単独でも、`c2-unit`・`c2-check-json.test`・`c2-worktree`・`c3-unit`・`c3-mutation`・`c3-check-json.test`・`c3-worktree`・`c4-unit`・`c4-mutation`・`c4-check-json.test`・`c4-worktree` を `node --test` で走らせた。どれも fail 0。
- テストが仕様を正しく確かめているか:
  - C-2・C-3 は、門・消すメンバー・定数の値・`absentStrings` の空振りを、本家と edits.patch の消す側から読んで照らしている。実装に合わせて書いた所は見つからなかった。壊した写し（C-2 48、C-3 43）で落ちることも確かめている。
  - C-4 は、門の期待だけが実装に合わせた一覧になっている（「直す点」の1）。ほかの項目は、本家と edits.patch の消す側から読んでいる。検索のハンクを本家に当てる検査もある。

## 4. 合否と次にすること

- **C-2-debug: 合格**（パッケージ化の前まで）。範囲は次のとおり。
  - 1 のレビュー、組 b（C-1 の後）での当て直し・型検査・`absentStrings` は、自分で確かめた。
  - C-1 なしの組 a、ロックファイル、`git apply --check` は、蒙恬の記録の照らしだけ。
- **C-3-remote: 合格**（パッケージ化の前まで）。範囲は次のとおり。
  - 1 のレビュー、組 b（C-1・C-2 の後）での当て直し・照らし・型検査、`after` の止まりは、自分で確かめた。
  - C-2 なしの組 a、ロックファイル、`git apply --check` は、蒙恬の記録の照らしだけ。
- **C-4-notebook: 不合格**（パッケージ化の前まで）。直す点は「直す点」の1だけ。
  - 蒙恬: `extHostRemovedApi.notebook.ts` の `updateNotebookAffinity` に門を足し、README の門の一覧を直す。
  - 曹参: 門の期待を本家の消すファイルから読む形にし、`updateNotebookAffinity` の門の検査と壊し方を足す。
  - ほかの項目（当て直し・照らし・型検査・`after` の止まり・検索・受け手・起動時の ID）は、組 b で確かめた範囲で不合格の点は無い。
  - 直した後に確かめ直すこと: C-4 の組 b の当て直し・型検査・照らし（作業ツリーをタグに戻すコマンドが要る）と、`c4-unit`・`c4-mutation` を含む run-all。
- 走らせるのに許可が足りなかったもの（台本のとおりに走らせるなら要る）:

| 何のために | 要るコマンド |
|---|---|
| 組と組の間で、作業ツリーをタグに戻す（`apply.mjs` は今の HEAD の上に当てる） | `git -C C:/b/wt/p2 checkout 1.146.0` |
| ロックファイルを作り直す（台本の 1d・1e） | `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` |
| ロックファイルを戻す | `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` |
| 3-way に頼らずに当たることの確かめ（台本の 1e・1f） | `git -C C:/b/wt/p2 log --format="%H %s" -n 80`、`git -C C:/b/wt/p2 checkout <ops の sha>`、`git -C C:/b/wt/p2 apply --check -v e:/develop/self/Team/projects/ai-editor/removals/C-<n>-…/edits.patch` |
| C: の空きを測る（台本の前提） | 測るコマンドが許可に無い。書いたのは記録とログだけ（数 MB 以下）。当て直しの commit は作業ツリーの git に入る |

- 上の許可が足されたら、走らせる組は次のとおり。
  - C-2 の組 a・b
  - C-3 の組 a
  - C-4 の組 a
  - C-4 を直した後の組 b
  - それぞれのロックファイルと `git apply --check`

## 作業ツリーの状態（終わったとき）

- `C:\b\wt\p2` の HEAD は `a1f0963f93f0ab9f1d4a78789335a00036d7ae16`（`C:\b\vscode\.git\worktrees\p2\HEAD` を読んだ）。run-all の後も変わっていない。
- 当てた単位は次のとおり（label `c4-gate-b-ooka`）。未コミットの変更は 0（型検査の記録の `uncommittedEntries`）。
  - A-1〜A-7・B-1〜B-7 の14
  - C-1-ai・C-2-debug・C-3-remote・C-4-notebook
  - `patches/` の2つ
- タグには戻していない（戻すコマンドが許可に無い）。次に `apply.mjs` を使う前に、`git -C C:/b/wt/p2 checkout 1.146.0` で戻す必要がある。蒙恬の C-5 の作業でこの作業ツリーを使うときも同じ。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` と、普段使いのエディタのデータには触れていない。パッケージ化と zip はしていない。

## 記録

- この文書: `tasks/2026-11-15-p5-c2-c4-verify/verification-ooka.md`
- `tasks/2026-11-15-p5-c2-c4-verify/run/`
  - `checks-c3-noc1.json`・`checks-c4-noc2.json`・`checks-c4-noc1.json`・`checks-c4-nob4.json`・`checks-c4-noa4.json`（`after` の止まり）
  - `checks-c4-b.json`（C-4 の組 b の当て直し）
  - `typecheck-c4-b.json`（型検査）。ログは `C:\b\logs\c4-gate-b-ooka\typecheck.log`
  - `run-all-ooka.txt`（run-all）
- `--take-in-dir` に渡した `run/take-in-b/` は作られなかった（型検査の手順だけでは書かれない）。

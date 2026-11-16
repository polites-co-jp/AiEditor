# 関門: C-1-ai（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16
- 全体の記録: `gate-p5-c-all-r3c.md`（同じフォルダ）
- 判定:
  - **起動した版の振る舞い（docs/03 の7節の1〜4）: 合格**。r2 の3種の誤りは、同じ道を通しても出なくなった
  - **網（曹参の c1-unit）: 59件中2件が落ちる**。1件（消した部品の使い手）は、数えられた18件を1件ずつ見て、どれも実害が無かった（網の誤検出16件、残る登録を見落とした1件、直さないと決めた例外1件）。もう1件（edits.patch の形）は、どこが合わないかを私の読める形で取り出せず、原因は分かっていない
  - **総合: 保留**。振る舞いは合格だが、検証（c1-unit）が落ちたままなので、合格にしない。2件の片がついたら、振る舞いの結果はそのまま使える（edits.patch の書き方だけを直して作り直したときは、照らし役とスモーク1回で同じ振る舞いかを見れば足りる見込み）

## 1〜4

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c1-check-json.mjs <checks.json>` は「期待どおり」、`node tests/c1-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」。C-1 の edits は `applied: ok`・衝突なし |
| 2 型検査とビルド | 合格。`searchView` を省略できる型にしても、型検査の誤りは 0 |
| 3 消えている | 合格。absent の12項目が pass（うち `search.action.showAIResults`・`agent-host` は網にならず、ソースの検査を根拠にする。r2 と同じ）。absentHosts の `release-assets.githubusercontent.com` は監査2通りで接続なし |
| 4 壊れていない | 合格。スモーク3回とも PASS 49 / FAIL 0。誤りは既知の2つ（DEP0169・DiffEditorWidget）だけ |

## r2 の3種の道を通したか（依頼の1）

蒙恬の起動の確かめはこの道を通らない。スモークの probe が通る道と、r2 の誤りの呼び出し履歴を照らして、同じ道を通したと確かめた。

| r2 の誤り | 通した道（スモークの項目） | r2 での証拠（誤りの出た所） | r3c の結果（3回とも） |
|---|---|---|---|
| `depends on UNKNOWN service terminalChatService` | `base.terminal`: `createTerminal` → `show()`（ターミナルのグループとタブのビューができる） | r2 の renderer.log の履歴: `lb.createTerminal` → `ffe.createGroup` → `Ife._createTabsView` | base.terminal PASS。renderer.log・コンソールに `UNKNOWN service` は無い |
| `reading 'semanticSearchBehavior'` | `base.search`・`base.replace`: `workbench.action.findInFiles`（検索の欄に値を入れて検索を起こす） | r2 の履歴: `Y$.setSearchParameters` → `WK.onValueChange` → `TE.onSearchInputChanged` → `TE.submitSearch` → 聞き手（欄に打ったときも、同じ `onValueChange` → `onSearchInputChanged` を通る） | base.search・base.replace PASS。`semanticSearchBehavior` の誤りは無い |
| `command '_chat.editSessions.accept' not found` | `base.git`: `repo.add` → `repo.commit` | r2 の Git.log の `git add -A -- tracked.txt` と `git … commit …` の直後に誤り | Git.log に同じ `git add -A -- tracked.txt`（1回目 15:39:27）と `git -c user.useConfigOnly=true commit …`（15:39:28）がある。exthost.log・renderer.log に誤りは無い |

あわせて見たもの:

- `workbench.action.terminal.chat.viewHiddenChatTerminals`（r3b で足した何もしないコマンド）は登録されている（commands.json）。
- アカウントのメニューの「Manage Trusted MCP Servers」（`_manageTrustedMCPServersForAccount`）の項目は、edits.patch で消してある。画面での確かめは、MCP の認証の提供者が無いので、出ないことしか見られない。
- 統合ブラウザ（`IAgentNetworkFilterService` の登録）は、スモークも absent も開かない。手の項目 C22（`manual-checks-p5-c-all-r3c.md`）。

## 網（c1-unit）

```
node tests/run-all.mjs --no-ps --only c1-unit --save tasks/2026-11-15-p5-stagec-gate/c1-unit-r3c.txt
node tests/orphans-report.mjs C-1-ai --out tasks/2026-11-15-p5-stagec-gate/orphans-C-1-r3c.txt
```

c1-unit: 59件、pass 57・fail 2（見張りも通った）。落ちた2件:

1. `C-1 消した部品の使い手: サービスの注入・設定のキーの鎖の読み・コマンドの呼び手(組み込み拡張を含む)が、残るコードに残っていない`
2. `C-1 edits.patch の形: ハンクの行数が見出しと合い、空の文脈の行(先頭の空白が落ちたもの)を数えても、1行ずつ読む読み手と見出しで読む読み手の + / - の行が一致する`

### 1 の中身（網の報告。サービス 17・設定 0・コマンド 1）

| 数えられたもの | 件数 | 見た結果 |
|---|---|---|
| `IInstantiationService` の注入（`app.ts`・`sharedProcessMain.ts`・`windowsMainService.ts` など、main・共有プロセス・サーバーの16か所） | 16 | 実害なし。注入の仕組みそのもので、どのサービスの集まりも自分を `IInstantiationService` として持つ。C-1 が消したファイルの中の子の集まりの `.set(IInstantiationService, …)` を「C-1 だけが消した登録」と数えた網の誤検出と見られる（推定）。3回のスモークの main・共有プロセスのログに誤りは無い |
| `IGitHubService` の注入（`platform/github/common/remote/ipcServer.ts` 48行） | 1 | 実害なし。登録は残っている（`code/electron-utility/sharedProcess/sharedProcessMain.ts` 341行 `services.set(IGitHubService, …)`）。網が残る登録を見落とした（`sharedProcessMain.ts` は C-1 の edits.patch が直すファイルなので、その中の登録を「消す行」と取り違えた恐れ。推定） |
| `workbench.action.unifiedQuickAccess` の呼び出し（`browser/actions/quickAccessActions.ts` 187行） | 1 | 実害なし。消えた設定（統合の Agents バー）が真のときだけ呼び、`try/catch` でふつうのクイックアクセスに戻る（181〜194行を読んだ）。蒙恬が「直さない。例外にしてほしい」としたもの |

→ 網の直し（誤検出を除く・残る登録を見る・例外を入れる）は曹参の仕事。C-1 の edits.patch に直すべき所は無い。

### 2 の中身

- この検査は、edits.patch のハンクの行数を見出しと照らし、2通りの読み手（1行ずつ読む `parsePatchSections` と、見出しの行数で読む読み手）が同じ + / - の行を得るかを見る。
- どのハンクで食い違うかは、私の読める形で取り出せなかった。c1-unit は3分を超えて背景に回り、背景の出力は私の読める場所の外になる。`run-all.mjs` のまとめは名前だけを出す。
- 蒙恬の書き付け（R3-5 の未解決の3）に、edits.patch の空の文脈の行の先頭の空白が落ちている、とある。`git am` は受け付けたので、版は正しく当たっている（1 当たる）。ただ、検査がその上で落ちるなら、見出しの行数か読み手の違いのどちらかが合っていない。本家が同じ所を変えた週の取り込み（3方向の当て方）で当たらない恐れがあるので、直すべき傷と見る。
- 直す所: 蒙恬が `C:/b/wt/*` か許可のある作業ツリーで `git format-patch` し直す（空の文脈の行と `index` の行が入る）。または、曹参が落ちたハンクの場所を出力に出す。どちらにするかはリーダーが決める。

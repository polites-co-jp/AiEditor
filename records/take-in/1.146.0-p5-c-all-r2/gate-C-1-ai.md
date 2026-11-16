# 関門: C-1-ai（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16
- 全体の記録: `gate-p5-c-all-r2.md`（同じフォルダ）
- 判定: **不合格**（7節の4「壊れていない」。前の段階に無い誤りが3種。うち1つは注入の外し損ね `depends on UNKNOWN service`）

前回（`1.146.0-p5-c-all`）の2つの症状は直った。ワークベンチは立ち上がり、CLI の `--install-extension` は台帳の拡張がすべて通る。Claude Code の組（起動・.lock・拡張ホストのログ）も通った。代わりに、前回はワークベンチが起動しなかったために見えていなかった誤りが3種出た。どれも、C-1 が消した部品の受け手が残っているもの。

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c1-check-json.mjs <checks.json>` は「期待どおり」、`node tests/c1-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」。product.json の読み手の直し（8ファイル）は edits.patch に入り、`applied: ok`・衝突なし |
| 2 型検査とビルド | 合格（全体の記録の1節）。`defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` を省略できる型にしても型検査の誤りは 0 |
| 3 消えている | 合格。absent の12項目（コマンド3・ビュー2・設定6・プロセス1）が pass。ただし `search.action.showAIResults` と `agent-host` のプロセスは、公式の版でもこの環境では出ない（`--expect present` で fail）ので網にならない。この2つは、ソースの消し残りの検査（`AISearch/aiSearchModel`・`platform/agentHost/`・`services/agentHost/` の absentStrings が 0 件）を根拠にした。absentHosts の `release-assets.githubusercontent.com` は、2通りの監査で接続も名前の問い合わせも無い |
| 4 壊れていない | **不合格**。下の3つ |

## 症状（スモークの3回とも同じく出た。全体の記録の4節）

### 1. `depends on UNKNOWN service terminalChatService`（ターミナルのビューが描けない）

```
2026-11-16 13:02:01.122 [error] Fail to render view terminal [createInstance] Sfe depends on UNKNOWN service terminalChatService.
2026-11-16 13:02:01.778 [error] Error: [createInstance] Sfe depends on UNKNOWN service terminalChatService.
    at s._throwIfStrict (…workbench.desktop.main.js:1875:5269)
    …
    at Ife._createTabsView (…workbench.desktop.main.js:2548:21718)
    …
    at lb.createTerminal (…workbench.desktop.main.js:2546:56087)
```

（`tmp\b\smoke\runs\p5r2-1-261116T035921\logs\window1\renderer.log` の6〜23行。開発者ツールのコンソール `chromium.log` にも同じ文が出る）

- 切り分け: `ITerminalChatService`（`src/vs/workbench/contrib/terminal/browser/terminal.ts` 46行。ターミナルの本体に残る ID）を、残る `terminalTabbedView.ts`（80行の注入）と `terminalTabsChatEntry.ts`（33行）が注入する。実装は `contrib/terminalContrib/chat` にあり、C-1 が `delete` で消した（`removals/C-1-ai/unit.json` 19行、`removeLines` 193行）。何もしない実装の登録が無い。
- 影響: ターミナルを作るたびに、ターミナルのタブのビュー（`_createTabsView`）の作成が落ちる。スモークの `base.terminal`（`sendText` でコマンドが走ったか）は PASS したので、ターミナルのプロセスは動く。ただ、パネルのタブの一覧が描けない見込み（推定。手の項目 C21 で見る）。
- docs/03 の7節の4と各単位の台本が「無いこと」を求める `depends on UNKNOWN service` そのもの。

### 2. `Cannot read properties of undefined (reading 'semanticSearchBehavior')`（全文検索の入力の聞き手）

```
2026-11-16 13:02:02.792 [error] TypeError: Cannot read properties of undefined (reading 'semanticSearchBehavior')
    at yZ.value (…workbench.desktop.main.js:1988:27085)
    …
    at TE.submitSearch (…workbench.desktop.main.js:1984:793)
    at TE.onSearchInputChanged (…workbench.desktop.main.js:1982:155)
    …
    at Y$.setSearchParameters (…workbench.desktop.main.js:1991:11745)
```

（同じ renderer.log の96行から）

- 切り分け: `src/vs/workbench/contrib/search/browser/searchView.ts` の695行（`onSearchSubmit` の聞き手）が `getValue('search').searchView.semanticSearchBehavior` を読む。C-1 は `search.searchView.semanticSearchBehavior`・`search.searchView.keywordSuggestions` の登録を消した（`search.contribution.ts` 213行の注記）。`search.searchView.*` の設定が1つも無くなり、`searchView` が `undefined` になった。2002行（`keywordSuggestions`）と2008行も同じ形で、検索の結果を待つ所で同じく落ちうる。
- 影響: 検索の欄の入力から送られる検索（`onSearchInputChanged` → `submitSearch` → 聞き手）で例外が出る。聞き手は、例外の行の後で `triggerQueryChange` を呼ぶので、欄に打った検索が走らない恐れがある（推定）。スモークの `base.replace`（`findInFiles` のコマンドで検索して1件置換）は PASS し、コマンドからの検索の結果は出た。欄に打ったときの振る舞いは手の項目 C7 で見る。

### 3. `command '_chat.editSessions.accept' not found`（git のステージ・コミットのたび）

```
2026-11-16 13:02:14.023 [error] Error: command '_chat.editSessions.accept' not found
```

（`window1\exthost\exthost.log`。renderer.log にも2回）

- 切り分け: 組み込みの git の拡張（`extensions/git/src/repository.ts` 1286行の `add`、1499行の `commit`）が、チャットの編集の受け入れのコマンドを、待たずに呼ぶ。コマンドは `contrib/chat` にあり、C-1 が消した。
- 影響: ステージとコミットは通る（スモークの `base.git` は PASS）。ただし、そのたびに拡張ホストのログに誤りが残る。Phase 2 の B-1 の1回目（`1.146.0-p2-B-1`）は、git のコミットの後の `_aiEdits.*` の誤りで同じく 4 を不合格にし、edits を直した（`records/take-in/1.146.0-p2-B-1-r2/gate-B-1-telemetry.md`）。同じ扱いにした。

## 直す必要があるところ

- **蒙恬（C-1 の edits.patch）**:
  1. `ITerminalChatService` の何もしない実装を登録する（C-1 の `NullChatEntitlementService` と同じ形）。または、ターミナルの2つのファイルから注入を外す。
  2. `searchView.ts` の 695・2002・2008 行を、`searchView` が無くても落ちない形にする（`?.`）。または、検索の設定の型（`ISearchConfigurationProperties`）の `searchView` を省略できる型にして、型検査で見張る（前回の product.json のキーと同じ考え）。
  3. `_chat.editSessions.accept` を、何もしないコマンドとして残すか、git の拡張の2か所の呼び出しを外す。B-1 の `_aiEdits.*` の直し方に合わせるとよい。
- **曹参（C-1 のテスト）**: c1-unit は 53件すべて通る（前回の product.json のキーの読み手の検査が入った）。ただ、消した部品の「サービスの ID の注入」「設定のキーの読み手」「コマンドの呼び手（組み込みの拡張を含む）」が残っていないことを見る検査は無い。前回と同じ種類の網の穴。

## C-1 に関わる、通ったもの

- Claude Code の組: 3回とも `claude.running`・`claude.exthost-log`・`claude.lock` が PASS（2.1.322）。拡張ホストのログに `vscode.lm`・`vscode.chat` の誤りは無い。`Claude VSCode.log` に誤りの行は無い（`MCP Server running on port …` の行など）。
- パネル・差分・コメント・ログインの画面の操作は、手の項目（`manual-checks-p5-c-all-r2.md` の 9〜14、C1）。
- 残っているチャットの名のコマンドは `workbench.action.chat.openImageInCarousel` だけ（C-1 が画像のカルーセルを残すとした入口。README で既知）。

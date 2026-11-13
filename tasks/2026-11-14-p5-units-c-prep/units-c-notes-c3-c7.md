# 段階 C の削除の単位 C-3〜C-7 の下準備: 中身・根拠・未確認の点

- 日付: 2026-11-14。担当: 蒙恬（2人目。C-3〜C-7）。
- 材料: 本家 1.146.0 の作業ツリー `C:\b\wt\1.146.0`（読むだけ）を `grep` で調べた。外部の Web の情報は使っていない。
- 作ったもの: `removals/C-3-remote`・`C-4-notebook`・`C-5-extension-gallery`・`C-6-settings-sync`・`C-7-breadcrumbs-outline` の `unit.json` と `README.md`。`edits.patch` はまだ作らない（brief のとおり）。そのため `unit.json` に `patch` のキーを書いていない（キーがあってファイルが無いと `apply.mjs` が「patch が無い」で止まる。`scripts/apply.mjs` の350〜352行）。`edits.patch` を作るときに `"patch": "edits.patch"` を足す。
- 単位ごとの詳しい中身（消すもの・残すもの・型検査で直す点の表・別案）は各単位の `README.md` にある。ここには要点と、単位をまたぐ判断を書く。

## 1. 単位をまたぐ判断: sessions の入口と `after`

- 別の蒙恬の C-1（`removals/C-1-ai/unit.json`、2026-11-14 時点）は `src/vs/sessions`（Agents の窓。`sessions.common.main.ts`・`sessions.desktop.main.ts`・`sessions.web.main.ts` を含む）を丸ごと消す。
- docs/03 の5.3 は「sessions の main は `removeLines` で直す」と書くが、C-1 の後に当たる C-3〜C-7 が sessions の入口に `removeLines` を書くと、`apply.mjs` が「`removeLines: <file> が無い`」で止まる（`scripts/apply.mjs` の332行）。
- そこで、C-3〜C-7 は sessions の入口の行を書かず、`after` に `C-1-ai` を挙げた。最初は sessions の行を書いて `after` を A・B だけにしていたが、C-1 の中身を読んで改めた（2の試しの記録は両方ある）。
- C-1 を `after` に挙げると、C-1 が無効なら C-3〜C-7 は当てられない（docs/03 の7節）。ただし、sessions の行を書かない以上、C-1 が無いと sessions の入口に参照が残って型検査が通らないので、どちらにしても C-1 が前提になる。単位の `edits.patch` も、前の C の単位を当てた状態の上で作る見込み（docs/03 の4節の「前の単位が関門を通って…後に始める」）。

| 単位 | `after` | 理由 |
|---|---|---|
| C-3-remote | A-5-remote-extensions、C-1-ai | sessions の入口。リモートトンネルを使うチャット・セッション・`platform/agentHost` の部品が C-1 で消える |
| C-4-notebook | A-4-notebook-extensions、B-4-outline-view、C-1-ai、C-2-debug | sessions の入口。チャットのノートブックの部品（約40ファイル）。C-2 が `debug.contribution.ts`（ノートブックの変数のコマンドを import）を消し、`notebook.contribution.ts` の4行を `removeLines` で消す（C-4 より先でなければならない）。B-4 が残した `contrib/outline/browser/outline.ts` を C-4 が消す |
| C-5-extension-gallery | C-1-ai | sessions の入口。チャットのツール `installExtensionsTool.ts`・`searchExtensionsTool.ts` を C-1 が消す |
| C-6-settings-sync | C-1-ai | sessions の入口 |
| C-7-breadcrumbs-outline | B-4-outline-view、C-1-ai、C-4-notebook | sessions の入口。`services/outline` をチャット（C-1）とノートブック（C-4）が使う |

- この判断はリーダーの承認が要る（handoff の「判断を仰ぐ点」1）。

## 2. 単位ごとの要点

### C-3-remote

- 消す: `contrib/remote`（リモートエクスプローラー・ポートのビュー・リモートの状態表示・`remote.*` の設定）、`contrib/remoteTunnel`、`platform/remoteTunnel`、`build/gulpfile.reh.ts`。product.json の server・tunnel のキー9つ。共有プロセスの入口 `sharedProcessMain.ts` のリモートトンネルの7行（どれも1行で完結するので `removeLines`）。
- 残す（docs/03 の表と違う）: `services/tunnel`（`ITunnelService` を Webview＝Claude Code のパネルが注入する）、`platform/remote/electron-browser/sharedProcessTunnelService.ts`（その `TunnelService` が注入する）、`services/remote/common/remoteExplorerService.ts`（ローカルの拡張ホストの部品 `extensionService.ts`・`nativeExtensionService.ts` が注入する）。どれも消すと起動時の注入で失敗する（型検査では見つからない）。
- 型検査で直す点（C-1 の後）: `api/browser/viewsExtensionPoint.ts` の27行だけ（`VIEWLET_ID` を同じ値の定数に替える）。
- 別案: `remoteExplorerService` も消して拡張 API を空にする。`remote/`・`src/vs/server` も消す（ビルドの道具の変更が要る）。

### C-4-notebook

- 消す: `contrib/notebook/browser`・`test`、`contrib/interactive`、`contrib/replNotebook`、`contrib/outline`（B-4 の残り）、`contrib/search/browser/notebookSearch`、拡張 API のノートブックの main thread 8ファイルと拡張ホスト側 9ファイル、テスト。
- 残す（docs/03 の表と違う）: `contrib/notebook/common`。拡張 API の中心（`extHost.protocol.ts`・`extHostTypeConverters.ts`）、一括編集、検索の置換、コメント（Claude Code の受け手）が型を import している。common から browser への import は無い。
- 空の実装: `api/common/extHostRemovedApi.notebook.ts`（新しいファイル）に `vscode.notebooks`・`workspace.notebookDocuments` などを置く見込み（README に項目の一覧）。言語クライアント（basedpyright・PowerShell）と TypeScript の拡張が起動時に購読する見込みなので、誤りを投げずに空を返す。
- 全文検索: docs/03 の表の恐れのとおり、検索の木のモデル（一致したファイルのクラス `NotebookCompatibleFileMatch`）がノートブックの部品と結びついている。`FileMatchImpl` で作る形に直す（README の表、約15ファイル）。
- 型検査に掛からない点: 検索の部品と一括編集が `INotebookService`・`INotebookEditorService`・`INotebookEditorModelResolverService`・`INotebookSearchService` を注入している（5か所）。

### C-5-extension-gallery

- 消す: おすすめの部品11ファイル、`extensionIgnoredRecommendationsService.ts`・`workspaceExtensionsConfig.ts`、ギャラリーのアカウント、tips（ワークベンチ側と共有プロセス側）。共有プロセスの tips の4行（`removeLines`）。
- 差し替え（edits.patch）: ワークベンチのギャラリーのサービスを何もしない実装に。おすすめのサービスの ID は残る画面が注入するので、何もしない実装を登録する（sessions の `NullExtensionRecommendationNotificationService` が前例）。
- 残す（docs/03 の表と違う）: `services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`。共有プロセスの `ExtensionGalleryManifestIPCService` が、ワークベンチから `setExtensionGalleryManifest` が届くまで `Barrier` で待つ（`platform/extensionManagement/common/extensionGalleryManifestServiceIpc.ts` の25・37・50行）。消すと拡張の導入が止まる恐れがある。アカウントの部分だけを外す。
- 画面の削り（edits.patch）: マーケットプレイス・人気・おすすめのビュー、「VSIX からインストール」など6つのコマンド、おすすめの設定2つ。

### C-6-settings-sync

- 消す: `contrib/userDataSync`（同期の画面・コマンド・ビュー）、`services/userDataSync/browser/userDataSyncWorkbenchService.ts`。
- 残す: 同期の状態のサービス（設定の画面・拡張の管理が注入）、`platform/userDataSync`（プロファイル・共有プロセス）、`services/accounts`（docs/03 の表の「依存が無ければ」→ 約60ファイルが使うので残す）。product.json に同期のストアが無いので、本家の同期は元から動かない。
- 試しの `absentStrings` は0件。ただし `IUserDataSyncWorkbenchService` の ID は残るので型検査は通り、**注入している `settingsEditor2.ts`・`relauncher.contribution.ts` が起動時や画面を開くときに失敗する**（型検査に掛からない）。edits.patch でこの2か所を直す。

### C-7-breadcrumbs-outline

- 消す: パンくずの4ファイルと CSS、`services/outline`、`contrib/codeEditor/browser/outline`、テスト3つ。
- 残す: `base/browser/ui/breadcrumbs`（差分エディタの変更の無い部分の表示が使う。差分エディタは Claude Code の受け手）、`editor/contrib/documentSymbols`（記号へ移動とスティッキースクロール）。
- 共有部品（エディタの枠）へのパッチ: `editorHeaderControl.ts`・`singleEditorTabsControl.ts`。ほかに `gotoSymbolQuickAccess.ts`（テキスト以外のエディタの記号の一覧）と `mainThreadCustomEditors.ts`。
- 記号へ移動（Ctrl+Shift+O）はテキストエディタでは `IOutlineService` を使わない（`gotoSymbolQuickAccess.ts` の85〜96行・185〜195行）ので残る。B-4 の `kept` の理由「クイックオープンの記号の一覧が使う」は、テキスト以外のエディタのときだけ当たる。

## 3. Claude Code が使う受け手（docs/03 の9節）との関係

- Webview: C-3 で `ITunnelService`（Webview が注入）を残した。
- 差分エディタ: C-7 で差分エディタのパンくず（`editor/contrib/diffEditorBreadcrumbs`）と `base/browser/ui/breadcrumbs` を残した。
- コメント: C-4 で、コメントが型を使う `contrib/notebook/common/notebookRange.ts` を残した。
- 拡張のファイルシステムの提供者・メニューの場所・セカンダリサイドバー・JSON の検査・ワークスペースの信頼: C-3〜C-7 のどれも触らない。
- 消すか迷って残したもの: C-3 の `remoteExplorerService` 一式、`remote/`・`src/vs/server`、C-5 の `extensionGalleryManifestService.ts`、C-6 の同期の状態のサービス・`services/accounts`。各 README の「別案」に書いた。

## 4. 未確認の点

- 型検査が通るか（どの単位も）。README の表は `grep` での見込み。
- 起動時の注入の失敗（型検査に掛からない）。C-4・C-5・C-6 で README に挙げた所のほかに無いか。
- C-4 の空の実装で、同梱の拡張（TypeScript・basedpyright・PowerShell・Markdown）が誤りを出さないか（スモーク）。
- C-5 で `extensionGalleryManifestService.ts` を直したあと、共有プロセスでの VSIX の導入と CLI の `--install-extension` が止まらないか。
- C-7 でエディタの枠の高さの計算が崩れないか（スモーク）。docs/03 の表の「関門を2回続けて通らなければユーザーに諮る」。
- lint の一覧（`eslint.config.js`・`.eslint-allowed-bracket-notation-files`）に消したファイルの名前が残る。関門は型検査とビルドなので直していない（A・B の単位と同じ扱い）。

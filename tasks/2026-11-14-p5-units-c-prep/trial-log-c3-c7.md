# 試しの記録（C-3〜C-7。作業ツリー C:\b\wt\dev-c3）

- 日付: 2026-11-14。担当: 蒙恬（2人目）。
- 作業ツリー: `git -C C:/b/vscode worktree add C:/b/wt/dev-c3 1.146.0` で作った（基のコミット `69047191fc427f2f92828279aae1d90d8eeda7ab`）。回ごとに `git -C C:/b/wt/dev-c3 checkout <コミット>` で戻してから当てた。
- `C:\b\wt\1.146.0` は書き換えていない（最後に `git -C C:/b/wt/1.146.0 status --short` が空であることを確かめた）。`C:\b\wt\verify-p2` には触れていない。
- 依存の導入・型検査・ビルドは走らせていない。
- 記録のファイルは `tasks/2026-11-14-p5-units-c-prep/trial-c3c7/` にある。

## 1. 回ごとの結果

`--only` の A・B は `A-1-copilot-extension,…,A-7-unused-extensions,B-1-telemetry,…,B-7-terminal-suggest` の14単位（以下「A＋B」）。

| 回 | 基 | 当てた単位 | 単位の版 | 結果 | 記録 |
|---|---|---|---|---|---|
| a | 1.146.0 | A＋B＋C-3〜C-7 | 初めの版（sessions の入口の `removeLines` あり、`after` は A・B だけ） | ops はすべて当たった。`absentStrings` だけ fail（C の単位の参照の残り。edits.patch が無いので想定どおり）。A・B の `absentStrings` は全件0。`registeredKeys` ok（`breadcrumbs.enabled` は C-7 の `absentSettings` で mydist から外れた） | `checks-all.json`（g で上書き。中身は同じ） |
| b | 1.146.0 | A＋B＋C-3 | 初めの版 | ops ok。`absentStrings` の残り 21 | `checks-c3.json` |
| c | 1.146.0 | A＋B＋C-4 | 初めの版 | ops ok。残り 46 | `checks-c4.json` |
| d | 1.146.0 | A＋B＋C-5 | 初めの版 | ops ok。残り 7 | `checks-c5.json` |
| e | 1.146.0 | A＋B＋C-6 | 初めの版 | **ok**（残り 0） | `checks-c6.json` |
| f | 1.146.0 | A＋B＋C-7 | 初めの版 | ops ok。残り 19（ノートブックの分を含む） | `checks-c7.json` |
| g | 1.146.0 | A＋B＋C-3〜C-7 | 初めの版 | a と同じ（作業ツリーを合わせた状態に戻すため） | `checks-all.json` |
| h | 1.146.0 | A＋B＋C-1〜C-7（本物の C-1・C-2） | 今の版 | **止まった**: `C-1-ai: patch が無い: removals\C-1-ai\edits.patch`。C-1 の `unit.json` に `"patch": "edits.patch"` があり、ファイルがまだ無い（別の蒙恬が作業中）。止まる前に C-1 の ops は当たり、コミット `fe72655ab0a` になった | `checks-c1-c7.json` |
| i | `fe72655ab0a`（A＋B＋C-1 の ops） | C-3〜C-7（今の版の写し）。`after` を満たすための代役（ops の無い A-4・A-5・B-4・C-1・C-2） | 今の版 | ops はすべて当たった。`absentStrings` の残りは下の表。`registeredKeys` は fail だが、代役のため（下の注） | `checks-final-on-c1ops.json` |

- どの回も、C の単位の `removeLines` はすべて `found: 1`、`missingDeletes`・`productMissing` は空、単位の `warnings` は空だった。
- i の注: `--removals tasks/2026-11-14-p5-units-c-prep/trial-c3c7/removals-final`（C-3〜C-7 は `removals/` と ops・`kept` の path・`checks` が同じ写し。`intent` と `kept` の理由だけ短くした）、`--patches tasks/2026-11-14-p5-units-c-prep/trial-c3c7/patches-none`（基のコミットは patches/20・30 の前なので、二重に当てないよう空にした）。`registeredKeys` の fail は、mydist の `chat.disableAIFeatures`（C-1）・`workbench.startupEditor`（B-2）・`terminal.integrated.suggest.enabled`（B-7）が登録されていないため。代役の単位が `absentSettings` を持たないので mydist から外れなかっただけで、C-3〜C-7 の誤りではない。C-3〜C-7 が消した設定のうち mydist にあるのは `breadcrumbs.enabled` だけで、i でも外れた。
- 作業ツリー `C:\b\wt\dev-c3` は i の後の状態（HEAD `526d25d777f5a7c2abe71513cf9f6c870121cbe2`）で残した。

## 2. `absentStrings` の残り（今の版、i の回。C-1 の ops の後）

| 単位 | 残り | 中身 |
|---|---|---|
| C-3-remote | 1 | `api/browser/viewsExtensionPoint.ts` の27行（`remoteExplorer.js` の `VIEWLET_ID`） |
| C-4-notebook | 30 | `notebookBrowser.js` 3（検索のテスト2、`bulkCellEdits.ts`）、`notebookEditorWidget.js` 4（検索の木のモデル3、`AISearch/aiSearchModel.ts`）、`notebookEditorService.js` 6（検索のテスト5、`searchResult.ts`）、`interactiveEditorInput.js` 1（`mainThreadEditorTabs.ts`）、`notebookSearchModelBase.js` 9、`notebookSearchModel.js` 6（検索とそのテスト、`searchEditorSerialization.ts`）、`./extHostNotebook.js` 1（`extHost.api.impl.ts`） |
| C-5-extension-gallery | 7 | `extensions.contribution.ts`（おすすめ・通知・ワークスペースの設定・アカウントの import）、`extensionsActions.ts`（`workspaceExtensionsConfig.js`）、`extensionGalleryManifestService.test.ts`（アカウント2） |
| C-6-settings-sync | 0 | — |
| C-7-breadcrumbs-outline | 8 | `breadcrumbsControl.js` 2（`editorHeaderControl.ts`・`singleEditorTabsControl.ts`）、`breadcrumbs.js` 1（`tabs.fixture.ts`）、`services/outline/browser/outline.js` 5（`gotoSymbolQuickAccess.ts`・`mainThreadCustomEditors.ts` とテスト3） |

- `kept` に挙げたファイルは `absentStrings` の数に入らない（`scripts/lib/apply/checks.mjs` の60・72行）。C-5 で残す `extensionGalleryManifestService.ts` の27行（アカウントの import）は数に入らないが、型検査では誤りになる（README の表に挙げた）。
- 初めの版（A＋B だけの上）では、C-3 は21（チャット・セッション・`platform/agentHost`・sessions の20件を含む）、C-4 は46、C-7 は 13（C-4 と一緒）・19（単独）だった。差は C-1 が消すフォルダの中の参照。

## 3. 当てる前の確かめ

- `removeLines` の各行が 1.146.0 の対象のファイルにちょうど1行あること: 上の a〜i の `found: 1` で確かめた。
- `delete` のパスが 1.146.0 にあること: `missingDeletes` が空。
- 消すフォルダを import している残りを `grep` で探した（`^import .*<消すパス>` の形）。結果は各 README の「型検査で直す点」と、2の表。

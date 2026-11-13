# C-2-debug デバッガ

裁定: デバッガは消す（「削る候補」の選択と、段階 C の「AI → デバッガ → リモート → ノートブック」の順）。拡張 API の `vscode.debug` は何もしない実装にして残す。

状態: **下準備**（2026-11-14）。`unit.json` の ops だけを作った。`edits.patch` は型検査が走るようになってから作る。それまで `unit.json` に `patch` のキーを書かない（docs/03 の3.1「無ければ書かない」。C-3〜C-7 と同じ形）。`edits.patch` を作ったときに `"patch": "edits.patch"` を足す。

`after` は `A-3-debug-extensions` だけにした。C-2 は Agents の窓（`src/vs/sessions`）の入口に触れず、C-1 が無くても当たる（`tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md` の回 c）ため。

## 消すもの

- `src/vs/workbench/contrib/debug/browser` のうち、下の「残すもの」の6ファイルを除く44ファイルと、`media` のうち残す2つの CSS を除く15ファイル: 実行とデバッグのビュー、ブレークポイント（エディタの余白・ビュー・ウィジェット）、デバッグコンソール（REPL）、デバッグのツールバー・ステータスバー、ホバー、逆アセンブリ、変数・ウォッチ・呼び出し履歴・読み込んだスクリプトのビュー、アダプターの管理、`launch.json` の構成の管理、デバッグのタスクの実行、設定 `debug.*` の登録（`debug.contribution.ts`）
- `contrib/debug/node`（アダプターの起動・ターミナルでの起動・テレメトリの別プロセス `telemetryApp`）、`contrib/debug/test`
- ノートブックのデバッグの部品: `contrib/notebook/browser/contrib/debug`（セルのブレークポイント・一時停止・飾り）、`contrib/notebook/browser/contrib/notebookVariables`（実行とデバッグのビューの中の変数のビュー）と、そのテスト1つ。ノートブック（C-4）より先に消えるデバッグ側の部品が import しているので、C-2 で消す
- 拡張 API の実装: `api/browser/mainThreadDebugService.ts`、`api/common/extHostDebugService.ts`、`api/node/extHostDebugService.ts` と、そのテスト4つ
- 一覧の行（`removeLines`）: `workbench.common.main.ts` の6行（docs/03 の表のとおり）、`api/browser/extensionHost.contribution.ts` の1行、`extHost.common.services.ts` の2行、`extHost.node.services.ts` の3行、`notebook.contribution.ts` の4行、`build/next/index.ts` の `telemetryApp` の入口1行

## 残すもの

- `contrib/debug/common`（まるごと）: サービスの ID `IDebugService`、モデルの型、コンテキストキー（`CONTEXT_IN_DEBUG_MODE` など）、`REPL_VIEW_ID`・`VIEWLET_ID`、本家が Agents の窓のために持つ `NullDebugService`・`NullDebugVisualizerService`（`common/nullDebugService.ts`）。残る部品（テスト、アクセシビリティの合図、クイックアクセス、拡張の画面、リモート、ノートブック）と拡張 API の `extHost.protocol.ts`・`extHostTypeConverters.ts`・`viewsExtensionPoint.ts` が使う。`debug.ts` が `debugModel`・`debugSource`・`debugUtils`・`debugCompoundRoot` などを import するので、common は分けずに残す。
- `browser/debug.service.contribution.ts`: `IDebugService`・`IDebugVisualizerService` を登録する2行だけのファイル。`edits.patch` で2行を Null の実装に替える（未決の1）。
- `browser/extensionHostDebugService.ts`・`electron-browser/extensionHostDebugService.ts`: `IExtensionHostDebugService`（拡張機能の開発用のホストのデバッグ）の画面側の実装。拡張機能のホストの起動（`services/extensions/electron-browser/localProcessExtensionHost.ts` 135行、`common/remoteExtensionHost.ts` 76行）が注入するので、消すとすべての拡張が起動しない。**docs/03 の表の「desktop の1行」はこのファイルの import なので消さない**（`workbench.web.main.ts` の1行も同じ）。
- `browser/callStackWidget.ts`・`callStackEditorContribution.ts`・`debugIcons.ts`・`debugColors.ts` と CSS 2つ: テスト（`contrib/testing`。裁定で残す）の結果のビューが、失敗したテストの呼び出し履歴の表示に使う（`testResultsViewContent.ts` 31行・`testResultsOutput.ts` 35行）。`debugColors.ts` はワークスペースの信頼の画面（`workspaceTrustEditor.ts` 44行。Claude Code の受け手）とノートブックの画面が色を使う。
- `src/vs/platform/debug`: 拡張機能の開発用のホストのデバッグの IPC。main・共有プロセス・サーバーが使う。

## 型検査で直す点（edits.patch で直す見込み）

`grep` で import の文を探した結果（作業ツリー `C:\b\wt\dev-c1`、A＋B＋C-2 の ops を当てた状態）。

| ファイル | 行 | 直し方 |
|---|---|---|
| `api/common/extHost.api.impl.ts` | 26（`DebugConfigurationProviderTriggerKind`。残る common なので直さない）、55（`IExtHostDebugService` の import）、215（作る所）、1556〜1620（`debug` の名前空間） | 新しいファイル `api/common/extHostRemovedApi.debug.ts` に `typeof vscode.debug` の形の何もしない実装を置く（`activeDebugSession`・`activeDebugConsole`・`activeStackItem` は undefined、`breakpoints` は空、イベントは `Event.None`、`register*` は何もしない Disposable、`startDebugging` は false、`addBreakpoints`・`removeBreakpoints` は何もしない、`asDebugSourceUri` は与えた source の path から作った URI）。impl の変更は `const debug = ...` の右辺と、55・215行を消すことだけ |
| `contrib/debug/browser/debug.service.contribution.ts` | 11〜12 | `DebugService`・`DebugVisualizerService` を `NullDebugService`・`NullDebugVisualizerService` に替える |
| `workbench.common.main.ts` | Debug の節（`removeLines` で6行が消えた後） | `import './contrib/debug/browser/debug.service.contribution.js';` の1行を足す（未決の1） |
| `contrib/replNotebook/browser/repl.contribution.ts` | 38（`getReplView`） | REPL のビューを探す処理を消す（C-4 で消える部品だが C-2 が先） |
| `contrib/notebook/browser/notebook.contribution.ts` | 122（`NotebookVariables`）と登録の所、1271 付近の設定 `notebook.variablesView` | 変数のビューの登録と設定を消す |
| `contrib/notebook/browser/controller/variablesActions.ts` | 12 | 変数のビューの操作を消す |
| `contrib/notebook/browser/controller/editActions.ts` | 43（`NotebookInlineVariablesController`） | インラインの変数の表示を消す |

C-1 を当てた後に当てても同じ（`tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md` の回 e）。ほかに、`contrib/debug/browser/debugChatIntegration.ts` は C-1 も消す（チャットの統合）。両方を当てると C-2 の `delete` で「本家に無い」の警告が1件出るが、意図どおり。

## 影響しうるもの

- PowerShell 拡張など、`contributes.debuggers`・`breakpoints` を持つ拡張: 受け手の登録（`debugSchemas.ts` の拡張点）が読まれなくなるので、拡張ホストのログに「知らない contributes」の警告が出る見込み（推定）。拡張の起動時の `vscode.debug.register*` は何もしない実装が受ける。
- テスト: 「テストをデバッグ」の操作は残るが、`NullDebugService` が何もしないので始まらない（普通の実行は残る）。
- タスク: `preLaunchTask` などデバッグからのタスクの起動は無くなる。タスクそのものは残る。
- エディタの余白のブレークポイント、F5・F9 などのキー（`mydist` のキー割り当ての変換は C-2 のコマンドを落とす。`tasks/2026-11-13-p0-envs-mydist-keys/sublime-keys.md`）。
- 拡張の画面の「拡張機能のホストをデバッグ」（`extensions/electron-browser/debugExtensionHostAction.ts`）は `IDebugService` を呼ぶので何も起きない。

## 壊れたときの症状と戻し方

- 起動時に `depends on UNKNOWN service debugService` が出たら、`debug.service.contribution.ts` の登録が読まれていない。`enabled: false` に戻してビルドし直す。
- 拡張が1つも起動しない（`extensionHostDebugService` が見つからない）なら、残すべき `extensionHostDebugService.ts` の import が消えている。`removeLines` を見直す。

## 未決（リーダーの判断を仰ぐ）

1. **決まった（2026-11-14 リーダーの判断。案A）**。`IDebugService` の登録の置き場所。docs/03 の5.3 は main のファイルを `removeLines` だけで直すと決めているが、登録を読む行がどこにも無くなるため、main に1行足す必要がある。案A（推す）: `debug.service.contribution.ts` の2行を替え、`workbench.common.main.ts` の Debug の節に読む1行を足す（前後の行は C-2 だけが触る）。案B: `nullDebugService.ts` の末尾に `registerSingleton` を足し、`debug.ts` から読む（循環 import になり、読み込みの順で壊れる恐れがある）。案C: テスト（`testing.contribution.ts`）など残る部品から読む（無関係の部品に依存する）。
2. `contrib/debug/common` のうち使われなくなるファイル（`debugSchemas.ts`・`debugger.ts`・`debugTelemetry.ts`・`debugLifecycle.ts` など）を消すか。消すとパッチは増えないが、`debug.ts` の芋づるを型検査で確かめる必要がある。今は残す。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。とくに `NullDebugService` が本家の `IDebugService` の今の形を満たすか（本家は Agents の窓で使っているので満たす見込み）。
- `build/next/index.ts` から `telemetryApp` の入口を消した後のビルド。`build/next/resources.ts` 76行の `debug/browser/media/*.png` に一致するファイルが無くなっても止まらないか。
- PowerShell 拡張の起動（スモークの `powershell` の組）。

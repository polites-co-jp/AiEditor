# C-2-debug デバッガ

裁定: デバッガは消す（「削る候補」の選択と、段階 C の「AI → デバッガ → リモート → ノートブック」の順）。拡張 API の `vscode.debug` は何もしない実装にして残す。

状態: **edits.patch あり、関門の前**（2026-11-15）。`unit.json` の `enabled` は `false` のまま。ビルド・起動の確かめ・関門は、片づけの許可が入ってから行う。作った記録は `tasks/2026-11-15-p5-c2-patch/`。

`after` は `A-3-debug-extensions` だけにした。C-2 は Agents の窓（`src/vs/sessions`）の入口に触れず、C-1 が無くても当たる（`tasks/2026-11-14-p5-units-c-prep/trial-log-c1-c2.md` の回 c）ため。edits.patch も、C-1 の有無のどちらでも当たる（下の「C-1 と独立に保つ形」）。

## 消すもの

- `src/vs/workbench/contrib/debug/browser` のうち、下の「残すもの」の6ファイルを除く44ファイルと、`media` のうち残す2つの CSS を除く15ファイル: 実行とデバッグのビュー、ブレークポイント（エディタの余白・ビュー・ウィジェット）、デバッグコンソール（REPL）、デバッグのツールバー・ステータスバー、ホバー、逆アセンブリ、変数・ウォッチ・呼び出し履歴・読み込んだスクリプトのビュー、アダプターの管理、`launch.json` の構成の管理、デバッグのタスクの実行、設定 `debug.*` の登録（`debug.contribution.ts`）
- `contrib/debug/node`（アダプターの起動・ターミナルでの起動・テレメトリの別プロセス `telemetryApp`）、`contrib/debug/test`
- ノートブックのデバッグの部品: `contrib/notebook/browser/contrib/debug`（セルのブレークポイント・一時停止・飾り）、`contrib/notebook/browser/contrib/notebookVariables`（実行とデバッグのビューの中の変数のビューと、セルの実行後のインラインの値）と、そのテスト1つ。ノートブック（C-4）より先に消えるデバッグ側の部品が import しているので、C-2 で消す
- 変数のビューを開く操作 `contrib/notebook/browser/controller/variablesActions.ts`（2026-11-15 に足した。ファイルの中身は消したビューを開く操作1つだけ）
- 拡張 API の実装: `api/browser/mainThreadDebugService.ts`、`api/common/extHostDebugService.ts`、`api/node/extHostDebugService.ts` と、そのテスト4つ。`extHost.protocol.ts` の、消した API の Shape・DTO・ID（2026-11-14 の判断「消した API の Shape と ID を消す」）
- 設定 `notebook.variablesView`・`notebook.inlineValues` の登録（読むのは消した `notebookVariables` だけ）と、デバッグコンソールの検索のキー割り当て `list.find.replInputFocus`（`replNotebook/browser/repl.contribution.ts`。消した REPL のビューにだけ効く）
- 一覧の行（`removeLines`）: `workbench.common.main.ts` の6行（docs/03 の表のとおり）、`api/browser/extensionHost.contribution.ts` の1行、`extHost.common.services.ts` の2行、`extHost.node.services.ts` の3行、`notebook.contribution.ts` の7行、`editActions.ts` の1行、`repl.contribution.ts` の2行、`extHost.protocol.ts` の3行、`build/next/index.ts` の `telemetryApp` の入口1行、`build/next/resources.ts` の `debug/browser/media/*.png` の1行

## 残すもの

- `contrib/debug/common`（まるごと）: サービスの ID `IDebugService`、モデルの型、コンテキストキー（`CONTEXT_IN_DEBUG_MODE` など）、`REPL_VIEW_ID`・`VIEWLET_ID`、本家が Agents の窓のために持つ `NullDebugService`・`NullDebugVisualizerService`（`common/nullDebugService.ts`）。残る部品（テスト、アクセシビリティの合図、クイックアクセス、拡張の画面、リモート、ノートブック）と拡張 API の `extHost.api.impl.ts`（`DebugConfigurationProviderTriggerKind`）・`extHostTypeConverters.ts`・`viewsExtensionPoint.ts` が使う。`debug.ts` が `debugModel`・`debugSource`・`debugUtils`・`debugCompoundRoot` などを import するので、common は分けずに残す。`extHost.protocol.ts` は edits.patch の後は common を使わない。
- `browser/debug.service.contribution.ts`: `IDebugService`・`IDebugVisualizerService` を登録する2行だけのファイル。`edits.patch` で2行を Null の実装に替えた（未決の1。案A）。
- `browser/extensionHostDebugService.ts`・`electron-browser/extensionHostDebugService.ts`: `IExtensionHostDebugService`（拡張機能の開発用のホストのデバッグ）の画面側の実装。拡張機能のホストの起動（`services/extensions/electron-browser/localProcessExtensionHost.ts` 135行、`common/remoteExtensionHost.ts` 76行）が注入するので、消すとすべての拡張が起動しない。**docs/03 の表の「desktop の1行」はこのファイルの import なので消さない**（`workbench.web.main.ts` の1行も同じ）。
- `browser/callStackWidget.ts`・`callStackEditorContribution.ts`・`debugIcons.ts`・`debugColors.ts` と CSS 2つ: テスト（`contrib/testing`。裁定で残す）の結果のビューが、失敗したテストの呼び出し履歴の表示に使う（`testResultsViewContent.ts` 31行・`testResultsOutput.ts` 35行）。`debugColors.ts` はワークスペースの信頼の画面（`workspaceTrustEditor.ts` 44行。Claude Code の受け手）とノートブックの画面が色を使う。`callStackEditorContribution.ts` は、`workbench.common.main.ts` の import が消えた後も `callStackWidget.ts` から読まれる（エディタの部品としての登録は、消した `debug.contribution.ts` が持っていたので、無くなる）。
- `src/vs/platform/debug`: 拡張機能の開発用のホストのデバッグの IPC。main・共有プロセス・サーバーが使う。
- **消すか迷って残した**（2026-11-15）: `platform/telemetry/node/customEndpointTelemetryService.ts`（`ICustomEndpointTelemetryService`）。デバッグのアダプターの拡張が持つテレメトリの鍵（`aiKey`）へ送るためのサービスで、画面側で呼んでいたのは消した `browser/debugSession.ts` だけ（1.146.0 で確かめた）なので、呼ばれなくなる。消した `contrib/debug/node/telemetryApp` を別プロセスで起こす作りなので、呼ばれれば起動に失敗する。消すには共有プロセス（`sharedProcessMain.ts` の登録とチャネル。C-1 も同じファイルを直す）と `workbench.web.main.ts`（main のファイル。docs/03 の5.3 で removeLines だけ）に触れることになり、テレメトリの部品でもあるので、B-1 か別の単位で扱うかをリーダーに諮る。

## edits.patch で直した点（2026-11-15）

edits.patch は8ファイル（新規1）、121行の追加、261行の削除。件名は `unit C-2-debug: edits`、作者は `sukuna-apply`。直したのは消した部品への参照だけ。

| ファイル | 直し方 |
|---|---|
| `api/common/extHostRemovedApi.debug.ts`（新規） | `typeof vscode.debug` の形の何もしない実装 `createRemovedDebugApi(extension)`。下の「Claude Code と台帳の拡張への影響」の表 |
| `api/common/extHost.api.impl.ts` | `IExtHostDebugService` の import を新しいファイルの import に替えた（同じ行の位置）。`ExtHostDebugService` を作る1行を消した。`const debug` の右辺を `createRemovedDebugApi(extension)` にした。ほかの行は変えていない（docs/03 の5.3） |
| `api/common/extHost.protocol.ts` | `MainThreadDebugServiceShape` と、その DTO（`DebugSessionUUID`・`IDebugConfiguration`・`IStartDebuggingOptions`）、`ExtHostDebugServiceShape` と、その DTO（ブレークポイント・セッション・焦点の DTO）を消した。common の import の1行と、`MainContext`・`ExtHostContext` の ID の2行は `removeLines`。ID を残すと `rpcProtocol.assertRegistered`（拡張ホストの側は `extHost.api.impl.ts`、画面の側は `extensionHostManager.ts` 315行）で落ちる |
| `contrib/debug/browser/debug.service.contribution.ts` | `DebugService`・`DebugVisualizerService` を `NullDebugService`・`NullDebugVisualizerService` に替えた（未決の1） |
| `workbench.common.main.ts` | Debug の節（6行が消えた後の空の節）に `import './contrib/debug/browser/debug.service.contribution.js';` の1行を足した（未決の1。前後の行は C-2 だけが触る） |
| `contrib/notebook/browser/notebook.contribution.ts` | 設定 `notebook.variablesView`・`notebook.inlineValues` の登録を消した。変数のビューの登録が消えて使われなくなった `workbenchContributionsRegistry`・`LifecyclePhase`・`WorkbenchExtensions`・`IWorkbenchContributionsRegistry` を外した。import と登録の行は `removeLines` |
| `contrib/notebook/browser/controller/editActions.ts` | 「すべての出力をクリア」の、インラインの値の飾りを消す2行を消した（消した `notebookInlineVariables` の部品を呼んでいた）。import の行は `removeLines` |
| `contrib/replNotebook/browser/repl.contribution.ts` | デバッグコンソールの検索のキー割り当て（`list.find.replInputFocus`）を消した。使われなくなった `KeybindingsRegistry`・`IViewsService` を外した。`repl.js`・`REPL_VIEW_ID` の import の2行は `removeLines` |

`unit.json` で足したもの（2026-11-15）:

- `delete`: `contrib/notebook/browser/controller/variablesActions.ts`
- `removeLines`: 10行（`notebook.contribution.ts` 3行、`editActions.ts` 1行、`repl.contribution.ts` 2行、`extHost.protocol.ts` 3行、`build/next/resources.ts` 1行）
- `kept`: `customEndpointTelemetryService.ts`（上の「消すか迷って残した」）。common の理由を今の使い手に直した
- `checks.absentSettings`: `notebook.variablesView`・`notebook.inlineValues`
- `checks.absentStrings`: `debug/browser/debugService.js'`・`debug/browser/linkDetector.js'` を `/debugService.js'`・`/linkDetector.js'` に替えた（本家 1.146.0 は相対の `./`・`../../browser/` で import するので、前の形は本家に無く、消し損ねても当たらなかった。2回目の直し）。足したもの: `build/next/resources.ts` の `debug/browser/media/*.png`、`contrib/notebook` の `contrib/notebookVariables/`、`extHost.protocol.ts` の `MainThreadDebugServiceShape`・`ExtHostDebugServiceShape`

### C-1 と独立に保つ形

C-1 の edits.patch は、C-2 が触る `extHost.protocol.ts`（74行の前後の import）と `repl.contribution.ts`（40行の `InlineChatController`）で、C-2 が消す行のすぐ隣の行を消す。隣り合う行を両方のパッチで変えると、文脈が合わないので普通の当て方は通らず、`git am -3` の3-way も衝突になる見込み（git の3-way は、間に変わらない行の無い2つの変更を衝突と見る。この組で試してはいない）。そこで、隣り合う行は C-2 の側を `removeLines`（文脈を使わない行の一致）に回した。

- `extHost.protocol.ts` の `contrib/debug/common` の import の行
- `repl.contribution.ts` の `getReplView`・`REPL_VIEW_ID` の import の2行

こうすると、edits.patch のどのハンクも、文脈の行が C-1 の変える行と重ならない。C-1 を当てた後の C-2 の ops の commit で `git apply --check` を走らせると、3-way を使わずに全部のハンクが当たった（`tasks/2026-11-15-p5-c2-patch/typecheck-log.md`）。3-way に頼らないので、C-1 の無い木の blob が常設の clone に無くても当たる。

## Claude Code と台帳の拡張への影響

`vscode.debug` の振る舞い（`extHostRemovedApi.debug.ts`）:

| API | 振る舞い |
|---|---|
| `activeDebugSession`・`activeStackItem` | `undefined` |
| `activeDebugConsole` | 何もしないコンソール（`append`・`appendLine` は何もしない）。型が `DebugConsole`（undefined を許さない）で、拡張がそのまま `appendLine` を呼ぶと undefined では誤りになるため |
| `breakpoints` | `[]` |
| `onDidStartDebugSession` など6つのイベント | `Event.None`（発火しない） |
| `registerDebugConfigurationProvider`・`registerDebugAdapterDescriptorFactory`・`registerDebugAdapterTrackerFactory` | 何もしない Disposable |
| `registerDebugVisualizationProvider`・`registerDebugVisualizationTreeProvider`（提案中の API `debugVisualization`） | 提案の門（`checkProposedApiEnabled`）は元どおり。通れば何もしない Disposable |
| `startDebugging` | `false` で resolve |
| `stopDebugging` | resolve |
| `addBreakpoints`・`removeBreakpoints` | 何もしない |
| `asDebugSourceUri` | 本家と同じ計算（`sourceReference` があれば `debug:` の URI、無ければ `path` のファイルの URI、どちらも無ければ本家と同じ誤り）。セッションが無くても計算できるので写した |

- `DebugAdapterExecutable` などの型（`extHostTypes`）と `DebugConfigurationProviderTriggerKind` は残る。拡張が `new vscode.DebugAdapterNamedPipeServer(...)` などを作っても誤りにならない。
- Claude Code（2.1.322）: manifest に `debuggers`・`breakpoints`・`enabledApiProposals` は無い（`C:\b\cache\vsix` の package.json で確かめた。`records/phase0/claude-code-manifest.md` の35行も同じ）。コードの中で `vscode.debug` を呼んでいても、上の表のとおり誤りを投げない。受け手（Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼、コメント、差分エディタ、拡張のファイルシステム）には触れていない。ワークスペースの信頼の画面が使う `debugColors.ts` は残した。
- PowerShell 拡張（`ms-vscode.powershell` 2025.4.0）: 台帳の拡張で、`contributes.debuggers`（type `PowerShell`）・`breakpoints`（`powershell`）と、起動の条件 `onDebugResolve:PowerShell` を持つ唯一のもの（`C:\b\cache\vsix` の8つの package.json で確かめた）。
  - 受け手の拡張点（`common/debugSchemas.ts` の `debuggers`・`breakpoints`）は、読んでいた `debugAdapterManager.ts` などが消えて登録されなくなる。拡張ホストのログに警告が出るかは未確認（関門の `powershell` の組で見る）。
  - `onDebugResolve:PowerShell` は発火しない。拡張は `onLanguage:powershell` などほかの条件で起動する。
  - 拡張の起動時の `vscode.debug.register*`・イベントの購読は、何もしない実装が受ける。言語サーバー（補完・診断・書式）は `vscode.debug` を使わないので残る見込み（推定）。
  - 「実行」「デバッグ」（F5・F8 など拡張のコマンド）は、`startDebugging` が `false` を返すので何も始まらない。
- ほかの台帳の拡張（basedpyright・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パック）は、manifest にデバッグの contributes を持たない。

## 影響しうるもの

- テスト: 「テストをデバッグ」の操作は残るが、`NullDebugService` が何もしないので始まらない（普通の実行は残る）。
- タスク: `preLaunchTask` などデバッグからのタスクの起動は無くなる。タスクそのものは残る。
- エディタの余白のブレークポイント、F5・F9 などのキー（`mydist` のキー割り当ての変換は C-2 のコマンドを落とす。`tasks/2026-11-13-p0-envs-mydist-keys/sublime-keys.md`）。
- 拡張の画面の「拡張機能のホストをデバッグ」（`extensions/electron-browser/debugExtensionHostAction.ts`）は `IDebugService` を呼ぶので何も起きない。
- ノートブック: 「すべての出力をクリア」は出力と実行の記録だけを消す（インラインの値は C-2 で無くなった）。変数のビューとインラインの値の設定は無くなる。

## 壊れたときの症状と戻し方

- 起動時に `depends on UNKNOWN service debugService` が出たら、`debug.service.contribution.ts` の登録が読まれていない（`workbench.common.main.ts` の Debug の節の1行を見る）。`enabled: false` に戻してビルドし直す。
- 拡張が1つも起動しない（`extensionHostDebugService` が見つからない）なら、残すべき `extensionHostDebugService.ts` の import が消えている。`removeLines` を見直す。
- 拡張ホストの起動で `Missing proxy instance ExtHostDebugService` などの誤りが出たら、`extHost.protocol.ts` の ID の行が残っている。`removeLines` の2行が当たっているかを見る。

## 未決（リーダーの判断を仰ぐ）

1. **決まった（2026-11-14 リーダーの判断。案A）**。`IDebugService` の登録の置き場所。`debug.service.contribution.ts` の2行を替え、`workbench.common.main.ts` の Debug の節に読む1行を足した（2026-11-15 の edits.patch）。
2. `contrib/debug/common` のうち使われなくなるファイル（`debugSchemas.ts`・`debugger.ts`・`debugTelemetry.ts`・`debugLifecycle.ts` など）を消すか。消すとパッチは増えないが、`debug.ts` の芋づるを型検査で確かめる必要がある。**今は残す**（2026-11-15 の依頼）。
3. `customEndpointTelemetryService.ts` を消すか（上の「消すか迷って残した」）。

## 未確認（ビルドと関門で確かめる）

- 型検査は通った（A・B の14単位と C-2、A・B の14単位と C-1 と C-2 の両方で誤り 0。2026-11-15）。起動時の注入（DI）は型検査では見えないので、起動の確かめで見る。
- `build/next/index.ts` から `telemetryApp` の入口を消した後のビルド。`build/next/resources.ts` の `debug/browser/media/*.png` の行は消した（一致するファイルが無くなるため）。build/ の型検査（`build/tsconfig.json`）の誤りは、A-3 の `builtInExtensions: []` から来る1件だけで、C-2 による誤りは無い。
- PowerShell 拡張の起動（スモークの `powershell` の組）と、拡張ホストのログの「知らない contributes」の警告の有無。
- `vscode.debug` の何もしない実装と、直したノートブックの部品のテストは、`tests/c2-*.test.mjs` に書いた。VS Code のテストの仕組みで走らせる形は未実行（台本の4）。

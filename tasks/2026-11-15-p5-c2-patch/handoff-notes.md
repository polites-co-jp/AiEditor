# Phase 5 の下ごしらえ（C-2 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**（パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない）。

## 成果物

- `removals/C-2-debug/edits.patch`（新規）
  - 8ファイル（新規1）、121行の追加、261行の削除
  - 件名は `unit C-2-debug: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `c448c247`
- `removals/C-2-debug/unit.json`（直した）。`enabled` は `false` のまま
  - `"patch": "edits.patch"` を足した
  - `delete` に1つ、`removeLines` に10行を足した
  - `kept` に1つ足し、common の理由を直した
  - `checks.absentSettings` に2つ、`checks.absentStrings` に4つ足した
- `removals/C-2-debug/README.md`（書き直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「edits.patch で直した点（2026-11-15）」「C-1 と独立に保つ形」「Claude Code と台帳の拡張への影響」
  - 直した節: 「消すもの」「残すもの」「未決」「未確認」
- `tasks/2026-11-15-p5-c2-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c2-patch/trial/`
  - 適用の検査4つ: `checks-ops.json`・`checks-ops2.json`・`checks-verify-a.json`・`checks-verify-b.json`。verify の2つにはロックファイルの検査も追記した
  - 型検査の記録6つ: `build-typecheck-{1..4,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
- `tasks/2026-11-15-p5-c2-patch/disk-start.json`・`disk-end.json`
- `scripts/` と `removals/C-1-ai/` は直していない

## 要点

1. A・B の14単位と C-2 の上で、型検査の誤りは 34 → 5 → 1 → 0 と減った。どれも README の「型検査で直す点」の見込みの範囲だった。
2. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。
   - a: 15単位
   - b: 16単位。C-1 の後に C-2
3. b では、edits.patch が3-way を使わずに当たる（`git apply --check` で全ハンクが行のずれだけで当たった）。そのために、C-1 が隣の行を変える2か所の import の行を、パッチでなく `removeLines` に回した。
4. `vscode.debug` は新しいファイル `api/common/extHostRemovedApi.debug.ts` の何もしない実装に向けた。`extHost.api.impl.ts` の変更は、import の1行の差し替え、作る所の1行の削除、`const debug` の右辺だけ。
5. 判断を仰ぐ点が4つある（下の「判断を仰ぐ点」）。特に、`customEndpointTelemetryService.ts` を消すか迷って残した。

## 直した点

一覧の正本は `removals/C-2-debug/README.md` の「edits.patch で直した点（2026-11-15）」。ここでは形だけを書く。

### 1. edits.patch

| ファイル | 直し方 |
|---|---|
| `api/common/extHostRemovedApi.debug.ts`（新規） | `createRemovedDebugApi(extension): typeof vscode.debug`。何もしない実装 |
| `api/common/extHost.api.impl.ts` | import を `./extHostRemovedApi.debug.js` に替えた。`ExtHostDebugService` を作る1行を消した。`const debug: typeof vscode.debug = createRemovedDebugApi(extension);` |
| `api/common/extHost.protocol.ts` | `MainThreadDebugServiceShape`・`ExtHostDebugServiceShape` と、その DTO を消した（2026-11-14 の判断「消した API の Shape と ID を消す」） |
| `contrib/debug/browser/debug.service.contribution.ts` | `NullDebugService`・`NullDebugVisualizerService` を登録する（未決の1。案A） |
| `workbench.common.main.ts` | Debug の節に `import './contrib/debug/browser/debug.service.contribution.js';` を足した（案A） |
| `contrib/notebook/browser/notebook.contribution.ts` | 設定 `notebook.variablesView`・`notebook.inlineValues` の登録を消した。使われなくなった import とローカルを外した |
| `contrib/notebook/browser/controller/editActions.ts` | 「すべての出力をクリア」から、インラインの値の飾りを消す2行を外した |
| `contrib/replNotebook/browser/repl.contribution.ts` | デバッグコンソールの検索のキー割り当て `list.find.replInputFocus` を消した。使われなくなった import を外した |

### 2. unit.json

- `delete` に足したもの: `contrib/notebook/browser/controller/variablesActions.ts`。中身は、消した変数のビューを開く操作1つだけ。
- `removeLines` に足した10行:
  - `notebook.contribution.ts`: 3行（`variablesActions.js` の import、`NotebookVariables` の import、その登録）
  - `editActions.ts`: 1行（`notebookInlineVariables.js` の import）
  - `repl.contribution.ts`: 2行（`getReplView`・`REPL_VIEW_ID` の import）
  - `extHost.protocol.ts`: 3行（`contrib/debug/common` の import、`MainContext.MainThreadDebugService`・`ExtHostContext.ExtHostDebugService` の ID）
  - `build/next/resources.ts`: 1行（`'vs/workbench/contrib/debug/browser/media/*.png',`）
- `kept` に足したもの: `platform/telemetry/node/customEndpointTelemetryService.ts`（下の判断の1）
- `checks.absentSettings` に足したもの: `notebook.variablesView`・`notebook.inlineValues`
- `checks.absentStrings` に足したもの:
  - `build/next/resources.ts` の `debug/browser/media/*.png`
  - `contrib/notebook` の `contrib/notebookVariables/`
  - `extHost.protocol.ts` の `MainThreadDebugServiceShape`・`ExtHostDebugServiceShape`
  - どれも本家 1.146.0 の同じ所にある文字列なので、消し損ねると当たる

### 3. C-1 と独立に保つ形（docs/03 の5.3）

C-1 の edits.patch は、C-2 が消す行のすぐ隣を消す所が2つある。

- `extHost.protocol.ts`: `contrib/debug/common` の import の前後の行（chat と mcp の import）
- `repl.contribution.ts`: `REPL_VIEW_ID` の import の次の行（`InlineChatController`）

隣り合う行を両方のパッチで変えると、文脈が合わないので普通の当て方は通らない。3-way も衝突になる見込み。そこで、この3行は C-2 の側を `removeLines` に回した。`removeLines` は行の一致だけで消すので、前後の行に左右されない。ID の2行（一覧の1要素）も `removeLines` にした。

その結果、edits.patch のどのハンクも、文脈の行が C-1 の変える行と重ならない。3-way に頼ると、常設の clone に「C-1 の無い木の blob」が残っている必要がある。このやり方なら、それも要らない。

## 残した部品と理由

| 部品 | 理由 |
|---|---|
| `contrib/debug/common`（まるごと） | 前からの決まり。使い手は `extHost.api.impl.ts`（`DebugConfigurationProviderTriggerKind`）・`extHostTypeConverters.ts`・`viewsExtensionPoint.ts`、テスト・アクセシビリティの合図など。`extHost.protocol.ts` は、edits.patch の後は使わない。使われなくなるファイル（`debugSchemas.ts` など）は、依頼どおり今は残す（未決の2） |
| `debug.service.contribution.ts`・`extensionHostDebugService.ts` 2つ・`callStackWidget.ts` ほか4つと CSS 2つ・`platform/debug` | 前からの決まり（README の「残すもの」） |
| `platform/telemetry/node/customEndpointTelemetryService.ts`（新しく残した。迷ったもの） | 画面側の呼び手は、消した `browser/debugSession.ts` だけ（1.146.0 で確かめた）。呼ばれなくなるが、消すと共有プロセスの `sharedProcessMain.ts`（C-1 も直す）と `workbench.web.main.ts`（main のファイル）に触れる。テレメトリの部品でもある |
| `NotebookSetting.notebookVariablesView`・`notebookInlineValues` の鍵（`notebook/common/notebookCommon.ts`） | 名前の定数だけで、common は C-4 で扱う。登録は消した |

## Claude Code と台帳の拡張の API への影響

- `vscode.debug` の振る舞い:

  | API | 振る舞い |
  |---|---|
  | `activeDebugSession`・`activeStackItem` | `undefined` |
  | `activeDebugConsole` | 何もしないコンソール |
  | `breakpoints` | `[]` |
  | イベント6つ | `Event.None` |
  | `register*` の5つ | 何もしない Disposable。提案中の2つは門を残した |
  | `startDebugging` | `false` |
  | `stopDebugging` | resolve |
  | `addBreakpoints`・`removeBreakpoints` | 何もしない |
  | `asDebugSourceUri` | 本家と同じ計算 |

- Claude Code（2.1.322）: manifest（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json`）に `debuggers`・`breakpoints`・`enabledApiProposals` は無い。
  - 圧縮されたコードの中で `vscode.debug` を呼んでいても、誤りは投げない。
  - 受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。
- PowerShell 拡張（2025.4.0）: 台帳の8つの拡張の package.json を見ると、`debuggers`（type `PowerShell`）・`breakpoints`・`onDebugResolve:PowerShell` を持つのはこれだけ。
  - デバッグの拡張点が登録されなくなる。拡張ホストのログに警告が出るかは未確認。
  - `onDebugResolve` は発火しない。`onLanguage:powershell` などで起動する。
  - 起動時の `vscode.debug.register*` は何もしない実装が受ける。
  - 「実行」「デバッグ」は始まらない。言語サーバーは残る見込み（推定）。
- 台帳のほかの6つ（basedpyright・bash-ide・rainbow-csv・dotenv・pdf・日本語の言語パック）は、manifest にデバッグの contributes も提案中の API も無い。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）は6回走らせた。4回目で誤り 0（回ごとの数は `typecheck-log.md`）。
- 当て直し a（タグから15単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-2 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - 型検査は `ok`、誤り 0（HEAD `20c43ac6`）
  - `--lockfile-check` は `ok`（差分は削除だけ49行）
- 当て直し b（タグから16単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1 の edits も C-2 の edits も `conflicts: []`。警告は想定どおりの1件（`debugChatIntegration.ts` が本家に無い）
  - 型検査は `ok`、誤り 0（HEAD `6b6aa860`）
  - `--lockfile-check` は `ok`（削除だけ768行、`removedPatches: ["foundry-local-sdk"]`）
- b の C-2 の ops の commit の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-2-debug/edits.patch` が全ハンク成功した（offset だけ）。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- build/ の型検査（`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`。a の上）は、A-3 から来る前からの1件だけだった。
- ディスク: C: の空きは、始め 19.45 GB、終わり 19.41 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-2-debug --checks-out <file>`
   - b: 同じ `--only` の `B-7-terminal-suggest` の後に `C-1-ai,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-2-debug].edits` が `{applied: "ok", subject: "unit C-2-debug: edits", conflicts: []}`
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`
     - b だけ、`units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件
2. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
3. **3-way に頼らないこと**: b の C-2 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-2-debug/edits.patch` が 0 で終わる。
4. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `removals/C-2-debug/unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-2-debug: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - `delete` と `kept` に同じパスが無い
   - edits.patch が `workbench.*.main.ts` で触るのは、`workbench.common.main.ts` の1行の追加だけ（案A の例外）
   - edits.patch が `extHost.api.impl.ts` で変える行は、上の「直した点」の3か所だけ
5. **当てた後の木**
   - `src/vs/workbench/api/common/extHostRemovedApi.debug.ts` がある
   - `extHost.protocol.ts` に `MainThreadDebugService`・`ExtHostDebugService`・`contrib/debug/common` が無い
   - `debug.service.contribution.ts` に `NullDebugService` があり、`./debugService.js` が無い
   - `workbench.common.main.ts` に `debug.service.contribution.js` の import がちょうど1行ある
   - `notebook.contribution.ts` に `notebookVariablesView`・`notebookInlineValues` の登録が無い
   - `repl.contribution.ts` に `list.find.replInputFocus` が無い
   - `variablesActions.ts` が無い
   - `build/next/resources.ts` に `debug/browser/media` が無い
6. **何もしない実装**（作業ツリーの中で VS Code のテストの仕組みで書く場合）。`createRemovedDebugApi(ext)` を作る。
   - `startDebugging(undefined, 'x')` が `false` で resolve する
   - `registerDebugConfigurationProvider('PowerShell', {})`・`registerDebugAdapterDescriptorFactory('PowerShell', {})` の返り値が `dispose` を持ち、呼んでも誤りにならない
   - `onDidStartDebugSession(() => {})` が Disposable を返す
   - `activeDebugSession` が `undefined`、`breakpoints` が `[]`
   - `activeDebugConsole.appendLine('x')` が誤りにならない
   - `asDebugSourceUri({ path: 'C:\\a.ps1' })` が `file` の URI、`asDebugSourceUri({ path: 'a', sourceReference: 3 })` が scheme `debug`・path `a`・query `ref=3` の URI、`asDebugSourceUri({})` は誤りを投げる（本家と同じ）
   - 提案を有効にしていない拡張で `registerDebugVisualizationProvider` を呼ぶと誤りを投げる（門が残っていること）
7. **関門の起動の確かめ**（片づけの後）
   - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service debugService`・`Missing proxy instance` が無い
   - 「実行とデバッグ」のビュー、F5 のデバッグの開始、エディタの余白のブレークポイントが無い
   - テストのビューで普通の実行ができ、失敗したテストの呼び出し履歴が表示される（`callStackWidget`）
   - PowerShell 拡張が起動し、`.ps1` で補完と診断が出る。拡張ホストのログの警告を記録する

## 判断を仰ぐ点（別案）

1. **`customEndpointTelemetryService.ts` を残した**（消すか迷ったもの。2026-11-14 の規則では「消す部品だけが使うもの」に当たる）
   - 採った案: 残して `kept` と README に書く。呼ばれないので動きは変わらない
   - 別案: 共有プロセスの登録とチャネル、`workbench.web.main.ts` の登録、`electron-browser` の登録と一緒に消す。C-1 も直す `sharedProcessMain.ts` に触れ、main のファイルは `removeLines` になる。テレメトリなので B-1 で扱う案もある
2. **ノートブックのインラインの値（設定 `notebook.inlineValues`）も無くなる**
   - 部品は前から `delete` に入っていた `notebookVariables` の中にあり、読み手が消えるので、設定の登録も消した（README に無かった、足したもの）
   - デバッグとは別の機能（セルの実行後に変数の値を行に出す）だが、ノートブックは C-4 で消える
   - 別案: `notebookInlineVariables.ts` だけを残す。デバッグ側の部品への依存を外すパッチが要る
3. **`activeDebugConsole` を `undefined` でなく何もしないコンソールにした**（README の前の書き方と違う）
   - 型が `DebugConsole` で undefined を許さず、拡張がそのまま `appendLine` を呼ぶと、undefined では誤りになるため
4. **main のファイルでない所の import の行も `removeLines` に回した**（3行）
   - C-1 と隣り合う行で衝突しないようにするため（上の「C-1 と独立に保つ形」）
   - そのうち `REPL_VIEW_ID` の import は、消すファイルでなく残る common の import。edits.patch で使い手を消した結果、使われなくなる行
   - 別案: パッチで消す。C-1 と一緒に当てると衝突する

## docs/ との食い違い

- docs/03 の5.3 は「`workbench.common.main.ts` などは `removeLines` で直し、パッチに入れない」と書く。案A（2026-11-14 のリーダーの判断。README の未決の1）は、C-2 の edits.patch で `workbench.common.main.ts` に1行を足す。docs/03 の4節の末尾（144行）には、この例外が書かれていない。採るなら5.3 か4節の末尾に例外を書く必要がある。
- docs/03 の4節の表（132行）の C-2 は「`contrib/debug`（common の6行、desktop の1行）」と書く。desktop の1行は `extensionHostDebugService` の import なので消さない（前からの食い違い。README に書いてある）。3.1 の例の `removeLines` の2行目も同じ。

## 未解決の点

- 起動時の注入（DI）の外し損ねは、型検査では見えない。起動の確かめで見る。
- PowerShell 拡張の起動と、拡張ホストのログの「知らない contributes」の警告の有無（関門の `powershell` の組）。
- パッケージ化（`build/next/index.ts` から `telemetryApp` の入口を消した後の束ね）、`node_modules` の作り直し、起動は、片づけの許可の後。
- `rm` が許可に無いので、`variablesActions.ts` は手で消さず、`unit.json` の `delete` に足して当て直す形にした。作業は止まっていない。許可の追加は要らない。
- 誤って作ったファイルは無い。
- 報告の SubagentHandback は、定義の `tools` に無いのでフックが止めた（2回）。報告はこのファイルで渡す。

---

## 2回目（2026-11-15、absentStrings の直し）

曹参の指摘（`tasks/2026-11-15-p5-c2-tests/handoff-notes.md` の「仕様と実装についての指摘」の1・2）を受けた。作業ツリーは使っていない（`C:\b\wt\p2` は C-4 で使用中）。読んだのは本家の写し `C:\b\wt\1.146.0` だけ。

### 結果

**完了**。edits.patch は変えていない。

### 直したこと

| 指摘 | ファイル | 直し方 |
|---|---|---|
| 1 | `removals/C-2-debug/unit.json` | `checks.absentStrings` の2項目を替えた。`debug/browser/debugService.js'` → `/debugService.js'`、`debug/browser/linkDetector.js'` → `/linkDetector.js'`。どちらも `in: ["src/vs"]` |
| 1 | `removals/C-2-debug/README.md` | 「unit.json で足したもの」の `checks.absentStrings` に、替えたことと理由を書いた |
| 2 | `removals/C-2-debug/README.md` | 「未確認」の最後の項を「`tests/c2-*.test.mjs` に書いた。VS Code のテストの仕組みで走らせる形は未実行（台本の4）」にした |

### 本家の写しで確かめたこと

`C:\b\wt\1.146.0` の `src` を、大文字小文字を区別せずに探した。checks.mjs の照合は `includes` で、大文字小文字を区別する。

- `/debugService.js'` に当たるのは2か所だけ。
  - `contrib/debug/browser/debug.service.contribution.ts` 7行。kept なので検査の外
  - `contrib/debug/test/browser/callStack.test.ts` 22行。C-2 の `delete` の中
- `/linkDetector.js'` に当たるのは6か所。
  - `contrib/debug/browser` の `exceptionWidget.ts`・`debugExpressionRenderer.ts`・`debugANSIHandling.ts`・`baseDebugView.ts`
  - `contrib/debug/test/browser` の `linkDetector.test.ts`・`debugANSIHandling.test.ts`
  - どれも C-2 の `delete` の中。kept の6ファイル（`callStackWidget.ts` など）には当たらない
- `/extHostDebugService.js'`・`mainThreadDebugService.js'`・`nullDebugService.js'` などの別の名前には当たらない。`/` の次が小文字の `debugService` でないため。
- 前の形の `debug/browser/debugService.js'`・`debug/browser/linkDetector.js'` は、本家に1つも無い。本家は `./` か `../../browser/` の相対で import するため。
- edits.patch と C-1 の edits.patch は、この2つの文字列を足さない（`removals/` を探して、当たったのは C-2 の edits.patch の `-import { DebugService } from './debugService.js';` の削除の行だけ）。当てた後は、a・b のどちらの組でも 0 件になる見込み。当て直しでの確かめは、大岡越前守の検証で行う。

### 例の形を採らなかった理由（リーダーへ）

例の `./debugService.js'` を `in: ["src/vs/workbench/contrib/debug"]` で探す形は、本家での当たりが `debug.service.contribution.ts` だけになる。このファイルは kept で、検査の外になるので、結局どこにも当たらない。そこで `/debugService.js'` を `src/vs` で探す形にした。

- 本家の中で、kept の外（削除するテスト）に当たる。
- ほかの部品から `../../debug/browser/debugService.js'` の形で import されても当たる。
- kept の `debug.service.contribution.ts` の中に `DebugService` の import が残っていないかは、この検査では見られない（kept の外しの仕組みのため）。この点は型検査が守る。`debugService.ts` を消すので、import が残れば TS2307 になる。

### 指摘の4

`debugChatIntegration.ts` の delete の重なりは、指示どおり変えていない。

### 曹参・大岡越前守へ

- `tests/c2-*` の照らし役が `debug/browser/debugService.js'`・`debug/browser/linkDetector.js'` を名前で見ているなら、`/debugService.js'`・`/linkDetector.js'` に読み替えてほしい。
- 曹参の「今も空振りであることを見張る」テストは、この2つが空振りでなくなったので、期待が逆になる。

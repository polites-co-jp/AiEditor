# B-3-issue-share 課題の報告と共有

## 消すもの

- `src/vs/workbench/contrib/issue` のうち、下の「残すもの」の `common/issue.ts` を除く全部: 課題の報告の画面（desktop の `electron-browser`、web の `browser`）、「問題を報告」のコマンド `workbench.action.openIssueReporter`、設定 `issueReporter.*`、GitHub への送信・画面の写し・録画、テスト。
- `src/vs/workbench/contrib/share/browser`: 共有のコマンド `workbench.action.share`（コマンドセンターなどのメニュー。設定 `workbench.experimental.share.enabled` が true のときだけ登録される）、タイトルバーの右クリックの「共有」の切り替え `toggle.workbench.experimental.share.enabled`（`shareService.ts` の `ToggleShareControl`。常に登録される）、設定 `workbench.experimental.share.enabled`。
- import の行（`removeLines`）: `workbench.desktop.main.ts`・`workbench.web.main.ts`・`workbench.common.main.ts`・`sessions.desktop.main.ts`・`sessions.web.main.ts`・`sessions.common.main.ts` の各1行。
- product.json の `reportIssueUrl`（`productRemove`。docs/02 の3節の表）。これを読む残りの部品は、`src/vs/platform/menubar/electron-main/menubar.ts`（149行。値が無ければメニューの代わりの処理を足さない）と `src/vs/workbench/contrib/performance/electron-browser/startupProfiler.ts`（116行。値が無ければ何もしない）で、どちらも値の無いときを扱っている。

## 残すもの

- `src/vs/workbench/contrib/issue/common/issue.ts`: サービスの ID `IWorkbenchIssueService` を、`contrib/extensions`（拡張の「問題を報告」の操作。`extensionsActions.ts`・`reportExtensionIssueAction.ts`）と `contrib/userDataSync/browser/userDataSync.ts` が注入している。`edits.patch` で、何もしない実装 `NullWorkbenchIssueService` をこのファイルに足して登録する。拡張の「問題を報告」を押しても何も起きない（拡張の画面は C-5 で消える見込み）。
- `src/vs/workbench/contrib/share/common/share.ts`: 拡張 API の `src/vs/workbench/api/browser/mainThreadShare.ts` がサービスの ID `IShareService` を注入している。main thread の受け手は拡張ホストの起動のときに作られるので、実装が無いとすべての拡張の起動が壊れる恐れがある。`edits.patch` で、提供者を受け取って捨てる実装 `NullShareService` を足して登録する。

## 影響しうるもの

- 拡張の「問題を報告」、ヘルプメニューの「問題の報告」、Process Explorer などから課題の報告を開く操作は、何も起きないか、コマンドが見つからない。
- 提案中の API `vscode.window.registerShareProvider` を使う拡張（台帳には無い）は、登録は通るが共有のメニューが出ない。

## 消えたことの検査（checks）

- 共有のコマンドは、`workbench.action.share` から `toggle.workbench.experimental.share.enabled` に替えた（2026-11-14）。`workbench.action.share` は設定 `workbench.experimental.share.enabled`（既定 false）が true のときだけ `ShareWorkbenchContribution.registerActions` が登録するので、公式でも実行時に「無い」になり網にならなかった（関門の記録 `records/take-in/1.146.0-p2-B-3/gate-B-3-issue-share.md`）。替えたコマンドは `contrib/share/browser/shareService.ts` の読み込みで登録される。2026-11-14 までの公式の zip の実行と A-1〜B-2 の版の実行のすべてで在り、B-3〜B-7 の版の実行で無い（`C:\b\smoke\absent\` の `snapshot.json`）。
- `workbench.action.openIssueReporter` は実行時の網で見える（公式と B-2 に在り B-3 に無い）。

## 壊れたときの症状と戻し方

- 起動時や拡張ホストの起動時に `workbenchIssueService`・`shareService` が見つからない誤りが出たら、`common/issue.ts`・`common/share.ts` の登録が読まれていない。`enabled: false` に戻してビルドし直す。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか（`NullShareService` が `IShareService` の `_serviceBrand` に合うか。本家の interface は readonly でない）。
- `contrib/issue/common/issue.ts` を、`contrib/issue` の消した部分のほかに import している所が無いか（`grep` では `extensions`・`userDataSync`・sessions のテストだけ）。
- 本家 1.146.0 の main のプロセスに課題の報告の窓を開く部品が残っていないか（`src/vs/platform/issue` は 1.146.0 に無い。`grep` で確かめた）。

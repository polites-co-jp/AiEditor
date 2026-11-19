# C-6-settings-sync 本家の設定の同期（バックアップと同期）

裁定（2026-11-12、調査の後）: 設定の同期は Notion の設定ページを同期先にする（本家の Settings Sync は使わない）。自前の拡張 `extensions-src/notion-sync/`（docs/05）が担う。

> 状態: edits.patch あり、関門の前（2026-11-15）。`enabled` は `false` のまま。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 前提の単位

- `after` は `C-1-ai`。`sessions.common.main.ts`・`sessions.desktop.main.ts` が `userDataSyncWorkbenchService` と `userDataSyncUtilChannel.contribution` を直接 import しているが、C-1 が `src/vs/sessions` を丸ごと消すので、この単位では直さない。
- edits.patch の5ファイルは、C-1〜C-5 のどの edits.patch も触れない。C-1 なしでも文脈は当たるが、sessions の入口が残るので `after` は外さない。

## 消すもの

- `src/vs/workbench/contrib/userDataSync`（`delete`）: 「バックアップと同期」の画面（同期のビュー `workbench.view.sync`、衝突のビュー）、コマンド（`workbench.userDataSync.actions.*`）、アカウントのメニューとグローバルの歯車の「設定の同期」の項目、同期の起動のきっかけ（`userDataSyncTrigger.ts`）、同期の誤りの通知（`UserDataSyncReportIssueContribution`）、共有プロセスの同期が使う `userDataSyncUtil` のチャンネルの登録（`electron-browser/userDataSyncUtilChannel.contribution.ts`）、デスクトップのコマンド2つ（下の「このビルドでの見え方」）。
- `src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts`（`delete`）: ワークベンチ側の同期のまとめ役（同期をオンにする手順、アカウントの選択と認証、同期のストアの切り替え）。`IUserDataSyncWorkbenchService` を登録していた唯一のファイル。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行、`workbench.desktop.main.ts` 1行。
- edits.patch（下の「edits.patch で直した点」）: 設定の画面の同期の部品（`SyncControls`）と、2か所の注入。

### このビルドでの見え方（2026-11-15 に確かめた）

本家の OSS の product.json にも、このビルドの上書き（`product.overlay.json`）にも同期のストア（`configurationSync.store`）が無い（`C:\b\wt\p2\product.json` を `Grep` して 0 件）。そのため `UserDataSyncWorkbenchService.enabled`（`!!userDataSyncStoreManagementService.userDataSyncStore`）は常に偽で、`contrib/userDataSync/browser/userDataSync.ts` の125〜152行の中（設定 `settingsSync.*` の登録、コマンド、ビュー、アカウントと歯車のメニュー）は、C-6 の前から作られていなかった。

C-6 の前のこのビルドで、条件なしに登録されていたのは次の2つだけ（`contrib/userDataSync/electron-browser/userDataSync.contribution.ts` の18・45行。`workbench.desktop.main.ts` の159行が import する）。

- `workbench.userData.actions.openSyncBackupsFolder`（ローカルのバックアップのフォルダを開く）
- `workbench.userDataSync.actions.downloadSyncActivity`（同期の記録を落とす）

どちらもコマンドパレットの `when` は `syncStatus != uninitialized` で、ストアが無いので出ていなかったが、コマンドとしては登録されていた。`checks.absentCommands` はこの2つにした（下の「checks の見直し」）。

## edits.patch で直した点（2026-11-15）

5ファイル、4行の追加、115行の削除。件名は `unit C-6-settings-sync: edits`、作者は `sukuna-apply <apply@sukuna.invalid>`。

| ファイル | 直し方 | 理由 |
|---|---|---|
| `contrib/preferences/browser/settingsEditor2.ts` | `IUserDataSyncWorkbenchService` と `IUserDataSyncEnablementService` の注入をやめ、同期の部品を作る分岐（902〜908行）と `SyncControls` のクラス（2297〜2373行。「Backup and Sync Settings」のボタンと「Last synced」の表示）を消した。`SyncControls` だけが書いていた `lastSyncedLabel` の欄と、検索欄の読み上げの文へのその連結を消した。使われなくなった import 8つ（`Button`・`CodeWindow`・`fromNow`・`Emitter`・`Disposable`・`ICommandService`・`defaultButtonStyles`、`platform/userDataSync` の行）を外した | **型検査に掛からない注入**。ID は残る `common/userDataSync.ts` にあるので型は通るが、登録が無くなるので、設定の画面を開くと `IUserDataSyncWorkbenchService` が見つからず失敗する。ボタンは消したコマンド `workbench.userDataSync.actions.turnOn` を呼ぶだけ（2026-11-14 の規則: 消す部品だけが使うものは消す） |
| `contrib/preferences/browser/media/settingsEditor2.css` | `.last-synced-label` の規則（3行）を消した | `SyncControls` だけが使っていた |
| `contrib/relauncher/browser/relauncher.contribution.ts` | `IUserDataSyncWorkbenchService` の注入と、`onDidTurnOnSync` の購読（123行）を消した | **型検査に掛からない注入**。`SettingsChangeRelauncher` は `LifecyclePhase.Restored` で作られるので、外さないと起動のたびに失敗する |
| `contrib/relauncher/test/browser/relauncher.test.ts` | 同期のまとめ役の偽物と、コンストラクタの引数を1つ外した。使われなくなった `Event` の import を外した | 引数の数が変わった |
| `contrib/preferences/test/browser/settingsEditor2.test.ts` | `IUserDataSyncWorkbenchService` の差し替え（stub）と import を外した | 設定の画面が注入しなくなった。`checks.absentStrings` の網を空振りさせないため（下） |

型検査の誤りは、ops だけでは 0（`contrib/userDataSync` を import していたのは main の入口だけ）。注入を外した後に、使われなくなった import の8件が出て、直して 0（`tasks/2026-11-15-p5-c6-patch/typecheck-log.md`）。

## 注入の照らし（型検査に掛からない点）

消したファイルが登録していたサービスは `IUserDataSyncWorkbenchService` だけ（`contrib/userDataSync` には `registerSingleton` が無い）。edits.patch を作った木（16単位）と、edits.patch の後の木（20単位）で `Grep` した。行の番号は16単位の木のもの。

| 照らしたもの | 残り | 扱い |
|---|---|---|
| `@IUserDataSyncWorkbenchService` | 0 | 設定の画面と再起動の部品の2か所を外した（docs/03 の4節の末尾の「2か所」） |
| `get(IUserDataSyncWorkbenchService)` | `contrib/update/browser/update.ts` の397行の1つ | 直さない。品質の切り替えの操作（`update.switchQuality.*`）の中で、`environmentService.options?.productQualityChangeHandler` があるときだけ登録される（372〜378行）。これは Web の埋め込み側が渡す値で、デスクトップでは操作そのものが登録されない。`precondition` も `IsWebContext` |
| ほかの `IUserDataSyncWorkbenchService` | `services/userDataSync/common/userDataSync.ts` の ID と型だけ | `kept` |
| 残る `@IUserDataSync*Service`・`@IUserDataAutoSyncService` の登録 | すべて登録あり | `IUserDataSyncEnablementService`（`browser/userDataSyncEnablementService.ts`。`workbench.desktop.main.ts` の87行）、`IUserDataSyncService`・`IUserDataSyncAccountService`・`IUserDataSyncStoreManagementService` など（`electron-browser/userDataSyncService.ts`。同71行）、`IUserDataAutoSyncService`（`electron-browser/userDataAutoSyncService.ts`。同72行）、`IUserDataSyncUtilService`（`common/userDataSyncUtil.ts`。`workbench.common.main.ts` の97行）、`IUserDataSyncLogService`（`workbench.common.main.ts` の168行） |
| 消したコマンドを文字列で呼ぶ所 | 0（`workbench.userDataSync.actions.` と `workbench.userData.actions.` で `Grep`） | 設定の画面の `turnOn` を消した。歓迎画面の2か所は B-2 で消えている |
| 共有プロセスのチャンネル `userDataSyncUtil` | 共有プロセスの代理（`sharedProcessMain.ts` の `services.set(IUserDataSyncUtilService, ...)`）は残る。窓の側の登録は無くなる | 直さない。使うのは共有プロセスの設定とキー割り当ての同期（`settingsSync.ts`・`keybindingsSync.ts`・`abstractSynchronizer.ts`）だけで、同期を始めたときにだけ作られる。`UserDataSyncService` のコンストラクタは同期の部品を作らず、ストアが無いので状態は `Uninitialized` のまま（`userDataSyncService.ts` の112行）。呼ばれても、窓の側が「知らないチャンネル」として誤りを返す見込み（推定。起動の確かめで見る） |

## 残すもの

- `services/userDataSync` のほかのファイル: `common/userDataSync.ts`（ID と context key）、`browser/userDataSyncEnablementService.ts`（同期が有効かを答える）、`electron-browser/`（共有プロセスへの代理）、`common/userDataSyncUtil.ts`。拡張の管理・拡張の有効と無効・設定の画面の設定の木・再起動の部品・プロファイルが注入しているので、消すと残す部品へのパッチが大きくなる。ストアが無いので、同期は常に使えない状態で答える。
- `browser/userDataSyncInit.ts`・`browser/webUserDataSyncEnablementService.ts`: Web の入口（`browser/web.main.ts`・`workbench.web.main.ts`）だけが使う。
- `src/vs/platform/userDataSync`: プロファイル、無視する拡張、同期のログ、共有プロセスの同期のサービス（`sharedProcessMain.ts`）。docs/03 の表の「プロファイルなどが platform/userDataSync を使っている見込み」のとおり使っていた。共有プロセスの同期はストアが無いので動かない。
- `src/vs/workbench/services/accounts`: docs/03 の表の「アカウントのメニュー（`services/accounts`。依存が無ければ）」は、依存があった。`IDefaultAccountService` を拡張の有効・無効、ポリシー（`services/policies`）、GitHub のサービス、アクティビティバーのアカウントのメニュー（`browser/parts/globalCompositeBar.ts`）など約60ファイルが使う。アカウントのメニューは拡張 API の `vscode.authentication`（残す）のサインインの入口でもある。残す。`globalCompositeBar.ts` に同期の項目は無い（同期の項目は消した `contrib/userDataSync` が `MenuId.AccountsContext` に足していた）。
- 再起動の部品の `isTurningOnSyncInProgress()`（`relauncher.contribution.ts`）: 残る `IUserDataSyncService`・`IUserDataSyncEnablementService` だけを読む。同期は始まらないので常に偽を返す。消すと同じファイルのハンクが増える。
- 条件が常に偽で出ない同期の画面（消すか迷ったもの。C-5 の `CONTEXT_HAS_GALLERY` と同じ扱い。行は A・B の14単位と C-1・C-6 を当てた木のもの）
  - 設定の木の「この設定を同期しない」と、同期から外した印（`settingsTree.ts` の2235・2301行、`settingsEditorSettingIndicators.ts` の297行）。`IUserDataSyncEnablementService.isEnabled()` が偽なので出ない
  - 拡張の画面の `CONTEXT_SYNC_ENABLEMENT`（`syncEnabled`。いつも偽）を条件にするメニュー3つ（`extensions.contribution.ts` の `workbench.extensions.action.installAndDonotSync`・`installPrereleaseAndDonotSync`・`toggleIgnoreExtension`（「Sync This Extension」））と、同期から外した印（`extensionsActions.ts`・`extensionsWidgets.ts` の `settingsSync.ignoredExtensions` の購読）。C-5 の edits.patch もこの3つを残している
  - 設定の目次の「Settings Sync」の節（`settingsLayout.ts` の410行。`settings: ['settingsSync.*']`）。設定が登録されないので空で、出ない
- 設定 `settingsSync.*` は、同期が有効なときにだけ登録される（消した `contrib/userDataSync/browser/userDataSync.ts` の126行の `registerConfiguration()`）。このビルドでは元から登録されないので、`absentSettings` に挙げない。
- 出力のログ「Settings Sync」（`platform/userDataSync/common/userDataSyncLog.ts`）: `IUserDataSyncLogService` はプロファイルの部品も使う。残す。
- 「続きの編集」（`contrib/editSessions`）: この単位に入れない（裁定に無い機能。扱いはリーダーがユーザーに諮る。`brief.md`）。消したファイルを import していない（`Grep` で 0 件）ので、C-6 の後も今までどおり。

## checks の見直し（2026-11-15）

- `absentCommands`: 下準備の5つ（`turnOn`・`turnOff`・`syncNow`・`showSyncedData`・`manage`）は、ストアが無いこのビルドでは C-6 の前から登録されていない（上の「このビルドでの見え方」）。消し損ねても当たらず網にならないので外し、C-6 の前に登録されていた2つ（`workbench.userData.actions.openSyncBackupsFolder`・`workbench.userDataSync.actions.downloadSyncActivity`）にした（2026-11-14 の Phase 2 の関門の判断「公式でも登録されないコマンドを checks に挙げない」の当てはめ）。
- `absentViews`: `workbench.view.sync` も同じ理由で C-6 の前から登録されていないので外し、空にした。
- `absentStrings` に5つを足した。どれも 1.146.0 の木にあり（`C:\b\wt\1.146.0` を `Grep`）、edits.patch の後に 0 件になる。
  - `IUserDataSyncWorkbenchService`（`contrib/preferences`・`contrib/relauncher`。本家に8行）: 注入の外し損ねの網。`update.ts` は範囲の外
  - `SyncControls`（`contrib/preferences`）
  - `workbench.userDataSync.actions.turnOn`（`contrib/preferences`）
  - `last-synced-label`（`contrib/preferences`。CSS と TS）
  - `onDidTurnOnSync`（`contrib/relauncher`）

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest に `sync`・`settingsSync`・`userDataSync` の語は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`。`authentication` の語は設定の説明の1つだけ）。受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。
- 台帳のほかの7つの package.json にも、`settingsSync`・`userDataSync` の語は無い（`C:\b\cache\vsix\*\package.json` を `Grep`）。
- 拡張 API の `vscode.authentication` と `ExtensionContext.globalState.setKeysForSync` は、消したファイルを通らない（`api/` には触れていない）。
- notion-sync（`extensions-src/notion-sync/`）は本家の同期の部品を使わない（`userDataSync`・`settingsSync` の語が 0 件）。影響しない見込み。スモークで設定の同期の往復を見る。

## 影響しうるもの

- アカウントのメニューと歯車のメニューから「設定の同期をオンにする」「バックアップと同期」が消える。もともとストアが無いので、本家の OSS のビルドでも同期は使えない状態で、これらの項目も出ていなかった。
- 設定の画面の右上の「Backup and Sync Settings」のボタンと「Last synced」の表示が無くなる（これもストアが無いので出ていなかった）。
- 品質の切り替え（Web だけ）の中の同期のストアの種類合わせは、Web の入口でも `IUserDataSyncWorkbenchService` が無いので失敗する（Web は作らない）。

## 壊れたときの症状と戻し方

- 設定の画面が開かない、または起動時に `IUserDataSyncWorkbenchService` が見つからない誤り（開発者ツールのコンソールの `depends on UNKNOWN service IUserDataSyncWorkbenchService`）: 注入の直しが漏れている。`enabled: false` に戻す。
- 設定やキー割り当ての保存のたびに共有プロセスのログにチャンネルの誤りが出る: `userDataSyncUtil` のチャンネルを使う同期が動いている。上の「注入の照らし」の推定が外れている。`enabled: false` に戻す。

## 別案（リーダーの判断を仰ぐ）

1. 採らない（2026-11-15 の依頼）: 残した同期の状態のサービス（`userDataSyncEnablementService.ts`・`electron-browser/` の代理）と共有プロセスの同期のサービスも、何もしない実装に差し替える。
2. C-6 に入れない（2026-11-15 の依頼）: 「続きの編集」（`contrib/editSessions`。同期のストアを使うクラウドの変更の保存）。裁定に挙がっていない機能なので、消すならユーザーの確認を経て単位を足す（docs/03 の4節の末尾）。
3. 判断を仰ぐ: 上の「条件が常に偽で出ない同期の画面」を残した。別案は消す（`settingsTree.ts`・`settingsEditorSettingIndicators.ts`・`extensions.contribution.ts`・`extensionsActions.ts`・`extensionsWidgets.ts`・`settingsLayout.ts` のハンクが増え、C-1・C-5 が直す拡張の画面のファイルとも重なる）。
4. 判断を仰ぐ: `checks.absentCommands` を下準備の5つから2つに替え、`absentViews` を空にした（上の「checks の見直し」）。別案は下準備の5つと `workbench.view.sync` を残す（網にならない）。

## 未確認（起動の確かめで見る）

- 設定の画面が誤りなく開き、検索・設定の変更・設定の木の右クリックが動く。
- 再起動が要る設定（例 `window.titleBarStyle`）を変えると、再起動を尋ねる。
- 起動時の開発者ツールのコンソールに `depends on UNKNOWN service` が無い。
- プロファイルの作成・切り替え・書き出しと、拡張の有効・無効が動く（残した `IUserDataSyncUtilService`・`IUserDataSyncEnablementService` の使い手）。
- 共有プロセスのログに `userDataSyncUtil` のチャンネルの誤りが無い。

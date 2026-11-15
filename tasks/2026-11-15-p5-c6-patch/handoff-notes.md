# Phase 5 の下ごしらえ（C-6 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない。作業ツリー `C:\b\wt\p2` はタグ 1.146.0 に戻した。

## 成果物

- `removals/C-6-settings-sync/edits.patch`（新規）
  - 5ファイル、4行の追加、115行の削除
  - 件名は `unit C-6-settings-sync: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `401af452`
- `removals/C-6-settings-sync/unit.json`（直した）。`enabled` は `false` のまま
  - `"patch": "edits.patch"` を足した
  - `checks.absentCommands` を下準備の5つから2つに替え、`checks.absentViews` を空にした（判断を仰ぐ点の2）
  - `checks.absentStrings` に5つを足した
  - `kept` の3つの理由を、edits.patch の後の事実に直した
  - `delete`・`removeLines`・`after` は変えていない
- `removals/C-6-settings-sync/README.md`（書き直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「前提の単位」「このビルドでの見え方」「edits.patch で直した点（2026-11-15）」「注入の照らし（型検査に掛からない点）」「checks の見直し」「Claude Code と台帳の拡張への影響」
  - 直した節: 「消すもの」「残すもの」「影響しうるもの」「壊れたときの症状と戻し方」「別案」「未確認」
- `tasks/2026-11-15-p5-c6-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c6-patch/trial/`
  - 適用の検査3つ: `checks-ops.json`・`checks-verify-a.json`・`checks-verify-b.json`。verify の2つにはロックファイルの検査も追記した
  - 型検査の記録5つ: `build-typecheck-{1,2,3,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
  - `take-in/`（`build.mjs` が書く置き場）
- `tasks/2026-11-15-p5-c6-patch/disk-start.json`・`disk-end.json`
- `scripts/` と、ほかの単位の `removals/` は変えていない

## 要点

1. A・B の14単位と C-1・C-6 の ops の上で、型検査の誤りは**最初から 0**だった。`IUserDataSyncWorkbenchService` の ID が残る `common/userDataSync.ts` にあるので、消した登録を注入している所も型は通る。直しは `Grep` の照らしから作った（0 → 8 → 0。8件は直した後の使われなくなった import）。
2. 注入の外し損ねは、docs/03 の4節の末尾の「2か所」（設定の画面 `settingsEditor2.ts`、再起動の部品 `relauncher.contribution.ts`）だけだった。両方を外した。3つ目の使い手 `update.ts` は、Web の埋め込み側の値があるときだけ登録される操作の中なので、デスクトップでは呼ばれない。直していない。
3. 設定の画面の同期の部品（`SyncControls`。「Backup and Sync Settings」のボタンと「Last synced」の表示）を消した。プロファイル・設定・拡張の管理のファイルには触れていない。
4. このビルドには同期のストア（`configurationSync.store`）が無いので、同期のコマンド・ビュー・メニューの項目・`settingsSync.*` の設定は、C-6 の前から登録されていなかった。そのため下準備の `absentCommands` の5つと `absentViews` は網にならない。C-6 の前に登録されていた2つのコマンドに替えた。
5. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。b（20単位）でも行のずれ無く当たり、`removeLines` に回すものは無かった。

## 直した点

一覧の正本は `removals/C-6-settings-sync/README.md` の「edits.patch で直した点（2026-11-15）」。

| ファイル | 直し方 |
|---|---|
| `contrib/preferences/browser/settingsEditor2.ts` | `IUserDataSyncWorkbenchService`・`IUserDataSyncEnablementService` の注入、同期の部品を作る分岐、`SyncControls` のクラス、`lastSyncedLabel` の欄と読み上げの文への連結、使われなくなった import 8つを消した |
| `contrib/preferences/browser/media/settingsEditor2.css` | `.last-synced-label` の規則を消した |
| `contrib/relauncher/browser/relauncher.contribution.ts` | `IUserDataSyncWorkbenchService` の注入と `onDidTurnOnSync` の購読を消した |
| `contrib/relauncher/test/browser/relauncher.test.ts` | 偽物とコンストラクタの引数を1つ、`Event` の import を外した |
| `contrib/preferences/test/browser/settingsEditor2.test.ts` | `IUserDataSyncWorkbenchService` の stub と import を外した |

`unit.json` の checks で替えた・足したもの

- `absentCommands`: `workbench.userData.actions.openSyncBackupsFolder`・`workbench.userDataSync.actions.downloadSyncActivity`（`contrib/userDataSync/electron-browser/userDataSync.contribution.ts` が条件なしに登録していた2つ）
- `absentViews`: 空
- `absentStrings`: `IUserDataSyncWorkbenchService`（`contrib/preferences`・`contrib/relauncher`）、`SyncControls`・`workbench.userDataSync.actions.turnOn`・`last-synced-label`（`contrib/preferences`）、`onDidTurnOnSync`（`contrib/relauncher`）。5つとも `C:\b\wt\1.146.0` の同じ範囲にある（空振りしない）

## 残した部品と理由

README の「残すもの」と `unit.json` の `kept` が正本。依頼どおり、別案の1は採らず、`contrib/editSessions` には触れていない。

| 部品 | 理由 |
|---|---|
| `services/userDataSync/common/userDataSync.ts` | ID と context key。拡張の画面と `update.ts` が import する |
| `browser/userDataSyncEnablementService.ts` | 拡張の管理・有効と無効・設定の木・再起動の部品が注入する。同期は常に無効と答える |
| `electron-browser/`（共有プロセスへの代理） | 再起動の部品・拡張の管理などが注入する |
| `common/userDataSyncUtil.ts` | プロファイルの設定の資源が注入する |
| `platform/userDataSync` | プロファイル・無視する拡張・同期のログ・共有プロセスの同期のサービス |
| `services/accounts` | 約60ファイルが使う。`vscode.authentication` のサインインの入口 |
| `update.ts` の `accessor.get(IUserDataSyncWorkbenchService)` | デスクトップでは操作が登録されない |
| 再起動の部品の `isTurningOnSyncInProgress()` | 残る2つのサービスだけを読む。常に偽 |
| 条件が常に偽で出ない同期の画面（設定の木の「この設定を同期しない」、拡張の画面のメニュー3つ、設定の目次の「Settings Sync」の節） | 消すか迷ったもの（判断を仰ぐ点の1） |
| 出力のログ「Settings Sync」 | `IUserDataSyncLogService` はプロファイルの部品も使う |

## 注入の照らし

16単位の木（edits.patch を作った木）と20単位の木（確かめ b）で `Grep` した。行の番号は16単位の木のもの。細目は README の「注入の照らし」。

- `@IUserDataSyncWorkbenchService` は 0 件。`get(IUserDataSyncWorkbenchService)` は `update.ts` の1つだけ（上のとおりデスクトップでは呼ばれない）。
- 消したファイルが登録していたサービスは `IUserDataSyncWorkbenchService` だけ（`contrib/userDataSync` に `registerSingleton` が無い。`C:\b\wt\1.146.0` で確かめた）。
- 残る `@IUserDataSync*Service`・`@IUserDataAutoSyncService` の注入は、どれも登録がある（`workbench.desktop.main.ts` の71・72・87行、`workbench.common.main.ts` の97・168行）。
- 消したコマンドを文字列で呼ぶ所は 0 件。
- 共有プロセスの `IUserDataSyncUtilService` の代理（チャンネル `userDataSyncUtil`）は残り、窓の側の登録は無くなる。使うのは同期を始めたときに作られる部品だけで、ストアが無いので作られない（`userDataSyncService.ts` のコンストラクタは同期の部品を作らない）。起動の確かめで、共有プロセスのログにこのチャンネルの誤りが無いことを見る。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest に `sync`・`settingsSync`・`userDataSync` の語は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`）。受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム）には触れていない。
- 台帳のほかの7つの package.json にも、`settingsSync`・`userDataSync` の語は無い。
- 拡張 API（`api/`）には触れていない。`vscode.authentication` は残る。
- notion-sync（`extensions-src/notion-sync/`）に `userDataSync`・`settingsSync` の語は無い。本家の同期の部品を使わないので、影響しない見込み。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）を5回走らせた。誤りは 0 → 8 → 0、確かめ a・b も 0（回ごとの内訳は `typecheck-log.md`）。
- 当て直し a（タグから16単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-6 の `delete` 2つはどちらも消え、`removeLines` 3行はどれも `found: 1`
  - C-6 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - `absentStrings` の C-6 の9項目はどれも `hitCount: 0`
  - 型検査は `ok`、誤り 0（HEAD `1d553956`）
  - `--lockfile-check` は `ok`
- 当て直し b（タグから20単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1〜C-6 の edits はどれも `conflicts: []`
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ
  - 型検査は `ok`、誤り 0（HEAD `81a449ef`）
  - `--lockfile-check` は `ok`
- a・b それぞれの C-6 の ops の commit（`202003f2`・`4a3dd510`）の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-6-settings-sync/edits.patch` が5ファイルとも当たった（行のずれの表示も無い）。5ファイルはほかのどの単位の edits.patch・ops・`patches/` も触れない。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 19.08 GB、終わり 19.07 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-6-settings-sync --checks-out <file>`
   - b: 同じ `--only` の `C-1-ai,` の後に `C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-6-settings-sync].edits` が `{applied: "ok", subject: "unit C-6-settings-sync: edits", conflicts: []}`
     - `units[id=C-6-settings-sync].ops.removeLines` の3行がどれも `found: 1`、`ops.missingDeletes` が `[]`
     - `units[id=C-6-settings-sync].warnings` が `[]`（a・b とも）
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`。C-6 の `absentStrings` の項目が9つで、どれも `hitCount: 0`
     - `units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件（b だけ）
2. **`after` の確かめ**: `--only` から `C-1-ai` を外すと、C-6 の前で止まる（docs/03 の5.1 の2-1）
3. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
4. **3-way に頼らないこと**: a・b の C-6 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-6-settings-sync/edits.patch` が 0 で終わる。
5. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-6-settings-sync: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - edits.patch が触れるのは5ファイルだけ（`contrib/preferences/browser/settingsEditor2.ts`・`contrib/preferences/browser/media/settingsEditor2.css`・`contrib/preferences/test/browser/settingsEditor2.test.ts`・`contrib/relauncher/browser/relauncher.contribution.ts`・`contrib/relauncher/test/browser/relauncher.test.ts`）
   - edits.patch が `workbench.*.main.ts`・`sessions.*.main.ts`・`contrib/editSessions/`・`services/userDataProfile/`・`services/extensionManagement/`・`contrib/update/`・`api/` に触れない
   - `delete` と `kept` に同じパスが無い。`kept` に `services/userDataSync/common/userDataSync.ts`・`browser/userDataSyncEnablementService.ts`・`electron-browser`・`common/userDataSyncUtil.ts`・`platform/userDataSync`・`services/accounts` がある
   - `checks.absentCommands` が上の2つ、`checks.absentViews` が `[]`
6. **当てた後の木**
   - `contrib/userDataSync`・`services/userDataSync/browser/userDataSyncWorkbenchService.ts` が無い
   - `services/userDataSync/common/userDataSync.ts`・`browser/userDataSyncEnablementService.ts`・`electron-browser/userDataSyncService.ts`・`common/userDataSyncUtil.ts` がある
   - `src/vs` で `@IUserDataSyncWorkbenchService` が 0 件。`IUserDataSyncWorkbenchService` の語は `common/userDataSync.ts` と `contrib/update/browser/update.ts` にだけある
   - `settingsEditor2.ts` に `SyncControls`・`lastSyncedLabel`・`IUserDataSync` の語が無い
   - `relauncher.contribution.ts` に `onDidTurnOnSync` が無く、`@IUserDataSyncService`・`@IUserDataSyncEnablementService` はある
   - `src/vs` に `registerChannel('userDataSyncUtil'` が無い
   - `contrib/editSessions` が 1.146.0 と同じ（C-6 で変わらない）
7. **単体テスト**（作業ツリーの中で VS Code のテストの仕組みで走らせる場合。型検査は通るが、走らせていない）
   - `contrib/relauncher/test/browser/relauncher.test.ts`: 7つの試験が、引数を1つ減らしたコンストラクタでそのまま通る見込み
   - `contrib/preferences/test/browser/settingsEditor2.test.ts`: `IUserDataSyncWorkbenchService` の stub が無くても `SettingsEditor2` が作れる
8. **関門の起動の確かめ**（片づけの後）
   - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（特に `IUserDataSyncWorkbenchService`）が無い
   - 設定の画面が開き、右上に「Backup and Sync Settings」が無い。検索・設定の変更・設定の木の右クリックが動く
   - 再起動が要る設定（例 `window.titleBarStyle`）を変えると、再起動を尋ねる
   - プロファイルの作成・切り替え・書き出し、拡張の有効・無効が動く
   - アカウントのメニューと歯車のメニューに同期の項目が無い。アカウントのメニューから拡張の認証（`vscode.authentication`）のサインインはできる
   - `absentCommands` の2つが出ない
   - 共有プロセスのログに `userDataSyncUtil` のチャンネルの誤りが無い
   - notion-sync で設定の同期の往復ができる

## 判断を仰ぐ点（別案）

README の「別案」が正本。

1. **条件が常に偽で出ない同期の画面を残した**（消すか迷ったもの）
   - 対象: 設定の木の「この設定を同期しない」と同期から外した印（`settingsTree.ts`・`settingsEditorSettingIndicators.ts`）、拡張の画面のメニュー3つ（`installAndDonotSync`・`installPrereleaseAndDonotSync`・`toggleIgnoreExtension`）と同期から外した印（`extensionsActions.ts`・`extensionsWidgets.ts`）、設定の目次の「Settings Sync」の節（`settingsLayout.ts`）
   - 採った案: 残す。条件（`IUserDataSyncEnablementService.isEnabled()`・`CONTEXT_SYNC_ENABLEMENT`）は常に偽で出ない。C-5 の `CONTEXT_HAS_GALLERY` の扱い（リーダーの判断で残す）と同じ
   - 別案: 消す。6ファイルのハンクが増え、C-1・C-5 が直す拡張の画面のファイル（`extensions.contribution.ts`・`extensionsActions.ts`）とも重なる
2. **`checks.absentCommands` を5つから2つに替え、`absentViews` を空にした**
   - 下準備の5つ（`turnOn` など）と `workbench.view.sync` は、ストアが無いこのビルドでは C-6 の前から登録されていない。消し損ねても当たらない
   - 替えた2つは、C-6 の前に条件なしに登録されていたコマンド。2026-11-14 の Phase 2 の関門の判断（公式でも登録されないコマンドを checks に挙げない）の当てはめ
   - 別案: 下準備のまま残す（網にならない）
3. **`update.ts` の `accessor.get(IUserDataSyncWorkbenchService)` を直さなかった**
   - デスクトップでは操作が登録されない（Web の埋め込み側の値が要る）。README の下準備の見込みどおり
   - 別案: 操作の中の同期の部分を外す（Web は作らないので、動きは変わらない）

## docs/ との食い違い

- docs/03 の4節の表（136行）の C-6 は「`services/userDataSync` の workbench 側（common・desktop の import 7行）」と書く。実際に消したのは workbench 側のうち `browser/userDataSyncWorkbenchService.ts` だけで、import の行は common 2行・desktop 1行の3行（sessions の2行は C-1 が消す）。ほかの workbench 側のファイルは残る部品が注入するので残した（下準備の README から同じ。C-3〜C-5 と同じく、表の側を直すかはリーダーの判断）。
- docs/03 の4節の表の C-6 は「アカウントのメニュー（`services/accounts`。依存が無ければ）」を消す側に挙げる。依存があったので残した（下準備の README から同じ）。
- docs/03 の4節の末尾（148行）の「型検査に掛からず起動時に壊れる注入が2か所」は、そのとおりだった。

## 未解決の点

- 起動時の注入（DI）の外し損ねと、共有プロセスのチャンネル `userDataSyncUtil` が呼ばれないことは、型検査では見えない。起動の確かめで見る。
- 単体テスト（`relauncher.test.ts`・`settingsEditor2.test.ts`）は走らせていない（許可に無い。曹参の担当）。
- パッケージ化（`vscode-win32-x64-min`）、起動は、片づけの許可の後。
- 許可に無いコマンドで止まった所は、`ls`・`cat` と、`2>&1` を含む形だけ。Glob・Read で代えて済んだ。許可の追加は要らない。誤って作ったファイルは無い。
- SubagentHandback は、フックで止まる見込み（依頼文のとおり）。報告はこのファイル。

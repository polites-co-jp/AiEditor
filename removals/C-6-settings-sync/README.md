# C-6-settings-sync 本家の設定の同期（バックアップと同期）

裁定（2026-11-12、調査の後）: 設定の同期は Notion の設定ページを同期先にする（本家の Settings Sync は使わない）。自前の拡張 `extensions-src/notion-sync/`（docs/05）が担う。

> 状態: 下準備（2026-11-14）。`unit.json` の ops だけを作った。`edits.patch` は型検査を走らせられるようになってから作り、そのときに `unit.json` に `"patch": "edits.patch"` を足す。

## 消すもの

- `src/vs/workbench/contrib/userDataSync`: 「バックアップと同期」の画面（同期のビュー `workbench.view.sync`、衝突のビュー）、コマンド（`workbench.userDataSync.actions.*`。オンにする・オフにする・今すぐ同期・同期したデータを表示・管理など）、アカウントのメニューとグローバルの歯車の「設定の同期」の項目、同期の起動のきっかけ（`userDataSyncTrigger.ts`）、共有プロセスの同期が使う `userDataSyncUtil` のチャンネルの登録（`electron-browser/userDataSyncUtilChannel.contribution.ts`）。
- `src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts`: ワークベンチ側の同期のまとめ役（同期をオンにする手順、アカウントの選択と認証、同期のストアの切り替え）。
- import の行（`removeLines`）: `workbench.common.main.ts` 2行、`workbench.desktop.main.ts` 1行。`sessions.common.main.ts`・`sessions.desktop.main.ts`（`userDataSyncUtilChannel` を直接 import している）の各1行は直さない。C-1 が `src/vs/sessions` を丸ごと消すので、`after` に `C-1-ai` を挙げた。

## 残すもの

- `services/userDataSync` のほかのファイル: `common/userDataSync.ts`（ID と context key）、`browser/userDataSyncEnablementService.ts`（同期が有効かを答える）、`electron-browser/`（共有プロセスへの代理）、`common/userDataSyncUtil.ts`。設定の画面・拡張の管理・拡張の有効と無効・再起動の部品・プロファイルが注入しているので、消すと残す部品へのパッチが大きくなる。product.json に同期のストア（`configurationSync.store`）が無い（1.146.0 で確かめた）ので、同期は常に使えない状態で答える。
- `src/vs/platform/userDataSync`: プロファイル、無視する拡張、同期のログ、共有プロセスの同期のサービス（`sharedProcessMain.ts` の396〜410行・481〜501行）。docs/03 の表の「プロファイルなどが platform/userDataSync を使っている見込み」のとおり使っていた。共有プロセスの同期はストアが無いので動かない。
- `src/vs/workbench/services/accounts`: docs/03 の表の「アカウントのメニュー（`services/accounts`。依存が無ければ）」は、依存があった。`IDefaultAccountService` を拡張の有効・無効、ポリシー（`services/policies`）、GitHub のサービス、アクティビティバーのアカウントのメニュー（`browser/parts/globalCompositeBar.ts`）など約60ファイルが使う。アカウントのメニューは拡張 API の `vscode.authentication`（残す）のサインインの入口でもある。残す。
- 設定 `settingsSync.*` は、同期が有効なときにだけ登録される（`contrib/userDataSync/browser/userDataSync.ts` の125・126行）。このビルドでは元から登録されないので、`absentSettings` に挙げない。

## 型検査で直す点（edits.patch の見込み）

1.146.0 の作業ツリーで `grep` した結果。`contrib/userDataSync` を import している所は、入口の main の行のほかに無かった。`IUserDataSyncWorkbenchService` を使う残る部品は次の3つ（どれも ID は `common/userDataSync.ts` にあるので型検査は通るが、**登録が無くなるので、注入している2つは起動時や画面を開くときに失敗する**。型検査に掛からない）。

| ファイル | 行 | 中身 | 直し方の見込み |
|---|---|---|---|
| `src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts` | 65・285・902 | 設定の画面の「同期をオンにする」の表示の判断に `userDataSyncWorkbenchService.enabled` を使う | 注入をやめ、902行の条件を偽にする（同期のボタンを出さない）。2308行の `SyncControls`（`IUserDataSyncService`・`IUserDataSyncEnablementService` は残る）は 902 行で作られなくなる |
| `src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts` | 24・115・123 | 同期がオンになったら再起動の要否を見直す | 注入と123行の購読を消す |
| `src/vs/workbench/contrib/update/browser/update.ts` | 30・397・437 | 品質（stable/insiders）を切り替える操作の中で同期のストアの種類を合わせる | 直さない見込み。この操作は `precondition: IsWebContext`（382〜387行）で Web だけに出る。実行時に `accessor.get` するだけなので、デスクトップでは呼ばれず、ID は残るので型検査も通る |
| テスト | — | `contrib/userDataSync/test/electron-browser/userDataSyncUtilChannel.test.ts` はフォルダごと消える。ほかに `IUserDataSyncWorkbenchService` を組み立てるテストが無いかを型検査で見る | — |

- `src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts`（Web の入口 `browser/web.main.ts` の90行が使う）は残す。
- 共有プロセスの `IUserDataSyncUtilService`（`sharedProcessMain.ts` の399行）は、消すチャンネル `userDataSyncUtil` への代理。同期が動くとき（設定・キー割り当ての同期）にだけ呼ばれる。ストアが無いので呼ばれない見込み。

## 影響しうるもの

- アカウントのメニューと歯車のメニューから「設定の同期をオンにする」「バックアップと同期」が消える。もともとストアが無いので、本家の OSS のビルドでも同期は使えない状態だった（画面の項目だけがあった）。
- Notion への同期（notion-sync）は本家の同期の部品を使わない（拡張 API だけを使う）ので影響しない見込み。スモークで設定の同期の往復を見る。

## 壊れたときの症状と戻し方

- 設定の画面が開かない、または起動時に `IUserDataSyncWorkbenchService` が見つからない誤り: 上の表の注入の直しが漏れている。`enabled: false` に戻す。

## 別案（リーダーの判断を仰ぐ）

1. 残した同期の状態のサービス（`userDataSyncEnablementService.ts`・`electron-browser/` の代理）と共有プロセスの同期のサービスも、何もしない実装に差し替える。共有プロセスの起動時に作られる `UserDataAutoSyncService`（`sharedProcessMain.ts` の498行）などが無くなる。拡張の管理・設定の画面の注入を何もしない実装で受けることになり、edits.patch は大きくなる。
2. 「続きの編集」（`contrib/editSessions`。同期のストアを使うクラウドの変更の保存）も同じ仕組みで、ストアが無いので動かない。裁定に挙がっていない機能なので、消すならユーザーの確認を経て単位を足す（docs/03 の4節の末尾）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。
- 起動時に `IUserDataSyncWorkbenchService` を注入する部品が上の3つのほかに無いか（`grep '@IUserDataSyncWorkbenchService'` と `get(IUserDataSyncWorkbenchService)` で見た範囲では無い）。

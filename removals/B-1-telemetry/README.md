# B-1-telemetry テレメトリ

裁定（2026-11-12）: テレメトリは、送り先と鍵を入れず、送信を担う部品を何もしない実装に差し替える。

## 消すもの

- **差し替え**（`edits.patch`）: `src/vs/platform/telemetry/{common,browser,node}/1dsAppender.ts`。名前・型・コンストラクターの引数はそのまま残し、中身を「何もしない」にした。送り先 `https://mobile.events.data.microsoft.com/OneCollector/1.0` と `/ping`（1.146.0 の `common/1dsAppender.ts` 22・23行）、1DS の SDK の読み込み、Node 側の `https` の直の送信がすべて無くなる。
- **削除**（`delete`）:
  - `src/vs/workbench/contrib/telemetry`（起動時・設定の変更などのイベントを送る contrib。`workbench.action.showTelemetry` のコマンド）
  - `src/vs/workbench/contrib/bracketPairColorizer2Telemetry`（古い拡張の利用を数えるだけ）
  - `src/vs/workbench/contrib/terminalContrib/telemetry`（ターミナルのシェルの種類やプロファイルの設定を数えて送る。テストを含む。2026-11-14 リーダーの指示で足した。import は `src/vs/workbench/contrib/terminal/terminal.all.ts` の1行だけ）
  - `src/vs/workbench/contrib/editTelemetry` のうち、下の「残すもの」の1ファイルを除く全部（編集の統計、AI の編集の統計、ステータスバーの表示、設定 `telemetry.editStats.*`・`editor.aiStats.enabled`）
  - テスト `src/vs/platform/telemetry/test/browser/1dsAppender.test.ts`（1DS の型を import するため）と、部品の見本 `src/vs/workbench/test/browser/componentFixtures/aiStats.fixture.ts`（消した editStats を import するため）
- **依存**（`removeDependencies`）: `@microsoft/1ds-core-js`・`@microsoft/1ds-post-js` を `package.json`・`remote/package.json`・`remote/web/package.json` から。
- **import の行**（`removeLines`）: `workbench.common.main.ts` の3行、`sessions.common.main.ts` の2行（Agents の画面の入口。型検査に含まれるので消す）、`terminal.all.ts` の1行。

## 残すもの

- `src/vs/workbench/contrib/editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.ts`: サービスの ID `IAiEditTelemetryService` を、拡張 API の `src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts`（40行）と chat の約10ファイルが注入している。`edits.patch` でこのファイルに何もしない実装（`NullAiEditTelemetryService`）を足して登録する。chat は C-1 で消える。
- テレメトリのサービス（`ITelemetryService`）と、それを呼ぶ側のすべて（裁定どおり）。OSS の product.json には `enableTelemetry` も `aiConfig` も無いので、もともと画面側の送り手は `NullTelemetryService` になる（`tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md` の1.2）。この単位はそのうえで、鍵を直書きしている送り手（`src/vs/platform/agentHost/node/agentHostMicrosoftTelemetry.ts` の `INTERNAL_LARGE_STORAGE_ARIA_KEY`）も含めて、1DS の送り手を空にする。
- `eslint.config.js`・`build/.webignore` の 1DS の名前（どちらも当たらなくても害が無い。パッチを増やさないため触らない）。

## 影響しうるもの

- `src/vs/code/node/cliProcessMain.ts`・`src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`・`src/vs/server/node/serverServices.ts`・`src/vs/platform/agentHost/node/*`・`src/vs/workbench/contrib/debug/node/telemetryApp.ts`・`src/vs/workbench/services/telemetry/browser/telemetryService.ts` が `OneDataSystemAppender`／`OneDataSystemWebAppender` を作る。引数は同じなので呼ぶ側は変えない。
- 拡張の `vscode.env.isTelemetryEnabled` は今も false（product.json に `enableTelemetry` が無いため）。変わらない。
- 設定 `telemetry.editStats.*`・`editor.aiStats.enabled` が設定の画面から消える。

## 壊れたときの症状と戻し方

- 起動時に `IAiEditTelemetryService` が見つからない誤り（`[createInstance] ... depends on UNKNOWN service aiEditTelemetryService`）が出たら、残したファイルの登録が読み込まれていない。`unit.json` の `enabled` を `false` に戻してビルドし直す。
- 型検査で `1dsAppender` の呼び出し側の引数の誤りが出たら、本家がコンストラクターを変えた。差し替えのファイルを本家の新しい引数に合わせ、`edits.patch` を作り直す（docs/03 の5.2）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか（`compile`）。とくに、`noUnusedLocals` のもとで差し替えの3ファイルが通るか、`aiEditTelemetryService.ts` の `EditSuggestionId.newId()` の呼び出し。
- 依存の削除の後の `pnpm install`（ロックファイルの作り直し）が通るか。`remote/` と `remote/web/` は自前のビルドでは使わないが、型検査と postinstall が触る。
- 自作のビルドの通信の監査で `mobile.events.data.microsoft.com` が出ないこと（`absentHosts`）。

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
- **コマンドの ID 3つ**（2026-11-14 の関門の不合格の直し。`records/take-in/1.146.0-p2-B-1/gate-B-1-telemetry.md` の4節）: `_aiEdits.hasAiContributions`・`_aiEdits.clearAiContributions`・`_aiEdits.clearAllAiContributions`。残る git の拡張（`extensions/git/src/repository.ts` の 1349・1433・1502・1629 行で clear、2318・2328・2363 行で clearAll、1543 行で has）が、ステージ・取り消し・コミットなどで呼ぶ。1.146.0 では、消した `editTelemetryContribution.ts` の 57〜59 行が「何もしない代わり」を、`aiContributionFeature.ts` の 58〜68 行が本物を登録していた。消したままだと、git の操作のたびに `Error: command '_aiEdits.clearAiContributions' not found` がレンダラーと拡張ホストのログに出る（呼ぶだけで結果を待たないので、git の操作そのものは通る）。
  - `edits.patch` で、上のファイルの末尾に、本家の「何もしない代わり」と同じ中身（has は `false`、clear と clearAll は何もしない）を `CommandsRegistry.registerCommand` で登録する。このファイルは拡張 API（`mainThreadLanguageFeatures.ts`）が import するので、本体の束に必ず入る。新しいファイルにしないのは、それを読み込ませる import の行を `workbench.common.main.ts` に足す必要があり、5.3 の規則（共有のファイルはパッチに入れない）に触れるため。
  - 結果: git の設定 `git.addAICoAuthor` を on にしても、コミットのメッセージに AI の共著者の行は付かない（AI の編集を数える部品が無いため。本家でも AI が無効のときは同じ振る舞い）。
  - `checks` に「このコマンドが**在る**」ことを書く形は無い（`checks` の項目は `absent*` だけで、`tests/removals.test.mjs` は知らない項目を誤りにする）。在ることは、関門の4（スモークの `errors.new`）で、git のコミットの後に `command '_aiEdits.…' not found` が出ないことで確かめる。静的には、出力の `out\vs\workbench\workbench.desktop.main.js` に `_aiEdits.clearAiContributions` の文字列があることで見られる。
- テレメトリのサービス（`ITelemetryService`）と、それを呼ぶ側のすべて（裁定どおり）。OSS の product.json には `enableTelemetry` も `aiConfig` も無いので、もともと画面側の送り手は `NullTelemetryService` になる（`tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md` の1.2）。この単位はそのうえで、鍵を直書きしている送り手（`src/vs/platform/agentHost/node/agentHostMicrosoftTelemetry.ts` の `INTERNAL_LARGE_STORAGE_ARIA_KEY`）も含めて、1DS の送り手を空にする。
- `eslint.config.js`・`build/.webignore` の 1DS の名前（どちらも当たらなくても害が無い。パッチを増やさないため触らない）。

## 消えたことの確かめ方（checks）

- **absentCommands は空にした**（2026-11-14、蒙恬。リーダーの指示で網を選び直した）。前は `workbench.action.showTelemetry` を挙げていたが、公式の zip（`C:\b\p0\vscode-1.146.0`）でも、実行時の一覧にも manifest にも無く、網にならなかった（`tasks/2026-11-14-fix-absent-probe/handoff-notes.md`）。
  - 理由: このコマンドは `contrib/telemetry/browser/telemetry.contribution.ts` の152行で `supportsTelemetry(productService, environmentService)` が真のときだけ登録される（236〜257行）。`supportsTelemetry`（`platform/telemetry/common/telemetryUtils.ts` の96〜102行）は、ビルドした版では `--disable-telemetry` があると偽を返す。検査の台本（`tests/removals/run-absent.mjs` の90行）とスモーク（`tests/smoke/lib/run.mjs`）は `--disable-telemetry` を付けて起動するので、公式でも登録されない。
  - 替えの候補を探したが無かった。この単位が消す部品が登録するコマンドは、ほかに次だけ: `editTelemetry.toggleDebugDecorations`（設定 `telemetry.editStats.showDecorations` が on で、テレメトリが有効なときだけ。既定で登録されない）、`_aiEdits.*` の3つ（下の「残すもの」のとおり、わざと残すので「無い」の網にできない）。`contrib/bracketPairColorizer2Telemetry`・`terminalContrib/telemetry` はコマンドを登録しない。ビュー（absentViews）も無い。
  - 公式で `workbench.action.showTelemetry` を網にするには、検査の台本が公式を `--disable-telemetry` なしで起動する必要がある（曹参の範囲。別案としてリーダーに挙げた）。
- 網になっているもの: absentSettings の2件（公式で在る）、absentStrings（ソースの参照の残り）、absentHosts（通信の監査）。

## 影響しうるもの

- `src/vs/code/node/cliProcessMain.ts`・`src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`・`src/vs/server/node/serverServices.ts`・`src/vs/platform/agentHost/node/*`・`src/vs/workbench/contrib/debug/node/telemetryApp.ts`・`src/vs/workbench/services/telemetry/browser/telemetryService.ts` が `OneDataSystemAppender`／`OneDataSystemWebAppender` を作る。引数は同じなので呼ぶ側は変えない。
- 拡張の `vscode.env.isTelemetryEnabled` は今も false（product.json に `enableTelemetry` が無いため）。変わらない。
- 設定 `telemetry.editStats.*`・`editor.aiStats.enabled` が設定の画面から消える。
- エージェントのホスト（`src/vs/platform/agentHost`。C-1 で消える）は、設定 `telemetry.editStats.enabled` をホストの設定 `editTelemetryEnabled` に写してもらっていた（消した `editTelemetry.contribution.ts` の36行の `agentHost`）。写す元が無くなるので、ホストの側は既定（`!== false` で有効）のまま、編集の記録を作る（`agentService.ts` の1652行、`node/shared/editArcReporter.ts` の251行）。送る先はテレメトリのサービスで、そこから先の 1DS の送り手はこの単位が空にしているので、外へは出ない（推定。ソースを読んだだけ）。
- 消した部品が登録していた、ほかの ID: `workbench.action.showTelemetry`（`checks` の absentCommands）、`editTelemetry.toggleDebugDecorations`（消した `editSourceTrackingFeature.ts` の中だけで使う）、`aiStats.statusBar.settings`（消したステータスバーの中だけ）、サービス `IRandomService`（`contrib/editTelemetry` の中だけで注入）。1.146.0 の `src/` と `extensions/` で、残る部品からの呼び出しは、上の `_aiEdits.*` のほかに見つからなかった（2026-11-14、蒙恬。`grep` で確かめた）。

## 壊れたときの症状と戻し方

- 拡張ホストかレンダラーのログに `command '_aiEdits.…' not found` が出たら、`aiEditTelemetryService.ts` の末尾のコマンドの登録が抜けている（本家がこのファイルを改めた、または `edits.patch` を作り直したときに落とした）。本家が git の拡張から別の `_aiEdits.*` を呼ぶようにしたときも同じ症状になる。`extensions/git/src/repository.ts` の `_aiEdits.` を数え直し、登録を足す。
- 起動時に `IAiEditTelemetryService` が見つからない誤り（`[createInstance] ... depends on UNKNOWN service aiEditTelemetryService`）が出たら、残したファイルの登録が読み込まれていない。`unit.json` の `enabled` を `false` に戻してビルドし直す。
- 型検査で `1dsAppender` の呼び出し側の引数の誤りが出たら、本家がコンストラクターを変えた。差し替えのファイルを本家の新しい引数に合わせ、`edits.patch` を作り直す（docs/03 の5.2）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか（`compile`）。とくに、`noUnusedLocals` のもとで差し替えの3ファイルが通るか、`aiEditTelemetryService.ts` の `EditSuggestionId.newId()` の呼び出し。
- 依存の削除の後の `pnpm install`（ロックファイルの作り直し）が通るか。`remote/` と `remote/web/` は自前のビルドでは使わないが、型検査と postinstall が触る。
- 自作のビルドの通信の監査で `mobile.events.data.microsoft.com` が出ないこと（`absentHosts`）。

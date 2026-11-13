# B-2-onboarding-experiments-surveys 歓迎画面・実験・アンケート

## 消すもの

- `src/vs/workbench/contrib/welcomeGettingStarted`: 歓迎画面（Welcome）、拡張のウォークスルー（`walkthroughs` の受け手）、起動時のエディタの設定 `workbench.startupEditor`、`workbench.welcomePage.*` の設定。
- `src/vs/workbench/contrib/welcomeWalkthrough`: エディタの対話式の練習場（Interactive Playground）。
- `src/vs/workbench/contrib/welcomeOnboarding`: 2026 年版の初回案内（キー割り当て・テーマの選択）。product.json の `onboardingKeymaps`・`onboardingThemes` を読むのはここだけ（ソースを検索して確かめた）なので、この2つのキーも消す（`productRemove`）。
- `src/vs/workbench/contrib/surveys`: NPS・言語ごとのアンケート・アンケートの画面。
- import の行（`removeLines`）: `workbench.common.main.ts` の5行、`workbench.desktop.main.ts`・`workbench.web.main.ts`・`sessions.desktop.main.ts`・`sessions.web.main.ts` の各1行（アンケート）、部品の見本（`src/vs/workbench/test/browser/componentFixtures/`）の3行（消したフォルダの色と CSS を読むため。型検査の `noUncheckedSideEffectImports` に掛かる）。
- **差し替え**（`edits.patch`）: 実験のサービス。`src/vs/workbench/services/assignment/common/noopAssignmentService.ts`（新しいファイル）に、割り当てを取りに行かない実装 `NoopWorkbenchAssignmentService` を置き、`assignmentService.ts` の末尾の登録の1行をこちらに替える。すべての実験の値は「割り当てなし」になり、呼ぶ側は既定の動きになる。実験の設定の取得（`default.exp-tas.com`）と、実験のテレメトリが無くなる。
- `edits.patch` はほかに `src/vs/workbench/contrib/remote/browser/remote.ts` を直す。リモートの「ヘルプ」のビューが、消したウォークスルーのサービス（`IWalkthroughsService`）を注入していたため。ウォークスルーの ID で書かれたヘルプの項目は URL が空になる（リモートは C-3 で消える）。

## 残すもの

- `src/vs/workbench/contrib/onboarding`（docs/03 の表では消す側に入っている）: 案内の枠組み（スポットライト・ツアー・お試しの窓）。残る部品が import している: `contrib/update`（リリースノートのお試し）、`contrib/codeEditor/browser/diffEditorTryout.contribution.ts`、`contrib/sessionChanges/browser/changesView.ts`。ほかに chat・sessions の約70ファイル（C-1）。消すと残す部品へのパッチが大きくなり、5.3 の「自分の単位が消した部品への参照だけを直す」の範囲も越えるので、この単位では残す。C-1 で chat と一緒に消すかを決める案を `tasks/2026-11-13-p2-units-b/doc-corrections.md` に書いた。
- `src/vs/workbench/contrib/welcomeViews`: エクスプローラーの「フォルダーを開く」などの案内（docs/03 の表のとおり）。
- `src/vs/workbench/services/assignment` のファイル: サービスの ID を約40ファイルが注入している。TAS の実装のクラス `WorkbenchAssignmentService` はファイルに残るが、登録しないので作られない。ファイルごと書き換えると本家の変更のたびに衝突するので、登録の1行だけを替えた。依存 `tas-client` は `platform/assignment/common/assignment.ts` などが型を import しているので残す。

## 影響しうるもの

- Claude Code 拡張は manifest に `walkthroughs` を持つ（docs/03 の9節）。受け手が無くなるので、拡張ホストのログに「知らない contributes」の警告が出るかをスモークで見る。拡張の動作には要らない見込み（推定）。
- `mydist` の既定の `workbench.startupEditor: none` は、設定が登録されなくなるので効き目が無くなる（歓迎画面そのものが無い）。設定の画面での警告の有無を見る。docs/04 の6.1 の「B-2 の後に要否を見る」に当たる。
- 「ヘルプ」メニューの「ようこそ」「ウォークスルー」が消える。ほかの部品がコマンド ID（`workbench.action.openWalkthrough` など）を文字列で実行している箇所（`helpActions.ts` など）は、実行すると「コマンドが見つからない」になる。型検査には掛からない。

## 壊れたときの症状と戻し方

- 起動時に `assignmentService` が見つからない誤りが出たら、`noopAssignmentService.ts` の登録が読まれていない。`enabled: false` に戻してビルドし直す。
- 本家が `assignmentService.ts` の末尾の `registerSingleton(IWorkbenchAssignmentService, WorkbenchAssignmentService, ...)` を変えたら `edits.patch` が当たらない。その行を新しい形に合わせて作り直す（docs/03 の5.2）。

## 未確認（型検査とビルドで確かめる）

- 型検査が通るか。とくに `assignmentService.ts` の末尾に置いた `import` の行（ES の import は先頭でなくてもよいが、本家の lint の規則に掛かるかは未確認）と、`noopAssignmentService.ts` の `import type` での循環。
- 消した4つのフォルダを、上に挙げたほかに import している所が無いか（`grep` では見つからなかった）。
- `build/next/resources.ts` に `welcomeGettingStarted`・`welcomeOnboarding` の画像の glob がある。一致するファイルが無くなっても build が止まらないかをビルドで見る。
- `build/lib/i18n.resources.json` に消したフォルダの名前がある（翻訳の書き出し用。自前のビルドでは使わない見込み）。

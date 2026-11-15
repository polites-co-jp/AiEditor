# Phase 5 の下ごしらえ（C-3 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない。

## 成果物

- `removals/C-3-remote/edits.patch`（新規）
  - 1ファイル、5行の追加、1行の削除
  - 件名は `unit C-3-remote: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `582bd5eb`
- `removals/C-3-remote/unit.json`（直した）: `"patch": "edits.patch"` を足しただけ。`enabled` は `false` のまま。`delete`・`removeLines`・`productRemove`・`kept`・`checks` は下準備のまま
- `removals/C-3-remote/README.md`（直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「edits.patch で直した点（2026-11-15）」（中に「ほかの単位と独立に保つ形」「build/ の型」）、「Claude Code と台帳の拡張への影響」
  - 直した節: 「影響しうるもの」（残す部品が読む `remote.*` の設定）、「未確認」
- `tasks/2026-11-15-p5-c3-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、build/ の型検査、gulp のタスクの一覧、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c3-patch/trial/`
  - 適用の検査3つ: `checks-ops.json`・`checks-verify-a.json`・`checks-verify-b.json`。verify の2つにはロックファイルの検査も追記した
  - 型検査の記録4つ: `build-typecheck-{1,2,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
- `tasks/2026-11-15-p5-c3-patch/disk-start.json`・`disk-end.json`
- `scripts/`・`removals/C-1-ai/`・`removals/C-2-debug/` は変えていない

## 要点

1. A・B の14単位と C-1 と C-3 の ops の上で、型検査の誤りは 1 → 0。1件は README の見込みどおり、`viewsExtensionPoint.ts` の `remoteExplorer.js` の import だった。
2. 直し方は、import を消して同じ値の定数 `const REMOTE = 'workbench.view.remote';` を置く形。拡張 API には触れず、`extHostRemovedApi.remote.ts` も作っていない（要らなかった）。
3. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。
   - a: 16単位
   - b: 17単位。C-2 を挟む
4. C-3 のパッチが触るファイルは、ほかのどの単位のパッチも触らない。b でも行のずれすら無く当たり、`removeLines` に回すものは無かった。
5. 判断を仰ぐ点が2つある（下）。`productRemove` で build/ の台本に型の誤りが6件出るが、実行時には止まらないので直していない。

## 直した点

一覧の正本は `removals/C-3-remote/README.md` の「edits.patch で直した点（2026-11-15）」。

| ファイル | 直し方 |
|---|---|
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | `import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';` を消した。import の並びの後に `const REMOTE = 'workbench.view.remote';` を置いた。コメントは `// Shuko (C-3-remote): ...`。値は本家 1.146.0 の `remoteExplorer.ts` の42行と同じ。使う所（525・536・632行の `canMoveView`・`workspace`・`getViewContainer('remote')`）は変えていない |

- 拡張が `viewsContainers`/`views` の `remote` に足すビューは、コンテナーが無いので既存の扱いになる。`ViewContainerDoesnotExist` の警告を出して、エクスプローラーに置く（464〜468行を読んで確かめた）。
- `unit.json` は `"patch"` の1行だけを足した。

## 残した部品と理由

前からの決まり（README の「残すもの」と `unit.json` の `kept`）から変えていない。依頼どおり、別案の1・2は採っていない。

| 部品 | 理由 |
|---|---|
| `services/remote`（`remoteExplorerService.ts`・`tunnelModel.ts` を含む） | ローカルの拡張ホストの部品（`extensionService.ts`・`nativeExtensionService.ts`）が `IRemoteExplorerService` を注入する。`IRemoteAgentService` も多くの部品が使う |
| `services/tunnel` | Webview（Claude Code のパネル）の `webviewElement.ts`、`electron-browser/window.ts`（外部の URI の解決）、ターミナルのリンクが `ITunnelService` を注入する。ローカルでは `canTunnel` が偽で、何もしない |
| `platform/remote`（`sharedProcessTunnelService.ts` を含む）・`platform/tunnel` | 上の2つが使う |
| `api/browser/mainThreadTunnelService.ts`・`api/common/extHostTunnelService.ts` | 拡張 API の `workspace.openTunnel`・`registerPortAttributesProvider` の入口。そのまま残るので、何もしない実装は要らない |
| `remote/`・`src/vs/server`・`src/server-*.ts` | デスクトップの zip に入らない。消すにはビルドの道具への変更が要る（別案2） |
| `build/gulpfile.vscode.ts` の `esbuild-vscode-reh-min`・`esbuild-vscode-reh-web-min` の定義（72・73行） | 呼ぶ所は消えた `gulpfile.reh.ts` だけで、`vscode-win32-x64-min` からは呼ばれない。消さなくても動きは変わらない（判断を仰ぐ点の2） |

消すか迷って残したものは、上の最後の行だけ。

## Claude Code と台帳の拡張への影響

- Claude Code（2.1.322）の manifest に、`remote` のビューのコンテナー、`resolvers`・`remoteHelp`、`onResolveRemoteAuthority`・`onTunnel`、`extensionKind` は無い（`C:\b\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\package.json` を `Grep`）。
- Claude Code の受け手は消していない。
  - Webview が注入する `ITunnelService`・`ISharedProcessTunnelService`・`platform/tunnel` は残る。
  - `vscode.env.asExternalUri`（`electron-browser/window.ts`）も残る部品だけを通る。ローカルの窓では URI がそのまま返る（本家と同じ）。
  - セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステムには触れていない。
- 台帳のほかの7つの package.json にも、上の項目は無い。
  - `tomoki1207.pdf` だけが `extensionKind` を持つ。これは manifest の項目で、リモートの窓で拡張をどちら側に置くかの指定。ローカルだけの窓では効かない。
- 日本語の言語パックの `contrib/remote`・`remoteTunnel` の訳は、読み手が無くなるだけ。
- 圧縮されたコードの中で `vscode.workspace.openTunnel` などを呼んでいても、API の実装は残っているので、本家と同じ振る舞いになる。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）を4回走らせた。2回目で誤り 0（回ごとの数は `typecheck-log.md`）。
- build/ の型検査（`npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json`）は7件。
  - 1件は A-3 から来る、前からのもの
  - 6件は C-3 の `productRemove` から来る型だけの誤り（判断を仰ぐ点の1）
- `pnpm --dir C:/b/wt/p2 run gulp --tasks-simple`: 誤りなく読み込めた。`vscode-win32-x64-min` は残り、`vscode-reh-*` は無い。
- 当て直し a（タグから16単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-3 の ops の `removeLines` 13行はどれも `found: 1`、`productRemoved` は9つ
  - C-3 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - 型検査は `ok`、誤り 0（HEAD `091c9aaf`）
  - `--lockfile-check` は `ok`。差分は削除だけで、C-1 の分と同じ
- 当て直し b（タグから17単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1・C-2・C-3 の edits はどれも `conflicts: []`
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts` が本家に無い）だけ
  - 型検査は `ok`、誤り 0（HEAD `91ef66ca`）
  - `--lockfile-check` は `ok`
- b の C-3 の ops の commit（`7285c8bc`）の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-3-remote/edits.patch` が当たった（行のずれも無い）。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 19.42 GB、終わり 19.19 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-3-remote --checks-out <file>`
   - b: 同じ `--only` の `C-1-ai,` の後に `C-2-debug,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-3-remote].edits` が `{applied: "ok", subject: "unit C-3-remote: edits", conflicts: []}`
     - `units[id=C-3-remote].ops.removeLines` の13行がどれも `found: 1`、`ops.productRemoved` が9つ、`ops.productMissing` が `[]`
     - `units[id=C-3-remote].warnings` が `[]`（a・b とも）
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`
     - b だけ、`units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件
2. **C-1 を外すと止まること**（`after` の確かめ）: `--only` から `C-1-ai` を外すと、C-3 の前で止まる（docs/03 の5.1 の2-1）
3. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
4. **3-way に頼らないこと**: b の C-3 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-3-remote/edits.patch` が 0 で終わる。
5. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `removals/C-3-remote/unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-3-remote: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - edits.patch が触るファイルは `src/vs/workbench/api/browser/viewsExtensionPoint.ts` の1つだけ
   - edits.patch が `workbench.*.main.ts`・`sharedProcessMain.ts`・`extHost.api.impl.ts`・`extHost.protocol.ts` に触れない
   - C-3 の edits.patch が触るファイルを、ほかの単位の edits.patch（C-1・C-2、A・B）が触らない（5.3）
   - `delete` と `kept` に同じパスが無い。`kept` に `services/tunnel`・`services/remote`・`platform/remote`・`platform/tunnel` がある
6. **当てた後の木**
   - `src/vs/workbench/contrib/remote`・`contrib/remoteTunnel`・`platform/remoteTunnel`・`build/gulpfile.reh.ts` が無い
   - `src/vs/workbench/services/tunnel`・`services/remote/common/remoteExplorerService.ts`・`platform/remote/electron-browser/sharedProcessTunnelService.ts`・`api/browser/mainThreadTunnelService.ts` がある
   - `viewsExtensionPoint.ts` に `const REMOTE = 'workbench.view.remote';` がちょうど1行あり、`contrib/remote/` の文字列が import に無い
   - `sharedProcessMain.ts` に `remoteTunnel` の語が無い
   - 作業ツリーの `product.json` に、`productRemove` の9つのキーが無い
7. **関門の起動の確かめ**（片づけの後）
   - 起動時の開発者ツールのコンソールに、`depends on UNKNOWN service`（`tunnelService`・`remoteExplorerService`・`remoteTunnelService`）が無い。共有プロセスのログに `remoteTunnel` のチャンネルの誤りが無い
   - 状態表示の左端の「><」、リモートエクスプローラー、「ポート」のビュー、「リモート トンネル アクセス」が無い（`checks` の `absentCommands`・`absentViews`・`absentSettings`）
   - Claude Code のパネル（Webview）が開き、ログインの外部 URI が開く。Claude Code の差分とコメントが動く
   - ターミナルの `http://localhost:<port>` のリンクを開ける（`ITunnelService` を通る所）

## 判断を仰ぐ点（別案）

1. **build/ の台本の型の誤り6件を直していない**（`productRemove` から来る）
   - 採った案: 直さない。実行時は止まらず、関門の型検査（`typecheck-client`）の外。A-3 の前からの1件と同じ扱い。README の「build/ の型」に書いた
   - 別案: edits.patch で型を広げる（例: `(product as typeof product & { serverDataFolderName?: string })`。`gulpfile.vscode.win32.ts` の74行に本家の同じ書き方がある）。`gulpfile.vscode.ts` は C-1 も直すので、C-1 の hunk と文脈が重ならないことを確かめる必要がある。win32 のインストーラーと Linux の2ファイルは、このビルドでは使わない
2. **`gulpfile.vscode.ts` の `esbuild-vscode-reh-min`・`esbuild-vscode-reh-web-min` の定義（72・73行）を残した**（消すか迷ったもの）
   - 呼ぶ所が無くなるだけで、動きは変わらない。消すと C-1 が直すファイルに触れる
   - 別案: edits.patch で2行を消す（C-1 の hunk との重なりを確かめてから）

## docs/ との食い違い

- docs/03 の4節の表（133行）の C-3 は「`contrib/remote`（common の2行、desktop の1行）」と書く。実際の `removeLines` は、common が2行、desktop が3行（`contrib/remote` の1行に加えて、`contrib/remoteTunnel` と `platform/remoteTunnel` のサービスの import）、web が1行、`sharedProcessMain.ts` が7行。下準備のときからの数で、README の「消すもの」は実際の数を書いている。
- 同じ表は `services/tunnel`・`sharedProcessTunnelService.ts`・`remoteExplorerService.ts` を消す側に挙げる。4節の末尾（145行）の「C-3 は残す」と、実装は後者に合わせた（前からの食い違い。表の側を直すかはリーダーの判断）。

## 未解決の点

- 起動時の注入（DI）の外し損ねは、型検査では見えない。起動の確かめで見る（特に共有プロセスの `remoteTunnel` のチャンネルを外したこと）。
- パッケージ化（`vscode-win32-x64-min`）、依存の導入（`remote/` が入り続けること）、起動は、片づけの許可の後。
- 許可に無いコマンドで止まった所は無い。誤って作ったファイルも無い。

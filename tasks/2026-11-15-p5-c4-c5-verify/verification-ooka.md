# 検証の記録: C-4（2回目）・C-5 の edits.patch と検査・テスト（パッケージ化の前まで）

大岡越前守から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 判定

| 単位 | パッケージ化の前まで | 理由の要点 |
|---|---|---|
| C-4-notebook（2回目） | **合格** | 1回目の直す点（`notebookControllerAffinityHidden` の門）は直った。門は本家と同じ7つ。テストも門の期待を本家から読む形になった。軽微な指摘が3つある（直さなくても合否に響かない） |
| C-5-extension-gallery | **合格** | 直す点なし。何もしないギャラリーは通信の口を持たず、CLI の `--install-extension` の道に触れない。画面からの導入（右クリック・ドロップ・`ext install `・「VSIX からインストール」）は消えた |

関門の合否は出していない。

| brief の項 | 結果 |
|---|---|
| 1. 差分のレビュー | C-4・C-5 とも直す点なし。C-4 に軽微な指摘が3つ |
| 2. 19単位の組（A・B の14と C-1〜C-5） | 自分で実行。`result: ok`。`c5-check-json`（当て直し・型検査）・`c5-check-worktree`・`c4-check-worktree` は「期待どおり」。`c1`〜`c3` の作業ツリーの照らし役も「期待どおり」。型検査は誤り 0 |
| 2. `after` の止まり | C-5 から C-1 を外す組を自分で実行。「期待どおり」 |
| 2. ほかの組 | 走らせていない（組の間でタグに戻す許可が無い）。蒙恬の記録を照らした（C-4 の a・b、C-5 の a・b。4つとも期待どおり） |
| 2. ロックファイル・`git apply --check` | 走らせていない（許可に無い）。蒙恬の記録のロックファイルの検査を読んだ（4つとも `ok`） |
| 3. run-all | tests 2448、pass 2439、fail 2、skip 7。落ちた2本は C-1 の分だけ（下の3節）。C-2〜C-7 は fail 0 |
| 4. 合否 | 上の表 |

## 確かめた成果と、読んだときの sha256

- 蒙恬
  - C-4 の2回目: `removals/C-4-notebook/edits.patch`（25ファイル、新規1。From `21079a10`）。`unit.json` は1回目と同じ
  - C-5 の2回目: `removals/C-5-extension-gallery/edits.patch`（11ファイル、新規2。From `cd9cf41d`）・`unit.json`
- 曹参
  - C-4 の2回目: `tests/c4-unit.test.mjs`・`c4-mutation.test.mjs`、共通の部品 `tests/gate-members.mjs`
  - C-5: `tests/c5-*`、台本 `tests/removals/c5-gate-script.md`

| ファイル | sha256 |
|---|---|
| `removals/C-4-notebook/edits.patch` | `8fa39c078ad3e89a7f3973111aa58f1e7d984816fa283791dbc9b2735f5b05e3` |
| `removals/C-4-notebook/unit.json` | `29437ab5005e587396ee92f6514c813b009c781d1cf57faadc7353f2a0e6f6d7`（1回目の検証と同じ） |
| `removals/C-5-extension-gallery/edits.patch` | `c14d66e33cf274fb5f040a89b511a38f353b2544c779f43639332550b29bb651` |
| `removals/C-5-extension-gallery/unit.json` | `073211fc403ce512fcb753b8c95d11d2d992287301ff8e7ff0c56afba6e64d40` |
| `removals/C-1-ai/edits.patch` | `ad37d796ff81743deb78ed4ab025c50b7301721bd590f1562fb9895f1d38fb6d`（C-1 の6回目の分。C-1 の検証は別に行う） |
| `tests/c4-unit.test.mjs` | `de09f50e64bffca97faca11bc888c9eeb0e01b441596212f4a28c374887855b3` |
| `tests/c4-mutation.test.mjs` | `99f26912340c6980def81946582bb35da1069c2f51871b6dadeeec5cc9912236` |
| `tests/c4-check-json.mjs` | `6217b0f6a66d31595ada6edb653b089bdc2b3f191c5e439c44bbdd91ca074c3e`（1回目と同じ） |
| `tests/c4-check-worktree.mjs` | `ba87212ddc583bd624ef75ce82d33d8ab313372307b3659141e050c0e877185b`（1回目と同じ） |
| `tests/c5-unit.test.mjs` | `bf24aaa48092c438ccf1ec534ec5f95186df9a6fdbe8b4ce1b0922080cae2fd5` |
| `tests/c5-mutation.test.mjs` | `aa35784d38270828ae728b0764d993aaadfbfe43159059bbd4004b144dd537a1` |
| `tests/c5-check-json.mjs` | `f58d09fe6f8a49d8aa21668d623ab0c238c6be009a2fffa47fa7fb8a9161159c` |
| `tests/c5-check-worktree.mjs` | `c74c5e3923ef82ceb1b3b61a4a745d463ac03be151a3a7a09dd93cd1f57c8f1d` |
| `tests/gate-members.mjs` | `a5f351b5e275aa60beaeff0e337f2f4aef09dddb8e9081275eed483f545354fd` |

C-2・C-3 の edits.patch の sha は、1回目の検証と同じ（`290e6d5f…`・`2dd86b9a…`）。

## 1. 差分のレビュー

### C-4（2回目）

**変わったのは、新しいファイル `extHostRemovedApi.notebook.ts` だけ**。edits.patch のファイルごとの行数を1回目と比べると、ほかの24ファイルは同じで、このファイルだけが 146 → 151 行になった。

- **門**: `updateNotebookAffinity(_notebook, affinity)` は、`affinity === NotebookControllerAffinity2.Hidden` のときだけ `checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden')` をかける（edits.patch の 461〜466行）。
  - 本家 `extHostNotebookKernels.ts` の 280〜287行と同じ条件。
  - `NotebookControllerAffinity2` は `./extHostTypes.js` から import する。本家の `extHostNotebookKernels.ts` と同じ出どころで、`extHostTypes.ts` の2660行（`Hidden = -1`）。
  - 引数の型は `vscode.NotebookControllerAffinity | vscode.NotebookControllerAffinity2` で、型検査が通る。
- **門の数**: 新しいファイルの `checkProposedApiEnabled` は7つ。本家の門と同じ数・同じ名前になった。
  - `extHostNotebookKernels.ts` の5つ: `notebookVariableProvider`・`notebookExecution`・`notebookControllerAffinityHidden`・`notebookMessaging` の2つ
  - `extHost.api.impl.ts` の `notebooks` の2つ: `notebookKernelSource`
- **`rendererScripts`**: `createNotebookController` は、本家（`extHost.api.impl.ts` の消した行。edits.patch の218行）と同じく、`isProposedApiEnabled(extension, 'notebookMessaging')` が偽なら `rendererScripts` を渡さない（489行）。
  - 誤りを投げる門ではないが、提案が無効の拡張に見える値が本家と同じになった。
- **README**: 門の一覧（7つ）と、投げない判定（2つ）の表が足された（112〜124行）。
- 当てた木で、`extHostRemovedApi.notebook.ts` の12・72〜75・100行に上の直しがあることを確かめた。

**曹参のテストの直し**

- `c4-unit.test.mjs` の658〜669行は、門の期待を手で並べず、本家から読む。
  - 読む元は、本家のタグの C-4 が消す `api/common/extHost*.ts`（`unit.json` の `delete` から拾う）と、edits.patch が `extHost.api.impl.ts` から消す塊。
  - 実装の門と**過不足なく**一致することを見る（抜けも増えも落ちる）。
  - `updateNotebookAffinity` は、本家の形（`priority === NotebookControllerAffinity2.Hidden` のときだけ門）を本家のファイルで確かめてから、実装にも条件つきの門があることを見る。
- 走らせる検査（`gate-members.mjs` の `compareMemberGates`）が、本家のメンバーごとの門を読む。そのうえで、次の3つを見る。
  - 提案を有効にしていない拡張で誤りになる
  - 有効にした拡張では誤りにならない
  - 同期・非同期の出方が本家と同じ
- 壊し方が2つ足された（`c4-mutation.test.mjs` の104・105行）。門を外すものと、条件を外して常に門をかけるもの。単独で走らせて、64件とも通った。どちらの写しでも、検査は落ちるべきとおりに落ちる。
- 1回目の検証の「直す点」の1（曹参の分）は閉じた。

### C-5

**裁定・docs のとおりか**: とおり。

- 照らした資料は、docs/01 の39行（「拡張のインストール（CLI のみ）…画面からの検索・追加は消す」）と69行、docs/03 の4節の表と末尾（147行）、user-decisions の 2026-11-15 の C-5 の7点。
  - 画面からの VSIX の導入: 右クリック（`MenuId.ExplorerContext`）とドロップを外した。内部のコマンド `installFromVSIX` は、menu の無い登録として残す（`extensions.contribution.ts` の854行）。`f1` も menu も無いので、コマンドパレットにも出ない。「VSIX からインストール」（`SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID`）も消えた。
  - `ext install ` の Quick Access を消し、`ext ` は残す。
  - `CONTEXT_HAS_GALLERY` の条件つきの画面は残す（条件は常に偽）。
  - 設定 `extensions.gallery.serviceUrl`・`authProvider` の登録は残す。
  - `.vscode/extensions.json` の検査（`extensionsFileTemplate.ts`）は残す。
  - マーケットプレイスの状態のバッジ（`ExtensionMarketplaceStatusUpdater`）は消す。
  - 何もしないギャラリーは、誤りを投げず空を返す。
- docs/03 の表との食い違いがある（`extensionGalleryManifestService` のワークベンチ側と、`services/extensionRecommendations` の型）。表の側が古い書き方で、4節の末尾（147行）と `kept` が正。蒙恬・曹参の報告のとおりで、判断はリーダー。

**何もしないギャラリーが通信しないか**:

- `NoopExtensionGalleryService`（新しいファイル）は constructor を持たず、注入も要求のサービスも URL も持たない。import は cancellation・paging・uri・拡張の管理の型・拡張の型だけ。`isEnabled()` は偽。
- ワークベンチの `extensionGalleryService.ts` は、`AbstractExtensionGalleryService` を継ぐ `WorkbenchExtensionGalleryService` を消し、`NoopExtensionGalleryService` だけを登録する。当てた木の `registerSingleton(IExtensionGalleryService, …)` はこの1つだけ（web の入口を除く）。
- マニフェストのサービス（electron-browser）からは、アカウントと私設のマーケットプレイスの取得を外した。外したのは、`IRequestService` で `extensions.gallery.serviceUrl` を GET する所。残るのは、基底の `getExtensionGalleryManifest()` の呼び出しと、共有プロセス・リモートへ送る所だけ。
  - 基底（`platform/extensionManagement/common/extensionGalleryManifestService.ts` の41〜45行）は、product.json の `extensionsGallery.serviceUrl` から組むだけで、通信しない。
  - `extensionsGallery` は `product.overlay.json` の `removeIfPresent`（46行）で外され、当てた木の product.json に無い。なので `null` が送られる。
- 残した設定 `extensions.gallery.serviceUrl` の読み手（`extensionsWorkbenchService.ts`）は、どれもギャラリーのサービス（何もしない実装）を通る。設定に URL を入れても、通信は起きない。
- 共有プロセスと CLI は `platform` のギャラリーを使う。マニフェストが `null` なので有効にならない（C-5 の前から同じ）。

**CLI の `--install-extension` の道に触れていないか**: 触れていない。

- `cliProcessMain.ts` は、`platform` の `ExtensionGalleryManifestService`・`ExtensionGalleryServiceWithNoStorageService` を自分で組む（236・237行）。C-5 が消すもの（tips・アカウント・おすすめ）は import していない（本家を Grep した）。
- edits.patch・`delete`・`removeLines` は、`cliProcessMain.ts`・`platform/extensionManagement` に触れない。
  - `platform/extensionManagement` で消すのは、`node/extensionTipsService.ts`（共有プロセスの exe ベースの提案）の1つだけ。
  - 本家でこれを import するのは `sharedProcessMain.ts` だけ。

**消すもの・残すもの**:

- 消すのは、ギャラリー・おすすめ・アカウント・画面からの導入のビュー・コマンド・クラスだけ。edits.patch の消すクラスとビューの一覧を見た。入っている拡張・有効・無効・古い拡張・動作中の拡張のビューとコマンドは残る。
- 消したサービスを注入する所が残っていないかを、当てた木の全体で探した。対象は `IWorkspaceExtensionsConfigService`・`IExtensionGalleryAccountService`・`@IExtensionTipsService`・`ExtensionTipsChannel` の使い手。残るのは、性能のデータの文字列と、`platform` の IPC のクラスの定義だけ。
- おすすめの3つのサービスは、`extensions.contribution.ts`（browser）の84〜86行で `Null*` が登録される。
- 共有プロセスの `ExtensionRecommendationNotificationServiceChannelClient`（`sharedProcessMain.ts` の310行）は残る。
  - 使い手は消した tips の基底だけなので、呼ばれない。
  - ワークベンチ側のチャンネルの登録を外しても、誤りにならない見込み。起動の確かめで見る。

**Claude Code の受け手**: 触れていない。Claude Code の manifest に `extensionDependencies`・`extensionPack` は無い（蒙恬の報告）。

**5.3**:

- edits.patch は `workbench.*.main.ts` に触れず、main のファイルの行は `removeLines`（common 2・desktop 2）で消す。
- `sharedProcessMain.ts` のハンクは、import の2行の書き換えだけ。C-1（パッチ）・C-3（`removeLines`）も同じファイルを直すが、19単位の組でも衝突なく当たった。
- C-2〜C-4 の edits.patch とは、同じファイルに触れない（`c5-unit` が見張る）。

## 2. 当て直し・照らし・型検査

始める前の作業ツリーはタグ（`C:\b\vscode\.git\worktrees\p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`）。記録はすべて `tasks/2026-11-15-p5-c4-c5-verify/run/` に書いた。

### 2.1 `after` の止まり（タグのまま。作業ツリーに書かない）

| コマンド | 結果 |
|---|---|
| `node scripts/apply.mjs C:/b/wt/p2 --label c5-gate-noc1-ooka --only <A・B の14>,C-5-extension-gallery --checks-out …/run/checks-c5-noc1.json` | 止まった（`stoppedAt.phase: inputs`）。`errors`: `C-5-extension-gallery: after の単位 C-1-ai が先に当たらない（--only に入っていない）` |
| `node tests/c5-check-json.mjs --stopped …/run/checks-c5-noc1.json` | 期待どおり（C-1 を外すと C-5 の前で止まる） |

走らせた後も、HEAD は `69047191` のままだった。

### 2.2 19単位の組（A・B の14と C-1〜C-5）

| 手順 | コマンド | 結果 |
|---|---|---|
| 当て直し | `node scripts/apply.mjs C:/b/wt/p2 --label c5-gate-b-ooka --only <A・B の14>,C-1-ai,C-2-debug,C-3-remote,C-4-notebook,C-5-extension-gallery --checks-out …/run/checks-19.json` | `結果: ok`。警告は `C-2-debug: delete: …debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ（想定済み） |
| 照らし | `node tests/c5-check-json.mjs …/run/checks-19.json` | 期待どおり（組 b: 当て直しのみ） |
| 照らし | `node tests/c5-check-worktree.mjs C:/b/wt/p2` | 期待どおり（作業ツリー） |
| 照らし | `node tests/c4-check-worktree.mjs C:/b/wt/p2` | 期待どおり（作業ツリー） |
| 参考 | `node tests/c3-check-worktree.mjs`・`c2-check-worktree.mjs`・`c1-check-worktree.mjs C:/b/wt/p2` | 3つとも期待どおり（作業ツリー）。曹参の2回目で、C-4 が当たった木では C-4 の `delete` の中を見ない形になった |
| 参考 | `node tests/c4-check-json.mjs …/run/checks-19.json` | 食い違いは「想定していない単位が当たっている: C-5-extension-gallery（b の組は 18 単位）」の1件だけ。照らし役が18単位の組を前提にしているため。C-4 のほかの期待は、この記録でも満たす |
| 型検査 | `node scripts/build.mjs 1.146.0 --label c5-gate-b-ooka --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record …/run/typecheck-19.json --take-in-dir …/run/take-in-19` | `result: ok` |
| 照らし | `node tests/c5-check-json.mjs …/run/checks-19.json …/run/typecheck-19.json` | 期待どおり（組 b: 当て直し・型検査） |
| 参考 | `npx --prefix C:/b/wt/p2 tsc --noEmit --project C:/b/wt/p2/build/tsconfig.json` | 誤り7件。A-3 の1件と C-3 の `productRemove` の6件で、1回目の検証と同じ（判断済み）。C-5 による増えは無い |

照らし役が、落ちるべきときに落ちることも見た。

- 当たった19単位の記録を `--stopped` で照らすと、食い違い4件で 1 を返す。
- 19単位の当て直しに、蒙恬の型検査の記録（別の HEAD）を組み合わせると、「型検査の HEAD が当て直しの HEAD と違う」で 1 を返す。

当て直しの記録（`checks-19.json`）の中身:

- `baseCommit` は `69047191`（タグ）、`headCommit` は `4b762152ff1a15774a07510fa4f0667cefde8962`、`result` は `ok`。
- 19単位すべてが `applied: ok`。C-1〜C-5 の edits は、どれも `conflicts: []` で、件名は `unit C-<n>-…: edits`。
- コミットは、C-1、C-2、C-3、C-4、C-5 の順に、それぞれ ops → edits と並ぶ。
- 次のものは、どれも0件。
  - `"applied"` が `"fail"`・`"conflict"`・`"error"` のもの
  - `removeLines` の `"ok": false`
  - `hitCount` が1以上の項目

型検査の記録（`typecheck-19.json`）:

- `steps[0]`: `pnpm run typecheck-client`、`exitCode: 0`、6.8秒。ログ `C:\b\logs\c5-gate-b-ooka\typecheck.log` に `error` の語は無い。
- `sourceVersion.value` は `4b762152…` で、当て直しの `headCommit` と同じ。`uncommittedEntries` は 0、`error` は `null`。

### 2.3 自分で走らせていない組（蒙恬の記録の照らし）

組の間で作業ツリーをタグに戻すには、`git -C C:/b/wt/p2 checkout 1.146.0` が要る。これが許可に無い。

| 記録 | コマンド | 結果 |
|---|---|---|
| C-4 の組 a（17単位。2回目） | `node tests/c4-check-json.mjs tasks/2026-11-15-p5-c4-patch/trial/round2-checks-verify-a.json …/round2-typecheck-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |
| C-4 の組 b（18単位。2回目） | 同じ形（`-b`） | 期待どおり（組 b: 当て直し・型検査） |
| C-5 の組 a（16単位。2回目） | `node tests/c5-check-json.mjs tasks/2026-11-15-p5-c5-patch/trial/checks-r2-verify-a.json …/build-typecheck-r2-verify-a.json` | 期待どおり（組 a: 当て直し・型検査） |
| C-5 の組 b（19単位。2回目） | 同じ形（`-b`） | 期待どおり（組 b: 当て直し・型検査） |

この4つの記録は、C-1 の edits.patch が6回目に変わる前に取ったものかもしれない（記録の時刻は 04:00〜04:38 UTC）。C-1 の今の edits.patch を含む組が当たることは、自分の19単位の組で確かめた。

### 2.4 ロックファイル（蒙恬の記録を読んだだけ）

`pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts` が許可に無いので、作り直していない。C-4・C-5 は、依存もパッチの行も消さない。

- 上の4つの記録の `checks.lockfile` は、どれも `status: ok`。`unexpected…` の一覧は空。
- 照らし役（`c4-check-json`・`c5-check-json`）は、記録にロックファイルの検査があれば、それも見る。上の「期待どおり」はそれを含む（ルートの `removedPatches` が `["foundry-local-sdk"]` だけ）。

## 3. テスト

`node tests/run-all.mjs --save tasks/2026-11-15-p5-c4-c5-verify/run/run-all-ooka.txt` を走らせた。終了コードは 1。

- TOTAL: tests 2448、pass 2439、**fail 2**、skip 7。
- skip 7 は `removals.test.mjs` の既存の分。
- 落ちた2本は、どちらも C-1 の分（下の「C-1 の落ちる2本」）。C-2〜C-7 は、どれも fail 0。C-4・C-5 の分は次のとおり。

| ファイル | 件数 |
|---|---|
| `c4-unit` | 55 |
| `c4-mutation` | 64 |
| `c4-check-json.test` | 12 |
| `c4-worktree` | 26 |
| `c5-unit` | 42 |
| `c5-mutation` | 62 |
| `c5-check-json.test` | 12 |
| `c5-worktree` | 32 |

- 単独でも、上の8つと `c2-unit`・`c2-worktree`・`c1-round2` を `node --test` で走らせた。どれも fail 0。
- 作業ツリーの HEAD は、run-all の後も `4b762152` のままだった。

**C-1 の落ちる2本**（範囲の外。C-1 の6回目の検証で扱う）:

- brief の3が挙げる「C-1 の門の検査の2本」は、**蒙恬の C-1 の6回目で直って、通る**。これは `registerToolDefinition` の門の抜けで落ちていた2本で、`c1-unit` の「門が…すべて含む」と、`c1-mutation` の対照。
- 今落ちるのは、別の2本。
  - `c1-unit.test.mjs`: 「門の誤りが、本家と同じ形で返る(本家のメソッドが async なら reject、そうでなければ同期で投げる)」。中身は `lm.fileIsIgnored: 本家は同期（投げる）だが、rejects` と `lm.getModelProxy: 本家は async（reject する）だが、throws`。
  - `c1-mutation.test.mjs`: 「壊さない写しは c1-unit.test.mjs が全部通る(対照)」。上の1本が落ちる結果として落ちる。
- この2本は、**曹参の C-1 の5回目で足した検査**が見つけた、蒙恬の6回目の実装の点（`tasks/2026-11-15-p5-c1-tests/handoff-notes.md` の「5回目」の「見つけたこと」）。5回目より前に落ちていたものではない。
- 実装を本家の出方に合わせるか、テストの期待を直すか。どちらにするかは、リーダーの判断を待っている。
- C-4・C-5 の合否には響かない（C-4・C-5 の検査は fail 0）。

**テストが仕様を正しく確かめているか**:

- C-4: 門の期待を本家から読む形になり、実装と過不足なく一致することを見る。壊した写しで落ちることも確かめている。足りないのは、`rendererScripts` の直しを見る検査だけ（軽微な指摘の2）。
- C-5:
  - メンバーの一覧は、本家の `IExtensionGalleryService`・おすすめの interface から読んで突き合わせる。
  - 通信しないことは、`globalThis.fetch` を「呼ばれたら投げる」に差し替えて走らせて見る。
  - CLI の道は、本家の `cliProcessMain.ts` と `install-extensions.mjs` から読んで見る。
  - 画面からの導入は、消す・残すの両方を見る（`installFromVSIX` を消すと落ちる壊し方もある）。
  - 実装に合わせて書いた所は見つからなかった。62の壊し方で、それぞれ落ちることを確かめている。

## 4. 合否と直す点

- **C-4-notebook（2回目）: 合格**（パッケージ化の前まで）。
  - 1回目の直す点（蒙恬の門、曹参のテスト）は、どちらも閉じた。
  - 19単位の組での当て直し・照らし・型検査は、自分で確かめた。
  - C-4 の組 a・b（2回目）、ロックファイル、`git apply --check` は、蒙恬の記録の照らしだけ。
- **C-5-extension-gallery: 合格**（パッケージ化の前まで）。
  - 19単位の組での当て直し・照らし・型検査と、`after` の止まりは、自分で確かめた。
  - C-5 の組 a、ロックファイル、`git apply --check` は、蒙恬の記録の照らしだけ。
- 直す点: 無い。

### 軽微な指摘（直さなくても、パッケージ化の前の合否には響かない）

1. **蒙恬（`removals/C-4-notebook/README.md` の106行）**: `notebooks.createNotebookController` の行が「`updateNotebookAffinity`・`dispose` は何もしない」のまま。112〜124行の門の表（`updateNotebookAffinity` は `Hidden` のとき門）と食い違う。「`updateNotebookAffinity` は `Hidden` を渡したときだけ門（下の表）」のように直すとよい。
2. **曹参（`tests/c4-unit.test.mjs`）**: 2回目の `rendererScripts` の直しを見る検査が無い。
   - 今の検査（841行）は、スクリプトを渡さずに `rendererScripts` が `[]` であることだけを見る。
   - edits.patch の489行を、元の `rendererScripts` のまま渡す形に戻しても落ちない（壊し方にも無い）。
   - 足すとよいもの: `createNotebookController('id', 'type', 'label', undefined, [script])` の `rendererScripts` が、提案 `notebookMessaging` が無効なら `[]`、有効なら `[script]` であることを走らせる検査と、その壊し方。蒙恬の2回目の「テストの入口」にある形。
3. **曹参（`tests/c4-unit.test.mjs` の検査の名前）**: 中身は2回目に合わせて直っているが、名前が古い。
   - 「createNotebookController は … dispose・updateNotebookAffinity は空。…」→ 今は門を含む。
   - 「import は vscode(型)・Event・URI・IExtensionDescription・checkProposedApiEnabled・asWebviewUri の6つだけ」→ 今は `isProposedApiEnabled`・`NotebookControllerAffinity2` も許す。

### 許可が足りなかったもの（1回目の検証と同じ）

| 何のために | 要るコマンド |
|---|---|
| 組と組の間で、作業ツリーをタグに戻す | `git -C C:/b/wt/p2 checkout 1.146.0` |
| ロックファイルを作り直す・戻す | `pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts`、`git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` |
| 3-way に頼らずに当たることの確かめ | `git -C C:/b/wt/p2 log --format="%H %s" -n 80`、`git -C C:/b/wt/p2 checkout <ops の sha>`、`git -C C:/b/wt/p2 apply --check -v <edits.patch>` |
| C: の空きを測る | 測るコマンドが許可に無い。書いたのは記録とログだけ（数 MB 以下）。当て直しの commit は作業ツリーの git に入る |

## 作業ツリーの状態（終わったとき）

- `C:\b\wt\p2` の HEAD は `4b762152ff1a15774a07510fa4f0667cefde8962`（`C:\b\vscode\.git\worktrees\p2\HEAD` を読んだ）。run-all の後も変わっていない。
- 当てた単位は次のとおり（label `c5-gate-b-ooka`）。未コミットの変更は 0（型検査の記録の `uncommittedEntries`）。
  - A-1〜A-7・B-1〜B-7 の14
  - C-1-ai・C-2-debug・C-3-remote・C-4-notebook・C-5-extension-gallery
  - `patches/` の2つ
- タグには戻していない（戻すコマンドが許可に無い）。次に `apply.mjs` を使う前に、`git -C C:/b/wt/p2 checkout 1.146.0` が要る。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` と、普段使いのエディタのデータには触れていない。パッケージ化と zip はしていない。

## 記録

- この文書: `tasks/2026-11-15-p5-c4-c5-verify/verification-ooka.md`
- `tasks/2026-11-15-p5-c4-c5-verify/run/`
  - `checks-c5-noc1.json`（`after` の止まり）
  - `checks-19.json`（19単位の当て直し）
  - `typecheck-19.json`（型検査）。ログは `C:\b\logs\c5-gate-b-ooka\typecheck.log`
  - `run-all-ooka.txt`（run-all）
- `--take-in-dir` に渡した `run/take-in-19/` は作られなかった（型検査の手順だけでは書かれない）。

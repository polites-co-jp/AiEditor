# Phase 5 の下ごしらえ（C-7 の edits.patch）の引き継ぎ

蒙恬から、リーダー（ヴラド・ツェペシュ）へ。2026-11-15。

## 結果

**完了**。パッケージ化と zip、ビルド・起動・関門は、依頼どおり行っていない。作業ツリー `C:\b\wt\p2` はタグ 1.146.0 に戻した。

## 成果物

- `removals/C-7-breadcrumbs-outline/edits.patch`（新規）
  - 10ファイル（新規 0）、13行の追加、323行の削除、42ハンク
  - 件名は `unit C-7-breadcrumbs-outline: edits`、作者は `shuko-apply <apply@shuko.invalid>`、From の commit は `1547dc3e`
- `removals/C-7-breadcrumbs-outline/unit.json`（直した）。`enabled` は `false` のまま
  - `"patch": "edits.patch"` を足した
  - `checks.absentStrings` に4つを足した
  - `delete`・`removeLines`・`after`・`kept`・`absentCommands`・`absentSettings` は変えていない
- `removals/C-7-breadcrumbs-outline/README.md`（書き直した）
  - 状態を「edits.patch あり、関門の前」にした
  - 足した節: 「前提の単位」「edits.patch で直した点（2026-11-15）」「パンくずが無くなった後の、エディタの枠の振る舞い」「注入の照らし（型検査に掛からない点）」「エディタの枠と Claude Code への影響」「パッチの大きさ」「別案の見込み」「checks の見直し」
  - 直した節: 「消すもの」「残すもの」「影響しうるもの」「壊れたときの症状と戻し方」「未確認」
- `tasks/2026-11-15-p5-c7-patch/typecheck-log.md`（新規）: 誤りの数の移り変わり、2つの組の当て直し、ディスク
- `tasks/2026-11-15-p5-c7-patch/trial/`
  - 適用の検査3つ: `checks-ops.json`・`checks-verify-a.json`・`checks-verify-b.json`。verify の2つにはロックファイルの検査も追記した
  - 型検査の記録5つ: `build-typecheck-{1,2,3,verify-a,verify-b}.json`
  - ロックファイルの差分2つ: `lockfile-a.diff`・`lockfile-b.diff`
  - `build.mjs` の `--take-in-dir` には `trial/take-in` を渡したが、型検査の段だけではファイルは書かれなかった
- `tasks/2026-11-15-p5-c7-patch/disk-start.json`・`disk-end.json`
- `scripts/` と、ほかの単位の `removals/` は変えていない

## 要点

1. A・B の14単位と C-1・C-2・C-4・C-7 の ops の上で、型検査の誤りは 11 → 13 → 0。11件はどれも README の「型検査で直す点」の範囲だった。13件は直した後の使われなくなった import。
2. エディタの枠は、パンくずを作る部分だけを外した。枠のファイルは4つ・17ハンク（`editorHeaderControl.ts`・`singleEditorTabsControl.ts`・`editorTitleControl.ts`・`auxiliaryEditorPart.ts`）。タブ・グループ・差分エディタ・Webview のファイルには触れていない。
3. 注入の外し損ねは見つからなかった（`@IOutlineService`・`@IBreadcrumbsService` は 0 件）。型検査に出ない直しは2つ: `editorTitleControl.ts` のパンくずの更新の呼び出し3か所と、読み手の無くなった `showBreadcrumbs`。
4. 当て直しは2つの組とも衝突なく `ok`、型検査は誤り 0、`--lockfile-check` も `ok`。b（21単位。段階 C のすべて）でも行のずれ無く当たり、`removeLines` に回すものは無かった。
5. 別案（設定で隠して止める）は、1〜2ファイル・1〜6ハンクで、枠のファイルのハンクは 0 の見込み。今の案の差は、枠の17ハンクと共有の型の1ハンク（下の「パッチの大きさと別案の見込み」）。

## 直した点

一覧の正本は `removals/C-7-breadcrumbs-outline/README.md` の「edits.patch で直した点（2026-11-15）」。

| ファイル | 直し方 |
|---|---|
| `browser/parts/editor/editorHeaderControl.ts`（枠） | パンくずの入れ物・部品・表示の切り替え・`handleEditorsChange`・幅の計算を消した。高さはヘッダーがあるときだけ。操作の並べ方は「パンくずが無いとき」の値に固定。要素の印 `breadcrumbs-in-header` を外した（CSS にも使い手にも無い） |
| `browser/parts/editor/editorTitleControl.ts`（枠） | `handleEditorsChange` の3か所の呼び出しと、呼ぶだけの `handleOpenedEditors`・`handleClosedEditors` を消した |
| `browser/parts/editor/singleEditorTabsControl.ts`（枠） | パンくずの部品・`.title.breadcrumbs` の印・`handleBreadcrumbsEnablementChange`・`redraw` と `layout` のパンくずの更新を消し、説明を隠す条件からパンくずの分を外した |
| `browser/parts/editor/auxiliaryEditorPart.ts`（枠） | `showBreadcrumbs: false` を外した |
| `common/editor.ts`（共有） | `IEditorPartOptions.showBreadcrumbs` を外した |
| `contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts` | `IOutlineService` の注入と、テキスト以外のエディタでアウトラインから一覧を作る部分（メソッド4つと `INavigablePickEntry`）、使われなくなった import を消した |
| `api/browser/mainThreadCustomEditors.ts` | `IOutlineService` の注入と `notifyOutlineChanged()` の2か所を消した |
| テスト3つ（`mainThreadCustomEditors.test.ts`・`anythingQuickAccess.test.ts`・`tabs.fixture.ts`） | `IOutlineService`・`IBreadcrumbsService` の差し替え、`outlineChanges` の確かめ4つ、見本の `breadcrumbs` の選択肢と見本 `ShowBreadCrumbs` を外した |

`unit.json` の `checks.absentStrings` に足したもの: `BreadcrumbsControlFactory`（`src/vs/workbench/browser/parts/editor`）、`@IOutlineService`・`notifyOutlineChanged`・`showBreadcrumbs`（`src/vs/workbench`）。4つとも `C:\b\wt\1.146.0` の同じ範囲にある（空振りしない）。

## 残した部品と理由

README の「残すもの」と `unit.json` の `kept` が正本。`kept` は変えていない。

| 部品 | 理由 |
|---|---|
| `base/browser/ui/breadcrumbs` | 差分エディタの「変更の無い部分」の表示が使う |
| `editor/contrib/documentSymbols`（`IOutlineModelService`） | 記号へ移動とスティッキースクロールが使う |
| タブの枠の CSS のパンくずの規則 | 共有の CSS。当てる要素が無く効かないだけ |
| 引数の名前 `breadcrumbsInHeader`（枠の4ファイル） | 中身は「全幅のヘッダーを出すか」。改名すると枠のハンクが増える |
| カスタムテキストエディタの記号の移動（`CustomEditorInput.navigation`） | 保存の処理（`saveParticipants.ts` の132行）と `customEditorInput.ts` の `getSelection`・`applyOptions` が読む |
| `gotoSymbolQuickAccess.ts` の `isCompositeEditor` の分岐と TODO のコメント | 分岐はテキスト以外のエディタを基底の表示に回す。コメントは本家の文 |
| `unfocusedViewDimmingContribution.ts` の `.breadcrumbs-below-tabs` の規則、`editorGroupView.ts` の `monaco-breadcrumb-item` の判定、`settingsLayout.ts` の目次 | 当てる要素・設定が無いだけ |
| テストの設定値（`editorHeaderControl.test.ts` の `breadcrumbs: { enabled: false }`）と `tabs.fixture.ts` の見た目の説明の文 | 値と文だけ。直すと触らないテストのファイルにハンクが増える（判断を仰ぐ点の4） |

## 注入の照らし

18単位の木と21単位の木で `Grep` した。細目は README の「注入の照らし」。

- `IOutlineService`・`IBreadcrumbsService`・`BreadcrumbsControl`・`BreadcrumbsConfig`・`OutlineTarget`・`IOutlineCreator`・`notifyOutlineChanged`・`showBreadcrumbs` は `src/vs` に 0 件（コメント1行とテストの性能の資料を除く）。
- アウトラインを作る側（`registerOutlineCreator`）は、1.146.0 では C-7・C-4・C-1 が消す3つだけ。
- 消したコマンド `breadcrumbs.*` を文字列で呼ぶ所は無い。残す組み込み拡張と台帳の拡張の package.json に `breadcrumb`・`outline.` の語は無い。
- 消したファイルの名前は `eslint.config.js` とテストの性能の資料にだけ残る。

## エディタの枠と Claude Code への影響

- 本家の既定（タブが複数）では、前はタブの下に隠れたパンくずの入れ物（高さ 0）を作っていた。今は作らない。`mydist` の既定 `breadcrumbs.enabled: false` の下で見ていた画面と同じになる見込み。
- 1枚のタブでは、パンくずが無効だったときと同じ条件でファイルの説明が出る。
- 全幅のヘッダー（`showHeader`）は、このビルドで使っていたのが C-1 の消すエージェントの窓とチャットの窓だけ（1.146.0 で確かめた）。今のビルドではテストだけが通る。
- タイトルの高さの計算（`getHeight()` の `total`・`offset`）の形は変えていない。
- Claude Code（2.1.322）の manifest に `breadcrumb`・`outline` の語は無い。受け手（Webview・セカンダリサイドバー・JSON の検査・ワークスペースの信頼・コメント・差分エディタ・拡張のファイルシステム・`editor/title` のメニュー）には触れていない。`editor/title` のメニューはタブの列の操作の部分（`editorTabsControl.ts`）が出すので変わらない。
- 拡張 API の何もしない実装は要らない（アウトラインのサービスは拡張から見えない）。拡張の `DocumentSymbolProvider` は `IOutlineModelService` を通して残る。
- 記号へ移動（Ctrl+Shift+O）は、テキストエディタと差分エディタでは変わらない（`isCompositeEditor` が真になるのはノートブックの部品だけ）。記号の移動を持つカスタムテキストエディタでは、一覧が出なくなる。

## パッチの大きさと別案の見込み

| 項目 | 値 |
|---|---|
| edits.patch | 10ファイル、13行の追加、323行の削除、42ハンク、738行 |
| うちエディタの枠（`browser/parts/editor`） | 4ファイル、17ハンク |
| うち共有の型（`common/editor.ts`） | 1ハンク（1行） |
| うちそのほかの本体 | 2ファイル、8ハンク |
| うちテスト | 3ファイル、16ハンク |
| ops | `delete` 10、`removeLines` 2行 |

別案（docs/08 の5節。`breadcrumbs.enabled: false` とコードを到達しない状態にするところで止める）の見込み。本家 1.146.0 のソースから数えた推定で、作っていない。

- 案1（最小）: `breadcrumbsControl.ts` の812行の `isEnabled` を常に偽にする。1ファイル、1ハンク、1行。枠のハンクは 0。設定とコマンドは残り、`absentCommands`・`absentSettings` は通らない。
- 案2（コマンドと設定も隠す）: 案1に加え、コマンドの登録4つ（873行から）と設定の登録（`breadcrumbs.ts` の121〜346行）を消す。2ファイル、5〜6ハンク、約330行の削除。枠のハンクは 0。
- どちらも、`services/outline` とパンくずのコードは読み込まれたまま残る（裁定の「コードごと消す」と違う）。パッチはパンくず自身のファイルにかかり、枠のファイルの変更とは衝突しない。

## 確かめたこと

- 型検査（`node scripts/build.mjs 1.146.0 --label <l> --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record ...`）を5回走らせた。誤りは 11 → 13 → 0、確かめ a・b も 0（回ごとの内訳は `typecheck-log.md`）。
- 当て直し a（タグから18単位。`trial/checks-verify-a.json`）
  - 適用は `result: ok`。C-7 の `delete` 10はどれも消え、`removeLines` 2行はどれも `found: 1`
  - C-7 の edits は `applied: ok`、`conflicts: []`、warnings 無し
  - `absentStrings` の C-7 の11項目はどれも `hitCount: 0`
  - 型検査は `ok`、誤り 0（HEAD `b1b998f7`）
  - `--lockfile-check` は `ok`
- 当て直し b（タグから21単位。`trial/checks-verify-b.json`）
  - 適用は `result: ok`。C-1〜C-7 の edits はどれも `conflicts: []`
  - 警告は C-2 の想定どおりの1件（`debugChatIntegration.ts`）だけ
  - 型検査は `ok`、誤り 0（HEAD `6d278893`）
  - `--lockfile-check` は `ok`
- a・b それぞれの C-7 の ops の commit（`84b6e33e`・`3edbaa94`）の上で、`git -C C:/b/wt/p2 apply --check -v removals/C-7-breadcrumbs-outline/edits.patch` が10ファイルとも当たった（行のずれの表示も無い）。
- ほかの単位との重なり: 10ファイルのうち3つは C-1 の edits.patch も触る（C-1 は `after` にあるので、C-7 はいつも C-1 の後の形に当たる）。C-2・C-3・C-5・C-6 の edits.patch と `patches/` は触れない。ops では B-2 の `tabs.fixture.ts` の `removeLines` 1行だけ。
- ロックファイルは、どちらの組でも検査の後に `git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml` で戻した。
- ディスク: C: の空きは、始め 18.82 GB、終わり 18.60 GB。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` は書き換えていない（`1.146.0` は読んだだけ）。普段使いのエディタのデータにも触れていない。新しい作業ツリーは作っていない。
- **作業ツリー `C:\b\wt\p2` はタグ 1.146.0（`69047191`）に戻した**。`git -C C:/b/wt/p2 status` は `HEAD detached at 1.146.0` で、作業ツリーはきれい。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。

## テストの入口（曹参へ）

1. **当て直し**（2つの組）
   - a: `node scripts/apply.mjs C:/b/wt/p2 --label <l> --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions,B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest,C-1-ai,C-2-debug,C-4-notebook,C-7-breadcrumbs-outline --checks-out <file>`
   - b: 同じ `--only` の `C-2-debug,` の後に `C-3-remote,` を、`C-4-notebook,` の後に `C-5-extension-gallery,C-6-settings-sync,` を挟む
   - 期待
     - `result: ok`
     - `units[id=C-7-breadcrumbs-outline].edits` が `{applied: "ok", subject: "unit C-7-breadcrumbs-outline: edits", conflicts: []}`
     - `units[id=C-7-breadcrumbs-outline].ops.removeLines` の2行がどれも `found: 1`、`ops.missingDeletes` が `[]`
     - `units[id=C-7-breadcrumbs-outline].warnings` が `[]`（a・b とも）
     - `checks.remnants.status`・`checks.absentStrings.status` が `ok`。C-7 の `absentStrings` の項目が11で、どれも `hitCount: 0`
     - `units[id=C-2-debug].warnings` に `debugChatIntegration.ts` の1件（a・b とも）
2. **`after` の確かめ**: `--only` から `C-1-ai`（または `C-4-notebook`・`B-4-outline-view`）を外すと、C-7 の前で止まる（docs/03 の5.1 の2-1）
3. **型検査**: `node scripts/build.mjs 1.146.0 --from typecheck --to typecheck --worktree C:/b/wt/p2 --no-branch --record <file> --take-in-dir <dir>`
   - 期待: `result: ok`、`steps[0].exitCode` が 0
4. **3-way に頼らないこと**: a・b の C-7 の ops の commit を checkout して、`git -C <作業ツリー> apply --check removals/C-7-breadcrumbs-outline/edits.patch` が 0 で終わる。
5. **単位のファイルの静的な検査**（ビルドリポジトリだけで済む）
   - `unit.json` の `patch` が `edits.patch` で、そのファイルがある
   - edits.patch の `Subject` が `[PATCH] unit C-7-breadcrumbs-outline: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`
   - edits.patch が触れるのは10ファイルだけ（README の「edits.patch で直した点」の表）
   - edits.patch が `workbench.*.main.ts`・`sessions.*.main.ts`・`api/common/`・`browser/parts/editor/editorGroupView.ts`・`multiEditorTabsControl.ts`・`multiRowEditorTabsControl.ts`・`editorTabsControl.ts`・`editor/browser/widget/diffEditor/`・`editor/contrib/diffEditorBreadcrumbs/`・`contrib/webview*`・`contrib/customEditor/` に触れない
   - `delete` と `kept` に同じパスが無い。`kept` に `base/browser/ui/breadcrumbs`・`editor/contrib/documentSymbols` がある
6. **当てた後の木**
   - `browser/parts/editor/breadcrumbs*.ts`・`media/breadcrumbscontrol.css`・`services/outline`・`contrib/codeEditor/browser/outline` が無い
   - `base/browser/ui/breadcrumbs`・`editor/contrib/documentSymbols`・`editor/contrib/diffEditorBreadcrumbs` がある
   - `src/vs` で `@IOutlineService`・`@IBreadcrumbsService`・`BreadcrumbsControlFactory`・`notifyOutlineChanged`・`showBreadcrumbs` が 0 件
   - `editorHeaderControl.ts` に `breadcrumbs` の語が無い。`editorTitleControl.ts` に `handleEditorsChange` が無い
   - `singleEditorTabsControl.ts` に `breadcrumbsControl` の語が無く、`breadcrumbsInHeader` はある
   - `gotoSymbolQuickAccess.ts` に `provideWithoutTextEditor`・`installNavigablePicks` が無く、`getSymbolPicks` と `GotoSymbolAction` の登録（`workbench.action.gotoSymbol`）はある
   - `mainThreadCustomEditors.ts` に `input.navigation = navigation` があり、`_outlineService` が無い
7. **単体テスト**（作業ツリーの中で VS Code のテストの仕組みで走らせる場合。型検査は通るが、走らせていない）
   - `test/browser/parts/editor/editorHeaderControl.test.ts`（変えていない）: 7つの試験がそのまま通る見込み。設定でパンくずを無効にしていたので、期待の高さ（`DEFAULT_HEIGHT`・`COMPACT_HEIGHT`・0）は変わらない
   - `api/test/browser/mainThreadCustomEditors.test.ts`: 記号の移動の4つの試験が、`outlineChanges` の確かめを外した形で通る
   - `contrib/search/test/browser/anythingQuickAccess.test.ts`: `IOutlineService` の差し替えが無くても通る
   - `test/browser/componentFixtures/editor/tabs.fixture.ts`: 見本が `ShowBreadCrumbs` を除いて描ける（見た目の基準の画像があれば、`ScrollbarPlacement` の Legacy の帯が変わりうる）
8. **関門の起動の確かめ**（片づけの後）
   - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`（`outlineService`・`breadcrumbsService`）が無い
   - タブが複数・1枚（`workbench.editor.showTabs: single`）・無しのそれぞれで、タブの高さとエディタの本体の位置が C-7 の前（`breadcrumbs.enabled: false`）と同じ。空の帯が無い
   - エディタの分割、タブのドラッグ、差分エディタ（変更の無い部分の折りたたみとそのパンくず）が動く
   - Claude Code のパネル（Webview）が開き、差分の表示・受け入れ・却下（コメント）が動く。`editor/title` のボタンが出る
   - Ctrl+Shift+O がテキストエディタと差分エディタで記号の一覧を出す
   - コマンドパレットに `absentCommands` の4つが無く、設定の画面に `breadcrumbs.*` が無い

## 判断を仰ぐ点（別案）

1. **`IEditorPartOptions.showBreadcrumbs` を消した**（README に無かった、足したもの）
   - 読み手は消した `breadcrumbsControl.ts` だけ。2026-11-14 の規則（消す部品だけが使うものは消す）に当てはめた。`common/editor.ts`（共有の型）と `auxiliaryEditorPart.ts` に1ハンクずつかかる
   - 別案: 残す（読み手の無い選択肢が残るだけ。2ハンク減る）
2. **`editorTitleControl.ts` の `handleEditorsChange` の呼び出しを消した**
   - 採った案: `EditorHeaderControl.handleEditorsChange` を消し、呼ぶ側の3か所と、呼ぶだけの2つのメソッドも消した（3ハンク）
   - 別案: `handleEditorsChange` を中身の無いメソッドで残し、`editorTitleControl.ts` に触れない。枠のハンクが3つ減るが、何もしない入口が枠に残る
3. **1枚のタブの説明の出し方を、全幅のヘッダーがあるときも変えた**
   - 前はヘッダー（`breadcrumbsInHeader`）があると、パンくずの有無に関わらず説明を隠していた。今はラベルの書式とグループが前かの条件だけで出す
   - ヘッダーを使うのは C-1 が消す窓だけなので、このビルドの画面は変わらない見込み
   - 別案: `if (this.breadcrumbsInHeader)` の分岐を残す（本家の振る舞いのまま。1行の差）
4. **テストの設定値と見本の説明の文を残した**（消すか迷ったもの）
   - `editorHeaderControl.test.ts` の `breadcrumbs: { enabled: false }`、`tabs.fixture.ts` の `ScrollbarPlacement` の説明の文の「the breadcrumb bar」
   - 別案: 消す・書き直す（テストのファイル1つにハンクが1つ増え、`tabs.fixture.ts` のハンクが1つ増える）
5. **C-7 を段階 C の最後に、このまま関門へ進めるか、別案を先に諮るか**
   - 今の案は枠の4ファイルに17ハンク。docs/08 の取り決めは「関門を2回続けて通らなければ諮る」。下ごしらえの範囲では、型検査と当て直しは通った
   - 毎週の取り込みで枠のファイルがどれだけ衝突するかは、Phase 3 の手間の記録と同じ形で測るまで分からない

## docs/ との食い違い

- docs/03 の4節の表（137行）の C-7 は、消すものを「`browser/parts/editor/breadcrumbs*`（推定）」と書く。実際に `breadcrumbs.ts`・`breadcrumbsControl.ts`・`breadcrumbsModel.ts`・`breadcrumbsPicker.ts`・`media/breadcrumbscontrol.css` の5つで、推定は当たった。「（推定）」を外すかはリーダーの判断。
- docs/03 の表の C-7 は「パッチが大きく」と書く（README の下準備の書き方も同じ）。実際は10ファイル・42ハンク・323行の削除で、C-1（数千行）・C-4（25ファイル）より小さい。ただし枠のファイルに17ハンクかかるので、「衝突しやすい」の注意は当たる。資料の言い方を直すかはリーダーの判断。

## 未解決の点

- 起動時の注入（DI）の外し損ねと、枠の高さの見た目は、型検査では見えない。起動の確かめで見る。
- 単体テスト（`editorHeaderControl.test.ts`・`mainThreadCustomEditors.test.ts`・`anythingQuickAccess.test.ts`）と見本（`tabs.fixture.ts`）は走らせていない（許可に無い。曹参の担当）。
- パッケージ化（`vscode-win32-x64-min`）、起動は、片づけの許可の後。
- 許可に無いコマンドで止まった所は、`cd` を前に付けた形、`node -e` で括弧を含む形、`commit -m` の文に括弧を含む形だけ。Glob・Grep・Read と、括弧の無い文で代えて済んだ。許可の追加は要らない。誤って作ったファイルは無い。
- SubagentHandback は4回呼んだが、どれもフックで止まった（私の定義の `tools` に無い）。報告はこのファイル。

## 付記（2026-11-15。作業ツリーの戻しと C-4 の README の直し）

1. **作業ツリーの戻し**
   - 始めの状態: `C:\b\wt\p2` の `git status` は `HEAD detached from 1.146.0`、作業ツリーはきれいだった。HEAD は大岡越前守の19単位の `4b762152`（`apply: builtin extensions`）。
   - `git -C C:/b/wt/p2 checkout 1.146.0` でタグに戻した。HEAD は `69047191`、`git status` は `HEAD detached at 1.146.0`、`nothing to commit, working tree clean`。
   - `git -C C:/b/wt/p2 status --short` は空。`node_modules` と管理外の `build/lib/policies/policyDto.ts` は残っている。
2. **C-4 の README の106行**
   - `removals/C-4-notebook/README.md` の `notebooks.createNotebookController` の行を直した（大岡越前守の軽微な指摘の1）。前は「`updateNotebookAffinity`・`dispose` は何もしない」だった。
   - 今は「`dispose` は何もしない、`updateNotebookAffinity` は何もしないが `NotebookControllerAffinity2.Hidden`（-1）を渡したときだけ門（下の表の `notebookControllerAffinityHidden`）をかける」。118行の門の表と合う。
   - ほかの行と `edits.patch`・`unit.json` は変えていない。

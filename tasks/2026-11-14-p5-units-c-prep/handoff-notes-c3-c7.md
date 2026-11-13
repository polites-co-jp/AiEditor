# 報告: 段階 C の削除の単位 C-3〜C-7 の下準備

- 担当: 蒙恬（2人目）。日付: 2026-11-14。
- 依頼: `tasks/2026-11-14-p5-units-c-prep/brief.md`。

## 結果

一部完了（ops の部分と「型検査で直す点」の一覧は完了。`edits.patch` は brief のとおり未作成。今の版の単位を本物の C-1・C-2 の後に当てる試しは、C-1 の `unit.json` に `edits.patch` が無いため、代役で行った）。

## 成果物

- `removals/C-3-remote/unit.json`・`README.md`
- `removals/C-4-notebook/unit.json`・`README.md`
- `removals/C-5-extension-gallery/unit.json`・`README.md`
- `removals/C-6-settings-sync/unit.json`・`README.md`
- `removals/C-7-breadcrumbs-outline/unit.json`・`README.md`
- `tasks/2026-11-14-p5-units-c-prep/units-c-notes-c3-c7.md`（中身・根拠・未確認の点）
- `tasks/2026-11-14-p5-units-c-prep/trial-log-c3-c7.md`（試しの記録）
- `tasks/2026-11-14-p5-units-c-prep/trial-c3c7/`（`checks-*.json` 8つ、試しの写し `removals-final/`、空の `patches-none/`）
- 試しの作業ツリー `C:\b\wt\dev-c3`（HEAD `526d25d777f`。A＋B＋C-1 の ops＋C-3〜C-7 の ops）

## 要点

1. 5単位とも `enabled: false`、order 330〜370。ops（`delete`・`removeLines`・`productRemove`）は 1.146.0 で全部当たる（`removeLines` は全件 `found: 1`、`missingDeletes` なし）。
2. C-1 が `src/vs/sessions` を丸ごと消すので、C-3〜C-7 は sessions の入口に `removeLines` を書かず、`after` に `C-1-ai` を挙げた（C-4 は `C-2-debug`、C-7 は `C-4-notebook` も）。**リーダーの判断を仰ぐ**（下の1）。
3. docs/03 の表と違い、起動時の注入で壊れる部品を残した: C-3 の `services/tunnel`（Webview＝Claude Code のパネルが注入）・`remoteExplorerService`、C-4 の `contrib/notebook/common`（拡張 API の中心が型を使う）、C-5 の `extensionGalleryManifestService.ts`（共有プロセスが Barrier で待つ）、C-6 の `services/accounts`。
4. C-1 の ops の後の `absentStrings` の残り: C-3 1、C-4 30、C-5 7、C-6 0、C-7 8。C-6 は0件だが、`IUserDataSyncWorkbenchService` を注入する2か所が起動時に壊れる（型検査に掛からない）。
5. 全文検索はノートブックの部品と強く結びついていた（docs/03 の表の恐れのとおり）。C-4 の edits.patch は検索の約15ファイルに及ぶ見込み。

## 確かめたこと

- `node scripts/apply.mjs C:/b/wt/dev-c3 --label … --only <A＋B>,C-3-remote,…,C-7-breadcrumbs-outline --checks-out …` を、まとめて1回・単位ごとに5回（初めの版）、本物の C-1・C-2 を入れて1回（C-1 の `patch が無い` で止まった）、`--removals` に今の版の写しと代役を渡して A＋B＋C-1 の ops の上で1回、走らせた。詳しくは `trial-log-c3-c7.md`。
- h の回で、本物の `removals/` を `loadUnits`・`planUnits` が読み、今の版の5単位の形の誤りが無いことも確かめた（誤りがあれば「入力に誤りがある」で止まる。止まったのは C-1 の patch の所）。
- `C:\b\wt\1.146.0` が変わっていないこと（`git status --short` が空）。

## テストの入口（曹参へ）

- 形: `loadUnits("removals")` が C-3〜C-7 で誤りを返さないこと。`validateUnit(unit, dirName)` が `[]`。
- 当て方: `planUnits(units, { only: [A＋B, C-1〜C-7] })` の `errors` が空で、順が order どおり（C-1 310 → C-2 320 → C-3 330 → … → C-7 370）。`only` から `C-1-ai` を外すと、C-3〜C-7 が「after の単位 C-1-ai が先に当たらない（--only に入っていない）」になること。
- 規則の確かめ（提案）: C-3〜C-7 の `removeLines` に `src/vs/sessions/` のファイルが無いこと（C-1 が消すため）。`delete` に、Claude Code の受け手（docs/03 の9節）の `contrib/comments`・`contrib/webview*`・`contrib/customEditor`・差分エディタ（`browser/parts/editor/diffEditor*`・`editor/browser/widget/diffEditor`）・`base/browser/ui/breadcrumbs` が入っていないこと。
- 実物での確かめ: A＋B＋C-1 の ops の作業ツリー（`fe72655ab0a`）に `--removals tasks/2026-11-14-p5-units-c-prep/trial-c3c7/removals-final --patches tasks/2026-11-14-p5-units-c-prep/trial-c3c7/patches-none` で当てると、`units[]` の C-3〜C-7 が `applied: "ok"`、`removeLines[].found` が全部1、`absentStrings` の残りが C-3 1・C-4 30・C-5 7・C-6 0・C-7 8。C-1・C-2 の `edits.patch` ができたら、本物の `removals/` で A＋B＋C-1〜C-7 を当て直す。
- `checks.registeredKeys`: C-7 を当てると mydist の `breadcrumbs.enabled` が外れること（`apply.mjs` の出力「mydist の既定から breadcrumbs.enabled を外した」）。

## docs/ との食い違い

1. docs/03 の5.3「sessions の main は `removeLines` で直す」: C-1 が `src/vs/sessions` を消す（2026-11-14 時点の C-1 の案）ので、C-2 以降の単位は sessions の入口を直せない。C-1 の後の単位は sessions を書かず `after` に C-1 を挙げる、と書き足す必要がある（C-1 の案が採られた場合）。
2. docs/03 の3.1 の例（C-2 の `after` が A-3 だけ）と4節の段階 C: 実際は C の単位が前の C の単位を前提にする（C-3〜C-7 は C-1、C-4 は C-2、C-7 は C-4）。
3. docs/03 の表の C-3: `services/tunnel`・`platform/remote/electron-browser/sharedProcessTunnelService.ts`・`services/remote/common/remoteExplorerService.ts` は消す側だが、残した（Webview と拡張の起動の部品が注入する）。
4. docs/03 の表の C-4: `contrib/notebook` は丸ごと消す側だが、`common` を残した（拡張 API の中心が型を使う）。
5. docs/03 の表の C-5: `extensionGalleryManifestService` は消す側だが、ワークベンチ側（electron-browser）を残した（共有プロセスの Barrier）。
6. docs/03 の表の C-6: `services/accounts` は「依存が無ければ」消す。依存があったので残した（表の条件どおりだが、結果を書き足す）。
7. B-4 の README・`kept` の「services/outline はクイックオープンの記号の一覧が使う」: テキストエディタでは使わない（テキスト以外のエディタだけ）。C-7 で消せる。

## 判断を仰ぐ点

1. C-3〜C-7 の `after` に `C-1-ai`（C-4 は `C-2-debug`、C-7 は `C-4-notebook` も）を挙げてよいか。別案: `apply.mjs` の `removeLines` に「ファイルが無ければ飛ばす」指定を足し、sessions の行を書いたまま C-1 から独立させる（スクリプトの変更。私の書き込み先の外ではないが、brief で `scripts/` は書かないとされている）。
2. 各 README の「別案」: C-3 の `remoteExplorerService` 一式・`remote/`・`src/vs/server` も消すか、C-4 の `contrib/notebook/common` も消すか、C-6 の同期の状態のサービスも何もしない実装にするか、`contrib/editSessions`（裁定に無い機能。消すなら単位を足す）。

## 未解決の点

- 別の蒙恬の C-1 の `unit.json` に `"patch": "edits.patch"` があり、ファイルが無いので、本物の `removals/` で C-1 を含めて当てると止まる（`apply.mjs` の350〜352行）。C-1 の ops は当たる（コミット `fe72655ab0a` で確かめた）。C-2 も同じ形（`patch` あり、ファイル無し）。私の単位は `patch` を書いていない。
- 型検査とビルドは走らせていない。各 README の「型検査で直す点」は `grep` での見込み。とくに型検査に掛からない注入の失敗（C-4 の5か所、C-5 の4つのサービス、C-6 の2か所）は、edits.patch の後に `grep '@I…'` とスモークで確かめる。
- C-7 は docs/03 の表のとおり、関門を2回続けて通らなければユーザーに諮る。

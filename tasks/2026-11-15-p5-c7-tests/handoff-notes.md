# C-7（パンくずリストとアウトライン）の検査とテスト: 完了報告

曹参。2026-11-15。brief は `tasks/2026-11-15-p5-c7-tests/brief.md`。

## 結果

**完了**（`run-all` の件数と fail の切り分けは末尾の「件数」）。1〜4のテストと照らし役・台本を書いた。`C:\b\wt\p2` には触れていない（作業ツリーの検査は、本家のファイルに前の単位と C-7 の delete・removeLines・edits.patch を当てた一時の木で行った）。

## 成果物

| ファイル | 件数 | 中身 |
|---|---|---|
| `tests/c7-unit.test.mjs` | 26 | 単位のファイルの静的な検査、枠の4ファイルだけに触れる検査、型検査に掛からない注入の外し損ねの検査 |
| `tests/c7-mutation.test.mjs` | 59 | 壊した写し58種で `c7-unit.test.mjs` が落ちること（対照1つ） |
| `tests/c7-check-json.mjs` / `.test.mjs` | 12 | 当て直し（a: 18単位、b: 21単位）と型検査の記録の照らし役（`--stopped` つき） |
| `tests/c7-check-worktree.mjs` / `tests/c7-worktree.test.mjs` | 31 | 当てた後の作業ツリーの照らし役（src/vs の全体走査を含む） |
| `tests/removals/c7-gate-script.md` | | 大岡越前守の台本（当て直し・型検査・作業ツリー・ロックファイル・3-way・起動の確かめ） |

期待は本家 1.146.0 から読んだ。消す部品が登録するサービスの ID（`IOutlineService`・`IBreadcrumbsService`）は、本家の `delete` の中の `registerSingleton(<ID>,` から読む。コマンド・設定の登録場所も本家で確かめる。

## 要点

1. **エディタの枠は決まった4ファイルだけ**（`editorHeaderControl.ts`・`editorTitleControl.ts`・`singleEditorTabsControl.ts`・`auxiliaryEditorPart.ts`）。`browser/parts/editor` に入る edits.patch のファイルがこの4つと一致することを見る。タブ・グループ（`editorGroupView.ts`・`multiEditorTabsControl.ts`・`multiRowEditorTabsControl.ts`・`editorTabsControl.ts`・`editorPart.ts` ほか）、差分エディタ（`editor/browser/widget/diffEditor/`・`editor/contrib/diffEditorBreadcrumbs/`）、Webview・カスタムエディタ（`contrib/webview*/`・`contrib/customEditor/`）、`api/common/`、main、`update` に触れないことは、禁止の一覧と壊した写し（タブの枠3・グループ・差分エディタ2・Webview・カスタムエディタ・main・拡張 API・パンくずの部品）で確かめた。
2. **注入の外し損ね**を3か所で見る。(a) 静的: 本家の ID を使う全ファイルに、前の単位の delete と edits.patch を当てた後、コードに ID の語が残らない（コメントと `*.perf-data.ts` を除く）。(b) 静的: アウトラインを登録する側（`registerOutlineCreator`）が、delete の中か他の単位が消すファイルだけ。(c) 木: `src/vs` の全体を走査して `@IOutlineService`・`@IBreadcrumbsService`・語・import・`registerOutlineCreator` が無い。
3. 枠の直しは「パンくずを作る部分だけ」を、4ファイルごとの消す行で見る（ヘッダーは `BreadcrumbsControl`・`handleEditorsChange`、タイトルは `handleEditorsChange` の呼び出し3か所、1枚のタブは `handleBreadcrumbsEnablementChange`、補助ウィンドウは `showBreadcrumbs: false` だけ、共有の型は `showBreadcrumbs` の1行だけ）。足す行は13行で、パンくず・アウトラインの語を足さない。
4. 残すもの（記号へ移動 Ctrl+Shift+O、カスタムエディタの記号の移動 `input.navigation`、差分エディタのパンくず、`breadcrumbsInHeader`）は、消す行に入らないこと（edits.patch）と、木に残ること（照らし役）の両方で見る。
5. C-1 と同じファイルに触る3つ（`gotoSymbolQuickAccess.ts` ほか）は、「前の単位を順に当てた後の形に C-7 のハンクが全部当たる」で見る（簡単な行の比較では、同じ文の別の場所を誤って重なりと見たので、順に当てる形にした）。

## 見つけたこと

実装の不具合・仕様の食い違いは見つからなかった。検査を書く途中で直したテスト側の誤りは2つ。

- 重なりの検査を、行の文字列の比較から、前の単位を順に当てて確かめる形に変えた（`const disposables = new DisposableStore();` が C-1 の消す行と文面が同じで、別の場所なのに重なりと出た）。
- 照らし役の `gotoSymbolQuickAccess.ts` の語の検査は、コメントの行を数えない（本家のコメントに `IOutlineService` の語が1行ある。蒙恬の note の「コメント1行」）。

## 仕様から想定した入口と、読み替え

実装は先にあったので、想定した入口は無い。蒙恬の「テストの入口（曹参へ）」1〜8をテストにした。

- 組 a は C-2 を含む18単位（C-4 の前提が C-2 なので、C-7 の最小の組に C-2 が入る）。組 b は21単位。C-2 の警告1件は a・b とも出る（briefの「C-1・C-2・C-4・C-7」と同じ）。
- 見つけた `trial/` の記録（`checks-verify-{a,b}.json`・`build-typecheck-verify-{a,b}.json`）で、a・b とも食い違い 0。
- 起動の確かめ（台本の5節）の表示名などは本家の名前から書いた。関門で実際の表示を確かめてもらう。

## 件数

| | 件数 |
|---|---|
| `node tests/run-all.mjs` の合計 | 2538（pass 2529、fail 2、skip 7） |
| うち C-7 の4本 | 128（`c7-unit` 26、`c7-mutation` 59、`c7-check-json` 12、`c7-worktree` 31）。すべて pass |
| 落ちた2件 | C-1 の2件（下） |

内訳の取り方: C-7 を足す前の全体（`tasks/2026-11-15-p5-c6-tests/run-all-result-final.txt`: 2410 件、fail 2、skip 7）に、C-7 の128件を足した。C-7 の4本は `--only c7-` で別に走らせ、通った。C-7 を含めた1回の全体の走らせ（`tasks/2026-11-15-p5-c7-tests/run-all-result.txt`）はバックグラウンドで走らせてあり、他の走らせと並べたため遅い。終わっていれば、同じ件数になるはず。

**fail 2 は C-1 の1件（実装の不具合）に由来する**: `c1-unit.test.mjs`「門の誤りが、本家と同じ形で返る…」と、その対照の `c1-mutation.test.mjs`「壊さない写しは…全部通る」。蒙恬の C-1 の 6回目で、`lm.fileIsIgnored`（本家は同期で投げる。実装は reject する）と `lm.getModelProxy`（本家は async で reject。実装は同期で投げる）の誤りの出方が本家と違う。詳細は `tasks/2026-11-15-p5-c1-tests/handoff-notes.md` の「5回目」。C-7 とは関係しない。brief の完了条件「fail が 0」は、C-1 が直るまで満たせない。

## 実行結果と未解決の点

- 消せずに残るファイル（リーダーが消す）: `tasks/2026-11-15-p5-c2-tests/run-all-no-ps-result.txt`、`tests/removals/c1-check-json.mjs`・`c1-check-worktree.mjs`（殻）、`tasks/2026-11-15-p5-c1-tests/handoff-notes-round2-part.md`。
- 判断を仰ぐ点（蒙恬の handoff の1〜5）は、テストは「今の案」を期待にしている。別案（`showBreadcrumbs` を残す、`handleEditorsChange` を空で残す、`breadcrumbsInHeader` の分岐を残す、など）を採るときは、`c7-unit.test.mjs` の「枠の4ファイルの直し」と `c7-check-worktree.mjs` の枠の検査を直す。
- docs/07 の8節（C-7 は関門を2回続けて通らなければ諮る）の2回目は、この台本をもう一度走らせて見る。

# C-6（設定の同期）の検査とテスト: 完了報告

曹参。2026-11-15。brief は `tasks/2026-11-15-p5-c6-tests/brief.md`。

## 結果

**完了**。C-6 の1〜4のテストと照らし役・台本を書いた。`node tests/run-all.mjs` の件数は末尾の「件数」。C-1 の門のテストの追加（コーディネーターの追加依頼）は、`tasks/2026-11-15-p5-c1-tests/handoff-notes.md` の「5回目」に書いた。

## 成果物

| ファイル | 件数 | 中身 |
|---|---|---|
| `tests/c6-unit.test.mjs` | 30 | 単位のファイルの静的な検査、型検査に掛からない注入の外し損ねの検査、続きの編集に触れない検査 |
| `tests/c6-mutation.test.mjs` | 59 | 壊した写し58種で `c6-unit.test.mjs` が落ちること（対照1つ） |
| `tests/c6-check-json.mjs` / `.test.mjs` | 12 | 当て直し（a: 16単位、b: 20単位）と型検査の記録の照らし役（`--stopped` つき） |
| `tests/c6-check-worktree.mjs` / `tests/c6-worktree.test.mjs` | 33 | 当てた後の作業ツリーの照らし役（src/vs の全体走査を含む） |
| `tests/removals/c6-gate-script.md` | | 大岡越前守の台本（当て直し・型検査・作業ツリー・ロックファイル・3-way・起動の確かめ） |

期待は本家 1.146.0 から読んだ（実装の一覧から写さない。C-4 の2回目の教訓）。`C:\b\wt\p2` には触れていない（作業ツリーの検査は、本家のファイルに前の単位と C-6 の removeLines・edits.patch を当てた一時の木で行った）。

## 要点

1. 型検査に掛からない注入の外し損ねを、静的な検査（`c6-unit`）と木の検査（`c6-check-worktree`）の2つで見る。消す部品が登録するサービスの ID は、本家の `delete` の中の `registerSingleton(<ID>,` から読む（`IUserDataSyncWorkbenchService` だけ）。edits.patch を本家に当てた後、その ID の語が残るのは、定義の `services/userDataSync/common/userDataSync.ts` と、判断済みの例外 `contrib/update/browser/update.ts`（Web の入口の操作の中で `accessor.get` する）だけ。`@ID` の注入は無い。
2. 木の検査は `src/vs` の全体の `.ts` を走査する（消した部品への import、`@IUserDataSyncWorkbenchService`、`registerChannel('userDataSyncUtil'`）。例外の `update.ts` は許し、同じ内容の別のファイルは落とす。
3. 続きの編集（`contrib/editSessions`）に触れないことは、unit.json（delete・kept・removeLines・checks）と edits.patch に `editSessions` が出ないこと、本家の editSessions が消す部品を import しないこと、木で editSessions が残り消した部品を使わないこと、の3か所で見る。
4. 本家との突き合わせで1件、検査の前提が崩れたので直した（下の「見つけたこと」）。
5. C-1 の edits.patch が変わったため（6回目）、C-1 のテストの3件を合わせ直した。詳細は C-1 の handoff-notes の「5回目」。

## 見つけたこと

- 実装の不具合は、C-6 では見つからなかった。C-6 の edits.patch は5ファイルで、足す行は import の整理（3行）と relauncher.test の呼び出し（1行）だけ。
- 検査を書く途中の直し（テスト側の誤り）: `workbench.userDataSync.actions.downloadSyncActivity` の ID の文字列は、消す部品ではなく残す `services/userDataSync/common/userDataSync.ts` の `DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR`（定義）にだけある。登録（`registerAction2`）は消す部品が定数経由でする。そこで「ID の文字列が delete の中だけにある」ではなく「定数を delete の中だけが使い、定義のファイルは登録しない」と読む形にした。absentCommands がこのコマンドを守ることは変わらない。
- 照らし役の `src/vs` 走査で、試験用のデータファイル `api/test/browser/extHostDocumentData.test.perf-data.ts`（ソースの断片を文字列で持つ）が、消した部品への import に見えた。誤検知なので走査から除いた。

## 仕様から想定した入口と、読み替え

実装は先にあったので、想定した入口は無い。蒙恬の handoff-notes の「テストの入口（曹参へ）」1〜8を、そのままテストにした。

- a/b の記録は `tasks/2026-11-15-p5-c6-patch/trial/checks-verify-{a,b}.json`・`build-typecheck-verify-{a,b}.json`（食い違い 0）で確かめた。b は C-2 の警告1件だけ。
- 台本の組 b は C-1〜C-6 の20単位。C-6 は C-1 だけを前提にし、C-2〜C-5 があっても当たる。

## 実行結果

`node tests/run-all.mjs` の合計は 2410 件（pass 2401、fail 2、skip 7）。記録は `tasks/2026-11-15-p5-c6-tests/run-all-result-final.txt`（C-6・C-1 の追加・C-2/C-4 の追加を全部入れた後の1回）。同じ場所の `run-all-result.txt` は、途中で C-1 のテストを直している最中に走らせた古い記録なので、見ない。C-7 を足した後は 2538 件（`tasks/2026-11-15-p5-c7-tests/handoff-notes.md`）。落ちたものの切り分けは次のとおり。

- `c1-unit.test.mjs` の「門の誤りが、本家と同じ形で返る」と、その対照の `c1-mutation.test.mjs`「壊さない写しは…全部通る」の2件: **実装の不具合（蒙恬の C-1）**。詳細は C-1 の handoff-notes の「5回目」。C-6 には関係しない。

## 未解決の点

- 上の C-1 の2件（蒙恬が直すまで落ちたまま）。
- 消せずに残るファイル（リーダーが消す）: `tasks/2026-11-15-p5-c2-tests/run-all-no-ps-result.txt`、`tests/removals/c1-check-json.mjs`・`c1-check-worktree.mjs`（殻）、`tasks/2026-11-15-p5-c1-tests/handoff-notes-round2-part.md`。
- 台本の起動の確かめ（5節）で使うコマンド名（`Continue Working On...` など）は、本家の表示名から書いた。実際の表示は関門で確かめてもらう。

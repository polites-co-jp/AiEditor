# Phase 5 の下ごしらえ: C-1（本家の AI）の単位の検査とテスト

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

蒙恬が C-1 の `edits.patch` を作った（`tasks/2026-11-15-p5-c1-patch/`）。蒙恬は、パッケージ化の前に要る直し（`build/gulpfile.vscode.ts` など）を同じ edits.patch に足しているところ。C-1 の単位のファイルが壊れていないことを、ビルドリポジトリの中だけで確かめるテストを、同じ仕様から並行して書く。関門のスモークは片づけの許可の後に行う。

## 入力

- docs/03 の3節（unit.json の形）・4節の段階 C の表と末尾の箇条書き（2026-11-15 の C-1 の変更を含む）・5.1・5.3・9節
- `docs/user-decisions.md` の 2026-11-14 の C-1 の範囲と、2026-11-15 の「C-1 の edits.patch を作るときに出た点」
- `removals/C-1-ai/`（unit.json、README、edits.patch）
- `tasks/2026-11-15-p5-c1-patch/handoff-notes.md` の「テストの入口（曹参へ）」の1〜4
- 既にあるテスト: `tests/removals.test.mjs`、`tests/apply*.test.mjs`、`tests/removals/`

## やること

1. **単位のファイルの静的な検査**（入口の3）: `unit.json` の `patch` が `edits.patch` でファイルがある、edits.patch の Subject が `[PATCH] unit C-1-ai: edits`、`kept` に MCP の認証の3つのサービスがある、`delete` と `kept` に同じパスが無い、`removeLines` の各行が `delete` したファイルの import か登録の1行であること、新しいファイル `api/common/extHostRemovedApi.ai.ts` と `services/chat/common/nullChatEntitlementService.ts` を edits.patch が作ること。既に `tests/removals.test.mjs` に全単位にかかる検査があれば、C-1 で足りない分だけを足す。
2. **何もしない実装の検査**（入口の4）: 本物の作業ツリーで VS Code のテストの仕組みを走らせずに書ける範囲（たとえば edits.patch の中の新しいファイルの本文を読み、`selectChatModels` が `[]` を返す、`invokeTool` が reject する、イベントが `Event.None`、提案中の API の門 `checkProposedApiEnabled` が残る、を文字列や構文で確かめる）で書く。走らせる形が要るなら、その形と何が要るかを書く（実行は大岡越前守）。
3. **当て直しと型検査の台本**（入口の1・2）: 大岡越前守が `C:\b\wt\p2` で走らせる、期待の値を照らす手順（`apply.mjs --only` の15単位、`build.mjs --from typecheck --to typecheck`、`checks` の期待）を、`tests/removals/` などに置く（自分では走らせない）。
4. `node tests/run-all.mjs --save <ファイル>` の件数を記録する。蒙恬の2回目の直しで edits.patch が変わっても通る書き方にする（行数や sha に頼らない）。

## 守ること

- 書き込みは `tests/` と `tasks/` だけ。`removals/`・`scripts/`・`C:\b\` には書かない。
- 普段使いのエディタのデータと秘密の場所に触れない。

## 完了条件

- 1〜3のテストか台本があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes.md`（足したテスト、件数、大岡越前守が走らせる台本の入口）。

## 追加の依頼（2026-11-15、蒙恬の2回目の後）

蒙恬の2回目（`tasks/2026-11-15-p5-c1-patch/handoff-notes.md` の「2回目」）で edits.patch と unit.json が変わり、3回目でロックファイルの検査が直る（同じ brief の「2回目の後」）。

1. `c1-unit.test.mjs`・`c1-check-json.test.mjs` が2回目の edits.patch で通るかを確かめ、落ちればテストの誤りか実装の誤りかを書いて直す（テストの側だけ）。
2. 2回目の「テストの入口」の1〜3を足す: 当てた後の `package.json`・`remote/package.json` の依存の有無と `pnpm-workspace.yaml` の `patchedDependencies` の有無（照らし役 `c1-check-json.mjs` か台本に）、`checks.absentStrings` に足した7つ、消したファイル。
3. `compareLockfile` の単体テスト: 単位が消したパッチの名前の分だけ `patchedDependencies` の節が減るのは許す。ほかの名前が減る・増える、ほかの節が変わるのは止める（docs/03 の5.4、`docs/user-decisions.md` の 2026-11-15 の項）。
4. `node tests/run-all.mjs --save <ファイル>` の件数。handoff-notes に「2回目」の節を足す。

## 追加の依頼（2026-11-15、大岡越前守の検証の後）

大岡越前守の許可 `node tests/*.mjs` は `tests/removals/` の下に一致しないため、照らし役を走らせられなかった（`tasks/2026-11-15-p5-c1-verify/verification-ooka.md` の2）。

1. `tests/removals/c1-check-json.mjs`・`c1-check-worktree.mjs` を `tests/` の直下（`tests/c1-check-json.mjs`・`tests/c1-check-worktree.mjs`）へ移す。テストの import と台本 `c1-gate-script.md` のコマンドも直す。台本は、`git status` の代わりに `build.mjs` の記録の `uncommittedEntries` で未コミットを見る形にする。
2. 軽微な指摘の5（任意）: `c1-unit.test.mjs` が、壊した edits.patch で落ちることを確かめる。`tests/` の下の一時のフォルダに写しを作って確かめる形でよい。
3. `node tests/run-all.mjs --save <ファイル>` の件数。handoff-notes に「4回目」の節を足す。

## 結果

採用。`tests/c1-unit.test.mjs`（37）・`c1-round2.test.mjs`（13）・`c1-check-json.test.mjs`（8）・`c1-mutation.test.mjs`（21）・`lockfile-patched.test.mjs`（17）、照らし役 `tests/c1-check-json.mjs`・`tests/c1-check-worktree.mjs`、台本 `tests/removals/c1-gate-script.md`。run-all 1705 件、fail 0。大岡越前守の再検証で合格。

## 未解決

- ビルド（パッケージ化）・起動・関門は、古い版の片づけの許可の後（`docs/user-decisions.md` 2026-11-15）。
- ロックファイルの検査を検証役が自分で作り直して確かめること（ルートと `remote/`）、本物の `pnpm install` の警告、起動時の DI と拡張ホストのログ（`vscode.lm`・`vscode.chat`）は、関門で見る。
- 消せずに残る殻のファイル（`tests/removals/c1-check-*.mjs`、`*.round2.tmp`、`handoff-notes-round2-part.md`）。コミットしない。

## 次の担当

ooka-echizen（大岡越前守）: 蒙恬の2回目の直しと、このテストの検証。

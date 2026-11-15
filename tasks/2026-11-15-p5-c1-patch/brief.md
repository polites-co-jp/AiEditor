# Phase 5 の下ごしらえ: C-1（本家の AI）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 差し戻し

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md`）で、古い版の片づけの許可を待つ間に段階 C の下ごしらえを始める。使い終わった作業ツリー `C:\b\wt\p2`（依存が入っている）を使い回し、ディスクをほとんど増やさずに、C-1 の `edits.patch` を型検査の誤りを手がかりに作る。ビルド・起動の確かめ・関門は、片づけの許可が入ってから行う。

## 入力

- `removals/C-1-ai/`（unit.json の ops、README の「消すもの」「残すもの」「型検査で直す点」の一覧）
- docs/03 の3節（unit.json の形）・4節の段階 C の表と末尾・5節（5.1 当て方、5.3 単位どうしを独立に保つ規則、拡張 API の何もしない実装を単位ごとの新しいファイルに置く形）・9節（Claude Code が使う受け手を消さない）
- `records/phase0/claude-code-manifest.md`（Claude Code が使う受け手と API）
- 段階 A・B の形: `removals/B-1-telemetry/`（残る部品が呼ぶコマンドを何もしない形で残した例）、`removals/B-2-*`（何もしないサービスを `registerSingleton` で差し替えた例）
- `tasks/2026-11-14-p5-units-c-prep/`（下準備の記録）、`tasks/2026-11-14-p5-verify-c-prep/`（下準備の検証）
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（型検査の手順 `typecheck`。`--from`・`--to`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` をタグ 1.146.0 に戻し（`git -C C:/b/wt/p2 checkout` と `clean` の許された形で。`node_modules` は消さない）、`apply.mjs` で有効な単位（A・B の14）と C-1 を当てる（`--only` に14単位と C-1）。
2. **型検査で直す**: `build.mjs --from typecheck --to typecheck`（または許可にある `npx --prefix C:/b/wt/p2 tsc --noEmit`）で誤りを出し、README の「型検査で直す点」を手がかりに直す。直しは作業ツリーで行い、`format-patch` で `removals/C-1-ai/edits.patch` に書き出す（B-1 の作り方にならう）。`unit.json` に `"patch": "edits.patch"` を足す。
   - 拡張 API（`vscode.lm`・`vscode.chat` など）は、README の1の表のとおり、新しいファイル `api/common/extHostRemovedApi.ai.ts` に何もしない実装を置く。Claude Code が使う API（`records/phase0/claude-code-manifest.md`）は、何もしない実装で壊れないか（例: 存在を確かめてから呼ぶか）を見て、README に書く。
   - Claude Code が使う受け手（docs/03 の9節）は消さない。消すか迷うものは消さずに README に書く。
3. **型検査が誤り 0 で通る**ことを確かめる。通らない誤りが残ったら、その一覧と、直せない理由を書いて止める。
4. **当て直しの確かめ**: タグに戻した素の作業ツリー（または同じ `C:\b\wt\p2` を戻して）で、A・B の14と C-1 を `apply.mjs` で当て直し、edits.patch が衝突なく当たり、型検査が通ることを確かめる。
5. **パッケージ化と zip はしない**（片づけの許可の後）。C: の空きを始めと終わりに記録する（`node scripts/disk-usage.mjs`）。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、型検査で直した点の一覧（ファイル・直し方）を書く。

## 守ること

- 書き込みは `removals/C-1-ai/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。
- `C:\b\p2\`・`C:\b\dist\` の既存の版を消さない、書き換えない。新しい作業ツリーを作らない（ディスクのため）。
- 本家のタグの作業ツリー `C:\b\wt\1.146.0` を書き換えない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。

## 完了条件

- `removals/C-1-ai/edits.patch` があり、A・B＋C-1 で型検査が誤り 0 で通る（または通らない理由がある）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、Claude Code の API への影響、テストの入口）、`typecheck-log.md`。

## 追加の依頼（2026-11-15、1回目の後）

1回目の判断を仰ぐ点の1〜4は、リーダーが認めた（`docs/user-decisions.md` の「C-1 の edits.patch を作るときに出た点」）。docs/03 も直した。パッケージ化の前に要る直しを、同じ edits.patch に足す。

1. `build/gulpfile.vscode.ts`: `@github/copilot-sdk` が無いと誤りを投げる所（46〜48行）、foundry・`copilotVersions`・Copilot のランタイムの梱包・shim・`compileCopilotExtensionBuildTask` を、C-1 で消した依存に合わせて直す。
2. `build/next/index.ts` のデスクトップの束ねに残る `agentHostCrypto` の入口を外す。
3. Agents の窓へのリンク（`app.ts` の `openAgentsWindow`、`windowImpl`・`protocolMainService`）を、開く先が無くても誤りにならない形にする（消すか、何もしない）。
4. `preferencesRenderers.ts` の MCP の設定の警告が、無くなったコマンドを指さないようにする（出ない見込みでも、コマンドの参照を残さない）。
5. `package.json` から C-1 で消した依存（`@github/copilot-sdk` など）が外れているかを確かめる。外すときはロックファイルの扱い（`pnpm install --lockfile-only` が許可にあるか）を書く。許可に無ければ走らせずに書く。
6. `build/` の側の型検査が走らせられるなら走らせる（たとえば本家の `build/tsconfig.json`）。走らせられなければ、その理由を書く。
7. 直したら、1回目と同じく、タグからの当て直し（15単位、衝突なし）と型検査（誤り 0）を確かめ、`handoff-notes.md` に「2回目」の節を足す。作業ツリーとディスクの守りは上と同じ。

## 追加の依頼（2026-11-15、2回目の後）

2回目の判断を仰ぐ点の1〜4はリーダーが判断した（`docs/user-decisions.md`）。docs/03 の5.4 と表も直した。

1. `scripts/lib/apply/lockfile.mjs` の `compareLockfile` を直す（許可する）: 単位が `pnpm-workspace.yaml` の `patchedDependencies` の行を消したとき、ロックファイルの `patchedDependencies` の節がその名前の分だけ減るのを許す。それ以外の節の変化と、ほかの名前の増減は今までどおり止める。直したら `--lockfile-check` が `ok` になることを確かめる（確かめた後にロックファイルを戻す）。
2. 依存の追加の削除は認める。`remote/pnpm-lock.yaml` は、片づけの後のビルドの依存の導入で見るので、今は作り直さない。
3. `chat.disableAIFeatures` の副作用は、読み手ごとに直す形で認める。
4. 「バージョン情報」の Copilot の2行を消す（`platform/dialogs/electron-browser/dialog.ts` を edits.patch に足す）。
5. 当て直し（15単位、衝突なし）と型検査（誤り 0）を確かめ直し、handoff-notes に「3回目」の節を足す。曹参が `compareLockfile` のテストと C-1 のテストの更新を並行して書く。

## 追加の依頼（2026-11-15、大岡越前守の検証の後）

大岡越前守の検証（`tasks/2026-11-15-p5-c1-verify/verification-ooka.md`）は、レビュー・型検査・run-all に不合格の点が無かった。ただ、タグへ戻す操作が許可に無く、当て直しが判定できなかった。軽微な指摘の1〜3を直し、作業ツリーをタグに戻して渡す。

1. 指摘1: `unit.json` の `kept` の理由（「リーダーの判断を仰ぐ」）と、README の古い記述（19行の依存、194行の「`scripts/` の変更が要る」）を、今の状態に合わせる。
2. 指摘2: `chatEntitlementService.ts` と `nullChatEntitlementService.ts` が互いに import し合う形をやめる。docs/03 の5.3（`workbench.*.main.ts` を edits.patch で直さない）を守る置き方にする。
3. 指摘3: `pnpm-workspace.yaml` の `allowBuilds` に残る、外した依存の項目（`foundry-local-sdk@2.2.1`・`ssh2` など）を `removeLines` で外す。ほかの単位が使う名前は残す。
4. 指摘4（build/ の残り）は、手元のパッケージ化から呼ばれないので直さない。README の「残すもの」か「未確認」に書く。
5. edits.patch を作り直し、タグからの当て直し（15単位）と型検査（誤り 0）を確かめる。
6. **確かめた後、`C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**（`git -C C:/b/wt/p2 checkout 1.146.0`。未コミットの変更 0。git の管理外の `build/lib/policies/policyDto.ts` はそのままでよい。`node_modules` は消さない）。大岡越前守が自分で15単位を当てる。
7. handoff-notes に「5回目」の節を足す。

## 結果

採用。C-1 の `edits.patch`（108ファイル、新規は `api/common/extHostRemovedApi.ai.ts` の1つ）と `unit.json` を5回で仕上げた。A・B の14と C-1 を当てて型検査は誤り 0。`compareLockfile` を、単位が消したパッチの名前の分だけ `patchedDependencies` が減るのを許す形に直した。判断は `docs/user-decisions.md` の 2026-11-15 の2つの表。大岡越前守の再検証で「パッケージ化の前まで」合格（`tasks/2026-11-15-p5-c1-verify/verification-ooka.md`）。`enabled` は `false` のまま（関門の後に有効にする）。

## 未解決

- ビルド（パッケージ化）・起動・関門は、古い版の片づけの許可の後（`docs/user-decisions.md` 2026-11-15）。
- ロックファイルの検査を検証役が自分で作り直して確かめること（ルートと `remote/`）、本物の `pnpm install` の警告、起動時の DI と拡張ホストのログ（`vscode.lm`・`vscode.chat`）は、関門で見る。
- 消せずに残る殻のファイル（`tests/removals/c1-check-*.mjs`、`*.round2.tmp`、`handoff-notes-round2-part.md`）。コミットしない。

## 次の担当

cao-shen（曹参）: C-1 の検査（`tests/removals.test.mjs` など）。ooka-echizen（大岡越前守）: edits.patch の検証。片づけの許可の後、ビルドと関門。

## 追加の依頼（2026-11-15、C-4 のテストの直しで見つかった門の抜け）

曹参が門の検査の期待を本家から読む形に直したところ、C-1 の何もしない実装に門の抜けが1つ見つかった（`tasks/2026-11-15-p5-c4-tests/handoff-notes.md` の「2回目」の「C-1 の抜け」）。判断は `docs/user-decisions.md` の「C-6 の edits.patch と、C-4 のテストの直しで出た点」。

1. `extHostRemovedApi.ai.ts` の `lm.registerToolDefinition` の最初の文に、本家（`extHostLanguageModelTools.ts`）と同じ `checkProposedApiEnabled(extension, 'languageModelToolSupportsModel')` を足す。README の門の一覧にも足す。
2. 本家の C-1 が消す拡張ホストのファイルの `checkProposedApiEnabled`・`isProposedApiEnabled` を全部、何もしない実装と突き合わせる（C-4 の2回目の表の形）。呼べない所の門（`languageModelSystem`・`mcpToolDefinitions`）は、なぜ要らないかを書く。
3. 作業ツリーをタグに戻し、A・B の14と C-1 を当てて edits.patch を作り直す。タグからの当て直し（15単位）と型検査（誤り 0）、`--lockfile-check` を確かめる。あわせて C-1〜C-6 の20単位の組でも当て直しと型検査を確かめる（C-1 の直しが後の単位の文脈を崩さないこと）。
4. 終わったら作業ツリーをタグ 1.146.0 に戻す。handoff-notes に「6回目」の節を足す。

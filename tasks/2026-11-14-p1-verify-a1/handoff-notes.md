# 引き継ぎ: Phase 1 の検証（p1-ci-events の直しと、A-1 を当てた 1.146.0 のビルド・zip・起動）

- 作成: 大岡越前守（2026-11-14）
- 宛先: ヴラド・ツェペシュ
- 詳細: `verification-log.md`（同じフォルダ）。run-all の出力は `run-all-output.txt`。Phase 1 の関門の記録は `records/phase1/gate-1.146.0-p1-a1.md`

## 判定

**合格**（brief の1〜5のすべて）。

| # | 項目 | 判定 |
|---|---|---|
| 1 | 直し（`p1-ci-events.ps1`） | **合格**。run-all は fail 0 |
| 2 | 当てたもの | **合格** |
| 3 | ビルド | **合格** |
| 4 | 起動 | **合格** |
| 5 | Phase 1 の関門（「zip から起動する」「所要時間とディスクの記録がある」） | **合格**。Claude Code の組は対象外で、まだ閉じていない |

## 確かめた成果

- 蒙恬: `scripts/p1-ci-events.ps1` の直し、`doc-corrections.md` の A8 の追記、`tasks/2026-11-14-p1-build-a1/` の A-1 のビルド・zip・起動とその記録
- 曹参: `tests/p1-scripts.test.mjs`（今回は走らせて結果を見ただけ。前回、元の台本で落ちたことは確かめてある）

## 根拠

1. **直し**
   - 54〜56行は、`[string]$_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'` で見分ける。訳される文言を見ないので、言語によらない。ほかの誤りは、これまでどおり `readable: false` と `error` になる。ASCII 以外は 0 バイト。
   - `node --test tests/p1-scripts.test.mjs` を2回走らせ、どちらも 27/27。前回落ちた「当たるイベントが無いとき readable:true・count 0（日本語の Windows でも）」も通る。
   - `node tests/run-all.mjs` は終了コード 0。**TOTAL 1500、pass 1479、fail 0、skip 21**（前回は fail 1。ほかのファイルの件数は前回と同じ）。
2. **当てたもの**
   - `take-in-r2/checks.json` の中身:
     - `only` は A-1 だけ
     - `overlay.set`・`removed` は空、`patches` は `[]`、`assets.applied` は `none`
     - `builtinExtensions.copied` は mydist だけ
     - A-1 は `applied: ok`（delete 2、removeLines 8/8、edits は衝突なし）、`result: ok`
   - 作業ツリーを本家の作業ツリー `C:\b\wt\1.146.0` とハッシュで比べた。違うのは `package.json`・`build/npm/dirs.ts`・`build/npm/postinstall.ts`・`build/lib/copilot.ts`（どれも A-1 が触るもの）だけ。`product.json` など5つは同じ。中身も読んで、A-1 の removeLines と edits.patch のとおりであることを確かめた。HEAD は `72f45433…` で、記録と一致した。
3. **ビルド**
   - `build-record-r2.json` の6手順は、どれも ok・終了コード 0。`package.log` の131行に「Finished 'vscode-win32-x64-min' after 2.57 min」、126行の `<anonymous>` は 1 ms。install・typecheck・zip・lockfile のログに誤りの行は無い。
   - 所要時間の合計 410 秒（6.8 分）、C: の空きの減り 2,507,313,152 バイト（2.33 GB）、作業ツリー・出力・zip の大きさは、記録どうしで一致した。
   - zip の SHA-256 を `sha256sum` で計算し直した。`9348d66c…32b1` で、記録と一致した。
   - A-1 の検査（remnants・absentStrings 5つが 0 件・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity）は ok。lockfile.diff の中身は、`extensions/copilot/pnpm-lock.yaml` の削除だけ。
4. **起動**
   - `launch-check.json` は `ok`。台本は 15 秒の待ちの後にもう一度 `HasExited` を見て、`aliveAfterCheck: true` だった。8プロセス。展開したものと gulp の出力は、主なファイルのハッシュが一致した。
   - `ci-events.json` は6件（3つのファイルについて 3033 と 3077 が1件ずつ）。止められたのは deviceid・keymapping・iselevated で、ポリシーは `VerifiedAndReputableDesktop`。
   - `main.log` の `[error]` は、deviceid の2回（2・56行）と AgentHost の wasm（103・105行）だけ。
   - 普段使いのデータの4か所は、前後とも無い（記録による。読める場所の外なので、直接は見ていない）。

## run-all と notion-sync の途中の状態

**run-all は、蒙恬が直している途中の notion-sync に当たった。** 走らせた時点の `extensions-src/notion-sync/` には、まだコミットされていない変更があった。

- `package.json`: `jsonc-parser` を `dependencies` から `devDependencies` へ移した。
- `pnpm-lock.yaml`: これに合う変更。
- `README.md`: 表の1行。

この状態のまま、`cli-run.test.mjs`（写した先での `pnpm install --frozen-lockfile` と build を含む）、`notion-sync.test.mjs`（101件）、`apply-parts.test.mjs` はどれも通った。走らせている間に、3つのファイルのハッシュは変わらなかった。ただし、これは notion-sync の直しの検証ではない。直しが終わったら、改めて確かめる必要がある。

## 不合格の点

なし。

## 気づいた点（合否には響かない。直すかどうかは任せる）

1. `build-record-r2.json` の `units` が `[]`。`build.mjs` は apply の手順を自分で走らせたときだけ `units` を埋める（612行）。A-1 が当たったことは、`postprocess.extensions.unitIds` と `checks.json` に残っている。ビルドの記録だけを見る人が誤読しないよう、`--from install` のときも `checks.json` から埋める案がある（蒙恬）。
2. `doc-corrections.md` の A8 の「起動しない」が、今回の結果（止められても起動が続いた）と合わない。蒙恬が判断を仰ぎたい点の3で挙げているとおり。docs/07 の4節は、すでに今回の結果に合わせてある。
3. `a1-inputs/extensions-src/mydist/ThirdPartyNotices.txt` は、元のファイルと改行だけが違う（元は CRLF と LF が混ざっている）。文面は同じ。
4. build-log.md の4節の起動の時刻「〜20:15:45」は、ログ（`agenthost.log` の最後の行が 20:15:56）より 10 秒ほど早い。
5. `p1-ci-events.ps1` の出力で、ID 3033 の行は `file`・`process`・`policy` が `null` になる（ファイル名は `message` に入っている）。
6. `agenthost.log` の35行に「Unable to resolve @github/copilot SDK runtime paths」の誤りがある。build-log.md の 4.2 には載っていない。本体の AI（C-1 で消す部品）の誤りで、起動は続いた。
7. 起動の結果は、Smart App Control がオンのときのもの。その後、ユーザーがオフにした（裁定）。

## 未解決（権限）

より直接に確かめるには、次の許可が要る。足すかどうかはユーザーの承認が要る。

1. `git -C C:/b/wt/p1-a1 diff --stat <tag> HEAD`（または `git -C C:/b/wt/p1-a1 status`）: 作業ツリーのすべてのファイルについて、A-1 の範囲の外の変更が無いことを確かめるため。今回はハッシュで比べた範囲（10ファイルと拡張の一覧）だけを確かめた。
2. `%APPDATA%\Code` などの普段使いのデータの場所を読む許可: 触れていないことを、記録によらずに確かめるため（前回と同じ）。

## 次の担当

- リーダー: 合格なので、コミットしてよい。走らせた時点の notion-sync は直しの途中だったので、コミットに含めるかは蒙恬の完了を待って決める。
- Smart App Control はオフになった。Claude Code の組（スモーク）へ進む。

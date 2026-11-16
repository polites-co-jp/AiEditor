# 直し: C-1 が消した product.json のキーを、残る本家のコードが読んで止まる

- 担当: meng-tian（蒙恬）。テストは cao-shen（曹参）
- 依頼日: 2026-11-16
- 状態: 依頼中

## 目的

段階 C の版 `1.146.0-p5-c-all` の関門が不合格だった（`records/take-in/1.146.0-p5-c-all/gate-C-1-ai.md`）。C-1 の `productRemove` が product.json から `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` などを外し、残る本家のコードが `?.` なしで読むので、ワークベンチが立ち上がらず、CLI の `--install-extension` も落ちる。判断は `docs/user-decisions.md` の「段階 C の版の関門で出た点」: 裁定「product.json の AI のキーは消す」のまま、読む側を直す。

## やること（蒙恬）

1. **読み手を全部探す**: C-1 の `productRemove` の全部のキーについて、21単位を当てた木（`tmp\b\wt\1.146.0`。読むだけ）で、残るコードの読み手を探す（`product.<key>`・`productService.<key>`・分割代入など）。大岡越前守の表（`gate-C-1-ai.md`）の8か所に限らない。C-1 の後の単位（C-2〜C-7）が消すファイルは除く。
2. **直す**: キーが無いときに空（`undefined`・空の配列・何もしない）として扱う直しを、**C-1 の edits.patch に足す**。作業ツリーへ直接 git を打つ許可は `C:/b` 前提で `tmp/b` に当たらないので、`removals/C-1-ai/edits.patch` の本文を直接直す（ハンクの見出しの行数に気をつける）。直したら `node scripts/build.mjs 1.146.0 --label <l> --from apply --to typecheck`（または許可にある形）で、作業ツリーをタグから当て直して型検査まで走らせ、当たることと誤り 0 を確かめる。作業ツリーをタグに戻す手順が台本に無くて止まるなら、そこで止めて書く。
3. **起動の確かめを強くする**: `scripts/p1-launch-check.ps1` がワークベンチが立ち上がったか（たとえば renderer のログ、ワークベンチの準備のしるし）を見るようにする。プロセスが生きているかだけで ok にしない。
4. **版を作り直す**: 直した後、21単位の版をもう一度最後までビルドする（label `1.146.0-p5-c-all-r2`）。`p1-launch-check.ps1` で、ワークベンチが立ち上がり、CLI の `--install-extension` が通ることを確かめる。
5. C:\b は読むだけ・消さない・書かない。`--build-root` に C:\b を渡さない。

## やること（曹参）

1. `c1-unit.test.mjs` に、C-1 の `productRemove` のキーを、21単位の木の残るコードが `?.` やけがの無い形でしか読まないことの静的な検査（本家のタグの木から読み手を拾い、edits.patch で直されているか）を足す。期待は本家から読む。
2. スモークの `tests/smoke/lib/common.mjs` の `extractChromiumErrors` が、`INFO:CONSOLE` で出るコンソールの誤り（`Uncaught`・`TypeError` など）も拾うようにする。今回の chromium.log の行でテストする（`records/take-in/1.146.0-p5-c-all/` か、スモークの実行のフォルダの記録）。
3. `c2〜c5-check-json.mjs` に21単位の組を足す（c6・c7 と同じ形）。
4. 蒙恬の3（`p1-launch-check.ps1` の新しい確かめ）のテスト。
5. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは、蒙恬が `removals/C-1-ai/`・`scripts/`・`tasks/`、曹参が `tests/`・`tasks/`。C:\b は読むだけ。`tmp\b` の作業ツリーは台本を通して使う。
- 普段使いのエディタのデータと、秘密の場所に触れない。

## 完了条件

- 直した版 `1.146.0-p5-c-all-r2` でワークベンチが立ち上がり、CLI の導入が通る。曹参のテストがあり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`・`handoff-notes-cao-shen.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 直した版でもう一度関門。

## 追加の依頼（2026-11-16、r2 の関門の後）

r2 の関門（`records/take-in/1.146.0-p5-c-all-r2/gate-C-1-ai.md`）で、C-1 にワークベンチが動いて初めて見える誤りが3種出た。判断は `docs/user-decisions.md` の「段階 C の版 r2 の関門で出た点」。

### 蒙恬

1. `ITerminalChatService` の UNKNOWN service: 何もしない実装を登録するか、注入を外す（小さい方。`services/chat` の `NullChatEntitlementService` と同じ形が第一）。
2. `searchView.ts` の `semanticSearchBehavior` など（695・2002・2008行）: `?.` で守り、設定の型を省略できる形にする。
3. `_chat.editSessions.accept`: 何もしないコマンドとして残す（B-1 の `_aiEdits.*` と同じ形）。
4. **同じ種類の残りを全部探す**: C-1 が消した部品（サービスの ID・設定のキー・コマンドの ID・文脈キー）を、21単位の木の残るコードと組み込み拡張（`extensions/`）が使っていないかを探し、見つけたものも直す。今回の3つに限らない。
5. 直し方は前と同じ（edits.patch の本文を直し、`build.mjs` で当て直しと型検査）。21単位の版 `1.146.0-p5-c-all-r3` を作り直し、`p1-launch-check.ps1` で確かめる。

### 曹参

1. C-1 の検査に、消した部品の「注入（`@I…Service`・`accessor.get`）・設定のキーの読み手・コマンドの呼び手（`executeCommand`、組み込み拡張を含む）」が残っていないことを見る検査を足す。期待は本家から読む。ほかの単位（C-2〜C-7）にも同じ網をかけられるなら、共通の部品にする。
2. スモークの devtools-console の誤りの鍵から、版の置き場所のパスを外す（置き場所の違う版どうしで同じ誤りを同じと見る）。
3. 蒙恬の4の結果に合わせたテスト。`run-all` の件数。

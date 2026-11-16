# 曹参の引き継ぎ: C-1 のキーの検査とスモークの誤りの拾い方

- 依頼: tasks/2026-11-16-p5-c1-product-keys/brief.md の「やること（曹参）」1〜5
- 日付: 2026-11-16
- 状態: 下の「結果」に書く（run-all の数が出たあとで更新）

## 結果

(run-all の完了後に記入)

## 作ったもの・直したもの

| 項目 | 場所 | 中身 |
|---|---|---|
| 1 | tests/c1-unit.test.mjs（末尾の節3） | productRemove のキーの読み手の静的な検査 |
| 2 | tests/smoke/lib/common.mjs、tests/smoke.test.mjs | extractChromiumErrors の直しとテスト |
| 3 | tests/c2〜c5-check-json.mjs、tests/c-all-check-json.test.mjs（新規） | 21単位の組（kind 'c'） |
| 4 | tests/p1-launch-workbench.test.mjs（新規） | p1-launch-check.ps1 のワークベンチの確かめ（仕様から先に書いた。落ちる状態） |
| 5 | tasks/2026-11-16-p5-c1-product-keys/run-all-result.json | run-all の記録 |

## 1. c1-unit: productRemove のキーの読み手

- 期待は本家のタグ 1.146.0 から読む（`git grep` で src の中のキーを含む行を拾い、実装の一覧から写さない）。
- 拾い方: 受け側の変数名に `product` を含む `.キー` / `?.キー`、`const { キー } = product…`、`product['キー']`。
- 安全な形: 後ろが `?.` `??` `||` `&&` 比較 三項の条件、前が `!` `typeof` `Array.isArray(`（ただし後ろが `.` `[` `(` なら掛かるのはキーでないので安全にしない）、同じ行の前に同じ読みを条件にしたもの。
- 対象から外す: 21単位（A-1〜C-7）の delete が消すファイル、テストのファイル。
- 「直された」の判定: 21単位の edits.patch のどれかが、その行（trim して一致）を消している。または、edits.patch が product の既定に `キー: []` を足している（配列のキーだけ。`{}` は `.a.b` で落ちるので認めない）。
- 例外 SAFE_BY_REASON: 大岡越前守の gate-C-1-ai.md の読み（trustedExtensionAuthAccess・sessionsWindowAllowedExtensions・voiceWsUrl・agentsTelemetryAppName）の5行。本家にその行が無くなれば「古い例外」で落ちる。
- edits.patch が足す行にも、落ちる読み方が無いこと。
- 自己検査（今の edits.patch に左右されない）: 何も直さない→直っていない扱い、全部直す→0、1か所残す→その1か所、配列の既定を足す→配列のキーだけ 0、危ない行を足す→足した行の検査に出る。
- 本家のタグで拾えた、落ちる形の読み手は **10か所**（大岡越前守の表の8か所＋`extensionGalleryService.ts:2058・2061` が別行、`defaultAccount.ts:158・1668`、`extensionsWorkbenchService.ts:3000` を含む）。表と合うことを、「読み手が拾えている」の検査が、表にある6か所の場所で見張る。
- 今の結果（蒙恬が途中まで直した edits.patch で）: 10か所のうち5か所が直っていて、5か所が残る（下の「実行結果」）。

## 2. extractChromiumErrors（見つけた 2 つの穴）

1. **行の形が読めていなかった**。実際の行は `[59188:1116/115143.357:INFO:CONSOLE:1847] "..."` で、`pid:` の次が時刻（tid が無い）。今の正規表現は `pid:tid:時刻` か `時刻` だけを認めたので、この行は **ERROR でも読めない**。`(?:(\d+):)?(?:(\d+):)?` に直した。
2. `INFO`・`WARNING` の `CONSOLE` は、本文が誤りの形（`"Uncaught` / `"Unhandled` / `TypeError` 等の名前つきの誤り / `UNKNOWN service`）のときだけ拾い、group は `devtools-console`。普通の `console.log` は拾わない（`errors.new` が毎回落ちないように）。

テスト（tests/smoke.test.mjs）: 今回の実際の行そのもの（gate-C-1-ai.md の1行）、拾う・拾わない行の混ぜ、ERROR の既存の挙動、`newErrors` で前の版の鍵が無ければ新しい誤りとして出ること。

注意（未解決の点にも書いた）: 実際の行を gate の記録からそのまま写した。スモークの実行のフォルダの chromium.log は読んでいない（tmp\b の中は見ていない）。

## 3. c2〜c5-check-json の21単位の組

- kindOf に `'c'` を足した（C-7 が入っていれば c。c6・c7 と同じ見分け方）。UNITS_C を export。
- b の見方（C-2 の警告1件、C-1 の foundry-local-sdk のパッチの節の減り）をそのまま c にも当て、さらに「自分の後ろに当たる単位（c2: C-3〜C-7、c3: C-4〜C-7、c4: C-5〜C-7、c5: C-6・C-7）の edits が ok で衝突なし」と並びの順を見る。
- tests/c-all-check-json.test.mjs（新規）: 21単位の最小の記録を作り、c2〜c5 それぞれで「期待どおり」「20単位（C-7 なし）は c にならず余計な単位で食い違い」「欠け・適用・並び・edits の衝突と未適用・警告・errors・absentStrings・commitIdentity・ロックファイル・コミットの並び」の食い違いを見つける。
- 実際の21単位の記録（版 `1.146.0-p5-c-all-r2`）はまだ無い。出たら大岡越前守が `node tests/c2-check-json.mjs <checks.json> <typecheck.json>`（c3〜c5 も）で 0 になることを確かめる。
- 既存の a・b のテスト（c2〜c5-check-json.test.mjs）は変えていない。

## 4. p1-launch-check.ps1 のワークベンチの確かめのテスト

**蒙恬の handoff-notes がまだ無かったので、仕様だけから書いた。落ちる状態**（意図どおり）。

想定した入口:
- 結果の JSON に `workbench` の欄がある
- ok の判定が、生きている（`$alive`）・普段使いのデータが変わっていない（`$changed`）に加えて、ワークベンチの準備を条件にする（ok を入れる所は1つ）
- 準備ができていないとき、message が workbench に触れる
- 見る材料はログ（renderer.log か chromium.log）、コンソールの誤り（Uncaught・TypeError・INFO:CONSOLE）が出ていれば ok にしない
- 説明（.DESCRIPTION）に workbench が書かれる

今も通る検査（退行の見張り）: 台本が ASCII だけ、PowerShell の構文として読める。
実装を要する検査 6件: 上の想定の入口。蒙恬の実装と入口が違うときは、実装を変えるか検査を変えるかを決めてから直す（どちらが正しいかはここでは決めない）。
本物のエディタを起動する偽の確かめは書いていない（ログの置き場所を差し替える引数などの入口が決まってから足す）。

## 実行結果

(run-all の完了後に記入)

## 未解決の点

(完了後に記入)

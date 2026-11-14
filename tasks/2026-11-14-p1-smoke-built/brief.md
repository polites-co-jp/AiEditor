# Phase 1 の締め: A-1 を当てたビルドで Claude Code の組（スモーク）を通す

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了（不合格）

## 目的

Phase 1 の完了の条件の残り「Claude Code の組が通る」（docs/07 の4節の4）を確かめる。Smart App Control はユーザーがオフにした（2026-11-14。`VerifiedAndReputablePolicyState` 0 をリーダーが確かめた）。A-1 を当てた 1.146.0 のビルドの出力に、台帳の拡張を入れてスモークを走らせる。

## 入力

- `records/phase1/gate-1.146.0-p1-a1.md`（関門の記録。A-1 を当てた版の zip・起動の合格）
- `records/phase1/smoke-verify2-official-1.146.0.md`（公式の zip で走らせたときの形と結果。PASS 47）
- `tests/smoke-run.mjs`（`--build`・`--mode built`・`--label`・`--prime`・`--baseline`・`--timeout`）と、その README
- ビルドの出力: `C:\b\wt\VSCode-win32-x64\`（zip `C:\b\dist\1.146.0-p1-a1-r2.zip` と同じ中身。検証で確かめ済み）。新しく展開した方がよければ zip を `C:\b\smoke\` の下などに展開する
- 基準: `C:\b\smoke\baseline-official-1.146.0.json`
- docs/07 の4節、docs/06 の5節（スモークの組）

## やること

1. 単体テスト `node --test tests/smoke.test.mjs` を走らせる。
2. スモークを走らせる。例: `node tests/smoke-run.mjs --build C:/b/wt/VSCode-win32-x64 --label p1-a1 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300`（引数は台本の README に合わせる）。
3. 結果を記録する: PASS・FAIL・SKIP・INFO の数、`claude-code` の組の各項目、`errors.new`（公式の基準に無い誤り）。とくに、Smart App Control がオンのときに止められていた `@vscode/deviceid`・`native-keymap`・`native-is-elevated` の誤りが消えたか。A-1 で消した copilot の拡張に由来する差分（項目が無くなったなど）は、A-1 の範囲として分けて書く。
4. 判定: 本家の公式の zip との違いが、A-1（copilot を消した）と、ビルドの形の違い（Code - OSS・上書き無し）で説明できるか。説明できない FAIL があれば、不合格として要点を書く。
5. このビルドは product.json の上書きを当てていないので、`extensions.allowed` の効き方は Phase 2 に回す。言語パックと mydist の既定は、スモークで見られる範囲で書く。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・スモークの置き場所（`C:\b\smoke\`）だけ。
- 普段使いのエディタのデータに触れない（台本が `VSCODE_PORTABLE` などで分ける）。PC の設定を変えない。
- Claude Code のパネルから本物の送信はしない（台本の範囲だけ）。

## 完了条件

- 1〜4 に結果と合否がある。

## 成果物

- `records/phase1/smoke-built-1.146.0-p1-a1.md`（スモークの記録）
- このディレクトリに `handoff-notes.md`（報告）

## 結果

不合格。PASS 43 / FAIL 5。Claude Code の自動の3項目は PASS。原因は出力の product.json に `commit` が無いこと（作業ツリーの `.git` がファイルで本家が HEAD を読めない）。ターミナル・タスク・PowerShell・言語パックが落ちた。直しは `tasks/2026-11-14-build-commit-fix/`（リーダーの判断: 作業ツリーの HEAD を入れる）。Smart App Control の阻止はログに出なかった。

## 未解決

- 直したビルドでスモークをやり直す。
- 検証役が `p1-ci-events.ps1` を走らせる許可。

## 次の担当

リーダー: 合格なら Phase 1 を閉じ、Phase 2（上書きと mydist、A-1〜B-7 を1単位ずつ）へ。

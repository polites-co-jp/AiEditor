# 引き渡しの覚え: build.mjs の commit の直しの検証と、A-1 r3 のスモークのやり直し（大岡越前守）

## 判定: 合格（Phase 1 の関門を閉じてよい）

## 確かめた成果

- 蒙恬: `scripts/build.mjs` の直し（型検査とパッケージ化に `BUILD_SOURCEVERSION`、後処理の commit の確かめ、`--from install` の units）と、作り直した zip `C:\b\dist\1.146.0-p1-a1-r3.zip`
- 曹参: `tests/build-commit.test.mjs`（21件）

## 根拠（要点）

1. 直しのレビュー: 合格。BUILD_SOURCEVERSION を足すのは typecheck・package の子だけ（`envForStep`）。後処理の結線は、検証役が r3 の展開したものに流して確かめた。一致なら ok（`ppcheck-r3-match.json`）。HEAD が違う作業ツリーなら終了コード 1・`stoppedAt: postprocess`（`ppcheck-r3-mismatch.json`）。commit が無い場合は蒙恬の `ppcheck-r2-before.json` を読んで確かめた。`--from install` の `units` は `build-record-r3.json` で埋まっている（`applyRan: false`）。本家の木は変えていない（`uncommittedEntries: 0`、HEAD = checks の `headCommit`）。
2. テスト: `node --test tests/build-commit.test.mjs` は 21/21。`node tests/run-all.mjs` は TOTAL 1521、pass 1500、fail 0、skip 21（`run-all-result.txt`）。
3. 作り直した版: zip の SHA-256 `e9215f2c…996c` は一致。作業ツリーの HEAD（`C:\b\vscode\.git\worktrees\p1-a1\HEAD`）は `cff68091803f933ffbd34c93d1a7dc14633f7a72` で、展開した product.json の `commit`、記録の `sourceVersion.value` と同じ。
4. スモーク: PASS 48 / FAIL 1。前回の FAIL 5 のうち、base.terminal・base.task・lang.ps1.session・base.ui-language は PASS。errors.new は 9 件から 3 件に減った。残り3件（トンネル ×2、Claude Code の Remote Control ×1）は、Code - OSS の product.json と A-1 で説明できる（Remote Control は推定を含む）。claude-code の自動の3項目は PASS。
5. 関門: docs/07 の4節の3条件（zip から起動・Claude Code の組・所要時間とディスク）を満たす。手の項目は Phase 2 の最後にユーザーが行うので対象外。

## 依頼書と違うところ

- zip は `C:\b\smoke\` の下に展開していない。検証役の許可に、展開するコマンドが無いため。代わりに、蒙恬の `p1-launch-check.ps1` が同じ zip を展開した `C:\b\p1\1.146.0-p1-a1-r3\Code-OSS-win32-x64-1.146.0-p1-a1-r3\` に向けた。
  - gulp の出力は使っていない。ファイルの数は 2,612 で、出力と同じ。
  - ポータブルのデータはエディタのフォルダの外にあり、スモークは自分の置き場所を渡す。
  - 25 秒の起動を1回した後のものなので、厳密には新しく展開したものではない。
  - 新しく展開して流し直すべきなら、展開の許可（例: `scripts/p1-launch-check.ps1`、または `tar.exe -x`）が要る。

## 直す必要のある点（合否には使わない、軽微）

- 蒙恬（`scripts/build.mjs`）: `stepEnv` の注には「外の BUILD_SOURCEVERSION はどの手順でも上書きか削除する」とあるが、そうなっていない。prepare・apply・install・lockfile は `childEnv` の env をそのまま使うので、親に BUILD_SOURCEVERSION があると漏れる。直すなら、`childEnv` でこの変数も外す。
- 曹参（`tests/build-commit.test.mjs`）: 後処理が commit の欠け・食い違いで本当に止まること（`--from postprocess` の結線）のテストが無い。上の漏れも、main の結線のテストが無いので見つからない。

## リーダーへ（docs/ と判断）

- docs/02 の4節の7と109行に、`BUILD_SOURCEVERSION` を渡すことと、後処理で `commit` を確かめることが無い。7節の記録の例に `sourceVersion` が無い。CLAUDE.md の「資料を直してから先へ」に当たる。
- BUILD_SOURCEVERSION を渡すと、A-1 を当てない版では copilot の `.esbuild.mts` が `VSCODE_QUALITY` を求めて止まる（`1.146.0-p2-base` が落ちた。蒙恬の未解決の点）。1.147.0 以降の扱いに判断が要る。この検証では確かめていない。
- スモークの `claude.exe` が `C:\Users\kou_z\.claude\projects\c--b-smoke-runs-...-ws\` を見に行っている。ユーザーの `~/.claude` の下に、スモークのための項目ができるかもしれない（検証役は読めないので未確認）。
- 前の記録 `smoke-verify2-official-1.146.0.md` が指す `C:\b\smoke\runs\official-20261113T141800\` には `.keep` が無い。今回は消えなかった（`.keep` 無しは 9 個で、上限は 10）。ただし、次にスモークを1回走らせると消える。残すなら `node tests/smoke-stop.mjs --mark-keep official-20261113T141800`（検証役の許可の範囲で打てる。今回は依頼の外なので打っていない）。

## 記録

- `records/phase1/smoke-built-1.146.0-p1-a1-r3.md`（スモークの記録）
- `records/phase1/gate-1.146.0-p1-a1.md`（末尾に関門の結びを追記）
- `tasks/2026-11-14-verify-commit-fix/verification-log.md`（詳細と流したコマンド）
- `tasks/2026-11-14-verify-commit-fix/run-all-result.txt`、`ppcheck-r3-match.json`、`ppcheck-r3-mismatch.json`
- スモークの置き場所: `C:\b\smoke\runs\p1-a1-r3-20261114T125247\`（`.keep` 付き）

# 検証: build.mjs の commit の直しと、作り直した A-1 の版（r3）でのスモークのやり直し

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

前回のスモークは、出力の product.json に `commit` が無いことで不合格だった（`tasks/2026-11-14-p1-smoke-built/`）。蒙恬が `build.mjs` を直し（作業ツリーの HEAD を `BUILD_SOURCEVERSION` で渡す。リーダーの判断）、曹参がテストを書いた。直しを確かめ、作り直した zip でスモークをやり直して、Phase 1 の関門を閉じる。

## 入力

- `tasks/2026-11-14-build-commit-fix/`（brief.md、handoff-notes-meng-tian.md、handoff-notes-cao-shen.md、build-log.md、build-record-r3.json、launch-check-r3.json、take-in-r3/）
- `scripts/build.mjs` の差分、`tests/build-commit.test.mjs`
- zip: `C:\b\dist\1.146.0-p1-a1-r3.zip`（パスと SHA-256 は蒙恬の handoff-notes）
- 前回のスモーク: `records/phase1/smoke-built-1.146.0-p1-a1.md`、`tasks/2026-11-14-p1-smoke-built/brief.md`（やり方）

## やること

1. **直しのレビュー**: `BUILD_SOURCEVERSION` が型検査とパッケージ化の子だけに渡ること、後処理が `commit` の欠け・食い違いで止まること、`--from install` で `units` が埋まること。本家のコードを変えていないこと。
2. **テスト**: `node --test tests/build-commit.test.mjs` と `node tests/run-all.mjs`（件数）。
3. **作り直した版**: zip の SHA-256、zip の中の product.json の `commit` が作業ツリーの HEAD と一致すること、ビルドの記録の `sourceVersion`。
4. **スモークのやり直し**: zip を `C:\b\smoke\` の下などに展開し、前回と同じ引数で `smoke-run.mjs` を走らせる（`--build <展開した場所> --label p1-a1-r3 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300`）。前回の FAIL 5（base.terminal・base.task・lang.ps1.session・base.ui-language・errors.new）が消えたか。残った違いを、A-1 と「Code - OSS・上書き無し」で説明できるか。
5. 判定: docs/07 の4節の完了の条件（zip から起動し、Claude Code の組が通り、所要時間とディスクの記録がある）を満たすか。手の項目（パネルからの送信、統合ターミナルの `claude` の接続）は Phase 2 の最後にユーザーが行うので、対象外と書く。

## 守ること

- コードは直さない。書き込みは `records/`・`tasks/`・`C:\b\smoke\` だけ。
- gulp の出力 `C:\b\wt\VSCode-win32-x64\` は、蒙恬の Phase 2 のビルドが上書きしている途中なので使わない。zip を展開したものを使う。
- 普段使いのエディタのデータに触れない。PC の設定を変えない。

## 完了条件

- 1〜5 に合否と理由がある。

## 成果物

- `records/phase1/smoke-built-1.146.0-p1-a1-r3.md`、`records/phase1/gate-1.146.0-p1-a1.md` への追記（Phase 1 の関門の結び）
- このディレクトリに `verification-log.md`、`handoff-notes.md`

## 結果

合格。Phase 1 の関門を閉じた。スモーク PASS 48 / FAIL 1（errors.new の3件はトンネル×2・Remote Control×1 で、Code - OSS の product.json と A-1 で説明できる）。run-all 1521 件、fail 0。

## 未解決

- 軽微: `childEnv` が外の `BUILD_SOURCEVERSION` を外さない（蒙恬）、後処理の結線のテストが無い（曹参）。Phase 2 のビルドの後に直す。
- zip を新しく展開する許可が検証役に無い。
- スモークの `claude.exe` がユーザーの `~/.claude/projects/` に項目を作るかもしれない（未確認）。

## 次の担当

リーダー: 合格なら Phase 1 を閉じ、Phase 2 の版ごとの関門へ。

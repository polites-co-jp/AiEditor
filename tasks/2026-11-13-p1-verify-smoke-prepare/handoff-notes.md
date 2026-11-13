# 引き継ぎ: Phase 1 の検証（1）

- 作成: 大岡越前守（2026-11-13）
- 宛先: ヴラド・ツェペシュ
- 詳細: `verification-log.md`。実行の記録: `records/phase1/smoke-verify-official-1.146.0.md`

## 判定

| 成果 | 判定 |
|---|---|
| 曹参のスモークの台本（`tests/smoke-*.mjs`・`tests/smoke/`・`tasks/2026-11-13-p1-smoke/`） | **不合格**。安全の項目は満たすが、直す点が5つある（下） |
| 曹参の単体テスト `tests/smoke.test.mjs` と、公式の zip での実行 | **合格**。46/46 が通った。実行は PASS 44 / FAIL 0 で、申告と合う |
| 蒙恬の `scripts/check-env.ps1` | **合格**（レビュー）。軽微な指摘が1つある |
| 蒙恬の `scripts/prepare.mjs` | **合格**。軽微な指摘が1つある |
| `upstream.json` | **合格** |
| `C:\b\wt\1.146.0` の HEAD | **合格**（`69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| `C:\b\wt\1.146.0` に変更が無いこと | **判定できない**（許可が無い。記録の上では変更なし） |
| `check-env.ps1` を走らせて env-check.md と比べること | **判定できない**（許可が無い。蒙恬の出力の JSON と env-check.md は合う） |

コミットの目安:

- 蒙恬の3つ（`scripts/check-env.ps1`・`scripts/prepare.mjs`・`upstream.json`）と、`tasks/2026-11-13-p1-build-upstream/` の記録はレビューを通った。
- 曹参の台本は直してから検証し直す。
- `git status` を見ると、`scripts/measure.ps1`・`tests/netaudit.tests.ps1` も変更中だった（別の曹参の作業とみられる。読んでいない）。そのほか `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` という一時のファイルがある。コミットに混ぜないよう注意してほしい。

## 曹参の台本で確かめた安全の項目（すべて満たす）

- 書き込みは `C:\b\smoke\` の下だけ（`assertSafeWritePath`）。普段使いの `%APPDATA%`・`~\.vscode`・`~\.vscode-oss` は拒む。例外は、利用者が `--save-baseline`・`--root` を渡したとき（既定の使い方では起きない）。
- `VSCODE_PORTABLE` を実行ごとの `user\` に向け、`ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*`・`CLAUDE_CODE_*` を外す。実行の後に、ポータブルの `argv.json` が使われたことを確かめた。
- 止めるのは、起動した PID の木と、置き場所の名前をコマンドラインに持つものだけ。今回は 28 個を止め、残り 0。
- `.lock` は「起動の後に増え、pid が木にあるか ws が一致するもの」だけを消す。普段使いのものは残す（曹参の6回目に実例がある）。

## 曹参に直してもらう点（不合格の理由）

- **A. probe が2つめのウィンドウでも動く**（`tests/smoke/probe/extension.js`）
  - 根拠: `newWindow` で開いた window2 でも probe が起動し、最初からやり直す。`logs\window2\exthost\exthost.log` に `_doActivateExtension smoke.smoke-probe` がある。
  - 影響: 同じ `probe-result.json` を `done: false` と FAIL 2件で上書きする。曹参の確定の2回を含め、残っている `probe-result.json` はほぼ全部がこの上書きで、判定と逆のことを書いている。ワークスペースへの編集と git の操作も二重になる。台本が `done` を読む前に上書きされると、時間切れで FAIL になりうる（推定）。
  - 直し方: probe が動くのを、`cfg.ws` を開いたウィンドウの1回だけにする。
- **B. 「全文検索と置換」の置換を確かめていない**: 自動でも手でも確かめていない（docs/06 の5節で「自」の項目）。
- **C. 「HTML/CSS/JSON の補完」の JSON の補完が無い**: JSON は診断だけを見ている。
- **D. 基準を「3回の和」にできない**（`tests/smoke/lib/run.mjs`）
  - `--save-baseline` は1回分で上書きする。今の基準のファイルも1回分。
  - 今日直した docs/06 の5節に合わせ、和を取る形を足し、基準を3回で作り直す。資料の直しが納品より後なので、曹参の落ち度ではない。
- **E. 手の確認の 2（日本語の表示）が正しく見られない見込み**（`tests/smoke-launch.mjs`・`manual-checks.md`）
  - 根拠: 全7回の実行で `uiLanguage` が `en`。`languagepacks.json` は起動の後にできていた。
  - 見立て: 毎回新しいユーザーデータで起動するので、初回はいつも英語になる（推定）。直し方は、起動し直す手順を足すこと。

軽微な点（直すとよいが、判定には入れない）:

- `smoke-stop.mjs` が `C:\b\smoke\runs` そのものを受け付ける。
- 本体が先に終わって PID が使い回されたときの `stopTree`。
- タイムラインはコマンドが登録済みかを見るだけ。

## 蒙恬への軽微な指摘（判定には入れない）

- `check-env.ps1`: `vs2026_install` などが無いパスを指していても、Visual Studio のフォルダの検査を通してしまう。`preinstall.ts` は、パスが実在するときだけ通す。
- `prepare.mjs`: `upstream.json` に `commit` が無いと、照合しないまま `ok` になる。

## 権限について（リーダーへ）

次の2つを確かめるには、許可の追加が要る。権限の変更なので、ユーザーの承認が要る。

1. 作業ツリーに変更が無いことを確かめるため: `git -C C:/b/wt/* status`（読むだけ）
2. 環境の確かめを走らせ、env-check.md と比べるため: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1`（読むだけの台本）

普段使いの `~/.claude/ide/` と `~/.vscode/argv.json` も、`read_paths` の外なので直接は見ていない。台本の結果（`claude.lock`・`safety.daily-argv`）で確かめた。

## 曹参の未決の点への意見（`verification-log.md` の4節）

- **揺れる誤り**: D で直す。A を直すと、揺れの元が1つ減る見込み。
- **.env の補完**: ユーザーの裁定が要る。それまでは今の「拡張が動作中」だけを見る形でよい。手の 8 の合格の目安は、裁定の後に具体的にする。
- **`C:\b\smoke\runs\` の容量**: 今は 8 個ある。台本に「最新の N 個を残し、古いものを消す」後始末を入れることを勧める（消すのは `runs\` の下だけ）。大きさは、許可の形で測る道具が無いので測っていない。

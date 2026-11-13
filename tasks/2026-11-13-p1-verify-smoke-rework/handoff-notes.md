# 引き継ぎ: Phase 1 の検証（2）

- 作成: 大岡越前守（2026-11-13）
- 宛先: ヴラド・ツェペシュ
- 詳細: `verification-log.md`。実行の記録: `records/phase1/smoke-verify2-official-1.146.0.md`

## 判定

**合格**（brief の1〜4 をすべて満たす）。

| 成果 | 判定 |
|---|---|
| 曹参のスモークの台本の直し（A〜F・軽微。`tests/smoke-*.mjs`・`tests/smoke/`） | **合格** |
| 曹参の単体テスト `tests/smoke.test.mjs` と、公式の zip での実行 | **合格**。60/60。`--prime --baseline` の実行は PASS 47 / FAIL 0 / INFO 9、`probe-result.json` は `done: true`・33 項目 |
| 曹参の監査の台本の軽微な3点（`scripts/netaudit.ps1`・`tests/netaudit.tests.ps1`・`tests/measure.tests.ps1`） | **合格**。102/102、138/138 |
| 普段使いのデータ・`~/.claude/ide/*.lock` に触れていないこと | **合格**（台本の結果で確かめた） |

## 重点の3点

- **置換**: 置換の確認を他の確認より前に呼び、検索語と置換語を引数で渡す形になった。検索語 `replace_me` は `edit/replace.txt` にしかない。実機の後に `ws\` の全ファイルを fixtures と照らした。変わったのは意図した3つ（replace.txt・target.txt・tracked.txt）だけで、`docs/readme.md` は元のまま。
- **文字コード**: PowerShell の出力を UTF-8 に固定し、BOM を外す。読めなければ3回まで試し、それでもだめなら投げる（空を返さない）。日本語のコマンドラインがある状態は、許可の形で再現できなかった。
- **`--keep-runs`**: 消すのは `C:\b\smoke\runs\` 直下の、`<label>-<時刻>` の名前のフォルダだけ（今回の分は除く）。実機では最も古い1つだけが消えた。基準のファイルと `ext\` は、実行の前後で sha256 が同じ。

## 直してもらう点（判定には入れない）

- **G（曹参・要修正）**: probe の最後の一覧が毎回失敗している（`extension.js` 115 行の `e.packageUri.fsPath`。VS Code の API に `packageUri` は無い）。
  - 影響: `commands.json` が一度も作られていない（残る 10 回すべて）。動作中の拡張の一覧も空。`smoke-design.md` と初回の引き継ぎは「`commands.json` を実行ごとに残し、`absentCommands` に使える」としているが、成り立っていない。誤りは `snapshotError` に残るだけで、どの確認も落ちない。
  - 直し方: `extensionUri`（または `extensionPath`）を使い、`snapshotError` を FAIL にする。
  - Phase 2 で `absentCommands` に使う前と、蒙恬のビルドに向ける前に直す必要がある。
- H（曹参・軽微）: 置換の後に「ほかのファイルが変わっていない」ことを台本自身が確かめていない。431 行のコメントも古い。
- I（曹参・軽微・推定）: `smoke-launch.mjs` の prime が作る `.lock` が、普段使いの `~/.claude/ide/` に残る見込み（後始末が無い）。
- J（曹参・軽微）: `smoke-design.md` に `--prime`・`--merge-baseline`・`--keep-runs` の使い方が無い。
- L（曹参・軽微）: netaudit の audit.md の Limits のうち、claude.exe の行が、直し1の後の動き（ネットのログの名前はヒントだけ）と合わない。

## リーダーへ

- K: `--keep-runs` の既定 10 で、以前の記録が指す置き場所（検証（1）の `ooka-verify-20261113T125822`、曹参の初回の確定2回）はすでに消えている。根拠を残したい実行の扱いを決めてほしい。
- M: `git status` に、対象外の `tests/probe-dns.ps1`（追跡済み、変更あり）と `tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp` がある。コミットに混ぜないよう注意してほしい。
- 拡張は今ある `C:\b\smoke\ext\1.146.0-official\` を使い回した（台帳は実行の時点で未変更。入れ直していない）。`tests/probe-*.ps1` は走らせていない。
- 書き込んだのは、このディレクトリの2つと `records/phase1/smoke-verify2-official-1.146.0.md` だけ。コードは直していない。

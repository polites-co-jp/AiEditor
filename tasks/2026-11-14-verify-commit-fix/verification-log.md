# 検証の記録: build.mjs の commit の直しと、A-1 の作り直した版（r3）のスモーク

- 検証: 大岡越前守、2026-11-14（JST）
- 依頼: `brief.md`（このフォルダ）
- 確かめた成果: 蒙恬の `scripts/build.mjs` の直しと r3 の zip（`tasks/2026-11-14-build-commit-fix/handoff-notes-meng-tian.md`）、曹参の `tests/build-commit.test.mjs`（`handoff-notes-cao-shen.md`）

## 判定

| 項目（brief の やること） | 判定 |
|---|---|
| 1. 直しのレビュー | 合格（軽微な指摘1つ。1.4） |
| 2. テスト | 合格（21/21、run-all 1521 件で fail 0。軽微な指摘1つ。2.3） |
| 3. 作り直した版 | 合格 |
| 4. スモークのやり直し | 合格（前回の FAIL 5 のうち4つが PASS。残る errors.new の3件は説明できる） |
| 5. Phase 1 の関門 | **合格**（docs/07 の4節の完了の条件を満たす） |

## 1. 直しのレビュー（`git diff scripts/build.mjs`）

作業ツリーで変わっているのは `scripts/build.mjs`（+169/−32 くらい）と `tests/probe-dns.ps1`。`tests/probe-dns.ps1` は別のタスク（通信の監査）のもので、この検証の対象外。

### 1.1 BUILD_SOURCEVERSION は型検査とパッケージ化の子だけに渡る: 満たす

- `SOURCE_VERSION_STEPS = ["typecheck","package"]`（凍結）。`envForStep(name, s, base)` は `readSourceVersion` で作業ツリーの HEAD を読み、`stepEnv(name, base, v)` の返り値を子の `spawn` の env にする。`envForStep` を呼ぶのは typecheck（774行）と package（783行）の `runPlanned` だけ。prepare・apply・install・lockfile は `runPlanned(name, s)` で、既定の `env`（`childEnv(process.env)`）を使う。build.mjs がこの4つに BUILD_SOURCEVERSION を足すことは無い
- HEAD が読めなければ `fail(s, ...)` でその手順で止まる（723行）。40桁でない値は `stepEnv` が例外にする
- package の子は、signtool の PATH を前に足した env に BUILD_SOURCEVERSION を載せる（signtool の扱いは前と同じ）
- 実物: `build-record-r3.json` の typecheck・package の `env.BUILD_SOURCEVERSION` が `cff68091…7a72`、install・lockfile の手順には `env` が無い

### 1.2 後処理は commit の欠け・食い違いで止まる: 満たす

- postprocess（797〜801行）で `checkProductCommit(layout.product, readSourceVersion(name))` の `problems` を `problems` に足し、空でなければ `fail`
- 検証役が実物で流した（`node scripts/build.mjs` の後処理だけ。gulp の出力ではなく、r3 の zip を展開したものを `--package-dir` に指した。書いたのは `--record` の JSON だけ）:
  - 一致: `--worktree C:/b/wt/p1-a1` → 終了コード 0、`productCommit.ok: true`、commit = expected = `cff68091…7a72`（`ppcheck-r3-match.json`）
  - 食い違い: `--worktree e:/develop/self/Team/projects/ai-editor`（HEAD `800d2666…`）→ 終了コード 1、`stoppedAt: postprocess`、`problems` の先頭が「出力の product.json の commit cff68091… が渡した値 800d2666… と違う」（`ppcheck-r3-mismatch.json`）。keep.json の4件の「無い」も出たが、これは作業ツリーに `build/lib/extensions.ts` が無いため（警告に出ている）で、試し方による
  - 欠け: 蒙恬の `ppcheck-r2-before.json`（r2 の出力、commit 無し）が、`stoppedAt: postprocess`、「出力の product.json に commit が無い」。記録を読んで確かめた（r2 の出力はもう上書きされていて、流し直せない）

### 1.3 `--from install` で units が埋まる: 満たす

- `!steps.includes("apply")` のとき `readChecks()` と `fillUnits(false)`（715〜718行。dry-run も同じ）
- 実物: `build-record-r3.json`（`--from install`）の `units` が `[{ id: "A-1-copilot-extension", enabled: false, applied: "ok" }]`、`unitsFrom.applyRan: false`、`applyResult: "ok"`。検証役の後処理だけの2回でも同じ

### 1.4 本家のコードを変えていない: 満たす

- 差分は `scripts/build.mjs` だけで、本家の木には触らない（環境変数で渡すだけ）
- r3 の型検査の時点で、作業ツリーの未コミットの変更は 0 件（`sourceVersion.uncommittedEntries: 0`）。HEAD は `checks.json` の `headCommit` と同じ（`matchesChecksHead: true`）。apply の後に作業ツリーは動いていない

**軽微な指摘（蒙恬）**: `stepEnv` の注（「外の BUILD_SOURCEVERSION は、どの手順でも上書きか削除する」）と、実際の結線が合っていない。親の環境に BUILD_SOURCEVERSION があると、prepare・apply・install・lockfile の子には `childEnv` を通ってそのまま渡る（`childEnv` は VSCODE_* などしか外さない）。この PC で親にこの変数があるとは見ていない（記録に無い）。r3 の結果には効いていないので、合否には使わない。直すなら `childEnv` で BUILD_SOURCEVERSION も外すか、全部の手順で `stepEnv` を通す。

## 2. テスト

### 2.1 `node --test tests/build-commit.test.mjs`

tests 21 / pass 21 / fail 0（約 1.5 秒）。

### 2.2 `node tests/run-all.mjs --save tasks/2026-11-14-verify-commit-fix/run-all-result.txt`

TOTAL tests 1521、pass 1500、fail 0、skip 21。終了コード 0（`run-all-result.txt`）。曹参の報告の数と同じ。skip 21 は `removals.test.mjs` のもの（前の記録と同じ）。`p34-selfcheck.test.mjs`（1件）は git 管理外の別のタスクのもので、含めて数えた。

### 2.3 テストの中身

- 仕様（brief と docs/02 の4節の7）から書かれていて、実装に寄せて緩めた点は見当たらない。`headCommitOf` は、`git worktree add` で作った `.git` がファイルの作業ツリーで確かめている（今回の不具合の形そのもの）
- 落ちるべきときに落ちるか（読んで確かめた）: `stepEnv` がほかの手順にも値を足せば「ほかの手順には足さず」が落ちる。`checkProductCommit` が食い違いを見逃せば「食い違うと失敗」が落ちる。dry-run の plan に値が出なければ結線の試しが落ちる
- **軽微な指摘（曹参）**: 後処理が `checkProductCommit` の結果で本当に止まること（`problems` に足して `fail` する結線）を確かめるテストが無い。曹参の引き継ぎにも未解決として書かれている。今回は検証役が実物（1.2）で確かめたので合否には使わない。足すなら、`tests/build/` の出力の試しに product.json（commit 有り・無し・違う）を置いて `--from postprocess --to postprocess` を流す試し
- 同じく、1.4 の軽微な指摘（親の BUILD_SOURCEVERSION が install などに漏れる）は、`stepEnv` の単体では見えるが main の結線のテストが無いので見つからない

## 3. 作り直した版（r3）

| 見たこと | 結果 |
|---|---|
| zip の SHA-256（`sha256sum C:/b/dist/1.146.0-p1-a1-r3.zip`） | `e9215f2c2df15a3b4fdd910df1e63437d35b28bf844119c9517d57860daa996c`。蒙恬の記録・`build-record-r3.json` と一致 |
| 作業ツリーの HEAD | `C:\b\wt\p1-a1\.git` は `gitdir: C:/b/vscode/.git/worktrees/p1-a1`。`C:\b\vscode\.git\worktrees\p1-a1\HEAD` は `cff68091803f933ffbd34c93d1a7dc14633f7a72` |
| zip の中の product.json の `commit` | 展開したもの（`C:\b\p1\1.146.0-p1-a1-r3\Code-OSS-win32-x64-1.146.0-p1-a1-r3\resources\app\product.json`）の215行が `"commit": "cff68091803f933ffbd34c93d1a7dc14633f7a72"`。HEAD と一致。スモークの見出しも `cff6809180` |
| ビルドの記録の `sourceVersion` | `value: cff68091…7a72`、`source: "worktree HEAD"`、`readAt: "typecheck"`、`error: null`、`uncommittedEntries: 0`、`checksHeadCommit` が同じ値で `matchesChecksHead: true` |
| postprocess | `productCommit.ok: true`、問題なし |

zip の中身を直接は読めていない（検証役の許可に zip を開くコマンドが無い）。zip の中の product.json は、蒙恬の `p1-launch-check.ps1` が展開したものを読んだ。展開したもののファイルは 2,612 個で、ビルドの記録の出力のファイルの数（`disk.package.files` 2,612）と同じ。zip の項目 3,190 はフォルダを含む数。

## 4. スモークのやり直し

詳細は `records/phase1/smoke-built-1.146.0-p1-a1-r3.md`。

- 単体テスト `node --test tests/smoke.test.mjs`: 75/75
- 実行: `node tests/smoke-run.mjs --build C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3 --label p1-a1-r3 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300`
- 結果: PASS 48 / FAIL 1 / SKIP 0 / INFO 8（終了コード 1）。置き場所 `C:\b\smoke\runs\p1-a1-r3-20261114T125247\`（`node tests/smoke-stop.mjs --mark-keep p1-a1-r3-20261114T125247` で `.keep` を置いた）
- 前回の FAIL 5: base.terminal・base.task・lang.ps1.session・base.ui-language は PASS。errors.new は FAIL のまま（9 → 3 件）
- 残った3件: トンネルの設定が無い ×2（Code - OSS の product.json）、Claude Code の `Remote Control auto-enable failed` ×1（A-1 で Claude Code のビューが起動時に開き、`claude.exe` が起動したときだけ出る。`runs\` の 12 回のうち A-1 を当てた2回だけにある。推定を含む）。どちらも A-1 と「Code - OSS・上書き無し」で説明できる
- claude-code の組: 3項目とも PASS

### 展開の場所について（依頼書との違い）

依頼書は zip を `C:\b\smoke\` の下などに展開するとしている。検証役の許可には展開するコマンド（`tar`・`Expand-Archive`・`scripts/p0-expand.ps1`・`scripts/p1-launch-check.ps1`）が無い。そのため、蒙恬が `p1-launch-check.ps1` で同じ zip を展開した `C:\b\p1\1.146.0-p1-a1-r3\Code-OSS-win32-x64-1.146.0-p1-a1-r3\` を使った。

- これは zip を展開したもので、gulp の出力（`C:\b\wt\VSCode-win32-x64\`）ではない
- 中のファイルの数は出力と同じ 2,612 個。起動の確かめのポータブルのデータは隣の `portable\` にあり、エディタのフォルダの中には無い
- スモークは自分の `VSCODE_PORTABLE`・`--user-data-dir`・`--extensions-dir` を渡すので、`portable\` は使われない
- 25 秒の起動を1回した後なので、厳密には「新しく展開したもの」ではない。検証役が自分で展開して比べることはできていない

## 5. Phase 1 の関門（docs/07 の4節の完了の条件）

| 条件 | 判定 | 根拠 |
|---|---|---|
| zip から起動する | 満たす | r2 の `launch-check.json`、r3 の `launch-check-r3.json`（`--version` の commit が `cff68091…`）、r3 の zip を展開したものでのスモーク（base.launch PASS） |
| Claude Code の組が通る | 満たす | r3 のスモークの claude.running・claude.exthost-log・claude.lock が PASS |
| 所要時間とディスクの記録がある | 満たす | `records/phase1/gate-1.146.0-p1-a1.md`（r2）、`build-record-r3.json` の `durations`・`disk` |

対象外: claude-code の組の手の項目（パネルからの送信、統合ターミナルの `claude` の接続など）は、Phase 2 の最後にユーザーが行う。

関門の記録: `records/phase1/gate-1.146.0-p1-a1.md` の末尾に「追記: Claude Code の組と、関門の結び」を足した。

## 6. docs/ との食い違い（リーダーへ）

- docs/02 の4節の7（後処理）に、出力の product.json の `commit` を確かめることが無い。同じ節の109行「子のプロセスには `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を渡さない」に、型検査とパッケージ化には `BUILD_SOURCEVERSION=<作業ツリーの HEAD>` を渡すことが無い。docs/02 の7節の記録の例に `sourceVersion` が無い（蒙恬の指摘と同じ。検証役も確かめた）
- `BUILD_SOURCEVERSION` に作業ツリーの HEAD を入れる判断は、`docs/user-decisions.md` に無い（リーダーの判断として依頼書にだけある）
- 蒙恬の未解決の点: `BUILD_SOURCEVERSION` があると、1.146.0 の `extensions/copilot/.esbuild.mts` が CI とみなし、`VSCODE_QUALITY` が無いとパッケージ化を止める。Phase 2 の土台の版（`1.146.0-p2-base`）がこれで落ちた（`tasks/2026-11-14-p2-builds/builds.md`）。A-1 を当てた版には効かない。この検証では確かめていない

## 流したコマンド

```
git diff --stat
git diff scripts/build.mjs
node --test tests/build-commit.test.mjs
node --test tests/smoke.test.mjs
node tests/run-all.mjs --save tasks/2026-11-14-verify-commit-fix/run-all-result.txt
sha256sum C:/b/dist/1.146.0-p1-a1-r3.zip
sha256sum C:/b/smoke/baseline-official-1.146.0.json C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3/resources/app/product.json
sha256sum "C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3/Code - OSS.exe" C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3/resources/app/node_modules.asar
node scripts/build.mjs 1.146.0 --label verify-pp-r3-match --from postprocess --to postprocess --package-dir C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3 --worktree C:/b/wt/p1-a1 --take-in-dir tasks/2026-11-14-build-commit-fix/take-in-r3 --record tasks/2026-11-14-verify-commit-fix/ppcheck-r3-match.json --no-size
node scripts/build.mjs 1.146.0 --label verify-pp-r3-mismatch --from postprocess --to postprocess --package-dir C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3 --worktree e:/develop/self/Team/projects/ai-editor --take-in-dir tasks/2026-11-14-build-commit-fix/take-in-r3 --record tasks/2026-11-14-verify-commit-fix/ppcheck-r3-mismatch.json --no-size
node tests/smoke-run.mjs --build C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3 --label p1-a1-r3 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300
node tests/smoke-stop.mjs --mark-keep p1-a1-r3-20261114T125247
```

exe と `node_modules.asar` の SHA-256（記録のため）: `57daec77…2a85`、`5b70406c…96d1`。

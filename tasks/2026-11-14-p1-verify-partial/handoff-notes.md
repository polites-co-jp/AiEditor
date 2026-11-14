# 引き継ぎ: Phase 1 の途中の検証（copilot の不具合と Smart App Control）

- 作成: 大岡越前守（2026-11-14）
- 宛先: ヴラド・ツェペシュ
- 詳細: `verification-log.md`（同じフォルダ）。run-all の出力は `run-all-output.txt`

## 判定

| # | 項目 | 判定 |
|---|---|---|
| 1 | copilot の不具合 | **合格**（PR #347312 の出典の部分だけ判定できない） |
| 2 | Smart App Control | **記録の確かめは合格。再現は判定できない**（許可が無い） |
| 3 | 記録の確かめ | **所要時間・ディスク・出力の形は合格**。ロックファイルと普段使いのデータは、間接にしか確かめられていない（許可が無い） |
| 4 | 新しい台本のレビュー | **不合格**（`p1-ci-events.ps1` が日本語の Windows で仕様を満たさない。run-all は fail 1） |

ユーザーに諮る2つの判断の前提になる事実（落ちる場所と原因、Smart App Control が `winregistry.node` を止めたこと）には、記録・ログ・ソースのどこにも食い違いが無かった。

## 理由

1. **copilot**
   - 2回の `package.log` とも、`package-win32-x64` が Finished（56340 ms・54213 ms）の直後に、`<anonymous>` が「[prepareBuiltInCopilotRipgrepShim] Copilot SDK directory not found」で落ちている（`copilot.ts:278:9`、`gulpfile.vscode.ts:567:3`）。
   - 原因の行は本家のソースで確かめた。
     - `.moduleignore` の226行が `@github/copilot/**` で、これを戻す行は無い。
     - `util.ts` の `cleanNodeModules` が、それを `!**/node_modules/...` に変える。
     - `extensions.ts` の551〜571行が、`.moduleignore` を通す。
     - `copilot.ts` の277〜279行が、`sdk` が無いと throw する。
   - 実物でも確かめた。作業ツリーには `sdk` のファイルが37あるが、出力には `@github\copilot` が無い。
   - PR #347312 は、Web の道具も `curl`・`gh` も許可に無いので、開いていない。ただし、2026-11-13 に clone した main の `packageCopilotExtensionStream` は VSIX を作って展開する形になっており、`.moduleignore` を通さない。直ったという記述と合う。
2. **Smart App Control**
   - エディタ自身の `main.log`（19:32:34、`An Application Control policy has blocked this file`、`winregistry.node`）、`ci-events.json`（同じ秒の ID 3077、`VerifiedAndReputableDesktop`、Policy ID `{0283ac0f-...}`）、`env-check-after.json`（`state` が 1、`on`）は、互いに食い違いが無い。
   - `winregistry.node` は、この PC の node-gyp でビルドされたもの（`install.log` の751行〜）。
   - 再現の1回は走らせていない。`scripts/p1-launch-check.ps1`・`p1-ci-events.ps1`・`check-env.ps1` は、この役の Bash の許可に無い。
3. **記録**
   - 所要時間（導入 278.06・173.789 秒、型検査 21.2・19.3 秒、パッケージ化 238.9・249.5 秒）、ディスク（空きの減り 5.37・2.96・0.16 GB、作業ツリー 6.14・5.22 GB、出力 1.40 GB・20,325 ファイル）、出力の形（直下の `Code - OSS.exe`、直下の `resources\app\product.json`、`bin\code-oss.cmd`）は、ログ・記録・実物と一致した。
   - `git -C C:/b/wt/1.146.0 status` はフックに止められた。代わりに次の2つを確かめた。
     - 2回の install で、5つのロックファイルがどれも「Lockfile is up to date, resolution step is skipped」だった。
     - 作業ツリーの HEAD が `69047191...` のまま。
   - 6つの SHA-256 を `verification-log.md` に控えた。
   - 普段使いのデータは読める場所の外なので、`launch-check-partial.json` の前後（4つとも無いまま）だけで判断した。
4. **台本**
   - 書き込み先は `-Out`・`-OutFile`・`-Dest`（`C:\b\p1\` の下）だけ。`-Root` は `C:\b\` の下に限る。子のプロセスには `VSCODE_PORTABLE` だけを渡し、終わったら元に戻す。害は無い。
   - ただし `p1-ci-events.ps1` の54行が、例外の文言を英語の `'No events were found'` と照らしている。このため日本語の Windows では、イベントが無いときに `readable: false` になる。仕様違反。
   - 曹参のテストがこれを捉えた。`node tests/run-all.mjs` は TOTAL 1500、pass 1478、**fail 1**、skip 21。

## 直す必要のあるもの

- **蒙恬** `scripts/p1-ci-events.ps1` の54行: 例外の文言でなく、`$_.FullyQualifiedErrorId` が `NoMatchingEventsFound` で始まるかで見分ける（言語によらない）。直した後に `node --test tests/p1-scripts.test.mjs` で、落ちていた1件が通ることを確かめる。
- **蒙恬** `doc-corrections.md` の A8 に、`docs/02-repository-and-build.md` の157行（6節「署名はしない。…SmartScreen は出にくい（推定）」）を足す。Smart App Control がオンの PC では成り立たない。
- 気づいた点（直すかどうかは任せる）: `p1-launch-check.ps1` の普段使いのデータの比較は、フォルダ自体の更新時刻しか見ない。そのため、中のファイルの書き換えは捉えにくい（今回はフォルダが無かったので足りている）。

## 未解決（権限）

再現と直接の確かめには、次の許可が要る。足すかどうかはユーザーの承認が要る。

1. `git -C C:/b/wt/1.146.0 status`: ロックファイルが変わっていないことを直接確かめるため。
2. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1`・`.../scripts/p1-ci-events.ps1`・`.../scripts/check-env.ps1`: Smart App Control による阻止を1回再現し、今の状態を読むため。
3. Web を読む道具: PR #347312 の番号・日付・マイルストーンを出典で確かめるため。
4. `%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` の有無を読む許可: 普段使いのデータに触れていないことを、記録によらず確かめるため。

曹参の `tasks/2026-11-14-p1-tests-scripts/handoff-notes.md` は、検証を終えた時点ではまだ無かった。テストのファイル（`tests/p1-scripts.test.mjs`、27件）は届いていたので、それを走らせた。

# 大岡越前守の引き継ぎ: 版 r6 の関門

- 日付: 2026-11-17
- 依頼: `brief.md`（タスクの名称「版 r6 の関門（アイコン A と日本語パック）」）
- 判定: **合格**（入れ替えてよい。入れ替えは古い日本語パックを外す許可が入ってから）
- 判定と根拠の本文: `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md`（全体の run-all の結果と切り分けは `gate-p5-c-all-r6-addendum.md`）
- 走らせたコマンドの一覧: `commands-run.md`（このフォルダ）
- 入れ替えの後に画面で見る項目: `records/take-in/1.146.0-p5-c-all-r6/manual-checks-p5-c-all-r6.md`

## 1. 記録の場所

| 何 | 場所 |
|---|---|
| 関門の記録（判定・6項目の根拠・直すべき点） | `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md` |
| 全体の run-all の結果と、落ちた2件の切り分け | `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6-addendum.md`（この引き継ぎの5節にも書いた） |
| 画面の確かめの項目 | `records/take-in/1.146.0-p5-c-all-r6/manual-checks-p5-c-all-r6.md` |
| 曹参の網の出力（r6 の出力・除外は exclusions.json だけ・`--require-bundle --strict`） | `records/take-in/1.146.0-p5-c-all-r6/l10n-audit-r6.json` |
| 網が落ちるべきときに落ちるかの出力（r5 のパック） | `tasks/2026-11-17-r6-gate/l10n-audit-r6app-r5pack.json` |
| 起動の確かめ（私が zip から展開し直した版） | `tasks/2026-11-17-r6-gate/launch-check-p5-c-all-r6-ooka.json` |
| 通信の監査 | `records/network-audits/2026-11-17-p5r6/`・`records/network-audits/2026-11-17-p5r6-ledger/` |
| テストのまとめ | `tasks/2026-11-17-r6-gate/run-all-*-r6.txt`（12ファイル）と、全体の run-all（見張りあり）の `run-all-r6.txt` |
| スモークの置き場所（`.keep` を置いた） | `tmp\b\smoke\runs\p5r6-1-261117T005343\`・`p5r6-2-261117T005542\`・`p5r6-3-261117T005730\`、3回の和 `tmp\b\smoke\baseline-p5-c-all-r6.json` |
| 展開し直した版 | `tmp\b\p2\1.146.0-p5-c-all-r6-ooka\`（台本が書いた。私は消せない） |

## 2. コミットしてよいファイル・いけないファイル

### 2.1 コミットしてよい

- コード・設定: `TAKE-IN.md`、`assets/README.md`、`assets/` のアイコン8つ（`resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`、`src/vs/workbench/browser/media/code-icon.svg`、`src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg`）、`builtin/keep.json`、`extensions.lock.json`、`product.overlay.json`、`extensions-src/mydist/package.json`、`extensions-src/notion-sync/package.json`、`extensions-src/language-pack-ja/`（全部。dist の95ファイルを含む）、`scripts/apply.mjs`・`build.mjs`・`install-extensions.mjs`・`lib/apply/classify.mjs`・`make-icons.mjs`・`take-in.mjs`、`scripts/copy-icon-sources.mjs`、`scripts/icon-src/`（3つ）、`scripts/l10n-ja.mjs`、`scripts/lib/l10n-ja.mjs`
- テスト: `tests/make-icons.test.mjs`、`tests/l10n-audit.mjs`、`tests/l10n-audit.test.mjs`、`tests/l10n-audit-more.test.mjs`、`tests/l10n-lib.test.mjs`、`tests/l10n-repo.test.mjs`、`tests/l10n-r6.test.mjs`
- 記録: `tasks/2026-11-17-icon-ja-build/` の `handoff-notes-meng-tian.md`・`1.146.0-p5-c-all-r6/`・`launch-check-p5-c-all-r6.json`・`l10n-count-r6.json`・`l10n-count-r6-unpacked.json`・`l10n-count-repo-pack-r6prep.json`・`l10n-build-r6.json`・`l10n-input-official-fixes.json`・`l10n-input-escape-fix.json`、`tasks/2026-11-17-icon-ja-tests/` の `handoff-notes-cao-shen.md`・`audit-r4-repopack-r6.json`、このフォルダ（`brief.md` 以外）、`records/take-in/1.146.0-p5-c-all-r6/`（追記の `gate-p5-c-all-r6-addendum.md` を含む）、`records/network-audits/2026-11-17-p5r6/`・`2026-11-17-p5r6-ledger/`
- r5 の記録（`1.146.0-p5-c-all-r5/`・`launch-check-p5-c-all-r5.json`・`l10n-count-r5-old-extract.json`・`l10n-count-r5-fixed-extract.json`・`l10n-count-repo-pack-fixed.json`・`l10n-build-escape-fix.json`）: 入れてよい（裁定の記録と蒙恬の引き継ぎが根拠として名前を挙げる。リーダーの判断）

### 2.2 コミットしない

- `scripts/l10n-probe.mjs`、`tests/probe-l10n.mjs`（使い捨て。記録 2026-11-17）
- `tasks/2026-11-17-icon-l10n-tests/audit-run-pack1131.json`（重複の出力。記録 2026-11-17）
- `tasks/2026-11-17-icon-ja-tests/extra-exclusions-bundle-escape.json`（要らなくなった追加の除外）、`audit-r4-newpack.json`・`audit-r4-newpack-repo-exclusions-only.json`・`audit-r4-pack1131.json`（古い網の出力）

### 2.3 今回の変更の外（混ぜない）

- `tasks/2026-11-13-p2-build-switch/build-switch-design.md`、`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-cao-shen.md`・`run-all-result.json`、`tests/probe-dns.ps1`（前の仕事の未コミットの変更）
- `tests/probe-netlog.ps1`・`probe-netlog2.ps1`・`probe-nodedebug.ps1`、`tests/p34/`・`tests/fixtures/ref-p34/`・`tests/p34-selfcheck.test.mjs`、`tasks/` の `*.tmp`・`trial/`・`trial-local.json`（前の仕事の残り）

## 3. 直すべき点と担当（関門の記録の5.3）

| # | 担当 | 要点 |
|---|---|---|
| L1 | 蒙恬 | `take-in.mjs` の `runL10nCount`: count が出力を書く前に落ちると、前の回の `l10n-count.json` の数を写す |
| L2 | 蒙恬 | `summarizeL10nCount(5, 出力なし)` が `untranslated` のまま |
| L3 | 蒙恬 | `extensions-src/language-pack-ja/README.md` の ThirdPartyNotices の行が古い |
| T1 | 曹参 | `l10n-r6.test.mjs` の take-in の3件がソースの文字の照合で、振る舞いを見ていない |
| T2 | 曹参 | 古い 1.131.0 のパックのテストが、入れ替えで古いパックを外すと黙って飛ぶ |
| T3 | 曹参 | `configure.test.mjs` の1件と `move-off-c.test.mjs` の1件が、本物の `installRoot` で動く日常の Shuko を見て落ちる（5節）。サンドボックスの `local.json` に前の `installRoot` を書いてから走らせる形にする。急がない |
| D1 | リーダー | `docs/install.md` の「8つの拡張（…日本語の言語パック）」と `--version` の commit |
| D2 | リーダー | `docs/04-bundled-extensions.md` の161行の数（r4 の時点） |

## 4. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、このフォルダ（`brief.md` を除く）、`records/take-in/1.146.0-p5-c-all-r6/`、台本が書く `records/network-audits/2026-11-17-p5r6*/`、`tmp\b\` の下（展開・スモーク・監査の作業場所）。
- `tmp\b\wt\r6\w` は、`.git` の指す先の `HEAD` を Read で読んだだけ（`git -C tmp/b/wt/r6/w` は許可の形に当たらないので、同じ clone を共有する `tmp/b/wt/r4` から `git -C … diff` で木を比べた）。
- 普段使いの Shuko（`%LOCALAPPDATA%\Programs\Shuko\current`）・`local.json`・スタート メニュー・PATH・Notion・秘密の場所には触れていない。入れ替えと拡張を外す操作はしていない。

## 5. 追記（2026-11-17）: 全体の run-all の結果と、落ちた2件の切り分け

全体の run-all（`node tests/run-all.mjs --save tasks/2026-11-17-r6-gate/run-all-r6.txt`。PowerShell のテストを含む、見張りあり）が終わった。**77ファイル 3,021件、pass 3,017・fail 2・skip 2**。見張り（`[guard]`）の通知は無い。skip の2件は `apply-cli.test.mjs`（前の検証と同じ）。判定（合格）は変わらない。

### 5.1 `move-off-c.test.mjs` の1件

関門の記録の5節に書いた `editor-running`（環境の都合）と**同じ**。テスト名も失敗の文（`configure.ps1` の `result: editor-running`、終了コード 3、本物の `installRoot` の下の21のプロセス）も、先に `--only move-off-c` と `node --test` で見たものと同じ。

### 5.2 `configure.test.mjs` の1件（`-InstallRoot: the value is written as the user gave it (a %NAME% is not expanded)`）

**原因も同じ `editor-running`（動いている日常の Shuko による環境の都合）。r6 の変更とは関係しない。**

- 失敗の文: `node --test tests/configure.test.mjs` を単独で流し直して読んだ。`result: "editor-running"`、`oldInstallRoot: C:\Users\kou_z\AppData\Local\Programs\Shuko`、`running` は `…\Shuko\current\Shuko.exe` の20のプロセスと `…\versions\1.146.0-1\…\OpenConsole.exe` の1つ、`message: close the editor first: 21 process(es) …`、終了コード 3（テストは 0 を待つ）。ほかの16件は通る。
- 仕組み: テスト（187〜193行）は、ファイルの無いサンドボックスの `local.json` で `configure.ps1 -InstallRoot %SHUKO_TEST_BASE%\Pct -NoMove` を走らせる。`local.json` が無いので、前の `installRoot` は既定の本物の `%LOCALAPPDATA%\Programs\Shuko` になる。`configure.ps1` の282〜289行は `-NoMove` を見る前に、前の `installRoot` の下で動くエディタを探し、あれば `editor-running` で止める（`-NoMove` は305行以降の移す手順だけを外す）。今は日常の版（`1.146.0-1` = r4）がそこで動いているので止まる。`move-off-c.test.mjs` の1件も同じ形。
- r6 の変更と関係しない根拠: `scripts/configure.ps1`・`scripts/lib/local-config.ps1`・`tests/configure.test.mjs`・`tests/move-off-c.test.mjs`・`tests/build/helpers.mjs` は作業ツリーで変わっていない（`git status --short` が空）。最後に変わったのは `e75b216`（2026-11-16 10:43）で、r6 の作業より前。

### 5.3 前の run-all との比べ

| run-all | `configure.test.mjs` | `move-off-c.test.mjs` | そのときの日常の Shuko |
|---|---|---|---|
| `tasks/2026-11-16-p5-c1-product-keys/run-all-result.json`（r4 を作った回。r4 の関門と同じ日） | 17 / 17 | 26 / 26 | まだ `%LOCALAPPDATA%\Programs\Shuko` に入れていない（r4 の入れ替えは関門の合格の後。裁定 2026-11-16「版の入れ替え」） |
| `tasks/2026-11-16-move-off-c-fixes/run-all-ooka.txt`・`run-all-cao-shen.txt`・`run-all-cao-shen-2.txt` | 17 / 17 | 26 / 26 | 同上 |
| 2026-11-14〜15 の run-all（`tasks/` の `run-all-*` の全部） | どれも 17 / 17 | 落ちなし | 同上 |
| 今回 `tasks/2026-11-17-r6-gate/run-all-r6.txt` | **16 / 17** | **25 / 26** | r4 が入って動いている（21のプロセス） |

コードは同じで、変わったのは「日常の Shuko が本物の `installRoot` で動いているか」だけ。2件とも、日常の Shuko を閉じて流せば通る見込み（閉じる操作は私の範囲の外なので、確かめていない）。今の形のままでは、日常の Shuko を使っている間の run-all で必ず落ちる。直すなら曹参（3節の T3）。

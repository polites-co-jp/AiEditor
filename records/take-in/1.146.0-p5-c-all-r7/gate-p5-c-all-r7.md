# 関門の記録: 版 `1.146.0-p5-c-all-r7`（改名 Shuko → Sukuna の後の版）

- 検証: 大岡越前守、2026-11-19（JST 11:40 ごろ〜15:00 ごろ）
- 依頼: リーダー（タスクの名称「r7（改名の後の版）の関門」、`tasks/2026-11-19-r7-gate/brief.md`）
- 相手: 蒙恬のビルド（`tasks/2026-11-19-r7-build/build-notes-r7.md` と同じフォルダの記録）。コードの差分のレビューは改名の検証（`tasks/2026-11-18-rename-sukuna-verify/verification-rename-sukuna.md`。再検証で合格）で済んでいる。ここでは、版がその木から作られたことを照らした（1節）。
- 版: zip `tmp\b\dist\1.146.0-p5-c-all-r7.zip`（SHA-256 `5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1`）、版の commit `b76374c6fc633747549a7b1a44a1a5364c7fe8f2`（枝 `builds/1.146.0-p5-c-all-r7`、作業ツリー `tmp\b\wt\r7\w`）
- 作った人の自己申告は根拠にしていない。下の結果は、どれも私が走らせたか、私が読んだもの。版の確かめは、私が zip から展開し直した `tmp\b\p2\1.146.0-p5-c-all-r7-ooka\` で行った。
- 起動はすべてポータブルの形（`VSCODE_PORTABLE` を付けた起動）で行った。`switch.ps1` での展開も、移行の台本も打っていない。コードは直していない。

## 判定

**合格。版 `1.146.0-p5-c-all-r7` を日常の利用へ移してよい。移行は `rename-plan.md` の3.3の順で行う。**

移行の前提（版の合否ではなく、移行の手順の条件。8節に詳しく書く）:

1. 権限の段1（Sukuna の秘密の場所を `secret_paths` に足す行と、移行の台本の行）が入ってから、移行の台本の本番（`-Apply`）を打つ（改名の検証の9節の1）。
2. 移行の台本の本番より前に、Sukuna を普通の形（ポータブルでない形）で起動しない。`sukuna` の CLI も打たない。打つと `%APPDATA%\Sukuna` か `%USERPROFILE%\.sukuna\argv.json` ができ、台本が `destNotEmpty` で止まる。

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | 版の一致 | **合格**。zip の SHA-256・作業ツリーの HEAD・枝・product.json の commit・`--version` が一致する。r6 の木との差は 112 ファイル・179 行の置き換えで、改名の検証が全部を読んだ木（`tmp\b\wt\rn` の HEAD）と差が無い。リポジトリは、ビルドのコミット `c56bb37` の後も、改名のコミット `43be443` の後も、`tasks/` の記録と依頼書しか変わっていない |
| 2 | 適用後の検査（新しい作者） | **合格**。`checks.json` を `tests/c1〜c7-check-json.mjs` に渡すと、7本とも「期待どおり」（c2〜c6 は組 c、c7 は組 b）。作者は `sukuna-apply` の79件だけ。作業ツリーの検査 `c1〜c7-check-worktree.mjs` も7本とも「期待どおり」 |
| 3 | スモーク | **合格**。3回とも PASS 49 / FAIL 0 で、新しい誤りは無い（r6 の基準と比べた）。台本は実行ファイルを版の product.json の `nameShort` から求めている（4.2） |
| 4 | 外向き通信の監査 | **合格**。2通り（各600秒）とも、エディタ・claude の宛先 0、許可の外 0、r6 の一覧に無いもの 0。名前で見えたのは r6 と同じ `wpad` の解決2回だけ（答えも接続も無い） |
| 5 | 日本語の数え | **合格**。曹参の網（`--strict --require-bundle`。除外は `exclusions.json` だけ）で、除外の外の未訳 0。数は r6 と同じ。notion-sync の束は新しい ID `sukuna.notion-sync` で引けている |
| 6 | 起動の確かめ | **合格**。`result: ok`。`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna\local.json` は、関門の作業の前も後も無い（7節）。`%LOCALAPPDATA%\Sukuna` のフォルダそのものは私の読む許可の外なので、直接は見ていない |
| 7 | 古い名前の残り | **合格（確かめられる範囲で）**。展開し直した版の 1,730 ファイルについて、名前と文字のファイルの中身に `shuko` は 0。蒙恬の調べ（`zip-check-r7.json`）とも合う。ただし、どちらの調べも UTF-16 の文字列（実行ファイルの版の情報）は見ていない（3節の注） |
| 8 | テスト | **合格**。全部の run-all（見張りあり）は 3,073 件で、pass 3,065・fail 1・skip 7。落ちたのは既知の1件（`.claude/agents/vlad-tepes.md`。Team の開発部に依頼済み）だけ。見張りの通知は無い（6節） |

## 1. 版の一致

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum tmp/b/dist/1.146.0-p5-c-all-r7.zip` | `5b7ea885…51d1`。依頼書・`build-record.json` と一致 |
| 作業ツリーの HEAD | `tmp\b\wt\r7\w\.git` の指す `tmp\b\vscode\.git\worktrees\w2\HEAD` を読んだ | `b76374c6fc633747549a7b1a44a1a5364c7fe8f2` |
| 枝 | `git -C tmp/b/wt/rn diff --stat builds/1.146.0-p5-c-all-r7 b76374c6…` | 空（同じ木） |
| 改名の検証が読んだ木との差 | `git -C tmp/b/wt/rn diff --stat HEAD b76374c6…` | 空。改名の検証の3節がそのまま当てはまる（r6 の木 `3e1e616a` との差 112 ファイルを `--word-diff=porcelain` で全部読み、178 行は語の置き換えだけ、残る1行は README の説明の直し） |
| r6 の木との差 | `git -C tmp/b/wt/rn diff --shortstat 3e1e616a… b76374c6…` | 112 files changed, 179 insertions(+), 179 deletions(-)（蒙恬の4節と一致） |
| リポジトリ | `git log`・`git show --stat`・`git diff --stat 43be443 HEAD` | ビルドは `c56bb37` から作った。その後の `99693d7`・`7768f94` で変わったのは `tasks/` の記録と依頼書だけ。改名のコミット `43be443` からの差も `tasks/` の11ファイルだけ。今の作業ツリーの未コミットの変更に、実装・パッチ・台帳は無い |
| ビルドの記録 | `tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7/build-record.json` | `result: ok`、`warnings: []`、`matchesChecksHead: true`、postprocess の `productCommit.ok`、`residual: []`・`missingOwn: []`、`uncommittedEntries: 3`（r6 と同じ） |
| 警告 | `checks.json` | `C-2-debug: … debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ（r5・r6 と同じ） |
| 型検査 | `tmp\b\logs\1.146.0-p5-c-all-r7\typecheck.log` | `tsc …` の1行だけ |
| ロックファイル・台帳 | `sha256sum` | `lockfile.diff` は `ef5f98ab…3862`（r6 と同じ）。`extensions.lock.json` は `27ad0e1b…db70`（r6 と同じ） |
| 版のフォルダ | 展開し直した版と蒙恬の展開の `Sukuna.exe`・`product.json` | SHA-256 が同じ（`d9b4c4bf…0341`・`7935f2b0…1761`）。`--version` は `1.146.0`・`b76374c6…`・`x64` |
| product.json | 展開し直した版を Grep | 名前の12キーは `rename-plan.md` の2節の表どおり（`Sukuna`・`sukuna`・`.sukuna`・`.sukuna-shared`・`Sukuna.Editor`・`&Sukuna` など）。GUID 4つは `product.overlay.json` と同じ（r6 から変えていない）。`sukunaConfigurationDefaults` がある。`target` は無い（ポータブルにできる） |

## 2. 日本語

### 2.1 網（曹参の `tests/l10n-audit.mjs`）

```
node tests/l10n-audit.mjs --app <展開し直した版>\resources\app --pack <同じ>\resources\app\extensions\language-pack-ja --worktree E:/…/tmp/b/wt/r7/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle --out records/take-in/1.146.0-p5-c-all-r7/l10n-audit-r7.json
```

終了コード 0、`pass: true`。

| 区分 | 総数 | 訳あり | 除外 | 除外の外の未訳 |
|---|---|---|---|---|
| 本体 | 12,355 | 12,350 | 5 | **0** |
| 拡張 package | 1,258 | 1,258 | 0 | **0** |
| 拡張 bundle | 1,564 | 1,564 | 0 | **0** |
| 自前の直書き | 22 | 22 | 0 | **0** |

- 数は r6 の関門（`../1.146.0-p5-c-all-r6/l10n-audit-r6.json`）と同じ。出力の JSON は行の並びまで同じで、違うのは ID の名前（`shuko.*` → `sukuna.*`）と displayName の文字だけ。
- `packMissingTranslationFiles: []`・`invalidExclusions: []`・`staleExclusions: []`・bundle の `skippedFiles: {}`。自前の3つは新しい ID（`sukuna.mydist`・`sukuna.notion-sync`・`sukuna.language-pack-ja`）で数えられ、どれも未訳 0。
- 蒙恬の `count`（`l10n-count-r7-unpacked.json`）は、全体 15,159、除外 5、除外の外の未訳 0、`placeholderProblems` 0、`result: ok`。網との件数の違い（本体 12,355 と 12,334、bundle 1,564 と 1,545）は r6 の関門の2.2と同じ理由で、結論は食い違わない。

### 2.2 `tests/l10n-audit-more.test.mjs` の実物のテスト（446〜496 行）

- 依頼書は `AIED_AUDIT_WT=<repo>\tmp\b\wt\r7\w` を渡して走らせることを求めている。しかし、**私の許可では、環境変数を付けてコマンドを打てない**（`AIED_AUDIT_WT=… node --test …` はフックが止めた。`node tests/run-all.mjs` にも、環境を渡す引数が無い）。そこで、環境変数なしで走らせた結果（実物の4件は飛ぶ）と、同じテストの中身を CLI で同じ入力に当てた結果で代えた。
- 環境変数なしで走らせると、`l10n-audit-more` の 42件のうち 38 通り、4 飛ぶ（実物の4件。`tmp\b\wt\r7\extensions` が無いため。蒙恬の「見てほしい点」1のとおり）。
- 代わりに当てたもの（テストの `auditL10n` と同じ入力。アプリは私の展開、作業ツリーは `tmp\b\wt\r7\w`、パックはテストの `DEFAULT_PACK` = リポジトリの `extensions-src/language-pack-ja`）:

| テストの中身 | 私の照らし | 結果 |
|---|---|---|
| 1件目: 本体 12,355・除外 5・除外の外 0、package 1,258・0、直書き 22 以上・0、bundle 1,500 以上、`invalid`・`packMissing`・`stale` が空、パックだけの鍵が 3% 未満 | `tests/l10n-audit.mjs … --pack extensions-src/language-pack-ja … --strict --require-bundle --out tasks/2026-11-19-r7-gate/l10n-audit-r7-repopack.json` | 終了コード 0。数は 2.1 と同じ。パックだけの鍵は 9 件（6つの拡張に 1〜2 件ずつ。bundle 1,564 の 0.6%） |
| 2件目: リポジトリのパックで `pass: true`（`--require-bundle`） | 同上 | `pass: true` |
| 3件目: git の `↔` の2件が訳として入る | 同上の bundle（除外 0・未訳 0）と、`extensions-src/language-pack-ja/dist/translations/extensions/vscode.git.i18n.json` の 761・834 行（`{0} ({1}) ↔ {0} ({2})`・`{0} ↔ {1}`） | 合う |
| 4件目: 古い 1.131.0 のパックでは不合格（本体の未訳 500 以上） | `--pack C:/b/p0/data/upstream-default/ext/ms-ceintl.vscode-language-pack-ja-1.131.0 --strict`（`tasks/2026-11-19-r7-gate/l10n-audit-r7-oldpack1131.json`） | 終了コード 1。本体の未訳 689・package 53・bundle 59 で「不合格: 除外の外の未訳 801」。**網は落ちるべきときに落ちる** |

- 環境変数を付けた `node --test` そのものは、リーダーか曹参に打ってもらう必要がある（私の許可を足すかどうかは、リーダーの判断）。テストの既定の作業ツリーを `tmp/b/wt/r7/w` に直すかは、曹参が決める（指摘 T1）。

## 3. 古い名前の残り

| 確かめたこと | 結果 |
|---|---|
| 展開し直した版の名前 | Glob `**/*[Ss]huko*` で 0。最上位の `.exe` は `Sukuna.exe` だけ、`bin\` は `sukuna`・`sukuna.cmd` だけ。`notion-sync\dist\i18n\` は `sukuna.notion-sync.ja.i18n.json` だけ |
| 展開し直した版の中身 | Grep `shuko`（大文字小文字を問わない）で 0 ファイル |
| 蒙恬の調べ `zip-check-r7.json` | `namesWithShuko: []`。`contentScan` は 1,730 ファイルを全部ほどいて `filesWithShuko: 0`。r6 と比べると、名前を読み替えれば項目の並びは同じ（片方だけにある項目 0）。中身の違う 71 項目の内訳は蒙恬の4節のとおりで、名前とビルドごとに変わるものだけ |
| アイコン | 出力の `code.ico`・`code_70x70.png`・`code_150x150.png`・`out\media\code-icon.svg` が `assets/` と同じ SHA-256（r6 の関門の3節と同じ値）。`make-icons.test.mjs` の 33件が通る |

注（調べの穴。合否は変えない）: 蒙恬の `trial-r7-verify.mjs` は、中身を `latin1` で読んで `/shuko/i` を探す。私の Grep も、NUL を含むファイルは読み飛ばすので、バイナリを見ていない。どちらも **UTF-16 の文字列**を見られない。実行ファイルと `.node` の版の情報（rcedit が `FileDescription`・`ProductName` に書く）がこれにあたる。その証拠に、基準の `zip-check-baseline-r6-vs-r5.json` の 30 件の当たりに、`Shuko.exe`・`*.node`・`rg.exe` は1つも無い（どれも版の情報に `Shuko` が入っていたはずのもの）。r7 の版の情報は、本家のパッケージ化が r7 の product.json の `nameLong`（`Sukuna`）から書く。古い名前が残る筋は無いと見るが、バイト列では確かめていない（蒙恬の「見てほしい点」7と同じ）。移行の後の手の確かめ U6 に入れた。

## 4. 壊れていない

### 4.1 起動の確かめ

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-19-r7-gate/launch-check-p5-c-all-r7-ooka.json -Zip <r7 の zip> -Dest E:/…/tmp/b/p2/1.146.0-p5-c-all-r7-ooka -InstallExtension <台帳の6つの VSIX>
```

`result: ok`（started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged）。全部の検査の後にもう一度打った `launch-check-p5-c-all-r7-ooka-after.json` も `result: ok`。

- 台本は、実行ファイルを `<nameShort>.exe`（`Sukuna.exe`）、CLI を `bin\<applicationName>.cmd`（`bin\sukuna.cmd`）として、版の product.json から求める（`scripts/lib/p0-common.ps1` の `Resolve-P0Editor`、288〜291 行）。記録の `editor.cli` も `…\bin\sukuna.cmd`。
- `--version` は `1.146.0`・`b76374c6…`・`x64`。VSIX 6つとも `successfully installed`。ワークベンチのしるし3つが true、`Uncaught` 0。動いたのは `Sukuna.exe` 7つで、全部止めた。
- 見張った6つの場所は、前も後も「無い」: `%APPDATA%\Code`・`Code - OSS`、`%USERPROFILE%\.vscode`・`.vscode-oss`、`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`。後ろの2つは product.json の `nameLong`・`dataFolderName` から求めている（`scripts/p1-launch-check.ps1` の 305・306 行）。
- 展開先の `portable\user-data\languagepacks.json` の `ja`: `extensions` は `sukuna.language-pack-ja` 1.146.0 と `sukuna.notion-sync` 0.0.1。`translations.vscode` は展開先の `…\extensions\language-pack-ja\dist\translations\main.i18n.json`、`translations["sukuna.notion-sync"]` は `…\extensions\notion-sync\dist\i18n\sukuna.notion-sync.ja.i18n.json`（ファイルは展開先にある）。
- URL の登録: 本家の `src/vs/platform/url/electron-main/electronUrlListener.ts` の 51〜58 行（r7 の作業ツリーで読んだ）は、ポータブルの形では `setAsDefaultProtocolClient` を呼ばない。関門の起動はすべてポータブルなので、`HKCU\Software\Classes\sukuna` は作っていない見込み（レジストリは見ていない）。

### 4.2 スモーク3回（比べる相手は r6 の `baseline-p5-c-all-r6.json`）

```
node tests/smoke-run.mjs --build E:/…/tmp/b/p2/1.146.0-p5-c-all-r7-ooka/Sukuna-win32-x64-1.146.0-p5-c-all-r7 --label p5r7-1 --mode built --prime --baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r6.json --save-baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r7.json --timeout 300 --keep-runs 40
（2・3回目は --label p5r7-2・p5r7-3 と --merge-baseline）
```

| 回 | 置き場所 | 結果 |
|---|---|---|
| 1 | `tmp\b\smoke\runs\p5r7-1-261119T031231\` | PASS 49 / FAIL 0 / INFO 9、`errors.new`: 新しい誤りなし |
| 2 | `tmp\b\smoke\runs\p5r7-2-261119T031429\` | PASS 49 / FAIL 0 / INFO 9、新しい誤りなし |
| 3 | `tmp\b\smoke\runs\p5r7-3-261119T031612\` | PASS 49 / FAIL 0 / INFO 9、新しい誤りなし |

- 誤りの行は、各回とも renderer.log の既知の2行（`DEP0169 url.parse()`・`TextModel got disposed before DiffEditorWidget model got reset`）だけ。3回の和 `tmp\b\smoke\baseline-p5-c-all-r7.json` は `runs: 3`、鍵2個（r6 の基準と同じ2つ）。exthost・main・共有プロセス・devtools・chromium の誤りは 0。
- `base.ui-language` は3回とも PASS（`vscode.env.language = ja`）。`claude.lock` の `.lock` の中の名前は `Sukuna`。Claude Code の組、言語の組、`base.git`・`base.search`・`base.replace`・`base.terminal` などもすべて PASS（r6 と同じ 49 件）。
- 置き場所に `.keep` は置いていない（`tmp\b` は私の書き込みの許可の外）。`--keep-runs 40` で残る。結果の要点はこの表に写した。
- **台本が名前を版から求めているか**（依頼書の完了条件）:
  - 実行ファイル: `tests/smoke/lib/common.mjs` の `resolveEditor`（107〜135 行）が `resources\app\product.json` を読み、`<nameShort>.exe` とする（119 行）。
  - CLI: `sukuna.cmd` は通さない。同じ実行ファイルに `ELECTRON_RUN_AS_NODE=1` を付けて `resources\app\out\cli.js` を走らせる（`tests/smoke/lib/env.mjs` の 107〜108・142〜146 行）。`sukuna.cmd` の中身と同じ形。
  - データの場所: 版の名前によらない。実行ごとの `VSCODE_PORTABLE` と `--user-data-dir`・`--extensions-dir` で、`tmp\b\smoke\` の下に置く（`env.mjs` の 159〜170 行、`run.mjs` の 320〜329 行）。`product.json` に `target` があれば止める（`run.mjs` の 275 行）。
  - 古い名前の決め打ちは無い（`tests/smoke/` を Grep して `shuko` 0）。
- ただし、スモークの守りの照らし `safety.daily-argv` は、`~/.vscode`・`~/.vscode-oss` の `argv.json` だけを見る。`~/.<dataFolderName>`（`.sukuna`）は見ない（`run.mjs` の 207〜209 行）。`editor.dataFolderName` を求めているのに、使っていない。今回は起動の確かめ（4.1、7節）で `.sukuna` が無いことを別に確かめたので、合否には効かない（指摘 T2）。

### 4.3 通信の監査（各600秒）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開し直した版>/Sukuna.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r7 -DurationSeconds 600 -Previous records/network-audits/2026-11-17-p5r6
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <同じ> -EnvDir C:/b/p0/data/upstream-default -Label p5r7-ledger -DurationSeconds 600 -Previous records/network-audits/2026-11-17-p5r6-ledger
```

| 監査 | 記録 | エディタの宛先 | claude の宛先 | 許可の外 | 前の一覧（r6）に無い | 名前で見えたもの |
|---|---|---|---|---|---|---|
| p5r7（関門の環境） | `records/network-audits/2026-11-19-p5r7/` | 0 | 0 | 0 | 0 | `wpad` の解決2回（答えも接続も無い）だけ。r6 と同じ |
| p5r7-ledger（台帳の拡張・Claude Code を含む） | `records/network-audits/2026-11-19-p5r7-ledger/` | 0 | 0 | 0 | 0 | 同上 |

- `audit.md` の要約は、r6 の2つと行ごとに同じ（サンプル 300、net log 76 件で完全、DNS のキャッシュは空）。**宛先は r6 から変わらない**。
- 台本は監査の相手のプロセスを、`-Exe` のファイル名（`Sukuna.exe`）と実行ごとのデータの場所で見つける（`netaudit.ps1` の 926〜927・996 行）。許可の一覧（`records/network-allowlist.json`）のプロセスの名前は `claude.exe`・git の類だけで、エディタの名前は入っていない。
- ネットのログは、読んだ後に台本が消した（`NetLogFilesRemoved: true`。`tmp\b\netlog\` に `p5r7*` は無い）。普段使いの argv.json は触られていない（`DailyArgvTouched: []`。見る場所は `.vscode`・`.vscode-oss`・`.shuko`・`.sukuna`。`measure.ps1` の 651〜660 行）。一時のデータの残りも無い（`RunDataLeftOver: []`）。
- 2つの監査は1本ずつ続けて走らせた。その間に、エディタを起動する検査は重ねていない（単体のテストだけを `--no-guard` で並べた）。計測（docs/07 の3.1・3.2・3.4）は裁定（2026-11-13）で使わないので、流していない。「消えている」の検査（absent）は、21単位の木と r6 の差が名前の注釈だけなので、r3c の記録をそのまま使う（r6 の関門と同じ扱い）。

## 5. 適用後の検査（新しい作者）

| コマンド | 結果 |
|---|---|
| `node tests/c1-check-json.mjs tasks/2026-11-19-r7-build/1.146.0-p5-c-all-r7/checks.json` | 期待どおり（当て直しのみ） |
| `node tests/c2-check-json.mjs <同じ>` 〜 `c6` | 5本とも「期待どおり（組 c: 当て直しのみ）」 |
| `node tests/c7-check-json.mjs <同じ>` | 期待どおり（組 b: 当て直しのみ） |
| `node tests/c1-check-worktree.mjs E:/…/tmp/b/wt/r7/w` 〜 `c7` | 7本とも「期待どおり（作業ツリー）」 |

- `checks.json` の `startedAt` は `2026-11-19T02:15:20Z`（作者の境目 `2026-11-17T15:00Z` の後）。作者は `sukuna-apply <apply@sukuna.invalid>` の79件だけで、古い作者は 0。`tests/build/commit-author.mjs` の `expectedAuthor` はこの記録に新しい作者を求め、c2〜c7 はそれで通った。
- 落ちるべきときに落ちるか: `commit-author.test.mjs`（2/2）が、「前の記録に新しい作者」「後の記録に古い作者」のどちらでも食い違いになることを確かめている。check-json のテスト（8 ファイル 111 件）も通る（6節）。

## 6. テスト

### 6.1 全部（見張りあり）

`node tests/run-all.mjs --save tasks/2026-11-19-r7-gate/run-all-r7.txt`（PowerShell のテストを含む。見張りは有効のまま。通信の監査とスモークが終わった後に、ほかの実行を重ねずに走らせた）

- 77ファイル（`*.test.mjs` 75・`*.tests.ps1` 2）、**3,073件。pass 3,065・fail 1・skip 7**。
- 落ちたのは `rename-leftovers.test.mjs` の「リーダーの 2c の分（.claude/）に古い名前が残っていない」の1件だけ。単独で流し直すと、失敗の文は `.claude/agents/vlad-tepes.md: 1 行（初めは 8 行目）`。改名の検証の再検証で、コミットの後にも残ると分かっていた既知の1件（Team の開発部に依頼済み）。
- 改名の検証の再検証（`run-all-result-r2.txt`）と比べると、件数は同じ 3,073。そのとき落ちていた2件のうち、古い束のファイル名の1件は、コミットで消えて通るようになった。
- skip の7件は、`apply-cli` の2件（試しの作業ツリーが無い）、`l10n-audit-more` の実物の4件と `l10n-audit` の実物の1件（環境変数が要る。2.2）。
- 見張り（`[guard]`）の通知は無い。テストが本物の作業場所に書いた跡は無い。
- `move-off-c.test.mjs` は 26/26、`configure.test.mjs` は 19/19。r6 の関門の追記で「日常の Shuko が動いているため」に落ちた各1件も通る。改名で `configure.ps1` の既定の `installRoot` が `%LOCALAPPDATA%\Programs\Sukuna`（まだ何も動いていない）になったため。テストの作りは変わっていないので、移行の後に Sukuna を日常で使い始めると、同じ2件がまた落ちる（指摘 T3）。

### 6.2 群ごと（`node tests/run-all.mjs --no-ps --no-guard --only <名前> --save tasks/2026-11-19-r7-gate/run-all-<名前>-r7.txt`）

`--no-guard` にしたのは、通信の監査（`tmp\b\audit`・`netlog` に書く）と同じ時間に走らせたため（r6 の関門と同じ扱い）。結果は 6.1 と食い違わない。

| まとめ（`tasks/2026-11-19-r7-gate/`） | 件数 | 結果 |
|---|---|---|
| `run-all-l10n-r7.txt` | 226 | 221 通る、5 飛ぶ（実物の5件） |
| `run-all-rename-r7.txt` | 15 | 14 通る、1 落ちる（既知の `vlad-tepes.md`） |
| `run-all-migrate-r7.txt` | 20 | 全部通る |
| `run-all-check-json-r7.txt` | 111 | 全部通る |
| `run-all-apply-r7.txt` | 162 | 160 通る、2 飛ぶ |
| `run-all-build-r7.txt`（137）・`take-in`（138）・`install`（63）・`removals`（229）・`unit`（c1〜c7、299）・`move-off-c`（58）・`configure`（19）・`smoke-unit`（80）・`watch`（114）・`switch`（49）・`lock`（132）・`make-icons`（33） | 1,351（`switch-watch-warn` の 10件は `watch` と `switch` の両方に入る） | 全部通る |
| `node --test tests/commit-author.test.mjs` | 2 | 全部通る |
| `node --test tests/start-menu-shortcut.test.mjs tests/local-config.test.mjs tests/notion-sync.test.mjs` | 159 | 全部通る（`start-menu-shortcut` は ID・実行ファイルを product.json から求める） |
| `powershell … -File tests/measure.tests.ps1`・`netaudit.tests.ps1` | 142・113 | 全部通る（日常の argv.json の一覧に `.shuko`・`.sukuna` が入ることを含む） |

## 7. 日常の場所を作っていないか（前後）

| 場所 | 前（11:46） | 後（14:56） | 見た方法 |
|---|---|---|---|
| `%APPDATA%\Sukuna` | 無い | 無い | `p1-launch-check.ps1` の `dailyData`（フォルダの有無と更新時刻だけを見る）。前は `launch-check-p5-c-all-r7-ooka.json` の `before`、後は全部の検査の後に打った `launch-check-p5-c-all-r7-ooka-after.json` の `before`・`after` |
| `%USERPROFILE%\.sukuna` | 無い | 無い | 同上 |
| `%LOCALAPPDATA%\Sukuna\local.json` | 無い | 無い | `node scripts/build.mjs 1.146.0 --label 1.146.0-p5-c-all-r7 --worktree tmp/b/wt/r7/w --dry-run --record tasks/2026-11-19-r7-gate/config-probe-{before,after}.json` の `config.exists: false`（何も走らせず、計画だけを出す） |
| `%LOCALAPPDATA%\Sukuna`（フォルダ） | 直接は見ていない | 直接は見ていない | 私の読む許可（`./`・`C:/b/`）の外。上の `local.json` が無いことと、私の打ったものに `%LOCALAPPDATA%\Sukuna` へ書くもの（`configure.ps1`・`watch.mjs`・移行の台本）が無いことで代えた |

補足: 移行の台本（`scripts/migrate/migrate-from-shuko.ps1` の 324〜327・356〜363 行）が「書く先が空でない」で止まるのは、`%APPDATA%\Sukuna`（中身があるとき）、`%USERPROFILE%\.sukuna\argv.json`（あるとき）、`%LOCALAPPDATA%\Sukuna\watch\`・`secrets\`（中身があるとき）の4つ。`%LOCALAPPDATA%\Sukuna` そのものや `local.json` があっても止まらない（`rename-plan.md` の3.3の3で、`configure.ps1` が先に `local.json` を作る順になっている）。

## 8. 移行の前に気をつける点

1. **権限の段1が先**。移行の台本の本番（`-Apply`）は、Sukuna の秘密の場所（`%LOCALAPPDATA%\Sukuna\watch\`・`secrets\`）が4人の `secret_paths` に入ってから打つ（改名の検証の9節の1）。私の `permissions.json` の `secret_paths` も、今は `%LOCALAPPDATA%/Shuko/…` だけ。
2. **Sukuna を先に普通の形で起動しない**。`rename-plan.md` の3.3のとおり、ユーザーのデータの写し → 拡張の導入 → スタート メニューから起動、の順を守る。`install-extensions.mjs` も CLI で `%APPDATA%\Sukuna` を作りうるので、写しの後に打つ。関門の起動は全部ポータブルで、`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna` は無いまま（7節）。
3. **移行の台本を打つ間は、どこの `Sukuna.exe` も動かさない**。台本は名前が `Shuko.exe`・`Sukuna.exe` のプロセスを、場所によらず「動いている」と見て止まる（`migrate-from-shuko.ps1` の 297〜310・343〜351 行）。関門・スモーク・監査で `tmp\b\p2`・`tmp\b\smoke` の Sukuna を起動していても止まる。壊れはしないが、止まったら原因はこれ。
4. **検知のタスク**: 2026-11-18 の時点で `\Shuko\watch` は未登録（`docs/user-decisions.md` の「裁定（2026-11-18、改名の権限）」の前の事実）。未登録のままなら、改名のコミットの後に古いタスクが `%LOCALAPPDATA%\Sukuna\watch\` を書く心配は無い。その後に登録していれば、古いタスクも新しいリポジトリの `watch.mjs` を動かして `%LOCALAPPDATA%\Sukuna\watch\` を書き、台本の `watch` が `destNotEmpty` で止まる・ToDo が二重になる恐れがある（`rename-plan.md` の3.2）。移行の前に、登録の有無を確かめ直すのがよい。
5. **今の `local.json` の値の控え**: `rename-plan.md` の3.3の1は「改名のコミットの直前に `configure.ps1`・`switch.ps1 -List` で控える」だが、コミットはもう入っている。控えが無ければ、古い `%LOCALAPPDATA%\Shuko\local.json` は残っているので、`configure.ps1 -ConfigPath <古い local.json>` で値を読める（蒙恬に頼む。私の許可の外）。
6. **移行の前に `%LOCALAPPDATA%\Sukuna\watch\`・`secrets\` が無いか空か**を、見る許可のある者が確かめる（私は見られない。7節）。
7. **日常は r4 のまま**: 日常の Shuko は r4（`1.146.0-1`）で、r6 には入れ替わっていない。そのため、組み込みの日本語パックとアイコン A の手の確かめ（r6 の J1〜J10・I1〜I5）は、まだ誰も見ていない。r7 で初めて見る項目として、`manual-checks-p5-c-all-r7.md` の U9・U10 に入れた。
8. **戻し方**は、日常の Shuko を起動するだけ。移行の台本は元の場所に書かない・消さない（改名の検証の5節）。
9. 移行の後に課とユーザーが見る項目は `manual-checks-p5-c-all-r7.md`（このフォルダ）。実行ファイルの版の情報（U6）と URL の登録（K8）は、関門では見られなかった。

## 9. 指摘（どれも r7 の版の中身には効かない。移行を止めない）

| # | 担当 | 場所 | 中身 | 急ぎ |
|---|---|---|---|---|
| T1 | 曹参 | `tests/l10n-audit-more.test.mjs` の 446〜451 行 | 実物の作業ツリーの既定が `tmp/b/wt/r7` で、実際の作業ツリー `tmp/b/wt/r7/w` と合わず、既定では黙って飛ぶ（蒙恬の「見てほしい点」1）。既定を `…/r7/w` にするか、`extensions` が無ければ1つ下の `w` を見る形にする。テストの題と飛ぶ理由の文も「r4」のまま（中身は r7） | 低い |
| T2 | 曹参 | `tests/smoke/lib/run.mjs` の `dailyArgvState`（207〜209 行） | `~/.vscode`・`~/.vscode-oss` だけを見る。`resolveEditor` が求めた `dataFolderName` の `argv.json`（`~/.sukuna\argv.json`）と `%APPDATA%\<nameLong>` も見れば、移行の前にスモークが日常の場所を作ったことを捕まえられる（`measure.ps1` は `.shuko`・`.sukuna` を見ている） | 移行の前が望ましい（今回は起動の確かめで代えた） |
| T3 | 曹参 | `tests/configure.test.mjs`（187〜193 行）・`tests/move-off-c.test.mjs` の1件 | r6 の追記と同じ。サンドボックスの `local.json` に前の `installRoot` を書かずに `configure.ps1` を走らせるので、日常の Sukuna が `%LOCALAPPDATA%\Programs\Sukuna` で動き始めると、また `editor-running` で落ちる | 移行の後の run-all まで |
| M1 | 蒙恬 | `scripts/trial-r7-verify.mjs`（使い捨て。コミットしない）の中身の調べ（139〜151 行） | `latin1` だけで探すので、UTF-16 の文字列（実行ファイル・`.node`・`rg.exe` の版の情報）を見ない（3節の注）。同じ道具を次の版でも使うなら、UTF-16LE の `s\0h\0u\0k\0o\0` も探す | 低い |
| P1 | リーダー（権限） | 私の `permissions.json` | 依頼書の求める `AIED_AUDIT_WT=… node --test …` が打てない（2.2）。`%LOCALAPPDATA%\Sukuna` の有無も見られない（7節）。移行の確かめ（`rename-plan.md` の4節の順7）では、`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna` の有無と中身の名前を見る必要がある。そのための読む場所か、有無だけを出すコマンドが要る。足すかどうかはリーダーとユーザーの判断 | 移行の確かめの前 |
| K1 | Team の開発部 | `.claude/agents/vlad-tepes.md` の8行目 | 古い名前が1行残る（`rename-leftovers.test.mjs` の既知の1件。依頼済み） | 依頼済み |

## 10. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、このフォルダ、`tasks/2026-11-19-r7-gate/`（`brief.md` を除く）、台本が書く `records/network-audits/2026-11-19-p5r7*/` と `tmp\b\` の下（`p2\1.146.0-p5-c-all-r7-ooka\`、`smoke\runs\p5r7-*`、`smoke\ext\1.146.0-p5r7-*`、`smoke\baseline-p5-c-all-r7.json`、`audit\`、`netlog\`（台本が消した））。
- 起動はすべてポータブルの形で行った（`p1-launch-check.ps1`・`smoke-run.mjs`・`netaudit.ps1`。どれも `VSCODE_PORTABLE` を付ける）。`switch.ps1`・`configure.ps1`・移行の台本・`install-extensions.mjs` は打っていない。
- `tmp\b\wt\r7\w` は読んだだけ。日常の Shuko・`local.json`・スタート メニュー・PATH・タスク スケジューラ・Notion・秘密の場所には触れていない。

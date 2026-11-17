# 関門の記録: 版 `1.146.0-p5-c-all-r6`（アイコン A と日本語パック）

- 検証: 大岡越前守、2026-11-17（JST 9:50 ごろから）
- 依頼: リーダー（タスクの名称「版 r6 の関門（アイコン A と日本語パック）」、`tasks/2026-11-17-r6-gate/brief.md`）
- 相手:
  - 蒙恬のビルド（`tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md` の r6 の節）とコードの変更
  - 曹参のテスト（`tasks/2026-11-17-icon-ja-tests/handoff-notes-cao-shen.md` の7・8節、網 `tests/l10n-audit.mjs`）
- 版: zip `tmp\b\dist\1.146.0-p5-c-all-r6.zip`（SHA-256 `a70b0a1cb3525b64775024840199fca2aca183c142f83bb88a50a941e0b55f09`）、HEAD `3e1e616aa9f1538643a070f0684196c0cd688ddd`（枝 `builds/1.146.0-p5-c-all-r6`、作業ツリー `tmp\b\wt\r6\w`）
- 作った人の自己申告は根拠にしていない。下の結果は、どれも私が走らせたか、私が読んだもの。版の確かめは、私が zip から展開し直した `tmp\b\p2\1.146.0-p5-c-all-r6-ooka\` で行った。

## 判定

**合格。版 `1.146.0-p5-c-all-r6` を、日常の版 r4 と入れ替えてよい。**

入れ替えの前提（版の合否ではなく、入れ替えの手順の条件）:

1. 古い日本語パック `MS-CEINTL.vscode-language-pack-ja` を外す許可（`tasks/2026-11-17-l10n-ja/permission-requests.md`）が蒙恬に入ってから行う（裁定 2026-11-17）。外さないと、後から読まれる古い訳が組み込みのパックに勝ち、`install-extensions.mjs` も終了コード 3 で止まる。
2. 入れ替えの後、課が `manual-checks-p5-c-all-r6.md` の K1〜K4 を、ユーザーが J1〜J10・I1〜I5 を見る（アイコンの埋め込みと表示の日本語は、関門の自動の確かめでは見きれない）。

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | 版の一致 | **合格**。zip の SHA-256・作業ツリーの HEAD・枝・product.json の commit・`--version` が一致。r4 の木との差は14ファイルで、アイコン・日本語パック（その `ThirdPartyNotices.txt` を含む）・displayName・`product.json` だけ |
| 2 | 日本語の未訳 0 | **合格**。曹参の網（`--require-bundle --strict`、除外は `exclusions.json` だけ）で除外の外の未訳 0。蒙恬の `count` の記録と食い違わない。足した訳 184・上書き 14 の書式の印は、198件の全部で英語と合う |
| 3 | アイコン | **合格（確かめられる範囲で）**。出力の ICO・PNG・SVG の13ファイルが `assets/` と同じバイト列。`assets/` は台本の既定（A）の出力と同じ。`Shuko.exe` に埋め込まれたアイコンはバイト列では照らせず、間接の根拠で代えた（3節）。画面の確かめは I1〜I5 |
| 4 | 壊れていない | **合格**。起動の確かめ `result: ok`。スモーク3回とも PASS 49 / FAIL 0、新しい誤り無し。通信の監査2通り（各600秒）で宛先 0、許可の外 0、前の一覧に無いもの 0 |
| 5 | 差分のレビュー | **合格（直すべき点は小さいものだけ）**。docs/ と裁定に合う。許可の外を消す処理は無い。直すべき点は5.3節の表（どれも r6 の版の中身には効かない） |
| 6 | テスト | **合格**。関係する32ファイル 1,419件を走らせ、pass 1,416・fail 1・skip 2。fail の1件は `move-off-c.test.mjs` の、日常の Shuko が動いているための環境の都合（今回の変更と関係しない）。6節 |

## 1. 版の一致

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum tmp/b/dist/1.146.0-p5-c-all-r6.zip`（3回） | `a70b0a1c…5f09`。依頼書・`build-record.json` と一致 |
| 作業ツリーの HEAD | `tmp\b\wt\r6\w\.git` の指す `tmp\b\vscode\.git\worktrees\w1\HEAD` を読んだ | `3e1e616aa9f1538643a070f0684196c0cd688ddd` |
| 枝 | `git -C tmp/b/wt/r4 diff --stat builds/1.146.0-p5-c-all-r6 3e1e616a…` | 空（同じ木） |
| ビルドの記録 | `tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r6/build-record.json` | `result: ok`、`warnings: []`、`sourceVersion` は HEAD と一致（`matchesChecksHead: true`）、postprocess の `productCommit.ok`、`residual: []`・`missingOwn: []` |
| 版のフォルダ | 展開し直した版の `resources\app\product.json`、`--version`（起動の確かめ） | commit `3e1e616a…`、`1.146.0`・`x64`。蒙恬の展開（`tmp\b\p2\1.146.0-p5-c-all-r6\`）と product.json・`Shuko.exe`・`main.i18n.json` の SHA-256 が同じ |
| r4 の木との差 | `git -C tmp/b/wt/r4 diff --stat 7fac30e8…(r4) 3e1e616a…(r6)` | 14ファイル: `extensions/language-pack-ja/`（README・ThirdPartyNotices・package.json）、mydist と notion-sync の `package.json`（displayName だけ）、`product.json`（`extensions.allowed` から `MS-CEINTL.vscode-language-pack-ja` を外しただけ）、`resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`、`code-icon.svg`、`letterpress-*.svg` の4つ。これ以外の差は無い |
| r5 の木との差 | `git -C tmp/b/wt/r4 diff --stat 027caf9a… 3e1e616a…` | `extensions/language-pack-ja/ThirdPartyNotices.txt` の1つだけ（蒙恬の r6-2 のとおり） |
| 21単位の当て直し | `node tests/c1-check-json.mjs <r6 の checks.json>` 〜 c7、`node tests/c1-check-worktree.mjs E:/…/tmp/b/wt/r6/w` 〜 c7 | 14本とも「期待どおり」（c2〜c6 は組 c、c7 は組 b）。`checks.json` は `result: ok`、`stoppedAt: null` |
| ロックファイル・台帳 | `sha256sum` | `lockfile.diff` は r4 と同じ `ef5f98ab…3862`。`extensions.lock.json` は `27ad0e1b…db70`（ビルドの記録と同じ。7件） |
| 型検査 | `tmp\b\logs\1.146.0-p5-c-all-r6\typecheck.log` | `tsc …` の1行だけ |

訳の束（`dist/translations/`）は作業ツリーでは git の外なので、上の差分には出ない。作業ツリーの `main.i18n.json`（`880f255a…ea39`）と `vscode.git.i18n.json`（`83751fa7…b753`）はリポジトリと同じ SHA-256。出力の束は JSON の空白が詰められて別の SHA-256 になるが、蒙恬の展開・私の展開・gulp の出力の3つで同じ（`8964437f…fc32`）。

## 2. 日本語

### 2.1 網（曹参の `tests/l10n-audit.mjs`）

```
node tests/l10n-audit.mjs --app <展開し直した版>\resources\app --pack <同じ>\resources\app\extensions\language-pack-ja --worktree E:/…/tmp/b/wt/r6/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle --out records/take-in/1.146.0-p5-c-all-r6/l10n-audit-r6.json
```

終了コード 0、`pass: true`。

| 区分 | 総数 | 訳あり | 除外 | 除外の外の未訳 |
|---|---|---|---|---|
| 本体 | 12,355 | 12,350 | 5 | **0** |
| 拡張 package | 1,258 | 1,258 | 0 | **0** |
| 拡張 bundle | 1,564 | 1,564 | 0 | **0** |
| 自前の直書き | 22 | 22 | 0 | **0** |

- 網は出力の写し（`--literals auto` が出力の `package.json` を読んだ。`manifest: "app"`）と、パックの `package.json` の translations から引いた。`packMissingTranslationFiles: []`・`invalidExclusions: []`・`staleExclusions: []`・bundle の `skippedFiles: {}`。
- 除外は `exclusions.json` の5件だけ（どれも本体の `{0}: {1}`・`{0} ({1})`・`{0}%`・`{0} (Esc)` の書式だけの文言。理由 `format`）。bundle に除外は無い。
- git の `↔` の2件: 出力のパックの `vscode.git.i18n.json` に、実行時の鍵 `{0} ↔ {1}`・`{0} ({1}) ↔ {0} ({2})` がある（直す前の `ș` の鍵2件も残るが、本体は引かない）。網はソースの `\u2194` を自分で4桁で読む（`l10n-ja.mjs` の `decodeUnicodeEscapes` に頼らない）。
- **落ちるべきときに落ちる**: 同じ網に r5 の出力のパック（鍵の直しの前）を渡すと、終了コード 1、bundle の除外の外 2 で不合格（`tasks/2026-11-17-r6-gate/l10n-audit-r6app-r5pack.json`）。

### 2.2 蒙恬の `count` の記録との照らし

`l10n-ja.mjs count` は私の許可に無いので、記録 `tasks/2026-11-17-icon-ja-build/l10n-count-r6-unpacked.json`（展開した版のパック）・`l10n-count-r6.json`（gulp の出力）を読んだ。どちらも全体 15,159、除外 5、除外の外の未訳 0、`placeholderProblems: []`、`result: ok`。

件数の違い（網の本体 12,355 と count の 12,334、網の bundle 1,564 と count の 1,545）は、前の検証（`tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md`）と曹参の4節で説明がついている（本体は「並び」と「モジュール・鍵の組」の数え方の違いで、差の21組は同じ鍵の重なり。bundle は網が依存の依存と `bundle.l10n.json` も読むため。多い分も全部パックに訳がある）。どちらの数え方でも結論は「除外の外の未訳 0」で、食い違わない。

### 2.3 足した訳 184件・上書き 14件の書式の印

- 強めた照らしの結果: `l10n-repo.test.mjs` の「count（CLI）… 足した訳の印の問題（placeholderProblems）は []」と `l10n-lib.test.mjs` の「M2: 今の added/*.json は、強めた照らしでも全部通る」が、今の `added/1.146.0.json`（198件）を `placeholderMismatch`（数・`&&`・`$(…)`・リンクの先）に全部かけて通った（6節）。`l10n-r6.test.mjs` は上書き14件と公式の誤り5件の直しを見て通った。`l10n-build-r6.json` の `provenanceForStrings` は公式 14,934・足した訳 184・上書き 14、`staleAdded: []`。
- 私の照らし（抜き取りでなく全部）: `added/1.146.0.json` の198件について、`{…}`・`&&`・`$(…)`・`](…)` を行ごとに拾い（Grep）、英語の行と訳の行で印を並べて比べた。印を持つ48組（本体と git の bundle）はすべて同じ印の組（並びを替えたのは `{0}`/`{1}` の1組だけ）。`&&` と `$(…)` を持つものは無い。印の無い文言で、訳だけに印が出るものも無い。
- 上書き14件の中身も読んだ: 公式の誤りの5件（`[[…]] ({0})` の空白2件、`${capture}`、`openLinkToSide` の `({0})`、`[設定の構成]({0})`）は印が英語と同じで、出力の `main.i18n.json` にその訳が入っている。ほかの9件（Marketplace、拡張の無効の2件、Zen Mode、すべてのリポジトリを展開、シェル統合の「基本」、アクセシビリティ対応のターミナル ビュー、ファイル ウォッチャー、reStructuredText）は印を持たない。

## 3. アイコン

| 確かめたこと | 結果 |
|---|---|
| `assets/` の8つが台本の既定（A）の出力と同じ | `make-icons.test.mjs` の「assets/ の下の SVG・ICO・PNG はすべて、台本の既定の出力と同じバイト列」「CLI: --check は … 0」、既定が `center-spark` であること（6節。33件すべて通る） |
| 出力の3つ（`resources\app\resources\win32\code.ico`・`code_70x70.png`・`code_150x150.png`） | `sha256sum` で `assets/` と同じ（`9ffbff5a…5fbc`・`b57bf2ae…8779`・`71d2ad0f…9f28`） |
| 出力の SVG（`out\media\` の5つと `out\vs\workbench\browser\…\media\` の5つ） | `sha256sum` で `assets/` の5つと同じ（`code-icon.svg` `2dc63505…a8ad0`、`letterpress-light` `a20023ef…b95a`、`-dark` `d059254e…6727`、`-hcLight` `7936e3de…9a51`、`-hcDark` `ed919272…9b94`） |
| 作業ツリーの `resources\win32\code.ico` | `assets/` と同じ `9ffbff5a…5fbc`（本家の `build/lib/electron.ts` の `winIcon: 'resources/win32/code.ico'` で実行ファイルに入る） |
| 元の絵 | `scripts/icon-src/` の2つが `SOURCES.json` の SHA-256 と一致（`57270d90…0e13`・`a3101f30…8364`。後者は裁定の記録の値と同じ） |
| `Shuko.exe` に埋め込まれたアイコン | **バイト列では照らせなかった**（実行ファイルの資源を読む道具が許可に無い）。代わりの根拠: `Shuko.exe` の SHA-256 が r4（`06d4c535…23b0`）と r5・r6（どちらも `c2887545…6665`）で違い、r5 と r6 は同じ。r4 と r5 の木の差のうち、実行ファイルの資源に入るものはアイコン（`code.ico`）だけで、版の文字列（1.146.0・nameLong）は同じ。よって実行ファイルの違いはアイコンの差し替えによると見てよい。画面の確かめ I1・I2・I5 で確定させる |

## 4. 壊れていない

### 4.1 起動の確かめ

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-17-r6-gate/launch-check-p5-c-all-r6-ooka.json -Zip <r6 の zip> -Dest E:/…/tmp/b/p2/1.146.0-p5-c-all-r6-ooka -InstallExtension <台帳の6つの VSIX>
```

`result: ok`（started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged）。`--version` は `1.146.0`・`3e1e616a…`・`x64`。VSIX 6つとも導入できた。ワークベンチのしるし3つが true、`Uncaught` 0（ワークベンチ 0、ほか 0）。普段使いのデータの6つのフォルダは変わらない。展開先の `languagepacks.json` の `ja` は `shuko.language-pack-ja` 1.146.0 と `shuko.notion-sync`、`translations.vscode` は展開先の `…\extensions\language-pack-ja\dist\translations\main.i18n.json`。

### 4.2 スモーク3回（比べる相手は `baseline-p5-c-all-r3c.json`）

```
node tests/smoke-run.mjs --build E:/…/tmp/b/p2/1.146.0-p5-c-all-r6-ooka/Shuko-win32-x64-1.146.0-p5-c-all-r6 --label p5r6-1 --mode built --prime --baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r3c.json --save-baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r6.json --timeout 300 --keep-runs 40
（2・3回目は --label p5r6-2・p5r6-3 と --merge-baseline）
```

| 回 | 置き場所（`.keep` を置いた） | 結果 |
|---|---|---|
| 1 | `tmp\b\smoke\runs\p5r6-1-261117T005343\` | PASS 49 / FAIL 0 / INFO 9、`errors.new`: 新しい誤りなし |
| 2 | `tmp\b\smoke\runs\p5r6-2-261117T005542\` | PASS 49 / FAIL 0 / INFO 9、新しい誤りなし |
| 3 | `tmp\b\smoke\runs\p5r6-3-261117T005730\` | PASS 49 / FAIL 0 / INFO 9、新しい誤りなし |

- 誤りの行は各回とも renderer.log の既知の2行（`DEP0169 url.parse()`・`TextModel got disposed before DiffEditorWidget model got reset`）だけ。3回の和 `tmp\b\smoke\baseline-p5-c-all-r6.json` は `runs: 3`、鍵2個（r3c の基準と同じ2つ）。exthost・main・共有プロセス・devtools・chromium の誤りは 0。
- `base.ext-install` は台帳の7件（古い日本語パックを含まない）。それでも `base.ui-language` が3回とも PASS（`vscode.env.language = ja`）。組み込みのパックで表示の言語が日本語に切り替わったことを示す。
- Claude Code の組（`claude.running` 2.1.322・`claude.exthost-log`・`claude.lock`）、言語の組（TS・Python・HTML・CSS・JSON・CSV・.env・sh・PowerShell）、`base.git`・`base.search`・`base.replace`・`base.terminal`・`base.image-preview` など、どれも PASS。

### 4.3 通信の監査（各600秒）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開し直した版>/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r6 -DurationSeconds 600 -Previous records/network-audits/2026-11-16-p5r3c
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <同じ> -EnvDir C:/b/p0/data/upstream-default -Label p5r6-ledger -DurationSeconds 600 -Previous records/network-audits/2026-11-16-p5r3c-ledger
```

| 監査 | 記録 | エディタの宛先 | claude の宛先 | 許可の外 | 前の一覧（r3c）に無い | 名前で見えたもの |
|---|---|---|---|---|---|---|
| p5r6（関門の環境） | `records/network-audits/2026-11-17-p5r6/` | 0 | 0 | 0 | 0 | `wpad` の解決2回（答え・接続なし）だけ。r3c と同じ |
| p5r6-ledger（台帳の拡張・Claude Code を含む） | `records/network-audits/2026-11-17-p5r6-ledger/` | 0 | 0 | 0 | 0 | 同上 |

ネットのログは読んだ後に台本が消した（`tmp\b\netlog\` に p5r6 の名前のファイルは無い）。普段使いの argv.json は触られず、一時のデータの残りも無い（`DailyArgvTouched: []`・`RunDataLeftOver: []`）。計測（docs/07 の3.1・3.2・3.4）は裁定（2026-11-13）で使わないので、流していない。「消えている」の検査（absent）は、21単位の木が r4（r3c と同じ木）と同じなので、r3c の記録を使う。

## 5. 差分のレビュー

対象: 最後のコードのコミットから今の作業ツリーまでの、蒙恬と曹参のコードの変更すべて（`git log` の上の6つはどれも docs・依頼書・記録・権限だけで、コードの変更は全部が作業ツリーの未コミットの変更）。`git diff`（変更）と Read（新しいファイル）で全部読んだ。

### 5.1 docs/ と裁定に合うか

| 変更 | 照らした裁定・設計 | 結果 |
|---|---|---|
| `scripts/make-icons.mjs`（`DEFAULT_VARIANT = "center-spark"`、ほかの意匠は残す）、`assets/` の8つ、`assets/README.md`、`scripts/copy-icon-sources.mjs`、`scripts/icon-src/` | 裁定 2026-11-17（アイコンは A、名前は Shuko のまま）、記録 2026-11-17（元の絵は `scripts/icon-src/` に写す）、docs/02 の44〜46行 | 合う。既定でない意匠の描き方も残す（蒙恬の2.2の理由は妥当。`--variant` を付けない限り `assets/` に出ない）。名称の文字は絵に無い（テストが `<text>` の無いことを見る） |
| `scripts/apply.mjs`（M1: パックが無いと止める、`languagePackMissingFiles`） | 前の検証の M1、docs/04 の7節の1 | 合う。mydist と同じく止め、notion-sync は前のまま |
| `scripts/lib/l10n-ja.mjs`（M2: `placeholderMarks`・数まで見る `placeholderMismatch`、`decodeUnicodeEscapes`、`thirdPartyNotice`） | 前の検証の M2、記録 2026-11-17（案 b、ThirdPartyNotices に下の層も書く） | 合う |
| `scripts/l10n-ja.mjs`（fetch・extract・todo・add・build・count） | docs/04 の7節の3〜7、記録 2026-11-17（PR #2450 を最優先、dist をリポジトリに入れる、束から下の層を外さない） | 合う |
| `scripts/take-in.mjs`（ビルドの後に extract・count、採否を止めない） | docs/06 の4節の 5a、記録 2026-11-17（`take-in.mjs` が数えて記録に書く、数えるだけで訳さない） | 合う。失敗しても `Stop` しない |
| `TAKE-IN.md`（1節の4、3節の末尾、4節） | 裁定 2026-11-16（入れ替えは課）、記録 2026-11-17（未訳で採否を止めない、訳すのは蒙恬） | 合う。`switch.ps1`・`install-extensions.mjs` を `claude -p` が走らせない決まりは残っている |
| `extensions.lock.json`（古いパックを外す）、`product.overlay.json`（allowed から外す）、`scripts/install-extensions.mjs`（`RETIRED_EXTENSIONS`・`retiredNotes`） | 記録 2026-11-17（台帳と `extensions.allowed` から外す）、裁定 2026-11-17（外すのは許可を持つ者） | 合う。台本は外さず、説明を添えて止まるだけ |
| `builtin/keep.json`・`scripts/build.mjs`・`scripts/lib/apply/classify.mjs`（自前の拡張に `language-pack-ja`） | docs/04 の7節の1 | 合う |
| `extensions-src/mydist`・`notion-sync` の displayName の日本語化 | 裁定 2026-11-17（未訳を残さない）。直書きは言語パックで訳さないため | 合う |
| `extensions-src/language-pack-ja/`（sources・added・exclusions・dist・ThirdPartyNotices・README・package.json） | docs/04 の7節、記録 2026-11-17 | 合う。除外は書式だけの5件 |

### 5.2 消すものを消し、残すものを壊していないか

- 許可の外を消す処理は**無い**。今回の変更で増えた削除は2つだけで、どちらも決まった場所の中:
  - `scripts/apply.mjs`: `extensions/language-pack-ja` を写す前に、作業ツリーの中の同じフォルダを消す（mydist・notion-sync と同じ前からの作り）。
  - `scripts/l10n-ja.mjs` の `build`: リポジトリの `extensions-src/language-pack-ja/dist/translations` を消して書き直す。
- `make-icons.mjs`・`copy-icon-sources.mjs`・`take-in.mjs` の追加分・`install-extensions.mjs` の追加分に削除は無い（`RETIRED_EXTENSIONS` は説明の文だけで、外す操作はしない）。
- 21単位は r4 と同じに当たり（1節）、r4 の木との差は14ファイルだけ。消した拡張の残り 0（`residual: []`）。

### 5.3 直すべき点（どれも r6 の版の中身には効かない。入れ替えを止めない）

| # | 担当 | 場所 | 中身 | 急ぎ |
|---|---|---|---|---|
| L1 | 蒙恬 | `scripts/take-in.mjs` の `runL10nCount` | `count` が `--out` を書く前に落ちたとき（終了コード 1）、前の回の `l10n-count.json` が残っていると、それを読んで古い `untranslated` を `take-in.json` の `l10n` と warnings の文に写す（`status` は `failed` になるが、数は古い）。`count` の前に出力を消すか、更新の時刻を見るか、終了コード 0・5 以外では数を写さないようにする。`--from` で続きから走らせたときに起きうる | 次の取り込みまで |
| L2 | 蒙恬 | 同じファイルの `summarizeL10nCount` | 終了コード 5 で出力が無いとき `status: "untranslated"` のまま（曹参が8節の末尾で挙げた点）。出力が無ければ終了コードによらず `failed` にするのが素直 | 低い |
| L3 | 蒙恬 | `extensions-src/language-pack-ja/README.md` の表 | `ThirdPartyNotices.txt` の行が「vscode-loc の MIT の表示 / build が写す」のまま。r6-2 で、訳の元すべての出典と LICENSE の写しを `thirdPartyNotice` で書く形に変わった | 低い |
| T1 | 曹参 | `tests/l10n-r6.test.mjs` の take-in の3件 | 「ソースの構造の確かめ」で、台本の文の書き方（`ctx.rec.warnings.push(\`日本語パック: …` など）に合わせた正規表現。振る舞いは見ていない（言い回しを変えるだけで落ち、壊れた振る舞いでも書き方が同じなら通る）。模擬のビルドの記録と模擬の `l10n-ja.mjs` で、`runCore` の数えの道（失敗で止まらない・warnings に1行・`--from` で数え漏れない）を実際に走らせる形に替えるとよい。L1 の形もそこで見られる | 次の取り込みまで |
| T2 | 曹参 | `tests/l10n-audit-more.test.mjs` の「古い 1.131.0 のパックでは … 不合格」 | 古いパックを `%USERPROFILE%\.shuko\extensions\` から読む。入れ替えで古いパックを外すと、このテストは黙って飛ぶ（網が落ちるべきときに落ちる、の確かめが消える）。キャッシュの VSIX（`tmp\b\cache\vsix\MS-CEINTL…`）か、テストの中の模擬のパックに替える | 入れ替えの後 |
| D1 | リーダー（docs） | `docs/install.md` の151・157・165・190行 | 「台帳の8つの拡張（…日本語の言語パック）」「`vsix` の8件」「手順4の8つ」のまま。台帳は7件になり、日本語パックは組み込み。151行の `shuko --version` の commit は入れ替えの後 `3e1e616a…` になる | 入れ替えのとき |
| D2 | リーダー（docs） | `docs/04-bundled-extensions.md` の161行 | r4 の時点の数（足した訳 182、上書き 9）。r6 は足した訳 184、上書き 14（公式 14,934） | 低い |

ほかに見たこと（直さなくてよい）:

- `tests/make-icons.test.mjs` の `renderIcon` のテストは「真ん中に白い点」から「真ん中に不透明な点」に緩めてある。前の意匠（白い `>_`）に合わせた検査で、意匠が変わったための正当な変更。新しい意匠には、青と橙の両方が 16・32・256 px と 150 px にあること、橙が `#D97757` に近いこと、SVG に `<text>`・外への参照が無いことを見る検査が足されている。仕様を緩めたものではない。
- `move-off-c.test.mjs` の1件は、`configure.ps1` が本物の `installRoot`（`C:\Users\kou_z\AppData\Local\Programs\Shuko`）で動いている Shuko（21のプロセス）を見て `editor-running` で止まるためで、テストが走る環境に左右される（失敗の文で確かめた）。前からある作りで、今回の変更の外。

## 6. テスト

走らせ方: `node tests/run-all.mjs --no-ps --no-guard --only <名前> --save tasks/2026-11-17-r6-gate/run-all-<名前>-r6.txt`（各まとめは下の表のファイル）。`--no-guard` にしたのは、通信の監査（`tmp\b\audit`・`netlog` に書く）や全体の run-all と同じ時間に走らせたため（見張りが、ほかの実行の書き込みを誤って数える）。ほかに、`node --test` で l10n・make-icons・take-in・install-ext・builtin-l10n・apply-parts・build-parts・move-off-c を流し、同じ結果だった。

| まとめ（`tasks/2026-11-17-r6-gate/`） | ファイル | 件数 | 結果 |
|---|---|---|---|
| `run-all-l10n-r6.txt` | `l10n-lib` 61・`l10n-audit` 14・`l10n-audit-more` 42・`l10n-repo` 55・`l10n-r6` 22・`builtin-l10n` 19 | 213 | 全部通る（todo 0・skip 0） |
| `run-all-make-icons-r6.txt` | `make-icons` | 33 | 全部通る |
| `run-all-take-in-r6.txt` | `take-in` 95・`take-in-more` 43 | 138 | 全部通る |
| `run-all-apply-r6.txt` | `apply-cli` 7・`apply-commits` 25・`apply-parts` 57・`apply-prune` 7・`apply-selfcheck` 33・`apply` 33 | 162 | 160 通る、2 飛ぶ（`apply-cli` の試しの作業ツリーが無い。前の検証と同じ） |
| `run-all-build-r6.txt` | `build-commit` 21・`build-env-branch` 29・`build-fixes` 17・`build-parts` 38・`move-build-root` 32 | 137 | 全部通る |
| `run-all-install-r6.txt` | `install-doc` 4・`install-ext` 46・`install-portable` 13 | 63 | 全部通る |
| `run-all-removals-r6.txt` | `removals` | 229 | 全部通る |
| `run-all-c1-unit-r6.txt` | `c1-unit` | 60 | 全部通る |
| `run-all-move-off-c-r6.txt` | `move-off-c` 26・`move-off-c-fixes` 32 | 58 | 57 通る、**1 落ちる**（5節の末尾。環境の都合） |
| `run-all-smoke-unit-r6.txt` | `smoke` | 80 | 全部通る |
| `run-all-watch-r6.txt` | `watch` 104・`switch-watch-warn` 10 | 114 | 全部通る |
| `run-all-lock-r6.txt` | `lock` 115・`lockfile-patched` 17 | 132 | 全部通る |
| 合計 | 32ファイル | **1,419** | pass 1,416・fail 1・skip 2 |

- 曹参の take-in の追加分（依頼文の「並行して曹参が足している take-in の追加分のテスト」）は、`tests/l10n-r6.test.mjs` に入って終わっていた（曹参の引き継ぎの8節。22件）。`l10nPlan` 4件・`summarizeL10nCount` 6件・`take-in.mjs` の流れ 4件を含み、全部通る。弱い所は5.3の T1。前からの `take-in`・`take-in-more` の138件も通る。
- 網が落ちるべきときに落ちるか: `l10n-audit-more` の「古い 1.131.0 のパックでは不合格」、`l10n-repo` の「count（CLI）… 印の合わない訳があれば終了コード 1」、M1 の「パックが無いと apply が止まる」5件、私の r5 のパックでの網（2.1）。どれも落ちるべき形で落ちる。
- 全部のテスト（見張りあり。`node tests/run-all.mjs --save tasks/2026-11-17-r6-gate/run-all-r6.txt`）も監査の後に背景で走らせたが、この記録を書いた時点で終わっていない。上の32ファイル以外（C-2〜C-7 の網・`absent`・`p1-*`・`switch`・`configure`・PowerShell のテストなど、今回の変更が触れないもの）の結果は、終わればそのファイルに出る。途中で私が `--no-guard` の実行を重ねたので、そのファイルの `[guard]` の通知はテストの落ちと読まないこと。

## 7. コミットしてよいもの・いけないもの

### 7.1 コミットしてよい（今回の変更）

コード・設定:

- `TAKE-IN.md`
- `assets/README.md`、`assets/resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`、`assets/src/vs/workbench/browser/media/code-icon.svg`、`assets/src/vs/workbench/browser/parts/editor/media/letterpress-light.svg`・`letterpress-dark.svg`・`letterpress-hcLight.svg`・`letterpress-hcDark.svg`
- `builtin/keep.json`、`extensions.lock.json`、`product.overlay.json`
- `extensions-src/mydist/package.json`、`extensions-src/notion-sync/package.json`
- `extensions-src/language-pack-ja/` の全部（`package.json`・`README.md`・`ThirdPartyNotices.txt`・`sources.json`・`exclusions.json`・`added/1.146.0.json`・`dist/translations/` の95ファイル。dist を入れることは記録 2026-11-17 で認められている）
- `scripts/apply.mjs`・`scripts/build.mjs`・`scripts/install-extensions.mjs`・`scripts/lib/apply/classify.mjs`・`scripts/make-icons.mjs`・`scripts/take-in.mjs`
- `scripts/copy-icon-sources.mjs`、`scripts/icon-src/`（`SOURCES.json`・`claude-logo.svg`・`vscode-code-icon.svg`）、`scripts/l10n-ja.mjs`、`scripts/lib/l10n-ja.mjs`
- `tests/make-icons.test.mjs`、`tests/l10n-audit.mjs`、`tests/l10n-audit.test.mjs`、`tests/l10n-audit-more.test.mjs`、`tests/l10n-lib.test.mjs`、`tests/l10n-repo.test.mjs`、`tests/l10n-r6.test.mjs`

記録:

- `tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md`、`1.146.0-p5-c-all-r6/`（`build-record.json`・`checks.json`・`lockfile.diff`）、`launch-check-p5-c-all-r6.json`、`l10n-count-r6.json`・`l10n-count-r6-unpacked.json`・`l10n-count-repo-pack-r6prep.json`、`l10n-build-r6.json`、`l10n-input-official-fixes.json`・`l10n-input-escape-fix.json`
- `tasks/2026-11-17-icon-ja-tests/handoff-notes-cao-shen.md`、`audit-r4-repopack-r6.json`
- `tasks/2026-11-17-r6-gate/` の私の記録（`brief.md` 以外の全部）、`records/take-in/1.146.0-p5-c-all-r6/`、`records/network-audits/2026-11-17-p5r6/`・`records/network-audits/2026-11-17-p5r6-ledger/`
- r5 の記録（`tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r5/`・`launch-check-p5-c-all-r5.json`・`l10n-count-r5-old-extract.json`・`l10n-count-r5-fixed-extract.json`・`l10n-count-repo-pack-fixed.json`・`l10n-build-escape-fix.json`）: 使わない版の記録だが、記録 2026-11-17（「r5 は関門に使わない」）の根拠で、蒙恬の引き継ぎの5・6節が名前を挙げているので、入れてよい（入れないなら引き継ぎの参照が切れる。リーダーの判断）

### 7.2 コミットしない

| ファイル | 理由 |
|---|---|
| `scripts/l10n-probe.mjs` | 使い捨ての調べの台本（記録 2026-11-17） |
| `tests/probe-l10n.mjs` | 同上（記録 2026-11-17） |
| `tasks/2026-11-17-icon-l10n-tests/audit-run-pack1131.json` | 重複の出力（記録 2026-11-17） |
| `tasks/2026-11-17-icon-ja-tests/extra-exclusions-bundle-escape.json` | 案 b で要らなくなった追加の除外。参照するコードは無い（曹参の7節: 消してよい） |
| `tasks/2026-11-17-icon-ja-tests/audit-r4-newpack.json`・`audit-r4-newpack-repo-exclusions-only.json` | 鍵の直しの前の網の出力で古い（曹参の7節の2）。今の結論は `audit-r4-repopack-r6.json` と私の `l10n-audit-r6.json` |
| `tasks/2026-11-17-icon-ja-tests/audit-r4-pack1131.json` | 広げる前の網での、古い 1.131.0 のパックとの比べ。古い出力（`audit-run-pack1131.json` と同じ役）。網が落ちるべきときに落ちることは、テストと私の `l10n-audit-r6app-r5pack.json` で示した |

### 7.3 今回の変更の外（このコミットに混ぜない。別に扱う）

前の仕事から残っている未コミットの変更・ファイル。今回の関門では確かめていない。

- 変更: `tasks/2026-11-13-p2-build-switch/build-switch-design.md`（2026-11-15 の `--portable` と `-WatchState` の追記）、`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-cao-shen.md`・`run-all-result.json`（2026-11-16 の r3 の節）、`tests/probe-dns.ps1`（調べの台本の書き換え）
- 新しいファイル: `tests/probe-netlog.ps1`・`tests/probe-netlog2.ps1`・`tests/probe-nodedebug.ps1`（調べの台本）、`tests/p34/`・`tests/fixtures/ref-p34/`・`tests/p34-selfcheck.test.mjs`（2026-11-14 に廃止と書かれたもの。中身は「リーダーが git rm してよい」の注だけ）、`tasks/2026-11-13-p0-envs-mydist-keys/configuration-defaults.md.section3.tmp`、`tasks/2026-11-13-p0-netaudit-hostnames/trial/`、`tasks/2026-11-15-move-off-c-verify/trial-local.json`、`tasks/2026-11-15-p5-c1-patch/typecheck-log.md.round2.tmp`

## 8. 入れ替えの後に画面で見る項目

`manual-checks-p5-c-all-r6.md`（このフォルダ）。要点:

- 課が先に: `shuko --version` の commit、`%APPDATA%\Shuko\languagepacks.json` が組み込みのパックを指し古いパックが無いこと、`install-extensions.mjs` が `ok`、入れた版に網を当てて未訳 0。
- 日本語: 全体が日本語か（英語の残りがあれば場所を書き留める）、バージョン情報のダイアログ、空のエディターのヒントのリンク（上書きで直した所）、ワークスペースの信頼の画面のリンク、ファイルの入れ子の設定の説明の `${capture}`、拡張の画面の組み込みの3つの名前。日本語になるのは2回目の起動からの見込み。
- アイコン: タスク バー・Alt+Tab、スタート メニュー（古いアイコンが残ればショートカットかピン留めを作り直す）、タイトル バーの左、エディターが空のときの透かし（明るいテーマと暗いテーマ）、エクスプローラーで見た `Shuko.exe`。

## 9. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、このフォルダ、`tasks/2026-11-17-r6-gate/`（`brief.md` を除く）、台本が書く `records/network-audits/2026-11-17-p5r6*/` と `tmp\b\` の下（`p2\1.146.0-p5-c-all-r6-ooka\`、`smoke\runs\p5r6-*`、`smoke\ext\…`、`smoke\baseline-p5-c-all-r6.json`、`audit\`、`netlog\`（台本が消した））。
- `tmp\b\wt\r6\w` は読むだけ。普段使いの Shuko・`local.json`・スタート メニュー・PATH・タスク スケジューラ・Notion・秘密の場所には触れていない。入れ替えと拡張を外す操作はしていない。

# 日本語化の作り方（本体と同じ版の日本語パック）

裁定（2026-11-17）は「未訳の部分を英語のまま残さず、日本語にする」。docs/04 の7節の進め方（本体と同じ版の言語パックを自分で作り、公式の訳に無い文言は課が足す）について、調べの結果と採った作り方をまとめる。変えたファイル、テストの入口、入れ替えで要ることは [handoff-notes-meng-tian.md](handoff-notes-meng-tian.md) に書いた。

## 1. 公式の訳の新しさ（2026-11-17 に調べた）

| 訳の元 | 版・commit | 日付 | 本体 1.146.0 の文言を訳している件数（全 15,137 件。自前の拡張の直書きを除く） |
|---|---|---|---|
| Open VSX `MS-CEINTL.vscode-language-pack-ja` | 1.131.0（最新。engines `^1.131.0`） | 2026-07-28 | 14,338（本体 11,645 / package 1,205 / bundle 1,488） |
| vscode-loc main | `62d5443b`。訳の最後の更新は `0f157dee`。パックの版の表示は 1.131.0 | 訳は 2026-09-04、HEAD は 2026-10-19 | 14,559（11,816 / 1,245 / 1,498） |
| vscode-loc PR #2450 の head | `e0407b9e`（main の上の1コミット。未マージ） | 2026-10-23 | 14,950（12,148 / 1,257 / 1,545） |

出典はどれも一次。

- Open VSX の版の一覧: https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-ja 。最新は 1.131.0（2026-07-28T04:15:48Z）で、それより新しい版は無い。
- vscode-loc の commit: https://api.github.com/repos/microsoft/vscode-loc/commits 。main の訳の更新は `0f157dee` "Updated strings from microsoft/vscode-loc-drop@916f5bf3..."（2026-09-04）が最後。版の番号の更新は `fa368b5a` "Updated Engine Number to 1.131.0"（2026-07-27）が最後。
- main の `i18n/vscode-language-pack-ja/package.json` は version 1.131.0、engines `^1.131.0`、translations 95件。
- PR: https://api.github.com/repos/microsoft/vscode-loc/pulls/2450 。作者は `azure-pipelines[bot]`、本文は "Updated strings from microsoft/vscode-loc-drop@85cff18b..."。base は main `62d5443b`、1コミットで、181ファイルが変わっている。
- 訳の更新の PR（#2439〜#2450、2026-10-14〜10-23）と版の番号の PR（#2453 の 1.144.0 〜 #2460 の 1.146.0、2026-10-26〜11-09）は、どれも open のまま。main への取り込みが止まっている。
- ライセンス: https://raw.githubusercontent.com/microsoft/vscode-loc/main/LICENSE.md は MIT License（"Visual Studio Code Localization Packs / Copyright (c) Microsoft Corporation"）。GitHub の API の license の欄は "Other" と出るが、本文は MIT。

### 1.1 どの本体の版の文言に当たるか

- 訳の元には英語の原文が無いので、版を直に決めることはできない。そこで、本体 1.146.0 の文言を何件訳しているかで比べた（上の表）。
- 公式の 1.146.0 は 2026-11-10 のビルドである（`tmp/b/official/vscode-1.146.0/69047191fc/resources/app/out/date`）。PR #2450 の書き出しは 2026-10-23 で、版の番号の PR の 1.144.0（10-26）の少し前に当たる。
- このことから、PR #2450 はおよそ 1.143〜1.144 の文言に当たると見る（推定）。
- 1.146.0 のうち PR #2450 に訳が無い文言は 187 件。新しい機能の文言（本体に入った画像・メディアのプレビュー、エディターのパーツの並べ替え、エージェント ウィンドウなど）が多い。

### 1.2 Shuko のパッチが足した文言

- 今の日常の版（`tmp/b/p2/1.146.0-p5-c-all-r4/.../resources/app/out/nls.keys.json`）と、公式の 1.146.0 の `nls.keys.json` を、モジュールと鍵の組で比べた。
- 公式に無い組は **1件** だった。`vs/platform/dialogs/electron-browser/dialog` の `aboutDetailWithoutCopilot`（「バージョン情報」の本文で、Copilot の行を除いたもの）。
- 同じ組で英語が公式と違うものは0件。
- 件数の規模: 日常の版は 1,011 モジュール・12,355 件、公式は 2,440 モジュール・32,108 件。削減で文言が減っている。

## 2. 入れ方

### 2.1 採った形: 組み込みの拡張にして、Open VSX のパックと置き換える

`extensions-src/language-pack-ja/`（ID `shuko.language-pack-ja`）を、mydist・notion-sync と同じく `apply.mjs` が `extensions/` に写す。`contributes.localizations` の `ja` に、`vscode`（本体）と組み込みの拡張の ID ごとの訳の束を並べる。

効く根拠は次のとおり（本家 1.146.0 のソースを読んで確かめた）。

- 言語パックの一覧は、入っている全部の拡張から作り直される。共有のプロセスが起動のたびに `NativeLanguagePackService.update()` を呼ぶ（`src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts`）。そのとき `extensionManagementService.getInstalled()` で、組み込み（system）とユーザーの拡張の両方を見る。`contributes.localizations` のある拡張から、`languagepacks.json` を作り直す（`src/vs/platform/languagePacks/node/languagePacks.ts` の `update`・`createLanguagePacksFromExtension`）。
- 組み込みの拡張でも一覧に載る。前例として、notion-sync の `shuko.notion-sync` は今の `languagepacks.json` に載っている（リーダーが確かめた）。
- 本体の文言は、一覧の `translations.vscode` の束を `out/nls.keys.json` の順に引く。無い鍵・空の訳は英語に戻す（`src/vs/base/node/nls.ts` の `resolveNLSConfiguration`）。
- 組み込みの拡張の manifest（`%key%`）は、一覧から作る `tcf.json` を通して、`contents.package` で訳す。コードの文言（`vscode.l10n.t`）は `getBuiltInExtensionTranslationsUri` で `contents.bundle` を読む（`extensionsScannerService.ts`・`languagePacks.ts`）。

### 2.2 Open VSX のパックと両立しない理由

- `createLanguagePacksFromExtension` は、同じ翻訳の ID（`vscode`・`vscode.git` など）を後に読んだ拡張で上書きする（`languagePack.translations[translation.id] = ...`）。
- 読む順は組み込みが先、ユーザーの拡張が後である（`extensionsScannerService.ts` の `scanAllExtensions` → `dedupExtensions`。`ExtensionIdentifierMap` に system、user の順で入れる）。
- そのため、Open VSX の 1.131.0 が入っている限り、`vscode` の束は古い 1.131.0 のものになる。両立すると、作ったパックが効かない。
- したがって、台帳（`extensions.lock.json`）と `extensions.allowed` から外し、入っている拡張も外す（外す操作は入れ替えの仕事。handoff の5節）。

### 2.3 `extensions.allowed` との関係

- 組み込みの拡張は `extensions.allowed` で止められない見込み。今の日常の版は `{"*": false, ...}` で、mydist・notion-sync を載せていない。それでも notion-sync は言語パックの一覧に載っている（リーダーが確かめた実物の事実）。言語パックの一覧は allowed を見ずに作られる。
- 組み込みにすれば、`extensions.allowed` に新しい ID を足す必要は無い。外すのは `MS-CEINTL.vscode-language-pack-ja` だけ。
- Open VSX のパックを `extensions.allowed` から外しても、入ったままなら言語パックの一覧には残る見込み。`getInstalled()` は止められた拡張も返すので、外す（uninstall）ことが要る（見込み。入れ替えのときに実物で確かめる）。

### 2.4 採らなかった形

- **自前の VSIX を作って台帳に載せる**: 台帳の確かめ（Open VSX の `verified`・署名・発行元）に合わない。新しい ID を `extensions.allowed` に足すのに、結局本体の作り直しが要る。VSIX の差し替えは軽いが、訳は本体の版の文言に合わせるものなので、本体と同じ周期でよい。
- **Open VSX のパックを残し、足りない分だけ別のパックで補う**: 2.2 のとおり、翻訳の ID ごとにファイル単位で上書きされるので、鍵ごとには合わせられない。

## 3. パックの作り方

台本は `scripts/l10n-ja.mjs`（fetch・extract・todo・add・build・count）、純粋な部品は `scripts/lib/l10n-ja.mjs`。

### 3.1 訳の元（`sources.json`）

- 先に書いた元が勝つ。今の順は PR #2450 → main → Open VSX 1.131.0。
- vscode-loc は commit を40桁で固定する。`i18n/vscode-language-pack-ja/translations/` の全ファイルと `package.json`・`LICENSE.md` の SHA-256 を記録する（`fetch --update-lock`）。
- 取るのは GitHub の tree の API で一覧を得て、raw.githubusercontent.com からファイルごとに取る。置き場所は `<buildRoot>\cache\l10n\vl-<commit の12桁>\`（長いパスを避けて短い名前にした）。
- Open VSX の VSIX は、台帳にあったときの URL と SHA-256 で取る。
- 1.146.0 では、main と 1.131.0 は PR #2450 に無い訳を1件も足さない（handoff の3.2）。今は残しているが、PR #2450 を使わないと決めたときの備えになる。

### 3.2 束を組む（`build`）

- dist の中身は、公式の層の全部の鍵と、足した訳から決まる。文言の表には頼らないので、dist は `sources.json` と `added/` だけで再現できる。表に無い鍵（削った機能の文言など）も入るが、本体はその鍵を引かないだけで、害は無い。
- 束の形は本家の言語パックと同じ。`dist/translations/main.i18n.json` が `{ version: "1.0.0", contents: { <moduleId>: { <key>: 訳 } } }`、`dist/translations/extensions/<ID>.i18n.json` が `{ version, contents: { package, bundle } }`。
- 鍵は名前の順に並べ、タブで字下げする。差分を行で読めるようにするため。
- `package.json` の translations は `build` が書く。`ThirdPartyNotices.txt` には vscode-loc の LICENSE.md を写す。

### 3.3 足した訳（`added/<本体の版>.json`）

- 鍵で引ける形: `core.<moduleId>.<key>`（本体）と `extensions.<ID>.package|bundle.<key>`（拡張）。
- 値は `{ en, ja }`。`en` は訳したときの英語で、`add` が文言の表から写す（手で写さない）。
- どの版で足したかは、ファイルの名前（版）で分かる。
- 優先の順:
  - 公式の訳があれば公式を使う。足した訳は使わず `redundantAdded` に出す（消してよい印）。
  - `override: true` だけは公式より先に使う。公式の訳が英語のまま（日本語を含まない）の文言を、日本語にするためのもの。1.146.0 では9件（handoff の6節の2）。
  - `en` が今の英語と違う足した訳（`staleAdded`）は束に入れない。build は終了コード5で止まる（訳し直しの合図）。
- 訳語は公式の日本語パックにそろえた。英語が同じ文言の公式の訳を、`scripts/l10n-probe.mjs suggest` で引いてそのまま使った（「拡大」「縮小」「画像全体」「イメージのズーム」「統合ブラウザーで開く」など）。用語は公式の訳から拾った。

| 英語 | 訳語 |
|---|---|
| editor | エディター |
| part（editor part） | パーツ |
| sash / gripper | サッシュ / グリッパー |
| watermark | 透かし |
| Restricted Mode | 制限モード |
| Agents window | エージェント ウィンドウ |
| agent host | エージェント ホスト |
| Simple Browser | シンプル ブラウザー |
| simple file dialog | 簡易ファイル ダイアログ |
| screen reader | スクリーン リーダー |
| accessibility help | アクセシビリティ ヘルプ |
| activation event | アクティブ化イベント |
| Extension Marketplace | 拡張機能マーケットプレース |
| Find in Files | フォルダーを指定して検索 |
| Get Started | はじめに |
| Toggle Details | 詳細の切り替え |
| Zen Mode | 禅モード |

その他の決まり:

- 置き換えの印（`{0}`・`{name}`）の過不足は誤りにする（`add`・`build` が止める）。
- 一覧の「Command executed {0}」は、公式の「コマンドは {0} に実行されました」に合わせた。

### 3.4 除外の決まり（`exclusions.json`）

- 理由は3つ: `format`（書式の印と記号・キーの名前だけ）、`proper-noun`（固有名詞・製品名だけ）、`code`（コード・コマンド・設定の名前だけ）。
- 1.146.0 で使ったのは `format` の5件。`{0}: {1}` が2件、`{0} ({1})`、`{0}%`、`{0} (Esc)`。公式の訳も同じ文言を「訳」として持つ形のもの。
- 項目には `en` を記録する。英語が変われば除外を見直す（未訳に数える）。
- 形は曹参の網（`tests/l10n-audit.mjs`）の除外の形にそろえ、同じファイルを両方で読めるようにした。
- 規則（正規表現）での除外は使わない。1件ずつ理由を書く。

### 3.5 文言の表と数え方（`extract`・`count`）

handoff の3.1に書いた。要点:

- 本体は `out/nls.keys.json` をモジュールと鍵で引く。
- 組み込み拡張は package.nls.json と bundle（作業ツリーのソースを `@vscode/l10n-dev` の `getL10nJson` に渡して読む）。
- 自前の拡張は manifest の直書きで数える。
- 未訳は「訳が無いか空」で、除外に無いもの。

### 3.6 結果（1.146.0-p5-c-all-r4）

| 区分 | 件数 |
|---|---|
| 全体 | 15,159（本体 12,334、package 1,258、bundle 1,545、直書き 22） |
| 公式の訳 | 14,941 |
| 足した訳 | 182 |
| 上書き | 9 |
| 直書き（日本語） | 22 |
| 除外 | 5 |
| **除外の外の未訳** | **0** |

曹参の網でも、除外の外の未訳は0（handoff の3.4）。

## 4. 自前の組み込み拡張

- mydist の displayName を「Shuko の既定」に、notion-sync の displayName を「Shuko Notion 同期」にした（どちらも英語のままだった）。ほかの直書きの文字列は、もとから日本語。
- language-pack-ja の displayName は「Shuko 日本語パック」。コード（`main`）を持たないので、拡張ホストの訳の束は要らない（notion-sync の `No bundle location found` の件は、コードを持つ拡張のことである）。

## 5. 範囲の外

- 台帳のほかの拡張（Claude Code・PowerShell・basedpyright など）の表示は対象の外。VSIX は改変しない（docs/04 の1節）。
- 拡張が自分で日本語の訳を持たなければ、英語のまま。

## 6. 次の版の手順（TAKE-IN.md に書く案）

自動にするかはリーダーが決める。案の手順は次のとおり。

1. **新しい訳の元を探す**（毎週の検知、または取り込みのとき）。
   - vscode-loc の main の新しい "Updated strings" の commit を探す。無ければ、open の bot の PR（作者 `azure-pipelines[bot]`、題 "Updated strings from microsoft/vscode-loc-drop@..."）の最も新しいものを探す。
   - あれば、`sources.json` の先頭の項目の commit・ref・date を書き換えて `node scripts/l10n-ja.mjs fetch --update-lock` を走らせる。
   - `tools/watch` に、vscode-loc の commit と PR を見る項目を足すかは、リーダーが決める。今は台帳の拡張だけを見ている。
2. **取り込みのビルドの後**、新しい出力と作業ツリーで文言の表を作る: `extract --app <出力>\resources\app --worktree <作業ツリー> --out tmp\l10n\strings-<tag>.json`。
3. **訳す文言を出す**: `todo --strings ... --out tmp\l10n\todo-<tag>.json`。次の3つを、訳す仕事の一覧にする。
   - 未訳
   - `staleAdded`（足した訳の英語が変わったもの）
   - `staleExclusions`（除外の英語が変わったもの）
4. **訳を足す**: 入力を作り、`add --strings ... --input ... --version <tag>` を走らせる。新しい版のファイル `added/<tag>.json` ができる。前の版のファイルは残す。
   - 訳語は3.3の表と、公式の訳の言い回しにそろえる。
   - 訳すのは蒙恬の仕事の中でよい。判定役（狄仁傑）に訳させるなら `claude -p --agent di-renjie` の決まりに従う。
   - `redundantAdded` が出れば（公式が追いついた）、その項目を `added/` から消してよい。
5. **束を作り直す**: `build --strings tmp\l10n\strings-<tag>.json` が終了コード0（除外の外の未訳0、staleAdded 0）で終わることを確かめる。package.json の `version` を本体の版にそろえる。
6. **作り直す**: パックは組み込みの拡張なので、束を作り直したら本体のビルドを apply からやり直す。2回のビルドを避けるには、前の週の版で先に `todo` を走らせ、前もって訳しておく方法もある。どちらにするかはリーダーが決める。
7. **判定に渡す**: 判定（`TAKE-IN.md` の規約）に `count` の結果（`result`・`untranslated`）を渡す。`untranslated > 0` なら「日本語化が終わっていない」として保留にする。

# 引き渡しの覚え: 段階 A・B の checks の見直しと有効化、notion-sync の翻訳の誤り（蒙恬）

- 依頼: `brief.md`（このフォルダ）。2026-11-14
- 結果: 完了（1〜4）。B-1 の単位と `scripts/build.mjs` には触れていない。ビルドは走らせていない

## 1. 合格した単位を有効にした

`removals/A-3-debug-extensions`・`A-6-themes`・`B-5-theme-switching`・`B-6-online-feeds` の `unit.json` を `enabled: true` にした（関門の記録 `records/take-in/1.146.0-p2-<id>/gate-<id>.md` で4つとも合格）。

注: 有効な単位の組で作るビルド（`--units` を渡さない場合）には、この4つが入るようになる。B-1 を直している蒙恬が単位を名指ししていなければ、次のビルドから効く。

## 2. 変えた checks の一覧

確かめた材料: 公式の zip の実行の snapshot（`C:\b\smoke\absent\` の `*official*`・`fix-*`・`p2try-*`。どれも `C:/b/p0/vscode-1.146.0`。2026-11-14 までの8回）、各版の実行の snapshot、公式の拡張の `package.json`（`C:\b\p0\vscode-1.146.0\69047191fc\resources\app\extensions\`）、曹参の直した網で公式に全部の単位を `--expect present` で流した結果（`C:\b\smoke\absent\fix-units-official-20261114T142041\absent-result.json`）。

| 単位 | 外したもの | 足したもの | 理由 |
|---|---|---|---|
| A-2-accounts-extensions | なし | absentCommands `workbench.action.output.show.vscode.github.GitHub.log`、`workbench.action.output.show.vscode.github-authentication.GitHub Authentication.log` | 実行時の網を足すため。2つの拡張が起動して作る出力チャネルの表示のコマンドで、本体がチャネルごとに登録する。公式の8回と A-1 の版の2回のすべてで在り、A-2〜B-7 の版のすべてで無い。チャネルの名前は訳されない（公式の `github/dist/extension.js` の `createOutputChannel("GitHub",{log:!0})`、`github-authentication/dist/extension.js` の `` `${n} Authentication` ``）。元の2件（`github.publish`・`github.copyVscodeDevLink`）は manifest の網で見えるので残した |
| A-5-remote-extensions | なし | absentViews `~remote.forwardedPorts` | 実行時の網を足すため。この単位でポートのビューが消える（3節）。公式の実行と A-1〜A-4 の版で `~remote.forwardedPorts.focus` が在り、A-5〜A-7 の版で無い。元の2件（`tunnel-forwarding.*`）は manifest の網で見えるので残した |
| B-3-issue-share | absentCommands `workbench.action.share` | absentCommands `toggle.workbench.experimental.share.enabled` | `workbench.action.share` は設定 `workbench.experimental.share.enabled`（既定 false）が true のときだけ登録される（本家の `contrib/share/browser/share.contribution.ts` の `ShareWorkbenchContribution.registerActions`）ので、公式でも無い（曹参の公式の実行でも net: none）。替えたものは `contrib/share/browser/shareService.ts` の `ToggleShareControl`（タイトルバーの右クリックの「共有」）で、読み込むと必ず登録される。公式の8回と A-1〜B-2 の版のすべてで在り、B-3〜B-7 の版で無い |

変えなかった単位と理由:

| 単位 | checks の扱い |
|---|---|
| A-1-copilot-extension | コマンド2件・設定1件とも manifest の網で公式に在る（曹参の公式の実行で pass、net: manifest）。copilot の拡張は公式の実行で `vscode.extensions.all` に出ず、実行時の網で在るものは見つからなかった（`github.copilot.*` のコマンドも出力チャネルも無い。`prompt-basics` はコマンドを持たない）。替えられるものが無いので、manifest の網だけで見る（README に書いた） |
| A-4-notebook-extensions | コマンド2件は manifest の網で在る。`ipynb` は起動しない。`ipynb` が manifest に持つ `notebook.cellOutput.*` は本体も登録するので網にならない。実行時の網は設定1件が担う（README に書いた） |
| A-7-unused-extensions | コマンド3件は manifest の網で在る。8件の拡張は公式でも起動しない。実行時の網は設定6件が担う（README に書いた） |
| B-2-onboarding-experiments-surveys・B-4-outline-view・B-7-terminal-suggest | コマンド・ビューは公式で実行時の網に在る（関門でも、曹参の公式の実行でも pass）。判定できなかったのは設定の probe の不備だけで、曹参が直した。checks は変えない |

曹参の handoff-notes（`tasks/2026-11-14-fix-absent-probe/handoff-notes.md`）は checks のキーを変えていないので、形は今のまま。

## 3. README を直した

- `removals/A-5-remote-extensions/README.md`: ポートのビューも消えることと、その仕組み（本体は `onTunnel` で起動する拡張があるときだけローカルのウィンドウでポートのビューを有効にする。`services/remote/common/tunnelModel.ts` の `extensionHasActivationEvent`。1.146.0 の組み込み拡張で `onTunnel` を持つのは `tunnel-forwarding` だけ）、受け入れる扱い（リモートは C-3 で消す）。`unit.json` の `intent` も合わせて直した
- `removals/B-4-outline-view/README.md`: 残したパンくずリストが消えた設定 `outline.icons` などを読むこと、受け入れる扱い（パンくずリストは mydist の既定で無効で、C-7 で消す）、C-7 までに利用者が有効にしたときの見え方（アイコンが出ない見込み。推定）
- checks の網の説明を足した: A-1・A-2・A-4・A-5・A-7・B-3 の README の「消えたことの検査（checks）」の節
- B-3 の README の「消すもの」に `toggle.workbench.experimental.share.enabled` と、`workbench.action.share` が設定の値で登録されることを書き足した

## 4. notion-sync の翻訳の誤り

### 原因（本家 1.146.0 のソースと出力で確かめた）

- 拡張ホストは、拡張のコードを読み込む前に `initializeLocalizedMessages` を呼ぶ（`src/vs/workbench/api/node/extHostExtensionService.ts` の `_doLoadModule`）。表示の言語が英語でなく、拡張が組み込みなら、翻訳の場所を言語パックに聞く（`src/vs/workbench/api/common/extHostLocalizationService.ts` の `getBundleLocation`。組み込みでは manifest の `l10n` も `package.nls.*.json` も見ない）。言語パックの `translations` にその拡張の ID が無いと `No bundle location found` を書く。出力の `out\vs\workbench\api\node\extensionHostProcess.js` にも同じ処理があることを確かめた
- そのため `package.nls.json` や `l10n` を足しても直らない

### 直し方

- `extensions-src/notion-sync/package.json` の `contributes.localizations` に、`ja` の言語で自分の ID `shuko.notion-sync` を指す翻訳の項目を書いた。`languageName`・`localizedLanguageName` は台帳の言語パック（`MS-CEINTL.vscode-language-pack-ja` 1.131.0）と同じ `Japanese`・`日本語`
- `extensions-src/notion-sync/build.mjs` が、`dist/i18n/shuko.notion-sync.ja.i18n.json` に空の束 `{"version":"1.0.0","contents":{"package":{},"bundle":{}}}` を作る。形は言語パックの `translations/extensions/*.i18n.json` と同じ。拡張は `vscode.l10n` も `%キー%` も使わないので空でよい
- 新しい部品 `extensions-src/notion-sync/builtin-l10n.mjs`（束を作る・確かめる。dist には入らない）。`build.mjs` は、項目の形（本体の `isValidLocalization` と同じ条件）、自分の ID の項目、`path` が `dist/` の下（`apply.mjs` が写すのは `dist/` と `media/` だけ）、束の `contents.bundle` を確かめ、外れていれば止める
- 効く仕組み: 共有のプロセスが起動のたびに `NativeLanguagePackService.update()` を呼び（`src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts`）、入っている全部の拡張（`getInstalled()` は型を渡さないと組み込みも含む）の `contributes.localizations` から `languagepacks.json` を作り直す。同じ言語の項目は1つの言語パックにまとまる（`src/vs/platform/languagePacks/node/languagePacks.ts` の `createLanguagePacksFromExtension`）ので、`ja` の `translations` に `shuko.notion-sync` が足される。いまの `languagepacks.json` の形（`C:\b\smoke\runs\p2-B-7-20261114T141151\user\user-data\languagepacks.json`）も確かめた
- mydist: `main` が無いので `_doLoadModule` が呼ばれず、この誤りは出ない（関門の A-1 でも notion-sync の分の2件だけ）。手を入れず、理由とコードを足すときの手順を `extensions-src/mydist/README.md` に書いた

### 副作用（README に書いた）

- `languagepacks.json` の `ja` の `extensions` に notion-sync が加わり、hash（翻訳のキャッシュ `clp\<hash>.ja\` の名前）が変わる。初回の起動で作り直される
- 台帳の言語パックが無いときは、本体の翻訳（ID `vscode`）が無いので英語のまま（`src/vs/base/node/nls.ts`）。言語の選択の一覧に「日本語」が出る
- `ja` 以外の表示の言語では、また出る（裁定で日本語。足していない）

### 確かめたこと

- `pnpm --dir extensions-src/notion-sync run build --trial`: 型検査・esbuild・束の作成（`dist/i18n/shuko.notion-sync.ja.i18n.json`）・読み込みの確かめ（「翻訳の束がある」）・試し（すべて期待どおり）まで通った。`dist/extension.js` は前と同じ中身（git の差分なし）
- `node --check extensions-src/notion-sync/builtin-l10n.mjs`: 通った
- 実機で誤りが消えることは確かめていない（ビルドを走らせない約束のため）。次のビルドで `apply.mjs` が `dist/i18n/` を写し、スモークの errors.new から `No bundle location found for extension shuko.notion-sync` の2件（window1・window2）が消えるはず。初回の起動で、拡張ホストが共有のプロセスの作り直しより先に聞いた場合は1回出る恐れがある（推定。共有のプロセスの一覧は作り直しの順番待ちを待って答えるので、出ない見込み）

## テストの入口（曹参へ）

- `extensions-src/notion-sync/builtin-l10n.mjs`（Node.js で直接 import できる）:
  - `extensionId(manifest)` → `"shuko.notion-sync"`
  - `ownTranslations(manifest)` → `[{ languageId: "ja", id: "shuko.notion-sync", path: "./dist/i18n/shuko.notion-sync.ja.i18n.json" }]`
  - `checkBuiltinLocalizations(manifest)` → `[]`。`localizations` が無い・自分の ID の項目が無い・`path` が `dist/` の外（`../x.json` や `media/x.json`）・`translations` が空のとき、それぞれ誤りの文が1つ以上
  - `checkBuiltinLocalizations(manifest, root)` → ファイルが無い、JSON でない、`contents.bundle` が無いときに誤り
  - `writeBuiltinTranslations(manifest, root)` → 書いた相対パスの配列。中身は `emptyBundleText()`（`JSON.parse` すると `contents.bundle` と `contents.package` が空のオブジェクト）
- `pnpm --dir extensions-src/notion-sync run build`: 標準出力に `[notion-sync] dist/i18n の翻訳の束を作る` と `  翻訳の束がある（contributes.localizations の自分の ID の項目）`、終了コード 0
- 関門の3の流し直し（大岡越前守）:
  - 公式: `node tests/absent-run.mjs --build C:/b/p0/vscode-1.146.0 --units A-2-accounts-extensions,A-5-remote-extensions,B-3-issue-share --expect present` で全項目 pass（A-2 の出力チャネルの2件と B-3 の toggle は runtime、A-5 の `~remote.forwardedPorts` は runtime）
  - 各版: `--build <版> --units <単位> --expect absent` で全項目 pass の見込み（既にある snapshot では、足した項目は A-2・A-5・B-3 以降の版に無い）
- スモーク（関門の4）: 次のビルドの版で、errors.new に notion-sync の `No bundle location found` が無いこと

## docs/ との食い違い

- なし。docs/05 と docs/04 は manifest の `contributes` の中身を決めていない

## 未解決・リーダーに諮る点

- C-3-remote の `checks.absentViews` の `~remote.forwardedPorts` は、A-5 を当てた版ではもう無い（A-5 で消える）。公式の zip では在るので `--expect present` は通るが、C-3 の効き目の証拠にはならない。C-3 の checks を見直すときに替える（この依頼の範囲の外なので変えていない）
- C-1-ai の `search.action.showAIResults` と `absentProcesses` の `agent-host` は、曹参の公式の実行で網にならなかった（曹参の handoff-notes の表）。段階 C なので、この依頼では変えていない
- B-2 の `absentHosts` の `default.exp-tas.com` は、OSS の product.json に `tasConfig` が無いので、公式でも接続が無く網にならない（関門の B-2 の記録）。B-6 の `main.vscode-cdn.net` も同じ形で合格になっている。扱いはリーダーの判断
- A-6 は checks が空のまま（関門は拡張の一覧で合格）

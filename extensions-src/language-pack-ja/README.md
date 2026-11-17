# language-pack-ja（本体と同じ版の日本語の言語パック）

Shuko の組み込み拡張（ID `shuko.language-pack-ja`）。本体と同じ版の文言に合わせた日本語の言語パック。docs/04 の7節。調べと作り方は `tasks/2026-11-17-l10n-ja/l10n-design.md`。

## 中身

| ファイル | 中身 | 作り方 |
|---|---|---|
| `sources.json` | 公式の訳の元（vscode-loc の commit、Open VSX の VSIX）。先に書いたものが勝つ。ファイルごとの SHA-256 | 手で書き、`fetch --update-lock` で SHA-256 を入れる |
| `added/<本体の版>.json` | 課が足した訳。モジュール（本体）か拡張の ID と鍵で引く。`en` は訳したときの英語。`override: true` は、公式の訳が英語のままの文言を日本語にしたもの | `add` |
| `exclusions.json` | 英語のままでよい文言（理由つき） | `add` |
| `dist/translations/` | 言語パックの訳の束（`main.i18n.json` と `extensions/<ID>.i18n.json`）。sources.json と added/ だけで決まる | `build` |
| `package.json` | `contributes.localizations`（ja）。translations の一覧は `build` が書く | `build` が translations を書く |
| `ThirdPartyNotices.txt` | vscode-loc の MIT の表示 | `build` が写す |

ビルドで写すのは `package.json`・`README.md`・`ThirdPartyNotices.txt`・`dist/`（`scripts/apply.mjs`）。`dist/translations/` の束が無いと apply が止める。

## 手順（リポジトリの直下で）

```
node scripts/l10n-ja.mjs fetch                                   # 公式の訳を <buildRoot>\cache\l10n\ に取り、SHA-256 を照合
node scripts/l10n-ja.mjs extract --app <出力の resources\app> --worktree <作業ツリー> --out tmp\l10n\strings-<版>.json
node scripts/l10n-ja.mjs todo --strings tmp\l10n\strings-<版>.json --out tmp\l10n\todo-<版>.json   # 訳す文言の一覧
node scripts/l10n-ja.mjs add --strings tmp\l10n\strings-<版>.json --input <訳の入力> --version <版>
node scripts/l10n-ja.mjs build --strings tmp\l10n\strings-<版>.json   # dist を書き、未訳を数える（除外の外が 0 なら終了コード 0）
node scripts/l10n-ja.mjs count --strings tmp\l10n\strings-<版>.json   # 作った dist を数え直す
```

訳の入力は `{ "translate": { "<モジュールか ID>#<鍵>": "<訳>" }, "override": { ... }, "exclude": { "<モジュールか ID>#<鍵>": { "reason": "format", "note": "..." } } }`。英語は `add` が文言の表から写す（手で写さない）。

## 効く仕組み

- 共有のプロセスが起動のたびに、入っている全部の拡張（組み込みを含む）の `contributes.localizations` から `languagepacks.json` を作り直す（本家 1.146.0 の `src/vs/platform/languagePacks/node/languagePacks.ts`、`src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts`）。同じ言語の項目は1つにまとまり、同じ翻訳の ID（`vscode`・`vscode.git` など）は後に読んだ拡張が勝つ。組み込みが先、ユーザーの拡張が後（`extensionsScannerService.ts` の `dedupExtensions`）。
- そのため、Open VSX の `MS-CEINTL.vscode-language-pack-ja` が入ったままだと、このパックより優先される。台帳と `extensions.allowed` から外したので、入っていれば外す（`<CLI> --uninstall-extension MS-CEINTL.vscode-language-pack-ja`）。
- 本体は `languagepacks.json` の `vscode` の束を `out/nls.keys.json` の順に引き、無い・空の鍵は英語に戻す（`src/vs/base/node/nls.ts`）。

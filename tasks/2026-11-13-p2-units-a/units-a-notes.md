# 段階 A の削除の単位と builtin/keep.json

- 担当: 蒙恬（2026-11-14）
- 本家: タグ 1.146.0。事実はすべて `C:\b\wt\dev-a`（タグ 1.146.0 の作業ツリー）のソースで確かめた。
- 単位ごとの細かい中身・症状と戻し方は各単位の `README.md` にある。ここは全体の振り分けと、決め方の根拠と、未確認の点をまとめる。

## 1. 組み込み拡張の振り分け（95件）

本家 1.146.0 の `extensions/` の下で `package.json` を持つフォルダは95件。ほかに `package.json` の無いフォルダ `types`（拡張どうしで共有する型）が1つある。

| 行き先 | 件数 | 名前 |
|---|---|---|
| keep（feature） | 16 | git、git-base、merge-conflict、search-result、references-view、markdown-language-features、markdown-math、typescript-language-features、html-language-features、css-language-features、json-language-features、emmet、configuration-editing、npm、theme-defaults、theme-seti |
| keep（grammar） | 47 | 対象言語の文法 11（bat、powershell、shellscript、dotenv、python、javascript、typescript-basics、html、css、json、markdown-basics）と、対象外の言語の色付け 36 |
| keep（test。同梱されない） | 4 | vscode-api-tests、vscode-colorize-tests、vscode-colorize-perf-tests、vscode-test-resolver |
| A-1 | 2 | copilot、prompt-basics |
| A-2 | 3 | github、github-authentication、microsoft-authentication |
| A-3 | 2 | debug-auto-launch、debug-server-ready |
| A-4 | 2 | ipynb、notebook-renderers |
| A-5 | 1 | tunnel-forwarding |
| A-6 | 10 | theme-abyss、theme-kimbie-dark、theme-modern-icons、theme-monokai、theme-monokai-dimmed、theme-quietlight、theme-red、theme-solarized-dark、theme-solarized-light、theme-tomorrow-night-blue |
| A-7 | 8 | grunt、gulp、jake、simple-browser、mermaid-markdown-features、extension-editing、terminal-suggest、php-language-features |

- 合計 67 + 28 = 95。apply.mjs の検査（`unclassifiedExtensions`）でも未分類は0件だった（`trial-log.md` の2.1）。
- grammar の47件は、どれも `package.json` に `main` も `browser` も無い（コードを持たない）ことを grep で確かめた。
- docs/03 の4節の「残す」一覧のものは全部 keep に入れた。
- `keep.json` の形は `{ "keep": [{ "name", "kind", "reason" }], "notExtensions": [...], "own": [...] }`。apply.mjs が読むのは `keep` の `name` だけ（`tasks/2026-11-13-p2-apply/apply-design.md` の2.3）。`notExtensions`（`types`）と `own`（`mydist`・`notion-sync`）は人が読むための記録。

### 分類に迷ったもの

| 名前 | 決めたこと | 根拠 |
|---|---|---|
| prompt-basics | A-1 に入れた | 言語 `prompt`・`instructions`・`chatagent`・`skill` と文法だけを持つ。使うのは本体のチャット。`.claude/agents/*.md`・`.claude/rules/**/*.md`・`SKILL.md` を Markdown でない言語にしてしまうので、消すと Claude Code のファイルが Markdown として開く。Claude Code の manifest は言語を宣言していない |
| jsts-chat-features | 単位に入れない（入れるものが無い） | タグ 1.146.0 のソースに無い（`extensions/` にも product.json にも名前が無く、全ソースの grep で0件）。本家の配布物（zip）にだけあり、Microsoft の配布の設定が足すものと見られる。自分のビルドには入らない |
| media-preview | keep に載せない | 1.146.0 の `extensions/` に無い。画像などのプレビューは本体の `src/vs/workbench/contrib/mediaPreview`（`workbench.common.main.ts` の327行目で import）に移っている。裁定で残す画像のプレビューは本体の部品なので、段階 A では何もしない |
| theme-modern-icons | A-6 | docs/03 の表のとおり |
| test 用の4件 | keep | 同梱されない（`build/lib/extensions.ts` の `excludedExtensions`）。消すと本家のテストの台本や一覧の直しが増えるだけ |
| php（文法） | keep | 色付けは残す裁定。言語機能 `php-language-features` だけ A-7 |

## 2. 単位の共通の作り

- `order` は 110〜170（10おき。間に足せるように）。`enabled: false`、`after` は無し（7単位は互いに独立）。
- 組み込み拡張を消すときに名前を外す一覧は、1.146.0 では次の4つだった。どれも1行1要素なので `removeLines` で消す。
  - `build/npm/dirs.ts` の `separateRootMembers['extensions']`（copilot だけは `separateRoots` と `separateRootMembers['extensions/copilot']`）
  - `extensions/pnpm-workspace.yaml` の `packages`
  - `build/gulpfile.extensions.ts` の `compilations`
  - `build/lib/extensions.ts` の `nativeExtensions`（microsoft-authentication）と **`esbuildMediaScripts`**（ipynb、notebook-renderers、mermaid-markdown-features、simple-browser。docs/03 に書かれていない一覧。残すと `compile-extension-media-build` が消えた台本を探して止まる）
- `removeLines` の行は、タグ 1.146.0 の各ファイルで「前後の空白を除いてちょうど1行」であることを grep で確かめ、apply.mjs でも7単位の61行がすべて `found: 1` だった。
- 文法だけの拡張とテーマは、どの一覧にも載っていない（`build/lib/extensions.ts` が `extensions/*/package.json` を走査して同梱する）。フォルダを消すだけでよい。
- `removeDependencies` は7単位とも空。消した拡張の依存は、それぞれのフォルダの `package.json` にあり、フォルダごと消える。共有の `extensions/package.json` の依存（typescript など）は残る拡張も使う。
- `productRemove` は7単位とも空。関係する product.json のキー（AI・歓迎画面）は docs/02 の3節で C-1・B-2 の時期に決まっている。
- `checks.absentStrings` は、`in` を一覧のファイルに絞った（既定の `src`・`build` 全体にすると、コメントやテストの文字列に当たる）。7単位の24件のうち、A-3 の1件を除いて当たりは0件（`trial-log.md` の2.2）。
- `smoke` は docs/06 の5節の組の名前（`base`・`claude-code`・`languages`・`absence`）。docs/03 の3.1 の例の `powershell` という組は docs/06 に無いので使っていない。

## 3. 単位ごとの要点

| 単位 | delete | removeLines | edits.patch | 要点 |
|---|---|---|---|---|
| A-1 | 2 | 8 | 3ファイル | 下の3.1 |
| A-2 | 3 | 10 | 無し | `extensions/pnpm-workspace.yaml` の msal の `allowBuilds` 2行と `overrides` 1行は残した（版を含むので、removeLines にすると本家が msal を上げるたびに止まる）。依存の導入で止まらないかは未確認 |
| A-3 | 2 | 6 | 無し | `builtInExtensions: []` は overlay の `set`（下の3.2） |
| A-4 | 2 | 8 | 無し | `esbuildMediaScripts` の2行を含む |
| A-5 | 1 | 3 | 無し | — |
| A-6 | 10 | 0 | 1ファイル | `src/vs/workbench/test/browser/componentFixtures/fixtureUtils.ts` が消したテーマの JSON を import している。`src/tsconfig.json` が `./vs/**/*.ts` を含むので、外さないと型検査が落ちる |
| A-7 | 8 | 26 | 無し | ターミナルの入力候補の本体の部品は残る（下の3.3） |

### 3.1 A-1 の edits.patch の決め方

- `build/gulpfile.vscode.ts` と `build/gulpfile.reh.ts` は、パッケージ化の後に `prepareCopilotRipgrepShimTask` を呼び、その中の `build/lib/copilot.ts` の `prepareBuiltInCopilotRipgrepShim` は、拡張のフォルダの中の `node_modules/@github/copilot/sdk` が無いと例外を投げる（277〜279行目）。
- 呼ぶ行（2つの gulpfile の1行ずつ）を消すと、呼ばれなくなった関数 `prepareCopilotRipgrepShimTask` などが `build/tsconfig.json` の `noUnusedLocals: true` に当たり、関数ごと消すパッチが2つの gulpfile に要る。この2つのファイルは C-1（`@github/copilot-sdk`）と C-3（サーバーのビルド）も直すので、パッチが重なる。
- そこで、`prepareBuiltInCopilotRipgrepShim` の頭に「拡張のフォルダが無ければ戻る」の3行を足す形にした。触るのは `build/lib/copilot.ts` の1か所だけで、gulpfile は変えない。別案（呼ぶ行を消して関数も消す）は、docs/03 の「Copilot 拡張のビルドタスクを消す」により忠実だが、パッチが大きく他の単位と重なる。
- `compileCopilotExtensionBuildTask`（`packageCopilotExtensionStream`）はフォルダが無ければ空の流れを返すので、直さない。
- ルートの `package.json` の `compile`（`npm-run-all2 -lp compile-client compile-copilot`）は、docs/02 の4節の5で型検査の候補に挙がっている。`compile-copilot` を外さないと `pnpm -C extensions/copilot` で止まるので、`compile`・`watch`・`watch-transpile` を直した。1行で消せる scripts の6行は `removeLines` にした。
- `build/npm/postinstall.ts` の `.claude/` の symlink は docs/03 の表のとおり消した。使われなくなる `ensureAgentHarnessLink` も消した（`noUnusedLocals`）。
- VSCodium の patch 53（1.143.1 向け）は、ほかにルートの依存（`@github/copilot-sdk`・`@vscode/copilot-api`・`@anthropic-ai/claude-agent-sdk`・`@openai/codex` など）、エージェントのホストの登録、`copilot.sh` の Windows の起動の台本も消している（[一次] https://raw.githubusercontent.com/VSCodium/vscodium/master/patches/53-ext-copilot-remove-it.patch の前半を読んだ）。これらは本体の AI なので C-1 に回した。

### 3.2 A-3 の builtInExtensions

- docs/02 の3節の表は `builtInExtensions` を「set（A-3）`[]`」としている。`unit.json` には値を入れる項目が無く、`productRemove` でキーを消すと `build/gulpfile.vscode.ts` の160行目（`product.builtInExtensions.filter(...)`）と `build/gulpfile.reh.ts` の291行目が `undefined` を読んで止まる。
- そのため A-3 では overlay に任せ、`checks.absentStrings` の `{ in: ["product.json"], text: "ms-vscode.js-debug" }` で overlay に入っていることを確かめる。
- **2026-11-14 の `product.overlay.json`（p2-units-b）には `builtInExtensions` が無く**、apply.mjs の試しでこの検査が落ちた。overlay は私の書き込み先でないので、リーダーに報告した。

### 3.3 A-7 の terminal-suggest

- 拡張が持つのはコマンドの補完の定義（`extensions/terminal-suggest/src/completions/` など）。入力候補の部品と設定 `terminal.integrated.suggest.enabled` は本体の `src/vs/workbench/contrib/terminalContrib/suggest` にあり、拡張を消しても残る。
- 裁定は「ターミナルの入力候補（terminal-suggest）は消す」。部品ごと消すのは段階 A の範囲を超える（本体の contrib）。それまで候補を止めるなら、`mydist` の既定に `terminal.integrated.suggest.enabled: false` を入れる案がある（報告に書いた。採るかはリーダー）。

## 4. Claude Code が使う受け手（docs/03 の9節）

段階 A で消すものは、Webview、セカンダリサイドバー、JSON の検査（`json-language-features` は keep）、ワークスペースの信頼、コメントの API、差分エディタ、拡張のファイルシステムの提供者、メニューの場所のどれにも当たらない。どれも本体の部品で、段階 A は組み込み拡張のフォルダと一覧の行しか消さない。

## 5. 未確認（型検査・依存の導入・ビルド・スモークで確かめる）

| 点 | 確かめ方 |
|---|---|
| A-1 の edits.patch の後に `build/` の型検査が通るか | `pnpm -C build run typecheck`（`noUnusedLocals`） |
| A-6 の edits.patch の後に `src` の型検査が通るか | `typecheck-client` か `compile` |
| A-2 の msal の `overrides`（消えたフォルダを指す `file:`）で `pnpm install` が止まらないか | 依存の導入 |
| ロックファイルの差分が「消した拡張の依存の削除」だけか | apply.mjs の `--lockfile-check`（docs/03 の5.4）。`extensions/copilot/pnpm-lock.yaml` はフォルダごと消える |
| パッケージ化（`gulp vscode-win32-x64-min`）が A-1 の後に通るか | ビルド |
| ビルドの出力の `resources/app/extensions` に消した28件と js-debug 系が無く、keep の拡張（test を除く）がそろうか | docs/02 の4節の7の後処理 |
| 本体のチャットが prompt-basics の言語の ID を探して誤りを出さないか、GitHub のアカウントの拡張が無い誤りを出さないか | スモークの base（開発者ツールのコンソールと拡張ホストのログ） |
| git の push が GitHub のリモートへ通るか（A-2） | スモークの base の git |
| `.ipynb` を開いたときの動き（A-4）、ターミナルの入力候補の残り方（A-7） | スモークの base |
| 開発用の `pnpm run build-fast` と `pnpm run eslint` は A-1 の後に動かない | 本ビルドと関門では使わないので直していない（A-1 の `kept`）。使うようになったら直す |

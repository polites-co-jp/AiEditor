# docs と食い違った事実と、直し方の案

- 作成: 蒙恬（2026-11-14）。docs/ はリーダーが直す。
- 事実はタグ 1.146.0 のソース（`C:\b\wt\dev-a`）で確かめた。

## 1. 組み込み拡張の一覧に `esbuildMediaScripts` がある（docs/03 の4節の段階 A の前文）

- docs: 名前を消す一覧は `build/npm/dirs.ts`、`extensions/pnpm-workspace.yaml`、`build/gulpfile.extensions.ts` の `compilations`、`build/lib/extensions.ts` の名前の一覧（`nativeExtensions` など）。
- 事実: `build/lib/extensions.ts` の `esbuildMediaScripts`（Webview やノートブック向けの台本の一覧。706〜717行目）にも `ipynb`・`notebook-renderers`・`mermaid-markdown-features`・`simple-browser` の行がある。残すと `compile-extension-media-build`（パッケージ化の途中）が消えた台本を探して止まる。
- `eslint.config.js` は `./extensions/copilot/.eslintplugin/index.ts` を import している（15行目）。A-1 の後は `pnpm run eslint` が動かない。関門に eslint は入っていないので直していない。`build/lib/copilot.ts` は、拡張の梱包の後処理（`prepareBuiltInCopilotRipgrepShim`）を持つ。
- 案: 前文の一覧に「`build/lib/extensions.ts` の `esbuildMediaScripts`（Webview の台本を持つ拡張）」を足し、「要照合」の行を「`eslint.config.js` は copilot の eslint の部品を import する（A-1 の後は eslint が動かない。関門の外なので直さない）」に直す。

## 2. A-1 の中身（docs/03 の4節の表）

- docs: `build/gulpfile.vscode.ts`、`build/gulpfile.reh.ts`、`build/lib/copilot.ts` の Copilot 拡張のビルドタスクを消す。`jsts-chat-features`・`prompt-basics` は「A-1 に足す見込み」。
- 事実:
  - ルートの `package.json` の scripts の `compile`（docs/02 の4節の5の型検査の候補）が `compile-copilot`（`pnpm -C extensions/copilot run compile`）を呼ぶ。`watch`・`watch-transpile` も同じ。
  - gulpfile の後処理は `build/lib/copilot.ts` の1か所に3行を足して止めた（理由は `units-a-notes.md` の3.1）。
  - `TypeScriptTeam.jsts-chat-features` はタグ 1.146.0 のソースに無い（全ソースの grep で0件）。本家の配布物だけにあり、自分のビルドには入らない。
  - `prompt-basics` は A-1 に入れた（言語 `prompt`・`instructions`・`chatagent`・`skill` だけを持ち、`.claude/agents/*.md`・`.claude/rules/**/*.md`・`SKILL.md` を Markdown でない言語にする）。
- 案: 表の A-1 の「消すもの」に「`extensions/prompt-basics`、ルートの `package.json` の copilot の scripts」を足し、注の「見込み」を事実に置き換える（jsts-chat-features はソースに無い、prompt-basics は足した）。

## 3. A-3 の builtInExtensions は overlay で入れる（docs/03 の4節の表、docs/02 の3節）

- docs/03: A-3 の「消すもの」に「product.json の `builtInExtensions` を `[]` にする」。docs/02 の3節の表: 「set（A-3）」。
- 事実: `unit.json` にはキーに値を入れる項目が無い。`productRemove` でキーを消すと、`build/gulpfile.vscode.ts` の160行目（`product.builtInExtensions.filter(...)`）と `build/gulpfile.reh.ts` の291行目が止まる。そのため `[]` は `product.overlay.json` の `set` に置くしかない。
- **2026-11-14 の `product.overlay.json` には `builtInExtensions` が無い**。apply.mjs の試しで、A-3 の検査（`product.json` に `ms-vscode.js-debug` が無いこと）が2件の当たりで落ちた。
- 案: docs/03 の A-3 の行に「`builtInExtensions: []` は `product.overlay.json` の `set` に置く（キーを消すとビルドが止まるため）」と足す。overlay に足すのは p2-units-b（またはリーダー）。

## 4. 画像のプレビューは本体にある（docs/03 の4節の「残す組み込み拡張」の段落）

- docs: `media-preview` は本家 1.146.0 の zip に無い。画像のプレビューが 1.146 でどこにあるかを Phase 2 のスモークで確かめる。
- 事実: 本体の `src/vs/workbench/contrib/mediaPreview`（`mediaPreview.contribution.ts` がエディタの枠 `imagePreviewEditor` などを登録する）にある。`src/vs/workbench/workbench.common.main.ts` の327行目で import される。古い `media-preview` のカスタムエディタの viewType を本体の枠へ振り替える処理もある。
- 案: 「画像のプレビュー（裁定で残す）は 1.146.0 では本体の `contrib/mediaPreview` にある（組み込み拡張ではない）。段階 B・C で消さない」に直す。スモークの base の「画像のプレビュー」はそのまま。

## 5. `extensions/types` は拡張ではない（docs/03 の4節・6節）

- 事実: `extensions/` の下に `package.json` の無いフォルダ `types` がある（拡張どうしで共有する型）。apply.mjs は `package.json` のあるフォルダだけを数え、`types` は `nonExtensionDirs` に出す。
- 案: 6節の「未分類の組み込み拡張」に「`package.json` のあるフォルダだけを数える」と足す。`builtin/keep.json` には `notExtensions` として記録した。

## 6. smoke の組の名前（docs/03 の3.1）

- docs/03 の3.1 の例は `"smoke": ["base", "claude-code", "powershell"]`。docs/06 の5節の組は `base`・`claude-code`・`languages`・`absence` で、`powershell` は無い（PowerShell のセッションは `languages` の中）。
- 案: 例を `["base", "claude-code", "languages", "absence"]` に直す。

## 7. 本家の postinstall が常設の clone の git の設定を書き換える（docs/02 の2節。参考）

- 事実: `build/npm/postinstall.ts` の `main` の終わりで `git config pull.rebase merges` と `git config blame.ignoreRevsFile .git-blame-ignore-revs` を走らせる（277〜278行目）。作業ツリー（`C:\b\wt\<tag>`）で依存を導入すると、worktree は設定を共有するので、常設の clone `C:\b\vscode\.git\config` に書かれる見込み（推定。worktree ごとの設定 `extensions.worktreeConfig` は使っていない）。
- 影響: 取り込み（fetch）には関係しない見込み。docs/02 の「常設の clone（fetch だけする）」の説明と食い違うだけ。
- 案: docs/02 の2節に「依存の導入で、本家の postinstall が常設の clone の git の設定（`pull.rebase`・`blame.ignoreRevsFile`）を書き換える。害は無い見込み」と足すか、気にしないなら直さない（リーダーの判断）。

# A-1-copilot-extension

組み込みの GitHub Copilot 拡張と、AI 向けのファイルの言語を消す（docs/03 の4節の段階 A）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/copilot`（`GitHub.copilot-chat` 0.74.0。独自の pnpm のルートを持つ）、`extensions/prompt-basics` |
| 一覧の行（removeLines） | `build/npm/dirs.ts` の `separateRoots` の `'extensions/copilot',` と `separateRootMembers` の `'extensions/copilot': [...]`。ルートの `package.json` の scripts の `compile-copilot`・`watch-copilot`・`watch-copilotd`・`kill-watch-copilotd`・`copilot:setup`・`copilot:get_token` |
| edits.patch | ルートの `package.json` の `compile`・`watch`・`watch-transpile` から `compile-copilot`・`watch-copilot` を外す。`build/lib/copilot.ts` の `prepareBuiltInCopilotRipgrepShim` を、拡張のフォルダが無ければ何もしないようにする（3行）。`build/npm/postinstall.ts` の `.claude/` の symlink（`.claude/CLAUDE.md` → `.github/copilot-instructions.md`、`.claude/skills` → `.agents/skills`）と、その関数 `ensureAgentHarnessLink` を消す |

`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の `compilations`・`build/lib/extensions.ts` の一覧には、`copilot` も `prompt-basics` も載っていない（1.146.0 で確かめた）。`build/lib/extensions.ts` の `excludedExtensions` の `'copilot'` と `packageCopilotExtensionStream` は、フォルダが無ければ空を返すので残す。

### prompt-basics を足した理由

- `extensions/prompt-basics/package.json` は、言語 `prompt`（`*.prompt.md`）・`instructions`（`*.instructions.md`・`copilot-instructions.md`・`**/.claude/rules/**/*.md`）・`chatagent`（`*.agent.md`・`*.chatmode.md`・`**/.github/agents/*.md`・`**/.claude/agents/*.md`）・`skill`（`SKILL.md`）と、その文法・既定の設定だけを持つ（コードは無い）。言語の ID を使うのは本体のチャット（`src/vs/workbench/contrib/chat/common/promptSyntax/`）で、AI の部品である。
- この拡張があると、Claude Code のファイル（`.claude/agents/*.md`・`.claude/rules/**/*.md`・`SKILL.md`）が Markdown でない言語になり、Markdown のプレビューや言語機能が効かない。消すと Markdown として開く。
- Claude Code 拡張の manifest（2.1.322）は言語を宣言していない（`records/phase0/claude-code-manifest.md`）。消しても Claude Code の受け手（docs/03 の9節）には当たらない。

### jsts-chat-features を足さなかった理由

`TypeScriptTeam.jsts-chat-features` は、本家の配布物（zip）にはあるが、タグ 1.146.0 のソースには無い（`extensions/` にも product.json の `builtInExtensions` にも名前が無い。全ソースを grep して0件）。Microsoft の配布の設定が足すものと見られ、自分のビルドには入らないので、消すものが無い。

## 残すもの

- 本体の AI（`contrib/chat`・`contrib/inlineChat`・`contrib/mcp`、`platform/agentHost` など）、ルートの依存 `@github/copilot-sdk`・`@vscode/copilot-api`、product.json の AI のキー、`build/lib/copilot.ts` のエージェントのホストの梱包（`ensureCopilotPlatformPackage` など）、`copilot_shim/` と `resources/win32/bin/copilot.sh`（Windows の `bin/copilot-shim`）。どれも C-1 で消す。
- `build/next/build-fast.ts`（開発用の速いビルド。`extensions/copilot/package.json` を読むので動かなくなる）と `eslint.config.js`（`extensions/copilot/.eslintplugin` を import する）。本ビルドと関門には使わないので直さない（`kept`）。

## 影響しうるもの

- 本体のチャットは、既定の AI の拡張（product.json の `defaultChatAgent.chatExtensionId` = `GitHub.copilot-chat`）が無い状態になる。C-1 まではチャットの導入の案内が出る恐れがある（推定）。`mydist` の既定 `chat.disableAIFeatures: true` で隠れる見込み。
- `.claude/agents/*.md` などの言語が Markdown になる（上の理由）。
- postinstall の `.claude/` の symlink を消したので、作業ツリーに `.claude/CLAUDE.md` ができなくなる（作業ツリーで Claude を動かすとき、本家の Copilot 向けの指示を読み込まない）。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| 依存の導入（postinstall）が `extensions/copilot` で止まる | 本家が `build/npm/dirs.ts` 以外にも一覧を足した | 増えた一覧の行を `removeLines` に足す |
| `pnpm run compile` が `compile-copilot` で止まる | edits.patch が当たっていない | `unit.json` を `enabled: false` にする。直すなら `package.json` の scripts を見直す |
| パッケージ化で `prepareBuiltInCopilotRipgrepShim` が止まる | `build/lib/copilot.ts` が変わり、edits.patch の3行が当たっていない | edits.patch を作り直す（docs/03 の5.2） |
| 起動時にチャットの導入の画面やエラーが出る | 本体のチャットが既定の拡張を探す | C-1 まで `chat.disableAIFeatures` で隠す。出続けるなら報告する |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 未確認（型検査とビルドで確かめる）

- `pnpm -C build run typecheck`（`build/tsconfig.json` は `noUnusedLocals: true`）が、edits.patch の後の `build/npm/postinstall.ts` で通るか（`fs`・`path`・`log` はほかでも使っているので通る見込み）。
- `gulp vscode-win32-x64-min` が `compileCopilotExtensionBuildTask`（空の流れ）と `prepareCopilotRipgrepShimTask`（何もしない）を通り抜けるか。
- `build/lib/test/copilot.test.ts` は `prepareBuiltInCopilotRipgrepShim` のテストを持つ。フォルダを作ってから呼ぶので影響しない見込み（本家のテストは関門に入っていない）。
- 起動時に、本体のチャットが `prompt`・`skill` などの言語の ID を探して誤りを出さないか（スモークの base で開発者ツールのコンソールを見る）。

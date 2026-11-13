# 報告: 段階 A の削除の単位（A-1〜A-7）と builtin/keep.json

- 担当: 蒙恬（2026-11-14）
- 依頼: `tasks/2026-11-13-p2-units-a/brief.md`

## 結果

完了。ただし A-3 は `product.overlay.json` に `builtInExtensions: []` が入るまで検査が落ちる（下の「リーダーに諮る点」の1）。

## 成果物

| パス | 中身 |
|---|---|
| `builtin/keep.json` | 残す組み込み拡張67件（feature 16、grammar 47、test 4）と理由。`notExtensions`（`types`）、`own`（`mydist`・`notion-sync`） |
| `removals/A-1-copilot-extension/` | `unit.json`・`README.md`・`edits.patch`（`package.json` の scripts、`build/lib/copilot.ts` の3行、`build/npm/postinstall.ts` の `.claude/` の symlink） |
| `removals/A-2-accounts-extensions/` | `unit.json`・`README.md` |
| `removals/A-3-debug-extensions/` | `unit.json`・`README.md` |
| `removals/A-4-notebook-extensions/` | `unit.json`・`README.md` |
| `removals/A-5-remote-extensions/` | `unit.json`・`README.md` |
| `removals/A-6-themes/` | `unit.json`・`README.md`・`edits.patch`（`src/vs/workbench/test/browser/componentFixtures/fixtureUtils.ts`） |
| `removals/A-7-unused-extensions/` | `unit.json`・`README.md` |
| `tasks/2026-11-13-p2-units-a/units-a-notes.md` | 振り分けの表、決め方の根拠、未確認の点 |
| `tasks/2026-11-13-p2-units-a/trial-log.md` | 作業ツリーで当てた記録 |
| `tasks/2026-11-13-p2-units-a/trial/checks.json`・`checks-dry.json` | apply.mjs の結果 |
| `tasks/2026-11-13-p2-units-a/doc-corrections.md` | docs と食い違った事実7件 |
| `C:\b\wt\dev-a`（ブランチ `units-a`）・`C:\b\wt\dev-a-apply` | 試しの作業ツリー（残した） |

## 要点

- 本家 1.146.0 の `extensions/*`（`package.json` のあるフォルダ95件）は、keep 67件と単位28件に振り分けた。未分類は0件（apply.mjs の `unclassifiedExtensions` も `ok`）。`types` は拡張ではない。
- `prompt-basics` は A-1 に入れた（AI のファイルの言語だけを持ち、`.claude/agents/*.md`・`SKILL.md` を Markdown でなくする）。`jsts-chat-features` はタグのソースに無いので、消すものが無い。`theme-modern-icons` は A-6。
- 一覧から外す行は61行。すべてタグ 1.146.0 でちょうど1行あり、apply.mjs でも全部 `found: 1`。docs に無い一覧 `build/lib/extensions.ts` の `esbuildMediaScripts` も外した。
- パッチは A-1 と A-6 の2つ。A-6 は、部品の見本 `fixtureUtils.ts` が消すテーマの JSON を import していて、外さないと `src` の型検査が落ちるため。
- apply.mjs（p2-apply の版）で7単位を当てた。ops と edits のコミット、`git am -3`、消え残りの検査は通った。落ちたのは A-3 の検査（overlay の不足）と `registeredKeys`（`patches/` を外して当てたため。段階 A とは関係しない）。

## 確かめたこと

- 各 `removeLines` の行が、タグ 1.146.0 の対象のファイルにちょうど1行あること（grep）。
- `C:\b\wt\dev-a` で手で当て、edits のコミットから `edits.patch` を作った。`git apply --check --reverse` で一致を確かめた。
- A-1 の edits.patch を A-1 の ops の後に `git am -3` で当て、元のコミットと差が無いこと。A-6 の edits.patch を素のタグに `git am -3` で当て、ほかの単位が無くても当たること。
- `node scripts/apply.mjs C:/b/wt/dev-a-apply --label p2-units-a-trial --only <A の7単位> --patches <無いフォルダ> --assets <無いフォルダ> --checks-out tasks/2026-11-13-p2-units-a/trial/checks.json`: 7単位とも `applied: "ok"`、`remnants: ok`、`unclassifiedExtensions: ok`。`absentStrings` は A-3 の `ms-vscode.js-debug` の2件だけが当たった。手で当てた結果とは、変えた8ファイルで差が無い。
- `C:\b\wt\1.146.0` は書き換えていない（`git status --short` が空）。依存の導入・型検査・ビルドは走らせていない。

## テストの入口（曹参へ）

| 何を | 入口 | 期待 |
|---|---|---|
| keep.json と単位で未分類が無い | `scripts/lib/apply/classify.mjs` の `findUnclassifiedExtensions(names, keepJson, units)`。`names` はタグ 1.146.0 の `extensions/*/package.json` のフォルダ名、`keepJson` は `builtin/keep.json`、`units` は `removals/*/unit.json` | `[]` |
| keep.json の形 | `builtin/keep.json` | `keep` の `name` が重ならない、どれも `reason` が空でない、`kind` は `feature`・`grammar`・`test` のどれか。`keep` の名前と A 単位の `delete` の `extensions/<名前>` が重ならない。`kind: grammar` の拡張の `package.json`（タグ 1.146.0）に `main` も `browser` も無い |
| 単位の形 | `scripts/lib/apply/units.mjs` の `validateUnit(unit, dirName)` を A の7単位に | 7単位とも `[]` |
| 順と独立 | `planUnits(units, { only: [A の7単位] })` | `errors` が空、`plan` が order 110〜170 の順 |
| removeLines の行 | `scripts/lib/apply/lines.mjs` の `removeLinesFromText` を、`git show 1.146.0:<file>` の中身と各行に | 61行ともちょうど1行が消える |
| edits.patch | `git apply --check removals/A-6-themes/edits.patch`（タグ 1.146.0 の作業ツリー）。A-1 は A-1 の removeLines を当てた後に | 誤りなし |
| 当てた後の検査 | `node scripts/apply.mjs <タグの作業ツリー> --label <x> --only <A の7単位>` | `units` が全部 `applied: "ok"`、`remnants: ok`、`unclassifiedExtensions: ok`。`absentStrings` は overlay に `builtInExtensions: []` が入れば `ok`（入っていなければ A-3 の1件だけ `fail`） |

## リーダーに諮る点

1. **`product.overlay.json` に `builtInExtensions: []` が無い**（p2-units-b の担当のファイル）。docs/02 の3節の表は「set（A-3）」としている。`unit.json` には値を入れる項目が無く、キーを消すと `build/gulpfile.vscode.ts` 160行目と `build/gulpfile.reh.ts` 291行目が止まるので、overlay の `set` に置くしかない。無いと js-debug 系3件がビルドのときに GitHub から取得されて同梱される。overlay への追加を p2-units-b かリーダーに依頼したい。
2. **ターミナルの入力候補の本体の部品が残る**（A-7）。拡張 `terminal-suggest` を消しても、`src/vs/workbench/contrib/terminalContrib/suggest` と設定 `terminal.integrated.suggest.enabled` は残る。案: (a) `mydist` の既定に `terminal.integrated.suggest.enabled: false` を入れる（小さい。mydist の変更なのでこの依頼の範囲外）、(b) 本体の部品を消す単位を足す（docs/03 の4節の最後のとおりユーザーの確認が要る）。
3. **A-1 の後処理の止め方の別案**。採ったのは `build/lib/copilot.ts` の `prepareBuiltInCopilotRipgrepShim` に「拡張のフォルダが無ければ戻る」の3行を足す形（触るのは1か所）。別案は、2つの gulpfile の呼ぶ行を `removeLines` で消し、使われなくなった関数を edits.patch で消す形（docs/03 の「ビルドタスクを消す」に忠実だが、C-1・C-3 が直す gulpfile とパッチが重なる）。
4. A-2 で、`extensions/pnpm-workspace.yaml` の msal の `allowBuilds` 2行と、消えたフォルダを指す `overrides` 1行を残した（版を含む行は、本家が msal を上げるたびに `removeLines` が止まるため）。依存の導入で `overrides` の `file:` が止めるなら、その行を `removeLines` に足す。

## docs/ との食い違い

`doc-corrections.md` の7件。要は、(1) 一覧に `build/lib/extensions.ts` の `esbuildMediaScripts` がある、(2) A-1 はルートの `package.json` の scripts も直す・jsts-chat-features はソースに無い・prompt-basics は足した、(3) A-3 の `builtInExtensions: []` は overlay の `set` でしか入れられない、(4) 画像のプレビューは本体の `contrib/mediaPreview` にある、(5) `extensions/types` は拡張ではない、(6) docs/03 の3.1 の smoke の例の `powershell` という組は docs/06 に無い、(7) 本家の postinstall が常設の clone の git の設定を書き換える（参考）。

## 追記（2026-11-14、リーダーの指示への対応）

### コミットの名前

- `removals/A-1-copilot-extension/edits.patch` と `removals/A-6-themes/edits.patch` の `From:` を `shuko-apply <apply@shuko.invalid>` に直した（差分の中身は変えていない）。
- `C:\b\wt\dev-a-apply` を素のタグに戻し、`node scripts/apply.mjs C:/b/wt/dev-a-apply --label p2-units-a-trial2 --only <A の7単位> --patches <無いフォルダ> --assets <無いフォルダ> --checks-out tasks/2026-11-13-p2-units-a/trial/checks-2.json` で当て直した。
- **`commitIdentity` は `ok`**（`items: []`）。7単位とも `applied: "ok"`、`remnants`・`absentStrings`・`unclassifiedExtensions` も `ok`。`absentStrings` は、overlay に `builtInExtensions: []` が入ったので A-3 の分も当たらなくなった（諮る点の1は解消）。落ちたのは `registeredKeys`（`patches/` を外したため）だけ。記録は `trial-log.md` の2.3。

### sessions.*.main.ts と workbench.web.main.ts

- タグ 1.146.0 の `src/vs/sessions/sessions.{common,desktop,web}.main.ts` と `src/vs/workbench/workbench.{common,desktop,web}.main.ts` を、段階 A で消すもので grep した。**消すものへの import は0件**。当たったのは本体の部品（拡張の管理、本体の GitHub のサービス、本体の AI のセッション）だけで、段階 A では消さない。段階 A は `src/` を消さないので、main.ts の `removeLines` は要らない。記録は `trial-log.md` の2.4。
- 付け足し: 本体の `services/github` は残るが、A-2 で認証の拡張を消すと、GitHub のデータを読む操作が実行時に「サインインが要る」の誤りになる。A-2 の README に足した。

### ほかに直したもの

- A-3 の README: overlay に `builtInExtensions: []` が入ったことに合わせた。
- A-7 の README と `unit.json` の `kept` の理由: `mydist` の既定に `terminal.integrated.suggest.enabled: false` が入ったことに合わせた（諮る点の2は (a) で決着したと読んだ）。

## 追記2（2026-11-14、大岡越前守の検証の軽微な点への対応）

元: `tasks/2026-11-14-p2-verify-prebuild/verification-log.md` の4節の2・3。

- **A-7 の kept の理由（4節の3）**: `removals/A-7-unused-extensions/unit.json` の `kept`（`src/vs/workbench/contrib/terminalContrib/suggest`）の理由を直した。「部品ごと消すのは段階 B・C の単位を足すとき」をやめ、「本体の部品（と `services/suggest`）と設定 `terminal.integrated.suggest.*` は B-7-terminal-suggest が消す。A-7 と B-7 は `after` を持たず独立。B-7 が有効でない間は mydist の既定 `terminal.integrated.suggest.enabled: false` で止める」にした。README の「残すもの」「壊れたときの症状と戻し方」「影響しうるもの」も同じ趣旨に直した。
- **smoke の absence（4節の2）**: A の7単位の `smoke` は、作った時点からすべて `absence` を含んでいた（A-1・A-7 は `["base", "claude-code", "languages", "absence"]`、ほかは `["base", "claude-code", "absence"]`）。直すものは無かった。検証の記録も「A の7単位は持つ」と書いている。`absence` が無いのは B-5・B-6・B-7（p2-units-b の担当。私の書き込み先の外なので触っていない）。
- 確かめ: `C:\b\wt\dev-a-apply` を素のタグに戻し、`node scripts/apply.mjs C:/b/wt/dev-a-apply --label p2-units-a-trial3 --only <A の7単位> --patches <無いフォルダ> --assets <無いフォルダ> --checks-out tasks/2026-11-13-p2-units-a/trial/checks-3.json` で当て直した。7単位とも `applied: "ok"`、`remnants`・`absentStrings`・`unclassifiedExtensions`・`commitIdentity` は `ok`。落ちたのは前回と同じ `registeredKeys`（`patches/` を外したため）だけ。

## 未解決の点

- 型検査・依存の導入・ビルド・スモークでしか分からない点（`units-a-notes.md` の5節）。特に、A-1・A-6 の edits.patch の後の型検査、A-2 の `overrides` と `pnpm install`、ロックファイルの差分、出力の `resources/app/extensions` の中身。
- 試しの作業ツリー `C:\b\wt\dev-a`・`C:\b\wt\dev-a-apply` は検証のために残した。要らなくなったら `git -C C:/b/vscode worktree remove C:/b/wt/<名前>`。

# 段階 A の単位を作業ツリーに当てた記録

- 担当: 蒙恬（2026-11-14）
- 本家: タグ 1.146.0（`69047191fc4`）。`C:\b\wt\1.146.0` は読むだけで、書き換えていない（終わりに `git -C C:/b/wt/1.146.0 status --short` が空）。
- 依存の導入・型検査・ビルドは走らせていない（依頼の守ること）。

## 1. 手で当てて edits.patch を作った（`C:\b\wt\dev-a`）

`git -C C:/b/vscode worktree add C:/b/wt/dev-a 1.146.0` で作り、ブランチ `units-a` で単位の順に当てた。始めた時点では `scripts/apply.mjs` が無かったので、removeLines は Edit で1行ずつ消した。`delete`（フォルダの削除）は、許可されたコマンドに消す手段が無いので、この段では行っていない（2節の apply.mjs の試しで行った）。

| コミット | 中身 |
|---|---|
| `6e12ab79a7d` unit A-1-copilot-extension: ops | removeLines 8行（dirs.ts 2、package.json 6） |
| `fd3bbf8a14e` unit A-1-copilot-extension: edits | package.json の scripts 3行、build/lib/copilot.ts の3行、postinstall.ts の .claude/ の symlink と関数 |
| `1ae0567d665` unit A-2-accounts-extensions: ops | removeLines 10行 |
| `08c9287adeb` unit A-3-debug-extensions: ops | removeLines 6行 |
| `1e9c10e3a99` unit A-4-notebook-extensions: ops | removeLines 8行 |
| `e334e93ed6b` unit A-5-remote-extensions: ops | removeLines 3行 |
| `cafda22170b` unit A-6-themes: ops | 空（delete だけの単位。`--allow-empty`） |
| `3af43f1ff1d` unit A-6-themes: edits | fixtureUtils.ts の15行 |
| `a8145cd7bee` unit A-7-unused-extensions: ops | removeLines 26行 |

- edits のコミットを `git format-patch -1 --stdout` で出し、`removals/A-1-copilot-extension/edits.patch`・`removals/A-6-themes/edits.patch` に写した。作者の行は利用者の名前を入れないよう `Shuko removals <removals@shuko.invalid>` に替えた（`git am` の当たり方には関係しない）。
- 写した後に、`git -C C:/b/wt/dev-a apply --check --reverse -v <edits.patch>` で、edits のコミットと一致することを確かめた（両方とも誤りなし）。
- `git am -3` で当たるか:
  - A-1: `git checkout --detach 6e12ab79a7d`（A-1 の ops の後）→ `git am -3 removals/A-1-copilot-extension/edits.patch` → `Applying: unit A-1-copilot-extension: edits`。元の edits のコミット `fd3bbf8a14e` との `git diff --stat` は空。
  - A-6: `git checkout --detach 1.146.0`（**ほかの単位を当てない素のタグ**）→ `git am -3 removals/A-6-themes/edits.patch` → `Applying: unit A-6-themes: edits`。A-1〜A-5 を無効にしても当たる（docs/03 の5.3）。
- 終わりに `units-a` に戻した。`git status --short` は空。

## 2. apply.mjs で当てた（`C:\b\wt\dev-a-apply`）

作業の途中で、別の蒙恬の `scripts/apply.mjs`（p2-apply）ができていたので、それで当て直した。`git -C C:/b/vscode worktree add C:/b/wt/dev-a-apply 1.146.0` で新しく作った。

### 2.1 dry-run

```
node scripts/apply.mjs C:/b/wt/dev-a-apply --label p2-units-a-dry --dry-run --only A-1-copilot-extension,A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions,A-6-themes,A-7-unused-extensions --patches tasks/2026-11-13-p2-units-a/trial/no-patches --assets tasks/2026-11-13-p2-units-a/trial/no-assets --checks-out tasks/2026-11-13-p2-units-a/trial/checks-dry.json
```

- 7単位とも `unit.json` の形の検査（`validateUnit`）を通り、`applied: "ok"`。
- `unclassifiedExtensions`: `status: "ok"`、`upstreamCount: 95`、`items: []`、`nonExtensionDirs: ["types"]`。**本家 1.146.0 の `extensions/*` に未分類は無い**。
- `--patches` と `--assets` は無いフォルダを渡して外した（`patches/`・`assets/` は p2-units-b の担当で、この単位の試しから切り離すため）。

### 2.2 本番（コミットを作る）

同じ引数で `--dry-run` を外し、`--label p2-units-a-trial --checks-out tasks/2026-11-13-p2-units-a/trial/checks.json` にした。結果の全体は `trial/checks.json`。

| 項目 | 結果 |
|---|---|
| overlay | `c263aa31741` apply: product.json overlay（p2-units-b の `product.overlay.json` をそのまま読んだ） |
| A-1 | ops `d3e3b8f3e32`（delete 2、removeLines 8件とも `found: 1`）、edits `688c4437f96`（`git am -3` で当たった。件名 `unit A-1-copilot-extension: edits`） |
| A-2 | ops `3d11d32a6fa`（delete 3、removeLines 10件とも `found: 1`） |
| A-3 | ops `26302a721cc`（delete 2、removeLines 6件とも `found: 1`） |
| A-4 | ops `97020b75af1`（delete 2、removeLines 8件とも `found: 1`） |
| A-5 | ops `e13797c449a`（delete 1、removeLines 3件とも `found: 1`） |
| A-6 | ops `faa3b65271f`（delete 10）、edits `02eb76e7864`（`git am -3` で当たった） |
| A-7 | ops `78c94e8e153`（delete 8、removeLines 26件とも `found: 1`） |
| 自前の組み込み拡張 | `d77b170aa56`（mydist の3ファイル） |
| `remnants`（消え残り） | `ok`（28フォルダとも消えた。`missingDeletes` は7単位とも空） |
| `absentStrings`（参照の残り） | **`fail`**: A-3 の `ms-vscode.js-debug` が `product.json` の42行目・58行目に残った。ほかの23件は `hitCount: 0` |
| `unclassifiedExtensions` | `ok`（未分類0件） |
| `registeredKeys` | **`fail`**: overlay の `shukoConfigurationDefaults` が `missing`。登録のパッチ（`patches/`）を外して当てたためで、段階 A の単位とは関係しない |

- `absentStrings` の落ちは想定どおり。`product.overlay.json`（p2-units-b）の `set` に `builtInExtensions: []`（docs/02 の3節の表の「set（A-3）」）が無いので、js-debug 系が残った。A-3 の検査はこれを見つけるために置いた（`removals/A-3-debug-extensions/README.md`）。
- 手で当てた `C:\b\wt\dev-a` の `units-a` と、apply.mjs の結果 `d77b170aa56` を、変えた8ファイル（`build`・`package.json`・`extensions/pnpm-workspace.yaml`・`src`）で `git diff --stat` したところ差は無かった。
- 当てた後の作業ツリーの `git status --short` は空。

## 2.3 コミットの名前をそろえた後の当て直し（2026-11-14、リーダーの指示）

- リーダーが edits のコミットの名前を `shuko-apply <apply@shuko.invalid>` に決めた（docs/03 の5.2）。`removals/A-1-copilot-extension/edits.patch` と `removals/A-6-themes/edits.patch` の `From:` を `Shuko removals <removals@shuko.invalid>` から `shuko-apply <apply@shuko.invalid>` に直した（中身の差分は変えていない）。
- `git -C C:/b/wt/dev-a-apply checkout --detach 1.146.0` で素のタグに戻し（`status --short` は空）、2.2 と同じ引数で `--label p2-units-a-trial2 --checks-out tasks/2026-11-13-p2-units-a/trial/checks-2.json` で当て直した。
- 結果（`trial/checks-2.json`）:

| 項目 | 結果 |
|---|---|
| 7単位 | すべて `applied: "ok"`。edits は A-1・A-6 とも `git am -3` で当たり、件名は `unit <id>: edits` |
| `commitIdentity` | **`ok`**（`expected: "shuko-apply <apply@shuko.invalid>"`、`items: []`）。overlay・ops・edits・自前の拡張のコミットの作者とコミッターがすべてそろった |
| `remnants` | `ok` |
| `absentStrings` | **`ok`**（24件とも当たり0件）。この間に `product.overlay.json` の `set` に `builtInExtensions: []` が入ったので、A-3 の `ms-vscode.js-debug` も当たらなくなった |
| `unclassifiedExtensions` | `ok`（95件、未分類0件） |
| `registeredKeys` | `fail`（`shukoConfigurationDefaults` が `missing`）。`patches/` を外して当てたため。段階 A とは関係しない |

## 2.4 sessions.*.main.ts と workbench.web.main.ts の import（docs/03 の5.3 の直しを受けて）

- タグ 1.146.0 の `src/vs/sessions/sessions.common.main.ts`・`sessions.desktop.main.ts`・`sessions.web.main.ts` と `src/vs/workbench/workbench.common.main.ts`・`workbench.desktop.main.ts`・`workbench.web.main.ts` を、段階 A で消すもの（`extensions/` の28件の名前、`copilot`、`simpleBrowser`、`extensions/` へのパス）で grep した。
- 消すものへの import は0件。当たったのは本体の部品だけ（`services/extensions/*`・`contrib/extensions/*`＝拡張の管理、`services/github/*`・`contrib/github/*`＝本体の GitHub のサービス、`sessions/contrib/providers/copilotChatSessions`・コメントの `Copilot cloud sandbox`＝本体の AI）。どれも段階 A では消さない（AI は C-1）。
- 段階 A の単位は `src/` のフォルダを消さないので、これらの main.ts の `removeLines` は要らない。
- 付け足し: 本体の `services/github` は認証の提供者を通して GitHub を読む。A-2 で `github-authentication` を消すと、実行時に「サインインが要る」の誤りになる（型検査には響かない）。A-2 の README の「影響しうるもの」に足した。

## 3. 残した作業ツリー

| 場所 | 状態 | 用途 |
|---|---|---|
| `C:\b\wt\dev-a` | ブランチ `units-a`（delete を除く ops と edits を当てた） | edits.patch を作り直すとき |
| `C:\b\wt\dev-a-apply` | apply.mjs で段階 A を全部当てた状態（detached。2.3 の当て直しの後） | 検証（大岡越前守）と、依存の導入・型検査が使えるようになったときの試し |

消すときは `git -C C:/b/vscode worktree remove C:/b/wt/dev-a`（`dev-a-apply` も同じ）。

# p2-apply の報告（蒙恬 → ヴラド・ツェペシュ）

## 結果

完了。

## 成果物

- `scripts/apply.mjs`: 適用の台本（上書き → 単位 → patches/ → assets/ → 自前の拡張 → 適用後の検査 → `checks.json`）。`--lockfile-check` で依存の導入の後のロックファイルの検査も行う
- `scripts/lib/apply/`
  - 純粋な部品: `lines.mjs`（removeLines）、`overlay.mjs`（product.json の上書き）、`units.mjs`（単位の形・並べ替え・after）、`deps.mjs`（removeDependencies）、`classify.mjs`（未分類の拡張・本家が足した部品・目立たせ）、`keys.mjs`（登録の確かめのキー）、`lockfile.mjs`（pnpm-lock.yaml の読みと比べ）
  - 入出力の部品: `git.mjs`、`tree.mjs`、`checks.mjs`（`checkLockfiles` は build.mjs の入口）
- `tasks/2026-11-13-p2-apply/`
  - `apply-design.md`: 引数、関数の名前と入出力（テストの入口）、`checks.json` の形、試しの入れ物
  - `trial-log.md`: 試しの記録（15回と参考1回）
  - `doc-corrections.md`: 資料との食い違いと提案（7件）
  - `fixtures/`: 試しの単位・パッチ・overlay・keep・assets（止まる例と形の誤りの例を含む）
  - `trial/*/checks.json`（と `lockfile.diff`）: 試しの結果

## 要点

1. 当てる順と2つのコミット（`unit <id>: ops` と、パッチの中のコミットの `unit <id>: edits`）、`git am -3` と rerere（前の解き方で自動で解けたら `--continue`）を、試しの作業ツリー `C:\b\wt\dev-apply` で確かめた。
2. `removeLines` は前後の空白を除いた完全一致で、ちょうど `count` 行のときだけ消す（0行・数違いで止まることを確かめた）。`delete`・`removeDependencies`・`productRemove`・overlay の `remove` の「本家に無い」は警告にする。
3. 適用後の検査は、消え残り・参照の残り（`kept` を除く）・未分類の組み込み拡張（保留）・本家が足した部品と依存（`--prev-tag`）・`.nvmrc` と Electron・overlay と mydist の既定のキーの登録・ロックファイル（導入の後）。結果は `ok` / `hold` / `fail`。
4. overlay の「本家が足したら remove」の項目の名前は、p2-units-b が先に作った `product.overlay.json` に合わせて `removeIfPresent` にした（初版の設計に書いた `removeIfAdded` はやめ、設計を直した）。
5. 本物の入力（作りかけの A-1〜A-7・B-1〜B-6、overlay、keep.json）を dry-run で当てると、ops はすべて当たり、未分類の組み込み拡張は0件だった（参考。合否ではない）。

## 確かめたこと

- `node --check` を `scripts/apply.mjs` と `scripts/lib/apply/*.mjs` の10ファイルに通した（誤りなし）。
- 試しの作業ツリー `C:\b\wt\dev-apply`（タグ 1.146.0 から作った）で、`trial-log.md` の2節の15回。完了条件の「試しの単位の ops・edits のコミットと `checks.json`」は試し3と15（`trial/run2/`・`trial/run3/`）: コミット7つ（overlay、A-1 ops、B-1 ops、B-1 edits、patch、assets、builtin extensions）、結果 `hold`（未分類の組み込み拡張だけ。試しの keep.json は最小の一覧のため）、ロックファイルの検査 `ok`。
- 止まる場合: 0行（6）、数違い（7）、after（8）、衝突で `--abort`（9）、`--keep-conflict`（10）、rerere で自動で解く（11）、unit.json の形の誤り（12）。
- 依存の導入とビルドは走らせていない。`C:\b\wt\1.146.0` には触れていない。

## テストの入口（曹参へ）

関数の名前・入出力は `apply-design.md` の3節。特に試してほしい点（私の試しでは通っていない道）:

- `removeLinesFromText`: `count` が2以上でちょうど一致するとき、CRLF の行、先頭の BOM、最後の行（改行なし）を消すとき、`count` が0・小数・文字列のとき。
- `removeDependenciesFromText`: 区分の最後の要素を消したとき（前の行の `,` を外す）、区分の要素を全部消したとき、2つの区分に同じ名前があるとき、タブの字下げ、JSON として読めないとき。
- `applyProductOverlay`・`validateOverlay`: 知らない項目、`set` と `remove`・`removeIfPresent` の重なり、`$` で始まる項目を読まないこと、入力を書き換えないこと。`stringifyLike` のタブ・CRLF・末尾の改行なし。
- `planUnits`: 同じ `order`・同じ `id`、`--until` が無効な単位を指すとき、`after` が後ろの単位を指すとき（`後ろにある`）。`validateUnit`: `order` が段階の範囲の外、`patch` にパスの区切りが入るとき。
- `findUnclassifiedExtensions`・`keepNamesOf`: keep.json の4つの形、`mydist`・`notion-sync` を数えないこと、`extensions/<名前>/<下>` の delete を覆いに数えないこと。
- `compareLockfile`・`parsePnpmLock`: 引用符つきのキー（`'@scope/name'`、`''` を含む名前）、`link:` で消した importer を指す依存の削除を予期したものとみなすこと、`packages`・`snapshots` の増加、`settings` などの節の変化。
- CLI: `node scripts/apply.mjs`（引数なし）→ 終了コード 2、`--only` に無い ID → `fail`（`errors`）、試しの入れ物（`fixtures/`）を使った `--dry-run` は作業ツリーを変えないこと。

## docs/ との食い違い

`doc-corrections.md` に7件。要点:

1. ロックファイルは1.146.0 で6つ（docs/03 の5.4 は1つの前提の書き方）。
2. product.overlay.json の3つめの項目 `removeIfPresent` が docs/02 の3節に無い。
3. contrib を消す単位は `src/vs/sessions/sessions.*.main.ts`（と `workbench.web.main.ts`）の import も消す必要がある。「本家が足した部品」の import の比べに sessions を足すかは判断を仰ぐ（今は資料どおり `workbench.*.main.ts` だけ）。
4. `format-patch` のパッチに作った人の名前とメールが入る。edits のコミットの作り方を決めたい（試しのパッチは `From:` を `shuko-apply <apply@shuko.invalid>` に書き換えた）。
5. Electron の版は 1.145 系では `.npmrc` の `target`。

## 未解決の点

1. **build.mjs（p2-build-switch）への申し送り**: 単位が package.json から依存を消すので、本家のロックファイルのままでは `pnpm install --frozen-lockfile` が通らない見込み（推定。導入は未実行）。導入は frozen を付けずに行い、その後に `checkLockfiles({ worktree, baseRef: <checks.json の baseCommit>, units, diffOut })` を呼ぶ（または `node scripts/apply.mjs <wt> --label <label> --lockfile-check`）。apply.mjs の入口は `node scripts/apply.mjs <作業ツリー> --label <label> [--prev-tag <tag>]`、終了コード 0 = ok/hold、1 = fail。
2. **共有の git の設定を変えた**: apply.mjs は当てる前に `git config rerere.enabled true` と `rerere.autoupdate true` を作業ツリーで行う。worktree の設定は常設の clone（`C:\b\vscode\.git\config`）と共有なので、`C:\b\wt\1.146.0` を含むすべての作業ツリーで rerere が有効になった（ファイルは変えていない）。試し10で記録した解き方（`chatModelFeedbackSurveyConfig.ts` の試しの衝突）が `C:\b\vscode\.git\rr-cache` に残っている。同じ衝突のときだけ使われる。
3. **試しの作業ツリー `C:\b\wt\dev-apply` を残した**（試し15の状態。変更なし）。要らなければ `git -C C:/b/vscode worktree remove C:/b/wt/dev-apply` で消せる。
4. `notion-sync` の写し（`dist/extension.js` があるとき）は、まだ `extensions-src/notion-sync/` が無いので試していない。
5. 参照の残りの検査の既定の場所は `src`・`build`（docs/03 の6節）。`src/vs/base/test/node/uri.perf.data.txt` のようなパスの文字列のテストデータにも当たるので、単位の `kept` か `absentStrings.in` で外す必要がある（試しの B-1 は `kept` に入れた）。p2-units-a・b に伝えてほしい。
6. 許可について: 試しで `git -C C:/b/wt/dev-apply log` を使おうとして止められた（許可に無い）。コミットは `checks.json` と `git diff HEAD~N` で確かめたので、仕事は進んだ。追加の依頼はしない。
7. 報告の道具: `SubagentHandback` は、私の定義の `tools` に無いとしてフックに3回止められた。報告は返答の本文とこのファイルで渡した。

## 追記（2026-11-14、リーダーの指示への対応）

指示: 適用後の検査の「本家が足した部品」の import の比べに `src/vs/sessions/sessions.*.main.ts`（と `workbench.web.main.ts`）を足す。edits のコミットは `shuko-apply <apply@shuko.invalid>` で作る形に決めたので、apply.mjs が自分で作るコミットもそろっているか確かめる。

### 直したこと

- `scripts/lib/apply/checks.mjs`: `checkUpstreamAdditions` が比べる main のファイルを `MAIN_FILES`（export）にした。`src/vs/workbench/workbench.*.main.ts`（common・desktop・web。web は前から入っていた）と `src/vs/sessions/sessions.*.main.ts`（1.146.0 は common・desktop・web）。
- `scripts/lib/apply/git.mjs`: コミットの名前を `COMMIT_NAME`・`COMMIT_EMAIL`・`COMMIT_IDENT` の定数にし、`COMMIT_IDENTITY`（`-c user.name=shuko-apply -c user.email=apply@shuko.invalid`）をそこから作るようにした。`listCommits(cwd, from, to)` を足した。
- `scripts/apply.mjs`: 適用後の検査に `commitIdentity` を足した。当てる前の HEAD から後のすべてのコミットの作者とコミッターが `shuko-apply <apply@shuko.invalid>` かを見て、違えば `warn` と警告（`fail` にはしない）。全コミットの一覧を `commits` に書く。dry-run では `skipped`。
- `apply-design.md` の3節・4節・変更の記録を直した。

### apply.mjs が作るコミットの名前（確かめた結果）

- apply.mjs が自分で作るコミット（`apply: product.json overlay`、`unit <id>: ops`、`apply: assets`、`apply: builtin extensions`）は、作者もコミッターも `shuko-apply <apply@shuko.invalid>`。`git commit` に `-c user.name=... -c user.email=...` を付けている。
- `git am -3`・`git am --continue` にも同じ `-c` を付けるので、edits.patch と patches/ から入るコミットのコミッターは `shuko-apply`。作者はパッチの `From:` の行のまま。
- 試し16（`trial/run4/checks.json`）: fixtures で当て、7つのコミットすべての作者とコミッターが `shuko-apply <apply@shuko.invalid>`、`commitIdentity` は `ok`。import の比べに `src/vs/sessions/sessions.common.main.ts`・`sessions.desktop.main.ts`・`sessions.web.main.ts` の増えた行（1.145.3 → 1.146.0）が入った。`agentHost`・`chatWindow`・`Subagent` などの行が目立たせの対象になった。
- 試し17（`trial/ident/`）: 本物の `removals/B-3-issue-share` と `patches/20-product-configuration-defaults.patch` を `--only` で当てた。どちらも `From:` が `shuko-apply` で、`commitIdentity` は `ok`、結果 `ok`。
- 試し18（`trial/ident2/`）: 本物の `removals/A-6-themes` を `--only` で当てた。edits のコミットの作者が `Shuko removals <removals@shuko.invalid>`（コミッターは `shuko-apply`）で、`commitIdentity` が `warn` になり、警告が出た。
- `node --check` は直した3ファイルとも通った。試しの後、`C:\b\wt\dev-apply` はタグ 1.146.0 に戻した（変更なし）。

### 申し送り

- `removals/A-1-copilot-extension/edits.patch` と `removals/A-6-themes/edits.patch` の `From:` が、まだ `Shuko removals <removals@shuko.invalid>`（2026-11-14 の時点）。p2-units-a に `shuko-apply <apply@shuko.invalid>` へ直してもらう必要がある。apply.mjs は止めずに警告する。B の単位と `patches/20-...` はすでに `shuko-apply`。
- `TAKE-IN.md` の修理のときのコミットの名前の規約は、まだ書いていない（`TAKE-IN.md` はまだ無い。作るときに入れる）。

## 追記2（2026-11-14、曹参のテストで出た食い違いへのリーダーの判断）

### 直したこと

1. `scripts/lib/apply/lines.mjs` の `removeLinesFromText`: 消す行が最後の行（改行なし）のとき、前の行の改行を外していた処理をやめた。行末は行ごとに保つ（`'a\n<消す行>'` → `'a\n'`）。設計書の「行末は行ごとに保つ」に実装を合わせた。
2. `--until`: 無い単位と、無効な単位（`enabled: false`）・`--only` の外の単位を指したときは、前から `planUnits` が誤りにしていた（`errors` に入れて、作業ツリーに何も書かずに止まり、終了コード 1）。規則を `apply-design.md` の1節（引数の表）と3節（`planUnits`）に書いた。誤りの文言は理由が分かるように直した（`--until の単位 <id> が当てる単位に入っていない（有効でない）`、`--only` のときは `（--only に入っていない）`）。

### 確かめたこと

- `node --check`: `lines.mjs`・`units.mjs`・`apply.mjs` とも通った。
- 試し19（`trial/until-disabled/`）: `--until A-2-bad-zero`（`removals-bad` の無効な単位）→ 終了コード 1、`errors` に `--until の単位 A-2-bad-zero が当てる単位に入っていない（有効でない）`。
- 試し20（`trial/until-missing/`）: `--until A-99-no-such-unit` → 終了コード 1、`errors` に `--until の単位が無い: A-99-no-such-unit`。
- 試し21（`trial/run5/`）: fixtures の本番の当て方で、前と同じく結果 `hold`、コミット7つ、`removeLines` の変化も前と同じ（最後の行を消す例は本家の入力に無いので、1の規則は曹参のテストで確かめる）。試しの後、`C:\b\wt\dev-apply` はタグ 1.146.0 に戻した。
- 曹参のテスト（`node --test tests/apply-parts.test.mjs` ほか）は走らせていない（指示どおり、走らせるのは曹参か大岡越前守）。

## 追記3（2026-11-14、registeredKeys の見つけ方。p2-units-b の未解決の4）

### 直したこと

- `scripts/lib/apply/keys.mjs`: 設定の登録の形で見つける純粋な関数を足した。`isConfigurationFile`、`extractSettingDefinitions`（`const`・`enum` のメンバー・`static readonly` の文字列と別名）、`extractRegistrationKeys`（設定の登録のファイルの中の `'a.b': ...` と `[X]: ...`・`[E.M]: ...`。値が文字列・数・真偽・null のものは既定の値の表とみなして外す）、`resolveRegisteredSettingKeys`（計算されたキーを定義から文字列に直す。別名は5段まで）。
- `scripts/lib/apply/checks.mjs` の `checkRegisteredKeys`: 設定のキーを、ただの文字列の有無でなく、上の登録の形で見るようにした。登録の形が無く、`src/vs` に文字列としてだけ在るキーは、新しい状態 `unregistered`（`fail`、`mentionedIn` に文字列のあるファイル）にする。product.json のキーの見方（語の有無）は変えていない。
- `apply-design.md`: 3節の `keys.mjs` の表、4節の `registeredKeys` の行、4.1「設定のキーの登録の見分け方と、その限り」、変更の記録。

### 確かめたこと

- `node --check`: `keys.mjs`・`checks.mjs` とも通った。
- 試し22（`trial/run6/`。fixtures、1.146.0）: 本家の src に登録がある12件がすべて `upstream` になり、`foundIn` が本当の登録のファイルになった。例: `workbench.colorTheme` → `themeConfiguration.ts`（`[ThemeSettings.COLOR_THEME]`）、`chat.disableAIFeatures` → `chat.shared.contribution.ts`（`[ChatAIDisabledSettingId]`）、`telemetry.telemetryLevel` → `telemetryService.ts`（`[TELEMETRY_SETTING_ID]`）、`terminal.integrated.suggest.enabled` → `terminalSuggestConfiguration.ts`。前は読み手のファイル（`remotesEditor.ts` など）を指していた。拡張の5件（`extension`・`lockManifest`）は変わらず。結果 `hold`（前と同じ）。
- 試し23（`trial/b7/`）: 本物の `removals/B-7-terminal-suggest` を `--only` で当てた。`terminal.integrated.suggest.enabled` が `unregistered`（`mentionedIn: src/vs/workbench/contrib/terminal/terminalContribExports.ts`。B-7 のパッチが enum に残した文字列）になり、`registeredKeys` が `fail`。ほかのキーは ok。前の作りでは、これを `upstream` と誤っていた。
- 試しの後、`C:\b\wt\dev-apply` はタグ 1.146.0 に戻した。

### 見分けられる範囲（要点。詳しくは apply-design.md の4.1）

- 見分けられる: 文字列のキーの登録、`const`・`enum`・`static readonly` を通した計算されたキーの登録、登録を消して文字列（読み手や enum の値）だけが残った場合。
- 見落として `fail` に倒れる（安全側）: テンプレートの文字列や関数で作るキー、オブジェクトの定数、`import ... as` の別名、設定の型・関数の名前を含まないファイルの properties。
- 誤って `ok` にする: 同じ名前の定数が別の値で他のファイルに在るとき、設定でない表の `'a.b': {`、登録のコードがソースに残ったまま読み込む import だけを消したとき。最後の確かめはビルドした本体のスモークで行う。

### 申し送り

- B-7 を有効にするときは、mydist の `terminal.integrated.suggest.enabled: false` を外す（p2-units-b の未解決の4のとおり）。外さなければ、この検査が `fail` で止める。→ 追記4 で apply.mjs が写すときに自動で外すようにした。

## 追記4（2026-11-14、mydist の既定から単位が消した設定を外す）

指示: 単位を有効にすると、その単位が消した設定に mydist の既定が残り、registeredKeys が fail になる（p2-units-b の追記の未解決1）。apply.mjs が mydist を写すとき、当てた単位の `checks.absentSettings` のキーを写した package.json の configurationDefaults から外し、checks.json に記録する。

### 直したこと

- `scripts/lib/apply/keys.mjs`: `pruneConfigurationDefaults(manifest, units)` → `{ manifest, removed: [{ key, unit }] }` を足した（純粋。入力は変えない。トップレベルのキーだけ）。
- `scripts/apply.mjs`: mydist を作業ツリーの `extensions/mydist/` に写した後、当てた単位の `absentSettings` に載ったキーを `package.json` の `contributes.configurationDefaults` から外して書き直す（元の字下げ・改行を保つ）。リポジトリの `extensions-src/mydist` は書き換えない。外したキーは `builtinExtensions.removedDefaults`（と `copied[].removedDefaults`）に記録し、ログにも出す。`registeredKeys` は外した後の manifest で見る。dry-run では書かずに記録だけする。
- `apply-design.md`: 2.6、3節（`pruneConfigurationDefaults`）、4節の例、変更の記録。

### 単位の側の前提（確かめた結果）

- `removals/B-2-onboarding-experiments-surveys/unit.json` の `checks.absentSettings` に `workbench.startupEditor` が載っている。
- `removals/B-7-terminal-suggest/unit.json` の `checks.absentSettings` に `terminal.integrated.suggest.enabled` が載っている。
- どちらも載っていたので、単位の側の直しは要らない。ほかの単位の `absentSettings` のキーは、今の mydist の既定と重ならない。

### 確かめたこと

- `node --check`: `apply.mjs`・`keys.mjs` とも通った。
- 試し24（`trial/ab/`）: 本物の A-1〜A-7・B-1〜B-7 の14単位と `patches/` の2本（20・30）を `--only` で `C:\b\wt\dev-apply` に当てた（`--prev-tag 1.145.3`）。
  - ログに `mydist の既定から workbench.startupEditor を外した（B-2-onboarding-experiments-surveys の absentSettings）` と `... terminal.integrated.suggest.enabled を外した（B-7-terminal-suggest ...）`。`builtinExtensions.removedDefaults` に2件。
  - 作業ツリーの `extensions/mydist/package.json` にこの2つのキーが無いことを確かめた（ほかのキーは残る）。
  - `registeredKeys` が `ok`、`commitIdentity` が `ok`、結果 `ok`（未分類の組み込み拡張0、消え残り・参照の残りも ok）。
- リポジトリの `extensions-src/mydist/package.json` は apply.mjs では変わっていない（`git diff` に出る1行 `terminal.integrated.suggest.enabled: false` は p2-units-b が足したもので、まだコミットされていない）。
- 試しの後、`C:\b\wt\dev-apply` はタグ 1.146.0 に戻した。

### 気づいた点

- `git diff` が「LF will be replaced by CRLF the next time Git touches it」と出した。このリポジトリでは `core.autocrlf` が改行を変える設定になっている見込み。`doc-corrections.md` の7（`.gitattributes` に `*.patch -text`）が要る理由がはっきりした。apply.mjs は全行 CRLF のパッチを見分けて `--keep-cr` を付けないので当たるが、`.gitattributes` があるほうが確か。
- overlay の `shukoConfigurationDefaults`（application スコープの6件）は外す対象にしていない。単位がそれらの設定を消すときは overlay を直す必要がある（今の単位には無い）。

## 追記5（2026-11-14、大岡越前守の検証の残り）

### 1. 検証用の作業ツリー `C:\b\wt\verify-p2`

- `git -C C:/b/vscode worktree add C:/b/wt/verify-p2 1.146.0` で作った（git の出力: `Preparing worktree (detached HEAD 69047191fc4)`、21005 ファイル）。何も当てていない。
- HEAD: `C:\b\vscode\.git\worktrees\verify-p2\HEAD` が `69047191fc427f2f92828279aae1d90d8eeda7ab`（upstream.json の commit と同じ。detached）。`git rev-parse` は作業ツリーへの `-C` の形が私の許可に無いので、HEAD のファイルを読んで確かめた。
- clean: `git -C C:/b/wt/verify-p2 status --porcelain` が空（作った直後と、追記5 の終わりの2回）。

### 2. `--manifests` の既定を `<buildRoot>\cache\vsix` に

- `scripts/apply.mjs`: `--manifests` の既定を `C:/b/p0/vsix` から `<buildRoot>\cache\vsix` に改めた（docs/02 の8節。`install-extensions.mjs` の `--cache` の既定と同じ場所・同じ並べ方 `<id>-<版>[@<target>]\`）。`buildRoot` は `--build-root`（新しく足した）→ `local.json`（`scripts/lib/local-config.mjs` の `resolveLocalConfig`）→ `C:\b` の順で決める。local.json が読めない・誤りなら引数の誤り（終了コード 2）。
- 確かめたこと: `node --check scripts/apply.mjs` が通った。fixtures の dry-run（`trial/manifests-default/checks.json`）で `inputs.manifests` が `C:\b\cache\vsix` になった。今は `C:\b\cache\vsix` に manifest が無いので、台帳の拡張の設定のキー（`basedpyright.importStrategy`・`claudeCode.environmentVariables`）は `unverified`（`warn`）になり、警告が出る（検証の軽微1 の見立てどおり）。VSIX をキャッシュに取れば `lockManifest` になる。
- `apply-design.md` の1節（引数の表）と変更の記録を直した。

### 申し送り

- `lock-fetch.mjs` の `--out` の既定も、まだ `C:/b/p0/vsix`（docs/02 の8節は「ここにそろえる」と書く）。依頼の範囲の外なので直していない。直すなら一言ください（私の書き込み先の中で、数行の変更）。
- キャッシュに manifest が入るまでは、`registeredKeys` が `warn` を出す（結果は `ok` のまま。`fail` にはならない）。→ 追記6 で入れた。

## 追記6（2026-11-14、VSIX のキャッシュの既定をそろえ、台帳の8件を入れた）

### 直したこと（既定を `<buildRoot>\cache\vsix` に。docs/02 の8節）

- `scripts/lock-fetch.mjs`: `--out` の既定を `C:/b/p0/vsix` から `<buildRoot>\cache\vsix` に。`--build-root` を足した（`scripts/lib/local-config.mjs` の `resolveLocalConfig`。`--build-root` → local.json → `C:\b`）。あわせて `--pin` を足した: 基準の版（台帳の版）をそのまま取り、新しい版を選ばない。これが無いと、寝かせる期間を過ぎた新しい版があれば、その版を取ってしまう（台帳の版と違う `<id>-<版>` のフォルダになり、apply.mjs の manifest の照合と install-extensions.mjs のキャッシュに合わない）。
- `scripts/lock-verify.mjs`: `--dir` の既定を同じく `<buildRoot>\cache\vsix` に。`--build-root` を足した。
- `scripts/convert-sublime-keys.mjs`: Claude Code の VSIX を探す場所（`findLocalClaudeVsix`）を `<buildRoot>\cache\vsix` に。この台本の `--cache`（`C:/b/p0/sublime`、Sublime の VSIX の置き場所）は別のものなので変えていない。
- `scripts/lock-diff.mjs`: 説明の中の例のパスだけを直した。
- 変えていないもの: `scripts/lib/p0-common.ps1`（Phase 0 の道具）。`tests/smoke/lib/common.mjs` の `VSIX_ROOT = 'C:\\b\\p0\\vsix'`（曹参の書き込み先。そろえるなら曹参へ）。
- `node --check`: `lock-fetch.mjs`・`lock-verify.mjs`・`convert-sublime-keys.mjs`・`lock-diff.mjs` とも通った。

### 台帳の8件をキャッシュに入れた

- `node scripts/lock-fetch.mjs --pin`（`--write-lock` は lock-verify の引数で、lock-fetch には無い。台帳は書き換えない）。置き場所 `C:\b\cache\vsix\`、記録 `C:\b\cache\vsix\fetch-result.json`。
- 8件とも台帳の版で取れた。VSIX の SHA-256（`sha256Computed`）は8件とも台帳の `sha256` と一致した。
- `git status --short extensions.lock.json` は空（台帳は変わっていない）。
- 気づいた点: Open VSX の Claude Code 拡張の最新が 2.1.323（台帳は 2.1.322）。`--pin` なので取っていない。取り込みは更新の検知と `take-in.mjs ext` の流れで扱う。

### apply.mjs の registeredKeys が warn でなくなった

- 試し25（`trial/ab2/`）: 本物の A-1〜A-7・B-1〜B-7 と patches/ の2本を `C:\b\wt\dev-apply` に当てた（`--manifests` は既定のまま。`inputs.manifests` が `C:\b\cache\vsix`）。`basedpyright.importStrategy` → `lockManifest`（`detachhead.basedpyright`）、`claudeCode.environmentVariables` → `lockManifest`（`anthropic.claude-code`）、`manifestsMissing: []`、`registeredKeys` は `ok`、結果 `ok`、警告なし。
- 試しの後、`C:\b\wt\dev-apply` はタグ 1.146.0 に戻した。`C:\b\wt\verify-p2` には触れていない（`git status --porcelain` が空のまま）。

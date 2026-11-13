# apply.mjs の設計（引数・関数の入出力・checks.json の形）

- 作った人: 蒙恬（p2-apply）
- 状態: 実装済み（2026-11-14）。試しの記録は `trial-log.md`
- 実装: `scripts/apply.mjs`、`scripts/lib/apply/{lines,overlay,units,deps,classify,keys,lockfile,git,tree,checks}.mjs`
- 仕様の出どころ: docs/03 の3・5・6・8・9節、docs/02 の2・3節と4節の2・3、docs/06 の4節の4

## 1. 使い方

```
node scripts/apply.mjs <作業ツリー> --label <label> [オプション]
node scripts/apply.mjs <作業ツリー> --label <label> --lockfile-check [--base <ref>] [--checks-out <path>] [--diff-out <path>]
```

| 引数 | 既定 | 中身 |
|---|---|---|
| `<作業ツリー>` | 必須 | 本家のタグの作業ツリー（例 `C:\b\wt\1.146.0`）。変更が無いこと（`git status --porcelain` が空）を確かめてから当てる |
| `--label <label>` | 必須 | 版のラベル（例 `1.146.0-1`）。記録の場所に使う |
| `--only <id,...>` | なし | 試し用。挙げた単位だけを当てる。`enabled: false` の単位でも、挙げれば当てる（関門の前の試しのため）。`after` は「同じ実行で先に当たった」ことで満たす |
| `--until <id>` | なし | その単位まで（含む）で単位の適用を止める（docs/03 の8節の「半分ずつ当てて絞る」）。`patches/`・`assets/`・自前の拡張は当てる。無い単位、無効な単位（`enabled: false`）、`--only` の外の単位を指したら、作業ツリーに何も書かずに止める（`errors` に入れて `result: "fail"`、終了コード 1。2026-11-14 リーダーの判断） |
| `--dry-run` | 偽 | 作業ツリーを書き換えない。`delete` の有無、`removeLines` の数、overlay の結果、`after` を、メモリの上で順に試す（前の単位の変更を引き継ぐ）。`edits.patch` と `patches/` は当てない（`applied: "skipped"`）。消え残りと参照の残りの検査は行わない（`skipped`）。`registeredKeys` の `fail` は `warn` に下げる（パッチが足すキーは見つからないため） |
| `--checks-out <path>` | `records/take-in/<label>/checks.json` | 結果の JSON |
| `--prev-tag <tag>` | なし | 前のタグ。本家が足した部品・依存の変化・`.nvmrc` と Electron の版の変化を、このタグと比べる。無ければそれらは `skipped` |
| `--removals <dir>` | `removals/` | 削除の単位の置き場所（試しのフォルダを渡せる） |
| `--patches <dir>` | `patches/` | 番号つきのパッチの置き場所 |
| `--assets <dir>` | `assets/` | 作業ツリーに写すファイル |
| `--overlay <file>` | `product.overlay.json` | product.json の上書き |
| `--keep <file>` | `builtin/keep.json` | 残す組み込み拡張 |
| `--extensions-src <dir>` | `extensions-src/` | 自前の組み込み拡張（`mydist`・`notion-sync`） |
| `--manifests <dir>` | `<buildRoot>\cache\vsix`（docs/02 の8節） | 台帳の拡張の manifest（`<dir>/<id>-<版>[@<target>]/package.json`。`lock-fetch.mjs`・`install-extensions.mjs` の VSIX のキャッシュの置き方）。mydist の既定のキーが第三者の拡張の設定かを確かめるのに使う。無ければその拡張の設定のキーは `unverified`（`warn`） |
| `--build-root <dir>` | `local.json` の `buildRoot`、無ければ `C:\b` | `--manifests` の既定を決めるためだけに使う（`scripts/lib/local-config.mjs` の `resolveLocalConfig`）。local.json が読めない・誤りなら引数の誤り（終了コード 2） |
| `--config <local.json>` | `%LOCALAPPDATA%\Shuko\local.json` | `--build-root` が無いときに buildRoot を読む local.json（2026-11-14 追加。build.mjs は自分の `--config` を渡す） |
| `--lock <file>` | `extensions.lock.json` | 台帳（manifest を探すため） |
| `--keep-conflict` | 偽 | `git am -3` が当たらなかったとき、`git am --abort` せずに衝突のまま残す（取り込みの修理で使う） |
| `--lockfile-check` | — | 依存の導入の後に、ロックファイルの検査（docs/03 の5.4）だけを行い、既存の `checks.json` の `checks.lockfile` と `result` を書き換える。`--base` が無ければ `checks.json` の `baseCommit` を使う。当てた単位は `checks.json` の `units`（`applied: "ok"`）の ID で `--removals` から読む。`checks.json` が無ければ単位なしで比べ、警告を残す |
| `--diff-out <path>` | `checks.json` と同じフォルダの `lockfile.diff` | ロックファイルの差分 |

終了コード: `0` = `result` が `ok` か `hold`、`1` = `fail`、`2` = 引数の誤り。

## 2. 当てる順（docs/03 の5.1、docs/02 の4節の2）

1. 作業ツリーの確かめ: 変更が無い、`git am` の途中でない。`baseCommit`（今の HEAD）を記録する。`rerere.enabled` と `rerere.autoupdate` を真にする（`git config`。作業ツリーと常設の clone で共有の設定）。
2. product.json の上書き → コミット `apply: product.json overlay`
3. 単位を `order` の順に（`--only` が無ければ `enabled: true` だけ）。各単位で:
   1. `after` の確かめ（すべて同じ実行で先に当たっている）。満たさなければ止める。
   2. `delete` → `removeDependencies` → `removeLines` → `productRemove` → コミット `unit <id>: ops`（変更が無くても空のコミットを作る）
   3. `patch` があれば `git am -3` → パッチの中のコミットがそのまま入る（件名が `unit <id>: edits` でなければ警告）。無ければ `edits.applied: "none"`
4. `patches/*.patch` を番号の順に `git am -3`
5. `assets/` の写し → コミット `apply: assets`
6. 自前の組み込み拡張の写し（`extensions-src/mydist` → `extensions/mydist`、`notion-sync` は `dist/extension.js` があるときだけ）→ コミット `apply: builtin extensions`
7. 適用後の検査（4節）→ `checks.json`

コミットの作者・コミッターは `shuko-apply <apply@shuko.invalid>`（`git -c user.name=... -c user.email=...`。利用者の git の設定に頼らない）。フックは走らせない（`commit --no-verify`）。

`git am -3` が当たらないとき: 未解決のファイルが無く、ステージに解いた結果があれば（rerere が前の解き方で解いたとき。`rerere.autoupdate` でステージされる）`git am --continue` で続ける。残っていれば、衝突のファイルの一覧を記録して `git am --abort`（`--keep-conflict` なら残す）し、そこで止める。パッチのファイルの全部の行が CRLF なら、チェックアウトで改行が変わったものとみなして `--keep-cr` を付けない。一部の行だけが CRLF なら付ける（`shouldKeepCr`）。

止めたとき（`stoppedAt`）: 作業ツリーはそのまま残す（ops の途中なら書きかけの変更が残る。直前までのコミットは残る）。やり直すときは `git checkout -f --detach <タグ>` で戻す。入力の誤り（unit.json の形、`after`、`--only` の知らない ID、overlay の形）は、作業ツリーに何も書く前に止める。止めたときも、作業ツリーに依らない検査（未分類の組み込み拡張、本家が足した部品、依存、`.nvmrc` と Electron）は行う。

### 2.1 各操作の規則

- パス（`delete`、`removeLines.file`、`removeDependencies` のキー、`kept.path`、`absentStrings.in`）: リポジトリのルートからの相対。区切りは `/`。絶対パス・`..`・空は誤り。
- `delete`: ファイルかフォルダを消す。無ければ**警告**（`warnings` に `delete: <path> が本家に無い（改名の恐れ）`）して続ける。
- `removeDependencies`: `{ "<package.json の相対パス>": ["名前", ...] }`。`dependencies`・`devDependencies`・`optionalDependencies`・`peerDependencies` から、その名前の行を消す（行を消すだけで、ほかの行の整形は変えない。最後の要素を消したら前の行の `,` を外す）。どの区分にも無ければ**警告**。package.json が無ければ**止める**。
- `removeLines`: `{ file, line, count? }`。前後の空白を除いて `line` と完全に一致する行を数え、ちょうど `count`（既定 1）行なら全部消す。違えば**止める**（`found` を記録）。正規表現は使わない。行末（CRLF / LF）と先頭の BOM は保つ。ファイルが無ければ止める。
- `productRemove`: product.json からキーを消す。無ければ**警告**。
- product.json を書くときは、元の字下げ（1.146.0 はタブ）と末尾の改行を保つ。既にあるキーの位置は変えず、新しいキーは末尾に足す。

### 2.2 product.overlay.json の形

```json
{
  "set": { "nameShort": "Shuko", "shukoConfigurationDefaults": { "...": "..." } },
  "remove": ["reportIssueUrl"],
  "removeIfPresent": ["enableTelemetry", "aiConfig", "updateUrl", "tasConfig", "extensionsGallery"]
}
```

| 項目 | 規則 |
|---|---|
| `set` | キーの値を入れる・置き換える（トップレベルのキー単位。値は丸ごと置き換え、中を混ぜない） |
| `remove` | キーを消す。本家に無ければ**警告**（本家の改名を見つけるため。docs/02 の3節の末尾） |
| `removeIfPresent` | docs/02 の3節の「本家が足したら remove」。本家に無ければ何もしない。あれば消して**警告**（`本家の product.json に <key> がある（本家が足した）。外した`） |
| `$comment` など `$` で始まるキー | 説明。読まない |

ほかのトップレベルのキー、同じキーが `set` と `remove`（または `removeIfPresent`）の両方にあるときは**止める**。

名前は p2-units-b が先に作った `product.overlay.json` の `removeIfPresent` に合わせた（初版の `removeIfAdded` はやめた）。

### 2.3 builtin/keep.json の読み方

次のどれでも読む（p2-units-a の形に合わせるため。名前は `extensions/` の下のフォルダの名前）。

- `["git", ...]`
- `[{ "name": "git", "reason": "..." }, ...]`（`name` が無ければ `id`）
- `{ "keep": <上の配列> }` または `{ "extensions": <上の配列> }`
- `{ "git": "理由", ... }`（キーが名前）

p2-units-a の `builtin/keep.json`（`{ "$comment", "upstreamTag", "keep": [{ name, kind, reason }] }`）は2つめと4つめの組み合わせで読める（2026-11-14 に確かめた）。

### 2.4 単位が覆う組み込み拡張

単位の `delete` のうち `extensions/<名前>`（ちょうど2段）のもの。`enabled` を問わず、`removals/` のすべての単位を数える（docs/03 の4節の「keep.json か削除の単位のどちらかに載っていなければならない」）。

### 2.5 assets の写し方

`assets/` の下を、作業ツリーの同じ相対パスへ写す（例 `assets/resources/win32/code.ico` → `<作業ツリー>/resources/win32/code.ico`）。`assets/` の直下の `*.md` は写さない（説明のため）。

### 2.6 自前の組み込み拡張の写し方

`extensions-src/<名前>/` から、次だけを `<作業ツリー>/extensions/<名前>/` に写す: `package.json`、`package.nls*.json`、`README.md`、`ThirdPartyNotices.txt`、`LICENSE*`、`dist/`、`media/`。`mydist` は必須（無ければ止める）。`mydist` を写すときは、当てた単位の `checks.absentSettings` に載ったキーを、写した `package.json` の `contributes.configurationDefaults` から外す（単位が消した設定に既定だけが残ると、`registeredKeys` が `fail` になるため。2026-11-14 リーダーの判断）。リポジトリの `extensions-src/mydist` は書き換えない。外したキーは `builtinExtensions.removedDefaults`（`[{ key, unit }]`）に記録し、`registeredKeys` は外した後の manifest で見る。言語の上書き（`"[python]": {...}`）の中は見ない。overlay の `shukoConfigurationDefaults` は対象外（単位が application スコープの設定を消すときは、overlay を直す）。`notion-sync` はフォルダが無ければ何もしない。フォルダがあって `dist/extension.js` が無ければ警告して写さない（docs/02 の4.1: 先にビルドしてできたものを写す）。

## 3. 部品（`scripts/lib/apply/`）と、テストの入口

純粋な関数（ファイルも git も触らない）。入力を書き換えない。

### `lines.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `matchesLine(candidate, target)` | 文字列2つ | 前後の空白を除いて等しければ `true` |
| `removeLinesFromText(text, line, count = 1)` | ファイルの中身、探す行、数 | `{ ok, text, found, error }`。`found` は一致した行の数。`found === count` なら `ok: true` で一致した行を全部消した `text`。違えば `ok: false`、`text` は元のまま、`error` に理由。`count` が1以上の整数でなければ `ok: false`。行末（`\r\n` / `\n`）は行ごとに保ち、先頭の BOM は照合から外して残す。消す行が最後の行（改行なし）でも、前の行の改行は消さない（`'a\n<消す行>'` → `'a\n'`。2026-11-14 リーダーの判断） |

### `overlay.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `validateOverlay(overlay)` | overlay の JSON | 誤りの文字列の配列（正しければ空） |
| `OVERLAY_KEYS` | — | `["set", "remove", "removeIfPresent"]` |
| `applyProductOverlay(product, overlay)` | product.json のオブジェクト、overlay | `{ product, set, removed, removedIfPresent, warnings, errors }`。`set`・`removed`・`removedIfPresent` はキーの配列。`errors` が空でなければ `product` は元の写し |
| `removeProductKeys(product, keys)` | product、キーの配列 | `{ product, removed, missing }` |
| `detectIndent(text)` | JSON の文字列 | `"\t"` か空白の文字列（既定 2 個の空白） |
| `stringifyLike(value, originalText)` | 値、元の文字列 | 元の字下げと末尾の改行の有無に合わせた JSON の文字列 |

### `units.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `normalizeRelPath(p)` | パス | `/` 区切りの相対パス。絶対・`..`・空・文字列でないときは `null` |
| `isUnderPath(p, prefix)` | 相対パス2つ | `p` が `prefix` と同じか、その下なら `true` |
| `validateUnit(unit, dirName)` | unit.json、フォルダの名前 | 誤りの文字列の配列。`id` がフォルダの名前と同じ、`<段階>-<番号>-<名前>`、`stage` が A/B/C で `id` の先頭と同じ、`order` が段階の範囲（A 100〜199、B 200〜299、C 300〜399）、`enabled` が真偽、配列の項目の型、パスの形 |
| `STAGE_ORDER_RANGES`、`UNIT_ID_PATTERN` | — | `{ A: [100, 199], B: [200, 299], C: [300, 399] }`、`/^([ABC])-(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/` |
| `planUnits(units, { only, until })` | 単位の配列、選び方 | `{ plan, skipped, errors }`。`plan` は当てる単位を `order` の順に（同じ `order`・同じ `id` は誤り）。`only` が無ければ `enabled: true` だけ（ほかは `skipped` に `{ id, reason: "disabled" }`）。`only` があれば挙げたものだけ（ほかは `reason: "not in --only"`）。`only`・`until` に知らない ID があれば誤り。`until` が `plan` に入らない単位（無効・`--only` の外）を指しても誤り（文言 `--until の単位 <id> が当てる単位に入っていない（有効でない｜--only に入っていない）`。無い単位は `--until の単位が無い: <id>`）。`until` の後の単位は `skipped`（`reason: "after --until"`）。`after` が `plan` の中で先に無ければ誤り（文言に理由: `無い`・`有効でない`・`--only に入っていない`・`後ろにある`） |
| `checkAfter(unit, appliedIds)` | 単位、すでに当たった ID の集合 | 満たさない ID の配列 |

### `deps.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `DEPENDENCY_SECTIONS` | — | `["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]` |
| `removeDependenciesFromText(text, names)` | package.json の中身、名前の配列 | `{ ok, text, removed, missing, error }`。`removed` は `[{ name, section }]`、`missing` はどの区分にも無かった名前。結果を JSON として読み直し、消した名前のほかが変わっていないことを確かめる（違えば `ok: false`） |

### `classify.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `HIGHLIGHT_WORDS` | — | 目立たせる語（小文字）: `chat`、`agent`、`copilot`、`mcp`、`telemetry`、`experiment`、`survey`、`languagemodel`、`lm-`、`openai`、`anthropic`、`claude`、`codex`、`1ds`、`appinsights`、`applicationinsights`、`assignment`、`tas-` |
| `highlightWords(name)` | 名前・パス・行 | 含まれていた語の配列（大文字小文字を問わない部分一致。無ければ空） |
| `keepNamesOf(keepJson)` | keep.json の値 | 名前の配列（2.3 の形） |
| `extensionsCoveredByUnits(units)` | 単位の配列 | 名前の配列（2.4） |
| `findUnclassifiedExtensions(upstreamNames, keepJson, units, own = ["mydist", "notion-sync"])` | 本家の `extensions/*` の名前、keep.json、全単位 | `[{ name, highlight }]`（名前の順） |
| `diffNameLists(prev, next)` | 名前の配列2つ | `{ added, removed }`（並べ替えた配列） |
| `addedImportLines(prevText, nextText)` | ファイルの中身2つ | 次の版で増えた `import` の行（前後の空白を除く） |
| `addedDependencies(prevPkg, nextPkg)` | package.json のオブジェクト2つ | `[{ name, section, version }]`（`dependencies`・`devDependencies`・`optionalDependencies` に増えたもの。前の版でどれかの区分にあった名前は、区分が移っても数えない） |
| `OWN_EXTENSIONS` | — | `["mydist", "notion-sync"]` |

### `keys.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `settingKeysToCheck(mydistManifest, overlay)` | mydist の package.json、overlay | `[{ key, from }]`。`from` は `mydist`（`contributes.configurationDefaults` のキー。`[python]` のような言語の上書きは外す）か `shukoConfigurationDefaults`（overlay の `set` の中のキー） |
| `pruneConfigurationDefaults(manifest, units)` | mydist の package.json、当てた単位の配列 | `{ manifest, removed }`。`units` の `checks.absentSettings` に載ったキーを `contributes.configurationDefaults` のトップレベルから外した写し（入力は変えない）。`removed` は `[{ key, unit }]`（configurationDefaults の順。同じキーを複数の単位が載せていれば先の単位） |
| `configurationPropertyKeys(manifest)` | 拡張の package.json | `contributes.configuration`（オブジェクトか配列）の `properties` のキーの配列 |
| `literalIncluded(text, key)` | 中身、キー | `'key'`・`"key"`・`` `key` `` のどれかを含めば `true` |
| `isConfigurationFile(text)` | ファイルの中身 | `registerConfiguration`・`IConfigurationPropertySchema`・`IConfigurationNode`・`ConfigurationScope.` のどれかを含めば `true` |
| `extractSettingDefinitions(text)` | ファイルの中身 | `[{ name, literal }` か `{ name, ref }]`。`const X = 'k';`（`name: "X"`）、`enum E { M = 'k' }`（`"E.M"`）、`class C { static readonly S = 'k'; }`（`"C.S"`）。値が識別子（ドット区切り）なら `ref` |
| `extractRegistrationKeys(text)` | ファイルの中身 | `isConfigurationFile` が偽なら `[]`。真なら、`'a.b': <値>` の形の文字列のキー（ドットを含むもの）を `{ literal }`、`[X]: <値>`・`[E.M]: <値>` の計算されたキーを `{ ref }` で返す。値が文字列・数・`true`・`false`・`null`・`undefined` で始まるものは、既定の値の表とみなして返さない |
| `resolveRegisteredSettingKeys(files)` | `[{ file, definitions, registrations }]` | `Map<キー, 登録のあるファイルの配列>`。`ref` は全ファイルの定義をたどって文字列に直す（別名は5段まで） |

### `lockfile.mjs`

| 関数 | 入力 | 出力 |
|---|---|---|
| `parsePnpmLock(text)` | pnpm-lock.yaml（lockfileVersion 9）の中身 | `{ sections, importers, packages, snapshots }`。`sections` はトップレベルの節の名前 → 生の文字列（`importers`・`packages`・`snapshots` を除く）、`importers` は `{ <importer>: { <区分>: { <名前>: { specifier, version } } } }`、`packages`・`snapshots` はキーの配列 |
| `compareLockfile(beforeText, afterText, expected)` | 本家のロックファイル、作り直したもの、`{ removedImporters: [...], removedDeps: { <importer>: [名前] } }` | `{ ok, changedSections, addedImporters, removedImporters, unexpectedRemovedImporters, addedDeps, removedDeps, unexpectedRemovedDeps, changedDeps, addedPackages, removedPackages, addedSnapshots, removedSnapshots }`。`ok` は「消えただけ」のとき真: 節の変化・importer の増加・予期しない importer の削除・依存の増加・予期しない依存の削除・残った依存の `specifier`/`version` の変化・`packages`/`snapshots` の増加が、どれも無いこと。削除された依存のうち、`link:` で消した importer を指すものは予期したものとみなす |
| `expectedLockRemovals(lockDir, importers, units)` | ロックファイルのフォルダ（ルートからの相対。ルートは `""`）、importer の名前の配列、当てた単位 | `{ removedImporters, removedDeps }`（単位の `delete` の下にある importer と、`removeDependencies` の package.json に当たる importer の名前） |

### `lines.mjs` の補助

| 関数 | 入力 | 出力 |
|---|---|---|
| `splitLinesKeepEol(text)` | 中身 | `[{ body, eol }]`（`eol` は `"\r\n"`・`"\n"`・`""`） |

### `git.mjs` の純粋な関数

| 関数 | 入力 | 出力 |
|---|---|---|
| `shouldKeepCr(patchText)` | パッチの中身 | 一部の行だけが `\r` で終わるとき `true`。全部か0行なら `false` |
| `COMMIT_NAME`・`COMMIT_EMAIL`・`COMMIT_IDENT`・`COMMIT_IDENTITY` | — | `shuko-apply`、`apply@shuko.invalid`、`shuko-apply <apply@shuko.invalid>`、`["-c", "user.name=shuko-apply", "-c", "user.email=apply@shuko.invalid"]` |

`listCommits(cwd, from, to = "HEAD")`（入出力あり）は `from..to` のコミットを古い順に `{ sha, subject, author, committer }` で返す。

### `apply.mjs` から export するもの

| 関数 | 入力 | 出力 |
|---|---|---|
| `parseArgs(argv)` | 引数の配列 | 設定のオブジェクト。誤りは `UsageError` を投げる（`main` が終了コード 2 にする） |
| `loadUnits(dir)` | 単位の置き場所 | `{ units, errors }`（`<dir>/<id>/unit.json` を読み、`validateUnit` の誤りに `<フォルダ>/unit.json: ` を付ける） |
| `listPatches(dir)` | パッチの置き場所 | `*.patch` の名前を、頭の数の順（数が無いものは後ろ、名前の順） |
| `summarizeResult(rec)` | checks.json の値 | `"fail"`（`stoppedAt`・`errors`・どれかの `checks.*.status` が `fail`）、`"hold"`（`hold` がある）、`"ok"` |
| `main(argv)` | 引数の配列 | 終了コード |

### 入出力をもつ部品（テストは作業ツリーの写しで）

- `checks.mjs`: `checkRemnants(worktree, appliedUnits)`、`checkAbsentStrings(worktree, appliedUnits)`、`upstreamExtensionNames(worktree, baseRef)`、`checkUnclassifiedExtensions(worktree, baseRef, keepJson, allUnits)`、`checkUpstreamAdditions(worktree, prevRef, baseRef)`、`checkDependencies(worktree, prevRef, baseRef)`、`checkToolchain(worktree, prevRef, baseRef)`、`readLockManifests(lock, manifestsDir)`、`checkRegisteredKeys({ worktree, baseProduct, overlay, mydistManifest, lock, manifestsDir })`、`checkLockfiles({ worktree, baseRef, units, diffOut })`、`isTestPath(rel)`（純粋。`test/`・`tests/`・`fixtures/` の下か `*.test.ts`）。
- **`checkLockfiles({ worktree, baseRef, units, diffOut })` は `build.mjs` が依存の導入の後に呼ぶ入口**（p2-build-switch）。`units` は当てた単位の unit.json の配列（`checks.json` の `units` の `applied: "ok"` の ID）。返り値 `{ status: "ok" | "fail", files, diff }`。`baseRef` の時点のすべての `pnpm-lock.yaml`（1.146.0 は6つ: ルート・`build/`・`extensions/`・`extensions/copilot/`・`remote/`・`test/sanity/`）を、作業ツリーのものと比べる（行末は比べない）。単位が消したフォルダの中のものは「無いこと」を確かめる。差分は `git diff <baseRef> -- <ロックファイル>` を `diffOut` に書く。CLI からは `--lockfile-check`。
- `git.mjs`、`tree.mjs`（`--dry-run` のためのメモリの上の書き込み、`walkFiles`、`copyTree`、`isTextLike`）。

## 4. 適用後の検査と checks.json の形

```json
{
  "label": "1.146.0-1",
  "worktree": "C:\\b\\wt\\1.146.0",
  "tag": "1.146.0",
  "baseCommit": "<当てる前の HEAD>",
  "headCommit": "<当てた後の HEAD>",
  "prevTag": "1.145.3 | null",
  "dryRun": false,
  "options": { "only": null, "until": null },
  "startedAt": "...", "finishedAt": "...",
  "result": "ok | hold | fail",
  "stoppedAt": null,
  "overlay": { "applied": "ok", "set": [], "removed": [], "removedIfPresent": [], "commit": "..." },
  "units": [
    {
      "id": "A-3-debug-extensions", "order": 130, "enabled": true, "applied": "ok | error | skipped",
      "ops": {
        "commit": "...",
        "deleted": ["extensions/debug-auto-launch"],
        "missingDeletes": [],
        "removedDependencies": [{ "file": "package.json", "name": "...", "section": "dependencies" }],
        "missingDependencies": [],
        "removeLines": [{ "file": "build/npm/dirs.ts", "line": "...", "count": 1, "found": 1, "ok": true }],
        "productRemoved": [], "productMissing": []
      },
      "edits": { "applied": "ok | none | conflict | skipped", "commit": "...", "subject": "unit A-3-debug-extensions: edits", "conflicts": [] }
    }
  ],
  "unitsSkipped": [{ "id": "C-2-debug", "reason": "disabled" }],
  "patches": [{ "file": "patches/10-brand-assets.patch", "applied": "ok | conflict | skipped", "commit": "...", "subject": "...", "conflicts": [] }],
  "assets": { "applied": "ok | none", "copied": [], "commit": "..." },
  "builtinExtensions": { "applied": "ok", "copied": [{ "name": "mydist", "files": 3, "list": [], "removedDefaults": [] }], "removedDefaults": [{ "key": "workbench.startupEditor", "unit": "B-2-onboarding-experiments-surveys" }], "commit": "..." },
  "checks": {
    "remnants":        { "status": "ok | fail | skipped", "items": [{ "unit": "...", "path": "..." }] },
    "absentStrings":   { "status": "ok | fail | skipped", "items": [{ "unit": "...", "text": "...", "in": ["src/vs"], "hits": [{ "file": "...", "line": 12 }] }] },
    "unclassifiedExtensions": { "status": "ok | hold", "items": [{ "name": "...", "highlight": [] }], "nonExtensionDirs": [] },
    "upstreamAdditions": { "status": "info | skipped", "prevTag": "...", "folders": [{ "path": "...", "highlight": [] }], "imports": [{ "file": "...", "line": "...", "highlight": [] }], "extensions": [] },
    "dependencies":    { "status": "info | skipped", "added": [{ "name": "...", "section": "...", "version": "...", "highlight": [] }] },
    "registeredKeys":  { "status": "ok | warn | fail", "product": [{ "key": "...", "status": "upstream | referenced | missing", "foundIn": "..." }], "settings": [{ "key": "...", "from": "mydist", "status": "upstream | extension | lockManifest | unverified | missing", "foundIn": "..." }] },
    "toolchain":       { "status": "info", "nvmrc": { "prev": "...", "now": "24.22.1", "changed": false }, "electron": { "prev": "...", "now": "43.8.6", "changed": false } },
    "lockfile":        { "status": "pending | ok | fail", "files": [] }
  },
  "warnings": ["..."],
  "errors": ["..."]
}
```

| 検査 | 合否 | 中身 |
|---|---|---|
| 当て方の成否 | 誤り → `fail` | `units`・`patches`・`overlay` |
| `remnants`（消え残り） | `fail` | 当てた単位の `delete` のパスがまだある |
| `absentStrings`（参照の残り） | `fail` | 当てた単位の `checks.absentStrings` の `text` が `in`（無ければ `src`・`build`）の下のファイルにある。`kept` のパスの下は除く |
| `unclassifiedExtensions` | `hold`（止めずに保留。docs/06 の4節の4） | 当てる前の `extensions/*`（`package.json` のあるフォルダ）のうち、keep.json にも単位にも無いもの |
| `upstreamAdditions` | `info` | `--prev-tag` から増えた `src/vs/workbench/contrib/*`・`src/vs/workbench/services/*`・`src/vs/platform/*`・`extensions/*` と、`src/vs/workbench/workbench.*.main.ts`（common・desktop・web）と `src/vs/sessions/sessions.*.main.ts`（1.146.0 は common・desktop・web）の増えた import の行（`checks.mjs` の `MAIN_FILES`。docs/03 の6節、2026-11-14 リーダーの判断） |
| `commitIdentity` | `warn` | 当てる前の HEAD から後のすべてのコミットの作者とコミッターが `shuko-apply <apply@shuko.invalid>` か（docs/03 の5.2）。違うもの（edits.patch・patches/ の `From:` が別の名前）は警告。全コミットの一覧は `commits`（`{ sha, subject, author, committer }`）。dry-run では `skipped` |
| `dependencies` | `info` | `--prev-tag` からルートの package.json に増えた依存 |
| `registeredKeys` | `missing`・`unregistered` → `fail`、`unverified` → `warn` | overlay の `set` のキーが、当てる前の product.json にあるか（`upstream`）、当てた後の `src/vs/base/common/product.ts`・`build/`・`src/vs` に語としてあるか（`referenced`）。mydist の既定と `shukoConfigurationDefaults` の設定のキーが、当てた後の `src/vs/**/*.ts` の**設定の登録の形**（4.1）で在るか（`upstream`。`foundIn` は登録のあるファイル）、`extensions/*/package.json` の `contributes.configuration`（`extension`。mydist は除く）か、台帳の拡張の manifest（`lockManifest`）にあるか。どれにも無く、`src/vs` に文字列としてだけ在るものは `unregistered`（`mentionedIn` に文字列のあるファイル。登録を消して読み手だけが残った）。試験のファイル（`isTestPath`）は数えない。manifest が取れない拡張があり、どこにも見つからなければ `unverified` |
| `toolchain` | `info` | `.nvmrc` と Electron の版の、前のタグとの違い。Electron は `package.json` の `nativeBuild.target`、無ければ `.npmrc` の `target`（1.145.3 は `.npmrc` に `43.8.3`、1.146.0 は `nativeBuild.target` に `43.8.6`）。どちらから読んだかを `prevFrom`・`nowFrom` に書く |
| `lockfile` | `fail` | 依存の導入の後に `--lockfile-check`（または `build.mjs` が `checkLockfiles`）で埋める。それまで `pending` |

### 4.1 設定のキーの登録の見分け方と、その限り

本家の設定の登録は、`registerConfiguration` などに渡す `properties` のオブジェクトのキーで書かれる。apply.mjs は、設定の登録の型・関数の名前を含むファイル（`isConfigurationFile`）の中の、次の形のキーだけを「登録」とみなす（`keys.mjs`）。

- 文字列のキー `'a.b': { ... }`（値が識別子のもの `'a.b': schema` も含む）
- 計算されたキー `[X]: ...`・`[E.M]: ...`。`X`・`E.M`・`C.S` を、`src/vs` の `const`・`enum` のメンバー・`static readonly` の定義から文字列に直す（別名 `M = Other.N` も5段までたどる）

1.146.0 で、mydist の既定と `shukoConfigurationDefaults` の設定のキー（本家の src に登録があるもの12件。拡張の5件は別）は、すべて本当の登録のファイルで見つかった（`trial/run6/`。例 `workbench.colorTheme` は `themeConfiguration.ts` の `[ThemeSettings.COLOR_THEME]`、`chat.disableAIFeatures` は `chat.shared.contribution.ts` の `[ChatAIDisabledSettingId]`）。B-7 を当てると、`terminal.integrated.suggest.enabled` は `terminalContribExports.ts` の enum に文字列だけが残り、登録が無いので `unregistered`（`fail`）になった（`trial/b7/`）。前の文字列の有無で見る作りでは、これを `upstream` と誤っていた。

見分けられないもの（ソースを読むだけの見分け方の限り）:

| 誤り方 | 例 | 起きたときの結果 |
|---|---|---|
| 登録を見落とす | キーをテンプレートの文字列（`` `${prefix}.enabled` ``）や関数・繰り返しで作る登録。`const Ids = { A: 'a.b' }` のようなオブジェクトの定数をキーにした登録。`import { X as Y }` の別名。設定の型・関数の名前を含まないファイルに置いた properties | 登録が在るのに `unregistered` か `missing`（`fail`）。安全側に倒れる。起きたら `keys.mjs` に形を足す |
| 登録が無いのに在ると見る | 同じ名前の定数・enum が別のファイルに別の値で在る（名前は全ファイルで共通にたどる）。設定の型を含むファイルの中の、設定でない表（ポリシーや移行の表など）の `'a.b': {` | `upstream`（`ok`）と誤る |
| 読み込まれない登録 | 登録のコードはソースに残っているが、それを読み込む import の行を消した（ファイルは消していない） | `upstream`（`ok`）と誤る。動いている本体で登録されるかは、ソースだけでは分からない |

最後の確かめは、ビルドした本体の動作の確認（スモークの設定の一覧。docs/03 の7節の3・docs/06 の5節）で行う。この検査は、その前に、本家の改名と、登録を消して文字列だけが残った場合を見つけるためのもの。

`result`: どれかが `fail` なら `fail`、そうでなく `unclassifiedExtensions` が `hold` なら `hold`、ほかは `ok`。`lockfile` の `pending` は `ok` とみなす（導入の前なので）。

## 5. 試しの入れ物（曹参が使える）

`tasks/2026-11-13-p2-apply/fixtures/`:

| もの | 中身 |
|---|---|
| `removals/A-1-trial-grunt-jake/` | `delete` 3件（1件は本家に無い → 警告）、`removeLines` 6件（`build/npm/dirs.ts`・`build/gulpfile.extensions.ts`・`extensions/pnpm-workspace.yaml`）、`absentStrings` 2件 |
| `removals/B-1-trial-surveys/` | `after`、`delete`、`removeDependencies`（1件は無い → 警告）、`removeLines` 6件、`productRemove`（1件は無い → 警告）、`kept`、`absentStrings`、`edits.patch`（`0001-unit-B-1-trial-surveys-edits.patch`。残るファイルのコメントの参照を直す） |
| `patches/0001-patch-trial-shukoConfigurationDefaults-type.patch` | `IProductConfiguration` に `shukoConfigurationDefaults` を足す（`registeredKeys` を通すための試し） |
| `removals-bad/` | 止まる例: `A-2-bad-zero`（0行）、`A-3-bad-count`（`count: 2` に1行）、`B-2-bad-conflict`（ops で消した行の隣を edits が直す → `git am -3` が衝突）、`B-3-bad-after`（`after` が `--only` の外） |
| `removals-invalid/A-9-mismatch/` | 形の誤り（id とフォルダ、stage、enabled、`..`、line が無い） |
| `product.overlay.json`、`keep.json`、`assets/` | 試しの overlay（`remove` の1件は本家に無い → 警告、`removeIfPresent` の `voiceWsUrl` は本家にある → 外して警告）、keep（docs/03 の4節の最小の一覧）、assets（直下の README.md は写さない） |

## 変更の記録

- 2026-11-14 初版
- 2026-11-14 overlay の「本家が足したら remove」を `removeIfAdded` から `removeIfPresent` に改めた（p2-units-b の product.overlay.json に合わせた）。実装に合わせて、dry-run の扱い、止めたときの作業ツリー、`--lock`、export する関数、`checkLockfiles` の入口、`toolchain` の `.npmrc` の読み、試験のファイルを数えないこと、試しの入れ物を足した
- 2026-11-14 リーダーの指示で、`upstreamAdditions` の import の比べに `src/vs/sessions/sessions.*.main.ts` を足した。コミットの名前の検査 `commitIdentity` と `commits` の一覧を足した
- 2026-11-14 リーダーの判断（曹参のテストで出た食い違い）: `removeLinesFromText` で最後の行（改行なし）を消しても前の行の改行を消さないように直した。`--until` が無い・無効・`--only` の外の単位を指したら止めることを書いた（実装は前から誤りにしていた）
- 2026-11-14 リーダーの指示（p2-units-b の未解決の4）: 設定のキーの登録を、文字列の有無でなく設定の登録の形（properties のキー）で見るように直した。`unregistered` を足した。見分けられる範囲と限りを4.1 に書いた
- 2026-11-14 リーダーの判断（p2-units-b の追記の未解決1）: mydist を写すとき、当てた単位の `checks.absentSettings` のキーを configurationDefaults から外し、`builtinExtensions.removedDefaults` に記録する（2.6）。`pruneConfigurationDefaults` を足した
- 2026-11-14 大岡越前守の検証の軽微1: `--manifests` の既定を `C:/b/p0/vsix` から `<buildRoot>\cache\vsix` に改め、`--build-root` を足した
- 2026-11-14 リーダーの申し送り（p2-verify-prebuild の追記の2）: `--config <local.json>` を足した（`--build-root` が無いとき buildRoot を読む local.json。既定 `%LOCALAPPDATA%\Shuko\local.json`）。build.mjs は apply と `--lockfile-check` の両方に、自分が決めた `--build-root` と `--config` を渡す（p2-build-switch）

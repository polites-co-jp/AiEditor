# 段階 B の単位・product.overlay.json・既定の設定のパッチ・ブランド（中身と根拠）

- 書いた人: 蒙恬（p2-units-b）。2026-11-14。
- 出典: 本家 1.146.0（commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）の作業ツリー `C:\b\wt\dev-b`（`C:\b\wt\1.146.0` は読むだけで、書き換えていない）。型検査とビルドは走らせていない。参照の残りは `grep` で探した。
- 単位ごとの詳しい中身・残したもの・未確認の点は、各単位の `README.md` にある。ここには全体の判断と、単位をまたぐ点を書く。

## 1. 作ったもの

| 種類 | パス | 中身 |
|---|---|---|
| product.json の上書き | `product.overlay.json` | `set`: 名前・データの置き場所・URL のプロトコル・Windows の識別子（GUID は新しく作った）、`builtInExtensions: []`（A-3。リーダーの指示）、`shukoConfigurationDefaults`。`remove`: 空。`removeIfPresent`: 本家が足したら外すキー11件 |
| 既定の設定のパッチ | `patches/20-product-configuration-defaults.patch` | 案B-2。`configurationRegistry.ts` の登録の直後で `shukoConfigurationDefaults` を既定として登録する（1ファイル7行） |
| 単位 | `removals/B-1-telemetry/` 〜 `removals/B-7-terminal-suggest/` | 各 `unit.json`（`enabled: false`、order 210〜270）、`README.md`、要るものは `edits.patch`（B-1・B-2・B-3・B-7） |
| ブランド | `assets/`（`README.md` と SVG 5個） | 自作の仮のアイコン。PNG・ICO は置き場所と大きさの一覧だけ |
| つなぎの既定 | `extensions-src/mydist/package.json` | `terminal.integrated.suggest.enabled: false` を足した（B-7 が有効になるまで。リーダーの指示） |

## 2. product.overlay.json

- docs/02 の3節の表の「set」の行をそのまま入れた。`win32x64AppId` など4つの GUID は、本家の値と重ならないように新しく作った値（インストーラーは作らないので、重ならないことだけが要件）。本家の書き方（先頭の `{{`）に合わせた。
- `shukoConfigurationDefaults` の `extensions.allowed` は、台帳 `extensions.lock.json` の8件の `id` と `"*": false`。照合は大文字小文字を区別しない（`allowedExtensionsService.ts` 60行が小文字にそろえる）ので、台帳の書き方のまま置いた。
- 単位に結びつくキーは単位の `productRemove` に置いた: `reportIssueUrl`（B-3）、`onboardingKeymaps`・`onboardingThemes`（B-2）。
- 「本家が足したら remove」は `removeIfPresent` に置いた（apply.mjs の担当と名前を合わせた）。docs/02 の表の5件（`enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery`）と、B-6 の2件（`emergencyAlertUrl`・`profileTemplatesUrl`。1.146.0 の OSS の product.json に無い）に加え、同じ趣旨の4件を足した: `appCenter`（クラッシュの報告の送り先。`src/mainImpl.ts` 515行）、`settingsSearchUrl`（設定の検索）、`npsSurveyUrl`（アンケート）、`mcpGallery`（MCP のギャラリー）。足した4件は docs に無いので `doc-corrections.md` に書いた。
- `tasConfig` は 1.146.0 の OSS の product.json に無かった（docs/02 の表は「あれば」）。B-2 の `productRemove` ではなく `removeIfPresent` に置いた。

## 3. 既定の設定のパッチ（案B-2）

- 足した場所: `src/vs/platform/configuration/common/configurationRegistry.ts` の `const configurationRegistry = new ConfigurationRegistry(); Registry.add(...)` の直後。
- 型の補い: `product` を `typeof product & { readonly shukoConfigurationDefaults?: IStringDictionary<unknown> }` に絞る。`src/vs/base/common/product.ts` を直さないので、パッチは1ファイル。`IStringDictionary` と `types` はこのファイルが既に import している。
- `types.isObject` で中身がオブジェクトのときだけ `registerDefaultConfigurations([{ overrides }])` を呼ぶ。`source` を付けない。
- 効き方（ソースで確かめたこと）:
  - 既定は、設定がまだ登録されていなくても `configurationDefaultsOverrides` に入り、後で設定が登録されるときに `updatePropertyDefaultValue`（1114〜1133行）で当たる。モジュールの読み込みのときに登録するので、どの設定の登録よりも先になる。
  - `disallowConfigurationDefault` の印は、対象の6件のどれにも付いていない（`grep`）。オブジェクトの値（`extensions.allowed`）は `source` が空の Map になるが、この印が無ければ関係しない。
  - スコープの検査は拡張の受け口（`configurationExtensionPoint.ts` 217行）にしか無いので、application スコープでも効く。
  - product の中身は main・共有・CLI のプロセスでは `globalThis._VSCODE_PRODUCT_JSON`、画面では preload の設定から読む（`src/vs/platform/product/common/product.ts`）。同じキーが見える見込み（推定。実物で確かめる）。

## 4. 単位の一覧と、docs/03 の表との違い

| 単位 | order | 消すもの（要点） | docs/03 の表との違い |
|---|---|---|---|
| B-1-telemetry | 210 | 1dsAppender 3ファイルを空の実装に差し替え、`contrib/telemetry`・`bracketPairColorizer2Telemetry`・`editTelemetry`（1ファイルを除く）、1DS の依存（ルート・`remote`・`remote/web` の package.json） | `editTelemetry` のうち `aiEditTelemetryService.ts` を残し、空の実装を登録した（拡張 API と chat が注入しているため） |
| B-2-onboarding-experiments-surveys | 220 | `welcomeGettingStarted`・`welcomeWalkthrough`・`welcomeOnboarding`・`surveys`、実験のサービスを空の実装に差し替え、`onboardingKeymaps`・`onboardingThemes` | **`contrib/onboarding` を消していない**（残る部品が import しているため。`doc-corrections.md` の1） |
| B-3-issue-share | 230 | `contrib/issue`（`common/issue.ts` を除く）、`contrib/share/browser`、`reportIssueUrl` | サービスの ID を残して空の実装を登録した |
| B-4-outline-view | 240 | `contrib/outline/browser` のうち `outline.ts` を除く5ファイル | `outline.ts` を残した（ノートブックが import。C-4 まで） |
| B-5-theme-switching | 250 | `contrib/themes/browser`（2ファイル） | 無し |
| B-6-online-feeds | 260 | `contrib/emergencyAlert` | 2つのキーは本家に無いので `removeIfPresent` へ。**部品を消すことを足した**（`doc-corrections.md` の2） |
| B-7-terminal-suggest | 270 | `contrib/terminalContrib/suggest`、設定 `terminal.integrated.suggest.*` | **新しい単位**（リーダーの指示 2026-11-14） |

### 単位どうしの独立（docs/03 の5.3）

- どの単位も `after` は空。B の単位どうし、A の単位と、`edits.patch` が同じファイルを触らない。`workbench.*.main.ts`・`sessions.*.main.ts`・`terminal.all.ts` の行は `removeLines` だけで消した。
- Agents の画面の入口（`src/vs/sessions/sessions.{common,desktop,web}.main.ts`）と `workbench.web.main.ts` も、消した contrib を import していれば `removeLines` に入れた（型検査の対象なので）。
- 部品の見本（`src/vs/workbench/test/browser/componentFixtures/`）が消した部品を import していた所は、1行なら `removeLines`、ファイルごと消した部品だけを見るもの（`aiStats.fixture.ts`）は `delete` にした。

### `edits.patch` の作り方の工夫

- 残すファイルの「サービスの ID」は、ID を定義するファイルに空の実装と `registerSingleton` を足した（B-1 `aiEditTelemetryService.ts`、B-3 `issue.ts`・`share.ts`）。ID を注入する部品が読み込まれれば登録も読み込まれる。新しいファイルに置いて main の import を足す形にすると、main のファイルへのパッチが要るので避けた。
- B-2 の実験のサービスは、新しいファイル `noopAssignmentService.ts` に空の実装を置き、`assignmentService.ts` の末尾の登録の1行を替えた（1か所のハンク）。ファイルごと書き換えると本家の変更のたびに衝突する。TAS の実装のクラスはファイルに残るが作られない。依存 `tas-client` は型の import が残るので消していない。
- パッチの作者は `shuko-apply <apply@shuko.invalid>`（リーダーの指示）。私の許可では `git -c user.name=...` も `--author` も書けない（`<` `>` と、`commit -m` の前の `-c` が止まる）ので、`format-patch --stdout` の出力を写すときに `From:` の行を書き換えた。中身は変えていない（`git am -3` で当てて、元のコミットとの差が無いことを確かめた。`trial-log.md`）。

## 5. B-6 の調べ（emergencyAlertUrl・profileTemplatesUrl・WPAD）

- 2つのキーは 1.146.0 の OSS の product.json に無い。読む部品はどちらも値が無ければ通信しない（`B-6-online-feeds/README.md` の表）。0-5 の `main.vscode-cdn.net` は Microsoft の配布の zip の product.json から来ていて、自前のビルドには同じホストを指すキーが1つも無い（推定。自作のビルドの監査で確かめる）。
- `copilotVersions` は product.json に無くても `product.ts` が package.json から組み立てる（62〜67行）。product.json の上書きでは消せない。C-1 で扱う。
- WPAD: 設定 `http.proxy` も環境変数も無いとき、本体は Electron の proxy を設定しない（`windowImpl.ts` 1263〜1293行）。そのとき Chromium は OS の設定に従い、Windows の「設定を自動的に検出する」が有効なら `wpad` を問い合わせる。止め方の比べ:

| 案 | 効き方 | 影響 | 費用 |
|---|---|---|---|
| 1. Windows の「設定を自動的に検出する」を切る | OS の全アプリ | 社内の WPAD に頼る環境では proxy が見つからなくなる（個人の PC では影響しない見込み） | ユーザーの操作だけ |
| 2. `windowImpl.ts` のパッチで、`http.proxy` も環境変数も無いときに `mode: 'direct'` を入れる | このエディタだけ | OS の手動の proxy の設定も無視する（`http.proxy` を書けば使える） | 小さなパッチ1つ。本家の変更で当たらなくなる恐れは小さい |
| 3. 起動の引数 `--no-proxy-server` | このエディタだけ | `http.proxy` も効かなくなる見込み（推定） | ショートカットの引数。argv.json では渡せない（`src/mainImpl.ts` 252〜267行） |

推奨は 2（エディタだけで閉じ、`http.proxy` で戻せる）。リーダーが 2 を採った（2026-11-14）。実装は9節。git と Claude Code の CLI は別のプロセスで、Chromium の proxy の設定を使わない。

## 6. ブランドの資産

- 自作の SVG を5つ置いた（アプリのアイコン `code-icon.svg`、エディタが空のときの透かし4つ）。図柄は角の丸い四角と `>_`。他者の著作物は使っていない。
- PNG・ICO（実行ファイルのアイコン `resources/win32/code.ico`、スタートメニューのタイル `code_70x70.png`・`code_150x150.png`）は、この作業の道具では作れないので、置き場所と大きさの一覧（`assets/README.md`）にした。置くまでは本家の Code - OSS の汎用のアイコン（Visual Studio Code の商標のロゴとは別）が使われる。

## 7. 未確認（全体）

- 型検査（`compile`）とビルド。とくに各 `edits.patch` の空の実装の型、`assignmentService.ts` の末尾の `import`、B-7 の `const enum` の文字列。
- 起動して、空の実装のサービスが見つかること（`[createInstance] ... depends on UNKNOWN service` が出ないこと）。B-1・B-2・B-3・B-7 の README の「壊れたときの症状」。
- `shukoConfigurationDefaults` が main・共有・CLI のプロセスで効くこと（`update.mode`、`extensions.allowed` の CLI の `--install-extension`）。スモークで既定値を見る項目が要る（曹参）。
- 依存を消した後の `pnpm install` とロックファイルの差分（docs/03 の5.4）。
- 自作のビルドの通信の監査で、`mobile.events.data.microsoft.com`・`default.exp-tas.com`・`main.vscode-cdn.net` が出ないこと（各単位の `absentHosts`）。

## 8. 範囲の外で見つけたもの → リーダーの判断（2026-11-14）で取り込んだ

- `src/vs/workbench/contrib/terminalContrib/telemetry` は B-1 に足した（`delete` と `terminal.all.ts` の1行）。
- `src/vs/workbench/services/suggest` は、本体ではターミナルの入力候補だけが使っていた（ほかは `contrib/modernUI` のテストの CSS の import 1行）ので、B-7 に足した（`delete` と、テストの1行の `removeLines`）。そのテストの一部は本家の単体テストとして落ちる恐れがある（関門には含まない）。

## 9. WPAD（リーダーの判断で案2）

- `patches/30-proxy-direct-without-settings.patch`: `windowImpl.ts` の proxy の設定の処理（`onConfigurationUpdated`）で、起動のとき（設定の変更の知らせが無い初回）に `http.proxy` も proxy の環境変数も無ければ、ウィンドウの session と app を `mode: 'direct'` にする（1か所6行）。`http.proxy` を書いたとき、環境変数があるとき、設定を後から変えたときの動きは本家のまま。
- 単位の `edits.patch` にせず `patches/` に置いた理由: docs/03 の5.3 は、単位のパッチを「自分の単位が消した部品への参照だけを直す」ものに限る。WPAD の止め方は何も消さない振る舞いの変更で、B-6 が消す緊急の知らせとは関係が無い。`patches/` は「削除以外の変更」の置き場所（docs/02 の2節）なので、こちらが合う。B-6 を無効にしても WPAD は止まったまま。
- 未確認: 実物で `wpad` の問い合わせが消えること（自作のビルドの通信の監査）。拡張ホストの proxy の解決（`resolveProxy`）も direct になること。

## 10. PNG・ICO の書き出し

- `scripts/make-icons.mjs`: Node.js の標準の `zlib`・`fs`・`path`・`url` だけで、SVG と同じ意匠を描き、PNG（RGBA、フィルター無し、deflate）と ICO（PNG を格納）を書く。1画素を 8×8（64 px 以下）か 4×4 の点で数えてなめらかにする。時刻などを入れないので、毎回同じバイト列になる。
- 出力: `assets/resources/win32/code.ico`（16・24・32・48・64・128・256、5182 バイト）、`code_70x70.png`（567 バイト）、`code_150x150.png`（1258 バイト）。画像を開いて意匠どおりであることを目で確かめた。
- apply.mjs の assets の写しで、作業ツリーの `resources/win32/` に入ることを確かめた（`trial/checks-no-units.json` の `assets.copied`）。

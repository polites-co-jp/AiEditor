# 資料との食い違い（台帳と mydist を今日の裁定に合わせたときに分かったこと）

- 書いた人: 蒙恬（2026-11-13）。docs/ の書き換えはリーダーが行う。
- 出典のソースは、本家 1.146.0 の作業ツリー `C:\b\wt\1.146.0`（タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。読んだだけで、ビルドも依存の導入もしていない。

## 1. application スコープの設定は、拡張の `configurationDefaults` で既定にできない（docs/04 の6.1 の注、docs/08 の42行）

docs/04 の6.1 の注は「application スコープの設定（`extensions.allowed`）を既定にできるかは未確認」と書く。1.146.0 のソースでは、**できない**。

- `src/vs/workbench/api/common/configurationExtensionPoint.ts` 216〜233行: `configurationDefaults` の各キーについて、登録済みの設定のスコープが `MACHINE_OVERRIDABLE`・`WINDOW`・`RESOURCE`・`LANGUAGE_OVERRIDABLE` のどれでもなければ、"Cannot register configuration defaults for '{0}'. Only defaults for machine-overridable, window, resource and language overridable scoped settings are supported." と警告して、そのキーを捨てる。組み込み拡張を別に扱う分かれ道は無い。
- `ConfigurationScope.APPLICATION` は 1（`src/vs/platform/configuration/common/configurationRegistry.ts` 193〜222行）なので、検査の `registeredPropertyScheme?.scope &&` は真になり、捨てられる。

6.1 の設定のスコープ（1.146.0）:

| 設定 | スコープ | 出典 | `mydist` の既定で効くか |
|---|---|---|---|
| `extensions.allowed` | APPLICATION | `src/vs/platform/extensionManagement/common/extensionManagement.ts` 766行 | 効かない（今の mydist に入っている） |
| `telemetry.telemetryLevel` | APPLICATION | `src/vs/platform/telemetry/common/telemetryService.ts` 349行 | 効かない（今の mydist に入っている） |
| `update.mode` | APPLICATION | `src/vs/platform/update/common/update.config.contribution.ts` 19〜23行 | 効かない（mydist に未記入） |
| `workbench.enableExperiments` | APPLICATION | `src/vs/workbench/services/assignment/common/assignmentService.ts` 653〜657行 | 効かない（mydist に未記入） |
| `extensions.autoUpdate` | APPLICATION | `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts` 138〜147行 | 効かない（mydist に未記入） |
| `extensions.autoCheckUpdates` | APPLICATION | 同 189〜193行 | 効かない（mydist に未記入） |
| `chat.disableAIFeatures` | WINDOW | `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` 2379〜2383行 | 効く |
| `workbench.colorTheme` | 指定なし（window） | `src/vs/workbench/services/themes/common/themeConfiguration.ts` 35〜44行 | 効く |
| `breadcrumbs.enabled` | 指定なし（window） | `src/vs/workbench/browser/parts/editor/breadcrumbs.ts` 127〜131行 | 効く |
| 今回足した4件 | window | `changes.md` の3節 | 効く |

直す案（docs/04 の6.1）:

- 注の「未確認」を、上の事実に置き換える。application スコープの6件は、注が書く逃げ道（product.json の上書きか小さなパッチ）で既定を変えることになる。どちらにするかは Phase 2 の設計の判断で、私は選んでいない。
- docs/08 の42行（0-9 で確かめる項目）は、ソースで答えが出たので閉じてよい。ただし実物で警告が出ることの確認は、Phase 2 の自作のビルドで行う。

## 2. `extensions.autoUpdate` の値は `false` ではなく `"off"`（docs/04 の6.1 の表）

docs/04 の6.1 は `extensions.autoUpdate` / `extensions.autoCheckUpdates` を `false` / `false` と書く。1.146.0 の `extensions.autoUpdate` は `type: 'string'`、`enum: ['on', 'off']`（`extensions.contribution.ts` 138〜146行）。止める値は `"off"`。`extensions.autoCheckUpdates` は boolean で `false` のまま正しい。

## 3. Claude Code の CLI に渡す環境変数の設定は確かめた（docs/04 の6.1 の最後の行）

docs/04 の6.1 は「設定の名前と形は Claude Code の manifest の `configuration` で確かめる（Phase 2）」と書く。確かめた。

- 設定: `claudeCode.environmentVariables`。`type: array`、要素は `{ "name": string, "value": string }`（どちらも必須）、`scope: machine`、`default: []`（Claude Code 2.1.322 の manifest の 36〜58行）。
- mydist の既定に `[{ "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }]` を入れた。
- `machine` スコープは上の1の許可に入らない。起動のときに mydist の既定を検査する時点では Claude Code の設定がまだ登録されていないので、検査を通る見込み（理由は `changes.md` の4節）。この見込みが外れると、拡張ホストのログに "Cannot register configuration defaults for 'claudeCode.environmentVariables'" が出る。Phase 2 の自作のビルドで確かめる。

直す案: 6.1 の最後の行の「設定の名前と形は … 確かめる（Phase 2）」を、上の名前と形に置き換え、「効くことは Phase 2 で確かめる」を残す。

あわせて、次の2点を 6.1 か docs/05 に書いておくことを勧める。

- ユーザー設定（Notion で同期するもの）に `claudeCode.environmentVariables` を書くと、配列は丸ごと置き換わるので、mydist の既定の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` は消える。ユーザー設定で別の変数を足すときは、この1件も一緒に書く。
- この変数で止まらない通信がある（公式の文書。取得日 2026-11-13）: WebFetch の宛先の安全確認（`api.anthropic.com` へホスト名を送る。`skipWebFetchPreflight`）、公式のプラグインのマーケットプレイスの自動登録（`CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`）、ゲートウェイのモデルの発見。前の2つを止めるかは裁定の範囲の外なので、入れていない（`handoff-notes.md` の「未解決の点」）。

## 4. `typescript.disableAutomaticTypeAcquisition` は 1.146.0 で非推奨（docs/04 の6.1 の表）

1.146.0 は「`js/ts.tsserver.automaticTypeAcquisition.enabled` を使う」と表示する（`extensions/typescript-language-features/package.nls.json` 27行）。ただし既定を入れて効くのは古い設定のほう（`changes.md` の3節の注）。6.1 の表の「理由」の欄に、「新しい設定は既定値を読まないので、既定は古い設定に入れる。本家が古い設定を消したら見直す」と足すことを勧める。

## 5. .env の拡張がまだ「未決」のままの箇所（docs/00、docs/08）

`docs/user-decisions.md` の記録（.env の拡張を決めた）、docs/04 の2節、docs/01 の92行は `weixu.wx-vsce-dotenv` に決めたことを書いている。次の2か所は、まだ未決の書き方のまま。

- `docs/00-overview.md` 82行: 「Phase 0 で `dotenv.dotenv-vscode` と `weixu.wx-vsce-dotenv` を試し、エラー表示を持つほうを採る」
- `docs/08-risks-and-open-items.md` 75行: 同じ文

直す案: 「2026-11-13 に `weixu.wx-vsce-dotenv` に決めた（`docs/user-decisions.md` の記録）」として閉じる。

## 6. docs/04 の6.1 の表にあって、mydist に入っていない設定

`workbench.startupEditor: none`、`workbench.enableExperiments: false`、`extensions.autoUpdate`、`extensions.autoCheckUpdates: false`、`update.mode: none` は 6.1 の表にあるが、`extensions-src/mydist/package.json` には入っていない（Phase 0 の 0-9 の試作は5項目だけで作った）。

- `workbench.startupEditor` だけが拡張の既定で効く見込み（`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts` 298〜299行。`ConfigurationScope.RESOURCE`）。
- 残りの4件は1のとおり効かない。

今回の依頼の範囲の外なので足していない。足すかどうか、application スコープの4件を product.json かパッチのどちらで扱うかは、リーダーの判断を仰ぐ。

→ 済み（リーダーの追加の依頼）: `workbench.startupEditor: "none"` を足した。application スコープの件は `app-scope-options.md` に書いた。

## 7. 追記（リーダーの追加の依頼の後）: docs/04 の5節の `extensions.allowed`

docs/04 の5節の最後の項目（103行）は、まだ「`extensions.allowed` を `mydist` の既定で `{"*": false, ...}` にする」と書いている。また「`configurationDefaults` で既定にできるかは未確認」とも書いている。

- 6.1 の注のとおり、mydist の既定ではできない。
- mydist からは 2026-11-13 に外した。

直す案: 5節の該当の文を、「既定にする方法は Phase 2 の初めに決める（`app-scope-options.md`）」に置き換える。同じ項目にある次の点は残してよい。

- ID だけを載せて版は台帳で固定する、という考え方
- VSIX の手動インストールにも効く、という一次の出典の記述

## 8. 追記: docs/02 の3節（product.json の上書き）

`app-scope-options.md` の推奨の1をとるなら、docs/02 の3節の表に次の4つを足す。いずれも、本家の OSS の product.json に入ったら remove するか止めるキーとして扱う。

- `enableTelemetry`
- `aiConfig`
- `updateUrl`
- `extensionsGallery`

`tasConfig` はすでに表にある。71行は「これらは足さない」と書くだけで、本家が足したときの扱いは書いていない。

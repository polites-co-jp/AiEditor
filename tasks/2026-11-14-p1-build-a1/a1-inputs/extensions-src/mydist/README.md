# mydist

Shuko の既定の設定とキー割り当てを持つ、コードの無い組み込み拡張（docs/04 の6節）。`main` を持たず、`package.json` の宣言だけで働く。

- `contributes.configurationDefaults`: 既定の設定（docs/04 の6.1）。`chat.disableAIFeatures`、`workbench.colorTheme`、`breadcrumbs.enabled`、`workbench.startupEditor: "none"` と、下に書いた項目。
  - 入れられるのは machine-overridable・window・resource・language-overridable のスコープの設定だけ。application スコープの設定は、本体が警告を出して捨てる（本家 1.146.0 の `src/vs/workbench/api/common/configurationExtensionPoint.ts` 216〜233行）。そのため 6.1 の表のうち `extensions.allowed`・`telemetry.telemetryLevel`・`update.mode`・`workbench.enableExperiments`・`extensions.autoUpdate`・`extensions.autoCheckUpdates` はここに書かない（Phase 0 の試作にあった `extensions.allowed` と `telemetry.telemetryLevel` は 2026-11-13 に外した）。既定を変える方法は `tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md`。
  - `basedpyright.importStrategy`: 裁定（2026-11-13、`docs/user-decisions.md` の「basedpyright が Python 拡張なしで起動しない件」）。basedpyright 1.40.2 は既定の `fromEnvironment` では Python 拡張（`ms-python.python`）の API を求め、無いと起動しない。台帳に Python 拡張は入れず、同梱の言語サーバーを使う（調べ: `tasks/2026-11-13-p0-basedpyright-probe/basedpyright-probe.md`）。
  - 不要な通信を止める4件（裁定 2026-11-13 の「通信の扱いの訂正」、棚卸し `records/phase0/network-inventory.md` の4節）: `typescript.disableAutomaticTypeAcquisition: true`、`npm.fetchOnlinePackageInfo: false`、`json.schemaDownload.enable: false`、`workbench.settings.enableNaturalLanguageSearch: false`。
    - 型定義の自動取得は、1.146.0 では新しい設定 `js/ts.tsserver.automaticTypeAcquisition.enabled` が先に読まれるが、ユーザーかワークスペースが値を書いたときだけ（既定値は見ない）。書いていなければ古い `typescript.disableAutomaticTypeAcquisition` を既定値ごと読むので、既定を入れるのは古いほう（`extensions/typescript-language-features/src/configuration/configuration.ts` の `readDisableAutomaticTypeAcquisition`、`src/utils/configuration.ts` の `readUnifiedConfig`）。
  - `claudeCode.environmentVariables`: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`（裁定 2026-11-13、「0-5 の棚卸しの後」）と `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1`（同じ裁定へのリーダーの当てはめ。`docs/user-decisions.md` の「CLI の付帯の通信の裁定の当てはめ」）。Claude Code の拡張が起動する CLI にだけ渡す。普段のターミナルの `claude` には効かない。設定の名前と形は Claude Code 2.1.322 の manifest の `contributes.configuration`（`type: array`、要素は `{ name, value }`、`scope: machine`）。machine スコープなので、既定が効くのは起動の処理の順による見込み（Phase 2 で確かめる）。ユーザー設定にこの配列を書くと丸ごと置き換わる。
- `contributes.keybindings`: Sublime Text のキー割り当て（docs/04 の6.2）。`node scripts/convert-sublime-keys.mjs --apply` が書く。手で直さない。

## キー割り当ての元

- 元: `ms-vscode.sublime-keybindings` 4.1.10（Open VSX、SHA-256 `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`）。https://github.com/microsoft/vscode-sublime-keybindings
- ライセンス: MIT。著作権表示と許諾文は `ThirdPartyNotices.txt`（変換の台本が元の VSIX の `LICENSE.md` から写す）。
- 変換の規則: Windows 向けのキー（`win` があればそれ、無ければ `key`）と `command`・`when`・`args` を残す。キーが `none` の項目、知らない修飾キーを含む項目（元の書き誤り `ctr+shift+[`）、消した機能のコマンドを指す項目は落とす（`scripts/lib/sublime-keys.mjs`）。

# mydist

Shuko の既定の設定とキー割り当てを持つ、コードの無い組み込み拡張（docs/04 の6節）。`main` を持たず、`package.json` の宣言だけで働く。

- `contributes.configurationDefaults`: 既定の設定（docs/04 の6.1）。Phase 0 の試作（0-9）の5項目（`chat.disableAIFeatures`、`telemetry.telemetryLevel`、`workbench.colorTheme`、`extensions.allowed`、`breadcrumbs.enabled`）と、`basedpyright.importStrategy: "useBundled"`。
  - `basedpyright.importStrategy`: 裁定（2026-11-13、`docs/user-decisions.md` の「basedpyright が Python 拡張なしで起動しない件」）。basedpyright 1.40.2 は既定の `fromEnvironment` では Python 拡張（`ms-python.python`）の API を求め、無いと起動しない。台帳に Python 拡張は入れず、同梱の言語サーバーを使う（調べ: `tasks/2026-11-13-p0-basedpyright-probe/basedpyright-probe.md`）。
- `contributes.keybindings`: Sublime Text のキー割り当て（docs/04 の6.2）。`node scripts/convert-sublime-keys.mjs --apply` が書く。手で直さない。

## キー割り当ての元

- 元: `ms-vscode.sublime-keybindings` 4.1.10（Open VSX、SHA-256 `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`）。https://github.com/microsoft/vscode-sublime-keybindings
- ライセンス: MIT。著作権表示と許諾文は `ThirdPartyNotices.txt`（変換の台本が元の VSIX の `LICENSE.md` から写す）。
- 変換の規則: Windows 向けのキー（`win` があればそれ、無ければ `key`）と `command`・`when`・`args` を残す。キーが `none` の項目、知らない修飾キーを含む項目（元の書き誤り `ctr+shift+[`）、消した機能のコマンドを指す項目は落とす（`scripts/lib/sublime-keys.mjs`）。

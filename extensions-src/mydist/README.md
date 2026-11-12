# mydist

Shuko の既定の設定とキー割り当てを持つ、コードの無い組み込み拡張（docs/04 の6節）。`main` を持たず、`package.json` の宣言だけで働く。

- `contributes.configurationDefaults`: 既定の設定（docs/04 の6.1）。Phase 0 の試作（0-9）では5項目だけ（`chat.disableAIFeatures`、`telemetry.telemetryLevel`、`workbench.colorTheme`、`extensions.allowed`、`breadcrumbs.enabled`）。
- `contributes.keybindings`: Sublime Text のキー割り当て（docs/04 の6.2）。`node scripts/convert-sublime-keys.mjs --apply` が書く。手で直さない。

## キー割り当ての元

- 元: `ms-vscode.sublime-keybindings` 4.1.10（Open VSX、SHA-256 `fe064eb9f0b83466ede5ed1c7b1a8289b11af8abba82005f7187d571fdb26a34`）。https://github.com/microsoft/vscode-sublime-keybindings
- ライセンス: MIT。著作権表示と許諾文は `ThirdPartyNotices.txt`（変換の台本が元の VSIX の `LICENSE.md` から写す）。
- 変換の規則: Windows 向けのキー（`win` があればそれ、無ければ `key`）と `command`・`when`・`args` を残す。キーが `none` の項目、知らない修飾キーを含む項目（元の書き誤り `ctr+shift+[`）、消した機能のコマンドを指す項目は落とす（`scripts/lib/sublime-keys.mjs`）。

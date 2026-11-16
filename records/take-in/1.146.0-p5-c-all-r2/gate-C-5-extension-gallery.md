# 関門: C-5-extension-gallery（版 `1.146.0-p5-c-all-r2`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r2.md`
- 判定: **自動の関門は合格**（1〜4 で C-5 の誤りは見つからない）。画面からの導入が消えていることと拡張のビューの操作は、手の項目 C9〜C11 で見る。版としては C-1 の誤りで不合格

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c5-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c5-check-worktree.mjs tmp/b/wt-r2/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の25項目（コマンド17・ビュー6・設定2）が pass。公式の版では25とも在る。**通信の監査（2通り×600秒）で、ギャラリーのホスト（`marketplace.visualstudio.com`・`open-vsx.org`・`gallery.vsassets.io` など）への接続も名前の問い合わせも無い**。出力の product.json に `extensionsGallery` は無い |
| 4 壊れていない | C-5 の分は合格。**CLI の `--install-extension`（台帳の道。最重要）**: 起動の確かめで7つの VSIX が終了コード 0・`successfully installed`、スモークの3回で台帳の8つ（Claude Code を含む）が入った（`base.ext-install` PASS）。入れた拡張は3回とも起動した。`depends on UNKNOWN service`（おすすめ・tips・ギャラリーのアカウントの5つ）は無い。共有プロセスのログは空。残すコマンド（`workbench.view.extensions`・`workbench.extensions.command.installFromVSIX`・`workbench.extensions.installExtension`・`workbench.extensions.uninstallExtension`・`workbench.extensions.action.disableAll`・`workbench.action.showRuntimeExtensions`）は登録されている |

手の項目: 拡張のビューの一覧・有効と無効・詳細（C9）、VSIX の右クリック・`ext install`・「VSIX からのインストール」が無いこと（C10）、動作中の拡張の一覧（C11）。

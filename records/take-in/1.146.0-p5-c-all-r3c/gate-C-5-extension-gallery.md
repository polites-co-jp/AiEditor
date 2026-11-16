# 関門: C-5-extension-gallery（版 `1.146.0-p5-c-all-r3c`）

- 検証: 大岡越前守、2026-11-16。全体の記録: `gate-p5-c-all-r3c.md`
- 判定: **合格**（自動で見られる関門 1〜4）。手の項目 C9〜C11 が残る

| 関門 | 結果 |
|---|---|
| 1 当たる | 合格。`node tests/c5-check-json.mjs <checks.json>` は「期待どおり（組 c）」、`node tests/c5-check-worktree.mjs tmp/b/wt-r3c/1.146.0` も「期待どおり」 |
| 2 型検査とビルド | 合格 |
| 3 消えている | 合格。absent の25項目が pass。監査2通りで、ギャラリーのホストへの接続も名前の問い合わせも無い（全体の記録の3節） |
| 4 壊れていない | 合格。**CLI の `--install-extension`**: 起動の確かめで7つの VSIX が成功、スモークの3回で台帳の8つ（Claude Code を含む）が入った。入れた拡張は3回とも起動した。`depends on UNKNOWN service`（おすすめ・tips・ギャラリーのアカウント）は無い |

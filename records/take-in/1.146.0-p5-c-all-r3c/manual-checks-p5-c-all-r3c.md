# 手で確かめる項目（段階 C をまとめた版 `1.146.0-p5-c-all-r3c`）

- 作成: 大岡越前守、2026-11-16
- 相手: `tmp\b\p2\1.146.0-p5-c-all-r3c\Shuko-win32-x64-1.146.0-p5-c-all-r3c\`（commit `827a712b`）
- 手順の本体: `records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`（p2-all の 1〜14 と C1〜C21）。版の名前と場所を r3c に読み替える
  - 前半の起動: `node tests/smoke-launch.mjs --build E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r3c/Shuko-win32-x64-1.146.0-p5-c-all-r3c --label manual-p5r3c --mode built`
  - 後半の監査: `-Exe` を r3c の `Shuko.exe`、`-Label` を `p5r3c-manual-claude`、`-Previous` を `records/network-audits/2026-11-16-p5r3c-ledger` にする
- 自動の関門の結果: `gate-p5-c-all-r3c.md`（同じフォルダ）

## r3c で足す項目

| # | 単位 | 見るもの | やること | 合格の目安 |
|---|---|---|---|---|
| C22 | C-1 | 統合ブラウザ | コマンドパレットで「ブラウザー: 開く」（`workbench.action.browser.open`）を実行し、URL の欄に `about:blank` を入れる（外のサイトは開かない）。閉じる | 誤りの通知が出ずに開いて閉じられる。r3c で蒙恬が `IAgentNetworkFilterService` の登録を足した所で、スモークはここを通らない |

## r2 の項目のうち、r3c で自動で見られたもの

次の3つは、r2 で誤りが出た道。r3c のスモークの3回で同じ道を通り、誤りが出なかった（`gate-p5-c-all-r3c.md` の4節）。画面の見え方の確かめとして残す。

- C7（検索の欄に打つ）: 欄の値が変わったときの聞き手（`onSearchInputChanged` → `submitSearch`）で誤りが出ない
- C21（ターミナルのタブの一覧）: ターミナルを作ったときのタブのビューの作成（`_createTabsView`）で誤りが出ない
- 13（差分ビューで採否）の前の git のステージ・コミット: `_chat.editSessions.accept` の誤りが出ない

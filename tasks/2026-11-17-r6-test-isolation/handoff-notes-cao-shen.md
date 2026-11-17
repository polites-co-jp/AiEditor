# 引き継ぎ（曹参、T3）

## 直した所（テストのみ。scripts/ は触っていない）

- `tests/configure.test.mjs` 187行あたり「-InstallRoot: the value is written as the user gave it」
  - 走らせる前に一時の `local.json` へ `{installRoot: <root>\OldPct, keepVersions: 3}` を書く。前の installRoot が一時の場所になり、本物の `%LOCALAPPDATA%\Programs\Shuko` を見ない。`%NAME%` を展開しない確認と resolved の確認はそのまま。
- `tests/move-off-c.test.mjs` 92行あたり「PowerShell 側の部品…既定も同じ」
  - 走らせる前に一時の `local.json` へ `{installRoot: <sb>\old-inst}` を書く。
  - 副作用: ファイルが既にあると configure.ps1 は buildRoot を書き足さない。そのため buildRoot はファイルからでなく、出力 JSON の `resolved.buildRoot` から読む形にした（`parseJsonOut` を import に追加）。確かめる内容（PowerShell 側の既定 = NEW_DEFAULT）は同じ。

## 走らせたテストと結果

- `node --test tests/configure.test.mjs`: 17 件 通過、0 件 落ち
- `node --test tests/move-off-c.test.mjs`: 26 件 通過、0 件 落ち（途中、buildRoot をファイルから読んで1件落ちたので上のとおり直した）

## 未確認・注意

- 日常の Shuko を閉じていない。ただし、走らせた時に Shuko が動いていたかは、許可された Bash ではプロセスを調べられず、確かめられなかった。動いている状態での確認は、リーダーか大岡越前守が行ってほしい。
- テストは前の installRoot を一時の場所にしたので、本物の置き場所を読まない・書かない作りになっている（`-ConfigPath` と `-NoShellIntegration` は元から付いている）。
- `node --test tests/*.test.mjs` の一括実行は、この環境のフックに止められた（コマンドの形の問題）。個別ファイルで実行した。

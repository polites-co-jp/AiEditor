# 移行の後に見る項目（版 `1.146.0-p5-c-all-r7`）

- 作成: 大岡越前守、2026-11-19（関門の記録 `gate-p5-c-all-r7.md` の付け）
- 前提: 権限の段1が入り、`rename-plan.md`（`tasks/2026-11-18-rename-sukuna-survey/`）の3.3の手順1〜7が済んだ後。課が `switch.ps1` で r7 を `%LOCALAPPDATA%\Programs\Sukuna` に入れ、移行の台本でユーザーのデータを写し、`install-extensions.mjs` で台帳の7つを入れた後。
- 自動の関門では見られなかった所だけを挙げる。
- 日常の Shuko は r4（`1.146.0-1`）のままで、r6 には入れ替わっていない（`docs/user-decisions.md` の「裁定（2026-11-18、改名の権限）」の前の事実）。そのため r6 の手の項目（`records/take-in/1.146.0-p5-c-all-r6/manual-checks-p5-c-all-r6.md` の J1〜J10・I1〜I5。組み込みの日本語パックとアイコン A）は、まだ誰も見ていない。r7 で初めて見る項目として、下の U9・U10 に入れた。前の版の手の項目 C1〜C22（r2・r3c の記録）も、名前を Sukuna に読み替えて残る。

## 課が先に確かめること（画面の前）

| # | 何を | 合格の形 |
|---|---|---|
| K1 | `sukuna --version`（PATH を足した後。足す前なら `%LOCALAPPDATA%\Programs\Sukuna\current\bin\sukuna.cmd --version`） | `1.146.0`・`b76374c6fc633747549a7b1a44a1a5364c7fe8f2`・`x64` |
| K2 | 移行の台本の本番の後、Sukuna を初めて起動する前の `%APPDATA%\Sukuna` | 台本が写したものだけがある（`Cache`・`logs`・`languagepacks.json` など除くものが無い）。`User\globalStorage\sukuna.notion-sync\` があり、`shuko.notion-sync\` が無い |
| K3 | Sukuna を1回起動した後の `%APPDATA%\Sukuna\languagepacks.json` の `ja` | `extensions` が `sukuna.language-pack-ja`（1.146.0）と `sukuna.notion-sync`（0.0.1）。`translations.vscode` が `<installRoot>\versions\<ラベル>\resources\app\extensions\language-pack-ja\dist\translations\main.i18n.json`、`translations["sukuna.notion-sync"]` が同じ版の `extensions\notion-sync\dist\i18n\sukuna.notion-sync.ja.i18n.json`。`shuko.*` と古いパック（`MS-CEINTL.vscode-language-pack-ja`）が無い |
| K4 | `install-extensions.mjs` の結果 | `result: ok`、`compare.extra` が空。拡張は `%USERPROFILE%\.sukuna\extensions` に入る（`%USERPROFILE%\.shuko\extensions` は変わらない。r4 で入れた古い日本語パックはそちらに残るが、Sukuna は読まない） |
| K5 | `%USERPROFILE%\.sukuna\argv.json` | 移行の台本が写したもので、手で足した項目が残り、`locale` が `ja` |
| K6 | 入れた版に曹参の網を当てる: `node tests/l10n-audit.mjs --app <installRoot>\versions\<ラベル>\resources\app --pack <同じ>\resources\app\extensions\language-pack-ja --worktree tmp/b/wt/r7/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle` | 終了コード 0、除外の外の未訳 0（関門の結果と同じ） |
| K7 | 移行の後も日常の Shuko の場所が変わっていない | `%APPDATA%\Shuko`・`%USERPROFILE%\.shuko`・`%LOCALAPPDATA%\Shuko`・`%LOCALAPPDATA%\Programs\Shuko` は、移行の台本の前と同じ（台本は元の場所に書かない。引退はユーザーの答えの後） |
| K8 | 普通の形で初めて起動した後の URL の登録 | `HKCU\Software\Classes\sukuna` ができる（関門の起動はすべてポータブルの形なので、登録はしていない見込み）。`HKCU\Software\Classes\shuko` は引退まで残る |

## ユーザーが画面で見ること

Sukuna は2回起動する（言語パックの一覧は起動のたびに作り直され、日本語になるのは2回目からの見込み）。

| # | 見る所 | 合格の形 |
|---|---|---|
| U1 | スタート メニューの「Sukuna」から起動する | 起動する。タスク バーで右クリックすると「新しいウィンドウ」（英語なら「New Window」）が出る（AppUserModelID `Sukuna.Editor` とショートカットの ID が合っている） |
| U2 | タスク バーにピン留めし直す | 古い「Shuko」のピン留めとは別のアイコンとして並ぶ（ID が変わったため）。ピン留めした Sukuna から起動すると、同じボタンにまとまる |
| U3 | ヘルプ → バージョン情報 | 題が「Sukuna」、コミットが `b76374c6…`。`Shuko` の文字が無い |
| U4 | ウィンドウの題名 | 末尾が「Sukuna」 |
| U5 | 拡張機能の画面の組み込みの一覧 | 「Sukuna の既定」「Sukuna Notion 同期」「Sukuna 日本語パック」の名前で出る |
| U6 | エクスプローラーで `Sukuna.exe` を右クリック → プロパティ → 詳細 | 「ファイルの説明」「製品名」が `Sukuna`（関門の自動の照らしは、実行ファイルの中の UTF-16 の文字列を見られなかった。関門の記録の3節の注） |
| U7 | notion-sync | コマンド「Notion 同期: トークンを設定」でトークンを入れ直し、「差分を見る」が動く（拡張の ID が `sukuna.notion-sync` に変わり、古いトークンは見えないため。`rename-plan.md` の3.2） |
| U8 | Claude Code のパネル | 開いて動く。拡張の秘密（ログイン）が引き継げていなければ、ログインし直す |
| U9 | 日本語の表示（r6 の J1〜J10。名前は Sukuna に読み替える） | r6 の表の合格の形のとおり。英語のまま残る所があれば場所を書き留める |
| U10 | アイコン（r6 の I1〜I5。`Shuko.exe` は `Sukuna.exe` に読み替える） | A「中央に印」の意匠（r7 の `code.ico` などは r6 と同じバイト列。関門の記録の3節）。スタート メニューは新しい `Sukuna.lnk` なので、古いアイコンの覚えは残らない見込み |

## 戻すとき

日常の Shuko は消さずに残してあるので、スタート メニューの「Shuko」から起動するだけで戻れる（`rename-plan.md` の3.1）。Sukuna の場所（`%LOCALAPPDATA%\Programs\Sukuna`・`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna`）を消すのはユーザー（課の削除の許可の外）。

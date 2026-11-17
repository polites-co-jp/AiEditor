# 権限の変更の依頼（AiEditor 課 → Team の開発部）: 拡張を外す許可

- 作成: ヴラド・ツェペシュ（2026-11-17）
- 承認: ユーザー（2026-11-17 の問いで「蒙恬に許可を足す（推奨）」。`docs/user-decisions.md` の「裁定（2026-11-17、アイコンの意匠と古い日本語パックの外し方）」）

## 1. 蒙恬に、日常の Shuko から拡張を外す許可

| 欄 | 足すもの | 何のため |
|---|---|---|
| bash（前方一致） | 日常の Shuko の CLI で拡張を外す行。`C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --uninstall-extension ` の後に拡張の ID が続く形（`installRoot` は `%LOCALAPPDATA%\Programs\Shuko`。`local.json` の既定） | (1) 今回: 日本語化（裁定 2026-11-17「未訳を残さず日本語にする」）で、Open VSX の `MS-CEINTL.vscode-language-pack-ja` 1.131.0 を、組み込みの自前のパック `shuko.language-pack-ja` に置き換えた。古いパックが入ったままだと、後から読むユーザーの拡張が勝って古い訳に戻り、`install-extensions.mjs` も「台帳に無い拡張」として終了コード 3 で止まる。版の入れ替えは課が行う（裁定 2026-11-16）ので、入れ替えのときに蒙恬が外す。(2) これから: 拡張の追加と取り外しは、ユーザーが課に代行を頼む（裁定 2026-11-17。`docs/04-bundled-extensions.md` の8節）。外す依頼のときにも使う |

- 範囲: `--uninstall-extension <ID>` だけ。`--extensions-dir`・`--user-data-dir` などの別の置き場所を指す引数は要らない（一時の置き場所の試しは、その置き場所ごと作り直すため）。ほかの CLI の操作（`--install-extension` は `install-extensions.mjs` が打つ）は今のまま。
- 書き方（前方一致の行、`installRoot` を決め打ちにするか、`shuko` だけの形にするか、`bash_exact` で ID ごとにするか）は開発部に任せる。課の台帳の「塞いでいない穴」（台本を通せば許可の外も消せる）は、外す処理を台本に入れないことで守る。
- 外した後は、`%APPDATA%\Shuko\languagepacks.json` の `ja` が新しいパックを指すことを確かめる（読むだけ。蒙恬の `read_paths` に `%APPDATA%\Shuko\` が無いので、あわせて足してほしい。2026-11-17 の蒙恬の報告で確かめた）。

## 2. 知らせ

- 許可が入るまで、課は版の入れ替えを待つ。アイコンと日本語パックを入れた版のビルドと検証は先に進める。

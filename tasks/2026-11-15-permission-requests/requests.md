# 権限の追加の依頼（AiEditor 課 → Team の開発部）

- 作成: ヴラド・ツェペシュ（2026-11-15）
- 承認: ユーザー（2026-11-15「片づけ」の問いで「許可を足して任せる」。下の 1。2〜5 は、これまでの作業で要ると分かったもの。足すかどうかはユーザーが決める）
- 書き換える場所: `team/departments/development/<id>/permissions.json` と `.claude/agents/<id>.md` の `tools`。AiEditor 課のメンバーとリーダーは書き換えない（`CLAUDE.md`）

## 1. 古い版の片づけ（蒙恬）— ユーザーが承認済み

- 何のため: 関門が済んだ版の、展開したもの（`C:\b\p2\` の下。約 24 GB）・zip（`C:\b\dist\`。約 8 GB）・スモークの拡張のフォルダ（`C:\b\smoke\ext\` の下に43個）を消して、C: の空きを戻す（今は約 21 GB）。段階 C の作業ツリーとビルドに要る。毎週の取り込みでも、古い版を片づけるのに使う。
- 要るもの（案。書き方は開発部に任せる）: 蒙恬の Bash に、次の3か所の下だけを消すコマンド。
  - `C:/b/p2/*`
  - `C:/b/dist/*`
  - `C:/b/smoke/ext/*`
- 残すもの: 全部を有効にした版 `1.146.0-p2-all`（展開したものと zip）、Phase 1 の記録に使った `1.146.0-p1-a1-r3`。消した版は、常設の clone の枝 `builds/<label>` から作り直せる。

## 2. 検証役の確かめ（大岡越前守）

| 要るもの | 何のため |
|---|---|
| `git -C C:/b/wt/* status`、`git -C C:/b/wt/* diff` | 版の作業ツリーで、当てた単位の範囲の外の変更が無いことと、版どうしのソースの差を、記録によらず直接確かめる |
| `node scripts/disk-usage.mjs` | 「C: の空きが 15 GB を切りそうなら止める」の指示を守るため、空きを測る |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1`・`scripts/check-env.ps1`・`scripts/p1-launch-check.ps1` | Code Integrity のイベント（ネイティブのモジュールが止められていないか）と環境の状態を読む。zip を新しく展開して関門を始める |
| 読める場所: `%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` の**有無と更新時刻だけ** | 普段使いのエディタのデータに触れていないことを、記録によらず確かめる（中身は読まない） |

## 3. 作った人の自己確認（蒙恬）

| 要るもの | 何のため |
|---|---|
| `node --test tests/*.test.mjs` | 直した台本が曹参のテストを通るかを、検証に回す前に確かめる（今は検証役だけが走らせられる） |

## 4. 報告の受け渡し（全員）

| 要るもの | 何のため |
|---|---|
| `SubagentHandback`（蒙恬・曹参・大岡越前守の `tools`） | 今は許可のフックに「定義の tools に無いツール」として止められ、報告がリーダーに届かない。報告はファイル（handoff-notes.md）で受け取っているので、急ぎではない |

## 5. 確かめておいてほしいこと

- スモークのときに、Claude Code の CLI がユーザーの `C:\Users\kou_z\.claude\projects\` の下に、作業用フォルダの名前の項目を作っている見込み（検証役は読めないので未確認）。消してよいかはユーザーが決める。

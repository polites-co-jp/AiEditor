# 引き継ぎ: r7 の関門の指摘 T1・T2 のテストの直し（曹参）

## 直した場所

### T1: tests/l10n-audit-more.test.mjs
- 実物の既定を、`tmp/b/p2/<版>/<名前>-win32-x64-<版>/resources/app` のうち、版の末尾 `-rN` が最大のものにした（関数 `latestReal()`。最新の版を決め打ちしない。`p2` の直下の名前だけを読む）。
- 作業ツリーの既定は `tmp/b/wt/rN/w`（実際の置き方）。環境変数 `AIED_AUDIT_APP`・`AIED_AUDIT_WT` は従来どおり優先。
- 実物のテストの題は `最新の版（<版>）` と版の名前が入る。飛ぶ理由の文にも版と作業ツリーのパスが入る。冒頭と周りの「r4」の説明も直した。
- 古いパックの1件は `AIED_AUDIT_OLD_PACK` が無いので従来どおり skip（変更なし）。

### T2: tests/smoke/lib/run.mjs（と tests/smoke.test.mjs）
- `dailyWatchTargets(product, home, appData)` を足した（export）。見る場所は、`~/.vscode/argv.json`・`~/.vscode-oss/argv.json`（キー `vscode`・`vscodeOss` は従来どおり）に加えて、
  - `~/<dataFolderName>`（フォルダ）と その `argv.json`
  - `%APPDATA%\<nameLong>`（フォルダ）
  - 旧の名前（`.shu`+`ko`、`Shu`+`ko` と組み立てて書く）の同じ3つ
- 名前は `editor.productJson`（版の product.json。overlay を当てた後の実物）から求める。決め打ちなし。APPDATA が無ければ APPDATA の場所は外す。重複は数えない。
- `dailyArgvState(product, home, appData)` は上の一覧を stat する（引数の形が変わった。呼び出しは run.mjs の2か所だけで直した）。
- `safety.daily-argv` の題と詳細の文を、見る場所に合わせて直した。
- 単体のテストを2件足した（smoke.test.mjs）。名前の求め方（`.sukuna`・別の名前・`.vscode` と同じ版・APPDATA 無し）と、一時のフォルダだけを使って、作られたフォルダ・argv.json・旧の名前の場所を差として見つけること。日常の場所には何も作っていない。

## 流した結果
- `node --test tests/l10n-audit-more.test.mjs`: 42 件、pass 41、fail 0、skip 1（古いパック。環境変数なし）。実物の3件は環境変数なしで走って通った（版 1.146.0-p5-c-all-r7、`tmp/b/wt/r7/w`）。
- `node --test tests/smoke.test.mjs tests/rename-leftovers.test.mjs`: 87 件、pass 86、fail 1。落ちたのは既知の `.claude/agents/vlad-tepes.md` の1件（Team の開発部待ち。今回の変更と無関係）。rename-leftovers の「除く場所の外」は通った（旧の名前は組み立てて書いた）。
- スモークの台本そのもの（エディタを起動する実行）は流していない。

## 気づいた点
- T3 と同じ理由で、日常の Sukuna が動いていると `%APPDATA%\Sukuna`・`~/.sukuna` が変わり、`safety.daily-argv` が FAIL になりうる（詳細に「日常のエディタが同時に動いていないかも見る」と出る）。移行の後にスモークを流すときは、日常の Sukuna を止めておく必要がある。
- フォルダの変わりは stat の mtime で見ている。`~/.sukuna` の中の別ファイルの更新は、直下の追加・削除でなければ検知しない（argv.json は別に見る）。

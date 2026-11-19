# r7（改名の後の版）の関門: 見た項目・結果・指摘・移行の前に気をつける点

- 担当: 大岡越前守、2026-11-19
- 依頼: `brief.md`（このフォルダ）
- 関門の記録（正本）: `records/take-in/1.146.0-p5-c-all-r7/gate-p5-c-all-r7.md`。ここには、要点と、このフォルダに置いたものの一覧を書く。

## 判定

**合格**。版 `1.146.0-p5-c-all-r7`（zip の SHA-256 `5b7ea885…51d1`、版の commit `b76374c6…`）を、日常の利用へ移してよい。移行は、権限の段1が入ってから、`rename-plan.md` の3.3の順で行う。

## 完了条件ごとの結果

| 完了条件（`brief.md`） | 結果 | 記録の節 |
|---|---|---|
| r6 と同じ項目: 適用後の検査（`checks.json` を `tests/c*-check-json.mjs` に渡す。新しい作者で通る） | c1〜c7 の7本とも「期待どおり」。作者は `sukuna-apply` の79件だけ。作業ツリーの検査7本も「期待どおり」 | 5節 |
| スモーク | 3回とも PASS 49 / FAIL 0。新しい誤りは無い（r6 の基準と比べた） | 4.2 |
| 外向き通信の監査（宛先が r6 と変わらない） | 2通りとも、エディタ・claude の宛先 0、許可の外 0、r6 の一覧に無いもの 0。名前で見えたのは r6 と同じ `wpad` だけ | 4.3 |
| 日本語の数え（除外の外の未訳 0） | 本体 12,355・package 1,258・bundle 1,564・直書き 22 で、除外の外の未訳 0（r6 と同じ数）。古い 1.131.0 のパックを当てると 801 で不合格になる（網は落ちるべきときに落ちる） | 2節 |
| 起動の確かめ | `result: ok`（前と後の2回）。`--version` は `1.146.0`・`b76374c6…`・`x64` | 4.1 |
| ポータブルの形で起動し、`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna` を作らない。前後で無いことを記録する | 起動は全部ポータブル。`%APPDATA%\Sukuna`・`%USERPROFILE%\.sukuna`・`%LOCALAPPDATA%\Sukuna\local.json` は、前（11:46）も後（14:56）も無い。**`%LOCALAPPDATA%\Sukuna` のフォルダそのものは、私の読む許可の外なので直接は見ていない**（指摘 P1）。なお、移行の台本が止まるのは `watch\`・`secrets\` に中身があるときで、フォルダや `local.json` があるだけでは止まらない | 7節 |
| `tests/l10n-audit-more.test.mjs` の実物のテストを `AIED_AUDIT_WT=<repo>\tmp\b\wt\r7\w` を渡して走らせる | **そのままでは打てなかった**。環境変数を付けたコマンドは私の許可に無い（フックが止めた）。代わりに、実物の4件の中身を同じ入力（アプリ・`tmp\b\wt\r7\w`・リポジトリのパック・古いパック）で CLI に当てた。4件とも期待どおり。テストそのものは、リーダーか曹参に打ってもらう必要がある | 2.2 |
| スモークの台本が、実行ファイル・CLI・データの場所を版の product.json から求めているか | 実行ファイルは `nameShort` から求める。CLI は `sukuna.cmd` を通さず、同じ実行ファイルに `cli.js` を渡す（`sukuna.cmd` と同じ形）。データは実行ごとの `VSCODE_PORTABLE` の下に置くので、名前に依らない。古い名前の決め打ちは無い。起動の確かめの台本は `bin\<applicationName>.cmd` で `sukuna.cmd` を使う。ただし、スモークの守りの照らしは `~/.sukuna` を見ていない（指摘 T2） | 4.1・4.2 |
| 版の中に `shuko` が残っていない（`zip-check-r7.json`） | 蒙恬の調べでも、私が展開し直した版の調べでも、名前と文字の中身に 0。どちらの調べも UTF-16 の文字列（実行ファイルの版の情報）は見られない（指摘 M1。手の確かめ U6） | 3節 |
| 合否と根拠を、r6 と同じ置き場所の形で records/ に残す | `records/take-in/1.146.0-p5-c-all-r7/` に `gate-p5-c-all-r7.md`・`manual-checks-p5-c-all-r7.md`・`l10n-audit-r7.json` を置いた（r6 と同じ3つの形）。通信の監査は `records/network-audits/2026-11-19-p5r7*/` | — |
| （r6 と同じく）テスト | 全部の run-all（見張りあり）は 3,073 件で、pass 3,065・fail 1・skip 7。落ちたのは既知の `.claude/agents/vlad-tepes.md` の1件だけ。見張りの通知は無い | 6節 |

## 指摘（移行を止めない）

- T1（曹参）: `l10n-audit-more.test.mjs` の実物のテストは、既定の作業ツリーが `tmp/b/wt/r7` で、実際の `tmp/b/wt/r7/w` と合わず、黙って飛ぶ。題と理由の文も「r4」のまま。
- T2（曹参）: スモークの `safety.daily-argv` は `~/.vscode`・`~/.vscode-oss` だけを見る。`~/.<dataFolderName>`（`.sukuna`）と `%APPDATA%\<nameLong>` も見るとよい。直すなら移行の前が望ましい。
- T3（曹参）: `configure.test.mjs`・`move-off-c.test.mjs` の各1件は今は通る。ただし、日常の Sukuna が動き始めるとまた落ちる（r6 の追記と同じ作り）。
- M1（蒙恬）: `trial-r7-verify.mjs` の中身の調べは `latin1` だけで、UTF-16 の文字列を見ない。
- P1（リーダー・権限）: 私は環境変数を付けたテストを打てず、`%LOCALAPPDATA%\Sukuna` の有無も見られない。移行の確かめ（順7）の前に、要るものを決めてほしい。
- K1（Team の開発部）: `.claude/agents/vlad-tepes.md` の8行目に古い名前が残る（既知。依頼済み）。

## 移行の前に気をつける点

1. 権限の段1（Sukuna の秘密の場所を `secret_paths` に）が入ってから、移行の台本の本番を打つ。
2. 台本の本番より前に、Sukuna を普通の形で起動しない。`sukuna` の CLI も打たない（`destNotEmpty` で止まる）。`install-extensions.mjs` も写しの後に打つ。
3. 台本を打つ間は、どこの `Sukuna.exe` も動かさない（台本は名前だけで「動いている」と見て止まる。関門・スモークで起動した試しの Sukuna も含む）。
4. 検知のタスクは、2026-11-18 の時点で未登録。その後に登録していれば、古いタスクも新しい `watch.mjs` を動かし、`%LOCALAPPDATA%\Sukuna\watch\` を書いて台本を止める恐れがある。移行の前に、登録の有無を確かめ直す。
5. `rename-plan.md` の3.3の1（コミットの直前に今の値を控える）は、コミットがもう入っているので済んでいないかもしれない。済んでいなければ、古い `%LOCALAPPDATA%\Shuko\local.json` から `configure.ps1 -ConfigPath` で値を読む。
6. 移行の前に、`%LOCALAPPDATA%\Sukuna\watch\`・`secrets\` が無いか空かを、見る許可のある者が確かめる。
7. 日常は r4 のままなので、r6 で入った組み込みの日本語パックとアイコン A の手の確かめは、まだ誰も見ていない。移行の後に、`records/take-in/1.146.0-p5-c-all-r7/manual-checks-p5-c-all-r7.md` の U9・U10 で見る。ほかに、課が見る K1〜K8 と、ユーザーが見る U1〜U8 がある。

## このフォルダに置いたもの

| ファイル | 中身 |
|---|---|
| `gate-r7-notes.md` | この文書 |
| `launch-check-p5-c-all-r7-ooka.json` | 起動の確かめ（展開し直した版。関門の作業の前の、日常の場所の有無を含む） |
| `launch-check-p5-c-all-r7-ooka-after.json` | 全部の検査の後にもう一度打った起動の確かめ（関門の作業の後の、日常の場所の有無） |
| `config-probe-before.json`・`config-probe-after.json` | `build.mjs --dry-run` の計画。`config.exists` で `%LOCALAPPDATA%\Sukuna\local.json` の有無を見た（何も走らせない） |
| `l10n-audit-r7-repopack.json` | リポジトリのパックでの網（`l10n-audit-more` の実物の1〜3件目の代わり） |
| `l10n-audit-r7-oldpack1131.json` | 古い 1.131.0 のパックでの網（実物の4件目の代わり。不合格になる） |
| `run-all-r7.txt` | 全部のテスト（見張りあり） |
| `run-all-*-r7.txt`（18個） | 群ごとのテストのまとめ（`--no-guard`） |

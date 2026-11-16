# 引き継ぎの書き付け（大岡越前守）: 段階 C をまとめた版の関門

- 作成: 大岡越前守（2026-11-16。時刻は UTC）
- 依頼: brief の「3. 関門」「3'.」。相手は蒙恬の `1.146.0-p5-c-all`（R2-7）
- 結果: **不合格**。原因は C-1-ai。C-2〜C-7 は 1・2 が合格で、3・4 は C-1 の誤りのせいで判定できない
- 記録: `records/take-in/1.146.0-p5-c-all/`（`gate-p5-c-all.md` が全体。単位ごとに `gate-C-1-ai.md`〜`gate-C-7-breadcrumbs-outline.md`）

## 1. 要点

1. 当たる・型検査とビルドは合格。21単位すべて `applied: ok`、型検査の誤り 0、パッケージ化と zip は終了コード 0、ロックファイルは ok。照らし役 c1〜c7 の中身の項目は全部期待どおり（c2〜c5 は「後の単位が当たっている」ことだけを食い違いに出す。照らし役が21単位の組を持たないため）。
2. zip から展開して起動した。プロセスは生きている（`p1-launch-check.ps1` は ok）。ただし、**ワークベンチが起動しない**。開発者ツールのコンソールに、ただ1行の誤り `Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'chatExtensionId')` が出る。renderer.log は空で、共有プロセスと拡張ホストは起動しない。
3. **CLI の `--install-extension` が全部落ちる**: `i.builtInExtensionsEnabledWithAutoUpdates is not iterable`。
4. 原因: C-1 の `productRemove` が product.json から `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` を外した。一方で、残った本家のコードがこの2つを `?.` なしで読んでいる。`services/accounts/browser/defaultAccount.ts` の `toDefaultAccountConfig` と、`platform/extensionManagement/common/extensionsScannerService.ts` の113行だ。型では省略できないキーなので、型検査にも静的なテストにも掛からなかった。出力の1847行がコンソールの誤りの行と一致することまで確かめた。
5. このため、消えているの起動して見る項目、スモーク（Claude Code の組・UNKNOWN service・Missing proxy instance・全文検索・拡張の一覧・設定の画面・タブと差分エディタ・台帳の拡張）、各単位の台本の「関門の起動の確かめ」は、1つも行えていない。

## 2. 流したもの

| 何 | コマンド | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all.zip` | 一致 |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/checks.json`（c1〜c7） | c1・c6・c7 は期待どおり。c2〜c5 は後の単位の分だけ食い違い |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt/1.146.0`（c1〜c7） | 7つとも期待どおり |
| 静的なテスト | `node tests/run-all.mjs --no-ps --only -unit`、`--only removals` | 282/282、229/229 pass |
| 展開と起動 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all.json -Zip <zip> -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all` | `result: ok`（プロセスだけを見る） |
| スモーク1回目 | `node tests/smoke-run.mjs --build <展開先> --label p5-c-all-1 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all.json --timeout 300 --keep-runs 40`（パスは絶対パスで渡した） | PASS 8 / FAIL 8。`tmp\b\smoke\runs\p5-c-82f-261116T024952\`（`.keep` を置いた） |
| 消えている | `node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5-c-all-21` | snapshot が取れず timeout（終了コード 2） |
| C: の空き | `node scripts/disk-usage.mjs records=records` | 96.33 GB（03:02） |

## 3. 飛ばしたもの（理由）

| 何 | 理由 |
|---|---|
| スモークの2回目・3回目と3回の和の基準 | 起動を3回（prime・本番・absent）行い、3回とも同じく立ち上がらなかった。product.json にキーが無いことによる決まった誤りで、回を重ねても変わらない。基準は、C-1 を直した版で作る（`baseline-p5-c-all.json` はまだできていない） |
| 通信の監査（netaudit） | ワークベンチも拡張ホストも動かない版の監査では、関門の条件（Claude・git・Notion のほかへ通信しない、absentHosts、続きの編集の通信）を判定できないため。権限の問題ではない。直した版で流す |
| 各単位の台本の「関門の起動の確かめ」 | ワークベンチが起動しないため、どれも行えない |

許可の外で止まったものは無い。ほかに、確かめの途中で `ls`・`head`・`cd`・パイプの形がフックに止められ、Glob・Read・単体のコマンドで代えた（関門の結果には響いていない）。`run_in_background` の出力のファイルと、大きな出力を移した先（どちらも `C:\Users\…` の下）は read_paths の外で読めなかった。そこで、前で流す形と `run-all.mjs` のまとめで代えた。

## 4. 直す必要があるところ

| 誰 | どこ | 何を |
|---|---|---|
| 蒙恬 | `removals/C-1-ai/unit.json` の `productRemove`（254〜261行）と `edits.patch` | `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` の読み手を直すか、キーを外すのをやめる（空の値を置く案もある）。同じ形の読み手（`gate-C-1-ai.md` の表の6か所）もまとめて見る。どちらの案にするかは、裁定の「product.json の AI のキーは消す」との兼ね合いがあるので、リーダーが決める（`defaultChatAgent` には URL が入っていて、残すと通信の元になりうる） |
| 曹参 | `tests/c1-unit.test.mjs` | 「`productRemove` のキーを、残る `src/` が `?.` や既定値なしで読んでいない」ことの検査を足す |
| スモークの台本の持ち主（リーダーが決める） | `tests/smoke/lib/common.mjs` の `extractChromiumErrors` | `chromium.log` の `ERROR`・`FATAL` の行だけを拾う。この Electron ではコンソールの誤りも `INFO:CONSOLE` で出るので、今回の `Uncaught (in promise) TypeError` を数えず、`errors.new` が PASS になった。`depends on UNKNOWN service` がログのサービスより前に出ると、同じ穴に落ちる |
| 起動の確かめの持ち主 | `scripts/p1-launch-check.ps1` | プロセスが生きているかだけを見る。ワークベンチが立ち上がったかは見ない（今回は ok と出た） |
| 曹参 | `tests/c2-check-json.mjs`〜`c5-check-json.mjs` | 21単位の組が無い。段階 C をまとめた版を照らすなら、組を足すか、後の単位を許す形にする |

## 5. 次の担当への注意

- C-1 だけを無効にした版は作れない。C-3〜C-7 が `after` に C-1 を挙げているので、無効にすると C-2 しか残らない。
- C-1 を直した版でもう一度関門を流すときは、スモーク3回（1回目・3回目は `baseline-p2-all.json`、2回目は `baseline-official-1.146.0.json` と比べる）、`absent-run` の21単位、netaudit（関門の環境 `tasks/2026-11-14-p2-gates/netaudit-env` と、台帳の拡張あり）、各単位の台本の5節（C-3 は4節）を流す。
- C-7 の「2回続けて通らなければ諮る」の数え方: 今回は C-7 を確かめていない。数えない方が事実に合う（`gate-C-7-breadcrumbs-outline.md`）。リーダーが決める。
- 展開した版 `tmp\b\p2\1.146.0-p5-c-all\`（portable を含む）、スモークの拡張のフォルダ `tmp\b\smoke\ext\1.146.0-p5-c-all-1\`（入らなかったので中身はほぼ空）、`tmp\b\smoke\absent\p5-522-261116T025823\` は残してある。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。`C:\b` には触れていない。普段使いのデータは、起動の確かめ（6つのフォルダが不変）とスモークの `safety.daily-argv`（PASS）で見た。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。netaudit を流していないので、ネットのログは作っていない。秘密の場所には触れていない。

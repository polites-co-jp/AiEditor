# 関門の記録: 段階 C をまとめた版 `1.146.0-p5-c-all`（21単位）

- 検証: 大岡越前守、2026-11-16（UTC 02:45〜03:05 ごろ。JST は +9 時間）
- 依頼: `tasks/2026-11-15-p5-stagec-gate/brief.md` の「3. 関門」「3'.」
- 相手: 蒙恬のビルド（`tasks/2026-11-15-p5-stagec-gate/handoff-notes-meng-tian.md` の2回目、R2-7）
  - zip: `tmp\b\dist\1.146.0-p5-c-all.zip`（SHA-256 `e798cce0a39cad4a7e890df79cbeee52964704ffb387296ca0040007354b63a1`。計算し直して一致）
  - 展開先: `tmp\b\p2\1.146.0-p5-c-all\Shuko-win32-x64-1.146.0-p5-c-all\`（version 1.146.0、commit `101e832240f4f92b1eddb2b505078bed96f84d43`）
- 条件: docs/03 の7節の1〜4、各単位の台本 `tests/removals/c1-gate-script.md`〜`c7-gate-script.md`

## 判定

**不合格。** 原因は C-1-ai。ほかの単位の 3・4 は、この誤りのせいで判定できない。

この版はウィンドウの中身（ワークベンチ）が起動しない。CLI の `--install-extension` も、すべての拡張で落ちる。どちらも、C-1 が `productRemove` で product.json から外したキー（`defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates`）を、残った本家のコードが `?.` なしで読んでいるために起きる。細目は `gate-C-1-ai.md`。

| 関門（docs/03 の7節） | 結果 | 要点 |
|---|---|---|
| 1 当たる | 合格 | 21単位すべて `applied: ok`。`result: ok`、`errors: []`。警告は C-2 の想定の1件だけ。照らし役 c1〜c7 の中身の項目はすべて期待どおり（下の1節） |
| 2 型検査とビルド | 合格 | 型検査は終了コード 0。ログは `tsc ...` の1行だけで、誤りの行は無い。パッケージ化と zip も終了コード 0。ロックファイルの検査は `ok` |
| 3 消えている | 判定できない | absentStrings は全項目 0 件（checks.json）。起動して見る項目（コマンド・ビュー・設定・プロセス）は、ワークベンチが起動しないため取れない（`absent-run` は snapshot が取れず timeout）。通信の監査は流していない（下の3節） |
| 4 壊れていない | **不合格** | スモークの1回目: ワークベンチが起動せず、probe が timeout。台帳の拡張は CLI で1つも入らない。開発者ツールのコンソールに `Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'chatExtensionId')` |

## 単位ごとの合否

| 単位 | 1 当たる | 2 型検査とビルド | 3 消えている | 4 壊れていない | 判定 | 記録 |
|---|---|---|---|---|---|---|
| C-1-ai | 合格 | 合格 | 判定できない | **不合格**（原因） | **不合格** | `gate-C-1-ai.md` |
| C-2-debug | 合格 | 合格 | 判定できない | 判定できない（C-1 の誤りで起動しない） | 判定できない | `gate-C-2-debug.md` |
| C-3-remote | 合格 | 合格 | 判定できない | 判定できない（同上） | 判定できない | `gate-C-3-remote.md` |
| C-4-notebook | 合格 | 合格 | 判定できない | 判定できない（同上） | 判定できない | `gate-C-4-notebook.md` |
| C-5-extension-gallery | 合格 | 合格 | 判定できない | 判定できない（同上。C-5 で最も大事な CLI の導入の道も、C-1 の誤りで落ちている） | 判定できない | `gate-C-5-extension-gallery.md` |
| C-6-settings-sync | 合格 | 合格 | 判定できない | 判定できない（同上） | 判定できない | `gate-C-6-settings-sync.md` |
| C-7-breadcrumbs-outline | 合格 | 合格 | 判定できない | 判定できない（同上） | 判定できない | `gate-C-7-breadcrumbs-outline.md` |
| A-1〜A-7・B-1〜B-7（14） | 合格 | 合格 | 判定できない | 判定できない（同上） | この版では判定できない（`1.146.0-p2-all` では合格。`records/phase2/phase2-close.md`） | この表 |

C-1 だけを無効にした版は、そのままでは作れない。C-3〜C-7 が `after` に C-1 を挙げているので（docs/03 の4節の段階 C の下準備、5.1）、C-1 を無効にすると C-3〜C-7 も当てられない。直すか無効にするかは、リーダーが決める（docs/03 の7節の末尾）。

## 1. 当たる・型検査とビルド

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all.zip` | `e798cce0…54b63a1`。蒙恬の記録と一致 |
| 当てた単位 | `tasks/2026-11-15-p5-stagec-gate/1.146.0-p5-c-all/checks.json` | 21単位すべて `applied: ok`。`result: ok`、`stoppedAt: null`、`errors: []`。`warnings` は `C-2-debug: delete: …debugChatIntegration.ts が本家に無い（改名の恐れ）` の1件だけ（C-1 が先に消すため。c2 の台本の b の組の想定と同じ）。remnants・absentStrings（全項目 `hitCount: 0`）・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity は ok。upstreamAdditions・dependencies は `--prev-tag` が無いので skipped（取り込みでないので正しい） |
| コミットの並び | checks.json の `commits` | 単位ごとに ops → edits の順で、C-1 の edits → C-2 の ops → … → C-7 の edits → パッチ 20・30 → assets → builtin extensions。作者はすべて `shuko-apply <apply@shuko.invalid>`。HEAD は `101e8322…f84d43` |
| unit.json の状態 | `git diff -- removals/` | C-1〜C-7 の `"enabled": false` → `true` の各1行だけ（未コミット） |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs <checks.json>` 〜 `c7-check-json.mjs` | c1・c6・c7 は「期待どおり」。c2〜c5 は終了コード 1 だが、食い違いは「想定していない単位が当たっている」（後の単位 C-3〜C-7 などが当たっていること）だけ。照らし役は単位ごとの関門の組（15〜19単位）を前提にしていて、21単位の組を持たない。ほかの項目（edits の衝突・removeLines・missingDeletes・警告・absentStrings・コミットの並び・作者）はすべて照らされ、食い違いは無い（c2 の作りを読んで確かめた） |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt/1.146.0` 〜 `c7-check-worktree.mjs` | 7つとも「期待どおり（作業ツリー）」 |
| 型検査 | `build-record.json` の `steps[name=typecheck]`、`tmp\b\logs\1.146.0-p5-c-all\typecheck.log` | `pnpm run typecheck-client`、終了コード 0、6.6 秒。ログは `$ tsc --project ./src/tsconfig.json --noEmit --skipLibCheck` の1行だけ（誤りの行なし） |
| HEAD の一致 | `build-record.json` の `sourceVersion` | `value` = checks.json の `headCommit`（`matchesChecksHead: true`）、`error: null`。`uncommittedEntries: 3` は作り直したロックファイル3つ（全部を通すビルドでは想定どおり。p2-all と同じ） |
| パッケージ化・後処理・zip | `build-record.json`、`package.log` | package・zip は終了コード 0、postprocess は ok。`package.log` に `error` の行は無い。記録の `warnings: []`、`stoppedAt: null` |
| ロックファイル | `build-record.json` の lockfile の手順 | `status: ok`。ルート・`remote/`・`extensions/` は「消した依存の削除」だけ、`build/`・`test/sanity/` は変わらない、`extensions/copilot/` は removed |
| 静的なテスト | `node tests/run-all.mjs --no-ps --only -unit`、`--only removals` | c1〜c7-unit 282 件 pass 282 / fail 0。removals.test.mjs 229 件 pass 229 / fail 0 |

照らし役の型検査の照らし（`<typecheck.json>` を渡す形）は使っていない。ビルドの記録は steps[0] が prepare で、照らし役が前提にする「型検査だけの記録」の形ではないため。同じ項目（result・exitCode・sourceVersion）を上の表で手で照らした。

## 2. 展開と起動

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all.json -Zip E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all.zip -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all
```

- `result: ok`。展開 13.9 秒、`--version` は `1.146.0 / 101e8322… / x64`、プロセスは10秒後も生きていて、止めた（Shuko.exe ×4）。普段使いのデータのフォルダ6つは変わっていない。
- ただし、この台本が見るのは「プロセスが生きているか」だけで、ワークベンチが立ち上がったかは見ない。4節のスモークで、立ち上がっていないことが分かった。

## 3. 消えている

| 項目 | 結果 |
|---|---|
| absentStrings（21単位） | checks.json で全項目 `hitCount: 0` |
| 起動して見る項目（absentCommands・absentViews・absentSettings・absentProcesses） | 判定できない。`node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5-c-all-21` は「snapshot が取れなかった（timeout）」で終了コード 2（置き場所 `tmp\b\smoke\absent\p5-522-261116T025823\`）。ワークベンチが起動しないので、試験用の拡張が動かない |
| 通信の監査（netaudit） | **流していない**。ワークベンチも拡張ホストも動かない版の監査は、関門の条件（使ったときに Claude・git・Notion のほかへ通信しない、absentHosts・続きの編集の通信が無い）の判定にならないため。C-1 を直した版で流す |

## 4. 壊れていない

```
node tests/smoke-run.mjs --build E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all/Shuko-win32-x64-1.146.0-p5-c-all --label p5-c-all-1 --mode built --prime --baseline E:/develop/self/Team/projects/ai-editor/tmp/b/smoke/baseline-p2-all.json --save-baseline E:/develop/self/Team/projects/ai-editor/tmp/b/smoke/baseline-p5-c-all.json --timeout 300 --keep-runs 40
```

- 置き場所: `tmp\b\smoke\runs\p5-c-82f-261116T024952\`（`.keep` を置いた）。結果は `smoke-result.md`。
- 結果: PASS 8 / FAIL 8 / INFO 8、終了コード 1。基準は保存されなかった（最後まで走り切らなかった実行の鍵は保存しない）。

| 項目 | 結果 | 詳細 |
|---|---|---|
| base.ext-install | FAIL | 台帳の8つすべてが `Error while installing extensions: i.builtInExtensionsEnabledWithAutoUpdates is not iterable` |
| base.ui-language | FAIL | prime の起動で `languagepacks.json` ができない（90秒） |
| base.launch | FAIL | probe が timeout（300秒）、probe の項目 0 件 |
| base.window2・base.localhistory | FAIL | ワークベンチが動かないため |
| claude.exthost-log・claude.lock | FAIL | 拡張ホストのログが無い（拡張ホストが起動していない） |
| safety.daily-argv・safety.process-tree | PASS | 普段使いの argv.json は変わらず、止めた後の残り 0 |
| errors.new | PASS（ただし当てにならない。下） | 誤りの一覧が 0 件 |

ログ（本番の起動。prime の起動も同じ）:

- `logs\main.log` は7行（共有の保存場所の作成と `update#ctor - updates are disabled` まで）。`logs\window1\renderer.log` は空。共有プロセス・拡張ホストのログは無い。
- `chromium.log`（開発者ツールのコンソール）は1行だけ:
  `[59188:1116/115143.357:INFO:CONSOLE:1847] "Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'chatExtensionId')", source: …/resources/app/out/vs/workbench/workbench.desktop.main.js (1847)`
- 出力の `workbench.desktop.main.js` の1847行に `preferredExtensions:[s.chatExtensionId,s.extensionId]` がある（`services/accounts/browser/defaultAccount.ts` の `toDefaultAccountConfig`）。出力の `product.json` に `defaultChatAgent` は無い（Grep で0件）。

`depends on UNKNOWN service`・`Missing proxy instance`、Claude Code の組（パネル・差分・コメント・ログイン、`vscode.lm`・`vscode.chat` の誤り）、全文検索、拡張の一覧と有効・無効、設定の画面、タブ・分割・差分エディタ、台帳の拡張の起動、「知らない contributes」の警告は、どれも見られない。ワークベンチが起動しないためで、各単位の台本の「関門の起動の確かめ」の節は、1つも行えていない。

スモークは1回で止めた（2回目・3回目は流していない）。同じ版の起動を3回（スモークの prime・本番、`absent-run`）行い、3回とも同じく立ち上がらなかった。product.json のキーが無いことによる決まった誤りで、回を重ねても結果は変わらない。基準（3回の和）は、C-1 を直した版で作る。

## 5. 気づいた点（テストと台本）

1. **スモークの誤りの一覧が、開発者ツールのコンソールの誤りを数えていない。** `tests/smoke/lib/common.mjs` の `extractChromiumErrors` は、`chromium.log` の `ERROR`・`FATAL` の行だけを拾う。この Electron では、コンソールの誤りも `INFO:CONSOLE` の行で出る（p2-all のスモークの `chromium.log` でも、`%c  ERR` の行が `INFO:CONSOLE` だった）。そのため、今回の `Uncaught (in promise) TypeError` は数えられず、`errors.devtools-console` は 0 件、`errors.new` は PASS になった。`renderer.log` に出る誤り（ログのサービスを通るもの）は別に拾えている。ただ、起動の早い時期の誤りや捕まえられない例外は、ここでしか見えない。段階 C の関門で見る `depends on UNKNOWN service` も、ログのサービスより前に出れば、この穴に落ちる。
2. **静的なテストが、`productRemove` で外したキーの読み手を見ていない。** c1-unit（43件）・removals（229件）は全部通ったが、外したキーを `?.` なしで読むコードが残っていた。型（`IProductConfiguration` の `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` は省略できない型）があるので、型検査でも見えない。
3. **起動の確かめ（`p1-launch-check.ps1`）は、ワークベンチが立ち上がったかを見ない。** 今回は `result: ok` だった。
4. **照らし役 c2〜c5 は、21単位の組を持たない。** 後の単位が当たっていると、終了コード 1 になる（中身の項目は照らされる）。段階 C をまとめた版を照らすなら、組を足すか、「後の単位は許す」形にする必要がある。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、この `records/take-in/1.146.0-p5-c-all/`、`tasks/2026-11-15-p5-stagec-gate/`（`launch-check-p5-c-all.json`・`handoff-notes-ooka.md`）、台本が書く `tmp\b\p2\1.146.0-p5-c-all\`（展開と portable）・`tmp\b\smoke\runs\p5-c-82f-261116T024952\`・`tmp\b\smoke\ext\1.146.0-p5-c-all-1\`・`tmp\b\smoke\absent\p5-522-261116T025823\`。
- `C:\b` には書いていない（読んでもいない）。普段使いのデータは、起動の確かめで6つのフォルダが変わらないこと、スモークで `safety.daily-argv` が PASS であることを見た。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は触っていない。netaudit は流していないので、ネットのログは作っていない。秘密の場所には触れていない。
- C: の空き: 96.33 GB（2026-11-16 03:02 UTC、`node scripts/disk-usage.mjs records=records`）。ビルドの終わり（96.11 GB）から減っていない。

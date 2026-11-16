# 関門の記録: 段階 C をまとめた版 `1.146.0-p5-c-all-r3c`（21単位。r2 の C-1 の3種の誤りを直した版）

- 検証: 大岡越前守、2026-11-16（UTC 06:25〜07:10 ごろ。JST は +9 時間）
- 依頼: リーダーの依頼（タスクの名称「段階 C の版の関門（r3c）」）
- 相手: 蒙恬のビルド（`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` の「r3」）
  - zip: `tmp\b\dist\1.146.0-p5-c-all-r3c.zip`（SHA-256 `56ad1c155a5f789ee2f1990873ff92cc889a853c81d686f85e6a818014fa9c8c`。計算し直して一致）
  - 展開先: `tmp\b\p2\1.146.0-p5-c-all-r3c\Shuko-win32-x64-1.146.0-p5-c-all-r3c\`（commit `827a712b63db17ef1326637343927c1d8fd86a0c`）。作業ツリー `tmp\b\wt-r3c\1.146.0`。ビルドの記録 `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r3c/`
  - r3・r3b は今の edits.patch と合わないので使っていない
- 比べる相手: スモークは前の段階の `baseline-p2-all.json`（1回目・3回目）と公式の `baseline-official-1.146.0.json`（2回目）。**`baseline-p5-c-all-r2.json` は使っていない**（C-1 の誤りを含むため）。3回の和は新しく `tmp\b\smoke\baseline-p5-c-all-r3c.json` に作った。通信は r2 の監査（`records/network-audits/2026-11-16-p5r2`・`-p5r2-ledger`）と比べた

## 判定

| 見たもの | 結果 |
|---|---|
| 起動した版の振る舞い（docs/03 の7節の1〜4、21単位） | **合格**。スモーク3回とも PASS 49 / FAIL 0。r2 の3種の誤りは、同じ道を通しても出ない。absent は fail 0。通信の監査2通りで宛先 0 |
| 網（静的なテスト） | **c1-unit の2件が落ちる**（59件中57件 pass）。ほかの c2〜c7-unit（239件）・removals（229）・smoke（80）・p1 の3つ（50）は全部通る |
| **総合** | **C-2〜C-7 は合格。C-1 は保留**（振る舞いは合格。c1-unit の2件が残るので、検証が通った状態ではない） |

c1-unit の2件:

1. **消した部品の使い手の網**: 数えた18件を1件ずつ見た。どれも実害が無い（`IInstantiationService` の注入16件は網の誤検出、`IGitHubService` は共有プロセスに登録が残っている、`workbench.action.unifiedQuickAccess` は `try/catch` で守られた直さないと決めた呼び出し）。→ 網の側（曹参）の直しで片づく見込み。C-1 の edits.patch に直す所は無い。
2. **edits.patch の形**（ハンクの行数と、2通りの読み手の一致）: どこで合わないかは、私の読める形で取り出せなかった。版は正しく当たっているが、本家が同じ所を変えた週の取り込みで当たらない恐れがある。→ 蒙恬が format-patch し直すか、曹参が落ちた場所を出すか。

細目は `gate-C-1-ai.md`。

## 単位ごとの合否

| 単位 | 1 | 2 | 3 | 4 | 網 | 判定 | 記録 |
|---|---|---|---|---|---|---|---|
| C-1-ai | 合格 | 合格 | 合格 | 合格 | c1-unit 2件 fail | **保留** | `gate-C-1-ai.md` |
| C-2-debug | 合格 | 合格 | 合格 | 合格 | c2-unit 58/58 | **合格** | `gate-C-2-debug.md` |
| C-3-remote | 合格 | 合格 | 合格 | 合格 | c3-unit 28/28 | **合格** | `gate-C-3-remote.md` |
| C-4-notebook | 合格 | 合格 | 合格 | 合格 | c4-unit 55/55 | **合格** | `gate-C-4-notebook.md` |
| C-5-extension-gallery | 合格 | 合格 | 合格 | 合格 | c5-unit 42/42 | **合格** | `gate-C-5-extension-gallery.md` |
| C-6-settings-sync | 合格 | 合格 | 合格 | 合格 | c6-unit 30/30 | **合格** | `gate-C-6-settings-sync.md` |
| C-7-breadcrumbs-outline | 合格 | 合格 | 合格 | 合格 | c7-unit 26/26 | **合格** | `gate-C-7-breadcrumbs-outline.md` |
| A-1〜A-7・B-1〜B-7（14） | 合格 | 合格 | 合格 | 合格 | removals 229/229 | この版でも壊れていない | この表 |

- 「合格」は自動で見られる関門の分。画面を見る手の項目（`records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md` の C1〜C21 と、r3c で足した C22。`manual-checks-p5-c-all-r3c.md`）は残る。ユーザーに渡すのは、C-1 の保留が片づいてから。

## 1. 当たる・型検査とビルド

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r3c.zip` | 一致 |
| 当てた単位 | `checks.json` | 21単位すべて `applied: ok`。`result: ok`、`errors: []`。警告は C-2 の想定の1件だけ。HEAD は `827a712b…` |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs <checks.json>` 〜 `c7-check-json.mjs` | 7つとも「期待どおり」（c2〜c6 は組 c、c7 は組 b） |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt-r3c/1.146.0` 〜 c7 | 7つとも「期待どおり（作業ツリー）」 |
| C-1 の直し | edits.patch の + の行 | `NullTerminalChatService` と登録（terminal.contribution.ts）、`viewHiddenChatTerminals` の何もしないコマンド、`searchView.ts` の3か所の `.searchView?.`、型 `searchView?:`、`_chat.editSessions.accept` の何もしないコマンド（aiEditTelemetryService.ts）、`AgentNetworkFilterService` のワークベンチへの登録、アカウントのメニューの `_manageTrustedMCPServersForAccount` の項目と `canUseMcp` の削除。リーダーの判断（docs/user-decisions.md の「r2 の関門で出た点」）どおり |
| 型検査・パッケージ化・zip | `build-record.json`、`typecheck.log` | 型検査は終了コード 0、ログは `tsc …` の1行だけ。package・zip は ok、記録の `warnings: []`、`sourceVersion` は HEAD と一致 |
| ロックファイル | `sha256sum` で r2 と r3c の `lockfile.diff` | 同じ（`ef5f98ab…3862`） |

## 2. 展開と起動

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all-r3c-ooka.json -Zip <zip> -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r3c-ooka -InstallExtension <台帳の7つの VSIX>
```

`result: ok`。ワークベンチのしるし3つ、ワークベンチのコンソールの `Uncaught` 0、CLI の導入7つとも成功、普段使いのデータのフォルダは不変。

## 3. 消えている

- absent（21単位）: `tmp\b\smoke\absent\p5rc63-261116T064654\`。網: runtime（コマンド 1909 件・設定 45 件）＋ manifest。19単位すべて pass（A-1 3・A-2 7・A-3 1・A-4 3・A-5 3・A-7 9・B-1 2・B-2 8・B-3 4・B-4 7・B-5 6・B-7 4・C-1 12・C-2 6・C-3 10・C-4 7・C-5 25・C-6 2・C-7 7）。fail 0・unknown 0。網になっているかは r2 で公式の版に当てて確かめた（C-1 の2項目を除く）。
- 通信の監査（各600秒）:

| 監査 | 記録 | エディタの宛先 | claude の宛先 | 許可の外 | 前の一覧（r2）に無い | 名前で見えたもの |
|---|---|---|---|---|---|---|
| p5r3c（関門の環境） | `records/network-audits/2026-11-16-p5r3c/` | 0 | 0 | 0 | 0 | `wpad` の解決2回（答え・接続なし）だけ |
| p5r3c-ledger（台帳の拡張・Claude Code を含む） | `records/network-audits/2026-11-16-p5r3c-ledger/` | 0 | 0 | 0 | 0 | 同上 |

  - ネットのログは読んだ後に台本が消した（`tmp\b\netlog\` は空）。absentHosts、ギャラリーのホスト、同期のストアへの接続も名前の問い合わせも無い。**続きの編集の通信も無い**（裁定で諮る条件に当たらない）。

## 4. 壊れていない

```
node tests/smoke-run.mjs --build <展開先> --label p5r3c-1 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r3c.json --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build <展開先> --label p5r3c-2 --mode built --prime --baseline tmp/b/smoke/baseline-official-1.146.0.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r3c.json --merge-baseline --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build <展開先> --label p5r3c-3 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r3c.json --merge-baseline --timeout 300 --keep-runs 40
```

（パスは絶対パスで渡した）

| 回 | 置き場所（`.keep` を置いた） | 比べた基準 | 結果 |
|---|---|---|---|
| 1 | `tmp\b\smoke\runs\p5r3c-1-261116T063547\` | p2-all | PASS 49 / FAIL 0 / INFO 9 |
| 2 | `tmp\b\smoke\runs\p5r3c-2-261116T064030\` | 公式 | PASS 49 / FAIL 0 / INFO 9 |
| 3 | `tmp\b\smoke\runs\p5r3c-3-261116T064325\` | p2-all | PASS 49 / FAIL 0 / INFO 9 |

- 3回の和 `tmp\b\smoke\baseline-p5-c-all-r3c.json`: `runs: 3`、鍵2個（`TextModel got disposed before DiffEditorWidget model got reset`・`DEP0169 url.parse()`。どちらも公式と p2-all の基準にある既知のもの。各回1回ずつ）。r2 の3回目の `base.ui-language` の揺れは、今回は3回とも出なかった（ja）。
- 誤りの行は各回とも renderer.log の2行（上の2つ）だけ。exthost・main・共有プロセス・ptyhost・terminal・editSessions・userDataSync のログに誤りは無い。

### r2 の3種の誤りの道（依頼の1）

蒙恬の起動の確かめはこの道を通らないので、スモークの probe が通る道を、r2 の誤りの呼び出し履歴と照らした。3回とも同じ道を通り、誤りは出なかった。

| r2 の誤り | 通した道 | 同じ道だと言える根拠（r2 の記録） | r3c |
|---|---|---|---|
| `depends on UNKNOWN service terminalChatService`（ターミナルのタブのビュー） | `base.terminal`（`createTerminal` → `show`） | r2 の履歴 `lb.createTerminal` → `ffe.createGroup` → `Ife._createTabsView` | 3回とも PASS、`UNKNOWN service` は無い |
| `reading 'semanticSearchBehavior'`（全文検索の欄に打つ検索） | `base.search`・`base.replace`（`findInFiles` が欄に値を入れて検索を起こす） | r2 の履歴 `setSearchParameters` → `onValueChange` → `onSearchInputChanged` → `submitSearch` → 聞き手。欄に打ったときも `onValueChange` → `onSearchInputChanged` を通る | 3回とも PASS、誤りは無い。置換で検索の結果の一致を1件置換できた |
| `command '_chat.editSessions.accept' not found`（git のステージとコミット） | `base.git`（`repo.add` → `repo.commit`） | r2 の Git.log の `git add -A -- tracked.txt` と `git -c user.useConfigOnly=true commit …` の直後に誤り | 1回目の Git.log に同じ2つの行（15:39:27・15:39:28）。3回とも PASS、誤りは無い |

### 台本が特に見よとした項目

| 項目 | 結果 |
|---|---|
| コンソールの `depends on UNKNOWN service` | 3回とも無い（21単位のどのサービスも） |
| `Missing proxy instance` | 無い |
| Claude Code の組 | 3回とも `claude.running`（2.1.322）・`claude.exthost-log`・`claude.lock` が PASS |
| 拡張ホストのログの `vscode.lm`・`vscode.chat`・`vscode.debug`・`openTunnel` の誤り | 無い（拡張ホストのログに誤りの行が無い） |
| 全文検索・拡張の一覧・設定の画面・タブと分割と差分 | 自動で見られる所（検索・置換・ripgrep・分割・差分・2つめのウィンドウ・CLI の導入・コマンドの登録）は全部通った。見た目は手の項目 |
| 台帳の拡張が起動する | PowerShell・basedpyright・bash-ide・rainbow-csv・dotenv・pdf と組み込みの言語が全部 PASS |
| 「知らない contributes」の警告 | 出ない |

## 5. 網の結果（依頼の3）

`gate-C-1-ai.md` の「網」の節。記録のファイル: `tasks/2026-11-15-p5-stagec-gate/c1-unit-r3c.txt`（run-all のまとめ）、`tasks/2026-11-15-p5-stagec-gate/orphans-C-1-r3c.txt`（網の報告の一覧）。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、このフォルダ、`records/network-audits/2026-11-16-p5r3c/`・`-p5r3c-ledger/`（台本が書く）、`tasks/2026-11-15-p5-stagec-gate/`（`launch-check-p5-c-all-r3c-ooka.json`・`c1-unit-r3c.txt`・`orphans-C-1-r3c.txt`・`handoff-notes-ooka.md`）、台本が書く `tmp\b\` の下（`p2\1.146.0-p5-c-all-r3c-ooka\`、`smoke\runs\p5r3c-*`、`smoke\ext\1.146.0-p5r3c-*`、`smoke\absent\p5rc63-*`、`smoke\baseline-p5-c-all-r3c.json`、`audit\`）。
- `C:\b` は読むだけ（監査の環境の写しの元）。普段使いのデータは、起動の確かめ（6つのフォルダが不変）とスモークの `safety.daily-argv`（3回とも PASS）で確かめた。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。秘密の場所には触れていない。
- C: の空き: 98.67 GB（07:11）。

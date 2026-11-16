# 関門の記録: 段階 C をまとめた版 `1.146.0-p5-c-all-r4`（C-1 の保留の片づけ）

- 検証: 大岡越前守、2026-11-16（UTC 08:55〜09:15 ごろ。JST は +9 時間）
- 依頼: リーダー（タスクの名称「段階 C の版の関門（r4。C-1 の保留の片づけ）」）
- 相手: 蒙恬のビルド（`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` の「r4」）。C-1 の edits.patch を `git format-patch` で作り直した版
  - zip: `tmp\b\dist\1.146.0-p5-c-all-r4.zip`（SHA-256 `e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e`。計算し直して一致）
  - HEAD: `7fac30e886f79ebe44e1bac93acd7a86fbbafed8`（枝 `builds/1.146.0-p5-c-all-r4`）。作業ツリー `tmp\b\wt\r4`。ビルドの記録 `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4/`
- 前提: r3c の関門（`records/take-in/1.146.0-p5-c-all-r3c/`）で、21単位の振る舞いは 1〜4 とも合格した。C-1 だけを、c1-unit の2件（網の誤検出、edits.patch の書式の傷）のために保留にした。r4 は木が r3c と同じなので、確かめるのはリーダーが挙げた5つ（r3c の記録の「次に向けて」の見込みどおり）

## 判定

**合格。C-1〜C-7 の全部を合格とする。この版 `1.146.0-p5-c-all-r4` を最終の版として扱ってよい。**

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | 照らし役 c1〜c7（当て直しの記録と作業ツリー） | 14本とも「期待どおり」 |
| 2 | c1-unit（保留の2件を含む）と `tests/patch-shape.mjs removals/C-1-ai/edits.patch` | c1-unit 60件すべて pass（保留の2件も pass）。patch-shape は「合う」（終了コード 0） |
| 3 | 起動の確かめ | `result: ok` |
| 4 | スモーク1回（比べる相手は `baseline-p5-c-all-r3c.json`） | PASS 49 / FAIL 0。新しい誤りなし |
| 5 | 木が r3c と同じ | `git -C tmp/b/wt/r4 diff --stat 827a712b… 7fac30e8…` が空 |

c1-unit が網の誤検出で落ちることは、もう無い（下の2節）。

## 単位ごとの合否

| 単位 | 判定 | 根拠 |
|---|---|---|
| C-1-ai | **合格** | r3c の振る舞いの合格（1〜4）に加え、r3c で保留にした c1-unit の2件が通った。木は r3c と同じ |
| C-2-debug | **合格** | r3c で合格。木は同じで、照らし役・スモークも r4 で通った |
| C-3-remote | **合格** | 同上 |
| C-4-notebook | **合格** | 同上 |
| C-5-extension-gallery | **合格** | 同上。起動の確かめで CLI の導入7つ、スモークで台帳の8つが入った |
| C-6-settings-sync | **合格** | 同上 |
| C-7-breadcrumbs-outline | **合格** | 同上。docs/07 の8節の「2回続けて通らなければ諮る」には当たらない（r2・r3c・r4 とも自動の関門で落ちた所は無い） |
| A-1〜A-7・B-1〜B-7（14） | 壊れていない | 照らし役・removals（229/229）・スモークで、前の段階に無い誤りは無い |

各単位の台本の「関門の起動の確かめ」のうち画面を見る項目は、手の項目に分けてある。`records/take-in/1.146.0-p5-c-all-r2/manual-checks-p5-c-all-r2.md`（C1〜C21）と `records/take-in/1.146.0-p5-c-all-r3c/manual-checks-p5-c-all-r3c.md`（C22）で、版の名前を r4 に読み替える。これはユーザーが行う（入れ替えと同じく、ユーザーの手による。brief の5）。

## 1. 照らし役・木の同一

| 確かめたこと | コマンド | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r4.zip` | 一致 |
| 当て直しの記録 | `node tests/c1-check-json.mjs tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r4/checks.json`（c1〜c7） | 7つとも「期待どおり」（c2〜c6 は組 c、c7 は組 b）。`result: ok`、`errors: []`、警告は C-2 の想定の1件だけ、HEAD は `7fac30e8…` |
| 作業ツリー | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt/r4`（c1〜c7） | 7つとも「期待どおり（作業ツリー）」 |
| 木が r3c と同じ | `git -C tmp/b/wt/r4 diff --stat 827a712b63db17ef1326637343927c1d8fd86a0c 7fac30e886f79ebe44e1bac93acd7a86fbbafed8` | 空（1バイトも違わない） |
| 作業ツリーの HEAD | `git -C tmp/b/wt/r4 diff --stat HEAD 7fac30e8…`、`git -C tmp/b/wt/r4 status --short --branch` | 差は空。変更は作り直したロックファイル3つだけ（全部を通すビルドではいつもどおり） |
| 型検査・パッケージ化・zip | `build-record.json`、`tmp\b\logs\1.146.0-p5-c-all-r4\typecheck.log` | `result: ok`、`warnings: []`、`sourceVersion` は HEAD と一致。型検査のログは `tsc …` の1行だけ |
| ロックファイル | `sha256sum` で r3c と r4 の `lockfile.diff` | 同じ（`ef5f98ab…3862`） |

蒙恬の書き付けでは、1回目の install が pnpm の `concurrent package import did not settle` で止まり、install からやり直して通った。r4 の記録は2回目のもので、lockfile・型検査・パッケージ化は ok。

## 2. 網（静的なテスト）

| 確かめたこと | コマンド | 結果 |
|---|---|---|
| c1-unit | `node tests/run-all.mjs --no-ps --only c1-unit --save tasks/2026-11-15-p5-stagec-gate/c1-unit-r4.txt` | 60件、pass 60・fail 0・skip 0。見張りも通った |
| edits.patch の形 | `node tests/patch-shape.mjs removals/C-1-ai/edits.patch` | 「合う」、終了コード 0 |
| 区画と index の行 | edits.patch を数えた | `diff --git` 121、`index <前>..<後>` 121。作者・日付・件名は前と同じ |
| 網の報告（直した後） | `node tests/orphans-report.mjs C-1-ai --out tasks/2026-11-15-p5-stagec-gate/orphans-C-1-r4.txt` | サービス 0・設定 0・コマンド 1。残る1件は `workbench.action.unifiedQuickAccess`（`try/catch` で守られた呼び出し。c1-unit の `ORPHAN_ALLOW` に理由つきで入っている唯一の例外。リーダーの判断） |
| 網が落ちるべきときに落ちるか | `node tests/orphans-report.mjs C-1-ai --bare --out tasks/2026-11-15-p5-stagec-gate/orphans-C-1-bare-r4.txt` | edits.patch を外すと、サービス 33・コマンド 7 を数える。r2・r3 の誤り（`ITerminalChatService` の注入2か所、`IAgentNetworkFilterService` の注入2か所、`_chat.editSessions.accept` の git の呼び出し2か所、`_manageTrustedMCPServersForAccount` 3か所、`viewHiddenChatTerminals`）は全部入っている。網は効いている |
| 設定の網（B） | c1-unit の自己検査（968行。`searchView` の設定の鎖を見つけ、省略できる型にすると消えること） | 通った（60件の中） |
| ほかの静的なテスト | `node tests/run-all.mjs --no-ps --only removals`・`--only smoke`・`--only patch` | 229/229、80/80、17/17 |

r3c で網が数えた誤検出17件（`IInstantiationService` 16件、`IGitHubService` 1件）は、報告から消えた。曹参が網の登録の見方を「側（main・ワークベンチ・共通）ごと」に直したため（`tests/gate-orphans.mjs` 116〜156行）。この直しで、main にあってワークベンチに無い登録（`IAgentNetworkFilterService` の形）も見えるようになっている。網を緩めて通したのではない（上の `--bare` の結果）。

## 3. 起動の確かめ

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all-r4-ooka.json -Zip <zip> -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r4-ooka -InstallExtension <台帳の7つの VSIX>
```

`result: ok`。`--version` は `1.146.0` / `7fac30e8…` / `x64`。CLI の導入7つとも成功。ワークベンチのしるし3つ、ワークベンチのコンソールの `Uncaught` 0。普段使いのデータの6つのフォルダは変わらない。

## 4. スモーク1回

```
node tests/smoke-run.mjs --build E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r4-ooka/Shuko-win32-x64-1.146.0-p5-c-all-r4 --label p5r4-1 --mode built --prime --baseline E:/develop/self/Team/projects/ai-editor/tmp/b/smoke/baseline-p5-c-all-r3c.json --save-baseline E:/develop/self/Team/projects/ai-editor/tmp/b/smoke/baseline-p5-c-all-r4.json --timeout 300 --keep-runs 40
```

- 置き場所: `tmp\b\smoke\runs\p5r4-1-261116T090639\`（`.keep` を置いた）。
- PASS 49 / FAIL 0 / INFO 9。`errors.new`: 新しい誤りなし（r3c の基準と比べて）。誤りは renderer.log の既知の2行（DEP0169・DiffEditorWidget）だけ。exthost.log とコンソールに誤り・`Uncaught`・`UNKNOWN service`・`Missing proxy instance` は無い。
- r2 の3種の道も通った: `base.terminal`・`base.search`・`base.replace`・`base.git` が PASS。Git.log に `git add -A -- tracked.txt` と `git -c user.useConfigOnly=true commit …` がある。誤りは出ない。
- Claude Code の組（`claude.running` 2.1.322・`claude.exthost-log`・`claude.lock`）、言語の組、`base.ui-language`（ja）も PASS。
- 1回分の鍵は `tmp\b\smoke\baseline-p5-c-all-r4.json`（鍵2個。r3c の基準と同じ2つ）。次の版の比べの相手には、3回の和の `baseline-p5-c-all-r3c.json` を使う方がよい（r4 は1回だけ）。

## 5. r3c からの持ち越し（変わらないもの）

absent（19単位で fail 0）・通信の監査（2通り×600秒で宛先 0、続きの編集の通信なし）は、r3c の記録（`records/take-in/1.146.0-p5-c-all-r3c/gate-p5-c-all-r3c.md` の3節）を使う。木が同じなので、流し直していない。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、このフォルダ、`tasks/2026-11-15-p5-stagec-gate/`（`launch-check-p5-c-all-r4-ooka.json`・`c1-unit-r4.txt`・`orphans-C-1-r4.txt`・`orphans-C-1-bare-r4.txt`・`handoff-notes-ooka.md`）、台本が書く `tmp\b\` の下（`p2\1.146.0-p5-c-all-r4-ooka\`、`smoke\runs\p5r4-1-*`、`smoke\ext\1.146.0-p5r4-1\`、`smoke\baseline-p5-c-all-r4.json`）。
- `tmp\b\wt\r4` には `git -C … diff`・`status` だけを打った（読むだけ）。`C:\b` は読んでいない。普段使いのデータは、起動の確かめ（6つのフォルダが不変）とスモークの `safety.daily-argv`（PASS）で確かめた。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。秘密の場所には触れていない。

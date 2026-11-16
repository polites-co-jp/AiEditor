# 関門の記録: 段階 C をまとめた版 `1.146.0-p5-c-all-r2`（21単位。C-1 の product.json のキーの読み手を直した版）

- 検証: 大岡越前守、2026-11-16（UTC 03:55〜04:45 ごろ。JST は +9 時間）
- 依頼: リーダーの依頼「直した版 1.146.0-p5-c-all-r2 で、もう一度関門を通してほしい」（`tasks/2026-11-15-p5-stagec-gate/brief.md` の 3・3' と同じ中身）
- 相手: 蒙恬のビルド（`tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md`）
  - zip: `tmp\b\dist\1.146.0-p5-c-all-r2.zip`（SHA-256 `f41c4c77a8b6f04789fc288156a8665fcc98c7b852c9458d408f6916ee32a12e`。計算し直して一致）
  - 展開先: `tmp\b\p2\1.146.0-p5-c-all-r2\Shuko-win32-x64-1.146.0-p5-c-all-r2\`（version 1.146.0、commit `1efdfdf8230e97c9bd2d0076b8653e1a7d5cb1b2`）
  - 作業ツリー: `tmp\b\wt-r2\1.146.0`。ビルドの記録: `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/`
- 比べる相手: 前の段階の基準 `tmp\b\smoke\baseline-p2-all.json`（段階 A・B の14単位の3回の和）と、公式の基準 `tmp\b\smoke\baseline-official-1.146.0.json`。通信は `records/network-audits/2026-11-15-p2-all`・`-p2-all-ledger`
- 条件: docs/03 の7節の1〜4、各単位の台本 `tests/removals/c1-gate-script.md`〜`c7-gate-script.md`

## 判定

**不合格。原因は C-1-ai（4 壊れていない）。** C-2〜C-7 は、自動で見られる関門（1〜4）をすべて通った。手の項目が残る。

前回の2つの症状（ワークベンチが起動しない、CLI の導入が全部落ちる）は直った。ワークベンチが立ち上がったことで、前回は見えなかった誤りが3種見えた。どれも C-1 が消した部品の受け手が残っているもので、スモークの3回とも同じく出た。

1. `depends on UNKNOWN service terminalChatService`（ターミナルのタブのビューが作れない）
2. `Cannot read properties of undefined (reading 'semanticSearchBehavior')`（全文検索の欄の入力の聞き手）
3. `command '_chat.editSessions.accept' not found`（git のステージ・コミットのたび）

細目と直し方は `gate-C-1-ai.md`。

| 関門（docs/03 の7節） | 結果 | 要点 |
|---|---|---|
| 1 当たる | 合格 | 21単位すべて `applied: ok`。照らし役 c1〜c7 は、21単位の組（組 c）を含めて全部「期待どおり」 |
| 2 型検査とビルド | 合格 | 型検査は誤り 0。パッケージ化・zip まで ok。ロックファイルは ok で、差は前の版と同じ（SHA-256 一致） |
| 3 消えている | 合格 | absent の21単位: 起動して見る項目のある19単位で fail 0・unknown 0。通信の監査2通り×600秒で、エディタの宛先 0・claude の宛先 0・許可の外 0・前の版に無い宛先 0。続きの編集の通信も無い |
| 4 壊れていない | **不合格** | スモーク3回: PASS 48/FAIL 1、48/1、47/2。FAIL は3回とも errors.new（上の3種）と、3回目だけ base.ui-language（揺れ。下）。Claude Code の組・言語の組・台帳の拡張・CLI の導入は全部通った |

## 単位ごとの合否

| 単位 | 1 | 2 | 3 | 4 | 判定 | 記録 |
|---|---|---|---|---|---|---|
| C-1-ai | 合格 | 合格 | 合格 | **不合格** | **不合格** | `gate-C-1-ai.md` |
| C-2-debug | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C3・C4 | `gate-C-2-debug.md` |
| C-3-remote | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C5・C6 | `gate-C-3-remote.md` |
| C-4-notebook | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C7・C8 | `gate-C-4-notebook.md` |
| C-5-extension-gallery | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C9〜C11 | `gate-C-5-extension-gallery.md` |
| C-6-settings-sync | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C12〜C15 | `gate-C-6-settings-sync.md` |
| C-7-breadcrumbs-outline | 合格 | 合格 | 合格 | 合格（自動の分） | 自動の関門は合格。手の項目 C16〜C20 | `gate-C-7-breadcrumbs-outline.md` |
| A-1〜A-7・B-1〜B-7（14） | 合格 | 合格 | 合格（absent・監査） | 新しい誤りは C-1 の3種だけ | この版でも壊れていない | この表 |

- 「自動の関門は合格」は、この版で自動で見られる 1〜4 に、その単位の誤りが無いという意味。各単位の台本の「関門の起動の確かめ」のうち画面を見る項目は、手の項目（`manual-checks-p5-c-all-r2.md`）に分けた。手の項目は C-1 を直した次の版で行う。
- C-1 だけを無効にした版は作れない（C-3〜C-7 が `after` に C-1 を挙げる）。直すのがよい。直し方は小さい（何もしない実装の登録1つ、`?.` を3か所、コマンド1つか呼び出し2か所）。

## 1. 当たる・型検査とビルド

| 確かめたこと | コマンド・場所 | 結果 |
|---|---|---|
| zip の SHA-256 | `sha256sum E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r2.zip` | `f41c4c77…a32e12e`。依頼文・蒙恬の記録と一致 |
| 当てた単位 | `tasks/2026-11-16-p5-c1-product-keys/1.146.0-p5-c-all-r2/checks.json` | 21単位すべて `applied: ok`。`result: ok`、`stoppedAt: null`、`errors: []`。警告は C-2 の想定の1件だけ。HEAD は `1efdfdf8…cb1b2` |
| 照らし役（当て直し） | `node tests/c1-check-json.mjs <checks.json>` 〜 `c7-check-json.mjs` | 7つとも「期待どおり」（c2〜c6 は組 c、c7 は組 b）。曹参が足した組 c は、21単位ちょうど・並び・後の単位の edits の衝突なしまで照らす（c2 の作りを読んで確かめた。緩めてはいない） |
| 照らし役（作業ツリー） | `node tests/c1-check-worktree.mjs E:/develop/self/Team/projects/ai-editor/tmp/b/wt-r2/1.146.0` 〜 `c7-check-worktree.mjs` | 7つとも「期待どおり（作業ツリー）」 |
| C-1 の直し | `git diff -- removals/C-1-ai/edits.patch` | 8ファイル。`IProductConfiguration` の2つを省略できる型に、読み手を `?.`・`?? []`・早い `return` に。`defaultAccount.ts` はキーが無ければ空の設定を返し、提供者を作らず、待ちを開く。裁定の「product.json の AI のキーは消す」は守られている（出力の product.json に6つのキーは無い） |
| 型検査 | `build-record.json` の typecheck、`tmp\b\logs\1.146.0-p5-c-all-r2\typecheck.log` | 終了コード 0。ログは `tsc …` の1行だけ |
| パッケージ化・zip | `build-record.json`、`package.log` | 終了コード 0、`package.log` に `error` の行なし、記録の `warnings: []` |
| ロックファイル | `build-record.json` の lockfile、`sha256sum` で両方の版の `lockfile.diff` | `status: ok`。差は前の版（p5-c-all）と同じ（`ef5f98ab…3862`） |
| 静的なテスト | `node tests/run-all.mjs --no-ps --only -unit`、`--only removals`、`--only smoke`、`--only p1-` | c1〜c7-unit 292/292（c1-unit は 53/53。依頼文の「直している最中の2件」は直っていた）、removals 229/229、smoke 79/79、p1-launch-logs・p1-launch-workbench・p1-scripts 50/50。見張り（本物の作業場所の前後）も通った |

## 2. 展開と起動

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-15-p5-stagec-gate/launch-check-p5-c-all-r2-ooka.json -Zip <zip> -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r2-ooka -InstallExtension <台帳の7つの VSIX>
```

- `result: ok`、message `started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`。
- 新しい起動の確かめ（蒙恬の直し）で、ワークベンチのしるし3つ（`Started local extension host`・`Extension host with pid … started`・`Eager extensions activated`）がそろい、ワークベンチのコンソールの `Uncaught` は 0。
- CLI の導入は7つとも終了コード 0・`successfully installed`。Claude Code は、起動の確かめでは入れていない（ホームの Claude の設定に触れうるため。蒙恬と同じ）。スモークで入れた。
- 展開先は蒙恬の `tmp\b\p2\1.146.0-p5-c-all-r2\` と分けた（同じ zip を新しく展開した）。

## 3. 消えている

### absent（21単位）

```
node tests/absent-run.mjs --build <展開先> --units <21単位> --expect absent --label p5r2-21
```

- 置き場所: `tmp\b\smoke\absent\p5rdf7-261116T041407\`。網: runtime（コマンド 1908 件・設定 45 件）＋ manifest（拡張 65 件）。
- A-1 3・A-2 7・A-3 1・A-4 3・A-5 3・A-7 9・B-1 2・B-2 8・B-3 4・B-4 7・B-5 6・B-7 4・C-1 12・C-2 6・C-3 10・C-4 7・C-5 25・C-6 2・C-7 7、すべて pass。fail 0・unknown 0。A-6・B-6 は起動して見る項目が無い。
- 網の確かめ: 公式の版に C の7単位を `--expect present`（`tmp\b\smoke\absent\off362-261116T041503\`）。C-2〜C-7 の全項目と C-1 の10項目は公式の版に在る（網になっている）。C-1 の `search.action.showAIResults` と `agent-host` のプロセスは、公式の版でもこの環境では出ない（網にならない）。この2つはソースの消し残りの検査（absentStrings 0 件）を根拠にした。
- 台本だけが挙げる項目もスモークの commands.json（2322 件）で見た。`workbench.userDataSync.*`・`workbench.view.sync*`・`breadcrumbs*`・`workbench.action.debug.*`（開発用の2つを除く）・`notebook.*`・`workbench.action.remote*`・`workbench.action.chat.*`（画像のカルーセルの入口1つを除く）・`inlineChat*`・`workbench.mcp*` は無い。

### 通信の監査（netaudit）

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開先>/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r2 -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2-all
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <展開先>/Shuko.exe -EnvDir C:/b/p0/data/upstream-default -Label p5r2-ledger -DurationSeconds 600 -Previous records/network-audits/2026-11-15-p2-all-ledger
```

| 監査 | 記録 | エディタの宛先 | claude の宛先 | 許可の外 | 前の一覧に無い | 名前で見えたもの |
|---|---|---|---|---|---|---|
| p5r2（関門の環境。拡張なし、テレメトリと実験をユーザー設定で入れた） | `records/network-audits/2026-11-16-p5r2/` | 0 | 0 | 0 | 0 | `wpad` の解決4回（答え・接続なし）だけ |
| p5r2-ledger（台帳の拡張と言語パック、Claude Code を含む） | `records/network-audits/2026-11-16-p5r2-ledger/` | 0 | 0 | 0 | 0 | `wpad` の解決2回だけ |

- どちらも 300 回の取得、ネットのログは complete（134 件・85 件）。ネットのログは読んだ後に台本が消した（`tmp\b\netlog\` は空）。
- 宛先が Claude・git・Notion のほかに無いこと: 合格（エディタの宛先が 0）。Claude の宛先は、今回も送信していないので出ない（手の項目の後半で見る）。
- absentHosts（B-1 `mobile.events.data.microsoft.com`、B-2 `default.exp-tas.com`、B-6 `main.vscode-cdn.net`、C-1 `release-assets.githubusercontent.com`）と、C-5 の台本のギャラリーのホスト、C-6 の台本の同期のストア: 2通りとも、接続も名前の問い合わせも無い。
- **続きの編集（裁定 2026-11-15「通信があれば諮る」）**: 通信は無い。スモークの `editSessions.log` も3回とも空。よって諮ることは無い。細目は `gate-C-6-settings-sync.md`。
- 監査の限界（UDP・2秒より短い接続・管理者の権限が要る名前の取得・操作で起きる通信）は docs/07 の3.3 のとおり。
- `C:/b/p0/data/upstream-default` は読むだけ（台本が robocopy で `tmp\b\audit\` に写す）。C:\b には書いていない。

## 4. 壊れていない

```
node tests/smoke-run.mjs --build <展開先> --label p5r2-1 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r2.json --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build <展開先> --label p5r2-2 --mode built --prime --baseline tmp/b/smoke/baseline-official-1.146.0.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r2.json --merge-baseline --timeout 300 --keep-runs 40
node tests/smoke-run.mjs --build <展開先> --label p5r2-3 --mode built --prime --baseline tmp/b/smoke/baseline-p2-all.json --save-baseline tmp/b/smoke/baseline-p5-c-all-r2.json --merge-baseline --timeout 300 --keep-runs 40
```

（パスは絶対パスで渡した）

| 回 | 置き場所（`.keep` を置いた） | 比べた基準 | 結果 | FAIL |
|---|---|---|---|---|
| 1 | `tmp\b\smoke\runs\p5r2-1-261116T035921\` | p2-all | PASS 48 / FAIL 1 / INFO 9 | errors.new 24 件（C-1 の3種） |
| 2 | `tmp\b\smoke\runs\p5r2-2-261116T040352\` | 公式 | PASS 48 / FAIL 1 / INFO 9 | errors.new 24 件（同じ3種） |
| 3 | `tmp\b\smoke\runs\p5r2-3-261116T040704\` | p2-all | PASS 47 / FAIL 2 / INFO 9 | errors.new 24 件（同じ3種）、base.ui-language |

- 3回の和 `tmp\b\smoke\baseline-p5-c-all-r2.json`: `runs: 3`、鍵10個。C-1 の3種が8つ（renderer 4・exthost 1・devtools-console 3。同じ誤りが置き場所ごとに重なる）、既知の2つ（`TextModel got disposed before DiffEditorWidget model got reset`・`DEP0169 url.parse()`。どちらも公式と p2-all の基準にある）。**この基準は C-1 の誤りを含むので、次の版の比べの相手にしない**（次の版で作り直す）。
- 前の版（p2-all）にあって今回消えたもの: `tunnelApplicationConfig`（C-3 がトンネルを消したため）、`Remote Control auto-enable failed`（3回とも出なかった）。公式にあって今回消えたもの: `jsts-chat-features`・`[AgentHostCustomizationMarketplace]`（本家の AI の部品）。
- 誤りの行は、各回とも renderer.log の14行と exthost.log の2行だけ。main・共有プロセス・ptyhost・terminal・editSessions・userDataSync・ネットのログは3回とも誤りが無い（空）。

### 台本が特に見よとした項目

| 項目 | 結果 |
|---|---|
| 開発者ツールのコンソールの `depends on UNKNOWN service` | **出た**（`terminalChatService`。C-1）。ほかのサービス（`debugService`・`tunnelService`・`remoteExplorerService`・`remoteTunnelService`・`notebook*`・おすすめ・tips・ギャラリーのアカウント・`userDataSyncWorkbenchService`・`outlineService`・`breadcrumbsService`）は出ない |
| `Missing proxy instance` | 出ない（3回とも） |
| Claude Code の組 | 3回とも `claude.running`（2.1.322 が isActive）・`claude.exthost-log`・`claude.lock`（.lock が3個、MCP の port と一致）が PASS。`Claude VSCode.log` に誤りなし |
| 拡張ホストのログの `vscode.lm`・`vscode.chat`・`vscode.debug`・`openTunnel` の誤り | 無い。拡張ホストの誤りは `_chat.editSessions.accept`（git の拡張。C-1）の2行だけ |
| 全文検索（C-4） | `base.search`・`base.replace`・`base.ripgrep` が3回とも PASS。ただし欄の入力の聞き手で C-1 の誤りが出る（欄に打った検索が走るかは手の項目 C7） |
| 拡張の一覧と有効・無効（C-5） | コマンドは登録されている。台帳の拡張が CLI で入り、起動した。画面の操作は手の項目 C9 |
| 設定の画面（C-6） | 注入の誤りは無い。画面は手の項目 C12 |
| エディタのタブ・分割・差分エディタ（C-7） | `base.split`・`base.diff`・`base.window2` が3回とも PASS。見た目は手の項目 C16〜C18 |
| 台帳の拡張が起動する | PowerShell（セッションと PSScriptAnalyzer の診断、pwsh.exe）、basedpyright（診断・`useBundled`）、bash-ide（ShellCheck）、rainbow-csv、dotenv、pdf（プレビュー）、TypeScript・HTML・CSS・JSON・Markdown がすべて PASS |
| 「知らない contributes」の警告 | 出ない（拡張ホストのログにも renderer のログにも、`debuggers`・`breakpoints`・`notebooks`・`notebookRenderer`・`ViewContainerDoesnotExist` の語が無い）。記録が目的で、出ないのも正 |

### base.ui-language の揺れ（3回目だけ）

- 3回目は `vscode.env.language = en`。prime の起動で `languagepacks.json` はできた（中身は1回目と同じ。hash `bf8a15d7…` で、notion-sync と日本語の言語パックの2つ）。`argv.json` の `locale` も `ja`。ただし、本番の起動で翻訳の束の置き場（`user-data\clp\<hash>.ja\`）が作られず、本体が言語パックを使わなかった。1回目・2回目は ja。
- Phase 1 の `1.146.0-p1-a1` の同じ FAIL は、product.json に commit が無いのが原因だった。今回は commit がある（`1efdfdf8…`）ので、別の原因。p2-all の3回では出ていない。
- どの単位の誤りかは分からない（原因未確認）。単位の合否には使わず、揺れとして記録した。次の版の3回でもう一度見る。2回以上出たら、C-5（拡張の管理）と C-1（本体の起動の部品）を疑って調べる。

## 5. 気づいた点（テストと台本）

1. **スモークの devtools-console の鍵に、版の置き場所のパスが入る。** 曹参の直しで、コンソールの誤りを拾うようになった（よい）。ただ、鍵は `source: vscode-file://vscode-app/e:/…/tmp/b/p2/<版>/…/workbench.desktop.main.js (39)` の全体なので、置き場所の違う版どうしでは同じ誤りが「新しい誤り」に見える。今回の errors.new の24件のうち10件は、renderer.log の同じ誤りの重なり。鍵の中のパスをそろえる（`<path>` に置き換える）とよい。`tests/smoke/lib/common.mjs` の鍵の作り方（曹参）。
2. **起動の確かめ（`p1-launch-check.ps1`）は、ワークベンチのしるしを見るようになった**（蒙恬の直し。今回 ok）。ただ、今回の3種の誤りは、起動の確かめでは見えない（ターミナル・検索・git を動かしたときに出る）。関門ではスモークで見るので、これで足りる。
3. **照らし役 c7 は組 b と名乗る**（C-3 の有無で見分けるため）。21単位でも中身は照らされている。名前の上の食い違いだけ。
4. **C-1 の網の穴**（`gate-C-1-ai.md`）。サービスの ID の注入・設定のキーの読み手・コマンドの呼び手が残っていないことを見る静的な検査が無い。

## 6. 守ったこと

- コード・テスト・台本・docs/ は直していない。書いたのは、この `records/take-in/1.146.0-p5-c-all-r2/`、`records/network-audits/2026-11-16-p5r2/`・`-p5r2-ledger/`（台本が書く）、`tasks/2026-11-15-p5-stagec-gate/`（`launch-check-p5-c-all-r2-ooka.json`・`handoff-notes-ooka.md`）、台本が書く `tmp\b\` の下（`p2\1.146.0-p5-c-all-r2-ooka\`、`smoke\runs\p5r2-*`、`smoke\ext\1.146.0-p5r2-*`、`smoke\absent\p5rdf7-*`・`off362-*`、`smoke\baseline-p5-c-all-r2.json`、`audit\`）。
- `C:\b` は読むだけ（監査の環境の写しの元）。普段使いのデータは、起動の確かめ（6つのフォルダが不変）とスモークの `safety.daily-argv`（3回とも PASS）で無事を確かめた。local.json・スタートメニュー・PATH・タスクスケジューラ・Notion は変えていない。秘密の場所には触れていない。ネットのログは台本が読んだ後に消した。
- C: の空き: 96.33 GB（前回の終わり、03:02）→ 95.86 GB（04:26）→ 95.60 GB（04:38）。この間に流したのは、tmp\b に書く台本と、Claude Code を入れたスモーク3回・監査1回。C: の何が増えたかは、私の読める場所の外で分からない（Claude Code の CLI がホームに書くもの、Windows の一時ファイルなどが考えられる。推定）。

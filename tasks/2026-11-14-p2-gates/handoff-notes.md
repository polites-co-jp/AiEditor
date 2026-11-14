# 引き渡しの覚え: Phase 2 の版ごとの関門（大岡越前守）

- 担当: 大岡越前守、2026-11-14
- 依頼: `brief.md`（このフォルダ）。版の一覧は `tasks/2026-11-14-p2-builds/builds.md`
- 版ごとの記録: `records/take-in/<label>/gate-<id>.md`。進め方と流したコマンドは `verification-log.md`

## 状態

builds.md の14版（A-1〜B-7）をすべて確かめ終えた。

- 4つとも合格: **A-3・A-6・B-5・B-6**（`enabled: true` にしてよい）
- 不合格: **B-1**（関門の4。新しい誤り）
- 判定できない: **A-1・A-2・A-4・A-5・A-7・B-2・B-3・B-4・B-7**（関門の3。台本の網の不備。1・2・4 は合格）

## 版ごとの表

1 当たる / 2 型検査とビルド / 3 消えている / 4 壊れていない（docs/03 の7節）。「判定できない」は、台本の網が働かず、関門の条件を確かめられなかったもの。「代わりの証拠」は判定に使っていない（使うかはリーダーが決める）。

| 版 | 単位 | 1 | 2 | 3 | 4 | 理由 |
|---|---|---|---|---|---|---|
| `1.146.0-p2-A-1`（土台を兼ねる） | A-1-copilot-extension | 合格 | 合格 | 判定できない | 合格 | 3: 設定の検査は登録の無いキーでも「在る」を返す（probe の不備。対照で確かめた）。コマンド2件は公式でも登録されず網にならない（代わりの証拠: ID の文字列が出力に無い）。4: 3回とも新しい誤り5件 = Phase 1 で仕分け済み3件 + 土台の notion-sync の `No bundle location found` 2件。A-1 が足した誤りは無い |
| `1.146.0-p2-A-2` | A-2-accounts-extensions | 合格 | 合格 | 判定できない | 合格 | 3: 設定3件は probe の不備、コマンド2件は公式でも登録されない（代わりの証拠: 3件の拡張が A-1 の拡張の一覧に在り A-2 に無い）。4: 3回とも新しい誤りなし |
| `1.146.0-p2-A-3` | A-3-debug-extensions | 合格 | 合格 | 合格 | 合格 | 3: `extension.node-debug.toggleAutoAttach` が公式・A-1・A-2 に在り A-3 に無い。4: 新しい誤りなし |
| `1.146.0-p2-A-4` | A-4-notebook-extensions | 合格 | 合格 | 判定できない | 合格 | 3: 設定1件は probe の不備、コマンド2件は公式でも登録されない（代わりの証拠: `vscode.ipynb` が A-3 に在り A-4 に無い）。4: 新しい誤りなし |
| `1.146.0-p2-A-5` | A-5-remote-extensions | 合格 | 合格 | 判定できない | 合格 | 3: コマンド2件は `onTunnel` でしか起動しない拡張のもので、公式でも登録されない（代わりの証拠: 拡張が A-4 に在り A-5 に無い）。ポートのビューのコマンド7件が消えた（intent の「ポートのビューは残す」と違う）。4: 2回とも新しい誤りなし。Claude Code のビューが起動時に開かなかった（A-6 で戻った。原因不明） |
| `1.146.0-p2-A-6` | A-6-themes | 合格 | 合格 | 合格 | 合格 | 3: checks は空。拡張の一覧で、消した10件が A-5 に在り A-6 に無いことを確かめた。4: 新しい誤り1件は A-1〜A-4 の既知の Remote Control の誤り（A-5 で出なかっただけ）。1回だけ Claude Code の Webview の ResizeObserver の行が 1,943 行出た（INFO） |
| `1.146.0-p2-A-7` | A-7-unused-extensions | 合格 | 合格 | 判定できない | 合格 | 3: 設定6件は probe の不備、コマンド3件は公式でも登録されない（代わりの証拠: 7件の拡張が A-6 に在り A-7 に無い）。4: 新しい誤りなし |
| `1.146.0-p2-B-1` | B-1-telemetry | 合格 | 合格 | 判定できない | **不合格** | 4: `Error: command '_aiEdits.clearAiContributions' not found`（renderer・exthost）。git の拡張が呼ぶコマンドの登録を B-1 が消した。3: absentHosts は接続なしで条件を満たす（A-7 も接続なし。OSS の product.json にテレメトリの鍵が無い）。コマンド1件は公式でも登録されない、設定2件は probe の不備 |
| `1.146.0-p2-B-2` | B-2-onboarding-experiments-surveys | 合格 | 合格 | 判定できない | 合格 | 3: コマンド5件は公式・B-1 に在り B-2 に無い。absentHosts `default.exp-tas.com` は接続なし（A-7・B-1 も接続なし。`tasConfig` が無い）。設定3件は probe の不備。4: B-1 と比べて新しい誤りなし（B-1 の誤りは持ったまま） |
| `1.146.0-p2-B-3` | B-3-issue-share | 合格 | 合格 | 判定できない | 合格 | 3: `openIssueReporter` は公式・B-2 に在り B-3 に無い。`share` は公式でも無い。設定2件は probe の不備。4: 新しい誤りなし |
| `1.146.0-p2-B-4` | B-4-outline-view | 合格 | 合格 | 判定できない | 合格 | 3: コマンド3件・ビュー1件は公式・B-3 に在り B-4 に無い。設定3件は probe の不備。4: 新しい誤りなし。指摘: 残したパンくずリストの部品が消えた設定 `outline.icons` を読む（既定でパンくずリストは無効） |
| `1.146.0-p2-B-5` | B-5-theme-switching | 合格 | 合格 | 合格 | 合格 | 3: コマンド6件が公式・B-4 に在り B-5 に無い。4: 2回とも新しい誤りなし |
| `1.146.0-p2-B-6` | B-6-online-feeds | 合格 | 合格 | 合格 | 合格 | 3: absentHosts `main.vscode-cdn.net` は接続なし（A-7 以降どの版も接続なし。`emergencyAlertUrl` が無い）。4: 新しい誤りなし。`wpad` の名前の解決は2回残る（接続なし） |
| `1.146.0-p2-B-7`（段階 A・B の全部） | B-7-terminal-suggest | 合格 | 合格 | 判定できない | 合格 | 3: コマンド2件は公式・B-5 に在り B-7 に無い。設定2件は probe の不備。4: 新しい誤りなし（ターミナル・PowerShell も PASS） |

## 直す必要があるところ

- 曹参: `tests/removals/probe/extension.js` の15行。`getConfiguration().inspect(key) !== undefined` は登録の無いキーでも true になる。absentSettings がどの版でも fail する。対照のキー `zzzShukoControl.never.registered` で再現（`C:\b\smoke\absent\p2-A-1-control-20261114T130636\`）。単体テスト（`node --test tests/absent.test.mjs`、14件合格）は判定の関数だけを見るので、この不備を捕まえない
- 曹参・蒙恬: absentCommands は実行時に登録されたコマンドだけを見る。起動しない拡張（github・ipynb・tunnel-forwarding・公式で起動しない copilot・A-7 の拡張）のコマンドと、B-1 の `showTelemetry`・B-3 の `share` は公式でも「無い」ので網にならない。manifest の `contributes` も見るか、公式で `--expect present` が通るものを選ぶ。A-6 のように起動して見る項目が無い単位は、拡張の一覧を照らせるようにする案もある
- 蒙恬: B-1 の `edits.patch` に `_aiEdits.clearAiContributions` の何もしない登録を足す（B-1 の記録の4節）
- 蒙恬: 土台の notion-sync が、日本語の表示で起動のたびに `[error] No bundle location found for extension shuko.notion-sync` を出す（組み込みの拡張に言語パックの翻訳が無いと出る）
- 蒙恬・リーダー: A-5 でポートのビューが消えた点（intent と違う）、B-4 でパンくずリストの記号のアイコンが出なくなる見込みの点を README に書くか決める

probe を直した後は、各版の関門の3だけを `node tests/absent-run.mjs --build <版> --units <単位> --expect absent`（と公式に `--expect present`）で流し直せば足りる（1版1分ほど）。B-1 を直した版は、1〜4 を確かめ直す。

## 気づいた点（合否に使っていない）

- 通信の監査（テレメトリ・実験を on にした環境、600 秒）で、A-7・B-1・B-2・B-6 のどの版もエディタの宛先は 0 件だった。OSS の product.json に `enableTelemetry`・`aiConfig`・`tasConfig`・`emergencyAlertUrl` が無いため、B-1・B-2・B-6 の効き目は監査では見えない
- A-5 の2回だけ Claude Code のビューが起動時に開かなかった。A-6 の1回だけ Claude Code の Webview が ResizeObserver の行を 1,943 行出した。B-5 の1回だけ2つめのウィンドウの `.lock` が数えた時点で無かった。どれも繰り返しでは出ず、揺れと見た。パネルの見え方はユーザーの手の項目で見てもらう
- 手の項目（パネルからの送信など）とパネルからの送信は行っていない

## 次の担当

- 蒙恬: A-3・A-6・B-5・B-6 を `enabled: true` にする。B-1 を直す
- 曹参: probe の設定の見方とコマンドの見方を直す
- リーダー: 上の直しの後、関門の3の流し直しを検証役に依頼する。「代わりの証拠」で判定してよいかを決める

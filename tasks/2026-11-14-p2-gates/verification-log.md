# 検証の記録: Phase 2 の版ごとの関門（大岡越前守）

- 担当: 大岡越前守、2026-11-14（JST 22:00〜23:15）
- 依頼: `brief.md`。版の一覧: `tasks/2026-11-14-p2-builds/builds.md`（14版。土台の `1.146.0-p2-base` はパッケージ化で落ちたので、A-1 の版が土台を兼ねる）
- 版ごとの合否と根拠: `records/take-in/<label>/gate-<id>.md`。一覧: `handoff-notes.md`
- 権限: `team/departments/development/ooka-echizen/permissions.json` を読んでから始めた

## 1. 進め方

版ごとに、builds.md の上から順に次を行った。

1. **当たる**: `tasks/2026-11-14-p2-builds/<label>/checks.json` の `result`・`errors`・`warnings`、単位ごとの `applied`・`removeLines` の `found`・`edits.conflicts`、検査（remnants・absentStrings・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity）の `status`、ロックファイルの追加・版の変化・予期しない削除を Grep で読んだ。`edits.patch` のある単位（A-6・B-1・B-2・B-3・B-7）は差分を読んだ
2. **型検査とビルド**: `build-record.json`（A-1 は `build-record-install.json` も）の手順ごとの `status`・`exitCode`、`productCommit.ok`、`sourceVersion.matchesChecksHead`、展開した `resources\app\product.json` の `commit`。zip の SHA-256 は `sha256sum` で計算し直して builds.md と比べた（14版とも一致）
3. **消えている**: `node tests/absent-run.mjs`（`tests/removals/run-absent.mjs` の包み。直接の形は許可に無く止められた）で、公式の zip に `--expect present`、版に `--expect absent`。absentHosts のある単位（B-1・B-2・B-6）は `scripts/netaudit.ps1`
4. **壊れていない**: `node tests/smoke-run.mjs --mode built --prime --baseline <前の版の基準> --save-baseline <この版の基準>`。組は台本の既定（base・claude-code・languages）。absence の組は3で行った

### スモークの基準の作り方

- A-1 は公式の基準 `C:\b\smoke\baseline-official-1.146.0.json` と比べ、Phase 1 の r3（`records/phase1/smoke-built-1.146.0-p1-a1-r3.md`）の仕分けと照らした
- A-1・A-2 は3回走らせ、3回の和を次の版の基準にした（docs/06 の5節）。2版とも、3回の誤りの鍵は毎回同じだった
- A-3 からは1回を基本にし、新しい誤りや前と違うふるまいが出た版（A-5・A-6・B-5）だけ繰り返して揺れを見た。基準は走らせた回の和。B-1 は誤りの原因がコードで決まる（git のコミットで必ず起きる）ので1回で判定した
- 基準のファイル: `C:\b\smoke\baseline-p2-<id の頭>.json`。B-1 以降の基準は B-1 の誤り2件を含む（後の単位が足した誤りだけを見るため）

### 通信の監査の環境

`tasks/2026-11-14-p2-gates/netaudit-env/`（検証役が作った環境のひな形）。ユーザー設定で `telemetry.telemetryLevel: all`・`workbench.enableExperiments: true`・`security.workspace.trust.enabled: false`。台帳の拡張は入れていない（`ext\` は説明のファイルだけ）。前の版（A-7）と同じ条件で、600 秒ずつ比べた。

## 2. 流したコマンドと結果（要点）

| 時刻（JST） | コマンド | 結果 |
|---|---|---|
| 22:0x | `sha256sum`（A-1〜A-3 の zip） | 3つとも builds.md と一致（以後の版も同様に一致） |
| 22:04 | `node tests/removals/run-absent.mjs …` | **止められた**（許可に無い。`node tests/*.mjs` の `*` は `/` を含まない）。包み `tests/absent-run.mjs` を使った |
| 22:04 | `node tests/absent-run.mjs --units A-1-copilot-extension --expect present` | 公式: コマンド2件が「無い」、設定1件が「在る」 |
| 22:05 | 同 `--build <A-1> --expect absent` | 設定1件が「在る」で fail |
| 22:06 | 対照 `--setting zzzShukoControl.never.registered --cmd zzzShukoControl.never.registered --setting editor.fontSize` | 登録の無い設定も「在る」（probe の不備を確定）。登録の無いコマンドは「無い」 |
| 22:07〜22:13 | A-1 のスモーク3回 | 3回とも PASS 48 / FAIL 1（errors.new 5件。仕分けは A-1 の記録） |
| 22:12 | `--units A-2,A-3,A-4,A-5 --expect present`（公式） | A-3 の1件だけが網として働く。A-2・A-4・A-5 のコマンドは公式でも「無い」 |
| 22:13〜22:18 | A-2 の消えている・スモーク3回 | スモーク3回とも PASS 49 |
| 22:18〜22:20 | A-3 | 消えている pass、スモーク PASS 49 |
| 22:19〜22:22 | A-4 | スモーク PASS 49 |
| 22:24〜22:28 | A-5（スモーク2回） | 2回とも PASS 49。Claude Code のビューが起動時に開かない |
| 22:29〜22:34 | A-6（スモーク3回） | 3回とも FAIL 1（既知の Remote Control の誤り）。1回目に ResizeObserver の行 1,943 |
| 22:39〜22:49 | `scripts/netaudit.ps1 -Exe <A-7> -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p2gate-A-7 -DurationSeconds 600` | 宛先 0 件（`wpad` の名前の解決だけ） |
| 22:39 | `--units A-7,B-1,B-2 --expect present`（公式） | A-7 のコマンド3件・B-1 のコマンド1件は公式でも「無い」。B-2 は 8 件とも「在る」 |
| 22:40〜22:43 | A-7 | スモーク PASS 49 |
| 22:42〜22:45 | B-1 | **スモーク FAIL 1**（`_aiEdits.clearAiContributions` not found） |
| 22:45〜22:48 | B-2 | 消えている（コマンド5件 pass）、スモーク PASS 49 |
| 22:49〜22:59 | netaudit B-1 | 宛先 0 件 |
| 22:50 | `--units B-3,B-4,B-5,B-7 --expect present`（公式） | B-3 の `workbench.action.share` だけ公式でも「無い」。ほかのコマンド・ビューは「在る」 |
| 22:50〜22:56 | B-3・B-4 | スモーク PASS 49 |
| 22:55〜22:59 | B-5（スモーク2回） | 2回とも PASS 49 |
| 23:00〜23:10 | netaudit B-2 | 宛先 0 件 |
| 23:01〜23:03 | B-6 のスモーク | PASS 49 |
| 23:03〜23:13 | netaudit B-6（B-2 と時間が重なった。どちらも自分の起動した木だけを見る） | 宛先 0 件 |
| 23:05 | `node --test tests/absent.test.mjs` | 14 件合格（判定の関数だけの試験で、probe の不備は捕まえない） |
| 23:11〜23:14 | B-7 の消えている・スモーク | コマンド2件 pass、スモーク PASS 49 |

## 3. 版をまたいで見つけたこと

- **probe の設定の検査の不備**（曹参、`tests/removals/probe/extension.js` の15行）。`vscode.workspace.getConfiguration().inspect(key) !== undefined` は、登録の無いキーでも true になる。absentSettings を持つ単位（A-1・A-2・A-4・A-7・B-1・B-2・B-3・B-4・B-7）の関門の3が、どの版でも決められない
- **コマンドの検査の空振り**（曹参・蒙恬）。台本は実行時に登録されたコマンドだけを見る。起動しない組み込み拡張のコマンド（A-1・A-2・A-4・A-5・A-7）と、公式で登録されないもの（B-1 の `showTelemetry`、B-3 の `share`）は、公式でも「無い」ので網にならない
- **土台の notion-sync の誤り**（蒙恬）。日本語の表示で、起動のたびに `[error] No bundle location found for extension shuko.notion-sync`
- **B-1 の新しい誤り**（蒙恬）。git の拡張が呼ぶ `_aiEdits.clearAiContributions` の登録が消えた
- **通信の監査で単位の効き目が見えない**: OSS の product.json に `enableTelemetry`・`aiConfig`・`tasConfig`・`emergencyAlertUrl` が無いので、単位を当てる前（A-7）から、テレメトリ・実験・緊急の知らせの宛先へ接続しない。absentHosts の条件（接続が無い）は満たすが、単位を外しても同じ結果になる
- **WPAD**: A-7・B-1・B-2・B-6 の監査で、`wpad` の名前の解決が2回ずつあった（答え無し、接続なし）。patch 30 を当てた版でも名前の解決は残る（判定には使っていない）

## 4. 書き込んだ場所

- `records/take-in/<label>/gate-<id>.md`（14件）、`records/network-audits/2026-11-14-p2gate-{A-7,B-1,B-2,B-6}/`
- `tasks/2026-11-14-p2-gates/`（`handoff-notes.md`・`verification-log.md`・`netaudit-env/`）
- スクリプトが書いた場所: `C:\b\smoke\absent\p2-*`・`C:\b\smoke\runs\p2-*`・`C:\b\smoke\ext\1.146.0-p2-*`・`C:\b\smoke\baseline-p2-*.json`・`C:\b\p0\run\`（回の後に消える）・`C:\b\p0\netlog\`
- `C:\b\smoke\runs\` に `.keep` を置けなかった（書き込み先の外）。代わりに `--keep-runs 40` で走らせた（A-1 の3回だけは既定の 10 で走らせた）

# 引き渡しの覚え: B-1 の直しの検証と、B-1〜B-7（-r2）の関門（大岡越前守）

- 担当: 大岡越前守、2026-11-15
- 依頼: `brief.md`（このフォルダ）
- 進め方と流したコマンド: `verification-log.md`。テストの件数: `run-all-counts.txt`
- 版ごとの合否と根拠: `records/take-in/1.146.0-p2-B-<n>-r2/gate-<id>.md`（7件）、通信の監査: `records/network-audits/2026-11-15-p2gate-{B-1-r2,B-2-r2,B-6-r2}/`
- 判定: **合格**（brief の1〜5 のすべて）

## brief の1〜5

| 項目 | 合否 | 理由 |
|---|---|---|
| 1. レビュー | 合格 | B-1 の edits.patch の3つの登録（has は `() => false`、clear と clearAll は `() => { }`）は、本家 1.146.0 の `editTelemetryContribution.ts` 57〜59行の「何もしない代わり」と同じ中身。呼び手は git の拡張の8か所だけ。README の理由（新しいファイルにしない理由、`showTelemetry` を外した理由、壊れたときの症状）も合う。build.mjs の `childEnv`（外の `BUILD_SOURCEVERSION` を名前の大文字小文字を問わず外す）と、枝 `builds/<label>`（`markBuildCommit`。失敗しても止めない、後処理では commit が一致したときだけ付ける）は、蒙恬の覚えのとおり。曹参のテスト29件も仕様を確かめている |
| 2. 版ごとの関門の1〜4 | 合格 | 7版とも1〜4が合格（下の表） |
| 3. notion-sync の翻訳 | 合格（B-4-r2 以降） | B-4-r2〜B-7-r2 に `dist/i18n/` の束と `contributes.localizations` が入り、errors から `No bundle location found for extension shuko.notion-sync` が消えた。B-1-r2〜B-3-r2 には入っていない（作り直しが翻訳の直しより前だった）。この3版では誤りが残るが、前の段階からある鍵なので「新しい誤り」ではない |
| 4. 記録 | 済み | 下の「記録」 |
| 5. テスト | 合格 | `node tests/run-all.mjs --save`: **tests 1581、pass 1569、fail 0、skip 12**。曹参の `build-env-branch.test.mjs`（29件、合格 29）は入っていた。B-1 の直しと build.mjs の直しは、未コミットのまま作業ツリーに入っていた |

## 単位ごとの関門の結び

1 当たる / 2 型検査とビルド / 3 消えている / 4 壊れていない（docs/03 の7節）。

| 版 | 単位 | 1 | 2 | 3 | 4 | 要点 |
|---|---|---|---|---|---|---|
| `1.146.0-p2-B-1-r2` | B-1-telemetry | 合格 | 合格 | 合格 | **合格**（前回は不合格） | 3: 設定2件は A-7 で在り、B-1-r2 で無い。absentHosts は接続なし。4: PASS 49。git のコミットの後も `_aiEdits.* not found` は出ない |
| `1.146.0-p2-B-2-r2` | B-2-onboarding-experiments-surveys | 合格 | 合格 | 合格 | 合格 | 3: 8件とも B-1-r2 で在り、B-2-r2 で無い。absentHosts は接続なし。4: 2回とも PASS 49 |
| `1.146.0-p2-B-3-r2` | B-3-issue-share | 合格 | 合格 | 合格 | 合格 | 3: 4件（替えた `toggle.workbench.experimental.share.enabled` を含む）。4: 1回目の FAIL は前の段階からある揺れる誤り（Remote Control）。基準を2回の和にした2回目は PASS 49 |
| `1.146.0-p2-B-4-r2` | B-4-outline-view | 合格 | 合格 | 合格 | 合格 | 3: 7件。4: PASS 49。notion-sync の誤りが消えた |
| `1.146.0-p2-B-5-r2` | B-5-theme-switching | 合格 | 合格 | 合格 | 合格 | 3: 6件。4: PASS 49（前回に合格、`enabled: true` 済み） |
| `1.146.0-p2-B-6-r2` | B-6-online-feeds | 合格 | 合格 | 合格 | 合格 | 3: absentHosts `main.vscode-cdn.net` は接続なし。4: PASS 49（前回に合格、`enabled: true` 済み） |
| `1.146.0-p2-B-7-r2`（段階 A・B の全部） | B-7-terminal-suggest | 合格 | 合格 | 合格 | 合格 | 3: 4件。12単位の checks を全部この版で流して fail 0。4: PASS 49 |

1・2の根拠（7版とも同じ）: zip の SHA-256 は builds.md と一致。`checks.json` の `result: ok` で、誤り・警告・衝突は無い。2つの build-record の `result: ok` で、終了コードはすべて 0。`productCommit.ok`・`matchesChecksHead` が true。展開した product.json の commit も、枝 `builds/<label>` の指す commit も、builds.md と一致。

### `enabled: true` にしてよい単位（今回の分）

- `B-1-telemetry`
- `B-2-onboarding-experiments-surveys`
- `B-3-issue-share`
- `B-4-outline-view`
- `B-7-terminal-suggest`

すでに `enabled: true` の B-5・B-6 も、B-1 を直した版の上で4つとも合格のまま。これで段階 A・B の14単位が全部そろう。

## 記録

- `records/take-in/1.146.0-p2-B-1-r2/gate-B-1-telemetry.md`
- `records/take-in/1.146.0-p2-B-2-r2/gate-B-2-onboarding-experiments-surveys.md`
- `records/take-in/1.146.0-p2-B-3-r2/gate-B-3-issue-share.md`
- `records/take-in/1.146.0-p2-B-4-r2/gate-B-4-outline-view.md`
- `records/take-in/1.146.0-p2-B-5-r2/gate-B-5-theme-switching.md`
- `records/take-in/1.146.0-p2-B-6-r2/gate-B-6-online-feeds.md`
- `records/take-in/1.146.0-p2-B-7-r2/gate-B-7-terminal-suggest.md`
- `records/network-audits/2026-11-15-p2gate-B-1-r2/`・`2026-11-15-p2gate-B-2-r2/`・`2026-11-15-p2gate-B-6-r2/`（台本が書いた）
- このフォルダ: `verification-log.md`・`run-all-counts.txt`・この覚え
- 台本が書いた場所:
  - `C:\b\smoke\absent\r2-*`（17回）
  - `C:\b\smoke\runs\p2-B-*-r2*`（9回）
  - `C:\b\smoke\ext\1.146.0-p2-B-*-r2*`
  - `C:\b\smoke\baseline-p2-B-{1..7}-r2.json`（B-2-r2・B-3-r2 は2回の和）

## リーダーに諮る点・知らせる点

- **「在る」ことは台本では確かめられない**: B-1 で残した `_aiEdits.*` は `_` で始まる内部のコマンドで、probe の `getCommands(true)` が一覧から除く。本家の A-7 でも「無い」と出る（対照の3回で確かめた）。今回の「在る」の根拠は、スモークの errors.new（git のコミットの後に誤りが出ない）と、出力の `workbench.desktop.main.js` の登録の文字列の2つ。蒙恬が挙げた docs/03 の7節の件（在ることの検査の形を足すか）を決めるときは、この網の限界も一緒に見る必要がある
- **揺れる誤りと基準**: `Remote Control auto-enable failed`（Claude Code 拡張）は出たり出なかったりする。1回だけで作った基準からは抜けることがあり、B-3-r2 の1回目が空振りの FAIL になった。基準を2回以上の和にする運用を、docs/06 の5節に書くかどうか（前回の関門の進め方では、新しい誤りが出た版だけ繰り返していた）
- docs の食い違いは、作業ツリーで直されている途中（docs/02 の4節の8に枝の行、docs/03 の4節の B-1 に `_aiEdits.*` の行）。docs/02 の7節の記録の例に `branch` が足されたかは、見ていない
- 曹参の覚えにある「`removals.test.mjs` の飛ばしが 21 から 12 に減った」理由は、`enabled: true` の単位が増えたため（`6ba9e53`）。B-1 の直しとは関係ない

## 気づいた点（合否に使っていない）

- notion-sync が `contributes.localizations` を持つので、`languagepacks.json` の `ja` に `shuko.notion-sync` が言語パックと並んで入る。本体の翻訳は言語パックのものが使われていて、表示は日本語（base.ui-language PASS）。言語の選択の一覧の見え方は、手の項目で見る
- 通信の監査は3回とも宛先 0。出力の product.json にテレメトリ・実験・緊急の知らせの鍵が無いので、単位を当てる前から接続しない（前回と同じ）

## 次の担当

- 蒙恬: B-1・B-2・B-3・B-4・B-7 を `enabled: true` にする
- リーダー: B-1 の直しと build.mjs の直しをコミットする（検証は通った）。そのうえで、全部を有効にした版を作り、スモークの全部の組・通信の監査・ユーザーの手の項目へ進む

# Phase 2 の結び（段階 A・B の試作）

- 記録: 大岡越前守、2026-11-15
- 根拠の検証: `tasks/2026-11-15-p2-all-verify/verification-log.md`
- 条件: docs/07 の5節（4と完了の条件）

## 1. 結論

- 段階 A・B の14単位は、すべて関門（docs/03 の7節）に合格し、`enabled: true` になった（commit `6ba9e53` で A、`be77bef` で B-1・B-2・B-3・B-4・B-7。B-5・B-6 はそれより前）。無効のまま残した単位は無い。
- 14単位を `enabled: true` にして作った版 `1.146.0-p2-all`（commit `d5fd4c3a…0aa`）で、次を確かめた。
  - スモークの自動の組を3回流し、すべて通った。基準は3回の和で作った。
  - 消えたはずの項目は、14単位の checks で全部無かった。
  - 通信の監査（2通り、各600秒）では、エディタの外向きの宛先が0件だった。
- 残るのは、ユーザーが手で見る項目（`manual-checks-p2-all.md`）と、その回に重ねる Claude の宛先の監査（裁定 2026-11-13）。これが通れば、docs/07 の5節の完了の条件がそろう。

## 2. 14単位の関門の一覧

判定は最後の記録のもの。「1回目」の欄の「判定できない」は、消えているの網（実行時の照会）が足りなかったもので、網を直したあとに同じファイルの後ろの節で合格にした（A）か、`-r2` の版で確かめ直した（B）。

| 単位 | 最後の判定（1〜4） | 記録 | 1回目の経緯 |
|---|---|---|---|
| A-1-copilot-extension | 合格 | `records/take-in/1.146.0-p2-A-1/gate-A-1-copilot-extension.md` | 3 が判定できない → 同じファイルで合格 |
| A-2-accounts-extensions | 合格 | `records/take-in/1.146.0-p2-A-2/gate-A-2-accounts-extensions.md` | 同上 |
| A-3-debug-extensions | 合格 | `records/take-in/1.146.0-p2-A-3/gate-A-3-debug-extensions.md` | — |
| A-4-notebook-extensions | 合格 | `records/take-in/1.146.0-p2-A-4/gate-A-4-notebook-extensions.md` | 3 が判定できない → 同じファイルで合格 |
| A-5-remote-extensions | 合格 | `records/take-in/1.146.0-p2-A-5/gate-A-5-remote-extensions.md` | 同上 |
| A-6-themes | 合格 | `records/take-in/1.146.0-p2-A-6/gate-A-6-themes.md` | — |
| A-7-unused-extensions | 合格 | `records/take-in/1.146.0-p2-A-7/gate-A-7-unused-extensions.md` | 3 が判定できない → 同じファイルで合格 |
| B-1-telemetry | 合格 | `records/take-in/1.146.0-p2-B-1-r2/gate-B-1-telemetry.md` | 1回目（`1.146.0-p2-B-1`）は 4 が不合格（git のコミットの後の `_aiEdits.*` の誤り）。edits を直した `-r2` で合格 |
| B-2-onboarding-experiments-surveys | 合格 | `records/take-in/1.146.0-p2-B-2-r2/gate-B-2-onboarding-experiments-surveys.md` | 1回目は 3 が判定できない |
| B-3-issue-share | 合格 | `records/take-in/1.146.0-p2-B-3-r2/gate-B-3-issue-share.md` | 同上 |
| B-4-outline-view | 合格 | `records/take-in/1.146.0-p2-B-4-r2/gate-B-4-outline-view.md` | 同上 |
| B-5-theme-switching | 合格 | `records/take-in/1.146.0-p2-B-5-r2/gate-B-5-theme-switching.md` | 1回目（`1.146.0-p2-B-5`）も合格 |
| B-6-online-feeds | 合格 | `records/take-in/1.146.0-p2-B-6-r2/gate-B-6-online-feeds.md` | 1回目（`1.146.0-p2-B-6`）も合格 |
| B-7-terminal-suggest | 合格 | `records/take-in/1.146.0-p2-B-7-r2/gate-B-7-terminal-suggest.md` | 1回目は 3 が判定できない |

段階 C の7単位（C-1〜C-7）は `enabled: false` のまま（Phase 5 で扱う）。

## 3. 全部を有効にした版の結果

版: `C:\b\dist\1.146.0-p2-all.zip`（SHA-256 `15aa0ce7…6f6f`、計算し直して一致）。ビルドは蒙恬（`tasks/2026-11-15-p2-all-build/`）。

| 項目 | 結果 | 要点 |
|---|---|---|
| 当てたもの | 合格 | 14単位が `applied: ok`、C の7単位は `reason: "disabled"`。`errors`・`warnings` は空、absentStrings はすべて 0 件。ロックファイルの差は B-7-r2 の版と同じ（SHA-256 一致） |
| スモークの全部の組（3回） | 合格 | 1回目・3回目は B-7-r2 の基準と比べて PASS 49 / FAIL 0。2回目は公式の基準と比べて PASS 48 / FAIL 1。公式の基準に無かったのは既知の1種だけ（下）。3回の和の基準 `C:\b\smoke\baseline-p2-all.json` は鍵4個で、B-7-r2 の基準と同じ4個 |
| 消えている（14単位の checks） | 合格 | `--expect absent` で fail 0・unknown 0（起動して見る項目を持つ12単位で計57項目）。A-6・B-6 は起動して見る項目が無い。A-6 は出力の拡張のフォルダで、テーマが `theme-defaults`・`theme-seti` だけになったことを見た |
| 通信の監査 | 合格（残る点は下） | 2通りとも、エディタの宛先 0・claude の宛先 0・許可の外 0。本家の同じ環境（0-5 の upstream-default）で見えた7宛先は、すべて無い |

公式の基準（本家 1.146.0 の3回の和）に無い誤りは2種。どちらも Phase 1 から仕分け済み。

- `[other] Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json`: Code - OSS の product.json にトンネルの設定が無いため（`records/phase1/smoke-built-1.146.0-p1-a1.md`）
- `[exthost] Claude Code: Remote Control auto-enable failed`（3回中1回だけ出る）: Claude Code のビューが開いて `claude.exe` が起動したときだけ出る。mydist の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` で Remote Control を始めなかったと見られる（推定。`records/phase1/smoke-built-1.146.0-p1-a1-r3.md`）

通信の監査の記録:

- `records/network-audits/2026-11-15-p2-all/`: 関門と同じ環境。拡張は入れず、ユーザー設定でテレメトリと実験を入れた。前回 B-6-r2 と比べて、新しい宛先 0
- `records/network-audits/2026-11-15-p2-all-ledger/`: 0-5 の upstream-default と同じ環境（台帳の拡張と、台帳に無い `dotenv.dotenv-vscode`。ワークスペースの信頼は切り、自動のタスクは入れた）。本家の同じ環境と比べて、新しい宛先 0
- 単位の absentHosts（B-1 の `mobile.events.data.microsoft.com`、B-2 の `default.exp-tas.com`、B-6 の `main.vscode-cdn.net`）は、2通りとも接続が無かった。ネットのログの名前の一覧にも、Node の名前の問い合わせにも出ない

## 4. 残る点

| 点 | 理由・扱い |
|---|---|
| `wpad`（ポート 80）の名前の問い合わせ（各2回。答えも接続も無い） | Chromium のプロキシの自動検出。社外への接続ではなく、手元のネットワークでの名前の問い合わせ。0-5 の棚卸しで「止め方は未確認」とした項目（`records/phase0/network-inventory.md` の2.1）。許可の一覧には入れない。止めるかはリーダーに委ねる |
| Claude の宛先 | 今回は送信していない（裁定 2026-11-13）。ユーザーが手の項目の 10〜14 を監査の中で行い、その結果で `records/network-allowlist.json` の Claude の行（今は仮の `*.anthropic.com` など）を確定させる |
| 監査で見えないもの | UDP、2秒より短い接続、管理者の権限が要る名前の取得（docs/07 の3.3、netaudit の Limits）。設定の検索や拡張の画面など、操作で起きる通信も今回の10分には含まない |
| 手の項目 | `records/phase2/manual-checks-p2-all.md`。この版では、手順書の 3（`Ctrl+K Ctrl+T`）が B-5 のために使えない。代わりに設定の値で見る手順にした |

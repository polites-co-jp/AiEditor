# 引き継ぎ（大岡越前守 → リーダー）

- タスク: Phase 1 の検証（3）台帳と mydist（`brief.md`）と、追加の依頼（曹参の G〜L、dotenv の対応、スモークの実行）
- 書いた日: 2026-11-13
- 詳細: `verification-log.md`

## 判定

**合格**（蒙恬の成果、曹参の成果の両方）。コードの直しが要る点は無い。下の「走らせていないもの」は、私の許可の外にあるもの。

## 蒙恬の成果（brief の1〜5）

| 項目 | 合否 | 理由の要点 |
|---|---|---|
| 1. 台帳 | 合格 | 8件で `dotenv.dotenv-vscode` が無い。`git diff` の変更は、1件の削除（43行）と weixu の `note` の1行だけで、残りの行の値（版・sha256 など）は変わっていない。`validateLockEntry` の規則を8行に手で当てて誤り0件（実物の台帳に当てる台本は私の許可に無い）。台帳は JSON として読める（smoke.test の実物の台帳の試験が PASS） |
| 2. mydist | 合格 | キーは10個で、docs/04 の6.1 の表から application の6件を除いた10行と値まで一致。各スコープを 1.146.0 のソースで確かめた（window か resource。claudeCode は machine で、効くのは起動の順による見込みと明記されている）。application の6件は無い。`claudeCode.environmentVariables` は2件で、manifest 36〜58行と一致。公式の文書は私が取り直していない（Web の道具が無い）。ただ、変数を渡すことは裁定が決めているので、結論は文書に左右されない。JSON は目視で確かめた |
| 3. check-env.ps1・prepare.mjs | 合格 | どちらも読んで確かめた。check-env は本家の `preinstall.ts` 83〜87行と同じ判定。prepare は、commit が無いと git の操作の前に止まる。「テストの入口」の実行は、私の許可（`scripts/check-env.ps1`・`scripts/prepare.mjs` の実行と `upstream.json` の書き換え）の外なので、していない |
| 4. 単体テスト | 合格 | lock と sublime-keys は 165/165。smoke は 70/70。netaudit.tests.ps1 は 102/102 |
| 5. app-scope-options.md | 合格 | 次の点を、1.146.0 のソースの行で確かめた。product.ts に設定の既定の仕組みは無い。OSS の product.json に5つのキーは無い。B-2 の場所（configurationRegistry.ts 1179〜1180行、17行の import）、1119行の `source` なしの扱い、前例のファイルも行と合う |

## 曹参の成果（追加の依頼）

- 差分を読んで確かめたもの: G・H・I・J・K・L、dotenv の対応、PID の使い回しの直し。すべて正しい。
- PID の使い回しの直しは、木を狭めるだけ。止めるのは前と同じで、根の PID への `taskkill /T` と、根の実行ファイルの照合だけ。普段使いのプロセスに触れる範囲は広がらない。
- 公式の zip で `node tests/smoke-run.mjs --prime --baseline C:/b/smoke/baseline-official-1.146.0.json` を1回走らせた。結果は次のとおり。
  - 結果は **PASS 49 / FAIL 0 / SKIP 0 / INFO 9**。置き場所は `C:\b\smoke\runs\official-20261113T143803\`。
  - `probe.snapshot` が PASS（コマンド 3403 件）で、`commands.json` ができた。
  - `base.fixtures-intact` が PASS。
  - `lang.env.dotenv` が PASS（weixu）。
  - `errors.new` が PASS（基準は作り直していない）。

## リーダーに頼みたいこと

1. **`.keep` を置いてほしい。** 対象は `C:\b\smoke\runs\official-20261113T143803\.keep`（空のファイル）。私の書き込み先に `C:\b\smoke\` が無いので、置けなかった。`runs\` は今10個あり、既定の `--keep-runs 10` のままだと、あと10回の実行でこの置き場所が消える。根拠のファイルの SHA-256 は `verification-log.md` に残した。今後も私が `.keep` を置く運用にするなら、私の書き込み先に `C:/b/smoke/runs/` を足す権限の変更が要る（ユーザーの承認が要る）。
2. docs/04 の5節（103行）に、「`configurationDefaults` で既定にできるかは未確認」が残っている。同じ行の前半や 6.1 の注と食い違うので、直してほしい。

## 軽微な点（直さなくても合否に影響しない）

- 曹参: `tests/smoke/lib/run.mjs` の `pruneRuns` の説明の注が、`sameProc` の上に離れて残っている。
- 曹参: `lang.env.dotenv` は、.env の拡張が入っていないと SKIP になる（FAIL にならない）。いまは `base.ext-install` が台帳の拡張を見ているので抜けは無い。
- B-2 を実装するときは、`shukoConfigurationDefaults` の `extensions.allowed` を台帳の ID と照らす単体テストが要る（docs/02 の3節に書かれている。曹参の担当）。

## 走らせていないもの（許可の外）

- `node scripts/lock-fetch.mjs`、`node scripts/prepare.mjs`、`powershell … scripts/check-env.ps1`
- 実物の台帳と mydist の `package.json` を機械で検査する、使い捨ての台本（書き込み先の `tasks/` から `node` で走らせる許可が無い）
- 公式の文書（code.claude.com）の取り直し（Web の道具が無い）

## 記録

- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p1-verify-ledger-mydist\verification-log.md`
- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p1-verify-ledger-mydist\handoff-notes.md`

# 開発部（development） AiEditor 課

AiEditor（仮称 Shuko）のビルドリポジトリを作り、保守する課。このリポジトリ（`projects/ai-editor/`）だけを担当する。

## 所属

| ID | 表示名 | 担当 |
|---|---|---|
| vlad-tepes | ヴラド・ツェペシュ | 課のリーダー。段取り・アサイン・成果の確認・ユーザーへの確認と報告・裁定の記録・コミット |
| meng-tian | 蒙恬 | 作る（スクリプト・削除の単位・拡張・検知と取り込み） |
| cao-shen | 曹参 | テストを書く（単体・スモーク・削除の検査・計測と監査の台本） |
| ooka-echizen | 大岡越前守 | 確かめる（蒙恬と曹参の成果の検証、関門の合否） |
| di-renjie | 狄仁傑 | 毎週の取り込みの採否の判定（`claude -p` で起動） |

## 仕事の流れ

1. リーダーが docs/07 の Phase に沿って仕事を分け、`tasks/<YYYY-MM-DD>-<slug>/brief.md` を書く。
2. 作る仕事は蒙恬に、同じ仕様のテストは曹参に、並行して依頼する。
3. 両方が終わったら、大岡越前守が両方を確かめて合否を出す。不合格なら、該当する人に差し戻す。
4. 合格したら、リーダーがコミットしてプッシュし、ユーザーに報告する。
5. 運用が始まったら、毎週の取り込みでスクリプトが狄仁傑に判定させる。ユーザーが判定を見て入れ替える。

## 書き込みの分け方

| 場所 | 書く人 |
|---|---|
| `docs/`、`tasks/*/brief.md`（メンバーは書き換えられない）、台帳（`team/roster.md`、この README）、`CLAUDE.md` | リーダー |
| `scripts/`（計測と監査の台本を除く）、`tools/`、`removals/`、`patches/`、`assets/`、`builtin/`、`extensions-src/`（test/ を除く）、`extensions.lock.json`、`upstream.json`、`product.overlay.json`、`TAKE-IN.md`、`package.json`、`.gitignore` | 蒙恬 |
| `tests/`、`extensions-src/*/test/`、`scripts/measure.ps1`、`scripts/netaudit.ps1` | 曹参 |
| `records/` | 大岡越前守 |
| `team/hooks/`、`.claude/settings.json` | 設計を行ったチーム（`E:\develop\self\Team`）の開発部 |

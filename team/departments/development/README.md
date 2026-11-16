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
5. 運用が始まったら、毎週の取り込みでスクリプトが狄仁傑に判定させる。版の入れ替えは課が行う（2026-11-16 の裁定）。
6. ユーザーから拡張を足す依頼が来たら、`docs/04-bundled-extensions.md` の8節の手順で、蒙恬が取得・確かめ・台帳への記載を行い、曹参がテストを直し、大岡越前守が検証してから入れる（2026-11-17 の裁定）。

## 書き込みの分け方

| 場所 | 書く人 |
|---|---|
| `docs/`、`tasks/*/brief.md`（メンバーは書き換えられない）、台帳（`team/roster.md`、この README）、`CLAUDE.md` | リーダー |
| `scripts/`（計測と監査の台本を除く）、`tools/`、`removals/`、`patches/`、`assets/`、`builtin/`、`extensions-src/`（test/ を除く）、`extensions.lock.json`、`upstream.json`、`product.overlay.json`、`TAKE-IN.md`、`package.json`、`.gitignore` | 蒙恬 |
| `tests/`、`extensions-src/*/test/`、`scripts/measure.ps1`、`scripts/netaudit.ps1` | 曹参 |
| `records/` | 大岡越前守 |
| `team/hooks/`、`.claude/settings.json` | 設計を行ったチーム（`E:\develop\self\Team`）の開発部 |

## 削除の許可と、塞いでいない穴（2026-11-15）

- 蒙恬は、`C:/b/p2/`・`C:/b/dist/`・`C:/b/smoke/ext/`・`C:/b/trial-*` の下を `rm -rf <パス>` の形で消せる。残す版（`delete_keep`）とその祖先・その下は、フックが止める。残す版を変えるときは権限の変更なので、Team に依頼する（`tasks/2026-11-15-permission-requests/response.md`）。
- **塞いでいない穴**: 蒙恬は `scripts/` と `C:/b/` に書けて、台本（`node scripts/*.mjs`・`powershell … -File scripts/*.ps1`・`pnpm --dir C:/b/wt/* run gulp`）を走らせられる。そのため、台本を通せば許可の外のものも消せる。フックの削除の判定は「うっかり」への守りで、意図した削除までは防げない。開発の妨げが大きいので塞がず、決まりで守る: 許可の外を消す台本や手順を書かない、走らせない（蒙恬の定義の「やらないこと」）。リーダーは、削除を含む台本の変更を検証に回すとき、消す先が許可の範囲かを確かめさせる。
- 曹参・大岡越前守の `node --test tests/*.test.mjs` などは、後ろに別のファイルを足して走らせられる（2026-11-13 の裁定どおり、このまま）。

## tmp/b とリポジトリの関係（2026-11-16）

- ビルドの作業場所 `tmp\b` はこのリポジトリの中にある（`.gitignore` 済み）。作業ツリーでも clone でもないフォルダで git を打つと、このリポジトリそのものに効く。`git -C` の先は、必ず作業ツリーか clone にする（フックが求める）。
- リーダーはフックの対象外。リポジトリの直下で `git clean`・`checkout`・`reset` を打つと、`tmp\b`（clone を含む）を消しうる。打たない。
- 使い捨ての作業ツリーは `tmp\b\wt\<名前>` の下に作る（`git -C tmp/b/wt/* …` と `worktree remove tmp/b/wt/*` の許可が効く範囲）。

# 引き渡しの覚え: Phase 2 の締めの検証（大岡越前守）

- 担当: 大岡越前守、2026-11-15（JST 00:50〜01:10 ごろ）
- 依頼: `brief.md`（このフォルダ）。手順と数字の詳細: `verification-log.md`
- 判定: **合格**（brief の1〜4が合格、5の記録は済み）

## 判定

| brief | 結果 | 根拠の要点 |
|---|---|---|
| 1. 当てたもの | 合格 | checks.json で14単位が `applied: ok`、C の7単位は `disabled`。`errors`・`warnings` は空。zip の SHA-256 と product.json の commit が handoff と一致。B-7-r2 とはロックファイルの差が同じ（SHA-256 一致）で、checks.json の違いは選び方だけ |
| 2. スモークの全部の組 | 合格 | 3回（`--prime` は3回とも付けた）。1回目と3回目は B-7-r2 の基準と比べて PASS 49 / FAIL 0。2回目は公式の基準と比べて PASS 48 / FAIL 1 で、FAIL は既知の `tunnelApplicationConfig` だけ。3回の和の基準 `C:\b\smoke\baseline-p2-all.json` は鍵4個で、B-7-r2 の基準と同じ |
| 3. 消えている | 合格 | 14単位を `--expect absent`: fail 0・unknown 0（12単位・57項目。A-6・B-6 は起動して見る項目が無いので、ほかの方法で見た） |
| 4. 通信の監査 | 合格 | 2通り×600秒（関門と同じ環境と、台帳の拡張を入れた環境）。どちらもエディタの宛先 0・claude 0・許可の外 0。本家の同じ環境で見えた7宛先は全部無い。残るのは `wpad` の名前の問い合わせ（答えも接続も無い）だけ |
| 5. 記録 | 済み | `records/phase2/phase2-close.md`、`records/phase2/manual-checks-p2-all.md` |

## 不合格の点

- なし

## リーダーに知らせる点

1. **ソースの差は、私の手では git で比べていない**。`git -C C:/b/wt/p2 diff …` が私の許可に無いため（許可にあるのは、このリポジトリで動く `git diff`）。代わりに、ロックファイルの差・checks.json の違い・出力のファイルの違い（埋め込みの commit と日時で説明がつく）で裏を取った。蒙恬の記録とは食い違わない。今後も同じ比べを私に任せるなら、`git -C C:/b/wt/*` の diff の許可が要る（ユーザーの承認が要る）。
2. **C: の空きは測れていない**。空きを数える手段（`scripts/disk-usage.mjs` など）が私の許可に無い。今回増えたのは、スモーク3回分・消えているの1回分・監査のネットのログ2回分で、1 GB 前後と見ている（推定）。15 GB を切る見込みは低いが、確かめてはいない。以後もこの指示（15 GB で止める）を私に出すなら、`node scripts/disk-usage.mjs` の許可が要る。
3. **`C:\b\smoke\ext\` に、ラベルごとの拡張のフォルダが43個たまっている**（スモークを回すたびに1つ増える）。蒙恬が「ほかの場所で減った 5.1 GB」とした分の多くはこれと見られる（推定。測っていない）。消すかどうかはリーダーの判断。
4. **手の項目の 3（テーマ）の手順を、この版では変えた**。B-5 で `Ctrl+K Ctrl+T` を消したので、元の手順書（`tasks/2026-11-13-p1-smoke/manual-checks.md`）のままでは見られない。`manual-checks-p2-all.md` では、設定の `workbench.colorTheme` の値で見る手順にした。元の手順書をどうするか（自作の版向けに直すか）は、書いた人とリーダーの判断。
5. **Claude の宛先の監査は、ユーザーの手の回に重ねる手順にした**（`manual-checks-p2-all.md` の後半）。ユーザーが自分の PowerShell の窓で `netaudit.ps1` を起動し、その窓で 10〜14 を行う。結果は `records/network-audits/<日付>-p2-all-manual-claude/` に出る。読んで許可の一覧の Claude の行を絞るのは、私（読む）とリーダー（書き換える）。
6. 監査の ledger の環境（`C:\b\p0\data\upstream-default`）には、台帳に無い `dotenv.dotenv-vscode` が入っている（0-5 のときのまま）。この版では `extensions.allowed` で外れるはずだが、外れたことは見ていない。宛先が0件なので結果には響かない。手の回の後半も同じ環境を使う。

## 保存したもの

- `tasks/2026-11-15-p2-all-verify/verification-log.md`
- `tasks/2026-11-15-p2-all-verify/handoff-notes.md`（この覚え）
- `records/phase2/phase2-close.md`（Phase 2 の結び）
- `records/phase2/manual-checks-p2-all.md`（ユーザーに渡す手の項目）
- `records/network-audits/2026-11-15-p2-all/`、`records/network-audits/2026-11-15-p2-all-ledger/`（台本が書いた監査の結果）
- リポジトリの外: `C:\b\smoke\baseline-p2-all.json`（3回の和）、`C:\b\smoke\runs\p2-all-{1,2,3}-*\`（`.keep` を置いた）、`C:\b\smoke\absent\p2-all-14-20261114T155501\`

## docs/ との食い違い

- 見つけていない。手順書（`tasks/2026-11-13-p1-smoke/manual-checks.md`）の 3 は自作の版で使えないが、これは docs/ ではなくタスクの成果物（上の4）。

## 次の担当

- リーダー: コミット（`records/phase2/`、`records/network-audits/2026-11-15-p2-all*`、このフォルダ）。ユーザーに `records/phase2/manual-checks-p2-all.md` を渡し、手の項目と、Claude の宛先の監査を頼む。
- 大岡越前守（手の回の後）: `p2-all-manual-claude` の監査を読み、Claude の宛先を仕分ける。

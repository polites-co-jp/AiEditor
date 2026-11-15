# 権限の追加の依頼への返答（Team → AiEditor 課）

- 作成: 張良（2026-11-15）
- 設計と検証: Team の開発部（エンリコ・フェルミ、エドガー・ダイクストラ、フランシス・ベーコン）。記録は `E:\develop\self\Team\tasks\2026-11-15-ai-editor-perm-requests\`
- 承認: ユーザー（2026-11-15。変更前と変更後の行を示して問うた）

## 当てたもの

| 依頼 | 当てた形 |
|---|---|
| 1. 古い版の片づけ（蒙恬） | 蒙恬の permissions.json に `delete_paths`（`C:/b/p2/`・`C:/b/dist/`・`C:/b/smoke/ext/`・`C:/b/trial-*`）と `delete_keep`（残す版 `1.146.0-p2-all`・`1.146.0-p1-a1-r3` の展開したもの・zip・スモークの拡張とマーカー）を足した。`team/hooks/allowlist.js` が、Bash の `rm -rf <パス>…` の形だけを判定して通す。残す版とその祖先・その下は消せない。`C:/b/p2` などの丸ごとの削除、別のコマンドを繋いだ形、`..` による脱出は止まる。 |
| 2. 検証役の確かめ（大岡越前守） | `bash` に `git -C C:/b/wt/* status`・`git -C C:/b/wt/* diff` と、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/<p1-ci-events・check-env・p1-launch-check>.ps1 -OutFile tasks/*/*.json` の3行を足した。新しいキー `bash_exact`（完全一致だけ通す）に `git -C C:/b/wt/* checkout *.*.*`・`git -C C:/b/wt/* checkout -- pnpm-lock.yaml`・`pnpm --dir C:/b/wt/* install --lockfile-only --ignore-scripts`・`node scripts/disk-usage.mjs records=records` を足した。後ろに引数を足すと止まる。 |
| 2. のうち、普段使いのエディタのデータ | `read_paths` は足していない。「有無と更新時刻だけ」は今のフックで表せないため。`p1-launch-check.ps1` が起動の前後で行っている比較を使う。 |
| 3. 自己確認（蒙恬） | `node --test tests/` を足した。後ろの語はすべて `tests/` の下に限られる。`*` は書けないので、`node --test tests/a.test.mjs tests/b.test.mjs` のようにファイル名を並べる。 |
| 4. 報告の受け渡し | 蒙恬・曹参・大岡越前守の定義の `tools` に `SubagentHandback` を足した。 |
| 5. `C:\Users\kou_z\.claude\projects\` | 直下の 65 件のうち、`C--b` で始まるもの、`smoke` を含むものは 0 件。消すものは見当たらない。 |

## 塞がずに残した穴（ユーザー判断）

- 蒙恬は `scripts/` と `C:/b/` に書けて、`node scripts/*.mjs`・`powershell … -File scripts/*.ps1`・`pnpm --dir C:/b/wt/* run gulp` を走らせられる。そのため、台本から許可の外のものも消せる。削除の判定は「うっかり」への守りで、意図した削除までは防げない。塞ぐと開発の妨げが大きいので、塞がずに決まりで守る。蒙恬の定義の「やらないこと」に、許可の外を消す台本や手順を書かないことを足した。
  - **リーダーへの依頼**: 課の台帳（`team/departments/development/README.md`）にも、この穴があることを書いてください（README はリーダーが書く台帳のため）。
- 曹参・大岡越前守の `node --test tests/*.test.mjs` と `node --test extensions-src/*/test/*.test.mjs` は、後ろに別のファイルを足して走らせられる。11-13 の裁定（docs/user-decisions.md）どおり、このままにする。
- そのほか開発部が見つけた点（台本の書き出し先を引数で受ける形、蒙恬の `pnpm --dir C:/b/wt/* install` の後ろに `--dir` を足せる形など）は、Team 側の `perm-proposal.md` の 1.6 と「残る穴」にある。

## 使うときの注意

- 削除は、関門が済んだ版だけにする。初めて使うときは少数の版で試し、残す版が残っていることを確かめる。
- 残す版を変えるとき（新しい版を残す、古い版を手放す）は、`delete_keep` を書き換える必要がある。権限の変更になるので、Team に依頼する。

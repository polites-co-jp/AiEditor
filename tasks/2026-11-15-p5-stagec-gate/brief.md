# Phase 5: 段階 C をまとめた版のビルドと関門

- 担当: meng-tian（蒙恬。片づけとビルド）→ ooka-echizen（大岡越前守。関門）。テストの足しは cao-shen（曹参）
- 依頼日: 2026-11-15（用意だけ。**古い版の片づけの許可が入ってから始める**）
- 状態: 依頼中（片づけの許可は 2026-11-15 20:27 に入った。`tasks/2026-11-15-permission-requests/response.md`）

## 目的

ユーザーの裁定（2026-11-15、`docs/user-decisions.md` の「段階 C の関門の段取り」）で、C-1〜C-7 を全部有効にした版を1つビルドし、docs/03 の7節の関門をまとめて通す。落ちた単位があれば、その単位だけ無効にして作り直す。ビルドは古い版の片づけの許可の後。

## 前提

- C-1〜C-7 の edits.patch と検査・テストは「パッケージ化の前まで」合格（docs/07 の 8.1）。
- 片づけの許可（`tasks/2026-11-15-permission-requests/requests.md` の1）と、検証役の許可（同じ依頼書の2）が Team の開発部から入っていること。

## やること

### 1. 片づけ（蒙恬）

- `C:\b\p2\`・`C:\b\dist\`・`C:\b\smoke\ext\`・`C:\b\trial-*` の下の、関門が済んだ古い版を消す。残すのは `1.146.0-p2-all`（展開したものと zip）と `1.146.0-p1-a1-r3`。消す前と後の C: の空きを記録する（`node scripts/disk-usage.mjs`）。

### 2. ビルド（蒙恬）

- `removals/C-1-ai/` から `C-7-breadcrumbs-outline/` の `unit.json` の `enabled` を `true` にする（A・B の14と合わせて21単位）。
- 作業ツリーを新しく作るか `C:\b\wt\p2` を使い回すかは空きを見て決める。`build.mjs` で最後まで（パッケージ化・zip）ビルドする。label は `1.146.0-p5-c-all`。
- 依存の導入の後のロックファイルの検査（ルートと `remote/`。docs/03 の5.4）、本物の `pnpm install`（`strictDepBuilds: true`）の警告を記録する。
- build/ の台本の型の誤り（A-3 の1件、C-3 の6件。判断済み）でパッケージ化が止まったら、止まった所を報告する。
- 15 GB を切りそうなら止めて報告する。

### 3. 関門（大岡越前守）

docs/03 の7節の1〜4を、21単位の版で行う。各単位の台本 `tests/removals/c1-gate-script.md`〜`c7-gate-script.md` の「関門の起動の確かめ」をすべて含める。

- 1 当たる・2 型検査とビルド: 2の記録を照らす。照らし役 `tests/c1-check-*.mjs`〜`c7-check-*.mjs`。
- 3 消えている: `run-absent.mjs`（21単位の `checks`）、通信の監査（`netaudit`。absentHosts、Claude・git・Notion のほかに通信が無いこと。続きの編集の通信も見る。ユーザーの裁定）。
- 4 壊れていない: スモーク（基準は3回の和）。とくに次を見る。
  - 起動時の開発者ツールのコンソールに `depends on UNKNOWN service`・`Missing proxy instance` が無い
  - Claude Code の組（パネル・差分・コメント・ログイン。C-1 の関門は特に丁寧に。docs/07 の8節）。拡張ホストのログに `vscode.lm`・`vscode.chat` の誤りが無い
  - 全文検索（C-4）、拡張の一覧と有効・無効（C-5）、設定の画面（C-6）、エディタのタブ・分割・差分エディタ（C-7）
  - PowerShell・basedpyright などの台帳の拡張が起動する。「知らない contributes」の警告を記録する
- 単位ごとの合否を `records/take-in/1.146.0-p5-c-all/` に書く。落ちた単位は、症状・ログ・どの単位かの切り分けを書く。

### 4. 落ちた単位の扱い（リーダー）

- 落ちた単位は、その単位だけ `enabled: false` にして作り直す（後の単位の `after` に注意）。直せるなら蒙恬に直させて、もう一度関門を通す。
- C-7 は2回続けて通らなければユーザーに諮る（docs/07 の8節）。

### 5. ユーザーへ渡すもの

- 合格した版の zip と、手で確かめる項目（`records/phase2/manual-checks-p2-all.md` の形）。入れ替えはユーザーが行う（裁定）。

## 許可の形（2026-11-15 に入ったもの）

- 蒙恬の削除は `rm -rf <パス>` の形だけ（`delete_paths`・`delete_keep`）。丸ごとの削除、別のコマンドを繋いだ形は止まる。初めは少数の版で試し、残す版が残っていることを確かめる。
- 大岡越前守は `bash_exact` の完全一致で `git -C C:/b/wt/* checkout <タグ>`・`git -C C:/b/wt/* checkout -- pnpm-lock.yaml`・`pnpm --dir C:/b/wt/* install --lockfile-only --ignore-scripts`・`node scripts/disk-usage.mjs records=records` を走らせられる。`git -C C:/b/wt/* status`・`diff` も使える。
- 報告は `SubagentHandback` で返せるようになった（ファイルにも残す）。

## 守ること

- 普段使いのエディタのデータに触れない。実際の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion を変えない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。

## 完了条件

- 21単位の版が関門を通る（または、落ちた単位を無効にした版が通り、無効の理由が書いてある）。

## 成果物

- `records/take-in/1.146.0-p5-c-all/`（関門の記録）、このディレクトリに担当ごとの `handoff-notes-<id>.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ユーザー: 入れ替えと、手で確かめる項目。

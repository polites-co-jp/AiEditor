# Phase 5 の下ごしらえ: C-7（パンくずリストとアウトライン）の edits.patch を型検査で作る

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

ユーザーの答え（2026-11-15、`docs/user-decisions.md` の「片づけの許可を待つ間の段階 C」）で、段階 C を1単位ずつ下ごしらえする。C-1〜C-6 は edits.patch ができた（C-1〜C-3 は合格、C-4〜C-6 と C-1 の6回目は検証の前）。最後の C-7 の edits.patch を、同じ作業ツリー `C:\b\wt\p2` で作る。ビルド・起動の確かめ・関門は、片づけの許可の後。

## 入力

- `removals/C-7-breadcrumbs-outline/`（unit.json、README の「消すもの」「残すもの」「型検査で直す点」「前提の単位」）
- docs/03 の3節・4節（C-7 の行。**本家の共有部品（エディタの枠）に入るので、パッチが大きく、毎週の取り込みで衝突しやすい**）・5.1・5.3・5.4・9節
- docs/07 の8節（C-7 は関門を2回続けて通らなければユーザーに諮る）、docs/08 の5節の別案（`breadcrumbs.enabled: false` とコードを到達しない状態にするところで止める）
- `records/phase0/claude-code-manifest.md`（Claude Code は差分エディタ・エディタの枠を使う）
- C-1〜C-6 の作り方: `tasks/2026-11-15-p5-c{1..6}-patch/` の handoff-notes と typecheck-log。何もしない実装の門は本家の消すファイルから突き合わせる（C-4 の2回目・C-1 の6回目の形）
- `scripts/apply.mjs`（`--only`）、`scripts/build.mjs`（`--from typecheck --to typecheck`）

## やること

1. **作業ツリーの用意**: `C:\b\wt\p2` はタグ 1.146.0 にある（違えば戻す。`node_modules` は消さない）。A・B の14単位と C-1・C-2・C-4・C-7 を `apply.mjs --only` で当てる（C-7 の `after` は B-4・C-1・C-4。C-4 の `after` に C-2 がある）。
2. **型検査で直す**: 誤りを直し、`format-patch` で `removals/C-7-breadcrumbs-outline/edits.patch` に書き出す。`unit.json` に `"patch": "edits.patch"` を足す。
   - エディタの枠（タブ・エディタのグループ・差分エディタ・Webview のエディタ）を壊さない。Claude Code の差分とパネルが使う。
   - 型検査に掛からない注入（`IOutlineService`・`IBreadcrumbsService` など）を Grep で照らす。
   - 拡張 API に何もしない実装が要るときは `api/common/extHostRemovedApi.outline.ts` に置き、門は本家の消すファイルから突き合わせる。
   - 消すか迷うものは消さずに README に書く。2026-11-14 の規則に当てはめる。
   - **パッチの大きさを記録する**（ファイル数・行数、本家の共有部品のファイルにかかるハンクの数）。docs/08 の5節の別案（設定で隠して止める）と比べられるように、別案ならどのくらいの大きさになるかの見込みも書く。
3. **型検査が誤り 0 で通る**ことを確かめる。
4. **当て直しの確かめ**（2つの組。どちらも `--lockfile-check` 付き。終わったらロックファイルを戻す）:
   - a. タグから A・B の14と C-1・C-2・C-4・C-7（18単位）。
   - b. タグから A・B の14と C-1〜C-7（21単位。段階 C のすべて）。ほかの単位とパッチの文脈が重ならないこと（重なるなら `removeLines` に回す）。3-way に頼らず当たるか（`git apply --check`）も確かめる。
5. パッケージ化と zip はしない。C: の空きを始めと終わりに記録する。15 GB を切りそうなら止めて報告する。
6. README の状態を「edits.patch あり、関門の前」に直し、残した部品と理由、直した点の一覧、注入の照らし、エディタの枠と Claude Code への影響、パッチの大きさを書く。
7. **終わったら `C:\b\wt\p2` をタグ 1.146.0 に戻して渡す**。

## 守ること

- 書き込みは `removals/C-7-breadcrumbs-outline/`・`scripts/`（直しが要るときだけ。先に報告）・`tasks/`・`C:\b\wt\p2` だけ。ほかの単位の `removals/` は変えない（変えたいときは報告）。
- `C:\b\p2\`・`C:\b\dist\`・`C:\b\wt\1.146.0` を書き換えない。新しい作業ツリーを作らない。普段使いのエディタのデータに触れない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を書く。`rm` が無いので、誤ってファイルを作らない。

## 完了条件

- `removals/C-7-breadcrumbs-outline/edits.patch` があり、4の a・b の両方で当たり、型検査が誤り 0 で通る（または通らない理由と、別案の見込み）。

## 成果物

このディレクトリに `handoff-notes.md`（直した点、残した部品と理由、注入の照らし、エディタの枠と Claude Code への影響、パッチの大きさと別案の見込み、判断を仰ぐ点、テストの入口）、`typecheck-log.md`、`trial/`。

## 結果

採用。C-7 の `edits.patch`（10ファイル・42ハンク、うちエディタの枠4ファイル・17ハンク）。今の案で関門へ進める（docs/07 の8節。2回続けて通らなければ諮る）。大岡越前守の検証で「パッケージ化の前まで」合格（`tasks/2026-11-15-p5-c1-c6-c7-verify/verification-ooka.md`）。`enabled` は `false` のまま。

## 未解決

- ビルド（パッケージ化）・起動・関門は、古い版の片づけの許可の後。
- 検証役が自分で走らせていない組、ロックファイルの作り直し、`git apply --check` は、許可の追加（`tasks/2026-11-15-permission-requests/requests.md` の2）か関門のビルドで確かめる。
- 軽微な指摘: `kept` の `src/vs/base/browser/ui/breadcrumbs` の理由が事実と違う（使い手は共有の `defaultStyles.ts`）。

## 次の担当

cao-shen（曹参）: C-7 の検査とテスト。ooka-echizen（大岡越前守）: 検証。

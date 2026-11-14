# 直し: B-1 が消したコマンド `_aiEdits.clearAiContributions` と、build.mjs の軽微な点

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-14
- 状態: 依頼中

## 目的

1. Phase 2 の関門で、B-1（テレメトリ）が「壊れていない」で不合格になった。`Error: command '_aiEdits.clearAiContributions' not found`（renderer・exthost）。git の拡張が呼ぶコマンドの登録を、B-1 が消した部品（`contrib/editTelemetry` と見られる）が持っていた（`tasks/2026-11-14-p2-gates/handoff-notes.md`・`verification-log.md` の B-1）。
2. 検証で出た `build.mjs` の軽微な点（`tasks/2026-11-14-verify-commit-fix/handoff-notes.md` の「直す必要のある点」）。

## やること

1. **B-1**
   - `_aiEdits.clearAiContributions` を登録しているところと、呼ぶところ（`extensions/git` など）を本家 1.146.0 のソースで確かめる。
   - 直し方を決める。テレメトリを送らないまま、コマンドの ID だけを残して何もしない実装を登録するのが第一案（B-1〜B-3 の README の「ID を残して何もしない実装」の形。docs/03 の5.3 の単位どうしを独立に保つ規則）。ほかに同じ部品が持っていて、残る部品が呼ぶコマンドやサービスが無いかも洗う。
   - `removals/B-1-telemetry/`（unit.json・edits.patch・README）を直す。`checks` に、このコマンドが**在る**ことの確かめを足せるなら足す（形が無ければ README に書く）。
   - B-1 から B-7 までの版を作り直す（label は `1.146.0-p2-B-1-r2` 〜 `1.146.0-p2-B-7-r2`）。A-7 までの版はそのまま使う。各版を `C:\b\p2\<label>\` に展開して起動を確かめ、`tasks/2026-11-14-p2-builds/builds.md` に行を足す（もとの行は消さず、作り直したことを書く）。
   - 大岡越前守が B-2〜B-7（作り直す前の版）の関門を進めている。そこで B-1 以外の単位の不合格が見つかったら、リーダーが追って伝える。
2. **build.mjs**
   - `childEnv` で、外から来た `BUILD_SOURCEVERSION` も外す（`stepEnv` の注のとおり、どの手順にも漏らさない）。
   - 版ごとの commit がどの枝からもたどれない件（`tasks/2026-11-14-p2-builds/handoff-notes.md` の未解決の2）: `build.mjs` か `apply.mjs` が、当てた後の HEAD に常設の clone の枝（例 `builds/<label>`）を付けるようにする。許可に無いコマンドが要るなら、台本の中から走らせる形にする（`node scripts/*.mjs` は許されている）。
   - テストの入口を `handoff-notes.md` の「テストの入口（曹参へ）」に書く。

## 守ること

- 書き込みは `scripts/`・`removals/B-1-telemetry/`・`tasks/`・`C:\b\` だけ。
- `C:\b\p2\` の、作り直す前の版の展開した場所を消したり書き換えたりしない（検証が使っている）。
- C: の空きは約 39 GB。版を作り直すと増えるので、空きが 15 GB を切ったら止めて報告する。

## 完了条件

- B-1 の直しがあり、B-1〜B-7 の作り直した版が builds.md にある。build.mjs の直しがある。

## 成果物

このディレクトリに `handoff-notes.md`、`build-log.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 作り直した B-1〜B-7 の関門。cao-shen（曹参）: build.mjs と p1-launch-check の直しのテスト。

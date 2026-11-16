# 直し: C: から移す直しの検証で出た点（移した後の最初のビルドの前）

- 担当: meng-tian（蒙恬）・cao-shen（曹参）
- 依頼日: 2026-11-16
- 状態: 完了

## 目的

大岡越前守の検証（`tasks/2026-11-15-move-off-c-verify/verification-ooka.md`）は合格だったが、直す点が5つと、テストの副作用の指摘があった。移した後の最初のビルドの前に直す。ユーザーの裁定「C: に置かない」（`docs/user-decisions.md` 2026-11-15）に合わせて、テストが C: に書く所も直す。

## やること（蒙恬）

1. **取り込みの監査の名前の長さ**（直す点の1）: `take-in.mjs` の監査の作業場所 `take-in-<label>-netaudit` は、ラベルが12文字以上だと 259 文字を超える。曹参のスモークと同じ形（`shortLabel` など。同じラベルは同じ名前）で縮めるか、長いときは止める。決めて書く。
2. **写す台本の SHA-256**（直す点の3）: `move-build-root.mjs` の dir の項目も、ファイルごとに SHA-256 で照らす（裁定の「数と大きさと SHA-256 を照らす」。写した後に `C:\b` を消すので、中身の照らしを全部の項目にかける）。時間がかかるなら、かかった時間を記録に出す。
3. **途中で止まったときの続き**（直す点の4）: 写し先に途中まで写したものがあるとき、元と同じファイル（大きさと SHA-256）は飛ばし、無いものだけを写して続けられるようにする。違うものがあれば今どおり problem で止まる。上書きはしない。
4. 自己確認: `node --test tests/move-build-root.test.mjs tests/take-in.test.mjs tests/take-in-more.test.mjs`（許可にある形）。

## やること（曹参）

1. **テストが本物の `tmp\b` に書く**（直す点の2）: `tests/p1-scripts.test.mjs` の 219〜228行・289〜301行が `<リポジトリ>\tmp\b\...` と `<リポジトリ>\tmp\b\p2\...` を作って消す。移した後は残す版のある `<buildRoot>\p2` の中で消すことになる。偽の `LOCALAPPDATA` の `local.json` で、試しの入れ物（`tmp\tests\...`）に向ける。
2. **テストが C: に書く**（記録として伝える点）: `apply-commits` が `C:\b\wt\tests-ac-<pid>`、`apply-cli` が `C:\b\smoke\apply-cli` に書く。ほかにも C: や本物の `<buildRoot>` に書くテストが無いかを探し、試しの入れ物（`tmp\tests\...`）に向ける。テストが本物の `<buildRoot>` と C: に書かないことを見張る検査を足せるなら足す。
3. **見張るテストの不足**（直す点の5）: `LOCALAPPDATA` を向けるのが install・typecheck・package だけであること、take-in の `childTemp` と監査の作業場所 `<buildRoot>\audit`、`applyEnvVars` が大文字小文字だけ違う同じ変数を消してから入れること、netaudit の正常な経路の消去を偽のエディタで動かして確かめる。
4. 蒙恬の1〜3のテスト（監査の名前の長さ、dir の SHA-256、続きから写す）。
5. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは、蒙恬が `scripts/`・`tasks/`、曹参が `tests/`・`scripts/measure.ps1`・`scripts/netaudit.ps1`・`tasks/`。`C:\b` と本物の `tmp\b` には何も作らない（試しは `tmp\tests\` の下）。
- 普段使いのエディタのデータと、秘密の場所に触れない。

## 完了条件

- 蒙恬の1〜3と、曹参の1〜4があり、`run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`・`handoff-notes-cao-shen.md`。

## 結果

採用。取り込みの監査の名前を縮める、写す台本が全部の項目を SHA-256 で照らし途中から続ける、テストが本物の作業場所と C: に書かない（run-all の見張り、temp-root）。大岡越前守の検証で合格（`verification-ooka.md`。run-all 2648、fail 0）。軽い直し2つ（見張りが根そのものの更新時刻を見ない、`apply-commits.test.mjs` の説明）は曹参へ。

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 直しの検証。

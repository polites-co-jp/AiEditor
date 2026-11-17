# r6 の関門で出た直し（L1〜L3、T1）と追加の直しの検証（大岡越前守）

- 日付: 2026-11-17
- 依頼: `tasks/2026-11-17-r6-followups/brief.md`、リーダーの依頼文（確かめること 1〜7）
- 判断の記録: `docs/user-decisions.md` の「記録（2026-11-17、版 r6 の関門。リーダーの判断）」と「記録（2026-11-17、r6 の直し（L1）で出た点。リーダーの判断）」（どちらも HEAD 451f12d に入っている）
- 確かめた成果: 蒙恬（`scripts/take-in.mjs`、`scripts/lib/take-in/records.mjs`、`TAKE-IN.md` の3節、`extensions-src/language-pack-ja/README.md`）、曹参（`tests/l10n-r6.test.mjs`）
- ビルド・入れ替え・拡張の操作はしていない。コードは直していない。`tmp/` の下は探していない

## 判定: 合格

完了条件（L1〜L3 が直り、T1 のテストが通り、関係するテストがすべて通る）を満たす。確かめること 1〜7 のすべてで、差分を読み、テストを流して確かめた。

ただし、テストの網には穴が2つある（6節の G1・G2）。今の実装は正しいが、後で配線が崩れてもテストは落ちない。完了条件の外なので合否には入れていない。足すかどうかはリーダーが決める。

## 1. 確かめたこと

### 1.1 L1: 前の回の l10n-count.json の数を写さない（count の前で落ちたときも）

差分（`git diff HEAD -- scripts/take-in.mjs`）を読んで確かめた。

- `runL10nCount` は、入口で前の回のファイルの有無を `fileMark(out).exists` で取る（`leftover`）。
- 版の形が読めない・パックが無い・extract が落ちたときは、3か所とも `withStale(...)` で返す。前の回のファイルが残っていれば `staleOutput: true` が付く（追加の直し 5.1）。
- count の前後で印（有無・`mtimeNs`・`size`。BigInt）を取り、`writtenSince` が偽なら中身を読まず、`summarizeL10nCount(終了コード, null)` に渡す。結果は `failed` になる。
  - 前の回のファイルがあれば `staleOutput: true` を付け、`reason` を「l10n-count.json がこの回に書かれていない（残っているのは前の回のもの）」にする。
  - `untranslated`・`total`・`result`・`byArea` などの数は入らない。
- warnings の1行は、`runCore` の `detail` が `untranslated == null` のとき `reason` を使うので、古い数は入らない。
- 消していないこと: 差分に `rmSync`・`unlinkSync`・`writeFile` で `l10n-count.json` に触る行は無い。`scripts/l10n-ja.mjs` は今回の変更に入っていない（`git status`）。
- テストで確かめた振る舞い（`node --test tests/l10n-r6.test.mjs`）:
  - 模擬の版で、パックの `localizations` を空にした件。count は `readBuiltPack` で出力の前に落ちる（出力に「ja の localizations が無い」）。結果は `failed`・`staleOutput: true` で、数はすべて null。ファイルは残り、`total` は 99999 のまま（書き換えていない）。
  - runner を模擬し、count が終了コード 0 で何も書かない件。結果は `failed`・`staleOutput` で、古い数を写さない。

### 1.2 L2: 出力が無ければ終了コードによらず failed

- `summarizeL10nCount` の `!out` の枝が `status: "failed"` だけを返す（差分）。
- テストは、終了コード 0・1・2・5・127・null と、出力 null・undefined のすべての組み合わせで、`failed`・`exitCode`・理由・数なしを見る。通った。

### 1.3 案 b: staleOutput のときだけ材料から外し、既定の除外は残す

- `records.mjs` に `MATERIAL_SKIP`（judge-output.json・verdict.json・verdict.md。凍結）を切り出し、`listMaterials` の既定にした。
- `l10nMaterialSkip(l10n)` は、`l10n.staleOutput === true` のときだけ `/^l10n-count\.json$/` を足す。
- `listMaterials` は、記録のフォルダ（`dir`）からの相対パスで `skip` を照らす（records.mjs の71〜72行）。このため、`judge` で `repoRoot` に REPO を渡しても、直下の `l10n-count.json` だけが外れる。`logs/l10n-count.log` は外れない。
- `judge` は `listMaterials(ctx.recDir, REPO, { skip: l10nMaterialSkip(ctx.rec.l10n) })` を呼ぶ。ext の取り込みでは `ctx.rec.l10n` が無いので、既定のまま。
- テストでは、`staleOutput` が null・undefined・ok・failed・false のときは既定と同じになり、true のときだけ `l10n-count.json` が外れることを確かめた。通った。

### 1.4 --from の続き

- `runCore` の743〜748行。前の回の `take-in.json` に `l10n` があれば `ctx.rec.l10n` に写してから `save` する。
- 数えるかは `shouldCountL10n({ buildRec, ranBuild: run(5), recDir, prevL10n: ctx.rec.l10n })` で決める。ビルドが ok でなければ偽。そのうえで、手順 5 を走らせた・`l10n-count.json` が無い・前が `failed` のどれかなら真。前が ok・untranslated・記録なしの続きでは偽。
- 738行により、新しい回（`--from` なし・`--from 1`）は `take-in.json` があれば止まる。このため、前の回の `l10n` が写るのは続きの回だけ。
- テスト（`shouldCountL10n` の件）は、9通りの入力で上の真偽を見る。通った。

### 1.5 T1: テストが振る舞いを見ていて、直す前の実装では落ちる

- 正規表現で見ていた3件のうち、2件を振る舞いの件に替えた。替えたのは `runL10nCount` の構造の件と、数える条件の件。
  - 本物の `l10n-ja.mjs extract → count` を、模擬の版（`tmp/tests/tests-l10nr6-*`）に走らせる5件。
  - runner を模擬する1件、`fileMark`・`writtenSince` の1件、`shouldCountL10n` の1件、`l10nMaterialSkip + listMaterials` の1件。
- 残した正規表現の1件（数えの失敗で Stop しない、warnings に1行）は、`runCore` を走らせるには作業ツリー・ビルド・claude が要る、という理由が記録にある。妥当とみる。
- 直す前の実装で落ちるか: HEAD の実装（差分の `-` 側）と照らして確かめた。
  - HEAD は `runL10nCount` を export していない。このため、走らせる件はすべて、最初の `typeof` の確かめで落ちる。
  - export を足しただけの HEAD でも、次のとおり落ちる。
    - L1 の件: count の後に `readJsonOrNull(p.out)` で古い STALE を読み、`untranslated: 0`・`total: 99999` を写すので、`r[k] == null` で落ちる。
    - runner 模擬の件: 終了コード 0 で古い数を読み、`ok` になるので落ちる。
    - L2 の件: `summarizeL10nCount(5, null)` が `untranslated` を返すので落ちる。
  - `shouldCountL10n`・`l10nMaterialSkip` は HEAD に無いので落ちる。
  - 曹参の記録（HEAD の写しで 26 件中 2 件が落ちた。蒙恬の L1・L2 の後、追加の2点の前は 29 件中 2 件が落ちた）と合う。
- 自分では HEAD に対して流していない。曹参の差し替え（環境変数 `AIED_TAKEIN_MODULE`）を使うには、許可にない形でコマンドを打つ必要があるため。

### 1.6 L3 と TAKE-IN.md の文

- README の `ThirdPartyNotices.txt` の行を、次の3つと突き合わせた。食い違いは無い。
  - 今の `ThirdPartyNotices.txt`: vscode-loc の PR の commit と main の commit、Open VSX 1.131.0 の VSIX と SHA-256、課が足した訳の置き場所、`LICENSE.md` の写し。
  - `scripts/l10n-ja.mjs` の492〜497行: キャッシュの `LICENSE.md` を読み、`thirdPartyNotice` で書く。
  - `docs/user-decisions.md` 655行: 下の層の出典も書く。
- TAKE-IN.md の3節に足した文（`staleOutput` のときは材料から外す、「未訳は数えていない」と `status`・`reason` を書く、外したファイルを読みにいかない）を、次の3つと照らした。どれとも食い違わない。
  - docs/04 の7節（数える・取り込みで take-in.mjs が走らせる）
  - docs/06 の4節の手順 5a（止めない、ok でなければ warnings）
  - 裁定（案 b、TAKE-IN.md にも一言）
- TAKE-IN.md の4節の69行（「記録に `failed` と理由が残る」）とも合う。

### 1.7 関係するテスト

| コマンド | 件数 | 結果 |
|---|---|---|
| `node --test tests/l10n-r6.test.mjs` | 29 | 29 通った（落ち 0） |
| `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs` | 138 | 138 通った（落ち 0） |
| `node --test tests/l10n-lib.test.mjs tests/l10n-repo.test.mjs tests/l10n-audit.test.mjs tests/l10n-audit-more.test.mjs` | 172 | 172 通った（落ち 0） |

合わせて 339 件で、すべて通った。`tests/l10n-*.test.mjs` と `tests/take-in*.test.mjs` は、`tests/` の一覧で見てこの7つで全部。蒙恬の記録（5.5 の 29・172・138）と合う。

## 2. 直すべき点

なし（完了条件の中には無い）。

## 3. テストの網の穴（曹参。足すかはリーダーの判断）

| ID | 中身 | 足し方の案 |
|---|---|---|
| G1 | 追加の直し 5.1（count の前で落ちたときも `staleOutput`）を見る件が無い。「形が読めない・パック無し・extract 失敗」の件は、前の回のファイルを置かずに走らせている。このため、`withStale` を外しても全件通る | その件（または新しい件）で、前の回の `l10n-count.json` を置いてから3通りを走らせ、`staleOutput: true`・数なし・ファイルが残ることを見る |
| G2 | 配線を見る件が無い。`judge` が `l10nMaterialSkip(ctx.rec.l10n)` を渡すこと、`runCore` が `shouldCountL10n` に `prevL10n: ctx.rec.l10n` を渡すこと、`prevRec.l10n` を写すこと。前の正規表現の件は数える条件の配線を見ていたが、関数の件に替えたので、`runCore` の呼び出しを元の条件に戻しても落ちない | `runCore` を走らせられないなら、残した正規表現の件と同じ形で、この3か所の呼び出しの形をソースで照らす |
| G3（軽い） | `l10nMaterialSkip + listMaterials` の件は `dir` と `repoRoot` に同じフォルダを渡す。このため、照らす基準（記録のフォルダからの相対）を取り違えても見分けられない | `repoRoot` を記録のフォルダの親にして、返るパスが `<子>/l10n-count.json` の形でも外れることを見る |

## 4. 気づいた点（直さなくてよい。記録のため）

- 蒙恬: `--from 2` 以降の続きでビルドが落ちて止まった回では、`take-in.json` の `l10n` に前の回の数え（前のビルドのもの）が残る。続きの初めに写して `save` するため。
  - 判定までは進まないので、古い数が判定に渡ることは無い。続きで手順 5 を通せば数え直される。前は `l10n` が消えていた。
- 蒙恬: extract で落ちたときの `l10n` には `reason` が無い（`step: "extract"` と `exitCode` だけ）。TAKE-IN.md の「`status` と `reason` を添える」では、判定役が添える `reason` が空になる。
  - warnings には「extract の終了コード N」が入るので、材料からは読める。

## 5. コミットしてよいファイル

- `scripts/take-in.mjs`
- `scripts/lib/take-in/records.mjs`
- `TAKE-IN.md`
- `extensions-src/language-pack-ja/README.md`
- `tests/l10n-r6.test.mjs`
- `tasks/2026-11-17-r6-followups/handoff-notes-meng-tian.md`
- `tasks/2026-11-17-r6-followups/handoff-notes-cao-shen.md`
- `tasks/2026-11-17-r6-followups/verification-r6-followups.md`（この記録）

入れないもの: `scripts/l10n-probe.mjs`（`docs/user-decisions.md` 658行で、コミットしないと決まっている）。ほかの未コミットのファイルは前の仕事の残りで、この検証の対象外。曹参が使った `tests/_old-takein-probe.mjs` は消されていて、残っていない（`git status`）。

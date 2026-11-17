# 検証の記録: テストの網の穴（G1〜G3）

- 検証: ooka-echizen（大岡越前守）
- 日付: 2026-11-17
- 検証した成果: 曹参（cao-shen）が `tests/l10n-r6.test.mjs` の末尾に足した6件と、`handoff-notes-cao-shen.md`
- 基準: `brief.md` の「やること」「決まり」「完了条件」、前回の検証の記録（`tasks/2026-11-17-r6-followups/verification-r6-followups.md` の6節の G1〜G3）

## 判定: 合格

5つの確かめる点は、すべて満たした。直すとよい点が1つある（3節の S1）。ただし直さなくても、仕様を誤って通す向き（落ちるべきときに通る）の穴ではない。合否には入れない。

## 1. 件があり、振る舞いと構造の分けがbrief のとおりか

`git diff HEAD -- tests/l10n-r6.test.mjs` で読んだ。足されたのは末尾の80行だけ（6件）。

| ID | 件 | 種類 | 判断 |
|---|---|---|---|
| G1 | count の前の3通り（パック無し・版の形を読めない・extract 失敗）で、前の回の `l10n-count.json` を置いて走らせる | 振る舞い（本物の `l10n-ja.mjs` を子で走らせる） | 満たす |
| G1 | 同じ3通りで、前のファイルが無ければ `staleOutput` が付かない | 振る舞い（対の件） | 満たす |
| G2a | `judge` が `listMaterials(ctx.recDir, REPO, { skip: l10nMaterialSkip(ctx.rec.l10n) })` を呼ぶ | 構造 | 満たす |
| G2b | `runCore` が `shouldCountL10n({ buildRec, ranBuild: run(5), recDir: ctx.recDir, prevL10n: ctx.rec.l10n })` の結果で `runL10nCount(ctx)` を呼ぶ。元の `run(5) \|\| !fs.existsSync` が無い | 構造 | 満たす |
| G2c | 続きの回で `prevRec` を読み、`ctx.rec.l10n = prevRec.l10n` を写し、その後に `save(ctx)` | 構造 | 満たす |
| G3 | `dir` = `<repo>/records/take-in/lbl`、`repoRoot` = `<repo>` で、直下の `l10n-count.json` だけが外れる | 振る舞い（`listMaterials` は純粋な関数） | 満たす |

構造にした理由（`judge`・`runCore` を走らせるには作業ツリー・ビルド・`claude` が要る）は、テストの注釈（G2 の上のコメント）と引き継ぎの「振る舞いと構造の分け」の両方に書いてある。brief の「どの件が振る舞いで、どの件が構造かを記録に書く」を満たす。

## 2. 実装の該当の所を見ていて、元に戻せば落ちるか

実装を読み、テストの照らし方と突き合わせた。曹参の記録（7通りの写しで、期待した1件だけが落ちた）と食い違う所は無い。

- G1: `scripts/take-in.mjs` の `runL10nCount`（638〜663行）。`withStale` は 646行（版の形）・649行（パック無し）・653行（extract）の3か所で使う。テストは3通りを全部回し、通りごとに `staleOutput === true` を見る。`withStale` を外しても、1か所だけ包みを外しても、その通りで落ちる。元の理由（`reason`、extract は `step`）が残ること、数を写さないこと、前のファイルを書き換えないこと（`total` が 99999 のまま）も見ている。対の件で「付けすぎ」（常に `staleOutput: true`）も落ちる。
- G2a: 468行の `listMaterials(ctx.recDir, REPO, { skip: l10nMaterialSkip(ctx.rec.l10n) })`。`{}` を渡す・`skip` を外すと、正規表現が当たらず落ちる。
- G2b: 882行。`prevL10n` を外すと `m[1]` の照らしで落ちる。元の条件（`buildRec.result === "ok" && (run(5) || !fs.existsSync(...))`）に戻すと、`shouldCountL10n` の形が無くなるか、否定の照らしで落ちる。
- G2c: 743行（`prevRec` を読む）、747行（写す）、748行（`save(ctx)`）。写す行を消すと `copy` が -1 で落ちる。`save(ctx)` の後ろへ動かすと、`read` の後の最初の `save(ctx);`（748行）が `copy` より前になって落ちる。
- G3: `scripts/lib/take-in/records.mjs` の `listMaterials`（63〜79行）は `path.relative(dir, p)` で skip を照らす。`repoRoot` 基準に戻すと、照らす文字列が `records/take-in/lbl/l10n-count.json` になる。すると `^l10n-count\.json$` が当たらず、2つ目の `deepEqual` で落ちる（`MATERIAL_SKIP` も `^` つきなので、1つ目の `deepEqual` でも judge-output・verdict が残って落ちる）。`logs/` と `sub/` の下の同名が残ることも見ているので、`^` を外す戻し（どこの `l10n-count.json` も外す）でも落ちる。

`bodyOf` の範囲も確かめた。`judge` は 466行から次の区切り（518行）まで、`runCore` は 696行から次の区切り（995行）までを切る。`runCore` の中に `// ------` の区切りは無い（take-in.mjs の区切りは 128・130・235・237・252・254・462・464・518・520・995・997・1119・1121行）。

## 3. 構造の件が脆すぎないか

全体としては脆すぎない。関数名（`async function judge(`・`async function runCore(`）と区切り（`\n// ------`）が変われば、「無い」「終わりが見つからない」と名前つきで落ちる。黙って通る向きにはならない。区切りが消えて次の区切りまで範囲が広がっても、照らす式は固有の形なので、別の関数の中の式に誤って当たるおそれは小さい。

直すとよい点（合否には入れない）:

| ID | 点 | 担当 | 直し方 |
|---|---|---|---|
| S1 | G2c の2つの正規表現は空白・引用符を固定している（`/const prevRec = readJsonOrNull\(path\.join\(ctx\.recDir, "take-in\.json"\)\)/`、`/if \(prevRec && prevRec\.l10n\) ctx\.rec\.l10n = prevRec\.l10n;/`）。引き継ぎの「構造の件は書き方（空白・改行）には寛容にした」は、G2a・G2b には当たるが G2c には当たらない。`prevRec?.l10n` への書き換えや、整形での改行・空白の違いでも落ちる（偽の落ち。偽の合格の向きではない） | 曹参 | G2a・G2b と同じく `\s*` で空白・改行を許す。または引き継ぎの記述を「G2c は行の文字どおりに照らす」と直す。どちらかでよい。リーダーが要否を決める |

ほかの点（直さなくてよい）:

- G2a の範囲には `finalizeVerdict`・`recordAndWriteBack` も入る（同じ区切りの節）。照らす式は `listMaterials(ctx.recDir, REPO, { skip: l10nMaterialSkip(...) })` に固有なので、取り違えのおそれは無い。
- コメントの中に同じ式を残し、本物の呼び出しだけを戻すと通ってしまう。構造の照らしの一般の限界で、意図して欺く書き換えでしか起きない。

## 4. 一時の写しとスクリプトが残っていないか

| 確かめた所 | 方法 | 結果 |
|---|---|---|
| `tests/_mutcheck*` | Glob（`tests/`） | 無い |
| `tmp/tests/mut-g/` | Glob（その場所を path に渡す） | 「Directory does not exist」 |
| `tmp/tests/` の直下の `*.mjs`、`tmp/tests/` の下の `*mutcheck*`・`*mut-g*`・`*take-in.mjs*`・`*records.mjs*` | Glob（`tmp/tests` に絞る） | 無い |
| tests/ の未追跡のファイル | `git status` | 会話の初めの状態（p34・probe-* など、このタスクと関係ない物）から増えていない。l10n-r6 の写しは無い |

`tmp/` は `tmp/tests` の外を探していない。

## 5. テストを走らせた結果

| コマンド | 件数 | 結果 |
|---|---|---|
| `node --test tests/l10n-r6.test.mjs` | 35 | pass 35・fail 0 |
| `node --test tests/take-in.test.mjs tests/take-in-more.test.mjs` | 138 | pass 138・fail 0 |
| `node --test tests/l10n-lib.test.mjs tests/l10n-repo.test.mjs tests/l10n-audit.test.mjs tests/l10n-audit-more.test.mjs` | 172 | pass 172・fail 0 |

合わせて 345 件、落ち 0。`tests/l10n-*.test.mjs` と `tests/take-in*.test.mjs` は、この7つのファイルで全部（Glob で確かめた）。曹参の記録の件数と一致する。

出力に出る `Error: ENOENT ... nls.keys.json`・`ja の localizations が無い` は、extract・count が落ちる件で子の l10n-ja.mjs が stderr に出すもの。件そのものは通っている。

## 6. scripts/ に差分が無いか

`git diff HEAD --stat -- scripts/` の出力は空（追跡しているファイルの変更なし）。未追跡の `scripts/l10n-probe.mjs` は会話の初めの `git status` から既にあり、このタスクの物でない（コミットに含めない）。

## コミットしてよいファイル

- `tests/l10n-r6.test.mjs`
- `tasks/2026-11-17-r6-test-gaps/handoff-notes-cao-shen.md`
- `tasks/2026-11-17-r6-test-gaps/verification-r6-test-gaps.md`（この記録）

ほかの変更・未追跡のファイル（`tasks/2026-11-13-p2-build-switch/`・`tasks/2026-11-16-p5-c1-product-keys/` の変更、`tests/probe-dns.ps1`、`scripts/l10n-probe.mjs`、`tests/p34*`・`tests/probe-*` など）は、このタスクと関係ない。含めない。

# 検証の記録: インストールの手順書と、--portable・switch.ps1 の直しの再検証（大岡越前守）

- 担当: 大岡越前守（ooka-echizen）、2026-11-15
- 依頼: リーダーの依頼文（再検証の1〜4）と `tasks/2026-11-15-install-doc-fix/brief.md`
- 対象: 蒙恬の `scripts/install-extensions.mjs`・`scripts/switch.ps1`・`tasks/2026-11-15-install-doc/install-draft.md`・`tasks/2026-11-15-install-doc/handoff-notes.md`。曹参の `tests/install-portable.test.mjs`・`tests/switch-watch-warn.test.mjs`・`tests/install-doc.test.mjs`。リーダーが直した docs/02 の6節（手順0）
- 前回の記録: `tasks/2026-11-15-install-doc-verify/handoff-notes-ooka.md`

## 判定

**合格**

前回の不合格の点1〜3と軽微な点1〜3は、どれも直っている。テストは全体で 1608 件、落ちたもの 0。手順書の直していないところのコマンドは、前回の照らし合わせのまま台本と合う。docs/02 の6節の手順0とも合う。下の「軽微な点」は、合否には効かない。

## 1. 前回の点が直っているか

| 前回の点 | 確かめたこと | 結果 |
|---|---|---|
| 不合格1（`--portable` の場所が無いと普段の場所に入る） | `install-extensions.mjs` の差分を読んだ。(a) `--portable` があれば、VSIX を取る前に `portableProblem(layout.product)` を確かめる（339〜345行）。product.json を読めないときや、`target` があるときは止まる。これは 1.146.0 の `configurePortable` の `!('target' in product)` と同じ条件。(b) dry-run の後、CLI を走らせる直前に `ensurePortableDir` で場所を作り、フォルダとして在ることを確かめる（378〜382行）。(c) 入れたあとに `<portable>\extensions` が無ければ誤りで止まる（393〜399行）。`childEnv` に渡す `VSCODE_PORTABLE` は `path.resolve(a.portable)` で、作った場所と同じ。22行の守り（336〜338行）は変わっていない。`--portable` だけのときも、(b)(c) があるので普段の場所には入らない。`resolveEditorLayout` が `product` を返すことは `scripts/build.mjs` の459・468行で確かめた | 直っている |
| 不合格1（実機） | 蒙恬のやり直しの成果物を読んだ。`C:\b\trial-install-doc\portable-fix\extensions\extensions.json` には8件があり、`location` はすべて `C:/b/trial-install-doc/portable-fix/extensions/...`。`out\ext-portable-fix.json` は `result: ok`、`portable.existedBefore: false`、`created: true`、`extensionsDirExists: true`、`argv.path` が `portable-fix\argv.json`、`compare.ok: true`。`portable-fix\user-data\CachedProfilesData\` もある | 試しの場所に入った |
| 不合格1（handoff-notes の「試していないもの」） | `handoff-notes.md` の要点4・表の5・「試していないもの」から、`.shuko` に向けた導入の記述を外した。「試しが普段の場所に漏れた」の節を足した | 事実に合う |
| 不合格2（手順4の終了コード1） | 表の1の行に、`フォルダが無い: <installRoot>\current`（`build.mjs` 440行）と `CLI が無い: <場所>`（`install-extensions.mjs` 332行）の2つが書かれ、どちらも「手順2をやり直す」になっている | 直っている |
| 不合格3（`.shuko-shared`） | 冒頭の説明、表の行、出典（`environmentService.ts`・`storageMainService.ts`）、4.1 の確かめ、8節の「すっかり消すとき」に足されている。`product.overlay.json` の8行は `sharedDataFolderName: .shuko-shared`。本家の列の「OSS のソースの値は `.vscode-oss-shared`」は `C:\b\wt\1.146.0\product.json` の6行と一致する | 直っている |
| 軽微1（SHA-256 の出典） | 出典は `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json` の `zip.sha256` になった。97行の値は、手順書の値と全桁で一致する | 直っている |
| 軽微2（`-NoMove` のやり直しの範囲） | 「手順2の `switch.ps1 … -Zip …` だけ。手順3はやり直さない」になった。`configure.ps1` の305〜369行で、`-NoMove` でも手順5（ショートカットと PATH の向け直し）が行われ、止まるのは `-NoShellIntegration` のときだけであることを確かめた | 直っている |
| 軽微3（`--dry-run` も取る） | 手順4の冒頭に「キャッシュに無い VSIX はこのときに Open VSX から取る」とある。`install-extensions.mjs` の353〜362行（dry-run の判定は376行で、それより後）と合う | 直っている |
| 範囲外の気づき2（docs/06 の2.3。`switch.ps1` に検知の表示が無い） | `switch.ps1` に `-WatchState`・`Get-WatchStatus`・`Write-WatchStatus` が足された。表示は、どの使い方でも local.json を読む前に行う（322〜332行）。仕組みは `readWatchStatus`（`scripts/lib/take-in/writeback.mjs` 66〜88行）と同じで、`lastSuccessAt` を読み、`> 3` 日なら警告する。状態が無い・JSON でない・日時が無いときは警告して続ける。止めず、終了コードも変えない。既定の場所 `%LOCALAPPDATA%\Shuko\watch\state.json` は、`watch.mjs` の既定（19・157〜160行）と `take-in.mjs`（603・879行）と合う。台本は ASCII の文字だけでできている（Grep で ASCII 以外の文字が 0 件） | docs/06 の2.3 に合う |

## 2. テスト

### テストの中身（曹参）

- `install-portable.test.mjs`（13件）: 偽の CLI は `configurePortable` を真似ている。`VSCODE_PORTABLE` の場所が在るときだけそこを使い、無ければ黙って `USERPROFILE\<dataFolderName>` に入れる。普段の場所はサンドボックスの `USERPROFILE` の下にある。直す前の台本だと、1件目は `portableExistedAtCall` と「普段の場所ができない」の確かめで落ちる形になっている。「CLI が `--portable` を捨てた」場合は、終了コード 1 を求める。この2つで、落ちるべきときに落ちる。本家の3つの `dataFolderName`、`--extensions-dir` だけの場合、dry-run、SHA-256 の不一致、`target` があるときも押さえている。
- `switch-watch-warn.test.mjs`（10件）: サンドボックスの `LOCALAPPDATA` を渡すので、本物の `%LOCALAPPDATA%\Shuko\watch\` は読まない。5日・30日・4日前なら警告、1日・2日・0日前なら警告なしで、日時を表示する。状態が無い・壊れている・キーが無い・日時でないときは、警告して止まらない。`-WatchState` が既定の場所より先に効くこと、`-List` でも表示すること、終了コード 4 が変わらないことも確かめている。「新しければ警告なし」のテストは、JSON の `watch.warn` と標準エラーの両方を見るので、緩くなっていない。
- 仕様を緩めた箇所や、実装に合わせて期待を変えた箇所は見当たらない。

### 流したもの（すべてリポジトリの直下）

```
node --test tests/install-portable.test.mjs tests/switch-watch-warn.test.mjs tests/install-doc.test.mjs
→ tests 27 / pass 27 / fail 0
node --test tests/switch.test.mjs tests/switch-expand.test.mjs tests/install-ext.test.mjs tests/configure.test.mjs tests/take-in.test.mjs tests/take-in-more.test.mjs
→ tests 240 / pass 240 / fail 0
node tests/run-all.mjs --save <scratchpad>\run-all-ooka.txt
→ 終了コード 0（2回流し、2回とも 0。run-all.mjs は fail が 1 件でもあれば 1 で終わる）
```

`run-all.mjs --save` の出力は、私の許可では読めない場所にあった。そこで、件数は `run-all.mjs --only <名前>`（`--no-ps` と、PowerShell の2本はそれぞれ単独で）で、ファイルごとに流し直して数えた。

| ファイル | tests | pass | fail | skip |
|---|---|---|---|---|
| apply-cli / apply-commits / apply-parts / apply-prune / apply-selfcheck / apply | 7 / 18 / 57 / 7 / 33 / 33 | 同じ | 0 | 0 |
| build-commit / build-env-branch / build-fixes / build-parts | 21 / 29 / 17 / 38 | 同じ | 0 | 0 |
| removals | 229 | 222 | 0 | 7 |
| absent / builtin-l10n / cli-run / local-config / lock | 20 / 19 / 14 / 46 / 115 | 同じ | 0 | 0 |
| make-icons / notion-sync / p1-scripts / p34-selfcheck / signtool | 17 / 101 / 33 / 1 / 17 | 同じ | 0 | 0 |
| smoke / sublime-keys / watch / switch-watch-warn | 75 / 50 / 104 / 10 | 同じ | 0 | 0 |
| install-portable / install-doc / switch / switch-expand / install-ext / configure / take-in / take-in-more | 13 / 4 / 22 / 17 / 46 / 17 / 95 / 43 | 同じ | 0 | 0 |
| measure.tests.ps1 / netaudit.tests.ps1 | 138 / 102 | 同じ | 0 | 0 |
| **合計** | **1608** | **1601** | **0** | **7** |

曹参の `run-all-result.json` の件数（1608 / 1601 / 0 / 7）と、ファイルごとに一致する。飛ばした7件は `removals.test.mjs` で、従来どおり。

## 3. 手順書の、直したところ以外のコマンド

- 前回の検証（`baf206d` の下書き）から今までに変わった台本は、`git status`・`git log` で見ると `scripts/install-extensions.mjs` と `scripts/switch.ps1` の2つだけ。`configure.ps1`・`register-task.ps1`・`set-token.ps1`・`watch.mjs`・`take-in.mjs`・`adopt.mjs` は変わっていない。
- `install-extensions.mjs` の `parseArgs`・終了コード（0・1・2・3）・出力のキーは変わっていない。手順書が使うのは引数なし・`--dry-run`・`--rev` で、`--portable` は使わない。このため新しい守り（`--portable` のときだけ効く）は、手順書の手順に関わらない。
- `switch.ps1` の param は `-WatchState` が増えただけ。ほかの引数・出力・終了コード（0・1・3・4）は変わっていない。どの使い方でも標準エラーに1行増えるが、手順書の手順2にはそれが書いてある。標準出力の JSON に `watch` が増えても、手順書が見どころに挙げるキーはそのまま。
- 手順書の差分（`git diff`）は、上の1節で確かめた箇所だけだった。ほかの節の文は前回と同じ。前回の照らし合わせ（`handoff-notes-ooka.md` の1節）は、そのまま当てはまる。

## 4. docs/02 の6節（手順0）と手順書

- docs/02 の154行には「0. 切り替え先の版が台帳の拡張の `engines.vscode` を満たすかを確かめる。満たさなければ止まる（終了コード4）。最後に更新の検知が成功した日時を表示し、3日より古ければ警告する（止めない。06 の2.3）」とある。
- 手順書では、手順2（100〜103行）に、検知の表示が3つ（成功・3日超え・記録なし）と「止めず、終了コードも変えない」が書かれている。8節（343行）には、終了コード4（`engines` を満たさない、切り替えていない）が書かれている。手順0の2つの中身はどちらも手順書にあり、食い違いは無い。
- 台本（`switch.ps1`）は、手順0の2つを、検知の表示、`engines` の確かめの順に行う。docs/02 は2つを1つの手順にまとめていて、順序を決めていないと読めるので、食い違いとはしない（曹参の「見つけた点」の2）。docs/06 の2.3 の「起動時に」とも合う。

## 軽微な点（合否に効かない。直すかはリーダーの判断）

1. **蒙恬・`tasks/2026-11-15-install-doc/handoff-notes.md` の照らし合わせの表（57・60・63行）**: 行の番号が直しの前のままになっている。たとえば `switch.ps1` の param は 48〜59 行から 59〜71 行に動いた（蒙恬も「気づいたこと」の5に書いている）。検証の入口の表なので、次に照らし合わせる人のために、行の番号を今の台本に合わせるか、関数の名前で書くとよい。
2. **リーダー・docs/02 の6節の手順0**: 台本は、検知の表示を `<label>` のときだけでなく、`-List`・`-Previous`・`-ExpandOnly` でも、誤りで止まるときでも出す。`-WatchState` で場所を変えられ、状態が無ければ警告して続ける。docs/02 は `switch.ps1 <label>` の手順としてだけ書いている。合わせるなら「どの使い方でも初めに表示する」の一言を足す（docs/06 の2.3 には「起動時に」とあるので、食い違いではない）。
3. **曹参・テスト**: 次の4つは押さえていない。(a) `target` があるときに `<portable>` が作られないこと（今の確かめは、CLI が呼ばれないことと、普段の場所ができないことだけ）。(b) `--cli` の上の product.json を読めないときに止まること。(c) ちょうど3日の境目。(d) pwsh 7 で `ConvertFrom-Json` が日時に変える経路（`runPs` は `powershell` 5.1 だけで流す）。手順書は `powershell` を使うので、(d) はユーザーの手順に関わらない。
4. **範囲外（蒙恬の「気づいたこと」の3）**: 本家の `dataFolderName` の版で `--extensions-dir` だけを渡すと、拡張は指定の場所に入る。一方で、CLI のログと `CachedProfilesData` は普段のユーザーのデータ（公式の zip なら `%APPDATA%\Code`）に書かれる見込み。直すかはリーダーの判断。
5. **リーダー・片付け**: 前の試しで `%USERPROFILE%\.shuko\extensions\` と `%APPDATA%\Shuko\` にできたものは残っている（蒙恬の未解決の1）。試しの場所 `C:\b\trial-install-doc\` の下には、`portable-fix\`・`fix-fake\`・`watch-fix\` が増えた。
6. **コミットの前に**: 作業ツリーでは、今回の範囲外の `tests/probe-dns.ps1` も変わっている。`tests/probe-netlog*.ps1`・`tests/probe-nodedebug.ps1` などの未追跡のファイルもある（会話の初めの時点から）。今回の検証では見ていない。

## 流したコマンド

- `git status`、`git diff`（`scripts/install-extensions.mjs`・`scripts/switch.ps1`・`docs/02-repository-and-build.md`・`install-draft.md`・`handoff-notes.md`。`--stat` も）、`git log`
- `node --test tests/install-portable.test.mjs tests/switch-watch-warn.test.mjs tests/install-doc.test.mjs`（27件すべて合格）
- `node --test tests/switch.test.mjs tests/switch-expand.test.mjs tests/install-ext.test.mjs tests/configure.test.mjs tests/take-in.test.mjs tests/take-in-more.test.mjs`（240件すべて合格）
- `node tests/run-all.mjs --save <scratchpad>`（2回。どちらも終了コード 0）
- `node tests/run-all.mjs --no-ps --only <名前>`（apply・build・removals・absent・l10n・cli-run・local-config・lock・icons・notion・p1-・p34・signtool・smoke・sublime・watch）、`node tests/run-all.mjs --only measure`・`--only netaudit`
- ほかは Read・Grep・Glob による読み取りだけ（リポジトリ、`C:\b\trial-install-doc\portable-fix\`・`out\ext-portable-fix.json`、`C:\b\wt\1.146.0\product.json`）

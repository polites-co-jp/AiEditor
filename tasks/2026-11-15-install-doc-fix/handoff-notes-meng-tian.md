# 引き継ぎ: install-extensions の --portable、switch.ps1 の検知の警告、手順書の直し（蒙恬）

- 担当: 蒙恬（meng-tian）、2026-11-15
- 依頼: `tasks/2026-11-15-install-doc-fix/brief.md` の「やること（蒙恬）」1〜6

## 結果

- 結果: 完了（brief の蒙恬の1〜6）
- 成果物:
  - `scripts/install-extensions.mjs`（`--portable` の守り。`portableProblem`・`ensurePortableDir` を書き出した）
  - `scripts/switch.ps1`（`-WatchState`、`Get-WatchStatus`・`Write-WatchStatus`。ASCII だけのまま）
  - `tasks/2026-11-15-install-doc/install-draft.md`（不合格の点の2・3、軽微な点の1〜3、switch.ps1 の警告）
  - `tasks/2026-11-15-install-doc/handoff-notes.md`（表の5、「試していないもの」、「試しが普段の場所に漏れた」の節、要点の4）
  - `tasks/2026-11-13-p2-build-switch/build-switch-design.md`（4節の守りとテストの入口、5節の検知の鮮度とテストの入口）
  - この文書
- 要点:
  1. `install-extensions.mjs --portable` は、CLI を走らせる直前に場所を作り、エディタがポータブルとして扱う2つの条件（場所がフォルダとして在る、product.json に `target` が無い）を確かめてから走らせる。`target` があるか product.json を読めなければ、VSIX を取る前に止める。入れたあとに `<portable>\extensions` があることも確かめる。
  2. 22行の守り（本家の `dataFolderName` なら `--portable` か `--extensions-dir` を求める）は、`--portable` だけのときも効くようになった。前は場所が無いと `--portable` が黙って捨てられ、守りを通ったまま普段の場所に入っていた。偽の CLI（`dataFolderName: .vscode`）で、`VSCODE_PORTABLE` が作った場所を指すことを確かめた。
  3. `switch.ps1` は、どの動作でも初めに検知の最後の成功を1行出し、3日を超えるか記録が無ければ `WARNING` を出す。止めない。状態のファイルが無いときは「警告して続ける」（`readWatchStatus` と同じ）。
  4. 手順書は、終了コード1の2つの文、`.shuko-shared`、SHA-256 の出典、`-NoMove` のやり直しの範囲、`--dry-run` の取得、switch.ps1 の警告を直した・足した。
  5. 本物のエディタの CLI で `C:\b\trial-install-doc\portable-fix` に入れ直し、8つの拡張とログが試しの場所に入ったことを確かめた。

## 確かめたこと（2026-11-15、この PC。普段の場所には書いていない）

### install-extensions.mjs

| # | コマンド（リポジトリの直下。`--config C:/b/trial-install-doc/cfg/local.json` は全部に付けた） | 結果 |
|---|---|---|
| 1 | `node --check scripts/install-extensions.mjs` | 誤りなし |
| 2 | `--cli C:/b/trial-install-doc/fix-fake/ed/bin/shuko.cmd --portable C:/b/trial-install-doc/fix-fake/p1 --no-download`（偽の CLI。product.json の `dataFolderName` は `.vscode`、`target` なし。`p1` は無い） | 終了コード 0。`portable.created: true`・`existedBefore: false`・`extensionsDirExists: true`。偽の CLI の記録（`fix-fake\ed\bin\calls.log`）の9回（入れる8回と一覧1回）すべてで `VSCODE_PORTABLE=C:\b\trial-install-doc\fix-fake\p1`。`argv.json` は `p1\argv.json` |
| 3 | `--cli …/fix-fake/edt/bin/shuko.cmd --portable …/p2`（product.json に `"target": "user"`） | 終了コード 1。`message` は「product.json に target（"user"。インストーラーの版）がある…」。VSIX の照合の前に止まり、偽の CLI は呼ばれていない（`edt\bin\calls.log` が無い） |
| 4 | `--cli …/fix-fake/noprod/bin/shuko.cmd --portable …/p4`（`..\..` に product.json が無い） | 終了コード 1。`editor: null`、「product.json を読めない…」。CLI は呼ばれていない |
| 5 | `--cli …/fix-fake/ed/bin/shuko.cmd --portable …/p5`（`p5` は同じ名前のファイル） | 終了コード 1。「フォルダとして無い…」。CLI は呼ばれていない |
| 6 | `--cli …/fix-fake/ed/bin/shuko.cmd --portable …/p3 --dry-run` | 終了コード 0、`result: dry-run`、`portable.created: false`（作らない） |
| 7 | `--cli …/fix-fake/ed/bin/shuko.cmd --dry-run`（`--portable` も `--extensions-dir` も無い） | 終了コード 1。前からの守り「dataFolderName が .vscode…」。変わっていない |
| 8 | `--portable C:/b/trial-install-doc/portable-fix --no-download --out C:/b/trial-install-doc/out/ext-portable-fix.json`（本物の CLI `B\current\bin\shuko.cmd`。`portable-fix` は無い） | 終了コード 0（約18秒）。`portable.created: true`、`extensionsDirExists: true`、`compare.ok: true`。`portable-fix\extensions\` に8つの拡張と `extensions.json`、`portable-fix\user-data\logs\20261115T0200xx\cli.log`（7つ）と `CachedProfilesData\`、`portable-fix\argv.json` ができた |

### switch.ps1（`powershell` 5.1。`-ConfigPath C:/b/trial-install-doc/cfg/local.json`）

| # | 引数 | 結果 |
|---|---|---|
| 1 | `-List -WatchState C:/b/trial-install-doc/watch-fix/fresh.json`（`2026-11-14T12:00:00.000Z`） | 終了コード 0。標準エラー `[switch] update watch last succeeded: 2026-11-14T12:00:00.000Z`、`watch.warn: false`、`ageDays: 0.2` |
| 2 | `-List -WatchState …/old.json`（`2026-11-10T00:00:00.000Z`） | 終了コード 0。`[switch] WARNING: update watch has not succeeded for 4 day(s) (last 2026-11-10T00:00:00.000Z)`、`warn: true`、`ageDays: 4.7` |
| 3 | `-List -WatchState …/missing.json`（無い） | 終了コード 0。`[switch] WARNING: no update watch record (...)`、`found: false` |
| 4 | `-List -WatchState …/bad.json`（JSON でない） | 終了コード 0。`[switch] WARNING: cannot read the update watch record (...)`、`found: true` |
| 5 | `-List -WatchState …/nokey.json`（`lastSuccessAt: null`） | 終了コード 0。`[switch] WARNING: the update watch record has no lastSuccessAt (...)` |
| 6 | `1.146.0-2 -UserDataDir C:/b/trial-install-doc/portable-fix/user-data -WatchState …/old.json` | 終了コード 0。警告を出したうえで `1.146.0-1 → 1.146.0-2` に切り替えた（止まらない） |
| 7 | `-Previous -UserDataDir … -WatchState …/fresh.json` | 終了コード 0。`1.146.0-2 → 1.146.0-1` に戻した |

- `grep` で `switch.ps1` に ASCII のほかの文字が無いことを確かめた（Windows PowerShell 5.1 が BOM の無い台本を ANSI で読むため）。
- 走らせていないもの: `node --test`（テスト全体。私の許可に無い）、`pwsh` での `switch.ps1`（許可に無い）。

## 確かめた外部の事実と出典

- 1.146.0 の `src/bootstrap-node.ts` の `configurePortable`（205〜247行。`C:\b\wt\1.146.0\`）: `isPortable = !('target' in product) && fs.existsSync(portableDataPath)`（239行）。ポータブルでなければ `delete process.env['VSCODE_PORTABLE']`（246行）。CLI も `src/cli.ts` の17行でこれを通る。
- `build/gulpfile.vscode.win32.ts` の82行: インストーラーの版（`user`・`system`）だけが product.json に `target` を入れる。zip には入らない。
- `src/vs/platform/environment/common/environmentService.ts`: `extensionsPath` は `--extensions-dir` → `VSCODE_EXTENSIONS` → `<VSCODE_PORTABLE>\extensions` → `<home>\<dataFolderName>\extensions`（131〜148行）。`appSharedDataHome` は `<VSCODE_PORTABLE>\shared-data` か `<home>\<sharedDataFolderName>`（151〜163行）。`childEnv` は `VSCODE_*` を外すので、`VSCODE_EXTENSIONS` が親から漏れることはない。
- `src/vs/platform/environment/node/userDataPath.ts` の52〜54行: ポータブルならユーザーのデータは `<VSCODE_PORTABLE>\user-data`（CLI のログもその下）。
- 本家の公式の版の `sharedDataFolderName` の値は、Web の検索では見つからなかった。手順書には「確かめていない。OSS のソースの値は `.vscode-oss-shared`」と書いた（`C:\b\wt\1.146.0\product.json` の6行）。

## テストの入口（曹参へ）

### A. `scripts/install-extensions.mjs` の `--portable`

書き出した関数（純粋な部分。`import { portableProblem, ensurePortableDir } from '../scripts/install-extensions.mjs'`）:

| 関数 | 入力 | 期待 |
|---|---|---|
| `portableProblem(product)` | `{ nameShort: 'Shuko', dataFolderName: '.shuko' }` | `null`（効く） |
| 〃 | `{ ..., target: 'user' }`（`target` のキーがあれば値を問わない。`target: undefined` でも） | 文字列（`target` を含む） |
| 〃 | `null`・`undefined`・配列・文字列 | 文字列（`product.json を読めない` を含む） |
| `ensurePortableDir(dir, { product })` | 無い `dir`、`product` に target なし | 場所が作られる。返り値 `{ path: <絶対>, existedBefore: false, created: true, extensionsDir: <path>\extensions }` |
| 〃 | 既にあるフォルダ | `{ existedBefore: true, created: false }`。中身は変えない |
| 〃 | 同じ名前のファイルがある | 例外（`フォルダとして無い`）。ファイルは消さない |
| 〃 | `product` に target、または `product` が null | 例外。**場所を作らない**（mkdir の前に確かめる） |
| 〃 | `''`・空白だけ・文字列でない | 例外（`空`） |

`ensurePortableDir` の第2引数の `fsImpl` で `existsSync`・`mkdirSync`・`statSync` を差し替えられる（呼ばれた順・引数を記録する形のテストに使える）。

台本ごと走らせる形（偽の CLI。本物のエディタは起動しない）:

```
node scripts/install-extensions.mjs --config <試しの local.json> --cli <偽>\bin\shuko.cmd --portable <無い場所> --no-download --cache <試しのキャッシュ> --lock <試しの台帳> --out <json>
```

- 偽のエディタの形: `<偽>\bin\shuko.cmd` と `<偽>\resources\app\product.json`（`--cli` のとき、版の形は `<cli>\..\..` から読む。`makeFakeEditor` の形でよい）。product.json が無いと `--portable` では止まる（下の表）。
- 偽の CLI がすること: 環境の `VSCODE_PORTABLE` と引数をファイルに書く。`--install-extension` なら `%VSCODE_PORTABLE%\extensions` を作る（本物のエディタと同じく、入れたら拡張の場所ができる）。`--list-extensions` なら台帳の `id@version` を1行ずつ出す。私の試しの偽は `C:\b\trial-install-doc\fix-fake\ed\bin\shuko.cmd`（参考。テストの中で作り直してほしい）。
- 台帳とキャッシュ: `--lock` に1件の台帳、`--cache` に `<id>-<版>\<ファイル>` の VSIX（中身は何でもよい。台帳の `sha256` をその中身の SHA-256 にする）。`--no-download` で外へ取りに行かない。

| 場合 | 終了コード | 出力（JSON）の見どころ |
|---|---|---|
| 無い `--portable`、product.json に target なし（`dataFolderName` が `.vscode` でも `.shuko` でも） | 0 | `result: "ok"`、`portable.created: true`、`portable.existedBefore: false`、`portable.extensionsDirExists: true`、`argv.path` が `<portable>\argv.json`。偽の CLI の記録で、毎回 `VSCODE_PORTABLE` が `<portable>` の絶対パス |
| 同じ、ただし偽の CLI が `extensions` を作らない（エディタが普段の場所に入れた場合の再現） | 1 | `result: "error"`、`message` に `--portable の場所に拡張が入っていない` |
| product.json に `"target": "user"` | 1 | `message` に `target`。偽の CLI は一度も呼ばれない。`<portable>` は作られない。VSIX も取らない（照合の前に止まる） |
| `--cli` の `..\..` に product.json が無い、かつ `--portable` | 1 | `editor: null`、`message` に `product.json を読めない`。CLI は呼ばれない。`<portable>` は作られない |
| `--portable` の場所にファイルがある | 1 | `message` に `フォルダとして無い`。CLI は呼ばれない |
| `--dry-run --portable <無い場所>` | 0 | `result: "dry-run"`、`portable.created: false`。`<portable>` は作られない |
| `dataFolderName` が `.vscode`、`--portable` も `--extensions-dir` も無い | 1 | 前からの守り（`--portable か --extensions-dir を付ける`）。変えていない |

### B. `scripts/switch.ps1` の検知の警告

- 新しい引数 `-WatchState <path>`。無ければ `%LOCALAPPDATA%\Shuko\watch\state.json`（`LOCALAPPDATA` が空なら場所なし＝「記録が無い」扱い）。
- **どの動作でも**（`<label>`・`-Previous`・`-List`・`-ExpandOnly`、誤りで止まるときも）、local.json を読む前に1回読む。標準エラーに1行、標準出力の JSON に `watch` を入れる。止めない。終了コードを変えない。状態のファイルに書かない。
- JSON の `watch`: `{ statePath, found, lastSuccessAt, ageDays, warn, message }`（`take-in.mjs` の `readWatchStatus` と同じ名前。`statePath` を足した）。
- 読み方は `readWatchStatus` と同じ: `lastSuccessAt` を読み、今との差が **3日を超えたら**（`> 3`）警告。

| 状態のファイル | `found` | `warn` | `lastSuccessAt` | 標準エラーの1行 |
|---|---|---|---|---|
| 3日以内（例 1日前） | true | false | 書かれた文字列 | `[switch] update watch last succeeded: <lastSuccessAt>` |
| 3日を超える（例 5日前） | true | true | 書かれた文字列 | `[switch] WARNING: update watch has not succeeded for <n> day(s) (last <lastSuccessAt>)`（`<n>` は日数の切り捨て） |
| 無い | false | true | null | `[switch] WARNING: no update watch record (<path>); the update watch may not be running` |
| JSON でない | true | true | null | `[switch] WARNING: cannot read the update watch record (<path>)` |
| `lastSuccessAt` が無い・null・文字列でない・日時として読めない | true | true | 読めない文字列ならその文字列、ほかは null | `[switch] WARNING: the update watch record has no lastSuccessAt (<path>)` |

- 状態が無いときの扱いは「警告して続ける」と決めた（`readWatchStatus` と同じ。初めて入れた直後は、検知を登録する前に `switch.ps1` を走らせるため、止めると手順2が進まない）。
- 既存の `tests/switch*.test.mjs` は `LOCALAPPDATA` を差し替えていないので、本物の `%LOCALAPPDATA%\Shuko\watch\state.json` を（読むだけ）読む。結果は変わらないが、本物の場所を読ませないなら、`runPs` の env に試しの `LOCALAPPDATA` を入れるか `-WatchState` を渡してほしい。
- PowerShell 7（pwsh）の `ConvertFrom-Json` は ISO の文字列を DateTime にするので、その場合も同じ形の文字列（`yyyy-MM-ddTHH:mm:ss.fffZ`）に戻して出す。pwsh での試しは私の許可に無く、走らせていない（`powershell` 5.1 だけで試した）。
- 日時の読み方は .NET の `DateTimeOffset.TryParse`（InvariantCulture、時差の無い文字列は UTC とみなす）。`watch.mjs` が書くのは `toISOString()` の形なので `readWatchStatus`（`Date.parse`）と結果は同じ。`yesterday` のような文字列はどちらも読めない。ISO でない変わった形（例 `11/15/2026`）では両者が食い違うことがあるが、テストで押さえる要は無いと考える。

### C. 手順書（`install-draft.md`）

テストは要らないと考える。`tests/install-doc.test.mjs`（曹参の分）が手順書の文を見ているなら、直した文（手順4の終了コード1の行、表の `.shuko-shared` の行、冒頭の SHA-256 の出典）に合わせて見直してほしい。

## 手順書の直しの対応

| 検証の点 | 直したところ |
|---|---|
| 不合格の点の2（終了コード1） | 手順4の表の1の行に `フォルダが無い: <installRoot>\current`（手順2の前）と `CLI が無い: <場所>` の2つを書き、どちらも手順2をやり直す、とした |
| 不合格の点の3（`.shuko-shared`） | 冒頭の表に「アプリケーションの共有の保存場所」の行、冒頭の説明に `sharedDataFolderName`、置き場所の出典に `environmentService.ts`・`storageMainService.ts`、4.1に「できているかを見る」、8節の「すっかり消すとき」に `%USERPROFILE%\.shuko-shared`（あれば） |
| 軽微な点の1（SHA-256 の出典） | 冒頭を `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json` の `zip.sha256`（97行。全桁があることを確かめた）に |
| 軽微な点の2（`-NoMove`） | 「手順2の `switch.ps1 … -Zip …` だけをやり直す。ショートカットと PATH は向け直されるので手順3はやり直さない（やり直すと PATH に2つ入る）」に。`configure.ps1` の305〜369行（`-NoMove` は移さないだけで、5の向け直しは `-NoShellIntegration` のときだけ行わない）で確かめた |
| 軽微な点の3（`--dry-run` も取る） | 手順4の冒頭に「キャッシュに無い VSIX はこのときに取る。オフラインだと誤りになる」 |
| brief の2（switch.ps1 の警告） | 手順2に、3つの表示（成功・3日超え・記録なし）と、手順7の前は「記録なし」が出るが誤りでないこと |

## docs/ との食い違い・気づいたこと

1. **docs/06 の2.3**: 「`switch.ps1` が起動時に…表示し、3日より古ければ警告する」は、これで台本と合った。docs の直しは要らない。ただし、`-WatchState` と、状態が無いときに警告して続ける扱いは docs に無い。docs/02 の6節（`switch.ps1` の手順）か docs/06 の2.3 に一言足すかは、リーダーの判断。
2. **docs/04 の5節**: `install-extensions.mjs` の `--portable` の守り（場所を作る、`target` があれば止める）は docs に無い（設計の書き物 `build-switch-design.md` の4節には足した）。docs/02 の8節が設計の書き物を正としているので、docs の直しは要らないと考える。
3. **`--extensions-dir` だけの守り（範囲外の気づき。直していない）**: 22行の守りは、本家の `dataFolderName` の版でも `--extensions-dir` があれば通す。そのとき拡張は指定の場所に入るが、CLI のログと `CachedProfilesData` は普段のユーザーのデータ（公式の zip なら `%APPDATA%\Code`）に書かれる（`userDataPath.ts`。今回の試しで、CLI が `user-data\logs\` と `CachedProfilesData\` を作ることを確かめた）。拡張とは違い害は小さいが、本家のデータに書くことになる。直すなら「本家の `dataFolderName` の版では `--portable` を必須にする」か「`--user-data-dir` も求める」。採るかはリーダーの判断（取り込みの `smoke-net.mjs` は `--portable` と `--extensions-dir` の両方を渡すので、どちらの案でも影響しない）。
4. **取り込みの通信の監査の環境**（`scripts/take-in.mjs` の `buildNetEnv`）: `--portable` の場所（`<envDir>\user`）を先に作ってから `install-extensions.mjs` を呼んでいるので、今回の欠陥の影響は受けていなかった。今回の直しでも動きは変わらない（版の product.json に `target` は無く、`--extensions-dir` があるので入れたあとの確かめは行わない）。
5. **前の引き継ぎの行の番号**: `tasks/2026-11-15-install-doc/handoff-notes.md` の照らし合わせの表の `switch.ps1` の行の番号（param 48〜59行など）と `install-extensions.mjs` の行の番号は、今回の直しでずれた（`switch.ps1` は param が59〜71行、本体の処理は約70行後ろへ。`install-extensions.mjs` は守りの分だけ後ろへ）。表は直していない。

## 未解決の点

1. **普段の場所の片付け**: 前の試しで `%USERPROFILE%\.shuko\extensions\` と `%APPDATA%\Shuko\` にできたものは、私の許可では読めず消せない。リーダーかユーザーが決める（手順書の手順4の本番の導入は `--force` で同じ版を入れ直すだけなので、残しても害は小さい見込み。`%APPDATA%\Shuko\` は本番の初めての起動で使う場所なので、ログと `CachedProfilesData` が先にあるだけ）。
2. **試しの場所に増えたもの**: `C:\b\trial-install-doc\` の下に `portable-fix\`（8つの拡張とユーザーのデータ。大きさは測っていない）、`fix-fake\`（偽の CLI と出力）、`watch-fix\`（状態の試しのファイル）、`out\ext-portable-fix.json`、`B\backups\20261115-020145\`・`20261115-020153\`、`B\history.txt` に2行（`1.146.0-1 → 1.146.0-2`、`1.146.0-2 → 1.146.0-1`。`current` は元の `1.146.0-1`）。消す道が私の許可に無いので残してある。
3. **走らせていない確かめ**: `node --test`（既存のテストへの影響。とくに `tests/switch*.test.mjs` は標準エラーに1行増える。`r.stderr` を誤りの文に添えるだけで、中身で落とす箇所は見当たらない）と、`pwsh` での `switch.ps1`。どちらも私の許可に無い。曹参の `node tests/run-all.mjs --save` で分かる。

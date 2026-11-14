# 検証の記録: インストールの手順書の下書き（大岡越前守）

- 担当: 大岡越前守（ooka-echizen）、2026-11-15
- 依頼: `tasks/2026-11-15-install-doc-verify/brief.md` の「やること（大岡越前守）」1〜4
- 対象: 蒙恬の `tasks/2026-11-15-install-doc/install-draft.md` と `tasks/2026-11-15-install-doc/handoff-notes.md`

## 判定

**不合格**（直す点は小さい。手順書の骨組みと、ほとんどのコマンド・終了コード・出力は台本と合っている）

不合格にした理由は次の2つ。

1. **試しが普段の場所に漏れた見込みが高い（brief の3）**。手順5の `install-extensions.mjs --portable C:/b/trial-install-doc/portable` で、8つの拡張は試しの場所に入らず、普段の `%USERPROFILE%\.shuko\extensions` に入ったと見られる。原因は台本 `install-extensions.mjs` の欠陥（下の「不合格の点」の1）。handoff-notes の「試していないもの: `install-extensions.mjs` を普段の場所（`%USERPROFILE%\.shuko`）に向けた導入」は、結果として事実と違う。
2. **手順書の記述が台本の出力・ソースと合わない点が2つある（brief の1）**。手順4の終了コード1の対処と、データの置き場所の表・「すっかり消すとき」から `.shuko-shared` が抜けている点（下の「不合格の点」の2・3）。

brief の2（docs/07 の7節の3の項目、docs/02・04・05・06 との整合、裁定）は満たしている。

## 1. コマンドと台本の照らし合わせ（brief の1）

handoff-notes の「照らし合わせ」の表を、台本のソースで1行ずつ確かめた。

| 手順書の節 | 確かめたこと | 結果 |
|---|---|---|
| 1 | `configure.ps1` の param（36〜44行）: `-InstallRoot`・`-KeepVersions`・`-BuildRoot`・`-BuilderRepo`・`-NoMove`・`-NoShellIntegration`・`-ConfigPath`。終了コード 0・1・3（26行）。引数なしで local.json が無ければ作り `created local.json with the defaults`（229行）、あれば値を出すだけ（222〜238行）。`-BuilderRepo` は `extensions.lock.json` が無いと止まる（254行）。入れ子の拒否（279行）、UNC・固定ドライブ・NTFS の確かめ（87〜95行）、同じ名前があれば混ぜずに止まる（308・310行）、失敗したら戻し local.json は前のまま（372〜376行） | 合う |
| 1 | 「ファイルの中は `%LOCALAPPDATA%\Programs\Shuko`」: 既定は `scripts/lib/local-config.ps1` の38行。`resolved` は展開した値（`Resolve-ShukoLocalConfig`） | 合う |
| 1 | 手順5の向け直し: 「プログラム」の直下の `*.lnk` だけ（343行。`Get-ChildItem -Filter '*.lnk' -File`、再帰しない）、`TargetPath` が前の `current` の下なら書き換え（345〜349行）、新しくは作らない。PATH は `HKCU\Environment` の生の値と種類のまま（138〜173行）、`%VAR%` を展開して比べる（131行） | 合う |
| 2 | `switch.ps1` の param（48〜59行）、`-Sha256` の照合は展開の前（307〜310行）、ラベルの形（303行）、`target.exe`・`engines.unsatisfied`・`history`・`backup.missing` の出力（319・341・363・379行）、`-List` の `current`・`versions`（283〜293行） | 合う |
| 2 | 「更新の検知は `1.146.0` か `1.146.0-1` の形だけ読む」: `tools/watch/lib/judge.mjs` の `labelToVersion` は `^(\d+\.\d+\.\d+)(?:-\d+)?$`（33行）。`currentCoreVersion` は読めなければ `upstream.json` に戻る（`watch.mjs` 125〜139行） | 合う |
| 3.1・3.2 | `.lnk` の場所 `[Environment]::GetFolderPath('Programs')`、PATH の `%LOCALAPPDATA%\Programs\Shuko\current\bin` は、上の向け直しの範囲に入る形 | 合う |
| 3.2 | `shuko --version` の3行: 試しの版のフォルダの `product.json` は `version` 1.146.0、`commit` `d5fd4c3a7558f7216fe5e9ba86970d11aceb40aa`（126・141行） | 合う |
| 4 | `install-extensions.mjs` の `parseArgs`（191〜224行）。`--dry-run` は照合のあと `argv.path` を決めて終わる（327〜329行）。`--rev`（227〜231行）。終了コード 0・1・2・3（24行）。出力のキー `vsix[].sha256Ok`・`compare.ok`・`argv.endsWithNewlineBrace`（318・350・367行） | 合う。ただし終了コード1の「`CLI が無い` なら手順2をやり直す」は合わない（不合格の点の2） |
| 4 | 台帳の8件（`extensions.lock.json` の id）と手順書の8つの名前 | 合う |
| 6 | コマンド「Notion 同期: トークンを設定」「差分を見る」「トークンを消す」（`extensions-src/notion-sync/package.json` の category と `src/extension.mts`）。「Notion を採る」（222行）、ステータス「同期済み」（64行）、出力パネル「Notion 同期」（37行）。トークンを入れたとき、`pageId` があり `enabled` が false なら有効にするか聞く（291〜293行）。手順書は4（pageId）を5（トークン）の前に置いているので、聞かれる順になっている | 合う |
| 7 | `set-token.ps1` の param（`-Path`・`-Force`）と出力 `set-token: saved to ... Read back OK; length <数>.`（72行）。既にあると `-Force` を促して終了コード1（40〜43行） | 合う |
| 7 | `watch.mjs` の `parseArgs`（96〜116行）。`--check-token` は Notion に接続せず `ok`・`length`・`prefix`（174〜185行）。`--check` は `ok`・`schemaErrors`（213〜220行）。`--dry-run` は log を作らず（304行）、state を動かさず（322行）、`exitCode`・`current`・`plan` を返す（373〜385行）。終了コード 0・1・2（27行） | 合う |
| 7 | `register-task.ps1` の param（34〜43行）と `-DryRun` の出力5行（87〜94行）。手順書に写した出力の形は、87〜93行の `Write-Host` と一字ずつ合う。`-Unregister`（49〜56行）、`-At` の形（58行）、`LogonType Interactive`・`RunLevel Limited`（84行） | 合う |
| 7（取り込み） | `take-in.mjs core <tag>`・`ext <id> [<version>]`（7〜9行）、ToDo の詳細の「起動するコマンド: node scripts/take-in.mjs ...」（`judge.mjs` 188・263行）、題名 `取り込みの検証: ...`（`scripts/lib/notion-todo.mjs` 65〜70行）、`records/take-in/<label>/verdict.md`（`take-in.mjs` 480行）、`adopt.mjs <label>`（6行） | 合う |
| 8 | `switch.ps1 -Previous`（296〜301行。`history.txt has no earlier version for <label>`、終了コード1）、写すユーザーのデータの5つ（227行）、`backup.json` の `from`・`to`・`createdAt`（238行）、終了コード 0・1・3・4（35行）、`removable`（383行） | 合う |
| 冒頭 | zip の SHA-256: `sha256sum C:/b/dist/1.146.0-p2-all.zip` → `15aa0ce75ead4e7455cfe4f40557f62c2b56b4822151319271e30916e3081f6f`。手順書の値と一致 | 合う（出典の書き方は軽微な点の1） |
| 8 | `shuko://` の登録: 1.146.0 の `src/vs/platform/url/electron-main/electronUrlListener.ts` 54〜57行（ポータブルでないとき `app.setAsDefaultProtocolClient`） | 合う |

テスト（台本のふるまいの裏付け）:

```
node --test tests/configure.test.mjs tests/switch.test.mjs tests/switch-expand.test.mjs tests/install-ext.test.mjs tests/watch.test.mjs tests/local-config.test.mjs
→ tests 252 / pass 252 / fail 0
node --test tests/install-doc.test.mjs   （曹参の分。参考に流した）
→ tests 4 / pass 4 / fail 0
```

## 2. docs/ と裁定との整合（brief の2）

- docs/07 の7節の3の8項目（`configure.ps1` による local.json の作成と場所を変える手順、zip の展開、`current`、スタートメニューと PATH、台帳の拡張、外部ツール、Notion の設定、更新の検知の登録）は、手順1〜7にそろっている。7節の4（本家を戻る先に残す）も冒頭と8節にある。
- docs/02 の6節・6.1: 置き場所、`history.txt` の形、写すユーザーのデータ、`keepVersions`、local.json のキーと既定、場所を変える6手順、どれも合う。ラベル `1.146.0-1` は「本家のタグ-ビルドの番号」に合う。
- docs/04 の5節: 入れ方の5手順、`--rev` による戻し、VSIX のキャッシュ。合う。6.1 のテーマ（Light Modern）と `basedpyright.importStrategy: useBundled` も合う。
- docs/05: 同期するもの、`ignoredSettings`、SecretStorage、`pageId` を設定に置く、インテグレーションを分ける、「Add connections」。合う。
- docs/06: 毎日・`StartWhenAvailable`・ログオン中だけ、データソース ID `7949c589-...`、DPAPI のファイルの場所、初めての起動は英語（5節）、取り込みの入口と入れ替え（3・8節）。合う。
- docs/01 の4.1: 外部ツールの表と確かめ方が一致する。Claude Code の CLI のコマンド（`irm https://claude.ai/install.ps1 | iex`）と Notion の開発者のポータルの URL は、私の道具では Web を確かめられないので、蒙恬の出典の読みのままにしている（照合していない）。
- 裁定（`docs/user-decisions.md`）に反する手順は無い。トークンはどちらもユーザー本人が入れ、エージェントに渡さないと明記（手順6の5、手順7の3）。入れ替え（`switch.ps1`・`adopt.mjs`・`install-extensions.mjs`）はユーザーが行う形（裁定「新しい版への入れ替え」）。外部ツールは別に入れる（裁定 2026-11-12・2026-11-13）。インテグレーションは2つ（裁定）。Smart App Control はオフ（裁定 2026-11-14）。本家の VS Code は消さない。

## 3. 蒙恬の試しの範囲（brief の3）

確かめたもの（`C:\b\` の読み取りと、試しの場所に残った成果物）:

- `C:\b\trial-install-doc\cfg\local.json` の `installRoot` は `C:/b/trial-install-doc/B`。試しの local.json は試しの場所にある。
- `C:\b\trial-install-doc\B\history.txt` は3行（`- → 1.146.0-1`、`1.146.0-1 → 1.146.0-2`、`1.146.0-2 → 1.146.0-1`）。handoff の手順3・7・8・9と合う。
- `B\backups\*\backup.json` の `userDataDir` は3つとも `C:/b/trial-install-doc/...`。普段の `%APPDATA%\Shuko` は写されていない。
- 手順2・9 は `-NoShellIntegration` 付きなので、スタートメニューと PATH には触らない（`configure.ps1` 335〜336行）。
- 手順11 は `-DryRun`（登録しない。`register-task.ps1` 92〜95行）。手順13・14 は `--state-dir`・`--token-file` を試しの場所に向けている。`--check`（Notion に接続する）は試していないと書かれている。
- local.json の本物・スタートメニュー・PATH・タスクスケジューラ・Notion に触れた痕跡は、見た範囲では無い。ただし、私の読める場所は `./` と `C:/b/` だけなので、本物の `%LOCALAPPDATA%\Shuko\local.json` や `HKCU\Environment` を直には見ていない。上の確かめは、試しの成果物と台本の分岐から言える範囲にとどまる。

**漏れた見込みのもの（不合格の点の1）**:

- handoff の手順5（`install-extensions.mjs --config … --portable C:/b/trial-install-doc/portable`）のあとで、`C:\b\trial-install-doc\portable\` の中身は `argv.json` の1つだけだった（`Glob **/*`）。ポータブルとして動いたなら、`portable\extensions\`（8つの拡張）と `portable\user-data\` ができるはず。
- 原因はソースで説明がつく。1.146.0 の `src/bootstrap-node.ts` の `configurePortable` は、`VSCODE_PORTABLE` の指す場所が**存在するときだけ**ポータブルとして扱い（239行 `fs.existsSync(portableDataPath)`）、無ければ `VSCODE_PORTABLE` を消す（246行）。CLI（`src/cli.ts` の17行）もこれを通る。すると拡張の置き場所は既定の `<USERPROFILE>\<dataFolderName>\extensions`（`environmentService.ts` 147行）になる。
- `install-extensions.mjs` は `--portable` の場所を作らずに CLI を走らせる（`main` の 332〜341行。場所を作るのは `argv.json` を書く 362行だけ）。手順5の時点で `portable\` は無かったので、CLI は普段の場所に入れ、そのあと `argv.json` だけが `portable\` に書かれた。出力 `C:\b\trial-install-doc\out\ext-portable.json` の `compare.ok: true` は、普段の場所の一覧を読んだ結果と見られる。
- 見込み: 2026-11-15 01:33（JST）ごろに、`%USERPROFILE%\.shuko\extensions\` に8つの拡張ができ、`%APPDATA%\Shuko\` に CLI のログができた。私の許可ではその場所を読めないので、確かめてはいない。
- brief の3が挙げる5つ（local.json・スタートメニュー・PATH・タスクスケジューラ・Notion）には入らない。それでも、試しの範囲から外れた書き込みであり、handoff-notes の「試していないもの」の記述と食い違う。害は小さい見込み（手順4の本番の導入は `--force` で同じ版を入れ直すだけ。`argv.json` は普段の場所に書かれていない）。

## 4. 読むだけの確かめ（brief の4）

`configure.ps1`・`switch.ps1`・`install-extensions.mjs`・`register-task.ps1`・`watch.mjs` は、試しの形で走らせるものも、私の許可（Bash）に載っていない。そのため台本は走らせず、ソースの読みと、上のテスト、`sha256sum`、試しの成果物の読み取りで確かめた。

## 不合格の点（誰の成果のどこを、どう直すか）

1. **蒙恬・`scripts/install-extensions.mjs` の `--portable`**（手順書の外。台本の欠陥）: `--portable <dir>` の場所が無いと、エディタはそれを黙って捨て、普段の場所に入れる。直し方は2案ある。CLI を走らせる前に `fs.mkdirSync(<portable>, { recursive: true })` で作るか、無ければ止めるか。この欠陥があると、22行の守り（本家の `dataFolderName` の CLI では `--portable` か `--extensions-dir` を求める）も、`--portable` だけのときは効かない。公式の zip で試すと、本家の `%USERPROFILE%\.vscode\extensions` に入ってしまう。曹参には、「無い `--portable` の場所でも普段の場所に入らない」ことを確かめるテストが要る。あわせて handoff-notes の「試していないもの」を直す。リーダーは `%USERPROFILE%\.shuko\extensions` と `%APPDATA%\Shuko` の有無と日時を確かめ、要らなければ片付けを決める。
2. **蒙恬・install-draft.md の手順4の終了コードの表（1の行）**: 「`CLI が無い` なら手順2をやり直す」とあるが、`current` が無いとき（手順2の前）の誤りの文は `フォルダが無い: <installRoot>\current` になる（`scripts/build.mjs` の `findAppDir` 440行。`resolveEditorLayout` が先に投げる）。`CLI が無い:`（`install-extensions.mjs` 292行）が出るのは、版のフォルダはあって CLI が無いときだけ。両方の文を書き、どちらでも手順2をやり直すようにする。
3. **蒙恬・install-draft.md の「普段の VS Code とは分かれている」の表と、8節の「すっかり消すとき」**: product.json の `sharedDataFolderName` は `.shuko-shared`（docs/02 の3節）。1.146.0 は、アプリケーションの共有の保存場所を `<USERPROFILE>\<sharedDataFolderName>\sharedStorage` に作る（`src/vs/platform/storage/electron-main/storageMainService.ts` 203行、`environmentService.ts` 151〜163行の `appSharedDataHome`）。表に `%USERPROFILE%\.shuko-shared\`（本家は `.vscode-shared` の類）を足し、消すものの一覧にも足す。実機で作られるかは、手順4.1の初めての起動で確かめると書く。

## 軽微な点（直すかはリーダーの判断）

1. 冒頭の SHA-256 の出典 `records/phase2/phase2-close.md` には、略した値（`15aa0ce7…6f6f`）しか無い。全桁は `tasks/2026-11-15-p2-all-build/1.146.0-p2-all/build-record.json` の97行にある。値そのものは、計算し直して一致した。
2. 手順1の「`-NoMove` を付けると … そのときは手順2からやり直します」: `-NoMove` でも、`-NoShellIntegration` が無ければ、手順5のショートカットと PATH の向け直しは行われる（`configure.ps1` 334〜369行）。「手順2から」を手順3.2まで読むと、PATH に同じ項目を2つ足すことになる。「手順2の `switch.ps1 -Zip` だけをやり直す（スタートメニューと PATH は向け直し済み）」と書くほうが誤りにくい。
3. 手順4の `--dry-run` も、キャッシュに無い VSIX は Open VSX から取る（`install-extensions.mjs` 306〜315行）。「何も入れません」は正しいが、「取得はする」と一言あると、オフラインのときに戸惑わない。

## 範囲外の気づき（docs と台本の食い違い。手順書の誤りではない）

1. docs/02 の6節の `switch.ps1 <label>` の手順は3つだけで、台本の最初の確かめ（台帳の `engines`、終了コード4）が書かれていない。手順書は台本に合わせて書かれている。docs/02 の8節は台本の設計の書き物を正としているので、docs/02 の6節を直すかはリーダーの判断。
2. docs/06 の2.3（79行）には「`take-in.mjs` と `switch.ps1` が起動時に『最後に検知が成功した日時』を表示し、3日より古ければ警告する」とある。`switch.ps1` にはこの処理が無い（`take-in.mjs` は `readWatchStatus` を持つ）。手順書はこれに触れていない。

## 流したコマンド

- `sha256sum C:/b/dist/1.146.0-p2-all.zip`（一致）
- `node --test tests/configure.test.mjs tests/switch.test.mjs tests/switch-expand.test.mjs tests/install-ext.test.mjs tests/watch.test.mjs tests/local-config.test.mjs`（252 件すべて合格）
- `node --test tests/install-doc.test.mjs`（4 件すべて合格）
- ほかは Read・Grep・Glob による読み取りだけ（リポジトリ、`C:\b\trial-install-doc\`、`C:\b\wt\1.146.0\src\`、`C:\b\vscode\src\`）

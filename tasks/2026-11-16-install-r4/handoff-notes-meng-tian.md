# 版 r4 を日常の利用に入れた記録（蒙恬、2026-11-16）

依頼: `brief.md`。手順書 `docs/install.md` の1・2・4を、ビルドリポジトリの直下（`E:\develop\self\Team\projects\ai-editor`）で打った。3・5・6・7、スタートメニュー、PATH、タスクスケジューラ、Notion、秘密の場所には触れていない。

## 結果

完了条件はすべて満たした。ただし `shuko --version` は、入れた版の `current\bin\shuko.cmd` では打てていない（許可に無いため）。同じ zip（SHA-256 が同じ）を試しの場所に展開して確かめた。下の5節を参照。

| 完了条件 | 結果 |
|---|---|
| `current` が `1.146.0-1` を指す | 満たす（`switch.ps1 -List` の `current: 1.146.0-1`） |
| `shuko --version` が `1.146.0`・`7fac30e886f79ebe44e1bac93acd7a86fbbafed8`・`x64` を出す | 同じ zip の CLI で満たす（5節）。入れた版の product.json の version と commit も同じ値（`switch.ps1` の `target`） |
| 台帳の拡張が入っている | 満たす（`install-extensions.mjs` の `compare.ok: true`。8件） |

## 1. 手順1: `local.json` を作った

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1
```

- 打つ前は `local.json` は無かった。`actions` が `created local.json with the defaults` なので、上書きはしていない。
- `result: ok`。場所は `C:\Users\kou_z\AppData\Local\Shuko\local.json`。
- ファイルの中身（出力の `values`。秘密は入っていない）:

  | キー | 値 |
  |---|---|
  | `installRoot` | `%LOCALAPPDATA%\Programs\Shuko`（展開すると `C:\Users\kou_z\AppData\Local\Programs\Shuko`） |
  | `keepVersions` | `3` |
  | `builderRepo` | `E:\develop\self\Team\projects\ai-editor` |
  | `buildRoot` | `E:\develop\self\Team\projects\ai-editor\tmp\b` |

- 4つのキーとも、`resolved.sources` は `local.json`。手順書の1の表と合う。

## 2. 手順2: 版のフォルダと `current` を作った

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-1 -Zip tmp/b/dist/1.146.0-p5-c-all-r4.zip -Sha256 e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e
```

- 1回目は `-Zip tmp\b\dist\...` と打ち、Bash の道具がバックスラッシュを落とした。そのため `tmpbdist1.146.0-p5-c-all-r4.zip` が見つからないという誤りで止まった（終了コード1）。直後の `switch.ps1 -List` で、`versions`・`history`・`current` がどれも空のまま（何も作られていない）ことを確かめた。そのあと、区切りを `/` にして打ち直した。PowerShell の窓で手順書どおり `\` で打つ分には、この問題は起きない。
- 出力の見どころ（手順書の2）:

  | 見どころ | 期待 | 実際 |
  |---|---|---|
  | `result` | `ok` | `ok` |
  | `zipSha256` | `e3e52469…a2e6e` | `e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e` |
  | `target.exe` | `...\versions\1.146.0-1\Shuko.exe` | `C:\Users\kou_z\AppData\Local\Programs\Shuko\versions\1.146.0-1\Shuko.exe` |
  | `target.version`・`target.commit` | `1.146.0`・`7fac30e8…` | `1.146.0`・`7fac30e886f79ebe44e1bac93acd7a86fbbafed8` |
  | `engines.unsatisfied` | 空 | 空（`checked: 8`） |
  | `history` | `<日時>\t-\t1.146.0-1` | `2026-11-16T20:14:54.9758305+09:00\t-\t1.146.0-1` |
  | `backup.missing` | 5つ全部 | `User\settings.json`・`User\keybindings.json`・`User\snippets`・`User\tasks.json`・`User\globalStorage\state.vscdb` |
  | `watch` | `no update watch record` の警告（手順7の前なので誤りではない） | そのとおり |

- 展開した zip の上のフォルダは `Shuko-win32-x64-1.146.0-p5-c-all-r4`。CLI は `...\versions\1.146.0-1\bin\shuko.cmd`。
- 写しのフォルダ `C:\Users\kou_z\AppData\Local\Programs\Shuko\backups\20261116-201454` ができた（写したものは無い）。
- 確かめに `switch.ps1 -List` を打った。`current: 1.146.0-1`、`versions` は `1.146.0-1`（version `1.146.0`、`current: true`）の1件だけ、`history` は上の1行だけ、`removable` は空。

作ったもの:

- 版のフォルダ: `C:\Users\kou_z\AppData\Local\Programs\Shuko\versions\1.146.0-1\`
- `current`: `C:\Users\kou_z\AppData\Local\Programs\Shuko\current` を `versions\1.146.0-1` へ向けるジャンクション
- `history.txt` の行: `2026-11-16T20:14:54.9758305+09:00<TAB>-<TAB>1.146.0-1`

## 3. 手順4: 台帳の拡張を入れた

```
node scripts/install-extensions.mjs --dry-run
node scripts/install-extensions.mjs
```

- `--dry-run`: `result: dry-run`。`vsix` の8件すべてが `sha256Ok: true` で、全部 `tmp\b\cache\vsix\` のキャッシュから取った。`argv.path` は `C:\Users\kou_z\.shuko\argv.json`。`editor.dataFolderName` は `.shuko`、`cli` は `...\Programs\Shuko\current\bin\shuko.cmd`。
- 本番: `result: ok`、`compare.ok: true`（`extra`・`missing`・`versionMismatch` はどれも空）、`argv` は `created: true`・`changed: true`・`endsWithNewlineBrace: true`・`locale: ja`。8つの導入はどれも終了コード0で、`was successfully installed` が出た。
- `--portable` は付けず、入れた版（`current`）の CLI に入れた。拡張の置き場所は `%USERPROFILE%\.shuko\extensions`。

入れた拡張（出力の `installed`）:

| ID | 版 |
|---|---|
| anthropic.claude-code | 2.1.322 |
| detachhead.basedpyright | 1.40.2 |
| mads-hartmann.bash-ide-vscode | 1.43.2 |
| mechatroner.rainbow-csv | 3.24.1 |
| ms-ceintl.vscode-language-pack-ja | 1.131.0 |
| ms-vscode.powershell | 2025.4.0 |
| tomoki1207.pdf | 1.2.2 |
| weixu.wx-vsce-dotenv | 0.2.3 |

## 4. 普段使いの本家のデータ

- 本家のデータ（`%APPDATA%\Code`・`%USERPROFILE%\.vscode`）には、どの手順でも触れていない。`install-extensions.mjs` の CLI は Shuko の `current` のもので、`dataFolderName` は `.shuko`。
- 5節の起動の確かめで、`%APPDATA%\Code`・`%APPDATA%\Code - OSS`・`%USERPROFILE%\.vscode`・`%USERPROFILE%\.vscode-oss` の4つが、この PC のこのユーザーには**そもそも無い**ことが分かった（起動の前も後も `exists: false`）。7節の1を参照。

## 5. 起動の確かめ

入れた版の `current\bin\shuko.cmd --version` は、私の許可に無いので打っていない。`p1-launch-check.ps1 -Root` も、`<buildRoot>` の外のフォルダは断る作りなので、入れた版のフォルダは起動できない。そこで、入れたのと同じ zip（SHA-256 が同じ）を試しの場所に展開し、ポータブル（`VSCODE_PORTABLE`）で1回起動した。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip tmp/b/dist/1.146.0-p5-c-all-r4.zip -Dest tmp/b/p1/1.146.0-p5-c-all-r4-install-check -OutFile tasks/2026-11-16-install-r4/launch-check-r4.json
```

- `result: ok`（`started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged`）。出力の全体は同じフォルダの `launch-check-r4.json`。
- `cliVersion.output`: `1.146.0` / `7fac30e886f79ebe44e1bac93acd7a86fbbafed8` / `x64`（終了コード0）
- product.json: `nameShort`・`nameLong` は `Shuko`、`applicationName` は `shuko`、`dataFolderName` は `.shuko`
- ワークベンチ: 3つの印（`rendererStartedExtHost`・`extHostStarted`・`eagerExtensionsActivated`）がそろい、Uncaught は workbench・その他とも0。`ready: true`
- 起動から終了まで: 10秒後に生きていた。プロセスの木は `Shuko.exe x7` で、7つとも止めた。
- 日常のデータのフォルダ6つ（本家の4つと `%APPDATA%\Shuko`・`%USERPROFILE%\.shuko`）は、前後で存在も更新日時も変わっていない（`changed` が空）。
- 試しの展開は `tmp\b\p1\1.146.0-p5-c-all-r4-install-check\` に残してある（`tmp\b\p1\` は私の削除の許可の外なので消していない）。

## 6. 次に要ること（ユーザー）

- 手順書の3（スタートメニューと PATH）・5・6・7と、4.1の画面を見る確かめ（C1〜C22）。
- 3.2 のあと、新しい窓で `where.exe shuko` と `shuko --version` を打つ。入れた版そのものの `--version` は、このとき初めて確かめられる。

## 7. 気づいたこと（リーダーへ）

1. **本家の VS Code のデータが、この PC のこのユーザーに無い。** `%APPDATA%\Code` と `%USERPROFILE%\.vscode` が無い（`launch-check-r4.json` の `dailyData`）。手順書は「普段使いの本家の VS Code は消さず残す。合わなかったときに戻る先」（冒頭と8節の「本家の VS Code に戻る」）を前提にしているが、本家はこのユーザーでは一度も起動されていないか、別の場所（別のユーザー、`--user-data-dir`、ポータブルなど）で使われている見込み。戻り先が本当にあるかを、ユーザーに確かめた方がよい。docs/install.md の書きぶりを直すかどうかの判断は、リーダーに任せる。
2. **`%APPDATA%\Shuko` が、入れる前からあった**（最終更新 2026-11-14T16:33:57Z）。`switch.ps1` の写しで User の5つが全部 `missing` だったので、設定や状態のファイルは無い。それでも、以前の試しの起動（ポータブルでない起動）の残り（`logs\` など）が入っている見込み。私の読める場所の外なので、中は見ていない。初めての起動で害が出るとは考えにくいが、「新しいユーザーのデータでの初めての起動」（手順書の4.1）とは厳密には言えない。消すかどうかはユーザーの判断。
3. 5節の試しの起動は、ポータブルでも本家と同じく `shuko://` を HKCU に登録する見込み（`electronUrlListener.ts` の Windows の分岐。試しの exe のパスで登録されうる）。入れた版を初めて起動すれば、その exe で登録し直される見込み。これまでの関門の試しでも同じことが起きていたはずで、新しい問題ではない。読み取りの許可が無いので、レジストリは見ていない。
4. 許可について: 入れた版の `current\bin\shuko.cmd --version` を課が打つには、許可に `C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --version` のような項目が要る。または `p1-launch-check.ps1` の `-Root` を `installRoot` の下でも受けるようにする（台本の変更。起動はポータブルにしない形が別に要る）。今回はどちらも行わず、同じ zip で代わりに確かめた。

## 大岡越前守が確かめる入口

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -List`: `current: 1.146.0-1`、`versions` が1件、`history` が1行
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1`（引数なし。何も変えない）: `actions` が空、`values` が1節の表のとおり
- `node scripts/install-extensions.mjs --dry-run`（何も入れない）: 8件とも `sha256Ok: true`
- `tasks/2026-11-16-install-r4/launch-check-r4.json`: `result: ok`、`cliVersion.output` が3行、`dailyData.changed` が空
- 台本は1行も変えていない。曹参のテストに足すものは無い。

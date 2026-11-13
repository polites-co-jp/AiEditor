# docs/ と食い違った事実、直し方の案（p2-build-switch）

- 作成: 蒙恬（2026-11-14）
- 根拠: 本家 1.146.0 のタグのソース（`C:\b\wt\1.146.0`。読むだけ）、この PC での試し（`trial-log.md`）
- docs/ は書き換えていない（リーダーの担当）

| # | 箇所 | 今の記述 | 分かった事実 | 直し方の案 |
|---|---|---|---|---|
| 1 | 02 の4節の8（zip） | 出力のフォルダを `Shuko-win32-x64-<label>` に改名し、`tar -a -c -f <label>.zip <フォルダ>`。tar.exe の zip 作成は推定 | `C:\Windows\System32\tar.exe`（bsdtar 3.8.9）で zip を作れた（公式の展開 3,944 項目を 72 秒、414 MB）。展開（`tar -x`）もできた。この bsdtar には名前の置き換え `-s` が無い（"-s is not supported by this version of bsdtar"） | 「推定」を外す。改名はせず、`<buildRoot>\dist\.stage-<label>\Shuko-win32-x64-<label>` に出力を指すジャンクションを置いて `tar -a -c -H -f <label>.zip -C <段> <名前>` で包む（出力は動かさない）、と書く。理由: 出力の場所を変えないため、公式の展開のような動かせないフォルダでも試せるため |
| 2 | 02 の2節の図 | `C:\b\VSCode-win32-x64\  gulp の出力（作業ツリーの親の直下に出る）` | 1.146.0 の `build/gulpfile.vscode.ts` は `path.join(path.dirname(root), destinationFolderName)`（`root` は作業ツリー）。作業ツリーが `C:\b\wt\<tag>` なので、出力は `C:\b\wt\VSCode-win32-x64\`。作業ツリーが2つあっても出力は同じ場所（後のビルドが前の出力を消す） | 図を `C:\b\wt\VSCode-win32-x64\` に直し、「タグが違っても同じ場所。並べてビルドしない」を足す |
| 3 | 02 の4節の4（依存の導入） | ロックファイル（1.146.0 は `pnpm-lock.yaml` の見込み） | タグ 1.146.0 のロックファイルは6つ: ルート・`build/`・`extensions/`・`extensions/copilot/`・`remote/`・`test/sanity/` の `pnpm-lock.yaml`（apply.mjs `--lockfile-check` の結果）。pnpm は CI の環境では `--frozen-lockfile` が既定（https://pnpm.io/cli/install ）なので、消した依存の分だけ作り直すには `--no-frozen-lockfile` を明示する | 「見込み」を外し、6つの名前を書く。コマンドを `pnpm install --no-frozen-lockfile` と書く |
| 4 | 02 の6節（CLI と実行ファイルの名前） | CLI は `current\bin\<editor>.cmd`（実行ファイルの名前は nameShort から決まる見込み。推定） | 1.146.0 の `build/gulpfile.vscode.ts`: Windows の CLI は `resources/win32/bin/code.cmd` を `bin\<applicationName>.cmd` に改名し、`@@NAME@@` に `nameShort` を入れる（実行ファイルは `<nameShort>.exe`）。公式の展開も `Code.exe`・`bin\code.cmd`（nameShort `Code`、applicationName `code`）で一致。Shuko なら `Shuko.exe`・`bin\shuko.cmd` | ソースで確かめた、と書く（ビルドの後に実物で確かめる点は残す） |
| 5 | 02 の6節（ユーザーのデータの場所） | 推定 `%APPDATA%\Shuko\User` | 1.146.0 の `src/vs/platform/environment/node/userDataPath.ts`: `%VSCODE_APPDATA%`（あれば）か `%APPDATA%` の下の productName（`src/mainImpl.ts` の60行目が `product.nameShort` を渡す）。`--user-data-dir` とポータブルモードはこれより優先 | 「`%APPDATA%\<nameShort>`（`VSCODE_APPDATA` があればその下）。switch.ps1 はこの規則で探し、`-UserDataDir` で上書きできる」と書く。拡張の場所（`%USERPROFILE%\.shuko\extensions`）は今回確かめていない |
| 6 | 02 の6節（`resources\app` の置き場所） | 自分のビルドの出力が公式と同じ形か Phase 1 で確かめる | 1.146.0 の `build/lib/util.ts` の `getVersionedResourcesFolder` は、product.json に `win32VersionedUpdate` があるときだけ `<commit10>` の下に置く。OSS の product.json（作業ツリー）には無い。自分のビルドは直下になる見込み（ビルドは未実行）。build.mjs・switch.ps1・install-extensions.mjs はどちらの形も読む（試しで両方を確かめた） | 見込みとして書き足す |
| 7 | 02 の6節（history.txt） | 切り替えの履歴（日時、前、後） | 形を決めた: 1行 `<ISO 8601>\t<前のラベルか ->\t<後のラベル>`。ラベルだけを書き、パスを書かない（`configure.ps1 -InstallRoot` で移しても読める） | 形を書く |
| 8 | 02 の6節（-Previous） | `history.txt` の1つ前へ戻す | 決めた規則: 後ろから見て、`to` が今のラベルの最初の行の `from` へ。2回続けると2つの版を行き来する | 規則を書く |
| 9 | 02 の6.1 の表（switch.ps1 が使うもの） | `installRoot`、`keepVersions` | switch.ps1 は engines を確かめるため台帳も読む。台帳は local.json の `builderRepo` ではなく、switch.ps1 自身のあるリポジトリのもの（`-LedgerPath` で上書き） | 表の「何に使うか」に「台帳（自分のリポジトリの extensions.lock.json）の engines」を足す |
| 10 | 02 の6.1（読み方の規則） | 読めない・型が違うときは止める | 決めた細目: 知らないキーは誤り（大文字小文字を区別）、`%NAME%` の知らない名前は誤り、展開した後に絶対パス（ドライブ文字か UNC）でなければ誤り、`builderRepo` だけは `null` を「未設定」と認める、`keepVersions` は 1 以上の整数 | 細目を書く（両方の部品の規則として） |
| 11 | 02 の6.1（場所を変えるの5） | スタートメニューのショートカットとユーザーの PATH を新しい `current` に向け直す | 決めた範囲: 既にあるもののうち `<前>\current` を指すものだけを向け直す（ユーザーの Programs の直下の .lnk、ユーザーの PATH）。新しく作らない。登録は手順書（brief の「スタートメニューや PATH への登録は手順書に回す」） | 「既にあるものだけ」と書く。登録の手順書をどこに置くかは未定（未解決） |
| 12 | 02 の7節（記録の形） | 例の項目 | build.mjs は `stoppedAt`・`steps[]`・`applyResult`・`paths`・`config`・`envRemovedForChildren`・`disk`・`warnings` を足した。`durations` の値は秒（数）。`toolchain` に `packageManagerDeclared`・`nvmrc`・`nodeOfBuildScript` を足した（build-switch-design.md の3.1） | 例に `stoppedAt` を足し、詳しい形は設計の書き物を指す |
| 13 | 02 の2節の図と 04 の5節（VSIX のキャッシュ） | `C:\b\cache\vsix\` | lock-fetch.mjs の既定の置き場所は `C:/b/p0/vsix`（Phase 0 のまま）。install-extensions.mjs は `<buildRoot>\cache\vsix\<id>-<版>[@<target>]\<ファイル>`（lock-fetch.mjs と同じ並べ方）を読み、無ければ台帳の download から取ってそこに置く | lock-fetch.mjs の既定の `--out` を `<buildRoot>\cache\vsix` に変えるか、毎週の取り込みで `--out` を渡すかを決める（lock-fetch.mjs は今回の書き込み先の外なので触っていない） |
| 14 | 04 の5節の1 | `<editor>` の CLI は `<installRoot>\current\bin` のもの | 守りを足した: CLI の版の `dataFolderName` が本家のもの（`.vscode`・`.vscode-oss`・`.vscode-insiders`）で、`--portable` も `--extensions-dir` も無ければ止める | 書き足す |
| 15 | 04 の5節の5 | 末尾は `\n}`（既存の中身を書き換えるときも同じ） | install-extensions.mjs は、コメントつきの argv.json でも中身とコメントを残して `locale` を足し、`}` の前を詰めて `\n}` で終える（試しで、エディタの既定に似た中身で確かめた）。`}` の後ろのコメントは捨てる | 変えなくてよい（実装で満たした） |

## 足すとよい点

- 02 の4節: 当てた後の作業ツリーは prepare.mjs が「HEAD が違う・変更がある」で拒むので、ビルドをやり直すときは `build.mjs --fresh`（作業ツリーを消して作り直す）か `--from <手順>`（途中から）を使う、と書く。
- 02 の4節: 子のプロセスに `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を渡さない（Claude Code から起動したときに入っている。docs/07 の3.2 の1と同じ扱い）。

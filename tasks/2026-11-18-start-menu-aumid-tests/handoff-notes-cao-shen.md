# 引き継ぎ: スタートメニューのショートカットの台本のテスト（曹参）

## 状態: 一部完了（台本が無く、台本に対して未実行）

`scripts/start-menu-shortcut.ps1` は、テストを書き終えた時点（2026-11-18）でまだ無かった。仕様（`tasks/2026-11-18-start-menu-aumid/brief.md` の2）から書いた。台本ができたら、下のコマンドで走らせ直す。

## 成果物

- `tests/start-menu-shortcut.test.mjs`（12件）

## 走らせたコマンドと結果

`node --check tests/start-menu-shortcut.test.mjs`: 構文は通った。

`node --test tests/start-menu-shortcut.test.mjs`（台本が無い状態）: 12件、通った4・落ちた8。
- 落ちた8件は、台本が無いための失敗（テストの誤りではない）。
- 通った4件のうち、「`-Read` が .lnk を作らない」「`-Read` が ID を足さない」「`Shuko.exe` が無いとき 0 以外」の2件は、台本が無くても条件を満たすので、実装の確認としては意味がない。台本ができたら、本物の判定になる。
- 独立の読み手と素のショートカットを作る部品は、台本が無くても動くことを確かめた。

## 想定した入口

- 呼び出し: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1 -InstallRoot <root> -ShortcutPath <lnk> [-AppUserModelId <id>] [-Read]`
- 標準出力に `TargetPath=`・`WorkingDirectory=`・`AppUserModelId=` の3行（行頭から。`-Read` では行の形を細かく見ず、`Shuko.exe` と ID が含まれることだけを見る）
- 期待は大文字小文字を区別しないパスの一致

## テストの内容

- 指す先・作業フォルダ・ID（product.json）と3行の出力
- `current` がジャンクションのとき `versions\<版>` を指さない
- `-AppUserModelId` の指定が勝つ
- product.json が無いとき `product.overlay.json` の値（テストは overlay を読み、`Shuko.Editor` と一致も確かめる）
- `-Read` は .lnk の中身と時刻を変えない／素のショートカットに ID を足さない／.lnk が無くても作らない
- `current\Shuko.exe` が無いとき 0 以外で終わり、.lnk を作らず、既にある .lnk も変えない
- 同名 .lnk の上書き、同じフォルダのほかの .lnk の中身・時刻・ID が変わらず、ファイルの増減が無い
- 2回走らせても同じ（べき等）
- ID を独立の読み手（`Shell.Application` の `ExtendedProperty('System.AppUserModel.ID')`）で読めること（PKEY の取り違えは空として落ちる）

すべて `tmp/tests/` の下の一時のフォルダで行い、`-ShortcutPath` を必ず渡す。本物のスタートメニュー・デスクトップ・`%LOCALAPPDATA%\Programs\Shuko` には書かない。

## 書けなかったテスト

`configure.ps1` の向け直し（5）が ID を残すかのテスト。理由: 向け直しは `[Environment]::GetFolderPath('Programs')` を直に見るだけで、場所を差し替える引数・環境変数が無い（`SHUKO_TEST_BASE` も効かない）。試すと本物のスタートメニューに書くことになる。`-NoShellIntegration` を付けないテストは書けない。台本側で Programs フォルダを差し替えられる形（例: `-ProgramsDir` 引数）にするのは蒙恬の仕事。

## 仕様と台本の食い違い

台本が無いので、なし。

## 続き（台本ができた後）

- 台本の入口は蒙恬の `handoff-notes-meng-tian.md` のとおりで、想定した入口と食い違いは無かった。
- 落ちていた1件は、テストの誤りだった。`product.overlay.json` では `win32AppUserModelId` が `set` の下にある（`set.win32AppUserModelId` = `Shuko.Editor`）。テストを `.set.` から読むよう直した。
- 「書けなかったテスト」は、`configure.ps1 -ProgramsDir` が足されたので書いた。`tests/configure.test.mjs` の末尾に2件:
  - 向け直しの後も `System.AppUserModel.ID` が残り、指す先と作業フォルダが新しい root の `current` になる。ID の読みはテスト側の独立の読み手。
  - 取り消し（`<ConfigPath>.tmp` というフォルダを置いて local.json の書き込みを失敗させる）の後、指す先が古い root に戻り、ID が残る。local.json は変わらず、`current` のジャンクションも戻る。
  - どちらも、同じフォルダの `Other.lnk` の中身と時刻が変わらず、フォルダの中身が増減しない。
  - PATH の段は、旧 root が一時の場所なので一致する項目が無い。本物の `HKCU\Environment` の Path を `reg query` で前後に取り、変わらないことを確かめる（`userPath.changed` が false であることも）。
- 実行: `node --test tests/start-menu-shortcut.test.mjs tests/configure.test.mjs` → 31件（台本12、configure 19）、全部通った、落ちた0。

## 未解決

- 台本ができたら全件を走らせ、落ちたものを実装の不具合かテストの誤りかに切り分ける。
- `-Read` の出力の形（3行か、ほかの形か）は仕様に「3つの値を出す」としか無いので、テストは緩くしてある。

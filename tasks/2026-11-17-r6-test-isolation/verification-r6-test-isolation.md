# 検証の記録: configure と move-off-c のテストの切り離し（T3）

- 検証: ooka-echizen（大岡越前守）、2026-11-17
- 対象: 曹参の直し。`tests/configure.test.mjs`（187〜195行）と `tests/move-off-c.test.mjs`（14行の import、92〜106行）
- 基準: `brief.md` の「やること」「決まり」「完了条件」と、r6 の関門の追記（`records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6-addendum.md`）の T3

## 判定

**テストの直しは合格。** 1・2・4 は満たしている。

ただし 3 の「日常の Shuko が動いていることをプロセスで確かめる」は、私も行えなかった。私の許可（`permissions.json`）には、プロセスを一覧するコマンド（`Get-CimInstance Win32_Process` など）が無い。許可にある台本で、エディタを起動しないでプロセスを見られるものも無い（`tests/probe-launch.ps1` と `scripts/p1-launch-check.ps1` はエディタを起動して止めるので使わなかった）。

そのため、完了条件の「日常の Shuko が動いている状態で通る」のうち「動いている状態で」の部分は**判定できない**。その代わりに、2件の結果が Shuko の状態によって変わらないことを、コードから示した（3節）。

## 1. 本物の置き場所を読まず、書かない

`git diff HEAD -- tests/configure.test.mjs tests/move-off-c.test.mjs` で読んだ要点。

- `configure.test.mjs` 190行: `configure.ps1` を走らせる前に、一時の `local.json` へ `{installRoot: <s.root>\OldPct, keepVersions: 3}` を書く。
- `move-off-c.test.mjs` 97行: 走らせる前に、一時の `local.json` へ `{installRoot: <sb>\old-inst}` を書く。
- 前の `installRoot` は `configure.ps1` の271〜272行で `Resolve-ShukoLocalConfig -ConfigPath $ConfigPath` から取る。ファイルに `installRoot` があれば、その値が使われる（`local-config.ps1` の149行）。既定の `%LOCALAPPDATA%\Programs\Shuko`（45行）にはならない。
- `-ConfigPath` と `-NoShellIntegration` は元から付いている。本物の `local.json`・スタートメニュー・PATH にも触れない（`configure.ps1` の335〜336行。`Get-ShukoLocalConfigPath` は `-ConfigPath` が無いときだけ呼ばれる）。
- 新しい置き場所（`%SHUKO_TEST_BASE%\Pct` = `<s.root>\Pct`、`<sb>\inst`）も一時のフォルダの下にある。2件とも `-NoMove` か、移すものが無い形なので、何も移らない。
- 2つのファイルの中で `-InstallRoot` を渡すほかの件（configure.test.mjs の157・172・202・217・232・248・273行）は、どれも前から一時の `installRoot` を書いている。本物の `installRoot` を前の値にする件は、もう残っていない。

`scripts/` には差分が無い（`git status -- scripts/` に変更されたファイルは無い）。未追跡の `scripts/l10n-probe.mjs` が1つあるが、このセッションを始めた時点から未追跡のままで、曹参の記録にも出てこない。T3 の成果ではないので、この件のコミットに入れない。

## 2. 確かめたいことが弱まっていないか

### configure.test.mjs（`%NAME%` を展開しない）

- 確かめる行は変わっていない。193行は、書かれた `installRoot` が `'%SHUKO_TEST_BASE%\\Pct'` のまま残っていることを確かめる。194行は、解決後の値が `<s.root>\Pct` に展開されていることを確かめる。
- 前はファイルの無い状態から始めていたが、今は既存のファイルから始める。それでも、書く値は `configure.ps1` の370行の `$new['installRoot'] = $InstallRoot`（渡したままの値）で、どちらの形でも同じ処理を通る。ファイルが無いときの既定の書き出しは、同じファイルの1件目（50〜71行）が別に確かめている。
- 落ちるべきときに落ちるか: スクリプトが `%NAME%` を展開してから書けば、193行が落ちる。展開しなければ、194行が落ちる。

### move-off-c.test.mjs（PowerShell 側の既定 = NEW_DEFAULT）

- 前の形は、新しく作られた `local.json` に書かれた `buildRoot` を読んでいた。その値は、ファイルが無いときに `configure.ps1` の218行が `$script:ShukoLocalDefaults.buildRoot` を写したものだった。
- 今の形は、出力の JSON の `resolved.buildRoot` を読む。ファイルに `buildRoot` が無いので、`Resolve-ShukoLocalConfig` の150行は同じ `$script:ShukoLocalDefaults.buildRoot` を使い、`ConvertTo-ShukoLocalPath` で絶対パスに直す。`lc()` で正規化して比べるので、比べる元の値は前と同じ PowerShell 側の既定（`local-config.ps1` の43〜48行）になる。
- 件名は「…既定も同じ（configure.ps1 の出力）」で、出力の JSON を見る今の形は件名にも合う。曹参の言うとおり、既存のファイルに `buildRoot` が無いと書き足されない（215〜216行は既存のキーだけを写す）。だから、ファイルを読む形のままでは確かめられず、この替え方は妥当と判断した。
- 落ちるべきときに落ちるか: PowerShell 側の既定が `NEW_DEFAULT` と違う値（たとえば `C:\b`）になれば落ちる。`resolved` が出ない（`resolveError`）ときは、`out.resolved.buildRoot` を読むところで TypeError になって落ちる。終了コードの確認（99行）も残っている。
- 弱まった点と言えるのは、「`configure.ps1` が既定の `buildRoot` をファイルに書くこと」をこの件では見なくなったことだけ。これは `configure.test.mjs` の1件目（62・67行。キーの順に `buildRoot` があり、値が `<repo>\tmp\b`）が確かめている。網としての穴にはならない。
- 気づいた点（直す必要はない）: `out.resolved.sources.buildRoot === 'default'` を足せば、「既定から来た値」であることまで明示できる。ただ、ファイルにもオプションにも `buildRoot` が無いので、今の形でも他の出どころからは来ない。

## 3. 日常の Shuko が動いている状態で通るか

- プロセスは確かめられなかった（判定の節のとおり）。最後に分かっている状態は、今日の r6 の関門の run-all（`tasks/2026-11-17-r6-gate/run-all-r6.txt`、追記の19行）。そのときは、本物の `installRoot` の下で 21 のプロセス（`current\Shuko.exe` が20、`versions\1.146.0-1\…\OpenConsole.exe` が1）が動いていた。それから後に閉じたかどうかは、私には分からない。私は閉じる操作も入れ替えもしていない。
- 結果が Shuko の状態に依らない根拠: 2件とも、前の `installRoot`（`OldPct`・`old-inst`）のフォルダを作らない。`configure.ps1` の283行 `if (Test-Path -LiteralPath $oldRoot)` が偽になり、動いているエディタを探す `Get-EditorProcessesUnder`（284行）は呼ばれない。仮に呼ばれても、探すのは一時の場所の下だけになる。どちらにしても、本物の場所で Shuko が動いているかどうかで `editor-running` になることはない。
- 動いている状態をプロセスで確かめるには、リーダーが、たとえば `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "$env:LOCALAPPDATA\Programs\Shuko\*" }` で数を見てから、下の2つを流し直す。または、私の許可にプロセスを一覧するコマンドを足す（ユーザーの承認が要る）。

## 4. 走らせた数と結果

作業場所はリポジトリの直下。日常の Shuko は閉じていない。

| コマンド | 件数 | 通過 | 落ち |
|---|---|---|---|
| `node --test tests/configure.test.mjs` | 17 | 17 | 0 |
| `node --test tests/move-off-c.test.mjs` | 26 | 26 | 0 |

直した2件はどちらも通った。

- `-InstallRoot: the value is written as the user gave it (a %NAME% is not expanded)`: 546ms
- `PowerShell 側の部品（local-config.ps1）の既定も同じ（configure.ps1 の出力）`: 538ms

本物のプロセスに頼らない件 `a process running from the old location stops it (exit 3)` も通った。これは偽のプロセスを一時の場所の下で動かす件で、エディタを探す仕組みそのものが今も働いていることを示す。r6 の関門のとき（16/17、25/26）に落ちた2件が、今回は通った。

## コミットしてよいファイル

- `tests/configure.test.mjs`
- `tests/move-off-c.test.mjs`
- `tasks/2026-11-17-r6-test-isolation/handoff-notes-cao-shen.md`
- `tasks/2026-11-17-r6-test-isolation/verification-r6-test-isolation.md`（この記録）

入れないもの: `scripts/l10n-probe.mjs`、`tests/probe-*.ps1`・`tests/probe-l10n.mjs`、`tests/p34*`・`tests/fixtures/ref-p34/` など、作業ツリーにあるほかの未追跡・変更のファイル。どれも T3 の差分ではない。

# Phase 1 の検証（1）の記録

- 検証: 大岡越前守（2026-11-13）
- 依頼: `brief.md`
- 基準: docs/06 の5節（2026-11-13 にリーダーが直したもの。コミット 62a9be2）、docs/03 の7節、docs/02 の4節の1・5節、docs/07 の4節、docs/user-decisions.md の末尾の2節
- 対象外: `scripts/netaudit.ps1`・`tests/probe-*.ps1`（別の曹参が直している最中）。`git status` で見ると `scripts/measure.ps1`・`tests/netaudit.tests.ps1` も変更中だが、これも読んでいない

## 判定の一覧

| # | 対象 | 判定 |
|---|---|---|
| 1 | 曹参のスモークの台本（レビュー） | **不合格**（安全の項目はすべて満たす。「自」の項目の覆い・記録の正しさ・基準の作り方が足りない。下の 1.7） |
| 2 | 曹参の単体テストと、公式の zip での実行 | **合格**（46 件すべて通った。実行も FAIL 0 で申告と合う） |
| 3a | 蒙恬の `check-env.ps1` のレビュー | **合格**（読むだけ。版の判定はタグの規則と同じ。軽微な指摘1つ） |
| 3b | 蒙恬の `prepare.mjs` のレビュー | **合格**（clone・fetch・worktree だけ。commit を照合している。軽微な指摘1つ） |
| 3c | `upstream.json` | **合格** |
| 3d | `C:\b\wt\1.146.0` の HEAD | **合格**（`69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| 3e | `C:\b\wt\1.146.0` に変更が無いこと | **判定できない**（自分では確かめられない。`git -C` の許可が無い。記録の上では変更なし） |
| 3f | `check-env.ps1` を走らせ、env-check.md と比べる | **判定できない**（`scripts/check-env.ps1` を走らせる許可が無い） |

---

## 1. 曹参のスモークの台本のレビュー

読んだもの: `tests/smoke-run.mjs`・`tests/smoke-launch.mjs`・`tests/smoke-stop.mjs`・`tests/smoke/lib/{common,env,fixtures,run}.mjs`・`tests/smoke/probe/{extension.js,package.json}`・`tests/smoke.test.mjs`、`tasks/2026-11-13-p1-smoke/` の3つの文書、`C:\b\smoke\runs\` の実行の記録、`C:\b\smoke\baseline-official-1.146.0.json`。

### 1.1 書き込み先が `C:\b\smoke\` に限られているか: 満たす

- 実行の置き場所（`prepareRunDir`）と拡張フォルダ（`prepareExtensions`、インストール用の一時のユーザーデータを含む）は、どれも `assertSafeWritePath` を通す。`C:\b\smoke` の下でなければ止まり、`%APPDATA%`・`~\.vscode`・`~\.vscode-oss` の下も止まる。単体テストで、外・ルートそのもの・`..`・`C:\b\smoke-evil` の前方一致を止めることを確かめている。
- ワークスペース（`createWorkspace`）、`probe-config.json`・`build.json`・`chromium.log`・結果のファイルは、確かめ済みの置き場所の下に書く。probe 拡張が書くのも `cfg.out` と同じフォルダの `terminal-out.txt` と、ワークスペースの中だけ。
- 例外は2つ。どちらも、利用者が引数で渡したときだけ。
  - `--save-baseline <json>` の書き出し先は確かめていない（`run.mjs` 422〜423 行）。
  - `--root` で置き場所の根を変えられ、`assertSafeWritePath` はその根を基準にする。
  どちらも既定の使い方では起きないので、不合格の理由にはしない。直すなら、両方を `C:\b\smoke` の下に限る。
- 実行の外への書き込みは、Claude Code 拡張が作る `~/.claude/ide/*.lock`（1.4）だけ。ほかに `~/.claude/` の下へ何か書くかは、読む許可が無いので見ていない。

### 1.2 普段使いのデータに触れないか（`VSCODE_PORTABLE`、子の環境変数）: 満たす

- `cleanEditorEnv` は `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を大文字小文字を問わずに外し、`VSCODE_PORTABLE` を実行の `user\` に向ける。`CLAUDECODE`・`CLAUDE_CODE_*` も外す。単体テストがある。
- 起動の引数で `--user-data-dir`・`--extensions-dir`・`--logsPath` を、実行の置き場所に向けている。
- `product.json` に `"target"` があれば止める（ポータブルにできないため）。
- 実際の効き方も確かめた。今回の実行の `user\argv.json` には `"locale": "ja"` に加えて、エディタが書いた `crash-reporter-id` がある（ポータブルの argv.json が使われた）。`safety.daily-argv` も PASS。
- 拡張を入れる CLI だけに `ELECTRON_RUN_AS_NODE=1` を渡す。一時のユーザーデータも `C:\b\smoke\ext\` の下に置く。

### 1.3 起動した PID の木だけを止めるか: 満たす

- `stopTree(child.pid)`: プロセスの一覧に起動した PID があるときだけ、`taskkill /PID <その PID> /T /F` を呼ぶ。
- 後始末で止めるのは、実行ファイルが同じで、コマンドラインに実行の置き場所（実行ごとに一意）を含むものだけ（`orphans`、`findRunRoots`）。単体テストで、普段使いのエディタ・別の実行・別の exe を選ばないことを確かめている。
- 今回の実行では、木 28 個を止め、残りも孤児も 0 だった。
- 軽微な点が2つある。
  - 起動した本体が台本より先に終わり、その PID がほかのプロセスに使い回されると、`stopTree` はその別のプロセスの木を止めうる。起こる見込みは低い。
  - `tests/smoke-stop.mjs` は `C:\b\smoke\runs` そのもの（置き場所でなく根）を渡されても通す（`isUnder` は同じパスを真にする）。その場合、すべての実行のエディタ（`smoke-launch` で手の確認に使っているものを含む）が止まる。普段使いのエディタには当たらない。根そのものは拒むよう直すとよい。

### 1.4 普段使いの `~/.claude/ide/*.lock` を消さないか: 満たす

- 消してよいのは「起動の後に増えた `.lock`」のうち、`lockBelongsTo` が真のもの（pid が起動した木にあるか、`workspaceFolders` が実行の ws を含む）だけ。起動の前からあった `.lock` は、比べる対象にも入らない。
- 単体テストで、普段使い（pid も ws も違う）を「他人のもの」と見分けることを確かめている。
- 曹参の6回目（`official-20261113T125044`）で、実行中に増えた他人の `.lock`（47905）を消さずに残した記録がある（`claude.lock-foreign`）。今回の実行では他人の `.lock` は増えず、自分の2個（17497・52266。どちらも pid 60648）だけを消した。
- `authToken` は「ある・なし」しか結果に出さない（単体テストがある）。

### 1.5 試験専用の拡張（`tests/smoke/probe/`）が何をするか: 安全の面は問題なし。ただし誤りが1つある（不合格の理由 A）

すること: `AIED_SMOKE_CONFIG` があるときだけ動く。`onStartupFinished` で起動し、ワークスペースのファイルを開く、編集して保存する、コマンド（パレット、分割、検索、差分、プレビュー、スニペット、整形、問題パネル、新しいウィンドウ）を実行する、ターミナルで `powershell.exe -NoProfile` に `Set-Content` で実行の置き場所へ書かせる、`echo task-ok` のタスクを走らせる、組み込みの git の API でワークスペースのリポジトリにコミットする、診断と補完を API で読む、結果を `probe-result.json` と `commands.json` に書く。Claude Code 拡張は `activate()` せず、自然な起動を待つ。ネットワークに出る処理、ワークスペースと置き場所の外へ書く処理は無い。

**誤り（A）: probe は2つめのウィンドウでも起動し、最初から全部やり直す。**

- 根拠: `C:\b\smoke\runs\ooka-verify-20261113T125822\logs\window2\exthost\exthost.log` の 17 行目に `ExtensionService#_doActivateExtension smoke.smoke-probe ... activationEvent: 'onStartupFinished'`（21:59:43）。`--extensionDevelopmentPath` と `AIED_SMOKE_CONFIG` は、`newWindow` で開いたウィンドウにも引き継がれる。
- 結果1（記録が判定と食い違う）: window2 の probe が同じ `probe-result.json` を上書きする。今回のファイルは `startedAt` 12:59:43Z、`done: false` で、`base.open-folder` が FAIL（`workspaceFolders が空`）、`base.edit-save` が FAIL（`smoke-edit-smoke-edit-before`）の2件だけだった。判定に使った window1 の 30 項目は、ファイルに残っていない。曹参の確定の2回（`T124945`・`T125044`）を含め、`C:\b\smoke\runs\` の `probe-result.json` は `T124137` を除いてすべて `done: false` だった。判定の根拠の記録が、判定と逆のことを書いている。
- 結果2（ワークスペースへの二重の操作）: window2 の probe は、window1 が終わった後のワークスペースに、編集・保存・git の操作をもう一度かける。台本は window2 を待つ 40 秒と 2 秒の間、これを走らせたままにしてから止める。
- 結果3（揺れの元になりうる。推定）: window1 の最後の書き出し（`done: true`）と window2 の最初の書き出しが近いと、台本が `done: true` を読む前に上書きされうる。その場合 `base.launch` は時間切れで FAIL になる。曹参の2回目の実行で起きた「rename の EPERM」も、2つの probe が同じファイルに書いたことが原因だった可能性がある（未確認）。
- 直し方の案（曹参へ）: probe は、`workspaceFolders` が `cfg.ws` と一致するウィンドウでだけ動く。または、`cfg.out` の隣に「始めた印」を排他で作り、2つめ以降は何もしない。単体テストは、2回目の `activate` が何もしないことを確かめる形にする。

### 1.6 docs/06 の5節の「自」の項目を覆っているか: 覆っていない項目がある（不合格の理由 B・C）

| docs/06 の5節（自） | 台本 | 判定 |
|---|---|---|
| 起動する。コンソールと拡張ホストのログに、前の版に無かったエラーが無い | base.launch、errors.*、errors.new（`--baseline` のとき） | 覆う |
| 編集して保存、コマンドパレット、分割、2つめのウィンドウ、ミニマップ | base.edit-save・palette・split・window2・minimap（パレットとミニマップの見え方は手の 5・6） | 覆う |
| ターミナル（PowerShell）でコマンドを実行 | base.terminal | 覆う |
| **全文検索と置換**、差分、git、問題パネル、タスク | base.search・ripgrep・diff・git・problems・task | **置換が無い**（B） |
| Markdown・画像・PDF のプレビュー、タイムライン・ローカル履歴、スニペット、整形 | base.*-preview、base.timeline-localhistory、base.localhistory、base.snippet、base.format | 覆う（タイムラインは、コマンドが登録済みかを見るだけ。弱いが、ローカル履歴の実体は base.localhistory で見ている） |
| 拡張が動作中。`.lock` が1個以上 | claude.running、claude.exthost-log、claude.lock（1個以上で PASS） | 覆う |
| TS の補完とエラー、basedpyright の診断、**HTML/CSS/JSON の補完**、CSV の検査、.env の補完、ShellCheck、PowerShell 7 のセッション | lang.* | **JSON の補完が無い**（C）。JSON は診断だけを見ている。.env の補完は「拡張が動作中」だけを見て、中身は手の 8 に回している（期待する機能が資料に無い。曹参の未決の 4） |
| absence | Phase 2 の `tests/removals/` | 今は対象外（docs/03 の単位がまだ無い） |

- **B（置換）**: `tests/smoke/` に置換を試す処理が無い（`replace`・置換で探して、該当は無かった）。`smoke-design.md` の 1.3 の対応表でも、「全文検索と置換」の行に置換の id が無い。手の手順書（`manual-checks.md`）にも無い。自動でも手でも確かめていない。
- **C（JSON の補完）**: `lang.json.diagnostics` だけで、JSON の補完を確かめる項目が無い。

### 1.7 docs/06 の5節（今日の直し）との照合

- 「信頼は手」: 台本は信頼を切って走らせ、`manual-checks.md` の 1 で手で見る。合う。
- 「`.lock` は1個以上」: 合う。
- 「本家の `test/smoke` は使わない」: 合う。
- **「基準は複数回（3回）の和」: 台本はまだ対応していない（不合格の理由 D）。** `--save-baseline` は1回分の鍵で上書きする（`run.mjs` 423 行）。和を作る手段が無い。今の `C:\b\smoke\baseline-official-1.146.0.json` も1回分（5回目）の鍵 5 個だけ。資料の直しが曹参の納品より後なので、曹参の落ち度ではない。ただ、今の資料に照らすと満たしていない。
  - 直し方の案: `--save-baseline` に、既にある鍵との和を取る形（例 `--merge-baseline`）を足し、公式の zip で3回走らせて基準を作り直す。単体テストは、和を取ることと、走り切らなかった回の鍵を足さないことを確かめる。

### 1.8 手の確認に関わる誤り（不合格の理由 E。推定を含む）

- 根拠: `smoke-result.json` の `probe.uiLanguage` が、全7回（曹参の6回とこの回）とも `"en"`。`user\argv.json` には `"locale": "ja"` があり、言語パック（`MS-CEINTL.vscode-language-pack-ja` 1.131.0）も入っている。`user-data\languagepacks.json` は実行の途中に書かれていた。
- 見立て（推定）: 言語パックの対応表（`languagepacks.json`）はユーザーデータの側に置かれ、起動の後にできる。台本も `smoke-launch.mjs` も毎回新しいユーザーデータで起動するので、初回の起動はいつも英語になる。
- 影響: 手の確認の 2（日本語で表示される）を `smoke-launch.mjs` の初回の起動で見ると、本家でも自作でも × になる。docs/07 の4節の4（言語パックを見る）でも同じことが起きる。自動の判定（`base`・`claude-code`・`languages`）には影響しない。
- 直し方の案: `smoke-launch.mjs` を「1回起動して閉じ、もう一度起動する」形にする。または、手の確認の 2 に「1回目は英語なので、閉じて同じ置き場所で起動し直す」と書く（起動し直す道具が要る）。あわせて、自動の側に `uiLanguage` を INFO で出す項目があるとよい。

### 1.9 判定: 不合格

安全の項目（1.1〜1.4）はすべて満たす。不合格の理由は次の5つ。どれも曹参の成果の中で直せる。

- A: probe が2つめのウィンドウでも動き、判定の根拠の `probe-result.json` を上書きする（`tests/smoke/probe/extension.js`）
- B: 「全文検索と置換」の置換を、自動でも手でも確かめていない（`tests/smoke/probe/extension.js` か `manual-checks.md`）
- C: 「HTML/CSS/JSON の補完」の JSON の補完が無い（`tests/smoke/probe/extension.js`、`tests/smoke/lib/fixtures.mjs`）
- D: 基準を3回の和にできない（`tests/smoke/lib/run.mjs`）。基準のファイルも作り直しが要る。docs/06 の直しより前の納品なので、曹参の落ち度ではない
- E: 初回の起動は英語のため、手の確認の 2 が正しく見られない（`tests/smoke-launch.mjs`、`manual-checks.md`）

---

## 2. 曹参の単体テストと、公式の zip での実行

### 2.1 単体テスト: 合格

```
node --test tests/smoke.test.mjs
→ tests 46 / pass 46 / fail 0
```

申告の 46 件と合う。テストの中身も確かめた。

- 仕様を緩めていないか: 安全の部品（環境変数、書き込み先、PID の木、置き場所の名前で止めるもの、`.lock` の見分け、`authToken` を出さない）は、通る例と止まる例の両方を持つ。止まるべきときに止まることを確かめている。
- 実装に合わせて書いていないか: probe 拡張の4件は、ソースの文字列を照合する形（id がある、`activate()` を呼ばない、rename を try で囲む）で、動きは確かめていない。拡張ホストの外では動かせないので仕方がないが、1.5 の誤り A はこの形では見つからない。
- 無いもの: `stopTree` と `.lock` を消す流れ（`run.mjs` の中にある）の単体テスト。エディタを起動しないと試せないので、2.2 の実行で確かめた。

### 2.2 公式の zip に向けた1回の実行: 合格（申告と合う）

```
node tests/smoke-run.mjs --label ooka-verify --baseline C:/b/smoke/baseline-official-1.146.0.json
→ PASS 44 / FAIL 0 / SKIP 0 / INFO 8、終了コード 0
```

- 置き場所: `C:\b\smoke\runs\ooka-verify-20261113T125822\`
- 申告（確定の2回で落ちた項目 0。6回目は PASS 44 / INFO 9）と合う。INFO が1つ少ないのは、この回は他人の `.lock` が増えず、`claude.lock-foreign` が出なかったため。
- ラベルを変えたので拡張フォルダが新しく作られ、台帳の8件のインストールから通った（初回の手順も確かめられた）。
- `errors.new` は PASS。renderer の誤り 66 件は、すべて基準の鍵に含まれていた。
- 曹参の各回の結果（`C:\b\smoke\runs\official-*\smoke-result.md`）も、申告の表（39/3、途中で停止、41/2、43/1、43/0、44/0）と合った。申告に無い置き場所 `official-20261113T124359` が1つある。handoff-notes.md の「理由不明で終了コード 2 になった回」に当たるとみられる。
- 記録: `records/phase1/smoke-verify-official-1.146.0.md`

---

## 3. 蒙恬の台本のレビュー

### 3.1 `scripts/check-env.ps1`: 合格

- 読むだけか: 満たす。走らせるのは `git --version`・`git config --global --get core.longpaths`・`node -p`・`nvm`/`fnm`/`volta` の版・`pnpm --version`・`corepack --version`・`npm --version`・`python --version`・`python -c "import setuptools"`・`py -0p`・`vswhere`・`tar --version` と、`Get-CimInstance`・`Get-PSDrive`・`Get-ItemProperty`（読むだけ）。書くのは `-OutFile` を渡したときのその先だけ。
  - 補足: このリポジトリの `package.json` には `packageManager` が無い。そのため、直下で走らせても `pnpm --version` が別の版の pnpm を取りに行くことは無い。
- 版の判定が正しいか: 満たす。`Compare-SemVer` は「メジャーが同じで、求める版以上」。作業ツリーの `build/npm/preinstall.ts` 19〜46 行（Node.js: メジャーが違うか、マイナー・パッチが古ければ止める）と、`build/lib/pnpm.ts` の `checkPackageManager`（pnpm: メジャーが違うか古ければ止める）と同じ規則。既定の値（24.22.1、12.16.0）は、作業ツリーの `.nvmrc`（`24.22.1`）と `package.json` の `"packageManager": "pnpm@12.16.0"` に合う。
- Visual Studio の見方は、`preinstall.ts` の `hasSupportedVisualStudioVersion()` と同じフォルダ（`18`・`2022`・`2019` × 6 つのエディション、Program Files の両方）を見る。
- **軽微な指摘（蒙恬へ。直すことを勧める）**: 環境変数 `vs2026_install` などが**無いパス**を指していても、`preinstallFolders` に入り（`exists = false` のまま）、`preinstallCheckPasses` が真になる（133〜144 行と 174 行）。`preinstall.ts` は `fs.existsSync(vsPath)` が真のときだけ通す。`exists` が真のものだけを数えるよう直す。コンポーネントの検査（vswhere）がこの穴を補うので、判定は不合格にしない。
- 細かい点: `-WorkTree` を渡したのに `.nvmrc` が無いと、既定の値のまま `source` に作業ツリーの名前を書く。

### 3.2 `scripts/prepare.mjs`: 合格

- clone・fetch・worktree の範囲だけか: 満たす。中で走らせる git は `--version`、`clone <url> <clone>`（clone が無いときだけ）、`-C <clone> fetch --tags`、`-C <clone> rev-parse refs/tags/<tag>^{commit}`、`-C <clone> worktree add --detach <wt> refs/tags/<tag>`（作業ツリーが無いときだけ）、`-C <wt> rev-parse HEAD`、`-C <wt> status --porcelain`。ファイルを書くのは、`<buildRoot>\wt` を作ることと、記録の JSON だけ。本家のコードは変えない。
- commit を照合しているか: 満たす。タグの commit と `upstream.json` の `commit` を比べ、違えば止める。作業ツリーの HEAD もタグの commit と比べ、`status --porcelain` が空でなければ止める。既にある作業ツリーも同じに確かめる。
- docs/02 の4節の1（「常設の clone で fetch --tags、worktree add、upstream.json の SHA と一致するか」）と、docs/02 の2節（`C:\b\vscode\` が常設の clone）に合う。
- **軽微な指摘（蒙恬へ）**: `upstream.json` に `commit` が無い（空）と、照合をしないまま `ok` になる（157 行の `if (expected && ...)`）。`commit` が無ければ止めるほうが、docs/02 の「SHA と一致するかを確かめる」に合う。今の `upstream.json` には `commit` があるので、判定は不合格にしない。

### 3.3 `upstream.json`: 合格

`tag` 1.146.0、`commit` `69047191fc427f2f92828279aae1d90d8eeda7ab`、`repository` `https://github.com/microsoft/vscode.git`。brief の基準の版、公式の zip の配置のフォルダ名（`69047191fc`）、`C:\b\vscode\.git\packed-refs` の 6191 行（`69047191fc427f2f92828279aae1d90d8eeda7ab refs/tags/1.146.0`。軽量のタグ）と合う。

### 3.4 `C:\b\wt\1.146.0` の HEAD: 合格

- `C:\b\wt\1.146.0\.git` → `gitdir: C:/b/vscode/.git/worktrees/1.146.0`
- その `HEAD` → `69047191fc427f2f92828279aae1d90d8eeda7ab`（切り離した HEAD。ブランチではない）
- `logs\HEAD` は1行だけ（`0000… → 69047191…`）。worktree add の後に HEAD は動いていない。

### 3.5 `C:\b\wt\1.146.0` に変更が無いこと: 判定できない

- 自分で `git status` を流す形が許可に無い（許可は `git status` だけで、作業場所を `-C` で変える形は無い。Bash の作業場所はこのリポジトリの直下に戻る）。
- 記録の上では変更が無い。`prepare.json` の `status --porcelain` が空（`worktreeClean: true`、21:44）。蒙恬の handoff-notes.md にも `git -C C:/b/wt/1.146.0 status` で「working tree clean」とある。ただし自分では確かめていない。
- 要るもの: `git -C C:/b/wt/* status`（読むだけ）を許可に足すこと。足すならユーザーの承認が要る。

### 3.6 `check-env.ps1` を走らせ、env-check.md と比べる: 判定できない

- 許可にある PowerShell の形は、`-File tests/*.ps1`・`scripts/measure.ps1`・`scripts/netaudit.ps1` の3つだけ。`scripts/check-env.ps1` は無いので走らせなかった。
- 代わりに、蒙恬の出力 `env-check.json`（21:33）と `env-check.md` を突き合わせた。Node.js v24.16.0（要 24.22.1）、pnpm 11.8.0（要 12.16.0）、setuptools なし、Visual Studio のフォルダも vswhere もなし、の4つが足りない。Git 2.54.0、Python 3.14.7、System32 の bsdtar 3.8.9、C: の空き 137.1 GB。両者は合う（`missing` は5行。Visual Studio はフォルダとコンポーネントの2行に分かれる）。
- 今の値（ユーザーが道具を入れている途中の値）は見ていない。
- 要るもの: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1` を許可に足すこと。足すならユーザーの承認が要る。

---

## 4. 曹参が挙げた未決の点への意見

1. **揺れる誤り**: docs/06 の5節で「3回の和」に決まった。台本がまだ対応していないので、1.7 の D のとおり直す。あわせて、1.5 の A を直すと揺れが減る見込みがある（window2 の probe が、ワークスペースの操作とログを余計に増やしているため）。和を取っても、`errors.new` が FAIL したときに「再実行でも出るか」を見る運用は残すとよい。
2. **.env の補完の期待**: 期待する機能が資料に無いので、ユーザーの裁定が要る。それまでの間、`lang.env.dotenv` は「拡張が動作中」だけを見る今の形でよい。手の 8 の合格の目安「何も無ければユーザーが決める」は、合否が決まらない書き方になっている。裁定が出たら、具体的な目安に直す。
3. **`C:\b\smoke\runs\` の容量**: 実行ごとに置き場所が残り、今は 8 個ある（曹参の7個とこの回）。毎週の取り込みと Phase 2 の関門で、少なくとも単位ごと・週ごとに増える。台本に「最新の N 個を残して古いものを消す」形の後始末（消すのは `C:\b\smoke\runs\` の下だけ。基準のファイルと `ext\` は残す）を入れることを勧める。判定に使った置き場所は、`records/` へ結果の `smoke-result.md` を写してから消せばよい。大きさは測っていない（許可の形で測れる道具が無い）。

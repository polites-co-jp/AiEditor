# スモークの記録: A-1 を当てた 1.146.0 の作り直した版（r3、built）

- 実行: 大岡越前守、2026-11-14 21:52（JST）開始
- タスク: `tasks/2026-11-14-verify-commit-fix/`
- 前回（不合格）: `records/phase1/smoke-built-1.146.0-p1-a1.md`（r2。product.json に `commit` が無かった）
- 相手: zip `C:\b\dist\1.146.0-p1-a1-r3.zip`（SHA-256 `e9215f2c2df15a3b4fdd910df1e63437d35b28bf844119c9517d57860daa996c`。検証役が `sha256sum` で計算し直して、蒙恬の記録と一致）を展開したもの `C:\b\p1\1.146.0-p1-a1-r3\Code-OSS-win32-x64-1.146.0-p1-a1-r3\`。`Code - OSS 1.146.0 / cff6809180`、形態 built
  - 展開は蒙恬の `p1-launch-check.ps1`（21:33）が行ったもの。検証役の許可に展開するコマンドが無いため、`C:\b\smoke\` の下に展開し直していない
  - このフォルダのファイルは 2,612 個で、ビルドの記録（`build-record-r3.json` の `disk.package.files`）と同じ。起動の確かめのポータブルのデータは、隣の `C:\b\p1\1.146.0-p1-a1-r3\portable\` にあり、エディタのフォルダの中には無い。スモークは自分の `VSCODE_PORTABLE`・`--user-data-dir`・`--extensions-dir` を渡すので、そのデータは使われない
  - gulp の出力 `C:\b\wt\VSCode-win32-x64\` は使っていない（Phase 2 のビルドが上書きしている途中）
- 基準: `C:\b\smoke\baseline-official-1.146.0.json`（SHA-256 `2e4a7b4b…942b`。前の記録と同じ）
- 置き場所: `C:\b\smoke\runs\p1-a1-r3-20261114T125247\`（`.keep` を置いた）

## 判定

| 見たこと | 結果 |
|---|---|
| 単体テスト `node --test tests/smoke.test.mjs` | 合格（75/75） |
| スモーク | PASS 48 / FAIL 1 / SKIP 0 / INFO 8（終了コード 1） |
| 前回の FAIL 5（base.terminal・base.task・lang.ps1.session・base.ui-language・errors.new） | 4つは PASS になった。errors.new は FAIL のまま（9件から3件に減った） |
| claude-code の組（自動の3項目） | 3項目とも PASS |
| 公式の zip との違いを A-1 と「Code - OSS・上書き無し」で説明できるか | **できる**（残った errors.new の3件。4節） |

**合格。** 残った FAIL は errors.new の1つで、その3件はどれもビルドの形（Code - OSS の product.json）と A-1 の範囲で説明できる。前回の、`commit` が無いことから起きた誤りは無くなった。

## 1. スモークの実行

```
node tests/smoke-run.mjs --build C:/b/p1/1.146.0-p1-a1-r3/Code-OSS-win32-x64-1.146.0-p1-a1-r3 --label p1-a1-r3 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300
```

前回と同じ引数（`--build` と `--label` だけが違う）。拡張のフォルダ `C:\b\smoke\ext\1.146.0-p1-a1-r3\` が新しく作られ、台帳の 8 件が入った。`--keep-runs`（既定 10）では何も消えなかった（実行の後も、`runs\` の直下は前と同じものに今回の1つが足された 12 個。うち `.keep` 付きが3個）。

## 2. 前回の FAIL の行方

| id | 前回（r2） | 今回（r3） |
|---|---|---|
| base.terminal | FAIL（60 秒待ってもファイルができない） | PASS（powershell.exe で実行された） |
| base.task | FAIL（時間切れ 60000 ms） | PASS（終了コード 0） |
| lang.ps1.session | FAIL（PSScriptAnalyzer の診断が出ない） | PASS（1 件） |
| lang.ps1.pwsh7 | INFO（pwsh.exe が木に無い） | PASS（拡張のセッションの pwsh.exe が木にある） |
| base.ui-language | FAIL（`vscode.env.language` = en） | PASS（ja） |
| errors.new | FAIL（9 件） | FAIL（3 件。4節） |

- 見出しの commit は `cff6809180`（前回は `undefined`）。展開した `resources\app\product.json` の 215 行が `"commit": "cff68091803f933ffbd34c93d1a7dc14633f7a72"`
- 止める直前のプロセスの木は 25 個（Code - OSS.exe x21、claude.exe x1、OpenConsole.exe x1、pwsh.exe x1、conhost.exe x1）。前回は無かった OpenConsole.exe と pwsh.exe が出た（ターミナルの子プロセスが起きた）
- 前回の commit 由来の誤り（renderer の `An unknown error occurred...` ×5、exthost の `{"isTrusted":true}`）は、今回の誤りの一覧に無い。prime の起動のログの `ENOENT ... node_modules\@vscode\tree-sitter-wasm\...` も無い（今回のログで ENOENT を含む行は、Claude Code が `~/.claude` の下の無いフォルダを見に行った DEBUG 行だけ）

## 3. claude-code の組

| id | 結果 | 詳細 |
|---|---|---|
| claude.running | PASS | isActive = true（2.1.322） |
| claude.exthost-log | PASS | `_doActivateExtension Anthropic.claude-code`。起動のきっかけは `onView:claudeVSCodeSidebarSecondary`（前回と同じ。公式は `onStartupFinished`） |
| claude.lock | PASS | 3 個: 24391・34172（本番の本体 pid 37128）、44708（prime の本体 pid 78364）。ideName は `Code - OSS`、開いたフォルダは ws、authToken あり。ログの MCP の port 24391 と `.lock` の port が一致。後始末で3個とも消した（自分のものだけ） |

手の項目（パネルからの送信、統合ターミナルの `claude` の接続、選択範囲、差分、診断）は台本の範囲外で、Phase 2 の最後にユーザーが行う。今回は行っていない。パネルからの送信もしていない（Claude Code のログの `launch_claude` は、セカンダリサイドバーにビューが開いたときのセッションの起動で、送信ではない）。

## 4. 残った errors.new の3件の仕分け

| 件数 | 誤り | 仕分け |
|---|---|---|
| 2 | [other] remoteTunnelService.log `Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json` | ビルドの形（Code - OSS の product.json にトンネルの設定が無い）。前回と同じ |
| 1 | [exthost] Claude Code `Remote Control auto-enable failed: Error: Remote Control initialization failed` | A-1 の範囲とビルドの形（推定）。下に根拠 |

Remote Control の誤りの根拠:
- この誤りは、Claude Code のビューが起動時に開き、`claude.exe` が起動したときだけ出る。`C:\b\smoke\runs\` に残る 12 回のうち、`Launching Claude on channel` があるのは A-1 を当てた2回（r2・r3）だけで、`Remote Control auto-enable failed` もその2回だけにある。公式の zip の 10 回では `claude.exe` が起動していない
- ビューが開くきっかけは `onView:claudeVSCodeSidebarSecondary`。A-1 で copilot の拡張（セカンダリサイドバーの既定のチャットのビュー）が無くなったため、Claude Code のビューがセカンダリサイドバーに出ると見られる（推定。確かめていない。前回と同じ見立て）
- 直前に `[bridge:repl] Skipping: bridge not enabled` と `Failed to fetch Grove notice config: essential-traffic-only` が出ている。mydist の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` が効いて、Remote Control を始めなかったと見られる（推定）
- エディタと Claude Code の動作には影響していない（claude-code の組の3項目は PASS）

あわせて見たこと（errors.new には数えられていない）:
- 基準にある `Error: TextModel got disposed before DiffEditorWidget model got reset` と、拡張ホストの `[DEP0169] DeprecationWarning: url.parse()` が出た
- `copilot-runtime.exe`: 止める直前の木には無い（公式は1個）。prime の起動の `agenthost.log` には、`resources\app\node_modules.asar.unpacked\@github\copilot-sdk-win32-x64\prebuilds\win32-x64\copilot-runtime.exe` を使うという行がある。commit が入って本体のエージェントのホストが asar の中の部品を読めるようになったためと見られる。この部品は本体の AI の依存で、C-1 で消す（`removals/A-1-copilot-extension/README.md` の27行、`removals/C-1-ai/README.md` の19行）。A-1 の範囲の外の、公式にもある部品なので、違いとしては数えない
- 公式の renderer の誤り `[AgentHostCustomizationMarketplace] ... (refused: policy-context-unavailable)` ×60 は、今回も出ない（A-1 の範囲と見られる。前回と同じ）

## 5. 言語パック・mydist の既定・Smart App Control

- 言語パック: 入り、prime の後の起動で `vscode.env.language` が ja になった（base.ui-language PASS）
- mydist の既定: `basedpyright.importStrategy` は既定値として `useBundled` が効いた（ユーザー設定 undefined。lang.py.importStrategy PASS）。`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` は、Claude Code のログの `essential-traffic-only` から効いていると見られる
- `extensions.allowed` の効き方: このビルドは product.json の上書きを当てていないので、Phase 2 で見る（前回と同じ）
- Smart App Control: 置き場所のすべての `.log` に、`deviceid`・`keymap`・`elevated` を含む行は無い。エディタは最後まで動いた。Code Integrity のイベントは検証役の許可の外なので見ていない（前回と同じ）

## 6. 実行の後に確かめたこと

- `safety.process-tree`: 木 25 個を止め、残り 0、孤児 0
- `safety.daily-argv`: PASS（`~/.vscode` と `~/.vscode-oss` の argv.json は前後で同じ）
- `base.fixtures-intact`: PASS（変わったのは意図した3ファイルだけ）
- `probe.snapshot`: PASS（拡張 13 件、うち動作中 7。コマンド 3297 件、診断 22 件）
- 気づいた点（合否には使わない）: Claude Code の `claude.exe` は、ws に対して `C:\Users\kou_z\.claude\projects\c--b-smoke-runs-p1-a1-r3-20261114T125247-ws\memory\` を読みに行った（ログの DEBUG 行。無かった）。ユーザーの `~/.claude` の下に、スモークのための項目ができるかもしれない。検証役が読める場所の外なので、できたかは確かめていない。前回の r2 でも同じ形で `claude.exe` が起動している

# スモークの記録: A-1 を当てた 1.146.0 のビルド（built）

- 実行: 大岡越前守、2026-11-14 21:10〜21:16（JST）
- タスク: `tasks/2026-11-14-p1-smoke-built/`
- 相手: `C:\b\wt\VSCode-win32-x64\`（gulp の出力。zip `C:\b\dist\1.146.0-p1-a1-r2.zip` と同じ中身。zip の SHA-256 `9348d66c…32b1` を計算し直して一致）。`Code - OSS 1.146.0`、形態 built
- Smart App Control: オフ（ユーザーが切り、リーダーがレジストリの値 0 を確かめた。検証役は確かめていない）
- 基準: `C:\b\smoke\baseline-official-1.146.0.json`（SHA-256 `2e4a7b4b…942b`。前の記録と同じ）
- 置き場所: `C:\b\smoke\runs\p1-a1-20261114T121032\`（`.keep` を置いた）

## 判定

| 見たこと | 結果 |
|---|---|
| 1. 単体テスト | 合格（75/75） |
| 2〜3. スモーク | PASS 43 / FAIL 5 / SKIP 0 / INFO 9（終了コード 1） |
| claude-code の組（自動の3項目） | 3項目とも PASS |
| 4. 公式の zip との違いを A-1 とビルドの形で説明できるか | **できない**。FAIL 5 のうち4つと新しい誤りの大半は、product.json に `commit` が無いことから起きている。原因はビルドの手順（git の作業ツリーでビルドしたこと）で、A-1 にも「Code - OSS・上書き無し」にも当たらない |

**不合格。** Claude Code の組の自動の項目は通った。しかし、ターミナルが開かない。docs/06 の5節の手の項目「統合ターミナルの `claude` が IDE に接続する」も、このビルドでは確かめられない。

## 1. 単体テスト

```
node --test tests/smoke.test.mjs
```

tests 75 / pass 75 / fail 0（約 1.5 秒）。

## 2. スモークの実行

```
node tests/smoke-run.mjs --build C:/b/wt/VSCode-win32-x64 --label p1-a1 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300
```

- 拡張のフォルダ `C:\b\smoke\ext\1.146.0-p1-a1\` を新しく作り、台帳の 8 件を入れた（anthropic.claude-code 2.1.322 ほか）
- 「言語パックが登録された。起動し直す。」の後に本番の起動をした
- `--keep-runs`（既定 10）で、`runs\` の直下の `official-20261113T141132` が消えた。前の記録（`smoke-verify2-official-1.146.0.md`）が指す `official-20261113T141800` は残っている

### FAIL の5項目

| id | 詳細 | 原因（根拠は3節） |
|---|---|---|
| base.terminal | 60 秒待ってもファイルができない | xterm の読み込みの失敗（`commit` が無い） |
| base.task | 時間切れ（60000 ms）: task end | 同じ（タスクはターミナルで動く） |
| lang.ps1.session | source=PSScriptAnalyzer の診断が出ない | 同じ（PowerShell の拡張は、セッションをターミナルで起動する） |
| base.ui-language | vscode.env.language = en（languagepacks.json はできた） | 言語パックが使われない（`commit` が無い） |
| errors.new | 9 件 | 下の表 |

あわせて INFO `lang.ps1.pwsh7`: pwsh.exe が木に無い（PowerShell のセッションが立ち上がらなかったため）。

### claude-code の組

| id | 結果 | 詳細 |
|---|---|---|
| claude.running | PASS | isActive = true（2.1.322） |
| claude.exthost-log | PASS | `_doActivateExtension Anthropic.claude-code`。起動のきっかけは `onView:claudeVSCodeSidebarSecondary`（公式は `onStartupFinished`） |
| claude.lock | PASS | 3 個: 15511・22190（本番の本体 pid 80152）、34262（prime の本体 pid 51708）。ideName は `Code - OSS`、開いたフォルダは ws、authToken あり。ログの MCP の port 22190 と `.lock` の port が一致。後始末で3個とも消した（自分のものだけ） |

手の項目（パネルでの送信、統合ターミナルの `claude` の接続、選択範囲、差分、診断）は台本の範囲外なので、行っていない。パネルからの送信はしていない。

### errors.new の 9 件（公式の基準に無い誤り）

| 件数 | 誤り | 説明 |
|---|---|---|
| 5 | [renderer] `An unknown error occurred. Please consult the log for more details.` | `commit` が無いため、node_modules のスクリプトを無いパスから読もうとして失敗した（3節）。4件の時刻が、ターミナルを作った時刻と重なる |
| 1 | [exthost] `{"isTrusted":true}`（21:11:03.344） | 同じ失敗。スクリプトの読み込みの失敗は DOM の Event で返る。PowerShell の拡張がセッションを起動した直後（02.424）に、renderer の誤り（03.342）と続けて出た |
| 2 | [other] remoteTunnelService.log `Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json` | ビルドの形の違い（Code - OSS の product.json にトンネルの設定が無い）。説明できる |
| 1 | [exthost] Claude Code `Remote Control auto-enable failed: Error: Remote Control initialization failed` | ビルドの形の違いと見られる（推定）。このビルドは起動時に Claude Code のビューがセカンダリサイドバーに開き、`claude.exe` が起動した（公式は起動しない。公式の Claude のログは3行だけ）。直前に `[bridge:repl] Skipping: bridge not enabled`、`Failed to fetch Grove notice config: essential-traffic-only` が出ている。mydist の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` が効いて、Remote Control を始めなかったと見られる。ビューが開くのは、A-1 で copilot のチャットのビューが無くなったためと見られる（推定。確かめていない） |

基準にある `Error: TextModel got disposed before DiffEditorWidget model got reset` も出たが、新しい誤りには数えられていない。

## 3. `commit` が無いことの根拠

- 出力の `resources\app\product.json` に `commit` が無い（`date` は 2026-11-14T20:10:27+09:00 がある）。スモークの見出しも `Code - OSS 1.146.0 / undefined`
- 本家のビルドは commit を `build/lib/getVersion.ts` で決める。`BUILD_SOURCEVERSION` が40桁の16進でなければ、`build/lib/git.ts` の `getVersion(root)` が `<root>\.git\HEAD` を読む
- 作業ツリー `C:\b\wt\p1-a1\` の `.git` はファイル（中身 `gitdir: C:/b/vscode/.git/worktrees/p1-a1`）。そのため `.git\HEAD` は読めず、`getVersion` は undefined を返す。`gulpfile.vscode.ts` の202行は `json.commit = commit` で、undefined のまま product.json に入らない
- `src/vs/amdX.ts` の `importAMDNodeModule` は `isBuilt = Boolean(product.commit)` で決める。false なら `node_modules.asar` ではなく `node_modules` から読む。出力には `resources\app\node_modules.asar` だけがあり、`node_modules\` は無い。読み込みが失敗すると、DOM の Event をそのまま reject する（161〜164行）
- ターミナルは `terminalInstance.ts` の812行で、xterm を `importAMDNodeModule('@xterm/xterm', 'lib/xterm.js')` で読む。読めなければターミナルが作れない。タスクと PowerShell の拡張のセッションはターミナルを使う
- prime の起動のログにも同じ形の誤りがある: `ENOENT ... resources\app\node_modules\@vscode\tree-sitter-wasm\wasm\tree-sitter.wasm`（asar ではないパスを読んでいる）
- `src/vs/base/node/nls.ts` の50〜57行は、`!commit` なら言語パックを使わない（既定の英語にする）。base.ui-language の FAIL はこれで説明できる
- 止める直前のプロセスの木: 公式は 27 個（OpenConsole.exe と pwsh.exe を含む）、今回は 23 個（Code - OSS.exe x21、claude.exe x1、conhost.exe x1）。OpenConsole.exe も pwsh.exe も無い。ターミナルの子プロセスが一度も起動していない

## 4. 公式の zip との違いの仕分け

| 違い | 仕分け |
|---|---|
| ターミナル・タスク・PowerShell のセッション・日本語の表示の FAIL、新しい誤り 6 件（renderer の5件と exthost の `isTrusted`） | **説明できない**（ビルドの手順の欠陥: `commit` が無い） |
| トンネルの誤り 2 件 | ビルドの形（Code - OSS の product.json） |
| Remote Control の誤り 1 件、Claude Code が `onView:claudeVSCodeSidebarSecondary` で起動する | ビルドの形・mydist・A-1 の組み合わせと見られる（推定） |
| 木に `copilot-runtime.exe` が無い（公式は1個） | A-1 の範囲 |
| 公式の renderer の誤り `[AgentHostCustomizationMarketplace] ... (refused: policy-context-unavailable)` ×60 が出ない | A-1 の範囲と見られる（copilot の SDK まわり。推定） |
| prime の起動で `CodeExpectedError: No default agent contributed`（数える対象の外） | A-1 の範囲（既定のチャットのエージェントが無い） |
| 公式の exthost の誤り `No bundle location found for extension TypeScriptTeam.jsts-chat-features` ×2 が出ない | ビルドの形（OSS の product.json には、その組み込み拡張の記載が無い） |
| `lang.env.dotenv` の拡張が `dotenv.dotenv-vscode` から `weixu.wx-vsce-dotenv` に変わった | 台帳の変更（ビルドとは関係ない） |
| `lang.py.importStrategy` の既定が `useBundled`（ユーザー設定は無い） | mydist の既定が効いた（期待どおり） |

## 5. Smart App Control の件・言語パック・mydist の既定

- `@vscode/deviceid`・`native-keymap`・`native-is-elevated`: 実行の置き場所のすべての `.log`（prime の起動を含む）に、`deviceid`・`keymap`・`elevated` を含む行は無い。エディタは最後まで動いた。ただし、Smart App Control がオンだったときも止められたことはログには出ず、Code Integrity のイベントにだけ出ていた。イベントは検証役の許可（`scripts/p1-ci-events.ps1` を走らせること）の外にあるので、見ていない。「消えた」と言える根拠はログの範囲だけ
- 言語パック: 入り、`languagepacks.json` もできた。しかし `commit` が無いので使われず、表示は英語のまま（base.ui-language が FAIL）
- mydist の既定: `basedpyright.importStrategy` は既定値として `useBundled` が効いた（ユーザー設定 undefined）。`claudeCode.environmentVariables` の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` は、Claude Code のログの `essential-traffic-only` から効いていると見られる。テーマ・キー割り当て・`chat.disableAIFeatures` などは、台本では見ていない
- `extensions.allowed` の効き方: このビルドは product.json の上書きを当てていないので、Phase 2 に回す（依頼書の5）

## 6. 実行の後に確かめたこと

- `safety.process-tree`: 木 23 個を止め、残り 0、孤児 0
- `safety.daily-argv`: PASS（`~/.vscode` と `~/.vscode-oss` の argv.json は前後で同じ）
- `base.fixtures-intact`: PASS（変わったのは意図した3ファイルだけ）
- `probe.snapshot`: PASS（拡張 13 件、うち動作中 6。コマンド 3299 件、診断 21 件。`commands.json` ができた。前の記録の「最後の一覧が毎回失敗する」は直っている）
- ユーザー設定（`user\user-data\User\settings.json`）は、信頼・自動更新・テレメトリの4つだけで、`basedpyright.importStrategy` は入っていない（built の形どおり）

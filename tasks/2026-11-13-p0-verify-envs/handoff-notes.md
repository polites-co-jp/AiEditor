# 引き継ぎ（大岡越前守 → ヴラド・ツェペシュ）: Phase 0 の検証（試験環境・mydist・キー）

SubagentHandback がフックで止められたため、この文書を報告とする。詳しくは `verification-log.md`。

## 判定: 不合格（項目2、7、8）。1・3〜6 は合格

10の環境、試験台、0-8、mydist、0-10 の中身はどれも正しいので、環境は作り直さなくてよい。直すのは蒙恬の文書3本と `p0-launch.ps1` の数行。

| # | 項目 | 判定 |
|---|---|---|
| 1 | 台本のレビュー（普段使いのデータ、VSCODE_PORTABLE、書き込み先） | 合格（注意1件、L1） |
| 2 | 環境の中身、試験台、doc-corrections の3 | 環境と試験台は合格。doc-corrections の3に誤りが1行あるため不合格 |
| 3 | 0-8 の自動の部分 | 合格 |
| 4 | 0-9 の mydist | 合格 |
| 5 | 0-10 | 合格。`records/phase0/sublime-keys.md` を書いた |
| 6 | 計測用のワークスペース | 合格（確かめきれない点1つ） |
| 7 | ユーザーが手で確かめる手順 | 不合格 |
| 8 | 子のプロセスに渡る変数（追加の項目） | `p0-launch.ps1` が不合格。`p0-env.ps1`・`p0-ext-allowed.ps1` は問題なし |

## 確かめた成果

- 蒙恬: 試験環境の台本6本、10の環境、試験台、0-8 の結果、`extensions-src/mydist/`、0-10 の変換、`tmp\ws` の tasks.json、下書きの .md 一式
- 曹参: `tests/sublime-keys.test.mjs`

## 根拠

- **流したコマンド**
  - `node tests/sublime-keys.test.mjs`: 27件すべて通過。
  - `sha256sum`: Sublime の VSIX は Open VSX の `.sha256` と一致、Claude Code の VSIX は台帳と一致。
  - `git status` / `git diff`: 各担当の書き込み先の外は変わっていない。
- **環境**: 10の環境すべての p0-env.json・argv.json・settings.json・ext\extensions.json が env-setup.md の4節と一致した。導入は全部終了コード 0、VSIX の SHA-256 は台帳の9件と全部一致。
- **試験台**: VSCodium の 95 フォルダから A-2〜A-7 の 29 を消して 66 が残り、実物の数とも合う。消し過ぎも消し残しも無い。A-1 の copilot は VSCodium に無いので飛ばしている。
- **0-8**: 許可していない VSIX は CLI でも入らない（終了コード 1、`not in the allowed list`）。許可した Claude Code は入り、同じ pdf の VSIX は設定の無い環境なら入る。結論「CLI にも効く」を支える。
- **0-9**: `main` なし、5項目の値は docs/04 の6.1 と5節のとおり。テーマの ID が `Light Modern` であることを 1.146.0 の実物で確かめた。
- **0-10**: 元の 71 項目と mydist の 69 項目を順に突き合わせて一致した。Claude Code の9件との衝突は0件で、0-1 の manifest の記録とも合う。
- **ワークスペース**: commit `2385a2ff…`（.git の refs で確認）、tasks.json は `runOn: folderOpen` でターミナルを開く形、選んだ2つのファイルは実在する。
- **8の根拠**
  - `p0-launch.ps1` は環境を全部引き継いだまま `Start-Process` で起動する。親に `ELECTRON_RUN_AS_NODE=1` があると終了コード 9 で終わり、それでも「started pid …」と表示されるので失敗に気づけない。
  - CLI の側（`code.cmd`）はこの変数を自分で 1 にしており、もともと必要な変数。実際に、エージェントから走らせた導入と 0-8 は全部成功している。
  - 影響の出る場面:
    - ユーザーが自分で開いた Windows Terminal や PowerShell: ふつう変数が無いので、影響は小さい。
    - 普段使いの VS Code の統合ターミナル: 本家が `ELECTRON_*`・`VSCODE_*` を外すと記憶しており、影響は小さい見込み（推定、未確認）。
    - Claude Code やエージェントから走らせた場合: 起動できない。

## 不合格の点（直す担当つき）

- **F1 蒙恬（必須）** env-setup.md の5節: 手の確かめで `tmp\ws` を汚さない手順が無い。docs/06 の base の項目どおり編集・保存・コミットをすると計測の前提が崩れるので、それをどこで行うか、終わった後の戻し方、`p0-ws.ps1` を走らせ直して commit と `dirtyExceptTasks` を確かめる手順を足す。
- **F2 蒙恬（必須）** configuration-defaults.md の3節の手順5: 例の Ctrl+D と Ctrl+Shift+K は本家の既定と同じで、証拠にならない。同じ環境に sublime-keybindings 拡張も入っている。キーボードショートカットの画面でソースが mydist であることを見る手順にし、本家と違うキー（Ctrl+M、Ctrl+J、Ctrl+R、Ctrl+Shift+D）を例にする。
- **F3 蒙恬** env-setup.md の5節: 実行する場所（リポジトリの直下）、0-2・0-3・0-7 の見る場所と記録すること、ログの場所（`<data>\user\user-data\logs\`）、0-3 の前提（PowerShell 7・ShellCheck・Python）、信頼の確認、自分の端末から起動することを書く。
- **F4 蒙恬** extensions-allowed.md の3節の手順5: CSV ファイルの置き場所を `tmp\ws` の外にすると書く。
- **F5 蒙恬** doc-corrections.md の3: `media-preview` は本家 1.146.0 の zip に無く、VSCodium 1.143.17232 にだけある。行を直す。
- **F6 蒙恬（軽微）** `p0-ws.ps1` の `source` が固定の文字列で、実際の clone の出どころ（GitHub）と違う。
- **F7 蒙恬（軽微）** sublime-keys.md の5節の見出しの誤り（清書では直した）。
- **F8 蒙恬** `p0-launch.ps1`: 起動の前に `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を子から外し、`VSCODE_PORTABLE` だけを設定する（`measure.ps1` の `Start-EditorProcess` と同じ形）。起動後にプロセスが生きているかも確かめる。
- **F9 蒙恬（任意）** `Invoke-P0Cli` でも `VSCODE_*` を外すと `measure.ps1` とそろう。今の結果は正しいので必須ではない。
- **T1 曹参** 知らない修飾キー（`ctr+shift+[`）の項目を落とす規則のテストが無いので足す。

## リーダーへ

- **L1（推定、未確認）**: 本家の zip を起動すると、`vscode://` のプロトコルの登録が試験の側に移るおそれがある。本家のソースについての私の記憶によるもの。ユーザーに伝え、終わった後に普段使いの VS Code を起動し直してもらうとよい。
- **L2**: `tmp\ws` は `E:\develop\kuebiko` ではなく GitHub から clone されている（`.git/logs/HEAD` で確認）。commit は固定されているので計測には差し支えないが、記録に事実を書くか、ユーザーに確かめる。
- **L3**: doc-corrections の1・2・4・5・6・7 は、確かめた範囲で正しい。3は F5 の後に反映する。
- **L4**: F8 を直すまでは `p0-launch.ps1` をエージェントから走らせない。
- **確かめきれなかったこと**（権限が無い）: `p0-check-ps.ps1`、`git -C tmp/ws status`、`%USERPROFILE%\.vscode` とレジストリの読み取り。ワークスペースの変更が tasks.json だけであることは、蒙恬の台本の出力に頼っている。

## 記録

- `E:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-verify-envs\verification-log.md`
- `E:\develop\self\Team\projects\ai-editor\records\phase0\sublime-keys.md`
- `E:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-verify-envs\handoff-notes.md`（この文書）

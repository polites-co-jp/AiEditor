# 0-8 `extensions.allowed` の効き方（下書き）

- 作成: 蒙恬（2026-11-13）
- 清書の先: `records/phase0/extensions-allowed.md`（大岡越前守）。(b) はユーザーが手で行う（3節）
- 台本: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ext-allowed.ps1`（環境 `ext-allowed` を作り直してから、CLI で試す）
- 生の記録: `C:\b\p0\logs\ext-allowed-20261113-052950\`（`result.json`、手順ごとの `.txt`、`settings.json`、`extensions.json`）

## 1. 条件

| 項目 | 値 |
|---|---|
| 本体 | 本家 VS Code 1.146.0（zip、`C:\b\p0\vscode-1.146.0\`、commit `69047191fc427f2f92828279aae1d90d8eeda7ab`） |
| CLI | `bin\code.cmd --user-data-dir C:\b\p0\data\ext-allowed\user\user-data --extensions-dir C:\b\p0\data\ext-allowed\ext ...`（`VSCODE_PORTABLE=C:\b\p0\data\ext-allowed\user`） |
| ユーザー設定 | `{"extensions.allowed": {"*": false, "anthropic.claude-code": true}}` |
| 先に入れた拡張 | `anthropic.claude-code` 2.1.322 と `mechatroner.rainbow-csv` 3.24.1。どちらも、設定を書く**前**に CLI で入れた（(c) のため） |
| 許可していない VSIX | `tomoki1207.pdf` 1.2.2、`ms-vscode.sublime-keybindings` 4.1.10 |

## 2. 自動で確かめた結果（2026-11-13 05:29 JST）

### (a) 許可していない VSIX を CLI の `--install-extension` で入れる

**入らない。** 終了コード 1。出力:

```
Installing extensions...
Error: This extension cannot be installed because it is not in the [allowed list](command:workbench.action.openSettings?...)
    at Io.install (file:///C:/b/p0/vscode-1.146.0/69047191fc/resources/app/out/vs/code/node/cliProcessMain.js:61:79061)
```

- `tomoki1207.pdf` と `ms-vscode.sublime-keybindings` の両方で同じ。`--force` を付けても止まる。
- 試した後、拡張の一覧（`--list-extensions --show-versions`）にも、拡張のフォルダ（`ext\`）にも、`ext\extensions.json` にも現れない。
- 対照: 許可した `anthropic.claude-code` の VSIX を同じ CLI で入れ直すと、終了コード 0 で入る。
- つまり 1.146.0 では、`extensions.allowed` は CLI の `--install-extension`（VSIX のファイル）にも効く。docs/04 の5節の「CLI の `--install-extension` に効くかは未確認」は、**効く**と分かった。判定はパッケージの中の ID で行われている（ファイル名ではない。公式文書の記述どおり）。
- 副次の事実: CLI はユーザー設定を `--user-data-dir` の下ではなく `<VSCODE_PORTABLE>\user-data\User\settings.json` から読んだ（その場所に書いた設定が効いた）。`doc-corrections.md` の1節。

### (c) すでに入っている許可外の拡張

**CLI の一覧には出たまま。** 設定を書いた後の `--list-extensions --show-versions`:

```
anthropic.claude-code@2.1.322
mechatroner.rainbow-csv@3.24.1
```

- 拡張のフォルダと `extensions.json` にも残る（消されない）。
- CLI の一覧には、有効か無効かは出ない。画面で無効（「許可の一覧に無い」）になるかは、公式文書の「許可されなくなった拡張は無効になる」[一次] https://code.visualstudio.com/docs/enterprise/extensions と、本家のソース（`extensionEnablementService.ts` の `_computeEnablementState` が User の拡張に `DisabledByAllowlist` を付ける）から見込まれるが、**画面で確かめるまでは未確認**（3節の手順 5）。

## 3. ユーザーが手で確かめる手順

(b) 画面の「VSIX からインストール」と、(c) の画面での状態。起動のしかた・ログの場所・ワークスペースを汚さない注意は `env-setup.md` の5.1。この環境は言語パックを入れていないので、表示は英語。

1. **環境を作り直す**（2節の CLI の試しで状態が変わっていないが、念のため）
   - すること: リポジトリの直下で、自分の端末から `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name ext-allowed`。続けて `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1`（CSV の見本を作る）
   - 見る場所: 端末の `installed:` の行
   - 記録すること: `anthropic.claude-code@2.1.322, mechatroner.rainbow-csv@3.24.1` であること
2. **起動する**
   - すること: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name ext-allowed -NoWorkspace`（この項目ではワークスペースは要らない）
   - 見る場所: 端末の `OK: pid ... is alive`
   - 記録すること: pid。`FAILED` なら、その行と `C:\b\p0\data\ext-allowed\user\user-data\logs\` の一番新しいフォルダの `main.log` の `[error]` の行
3. **(b) 許可していない VSIX を画面から入れる（1つめ）**
   - すること: 拡張のビュー（Ctrl+Shift+X）の右上の「…」→ `Install from VSIX...` で `C:\b\p0\vsix\tomoki1207.pdf-1.2.2\tomoki1207.pdf-1.2.2.vsix` を選ぶ
   - 見る場所: 右下の通知、拡張のビューの `INSTALLED` の一覧
   - 記録すること: 通知の文言をそのまま。一覧に `vscode-pdf` が増えたか
4. **(b) 許可していない VSIX を画面から入れる（2つめ）**
   - すること: 同じく `C:\b\p0\sublime\ms-vscode.sublime-keybindings-4.1.10.vsix`
   - 見る場所と記録すること: 3と同じ（一覧の名前は `Sublime Text Keymap and Settings Importer`）
5. **(c) すでに入っている許可外の拡張**
   - すること: 拡張のビューで `Rainbow CSV`（設定より前に入れたもの）を選ぶ。続けて `File > Open File...` で `C:\b\p0\scratch\sample.csv` を開く。CSV は計測用のワークスペース（`tmp\ws`）の中に作らない（計測の前提「同じコミット、tasks.json だけを足した状態」が崩れるため）
   - 見る場所: 拡張のビューの Rainbow CSV の表示（無効か、`not in the allowed list` などの文言）。CSV の列の色分けと、ステータスバーの Rainbow CSV の表示
   - 記録すること: 表示の文言。無効か有効か。列に色が付いたか
6. **許可した拡張**
   - すること: アクティビティバーの Claude Code のアイコンからパネルを開く
   - 見る場所: 拡張のビューの Claude Code の表示と、パネル
   - 記録すること: 有効のままか。パネルが開いたか
7. **（余裕があれば）設定を外したとき**
   - すること: 設定の画面（Ctrl+,）で `extensions.allowed` を探し、`Edit in settings.json` から項目を消して保存する
   - 見る場所: 拡張のビューの Rainbow CSV
   - 記録すること: すぐ有効に戻ったか、再読み込み（`Developer: Reload Window`）が要ったか
8. **終える**
   - すること: 窓を閉じる。7 を行ったときは、手順1で環境を作り直す
   - 記録すること: 無し

## 4. docs への反映の案

- docs/04 の5節: 「CLI の `--install-extension` に効くか…は未確認」→「1.146.0 で、許可していない VSIX は CLI の `--install-extension` でも入らない（終了コード 1、`not in the allowed list`）。すでに入っている許可外の拡張は消されず、CLI の一覧に残る（画面での無効化は (b)(c) の手での確かめの結果を書く）」。
- 組み込み拡張が対象外かは、ソースでは対象外（判定は `ExtensionType.User` だけ）。0-9 の `mydist` の結果と合わせて書く。

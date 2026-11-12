# 0-9 組み込み拡張の `configurationDefaults` で既定にできる設定（下書き）

- 作成: 蒙恬（2026-11-13）
- 清書の先: `records/phase0/configuration-defaults.md`（大岡越前守）。設定の画面での確かめはユーザーが行う（下の3節）

## 1. 試作の中身

`extensions-src/mydist/package.json`（`main` なし。宣言だけ）。`publisher` は仮の `shuko`（docs/04 の6.3）、`engines.vscode` は `^1.146.0`。

| 設定 | 試作の値 | 本家 1.146.0 の既定（参考） | 根拠 |
|---|---|---|---|
| `chat.disableAIFeatures` | `true` | `false` | docs/04 の6.1 |
| `telemetry.telemetryLevel` | `"off"` | `"all"` | docs/04 の6.1 |
| `workbench.colorTheme` | `"Light Modern"` | 明るい OS では `"Light 2026"`、暗い OS では `"Dark 2026"` | docs/04 の6.1 は `Default Light Modern` の見込みとしていたが、1.146.0 の `extensions/theme-defaults/package.json` の `id` は `"Light Modern"`（下の2節） |
| `extensions.allowed` | `{"*": false}` と台帳の9件を `true`（.env は2つとも。0-3 で1つに決まったら片方を消す） | なし（全部許可） | docs/04 の5節・6.1 |
| `breadcrumbs.enabled` | `false` | `true` | docs/04 の6.1 |

`extensions.allowed` の ID は小文字で書いた。本家の判定は ID と設定のキーをどちらも小文字にして比べる（[一次] `src/vs/platform/extensionManagement/common/allowedExtensionsService.ts`、1.146.0）。

同じ package.json に、0-10 の Sublime のキーの変換の結果（`contributes.keybindings` 69 項目）も入っている（`sublime-keys.md`）。設定の既定には関わらない。

## 2. 確かめた事実（ソースと 1.146.0 の zip）

- テーマの ID: 1.146.0 の zip の `69047191fc\resources\app\extensions\theme-defaults\package.json` に `{"id":"Light Modern","label":"%lightModernThemeLabel%","uiTheme":"vs","path":"./themes/light_modern.json"}`。本家の既定のテーマは `Light 2026` / `Dark 2026`（`workbench.desktop.main.js` の `COLOR_THEME_LIGHT="Light 2026"`、`COLOR_THEME_DARK="Dark 2026"`）。
- `extensions.allowed` の効き方（ソースを読んだ範囲。動きは画面で確かめる）:
  - 有効・無効の判定で許可の一覧を見るのは `extension.type === ExtensionType.User` のときだけ（`src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` の `_computeEnablementState`、1.146.0）。組み込み拡張（System）は対象外。Phase 2 で `mydist` を組み込み拡張として同梱すれば、`mydist` 自身は止まらない。
  - `--extensionDevelopmentPath` で読み込んだ拡張が許可の一覧で止まるかは、ソースから断定できなかった（開発中の拡張は止めない処理がある見込み。推定）。`mydist` の ID `shuko.mydist` は一覧に入れていないので、もし止まると、自分の既定で自分が止まる形になる。そのときは3節の手順4の結果に書く。
  - 公式文書: 「既定ではすべての拡張が許可される」「すでに入っている拡張が許可されなくなると無効になる」「VSIX はパッケージ内の ID で判定する」「範囲指定とワイルドカード（`*` を除く）は不可」[一次] https://code.visualstudio.com/docs/enterprise/extensions 。組み込み拡張と CLI への効き方は文書に書かれていない。
- `chat.disableAIFeatures`・`extensions.allowed`・`telemetry.telemetryLevel`・`breadcrumbs.enabled` の名前は、1.146.0 の `workbench.desktop.main.js` に現れる（名前の有無だけを見た）。

## 3. ユーザーが設定の画面で確かめる手順

環境 `mydist` を使う。中身: 本家 1.146.0、ユーザー設定は空、`--extensionDevelopmentPath=<リポジトリ>\extensions-src\mydist`。拡張は Claude Code と、台帳に無い `ms-vscode.sublime-keybindings` 4.1.10（`extensions.allowed` の既定が効くかを見るため）。

**この環境には、mydist と同じキーを出す `ms-vscode.sublime-keybindings` 拡張も入っている。** キーが効いたことだけでは、どちらが出したキーか分からない。手順5のとおり、キーボードショートカットの画面の「ソース」で区別する。

起動のしかた・ログの場所・ワークスペースを汚さない注意は `env-setup.md` の5節。この環境は言語パックを入れていないので、表示は英語。

1. **環境を作り直す**
   - すること: リポジトリの直下（`E:\develop\self\Team\projects\ai-editor`）で、自分の端末（Windows Terminal などのふつうの PowerShell）から `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name mydist`
   - 見る場所: 端末の出力
   - 記録すること: 最後の `installed:` の行（`anthropic.claude-code@2.1.322, ms-vscode.sublime-keybindings@4.1.10` のはず）
2. **起動する**
   - すること: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name mydist`
   - 見る場所: 端末の `OK: pid ... is alive` の行と、エディタの窓のタイトル（`[Extension Development Host]` が付く）
   - 記録すること: pid、タイトル。`FAILED` と出たら、その行と `C:\b\p0\data\mydist\user\user-data\logs\` の一番新しいフォルダの `main.log` の `[error]` の行
3. **5つの設定の既定値**
   - すること: 設定の画面（Ctrl+,）で次の5つを1つずつ検索する。続けて、コマンドパレット（Ctrl+Shift+P）の `Preferences: Open Default Settings (JSON)` で同じ名前を検索する
     - `chat.disableAIFeatures`（期待: 既定が true。チャットのパネルやアカウントの AI の項目が隠れる）
     - `telemetry.telemetryLevel`（期待: 既定が off）
     - `workbench.colorTheme`（期待: Light Modern で表示される）
     - `extensions.allowed`（期待: 既定が試作の値。application の範囲の設定なので、拡張の既定が効かない可能性がある）
     - `breadcrumbs.enabled`（期待: エディタの上のパンくずリストが出ない）
   - 見る場所: 設定の画面の値と、左端の「Modified」の印の有無。既定の設定の JSON の値
   - 記録すること: 設定ごとに「画面の値」「Modified の印の有無」「既定の JSON の値」「期待どおりか」の4つ
4. **拡張の状態**
   - すること: 拡張のビュー（Ctrl+Shift+X）を開く。続けて、コマンドパレットの `Developer: Show Running Extensions` を開く
   - 見る場所: 拡張のビューの `Sublime Text Keymap and Settings Importer` と `Claude Code` の表示。動作中の拡張の一覧
   - 記録すること:
     - Sublime Text Keymap and Settings Importer: 無効か。表示の文言（例 `not in the allowed list`）。`extensions.allowed` の既定が効いたことの証拠になる
     - Claude Code: 有効のままか
     - 動作中の拡張の一覧に `shuko.mydist`（表示名 `Shuko defaults`）があるか。無ければ、開発中の拡張が自分の `extensions.allowed` の既定で止まった可能性がある（2節）
5. **Sublime のキーが mydist から来ているか**
   - すること: キーボードショートカットの画面（Ctrl+K Ctrl+S）の検索欄に、次のコマンドの ID を1つずつ入れる。本家の Windows の既定と**違う**キーなので、mydist が効いていれば割り当てが本家と変わる
     | キー | mydist（Sublime）のコマンド | 本家の既定でのこのキー |
     |---|---|---|
     | Ctrl+M | `editor.action.jumpToBracket` | タブでフォーカスを移すかの切り替え |
     | Ctrl+J | `editor.action.joinLines` | パネルの表示の切り替え |
     | Ctrl+R | `workbench.action.gotoSymbol` | 最近開いたもの |
     | Ctrl+Shift+D | `editor.action.copyLinesDownAction` | 実行とデバッグのビュー |
   - 見る場所: 該当の行の「Keybinding」と「Source」の列。Source は `Extension` と表示され、行にマウスを載せるか右クリックの `Show Same Keybindings` で拡張の名前が分かる。mydist は `Shuko defaults`（`shuko.mydist`）、もう一方は `Sublime Text Keymap and Settings Importer`（`ms-vscode.sublime-keybindings`）
   - 記録すること: 4つのキーごとに、出ている行の数と、それぞれのソースの拡張の名前。区別のしかたは次のとおり
     - mydist の行だけがある: 手順4で Sublime の拡張が無効になっている。mydist のキーが効いている
     - mydist と Sublime の拡張の両方の行がある: mydist のキーは読まれているが、`extensions.allowed` の既定は効いていない（手順4の結果と合うはず）。どちらの行が上に出ているかも記録する
     - Sublime の拡張の行だけがある: mydist のキーが読まれていない
   - 確かめ（任意）: 実際に試すなら、`C:\b\p0\scratch\sample.ts`（`scripts/p0-scratch.ps1` が作る使い捨てのフォルダ）を開き、`Ctrl+J` で2行が1行につながるか、`Ctrl+Shift+D` で行が下に複製されるかを見る。試した後は保存しない（保存したら `scripts/p0-scratch.ps1` で作り直す）。`tmp\ws` のファイルでは試さない
6. **まとめ**
   - すること: 1〜5 の記録を表にする
   - 記録すること: 設定ごとに「既定値が変わった / 変わらない」。変わらなかったものは、画面の表示と、Help → Toggle Developer Tools のコンソールのエラーを写す。できないものは docs/04 の6.1 の注記どおり、product.json の上書きか小さなパッチで既定を変える案に回す
7. **終える**
   - すること: エディタの窓を閉じる（閉じられないときは `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-stop.ps1 -Name mydist`）

## 4. 環境の中身

`env-setup.md` の `mydist` の行。ユーザー設定は空（`{}`）、`argv.json` は設定を持たない（コメントの行だけ。`doc-corrections.md` の7節）。

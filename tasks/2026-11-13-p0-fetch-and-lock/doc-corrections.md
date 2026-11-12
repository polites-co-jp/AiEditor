# docs と食い違った事実と、直し方の案

- 作成: 蒙恬（2026-11-13）。docs の書き換えはリーダーが行う。
- 根拠の詳しいところは fetch-log.md・claude-code-manifest.md・lock-verification.md。

## 1. 推定・未確認だった点で、確かめられたもの（「推定」「未確認」を外す）

| 場所 | 今の記述 | 確かめた事実 | 直し方の案 |
|---|---|---|---|
| docs/07 の2.1 の表 | 版を指定する URL は `https://update.code.visualstudio.com/<版>/win32-x64-archive/stable` の見込み（推定） | 正しい。1.146.0 は 302 で `https://vscode.download.prss.microsoft.com/dbazure/download/stable/69047191fc427f2f92828279aae1d90d8eeda7ab/VSCode-win32-x64-1.146.0.zip` へ転送される。SHA-256 は `https://update.code.visualstudio.com/api/versions/<版>/win32-x64-archive/stable` の `sha256hash` で照らせる | 「（推定）」を外し、SHA-256 の照合先として版の API を書き足す |
| docs/04 の4節の2 | `-m` に何を渡すか、`.sigzip` の仕様は未確認 | `.sigzip` は `.signature.sig`・`.signature.manifest`・`.signature.p7s` を持つ zip。`-m` は `.signature.manifest`、`-s` は `.signature.sig`（ovsx 1.4.0 のヘルプとソースのコメント）。署名は VSIX 全体に対する Ed25519。manifest は署名の対象外で、中身の照合用 | コマンドを `ovsx verify-signature -i <vsix> -m <.sigzip の .signature.manifest> -s <.sigzip の .signature.sig> -k <公開鍵>` と書き、未確認の文を消す |
| docs/sources/research-extensions-services.md の1-4 | 公開鍵は Ed25519 と推定 | Ed25519（Node.js の `createPublicKey` で確認。署名も Ed25519 で検証できた） | 「推定」を外す（sources は写しなので、直すかはリーダーの判断） |
| docs/04 の4節の3 | 同梱の CLI のファイルの場所と、manifest の platform の名前（win32-x64 か）は未確認 | 場所は VSIX の `extension/resources/native-binary/claude.exe`。platform の名前は `win32-x64` | 場所と名前を書き、未確認の文を消す |
| docs/04 の4節の8 | 例 `MpCmdRun.exe -Scan -ScanType 3 -File <vsix>`。引数は推定 | 公式文書で確かめた。アーカイブの中まで走査し、検出しても処置せず結果を出力に出すには `-DisableRemediation` を足す。戻り値 0＝無し、2＝検出・誤り。場所は `C:\ProgramData\Microsoft\Windows Defender\Platform\<版>\MpCmdRun.exe`（無ければ `C:\Program Files\Windows Defender\`） | `MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation` に直し、「推定」を外す |
| docs/04 の3節 | `sha256` は Open VSX の公開値で、VSIX 本体との照合はまだ | 照合した。一致 | 63行目の注記を「2026-11-13 に VSIX 本体と照合し一致」に直す |
| docs/04 の2節の表 | weixu.wx-vsce-dotenv の engines `^1.96.0（要照合）` | `^1.96.0`（Open VSX の 0.2.3 のメタデータと manifest） | 「（要照合）」を外す |

## 2. docs に書かれていない事実で、設計に効くもの

### 2.1 本家の zip の中の配置（docs/07 の2.3・2.4、docs/02 の7節の後処理）

本家 1.146.0 の Windows の zip は、`Code.exe` と `bin\code.cmd` を直下に置くが、`resources\app\` を **commit の先頭10桁のフォルダの下**に置く（`<展開先>\69047191fc\resources\app\`。組み込み拡張は `...\69047191fc\resources\app\extensions\`）。VSCodium 1.143.17232 は従来どおり `<展開先>\resources\app\extensions\`。

- 影響: 本家の zip の中の組み込み拡張や `product.json` を指すとき、パスに commit のフォルダが入る。0-3 は VSCodium なので今は影響しない。Phase 1 で自分のビルドの出力（`VSCode-win32-x64`）が同じ形になるかを確かめ、docs/02 の後処理・`switch.ps1` が `resources\app` を直下と決めつけていないかを見直す。
- 案: docs/07 の2.1 の表の注記か、docs/02 の4節に「1.146 系の本家の zip は `<commit10>\resources\app\` に置く（2026-11-13 確認）。自分のビルドの出力の形は Phase 1 で確かめる」と書く。

### 2.2 Claude Code の受け手（docs/03 の9節）

9節は「受け手（Webview、セカンダリサイドバー、JSON の検査、ワークスペースの信頼）は消さない」と書くが、manifest の `menus` には、ほかの受け手も出てくる（claude-code-manifest.md の2節）。

- `comments/commentThread/title`（`commentController == claude-code-hunks`）: 変更の塊の受け入れ・却下に**コメントの API** を使う見込み。
- `editor/context`（`resourceScheme == _claude_vscode_fs_right`）、`editor/title`: **独自のファイルシステムの提供者**と**差分エディタ**を使う見込み。
- `webview/context`、`commandPalette`。

コメント・差分ビューは裁定で残すので、今の設計で壊れはしない。案: 9節の「消さない受け手」に「コメント（contrib/comments。`commentController`）、差分エディタ、拡張のファイルシステムの提供者、メニューの `comments/commentThread/title`・`editor/context`・`editor/title`・`webview/context`」を足す。C-1・C-7 などでコメントやメニューの部品に手を入れる単位を作るときの注意になる。

### 2.3 同梱の拡張の manifest から分かったこと

- **ms-vscode.powershell** は `extensionDependencies: ["vscode.powershell"]`（組み込みの `powershell` 拡張に依存）。docs/03 の4節は `powershell` を残す組み込み拡張に挙げているので食い違いは無い。`builtin/keep.json` の `powershell` の理由に「ms-vscode.powershell の extensionDependencies」を書くとよい。
- **ms-vscode.powershell** は `contributes.debuggers` を持ち、`onDebugResolve:PowerShell` で起動する。docs/03 の1節の4の「PowerShell 拡張はデバッガを持つ（推定）」は manifest で確かめられた。
- **dotenv.dotenv-vscode** は `activationEvents` に `"*"` を持つ（起動時に必ず動く）。0-3 で .env の拡張を選ぶときの材料（メモリ）になる。
- **ms-vscode.powershell** の展開後のサイズは約 315MB（うち PSScriptAnalyzer が約 299MB）。インストールの所要時間とディスクの見積もりに効く。
- **Claude Code** の VSIX に LICENSE のファイルは無い。**mads-hartmann.bash-ide-vscode**・**言語パック**の VSIX にも拡張自身の LICENSE のファイルは無い（docs/04 の2節の「ライセンス」の列は Open VSX の表示なので食い違いではない）。
- **mads-hartmann.bash-ide-vscode** は `extension/node_modules/bash-language-server/` を同梱している（docs/sources の6節の「VSIX への同梱は未確認」が確かめられた）。
- **detachhead.basedpyright** は Open VSX に win32-x64 向けの版が無く、universal だけ。

### 2.4 寝かせる期間と、docs/04 の2節の版

docs/04 の2節は Claude Code 2.1.322（2026-11-10 公開）を台帳の版としているが、2026-11-13 の朝の時点で公開から72時間に満たない（72時間は 2026-11-13T02:30:52Z）。今回の検証では「寝かせる期間」だけが通らない。時間がたてば走らせ直すだけで通る。docs を直す必要は無いが、清書（records）では「何時に通ったか」を書く必要がある。

## 3. 台帳の形（docs/04 の3節）に足したもの

- `checks`: 検証の項目ごとの結果（`pass`・`fail`）。install-extensions.mjs・switch.ps1 が「全部通った版か」を台帳だけで見られるようにした。
- `note`: .env の2件の注記（どちらを残すかは 0-3 の後に決める）。
- `crossCheck` に `bundledCliPath`・`bundledCliSha256`・`manifestGpgSignature`（Claude Code）、`sourceTag`・`sourceRepository`（ほかの拡張）。
- `verdict` は、取り込みの判定がまだ無いので `records/phase0/lock-verification.md` を指した。

案: docs/04 の3節の例に上の項目を書き足す（足さないなら台本から外す）。

## 4. docs/04 の4節の7（ライセンス）の補い

LICENSE のファイルを持たない拡張（Claude Code・bash-ide-vscode・言語パック）は「本文のハッシュ」が取れない。案: 「VSIX に LICENSE のファイルが無ければ、manifest の `license` の文を比べる」と書き足す。

## 5. リーダーに諮る点

1. **ソースのタグの照合（docs/04 の4節の3「ほかの拡張」）の扱い**: weixu.wx-vsce-dotenv（リポジトリにタグが無い）、tomoki1207.pdf（1.2.2 のタグが無い）、言語パック（vscode-loc に版のタグが無い）の3件は、この項目を満たせない。案A（推奨）: 「タグかリリースがあれば記録し、無ければ判定に書くだけで止めない」と docs を直す（台本は今この扱い）。案B: 必須にし、3件の扱いをユーザーに諮る。
2. **ovsx の版の固定**: 今は `npx ovsx` が npm の最新（1.4.0）を取る。案: ビルドリポジトリの `package.json` の devDependencies に ovsx を入れて版を固定する（`npx` は入ったものを使う）。

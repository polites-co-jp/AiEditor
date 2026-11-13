# 04 同梱する拡張と自前の組み込み拡張

## 1. 方針

- 裁定: 同梱する拡張は Open VSX から取得し、版とハッシュを固定して台帳（`extensions.lock.json`）に記録する。発行元と公式配布物の一致も確かめる。更新は「通知 → Claude が検証 → 差し替え」の順。
- 拡張の追加インストールは消す（裁定）。動くのは台帳の拡張と組み込み拡張だけ。
- **拡張を本体のビルドに組み込まない**。Claude Code 拡張は数日おきに新版が出る（2.1.322 は 2026-11-10 公開）[一次] https://open-vsx.org/api/Anthropic/claude-code 。本体の再ビルド（重い）と拡張の差し替え（軽い）の周期を分ける。
- **VSIX は改変せず、本体の正規の手順で入れる**（`<editor> --install-extension <vsix> --force`）。Claude Code の条件 "Claude Code must be installed and run as published by Anthropic" にそのまま合う [一次] https://code.claude.com/docs/en/legal-and-compliance 。
- Marketplace からは取らない。規約が対象を Visual Studio 系の製品に限る [一次] Marketplace Terms of Use 2.b・3（[00](00-overview.md) の5節）。

## 2. 台帳に載せる拡張

版は 2026-11-12 時点の Open VSX の最新。台帳に載せる版は、4節の検証を通したものにする。

| ID | 版 | 公開日 | ライセンス（Open VSX の表示） | engines.vscode | verified | 役割 |
|---|---|---|---|---|---|---|
| anthropic.claude-code（win32-x64） | 2.1.322 | 2026-11-10 | "© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements ..." | ^1.94.0 | true | Claude Code |
| detachhead.basedpyright | 1.40.2 | 2026-10-04 | MIT | ^1.101.0 | true | Python |
| ms-vscode.powershell | 2025.4.0 | 2025-10-09 | "SEE LICENSE IN LICENSE.txt"。GitHub と VSIX 内の LICENSE.txt はどちらも MIT License [一次] https://raw.githubusercontent.com/PowerShell/vscode-powershell/main/LICENSE.txt 。サーバー側（PSES）のライセンスは未確認 | ^1.101.0 | true | PowerShell |
| mads-hartmann.bash-ide-vscode | 1.43.2 | 2026-09-21 | MIT | ^1.91.0 | true | sh |
| mechatroner.rainbow-csv | 3.24.1 | 2026-03-01 | MIT | ^1.95.0 | true | CSV |
| dotenv.dotenv-vscode または weixu.wx-vsce-dotenv | 1.5.8 / 0.2.3 | 2026-10-01 / 2026-10-15 | MIT / MIT | ^1.65.0 / ^1.96.0（要照合） | true / true | .env。裁定: Phase 0 の 0-3 で両方を試し、エラー表示を持つほうを1つ載せる |
| tomoki1207.pdf | 1.2.2 | 2022-12-23 | API に表示なし。GitHub の LICENSE と VSIX 内の LICENSE.txt はどちらも MIT License（著作権者 tomoki1207。冒頭に PDF.js などの第三者の表記あり）[一次] https://raw.githubusercontent.com/tomoki1207/vscode-pdfviewer/master/LICENSE | ^1.46.0 | true | PDF プレビュー |
| MS-CEINTL.vscode-language-pack-ja | 1.131.0 | 2026-07-28 | "SEE MIT LICENSE IN LICENSE.md" | ^1.131.0 | true | 日本語化 |

出典: すべて [一次] `https://open-vsx.org/api/<namespace>/<name>`（`sources/research-extensions-services.md` の1節・6節）。

- Claude Code の Marketplace の掲載文は「VS Code 1.98.0 or higher」と書き、manifest の 1.94.0 と食い違う [一次・要照合] https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code 。本体は 1.146 系なので、どちらでも満たす。
- 拡張の任意の依存（Python 拡張、Jupyter 拡張、Claude in Chrome）は入れない。必須ではない [一次] https://code.claude.com/docs/en/vs-code 。

## 3. 台帳の形

`extensions.lock.json` は配列で、1件の形は次のとおり。

```json
{
  "id": "anthropic.claude-code",
  "version": "2.1.322",
  "targetPlatform": "win32-x64",
  "source": "open-vsx",
  "download": "https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.vsix",
  "sha256": "8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4",
  "sha256Source": "https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.sha256",
  "signature": "https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.sigzip",
  "publicKey": "https://open-vsx.org/api/-/public-key/14ccb407-4e79-41ed-be5a-6d608325c45a",
  "publishedAt": "2026-11-10T02:30:51Z",
  "publishedBy": "igorkofman",
  "verified": true,
  "license": "© Anthropic PBC. All rights reserved. ...",
  "licenseSha256": "<LICENSE の本文のハッシュ>",
  "engines": "^1.94.0",
  "crossCheck": {
    "marketplaceSameVersion": true,
    "bundledCliSha256MatchesManifest": true,
    "authenticode": "Anthropic, PBC"
  },
  "manifestDigest": { "activationEvents": ["onStartupFinished", "onWebviewPanel:claudeVSCodePanel"], "enabledApiProposals": [], "extensionDependencies": [] },
  "verifiedAt": "2026-11-..",
  "verdict": "records/take-in/ext-anthropic.claude-code-2.1.322/verdict.md"
}
```

上の `sha256` は Open VSX が公開している値（2026-11-12 取得）。VSIX 本体との照合はまだしていない（Phase 0 の 0-6 で行う）。

## 4. 検証の項目

新しく載せるとき、版を上げるときに行う。結果は `records/take-in/ext-<id>-<版>/` に残し、`claude -p` が読んで判定する（[06](06-update-watch-and-take-in.md) の6節）。

1. **発行元**: Open VSX の `verified` が true。名前空間が公式文書の案内と一致する（Claude Code は "Anthropic submits extensions for publication to the Visual Studio Marketplace and Open VSX Registry" [一次] https://code.claude.com/docs/en/vs-code）。`publishedBy` が前の版から変わったら目立たせる。
2. **完全性**:
   - VSIX の SHA-256 を `Get-FileHash -Algorithm SHA256` で計算し、Open VSX の `.sha256` の値と照合する。
   - 署名（`.sigzip`）を公開鍵で検証する。道具は Open VSX の CLI `ovsx` で、コマンドは `ovsx verify-signature -i <vsix> -m <manifest> -s <signature> -k <publicKey>` [一次・要照合] https://raw.githubusercontent.com/eclipse/openvsx/master/cli/README.md 。Phase 0 の 0-6 で確かめた（2026-11-13。`records/phase0/lock-verification.md`）: `.sigzip` は `.signature.sig`・`.signature.manifest`・`.signature.p7s` を持ち、`-m` に `.signature.manifest`、`-s` に `.signature.sig`、`-k` に公開鍵の PEM（Ed25519）を渡す。ovsx の版は固定する（裁定 2026-11-13。`package.json` の devDependencies に 1.4.0。入れる道具は pnpm で、`pnpm-lock.yaml` と `pnpm-workspace.yaml` もコミットする）。依存の `@vscode/vsce-sign` の install スクリプトは走らせない（裁定 2026-11-13。`pnpm-workspace.yaml` の `allowBuilds` に `false`。ovsx の `verify-signature` はこの道具を使わない）。
3. **公式配布物との一致**:
   - Claude Code 拡張: (a) 同じ版が Marketplace に Anthropic 名義で出ていることを、メタデータで確かめる（VSIX は取らない）。(b) 拡張は CLI を同梱し、拡張の版が CLI の版と同じ [一次] https://code.claude.com/docs/en/vs-code 。VSIX のファイル一覧から同梱の CLI の実行ファイルを見つけ（ファイルの中身は読まず、ハッシュと署名だけを見る）、SHA-256 を、Anthropic が版ごとに出す `https://downloads.claude.ai/claude-code-releases/<版>/manifest.json` の `platforms.<platform>.checksum` と照合する。`manifest.json.sig` は Anthropic の GPG の鍵（`https://downloads.claude.ai/keys/claude-code.asc`、指紋 `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`）で検証する。署名があるのは 2.1.89 以降 [一次] https://code.claude.com/docs/en/setup 。(c) Windows の実行ファイルは "Anthropic, PBC" の Authenticode 署名を持つ（同ページ）ので、`Get-AuthenticodeSignature` で確かめる。同梱の CLI は VSIX の `extension/resources/native-binary/claude.exe`、manifest の platform の名前は `win32-x64`（0-6 で確かめた。2026-11-13）。
   - ほかの拡張（参考の項目。裁定 2026-11-13 で必須にしない）: ソースのリポジトリに同じ版のリリースかタグがあるかを見て記録し、無ければ判定で触れる。2026-11-13 の時点で、weixu.wx-vsce-dotenv（タグが無い）・tomoki1207.pdf・日本語パックは同じ版のタグが無い。
4. **寝かせる期間（裁定）**: 公開から72時間未満の版は、セキュリティ修正でない限り入れない。確認の時点でその版が取り下げられていないことも見る。理由: 2.1.313 の悪性版が Open VSX に出たという報道（[二次・本文未読] https://runtimewire.com/article/trojanized-claude-code-extension-open-vsx-ssh-backdoor）と、Open VSX が誤って悪性と判定した件（[一次] https://github.com/anthropics/claude-code/issues/5762）。
5. **manifest の差分**: 前の版からの package.json の変化を Claude が読む。見る項目: `activationEvents`、`contributes`（特に `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`debuggers`・`notebooks` が増えていないか）、`extensionDependencies`、`enabledApiProposals`、`engines`、`main`、`capabilities`。増えていたら、消した機能に依存し始めた恐れとして判定に書く（[03](03-removal-design.md) の9節）。
6. **ファイル一覧の差分**: VSIX（zip）の中のファイルの一覧を前の版と比べる。新しい実行ファイル（.exe・.dll・.node）、大きなサイズの変化を見る。圧縮された JS の中身は読まない（裁定）。
7. **ライセンス**: 本文のハッシュが前の版と同じ。変わっていれば本文の差分を判定に書く。
8. **ウイルスの走査**: Microsoft Defender で VSIX を走査する（例 `MpCmdRun.exe -Scan -ScanType 3 -File <vsix>`。引数は推定。Phase 0 で確かめる）。
9. **engines**: `engines.vscode` が、今の本体の版（と、取り込み中の新しい本体の版）を満たす。
10. **一時的な置き場所でのスモーク**: `--user-data-dir` と `--extensions-dir` を一時フォルダにして入れ、スモークの組（[06](06-update-watch-and-take-in.md) の5節）を通す。

## 5. 入れ方と戻し方

`scripts/install-extensions.mjs` の手順は次のとおり。

1. 台帳を読み、VSIX を `<buildRoot>\cache\vsix\` に取る（あればキャッシュを使う）。`<editor>` の CLI は `<installRoot>\current\bin` のものを使う。`buildRoot`・`installRoot` は PC ごとの設定ファイル `local.json` から読む（道具ごとに使うキーは [02](02-repository-and-build.md) の6.1 の表のとおり。この道具はビルドリポジトリの中で動くので `builderRepo` は使わない）。
2. SHA-256 を台帳と照合する。違えば止める。
3. 言語パックを先に、残りを台帳の順に `<editor> --install-extension <vsix> --force` で入れる。
4. 台帳に無い拡張が入っていたら、一覧を出して止める（消すかはユーザーが決める）。
5. `argv.json` に `"locale": "ja"` を書く（7節）。

- 拡張の置き場所はユーザーごとに1つ（推定 `%USERPROFILE%\.shuko\extensions`）。版のフォルダを切り替えても拡張はそのまま。`switch.ps1` は、切り替える先の本体の版が台帳の `engines` を満たすかを確かめ、満たさなければ止まる。
- **戻し方**: 台帳はビルドリポジトリの git にある。`install-extensions.mjs --rev <コミット>` で、その時点の台帳の版を入れ直す。前の版の VSIX はキャッシュに残す。
- `extensions.allowed`（1.96 から。拡張の ID ごと、または版ごとに許可を列挙できる。範囲指定は不可）[一次] https://code.visualstudio.com/docs/enterprise/extensions を、`mydist` の既定で `{"*": false, "<台帳の ID>": true, ...}` にする。ID だけを載せ、版は台帳で固定する（版まで載せると拡張の差し替えのたびに本体の再ビルドが要るため）。VSIX の手動インストールにも効き、パッケージ内の ID で判定する（同ページ）。CLI の `--install-extension` に効くか、組み込み拡張が対象外か、`configurationDefaults` で既定にできるかは未確認。Phase 0 の 0-8・0-9 で確かめ、`mydist` を組み込み拡張として同梱したときの効き方を Phase 2 で確かめる。

## 6. 自前の組み込み拡張 `mydist`

コードを持たない（`main` なし）組み込み拡張。`extensions-src/mydist/` に置き、ビルドで `extensions/mydist/` に写す（[02](02-repository-and-build.md) の4.1）。

### 6.1 既定の設定（`contributes.configurationDefaults`）

| 設定 | 値 | 理由 | 外す時期 |
|---|---|---|---|
| `workbench.colorTheme` | `Light Modern`（0-9 で 1.146.0 の実物で確かめた。2026-11-13） | 裁定のテーマ | — |
| `telemetry.telemetryLevel` | `off` | テレメトリ（B-1 の補い） | — |
| `chat.disableAIFeatures` | `true` | C-1 まで本家の AI を眠らせる [一次] https://code.visualstudio.com/docs/agents/reference/ai-settings | C-1 の後（設定が無くなる） |
| `breadcrumbs.enabled` | `false` | C-7 まで隠す | C-7 の後 |
| `workbench.startupEditor` | `none` | 歓迎画面を出さない | B-2 の後に要否を見る |
| `workbench.enableExperiments` | `false` | 実験 | B-2 の後に要否を見る |
| `extensions.autoUpdate` / `extensions.autoCheckUpdates` | `false` / `false` | 拡張の更新は台帳で行う | — |
| `update.mode` | `none` | 本体の更新は自分で行う | — |
| `extensions.allowed` | 5節 | 台帳の拡張だけ | — |
| `basedpyright.importStrategy` | `useBundled` | 既定の `fromEnvironment` は Python 拡張（`ms-python.python`）の API で環境を探し、無いと basedpyright が起動しない。同梱のサーバーを使えば Python 拡張なしで動く（裁定 2026-11-13。`tasks/2026-11-13-p0-basedpyright-probe/`） | — |
| 外向き通信を止める設定 | Phase 0 の通信の棚卸し（[07](07-phases.md) の 0-5）で決める。候補: `typescript.disableAutomaticTypeAcquisition`、`npm.fetchOnlinePackageInfo`、`json.schemaDownload.enable`、`workbench.settings.enableNaturalLanguageSearch` | 不要な外部通信 | — |

- 組み込み拡張の `configurationDefaults` で、ほかの部品の設定（`chat.disableAIFeatures` など）や application スコープの設定（`extensions.allowed`）を既定にできるかは未確認。Phase 0 の 0-9 で確かめ、組み込み拡張として同梱したときの効き方を Phase 2 で確かめる。できないものは、product.json の上書きか小さなパッチで既定を変える。
- `files.watcherExclude` を広げるとメモリが大きく減ったという報告がある（[二次] Stack Overflow の回答へのコメント。版不明）。Phase 2 で、`node_modules` などを足した既定を測って決める。

### 6.2 Sublime Text のキー割り当て

- 元: `ms-vscode.sublime-keybindings` 4.1.10（MIT、Open VSX で verified、2024-01-22 から更新なし）[一次] https://open-vsx.org/api/ms-vscode/sublime-keybindings 、https://github.com/microsoft/vscode-sublime-keybindings/blob/main/LICENSE.md 。
- `scripts/convert-sublime-keys.mjs` で、元の `contributes.keybindings` の各項目から Windows 向けのキー（`win` があればそれ、無ければ `key`）と `command`・`when` を抜き出し、`mydist` の `contributes.keybindings` に書く。一度だけ行い、結果をビルドリポジトリに置く。元の版を README に書く。
- MIT の著作権表示と許諾文を `extensions-src/mydist/ThirdPartyNotices.txt` に残す。
- 消した機能（デバッグなど）のコマンドを指す項目は落とす（落とした一覧を残す）。
- Claude Code 拡張の既定のキー（`ctrl+escape`、`ctrl+shift+escape`、`ctrl+alt+f`、`ctrl+alt+k` など。manifest の `keybindings` 9件）と衝突しないかを、変換のときに一覧にする [一次] Claude Code の manifest。
- ユーザーの `keybindings.json` は個人の上書きだけを持ち、Notion で同期する（[05](05-settings-sync.md)）。

### 6.3 その他

- `package.json` の `name` は `mydist`、`publisher` は `vscode` 以外の自分の名前（仮 `shuko`）。
- `notion-sync` は別の組み込み拡張（[05](05-settings-sync.md)）。

## 7. 日本語化

- 言語パック `MS-CEINTL.vscode-language-pack-ja` を台帳に載せて入れる。表示言語は `argv.json` の `"locale": "ja"` で決める（`argv.json` の場所は推定 `%USERPROFILE%\.shuko\argv.json`。Phase 1 で確かめる）。
- Open VSX の最新は 1.131.0（engines ^1.131.0）で、本体の 1.146.0 より古い。版の番号は VS Code の版と一致している [二次] Open VSX の版の一覧。新しい本体で使うと、未訳の部分が英語で出るだけで済む見込み（推定）。Phase 0 の 0-7 で確かめる。
- 裁定: 未訳の部分が英語になるのを受け入れる。目立つなら改めてユーザーに諮る。
- 目立つときに諮る別案: vscode-loc（MIT）のソースから、本体と同じ版の言語パックを自分で包んで台帳に載せる。ただし vscode-loc の文字列の最終更新は 2026-09-04 で、どの本体の版に対応するかの記述は無い [一次] https://github.com/microsoft/vscode-loc/commits/main 。
- Microsoft 発行の拡張（言語パック、PowerShell）を Open VSX 経由で使うことが Marketplace の規約に触れないかは、文書から断定できない。裁定: 個人利用として、法的な確認をせずに使う。リスクはユーザーが受け入れる（[00](00-overview.md) の4.3）。

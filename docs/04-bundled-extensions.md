# 04 同梱する拡張と自前の組み込み拡張

## 1. 方針

- 裁定: 同梱する拡張は Open VSX から取得し、版とハッシュを固定して台帳（`extensions.lock.json`）に記録する。発行元と公式配布物の一致も確かめる。更新は「通知 → Claude が検証 → 差し替え」の順。
- 拡張の追加インストールは消す（裁定）。動くのは台帳の拡張と組み込み拡張だけ。
- 拡張を足すときは、ユーザーが Claude へのプロンプトで課に代行を頼み、課が取得・確かめ・台帳への記載・導入までを行う（裁定 2026-11-17。8節）。
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
| weixu.wx-vsce-dotenv | 0.2.3 | 2026-10-15 | MIT | ^1.96.0 | true | .env。裁定「エラー表示を持つほうを1つ載せる」により、こちらに決めた（2026-11-13）。誤りを含む .env で診断を4件出し、`dotenv.dotenv-vscode` 1.5.8 は0件だった（`tasks/2026-11-13-p1-smoke/handoff-notes.md` の「合図後の実行の結果」6節）。`dotenv.dotenv-vscode` は台帳から外す |
| tomoki1207.pdf | 1.2.2 | 2022-12-23 | API に表示なし。GitHub の LICENSE と VSIX 内の LICENSE.txt はどちらも MIT License（著作権者 tomoki1207。冒頭に PDF.js などの第三者の表記あり）[一次] https://raw.githubusercontent.com/tomoki1207/vscode-pdfviewer/master/LICENSE | ^1.46.0 | true | PDF プレビュー |

出典: すべて [一次] `https://open-vsx.org/api/<namespace>/<name>`（`sources/research-extensions-services.md` の1節・6節）。

- 2026-11-17 に `MS-CEINTL.vscode-language-pack-ja` 1.131.0（2026-07-28 公開、"SEE MIT LICENSE IN LICENSE.md"、engines ^1.131.0）を台帳から外した。本体と同じ版の自前の組み込みのパックに置き換えた（7節）。台帳は7件。

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

上の `sha256` は Open VSX が公開している値（2026-11-12 取得）。Phase 0 の 0-6 で VSIX 本体と照合し、一致した（`records/phase0/lock-verification.md`）。

実際の台帳（Phase 0 の 0-6 で `scripts/lock-verify.mjs` が書いたもの）は、上の形に次を足している。足した項目は形の誤りではない（`scripts/lib/lock.mjs` の `validateLockEntry` は拒まない）。

- `checks`: 4節の項目ごとの結果（`pass` / `fail` など）。
- `references`: 参考の項目の結果。今はソースのタグ（`sourceTag`: `found` / `not-found`。裁定 2026-11-13 で必須にしない）。
- `crossCheck` の追加の項目: Claude Code に `bundledCliPath`・`bundledCliSha256`・`manifestGpgSignature`、ほかの拡張に `sourceTag`・`sourceRepository`。
- `note`: 補足（.env の2件の候補など）。

## 4. 検証の項目

新しく載せるとき、版を上げるときに行う。結果は `records/take-in/ext-<id>-<版>/` に残し、`claude -p` が読んで判定する（[06](06-update-watch-and-take-in.md) の6節）。

1. **発行元**: Open VSX の `verified` が true。名前空間が公式文書の案内と一致する（Claude Code は "Anthropic submits extensions for publication to the Visual Studio Marketplace and Open VSX Registry" [一次] https://code.claude.com/docs/en/vs-code）。`publishedBy` が前の版から変わったら目立たせる。
2. **完全性**:
   - VSIX の SHA-256 を `Get-FileHash -Algorithm SHA256` で計算し、Open VSX の `.sha256` の値と照合する。
   - 署名（`.sigzip`）を公開鍵で検証する。道具は Open VSX の CLI `ovsx` で、コマンドは `ovsx verify-signature -i <vsix> -m <manifest> -s <signature> -k <publicKey>` [一次・要照合] https://raw.githubusercontent.com/eclipse/openvsx/master/cli/README.md 。Phase 0 の 0-6 で確かめた（2026-11-13。`records/phase0/lock-verification.md`）: `.sigzip` は `.signature.sig`・`.signature.manifest`・`.signature.p7s` を持ち、`-m` に `.signature.manifest`、`-s` に `.signature.sig`、`-k` に公開鍵の PEM（Ed25519）を渡す。ovsx の版は固定する（裁定 2026-11-13。`package.json` の devDependencies に 1.4.0。入れる道具は pnpm で、`pnpm-lock.yaml` と `pnpm-workspace.yaml` もコミットする）。依存の `@vscode/vsce-sign` の install スクリプトは走らせない（裁定 2026-11-13。`pnpm-workspace.yaml` の `allowBuilds` に `false`。ovsx の `verify-signature` はこの道具を使わない）。
3. **公式配布物との一致**:
   - Claude Code 拡張: (a) 同じ版が Marketplace に Anthropic 名義で出ていることを、メタデータで確かめる（VSIX は取らない）。(b) 拡張は CLI を同梱し、拡張の版が CLI の版と同じ [一次] https://code.claude.com/docs/en/vs-code 。VSIX のファイル一覧から同梱の CLI の実行ファイルを見つけ（ファイルの中身は読まず、ハッシュと署名だけを見る）、SHA-256 を、Anthropic が版ごとに出す `https://downloads.claude.ai/claude-code-releases/<版>/manifest.json` の `platforms.<platform>.checksum` と照合する。`manifest.json.sig` は Anthropic の GPG の鍵（`https://downloads.claude.ai/keys/claude-code.asc`、指紋 `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`）で検証する。署名があるのは 2.1.89 以降 [一次] https://code.claude.com/docs/en/setup 。(c) Windows の実行ファイルは "Anthropic, PBC" の Authenticode 署名を持つ（同ページ）ので、`Get-AuthenticodeSignature` で確かめる。同梱の CLI は VSIX の `extension/resources/native-binary/claude.exe`、manifest の platform の名前は `win32-x64`（0-6 で確かめた。2026-11-13）。
   - ほかの拡張（参考の項目。裁定 2026-11-13 で必須にしない）: ソースのリポジトリに同じ版のリリースかタグがあるかを見て記録し、無ければ判定で触れる。2026-11-13 の時点で、weixu.wx-vsce-dotenv（タグが無い）・tomoki1207.pdf・日本語パックは同じ版のタグが無い。
4. **寝かせる期間（裁定）**: 公開から72時間未満の版は、セキュリティ修正でない限り入れない。確認の時点でその版が取り下げられていないことも見る。取り下げの確認には、判定の時刻に取り直した版の一覧を使う。毎週の取り込みでは `lock-fetch` と `lock-verify` を続けて走らせる（Phase 0 の 0-6 の検証の指摘 N-2 を受けたリーダーの判断。Phase 0 では取得から7時間後の一覧で判定した）。理由: 2.1.313 の悪性版が Open VSX に出たという報道（[二次・本文未読] https://runtimewire.com/article/trojanized-claude-code-extension-open-vsx-ssh-backdoor）と、Open VSX が誤って悪性と判定した件（[一次] https://github.com/anthropics/claude-code/issues/5762）。
5. **manifest の差分**: 前の版からの package.json の変化を Claude が読む。見る項目: `activationEvents`、`contributes`（特に `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`debuggers`・`notebooks` が増えていないか）、`extensionDependencies`、`enabledApiProposals`、`engines`、`main`、`capabilities`。増えていたら、消した機能に依存し始めた恐れとして判定に書く（[03](03-removal-design.md) の9節）。
6. **ファイル一覧の差分**: VSIX（zip）の中のファイルの一覧を前の版と比べる。新しい実行ファイル（.exe・.dll・.node）、大きなサイズの変化を見る。圧縮された JS の中身は読まない（裁定）。
7. **ライセンス**: 本文のハッシュが前の版と同じ。変わっていれば本文の差分を判定に書く。VSIX に LICENSE のファイルが無い拡張（Claude Code・bash-ide-vscode・言語パック。Phase 0 で確認）は、manifest の `license` の文を比べる。
8. **ウイルスの走査**: Microsoft Defender で VSIX を走査する（`MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation`。Phase 0 で公式の文書と実機で確かめた。戻り値 0＝検出なし、2＝検出か誤り。場所は `C:\ProgramData\Microsoft\Windows Defender\Platform\<版>\MpCmdRun.exe`）。
9. **engines**: `engines.vscode` が、今の本体の版（と、取り込み中の新しい本体の版）を満たす。
10. **一時的な置き場所でのスモーク**: `--user-data-dir` と `--extensions-dir` を一時フォルダにして入れ、スモークの組（[06](06-update-watch-and-take-in.md) の5節）を通す。

## 5. 入れ方と戻し方

`scripts/install-extensions.mjs` の手順は次のとおり。

1. 台帳を読み、VSIX を `<buildRoot>\cache\vsix\` に取る（あればキャッシュを使う）。`<editor>` の CLI は `<installRoot>\current\bin` のものを使う。`buildRoot`・`installRoot` は PC ごとの設定ファイル `local.json` から読む（道具ごとに使うキーは [02](02-repository-and-build.md) の6.1 の表のとおり。この道具はビルドリポジトリの中で動くので `builderRepo` は使わない）。
2. SHA-256 を台帳と照合する。違えば止める。
3. 台帳の順に `<editor> --install-extension <vsix> --force` で入れる（2026-11-17 までは言語パックを先に入れていた。今の日本語パックは本体に同梱する組み込みの拡張なので、台帳に無い。7節）。
4. 台帳に無い拡張が入っていたら、一覧を出して止める（消すかはユーザーが決める）。
5. `argv.json` に `"locale": "ja"` を書く（7節）。ファイルの末尾は `\n}` で終える（既存の中身を書き換えるときも同じ）。エディタは初めての起動で末尾の2文字を切って `enable-crash-reporter` などを足すため、`}` の後に改行があると壊れた JSON になり、`locale` が効かなくなる（Phase 0 で実際に起きた）。

- 拡張の置き場所はユーザーごとに1つ（推定 `%USERPROFILE%\.shuko\extensions`）。版のフォルダを切り替えても拡張はそのまま。`switch.ps1` は、切り替える先の本体の版が台帳の `engines` を満たすかを確かめ、満たさなければ止まる。
- **戻し方**: 台帳はビルドリポジトリの git にある。`install-extensions.mjs --rev <コミット>` で、その時点の台帳の版を入れ直す。前の版の VSIX はキャッシュに残す。
- `extensions.allowed`（1.96 から。拡張の ID ごと、または版ごとに許可を列挙できる。範囲指定は不可）[一次] https://code.visualstudio.com/docs/enterprise/extensions を、`{"*": false, "<台帳の ID>": true, ...}` にする。application スコープなので `mydist` の既定では入らず、product.json の `shukoConfigurationDefaults` と小さなパッチで既定にする（[02](02-repository-and-build.md) の3節。2026-11-13）。ID だけを載せ、版は台帳で固定する（版まで載せると拡張の差し替えのたびに本体の再ビルドが要るため）。VSIX の手動インストールにも効き、パッケージ内の ID で判定する（同ページ）。CLI の `--install-extension` に効くかは、Phase 0 の 0-8 の自動の部分で確かめた（効く。`tasks/2026-11-13-p0-envs-mydist-keys/extensions-allowed.md`）。組み込み拡張が対象外かと、画面の「VSIX からインストール」に効くかは、Phase 2 の自作のビルドで確かめる。`configurationDefaults` では既定にできない（application スコープ。6.1 の注）。

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
| `extensions.autoUpdate` / `extensions.autoCheckUpdates` | `"off"` / `false` | 拡張の更新は台帳で行う。1.146.0 の `extensions.autoUpdate` は文字列（`on`/`off`）（`tasks/2026-11-13-p1-ledger-mydist-decisions/doc-corrections.md` の2） | — |
| `update.mode` | `none` | 本体の更新は自分で行う | — |
| `extensions.allowed` | 5節 | 台帳の拡張だけ | — |
| `basedpyright.importStrategy` | `useBundled` | 既定の `fromEnvironment` は Python 拡張（`ms-python.python`）の API で環境を探し、無いと basedpyright が起動しない。同梱のサーバーを使えば Python 拡張なしで動く（裁定 2026-11-13。`tasks/2026-11-13-p0-basedpyright-probe/`） | — |
| `typescript.disableAutomaticTypeAcquisition` | `true` | 型定義の自動取得の通信を止める（不要な通信。裁定 2026-11-13 の「通信の扱いの訂正」。0-5 の棚卸し `records/phase0/network-inventory.md` の4節） | — |
| `npm.fetchOnlinePackageInfo` | `false` | npm のパッケージ情報の取得を止める（同上） | — |
| `json.schemaDownload.enable` | `false` | JSON の schema の取得を止める（同上） | — |
| `workbench.settings.enableNaturalLanguageSearch` | `false` | 設定の検索の通信を止める（同上） | — |
| `claudeCode.environmentVariables` | `[{"name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1"}, {"name": "CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL", "value": "1"}]` | CLI の付帯の通信を止める（裁定 2026-11-13）。前者は自動更新・テレメトリ・エラーの報告・フィードバック・リリースノートなど、後者は公式のプラグインのマーケットプレイスの自動登録（前者で止まらない分。リーダーの判断で、裁定の「付帯の通信」に当てはめた）[一次] https://code.claude.com/docs/en/env-vars 。WebFetch の宛先の安全確認（`api.anthropic.com`）は Claude の作業の一部で安全のためのものなので止めない。設定は machine スコープで、既定が効くのは起動の処理の順による見込み（Phase 2 で実物で確かめ、毎週の取り込みでも見る）。ユーザー設定にこの配列を書くと丸ごと置き換わる（[05](05-settings-sync.md) の注意） | — |

- 拡張の `configurationDefaults` で既定にできるのは、machine-overridable・window・resource・language-overridable のスコープの設定だけ。**application スコープの設定は既定にできない**（警告を出して捨てる。組み込み拡張も同じ）[一次] 本家 1.146.0 の `src/vs/workbench/api/common/configurationExtensionPoint.ts`（`tasks/2026-11-13-p1-ledger-mydist-decisions/doc-corrections.md` の1）。上の表のうち `extensions.allowed`・`telemetry.telemetryLevel`・`update.mode`・`workbench.enableExperiments`・`extensions.autoUpdate`・`extensions.autoCheckUpdates` の6件が当たる。この6件は、product.json の独自のキー `shukoConfigurationDefaults` に値を置き、それを既定として登録する小さなパッチ（1か所）で既定を変える（2026-11-13 リーダーの判断。`tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md` の案B-2。[02](02-repository-and-build.md) の3節）。product.json には設定の既定を入れる仕組みが無く、設定ごとにソースの既定を書き換える案は6か所に散って壊れやすいため。`chat.disableAIFeatures`（window）は効く。
- `files.watcherExclude` を広げるとメモリが大きく減ったという報告がある（[二次] Stack Overflow の回答へのコメント。版不明）。Phase 2 で、`node_modules` などを足した既定を測って決める。

### 6.2 Sublime Text のキー割り当て

- 元: `ms-vscode.sublime-keybindings` 4.1.10（MIT、Open VSX で verified、2024-01-22 から更新なし）[一次] https://open-vsx.org/api/ms-vscode/sublime-keybindings 、https://github.com/microsoft/vscode-sublime-keybindings/blob/main/LICENSE.md 。
- `scripts/convert-sublime-keys.mjs` で、元の `contributes.keybindings` の各項目から Windows 向けのキー（`win` があればそれ、無ければ `key`）と `command`・`when`・`args` を抜き出し、`mydist` の `contributes.keybindings` に書く。選んだキーが `none` の項目と、知らない修飾キーを含む項目（4.1.10 の `ctr+shift+[` など）は落とす（Phase 0 の 0-10。`records/phase0/sublime-keys.md`）。一度だけ行い、結果をビルドリポジトリに置く。元の版を README に書く。
- MIT の著作権表示と許諾文を `extensions-src/mydist/ThirdPartyNotices.txt` に残す。
- 消した機能（デバッグなど）のコマンドを指す項目は落とす（落とした一覧を残す）。
- Claude Code 拡張の既定のキー（`ctrl+escape`、`ctrl+shift+escape`、`ctrl+alt+f`、`ctrl+alt+k` など。manifest の `keybindings` 9件）と衝突しないかを、変換のときに一覧にする [一次] Claude Code の manifest。
- ユーザーの `keybindings.json` は個人の上書きだけを持ち、Notion で同期する（[05](05-settings-sync.md)）。

### 6.3 その他

- `package.json` の `name` は `mydist`、`publisher` は `vscode` 以外の自分の名前（仮 `shuko`）。
- `notion-sync` は別の組み込み拡張（[05](05-settings-sync.md)）。

## 7. 日本語化

- 表示言語は `argv.json` の `"locale": "ja"` で決める（`argv.json` の場所は `%USERPROFILE%\<product の dataFolderName>\argv.json`。`dataFolderName` を `.shuko` にすれば `%USERPROFILE%\.shuko\argv.json`。環境変数 `VSCODE_PORTABLE` があれば `<VSCODE_PORTABLE>\argv.json`。`--user-data-dir` は関係しない [一次] 本家 1.146.0 の `src/mainImpl.ts` の `getArgvConfigPath`（Phase 0 で確認）。Phase 1 で実際の場所を確かめる）。
- 裁定（2026-11-17）: 未訳の部分を英語のまま残さず、日本語にする。前の裁定（2026-11-12「未訳の部分が英語になるのを受け入れる。目立つなら改めて諮る」）を改めた。
- 2026-11-17 の状態（リーダーが読んで確かめた）: Open VSX の `MS-CEINTL.vscode-language-pack-ja` 1.131.0（engines ^1.131.0）を入れ、`languagepacks.json` に登録されて効いている。本体 1.146.0 の文言 12,355 件のうち約 650 件が英語のまま（1.132〜1.146 で増えた文言）。Open VSX の最新は 1.131.0 で、本体より古い。
- 作り方（2026-11-17。詳細は `tasks/2026-11-17-l10n-ja/l10n-design.md`）:
  1. **入れ方**: 自前の組み込みの拡張 `shuko.language-pack-ja`（`extensions-src/language-pack-ja/`）にし、mydist・notion-sync と同じく `apply.mjs` が本体の `extensions/` に写す。`contributes.localizations` の `ja` に、本体（`vscode`）と組み込みの拡張ごとの訳の束を並べる。組み込みの拡張も言語パックの一覧（`languagepacks.json`）に載り、`extensions.allowed` には止められない（本家 1.146.0 の `languagePacks.ts`・`extensionsScannerService.ts`。notion-sync が前例）。
  2. **Open VSX のパックとは置き換える**: 同じ翻訳の ID は後から読んだ拡張が勝ち、読む順は組み込みが先・ユーザーの拡張が後なので、`MS-CEINTL.vscode-language-pack-ja` が入ったままだと古い訳に戻る。台帳と `extensions.allowed` から外し、入れ替えのときに入っている拡張も外す（外す許可は Team に依頼。`tasks/2026-11-17-l10n-ja/permission-requests.md`）。
  3. **訳の元**（`sources.json`。先に書いた元が勝つ）: vscode-loc（MIT）の PR #2450（Microsoft の自動の書き出し、head `e0407b9e`、2026-10-23。未マージ）→ vscode-loc の main → Open VSX の 1.131.0。commit を40桁で、ファイルごとの SHA-256 も固定する。取得は `scripts/l10n-ja.mjs fetch`（置き場所は `<buildRoot>\cache\l10n\`）。
  4. **足した訳**（`added/<本体の版>.json`）: 公式の訳に無い文言と、公式の訳が英語のままの文言（上書き）を、鍵（`core.<moduleId>.<key>`・`extensions.<ID>.package|bundle.<key>`）で引ける形で置く。値は `{ en, ja }` で、`en` が今の英語と違えば作り直しが止まる。訳語は公式の訳の言い回しにそろえる。
  5. **除外**（`exclusions.json`）: 英語のままでよい文言を1件ずつ理由（`format`・`proper-noun`・`code`）つきで載せる。規則での除外は使わない。
  6. **組む**: `scripts/l10n-ja.mjs build` が `sources.json` と `added/` から `dist/translations/` を作る（本家の言語パックと同じ形。dist はリポジトリに入れる）。
  7. **数える**: `scripts/l10n-ja.mjs count`（本体・package・bundle・直書き）と、曹参の独立の網 `tests/l10n-audit.mjs`。合格は「除外の外の未訳 0」。
  - 1.146.0（版 `1.146.0-p5-c-all-r4` の文言）の結果: 全体 15,159 件（本体 12,334、組み込み拡張の package 1,258・bundle 1,545、自前の拡張の直書き 22）。公式の訳 14,941、課が足した訳 182、上書き 9、除外 5（書式の印だけ）、除外の外の未訳 0。Shuko のパッチが足した文言は1件（`aboutDetailWithoutCopilot`）。
- 本体の版が上がったら（毎週の取り込み）、訳の元を新しくし、増えた文言を訳してからパックを作り直す（`TAKE-IN.md`）。訳すのは蒙恬で、今は自動にしない。未訳が残っても取り込みの採否は止めない（判定に未訳の数を書く。急ぐセキュリティの修正では英語が残ったまま入れ替えて、後で訳を足してよい）。別の検知の項目（vscode-loc の見張り）は足さない（2026-11-17 のリーダーの判断）。
- 対象の外: 台帳のほかの拡張（Claude Code・PowerShell など）の表示。拡張が日本語の訳を持たなければ英語のまま。VSIX は改変しない（1節）。
- Microsoft 発行の拡張（言語パック、PowerShell）を Open VSX 経由で使うことが Marketplace の規約に触れないかは、文書から断定できない。裁定: 個人利用として、法的な確認をせずに使う。リスクはユーザーが受け入れる（[00](00-overview.md) の4.3）。

## 8. 拡張を足すとき（代行の依頼）

裁定（2026-11-17）: ユーザーは拡張を自分で入れない。Claude へのプロンプトで課に代行を頼む。課は拡張を取得し、スリム化した Shuko に合うかを確かめ、要れば整えてから台帳に載せて入れる。

1. **受け付け**（リーダー）: ユーザーが、このリポジトリで起動した `claude`（リーダー）に、拡張の名前か Open VSX の URL と、何に使うかを伝える。リーダーが `tasks/<日付>-ext-<名前>/brief.md` を書く。
2. **取得と検証**（蒙恬）: Open VSX から取る（Marketplace からは取らない。1節）。4節の検証の項目1〜9を通す。Open VSX に無い、`verified` でない、寝かせる期間に満たないときは、リーダーがユーザーに諮る。
3. **スリム化した Shuko に合うかの確かめ**（蒙恬）:
   - manifest を見る。消した機能（[03](03-removal-design.md)）に依存する印: `contributes` の `debuggers`・`breakpoints`・`notebooks`・`notebookRenderer`・`chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`、`enabledApiProposals`、`extensionDependencies`（依存する拡張も同じ手順で足す）、`engines.vscode` が今の本体の版を満たすか。
   - 一時的な置き場所で入れて動かす（4節の10）。拡張が起動し、新しい誤りが出ないこと。消した機能の API は何もしない実装なので、呼んでも止まらないが、その機能は働かない。
4. **整える**: 消した機能に依存して働かない部分があるときは、扱いをリーダーがユーザーに諮る（入れない／働かない部分を承知で入れる／包み直す（ライセンスが改変を許すものだけ。Claude Code は対象外）／消した機能を戻す）。VSIX を改変するのは、ユーザーが選んだときだけ。
5. **台帳に載せる**（蒙恬）: `extensions.lock.json` に足し、`product.overlay.json` の `shukoConfigurationDefaults` の `extensions.allowed` に ID を足す。`extensions.allowed` は product.json の既定なので、新しい ID は本体を作り直さないと入れられない。急がなければ毎週の取り込みの版に乗せ、急ぐときは作り直す。
6. **テストと検証**: 曹参が台帳と `extensions.allowed` の照合などのテストを直し、大岡越前守が検証とスモーク（拡張が起動し、新しい誤りが無い）で合否を出す。
7. **入れる**（蒙恬）: 作り直した版に入れ替え（`switch.ps1`）、`install-extensions.mjs` で台帳の拡張を入れる。リーダーがコミットし、ユーザーに報告する。

- 以後、その拡張は台帳のほかの拡張と同じく、毎週の検知と取り込みの対象になる（[06](06-update-watch-and-take-in.md)）。
- 外すときも同じ窓口で頼む。課が台帳と `extensions.allowed` から外し、本体を作り直して入れ替え、入っている拡張を消す。

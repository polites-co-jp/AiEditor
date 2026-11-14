# A-2-accounts-extensions

GitHub と Microsoft のアカウントの組み込み拡張を消す（docs/03 の4節の段階 A）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/github`（GitHub への公開・PR を開く・vscode.dev のリンクなど）、`extensions/github-authentication`（GitHub のサインイン）、`extensions/microsoft-authentication`（Microsoft のサインイン。MSAL とネイティブのモジュールを持つ） |
| 一覧の行（removeLines） | `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の3件ずつ、`build/lib/extensions.ts` の `nativeExtensions` の `'microsoft-authentication',` |

パッチは無い。

## 残すもの

- 認証の仕組み（`src/vs/workbench/services/authentication`）と拡張 API の `vscode.authentication`。アカウントのメニュー（`services/accounts`）は C-6 で見直す。
- product.json の `defaultChatAgent.providerExtensionId`（`vscode.github-authentication`）と `trustedExtensionAuthAccess`。AI のキーなので C-1 で消す（docs/02 の3節）。
- `extensions/pnpm-workspace.yaml` の `allowBuilds` の `'@azure/msal-node-extensions@5.3.2': true`・`'@azure/msal-node-runtime@0.20.1': true` と、`overrides` の `'@azure/msal-node-extensions@5.3.2>keytar': file:microsoft-authentication/packageMocks/keytar`。版を含む行なので、`removeLines` にすると本家が msal を上げるたびに取り込みが止まる。依存の木から msal が消えれば効かない見込み（推定。下の未確認）。
- 本体の文字列の参照（`src/vs/workbench/api/browser/mainThreadProgress.ts`・`mainThreadMessageService.ts` の拡張の ID の一覧、`src/vs/platform/secrets/common/secrets.ts`）。実行時の一覧なので、拡張が無くても型検査に響かない。

## 影響しうるもの

- git の push・pull: `github` 拡張の資格情報の提供が無くなる。Git for Windows の資格情報の管理（Git Credential Manager）が設定してあれば、そちらが答える見込み（推定）。スモークの base で GitHub のリモートへ push できるかを見る。
- ソース管理の「GitHub に公開」「GitHub から clone」の項目が消える。
- 本体のチャットの設定の画面が `vscode.github-authentication` を探してエラーを出す恐れがある（docs/03 の表の注。推定）。C-1 まで残る。
- 本体の GitHub のサービス（`src/vs/workbench/services/github`。`workbench.common.main.ts`・`workbench.desktop.main.ts`・`sessions.*.main.ts` が import する）は残る。認証の提供者が無いので、GitHub のデータを読む操作は「GitHub にサインインしてください」の誤りになる（実行時。型検査には響かない）。使うのは主に本体の AI のセッションの部品（C-1）。
- 設定の同期（本家の Settings Sync）は GitHub / Microsoft のアカウントを使う。本家の同期は C-6 で消し、同期は自前の `notion-sync` で行う（docs/05）ので影響しない。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| 依存の導入が `microsoft-authentication/packageMocks/keytar` を探して止まる | overrides の `file:` を pnpm が先に解決した | `extensions/pnpm-workspace.yaml` の overrides の行を `removeLines` に足す |
| git の push で資格情報を何度も聞かれる | Git Credential Manager が無い | Git for Windows の資格情報の管理を設定する。直らなければ `enabled: false` |
| 起動時にアカウントのエラーが出る | 本体が既定の認証の拡張を探す | C-1・C-6 まで様子を見る。出続けるなら報告する |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 消えたことの検査（checks）

- `github.publish`・`github.copyVscodeDevLink` は **manifest の網**で見る（`extensions/github/package.json` の `contributes.commands`）。`github` の拡張は公式でも起動するが、この2件は起動後5秒の時点で実行時に登録されていなかった（関門の記録 `records/take-in/1.146.0-p2-A-2/gate-A-2-accounts-extensions.md`）。
- 実行時の網として、2つの拡張が起動して作る出力チャネルの表示のコマンドを足した（2026-11-14）:
  - `workbench.action.output.show.vscode.github.GitHub.log`（`github` の拡張の `createOutputChannel("GitHub", {log: true})`）
  - `workbench.action.output.show.vscode.github-authentication.GitHub Authentication.log`（`github-authentication` の拡張の `` `${name} Authentication` ``。name は `GitHub`）
  - 本体がチャネルごとに `workbench.action.output.show.<拡張の ID>.<名前>.log` を登録する。2026-11-14 までの公式の zip の実行8回（`C:\b\smoke\absent\` の `*official*`・`fix-*`・`p2try-*`）と A-1 の版の実行2回のすべてで在り、A-2〜B-7 の版の実行のすべてで無い。チャネルの名前は訳されない文字列（出力の `dist/extension.js` で確かめた）なので、表示の言語に左右されない。
- `microsoft-authentication` は起動しないので、設定 `microsoft-authentication.implementation`（登録簿と manifest の両方で見える）だけで見る。

## 未確認（型検査・依存の導入・スモークで確かめる）

- `pnpm install`（extensions のルート）が、消えたフォルダを指す overrides の `file:` で止まらないか。ロックファイルの差分（docs/03 の5.4）が「消した拡張の依存の削除」だけになるか（MSAL・keytar など）。
- `build/lib/extensions.ts` の `nativeExtensions` が `['git']` だけになって、ネイティブの拡張の梱包（`compileNativeExtensionsBuildTask`）が通るか。
- GitHub のリモートへの push（スモークの base の git の項目に足す）。

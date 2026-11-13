# B-6-online-feeds 外から取りに行く一覧と知らせ

裁定（2026-11-13「通信の扱いの訂正」）: 不要な通信はすべて止める。0-5 の棚卸し（`records/phase0/network-inventory.md`）で、AI を止めた本家でも `main.vscode-cdn.net` へ通信していたので足した単位（リーダーの判断）。

## 1.146.0 のソースで確かめたこと

| product.json のキー | 1.146.0 の OSS の product.json | 読む部品 | 値が無いとき |
|---|---|---|---|
| `emergencyAlertUrl` | 無い | `src/vs/workbench/contrib/emergencyAlert/electron-browser/emergencyAlert.contribution.ts`（52〜60行。起動時と一定の間隔で取りに行く） | 53行で `if (!emergencyAlertUrl) return` し、通信しない |
| `profileTemplatesUrl` | 無い | `src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts`（162〜164行。プロファイルのひな形の一覧） | 162行で `if (this.productService.profileTemplatesUrl)` を見て、通信しない |

- 0-5 の棚卸しで見た `main.vscode-cdn.net` は、Microsoft の配布の zip（本家の公式ビルド）の product.json から来ている。自前のビルドが使う OSS の product.json（作業ツリーの `product.json`）には、`emergencyAlertUrl`・`profileTemplatesUrl` のほか、同じホストを指す `extensionsGallery`・`chatParticipantRegistry`・`agentSdks`・`dictationRuntime`・`webEndpointUrl` もどれも無い（作業ツリーの `product.json` を読んで確かめた）。したがって自前のビルドでは、この宛先はもともと出ない見込み（推定。自作のビルドの監査で確かめる）。
- `copilotVersions` は product.json に無くても、`src/vs/platform/product/common/product.ts`（62〜67行）が package.json の `@github/copilot-sdk` と `copilotRuntimeVersion` から組み立てる。product.json の上書きでは消せない。AgentHost の取得（`github.com`・`release-assets.githubusercontent.com`）の元で、C-1 の扱い。
- `webviewContentExternalBaseUrlTemplate`（`https://{{uuid}}.vscode-cdn.net/...`）を読むのは web 版の環境のサービス（`src/vs/workbench/services/environment/browser/environmentService.ts` 243行）だけで、デスクトップ版の Webview は使わない（docs/02 の3節は「触らない」。そのまま）。

## 消すもの

- `src/vs/workbench/contrib/emergencyAlert`（1ファイル）: 緊急の知らせの取得と表示。キーが無ければ通信しないが、裁定（2026-11-12）の「不要な外部通信は送信処理ごと外す」に合わせて部品ごと消す。docs/03 の表の B-6 は「キーを消し、値の無いときに通信しないことを確かめる」までなので、部品を消すことは足した中身（`tasks/2026-11-13-p2-units-b/doc-corrections.md` に書いた）。
- import の行（`removeLines`）: `workbench.desktop.main.ts`・`sessions.desktop.main.ts` の各1行。
- `productRemove` は空。2つのキーは 1.146.0 に無いので、単位の `productRemove` に置くと毎回「本家に無い」の警告になる。代わりに `product.overlay.json` の `removeIfPresent`（本家が足したら外して警告）に入れた。

## 残すもの

- `userDataProfileManagement.ts`: プロファイルの管理は残す機能。ひな形の取得はキーが無ければ通信しないので、ファイルは直さない。

## WPAD（`wpad` の名前の問い合わせ）の止め方

**実装した場所: `patches/30-proxy-direct-without-settings.patch`（この単位ではない）**（2026-11-14 リーダーの判断で案2）。`windowImpl.ts` で、`http.proxy` も proxy の環境変数も無いときに、ウィンドウの session と app を `mode: 'direct'` にする。`http.proxy` を書けば従来どおりその proxy を使う。

単位の `edits.patch` にしなかった理由（docs/03 の5.3）: 単位のパッチは「自分の単位が消した部品への参照だけを直す」。WPAD は B-6 が消す部品（緊急の知らせ）とは関係が無く、何も消さない振る舞いの変更なので、削除以外の変更を置く `patches/` に入れた。B-6 を無効にしても WPAD は止まったままになり、単位どうしの独立も保てる。

以下は調べた結果。

- 起動時の流れ: `src/vs/platform/windows/electron-main/windowImpl.ts` の 1263〜1293行は、設定 `http.proxy`（ユーザーの値）か環境変数 `HTTPS_PROXY` などがあるときだけ `session.setProxy`・`app.setProxy` を呼ぶ。どちらも無いときは呼ばないので、Chromium は OS の設定を使う。Windows の「設定を自動的に検出する」が有効なら、WPAD を探して `wpad` を問い合わせる（0-5 の3環境すべてで出た）。
- Electron の `ProxyConfig` は、`mode` を書かず `pacScript` も無いと `fixed_servers` になる。`auto_detect` は `http://wpad/wpad.dat` の PAC を使う。何も設定しないときは、コマンドラインの指定が無ければ OS の設定を使う [一次] https://www.electronjs.org/docs/latest/api/structures/proxy-config
- 拡張ホストの通信も、本体の proxy の解決（`resolveProxy`）を通るので、同じ設定に従う見込み（推定）。git と Claude Code の CLI は別のプロセスで、Chromium の proxy の設定を使わない。
- 止め方の候補（2 を採った。比べは `tasks/2026-11-13-p2-units-b/units-b-notes.md` の5）:
  1. Windows の「設定を自動的に検出する」を切る（エディタの外。ほかのアプリにも効く）。
  2. 小さなパッチ: `windowImpl.ts` で、`http.proxy` も環境変数も無いときに `mode: 'direct'` を設定する。OS の手動の proxy の設定も無視するようになる。
  3. 起動の引数 `--no-proxy-server`（ショートカットに足す）。argv.json では渡せない（`src/mainImpl.ts` の 252〜267行の許可の一覧に無い）。

## 壊れたときの症状と戻し方

- 緊急の知らせは出なくなるだけで、ほかの機能への影響は無い見込み。戻すときは `enabled: false`。

## 未確認

- 型検査が通るか（ほかに `contrib/emergencyAlert` を import している所は `grep` で見つからなかった）。
- 自作のビルドの監査で `main.vscode-cdn.net` が出ないこと（`absentHosts`）。出たら、どのキーかを監査のネットのログで確かめる。

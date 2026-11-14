# A-5-remote-extensions

ポートの転送の組み込み拡張を消す（docs/03 の4節の段階 A。裁定でリモート開発は消す）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/tunnel-forwarding`（dev tunnels でローカルのポートを外へ転送する） |
| 一覧の行（removeLines） | `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の1件ずつ |

パッチは無い。

## 残すもの

- 本体のリモート（`contrib/remote`・`contrib/remoteTunnel`）のコード。C-3 で消す。
- テスト用の `extensions/vscode-test-resolver`。`build/lib/extensions.ts` の `excludedExtensions` にあり同梱されないので残す（`builtin/keep.json`）。

## 影響しうるもの

- **ポートのビュー（パネルの「ポート」、ビューの ID `~remote.forwardedPorts`）も出なくなる。** 本体は、`onTunnel` の起動のきっかけを持つ拡張があるときだけ、ローカルのウィンドウでポートのビューを有効にする（`src/vs/workbench/services/remote/common/tunnelModel.ts` の `extensionHasActivationEvent`。見つかれば context key `forwardedPortsViewOnlyEnabled` を true にする。`contrib/remote/browser/remoteExplorer.ts` の `ForwardedPortsView.enableForwardedPortsFeatures` がその key を見てビューを登録する）。1.146.0 の組み込み拡張で `onTunnel` を持つのは `tunnel-forwarding` だけなので、消すとビューが登録されない。関門で、A-4 の版にあった `~remote.forwardedPorts.*`・`~remote.forwardedPortsContainer*` のコマンド7件が A-5 の版で無くなった（`records/take-in/1.146.0-p2-A-5/gate-A-5-remote-extensions.md` の2節）。
  - 扱い: 受け入れる（2026-11-14 のリーダーの判断。`docs/user-decisions.md` の「Phase 2 の関門で出た点」）。リモートは裁定で C-3 で消すので、ポートのビューも要らない。
  - C-3 の `checks.absentViews` の `~remote.forwardedPorts` は、A-5 を当てた版ではもう無いので、C-3 の効き目の証拠にはならない（公式の zip では在る）。
- dev tunnels の転送ができなくなる。
- 外向きの通信（dev tunnels の宛先）が減る見込み。拡張は起動を待つ（`activationEvents` は `onTunnel` だけ）ので、普段は通信していない見込み（推定）。

## 消えたことの検査（checks）

- `absentCommands` の2件（`tunnel-forwarding.showLog`・`tunnel-forwarding.restart`）は **manifest の網**（`extensions/tunnel-forwarding/package.json` の `contributes.commands`）で見る。拡張は `onTunnel` でしか起動しないので、実行時の網では公式でも「無い」になる（関門の記録の2節）。
- 実行時の網として、`absentViews` に `~remote.forwardedPorts` を足した（2026-11-14）。上のとおりこの単位で消える。2026-11-14 までの公式の zip の実行と A-1〜A-4 の版の実行のすべてで `~remote.forwardedPorts.focus` が在り、A-5〜A-7 の版の実行で無い（`C:\b\smoke\absent\` の `snapshot.json`）。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| パネルに「ポート」が無い | 上のとおり想定どおり | 要るなら `enabled: false` にする（C-3 で本体ごと消す予定） |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 未確認

- 起動時に、本体がトンネルの提供者を探してエラーを出さないか（スモークの base の開発者ツールのコンソール）。関門の4（2回）では新しい誤りは無かった。

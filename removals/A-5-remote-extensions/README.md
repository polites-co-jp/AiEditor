# A-5-remote-extensions

ポートの転送の組み込み拡張を消す（docs/03 の4節の段階 A。裁定でリモート開発は消す）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/tunnel-forwarding`（dev tunnels でローカルのポートを外へ転送する） |
| 一覧の行（removeLines） | `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の1件ずつ |

パッチは無い。

## 残すもの

- 本体のリモート（`contrib/remote`・`contrib/remoteTunnel`、ポートのビュー）。C-3 で消す。
- テスト用の `extensions/vscode-test-resolver`。`build/lib/extensions.ts` の `excludedExtensions` にあり同梱されないので残す（`builtin/keep.json`）。

## 影響しうるもの

- ポートのビューの「ポートを転送」で、dev tunnels の転送ができなくなる。本体のポートのビューは C-3 まで残る。
- 外向きの通信（dev tunnels の宛先）が減る見込み。拡張は起動を待つ（`activationEvents` は転送を始めたとき）ので、普段は通信していない見込み（推定）。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| ポートのビューで転送を選ぶとエラー | 提供者が無い | 想定どおり。C-3 でビューごと消す |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 未確認

- 起動時に、本体がトンネルの提供者を探してエラーを出さないか（スモークの base の開発者ツールのコンソール）。

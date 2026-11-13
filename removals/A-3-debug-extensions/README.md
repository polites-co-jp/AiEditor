# A-3-debug-extensions

デバッグの組み込み拡張を消す（docs/03 の4節の段階 A）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/debug-auto-launch`（Node.js の自動アタッチ。`onStartupFinished` で毎回起動する）、`extensions/debug-server-ready`（`serverReadyAction`。`onDebugResolve` で起動） |
| 一覧の行（removeLines） | `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の2件ずつ |
| product.json | `builtInExtensions` を `[]` にする（js-debug 系3件: `ms-vscode.js-debug-companion`・`ms-vscode.js-debug`・`ms-vscode.vscode-js-profile-table`。ビルドのときに GitHub から取得して同梱される）。**この単位ではなく `product.overlay.json` の `set` で行う**（docs/02 の3節の表の「set（A-3）」）。下の注 |

パッチは無い。

### builtInExtensions を productRemove にしない理由

`unit.json` の `productRemove` はキーを消す。`builtInExtensions` のキーを消すと、`build/gulpfile.vscode.ts` の `product.builtInExtensions.filter(...)`（160行目）と `build/gulpfile.reh.ts`（291行目）が `undefined` を読んで止まる（1.146.0 で確かめた）。`[]` を入れる必要があり、unit.json にはキーに値を入れる項目が無い。そのため docs/02 のとおり overlay の `set` に置く。

`checks.absentStrings` の `{ "in": ["product.json"], "text": "ms-vscode.js-debug" }` は、overlay に `builtInExtensions: []` が入っていることを確かめる（入っていなければこの単位の検査が落ちる）。

初めの試し（`tasks/2026-11-13-p2-units-a/trial/checks.json`）では overlay に `builtInExtensions` が無く、この検査が2件の当たりで落ちた。2026-11-14 に overlay の `set` に `builtInExtensions: []` が入り、2回目の試し（`trial/checks-2.json`）で `ok` になった。

## 残すもの

本体のデバッガ（`contrib/debug`）と拡張 API の `vscode.debug`（C-2 で消す。`vscode.debug` は何もしない実装で残す）。

## 影響しうるもの

- JavaScript / TypeScript のデバッグ（js-debug）ができなくなる（裁定でデバッガを消すので想定どおり）。
- 起動時の拡張ホストの読み込みが1つ減る（`debug-auto-launch` は `onStartupFinished`）。
- PowerShell 拡張（台帳）は自分のデバッガを持つ。この単位では本体のデバッガを残すので影響しない。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| ビルドで js-debug を GitHub から取りに行く | overlay に `builtInExtensions: []` が無い | overlay の `set` に足す（p2-units-b・リーダー） |
| 起動時に `extension.node-debug.toggleAutoAttach` を探すエラー | 本体のどこかがコマンドを呼ぶ | 1.146.0 の `src` には呼ぶ所が無い（grep で0件）。出たら報告する |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 未確認

- ビルドの出力の `resources/app/extensions` に `ms-vscode.js-debug*` が無いこと（overlay が入った後。docs/02 の4節の7の後処理）。

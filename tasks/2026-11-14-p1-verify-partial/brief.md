# Phase 1 の途中の検証: 本家 1.146.0 のビルドが落ちる原因と、Smart App Control が起動を止める事実

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-14
- 状態: 完了

## 目的

蒙恬が Phase 1 のビルドを再開し、依存の導入と型検査は通ったが、パッケージ化が copilot の不具合で落ち、落ちる前の出力は Smart App Control に止められて起動しなかった、と報告した。ユーザーに2つの判断（Smart App Control、copilot の不具合の扱い）を諮るので、その前提の事実を作った人と別の目で確かめる。

## 入力

- `tasks/2026-11-13-p1-build-upstream/`（brief.md、handoff-notes.md、build-log.md の5節、doc-corrections.md の「追記（2026-11-14）」、build-record-*.json、disk-*.json、launch-check-partial.json、ci-events.json、env-check-*.json）
- ログ: `C:\b\logs\1.146.0-upstream\`、`C:\b\logs\1.146.0-upstream-r2\`
- 本家のソース（読むだけ）: `C:\b\wt\1.146.0\build\.moduleignore`、`build\lib\copilot.ts`、`build\lib\extensions.ts`、`build\gulpfile.vscode.ts`
- 落ちた時点の出力: `C:\b\wt\VSCode-win32-x64\`
- 新しい台本: `scripts/disk-usage.mjs`、`scripts/p1-launch-check.ps1`、`scripts/p1-ci-events.ps1`、`scripts/check-env.ps1` の差分

## やること

1. **copilot の不具合**: 記録とログで、`package-win32-x64` が通り、`prepareCopilotRipgrepShimTask` が「Copilot SDK directory not found」で落ちたことを確かめる。原因の行（`.moduleignore` の `@github/copilot/**` と `copilot.ts` の sdk の確かめ）を本家のソースで確かめる。PR #347312 が直したという記述を出典で確かめる。
2. **Smart App Control**: `check-env.ps1` の `smartAppControl` と `p1-ci-events.ps1` の出力（イベント 3077、`VerifiedAndReputableDesktop`、`winregistry.node`）で、起動が止められた事実を確かめる。出力を起動し直して再現できるなら、`p1-launch-check.ps1 -Root C:/b/wt/VSCode-win32-x64 -Dest C:/b/p1/<新しい名前>` で1回だけ再現する。
3. **記録の確かめ**: 所要時間・ディスク・出力の形（`resources\app` が直下、`Code - OSS.exe`）が記録と一致するか。6つの `pnpm-lock.yaml` が変わっていないか（`git -C C:/b/wt/1.146.0 status`）。普段使いのエディタのデータに触れていないか。
4. **新しい台本のレビュー**: 読むだけで害が無いか（書き込み先、子のプロセスの環境変数の扱い）。テストは曹参が並行して書く（`tasks/2026-11-14-p1-tests-scripts/`）。届いていれば `node tests/run-all.mjs` を走らせて件数を書く。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない（再現は起動の1回だけ）。
- Smart App Control などの PC の守りの設定を変えない。

## 完了条件

- 1〜4 に合否と理由がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）

## 結果

1〜3 の前提の事実は合格（copilot の落ちる場所と原因、Smart App Control の阻止、所要時間・ディスク・出力の形）。4 は不合格（`p1-ci-events.ps1` が日本語の Windows でイベントが無いとき `readable: false`。run-all fail 1）。直しは `tasks/2026-11-14-p1-build-a1/` で蒙恬へ。

## 未解決

- 再現と直接の確かめに要る許可（`git -C C:/b/wt/* status`、p1 の台本と `check-env.ps1` の実行、Web、普段使いのデータの有無を読む）。ユーザーの承認と Team の開発部の対応が要る。

## 次の担当

リーダーが結果を添えて、ユーザーの判断（Smart App Control、copilot の不具合の扱い）に従って次を段取りする。

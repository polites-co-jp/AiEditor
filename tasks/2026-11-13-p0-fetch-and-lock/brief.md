# Phase 0 の材料の取得、0-1（Claude Code の manifest）、0-6（台帳の取得と検証）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

Phase 0（docs/07 の2節）の材料をそろえ、Claude Code 拡張の manifest とファイル一覧（0-1）と、台帳の拡張の取得と検証の手順（0-6）を確かめる。台帳の最初の版 `extensions.lock.json` を作る。

## 入力

- docs/07 の2.1（用意するもの。置き場所は `C:\b\p0\` に直した）、2.2（0-1）、2.7（0-6）
- docs/04 の2節（台帳に載せる拡張）、3節（台帳の形）、4節（検証の項目）
- docs/02 の2節（`scripts/lock-fetch.mjs`・`scripts/lock-verify.mjs` の位置づけ）
- docs/03 の9節（Claude Code 2.1.322 の manifest の値。0-1 で比べる）
- docs/sources/research-extensions-services.md（Open VSX の API、Claude Code の配布物）

## やること

1. 材料の取得（スクリプトにする。例 `scripts/p0-fetch.mjs`。展開は PowerShell の台本でよい）
   - 本家 VS Code 1.146.0 の Windows x64 zip を `C:\b\p0\vscode-1.146.0\` に展開する。版を指す URL（`https://update.code.visualstudio.com/1.146.0/win32-x64-archive/stable` の見込み）が正しいかを確かめ、zip の SHA-256 を記録する。1.146.0 より新しい安定版が出ていても 1.146.0 を使い、最新の版を記録に書く。
   - VSCodium の Windows x64 の zip の最新を `C:\b\p0\vscodium-<版>\` に展開する。版と SHA-256 を記録する。
2. 台帳の拡張の取得（`scripts/lock-fetch.mjs`）
   - docs/04 の2節の全部（.env は `dotenv.dotenv-vscode` と `weixu.wx-vsce-dotenv` の両方）の VSIX・`.sha256`・`.sigzip`・公開鍵・manifest を `C:\b\p0\vsix\` に取る。
   - 版は Open VSX の今の最新を見る。docs/04 の版より新しく、公開から72時間以上たっていればその版を使い、たっていなければ docs/04 の版を使う（裁定: 寝かせる期間）。docs と違う版にしたら、成果物にその差を書く（リーダーが docs を直す）。
3. 0-1: docs/07 の2.2 の表（manifest の項目と 2.1.322 との比較、VSIX のファイル一覧の実行ファイル・主なフォルダ・サイズ）。**JS の中身は開かない**（裁定）。
4. 0-6: docs/07 の2.7 の1〜5 を、台帳のすべての拡張に対して行う `scripts/lock-verify.mjs` を作り、走らせる。
   - SHA-256 の照合、`npx ovsx verify-signature`（`-m` に何を渡すかを ovsx の README とヘルプで確かめる。通らなければ何が足りないかを書く）、Claude Code の同梱の CLI の SHA-256 と `https://downloads.claude.ai/claude-code-releases/<版>/manifest.json` の照合、`manifest.json.sig` の GPG の検証（指紋を照らす）、Authenticode、Defender の走査（`MpCmdRun.exe` の引数を確かめる）、Marketplace の同じ版のメタデータ（VSIX は取らない）。
   - 台帳の最初の版 `extensions.lock.json` を docs/04 の3節の形で書く。.env は2件とも載せ、どちらを残すかは 0-3 の後に決まると注記する。
5. 単体テストのための約束（曹参が同じ約束からテストを並行して書く。名前と形を変えない。変えるときは成果物に書く）
   - `scripts/lib/lock.mjs` に次の純粋な関数を置き、`export` する。
     - `validateLockEntry(entry)` → 誤りの文字列の配列（正しければ空）。docs/04 の3節の形に照らす。必須: `id`・`version`・`source`・`download`・`sha256`（64桁の16進の小文字）・`publishedAt`（ISO 8601）・`verified`・`engines`。`targetPlatform` は任意。
     - `isSoaked(publishedAt, now, { security })` → 真偽。公開から72時間以上たっていれば真。`security: true` なら常に真。
     - `satisfiesEngine(range, vscodeVersion)` → 真偽。`^x.y.z` と `>=x.y.z` を扱う。
     - `compareFileLists(prev, next)`（各要素は `{ path, size }`）→ `{ added, removed, changed, newExecutables }`。`newExecutables` は追加された `.exe`・`.dll`・`.node`。
     - `diffManifest(prev, next)` → 変わった項目の名前の配列。見るのは docs/04 の4節の5の項目（`contributes` の下は `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`debuggers`・`notebooks` が増えたかどうか）。

## 守ること

- 書き込みは自分の書き込み先（`scripts/`・`extensions.lock.json`・`tasks/`・`C:\b\` など）だけ。`records/` は大岡越前守が書くので書かない。
- 別の蒙恬（タスク `2026-11-13-p0-envs-mydist-keys`）が並行して `scripts/p0-env.ps1`・`scripts/p0-launch.ps1`・`scripts/convert-sublime-keys.mjs`・`scripts/lib/sublime-keys.mjs`・`extensions-src/mydist/` を書く。それらに触れない。
- 計測用のワークスペース（このリポジトリの `tmp\ws\`）は、ユーザーが `E:\develop\kuebiko` から clone する。触れない。

## 完了条件

- `C:\b\p0\` に本家 1.146.0 と VSCodium が展開され、台帳の全部の VSIX と検証の材料がある。
- `scripts/lock-fetch.mjs`・`scripts/lock-verify.mjs`・`scripts/lib/lock.mjs` があり、`node --check` が通る。
- `extensions.lock.json` が docs/04 の3節の形で、台帳の全部の拡張を持つ。
- 検証の各項目に、結果（通った・通らない・できなかった理由）がある。

## 成果物

このディレクトリに保存する。

- `fetch-log.md`: 取ったものの版・URL・SHA-256・置き場所。本家の最新の安定版。docs と違う版を使ったときの差。
- `claude-code-manifest.md`: 0-1 の下書き（大岡越前守が確かめて `records/phase0/` に清書する）。
- `lock-verification.md`: 0-6 の下書き（同上）。拡張ごと・項目ごとの結果と、決めた手順（`ovsx` の `-m`、Defender の引数、同梱の CLI の場所、manifest の platform の名前）。
- `doc-corrections.md`: docs と食い違った事実と、どう直すべきかの案（リーダーが docs を直す）。

## 結果

採用。本家 1.146.0 と VSCodium を `C:\p0\` に展開し、台帳の9件の VSIX と検証の材料を取った。`lock-fetch.mjs`・`lock-verify.mjs`・`lib/lock.mjs` と `extensions.lock.json`（9件）を作った。大岡越前守の検証で、Claude Code の寝かせる期間を除いて合格（records/phase0/claude-code-manifest.md・lock-verification.md）。ソースのタグは参考の項目、ovsx は 1.4.0 に固定と裁定。

## 未解決

- Claude Code の寝かせる期間の確定と、固定した ovsx での確認（A-4）は `tasks/2026-11-13-p0-lock-final/` に引き継いだ。
- `audio-capture.node` の署名、Defender の走査が管理者の権限を要るか（急がない）。

## 次の担当

ooka-echizen（大岡越前守）: 検証し、`records/phase0/claude-code-manifest.md`・`records/phase0/lock-verification.md` を書く。

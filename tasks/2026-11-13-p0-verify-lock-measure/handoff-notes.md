# 大岡越前守からリーダーへの引き渡し（2026-11-13）

SubagentHandback は定義の tools に無く、フック（team/hooks/allowlist.js）に止められた。そのため、引き渡しの内容をここに書く。

## 判定
- **蒙恬（材料の取得、0-1、0-6、台帳）: 合格。** ただし台帳はまだ確定していない。必須の検証で落ちたのは Claude Code 2.1.322 の「公開から72時間」だけで、これは日本時間 2026-11-13 11:30:52 に満ちるので「時間待ち」として記録した。私の検証は日本時間 05:30 ごろに走らせたので、`--write-lock` はまだ付けていない。
- **曹参の単体テスト4本: 合格。**
- **曹参の `measure.ps1`・`netaudit.ps1`: 差し戻し中。** 直った版でもう一度見る。差し戻しの理由に加えて、新しい不具合（下の B-1）を1件見つけた。

## 確かめた成果
- 蒙恬: `scripts/lock-*.mjs`、`scripts/lib/{lock,zip,http}.mjs`、`p0-fetch.mjs`、`p0-expand.ps1`、`extensions.lock.json`、`C:\b\p0\` の材料、下書き4本。
- 曹参: `scripts/measure.ps1`、`scripts/netaudit.ps1`、`tests/`、設計の文書と試しの出力。

## 根拠
- **`node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0`**: 終了コード 1。
  - Claude Code は `failed: ["soak"]` だけ（`now` は 2026-11-12T20:30:15Z）。
  - ほかの8件は全部通った。
  - 項目ごとの結果は蒙恬の下書きと全部同じだった。
- **`sha256sum`**: 9件の VSIX、同梱の claude.exe、本体の zip 2件の計12件が、台帳・`.sha256`・release の manifest.json・fetch-log と全部一致した。
- **0-1**: package.json・vsixmanifest・files.json を自分で読んで数え直し、下書きと一致した。JS の中身は開いていない。
- **台本のレビュー**:
  - 照合の相手は正しい。
  - 失敗やエラーは「通らない」として扱われている。
  - GPG は使い捨ての鍵束で検証している。
  - 書き込み先の外は変えていない（`git status`）。
- **テスト**:
  - `tests/measure.tests.ps1`: 73件全部通過
  - `tests/netaudit.tests.ps1`: 65件全部通過
  - `node tests/lock.test.mjs`: 64件全部通過
  - `node tests/sublime-keys.test.mjs`: 24件全部通過
  - `node --test tests/` は Node v24.16.0 で `Cannot find module '...\tests'` になり、終了コード 1。曹参の報告どおりだった。

## 直すべき点
**曹参（直しの依頼に足す）**
- **B-1（要修正）**: `measure.ps1` の25行目と `netaudit.ps1` の29行目にある `$Workspace` の既定値 `(Join-Path (Split-Path $PSScriptRoot -Parent) 'tmp\ws')` が原因。
  - Windows PowerShell 5.1 で `-File` で起動すると、`$PSScriptRoot` が空のまま評価され、`Split-Path` が落ちる。
  - 設計の文書に書いた使い方（`-Workspace` を省く形）では、計測も合否の比較も起動できない。`-Workspace` を渡せば動き、比較のモードは FAIL を正しく出した。
  - 直し方: 既定値は空にし、本体の先頭で決める。あわせて `-File` で起動する形のテストを足す。
- B-2: argv.json と `VSCODE_PORTABLE`（リーダーの連絡のとおり）。
- B-3: テストの冒頭の「Run: node --test tests/」の記述を直す。
- B-4: `validateLockEntry` のテストに `source`・`verified`・`engines` の形の誤りを足す。

**蒙恬（今回の結果は変わらない。取り込みを自動にする前に直す）**
- A-1: `checkOvsx` の判定 `/valid/i` は "invalid" にも一致する。
- A-2: `--skip` で飛ばした必須の項目があっても `ok: true`・終了コード 0 になる。
- A-3: `--write-lock` は、検証を通らなかった行も台帳に書く。
- A-4: `npx ovsx` の版を固定する。

**リーダーの判断・依頼が要る点**
1. 11:30:52 以降に `node scripts/lock-verify.mjs --dir C:/b/p0/vsix --vscode 1.146.0 --only anthropic.claude-code --write-lock extensions.lock.json` を走らせ直すよう依頼してほしい。結果は records/phase0/lock-verification.md に足す。それまで台帳の Claude Code の行は `checks.soak: "fail"` のままで、確定していない。
2. ソースのタグが無い3件（weixu.wx-vsce-dotenv、tomoki1207.pdf、言語パック）の扱い。docs/04 の4節の3を満たしていない。
3. `node --test tests/` の許可の書き方を直すこと（ユーザーの承認が要る）。
4. SubagentHandback の許可。
5. `tasks/2026-11-13-p0-measure-netaudit-tests/brief.md` が変更済みになっているが、これは私の変更ではない。

## 記録
- records/phase0/claude-code-manifest.md
- records/phase0/lock-verification.md
- tasks/2026-11-13-p0-verify-lock-measure/verification-log.md（詳細）
- tasks/2026-11-13-p0-verify-lock-measure/trial/compare-same/verdict.md・verdict.json
- C:\b\p0\vsix\verify-result.json（lock-verify が上書きした）

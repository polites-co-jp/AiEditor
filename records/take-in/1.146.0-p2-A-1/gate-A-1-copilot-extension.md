# 関門の記録: A-1-copilot-extension（版 `1.146.0-p2-A-1`。土台を兼ねる）

- 検証: 大岡越前守、2026-11-14（JST 22:04〜22:13）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-1.zip`（SHA-256 `fa6d0036…d427`。検証役が `sha256sum` で計算し直し、builds.md と一致）を蒙恬が展開した `C:\b\p2\1.146.0-p2-A-1\Shuko-win32-x64-1.146.0-p2-A-1\`（Shuko 1.146.0 / `3f478e8b…c684`）
- 比べる相手: 公式の zip の基準 `C:\b\smoke\baseline-official-1.146.0.json` と Phase 1 のスモーク `records/phase1/smoke-built-1.146.0-p1-a1-r3.md`。この版は Phase 1 と違い、上書き・patches 20・30・assets・mydist・notion-sync が当たっている

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`。A-1 の delete 2・removeLines 8/8・edits 衝突なし。検査は remnants・absentStrings（5項目とも 0 件）・unclassifiedExtensions・registeredKeys・lockfile・commitIdentity が ok |
| 2. 型検査とビルド | **合格** | install・lockfile・typecheck（`build-record-install.json`）と package・postprocess・zip（`build-record.json`）がすべて ok・終了コード 0。product.json の commit `3f478e8b…` = 作業ツリーの HEAD（`sourceVersion.value`、`checks.json` の `headCommit`、展開した product.json の 188 行） |
| 3. 消えている | **判定できない** | 台本の網が働かない（2節）。拡張のフォルダと ID の文字列は出力に無い（静的には消えている） |
| 4. 壊れていない | **合格**（A-1 の単位として） | 3回とも PASS 48 / FAIL 1（errors.new）。新しい誤り 5 件のうち 3 件は Phase 1 で仕分け済み、2 件は notion-sync（土台の部分）が出す。claude-code の組は3回とも3項目 PASS（3節） |

単位を `enabled: true` にする条件（4つとも合格）は、3 が判定できないため**まだ満たしていない**。

## 1. 当たる・型検査とビルド（記録で確かめた）

- `tasks/2026-11-14-p2-builds/1.146.0-p2-A-1/checks.json`: `result: ok`、`errors: []`、`warnings: []`。上書き 18 キー、patches 20・30 は衝突なし、assets 8 ファイル、mydist（3 ファイル）・notion-sync（4 ファイル）を写した。コミットの作者はすべて `shuko-apply <apply@shuko.invalid>`
- 本家が足した部品・依存の変化は `--prev-tag` が無いので skipped（初めの版なので比べる前のタグが無い。条件の外とした）
- `lockfile.diff` の差分は `extensions/copilot/pnpm-lock.yaml` の削除だけ（`diff --git` の見出しが1つ）
- `typecheck.log` は `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck` の1行で、誤りの出力なし。`package.log` の拡張の型検査はどれも `with 0 errors`
- 後処理: 組み込み拡張 91、消え残り 0、keep.json の不足 0。`copilot`・`prompt-basics` は出力に無い（`resources\app\extensions\{copilot,prompt-basics}\package.json` は Glob で 0 件）

## 2. 消えている

### 実行したこと

```
node tests/absent-run.mjs --units A-1-copilot-extension --expect present --label p2-A-1-official-present      # 公式の zip
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-1/Shuko-win32-x64-1.146.0-p2-A-1 --units A-1-copilot-extension --expect absent --label p2-A-1
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-1/Shuko-win32-x64-1.146.0-p2-A-1 --expect absent --setting zzzShukoControl.never.registered --cmd zzzShukoControl.never.registered --setting editor.fontSize --label p2-A-1-control
```

（`tests/removals/run-absent.mjs` を直接呼ぶ形は許可に無く止められた。許可の形 `node tests/*.mjs` で呼べる包み `tests/absent-run.mjs` を使った。中身は同じ `main()`）

| 項目 | 公式（present） | A-1（absent） |
|---|---|---|
| absentCommands `github.copilot.cli.sessions.delete` | **無い**（fail） | 無い（pass） |
| absentCommands `github.copilot.chat.triggerPermissiveSignIn` | **無い**（fail） | 無い（pass） |
| absentSettings `github.copilot.chat.backgroundAgent.enabled` | 在る（pass） | **在る**（fail） |
| 対照: 登録されていない設定 `zzzShukoControl.never.registered` | — | **在る**（fail） |
| 対照: 登録されていないコマンド `zzzShukoControl.never.registered` | — | 無い（pass） |

結果: `C:\b\smoke\absent\p2-A-1-official-present-20261114T130434\`、`p2-A-1-20261114T130554\`、`p2-A-1-control-20261114T130636\`（それぞれ `absent-result.json`・`snapshot.json`）

### 網が働かない理由

1. **absentSettings の検査は、どのキーでも「在る」を返す**（曹参の `tests/removals/probe/extension.js` の15行）。`vscode.workspace.getConfiguration().inspect(key) !== undefined` で見ているが、拡張ホストの `inspect` は登録の無いキーにも中身の空のものを返す。対照の、どこにも登録の無い `zzzShukoControl.never.registered` が「在る」になった。消えたかどうかを区別できない。
2. **absentCommands の2件は、公式でも取れない**（蒙恬の `removals/A-1-copilot-extension/unit.json` の `checks`）。検査は `vscode.commands.getCommands(true)`（実行時に登録されたコマンド）を見る。公式の zip の実行では、copilot の拡張が `vscode.extensions.all` に出ず（`snapshot.json` の拡張の一覧に copilot の名前を含むものは無い。`vscode.prompt` はある）、2件のコマンドも登録されていなかった。公式でも「無い」ので、A-1 での「無い」は消えたことの証拠にならない。2件は manifest で `commandPalette` の `when: false` でもある（パレットに出ない）。

### 静的に確かめたこと（参考。関門の判定には使わない）

- 2件のコマンド ID と設定キーの文字列は、展開した `resources\app` のどこにも無い（Grep で 0 件）。公式では `extensions\copilot\package.json` にある
- A-1 の実行の `snapshot.json` の拡張の一覧に、copilot・prompt の名前を含むものは無い

### 直す必要があるところ

- 曹参: probe の設定の見方。例: `inspect(key)` の `defaultValue` も見る、または `vscode.extensions.all` の `packageJSON.contributes.configuration` の properties と照らす。直した後、対照の登録の無いキーが「無い」になり、公式で `github.copilot.chat.backgroundAgent.enabled` が「在る」になることを確かめる
- 曹参（または蒙恬と相談）: コマンドの検査は、実行時の登録だけを見ている。拡張が起動しないと「在る」を取れない。拡張の manifest の `contributes.commands` も「在る」に数えるか、公式で実行時に登録されるコマンドを `checks` に選ぶ
- 蒙恬: A-1 の `absentCommands` を、公式の実行で「在る」になるものにする（上の直しの後に `--expect present` で確かめる）

## 3. 壊れていない

### 実行したこと

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-1/Shuko-win32-x64-1.146.0-p2-A-1 --label p2-A-1 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --save-baseline C:/b/smoke/baseline-p2-A-1.json --timeout 300
（同じ引数で --label p2-A-1-b2 / p2-A-1-b3、--merge-baseline を足して2回）
```

Phase 1 の r3 と同じ引数（`--build`・`--label` と、基準の保存の2つが違う）。3回の和を、次の版と比べる基準 `C:\b\smoke\baseline-p2-A-1.json`（3回分、鍵 5 個）にした。

| 実行 | 置き場所 | 結果 |
|---|---|---|
| 1 | `C:\b\smoke\runs\p2-A-1-20261114T130741\` | PASS 48 / FAIL 1 / INFO 9 |
| 2 | `C:\b\smoke\runs\p2-A-1-b2-20261114T130943\` | PASS 48 / FAIL 1 / INFO 9 |
| 3 | `C:\b\smoke\runs\p2-A-1-b3-20261114T131126\` | PASS 48 / FAIL 1 / INFO 9 |

FAIL は3回とも errors.new だけ。ほかの項目（base・languages・safety）は3回とも PASS。

### claude-code の組

3回とも3項目 PASS: `claude.running`（isActive、2.1.322）、`claude.exthost-log`（`_doActivateExtension Anthropic.claude-code`）、`claude.lock`（3個。ideName は Shuko、authToken あり、ログの MCP の port と一致。後始末で自分のものだけ消した）。パネルからの送信はしていない。

### errors.new の 5 件の仕分け（3回とも同じ5件）

| 件数 | 誤り | 仕分け |
|---|---|---|
| 2 | [other] remoteTunnelService.log `Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json` | Phase 1 の r3 にもある。product.json にトンネルの設定が無いビルドの形 |
| 1 | [exthost] Claude Code `Remote Control auto-enable failed: Error: Remote Control initialization failed` | Phase 1 の r3 にもある（A-1 でセカンダリサイドバーに Claude Code のビューが出て `claude.exe` が起動するときだけ出る、と r3 で仕分けた） |
| 2 | [exthost] exthost.log `No bundle location found for extension shuko.notion-sync`（window1・window2 で各1） | **土台の部分（notion-sync）が出す新しい誤り**。A-1 の単位の範囲の外 |

notion-sync の誤りの根拠: 出力の `out\vs\workbench\api\node\extensionHostProcess.js` の `initializeLocalizedMessages` は、表示の言語が既定（英語）でなく、拡張が組み込み（`isBuiltin`）で、翻訳の束が見つからないときにこの誤りを書く。notion-sync は組み込みとして入り、日本語の言語パックに翻訳が無い。誤りの直前の行で notion-sync は `onStartupFinished` で起動している。起動の後に notion-sync 自身の誤りは無い（トークンを使う動作は、このスモークの範囲の外）。

Phase 1 の r3 と比べて、ほかに違ったこと（誤りには数えられていない）:
- 拡張の数が 13 → 11（動作中 7 → 8）。上書きの `builtInExtensions: []` で js-debug 系が入らず、notion-sync が増えた（build-log の 3.1）
- 公式の基準にある `TextModel got disposed before DiffEditorWidget model got reset` と `[DEP0169] url.parse()` は今回も出た
- 止める直前のプロセスの木は 25 個（Shuko.exe x21、claude.exe x1、OpenConsole.exe x1、pwsh.exe x1、conhost.exe x1）で r3 と同じ形

判定: A-1 の単位が足した誤りは無い（新しい 5 件のうち 3 件は Phase 1 で仕分け済み、2 件は土台の notion-sync）。**A-1 の単位として合格。** notion-sync の誤りは土台の不具合として報告する（4節）。

## 4. 指摘（A-1 の合否とは別）

- 蒙恬（notion-sync）: 日本語の表示で、組み込みの notion-sync が起動のたびに拡張ホストのログに `[error] No bundle location found` を出す。後の版の比べは、この誤りを含めた基準 `baseline-p2-A-1.json` で行うので、以降の版では「新しい誤り」にならない。直すか、残すかの判断はリーダーへ
- `C:\b\smoke\runs\` の実行の置き場所に `.keep` を置けなかった（検証役の書き込み先は `records/`・`tasks/` だけ）。後の実行は `--keep-runs 40` で走らせ、ここに挙げた置き場所が消えないようにした
- 手の項目（パネルからの送信、統合ターミナルの `claude` の接続、選択範囲、差分、診断、テーマ・Sublime のキー）は台本の範囲外。Phase 2 の最後にユーザーが行う

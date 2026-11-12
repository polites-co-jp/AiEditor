# テストの一覧と結果（2026-11-13）

## PowerShell（Windows PowerShell 5.1。実機なしで計算を確かめる）

再差し戻し後の最新（B-5・役割・B-6・B-7・O-3 を直した後）:

```
powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1     -> passed: 114  failed: 0
powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1    -> passed: 67  failed: 0
node tests/lock.test.mjs                                                          -> tests 115  pass 115  fail 0
node tests/sublime-keys.test.mjs                                                  -> tests 50  pass 50  fail 0
```

足したテスト:
- measure.tests.ps1 +26: B-6（拡張子なしの `jsonServerMain`、メインは `main` のまま）、役割の付け直し（`--inspect-port=0` = 拡張ホスト、子 copilot-runtime = agent-host、子 OpenConsole/シェル = ptyHost、子 file-watcher のみ = shared-process、手がかりなしは utility-node のまま、`--inspect-port=1234` は印にしない、優先順、CSV の行への反映、空）、B-5（`a,b` の1文字列の分割、配列、相対パスと空白と引用符、存在しないファイル、2つでない、ディレクトリ、TS と Python でない警告、引数行、ws-info.json の既定）、**`powershell -File` で `-OpenFiles "a,b"` を渡す4件**（2つとして受け入れられる、2つ目の欠落が単独のパスで報告される = 分かれている、3つで止まる、netaudit も同じ）。
- netaudit.tests.ps1 +2: 付け直した役割（RoleMap）の使用、初出の秒数が渡された値であること。
- lock.test.mjs +36（O-3）: `isOvsxSuccess`（本物の出力、invalid、終了コード、空・非文字列、直前が英字）、`judgeChecks`（全部通る、飛ばした、失敗・error・他・欠落、並び順、必須でないもの、混在）、`mergeLock`（ok は書く、失敗は今の行を残す、無ければ省く、ID の大文字小文字、後ろに残る行、順、重複 ID、entry がオブジェクトでない、current の非オブジェクト、引数を変えない、試しの例）、`checkPinnedTool`（同じ版、違う版、`^`・`~`・`>=`・`latest`・空・`1.4`・`*`、installed が無い、declared が無い）。蒙恬の実装に対して全部通った。
- sublime-keys.test.mjs +23（T1。上の追記）。

以前の記録（差し戻し後の最新だった時点）:

```
powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1     -> passed: 88  failed: 0
powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1    -> passed: 65  failed: 0
node tests/lock.test.mjs                                                          -> tests 79  pass 79  fail 0
node tests/sublime-keys.test.mjs                                                  -> tests 27  pass 27  fail 0
```

差し戻しで足したテスト:
- measure.tests.ps1 +15: 起動の引数の組み立て（`<User>\user-data`）、`VSCODE_PORTABLE` が子にだけ見えて自分の環境が戻ること（未設定・設定済みの両方）、`ELECTRON_RUN_AS_NODE`・`VSCODE_*` が子に見えず戻ること、ポータブルの配置でのメイン検出、普段使いの `argv.json` が作られた・書き換わったことの検出、`p0-env.json` の読み取り、copilot-runtime の役割、`Get-DefaultWorkspace`、**`powershell -File` で `-Workspace` を省いて起動する4件**（比較モードの合格 = 終了コード 0 と verdict.md、不合格 = 1 と verdict.md、計測モードと netaudit が自分の検査まで進むこと。B-1）。
- lock.test.mjs +15（B-4）: `source`（数値・空・null・未知の店）、`verified`（"true"・1・null・オブジェクト。false は有効）、`engines`（数値・空・版なし・オブジェクト・null。`>=1.94.0` は有効）。
- sublime-keys.test.mjs +3: 蒙恬が足した規則（キーが `none` なら落とす、`win: 'none'` は `key` に戻らない）と、`sublime-keys.md` の例。
- B-3: 2本の node テストの先頭の「Run:」を `node tests/<名前>.mjs` に直した。

実装に対する結果: 蒙恬の実装は全部通った。`none` と `args` の規則は docs/04 の6.2 に無い追加だが、docs の規則（「win があればそれ、無ければ key」）をそのまま `none` に当てると `none` という名のキーへの割り当てを作るので、追加規則のほうが6.2 の意図（Windows で効く割り当てだけを写す）に合う、と読む。docs の6.2 に足すのが妥当（蒙恬の doc-corrections.md の6節と同じ）。食い違いは無い。

以下は初回（差し戻し前）の記録:

```
powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1     -> passed: 73  failed: 0
powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1    -> passed: 65  failed: 0
```

終了コードは落ちた数。

`tests/measure.tests.ps1`（`scripts/measure.ps1` を読み込む）
- 両台本の構文の誤りが無いこと、ASCII のみであること（5.1 の文字化け防止）
- 役割の判定 27件（renderer、gpu、ユーティリティの種類、拡張ホスト、ptyHost、tsserver、言語サーバー、claude、シェル、無印のメイン、その他）、コマンドラインが null
- 子孫の集め方: 親子孫、別の木を含めない、部分木、未知の根、複数の根、循環、PID の再利用（親より古い子）、CreationDate なし
- claude.exe の子孫の分け方: 分離、claude なし、入れ子の claude
- 合計: プライベートバイト・ワーキングセットの「含めた / 含めない」、空、4 GiB 超
- 中央値（奇数・偶数・1件・空・順不同・重複）、範囲（最大 - 最小）
- 合否: 大きく減る、範囲より小さく減る（合格・範囲内の印）、1バイト減る、等しい（不合格）、増える、最良の1回でなく中央値で決める、空で例外
- メイン検出（別のデータの置き場所、普段使いのエディタを拾わない、大文字小文字）、データの置き場所の安全確認（`%APPDATA%\Code`、`~\.vscode` を拒否）
- tasks.json の folderOpen の確認、`runs.csv` の読み取り（捨てた回を数えない）、比較モードの出力

`tests/netaudit.tests.ps1`（`scripts/netaudit.ps1` を読み込む）
- IP の正規化（IPv4 マップ、スコープ ID、省略形）、ループバック・未指定の除外
- DNS の結びつけ: A、CNAME 連鎖の順序、型の数字・名前、小文字化と末尾のドット、未知の IP、重複、CNAME の循環、他の型
- 子孫の接続の絞り込み（PID、ループバック、Established のみ）
- 観測: 初出の保持、回数はサンプル単位、claude の分離、プロセスと役割、終了済み PID
- 許した一覧: 例のファイルが正しい、ファイル無し、壊れた JSON、形の検査（10件の不正）、ホストの一致（ワイルドカードは頂点と似た名前を通さない）、ポート・プロセスの制限、別名どちらでも一致、IP リテラル
- 宛先の行: 同じホストの複数 IP の統合、並び、unresolved、claude グループ、一覧にないもの、新しい宛先（前回なし、あり、IP 違い、空の前回）、audit.md、前回の一覧の読み戻し

## node（蒙恬の部品。仕様と依頼書の約束から書き、実装は読まずに書いた）

`node --test tests/` は Node 24 ではフォルダを受け付けず（`Cannot find module '...\tests'` で落ちる）、許可の書き方（`node --test tests/`）に合う形ではファイルを渡せない。許可にある `node tests/*.mjs` の形でファイルごとに走らせた（node:test の出力が出る）。

```
node tests/lock.test.mjs            -> tests 64  pass 64  fail 0
node tests/sublime-keys.test.mjs    -> tests 24  pass 24  fail 0
```

`tests/lock.test.mjs`: `validateLockEntry`（正常、任意の `targetPlatform`、必須8項目の欠落、sha256 の6種の不正、publishedAt の不正とオフセット付き、非オブジェクト、引数を変えない）、`isSoaked`（72時間ちょうど = 真、1ms 前 = 偽、1ms 後 = 真、security、オプション省略、オフセット）、`satisfiesEngine`（`^`・`>=`、境界、次のメジャー、1.100 と 1.94 の数値比較）、`compareFileLists`（追加・削除・サイズ変更、新しい .exe/.dll/.node、大文字小文字、既存の実行ファイルは新規でない、名前に exe/node を含むだけは除く）、`diffManifest`（同一は空、版や説明は見ない、5項目、`contributes` の6項目の出現・増加・不変）。

`tests/sublime-keys.test.mjs`: `convertKeybindings`（win 優先、無ければ key、mac/linux/win を出力に残さない、when・args の保持、順序、空、デバッグ系の項目を落とす、入力を変えない）、`findConflicts`（when が両方無い / 同じ = 衝突、片方だけ・違う = 衝突でない、大文字小文字、修飾キーの順、`ctrl+k` と `ctrl+shift+k`、和音 `ctrl+k ctrl+c`、複数、空、Claude Code の既定キーとの例）。

## 実機の試し（身代わりのエディタ）

measure-design.md と netaudit-design.md の「試しの結果」にある。出力は `trial/` 以下（`out-a`、`net-a`、`net-b`、`verdict-a`）。

## 補助

- `tests/probe-dns.ps1`: テストではなく診断。`Get-DnsClientCache` が空になる件の確認に使った。
- `tests/fixtures/`: 例の許可一覧、身代わりのエディタ（`fake-editor.cmd`、`fake-net-editor.cmd/.ps1`）。`fixtures/probe-dns.ps1` は空（許可の書き方が `tests/*.ps1` のため `tests/` 直下へ移した跡）。

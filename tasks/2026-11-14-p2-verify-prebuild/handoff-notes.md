# 報告: Phase 2 の検証（ビルドの前の分）

- 担当: 大岡越前守 → ヴラド・ツェペシュ（2026-11-14）
- 詳しい記録: `verification-log.md`（2回目は6節）

## 追記3（3回目。signtool.exe の確かめ）

### 判定

**合格。** 対象は、蒙恬の `scripts/check-env.ps1`・`scripts/build.mjs`（`findSignTool`・`prependPath`）と、曹参の `tests/signtool.test.mjs`（17件）。仕様は `tasks/2026-11-13-p2-build-switch/handoff-notes.md` の追記5と、裁定（ビルドの道具はこの Windows にユーザーが入れる）。

| 観点 | 結果 |
|---|---|
| ユーザーの PATH を書き換えない | 合格 |
| 子のプロセスだけに足す | 合格 |
| 版の選び方 | 合格 |
| テストの期待が仕様どおりか | 合格 |
| `node tests/run-all.mjs` | 合格（1473件。pass 1452、fail 0、skip 21） |

### 確かめた版（SHA-256）

| ファイル | SHA-256 |
|---|---|
| scripts/build.mjs | 77eaffcf5c7d8b1e6e990ebff36bda5e890f22866d2df77a06f7965b181e26da |
| scripts/check-env.ps1 | c8d4ad7dbaa51a38774504887c8d3e9bf6f22efe024ab3f04b0c370ea391faf0 |
| tests/signtool.test.mjs | 41f7f3f5ea61d6231e9701ffa31eb59a534d5b30ffdcac45263473fc5d53e8c4 |
| tests/build/helpers.mjs | bbaa88969519c785e3306b6ae3dc206af1e01392660ba3596bdb7d08df5699b4 |
| tests/run-all.mjs | 24612a676fa1325e4024559e875249e89e0e05e19143258d111f4e5e32494a38 |

コミットの前に変わっていれば、検証をやり直す。

### 根拠（読んだ差分: `git diff scripts/build.mjs scripts/check-env.ps1`）

- **ユーザーの PATH を書き換えない**:
  - `check-env.ps1` は、`Get-Command`、`[Environment]::GetEnvironmentVariable('ProgramFiles(x86)')`、`Test-Path`、`Get-ChildItem` で読むだけ。PATH にも環境変数にもレジストリにも書かない。
  - `build.mjs` の `prependPath` は `{ ...env }` の写しを返す。元の `env` も `process.env` も変えない。build.mjs の中に、PATH を書く処理（`SetEnvironmentVariable`・レジストリ・`setx`）は無い。
- **子のプロセスだけに足す**:
  - `runPlanned(name, s, stepEnv = env)` に、package の手順だけが `prependPath(env, signtool.dir)` を渡す。
  - 足すのは、signtool が PATH に無く Windows Kits で見つかったときだけ。PATH にあるときは足さない（`pathPrepended: null`）。
  - ほかの手順（install・typecheck など）の環境は前のまま。
  - 見つからなければ、gulp を走らせる前に `fail` で止める。dry-run では止めずに `warnings` に書く。
- **版の選び方**:
  - PATH の上の `signtool.exe` を先に見る（PATH の順。引用符を外す。PATH の名前の大文字小文字は問わない）。
  - 無ければ `<ProgramFiles(x86)>\Windows Kits\10\bin\<x.y.z.w>\x64\signtool.exe` を見る。4つの数の名前だけを数として新しい順に並べ、exe のある最も新しい版を選ぶ。
  - `check-env.ps1` も同じ規則（`[version]` で並べる）。版を固定しないのは追記5に書いた方針どおりで、docs/02 の5節との合わせ方はリーダーが見る。
  - arm64 や x86 のフォルダは見ない（この PC は x64）。
- **テスト**: `tests/signtool.test.mjs` を読んだ。期待は、追記5の「テストの入口」の例と同じ値。
  - `findSignTool` の3つの例と、`prependPath` の2つの例。
  - 追加の期待: PATH の先が勝つ、PATH が Windows Kits より先、版は数で比べる（`10.0.9.0` より `10.0.22621.0`）、`wdf` と exe の無い版を除く。
  - `prependPath` に `process.env` を渡しても変わらないこと。
  - dry-run の `pathPrepended` と警告、check-env.ps1 の `chosen`・`source`・`missing`。
  - 実物の SDK を使わず、偽の `signtool.exe` と、試しの場所へ向けた `ProgramFiles(x86)`・`LOCALAPPDATA`・`--config` で走らせる。そのため実際の local.json や PATH には触れない（子の環境だけを変える。`tests/build/helpers.mjs` の `cleanEnv`）。
  - 試しの場所 `C:\b\tests-st-*` は、終わった後に残っていない（Glob）。
  - 軽い注: check-env.ps1 の「無いとき終了コード 2」は、この PC ではほかの不足（node など）でも 2 になる。signtool だけで 2 になることは、終了コードでは区別できない。`missing` の signtool の行が1つであることは別に確かめているので、仕様の確かめとしては足りる。
- **run-all**: 結果は `run-all-result-3.txt`。1473件、pass 1452、fail 0、skip 21。曹参の申告と同じ。
  - signtool 17/17。
  - skip 21 はすべて `removals.test.mjs` の「有効な単位の after」の検査（全単位が `enabled:false` のため）。
  - take-in・watch・notion-sync などのほかの担当のファイルも fail 0 だった。中身は見ていない（範囲の外）。

### 未確認（実物が無いため）

- 本物の Windows SDK が入った状態で、PATH に足して gulp の `signtool.exe verify /pa` が通るか。蒙恬の未解決のとおり、最初のビルドで確かめる。

### 守ったこと

- コード・テスト・docs は直していない。書いたのは、この追記と `run-all-result-3.txt`。
- PATH、local.json、スタートメニュー、普段使いのデータには触れていない。

---

## 追記（2回目。リーダーの続きの依頼への報告）

### 判定

**合格。** 作業ツリー `C:\b\wt\verify-p2` に A-1〜A-7・B-1〜B-7 を当てた。その結果、`result: ok` と、1回目に確かめられなかった検査を確かめた。指摘への直しもすべて確かめた。取り込み・検知・notion-sync は対象外。

| 依頼 | 結果 |
|---|---|
| 1 verify-p2 に A＋B を当てる | 合格 |
| 2 D1（build.mjs・prepare.mjs）と、テストが 1.146.0 の作業ツリーを読む点 | 合格 |
| 2 `--manifests` と lock-fetch・lock-verify の既定、VSIX のキャッシュ | 合格 |
| 2 A-7 の `kept`、B の `smoke` の `absence` | 合格 |
| 2 PATH の書き戻し、道具の版の警告 | 合格（PATH はコードの読みだけ） |
| 2 曹参のテストの直しと `apply-commits.test.mjs` | 合格 |
| `node tests/run-all.mjs` | 合格（1129件。pass 1031、fail 0、skip 98） |
| 3 SHA-256 の記録 | `trial/sha256-2.txt` |

### 確かめた成果

- 蒙恬: `scripts/apply.mjs`（`--manifests`・`--build-root`）、`scripts/build.mjs`・`scripts/prepare.mjs`（D1、道具の版の警告）、`scripts/configure.ps1`（PATH）、`scripts/lock-fetch.mjs`・`lock-verify.mjs`（既定の場所）、`removals/A-7`・`B-1〜B-7` の `unit.json`、`C:\b\cache\vsix` の VSIX 8件
- 曹参: `tests/removals.test.mjs`（clone のタグから読む形）、`tests/apply-commits.test.mjs`（新規18件）

### 根拠

- **当てた結果**: `node scripts/apply.mjs C:/b/wt/verify-p2 --label verify-p2 --only <14単位> --prev-tag 1.145.3` を走らせた。終了コード 0、`result: ok`、警告0・誤り0。記録は `records/take-in/verify-p2/checks.json`。
  - edits.patch 6本とパッチ 20・30 は、すべて `applied: ok`。
  - 消え残りは0、参照の残りはすべて0件、未分類の拡張は 0/95。
  - `registeredKeys` は `ok`。`shukoConfigurationDefaults` はパッチ 20 で `referenced` になり、台帳の拡張の設定は `C:\b\cache\vsix` の manifest で `lockManifest` になった。
  - `commitIdentity` は `ok`。コミット25個すべての作者とコミッターが `shuko-apply`。
  - 作業ツリーの中身も読んで確かめた。product.json は Shuko、`builtInExtensions: []`。mydist から2キーが外れた。パッチ 20・30 の行がある。消した拡張は無い。リポジトリの mydist は変わっていない。
- **D1**: `build.mjs --dry-run --worktree C:/b/wt/verify-p2 --fresh --to apply` の plan で確かめた。prepare・fresh・apply が同じ場所を見る（prepare に `--worktree` と `--out` が渡る）。`prepare.mjs` は `resolveWorktree` で場所を決め、常設の clone の中は止める。`tests/removals.test.mjs` は `git -C C:/b/vscode` のタグから読む形になり、`C:\b\wt\1.146.0` を読むテストは残っていない。
- **VSIX のキャッシュ**: apply・lock-fetch・lock-verify・install-extensions の既定は、どれも `<buildRoot>\cache\vsix`。そこにある VSIX 8件の SHA-256 は、台帳の値と8件とも一致した。
- **単位**: B-1〜B-7 は `smoke` に `absence` を持つ。A-7 の `kept` の理由は B-7 に合わせて直っている。
- **PATH**: `configure.ps1` は `HKCU\Environment` を生のまま（`DoNotExpandEnvironmentNames`）読み、同じ種類で書き戻す。コードで確かめた。本物の PATH を変えるので、走らせてはいない。
- **道具の版**: build.mjs の dry-run の `warnings` に、node と pnpm の版の違いが出た。
- **テスト**: `apply-commits.test.mjs` は仕様どおりの期待で、緩めていない。From: と件名、MAIN_FILES、checkUpstreamAdditions、本当に当てる通しの試しを持つ。試しの作業ツリーは後に残っていない。
- **run-all**: 1129件で、リーダーの言う1128件より1件多い（smoke が75件）。この検証の範囲（take-in・watch・notion-sync・p34 を除く）は 994件、pass 980、fail 0、skip 14。skip 14 は全単位が無効なため飛ぶ「有効な単位の after」の検査。

### 申し送り（合否に関わらない）

1. 曹参: 直しのテストが無い。対象は `toolchainWarnings`（build.mjs）、`resolveWorktree`・`resolveBuildRoot`（prepare.mjs）、`Update-PathEntries`（configure.ps1）。蒙恬の追記2に入口がある。→ その後、曹参が `tests/build-fixes.test.mjs`（17件）を足した。3回目の run-all で通っている。
2. 蒙恬: build.mjs は apply.mjs に `--build-root`・`--config` を渡さない（453行）。既定と違う場所でビルドすると、manifest を別の場所から読む。結果は `registeredKeys` の `warn` で止まりはしないが、そろえるのがよい。→ その後、蒙恬が直した（build-switch の追記3。曹参の追記2で確かめられている）。私は今回の範囲外として読んでいない。
3. リーダー: 1回目の軽微の4（docs/02 の3節の表に、overlay の `removeIfPresent` の4キーが無い）と5（`.gitattributes` の `*.patch -text`）は、まだ残っている。
4. `C:\b\wt\verify-p2` は当てた状態（HEAD `ef5b647f…`）で残した。要らなければ消してよい。

### 記録

- `tasks/2026-11-14-p2-verify-prebuild/verification-log.md`（6節）
- `tasks/2026-11-14-p2-verify-prebuild/run-all-result-2.txt`
- `tasks/2026-11-14-p2-verify-prebuild/trial/sha256-2.txt`
- `records/take-in/verify-p2/checks.json`

### 守ったこと

- コード・テスト・docs は直していない。書き換えた作業ツリーは `C:\b\wt\verify-p2` だけ。
- `C:\b\wt\1.146.0` の HEAD はタグのまま。依存の導入・ビルド・`git fetch`・`lock-fetch`・`lock-verify` は走らせていない。
- 実際の local.json（無い）、スタートメニュー、PATH、普段使いのデータには触れていない。

---

（以下は1回目の報告）

## 判定

**判定できない。** 新しい作業ツリーに A＋B を当てる1項（brief の「やること」2の2つめ）が、権限が無いので行えなかった。それ以外の項目は合格。

| brief の項目 | 結果 |
|---|---|
| 1 レビュー（apply.mjs、単位、overlay とパッチ 20・30、ビルドと切り替えの台本） | 合格 |
| 2 `node tests/run-all.mjs` | 合格（975件。pass 961、fail 0、skip 14） |
| 2 新しい作業ツリーに A＋B を apply.mjs で当てる | 判定できない（権限。代わりに 1.146.0 への dry-run は `result: ok`） |
| 2 `node scripts/build.mjs 1.146.0 --dry-run` | 合格 |
| 3 スモークの `--mark-keep` | 合格 |

別に、関門の条件の外の不具合を1件見つけた（D1。`build.mjs` の `--worktree` を prepare が使わない）。

## 確かめた成果

- 蒙恬: `scripts/apply.mjs`・`scripts/lib/apply/`、`removals/A-*`・`B-*`、`builtin/keep.json`、`product.overlay.json`、`patches/20`・`30`、`assets/`、`scripts/make-icons.mjs`、mydist の1行、`scripts/build.mjs`・`install-extensions.mjs`・`configure.ps1`・`switch.ps1`・`scripts/lib/local-config.*`
- 曹参: `tests/` の新しいテスト、`tests/run-all.mjs`
- 前回の直し: `tests/smoke-stop.mjs --mark-keep`

確かめた版の SHA-256 は `trial/sha256.txt`。

## 根拠（要点）

- 全テスト: 蒙恬の2点の直しの後に走らせた。前回落ちた4件は通った。テストは仕様を緩めていない。
- dry-run（`C:\b\wt\1.146.0` を書き換えない形）: 14単位とも当たり、removeLines 94行はすべてちょうど1行。未分類0。`registeredKeys` は、パッチ 20 を当てないので warn（設計どおり）。作業ツリーは変わっていない。
- build.mjs の dry-run: 終了コード 0。plan は設計どおり。何も書いていない。
- `--mark-keep`: 既にある印には何もしない。不正な名前・無い置き場所・名前なしは終了コード 2。
- レビュー: apply.mjs は docs/03 の5〜6節どおり。単位は裁定と表の変更の記録に合い、Claude Code が使う受け手を消していない。`extensions.allowed` は台帳の8件と一致。台本は普段使いのデータ・local.json・スタートメニュー・PATH に、明示の操作のほかでは触れない。

## 記録（1回目）

- `verification-log.md`、`handoff-notes.md`、`run-all-result.txt`、`trial/dry-ab/checks.json`、`trial/clean-check/checks.json`、`trial/sha256.txt`

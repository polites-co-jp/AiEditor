# 引き継ぎ: p1-ci-events の直しと、A-1 を当てた本家 1.146.0 のビルド

- 作成: 蒙恬（2026-11-14）
- 宛先: ヴラド・ツェペシュ（検証は大岡越前守）
- 詳細: `build-log.md`（同じフォルダ）

## 結果

**完了**（テストを走らせることだけ、許可が無くてできなかった）。

1. 直し: `scripts/p1-ci-events.ps1` を `FullyQualifiedErrorId` で見分けるように直した。`doc-corrections.md` の A8 に docs/02 の6節を足した。
2. ビルド: A-1 だけを当てた作業ツリー `C:\b\wt\p1-a1` で、依存の導入 → 型検査 → `vscode-win32-x64-min` → zip まで通った。zip は `C:\b\dist\1.146.0-p1-a1-r2.zip`（0.38 GB、SHA-256 `9348d66c02d84deb8c0b5aa9da7adbff82f1d9eed9a756e8c8619008910c32b1`）。
3. 起動: zip から1回起動した。Smart App Control（オンのまま）がネイティブのモジュールを3つ止めたが、**エディタは終わらず、25 秒後も生きていた**（8プロセス）。前回は `winregistry.node` が止められてすぐ終わったが、今回はそのファイルがイベントに出なかった。

## 要点

1. `apply.mjs --only` は単位だけを選ぶ。上書き・`patches/`・`assets/`・自前の拡張は、いつも当てる。A-1 だけにするため、空の上書き・空のパッチの置き場所・無い assets・mydist だけの extensions-src を渡した。mydist は台本の作りで外せない（2節）。
2. 1回目は notion-sync で落ちた。`package.json` の `dependencies`（jsonc-parser）を、本家の gulp が「バンドルしていない拡張に本番の依存がある」として止める。A-1 とは関係が無い。Phase 2 の本ビルドでも同じところで落ちる（判断を仰ぎたい点1）。
3. 所要時間（キャッシュが温まった状態、作業ツリーの用意から zip まで）は約 6.8 分。内訳は、導入 164 秒、型検査 19 秒、パッケージ化 157 秒、zip 36 秒など。
4. ディスク: C: の空きの減りは、作業ツリーの用意から zip まで 2.3 GB、展開と起動で 1.2 GB。作業ツリーは 4.5 GB（hard link を1回だけ数えると 3.9 GB）、出力は 1.18 GB、zip は 0.38 GB。
5. 止められたのは `@vscode/deviceid` の `windows.node`、`native-keymap` の `keymapping.node`、`native-is-elevated` の `iselevated.node`（ID 3077、`VerifiedAndReputableDesktop`）。`main.log` には deviceid の誤りが2回出たが、起動は続いた。

## 判断を仰ぎたい点

### 1. notion-sync の `dependencies`（Phase 2 の本ビルドで落ちる）

本家 1.146.0 の `build/lib/extensions.ts` の162〜172行（`fromLocalNormal`）は、`esbuild.mts` を持たない拡張に `dependencies` か `optionalDependencies` があると止める。notion-sync の `dist/extension.js` には jsonc-parser がもう入っているので、実行には `dependencies` は要らない。直し方の案:

1. `extensions-src/notion-sync/package.json` の `jsonc-parser` を `devDependencies` に移す（蒙恬の推し。バンドルする拡張の書き方として普通で、`apply.mjs` を変えずに済む。`pnpm --dir extensions-src/notion-sync install` でロックファイルも直る）
2. `apply.mjs` が自前の拡張を写すとき、写した `package.json` から `dependencies` を外す（`extensions-src` は変えない。写す規則 `apply-design.md` の2.6 を変える）
3. 本家の `packagedDependenciesByExtension` に notion-sync を足すパッチ（本家のコードを変えるので推さない）

どれも今回の依頼の書き込み先（`scripts/`・`tasks/`・`C:\b\`）の外か、設計の変更なので、手を付けていない。

### 2. A-1 だけの当て方（2節の解釈）

brief の「A-1 だけを当てる」を、「上書き・パッチ・ブランドの資産・notion-sync も当てない（本家の Code - OSS に A-1 と mydist だけ）」と読んだ。裁定の「Phase 1 の関門を A-1 の単位と合わせて満たす」と docs/07 の4節（2〜4 は A-1 を当てた状態で行う）に合わせるためである。上書きや `patches/` まで当てた形を求めていたなら、やり直す。その場合は Phase 2 の2（上書きと mydist だけの状態）に近い。

### 3. Smart App Control の見立てが変わった

前回の「Smart App Control がオンのままでは自分のビルドは起動しない見込み」は、少なくとも今回の zip では成り立たなかった。止められたモジュールはあるが、起動は続いた。SAC の調べ（`tasks/2026-11-14-sac-override-research/`）を進めている蒙恬と、ユーザーに諮る材料に、この結果を渡してほしい（そのフォルダには書いていない）。`doc-corrections.md` の A8 の「起動しない」も、この結果に合わせて直す必要がある（A8 は今回、依頼の6節の追記だけにした）。

## 成果物

- `scripts/p1-ci-events.ps1`（54行の直し。注釈2行を足した）
- `tasks/2026-11-13-p1-build-upstream/doc-corrections.md`（A8 の「箇所」と「直し方の案」に docs/02 の6節を足した）
- `tasks/2026-11-14-p1-build-a1/build-log.md`、`handoff-notes.md`（この文書）
- `tasks/2026-11-14-p1-build-a1/a1-inputs/`: `overlay-empty.json`、`patches-none/README.md`、`assets-none.txt`（説明だけ）、`extensions-src/mydist/`（`extensions-src/mydist/` の3ファイルの写し）
- 記録: `prepare.json`、`dry-run/checks.json`、`take-in/checks.json`・`lockfile.diff`（1回目）、`take-in-r2/checks.json`・`lockfile.diff`（2回目）、`build-record-dry-run.json`、`build-record-install.json`・`build-record-package.json`（1回目）、`build-record-r2.json`（2回目）、`disk-before.json`、`disk-after-install.json`、`disk-after-zip.json`、`launch-check.json`、`ci-events.json`、`env-check.json`
- `C:\b\`: 作業ツリー `C:\b\wt\p1-a1`（HEAD `72f454338508f617631589f6f3f6cfc1aff1ca8b`）、出力 `C:\b\wt\VSCode-win32-x64\`、zip `C:\b\dist\1.146.0-p1-a1-r2.zip`、展開と起動の置き場所 `C:\b\p1\1.146.0-p1-a1-r2\`（消してよい）、ログ `C:\b\logs\1.146.0-p1-a1\`・`C:\b\logs\1.146.0-p1-a1-r2\`

## 確かめたこと

- `p1-ci-events.ps1`:
  - `p0-check-ps.ps1` で、構文の誤り 0、ASCII 以外 0 バイト。
  - 落ちていたテストと同じ引数（`-Minutes 1 -Filter no-such-text-zzqq-91827`）で、`readable: true`・`error: null`・`count: 0`。
  - `-Minutes 0`（`-Filter` なし。必ず `NoMatchingEventsFound` の経路を通る）でも同じ。
  - `-Minutes 15` は6件を読んだ（イベントのある経路も壊れていない）。
- ビルド:
  - `prepare.mjs` で、タグの commit と HEAD が `upstream.json` と一致し、作業ツリーに変更が無かった。
  - `apply.mjs` の dry-run と本番が、どちらも `result: ok`。
  - 1回目と2回目の当てた結果を `git diff --stat` で比べ、違いは `extensions/notion-sync/` の3ファイルだけだった。
  - `build.mjs` の6つの手順（install〜zip）が ok。導入とビルドの後も `git -C C:/b/wt/p1-a1 status` は clean。
- 起動: `p1-launch-check.ps1 -Zip` が終了コード 0。`check-env.ps1` の `missing` は空で、`smartAppControl` は `on`。
- 作業ツリー `C:\b\wt\1.146.0` には触れていない。

## テストの入口（曹参へ）

- `p1-ci-events.ps1` は、入口も出力の形も変えていない（前回の `tasks/2026-11-13-p1-build-upstream/handoff-notes.md` のとおり）。
- 直した経路: 当たるイベントが無い時間の幅（`-Minutes 0`、または `-Minutes 1` と当たらない `-Filter`）で、`readable: true`・`error: null`・`count: 0`・終了コード 0。OS の言語によらない。
- `node --test tests/p1-scripts.test.mjs` の「当たるイベントが無いとき readable:true・count 0（仕様。日本語の Windows でも）」が通る見込み。蒙恬は許可が無く走らせていない。曹参か検証役が走らせてほしい。

## 検証役（大岡越前守）に渡す入口

- 直し: `scripts/p1-ci-events.ps1` の53〜57行（`catch` の中）。`node --test tests/p1-scripts.test.mjs` と `node tests/run-all.mjs`（前回は fail 1）。
- A8: `tasks/2026-11-13-p1-build-upstream/doc-corrections.md` の A8 の行。
- 当てたもの: `take-in-r2/checks.json`（`options.only`、`inputs` の overlay・patches・assets・extensionsSrc、`units[0]`、`overlay.set` が空、`patches` が空、`assets.applied` が `none`、`builtinExtensions.copied` が mydist だけ）。作業ツリーで `git -C C:/b/wt/p1-a1 diff --stat 69047191fc427f2f92828279aae1d90d8eeda7ab HEAD -- product.json build package.json` を見ると、product.json は出ない。
- ビルド: `build-record-r2.json`（手順ごとの秒・終了コード・`zip.sha256`・`disk`）、`C:\b\logs\1.146.0-p1-a1-r2\package.log`（131行に「Finished 'vscode-win32-x64-min' after 2.57 min」、126行に `<anonymous>` が 1 ms）。
- 1回目の落ち方: `build-record-package.json` の `steps[0].tail`、`C:\b\logs\1.146.0-p1-a1\package.log`。原因の行は `C:\b\wt\p1-a1\build\lib\extensions.ts` の162〜172行と、`extensions-src/notion-sync/package.json` の83〜85行。
- 起動: `launch-check.json`、`ci-events.json`、`C:\b\p1\1.146.0-p1-a1-r2\portable\user-data\logs\20261114T201530\main.log`（2行・56行・103行）。再現するなら、`-Dest` を新しい名前（`C:\b\p1\` の下）にして `p1-launch-check.ps1 -Zip C:/b/dist/1.146.0-p1-a1-r2.zip` を走らせ、続けて `p1-ci-events.ps1 -Minutes 10`。

## docs/ との食い違い

- docs/02 の6節の157行と、`doc-corrections.md` の A8 の「起動しない」: 今回の zip は、Smart App Control がオンでも起動が続いた（判断を仰ぎたい点3）。止められるモジュールがあることは同じ。
- docs/07 の4節の「1.146.0 での扱い」の「Smart App Control がオンだと…起動しない」: 同じ。
- docs/07 の4節の2「依存の導入 → パッケージ化 → zip」: A-1 と mydist を当てれば、1.146.0 で zip まで通る（裁定の扱いのとおり）。所要時間とディスクは `build-log.md` の 3.6・3.7。
- 気づいた点: docs/03 の5.1 は「product.json の上書き → 単位 → patches/」を当て方の順として書くが、`apply.mjs --only` で単位だけを当てられるとは書いていない。今回は引数で外した（2節）。単位の関門（docs/03 の7節）でも同じ使い方になるなら、`--only` の意味（単位だけを選ぶ。ほかはいつも当てる）を資料か `apply-design.md` に書くとよい。

## 未解決の点

1. 上の判断を仰ぎたい点1〜3。
2. 許可: `node --test tests/p1-scripts.test.mjs` を走らせる許可が無い。要るもの: 「`node --test tests/p1-scripts.test.mjs`」（何のため: 直した台本が、曹参のテストを通ることを自分で確かめるため）。足すかどうかはユーザーの承認が要る。
3. `winregistry.node` が今回止められなかった理由は、確かめていない（`build-log.md` の 4.1）。
4. `pnpm -C build run typecheck`（A-1 の README の「未確認」）は、許可が無く走らせていない。
5. 気づいた点（前回の検証の指摘）: `p1-launch-check.ps1` の普段使いのデータの比べ方（フォルダの更新時刻だけ）は直していない。この PC では4つとも無いので、今は足りている。
6. 作業ツリー `C:\b\wt\p1-a1` と、前回の `C:\b\wt\1.146.0` が両方残っている（C: の空きは 77.6 GB）。消すかはリーダーに任せる。

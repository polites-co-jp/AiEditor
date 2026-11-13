# 報告: p2-units-b（段階 B の単位・product.overlay.json・既定の設定のパッチ・ブランド）

- 担当: 蒙恬。2026-11-14。

## 結果

完了（型検査とビルドはまだ走らせられないので、そこで確かめる点は「未解決」に残す）。

## 成果物

- `product.overlay.json`
- `patches/20-product-configuration-defaults.patch`
- `removals/B-1-telemetry/`（`unit.json`・`README.md`・`edits.patch`）
- `removals/B-2-onboarding-experiments-surveys/`（同上）
- `removals/B-3-issue-share/`（同上）
- `removals/B-4-outline-view/`（`unit.json`・`README.md`）
- `removals/B-5-theme-switching/`（同上）
- `removals/B-6-online-feeds/`（同上）
- `removals/B-7-terminal-suggest/`（`unit.json`・`README.md`・`edits.patch`。リーダーの追加の指示）
- `assets/README.md`、`assets/src/vs/workbench/browser/media/code-icon.svg`、`assets/src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg`
- `extensions-src/mydist/package.json`（`terminal.integrated.suggest.enabled: false` を1行足した。リーダーの追加の指示）
- このフォルダ: `units-b-notes.md`、`trial-log.md`、`doc-corrections.md`、`trial/checks.json`（B-1〜B-7）、`trial/checks-with-a.json`（A-1〜A-7 と B-1〜B-7）、`trial/checks-dry-run.json`
- 作業ツリー `C:\b\wt\dev-b`（B-1〜B-7 と patches/20 を当てた状態で残した）。作業用の `C:\b\work-b\README.txt`（消してよい）

## 要点

1. B-1〜B-7 を作り、`apply.mjs` で `C:\b\wt\dev-b` に当てた。B だけでも、A-1〜A-7 と合わせても `result: ok`（removeLines は全件ちょうど1行、absentStrings は全件0）。
2. 消した部品を残る部品が注入している所（AI の編集のテレメトリ、課題の報告、共有、実験、ターミナルの補完の API）は、ID を残して何もしない実装を登録した。docs/03 の表と違うのは B-2 の `contrib/onboarding` を残したこと（残る部品が使う）と、B-6 で部品 `contrib/emergencyAlert` を消したこと（`doc-corrections.md` の1・2）。
3. 既定の設定は案B-2 のパッチ1ファイル7行。`shukoConfigurationDefaults` に6件（`extensions.allowed` は台帳の8件と `"*": false`）。
4. 1.146.0 の OSS の product.json には `emergencyAlertUrl`・`profileTemplatesUrl`・`tasConfig` が無い。0-5 の `main.vscode-cdn.net` は配布の zip の product.json 由来で、自前のビルドには出ない見込み。WPAD の止め方は3案を比べ、パッチ案を推奨した（実装していない）。
5. アイコンは自作の SVG 5つを置き、PNG・ICO は置き場所と大きさの一覧にした（この作業の道具では画像を書けない）。

## 確かめたこと

- `edits.patch` 4つと `patches/20` は、`format-patch --stdout` の出力を写したもの。元の状態に `git am -3` で当て直し、元のコミットとの差が無いことを確かめた。
- `node scripts/apply.mjs C:/b/wt/dev-b --label trial-units-b --only B-1-telemetry,...,B-7-terminal-suggest --checks-out tasks/2026-11-13-p2-units-b/trial/checks.json` → ok。A-1〜A-7 を足しても ok（`trial/checks-with-a.json`）。初回の A＋B は A-3 の検査（product.json の js-debug）だけが fail で、`builtInExtensions: []` を足して解消した。
- 当てた状態で、消した部品への import（`from` と副作用の import）と、消したサービスの名前を `grep` で探し、残りが無いことを確かめた。
- `node --check scripts/apply.mjs` は通った（他の担当の台本。読むだけ）。`C:\b\wt\1.146.0` は変更なし（`git status`）。
- B-7 の設定 `terminal.integrated.suggest.enabled` のスコープ: スコープの指定が無く、登録の節にも無いので window（mydist の既定で効く範囲）。ソースで確かめてから mydist に足した。

## テストの入口（曹参へ）

- `product.overlay.json`:
  - `set.shukoConfigurationDefaults["extensions.allowed"]` のキーが `"*"`（値 `false`）と、`extensions.lock.json` の全 `id`（値 `true`）にちょうど一致する（大文字小文字は台帳のまま。多くも少なくもない）。
  - `set.shukoConfigurationDefaults` に6キー: `extensions.allowed`・`telemetry.telemetryLevel: "off"`・`update.mode: "none"`・`workbench.enableExperiments: false`・`extensions.autoUpdate: "off"`・`extensions.autoCheckUpdates: false`。
  - `set.builtInExtensions` が `[]`。
  - `scripts/lib/apply/overlay.mjs` の `validateOverlay(overlay)` が空の配列を返す。`set` と `removeIfPresent` が重ならない。
- 単位: `scripts/lib/apply/units.mjs` の `validateUnit(unit, dirName)` が B-1〜B-7 で空の配列。`planUnits` で order が重ならない（210〜270）。全単位 `enabled: false`。`patch` を持つ単位（B-1・B-2・B-3・B-7）は、そのファイルがあり、件名が `unit <id>: edits`、`From:` が `shuko-apply <apply@shuko.invalid>`。
- 当て方: `node scripts/apply.mjs <1.146.0 の新しい作業ツリー> --label <任意> --only B-1-telemetry,B-2-onboarding-experiments-surveys,B-3-issue-share,B-4-outline-view,B-5-theme-switching,B-6-online-feeds,B-7-terminal-suggest --checks-out <path>` → 終了コード 0、`result: "ok"`、各単位の `edits.applied` が `ok`（B-4・B-5・B-6 は `none`）、`checks.absentStrings.status: "ok"`。
- ビルドの後のスモーク（docs/06 の5節）に足す項目の案: 設定の画面で `update.mode` が `none`、`extensions.allowed` が台帳の一覧になっている（既定の登録が効いた確かめ）。起動時のログに `depends on UNKNOWN service` が無い。

## docs/ との食い違い

`doc-corrections.md` の1〜8。要点: B-2 で `contrib/onboarding` を残した、B-6 に部品の削除を足した、overlay の3つめの項目 `removeIfPresent` と足したキー4つ、`builtInExtensions` を overlay の set に、B-7 の行、mydist の既定の1件、`kept` は `delete` の中のファイルを守らない（docs/03 の3.1 の例）、B-1 の表に無い削除。

## 未解決の点

1. 型検査とビルドが未実施。各単位の README の「未確認」（とくに空の実装の型、`assignmentService.ts` の末尾の `import`、B-7 の `const enum`）。
2. 判断を仰ぐ点（リーダー）:
   - B-2 で `contrib/onboarding` を残したこと（docs/03 の表との違い）。
   - B-6 で `contrib/emergencyAlert` を消したこと（表に無い）。
   - WPAD の止め方（`units-b-notes.md` の5。推奨は `windowImpl.ts` の小さなパッチ）。
   - PNG・ICO の作り方（`assets/README.md`。Node.js の標準の `zlib` で書き出す台本を `scripts/` に足すか、ユーザーが作るか）。
   - 範囲の外の候補: `terminalContrib/telemetry` を B-1 に足すか、`services/suggest` を消すか（`units-b-notes.md` の8）。
3. 権限: リーダーの指示「edits のコミットは `git -c user.name=shuko-apply -c user.email=apply@shuko.invalid commit` で作れ」は、私の許可（`git -C C:/b/wt/* commit -m` の前方一致）に当たらず実行できなかった。`--author` も `<` `>` で止まる。代わりに `format-patch` の出力の `From:` を書き換えた（`git am` で入る作者は `shuko-apply`。コミッターは apply.mjs が `shuko-apply` にする）。そのまま使えるようにするなら、許可に `git -C C:/b/wt/* -c user.name=shuko-apply -c user.email=apply@shuko.invalid commit -m` を足す承認が要る。`git log` も許可に無い。
4. `mydist` の `terminal.integrated.suggest.enabled: false` は B-7 を有効にしたら外す。apply.mjs の `registeredKeys` は、B-7 のパッチが残す文字列のせいで、登録が無くなってもこのキーを `upstream` と見る（誤って合格になる）。→ 追記の時点で apply.mjs は直っていた（`unregistered` と出る）。

---

## 追記（2026-11-14、リーダーの判断を受けて）

### 結果

完了。ただし A＋B を実物の mydist で当てると `registeredKeys` で fail になる（下の「未解決」の1）。単位は今どれも `enabled: false` なので、実際のビルドの形（単位を当てない）は ok。

### 判断ごとの対応

| 判断 | 対応 | 成果物 |
|---|---|---|
| 1. B-2 で `contrib/onboarding` を残す | そのまま。理由は B-2 の README と `kept` にある | — |
| 2. B-6 で `contrib/emergencyAlert` を消す | そのまま | — |
| 3. WPAD を `windowImpl.ts` のパッチで止める | `patches/` に置いた。理由: docs/03 の5.3 で単位のパッチは「自分の単位が消した部品への参照の直し」に限られる。WPAD は何も消さない振る舞いの変更で、B-6 の部品と関係が無い。`patches/` は削除以外の変更の置き場所 | `patches/30-proxy-direct-without-settings.patch`（`windowImpl.ts` に6行）。B-6 の README を更新 |
| 4. PNG・ICO を zlib の台本で書き出す | 台本を作り、`assets/` に出力した。画像を開いて意匠どおりを確かめた | `scripts/make-icons.mjs`、`assets/resources/win32/code.ico`・`code_70x70.png`・`code_150x150.png`。`assets/README.md` を更新 |
| 5a. `terminalContrib/telemetry` を B-1 に | `delete` と `terminal.all.ts` の1行の `removeLines`、`absentStrings` に1件 | `removals/B-1-telemetry/unit.json`・`README.md` |
| 5b. `services/suggest` | 本体ではターミナルの入力候補だけが使っていた（ほかは `contrib/modernUI` のテストの CSS の import 1行）ので、B-7 で消した。テストの1行は `removeLines` | `removals/B-7-terminal-suggest/unit.json`・`README.md` |
| 6. 作者名は From: の書き換えでよい | 新しいパッチ（30）も同じ形 | — |

### 確かめたこと（`trial-log.md` の2.1）

- 単位を当てない（実際のビルドの形）: ok（`trial/checks-no-units.json`）。assets の写しで PNG・ICO が `resources/win32/` に入った。
- A-1〜A-7 と B-1〜B-7、mydist は実物: **fail**（`trial/checks-with-a.json`）。`registeredKeys` だけで、mydist の既定 `workbench.startupEditor`（B-2 が登録ごと消す）と `terminal.integrated.suggest.enabled`（B-7 が消す）が `unregistered`。
- 同じ単位で、mydist を「B-2・B-7 を有効にした後の姿」（上の2キーを外した試し用の写し。`trial/extensions-src-units-enabled/mydist/package.json`）にすると: **ok**（`trial/checks-with-a-units-enabled-mydist.json`）。
- B-1〜B-7 だけ（試し用の mydist）: ok（`trial/checks.json`）。当てた後に、消した部品への参照の残りを `grep` で探し、無かった。
- `node --check scripts/make-icons.mjs` が通った。`C:\b\wt\1.146.0` は変更なし。

### テストの入口（曹参へ。追加分）

- `scripts/make-icons.mjs` の export:
  - `crc32(Buffer.from("IEND"))` は `0xAE426082`（PNG の IEND の既知の値）。
  - `encodePng(w, h, rgba)` の先頭8バイトが PNG の署名で、IHDR の幅・高さが引数どおり。`rgba` の長さが違えば例外。
  - `encodeIco([{ size, png }])`: 先頭が `00 00 01 00`、項目の数、256 の項目の幅と高さが `0`、オフセットが PNG の位置を指す。257 は例外。
  - `renderIcon(size)` は長さ `size*size*4`。四隅の画素は透明（アルファ 0）、中心付近（`>` の線の上）は白。
  - `makeIconFiles()` の戻りは**配列**（Map でもオブジェクトでもない）で、要素は `{ rel: string, data: Buffer }` の3つ。順は `rel` が `"resources/win32/code.ico"`、`"resources/win32/code_70x70.png"`、`"resources/win32/code_150x150.png"`（区切りは `/`、出力先からの相対）。2回呼んで同じバイト列（決まった出力）。
  - `node scripts/make-icons.mjs --out <一時フォルダ>` で3つのファイルができ、終了コード 0。知らない引数は終了コード 2。
- `patches/30-proxy-direct-without-settings.patch` が 1.146.0 に `git am -3` で当たる（apply.mjs の `patches[].applied: "ok"`）。

### docs/ との食い違い（追加分。`doc-corrections.md` に足す案）

- docs/03 の表の B-1 の「消すもの」に `contrib/terminalContrib/telemetry` を、B-7 の行に `services/suggest` を足す。
- docs/02 の2節の `patches/` の例に `30-proxy-direct-without-settings.patch`（WPAD を止める）と `scripts/make-icons.mjs` を足す。`records/phase0/network-inventory.md` の5節の「未確認: WPAD」は「patches/30 で止める（実物の監査で確かめる）」に直す。

### 未解決

1. **単位を有効にするときの mydist の既定の扱い（判断を仰ぐ）。** B-2 と B-7 を有効にすると、mydist の既定 `workbench.startupEditor`・`terminal.integrated.suggest.enabled` の設定が登録されなくなり、apply.mjs の `registeredKeys` が fail にする。単位を有効にするまでは既定が要る（歓迎画面と候補を止めるつなぎ）。案:
   - (a) 単位を有効にするときに、手で mydist から該当のキーを外す（関門の手順に書く）。台本の変更は要らない。
   - (b) apply.mjs で、当てた単位の `checks.absentSettings` に挙げたキーは、mydist の既定にあっても fail にしない（「単位が消した」と記録する）。apply.mjs の担当の仕事。単位を無効に戻したときも自動で正しい。
   推奨は (b)（単位の有効・無効と mydist が自動でそろう）。
2. 型検査とビルドは未実施のまま（前の報告の未解決の1に、`windowImpl.ts` の `setProxy({ mode: 'direct' })` の型を足す）。
3. `roundedCorners.test.ts` の一部は、B-7 で CSS を消したため本家の単体テストとして落ちる恐れがある（関門には含まない）。
4. 実物での確かめ: WPAD の問い合わせが消えること、アイコンがタスクバーとスタートメニューに出ること。

---

## 追記2（2026-11-14、大岡越前守の検証の軽微な点）

- 対応: B-1〜B-7 の `unit.json` の `smoke` に `"absence"`（docs/06 の5節。有効な単位の `checks` を確かめる組）を足した。B-1 は `["base", "claude-code", "languages", "absence"]`、B-2〜B-7 は `["base", "claude-code", "absence"]`。
- A 単位: A-1〜A-7 はすべて既に `"absence"` を持っていた（`grep` で確かめた）。別の蒙恬に回すものは無い。
- 確かめたこと: `C:\b\wt\dev-b` を 1.146.0 に戻し、`node scripts/apply.mjs C:/b/wt/dev-b --label trial-units-b --only B-1-telemetry,...,B-7-terminal-suggest --extensions-src tasks/2026-11-13-p2-units-b/trial/extensions-src-units-enabled --checks-out tasks/2026-11-13-p2-units-b/trial/checks.json` → `result: ok`（`validateUnit` を通った）。作業ツリーはこの状態で残した。
- 注意: その前に、B を当てたままの作業ツリーへ誤って dry-run を走らせ、`trial/checks-dry-run.json` を上書きした（「一致する行が無い」で fail した記録）。この1つは意味の無い記録なので、検証では使わないこと。

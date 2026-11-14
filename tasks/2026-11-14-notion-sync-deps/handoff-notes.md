# 引き継ぎ: notion-sync の依存の書き方の直し

- 作成: 蒙恬（2026-11-14）
- 宛先: ヴラド・ツェペシュ（検証は大岡越前守）
- 依頼: `brief.md`（同じフォルダ）。経緯は `tasks/2026-11-14-p1-build-a1/handoff-notes.md` の「判断を仰ぎたい点1」（案1）

## 結果

**一部完了**。1・2・4 は済んだ。3 は、`build --trial` で同期の流れは確かめたが、`tests/notion-sync.test.mjs` は許可が無くて走らせていない（「未解決の点」の1）。

## 要点

1. `extensions-src/notion-sync/package.json` で、`jsonc-parser` を `dependencies` から `devDependencies` に移した。版は `3.3.1` のまま。`dependencies` の欄はなくした。
2. `pnpm install` でロックファイルを直した。変わったのは `importers['.']` の区分だけ（`dependencies:` の4行が消え、`devDependencies:` に同じ3行が入った）。`packages:` と `snapshots:` は変わっていない。
3. `run build` で `dist/extension.js` ができた（99,998 バイト、入力 16 個。前と同じ大きさ）。jsonc-parser の ESM の6ファイルは中に入ったまま。`require(` するのは `vscode` と `node:os`・`node:path`・`node:crypto`・`node:fs` だけ。
4. 本家 1.146.0 の `build/lib/extensions.ts` の169行は、`dependencies` と `optionalDependencies` だけを見る（`devDependencies` は見ない）。作業ツリー `C:\b\wt\p1-a1` で読んで確かめた（読んだだけで、何も書いていない）。この直しで notion-sync は検査を通る見込み。ビルドで確かめるのは次の本ビルドになる。
5. 規則を `apply-design.md` の2.6 に書き足し、変更の記録に1行を足した。notion-sync の README と `notion-sync-design.md` の依存の表も、「`package.json` では `devDependencies`」と合わせて直した。

## 成果物

- `extensions-src/notion-sync/package.json`（依存の区分）
- `extensions-src/notion-sync/pnpm-lock.yaml`（`pnpm install` で作り直した）
- `extensions-src/notion-sync/README.md`（依存の表の「種類」の欄、41行）
- `extensions-src/notion-sync/dist/extension.js`（作り直した。git の管理外）
- `tasks/2026-11-13-p2-apply/apply-design.md`（2.6 の末尾の段落と、変更の記録の最後の行）
- `tasks/2026-11-14-p4-notion-sync/notion-sync-design.md`（6節の表の jsonc-parser の行と、表の下に1段落）
- `tasks/2026-11-14-notion-sync-deps/handoff-notes.md`（この文書）

`scripts/` の下には設計の文書が無かった（設計は `tasks/2026-11-13-p2-apply/apply-design.md` にある）。そこで brief の4は `apply-design.md` に書いた。`scripts/` のファイルは変えていない。

## 確かめたこと

- `pnpm --dir extensions-src/notion-sync install`: 「Lockfile passes supply-chain policies (52 entries)」。ロックファイルの差分は上の要点2のとおり。
- `pnpm --dir extensions-src/notion-sync install --frozen-lockfile --ignore-scripts`（`tests/cli-run.test.mjs` の185行のテストと同じ引数）: 「Lockfile is up to date」で通った。`package.json` とロックファイルは食い違っていない。
- `pnpm --dir extensions-src/notion-sync run build`: 型検査で誤りなし。esbuild の入力に `node_modules/.pnpm/jsonc-parser@3.3.1/.../lib/esm/` の6ファイルがある。`activate`・`deactivate` がある。
- `dist/extension.js` を `require\(|jsonc-parser` で検索した: `require("jsonc-parser")` は無い。jsonc-parser の印（`// node_modules/.pnpm/jsonc-parser@3.3.1/...`）は7つあり、前回の `build-log.md` と同じ数。
- `pnpm --dir extensions-src/notion-sync run build --trial`: 「試し: すべて期待どおり」。部品の検査と流れ1〜16がすべて OK で、ignoredSettings（jsonc-parser を使う部品）の3件も含む。Notion は差し替えたもので、本物には書いていない。流れ16 は `C:\b\notion-sync-trial\User` に書いた（`C:\b\wt\` ではない）。
- `extensions-src/mydist/package.json` には依存の欄がもともと無く、直すところは無かった。
- `C:\b\wt\` には書き込んでいない。本体のビルドは走らせていない。

## テストの入口（曹参へ）

- `node --test tests/notion-sync.test.mjs`: 部品は `src/*.mts` を直接 import する。jsonc-parser は `extensions-src/notion-sync/node_modules/` から読む。`devDependencies` も `pnpm install` で入るので、この直しで結果は変わらない見込み。
- `tests/cli-run.test.mjs`:
  - 185行（install → build → `require("jsonc-parser")` が無い）: 上の確かめと同じ手順で通る見込み。
  - 224行（版の固定）: `{ ...dependencies, ...devDependencies }` を見るので、`dependencies` が無くなっても通る。
- 足すとよいテスト（案）: `extensions-src/*/package.json` に `dependencies`・`optionalDependencies` が無いこと（あれば本家の `fromLocalNormal` が止める。`apply-design.md` の2.6）。今は notion-sync も mydist も満たす。

## 検証役（大岡越前守）に渡す入口

- 差分: `git diff extensions-src/notion-sync tasks/2026-11-13-p2-apply/apply-design.md tasks/2026-11-14-p4-notion-sync/notion-sync-design.md`
- 本家の検査: `C:\b\wt\p1-a1\build\lib\extensions.ts` の162〜172行（169行で見る区分）
- 本ビルドで確かめるところ: notion-sync を写したパッケージ化で、`C:\b\logs\<名前>\package.log` に「has production dependencies」が出ないこと

## docs/ との食い違い

- 食い違いは無い。書き足すとよいところが1つある。docs/02 の4.1（114行）は「ビルドリポジトリ側で先にビルドして `dist/extension.js` にまとめ、できあがったものを写す」と書くが、`package.json` に実行時の依存を `dependencies` として書くと本家の gulp が止めることは書いていない。「バンドルに入れる依存も `devDependencies` に書く（本家の `fromLocalNormal` が止めるため）」を1文足すとよい。

## 未解決の点

1. 許可: `node --test tests/notion-sync.test.mjs` を走らせる許可が無い。
   - 要るもの: 「`node --test tests/notion-sync.test.mjs`」
   - 何のため: 直した notion-sync が、曹参のテストを通ることを自分で確かめるため
   - 足すかどうかは、ユーザーの承認が要る。曹参か検証役が走らせれば足りる。
2. 本ビルドで notion-sync が通るかは、まだ確かめていない（brief に従って本体のビルドを走らせていない）。

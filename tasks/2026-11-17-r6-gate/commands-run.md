# 関門 r6 で走らせたコマンド（大岡越前守、2026-11-17）

作業場所はリポジトリの直下。結果の読みは `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md`。

## 1. 版の一致

| コマンド | 結果 |
|---|---|
| `sha256sum tmp/b/dist/1.146.0-p5-c-all-r6.zip tmp/b/dist/1.146.0-p5-c-all-r5.zip tmp/b/dist/1.146.0-p5-c-all-r4.zip` | r6 `a70b0a1cb3525b64775024840199fca2aca183c142f83bb88a50a941e0b55f09`（記録と一致）、r5 `21d9ab57…e613`、r4 `e3e52469…2a6e`（前の関門の値と一致） |
| `tmp/b/vscode/.git/worktrees/w1/HEAD` を読む（`tmp/b/wt/r6/w/.git` の指す先） | `3e1e616aa9f1538643a070f0684196c0cd688ddd` |
| `git -C tmp/b/wt/r4 diff --stat builds/1.146.0-p5-c-all-r6 3e1e616a…` | 空（枝の木は HEAD と同じ） |
| `git -C tmp/b/wt/r4 diff --stat 7fac30e8…(r4) 3e1e616a…(r6)` | 14ファイル。言語パックの3つ（README・ThirdPartyNotices・package.json）、mydist・notion-sync の package.json、product.json、アイコンの8つ |
| `git -C tmp/b/wt/r4 diff 7fac30e8… 3e1e616a… -- product.json extensions/mydist/package.json extensions/notion-sync/package.json src/vs/workbench/browser/media/code-icon.svg` | product.json は `extensions.allowed` から `MS-CEINTL.vscode-language-pack-ja` を外しただけ。displayName の2行。code-icon.svg は A の意匠 |
| `git -C tmp/b/wt/r4 diff --stat 027caf9a…(r5) 3e1e616a…` | `extensions/language-pack-ja/ThirdPartyNotices.txt` の1つだけ |
| `node tests/c1-check-json.mjs tasks/2026-11-17-icon-ja-build/1.146.0-p5-c-all-r6/checks.json` 〜 c7 | 7つとも「期待どおり」（c2〜c6 は組 c、c7 は組 b） |
| `node tests/c1-check-worktree.mjs E:/…/tmp/b/wt/r6/w` 〜 c7 | 7つとも「期待どおり（作業ツリー）」 |
| `sha256sum` で r6 と r4 の `lockfile.diff`、`extensions.lock.json` | lockfile.diff は同じ `ef5f98ab…3862`。台帳は `27ad0e1b…db70`（ビルドの記録と一致） |
| `sha256sum` で蒙恬の展開・私の展開・gulp の出力の `Shuko.exe`・`product.json`・`main.i18n.json`、リポジトリと作業ツリーの束 | 同じ（関門の記録の1節） |
| `tmp/b/logs/1.146.0-p5-c-all-r6/typecheck.log` を読む | `tsc …` の1行だけ |

## 2. 展開と起動

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -OutFile tasks/2026-11-17-r6-gate/launch-check-p5-c-all-r6-ooka.json -Zip E:/develop/self/Team/projects/ai-editor/tmp/b/dist/1.146.0-p5-c-all-r6.zip -Dest E:/develop/self/Team/projects/ai-editor/tmp/b/p2/1.146.0-p5-c-all-r6-ooka -InstallExtension tmp/b/cache/vsix/detachhead.basedpyright-1.40.2,tmp/b/cache/vsix/ms-vscode.powershell-2025.4.0,tmp/b/cache/vsix/mads-hartmann.bash-ide-vscode-1.43.2,tmp/b/cache/vsix/mechatroner.rainbow-csv-3.24.1,tmp/b/cache/vsix/weixu.wx-vsce-dotenv-0.2.3,tmp/b/cache/vsix/tomoki1207.pdf-1.2.2
```

`result: ok`。展開先は `tmp\b\p2\1.146.0-p5-c-all-r6-ooka\`（以下の確かめはここで行った）。

## 3. 日本語

```
node tests/l10n-audit.mjs --app E:/…/tmp/b/p2/1.146.0-p5-c-all-r6-ooka/Shuko-win32-x64-1.146.0-p5-c-all-r6/resources/app --pack E:/…/resources/app/extensions/language-pack-ja --worktree E:/…/tmp/b/wt/r6/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle --out records/take-in/1.146.0-p5-c-all-r6/l10n-audit-r6.json
```

合格（終了コード 0）。落ちるべきときに落ちるかの確かめとして、同じ網に r5 の出力のパック（鍵の直しの前）を渡した:

```
node tests/l10n-audit.mjs --app <r6 の app> --pack E:/…/tmp/b/p2/1.146.0-p5-c-all-r5/Shuko-win32-x64-1.146.0-p5-c-all-r5/resources/app/extensions/language-pack-ja --worktree E:/…/tmp/b/wt/r6/w --exclude extensions-src/language-pack-ja/exclusions.json --strict --require-bundle --out tasks/2026-11-17-r6-gate/l10n-audit-r6app-r5pack.json
```

不合格（終了コード 1、bundle の除外の外 2）。

足した訳の印は、`added/1.146.0.json` の198件すべてについて、`{…}`・`&&`・`$(…)`・`](…)` を行ごとに拾う Grep で、英語の行と訳の行の印を並べて照らした（抜き取りでなく全部）。出力の `main.i18n.json` と `vscode.git.i18n.json` を Grep し、上書きの訳と `↔` の鍵があることを見た。

## 4. アイコン

`sha256sum` で `assets/` の8つ、`scripts/icon-src/` の2つ、展開し直した版の `resources/app/resources/win32/` の3つと `out/media/`・`out/vs/workbench/browser/…/media/` の SVG 10、作業ツリーの `resources/win32/code.ico`、r4・r5・r6 の `Shuko.exe`。本家の `build/gulpfile.vscode.ts`・`build/lib/electron.ts` を Grep して、実行ファイルに入るアイコンが `resources/win32/code.ico` であることを見た。

## 5. スモーク（3回）

```
node tests/smoke-run.mjs --build E:/…/tmp/b/p2/1.146.0-p5-c-all-r6-ooka/Shuko-win32-x64-1.146.0-p5-c-all-r6 --label p5r6-1 --mode built --prime --baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r3c.json --save-baseline E:/…/tmp/b/smoke/baseline-p5-c-all-r6.json --timeout 300 --keep-runs 40
（p5r6-2・p5r6-3 は同じで --merge-baseline を足した）
node tests/smoke-stop.mjs --mark-keep p5r6-1-261117T005343   （p5r6-2-261117T005542・p5r6-3-261117T005730 も）
```

## 6. 通信の監査

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe E:/…/tmp/b/p2/1.146.0-p5-c-all-r6-ooka/Shuko-win32-x64-1.146.0-p5-c-all-r6/Shuko.exe -EnvDir tasks/2026-11-14-p2-gates/netaudit-env -Label p5r6 -DurationSeconds 600 -Previous records/network-audits/2026-11-16-p5r3c
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1 -Exe <同じ> -EnvDir C:/b/p0/data/upstream-default -Label p5r6-ledger -DurationSeconds 600 -Previous records/network-audits/2026-11-16-p5r3c-ledger
```

## 7. テスト

```
node --test tests/l10n-lib.test.mjs tests/l10n-audit.test.mjs tests/l10n-audit-more.test.mjs tests/l10n-repo.test.mjs tests/l10n-r6.test.mjs tests/make-icons.test.mjs   （227件すべて通る）
node --test tests/take-in.test.mjs tests/take-in-more.test.mjs tests/install-ext.test.mjs tests/builtin-l10n.test.mjs   （203件すべて通る）
node --test tests/apply-parts.test.mjs tests/build-parts.test.mjs   （95件すべて通る）
node --test tests/move-off-c.test.mjs   （26件、1件落ちる: configure.ps1 が editor-running）
node tests/run-all.mjs --no-ps --no-guard --only <名前> --save tasks/2026-11-17-r6-gate/run-all-<名前>-r6.txt
  （名前: removals・move-off-c・c1-unit・l10n・install・smoke・watch・lock・apply・build・make-icons・take-in）
node tests/run-all.mjs --save tasks/2026-11-17-r6-gate/run-all-r6.txt   （全部・見張りあり。背景で走らせた。報告の時点で終わっていない）
```

## 8. 差分のレビュー

`git status --short`、`git diff --stat`、`git diff -- <ファイル>`（scripts・tests・assets・設定・TAKE-IN.md・前の仕事の残り）、`git log --stat -6`、`git log --oneline -3 -- tests/p34 …`、`git show 584ede1 -- docs/06-update-watch-and-take-in.md`、`git ls-files --others --exclude-standard -- extensions-src/language-pack-ja scripts/icon-src`。新しいファイル（`scripts/l10n-ja.mjs`・`scripts/lib/l10n-ja.mjs`・`scripts/copy-icon-sources.mjs`・`scripts/icon-src/SOURCES.json`・`extensions-src/language-pack-ja/` の README・package.json・exclusions.json・sources.json の先頭・ThirdPartyNotices.txt・added の上書き）と、テスト（`tests/l10n-audit.mjs` の数え方・`tests/l10n-r6.test.mjs`・`tests/l10n-audit-more.test.mjs` の実物の節）は Read で読んだ。削除の処理は scripts の全体を Grep（`rmSync`・`unlinkSync`・`Remove-Item` など）で探した。

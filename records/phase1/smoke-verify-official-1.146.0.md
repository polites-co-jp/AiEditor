# スモークの台本の検証の実行（公式の zip 1.146.0）

- 実行: 大岡越前守、2026-11-13 21:58〜22:00（JST）
- タスク: `tasks/2026-11-13-p1-verify-smoke-prepare/`
- 相手: `C:\b\p0\vscode-1.146.0\`（Code 1.146.0 / 69047191fc）、形態 upstream

## 1. 単体テスト

```
node --test tests/smoke.test.mjs
```

tests 46 / pass 46 / fail 0（duration 約 165 ms）。

## 2. スモークの実行

```
node tests/smoke-run.mjs --label ooka-verify --baseline C:/b/smoke/baseline-official-1.146.0.json
```

- 置き場所: `C:\b\smoke\runs\ooka-verify-20261113T125822\`（結果は `smoke-result.md`・`smoke-result.json`）
- 拡張フォルダ: `C:\b\smoke\ext\1.146.0-ooka-verify\`（ラベルが新しいので、台帳の8件を入れ直した。8件とも入った）
- 結果: **PASS 44 / FAIL 0 / SKIP 0 / INFO 8**。終了コード 0
- probe: 30 項目が最後まで走った（`done`）
- `errors.new`: PASS（基準に無い誤りなし）。誤りの件数は renderer 66、ほかは 0。止めた後の誤り 4 件は `errors.teardown` に分かれた
- `claude.lock`: 2 個（17497・52266。pid はどちらも起動した本体 60648）。後始末で2個とも消した。この回は他人の `.lock` は増えなかった（`claude.lock-foreign` は出ていない）
- `safety.process-tree`: 木 28 個を止め、残り 0、孤児 0
- `safety.daily-argv`: PASS
- 曹参の申告（確定の2回で FAIL 0）と合う

## 3. 実行の後に記録から分かったこと

1. **2つめのウィンドウでも probe が動いている。** `logs\window2\exthost\exthost.log` の 17 行目に `_doActivateExtension smoke.smoke-probe`（21:59:43）。window2 はフォルダを開かないので、probe は `base.open-folder` を FAIL、`base.edit-save` を `smoke-edit-smoke-edit-before`（2回目の書き込み）で FAIL と書き、同じ `probe-result.json` を上書きした。
   - 今回の `probe-result.json` は `startedAt` 12:59:43Z、`done: false`、項目 2 件（window2 のもの）。判定に使った window1 の結果（30 項目、`done: true`）はファイルに残っていない。
   - 曹参の確定の2回（`official-20261113T124945`・`...T125044`）とほかの回の `probe-result.json` も、`T124137` を除いてすべて `done: false` だった。
2. **UI の言語は毎回英語。** `smoke-result.json` の `probe.uiLanguage` は、全7回（曹参の6回とこの回）とも `"en"`。`argv.json` に `"locale": "ja"` はあり、言語パックも入っている。`user-data\languagepacks.json` は実行の途中にできていた。毎回新しいユーザーデータで起動するため、初回の起動では言語パックが効かない見込み（2回目の起動から効くはず。未確認）。

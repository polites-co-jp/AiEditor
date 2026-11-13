# スモークの台本の検証（2）の実行（公式の zip 1.146.0）

- 実行: 大岡越前守、2026-11-13 23:18〜23:19（JST）
- タスク: `tasks/2026-11-13-p1-verify-smoke-rework/`
- 相手: `C:\b\p0\vscode-1.146.0\`（Code 1.146.0 / 69047191fc）、形態 upstream
- 拡張: 今ある `C:\b\smoke\ext\1.146.0-official\` を使い回した（台帳 `extensions.lock.json` は実行の時点で未変更。入れ直していない）

## 1. 単体テスト

```
node --test tests/smoke.test.mjs
```

tests 60 / pass 60 / fail 0（duration 約 2.2 秒）。

## 2. スモークの実行

```
node tests/smoke-run.mjs --prime --baseline C:/b/smoke/baseline-official-1.146.0.json
```

- 置き場所: `C:\b\smoke\runs\official-20261113T141800\`（`smoke-result.md`・`smoke-result.json`・`probe-result.json`）
- 台本の出力: 「拡張のフォルダを使い回す: C:\b\smoke\ext\1.146.0-official」「言語パックが登録された。起動し直す。」
- 結果: **PASS 47 / FAIL 0 / SKIP 0 / INFO 9**。終了コード 0
- probe: 33 項目が最後まで走った。`probe-result.json` は `done: true`・33 項目・`startedAt` 14:18:18Z（window1）のまま残った
  - window2 の `exthost.log` 19 行目に `_doActivateExtension smoke.smoke-probe`（23:18:43）があるが、結果は上書きされていない（A の直しが効いた）
- `base.replace`: PASS（ディスクに現れた）。実行後の `ws\` の中身は、意図した変更（`edit/replace.txt` → `replaced_ok`、`edit/target.txt` → `smoke-edit-before`、`tracked.txt` に `changed`）を除き、`fixtures.mjs` の内容と同じ。`docs/readme.md` は `smoke_needle` を保っている
- `base.ui-language`: PASS（`ja`）
- `errors.new`: PASS（3回の和の基準に無い誤りなし）。誤りの件数は exthost 2、renderer 62、ほかは 0。止めた後の誤り 1 件は `errors.teardown`
- `claude.lock`: 3 個（18660 は prime の本体 48916、19317・56676 は本番の本体 4404。3個とも開いたフォルダが ws）。後始末で3個とも消した。`claude.lock-foreign` は出ていない（他人の `.lock` は増えていない）
- `safety.process-tree`: 木 27 個を止め、残り 0、孤児 0
- `safety.daily-argv`: PASS
- `--keep-runs`（既定 10）: `runs\` の直下の最も古い `official-20261113T140132` を1つ消した（実行の前は 10 個。`manual-20261113T140546` を含む）。実行の後は 10 個
- 実行の前後で sha256 が同じもの: `C:\b\smoke\baseline-official-1.146.0.json`（2e4a7b4b…942b）、`C:\b\smoke\ext\1.146.0-official.marker.json`（629380f0…cbd）、`C:\b\smoke\ext\1.146.0-official\extensions.json`（4bbd5955…b17c）

## 3. 実行の後に記録から分かったこと

1. **probe の最後の一覧が毎回失敗している。** `probe-result.json` に `"snapshotError": "Cannot read properties of undefined (reading 'fsPath')"`、`"extensions": []`。`commandCount`・`diagnosticsTotal` は無く、`commands.json` もできていない。`runs\` に残る 10 回すべて同じ（`commands.json` は1つも無い）。
2. `--keep-runs` で、以前の記録が指す置き場所（`ooka-verify-20261113T125822`、曹参の `official-20261113T124945`・`...T125044`）はすでに消えている。この記録の1つ前の版（`smoke-verify-official-1.146.0.md`）の置き場所は残っていない。

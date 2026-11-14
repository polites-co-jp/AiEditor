# 検証の記録: 網の直し・checks の見直し・notion-sync の翻訳の直しと、段階 A の関門の3の流し直し

- 検証: 大岡越前守、2026-11-14（JST 23:45〜24:00 ごろ）
- 依頼: `brief.md`（このフォルダ）
- 守ったこと: コードは直していない。書き込みは `records/take-in/`（関門の記録の追記）とこのフォルダ、台本が作る `C:\b\smoke\absent\` だけ。gulp の出力と `C:\b\p2\*-r2` には触れていない（読みも起動もしていない）

## 1. レビュー（差分を読んだ）

`git diff` で読んだ（作業ツリーの未コミットの変更）。

### 1.1 網の直し（曹参）

| ファイル | 読んだ要点 | 判定 |
|---|---|---|
| `tests/removals/probe/extension.js` | 設定は `inspect(key).defaultValue !== undefined`（登録簿）または `vscode.extensions.all` の `packageJSON.contributes.configuration` の properties（manifest）で「在る」。`settingsVia` に網を残す。直す前の `!== undefined` は消えた | 合う（brief の「設定は defaultValue と manifest」） |
| `tests/removals/lib/absent.mjs` | `manifestOf`（commands・menus・keybindings の command、views・viewsContainers の id、configuration の properties）、`collectManifest`（`resources/app/extensions/*/package.json`）。`evaluateAbsent` は runtime か manifest のどちらかで在れば「在る」、結果に `net`。ビューは manifest の views・commands と `<id>.focus` も見る | 合う（brief の「コマンド・ビューは runtime と manifest」） |
| `tests/removals/run-absent.mjs` | `snap.manifest = collectManifest(editor.builtinExtDir)`。`網:` の行と `absent-result.json` の `nets` | 合う。manifest の網は、流したその版の出力を読む（各実行の `nets.manifest.dir` が版ごとの `resources\app\extensions` で、拡張の数も版ごとに 95→91→88→86→84→83→73→65 と減る） |
| `tests/absent.test.mjs`（+6件） | manifestOf・collectManifest・manifest の網の判定2件・probe の2件。probe の件は、登録の無いキーでもオブジェクトを返す偽の `vscode` で `extension.js` をそのまま動かし、対照のキーが false になることを見る（直す前の書き方なら落ちる） | 仕様を確かめている。実装に合わせて緩めた断言は見つからなかった |

気づいた点（合否に使っていない）: manifest の網は menus の `command` も「在る」に数える。消した単位のコマンドを、残る拡張の menus が名指ししていれば、`--expect absent` で fail（厳しい側）に倒れる。今回の5版ではそうした項目は無かった。

### 1.2 checks の変更（蒙恬）

| 単位 | 変更 | 読んだこと | 判定 |
|---|---|---|---|
| A-2 | absentCommands に出力チャネルの表示のコマンド2件を足した | 公式・A-1 の版で runtime で在る（3節・4節の実行で確かめた） | 合う |
| A-5 | absentViews に `~remote.forwardedPorts` を足した。`intent` と README をポートのビューが消える形に直した | 裁定（2026-11-14「Phase 2 の関門で出た点」の A-5 の行: 受け入れる、README を直す）と合う。公式・A-4 の版で runtime で在る | 合う |
| B-3 | `workbench.action.share` を `toggle.workbench.experimental.share.enabled` に替えた。README の「消すもの」に足した | 公式で runtime で在る（3節）。B-3 の版での確かめは `-r2` の関門で行う（brief の5） | 公式の網は合う |
| A-1・A-4・A-7 | checks は変えず、README に「manifest の網で見る」理由を書いた | 公式で manifest の網で在る（3節） | 合う |
| B-4 | README にパンくずリストの `outline.icons` の扱い | 裁定（B-4 の行: 受け入れる、README に書く）と合う | 合う |
| B-1 | unit.json の `absentCommands` が空、`kept` の理由に `_aiEdits.*` | B-1 を直している蒙恬の途中の変更。この依頼の範囲の外として読んだだけ | 判定しない |

### 1.3 有効にした4単位

`removals/{A-3-debug-extensions,A-6-themes,B-5-theme-switching,B-6-online-feeds}/unit.json` が `enabled: true`。4つの関門の記録（`records/take-in/1.146.0-p2-<id>/gate-<id>.md`）の判定の表は、4つとも 1〜4 が **合格**。ほかの単位はすべて `enabled: false`。4つの関門の3はどれも設定の probe に頼っていない（A-3・B-5 はコマンド、A-6 は checks が空、B-6 は absentHosts）ので、probe の不備の影響を受けない。合う。

### 1.4 notion-sync の翻訳の束

- `package.json` の `contributes.localizations`: `languageId: ja`、`languageName: Japanese`、`localizedLanguageName: 日本語`、`translations` は自分の ID `shuko.notion-sync` を `./dist/i18n/shuko.notion-sync.ja.i18n.json` に向ける1件
- `build.mjs` が `builtin-l10n.mjs` で、作る前に項目の形を確かめ、束を書き、読み込みの確かめのあとに束の有無と `contents.bundle` を確かめる。外れれば止める
- 束の形 `{"version":"1.0.0","contents":{"package":{},"bundle":{}}}`。`path` は `dist/` の下（`apply.mjs` の `EXT_DIRS = ["dist", "media"]` に入る）。`extensions-src/notion-sync/dist/i18n/shuko.notion-sync.ja.i18n.json` が在る
- 判定: 形は依頼のとおり。**実機で `No bundle location found` が消えるかは確かめていない**（ビルドが要る。次の版のスモークの errors.new で見る）。拡張が `contributes.localizations` を持つと、本体は言語パックとして扱う場面がある（言語の選択の一覧に「日本語」が出る、など。蒙恬の README の副作用の節）。ほかの副作用が出ないかも次の版のスモークで見る

## 2. テスト

```
node tests/run-all.mjs --save tasks/2026-11-14-p2-regate-a/run-all-counts.txt
```

終了コード 0。**TOTAL tests 1552、pass 1535、fail 0、skip 17**（曹参の報告と同じ）。skip 17 はすべて `removals.test.mjs`。新しいテストは absent 20・builtin-l10n 19・p1-scripts 33・cli-run 14。ps1 は measure 138・netaudit 102 とも落ち 0。出力は `run-all-counts.txt`。

注: 作業ツリーには、B-1 を直している蒙恬の途中の変更（`scripts/build.mjs`、`removals/B-1-telemetry/`）も入っている。この件数はそれを含んだ時点のもの。

判定: **合格。**

## 3. 網になっていることの確かめ（公式の zip）

```
node tests/absent-run.mjs --build C:/b/p0/vscode-1.146.0 --units all --expect present --label regate-official
```

結果: `C:\b\smoke\absent\regate-official-20261114T144944\absent-result.json`。網: runtime（コマンド 2978 件・設定 42 件を照会）+ manifest（拡張 95 件）。終了コード 1（C-1 の2件だけが fail）。

| 単位 | pass / fail | 網 |
|---|---|---|
| A-1 | 3 / 0 | 3件とも manifest |
| A-2 | 7 / 0 | コマンド2 manifest、コマンド2 runtime、設定3 runtime+manifest |
| A-3 | 1 / 0 | runtime+manifest |
| A-4 | 3 / 0 | コマンド2 manifest、設定1 runtime+manifest |
| A-5 | 3 / 0 | コマンド2 manifest、ビュー1 runtime |
| A-6 | （checks が空。一覧に出ない） | — |
| A-7 | 9 / 0 | コマンド3 manifest、設定6 runtime+manifest |
| B-1 | 2 / 0 | 設定2 runtime。`showTelemetry` は B-1 の直しで checks から外れている（brief のとおり除いて書く） |
| B-2 | 8 / 0 | runtime |
| B-3 | 4 / 0 | runtime（替えた `toggle.workbench.experimental.share.enabled` を含む） |
| B-4 | 7 / 0 | runtime |
| B-5 | 6 / 0 | runtime |
| B-7 | 4 / 0 | runtime |
| C-1 | 10 / 2 | fail は `search.action.showAIResults`・absentProcesses `agent-host`（段階 C。範囲の外。曹参・蒙恬の覚えにある既知の2件） |
| C-2〜C-7 | すべて pass | runtime |

判定: **A-1〜B-7 のすべての項目が pass（網になっている）。合格。**

## 4. 関門の3の流し直し

### 4.1 版が変わっていないこと

展開した各版の `resources\app\product.json` の 188 行の commit が builds.md と同じ: A-1 `3f478e8b…`、A-2 `47a15a84…`、A-4 `35a89e77…`、A-5 `ffa17004…`、A-7 `a0690779…`。

### 4.2 各版で `--expect absent`

```
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-<id>/Shuko-win32-x64-1.146.0-p2-<id> --units <単位> --expect absent --label regate-<id>
```

| 版 | 単位 | 結果 | 置き場所（`C:\b\smoke\absent\` の下） |
|---|---|---|---|
| A-1 | A-1-copilot-extension | pass 3 / fail 0 / unknown 0 | `regate-A-1-20261114T145020\` |
| A-2 | A-2-accounts-extensions | pass 7 / fail 0 / unknown 0 | `regate-A-2-20261114T145049\` |
| A-4 | A-4-notebook-extensions | pass 3 / fail 0 / unknown 0 | `regate-A-4-20261114T145111\` |
| A-5 | A-5-remote-extensions | pass 3 / fail 0 / unknown 0 | `regate-A-5-20261114T145133\` |
| A-7 | A-7-unused-extensions | pass 9 / fail 0 / unknown 0 | `regate-A-7-20261114T145200\` |

### 4.3 落ちるべきときに落ちるか（検証役が足した確かめ）

- 前の版で同じ checks を `--expect present`: A-2 の checks を A-1 の版で（7/0）、A-4 を A-3 で（3/0）、A-5 を A-4 で（3/0）、A-7 を A-6 で（9/0）。単位を当てる直前の版では全項目が在る。A-1 の直前は公式（3節）
  - `regate-prev-A-2-on-A-1-20261114T145226\`、`regate-prev-A-4-on-A-3-20261114T145250\`、`regate-prev-A-5-on-A-4-20261114T145314\`、`regate-prev-A-7-on-A-6-20261114T145333\`
- 対照（A-1 の版、`--expect absent`）: `--setting zzzShukoControl.never.registered --cmd zzzShukoControl.never.registered --view zzzShukoControl.never.view --setting editor.fontSize --setting github.gitAuthentication --cmd github.publish`
  - 登録の無い3件は「無い」（pass）。在る3件は fail（`editor.fontSize` runtime、`github.gitAuthentication` runtime+manifest、`github.publish` manifest）。終了コード 1
  - `regate-control-A-1-20261114T145414\`
  - 前回の関門で「在る」を返した対照の設定が、直した probe では「無い」になった

### 4.4 判定

5版とも関門の3は **合格**。1・2・4 は前回の合格のまま（版は同じ）。関門の記録の追記: `records/take-in/1.146.0-p2-{A-1,A-2,A-4,A-5,A-7}/gate-*.md` の最後の節（`git diff --numstat` で追記だけ、消した行 0 を確かめた）。

注: A-1 の3件は、公式でも manifest の網だけで在る（実行時の網の項目は無い）。manifest の網は直した台本の網で、brief の1が挙げる「A-1・A-4・A-7 は manifest の網だけ」に当たる。裁定の「代わりの証拠（拡張の一覧・出力の文字列）」とは別と見て合格にした。リーダーが同じものと見るなら A-1 の3は戻る。

## 5. 流さなかったもの

- B-2・B-3・B-4・B-7 の関門の3（brief の5。`-r2` の版でやり直す）
- B-1（蒙恬が直している）
- notion-sync の翻訳の実機での確かめ（ビルドが要る。次の版のスモークで見る）

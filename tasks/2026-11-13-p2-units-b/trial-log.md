# 試しの記録（作業ツリー C:\b\wt\dev-b）

- 日付: 2026-11-14。担当: 蒙恬。
- 作業ツリー: `git -C C:/b/vscode worktree add C:/b/wt/dev-b 1.146.0` で作った（HEAD `69047191fc4`）。`C:\b\wt\1.146.0` は書き換えていない（最後に `git -C C:/b/wt/1.146.0 status` で変更が無いことを確かめた）。
- 依存の導入・型検査・ビルドは走らせていない。

## 1. edits.patch とパッチの作り方と、作り直しの確かめ

1. 作業ツリーで product.json に overlay を手で当ててコミットした（`5ffbb14bab4`）。
2. その上で、B-1・B-2・B-3 の `edits` と `patches/20` の変更をそれぞれ1コミットにし、`git format-patch -1 HEAD --stdout` の出力をファイルに写した（許可の都合で `-o` も `--output` も使えないため）。`From:` の行だけを `shuko-apply <apply@shuko.invalid>` に書き換えた。
3. 写したファイルが元の変更をそのまま再現するかを確かめた: `5ffbb14bab4` に戻し、4つのファイルを `git am -3` で順に当て、元のコミットとの差を `git diff <元> HEAD --stat` で見た。**差は無かった**（B-1 だけで1回、B-1〜B-3 と 20 の4つで1回）。
4. B-7 は、下の2の A＋B の状態の上で同じ手順で作った（触るファイルはほかの単位と重ならない）。

## 2. apply.mjs で当てた結果（別の蒙恬の `scripts/apply.mjs` を使った）

| 回 | コマンド | 結果 | 記録 |
|---|---|---|---|
| a | `node scripts/apply.mjs C:/b/wt/dev-b --label trial-units-b --only B-1-telemetry,...,B-6-online-feeds --dry-run --checks-out tasks/2026-11-13-p2-units-b/trial/checks-dry-run.json` | 初回は fail: overlay の `removeIfAdded` を apply.mjs が知らない（apply.mjs の担当は `removeIfPresent` に合わせていた）。名前を `removeIfPresent` に戻して再実行し ok | `trial/checks-dry-run.json` |
| b | B-1〜B-6、本番（dry-run なし） | ok。全単位の ops・edits、`patches/20`、assets、mydist が当たった。`absentStrings` 全件0、`remnants` ok、`registeredKeys` ok（`shukoConfigurationDefaults` は `configurationRegistry.ts` で見つかった） | 上書き済み（下の d が最新） |
| c | A-1〜A-7 と B-1〜B-6 | fail。A-3 の `absentStrings`（`ms-vscode.js-debug` が product.json に残る）だけ。B の単位の検査はすべて ok。リーダーの指示で overlay の `set` に `builtInExtensions: []` を足して解消 | 上書き済み |
| d | A-1〜A-7 と B-1〜B-7 | **ok**。警告は A-1・A-6 の edits の作者名だけ（段階 A の担当の分） | `trial/checks-with-a.json` |
| e | B-1〜B-7 だけ | **ok**（A が無くても B は当たる） | `trial/checks.json` |

- d・e の後で、消した部品を import している残りを `grep` で探した（`from '...'` と副作用の `import '...'` の両方。B-7 の `ITerminalCompletionService` などの名前も）。見つからなかった。
- 作業ツリー `C:\b\wt\dev-b` は、最後の e の状態（B-1〜B-7 と patches/20・assets・mydist を当てた状態、HEAD は `apply: builtin extensions`）で残してある。検証で使える。

## 2.1 リーダーの判断（2026-11-14）の後の再実行

B-1 に `terminalContrib/telemetry`、B-7 に `services/suggest` を足し、`patches/30-proxy-direct-without-settings.patch`（WPAD）と、`scripts/make-icons.mjs` で書き出した PNG・ICO を足してから当て直した。

| 回 | 中身 | 結果 | 記録 |
|---|---|---|---|
| f | A-1〜A-7 と B-1〜B-7、mydist は今の `extensions-src`（実物） | **fail**。`registeredKeys` だけ: mydist の既定 `workbench.startupEditor`（B-2 が登録ごと消す）と `terminal.integrated.suggest.enabled`（B-7 が消す）が `unregistered`。apply.mjs の担当が registeredKeys を直し、登録の無いキーを見分けるようになったため（私の前の報告の未解決の4は、これで解けた） | `trial/checks-with-a.json` |
| g | f と同じ単位、mydist は試し用の写し（上の2キーを外したもの。B-2・B-7 を有効にした後の姿）`--extensions-src tasks/2026-11-13-p2-units-b/trial/extensions-src-units-enabled` | **ok** | `trial/checks-with-a-units-enabled-mydist.json` |
| h | 単位を当てない（今の `enabled` のまま。実際のビルドと同じ）、mydist は実物 | **ok**。overlay・patches/20・30・assets（PNG・ICO を含む）・mydist が当たった | `trial/checks-no-units.json` |
| i | B-1〜B-7 だけ、mydist は試し用の写し | **ok** | `trial/checks.json` |

- f の失敗は単位の誤りではなく、「単位を有効にするときに mydist の既定を外す」手順が要ることを示す。単位は今 `enabled: false` なので、実際のビルド（h）は通る。扱いは `handoff-notes.md` の追記の「未解決」。
- i の後、消した部品（`terminalContrib/telemetry`・`services/suggest`）への参照を `grep` で探し、残りが無いことを確かめた。作業ツリー `C:\b\wt\dev-b` は i の状態で残した。

## 3. removeLines の照合

`trial/checks.json` の `units[].ops.removeLines` のとおり、すべて `found: 1`（ちょうど1行）。

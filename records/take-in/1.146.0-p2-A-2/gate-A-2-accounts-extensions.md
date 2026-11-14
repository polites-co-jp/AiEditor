# 関門の記録: A-2-accounts-extensions（版 `1.146.0-p2-A-2`。A-1, A-2）

- 検証: 大岡越前守、2026-11-14（JST 22:12〜22:18）
- 依頼: `tasks/2026-11-14-p2-gates/brief.md`。条件は docs/03 の7節
- 相手: `C:\b\dist\1.146.0-p2-A-2.zip`（SHA-256 `8c7fc0a7…cef8e`。`sha256sum` で計算し直し、builds.md と一致）を展開した `C:\b\p2\1.146.0-p2-A-2\Shuko-win32-x64-1.146.0-p2-A-2\`（commit `47a15a84…9546`）
- 比べる相手: 前の版 `1.146.0-p2-A-1`（基準 `C:\b\smoke\baseline-p2-A-1.json`。3回の和、鍵 5 個）

## 判定

| 関門 | 結果 | 要点 |
|---|---|---|
| 1. 当たる | **合格** | `checks.json` の `result: ok`。A-2 の delete 3・removeLines 10/10（どれも found 1）、パッチ無し（`edits.applied: none`。unit.json に patch が無い）。検査6つ ok。absentStrings は A-1 の5・A-2 の3 とも 0 件 |
| 2. 型検査とビルド | **合格** | `build-record.json` の install・lockfile・typecheck・package・postprocess・zip がすべて ok・終了コード 0。product.json の commit = HEAD `47a15a84…`（`productCommit.ok`、`matchesChecksHead`、展開した product.json の 188 行） |
| 3. 消えている | **判定できない** | absentSettings の3件は台本の不備で区別できない。absentCommands の2件は公式でも取れない（2節） |
| 4. 壊れていない | **合格** | 3回とも PASS 49 / FAIL 0。errors.new は3回とも「新しい誤りなし」。claude-code の組は3回とも3項目 PASS |

## 1. 当たる・型検査とビルド

- ロックファイル: `extensions/pnpm-lock.yaml` だけが変わった。importers から github・github-authentication・microsoft-authentication が消え（`expected.removedImporters` と一致）、packages・snapshots から 43 件ずつ消えた。追加・版の変化・予期しない削除は 0（`addedDeps`・`changedDeps`・`addedPackages`・`unexpectedRemovedImporters`・`unexpectedRemovedDeps` がすべて空）
- `sourceVersion.uncommittedEntries: 1` は、依存の導入で作り直したロックファイルの変更（ロックファイルはパッチにしない規則、docs/03 の5.4）。HEAD との一致の条件には影響しない
- 後処理: 組み込み拡張 88、消え残り 0、keep.json の不足 0。`github`・`github-authentication`・`microsoft-authentication` は出力に無い

## 2. 消えている

```
node tests/absent-run.mjs --units A-2-accounts-extensions,A-3-debug-extensions,A-4-notebook-extensions,A-5-remote-extensions --expect present --label p2-A2-A5-official-present
node tests/absent-run.mjs --build C:/b/p2/1.146.0-p2-A-2/Shuko-win32-x64-1.146.0-p2-A-2 --units A-1-copilot-extension,A-2-accounts-extensions --expect absent --label p2-A-2
```

| 項目 | 公式（present） | A-2（absent） |
|---|---|---|
| absentCommands `github.publish` | **無い** | 無い |
| absentCommands `github.copyVscodeDevLink` | **無い** | 無い |
| absentSettings `github.gitAuthentication` | 在る | **在る** |
| absentSettings `github-authentication.preferDeviceCodeFlow` | 在る | **在る** |
| absentSettings `microsoft-authentication.implementation` | 在る | **在る** |

結果: `C:\b\smoke\absent\p2-A2-A5-official-present-20261114T131251\`、`C:\b\smoke\absent\p2-A-2-20261114T131316\`

- 設定の検査は、登録の無いキーでも「在る」を返す（A-1 の記録の2節の対照。曹参の `tests/removals/probe/extension.js` の15行）
- コマンドの2件は、公式の実行でも登録されていない（github の拡張は動作中だが、この2件は実行時に登録されていない）。A-2 での「無い」は証拠にならない
- 参考（判定には使わない）: 5件の ID の文字列は、出力の `resources\app` では `extensions\git` の中だけにある（`git\package.json` は `github.gitAuthentication` を非推奨の案内の文に書いているだけで、登録ではない）。公式では `extensions\github`・`github-authentication`・`microsoft-authentication` の package.json にある

直す必要があるところ: A-1 の記録の2節と同じ（曹参: probe の設定の見方、コマンドの見方。蒙恬: 公式で「在る」になる `absentCommands` を選ぶ）。

## 3. 壊れていない

```
node tests/smoke-run.mjs --build C:/b/p2/1.146.0-p2-A-2/Shuko-win32-x64-1.146.0-p2-A-2 --label p2-A-2 --mode built --prime --baseline C:/b/smoke/baseline-p2-A-1.json --save-baseline C:/b/smoke/baseline-p2-A-2.json --timeout 300 --keep-runs 40
（同じ引数で --label p2-A-2-b2 / p2-A-2-b3、--merge-baseline を足して2回）
```

| 実行 | 置き場所 | 結果 |
|---|---|---|
| 1 | `C:\b\smoke\runs\p2-A-2-20261114T131345\` | PASS 49 / FAIL 0 / INFO 9 |
| 2 | `C:\b\smoke\runs\p2-A-2-b2-20261114T131500\` | PASS 49 / FAIL 0 / INFO 9 |
| 3 | `C:\b\smoke\runs\p2-A-2-b3-20261114T131619\` | PASS 49 / FAIL 0 / INFO 9 |

- 誤りの種類ごとの件数は A-1 と同じ（exthost 3・renderer 2・other 2）。基準 `baseline-p2-A-2.json` は3回の和で鍵 5 個
- claude-code の組: 3回とも `claude.running`・`claude.exthost-log`・`claude.lock` が PASS
- コマンドの数は 3294 → 3282（github の拡張の分が減った）。拡張 11（動作中 8）は同じ
- docs/03 の表の注意「`defaultChatAgent.providerExtensionId` が `vscode.github-authentication` を指すので、チャットの設定の画面がエラーを出す恐れ」: 自動のスモークの範囲では、誤りの一覧に出なかった。チャットの設定の画面を開く項目は台本に無いので、画面の上でのことは確かめていない

# p34-tests 引き継ぎ（曹参、2026-11-14）

- 結果: 完了（実装に当てて走らせた。落ちたのは1件）
- 設計: `tests-p34-design.md`（何を確かめるか・作っていないもの）
- 全体の走らせ: `run-all-result.txt`（`node tests/run-all.mjs`）

## 成果物

- `tests/take-in.test.mjs`（95 件）、`tests/watch.test.mjs`（99 件）、`tests/notion-sync.test.mjs`（101 件）。実装を直接 import する。
- 廃止（中身は空。リーダーが `git rm` してよい）: `tests/p34/api.mjs`、`tests/fixtures/ref-p34/ref.mjs`、`tests/p34-selfcheck.test.mjs`。最初の版（実装が無かったとき）の仮の入口と参照実装の跡。

## 実行結果

`node tests/run-all.mjs`: 1307 件、通過 1292、失敗 1、飛ばし 14（飛ばしは既存の removals.test.mjs の分）。今回の3本は 295 件中 294 通過、失敗 1。

落ちた1件の切り分け:
- `take-in.test.mjs: outsideAllowed: ../ で外へ出るパスを通さない`: **実装の不具合（軽い）**。`scripts/lib/take-in/repair.mjs` の `outsideAllowed` は `removals/../src/x.ts` を許す（`startsWith("removals/")` だけを見ていて、`..` を解いていない）。TAKE-IN.md と docs/06 の7.2 は「`removals/`・`patches/` の外を書き換えない」。ただし `git status --porcelain` は `..` を含むパスを出さないので、いま実際に通ることは考えにくい。守りの二重の確かめとしては穴。直すなら蒙恬（`path.posix.normalize` してから前方一致）。テストは仕様どおりなので変えていない。

## 入口を合わせたこと

名前と形は3つの設計の書き物のとおりで、ずれは無かった。`nextManifest` の `deleted` は省略不可（テストの誤りで、テスト側を直した）。

## 仕様と実装の食い違い（決めずに報告）

- docs/06 の2.3「`ext <id> <version>`」の起動コマンド、watch の ToDo のメモは `take-in.mjs ext <id> <version>`。take-in は `<version>` を省ける。食い違いではない（直した docs のとおり）。
- watch-design.md の5.3: 既存の ToDo を直すとき、優先度は高い方・期限は早い方（下げない・延ばさない）。docs/06 の2.3 は「最新の版に直し」「セキュリティ修正が加わったら上げる」で、延ばさないことは書いていない。実装は蒙恬が判断を仰いでいる点。テストは「下げない・延ばさない」を期待にした。裁定が違えばテスト（`upsertTodo: 後から出た通常の版は…`）を直す。
- 失敗の ToDo「更新の検知が失敗しています」の優先度は高・期限は翌日（docs/06 に表が無く、蒙恬が仮に決めた）。テストは題名と中身だけを見て、優先度と期限は見ていない。
- docs/06 の2.2 の「リリースノートに security の記述がある」は、実装では「その版の `Update x.y.z` の文」に security があるか（と GitHub のリリース本文）。テストはその読み方で書いた。
- 判定の cwd: 2026-11-14 に docs/06 の7.1 が直り、CLAUDE.md と一致した（前回の食い違いは解消）。

## 追記（2回目の依頼: p34-verify の T-1〜T-4、CLI の試し、M-1〜M-3）

結果: 完了。`node tests/run-all.mjs`（`run-all-result2.txt`）は 1386 件、通過 1372、失敗 0、飛ばし 14（既存の removals の分）。前回の失敗 1 件（`outsideAllowed` の `..`）は蒙恬が直し、今は通る。

新しいテスト（4本）:
- `tests/switch-expand.test.mjs`（17 件）: T-1。
  - `switch.ps1 -ExpandOnly`: 試しの installRoot で current・history.txt・backups・ユーザーのデータが変わらないこと（今の版が有る場合も無い場合も）、`-Zip` なしの確かめだけ、`-Sha256` 違い・既存フォルダ・`-List`/`-Previous` との併用で止まること、engines を見ないこと、後の普通の切り替えで初めて current ができること。
  - `build.mjs`: `applyPassThrough` の順と絶対パス、`--dry-run` で apply に受け渡しの引数と `--removals`・`--build-root`・`--config`、lockfile の手順にも同じ `--removals`、既定の `removals/`、何も書かないこと。
- `tests/take-in-more.test.mjs`（43 件）: T-2・T-3・M-1・M-2・CLI。
  - 修理の `claude -p`: `--strict-mcp-config`、`--tools` に Bash が無い、`--add-dir` は builderWorktree が先、`--append-system-prompt-file`、`acceptEdits`。
  - `normalizeRepoPath`・`isInsideAllowed`・`outsideAllowed`: `C:/x`、`/x`、UNC、中に留まる `..`、外へ出る `..`、前方一致の偽装。
  - `smoke-net.mjs`: 3回の基準（1回目 `--save-baseline`、2・3回目 `--merge-baseline`、`--prime`）、監査の環境と引数。
  - M-1: take-in の apply に `--build-root`・`--config`（`--dry-run` の計画で確認）。M-2: ext の書き戻しは台帳の `entry.id`（ソースの形を見るテスト）。
  - CLI を子のプロセスで呼ぶ試し: `take-in.mjs core 1.147.0 --dry-run`、`ext anthropic.claude-code --dry-run`（版の省略・`--security`・台帳に無い ID）、`probe-claude --dry-run`、`adopt.mjs`（一時の git リポジトリ。`--dry-run`、fail は 4、各種の止まり方、実際のマージ・記録・タグ・ブランチ削除・push しないこと、衝突での `--abort`）。`--claude` に `node.exe` を渡すので `claude` は起動しない。`ANTHROPIC_API_KEY` を入れた環境でも外すことと、値が出ないことも確認。
- `tests/cli-run.test.mjs`（14 件）: `watch.mjs` を `--fixtures`・`--notion-fake`・一時の builderRepo・installRoot・state-dir・`LOCALAPPDATA` で呼ぶ。`--dry-run`（何も書かない）、作成・重複しない・state.json 紛失・Done 後の新規、`--check`、項目違いで書かない、`--check-token`、`--write-back`。notion-sync の `pnpm run build`（下の注意）、package.json の宣言（main・onStartupFinished・設定3つ・コマンド5つ・依存の固定）。
- `tests/watch.test.mjs` に追記（104 件）: T-4 `readNotionToken` が `-ExecutionPolicy Bypass` を `-File` の前に付ける。M-3（覚えたページが Done・Archived・ごみ箱なら書かない・In progress に戻さない・検索に回る・無ければ ok:false）、M-2（大文字を含む ID を state.json 無しで見つける）。

M-1・M-2・M-3 は蒙恬の直しがすでに入っていて、テストは最初から通った。

注意:
- notion-sync の build の試しは、拡張のフォルダを一時の場所へ写して `pnpm --dir <写し> install --frozen-lockfile --ignore-scripts` と `pnpm --dir <写し> run build` を行う（リポジトリに `dist/`・`node_modules/` を作らない）。npm のレジストリへの接続が要る（初回 5 秒ほど。pnpm のキャッシュがあった）。飛ばすには `P34_SKIP_BUILD=1`。
- `adopt.mjs` の試しは、`scripts/` を写した一時の git リポジトリで動かす（本物のリポジトリには触れない）。リポジトリ内に `records/take-in/dry-1` などを作らないことも確認している。
- 今回の4本は run-all の実行時間を増やす（switch-expand が約 35 秒）。

## 作っていないもの

`tests-p34-design.md` の4節。実走が要るもの（取り込みの台本、adopt のマージ、`claude -p` の起動、タスクスケジューラの登録、拡張のビルド、別ユーザーでの DPAPI）。

## 権限

- Bash は許可の形（`node --test tests/*.test.mjs`、`node tests/*.mjs` など）だけ。`--test-reporter` 付きと `node --check` は通らなかった。
- バックグラウンドの出力ファイル（`%TEMP%` の下）は読めないので、`run-all.mjs --save tasks/…` で保存して読んだ。

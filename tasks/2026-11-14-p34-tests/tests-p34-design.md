# 取り込み・更新の検知・notion-sync の単体テストの設計

作成: 曹参（2026-11-14）。仕様は docs/06 の2・3・4・6・7・8節、docs/05 の2・3・5・6・8・9節、CLAUDE.md の起動の注意。
経過: 最初は実装も設計の書き物も無く、仮の入口（`tests/p34/api.mjs`）と参照実装で書いた。蒙恬3人の実装がそろったので、入口の名前と形だけを設計の書き物（take-in-design.md の11節、watch-design.md の3節、notion-sync-design.md の5節）から合わせ、テストは実装を直接 import する形に作り直した。期待値は docs から書いたまま（実装から写していない）。

## 1. ファイル

| パス | 中身 |
|---|---|
| `tests/take-in.test.mjs` | 取り込み（`scripts/lib/take-in/*`、`take-in.mjs`・`adopt.mjs` の入口）。95 件 |
| `tests/watch.test.mjs` | 更新の検知（`tools/watch/*`、`scripts/lib/notion-*.mjs`、`read-secret.ps1`）。99 件 |
| `tests/notion-sync.test.mjs` | notion-sync（`extensions-src/notion-sync/src/*.mts`）。101 件 |

置き場所: notion-sync のテストは `extensions-src/notion-sync/test/` でなく `tests/` に置いた（許可の範囲ではどちらも可。`tests/run-all.mjs` が拾うため）。Node 24 の型の除去で `.mts` を直接読む。

廃止（リーダーが `git rm` してよい）: `tests/p34/api.mjs`、`tests/fixtures/ref-p34/ref.mjs`、`tests/p34-selfcheck.test.mjs`（中身は空にしてある。使わない）。

実行: `node --test tests/<名前>.test.mjs`、全部は `node tests/run-all.mjs`。本物の Notion・GitHub・Open VSX・`%LOCALAPPDATA%\Shuko\` の秘密の場所には触れない（差し替えと一時フォルダだけ。DPAPI の読み戻しは一時フォルダにでたらめな値で作る）。

## 2. 何を確かめるか

### 取り込み（docs/06 の4・6・7・8節、CLAUDE.md）
- 手順の並び `[1,2,3,4,5,6,7,9,10]`（8 が無い）、`--from/--to`。
- 止まる条件の表: 手順 1（タグ無し）・3（3回で直らない。`--max-repair`）・4（検査を満たさない。未分類の拡張だけは `hold`）・5（ビルド。型検査だけ修理へ）は止まる。2 は修理へ。6・7・9・10 は止めない。知らない番号（8 を含む）は例外。`checksOutcome`。
- verdict.json: docs/06 の7.3 の例が通る、11 の必須キー、列挙、型、`proposal` の形、合格と build・checks・smoke・newHosts の矛盾、オブジェクトでない入力、`guardVerdict`（台本の記録との食い違い）。
- `claude -p`: `-p`、`--bare` なし、`--agent di-renjie`（判定のみ）、判定の cwd はリポジトリ直下（2026-11-14 に直した docs/06 の7.1）、修理の cwd は作業ツリーで `--add-dir` にビルドリポジトリ、`ANTHROPIC_API_KEY` などを外す（大文字小文字を問わず、`CLAUDE_CODE_SIMPLE`・`ELECTRON_RUN_AS_NODE`・`VSCODE_*` も）、呼び出し側の env を壊さない、`--setting-sources` があれば project を含む、`switch.ps1`・`install-extensions` を実行する道具を渡さない、出力の読み取り、`.cmd` の包み。
- 修理: 当たらなかった理由の分類、衝突の印、`removals/`・`patches/` の外の変更の検出（前方一致の偽装・`..`）、直したファイルの持ち主の分け方。
- 引数（`ext` の版の省略を含む）、ラベルとブランチ、前回から後のリリース・アドバイザリの選び出し（1週に複数、`vsda-v`、1.10.0 > 1.9.0）、`git ls-remote` の読み取り。
- 書き戻し: 部品が無い・例外・`reason` の写しで止めない、検知の最後の成功が3日より古いと警告。
- adopt の計画: マージ → 記録 → タグの順、`push` を含まない、fail は `--force` が無ければコード 4、main にいない・変更あり・ブランチ無し・タグ既存・判定無し・ラベル不一致で止める、`--keep-branch`・`--no-records`、ext は `install-extensions.mjs` を次に出す。
- 入口（副作用なし）: 引数なし・足りない引数・知らないサブコマンドは終了コード 2。`TAKE-IN.md` に docs/06 の7.2 の規約とコミットの名前がある。

### 更新の検知（docs/06 の2.2・2.3・2.4）
- 取得先の URL、応答の読み方、リリースノートの security の文（`1.145.3` と `1.145.30` の取り違え、`x.y.0`、他の版の文に釣られない）。
- 「セキュリティ修正あり」の (a)(b)、前回の状態との比べ（新しい版だけ、同じ版は通知しない、まだ見ていないアドバイザリで出し直す、取れなかったとき）、ToDo の中身（題名・優先度・期限・形式・プロジェクト・メモの中身と 2000 文字、タイムゾーンの日付、月・年・うるう日）。
- 重複: 作る／直す／Done・Archived の後は作り直す／ページが消えている／state.json が無いときの検索／本体と拡張が混ざらない／優先度と期限は上げるだけ。
- 通し（`runWatch` に GitHub・Open VSX・Notion の差し替えを渡す）: 新版なし、作成と再実行で足さない、セキュリティ修正が加わると直す、Done の後は新規、state.json の紛失・破損、`--dry-run` は何も書かない、3日続けた失敗、成功に戻ると解除、アドバイザリだけ失敗、401 で `lastSuccessAt` を進めない、項目の不一致で書かない、トークンが出ない。
- Notion の呼び出し: ヘッダ・宛先・429/529 の `Retry-After`・上限・503 の扱い・404。トークンの読み出し（`readNotionToken` と `read-secret.ps1` の終了コード 2・3・4 と読み戻し）。
- 取り込みの書き戻し: 本文に要約を足し In progress にする、ページの見つけ方、止めない。

### notion-sync（docs/05）
- 2000 文字の境目（1・1999・2000・2001・4000・4001・サロゲートペア・20万文字の上限）、正規化とハッシュ。
- 競合の3通りと基底が無い・消えたとき（`decide`・`decideAll`）。実際の2台の流れ（初回、取り込み、書き出し、競合、競合の解き方、`rev` の食い違いでのやり直し、`mode`、近道、削除、Notion での手編集、offline、manifest の破損、ページの変更、上限超過で何も書かない）。
- `ignoredSettings`: 除く・保つ・コメント・末尾のカンマ・前方一致・入れ子・往復・手元に無いキー。
- 同期するもの・しないもの 5 + 21 件。manifest の形と並び、ページの読み方、`createNotionClient`（ヘッダ・ページ送り・429/529・上限・400/404・NetworkError・間隔・500KB）、`chunkForAppend`、User フォルダの置き場所。

## 3. Notion の代役

`tests/watch.test.mjs` と `tests/notion-sync.test.mjs` の中に自前で持つ（実装の `fake-notion.mjs`・`dev/fake-notion.mts` は使わない）。本物の上限（`text.content` 2000 文字・`rich_text` 100 要素・`children` 100 個）と、docs/06 の2.3 の項目名・型を検査し、破ると例外にする。

## 4. 作っていない・できていないもの
- 取り込みの台本の実走（ビルド・スモークが要る）と、adopt の実際のマージ（試しの clone が要る）。計画の純粋な関数だけ見た。
- `claude -p` の実際の起動（API キーを使わない起動の確認は蒙恬の試し）。引数の組み立てだけ見た。
- タスクスケジューラの登録（`register-task.ps1`）、`set-token.ps1`、`check-dpapi.ps1`（対話の入力や登録が要る）。
- 拡張のビルド（esbuild）と `extension.mts`（vscode が要る）。純粋な部品は `vscode` に依存せず、単体で走る。
- DPAPI が別のユーザーで復号できないこと（docs/06 の2.4。Phase 4 で別のユーザーで確かめる項目）。

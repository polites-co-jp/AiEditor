# Phase 2 テストの設計

実装を読まずに、仕様（docs/）から書いた。蒙恬の成果（`scripts/lib/apply/`・`removals/`・`builtin/keep.json`・`product.overlay.json`）は、書いた時点で一つも無かった。

## 走らせ方

```
node --test tests/apply.test.mjs          # apply.mjs の純粋な部品
node --test tests/removals.test.mjs       # unit.json・keep.json・overlay の形
node --test tests/absent.test.mjs         # 「消えている」の判定部分
node --test tests/apply-selfcheck.test.mjs  # apply.test.mjs 自体の矛盾の確認（参照実装に向ける）
node tests/absent-run.mjs --build <ビルドのフォルダ> --expect present|absent ...   # ビルドを実際に起動して確かめる
```

## テストの一覧と仕様の出どころ

### tests/apply.test.mjs（33 件。入口は tests/apply/api.mjs に集約）

| 対象 | 見るもの | 出どころ |
|---|---|---|
| removeLines | 前後の空白を除いた完全一致、部分一致は不一致、正規表現にしない、ちょうど1行、0行・2行以上は Error、`count`、CRLF と末尾の改行を保つ、入力を変えない | docs/03 3.1 の removeLines の行、5.1 |
| orderUnits | `order` の昇順、`enabled:false` を飛ばす、`after` が実在・有効・先に当たる、重複 id、無効な単位は検査しない、入力を並べ替えない | docs/03 3.1 の order・enabled・after、5.1 の2-1 |
| applyOverlay | `set` の置き換え、オブジェクトは丸ごと置き換え、`remove`、本家に無い remove のキーは警告、入力を変えない、set と remove の同居は Error、「本家が足したら remove」 | docs/02 3節（表と末尾の1文） |
| findUnclassifiedExtensions | keep にも単位にも無い名前だけ、無効な単位の delete も分類済み、前方一致で誤らない | docs/03 4節の末尾、6節 |
| flagNewComponents | chat・agent・copilot・mcp・telemetry・experiment・survey を含む名前、大文字小文字を区別しない、全件を返す | docs/03 6節 |

### tests/removals.test.mjs（実装が出たときに動く。いまは飛ぶ）

- unit.json（単位ごとに生成）: id とフォルダ名、`<段階>-<番号>-<名前>` の形、stage と id の頭、order の整数と段階の範囲（A=100台・B=200台・C=300台）、必須項目と型、delete の相対パス、removeLines の `{file,line,count?}`、kept の path と reason、checks の既知の名前と型、`after` が実在・自分以外・自分より前の order、README.md と patch の実在、有効な単位の `after` がすべて有効。
- 全体: id と order の重複なし、`after` に循環なし。
- keep.json: 読める・理由がある・重複なし、docs/03 4節の「少なくとも載せる」22 件、残すと消すの両方に載らない、**本家 1.146.0 の `extensions/*` がすべて keep.json か単位の delete に載る**（`C:\b\wt\1.146.0` を読む。環境変数 `AIED_UPSTREAM` で変えられる）、keep.json と delete の名前が本家に実在する。
- overlay: `set`/`remove` の形と同居なし、**`extensions.allowed` が台帳の ID とちょうど一致**（`*`=false、残り=true、台帳の ID の重複なし。大文字小文字は区別しない）、他の既定 5 件の値、単位の productRemove が set と矛盾しない。
- 台帳の ID が重複しない（これだけは今も動く）。

### 「消えている」（docs/03 7節の3）

- `tests/removals/lib/absent.mjs`: 判定の純粋な関数。`tests/absent.test.mjs`（14 件）が試す。
  - absentCommands: snapshot のコマンド一覧と完全一致。
  - absentViews: ビュー ID 自身か `<id>.focus` のコマンドの有無（ビューを登録するとフォーカスのコマンドができる）。
  - absentSettings: 試験用の拡張が `getConfiguration().inspect(key)` で登録の有無を取る。調べていないキーは `unknown`（pass にしない）。
  - absentProcesses: 起動した木のプロセスの名前かコマンドラインの断片。
  - `--expect present`: 公式の zip など「まだ消していない」ビルドで、在ることを確かめる（網が空振りしていないことの確認）。
- `tests/removals/probe/`: 試験専用の拡張（配らない）。`tests/absent-run.mjs`（中身は `tests/removals/run-absent.mjs`）が `--extensionDevelopmentPath` で読み込む。
- 台本の安全: 書き込みは `C:\b\smoke\absent\` の下だけ（`assertSafeWritePath`）、`VSCODE_PORTABLE` でデータを分ける、止めるのは起動した PID の木だけ（`stopTree`）。
- 範囲外: `absentStrings` は apply.mjs の適用後の検査（docs/03 6節）、`absentHosts` は `scripts/netaudit.ps1` の担当。結果に出さない。

## 仕様から想定した入口（蒙恬の設計の書き物に合わせて tests/apply/api.mjs だけを直す）

`scripts/lib/apply/*.mjs` の export を全部読み、次の名前（別名の候補つき）を探す。見つからない名前のテストは「実装なし」で飛ぶ。

```
removeLines(text, { line, count = 1 })          -> { text, removed }      0行・個数違いは Error
orderUnits(units)                               -> enabled な単位の配列（order 昇順）。after 違反・重複 id は Error
applyOverlay(product, overlay)                  -> { product, warnings }
findUnclassifiedExtensions(names, keep, units)  -> string[]
flagNewComponents(names)                        -> { name, highlight }[]
```

仮定が強い点（実装と合わなければ、テストか設計のどちらが正しいかを決めずに報告する）:

1. overlay の「本家が足したら remove」の書き方。`removeIfPresent` という配列を想定した。docs/02 に書き方の指定が無い。
2. keep.json の形。`{ "keep": [{ "name", "reason" }] }` か、配列そのものを想定。`unit.json` の `delete` は `extensions/<名前>` で渡す想定。
3. `set` と `remove` に同じキーがあったら Error（仕様に明記は無い。矛盾した宣言を黙って通さない、という判断）。
4. 空の `line` の removeLines は Error（仕様に明記は無い）。

## 実行結果

- `node --test tests/absent.test.mjs tests/removals.test.mjs tests/apply.test.mjs`: 62 件のうち pass 15・fail 0・skip 47（実装なし）。
- `node --test tests/apply-selfcheck.test.mjs`: 33 件 pass（参照実装 `tests/fixtures/ref-apply/ref.mjs` に向けた。テスト自体が矛盾していない確認）。
- 公式の zip（`C:\b\p0\vscode-1.146.0`）で `--expect present`、`workbench.action.debug.start`・`workbench.view.debug`・`debug.console.fontSize`・`chat.agent.enabled`・プロセス `copilot` の 5 件: 5 件とも「在る」を取れた（検査の網が働く）。起動したのは 1 本で、11 プロセスの木を止めた。結果: `C:\b\smoke\absent\p2try-20261113T150420\absent-result.json`。

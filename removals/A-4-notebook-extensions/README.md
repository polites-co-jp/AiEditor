# A-4-notebook-extensions

Jupyter ノートブックの組み込み拡張を消す（docs/03 の4節の段階 A。裁定でノートブックは消す）。

## 消すもの

| 種類 | 中身 |
|---|---|
| フォルダ | `extensions/ipynb`（`.ipynb` の読み書き。ノートブックの直列化の提供者）、`extensions/notebook-renderers`（セルの出力の描画） |
| 一覧の行（removeLines） | `build/npm/dirs.ts`・`extensions/pnpm-workspace.yaml`・`build/gulpfile.extensions.ts` の2件ずつ、`build/lib/extensions.ts` の `esbuildMediaScripts` の2件（`ipynb/esbuild.notebook.mts`・`notebook-renderers/esbuild.notebook.mts`。残すと `compile-extension-media-build` が消えた台本を探して止まる） |

パッチは無い。

## 残すもの

- 本体のノートブック（`contrib/notebook`・`contrib/replNotebook`・`contrib/interactive`、`services/notebook`）と拡張 API の `vscode.notebooks`（C-4 で消す。API は何もしない実装で残す）。
- `markdown-language-features`・`markdown-math` のノートブック向けの部分（Markdown のセルの描画）。拡張ごと残す（`builtin/keep.json`）。
- `build/lib/electron.ts` の `'Jupyter': 'ipynb'`（macOS のファイルの関連づけ。Windows では使わない）。

## 影響しうるもの

- `.ipynb` を開くと、ノートブックの直列化の提供者が無いので、ノートブックのエディタで開けない。テキスト（JSON）として開くか、エラーを出す見込み（推定）。
- 本家のテストの台本（`scripts/test-integration.*`、`.vscode-test.js`）は `ipynb`・`notebook-renderers` の組を持つ。本家のテストは関門に入っていないので直さない。

## 壊れたときの症状と戻し方

| 症状 | 見込みの原因 | 戻し方 |
|---|---|---|
| `compile-extension-media-build` が `ipynb/esbuild.notebook.mts` を探して止まる | 本家が別の一覧に台本を足した | 増えた一覧の行を `removeLines` に足す |
| 起動時にノートブックの描画の提供者を探すエラー | 本体のノートブックが既定の描画を探す | C-4 まで様子を見る。出続けるなら報告する |

戻すときは `enabled: false` にしてビルドし直す（docs/03 の8節）。

## 消えたことの検査（checks）

- `absentCommands` の2件（`ipynb.newUntitledIpynb`・`ipynb.openIpynbInNotebookEditor`）は **manifest の網**（`extensions/ipynb/package.json` の `contributes.commands`）で見る。`ipynb` は `.ipynb` を開くまで起動しないので、実行時の網では公式でも「無い」になる（関門の記録 `records/take-in/1.146.0-p2-A-4/gate-A-4-notebook-extensions.md`）。
- 実行時の網で公式に「在る」になり、この単位で消えるコマンドは見つからなかった（`ipynb` が manifest に持つ `notebook.cellOutput.*` は本体も登録するので網にならない。`notebook-renderers` はコマンドを持たない）。実行時の網は設定 `ipynb.pasteImagesAsAttachments.enabled`（登録簿で見える）が担う。

## 未確認

- `.ipynb` を開いたときの動き（スモークの base で、開発者ツールのコンソールに誤りが出ないか）。
- 全文検索（裁定で残す）がノートブックの検索と結びついている恐れ（docs/03 の C-4 の注）。この単位では本体を残すので影響しない見込み。

# 未訳を残さず日本語にする（本体と同じ版の日本語パック）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-17
- 状態: 完了

## 目的

裁定（2026-11-17。`docs/user-decisions.md` の末尾）: 未訳の部分を英語のまま残さず、日本語にする。進め方は `docs/04-bundled-extensions.md` の7節（本体と同じ版の日本語パックを自分で作り、公式の訳に無い文言は課が訳を足す）。

## 入力

- `docs/04-bundled-extensions.md` の1節・4節・5節・7節、`docs/02-repository-and-build.md` の3節（`extensions.allowed` の既定）
- リーダーが読んで確かめたこと（2026-11-17）:
  - 今の日常の版 `%LOCALAPPDATA%\Programs\Shuko\versions\1.146.0-1\`（`1.146.0-p5-c-all-r4`）。文言の一覧は `resources\app\out\nls.keys.json`・`nls.messages.json`・`nls.metadata.json`
  - 日本語パック `MS-CEINTL.vscode-language-pack-ja` 1.131.0 は `%APPDATA%\Shuko\languagepacks.json` に登録され、効いている。組み込みの `shuko.notion-sync` も同じ表に載っている
  - 効いた結果 `%APPDATA%\Shuko\clp\bf8a15d7e63e7a2c7731b6677a101075.ja\8d91c4af…\nls.messages.json`: 12,355 件のうち、日本語を含まず英単語の並ぶものが約 650 件（例: `Text Diff Editor`、`Secondary Side Bar shown`、`Image Preview`、`Open in Integrated Browser`）
- 公式の 1.146.0: `tmp/b/official/vscode-1.146.0/69047191fc/`（Shuko のパッチが足した文言を見分けるときの比べる相手）
- `scripts/install-extensions.mjs`、`extensions.lock.json`、`product.overlay.json`、`extensions-src/notion-sync/`（組み込みの拡張の翻訳の扱いの前例）、`TAKE-IN.md`

## やること

1. 調べる（結果は引き継ぎに書く）:
   - 公式の訳の新しさ: Open VSX の日本語パックの今の最新の版、vscode-loc（https://github.com/microsoft/vscode-loc 、MIT）の最新のコミットと、それがどの本体の版の文言に当たるか。本体 1.146.0 の文言を、それぞれが何件訳しているか
   - 入れ方: 組み込みの拡張（notion-sync と同じく本体に同梱）にするか、台帳の VSIX にするか。組み込みの拡張の `contributes.localizations` が本体の言語パックとして効くか、`extensions.allowed` との関係、Open VSX の日本語パックとの両立か置き換えか
   - Shuko のパッチが足した文言（公式の 1.146.0 に無い鍵）の数
2. 作る:
   - 本体と同じ版の日本語パックを、台本で作る（訳の元を読み、本体の文言の鍵に合わせて組む）
   - 公式の訳に無い文言の訳を作り、リポジトリに置く（鍵で引ける形。どの版で足したかが分かる形）。訳語は公式の日本語パックの言い回しにそろえる（例: 「エディター」「サイド バー」のように、公式の訳の表記を用語集として使う）
   - 英語のままでよい文言（固有名詞・コードの名前・記号だけなど）は、理由つきの除外の一覧に載せる
   - 対象は本体と組み込み拡張。台帳のほかの拡張（Claude Code・PowerShell など）は対象外（VSIX は改変しない）
   - 置き換えるなら、台帳・`extensions.allowed`・`install-extensions.mjs` を合わせる。本体の作り直しが要る変更（product.json・組み込みの拡張）は、アイコンの作り直し（`tasks/2026-11-17-icon/`）と同じ版にまとめるので、ここではビルドしない
3. 次の版のための手順: 本体の版が上がったときに、増えた文言を見つけて訳を足し、パックを作り直す手順を `TAKE-IN.md` に書く案を引き継ぎに書く（自動にするかは、リーダーが判断する）

## 決まり

- LLM の処理は `claude -p` で起動する（API キーは使わない）。訳を作るのは、このセッションの中で行ってよい。
- 写すのはコマンドで行う（Read で読んで Write で書く形で、元のファイルを写さない）。
- 本体のビルド・版の入れ替え・拡張の入れ替えはしない（この依頼の外。ビルドとまとめて後で依頼する）。
- 裁定と違う案や、ユーザーに諮るべき点が出たら、作らずに引き継ぎに書いて止める。

## 完了条件

- 本体 1.146.0（今の日常の版の文言の一覧）と組み込み拡張について、作ったパックの未訳が「除外の外で 0」になっている。数え方と結果（全体の件数・訳の元ごとの件数・課が足した件数・除外の件数）を書いている
- パックを作る台本と、課が足した訳と、除外の一覧が、リポジトリにある
- 曹参の網（`tasks/2026-11-17-icon-l10n-tests/` で作る、独立の数え方）で同じ結果になるかを、リーダーが大岡越前守に確かめさせられる状態になっている（どこに何があるかを引き継ぎに書く）

## 成果物

このディレクトリに保存する。

- `l10n-design.md`: 調べの結果と、採った作り方（入れ方・訳の元・足した訳の置き場所・除外の決まり・次の版の手順の案）
- `handoff-notes-meng-tian.md`: 変えたファイル、数え方と結果、テストの入口、ビルドと入れ替えで要ること、諮るべき点

## 結果

- 組み込みの拡張 `shuko.language-pack-ja` を作り、Open VSX の 1.131.0 と置き換える形にした（台帳と `extensions.allowed` から外した）。訳の元は vscode-loc の PR #2450 → main → 1.131.0。課が足した訳 182、上書き 9、除外 5。r4 の文言に対して除外の外の未訳 0（蒙恬の `count`、曹参の網とも）。
- リーダーの判断（`docs/user-decisions.md` の「記録（2026-11-17、日本語パックの作り方で出た点）」）: PR #2450 を使う・上書き・dist を入れる、を認めた。vscode-loc の見張りは足さない。未訳は採否を止めない。
- 大岡越前守の検証は条件つきの合格（`tasks/2026-11-17-l10n-ja-verify/`）。

## 未解決

- 古いパックを外す許可: ユーザーが「蒙恬に許可を足す」を選んだ。Team への依頼は `permission-requests.md`。
- 使い捨ての `scripts/l10n-probe.mjs` はコミットしない。

## 次の担当

蒙恬（`tasks/2026-11-17-icon-ja-build/`）、曹参（`tasks/2026-11-17-icon-ja-tests/`）

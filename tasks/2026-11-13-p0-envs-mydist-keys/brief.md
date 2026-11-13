# Phase 0 の試験環境の台本、0-8 の自動の部分、0-9（mydist の試作）、0-10（Sublime のキーの変換）

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

Phase 0 の手で確かめる項目（0-2・0-3・0-7・0-8・0-9）と計測（0-4・0-5）に使う試験環境を、台本1本で作り直せるようにする。あわせて `mydist` の試作（0-9）と Sublime のキーの変換の試し（0-10）を行う。

## 入力

- docs/07 の2.1（置き場所 `C:\b\p0\`、データは `C:\b\p0\data\<名前>\user`・`...\ext`）、2.3〜2.4（0-2・0-3）、2.8〜2.11（0-7〜0-10）、3.1（計測でそろえる条件）
- docs/06 の5節（スモークの組。`base`・`claude-code`・`languages`）
- docs/03 の4節の段階 A（試験台で消す組み込み拡張の一覧）
- docs/04 の6節（`mydist`、6.1 既定の設定、6.2 Sublime のキー）、7節（日本語化）

## やること

1. `scripts/p0-env.ps1 -Name <環境の名前>`: 環境ごとに、データの置き場所を新しく作り、ユーザー設定・`argv.json` を書き、拡張を CLI の `--install-extension` で入れる。作り直すと前の中身を消して同じ状態になること。環境は少なくとも次のとおり。
   - `upstream-default`: 本家 1.146.0、AI は既定のまま、台帳の拡張を全部（計測の基準。docs/07 の2.5）
   - `upstream-ai-disabled`: 本家 1.146.0、`"chat.disableAIFeatures": true`、Claude Code（0-2）
   - `testbed`: VSCodium を `C:\b\p0\testbed\` に写し、段階 A の組み込み拡張のフォルダを消し（VSCodium に無いものは飛ばし、消したものの一覧を残す）、台帳の拡張を全部（0-3）。2つの .env の拡張は、同時に入れると比べにくいなら環境を分ける（例 `testbed-dotenv-a`・`testbed-dotenv-b`）
   - `langpack-upstream`・`langpack-testbed`: 言語パック 1.131.0 と `"locale": "ja"`（0-7）
   - `ext-allowed`: 本家に `extensions.allowed` を `{"*": false, "anthropic.claude-code": true}`（0-8）
   - `mydist`: 本家に `--extensionDevelopmentPath=extensions-src/mydist` で読み込ませる（0-9）
   - 計測用の設定（`task.allowAutomaticTasks: "on"` など、docs/07 の3.1 で台本に要るもの）は計測に使う環境に入れる
2. `scripts/p0-launch.ps1 -Name <環境の名前>`: その環境のエディタを、計測用のワークスペース（このリポジトリの `tmp\ws\`）を開いて起動する（ユーザーが手で確かめるときに使う）。
3. 計測用のワークスペースの準備: ユーザーが `E:\develop\kuebiko` をこのリポジトリの `tmp\ws\` に clone する（裁定 2026-11-13。はじめは `C:\b\p0\ws\` だったが改めた）。`.gitignore` に `tmp/` を足す。clone があれば、コミットを記録し、`.vscode/tasks.json` に、フォルダを開いたときにターミナルを1つ開くタスク（`"runOptions": {"runOn": "folderOpen"}`）を足す。計測で開く2つのファイル（TS と Python）を選んで記録する。clone がまだ無ければ、これを行う台本（例 `scripts/p0-ws.ps1`）を作るところまででよい。
4. 0-8 の自動の部分: (a) 許可していない VSIX を CLI の `--install-extension` で入れたときどうなるか、(c) すでに入っている許可外の拡張がどうなるか（拡張の一覧の CLI の出力で分かる範囲）。(b) 画面の「VSIX からインストール」はユーザーが手で行う。
5. 0-9: `extensions-src/mydist/package.json`（`main` なし、宣言だけ）。`configurationDefaults` に `chat.disableAIFeatures`、`telemetry.telemetryLevel`、`workbench.colorTheme`、`extensions.allowed`、`breadcrumbs.enabled`。値は docs/04 の6.1。設定の画面での確かめはユーザーが手で行う。
6. 0-10: `ms-vscode.sublime-keybindings` 4.1.10 の VSIX を Open VSX から取り、`contributes.keybindings` を docs/04 の6.2 のとおり変換する `scripts/convert-sublime-keys.mjs` を作る。Claude Code の既定のキー（Claude Code の manifest の `contributes.keybindings`）との衝突の一覧を作る。
   - 単体テストのための約束（曹参が同じ約束からテストを並行して書く。名前と形を変えない。変えるときは成果物に書く）: `scripts/lib/sublime-keys.mjs` に次の純粋な関数を置き、`export` する。
     - `convertKeybindings(sublimeKeybindings)` → 変換した keybindings の配列。入力と出力の各要素は VS Code の keybindings の形（`key`・`command`・任意の `when`・`args`・`mac`・`linux`・`win`）。変換の規則は docs/04 の6.2。
     - `findConflicts(a, b)` → 衝突の配列。各要素は `{ key, a, b }`。同じ `key`（大文字小文字と修飾キーの順を正規化したもの）で、`when` が両方とも無いか同じものを衝突とする。

## 守ること

- 書き込みは自分の書き込み先（`scripts/`・`extensions-src/`・`tasks/`・`C:\b\` など）だけ。`records/` は大岡越前守が書くので書かない。`tmp\ws\` には `.vscode/tasks.json` を足すだけにする。あなたの書き込み先に `tmp/` を足す権限の変更はユーザーが承認済みで、Team の開発部が入れる。入る前にそこへの書き込みが止められたら、tasks.json の中身をこのタスクディレクトリに置いて報告する（迂回しない）。
- 別の蒙恬（タスク `2026-11-13-p0-fetch-and-lock`）が並行して材料を取り、`scripts/p0-fetch.mjs`・`scripts/lock-fetch.mjs`・`scripts/lock-verify.mjs`・`scripts/lib/lock.mjs`・`extensions.lock.json` を書く。それらに触れない。材料の置き場所は `C:\b\p0\vscode-1.146.0\`、`C:\b\p0\vscodium-<版>\`、`C:\b\p0\vsix\`。
- 材料がまだ届いていなければ、台本を書き、`node --check` と PowerShell の構文の検査までを済ませ、材料が要らない部分（5・6）を走らせて報告する。環境を実際に作るのは、リーダーが材料の届いたことを知らせてからでよい。
- 普段使いのエディタの設定とデータに触れない。

## 完了条件

- `scripts/p0-env.ps1`・`scripts/p0-launch.ps1` があり、上の環境を作れる（材料が届いていれば、全部の環境を実際に作った）。
- `extensions-src/mydist/package.json` がある。
- `scripts/convert-sublime-keys.mjs`・`scripts/lib/sublime-keys.mjs` があり、変換の結果と衝突の一覧がある。

## 成果物

このディレクトリに保存する。

- `env-setup.md`: 環境ごとの中身（本体、拡張、設定、`argv.json`、消した組み込み拡張）、作り方と起動のしかた。計測用のワークスペースのコミットと、開く2つのファイル。
- `extensions-allowed.md`: 0-8 の下書き（自動で確かめた (a)(c) と、ユーザーが手で行う (b) の手順）。
- `configuration-defaults.md`: 0-9 の下書き（試作の中身と、ユーザーが設定の画面で確かめる手順）。
- `sublime-keys.md`: 0-10 の下書き（変換の規則と結果、衝突の一覧）。
- `doc-corrections.md`: docs と食い違った事実と、どう直すべきかの案。

## 結果

採用。10の環境、mydist（既定5件と `useBundled`、Sublime の69キー）、Sublime のキーの変換（Claude Code の既定キーとの衝突0）、0-10 を作った。大岡越前守の検証は、2回の差し戻しの後に合格（`tasks/2026-11-13-p0-verify-envs/`、records/phase0/sublime-keys.md）。ユーザーの手の確かめの手順は env-setup.md の5節。

## 未解決

- ユーザーの手の確かめ（0-2・0-3・0-7・0-8・0-9）の結果待ち。結果を見て大岡越前守が records/phase0/ に清書する。
- env-setup.md の4節の表に `useBundled` を足す（手の確かめの後）。
- `zip-read.mjs` と `zip.mjs` の重なり（急がない）。

## 次の担当

ooka-echizen（大岡越前守）: 検証し、`records/phase0/` に清書する。手で確かめる項目はユーザーへ。

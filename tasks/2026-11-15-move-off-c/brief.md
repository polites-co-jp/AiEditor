# ビルドと一時のファイルを C: から移す（調べ・段取り・台本の直し）

- 担当: meng-tian（蒙恬）。テストは cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

ユーザーの裁定（2026-11-15、`docs/user-decisions.md` の「C: に置かない」）。一時的なファイルとビルドのためのファイルを C: に置かない。できるなら、このプロジェクトのフォルダの下（`tmp/`。`.gitignore` 済み）に置く。C: に前から作ったものは移すか消す。

今の C: の空きは約 75〜92 GB（片づけの後）。E: は約 4.2 TB 空いている。

## やること（蒙恬）

### 1. 調べ（読むだけ）

1. **C: にある、このプロジェクトが作ったもの**の一覧と大きさ。`C:\b\` の下（`vscode`・`wt`・`cache`・`p2`・`dist`・`smoke`・`logs` など）と、ビルドが使う C: のキャッシュ（`%LOCALAPPDATA%\pnpm\store`・`pnpm-cache`・`electron`・`electron-builder`・`node-gyp`・`npm-cache`、`%USERPROFILE%\.electron-gyp` など）。キャッシュは、このプロジェクトのビルドが作ったと言えるものと、ほかの用途と共用のものを分ける。測れない所は「測れない」と書く。
2. **置き場所の候補**: 第一は `e:/develop/self/Team/projects/ai-editor/tmp/b`（プロジェクトの下）。次を確かめる。
   - Windows のパスの長さ: 今の `C:\b\wt\p2` の木の中のいちばん長いパス（`node_modules` を含む）に、置き場所の文字数の差を足して 260 を超えるか。`LongPathsEnabled`（レジストリ。読むだけ）、git の `core.longpaths`、node・pnpm・gulp・electron・MSBuild（node-gyp）が長いパスで止まる恐れ。
   - 本家の条件（パスに空白と ASCII 以外を入れない。docs/02 の2節）。
   - git の作業ツリーと clone を、別の git のリポジトリ（このビルドリポジトリ）の `tmp/` の下に置いてよいか（`.gitignore` で外れるか、エディタの監視・検索が重くならないか）。
   - 無理なら、代わりの場所（例: `E:\b`）と理由を書く。決めるのはユーザー（リーダーが諮る）。
3. **キャッシュの向け先**: pnpm の store・electron のキャッシュ・node-gyp・npm のキャッシュ・`TEMP`/`TMP` を、ビルドの子の環境（`build.mjs` の childEnv など）だけで新しい置き場所の下へ向けられるか。利用者の全体の設定（`~/.npmrc` など）は変えない形を第一にする。

### 2. 台本の直し（`scripts/`）

- `buildRoot` の既定を新しい置き場所にする（`scripts/lib/local-config.*`。`local.json` に書かれた値があればそれが勝つ）。
- ビルドと取り込みの子の環境で、上の3のキャッシュと `TEMP`/`TMP` を `<buildRoot>` の下に向ける（向け先の名前は決めて書く）。
- スモーク・計測・通信の監査・手順書の試しが C: に一時のファイルを書く所（`%TEMP%` の下の作業用データなど）があれば、同じく `<buildRoot>` か `tmp/` の下へ向ける。普段使いのエディタのデータと、秘密の置き場所（DPAPI の `%LOCALAPPDATA%\<editor>\`。docs/06 の2.4）は対象外。
- `C:\b` を文字で持っている所を探して直す（`scripts/`・`tools/`・`tests/` の期待・`TAKE-IN.md`）。`tests/` は曹参が直す。

### 3. 移す段取り（書くだけ。走らせない）

- 移すもの・作り直すもの・消すものの表。常設の clone は新しい場所へ作り直す（例: 今の clone から clone し、origin を本家に向けて fetch）か移すか、作業ツリーは作り直すか。残す版（`1.146.0-p2-all`、`1.146.0-p1-a1-r3`）とスモークの拡張、VSIX のキャッシュ、記録に使うログは移す。
- 段取りに要るコマンドと、今の許可で走らないもの。
- **権限の変更の一覧**: 蒙恬・曹参・大岡越前守の `permissions.json` で `C:/b` を前提にしている行（`write_paths`・`read_paths`・`delete_paths`・`delete_keep`・`bash`・`bash_exact`）と、新しい場所での書き方の案。古い `C:\b` を最後に消すための許可も入れる。リーダーが Team の開発部への依頼にする。

## やること（曹参）

- 蒙恬の2の直しのテスト: `buildRoot` の既定、`local.json` の値が勝つこと、子の環境のキャッシュと `TEMP` の向け先、C: のパスを持たないこと。
- `tests/` の中の `C:\b`・`C:/b` の期待を、新しい既定に合わせて直す（実記録を読むテストは、記録の中のパスのままでよい）。
- `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 移す・消す・作り直すは、まだ走らせない（許可を直してから。権限の変更はユーザーの承認と Team の開発部）。
- 実際の `local.json`・利用者の全体の設定（`~/.npmrc`・環境変数・レジストリ）を変えない。読むのはよい。
- 書き込みは、蒙恬が `scripts/`・`tools/`・`TAKE-IN.md`・`tasks/`、曹参が `tests/`・`tasks/`。

## 完了条件

- 1の調べと3の段取り・権限の一覧があり、2の直しと曹参のテストがあって `run-all` の fail が 0。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`（調べ・段取り・権限の一覧・直した点）、`handoff-notes-cao-shen.md`。

## 結果

採用。`buildRoot` の既定を `<リポジトリ>	mp` にし、ビルドの子の環境で TEMP・キャッシュを `<buildRoot>` の下へ向けた。写すだけの台本 `scripts/move-build-root.mjs`。スモーク・absent・監査の作業場所の名前を短くした（最長 258 文字）。`netaudit.ps1` はネットのログを読んだら消す。Phase 0 の道具は引退の注記。大岡越前守の検証で「移す前の直し」合格（`tasks/2026-11-15-move-off-c-verify/verification-ooka.md`。run-all 2604、fail 0）。

## 未解決

<無ければ「なし」>

## 次の担当

ooka-echizen（大岡越前守）: 直しの検証。リーダー: 置き場所をユーザーに諮るとき（候補が無理なとき）、権限の依頼、docs の直し。

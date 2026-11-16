# 検証: ビルドの置き場所を C: から tmp\b へ移す直し（台本とテスト）

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-16
- 状態: 完了

## 目的

ユーザーの裁定（2026-11-15、`docs/user-decisions.md` の「C: に置かない」「ビルドの置き場所と Phase 0 の残り」、2026-11-16 の「tmp\b へ移す段取りで出た点」）を受けて、蒙恬が台本を、曹参がテストと計測・監査の台本を直した。移す作業（写す・消す）はまだで、権限の変更を Team に依頼している（`tasks/2026-11-15-move-off-c/permission-requests.md`）。移す前に、直しが正しいかを確かめる。

## 入力

- docs/02 の2節・6.1（2026-11-16 に直した）、CLAUDE.md の「`tmp/` の下を探さない」
- `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md`（1回目・2回目）、`handoff-notes-cao-shen.md`（1〜5回目）
- 直したもの: `git status` で `scripts/`・`tests/` の未コミットの変更（Phase 0 の道具 `scripts/p0-*`・`lib/p0-common.ps1` は注記だけ）。新規 `scripts/lib/build-env.mjs`・`scripts/move-build-root.mjs`・`scripts/move-survey.mjs`・`tests/move-off-c.test.mjs`・`tests/move-build-root.test.mjs`・`tests/build/root.mjs`

## やること

1. **差分のレビュー**:
   - `buildRoot` の既定が `<リポジトリ>\tmp\b` で、`local.json` の値が勝つ（Node と PowerShell の両方）。
   - ビルドの子の環境（`childEnv`・`build-env.mjs`）が `TEMP`・`TMP`・pnpm の store とキャッシュ・npm のキャッシュを `<buildRoot>` の下に向け、`LOCALAPPDATA` は依存の導入・型検査・パッケージ化だけで向ける。利用者の全体の設定（`~/.npmrc`・環境変数・レジストリ）を書き換えない。
   - `scripts/`・`tools/` のコード行に `C:\b` が残らない（Phase 0 の道具を除く）。`os.tmpdir`・`$env:TEMP` などで C: に一時のファイルを書く所が残らない。
   - パスの長さ: スモーク・absent・取り込みの監査の作業場所の名前の決まりで、いちばん長いパスが 259 文字に収まる（`LongPathsEnabled` が無効）。
   - `netaudit.ps1` が、宛先を読み取った後と例外の経路の両方でネットのログを消し、消し損ねたら止まる。
   - `move-build-root.mjs` が何も消さず、上書きせず、数・大きさ・SHA-256（clone は ref）を照らす。許可の外を消す手順を含まない（課の台帳の「塞いでいない穴」）。
   - Phase 0 の道具は注記だけで、動きが変わっていない。
2. **走らせる**: `node tests/run-all.mjs --save <ファイル>`。`node scripts/build.mjs 1.146.0 --dry-run`（または許可にある dry-run の形）で、出てくる場所が `tmp\b` の下で、C: を指さないこと。`node scripts/move-build-root.mjs --from C:/b --dry-run`（読むだけ。許可にあれば）。
3. **合否**: 「移す前の直し」の合否を `verification-ooka.md` に書く。直す点があれば担当と中身を書く。

## 守ること

- コード・テストは直さない。書き込みは `records/`・`tasks/` だけ。`C:\b` と `tmp\b` には何も作らない・消さない（dry-run の読むだけはよい）。
- 普段使いのエディタのデータと、秘密の場所に触れない。

## 完了条件

- 1〜3に結果がある。

## 成果物

このディレクトリに `verification-ooka.md`。

## 結果

合格（移す前の直し）。直す点5つ（取り込みの監査の名前の長さの守り、テストが本物の `tmp\b` に書く、dir の項目の SHA-256、途中で止まったときの続き、見張るテストの不足）は、移した後の最初のビルドの前に直す。

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: 合格ならコミット。Team の権限の変更が入ったら、蒙恬に移す手順を走らせる。

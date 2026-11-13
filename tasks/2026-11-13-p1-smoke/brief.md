# Phase 1: スモークテストの台本（base・claude-code・languages の自動の部分）

- 担当: cao-shen（曹参）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ビルドしたエディタが壊れていないかを確かめる台本を作る。Phase 1 では無改造のビルドに、Phase 2 からは機能を1つ消すたびの関門（docs/03 の7節の4「壊れていない」）に使う。メモリの計測と通信の監査はやめたので（裁定 2026-11-13）、この台本が動作の確認の柱になる。

## 入力

- docs/06 の5節（スモークの組。自/手の区別）、docs/03 の7節（関門）
- docs/07 の4節（Phase 1）、docs/07 の3.2 の1（起動の注意: `VSCODE_PORTABLE`、子のプロセスから `ELECTRON_RUN_AS_NODE`・`ELECTRON_NO_ATTACH_CONSOLE`・`VSCODE_*` を外す）
- docs/user-decisions.md の 2026-11-13 の「計測と通信の監査をやめる」
- 本家の `test/smoke` の README（`https://raw.githubusercontent.com/microsoft/vscode/1.146.0/test/smoke/README.md`）と、タグ 1.146.0 の `test/smoke`・`test/automation`
- 試す相手: 公式の zip を展開した `C:\b\p0\vscode-1.146.0\`、台帳の VSIX（`C:\b\p0\vsix\`）、ワークスペース（このリポジトリの `tmp\ws\`、`C:\b\p0\ws-info.json` の2つのファイル）。蒙恬がビルドを作り終えたら、その出力にも向ける。
- 既存の部品: `scripts/lib/p0-common.ps1`（環境の作り方。読んで使い方を合わせる。書き換えない）

## やること

1. 本家の `test/smoke` を、ビルドしたもの（`--build <path>`）に Windows で向けられるかを、README とタグ 1.146.0 のソースで調べる。向けられるなら、どの試験が docs/06 の5節のどの項目に当たるかの対応表を作る。
2. 台本 `tests/smoke/` を作る（向けられるなら本家の smoke を使う形、だめなら起動とログの検査を自前で行う形）。最低限、自動で次を確かめる。
   - base: 起動する。拡張ホストのログと開発者ツールのコンソールにエラーが無い（前の版との比べは後で。今は誤りの一覧を出す）。
   - claude-code: 台帳の Claude Code の拡張が動作中の拡張に出る。`~/.claude/ide/<port>.lock` ができる（できた `.lock` は終わったら消すか、消してよいかを報告する。普段使いの Claude Code の `.lock` を消さない）。
   - languages: TS（tsserver）と Python（basedpyright。`basedpyright.importStrategy: "useBundled"`）の言語サーバーが起動し、診断が出る。ほかの項目はできる範囲で。
3. 台本の単体テストを書き、`tests/` の流儀で走らせる。公式の zip（`C:\b\p0\vscode-1.146.0\`）に向けて一度通す。
4. 手で確かめる項目（docs/06 の5節の「手」）の手順書を、ユーザーが5分ほどで回せる形で書く。

## 守ること

- 書き込みは自分の書き込み先（`tests/`・`tasks/`・`C:\b\` など）だけ。`scripts/` の蒙恬の台本は書き換えない（要る直しは報告する）。
- 普段使いのエディタのデータ（`%APPDATA%\Code`、`%USERPROFILE%\.vscode`、`~\.vscode-oss`）に触れない。普段使いの `~/.claude/` の中身を消さない。
- 起動した PID の木だけを止める。ほかのエディタを止めない。
- 許可に無いコマンドが要るときは、走らせずに「何のために何が要るか」を報告する。

## 完了条件

- 1 の調べの結果（出典つき）がある。
- `tests/smoke/` の台本と単体テストがあり、公式の zip に向けて一度通った記録がある。
- 手の確かめの手順書がある。

## 成果物

このディレクトリに保存する。

- `smoke-design.md`: 1 の調べと対応表、台本の使い方。
- `manual-checks.md`: 手で確かめる項目の手順書。
- `handoff-notes.md`: 報告。
- 台本とテストは `tests/smoke/` に。

## 結果

採用。自前のスモークの台本（`tests/smoke-run.mjs` ほか）。差し戻し A〜E・G〜L を直し、検証（2）（3）で合格。公式の zip で PASS 49 / FAIL 0。

## 未解決

- 自作のビルドに向けた実行は、ビルドの後。

## 次の担当

ooka-echizen（大岡越前守）: 台本を検証し、蒙恬のビルドに向けて走らせる。

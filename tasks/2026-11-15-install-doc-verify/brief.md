# 検証: インストールの手順書の下書き（install-draft.md）

- 担当: ooka-echizen（大岡越前守）。テストは cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 依頼中

## 目的

蒙恬が書いた `tasks/2026-11-15-install-doc/install-draft.md` を、リーダーが `docs/install.md` に置く前に確かめる。

## やること（大岡越前守）

1. 手順書の各コマンドが、台本の実際の引数・終了コード・出力と合うか（`handoff-notes.md` の「照らし合わせ」の表を、台本のソースで確かめる）。
2. docs/07 の7節の3の項目がそろっているか。docs/02 の6節・6.1、docs/04、docs/05、docs/06 と食い違わないか。裁定（`docs/user-decisions.md`）に反する手順（たとえば、エージェントが秘密を読む、入れ替えをエージェントが行う）が無いか。
3. 蒙恬の試しの記録（handoff-notes の「試した範囲」）が、台本の試しの形の範囲に収まり、実際の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion に触れていないか。
4. 走らせられる範囲で、読むだけの確かめ（`--dry-run` など、許可にあるもの）をしてよい。

## やること（曹参）

1. 蒙恬の handoff-notes の「曹参へ」の2点のテスト。`configure.ps1` の手順5（「プログラム」フォルダの直下の .lnk の向け直し、サブフォルダは見ない、PATH の `%LOCALAPPDATA%\...` の形の一致）と、`labelToVersion('1.146.0-p2-all')` が null で `upstream.json` に戻ること。既にテストがあれば、その場所を書く。
2. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- コードと手順書は直さない（直す点は報告する）。書き込みは、大岡越前守が `records/`・`tasks/`、曹参が `tests/`・`tasks/`。
- 実際の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion・秘密の場所に触れない。

## 完了条件

- 1〜3（大岡越前守）と、1・2（曹参）に結果がある。

## 成果物

このディレクトリに `handoff-notes-ooka.md`、`handoff-notes-cao-shen.md`。

## 結果

<完了後にリーダーが記入する>

## 未解決

<無ければ「なし」>

## 次の担当

リーダー: 直しがあれば蒙恬へ。合格なら `docs/install.md` に置く。

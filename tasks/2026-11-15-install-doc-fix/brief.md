# 直し: install-extensions.mjs の --portable、手順書の下書き、switch.ps1 の検知の警告

- 担当: meng-tian（蒙恬）。テストは cao-shen（曹参）
- 依頼日: 2026-11-15
- 状態: 完了

## 目的

インストールの手順書の検証（`tasks/2026-11-15-install-doc-verify/handoff-notes-ooka.md`）が不合格だった。

- 台本の欠陥: `install-extensions.mjs --portable <dir>` の場所が無いと、エディタはそれを黙って捨て、普段の場所に入れる（1.146.0 の `src/bootstrap-node.ts` の `configurePortable`）。手順書の試しで、8つの拡張が `%USERPROFILE%\.shuko\extensions` に入り、`%APPDATA%\Shuko` に CLI のログができた（2026-11-15 01:33。リーダーが有無と日時を確かめた。普段使いの VS Code のデータには触れていない）。公式の zip で同じことをすると、本家の `%USERPROFILE%\.vscode\extensions` に入る恐れがある。
- 手順書の誤り（検証の「不合格の点」の2・3）と軽微な点（1〜3）。
- docs/06 の2.3 の「`switch.ps1` が起動時に、最後に検知が成功した日時を表示し、3日より古ければ警告する」が、`switch.ps1` に無い（`take-in.mjs` は `readWatchStatus` を持つ）。

## やること（蒙恬）

1. `scripts/install-extensions.mjs`: `--portable <dir>` のとき、CLI を走らせる前に場所を作る（`mkdir -p`）。作ったあとに、エディタがポータブルとして扱う条件（場所が在る）を満たすことを確かめてから CLI を走らせる。あわせて、22行の守り（本家の `dataFolderName` の CLI では `--portable` か `--extensions-dir` を求める）が、`--portable` だけのときも効くことを確かめる。
2. `scripts/switch.ps1`: docs/06 の2.3 のとおり、起動時に最後に検知が成功した日時を表示し、3日より古ければ警告する（止めない）。読み方は `take-in.mjs` の `readWatchStatus` にならう。状態のファイルが無いときの扱いも決めて書く。
3. `tasks/2026-11-15-install-doc/install-draft.md` を直す: 検証の「不合格の点」の2（手順4の終了コード1の文を2つとも書く）、3（`%USERPROFILE%\.shuko-shared\` を表と「すっかり消すとき」に足す）、軽微な点の1（SHA-256 の出典を全桁のある `build-record.json` に）・2（`-NoMove` のときのやり直しの範囲）・3（`--dry-run` も VSIX を取る）。2 の switch.ps1 の警告も手順書に書く。
4. `tasks/2026-11-15-install-doc/handoff-notes.md` の「試していないもの」を事実に合わせて直す（`.shuko` に入ったこと）。
5. 手順書の試しをやり直すなら、`C:\b\trial-install-doc\` の下だけで行い、`--portable` の場所に拡張が入ることを確かめる。普段の場所（`%USERPROFILE%\.shuko`・`%APPDATA%\Shuko`）には書かない。
6. テストの入口を handoff-notes に書く。

## やること（曹参）

1. `install-extensions.mjs`: 無い `--portable` の場所を渡しても、普段の場所に入らない（場所が作られ、CLI の環境の `VSCODE_PORTABLE` がその場所を指す）ことのテスト。偽の CLI で、本物のエディタを起動しない形にする。
2. `switch.ps1`: 検知の状態が3日より古いと警告が出る、新しければ出ない、状態が無いときの扱い（蒙恬の入口に合わせる）。
3. `node tests/run-all.mjs --save <ファイル>` の件数。

## 守ること

- 書き込みは、蒙恬が `scripts/`・`tasks/`・`C:\b\trial-*`、曹参が `tests/`・`tasks/`。
- 実際の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion・秘密の場所・普段の場所（`%USERPROFILE%\.shuko`・`%APPDATA%\Shuko`・本家のデータ）に触れない。

## 完了条件

- 蒙恬の1〜4と、曹参の1〜3がある。

## 成果物

このディレクトリに `handoff-notes-meng-tian.md`、`handoff-notes-cao-shen.md`。

## 結果

採用。`install-extensions.mjs` が `--portable` の場所を作り、入らなければ止める。`switch.ps1` が検知の最後の成功を表示し、3日より古ければ警告する。手順書の誤りと軽微な点を直した。テスト 23 件。再検証で合格（1608 件、fail 0）。

## 未解決

- 実機（本物の `local.json`・スタートメニュー・PATH・タスクスケジューラ・Notion）での手順はユーザーが行う。

## 次の担当

ooka-echizen（大岡越前守）: 直しと手順書の再検証。

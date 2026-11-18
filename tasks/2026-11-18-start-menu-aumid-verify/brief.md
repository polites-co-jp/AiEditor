# ID 付きスタートメニューのショートカットの台本とデスクトップのショートカットの検証

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-18
- 状態: 完了

## 目的

蒙恬と曹参の成果を確かめ、合否を出す。

1. タスクバーの「New Window」の件（裁定: `docs/user-decisions.md` の「裁定（2026-11-18、タスクバーの右クリックの「New Window」）」）で作った、ID 付きのスタートメニューのショートカットの台本と、そのテスト
2. デスクトップのショートカット（`tasks/2026-11-17-desktop-shortcut/`）

## 入力

- 依頼書: `tasks/2026-11-18-start-menu-aumid/brief.md`、`tasks/2026-11-18-start-menu-aumid-tests/brief.md`、`tasks/2026-11-17-desktop-shortcut/brief.md`
- 引き継ぎ: `tasks/2026-11-18-start-menu-aumid/handoff-notes-meng-tian.md`、`tasks/2026-11-18-start-menu-aumid-tests/handoff-notes-cao-shen.md`、`tasks/2026-11-17-desktop-shortcut/handoff-notes-meng-tian.md`
- 成果: `scripts/start-menu-shortcut.ps1`、`scripts/lib/shell-link.ps1`、`scripts/configure.ps1`（`-ProgramsDir` を足した。`git diff`）、`tests/start-menu-shortcut.test.mjs`、`tests/configure.test.mjs`（2件足した。`git diff`）
- 差し替え案: `tasks/2026-11-18-start-menu-aumid/install-3.1-draft.md`

## やること

1. 差分のレビュー。仕様（依頼書の「やること」）との食い違い、`configure.ps1` の既定の振る舞いが変わっていないこと、台本が本物の場所に既定以外で書かないこと、通信しないこと。
2. `node --test tests/start-menu-shortcut.test.mjs tests/configure.test.mjs` を走らせる。テストが本物のスタートメニュー・デスクトップ・`%LOCALAPPDATA%\Programs\Shuko` に書かないことを、テストのコードで確かめる。
3. 曹参のテストが、台本の `-Read` に頼らず独立に ID を読んでいることを確かめる。
4. 見立ての裏付け（上流の「New Window」が残り、どの単位も外していない）を、蒙恬の引き継ぎに挙がった行で確かめる。
5. デスクトップのショートカットを、あなたの `permissions.json` の `bash_exact` の末尾の「読む行」を1字も変えずに打って確かめる（`TargetPath` が `...\Programs\Shuko\current\Shuko.exe`、`WorkingDirectory` が `...\current`）。
6. 差し替え案が台本の振る舞い（引数・出力・終了コード）と合っているか。

## 完了条件

- 1〜6 の合否と根拠が検証の記録にある

## 成果物

このディレクトリに保存する。

- `verification-start-menu-aumid.md`（合否、走らせたコマンドと結果、直すべき点）

## 結果

判定は不合格だが、落ちたのは6（差し替え案の出力の順の書き方）だけ。1〜5（差分・テスト31件・独立の読み手・見立ての裏付け・デスクトップのショートカット）は合格。6はリーダーが install.md に写すときに直した（検証の記録が認める直し方）。扱いは `docs/user-decisions.md` の「記録（2026-11-18、ID 付きショートカットの台本の検証）」。

## 未解決

- 効いたかどうかは、ユーザーがタスクバーで確かめるまで分からない（検証の範囲外）。

## 次の担当

リーダー（install.md の 3.1 の差し替え、コミット）

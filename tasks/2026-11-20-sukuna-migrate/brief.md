# Sukuna への移行（設定の写し・版の展開・拡張の導入）

- 担当: meng-tian（蒙恬）。確かめは ooka-echizen（大岡越前守）とリーダー
- 依頼日: 2026-11-20
- 状態: 依頼中（2026-11-24 権限の段1が当たったのを確かめた。手順2は済み（`migrate-notes.md`）。手順3はラベルの誤りの指摘で止め、手順1の後に回した。手順1はユーザー待ち）

## 目的

ユーザーが Sukuna で Claude Code 拡張が起動しないと知らせた。原因は、改名の移行の手順（`tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の3.3 の順3〜5）がまだ済んでおらず、拡張が1つも入っていないこと（`%USERPROFILE%\.sukuna\extensions` が空）。信頼（Trust）の設定とは関係ない。計画どおりに移行して、Shuko と同じ状態の Sukuna を `%LOCALAPPDATA%\Programs\Sukuna` で使えるようにする（2026-11-20 の裁定。`docs/user-decisions.md`）。

## 今の状態（リーダーが 2026-11-20 に確かめた）

- ユーザーは r7 の zip を `E:\application\sukuna` に展開して起動していた。課の道具（`switch.ps1`）を通していない。
- ある: `%APPDATA%\Sukuna`（`User\settings.json` 150 バイト、`globalStorage`、`workspaceStorage` など）、`%USERPROFILE%\.sukuna\argv.json`（`locale` が無い）、`%USERPROFILE%\.sukuna\extensions\extensions.json`（2 バイト）、`%USERPROFILE%\.sukuna-shared`
- 無い: `%LOCALAPPDATA%\Sukuna`（`local.json`・`watch\`）、`%LOCALAPPDATA%\Programs\Sukuna`
- 旧: `%LOCALAPPDATA%\Shuko\local.json` は既定の値（`installRoot` = `%LOCALAPPDATA%\Programs\Shuko`、`keepVersions` 3、`buildRoot` = `tmp\b`）。`%USERPROFILE%\.shuko\extensions` に台帳の8つ
- 権限の段1（`tasks/2026-11-18-rename-sukuna-survey/permission-requests.md` の1.1〜1.5。2026-11-18 にユーザーが承認）は、まだ当たっていない。蒙恬の許可に、移行の台本の行（1.5）と Sukuna の秘密の場所（1.1）が無い

## 手順（rename-plan.md の3.3 に今の状態を当てたもの）

0. （ユーザー）Team の張良に、権限の段1を当てるよう頼む。当たったらリーダーに知らせる。
1. （ユーザー）Shuko と Sukuna を全部閉じる。今日できた `%APPDATA%\Sukuna` と `%USERPROFILE%\.sukuna` を、別の名前（例 `Sukuna.old-20261120`・`.sukuna.old-20261120`）に変えて退ける。消さない（課の削除の許可の外。要らなければ後でユーザーが消す）。
2. （蒙恬）`configure.ps1` で `%LOCALAPPDATA%\Sukuna\local.json` を既定の値で作る（旧の値は既定と同じ）。
3. （蒙恬）手順1の後に打つ（先に打つと、今日できた不要な settings.json などが `backups\` に控えられるため）。ラベルは `1.146.0-1`（docs/install.md の2、docs/02 の6節、rename-plan.md の6節。2026-11-24 に蒙恬の指摘で直した。前の版のこの欄はラベルを誤って `1.146.0-p5-c-all-r7` と書いていた）。`switch.ps1 1.146.0-1 -Zip <buildRoot>\dist\1.146.0-p5-c-all-r7.zip -Sha256 5b7ea8850c09af457068bf814b0bef113e9280095f8b72ffa4963f8268e451d1` で `%LOCALAPPDATA%\Programs\Sukuna\versions\` に展開し、`current` を作る。
4. （蒙恬）`scripts/migrate/migrate-from-shuko.ps1 -List` を打ち、出力をこのフォルダに残す。リーダーが確かめてから `-Apply` を打つ。止まったら（終了コード 3）理由を報告し、自分で場所を片づけない。
5. （蒙恬）`node scripts/install-extensions.mjs --dry-run` の後に本番。CLI は `current\bin\sukuna.cmd`（`local.json` から求まる）。
6. （大岡越前守とリーダー）許可の範囲で確かめる（rename-plan.md の4節の手順7）。リーダーは `ls` で Sukuna の場所の有無と名前を見て渡す（2026-11-19 の記録 P1）。
7. （ユーザー）`start-menu-shortcut.ps1`、PATH に `%LOCALAPPDATA%\Programs\Sukuna\current\bin` を足す、スタートメニューの「Sukuna」から起動し、Claude Code のパネルが開いて応答が返るかを見る。表示が英語なら一度閉じて起動し直す。notion-sync のトークンを入れ直す。`E:\application\sukuna` を消す。
8. （蒙恬）デスクトップの `Sukuna.lnk`（1.2 の許可が当たっていれば）。

検知のタスク（`register-task.ps1`）は、`safety.daily-argv` の偽の FAIL を曹参が直してから登録する（2026-11-19 の記録）。この依頼には含めない。

## 入力

- `tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の3.2・3.3・4節
- `tasks/2026-11-18-rename-sukuna-survey/permission-requests.md`（段1）
- `docs/install.md`（手順1・2・4）
- r7 の関門 `records/take-in/1.146.0-p5-c-all-r7/gate-p5-c-all-r7.md`

## 完了条件

- `%LOCALAPPDATA%\Sukuna\local.json` があり、`%LOCALAPPDATA%\Programs\Sukuna\current` が r7 を指す。
- 移行の台本の `-List` と `-Apply` の出力（名前・有無・数・大きさだけ）がこのフォルダにあり、写した後の照らし合わせが一致している。
- `install-extensions.mjs` の結果（台帳の8つが入り、`argv.json` に `"locale": "ja"`）がこのフォルダにある。
- 大岡越前守の確かめの記録がある。
- ユーザーが Sukuna で Claude Code のパネルが動くことを確かめた。

## 成果物

このディレクトリに保存する。

- `migrate-list.txt`・`migrate-apply.txt`: 移行の台本の出力
- `install-extensions-result.json`: 拡張の導入の結果
- `migrate-notes.md`: 打った順、終了コード、気づいた点（蒙恬）
- `verification-sukuna-migrate.md`: 確かめの記録（大岡越前守）

## 結果

（未記入）

## 未解決

- 権限の段1が当たるまで、手順2より先に進まない（手順2・3は今の許可でも打てるが、ユーザーに閉じてもらう回数を1回にするため、まとめて行う）。

## 次の担当

ユーザー（手順0・1）→ 蒙恬（手順2〜5）→ 大岡越前守（手順6）→ ユーザー（手順7）

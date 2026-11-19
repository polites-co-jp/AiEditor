# 改名（Shuko → Sukuna）の影響の範囲と移行の手順の調べ

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-18
- 状態: 完了

## 目的

エディタの名前が「少名毘古那（Sukuna）」に決まった（2026-11-18 の裁定。`docs/user-decisions.md` の末尾）。実装と資料に残っている仮の名前「Shuko」を Sukuna に変え、日常で使っている Shuko の設定・拡張・状態を引き継いで移るために、影響の範囲と移行の手順を洗い出す。この仕事は**調べと案づくりだけ**で、コード・設定・データは変えない。権限とフックの変更が要るので、ユーザーの承認と Team の開発部への依頼の材料にする。

## 入力

- `docs/user-decisions.md` の「裁定（2026-11-18、エディタの名前）」
- `docs/08-risks-and-open-items.md` の未決の1（名前が決まったら直すもの）
- `docs/02-repository-and-build.md` の3節（product.json の上書き）と6節（版のフォルダ・`local.json`）
- `docs/06-update-watch-and-take-in.md`（`%LOCALAPPDATA%\Shuko\watch\`、DPAPI のトークン、ToDo の「プロジェクト」）
- `docs/install.md`（日常の利用の入れ方。データの置き場所の表、スタートメニュー・PATH・タスクスケジューラ）
- `product.overlay.json`、`scripts/`、`tools/watch/`、`removals/`、`extensions-src/`、`builtin/`、`tests/`、`team/departments/development/*/permissions.json`、`team/hooks/`（読むだけ。書き換えない）
- `tmp/` の下は探さない（CLAUDE.md の規約）

## 完了条件

- 「Shuko」「shuko」が出てくる場所を、種類ごとに漏れなく挙げている（product.json の各キー、台本、検知、拡張の publisher・ID、パッチ、テスト、docs、権限、フック）。過去の記録（`tasks/` の過去の分、`records/`）は直さない前提で、数だけ示す。
- 新しい名前の各識別子の案がある（`nameShort`・`nameLong`・`applicationName`・`dataFolderName`・`sharedDataFolderName`・`win32MutexName`・`win32DirName`・`win32NameVersion`・`win32RegValueName`・`win32AppUserModelId`・`win32ShellNameShort`、`mydist` の publisher、CLI の名前、`local.json` と `installRoot` の既定の場所、ToDo の「プロジェクト」の値）。ほかの製品とぶつからないかの見立てを添える。
- 日常の Shuko から移す手順がある: ユーザーのデータ（`%APPDATA%\Shuko`）、拡張（`%USERPROFILE%\.shuko`）、`%LOCALAPPDATA%\Shuko\`（`local.json`・`watch\`・DPAPI のトークン・`secrets\`）、版のフォルダ（`%LOCALAPPDATA%\Programs\Shuko`）、スタートメニュー・デスクトップのショートカット、PATH、タスクスケジューラ。それぞれ、課がやるかユーザーがやるか（既存の裁定に照らして）、元に戻す方法、日常の Shuko を止める必要があるか、を書く。
- 権限（`permissions.json`）とフック（`team/hooks/`）で変えるべき行を、ファイルと行ごとに前後の形で挙げる。Team の開発部への依頼書の形（`tasks/2026-11-17-desktop-shortcut/permission-requests.md` を手本に）で書く。
- 作業の順番（権限の変更 → 実装の改名 → テスト → ビルド → 検証 → 移行）と、蒙恬・曹参・大岡越前守の分担の案がある。
- ユーザーに諮るべき論点（あれば）を、推奨案つきで挙げる。

## 成果物

このディレクトリに保存する。

- `rename-plan.md`: 影響の範囲・識別子の案・移行の手順・作業の順番・分担・諮る論点
- `permission-requests.md`: 権限とフックの変更の依頼の案（Team の開発部あて）

## 結果

完了（2026-11-18）。`rename-plan.md`（影響の範囲 約890行・165ファイル、識別子の案、並べて入れる移行、作業の順番と分担、論点6つ）と `permission-requests.md`（段1・段2）。論点はユーザーが裁定した（`docs/user-decisions.md` の「改名の進め方」「改名の権限」）。論点3が「課が打つ」になったので差し戻し、1.5（移行の台本の行）を足した。リーダーが4節（`vlad-tepes.md` の仮称の直し）を追記した。

## 未解決

権限の段1は Team の開発部への受け渡し待ち（ユーザー経由）。段2は旧版の引退の後に改めて承認を取る。

## 次の担当

案をユーザーに諮ったうえで、権限の変更を Team の開発部に依頼し、実装（蒙恬）とテスト（曹参）を並行で依頼する。

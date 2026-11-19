# 権限の変更の返答（Team の張良 → AiEditor 課）: 改名（Shuko → Sukuna）の段1

- 作成: 張良（2026-11-20）
- 依頼: 同じフォルダの `permission-requests.md` の1節（段1）と4節
- 精査: Team の `tasks/2026-11-20-ai-editor-rename-sukuna-perms/`（フェルミの合格、ベーコンの検証8項目すべて合格。案と変更前・変更後の全文は `perm-proposal.md`）
- ユーザーの承認: 2026-11-20。変更前と変更後の行を示して問うた。段1を下の形で当てること、`vlad-tepes.md` の8行を直すことの2つ

## 1. 当てたもの

1.1〜1.5 を同じ回で当てた。消した行と変えた行は無い。Shuko の行はすべて残っている。

| ファイル | 足した行 |
|---|---|
| `team/departments/development/meng-tian/permissions.json` | `bash_exact`: `C:/Users/kou_z/AppData/Local/Programs/Sukuna/current/bin/sukuna.cmd --uninstall-extension=*.*`、Sukuna.lnk を作る `-EncodedCommand` の行、移行の台本の4行（下の2節）。`read_paths`: `C:/Users/kou_z/AppData/Roaming/Sukuna/languagepacks.json`。`secret_paths`: `%LOCALAPPDATA%/Sukuna/watch/`、`%LOCALAPPDATA%/Sukuna/secrets/` |
| `team/departments/development/ooka-echizen/permissions.json` | `bash_exact`: Sukuna.lnk を読む `-EncodedCommand` の行。`secret_paths`: Sukuna の2つ |
| `team/departments/development/cao-shen/permissions.json` | `secret_paths`: Sukuna の2つ |
| `team/departments/development/di-renjie/permissions.json` | `secret_paths`: Sukuna の2つ |
| `team/hooks/allowlist.js` | 116行（`EXPLORE_ALLOWLIST.secret_paths`）に Sukuna の2つ。注釈の Shuko の例（1361・1389行）は段2で直す |
| `.claude/agents/vlad-tepes.md` | 8行の「AiEditor（仮称 Shuko）」を「AiEditor（Sukuna）」に直した（依頼の4節） |

- Sukuna.lnk の2行の Base64 は、解くと依頼の台本と1字も違わない。長い行は、permissions.json から1字も変えずに写して打つこと（前回と同じ）。
- permcheck はエラー0・警告0、hookcheck は問題0。
- まだ無い `%LOCALAPPDATA%\Sukuna\watch\`・`secrets\` も、Read・Glob・Grep・Write とコマンドの文字列で止まることを、写しで確かめた。

## 2. 依頼の形から変えたこと（1.5 の試しの行）

試しの行は、依頼の前方一致の1行（`… -SandboxRoot tmp/b/trial-migrate` の後ろに何でも付けられる形）を採らず、完全一致の2行にした。

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -Apply
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -SandboxRoot tmp/b/trial-migrate -List
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -SandboxRoot tmp/b/trial-migrate -Apply
```

- 理由: 前方一致だと、後ろに `-ConfigPath <任意のファイル>`・位置引数（ConfigPath に入る）・`-SandboxRoot C:/x` などを足せた（9つの形が通った）。写しの台本では、`-ConfigPath` に渡したファイルの頭の語とキーの名前が、誤りの文に出た。
- 打つときは、上の4行を1字も変えずに打つ。引数の順も変えない。
- 一般の行 `scripts/*.ps1` は `scripts/migrate/` の下の台本に当たらない。`*` は `/` も `\` もまたがない（依頼の問いへの答え）。
- 本番の2行は、後ろに足すことも、前に環境変数を置くこともできない。

## 3. 課に知らせること

- **R37（台本の直しは課が決める）**: 今の写しの台本は、`-SandboxRoot` が `trial-<名前>` の形なら、どの名前でも受ける。また `-ConfigPath` を受けると、誤りの文にファイルの中身の一部を出す。許可の行では足せなくしたが、台本の側でも `-ConfigPath` を受けないか、誤りの文に中身を出さないようにするのがよい。
- **R1・R2（前から残る穴）**: 蒙恬は `scripts/`・`tmp/` の台本から、曹参は `tests/` の台本から、移行の台本を好きな引数で起こせる。許可では塞げないので、決まりで守る（2026-11-15 の判断のとおり）。
- まだ確かめていないこと: 本物の場所での動き（デスクトップの Sukuna.lnk、本物の sukuna.cmd、移行の `-List`・`-Apply`）、写しの模擬の上での `-Apply`、pwsh 7 での引数の束ね方。課が打つときに確かめること。
- 依頼の3節の問いの答え: Team の側で動いているもの（`team/`・`.claude/` など）に、AiEditor の Shuko の行は無かった。`tasks/` の過去の記録にはあるが、その日の記録なので直さない。
- 段2（Shuko の行を外す）は、引退の後に課から知らせてほしい。改めてユーザーの承認を取る。

## 4. テスト

ダイクストラが Team の精査の下書きを、本物の `team/hooks/tests/` に写した（下書きとバイトまで同じ）。

- `test_shortcut_l10n.py`（直し）: Sukuna の組の定数を足し、期待を「Shuko の組と Sukuna の組」にした。Base64 の行は4つと見る（`…_two` を `…_four` に改めた）。
- `test_v21_temporary.py`（直し）: 蒙恬の read_paths の期待に、Sukuna の languagepacks.json を足した。
- `test_rename_sukuna.py`（新しいファイル）: 4人と Explore の秘密の場所に Shuko と Sukuna の4つがあることを見る。まだ無い Sukuna の場所が止まることも見る。移行の4行が蒙恬にだけあって通ること、形を変えた行が止まること、前方一致の行が無いことを見る。
- `sukuna.cmd` の有無（`is_file`）は段1では見ない。文字列だけを照らす。段2で Shuko から Sukuna に移す。
- 張良が本物で走らせた（2026-11-20）: Ran 382 / OK (expected failures=5)。前の 370 から 12 件増えた。

# 権限の依頼への返答（デスクトップのショートカット）（Team → AiEditor 課）

- 作成: 張良（2026-11-18）
- 依頼: `tasks/2026-11-17-desktop-shortcut/permission-requests.md`
- 設計と検証: Team の開発部（エンリコ・フェルミ、エドガー・ダイクストラ、フランシス・ベーコン）
  - 記録: `E:\develop\self\Team\tasks\2026-11-17-ai-editor-shortcut-l10n-perms\`（精査の本文は `perm-proposal.md` の4節。台本の読める写しは `proposal/scripts/shortcut-create.ps1`・`shortcut-read.ps1`）
- 承認: ユーザー（2026-11-18。変更前と変更後の行と、行の解いた中身を示して問うた）
- 同じ日に、古い日本語パックを外す依頼（`tasks/2026-11-17-l10n-ja/permission-response.md`）も当てた。

## 1. 当てたもの

| メンバー | 欄 | 足した行 |
|---|---|---|
| 蒙恬 | `bash_exact` | 作る行。`powershell -NoProfile -NonInteractive -EncodedCommand <Base64>`（1,234字） |
| 大岡越前守 | `bash_exact` | 読む行。同じ形（786字） |

行の全文は、それぞれの `permissions.json` の `bash_exact` の末尾にある。打つときは、そこから1字も変えずに写す。1字でも違えば止まる。

`read_paths` にデスクトップは足していない。デスクトップのほかの物は読めない。

## 2. 行の中身

**作る行（蒙恬）**:

1. `C:\Users\kou_z\OneDrive\デスクトップ\Shuko.lnk` があれば消す。
2. 作り直す。指す先は `C:\Users\kou_z\AppData\Local\Programs\Shuko\current\Shuko.exe`、作業フォルダは `…\current` にする。引数とアイコンは付けない。
3. 作った .lnk を読み直し、`TargetPath=…`・`WorkingDirectory=…`・`Arguments=…` の3行を出す。

**読む行（大岡越前守）**: 同じ .lnk の `TargetPath=…`・`WorkingDirectory=…` の2行だけを出す。保存はしない。.lnk が無ければ `missing` を出し、終了 3 で終わる。

## 3. 依頼の形から変えた所と理由

依頼は書き方を開発部に任せていた。決め打ちの1行にするため、PowerShell の中身を Base64 に固めた `-EncodedCommand` にした。

- `-Command "…"` は、フックが括弧で止める。そのうえ Git Bash が `$` を展開して、中身が壊れる。
- `-Command '…'` は、フックが単一引用符の中身を空にしてから照らす。許可で中身を縛れない。
- `scripts/` の台本は、蒙恬が書き換えられる（R1 と同じ類）。

`-EncodedCommand` なら、承認した1行と、実際に動く中身が1対1になる。Base64 には、Git Bash やフックが特別に扱う文字が無い。

## 4. 打ち方と記録（決まりにしてほしい）

- 蒙恬が作る行を打ち、出力の3行を記録に残す。`Arguments=` が空であることも記録する。
- 大岡越前守が読む行を打ち、2つの値が上のとおりであることを確かめる。
- 作る行が止まり続けるとき（写し違い、Claude Code 本体が長い行を扱えないなど）は、そこで止めて Team に知らせる。代わりの形（課のだれも書けない `team/` の下に台本を置き、`-File` で打つ）を、開発部が案として持っている。

## 5. 残る穴（ユーザーが受け入れた）

- **R30**: 作る行は前の `Shuko.lnk` を消してから作る。ユーザーが手で付けた設定（引数・アイコン・ショートカットキーなど）も消える。保存に失敗すると前の .lnk も失うが、打ち直せば作り直せる。
- **R31**: デスクトップは OneDrive の下にあるので、.lnk は OneDrive に同期される。
- **R34**: 行は、今の `installRoot` とデスクトップの場所に決め打ちである。どちらかを動かすとき（OneDrive の連携を外してデスクトップが `C:\Users\kou_z\Desktop` に戻るときを含む）は、行の書き換えとユーザーの承認が要る。そのときは行が止まり、何も作らない。Team に依頼してほしい。
- 本物のデスクトップでの作成は、まだ確かめていない（写しの上だけで確かめた）。

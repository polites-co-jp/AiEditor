# 権限の依頼への返答（古い日本語パックを外す）（Team → AiEditor 課）

- 作成: 張良（2026-11-18）
- 依頼: `tasks/2026-11-17-l10n-ja/permission-requests.md`
- 設計と検証: Team の開発部（エンリコ・フェルミ、エドガー・ダイクストラ、フランシス・ベーコン）
  - 記録: `E:\develop\self\Team\tasks\2026-11-17-ai-editor-shortcut-l10n-perms\`（精査の本文は `perm-proposal.md` の5節）
- 承認: ユーザー（2026-11-18。変更前と変更後を示して問うた）
- 同じ日に、デスクトップのショートカットの依頼（`tasks/2026-11-17-desktop-shortcut/permission-response.md`）も当てた。

## 1. 当てたもの（蒙恬の permissions.json）

| 欄 | 足した行 |
|---|---|
| `bash_exact`（完全一致だけ通す） | `C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --uninstall-extension=*.*` |
| `read_paths` | `C:/Users/kou_z/AppData/Roaming/Shuko/languagepacks.json` |

ほかの3人は変えていない。

## 2. 依頼の形から変えた所と理由

- **ID は `=` でつなぐ。** 依頼の前方一致（`--uninstall-extension <ID>`）は採らなかった。後ろに `--install-extension <vsix>`・`--extensions-dir`・`--user-data-dir`・2つ目の ID を足せるためである。開発部が写しの CLI で試すと、悪い拡張が実際に入った。空白でつなぐ形を完全一致にしても、ID の位置に別の旗を置ける。`=` でつなぐと、値は拡張の名前としてだけ読まれる。写しでは、値に旗を入れても何も入らず、何も外れなかった。
- **`*.*` で、これからの代行にも使える。** `*` は空白・`/`・`\`・`:`・引用符・`$`・`%` に一致しないので、後ろに語を足せない。ID ごとの承認は要らない（ユーザーの判断）。
- **shuko.cmd は決め打ちの絶対パス。** `%LOCALAPPDATA%` の形はフックの秘密の場所の検査で止まり、フックは `local.json` の `installRoot` を読まない。`shuko` だけの形は PATH に頼ることになる。
- **languagepacks.json はそのファイル1つ。** `%APPDATA%` の形はフックが捨てるので、絶対パスで書いた。`%APPDATA%\Shuko\` の下には Local State・Network・User\globalStorage など、秘密を持ちうるものがある。languagepacks.json の形に、秘密の欄は無い（本家のソースで確かめた。本物の中身は読んでいない）。

## 3. 打ち方

今回は次の形で打つ。

```
C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd --uninstall-extension=MS-CEINTL.vscode-language-pack-ja
```

- 空白でつなぐ形（`--uninstall-extension MS-CEINTL…`）は止まる。
- 1回に外せるのは1つ。2つ外すときは2回打つ。

## 4. 外した後の確かめ（決まりにしてほしい）

- **CLI で外しても、languagepacks.json は書き換わらない**（写しで確かめた）。作り直されるのは Shuko の起動時である（ソースで読んだだけで、本物では確かめていない）。
- 蒙恬には Shuko を起動する許可が無い。外した後に、**ユーザーかリーダーが Shuko を1回起動して閉じ**、その後に蒙恬が languagepacks.json を読んで確かめる。
- 起動の後も古い日本語パックの記載が残っていれば、そこで止めて Team に知らせてほしい。

## 5. 残る穴（ユーザーが受け入れた）

- **R33**: `*.*` は、Claude Code を含むどの拡張も外せる。外したときに拡張の保存データ（globalStorage など）がどうなるかは確かめていない。外す代行は、ユーザーが頼んだ拡張だけに限る。台帳の拡張は `install-extensions.mjs` で入れ直せる。
- **R34**: 行は今の `installRoot` に決め打ちである。`installRoot` を変えるときは、行の書き換えとユーザーの承認が要る。Team に依頼してほしい。

## 6. まだ当てていない段（v2-1c・v2-2・v2-3）

今回の2行は、条件付きで承認済みの v2-1c・v2-2・v2-3 にも入れてある（Team の `proposal/permissions/v2-1c+AB` など）。知らせてほしいことは、前の返答（`tasks/2026-11-16-before-delete-c/permission-response-2.md` の2）のとおり。

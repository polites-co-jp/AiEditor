# Phase 2: 版の一覧（土台と、A-1〜B-7 を1単位ずつ足した版）

- 作成: 蒙恬（2026-11-14）。版ができるごとに行を足す。
- 本家: 1.146.0（`69047191fc427f2f92828279aae1d90d8eeda7ab`）。作業ツリー `C:\b\wt\p2`（版ごとにタグの commit に戻して当て直す）
- どの版にも、product.json の上書き（`product.overlay.json`）・`patches/`（20・30）・`assets/`・mydist・notion-sync を当てる。単位は `apply.mjs --only <それまでの単位の一覧>` で選ぶ（`unit.json` の `enabled` は書き換えない）。
- `build.mjs` は commit の直し（`tasks/2026-11-14-build-commit-fix/`）を入れたもの。出力の product.json の `commit` は、作業ツリーの HEAD（単位を当てた後）。
- zip の中の最上位のフォルダは `Shuko-win32-x64-<label>`。版ごとの記録は `<label>/`（`checks.json`・`lockfile.diff`・`build-record.json`・`launch-check.json`）、ログは `C:\b\logs\<label>\`。
- **展開した場所**: zip ができるごとに `scripts/p1-launch-check.ps1 -Zip C:/b/dist/<label>.zip -Dest C:/b/p2/<label>` で展開し、1回起動した（10 秒の確かめと 15 秒の待ち、ポータブル）。エディタは `C:\b\p2\<label>\Shuko-win32-x64-<label>\`。
  - その隣の `C:\b\p2\<label>\portable\` には、この1回の起動のデータ（`user-data`・`extensions`・`shared-data`・`argv.json`）が残っている。関門を空のデータで始めるなら、別の場所を使う。
  - 「起動」の列: `ok` = 起動して 25 秒生きていて、台本が止めた。普段使いのデータ（`%APPDATA%\Code`・`Code - OSS`・`Shuko`、`%USERPROFILE%\.vscode`・`.vscode-oss`・`.shuko`）は前後で変わらない。CLI `bin\shuko.cmd --version` の2行目は commit の列と同じ。

| 版（label） | 当てた単位 | 結果 | zip | SHA-256 | product.json の commit | 展開した場所（エディタ） | 起動 |
|---|---|---|---|---|---|---|---|
| `1.146.0-p2-base` | なし | **落ちた**（package。copilot の拡張の `.esbuild.mts` が `VSCODE_QUALITY` を求めた。build-log の2節） | なし | — | — | — | — |
| `1.146.0-p2-A-1`（**土台を兼ねる**） | A-1 | ok（当てる・検査・型検査・パッケージ化・後処理・zip） | `C:\b\dist\1.146.0-p2-A-1.zip`（404,985,774 B） | `fa6d0036b25c14c7be191b4640b016f500c84e606c71a608443e9e885506d427` | `3f478e8bc9f809386ce756111684206a1664c684` | `C:\b\p2\1.146.0-p2-A-1\Shuko-win32-x64-1.146.0-p2-A-1\` | ok |
| `1.146.0-p2-A-2` | A-1, A-2 | ok | `C:\b\dist\1.146.0-p2-A-2.zip`（402,107,091 B） | `8c7fc0a7f7ce14147b2d58202b2e54d487021088da5e40cefbee6cc4519cef8e` | `47a15a84c233a3cc719c3ab42c4669fca86a9546` | `C:\b\p2\1.146.0-p2-A-2\Shuko-win32-x64-1.146.0-p2-A-2\` | ok |
| `1.146.0-p2-A-3` | A-1〜A-3 | ok | `C:\b\dist\1.146.0-p2-A-3.zip`（402,063,558 B） | `259c017655ea4ebe7b45ab81db52a112753b793146efd94d1f6f05fe7465c471` | `52359930fb00f3d76ed9f854d9f93abee63409ea` | `C:\b\p2\1.146.0-p2-A-3\Shuko-win32-x64-1.146.0-p2-A-3\` | ok |
| `1.146.0-p2-A-4` | A-1〜A-4 | ok | `C:\b\dist\1.146.0-p2-A-4.zip`（401,919,773 B） | `4a198f1145710ea6d8c58aad294cc770cde2af975e28f96c55e2448721f8d8ae` | `35a89e77c2c1f10bbe8d95f3d5693c2e38a2609c` | `C:\b\p2\1.146.0-p2-A-4\Shuko-win32-x64-1.146.0-p2-A-4\` | ok |
| `1.146.0-p2-A-5` | A-1〜A-5 | ok | `C:\b\dist\1.146.0-p2-A-5.zip`（401,906,673 B） | `d237a98e641e11b150a0c6df5de7597b0278becdea96073734a64cd722c28253` | `ffa170044c12d1c2b3ea6e189fc88ae85a68f748` | `C:\b\p2\1.146.0-p2-A-5\Shuko-win32-x64-1.146.0-p2-A-5\` | ok |
| `1.146.0-p2-A-6` | A-1〜A-6 | ok | `C:\b\dist\1.146.0-p2-A-6.zip`（401,740,834 B） | `f209bdf74b87646f41c6593eeb031994f9877a0b9d854e96bc1bd0f55b73ebfd` | `d6fdf3ca4e6bbb9a1705867986fafe830e665a53` | `C:\b\p2\1.146.0-p2-A-6\Shuko-win32-x64-1.146.0-p2-A-6\` | ok |
| `1.146.0-p2-A-7` | A-1〜A-7 | ok | `C:\b\dist\1.146.0-p2-A-7.zip`（379,089,309 B） | `9db64c707e9f24ba09ecfe1486571c51e8d4fcb9b6425c21973f8c2c83e2e98c` | `a0690779f8061d017d80ffe664e720d7e34ce4c7` | `C:\b\p2\1.146.0-p2-A-7\Shuko-win32-x64-1.146.0-p2-A-7\` | ok |
| `1.146.0-p2-B-1` | A-1〜A-7, B-1 | ok | `C:\b\dist\1.146.0-p2-B-1.zip`（375,085,283 B） | `13d3b825be6b3da04e18b9f272547b5c2da3bba084a8acc375627ae06a3e4a3b` | `76c0069e952f6fa27b2ab8028db31cbcbb4fa386` | `C:\b\p2\1.146.0-p2-B-1\Shuko-win32-x64-1.146.0-p2-B-1\` | ok |
| `1.146.0-p2-B-2` | A-1〜A-7, B-1, B-2 | ok | `C:\b\dist\1.146.0-p2-B-2.zip`（374,047,294 B） | `c1416ac6e0142c5034466c59e0bbf761ce387e8da78bb29d170b193e4c0dac87` | `f77fe72c3cf06079925d0c996c001cde6e133964` | `C:\b\p2\1.146.0-p2-B-2\Shuko-win32-x64-1.146.0-p2-B-2\` | ok |
| `1.146.0-p2-B-3` | A-1〜A-7, B-1〜B-3 | ok | `C:\b\dist\1.146.0-p2-B-3.zip`（373,520,775 B） | `22bcd4c7d9beb29b58baa9fe4affb79b2fffb40bb79eb7fcbe4f6345705e63e1` | `8ea9b15c45920048e79406cc228295135ccb9cb0` | `C:\b\p2\1.146.0-p2-B-3\Shuko-win32-x64-1.146.0-p2-B-3\` | ok |
| `1.146.0-p2-B-4` | A-1〜A-7, B-1〜B-4 | ok | `C:\b\dist\1.146.0-p2-B-4.zip`（373,505,675 B） | `169526d3f9bd72e57b2206415ea8ab921885f7ea7dd16c53ebcdd9c82dbaf454` | `24d98ea7d23a0dfe5cc8934b954117eb4152449a` | `C:\b\p2\1.146.0-p2-B-4\Shuko-win32-x64-1.146.0-p2-B-4\` | ok |
| `1.146.0-p2-B-5` | A-1〜A-7, B-1〜B-5 | ok | `C:\b\dist\1.146.0-p2-B-5.zip`（373,449,690 B） | `6ab4a2c872496baf315ebe7ce8d68f98773a273ba2321be647ce8127ae36aafe` | `7e9e164621928cf615550b5625c027199be9f85b` | `C:\b\p2\1.146.0-p2-B-5\Shuko-win32-x64-1.146.0-p2-B-5\` | ok |
| `1.146.0-p2-B-6` | A-1〜A-7, B-1〜B-6 | ok | `C:\b\dist\1.146.0-p2-B-6.zip`（373,448,580 B） | `0790e2d7888519b07c19fc6c645c81cdf119b134c76dd2a2bee0aacb541075f0` | `f9ada20a69badb6da9feda3d8452a1631ad63eac` | `C:\b\p2\1.146.0-p2-B-6\Shuko-win32-x64-1.146.0-p2-B-6\` | ok |
| `1.146.0-p2-B-7`（**段階 A・B の全部**） | A-1〜A-7, B-1〜B-7 | ok | `C:\b\dist\1.146.0-p2-B-7.zip`（373,218,259 B） | `4bd9fac9322a6d42c9cf3cabfa210e8a6e44f3217dc5d3a098de71c697db0ea5` | `cc5d4fd87ccc016a6fad041aa4b5db2a4ce4e77e` | `C:\b\p2\1.146.0-p2-B-7\Shuko-win32-x64-1.146.0-p2-B-7\` | ok |

全部の版（A-1〜B-7 の14版）が zip までできた。落ちた単位は無く、単位の中身は直していない。

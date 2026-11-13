# ビルドと切り替えの台本・アイコンの台本の単体テスト 一覧と仕様の出どころ

- 作った人: 曹参（p2-tests-build、2026-11-14）
- 仕様の出どころ: `docs/02-repository-and-build.md` の4・6・6.1・8節、`docs/04-bundled-extensions.md` の5節、蒙恬の `tasks/2026-11-13-p2-build-switch/build-switch-design.md`（2.1・2.2・3.3・4.1・5.1・6 の「テストの入口」）、`tasks/2026-11-13-p2-units-b/handoff-notes.md` の追記（make-icons）、`tasks/2026-11-13-p2-apply/handoff-notes.md` の追記2〜4
- 実装を先に読んでテストを合わせてはいない。関数の戻り値の形が設計に無いところ（`parseArgs` の項目名など）は、通る・落ちるを決める項目を絞った。

## 流し方

```
node --test tests/<ファイル>.test.mjs        # 1ファイル
node tests/run-all.mjs [--no-ps] [--only <部分文字列>]   # 全部。ファイルごとの件数と落ちた名前を出す
```

試しの場所は `C:\b\tests-*-<乱数>\`（`C:\b` が無ければ OS の一時フォルダ）。テストが終わると消す（`current` のジャンクションはリンクだけを先に消す）。`scripts/` は書かない。`%LOCALAPPDATA%\Shuko\local.json`、スタートメニュー、PATH には触れない。`configure.ps1` は毎回 `-ConfigPath` と `-NoShellIntegration` を付ける。動いているエディタの再現には、`node.exe` の写しを `Shuko.exe` の名前で試しの場所に置いて起動する（本物のエディタには触れない）。

## テストの一覧

| ファイル | 対象 | 仕様の出どころ | 主な確かめ |
|---|---|---|---|
| `tests/local-config.test.mjs` | `scripts/lib/local-config.mjs`、`scripts/lib/local-config.ps1`（`tests/build/local-config-probe.ps1` で読み込む） | docs/02 の6.1、設計の2節 | 既定値、止める条件（知らないキー・大文字小文字・型・`%NAME%`・相対パス）、`C:\` と末尾の `\`、UNC、展開、優先順位と `sources`。37 の入力を Node.js と PowerShell の両方に通し、合否と4つの値が一致することを照らす |
| `tests/build-parts.test.mjs` | `scripts/build.mjs` の export と `--dry-run` | docs/02 の4節、設計の3・3.2・3.3 | `STEPS`、`selectSteps`、`nextLabel`、`zipFolderName`、`quoteCmdArg`、`childEnv`、`appliedUnitsFrom`、`parseExcludedExtensions`、`checkBuiltinExtensions`（`residual`・`missingKeep`・`notShipped`・`missingOwn`・`unexpected` の分け方）、`findAppDir`（直下・1段下・無い・2つ）、`resolveEditorLayout`、`parseArgs`（`ArgError`）。`--dry-run` は終了コード 0、`result: dry-run`、`plan`・`checksBeforeRun`、`buildRootFrom`、記録を書かないこと、`--record`、引数の誤りは終了コード 2 |
| `tests/install-ext.test.mjs` | `scripts/install-extensions.mjs` の export | docs/04 の5節・7節、設計の4・4.1 | `isLanguagePack`、`orderForInstall`、`vsixCachePath`、`parseListedExtensions`、`compareInstalled`、`scanJsonc`、`argvPathFor`、`setArgvLocale`（設計の4例、空・コメント・末尾の `,`・CRLF・既に `locale` がある・文字列に `//` を含む、など20入力で `\n}` で終わり・読み直して `locale` が `ja`・ほかのキーが残る・2回かけても同じ） |
| `tests/switch.test.mjs` | `scripts/switch.ps1` | docs/02 の6節、設計の5節 | 初回の切り替え（ジャンクション・`history.txt` の形）、2回目、同じラベル、`-Previous`（往復・履歴なし）、版が無い、engines（`^`・`>=`・終了コード 4）、バックアップ（`backup.json` の `copied`・`missing`）、`-List` と `removable`（current を数に入れる・版の並べ方・古い名前）、公式の入れ子の形、exe 無し、`-Zip`（展開・`-Sha256` の不一致・既にある）、動いているプロセスで終了コード 3（何も閉じない） |
| `tests/configure.test.mjs` | `scripts/configure.ps1` | docs/02 の6.1、設計の6節 | 引数なし（作成・書式・`builderRepo`）、あるファイル（変えない）、誤りのあるファイル、`-KeepVersions`、`-BuildRoot`（前の場所の物を動かさない）、`-BuilderRepo`（`extensions.lock.json`）、`-InstallRoot`（移動・`-NoMove`・`%NAME%` を展開せずに書く・入れ子・UNC・相対・同名がある・動いているプロセス・A→B→A の往復）。失敗した場合は元の場所と local.json が前のまま |
| `tests/make-icons.test.mjs` | `scripts/make-icons.mjs` | p2-units-b の追記のテストの入口 | `crc32`（IEND・標準の確かめ値）、`encodePng`（署名・IHDR・各チャンクの CRC・復号して画素が戻る・長さの誤り）、`encodeIco`（先頭・項目・256 は 0・オフセット・257 は例外）、`renderIcon`（長さ・四隅の透明・中心の白・決まった出力）、`makeIconFiles`（3つの相対パス・2回で同じバイト列・`assets/` の実物と一致）、コマンド（`--out`・知らない引数は終了コード 2） |
| `tests/apply-prune.test.mjs` | `scripts/lib/apply/keys.mjs` の `pruneConfigurationDefaults`（p2-apply の追記4） | `apply-design.md` の3節・2.6、`handoff-notes.md` の追記4 | `absentSettings` のキーを `configurationDefaults` から外す、`removed` の形と順、入力を変えない、`checks` が無い単位・`configurationDefaults` が無い manifest、全部外した後、入れ子のキーは外さない |
| `tests/run-all.mjs` | 全部の流し直し | brief の3 | `tests/*.test.mjs` と `tests/*.tests.ps1` をファイルごとに走らせ、件数と落ちた名前を出す |
| `tests/build/helpers.mjs`、`tests/build/local-config-probe.ps1` | 補助 | — | 試しの場所の作成と掃除、偽のエディタのフォルダ、PowerShell の起動、JSON の読み出し |

## 照らした点（Node.js と PowerShell の一致）

`local-config.test.mjs` の入力表（37通り）を両方の部品に通し、受け入れる・断るの合否と、`installRoot`・`keepVersions`・`builderRepo`・`buildRoot`・`sources` が同じになることを確かめる。

## 想定していない・していないこと

- スタートメニューのショートカットと PATH の向け直し（configure.ps1 の5）は走らせない（brief の指示）。`-NoShellIntegration` のときに触れないことだけを、全試しで通している。
- 違うドライブへの移動（robocopy /MOVE）は、別の固定 NTFS ドライブが前提なので走らせない。
- `build.mjs` の install・typecheck・package は走らせない（道具の導入待ち）。後処理と zip は、関数と `--dry-run` の範囲まで。
- `install-extensions.mjs` の本体（CLI を起動して入れる）は走らせない。関数だけ。

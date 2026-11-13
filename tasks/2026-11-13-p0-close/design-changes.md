# Phase 0 の締め（0-11）: 設計の見直しで直した点

- 作成: ヴラド・ツェペシュ（2026-11-13）
- 元: 蒙恬・曹参の `doc-corrections.md`（`tasks/2026-11-13-p0-fetch-and-lock/`・`p0-envs-mydist-keys/`・`p0-measure-netaudit-tests/`）、大岡越前守の検証の記録、ユーザーの裁定（docs/user-decisions.md の 2026-11-13 の各節）
- docs/07 の2.12 は出力を `records/phase0/design-changes.md` としているが、records/ は大岡越前守の書き込み先なので、ここに置く。

## 1. スコープの変更（裁定 2026-11-13）

- メモリ・CPU の計測と外向き通信の監査をやめた。Phase 0 の 0-4・0-5 は中止。画面での確かめ（0-2・0-3・0-7・0-8・0-9）は打ち切り、ビルドした試作の動作の確認で見る。
- 直した資料: 00 の省メモリの目標、01 の計測で重ければ→使って重ければ、03 の関門（`absentHosts` と「増えていない」をやめた）、05 の監査と計測の記述、06 の取り込みの手順 7・8 と判定の基準、07 の Phase 0〜5 の計測と監査、08 の計測のばらつきの危険と Phase 2 の諮りごと。
- 台本 `scripts/measure.ps1`・`scripts/netaudit.ps1` とそのテストは残すが使わない。
- **訂正（同日）**: 通信の監査をやめたのは、ユーザーの意図の伝え違いだった。不要な通信（データ収集、更新の確認など）はすべて止め、要る通信（Claude、git のリモート、Notion）だけを残す。監査はその確かめに使うので元に戻した（docs/user-decisions.md の「通信の扱いの訂正」）。0-5 は行い、`netaudit.ps1` は使う。戻した資料: 00、01、03 の関門の `absentHosts`、05、06 の手順7と判定、07 の0-5・3節・Phase 2・Phase 3。

## 2. 事実で直した点

| 資料 | 直した点 | 根拠 |
|---|---|---|
| 07 の2.1 | 本家の zip の URL の「推定」を外し、SHA-256 の照合先（版の API）と、1.146 系の zip が `resources\app\` を commit の先頭10桁のフォルダの下に置くことを書いた | fetch-log.md |
| 07 の2.7 の3 | ovsx を `npx` でなく、固定した版で使う | 裁定 2026-11-13、検証（5） |
| 07 の3.2 | `VSCODE_PORTABLE` と環境変数の外し方、ファイルを1つずつ開く、役割の付け直し | 検証（2）〜（4） |
| 04 の2節 | weixu.wx-vsce-dotenv の engines の「要照合」を外した | Open VSX のメタデータと manifest |
| 04 の3節 | `sha256` を VSIX 本体と照合したこと。実際の台帳が足した項目（`checks`・`references`・`crossCheck` の追加・`note`） | lock-verification.md、検証（5）の N-4 |
| 04 の4節 | ovsx の `-m`・`-s`・`-k`、同梱の CLI の場所、ソースのタグは参考の項目、ovsx の固定と pnpm、`@vscode/vsce-sign` の install スクリプトを走らせない、取り下げの確認は判定の時刻の一覧で、ライセンスの文の比べ方、Defender の引数 | lock-verification.md、裁定 2026-11-13 |
| 04 の5節の5 | `argv.json` の末尾を `\n}` で終える | 0-3 の環境づくりで実際に壊れた |
| 04 の6.1 | `workbench.colorTheme` は `Light Modern`。`basedpyright.importStrategy: useBundled` を足した | 1.146.0 の theme-defaults、裁定 2026-11-13 |
| 04 の6.2 | Sublime のキーの変換で `args` を残し、`none` と知らない修飾キーの項目を落とす | records/phase0/sublime-keys.md |
| 04 の7節 | `argv.json` の場所の仕組み（`dataFolderName`、`VSCODE_PORTABLE`） | 本家 1.146.0 の `src/mainImpl.ts` |
| 01 の4節 | basedpyright の `fromEnvironment` と `useBundled` | basedpyright-probe.md |
| 02 の4節の7 | 本家の zip の `resources\app\` の置き場所。Phase 1 で自分のビルドの形を確かめる | fetch-log.md |
| 03 の4節 | A-1 に `jsts-chat-features`・`prompt-basics` を足す見込み、A-6 に `theme-modern-icons`、`powershell` を残す理由、`media-preview` が本家 1.146.0 に無いこと | 蒙恬の doc-corrections の3 |
| 03 の9節 | Claude Code が使う受け手に、コメントの API、差分エディタ、拡張のファイルシステムの提供者、メニューの場所を足した | records/phase0/claude-code-manifest.md |

## 3. 直さなかった点

- `docs/sources/` の Ed25519 の「推定」: sources は調査の写しなので直さない（docs/04 の4節に確かめた事実がある）。
- 試験台（VSCodium）の版が本家より古いこと、計測の設定（ワークスペースの信頼を切る、表示言語をそろえる）: 0-3 と計測をやめたので、資料には足さない。

## 4. Phase 1 へ持ち越す点

- 自分のビルドの出力で、`resources\app\` の置き場所、`argv.json`・ユーザーのデータ・拡張の実際の場所。
- 打ち切った画面での確かめのうち、無改造のビルドで見られるもの（`extensions.allowed`、言語パック、`mydist` の既定）。
- Claude Code 2.1.323 が出ている（72時間を満たすのは 2026-11-15T22:13:36Z）。

# 08 リスクと未確定事項

## 1. リスクと対策

| リスク | 起きると | 対策 | 確かめる時期 |
|---|---|---|---|
| Claude Code 拡張が、宣言に出ない形で本家のチャット・言語モデル・MCP の API を使っている | C-1 の後に拡張の一部が動かない | manifest には依存の宣言が無い（[03](03-removal-design.md) の9節）。拡張 API の入口を空の実装で残す。C-1 の関門で Claude Code の組を丁寧に行い、壊れたら使われた部分を残す | Phase 0（0-2・0-3）、Phase 5（C-1） |
| コードを消すほど、毎週の当て直しで衝突が増える | 取り込みの手間が増え、セキュリティ修正の取り込みが遅れる | 単位を機能ごとに分け、共有のファイルは `removeLines` で直し、空の実装は新しいファイルに置く（[03](03-removal-design.md) の5.3）。修理は `claude -p` が3回まで行う。手間を毎週記録する | Phase 3、Phase 5 |
| 消した部品を、残す部品が実行時に使っている（型検査では見つからない注入など） | 起動時や特定の操作でエラー | 関門のスモークと、起動時のコンソール・拡張ホストのログの比較。単位ごとのコミットで原因を絞る | Phase 2、Phase 5 |
| 全文検索がノートブックの検索と結びついている（推定） | C-4 で検索が壊れる | 検索が使う部分を `kept` に入れる | Phase 5（C-4） |
| 本家が設定キー・product.json のキーを改名する | 既定の設定や上書きが黙って効かなくなる | 適用後の検査で、キーが新しい版でも登録されているかを見る | 毎週 |
| 本家が AI・テレメトリの新しい部品や組み込み拡張を足す | 消したはずの機能が戻る | 未分類の組み込み拡張と新しい部品を検査で報告し、判定で扱う。外向き通信の監査で新しい宛先を見る | 毎週 |
| Windows でのビルドが重い | 毎週の取り込みが回らない | Phase 1 で実測する。重すぎれば予備案（VSCodium の zip の後処理）をユーザーに諮る | Phase 1 |
| Open VSX の悪性版・誤判定 | 悪性の拡張を入れる。拡張が使えなくなる | 発行元、ハッシュ、署名、公式配布物（同梱の CLI のハッシュと Anthropic の manifest）との一致、寝かせる期間、manifest とファイル一覧の差分、Defender（[04](04-bundled-extensions.md) の4節） | 拡張の取り込みのたび |
| `urlProtocol` を本家と分けたため、Claude Code の URI ハンドラ（`vscode://anthropic.claude-code/open`）がこのエディタに届かない | ブラウザなどからエディタの Claude Code を開く操作が効かない | 影響する操作を Phase 1 で確かめる。日常の操作に要るなら、対処をユーザーに諮る（本家と同じ `vscode` にすると、計測のために入れる本家と衝突する） | Phase 1 |
| Claude Code の CLI が、このエディタを IDE と認めない | 統合ターミナルの `claude` が IDE に接続しない | 公式文書は VS Code の派生エディタでも動くと書く（"the extension also installs in forks like Devin Desktop or Kiro"）[一次] https://code.claude.com/docs/en/ide-integrations 。0-3 と Phase 1 で確かめる | Phase 0、Phase 1 |
| 言語パックが本体より古い | 一部の表示が英語になる | 裁定で受け入れる。0-7 で影響を見て、目立てば自分で包む別案をユーザーに諮る | Phase 0 |
| Microsoft 発行の拡張（言語パック、PowerShell）を Open VSX から取り、Code - OSS の派生で使うことが、Marketplace の規約に触れる恐れ | 規約上の問題を指摘される恐れ | 裁定: 個人利用として、法的な確認をせずに使う。リスクはユーザーが受け入れる。この資料は法的な判断をしていない | — |
| 版のフォルダの場所を変えたときに、ジャンクション・ショートカット・PATH が古い場所を指したまま残る | エディタが起動しない、古い版が起動する | `configure.ps1` がまとめて付け替え、最後に `local.json` を書く（[02](02-repository-and-build.md) の6.1） | Phase 2 |
| PDF の拡張が 2022 年から更新されていない | 新しい本体で動かなくなる恐れ | スモークで毎週見る。壊れたら差し替えを検討する（裁定） | 毎週 |
| 拡張の取り込みが本体の版に追いつかない（`engines` が新しい本体を求める） | 拡張を上げるために本体の取り込みが要る | `switch.ps1` と拡張の取り込みで `engines` を確かめる | 拡張の取り込みのたび |
| 新しい版がユーザーのデータ（`state.vscdb` など）を書き換え、前の版に戻すと不具合 | 戻したあとに設定や状態がおかしい | 切り替えの前にユーザーのデータを写す（[02](02-repository-and-build.md) の6節） | 切り替えのたび |
| Notion のトークンの漏れ | 設定ページや ToDo を読み書きされる | インテグレーションを用途ごとに分け、接続先を1ページ・1データベースに絞る。SecretStorage と DPAPI で保管し、ログに出さない | Phase 4 |
| Notion API の版の変化 | 同期や ToDo の書き込みが止まる | Notion-Version を固定（`2025-09-03`）。検知の失敗を3日で知らせる | 運用 |
| 計測のばらつき | 合否が揺れる | 1回目を捨て、5回の中央値と範囲を記録する。差が範囲より小さいことも記録する | 毎週 |
| 署名の無い実行ファイル | SmartScreen や Defender の誤検知 | 手元でビルドしたものはダウンロードの印が付かないので出にくい（推定）。誤検知が出たら記録し、ユーザーに知らせる | Phase 1 |
| 毎週の検証で、セキュリティ修正の取り込みが遅れる | 攻撃を受けうる期間が延びる | セキュリティ修正の ToDo は優先度「高」・期限は翌日。当て直しが壊れたら、壊れた単位を無効にした版を作る案を判定に書く（[03](03-removal-design.md) の8節） | 運用 |
| 開発チームの権限のフック（`team/hooks/`）には限界があり、次の形は止まらない。(1) メンバーが書いたスクリプトを走らせたとき、その中の動き。(2) 蒙恬の pnpm で、2つ目の `--dir`、`--store-dir` などの場所の上書き、`--config.*`。(3) `git -C C:/b/vscode fetch --tags` の後ろの任意の取得元。(4) `npx --prefix … tsc --noEmit -p <自分で書いた tsconfig>` による書き出し。(5) glob・8.3 の短い名前・組み立てたパスによる秘密の場所の参照 | 許可の意図から外れた場所に書く・読む | 蒙恬と曹参は自分のコードを走らせられるので、(2)〜(4) は新しい危険ではない（裁定 2026-11-13: 既知の限界として受け入れる）。`node --check` は許可を場所まで書く形にして塞いだ。大岡越前守の検証で、書き込み先の外の変更を `git status` で確かめる。根本の対策は OS のサンドボックス（未着手） | 運用 |

## 2. 実機で確かめること

| 項目 | どこで |
|---|---|
| Claude Code の manifest・ファイル一覧（最新版）、同梱の CLI の場所 | Phase 0 の 0-1 |
| `chat.disableAIFeatures: true` で Claude Code の全機能が動き、表示場所が隠れない | 0-2 |
| Code - OSS 系のビルドで組み込み拡張を消しても Claude Code が動く。提案中の API の許可が要らない。消した拡張による警告 | 0-3 |
| basedpyright が Python 本体なしで動くか。.env の拡張の診断の有無 | 0-3 |
| 計測の手順と本家の基準値 | 0-4 |
| 外向き通信の一覧 | 0-5 |
| VSIX の SHA-256 と `.sha256` の一致、`ovsx verify-signature` の手順、同梱の CLI と Anthropic の manifest の一致、Authenticode | 0-6 |
| 言語パック 1.131.0 を新しい本体で使ったときの表示 | 0-7 |
| `extensions.allowed` の CLI・VSIX・既存の拡張への効き方 | 0-8 |
| 組み込み拡張の `configurationDefaults` で、ほかの部品の設定と application スコープの設定を既定にできるか | 0-9 |
| 公式 zip の版を指定する URL（`https://update.code.visualstudio.com/<版>/win32-x64-archive/stable`） | 0 の用意 |
| npm か pnpm か、型検査の script、実行ファイルの名前、ユーザーのデータ・拡張・`argv.json` の場所、`tar.exe` での zip、`test/smoke` の `--build` | Phase 1 |
| ビルドの所要時間・ディスク・ピークのメモリ | Phase 1 |
| `urlProtocol` を変えたときの Claude Code の URI ハンドラ | Phase 1 |
| `extensions/mydist` が `extensions/*/package.json` の走査で同梱されるか。先にビルドした `notion-sync` が同梱されるか | Phase 2 |
| ロックファイルの差分が「消した依存の削除」だけになるか | Phase 2 |
| 拡張 API の空の実装で、PowerShell 拡張などが起動時に失敗しないか | Phase 5（C-2 など） |
| ユーザーの `User` フォルダを `globalStorageUri` から求められるか | Phase 4 |
| DPAPI のトークンが別のユーザーで読めないこと | Phase 4 |

## 3. 調べること（外部の事実）

| 項目 | 何のためか | 今わかっていること |
|---|---|---|
| Open VSX の `.sigzip` の仕様と、`ovsx verify-signature` の `-m` の中身 | 署名の検証 | 公式の文書が見つからない（未確認）。公開鍵は PEM で、Ed25519 の見込み（推定） |
| `extensions.allowed` が CLI の `--install-extension` に効くか | 拡張の追加の防止 | 公式に記述なし（未確認）。0-8 で実機で確かめる |
| `webviewContentExternalBaseUrlTemplate` の役割と宛先 | Webview（Claude Code のパネル）の通信の扱い | 未調査。0-5 の棚卸しで宛先を見る |
| vscode-loc の文字列と本体の版の対応 | 言語パックを自分で包む別案 | 記述が無い（未確認） |
| ms-vscode.powershell のサーバー側（PSES）のライセンス | 同梱の表示 | 拡張の LICENSE.txt は MIT License と確かめた（GitHub と VSIX 内。[04](04-bundled-extensions.md) の2節）。PSES は未確認 |
| `shfmt`・Node.js・Python の版ごとの winget の ID の公式の裏付け | 手順書 | winget-pkgs のフォルダ名からの推定 |
| zip を作る本家のビルドのタスクの有無（`build/azure-pipelines` などを含む） | zip の作り方 | gulpfile の2本には無い。ビルド全体は未確認 |

## 4. ユーザーが決めること

### 4.1 決定済み（2026-11-12、設計資料の論点への裁定）

裁定の全文は [00](00-overview.md) の4.3。各文書には「裁定」として反映した。

| 論点 | 決定 | 反映した箇所 |
|---|---|---|
| 拡張 API の入口（`vscode.debug`・`vscode.notebooks`・`vscode.lm`・`vscode.chat` など） | 入口は何もしない実装にして残し、中身のコードは消す | [03](03-removal-design.md) の2節の4 |
| 裁定に無かった機能 | `terminal-suggest` は消す（A-7）。テストとコメントは残す。計測で重ければ改めて諮る | [01](01-requirements.md)、[03](03-removal-design.md) |
| .env の拡張 | Phase 0 で `dotenv.dotenv-vscode` と `weixu.wx-vsce-dotenv` を試し、エラー表示を持つほうを採る | [01](01-requirements.md) の4節、[04](04-bundled-extensions.md) の2節、[07](07-phases.md) の 0-3 |
| 拡張の新版を寝かせる期間 | 公開から72時間未満の版は、セキュリティ修正でない限り入れない | [04](04-bundled-extensions.md) の4節の4、[06](06-update-watch-and-take-in.md) の2.3 |
| 更新の検知のトークン | DPAPI で暗号化したファイルに置く | [06](06-update-watch-and-take-in.md) の2.4 |
| Notion のインテグレーション | 2つに分ける（設定の同期用は設定ページだけ、更新の検知用は ToDo データベースだけ） | [05](05-settings-sync.md) の7節、[06](06-update-watch-and-take-in.md) の2.4 |
| 取り込みの結果の書き戻し | 書き戻す。ToDo の本文に判定の要約を足し、状態を `In progress` にする | [06](06-update-watch-and-take-in.md) の4節・6節 |
| ToDo の優先度・期限 | セキュリティ修正あり: 高・翌日。それ以外: 期限はすべて7日後で、優先度は本体と Claude Code 拡張が中、ほかの拡張が低 | [06](06-update-watch-and-take-in.md) の2.3 |
| 版のフォルダの場所 | 設定で変えられるようにする。設計で、PC ごとの設定ファイル `%LOCALAPPDATA%\Shuko\local.json` の `installRoot`（既定 `%LOCALAPPDATA%\Programs\Shuko`）とし、切り替え・取り込み・拡張の導入・計測・更新の検知の道具が共通の部品で読むことにした | [02](02-repository-and-build.md) の6.1 |
| 言語パックが本体より古い点 | 未訳の部分が英語になるのを受け入れる。目立つなら改めて諮る | [04](04-bundled-extensions.md) の7節、[07](07-phases.md) の 0-7 |
| Microsoft 発行の拡張（日本語パック・PowerShell）を Open VSX から使う法的な確認 | 個人利用として、確認せずに使う。リスクはユーザーが受け入れる | [00](00-overview.md) の5節、[04](04-bundled-extensions.md) の7節、1節 |

### 4.2 未決（そのときに諮る）

1. **エディタの名前とアイコン**: Microsoft・Visual Studio・Claude の名称とロゴは使わない（裁定）。決まったら、product.json の上書き（[02](02-repository-and-build.md) の3節）、`mydist` の publisher、ToDo のプロジェクト、`local.json` の置き場所と `installRoot` の既定値の名前を直す。
2. **Phase 1 の後に、ビルドが重すぎるか**: 所要時間とディスクの実測を添えて諮る。重すぎるなら、予備案（VSCodium の zip の後処理）にするかも諮る（裁定）。
3. **Phase 0 の結果しだいで諮ること**:
   - .env の2つの拡張が、どちらもエラー表示を持たないか、両方とも持つとき（[07](07-phases.md) の 0-3）。
   - 言語パックの英語の表示が目立つとき（0-7）。
   - Claude Code が動かず、残す部分が裁定の範囲で決められないとき。
4. **運用しながら諮ること**:
   - テストとコメントが、計測で重いと分かったとき。
   - C-7（パンくずリスト）が関門を2回続けて通らないとき（5節の別案）。
   - Phase 2 で合格しないとき、次に消す候補（[07](07-phases.md) の5節）。
   - `urlProtocol` を本家と分けたことで、日常の操作に要る Claude Code の URI ハンドラが効かないとき（1節）。

## 5. 別案（裁定や推奨と違う案）

裁定と違う案は、ユーザーが選ばない限り採らない。

| 別案 | 中身 | 採るとしたら |
|---|---|---|
| VSCodium の zip の後処理で運用する | VSCodium の Windows 版 zip から組み込み拡張を消し、上書きと台帳の拡張を足す。ソースのビルドが要らない。ただし「コードごと消す」は組み込み拡張のフォルダの範囲に限られ、VSCodium の遅れがそのままセキュリティ修正の遅れになる | 裁定どおり、Phase 1 でソースのビルドが重すぎたときに諮る |
| パンくずリストを設定で隠すところで止める | C-7 は本家の共有部品に深く入るので、`breadcrumbs.enabled: false` とコードを到達しない状態にするところで止める。裁定の「コードごと消す」と違う | C-7 が関門を2回続けて通らなかったときに諮る |
| 段階 C の順を依存の少ない順にする | リモート → ノートブック → デバッガ → AI の順にすると、AI の単位が他の機能への参照を直す量が減る見込み（推定）。一方で、最大の仮説（チャットを消しても Claude Code が動くか）の確認が後になる | C-1 の修正が大きすぎて進まないとき |
| ポータブルモード | 実行ファイルの隣の `data` にユーザーのデータと拡張を置く。OSS のビルドでも効く見込み（ソースの読み。未確認）。版ごとにデータが分かれ、切り替えのたびに写す必要がある | データを版ごとに分けたいとき |
| 言語パックを自分で包む | vscode-loc（MIT）から本体と同じ版の言語パックを作る。版の対応が分からない | 英語の表示が目立つとき |
| 設定の同期をエディタの外のスクリプトで行う | タスクスケジューラなどでファイルを Notion と同期する。起動・保存に合わせにくく、競合を見せられない | 採らない |
| 本家の Settings Sync を Notion へ向ける | 本家は独自のバックエンドに対応していない。裁定でも使わない | 採らない |
| 通知に試しの当て直しの結果を添える | 裁定で「通知だけ」と決まった | 採らない |

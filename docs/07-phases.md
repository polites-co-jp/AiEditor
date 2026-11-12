# 07 進め方

## 1. 段階の一覧

| 段階 | やること | 完了の条件 | 通らないとき |
|---|---|---|---|
| **Phase 0** ビルド無しで仮説を確かめる | 2節。特に、本家のチャットを止めた状態と、組み込み拡張を消した Code - OSS 系のビルドで、Claude Code 拡張が動くか | 2.13 | Claude Code が動かない原因を特定し、残す部分を [03](03-removal-design.md) に書き足す |
| **Phase 1** ビルドの関門 | 無改造の本家タグを Windows でビルドし、zip にして動かす | 4節 | ビルドが重すぎるなら、予備案（VSCodium の zip の後処理で運用）をユーザーに諮る（裁定） |
| **Phase 2** 試作と計測（段階 A・B） | ビルドリポジトリを作り、段階 A・B の単位を1つずつ関門を通して有効にする | 5節 | 単位を無効のまま残し、理由を書く |
| **Phase 3** 取り込みのリハーサル | 試作より新しいタグに対して、取り込みを最後まで1回通す | 6節 | パッチの切り方・単位の分け方を見直す |
| **Phase 4** 運用の開始 | `notion-sync`、更新の検知、版の切り替え、手順書を整え、日常の利用に切り替える | 7節 | — |
| **Phase 5** 深い部分を消す（段階 C） | C-1 から C-7 を1単位ずつ、関門を通して有効にする。裁定の「段階的に全部消す」の後半 | 8節 | 単位ごとに直すか無効のまま残す。C-7 は2回続けて通らなければユーザーに諮る |
| 運用 | 毎週の取り込み、拡張の取り込み | — | — |

**最初の版（MVP）**: Phase 4 の終わり。段階 A・B を消し、テレメトリを差し替え、台帳の拡張・`mydist`・`notion-sync`・更新の検知・版の切り替えがそろった状態。段階 C は MVP の後に1つずつ進める。

## 2. Phase 0: ビルド無しで仮説を確かめる

目的: ビルドの環境に何日も費やす前に、最大の不確かさ（Claude Code 拡張の依存、組み込み拡張を消したときに何がおかしくなるか、計測と監査の手順、拡張の検証の手順）を解消する。

結果はすべてビルドリポジトリの `records/phase0/` に書く（リポジトリはこの段階で作り、`docs/` にこの資料を置く）。

### 2.1 用意するもの

| もの | 取り方 | 置き場所の例 |
|---|---|---|
| 本家 VS Code の zip（Windows x64、版は本家の最新の安定版。2026-11-12 時点で 1.146.0） | 公式のダウンロードの「zip」。版を指定する URL は `https://update.code.visualstudio.com/<版>/win32-x64-archive/stable` の見込み（推定） | `C:\b\p0\vscode-<版>\` |
| VSCodium の Windows x64 の zip（最新） | https://github.com/VSCodium/vscodium/releases | `C:\b\p0\vscodium-<版>\` |
| 台帳に載せる拡張の VSIX | [04](04-bundled-extensions.md) の2節の各拡張を Open VSX から（手順 0-6） | `C:\b\p0\vsix\` |
| Claude Code の CLI | 公式の手順 https://code.claude.com/docs/en/setup 。ログインしておく | — |
| 計測用のワークスペース | TS と Python を含む実際のリポジトリ。コミットを固定して記録する。裁定（2026-11-13）: kuebiko を、このリポジトリの `tmp\ws\` に clone する（`tmp/` は git の管理外）。clone 元は GitHub の `polites-co-jp/kuebiko` の main、コミット `2385a2ff1ea22ceaa5a039500f3f88361eef2392`。開く2つのファイルは `C:\b\p0\ws-info.json` | `<リポジトリ>\tmp\ws\` |
| Node.js、Git for Windows、PowerShell 7、Python 3、ShellCheck | [01](01-requirements.md) の4.1 | — |

置き場所は、開発チームの書き込み先（ビルドの作業場所 `C:\b\`）の中にした（2026-11-13。もとの例は `C:\p0\`）。データの置き場所は、ビルドごとに `--user-data-dir` と `--extensions-dir` で分ける（例 `C:\b\p0\data\<名前>\user`、`C:\b\p0\data\<名前>\ext`）。普段使いのエディタの設定に触れない。

### 2.2 0-1 Claude Code 拡張の manifest とファイル一覧

1. `https://open-vsx.org/api/Anthropic/claude-code/win32-x64` から最新の版を読み、`files.manifest`（package.json）を取る。
2. 次の項目を表にする: `engines`、`main`、`activationEvents`、`extensionKind`、`extensionDependencies`、`extensionPack`、`enabledApiProposals`、`capabilities`、`contributes` のキーと、そのうち `chatParticipants`・`languageModelTools`・`languageModelChatProviders`・`mcpServerDefinitionProviders`・`debuggers`・`notebooks` の有無。2.1.322 の値（[03](03-removal-design.md) の9節）と比べる。
3. VSIX（zip）の**ファイルの一覧**を取る（例: PowerShell の `[System.IO.Compression.ZipFile]::OpenRead(<vsix>).Entries`）。実行ファイル（.exe・.dll・.node）、主なフォルダ、サイズを表にする。**JS の中身は開かない**（裁定）。
4. 出力: `records/phase0/claude-code-manifest.md`。

### 2.3 0-2 本家で AI を止めて Claude Code を使う

1. 本家の zip を展開し、`bin\code.cmd --user-data-dir ... --extensions-dir ... --install-extension <Claude Code の VSIX>` で入れる。
2. ユーザー設定に `"chat.disableAIFeatures": true` を書く [一次] https://code.visualstudio.com/docs/agents/reference/ai-settings 。
3. 計測用のワークスペースを開き、信頼する。[06](06-update-watch-and-take-in.md) の5節の `claude-code` の組を全部行う。拡張の表示場所（アクティビティバー、セカンダリサイドバー）が隠れていないかも見る。
4. 開発者ツールのコンソール（Help → Toggle Developer Tools）と、出力パネルの拡張ホストのログのエラーを写す。
5. 出力: `records/phase0/upstream-ai-disabled.md`（項目ごとの可否、エラー）。

### 2.4 0-3 Code - OSS 系のビルドで組み込み拡張を消して使う（試験台は VSCodium）

1. VSCodium の zip を展開する。`resources\app\extensions\` の中から、段階 A で消す組み込み拡張（[03](03-removal-design.md) の4節。VSCodium に無いものは飛ばす）のフォルダを消す。
2. 台帳の拡張をすべて `--install-extension` で入れる（手順 0-6 で取った VSIX）。
3. 計測用のワークスペースで、[06](06-update-watch-and-take-in.md) の5節の `base`・`claude-code`・`languages` の組を行う。
4. 次を記録する。
   - 拡張のフォルダを消したことによる警告・エラー（起動時、拡張ホストのログ）
   - 提案中の API の許可が要るという誤り（拡張ホストのログ）の有無
   - Claude Code の `walkthroughs` など、受け手の無い宣言による警告の有無
   - basedpyright が Python 本体なしで動くか、`python.pythonPath` を指したときに診断が出るか
   - .env の拡張の `dotenv.dotenv-vscode` と `weixu.wx-vsce-dotenv` の両方について、補完と診断（エラー表示）の有無。裁定により、エラー表示を持つほうを台帳に載せる。両方とも持たないとき、または両方とも持つときは、結果を添えてユーザーに諮る
5. 出力: `records/phase0/codeoss-testbed.md`。

### 2.5 0-4 計測の手順を固定し、本家の基準値を取る

3節の手順を `scripts/measure.ps1` として作り、次を測る。

- 本家の zip（AI は既定のまま。台帳の拡張を入れる）を5回。
- 参考: 0-3 の試験台を5回（合否には使わない。削る効き目の見当をつけるため）。

出力: `records/measurements/<日付>-phase0/`（プロセスごとの CSV、合計、中央値、最大と最小の差）。

### 2.6 0-5 外向き通信の棚卸し

3.3 の手順を `scripts/netaudit.ps1` として作り、本家（AI を止めた状態と既定の状態）と試験台で、起動から10分の接続先を集める。

出力: `records/phase0/network-inventory.md`。表の列は「宛先（ホスト名）・接続したプロセス・何のための通信か（分かる範囲。分からなければ未確認）・要るか（要る / 設定で止める / 単位で消す）・止め方」。Claude Code の CLI（claude.exe）の通信は別の表にする（エディタの削る対象ではない）。止める設定は [04](04-bundled-extensions.md) の6.1 に足す。

### 2.7 0-6 台帳の取得と検証の手順を確かめる

[04](04-bundled-extensions.md) の4節の検証の項目を、台帳のすべての拡張に対して手で行い、`scripts/lock-fetch.mjs`・`scripts/lock-verify.mjs` の手順を決める。

1. VSIX、`.sha256`、`.sigzip`、公開鍵、manifest を取る。
2. `Get-FileHash <vsix> -Algorithm SHA256` を `.sha256` の値と比べる（Claude Code 2.1.322 win32-x64 の公開値は `8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4`）。
3. `npx ovsx verify-signature -i <vsix> -m <manifest> -s <sigzip> -k <公開鍵>` を試す。`-m` に何を渡すかを、ovsx の README とヘルプで確かめる。通らなければ、何が足りないかを書く。
4. Claude Code の VSIX のファイル一覧から同梱の CLI を見つけ、SHA-256 を `https://downloads.claude.ai/claude-code-releases/<版>/manifest.json` の該当プラットフォームの `checksum` と比べる。`manifest.json.sig` を GPG で検証する（鍵 `https://downloads.claude.ai/keys/claude-code.asc`、指紋 `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`）。`Get-AuthenticodeSignature` で "Anthropic, PBC" の署名を見る。
5. Defender で走査する（`MpCmdRun.exe` の引数を確かめる）。
6. 出力: `records/phase0/lock-verification.md`、台帳の最初の版 `extensions.lock.json`。

### 2.8 0-7 言語パックの版のずれ

本家の zip（1.146 系）と試験台に言語パック 1.131.0 を入れ、`argv.json` に `"locale": "ja"` を書いて起動する。英語のまま残る場所（設定の画面、コマンドパレット、メニュー、Claude Code の表示）を記録する。裁定により、未訳の部分が英語になるのは受け入れる。日常の操作で目立つ場所があれば、その一覧を添えてユーザーに諮る。出力: `records/phase0/language-pack.md`。

### 2.9 0-8 `extensions.allowed` の効き方

本家の zip で、ユーザー設定に `extensions.allowed` を `{"*": false, "anthropic.claude-code": true}` と書き、(a) 許可していない VSIX を CLI の `--install-extension` で入れる、(b) 画面の「VSIX からインストール」で入れる、(c) すでに入っている許可外の拡張がどうなるか、を確かめる。出力: `records/phase0/extensions-allowed.md`。

### 2.10 0-9 組み込み拡張の `configurationDefaults` で既定にできる設定

`mydist` の試作（package.json だけ。`configurationDefaults` に `chat.disableAIFeatures`、`telemetry.telemetryLevel`、`workbench.colorTheme`、`extensions.allowed`、`breadcrumbs.enabled`）を作り、本家の zip に `--extensionDevelopmentPath=<フォルダ>` で読み込ませる。各設定の既定値が変わったかを設定の画面で見る。出力: `records/phase0/configuration-defaults.md`。

### 2.11 0-10 Sublime のキーの変換の試し

`ms-vscode.sublime-keybindings` 4.1.10 の VSIX から `contributes.keybindings` を取り、[04](04-bundled-extensions.md) の6.2 の変換を試す。Claude Code の既定のキーとの衝突の一覧を作る。出力: `records/phase0/sublime-keys.md`。

### 2.12 0-11 設計の見直し

0-1〜0-10 の結果で、この資料と食い違う点を直す。直した点を `records/phase0/design-changes.md` に書く。

### 2.13 Phase 0 の完了の条件

- 0-1〜0-11 の出力がすべてある。
- 本家で AI を止めた状態（0-2）と、組み込み拡張を消した試験台（0-3）で、Claude Code の組が全部通る。通らない項目は、原因（どの部品が要るか）を特定し、残す部分を [03](03-removal-design.md) に書いてある。
- 計測の手順が `scripts/measure.ps1` として固まり、本家の基準値（5回の中央値と範囲）がある。
- 外向き通信の棚卸し表がある。
- 台帳のすべての拡張について、検証の結果がある（できなかった項目は理由つき）。
- ユーザーに諮ることがあれば、推奨案をつけて挙げてある。

## 3. 計測の手順（Phase 0 で固定し、以後ずっと使う）

### 3.1 そろえる条件

| 条件 | 本家 | 自作 |
|---|---|---|
| 本体の版 | 自作の土台と同じ版の公式の zip | 計測する版 |
| データの置き場所 | 新しく作る（`--user-data-dir`、`--extensions-dir`） | 同じく新しく作る |
| 第三者の拡張 | 台帳の拡張と同じ版 | 台帳の拡張 |
| ユーザー設定 | 同じもの（`task.allowAutomaticTasks: "on"` など、台本に要るものだけ）。本家の AI は既定のまま | 同じもの。`mydist` の既定は自作の一部として効く |
| ワークスペース | 同じリポジトリの同じコミット | 同じ |
| PC の状態 | ほかのアプリを閉じ、電源の設定をそろえ、同じ日に続けて測る | 同じ |

### 3.2 台本と集計

1. 起動: `<exe> --user-data-dir <U> --extensions-dir <E> <ワークスペース>`。
2. 30秒待ち、CLI（`-r`）で決まった2つのファイル（TS と Python）を開く。
3. ワークスペースの `.vscode/tasks.json` に、フォルダを開いたときに動くタスク（`"runOptions": {"runOn": "folderOpen"}`）を置き、ターミナルを1つ開かせる。
4. 120秒待ってから測る。
5. 起動した実行ファイルのプロセスとその子孫を、`Get-CimInstance Win32_Process`（`ProcessId`、`ParentProcessId`、`Name`、`CommandLine`、`PrivatePageCount`、`WorkingSetSize`）で集める。
6. 合計を2つ出す。**プライベートバイトの合計（主）**と**ワーキングセットの合計（従）**。プロセスごとの値も CSV に残し、役割（`--type=renderer`、拡張ホスト、ptyHost、言語サーバーなど。`CommandLine` から分かる範囲）を付ける。
7. Claude Code の CLI（claude.exe）とその子孫は別に集計し、「含めた合計」と「含めない合計」の両方を記録する。合否は「含めない合計」で見る（CLI はエディタの削る対象ではないため）。
8. プロセスを止め、10秒待つ。

- 1回目は捨てる（キャッシュを作るため）。続けて5回測り、中央値と、最大と最小の差（範囲）を出す。
- **節目の計測**（Phase 0、Phase 2 の終わり、Phase 5 の各単位）では、手順 4 の前に Claude Code のパネルで決まった1文を送って応答を待つ手順を足す（手で行う）。
- 記録: `records/measurements/<日付>-<ラベル>/`（CSV、合計、中央値、範囲、変えた既定値の一覧、PC の状態）。
- 補い: エディタの Process Explorer の画面も1枚残す。ただし Process Explorer の値は OS の表示と一致しないことがある（[一次 issue] https://github.com/microsoft/vscode/issues/194322）ので、合否には使わない。

### 3.3 外向き通信の監査

1. 起動から10分、2秒ごとに `Get-NetTCPConnection -State Established` を取り、エディタのプロセスとその子孫の接続だけを残す（3.2 の5の方法で PID を集める）。
2. 始めと終わりに `Get-DnsClientCache` を取り、IP アドレスとホスト名を結びつける。
3. 宛先ごとに、初めて見えた時刻、プロセス、回数を出す。
4. 前の版（Phase 0 では本家）の一覧と比べ、新しい宛先を目立たせる。
5. 許した宛先の一覧（`records/network-allowlist.json`。例: `api.notion.com`、Claude Code が使う宛先）にないものは、判定で報告する。

UDP や、2秒より短い接続は取りこぼす。必要になったら、Windows 標準の `pktmon` か Resource Monitor で補う（Phase 0 で要否を決める）。

### 3.4 合格の基準

- 裁定: 本家より少しでも減れば合格。**同じ条件の5回の中央値（プライベートバイトの合計、CLI を含めない）が、本家の中央値より小さければ合格**。
- 差が範囲より小さいときも合格だが、そのことを記録に書く。

## 4. Phase 1: ビルドの関門

1. [02](02-repository-and-build.md) の5節の環境を整える（何を入れたか、版を記録する）。
2. 本家の基準のタグ（Phase 0 で使った版）の作業ツリーを作り、無改造のまま、依存の導入 → パッケージ化（`vscode-win32-x64-min`）→ zip までを行う。
3. 次を記録する: 各手順の所要時間、ディスクの使用量（作業ツリー、キャッシュ、出力）、ピークのメモリ、使ったパッケージマネージャー（npm か pnpm か）、型検査だけを走らせる script の名前、実行ファイルの名前、ユーザーのデータと拡張と `argv.json` の実際の場所、`tar.exe` で zip が作れるか、`test/smoke` を `--build` で向けられるか。
4. 無改造の Code - OSS に台帳の拡張を入れ、`claude-code` の組を通す。3節の手順で5回測る。
5. この資料の推定の箇所（[02](02-repository-and-build.md) の4節・6節、[04](04-bundled-extensions.md) の7節）を、記録した事実で直す。

完了の条件: 無改造のビルドが zip から起動し、Claude Code の組が通り、所要時間と計測の記録がある。

関門: 1回の取り込み（作業ツリーの用意から zip まで）が重すぎて毎週回らないとき、裁定どおり、予備案（VSCodium の zip の後処理で運用）にするかをユーザーに諮る。「重すぎる」の目安は根拠のある値が無いので、所要時間とディスクの実測を添えてユーザーに決めてもらう。

## 5. Phase 2: 試作と計測（段階 A・B）

1. ビルドリポジトリの骨組み（[02](02-repository-and-build.md) の2節）、`product.overlay.json`、ブランドの資産、`mydist`、台帳と `install-extensions.mjs`、`switch.ps1`、PC ごとの設定ファイル `local.json` とそれを読む共通の部品・`configure.ps1`（[02](02-repository-and-build.md) の6.1）を作る。`configure.ps1 -InstallRoot` で場所を変え、切り替えと戻しが新しい場所で動くことを確かめる。
2. 単位を1つも有効にしない状態でビルドし、基準を測る（上書きと `mydist` だけの効き目）。
3. A-1 から B-5 まで、1単位ずつ: 単位を作る → 関門（[03](03-removal-design.md) の7節）→ `enabled: true`。各単位の計測を残す。
4. 全部を有効にした版で、節目の計測（3.2）と通信の監査を行う。

完了の条件: 段階 A・B の各単位が有効か、無効の理由が書いてある。全部を有効にした版が、3.4 の基準で合格する。外向き通信が許した宛先だけになっている（残るものは理由つき）。

合格しないとき: プロセスごとの値から、どのプロセスが本家より重いかを示し、次に消す候補を推奨つきでユーザーに諮る。

## 6. Phase 3: 取り込みのリハーサル

1. 試作の土台より新しいタグ（少なくとも1つ後の週の版）を選ぶ。
2. `take-in.mjs core <tag>` を最後まで通す（当て直し、検査、修理、ビルド、スモーク、監査、計測、判定）。
3. 手間を記録する: 当たらなかった単位とパッチの数、`claude -p` の修理の回数、ユーザーが手を入れた回数、全体の所要時間。
4. 拡張の取り込み（`take-in.mjs ext`）も1回通す（Claude Code 拡張の新版があればそれで）。

完了の条件: 判定が出て、`switch.ps1` で切り替えと戻しが一往復できる。

通らないとき: 壊れやすかった単位のパッチを小さく分けるか、`removeLines` に寄せる。

## 7. Phase 4: 運用の開始

1. `notion-sync` を作る（[05](05-settings-sync.md)）。Notion の設定ページとインテグレーションを用意する。2台目の PC（または別のユーザーのデータの置き場所）で、取り込み・書き出し・競合の3通りを確かめる。
2. 更新の検知を作る（[06](06-update-watch-and-take-in.md) の2節）。ToDo のインテグレーションとトークンを用意し、タスクスケジューラに登録する。わざと台帳の版を1つ古くして、ToDo ができること、2回動かしても重複しないこと、取り込みの後に ToDo の本文に判定の要約が足され状態が `In progress` になることを確かめる。DPAPI のトークンが別のユーザーで読めないことを確かめる。
3. インストールの手順書 `docs/install.md` を書く: `configure.ps1` による `local.json` の作成（版のフォルダの場所を変えるときの手順を含む）、zip の展開、`current` のジャンクション、スタートメニューと PATH、台帳の拡張の導入、外部ツール（[01](01-requirements.md) の4.1）、Notion の設定、更新の検知の登録。
4. 日常の利用に切り替える。本家の VS Code は計測の比べ相手として残す。

完了の条件: 1週間、日常の利用で使え、その間に出た新版の ToDo が入り、1回の毎週の取り込みを通した。

## 8. Phase 5: 深い部分を消す（段階 C）

- C-1 から C-7 を順に、1単位ずつ。各単位は [03](03-removal-design.md) の7節の関門を通し、節目の計測を行う。
- 単位を有効にした版を1週間以上日常で使い、問題が無ければ次の単位へ進む。
- C-1 の関門では、Claude Code の組を特に丁寧に行う（本家のチャットを消しても動くかの最終の確認）。動かなくなったら [03](03-removal-design.md) の9節の扱いで残す部分を決める。
- 単位を足すたびに、Phase 3 の手間の記録と同じ項目を毎週の取り込みで記録し、保守の手間の増え方を見る。

完了の条件: C-1 から C-7 の各単位が有効か、無効の理由が書いてある（C-7 で諮ったときはユーザーの裁定がある）。

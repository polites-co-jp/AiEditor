# Claude Code 用 VSCode フォーク — ユーザーの裁定

このプロジェクトでユーザーが決めたことの記録。調査・設計はこれを前提にする。覆す案は別案として分け、ユーザーへの論点に挙げる。

> この文書は、設計を行ったエージェントチームのリポジトリから 2026-11-12 に写したもの。以後の裁定はこのファイルに追記する。本文中の `tasks/...` のパスは写す前の場所で、写した先は次のとおり。
>
> | 本文のパス | このリポジトリでの場所 |
> |---|---|
> | `tasks/2026-11-12-claude-vscode-design/<ファイル>` | `docs/<ファイル>` |
> | `tasks/2026-11-12-claude-vscode-research-base/fork-base-research.md` | `docs/sources/fork-base-research.md` |
> | `tasks/2026-11-12-claude-vscode-research-features/feature-memory-research.md` | `docs/sources/feature-memory-research.md` |
> | `tasks/2026-11-12-claude-vscode-approach/proposal.md` | 写していない（実現方針の提案。採否は下の裁定に反映済み） |

## 構想（2026-11-12 ユーザー依頼）

- VSCode のリポジトリをフォークし、ユーザー専用のエディタを作る。
- 既存 VSCode から多くの機能を削り、必要な機能だけを取り入れる。Claude によるコーディングに特化した、省メモリのエディタにする。
- ユーザーが最初に挙げた機能: 基本のテキスト編集、ショートカット編集、Sublime Text のキー割り当て、git 操作、Claude Code 拡張、日本語化、ファイルエクスプローラー、ターミナル。

## 裁定（2026-11-12）

| 論点 | 裁定 |
|---|---|
| 対象 OS | Windows のみ |
| 本家への追従 | 自動では追従しない。本家に更新（特にセキュリティ修正）が出たことだけ通知してほしい。取り込むかどうかは、そのつど Claude に検証させて決める |
| 残す・入れる機能（追加） | 全文検索・置換、差分ビュー、言語機能（補完・エラー表示）、Markdown プレビュー、設定の同期、画像・PDF プレビュー、問題パネル・タスク実行 |
| 削る候補（選ばれなかったもの） | 拡張の追加インストール（同梱した拡張だけで動く固定構成）、デバッガ、リモート開発（SSH・WSL・コンテナ）、Jupyter ノートブック |
| 省メモリの目標 | 数値の目標は定めない。やるべき削減をやり、本家より少しでも減れば合格とする（2026-11-12 調査後に再裁定）。→ 2026-11-13 に改めた: 計測はせず、減ったかはユーザーが使って判断する（末尾の「計測と通信の監査をやめる」） |
| 補完・エラー表示の対象言語 | TypeScript / JavaScript、Python、HTML / CSS / JSON、CSV、.env、sh、cmd、PowerShell。それ以外は色付けだけ |
| 本家の AI 機能（Copilot・チャットパネル） | 削る。ただし Claude Code 拡張が依存する部分があれば調査で特定して残す |

| テレメトリ・不要な外部通信 | 削る（送信処理ごと外す） |
| 本家の更新の通知 | 本家に新版（特にセキュリティ修正）が出たら、Notion の ToDo に「取り込みの検証」を追加する |
| 画面の部品で残すもの | ミニマップ、エディタの分割・複数ウィンドウ |
| 画面の部品で削る候補 | アウトライン・パンくずリスト、テーマの切り替え（固定のテーマ1つ） |
| その他残すもの | コマンドパレット、スニペット・自動整形、タイムライン・ローカル履歴、ワークスペースの信頼・制限モード |

## 裁定（2026-11-12、調査の後）

調査: `tasks/2026-11-12-claude-vscode-research-base/fork-base-research.md`、`tasks/2026-11-12-claude-vscode-research-features/feature-memory-research.md`

| 論点 | 裁定 |
|---|---|
| 同梱する拡張の入手 | Open VSX から取得し、版とハッシュを固定して台帳に記録する。発行元と公式配布物の一致も確かめる。更新は通知 → Claude が検証 → 差し替えの順 |
| Python の言語機能 | basedpyright |
| cmd の言語機能 | 色付けだけ |
| 設定の同期 | Notion に設定ページを作り、そこを同期先にする（本家の Settings Sync は使わない） |
| PDF プレビュー | tomoki1207.pdf（MIT）を同梱する。不具合が出たら差し替えを検討 |
| 更新の通知の対象 | 本体に加え、同梱する拡張（特に Claude Code 拡張）の新版も Notion の ToDo に追加する |
| 外部ツール（ShellCheck、PowerShell 7 など） | エディタには同梱せず、別途インストールを前提にする。入れる手順を設計資料に書く。無ければその言語は色付けだけ |

## 裁定（2026-11-12、荀彧の方針の後）

方針: `tasks/2026-11-12-claude-vscode-approach/proposal.md`（9節の論点への回答）

| 論点 | 裁定 |
|---|---|
| 「削る」の意味 | コードごと消す（荀彧の推奨「見えなくし動かさない。コードは残してよい」を採らなかった） |
| 消す範囲と順序 | 段階的に全部消す。まず組み込み拡張と軽い部分を消して試作・計測し、動くことを確かめながら本体の深い部分（AI・デバッガ・リモート・ノートブックなど）も順に消す。壊れたら戻せるようにする |
| テレメトリ | 送り先と鍵を入れず、送信を担う部品を何もしない実装に差し替える |
| 新版の通知 | 通知だけにする（修正差分の試しの当て直しは添えない） |
| 取り込みの検証の頻度 | 本家の新版ごとに毎週すべて検証する |
| 新しい版への入れ替え | Claude の判定を見て、ユーザーが自分で入れ替える |
| ToDo の書き込みの経路 | エディタのプログラム（更新の検知）は、このチームの外で作る。そのプログラムが自分で Notion にアクセスして ToDo を書く（晴明・`notion-todo` は経由しない） |
| Claude Code 拡張の依存の調べ方 | 公開されている設定情報（manifest）・ファイル一覧と、実機の動作だけで判断する。圧縮されたコードの中身は調べない |
| 実装の担当 | このチームの外（エディタのリポジトリで動く Claude など）。チームは調査と設計資料まで |
| 設計資料の置き場所 | `tasks/2026-11-12-claude-vscode-design/` に作り、エディタのリポジトリを作るときにユーザーが docs/ へ写す |
| エディタの名前・アイコン | 後で決める。設計資料では仮の名前を使う。Microsoft・Visual Studio・Claude の名称とロゴは使わない |
| 配布の形 | zip を版ごとのフォルダに展開し、参照先を切り替える。前の版へすぐ戻せる |
| 固定するテーマ | Light Modern |
| 予備案（VSCodium の zip の後処理で運用） | ソースのビルドが重すぎたときに改めて諮る |

## 裁定（2026-11-12、設計資料の論点への回答）

論点: `tasks/2026-11-12-claude-vscode-design/08-risks-and-open-items.md` 4節

| 論点 | 裁定 |
|---|---|
| 拡張 API の入口（vscode.debug・notebooks・lm・chat など） | 入口は何もしない実装にして残し、中身のコードは消す |
| 裁定に無かった機能 | ターミナルの入力候補（terminal-suggest）は消す。テスト（contrib/testing）とコメント（contrib/comments）は残す。計測で重ければ改めて諮る |
| dotenv の拡張 | Phase 0 で dotenv.dotenv-vscode と weixu.wx-vsce-dotenv を試し、エラー表示を持つほうを採る |
| 拡張の新版を寝かせる期間 | 公開から72時間未満の版は、セキュリティ修正でない限り入れない |
| 検知のプログラムの Notion トークン | DPAPI で暗号化したファイルに置く |
| Notion のインテグレーション | 2つに分ける（設定の同期用は設定ページだけ、更新の検知用は ToDo データベースだけに接続） |
| 取り込みの結果の書き戻し | 書き戻す。ToDo の本文に判定の要約を足し、状態を In progress にする |
| ToDo の優先度・期限 | 06 の表のとおり（セキュリティ修正あり: 高・翌日。ほか: 本体と Claude Code 拡張は中、他の拡張は低・7日後） |
| 版のフォルダの場所 | 設定で変えられるようにする（既定値の扱いは設計で決める） |
| 言語パックが本体より古い点 | 未訳の部分が英語になるのを受け入れる。目立つなら改めて諮る |
| Microsoft 発行の拡張（日本語パック・PowerShell）を Open VSX から使う法的な確認 | 個人利用として、確認せずに使う。リスクはユーザーが受け入れる |

## 裁定（2026-11-13、開発チームの権限のフックの検証の後）

| 論点 | 裁定 |
|---|---|
| 権限に残る小さな穴（pnpm の場所の上書き・`--config.*`、fetch の取得元、tsc の `-p`） | 直さず、既知の限界として受け入れる（[08](08-risks-and-open-items.md) の1節） |
| `node --check` の後ろにオプションを付けられる穴 | 許可を場所まで書く形にして塞ぐ。蒙恬は `scripts/`・`tools/`・`extensions-src/`、曹参は `tests/`・`extensions-src/` |
| フックの実機の確認（e2e）の記録 | Team リポジトリにすべてコミットして残す |

## 裁定（2026-11-13、Phase 0 の着手のとき）

| 論点 | 裁定 |
|---|---|
| Phase 0 の計測用のワークスペース（[07](07-phases.md) の2.1・3節） | `E:\develop\kuebiko`（TS と Python を含む）を `C:\b\p0\ws\` へ clone し、コミットを固定して使う。元の作業ツリーには触れない。計測用のタスク定義はコピーのほうに足す |
| PowerShell 7 と ShellCheck（[01](01-requirements.md) の4.1） | ユーザーが自分で winget で入れる。0-3 で sh の警告と PowerShell 7 のセッションまで確かめる |
| 計測用のワークスペースの置き場所（上の行を改める） | このリポジトリの `tmp\ws\` に clone する（`C:\b\p0\ws\` をやめた）。`tmp/` は `.gitignore` に入れる。蒙恬の書き込み先に `tmp/` を足す権限の変更を承認した（変更は設計を行ったチーム `E:\develop\self\Team` の開発部が行う）。そこで動く Claude Code は親の `CLAUDE.md` も読むが、計測の合否は CLI を含めない合計で見るので受け入れる |

## 裁定（2026-11-13、Phase 0 の台帳の検証の後）

検証: `tasks/2026-11-13-p0-verify-lock-measure/verification-log.md`

| 論点 | 裁定 |
|---|---|
| 「ソースのリポジトリに同じ版のタグかリリースがある」（[04](04-bundled-extensions.md) の4節の3） | 必須にしない。参考の項目とし、タグが無いことを記録して取り込みの判定で触れる。該当する weixu.wx-vsce-dotenv・tomoki1207.pdf・日本語パックも台帳に載せる |
| 署名の検証に使う ovsx の版 | 固定する。`package.json` の devDependencies に ovsx 1.4.0 を置き、その版で検証する。上げるときは手で変える |
| 曹参・大岡越前守の権限の `node --test tests/`（Node 24 では動かない） | 書き方を直す（`node --test tests/*.test.mjs`、extensions-src も同じ形）。変更は設計を行ったチーム（`E:\develop\self\Team`）の開発部が行う |

## 記録（2026-11-13、計測用のワークスペースの clone 元。Phase 0 の着手のときの裁定を補う）

| 論点 | 事実と扱い |
|---|---|
| 計測用のワークスペースの clone 元 | `E:\develop\kuebiko` の .git の所有者が別のアカウントで、ローカルからの clone を git が拒んだ。ユーザーが GitHub（`https://github.com/polites-co-jp/kuebiko.git` の main）から clone した。固定したコミットは `2385a2ff1ea22ceaa5a039500f3f88361eef2392`。開くファイルは TS `apps/api/src/routes/extraction.ts`、Python `local-apps/topic-clusterer/topic_clusterer/labeling.py` |

## 裁定（2026-11-13、basedpyright が Python 拡張なしで起動しない件）

調べ: `tasks/2026-11-13-p0-basedpyright-probe/basedpyright-probe.md`

| 論点 | 裁定 |
|---|---|
| Python の言語機能の起動（basedpyright 1.40.2 は既定の `basedpyright.importStrategy: "fromEnvironment"` では Python 拡張の API を求め、無いと起動しない） | `mydist` の既定に `basedpyright.importStrategy: "useBundled"` を入れる。台帳は今の9件のまま（`ms-python.python` は入れない）。計測では本家と自作の両方のユーザー設定に同じ値を入れて条件をそろえる |

## 裁定（2026-11-13、0-4 の本番の前）

手順: `tasks/2026-11-13-p0-verify-bundled-roles/p0-baseline-plan.md`

| 論点 | 裁定 |
|---|---|
| 節目の計測で Claude Code のパネルに送る「決まった1文」（[07](07-phases.md) の3.2） | 「こんにちは。一言だけ返事をしてください。」。以後の節目もこの文を使う |
| Process Explorer の画面の写し（3.2 の補い） | 数える5回の後に、数えない1回を足して撮る |

## 裁定（2026-11-13、ovsx の依存の install スクリプト）

調べ: `tasks/2026-11-13-p0-lock-final/lock-rerun.md` の1節・2節

| 論点 | 裁定 |
|---|---|
| `@vscode/vsce-sign` 2.1.0（ovsx 1.4.0 が `@vscode/vsce` を通して連れてくる）の install スクリプトを、pnpm に走らせるか | 走らせない。`pnpm-workspace.yaml` の `allowBuilds` に `'@vscode/vsce-sign': false` と書く。ovsx 1.4.0 の `verify-signature` はこの道具を使わず、Node.js の `crypto` で検証する（走らせない状態で9件とも検証を通った） |
| 道具の依存の固定の仕方（「ovsx の版の固定」を補う。リーダーの判断） | 入れる道具は pnpm。`package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml` をコミットし、ovsx とその依存の版を固定する |

## 裁定（2026-11-13、計測と通信の監査をやめる。スコープの変更）

ユーザーの指示: 「計測は不要です。単純に機能を削除して、減れば良し、減らなかったら高機能の本家エディタを使うだけなので、実験をするより実装（機能削減）をしてください」。続けて問うた3点の答えを含む。

| 論点 | 裁定 |
|---|---|
| メモリ・CPU の計測（Phase 0 の 0-4、Phase 1 の5回、Phase 2 の単位ごとと節目、Phase 5 の節目、毎週の取り込みの計測） | すべてやめる。減ったかどうかはユーザーが使って判断する。減らなければ本家を使う。上の「省メモリの目標」の「本家より少しでも減れば合格」を、数値の関門としては使わない（目的は省メモリのまま）。`scripts/measure.ps1` とテストは残すが使わない |
| 外向き通信の監査（Phase 0 の 0-5、Phase 2 の監査、関門の `absentHosts`、毎週の取り込みの監査） | ~~やめる~~ → 同日に取り消した（下の「通信の扱いの訂正」）。監査は残す |
| 動作の確認 | 要る。やめるのはメモリや CPU の使用率などの検証だけ。機能を消すたびの関門（当たる・型検査とビルド・消えている・壊れていない＝スモーク）は残す |
| Phase 0 の残り（画面での確かめ 0-2・0-3・0-7・0-8・0-9） | 「実験より実装」の指示に従い、Phase 0 の確かめはここで打ち切る。同じ点（AI を止めても Claude Code が動くか、組み込み拡張を消しても壊れないか、言語パック、`extensions.allowed`、`mydist` の既定）は、ビルドした試作の動作の確認で見る（リーダーの解釈。違えばユーザーが直す） |

## 裁定（2026-11-13、通信の扱いの訂正）

ユーザーの指示: 「通信の監査もやめます」は意図の伝え違いだった。「不必要な通信はすべてカットするという意味で不要と言いました。必要な通信は、Claude や git リポジトリへの通信、不要な通信はデータ収集や update のチェックです」。

| 論点 | 裁定 |
|---|---|
| 外向き通信の方針 | 不要な通信はすべて止める。要る通信は Claude（Claude Code の拡張と CLI が使う宛先）と git のリモート（GitHub など）。要らない通信は、データ収集（テレメトリ・クラッシュの報告・実験の設定）と更新の確認など。ほかに、すでに裁定で決めた機能が使う宛先（設定の同期と更新の検知の `api.notion.com`。[05](05-settings-sync.md)・[06](06-update-watch-and-take-in.md)）は要る通信として扱う（リーダーの解釈） |
| 外向き通信の監査 | 残す（上の「計測と通信の監査をやめる」の監査の行を取り消す）。不要な通信が止まったことを確かめるために使う。Phase 0 の 0-5（本家の棚卸し）は、止める宛先を洗い出すために行う。関門の `absentHosts`、Phase 2 の監査、毎週の取り込みの監査も元に戻す。メモリ・CPU の計測をやめたことは変わらない |

## 裁定（2026-11-13、0-5 の棚卸しの後）

棚卸し: `records/phase0/network-inventory.md`

| 論点 | 裁定 |
|---|---|
| Claude Code の CLI 自身が送る付帯の通信（テレメトリ、エラーの報告、自動更新の確認など） | 止める。CLI の本来の通信（Claude との対話）は残す。このエディタから起動する CLI にだけ、環境変数 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を渡す（`mydist` の既定に書く）。普段のターミナルの `claude` には効かせない。CLI の自動更新が止まるので、CLI の版は台帳の Claude Code 拡張の更新で上がる |
| Claude の宛先を観測して許可の一覧を確定させる監査（パネルから1文を送る手の操作が要る） | 自作のビルドができてから行う。Phase 2 の終わりの動作の確認（手の項目でパネルから送信する）と同じ回に行う。CLI の宛先に名前を付けるための DNS の記録（管理者の権限）を有効にするかは、そのときに諮る。それまで許可の一覧の Claude の行は裁定から書いた仮のもの |

## 記録（2026-11-13、.env の拡張を決めた。裁定の当てはめ）

| 論点 | 扱い |
|---|---|
| .env の拡張（裁定「エラー表示を持つほうを1つ載せる。両方持つか両方持たないときは諮る」） | `weixu.wx-vsce-dotenv` 0.2.3 に決めた。誤りを含む .env で、`weixu.wx-vsce-dotenv` は診断4件、`dotenv.dotenv-vscode` 1.5.8 は0件で、片方だけが持っていたので諮らずに当てはめた。`dotenv.dotenv-vscode` は台帳から外す。事実: `tasks/2026-11-13-p1-smoke/handoff-notes.md` の「合図後の実行の結果」6節 |

## 記録（2026-11-13、CLI の付帯の通信の裁定の当てはめ。リーダーの判断）

| 論点 | 扱い |
|---|---|
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` で止まらない CLI の通信 | 公式のプラグインのマーケットプレイスの自動登録は「付帯の通信」に当たるので、`CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` も渡して止める。WebFetch の宛先の安全確認（`api.anthropic.com`）は Claude の作業に伴う安全のための確認なので止めない。根拠: `tasks/2026-11-13-p1-ledger-mydist-decisions/handoff-notes.md` の「未解決の点」3 |

## 記録（2026-11-14、Phase 2 の段階 A の作業で出た点。リーダーの判断）

| 論点 | 扱い |
|---|---|
| ターミナルの入力候補の本体の部品（`contrib/terminalContrib/suggest`）が、拡張 `terminal-suggest` を消しても残る | 裁定「ターミナルの入力候補は消す」「コードごと消す」の範囲なので、新しい単位 B-7-terminal-suggest で本体の部品も消す。有効になるまでは `mydist` の既定で切る |
| A-3 の `builtInExtensions: []` | `product.overlay.json` の `set` に置く（キーを消すと gulpfile が止まるため） |
| A-1 の後処理（`build/lib/copilot.ts`）の止め方 | 拡張のフォルダが無ければ戻る3行を足す形（触るのは1か所）を採る |

## 記録（2026-11-14、Phase 2 の段階 B の作業で出た点。リーダーの判断）

根拠: `tasks/2026-11-13-p2-units-b/handoff-notes.md`、`units-b-notes.md`、`doc-corrections.md`

| 論点 | 扱い |
|---|---|
| B-2 の `contrib/onboarding` | 残す。残る部品が使っているため（docs/03 の表との違い） |
| B-6 の `contrib/emergencyAlert` | 消す（表に無かった部品。不要な通信を止める裁定に当たる） |
| WPAD（プロキシの自動探索の `wpad` の名前の問い合わせ） | 小さなパッチ（`windowImpl.ts`）で止める |
| アイコンの PNG・ICO | Node.js 標準の zlib で書き出す台本を作り、自作の意匠で作る |
| `terminalContrib/telemetry` | B-1 に足して消す（テレメトリは裁定で消す） |
| `services/suggest` | ターミナルの入力候補だけが使うなら B-7 で消す。ほかの残る機能が使うなら残す |

## 記録（2026-11-14、段階 C の下準備で出た点。リーダーの判断）

根拠: `tasks/2026-11-14-p5-units-c-prep/handoff-notes-c1-c2.md`・`handoff-notes-c3-c7.md`、`tasks/2026-11-14-p5-verify-c-prep/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| C-1 の範囲 | 表の部品に加え、エージェントの窓（`src/vs/sessions`）、AI の検索（`contrib/search/browser/AISearch`）を消す（裁定「本家の AI は消す」）。`services/chat` は残る部品が注入するので、何もしない実装で残す |
| C-1 で消すか迷った部品（`contrib/speech`、`agentsColors`・`agentsSizes`、`platform/artifactIntegrations`、`contrib/imageCarousel`、`platform/otel`、`@modelcontextprotocol/sdk`） | 消す AI の部品だけが使うものは消す。残る部品が使うものは使い手を書いて残す。`platform/otel` はテレメトリなので、使い手が残らなければ消す |
| `extHost.protocol.ts` | 消した API の Shape と ID を消す |
| 段階 C の単位の順 | C-3〜C-7 は C-1 を前提にする。C-2 は C-1 を前提にしない |
| 段階 C で表から変えて残す部品 | C-2 の `contrib/debug/common` と `extensionHostDebugService`、C-3 の `services/tunnel` など、C-4 の `contrib/notebook/common` と `services/notebook`、C-5 のギャラリーの manifest のワークベンチ側（docs/03 の4節の末尾） |

## 記録（2026-11-14、ビルドの環境。未決）

| 論点 | 扱い |
|---|---|
| ビルドの道具の入れ方 | ユーザーの指示: 「コンテナ環境作って、そこにフルセット用意して、そこでビルドしてほしい」。PC に直接入れる docs/02 の5節の形から変える方向。コンテナの種類（Windows コンテナか、Linux で Windows 版を作れるか）、定義の置き場所、作業場所は未決（ユーザーが Linux でのビルドを確かめ中。蒙恬が事実を調べる: `tasks/2026-11-14-build-env-research/`） |

## 裁定（2026-11-14、ビルドの環境。上の「未決」を閉じる）

調べ: `tasks/2026-11-14-build-env-research/build-env-options.md`（Linux では Windows 版を作れない。Windows コンテナは作れる見込み）

| 論点 | 裁定 |
|---|---|
| ビルドの道具の入れ方 | コンテナはやめ、この Windows（PC）にユーザーが直接入れる。docs/02 の5節のとおり。ビルドもこの Windows で行う。コンテナの置き場所の論点は無くなった |

## 裁定（2026-11-14、Phase 1 のビルドの関門）

根拠: `tasks/2026-11-13-p1-build-upstream/handoff-notes.md`（2026-11-14 の再開）

| 論点 | 裁定 |
|---|---|
| 本家 1.146.0 の手元のビルドの不具合（`build/.moduleignore` が `@github/copilot` を外すのに、`build/lib/copilot.ts` がその下の `sdk` を求めて `prepareCopilotRipgrepShimTask` で止まる。本家は PR #347312 で直し、1.147.0 に入る） | Phase 1 の関門を A-1 の単位（copilot の拡張を消し、`copilot.ts` に「拡張のフォルダが無ければ戻る」行を足す）と合わせて満たす。厳密な「無改造」のビルドの確かめは、1.146.0 では行わない |
| Smart App Control（オン）が、自分でビルドした署名の無いネイティブのモジュール（`winregistry.node`）の読み込みを止め、エディタが起動しない | ユーザーの答え: 「止められても継続して、リスクを確認して実行ができるはず」。成り立つかを蒙恬が出典で調べる（`tasks/2026-11-14-sac-override-research/`）。結果を添えて改めて諮る（未決） |

## 裁定（2026-11-14、Smart App Control。上の「未決」を閉じる）

調べ: `tasks/2026-11-14-sac-override-research/sac-override.md`（Smart App Control には、止めたものを確認して実行する道も、アプリごとの例外も無い。今の Windows 11 はオフの後にまたオンにできる）

| 論点 | 裁定 |
|---|---|
| Smart App Control（オン）が自分でビルドした `.node` を止める | オフにする。ユーザーが Windows セキュリティの画面で操作する。ウイルス対策（ESET）は残る。後でオンに戻すときは、先に `winver` で 26300.9818 以上かを確かめる（KB5127648 の不具合） |
| 実施 | 2026-11-14 にユーザーがオフにした。`VerifiedAndReputablePolicyState` が 0（オフ）であることをリーダーが読んで確かめた |

## 記録（2026-11-14、Phase 2 の関門で出た点。リーダーの判断）

根拠: `tasks/2026-11-14-p2-gates/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| 関門の3「消えている」が台本の網の不備（probe が登録の無い設定も「在る」と返す、公式でも登録されないコマンドを checks に挙げている）で判定できない版 | 「代わりの証拠」（拡張の一覧・出力の文字列）では合格にしない。probe と checks を直し、関門の3を流し直して判定する |
| A-5 でポートのビューのコマンドが消えた（README の intent は「残す」） | 受け入れる。リモートは裁定で消す（C-3）ので、ポートのビューも要らない。README を直す |
| B-4 の後、残したパンくずリストが消えた設定 `outline.icons` を読む | 受け入れる。パンくずリストは既定で無効で、C-7 で消す。README に書く |
| notion-sync が日本語の表示で `No bundle location found` を出す | 直す（組み込みの拡張の翻訳の扱い） |
| A-1 の関門の3を manifest の網（出力の組み込み拡張の `package.json` の `contributes`）だけで判定すること | 認める。直した検査の台本の網そのもので、「代わりの証拠」（拡張の一覧・出力の文字列を人が照らす）とは別とする。copilot の拡張は公式でも実行時の網に出ない |
| B-1 の `absentCommands` を空にすること（`workbench.action.showTelemetry` は `--disable-telemetry` のもとで公式でも登録されず、替えも無い） | 認める。網は absentSettings・absentStrings・absentHosts で足りる |

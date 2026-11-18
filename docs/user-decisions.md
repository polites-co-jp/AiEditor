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
| 消した部品が持っていた ID を「何もしない実装」で残したことを確かめる形（checks に「在る」の項目）を足すか | 今は足さない。スモークの errors.new（呼ばれても誤りが出ない）と、出力の束の登録の文字列で確かめる。`_` で始まる内部のコマンドは probe の一覧に出ないので、項目を足しても網にならない |
| 版の関門で、スモークの基準を1回で作って揺れる誤り（Claude Code の `Remote Control auto-enable failed`）を新しい誤りと見た件 | docs/06 の5節のとおり、基準は3回の和で作る。前の版の基準もこの形にそろえる |

## 裁定（2026-11-15、古い版の片づけ）

| 論点 | 裁定 |
|---|---|
| 関門が済んだ古い版（`C:\b\p2\`・`C:\b\dist\`・`C:\b\smoke\ext\`）の片づけ。C: の空きが約 21 GB | 蒙恬に消す許可を足して任せる（ユーザーの答え「許可を足して任せる」）。権限の変更は Team の開発部が行う。依頼は `tasks/2026-11-15-permission-requests/requests.md`。許可が入るまで段階 C は始めない |
| 片づけの許可を待つ間の段階 C | 下ごしらえを始める（ユーザーの答え、2026-11-15）。使い終わった作業ツリー `C:\b\wt\p2` を使い回し、C-1 から1単位ずつ、型検査の誤りを手がかりに edits.patch を作る。ビルド・起動の確かめ・関門は、片づけの許可が入ってから |

## 記録（2026-11-15、C-1 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c1-patch/handoff-notes.md`。どれも 2026-11-14 の規則（消す AI の部品だけが使うものは消す、残る部品が使うものは使い手を書いて残す）の当てはめで、裁定を変えるものではない。

| 論点 | 扱い |
|---|---|
| MCP の認証の3つのサービス（`services/authentication/browser/authenticationMcp{,Access,Usage}Service.ts`）。docs/03 の表は消すと書く | 残す（`kept`）。残る認証の照会 `authenticationQueryService.ts` が注入し、保存だけで通信しない。docs/03 の表を直す |
| AI の検索の分岐（`searchView.ts`・`searchModel.ts`） | 分岐は残し、隠れた空の見出しを置く形を認める。`contrib/search/browser/AISearch/` と登録の入口は消える。パッチを小さくして毎週の衝突を減らす |
| ターミナルの案内 `terminalContrib/inlineHint`（設定 `terminal.integrated.initialHint`） | 消す。チャットのエージェントにだけ使う AI の部品 |
| `chat.tools.terminal.*` とサンドボックスのファイルシステムの設定の登録が消え、読む側では `undefined` になる | 認める。関門の設定の画面とターミナルの組で、誤りが出ないかを見る |
| `build/gulpfile.vscode.ts` の Copilot の梱包・`agentHostCrypto` の入口・Agents の窓へのリンクが残っている | パッケージ化の前に C-1 の edits.patch へ足す（関門の前に蒙恬が直す） |
| ロックファイルの検査が、単位が `pnpm-workspace.yaml` の `patchedDependencies` の行を消したときに、ロックファイルの同じ名前の節が減るのを「変わった」と見て止める | 検査の台本（`scripts/lib/apply/lockfile.mjs` の `compareLockfile`）を直し、単位が消したパッチの名前の分だけ節が減るのを許す。ほかの節の変化は今までどおり止める。docs/03 の5.4 を直す |
| C-1 で消した AI の部品だけが使っていた依存（ルートの10、`remote` の5。`@hpke/core`・`libsodium-wrappers`・`@devcontainers/cli`・dev-tunnels・`ssh2`・`ws` など） | 外す（2026-11-14 の規則の当てはめ）。`remote` のロックファイルの差分は、片づけの後のビルドの依存の導入で見る。docs/03 の表を直す |
| `chat.disableAIFeatures` の登録が消え、残る読み手が「AI 有効」と読む | 読み手ごとに直す形を採る（ジャンプリストの「Agents Window」、新しい利用者のセカンダリサイドバー）。隠した登録を残す別案は、`checks.absentSettings` と食い違うので採らない。関門のスモークで見る |
| 「バージョン情報」の Copilot の2行（`@github/copilot: Unknown` など） | 消す（`platform/dialogs/electron-browser/dialog.ts` を edits.patch に足す） |

## 記録（2026-11-15、C-2 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c2-patch/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| `platform/telemetry/node/customEndpointTelemetryService.ts`（呼び手は消した `debugSession.ts` だけ） | 今は残す（`kept`）。呼ばれないので通信は起きない。消すと C-1 も直す `sharedProcessMain.ts` と main のファイルに触れる。テレメトリの部品なので、段階 C の後に B-1 で消すかを見直す |
| ノートブックのインラインの値（設定 `notebook.inlineValues`）と `notebook.variablesView` | 消す。部品は前から C-2 の `delete` に入っていた `notebookVariables` の中にあり、ノートブックも C-4 で消す |
| `vscode.debug.activeDebugConsole` | `undefined` でなく何もしないコンソールにする（型が undefined を許さず、拡張がそのまま呼ぶと誤りになる） |
| C-1 のパッチと隣り合う行（`extHost.protocol.ts`・`repl.contribution.ts` の import の3行） | main のファイルでなくても `removeLines` に回す。docs/03 の5.3 に書いた |
| C-2 が `workbench.common.main.ts` に1行を足す（2026-11-14 の案A） | docs/03 の5.3 に例外として書いた |

## 記録（2026-11-15、C-3 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c3-patch/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| `productRemove`（server・tunnel のキー）で build/ の台本（`gulpfile.vscode.ts` など）に型だけの誤りが6件出る | 直さない。手元のパッケージ化は実行時に止まらず、関門の型検査（`typecheck-client`）の外。A-3 の前からの1件と同じ扱い。パッケージ化で止まったら直す |
| `gulpfile.vscode.ts` の `esbuild-vscode-reh-min`・`esbuild-vscode-reh-web-min` の定義 | 残す。呼ぶ所が無くなるだけで、消すと C-1 が直すファイルに触れる |
| docs/03 の表の C-3 の行が、残すと決めた `services/tunnel` などを消す側に挙げていた | 表を直した |

## 記録（2026-11-15、C-2 のテストで出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c2-tests/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| C-1 と C-2 の `delete` が `debugChatIntegration.ts` で重なり、両方を当てると C-2 の側が「本家に無い」の警告を出す | 重なりを残す。C-2 は C-1 なしでも当たらなければならず（`after` は A-3 だけ）、そのとき `debugChatIntegration.ts` は消したデバッガの部品を読むので、C-2 の `delete` に要る。照らし役はこの1件の警告だけを許す |
| C-2 の `checks.absentStrings` の2つ（`debug/browser/debugService.js'`・`debug/browser/linkDetector.js'`）が本家に無い文字列で、消し損ねても当たらない | 本家にある形に替える（蒙恬） |

## 記録（2026-11-15、C-4 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c4-patch/handoff-notes.md`。どれも 2026-11-14 の規則の当てはめ。

| 論点 | 扱い |
|---|---|
| 検索の入力欄のノートブックの絞り込み（`searchWidget.getNotebookFilters()`） | 既定値の定数で残す（検索のビューと検索エディタは読むだけ。パッチが小さく、毎週の衝突が減る） |
| 設定 `search.experimental.closedNotebookRichContentResults` | 消す（読み手は消したノートブックの検索だけ） |
| `mainThreadNotebookDto.ts`・`contrib/search/common/notebookSearch.ts`・`cellSearchModel.ts` | `kept` から `delete` へ移す（使い手が無くなった） |
| `extHost.protocol.ts` のノートブックの DTO | 残す（一部は残る変換が使い、使われないものの切り分けは型検査に掛からない） |
| セルの編集を含む `workspace.applyEdit` | reject で失敗させる（黙って捨てて成功に見せない） |
| `.ipynb` の全文検索 | ripgrep がテキスト（JSON）として探す形になる。関門の検索の組で見る |

## 記録（2026-11-15、C-5 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c5-patch/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| 画面からの VSIX の導入（エクスプローラーの右クリック・拡張のビューへのドロップ）を残した | 採らない。docs/01 の「拡張のインストール（CLI のみ）」「画面からの検索・追加は消す」に従い、右クリックのメニューとドロップを外す。内部のコマンド `installFromVSIX` は残す（README の前からの決まり） |
| `ext install ` の Quick Access | 消す（画面からの検索に当たる） |
| `CONTEXT_HAS_GALLERY` の条件つきの画面 | 残す（条件が常に偽で出ない。消すとハンクが増える） |
| 設定 `extensions.gallery.serviceUrl`・`extensions.gallery.authProvider` の登録 | 残す（`policyData.jsonc` のポリシーの一覧と食い違わないため） |
| `.vscode/extensions.json` の JSON の検査（`extensionsFileTemplate.ts`） | 残す（編集の手伝いだけで通信しない） |
| マーケットプレイスの状態のバッジ | 消す（状態を作るのは消したアカウントだけ） |
| 何もしないギャラリーの `getExtensions` など | 誤りを投げず空を返す |

## 裁定（2026-11-15、続きの編集）

| 論点 | 裁定 |
|---|---|
| 「続きの編集」（`contrib/editSessions`。作業中の変更をクラウドに預けて別の窓で続きを開く）。設定の同期（C-6）と同じ仕組みで、これまでの裁定に挙がっていない | 今は残す（ユーザーの答え「今は残す（推奨）」）。C-6 に入れず、単位も足さない。預け先の設定が無いので動かず通信もしない見込み。通信の監査で外への通信が見つかったら、改めて諮る |

## 記録（2026-11-15、C-6 の edits.patch と、C-4 のテストの直しで出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c6-patch/handoff-notes.md`、`tasks/2026-11-15-p5-c4-tests/handoff-notes.md` の「2回目」

| 論点 | 扱い |
|---|---|
| C-6: 条件が常に偽で出ない同期の画面（設定の木の「同期しない」、拡張の画面のメニュー3つ、設定の目次の「Settings Sync」） | 残す（C-5 の `CONTEXT_HAS_GALLERY` と同じ扱い。消すと C-1・C-5 が直すファイルと重なる） |
| C-6: `checks.absentCommands`・`absentViews` の下準備の項目が、このビルドでは C-6 の前から登録されていない（網にならない） | C-6 の前に条件なしに登録されていた2つのコマンドに替え、`absentViews` を空にする（2026-11-14 の判断の当てはめ） |
| C-6: `update.ts` の `accessor.get(IUserDataSyncWorkbenchService)` | 直さない（デスクトップでは操作が登録されない） |
| C-1: 何もしない実装の `lm.registerToolDefinition` に、提案中の API の門（`languageModelToolSupportsModel`）が無い。C-4 の門の抜けを受けて、テストの期待を本家から読む形にして見つかった | 直す（蒙恬）。C-1 は 0a76c75 でコミット済みで `enabled` は `false` なので、日常の版には響かない。直した後に大岡越前守が確かめ直す |
| 門の検査の期待を実装から写していた（C-1・C-2・C-4） | 本家の消すファイルから読む形にそろえる（曹参が直した） |

## 記録（2026-11-15、C-7 の edits.patch を作るときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c7-patch/handoff-notes.md`

| 論点 | 扱い |
|---|---|
| `IEditorPartOptions.showBreadcrumbs`（読み手は消した `breadcrumbsControl.ts` だけ） | 消す（2026-11-14 の規則の当てはめ） |
| `EditorHeaderControl.handleEditorsChange` と呼ぶ側 | 消す（何もしない入口を枠に残さない） |
| 1枚のタブの説明の出し方（`breadcrumbsInHeader` の分岐） | 採った案のまま（ヘッダーを使うのは C-1 が消す窓だけで、このビルドの画面は変わらない見込み。関門で見る） |
| テストの設定値と見本の説明の文の「breadcrumb」 | 残す（動きに関わらない。ハンクを増やさない） |
| C-7 を今の案で関門へ進めるか、別案（設定で隠して止める）を先に諮るか | 今の案で進める。docs/07 の8節のとおり、関門を2回続けて通らなければユーザーに諮る。枠のファイルの衝突の手間は Phase 3 と同じ形で測る |

## 記録（2026-11-15、C-1 の6回目のテストで出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-c1-tests/handoff-notes.md` の「5回目」

| 論点 | 扱い |
|---|---|
| C-1 の何もしない実装で、門の誤りの出方が本家と違うとテストが見た（`lm.fileIsIgnored`、`lm.getModelProxy`） | 本家と同じ出方にそろえる（門は本家と同じにする決まりの当てはめ）。読み直した結果（蒙恬の7回目、曹参の6回目、大岡越前守の照らし）: `fileIsIgnored` は本家が同期で投げるので実装を直した。`getModelProxy` は本家の外側の口（`extHost.api.impl.ts`）が同期で門を呼ぶので実装は本家と同じで、テストの期待（内側の async だけを見ていた）を直した |

## 裁定（2026-11-15、段階 C の関門の段取り）

| 論点 | 裁定 |
|---|---|
| 段階 C の関門の進め方（docs/07 の8節は「1単位ずつ関門を通し、1週間日常で使ってから次へ」） | まとめて1つの版で行う（ユーザーの答え「まとめて1つの版で（推奨）」）。C-1〜C-7 を全部有効にした版を1つビルドし、関門（docs/03 の7節）をまとめて通す。落ちた単位があれば、その単位だけ無効にして作り直す。1週間ずつの日常の利用は省き、入れ替えの後に普段使いで様子を見る |
| 古い版の片づけの許可を待たずにビルドを始めるか（C: の空きは約 18.8 GB） | 片づけの許可を待つ（ユーザーの答え）。Team の開発部が許可を足し、蒙恬が古い版を片づけてからビルドを始める |

## 裁定（2026-11-15、C: に置かない）

| 論点 | 裁定 |
|---|---|
| 一時的なファイルとビルドのためのファイルの置き場所（今は `buildRoot` の既定 `C:\b\`） | C: に置かない。できるなら、このプロジェクトのフォルダの下（`tmp/` など。`.gitignore` 済み）に置く（ユーザーの指示「C ドライブが圧迫されて困っています」）。パスの長さなどで無理なら、その理由と代わりの場所をユーザーに示す |
| C: に前から作ったもの（`C:\b\` の clone・作業ツリー・版・zip・キャッシュ・ログ・スモークのデータなど） | 新しい置き場所へ移すか、消す（同じ指示）。普段使いのエディタのデータは対象外 |
| 段階 C をまとめた版のビルド | 置き場所を移してから行う。C: では始めない |

## 記録（2026-11-15、C: から移す直しの範囲。リーダーの判断）

根拠: `tasks/2026-11-15-move-off-c/handoff-notes-cao-shen.md`

| 論点 | 扱い |
|---|---|
| `C:\b` を決め打ちで持つ道具のうち、今も使うもの（`measure.ps1`・`netaudit.ps1`・`p1-launch-check.ps1`・`check-env.ps1`・`lib/local-config.ps1`・`convert-sublime-keys.mjs`） | 直す（`buildRoot` か `tmp/` の下へ）。`measure.ps1`・`netaudit.ps1` は曹参、ほかは蒙恬（課の台帳の書き込みの分け方） |
| Phase 0 だけの道具（`scripts/p0-*.ps1`・`p0-*.mjs`・`lib/p0-common.ps1`） | 直さない。今は走らせない（Phase 0 は閉じた）。静的な検査の例外に、理由つきで入れる。走らせることになったら、その前に直す |
| 関門の手順書（`tests/removals/c*-gate-script.md`）の `C:\b` | 移した後の実体に合わせて、関門の前に書き直す |

## 裁定（2026-11-15、ビルドの置き場所と Phase 0 の残り）

根拠: `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md`

| 論点 | 裁定 |
|---|---|
| ビルドと一時のファイルの置き場所（`<リポジトリ>\tmp\b` か `E:\b`） | プロジェクトの `tmp\b`（ユーザーの答え）。`LongPathsEnabled` が無効なので、260 文字を超える所（スモークと「消えている」の検査の実行のフォルダの名前）を短くする。エージェントが探すときに `tmp/` の大きな木を拾わない手当てをする（探す範囲を絞る決まり、エディタの監視から外す） |
| `C:\b\p0`（Phase 0 の試しの残り、12 GB）と Phase 0 だけの道具（`scripts/p0-*`） | データを消し、道具は引退（ユーザーの答え「データを消し、道具は引退（推奨）」）。消す前に、記録に要るものが無いかを確かめる。道具には「引退。走らせない」と書き、走らせることになったら先に直す |

## 記録（2026-11-16、tmp\b へ移す段取りで出た点。リーダーの判断）

根拠: `tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md` の「2回目」

| 論点 | 扱い |
|---|---|
| `tmp\b` はリポジトリの中なので、判定役（狄仁傑。`read_paths` が `./`）が秘密の載りうるネットのログを読める。`secret_paths` に足すと、フックの作りで4人ともリポジトリの直下で Glob・Grep が使えなくなる | 案2を採る: `netaudit.ps1` が宛先（ホスト名と回数）を読み取った後、ネットのログをすぐ消す（docs/07 の3節の「記録にはホスト名と回数だけを写す」と同じ向き）。フックは変えない。ネットのログの置き場所は `<buildRoot>\netlog` |
| `C:\b\p0` のうち、まだ要るもの | 公式の 1.146.0（展開したものと zip）は `<buildRoot>\official\` に写す（スモーク・「消えている」の検査・取り込みが比べる相手）。records が根拠に挙げる小さなファイル（1 MB 未満）は `records/phase0/evidence/` に写す（大岡越前守。`records/` の書き手）。残り（約 11.4 GB。`data`・`testbed`・`vscodium`・`vsix` の本体・`netlog`）は消す |
| 取り込みの通信の監査の作業場所 | `<buildRoot>\audit`（パスの長さのため。前は `<buildRoot>\take-in\<label>\netaudit-run`） |
| `p0-check-ps.ps1`（PowerShell の台本の構文と ASCII の検査。`C:\b` を使わない） | 引退の注記のまま、検査として使い続けてよい |
| 写す方法 | `cp -a` でなく、写すだけの台本 `scripts/move-build-root.mjs`（消さない・上書きしない・数と大きさと SHA-256 を照らす） |
| `C:\b\p0` の basedpyright・bash-ide-vscode の `files.json`（大きく、今の許可では records へ写せない） | 写さずに消す。要点（ファイル数・フォルダごとの数と大きさ・実行ファイル・LICENSE の有無）は写した `verify-result.json` に残り、一覧は台帳の VSIX（SHA-256 は台帳にある）を Open VSX から取り直せば作り直せる。写した22ファイルの一覧は `records/phase0/evidence/README.md` |

## 記録（2026-11-16、移す直しの残りで出た点。リーダーの判断）

根拠: `tasks/2026-11-16-move-off-c-fixes/handoff-notes-meng-tian.md`

| 論点 | 扱い |
|---|---|
| 取り込みの監査の作業場所の名前が長いラベルで 259 文字を超える | 止めずに縮める（スモークと同じ `shortLabel` の決まり。10 文字まで）。縮めても超えるときは、手順 7 を含む実行を手順 1 の前に止める |
| 写す途中で止まり、写し先に途中まで書いたファイルが残ったとき（台本はそれを problem として止まる。台本は消さない） | その項目の写し先を `rm -rf` で消して写し直す。そのための一時の削除の許可（`tmp/b/` の写し先）を権限の依頼に足した（`tasks/2026-11-15-move-off-c/permission-requests.md`）。元の `C:\b` は照らしが済むまで消さない |

## 記録（2026-11-16、段階 C の版を tmp\b でビルドしたときに出た点。リーダーの判断）

根拠: `tasks/2026-11-15-p5-stagec-gate/handoff-notes-meng-tian.md` の「2回目」

| 論点 | 扱い |
|---|---|
| 権限の変更（`C:/b` → `tmp/b`）を待たずにビルドするか | 待たない。今の許可で走る台本（`move-build-root.mjs`・`build.mjs`）だけで、要るものを `tmp\b` に写し、本家の clone は `prepare` が `tmp\b\vscode` に新しく作る。`C:\b` は消さない・書かない（2026-11-16。21単位の版のビルドは ok、`C:\b` の大きさと数はビルドの間ずっと同じだった） |
| 新しい clone に、古い clone の版ごとの枝 `builds/<label>` が無い | `C:\b` を消す前に、`git fetch C:/b/vscode` で新しい clone へ取り込む（権限の依頼に足した）。作業ツリーごと clone を写す段は要らなくなる |
| `check-env.ps1` が本物の環境で `pnpm --version`・`npm --version` を起こし、C: のキャッシュに小さく書く恐れ | 直す（子の環境を `<buildRoot>` の下へ向ける）。急がないので、関門の後にまとめる |
| C-1 と C-2 の `delete` の `debugChatIntegration.ts` の重なりの警告 | 前の判断（2026-11-15「C-2 のテストで出た点」）のまま残す |
| `%LOCALAPPDATA%\pnpm\package-manager-store`（0.58 GB、2026-11-16 02:14）が C: にできた | このビルドの台本は pnpm を起こしていない時刻で、別の作業の見込み（推定）。ユーザーに知らせる |

## 記録（2026-11-16、段階 C の版の関門で出た点。リーダーの判断）

根拠: `records/take-in/1.146.0-p5-c-all/gate-p5-c-all.md`・`gate-C-1-ai.md`

| 論点 | 扱い |
|---|---|
| 21単位の版でワークベンチが立ち上がらない。C-1 の `productRemove` が product.json から `defaultChatAgent`・`builtInExtensionsEnabledWithAutoUpdates` を外し、残る本家のコード（8か所。`defaultAccount.ts`・`extensionsScannerService.ts` など）が `?.` なしで読む（型では省略できないキーなので型検査に掛からない） | 裁定「product.json の AI のキーは消す」のまま、読む側を直す（C-1 の edits.patch に、キーが無いときに空として扱う直しを足す）。キーを空の値で残す案は採らない |
| 作業ツリーへ直接打つ git の許可が `C:/b` 前提で、`tmp/b` に当たらない | edits.patch（`removals/` の中の本文）を直し、当て直しと型検査は `build.mjs` の手順に任せる。C: の古い作業ツリーは使わない |
| C-7 の「関門を2回続けて通らなければ諮る」の数え方 | 今回は数えない（C-1 の誤りで、C-7 を確かめる所まで行っていない） |
| スモークの `extractChromiumErrors` が `INFO:CONSOLE` で出るコンソールの誤りを拾わず、今回の TypeError で `errors.new` が PASS になった。`p1-launch-check.ps1` はワークベンチが立ち上がったかを見ない | 直す（スモークは曹参、起動の確かめは蒙恬）。照らし役 c2〜c5-check-json の21単位の組、c1-unit の「`productRemove` のキーを残る src が `?.` なしで読まない」検査も足す（曹参） |
| C-1 の直しの後、曹参の c1-unit の新しい検査が2件落ちる（読み手の行そのものでなく前の行の早い `return` や `undefined` を受ける関数で守った所、`!x \|\| …` の形） | 案A: 検査の側を変える。`!x \|\|` の形を安全と数え、「本家の型を省略できる型にし、型検査が通る」ことでも見る（型検査が網になる）。コードは今の形のまま |
| C-1 の edits.patch に手で足した8区画に `index` の行（blob の SHA-1）が無く、本家が同じ所を変えた週は3方向の当て方ができない | `tmp/b` の作業ツリーで git を打てる許可（依頼中）が入ったら、`format-patch` で作り直して `index` の行を入れる。それまでは今の形（当たることは確かめた） |
| docs/03 の `productRemove` の説明 | 「残る読み手を直し、省略できない型は省略できる型にして型検査で見張る」を足した |

## 記録（2026-11-16、段階 C の版 r2 の関門で出た点。リーダーの判断）

根拠: `records/take-in/1.146.0-p5-c-all-r2/gate-p5-c-all-r2.md`・`gate-C-1-ai.md`

| 論点 | 扱い |
|---|---|
| r2 の判定 | C-2〜C-7 は自動の関門 1〜4 を通った（画面を見る手の項目は残る）。C-1 は4「壊れていない」で不合格（3種の誤り） |
| C-1: `depends on UNKNOWN service terminalChatService`（ターミナルのタブのビューが作れない） | 何もしない `ITerminalChatService` を登録するか、注入を外す（蒙恬が小さい方を選ぶ。`services/chat` と同じ形が第一） |
| C-1: 全文検索の欄で `semanticSearchBehavior` を読んで落ちる（`searchView.ts`。C-1 が `search.searchView.*` の設定を消した） | 読む所を `?.` で守り、設定の型を省略できる形にする（docs/03 の `productRemove` の決まりと同じ考え方を設定にも当てる） |
| C-1: git の拡張が `_chat.editSessions.accept` を呼んで `command not found` | 何もしないコマンドとして残す（B-1 の `_aiEdits.*` と同じ形。2026-11-14） |
| 見逃した理由（消した部品の注入・設定のキーの読み手・コマンドの呼び手が残っていないかを見る検査が無い） | C-1 の検査に足す（曹参）。期待は本家から読む。ほかの単位にも同じ網をかける |
| スモークの devtools-console の誤りの鍵に版の置き場所のパスが入り、置き場所の違う版どうしで同じ誤りが「新しい誤り」に見える | 鍵からパスを外す（曹参） |
| `baseline-p5-c-all-r2.json` | C-1 の誤りを含むので、次の版の比べの相手にしない |
| 続きの編集の通信 | r2 の通信の監査で無かった。裁定の「通信があれば諮る」に当たらない |
| C-7 の「2回続けて通らなければ諮る」 | r2 では C-7 の自動の関門で落ちた所は無い |
| r3 の作り直しの途中で残りが2か所見つかり、`r3b`・`r3c` と作り直した（同じラベルで作り直すには zip の上書きと作業ツリーの削除が要り、許可の外） | 関門は `1.146.0-p5-c-all-r3c`（今の edits.patch と合う唯一の版）で行う。`r3`・`r3b` の版と使い捨ての作業ツリーは、削除の許可（依頼に `tmp/b/wt-*` を足した）が入ったら消す |
| `workbench.action.unifiedQuickAccess`（`quickAccessActions.ts`。消した部品のコマンドを呼ぶが `try/catch` でふつうのクイックアクセスに戻る） | 直さない。何もしないコマンドにすると戻らずに何も開かなくなる。網の例外（`ORPHAN_ALLOW`）に理由つきで入れる |

## 記録（2026-11-16、段階 C の版 r3c の関門で出た点。リーダーの判断）

根拠: `records/take-in/1.146.0-p5-c-all-r3c/gate-p5-c-all-r3c.md`・`gate-C-1-ai.md`

| 論点 | 扱い |
|---|---|
| r3c の判定 | C-2〜C-7 は合格（docs/03 の7節の1〜4。スモーク3回とも PASS 49 / FAIL 0、UNKNOWN service 0、通信の監査は許可の外 0）。C-1 は振る舞いは合格、静的なテスト（c1-unit）の2件が落ちるので保留 |
| c1-unit の網の誤検出（`IInstantiationService` の16件、共有プロセスに登録が残る `IGitHubService`、`unifiedQuickAccess`） | 網を直す（曹参）。`IInstantiationService` は数えない、edits.patch が直すファイルや別のプロセスに残る登録も「残る登録」と数える、`unifiedQuickAccess` は理由つきの例外 |
| C-1 の edits.patch の書式の傷（手で足した区画の空の文脈の行の先頭の空白が落ちている、`index` の行が無い） | 直す（蒙恬）。空の文脈の行は1文字の空白に戻す。`index` の行は、タグの木と当てた木のファイルの中身から blob の SHA-1 を台本で計算して入れる（git の許可が `tmp/b` に当たらないため。`git hash-object` と同じ計算）。直したら版 r4 を作り、大岡越前守は照らし役・c1-unit・スモーク1回で振る舞いが r3c と同じことを見る |
| C-1〜C-7 の `enabled: true` のコミット | C-3〜C-7 は `after` に C-1 を持つので、C-1 の保留が片づいてから全部まとめてコミットする |
| 次の比べの基準 | `baseline-p5-c-all-r3c.json` を使ってよい |

## 裁定（2026-11-16、写し方）

| 論点 | 裁定 |
|---|---|
| C:\b から tmp\b へ移す作業の写し方 | コマンド（台本を含む）で写す。LLM の機能（Read で読んで Write で書く）で写さない（ユーザーの指示）。写した後は、コマンドで大きさと SHA-256 を照らす |
| 前に Read・Write で写した `records/phase0/evidence/` の22ファイル（1ファイルは元とバイト単位で違う） | コマンドで写し直す。元の `C:\b\p0` を消すのは、写し直しと照らしが済んでから |

## 記録（2026-11-16、Team の返答で課に求められた点。リーダーの判断）

根拠: `tasks/2026-11-15-move-off-c/permission-response.md` の4節

| 論点 | 扱い |
|---|---|
| reflog だけが指す commit（リーダーが1回だけ打つ確かめ） | 2300 個。ほとんどは単位を当てるたびに台本が作る途中の commit（`shuko-apply` の `unit`・`apply` など）で、`removals/` とタグから作り直せる。残す版は `builds/*` と `keep/wt-*` の取り込みで残る。残さない（`tasks/2026-11-16-before-delete-c/brief.md`） |
| U9: `tmp/b/wt-r2`・`wt-r3`・`wt-r3b`・`wt-r3c`（ずっと使う行 `tmp/b/wt/*` の外） | これからの作業ツリーは `tmp/b/wt/<名前>` の下に作る。外にある4つ（と r4 を外に作ったならそれも）は、関門が済んだら片づけを Team に依頼する（`worktree remove` の名指しの行） |
| U10: 古い clone の枝のうち取らないもの | `main`（本家の古い main）と、取り込む `builds/*`・`keep/wt-*` 以外は要らない。タグは本家から取り直せる |
| R22: `take-in.mjs` の `--records-dir` で記録を `records/take-in/` の外へ向けると、判定役が材料を読めない | `--records-dir` を `records/take-in/` の外に向けない決まりにする。台本に、外を指したら止める検査を足す（蒙恬。急がない） |
| U6: リーダーはフックの対象外なので、リポジトリの直下で `git clean -x` などを打つと `tmp/b`（clone を含む）が消える | リーダーは、リポジトリの直下で `clean`・`checkout`・`reset` を打たない。課の台帳に書いた |

## 記録（2026-11-16、C:\b を消す前の確かめで出た点。リーダーの判断）

根拠: `tasks/2026-11-16-before-delete-c/handoff-notes-meng-tian.md`

| 論点 | 扱い |
|---|---|
| 作業ツリー `trial-bwt` の未コミットの変更2行（`removals/A-8-trial/edits.patch` の変更と、追跡していない `product.overlay.json`。取り込みの試しの残り） | 捨ててよい（試しの単位と設定で、本物の単位と関係しない。結果は tasks の記録にある） |
| 写していない5項目（`take-in`・`take-in-trial`・`notion-sync-trial`・`p4-watch`・`tmp`） | 試しの残りなので要らない。`p4-watch\trial\real\responses.json`（GitHub と Open VSX の本物の応答）だけは、コマンドで `tasks/2026-11-16-before-delete-c/kept/` に写して残す |
| basedpyright・bash-ide の `files.json`（前は Read・Write で写せず、写さない判断にした） | コマンドで写せるようになったので、`records/phase0/evidence/` に写す（写し直しの一覧に足す） |
| `extensions-src/notion-sync/dev/trial.mts` の既定 `C:\b\notion-sync-trial`、`check-env.ps1` の C: のキャッシュ、`take-in.mjs` の `--records-dir` | 直す（蒙恬。関門の後にまとめる）。消した後に走らせると `C:\b` を作り直すので、`trial.mts` は消す前か直後に直す |

## 裁定（2026-11-16、写し直しを走らせる人）

| 論点 | 裁定 |
|---|---|
| 写し直しの台本（`scripts/copy-verify.mjs`）を、`records/` の書き手の大岡越前守が走らせる許可が無い | 大岡越前守に許可を足す（ユーザーの答え「大岡越前守に許可を足す（推奨）」）。Team の開発部への依頼は `tasks/2026-11-16-before-delete-c/permission-requests-2.md`。許可が入るまで C:\b を消す段は待つ |

## 記録（2026-11-16、版 r4 で出た点。リーダーの判断）

根拠: `tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md` の「r4」

| 論点 | 扱い |
|---|---|
| C-1 の edits.patch の書式の傷 | `tmp/b/wt/c1fix` で `git format-patch` で丸ごと作り直した（全121区画に `index` の行、空の文脈の行 0、+/- の行は前と同じ）。3方向の当て方が効くことを確かめた。版 `1.146.0-p5-c-all-r4` の木は r3c と同じ |
| `git -C tmp/b/vscode worktree add tmp/b/wt/<名前>` が `-C` の先からの相対で読まれ、clone の中に入れ子の作業ツリーができた | 許しの書き方を直すよう Team に依頼する（`permission-requests-2.md` の2）。それまで、作業ツリーを作るのは `build.mjs --worktree` に任せ、直接の `worktree add` を打たない |
| gulp の出力 `tmp/b/wt/VSCode-win32-x64` を `tmp/b/wt/` の下の作業ツリーが共有する | 同時に2つの版をパッケージ化しない |

## 記録（2026-11-16、段階 C の関門の合格。リーダーの判断）

| 論点 | 扱い |
|---|---|
| 段階 C（C-1〜C-7） | 版 `1.146.0-p5-c-all-r4` で C-1〜C-7 の全部が関門に合格（大岡越前守。`records/take-in/1.146.0-p5-c-all-r4/gate-p5-c-all-r4.md`）。C-1〜C-7 の `enabled: true` をコミットする。これで当初の設計の機能の削減（段階 A・B・C の21単位）がすべて有効になった |
| 最終の版 | `tmp\b\dist\1.146.0-p5-c-all-r4.zip`（SHA-256 `e3e524699a9994a6507dfa6896eaefb2582ae3fdf75798186c5411e5f91a2e6e`）。入れ替えはユーザーが行う（裁定）。手の項目は r2 の C1〜C21 と r3c の C22（版を r4 に読み替える） |
| 次の版のスモークの比べの相手 | `baseline-p5-c-all-r3c.json`（3回の和。r4 の基準は1回分） |

## 記録（2026-11-16、写し直しの台本の穴。リーダーの判断）

根拠: `tasks/2026-11-16-before-delete-c/handoff-notes-cao-shen.md`・`handoff-notes-meng-tian.md` の「4回目」

| 論点 | 扱い |
|---|---|
| `copy-verify.mjs` の穴（途中のフォルダのジャンクションをたどって柵の外を読み書きする、`--out` に柵が無い） | 直す（蒙恬）。途中のフォルダを全部見てリンクがあれば止める。`--out` は `tasks/` の下か `tmp/tests/`（テストの作業場所）の下に限り、`tmp/b` の下には置けない。元の柵の下・一覧の元や写し先・一覧のファイルと同じ所も止める |

## 記録（2026-11-16、C: に書く残りの直し。リーダーの判断）

根拠: `tasks/2026-11-16-small-fixes/handoff-notes-meng-tian.md`

| 論点 | 扱い |
|---|---|
| `notion-sync` の試しの台本（`trial.mts`）が、前は置き場所を丸ごと消してから作り直していた | 消さずに、毎回その下に新しい `run-XXXXXX` を作る形を認める（台本が削除の許可の外を消さない。課の台帳の「塞いでいない穴」）。既定の置き場所は `<buildRoot>\trial-notion-sync`（削除の許可の `tmp/b/trial-*` に入る） |
| `take-in.mjs` の `--records-dir` | `records/take-in/` の下でなければ、何かを作る前に止める（判定役が読めないため。前は警告だけで続けた） |
| `check-env.ps1` | 起こす子の TEMP・TMP と pnpm・npm のキャッシュを `<buildRoot>` の下へ向ける。LOCALAPPDATA は変えない |

## 裁定（2026-11-16、版の入れ替え）

| 論点 | 裁定 |
|---|---|
| 版の入れ替え（前の裁定は「入れ替えはユーザーが行う」） | 課に任せる（ユーザーの答え「入れ替えも課に任せる」）。蒙恬が手順書（`docs/install.md`）の1（`configure.ps1` で `local.json`）・2（`switch.ps1` で版のフォルダと `current`）・4（`install-extensions.mjs` で台帳の拡張）を打つ。どれも今の許可（`powershell … -File scripts/*.ps1`・`node scripts/*.mjs`）で走る。版は `1.146.0-p5-c-all-r4`、ラベルは `1.146.0-1` |
| 初めの1回だけの設定（3 スタートメニューと PATH、5 外部ツール、6 Notion のトークン、7 タスクスケジューラ） | ユーザーが行う（3 は手の手順で台本が無い、5 は UAC が出うる、6 は秘密でユーザーだけが入れる決まり、7 はトークンの復号にユーザーの権限が要る） |
| 画面を見る確かめ（C1〜C22） | ユーザーが行う |

## 裁定（2026-11-16、機能削減の完了）

| 論点 | 裁定 |
|---|---|
| 目標「当初予定していた設計を満たすまで実装（機能削減）を完了させる」をどこで閉じるか | ここで完了とする（ユーザーの答え「ここで完了とする（推奨）」）。段階 A・B・C の21単位を当てた版 `1.146.0-p5-c-all-r4` が関門に合格し、日常の版として入った（`shuko --version` が `7fac30e8…`）。画面を見る確かめ（C1〜C22）と手順書の3・5・6・7 はユーザーの都合のよいときに行い、不具合があれば課が直す。`C:\b` の片づけは、Team の許可（`tasks/2026-11-16-before-delete-c/permission-requests-2.md`）が入ったら別の仕事として進める |

## 裁定（2026-11-17、アイコン・日本語化・拡張の足し方）

ユーザーの指示（2026-11-17）: 「エディタのアイコンを Claude のアイコン＋VSCode を合成したようなものにしてください。また、日本語化がうまくいっていないので日本語化してください。また、今後のプラグインの追加方法については、Claude のプロンプト経由でプラグイン登録を代行依頼し、スリム化したこのプロジェクト用に回収してから入れてもらう段取りにする」

| 論点 | 裁定 |
|---|---|
| エディタのアイコン | Claude のアイコンと VS Code のアイコンを合わせた意匠にする。2026-11-12 の「Microsoft・Visual Studio・Claude の名称とロゴは使わない」は、アイコンについてこれで改める。名前は Shuko（仮）のままで、名称は今までどおり使わない。前提は個人利用（利用者は1人で、配布しない）。商標の扱いは確かめていない |
| 日本語化 | 未訳の部分を英語のまま残さず、日本語にする。2026-11-12 の「未訳の部分が英語になるのを受け入れる。目立つなら改めて諮る」を、これで改める。進め方（訳の取り方と入れ方）は課が決める（[04](04-bundled-extensions.md) の7節） |
| 拡張（プラグイン）の足し方 | ユーザーは拡張を自分で入れない。Claude へのプロンプトで課に代行を頼む。課は拡張を取得し、スリム化した Shuko に合うかを確かめ、要れば整えてから台帳に載せて入れる。手順は [04](04-bundled-extensions.md) の8節 |

## 記録（2026-11-17、上の裁定の当てはめ。リーダーの判断）

| 論点 | 扱い |
|---|---|
| 日本語が足りない所（2026-11-17 にリーダーが読んで確かめた） | 日本語パック（Open VSX の 1.131.0）は登録されて効いている。本体の文言 12,355 件のうち約 650 件が英語のまま（1.132〜1.146 で増えた文言）。パックの版が本体より古いことが原因 |
| 日本語化の進め方 | [04](04-bundled-extensions.md) の7節の別案（本体と同じ版の言語パックを自分で作る）を採る。訳の元は、新しいほうの公式の訳（Open VSX の日本語パック、または vscode-loc（MIT））とし、それでも足りない文言は課が訳を足す。Shuko のパッチが足した文言も訳す。作り方の詳細は蒙恬の調べを受けて7節に書く |
| アイコンの意匠の選び方 | 蒙恬が候補を複数作り、ユーザーに選んでもらってから本体を作り直す（作り直しが重いため） |
| 拡張を足すときに本体の作り直しが要ること | `extensions.allowed` の既定は product.json にあるので、新しい ID を足すには本体を作り直す。急がなければ毎週の取り込みの版に乗せる |
| 「回収してから入れる」の読み方 | 課が取得して、スリム化した Shuko 向けに確かめ・整えてから入れる、と読む（「改修」とも読めるので両方を含めた）。違えばユーザーが直す |

## 記録（2026-11-17、日本語パックの作り方で出た点。リーダーの判断）

根拠: `tasks/2026-11-17-l10n-ja/l10n-design.md`・`handoff-notes-meng-tian.md`、`tasks/2026-11-17-icon-l10n-tests/handoff-notes-cao-shen.md`

| 論点 | 扱い |
|---|---|
| 入れ方 | 組み込みの拡張 `shuko.language-pack-ja`（`extensions-src/language-pack-ja/`）にし、Open VSX の `MS-CEINTL.vscode-language-pack-ja` 1.131.0 と置き換える。台帳と `extensions.allowed` から外す。両方を入れると、後から読むユーザーの拡張（古い訳）が勝つため |
| 訳の元に vscode-loc の未マージの PR #2450（Microsoft の自動の書き出し。作者 azure-pipelines[bot]、head `e0407b9e`、2026-10-23）を最優先で使うこと | 認める。公式の訳の最新で、MIT。commit とファイルごとの SHA-256 を `sources.json` に固定し、同じものから作り直せる。main だけにすると、課が訳す文言が 187 件から 578 件に増える |
| 公式の訳が英語のままの文言（9件）を課の訳で上書きすること | 認める（裁定「未訳を残さない」の当てはめ） |
| パックの出力（`dist/`、`main.i18n.json` は約 3.65 MB）をリポジトリに入れること | 認める（notion-sync の dist と同じ扱い） |
| 日本語パックの新版の検知（台帳から外したので `tools/watch` が見なくなる） | 別の検知の項目は足さない。本体の新版の取り込みのときに、訳の元を新しくし、増えた文言を訳す（`TAKE-IN.md` の手順） |
| 取り込みで未訳が残るとき | 採否は止めない（セキュリティの修正を遅らせない）。判定には未訳の数を書く。入れ替えの前に課が訳を足して作り直すのを基本とし、急ぐセキュリティの修正では英語が残ったまま入れ替えて、後で訳を足してよい。訳すのは蒙恬で、自動にはしない（今は） |
| 調べに使った使い捨ての台本（`scripts/l10n-probe.mjs`・`tests/probe-l10n.mjs`）と重複の出力（`audit-run-pack1131.json`） | コミットしない |
| アイコンの元の絵 | VS Code は公式の 1.146.0 の `code-icon.svg`、Claude は Claude Code 拡張 2.1.322 の `claude-logo.svg`（ビルドのキャッシュの VSIX から取り出した。入っている拡張のファイルと SHA-256 `a3101f30…8364` が同じことをリーダーが確かめた）。写しは `scripts/icon-src/`（`assets/` の下に置くと作業ツリーへ写るため） |

## 裁定（2026-11-17、アイコンの意匠と古い日本語パックの外し方）

| 論点 | 裁定 |
|---|---|
| アイコンの意匠（候補 A・B・C と参考の D。`tasks/2026-11-17-icon/preview-all.png`） | A「中央に印」（ユーザーの答え「A 中央に印（推奨）」）。VS Code の青いリボンを全面に置き、真ん中に Claude の橙の印を重ねる（台本の `center-spark`） |
| 古い日本語パック（Open VSX の 1.131.0）を入れ替えのときに外す操作。今は課の許可に無い | 蒙恬に許可を足す（ユーザーの答え「蒙恬に許可を足す（推奨）」）。今回の分と、これからの「拡張を外す」代行（[04](04-bundled-extensions.md) の8節）の両方に使う。Team の開発部への依頼は `tasks/2026-11-17-l10n-ja/permission-requests.md`。許可が入るまで入れ替えは待ち、ビルドと検証は先に進める |

## 記録（2026-11-17、日本語パックの検証で出た点。リーダーの判断）

根拠: `tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md`（大岡越前守。判定は条件つきの合格）

| 論点 | 扱い |
|---|---|
| ビルドの後の確かめで、bundle（`vscode.l10n.t`）の 1,545 件を独立に数える手段が無い（`l10n-ja.mjs count` は大岡越前守の許可に無い） | 許可は足さない。曹参が網（`tests/l10n-audit.mjs`）を広げて bundle と直書きも数える。大岡越前守はそれで確かめる |
| `scripts/lib/p0-common.ps1` が本家の基準の環境に 1.131.0 のパックを入れる作り | 直さない。Phase 0 の引退した道具で、走らせない（2026-11-15 の裁定）。走らせることになったら先に直す |
| 直す点（apply.mjs がパックの無いときに黙って進む、印の照らしが弱い） | 今回のビルドの前に蒙恬が直す |

## 記録（2026-11-17、日本語パックのテストで出た点。リーダーの判断）

根拠: `tasks/2026-11-17-icon-ja-tests/handoff-notes-cao-shen.md`

| 論点 | 扱い |
|---|---|
| `@vscode/l10n-dev` 0.0.35 が `\u2194`（↔）を U+0219 と読み、`vscode.git` の bundle の2件（`{0} ↔ {1}` など。書式だけ）のパックの鍵が実行時の鍵と合わない | 案 b: 束の鍵を実行時の鍵に直す（蒙恬。`\uXXXX` の読み方を実行時とそろえる）。除外で隠す案 a は採らない（言葉のある文言で起きると、訳が黙って効かなくなるため）。曹参の網の `todo` の1件は、直った後に通常のテストに戻す |

## 記録（2026-11-17、版 r5 のビルドで出た点。リーダーの判断）

根拠: `tasks/2026-11-17-icon-ja-build/handoff-notes-meng-tian.md`

| 論点 | 扱い |
|---|---|
| r5 は bundle の鍵の直しの前にパッケージ化され、git の bundle の2件が未訳で残る | 作り直す（版 `1.146.0-p5-c-all-r6`。約20分）。関門は r6 で、「除外の外の未訳 0」を例外なしで満たす版で行う。r5 は関門に使わない |
| 強めた印の照らしで見つかった公式の訳の誤り（5件。リンクが切れているなど） | 課の上書き（`override`）で直す（r6 に入れる） |
| パックの束に、下の層（vscode-loc の main、Open VSX 1.131.0）だけにある鍵が入る（本体は引かない） | 束から外さない（dist を `sources.json` と `added/` だけで決める作りを保つ）。`ThirdPartyNotices.txt` に下の層の出典も書く |
| 取り込みで `count` の出力を `records/take-in/<label>/` に置く手順（蒙恬は `records/` に書けない） | 許可は足さない。`take-in.mjs` がビルドの後に `extract` と `count` を自動で走らせ、記録に書く形にする（数えるだけで、訳さない） |
| `TAKE-IN.md` の「入れ替えはユーザーが行う」 | 2026-11-16 の裁定（課が行う）に合わせて直す（蒙恬） |
| 使い捨ての `scripts/l10n-probe.mjs` と `tmp/` の要約のファイル | コミットしない（`tmp/` は git の外） |

## 記録（2026-11-17、版 r6 の関門。リーダーの判断）

根拠: `records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6.md`、`tasks/2026-11-17-r6-gate/handoff-notes-ooka-echizen.md`

大岡越前守の判定は合格。版 `1.146.0-p5-c-all-r6` を日常の版 r4 と入れ替えてよい。入れ替えは、古い日本語パックを外す許可が蒙恬に入ってから行う（Team に依頼中。`tasks/2026-11-17-l10n-ja/permission-requests.md`）。

| 論点 | 扱い |
|---|---|
| 直すべき小さな点 L1〜L3（蒙恬）、T1（曹参） | 入れ替えを止めない。次の取り込みの前に直す（`tasks/2026-11-17-r6-followups/`）。L1: `runL10nCount` が前の回の `l10n-count.json` を写す。L2: 出力が無いときは `failed` にする。L3: `language-pack-ja/README.md` の古い説明。T1: take-in の3件を振る舞いで見るテストに替える |
| T2（古い 1.131.0 のパックで不合格を見るテストが `~/.shuko/extensions` を読む） | 入れ替えの後に曹参が直す（キャッシュの VSIX か模擬のパックに替える） |
| D1（`docs/install.md` の拡張の数と言語パック、`--version` の commit） | 入れ替えのときにリーダーが直す |
| r5 の記録（ビルドの記録・起動の確かめ・数えの結果） | コミットする。裁定の記録と蒙恬の引き継ぎが根拠として名前を挙げているため |
| 曹参の古い出力（`audit-r4-newpack*.json`、`audit-r4-pack1131.json`、`extra-exclusions-bundle-escape.json`、`icon-l10n-tests/audit-run-pack1131.json`） | コミットしない |
| `move-off-c.test.mjs` の落ち1件（動いている日常の Shuko を見て `configure.ps1` が `editor-running` で止まる） | 環境の都合で、今回の変更とは関係しない。扱いを変えない |

## 記録（2026-11-17、r6 の直し（L1）で出た点。リーダーの判断）

根拠: `tasks/2026-11-17-r6-followups/handoff-notes-meng-tian.md`

| 論点 | 扱い |
|---|---|
| L1 の直し方（前の回の `records/take-in/<label>/l10n-count.json` は蒙恬の削除の許可の外） | 消さない。`count` の前後でファイルの印（有無・時刻・大きさ）を比べ、この回に書かれていなければ読まずに `failed`（`staleOutput: true`）にする（蒙恬の案を採る） |
| 判定役（狄仁傑）が前の回の古い `l10n-count.json` を材料として読みうる | 案 b: `staleOutput` のときは `listMaterials` の `skip` でこのファイルを材料から外す（蒙恬）。消す・上書きする案 a は許可が要るので採らない。TAKE-IN.md への注意書き（案 c）だけには頼らない |
| `--from` の続きで、前の回のファイルが残っていると数え直されない | 直す。数えの条件に「前の記録の `l10n.status` が `failed`」を足す（蒙恬）。条件の書き方を見ている `tests/l10n-r6.test.mjs` は、振る舞いで見る形に合わせる（曹参） |
| 続きの回（`--from`）で、前の回の warnings の日本語パックの1行が写されない | 直さない。前の回の `l10n` は `take-in.json` に写るようにした（蒙恬）ので、判定役は TAKE-IN.md の3節に従って `status` と `reason` を書ける |
| 検証で出たテストの網の穴 G1〜G3（count の前で落ちたときの `staleOutput`、`judge`・`runCore` の配線、案 b の照らす基準） | 埋める（曹参。`tasks/2026-11-17-r6-test-gaps/`）。T1 の「振る舞いで見る」の残りとして扱う。蒙恬の気づいた2点（ビルドが落ちた続きの回に前の `l10n` が残る、extract の失敗に `reason` が無い）は直さない |
| G2c の構造の件の正規表現が空白・引用符を固定している（S1。`tasks/2026-11-17-r6-test-gaps/verification-r6-test-gaps.md`） | 今は直さない。誤って通る向きの穴ではなく、書き方を変えたときに落ちるだけなので、そのときに曹参が正規表現を直す |
| 全体の run-all（3,021 件）の落ち2件（`move-off-c.test.mjs`・`configure.test.mjs`。`records/take-in/1.146.0-p5-c-all-r6/gate-p5-c-all-r6-addendum.md`） | どちらも、動いている日常の Shuko を `configure.ps1` が見つけて止まる環境の都合で、r6 と関係しない。r6 の合格は変わらない。テストが本物の `installRoot` に頼る作り（T3）は曹参が直す（`tasks/2026-11-17-r6-test-isolation/`） |
| T3 の検証で、日常の Shuko が動いていることを大岡越前守がプロセスで確かめられない（許可に無い） | 許可は足さない。2件はエディタを探す処理に入らないこと（コード）と、検証の直後にリーダーが `tasklist` で Shuko.exe が動いているのを見たことで、完了条件を満たしたとする |

## 裁定（2026-11-17、ビルドの依頼とデスクトップのショートカット）

ユーザーの依頼「エディタのビルドを実行して、デスクトップにバイナリのショートカットをおいてください」への問いと答え。根拠: `tasks/2026-11-17-desktop-shortcut/`

| 論点 | 裁定 |
|---|---|
| ビルドを作り直すか（r6 の後の変更は取り込みの台本・テスト・README の説明だけで、版の中身に効かない） | 作り直さない。関門に合格した `1.146.0-p5-c-all-r6` を使う（ユーザーの答え「r6 を使う（推奨）」）。日常の版への入れ替えは、前の裁定どおり古い日本語パックを外す許可を待つ |
| デスクトップのショートカット（課の誰にもデスクトップに書く許可が無い） | 蒙恬が作る許可を Team の開発部に依頼する（ユーザーの答え「Team に許可を依頼」。推奨はユーザーが自分で作る案だった）。依頼は `tasks/2026-11-17-desktop-shortcut/permission-requests.md`。指す先は `current\Shuko.exe`（入れ替えの後も作り直さない）。`configure.ps1 -InstallRoot` はデスクトップのショートカットを向け直さないので、置き場所を変えるときに作り直す |

## 裁定（2026-11-18、タスクバーの右クリックの「New Window」）

ユーザーの依頼「タスクバー上の右クリックメニューの中に、新しいウィンドウを開く選択肢を追加してください。複数起動したいときに不便です」への問いと答え。根拠: `tasks/2026-11-18-start-menu-aumid/`

見立て（リーダー）: 上流のジャンプリストの「New Window」（`-n` で起動）は Shuko にも残っている（C-1 で外したのは「Agents Window」だけ）。main.log にジャンプリストの誤りは無い。Shuko の窓は明示の AppUserModelID `Shuko.Editor`（product.json の `win32AppUserModelId`）を名乗るが、同じ ID を持つショートカットがスタートメニューに無いため、Windows が窓とアプリを結び付けられず、ジャンプリストとアプリ名の行を出していない。公式のインストーラーは ID 付きのショートカットを作るが、zip で入れる Shuko には無い。推定であり、ユーザーがタスクバーで確かめるまで確定しない。

| 論点 | 裁定 |
|---|---|
| 直し方 | スタートメニューのショートカットに AppUserModelID を付ける（ユーザーの答え「ショートカットに ID（推奨）」）。蒙恬が ID 付きのショートカットを作る台本を書き、`docs/install.md` の 3.1 をその台本の実行に差し替える。スタートメニューの初めの設定はユーザーが行う裁定どおり、台本はユーザーが1回実行する。本体へのパッチ（窓ごとの `setAppDetails`）は採らない |
| デスクトップのショートカット | 今の許可の行（ID を付けない）のまま作ってよい。ID はスタートメニューの1つにあれば足りる |
| `configure.ps1 -InstallRoot` の向け直し | 向け直した後も ID が残ることを確かめる。消えるなら直す |

## 記録（2026-11-18、ID 付きショートカットの台本の検証。リーダーの判断）

根拠: `tasks/2026-11-18-start-menu-aumid-verify/verification-start-menu-aumid.md`（大岡越前守）。台本・テスト（31件すべて通過）・デスクトップのショートカット・見立ての裏付けは合格。不合格は差し替え案の出力の順の書き方1点。

| 論点 | 扱い |
|---|---|
| 差し替え案の出力の順（「最後に3行」「3行の前に知らせの行」は、台本が3行の後に `ok` と `read-back differs` を出すのと合わない） | install.md に写すときにリーダーが直した（検証の記録が認める直し方）。台本は直さない |
| `tests/configure.test.mjs` の冒頭の注釈（「どの実行も `-NoShellIntegration` を付ける」が末尾の2件と合わない）、蒙恬の引き継ぎの app.ts の行番号 | 振る舞いに効かない。次に曹参がこのテストに触れるときに注釈を直す |
| 終了 2 の経路・拡張子が .lnk でない・置き場所のフォルダが無いときのテスト | 足さない（依頼書の必須ではない） |
| 蒙恬の手元の確かめの台本 `scripts/trial-start-menu-aumid.ps1` | コミットしない。テストが同じ場合を覆う |
| portable（`data` フォルダがある）のときはジャンプリストが出ず、ID に `.Portable` が付く（上流のとおり） | Shuko は portable で使わないので、資料に足さない |

## 裁定（2026-11-18、エディタの名前）

ユーザーの依頼「アプリケーションの名前を変えたい。日本の神様の名前を当てたい」への問いと答え。リーダーが候補（思兼・少名毘古那・久延毘古・一言主など）を出し、ユーザーが選んだ。根拠: `tasks/2026-11-18-rename-sukuna-survey/`

| 論点 | 裁定 |
|---|---|
| エディタの名前（[08](08-risks-and-open-items.md) の未決の1） | **少名毘古那（すくなびこな）**。ローマ字は **Sukuna**（ユーザーの答え「少名毘古那 Sukuna」。推奨は思兼 Omoikane だった）。由来: 小さな体で国づくりをした技と医薬の神。省メモリの方針に合う |
| 改名の進め方 | 課が段取りする。まず蒙恬が影響の範囲と移行の手順を調べる（`tasks/2026-11-18-rename-sukuna-survey/`）。product.json の名前・データの置き場所・`local.json` と `installRoot` の既定値・権限とフックの中の `Shuko` の場所を変えるので、権限とフックの変更は案ができてからユーザーの承認を取り、Team の開発部に依頼する。移行が済むまで、実装と資料の `Shuko` はそのまま残す |

## 裁定（2026-11-18、改名の進め方）

蒙恬の案（`tasks/2026-11-18-rename-sukuna-survey/rename-plan.md` の6節）への問いと答え。

| 論点 | 裁定 |
|---|---|
| 表示の名前（`nameLong`） | すべて `Sukuna`（ユーザーの答え「すべて Sukuna（推奨）」）。漢字は使わない |
| 名前を変える範囲 | 全部 Sukuna にする（ユーザーの答え「全部 Sukuna に（推奨）」）。product.json の名前一式に加え、内部の印（パッチの作者・注釈・独自キー・関数の名前・UA）、組み込み拡張の publisher（`sukuna`）、Notion の ToDo の「プロジェクト」（`Sukuna`）も変える。publisher が変わるので notion-sync のトークンはユーザーが1回入れ直す。開いている「Shuko」の ToDo は書き換えない |
| 移行の形 | 並べて入れる（ユーザーの答え「並べて入れる（推奨）」）。Sukuna を新しい場所に入れ、Shuko は消さずに残す。ユーザーが引退してよいと答えたら、ユーザーが Shuko を消す |
| 設定・`argv.json`・検知の状態と Notion のトークンを写す台本を誰が打つか | **課が打つ**（ユーザーの答え「課が打つ」。推奨はユーザーが打つ案だった）。台本は蒙恬が作り、打つ。秘密の場所（`%LOCALAPPDATA%\Shuko\watch\` など）を写す台本を課が打つための許可を、権限の変更の依頼に足す（ユーザーの承認の後に Team の開発部へ）。エージェントが秘密の中身を開かない決まりは変えない（台本がファイルを写すだけ） |
| 諮らずに進める点（蒙恬の案のまま） | インストーラー用の GUID 4つは変えない。過去の記録（`tasks/`・`records/`・`docs/user-decisions.md`）は直さない。版のラベルは `1.146.0-p5-c-all-r7` |
